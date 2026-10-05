/**
 * ============================================================================
 * BURLAND 1977 DAMAGE CLASSIFICATION CALCULATOR
 * Phân cấp hư hại theo tiêu chuẩn Burland et al. (1977) & BRE Digest 251.
 * Tuân thủ 100% ràng buộc và công thức từ Giao diện khảo sát Step 4 & Step 3.
 * ============================================================================
 */

import {
  Section7BurlandClassification,
  BurlandZoneSummaryItem,
  BurlandTableRow,
  BurlandDistributionItem,
} from '../report-v2.types';

export class BurlandCalculator {
  /**
   * Quy đổi bề rộng vết nứt (wmax mm) sang Cấp Burland (0 - 5)
   * Đúng chuẩn từ Step4_BurlandSummary.tsx:
   * w <= 0.1 -> 0
   * w <= 1.0 -> 1
   * w <= 5.0 -> 2
   * w <= 15.0 -> 3
   * w <= 25.0 -> 4
   * w > 25.0 -> 5
   */
  public static calculateGradeFromCrackWidth(wmaxMm: number): number {
    if (!wmaxMm || wmaxMm <= 0.1) return 0;
    if (wmaxMm <= 1.0) return 1;
    if (wmaxMm <= 5.0) return 2;
    if (wmaxMm <= 15.0) return 3;
    if (wmaxMm <= 25.0) return 4;
    return 5;
  }

  public static getBurlandGradeLabelVi(grade: number): string {
    switch (grade) {
      case 0: return 'Cấp 0 - Không đáng kể';
      case 1: return 'Cấp 1 - Rất nhẹ';
      case 2: return 'Cấp 2 - Nhẹ';
      case 3: return 'Cấp 3 - Trung bình';
      case 4: return 'Cấp 4 - Nặng';
      case 5: return 'Cấp 5 - Rất nặng';
      default: return 'Cấp 0 - Không đáng kể';
    }
  }

  public static getBurlandGradeLabelEn(grade: number): string {
    switch (grade) {
      case 0: return 'Grade 0 - Negligible';
      case 1: return 'Grade 1 - Very Slight';
      case 2: return 'Grade 2 - Slight';
      case 3: return 'Grade 3 - Moderate';
      case 4: return 'Grade 4 - Severe';
      case 5: return 'Grade 5 - Very Severe';
      default: return 'Grade 0 - Negligible';
    }
  }

  /**
   * Tính toán toàn diện Bảng VII Burland Classification từ danh sách vùng Z và cấu kiện E
   */
  public static computeBurlandSection(
    rawFloors: any[],
    rawSummary?: any
  ): Section7BurlandClassification {
    const zoneSummaries: BurlandZoneSummaryItem[] = [];
    const gradeCountMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalSurveyedObjects = 0;

    let calculatedMaxGrade = 0;
    let governingItem: {
      code: string;
      floorVi: string;
      floorEn: string;
      locationVi: string;
      locationEn: string;
      wmax: number;
      descVi: string;
    } | null = null;

    for (const fl of rawFloors || []) {
      const flNameVi = fl.floorName || 'Tầng trệt';
      const flNameEn = fl.floorNameEn || (flNameVi.includes('trệt') ? 'Ground Floor' : flNameVi.includes('lửng') ? 'Mezzanine' : flNameVi);

      // 1. Duyệt Vùng Kiến trúc Z
      for (const z of fl.zones || []) {
        totalSurveyedObjects++;
        const zCode = z.zoneCode || 'Z-01';
        const locVi = z.roomName || 'Khu vực chính';
        const locEn = z.roomNameEn || locVi;
        const wallMatVi = z.wallMaterial || 'Chưa ghi nhận vật liệu';
        const wallMatEn = z.wallMaterialEn || (z.wallMaterial ? z.wallMaterial : 'Not recorded');

        const defects: any[] = z.defects || [];
        let maxW = 0;
        let crackDesc = '';
        let zoneCrackCount = 0;
        for (const d of defects) {
          const w = typeof d.widthMm === 'number' ? d.widthMm : parseFloat(d.widthMm || d.widthMaxMm || '0') || 0;
          const isCrack = (w > 0) ||
            (d.defectType && /nứt|crack/i.test(d.defectType)) ||
            (d.description && /nứt|crack/i.test(d.description)) ||
            (d.notes && /nứt|crack/i.test(d.notes));
          if (isCrack) {
            zoneCrackCount++;
          }
          if (w > maxW) {
            maxW = w;
            crackDesc = d.notes || d.description || d.defectType || '';
          }
        }

        const zoneGrade = maxW > 0 ? BurlandCalculator.calculateGradeFromCrackWidth(maxW) : 0;
        gradeCountMap[zoneGrade] = (gradeCountMap[zoneGrade] || 0) + 1;

        const item: BurlandZoneSummaryItem = {
          zoneCode: zCode,
          floorName: { vi: flNameVi, en: flNameEn },
          location: { vi: locVi, en: locEn },
          wallMaterial: { vi: wallMatVi, en: wallMatEn },
          wmaxMm: maxW > 0 ? maxW : '–',
          crackCount: zoneCrackCount,
          burlandGrade: zoneGrade,
        };
        zoneSummaries.push(item);

        if (zoneGrade > calculatedMaxGrade || !governingItem) {
          calculatedMaxGrade = zoneGrade;
          governingItem = {
            code: zCode,
            floorVi: flNameVi,
            floorEn: flNameEn,
            locationVi: locVi,
            locationEn: locEn,
            wmax: maxW,
            descVi: crackDesc,
          };
        }
      }

      // 2. Duyệt Cấu kiện Kết cấu E
      for (const e of fl.structuralElements || []) {
        totalSurveyedObjects++;
        const eCode = e.elementCode || 'E-01';
        const locVi = e.roomName || 'Khu vực chính';
        const locEn = e.roomNameEn || locVi;
        const matVi = e.materialType || e.elementType || 'Cột BTCT';

        const defects: any[] = e.defects || [];
        let maxW = 0;
        let crackDesc = '';
        let elemCrackCount = 0;
        for (const d of defects) {
          const w = typeof d.widthMm === 'number' ? d.widthMm : parseFloat(d.widthMm || d.widthMaxMm || '0') || 0;
          const isCrack = (w > 0) ||
            (d.defectType && /nứt|crack/i.test(d.defectType)) ||
            (d.description && /nứt|crack/i.test(d.description)) ||
            (d.notes && /nứt|crack/i.test(d.notes));
          if (isCrack) {
            elemCrackCount++;
          }
          if (w > maxW) {
            maxW = w;
            crackDesc = d.notes || d.description || d.defectType || '';
          }
        }

        const elemGrade = maxW > 0 ? BurlandCalculator.calculateGradeFromCrackWidth(maxW) : 0;
        gradeCountMap[elemGrade] = (gradeCountMap[elemGrade] || 0) + 1;

        if (elemGrade > calculatedMaxGrade || (elemGrade === calculatedMaxGrade && elemGrade > 0)) {
          calculatedMaxGrade = elemGrade;
          governingItem = {
            code: eCode,
            floorVi: flNameVi,
            floorEn: flNameEn,
            locationVi: `Cấu kiện ${eCode} (${matVi}), ${locVi}`,
            locationEn: `Member ${eCode} (${locEn})`,
            wmax: maxW,
            descVi: crackDesc,
          };
        }

        if (defects.length > 0) {
          zoneSummaries.push({
            zoneCode: eCode,
            floorName: { vi: flNameVi, en: flNameEn },
            location: { vi: `Cấu kiện ${eCode} (${locVi})`, en: `Member ${eCode} (${locEn})` },
            wallMaterial: { vi: matVi, en: matVi },
            wmaxMm: maxW > 0 ? maxW : '–',
            crackCount: elemCrackCount,
            burlandGrade: elemGrade,
          });
        }
      }
    }

    if (totalSurveyedObjects === 0) {
      totalSurveyedObjects = 1;
      gradeCountMap[0] = 1;
    }

    // 3. Quy tắc ưu tiên dữ liệu: Nếu KSV đã chốt tại Bước 4 thì lấy dữ liệu chốt hợp lệ
    const rawBs = rawSummary || {};
    let finalLocalMax = calculatedMaxGrade;
    if (calculatedMaxGrade === 0) {
      finalLocalMax = 0;
    } else if (rawBs.localMaxGrade !== undefined && rawBs.localMaxGrade !== null) {
      finalLocalMax = Math.max(Number(rawBs.localMaxGrade), calculatedMaxGrade);
    }

    // Tìm cấp chủ đạo (Mode)
    let finalPredominant = 0;
    let maxFrequency = -1;
    for (let g = 0; g <= 5; g++) {
      if ((gradeCountMap[g] || 0) > maxFrequency) {
        maxFrequency = gradeCountMap[g] || 0;
        finalPredominant = g;
      }
    }
    if (rawBs.predominantGrade !== undefined && rawBs.predominantGrade !== null) {
      const bsPred = Number(rawBs.predominantGrade);
      if ((gradeCountMap[bsPred] || 0) > 0) {
        finalPredominant = bsPred;
      }
    }

    const predominantCount = gradeCountMap[finalPredominant] || 0;
    const predominantPct = totalSurveyedObjects > 0
      ? `${((predominantCount / totalSurveyedObjects) * 100).toFixed(1)}%`
      : '100%';

    // Ma trận phân bổ 6 cấp Burland
    const distribution: BurlandDistributionItem[] = [
      { grade: 0, nameVi: '0 - Không đáng kể', nameEn: '0 - Negligible', crackWidthLimit: '≤ 0.1 mm', count: gradeCountMap[0] || 0, percentage: `${(((gradeCountMap[0] || 0) / totalSurveyedObjects) * 100).toFixed(1)}%`, isCurrentMax: finalLocalMax === 0, isPredominant: finalPredominant === 0 },
      { grade: 1, nameVi: '1 - Rất nhẹ', nameEn: '1 - Very Slight', crackWidthLimit: '0.1 – 1.0 mm', count: gradeCountMap[1] || 0, percentage: `${(((gradeCountMap[1] || 0) / totalSurveyedObjects) * 100).toFixed(1)}%`, isCurrentMax: finalLocalMax === 1, isPredominant: finalPredominant === 1 },
      { grade: 2, nameVi: '2 - Nhẹ', nameEn: '2 - Slight', crackWidthLimit: '1.0 – 5.0 mm', count: gradeCountMap[2] || 0, percentage: `${(((gradeCountMap[2] || 0) / totalSurveyedObjects) * 100).toFixed(1)}%`, isCurrentMax: finalLocalMax === 2, isPredominant: finalPredominant === 2 },
      { grade: 3, nameVi: '3 - Trung bình', nameEn: '3 - Moderate', crackWidthLimit: '5.0 – 15.0 mm', count: gradeCountMap[3] || 0, percentage: `${(((gradeCountMap[3] || 0) / totalSurveyedObjects) * 100).toFixed(1)}%`, isCurrentMax: finalLocalMax === 3, isPredominant: finalPredominant === 3 },
      { grade: 4, nameVi: '4 - Nặng', nameEn: '4 - Severe', crackWidthLimit: '15.0 – 25.0 mm', count: gradeCountMap[4] || 0, percentage: `${(((gradeCountMap[4] || 0) / totalSurveyedObjects) * 100).toFixed(1)}%`, isCurrentMax: finalLocalMax === 4, isPredominant: finalPredominant === 4 },
      { grade: 5, nameVi: '5 - Rất nặng', nameEn: '5 - Very Severe', crackWidthLimit: '> 25.0 mm', count: gradeCountMap[5] || 0, percentage: `${(((gradeCountMap[5] || 0) / totalSurveyedObjects) * 100).toFixed(1)}%`, isCurrentMax: finalLocalMax === 5, isPredominant: finalPredominant === 5 },
    ];

    const burlandTable: BurlandTableRow[] = [
      {
        grade: 0,
        categoryVi: 'Không đáng kể', categoryEn: 'Negligible',
        crackWidthLimit: '≤ 0.1 mm',
        descriptionVi: 'Vết nứt chân chim tóc cực nhỏ, bình thường cho khối xây và lớp vữa.',
        descriptionEn: 'Hairline cracks, normal for masonry and plaster.',
        isCurrentLevel: finalLocalMax === 0,
      },
      {
        grade: 1,
        categoryVi: 'Rất nhẹ', categoryEn: 'Very Slight',
        crackWidthLimit: '0.1 – 1.0 mm',
        descriptionVi: 'Vết nứt tinh xảo, dễ dàng xử lý bằng sơn lót hoặc bả mastic cục bộ.',
        descriptionEn: 'Fine cracks, easily treated during normal decoration.',
        isCurrentLevel: finalLocalMax === 1,
      },
      {
        grade: 2,
        categoryVi: 'Nhẹ', categoryEn: 'Slight',
        crackWidthLimit: '1.0 – 5.0 mm',
        descriptionVi: 'Vết nứt dễ trát vá vữa, cửa sổ và cửa đi có thể hơi kẹt nhẹ.',
        descriptionEn: 'Cracks easily filled. Doors and windows may stick slightly.',
        isCurrentLevel: finalLocalMax === 2,
      },
      {
        grade: 3,
        categoryVi: 'Trung bình', categoryEn: 'Moderate',
        crackWidthLimit: '5.0 – 15.0 mm',
        descriptionVi: 'Nứt cần thợ nề đục tẩy xử lý mạch vữa, khả năng chống thấm thời tiết bị suy giảm.',
        descriptionEn: 'Cracks require masonry opening and repointing, weather-tightness often impaired.',
        isCurrentLevel: finalLocalMax === 3,
      },
      {
        grade: 4,
        categoryVi: 'Nặng', categoryEn: 'Severe',
        crackWidthLimit: '15.0 – 25.0 mm',
        descriptionVi: 'Hư hỏng trên diện rộng, tường xây bị lệch chuyển, dầm sàn võng nứt.',
        descriptionEn: 'Extensive damage, walls leaning or bowing, beams deflect noticeably.',
        isCurrentLevel: finalLocalMax === 4,
      },
      {
        grade: 5,
        categoryVi: 'Rất nặng', categoryEn: 'Very Severe',
        crackWidthLimit: '> 25.0 mm',
        descriptionVi: 'Nguy cơ sụp đổ từng phần, yêu cầu chống đỡ khẩn cấp hoặc tái thiết cấu kiện.',
        descriptionEn: 'Structural danger, partial collapse risk requiring urgent propping or partial rebuilding.',
        isCurrentLevel: finalLocalMax === 5,
      },
    ];

    // Vùng chi phối
    const govCode = rawBs.governingZoneCode || governingItem?.code || 'Z-01';
    const govFloor = governingItem?.floorVi || 'Tầng trệt';
    const govLoc = governingItem?.locationVi || 'Khu vực chính';
    const govW = governingItem?.wmax || 0;
    const govDesc = rawBs.governingZoneDescription || governingItem?.descVi || '';

    // Cờ kết cấu (E2) - Giá trị Có / Không chuẩn xác theo dữ liệu khảo sát
    const hasFlag = rawBs.hasStructuralFlag !== undefined
      ? Boolean(rawBs.hasStructuralFlag)
      : (rawBs.structuralFlagLevel && rawBs.structuralFlagLevel !== 'NONE' && rawBs.structuralFlagLevel !== 'None' && rawBs.structuralFlagLevel !== '0' && rawBs.structuralFlagLevel !== 'NO')
        ? true
        : finalLocalMax >= 3;

    const structFlagVi = hasFlag ? 'Có' : 'Không';
    const structFlagEn = hasFlag ? 'Yes' : 'No';

    // Tính đại diện
    const rawRep = rawBs.representativeness || (finalLocalMax > 0 ? 'LOCAL' : 'GLOBAL');
    const isGlobal = rawRep === 'GLOBAL';
    const repVi = isGlobal ? 'Toàn công trình (Global)' : 'Cục bộ (Local)';
    const repEn = isGlobal ? 'Global' : 'Local';

    // Thẩm tra kỹ sư
    const needReview = Boolean(rawBs.needStructuralEngineerReview) || (rawBs.needStructuralReview !== undefined ? Boolean(rawBs.needStructuralReview) : finalLocalMax >= 3);

    return {
      burlandTable,
      distribution,
      totalSurveyedObjects,
      predominantGrade: {
        vi: `${BurlandCalculator.getBurlandGradeLabelVi(finalPredominant)} (Chiếm ${predominantPct})`,
        en: `${BurlandCalculator.getBurlandGradeLabelEn(finalPredominant)} (${predominantPct} of surveyed objects)`,
      },
      predominantPercentage: predominantPct,
      localMaxGrade: {
        vi: `${BurlandCalculator.getBurlandGradeLabelVi(finalLocalMax)}${govW > 0 ? ` (wmax = ${govW} mm)` : ''}`,
        en: `${BurlandCalculator.getBurlandGradeLabelEn(finalLocalMax)}${govW > 0 ? ` (wmax = ${govW} mm)` : ''}`,
      },
      governingZone: {
        vi: `${govCode} – ${govFloor} (${govLoc})`,
        en: `${govCode} – ${governingItem?.floorEn || govFloor} (${governingItem?.locationEn || govLoc})`,
      },
      governingZoneDescription: {
        vi: govDesc || `Vị trí có độ mở rộng vết nứt lớn nhất của công trình (${govW > 0 ? `wmax = ${govW} mm` : 'hiện trạng ổn định'}).`,
        en: govDesc || `Governing location with maximum crack width (${govW > 0 ? `wmax = ${govW} mm` : 'stable'}).`,
      },
      representativeness: { vi: repVi, en: repEn },
      structuralFlagLevel: { vi: structFlagVi, en: structFlagEn },
      needStructuralReview: {
        vi: needReview ? 'Có' : 'Không',
        en: needReview ? 'Yes' : 'No',
      },
      serviceabilityNarrative: {
        vi: finalLocalMax <= 2
          ? 'Công trình duy trì khả năng chịu lực bình thường. Các hư hỏng ghi nhận chủ yếu mang tính thẩm mỹ và hoàn thiện kiến trúc, không đe dọa đến an toàn khai thác tổng thể.'
          : 'Công trình có khuyết tật kết cấu cục bộ đạt ngưỡng cần theo dõi. Khuyến nghị quan trắc biến dạng định kỳ trong suốt quá trình thi công ngầm.',
        en: finalLocalMax <= 2
          ? 'The building retains normal structural load-bearing capacity. Recorded defects are primarily aesthetic and architectural, with no threat to overall operational safety.'
          : 'The building has localised structural defects requiring monitoring. Deformation observation is recommended during underground construction works.',
      },
      legalInsuranceBaselineNarrative: {
        vi: 'Toàn bộ các chỉ số và phân cấp Burland nêu trên là Hồ sơ Hiện trạng Gốc (Pre-construction Legal Baseline) xác lập trước ngày khởi công dự án Metro Tuyến 2. Đơn vị Bảo hiểm và Chủ đầu tư chỉ xem xét bồi thường đối với các vết nứt phát sinh mới chưa có trong báo cáo hoặc các vết nứt cũ phát triển tăng thêm do ảnh hưởng trực tiếp từ thi công ngầm.',
        en: 'All Burland classifications recorded herein establish the Pre-construction Legal Baseline prior to Metro Line 2 works. The Insurer and Project Employer shall only consider claims for newly developed defects or verified crack growth caused directly by tunneling operations.',
      },
      gradeCounts: distribution.map(d => ({ grade: d.grade, nameVi: d.nameVi, nameEn: d.nameEn, count: d.count })),
      zones: zoneSummaries,
      structuralDefectFlag: { vi: structFlagVi, en: structFlagEn },
      structuralEngineerReview: {
        vi: needReview ? 'Có' : 'Không',
        en: needReview ? 'Yes' : 'No',
      },
    };
  }
}
