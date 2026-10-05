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

export class ReportV2Service {
  private static cachedTemplate: Handlebars.TemplateDelegate | null = null;
  private static cachedStyles: string | null = null;

  /**
   * Khởi tạo hoặc lấy template Handlebars đã biên dịch
   */
  private static getCompiledTemplate(): {
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

      const templateSource = fs.readFileSync(templatePath, 'utf8');
      this.cachedStyles = fs.readFileSync(stylesPath, 'utf8');

      // Đăng ký các helper Handlebars cần thiết
      Handlebars.registerHelper('eq', (a, b) => a === b);
      Handlebars.registerHelper('ne', (a, b) => a !== b);
      Handlebars.registerHelper('gt', (a, b) => Number(a) > Number(b));
      Handlebars.registerHelper('gte', (a, b) => Number(a) >= Number(b));
      Handlebars.registerHelper('lt', (a, b) => Number(a) < Number(b));
      Handlebars.registerHelper('lte', (a, b) => Number(a) <= Number(b));

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
    overrides?: any
  ): Promise<{ html: string; viewModel: ReportV2ViewModel }> {
    const rawReport = await this.resolveReport(identifier);
    const activeReport = applyOverridesToReportV2(rawReport, overrides);

    // 1. Chuyển đổi và tính toán toàn bộ ViewModel
    const viewModel = ReportV2ViewModelMapper.buildViewModel(activeReport, overrides);

    // 2. Biên dịch mã HTML
    const { template, styles } = this.getCompiledTemplate();
    const html = template({
      ...viewModel,
      styles,
    });

    return { html, viewModel };
  }

  /**
   * Xuất Báo cáo V2 ra PDF Buffer chuẩn A4
   */
  public static async generateResidentialPdf(
    identifier: string,
    overrides?: any
  ): Promise<{
    pdfBuffer: Buffer;
    reportNo: string;
    buildingId: string;
    viewModel: ReportV2ViewModel;
  }> {
    const { html, viewModel } = await this.generateResidentialHtml(identifier, overrides);

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
