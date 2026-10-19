/**
 * ============================================================================
 * REPORT V3 SERVICE (RENDER)
 * Strangler trên pipeline V2: dữ liệu điểm lấy từ snapshot APPROVED_RELEASE.
 *  - APPROVED  → bản FINAL (không watermark DRAFT), dùng snapshot đã chốt.
 *  - Khác      → bản DRAFT có watermark "DRAFT – KHÔNG CÓ GIÁ TRỊ PHÁP LÝ".
 * ============================================================================
 */

import { Database } from '../../database/db';
import { NotFoundError } from '../../common/errors/problem-details';
import { ReportV2Service } from '../report_v2/report-v2.service';
import { PdfRenderV2Engine } from '../report_v2/engine/pdf-render-v2.engine';
import { ReportSnapshotService } from './report-snapshot.service';
import type { ReportSnapshot } from './report-snapshot.schema';
import { RenderQueue } from './render-queue';
import type { ReportContentConfig } from '../report_config/report-config.types';

export const REPORT_PDF_HEADER_TITLE = 'LIÊN DANH CRLG–CRSRI–TT | DỰ ÁN METRO 2 BẾN THÀNH - THAM LƯƠNG';

export interface ResolvedReportV3 {
  id: string;
  status: string;
  zoneId: string | null;
  exportRevision: number;
  approvedAt: string | null;
  raw: Record<string, unknown>;
}

export class ReportV3Service {
  /** Resolve hồ sơ (id / mã / mã thửa), loại bỏ hồ sơ đã xóa mềm */
  public static async resolve(identifier: string): Promise<ResolvedReportV3> {
    const raw = (await ReportV2Service.resolveReport(identifier)) as Record<string, unknown>;
    const id = String(raw.id);
    const meta = await Database.query<{ deleted_at: Date | null; zone_id: string | null }>(
      `SELECT r.deleted_at, p.zone_id
       FROM base_survey_reports r JOIN parcels p ON p.id = r.parcel_id
       WHERE r.id = $1;`,
      [id]
    );
    if (!meta.rows[0] || meta.rows[0].deleted_at !== null) {
      throw new NotFoundError(`Hồ sơ khảo sát không tồn tại hoặc đã bị xóa: ${identifier}`);
    }
    const rev = Number(raw.export_revision);
    return {
      id,
      status: String(raw.status || '').toUpperCase(),
      zoneId: meta.rows[0].zone_id,
      exportRevision: Number.isFinite(rev) && rev >= 0 ? Math.floor(rev) : 0,
      approvedAt: raw.approved_at ? new Date(String(raw.approved_at)).toISOString() : null,
      raw,
    };
  }

  /** Bản ghi đã gắn snapshot + số Rev để render FINAL */
  public static buildFinalReport(
    resolved: ResolvedReportV3,
    snapshot: ReportSnapshot,
    revision: number
  ): Record<string, unknown> {
    const withScores = ReportSnapshotService.applySnapshotToReport(resolved.raw, snapshot);
    withScores.export_revision = revision;
    withScores.status = 'APPROVED';
    return withScores;
  }

  /** Render PDF FINAL cho Rev chỉ định (đi qua render queue) */
  public static async renderFinalPdf(
    resolved: ResolvedReportV3,
    snapshot: ReportSnapshot,
    revision: number,
    pinnedConfig?: ReportContentConfig
  ): Promise<{ pdfBuffer: Buffer; reportNo: string; buildingId: string }> {
    const finalReport = this.buildFinalReport(resolved, snapshot, revision);
    if (pinnedConfig) {
      finalReport.reportContentConfig = pinnedConfig;
    }
    return RenderQueue.run(async () => {
      const { html, viewModel } = await ReportV2Service.generateResidentialHtmlFromReport(finalReport, undefined, false, true);
      const reportNo = viewModel.metadata.reportNo;
      const buildingId = viewModel.metadata.buildingId;
      const pdfBuffer = await PdfRenderV2Engine.renderHtmlToPdf(html, {
        buildingId,
        reportNo,
        headerTitle: REPORT_PDF_HEADER_TITLE,
      });
      return { pdfBuffer, reportNo, buildingId };
    });
  }

  /** Render DRAFT (HTML) – overrides chỉ được áp dụng cho hồ sơ chưa APPROVED */
  public static async renderDraftHtml(
    resolved: ResolvedReportV3,
    overrides: unknown,
    maskPii: boolean,
    enableWatermark: boolean
  ) {
    const effectiveOverrides = resolved.status === 'APPROVED' ? undefined : overrides;
    return ReportV2Service.generateResidentialHtmlFromReport(resolved.raw, effectiveOverrides, maskPii, enableWatermark);
  }

  public static async renderDraftPdf(
    resolved: ResolvedReportV3,
    overrides: unknown,
    enableWatermark: boolean
  ): Promise<{ pdfBuffer: Buffer; reportNo: string; buildingId: string }> {
    return RenderQueue.run(async () => {
      const { html, viewModel } = await this.renderDraftHtml(resolved, overrides, false, enableWatermark);
      const reportNo = viewModel.metadata.reportNo;
      const buildingId = viewModel.metadata.buildingId;
      const pdfBuffer = await PdfRenderV2Engine.renderHtmlToPdf(html, {
        buildingId,
        reportNo,
        headerTitle: REPORT_PDF_HEADER_TITLE,
      });
      return { pdfBuffer, reportNo, buildingId };
    });
  }
}
