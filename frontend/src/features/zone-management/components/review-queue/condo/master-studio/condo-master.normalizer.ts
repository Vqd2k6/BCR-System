import type {
  AuditStepwiseData,
  StepwiseIdentificationPhotoItem,
} from '../../stepwise/types';
import type { CondoMasterFormState } from '../types/condo-audit.types';

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
  const interview = (data.historyInterview ||
    data.leftPane?.interview ||
    sJson.historyInterview ||
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
  const parsedCatScore =
    Number(sJson.foundationCatScore) ||
    (rawCatEnum.startsWith('CAT_1')
      ? 1
      : rawCatEnum.startsWith('CAT_2')
        ? 2
        : rawCatEnum.startsWith('CAT_3')
          ? 3
          : rawCatEnum.startsWith('CAT_4')
            ? 4
            : 5);

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

  const e1 = Number(ecsJson.e1 ?? riskCard.e1_burland_score ?? 0);
  const e2 = Number(ecsJson.e2 ?? riskCard.e2_structural_score ?? 0);
  const e3 = Number(ecsJson.e3 ?? riskCard.e3_deformation_score ?? 0);
  const e4 = Number(ecsJson.e4 ?? riskCard.e4_material_degradation_score ?? 0);
  const e5 = Number(ecsJson.e5 ?? riskCard.e5_historical_sensitivity_score ?? 0);
  const e6 = Number(ecsJson.e6 ?? riskCard.e6_functional_impact_score ?? 0);
  const totalEcs = Number(
    ecsJson.totalEcs ?? riskCard.total_ecs ?? e1 + e2 + e3 + e4 + e5 + e6
  );
  const ecsClass = String(
    ecsJson.ecsClass ??
      riskCard.ecs_class ??
      (totalEcs <= 5
        ? 'GOOD'
        : totalEcs <= 10
          ? 'MEDIUM'
          : totalEcs <= 16
            ? 'DEFICIENT'
            : 'CRITICAL')
  );

  const v1 = Number(viJson.v1 ?? riskCard.v1_importance_score ?? 3);
  const v2 = Number(viJson.v2 ?? riskCard.v2_structure_type_score ?? 2);
  const v3 = Number(viJson.v3 ?? riskCard.v3_foundation_score ?? parsedCatScore);
  const v4 = Number(viJson.v4 ?? riskCard.v4_age_height_score ?? 3);
  const v5 = Number(viJson.v5 ?? riskCard.v5_existing_condition_score ?? 2);
  const v6 = Number(viJson.v6 ?? riskCard.v6_historical_modification_score ?? 1);
  const totalVi = v1 + v2 + v3 + v4 + v5 + v6;
  const avgVi = Number(
    viJson.avgVi ?? riskCard.avg_vi ?? Number((totalVi / 6).toFixed(2))
  );
  const viClass = String(
    viJson.viClass ??
      riskCard.vi_class ??
      (avgVi > 3.25
        ? 'VERY_HIGH'
        : avgVi > 2.5
          ? 'HIGH'
          : avgVi > 1.5
            ? 'MEDIUM'
            : 'LOW')
  );

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
        : { type: 'FULL_100', isRestricted: false, notes: '' },
    identificationPhotos: idPhotos,
    photoP01: toPhotoObj(idPhotos.photoP01 || sJson.photoP01, 'P-01'),
    photoP02: toPhotoObj(idPhotos.photoP02 || sJson.photoP02, 'P-02'),
    photoP03: toPhotoObj(idPhotos.photoP03 || sJson.photoP03, 'P-03'),
    photoP04: toPhotoObj(idPhotos.photoP04 || sJson.photoP04, 'P-04'),
    aboveFloors: Number(
      sJson.aboveFloors ?? specs.floorCount ?? specs.floor_count ?? 15
    ),
    undergroundFloors: Number(
      sJson.undergroundFloors ?? specs.basementCount ?? specs.basement_count ?? 1
    ),
    podiumFloors: Number(sJson.podiumFloors ?? 2),
    totalUnits: Number(
      sJson.totalUnits ?? data.parentBuildingInfo?.totalUnits ?? 100
    ),
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
        'IMPORTANT'
    ),
    usageFunction: String(
      sJson.usageFunction ??
        specs.landUseFunction ??
        specs.land_use_function ??
        'RESIDENTIAL_CONDO'
    ),
    structureSystem: String(
      sJson.structureSystem ??
        specs.structuralSystem ??
        specs.structural_system ??
        'RC_FRAME_SHEAR_WALL'
    ),
    foundationType: String(
      sJson.foundationType ??
        specs.foundationCategory ??
        specs.foundation_category ??
        'BORED_PILE'
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
      renovationLoad: Number(
        interview.renovationLoad ?? interview.renovation_load_score ?? 0
      ),
      renovationNotes: String(
        interview.renovationNotes ?? interview.renovation_details ?? ''
      ),
      majorRepair: Number(
        interview.majorRepair ?? interview.major_repair_score ?? 0
      ),
      repairNotes: String(
        interview.repairNotes ?? interview.major_repair_notes ?? ''
      ),
      pastSettlement: Number(
        interview.pastSettlement ?? interview.past_settlement_score ?? 0
      ),
      settlementNotes: String(
        interview.settlementNotes ?? interview.past_settlement_notes ?? ''
      ),
      neighborDamage: Number(
        interview.neighborDamage ?? interview.neighbor_damage_score ?? 0
      ),
      neighborNotes: String(
        interview.neighborNotes ?? interview.neighbor_damage_notes ?? ''
      ),
      fireFloodIncident: Number(
        interview.fireFloodIncident ?? interview.fire_flood_score ?? 0
      ),
      fireFloodNotes: String(
        interview.fireFloodNotes ?? interview.fire_flood_notes ?? ''
      ),
    },
    settlementTilt: {
      diffSettlement: {
        level: Number(
          (rawSettlementTilt.diffSettlement as Record<string, unknown> | undefined)
            ?.level ??
            deform.diff_settlement_level ??
            0
        ),
        position: String(
          (rawSettlementTilt.diffSettlement as Record<string, unknown> | undefined)
            ?.position ??
            deform.diff_settlement_position ??
            ''
        ),
        notes: String(
          (rawSettlementTilt.diffSettlement as Record<string, unknown> | undefined)
            ?.notes ??
            deform.diff_settlement_notes ??
            ''
        ),
      },
      buildingTilt: {
        level: Number(
          (rawSettlementTilt.buildingTilt as Record<string, unknown> | undefined)
            ?.level ??
            deform.building_tilt_level ??
            0
        ),
        xPermille: Number(
          (rawSettlementTilt.buildingTilt as Record<string, unknown> | undefined)
            ?.xPermille ??
            deform.tilt_x_permille ??
            0
        ),
        yPermille: Number(
          (rawSettlementTilt.buildingTilt as Record<string, unknown> | undefined)
            ?.yPermille ??
            deform.tilt_y_permille ??
            0
        ),
        direction: String(
          (rawSettlementTilt.buildingTilt as Record<string, unknown> | undefined)
            ?.direction ??
            deform.tilt_direction ??
            ''
        ),
        notes: String(
          (rawSettlementTilt.buildingTilt as Record<string, unknown> | undefined)
            ?.notes ??
            deform.tilt_notes ??
            ''
        ),
      },
      needAdditionalMonitoring: {
        required: Boolean(
          (
            rawSettlementTilt.needAdditionalMonitoring as
              | Record<string, unknown>
              | undefined
          )?.required ??
            deform.need_additional_monitoring ??
            false
        ),
        notes: String(
          (
            rawSettlementTilt.needAdditionalMonitoring as
              | Record<string, unknown>
              | undefined
          )?.notes ??
            deform.monitoring_notes ??
            ''
        ),
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
      braStatus: String(
        execJson.braStatus || data.braStatus || riskCard.bra_rating || 'MEDIUM'
      ),
      constructionImpactStatus: String(
        execJson.constructionImpactStatus ||
          (riskCard.impact_level_i ? `I${riskCard.impact_level_i}` : 'I2')
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
    curVi.v3 = Math.min(4, Math.max(1, Number(next.foundationCatScore || 3)));
  }

  if (changedKey.startsWith('settlementTilt.')) {
    const diffLv = Number(next.settlementTilt.diffSettlement?.level ?? 0);
    const tiltLv = Number(next.settlementTilt.buildingTilt?.level ?? 0);
    curEcs.e3 = Math.max(diffLv, tiltLv);
  }

  if (changedKey.startsWith('historyInterview.')) {
    const h = next.historyInterview;
    curEcs.e5 = Math.min(
      4,
      Math.max(
        Number(h.renovationLoad || 0),
        Number(h.majorRepair || 0),
        Number(h.pastSettlement || 0),
        Number(h.fireFloodIncident || 0)
      )
    );
  }

  const totalEcs =
    Number(curEcs.e1 || 0) +
    Number(curEcs.e2 || 0) +
    Number(curEcs.e3 || 0) +
    Number(curEcs.e4 || 0) +
    Number(curEcs.e5 || 0) +
    Number(curEcs.e6 || 0);
  const ecsClass =
    totalEcs <= 5
      ? 'GOOD'
      : totalEcs <= 10
        ? 'MEDIUM'
        : totalEcs <= 16
          ? 'DEFICIENT'
          : 'CRITICAL';
  curEcs.totalEcs = totalEcs;
  curEcs.ecsClass = ecsClass;

  if (!changedKey.startsWith('vi.v5')) {
    curVi.v5 =
      ecsClass === 'CRITICAL'
        ? 4
        : ecsClass === 'DEFICIENT'
          ? 3
          : ecsClass === 'MEDIUM'
            ? 2
            : 1;
  }

  const totalVi =
    Number(curVi.v1 || 3) +
    Number(curVi.v2 || 2) +
    Number(curVi.v3 || 3) +
    Number(curVi.v4 || 3) +
    Number(curVi.v5 || 2) +
    Number(curVi.v6 || 1);
  const avgVi = Number((totalVi / 6).toFixed(2));
  const viClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' =
    avgVi > 3.25
      ? 'VERY_HIGH'
      : avgVi > 2.5
        ? 'HIGH'
        : avgVi > 1.5
          ? 'MEDIUM'
          : 'LOW';

  curVi.totalVi = totalVi;
  curVi.avgVi = avgVi;
  curVi.viClass = viClass;

  next.ecs = curEcs;
  next.vi = curVi;
  return next;
}
