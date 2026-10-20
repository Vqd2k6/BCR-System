/**
 * ============================================================================
 * REPORT V2 SERVICE (ORCHESTRATOR)
 * Điều phối dữ liệu, tính toán ViewModel, biên dịch Handlebars và xuất PDF V2
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { SurveyRepository } from '../survey/survey.repository';
import { NotFoundError } from '../../common/errors/problem-details';
import { ReportV2ViewModelMapper } from './mappers/report-v2-viewmodel.mapper';
import { PdfRenderV2Engine } from './engine/pdf-render-v2.engine';
import { applyOverridesToReportV2 } from './utils/report-override-v2.utils';
import { ReportV2ViewModel } from './report-v2.types';
import { ReportWatermarkCanvasService } from './services/report-watermark-canvas.service';
import { maskReportPii } from '../../common/utils/pii.utils';
import { preloadImageOrientations } from '../report/generators/residential/residential.image-sniff';
import { ReportImageResolver } from './services/report-image-resolver.service';
import { ReportFontsService } from './services/report-fonts.service';
import { ReportConfigService } from '../report_config/report-config.service';
import type { ReportContentConfig } from '../report_config/report-config.types';
import { extractParcelPolygonCoords, preloadSatelliteTiles } from './utils/metro-spatial.utils';

function extractAllImageUrls(obj: any, urls: Set<string> = new Set()): string[] {
  if (!obj) return [];
  if (typeof obj === 'string') {
    if (obj.startsWith('http://') || obj.startsWith('https://') || obj.startsWith('/uploads/') || obj.startsWith('uploads/')) {
      if (/\.(jpg|jpeg|png|webp)/i.test(obj) || obj.includes('/surveys/')) {
        urls.add(obj);
      }
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) extractAllImageUrls(item, urls);
  } else if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) extractAllImageUrls(obj[key], urls);
  }
  return Array.from(urls);
}

export class ReportV2Service {
  private static cachedTemplate: Handlebars.TemplateDelegate | null = null;
  private static cachedStyles: string | null = null;
  private static partialsRegistered = false;
  private static cachedTemplatesMtime = 0;

  /** mtime mới nhất của index.hbs, styles.css và các partial (dùng để làm mới cache khi dev) */
  private static latestTemplateMtime(): number {
    const dir = path.join(__dirname, 'templates/residential');
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

  /**
   * Đăng ký các helper và partials Handlebars cần thiết
   */
  public static registerHelpersAndPartials(baseDir?: string): void {
    Handlebars.registerHelper('eq', (a, b) => a === b);
    Handlebars.registerHelper('ne', (a, b) => a !== b);
    Handlebars.registerHelper('gt', (a, b) => Number(a) > Number(b));
    Handlebars.registerHelper('gte', (a, b) => Number(a) >= Number(b));
    Handlebars.registerHelper('lt', (a, b) => Number(a) < Number(b));
    Handlebars.registerHelper('lte', (a, b) => Number(a) <= Number(b));
    Handlebars.registerHelper('or', function(...args: any[]) {
      args.pop();
      return args.some(Boolean);
    });
    Handlebars.registerHelper('and', function(...args: any[]) {
      args.pop();
      return args.every(Boolean);
    });

    const partialsDir = baseDir || path.join(__dirname, 'templates/residential/partials');
    if (fs.existsSync(partialsDir)) {
      const partialFiles = fs.readdirSync(partialsDir).filter((f) => f.endsWith('.hbs'));
      for (const file of partialFiles) {
        const partialName = file.replace(/\.hbs$/, '');
        const content = fs.readFileSync(path.join(partialsDir, file), 'utf8');
        Handlebars.registerPartial(partialName, content);
      }
    }
    this.partialsRegistered = true;
  }

  /**
   * Khởi tạo hoặc lấy template Handlebars đã biên dịch
   */
  public static getCompiledTemplate(): {
    template: Handlebars.TemplateDelegate;
    styles: string;
  } {
    // ts-node-dev chỉ restart khi .ts đổi: ngoài production, nạp lại template nếu file .hbs/.css đã được sửa
    if (process.env.NODE_ENV !== 'production' && this.cachedTemplate) {
      const mtime = this.latestTemplateMtime();
      if (mtime > this.cachedTemplatesMtime) {
        this.cachedTemplate = null;
        this.cachedStyles = null;
      }
    }
    if (!this.cachedTemplate || !this.cachedStyles) {
      this.cachedTemplatesMtime = this.latestTemplateMtime();
      const templatePath = path.join(__dirname, 'templates/residential/index.hbs');
      const stylesPath = path.join(__dirname, 'templates/residential/styles.css');

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

  /**
   * Phân giải hồ sơ khảo sát theo ID, report_code hoặc mã thửa đất
   */
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
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát V2 với ID hoặc mã thửa: ${identifier}`);
    }
    return rawReport;
  }

  /**
   * Biên dịch mã HTML xem trước cho Báo cáo V2
   */
  public static async generateResidentialHtml(
    identifier: string,
    overrides?: any,
    maskPii: boolean = false,
    enableWatermark: boolean = true
  ): Promise<{ html: string; viewModel: ReportV2ViewModel }> {
    const rawReport = await this.resolveReport(identifier);
    return this.generateResidentialHtmlFromReport(rawReport, overrides, maskPii, enableWatermark);
  }

  /**
   * Dựng HTML từ bản ghi đã được resolve (V3 truyền bản ghi đã gắn điểm từ snapshot APPROVED_RELEASE)
   */
  public static async generateResidentialHtmlFromReport(
    rawReport: any,
    overrides?: any,
    maskPii: boolean = false,
    enableWatermark: boolean = true
  ): Promise<{ html: string; viewModel: ReportV2ViewModel }> {
    let activeReport = applyOverridesToReportV2(rawReport, overrides);
    if (maskPii) {
      activeReport = maskReportPii(activeReport);
    }

    const isCondoUnit = activeReport.report_type === 'CONDO_UNIT' || Boolean(activeReport.unit_id) || Boolean(activeReport.survey_data_json?.unitCode);
    if (isCondoUnit) {
      const { CondoUnitReportGenerator } = await import('../report/generators/condo-unit.generator');
      const viewModel = CondoUnitReportGenerator.buildViewModel(activeReport);
      if (maskPii) {
        (viewModel as any).isPiiMasked = true;
      }
      const html = CondoUnitReportGenerator.generateHtml(viewModel);
      return { html, viewModel: viewModel as any };
    }

    // 1. Phân tích trước tỷ lệ khung ảnh và nhúng Base64 100% ảnh khảo sát (bao gồm cả Cloud R2)
    const allPhotoUrls = extractAllImageUrls(activeReport);
    const photoRotationsMap = activeReport.survey_data_json?.photoRotations || activeReport.photoRotations || {};
    await preloadImageOrientations(allPhotoUrls);
    await ReportImageResolver.preloadAndResolveAll(allPhotoUrls, photoRotationsMap);

    // 1.1. Tải trước ảnh vệ tinh Esri World Imagery cho sơ đồ không gian trang bìa
    try {
      const polygonCoords = extractParcelPolygonCoords(activeReport, activeReport.survey_data_json);
      if (polygonCoords) {
        await preloadSatelliteTiles(polygonCoords);
      }
    } catch (e) {
      // Graceful fallback nếu không tải được tile vệ tinh
    }

    // 2. Tải cấu hình nội dung chuẩn báo cáo (Q1, Q5)
    const config: ReportContentConfig =
      activeReport.reportContentConfig || (await ReportConfigService.getActiveConfig());

    // 3. Chuyển đổi và tính toán toàn bộ ViewModel
    const viewModel = ReportV2ViewModelMapper.buildViewModel(activeReport, overrides, config);
    if (maskPii) {
      (viewModel as any).isPiiMasked = true;
    }

    // 2. Dập watermark in-memory theo chuẩn commit 3ff0fab cho các ảnh chưa có dấu nếu enableWatermark = true
    const effectiveWatermark = maskPii ? true : enableWatermark;
    if (effectiveWatermark) {
      await ReportWatermarkCanvasService.applyWatermarksToViewModel(viewModel);
    }

    // 3. Biên dịch mã HTML
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

  /**
   * Xuất Báo cáo V2 ra PDF Buffer chuẩn A4
   */
  public static async generateResidentialPdf(
    identifier: string,
    overrides?: any,
    enableWatermark: boolean = true
  ): Promise<{
    pdfBuffer: Buffer;
    reportNo: string;
    buildingId: string;
    viewModel: ReportV2ViewModel;
  }> {
    const { html, viewModel } = await this.generateResidentialHtml(identifier, overrides, false, enableWatermark);

    const bId = (viewModel as any).metadata?.buildingId || (viewModel as any).buildingId || 'BCS';
    const rNo = (viewModel as any).metadata?.reportNo || (viewModel as any).reportCode || 'REPORT';

    const pdfBuffer = await PdfRenderV2Engine.renderHtmlToPdf(html, {
      buildingId: bId,
      reportNo: rNo,
      headerTitle: 'LIÊN DANH CRLG–CRSRI–TT | DỰ ÁN METRO 2 BẾN THÀNH - THAM LƯƠNG',
    });

    return {
      pdfBuffer,
      reportNo: rNo,
      buildingId: bId,
      viewModel,
    };
  }
}
