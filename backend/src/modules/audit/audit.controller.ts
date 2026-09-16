import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service';
import { ApproveReportDto, RejectReportDto } from './audit.dto';
import { BadRequestError } from '../../common/errors/problem-details';

export class AuditController {
  static async getProgressAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const zoneId = (req.query.zoneId as string) || req.user?.assignedZoneId || undefined;
      const result = await AuditService.getProgressAnalytics(zoneId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listAuditAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        zoneId: (req.query.zoneId as string) || req.user?.assignedZoneId || undefined,
        severity: req.query.severity as string,
        isResolved: req.query.isResolved ? req.query.isResolved === 'true' : false,
      };

      const alerts = await AuditService.listAuditAlerts(filters);
      res.status(200).json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getReportAuditFlags(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const flags = await AuditService.getReportAuditFlags(id);
      res.status(200).json({
        success: true,
        data: flags,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSplitPaneAuditView(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const payload = await AuditService.getSplitPaneAuditView(id);
      res.status(200).json({
        success: true,
        data: payload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async approveReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = ApproveReportDto.safeParse(req.body);
      const adminId = req.user!.userId;

      const result = await AuditService.approveReport(
        id,
        adminId,
        parsed.success ? parsed.data.judgementNotes : undefined
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async rejectReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = RejectReportDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Lý do trả về báo cáo không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const adminId = req.user!.userId;
      const result = await AuditService.rejectReport(id, adminId, parsed.data.rejectionReason);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
