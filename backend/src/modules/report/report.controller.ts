/**
 * ============================================================================
 * REPORT CONTROLLER (SINGLE CANONICAL API: /api/v1/reports/*)
 *   GET  /reports/:id                     – Chi tiết hồ sơ khảo sát (hỗ trợ ?rev=N)
 *   GET  /reports/:id/export/pdf[?rev=N]  – Xuất PDF FINAL (APPROVED) hoặc DRAFT
 *   GET  /reports/:id/preview/html        – Xem trước HTML báo cáo
 *   GET  /reports/:id/releases            – Danh sách các bản phát hành Rev
 *   POST /reports/:id/releases            – Phát hành Rev mới { reason }
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { BadRequestError, UnauthorizedError } from '../../common/errors/problem-details';
import { ReportService } from './services/report.service';
import { ReportReleaseService } from './services/report-release.service';

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

export class ReportController {
  public static async getReportDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const isGuest = req.user?.role === 'GUEST' || req.query.isGuest === 'true' || req.query.maskPii === 'true';
      const rev = parseRevision(req.query.rev);
      const report = await ReportService.getReportDetail(id, isGuest, rev);
      res.status(200).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }

  public static async exportPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      const resolved = await ReportService.resolve(req.params.id);
      const rev = parseRevision(req.params.rev ?? req.query.rev);
      const overrides = undefined;

      const enableWatermark =
        req.query.watermark !== 'false' &&
        req.query.watermark !== '0' &&
        req.body?.enableWatermark !== false &&
        req.body?.watermark !== false;

      const forceFresh = req.query.fresh === '1' || req.query.force === 'true';

      if (resolved.status === 'APPROVED' && enableWatermark && !forceFresh) {
        let shouldUseStoredRelease = true;
        if (rev === undefined) {
          const summary = await ReportReleaseService.getReleaseSummary(resolved.id);
          if (summary.hasPendingRelease && summary.latestRelease) {
            shouldUseStoredRelease = false;
          }
        }

        if (shouldUseStoredRelease) {
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
          res.setHeader('X-Watermark-Enabled', 'true');
          res.status(200).send(buffer);
          return;
        }
      }

      const { pdfBuffer, reportNo } = await ReportService.renderDraftPdf(resolved, overrides, enableWatermark, rev);
      const isApproved = resolved.status === 'APPROVED';
      const suffix = isApproved
        ? (enableWatermark ? '_APPROVED' : '_APPROVED_NO_WM')
        : (enableWatermark ? '_DRAFT' : '_DRAFT_NO_WM');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(safeFilename(reportNo, suffix))}"`);
      res.setHeader('X-Report-Status', isApproved ? 'FINAL' : 'DRAFT');
      res.setHeader('X-Report-Revision', String(rev ?? resolved.exportRevision));
      res.setHeader('X-Watermark-Enabled', String(enableWatermark));
      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  public static async previewHtml(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const resolved = await ReportService.resolve(req.params.id);
      const rev = parseRevision(req.params.rev ?? req.query.rev);
      const overrides = undefined;
      const isGuest = req.user?.role === 'GUEST' || req.query.isGuest === 'true' || req.query.maskPii === 'true';
      const enableWatermark =
        isGuest ||
        (req.query.watermark !== 'false' &&
          req.query.watermark !== '0' &&
          req.body?.enableWatermark !== false &&
          req.body?.watermark !== false);

      const { html, viewModel } = await ReportService.renderDraftHtml(resolved, overrides, isGuest, enableWatermark, rev);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Content-Security-Policy',
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; img-src * data: blob: https:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline' https:;"
      );
      res.setHeader('X-Report-No', encodeURIComponent(viewModel.metadata.reportNo));
      res.setHeader('X-Report-Status', resolved.status === 'APPROVED' ? 'FINAL' : 'DRAFT');
      res.setHeader('X-Report-Revision', String(viewModel.metadata.revision ?? rev ?? resolved.exportRevision));
      res.status(200).send(html);
    } catch (err) {
      next(err);
    }
  }

  public static async listReleases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const resolved = await ReportService.resolve(req.params.id);
      const summary = await ReportReleaseService.getReleaseSummary(resolved.id);
      res.status(200).json({
        success: true,
        data: summary.releases,
        hasPendingRelease: summary.hasPendingRelease,
        latestRelease: summary.latestRelease,
        currentExportRevision: summary.currentExportRevision,
      });
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
