import { SurveyRepository } from '../survey/survey.repository';
import { NotFoundError } from '../../common/errors/problem-details';
import { ResidentialReportGenerator } from './generators/residential.generator';
import { PdfRenderEngine } from './engine/pdf-render.engine';

export class ReportService {
  /**
   * Xuất Báo cáo Hiện trạng Nhà Dân cư độc lập ra PDF buffer
   */
  static async generateResidentialPdf(reportId: string): Promise<{
    pdfBuffer: Buffer;
    reportCode: string;
    checksum?: string;
    viewModel: any;
  }> {
    let rawReport = await SurveyRepository.findReportById(reportId);
    if (!rawReport) {
      rawReport = await SurveyRepository.findLatestPhase1ReportByParcelId(reportId);
    }
    if (!rawReport) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }

    // 1. Chuyển đổi dữ liệu và chuẩn bị toàn bộ note, chỉ số, hình ảnh
    const viewModel = ResidentialReportGenerator.buildViewModel(rawReport);

    // 2. Biên dịch template Handlebars thành chuỗi HTML
    const html = ResidentialReportGenerator.generateHtml(viewModel);

    // 3. Render Chromium Headless thành PDF A4
    const pdfBuffer = await PdfRenderEngine.renderHtmlToPdf(html, {
      buildingId: viewModel.buildingId,
      reportCode: viewModel.reportCode,
      headerTitle: 'LIÊN DANH CRLG–CRSRI–TT | DỰ ÁN METRO 2 BẾN THÀNH - THAM LƯƠNG',
    });

    return {
      pdfBuffer,
      reportCode: viewModel.reportCode,
      viewModel,
    };
  }

  /**
   * Xem trước mã HTML của Báo cáo Nhà Dân cư độc lập
   */
  static async previewResidentialHtml(reportId: string): Promise<string> {
    let rawReport = await SurveyRepository.findReportById(reportId);
    if (!rawReport) {
      rawReport = await SurveyRepository.findLatestPhase1ReportByParcelId(reportId);
    }
    if (!rawReport) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }
    const viewModel = ResidentialReportGenerator.buildViewModel(rawReport);
    return ResidentialReportGenerator.generateHtml(viewModel);
  }
}
