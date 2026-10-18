import { Request, Response, NextFunction } from 'express';
import { ExportService } from './export.service';

export class ExportController {
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
