import type { Request, Response, NextFunction } from 'express';
import { progressQuerySchema } from './progress-report.schemas';
import { ProgressReportService, DEFAULT_FILTER_TEMPLATE } from './progress-report.service';
import { StreamDelivery, type ExportDelivery } from './delivery/export-delivery';
import { ProgressConfigProvider } from './config/config.provider';
import { saveConfigBodySchema } from './config/config.schema';
import { DEFAULT_PROGRESS_CONFIG } from './config/default-config';
import { listTemplates } from './columns/template.registry';
import type { ProgressFilter } from './progress-report.types';
import { UnauthorizedError } from '../../common/errors/problem-details';

const service = new ProgressReportService();
const delivery: ExportDelivery = new StreamDelivery();

/**
 * Phạm vi zone: tuân theo quy ước hiện hành của hệ thống (audit.controller):
 * có zoneId thì dùng; không có → SUPER_ADMIN = 'ALL', ZONE_ADMIN = zone được gán.
 * ZONE_ADMIN đã được gán zone cụ thể thì không được xuất 'ALL' (toàn tuyến).
 */
function toFilter(req: Request): ProgressFilter {
  const q = progressQuerySchema.parse(req.query);
  const user = req.user;
  if (!user) throw new UnauthorizedError('Người dùng chưa xác thực');
  const assigned = (user.assignedZoneId || '').toUpperCase();
  let zoneId = (q.zoneId || (user.role === 'SUPER_ADMIN' ? 'ALL' : assigned) || 'ALL').toUpperCase();
  if (user.role === 'ZONE_ADMIN' && zoneId === 'ALL' && assigned && assigned !== 'ALL' && assigned !== 'ALL_ZONES') {
    zoneId = assigned;
  }
  return {
    zoneId,
    timeMode: q.timeMode,
    fromDate: q.fromDate,
    toDate: q.toDate,
    templateId: q.templateId || DEFAULT_FILTER_TEMPLATE,
  };
}

export class ProgressReportController {
  static async preview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.preview(toFilter(req));
      res.status(200).json({ success: true, data });
    } catch (err: unknown) {
      next(err);
    }
  }

  static async exportFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter = toFilter(req);
      const format = progressQuerySchema.parse(req.query).format;
      const { file, filename, rowCount } = await service.export(filter, format);
      if (req.user) await ProgressReportService.recordExportAudit(req.user.userId, filter, rowCount, req.ip);
      await delivery.deliver(res, file, filename);
    } catch (err: unknown) {
      next(err);
    }
  }

  static async templates(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, data: listTemplates() });
  }

  static async getConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const active = await ProgressConfigProvider.getActive();
      const versions = await ProgressConfigProvider.listVersions();
      res.status(200).json({
        success: true,
        data: { ...active, defaults: DEFAULT_PROGRESS_CONFIG, versions },
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  static async saveConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError('Người dùng chưa xác thực');
      const body = saveConfigBodySchema.parse(req.body);
      const versionNumber = await ProgressConfigProvider.saveNewVersion(body.content, body.changeReason, req.user.userId);
      res.status(201).json({ success: true, data: { versionNumber } });
    } catch (err: unknown) {
      next(err);
    }
  }
}

