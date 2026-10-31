import type {
  AuditStepwiseData,
  StepwiseIdentificationPhotoItem,
} from '../../stepwise/types';
import { firstNonEmptyString, toNumberOrNull, toOptionalNumber, toRecord } from '../core/condo-normalize.utils';
import type { CondoMasterFormState } from '../types/condo-audit.types';

const RISK_RATING_SUFFIX = /_RISK$/;

/** Thiếu bất kỳ thành phần nào thì không có tổng: không suy ra điểm từ số mặc định. */
function sumIfComplete(values: Array<number | undefined>): number | undefined {
  return values.every((v) => v !== undefined)
    ? values.reduce<number>((acc, v) => acc + Number(v), 0)
    : undefined;
}

function classifyEcs(totalEcs: number | undefined): string {
  if (totalEcs === undefined) return '';
  return totalEcs <= 5 ? 'GOOD' : totalEcs <= 10 ? 'MEDIUM' : totalEcs <= 16 ? 'DEFICIENT' : 'CRITICAL';
}

function classifyVi(avgVi: number | undefined): string {
  if (avgVi === undefined) return '';
  return avgVi > 3.25 ? 'VERY_HIGH' : avgVi > 2.5 ? 'HIGH' : avgVi > 1.5 ? 'MEDIUM' : 'LOW';
}

function toPhotoObj(
  raw: unknown,
  defaultCode: string
): StepwiseIdentificationPhotoItem {
  if (!raw) return { url: '', photoCode: defaultCode };
  if (typeof raw === 'string') return { url: raw, photoCode: defaultCode };
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return {
      ...obj,
      url: String(obj.url || obj.photoUrl || obj.annotatedUrl || obj.rawUrl || ''),
      photoCode: String(obj.photoCode || defaultCode),
    };
  }
  return { url: '', photoCode: defaultCode };
}

export function normalizeCondoMasterData(
  data: AuditStepwiseData
): CondoMasterFormState {
  const sJson = (data.surveyJson ||
    data.survey_data_json ||
    data.leftPane?.surveyJson ||
    {}) as Record<string, unknown>;
  const specs = (data.buildingSpecs ||
    data.leftPane?.buildingSpecs ||
    sJson.buildingSpecs ||
    {}) as Record<string, unknown>;
  const deform = (data.deformation ||
    data.leftPane?.deformation ||
    {}) as Record<string, unknown>;
  // JSON giữ đủ mức và diễn giải; hàng SQL chỉ có cờ true/false nên chỉ dùng khi hồ sơ chưa có JSON phỏng vấn
  const interview = (sJson.historyInterview ||
    data.historyInterview ||
    data.leftPane?.interview ||
    {}) as Record<string, unknown>;
  const idPhotos = (data.identificationPhotos ||
    data.rightPane?.identificationPhotos ||
    sJson.identificationPhotos ||
    {}) as Record<string, unknown>;
  const sigs = (data.leftPane?.signatures ||
    sJson.signatures ||
    {}) as Record<string, unknown>;
  const riskCard = (data.leftPane?.riskScoreCard || {}) as Record<string, unknown>;

  const rawCatEnum = String(
    specs.foundationCategory || specs.foundation_category || ''
  );
  const catMatch = rawCatEnum.match(/^CAT_([1-5])/);
  const parsedCatScore = toNumberOrNull(sJson.foundationCatScore) ?? (catMatch ? Number(catMatch[1]) : null);

  const rawAsBuilt = Array.isArray(sJson.asBuiltDrawingPhotos)
    ? sJson.asBuiltDrawingPhotos
    : Array.isArray((specs as Record<string, unknown>).as_built_drawing_photos_json)
      ? ((specs as Record<string, unknown>).as_built_drawing_photos_json as unknown[])
      : [];

  const asBuiltDrawingPhotos = rawAsBuilt
    .map((item, idx) => {
      if (typeof item === 'string') {
        return { url: item, photoCode: `AS-BUILT-0${idx + 1}` };
      }
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        return {
          url: String(o.url || o.photoUrl || ''),
          photoCode: String(o.photoCode || `AS-BUILT-0${idx + 1}`),
          notes: o.notes ? String(o.notes) : undefined,
        };
      }
      return { url: '' };
    })
    .filter((p) => Boolean(p.url));

  const rawSettlementTilt =
    sJson.settlementTilt && typeof sJson.settlementTilt === 'object'
      ? (sJson.settlementTilt as Record<string, unknown>)
      : {};

  const rawDiffSettlement = toRecord(rawSettlementTilt.diffSettlement);
  const rawBuildingTilt = toRecord(rawSettlementTilt.buildingTilt);
  const rawMonitoring = toRecord(rawSettlementTilt.needAdditionalMonitoring);

  const ecsJson =
    sJson.ecs && typeof sJson.ecs === 'object'
      ? (sJson.ecs as Record<string, unknown>)
      : {};
  const viJson =
    sJson.vi && typeof sJson.vi === 'object'
      ? (sJson.vi as Record<string, unknown>)
      : {};
  const execJson =
    sJson.executiveSummary && typeof sJson.executiveSummary === 'object'
      ? (sJson.executiveSummary as Record<string, unknown>)
      : {};

  const e1 = toOptionalNumber(ecsJson.e1 ?? riskCard.e1_burland_score);
  const e2 = toOptionalNumber(ecsJson.e2 ?? riskCard.e2_structure_score);
  const e3 = toOptionalNumber(ecsJson.e3 ?? riskCard.e3_deformation_score);
  const e4 = toOptionalNumber(ecsJson.e4 ?? riskCard.e4_material_score);
  const e5 = toOptionalNumber(ecsJson.e5 ?? riskCard.e5_history_score);
  const e6 = toOptionalNumber(ecsJson.e6 ?? riskCard.e6_overall_function_score);
  const totalEcs =
    toOptionalNumber(ecsJson.totalEcs ?? riskCard.total_ecs_score) ?? sumIfComplete([e1, e2, e3, e4, e5, e6]);
  const ecsClass = firstNonEmptyString(ecsJson.ecsClass, riskCard.ecs_class) || classifyEcs(totalEcs);

  const v1 = toOptionalNumber(viJson.v1 ?? riskCard.v1_importance_score);
  const v2 = toOptionalNumber(viJson.v2 ?? riskCard.v2_structure_score);
  const v3 = toOptionalNumber(viJson.v3 ?? riskCard.v3_foundation_score ?? parsedCatScore);
  const v4 = toOptionalNumber(viJson.v4 ?? riskCard.v4_age_score);
  const v5 = toOptionalNumber(viJson.v5 ?? riskCard.v5_ecs_score);
  const v6 = toOptionalNumber(viJson.v6 ?? riskCard.v6_sensitivity_score);
  const totalVi = sumIfComplete([v1, v2, v3, v4, v5, v6]);
  const avgVi =
    toOptionalNumber(viJson.avgVi ?? viJson.viAvg ?? riskCard.avg_vi_score) ??
    (totalVi !== undefined ? Number((totalVi / 6).toFixed(2)) : undefined);
  const viClass = firstNonEmptyString(viJson.viClass, riskCard.vi_class) || classifyVi(avgVi);

  return {
    projectParcelCode: String(
      data.projectParcelCode || sJson.projectParcelCode || ''
    ),
    officialCadastralCode: String(
      data.officialCadastralCode || sJson.officialCadastralCode || ''
    ),
    buildingName: String(
      data.buildingName ||
        sJson.buildingName ||
        data.ownerName ||
        sJson.ownerName ||
        data.houseNumber ||
        ''
    ),
    houseNumber: String(data.houseNumber || sJson.houseNumber || ''),
    street: String(data.street || sJson.street || ''),
    standardizedAddress: typeof sJson.standardizedAddress === 'string' ? sJson.standardizedAddress : '',
    keepKsvBoundaryConfirmed: sJson.keepKsvBoundaryConfirmed === true,
    keepKsvBoundaryReason: typeof sJson.keepKsvBoundaryReason === 'string' ? sJson.keepKsvBoundaryReason : '',
    ward: String(data.ward || sJson.ward || ''),
    district: String(data.district || sJson.district || ''),
    managementBoardName: String(
      sJson.managementBoardName || data.ownerName || sJson.ownerName || ''
    ),
    managementContactName: String(sJson.managementContactName || ''),
    managementContactPhone: String(
      sJson.managementContactPhone || data.ownerPhone || sJson.ownerPhone || ''
    ),
    accessLimitation:
      sJson.accessLimitation && typeof sJson.accessLimitation === 'object'
        ? (sJson.accessLimitation as CondoMasterFormState['accessLimitation'])
        : { notes: '' },
    adjacentBuildings:
      sJson.adjacentBuildings && typeof sJson.adjacentBuildings === 'object'
        ? (sJson.adjacentBuildings as CondoMasterFormState['adjacentBuildings'])
        : {},
    identificationPhotos: idPhotos,
    photoP01: toPhotoObj(idPhotos.photoP01 || sJson.photoP01, 'P-01'),
    photoP02: toPhotoObj(idPhotos.photoP02 || sJson.photoP02, 'P-02'),
    photoP03: toPhotoObj(idPhotos.photoP03 || sJson.photoP03, 'P-03'),
    photoP04: toPhotoObj(idPhotos.photoP04 || sJson.photoP04, 'P-04'),
    aboveFloors: toNumberOrNull(sJson.aboveFloors ?? specs.floorCount ?? specs.floor_count),
    undergroundFloors: toNumberOrNull(
      sJson.undergroundFloors ?? specs.basementCount ?? specs.basement_count
    ),
    podiumFloors: toNumberOrNull(sJson.podiumFloors),
    totalUnits: toNumberOrNull(sJson.totalUnits ?? data.parentBuildingInfo?.totalUnits),
    constructionYear: String(
      sJson.constructionYear ??
        specs.yearOfConstruction ??
        specs.year_of_construction ??
        ''
    ),
    isEstimatedYear: Boolean(
      sJson.isEstimatedYear ??
        specs.isYearEstimated ??
        specs.is_year_estimated ??
        false
    ),
    constructionAreaM2: String(
      data.constructionAreaM2 ??
        sJson.constructionAreaM2 ??
        specs.constructionAreaM2 ??
        specs.construction_area_m2 ??
        ''
    ),
    landAreaM2: String(
      data.landAreaM2 ?? sJson.landAreaM2 ?? specs.landAreaM2 ?? ''
    ),
    buildingHeightM: String(
      sJson.buildingHeightM ??
        specs.buildingHeightM ??
        specs.building_height_m ??
        ''
    ),
    objectGroup: String(
      sJson.objectGroup ??
        specs.buildingGrade ??
        specs.building_grade ??
        ''
    ),
    usageFunction: String(
      sJson.usageFunction ??
        specs.landUseFunction ??
        specs.land_use_function ??
        ''
    ),
    structureSystem: String(
      sJson.structureSystem ??
        specs.structuralSystem ??
        specs.structural_system ??
        ''
    ),
    foundationType: String(
      sJson.foundationType ??
        specs.foundationCategory ??
        specs.foundation_category ??
        ''
    ),
    foundationCatScore: parsedCatScore,
    foundationDepthM: String(
      sJson.foundationDepthM ??
        specs.foundationDepthM ??
        specs.foundation_depth_m ??
        ''
    ),
    foundationSpacingM: String(
      sJson.foundationSpacingM ??
        specs.foundationSpacingM ??
        specs.foundation_spacing_m ??
        ''
    ),
    pileDimensionMm: String(sJson.pileDimensionMm ?? sJson.pileDimensions ?? ''),
    foundationNotes: String(
      sJson.foundationNotes ??
        specs.foundationNotes ??
        specs.foundation_notes ??
        ''
    ),
    asBuiltDrawingPhotos,
    historyInterview: {
      ...interview,
      renovationLoad: toOptionalNumber(interview.renovationLoad ?? interview.renovation_load_score),
      renovationNotes: String(interview.renovationNotes ?? interview.renovation_details ?? ''),
      majorRepair: toOptionalNumber(interview.majorRepair ?? interview.major_repair_score),
      repairNotes: String(interview.repairNotes ?? interview.major_repair_notes ?? ''),
      pastSettlement: toOptionalNumber(interview.pastSettlement ?? interview.past_settlement_score),
      settlementNotes: String(interview.settlementNotes ?? interview.past_settlement_notes ?? ''),
      neighborDamage: toOptionalNumber(interview.neighborDamage ?? interview.neighbor_damage_score),
      neighborNotes: String(interview.neighborNotes ?? interview.neighbor_damage_notes ?? ''),
      fireFloodIncident: toOptionalNumber(interview.fireFloodIncident ?? interview.fire_flood_score),
      fireFloodNotes: String(interview.fireFloodNotes ?? interview.fire_flood_notes ?? ''),
    },
    settlementTilt: {
      ...rawSettlementTilt,
      diffSettlement: {
        ...rawDiffSettlement,
        level: toOptionalNumber(rawDiffSettlement.level ?? deform.diff_settlement_level),
        position: firstNonEmptyString(rawDiffSettlement.position, deform.diff_settlement_position),
        notes: firstNonEmptyString(rawDiffSettlement.notes, deform.diff_settlement_notes),
      },
      buildingTilt: {
        ...rawBuildingTilt,
        level: toOptionalNumber(rawBuildingTilt.level ?? deform.building_tilt_level),
        xPermille: toOptionalNumber(rawBuildingTilt.xPermille ?? deform.tilt_angle_x ?? deform.tilt_x_permille),
        yPermille: toOptionalNumber(rawBuildingTilt.yPermille ?? deform.tilt_angle_y ?? deform.tilt_y_permille),
        direction: firstNonEmptyString(rawBuildingTilt.direction, deform.tilt_direction),
        notes: firstNonEmptyString(rawBuildingTilt.notes, deform.tilt_notes),
      },
      needAdditionalMonitoring: {
        ...rawMonitoring,
        required: Boolean(rawMonitoring.required ?? deform.need_additional_monitoring ?? false),
        notes: firstNonEmptyString(rawMonitoring.notes, deform.monitoring_notes),
      },
    },
    surveyScope:
      sJson.surveyScope && typeof sJson.surveyScope === 'object'
        ? (sJson.surveyScope as Record<string, unknown>)
        : {},
    gisMutationConfirmed:
      sJson.gisMutationConfirmed && typeof sJson.gisMutationConfirmed === 'object'
        ? (sJson.gisMutationConfirmed as CondoMasterFormState['gisMutationConfirmed'])
        : { isMutated: false, type: 'NONE', notes: '' },
    metroOffsetDistance: String(
      data.metroOffsetDistance ?? sJson.metroOffsetDistance ?? ''
    ),
    clearanceOffsetDistance: String(
      data.clearanceOffsetDistance ?? sJson.clearanceOffsetDistance ?? ''
    ),
    parcelCoordinates: Array.isArray(sJson.parcelCoordinates)
      ? (sJson.parcelCoordinates as [number, number][])
      : Array.isArray(data.parcelCoordinates)
        ? data.parcelCoordinates
        : [],
    gpsCoords:
      sJson.gpsCoords && typeof sJson.gpsCoords === 'object'
        ? (sJson.gpsCoords as { lat?: number; lng?: number; accuracy?: number })
        : {},
    ecs: {
      e1,
      e2,
      e3,
      e4,
      e5,
      e6,
      totalEcs,
      ecsClass,
    },
    vi: {
      v1,
      v2,
      v3,
      v4,
      v5,
      v6,
      totalVi,
      avgVi,
      viClass,
    },
    executiveSummary: {
      ...execJson,
      braStatus: firstNonEmptyString(
        execJson.braStatus,
        data.braStatus,
        riskCard.building_risk_assessment_bra
      )
        .toUpperCase()
        .replace(RISK_RATING_SUFFIX, ''),
      constructionImpactStatus: firstNonEmptyString(
        execJson.constructionImpactStatus,
        riskCard.construction_impact_level_i ? `I${riskCard.construction_impact_level_i}` : ''
      ),
      summaryConclusions: String(
        execJson.summaryConclusions ||
          data.summaryConclusions ||
          sJson.summaryConclusions ||
          ''
      ),
      recommendations: String(
        execJson.recommendations ||
          data.engineeringRecommendations ||
          sJson.engineeringRecommendations ||
          ''
      ),
      specificRecommendationsText: firstNonEmptyString(
        execJson.specificRecommendationsText,
        data.engineeringRecommendations,
        sJson.engineeringRecommendations
      ),
    },
    summaryConclusions: String(
      data.summaryConclusions ||
        sJson.summaryConclusions ||
        execJson.summaryConclusions ||
        ''
    ),
    engineeringRecommendations: String(
      data.engineeringRecommendations ||
        sJson.engineeringRecommendations ||
        execJson.recommendations ||
        ''
    ),
    signatures: {
      surveyorName: String(sigs.surveyorName || data.surveyorName || ''),
      surveyorPhone: String(sigs.surveyorPhone || data.surveyorPhone || ''),
      surveyorSignature: String(
        sigs.surveyorSignature || data.surveyorSignatureUrl || ''
      ),
      ownerName: String(
        sigs.ownerName || sJson.managementContactName || data.ownerName || ''
      ),
      ownerSignature: String(
        sigs.ownerSignature || data.ownerSignatureUrl || ''
      ),
      ownerFeedback: String(sigs.ownerFeedback || data.ownerRemarks || ''),
      workingMinutesPhotos: Array.isArray(sigs.workingMinutesPhotos)
        ? (sigs.workingMinutesPhotos as CondoMasterFormState['signatures']['workingMinutesPhotos'])
        : [],
    },
    photoRotations:
      sJson.photoRotations && typeof sJson.photoRotations === 'object'
        ? (sJson.photoRotations as Record<string, number>)
        : {},
  };
}

export function recomputeCondoMasterScoresOnChange(
  state: CondoMasterFormState,
  changedKey: string
): CondoMasterFormState {
  // Tự động tính lại tổng ECS, VI, Impact & BRA khi thông số đầu vào hoặc điểm thành phần thay đổi
  const next = { ...state };
  const curEcs = { ...next.ecs };
  const curVi = { ...next.vi };

  if (changedKey === 'foundationCatScore') {
    curVi.v3 =
      next.foundationCatScore !== null
        ? Math.min(4, Math.max(1, Number(next.foundationCatScore)))
        : undefined;
  }

  if (changedKey.startsWith('settlementTilt.')) {
    const levels = [
      toOptionalNumber(next.settlementTilt.diffSettlement?.level),
      toOptionalNumber(next.settlementTilt.buildingTilt?.level),
    ].filter((lv): lv is number => lv !== undefined);
    curEcs.e3 = levels.length > 0 ? Math.max(...levels) : undefined;
  }

  if (changedKey.startsWith('historyInterview.')) {
    const h = next.historyInterview;
    const levels = [h.renovationLoad, h.majorRepair, h.pastSettlement, h.fireFloodIncident].filter(
      (lv): lv is number => typeof lv === 'number'
    );
    curEcs.e5 = levels.length > 0 ? Math.min(4, Math.max(...levels)) : undefined;
  }

  const totalEcs = sumIfComplete([curEcs.e1, curEcs.e2, curEcs.e3, curEcs.e4, curEcs.e5, curEcs.e6]);
  const ecsClass = classifyEcs(totalEcs);
  curEcs.totalEcs = totalEcs;
  curEcs.ecsClass = ecsClass;

  if (!changedKey.startsWith('vi.v5') && ecsClass) {
    curVi.v5 = ecsClass === 'CRITICAL' ? 4 : ecsClass === 'DEFICIENT' ? 3 : ecsClass === 'MEDIUM' ? 2 : 1;
  }

  const totalVi = sumIfComplete([curVi.v1, curVi.v2, curVi.v3, curVi.v4, curVi.v5, curVi.v6]);
  const avgVi = totalVi !== undefined ? Number((totalVi / 6).toFixed(2)) : undefined;

  curVi.totalVi = totalVi;
  curVi.avgVi = avgVi;
  curVi.viClass = classifyVi(avgVi);

  next.ecs = curEcs;
  next.vi = curVi;
  return next;
}
