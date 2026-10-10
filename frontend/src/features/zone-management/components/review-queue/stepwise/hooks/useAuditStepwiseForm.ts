import { useState, useEffect } from 'react';
import { calculateComprehensiveMetroSpatialMetrics } from '../../../../../survey-phase1/utils/metroSpatialCalculator';
import type {
  DiffItem,
  AuditStepwiseData,
  StepwiseSurveyJson,
  StepwiseBuildingSpecs,
  StepwiseDeformation,
  StepwiseSignatures,
} from '../types';

export type { DiffItem };

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
          photoUrl: sJson.settlementTilt?.abnormalCase?.photoUrl || defState.abnormal_photo_url || '',
          photoCode: sJson.settlementTilt?.abnormalCase?.photoCode || defState.abnormal_photo_code || 'ANOMALY_01',
          photos: Array.isArray(sJson.settlementTilt?.abnormalCase?.photos) && sJson.settlementTilt.abnormalCase.photos.length > 0
            ? sJson.settlementTilt.abnormalCase.photos
            : Array.isArray(defState.abnormal_photos_json) && defState.abnormal_photos_json.length > 0
            ? defState.abnormal_photos_json
            : (sJson.settlementTilt?.abnormalCase?.photoUrl || defState.abnormal_photo_url
              ? [{ url: sJson.settlementTilt?.abnormalCase?.photoUrl || defState.abnormal_photo_url, photoCode: sJson.settlementTilt?.abnormalCase?.photoCode || defState.abnormal_photo_code || 'ANOMALY_01' }]
              : []),
          notes: sJson.settlementTilt?.abnormalCase?.notes || defState.abnormal_notes || '',
        },
        dataSource: Array.isArray(sJson.settlementTilt?.dataSource) ? sJson.settlementTilt.dataSource : [],
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
    };

    setFormState(initial);
    setOriginalState(initial);
    setDirtyFields({});
  }, [data]);

  // Handle direct field change
  const handleFieldChange = (fieldKey: string, label: string, val: unknown) => {
    setFormState((prev) => ({ ...prev, [fieldKey]: val }));

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

  // Handle nested object field change (e.g. historyInterview.renovationLoad)
  const handleNestedFieldChange = (parentKey: string, childKey: string, label: string, val: unknown) => {
    const parentObj = (formState[parentKey] as Record<string, unknown>) || {};
    const updatedParent = { ...parentObj, [childKey]: val };
    handleFieldChange(parentKey, label, updatedParent);
  };

  // Discard all changes
  const handleDiscard = () => {
    if (window.confirm('Bạn có chắc muốn hủy bỏ mọi thay đổi vừa chỉnh sửa?')) {
      setFormState(originalState);
      setDirtyFields({});
      setIsEditMode(false);
    }
  };

  // Open review and diff modal
  const handleReviewSave = () => {
    const diffItems: DiffItem[] = Object.entries(dirtyFields).map(([k, v]) => ({
      field: k,
      label: v.label,
      oldValue: v.oldValue,
      newValue: v.newValue,
    }));

    const updatesPayload: Record<string, unknown> = {};
    Object.keys(dirtyFields).forEach((k) => {
      updatesPayload[k] = formState[k];
    });

    onOpenDiffModal(diffItems, updatesPayload);
  };

  const scrollToStep = (id: string) => {
    setActiveNavStep(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const dirtyCount = Object.keys(dirtyFields).length;

  return {
    isEditMode,
    setIsEditMode,
    activeNavStep,
    scrollToStep,
    formState,
    dirtyFields,
    dirtyCount,
    handleFieldChange,
    handleNestedFieldChange,
    handleDiscard,
    handleReviewSave,
  };
};
