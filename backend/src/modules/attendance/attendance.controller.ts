import { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { AttendanceService } from './attendance.service';
import {
  ATTENDANCE_ANOMALY_FILTERS,
  ATTENDANCE_STATUS_VALUES,
  BatchVerifyCleanDto,
  CheckInDto,
  CheckOutDto,
  PeriodLockDto,
  PeriodUnlockDto,
  VerifyAttendanceDto,
} from './attendance.dto';
import { BadRequestError, UnauthorizedError } from '../../common/errors/problem-details';
import type { JwtPayload } from '../../common/guards/auth.guard';
import { parseLimit, parseMonth, parseOffset, parseVnDate, type VerificationStatus } from './attendance.rules';

function parseBody<S extends ZodTypeAny>(schema: S, body: unknown, message: string): z.infer<S> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError(
      message,
      parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
    );
  }
  return parsed.data;
}

function requireUser(req: Request): JwtPayload {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

function queryString(req: Request, key: string): string | undefined {
  const v = req.query[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function queryBoolean(req: Request, key: string): boolean | undefined {
  const v = queryString(req, key);
  return v === 'true' ? true : v === 'false' ? false : undefined;
}

function queryStatus(req: Request): VerificationStatus | undefined {
  const v = queryString(req, 'status');
  if (!v) return undefined;
  if (!(ATTENDANCE_STATUS_VALUES as readonly string[]).includes(v)) {
    throw new BadRequestError(`Trạng thái lọc không hợp lệ: ${v}`);
  }
  return v as VerificationStatus;
}

function queryAnomaly(req: Request): string | undefined {
  const v = queryString(req, 'anomaly');
  if (!v) return undefined;
  if (!(ATTENDANCE_ANOMALY_FILTERS as readonly string[]).includes(v)) {
    throw new BadRequestError(`Loại cảnh báo lọc không hợp lệ: ${v}`);
  }
  return v;
}

/** Ngày lọc theo giờ VN; nhận cả tên cũ startDate/endDate (chỉ khi đúng dạng YYYY-MM-DD). */
function queryDateRange(req: Request): { fromDate?: string; toDate?: string } {
  const legacy = (key: string) => {
    const v = queryString(req, key);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  };
  return {
    fromDate: parseVnDate(queryString(req, 'fromDate') ?? legacy('startDate'), 'fromDate'),
    toDate: parseVnDate(queryString(req, 'toDate') ?? legacy('endDate'), 'toDate'),
  };
}

export class AttendanceController {
  static async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const data = parseBody(CheckInDto, req.body, 'Dữ liệu chấm công không hợp lệ');
      const result = await AttendanceService.checkIn(requireUser(req).userId, data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async checkOut(req: Request, res: Response, next: NextFunction) {
    try {
      const data = parseBody(CheckOutDto, req.body, 'Dữ liệu Check-out chấm công không hợp lệ');
      const result = await AttendanceService.checkOut(requireUser(req).userId, data);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getMyHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromDate, toDate } = queryDateRange(req);
      const result = await AttendanceService.getMyHistory(
        requireUser(req).userId,
        fromDate,
        toDate,
        queryBoolean(req, 'isCompanion')
      );
      res.status(200).json({
        success: true,
        data: result.checkIns,
        pagination: { total: result.total },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAssignedZone(req: Request, res: Response, next: NextFunction) {
    try {
      const zoneId = queryString(req, 'zoneId') || req.user?.assignedZoneId || undefined;
      if (!zoneId) {
        throw new BadRequestError('Tài khoản chưa được phân công phân khu. Vui lòng chọn phân khu chấm công.');
      }
      const zoneInfo = await AttendanceService.getZoneInfo(zoneId, req.user?.userId);
      res.status(200).json({ success: true, data: zoneInfo });
    } catch (error) {
      next(error);
    }
  }

  // --- ADMIN ENDPOINTS (phạm vi Zone luôn do server quyết định theo tài khoản) ---

  static async listCheckIns(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = parseLimit(req.query.limit, 20);
      const offset = parseOffset(req.query.offset);
      const result = await AttendanceService.listZoneCheckIns(requireUser(req), queryString(req, 'zoneId'), {
        status: queryStatus(req),
        anomaly: queryAnomaly(req),
        isCompanion: queryBoolean(req, 'isCompanion'),
        search: queryString(req, 'search'),
        ...queryDateRange(req),
        limit,
        offset,
      });
      res.status(200).json({
        success: true,
        data: result.checkIns,
        scope: result.scope,
        pagination: { total: result.total, limit, offset },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCheckInDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const checkIn = await AttendanceService.getCheckInDetail(requireUser(req), req.params.id);
      res.status(200).json({ success: true, data: checkIn });
    } catch (error) {
      next(error);
    }
  }

  static async verifyCheckIn(req: Request, res: Response, next: NextFunction) {
    try {
      const data = parseBody(VerifyAttendanceDto, req.body, 'Dữ liệu phê duyệt chấm công không hợp lệ');
      const result = await AttendanceService.verifyAttendance(requireUser(req), req.params.id, data.action, data.notes, req.ip);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async batchVerifyClean(req: Request, res: Response, next: NextFunction) {
    try {
      const data = parseBody(BatchVerifyCleanDto, req.body, 'Dữ liệu duyệt nhanh không hợp lệ');
      const result = await AttendanceService.batchVerifyClean(
        requireUser(req),
        data.zoneId || undefined,
        {
          fromDate: data.fromDate || undefined,
          toDate: data.toDate || undefined,
          isCompanion: typeof data.isCompanion === 'boolean' ? data.isCompanion : undefined,
          search: data.search || undefined,
        },
        data.dryRun,
        req.ip
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getCounters(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AttendanceService.getCounters(requireUser(req), queryString(req, 'zoneId'));
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getAttendanceSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await AttendanceService.getSummary(requireUser(req), queryString(req, 'zoneId'), parseMonth(req.query.month));
      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  static async exportSummaryCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const file = await AttendanceService.exportSummaryCsv(requireUser(req), queryString(req, 'zoneId'), parseMonth(req.query.month));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      res.status(200).send(file.content);
    } catch (error) {
      next(error);
    }
  }

  static async getPeriodStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AttendanceService.getPeriodStatus(requireUser(req), queryString(req, 'zoneId'), parseMonth(req.query.month));
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async lockPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const data = parseBody(PeriodLockDto, req.body, 'Dữ liệu chốt kỳ công không hợp lệ');
      const result = await AttendanceService.lockPeriod(requireUser(req), data.zoneId || undefined, data.month, req.ip);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async unlockPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const data = parseBody(PeriodUnlockDto, req.body, 'Dữ liệu mở khóa kỳ công không hợp lệ');
      const result = await AttendanceService.unlockPeriod(requireUser(req), data.zoneId || undefined, data.month, data.reason, req.ip);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
