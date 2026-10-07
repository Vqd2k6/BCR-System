import { SurveyRepository } from '../survey/survey.repository';
import { NotFoundError, ForbiddenError } from '../../common/errors/problem-details';
import { ResidentialReportGenerator } from './generators/residential.generator';
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

    // 1. Chuyển đổi dữ liệu và chuẩn bị toàn bộ note, chỉ số, hình ảnh
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
   * Xem trước mã HTML của Báo cáo Nhà Dân cư độc lập (Hỗ trợ overrides in-memory)
   */
  static async previewResidentialHtml(reportId: string, overrides?: any, maskPii: boolean = false): Promise<string> {
    const rawReport = await ReportService.resolveReport(reportId);

    // Áp dụng overrides nếu có (in-memory, không lưu DB)
    let activeReport = ReportService.applyOverridesToReport(rawReport, overrides);
    if (maskPii) {
      activeReport = maskReportPii(activeReport);
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
  static async updateReportSurveyData(reportId: string, updates: any): Promise<{
    success: boolean;
    reportId: string;
    exportRevision: number;
    message: string;
  }> {
    const rawReport = await ReportService.resolveReport(reportId);

    if (rawReport.status === 'APPROVED') {
      throw new ForbiddenError(
        'Hồ sơ khảo sát này đã được Zone Admin phê duyệt chính thức và bị khóa bất biến, không thể chỉnh sửa dữ liệu.'
      );
    }

    const realReportId = rawReport.id;
    const existingJson = rawReport.survey_data_json || {};

    // Clone existing JSON to avoid in-place mutation issues
    const updatedJson = JSON.parse(JSON.stringify(existingJson));

    // 1. Thông tin chung & Quy mô công trình
    if (updates.buildingName !== undefined) updatedJson.buildingName = updates.buildingName;
    if (updates.ownerName !== undefined) updatedJson.ownerName = updates.ownerName;
    if (updates.ownerPhone !== undefined) updatedJson.ownerPhone = updates.ownerPhone;
    if (updates.houseNumber !== undefined) updatedJson.houseNumber = updates.houseNumber;
    if (updates.street !== undefined) updatedJson.street = updates.street;
    if (updates.aboveFloors !== undefined) updatedJson.aboveFloors = Number(updates.aboveFloors);
    if (updates.undergroundFloors !== undefined) updatedJson.undergroundFloors = Number(updates.undergroundFloors);
    if (updates.constructionYear !== undefined) updatedJson.constructionYear = updates.constructionYear;
    if (updates.isEstimatedYear !== undefined) updatedJson.isEstimatedYear = Boolean(updates.isEstimatedYear);
    if (updates.constructionAreaM2 !== undefined) updatedJson.constructionAreaM2 = updates.constructionAreaM2;
    if (updates.buildingHeightM !== undefined) updatedJson.buildingHeightM = updates.buildingHeightM;
    if (updates.structureSystem !== undefined) updatedJson.structureSystem = updates.structureSystem;
    if (updates.usageFunction !== undefined) updatedJson.usageFunction = updates.usageFunction;

    // 2. Móng công trình
    if (updates.foundationType !== undefined) updatedJson.foundationType = updates.foundationType;
    if (updates.foundationCatScore !== undefined) updatedJson.foundationCatScore = updates.foundationCatScore;
    if (updates.foundationSource !== undefined) updatedJson.foundationSource = updates.foundationSource;
    if (updates.foundationDepthM !== undefined) updatedJson.foundationDepthM = updates.foundationDepthM;
    if (updates.pileDimensionMm !== undefined) updatedJson.pileDimensionMm = updates.pileDimensionMm;
    if (updates.foundationNotes !== undefined) updatedJson.foundationNotes = updates.foundationNotes;

    // 3. Công trình liền kề
    if (updates.adjacentBuildings !== undefined) {
      updatedJson.adjacentBuildings = {
        ...updatedJson.adjacentBuildings,
        ...updates.adjacentBuildings,
      };
    }

    // 4. Các tầng & Sổ khuyết tật (Floors, Zones, Defects)
    if (updates.floors && Array.isArray(updates.floors)) {
      updatedJson.floors = updates.floors;
    }

    // 5. Đo đạc biến dạng & Lún nghiêng
    if (updates.settlementTilt !== undefined) {
      updatedJson.settlementTilt = {
        ...updatedJson.settlementTilt,
        ...updates.settlementTilt,
      };
    }

    // 6. Kết luận & Kiến nghị kỹ thuật
    if (!updatedJson.executiveSummary) updatedJson.executiveSummary = {};
    if (updates.summaryConclusions !== undefined) {
      updatedJson.executiveSummary.keyRisksDefectsText = updates.summaryConclusions;
      updatedJson.executiveSummary.summaryConclusionsText = updates.summaryConclusions;
    }
    if (updates.engineeringRecommendations !== undefined) {
      updatedJson.executiveSummary.specificRecommendationsText = updates.engineeringRecommendations;
    }

    // 7. Ý kiến chủ nhà
    if (updates.ownerRemarks !== undefined) {
      updatedJson.ownerRemarks = updates.ownerRemarks;
      if (!updatedJson.signatures) updatedJson.signatures = {};
      updatedJson.signatures.ownerFeedback = updates.ownerRemarks;
    }

    // 8. Nếu client gửi trực tiếp surveyDataJson
    if (updates.surveyDataJson && typeof updates.surveyDataJson === 'object') {
      Object.assign(updatedJson, updates.surveyDataJson);
    }

    const newRev = await SurveyRepository.updateReportData(realReportId, {
      surveyDataJson: updatedJson,
      ownerRemarks: updates.ownerRemarks ?? updatedJson.ownerRemarks,
      summaryConclusions: updates.summaryConclusions ?? updatedJson.executiveSummary?.keyRisksDefectsText,
      engineeringRecommendations: updates.engineeringRecommendations ?? updatedJson.executiveSummary?.specificRecommendationsText,
      houseNumber: updates.houseNumber ?? updatedJson.houseNumber,
      street: updates.street ?? updatedJson.street,
      ownerName: updates.ownerName ?? updatedJson.ownerName,
      ownerPhone: updates.ownerPhone ?? updatedJson.ownerPhone,
      constructionAreaM2: updates.constructionAreaM2 ?? updatedJson.constructionAreaM2,
      buildingHeightM: updates.buildingHeightM ?? updatedJson.buildingHeightM,
      foundationDepthM: updates.foundationDepthM ?? updatedJson.foundationDepthM,
      foundationNotes: updates.foundationNotes ?? updatedJson.foundationNotes,
      yearOfConstruction: updates.constructionYear ?? updatedJson.constructionYear,
      buildingName: updates.buildingName ?? updatedJson.buildingName,
    });

    return {
      success: true,
      reportId: realReportId,
      exportRevision: newRev,
      message: `Đã cập nhật thông tin khảo sát thành công (Phiên bản xuất: Rev ${String(newRev).padStart(2, '0')})`,
    };
  }

  /**
   * Lấy chi tiết raw report data theo ID hoặc code
   */
  static async getReportDetail(reportId: string): Promise<any> {
    return await ReportService.resolveReport(reportId);
  }
}
