/**
 * ============================================================================
 * REPORT V2 VIEWMODEL MAPPER (ORCHESTRATOR)
 * Nạp toàn bộ dữ liệu CSDL / JSON Snapshot -> ReportV2ViewModel chuẩn 100%
 * Đã refactor thành mô hình điều phối phân lớp (Modularized Domain Mappers)
 * ============================================================================
 */

import { ReportV2ViewModel } from '../report-v2.types';
import { formatDateVi, formatWatermarkDateTime, extractPhotoDateTime } from './formatters.mapper';
import { MetadataMapper } from './sections/metadata.mapper';
import { Section1And2Mapper } from './sections/section-1-2-general.mapper';
import { Section3And4Mapper } from './sections/section-3-4-structural.mapper';
import { Section5DeformationMapper } from './sections/section-5-deformation.mapper';
import { Section6DefectSummaryMapper } from './sections/section-6-defect-summary.mapper';
import { BurlandCalculator } from './burland-calculator';
import { RiskScoringCalculator } from './risk-scoring-calculator';
import { Section9ConclusionMapper } from './sections/section-9-conclusions.mapper';
import { Appendix1PhotoMapper } from './appendices/appendix-1-photos.mapper';
import { FloorDefectMapper } from './floor-defect.mapper';
import { Appendix3And4Mapper } from './appendices/appendix-3-4-records.mapper';
import { ScenarioFlagsAndTocMapper } from './sections/scenario-flags-and-toc.mapper';
import type { ReportContentConfig } from '../../report_config/report-config.types';

// Re-export helper functions để tương thích ngược 100% với các file import cũ
export { formatDateVi, formatWatermarkDateTime, extractPhotoDateTime };

export class ReportV2ViewModelMapper {
  public static buildViewModel(rawReport: any, overrides?: any, config?: ReportContentConfig): ReportV2ViewModel {
    const json = rawReport.survey_data_json || {};
    const specs = { ...(rawReport.buildingSpecs || {}), ...json };
    const deform = { ...(rawReport.deformation || {}), ...(json.settlementTilt || {}) };
    const identPhotos = rawReport.identificationPhotos || [];

    // Tọa độ GPS
    const defaultLat = json.gpsCoords?.lat ? Number(json.gpsCoords.lat) : 10.7769;
    const defaultLng = json.gpsCoords?.lng ? Number(json.gpsCoords.lng) : 106.7009;

    // Chuẩn hóa ngày khảo sát (ưu tiên json.surveyDate nếu đã được hiệu chỉnh trong thẩm định)
    const rawSurveyDate =
      json.surveyDate ||
      rawReport.survey_date ||
      json.signatures?.preparedBy?.date ||
      json.signatures?.ownerRepresentative?.date ||
      rawReport.created_at;
    const surveyDateFormatted = formatDateVi(rawSurveyDate) || '';
    const surveyDateWithTime = formatDateVi(rawSurveyDate, true) || surveyDateFormatted;
    const watermarkDateTime = formatWatermarkDateTime(rawSurveyDate) || surveyDateWithTime || surveyDateFormatted;

    // 1. Metadata & Chữ ký 3 bên
    const {
      metadata,
      signatures3Party,
      buildingId,
      surveyId,
      reportNo,
      cadastralCode,
      surveyorName,
      zoneAdminName,
    } = MetadataMapper.map(
      rawReport,
      json,
      identPhotos,
      overrides,
      surveyDateFormatted,
      watermarkDateTime,
      rawSurveyDate
    );

    // 2. Chương I (Thông tin chung) & Chương II (Thông số tòa nhà)
    const {
      section1,
      section2,
      rawFoundDepth,
    } = Section1And2Mapper.map(
      rawReport,
      json,
      specs,
      metadata,
      buildingId,
      surveyId,
      reportNo,
      cadastralCode,
      defaultLat,
      defaultLng,
      surveyDateWithTime
    );

    // 3. Phụ lục 2: Map tầng & Gom khuyết tật (Tính toán sớm để phục vụ các chương sau)
    const rawFloors = (json.floors && Array.isArray(json.floors) && json.floors.length > 0)
      ? json.floors
      : (rawReport.floors && Array.isArray(rawReport.floors) && rawReport.floors.length > 0)
        ? rawReport.floors
        : (rawReport.floorSurveys && Array.isArray(rawReport.floorSurveys) && rawReport.floorSurveys.length > 0)
          ? rawReport.floorSurveys
          : [];

    const rotMap = json.photoRotations || rawReport.photoRotations || {};
    const appendix2 = FloorDefectMapper.mapFloors(rawFloors, { current: 5 }, buildingId, rawSurveyDate, rotMap);

    // 4. Chương VI: Tóm tắt khuyết tật & Danh mục 8 nhóm BCS checklist
    const {
      section6,
      allDefectRows,
      structuralCracksCount,
      surfaceCracksCount,
    } = Section6DefectSummaryMapper.map(appendix2, rawReport, json);

    // 5. Chương III (Lịch sử sử dụng) & Chương IV (Kết cấu & Móng)
    const { section3, section4, majorRepair } = Section3And4Mapper.map(
      rawReport,
      json,
      specs,
      structuralCracksCount,
      surfaceCracksCount,
      rawFoundDepth
    );

    // 6. Chương V: Độ nghiêng & Lún
    const section5 = Section5DeformationMapper.map(
      rawReport,
      json,
      deform,
      identPhotos,
      structuralCracksCount,
      majorRepair
    );

    // 7. Chương VII: Phân loại Burland 1977
    const section7 = BurlandCalculator.computeBurlandSection(rawFloors, json.burlandSummary);

    // 8. Chương VIII: Đánh giá rủi ro & Bổ sung giai đoạn 1 (BRA Risk Scoring)
    const burlandMaxNum = typeof section7.localMaxGrade.vi === 'string' && section7.localMaxGrade.vi.includes('Cấp 5')
      ? 5
      : typeof section7.localMaxGrade.vi === 'string' && section7.localMaxGrade.vi.includes('Cấp 4')
        ? 4
        : typeof section7.localMaxGrade.vi === 'string' && section7.localMaxGrade.vi.includes('Cấp 3')
          ? 3
          : typeof section7.localMaxGrade.vi === 'string' && section7.localMaxGrade.vi.includes('Cấp 2')
            ? 2
            : typeof section7.localMaxGrade.vi === 'string' && section7.localMaxGrade.vi.includes('Cấp 1')
              ? 1
              : 0;

    const burlandPredominantNum = typeof section7.predominantGrade.vi === 'string' && section7.predominantGrade.vi.includes('Cấp 5')
      ? 5
      : typeof section7.predominantGrade.vi === 'string' && section7.predominantGrade.vi.includes('Cấp 4')
        ? 4
        : typeof section7.predominantGrade.vi === 'string' && section7.predominantGrade.vi.includes('Cấp 3')
          ? 3
          : typeof section7.predominantGrade.vi === 'string' && section7.predominantGrade.vi.includes('Cấp 2')
            ? 2
            : typeof section7.predominantGrade.vi === 'string' && section7.predominantGrade.vi.includes('Cấp 1')
              ? 1
              : 0;
    const isZeroDefects = allDefectRows.length === 0;
    const section8 = RiskScoringCalculator.computeRiskAssessment(
      rawReport,
      burlandMaxNum,
      burlandPredominantNum,
      isZeroDefects
    );

    // 9. Chương IX: Kết luận & Kiến nghị kỹ thuật (Đọc từ cấu hình chuẩn Q1)
    const section9 = Section9ConclusionMapper.map(
      rawReport,
      json,
      allDefectRows,
      section7,
      section8,
      specs,
      config?.standardText
    );

    // 10. Phụ lục 1: Bộ ảnh định danh ngoại thất (P-01 đến P-07)
    const {
      appendix1,
      appendix1Pages,
      p02Url,
      p03List,
      singleP03Url,
      p05Url,
    } = Appendix1PhotoMapper.map(
      rawReport,
      json,
      identPhotos,
      deform,
      buildingId,
      defaultLat,
      defaultLng,
      surveyDateFormatted,
      rawSurveyDate
    );

    // 11. Phụ lục 3 & 4: Biên bản hiện trường scan & Thiết bị tiếp cận (Đọc từ cấu hình chuẩn Q5)
    const appendix3 = Appendix3And4Mapper.mapAppendix3(
      rawReport,
      json,
      identPhotos,
      surveyDateWithTime,
      surveyDateFormatted,
      surveyorName,
      zoneAdminName,
      reportNo,
      buildingId,
      rawSurveyDate
    );
    // Mục XII (Mới): Bản vẽ thiết kế / hoàn công móng do chủ hộ cung cấp (nếu có)
    const section12AsBuilt = Appendix3And4Mapper.mapSection12AsBuilt(rawReport, json);
    const appendix4 = Appendix3And4Mapper.mapAppendix4(appendix1, appendix2, rawReport, json, config);

    // Gắn thông tin phạm vi tiếp cận khảo sát vào Mục IX theo quy chuẩn nghiệp vụ
    section9.accessAreas = appendix4.accessAreas;
    section9.accessClassification = appendix4.accessClassification;

    // 12. Bộ cờ kịch bản thích ứng & Mục lục động
    const scenarioFlags = ScenarioFlagsAndTocMapper.mapScenarioFlags(
      json,
      rawReport,
      p02Url,
      p03List,
      singleP03Url,
      p05Url,
      appendix2
    );

    const tocPageNumbers = ScenarioFlagsAndTocMapper.calculateTocPageNumbers(
      metadata,
      appendix1Pages,
      appendix2,
      appendix3,
      section12AsBuilt
    );

    return {
      metadata,
      scenarioFlags,
      tocPageNumbers,
      signatures3Party,
      section1,
      section2,
      section3,
      section4,
      section5,
      section6,
      section7,
      section8,
      section9,
      appendix1,
      appendix1Pages,
      appendix2,
      appendix3,
      section12AsBuilt,
      appendix4,
      asteriskFootnote: config?.standardText?.asteriskFootnote || null,
      standardTextVersionNumber: config?.standardTextVersionNumber || null,
    };
  }
}
