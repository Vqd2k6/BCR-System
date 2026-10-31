import type { PoolClient } from 'pg';
import { Database } from '../../../database/db';
import { isCondoAreaUnit } from './condo-entity-classifier';

/**
 * Phân loại vắng chủ của Căn hộ. Các hồ sơ cũ bị lẫn status và phải điền đủ form thường nên không cờ đơn lẻ
 * nào đáng tin: dấu hiệu mềm chỉ thành kết luận khi không có khuyết tật ghi nhận được trong phòng ở, vì khuyết
 * tật ở hành lang không chứng minh KSV đã vào căn.
 */
export type CondoAbsenceState = 'ABSENT' | 'ACCESS_HISTORY' | 'SUSPECTED' | 'NORMAL';

export type CondoAbsenceDecisionValue = 'ABSENT' | 'NOT_ABSENT';

export interface CondoUnitAbsenceInput {
  isRefusedOrAbsent: boolean;
  unitStatus: string | null;
  reportStatus: string | null;
  surveyJson: Record<string, unknown>;
  ownLogCount: number;
  zoneCount: number;
  roomDefectCount: number;
}

export interface CondoUnitAbsenceResult {
  state: CondoAbsenceState;
  signals: string[];
  decision: CondoAbsenceDecisionValue | null;
  isHardAbsent: boolean;
  hasUnknownOwnerName: boolean;
  hasUnknownOwnerPhone: boolean;
}

// Vùng này nằm ngoài căn hộ nên không phải bằng chứng đã tiếp cận được bên trong
export const NON_ROOM_ZONE_NAMES = ['Cầu thang / Hành lang', 'Khác'];

const POSTPONED_STATUSES = ['POSTPONED_ABSENT', 'POSTPONED_ABSENT_VERIFIED'];
const ABSENT_RESIDENT_STATUSES = ['VẮNG_MẶT_KHÓA_CỬA', 'BỎ_TRỐNG_CHƯA_VỀ_Ở'];
const UNKNOWN_NAME_PATTERN = /^(không|chưa)?\s*(rõ|biết|có)?$/iu;
const FAKE_PHONE_PATTERN = /^(1+|0+|0987654321)$/;
const ABSENT_FEEDBACK_PATTERN = /vắng|không\s+(có\s+mặt|tiếp\s+cận|cho\s+tiếp\s+cận)/iu;

/** Nhận diện giá trị KSV điền cho đủ form; ô trống không tính vì đó không phải khai báo sai. */
export function isUnknownOwnerName(value: unknown): boolean {
  const text = String(value ?? '').trim();
  if (!text) return false;
  return UNKNOWN_NAME_PATTERN.test(text) || /^[0-9]+$/.test(text);
}

export function isUnknownOwnerPhone(value: unknown): boolean {
  const text = String(value ?? '').trim();
  if (!text) return false;
  return FAKE_PHONE_PATTERN.test(text) || /\p{L}/u.test(text);
}

function readRecord(val: unknown): Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val) ? (val as Record<string, unknown>) : {};
}

function collectSoftSignals(input: CondoUnitAbsenceInput): string[] {
  const json = input.surveyJson;
  const info = readRecord(json.absenteeInfo);
  const signals: string[] = [];

  if (input.ownLogCount > 0) signals.push(`Có ${input.ownLogCount} nhật ký vắng mặt của chính căn hộ`);
  if (ABSENT_RESIDENT_STATUSES.includes(String(json.residentStatus || ''))) {
    signals.push(`Trạng thái cư trú: ${String(json.residentStatus)}`);
  }
  if (json.isAbsentee === true || json.isAbsenteeSurvey === true || json.isRefusedOrAbsent === true) {
    signals.push('Hồ sơ khảo sát được đánh dấu vắng chủ');
  }
  if (json.surveyCaseType === 'ABSENTEE') signals.push('Loại hình khảo sát: ABSENTEE');
  if (String(info.notes || '').trim()) signals.push('Có ghi chú vắng mặt của KSV');
  if (Array.isArray(info.absenteeMinutesPhotos) && info.absenteeMinutesPhotos.length > 0) {
    signals.push('Có ảnh biên bản vắng nhà');
  }
  return signals;
}

function collectSuspicions(input: CondoUnitAbsenceInput): string[] {
  const json = input.surveyJson;
  const suspicions: string[] = [];

  if (isUnknownOwnerName(json.ownerName)) suspicions.push(`Tên chủ hộ không xác định ("${String(json.ownerName).trim()}")`);
  if (isUnknownOwnerPhone(json.ownerPhone)) suspicions.push(`SĐT không hợp lệ ("${String(json.ownerPhone).trim()}")`);
  if (ABSENT_FEEDBACK_PATTERN.test(String(json.ownerFeedback || ''))) suspicions.push('Ý kiến ghi nhận có nội dung vắng mặt');
  if (input.zoneCount === 0) suspicions.push('Không có vùng khảo sát nào');
  return suspicions;
}

export function resolveCondoUnitAbsence(input: CondoUnitAbsenceInput): CondoUnitAbsenceResult {
  const rawDecision = readRecord(input.surveyJson.absenceDecision).decision;
  const decision: CondoAbsenceDecisionValue | null =
    rawDecision === 'ABSENT' || rawDecision === 'NOT_ABSENT' ? rawDecision : null;

  const isHardAbsent =
    input.isRefusedOrAbsent ||
    POSTPONED_STATUSES.includes(String(input.unitStatus || '')) ||
    POSTPONED_STATUSES.includes(String(input.reportStatus || ''));
  const softSignals = collectSoftSignals(input);
  const conclude = (state: CondoAbsenceState, signals: string[]): CondoUnitAbsenceResult => ({
    state,
    signals,
    decision,
    isHardAbsent,
    hasUnknownOwnerName: isUnknownOwnerName(input.surveyJson.ownerName),
    hasUnknownOwnerPhone: isUnknownOwnerPhone(input.surveyJson.ownerPhone),
  });

  if (isHardAbsent) return conclude('ABSENT', ['Hồ sơ có cờ vắng mặt trong CSDL', ...softSignals]);
  if (decision === 'ABSENT') return conclude('ABSENT', ['Admin đã xác nhận vắng chủ', ...softSignals]);
  if (decision === 'NOT_ABSENT') return conclude(softSignals.length > 0 ? 'ACCESS_HISTORY' : 'NORMAL', softSignals);

  const hasRoomDefect = input.roomDefectCount > 0;
  if (softSignals.length > 0) return conclude(hasRoomDefect ? 'ACCESS_HISTORY' : 'ABSENT', softSignals);
  const suspicions = hasRoomDefect ? [] : collectSuspicions(input);
  return conclude(suspicions.length > 0 ? 'SUSPECTED' : 'NORMAL', suspicions);
}

interface CondoUnitAbsenceRow {
  report_id: string;
  is_refused_or_absent: boolean | null;
  report_status: string | null;
  unit_status: string | null;
  unit_type: string | null;
  unit_code: string | null;
  survey_data_json: Record<string, unknown> | string | null;
  own_log_count: string;
  zone_count: string;
  room_defect_count: string;
}

/** Chỉ trả về hồ sơ Căn hộ; Tòa mẹ và Khu vực chung không có khái niệm vắng chủ theo căn. */
export async function fetchCondoUnitAbsenceMap(
  reportIds: string[],
  client?: PoolClient
): Promise<Map<string, CondoUnitAbsenceResult>> {
  const result = new Map<string, CondoUnitAbsenceResult>();
  if (reportIds.length === 0) return result;

  const sql = `
    SELECT r.id AS report_id, r.is_refused_or_absent, r.status::text AS report_status,
           bu.status::text AS unit_status, bu.unit_type, bu.unit_code, r.survey_data_json,
           (SELECT COUNT(*) FROM survey_absence_logs l WHERE l.unit_id = r.unit_id) AS own_log_count,
           (SELECT COUNT(*) FROM damage_zones z
             WHERE z.report_id = r.id AND COALESCE(z.is_deleted, FALSE) = FALSE) AS zone_count,
           (SELECT COUNT(*) FROM defect_items d
             JOIN damage_zones z ON z.id = d.zone_id
             WHERE z.report_id = r.id
               AND COALESCE(z.is_deleted, FALSE) = FALSE
               AND COALESCE(d.is_deleted, FALSE) = FALSE
               AND z.room_name <> ALL($2::text[])) AS room_defect_count
    FROM base_survey_reports r
    JOIN building_units bu ON bu.id = r.unit_id
    WHERE r.id = ANY($1::uuid[]);`;
  const params = [reportIds, NON_ROOM_ZONE_NAMES];
  const res = client
    ? await client.query<CondoUnitAbsenceRow>(sql, params)
    : await Database.query<CondoUnitAbsenceRow>(sql, params);

  for (const row of res.rows) {
    if (isCondoAreaUnit(row.unit_type, row.unit_code)) continue;
    let surveyJson: Record<string, unknown> = {};
    try {
      surveyJson =
        typeof row.survey_data_json === 'string'
          ? readRecord(JSON.parse(row.survey_data_json))
          : readRecord(row.survey_data_json);
    } catch (err) {
      console.error('[CondoAbsenceResolver:parseSurveyJson] Lỗi parse survey_data_json:', err);
    }
    result.set(
      row.report_id,
      resolveCondoUnitAbsence({
        isRefusedOrAbsent: row.is_refused_or_absent === true,
        unitStatus: row.unit_status,
        reportStatus: row.report_status,
        surveyJson,
        ownLogCount: Number(row.own_log_count),
        zoneCount: Number(row.zone_count),
        roomDefectCount: Number(row.room_defect_count),
      })
    );
  }
  return result;
}
