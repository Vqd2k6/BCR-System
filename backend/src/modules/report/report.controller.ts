/**
 * ============================================================================
 * REPORT CONTROLLER (SINGLE CANONICAL API: /api/v1/reports/*)
 *   GET  /reports/:id                     – Chi tiết hồ sơ khảo sát (hỗ trợ ?rev=N)
 *   GET  /reports/:id/export/pdf[?rev=N]  – Xuất PDF FINAL (APPROVED) hoặc DRAFT
 *   GET  /reports/:id/preview/html        – Xem trước HTML báo cáo
 *   GET  /reports/:id/releases            – Danh sách các bản phát hành Rev
 *   POST /reports/:id/releases            – Phát hành Rev mới { reason }
 *   GET  /reports/minutes/zone/:zoneId    – Danh sách biên bản hiện trường theo Zone
 *   GET  /reports/:id/minutes/pdf         – PDF biên bản 1 căn
 *   POST /reports/minutes/zone/:zoneId/batch-zip – Tạo job xuất ZIP theo Zone
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '../../common/errors/problem-details';
import { ReportService } from './services/report.service';
import { ReportReleaseService } from './services/report-release.service';
import { MinutesExportService } from './services/minutes-export.service';
import { ZoneMinutesBatchService } from './services/zone-minutes-batch.service';
import { canAccessZone } from './utils/zone-access.utils';
import { sha256Hex } from './snapshot/report-snapshot.service';

function parseRevision(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new BadRequestError('Tham số rev phải là số nguyên không âm');
  }
  return n;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new BadRequestError('Mã job không hợp lệ');
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

  public static async getZoneMinutesSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { zoneId } = req.params;
      if (!canAccessZone(req.user, zoneId)) {
        throw new ForbiddenError('Bạn không có quyền xem biên bản của phân khu này');
      }
      const items = await MinutesExportService.listZoneMinutes(zoneId);
      const latestJob = await ZoneMinutesBatchService.getLatestJob(zoneId);
      res.status(200).json({ success: true, data: { items, latestJob } });
    } catch (err) {
      next(err);
    }
  }

  public static async exportSingleMinutePdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      const resolved = await ReportService.resolve(req.params.id);
      if (!canAccessZone(req.user, resolved.zoneId)) {
        throw new ForbiddenError('Bạn không có quyền xuất biên bản của phân khu này');
      }
      const { pdfBuffer, fileName } = await MinutesExportService.renderMinutesPdf(resolved);
      await ZoneMinutesBatchService.recordAudit(resolved.id, 'EXPORT_PDF', req.user.userId, req.ip ?? null, {
        zoneId: resolved.zoneId,
        fileName,
        sha256: sha256Hex(pdfBuffer),
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('X-Content-SHA256', sha256Hex(pdfBuffer));
      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  public static async exportZoneBatchMinutesZip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { zoneId } = req.params;
      if (!canAccessZone(req.user, zoneId)) {
        throw new ForbiddenError('Bạn không có quyền xuất biên bản của phân khu này');
      }
      const job = await ZoneMinutesBatchService.createJob(zoneId, req.user, req.ip ?? null);
      res.status(202).json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  }

  public static async getMinutesJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      assertUuid(req.params.jobId);
      const job = await ZoneMinutesBatchService.getJob(req.params.jobId, req.user);
      res.status(200).json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  }

  public static async issueMinutesDownloadTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      assertUuid(req.params.jobId);
      const ticket = await ZoneMinutesBatchService.issueDownloadTicket(req.params.jobId, req.user);
      res.status(200).json({ success: true, data: { ticket } });
    } catch (err) {
      next(err);
    }
  }

  /** Không dùng authenticateJwt: trình duyệt tải trực tiếp bằng vé ngắn hạn gắn với job. */
  public static async downloadMinutesZip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      assertUuid(req.params.jobId);
      const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : '';
      const download = await ZoneMinutesBatchService.resolveDownload(req.params.jobId, ticket);
      await ZoneMinutesBatchService.recordAudit(req.params.jobId, 'DOWNLOAD_ZIP', download.userId, req.ip ?? null, {
        zoneId: download.zoneId,
        sha256: download.sha256,
      });
      res.download(download.filePath, download.fileName, (err) => {
        if (err) console.error('[MinutesExport:Download] Lỗi truyền file ZIP:', err);
      });
    } catch (err) {
      next(err);
    }
  }
}
