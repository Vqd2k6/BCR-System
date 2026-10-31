import type { PoolClient } from 'pg';

type JsonRecord = Record<string, unknown>;

export function isJsonRecord(val: unknown): val is JsonRecord {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function toFiniteNumberOrNull(val: unknown): number | null {
  if (val === undefined || val === null || String(val).trim() === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/** Ghi `survey_scopes` theo đúng giá trị mới, kể cả khi xóa trắng; phủ 100% thì dọn lý do hạn chế cũ. */
export async function syncSurveyScopeInTx(client: PoolClient, reportId: string, json: JsonRecord): Promise<void> {
  const accessLimitation = isJsonRecord(json.accessLimitation) ? json.accessLimitation : {};
  const accessType = String(accessLimitation.type || accessLimitation.scopeStatus || '').toUpperCase();
  const isFull100 = accessType === 'FULL_100' || accessType === 'TOAN_BO';

  let coverage: 'TOAN_BO' | 'MOT_PHAN' | 'KHONG_THE_TIEP_CAN' = 'TOAN_BO';
  if (['LIMITED', 'PARTIAL', 'EXTERNAL_ONLY', 'CHI_NGOAI_VI', 'MOT_PHAN'].includes(accessType)) {
    coverage = 'MOT_PHAN';
  } else if (['ABSENT_REFUSED', 'REFUSED', 'ABSENTEE', 'KHONG_THE_TIEP_CAN'].includes(accessType) || json.isAbsenteeSurvey) {
    coverage = 'KHONG_THE_TIEP_CAN';
  }

  if (isFull100 && isJsonRecord(json.accessLimitation)) {
    json.accessLimitation = { ...accessLimitation, mainReason: '', notes: '', restrictedAreas: [], scopeStatus: 'TOAN_BO' };
  }

  const restrictedAreas = Array.isArray(accessLimitation.restrictedAreas) ? accessLimitation.restrictedAreas : [];
  const reason = String(accessLimitation.mainReason || '').trim();
  const notes = String(accessLimitation.notes || '').trim();

  await client.query(
    `INSERT INTO survey_scopes (report_id, survey_coverage, inaccessible_areas, accessibility_limitations, scope_details_json)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (report_id) DO UPDATE SET
       survey_coverage = EXCLUDED.survey_coverage,
       inaccessible_areas = EXCLUDED.inaccessible_areas,
       accessibility_limitations = EXCLUDED.accessibility_limitations,
       scope_details_json = COALESCE(EXCLUDED.scope_details_json, survey_scopes.scope_details_json);`,
    [
      reportId,
      coverage,
      !isFull100 && restrictedAreas.length > 0 ? restrictedAreas.join(', ') : null,
      isFull100 ? null : [reason, notes].filter(Boolean).join(': ') || null,
      json.surveyScope !== undefined ? JSON.stringify(json.surveyScope) : null,
    ]
  );
}

/**
 * Ghi `historical_sensitivities` từ `historyInterview`. `details` lưu nguyên JSON phỏng vấn vì mapper báo cáo
 * parse cột này để lấy từng mức và diễn giải; trả về e5 để bên gọi tính lại ECS.
 */
export async function syncHistoryInterviewInTx(
  client: PoolClient,
  reportId: string,
  json: JsonRecord,
  interiorRenovationHistory?: string
): Promise<number> {
  const interview: JsonRecord = isJsonRecord(json.historyInterview) ? { ...json.historyInterview } : {};
  const neighbor = interview.neighborImpact ?? interview.neighborDamage;
  const fireFlood = interview.fireFloodHistory ?? interview.fireFloodIncident;
  if (neighbor !== undefined) {
    interview.neighborImpact = neighbor;
    interview.neighborDamage = neighbor;
  }
  if (fireFlood !== undefined) {
    interview.fireFloodHistory = fireFlood;
    interview.fireFloodIncident = fireFlood;
  }
  json.historyInterview = interview;

  const levelOf = (val: unknown) => toFiniteNumberOrNull(val) ?? 0;
  const levels = [interview.renovationLoad, interview.majorRepair, interview.pastSettlement, neighbor, fireFlood].map(levelOf);
  const maxLevel = Math.max(...levels);
  const e5Score = levels.filter((level) => level > 2).length >= 2 ? 4 : maxLevel;
  const sensitiveEquipment = isJsonRecord(interview.sensitiveEquipment) ? interview.sensitiveEquipment : {};

  await client.query(
    `INSERT INTO historical_sensitivities (
       report_id, extended_or_renovated, previous_settlement_or_tilt, fire_or_accident,
       sensitive_equipment_present, details, e5_history_score
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (report_id) DO UPDATE SET
       extended_or_renovated = EXCLUDED.extended_or_renovated,
       previous_settlement_or_tilt = EXCLUDED.previous_settlement_or_tilt,
       fire_or_accident = EXCLUDED.fire_or_accident,
       sensitive_equipment_present = EXCLUDED.sensitive_equipment_present,
       details = EXCLUDED.details,
       e5_history_score = EXCLUDED.e5_history_score;`,
    [
      reportId,
      levelOf(interview.renovationLoad) > 0 || levelOf(interview.majorRepair) > 0 || Boolean(interiorRenovationHistory?.trim()),
      levelOf(interview.pastSettlement) > 0 || levelOf(neighbor) > 0,
      levelOf(fireFlood) > 0,
      sensitiveEquipment.has === true,
      JSON.stringify(interiorRenovationHistory ? { ...interview, interiorRenovationHistory } : interview),
      e5Score,
    ]
  );
  return e5Score;
}

export interface CondoDeformationPatch {
  notes: string | null;
  details: JsonRecord;
  /** `undefined`: không đụng tới độ võng. Cột NOT NULL nên xóa số đo thì SQL về 0, JSON giữ `null`. */
  beamDeflectionMm?: number | null;
  e3Score: number | null;
}

/** Ghi phần quan sát cục bộ của Căn hộ: `notes`, `details_json`, độ võng; không đụng tilt kế thừa tòa mẹ. */
export async function syncUnitDeformationInTx(
  client: PoolClient,
  reportId: string,
  patch: CondoDeformationPatch
): Promise<void> {
  await client.query(
    `INSERT INTO deformation_assessments (
       report_id, tilt_angle_x, tilt_angle_y, beam_deflection_mm,
       measurement_reliability, e3_deformation_score, notes, details_json
     ) VALUES (
       $1, 0, 0, COALESCE($2::numeric, 0), 'HIGH'::reliability_enum, COALESCE($3::int, 0), $4, $5::jsonb
     )
     ON CONFLICT (report_id) DO UPDATE SET
       beam_deflection_mm = CASE
         WHEN $6::boolean THEN COALESCE($2::numeric, 0)
         ELSE deformation_assessments.beam_deflection_mm
       END,
       e3_deformation_score = COALESCE($3::int, deformation_assessments.e3_deformation_score),
       notes = $4,
       details_json = COALESCE(deformation_assessments.details_json, '{}'::jsonb) || $5::jsonb;`,
    [
      reportId,
      patch.beamDeflectionMm ?? null,
      patch.e3Score,
      patch.notes,
      JSON.stringify(patch.details),
      patch.beamDeflectionMm !== undefined,
    ]
  );
}
