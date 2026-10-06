/**
 * ============================================================================
 * SCENARIO FLAGS & DYNAMIC TOC BUDGET MAPPER
 * Bộ cờ kịch bản thích ứng (N chập K) và tính toán động số trang / mục lục
 * ============================================================================
 */

import {
  ReportScenarioFlags,
  TocPageNumbers,
  ReportV2Metadata,
  FloorPlanDefectReport,
  Appendix1PhotoPage,
  Appendix3SignedRecord,
} from '../../report-v2.types';

export class ScenarioFlagsAndTocMapper {
  public static mapScenarioFlags(
    json: any,
    rawReport: any,
    p02Url: string | undefined,
    p03List: any[],
    singleP03Url: string | undefined,
    p05Url: string | undefined,
    appendix2: FloorPlanDefectReport[]
  ): ReportScenarioFlags {
    const hasMainFacadePhoto = Boolean(p02Url);
    const hasSideOrRearPhotos = p03List.length > 0 || Boolean(singleP03Url);
    const hasTiltPhoto = Boolean(p05Url);
    const hasStructuralCadMap = appendix2.some((f) => f.hasStructuralCadMap);
    const hasAnyDefects = appendix2.some((f) => f.hasDefects);

    const exteriorPhotoLayout: 'grid_6' | 'party_wall_3' | 'minimal_2' =
      hasSideOrRearPhotos ? 'grid_6' :
      hasMainFacadePhoto ? 'party_wall_3' : 'minimal_2';

    return {
      isAbsenteeSurvey: Boolean(json.isAbsenteeSurvey || rawReport.is_absentee_survey),
      isVacantLand: Boolean(json.isVacantLand || rawReport.is_vacant_land),
      hasMainFacadePhoto,
      hasSideOrRearPhotos,
      hasTiltPhoto,
      hasStructuralCadMap,
      hasAnyDefects,
      exteriorPhotoLayout,
    };
  }

  public static calculateTocPageNumbers(
    metadata: ReportV2Metadata,
    appendix1Pages: Appendix1PhotoPage[],
    appendix2: FloorPlanDefectReport[],
    appendix3: Appendix3SignedRecord
  ): TocPageNumbers {
    const appendix1PageCount = appendix1Pages?.length || 1;
    const pageAppendix1 = 9;
    const pageAppendix2 = pageAppendix1 + appendix1PageCount;

    let appendix2PageCount = 0;
    for (const fl of appendix2) {
      appendix2PageCount += 1; // 1 trang sơ đồ CAD + tổng hợp / xác nhận an toàn
      appendix2PageCount += fl.overviewPages ? fl.overviewPages.length : 0; // Các trang ảnh tổng thể không gian các phòng (Z)
      appendix2PageCount += fl.elementOverviewPages ? fl.elementOverviewPages.length : 0; // Các trang ảnh cấu kiện kết cấu (E)
      appendix2PageCount += fl.defectPairPages ? fl.defectPairPages.length : 0; // Các trang cặp ảnh khuyết tật
    }

    const pageAppendix3 = pageAppendix2 + appendix2PageCount;
    const appendix3PageCount = 1 + (appendix3.signedRecordPages?.length || 0);

    const pageAppendix4 = pageAppendix3 + appendix3PageCount;
    const totalExpectedPages = pageAppendix4; // Phụ lục 4 là 1 trang cuối cùng

    const tocPageNumbers: TocPageNumbers = {
      section1: 3,
      section2: 3,
      section3: 4,
      section4: 4,
      section5: 5,
      section6: 5,
      section7: 6,
      section8: 7,
      section9: 8,
      appendix1: pageAppendix1,
      appendix2: pageAppendix2,
      appendix3: pageAppendix3,
      appendix4: pageAppendix4,
    };

    metadata.totalExpectedPages = totalExpectedPages;

    return tocPageNumbers;
  }
}
