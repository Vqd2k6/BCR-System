import { useState, useEffect } from 'react';

export interface DiffItem {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
}

export interface UseAuditStepwiseFormParams {
  data: any;
  onOpenDiffModal: (diffItems: DiffItem[], updates: Record<string, any>) => void;
}

export const useAuditStepwiseForm = ({ data, onOpenDiffModal }: UseAuditStepwiseFormParams) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeNavStep, setActiveNavStep] = useState<string>('step-1');

  // Form state & Dirty fields tracker
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [originalState, setOriginalState] = useState<Record<string, any>>({});
  const [dirtyFields, setDirtyFields] = useState<Record<string, { label: string; oldValue: any; newValue: any }>>({});

  // Sync initial data from incoming props
  useEffect(() => {
    if (!data) return;
    const sJson = data.surveyJson || data.survey_data_json || {};
    const bSpecs = data.leftPane?.buildingSpecs || data.buildingSpecs || {};
    const defState = data.leftPane?.deformation || data.deformation || {};
    const hiState = sJson.historyInterview || data.leftPane?.interview || data.historyInterview || {};
    const sigState = data.leftPane?.signatures || sJson.signatures || {};

    const initial: Record<string, any> = {
      // Step 1: Identification & General Specs
      projectParcelCode: data.projectParcelCode || sJson.projectParcelCode || '',
      houseNumber: data.houseNumber || sJson.houseNumber || '',
      street: data.street || sJson.street || '',
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

      // Spatial & GPS calculations (Allow manual override)
      metroOffsetDistance: sJson.metroOffsetDistance !== undefined ? String(sJson.metroOffsetDistance) : (data.metroOffsetDistance !== undefined ? String(data.metroOffsetDistance) : ''),
      clearanceOffsetDistance: sJson.clearanceOffsetDistance !== undefined ? String(sJson.clearanceOffsetDistance) : (data.clearanceOffsetDistance !== undefined ? String(data.clearanceOffsetDistance) : ''),
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

      // Step 5: Tilt & Settlement
      settlementTilt: sJson.settlementTilt || defState || {},

      // Step 6: Scope & GIS
      surveyScope: sJson.surveyScope || {},
      accessLimitation: sJson.accessLimitation || {},
      gisMutationConfirmed: sJson.gisMutationConfirmed || {},

      // Step 7: Technical Scores & Completeness Gate
      ecs: sJson.ecs || {},
      vi: sJson.vi || {},
      gateDecision: sJson.gateDecision || { decision: 'ALLOW', reason: '' },

      // Step 8: Conclusions & BRA
      executiveSummary: sJson.executiveSummary || {
        braStatus: data.braStatus,
        summaryConclusions: data.summaryConclusions,
        recommendations: data.engineeringRecommendations,
      },

      // Step 9: Signatures & Absence
      signatures: {
        surveyorSignature: sigState.surveyorSignature || sigState.preparedBy?.photoUrl || data.surveyorSignatureUrl || null,
        surveyorName: sigState.surveyorName || sigState.preparedBy?.fullName || data.surveyorName || '',
        ownerSignature: sigState.ownerSignature || sigState.ownerRepresentative?.photoUrl || data.ownerSignatureUrl || null,
        ownerName: sigState.ownerName || sigState.ownerRepresentative?.fullName || data.ownerName || sJson.ownerName || '',
        ownerFeedback: sigState.ownerFeedback || sigState.ownerRemarks || data.ownerRemarks || '',
        workingMinutesPhotos: sigState.workingMinutesPhotos || [],
      },
      absenceLogs: data.leftPane?.absenceLogs || [],
    };

    setFormState(initial);
    setOriginalState(initial);
    setDirtyFields({});
  }, [data]);

  // Handle direct field change
  const handleFieldChange = (fieldKey: string, label: string, val: any) => {
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
  const handleNestedFieldChange = (parentKey: string, childKey: string, label: string, val: any) => {
    const parentObj = formState[parentKey] || {};
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

    const updatesPayload: Record<string, any> = {};
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
