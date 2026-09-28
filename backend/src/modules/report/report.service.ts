import { SurveyRepository } from '../survey/survey.repository';
import { NotFoundError } from '../../common/errors/problem-details';
import { ResidentialReportGenerator } from './generators/residential.generator';
import { PdfRenderEngine } from './engine/pdf-render.engine';
import { DocxRenderEngine } from './engine/docx-render.engine';

export class ReportService {
  /**
   * Áp dụng các trường ghi đè tạm thời vào rawReport in-memory (KHÔNG lưu vào database)
   * Giúp xuất file hoặc xem trước theo ý người dùng mà bảo toàn 100% dữ liệu gốc
   */
  static applyOverridesToReport(rawReport: any, overrides?: any): any {
    if (!overrides || typeof overrides !== 'object' || Object.keys(overrides).length === 0) {
      return rawReport;
    }
    const cloned = JSON.parse(JSON.stringify(rawReport));
    if (!cloned.survey_data_json) {
      cloned.survey_data_json = {};
    }
    const json = cloned.survey_data_json;

    // 0. Nạp surveyDataJson thô nếu có LÀM NỀN TẢNG (để các trường overrides cụ thể bên dưới ghi đè có độ ưu tiên cao nhất)
    if (overrides.surveyDataJson && typeof overrides.surveyDataJson === 'object') {
      Object.assign(json, overrides.surveyDataJson);
    }

    // 1. Định danh & Pháp lý
    if (overrides.reportCode !== undefined) { cloned.report_code = overrides.reportCode; json.reportCode = overrides.reportCode; }
    if (overrides.officialCadastralCode !== undefined) { cloned.official_cadastral_code = overrides.officialCadastralCode; json.officialCadastralCode = overrides.officialCadastralCode; }
    if (overrides.projectParcelCode !== undefined) { cloned.project_parcel_code = overrides.projectParcelCode; json.projectParcelCode = overrides.projectParcelCode; }
    if (overrides.surveyDate !== undefined) { cloned.survey_date = overrides.surveyDate; json.surveyDate = overrides.surveyDate; }
    if (overrides.surveyorName !== undefined) { cloned.surveyor_name = overrides.surveyorName; json.surveyorName = overrides.surveyorName; }
    if (overrides.surveyorCode !== undefined) { cloned.surveyor_code = overrides.surveyorCode; json.surveyorCode = overrides.surveyorCode; }
    if (overrides.zoneAdminName !== undefined) { cloned.zone_admin_name = overrides.zoneAdminName; json.zoneAdminName = overrides.zoneAdminName; }
    if (overrides.buildingName !== undefined) { cloned.building_name = overrides.buildingName; json.buildingName = overrides.buildingName; }
    if (overrides.ownerName !== undefined) { cloned.owner_name = overrides.ownerName; json.ownerName = overrides.ownerName; }
    if (overrides.ownerPhone !== undefined) { cloned.owner_phone = overrides.ownerPhone; json.ownerPhone = overrides.ownerPhone; }
    if (overrides.houseNumber !== undefined) { cloned.house_number = overrides.houseNumber; json.houseNumber = overrides.houseNumber; }
    if (overrides.street !== undefined) { cloned.street = overrides.street; json.street = overrides.street; }
    if (overrides.usageFunction !== undefined) json.usageFunction = overrides.usageFunction;
    if (overrides.aboveFloors !== undefined) json.aboveFloors = Number(overrides.aboveFloors);
    if (overrides.undergroundFloors !== undefined) json.undergroundFloors = Number(overrides.undergroundFloors);
    if (overrides.constructionYear !== undefined) json.constructionYear = overrides.constructionYear;
    if (overrides.isEstimatedYear !== undefined) json.isEstimatedYear = Boolean(overrides.isEstimatedYear);
    if (overrides.constructionAreaM2 !== undefined) json.constructionAreaM2 = overrides.constructionAreaM2;
    if (overrides.buildingHeightM !== undefined) json.buildingHeightM = overrides.buildingHeightM;
    if (overrides.structureSystem !== undefined) json.structureSystem = overrides.structureSystem;

    // 2. Metro & Tọa độ
    if (overrides.chainage !== undefined) json.chainage = overrides.chainage;
    if (overrides.metroOffsetDistance !== undefined) json.metroOffsetDistance = overrides.metroOffsetDistance;
    if (overrides.surveyCaseType !== undefined) json.surveyCaseType = overrides.surveyCaseType;
    if (overrides.objectGroup !== undefined) json.objectGroup = overrides.objectGroup;

    // 3. Nền móng
    if (overrides.foundationType !== undefined) json.foundationType = overrides.foundationType;
    if (overrides.foundationSource !== undefined) json.foundationSource = overrides.foundationSource;
    if (overrides.foundationDepthM !== undefined) json.foundationDepthM = overrides.foundationDepthM;
    if (overrides.pileDimensionMm !== undefined) json.pileDimensionMm = overrides.pileDimensionMm;
    if (overrides.pileLengthMm !== undefined) json.pileLengthMm = overrides.pileLengthMm;
    if (overrides.foundationCatScore !== undefined) json.foundationCatScore = Number(overrides.foundationCatScore);
    if (overrides.foundationNotes !== undefined) json.foundationNotes = overrides.foundationNotes;

    // 4. Công trình liền kề & Hạn chế tiếp cận
    if (overrides.adjacentBuildings !== undefined) json.adjacentBuildings = { ...json.adjacentBuildings, ...overrides.adjacentBuildings };
    if (overrides.accessLimitation !== undefined) json.accessLimitation = { ...json.accessLimitation, ...overrides.accessLimitation };
    if (overrides.historyInterview !== undefined) json.historyInterview = { ...json.historyInterview, ...overrides.historyInterview };

    // 5. Biến dạng & Lún nghiêng
    if (overrides.settlementTilt !== undefined) json.settlementTilt = { ...json.settlementTilt, ...overrides.settlementTilt };

    // 6. Burland & Cờ kết cấu
    if (overrides.burlandSummary !== undefined) json.burlandSummary = { ...json.burlandSummary, ...overrides.burlandSummary };
    if (overrides.structuralDefectFlag !== undefined) json.structuralDefectFlag = overrides.structuralDefectFlag;
    if (overrides.requiresStructuralReview !== undefined) json.requiresStructuralReview = Boolean(overrides.requiresStructuralReview);

    // 7. ECS & VI (Ưu tiên tuyệt đối ghi đè lên json.ecs và json.riskScores)
    if (overrides.ecs !== undefined) {
      json.ecs = { ...(json.ecs || {}), ...overrides.ecs };
      if (!json.riskScores) json.riskScores = {};
      if (overrides.ecs.totalEcs !== undefined) json.riskScores.totalEcsScore = Number(overrides.ecs.totalEcs);
      if (overrides.ecs.ecsClass !== undefined) json.riskScores.ecsClass = overrides.ecs.ecsClass;
      if (overrides.ecs.e1 !== undefined) json.riskScores.ecsE1 = Number(overrides.ecs.e1);
      if (overrides.ecs.e2 !== undefined) json.riskScores.ecsE2 = Number(overrides.ecs.e2);
      if (overrides.ecs.e3 !== undefined) json.riskScores.ecsE3 = Number(overrides.ecs.e3);
      if (overrides.ecs.e4 !== undefined) json.riskScores.ecsE4 = Number(overrides.ecs.e4);
      if (overrides.ecs.e5 !== undefined) json.riskScores.ecsE5 = Number(overrides.ecs.e5);
      if (overrides.ecs.e6 !== undefined) json.riskScores.ecsE6 = Number(overrides.ecs.e6);
    }
    if (overrides.vi !== undefined) {
      json.vi = { ...(json.vi || {}), ...overrides.vi };
      if (!json.riskScores) json.riskScores = {};
      if (overrides.vi.viAvg !== undefined) json.riskScores.avgViScore = Number(overrides.vi.viAvg);
      if (overrides.vi.viClass !== undefined) json.riskScores.viClass = overrides.vi.viClass;
    }

    // 8. Floors & Sổ khuyết tật
    if (overrides.floors && Array.isArray(overrides.floors)) json.floors = overrides.floors;

    // 9. BRA & Dự báo
    if (overrides.bra !== undefined) {
      json.bra = { ...(json.bra || {}), ...overrides.bra };
      if (!json.riskScores) json.riskScores = {};
      if (overrides.bra.buildingRiskBra !== undefined) json.riskScores.buildingRiskAssessmentBra = overrides.bra.buildingRiskBra;
      if (overrides.bra.constructionImpactLevel !== undefined) json.riskScores.constructionImpactLevelI = Number(overrides.bra.constructionImpactLevel);
      if (!json.executiveSummary) json.executiveSummary = {};
      if (overrides.bra.buildingRiskBra !== undefined) json.executiveSummary.braStatus = overrides.bra.buildingRiskBra;
      if (overrides.bra.constructionImpactLevel !== undefined) json.executiveSummary.constructionImpactStatus = `I${overrides.bra.constructionImpactLevel}`;
    }

    // 10. Kết luận, Kiến nghị, Ý kiến chủ hộ & Gate
    if (!json.executiveSummary) json.executiveSummary = {};
    if (overrides.summaryConclusions !== undefined) {
      cloned.summary_conclusions = overrides.summaryConclusions;
      json.executiveSummary.keyRisksDefectsText = overrides.summaryConclusions;
      json.executiveSummary.summaryConclusionsText = overrides.summaryConclusions;
    }
    if (overrides.engineeringRecommendations !== undefined) {
      cloned.engineering_recommendations = overrides.engineeringRecommendations;
      json.executiveSummary.specificRecommendationsText = overrides.engineeringRecommendations;
    }
    if (overrides.ownerRemarks !== undefined) {
      cloned.owner_remarks = overrides.ownerRemarks;
      json.ownerRemarks = overrides.ownerRemarks;
      if (!json.signatures) json.signatures = {};
      json.signatures.ownerFeedback = overrides.ownerRemarks;
    }
    if (overrides.gateDecision !== undefined) json.gateDecision = { ...json.gateDecision, ...overrides.gateDecision };

    // 11. Đồng bộ sang buildingSpecs (nếu generator đọc từ buildingSpecs)
    if (!cloned.buildingSpecs) cloned.buildingSpecs = {};
    const specs = cloned.buildingSpecs;
    if (overrides.structureSystem !== undefined) specs.structural_system = overrides.structureSystem;
    if (overrides.foundationType !== undefined) specs.foundation_category = overrides.foundationType;
    if (overrides.foundationDepthM !== undefined) specs.foundation_depth_m = overrides.foundationDepthM;
    if (overrides.foundationNotes !== undefined) specs.foundation_notes = overrides.foundationNotes;
    if (overrides.foundationSource !== undefined) specs.foundation_source = overrides.foundationSource;
    if (overrides.constructionYear !== undefined) specs.year_of_construction = overrides.constructionYear;
    if (overrides.isEstimatedYear !== undefined) specs.is_year_estimated = Boolean(overrides.isEstimatedYear);
    if (overrides.constructionAreaM2 !== undefined) specs.construction_area_m2 = overrides.constructionAreaM2;
    if (overrides.buildingHeightM !== undefined) specs.building_height_m = overrides.buildingHeightM;
    if (overrides.aboveFloors !== undefined) specs.floor_count = Number(overrides.aboveFloors);
    if (overrides.undergroundFloors !== undefined) specs.basement_count = Number(overrides.undergroundFloors);
    if (overrides.usageFunction !== undefined) specs.land_use_function = overrides.usageFunction;
    if (overrides.buildingName !== undefined) specs.building_name = overrides.buildingName;

    // 12. Đồng bộ sang riskScores (Ưu tiên tuyệt đối các chỉ số đã chỉnh sửa)
    if (!cloned.riskScores) cloned.riskScores = {};
    const rs = cloned.riskScores;
    if (overrides.ecs?.totalEcs !== undefined) rs.total_ecs_score = Number(overrides.ecs.totalEcs);
    if (overrides.ecs?.ecsClass !== undefined) rs.ecs_class = overrides.ecs.ecsClass;
    if (overrides.ecs?.e1 !== undefined) rs.e1_burland_score = Number(overrides.ecs.e1);
    if (overrides.ecs?.e2 !== undefined) rs.e2_structure_score = Number(overrides.ecs.e2);
    if (overrides.ecs?.e3 !== undefined) rs.e3_non_structure_score = Number(overrides.ecs.e3);
    if (overrides.ecs?.e4 !== undefined) rs.e4_material_score = Number(overrides.ecs.e4);
    if (overrides.ecs?.e5 !== undefined) rs.e5_renovation_score = Number(overrides.ecs.e5);
    if (overrides.ecs?.e6 !== undefined) rs.e6_foundation_score = Number(overrides.ecs.e6);
    if (overrides.ecs?.engineeringJudgement?.action !== undefined) {
      rs.is_engineering_judgement_applied = overrides.ecs.engineeringJudgement.action !== 'KEEP';
      rs.engineering_judgement_action = overrides.ecs.engineeringJudgement.action;
      rs.engineering_judgement_reason = overrides.ecs.engineeringJudgement.reason || '';
    }
    if (overrides.vi?.viAvg !== undefined) rs.avg_vi_score = Number(overrides.vi.viAvg);
    if (overrides.vi?.viClass !== undefined) rs.vi_class = overrides.vi.viClass;
    if (overrides.burlandSummary?.predominantGrade !== undefined) rs.e1_burland_score = Number(overrides.burlandSummary.predominantGrade);
    if (overrides.bra?.buildingRiskBra !== undefined) rs.building_risk_assessment_bra = overrides.bra.buildingRiskBra;
    if (overrides.bra?.constructionImpactLevel !== undefined) rs.construction_impact_level_i = Number(overrides.bra.constructionImpactLevel);

    // 13. Đồng bộ sang deformation
    if (!cloned.deformation) cloned.deformation = {};
    const df = cloned.deformation;
    if (overrides.settlementTilt?.buildingTilt?.xPermille !== undefined) df.tilt_angle_x = Number(overrides.settlementTilt.buildingTilt.xPermille);
    if (overrides.settlementTilt?.buildingTilt?.yPermille !== undefined) df.tilt_angle_y = Number(overrides.settlementTilt.buildingTilt.yPermille);
    if (overrides.settlementTilt?.beamSagging?.sagMm !== undefined) df.beam_deflection_mm = Number(overrides.settlementTilt.beamSagging.sagMm);

    return cloned;
  }

  /**
   * Xuất Báo cáo Hiện trạng Nhà Dân cư độc lập ra PDF buffer
   */
  static async generateResidentialPdf(reportId: string, overrides?: any): Promise<{
    pdfBuffer: Buffer;
    reportCode: string;
    checksum?: string;
    viewModel: any;
  }> {
    let rawReport = await SurveyRepository.findReportById(reportId);
    if (!rawReport) {
      const p = await SurveyRepository.findLatestPhase1ReportByParcelId(reportId);
      rawReport = p?.report || p;
    }
    if (!rawReport) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }

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
    let rawReport = await SurveyRepository.findReportById(reportId);
    if (!rawReport) {
      const p = await SurveyRepository.findLatestPhase1ReportByParcelId(reportId);
      rawReport = p?.report || p;
    }
    if (!rawReport) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }

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
  static async previewResidentialHtml(reportId: string, overrides?: any): Promise<string> {
    let rawReport = await SurveyRepository.findReportById(reportId);
    if (!rawReport) {
      const p = await SurveyRepository.findLatestPhase1ReportByParcelId(reportId);
      rawReport = p?.report || p;
    }
    if (!rawReport) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }

    // Áp dụng overrides nếu có (in-memory, không lưu DB)
    const activeReport = ReportService.applyOverridesToReport(rawReport, overrides);

    const viewModel = ResidentialReportGenerator.buildViewModel(activeReport);
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
    let rawReport = await SurveyRepository.findReportById(reportId);
    if (!rawReport) {
      const p = await SurveyRepository.findLatestPhase1ReportByParcelId(reportId);
      rawReport = p?.report || p;
    }
    if (!rawReport) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
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
    let rawReport = await SurveyRepository.findReportById(reportId);
    if (!rawReport) {
      const p = await SurveyRepository.findLatestPhase1ReportByParcelId(reportId);
      rawReport = p?.report || p;
    }
    if (!rawReport) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }
    return rawReport;
  }
}
