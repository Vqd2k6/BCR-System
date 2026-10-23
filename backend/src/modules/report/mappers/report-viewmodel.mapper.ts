/**
 * ============================================================================
 * REPORT VIEWMODEL MAPPER (ORCHESTRATOR — READ-ONLY / ZERO CALCULATE)
 * Nạp toàn bộ dữ liệu CSDL / JSON Snapshot -> ReportViewModel chuẩn 100%.
 * Đã refactor thành mô hình điều phối phân lớp (Modularized Domain Mappers).
 * ============================================================================
 */

import { ReportViewModel } from '../report.types';
import { formatDateVi, formatWatermarkDateTime, extractPhotoDateTime } from './formatters.mapper';
import { MetadataMapper } from './sections/metadata-and-cover.mapper';
import { Section1And2Mapper } from './sections/section-1-2-overview-spatial.mapper';
import { Section3And4Mapper, Section5DeformationMapper } from './sections/section-3-4-5-structure-history-deform.mapper';
import { Section6DefectSummaryMapper } from './sections/section-6-defect-summary.mapper';
import { Section7BurlandMapper } from './sections/section-7-burland.mapper';
import { Section8RiskAssessmentMapper } from './sections/section-8-risk-assessment.mapper';
import { Section9ConclusionMapper } from './sections/section-9-conclusions-monitoring.mapper';
import { Appendix1PhotoMapper } from './appendices/appendix-1-photos.mapper';
import { FloorDefectMapper } from './appendices/appendix-2/floor-defect.mapper';
import { Appendix3And4Mapper } from './appendices/appendix-3-4-records.mapper';
import { ScenarioFlagsAndTocMapper } from './sections/scenario-flags-and-toc.mapper';
import type { ReportContentConfig } from '../../report_config/report-config.types';

export { formatDateVi, formatWatermarkDateTime, extractPhotoDateTime };

export class ReportViewModelMapper {
  public static buildViewModel(rawReport: any, overrides?: any, config?: ReportContentConfig): ReportViewModel {
    const json = rawReport.survey_data_json || {};
    const specs = { ...(rawReport.buildingSpecs || {}), ...json };
    const deform = { ...(rawReport.deformation || {}), ...(json.settlementTilt || {}) };
    const identPhotos = rawReport.identificationPhotos || [];

    const defaultLat = json.gpsCoords?.lat ? Number(json.gpsCoords.lat) : 10.7769;
    const defaultLng = json.gpsCoords?.lng ? Number(json.gpsCoords.lng) : 106.7009;

    const rawSurveyDate =
      json.surveyDate ||
      rawReport.survey_date ||
      json.signatures?.preparedBy?.date ||
      json.signatures?.ownerRepresentative?.date ||
      rawReport.created_at;
    const surveyDateFormatted = formatDateVi(rawSurveyDate) || '';
    const surveyDateWithTime = formatDateVi(rawSurveyDate, true) || surveyDateFormatted;
    const watermarkDateTime = formatWatermarkDateTime(rawSurveyDate) || surveyDateWithTime || surveyDateFormatted;

    // 1. Metadata & Chữ ký 2 bên (KSV + Zone Admin)
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

    // 3. Phụ lục 2: Map tầng & Gom khuyết tật
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

    // 7. Chương VII: Phân loại Burland 1977 (Đọc 1:1 từ dữ liệu đã chốt)
    const section7 = Section7BurlandMapper.map(rawFloors, json.burlandSummary);

    // 8. Chương VIII: Đánh giá rủi ro & BRA (Đọc 1:1 từ dữ liệu đã chốt)
    const burlandMaxNum = (json.burlandSummary?.localMaxGrade !== undefined && json.burlandSummary?.localMaxGrade !== null && !isNaN(Number(json.burlandSummary.localMaxGrade)))
      ? Number(json.burlandSummary.localMaxGrade)
      : null;
    const burlandPredominantNum = (json.burlandSummary?.predominantGrade !== undefined && json.burlandSummary?.predominantGrade !== null && !isNaN(Number(json.burlandSummary.predominantGrade)))
      ? Number(json.burlandSummary.predominantGrade)
      : null;
    const section8 = Section8RiskAssessmentMapper.map(
      rawReport,
      burlandMaxNum,
      burlandPredominantNum
    );

    // 9. Chương IX: Kết luận & Kiến nghị kỹ thuật
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

    // 11. Phụ lục 3 & 4: Biên bản hiện trường scan & Thiết bị tiếp cận
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
    const section12AsBuilt = Appendix3And4Mapper.mapSection12AsBuilt(rawReport, json);
    const appendix4 = Appendix3And4Mapper.mapAppendix4(appendix1, appendix2, rawReport, json, config);

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

