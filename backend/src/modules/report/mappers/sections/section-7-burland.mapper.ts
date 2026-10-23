/**
 * ============================================================================
 * SECTION 7 BURLAND CLASSIFICATION MAPPER (READ-ONLY — ZERO CALCULATE)
 * Phân cấp hư hại theo tiêu chuẩn Burland et al. (1977) & BRE Digest 251.
 * Đọc trực tiếp 1:1 từ dữ liệu đã chốt trong hồ sơ khảo sát (burlandSummary, zones).
 * Tuyệt đối không tính toán cấp Burland từ độ rộng vết nứt lúc xuất báo cáo.
 * ============================================================================
 */

import {
  Section7BurlandClassification,
  BurlandZoneSummaryItem,
  BurlandTableRow,
  BurlandDistributionItem,
  BurlandStructuralElementItem,
} from '../../report.types';

function parseSavedGrade(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  return Number.isInteger(num) && num >= 0 && num <= 5 ? num : null;
}

export class Section7BurlandMapper {
  public static getBurlandGradeLabelVi(grade: number | null): string {
    if (grade === null) return '--';
    switch (grade) {
      case 0: return 'Cấp 0 - Không đáng kể';
      case 1: return 'Cấp 1 - Rất nhẹ';
      case 2: return 'Cấp 2 - Nhẹ';
      case 3: return 'Cấp 3 - Trung bình';
      case 4: return 'Cấp 4 - Nặng';
      case 5: return 'Cấp 5 - Rất nặng';
      default: return '--';
    }
  }

  public static getBurlandGradeLabelEn(grade: number | null): string {
    if (grade === null) return '--';
    switch (grade) {
      case 0: return 'Grade 0 - Negligible';
      case 1: return 'Grade 1 - Very Slight';
      case 2: return 'Grade 2 - Slight';
      case 3: return 'Grade 3 - Moderate';
      case 4: return 'Grade 4 - Severe';
      case 5: return 'Grade 5 - Very Severe';
      default: return '--';
    }
  }

  public static map(
    rawFloors: any[],
    rawSummary?: any
  ): Section7BurlandClassification {
    const zoneSummaries: BurlandZoneSummaryItem[] = [];
    const structuralElements: BurlandStructuralElementItem[] = [];
    const gradeCountMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalSurveyedObjects = 0;

    for (const fl of rawFloors || []) {
      const flNameVi = fl.floorName || 'Tầng trệt';
      const flNameEn = fl.floorNameEn || (flNameVi.includes('trệt') ? 'Ground Floor' : flNameVi.includes('lửng') ? 'Mezzanine' : flNameVi);

      // 1. Duyệt Vùng Kiến trúc Z (Đọc trực tiếp z.burlandGrade đã lưu)
      const activeZones = (fl.zones || []).filter((z: any) => !z?.isDeleted && !z?.is_deleted);
      for (const z of activeZones) {
        totalSurveyedObjects++;
        const zCode = z.zoneCode || 'Z-01';
        const resolvedRoom = (z.roomName === 'Khác' && z.customRoomName) ? z.customRoomName : z.roomName;
        const resolvedWallMat = (z.wallMaterial === 'Khác' && z.customWallMaterial) ? z.customWallMaterial : z.wallMaterial;
        const locVi = resolvedRoom || 'Khu vực chính';
        const locEn = z.roomNameEn || locVi;
        const wallMatVi = resolvedWallMat || 'Chưa ghi nhận vật liệu';
        const wallMatEn = z.wallMaterialEn || (resolvedWallMat ? resolvedWallMat : 'Not recorded');

        const defects: any[] = (z.defects || []).filter((d: any) => !d?.isDeleted && !d?.is_deleted);
        const savedZoneWmax = z.wmaxMm ?? z.maxWidthMm;
        const wmaxDisplay: number | string = (savedZoneWmax !== undefined && savedZoneWmax !== null && savedZoneWmax !== '' && Number(savedZoneWmax) > 0)
          ? Number(savedZoneWmax)
          : (() => {
              const firstDefectWithWidth = defects.find((d: any) => Number(d.widthMm || d.widthMaxMm || 0) > 0);
              return firstDefectWithWidth ? Number(firstDefectWithWidth.widthMm || firstDefectWithWidth.widthMaxMm) : '–';
            })();

        const savedZoneGrade = parseSavedGrade(z.burlandGrade) ?? 0;
        gradeCountMap[savedZoneGrade] = (gradeCountMap[savedZoneGrade] || 0) + 1;

        zoneSummaries.push({
          zoneCode: zCode,
          floorName: { vi: flNameVi, en: flNameEn },
          location: { vi: locVi, en: locEn },
          wallMaterial: { vi: wallMatVi, en: wallMatEn },
          wmaxMm: wmaxDisplay,
          crackCount: typeof z.crackCount === 'number' ? z.crackCount : defects.length,
          burlandGrade: savedZoneGrade,
        });
      }

      // 2. Duyệt Cấu kiện Kết cấu Chịu lực E
      const activeElements = (fl.structuralElements || []).filter((e: any) => !e?.isDeleted && !e?.is_deleted);
      for (const e of activeElements) {
        const eCode = e.elementCode || 'E-01';
        const resolvedERoom = (e.roomName === 'Khác' && e.customRoomName) ? e.customRoomName : e.roomName;
        const resolvedEType = (e.elementType === 'Khác' && e.customElementType) ? e.customElementType : e.elementType;
        const resolvedEMat = (e.materialType === 'Khác' && e.customMaterialType) ? e.customMaterialType : e.materialType;
        const locVi = resolvedERoom || 'Khu vực chính';
        const locEn = e.roomNameEn || locVi;
        const elemTypeVi = resolvedEType || 'Cột / Dầm / Sàn';
        const matVi = resolvedEMat || 'Bê tông cốt thép';

        const defects: any[] = (e.defects || []).filter((d: any) => !d?.isDeleted && !d?.is_deleted);
        const firstDefectWithWidth = defects.find((d: any) => Number(d.widthMm || d.widthMaxMm || 0) > 0);
        const elemWmax = firstDefectWithWidth ? Number(firstDefectWithWidth.widthMm || firstDefectWithWidth.widthMaxMm) : 0;

        let condVi = 'Bình thường, không ghi nhận khuyết tật';
        let condEn = 'Normal, no defects recorded';
        if (elemWmax > 0) {
          condVi = `Xuất hiện vết nứt (wmax = ${elemWmax} mm)`;
          condEn = `Cracking observed (wmax = ${elemWmax} mm)`;
        } else if (defects.length > 0) {
          condVi = `Ghi nhận ${defects.length} khuyết tật bề mặt`;
          condEn = `${defects.length} surface defects recorded`;
        }

        structuralElements.push({
          elementCode: eCode,
          floorName: { vi: flNameVi, en: flNameEn },
          location: { vi: locVi, en: locEn },
          elementType: elemTypeVi,
          materialType: matVi,
          defectCount: defects.length,
          conditionVi: condVi,
          conditionEn: condEn,
        });
      }
    }

    // 3. Đọc trực tiếp từ burlandSummary đã lưu (Zero Calculate)
    const rawBs = rawSummary || {};
    const finalLocalMax = parseSavedGrade(rawBs.localMaxGrade);
    const finalPredominant = parseSavedGrade(rawBs.predominantGrade);
    const predominantPct = rawBs.predominantPercentage
      ? String(rawBs.predominantPercentage)
      : '--';

    const distribution: BurlandDistributionItem[] = [
      { grade: 0, nameVi: '0 - Không đáng kể', nameEn: '0 - Negligible', crackWidthLimit: '≤ 0.1 mm', count: gradeCountMap[0] || 0, percentage: rawBs.grade0Pct || '--', isCurrentMax: finalLocalMax === 0, isPredominant: finalPredominant === 0 },
      { grade: 1, nameVi: '1 - Rất nhẹ', nameEn: '1 - Very Slight', crackWidthLimit: '0.1 – 1.0 mm', count: gradeCountMap[1] || 0, percentage: rawBs.grade1Pct || '--', isCurrentMax: finalLocalMax === 1, isPredominant: finalPredominant === 1 },
      { grade: 2, nameVi: '2 - Nhẹ', nameEn: '2 - Slight', crackWidthLimit: '1.0 – 5.0 mm', count: gradeCountMap[2] || 0, percentage: rawBs.grade2Pct || '--', isCurrentMax: finalLocalMax === 2, isPredominant: finalPredominant === 2 },
      { grade: 3, nameVi: '3 - Trung bình', nameEn: '3 - Moderate', crackWidthLimit: '5.0 – 15.0 mm', count: gradeCountMap[3] || 0, percentage: rawBs.grade3Pct || '--', isCurrentMax: finalLocalMax === 3, isPredominant: finalPredominant === 3 },
      { grade: 4, nameVi: '4 - Nặng', nameEn: '4 - Severe', crackWidthLimit: '15.0 – 25.0 mm', count: gradeCountMap[4] || 0, percentage: rawBs.grade4Pct || '--', isCurrentMax: finalLocalMax === 4, isPredominant: finalPredominant === 4 },
      { grade: 5, nameVi: '5 - Rất nặng', nameEn: '5 - Very Severe', crackWidthLimit: '> 25.0 mm', count: gradeCountMap[5] || 0, percentage: rawBs.grade5Pct || '--', isCurrentMax: finalLocalMax === 5, isPredominant: finalPredominant === 5 },
    ];

    const burlandTable: BurlandTableRow[] = [
      {
        grade: 0,
        categoryVi: 'Không đáng kể', categoryEn: 'Negligible',
        crackWidthLimit: '≤ 0.1 mm',
        descriptionVi: 'Vết nứt chân chim tóc cực nhỏ, bình thường cho khối xây và lớp vữa.',
        descriptionEn: 'Hairline cracks, normal for masonry and plaster.',
        isCurrentLevel: finalLocalMax === 0 || (gradeCountMap[0] || 0) > 0,
      },
      {
        grade: 1,
        categoryVi: 'Rất nhẹ', categoryEn: 'Very Slight',
        crackWidthLimit: '0.1 – 1.0 mm',
        descriptionVi: 'Vết nứt tinh xảo, dễ dàng xử lý bằng sơn lót hoặc bả mastic cục bộ.',
        descriptionEn: 'Fine cracks, easily treated during normal decoration.',
        isCurrentLevel: finalLocalMax === 1 || (gradeCountMap[1] || 0) > 0,
      },
      {
        grade: 2,
        categoryVi: 'Nhẹ', categoryEn: 'Slight',
        crackWidthLimit: '1.0 – 5.0 mm',
        descriptionVi: 'Vết nứt dễ trát vá vữa, cửa sổ và cửa đi có thể hơi kẹt nhẹ.',
        descriptionEn: 'Cracks easily filled. Doors and windows may stick slightly.',
        isCurrentLevel: finalLocalMax === 2 || (gradeCountMap[2] || 0) > 0,
      },
      {
        grade: 3,
        categoryVi: 'Trung bình', categoryEn: 'Moderate',
        crackWidthLimit: '5.0 – 15.0 mm',
        descriptionVi: 'Nứt cần thợ nề đục tẩy xử lý mạch vữa, khả năng chống thấm thời tiết bị suy giảm.',
        descriptionEn: 'Cracks require masonry opening and repointing, weather-tightness often impaired.',
        isCurrentLevel: finalLocalMax === 3 || (gradeCountMap[3] || 0) > 0,
      },
      {
        grade: 4,
        categoryVi: 'Nặng', categoryEn: 'Severe',
        crackWidthLimit: '15.0 – 25.0 mm',
        descriptionVi: 'Hư hỏng trên diện rộng, tường xây bị lệch chuyển, dầm sàn võng nứt.',
        descriptionEn: 'Extensive damage, walls leaning or bowing, beams deflect noticeably.',
        isCurrentLevel: finalLocalMax === 4 || (gradeCountMap[4] || 0) > 0,
      },
      {
        grade: 5,
        categoryVi: 'Rất nặng', categoryEn: 'Very Severe',
        crackWidthLimit: '> 25.0 mm',
        descriptionVi: 'Nguy cơ sụp đổ từng phần, yêu cầu chống đỡ khẩn cấp hoặc tái thiết cấu kiện.',
        descriptionEn: 'Structural danger, partial collapse risk requiring urgent propping or partial rebuilding.',
        isCurrentLevel: finalLocalMax === 5 || (gradeCountMap[5] || 0) > 0,
      },
    ];

    const explicitGovZone = rawBs.governingZoneCode
      ? zoneSummaries.find((zs) => zs.zoneCode === rawBs.governingZoneCode)
      : undefined;
    const govCode = rawBs.governingZoneCode || explicitGovZone?.zoneCode || '--';
    const govFloor = explicitGovZone?.floorName?.vi || '--';
    const govFloorEn = explicitGovZone?.floorName?.en || govFloor;
    const govLoc = explicitGovZone?.location?.vi || '--';
    const govLocEn = explicitGovZone?.location?.en || govLoc;
    const govW = explicitGovZone && typeof explicitGovZone.wmaxMm === 'number' ? explicitGovZone.wmaxMm : 0;
    const govDesc = rawBs.governingZoneDescription || '';

    const rawFlagStr = (rawBs.structuralFlagLevel ?? '').toString().trim().toUpperCase();
    let structFlagVi = '--';
    let structFlagEn = '--';
    if (['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].includes(rawFlagStr)) {
      const levelLabels: Record<string, { vi: string; en: string }> = {
        LOW: { vi: 'Có (Cấp Low)', en: 'Yes (Low)' },
        MODERATE: { vi: 'Có (Cấp Moderate)', en: 'Yes (Moderate)' },
        HIGH: { vi: 'Có (Cấp High)', en: 'Yes (High)' },
        CRITICAL: { vi: 'Có (Cấp Critical)', en: 'Yes (Critical)' },
      };
      structFlagVi = levelLabels[rawFlagStr]?.vi || 'Có';
      structFlagEn = levelLabels[rawFlagStr]?.en || 'Yes';
    } else if (rawFlagStr === 'NONE' || rawFlagStr === '0' || rawFlagStr === 'NO' || rawBs.hasStructuralFlag === false) {
      structFlagVi = 'Không';
      structFlagEn = 'No';
    } else if (rawBs.hasStructuralFlag === true) {
      structFlagVi = 'Có';
      structFlagEn = 'Yes';
    }

    const rawRep = rawBs.representativeness;
    const repVi = rawRep === 'GLOBAL'
      ? 'Toàn công trình (Global)'
      : rawRep === 'LOCAL'
        ? 'Cục bộ (Local)'
        : '--';
    const repEn = rawRep === 'GLOBAL'
      ? 'Global'
      : rawRep === 'LOCAL'
        ? 'Local'
        : '--';

    const rawNeedReview = rawBs.needStructuralEngineerReview ?? rawBs.needStructuralReview;
    const needReviewVi = rawNeedReview === true ? 'Có' : rawNeedReview === false ? 'Không' : '--';
    const needReviewEn = rawNeedReview === true ? 'Yes' : rawNeedReview === false ? 'No' : '--';

    const isZeroDefects = finalLocalMax === 0;

    return {
      burlandTable,
      distribution,
      totalSurveyedObjects,
      predominantGrade: {
        vi: Section7BurlandMapper.getBurlandGradeLabelVi(finalPredominant),
        en: Section7BurlandMapper.getBurlandGradeLabelEn(finalPredominant),
      },
      predominantPercentage: predominantPct,
      localMaxGrade: {
        vi: finalLocalMax === null
          ? '--'
          : `${Section7BurlandMapper.getBurlandGradeLabelVi(finalLocalMax)}${govW > 0 ? ` (wmax = ${govW} mm)` : ''}`,
        en: finalLocalMax === null
          ? '--'
          : `${Section7BurlandMapper.getBurlandGradeLabelEn(finalLocalMax)}${govW > 0 ? ` (wmax = ${govW} mm)` : ''}`,
      },
      governingZone: {
        vi: govCode === '--' ? '--' : `${govCode} – ${govFloor} (${govLoc})`,
        en: govCode === '--' ? '--' : `${govCode} – ${govFloorEn} (${govLocEn})`,
      },
      governingZoneDescription: {
        vi: isZeroDefects
          ? 'Toàn bộ công trình nguyên vẹn, không phát hiện vết nứt hoặc hư hỏng kết cấu hiện trường.'
          : (govDesc || '--'),
        en: isZeroDefects
          ? 'The building is completely sound with no cracks or structural defects recorded.'
          : (govDesc || '--'),
      },
      representativeness: { vi: repVi, en: repEn },
      structuralFlagLevel: { vi: structFlagVi, en: structFlagEn },
      needStructuralReview: { vi: needReviewVi, en: needReviewEn },
      serviceabilityNarrative: {
        vi: isZeroDefects
          ? 'Công trình duy trì khả năng chịu lực bình thường, toàn bộ cấu kiện và bề mặt kiến trúc nguyên vẹn, không ghi nhận bất kỳ khuyết tật hoặc hư hỏng nào.'
          : finalLocalMax !== null && finalLocalMax <= 2
            ? 'Công trình duy trì khả năng chịu lực bình thường. Các hư hỏng ghi nhận chủ yếu mang tính thẩm mỹ và hoàn thiện kiến trúc, không đe dọa đến an toàn khai thác tổng thể.'
            : finalLocalMax !== null
              ? 'Công trình có khuyết tật kết cấu cục bộ đạt ngưỡng cần theo dõi. Khuyến nghị quan trắc biến dạng định kỳ trong suốt quá trình thi công ngầm.'
              : '--',
        en: isZeroDefects
          ? 'The building maintains normal load-bearing capacity; all structural members and finishes are completely sound with no defects recorded.'
          : finalLocalMax !== null && finalLocalMax <= 2
            ? 'The building retains normal structural load-bearing capacity. Recorded defects are primarily aesthetic and architectural, with no threat to overall operational safety.'
            : finalLocalMax !== null
              ? 'The building has localised structural defects requiring monitoring. Deformation observation is recommended during underground construction works.'
              : '--',
      },
      legalInsuranceBaselineNarrative: {
        vi: 'Toàn bộ các chỉ số và phân cấp Burland nêu trên là Hồ sơ Hiện trạng Gốc (Pre-construction Legal Baseline) xác lập trước ngày khởi công dự án Metro Tuyến 2. Đơn vị Bảo hiểm và Chủ đầu tư chỉ xem xét bồi thường đối với các vết nứt phát sinh mới chưa có trong báo cáo hoặc các vết nứt cũ phát triển tăng thêm do ảnh hưởng trực tiếp từ thi công ngầm.',
        en: 'All Burland classifications recorded herein establish the Pre-construction Legal Baseline prior to Metro Line 2 works. The Insurer and Project Employer shall only consider claims for newly developed defects or verified crack growth caused directly by tunneling operations.',
      },
      gradeCounts: distribution.map(d => ({ grade: d.grade, nameVi: d.nameVi, nameEn: d.nameEn, count: d.count })),
      zones: zoneSummaries,
      structuralElements,
      structuralDefectFlag: { vi: structFlagVi, en: structFlagEn },
      structuralEngineerReview: { vi: needReviewVi, en: needReviewEn },
    };
  }
}

