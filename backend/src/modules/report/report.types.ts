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
  tag?: string;
}

export interface DefectItemReport {
  defectCode: string;
  zoneCode: string;
  roomName: string;
  componentType: string;
  defectType?: string;
  screeningCategory?: string;
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
  pinX?: number;
  pinY?: number;
  ctxPhotoUrl?: string;
  cuPhotoUrl?: string;
  cuPhotoCode?: string;
  extraPhotoUrl?: string;
  notes?: string;
}

export interface StructuralElementReport {
  elementCode: string;
  elementType: string;
  materialType: string;
  roomName: string;
  floorName: string;
  hasDamage: boolean;
  notes?: string;
  ctxPhotoUrl?: string;
  ctxPhotoCode?: string;
  overviewPhotos?: string[];
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
  ctxPhotoUrl?: string;
  ctxPhotoCode?: string;
  overviewPhotos?: string[];
  hasDamage: boolean;
  slabCondition?: string;
  wallCondition?: string;
  beamColumnCondition?: string;
  seepageSpallingCondition?: string;
  deformationCondition?: string;
  defects: DefectItemReport[];
}

export interface FloorSurveyReport {
  floorId?: string;
  floorName: string;
  floorOrder: number;
  notes?: string;
  cadDrawingUrl?: string;
  damageMapUrl?: string;
  cadSketchPhotoUrl?: string;
  cadStructuralSketchPhotoUrl?: string;
  isDualPortrait?: boolean;
  overviewPhotos?: Array<{ id?: string; url: string; caption?: string }>;
  zones: DamageZoneReport[];
  structuralElements?: StructuralElementReport[];
  totalDefectsInFloor?: number;
  beamDeflectionMm?: number;
  beamSaggingPosition?: string;
  beamSaggingDesc?: string;
  beamSaggingPhotoUrl?: string;
  requiresAdditionalMonitoring?: boolean;
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

export interface AdjacentBuildingSide {
  side: 'left' | 'right' | 'back';
  sideLabel: string;
  details: string;
  note?: string;
}

export interface GisMutationChildReport {
  label: string;
  areaM2: number;
  ownerName: string;
  houseNumber: string;
  suggestedCode: string;
  functionalType: string;
}

export interface GisMutationReport {
  isMutated: boolean;
  type: string;
  typeLabel: string;
  splitReason?: string;
  splitChildren?: GisMutationChildReport[];
}

export interface HistoryInterviewItemReport {
  category: string;
  indicator: string;
  hasItem: boolean;
  notes: string;
}

export interface ResidentialReportViewModel {
  // 1. Cover & Document Control
  projectName: string;
  metroLineName: string;
  reportCode: string;
  buildingId: string;
  officialCadastralCode?: string;
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
  clearanceOffsetDistanceM?: string;
  metroItemType: string;
  isTbm?: boolean;
  isStation?: boolean;
  isCutAndCover?: boolean;
  isOtherMetro?: boolean;
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
  foundationDepthM?: number | string;
  pileDimensionMm?: string;
  foundationDensity?: string;
  foundationSpacingM?: string;
  foundationNotes?: string;
  constructionAreaM2: number | string;
  buildingHeightM: number | string;
  estimatedHeightM: number | string;
  yearOfConstruction: number | string;
  isYearEstimated: boolean;
  asBuiltDrawingPhotoUrl?: string;
  asBuiltDrawingFiles?: string[];
  asBuiltDrawingPhotos?: Array<{ url: string; pageNote?: string; photoCode?: string }>;
  isAbsenteeSurvey?: boolean;
  absenteeReason?: string;
  vacantLandStatus?: string;
  vacantLandNotes?: string;
  p02WidthM?: string;
  p02HeightM?: string;
  adjacentBuildingsNote: string;
  adjacentBuildingsList: AdjacentBuildingSide[];

  // GIS Mutation
  gisMutation: GisMutationReport;

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
  historyInterviewItems: HistoryInterviewItemReport[];

  // Step 1: Identification, GPS & Survey Case Type
  gpsLat?: number;
  gpsLng?: number;
  objectGroup?: string;
  objectGroupLabel?: string;
  surveyCaseType?: string;
  surveyCaseLabel?: string;
  absenteeMinutesPhotos?: string[];
  vacantLandPhotos?: string[];
  underConstructionPhotos?: string[];
  constructionStageNotes?: string;
  p03Tag?: string;
  p03AdditionalPhotos?: Array<{ url: string; tag?: string; photoCode?: string } | string>;

  // 4. Scope & Access Limitations (Step 5)
  surveyScopeItems?: {
    areaName: string;
    isAccessed: boolean;
    notes: string;
  }[];
  scopeAccess?: {
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
  surveyedFloorsList?: string[];
  accessLimitationType?: string;
  accessLimitationLabel?: string;
  restrictedAreasList?: string[];
  restrictedAreasDisplay?: string;
  accessMainReason?: string;
  accessMainReasonDisplay?: string;
  accessNotes?: string;
  accessNotesDisplay?: string;

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
  totalStructuralElementsCount: number;

  // 7. Deformation & Tilt (Step 4)
  tiltAngleX: number;
  tiltAngleY: number;
  tiltDirection: string;
  floorSlopeRatio: number;
  beamDeflectionMm: number;
  measurementMethod: string;
  measurementReliability: string;
  requiresAdditionalMonitoring: boolean;
  deformationEngineerComments: string;
  buildingTiltPhotoUrl?: string;
  diffSettlementPhotoUrl?: string;
  beamSaggingPhotoUrl?: string;
  diffSettlementPhotos?: Array<{ url: string; photoCode?: string; caption?: string }>;
  tiltPhotos?: Array<{ url: string; photoCode?: string; caption?: string }>;
  abnormalPhotos?: Array<{ url: string; photoCode?: string; caption?: string }>;
  diffSettlementLevel?: number;
  diffSettlementPosition?: string;
  diffSettlementNotes?: string;
  buildingTiltLevel?: number;
  buildingTiltNotes?: string;
  beamSaggingLevel?: number;
  beamSaggingPosition?: string;
  beamSaggingDesc?: string;

  // 8. Burland 1977 (Step 4)
  burlandPredominantGrade: number;
  burlandPredominantLabel: string;
  burlandLocalMaxGrade: number;
  burlandLocalMaxLabel: string;
  burlandGoverningZoneCode?: string;
  burlandGoverningZoneDesc?: string;
  burlandStructuralFlagLevel?: string;
  burlandStructuralFlagLevelLabel?: string;
  burlandRepresentativeness?: string;
  burlandRepresentativenessLabel?: string;
  structuralDefectFlag: string;
  requiresStructuralReview: boolean;

  // 9. ECS Breakdown (Step 6)
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
  gateDecisionStatus?: string;
  gateDecisionLabel?: string;
  gateDecisionReason?: string;

  // 10. VI Breakdown (Step 6)
  viV1: number;
  viV2: number;
  viV3: number;
  viV4: number;
  viV5: number;
  viV6: number;
  viJudgementApplied?: boolean;
  viJudgementAction?: string;
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

  // Signatures & Working Minutes
  surveyorSignatureUrl?: string;
  surveyorSignatureImg?: string;
  ownerSignatureUrl?: string;
  ownerSignatureImg?: string;
  zoneAdminSignatureUrl?: string;
  zoneAdminSignatureImg?: string;
  superAdminSignatureImg?: string;
  fieldWorkMinutesPhotoUrl?: string;
  workingMinutesPhotos: string[];
  generatedAt: string;
}
