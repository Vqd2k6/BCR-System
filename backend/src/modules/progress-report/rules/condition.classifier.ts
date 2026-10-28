import type { BraRiskCode, ConditionCode, EcsConditionCode, RawProgressRow } from '../progress-report.types';
import type { ProgressReportConfig } from '../config/config.schema';
import { firstNumber, firstText, getPath, toNumber } from './json-reader';

/**
 * Phân loại:
 * - Cột U – "Tình trạng hiện tại" (ECS): Tốt (GOOD), Trung bình (MEDIUM), Kém (DEFICIENT), Nguy hiểm (CRITICAL), hoặc Không tiếp cận được (INACCESSIBLE).
 * - Cột V – "Mức độ đánh giá rủi ro" (BRA): Thấp (LOW), Trung bình (MEDIUM), Cao (HIGH), Rất cao (VERY_HIGH).
 * - Bảng tổng hợp cuối trang: Cần theo dõi (MONITOR) / Nguy cơ cao (HIGH_RISK) / Không tiếp cận được (INACCESSIBLE).
 * Hàm thuần: chỉ phụ thuộc input + config.
 */

const SCORED_STATUSES = new Set(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']);

export function normalizeRiskValue(v: string | null | undefined): string {
  const s = (v ?? '').trim().toUpperCase();
  if (!s || s === 'PENDING') return '';
  return s.replace(/_RISK$/, '').replace(/\s+/g, '_');
}

export function normalizeEcsGrade(v: string | null | undefined): Exclude<EcsConditionCode, 'INACCESSIBLE'> | null {
  const norm = normalizeRiskValue(v);
  if (!norm) return null;
  if (norm === 'CRITICAL' || norm === 'NGUY_HIỂM' || norm === 'VERY_HIGH') return 'CRITICAL';
  if (norm === 'DEFICIENT' || norm === 'POOR' || norm === 'KÉM' || norm === 'HIGH') return 'DEFICIENT';
  if (norm === 'MEDIUM' || norm === 'MODERATE' || norm === 'TRUNG_BÌNH') return 'MEDIUM';
  if (norm === 'GOOD' || norm === 'LOW' || norm === 'VERY_LOW' || norm === 'TỐT') return 'GOOD';
  return null;
}

export function normalizeBraGrade(v: string | null | undefined): BraRiskCode | null {
  const norm = normalizeRiskValue(v);
  if (!norm) return null;
  if (
    norm === 'VERY_HIGH' ||
    norm === 'CRITICAL' ||
    norm.includes('RẤT_CAO') ||
    norm.includes('VERY_HIGH')
  ) {
    return 'VERY_HIGH';
  }
  if (norm === 'HIGH' || (norm.includes('CAO') && !norm.includes('RẤT_CAO'))) {
    return 'HIGH';
  }
  if (norm === 'MEDIUM' || norm === 'MODERATE' || norm.includes('TRUNG_BÌNH')) {
    return 'MEDIUM';
  }
  if (
    norm === 'LOW' ||
    norm === 'VERY_LOW' ||
    norm === 'NEGLIGIBLE' ||
    norm.includes('THẤP') ||
    norm.includes('KHÔNG_ĐÁNG_KỂ')
  ) {
    return 'LOW';
  }
  return null;
}

export interface RiskSnapshot {
  ecsClass: string;
  bra: string;
  burlandMax: number | null;
  monitoringRequired: boolean;
}

export type ImpactCode = 'I1' | 'I2' | 'I3' | 'I4';
export type VulnerabilityCode = 'V1' | 'V2' | 'V3' | 'V4';

/**
 * Ma trận đánh giá rủi ro cơ sở BRA 4×4 (Vulnerability V1..V4 × Impact I1..I4)
 * Đồng bộ 100% với braEngine.ts trên Frontend và bra-matrix.mapper.ts.
 */
export const BRA_MATRIX_LOOKUP: Record<VulnerabilityCode, Record<ImpactCode, BraRiskCode>> = {
  V1: { I1: 'LOW', I2: 'LOW', I3: 'MEDIUM', I4: 'HIGH' },
  V2: { I1: 'LOW', I2: 'MEDIUM', I3: 'MEDIUM', I4: 'HIGH' },
  V3: { I1: 'MEDIUM', I2: 'MEDIUM', I3: 'HIGH', I4: 'VERY_HIGH' },
  V4: { I1: 'HIGH', I2: 'HIGH', I3: 'VERY_HIGH', I4: 'VERY_HIGH' },
};

export function mapViClassToVCode(v: string | null | undefined): VulnerabilityCode | null {
  const s = (v ?? '').trim().toUpperCase();
  if (!s) return null;
  if (s.includes('VERY_HIGH') || s.includes('VERY HIGH') || s.includes('RẤT CAO') || s.includes('RẤT_CAO') || s === 'V4') {
    return 'V4';
  }
  if (s.includes('HIGH') || s.includes('CAO') || s.includes('TĂNG NẶNG') || s === 'V3') {
    return 'V3';
  }
  if (s.includes('MEDIUM') || s.includes('MODERATE') || s.includes('TRUNG BÌNH') || s.includes('TRUNG_BÌNH') || s === 'V2') {
    return 'V2';
  }
  if (s.includes('LOW') || s.includes('THẤP') || s === 'V1') {
    return 'V1';
  }
  return null;
}

export function mapViAvgToVCode(avg: number | null | undefined): VulnerabilityCode | null {
  if (avg === null || avg === undefined || !Number.isFinite(avg) || avg <= 0) return null;
  if (avg > 3.25) return 'V4';
  if (avg > 2.5) return 'V3';
  if (avg > 1.5) return 'V2';
  return 'V1';
}

/**
 * Xác định mức độ dễ tổn thương V (V1..V4) từ kết quả khảo sát VI của công trình.
 */
export function resolveVulnerabilityCode(row: RawProgressRow): VulnerabilityCode | null {
  const json = row.reportJson;
  // 1. Overridden VI trên thẻ điểm kỹ sư trưởng
  if (row.riskJudgementApplied) {
    const ovClass = mapViClassToVCode(row.riskOverriddenViClass);
    if (ovClass) return ovClass;
    const ovAvg = mapViAvgToVCode(row.riskOverriddenAvgVi);
    if (ovAvg) return ovAvg;
  }
  // 2. Engineering judgement trong survey_data_json.vi
  const viEjAction = firstText(getPath(json, 'vi.engineeringJudgement.action')).toUpperCase();
  if (viEjAction && viEjAction !== 'KEEP') {
    const ejClass = mapViClassToVCode(firstText(getPath(json, 'vi.engineeringJudgement.adjustedClass')));
    if (ejClass) return ejClass;
    const ejScore = toNumber(getPath(json, 'vi.engineeringJudgement.adjustedScore'));
    if (ejScore !== null && ejScore > 0) {
      const ejAvg = mapViAvgToVCode(ejScore > 4 ? ejScore / 6 : ejScore);
      if (ejAvg) return ejAvg;
    }
  }
  // 3. Phân hạng VI trực tiếp trong survey_data_json
  const jsonViClass = mapViClassToVCode(
    firstText(getPath(json, 'vi.viClass'), getPath(json, 'vi.class'), getPath(json, 'executiveSummary.viClass'))
  );
  if (jsonViClass) return jsonViClass;

  const jsonViAvg = mapViAvgToVCode(firstNumber(getPath(json, 'vi.viAvg'), getPath(json, 'vi.avgVi')));
  if (jsonViAvg) return jsonViAvg;

  // 4. Phân hạng VI trong bảng risk_score_cards
  const rkClass = mapViClassToVCode(row.riskViClass);
  if (rkClass) return rkClass;
  const rkAvg = mapViAvgToVCode(row.riskViAvg);
  if (rkAvg) return rkAvg;

  // 5. Fallback từ hồ sơ tòa chung cư mẹ (nếu là căn hộ con)
  const masterViClass = mapViClassToVCode(
    firstText(getPath(row.masterJson, 'vi.viClass'), getPath(row.masterJson, 'vi.class'))
  );
  if (masterViClass) return masterViClass;
  const masterViAvg = mapViAvgToVCode(
    firstNumber(getPath(row.masterJson, 'vi.viAvg'), getPath(row.masterJson, 'vi.avgVi'))
  );
  if (masterViAvg) return masterViAvg;

  return null;
}

/**
 * Tính cấp tác động thi công I (I1..I4) trực tiếp từ khoảng cách GIS hiện tại (sau nắn chỉnh ranh đất):
 * - Ưu tiên số 1: Khoảng cách GIS tới biên kết cấu ga/depot (gisDistanceEdgeM).
 * - Fallback: Khoảng cách GIS tới tim tuyến hầm (gisDistanceCenterlineM).
 * - Ngưỡng theo nhóm công trình (Special/Critical/Important: 30/20/10m; General: 20/10/5m).
 */
export function computeGisImpactCode(row: RawProgressRow): ImpactCode | null {
  const edgeDist = row.gisDistanceEdgeM ?? null;
  const centerDist = row.gisDistanceCenterlineM ?? null;
  const hasStationEdge = edgeDist !== null && Number.isFinite(edgeDist);
  const d = hasStationEdge
    ? edgeDist
    : centerDist !== null && Number.isFinite(centerDist)
      ? centerDist
      : null;
  if (d === null) return null;

  const objGroup = firstText(
    getPath(row.reportJson, 'objectGroup'),
    row.specBuildingGrade,
    getPath(row.masterJson, 'objectGroup'),
    'GENERAL'
  ).toUpperCase();

  const isSpecial =
    objGroup === 'CRITICAL' ||
    objGroup === 'IMPORTANT' ||
    objGroup.includes('IMPORTANT') ||
    objGroup.includes('CRITICAL') ||
    objGroup.includes('SPECIAL') ||
    objGroup.includes('HERITAGE') ||
    objGroup.includes('GRADE_1') ||
    objGroup.includes('GRADE_2') ||
    objGroup.includes('QUAN TRỌNG') ||
    objGroup.includes('ĐẶC BIỆT');

  if (isSpecial) {
    if (d >= 30) return 'I1';
    if (d >= 20) return 'I2';
    if (d >= 10) return 'I3';
    return 'I4';
  }
  if (d >= 20) return 'I1';
  if (d >= 10) return 'I2';
  if (d >= 5) return 'I3';
  return 'I4';
}

/**
 * Đọc kết quả đánh giá kỹ thuật:
 * - ECS: Ưu tiên engineering judgement → JSON hồ sơ → thẻ điểm DB.
 * - BRA: Khi có khoảng cách GIS hiện tại, tính lại I từ GIS (I1..I4) và tra ma trận chuẩn BRA_MATRIX_LOOKUP[V][I]
 *        để loại bỏ sai lệch do I cũ trước khi nắn chỉnh ranh đất.
 */
export function readRiskSnapshot(row: RawProgressRow): RiskSnapshot {
  const json = row.reportJson;
  const rawEcsCandidates = [
    row.riskJudgementApplied ? row.riskOverriddenEcsClass : null,
    firstText(
      getPath(json, 'ecs.engineeringJudgement.adjustedClass'),
      getPath(json, 'ecs.ecsClass'),
      getPath(json, 'ecs.classification')
    ),
    row.riskEcsClass,
  ];
  let ecsClass = '';
  for (const c of rawEcsCandidates) {
    const n = normalizeEcsGrade(c) ?? normalizeRiskValue(c);
    if (n) {
      ecsClass = n;
      break;
    }
  }

  const gisImpact = computeGisImpactCode(row);
  const vCode = resolveVulnerabilityCode(row);
  let bra = '';
  if (gisImpact !== null) {
    const effectiveVCode: VulnerabilityCode =
      vCode ??
      (ecsClass === 'CRITICAL'
        ? 'V3'
        : ecsClass === 'DEFICIENT'
          ? 'V2'
          : 'V1');
    bra = BRA_MATRIX_LOOKUP[effectiveVCode][gisImpact];
  } else {
    const rawBraCandidates = [
      row.riskJudgementApplied ? row.riskOverriddenBra : null,
      firstText(
        getPath(json, 'braAssessment.braStatus'),
        getPath(json, 'braAssessment.finalRiskLevelVi'),
        getPath(json, 'braAssessment.riskLevelVi'),
        getPath(json, 'executiveSummary.braStatus')
      ),
      row.riskBra,
    ];
    for (const c of rawBraCandidates) {
      const n = normalizeBraGrade(c) ?? normalizeRiskValue(c);
      if (n) {
        bra = n;
        break;
      }
    }
  }

  const burlandCandidates = [
    row.riskJudgementApplied ? row.riskOverriddenBurland : null,
    toNumber(getPath(json, 'burlandSummary.localMaxGrade')),
    toNumber(getPath(json, 'burlandSummary.predominantGrade')),
  ].filter((n): n is number => n !== null);
  const burlandMax = burlandCandidates.length > 0 ? Math.max(...burlandCandidates) : null;
  const monitoringRequired =
    row.monitoringRequired || getPath(json, 'settlementTilt.needAdditionalMonitoring.required') === true;
  return { ecsClass, bra, burlandMax, monitoringRequired };
}

export function isInaccessible(row: RawProgressRow): boolean {
  const caseType = firstText(getPath(row.reportJson, 'surveyCaseType')).toUpperCase();
  const absentFlag =
    getPath(row.reportJson, 'isAbsenteeSurvey') === true || getPath(row.reportJson, 'isAbsentee') === true;
  const reportSaysAbsent = row.reportIsRefusedOrAbsent || caseType === 'ABSENTEE' || absentFlag;
  const statusAbsent =
    row.parcelSurveyStatus.startsWith('POSTPONED_ABSENT') || (row.unitStatus ?? '').startsWith('POSTPONED_ABSENT');
  const hasRealReport = Boolean(row.reportId) && !reportSaysAbsent && row.reportStatus !== 'DRAFT';
  if (reportSaysAbsent) return true;
  if (hasRealReport) return false;
  return statusAbsent || (row.absenceCount > 0 && !row.reportId);
}

/**
 * Phân loại Cột U – "Tình trạng hiện tại" (ECS: GOOD, MEDIUM, DEFICIENT, CRITICAL) + INACCESSIBLE.
 */
export function classifyEcsCondition(row: RawProgressRow): EcsConditionCode | null {
  if (isInaccessible(row)) return 'INACCESSIBLE';
  if (!row.reportId || !row.reportStatus || !SCORED_STATUSES.has(row.reportStatus)) return null;
  const snap = readRiskSnapshot(row);
  return normalizeEcsGrade(snap.ecsClass);
}

/**
 * Phân loại Cột V – "Mức độ đánh giá rủi ro" (BRA: LOW, MEDIUM, HIGH, VERY_HIGH).
 */
export function classifyBraGrade(row: RawProgressRow): BraRiskCode | null {
  if (isInaccessible(row)) return null;
  if (!row.reportId || !row.reportStatus || !SCORED_STATUSES.has(row.reportStatus)) return null;
  const snap = readRiskSnapshot(row);
  return normalizeBraGrade(snap.bra);
}

function matchesRule(
  risk: RiskSnapshot,
  rule: { ecsClasses: string[]; braValues: string[]; burlandMin: number | null }
): boolean {
  const ecsSet = rule.ecsClasses.map((s) => normalizeRiskValue(s));
  const braSet = rule.braValues.map((s) => normalizeRiskValue(s));
  if (risk.ecsClass && ecsSet.includes(risk.ecsClass)) return true;
  if (risk.bra && braSet.includes(risk.bra)) return true;
  if (rule.burlandMin !== null && risk.burlandMax !== null && risk.burlandMax >= rule.burlandMin) return true;
  return false;
}

export function resolveConstructionYear(row: RawProgressRow): number | null {
  return firstNumber(
    getPath(row.reportJson, 'constructionYear'),
    row.specYear,
    getPath(row.masterJson, 'constructionYear'),
    row.masterYear
  );
}

export function classifyCondition(row: RawProgressRow, config: ProgressReportConfig): ConditionCode | null {
  if (isInaccessible(row)) return 'INACCESSIBLE';
  if (!row.reportId || !row.reportStatus || !SCORED_STATUSES.has(row.reportStatus)) return null;

  const risk = readRiskSnapshot(row);
  const hasAnyScore = Boolean(risk.ecsClass || risk.bra || risk.burlandMax !== null);
  if (!hasAnyScore) return null;

  if (matchesRule(risk, config.highRisk)) return 'HIGH_RISK';
  if (matchesRule(risk, config.monitor)) return 'MONITOR';
  if (config.monitor.includeMonitoringRequired && risk.monitoringRequired) return 'MONITOR';

  const degradedSet = config.degraded.ecsClasses.map((s) => normalizeRiskValue(s));
  if (risk.ecsClass && degradedSet.includes(risk.ecsClass)) return 'DEGRADED';

  const year = resolveConstructionYear(row);
  if (year !== null && year >= config.newBuildingMinYear) return 'NEW';
  return 'OLD';
}
