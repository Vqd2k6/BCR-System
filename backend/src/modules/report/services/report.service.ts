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
import { BadRequestError, ConflictError, NotFoundError, WatermarkIncompleteError } from '../../../common/errors/problem-details';
import { maskReportPii } from '../../../common/utils/pii.utils';
import { ReportViewModel } from '../report.types';
import { ReportViewModelMapper } from '../mappers/report-viewmodel.mapper';
import { presentResidentialV2 } from '../mappers/v2/residential-v2.presenter';
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
import {
  resolveReportTemplateKind,
  isReportTemplateKey,
  defaultResidentialTemplateKey,
  LEGACY_TEMPLATE_KEY,
  type ReportTemplateKind,
  type ReportTemplateKey,
} from './report-template-kind';

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

/** Cách PdfRenderEngine in một bộ template (mặc định như report Phase 1 hiện hành). */
export interface TemplateRenderOptions {
  /** Đầu/chân trang "Trang i / N" do engine chèn bằng hộp lề `@page`, ẩn ở trang đầu (bìa). */
  headerFooter: boolean;
  /** Đối chiếu Mục lục với trang thật bằng pdfjs (cần `window.__sectionHeadings` + `[data-toc-target]`). */
  tocTwoPass: boolean;
  /** Chờ `window.__reportReady === true` trước khi in. */
  waitForReportReady: boolean;
  /**
   * Đầu/chân trang HTML gốc của Chrome trên mọi trang kể cả bìa, dựng từ `chrome-header.hbs` / `chrome-footer.hbs`
   * của template (v2). Không dùng chung với `headerFooter`.
   */
  chromeHeaderFooter: boolean;
}

const DEFAULT_RENDER_OPTIONS: TemplateRenderOptions = {
  headerFooter: true,
  tocTwoPass: true,
  waitForReportReady: true,
  chromeHeaderFooter: false,
};
/** Tệp tùy chọn trong thư mục template để ghi đè `TemplateRenderOptions` (VD v2 tự vẽ đầu/chân trang). */
const RENDER_OPTIONS_FILE = 'render-options.json';

interface CompiledReportTemplate extends CompiledTemplateResult {
  mtime: number;
}

export interface CompiledTemplateResult {
  template: Handlebars.TemplateDelegate;
  styles: string;
  render: TemplateRenderOptions;
  /** Có khi `render.chromeHeaderFooter`: dựng chuỗi HTML đầu/chân trang cho Chrome. */
  chromeHeader?: Handlebars.TemplateDelegate;
  chromeFooter?: Handlebars.TemplateDelegate;
}

/**
 * Lớp trình bày riêng của template: nhận ViewModel chuẩn (dùng chung mọi template) + hồ sơ gốc, trả thêm dữ liệu
 * mà template đó cần (VD Mục VIII theo phương pháp v2). Không sửa ViewModel gốc.
 */
type TemplatePresenter = (viewModel: ReportViewModel, rawReport: Record<string, unknown>) => Record<string, unknown>;

const TEMPLATE_PRESENTERS: Partial<Record<string, TemplatePresenter>> = {
  'residential-v2': (vm, raw) => ({ v2: presentResidentialV2(vm, raw) }),
};

/** Nền kế thừa của mọi template chung cư luôn là thư mục v1, không theo template nhà dân mặc định. */
const RESIDENTIAL_V1_DIR = 'residential';

const TEMPLATE_DIR_BY_KIND: Record<ReportTemplateKind, string> = {
  STANDALONE: RESIDENTIAL_V1_DIR,
  BUILDING_MASTER: 'condo-master',
  MASTER_AREA: 'condo-area',
  CONDO_UNIT: 'condo-unit',
};

const TEMPLATE_DIR_BY_KEY: Record<ReportTemplateKey, string> = {
  residential_v1: RESIDENTIAL_V1_DIR,
  residential_v2: 'residential-v2',
};

/**
 * Partial của v1 mà v2 nạp lại (v2 có partial cùng tên thì bản của v2 thắng): khối báo ảnh chưa dập watermark +
 * script xác nhận dấu cũ trong preview, và script dựng Mục lục / `__sectionHeadings` / `__reportReady` cho engine.
 */
const V1_PARTIALS_SHARED_WITH_V2 = ['watermark-issues', 'report-scripts'];

/**
 * Cách dựng môi trường Handlebars:
 * - `global`: v1 nhà dân, dùng Handlebars toàn cục như trước (các script kiểm thử phụ thuộc).
 * - `condo`: môi trường riêng, nạp toàn bộ partial v1 rồi partial của loại chung cư, CSS v1 + CSS riêng.
 * - `isolated`: v2 nhà dân, môi trường riêng, chỉ nạp `V1_PARTIALS_SHARED_WITH_V2` + partial/CSS của chính nó.
 */
type TemplateBuildMode = 'global' | 'condo' | 'isolated';

interface TemplateSelection {
  dir: string;
  mode: TemplateBuildMode;
}

function readRenderOptions(dir: string): TemplateRenderOptions {
  const file = path.join(dir, RENDER_OPTIONS_FILE);
  if (!fs.existsSync(file)) return DEFAULT_RENDER_OPTIONS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`[ReportService:renderOptions] ${file} không phải JSON hợp lệ`, err);
    throw new Error(`Tệp ${RENDER_OPTIONS_FILE} của template ${path.basename(dir)} không phải JSON hợp lệ`);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Tệp ${RENDER_OPTIONS_FILE} của template ${path.basename(dir)} phải là object`);
  }
  const rec = parsed as Record<string, unknown>;
  const pick = (key: keyof TemplateRenderOptions): boolean => {
    const value = rec[key];
    if (value === undefined) return DEFAULT_RENDER_OPTIONS[key];
    if (typeof value !== 'boolean') {
      throw new Error(`Tệp ${RENDER_OPTIONS_FILE} của template ${path.basename(dir)}: "${key}" phải là true/false`);
    }
    return value;
  };
  const options: TemplateRenderOptions = {
    headerFooter: pick('headerFooter'),
    tocTwoPass: pick('tocTwoPass'),
    waitForReportReady: pick('waitForReportReady'),
    chromeHeaderFooter: pick('chromeHeaderFooter'),
  };
  if (options.headerFooter && options.chromeHeaderFooter) {
    throw new Error(`Tệp ${RENDER_OPTIONS_FILE} của template ${path.basename(dir)}: không bật đồng thời headerFooter và chromeHeaderFooter`);
  }
  return options;
}

export interface RenderedReportHtml {
  html: string;
  viewModel: ReportViewModel;
  watermark: WatermarkVerifyReport;
  /** Template thật sự đã dùng (chung cư luôn là v1 — nền của template theo loại). */
  templateKey: ReportTemplateKey;
  render: TemplateRenderOptions;
  /** Đầu/chân trang HTML cho Chrome khi template bật `chromeHeaderFooter`. */
  chromeHeaderFooter?: { headerTemplate: string; footerTemplate: string };
  /** Dữ liệu riêng của template do presenter dựng (VD `v2` của template nhà dân v2). */
  presented: Record<string, unknown>;
}

export interface ResolvedReport {
  id: string;
  status: string;
  zoneId: string | null;
  exportRevision: number;
  approvedAt: string | null;
  raw: Record<string, unknown>;
}

export class ReportService {
  /** Bộ template đã biên dịch, khóa theo tên thư mục template (residential, residential-v2, condo-unit...). */
  private static templateCache = new Map<string, CompiledReportTemplate>();

  private static templateDirPath(dirName: string): string {
    return path.join(__dirname, '../templates', dirName);
  }

  private static getTemplatesDir(kind: ReportTemplateKind = 'STANDALONE'): string {
    return this.templateDirPath(TEMPLATE_DIR_BY_KIND[kind]);
  }

  private static hasIndex(dirName: string): boolean {
    return fs.existsSync(path.join(this.templateDirPath(dirName), 'index.hbs'));
  }

  /** Template nhà dân có sẵn để chọn (thư mục đã có `index.hbs`). */
  public static isTemplateAvailable(key: ReportTemplateKey): boolean {
    return this.hasIndex(TEMPLATE_DIR_BY_KEY[key]);
  }

  /**
   * Thư mục template thật sự dùng. Chung cư: template của loại nếu đã có (GĐ1 căn U, GĐ2 khu vực M, GĐ3 Tòa mẹ),
   * chưa có thì in bằng v1 nhà dân như trước, bỏ qua `templateKey`. Nhà dân: theo `templateKey`.
   */
  private static selectTemplate(kind: ReportTemplateKind, templateKey: ReportTemplateKey): TemplateSelection {
    if (kind !== 'STANDALONE') {
      const dir = TEMPLATE_DIR_BY_KIND[kind];
      return this.hasIndex(dir) ? { dir, mode: 'condo' } : { dir: RESIDENTIAL_V1_DIR, mode: 'global' };
    }
    if (templateKey === LEGACY_TEMPLATE_KEY) return { dir: RESIDENTIAL_V1_DIR, mode: 'global' };
    const dir = TEMPLATE_DIR_BY_KEY[templateKey];
    if (!this.hasIndex(dir)) {
      console.error(`[ReportService:selectTemplate] Template ${templateKey} chưa có ${dir}/index.hbs`);
      throw new ConflictError(`Template báo cáo ${templateKey} chưa sẵn sàng trên máy chủ`);
    }
    return { dir, mode: 'isolated' };
  }

  private static latestTemplateMtime(dirNames: string[]): number {
    let latest = 0;
    for (const dirName of dirNames) {
      const dir = this.templateDirPath(dirName);
      for (const sub of ['', 'partials']) {
        const d = path.join(dir, sub);
        if (!fs.existsSync(d)) continue;
        for (const f of fs.readdirSync(d)) {
          if (!/\.(hbs|css|json)$/.test(f)) continue;
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
    // Số liệu pháp lý thiếu thì in '---' (không bịa giá trị); số 0 vẫn là dữ liệu thật nên được in.
    hbs.registerHelper('orDash', (value: unknown) =>
      value === undefined || value === null || (typeof value === 'string' && (value.trim() === '' || value.trim() === '--')) ? '---' : value
    );
  }

  private static registerPartialsFrom(hbs: typeof Handlebars, partialsDir: string, only?: readonly string[]): void {
    if (!fs.existsSync(partialsDir)) return;
    for (const file of fs.readdirSync(partialsDir).filter((f) => f.endsWith('.hbs'))) {
      const name = file.replace(/\.hbs$/, '');
      if (only && !only.includes(name)) continue;
      hbs.registerPartial(name, fs.readFileSync(path.join(partialsDir, file), 'utf8'));
    }
  }

  /** Đăng ký helper + partial nhà dân v1 vào môi trường Handlebars toàn cục (các script kiểm thử dùng). */
  public static registerHelpersAndPartials(baseDir?: string): void {
    this.registerHelpers(Handlebars);
    this.registerPartialsFrom(Handlebars, baseDir || path.join(this.getTemplatesDir(), 'partials'));
  }

  /**
   * Biên dịch template theo loại hồ sơ và (với nhà dân) theo `templateKey`. Gọi không tham số = v1 nhà dân,
   * giữ nguyên hành vi cũ cho các script kiểm thử. Xem `TemplateBuildMode` về cách cô lập partial giữa các bộ.
   */
  public static getCompiledTemplate(
    requestedKind: ReportTemplateKind = 'STANDALONE',
    templateKey: ReportTemplateKey = LEGACY_TEMPLATE_KEY
  ): CompiledTemplateResult {
    const { dir, mode } = this.selectTemplate(requestedKind, templateKey);
    const watchedDirs = mode === 'global' ? [dir] : [RESIDENTIAL_V1_DIR, dir];
    const cached = this.templateCache.get(dir);
    if (cached && (process.env.NODE_ENV === 'production' || this.latestTemplateMtime(watchedDirs) <= cached.mtime)) {
      const { mtime: _mtime, ...result } = cached;
      return result;
    }

    const mtime = this.latestTemplateMtime(watchedDirs);
    const baseDir = this.templateDirPath(RESIDENTIAL_V1_DIR);
    const ownDir = this.templateDirPath(dir);
    const templatePath = path.join(ownDir, 'index.hbs');
    const baseStylesPath = path.join(baseDir, 'styles.css');
    const ownStylesPath = path.join(ownDir, 'styles.css');

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Không tìm thấy file template Handlebars tại: ${templatePath}`);
    }

    let hbs: typeof Handlebars;
    let cssParts: string[];
    if (mode === 'global') {
      this.registerHelpersAndPartials();
      hbs = Handlebars;
      cssParts = [baseStylesPath];
    } else if (mode === 'condo') {
      hbs = Handlebars.create();
      this.registerHelpers(hbs);
      this.registerPartialsFrom(hbs, path.join(baseDir, 'partials'));
      this.registerPartialsFrom(hbs, path.join(ownDir, 'partials'));
      cssParts = fs.existsSync(ownStylesPath) ? [baseStylesPath, ownStylesPath] : [baseStylesPath];
    } else {
      hbs = Handlebars.create();
      this.registerHelpers(hbs);
      this.registerPartialsFrom(hbs, path.join(baseDir, 'partials'), V1_PARTIALS_SHARED_WITH_V2);
      this.registerPartialsFrom(hbs, path.join(ownDir, 'partials'));
      cssParts = [ownStylesPath];
    }

    for (const cssPath of cssParts) {
      if (!fs.existsSync(cssPath)) {
        throw new Error(`Không tìm thấy file CSS Paged Media tại: ${cssPath}`);
      }
    }
    const styles = [ReportFontsService.getFontCss(), ...cssParts.map((p) => fs.readFileSync(p, 'utf8'))].join('\n');
    const template = hbs.compile(fs.readFileSync(templatePath, 'utf8'));
    const render = readRenderOptions(ownDir);
    const result: CompiledTemplateResult = { template, styles, render };
    if (render.chromeHeaderFooter) {
      for (const [key, file] of [['chromeHeader', 'chrome-header.hbs'], ['chromeFooter', 'chrome-footer.hbs']] as const) {
        const filePath = path.join(ownDir, file);
        if (!fs.existsSync(filePath)) {
          throw new Error(`Template ${dir} bật chromeHeaderFooter nhưng thiếu ${file}`);
        }
        result[key] = hbs.compile(fs.readFileSync(filePath, 'utf8'));
      }
    }
    this.templateCache.set(dir, { ...result, mtime });
    return result;
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
    enableWatermark: boolean = true,
    templateKey: ReportTemplateKey = LEGACY_TEMPLATE_KEY
  ): Promise<RenderedReportHtml> {
    return this.generateResidentialHtmlFromReport(rawReport, overrides, maskPii, enableWatermark, templateKey);
  }

  /**
   * Chọn template cho một lượt render: template đã đóng băng của Rev → template người gọi chọn → mặc định
   * (`DEFAULT_RESIDENTIAL_TEMPLATE`). Chung cư luôn theo template của loại (nền v1); chọn v2 cho chung cư là lỗi.
   */
  public static resolveTemplateKey(
    rawReport: Record<string, unknown>,
    requested?: ReportTemplateKey | null,
    frozen?: ReportTemplateKey | null
  ): ReportTemplateKey {
    if (resolveReportTemplateKind(rawReport) !== 'STANDALONE') {
      if (requested && requested !== LEGACY_TEMPLATE_KEY) {
        throw new BadRequestError(`Template ${requested} chỉ dành cho hồ sơ nhà dân, hồ sơ chung cư dùng template riêng của loại`);
      }
      return LEGACY_TEMPLATE_KEY;
    }
    if (frozen) return frozen;
    return requested ?? defaultResidentialTemplateKey();
  }

  /**
   * Template đã dùng khi phát hành Rev gắn với snapshot này. Rev phát hành trước khi có đa template không ghi khóa
   * trong snapshot nên tra `report_releases.template_key` (cột mặc định v1). Null = snapshot chưa từng phát hành.
   */
  public static async getFrozenTemplateKey(
    snapshotVersionId: string | null | undefined,
    snapshot: ReportSnapshot
  ): Promise<ReportTemplateKey | null> {
    const fromSnapshot = snapshot.frozenReportData?.template_key;
    if (isReportTemplateKey(fromSnapshot)) return fromSnapshot;
    if (!snapshotVersionId) return null;
    const res = await Database.query<{ template_key: string | null }>(
      `SELECT template_key FROM report_releases
       WHERE snapshot_version_id = $1 AND deleted_at IS NULL
       ORDER BY revision DESC LIMIT 1;`,
      [snapshotVersionId]
    );
    const row = res.rows[0];
    if (!row) return null;
    if (isReportTemplateKey(row.template_key)) return row.template_key;
    console.error(
      `[ReportService:getFrozenTemplateKey] Rev của snapshot ${snapshotVersionId} có template_key lạ "${row.template_key}", in bằng ${LEGACY_TEMPLATE_KEY}`
    );
    return LEGACY_TEMPLATE_KEY;
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
    enableWatermark: boolean = true,
    templateKey: ReportTemplateKey = LEGACY_TEMPLATE_KEY
  ): Promise<RenderedReportHtml> {
    // Báo lỗi template chưa sẵn sàng ngay, trước khi nạp ảnh. Chung cư bỏ qua templateKey (nền v1).
    const effectiveKey = resolveReportTemplateKind(rawReport) === 'STANDALONE' ? templateKey : LEGACY_TEMPLATE_KEY;
    this.selectTemplate(resolveReportTemplateKind(rawReport), effectiveKey);
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

      const compiled = this.getCompiledTemplate(resolveReportTemplateKind(activeReport), effectiveKey);
      const { template, styles, render } = compiled;
      const { dir } = this.selectTemplate(resolveReportTemplateKind(activeReport), effectiveKey);
      const presenter = TEMPLATE_PRESENTERS[dir];
      const extra = presenter ? presenter(viewModel, activeReport as Record<string, unknown>) : {};
      const html = template({
        ...viewModel,
        ...extra,
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

      const headerFooterContext = { ...viewModel, ...extra };
      const chromeHeaderFooter =
        render.chromeHeaderFooter && compiled.chromeHeader && compiled.chromeFooter
          ? { headerTemplate: compiled.chromeHeader(headerFooterContext), footerTemplate: compiled.chromeFooter(headerFooterContext) }
          : undefined;
      return { html, viewModel, watermark, templateKey: effectiveKey, render, chromeHeaderFooter, presented: extra };
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

  /** Tùy chọn in của template → tùy chọn của PdfRenderEngine. */
  private static engineOptions(rendered: RenderedReportHtml): {
    headerFooter: boolean;
    tocTwoPass: boolean;
    waitForReportReady: boolean;
    chromeHeaderFooter?: { headerTemplate: string; footerTemplate: string };
  } {
    return {
      headerFooter: rendered.render.headerFooter,
      tocTwoPass: rendered.render.tocTwoPass,
      waitForReportReady: rendered.render.waitForReportReady,
      chromeHeaderFooter: rendered.chromeHeaderFooter,
    };
  }

  public static async renderFinalPdf(
    resolved: ResolvedReport,
    snapshot: ReportSnapshot,
    revision: number,
    pinnedConfig?: ReportContentConfig,
    templateKey?: ReportTemplateKey
  ): Promise<{
    pdfBuffer: Buffer;
    reportNo: string;
    buildingId: string;
    watermark?: WatermarkVerifyReport;
    templateKey: ReportTemplateKey;
    presented: Record<string, unknown>;
  }> {
    // Chốt chặn crop chưa duyệt chạy ở ReportReleaseService.issue (trước transaction khoá hàng).
    const finalReport = this.buildFinalReport(resolved, snapshot, revision);
    if (pinnedConfig) {
      finalReport.reportContentConfig = pinnedConfig;
    }
    return RenderQueue.run(async () => {
      const frozenKey = snapshot.frozenReportData?.template_key;
      const key = templateKey ?? (isReportTemplateKey(frozenKey) ? frozenKey : LEGACY_TEMPLATE_KEY);
      const rendered = await this.generateResidentialHtmlFromReport(finalReport, undefined, false, true, key);
      const { html, viewModel, watermark } = rendered;
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
        ...this.engineOptions(rendered),
      });
      return { pdfBuffer, reportNo, buildingId, watermark, templateKey: rendered.templateKey, presented: rendered.presented };
    });
  }

  public static async renderDraftHtml(
    resolved: ResolvedReport,
    overrides: unknown,
    maskPii: boolean,
    enableWatermark: boolean,
    revision?: number,
    requestedTemplate?: ReportTemplateKey | null
  ): Promise<RenderedReportHtml> {
    const effectiveOverrides = resolved.status === 'APPROVED' ? undefined : overrides;
    let reportData = resolved.raw;
    let frozenTemplate: ReportTemplateKey | null = null;
    if (resolved.status === 'APPROVED') {
      let approved: Awaited<ReturnType<typeof ReportSnapshotService.getSnapshotForRevision>> = null;
      try {
        approved = await ReportSnapshotService.getSnapshotForRevision(resolved.id, revision);
        if (approved?.snapshot) {
          reportData = ReportSnapshotService.applySnapshotToReport(resolved.raw, approved.snapshot);
          reportData.status = 'APPROVED';
        }
      } catch (err) {
        console.warn(`[ReportService] Không thể tải snapshot phê duyệt cho report ${resolved.id}:`, err);
      }
      // Ngoài try: không tra được template của Rev thì phải báo lỗi, không lặng lẽ in Rev bằng template khác.
      if (approved?.snapshot) {
        frozenTemplate = await this.getFrozenTemplateKey(approved.versionId, approved.snapshot);
      }
    }
    const templateKey = this.resolveTemplateKey(resolved.raw, requestedTemplate, frozenTemplate);
    return this.generateResidentialHtmlFromReport(reportData, effectiveOverrides, maskPii, enableWatermark, templateKey);
  }

  public static async renderDraftPdf(
    resolved: ResolvedReport,
    overrides: unknown,
    enableWatermark: boolean,
    revision?: number,
    requestedTemplate?: ReportTemplateKey | null
  ): Promise<{ pdfBuffer: Buffer; reportNo: string; buildingId: string; templateKey: ReportTemplateKey }> {
    // Hồ sơ APPROVED render theo snapshot đã đóng băng nên không cần gate; bản nháp phải duyệt xong crop.
    if (resolved.status !== 'APPROVED') await this.assertPhotoQcCropsReviewed(resolved.id);
    return RenderQueue.run(async () => {
      const rendered = await this.renderDraftHtml(resolved, overrides, false, enableWatermark, revision, requestedTemplate);
      const { html, viewModel, watermark } = rendered;
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
        ...this.engineOptions(rendered),
      });
      return { pdfBuffer, reportNo, buildingId, templateKey: rendered.templateKey };
    });
  }
}

