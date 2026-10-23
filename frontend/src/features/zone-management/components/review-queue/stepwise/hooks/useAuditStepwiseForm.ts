import { useState, useEffect } from 'react';
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
]);

function recomputeDerivedPhase1State(
  nextState: Record<string, unknown>,
  changedTopKey: string
): Record<string, unknown> {
  const updated = { ...nextState };

  // 1. Nếu sửa floors / damageZones -> tự động đồng bộ burlandSummary theo chuẩn Step4_BurlandSummary.tsx
  if (changedTopKey === 'floors' || changedTopKey === 'damageZones') {
    const floors = Array.isArray(updated.floors) ? (updated.floors as any[]) : [];
    const curBs = ((updated.burlandSummary as Record<string, unknown>) || {}) as Record<string, unknown>;
    let totalDefectsCount = 0;
    const zCrackGrades: Array<{ grade: number; zoneCode: string }> = [];

    floors.forEach((f) => {
      (f.zones || []).forEach((z: any) => {
        if (z.isDeleted || z.is_deleted) return;
        const activeDefects = (z.defects || []).filter((d: any) => !d.isDeleted && !d.is_deleted);
        totalDefectsCount += activeDefects.length;
        activeDefects.forEach((d: any) => {
          if (isCrackRelated(d.screeningCategory, d.defectType)) {
            zCrackGrades.push({
              grade: getBurlandGradeFromWidth(Number(d.widthMaxMm ?? d.width_max_mm) || 0),
              zoneCode: z.zoneCode || 'Z-01',
            });
          }
        });
      });
      (f.structuralElements || []).forEach((e: any) => {
        if (e.isDeleted || e.is_deleted) return;
        const activeDefects = (e.defects || []).filter((d: any) => !d.isDeleted && !d.is_deleted);
        totalDefectsCount += activeDefects.length;
      });
    });

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
    const phase1Input: Partial<Phase1SurveyFormData> = {
      ...(updated as unknown as Partial<Phase1SurveyFormData>),
      constructionYear:
        updated.constructionYear !== undefined && updated.constructionYear !== ''
          ? Number(updated.constructionYear)
          : undefined,
      foundationCatScore:
        updated.foundationCatScore !== undefined && updated.foundationCatScore !== null && updated.foundationCatScore !== ''
          ? (Number(updated.foundationCatScore) as 0 | 1 | 2 | 3 | 4 | 5)
          : 0,
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
    const autoImpact = calculateConstructionImpact(
      (updated.objectGroup as string) || 'GENERAL',
      updated.clearanceOffsetDistance as string,
      (updated.manualMetroDistanceM || updated.metroOffsetDistance) as string
    );
    const curImpactStr = String(curExec.constructionImpactStatus || autoImpact.label);
    const effectiveICode = (
      ['metroOffsetDistance', 'clearanceOffsetDistance', 'manualMetroDistanceM', 'objectGroup'].includes(changedTopKey)
        ? autoImpact.code
        : curImpactStr.startsWith('I4')
          ? 'I4'
          : curImpactStr.startsWith('I3')
            ? 'I3'
            : curImpactStr.startsWith('I2')
              ? 'I2'
              : 'I1'
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
      ...(changedTopKey === 'metroOffsetDistance' || changedTopKey === 'clearanceOffsetDistance' || changedTopKey === 'manualMetroDistanceM'
        ? { constructionImpactStatus: autoImpact.label }
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

  // Form state & Dirty fields tracker
  const [formState, setFormState] = useState<Record<string, unknown>>({});
  const [originalState, setOriginalState] = useState<Record<string, unknown>>({});
  const [dirtyFields, setDirtyFields] = useState<Record<string, { label: string; oldValue: unknown; newValue: unknown }>>({});

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

    if (data.cadastralGeojson || data.cadastral_geojson || data.coordinates || data.parcelCoordinates) {
      try {
        let pCoords: [number, number][] = [];
        const rawGeo = data.cadastralGeojson || data.cadastral_geojson;
        if (rawGeo) {
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
          if (!defaultMetroDist) defaultMetroDist = metrics.distanceToCenterlineMeters.toFixed(1);
          // Nếu nhà ga cán qua / cắt xén thửa đất, khoảng cách bao ngoài bắt buộc là 0.0m
          if (!defaultClearanceDist || metrics.isStationIntersectsParcel) {
            defaultClearanceDist = metrics.distanceToOuterBoundaryMeters.toFixed(1);
          }
        }
      } catch (e) {
        console.warn('Error calculating fallback spatial metrics in useAuditStepwiseForm:', e);
      }
    }

    const rawGps = sJson.gpsCoords || (typeof data.coordinates === 'object' && data.coordinates !== null && !Array.isArray(data.coordinates) ? (data.coordinates as { latitude?: number; lat?: number; longitude?: number; lng?: number; accuracy?: number }) : {});
    const coordArray = Array.isArray(data.coordinates) ? data.coordinates : null;
    const latInit = rawGps.latitude ?? rawGps.lat ?? (coordArray && typeof coordArray[0] === 'number' ? coordArray[0] : 10.79241);
    const lngInit = rawGps.longitude ?? rawGps.lng ?? (coordArray && typeof coordArray[1] === 'number' ? coordArray[1] : 106.71152);
    const accInit = rawGps.accuracy ?? 3.5;

    const initial: Record<string, unknown> = {
      // Step 1: Identification & General Specs
      projectParcelCode: data.projectParcelCode || sJson.projectParcelCode || '',
      houseNumber: data.houseNumber || sJson.houseNumber || '',
      street: data.street || sJson.street || '',
      ward: data.ward || sJson.ward || 'Phường 5',
      district: data.district || sJson.district || 'Quận Tân Bình',
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
      vacantLandNotes: sJson.vacantLandNotes || '',
      constructionStageNotes: sJson.constructionStageNotes || '',
      unitCode: data.unitCode || sJson.unitCode || '',
      unitFloorNumber: data.unitFloorNumber || sJson.unitFloorNumber || '',
      managementContactName: sJson.managementContactName || '',
      managementContactPhone: sJson.managementContactPhone || '',

      // Spatial & GPS calculations (Allow manual override)
      gpsCoords: { lat: Number(latInit), lng: Number(lngInit), accuracy: Number(accInit) },
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
      foundationCatScore: sJson.foundationCatScore !== undefined ? sJson.foundationCatScore : (bSpecs.foundation_category ? 3 : null),
      foundationDepthM: sJson.foundationDepthM !== undefined ? sJson.foundationDepthM : (bSpecs.foundationDepthM ?? bSpecs.foundation_depth_m ?? ''),
      foundationDensity: sJson.foundationDensity !== undefined ? sJson.foundationDensity : (bSpecs.foundationDensity ?? bSpecs.foundation_density ?? ''),
      foundationSpacingM: sJson.foundationSpacingM !== undefined ? sJson.foundationSpacingM : (bSpecs.foundationSpacingM ?? bSpecs.foundation_spacing_m ?? ''),
      pileDimensionMm: sJson.pileDimensionMm || (sJson.pileWidthMm && sJson.pileLengthMm ? `${sJson.pileWidthMm} x ${sJson.pileLengthMm} cm` : ''),
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
          xPermille: sJson.settlementTilt?.buildingTilt?.xPermille ?? defState.tilt_x_permille ?? 0,
          yPermille: sJson.settlementTilt?.buildingTilt?.yPermille ?? defState.tilt_y_permille ?? 0,
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
          level: sJson.settlementTilt?.beamSagging?.level ?? defState.beam_sagging_level ?? 0,
          sagMm: sJson.settlementTilt?.beamSagging?.sagMm ?? defState.beam_sagging_mm ?? '',
          position: sJson.settlementTilt?.beamSagging?.position || defState.beam_sagging_position || '',
          description: sJson.settlementTilt?.beamSagging?.description || defState.beam_sagging_description || '',
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

      // Step 8: Conclusions & BRA
      executiveSummary: sJson.executiveSummary || {
        braStatus: data.braStatus || 'LOW',
        constructionImpactStatus: 'I1 (Tác động rất nhẹ)',
        keyRisksDefectsText: '',
        specificRecommendationsText: data.engineeringRecommendations || '',
        summaryConclusions: data.summaryConclusions || '',
      },
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
      absenceLogs: data.leftPane?.absenceLogs || [],
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
  const getDeepVal = (obj: Record<string, unknown> | undefined, path: string[]): unknown => {
    return path.reduce<unknown>(
      (curr, p) => (curr && typeof curr === 'object' ? (curr as Record<string, unknown>)[p] : undefined),
      obj
    );
  };

  // Handle direct field change
  const handleFieldChange = (fieldKey: string, label: string, val: unknown) => {
    setFormState((prev) => recomputeDerivedPhase1State({ ...prev, [fieldKey]: val }, fieldKey));

    const originalVal = originalState[fieldKey];
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
  };

  /**
   * Đồng bộ Ranh đất PostGIS & Cự ly Metro (Ràng buộc 02 - /grill-me):
   * CHỈ cập nhật parcelCoordinates, metroOffsetDistance, clearanceOffsetDistance.
   * Tuyệt đối KHÔNG ghi đè landAreaM2, constructionAreaM2, frontageWidth, lotDepth.
   */
  const handleApplySyncedGeometry = (
    newCoords: [number, number][],
    newMetroDist: string,
    newClearanceDist: string
  ) => {
    if (!isEditMode) {
      setIsEditMode(true);
    }
    handleFieldChange('parcelCoordinates', 'Tọa độ đa giác ranh thửa (PostGIS GPMB)', newCoords);
    handleFieldChange('metroOffsetDistance', 'Cự ly tim hầm Metro (m)', newMetroDist);
    handleFieldChange('clearanceOffsetDistance', 'Cự ly đường bao ngoài / mép ga (m)', newClearanceDist);
    if (formState.keepKsvBoundaryConfirmed) {
      handleFieldChange('keepKsvBoundaryConfirmed', 'Xác nhận giữ ranh KSV thực địa', false);
    }
  };

  // Handle nested object field change (supports dot-paths e.g. 'diffSettlement.level')
  const handleNestedFieldChange = (parentKey: string, childKey: string, label: string, val: unknown) => {
    setFormState((prev) => {
      const parentObj = (prev[parentKey] as Record<string, unknown>) || {};
      let updatedParent: Record<string, unknown>;

      if (childKey.includes('.')) {
        const parts = childKey.split('.');
        const copy = JSON.parse(JSON.stringify(parentObj));
        let cur = copy;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') {
            cur[parts[i]] = {};
          }
          cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = val;
        updatedParent = copy;
      } else {
        updatedParent = { ...parentObj, [childKey]: val };
      }

      return recomputeDerivedPhase1State({ ...prev, [parentKey]: updatedParent }, parentKey);
    });

    const dirtyKey = `${parentKey}.${childKey}`;
    const origParent = (originalState[parentKey] as Record<string, unknown>) || {};
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
  };

  // Helper check if field or nested field is dirty
  const isFieldDirty = (fieldKey: string, subKey?: string): boolean => {
    if (subKey) {
      return Boolean(dirtyFields[`${fieldKey}.${subKey}`]);
    }
    if (dirtyFields[fieldKey]) return true;
    return Object.keys(dirtyFields).some((k) => k === fieldKey || k.startsWith(`${fieldKey}.`));
  };

  // Discard all changes
  const handleDiscard = (silent = false) => {
    if (silent || window.confirm('Bạn có chắc muốn hủy bỏ mọi thay đổi vừa chỉnh sửa?')) {
      setFormState(originalState);
      setDirtyFields({});
      setIsEditMode(false);
    }
  };

  // Discard a single diff item (revert field to original KSV state)
  const discardDiffItem = (fieldKey: string) => {
    if (fieldKey.includes('.')) {
      const parts = fieldKey.split('.');
      const parentKey = parts[0];
      const childPath = parts.slice(1);
      const origParent = (originalState[parentKey] as Record<string, unknown>) || {};
      const origVal = getDeepVal(origParent, childPath);

      setFormState((prev) => {
        const parentObj = (prev[parentKey] as Record<string, unknown>) || {};
        const copy = JSON.parse(JSON.stringify(parentObj));
        let cur = copy;
        for (let i = 0; i < childPath.length - 1; i++) {
          if (!cur[childPath[i]] || typeof cur[childPath[i]] !== 'object') {
            cur[childPath[i]] = {};
          }
          cur = cur[childPath[i]];
        }
        if (origVal === undefined) {
          delete cur[childPath[childPath.length - 1]];
        } else {
          cur[childPath[childPath.length - 1]] = origVal;
        }
        return { ...prev, [parentKey]: copy };
      });
    } else {
      setFormState((prev) => ({
        ...prev,
        [fieldKey]: originalState[fieldKey],
      }));
    }

    setDirtyFields((prev) => {
      const copy = { ...prev };
      delete copy[fieldKey];
      return copy;
    });
  };

  const getDiffPayload = () => {
    const diffItems: DiffItem[] = Object.entries(dirtyFields).map(([k, v]) => ({
      field: k,
      label: v.label,
      oldValue: v.oldValue,
      newValue: v.newValue,
    }));

    const updatesPayload: Record<string, unknown> = {};
    Object.keys(dirtyFields).forEach((k) => {
      const topKey = k.includes('.') ? k.split('.')[0] : k;
      updatesPayload[topKey] = formState[topKey];
      if (topKey === 'floors' || topKey === 'damageZones') {
        updatesPayload.burlandSummary = formState.burlandSummary;
      }
    });

    return { diffItems, updatesPayload };
  };

  // Open review and diff modal
  const handleReviewSave = () => {
    const { diffItems, updatesPayload } = getDiffPayload();
    onOpenDiffModal(diffItems, updatesPayload);
  };

  const scrollToStep = (id: string) => {
    setActiveNavStep(id);
    const container = document.getElementById('audit-studio-scroll-container');
    const element = document.getElementById(id);
    if (container && element) {
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const offsetTop = elementRect.top - containerRect.top + container.scrollTop - 16;
      container.scrollTo({ top: offsetTop, behavior: 'smooth' });
    } else if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Scrollspy: Tự động highlight step tương ứng trong Mục Lục khi người dùng cuộn
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
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const containerRect = container.getBoundingClientRect();
          let currentStep = stepIds[0];

          for (const sId of stepIds) {
            const el = document.getElementById(sId);
            if (el) {
              const elRect = el.getBoundingClientRect();
              // Khi phần đầu của step nằm cách đỉnh container không quá 140px
              if (elRect.top - containerRect.top <= 140) {
                currentStep = sId;
              }
            }
          }
          setActiveNavStep(currentStep);
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
    scrollToStep,
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
