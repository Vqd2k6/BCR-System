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

export class ReportV2Service {
  private static cachedTemplate: Handlebars.TemplateDelegate | null = null;
  private static cachedStyles: string | null = null;
  private static partialsRegistered = false;

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
    if (!this.cachedTemplate || !this.cachedStyles) {
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
      this.cachedStyles = fs.readFileSync(stylesPath, 'utf8');

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
    let activeReport = applyOverridesToReportV2(rawReport, overrides);
    if (maskPii) {
      activeReport = maskReportPii(activeReport);
    }

    // 1. Chuyển đổi và tính toán toàn bộ ViewModel
    const viewModel = ReportV2ViewModelMapper.buildViewModel(activeReport, overrides);
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

    const pdfBuffer = await PdfRenderV2Engine.renderHtmlToPdf(html, {
      buildingId: viewModel.metadata.buildingId,
      reportNo: viewModel.metadata.reportNo,
      headerTitle: 'LIÊN DANH CRLG–CRSRI–TT | DỰ ÁN METRO 2 BẾN THÀNH - THAM LƯƠNG',
    });

    return {
      pdfBuffer,
      reportNo: viewModel.metadata.reportNo,
      buildingId: viewModel.metadata.buildingId,
      viewModel,
    };
  }
}
