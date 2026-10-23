/**
 * ============================================================================
 * SCENARIO FLAGS & DYNAMIC TOC BUDGET MAPPER
 * Bộ cờ kịch bản thích ứng (N chập K) và phân bổ số trang / mục lục
 * ============================================================================
 */

import {
  ReportScenarioFlags,
  TocPageNumbers,
  ReportMetadata,
  FloorPlanDefectReport,
  Appendix1PhotoPage,
  Appendix3SignedRecord,
  Section12AsBuiltReport,
} from '../../report.types';

import { ScenarioResolver } from '../scenario-resolver';

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
    const resolved = ScenarioResolver.resolve(
      json,
      rawReport,
      appendix2,
      p02Url,
      p03List,
      singleP03Url,
      p05Url
    );

    return ScenarioResolver.toScenarioFlags(
      resolved,
      Boolean(p02Url),
      p03List.length > 0 || Boolean(singleP03Url),
      Boolean(p05Url),
      appendix2.some((f) => f.hasStructuralCadMap),
      appendix2.some((f) => f.hasDefects)
    );
  }

  public static calculateTocPageNumbers(
    metadata: ReportMetadata,
    appendix1Pages: Appendix1PhotoPage[],
    appendix2: FloorPlanDefectReport[],
    appendix3: Appendix3SignedRecord,
    section12AsBuilt?: Section12AsBuiltReport
  ): TocPageNumbers {
    const appendix1PageCount = appendix1Pages?.length || 1;
    const pageSectionX = 9;
    const sectionXIPageCount = 1 + (appendix3.signedRecordPages?.length || 0);
    const pageSectionXI = pageSectionX + appendix1PageCount;

    const section12PageCount = section12AsBuilt?.hasDrawings ? (section12AsBuilt.sheets?.length || 0) : 0;
    const pageSectionXII = section12PageCount > 0 ? (pageSectionXI + sectionXIPageCount) : undefined;

    let pl1PageCount = 0;
    for (const fl of appendix2) {
      if (fl.hasDefects) {
        pl1PageCount += 1;
        pl1PageCount += fl.hasSeparateDefectTableSheets && fl.defectSummaryPages ? fl.defectSummaryPages.length : 0;
        pl1PageCount += fl.defectPairPages ? fl.defectPairPages.length : 0;
      }
    }
    if (pl1PageCount === 0) {
      pl1PageCount = 1;
    }

    const pagePl1 = pageSectionXI + sectionXIPageCount + section12PageCount;

    let pl2PageCount = 0;
    for (const fl of appendix2) {
      if (!fl.hasDefects) {
        pl2PageCount += 1;
      }
      pl2PageCount += fl.overviewPages ? fl.overviewPages.length : 0;
      pl2PageCount += fl.elementOverviewPages ? fl.elementOverviewPages.length : 0;
    }
    if (pl2PageCount === 0) {
      pl2PageCount = 1;
    }

    const pagePl2 = pagePl1 + pl1PageCount;
    const pagePl3 = pagePl2 + pl2PageCount;
    const totalExpectedPages = pagePl3;

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
      sectionX: pageSectionX,
      sectionXI: pageSectionXI,
      sectionXII: pageSectionXII,
      appendix1: pageSectionX,
      appendix2: pagePl1,
      appendix3: pagePl3,
      appendix4: pagePl3,
      appendix1New: pagePl1,
      appendix2New: pagePl2,
      appendix3New: pagePl3,
      pagePl1,
      pagePl2,
      pagePl3,
    };

    metadata.totalExpectedPages = totalExpectedPages;

    return tocPageNumbers;
  }
}

