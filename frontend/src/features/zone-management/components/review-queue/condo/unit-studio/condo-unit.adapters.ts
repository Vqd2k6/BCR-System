import { firstNonEmptyString, isRecord, toNumberOrNull, toRecord, toStringArray } from '../core/condo-normalize.utils';
import type {
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
};

/** Kết luận vắng chủ do backend quyết định; object `absenteeInfo` trong JSON luôn tồn tại nên không dùng để suy luận. */
export function resolveCondoAbsenceView(data: unknown): CondoAbsenceView {
  const absence = toRecord(toRecord(data).condoAbsence);
  return typeof absence.state === 'string' ? (absence as unknown as CondoAbsenceView) : NORMAL_ABSENCE_VIEW;
}

export function adaptUnitAbsentee(sJson: Record<string, unknown>): CondoUnitAbsenteeView | null {
  const info = isRecord(sJson.absenteeInfo) ? sJson.absenteeInfo : null;
  const isAbsentee =
    Boolean(sJson.isAbsentee) || Boolean(sJson.isRefusedOrAbsent) || sJson.residentStatus === 'VẮNG_MẶT_KHÓA_CỬA';
  if (!isAbsentee && !info) return null;

  const rawReason = firstNonEmptyString(info?.absenceReason, sJson.absenteeReason, sJson.absenceReason);
  const reason =
    rawReason === 'OTHER'
      ? firstNonEmptyString(info?.customReason, info?.notes)
      : ABSENCE_REASON_LABELS[rawReason] || rawReason;
  const photos = [
    ...toStringArray(info?.absenteeMinutesPhotos),
    ...toStringArray(sJson.absenteeMinutesPhotos),
    ...toStringArray(sJson.absenteeNoticePhotos),
  ];

  return {
    reasonCode: rawReason,
    reason,
    notes: firstNonEmptyString(info?.notes),
    witnessName: firstNonEmptyString(info?.witnessName),
    witnessRole: firstNonEmptyString(info?.witnessRole),
    witnessPhone: firstNonEmptyString(info?.witnessPhone),
    noticeDelivered: Boolean(info?.noticeDelivered),
    rescheduleDate: firstNonEmptyString(info?.rescheduleDate),
    attemptCount: toNumberOrNull(info?.attemptCount),
    photos: Array.from(new Set(photos)),
  };
}
