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
import { ConflictError, NotFoundError, WatermarkIncompleteError } from '../../../common/errors/problem-details';
import { maskReportPii } from '../../../common/utils/pii.utils';
import { ReportViewModel } from '../report.types';
import { ReportViewModelMapper } from '../mappers/report-viewmodel.mapper';
import { PdfRenderEngine } from '../engine/pdf-render.engine';
import { RenderQueue } from '../engine/render-queue';
import { applyOverridesToReport } from '../utils/report-override.utils';
import { preloadImageOrientations } from '../utils/image-sniff.utils';
import { extractParcelPolygonCoords } from '../utils/spatial-svg.utils';
import { loadNeighbourParcelRings } from '../utils/neighbour-parcels.utils';
import { extractAllImageUrls } from '../utils/report-preload.utils';
import { ReportWatermarkCanvasService, type WatermarkIssue, type WatermarkVerifyReport } from './report-watermark-canvas.service';
import { runWithRenderImageScope } from './report-image-scope';
import { walkViewModelPhotos } from '../../photo-qc/photo-qc.vm-walker';
import { ReportImageResolver } from './report-image-resolver.service';
import { LegacyWatermarkIndex } from './legacy-watermark-index.service';
import { ReportFontsService } from './report-fonts.service';
import { ReportSnapshotService } from '../snapshot/report-snapshot.service';
import type { ReportSnapshot } from '../schemas/report-snapshot.schema';
import { ReportConfigService } from '../../report_config/report-config.service';
import type { ReportContentConfig } from '../../report_config/report-config.types';
import { applyPhotoQcToViewModel, resolvePhotoQcStateForRender } from '../../photo-qc/photo-qc.render';
import { applyResurveyToViewModel, resolveResurveyStateForRender } from '../../photo-resurvey/photo-resurvey.render';
import { resolveReportTemplateKind, type ReportTemplateKind } from './report-template-kind';

export const REPORT_PDF_HEADER_TITLE = 'LIÊN DANH CRLG – CRSRI – TT | TUYẾN METRO 2 BẾN THÀNH - THAM LƯƠNG';

/** Cách khắc phục cho từng loại ảnh chưa dập được (hiện ở bản xem trước và trong lỗi chặn xuất). */
export function watermarkIssueHint(issue: WatermarkIssue): string {
  switch (issue.reason) {
    case 'LOAD_FAILED':
      return issue.fileMissing
        ? 'File ảnh không còn trên R2. Mở ô ảnh trong Studio để thay ảnh (xem gợi ý bản trùng SHA / ảnh trước trong lịch sử).'
        : `Không tải được ảnh (${issue.httpStatus ? `HTTP ${issue.httpStatus}` : issue.detail}). Đã thử lại và đọc thẳng R2; bấm Thử lại sau ít phút.`;
    case 'TOO_SMALL':
      return 'Ảnh nhỏ hơn 80px (thường là ảnh thu nhỏ lưu nhầm). Mở ô ảnh trong Studio để thay bằng ảnh đầy đủ trong lịch sử.';
    case 'STAMP_ERROR':
      return 'Dập dấu lỗi 2 lần, file ảnh có thể hỏng. Mở ô ảnh trong Studio để thay ảnh.';
    case 'SUSPECT_LEGACY':
      return `${issue.detail}. Zone Admin / Super Admin xác nhận ảnh này "Có dấu cũ" hoặc "Chưa có dấu".`;
  }
}

interface CompiledReportTemplate {
  template: Handlebars.TemplateDelegate;
  styles: string;
  mtime: number;
}

const TEMPLATE_DIR_BY_KIND: Record<ReportTemplateKind, string> = {
  STANDALONE: 'residential',
  BUILDING_MASTER: 'condo-master',
  MASTER_AREA: 'condo-area',
  CONDO_UNIT: 'condo-unit',
};

export interface ResolvedReport {
  id: string;
  status: string;
  zoneId: string | null;
  exportRevision: number;
  approvedAt: string | null;
  raw: Record<string, unknown>;
}

export class ReportService {
  /** Bộ template đã biên dịch theo loại hồ sơ (nhà dân / Tòa mẹ / khu vực chung / căn hộ). */
  private static templateCache = new Map<ReportTemplateKind, CompiledReportTemplate>();

  private static getTemplatesDir(kind: ReportTemplateKind = 'STANDALONE'): string {
    return path.join(__dirname, '../templates', TEMPLATE_DIR_BY_KIND[kind]);
  }

  /**
   * Thư mục template thật sự dùng cho loại hồ sơ. Template chung cư được triển khai theo giai đoạn (GĐ1 căn U,
   * GĐ2 khu vực M, GĐ3 Tòa mẹ): loại nào chưa có thư mục thì vẫn in bằng template nhà dân như trước.
   */
  private static resolveTemplateKind(kind: ReportTemplateKind): ReportTemplateKind {
    if (kind === 'STANDALONE') return kind;
    return fs.existsSync(path.join(this.getTemplatesDir(kind), 'index.hbs')) ? kind : 'STANDALONE';
  }

  private static latestTemplateMtime(kind: ReportTemplateKind): number {
    const dirs = kind === 'STANDALONE' ? [this.getTemplatesDir()] : [this.getTemplatesDir(), this.getTemplatesDir(kind)];
    let latest = 0;
    for (const dir of dirs) {
      for (const sub of ['', 'partials']) {
        const d = path.join(dir, sub);
        if (!fs.existsSync(d)) continue;
        for (const f of fs.readdirSync(d)) {
          if (!/\.(hbs|css)$/.test(f)) continue;
          latest = Math.max(latest, fs.statSync(path.join(d, f)).mtimeMs);
        }
      }
    }
    return latest;
  }

  private static registerHelpers(hbs: typeof Handlebars): void {
    hbs.registerHelper('eq', (a, b) => a === b);
    hbs.registerHelper('ne', (a, b) => a !== b);
    hbs.registerHelper('gt', (a, b) => Number(a) > Number(b));
    hbs.registerHelper('gte', (a, b) => Number(a) >= Number(b));
    hbs.registerHelper('lt', (a, b) => Number(a) < Number(b));
    hbs.registerHelper('lte', (a, b) => Number(a) <= Number(b));
    hbs.registerHelper('or', function (...args: unknown[]) {
      args.pop();
      return args.some(Boolean);
    });
    hbs.registerHelper('and', function (...args: unknown[]) {
      args.pop();
      return args.every(Boolean);
    });
  }

  private static registerPartialsFrom(hbs: typeof Handlebars, partialsDir: string): void {
    if (!fs.existsSync(partialsDir)) return;
    for (const file of fs.readdirSync(partialsDir).filter((f) => f.endsWith('.hbs'))) {
      hbs.registerPartial(file.replace(/\.hbs$/, ''), fs.readFileSync(path.join(partialsDir, file), 'utf8'));
    }
  }

  /** Đăng ký helper + partial nhà dân vào môi trường Handlebars toàn cục (các script kiểm thử dùng). */
  public static registerHelpersAndPartials(baseDir?: string): void {
    this.registerHelpers(Handlebars);
    this.registerPartialsFrom(Handlebars, baseDir || path.join(this.getTemplatesDir(), 'partials'));
  }

  /**
   * Biên dịch template theo loại hồ sơ. Nhà dân dùng môi trường Handlebars toàn cục như trước.
   * Loại chung cư có môi trường riêng: nạp partial nhà dân trước rồi partial của loại đó (cùng tên thì ghi đè),
   * để partial chung cư không bao giờ đè lên report nhà dân. CSS dùng chung `residential/styles.css`.
   */
  public static getCompiledTemplate(requestedKind: ReportTemplateKind = 'STANDALONE'): {
    template: Handlebars.TemplateDelegate;
    styles: string;
  } {
    const kind = this.resolveTemplateKind(requestedKind);
    const cached = this.templateCache.get(kind);
    if (cached && (process.env.NODE_ENV === 'production' || this.latestTemplateMtime(kind) <= cached.mtime)) {
      return { template: cached.template, styles: cached.styles };
    }

    const mtime = this.latestTemplateMtime(kind);
    const baseDir = this.getTemplatesDir();
    const kindDir = this.getTemplatesDir(kind);
    const templatePath = path.join(kindDir, 'index.hbs');
    const stylesPath = path.join(baseDir, 'styles.css');

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Không tìm thấy file template Handlebars tại: ${templatePath}`);
    }
    if (!fs.existsSync(stylesPath)) {
      throw new Error(`Không tìm thấy file CSS Paged Media tại: ${stylesPath}`);
    }

    let hbs: typeof Handlebars;
    if (kind === 'STANDALONE') {
      this.registerHelpersAndPartials();
      hbs = Handlebars;
    } else {
      hbs = Handlebars.create();
      this.registerHelpers(hbs);
      this.registerPartialsFrom(hbs, path.join(baseDir, 'partials'));
      this.registerPartialsFrom(hbs, path.join(kindDir, 'partials'));
    }

    const kindStylesPath = path.join(kindDir, 'styles.css');
    const kindStyles = kind !== 'STANDALONE' && fs.existsSync(kindStylesPath) ? `\n${fs.readFileSync(kindStylesPath, 'utf8')}` : '';
    const styles = `${ReportFontsService.getFontCss()}\n${fs.readFileSync(stylesPath, 'utf8')}${kindStyles}`;
    const template = hbs.compile(fs.readFileSync(templatePath, 'utf8'));
    this.templateCache.set(kind, { template, styles, mtime });
    return { template, styles };
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
  ): Promise<{ html: string; viewModel: ReportViewModel; watermark: WatermarkVerifyReport }> {
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
  ): Promise<{ html: string; viewModel: ReportViewModel; watermark: WatermarkVerifyReport }> {
    // Mỗi lượt render một kho ảnh riêng: hồ sơ nhiều ảnh hoặc nhiều lượt chạy song song không đẩy ảnh của nhau ra.
    return runWithRenderImageScope(async (scope) => {
      let activeReport = await applyCondoReportContext(applyOverridesToReport(rawReport, overrides));
      if (maskPii) {
        activeReport = maskReportPii(activeReport);
      }

      if (activeReport.unit_id && !activeReport.unit_code) {
        activeReport = { ...activeReport, unit_code: await this.fetchUnitCode(String(activeReport.unit_id)) };
      }

      // Bản Rev đã phát hành: trạng thái dấu cũ đọc từ snapshot, không đọc bảng sống.
      if (activeReport.photo_watermark_frozen === true && activeReport.photo_watermark && typeof activeReport.photo_watermark === 'object') {
        scope.frozenLegacy = new Map(
          Object.entries(activeReport.photo_watermark as Record<string, unknown>)
            .filter((e): e is [string, boolean] => typeof e[1] === 'boolean')
        );
      }

      // Hướng ảnh (dọc/ngang) chỉ đọc vài KB đầu file, mapper cần để chọn góc xoay trước lượt dò.
      await preloadImageOrientations(extractAllImageUrls(activeReport));

      // Sơ đồ Mục II vẽ kiểu Bình đồ (nền trắng, không ảnh vệ tinh): nạp ranh thửa lân cận để vẽ ngữ cảnh.
      if (extractParcelPolygonCoords(activeReport, activeReport.survey_data_json)) {
        activeReport.spatialNeighbourRings = await loadNeighbourParcelRings(
          typeof activeReport.parcel_id === 'string' ? activeReport.parcel_id : null
        );
      }

      const config: ReportContentConfig =
        activeReport.reportContentConfig || (await ReportConfigService.getActiveConfig());

      // Lượt dò: dựng ViewModel trên bản sao để biết đúng ảnh (URL + góc xoay) report sẽ in, chỉ nạp các ảnh đó.
      // Mapper gặp ảnh chưa nạp sẽ ghi vào scope.requested (xem ReportImageResolver.resolveToBase64).
      // Lặp tối đa 3 lượt vì có mapper chỉ yêu cầu ảnh phụ sau khi ảnh chính đã nạp. Ảnh tải lỗi không thử lại
      // trong cùng lượt render (lỗi đã ghi vào scope.failures để báo và chặn xuất).
      for (let pass = 0; pass < 3; pass++) {
        scope.requested.clear();
        ReportViewModelMapper.buildViewModel(structuredClone(activeReport), overrides, config);
        const items = [...scope.requested]
          .filter(([url]) => !scope.failures.has(url))
          .flatMap(([url, degs]) => [...degs].map((rotation) => ({ url, rotation })));
        if (items.length === 0) break;
        await ReportImageResolver.preloadAndResolveAll(items);
      }
      // Dò logo dấu cũ trên pixel cho đúng các ảnh được in (kể cả sơ đồ CAD), kết quả lưu vĩnh viễn theo URL.
      // Bản Rev: ảnh đã có trong snapshot dùng kết quả đóng băng; ảnh snapshot chưa có (chưa từng được dò lúc chốt)
      // vẫn được dò ở đây, để không bắt người xác nhận tay hàng loạt ảnh chỉ vì chưa dò.
      const notFrozen = (u: string) => !scope.frozenLegacy?.has(u);
      const printedUrls = [...scope.native.keys(), ...scope.failures.keys()].filter(notFrozen);
      await LegacyWatermarkIndex.load(printedUrls, { detect: true });

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
        // Ảnh mới chụp lại cũng phải có kết quả dò trước khi dập.
        await LegacyWatermarkIndex.load(walkViewModelPhotos(viewModel).map((r) => r.url).filter(notFrozen), { detect: true });
      }
      // Photo QC (bìa P04, crop 4:3/3:4, dập bù): không có thao tác QC thì bỏ qua hoàn toàn.
      const photoQcState = await resolvePhotoQcStateForRender(activeReport);
      if (photoQcState) {
        await applyPhotoQcToViewModel(viewModel, photoQcState, {
          watermark: effectiveWatermark,
          studioEnhanced: activeReport.survey_data_json?.studioEnhancedPhotos ?? null,
        });
      }
      // Luôn kiểm 100% ảnh: bật watermark thì dập + xét dấu cũ, tắt thì chỉ kiểm ảnh có nạp được không.
      const watermark = await ReportWatermarkCanvasService.applyWatermarksToViewModel(viewModel, { stamp: effectiveWatermark });

      const { template, styles } = this.getCompiledTemplate(resolveReportTemplateKind(activeReport));
      const html = template({
        ...viewModel,
        styles,
        isPiiMasked: maskPii,
        isGuestWatermark: maskPii,
        enableWatermark: effectiveWatermark,
        isDraft: String(activeReport.status || '').toUpperCase() !== 'APPROVED',
        watermarkIssues: watermark.issues.map((i) => ({ ...i, hint: watermarkIssueHint(i) })),
        watermarkIssueCount: watermark.issues.length,
        // Script bản xem trước tra theo số thứ tự lỗi trong data URI khung đỏ (WM_ISSUE_URI_PREFIX<n>).
        // Thoát "<" để chuỗi JSON không đóng được thẻ <script>.
        watermarkIssuesJson: JSON.stringify(
          watermark.issues.map((i) => ({ url: i.url, photoCode: i.photoCode, reason: i.reason, needsLegacyConfirmation: i.needsLegacyConfirmation, fileMissing: i.fileMissing }))
        ).replace(/</g, '\\u003c'),
      });

      return { html, viewModel, watermark };
    });
  }

  /**
   * Chốt chặn cứng (chốt 13/11/2026): còn bất kỳ ảnh nào chưa dập được watermark thật thì không xuất
   * PDF nào (nháp lẫn Rev). Xem trước HTML vẫn mở được để chẩn đoán, ảnh lỗi có khung đỏ và cách khắc phục.
   */
  public static assertWatermarkComplete(watermark: WatermarkVerifyReport, kind: 'nháp' | 'Rev'): void {
    if (watermark.failed === 0) return;
    const list = watermark.issues.slice(0, 5).map((i) => `${i.photoCode} (${i.label}): ${watermarkIssueHint(i)}`).join('; ');
    throw new WatermarkIncompleteError(
      `Không xuất PDF ${kind}: ${watermark.issues.length} ảnh chưa dập được watermark. ${list}${watermark.issues.length > 5 ? '; …' : ''} Mở tab xem trước HTML để xem từng ảnh và cách khắc phục.`,
      watermark.issues.map((i) => ({ field: i.url, message: `${i.photoCode}: ${watermarkIssueHint(i)}` }))
    );
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
  public static async assertPhotoQcCropsReviewed(reportId: string): Promise<void> {
    const { PhotoQcService } = await import('../../photo-qc/photo-qc.service');
    await PhotoQcService.assertCropsReviewed(reportId);
  }

  public static async renderFinalPdf(
    resolved: ResolvedReport,
    snapshot: ReportSnapshot,
    revision: number,
    pinnedConfig?: ReportContentConfig
  ): Promise<{ pdfBuffer: Buffer; reportNo: string; buildingId: string; watermark?: WatermarkVerifyReport }> {
    // Chốt chặn crop chưa duyệt chạy ở ReportReleaseService.issue (trước transaction khoá hàng).
    const finalReport = this.buildFinalReport(resolved, snapshot, revision);
    if (pinnedConfig) {
      finalReport.reportContentConfig = pinnedConfig;
    }
    return RenderQueue.run(async () => {
      const { html, viewModel, watermark } = await this.generateResidentialHtmlFromReport(finalReport, undefined, false, true);
      // Bản Rev pháp lý: 100% ảnh phải được dập thật (không còn cờ môi trường nào cho lách).
      this.assertWatermarkComplete(watermark, 'Rev');
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
  ): Promise<{ html: string; viewModel: ReportViewModel; watermark: WatermarkVerifyReport }> {
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
      const { html, viewModel, watermark } = await this.renderDraftHtml(resolved, overrides, false, enableWatermark, revision);
      // PDF nháp cũng chặn cứng như Rev (chốt 13/11/2026): bản nháp hay được gửi đi, không để ảnh lỗi lọt ra file.
      this.assertWatermarkComplete(watermark, 'nháp');
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

