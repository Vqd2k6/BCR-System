/**
 * ============================================================================
 * CẤU HÌNH KHUNG TÊN BÌNH ĐỒ CAD THEO ZONE
 *   GET  /zones/:zoneCode/drawing-title-block   – cấu hình + lịch sử phát hành (mọi vai trò đã đăng nhập)
 *   PUT  /zones/:zoneCode/drawing-title-block   – sửa chức danh ký & Số bản vẽ (Super Admin)
 *   POST /zones/:zoneCode/drawing-revisions     – phát hành lần mới { issueDate, description } (Super Admin)
 * ============================================================================
 */

import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';
import { BadRequestError, UnauthorizedError } from '../../common/errors/problem-details';
import { DrawingConfigService } from './drawing-config.service';
import { CreateRevisionDto, UpdateTitleBlockDto, ZoneCodeSchema } from './drawing-config.types';

function invalid(message: string, error: z.ZodError): BadRequestError {
  return new BadRequestError(
    message,
    error.issues.map((e) => ({ field: e.path.join('.'), message: e.message }))
  );
}

function requireUserId(req: Request): string {
  if (!req.user?.userId) throw new UnauthorizedError();
  return req.user.userId;
}

function parseZoneCode(req: Request): string {
  const parsed = ZoneCodeSchema.safeParse(req.params.zoneCode);
  if (!parsed.success) throw invalid('Mã Zone không hợp lệ', parsed.error);
  return parsed.data;
}

export class DrawingConfigController {
  static async getZoneConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DrawingConfigService.getZoneConfig(parseZoneCode(req));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async updateTitleBlock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const zoneCode = parseZoneCode(req);
      const parsed = UpdateTitleBlockDto.safeParse(req.body);
      if (!parsed.success) throw invalid('Thông tin khung tên không hợp lệ', parsed.error);
      const data = await DrawingConfigService.updateTitleBlock(zoneCode, parsed.data, userId);
      res.status(200).json({ success: true, message: `Đã lưu khung tên bình đồ ${zoneCode}`, data });
    } catch (error) {
      next(error);
    }
  }

  static async createRevision(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const zoneCode = parseZoneCode(req);
      const parsed = CreateRevisionDto.safeParse(req.body);
      if (!parsed.success) throw invalid('Thông tin phát hành không hợp lệ', parsed.error);
      const data = await DrawingConfigService.createRevision(zoneCode, parsed.data, userId);
      res.status(201).json({ success: true, message: `Đã phát hành ${data.revision} cho ${zoneCode}`, data });
    } catch (error) {
      next(error);
    }
  }
}
