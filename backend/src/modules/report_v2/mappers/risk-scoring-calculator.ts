/**
 * ============================================================================
 * RISK SCORING & BUILDING CONDITION ASSESSMENT CALCULATOR (PHASE 1)
 * Đánh giá điểm hiện trạng ECS (0–24) theo ecsCalculator.ts
 * Chỉ số tính dễ bị tổn thương VI (1.00–4.00) theo viCalculator.ts
 * Cấp tác động thi công I (I1–I4) và Ma trận rủi ro cơ sở BRA 4x4 theo braEngine.ts
 * ============================================================================
 */

import {
  Section8BuildingConditionAssessment,
  EcsAssessmentItem,
  ViAssessmentItem,
  BraMatrixRow,
  BraMatrixCell,
  BilingualText,
} from '../report-v2.types';

export class RiskScoringCalculator {
  public static computeRiskAssessment(
    rawReport: any,
    burlandMaxGrade: number,
    burlandPredominantGrade?: number
  ): Section8BuildingConditionAssessment {
    const json = rawReport.survey_data_json || {};
    const ecsData = json.ecs || {};
    const viData = json.vi || {};
    const specs = rawReport.buildingSpecs || json || {};
    const rScores = rawReport.riskScores;

    // =========================================================================
    // 1. TÍNH TOÁN BẢNG 11: ECS (EXISTING CONDITION SCORE: 0 - 24)
    // =========================================================================
    // E1: Hư hỏng nhìn thấy tường/khối xây (Burland Grade Max)
    // Quy tắc ecsCalculator.ts: B <= 1: 0đ; B = 2: 1đ; B = 3: 2đ; B = 4: 3đ; B >= 5: 4đ
    const e1BurlandGrade = burlandMaxGrade ?? (json.burlandSummary?.localMaxGrade ?? 0);
    const e1Calc = e1BurlandGrade <= 1 ? 0 : e1BurlandGrade === 2 ? 1 : e1BurlandGrade === 3 ? 2 : e1BurlandGrade === 4 ? 3 : 4;
    const e1 = ecsData.e1 !== undefined ? Number(ecsData.e1) : e1Calc;

    // E2: Khuyết tật kết cấu cột/dầm/sàn/tường chịu lực
    const flagLevel = (json.burlandSummary?.structuralFlagLevel || 'NONE').toUpperCase();
    let flagVal = 0;
    if (flagLevel === 'LOW') flagVal = 1;
    else if (flagLevel === 'MODERATE') flagVal = 2;
    else if (flagLevel === 'HIGH') flagVal = 3;
    else if (flagLevel === 'CRITICAL') flagVal = 4;
    const e2 = ecsData.e2 !== undefined ? Number(ecsData.e2) : flagVal;

    // E3: Lún/nghiêng/võng/biến dạng
    const st = json.settlementTilt || {};
    const lSettlement = st.diffSettlement?.level ?? 0;
    const lTilt = st.buildingTilt?.level ?? 0;
    const lSag = st.beamSagging?.level ?? 0;
    const e3Default = Math.min(4, Math.max(lSettlement, lTilt, lSag));
    const e3 = ecsData.e3 !== undefined ? Number(ecsData.e3) : e3Default;

    // E4: Suy giảm vật liệu/độ bền lâu
    const e4 = ecsData.e4 !== undefined ? Number(ecsData.e4) : 0;

    // E5: Lịch sử/cơi nới/sự cố & toàn vẹn
    let e5Default = 0;
    const hi = json.historyInterview;
    if (hi) {
      const scores = [
        hi.renovationLoad ?? 0,
        hi.majorRepair ?? 0,
        hi.pastSettlement ?? 0,
        hi.neighborDamage ?? 0,
        hi.fireFloodIncident ?? 0,
      ];
      const maxScore = Math.max(...scores);
      const countHigh = scores.filter((s: number) => s > 2).length;
      e5Default = countHigh >= 2 ? 4 : maxScore;
    }
    const e5 = ecsData.e5 !== undefined ? Number(ecsData.e5) : e5Default;

    // E6: Tình trạng chức năng/tổng thể
    const e6 = ecsData.e6 !== undefined ? Number(ecsData.e6) : 0;

    const totalEcs = ecsData.totalEcs !== undefined
      ? Number(ecsData.totalEcs)
      : (e1 + e2 + e3 + e4 + e5 + e6);

    let ecsClassVi = 'Tốt';
    let ecsClassEn = 'Good';
    if (totalEcs >= 17) {
      ecsClassVi = 'Nguy hiểm';
      ecsClassEn = 'Critical';
    } else if (totalEcs >= 11) {
      ecsClassVi = 'Kém';
      ecsClassEn = 'Deficient';
    } else if (totalEcs >= 6) {
      ecsClassVi = 'Trung bình';
      ecsClassEn = 'Medium';
    } else {
      ecsClassVi = 'Tốt';
      ecsClassEn = 'Good';
    }

    const ecsItems: EcsAssessmentItem[] = [
      {
        code: 'E1',
        title: { vi: 'Hư hỏng nhìn thấy tường / khối xây', en: 'Visible damage to walls / masonry' },
        basis: { vi: `Burland cục bộ lớn nhất: Cấp ${e1BurlandGrade}`, en: `Local max Burland grade: Grade ${e1BurlandGrade}` },
        scale: '0–4',
        score: e1,
      },
      {
        code: 'E2',
        title: { vi: 'Khuyết tật kết cấu cột/dầm/sàn/tường', en: 'Structural defects in columns/beams/slabs' },
        basis: { vi: `Cờ kết cấu chịu lực: ${flagLevel}`, en: `Structural flag level: ${flagLevel}` },
        scale: '0–4',
        score: e2,
      },
      {
        code: 'E3',
        title: { vi: 'Biến dạng Lún / Nghiêng / Võng', en: 'Deformation (Settlement / Tilt / Deflection)' },
        basis: {
          vi: e3 === 0 ? 'Thân nhà thẳng đứng, không lún võng bất thường' : `Phát hiện biến dạng hiện trường (Mức ${e3}/4đ)`,
          en: e3 === 0 ? 'Upright building, no abnormal deflection/tilt' : `Deformation detected on-site (Level ${e3}/4)`,
        },
        scale: '0–4',
        score: e3,
      },
      {
        code: 'E4',
        title: { vi: 'Suy giảm vật liệu / độ bền lâu', en: 'Material degradation' },
        basis: {
          vi: e4 === 0 ? 'Vật liệu nguyên vẹn, không phong hóa/thấm ẩm' : `Ghi nhận suy giảm vật liệu (Mức ${e4}/4đ)`,
          en: e4 === 0 ? 'Materials intact, no weathering/moisture' : `Material degradation observed (Level ${e4}/4)`,
        },
        scale: '0–4',
        score: e4,
      },
      {
        code: 'E5',
        title: { vi: 'Lịch sử / cơi nới / sự cố & toàn vẹn', en: 'Historical sensitivity & structural integrity' },
        basis: {
          vi: e5 === 0 ? 'Công trình nguyên bản, không tiền sử sự cố' : `Tiền sử sửa chữa/sự cố ghi nhận (Mức ${e5}/4đ)`,
          en: e5 === 0 ? 'Original structure, no history of incidents' : `Reported past repairs/incidents (Level ${e5}/4)`,
        },
        scale: '0–4',
        score: e5,
      },
      {
        code: 'E6',
        title: { vi: 'Tình trạng chức năng / tổng thể', en: 'Overall serviceability & functional condition' },
        basis: {
          vi: e6 === 0 ? 'Khai thác bình thường, không kẹt cửa/thấm dột' : `Ảnh hưởng công năng vận hành (Mức ${e6}/4đ)`,
          en: e6 === 0 ? 'Normal operation, no jammed doors/leakage' : `Functional serviceability impact (Level ${e6}/4)`,
        },
        scale: '0–4',
        score: e6,
      },
    ];

    // =========================================================================
    // 2. TÍNH TOÁN BẢNG 13: VI (VULNERABILITY INDEX: 1.00 - 4.00)
    // =========================================================================
    // V1: Công năng & Quy mô (Normal 0, General 2, Important 3, Critical 4)
    const usageFunc = json.usageFunction || specs.land_use_function || '';
    const objGroup = (json.objectGroup || specs.building_grade || 'GENERAL').toUpperCase();
    const isAbandoned = usageFunc === 'Nhà bỏ trống' || usageFunc === 'Đất trống' || json.surveyCaseType === 'VACANT_LAND';
    let v1Calc = isAbandoned ? 0 : objGroup === 'CRITICAL' ? 4 : objGroup === 'IMPORTANT' ? 3 : 2;
    const v1 = viData.v1 !== undefined ? Number(viData.v1) : v1Calc;

    // V2: Hệ kết cấu chịu lực (RC: 1.0, RC+brick: 2.0, Masonry: 3.0, Substandard: 4.0)
    const structSys = json.structureSystem || specs.structuralType || '';
    let v2Calc = 2;
    if (structSys.includes('RC') || structSys.includes('BTCT toàn khối')) v2Calc = 1;
    else if (structSys.includes('Masonry') || structSys.includes('Tường gạch')) v2Calc = 3;
    else if (structSys.includes('Kém ổn định') || structSys.includes('tạm')) v2Calc = 4;
    const v2 = viData.v2 !== undefined ? Number(viData.v2) : v2Calc;

    // V3: Loại móng & Nền đất (Cat 1-2: 1đ, Cat 3: 2đ, Cat 4: 3đ, Cat 5: 4đ)
    const catScore = json.foundationCatScore ?? specs.foundationCatScore ?? 3;
    let v3Calc = catScore <= 2 ? 1 : catScore === 3 ? 2 : catScore === 4 ? 3 : 4;
    const v3 = viData.v3 !== undefined ? Number(viData.v3) : v3Calc;

    // V4: Tuổi đời / Cơi nới (<10n: 1, 10-25n: 2, 25-40n: 3, >40n: 4)
    const constrYear = parseInt(specs.constructionYear || specs.year_of_construction || json.constructionYear || '2013', 10);
    const ageYears = new Date().getFullYear() - (isNaN(constrYear) ? 2013 : constrYear);
    let v4Calc = ageYears < 10 ? 1 : ageYears <= 25 ? 2 : ageYears <= 40 ? 3 : 4;
    if ((json.historyInterview?.renovationLoad ?? 0) >= 3) v4Calc = 4;
    const v4 = viData.v4 !== undefined ? Number(viData.v4) : v4Calc;

    // V5: Hiện trạng kỹ thuật ECS (Good: 1, Medium: 2, Deficient: 3, Critical: 4)
    let v5Calc = totalEcs >= 17 ? 4 : totalEcs >= 11 ? 3 : totalEcs >= 6 ? 2 : 1;
    const v5 = viData.v5 !== undefined ? Number(viData.v5) : v5Calc;

    // V6: Thiết bị nhạy cảm & Vận hành (Không có: 1, Dân dụng: 2, VP/KD: 3, Y tế/24-7: 4)
    let v6Calc = 1;
    if (json.historyInterview?.continuousOperation247) v6Calc = 4;
    else if (json.historyInterview?.sensitiveEquipment?.has) v6Calc = 3;
    const v6 = viData.v6 !== undefined ? Number(viData.v6) : v6Calc;

    const totalVi = viData.totalVi !== undefined ? Number(viData.totalVi) : (v1 + v2 + v3 + v4 + v5 + v6);
    const viAvg = viData.viAvg !== undefined
      ? parseFloat(Number(viData.viAvg).toFixed(2))
      : parseFloat((totalVi / 6).toFixed(2));

    let viClassVi = 'Thấp';
    let viClassEn = 'Low';
    let vCode: 'V1' | 'V2' | 'V3' | 'V4' = 'V1';
    if (viAvg > 3.25) {
      viClassVi = 'Rất cao';
      viClassEn = 'Very High';
      vCode = 'V4';
    } else if (viAvg > 2.50) {
      viClassVi = 'Cao';
      viClassEn = 'High';
      vCode = 'V3';
    } else if (viAvg > 1.50) {
      viClassVi = 'Trung bình';
      viClassEn = 'Medium';
      vCode = 'V2';
    } else {
      viClassVi = 'Thấp';
      viClassEn = 'Low';
      vCode = 'V1';
    }

    const viItems: ViAssessmentItem[] = [
      {
        code: 'V1',
        title: { vi: 'Công năng & Quy mô', en: 'Building importance & use' },
        basis: { vi: `Nhóm ${objGroup} (Hệ số quy mô: ${v1}đ)`, en: `${objGroup} group (Factor: ${v1} pts)` },
        scale: '0–4',
        score: v1,
      },
      {
        code: 'V2',
        title: { vi: 'Hệ kết cấu chịu lực', en: 'Structural system' },
        basis: { vi: structSys ? `Kết cấu: ${structSys}` : 'Chưa xác định hệ kết cấu', en: structSys ? `System: ${structSys}` : 'Unverified structural system' },
        scale: '1–4',
        score: v2,
      },
      {
        code: 'V3',
        title: { vi: 'Loại móng & Nền đất', en: 'Foundation type & ground condition' },
        basis: { vi: `Căn cứ móng CAT ${catScore}`, en: `Foundation certainty CAT ${catScore}` },
        scale: '1–4',
        score: v3,
      },
      {
        code: 'V4',
        title: { vi: 'Tuổi đời & Cơi nới', en: 'Building age & extension' },
        basis: { vi: `Năm XD ~${constrYear} (~${ageYears} năm)`, en: `Built ~${constrYear} (~${ageYears} yrs)` },
        scale: '1–4',
        score: v4,
      },
      {
        code: 'V5',
        title: { vi: 'Hiện trạng kỹ thuật ECS', en: 'Existing condition ECS' },
        basis: { vi: `ECS = ${totalEcs} (${ecsClassVi}) → ${v5}đ`, en: `ECS = ${totalEcs} (${ecsClassEn}) → ${v5} pts` },
        scale: '1–4',
        score: v5,
      },
      {
        code: 'V6',
        title: { vi: 'Thiết bị nhạy cảm & Vận hành', en: 'Vibration sensitivity & occupancy' },
        basis: { vi: v6 === 1 ? 'Không có thiết bị nhạy cảm rung' : 'Có thiết bị nhạy cảm / vận hành đặc biệt', en: v6 === 1 ? 'No vibration-sensitive equipment' : 'Sensitive equipment recorded' },
        scale: '1–4',
        score: v6,
      },
    ];

    // =========================================================================
    // 3. TÍNH TOÁN CẤP TÁC ĐỘNG THI CÔNG (IMPACT: I1 - I4)
    // =========================================================================
    const parseMeters = (val: string | number | undefined | null): number | null => {
      if (val === undefined || val === null || val === '') return null;
      if (typeof val === 'number') return isNaN(val) ? null : val;
      const cleaned = String(val).trim().replace(/[^\d.]/g, '');
      if (!cleaned) return null;
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    };

    const edgeDist = parseMeters(json.stationEdgeDistance || json.clearanceOffsetDistance || specs.clearanceOffsetDistance);
    const centerDist = parseMeters(json.metroOffsetDistance || specs.metroOffsetDistance);

    const hasStationEdge = edgeDist !== null;
    const distanceType: 'STATION_EDGE' | 'TUNNEL_CENTERLINE' = hasStationEdge ? 'STATION_EDGE' : 'TUNNEL_CENTERLINE';
    const metroOffset = hasStationEdge ? edgeDist : (centerDist !== null ? centerDist : 30);

    const distanceLabel: BilingualText = hasStationEdge
      ? { vi: 'khoảng cách đến biên công trình ga ngầm Metro', en: 'offset to Metro underground station boundary' }
      : { vi: 'khoảng cách đến tim tuyến hầm Metro', en: 'offset to Metro tunnel centerline' };

    const isSpecialObj = objGroup === 'CRITICAL' || objGroup === 'IMPORTANT';
    let iCode: 'I1' | 'I2' | 'I3' | 'I4' = 'I1';
    let impactVi = 'Thấp';
    let impactEn = 'Low';

    if (isSpecialObj) {
      if (metroOffset >= 30) { iCode = 'I1'; impactVi = 'Thấp'; impactEn = 'Low'; }
      else if (metroOffset >= 20) { iCode = 'I2'; impactVi = 'Trung bình'; impactEn = 'Medium'; }
      else if (metroOffset >= 10) { iCode = 'I3'; impactVi = 'Cao'; impactEn = 'High'; }
      else { iCode = 'I4'; impactVi = 'Rất cao'; impactEn = 'Very High'; }
    } else {
      if (metroOffset >= 20) { iCode = 'I1'; impactVi = 'Thấp'; impactEn = 'Low'; }
      else if (metroOffset >= 10) { iCode = 'I2'; impactVi = 'Trung bình'; impactEn = 'Medium'; }
      else if (metroOffset >= 5) { iCode = 'I3'; impactVi = 'Cao'; impactEn = 'High'; }
      else { iCode = 'I4'; impactVi = 'Rất cao'; impactEn = 'Very High'; }
    }

    // =========================================================================
    // 4. MA TRẬN ĐÁNH GIÁ RỦI RO CƠ SỞ BRA (4x4 GRID VỚI HIGHLIGHT)
    // =========================================================================
    const rawLookup: Record<'V1' | 'V2' | 'V3' | 'V4', Record<'I1' | 'I2' | 'I3' | 'I4', { riskLevel: 'Low' | 'Medium' | 'High' | 'Very High'; riskLevelVi: string; riskLevelEn: string; recVi: string; recEn: string }>> = {
      V1: {
        I1: { riskLevel: 'Low', riskLevelVi: 'Rủi ro thấp', riskLevelEn: 'Low Risk', recVi: 'Công trình ít nhạy cảm, nằm ngoài vùng ảnh hưởng chính. Theo dõi định kỳ.', recEn: 'Low vulnerability, outside main influence zone. Periodic monitoring.' },
        I2: { riskLevel: 'Low', riskLevelVi: 'Rủi ro thấp', riskLevelEn: 'Low Risk', recVi: 'Khảo sát hiện trạng bình thường, theo dõi chu kỳ định kỳ.', recEn: 'Normal baseline condition, periodic monitoring recommended.' },
        I3: { riskLevel: 'Medium', riskLevelVi: 'Rủi ro trung bình', riskLevelEn: 'Medium Risk', recVi: 'Nằm gần tuyến thi công. Thiết lập mốc quan trắc lún trước khi đào hầm.', recEn: 'Close to alignment. Establish settlement monitoring pins before excavation.' },
        I4: { riskLevel: 'High', riskLevelVi: 'Rủi ro cao', riskLevelEn: 'High Risk', recVi: 'Khoảng cách rất gần tim hầm. Cần kiểm tra kỹ móng và lập phương án giám sát 24/7.', recEn: 'Very close to tunnel. Foundation check and 24/7 monitoring plan required.' },
      },
      V2: {
        I1: { riskLevel: 'Low', riskLevelVi: 'Rủi ro thấp', riskLevelEn: 'Low Risk', recVi: 'Khoảng cách an toàn bù đắp độ tổn thương trung bình. Khảo sát định kỳ.', recEn: 'Safe distance compensates for moderate vulnerability. Periodic survey.' },
        I2: { riskLevel: 'Medium', riskLevelVi: 'Rủi ro trung bình', riskLevelEn: 'Medium Risk', recVi: 'Cần quan trắc lún chênh và theo dõi sự phát triển của các vết nứt hiện hữu.', recEn: 'Monitor differential settlement and progression of existing cracks.' },
        I3: { riskLevel: 'Medium', riskLevelVi: 'Rủi ro trung bình', riskLevelEn: 'Medium Risk', recVi: 'Đo đạc biên độ rung động khi máy TBM đào qua hoặc thi công hố đào.', recEn: 'Measure vibration amplitudes during TBM tunneling or excavation.' },
        I4: { riskLevel: 'High', riskLevelVi: 'Rủi ro cao', riskLevelEn: 'High Risk', recVi: 'Bắt buộc lắp cảm biến đo lún thời gian thực và khảo sát trước - sau thi công.', recEn: 'Real-time settlement sensors and pre/post construction surveys required.' },
      },
      V3: {
        I1: { riskLevel: 'Medium', riskLevelVi: 'Rủi ro trung bình', riskLevelEn: 'Medium Risk', recVi: 'Công trình có độ tổn thương cao (kết cấu yếu/tuổi thọ cao). Theo dõi sát lún chênh.', recEn: 'Higher vulnerability (structural system/age). Closely monitor differential settlement.' },
        I2: { riskLevel: 'Medium', riskLevelVi: 'Rủi ro trung bình', riskLevelEn: 'Medium Risk', recVi: 'Khuyến nghị trám vá gia cố các vị trí nứt kết cấu trước khi thi công ngầm.', recEn: 'Local structural repairs recommended prior to tunneling.' },
        I3: { riskLevel: 'High', riskLevelVi: 'Rủi ro cao', riskLevelEn: 'High Risk', recVi: 'Khả năng phát sinh nứt mới hoặc nứt rộng lớn. Cần lập biện pháp bảo vệ kết cấu.', recEn: 'Potential for new or widened cracks. Structural protection plan needed.' },
        I4: { riskLevel: 'Very High', riskLevelVi: 'Rủi ro rất cao', riskLevelEn: 'Very High Risk', recVi: 'Nguy cơ mất ổn định cao. Bắt buộc có phương án chống đỡ / gia cường móng trước thi công.', recEn: 'High instability risk. Emergency underpinning/shoring plan mandatory.' },
      },
      V4: {
        I1: { riskLevel: 'High', riskLevelVi: 'Rủi ro cao', riskLevelEn: 'High Risk', recVi: 'Công trình thuộc nhóm đặc biệt nhạy cảm hoặc nguy cấp. Kiểm toán an toàn trước thi công.', recEn: 'Special sensitivity or critical condition. Pre-construction safety audit required.' },
        I2: { riskLevel: 'High', riskLevelVi: 'Rủi ro cao', riskLevelEn: 'High Risk', recVi: 'Quan trắc chuyên sâu liên tục và kiểm toán an toàn trước khi máy TBM đi qua.', recEn: 'Intensive continuous monitoring and safety audit required.' },
        I3: { riskLevel: 'Very High', riskLevelVi: 'Rủi ro rất cao', riskLevelEn: 'Very High Risk', recVi: 'Tiềm ẩn nguy cơ mất ổn định kết cấu nghiêm trọng khi đào ngầm. Họp chuyên gia xử lý.', recEn: 'High potential for structural instability during tunneling. Expert review needed.' },
        I4: { riskLevel: 'Very High', riskLevelVi: 'Rủi ro rất cao', riskLevelEn: 'Very High Risk', recVi: 'Nguy cấp tối đa. Bắt buộc Hội đồng chuyên môn Metro họp thẩm tra và xử lý đặc biệt.', recEn: 'Critical maximum risk. Specialized engineering intervention mandatory.' },
      },
    };

    const vKeys: Array<'V1' | 'V2' | 'V3' | 'V4'> = ['V1', 'V2', 'V3', 'V4'];
    const iKeys: Array<'I1' | 'I2' | 'I3' | 'I4'> = ['I1', 'I2', 'I3', 'I4'];

    const braRows: BraMatrixRow[] = vKeys.map((vk) => {
      const vLabelVi = vk === 'V1' ? 'V1 (Thấp / Low)' : vk === 'V2' ? 'V2 (Trung bình / Medium)' : vk === 'V3' ? 'V3 (Cao / High)' : 'V4 (Rất cao / Very High)';
      const vLabelEn = vk === 'V1' ? 'V1 (Low ≤ 1.50)' : vk === 'V2' ? 'V2 (Medium 1.51–2.50)' : vk === 'V3' ? 'V3 (High 2.51–3.25)' : 'V4 (Very High > 3.25)';

      const cells: BraMatrixCell[] = iKeys.map((ik) => {
        const item = rawLookup[vk][ik];
        const isCur = (vk === vCode && ik === iCode);
        return {
          vCode: vk,
          iCode: ik,
          riskLevel: item.riskLevel,
          riskLevelVi: item.riskLevelVi,
          riskLevelEn: item.riskLevelEn,
          badgeBg: item.riskLevel === 'Low' ? '#dcfce7' : item.riskLevel === 'Medium' ? '#fef3c7' : item.riskLevel === 'High' ? '#fed7aa' : '#fee2e2',
          isCurrent: isCur,
        };
      });

      return {
        vCode: vk,
        vLabel: { vi: vLabelVi, en: vLabelEn },
        cells,
      };
    });

    const activeLookup = rawLookup[vCode][iCode];
    const finalRiskLevel = {
      vi: activeLookup.riskLevelVi,
      en: activeLookup.riskLevelEn,
    };
    const recommendation = {
      vi: activeLookup.recVi,
      en: activeLookup.recEn,
    };

    const braNarrative = {
      vi: `Ma trận rủi ro cơ sở BRA (Phase 1): Cấp độ tổn thương ${vCode} (${viClassVi}) × Cấp tác động thi công ${iCode} (${impactVi}, ${distanceLabel.vi} ${metroOffset}m) → Cấp rủi ro tổng thể: ${finalRiskLevel.vi}.`,
      en: `Phase 1 BRA Matrix: Vulnerability ${vCode} (${viClassEn}) × Impact ${iCode} (${impactEn}, ${distanceLabel.en} ${metroOffset}m) → Overall Baseline Risk: ${finalRiskLevel.en}.`,
    };

    const flagDisplay = flagLevel === 'NONE' ? 'None' : flagLevel === 'LOW' ? 'Low' : flagLevel === 'MODERATE' ? 'Moderate' : flagLevel === 'HIGH' ? 'High' : flagLevel === 'CRITICAL' ? 'Critical' : 'None';

    // Engineering Judgement cho ECS (Ưu tiên từ phiếu khảo sát FE survey_data_json, fallback sang DB risk_score_cards)
    const ecsJudgementRaw = ecsData.engineeringJudgement || {};
    const ecsActionRaw = ecsJudgementRaw.action || rScores?.engineering_judgement_action || 'KEEP';
    let ecsAction: 'KEEP' | 'UPGRADE' | 'DOWNGRADE' = 'KEEP';
    if (ecsActionRaw === 'UPGRADE' || ecsActionRaw === 'UP') ecsAction = 'UPGRADE';
    else if (ecsActionRaw === 'DOWNGRADE' || ecsActionRaw === 'DOWN') ecsAction = 'DOWNGRADE';
    const ecsReason = ecsJudgementRaw.reason || rScores?.engineering_judgement_reason || '';
    const isEcsJudgementApplied = ecsAction !== 'KEEP' || Boolean(rScores?.is_engineering_judgement_applied);

    // Engineering Judgement cho VI (Ưu tiên từ phiếu khảo sát FE survey_data_json, fallback sang DB risk_score_cards)
    const viJudgementRaw = viData.engineeringJudgement || {};
    const viActionRaw = viJudgementRaw.action || rScores?.engineering_judgement_action || 'KEEP';
    let viAction: 'KEEP' | 'UPGRADE' | 'DOWNGRADE' = 'KEEP';
    if (viActionRaw === 'UPGRADE' || viActionRaw === 'UP') viAction = 'UPGRADE';
    else if (viActionRaw === 'DOWNGRADE' || viActionRaw === 'DOWN') viAction = 'DOWNGRADE';
    const viReason = viJudgementRaw.reason || rScores?.engineering_judgement_reason || '';
    const isViJudgementApplied = viAction !== 'KEEP' || Boolean(rScores?.is_engineering_judgement_applied);

    return {
      ecs: {
        items: ecsItems,
        totalScore: totalEcs,
        classGrade: { vi: ecsClassVi, en: ecsClassEn },
        burlandPredominantGrade: burlandPredominantGrade ?? (json.burlandSummary?.predominantGrade ?? 0),
        burlandLocalMaxGrade: e1BurlandGrade,
        structuralFlag: flagDisplay,
        isOverrideLocked: e2 >= 3 || e3 >= 3,
        engineeringJudgement: {
          isApplied: isEcsJudgementApplied,
          action: ecsAction,
          reason: ecsReason,
        },
      },
      vi: {
        items: viItems,
        totalScore: totalVi,
        averageScore: viAvg,
        classGrade: { vi: viClassVi, en: viClassEn },
        vCode,
        foundationCatScore: catScore,
        engineeringJudgement: {
          isApplied: isViJudgementApplied,
          action: viAction,
          reason: viReason,
        },
      },
      impact: {
        code: iCode,
        levelText: { vi: impactVi, en: impactEn },
        distanceM: metroOffset,
        distanceType,
        distanceLabel,
        basis: {
          vi: `Căn cứ ${distanceLabel.vi}: ${metroOffset} m (${isSpecialObj ? 'Công trình trọng yếu' : 'Công trình thông thường'})`,
          en: `Based on ${distanceLabel.en}: ${metroOffset} m (${isSpecialObj ? 'Critical/Important' : 'General'})`,
        },
      },
      braMatrix: {
        vCode,
        iCode,
        rows: braRows,
        finalRiskLevel,
        recommendation,
        narrative: braNarrative,
      },
      overallRisk: {
        grade: finalRiskLevel,
        narrative: {
          vi: `Dựa trên kết quả khảo sát hiện trạng công trình (Total ECS = ${totalEcs}/24, Cấp ${ecsClassVi}) và chỉ số tính dễ bị tổn thương (VI = ${viAvg}, Cấp ${viClassVi}), ma trận rủi ro công trình trước thi công (BRA) xác định: ${finalRiskLevel.vi}. ${recommendation.vi}`,
          en: `Based on building condition survey (Total ECS = ${totalEcs}/24, ${ecsClassEn}) and vulnerability index (VI = ${viAvg}, ${viClassEn}), pre-construction building risk assessment (BRA) is: ${finalRiskLevel.en}. ${recommendation.en}`,
        },
      },
      // Backward compatibility fields
      riskMatrix: {
        ecsGrade: { vi: ecsClassVi, en: ecsClassEn },
        burlandGrade: e1BurlandGrade,
        baselineRisk: finalRiskLevel,
        narrative: braNarrative,
      },
    };
  }
}
