import type {
  AuditStepwiseData,
  StepwiseAbsenceLogItem,
  StepwiseIdentificationPhotoItem,
} from '../../stepwise/types';
import { calcBurlandGradeFromWidthFrontend } from '../core/condo-zone.mappers';
import { firstNonEmptyString, toNumberOrNull, toRecord } from '../core/condo-normalize.utils';
import { splitCondoZonesAndElements } from '../core/condo-zone.mappers';
import type { CondoUnitFormState } from '../types/condo-audit.types';
import {
  adaptUnitAbsentee,
  resolveCondoAbsenceView,
  adaptUnitBeamSagging,
  adaptUnitDoorJamming,
  adaptUnitLeakage,
  resolveUnitCadUrl,
  toSurveyDoorJammingPayload,
  toSurveyLeakagePayload,
} from './condo-unit.adapters';

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
    Array.isArray(leftPane.structuralElements) && leftPane.structuralElements.length > 0
      ? leftPane.structuralElements
      : sJson.structuralElements,
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
  const absenteeInfo = absence.state === 'ABSENT' || absence.state === 'ACCESS_HISTORY' ? adaptUnitAbsentee(sJson) : null;
  const renovation = toRecord(sJson.interiorRenovationHistory);

  return recomputeCondoUnitBurlandOnChange(
    {
      unitCode: firstNonEmptyString(unitInfo.unit_code, data.unitCode, sJson.unitCode),
      displayCode: firstNonEmptyString(unitInfo.display_code, sJson.displayCode),
      floorNumber: floorNum,
      ownerName: firstNonEmptyString(unitInfo.owner_name, data.ownerName, sJson.ownerName),
      ownerPhone: firstNonEmptyString(unitInfo.owner_phone, data.ownerPhone, sJson.ownerPhone),
      ownerIdCard: firstNonEmptyString(unitInfo.owner_id_card, sJson.ownerIdCard),
      residentStatus: firstNonEmptyString(unitInfo.resident_status, sJson.residentStatus),
      unitAreaM2: toNumberOrNull(sJson.unitAreaM2 ?? unitInfo.unit_area_m2),
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
        ownerName: firstNonEmptyString(sigs.ownerName, unitInfo.owner_name, data.ownerName),
        ownerSignature: firstNonEmptyString(sigs.ownerSignature, data.ownerSignatureUrl, sJson.ownerSignature),
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
    },
    'init'
  );
}

export function recomputeCondoUnitBurlandOnChange(
  state: CondoUnitFormState,
  _changedKey: string
): CondoUnitFormState {
  let maxGrade = 0;
  let governingCode = '';
  let hasStructCrit = false;
  let totalActiveDefects = 0;

  for (const z of state.damageZones || []) {
    if (z.isDeleted) continue;
    if (z.burlandGrade > maxGrade) {
      maxGrade = z.burlandGrade;
      governingCode = z.zoneCode;
    }
    for (const d of z.defects || []) {
      if (d.isDeleted) continue;
      totalActiveDefects += 1;
      const g = calcBurlandGradeFromWidthFrontend(
        Number(d.widthMaxMm || 0),
        Boolean(d.isStructuralCritical)
      );
      if (g > maxGrade) {
        maxGrade = g;
        governingCode = `${z.zoneCode}/${d.defectCode}`;
      }
      if (d.isStructuralCritical) hasStructCrit = true;
    }
  }

  for (const el of state.structuralElements || []) {
    if (el.isDeleted) continue;
    for (const d of el.defects || []) {
      if (d.isDeleted) continue;
      totalActiveDefects += 1;
      const g = calcBurlandGradeFromWidthFrontend(Number(d.widthMaxMm || 0), true);
      if (g > maxGrade) {
        maxGrade = g;
        governingCode = `${el.elementCode}/${d.defectCode}`;
      }
      hasStructCrit = true;
    }
  }

  // Nếu có võng dầm/sàn mức >= 2 thì nâng cảnh báo kỹ sư kết cấu
  if (state.beamSagging?.hasSagging && Number(state.beamSagging.level) >= 2) {
    hasStructCrit = true;
    if (maxGrade < 3) maxGrade = 3;
  }

  return {
    ...state,
    burlandSummary: {
      ...state.burlandSummary,
      localMaxGrade: maxGrade,
      governingZoneCode: governingCode || undefined,
      needStructuralEngineerReview: hasStructCrit || maxGrade >= 3,
      controllingDefectsCount: totalActiveDefects,
    },
  };
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
  }

  return updates;
}
