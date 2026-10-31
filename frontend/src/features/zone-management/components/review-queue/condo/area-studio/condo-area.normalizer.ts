import type { AuditStepwiseData } from '../../stepwise/types';
import { calcBurlandGradeFromWidthFrontend } from '../core/condo-zone.mappers';
import { toRecord } from '../core/condo-normalize.utils';
import { splitCondoZonesAndElements } from '../core/condo-zone.mappers';
import type { CondoAreaFormState } from '../types/condo-audit.types';

export function normalizeCondoAreaData(data: AuditStepwiseData): CondoAreaFormState {
  const sJson = (data.surveyJson ||
    data.survey_data_json ||
    data.leftPane?.surveyJson ||
    {}) as Record<string, unknown>;
  const areaInfo =
    sJson.areaInfo && typeof sJson.areaInfo === 'object'
      ? (sJson.areaInfo as Record<string, unknown>)
      : {};
  const unitInfo = (data.unitInfo || {}) as Record<string, unknown>;
  const floorPlanInfo = (data.floorPlanInfo || {}) as Record<string, unknown>;
  const sigs = (data.leftPane?.signatures || sJson.signatures || {}) as Record<string, unknown>;

  const floorNum = Number(
    areaInfo.floorNumber ??
      sJson.floorNumber ??
      unitInfo.floor_number ??
      floorPlanInfo.floor_number ??
      1
  );

  // Tách Vùng hư hại Kiến trúc (Z) và Cấu kiện chịu lực (E)
  const leftPane = toRecord(data.leftPane);
  const { damageZones, structuralElements } = splitCondoZonesAndElements(
    Array.isArray(leftPane.damageZones) && leftPane.damageZones.length > 0
      ? leftPane.damageZones
      : sJson.damageZones ?? sJson.zones,
    Array.isArray(leftPane.structuralElements) && leftPane.structuralElements.length > 0
      ? leftPane.structuralElements
      : sJson.structuralElements,
    `Tầng ${floorNum}`
  );

  const rawOverviewPhotos = Array.isArray(areaInfo.overviewPhotos)
    ? areaInfo.overviewPhotos
    : Array.isArray(sJson.overviewPhotos)
      ? sJson.overviewPhotos
      : [];
  const overviewPhotos = rawOverviewPhotos
    .map((p) => (typeof p === 'string' ? p : String((p as Record<string, unknown>)?.url || '')))
    .filter(Boolean);

  const rawBBox = (areaInfo.boundingBox || sJson.boundingBox) as
    | { x?: number; y?: number; width?: number; height?: number }
    | undefined;

  // Ghim và bản vẽ nằm ở floors[0]; các hồ sơ cũ có thêm bản sao ở gốc JSON
  const floorRecord = (Array.isArray(sJson.floors) ? sJson.floors[0] : undefined) as Record<string, unknown> | undefined;
  const pickPins = (key: 'cadZonePins' | 'cadElementPins') => {
    const fromFloor = floorRecord?.[key];
    if (Array.isArray(fromFloor) && fromFloor.length > 0) return fromFloor as CondoAreaFormState[typeof key];
    return Array.isArray(sJson[key]) ? (sJson[key] as CondoAreaFormState[typeof key]) : [];
  };

  const burlandSummary =
    sJson.burlandSummary && typeof sJson.burlandSummary === 'object'
      ? (sJson.burlandSummary as CondoAreaFormState['burlandSummary'])
      : {
          localMaxGrade: Number(data.leftPane?.riskScoreCard?.e1_burland_score ?? 0),
          needStructuralEngineerReview: false,
          controllingDefectsCount: 0,
        };

  return recomputeCondoAreaBurlandOnChange(
    {
      unitCode: String(unitInfo.unit_code || data.unitCode || sJson.unitCode || ''),
      floorNumber: floorNum,
      areaName: String(
        areaInfo.areaName ||
          sJson.areaName ||
          unitInfo.owner_name ||
          data.ownerName ||
          ''
      ),
      areaCategory: String(areaInfo.areaCategory || sJson.areaCategory || ''),
      locationDescription: String(
        areaInfo.locationDescription || sJson.locationDescription || ''
      ),
      accessStatus: String(areaInfo.accessStatus || sJson.accessStatus || ''),
      lockedReason: String(areaInfo.lockedReason || sJson.lockedReason || ''),
      lockedPhotoUrl: String(areaInfo.lockedPhotoUrl || sJson.lockedPhotoUrl || ''),
      floorCadUrl: String(
        unitInfo.floor_cad_url ||
          floorPlanInfo.cad_photo_url ||
          areaInfo.floorCadUrl ||
          ''
      ),
      boundingBox:
        rawBBox && Number.isFinite(Number(rawBBox.x))
          ? {
              x: Number(rawBBox.x ?? 10),
              y: Number(rawBBox.y ?? 10),
              width: Number(rawBBox.width ?? 30),
              height: Number(rawBBox.height ?? 30),
            }
          : null,
      overviewPhotos,
      croppedCadUrl: String(
        areaInfo.croppedCadUrl ||
          areaInfo.cadCroppedPhotoUrl ||
          sJson.croppedCadUrl ||
          ''
      ),
      sketchCadUrl: String(floorRecord?.cadSketchPhotoUrl || sJson.cadSketchPhotoUrl || ''),
      structuralCadUrl: String(floorRecord?.cadStructuralSketchPhotoUrl || sJson.cadStructuralSketchPhotoUrl || ''),
      cadZonePins: pickPins('cadZonePins'),
      cadElementPins: pickPins('cadElementPins'),
      damageZones,
      structuralElements,
      burlandSummary,
      summaryConclusions: String(
        data.summaryConclusions || sJson.summaryConclusions || ''
      ),
      engineeringRecommendations: String(
        data.engineeringRecommendations || sJson.engineeringRecommendations || ''
      ),
      signatures: {
        surveyorName: String(sigs.surveyorName || data.surveyorName || ''),
        surveyorPhone: String(sigs.surveyorPhone || data.surveyorPhone || ''),
        surveyorSignature: String(
          sigs.surveyorSignature || data.surveyorSignatureUrl || ''
        ),
        ownerName: String(sigs.ownerName || data.ownerName || ''),
        ownerSignature: String(sigs.ownerSignature || data.ownerSignatureUrl || ''),
        workingMinutesPhotos: Array.isArray(sigs.workingMinutesPhotos)
          ? (sigs.workingMinutesPhotos as CondoAreaFormState['signatures']['workingMinutesPhotos'])
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

export function recomputeCondoAreaBurlandOnChange(
  state: CondoAreaFormState,
  _changedKey: string
): CondoAreaFormState {
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
      const g = calcBurlandGradeFromWidthFrontend(
        Number(d.widthMaxMm || 0),
        true
      );
      if (g > maxGrade) {
        maxGrade = g;
        governingCode = `${el.elementCode}/${d.defectCode}`;
      }
      hasStructCrit = true;
    }
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

export function buildCondoAreaUpdatesPayload(
  formState: CondoAreaFormState,
  dirtyFields: Record<string, { label: string; oldValue: unknown; newValue: unknown }>
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const dirtyKeys = Object.keys(dirtyFields);

  const areaInfoKeys = [
    'areaName',
    'areaCategory',
    'floorNumber',
    'locationDescription',
    'accessStatus',
    'lockedReason',
    'lockedPhotoUrl',
    'boundingBox',
    'overviewPhotos',
    'croppedCadUrl',
  ];

  if (dirtyKeys.some((k) => areaInfoKeys.includes(k))) {
    updates.areaName = formState.areaName;
    updates.floorNumber = formState.floorNumber;
    updates.areaInfo = {
      areaName: formState.areaName,
      areaCategory: formState.areaCategory,
      floorNumber: formState.floorNumber,
      locationDescription: formState.locationDescription,
      accessStatus: formState.accessStatus,
      lockedReason: formState.lockedReason,
      lockedPhotoUrl: formState.lockedPhotoUrl,
      boundingBox: formState.boundingBox,
      overviewPhotos: formState.overviewPhotos,
      croppedCadUrl: formState.croppedCadUrl,
    };
  }

  if (dirtyKeys.includes('damageZones')) {
    updates.damageZones = formState.damageZones;
    updates.burlandSummary = formState.burlandSummary;
  }

  if (dirtyKeys.includes('structuralElements')) {
    updates.structuralElements = formState.structuralElements;
    updates.burlandSummary = formState.burlandSummary;
  }

  for (const k of dirtyKeys) {
    if (!areaInfoKeys.includes(k)) {
      updates[k] = formState[k];
    }
  }

  return updates;
}

