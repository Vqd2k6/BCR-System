import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateComprehensiveMetroSpatialMetrics } from '../../../../../survey-phase1/utils/metroSpatialCalculator';
import { calculateEcsScore } from '../../../../../survey-phase1/engine/ecsCalculator';
import { calculateViScore } from '../../../../../survey-phase1/engine/viCalculator';
import { calculateConstructionImpact, calculateBraRisk } from '../../../../../survey-phase1/engine/braEngine';
import { isCrackRelated } from '../../../../../../components/canvas/defectHelpers';
import type { Phase1SurveyFormData } from '../../../../../survey-phase1/types/phase1.types';
import type {
  DiffItem,
  AuditStepwiseData,
  StepwiseSurveyJson,
  StepwiseBuildingSpecs,
  StepwiseDeformation,
  StepwiseSignatures,
} from '../types';

export type { DiffItem };

const getBurlandGradeFromWidth = (w: number): number => {
  if (w <= 0.1) return 0;
  if (w <= 1) return 1;
  if (w <= 5) return 2;
  if (w <= 15) return 3;
  if (w <= 25) return 4;
  return 5;
};

const STEP_1_TO_5_SCORING_KEYS = new Set([
  'usageFunction',
  'surveyCaseType',
  'isVacantLand',
  'objectGroup',
  'structureSystem',
  'foundationCatScore',
  'constructionYear',
  'historyInterview',
  'settlementTilt',
  'floors',
  'damageZones',
  'burlandSummary',
  'metroOffsetDistance',
  'clearanceOffsetDistance',
  'manualMetroDistanceM',
  'parcelCoordinates',
  'aboveFloors',
  'undergroundFloors',
  'floorsAbove',
  'basements',
]);

interface RecomputeDefectLike {
  isDeleted?: boolean;
  is_deleted?: boolean;
  screeningCategory?: string;
  defectType?: string;
  widthMaxMm?: number | string;
  width_max_mm?: number | string;
}

interface RecomputeZoneLike {
  isDeleted?: boolean;
  is_deleted?: boolean;
  zoneCode?: string;
  defects?: RecomputeDefectLike[];
}

interface RecomputeElementLike {
  isDeleted?: boolean;
  is_deleted?: boolean;
  defects?: RecomputeDefectLike[];
}

interface RecomputeFloorLike {
  isDeleted?: boolean;
  is_deleted?: boolean;
  zones?: RecomputeZoneLike[];
  structuralElements?: RecomputeElementLike[];
}

const IMPACT_LABELS_MAP: Record<'I1' | 'I2' | 'I3' | 'I4', string> = {
  I1: 'I1 (Tác động rất nhẹ)',
  I2: 'I2 (Tác động nhẹ)',
  I3: 'I3 (Tác động trung bình)',
  I4: 'I4 (Tác động nghiêm trọng)',
};

function recomputeDerivedPhase1State(
  nextState: Record<string, unknown>,
  changedTopKey: string,
  changedChildKey?: string,
  dirtyKeys?: Set<string>
): Record<string, unknown> {
  const updated = { ...nextState };

  // 1. Nếu sửa floors / damageZones -> tự động đồng bộ burlandSummary theo chuẩn Step4_BurlandSummary.tsx
  if (changedTopKey === 'floors' || changedTopKey === 'damageZones') {
    const floors = Array.isArray(updated.floors) ? (updated.floors as RecomputeFloorLike[]) : [];
    const damageZones = Array.isArray(updated.damageZones) ? (updated.damageZones as RecomputeZoneLike[]) : [];
    const curBs = ((updated.burlandSummary as Record<string, unknown>) || {}) as Record<string, unknown>;
    let totalDefectsCount = 0;
    const zCrackGrades: Array<{ grade: number; zoneCode: string }> = [];

    if (floors.length > 0) {
      floors.forEach((f) => {
        if (f.isDeleted || f.is_deleted) return;
        (f.zones || []).forEach((z) => {
          if (z.isDeleted || z.is_deleted) return;
          const activeDefects = (z.defects || []).filter((d) => !d.isDeleted && !d.is_deleted);
          totalDefectsCount += activeDefects.length;
          activeDefects.forEach((d) => {
            if (isCrackRelated(d.screeningCategory, d.defectType)) {
              zCrackGrades.push({
                grade: getBurlandGradeFromWidth(Number(d.widthMaxMm ?? d.width_max_mm) || 0),
                zoneCode: z.zoneCode || 'Z-01',
              });
            }
          });
        });
        (f.structuralElements || []).forEach((e) => {
          if (e.isDeleted || e.is_deleted) return;
          const activeDefects = (e.defects || []).filter((d) => !d.isDeleted && !d.is_deleted);
          totalDefectsCount += activeDefects.length;
        });
      });
    } else if (damageZones.length > 0) {
      damageZones.forEach((z) => {
        if (z.isDeleted || z.is_deleted) return;
        const activeDefects = (z.defects || []).filter((d) => !d.isDeleted && !d.is_deleted);
        totalDefectsCount += activeDefects.length;
        activeDefects.forEach((d) => {
          if (isCrackRelated(d.screeningCategory, d.defectType)) {
            zCrackGrades.push({
              grade: getBurlandGradeFromWidth(Number(d.widthMaxMm ?? d.width_max_mm) || 0),
              zoneCode: z.zoneCode || 'Z-01',
            });
          }
        });
      });
    }

    if (totalDefectsCount === 0) {
      updated.burlandSummary = {
        ...curBs,
        predominantGrade: 0,
        localMaxGrade: 0,
        structuralFlagLevel: 'NONE',
        needStructuralEngineerReview: false,
      };
    } else if (zCrackGrades.length > 0) {
      let inheritedMax = 0;
      let governingZoneCode = String(curBs.governingZoneCode || 'Z-01');
      const counts: Record<number, number> = {};
      zCrackGrades.forEach((item) => {
        if (item.grade >= inheritedMax) {
          inheritedMax = item.grade;
          governingZoneCode = item.zoneCode;
        }
        counts[item.grade] = (counts[item.grade] || 0) + 1;
      });
      let maxCount = -1;
      let inheritedPredominant = 0;
      Object.entries(counts).forEach(([gStr, count]) => {
        const g = Number(gStr);
        if (count > maxCount || (count === maxCount && g > inheritedPredominant)) {
          maxCount = count;
          inheritedPredominant = g;
        }
      });
      updated.burlandSummary = {
        ...curBs,
        localMaxGrade: inheritedMax,
        predominantGrade: inheritedPredominant,
        governingZoneCode,
      };
    } else {
      updated.burlandSummary = {
        ...curBs,
        localMaxGrade: 0,
        predominantGrade: 0,
      };
    }
  }

  // 2. Nếu sửa dữ liệu nguồn ở Bước 1..5 -> tự động tính lại ECS, VI, Impact và BRA theo chuẩn FE Phase 1
  if (STEP_1_TO_5_SCORING_KEYS.has(changedTopKey)) {
    const rawHi = (updated.historyInterview || {}) as Record<string, unknown>;
    const normalizedHi = {
      ...rawHi,
      continuousOperation247:
        typeof rawHi.continuousOperation247 === 'boolean'
          ? rawHi.continuousOperation247
          : Boolean((rawHi.continuousOperation247 as { has?: boolean } | undefined)?.has),
    };
    const rawCatScore = Number(updated.foundationCatScore);
    const phase1Input: Partial<Phase1SurveyFormData> = {
      ...(updated as unknown as Partial<Phase1SurveyFormData>),
      constructionYear:
        updated.constructionYear !== undefined && updated.constructionYear !== ''
          ? Number(updated.constructionYear)
          : undefined,
      foundationCatScore:
        !Number.isNaN(rawCatScore) && rawCatScore >= 1 && rawCatScore <= 5
          ? (rawCatScore as 1 | 2 | 3 | 4 | 5)
          : 5,
      historyInterview: normalizedHi as unknown as Phase1SurveyFormData['historyInterview'],
    };

    const nextEcs = calculateEcsScore(phase1Input);
    const nextVi = calculateViScore(phase1Input, nextEcs);
    updated.ecs = {
      ...((updated.ecs as Record<string, unknown>) || {}),
      ...nextEcs,
    };
    updated.vi = {
      ...((updated.vi as Record<string, unknown>) || {}),
      ...nextVi,
      avgVi: nextVi.viAvg,
    };

    const curExec = ((updated.executiveSummary as Record<string, unknown>) || {}) as Record<string, unknown>;
    // Nếu Admin sửa trực tiếp cự ly tim hầm (metroOffsetDistance / manualMetroDistanceM) ở Bước 1 mà chưa sửa riêng clearanceOffsetDistance,
    // đồng bộ luôn cự ly đường bao ngoài để Bước 8 tính toán Impact theo đúng thông số vừa cập nhật ở trên (không bị kẹt ở 0m cũ).
    if (
      (changedTopKey === 'metroOffsetDistance' || changedTopKey === 'manualMetroDistanceM') &&
      !dirtyKeys?.has('clearanceOffsetDistance')
    ) {
      const curClearanceStr = String(updated.clearanceOffsetDistance ?? '').trim();
      if (!/không có ga/i.test(curClearanceStr)) {
        const nextDistVal = String(updated[changedTopKey] ?? '').trim();
        if (nextDistVal !== '') {
          updated.clearanceOffsetDistance = nextDistVal;
        }
      }
    }

    const effectiveClearanceForImpact =
      (changedTopKey === 'metroOffsetDistance' || changedTopKey === 'manualMetroDistanceM') &&
      !dirtyKeys?.has('clearanceOffsetDistance')
        ? ((updated.manualMetroDistanceM || updated.metroOffsetDistance) as string)
        : (updated.clearanceOffsetDistance as string);

    const autoImpact = calculateConstructionImpact(
      (updated.objectGroup as string) || 'GENERAL',
      effectiveClearanceForImpact,
      (updated.manualMetroDistanceM || updated.metroOffsetDistance) as string
    );
    const isImpactTriggerKey = [
      'metroOffsetDistance',
      'clearanceOffsetDistance',
      'manualMetroDistanceM',
      'objectGroup',
      'parcelCoordinates',
    ].includes(changedTopKey);
    const rawCurImpactStr = String(curExec.constructionImpactStatus || '').trim();
    const curImpactStr =
      !rawCurImpactStr || rawCurImpactStr.toUpperCase() === 'PENDING'
        ? IMPACT_LABELS_MAP[autoImpact.code]
        : rawCurImpactStr;
    const effectiveICode = (
      isImpactTriggerKey
        ? autoImpact.code
        : curImpactStr.startsWith('I4')
          ? 'I4'
          : curImpactStr.startsWith('I3')
            ? 'I3'
            : curImpactStr.startsWith('I2')
              ? 'I2'
              : curImpactStr.startsWith('I1')
                ? 'I1'
                : autoImpact.code
    ) as 'I1' | 'I2' | 'I3' | 'I4';
    const braRes = calculateBraRisk(nextVi.viClass, effectiveICode);
    const nextBraStatus =
      braRes.riskLevel === 'Very High'
        ? 'VERY_HIGH'
        : braRes.riskLevel === 'High'
          ? 'HIGH'
          : braRes.riskLevel === 'Medium'
            ? 'MEDIUM'
            : 'LOW';

    updated.executiveSummary = {
      ...curExec,
      ...(isImpactTriggerKey
        ? {
            constructionImpactStatus: IMPACT_LABELS_MAP[autoImpact.code],
            impactOverrideReason: '',
            isImpactOverridden: false,
            isBraOverridden: false,
          }
        : {}),
      braStatus: nextBraStatus,
    };
  } else if (changedTopKey === 'ecs' || changedTopKey === 'vi') {
    // 3. Nếu Admin chỉnh trực tiếp điểm thành phần e1..e6 hoặc v1..v6 ở Bước 7 -> tự động cộng lại tổng & hạng
    const curEcs = ((updated.ecs as Record<string, unknown>) || {}) as Record<string, unknown>;
    const curVi = ((updated.vi as Record<string, unknown>) || {}) as Record<string, unknown>;

    const e1 = Number(curEcs.e1 ?? 0);
    const e2 = Number(curEcs.e2 ?? 0);
    const e3 = Number(curEcs.e3 ?? 0);
    const e4 = Number(curEcs.e4 ?? 0);
    const e5 = Number(curEcs.e5 ?? 0);
    const e6 = Number(curEcs.e6 ?? 0);
    const totalEcs = e1 + e2 + e3 + e4 + e5 + e6;
    const ecsClass: 'GOOD' | 'MEDIUM' | 'DEFICIENT' | 'CRITICAL' =
      totalEcs <= 5 ? 'GOOD' : totalEcs <= 10 ? 'MEDIUM' : totalEcs <= 16 ? 'DEFICIENT' : 'CRITICAL';

    updated.ecs = {
      ...curEcs,
      e1,
      e2,
      e3,
      e4,
      e5,
      e6,
      totalEcs,
      ecsClass,
      isOverrideLocked: e2 >= 3 || e3 >= 3,
    };

    const v1 = Number(curVi.v1 ?? 2);
    const v2 = Number(curVi.v2 ?? 2);
    const v3 = Number(curVi.v3 ?? 2);
    const v4 = Number(curVi.v4 ?? 2);
    const v5 =
      changedTopKey === 'ecs'
        ? ecsClass === 'CRITICAL'
          ? 4
          : ecsClass === 'DEFICIENT'
            ? 3
            : ecsClass === 'MEDIUM'
              ? 2
              : 1
        : Number(curVi.v5 ?? 1);
    const v6 = Number(curVi.v6 ?? 1);
    const totalVi = v1 + v2 + v3 + v4 + v5 + v6;
    const viAvg = Number((totalVi / 6).toFixed(2));
    const viClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' =
      viAvg > 3.25 ? 'VERY_HIGH' : viAvg > 2.5 ? 'HIGH' : viAvg > 1.5 ? 'MEDIUM' : 'LOW';

    updated.vi = {
      ...curVi,
      v1,
      v2,
      v3,
      v4,
      v5,
      v6,
      totalVi,
      viAvg,
      avgVi: viAvg,
      viClass,
    };

    const curExec = ((updated.executiveSummary as Record<string, unknown>) || {}) as Record<string, unknown>;
    const curImpactStr = String(curExec.constructionImpactStatus || 'I1');
    const iCode = (
      curImpactStr.startsWith('I4') ? 'I4' : curImpactStr.startsWith('I3') ? 'I3' : curImpactStr.startsWith('I2') ? 'I2' : 'I1'
    ) as 'I1' | 'I2' | 'I3' | 'I4';
    const braRes = calculateBraRisk(viClass, iCode);
    updated.executiveSummary = {
      ...curExec,
      braStatus:
        braRes.riskLevel === 'Very High'
          ? 'VERY_HIGH'
          : braRes.riskLevel === 'High'
            ? 'HIGH'
            : braRes.riskLevel === 'Medium'
              ? 'MEDIUM'
              : 'LOW',
    };
  } else if (changedTopKey === 'executiveSummary' && changedChildKey === 'constructionImpactStatus') {
    const curExec = ((updated.executiveSummary as Record<string, unknown>) || {}) as Record<string, unknown>;
    const curVi = ((updated.vi as Record<string, unknown>) || {}) as Record<string, unknown>;
    const viClass = ((curVi.viClass as string) || 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
    const curImpactStr = String(curExec.constructionImpactStatus || 'I1');
    const iCode = (
      curImpactStr.startsWith('I4') ? 'I4' : curImpactStr.startsWith('I3') ? 'I3' : curImpactStr.startsWith('I2') ? 'I2' : 'I1'
    ) as 'I1' | 'I2' | 'I3' | 'I4';
    const braRes = calculateBraRisk(viClass, iCode);
    updated.executiveSummary = {
      ...curExec,
      braStatus:
        braRes.riskLevel === 'Very High'
          ? 'VERY_HIGH'
          : braRes.riskLevel === 'High'
            ? 'HIGH'
            : braRes.riskLevel === 'Medium'
              ? 'MEDIUM'
              : 'LOW',
    };
  }

  return updated;
}

export interface UseAuditStepwiseFormParams {
  data: AuditStepwiseData | null | undefined;
  onOpenDiffModal: (diffItems: DiffItem[], updates: Record<string, unknown>) => void;
}

export const useAuditStepwiseForm = ({ data, onOpenDiffModal }: UseAuditStepwiseFormParams) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeNavStep, setActiveNavStep] = useState<string>('step-1');
  const [activeSubNavId, setActiveSubNavId] = useState<string>('');

  // Form state & Dirty fields tracker
  const [formState, setFormState] = useState<Record<string, unknown>>({});
  const [originalState, setOriginalState] = useState<Record<string, unknown>>({});
  const [dirtyFields, setDirtyFields] = useState<Record<string, { label: string; oldValue: unknown; newValue: unknown }>>({});

  // Refs to stabilize callbacks and prevent infinite render loops
  const originalStateRef = useRef<Record<string, unknown>>(originalState);
  originalStateRef.current = originalState;

  const formStateRef = useRef<Record<string, unknown>>(formState);
  formStateRef.current = formState;

  const dirtyFieldsRef = useRef<Record<string, { label: string; oldValue: unknown; newValue: unknown }>>(dirtyFields);
  dirtyFieldsRef.current = dirtyFields;

  // Sync initial data from incoming props
  useEffect(() => {
    if (!data) return;
    const sJson: StepwiseSurveyJson = (data.surveyJson || data.survey_data_json || data.leftPane?.surveyJson || {}) as StepwiseSurveyJson;
    const bSpecs: StepwiseBuildingSpecs = (data.leftPane?.buildingSpecs || data.buildingSpecs || {}) as StepwiseBuildingSpecs;
    const defState: StepwiseDeformation = (data.leftPane?.deformation || data.deformation || {}) as StepwiseDeformation;
    const hiState = (sJson.historyInterview || data.leftPane?.interview || data.historyInterview || {}) as Record<string, unknown>;
    const sigState: StepwiseSignatures = (data.leftPane?.signatures || sJson.signatures || {}) as StepwiseSignatures;

    // Tự động tính toán trắc địa không gian chuẩn nếu hồ sơ thiếu số liệu cự ly
    let defaultMetroDist = sJson.metroOffsetDistance !== undefined && sJson.metroOffsetDistance !== ''
      ? String(sJson.metroOffsetDistance)
      : (data.metroOffsetDistance !== undefined && data.metroOffsetDistance !== '' ? String(data.metroOffsetDistance) : '');
    let defaultClearanceDist = sJson.clearanceOffsetDistance !== undefined && sJson.clearanceOffsetDistance !== ''
      ? String(sJson.clearanceOffsetDistance)
      : (data.clearanceOffsetDistance !== undefined && data.clearanceOffsetDistance !== '' ? String(data.clearanceOffsetDistance) : '');

    let fallbackClosestVertex: [number, number] | null = null;
    if (
      Array.isArray(sJson.parcelCoordinates) ||
      Array.isArray(sJson.polygonCoords) ||
      data.cadastralGeojson ||
      data.cadastral_geojson ||
      data.coordinates ||
      data.parcelCoordinates
    ) {
      try {
        let pCoords: [number, number][] = [];
        const rawGeo = data.cadastralGeojson || data.cadastral_geojson;
        if (Array.isArray(sJson.parcelCoordinates) && sJson.parcelCoordinates.length >= 3) {
          pCoords = sJson.parcelCoordinates;
        } else if (Array.isArray(sJson.polygonCoords) && sJson.polygonCoords.length >= 3) {
          pCoords = sJson.polygonCoords;
        } else if (rawGeo) {
          const parsed = typeof rawGeo === 'string' ? JSON.parse(rawGeo) : (rawGeo as { type?: string; coordinates?: [number, number][][] });
          if (parsed && parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) {
            pCoords = parsed.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]);
          }
        } else if (Array.isArray(data.coordinates) && data.coordinates.length >= 3 && typeof data.coordinates[0] !== 'number') {
          pCoords = data.coordinates as [number, number][];
        } else if (Array.isArray(data.parcelCoordinates) && data.parcelCoordinates.length >= 3) {
          pCoords = data.parcelCoordinates;
        }

        if (pCoords.length >= 3) {
          const metrics = calculateComprehensiveMetroSpatialMetrics(pCoords);
          fallbackClosestVertex = metrics.closestCenterVertex || pCoords[0];
          if (!defaultMetroDist) {
            defaultMetroDist = metrics.distanceToCenterlineMeters.toFixed(1);
          }
          if (!defaultClearanceDist) {
            defaultClearanceDist =
              metrics.outerBoundaryType === 'STATION_OUTLINE'
                ? metrics.distanceToOuterBoundaryMeters.toFixed(1)
                : 'Không có ga trong khu vực';
          }
        }
      } catch (e) {
        console.warn('Error calculating fallback spatial metrics in useAuditStepwiseForm:', e);
      }
    }

    const rawGps = sJson.gpsCoords || (typeof data.coordinates === 'object' && data.coordinates !== null && !Array.isArray(data.coordinates) ? (data.coordinates as { latitude?: number; lat?: number; longitude?: number; lng?: number; accuracy?: number }) : {});
    const coordArray = Array.isArray(data.coordinates) ? data.coordinates : null;
    const latInit =
      rawGps.latitude ??
      rawGps.lat ??
      (coordArray && typeof coordArray[0] === 'number' ? coordArray[0] : fallbackClosestVertex ? fallbackClosestVertex[0] : null);
    const lngInit =
      rawGps.longitude ??
      rawGps.lng ??
      (coordArray && typeof coordArray[1] === 'number' ? coordArray[1] : fallbackClosestVertex ? fallbackClosestVertex[1] : null);
    const accInit = rawGps.accuracy ?? 0;

    const rawInitCatScore = Number(sJson.foundationCatScore);
    const resolvedInitCatScore =
      !Number.isNaN(rawInitCatScore) && rawInitCatScore >= 1 && rawInitCatScore <= 5 ? rawInitCatScore : 5;

    const resolvedPileDim =
      sJson.pileDimensionMm ||
      sJson.pileDimension ||
      (sJson.pileWidthMm && sJson.pileLengthMm ? `${sJson.pileWidthMm} x ${sJson.pileLengthMm} mm` : '');

    const sJsonRec = sJson as Record<string, unknown>;

    const initial: Record<string, unknown> = {
      // Step 1: Identification & General Specs
      projectParcelCode: data.projectParcelCode || sJson.projectParcelCode || '',
      houseNumber: data.houseNumber || sJson.houseNumber || '',
      street: data.street || sJson.street || '',
      ward: data.ward || sJson.ward || (sJsonRec.wardName as string | undefined) || '',
      district: data.district || sJson.district || (sJsonRec.districtName as string | undefined) || '',
      standardizedAddress: sJson.standardizedAddress || null,
      buildingName: sJson.buildingName || data.buildingName || 'Nhà ở dân dụng',
      ownerName: sJson.ownerName || data.ownerName || bSpecs.ownerName || '',
      ownerPhone: sJson.ownerPhone || data.ownerPhone || bSpecs.ownerPhone || '',
      officialCadastralCode: sJson.officialCadastralCode || data.officialCadastralCode || '',
      buildingType: data.buildingType || sJson.buildingType || 'RESIDENTIAL',
      objectGroup: sJson.objectGroup || bSpecs.buildingGrade || bSpecs.building_grade || 'GENERAL',
      usageFunction: sJson.usageFunction || bSpecs.landUseFunction || bSpecs.land_use_function || 'Nhà ở gia đình',
      aboveFloors: sJson.aboveFloors !== undefined ? sJson.aboveFloors : (bSpecs.floorCount ?? bSpecs.floor_count ?? 1),
      undergroundFloors: sJson.undergroundFloors !== undefined ? sJson.undergroundFloors : (bSpecs.basementCount ?? bSpecs.basement_count ?? 0),
      constructionYear: sJson.constructionYear || bSpecs.yearOfConstruction || bSpecs.year_of_construction || '',
      isEstimatedYear: Boolean(sJson.isEstimatedYear ?? bSpecs.isYearEstimated ?? bSpecs.is_year_estimated),
      constructionAreaM2: sJson.constructionAreaM2 || bSpecs.constructionAreaM2 || bSpecs.construction_area_m2 || data.constructionAreaM2 || '',
      buildingHeightM: sJson.buildingHeightM || bSpecs.buildingHeightM || bSpecs.building_height_m || '',
      adjacentBuildings: sJson.adjacentBuildings || bSpecs.adjacentBuildings || bSpecs.adjacent_buildings || { left: { details: '' }, right: { details: '' }, back: { details: '' } },

      // Survey Case Type & Special Case Notes
      surveyCaseType: sJson.surveyCaseType || (data.isRefusedOrAbsent ? 'ABSENTEE' : 'NORMAL'),
      vacantLandCurrentState: sJson.vacantLandCurrentState || (sJsonRec.vacantLandStatus as string | undefined) || '',
      vacantLandNotes: sJson.vacantLandNotes || '',
      vacantLandPhotos: Array.isArray(sJson.vacantLandPhotos) ? sJson.vacantLandPhotos : [],
      underConstructionPhotos: Array.isArray(sJson.underConstructionPhotos) ? sJson.underConstructionPhotos : [],
      absenteeNoticePhotos:
        sJson.absenteeNoticePhotos ||
        (sJsonRec.absentNoticePhotos as unknown[] | undefined) ||
        (sJsonRec.absenteeMinutesPhotos as unknown[] | undefined) ||
        [],
      constructionStageNotes: sJson.constructionStageNotes || '',
      unitCode: data.unitCode || sJson.unitCode || '',
      unitFloorNumber: data.unitFloorNumber || sJson.unitFloorNumber || '',
      managementContactName: sJson.managementContactName || '',
      managementContactPhone: sJson.managementContactPhone || '',

      // Spatial & GPS calculations (Allow manual override)
      gpsCoords:
        latInit !== null && lngInit !== null
          ? {
              lat: Number(latInit),
              latitude: Number(latInit),
              lng: Number(lngInit),
              longitude: Number(lngInit),
              accuracy: Number(accInit),
            }
          : { lat: null, lng: null, accuracy: 0 },
      parcelCoordinates:
        Array.isArray(sJson.parcelCoordinates) && sJson.parcelCoordinates.length >= 3
          ? sJson.parcelCoordinates
          : Array.isArray(sJson.polygonCoords) && sJson.polygonCoords.length >= 3
          ? sJson.polygonCoords
          : undefined,
      keepKsvBoundaryConfirmed: Boolean(sJson.keepKsvBoundaryConfirmed),
      keepKsvBoundaryReason: typeof sJson.keepKsvBoundaryReason === 'string' ? sJson.keepKsvBoundaryReason : '',
      metroOffsetDistance: defaultMetroDist,
      clearanceOffsetDistance: defaultClearanceDist,
      manualMetroDistanceM: sJson.manualMetroDistanceM ?? data.manualMetroDistanceM ?? '',
      chainage: sJson.chainage || data.chainage || '',

      // Step 2: Structure & Foundation & History Interview
      structureSystem: sJson.structureSystem || bSpecs.structuralSystem || bSpecs.structural_system || '',
      foundationType: sJson.foundationType || bSpecs.foundationCategory || bSpecs.foundation_category || '',
      foundationCatScore: resolvedInitCatScore,
      foundationDepthM: sJson.foundationDepthM !== undefined ? sJson.foundationDepthM : (bSpecs.foundationDepthM ?? bSpecs.foundation_depth_m ?? ''),
      foundationDensity: sJson.foundationDensity !== undefined ? sJson.foundationDensity : (bSpecs.foundationDensity ?? bSpecs.foundation_density ?? ''),
      foundationSpacingM: sJson.foundationSpacingM !== undefined ? sJson.foundationSpacingM : (bSpecs.foundationSpacingM ?? bSpecs.foundation_spacing_m ?? ''),
      pileDimensionMm: resolvedPileDim,
      pileDimension: sJson.pileDimension || resolvedPileDim,
      foundationNotes: sJson.foundationNotes || bSpecs.foundationNotes || bSpecs.foundation_notes || '',
      asBuiltDrawingPhotos: Array.isArray(sJson.asBuiltDrawingPhotos) && sJson.asBuiltDrawingPhotos.length > 0
        ? sJson.asBuiltDrawingPhotos
        : sJson.asBuiltDrawingPhotoUrl
        ? [{ url: sJson.asBuiltDrawingPhotoUrl, photoCode: 'AS_BUILT', notes: 'Bản vẽ hoàn công' }]
        : [],
      historyInterview: hiState,

      // Step 3: Damage zones, defects list & full floor hierarchy with CAD sketch photos and pins
      damageZones: data.leftPane?.damageZones || sJson.damageZones || [],
      floors: Array.isArray(sJson.floors) ? sJson.floors : [],

      // Step 4: Burland Summary
      burlandSummary: sJson.burlandSummary || {},

      // Step 5: Tilt & Settlement (Chuẩn hóa hai chiều đầy đủ ảnh lún chênh, ảnh nghiêng, ảnh ngoại lệ)
      settlementTilt: {
        ...sJson.settlementTilt,
        diffSettlement: {
          level: sJson.settlementTilt?.diffSettlement?.level ?? defState.diff_settlement_level ?? 0,
          position: sJson.settlementTilt?.diffSettlement?.position || defState.diff_settlement_position || '',
          photoUrl: sJson.settlementTilt?.diffSettlement?.photoUrl || defState.diff_settlement_photo_url || '',
          photoCode: sJson.settlementTilt?.diffSettlement?.photoCode || defState.diff_settlement_photo_code || 'SETTLE_01',
          photos: Array.isArray(sJson.settlementTilt?.diffSettlement?.photos) && sJson.settlementTilt.diffSettlement.photos.length > 0
            ? sJson.settlementTilt.diffSettlement.photos
            : Array.isArray(defState.diff_settlement_photos_json) && defState.diff_settlement_photos_json.length > 0
            ? defState.diff_settlement_photos_json
            : (sJson.settlementTilt?.diffSettlement?.photoUrl || defState.diff_settlement_photo_url
              ? [{ url: sJson.settlementTilt?.diffSettlement?.photoUrl || defState.diff_settlement_photo_url, photoCode: sJson.settlementTilt?.diffSettlement?.photoCode || defState.diff_settlement_photo_code || 'SETTLE_01' }]
              : []),
          notes: sJson.settlementTilt?.diffSettlement?.notes || defState.diff_settlement_notes || '',
        },
        buildingTilt: {
          level: sJson.settlementTilt?.buildingTilt?.level ?? defState.building_tilt_level ?? 0,
          xPermille: sJson.settlementTilt?.buildingTilt?.xPermille ?? defState.tilt_x_permille ?? '',
          yPermille: sJson.settlementTilt?.buildingTilt?.yPermille ?? defState.tilt_y_permille ?? '',
          direction: sJson.settlementTilt?.buildingTilt?.direction || defState.tilt_direction || '',
          photoUrl: sJson.settlementTilt?.buildingTilt?.photoUrl || defState.tilt_photo_url || '',
          photoCode: sJson.settlementTilt?.buildingTilt?.photoCode || defState.tilt_photo_code || 'TILT_01',
          photos: Array.isArray(sJson.settlementTilt?.buildingTilt?.photos) && sJson.settlementTilt.buildingTilt.photos.length > 0
            ? sJson.settlementTilt.buildingTilt.photos
            : Array.isArray(defState.tilt_photos_json) && defState.tilt_photos_json.length > 0
            ? defState.tilt_photos_json
            : (sJson.settlementTilt?.buildingTilt?.photoUrl || defState.tilt_photo_url
              ? [{ url: sJson.settlementTilt?.buildingTilt?.photoUrl || defState.tilt_photo_url, photoCode: sJson.settlementTilt?.buildingTilt?.photoCode || defState.tilt_photo_code || 'TILT_01' }]
              : []),
          notes: sJson.settlementTilt?.buildingTilt?.notes || defState.tilt_notes || '',
        },
        beamSagging: {
          ...sJson.settlementTilt?.beamSagging,
          level: sJson.settlementTilt?.beamSagging?.level ?? defState.beam_sagging_level ?? 0,
          sagMm: sJson.settlementTilt?.beamSagging?.sagMm ?? defState.beam_sagging_mm ?? '',
          position: sJson.settlementTilt?.beamSagging?.position || defState.beam_sagging_position || '',
          description: sJson.settlementTilt?.beamSagging?.description || defState.beam_sagging_description || '',
          photoUrl: sJson.settlementTilt?.beamSagging?.photoUrl || '',
          photos:
            Array.isArray(sJson.settlementTilt?.beamSagging?.photos) && sJson.settlementTilt.beamSagging.photos.length > 0
              ? sJson.settlementTilt.beamSagging.photos
              : sJson.settlementTilt?.beamSagging?.photoUrl
              ? [{ url: sJson.settlementTilt.beamSagging.photoUrl, photoCode: 'SAG_01' }]
              : [],
          notes: sJson.settlementTilt?.beamSagging?.notes || '',
        },
        abnormalCase: {
          hasAbnormal: Boolean(sJson.settlementTilt?.abnormalCase?.hasAbnormal ?? sJson.settlementTilt?.abnormalCase?.description ?? sJson.settlementTilt?.abnormalCase?.notes ?? defState.abnormal_photo_url),
          description: sJson.settlementTilt?.abnormalCase?.description || sJson.settlementTilt?.abnormalCase?.notes || defState.abnormal_notes || '',
          photoUrl: sJson.settlementTilt?.abnormalCase?.photoUrl || defState.abnormal_photo_url || '',
          photoCode: sJson.settlementTilt?.abnormalCase?.photoCode || defState.abnormal_photo_code || 'ANOMALY_01',
          photos: Array.isArray(sJson.settlementTilt?.abnormalCase?.photos) && sJson.settlementTilt.abnormalCase.photos.length > 0
            ? sJson.settlementTilt.abnormalCase.photos
            : Array.isArray(defState.abnormal_photos_json) && defState.abnormal_photos_json.length > 0
            ? defState.abnormal_photos_json
            : (sJson.settlementTilt?.abnormalCase?.photoUrl || defState.abnormal_photo_url
              ? [{ url: sJson.settlementTilt?.abnormalCase?.photoUrl || defState.abnormal_photo_url, photoCode: sJson.settlementTilt?.abnormalCase?.photoCode || defState.abnormal_photo_code || 'ANOMALY_01' }]
              : []),
          notes: sJson.settlementTilt?.abnormalCase?.notes || sJson.settlementTilt?.abnormalCase?.description || defState.abnormal_notes || '',
        },
        dataSource: Array.isArray(sJson.settlementTilt?.dataSource)
          ? sJson.settlementTilt.dataSource
          : Array.isArray((sJson.settlementTilt as Record<string, unknown> | undefined)?.dataSources)
          ? ((sJson.settlementTilt as Record<string, unknown>).dataSources as unknown[])
          : Array.isArray(((sJson as Record<string, unknown>).settlementTiltData as Record<string, unknown> | undefined)?.dataSources)
          ? (((sJson as Record<string, unknown>).settlementTiltData as Record<string, unknown>).dataSources as unknown[])
          : [],
        reliability: sJson.settlementTilt?.reliability || 'MEDIUM',
        needAdditionalMonitoring: sJson.settlementTilt?.needAdditionalMonitoring || {
          required: Boolean(defState.need_additional_monitoring),
          notes: defState.monitoring_notes || '',
        },
      },

      // Step 6: Scope & GIS
      surveyScope: sJson.surveyScope || {
        externalFront: true,
        surveyedFloors: [],
        roofTerrace: false,
        basement: false,
        backyardOuthouse: false,
      },
      accessLimitation: sJson.accessLimitation || {},
      gisMutationConfirmed: sJson.gisMutationConfirmed || {},
      frontageWidth: sJson.frontageWidth ?? data.frontageWidth ?? bSpecs.frontageWidth ?? '',
      lotDepth: sJson.lotDepth ?? data.lotDepth ?? bSpecs.lotDepth ?? '',
      landAreaM2: sJson.landAreaM2 ?? data.landAreaM2 ?? bSpecs.landAreaM2 ?? '',

      // Step 7: Technical Scores & Completeness Gate
      ecs: sJson.ecs || {},
      vi: sJson.vi || {},
      gateDecision: sJson.gateDecision || { decision: 'ALLOW', reason: '' },

      // Step 8: Conclusions & BRA (Chuẩn hóa PENDING / tự động tính theo cự ly hiện hành)
      executiveSummary: (() => {
        const rawExec = (sJson.executiveSummary || {}) as Record<string, unknown>;
        const initObjGroup = String(sJson.objectGroup || bSpecs.buildingGrade || bSpecs.building_grade || 'GENERAL');
        const initAutoImpact = calculateConstructionImpact(
          initObjGroup,
          defaultClearanceDist || undefined,
          (sJson.manualMetroDistanceM ?? data.manualMetroDistanceM ?? defaultMetroDist) || undefined
        );
        const rawImpact = String(rawExec.constructionImpactStatus || '').trim();
        const hasValidSavedOverride =
          /^I[1-4]/i.test(rawImpact) &&
          Boolean(rawExec.isImpactOverridden) &&
          Boolean(rawExec.impactOverrideReason && String(rawExec.impactOverrideReason).trim().length >= 5);
        const resolvedImpactLabel = hasValidSavedOverride
          ? rawImpact
          : IMPACT_LABELS_MAP[initAutoImpact.code];
        const resolvedICode = (
          resolvedImpactLabel.startsWith('I4')
            ? 'I4'
            : resolvedImpactLabel.startsWith('I3')
              ? 'I3'
              : resolvedImpactLabel.startsWith('I2')
                ? 'I2'
                : 'I1'
        ) as 'I1' | 'I2' | 'I3' | 'I4';
        const initViObj = (sJson.vi || {}) as { viClass?: string; viAvg?: number; avgVi?: number };
        const initViAvg = Number(initViObj.viAvg ?? initViObj.avgVi ?? 0);
        const initViClass =
          initViObj.viClass ||
          (initViAvg > 3.25 ? 'VERY_HIGH' : initViAvg > 2.5 ? 'HIGH' : initViAvg > 1.5 ? 'MEDIUM' : 'LOW');
        const initBraEval = calculateBraRisk(initViClass, resolvedICode);
        const computedBraCode = initBraEval.riskLevel.toUpperCase().replace(/\s+/g, '_');
        const rawBra = String(rawExec.braStatus || data.braStatus || '').trim().toUpperCase().replace(/\s+/g, '_');
        const resolvedBra =
          rawBra && rawBra !== 'PENDING' && Boolean(rawExec.isBraOverridden)
            ? rawBra
            : computedBraCode;

        return {
          ...rawExec,
          braStatus: resolvedBra,
          constructionImpactStatus: resolvedImpactLabel,
          isImpactOverridden: hasValidSavedOverride,
          impactOverrideReason: hasValidSavedOverride ? String(rawExec.impactOverrideReason || '') : '',
          keyRisksDefectsText: String(rawExec.keyRisksDefectsText ?? ''),
          specificRecommendationsText: String(rawExec.specificRecommendationsText ?? data.engineeringRecommendations ?? ''),
          summaryConclusions: String(rawExec.summaryConclusions ?? data.summaryConclusions ?? ''),
        };
      })(),
      summaryConclusions: sJson.summaryConclusions || data.summaryConclusions || '',

      // Step 9: Signatures & Absence
      surveyDate: data.surveyDate || sJson.surveyDate || '',
      surveyorPhone: data.surveyorPhone || sJson.surveyorPhone || '',
      signatures: {
        surveyorSignature: sigState.surveyorSignature || sigState.preparedBy?.photoUrl || data.surveyorSignatureUrl || null,
        surveyorName: sigState.surveyorName || sigState.preparedBy?.fullName || data.surveyorName || '',
        surveyorPhone: sigState.surveyorPhone || data.surveyorPhone || '',
        ownerSignature: sigState.ownerSignature || sigState.ownerRepresentative?.photoUrl || data.ownerSignatureUrl || null,
        ownerName: sigState.ownerName || sigState.ownerRepresentative?.fullName || data.ownerName || sJson.ownerName || '',
        ownerPhone: sigState.ownerPhone || sJson.ownerPhone || data.ownerPhone || '',
        ownerFeedback: sigState.ownerFeedback || sigState.ownerRemarks || data.ownerRemarks || '',
        witnessName: sigState.witnessName || sJson.witnessName || '',
        witnessRole: sigState.witnessRole || sJson.witnessRole || 'Tổ trưởng tổ dân phố / Cán bộ địa chính',
        witnessPhone: sigState.witnessPhone || sJson.witnessPhone || '',
        witnessSignature: sigState.witnessSignature || sJson.witnessSignature || null,
        workingMinutesPhotos: sigState.workingMinutesPhotos || [],
      },
      absenceLogs:
        sJson.absenceLogs ||
        data.leftPane?.absenceLogs ||
        ((data as Record<string, unknown>).absenceLogs as unknown[] | undefined) ||
        [],
      photoRotations:
        sJson.photoRotations && typeof sJson.photoRotations === 'object'
          ? { ...(sJson.photoRotations as Record<string, number>) }
          : {},
    };

    setFormState(initial);
    setOriginalState(initial);
    setDirtyFields({});
  }, [data]);

  // Helper to deep get value
  const getDeepVal = useCallback((obj: Record<string, unknown> | undefined, path: string[]): unknown => {
    return path.reduce<unknown>(
      (curr, p) => (curr && typeof curr === 'object' ? (curr as Record<string, unknown>)[p] : undefined),
      obj
    );
  }, []);

  // Handle direct field change
  const handleFieldChange = useCallback((fieldKey: string, label: string, val: unknown) => {
    const activeDirtyKeys = new Set(Object.keys(dirtyFieldsRef.current));
    setFormState((prev) => recomputeDerivedPhase1State({ ...prev, [fieldKey]: val }, fieldKey, undefined, activeDirtyKeys));

    const originalVal = originalStateRef.current[fieldKey];
    if (JSON.stringify(originalVal) === JSON.stringify(val)) {
      setDirtyFields((prev) => {
        const copy = { ...prev };
        delete copy[fieldKey];
        return copy;
      });
    } else {
      setDirtyFields((prev) => ({
        ...prev,
        [fieldKey]: {
          label,
          oldValue: originalVal,
          newValue: val,
        },
      }));
    }
  }, []);

  /**
   * Đồng bộ Ranh đất PostGIS & Cự ly Metro (Ràng buộc 02 - /grill-me):
   * Cập nhật parcelCoordinates, metroOffsetDistance, clearanceOffsetDistance và gpsCoords (đỉnh gần Metro nhất).
   * Tuyệt đối KHÔNG ghi đè landAreaM2, constructionAreaM2, frontageWidth, lotDepth.
   */
  const handleApplySyncedGeometry = useCallback((
    newCoords: [number, number][],
    newMetroDist: string,
    newClearanceDist: string,
    closestCenterVertex?: [number, number] | null
  ) => {
    if (!isEditMode) {
      setIsEditMode(true);
    }
    let targetVertex = closestCenterVertex;
    if (!targetVertex && Array.isArray(newCoords) && newCoords.length >= 3) {
      try {
        targetVertex = calculateComprehensiveMetroSpatialMetrics(newCoords).closestCenterVertex;
      } catch (err) {
        console.warn('Error computing closestCenterVertex in handleApplySyncedGeometry:', err);
      }
    }
    handleFieldChange('parcelCoordinates', 'Tọa độ đa giác ranh thửa (PostGIS GPMB)', newCoords);
    handleFieldChange('metroOffsetDistance', 'Cự ly tim hầm Metro (m)', newMetroDist);
    handleFieldChange('clearanceOffsetDistance', 'Cự ly đường bao ngoài / mép ga (m)', newClearanceDist);
    if (targetVertex && targetVertex.length >= 2) {
      const curAcc = (formStateRef.current.gpsCoords as { accuracy?: number } | undefined)?.accuracy || 1.5;
      handleFieldChange('gpsCoords', 'Tọa độ đỉnh ranh gần Metro nhất (PostGIS)', {
        lat: Number(targetVertex[0]),
        latitude: Number(targetVertex[0]),
        lng: Number(targetVertex[1]),
        longitude: Number(targetVertex[1]),
        accuracy: Number(curAcc),
      });
    }
    if (formStateRef.current.keepKsvBoundaryConfirmed) {
      handleFieldChange('keepKsvBoundaryConfirmed', 'Xác nhận giữ ranh KSV thực địa', false);
    }
  }, [handleFieldChange, isEditMode]);

  // Handle nested object field change (supports dot-paths e.g. 'diffSettlement.level')
  const handleNestedFieldChange = useCallback((parentKey: string, childKey: string, label: string, val: unknown) => {
    setFormState((prev) => {
      const parentObj = (prev[parentKey] as Record<string, unknown>) || {};
      let updatedParent: Record<string, unknown>;

      if (childKey.includes('.')) {
        const parts = childKey.split('.');
        const copy = JSON.parse(JSON.stringify(parentObj)) as Record<string, unknown>;
        let cur = copy;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') {
            cur[parts[i]] = {};
          }
          cur = cur[parts[i]] as Record<string, unknown>;
        }
        cur[parts[parts.length - 1]] = val;
        updatedParent = copy;
      } else {
        updatedParent = { ...parentObj, [childKey]: val };
      }

      return recomputeDerivedPhase1State({ ...prev, [parentKey]: updatedParent }, parentKey, childKey);
    });

    const dirtyKey = `${parentKey}.${childKey}`;
    const origParent = (originalStateRef.current[parentKey] as Record<string, unknown>) || {};
    const originalVal = childKey.includes('.') ? getDeepVal(origParent, childKey.split('.')) : origParent[childKey];

    if (JSON.stringify(originalVal) === JSON.stringify(val)) {
      setDirtyFields((prev) => {
        const copy = { ...prev };
        delete copy[dirtyKey];
        return copy;
      });
    } else {
      setDirtyFields((prev) => ({
        ...prev,
        [dirtyKey]: {
          label,
          oldValue: originalVal,
          newValue: val,
        },
      }));
    }
  }, [getDeepVal]);

  // Helper check if field or nested field is dirty
  const isFieldDirty = useCallback((fieldKey: string, subKey?: string): boolean => {
    if (subKey) {
      return Boolean(dirtyFieldsRef.current[`${fieldKey}.${subKey}`]);
    }
    if (dirtyFieldsRef.current[fieldKey]) return true;
    return Object.keys(dirtyFieldsRef.current).some((k) => k === fieldKey || k.startsWith(`${fieldKey}.`));
  }, []);

  // Discard all changes
  const handleDiscard = useCallback((silent = false) => {
    if (silent || window.confirm('Bạn có chắc muốn hủy bỏ mọi thay đổi vừa chỉnh sửa?')) {
      setFormState(originalStateRef.current);
      setDirtyFields({});
      setIsEditMode(false);
    }
  }, []);

  // Discard a single diff item (revert field to original KSV state)
  const discardDiffItem = useCallback((fieldKey: string) => {
    if (fieldKey.includes('.')) {
      const parts = fieldKey.split('.');
      const parentKey = parts[0];
      const childPath = parts.slice(1);
      const origParent = (originalStateRef.current[parentKey] as Record<string, unknown>) || {};
      const origVal = getDeepVal(origParent, childPath);

      setFormState((prev) => {
        const parentObj = (prev[parentKey] as Record<string, unknown>) || {};
        const copy = JSON.parse(JSON.stringify(parentObj)) as Record<string, unknown>;
        let cur = copy;
        for (let i = 0; i < childPath.length - 1; i++) {
          if (!cur[childPath[i]] || typeof cur[childPath[i]] !== 'object') {
            cur[childPath[i]] = {};
          }
          cur = cur[childPath[i]] as Record<string, unknown>;
        }
        if (origVal === undefined) {
          delete cur[childPath[childPath.length - 1]];
        } else {
          cur[childPath[childPath.length - 1]] = origVal;
        }
        return recomputeDerivedPhase1State({ ...prev, [parentKey]: copy }, parentKey, childPath.join('.'));
      });
    } else {
      setFormState((prev) =>
        recomputeDerivedPhase1State(
          {
            ...prev,
            [fieldKey]: originalStateRef.current[fieldKey],
          },
          fieldKey
        )
      );
    }

    setDirtyFields((prev) => {
      const copy = { ...prev };
      delete copy[fieldKey];
      return copy;
    });
  }, [getDeepVal]);

  const getDiffPayload = useCallback(() => {
    const diffItems: DiffItem[] = [];

    const formatPhotoRotationKeyLabel = (rotKey: string): string => {
      if (rotKey.startsWith('photoP0')) {
        return `Ảnh định danh ngoại quan (${rotKey.replace('photo', '')})`;
      }
      const cadStructMatch = rotKey.match(/^floor_(.+)_(?:structural_cad|cad_struct)$/);
      if (cadStructMatch) {
        return `Sơ đồ mặt bằng Kết cấu CAD_E (${cadStructMatch[1]})`;
      }
      const cadMatch = rotKey.match(/^floor_(.+)_cad$/);
      if (cadMatch) {
        return `Sơ đồ mặt bằng Kiến trúc CAD_Z (${cadMatch[1]})`;
      }
      const zoneCtxMatch = rotKey.match(/^zone_f(\d+)_z([^_]+)_ctx$/);
      if (zoneCtxMatch) {
        return `Ảnh bối cảnh Vùng ${zoneCtxMatch[2]} (Tầng ${Number(zoneCtxMatch[1]) + 1})`;
      }
      const elemCtxMatch = rotKey.match(/^elem_f(\d+)_e([^_]+)_ctx$/);
      if (elemCtxMatch) {
        return `Ảnh bối cảnh Cấu kiện ${elemCtxMatch[2]} (Tầng ${Number(elemCtxMatch[1]) + 1})`;
      }
      const defectCuMatch = rotKey.match(/^defect_f(\d+)_([ze][^_]+)_(.+)_cu_(\d+)$/);
      if (defectCuMatch) {
        return `Ảnh cận cảnh CU #${Number(defectCuMatch[4]) + 1} (${defectCuMatch[2]} • ${defectCuMatch[3]})`;
      }
      return `Ảnh hồ sơ (${rotKey})`;
    };

    const expandFloorsDiff = (oldFloorsRaw: unknown, newFloorsRaw: unknown, fallbackLabel: string): DiffItem[] => {
      const oldFloors = Array.isArray(oldFloorsRaw) ? (oldFloorsRaw as Array<Record<string, unknown>>) : [];
      const newFloors = Array.isArray(newFloorsRaw) ? (newFloorsRaw as Array<Record<string, unknown>>) : [];
      const items: DiffItem[] = [];

      const maxLen = Math.max(oldFloors.length, newFloors.length);
      for (let fIdx = 0; fIdx < maxLen; fIdx++) {
        const oldFl = oldFloors[fIdx];
        const newFl = newFloors[fIdx];
        const flName = String(newFl?.floorName || oldFl?.floorName || `Tầng ${fIdx + 1}`);

        if (!oldFl && newFl) {
          items.push({
            field: 'floors',
            label: `[${flName}] Thêm tầng khảo sát mới`,
            oldValue: 'Chưa có',
            newValue: flName,
          });
          continue;
        }
        if (oldFl && !newFl) {
          items.push({
            field: 'floors',
            label: `[${flName}] Xóa tầng khảo sát`,
            oldValue: flName,
            newValue: 'Đã xóa',
          });
          continue;
        }
        if (!oldFl || !newFl) continue;

        // 1. Góc xoay CAD
        const oldCadRot = Number(oldFl.cadSketchRotation ?? 0);
        const newCadRot = Number(newFl.cadSketchRotation ?? 0);
        if (oldCadRot !== newCadRot) {
          items.push({
            field: 'floors',
            label: `[${flName}] Góc xoay bản vẽ CAD`,
            oldValue: `${oldCadRot}°`,
            newValue: `${newCadRot}°`,
          });
        }

        // 2. Ghim Vùng Z trên CAD_Z
        const oldZPins = Array.isArray(oldFl.cadZonePins) ? (oldFl.cadZonePins as Array<Record<string, unknown>>) : [];
        const newZPins = Array.isArray(newFl.cadZonePins) ? (newFl.cadZonePins as Array<Record<string, unknown>>) : [];
        if (JSON.stringify(oldZPins) !== JSON.stringify(newZPins)) {
          const movedZPins: string[] = [];
          newZPins.forEach((np) => {
            const code = String(np.zoneCode || np.zone_code || '');
            const op = oldZPins.find((p) => String(p.zoneCode || p.zone_code || '') === code);
            if (!op) {
              items.push({
                field: 'floors',
                label: `[${flName} • CAD_Z] Thêm điểm ghim ${code}`,
                oldValue: 'Chưa ghim',
                newValue: `(${np.pinX ?? np.pin_x}%, ${np.pinY ?? np.pin_y}%)`,
              });
            } else {
              const ox = Number(op.pinX ?? op.pin_x ?? 50);
              const oy = Number(op.pinY ?? op.pin_y ?? 50);
              const nx = Number(np.pinX ?? np.pin_x ?? 50);
              const ny = Number(np.pinY ?? np.pin_y ?? 50);
              if (Math.abs(ox - nx) > 0.1 || Math.abs(oy - ny) > 0.1) {
                movedZPins.push(`${code}: (${ox}%, ${oy}%) → (${nx}%, ${ny}%)`);
              }
            }
          });
          if (movedZPins.length === 1) {
            const parts = movedZPins[0].split(': ');
            const coords = parts[1].split(' → ');
            items.push({
              field: 'floors',
              label: `[${flName} • CAD_Z] Tọa độ ghim ${parts[0]}`,
              oldValue: coords[0],
              newValue: coords[1],
            });
          } else if (movedZPins.length > 1) {
            items.push({
              field: 'floors',
              label: `[${flName} • CAD_Z] Chuyển vị ${movedZPins.length} điểm ghim Vùng Z`,
              oldValue: `${movedZPins.length} điểm ghim gốc`,
              newValue: movedZPins.slice(0, 3).join('; ') + (movedZPins.length > 3 ? ` (+${movedZPins.length - 3} ghim)` : ''),
            });
          }
        }

        // 3. Ghim Cấu kiện E trên CAD_E
        const oldEPins = Array.isArray(oldFl.cadElementPins) ? (oldFl.cadElementPins as Array<Record<string, unknown>>) : [];
        const newEPins = Array.isArray(newFl.cadElementPins) ? (newFl.cadElementPins as Array<Record<string, unknown>>) : [];
        if (JSON.stringify(oldEPins) !== JSON.stringify(newEPins)) {
          const movedEPins: string[] = [];
          newEPins.forEach((np) => {
            const code = String(np.zoneCode || np.zone_code || '');
            const op = oldEPins.find((p) => String(p.zoneCode || p.zone_code || '') === code);
            if (!op) {
              items.push({
                field: 'floors',
                label: `[${flName} • CAD_E] Thêm điểm ghim ${code}`,
                oldValue: 'Chưa ghim',
                newValue: `(${np.pinX ?? np.pin_x}%, ${np.pinY ?? np.pin_y}%)`,
              });
            } else {
              const ox = Number(op.pinX ?? op.pin_x ?? 50);
              const oy = Number(op.pinY ?? op.pin_y ?? 50);
              const nx = Number(np.pinX ?? np.pin_x ?? 50);
              const ny = Number(np.pinY ?? np.pin_y ?? 50);
              if (Math.abs(ox - nx) > 0.1 || Math.abs(oy - ny) > 0.1) {
                movedEPins.push(`${code}: (${ox}%, ${oy}%) → (${nx}%, ${ny}%)`);
              }
            }
          });
          if (movedEPins.length > 0) {
            items.push({
              field: 'floors',
              label: `[${flName} • CAD_E] Chuyển vị ${movedEPins.length} điểm ghim Cấu kiện E`,
              oldValue: `${movedEPins.length} điểm ghim gốc`,
              newValue: movedEPins.slice(0, 3).join('; ') + (movedEPins.length > 3 ? ` (+${movedEPins.length - 3} ghim)` : ''),
            });
          }
        }

        // 4. Vùng Z & Khuyết tật D trong Z
        const oldZones = Array.isArray(oldFl.zones) ? (oldFl.zones as Array<Record<string, unknown>>) : [];
        const newZones = Array.isArray(newFl.zones) ? (newFl.zones as Array<Record<string, unknown>>) : [];
        newZones.forEach((nz) => {
          const zCode = String(nz.zoneCode || nz.zone_code || 'Z');
          const oz = oldZones.find(
            (z) => (z.id && z.id === nz.id) || String(z.zoneCode || z.zone_code || '') === zCode
          );
          if (!oz) {
            items.push({
              field: 'floors',
              label: `[${flName} • ${zCode}] Thêm mới Vùng kiến trúc`,
              oldValue: 'Chưa có',
              newValue: `${zCode} (${String(nz.roomName || 'Không gian mới')})`,
            });
            return;
          }
          const wasDel = Boolean(oz.isDeleted || oz.is_deleted);
          const isDel = Boolean(nz.isDeleted || nz.is_deleted);
          if (wasDel !== isDel) {
            items.push({
              field: 'floors',
              label: `[${flName} • ${zCode}] Trạng thái Vùng kiến trúc`,
              oldValue: wasDel ? 'Đã xóa' : 'Đang hoạt động',
              newValue: isDel ? 'Đã xóa mềm' : 'Khôi phục hoạt động',
            });
            return;
          }
          const zoneFields: Array<{ k: string; l: string }> = [
            { k: 'roomName', l: 'Tên phòng' },
            { k: 'componentType', l: 'Loại cấu kiện' },
            { k: 'wallMaterial', l: 'Vật liệu tường' },
            { k: 'notes', l: 'Ghi chú vùng' },
          ];
          zoneFields.forEach(({ k, l }) => {
            if (String(oz[k] ?? '') !== String(nz[k] ?? '')) {
              items.push({
                field: 'floors',
                label: `[${flName} • ${zCode}] ${l}`,
                oldValue: oz[k] || '(Trống)',
                newValue: nz[k] || '(Trống)',
              });
            }
          });

          const oldDefs = Array.isArray(oz.defects) ? (oz.defects as Array<Record<string, unknown>>) : [];
          const newDefs = Array.isArray(nz.defects) ? (nz.defects as Array<Record<string, unknown>>) : [];
          newDefs.forEach((nd) => {
            const dCode = String(nd.defectCode || nd.defect_code || 'D');
            const od = oldDefs.find(
              (d) => (d.id && d.id === nd.id) || String(d.defectCode || d.defect_code || '') === dCode
            );
            if (!od) {
              items.push({
                field: 'floors',
                label: `[${flName} • ${zCode} • ${dCode}] Thêm khuyết tật mới`,
                oldValue: 'Chưa có',
                newValue: `${String(nd.defectType || 'Vết nứt')} (Rộng ${nd.widthMaxMm ?? 0}mm)`,
              });
              return;
            }
            const dWasDel = Boolean(od.isDeleted || od.is_deleted);
            const dIsDel = Boolean(nd.isDeleted || nd.is_deleted);
            if (dWasDel !== dIsDel) {
              items.push({
                field: 'floors',
                label: `[${flName} • ${zCode} • ${dCode}] Trạng thái khuyết tật`,
                oldValue: dWasDel ? 'Đã xóa' : 'Đang hiển thị',
                newValue: dIsDel ? 'Đã xóa mềm' : 'Khôi phục',
              });
              return;
            }
            const ox = Number(od.pinX ?? od.pin_x ?? 50);
            const oy = Number(od.pinY ?? od.pin_y ?? 50);
            const nx = Number(nd.pinX ?? nd.pin_x ?? 50);
            const ny = Number(nd.pinY ?? nd.pin_y ?? 50);
            if (Math.abs(ox - nx) > 0.1 || Math.abs(oy - ny) > 0.1) {
              items.push({
                field: 'floors',
                label: `[${flName} • ${zCode} • ${dCode}] Tọa độ ghim trên ảnh CTX`,
                oldValue: `(${ox}%, ${oy}%)`,
                newValue: `(${nx}%, ${ny}%)`,
              });
            }
            const defFields: Array<{ k: string; l: string; unit?: string }> = [
              { k: 'defectType', l: 'Loại khuyết tật' },
              { k: 'widthMaxMm', l: 'Bề rộng vết nứt', unit: ' mm' },
              { k: 'lengthMm', l: 'Chiều dài vết nứt', unit: ' mm' },
              { k: 'notes', l: 'Ghi chú khuyết tật' },
            ];
            defFields.forEach(({ k, l, unit = '' }) => {
              if (String(od[k] ?? '') !== String(nd[k] ?? '')) {
                items.push({
                  field: 'floors',
                  label: `[${flName} • ${zCode} • ${dCode}] ${l}`,
                  oldValue: od[k] !== undefined && od[k] !== '' ? `${od[k]}${unit}` : '(Trống)',
                  newValue: nd[k] !== undefined && nd[k] !== '' ? `${nd[k]}${unit}` : '(Trống)',
                });
              }
            });
          });
        });

        // 5. Cấu kiện E & Khuyết tật D trong E
        const oldElems = Array.isArray(oldFl.structuralElements) ? (oldFl.structuralElements as Array<Record<string, unknown>>) : [];
        const newElems = Array.isArray(newFl.structuralElements) ? (newFl.structuralElements as Array<Record<string, unknown>>) : [];
        newElems.forEach((ne) => {
          const eCode = String(ne.elementCode || ne.element_code || 'E');
          const oe = oldElems.find(
            (e) => (e.id && e.id === ne.id) || String(e.elementCode || e.element_code || '') === eCode
          );
          if (!oe) {
            items.push({
              field: 'floors',
              label: `[${flName} • ${eCode}] Thêm mới Cấu kiện kết cấu`,
              oldValue: 'Chưa có',
              newValue: `${eCode} (${String(ne.elementType || 'BTCT')})`,
            });
            return;
          }
          const eWasDel = Boolean(oe.isDeleted || oe.is_deleted);
          const eIsDel = Boolean(ne.isDeleted || ne.is_deleted);
          if (eWasDel !== eIsDel) {
            items.push({
              field: 'floors',
              label: `[${flName} • ${eCode}] Trạng thái Cấu kiện kết cấu`,
              oldValue: eWasDel ? 'Đã xóa' : 'Đang hoạt động',
              newValue: eIsDel ? 'Đã xóa mềm' : 'Khôi phục',
            });
            return;
          }
          const elemFields: Array<{ k: string; l: string }> = [
            { k: 'elementType', l: 'Loại cấu kiện' },
            { k: 'materialType', l: 'Vật liệu kết cấu' },
            { k: 'roomName', l: 'Vị trí trục' },
          ];
          elemFields.forEach(({ k, l }) => {
            if (String(oe[k] ?? '') !== String(ne[k] ?? '')) {
              items.push({
                field: 'floors',
                label: `[${flName} • ${eCode}] ${l}`,
                oldValue: oe[k] || '(Trống)',
                newValue: ne[k] || '(Trống)',
              });
            }
          });

          const oldEDefs = Array.isArray(oe.defects) ? (oe.defects as Array<Record<string, unknown>>) : [];
          const newEDefs = Array.isArray(ne.defects) ? (ne.defects as Array<Record<string, unknown>>) : [];
          newEDefs.forEach((nd) => {
            const dCode = String(nd.defectCode || nd.defect_code || 'D');
            const od = oldEDefs.find(
              (d) => (d.id && d.id === nd.id) || String(d.defectCode || d.defect_code || '') === dCode
            );
            if (!od) {
              items.push({
                field: 'floors',
                label: `[${flName} • ${eCode} • ${dCode}] Thêm khuyết tật kết cấu`,
                oldValue: 'Chưa có',
                newValue: `${String(nd.defectType || 'Vết nứt BTCT')} (Rộng ${nd.widthMaxMm ?? 0}mm)`,
              });
              return;
            }
            const ox = Number(od.pinX ?? od.pin_x ?? 50);
            const oy = Number(od.pinY ?? od.pin_y ?? 50);
            const nx = Number(nd.pinX ?? nd.pin_x ?? 50);
            const ny = Number(nd.pinY ?? nd.pin_y ?? 50);
            if (Math.abs(ox - nx) > 0.1 || Math.abs(oy - ny) > 0.1) {
              items.push({
                field: 'floors',
                label: `[${flName} • ${eCode} • ${dCode}] Tọa độ ghim trên ảnh CTX`,
                oldValue: `(${ox}%, ${oy}%)`,
                newValue: `(${nx}%, ${ny}%)`,
              });
            }
          });
        });
      }

      if (items.length === 0) {
        items.push({
          field: 'floors',
          label: fallbackLabel || 'Cập nhật dữ liệu Tầng / Vùng Z / Cấu kiện E',
          oldValue: `${oldFloors.length} tầng khảo sát (Trạng thái gốc)`,
          newValue: `${newFloors.length} tầng khảo sát (Đã chuẩn hóa)`,
        });
      }
      return items;
    };

    Object.entries(dirtyFieldsRef.current).forEach(([k, v]) => {
      if (k === 'studioEnhancedPhotos' || k === 'studioEnhancedByOriginal') {
        const enhancedMap = (v.newValue && typeof v.newValue === 'object' ? v.newValue : {}) as Record<string, any>;
        Object.values(enhancedMap).forEach((info: any) => {
          if (!info || !info.enhancedUrl) return;
          diffItems.push({
            field: `studio_${info.photoCode || 'photo'}_${info.enhancedUrl.slice(-12)}`,
            label: `[Studio Img • ${info.presetUsed || 'Hiệu chỉnh'}] ${info.title || info.photoCode || 'Ảnh hiện trường'}`,
            oldValue: info.originalUrl || info.previousUrl || 'Ảnh gốc KSV',
            newValue: info.enhancedUrl,
            isPhoto: true,
          });
        });
      } else if (k === 'photoRotations') {
        const oldRots = (v.oldValue && typeof v.oldValue === 'object' ? v.oldValue : {}) as Record<string, number>;
        const newRots = (v.newValue && typeof v.newValue === 'object' ? v.newValue : {}) as Record<string, number>;
        const allKeys = Array.from(new Set([...Object.keys(oldRots), ...Object.keys(newRots)]));
        let addedCount = 0;
        allKeys.forEach((rk) => {
          const oDeg = Number(oldRots[rk] ?? 0);
          const nDeg = Number(newRots[rk] ?? 0);
          if (oDeg !== nDeg) {
            addedCount++;
            diffItems.push({
              field: `photoRotations.${rk}`,
              label: `Xoay hướng ảnh A4 — ${formatPhotoRotationKeyLabel(rk)}`,
              oldValue: `${oDeg}° (Gốc)`,
              newValue: `${nDeg}° (Đã xoay chuẩn A4)`,
              isPhoto: true,
            });
          }
        });
        if (addedCount === 0) {
          diffItems.push({
            field: k,
            label: v.label,
            oldValue: '0° (Mặc định)',
            newValue: 'Đã đồng bộ hướng ảnh chuẩn A4',
            isPhoto: true,
          });
        }
      } else if (k === 'floors') {
        diffItems.push(...expandFloorsDiff(v.oldValue, v.newValue, v.label));
      } else {
        diffItems.push({
          field: k,
          label: v.label,
          oldValue: v.oldValue,
          newValue: v.newValue,
        });
      }
    });

    const updatesPayload: Record<string, unknown> = {};
    let hasScoringKeyChanged = false;

    Object.keys(dirtyFieldsRef.current).forEach((k) => {
      const topKey = k.includes('.') ? k.split('.')[0] : k;
      updatesPayload[topKey] = formStateRef.current[topKey];
      if (topKey === 'floors' || topKey === 'damageZones') {
        updatesPayload.burlandSummary = formStateRef.current.burlandSummary;
      }
      if (topKey === 'metroOffsetDistance' || topKey === 'manualMetroDistanceM') {
        updatesPayload.clearanceOffsetDistance = formStateRef.current.clearanceOffsetDistance;
      }
      if (STEP_1_TO_5_SCORING_KEYS.has(topKey) || topKey === 'ecs' || topKey === 'vi' || topKey === 'executiveSummary') {
        hasScoringKeyChanged = true;
      }
    });

    // Luôn đính kèm các chỉ số dẫn xuất đã tính lại (burlandSummary, ecs, vi, executiveSummary) nếu có thay đổi
    const derivedKeys = ['burlandSummary', 'ecs', 'vi', 'executiveSummary'] as const;
    for (const dKey of derivedKeys) {
      if (
        hasScoringKeyChanged ||
        JSON.stringify(formStateRef.current[dKey]) !== JSON.stringify(originalStateRef.current[dKey])
      ) {
        updatesPayload[dKey] = formStateRef.current[dKey];
      }
    }

    if (updatesPayload.executiveSummary && typeof updatesPayload.executiveSummary === 'object') {
      updatesPayload.executiveSummary = {
        ...(updatesPayload.executiveSummary as Record<string, unknown>),
        isImpactOverridden: Boolean(dirtyFieldsRef.current['executiveSummary.constructionImpactStatus']),
        isBraOverridden: Boolean(dirtyFieldsRef.current['executiveSummary.braStatus']),
      };
    }

    return { diffItems, updatesPayload };
  }, []);

  // Open review and diff modal
  const handleReviewSave = () => {
    const { diffItems, updatesPayload } = getDiffPayload();
    onOpenDiffModal(diffItems, updatesPayload);
  };

  const programmaticScrollLockUntilRef = useRef<number>(0);

  const scrollToStep = useCallback((id: string) => {
    programmaticScrollLockUntilRef.current = Date.now() + 900;
    setActiveNavStep(id);
    if (id !== 'step-4') {
      setActiveSubNavId('');
    }
    const container = document.getElementById('audit-studio-scroll-container');
    const element = document.getElementById(id);
    if (container && element) {
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const offsetTop = Math.max(0, elementRect.top - containerRect.top + container.scrollTop - 16);
      container.scrollTo({ top: offsetTop, behavior: 'smooth' });
    } else if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const scrollToSubElement = useCallback((domId: string, parentStepId: string = 'step-4') => {
    programmaticScrollLockUntilRef.current = Date.now() + 900;
    setActiveNavStep(parentStepId);
    setActiveSubNavId(domId);
    const container = document.getElementById('audit-studio-scroll-container');
    const target = document.getElementById(domId);
    if (container && target) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const stickyOffset = parentStepId === 'step-4' ? 60 : 16;
      const offsetTop = Math.max(0, targetRect.top - containerRect.top + container.scrollTop - stickyOffset);
      container.scrollTo({ top: offsetTop, behavior: 'smooth' });
    } else if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Scrollspy 2 cấp: Tự động highlight cả Step chính (step-1..9) và Mục con Bước 4 (CAD_Z, Z, CAD_E, E)
  useEffect(() => {
    const container = document.getElementById('audit-studio-scroll-container');
    if (!container) return;

    const stepIds = [
      'step-1',
      'step-2',
      'step-3',
      'step-4',
      'step-5',
      'step-6',
      'step-7',
      'step-8',
      'step-9',
    ];

    let ticking = false;
    const handleScroll = () => {
      if (Date.now() < programmaticScrollLockUntilRef.current) {
        return;
      }
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (Date.now() < programmaticScrollLockUntilRef.current) {
            ticking = false;
            return;
          }
          const containerRect = container.getBoundingClientRect();
          let currentStep = stepIds[0];

          for (const sId of stepIds) {
            const el = document.getElementById(sId);
            if (el) {
              const elRect = el.getBoundingClientRect();
              if (elRect.top - containerRect.top <= 140) {
                currentStep = sId;
              }
            }
          }
          setActiveNavStep(currentStep);

          // Nếu đang trong Bước 4, tìm phân đoạn con (CAD_Z / Z / CAD_E / E) đang ở trong tầm nhìn
          if (currentStep === 'step-4') {
            const subNodes = container.querySelectorAll<HTMLElement>('[id^="step-4-floor-"]');
            let matchedSubId = '';
            subNodes.forEach((node) => {
              const nRect = node.getBoundingClientRect();
              if (nRect.top - containerRect.top <= 160) {
                matchedSubId = node.id;
              }
            });
            setActiveSubNavId(matchedSubId);
          } else {
            setActiveSubNavId('');
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const dirtyCount = Object.keys(dirtyFields).length;

  return {
    isEditMode,
    setIsEditMode,
    activeNavStep,
    activeSubNavId,
    setActiveSubNavId,
    scrollToStep,
    scrollToSubElement,
    formState,
    dirtyFields,
    dirtyCount,
    isFieldDirty,
    handleFieldChange,
    handleNestedFieldChange,
    handleApplySyncedGeometry,
    handleDiscard,
    discardDiffItem,
    handleReviewSave,
    getDiffPayload,
  };
};
