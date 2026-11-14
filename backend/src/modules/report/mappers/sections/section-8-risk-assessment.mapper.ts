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
import { buildBraMatrixRows } from './bra-matrix.mapper';
import {
  isRecord,
  pickNum,
  resolveTotalEcs,
  resolveEcsClassRaw,
  normalizeEcsClass,
  resolveViScores,
  resolveViClassRaw,
  normalizeViClassToVCode,
  resolveObjectGroup,
  resolveImpact,
  resolveExplicitBraRaw,
  normalizeBraLevel,
  BRA_LEVEL_TEXT,
  lookupBraCell,
} from './risk-resolvers';
import type { EcsClassCode, VulnerabilityCode } from './risk-resolvers';
import { FOUNDATION_CAT_LABELS, FOUNDATION_CAT_UNKNOWN } from './foundation-cat-labels';

/** Tên mức cờ kết cấu như ô chọn ở Bước 4 KSV (không in mã thô NONE/MODERATE). */
const STRUCTURAL_FLAG_LABELS: Record<string, BilingualText> = {
  NONE: { vi: 'Không có cờ kết cấu', en: 'No structural flag' },
  LOW: { vi: 'Thấp', en: 'Low' },
  MODERATE: { vi: 'Trung bình', en: 'Moderate' },
  HIGH: { vi: 'Cao / Nguy cơ chịu lực', en: 'High / Load-bearing risk' },
  CRITICAL: { vi: 'Nguy cấp / Cảnh báo sập', en: 'Critical / Collapse warning' },
};

const ECS_CLASS_TEXT: Record<EcsClassCode, BilingualText> = {
  CRITICAL: { vi: 'Nguy hiểm', en: 'Critical' },
  DEFICIENT: { vi: 'Kém', en: 'Deficient' },
  MEDIUM: { vi: 'Trung bình', en: 'Medium' },
  GOOD: { vi: 'Tốt', en: 'Good' },
};

const VI_CLASS_TEXT: Record<VulnerabilityCode, BilingualText> = {
  V4: { vi: 'Rất cao', en: 'Very High' },
  V3: { vi: 'Cao', en: 'High' },
  V2: { vi: 'Trung bình', en: 'Medium' },
  V1: { vi: 'Thấp', en: 'Low' },
};

/**
 * Căn cứ V6 theo câu trả lời phỏng vấn (Mục III), không suy từ điểm: điểm đã qua thẩm định có thể khác mức tự động.
 */
function resolveV6Basis(hi: unknown): BilingualText {
  if (!isRecord(hi)) return { vi: '--', en: '--' };
  const rawCont = hi.continuousOperation247;
  const cont = typeof rawCont === 'boolean' ? rawCont : isRecord(rawCont) ? rawCont.has === true : undefined;
  const eq = isRecord(hi.sensitiveEquipment) ? hi.sensitiveEquipment : null;
  const eqHas = eq ? eq.has === true : undefined;
  const eqDesc = eq && typeof eq.description === 'string' ? eq.description.trim() : '';
  if (cont === true) return { vi: 'Vận hành liên tục 24/7', en: 'Continuous 24/7 operation' };
  if (eqHas === true) {
    return eqDesc
      ? { vi: `Có thiết bị nhạy cảm rung: ${eqDesc}`, en: `Vibration-sensitive equipment: ${eqDesc}` }
      : { vi: 'Có thiết bị nhạy cảm rung', en: 'Vibration-sensitive equipment present' };
  }
  if (eqHas === false || cont === false) return { vi: 'Không có thiết bị nhạy cảm rung', en: 'No vibration-sensitive equipment' };
  return { vi: '--', en: '--' };
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

    const totalEcs = resolveTotalEcs(ecsData, rScores) ?? 0;

    const savedBurlandMax = burlandMaxGrade ?? pickNum(json.burlandSummary?.localMaxGrade) ?? 0;
    const savedFlagLevel = String(json.burlandSummary?.structuralFlagLevel || 'NONE').toUpperCase();
    const flagLabel = STRUCTURAL_FLAG_LABELS[savedFlagLevel] || { vi: savedFlagLevel, en: savedFlagLevel };

    const ecsClassCode = normalizeEcsClass(resolveEcsClassRaw(ecsData, rScores));
    const ecsClassVi = ecsClassCode ? ECS_CLASS_TEXT[ecsClassCode].vi : '--';
    const ecsClassEn = ecsClassCode ? ECS_CLASS_TEXT[ecsClassCode].en : '--';

    const ecsItems: EcsAssessmentItem[] = [
      { code: 'E1', title: { vi: 'Hư hỏng nhìn thấy tường / khối xây', en: 'Visible damage to walls / masonry' }, basis: { vi: `Burland cục bộ lớn nhất: Cấp ${savedBurlandMax}`, en: `Local max Burland grade: Grade ${savedBurlandMax}` }, scale: '0-4', score: e1 },
      { code: 'E2', title: { vi: 'Khuyết tật kết cấu cột/dầm/sàn/tường', en: 'Structural defects in columns/beams/slabs' }, basis: { vi: `Cờ kết cấu chịu lực: ${flagLabel.vi}`, en: `Structural flag level: ${flagLabel.en}` }, scale: '0-4', score: e2 },
      { code: 'E3', title: { vi: 'Biến dạng Lún / Nghiêng / Võng', en: 'Deformation (Settlement / Tilt / Deflection)' }, basis: { vi: e3 === 0 ? 'Mức 0/4đ theo đánh giá hiện trường (không ghi nhận biến dạng)' : `Phát hiện biến dạng hiện trường (Mức ${e3}/4đ)`, en: e3 === 0 ? 'Level 0/4 per field assessment (no deformation recorded)' : `Deformation detected on-site (Level ${e3}/4)` }, scale: '0-4', score: e3 },
      { code: 'E4', title: { vi: 'Suy giảm vật liệu / độ bền lâu', en: 'Material degradation' }, basis: { vi: e4 === 0 ? 'Mức 0/4đ theo đánh giá đã xác nhận (không ghi nhận suy giảm vật liệu)' : `Ghi nhận suy giảm vật liệu (Mức ${e4}/4đ)`, en: e4 === 0 ? 'Level 0/4 per confirmed assessment (no material degradation recorded)' : `Material degradation observed (Level ${e4}/4)` }, scale: '0-4', score: e4 },
      { code: 'E5', title: { vi: 'Lịch sử / cơi nới / sự cố & toàn vẹn', en: 'Historical sensitivity & structural integrity' }, basis: { vi: e5 === 0 ? 'Mức 0/4đ theo lịch sử đã ghi nhận (không có sự cố được khai báo)' : `Tiền sử sửa chữa/sự cố ghi nhận (Mức ${e5}/4đ)`, en: e5 === 0 ? 'Level 0/4 per recorded history (no incident reported)' : `Reported past repairs/incidents (Level ${e5}/4)` }, scale: '0-4', score: e5 },
      { code: 'E6', title: { vi: 'Tình trạng chức năng / tổng thể', en: 'Overall serviceability & functional condition' }, basis: { vi: e6 === 0 ? 'Mức 0/4đ theo đánh giá đã xác nhận (không ghi nhận ảnh hưởng công năng)' : `Ảnh hưởng công năng vận hành (Mức ${e6}/4đ)`, en: e6 === 0 ? 'Level 0/4 per confirmed assessment (no functional impact recorded)' : `Functional serviceability impact (Level ${e6}/4)` }, scale: '0-4', score: e6 },
    ];

    // 2. ĐỌC 1:1 BẢNG VI (V1–V6, TOTAL VI, AVG VI) — ZERO CALCULATE
    const objGroup = resolveObjectGroup(json, specs);
    const structSys = json.structureSystem || specs.structuralType || '';
    const catRaw = json.foundationCatScore ?? specs.foundationCatScore;
    const catNum = catRaw === undefined || catRaw === null || catRaw === '' ? NaN : Number(catRaw);
    const catScore: number | null = Number.isInteger(catNum) && catNum >= 1 && catNum <= 5 ? catNum : null;
    // Căn cứ CAT đúng nhãn form thẩm định (CAT 5 = không có dữ liệu, không ghi "căn cứ hoàn công")
    const foundationCatBasis: BilingualText = catScore === null ? FOUNDATION_CAT_UNKNOWN : FOUNDATION_CAT_LABELS[catScore];
    const rawConstrYear = specs.constructionYear || specs.year_of_construction || json.constructionYear;

    const { v1, v2, v3, v4, v5, v6, totalVi, viAvg } = resolveViScores(viData, rScores);
    const vCode: VulnerabilityCode | null = normalizeViClassToVCode(resolveViClassRaw(viData, rScores));
    const viClassVi = vCode ? VI_CLASS_TEXT[vCode].vi : '--';
    const viClassEn = vCode ? VI_CLASS_TEXT[vCode].en : '--';

    const viItemsRaw: Array<Omit<ViAssessmentItem, 'scoreDisplay'>> = [
      { code: 'V1', title: { vi: 'Công năng & Quy mô', en: 'Building importance & use' }, basis: { vi: `Nhóm ${objGroup} (Hệ số quy mô: ${v1 ?? '--'}đ)`, en: `${objGroup} group (Factor: ${v1 ?? '--'} pts)` }, scale: '0-4', score: v1 },
      { code: 'V2', title: { vi: 'Hệ kết cấu chịu lực', en: 'Structural system' }, basis: { vi: structSys ? `Kết cấu: ${structSys}` : 'Chưa xác định hệ kết cấu', en: structSys ? `System: ${structSys}` : 'Unverified structural system' }, scale: '1-4', score: v2 },
      { code: 'V3', title: { vi: 'Loại móng & Nền đất', en: 'Foundation type & ground condition' }, basis: foundationCatBasis, scale: '1-4', score: v3 },
      { code: 'V4', title: { vi: 'Tuổi đời & Cơi nới', en: 'Building age & extension' }, basis: rawConstrYear ? { vi: `Năm XD: ${rawConstrYear}`, en: `Built year: ${rawConstrYear}` } : { vi: 'Chưa có dữ liệu năm xây dựng', en: 'Built year not recorded' }, scale: '1-4', score: v4 },
      { code: 'V5', title: { vi: 'Hiện trạng kỹ thuật ECS', en: 'Existing condition ECS' }, basis: { vi: `ECS = ${totalEcs} (${ecsClassVi}) → ${v5 ?? '--'}đ`, en: `ECS = ${totalEcs} (${ecsClassEn}) → ${v5 ?? '--'} pts` }, scale: '1-4', score: v5 },
      { code: 'V6', title: { vi: 'Thiết bị nhạy cảm & Vận hành', en: 'Vibration sensitivity & occupancy' }, basis: resolveV6Basis(json.historyInterview), scale: '1-4', score: v6 },
    ];
    const viItems: ViAssessmentItem[] = viItemsRaw.map((it) => ({ ...it, scoreDisplay: it.score === null ? '--' : String(it.score) }));

    // 3. ĐỌC 1:1 CẤP TÁC ĐỘNG THI CÔNG (IMPACT: I1–I4) — ZERO CALCULATE
    const frozenImpact = json.impactAssessment || {};
    const impactRes = resolveImpact(json, specs, rScores, rawReport.distance_to_centerline_m, objGroup);
    const hasStationEdge = impactRes.hasStationEdge;
    const distanceType: 'STATION_EDGE' | 'TUNNEL_CENTERLINE' = hasStationEdge ? 'STATION_EDGE' : 'TUNNEL_CENTERLINE';
    const metroOffset: number | string = impactRes.metroOffset;

    const distanceLabel: BilingualText = hasStationEdge
      ? { vi: 'khoảng cách đến biên công trình ga ngầm Metro', en: 'offset to Metro underground station boundary' }
      : { vi: 'khoảng cách đến tim tuyến hầm Metro', en: 'offset to Metro tunnel centerline' };

    const validImpactCode: 'I1' | 'I2' | 'I3' | 'I4' | '--' = impactRes.code;

    let impactVi = '--';
    let impactEn = '--';
    if (validImpactCode === 'I1') { impactVi = frozenImpact.levelVi || 'Thấp'; impactEn = frozenImpact.levelEn || 'Low'; }
    else if (validImpactCode === 'I2') { impactVi = frozenImpact.levelVi || 'Trung bình'; impactEn = frozenImpact.levelEn || 'Medium'; }
    else if (validImpactCode === 'I3') { impactVi = frozenImpact.levelVi || 'Cao'; impactEn = frozenImpact.levelEn || 'High'; }
    else if (validImpactCode === 'I4') { impactVi = frozenImpact.levelVi || 'Rất cao'; impactEn = frozenImpact.levelEn || 'Very High'; }

    // 4. MA TRẬN ĐÁNH GIÁ RỦI RO CƠ SỞ BRA (4x4 GRID VỚI HIGHLIGHT)
    const braRows = buildBraMatrixRows(vCode, validImpactCode);
    const frozenBra = json.braAssessment || {};
    const activeLookup = lookupBraCell(vCode, validImpactCode);
    const explicitBraCode = normalizeBraLevel(resolveExplicitBraRaw(json, rScores));
    const explicitBraLevel: { vi: string; en: string } | null = explicitBraCode ? BRA_LEVEL_TEXT[explicitBraCode] : null;

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

    // Hai khối judgement độc lập: khối nào có quyết định riêng trong JSON thì chỉ in quyết định đó, không lấy lý do chung
    // của thẻ điểm bù vào (trước đây khối "Giữ" in lý do nâng của khối kia). Hồ sơ cũ chưa có object riêng mới đọc thẻ điểm.
    const resolveJudgement = (own: unknown) => {
      if (isRecord(own)) {
        const action = parseAction(String(own.action || 'KEEP'));
        const reason = String(own.reason || '').trim();
        return { action, reason, isApplied: action !== 'KEEP' };
      }
      const action = parseAction(String(rScores?.engineering_judgement_action || 'KEEP'));
      return {
        action,
        reason: String(rScores?.engineering_judgement_reason || '').trim(),
        isApplied: action !== 'KEEP' || Boolean(rScores?.is_engineering_judgement_applied),
      };
    };
    const ecsJudgement = resolveJudgement(ecsData.engineeringJudgement);
    const viJudgement = resolveJudgement(viData.engineeringJudgement);
    const ecsAction = ecsJudgement.action;
    const ecsReason = ecsJudgement.reason;
    const isEcsJudgementApplied = ecsJudgement.isApplied;
    const viAction = viJudgement.action;
    const viReason = viJudgement.reason;
    const isViJudgementApplied = viJudgement.isApplied;

    const impactOverrideReason = String(
      json.executiveSummary?.impactOverrideReason ||
      frozenImpact.overrideReason ||
      ''
    ).trim() || undefined;
    const rawGateObj = json.gateDecision && typeof json.gateDecision === 'object' ? json.gateDecision : null;
    const gateDecision = String(
      rawGateObj?.decision ||
      (typeof json.gateDecision === 'string' ? json.gateDecision : '') ||
      rScores?.gate_decision ||
      ''
    ).trim() || undefined;
    const gateNotes = String(
      rawGateObj?.reason ||
      rawGateObj?.notes ||
      json.gateNotes ||
      ''
    ).trim() || undefined;

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
        foundationCatBasis,
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
        overrideReason: impactOverrideReason,
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
      braLevel: finalRiskLevel.vi,
      gateDecision,
      gateNotes,
    };
  }
}

