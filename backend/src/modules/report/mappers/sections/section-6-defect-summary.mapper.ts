/**
 * ============================================================================
 * SECTION 6 MAPPER: DEFECT INVESTIGATION SUMMARY & BCS CHECKLIST
 * Chương VI: Tóm tắt điều tra lỗi & Danh mục 8 nhóm BCS Checklist
 * ============================================================================
 */

import {
  Section6DefectSummary,
  FloorPlanDefectReport,
  FloorDefectSummaryRow,
} from '../../report.types';

export interface Section6Result {
  section6: Section6DefectSummary;
  allDefectRows: FloorDefectSummaryRow[];
  structuralCracksCount: number;
  surfaceCracksCount: number;
  maxCrackWidthMm: string;
  maxCrackLengthM: string;
}

export class Section6DefectSummaryMapper {
  public static map(
    appendix2: FloorPlanDefectReport[],
    rawReport: any,
    json: any
  ): Section6Result {
    const allDefectRows = appendix2.flatMap((f) => f.defectSummaryRows);

    const isStructuralDefect = (d: FloorDefectSummaryRow): boolean =>
      d.location.vi.includes('Cấu kiện') ||
      d.defectType.vi.toLowerCase().includes('cột') ||
      d.defectType.vi.toLowerCase().includes('dầm') ||
      d.defectType.vi.toLowerCase().includes('sàn') ||
      d.defectType.vi.toLowerCase().includes('kết cấu');

    const isMoistureDefect = (d: FloorDefectSummaryRow): boolean =>
      !isStructuralDefect(d) &&
      (d.defectType.vi.toLowerCase().includes('thấm') ||
       d.defectType.vi.toLowerCase().includes('ẩm') ||
       (d.widthMm === '–' &&
        (d.description.vi.toLowerCase().includes('ẩm') ||
         d.description.vi.toLowerCase().includes('thấm'))));

    const isMasonryPlasterCrack = (d: FloorDefectSummaryRow): boolean =>
      !isStructuralDefect(d) && !isMoistureDefect(d) && d.widthMm !== '–';

    const structuralDefects = allDefectRows.filter(isStructuralDefect);
    const moistureDefects = allDefectRows.filter(isMoistureDefect);
    const masonryPlasterCracks = allDefectRows.filter(isMasonryPlasterCrack);
    const spallingAndOtherDefects = allDefectRows.filter(
      (d) => !isStructuralDefect(d) && !isMoistureDefect(d) && !isMasonryPlasterCrack(d)
    );

    const surfaceCracksCount = masonryPlasterCracks.length;
    const structuralCracksCount = structuralDefects.length;
    const floorsWithDefects = appendix2.filter((f) => f.hasDefects);

    const crackWidths = allDefectRows
      .filter((d) => d.widthMm !== '–')
      .map((d) => parseFloat(String(d.widthMm).replace(/[^\d.]/g, '')))
      .filter((w) => !isNaN(w) && w > 0);
    const savedMaxCrackW = json?.burlandSummary?.maxCrackWidthMm ?? json?.defectSummary?.maxCrackWidthMm;
    const maxCrackWidthMm =
      savedMaxCrackW !== undefined && savedMaxCrackW !== null && savedMaxCrackW !== ''
        ? String(savedMaxCrackW)
        : crackWidths.length > 0 ? `${Math.max(...crackWidths)}` : '0.0';

    const crackLengths = allDefectRows
      .filter((d) => d.lengthM !== '–')
      .map((d) => parseFloat(String(d.lengthM).replace(/[^\d.]/g, '')))
      .filter((l) => !isNaN(l) && l > 0);
    const savedMaxCrackL = json?.burlandSummary?.maxCrackLengthM ?? json?.defectSummary?.maxCrackLengthM;
    const maxCrackLengthM =
      savedMaxCrackL !== undefined && savedMaxCrackL !== null && savedMaxCrackL !== ''
        ? String(savedMaxCrackL)
        : crackLengths.length > 0 ? `${Math.max(...crackLengths)}` : '0.0';

    const crackRows = allDefectRows.filter((d) => d.widthMm !== '–');
    let governingDefect: any = undefined;
    if (crackRows.length > 0) {
      let maxRow = crackRows[0];
      let maxVal = parseFloat(String(maxRow.widthMm).replace(/[^\d.]/g, '')) || 0;
      for (const r of crackRows) {
        const val = parseFloat(String(r.widthMm).replace(/[^\d.]/g, '')) || 0;
        if (val > maxVal) { maxVal = val; maxRow = r; }
      }
      governingDefect = {
        code: maxRow.defectId,
        location: maxRow.location,
        type: maxRow.defectType,
        wmaxMm: maxRow.widthMm,
        lengthM: maxRow.lengthM,
        status: {
          vi: maxRow.description.vi.includes('Phương') ? maxRow.description.vi : 'Hiện trạng ổn định',
          en: 'Currently stable',
        },
      };
    }

    const floorDistribution = appendix2.map((fl) => {
      const flDefs = fl.defectSummaryRows;
      const flStruct = flDefs.filter(isStructuralDefect);
      const flMoist = flDefs.filter(isMoistureDefect);
      const flMasonry = flDefs.filter(isMasonryPlasterCrack);
      const flSpallAndOther = flDefs.filter(
        (d) => !isStructuralDefect(d) && !isMoistureDefect(d) && !isMasonryPlasterCrack(d)
      );

      const flCrackWidths = flDefs
        .filter((d) => d.widthMm !== '–')
        .map((d) => parseFloat(String(d.widthMm).replace(/[^\d.]/g, '')))
        .filter((w) => !isNaN(w) && w > 0);
      const flMaxW = flCrackWidths.length > 0 ? `${Math.max(...flCrackWidths)} mm` : '–';

      let statusVi = 'Không';
      let statusEn = 'None';
      if (flDefs.length > 0) {
        const partsVi: string[] = [];
        const partsEn: string[] = [];
        if (flStruct.length > 0) { partsVi.push(`${flStruct.length} nứt kết cấu (wmax = ${flMaxW})`); partsEn.push(`${flStruct.length} structural crack(s)`); }
        if (flMasonry.length > 0) { partsVi.push(`${flMasonry.length} nứt tường/vữa (wmax = ${flMaxW})`); partsEn.push(`${flMasonry.length} masonry crack(s)`); }
        if (flMoist.length > 0) { partsVi.push(`${flMoist.length} vị trí ẩm mốc/thấm`); partsEn.push(`${flMoist.length} dampness spot(s)`); }
        if (flSpallAndOther.length > 0) { partsVi.push(`${flSpallAndOther.length} bong rộp & khác`); partsEn.push(`${flSpallAndOther.length} spalling & other`); }
        statusVi = partsVi.join(', ');
        statusEn = partsEn.join(', ');
      }

      return {
        floorName: fl.floorName,
        surveyedObjectsCount: fl.zoneAndElementConditions.length,
        structuralCracksCount: flStruct.length,
        masonryPlasterCracksCount: flMasonry.length,
        moistureCount: flMoist.length,
        spallingCount: flSpallAndOther.length,
        maxCrackWidthMm: flMaxW,
        conditionStatus: { vi: statusVi, en: statusEn },
      };
    });

    const deformInit = json.settlementTilt || rawReport.deformation || {};
    const hasDeform = (deformInit.buildingTilt?.level ?? 0) > 0 ||
      (deformInit.diffSettlement?.level ?? 0) > 0 ||
      Boolean(deformInit.diffSettlement?.notes?.trim()) ||
      (deformInit.beamSagging?.level ?? 0) > 0 ||
      Boolean(deformInit.beamSagging?.sagMm && Number(deformInit.beamSagging.sagMm) > 0);

    const summarizeLoc = (rows: FloorDefectSummaryRow[], unitVi: string, unitEn: string) => ({
      vi: rows.length > 0 ? `${rows.length} ${unitVi} tại ${Array.from(new Set(rows.map((d) => d.location.vi.split(' - ')[0]))).join(', ')}` : 'Không',
      en: rows.length > 0 ? `${rows.length} ${unitEn} at ${Array.from(new Set(rows.map((d) => d.location.en.split(' - ')[0]))).join(', ')}` : 'None',
    });

    const structLoc = summarizeLoc(structuralDefects, 'vết nứt', 'crack(s)');
    const masonryLoc = summarizeLoc(masonryPlasterCracks, 'vết nứt', 'crack(s)');
    const moistureLoc = summarizeLoc(moistureDefects, 'vị trí ẩm mốc/thấm', 'spot(s)');
    const spallingLoc = summarizeLoc(spallingAndOtherDefects, 'vị trí bong rộp/khác', 'spot(s)');

    const hasCrazing = masonryPlasterCracks.some((d) => d.defectType.vi.toLowerCase().includes('chân chim') || d.defectType.vi.toLowerCase().includes('mạng nhện'));
    const hasSpalling = spallingAndOtherDefects.some((d) => d.defectType.vi.toLowerCase().includes('bong') || d.defectType.vi.toLowerCase().includes('rộp') || d.defectType.vi.toLowerCase().includes('tróc') || d.defectType.vi.toLowerCase().includes('gạch'));
    const hasRebarCorrosion = allDefectRows.some((d) => d.defectType.vi.toLowerCase().includes('rỉ') || d.defectType.vi.toLowerCase().includes('lộ thép') || d.defectType.vi.toLowerCase().includes('trơ thép'));
    const hasMechanical = allDefectRows.some((d) => d.defectType.vi.toLowerCase().includes('kẹt') || d.defectType.vi.toLowerCase().includes('cửa') || d.defectType.vi.toLowerCase().includes('hư hỏng'));

    const totalSurveyedObjects = floorDistribution.reduce((acc, f) => acc + f.surveyedObjectsCount, 0);
    const maxCrackWidthDisplay = maxCrackWidthMm !== '0.0' && maxCrackWidthMm !== '--' ? `${maxCrackWidthMm} mm` : '–';

    const section6: Section6DefectSummary = {
      totalDefects: allDefectRows.length,
      totalFloors: appendix2.length,
      floorsWithDefectsCount: floorsWithDefects.length,
      structuralCracksCount,
      masonryPlasterCracksCount: surfaceCracksCount,
      moistureDefectsCount: moistureDefects.length,
      spallingDefectsCount: spallingAndOtherDefects.length,
      otherDefectsCount: 0,
      totalSurveyedObjects,
      maxCrackWidthMm,
      totalMaxCrackWidthDisplay: maxCrackWidthDisplay,
      maxCrackLengthM,
      governingDefect,
      floorDistribution,
      checklist: [
        {
          groupVi: 'Nứt', groupEn: 'Cracking',
          indicatorVi: 'Nứt cấu kiện kết cấu chịu lực (Cột/Dầm/Sàn)',
          indicatorEn: 'Cracks in structural members (columns/beams/slabs)',
          recorded: structuralCracksCount > 0,
          recordedLabel: structuralCracksCount > 0 ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: structuralCracksCount > 0 ? structLoc : { vi: 'Không', en: 'None' },
          riskLevel: structuralCracksCount > 0 ? { vi: 'Trung bình / Theo dõi', en: 'Medium / Monitor' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Nứt', groupEn: 'Cracking',
          indicatorVi: 'Nứt tường gạch / Khối xây chèn',
          indicatorEn: 'Cracks in masonry / infill walls',
          recorded: masonryPlasterCracks.length > 0,
          recordedLabel: masonryPlasterCracks.length > 0 ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: masonryPlasterCracks.length > 0 ? masonryLoc : { vi: 'Không', en: 'None' },
          riskLevel: masonryPlasterCracks.length > 0 ? { vi: 'Thấp / Thẩm mỹ', en: 'Low / Aesthetic' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Nứt', groupEn: 'Cracking',
          indicatorVi: 'Nứt lớp vữa trát / Lớp hoàn thiện kiến trúc',
          indicatorEn: 'Cracks in plaster / surface finishes',
          recorded: hasCrazing,
          recordedLabel: hasCrazing ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: hasCrazing ? { vi: 'Nứt rạn chân chim lớp vữa trát tường kiến trúc', en: 'Hairline crazing cracks in architectural plaster' } : { vi: 'Không', en: 'None' },
          riskLevel: hasCrazing ? { vi: 'Thấp', en: 'Low' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Nước', groupEn: 'Water',
          indicatorVi: 'Thấm nước / Rò rỉ / Ẩm mốc loang lổ',
          indicatorEn: 'Water seepage, dampness & efflorescence',
          recorded: moistureDefects.length > 0,
          recordedLabel: moistureDefects.length > 0 ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: moistureDefects.length > 0 ? moistureLoc : { vi: 'Không', en: 'None' },
          riskLevel: moistureDefects.length > 0 ? { vi: 'Thấp / Hoàn thiện', en: 'Low / Finish' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Suy giảm', groupEn: 'Deterioration',
          indicatorVi: 'Bong rộp sơn vôi / Phồng rộp gạch ốp lát',
          indicatorEn: 'Blistering of paint & spalling tiles',
          recorded: hasSpalling,
          recordedLabel: hasSpalling ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: hasSpalling ? spallingLoc : { vi: 'Không', en: 'None' },
          riskLevel: hasSpalling ? { vi: 'Thấp', en: 'Low' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Suy giảm', groupEn: 'Deterioration',
          indicatorVi: 'Rỉ cốt thép / Vỡ trơ cốt thép chịu lực',
          indicatorEn: 'Rebar corrosion & concrete spalling',
          recorded: hasRebarCorrosion,
          recordedLabel: hasRebarCorrosion ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: hasRebarCorrosion ? { vi: 'Ghi nhận rỉ sét cốt thép / vỡ trơ cốt thép', en: 'Rebar corrosion / concrete spalling observed' } : { vi: 'Không', en: 'None' },
          riskLevel: hasRebarCorrosion ? { vi: 'Cao', en: 'High' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Biến dạng', groupEn: 'Deformation',
          indicatorVi: 'Biến dạng hình học (Nghiêng, lún chênh, võng)',
          indicatorEn: 'Tilt, differential settlement & deflection',
          recorded: hasDeform,
          recordedLabel: hasDeform ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: hasDeform ? { vi: 'Ghi nhận biến dạng đo đạc tại hiện trường (chi tiết Mục V)', en: 'Measured deformation recorded on site (see Section V)' } : { vi: 'Không', en: 'None' },
          riskLevel: hasDeform ? { vi: 'Trung bình', en: 'Medium' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Hư hỏng', groupEn: 'Damage',
          indicatorVi: 'Hư hỏng cơ học & Kẹt cửa đi / Cửa sổ',
          indicatorEn: 'Mechanical damage & sticking doors/windows',
          recorded: hasMechanical,
          recordedLabel: hasMechanical ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: hasMechanical ? { vi: 'Ghi nhận hiện tượng kẹt cửa / hư hỏng cơ học', en: 'Sticking doors / mechanical damage observed' } : { vi: 'Không', en: 'None' },
          riskLevel: hasMechanical ? { vi: 'Thấp', en: 'Low' } : { vi: 'Không', en: 'None' },
        },
      ],
      notes: {
        vi: `Tổng hợp ghi nhận ${allDefectRows.length} khuyết tật trên ${appendix2.length} tầng khảo sát (${structuralCracksCount} nứt kết cấu, ${surfaceCracksCount} nứt tường/vữa, ${moistureDefects.length} vị trí ẩm mốc, ${spallingAndOtherDefects.length} vị trí bong rộp & khác). Các không gian khảo sát (vùng Z) và cấu kiện chịu lực (cột/dầm E) được định vị trên sơ đồ mặt bằng; các khuyết tật nứt được kiểm tra thông số và lưu trữ hồ sơ đối chiếu tại Phụ lục 2.`,
        en: `A total of ${allDefectRows.length} defects recorded across ${appendix2.length} surveyed floors (${structuralCracksCount} structural cracks, ${surfaceCracksCount} masonry cracks, ${moistureDefects.length} dampness spots, ${spallingAndOtherDefects.length} spalling & other spots). Surveyed zones (Z) and structural elements (E) are mapped on floor plans; crack defects are measured and archived in Appendix 2.`,
      },
      discrepancyNote: {
        vi: 'Khảo sát hiện trường đã kiểm tra toàn bộ bề mặt kiến trúc và cấu kiện kết cấu theo danh mục BCS Checklist.',
        en: 'Field survey inspected all architectural surfaces and structural members per the BCS Checklist.',
      },
      crackQuantities: {
        totalCracks: allDefectRows.length,
        maxCrackWidthMm,
        maxCrackLengthM,
      },
    };

    return {
      section6,
      allDefectRows,
      structuralCracksCount,
      surfaceCracksCount,
      maxCrackWidthMm,
      maxCrackLengthM,
    };
  }
}

