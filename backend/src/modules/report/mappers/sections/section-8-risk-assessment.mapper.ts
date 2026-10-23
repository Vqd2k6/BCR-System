/**
 * ============================================================================
 * SECTION 8 RISK ASSESSMENT MAPPER (READ-ONLY — ZERO CALCULATE)
 * Đọc trực tiếp 1:1 các chỉ số ECS (E1–E6, Total ECS, Class), VI (V1–V6, Total VI,
 * Avg VI, Class), Impact (I1–I4) và Ma trận BRA 4x4 từ dữ liệu đã lưu/phê duyệt.
 * ============================================================================
 */

import {
  Section8BuildingConditionAssessment,
  EcsAssessmentItem,
  ViAssessmentItem,
  BilingualText,
} from '../../report.types';
import { BRA_MATRIX_LOOKUP, buildBraMatrixRows } from './bra-matrix.mapper';

function pickNum(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue;
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export class Section8RiskAssessmentMapper {
  public static map(
    rawReport: any,
    burlandMaxGrade?: number | null,
    burlandPredominantGrade?: number | null
  ): Section8BuildingConditionAssessment {
    const json = rawReport.survey_data_json || {};
    const ecsData = json.ecs || {};
    const viData = json.vi || {};
    const specs = rawReport.buildingSpecs || json || {};
    const rScores = rawReport.riskScores;

    // 1. ĐỌC 1:1 BẢNG ECS (E1–E6 & TOTAL ECS) — ZERO CALCULATE
    const e1 = pickNum(ecsData.e1, rScores?.e1_burland_score) ?? 0;
    const e2 = pickNum(ecsData.e2, rScores?.e2_structure_score) ?? 0;
    const e3 = pickNum(ecsData.e3, rScores?.e3_deformation_score) ?? 0;
    const e4 = pickNum(ecsData.e4, rScores?.e4_material_score, rScores?.e4_degradation_score) ?? 0;
    const e5 = pickNum(ecsData.e5, rScores?.e5_history_score) ?? 0;
    const e6 = pickNum(ecsData.e6, rScores?.e6_overall_function_score, rScores?.e6_serviceability_score) ?? 0;

    const totalEcs = (rScores?.is_engineering_judgement_applied && pickNum(rScores?.overridden_total_ecs) !== null)
      ? Number(rScores.overridden_total_ecs)
      : (pickNum(ecsData.totalEcs, rScores?.total_ecs_score) ?? 0);

    const savedBurlandMax = burlandMaxGrade ?? pickNum(json.burlandSummary?.localMaxGrade) ?? 0;
    const savedFlagLevel = String(json.burlandSummary?.structuralFlagLevel || 'NONE').toUpperCase();

    const frozenEcsClass = String(
      (rScores?.is_engineering_judgement_applied && rScores?.overridden_ecs_class)
        ? rScores.overridden_ecs_class
        : (ecsData.ecsClass || rScores?.ecs_class || '')
    ).trim().toUpperCase();

    let ecsClassVi = '--';
    let ecsClassEn = '--';
    if (frozenEcsClass === 'CRITICAL' || frozenEcsClass === 'NGUY HIỂM' || frozenEcsClass === 'VERY_HIGH') { ecsClassVi = 'Nguy hiểm'; ecsClassEn = 'Critical'; }
    else if (frozenEcsClass === 'DEFICIENT' || frozenEcsClass === 'KÉM' || frozenEcsClass === 'HIGH') { ecsClassVi = 'Kém'; ecsClassEn = 'Deficient'; }
    else if (frozenEcsClass === 'MEDIUM' || frozenEcsClass === 'MODERATE' || frozenEcsClass === 'TRUNG BÌNH') { ecsClassVi = 'Trung bình'; ecsClassEn = 'Medium'; }
    else if (frozenEcsClass === 'GOOD' || frozenEcsClass === 'VERY_LOW' || frozenEcsClass === 'LOW' || frozenEcsClass === 'TỐT') { ecsClassVi = 'Tốt'; ecsClassEn = 'Good'; }

    const ecsItems: EcsAssessmentItem[] = [
      { code: 'E1', title: { vi: 'Hư hỏng nhìn thấy tường / khối xây', en: 'Visible damage to walls / masonry' }, basis: { vi: `Burland cục bộ lớn nhất: Cấp ${savedBurlandMax}`, en: `Local max Burland grade: Grade ${savedBurlandMax}` }, scale: '0-4', score: e1 },
      { code: 'E2', title: { vi: 'Khuyết tật kết cấu cột/dầm/sàn/tường', en: 'Structural defects in columns/beams/slabs' }, basis: { vi: `Cờ kết cấu chịu lực: ${savedFlagLevel}`, en: `Structural flag level: ${savedFlagLevel}` }, scale: '0-4', score: e2 },
      { code: 'E3', title: { vi: 'Biến dạng Lún / Nghiêng / Võng', en: 'Deformation (Settlement / Tilt / Deflection)' }, basis: { vi: e3 === 0 ? 'Mức 0/4đ theo đánh giá hiện trường (không ghi nhận biến dạng)' : `Phát hiện biến dạng hiện trường (Mức ${e3}/4đ)`, en: e3 === 0 ? 'Level 0/4 per field assessment (no deformation recorded)' : `Deformation detected on-site (Level ${e3}/4)` }, scale: '0-4', score: e3 },
      { code: 'E4', title: { vi: 'Suy giảm vật liệu / độ bền lâu', en: 'Material degradation' }, basis: { vi: e4 === 0 ? 'Mức 0/4đ theo đánh giá đã xác nhận (không ghi nhận suy giảm vật liệu)' : `Ghi nhận suy giảm vật liệu (Mức ${e4}/4đ)`, en: e4 === 0 ? 'Level 0/4 per confirmed assessment (no material degradation recorded)' : `Material degradation observed (Level ${e4}/4)` }, scale: '0-4', score: e4 },
      { code: 'E5', title: { vi: 'Lịch sử / cơi nới / sự cố & toàn vẹn', en: 'Historical sensitivity & structural integrity' }, basis: { vi: e5 === 0 ? 'Mức 0/4đ theo lịch sử đã ghi nhận (không có sự cố được khai báo)' : `Tiền sử sửa chữa/sự cố ghi nhận (Mức ${e5}/4đ)`, en: e5 === 0 ? 'Level 0/4 per recorded history (no incident reported)' : `Reported past repairs/incidents (Level ${e5}/4)` }, scale: '0-4', score: e5 },
      { code: 'E6', title: { vi: 'Tình trạng chức năng / tổng thể', en: 'Overall serviceability & functional condition' }, basis: { vi: e6 === 0 ? 'Mức 0/4đ theo đánh giá đã xác nhận (không ghi nhận ảnh hưởng công năng)' : `Ảnh hưởng công năng vận hành (Mức ${e6}/4đ)`, en: e6 === 0 ? 'Level 0/4 per confirmed assessment (no functional impact recorded)' : `Functional serviceability impact (Level ${e6}/4)` }, scale: '0-4', score: e6 },
    ];

    // 2. ĐỌC 1:1 BẢNG VI (V1–V6, TOTAL VI, AVG VI) — ZERO CALCULATE
    const objGroup = (json.objectGroup || specs.building_grade || 'GENERAL').toUpperCase();
    const structSys = json.structureSystem || specs.structuralType || '';
    const catRaw = json.foundationCatScore ?? specs.foundationCatScore;
    const catNum = catRaw === undefined || catRaw === null || catRaw === '' ? NaN : Number(catRaw);
    const catScore: number | null = Number.isInteger(catNum) && catNum >= 1 && catNum <= 5 ? catNum : null;
    const rawConstrYear = specs.constructionYear || specs.year_of_construction || json.constructionYear;

    const v1 = pickNum(viData.v1, rScores?.v1_importance_score);
    const v2 = pickNum(viData.v2, rScores?.v2_structure_score);
    const v3 = pickNum(viData.v3, rScores?.v3_foundation_score);
    const v4 = pickNum(viData.v4, rScores?.v4_age_score);
    const v5 = pickNum(viData.v5, rScores?.v5_ecs_score, rScores?.v5_condition_score);
    const v6 = pickNum(viData.v6, rScores?.v6_sensitivity_score, rScores?.v6_environment_score);

    const totalVi = pickNum(viData.totalVi, rScores?.total_vi_score);
    const rawSavedViAvg = (rScores?.is_engineering_judgement_applied && pickNum(rScores?.overridden_avg_vi) !== null)
      ? Number(rScores.overridden_avg_vi)
      : pickNum(viData.viAvg, viData.avgVi, rScores?.avg_vi_score);
    const viAvg = rawSavedViAvg !== null ? parseFloat(rawSavedViAvg.toFixed(2)) : null;

    const frozenViClass = String(
      (rScores?.is_engineering_judgement_applied && rScores?.overridden_vi_class)
        ? rScores.overridden_vi_class
        : (viData.viClass || rScores?.vi_class || '')
    ).trim().toUpperCase();

    let viClassVi = '--';
    let viClassEn = '--';
    let vCode: 'V1' | 'V2' | 'V3' | 'V4' | null = null;
    if (frozenViClass === 'VERY_HIGH' || frozenViClass === 'VERY HIGH' || frozenViClass === 'RẤT CAO' || frozenViClass === 'V4') { viClassVi = 'Rất cao'; viClassEn = 'Very High'; vCode = 'V4'; }
    else if (frozenViClass === 'HIGH' || frozenViClass === 'CAO' || frozenViClass === 'V3') { viClassVi = 'Cao'; viClassEn = 'High'; vCode = 'V3'; }
    else if (frozenViClass === 'MEDIUM' || frozenViClass === 'MODERATE' || frozenViClass === 'TRUNG BÌNH' || frozenViClass === 'V2') { viClassVi = 'Trung bình'; viClassEn = 'Medium'; vCode = 'V2'; }
    else if (frozenViClass === 'LOW' || frozenViClass === 'VERY_LOW' || frozenViClass === 'THẤP' || frozenViClass === 'V1') { viClassVi = 'Thấp'; viClassEn = 'Low'; vCode = 'V1'; }

    const viItemsRaw: Array<Omit<ViAssessmentItem, 'scoreDisplay'>> = [
      { code: 'V1', title: { vi: 'Công năng & Quy mô', en: 'Building importance & use' }, basis: { vi: `Nhóm ${objGroup} (Hệ số quy mô: ${v1 ?? '--'}đ)`, en: `${objGroup} group (Factor: ${v1 ?? '--'} pts)` }, scale: '0-4', score: v1 },
      { code: 'V2', title: { vi: 'Hệ kết cấu chịu lực', en: 'Structural system' }, basis: { vi: structSys ? `Kết cấu: ${structSys}` : 'Chưa xác định hệ kết cấu', en: structSys ? `System: ${structSys}` : 'Unverified structural system' }, scale: '1-4', score: v2 },
      { code: 'V3', title: { vi: 'Loại móng & Nền đất', en: 'Foundation type & ground condition' }, basis: catScore === null ? { vi: 'Chưa xác định CAT móng', en: 'Foundation CAT not determined' } : { vi: `Căn cứ móng CAT ${catScore}`, en: `Foundation certainty CAT ${catScore}` }, scale: '1-4', score: v3 },
      { code: 'V4', title: { vi: 'Tuổi đời & Cơi nới', en: 'Building age & extension' }, basis: rawConstrYear ? { vi: `Năm XD: ${rawConstrYear}`, en: `Built year: ${rawConstrYear}` } : { vi: 'Chưa có dữ liệu năm xây dựng', en: 'Built year not recorded' }, scale: '1-4', score: v4 },
      { code: 'V5', title: { vi: 'Hiện trạng kỹ thuật ECS', en: 'Existing condition ECS' }, basis: { vi: `ECS = ${totalEcs} (${ecsClassVi}) → ${v5 ?? '--'}đ`, en: `ECS = ${totalEcs} (${ecsClassEn}) → ${v5 ?? '--'} pts` }, scale: '1-4', score: v5 },
      { code: 'V6', title: { vi: 'Thiết bị nhạy cảm & Vận hành', en: 'Vibration sensitivity & occupancy' }, basis: { vi: v6 === 1 ? 'Không có thiết bị nhạy cảm rung' : v6 !== null ? 'Có thiết bị nhạy cảm / vận hành đặc biệt' : '--', en: v6 === 1 ? 'No vibration-sensitive equipment' : v6 !== null ? 'Sensitive equipment recorded' : '--' }, scale: '1-4', score: v6 },
    ];
    const viItems: ViAssessmentItem[] = viItemsRaw.map((it) => ({ ...it, scoreDisplay: it.score === null ? '--' : String(it.score) }));

    // 3. ĐỌC 1:1 CẤP TÁC ĐỘNG THI CÔNG (IMPACT: I1–I4) — ZERO CALCULATE
    const frozenImpact = json.impactAssessment || {};
    const edgeDist = pickNum(json.stationEdgeDistance, json.clearanceOffsetDistance, json.distanceToTunnelEdgeM, specs.clearanceOffsetDistance);
    const centerDist = pickNum(json.manualMetroDistanceM, json.distanceToMetroM, json.metroOffsetDistance, specs.metroOffsetDistance, rawReport.distance_to_centerline_m);
    const hasStationEdge = frozenImpact.distanceType ? frozenImpact.distanceType === 'STATION_EDGE' : edgeDist !== null;
    const distanceType: 'STATION_EDGE' | 'TUNNEL_CENTERLINE' = hasStationEdge ? 'STATION_EDGE' : 'TUNNEL_CENTERLINE';
    const metroOffset: number | string = pickNum(frozenImpact.distanceM) ?? (hasStationEdge && edgeDist !== null ? edgeDist : (centerDist !== null ? centerDist : '--'));

    const distanceLabel: BilingualText = hasStationEdge
      ? { vi: 'khoảng cách đến biên công trình ga ngầm Metro', en: 'offset to Metro underground station boundary' }
      : { vi: 'khoảng cách đến tim tuyến hầm Metro', en: 'offset to Metro tunnel centerline' };

    const execImpactStr = String(json.executiveSummary?.constructionImpactStatus || '').toUpperCase();
    const execImpactMatch = execImpactStr.match(/\b(I[1-4])\b/);
    const cardOverriddenImpact = rScores?.overridden_impact_level_i ? `I${rScores.overridden_impact_level_i}` : null;
    const rawImpactCode = String(
      frozenImpact.iCode || frozenImpact.code || execImpactMatch?.[1] || cardOverriddenImpact || rScores?.impact_grade ||
      (rScores?.impact_level_i ? `I${String(rScores?.impact_level_i || '').replace(/^I/i, '')}` : '')
    ).toUpperCase();

    const fallbackImpactStr = String(frozenImpact.iCode || frozenImpact.code || execImpactMatch?.[1] || cardOverriddenImpact || rScores?.impact_grade || '').toUpperCase();
    const validImpactCode: 'I1' | 'I2' | 'I3' | 'I4' | '--' = ['I1', 'I2', 'I3', 'I4'].includes(rawImpactCode)
      ? (rawImpactCode as 'I1' | 'I2' | 'I3' | 'I4')
      : (['I1', 'I2', 'I3', 'I4'].includes(fallbackImpactStr) ? (fallbackImpactStr as 'I1' | 'I2' | 'I3' | 'I4') : '--');

    let impactVi = '--';
    let impactEn = '--';
    if (validImpactCode === 'I1') { impactVi = frozenImpact.levelVi || 'Thấp'; impactEn = frozenImpact.levelEn || 'Low'; }
    else if (validImpactCode === 'I2') { impactVi = frozenImpact.levelVi || 'Trung bình'; impactEn = frozenImpact.levelEn || 'Medium'; }
    else if (validImpactCode === 'I3') { impactVi = frozenImpact.levelVi || 'Cao'; impactEn = frozenImpact.levelEn || 'High'; }
    else if (validImpactCode === 'I4') { impactVi = frozenImpact.levelVi || 'Rất cao'; impactEn = frozenImpact.levelEn || 'Very High'; }

    // 4. MA TRẬN ĐÁNH GIÁ RỦI RO CƠ SỞ BRA (4x4 GRID VỚI HIGHLIGHT)
    const braRows = buildBraMatrixRows(vCode, validImpactCode);
    const frozenBra = json.braAssessment || {};
    const activeLookup = (vCode !== null && validImpactCode !== '--') ? BRA_MATRIX_LOOKUP[vCode][validImpactCode] : null;
    const rawExplicitBra = String(frozenBra.braStatus || frozenBra.finalRiskLevelVi || frozenBra.riskLevelVi || rScores?.overridden_bra || rScores?.final_bra_grade || '').toUpperCase();

    let explicitBraLevel: { vi: string; en: string } | null = null;
    if (rawExplicitBra === 'VERY_LOW' || rawExplicitBra === 'LOW' || rawExplicitBra.includes('THẤP')) explicitBraLevel = { vi: 'Rủi ro thấp', en: 'Low Risk' };
    else if (rawExplicitBra === 'MEDIUM' || rawExplicitBra === 'MODERATE' || rawExplicitBra.includes('TRUNG BÌNH')) explicitBraLevel = { vi: 'Rủi ro trung bình', en: 'Medium Risk' };
    else if (rawExplicitBra === 'HIGH' || (rawExplicitBra.includes('CAO') && !rawExplicitBra.includes('RẤT CAO'))) explicitBraLevel = { vi: 'Rủi ro cao', en: 'High Risk' };
    else if (rawExplicitBra === 'VERY_HIGH' || rawExplicitBra === 'CRITICAL' || rawExplicitBra.includes('RẤT CAO')) explicitBraLevel = { vi: 'Rủi ro rất cao', en: 'Very High Risk' };

    const finalRiskLevel = explicitBraLevel || (activeLookup
      ? { vi: frozenBra.finalRiskLevelVi || frozenBra.riskLevelVi || activeLookup.riskLevelVi, en: frozenBra.finalRiskLevelEn || frozenBra.riskLevelEn || activeLookup.riskLevelEn }
      : { vi: '--', en: '--' });
    const recommendation = activeLookup ? { vi: activeLookup.recVi, en: activeLookup.recEn } : { vi: '--', en: '--' };

    const braNarrative = {
      vi: `Ma trận rủi ro cơ sở BRA (Phase 1): Cấp độ tổn thương ${vCode ?? '--'} (${viClassVi}) × Cấp tác động thi công ${validImpactCode} (${impactVi}, ${distanceLabel.vi} ${metroOffset}m) → Cấp rủi ro tổng thể: ${finalRiskLevel.vi}.`,
      en: `Phase 1 BRA Matrix: Vulnerability ${vCode ?? '--'} (${viClassEn}) × Impact ${validImpactCode} (${impactEn}, ${distanceLabel.en} ${metroOffset}m) → Overall Baseline Risk: ${finalRiskLevel.en}.`,
    };

    const flagDisplay = savedFlagLevel === 'NONE' ? 'None' : savedFlagLevel === 'LOW' ? 'Low' : savedFlagLevel === 'MODERATE' ? 'Moderate' : savedFlagLevel === 'HIGH' ? 'High' : savedFlagLevel === 'CRITICAL' ? 'Critical' : 'None';
    const parseAction = (rawAct: string): 'KEEP' | 'UPGRADE' | 'DOWNGRADE' | 'CUSTOM_OVERRIDE' => {
      const u = rawAct.toUpperCase();
      if (u === 'UPGRADE' || u === 'UP') return 'UPGRADE';
      if (u === 'DOWNGRADE' || u === 'DOWN') return 'DOWNGRADE';
      if (u === 'CUSTOM_OVERRIDE') return 'CUSTOM_OVERRIDE';
      return 'KEEP';
    };

    const ecsAction = parseAction(String(ecsData.engineeringJudgement?.action || rScores?.engineering_judgement_action || 'KEEP'));
    const ecsReason = ecsData.engineeringJudgement?.reason || rScores?.engineering_judgement_reason || '';
    const isEcsJudgementApplied = ecsAction !== 'KEEP' || Boolean(rScores?.is_engineering_judgement_applied);

    const viAction = parseAction(String(viData.engineeringJudgement?.action || rScores?.engineering_judgement_action || 'KEEP'));
    const viReason = viData.engineeringJudgement?.reason || rScores?.engineering_judgement_reason || '';
    const isViJudgementApplied = viAction !== 'KEEP' || Boolean(rScores?.is_engineering_judgement_applied);

    return {
      ecs: {
        items: ecsItems,
        totalScore: totalEcs,
        classGrade: { vi: ecsClassVi, en: ecsClassEn },
        burlandPredominantGrade: burlandPredominantGrade ?? (pickNum(json.burlandSummary?.predominantGrade) ?? 0),
        burlandLocalMaxGrade: savedBurlandMax,
        structuralFlag: flagDisplay,
        isOverrideLocked: e2 >= 3 || e3 >= 3,
        engineeringJudgement: { isApplied: isEcsJudgementApplied, action: ecsAction, reason: ecsReason },
      },
      vi: {
        items: viItems,
        totalScore: totalVi,
        averageScore: viAvg,
        classGrade: { vi: viClassVi, en: viClassEn },
        vCode,
        foundationCatScore: catScore ?? undefined,
        foundationCatDisplay: catScore === null ? '--' : `Cat ${catScore} / 5`,
        totalScoreDisplay: totalVi === null ? '--' : String(totalVi),
        averageScoreDisplay: viAvg === null ? '--' : viAvg.toFixed(2),
        engineeringJudgement: { isApplied: isViJudgementApplied, action: viAction, reason: viReason },
      },
      impact: {
        code: validImpactCode,
        levelText: { vi: impactVi, en: impactEn },
        distanceM: metroOffset,
        distanceType,
        distanceLabel,
        basis: { vi: `Căn cứ ${distanceLabel.vi}: ${metroOffset} m`, en: `Based on ${distanceLabel.en}: ${metroOffset} m` },
      },
      braMatrix: { vCode, iCode: validImpactCode, rows: braRows, finalRiskLevel, recommendation, narrative: braNarrative },
      overallRisk: {
        grade: finalRiskLevel,
        narrative: {
          vi: `Dựa trên kết quả khảo sát hiện trạng công trình (Total ECS = ${totalEcs}/24, Cấp ${ecsClassVi}) và chỉ số tính dễ bị tổn thương (VI = ${viAvg ?? '--'}, Cấp ${viClassVi}), ma trận rủi ro công trình trước thi công (BRA) xác định: ${finalRiskLevel.vi}. ${recommendation.vi}`,
          en: `Based on building condition survey (Total ECS = ${totalEcs}/24, ${ecsClassEn}) and vulnerability index (VI = ${viAvg ?? '--'}, ${viClassEn}), pre-construction building risk assessment (BRA) is: ${finalRiskLevel.en}. ${recommendation.en}`,
        },
      },
      riskMatrix: {
        ecsGrade: { vi: ecsClassVi, en: ecsClassEn },
        burlandGrade: savedBurlandMax,
        baselineRisk: finalRiskLevel,
        narrative: braNarrative,
      },
    };
  }
}

