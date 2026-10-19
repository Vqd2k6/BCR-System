/**
 * ============================================================================
 * REPORT CONTENT CONFIG CONTROLLER (Super Admin)
 *   GET    /admin/report-config/standard-text            – lịch sử phiên bản (mới nhất trước)
 *   POST   /admin/report-config/standard-text            – tạo phiên bản mới { content, changeReason }
 *   GET    /admin/report-config/equipment                – danh mục thiết bị đang dùng
 *   POST   /admin/report-config/equipment                – thêm thiết bị
 *   PUT    /admin/report-config/equipment/:id            – sửa thiết bị
 *   DELETE /admin/report-config/equipment/:id            – xóa mềm { reason }
 * ============================================================================
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { BadRequestError, UnauthorizedError } from '../../common/errors/problem-details';
import { ReportConfigService } from './report-config.service';
import { CreateStandardTextVersionDto, EquipmentInputDto } from './report-config.types';

const DeleteEquipmentDto = z.object({
  reason: z.string().trim().min(5, 'Lý do xóa tối thiểu 5 ký tự').max(500),
});

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

export class ReportConfigController {
  static async listStandardText(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ReportConfigService.listStandardTextVersions();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async createStandardText(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const parsed = CreateStandardTextVersionDto.safeParse(req.body);
      if (!parsed.success) throw invalid('Nội dung văn bản chuẩn không hợp lệ', parsed.error);
      const data = await ReportConfigService.createStandardTextVersion(parsed.data.content, parsed.data.changeReason, userId);
      res.status(201).json({ success: true, message: `Đã tạo phiên bản văn bản chuẩn v${data.versionNumber}`, data });
    } catch (error) {
      next(error);
    }
  }

  static async listEquipment(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ReportConfigService.listEquipment();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async createEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const parsed = EquipmentInputDto.safeParse(req.body);
      if (!parsed.success) throw invalid('Thông tin thiết bị không hợp lệ', parsed.error);
      const data = await ReportConfigService.createEquipment(parsed.data, userId);
      res.status(201).json({ success: true, message: 'Đã thêm thiết bị', data });
    } catch (error) {
      next(error);
    }
  }

  static async updateEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const parsed = EquipmentInputDto.safeParse(req.body);
      if (!parsed.success) throw invalid('Thông tin thiết bị không hợp lệ', parsed.error);
      const data = await ReportConfigService.updateEquipment(req.params.id, parsed.data, userId);
      res.status(200).json({ success: true, message: 'Đã cập nhật thiết bị', data });
    } catch (error) {
      next(error);
    }
  }

  static async deleteEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const parsed = DeleteEquipmentDto.safeParse(req.body ?? {});
      if (!parsed.success) throw invalid('Thiếu lý do xóa thiết bị', parsed.error);
      await ReportConfigService.softDeleteEquipment(req.params.id, parsed.data.reason, userId);
      res.status(200).json({ success: true, message: 'Đã xóa thiết bị khỏi danh mục' });
    } catch (error) {
      next(error);
    }
  }
}
