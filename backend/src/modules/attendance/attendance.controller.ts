import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from './attendance.service';
import { CheckInDto, VerifyAttendanceDto } from './attendance.dto';
import { BadRequestError } from '../../common/errors/problem-details';

export class AttendanceController {
  static async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = CheckInDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu chấm công không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const surveyorId = req.user!.userId;
      const result = await AttendanceService.checkIn(surveyorId, parsed.data);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const surveyorId = req.user!.userId;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const result = await AttendanceService.getMyHistory(surveyorId, startDate, endDate);
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
      const zoneId = req.user?.assignedZoneId || (req.query.zoneId as string) || 'ZONE_S9';
      const zoneInfo = await AttendanceService.getZoneInfo(zoneId);
      res.status(200).json({
        success: true,
        data: zoneInfo,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- ADMIN ENDPOINTS ---

  static async listCheckIns(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        zoneId: req.query.zoneId as string || req.user?.assignedZoneId || undefined,
        status: req.query.status as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      const result = await AttendanceService.listZoneCheckIns(filters);
      res.status(200).json({
        success: true,
        data: result.checkIns,
        pagination: {
          total: result.total,
          limit: filters.limit,
          offset: filters.offset,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCheckInDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const checkIn = await AttendanceService.getCheckInDetail(id);
      res.status(200).json({
        success: true,
        data: checkIn,
      });
    } catch (error) {
      next(error);
    }
  }

  static async verifyCheckIn(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = VerifyAttendanceDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu phê duyệt chấm công không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const adminId = req.user!.userId;
      const result = await AttendanceService.verifyAttendance(id, adminId, parsed.data.action, parsed.data.notes);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAttendanceSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const zoneId = req.query.zoneId as string || req.user?.assignedZoneId || undefined;
      const month = req.query.month as string;
      const summary = await AttendanceService.getSummary(zoneId, month);
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}
