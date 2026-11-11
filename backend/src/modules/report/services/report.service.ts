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
import { ConflictError, NotFoundError } from '../../../common/errors/problem-details';
import { maskReportPii } from '../../../common/utils/pii.utils';
import { ReportViewModel } from '../report.types';
import { ReportViewModelMapper } from '../mappers/report-viewmodel.mapper';
import { PdfRenderEngine } from '../engine/pdf-render.engine';
import { RenderQueue } from '../engine/render-queue';
import { applyOverridesToReport } from '../utils/report-override.utils';
import { preloadImageOrientations } from '../utils/image-sniff.utils';
import { extractParcelPolygonCoords } from '../utils/spatial-svg.utils';
import { loadNeighbourParcelRings } from '../utils/neighbour-parcels.utils';
import { extractAllImageUrls, buildPreloadRotationItems } from '../utils/report-preload.utils';
import { ReportWatermarkCanvasService, type WatermarkVerifyReport } from './report-watermark-canvas.service';
import { ReportImageResolver } from './report-image-resolver.service';
import { LegacyWatermarkIndex } from './legacy-watermark-index.service';
import { ReportFontsService } from './report-fonts.service';
import { ReportSnapshotService } from '../snapshot/report-snapshot.service';
import type { ReportSnapshot } from '../schemas/report-snapshot.schema';
import { ReportConfigService } from '../../report_config/report-config.service';
import type { ReportContentConfig } from '../../report_config/report-config.types';
import { applyPhotoQcToViewModel, resolvePhotoQcStateForRender } from '../../photo-qc/photo-qc.render';
import { applyResurveyToViewModel, resolveResurveyStateForRender } from '../../photo-resurvey/photo-resurvey.render';

export const REPORT_PDF_HEADER_TITLE = 'LIÊN DANH CRLG – CRSRI – TT | TUYẾN METRO 2 BẾN THÀNH - THAM LƯƠNG';

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
  ): Promise<{ html: string; viewModel: ReportViewModel; watermark?: WatermarkVerifyReport }> {
    return this.generateResidentialHtmlFromReport(rawReport, overrides, maskPii, enableWatermark);
  }

  /** Mã căn hộ con / khu vực chung như trên Hub chung cư (U-060, M-005) để ghép vào mã ảnh. */
  private static async fetchUnitCode(unitId: string): Promise<string | null> {
    try {
      const res = await Database.query<{ unit_code: string | null }>(
        `SELECT unit_code FROM building_units WHERE id = $1;`,
        [unitId]
      );
      const unitCode = res.rows[0]?.unit_code?.trim() || null;
      if (!unitCode) {
        console.error(`[ReportService:fetchUnitCode] Căn hộ ${unitId} không có unit_code, mã ảnh sẽ thiếu mã căn`);
      }
      return unitCode;
    } catch (err) {
      console.error(`[ReportService:fetchUnitCode] Không đọc được unit_code của căn hộ ${unitId}`, err);
      return null;
    }
  }

  public static async generateResidentialHtmlFromReport(
    rawReport: any,
    overrides?: any,
    maskPii: boolean = false,
    enableWatermark: boolean = true
  ): Promise<{ html: string; viewModel: ReportViewModel; watermark?: WatermarkVerifyReport }> {
    let activeReport = await applyCondoReportContext(applyOverridesToReport(rawReport, overrides));
    if (maskPii) {
      activeReport = maskReportPii(activeReport);
    }

    if (activeReport.unit_id && !activeReport.unit_code) {
      activeReport = { ...activeReport, unit_code: await this.fetchUnitCode(String(activeReport.unit_id)) };
    }

    const allPhotoUrls = extractAllImageUrls(activeReport);
    const photoRotationsMap = activeReport.survey_data_json?.photoRotations || activeReport.photoRotations || {};
    await preloadImageOrientations(allPhotoUrls);
    const preloadItems = buildPreloadRotationItems(activeReport, allPhotoUrls, photoRotationsMap);
    await ReportImageResolver.preloadAndResolveAll(preloadItems, photoRotationsMap);
    // Dò logo watermark FE cũ trên pixel (ảnh đã nạp sẵn ở bước trên), kết quả lưu vĩnh viễn theo URL.
    await LegacyWatermarkIndex.load(allPhotoUrls, { detect: true });

    // Sơ đồ Mục II vẽ kiểu Bình đồ (nền trắng, không ảnh vệ tinh): nạp ranh thửa lân cận để vẽ ngữ cảnh.
    if (extractParcelPolygonCoords(activeReport, activeReport.survey_data_json)) {
      activeReport.spatialNeighbourRings = await loadNeighbourParcelRings(
        typeof activeReport.parcel_id === 'string' ? activeReport.parcel_id : null
      );
    }

    const config: ReportContentConfig =
      activeReport.reportContentConfig || (await ReportConfigService.getActiveConfig());

    const viewModel = ReportViewModelMapper.buildViewModel(activeReport, overrides, config);
    if (maskPii) {
      viewModel.isPiiMasked = true;
    }

    const effectiveWatermark = maskPii ? true : enableWatermark;
    // Khảo sát bổ sung (ảnh ngoài nhà chụp lại đã duyệt): chạy TRƯỚC Photo QC để bìa P04 / crop thấy ảnh mới.
    // Không có phiên đã duyệt thì bỏ qua hoàn toàn (report giữ nguyên từng byte).
    const resurveyState = await resolveResurveyStateForRender(activeReport);
    if (resurveyState) {
      await applyResurveyToViewModel(viewModel, resurveyState, { loadImages: true });
    }
    // Photo QC (bìa P04, crop 4:3/3:4, dập bù): không có thao tác QC thì bỏ qua hoàn toàn.
    const photoQcState = await resolvePhotoQcStateForRender(activeReport);
    if (photoQcState) {
      await applyPhotoQcToViewModel(viewModel, photoQcState, {
        watermark: effectiveWatermark,
        studioEnhanced: activeReport.survey_data_json?.studioEnhancedPhotos ?? null,
      });
    }
    let watermark: WatermarkVerifyReport | undefined;
    if (effectiveWatermark) {
      watermark = await ReportWatermarkCanvasService.applyWatermarksToViewModel(viewModel);
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

    return { html, viewModel, watermark };
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

  /** Import động: photo-qc.service phụ thuộc ngược vào ReportService nên không import tĩnh được. */
  private static async assertPhotoQcCropsReviewed(reportId: string): Promise<void> {
    const { PhotoQcService } = await import('../../photo-qc/photo-qc.service');
    await PhotoQcService.assertCropsReviewed(reportId);
  }

  public static async renderFinalPdf(
    resolved: ResolvedReport,
    snapshot: ReportSnapshot,
    revision: number,
    pinnedConfig?: ReportContentConfig
  ): Promise<{ pdfBuffer: Buffer; reportNo: string; buildingId: string; watermark?: WatermarkVerifyReport }> {
    // Phát hành Rev: crop chưa duyệt sẽ không in, nên bắt buộc Thẩm định duyệt/từ chối hết trước khi phát hành.
    await this.assertPhotoQcCropsReviewed(resolved.id);
    const finalReport = this.buildFinalReport(resolved, snapshot, revision);
    if (pinnedConfig) {
      finalReport.reportContentConfig = pinnedConfig;
    }
    return RenderQueue.run(async () => {
      const { html, viewModel, watermark } = await this.generateResidentialHtmlFromReport(finalReport, undefined, false, true);
      // Bản Rev pháp lý: không phát hành khi có ảnh dập watermark lỗi ở máy chủ (chỉ còn lớp CSS dự phòng).
      if (watermark && watermark.errors > 0 && process.env.REPORT_RELEASE_REQUIRE_FULL_WATERMARK !== 'false') {
        throw new ConflictError(
          `Không phát hành Rev: ${watermark.errors}/${watermark.total} ảnh không dập được watermark. Kiểm tra log [ReportWatermark:verify] rồi thử lại.`
        );
      }
      const reportNo = viewModel.metadata.reportNo;
      const buildingId = viewModel.metadata.buildingId;
      const pdfBuffer = await PdfRenderEngine.renderHtmlToPdf(html, {
        buildingId,
        reportNo,
        headerTitle: REPORT_PDF_HEADER_TITLE,
        // Ảnh, font, bản đồ đã nhúng data URI: networkidle2 không ổn định với HTML lớn, chỉ chờ sự kiện load.
        selfContainedHtml: true,
        waitForReportReady: true,
        headerFooter: true,
        tocTwoPass: true,
      });
      return { pdfBuffer, reportNo, buildingId, watermark };
    });
  }

  public static async renderDraftHtml(
    resolved: ResolvedReport,
    overrides: unknown,
    maskPii: boolean,
    enableWatermark: boolean,
    revision?: number
  ): Promise<{ html: string; viewModel: ReportViewModel; watermark?: WatermarkVerifyReport }> {
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
    // Hồ sơ APPROVED render theo snapshot đã đóng băng nên không cần gate; bản nháp phải duyệt xong crop.
    if (resolved.status !== 'APPROVED') await this.assertPhotoQcCropsReviewed(resolved.id);
    return RenderQueue.run(async () => {
      const { html, viewModel } = await this.renderDraftHtml(resolved, overrides, false, enableWatermark, revision);
      const reportNo = viewModel.metadata.reportNo;
      const buildingId = viewModel.metadata.buildingId;
      const pdfBuffer = await PdfRenderEngine.renderHtmlToPdf(html, {
        buildingId,
        reportNo,
        headerTitle: REPORT_PDF_HEADER_TITLE,
        // Ảnh, font, bản đồ đã nhúng data URI: networkidle2 không ổn định với HTML lớn, chỉ chờ sự kiện load.
        selfContainedHtml: true,
        waitForReportReady: true,
        headerFooter: true,
        tocTwoPass: true,
      });
      return { pdfBuffer, reportNo, buildingId };
    });
  }
}

