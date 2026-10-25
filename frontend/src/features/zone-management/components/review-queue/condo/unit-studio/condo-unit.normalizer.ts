import type {
  AuditStepwiseData,
  StepwiseAbsenceLogItem,
  StepwiseIdentificationPhotoItem,
} from '../../stepwise/types';
import { calcBurlandGradeFromWidthFrontend } from '../core/CondoZonesDefectsCrudEditor';
import type {
  CondoDamageZoneItemData,
  CondoDefectItemData,
  CondoUnitFormState,
} from '../types/condo-audit.types';

function mapRawUnitDefects(rawDefs: unknown, parentId: string): CondoDefectItemData[] {
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
      defectType: String(
        d.defectType || d.screeningCategory || d.screening_category || 'CRACK_PLASTER_SHRINKAGE'
      ),
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
  const unitInfo = (data.unitInfo || {}) as Record<string, unknown>;
  const sigs = (data.leftPane?.signatures || sJson.signatures || {}) as Record<string, unknown>;
  const idPhotos = (data.identificationPhotos ||
    data.rightPane?.identificationPhotos ||
    sJson.identificationPhotos ||
    {}) as Record<string, unknown>;

  const floorNum = Number(
    unitInfo.floor_number ??
      sJson.floorNumber ??
      sJson.floor_number ??
      1
  );

  // Vùng hư hại Kiến trúc căn hộ (Z)
  const rawZonesSource = Array.isArray(data.leftPane?.damageZones) && data.leftPane.damageZones.length > 0
    ? data.leftPane.damageZones
    : Array.isArray(sJson.damageZones)
      ? sJson.damageZones
      : [];

  const damageZones: CondoDamageZoneItemData[] = rawZonesSource.map((raw, idx) => {
    const rawItem = (raw || {}) as Record<string, unknown>;
    const code = String(
      rawItem.zone_code || rawItem.zoneCode || `Z-${String(idx + 1).padStart(2, '0')}`
    );
    const id = String(rawItem.id || `unit_zone_${idx + 1}`);
    const defs = mapRawUnitDefects(rawItem.defects, id);
    return {
      id,
      zoneCode: code,
      floorName: String(rawItem.floor_name || rawItem.floorName || `Tầng ${floorNum}`),
      roomName: String(rawItem.room_name || rawItem.roomName || 'Phòng khách'),
      componentType: String(rawItem.component_type || rawItem.componentType || 'Tường'),
      wallMaterial: String(rawItem.wall_material || rawItem.wallMaterial || 'Gạch xây tô vữa'),
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
    };
  });

  const rawDoorJamming =
    sJson.doorJamming && typeof sJson.doorJamming === 'object'
      ? (sJson.doorJamming as Record<string, unknown>)
      : {};
  const rawWaterLeakage =
    sJson.waterLeakageFromUpperFloor && typeof sJson.waterLeakageFromUpperFloor === 'object'
      ? (sJson.waterLeakageFromUpperFloor as Record<string, unknown>)
      : {};
  const rawBeamSagging =
    sJson.beamSagging && typeof sJson.beamSagging === 'object'
      ? (sJson.beamSagging as Record<string, unknown>)
      : data.leftPane?.beamSagging && typeof data.leftPane.beamSagging === 'object'
        ? (data.leftPane.beamSagging as Record<string, unknown>)
        : {};

  const rawAbsenceLogs = Array.isArray(sJson.absenceLogs)
    ? (sJson.absenceLogs as StepwiseAbsenceLogItem[])
    : Array.isArray(data.leftPane?.absenceLogs)
      ? data.leftPane.absenceLogs
      : [];

  const rawNoticePhotos = Array.isArray(sJson.absenteeNoticePhotos)
    ? (sJson.absenteeNoticePhotos as string[])
    : [];

  const burlandSummary =
    sJson.burlandSummary && typeof sJson.burlandSummary === 'object'
      ? (sJson.burlandSummary as CondoUnitFormState['burlandSummary'])
      : {
          localMaxGrade: Number(data.leftPane?.riskScoreCard?.e1_burland_score ?? 0),
          needStructuralEngineerReview: false,
          controllingDefectsCount: 0,
        };

  return recomputeCondoUnitBurlandOnChange(
    {
      unitCode: String(unitInfo.unit_code || data.unitCode || sJson.unitCode || 'A-101'),
      floorNumber: floorNum,
      ownerName: String(unitInfo.owner_name || data.ownerName || sJson.ownerName || ''),
      ownerPhone: String(unitInfo.owner_phone || data.ownerPhone || sJson.ownerPhone || ''),
      residentRole: String(sJson.residentRole || sJson.occupancyRole || 'OWNER'),
      occupancyStatus: String(
        unitInfo.occupancy_status || sJson.occupancyStatus || 'OCCUPIED_OWNER'
      ),
      isRefusedOrAbsent: Boolean(
        sJson.isRefusedOrAbsent ??
          data.leftPane?.isRefusedOrAbsent ??
          (data.status === 'POSTPONED_ABSENT' ||
            data.status === 'POSTPONED_ABSENT_VERIFIED')
      ),
      absenceReason: String(sJson.absenceReason || data.leftPane?.absenceReason || ''),
      absenceLogs: rawAbsenceLogs,
      absenteeNoticePhotos: rawNoticePhotos,
      doorJamming: {
        hasJamming: Boolean(rawDoorJamming.hasJamming ?? false),
        locations: String(rawDoorJamming.locations || ''),
        severity: String(rawDoorJamming.severity || 'MINOR'),
        photoUrl: String(rawDoorJamming.photoUrl || ''),
        notes: String(rawDoorJamming.notes || ''),
      },
      waterLeakageFromUpperFloor: {
        hasLeakage: Boolean(rawWaterLeakage.hasLeakage ?? false),
        sourceLocation: String(rawWaterLeakage.sourceLocation || ''),
        suspectedUpperUnitCode: String(rawWaterLeakage.suspectedUpperUnitCode || ''),
        photoUrl: String(rawWaterLeakage.photoUrl || ''),
        notes: String(rawWaterLeakage.notes || ''),
      },
      beamSagging: {
        hasSagging: Boolean(rawBeamSagging.hasSagging ?? Number(rawBeamSagging.level ?? 0) > 0),
        level: Number(rawBeamSagging.level ?? 0),
        sagMm: (rawBeamSagging.sagMm as string | number) ?? 0,
        position: String(rawBeamSagging.position || ''),
        photoUrl: String(rawBeamSagging.photoUrl || ''),
        notes: String(rawBeamSagging.notes || ''),
      },
      photoP01: toUnitPhotoObj(
        idPhotos.photoP01 || idPhotos.p01 || sJson.photoP01,
        'P-01'
      ),
      photoP04: toUnitPhotoObj(
        idPhotos.photoP04 || idPhotos.p04 || sJson.photoP04,
        'P-04'
      ),
      roomLayoutUrl: String(
        sJson.roomLayoutUrl ||
          sJson.unitLayoutSketchUrl ||
          unitInfo.floor_cad_url ||
          ''
      ),
      roomLayoutNotes: String(sJson.roomLayoutNotes || ''),
      damageZones,
      burlandSummary,
      summaryConclusions: String(data.summaryConclusions || sJson.summaryConclusions || ''),
      engineeringRecommendations: String(
        data.engineeringRecommendations || sJson.engineeringRecommendations || ''
      ),
      ownerFeedback: String(sJson.ownerFeedback || data.leftPane?.ownerFeedback || ''),
      signatures: {
        surveyorName: String(sigs.surveyorName || data.surveyorName || ''),
        surveyorPhone: String(sigs.surveyorPhone || data.surveyorPhone || ''),
        surveyorSignature: String(sigs.surveyorSignature || data.surveyorSignatureUrl || ''),
        ownerName: String(sigs.ownerName || unitInfo.owner_name || data.ownerName || ''),
        ownerSignature: String(sigs.ownerSignature || data.ownerSignatureUrl || ''),
        workingMinutesPhotos: Array.isArray(sigs.workingMinutesPhotos)
          ? (sigs.workingMinutesPhotos as CondoUnitFormState['signatures']['workingMinutesPhotos'])
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

  if (dirtyKeys.includes('damageZones') || dirtyKeys.some((k) => k.startsWith('beamSagging'))) {
    updates.burlandSummary = formState.burlandSummary;
  }

  return updates;
}
