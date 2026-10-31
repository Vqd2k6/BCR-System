import type { AuditStepwiseData } from '../../stepwise/types';
import { calcBurlandGradeFromWidthFrontend } from '../core/CondoZonesDefectsCrudEditor';
import type {
  CondoAreaFormState,
  CondoDamageZoneItemData,
  CondoDefectItemData,
  CondoStructuralElementItemData,
} from '../types/condo-audit.types';

function mapRawDefects(rawDefs: unknown, parentId: string): CondoDefectItemData[] {
  if (!Array.isArray(rawDefs)) return [];
  return rawDefs.map((item, idx) => {
    const d = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const code = String(d.defectCode || d.defect_code || `D-${String(idx + 1).padStart(2, '0')}`);
    const cuUrl = String(
      d.cuPhotoUrl ||
        d.cu_photo_url ||
        (Array.isArray(d.cuPhotos) && d.cuPhotos[0] ? d.cuPhotos[0] : '') ||
        ''
    );
    return {
      id: String(d.id || `${parentId}_${code}`),
      defectCode: code,
      defectType: String(d.defectType || d.screeningCategory || d.screening_category || 'CRACK_PLASTER_SHRINKAGE'),
      screeningCategory: String(d.screeningCategory || d.defectType || 'CRACK_PLASTER_SHRINKAGE'),
      widthMaxMm: Number(d.widthMaxMm ?? d.width_max_mm ?? 0),
      lengthMm: Number(d.lengthMm ?? d.length_mm ?? 0),
      crackDirection: String(d.crackDirection || d.crack_direction || 'DIAGONAL'),
      activityState: String(d.activityState || d.activity_state || 'STABLE'),
      hasScaleCard: Boolean(d.hasScaleCard ?? d.has_scale_card ?? true),
      isStructuralCritical: Boolean(d.isStructuralCritical ?? d.is_structural_critical ?? false),
      cuPhotoUrl: cuUrl || null,
      cuPhotos: Array.isArray(d.cuPhotos)
        ? (d.cuPhotos as string[])
        : cuUrl
          ? [cuUrl]
          : [],
      cuPhotoCode: d.cuPhotoCode ? String(d.cuPhotoCode) : undefined,
      pinX: d.pinX !== undefined && d.pinX !== null ? Number(d.pinX) : null,
      pinY: d.pinY !== undefined && d.pinY !== null ? Number(d.pinY) : null,
      isDeleted: Boolean(d.isDeleted ?? d.is_deleted ?? false),
      historyCount: Number(d.historyCount ?? 0),
      hasHistory: Boolean(d.hasHistory),
    };
  });
}

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
  const rawZonesSource = Array.isArray(data.leftPane?.damageZones) && data.leftPane.damageZones.length > 0
    ? data.leftPane.damageZones
    : Array.isArray(sJson.damageZones)
      ? sJson.damageZones
      : [];

  const damageZones: CondoDamageZoneItemData[] = [];
  const structuralElements: CondoStructuralElementItemData[] = [];

  for (let i = 0; i < rawZonesSource.length; i++) {
    const rawItem = (rawZonesSource[i] || {}) as Record<string, unknown>;
    const code = String(
      rawItem.zone_code || rawItem.zoneCode || rawItem.elementCode || `Z-${String(i + 1).padStart(2, '0')}`
    );
    const id = String(rawItem.id || `item_${i + 1}`);
    const defs = mapRawDefects(rawItem.defects, id);

    if (code.toUpperCase().startsWith('E-')) {
      structuralElements.push({
        id,
        elementCode: code,
        floorName: String(rawItem.floor_name || rawItem.floorName || `Tầng ${floorNum}`),
        roomName: String(rawItem.room_name || rawItem.roomName || 'Trục kết cấu chính'),
        elementType: String(rawItem.component_type || rawItem.elementType || 'Cột BTCT'),
        materialType: String(rawItem.wall_material || rawItem.materialType || 'BTCT'),
        dimensionsText: String(rawItem.dimensions_text || rawItem.dimensionsText || ''),
        ctxPhotoUrl: String(rawItem.ctx_photo_url || rawItem.ctxPhotoUrl || '') || null,
        ctxPhotoCode: String(rawItem.ctx_photo_code || rawItem.ctxPhotoCode || `${code}-CTX`),
        pinX: rawItem.pin_x !== undefined && rawItem.pin_x !== null ? Number(rawItem.pin_x) : null,
        pinY: rawItem.pin_y !== undefined && rawItem.pin_y !== null ? Number(rawItem.pin_y) : null,
        hasDamage: defs.length > 0 || Boolean(rawItem.functional_impact_repair_needed),
        isDeleted: Boolean(rawItem.is_deleted ?? rawItem.isDeleted ?? false),
        historyCount: Number(rawItem.historyCount ?? 0),
        hasHistory: Boolean(rawItem.hasHistory),
        defects: defs,
      });
    } else {
      damageZones.push({
        id,
        zoneCode: code,
        floorName: String(rawItem.floor_name || rawItem.floorName || `Tầng ${floorNum}`),
        roomName: String(rawItem.room_name || rawItem.roomName || 'Hành lang / Khu vực chung'),
        componentType: String(rawItem.component_type || rawItem.componentType || 'Tường'),
        wallMaterial: String(rawItem.wall_material || rawItem.wallMaterial || 'Vữa trát'),
        ctxPhotoUrl: String(rawItem.ctx_photo_url || rawItem.ctxPhotoUrl || '') || null,
        ctxPhotoCode: String(rawItem.ctx_photo_code || rawItem.ctxPhotoCode || `${code}-CTX`),
        burlandGrade: Number(rawItem.burland_grade ?? rawItem.burlandGrade ?? 0),
        functionalImpactRepairNeeded: Boolean(
          rawItem.functional_impact_repair_needed ?? rawItem.functionalImpactRepairNeeded ?? false
        ),
        pinX: rawItem.pin_x !== undefined && rawItem.pin_x !== null ? Number(rawItem.pin_x) : null,
        pinY: rawItem.pin_y !== undefined && rawItem.pin_y !== null ? Number(rawItem.pin_y) : null,
        isDeleted: Boolean(rawItem.is_deleted ?? rawItem.isDeleted ?? false),
        historyCount: Number(rawItem.historyCount ?? 0),
        hasHistory: Boolean(rawItem.hasHistory),
        defects: defs,
      });
    }
  }

  // Bổ sung từ leftPane.structuralElements hoặc sJson.structuralElements nếu có
  const extraElemsSource = Array.isArray((data.leftPane as Record<string, unknown> | undefined)?.structuralElements)
    ? ((data.leftPane as Record<string, unknown>).structuralElements as unknown[])
    : Array.isArray(sJson.structuralElements)
      ? (sJson.structuralElements as unknown[])
      : [];

  for (let j = 0; j < extraElemsSource.length; j++) {
    const elObj = (extraElemsSource[j] || {}) as Record<string, unknown>;
    const eCode = String(
      elObj.elementCode || elObj.zone_code || `E-${String(j + 1).padStart(2, '0')}`
    );
    if (!structuralElements.some((ex) => ex.elementCode === eCode)) {
      const id = String(elObj.id || `elem_${j + 1}`);
      const defs = mapRawDefects(elObj.defects, id);
      structuralElements.push({
        id,
        elementCode: eCode,
        floorName: String(elObj.floorName || elObj.floor_name || `Tầng ${floorNum}`),
        roomName: String(elObj.roomName || elObj.room_name || 'Trục kết cấu'),
        elementType: String(elObj.elementType || elObj.component_type || 'Cột BTCT'),
        materialType: String(elObj.materialType || elObj.wall_material || 'BTCT'),
        dimensionsText: String(elObj.dimensionsText || elObj.dimensions_text || ''),
        ctxPhotoUrl: String(elObj.ctxPhotoUrl || elObj.ctx_photo_url || '') || null,
        ctxPhotoCode: String(elObj.ctxPhotoCode || elObj.ctx_photo_code || `${eCode}-CTX`),
        pinX: elObj.pinX !== undefined && elObj.pinX !== null ? Number(elObj.pinX) : null,
        pinY: elObj.pinY !== undefined && elObj.pinY !== null ? Number(elObj.pinY) : null,
        hasDamage: defs.length > 0 || Boolean(elObj.hasDamage),
        isDeleted: Boolean(elObj.isDeleted ?? elObj.is_deleted ?? false),
        historyCount: Number(elObj.historyCount ?? 0),
        hasHistory: Boolean(elObj.hasHistory),
        defects: defs,
      });
    }
  }

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
      unitCode: String(unitInfo.unit_code || data.unitCode || sJson.unitCode || 'MA-01'),
      floorNumber: floorNum,
      areaName: String(
        areaInfo.areaName ||
          sJson.areaName ||
          unitInfo.owner_name ||
          data.ownerName ||
          'Khu vực dùng chung'
      ),
      areaCategory: String(areaInfo.areaCategory || sJson.areaCategory || 'CORRIDOR_LOBBY'),
      locationDescription: String(
        areaInfo.locationDescription || sJson.locationDescription || ''
      ),
      accessStatus: String(areaInfo.accessStatus || sJson.accessStatus || 'FULL'),
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

