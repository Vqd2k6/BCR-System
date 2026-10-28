import type { ConditionCode, RawProgressRow } from "../progress-report.types";
import type { ProgressReportConfig } from "../config/config.schema";
import { firstNumber, firstText, getPath, toNumber } from "./json-reader";

/**
 * Cột U – "Tình trạng hiện tại": phân loại dựa trên ECS / BRA / Burland của hồ sơ.
 * Thứ tự ưu tiên: Không tiếp cận được → Nguy cơ cao → Cần theo dõi → Xuống cấp → Mới/Cũ.
 * Hàm thuần: chỉ phụ thuộc input + config.
 */

const SCORED_STATUSES = new Set([
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
]);

export function normalizeRiskValue(v: string | null | undefined): string {
  const s = (v ?? "").trim().toUpperCase();
  if (!s || s === "PENDING") return "";
  return s.replace(/_RISK$/, "").replace(/\s+/g, "_");
}

export interface RiskSnapshot {
  ecsClass: string;
  bra: string;
  burlandMax: number | null;
  monitoringRequired: boolean;
}

/** Ưu tiên kết quả hiệu chỉnh của kỹ sư (engineering judgement) → JSON hồ sơ → thẻ điểm DB. */
export function readRiskSnapshot(row: RawProgressRow): RiskSnapshot {
  const json = row.reportJson;
  const ecsClass = normalizeRiskValue(
    (row.riskJudgementApplied ? row.riskOverriddenEcsClass : null) ||
      firstText(
        getPath(json, "ecs.engineeringJudgement.adjustedClass"),
        getPath(json, "ecs.ecsClass"),
      ) ||
      row.riskEcsClass,
  );
  const bra = normalizeRiskValue(
    (row.riskJudgementApplied ? row.riskOverriddenBra : null) ||
      firstText(getPath(json, "executiveSummary.braStatus")) ||
      row.riskBra,
  );
  const burlandCandidates = [
    row.riskJudgementApplied ? row.riskOverriddenBurland : null,
    toNumber(getPath(json, "burlandSummary.localMaxGrade")),
    toNumber(getPath(json, "burlandSummary.predominantGrade")),
  ].filter((n): n is number => n !== null);
  const burlandMax =
    burlandCandidates.length > 0 ? Math.max(...burlandCandidates) : null;
  const monitoringRequired =
    row.monitoringRequired ||
    getPath(json, "settlementTilt.needAdditionalMonitoring.required") === true;
  return { ecsClass, bra, burlandMax, monitoringRequired };
}

export function isInaccessible(row: RawProgressRow): boolean {
  const caseType = firstText(
    getPath(row.reportJson, "surveyCaseType"),
  ).toUpperCase();
  const absentFlag = getPath(row.reportJson, "isAbsenteeSurvey") === true;
  const reportSaysAbsent =
    row.reportIsRefusedOrAbsent || caseType === "ABSENTEE" || absentFlag;
  const statusAbsent =
    row.parcelSurveyStatus.startsWith("POSTPONED_ABSENT") ||
    (row.unitStatus ?? "").startsWith("POSTPONED_ABSENT");
  const hasRealReport =
    Boolean(row.reportId) && !reportSaysAbsent && row.reportStatus !== "DRAFT";
  if (reportSaysAbsent) return true;
  if (hasRealReport) return false;
  return statusAbsent || (row.absenceCount > 0 && !row.reportId);
}

function matchesRule(
  risk: RiskSnapshot,
  rule: {
    ecsClasses: string[];
    braValues: string[];
    burlandMin: number | null;
  },
): boolean {
  const ecsSet = rule.ecsClasses.map((s) => normalizeRiskValue(s));
  const braSet = rule.braValues.map((s) => normalizeRiskValue(s));
  if (risk.ecsClass && ecsSet.includes(risk.ecsClass)) return true;
  if (risk.bra && braSet.includes(risk.bra)) return true;
  if (
    rule.burlandMin !== null &&
    risk.burlandMax !== null &&
    risk.burlandMax >= rule.burlandMin
  )
    return true;
  return false;
}

export function resolveConstructionYear(row: RawProgressRow): number | null {
  return firstNumber(
    getPath(row.reportJson, "constructionYear"),
    row.specYear,
    getPath(row.masterJson, "constructionYear"),
    row.masterYear,
  );
}

export function classifyCondition(
  row: RawProgressRow,
  config: ProgressReportConfig,
): ConditionCode | null {
  if (isInaccessible(row)) return "INACCESSIBLE";
  if (
    !row.reportId ||
    !row.reportStatus ||
    !SCORED_STATUSES.has(row.reportStatus)
  )
    return null;

  const risk = readRiskSnapshot(row);
  const hasAnyScore = Boolean(
    risk.ecsClass || risk.bra || risk.burlandMax !== null,
  );
  if (!hasAnyScore) return null;

  if (matchesRule(risk, config.highRisk)) return "HIGH_RISK";
  if (matchesRule(risk, config.monitor)) return "MONITOR";
  if (config.monitor.includeMonitoringRequired && risk.monitoringRequired)
    return "MONITOR";

  const degradedSet = config.degraded.ecsClasses.map((s) =>
    normalizeRiskValue(s),
  );
  if (risk.ecsClass && degradedSet.includes(risk.ecsClass)) return "DEGRADED";

  const year = resolveConstructionYear(row);
  if (year !== null && year >= config.newBuildingMinYear) return "NEW";
  return "OLD";
}
