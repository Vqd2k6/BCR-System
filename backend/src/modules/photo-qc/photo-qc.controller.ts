import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../../common/errors/problem-details';
import type { JwtPayload } from '../../common/guards/auth.guard';
import {
  PhotoQcListQuerySchema,
  PhotoQcRecaptureQuerySchema,
  UpdatePhotoQcPhotosSchema,
  UpdatePhotoQcReportSchema,
} from './photo-qc.schemas';
import { PhotoQcService } from './photo-qc.service';

const ReportIdSchema = z.string().uuid();

function requireUser(req: Request): JwtPayload {
  if (!req.user) throw new UnauthorizedError('Người dùng chưa xác thực');
  return req.user;
}

export class PhotoQcController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PhotoQcService.list(requireUser(req), PhotoQcListQuerySchema.parse(req.query));
      res.status(200).json({ success: true, data });
    } catch (err: unknown) {
      next(err);
    }
  }

  static async detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PhotoQcService.detail(requireUser(req), ReportIdSchema.parse(req.params.id));
      res.status(200).json({ success: true, data });
    } catch (err: unknown) {
      next(err);
    }
  }

  static async updateReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PhotoQcService.updateReport(
        requireUser(req),
        ReportIdSchema.parse(req.params.id),
        UpdatePhotoQcReportSchema.parse(req.body),
        req.ip
      );
      res.status(200).json({ success: true, data });
    } catch (err: unknown) {
      next(err);
    }
  }

  static async updatePhotos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PhotoQcService.updatePhotos(
        requireUser(req),
        ReportIdSchema.parse(req.params.id),
        UpdatePhotoQcPhotosSchema.parse(req.body?.items),
        req.ip
      );
      res.status(200).json({ success: true, data });
    } catch (err: unknown) {
      next(err);
    }
  }

  static async recaptureList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = PhotoQcRecaptureQuerySchema.parse(req.query);
      const rows = await PhotoQcService.recaptureList(requireUser(req), q);
      if (q.format === 'xlsx') {
        const buf = await PhotoQcService.recaptureWorkbook(rows);
        const stamp = new Date().toISOString().slice(0, 10);
        const name = `DanhSach_ChupLai_${q.station || q.zone || 'TOAN_TUYEN'}_${stamp}.xlsx`.replace(/[^A-Za-z0-9_.-]/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.status(200).send(buf);
        return;
      }
      res.status(200).json({ success: true, data: rows });
    } catch (err: unknown) {
      next(err);
    }
  }
}
