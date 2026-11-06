import { BadRequestError } from '../../common/errors/problem-details';

/**
 * Hồ sơ nhà dân vắng còn ở DRAFT mà Admin được tiếp nhận vào thẩm định (alias `r` = base_survey_reports, `p` = parcels).
 * Có nhật ký vắng thật và cờ vắng trên phiếu; hồ sơ Admin đã "Mở lại khảo sát" bị loại vì luồng đó tắt is_refused_or_absent.
 * Thửa IN_PROGRESS vẫn được nhận (giao diện cảnh báo KSV có thể đang khảo sát lại). Chuỗi tĩnh, không ghép input.
 */
export const ABSENT_DRAFT_INTAKE_SQL_CONDITION = `(
  r.unit_id IS NULL
  AND r.status::text = 'DRAFT'
  AND r.deleted_at IS NULL
  AND r.is_refused_or_absent = TRUE
  AND p.active_phase1_report_id = r.id
  AND p.survey_status::text IN ('POSTPONED_ABSENT', 'IN_PROGRESS')
  AND EXISTS (SELECT 1 FROM survey_absence_logs al WHERE al.parcel_id = r.parcel_id AND al.unit_id IS NULL)
)`;

/**
 * Minh chứng của hồ sơ vắng mặt. Ảnh biển số P-01 không phải giấy hẹn nên không bao giờ được tính vào đây.
 * Nhà dân ghi người chứng kiến ở khối đại diện địa phương, căn hộ ghi trong `absenteeInfo` và nhật ký vắng.
 */
export interface AbsenceLogEvidenceRow {
  photo_proof_url?: string | null;
  minutes_photos_json?: unknown;
  witness_name?: string | null;
}

export interface AbsenceEvidenceSummary {
  photos: string[];
  hasWitness: boolean;
  missing: string[];
}

function readRecord(val: unknown): Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val) ? (val as Record<string, unknown>) : {};
}

function readUrlList(val: unknown): string[] {
  let parsed = val;
  if (typeof val === 'string') {
    try {
      parsed = JSON.parse(val);
    } catch (err) {
      console.error('[AbsenceEvidence:readUrlList] Lỗi parse danh sách ảnh biên bản:', err);
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function hasText(val: unknown): boolean {
  return typeof val === 'string' && val.trim().length > 0;
}

/** Tên cột trong `survey_absence_logs` khác hợp đồng hiển thị của Step 9 thẩm định. */
export function toAuditAbsenceLogView<T extends AbsenceLogEvidenceRow & { attempt_count?: number | null; recorded_at?: unknown }>(
  log: T
) {
  const minutesPhotos = readUrlList(log.minutes_photos_json);
  return {
    ...log,
    attemptNumber: log.attempt_count ?? undefined,
    attemptDate: log.recorded_at,
    photoUrl: log.photo_proof_url || minutesPhotos[0] || undefined,
    minutesPhotos,
  };
}

/** Nhà dân vắng dừng ở Bước 1 nên `surveyCaseType` là dấu hiệu chính; `isAbsenteeSurvey` là cờ song hành của form. */
export function isResidentialAbsentSurvey(surveyJson: Record<string, unknown>): boolean {
  return String(surveyJson.surveyCaseType || '').toUpperCase() === 'ABSENTEE' || surveyJson.isAbsenteeSurvey === true;
}

const MIN_ABSENCE_CASE_REASON_LENGTH = 10;

// Dữ liệu chỉ có được khi vào nhà; khớp RESIDENTIAL_ABSENT_INTERIOR_KEYS ở useAuditStepwiseForm.ts của frontend
const RESIDENTIAL_ABSENT_INTERIOR_KEYS = new Set([
  'damageZones', 'zones', 'floors', 'floorSurvey', 'structuralElements', 'localDefects', 'overviewPhotos',
  'cadZonePins', 'cadElementPins', 'burlandSummary', 'dominantBurlandGrade', 'historyInterview',
  'interiorRenovationHistory', 'beamSagging', 'settlementObserved', 'settlementNotes', 'doorJammingStatus',
  'doorJamming', 'upperFloorWaterLeakage', 'hasSensitiveEquipment', 'sensitiveEquipmentDesc', 'ecs', 'vi',
  'vulnerabilityIndex', 'executiveSummary', 'braAssessment', 'braMatrix', 'impactAssessment', 'ownerFeedback',
  'constructionYear', 'structureSystem', 'foundationCatScore', 'aboveFloors', 'undergroundFloors',
  'summaryConclusions', 'engineeringRecommendations',
]);

/**
 * Áp quy tắc nhánh vắng lên bản gộp khi Admin sửa nhà dân. Hồ sơ KSV đã nộp nhánh vắng không có dữ liệu nội thất,
 * đổi ngược trực tiếp sẽ buộc Admin bịa số nên phải đi qua Mở Lại Khảo Sát.
 */
export function applyResidentialCaseRules(params: {
  isLockedAbsent: boolean;
  existingJson: Record<string, unknown>;
  mergedJson: Record<string, unknown>;
  updates: Record<string, unknown>;
  adminId: string;
}): void {
  const { isLockedAbsent, existingJson, mergedJson, updates, adminId } = params;
  if (updates.surveyCaseType !== undefined) {
    mergedJson.isAbsenteeSurvey = String(updates.surveyCaseType).toUpperCase() === 'ABSENTEE';
  }

  const wasAbsent = isResidentialAbsentSurvey(existingJson);
  const isAbsent = isResidentialAbsentSurvey(mergedJson);
  if (wasAbsent && !isAbsent && isLockedAbsent) {
    throw new BadRequestError('Hồ sơ do khảo sát viên nộp nhánh vắng mặt: dùng Mở Lại Khảo Sát thay vì đổi loại hình.');
  }

  if (wasAbsent !== isAbsent) {
    const decision = readRecord(updates.absenceDecision);
    const reason = String(decision.reason || '').trim();
    if (reason.length < MIN_ABSENCE_CASE_REASON_LENGTH) {
      throw new BadRequestError(`Đổi loại hình vắng mặt cần lý do tối thiểu ${MIN_ABSENCE_CASE_REASON_LENGTH} ký tự.`);
    }
    // Người và thời điểm quyết định là chứng cứ lưu vết nên không lấy từ client
    mergedJson.absenceDecision = {
      decision: isAbsent ? 'ABSENT' : 'NOT_ABSENT',
      reason,
      decidedBy: adminId,
      decidedAt: new Date().toISOString(),
    };
    if (isAbsent && !hasText(mergedJson.absenteeReason)) mergedJson.absenteeReason = reason;
  }

  if (!isAbsent) return;
  const blockedKeys = Object.keys(updates).filter((key) => RESIDENTIAL_ABSENT_INTERIOR_KEYS.has(key));
  if (blockedKeys.length > 0) {
    throw new BadRequestError(`Nhà vắng mặt không có dữ liệu để sửa ở các trường: ${blockedKeys.join(', ')}.`);
  }
  // Võng dầm là số đo trong nhà, lưu lún nghiêng ngoài nhà không được làm đổi giá trị cũ
  if (Object.keys(readRecord(updates.settlementTilt)).length > 0) {
    mergedJson.settlementTilt = {
      ...readRecord(updates.settlementTilt),
      beamSagging: readRecord(existingJson.settlementTilt).beamSagging,
    };
  }
}

export function resolveAbsenceEvidence(
  surveyJson: Record<string, unknown>,
  logs: AbsenceLogEvidenceRow[]
): AbsenceEvidenceSummary {
  const info = readRecord(surveyJson.absenteeInfo);
  const signatures = readRecord(surveyJson.signatures);

  const photos = Array.from(
    new Set([
      ...readUrlList(info.absenteeMinutesPhotos),
      ...readUrlList(surveyJson.absenteeMinutesPhotos),
      ...readUrlList(surveyJson.absenteeNoticePhotos),
      ...readUrlList(surveyJson.absentNoticePhotos),
      ...readUrlList(surveyJson.doorNoticePhotos),
      ...logs.flatMap((log) => [
        ...(hasText(log.photo_proof_url) ? [String(log.photo_proof_url)] : []),
        ...readUrlList(log.minutes_photos_json),
      ]),
    ])
  );

  const hasWitness =
    hasText(info.witnessName) ||
    hasText(surveyJson.witnessName) ||
    hasText(signatures.witnessName) ||
    hasText(readRecord(signatures.localAuthority).fullName) ||
    logs.some((log) => hasText(log.witness_name));

  const missing = [
    ...(photos.length === 0 ? ['Ảnh dán giấy hẹn / biên bản vắng nhà'] : []),
    ...(hasWitness ? [] : ['Người chứng kiến']),
  ];

  return { photos, hasWitness, missing };
}
