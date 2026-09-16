import { Request, Response, NextFunction } from 'express';
import { ExportService } from './export.service';
import { CreateBatchExportDto } from './export.dto';
import { BadRequestError } from '../../common/errors/problem-details';

export class ExportController {
  static async createBatchExport(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = CreateBatchExportDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu yêu cầu xuất báo cáo không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const userId = req.user!.userId;
      const zoneId = parsed.data.zoneId || req.user?.assignedZoneId;

      const result = await ExportService.createBatchExport(userId, {
        ...parsed.data,
        zoneId,
      });

      res.status(202).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBatchStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId } = req.params;
      const batch = await ExportService.getBatchStatus(batchId);
      res.status(200).json({
        success: true,
        data: batch,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listAllExportBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const zoneId = req.query.zoneId as string;
      const batches = await ExportService.listAllExportBatches(zoneId);
      res.status(200).json({
        success: true,
        data: batches,
      });
    } catch (error) {
      next(error);
    }
  }

  static async revokeExport(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId } = req.params;
      const result = await ExportService.revokeAndPurgeExport(batchId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- CONTRACTOR & GUEST ENDPOINTS ---

  static async getGuestGisMap(req: Request, res: Response, next: NextFunction) {
    try {
      const zoneId = req.query.zoneId as string;
      const result = await ExportService.getGuestGisMap(zoneId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getGuestParcelSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const summary = await ExportService.getGuestParcelSummary(id);
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}
