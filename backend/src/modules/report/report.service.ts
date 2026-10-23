import { SurveyRepository } from '../survey/survey.repository';
import { NotFoundError, ForbiddenError } from '../../common/errors/problem-details';
import { ResidentialReportGenerator } from './generators/residential.generator';
import { CondoUnitReportGenerator } from './generators/condo-unit.generator';
import { PdfRenderEngine } from './engine/pdf-render.engine';
import { DocxRenderEngine } from './engine/docx-render.engine';
import { applyOverridesToReport } from './utils/report-override.utils';
import { maskReportPii } from '../../common/utils/pii.utils';

export class ReportService {
  /**
   * Áp dụng các trường ghi đè tạm thời vào rawReport in-memory (KHÔNG lưu vào database)
   * Giúp xuất file hoặc xem trước theo ý người dùng mà bảo toàn 100% dữ liệu gốc
   */
  static applyOverridesToReport(rawReport: any, overrides?: any): any {
    return applyOverridesToReport(rawReport, overrides);
  }

  /**
   * Xuất Báo cáo Hiện trạng Nhà Dân cư độc lập ra PDF buffer
   */
  /**
   * Phân giải hồ sơ khảo sát theo reportId, parcelId, hoặc mã thửa đất (projectParcelCode)
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
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID hoặc mã thửa: ${identifier}`);
    }
    return rawReport;
  }

  static async generateResidentialPdf(reportId: string, overrides?: any): Promise<{
    pdfBuffer: Buffer;
    reportCode: string;
    checksum?: string;
    viewModel: any;
  }> {
    const rawReport = await ReportService.resolveReport(reportId);

    // Áp dụng overrides nếu có (in-memory, không lưu DB)
    const activeReport = ReportService.applyOverridesToReport(rawReport, overrides);

    const isCondoUnit = activeReport.report_type === 'CONDO_UNIT' || Boolean(activeReport.unit_id) || Boolean(activeReport.survey_data_json?.unitCode);

    if (isCondoUnit) {
      // 1. Chuyển đổi dữ liệu sang ViewModel Căn hộ con (Template 2)
      const viewModel = CondoUnitReportGenerator.buildViewModel(activeReport);

      // 2. Biên dịch template Handlebars thành chuỗi HTML
      const html = CondoUnitReportGenerator.generateHtml(viewModel);

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

    // 1. Chuyển đổi dữ liệu và chuẩn bị toàn bộ note, chỉ số, hình ảnh Nhà dân cư độc lập (Template 1)
    const viewModel = ResidentialReportGenerator.buildViewModel(activeReport);

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
   * Xuất Báo cáo Hiện trạng Nhà Dân cư độc lập ra DOCX buffer
   */
  static async generateResidentialDocx(reportId: string, overrides?: any): Promise<{
    docxBuffer: Buffer;
    reportCode: string;
  }> {
    const rawReport = await ReportService.resolveReport(reportId);

    // Áp dụng overrides nếu có (in-memory, không lưu DB)
    const activeReport = ReportService.applyOverridesToReport(rawReport, overrides);

    // 1. Chuẩn bị ViewModel (dùng lại cùng generator với PDF)
    const viewModel = ResidentialReportGenerator.buildViewModel(activeReport);

    // 2. Build DOCX từ ViewModel
    const docxBuffer = await DocxRenderEngine.buildDocx(viewModel);

    return {
      docxBuffer,
      reportCode: viewModel.reportCode,
    };
  }

  /**
   * Xem trước mã HTML của Báo cáo Nhà Dân cư độc lập hoặc Căn hộ con (Hỗ trợ overrides in-memory)
   */
  static async previewResidentialHtml(reportId: string, overrides?: any, maskPii: boolean = false): Promise<string> {
    const rawReport = await ReportService.resolveReport(reportId);

    // Áp dụng overrides nếu có (in-memory, không lưu DB)
    let activeReport = ReportService.applyOverridesToReport(rawReport, overrides);
    if (maskPii) {
      activeReport = maskReportPii(activeReport);
    }

    const isCondoUnit = activeReport.report_type === 'CONDO_UNIT' || Boolean(activeReport.unit_id) || Boolean(activeReport.survey_data_json?.unitCode);
    if (isCondoUnit) {
      const viewModel = CondoUnitReportGenerator.buildViewModel(activeReport);
      if (maskPii) {
        (viewModel as any).isPiiMasked = true;
      }
      return CondoUnitReportGenerator.generateHtml(viewModel);
    }

    const viewModel = ResidentialReportGenerator.buildViewModel(activeReport);
    if (maskPii) {
      (viewModel as any).isPiiMasked = true;
      (viewModel as any).isGuestWatermark = true;
    }
    return ResidentialReportGenerator.generateHtml(viewModel);
  }

  /**
   * Cập nhật thông tin/ghi chú trực tiếp của Báo cáo trước khi xuất file
   */
  static async updateReportSurveyData(reportId: string, _updates: any): Promise<{
    success: boolean;
    reportId: string;
    exportRevision: number;
    message: string;
  }> {
    await ReportService.resolveReport(reportId);
    throw new ForbiddenError(
      'Chức năng sửa dữ liệu trực tiếp đã ngừng hỗ trợ. Mọi chỉnh sửa bắt buộc thực hiện tại phân hệ Thẩm định (Audit Studio).'
    );
  }

  /**
   * Lấy chi tiết raw report data theo ID hoặc code (tự động nạp Snapshot nếu đã APPROVED và che PII nếu là GUEST)
   */
  static async getReportDetail(reportId: string, maskPii: boolean = false, revision?: number): Promise<any> {
    let rawReport = await ReportService.resolveReport(reportId);
    if (String(rawReport.status || '').toUpperCase() === 'APPROVED' && rawReport.id) {
      try {
        const { ReportSnapshotService } = await import('../report_v3/report-snapshot.service');
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
}
