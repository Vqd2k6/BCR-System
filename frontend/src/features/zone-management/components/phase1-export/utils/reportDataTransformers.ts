import type { EditFormData, EditFormDefectItem, ExportParcelItem } from '../types';

interface FloorDefectRaw {
  defectCode?: string;
  defectType?: string;
  crackDirection?: string;
  widthMaxMm?: number;
  lengthMm?: number;
  activityState?: string;
  notes?: string;
  [key: string]: unknown;
}

interface FloorZoneRaw {
  zoneCode?: string;
  notes?: string;
  burlandGrade?: number | string;
  defects?: FloorDefectRaw[];
  [key: string]: unknown;
}

interface FloorRaw {
  floorName?: string;
  zones?: FloorZoneRaw[];
  [key: string]: unknown;
}

interface DamageZoneDefectRaw {
  id?: string | number;
  defect_code?: string;
  defect_type?: string;
  crack_direction?: string;
  width_max_mm?: number;
  length_mm?: number;
  activity_state?: string;
  notes?: string;
  [key: string]: unknown;
}

interface DamageZoneRaw {
  zone_code?: string;
  floor_name?: string;
  notes?: string;
  burland_grade?: number | string;
  defects?: DamageZoneDefectRaw[];
  [key: string]: unknown;
}

export interface ServerReportData {
  id?: string;
  report_code?: string;
  official_cadastral_code?: string;
  survey_date?: string;
  surveyor_name?: string;
  surveyor_code?: string;
  zone_admin_name?: string;
  owner_name?: string;
  owner_phone?: string;
  house_number?: string;
  street?: string;
  summary_conclusions?: string;
  engineering_recommendations?: string;
  owner_remarks?: string;
  riskScores?: {
    totalEcsScore?: number;
    ecsClass?: string;
    totalViScore?: number;
    viClass?: string;
    finalBraRiskLevel?: string;
    burlandPredominantGrade?: number;
    burlandLocalMaxGrade?: number;
    structuralDefectFlag?: string;
    requiresPhase2?: boolean;
    requiresMonitoring?: boolean;
    requiresStructuralReview?: boolean;
    ecsE1?: number;
    ecsE2?: number;
    ecsE3?: number;
    ecsE4?: number;
    ecsE5?: number;
    ecsE6?: number;
    viV1?: number;
    viV2?: number;
    viV3?: number;
    viV4?: number;
    viV5?: number;
    viV6?: number;
    avgViScore?: number;
    constructionImpactLevelI?: number;
    buildingRiskAssessmentBra?: string;
    predictedSettlementSmax?: number;
    angularDistortion?: string;
    vibrationPpv?: number;
    braMandatoryAction?: string;
    [key: string]: unknown;
  };
  survey_data_json?: {
    reportCode?: string;
    officialCadastralCode?: string;
    surveyDate?: string;
    surveyorName?: string;
    surveyorCode?: string;
    zoneAdminName?: string;
    buildingName?: string;
    ownerName?: string;
    ownerPhone?: string;
    houseNumber?: string;
    street?: string;
    usageFunction?: string;
    aboveFloors?: number;
    undergroundFloors?: number;
    constructionYear?: number | string;
    isEstimatedYear?: boolean;
    constructionAreaM2?: number | string;
    buildingHeightM?: number | string;
    structureSystem?: string;
    chainage?: string;
    metroOffsetDistance?: string | number;
    surveyCaseType?: string;
    objectGroup?: string;
    foundationType?: string;
    foundationSource?: string;
    foundationDepthM?: number | string;
    pileDimensionMm?: string;
    pileLengthMm?: string;
    foundationCatScore?: number;
    foundationNotes?: string;
    adjacentBuildings?: {
      left?: { details?: string; note?: string };
      right?: { details?: string; note?: string };
      back?: { details?: string; note?: string };
    };
    accessLimitation?: {
      level?: string;
      restrictedAreas?: string;
      mainReason?: string;
      mitigationAction?: string;
    };
    historyInterview?: {
      renovationNotes?: string;
      renovationLoad?: boolean;
      majorRepairNotes?: string;
      majorRepair?: boolean;
      pastSettlementNotes?: string;
      pastSettlement?: boolean;
    };
    settlementTilt?: {
      buildingTilt?: { xPermille?: number | string; yPermille?: number | string; direction?: string; level?: number };
      diffSettlement?: { level?: number; position?: string };
      beamSagging?: { sagMm?: number | string; level?: number; position?: string };
      needAdditionalMonitoring?: { notes?: string };
    };
    burlandSummary?: {
      predominantGrade?: number;
      localMaxGrade?: number;
      governingZoneCode?: string;
      governingZoneDescription?: string;
      structuralFlagLevel?: string;
      representativeness?: string;
      needStructuralEngineerReview?: boolean;
    };
    burlandPredominantGrade?: number;
    burlandLocalMaxGrade?: number;
    structuralDefectFlag?: string;
    requiresStructuralReview?: boolean;
    riskScores?: {
      totalEcsScore?: number;
      ecsClass?: string;
      totalViScore?: number;
      viClass?: string;
      finalBraRiskLevel?: string;
      burlandPredominantGrade?: number;
      burlandLocalMaxGrade?: number;
      structuralDefectFlag?: string;
      requiresPhase2?: boolean;
      requiresMonitoring?: boolean;
      requiresStructuralReview?: boolean;
      ecsE1?: number;
      ecsE2?: number;
      ecsE3?: number;
      ecsE4?: number;
      ecsE5?: number;
      ecsE6?: number;
      viV1?: number;
      viV2?: number;
      viV3?: number;
      viV4?: number;
      viV5?: number;
      viV6?: number;
      avgViScore?: number;
      constructionImpactLevelI?: number;
      buildingRiskAssessmentBra?: string;
      predictedSettlementSmax?: number;
      angularDistortion?: string;
      vibrationPpv?: number;
      braMandatoryAction?: string;
      [key: string]: unknown;
    };
    ecs?: {
      e1?: number;
      e2?: number;
      e3?: number;
      e4?: number;
      e5?: number;
      e6?: number;
      totalEcs?: number;
      ecsClass?: string;
      engineeringJudgement?: { action?: string; reason?: string; [key: string]: unknown };
    };
    ecsE1?: number;
    ecsE2?: number;
    ecsE3?: number;
    ecsE4?: number;
    ecsE5?: number;
    ecsE6?: number;
    ecsTotalScore?: number;
    ecsClass?: string;
    vi?: {
      v1?: number;
      v2?: number;
      v3?: number;
      v4?: number;
      v5?: number;
      v6?: number;
      avgVi?: number;
      viAvg?: number;
      viClass?: string;
      engineeringJudgement?: { action?: string; reason?: string; [key: string]: unknown };
    };
    viV1?: number;
    viV2?: number;
    viV3?: number;
    viV4?: number;
    viV5?: number;
    viV6?: number;
    viAvgScore?: number;
    viClass?: string;
    bra?: {
      constructionImpactLevel?: number;
      buildingRiskBra?: string;
      predictedSettlementSmax?: number;
      angularDistortion?: string;
      vibrationPpv?: number;
      braMandatoryAction?: string;
    };
    constructionImpactLevel?: number;
    buildingRiskBra?: string;
    predictedSettlementSmax?: number;
    angularDistortion?: string;
    vibrationPpv?: number;
    braMandatoryAction?: string;
    gateDecision?: {
      decision?: string;
      reason?: string;
    };
    braStatus?: string;
    finalBraRiskLevel?: string;
    executiveSummary?: {
      keyRisksDefectsText?: string;
      specificRecommendationsText?: string;
      requiresPhase2?: boolean;
      requiresAdditionalMonitoring?: boolean;
    };
    signatures?: {
      ownerFeedback?: string;
    };
    ownerRemarks?: string;
    floors?: FloorRaw[];
    [key: string]: unknown;
  };
  buildingSpecs?: {
    building_name?: string;
    land_use_function?: string;
    floor_count?: number;
    basement_count?: number;
    year_of_construction?: number | string;
    is_year_estimated?: boolean;
    construction_area_m2?: number | string;
    building_height_m?: number | string;
    structural_system?: string;
    foundation_category?: string;
    foundation_source?: string;
    foundation_depth_m?: number | string;
    foundation_notes?: string;
    [key: string]: unknown;
  };
  deformation?: {
    tilt_angle_x?: number | string;
    tilt_angle_y?: number | string;
    tilt_direction?: string;
    beam_deflection_mm?: number | string;
    engineer_comments?: string;
    tilt_evolution_verdict?: string;
    [key: string]: unknown;
  };
  damageZones?: DamageZoneRaw[];
  [key: string]: unknown;
}

export const initializeEditFormData = (reportData: ServerReportData | null | undefined, parcel: ExportParcelItem): EditFormData => {
  const json = reportData?.survey_data_json || {};
  const specs = reportData?.buildingSpecs || {};
  const deform = reportData?.deformation || {};
  const settlementTilt = json.settlementTilt || {};
  const adj = json.adjacentBuildings || {};
  const exec = json.executiveSummary || {};

  // Extract defects across all floors & zones
  const defectsList: EditFormDefectItem[] = [];

  if (Array.isArray(json.floors) && json.floors.length > 0) {
    (json.floors as FloorRaw[]).forEach((f: FloorRaw, fIdx: number) => {
      const floorName = f.floorName || `Tầng ${fIdx + 1}`;
      (f.zones || []).forEach((z: FloorZoneRaw, zIdx: number) => {
        const zoneCode = z.zoneCode || `Z-${String(zIdx + 1).padStart(2, '0')}`;
        (z.defects || []).forEach((d: FloorDefectRaw, dIdx: number) => {
          defectsList.push({
            id: `${fIdx}-${zIdx}-${dIdx}-${d.defectCode || dIdx}`,
            floorIndex: fIdx,
            floorName,
            zoneIndex: zIdx,
            zoneCode,
            defectIndex: dIdx,
            defectCode: d.defectCode || `D-${String(dIdx + 1).padStart(2, '0')}`,
            defectType: d.defectType || 'Nứt tường gạch / vách ngăn',
            crackDirection: d.crackDirection || 'Xiên / Ngẫu nhiên',
            widthMaxMm: d.widthMaxMm !== undefined ? d.widthMaxMm : 0.2,
            lengthMm: d.lengthMm !== undefined ? d.lengthMm : 100,
            activityState: d.activityState || 'U',
            notes: d.notes || '',
            zoneNotes: z.notes || '',
            burlandGrade: Number(z.burlandGrade || 0),
          });
        });
      });
    });
  } else if (Array.isArray(reportData?.damageZones) && reportData.damageZones.length > 0) {
    (reportData.damageZones as DamageZoneRaw[]).forEach((z: DamageZoneRaw, zIdx: number) => {
      const zoneCode = z.zone_code || `Z-${String(zIdx + 1).padStart(2, '0')}`;
      const defects = Array.isArray(z.defects) ? z.defects : [];
      defects.forEach((d: DamageZoneDefectRaw, dIdx: number) => {
        defectsList.push({
          id: `rel-${zIdx}-${dIdx}-${d.id || dIdx}`,
          floorIndex: 0,
          floorName: z.floor_name || 'Tầng 1',
          zoneIndex: zIdx,
          zoneCode,
          defectIndex: dIdx,
          defectCode: d.defect_code || `D-${String(dIdx + 1).padStart(2, '0')}`,
          defectType: d.defect_type || 'Nứt tường gạch / vách ngăn',
          crackDirection: d.crack_direction || 'Xiên / Ngẫu nhiên',
          widthMaxMm: d.width_max_mm !== undefined ? d.width_max_mm : 0.2,
          lengthMm: d.length_mm !== undefined ? d.length_mm : 100,
          activityState: d.activity_state || 'U',
          notes: d.notes || '',
          zoneNotes: z.notes || '',
          burlandGrade: Number(z.burland_grade || 0),
        });
      });
    });
  }

  if (defectsList.length === 0) {
    defectsList.push({
      id: 'initial-d-01',
      floorIndex: 0,
      floorName: 'Tầng 1',
      zoneIndex: 0,
      zoneCode: 'Z-01',
      defectIndex: 0,
      defectCode: 'D-01',
      defectType: 'Nứt chân chim tường gạch',
      crackDirection: 'Xiên / Ngẫu nhiên',
      widthMaxMm: 0.2,
      lengthMm: 120,
      activityState: 'U',
      notes: 'Vết nứt chân chim nhẹ tại góc cửa đi, không ảnh hưởng kết cấu',
      zoneNotes: '',
      burlandGrade: 1,
    });
  }

  const riskScores = reportData?.riskScores || reportData?.survey_data_json?.riskScores || {};

  return {
    // 0. Định danh hồ sơ & Cán bộ khảo sát
    reportCode: reportData?.report_code || json.reportCode || `BCS-P1-${parcel.projectParcelCode}`,
    officialCadastralCode: reportData?.official_cadastral_code || json.officialCadastralCode || parcel.officialCadastralCode || '',
    surveyDate: json.surveyDate || (reportData?.survey_date ? new Date(reportData.survey_date).toISOString().split('T')[0] : '2026-09-24'),
    surveyorName: json.surveyorName || reportData?.surveyor_name || 'Kỹ sư hiện trường',
    surveyorCode: json.surveyorCode || reportData?.surveyor_code || 'KS-MT2-01',
    zoneAdminName: json.zoneAdminName || reportData?.zone_admin_name || 'Nguyễn Văn Kiểm Duyệt',

    // 1. Thông tin chung & Quy mô
    buildingName: json.buildingName || specs.building_name || `Nhà ${parcel.houseNumber} ${parcel.street}`,
    ownerName: json.ownerName || reportData?.owner_name || parcel.ownerName || '',
    ownerPhone: json.ownerPhone || reportData?.owner_phone || '',
    houseNumber: json.houseNumber || reportData?.house_number || parcel.houseNumber || '',
    street: json.street || reportData?.street || parcel.street || '',
    usageFunction: json.usageFunction || specs.land_use_function || 'Nhà ở riêng lẻ',
    aboveFloors: json.aboveFloors !== undefined ? json.aboveFloors : (specs.floor_count || parcel.floorCount || 1),
    undergroundFloors: json.undergroundFloors !== undefined ? json.undergroundFloors : (specs.basement_count || 0),
    constructionYear: json.constructionYear || specs.year_of_construction || 2018,
    isEstimatedYear: Boolean(json.isEstimatedYear !== undefined ? json.isEstimatedYear : specs.is_year_estimated),
    constructionAreaM2: json.constructionAreaM2 || specs.construction_area_m2 || '',
    buildingHeightM: json.buildingHeightM || specs.building_height_m || '',
    structureSystem: json.structureSystem || specs.structural_system || 'KHUNG_BTCT_CHIU_LUC',

    // 2. Metro & Tọa độ & Phân loại
    chainage: json.chainage || 'Km 03+450',
    metroOffsetDistance: json.metroOffsetDistance || '12.5',
    surveyCaseType: json.surveyCaseType || 'NORMAL',
    objectGroup: json.objectGroup || 'GENERAL',

    // 3. Nền móng
    foundationType: json.foundationType || specs.foundation_category || 'CAT 4: Móng cọc BTCT',
    foundationSource: json.foundationSource || specs.foundation_source || 'Quan sát hiện trường',
    foundationDepthM: json.foundationDepthM !== undefined ? String(json.foundationDepthM) : (specs.foundation_depth_m ? String(specs.foundation_depth_m) : '0.4'),
    pileDimensionMm: json.pileDimensionMm || '22x25 cm',
    pileLengthMm: json.pileLengthMm || '18000',
    foundationCatScore: json.foundationCatScore !== undefined ? json.foundationCatScore : 4,
    foundationNotes: json.foundationNotes || specs.foundation_notes || '',

    // 4. Liền kề
    adjacentLeftDetails: adj.left?.details || 'Nhà dân cư',
    adjacentLeftNote: adj.left?.note || '',
    adjacentRightDetails: adj.right?.details || 'Nhà dân cư',
    adjacentRightNote: adj.right?.note || '',
    adjacentBackDetails: adj.back?.details || 'Đất trống / Hẻm',
    adjacentBackNote: adj.back?.note || '',

    // 5. Hạn chế tiếp cận
    accessLimitationLevel: json.accessLimitation?.level || 'NONE',
    accessRestrictedAreas: json.accessLimitation?.restrictedAreas || 'Không',
    accessMainReason: json.accessLimitation?.mainReason || 'Không',
    accessMitigationAction: json.accessLimitation?.mitigationAction || 'Không',

    // 6. Lịch sử công trình
    historyRemodeling: json.historyInterview?.renovationNotes || (json.historyInterview?.renovationLoad ? 'Có cơi nới/tăng tải' : 'Không'),
    historyRepairNotes: json.historyInterview?.majorRepairNotes || (json.historyInterview?.majorRepair ? 'Có sửa chữa lớn' : 'Không'),
    historySettlementNotes: json.historyInterview?.pastSettlementNotes || (json.historyInterview?.pastSettlement ? 'Có lún nghiêng cũ' : 'Không'),

    // 7. Biến dạng
    tiltX: settlementTilt.buildingTilt?.xPermille ?? deform.tilt_angle_x ?? '0.0',
    tiltY: settlementTilt.buildingTilt?.yPermille ?? deform.tilt_angle_y ?? '0.0',
    tiltDirection: settlementTilt.buildingTilt?.direction || deform.tilt_direction || 'Chưa phát hiện nghiêng',
    buildingTiltLevel: settlementTilt.buildingTilt?.level ?? 0,
    diffSettlementLevel: settlementTilt.diffSettlement?.level ?? 0,
    diffSettlementPosition: settlementTilt.diffSettlement?.position || 'Không phát hiện lún lệch rõ rệt',
    beamSagMm: settlementTilt.beamSagging?.sagMm ?? deform.beam_deflection_mm ?? '0.0',
    beamSaggingLevel: settlementTilt.beamSagging?.level ?? 0,
    beamSaggingPosition: settlementTilt.beamSagging?.position || 'Không phát hiện võng dầm bất thường',
    deformationNotes: settlementTilt.needAdditionalMonitoring?.notes || deform.engineer_comments || deform.tilt_evolution_verdict || '',

    // 8. Sổ khuyết tật
    defects: defectsList,

    // 9. Burland & Cờ kết cấu
    burlandPredominantGrade: json.burlandSummary?.predominantGrade ?? riskScores.burlandPredominantGrade ?? json.burlandPredominantGrade ?? 0,
    burlandLocalMaxGrade: json.burlandSummary?.localMaxGrade ?? riskScores.burlandLocalMaxGrade ?? json.burlandLocalMaxGrade ?? 0,
    governingZoneCode: json.burlandSummary?.governingZoneCode || 'Z-01',
    governingZoneDescription: json.burlandSummary?.governingZoneDescription || 'Vết nứt khối xây',
    burlandStructuralFlagLevel: json.burlandSummary?.structuralFlagLevel || riskScores.structuralDefectFlag || json.structuralDefectFlag || 'NONE',
    burlandRepresentativeness: json.burlandSummary?.representativeness || 'LOCAL',
    structuralDefectFlag: json.structuralDefectFlag || riskScores.structuralDefectFlag || 'Không có khuyết tật kết cấu',
    requiresStructuralReview: Boolean(json.burlandSummary?.needStructuralEngineerReview ?? riskScores.requiresStructuralReview ?? json.requiresStructuralReview ?? false),

    // 10. ECS
    ecsE1: json.ecs?.e1 ?? riskScores.ecsE1 ?? json.ecsE1 ?? 0,
    ecsE2: json.ecs?.e2 ?? riskScores.ecsE2 ?? json.ecsE2 ?? 0,
    ecsE3: json.ecs?.e3 ?? riskScores.ecsE3 ?? json.ecsE3 ?? 0,
    ecsE4: json.ecs?.e4 ?? riskScores.ecsE4 ?? json.ecsE4 ?? 0,
    ecsE5: json.ecs?.e5 ?? riskScores.ecsE5 ?? json.ecsE5 ?? 0,
    ecsE6: json.ecs?.e6 ?? riskScores.ecsE6 ?? json.ecsE6 ?? 0,
    ecsTotalScore: json.ecs?.totalEcs ?? riskScores.totalEcsScore ?? json.ecsTotalScore ?? 0,
    ecsClass: json.ecs?.ecsClass || riskScores.ecsClass || json.ecsClass || parcel.ecsClass || 'GOOD',
    ecsJudgementAction: json.ecs?.engineeringJudgement?.action || 'KEEP',
    ecsJudgementReason: json.ecs?.engineeringJudgement?.reason || '',

    // 11. VI
    viV1: json.vi?.v1 ?? riskScores.viV1 ?? json.viV1 ?? 1.0,
    viV2: json.vi?.v2 ?? riskScores.viV2 ?? json.viV2 ?? 1.0,
    viV3: json.vi?.v3 ?? riskScores.viV3 ?? json.viV3 ?? 1.0,
    viV4: json.vi?.v4 ?? riskScores.viV4 ?? json.viV4 ?? 1.0,
    viV5: json.vi?.v5 ?? riskScores.viV5 ?? json.viV5 ?? 1.0,
    viV6: json.vi?.v6 ?? riskScores.viV6 ?? json.viV6 ?? 1.0,
    viAvgScore: json.vi?.viAvg ?? riskScores.avgViScore ?? json.viAvgScore ?? 1.0,
    viClass: json.vi?.viClass || riskScores.viClass || json.viClass || parcel.viClass || 'LOW',
    viJudgementAction: json.vi?.engineeringJudgement?.action || 'KEEP',
    viJudgementReason: json.vi?.engineeringJudgement?.reason || '',

    // 12. BRA
    constructionImpactLevel: json.bra?.constructionImpactLevel ?? riskScores.constructionImpactLevelI ?? json.constructionImpactLevel ?? 1,
    buildingRiskBra: json.bra?.buildingRiskBra || riskScores.buildingRiskAssessmentBra || json.buildingRiskBra || parcel.braClass || 'LOW',
    predictedSettlementSmax: json.bra?.predictedSettlementSmax ?? riskScores.predictedSettlementSmax ?? json.predictedSettlementSmax ?? 0,
    angularDistortion: json.bra?.angularDistortion || riskScores.angularDistortion || json.angularDistortion || '1/500',
    vibrationPpv: json.bra?.vibrationPpv ?? riskScores.vibrationPpv ?? json.vibrationPpv ?? 0,
    braMandatoryAction: json.bra?.braMandatoryAction || riskScores.braMandatoryAction || json.braMandatoryAction || 'Quan trắc định kỳ',

    // 13. Gate
    gateDecision: json.gateDecision?.decision || 'ALLOW',
    gateReason: json.gateDecision?.reason || '',

    // 14. Kết luận & Kiến nghị
    summaryConclusions: exec.keyRisksDefectsText || reportData?.summary_conclusions || 'Công trình hoạt động ổn định; ghi nhận khuyết tật cục bộ mức độ nhẹ theo kết quả khảo sát Phase 1.',
    engineeringRecommendations: exec.specificRecommendationsText || reportData?.engineering_recommendations || 'Thiết lập hồ sơ baseline; lắp đặt mốc quan trắc biến dạng định kỳ trong quá trình đào hầm TBM.',
    ownerRemarks: json.ownerRemarks || json.signatures?.ownerFeedback || reportData?.owner_remarks || 'Không',
    requiresPhase2: Boolean(exec.requiresPhase2 ?? riskScores.requiresPhase2 ?? false),
    requiresMonitoring: Boolean(exec.requiresAdditionalMonitoring ?? riskScores.requiresMonitoring ?? false),
  };
};

export const buildReportPayload = (formData: EditFormData, baseReportData: ServerReportData | null | undefined) => {
  // Rebuild floors structure if existing
  let updatedFloors = undefined;
  const surveyJson = baseReportData?.survey_data_json || {};
  if (surveyJson.floors && Array.isArray(surveyJson.floors)) {
    const clonedFloors = JSON.parse(JSON.stringify(surveyJson.floors)) as FloorRaw[];
    formData.defects.forEach((d) => {
      const targetZone = clonedFloors[d.floorIndex]?.zones?.[d.zoneIndex];
      const targetDefect = targetZone?.defects?.[d.defectIndex];
      if (targetDefect && targetZone) {
        targetDefect.notes = d.notes;
        targetDefect.widthMaxMm = Number(d.widthMaxMm);
        targetDefect.lengthMm = Number(d.lengthMm);
        targetDefect.crackDirection = d.crackDirection;
        targetDefect.defectType = d.defectType;
        targetDefect.activityState = d.activityState;

        if (d.zoneNotes !== undefined) {
          targetZone.notes = d.zoneNotes;
        }
        if (d.burlandGrade !== undefined) {
          targetZone.burlandGrade = Number(d.burlandGrade);
        }
      }
    });
    updatedFloors = clonedFloors;
  }

  return {
    // 0. Định danh hồ sơ & Cán bộ khảo sát
    reportCode: formData.reportCode,
    officialCadastralCode: formData.officialCadastralCode,
    surveyDate: formData.surveyDate,
    surveyorName: formData.surveyorName,
    surveyorCode: formData.surveyorCode,
    zoneAdminName: formData.zoneAdminName,

    // 1. Thông tin chung & Quy mô
    buildingName: formData.buildingName,
    ownerName: formData.ownerName,
    ownerPhone: formData.ownerPhone,
    houseNumber: formData.houseNumber,
    street: formData.street,
    usageFunction: formData.usageFunction,
    aboveFloors: formData.aboveFloors,
    undergroundFloors: formData.undergroundFloors,
    constructionYear: formData.constructionYear,
    isEstimatedYear: formData.isEstimatedYear,
    constructionAreaM2: formData.constructionAreaM2,
    buildingHeightM: formData.buildingHeightM,
    structureSystem: formData.structureSystem,

    // 2. Metro & Tọa độ & Phân loại
    chainage: formData.chainage,
    metroOffsetDistance: formData.metroOffsetDistance,
    surveyCaseType: formData.surveyCaseType,
    objectGroup: formData.objectGroup,

    // 3. Móng
    foundationType: formData.foundationType,
    foundationSource: formData.foundationSource,
    foundationDepthM: formData.foundationDepthM,
    pileDimensionMm: formData.pileDimensionMm,
    pileLengthMm: formData.pileLengthMm,
    foundationCatScore: formData.foundationCatScore,
    foundationNotes: formData.foundationNotes,

    // 4. Công trình liền kề
    adjacentBuildings: {
      left: { details: formData.adjacentLeftDetails, note: formData.adjacentLeftNote },
      right: { details: formData.adjacentRightDetails, note: formData.adjacentRightNote },
      back: { details: formData.adjacentBackDetails, note: formData.adjacentBackNote },
    },

    // 5. Phạm vi khảo sát & Hạn chế tiếp cận
    accessLimitation: {
      type: formData.accessLimitationLevel,
      level: formData.accessLimitationLevel,
      restrictedAreas: formData.accessRestrictedAreas,
      mainReason: formData.accessMainReason,
      mitigationAction: formData.accessMitigationAction,
    },

    // 6. Lịch sử công trình
    historyInterview: {
      renovationLoad: formData.historyRemodeling ? 1 : 0,
      majorRepair: formData.historyRepairNotes ? 1 : 0,
      pastSettlement: formData.historySettlementNotes ? 1 : 0,
      renovationNotes: formData.historyRemodeling,
      majorRepairNotes: formData.historyRepairNotes,
      pastSettlementNotes: formData.historySettlementNotes,
    },

    // 7. Biến dạng & Lún nghiêng
    settlementTilt: {
      ...(baseReportData?.survey_data_json?.settlementTilt || {}),
      buildingTilt: {
        ...(baseReportData?.survey_data_json?.settlementTilt?.buildingTilt || {}),
        xPermille: Number(formData.tiltX),
        yPermille: Number(formData.tiltY),
        direction: formData.tiltDirection,
        level: Number(formData.buildingTiltLevel),
      },
      diffSettlement: {
        level: Number(formData.diffSettlementLevel),
        position: formData.diffSettlementPosition,
      },
      beamSagging: {
        ...(baseReportData?.survey_data_json?.settlementTilt?.beamSagging || {}),
        sagMm: Number(formData.beamSagMm),
        level: Number(formData.beamSaggingLevel),
        position: formData.beamSaggingPosition,
      },
      needAdditionalMonitoring: {
        ...(baseReportData?.survey_data_json?.settlementTilt?.needAdditionalMonitoring || {}),
        notes: formData.deformationNotes,
      },
    },

    // 8. Floors & Sổ khuyết tật
    floors: updatedFloors,

    // 9. Burland (1977) & Cờ kết cấu
    burlandSummary: {
      predominantGrade: Number(formData.burlandPredominantGrade),
      localMaxGrade: Number(formData.burlandLocalMaxGrade),
      structuralFlagLevel: formData.burlandStructuralFlagLevel,
      needStructuralEngineerReview: Boolean(formData.requiresStructuralReview),
      governingZoneCode: formData.governingZoneCode,
      governingZoneDescription: formData.governingZoneDescription,
      representativeness: formData.burlandRepresentativeness,
    },
    structuralDefectFlag: formData.structuralDefectFlag,
    requiresStructuralReview: formData.requiresStructuralReview,

    // 10. ECS
    ecs: {
      e1: Number(formData.ecsE1),
      e2: Number(formData.ecsE2),
      e3: Number(formData.ecsE3),
      e4: Number(formData.ecsE4),
      e5: Number(formData.ecsE5),
      e6: Number(formData.ecsE6),
      totalEcs: Number(formData.ecsTotalScore),
      ecsClass: formData.ecsClass,
      engineeringJudgement: {
        action: formData.ecsJudgementAction,
        reason: formData.ecsJudgementReason,
      },
    },

    // 11. VI
    vi: {
      v1: Number(formData.viV1),
      v2: Number(formData.viV2),
      v3: Number(formData.viV3),
      v4: Number(formData.viV4),
      v5: Number(formData.viV5),
      v6: Number(formData.viV6),
      viAvg: Number(formData.viAvgScore),
      viClass: formData.viClass,
      engineeringJudgement: {
        action: formData.viJudgementAction,
        reason: formData.viJudgementReason,
      },
    },

    // 12. BRA
    bra: {
      constructionImpactLevel: Number(formData.constructionImpactLevel),
      buildingRiskBra: formData.buildingRiskBra,
      predictedSettlementSmax: Number(formData.predictedSettlementSmax),
      angularDistortion: formData.angularDistortion,
      vibrationPpv: Number(formData.vibrationPpv),
      braMandatoryAction: formData.braMandatoryAction,
    },

    // 13. Gate & Kết luận
    gateDecision: {
      decision: formData.gateDecision,
      reason: formData.gateReason,
    },
    summaryConclusions: formData.summaryConclusions,
    engineeringRecommendations: formData.engineeringRecommendations,
    ownerRemarks: formData.ownerRemarks,
    requiresPhase2: formData.requiresPhase2,
    requiresMonitoring: formData.requiresMonitoring,

    // Direct surveyDataJson mapping for backward compatibility
    surveyDataJson: {
      ...(baseReportData?.survey_data_json || {}),
      ecs: {
        e1: Number(formData.ecsE1),
        e2: Number(formData.ecsE2),
        e3: Number(formData.ecsE3),
        e4: Number(formData.ecsE4),
        e5: Number(formData.ecsE5),
        e6: Number(formData.ecsE6),
        totalEcs: Number(formData.ecsTotalScore),
        ecsClass: formData.ecsClass,
        engineeringJudgement: {
          action: formData.ecsJudgementAction,
          reason: formData.ecsJudgementReason,
        },
      },
      vi: {
        v1: Number(formData.viV1),
        v2: Number(formData.viV2),
        v3: Number(formData.viV3),
        v4: Number(formData.viV4),
        v5: Number(formData.viV5),
        v6: Number(formData.viV6),
        viAvg: Number(formData.viAvgScore),
        viClass: formData.viClass,
        engineeringJudgement: {
          action: formData.viJudgementAction,
          reason: formData.viJudgementReason,
        },
      },
      bra: {
        constructionImpactLevel: Number(formData.constructionImpactLevel),
        buildingRiskBra: formData.buildingRiskBra,
        predictedSettlementSmax: Number(formData.predictedSettlementSmax),
        angularDistortion: formData.angularDistortion,
        vibrationPpv: Number(formData.vibrationPpv),
        braMandatoryAction: formData.braMandatoryAction,
      },
      executiveSummary: {
        ...(baseReportData?.survey_data_json?.executiveSummary || {}),
        braStatus: formData.buildingRiskBra,
        constructionImpactStatus: `I${formData.constructionImpactLevel}`,
        keyRisksDefectsText: formData.summaryConclusions,
        summaryConclusionsText: formData.summaryConclusions,
        specificRecommendationsText: formData.engineeringRecommendations,
      },
      structuralDefectFlag: formData.structuralDefectFlag,
      requiresStructuralReview: formData.requiresStructuralReview,
      burlandSummary: {
        predominantGrade: Number(formData.burlandPredominantGrade),
        localMaxGrade: Number(formData.burlandLocalMaxGrade),
        structuralFlagLevel: formData.burlandStructuralFlagLevel,
        needStructuralEngineerReview: Boolean(formData.requiresStructuralReview),
        governingZoneCode: formData.governingZoneCode,
        governingZoneDescription: formData.governingZoneDescription,
        representativeness: formData.burlandRepresentativeness,
      },
      riskScores: {
        ...(baseReportData?.survey_data_json?.riskScores || {}),
        ecsE1: Number(formData.ecsE1),
        ecsE2: Number(formData.ecsE2),
        ecsE3: Number(formData.ecsE3),
        ecsE4: Number(formData.ecsE4),
        ecsE5: Number(formData.ecsE5),
        ecsE6: Number(formData.ecsE6),
        totalEcsScore: Number(formData.ecsTotalScore),
        ecsClass: formData.ecsClass,
        viV1: Number(formData.viV1),
        viV2: Number(formData.viV2),
        viV3: Number(formData.viV3),
        viV4: Number(formData.viV4),
        viV5: Number(formData.viV5),
        viV6: Number(formData.viV6),
        avgViScore: Number(formData.viAvgScore),
        viClass: formData.viClass,
        burlandPredominantGrade: Number(formData.burlandPredominantGrade),
        burlandLocalMaxGrade: Number(formData.burlandLocalMaxGrade),
        structuralDefectFlag: formData.structuralDefectFlag,
        requiresStructuralReview: formData.requiresStructuralReview,
        constructionImpactLevelI: Number(formData.constructionImpactLevel),
        buildingRiskAssessmentBra: formData.buildingRiskBra,
        predictedSettlementSmax: Number(formData.predictedSettlementSmax),
        angularDistortion: formData.angularDistortion,
        vibrationPpv: Number(formData.vibrationPpv),
        braMandatoryAction: formData.braMandatoryAction,
      },
    },
  };
};
