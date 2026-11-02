import { firstNonEmptyString, isFilled, isRecord, toNumberOrNull, toRecord, toStringArray } from '../core/condo-normalize.utils';
import { DEFAULT_CONDO_OWNER_FEEDBACK } from '@/features/survey-condo-unit/utils/condoOwnerFeedback';
import type { StepwiseAbsenceLogItem } from '../../stepwise/types';
import type {
  CondoAbsenceDecisionValue,
  CondoAbsenceView,
  CondoUnitAbsenteeView,
  CondoUnitBeamSagging,
  CondoUnitDoorJamming,
  CondoUnitWaterLeakage,
} from '../types/condo-audit.types';

/**
 * Bộ chuyển đổi 2 bộ khóa của Căn hộ con:
 * - Khóa form khảo sát: `upperFloorWaterLeakage`, `doorJammingStatus`, `unitCadUrl`, `absenteeInfo`...
 * - Khóa thẩm định cũ: `waterLeakageFromUpperFloor`, `doorJamming`, `roomLayoutUrl`, `absenceLogs`...
 * Khóa thẩm định được ưu tiên vì đó là phần Admin đã chỉnh; chỉ đọc, không ghi ngược dữ liệu đã lưu.
 */

const DOOR_JAMMING_LABELS: Record<string, string> = {
  NORMAL: 'Bình thường',
  JAMMED: 'Cửa bị kẹt',
  RUBBING_FLOOR: 'Cánh cửa cọ sàn',
  CRACKED_GLASS: 'Nứt kính cửa',
};

const ABSENCE_REASON_LABELS: Record<string, string> = {
  HOMEOWNER_ABSENT: 'Chủ nhà đi vắng / Khóa cửa ngoài',
  UNOCCUPIED_EMPTY: 'Căn hộ bỏ trống / Chưa về ở',
  REFUSED_ACCESS: 'Chủ nhà hoặc khách thuê từ chối tiếp cận',
  LOCKED_SECURITY: 'Căn hộ niêm phong / BQL không có chìa khóa',
};

export function adaptUnitDoorJamming(sJson: Record<string, unknown>): CondoUnitDoorJamming {
  const audit = toRecord(sJson.doorJamming);
  const surveyStatus = firstNonEmptyString(sJson.doorJammingStatus);

  if (Object.keys(audit).length > 0) {
    return {
      hasJamming: Boolean(audit.hasJamming),
      status: surveyStatus || (audit.hasJamming ? 'JAMMED' : 'NORMAL'),
      statusLabel: DOOR_JAMMING_LABELS[surveyStatus] || '',
      locations: firstNonEmptyString(audit.locations),
      severity: firstNonEmptyString(audit.severity),
      photoUrl: firstNonEmptyString(audit.photoUrl),
      notes: firstNonEmptyString(audit.notes),
    };
  }

  return {
    hasJamming: surveyStatus !== '' && surveyStatus !== 'NORMAL',
    status: surveyStatus,
    statusLabel: DOOR_JAMMING_LABELS[surveyStatus] || surveyStatus,
    locations: '',
    severity: '',
    photoUrl: '',
    notes: '',
  };
}

/** Đổi dạng hiển thị về khóa form khi lưu; xóa hết vị trí thì dọn cả trường điểm đơn lẻ của dữ liệu cũ. */
export function toSurveyLeakagePayload(leakage: CondoUnitWaterLeakage): Record<string, unknown> {
  return {
    has: leakage.hasLeakage,
    leakageItems: leakage.items.map((item) => ({
      id: item.id,
      leakageCode: item.leakageCode,
      location: item.location,
      description: item.description,
      suspectedUpperUnitCode: item.suspectedUpperUnitCode,
      ctxPhotoUrl: item.ctxPhotoUrl,
      cuPhotoUrl: item.cuPhotoUrl,
    })),
    location: '',
    description: '',
    photoUrl: '',
  };
}

export function toSurveyDoorJammingPayload(door: CondoUnitDoorJamming): {
  doorJammingStatus: string;
  doorJamming: Record<string, unknown>;
} {
  return {
    doorJammingStatus: door.status,
    doorJamming: {
      hasJamming: door.status !== '' && door.status !== 'NORMAL',
      locations: door.locations,
      severity: door.severity,
      photoUrl: door.photoUrl,
      notes: door.notes,
    },
  };
}

export function adaptUnitLeakage(sJson: Record<string, unknown>): CondoUnitWaterLeakage {
  const audit = toRecord(sJson.waterLeakageFromUpperFloor);
  if (Object.keys(audit).length > 0) {
    const hasLeakage = Boolean(audit.hasLeakage);
    return {
      hasLeakage,
      items: hasLeakage
        ? [
            {
              id: 'audit-leakage',
              leakageCode: '',
              location: firstNonEmptyString(audit.sourceLocation),
              description: firstNonEmptyString(audit.notes),
              suspectedUpperUnitCode: firstNonEmptyString(audit.suspectedUpperUnitCode),
              ctxPhotoUrl: firstNonEmptyString(audit.photoUrl),
              cuPhotoUrl: '',
            },
          ]
        : [],
    };
  }

  const survey = toRecord(sJson.upperFloorWaterLeakage);
  const rawItems = Array.isArray(survey.leakageItems) ? survey.leakageItems : [];
  const items = rawItems.map((raw, idx) => {
    const item = toRecord(raw);
    return {
      id: firstNonEmptyString(item.id) || `leakage_${idx + 1}`,
      leakageCode: firstNonEmptyString(item.leakageCode),
      location: firstNonEmptyString(item.location),
      description: firstNonEmptyString(item.description),
      suspectedUpperUnitCode: firstNonEmptyString(item.suspectedUpperUnitCode),
      ctxPhotoUrl: firstNonEmptyString(item.ctxPhotoUrl, item.photoUrl),
      cuPhotoUrl: firstNonEmptyString(item.cuPhotoUrl),
    };
  });

  // Dữ liệu cũ dạng điểm đơn lẻ, chưa có leakageItems
  const legacyLocation = firstNonEmptyString(survey.location);
  const legacyDescription = firstNonEmptyString(survey.description);
  const legacyPhoto = firstNonEmptyString(survey.photoUrl);
  if (items.length === 0 && (legacyLocation || legacyDescription || legacyPhoto)) {
    items.push({
      id: 'leakage_legacy',
      leakageCode: '',
      location: legacyLocation,
      description: legacyDescription,
      suspectedUpperUnitCode: '',
      ctxPhotoUrl: legacyPhoto,
      cuPhotoUrl: '',
    });
  }

  return { hasLeakage: Boolean(survey.has) || items.length > 0, items };
}

export function adaptUnitBeamSagging(raw: unknown): CondoUnitBeamSagging {
  const beam = toRecord(raw);
  const level = toNumberOrNull(beam.level);
  return {
    hasSagging: Boolean(beam.hasSagging ?? (level !== null && level > 0)),
    level,
    sagMm: toNumberOrNull(beam.sagMm),
    spanM: toNumberOrNull(beam.spanM),
    ratioText: firstNonEmptyString(beam.ratioText),
    position: firstNonEmptyString(beam.position, beam.location),
    photoUrl: firstNonEmptyString(beam.photoUrl),
    notes: firstNonEmptyString(beam.notes),
  };
}

/** KSV chỉ bật công tắc có võng, không chọn mức, nên không thể xét riêng `level`. */
export function isBeamDetailVisible(beam: CondoUnitBeamSagging): boolean {
  return (
    beam.hasSagging ||
    Number(beam.level) > 0 ||
    [beam.sagMm, beam.spanM, beam.ratioText, beam.position, beam.notes].some(isFilled)
  );
}

/** Cùng điều kiện với ô mô tả ở phiếu KSV. */
export function isRenovationDescVisible(
  renovation: { hasRenovated: boolean; description: string },
  history: Record<string, unknown>
): boolean {
  return (
    renovation.hasRenovated ||
    Number(history.renovationLoad) > 0 ||
    Number(history.majorRepair) > 0 ||
    isFilled(renovation.description)
  );
}

export function isSettlementNotesVisible(observed: string, notes: string): boolean {
  return ['SLIGHT', 'NOTICEABLE', 'SEVERE'].includes(observed) || isFilled(notes);
}

export function resolveUnitCadUrl(
  sJson: Record<string, unknown>,
  unitInfo: Record<string, unknown>
): { cadUrl: string; isFloorCadFallback: boolean } {
  const ownCad = firstNonEmptyString(
    sJson.unitFloorPlanSketchUrl,
    sJson.roomLayoutUrl,
    sJson.unitCadUrl,
    sJson.damageMapUrl,
    sJson.unitLayoutSketchUrl,
    unitInfo.unit_cad_url
  );
  if (ownCad) return { cadUrl: ownCad, isFloorCadFallback: false };
  const floorCad = firstNonEmptyString(unitInfo.floor_cad_url);
  return { cadUrl: floorCad, isFloorCadFallback: Boolean(floorCad) };
}

const NORMAL_ABSENCE_VIEW: CondoAbsenceView = {
  state: 'NORMAL',
  signals: [],
  decision: null,
  isHardAbsent: false,
  hasUnknownOwnerName: false,
  hasUnknownOwnerPhone: false,
  hasRoomDefect: false,
  hasResidentStatusSignal: false,
  hasOtherSoftSignal: false,
  hasSuspicion: false,
};

const ABSENT_RESIDENT_STATUSES = ['VẮNG_MẶT_KHÓA_CỬA', 'BỎ_TRỐNG_CHƯA_VỀ_Ở'];
const ADMIN_ABSENT_SIGNAL = 'Admin đã xác nhận vắng chủ';
const RESIDENT_STATUS_SIGNAL_PREFIX = 'Trạng thái cư trú: ';

export const EMPTY_UNIT_ABSENTEE: CondoUnitAbsenteeView = {
  reasonCode: '',
  reason: '',
  notes: '',
  witnessName: '',
  witnessRole: '',
  witnessPhone: '',
  noticeDelivered: false,
  rescheduleDate: '',
  attemptCount: null,
  photos: [],
};

/** Kết luận vắng chủ do backend quyết định; object `absenteeInfo` trong JSON luôn tồn tại nên không dùng để suy luận. */
export function resolveCondoAbsenceView(data: unknown): CondoAbsenceView {
  const absence = toRecord(toRecord(data).condoAbsence);
  return typeof absence.state === 'string' ? (absence as unknown as CondoAbsenceView) : NORMAL_ABSENCE_VIEW;
}

/**
 * Xem trước kết luận khi Admin đổi case chưa lưu, đúng thứ tự `resolveCondoUnitAbsence` của backend.
 * `residentStatus` để undefined nghĩa là chưa đổi so với lúc tải.
 */
export function previewCondoAbsence(
  base: CondoAbsenceView,
  change: { decision: CondoAbsenceDecisionValue | null; residentStatus?: string }
): CondoAbsenceView {
  const { decision, residentStatus } = change;
  const hasResidentSignal =
    residentStatus === undefined ? base.hasResidentStatusSignal : ABSENT_RESIDENT_STATUSES.includes(residentStatus);
  const hasSoftSignal = base.hasOtherSoftSignal || hasResidentSignal;

  const resolveState = (): CondoAbsenceView['state'] => {
    if (base.isHardAbsent || decision === 'ABSENT') return 'ABSENT';
    if (decision === 'NOT_ABSENT') return hasSoftSignal ? 'ACCESS_HISTORY' : 'NORMAL';
    if (hasSoftSignal) return base.hasRoomDefect ? 'ACCESS_HISTORY' : 'ABSENT';
    return base.hasSuspicion ? 'SUSPECTED' : 'NORMAL';
  };

  const keptSignals = base.signals.filter(
    (signal) =>
      signal !== ADMIN_ABSENT_SIGNAL && (residentStatus === undefined || !signal.startsWith(RESIDENT_STATUS_SIGNAL_PREFIX))
  );
  return {
    ...base,
    state: resolveState(),
    decision,
    signals: [
      ...(decision === 'ABSENT' && !base.isHardAbsent ? [ADMIN_ABSENT_SIGNAL] : []),
      ...(residentStatus !== undefined && hasResidentSignal ? [`${RESIDENT_STATUS_SIGNAL_PREFIX}${residentStatus}`] : []),
      ...keptSignals,
    ],
  };
}

export const ABSENCE_DECISION_LABEL = 'Quyết định phân loại vắng chủ';

export function buildCondoAbsenceDecision(decision: CondoAbsenceDecisionValue, reason: string) {
  return { decision, reason, decidedAt: new Date().toISOString() };
}

/**
 * Căn có khuyết tật trong phòng được resolver giữ đủ bước khi chỉ đổi `residentStatus`, nên Admin đổi sang vắng
 * mà không chốt thì tải lại vẫn thấy đủ form. Hệ thống không suy đoán thay, buộc Admin chọn trước khi lưu.
 */
export function needsCondoAbsenceDecision(
  absence: CondoAbsenceView,
  residentStatus: string,
  loadedResidentStatus: string,
  loadedAbsenceState: CondoAbsenceView['state']
): boolean {
  if (residentStatus === loadedResidentStatus || absence.decision !== null) return false;
  return isLeavingCondoAbsence(absence, loadedAbsenceState) ||
    (ABSENT_RESIDENT_STATUSES.includes(residentStatus) && absence.state === 'ACCESS_HISTORY');
}

/** Rời nhóm vắng sẽ hiện lại dữ liệu nội thất KSV điền cho đủ form; khớp validateBeforeModify ở backend. */
export function isLeavingCondoAbsence(
  absence: CondoAbsenceView,
  loadedAbsenceState: CondoAbsenceView['state']
): boolean {
  return loadedAbsenceState === 'ABSENT' && absence.state !== 'ABSENT';
}

/** Kết luận vắng theo thay đổi chưa lưu, để cảnh báo ở thanh trên khớp với form đang sửa. */
export function resolvePendingCondoAbsenceState(
  data: unknown,
  updates: Record<string, unknown>
): CondoAbsenceView['state'] {
  const saved = resolveCondoAbsenceView(data);
  const pendingDecision = toRecord(updates.absenceDecision).decision;
  return previewCondoAbsence(saved, {
    decision: pendingDecision === 'ABSENT' || pendingDecision === 'NOT_ABSENT' ? pendingDecision : saved.decision,
    residentStatus: typeof updates.residentStatus === 'string' ? updates.residentStatus : undefined,
  }).state;
}

/** Nhật ký vắng là bản ghi quan hệ của lượt tiếp cận nên bù được phần JSON hồ sơ cũ còn thiếu. */
export function adaptUnitAbsentee(
  sJson: Record<string, unknown>,
  logs: StepwiseAbsenceLogItem[] = []
): CondoUnitAbsenteeView | null {
  const info = isRecord(sJson.absenteeInfo) ? sJson.absenteeInfo : null;
  const isAbsentee =
    Boolean(sJson.isAbsentee) || Boolean(sJson.isRefusedOrAbsent) || sJson.residentStatus === 'VẮNG_MẶT_KHÓA_CỬA';
  if (!isAbsentee && !info) return null;

  const rawReason = firstNonEmptyString(info?.absenceReason, sJson.absenteeReason, sJson.absenceReason);
  const reason =
    rawReason === 'OTHER'
      ? firstNonEmptyString(info?.customReason, info?.notes)
      : ABSENCE_REASON_LABELS[rawReason] || rawReason;
  const latestLog = logs[0];
  const signatures = toRecord(sJson.signatures);
  const photos = [
    ...toStringArray(info?.absenteeMinutesPhotos),
    ...toStringArray(sJson.absenteeMinutesPhotos),
    ...toStringArray(sJson.absenteeNoticePhotos),
    ...logs.flatMap((log) => [...toStringArray(log.minutesPhotos), ...toStringArray(log.photoUrl ? [log.photoUrl] : [])]),
  ];

  return {
    reasonCode: rawReason,
    reason,
    notes: firstNonEmptyString(info?.notes),
    // Khớp các nguồn `resolveAbsenceEvidence` tính là có người chứng kiến
    witnessName: firstNonEmptyString(
      info?.witnessName,
      latestLog?.witness_name,
      signatures.witnessName,
      sJson.witnessName,
      toRecord(signatures.localAuthority).fullName
    ),
    witnessRole: firstNonEmptyString(info?.witnessRole, latestLog?.witness_role, signatures.witnessRole, sJson.witnessRole),
    witnessPhone: firstNonEmptyString(info?.witnessPhone, latestLog?.witness_phone, signatures.witnessPhone, sJson.witnessPhone),
    noticeDelivered: Boolean(info?.noticeDelivered) || logs.some((log) => log.notice_delivered === true),
    rescheduleDate: firstNonEmptyString(info?.rescheduleDate, latestLog?.reschedule_date),
    attemptCount: toNumberOrNull(info?.attemptCount ?? latestLog?.attemptNumber),
    photos: Array.from(new Set(photos)),
  };
}

/** Câu điền sẵn của form không phải lời ghi nhận, căn vắng chỉ giữ nội dung KSV thực sự nhập. */
export function getMeaningfulOwnerFeedback(value: unknown): string {
  const text = firstNonEmptyString(value).trim();
  return text === DEFAULT_CONDO_OWNER_FEEDBACK ? '' : text;
}

/** Thẻ nhật ký chỉ hiện một ảnh mỗi lượt; phần còn lại phải liệt kê thêm để không mất minh chứng. */
export function getPhotosOutsideAbsenceLogs(photos: string[], logs: StepwiseAbsenceLogItem[]): string[] {
  const shownInLogs = new Set(
    logs.flatMap((log) => {
      const record = log as Record<string, unknown>;
      const url = firstNonEmptyString(log.photoUrl, record.photo_url, record.evidence_photo_url);
      return url ? [url] : [];
    })
  );
  return photos.filter((url) => !shownInLogs.has(url));
}
