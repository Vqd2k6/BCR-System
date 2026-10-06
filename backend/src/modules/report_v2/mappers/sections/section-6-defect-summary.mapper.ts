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
} from '../../report-v2.types';

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
    // CHƯƠNG VI: TÓM TẮT ĐIỀU TRA LỖI & BCS CHECKLIST (ĐỘNG TỪ PHỤ LỤC 2 & STEP 3/4)
    const allDefectRows = appendix2.flatMap((f) => f.defectSummaryRows);

    // 1. Phân loại 4 nhóm khuyết tật chuẩn theo Step 3
    const structuralDefects = allDefectRows.filter((d) =>
      d.location.vi.includes('Cấu kiện') ||
      d.defectType.vi.toLowerCase().includes('cột') ||
      d.defectType.vi.toLowerCase().includes('dầm') ||
      d.defectType.vi.toLowerCase().includes('sàn') ||
      d.defectType.vi.toLowerCase().includes('kết cấu')
    );

    const masonryPlasterCracks = allDefectRows.filter((d) =>
      !structuralDefects.includes(d) &&
      d.widthMm !== '–'
    );

    const moistureDefects = allDefectRows.filter((d) =>
      !structuralDefects.includes(d) &&
      (d.defectType.vi.toLowerCase().includes('thấm') ||
       d.defectType.vi.toLowerCase().includes('ẩm') ||
       d.description.vi.toLowerCase().includes('ẩm') ||
       d.description.vi.toLowerCase().includes('thấm'))
    );

    const spallingAndOtherDefects = allDefectRows.filter((d) =>
      !structuralDefects.includes(d) &&
      !masonryPlasterCracks.includes(d) &&
      !moistureDefects.includes(d)
    );

    const surfaceCracksCount = masonryPlasterCracks.length;
    const structuralCracksCount = structuralDefects.length;

    const floorsWithDefects = appendix2.filter((f) => f.hasDefects);

    // Bề rộng và chiều dài lớn nhất
    const crackWidths = allDefectRows
      .filter((d) => d.widthMm !== '–')
      .map((d) => parseFloat(String(d.widthMm).replace(/[^\d.]/g, '')))
      .filter((w) => !isNaN(w) && w > 0);
    const maxCrackWidthMm = crackWidths.length > 0 ? `${Math.max(...crackWidths)}` : '0.0';

    const crackLengths = allDefectRows
      .filter((d) => d.lengthM !== '–')
      .map((d) => parseFloat(String(d.lengthM).replace(/[^\d.]/g, '')))
      .filter((l) => !isNaN(l) && l > 0);
    const maxCrackLengthM = crackLengths.length > 0 ? `${Math.max(...crackLengths)}` : '0.0';

    // Tìm khuyết tật chi phối nguy hiểm nhất (Governing Worst Defect)
    const crackRows = allDefectRows.filter((d) => d.widthMm !== '–');
    let governingDefect: any = undefined;
    if (crackRows.length > 0) {
      let maxRow = crackRows[0];
      let maxVal = parseFloat(String(maxRow.widthMm).replace(/[^\d.]/g, '')) || 0;
      for (const r of crackRows) {
        const val = parseFloat(String(r.widthMm).replace(/[^\d.]/g, '')) || 0;
        if (val > maxVal) {
          maxVal = val;
          maxRow = r;
        }
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

    // 2. Bảng VI.1: Ma trận phân bố khuyết tật theo từng tầng (Defect Distribution Matrix by Floor)
    const floorDistribution = appendix2.map((fl) => {
      const flDefs = fl.defectSummaryRows;
      const flStruct = flDefs.filter((d) =>
        d.location.vi.includes('Cấu kiện') ||
        d.defectType.vi.toLowerCase().includes('cột') ||
        d.defectType.vi.toLowerCase().includes('dầm') ||
        d.defectType.vi.toLowerCase().includes('sàn')
      );
      const flMasonry = flDefs.filter((d) => !flStruct.includes(d) && d.widthMm !== '–');
      const flMoist = flDefs.filter((d) =>
        !flStruct.includes(d) &&
        (d.defectType.vi.toLowerCase().includes('thấm') ||
         d.defectType.vi.toLowerCase().includes('ẩm') ||
         d.description.vi.toLowerCase().includes('ẩm') ||
         d.description.vi.toLowerCase().includes('thấm'))
      );
      const flSpallAndOther = flDefs.filter((d) =>
        !flStruct.includes(d) && !flMasonry.includes(d) && !flMoist.includes(d)
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
        if (flStruct.length > 0) {
          partsVi.push(`${flStruct.length} nứt kết cấu (wmax = ${flMaxW})`);
          partsEn.push(`${flStruct.length} structural crack(s)`);
        }
        if (flMasonry.length > 0) {
          partsVi.push(`${flMasonry.length} nứt tường/vữa (wmax = ${flMaxW})`);
          partsEn.push(`${flMasonry.length} masonry crack(s)`);
        }
        if (flMoist.length > 0) {
          partsVi.push(`${flMoist.length} vị trí ẩm mốc/thấm`);
          partsEn.push(`${flMoist.length} dampness spot(s)`);
        }
        if (flSpallAndOther.length > 0) {
          partsVi.push(`${flSpallAndOther.length} bong rộp & khác`);
          partsEn.push(`${flSpallAndOther.length} spalling & other`);
        }
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

    // 3. Đánh giá biến dạng từ Section 5
    const deformInit = json.settlementTilt || rawReport.deformation || {};
    const hasDeformTilt = (deformInit.buildingTilt?.level ?? 0) > 0;
    const hasDeformDiff = (deformInit.diffSettlement?.level ?? 0) > 0 || Boolean(deformInit.diffSettlement?.notes?.trim());
    const hasDeformSag = (deformInit.beamSagging?.level ?? 0) > 0 || Boolean(deformInit.beamSagging?.sagMm && Number(deformInit.beamSagging.sagMm) > 0);
    const hasDeform = hasDeformTilt || hasDeformDiff || hasDeformSag;

    // 4. Bảng VI.2: Danh mục 8 nhóm kiểm tra BCS Checklist chuẩn quốc tế
    const structLocationSummary = structuralDefects.length > 0
      ? `${structuralDefects.length} vết nứt tại ${Array.from(new Set(structuralDefects.map(d => d.location.vi.split(' - ')[0]))).join(', ')}`
      : 'Không';
    const structLocationSummaryEn = structuralDefects.length > 0
      ? `${structuralDefects.length} crack(s) at ${Array.from(new Set(structuralDefects.map(d => d.location.en.split(' - ')[0]))).join(', ')}`
      : 'None';

    const masonryLocationSummary = masonryPlasterCracks.length > 0
      ? `${masonryPlasterCracks.length} vết nứt tại ${Array.from(new Set(masonryPlasterCracks.map(d => d.location.vi.split(' - ')[0]))).join(', ')}`
      : 'Không';
    const masonryLocationSummaryEn = masonryPlasterCracks.length > 0
      ? `${masonryPlasterCracks.length} crack(s) at ${Array.from(new Set(masonryPlasterCracks.map(d => d.location.en.split(' - ')[0]))).join(', ')}`
      : 'None';

    const moistureLocationSummary = moistureDefects.length > 0
      ? `${moistureDefects.length} vị trí ẩm mốc/thấm tại ${Array.from(new Set(moistureDefects.map(d => d.location.vi.split(' - ')[0]))).join(', ')}`
      : 'Không';
    const moistureLocationSummaryEn = moistureDefects.length > 0
      ? `${moistureDefects.length} spot(s) at ${Array.from(new Set(moistureDefects.map(d => d.location.en.split(' - ')[0]))).join(', ')}`
      : 'None';

    const spallingLocationSummary = spallingAndOtherDefects.length > 0
      ? `${spallingAndOtherDefects.length} vị trí bong rộp/khác tại ${Array.from(new Set(spallingAndOtherDefects.map(d => d.location.vi.split(' - ')[0]))).join(', ')}`
      : 'Không';
    const spallingLocationSummaryEn = spallingAndOtherDefects.length > 0
      ? `${spallingAndOtherDefects.length} spot(s) at ${Array.from(new Set(spallingAndOtherDefects.map(d => d.location.en.split(' - ')[0]))).join(', ')}`
      : 'None';

    const totalSurveyedObjects = floorDistribution.reduce((acc, f) => acc + f.surveyedObjectsCount, 0);
    const maxCrackWidthDisplay = crackWidths.length > 0 ? `${Math.max(...crackWidths)} mm` : '–';

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
          indicatorVi: 'Nứt cấu kiện kết cấu chịu lực (Cột/Dầm/Sàn)', indicatorEn: 'Cracks in structural members (columns/beams/slabs)',
          recorded: structuralCracksCount > 0,
          recordedLabel: structuralCracksCount > 0 ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: structuralCracksCount > 0
            ? { vi: structLocationSummary, en: structLocationSummaryEn }
            : { vi: 'Không', en: 'None' },
          riskLevel: structuralCracksCount > 0 ? { vi: 'Trung bình / Theo dõi', en: 'Medium / Monitor' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Nứt', groupEn: 'Cracking',
          indicatorVi: 'Nứt tường gạch / Khối xây chèn', indicatorEn: 'Cracks in masonry / infill walls',
          recorded: masonryPlasterCracks.length > 0,
          recordedLabel: masonryPlasterCracks.length > 0 ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: masonryPlasterCracks.length > 0
            ? { vi: masonryLocationSummary, en: masonryLocationSummaryEn }
            : { vi: 'Không', en: 'None' },
          riskLevel: masonryPlasterCracks.length > 0 ? { vi: 'Thấp / Thẩm mỹ', en: 'Low / Aesthetic' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Nứt', groupEn: 'Cracking',
          indicatorVi: 'Nứt lớp vữa trát / Lớp hoàn thiện kiến trúc', indicatorEn: 'Cracks in plaster / surface finishes',
          recorded: masonryPlasterCracks.some(d => d.defectType.vi.toLowerCase().includes('chân chim') || d.defectType.vi.toLowerCase().includes('mạng nhện')),
          recordedLabel: masonryPlasterCracks.some(d => d.defectType.vi.toLowerCase().includes('chân chim') || d.defectType.vi.toLowerCase().includes('mạng nhện'))
            ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: masonryPlasterCracks.some(d => d.defectType.vi.toLowerCase().includes('chân chim') || d.defectType.vi.toLowerCase().includes('mạng nhện'))
            ? {
                vi: 'Nứt rạn chân chim lớp vữa trát tường kiến trúc',
                en: 'Hairline crazing cracks in architectural plaster',
              }
            : { vi: 'Không', en: 'None' },
          riskLevel: masonryPlasterCracks.some(d => d.defectType.vi.toLowerCase().includes('chân chim') || d.defectType.vi.toLowerCase().includes('mạng nhện'))
            ? { vi: 'Thấp', en: 'Low' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Nước', groupEn: 'Water',
          indicatorVi: 'Thấm nước / Rò rỉ / Ẩm mốc loang lổ', indicatorEn: 'Water seepage, dampness & efflorescence',
          recorded: moistureDefects.length > 0,
          recordedLabel: moistureDefects.length > 0 ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: moistureDefects.length > 0
            ? { vi: moistureLocationSummary, en: moistureLocationSummaryEn }
            : { vi: 'Không', en: 'None' },
          riskLevel: moistureDefects.length > 0 ? { vi: 'Thấp / Hoàn thiện', en: 'Low / Finish' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Suy giảm', groupEn: 'Deterioration',
          indicatorVi: 'Bong rộp sơn vôi / Phồng rộp gạch ốp lát', indicatorEn: 'Blistering of paint & spalling tiles',
          recorded: spallingAndOtherDefects.some(d => d.defectType.vi.toLowerCase().includes('bong') || d.defectType.vi.toLowerCase().includes('rộp') || d.defectType.vi.toLowerCase().includes('tróc') || d.defectType.vi.toLowerCase().includes('gạch')),
          recordedLabel: spallingAndOtherDefects.some(d => d.defectType.vi.toLowerCase().includes('bong') || d.defectType.vi.toLowerCase().includes('rộp') || d.defectType.vi.toLowerCase().includes('tróc') || d.defectType.vi.toLowerCase().includes('gạch'))
            ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: spallingAndOtherDefects.some(d => d.defectType.vi.toLowerCase().includes('bong') || d.defectType.vi.toLowerCase().includes('rộp') || d.defectType.vi.toLowerCase().includes('tróc') || d.defectType.vi.toLowerCase().includes('gạch'))
            ? { vi: spallingLocationSummary, en: spallingLocationSummaryEn }
            : { vi: 'Không', en: 'None' },
          riskLevel: spallingAndOtherDefects.some(d => d.defectType.vi.toLowerCase().includes('bong') || d.defectType.vi.toLowerCase().includes('rộp') || d.defectType.vi.toLowerCase().includes('tróc') || d.defectType.vi.toLowerCase().includes('gạch'))
            ? { vi: 'Thấp', en: 'Low' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Suy giảm', groupEn: 'Deterioration',
          indicatorVi: 'Rỉ cốt thép / Vỡ trơ cốt thép chịu lực', indicatorEn: 'Rebar corrosion & concrete spalling',
          recorded: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('rỉ') || d.defectType.vi.toLowerCase().includes('lộ thép') || d.defectType.vi.toLowerCase().includes('trơ thép')),
          recordedLabel: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('rỉ') || d.defectType.vi.toLowerCase().includes('lộ thép') || d.defectType.vi.toLowerCase().includes('trơ thép'))
            ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('rỉ') || d.defectType.vi.toLowerCase().includes('lộ thép') || d.defectType.vi.toLowerCase().includes('trơ thép'))
            ? { vi: 'Ghi nhận rỉ sét cốt thép / vỡ trơ cốt thép', en: 'Rebar corrosion / concrete spalling observed' }
            : { vi: 'Không', en: 'None' },
          riskLevel: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('rỉ') || d.defectType.vi.toLowerCase().includes('lộ thép') || d.defectType.vi.toLowerCase().includes('trơ thép'))
            ? { vi: 'Cao', en: 'High' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Biến dạng', groupEn: 'Deformation',
          indicatorVi: 'Biến dạng hình học (Nghiêng, lún chênh, võng)', indicatorEn: 'Tilt, differential settlement & deflection',
          recorded: hasDeform,
          recordedLabel: hasDeform ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: hasDeform
            ? {
                vi: 'Ghi nhận biến dạng đo đạc tại hiện trường (chi tiết Mục V)',
                en: 'Measured deformation recorded on site (see Section V)',
              }
            : { vi: 'Không', en: 'None' },
          riskLevel: hasDeform ? { vi: 'Trung bình', en: 'Medium' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Hư hỏng', groupEn: 'Damage',
          indicatorVi: 'Hư hỏng cơ học & Kẹt cửa đi / Cửa sổ', indicatorEn: 'Mechanical damage & sticking doors/windows',
          recorded: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('kẹt') || d.defectType.vi.toLowerCase().includes('cửa') || d.defectType.vi.toLowerCase().includes('hư hỏng')),
          recordedLabel: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('kẹt') || d.defectType.vi.toLowerCase().includes('cửa') || d.defectType.vi.toLowerCase().includes('hư hỏng'))
            ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('kẹt') || d.defectType.vi.toLowerCase().includes('cửa') || d.defectType.vi.toLowerCase().includes('hư hỏng'))
            ? { vi: 'Ghi nhận hiện tượng kẹt cửa / hư hỏng cơ học', en: 'Sticking doors / mechanical damage observed' }
            : { vi: 'Không', en: 'None' },
          riskLevel: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('kẹt') || d.defectType.vi.toLowerCase().includes('cửa') || d.defectType.vi.toLowerCase().includes('hư hỏng'))
            ? { vi: 'Thấp', en: 'Low' } : { vi: 'Không', en: 'None' },
        },
      ],
      notes: {
        vi: `Tổng hợp ghi nhận ${allDefectRows.length} khuyết tật trên ${appendix2.length} tầng khảo sát (${structuralCracksCount} nứt kết cấu, ${surfaceCracksCount} nứt tường/vữa, ${moistureDefects.length} vị trí ẩm mốc, ${spallingAndOtherDefects.length} vị trí bong rộp & khác). 100% khuyết tật được định vị trên bản vẽ CAD và ghép cặp ảnh đối chiếu có thước đo tại Phụ lục 2.`,
        en: `A total of ${allDefectRows.length} defects recorded across ${appendix2.length} surveyed floors (${structuralCracksCount} structural cracks, ${surfaceCracksCount} masonry cracks, ${moistureDefects.length} dampness spots, ${spallingAndOtherDefects.length} spalling & other spots). 100% of defects are mapped on CAD floor plans and paired with crack-gauge photos in Appendix 2.`,
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
