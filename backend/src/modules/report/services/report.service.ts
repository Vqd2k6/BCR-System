/**
 * ============================================================================
 * REPORT SERVICE (SINGLE CANONICAL ORCHESTRATOR)
 * Điều phối nạp dữ liệu (Snapshot APPROVED_RELEASE hoặc bản nháp), dựng ViewModel
 * (Zero Calculate), biên dịch Handlebars và kết xuất PDF chuẩn A4 qua RenderQueue.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { Database } from '../../../database/db';
import { SurveyRepository } from '../../survey/survey.repository';
import { applyCondoReportContext } from '../snapshot/condo-absent-projection';
import { NotFoundError } from '../../../common/errors/problem-details';
import { maskReportPii } from '../../../common/utils/pii.utils';
import { ReportViewModel } from '../report.types';
import { ReportViewModelMapper } from '../mappers/report-viewmodel.mapper';
import { PdfRenderEngine } from '../engine/pdf-render.engine';
import { RenderQueue } from '../engine/render-queue';
import { applyOverridesToReport } from '../utils/report-override.utils';
import { preloadImageOrientations } from '../utils/image-sniff.utils';
import { extractParcelPolygonCoords, preloadSatelliteTiles } from '../utils/spatial-svg.utils';
import { extractAllImageUrls, buildPreloadRotationItems } from '../utils/report-preload.utils';
import { ReportWatermarkCanvasService } from './report-watermark-canvas.service';
import { ReportImageResolver } from './report-image-resolver.service';
import { ReportFontsService } from './report-fonts.service';
import { ReportSnapshotService } from '../snapshot/report-snapshot.service';
import type { ReportSnapshot } from '../schemas/report-snapshot.schema';
import { ReportConfigService } from '../../report_config/report-config.service';
import type { ReportContentConfig } from '../../report_config/report-config.types';

export const REPORT_PDF_HEADER_TITLE = 'LIÊN DANH CRLG–CRSRI–TT | DỰ ÁN METRO 2 BẾN THÀNH - THAM LƯƠNG';

export interface ResolvedReport {
  id: string;
  status: string;
  zoneId: string | null;
  exportRevision: number;
  approvedAt: string | null;
  raw: Record<string, unknown>;
}

export class ReportService {
  private static cachedTemplate: Handlebars.TemplateDelegate | null = null;
  private static cachedStyles: string | null = null;
  private static cachedTemplatesMtime = 0;

  private static getTemplatesDir(): string {
    return path.join(__dirname, '../templates/residential');
  }

  private static latestTemplateMtime(): number {
    const dir = this.getTemplatesDir();
    let latest = 0;
    for (const sub of ['', 'partials']) {
      const d = path.join(dir, sub);
      if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d)) {
        if (!/\.(hbs|css)$/.test(f)) continue;
        latest = Math.max(latest, fs.statSync(path.join(d, f)).mtimeMs);
      }
    }
    return latest;
  }

  public static registerHelpersAndPartials(baseDir?: string): void {
    Handlebars.registerHelper('eq', (a, b) => a === b);
    Handlebars.registerHelper('ne', (a, b) => a !== b);
    Handlebars.registerHelper('gt', (a, b) => Number(a) > Number(b));
    Handlebars.registerHelper('gte', (a, b) => Number(a) >= Number(b));
    Handlebars.registerHelper('lt', (a, b) => Number(a) < Number(b));
    Handlebars.registerHelper('lte', (a, b) => Number(a) <= Number(b));
    Handlebars.registerHelper('or', function (...args: any[]) {
      args.pop();
      return args.some(Boolean);
    });
    Handlebars.registerHelper('and', function (...args: any[]) {
      args.pop();
      return args.every(Boolean);
    });

    const partialsDir = baseDir || path.join(this.getTemplatesDir(), 'partials');
    if (fs.existsSync(partialsDir)) {
      const partialFiles = fs.readdirSync(partialsDir).filter((f) => f.endsWith('.hbs'));
      for (const file of partialFiles) {
        const partialName = file.replace(/\.hbs$/, '');
        const content = fs.readFileSync(path.join(partialsDir, file), 'utf8');
        Handlebars.registerPartial(partialName, content);
      }
    }
  }

  public static getCompiledTemplate(): {
    template: Handlebars.TemplateDelegate;
    styles: string;
  } {
    if (process.env.NODE_ENV !== 'production' && this.cachedTemplate) {
      const mtime = this.latestTemplateMtime();
      if (mtime > this.cachedTemplatesMtime) {
        this.cachedTemplate = null;
        this.cachedStyles = null;
      }
    }
    if (!this.cachedTemplate || !this.cachedStyles) {
      this.cachedTemplatesMtime = this.latestTemplateMtime();
      const templatesDir = this.getTemplatesDir();
      const templatePath = path.join(templatesDir, 'index.hbs');
      const stylesPath = path.join(templatesDir, 'styles.css');

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Không tìm thấy file template Handlebars tại: ${templatePath}`);
      }
      if (!fs.existsSync(stylesPath)) {
        throw new Error(`Không tìm thấy file CSS Paged Media tại: ${stylesPath}`);
      }

      this.registerHelpersAndPartials();

      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const baseStyles = fs.readFileSync(stylesPath, 'utf8');
      const fontStyles = ReportFontsService.getFontCss();
      this.cachedStyles = `${fontStyles}\n${baseStyles}`;

      this.cachedTemplate = Handlebars.compile(templateSource);
    }

    return {
      template: this.cachedTemplate,
      styles: this.cachedStyles,
    };
  }

  public static async resolveReport(identifier: string): Promise<any> {
    if (!identifier || typeof identifier !== 'string') {
      throw new NotFoundError('Mã định danh hồ sơ không hợp lệ');
    }
    let rawReport = await SurveyRepository.findReportById(identifier);
    if (!rawReport) {
      const p = await SurveyRepository.findLatestPhase1ReportByParcelId(identifier);
      rawReport = p?.report || null;
    }
    if (!rawReport || !rawReport.id) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID hoặc mã thửa: ${identifier}`);
    }
    return rawReport;
  }

  public static async resolve(identifier: string): Promise<ResolvedReport> {
    const raw = (await this.resolveReport(identifier)) as Record<string, unknown>;
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

  public static async getReportDetail(reportId: string, maskPii: boolean = false, revision?: number): Promise<any> {
    let rawReport = await this.resolveReport(reportId);
    if (String(rawReport.status || '').toUpperCase() === 'APPROVED' && rawReport.id) {
      try {
        const snap = await ReportSnapshotService.getSnapshotForRevision(String(rawReport.id), revision);
        if (snap?.snapshot) {
          rawReport = ReportSnapshotService.applySnapshotToReport(rawReport, snap.snapshot);
          rawReport.status = 'APPROVED';
        }
      } catch (err) {
        console.warn(`[ReportService.getReportDetail] Không thể nạp snapshot cho report ${rawReport.id}:`, err);
      }
    }
    if (maskPii) {
      return maskReportPii(rawReport);
    }
    return rawReport;
  }

  public static async generateHtmlFromReport(
    rawReport: any,
    overrides?: any,
    maskPii: boolean = false,
    enableWatermark: boolean = true
  ): Promise<{ html: string; viewModel: ReportViewModel }> {
    return this.generateResidentialHtmlFromReport(rawReport, overrides, maskPii, enableWatermark);
  }

  public static async generateResidentialHtmlFromReport(
    rawReport: any,
    overrides?: any,
    maskPii: boolean = false,
    enableWatermark: boolean = true
  ): Promise<{ html: string; viewModel: ReportViewModel }> {
    let activeReport = await applyCondoReportContext(applyOverridesToReport(rawReport, overrides));
    if (maskPii) {
      activeReport = maskReportPii(activeReport);
    }

    const allPhotoUrls = extractAllImageUrls(activeReport);
    const photoRotationsMap = activeReport.survey_data_json?.photoRotations || activeReport.photoRotations || {};
    await preloadImageOrientations(allPhotoUrls);
    const preloadItems = buildPreloadRotationItems(activeReport, allPhotoUrls, photoRotationsMap);
    await ReportImageResolver.preloadAndResolveAll(preloadItems, photoRotationsMap);

    try {
      const polygonCoords = extractParcelPolygonCoords(activeReport, activeReport.survey_data_json);
      if (polygonCoords) {
        await preloadSatelliteTiles(polygonCoords);
      }
    } catch {
      // Graceful fallback
    }

    const config: ReportContentConfig =
      activeReport.reportContentConfig || (await ReportConfigService.getActiveConfig());

    const viewModel = ReportViewModelMapper.buildViewModel(activeReport, overrides, config);
    if (maskPii) {
      (viewModel as any).isPiiMasked = true;
    }

    const effectiveWatermark = maskPii ? true : enableWatermark;
    if (effectiveWatermark) {
      await ReportWatermarkCanvasService.applyWatermarksToViewModel(viewModel);
    }

    const { template, styles } = this.getCompiledTemplate();
    const html = template({
      ...viewModel,
      styles,
      isPiiMasked: maskPii,
      isGuestWatermark: maskPii,
      enableWatermark: effectiveWatermark,
      isDraft: String(activeReport.status || '').toUpperCase() !== 'APPROVED',
    });

    return { html, viewModel };
  }

  public static buildFinalReport(
    resolved: ResolvedReport,
    snapshot: ReportSnapshot,
    revision: number
  ): Record<string, unknown> {
    const withScores = ReportSnapshotService.applySnapshotToReport(resolved.raw, snapshot);
    withScores.export_revision = revision;
    withScores.status = 'APPROVED';
    return withScores;
  }

  public static async renderFinalPdf(
    resolved: ResolvedReport,
    snapshot: ReportSnapshot,
    revision: number,
    pinnedConfig?: ReportContentConfig
  ): Promise<{ pdfBuffer: Buffer; reportNo: string; buildingId: string }> {
    const finalReport = this.buildFinalReport(resolved, snapshot, revision);
    if (pinnedConfig) {
      finalReport.reportContentConfig = pinnedConfig;
    }
    return RenderQueue.run(async () => {
      const { html, viewModel } = await this.generateResidentialHtmlFromReport(finalReport, undefined, false, true);
      const reportNo = viewModel.metadata.reportNo;
      const buildingId = viewModel.metadata.buildingId;
      const pdfBuffer = await PdfRenderEngine.renderHtmlToPdf(html, {
        buildingId,
        reportNo,
        headerTitle: REPORT_PDF_HEADER_TITLE,
      });
      return { pdfBuffer, reportNo, buildingId };
    });
  }

  public static async renderDraftHtml(
    resolved: ResolvedReport,
    overrides: unknown,
    maskPii: boolean,
    enableWatermark: boolean,
    revision?: number
  ): Promise<{ html: string; viewModel: ReportViewModel }> {
    const effectiveOverrides = resolved.status === 'APPROVED' ? undefined : overrides;
    let reportData = resolved.raw;
    if (resolved.status === 'APPROVED') {
      try {
        const approved = await ReportSnapshotService.getSnapshotForRevision(resolved.id, revision);
        if (approved?.snapshot) {
          reportData = ReportSnapshotService.applySnapshotToReport(resolved.raw, approved.snapshot);
          reportData.status = 'APPROVED';
        }
      } catch (err) {
        console.warn(`[ReportService] Không thể tải snapshot phê duyệt cho report ${resolved.id}:`, err);
      }
    }
    return this.generateResidentialHtmlFromReport(reportData, effectiveOverrides, maskPii, enableWatermark);
  }

  public static async renderDraftPdf(
    resolved: ResolvedReport,
    overrides: unknown,
    enableWatermark: boolean,
    revision?: number
  ): Promise<{ pdfBuffer: Buffer; reportNo: string; buildingId: string }> {
    return RenderQueue.run(async () => {
      const { html, viewModel } = await this.renderDraftHtml(resolved, overrides, false, enableWatermark, revision);
      const reportNo = viewModel.metadata.reportNo;
      const buildingId = viewModel.metadata.buildingId;
      const pdfBuffer = await PdfRenderEngine.renderHtmlToPdf(html, {
        buildingId,
        reportNo,
        headerTitle: REPORT_PDF_HEADER_TITLE,
      });
      return { pdfBuffer, reportNo, buildingId };
    });
  }
}

