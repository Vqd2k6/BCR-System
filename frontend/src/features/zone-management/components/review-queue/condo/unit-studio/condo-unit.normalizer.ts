import type {
  AuditStepwiseData,
  StepwiseAbsenceLogItem,
  StepwiseIdentificationPhotoItem,
} from '../../stepwise/types';
import { mergeCondoBurlandSummary, syncCondoBurlandOnLoad } from '../core/condo-zone.mappers';
import type { CondoBurlandLoadSync } from '../core/condo-zone.mappers';
import { firstNonEmptyString, toNumberOrNull, toRecord } from '../core/condo-normalize.utils';
import { resolveRawCondoElements, splitCondoZonesAndElements } from '../core/condo-zone.mappers';
import type { CondoAbsenceView, CondoUnitFormState } from '../types/condo-audit.types';
import {
  adaptUnitAbsentee,
  EMPTY_UNIT_ABSENTEE,
  previewCondoAbsence,
  resolveCondoAbsenceView,
  adaptUnitBeamSagging,
  adaptUnitDoorJamming,
  adaptUnitLeakage,
  resolveUnitCadUrl,
  toSurveyDoorJammingPayload,
  toSurveyLeakagePayload,
  isLeavingCondoAbsence,
  needsCondoAbsenceDecision,
} from './condo-unit.adapters';

// Những gì KSV thực sự ghi nhận được với căn vắng; khớp ABSENT_UNIT_EDITABLE_KEYS ở condo-unit.strategy.ts của backend
const ABSENT_UNIT_EDITABLE_KEYS = new Set([
  'displayCode',
  'residentStatus',
  'ownerName',
  'ownerPhone',
  'ownerIdCard',
  'unitAreaM2',
  'absenceDecision',
  'absenteeInfo',
  'isAbsentee',
  'signatures',
  'surveyDate',
  'photoRotations',
  'studioEnhancedPhotos',
  'studioEnhancedByOriginal',
]);

const IDENTITY_KEYS = ['ownerName', 'ownerPhone', 'ownerIdCard', 'unitAreaM2'] as const;

/** Kết luận vắng chủ theo form hiện tại, gồm cả thay đổi chưa lưu. */
export function resolveCondoFormAbsence(state: CondoUnitFormState): CondoAbsenceView {
  return previewCondoAbsence(state.absence, {
    decision: state.absenceDecision?.decision ?? null,
    residentStatus: state.residentStatus === state.loadedResidentStatus ? undefined : state.residentStatus,
  });
}

export function getCondoUnitSaveBlockReason(state: CondoUnitFormState): string | null {
  const absence = resolveCondoFormAbsence(state);
  if (!needsCondoAbsenceDecision(absence, state.residentStatus, state.loadedResidentStatus, state.loadedAbsenceState)) {
    return null;
  }
  return isLeavingCondoAbsence(absence, state.loadedAbsenceState)
    ? 'Căn hộ đang vắng chủ: hãy xác nhận Đã Khảo Sát kèm lý do ở Mục 1.2 trước khi lưu.'
    : 'Căn hộ có khuyết tật trong phòng: hãy xác nhận Vắng Chủ hoặc Đã Khảo Sát ở Mục 1.2 trước khi lưu.';
}

/** Lọc khi tính diff, không xóa form: Admin chuyển case qua lại thì phần đã sửa vẫn còn. */
export function isCondoUnitDirtyKeyActive(key: string, state: CondoUnitFormState): boolean {
  const rootKey = key.split('.')[0];
  if (resolveCondoFormAbsence(state).state === 'ABSENT') return ABSENT_UNIT_EDITABLE_KEYS.has(rootKey);
  return rootKey !== 'absenteeInfo';
}

function toUnitPhotoObj(
  raw: unknown,
  defaultCode: string
): StepwiseIdentificationPhotoItem {
  if (!raw) return { url: '', photoCode: defaultCode };
  if (typeof raw === 'string') return { url: raw, photoCode: defaultCode };
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return {
      ...obj,
      url: String(obj.url || obj.photoUrl || obj.annotated_photo_url || obj.raw_photo_url || ''),
      photoCode: String(obj.photoCode || defaultCode),
    };
  }
  return { url: '', photoCode: defaultCode };
}

export function normalizeCondoUnitData(data: AuditStepwiseData): CondoUnitFormState {
  const sJson = (data.surveyJson ||
    data.survey_data_json ||
    data.leftPane?.surveyJson ||
    {}) as Record<string, unknown>;
  const leftPane = toRecord(data.leftPane);
  const unitInfo = toRecord(data.unitInfo);
  const sigs = toRecord(leftPane.signatures ?? sJson.signatures);
  const surveySigs = toRecord(sJson.signatures);
  const idPhotos = toRecord(
    data.identificationPhotos || data.rightPane?.identificationPhotos || sJson.identificationPhotos
  );

  const floorNum = toNumberOrNull(unitInfo.floor_number ?? sJson.floorNumber ?? sJson.floor_number);
  const defaultFloorName = floorNum !== null ? `Tầng ${floorNum}` : '';

  const rawZonesSource = Array.isArray(leftPane.damageZones) && leftPane.damageZones.length > 0
    ? leftPane.damageZones
    : sJson.damageZones ?? sJson.zones;
  const { damageZones, structuralElements } = splitCondoZonesAndElements(
    rawZonesSource,
    resolveRawCondoElements(leftPane.structuralElements, sJson),
    defaultFloorName
  );

  const rawAbsenceLogs = Array.isArray(sJson.absenceLogs)
    ? (sJson.absenceLogs as StepwiseAbsenceLogItem[])
    : Array.isArray(leftPane.absenceLogs)
      ? (leftPane.absenceLogs as StepwiseAbsenceLogItem[])
      : [];

  const burlandSummary =
    sJson.burlandSummary && typeof sJson.burlandSummary === 'object'
      ? (sJson.burlandSummary as CondoUnitFormState['burlandSummary'])
      : {
          localMaxGrade: Number(data.leftPane?.riskScoreCard?.e1_burland_score ?? 0),
          needStructuralEngineerReview: false,
          controllingDefectsCount: 0,
        };

  const { cadUrl, isFloorCadFallback } = resolveUnitCadUrl(sJson, unitInfo);
  const absence = resolveCondoAbsenceView(data);
  // Luôn dựng để Step 9 có dữ liệu ngay khi Admin chuyển căn thường sang vắng
  const absenteeInfo = adaptUnitAbsentee(sJson, rawAbsenceLogs) ?? EMPTY_UNIT_ABSENTEE;
  const absJson = toRecord(sJson.absenteeInfo);
  const resolvedWitnessName = firstNonEmptyString(
    sigs.witnessName,
    surveySigs.witnessName,
    sJson.witnessName,
    absJson.witnessName,
    absenteeInfo?.witnessName
  );
  const resolvedWitnessRole = firstNonEmptyString(
    sigs.witnessRole,
    surveySigs.witnessRole,
    sJson.witnessRole,
    absJson.witnessRole,
    absenteeInfo?.witnessRole
  );
  const resolvedWitnessPhone = firstNonEmptyString(
    sigs.witnessPhone,
    surveySigs.witnessPhone,
    sJson.witnessPhone,
    absJson.witnessPhone,
    absenteeInfo?.witnessPhone
  );

  if (absenteeInfo) {
    if (!absenteeInfo.witnessName && resolvedWitnessName) absenteeInfo.witnessName = resolvedWitnessName;
    if (!absenteeInfo.witnessRole && resolvedWitnessRole) absenteeInfo.witnessRole = resolvedWitnessRole;
    if (!absenteeInfo.witnessPhone && resolvedWitnessPhone) absenteeInfo.witnessPhone = resolvedWitnessPhone;
  }

  const residentStatus = firstNonEmptyString(unitInfo.resident_status, sJson.residentStatus);
  // Có khóa trong lớp phủ là Admin đã hiệu chỉnh, kể cả đã xóa: không đọc tiếp bản gốc hay chủ tòa mẹ
  const identityOverrides = toRecord(sJson.adminIdentityOverrides);
  const identityOverrideKeys = IDENTITY_KEYS.filter((key) => key in identityOverrides);
  const resolveOwnerText = (key: 'ownerName' | 'ownerPhone' | 'ownerIdCard', original: string): string =>
    key in identityOverrides ? firstNonEmptyString(identityOverrides[key]) : original;
  const renovation = toRecord(sJson.interiorRenovationHistory);

  // Trả đúng dữ liệu đang lưu (bản gốc của diff); cấp Burland đồng bộ ở syncCondoUnitBurlandOnLoad
  return {
      unitCode: firstNonEmptyString(unitInfo.unit_code, data.unitCode, sJson.unitCode),
      displayCode: firstNonEmptyString(unitInfo.display_code, sJson.displayCode),
      floorNumber: floorNum,
      ownerName: resolveOwnerText('ownerName', firstNonEmptyString(unitInfo.owner_name, data.ownerName, sJson.ownerName)),
      ownerPhone: resolveOwnerText('ownerPhone', firstNonEmptyString(unitInfo.owner_phone, data.ownerPhone, sJson.ownerPhone)),
      ownerIdCard: resolveOwnerText('ownerIdCard', firstNonEmptyString(unitInfo.owner_id_card, sJson.ownerIdCard)),
      residentStatus,
      loadedResidentStatus: residentStatus,
      loadedAbsenceState: absence.state,
      ksvOriginalIdentity: {
        ownerName: firstNonEmptyString(unitInfo.owner_name, sJson.ownerName),
        ownerPhone: firstNonEmptyString(unitInfo.owner_phone, sJson.ownerPhone),
        ownerIdCard: firstNonEmptyString(unitInfo.owner_id_card, sJson.ownerIdCard),
        unitAreaM2: toNumberOrNull(sJson.unitAreaM2),
      },
      identityOverrideKeys,
      unitAreaM2: toNumberOrNull('unitAreaM2' in identityOverrides ? identityOverrides.unitAreaM2 : sJson.unitAreaM2),
      isRefusedOrAbsent: absence.state === 'ABSENT',
      absence,
      absenceDecision: (sJson.absenceDecision as CondoUnitFormState['absenceDecision']) ?? null,
      absenteeInfo,
      absenceLogs: rawAbsenceLogs,
      doorJamming: adaptUnitDoorJamming(sJson),
      waterLeakageFromUpperFloor: adaptUnitLeakage(sJson),
      beamSagging: adaptUnitBeamSagging(sJson.beamSagging ?? leftPane.beamSagging),
      settlementObserved: firstNonEmptyString(sJson.settlementObserved),
      settlementNotes: firstNonEmptyString(sJson.settlementNotes),
      historyInterview: toRecord(sJson.historyInterview ?? leftPane.interview),
      hasSensitiveEquipment: Boolean(sJson.hasSensitiveEquipment),
      sensitiveEquipmentDesc: firstNonEmptyString(sJson.sensitiveEquipmentDesc),
      interiorRenovationHistory: {
        hasRenovated: Boolean(renovation.hasRenovated),
        description: firstNonEmptyString(renovation.description),
      },
      photoP01: toUnitPhotoObj(idPhotos.photoP01 || idPhotos.p01 || sJson.photoP01, 'P-01'),
      photoP04: toUnitPhotoObj(idPhotos.photoP04 || idPhotos.p04 || sJson.photoP04, 'P-04'),
      roomLayoutUrl: cadUrl,
      structuralCadUrl: firstNonEmptyString(sJson.unitStructuralCadUrl),
      cadZonePins: Array.isArray(sJson.cadZonePins) ? (sJson.cadZonePins as CondoUnitFormState['cadZonePins']) : [],
      cadElementPins: Array.isArray(sJson.cadElementPins) ? (sJson.cadElementPins as CondoUnitFormState['cadElementPins']) : [],
      isFloorCadFallback,
      roomLayoutNotes: firstNonEmptyString(sJson.roomLayoutNotes),
      damageZones,
      structuralElements,
      burlandSummary,
      summaryConclusions: firstNonEmptyString(data.summaryConclusions, sJson.summaryConclusions),
      engineeringRecommendations: firstNonEmptyString(
        data.engineeringRecommendations,
        sJson.engineeringRecommendations
      ),
      ownerFeedback: firstNonEmptyString(sJson.ownerFeedback, sigs.ownerFeedback, leftPane.ownerFeedback),
      signatures: {
        surveyorName: firstNonEmptyString(sigs.surveyorName, data.surveyorName),
        surveyorPhone: firstNonEmptyString(sigs.surveyorPhone, data.surveyorPhone),
        surveyorSignature: firstNonEmptyString(sigs.surveyorSignature, data.surveyorSignatureUrl, sJson.surveyorSignature),
        ownerName: resolveOwnerText('ownerName', firstNonEmptyString(sigs.ownerName, unitInfo.owner_name, data.ownerName)),
        ownerSignature: firstNonEmptyString(sigs.ownerSignature, data.ownerSignatureUrl, sJson.ownerSignature),
        witnessName: resolvedWitnessName,
        witnessRole: resolvedWitnessRole,
        witnessPhone: resolvedWitnessPhone,
        // leftPane.signatures đã chuẩn hóa không có chữ ký người làm chứng
        witnessSignature: firstNonEmptyString(surveySigs.witnessSignature, surveySigs.witnessSignatureUrl),
        workingMinutesPhotos: Array.isArray(sigs.workingMinutesPhotos)
          ? (sigs.workingMinutesPhotos as CondoUnitFormState['signatures']['workingMinutesPhotos'])
          : Array.isArray(sJson.workingMinutesPhotos)
            ? (sJson.workingMinutesPhotos as CondoUnitFormState['signatures']['workingMinutesPhotos'])
            : [],
      },
      photoRotations:
        sJson.photoRotations && typeof sJson.photoRotations === 'object'
          ? (sJson.photoRotations as Record<string, number>)
          : {},
    };
}

const unitSaggingNeedsReview = (state: CondoUnitFormState): boolean =>
  Boolean(state.beamSagging?.hasSagging && Number(state.beamSagging.level) >= 2);

/** Mở hồ sơ: nâng cấp Burland lưu thiếu/thấp hơn cấp đo (căn vắng chủ không có dữ liệu nội thất → bỏ qua). */
export function syncCondoUnitBurlandOnLoad(state: CondoUnitFormState): CondoBurlandLoadSync<CondoUnitFormState> {
  if (resolveCondoFormAbsence(state).state === 'ABSENT') {
    return { state, dirty: {}, info: { zoneCount: 0, summaryChanged: false } };
  }
  return syncCondoBurlandOnLoad(state, unitSaggingNeedsReview(state));
}

export function recomputeCondoUnitBurlandOnChange(
  state: CondoUnitFormState,
  _changedKey: string
): CondoUnitFormState {
  // Võng dầm/sàn mức ≥ 2 chỉ bật cảnh báo kỹ sư kết cấu, không đẩy cấp Burland (thang Burland chỉ cho vết nứt vùng Z)
  return mergeCondoBurlandSummary(state, unitSaggingNeedsReview(state));
}

export function buildCondoUnitUpdatesPayload(
  formState: CondoUnitFormState,
  dirtyFields: Record<string, { label: string; oldValue: unknown; newValue: unknown }>
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const dirtyKeys = Object.keys(dirtyFields);

  for (const k of dirtyKeys) {
    if (k.includes('.')) {
      const [parentKey] = k.split('.');
      updates[parentKey] = formState[parentKey];
    } else {
      updates[k] = formState[k];
    }
  }

  if (
    dirtyKeys.includes('damageZones') ||
    dirtyKeys.includes('structuralElements') ||
    dirtyKeys.some((k) => k.startsWith('beamSagging'))
  ) {
    updates.burlandSummary = formState.burlandSummary;
  }
  // Backend chỉ ghi cấp vùng, tổng hợp Burland và E1 khi payload có damageZones
  if (updates.burlandSummary !== undefined && updates.damageZones === undefined) {
    updates.damageZones = formState.damageZones;
  }

  if (dirtyKeys.includes('ownerFeedback')) {
    updates.ownerRemarks = formState.ownerFeedback;
  }

  if (updates.doorJamming !== undefined) {
    Object.assign(updates, toSurveyDoorJammingPayload(formState.doorJamming));
  }

  if (updates.waterLeakageFromUpperFloor !== undefined) {
    delete updates.waterLeakageFromUpperFloor;
    updates.upperFloorWaterLeakage = toSurveyLeakagePayload(formState.waterLeakageFromUpperFloor);
  }

  const absentee = formState.absenteeInfo;
  if (updates.absenteeInfo !== undefined && absentee) {
    updates.isAbsentee = true;
    updates.absenteeInfo = {
      absenceReason: absentee.reasonCode,
      notes: absentee.notes,
      witnessName: absentee.witnessName,
      witnessRole: absentee.witnessRole,
      witnessPhone: absentee.witnessPhone,
      noticeDelivered: absentee.noticeDelivered,
      rescheduleDate: absentee.rescheduleDate,
      attemptCount: absentee.attemptCount,
    };
    // Đồng bộ người làm chứng sang signatures để lưu trọn vẹn cả hai khóa
    const sigs = (updates.signatures || formState.signatures || {}) as Record<string, unknown>;
    updates.signatures = {
      ...sigs,
      witnessName: absentee.witnessName,
      witnessRole: absentee.witnessRole,
      witnessPhone: absentee.witnessPhone,
    };
  }

  return updates;
}
