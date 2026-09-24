export interface ReportPhotoItem {
  photoId: string;
  photoType: 'P01_HOUSE_NUMBER' | 'P02_MAIN_FACADE' | 'P03_SIDE_OR_REAR' | 'P04_CONTEXT_STREET' | 'DEFECT_CTX' | 'DEFECT_CU' | 'EXTRA';
  url: string;
  base64Data?: string;
  isNotApplicable?: boolean;
  naReason?: string;
  capturedAt?: string;
  gpsLat?: number;
  gpsLng?: number;
  label?: string;
  notes?: string;
}

export interface DefectItemReport {
  defectCode: string;
  zoneCode: string;
  roomName: string;
  componentType: string;
  crackDirection?: string;
  widthMaxMm: number;
  lengthMm: number;
  activityState: 'U' | 'S' | 'A';
  activityStateLabel: string;
  structuralSignificanceE2: number;
  structuralSignificanceLabel: string;
  materialDegradationE4: number;
  materialDegradationLabel: string;
  hasScaleCard: boolean;
  isStructuralCritical: boolean;
  ctxPhotoUrl?: string;
  cuPhotoUrl?: string;
  extraPhotoUrl?: string;
  notes?: string;
}

export interface DamageZoneReport {
  zoneCode: string;
  floorName: string;
  roomName: string;
  componentType: string;
  wallMaterial?: string;
  functionalImpactRepairNeeded: boolean;
  burlandGrade: number;
  burlandLabel: string;
  notes?: string;
  slabCondition?: string;
  wallCondition?: string;
  beamColumnCondition?: string;
  seepageSpallingCondition?: string;
  deformationCondition?: string;
  defects: DefectItemReport[];
}

export interface FloorSurveyReport {
  floorName: string;
  floorOrder: number;
  notes?: string;
  cadDrawingUrl?: string;
  damageMapUrl?: string;
  zones: DamageZoneReport[];
}

export interface BcsChecklistItem {
  category: string;
  indicator: string;
  hasIndicator: boolean;
  locationAndSeverity: string;
  notes?: string;
}

export interface QualityGateItemReport {
  code: string;
  title: string;
  status: 'PASSED' | 'FAILED' | 'NA';
  notes?: string;
}

export interface ResidentialReportViewModel {
  // 1. Cover & Document Control
  projectName: string;
  metroLineName: string;
  reportCode: string;
  buildingId: string;
  surveyId: string;
  address: string;
  houseNumber: string;
  street: string;
  ward: string;
  district: string;
  zoneId: string;
  zoneName: string;
  chainage: string;
  distanceToTunnelMeters: number;
  metroItemType: string;
  surveyDate: string;
  revision: string;
  preparedByName: string;
  preparedByTitle: string;
  checkedByName: string;
  checkedByTitle: string;
  approvedByName: string;
  approvedByTitle: string;
  facadeCoverPhotoUrl?: string;

  // 2. Executive Dashboard (Tổng quan chỉ số)
  totalEcsScore: number;
  ecsClass: string;
  ecsBadgeClass: string;
  avgViScore: number;
  viClass: string;
  viBadgeClass: string;
  constructionImpactLevelI: number;
  impactBadgeClass: string;
  buildingRiskAssessmentBra: string;
  braBadgeClass: string;
  predictedSettlementSmax: number;
  angularDistortion: string;
  vibrationPpv: number;

  // 3. Building Characteristics
  buildingName: string;
  ownerName: string;
  ownerPhone: string;
  landUseFunction: string;
  floorCount: number;
  basementCount: number;
  structuralSystem: string;
  structuralSystemLabel: string;
  foundationCategory: string;
  foundationCategoryLabel: string;
  foundationInfoSource: string;
  constructionAreaM2: number | string;
  buildingHeightM: number | string;
  estimatedHeightM: number | string;
  yearOfConstruction: number | string;
  isYearEstimated: boolean;
  adjacentBuildingsNote: string;

  // Historical Sensitivities & Notes
  extendedOrRenovated: boolean;
  extendedOrRenovatedNotes: string;
  previousSettlementOrTilt: boolean;
  previousSettlementNotes: string;
  fireOrAccident: boolean;
  fireOrAccidentNotes: string;
  sensitiveEquipmentPresent: boolean;
  sensitiveEquipmentNotes: string;
  historyDetailsNote: string;

  // 4. Scope & Access Limitations
  scopeAccess: {
    facadeStatus: string;
    facadeNote: string;
    groundFloorStatus: string;
    groundFloorNote: string;
    upperFloorsStatus: string;
    upperFloorsNote: string;
    roofStatus: string;
    roofNote: string;
    basementStatus: string;
    basementNote: string;
    auxiliaryStatus: string;
    auxiliaryNote: string;
    inaccessibleAreasReason: string;
  };

  // Identification Photos P-01 to P-04
  p01: ReportPhotoItem;
  p02: ReportPhotoItem;
  p03: ReportPhotoItem;
  p04: ReportPhotoItem;

  // 5. BCS Checklist
  bcsChecklist: BcsChecklistItem[];

  // 6. Detailed Defect Register & Floor Damage Maps
  floors: FloorSurveyReport[];
  totalDefectsCount: number;
  totalDamageZonesCount: number;

  // 7. Deformation & Tilt
  tiltAngleX: number;
  tiltAngleY: number;
  tiltDirection: string;
  floorSlopeRatio: number;
  beamDeflectionMm: number;
  measurementMethod: string;
  measurementReliability: string;
  requiresAdditionalMonitoring: boolean;
  deformationEngineerComments: string;

  // 8. Burland 1977
  burlandPredominantGrade: number;
  burlandPredominantLabel: string;
  burlandLocalMaxGrade: number;
  burlandLocalMaxLabel: string;
  structuralDefectFlag: string;
  requiresStructuralReview: boolean;

  // 9. ECS Breakdown
  ecsE1: number;
  ecsE2: number;
  ecsE3: number;
  ecsE4: number;
  ecsE5: number;
  ecsE6: number;
  ecsJudgementApplied: boolean;
  ecsJudgementAction: string;
  ecsJudgementReason: string;
  qualityGates: QualityGateItemReport[];

  // 10. VI Breakdown
  viV1: number;
  viV2: number;
  viV3: number;
  viV4: number;
  viV5: number;
  viV6: number;
  viJudgementReason: string;

  // 11. Metro Alignment & Cross section
  metroCrossSectionUrl?: string;

  // 12. BRA Matrix & Actions
  braMatrixCell: string;
  braMandatoryAction: string;
  braEngineeringReviewNotes: string;

  // 13. Conclusions & Recommendations
  summaryConclusions: string;
  engineeringRecommendations: string;
  ownerRemarks: string; // Ý kiến / ghi chú phản ánh của chủ nhà
  requiresPhase2: boolean;
  requiresMonitoring: boolean;

  // Signatures
  surveyorSignatureUrl?: string;
  surveyorSignatureImg?: string;
  ownerSignatureUrl?: string;
  ownerSignatureImg?: string;
  zoneAdminSignatureUrl?: string;
  zoneAdminSignatureImg?: string;
  superAdminSignatureImg?: string;
  fieldWorkMinutesPhotoUrl?: string;
  generatedAt: string;
}
