/**
 * ============================================================================
 * REPORT V3 CONTROLLER
 *   GET  /v3/reports/:id/export/pdf[?rev=N]   – FINAL (APPROVED) hoặc DRAFT (watermark)
 *   GET  /v3/reports/:id/preview/html          – xem trước (POST: overrides, chỉ cho hồ sơ chưa APPROVED)
 *   GET  /v3/reports/:id/releases              – danh sách Rev
 *   POST /v3/reports/:id/releases              – "Phát hành Rev mới" { reason }
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { BadRequestError, UnauthorizedError } from '../../common/errors/problem-details';
import { ReportV3Service } from './report-v3.service';
import { ReportReleaseService } from './report-release.service';

function parseRevision(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new BadRequestError('Tham số rev phải là số nguyên không âm');
  }
  return n;
}

function safeFilename(reportNo: string, suffix: string): string {
  return `${reportNo.replace(/[/\\?%*:|"<>]/g, '_')}${suffix}.pdf`;
}

export class ReportV3Controller {
  public static async exportPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      const resolved = await ReportV3Service.resolve(req.params.id);
      const rev = parseRevision(req.query.rev);

      if (resolved.status === 'APPROVED') {
        const { buffer, release } = await ReportReleaseService.getOrCreateFinalFile(resolved, req.user, rev);
        const label = `_Rev${String(release.revision).padStart(2, '0')}`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${encodeURIComponent(safeFilename(String(resolved.raw.report_code || resolved.id), label))}"`
        );
        res.setHeader('X-Report-Status', 'FINAL');
        res.setHeader('X-Report-Revision', String(release.revision));
        res.setHeader('X-Content-SHA256', release.sha256);
        res.status(200).send(buffer);
        return;
      }

      const enableWatermark = req.query.watermark !== 'false' && req.query.watermark !== '0';
      const { pdfBuffer, reportNo } = await ReportV3Service.renderDraftPdf(resolved, undefined, enableWatermark);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(safeFilename(reportNo, '_DRAFT'))}"`);
      res.setHeader('X-Report-Status', 'DRAFT');
      res.setHeader('X-Report-Revision', String(resolved.exportRevision));
      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  public static async previewHtml(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const resolved = await ReportV3Service.resolve(req.params.id);
      const overrides = req.method === 'POST' ? req.body?.overrides ?? req.body : undefined;
      const isGuest = req.user?.role === 'GUEST' || req.query.isGuest === 'true' || req.query.maskPii === 'true';
      const enableWatermark =
        isGuest || (req.query.watermark !== 'false' && req.query.watermark !== '0' && req.body?.enableWatermark !== false);

      const { html, viewModel } = await ReportV3Service.renderDraftHtml(resolved, overrides, isGuest, enableWatermark);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Content-Security-Policy',
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; img-src * data: blob: https:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline' https:;"
      );
      res.setHeader('X-Report-No', encodeURIComponent(viewModel.metadata.reportNo));
      res.setHeader('X-Report-Status', resolved.status === 'APPROVED' ? 'FINAL' : 'DRAFT');
      res.status(200).send(html);
    } catch (err) {
      next(err);
    }
  }

  public static async listReleases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const resolved = await ReportV3Service.resolve(req.params.id);
      const releases = await ReportReleaseService.list(resolved.id);
      res.status(200).json({ success: true, data: releases });
    } catch (err) {
      next(err);
    }
  }

  public static async issueRelease(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
      const release = await ReportReleaseService.issueNewRevision(req.params.id, req.user, reason);
      res.status(201).json({ success: true, data: release });
    } catch (err) {
      next(err);
    }
  }
}
