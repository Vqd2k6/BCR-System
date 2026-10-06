/**
 * ============================================================================
 * REPORT V2 TYPES (METRO 2 BUILDING CONDITION SURVEY - PHASE 1)
 * Chuẩn song ngữ Việt - Anh theo tài liệu mẫu: report_0410/template_report.docx
 * Liên danh CRLG – CRSRI – TT
 * ============================================================================
 */

export interface BilingualText {
  vi: string;
  en: string;
}

export interface ApprovalSignatureItem {
  roleVi: string;
  roleEn: string;
  fullName: string;
  titleVi: string;
  titleEn: string;
  signatureUrl?: string;
  signatureBase64?: string;
  date: string;
}

export interface ReportV2Metadata {
  buildingId: string;                // e.g. "B-01064-C&C (ST5)"
  surveyId: string;                  // e.g. "P-6789"
  reportNo: string;                  // e.g. "REPORT-B-01064-C&C-PHASE1-1790480320866 (Rev. 00)"
  filingNo?: string;                 // e.g. "Số: 01064/BCS-P1/CRLG-2026"
  revision: string;                  // e.g. "00"
  cadastralCode: string;             // e.g. "271330130431"
  projectTitleVi: string;
  projectTitleEn: string;
  reportTitleVi: string;
  reportTitleEn: string;
  generatedAt: string;
  checksumSha256?: string;
  coverPhotoBase64?: string;
  coverPhotoUrl?: string;
  coverAlreadyWatermarked?: boolean;
  headerLogoBase64?: string;
  surveyDateFormatted?: string;
  totalExpectedPages?: number;
}

export interface RelatedMetroWorks {
  type: 'C&C' | 'POR' | 'ELV' | 'DEP';
  isCutCover: boolean;
  isBoredTunnel: boolean;
  isElevated: boolean;
  isDepot: boolean;
}

export interface Section1GeneralInfo {
  projectTitleVi: string;
  projectTitleEn: string;
  buildingId: string;
  surveyId: string;
  reportNo: string;
  buildingName: BilingualText;
  address: BilingualText;
  cadastralCode: string;
  ownerOccupant: BilingualText;
  contactPhone: string;
  surveyConsultant: BilingualText;
  epcContractor: string;
  sectionZone: BilingualText;
  relatedMetroWorks: RelatedMetroWorks;
  gpsCoords: {
    lat: number;
    lng: number;
    formatted: string;
  };
  surveyDate: string;
}

export interface Section2BasicBuildingInfo {
  use: BilingualText;
  storeysAbove: number | string;
  storeysBasement: number | string;
  storeysDisplay: BilingualText;
  landAreaM2: number | string;
  footprintM2: number | string;
  totalFloorAreaM2: number | string;
  floorAreaDisplay: BilingualText;
  mainDimensions: BilingualText;
  maxHeightM: number | string;
  typicalStoreyHeightM: number | string;
  yearConstructed: number | string;
  isEstimatedYear: boolean;
  distanceToMetroAlignmentM: number | string;
  distanceToMetroEdgeM: number | string;
  distanceToMetroDisplay: BilingualText;
  clearanceVerticalM: number | string;
  clearance3DM: number | string;
  clearanceDisplay: BilingualText;
  surveyCategory: BilingualText;
}

export interface Section3HistoryOccupancy {
  changeOfUse: BilingualText;
  extension: BilingualText;
  structuralAlteration: BilingualText;
  majorRepair: BilingualText;
  fireHistory: BilingualText;
  flooding: BilingualText;
  fireAndFlooding?: BilingualText;
  previousSettlementTilt: BilingualText;
  occupancyStatus: BilingualText;
  sensitiveEquipment: BilingualText;
  continuousOperation?: BilingualText;
  damageByAdjacentWorks: BilingualText;
  informationSource: BilingualText;
}

export interface Section4StructuralFoundation {
  structuralType: BilingualText;
  structuralForm: BilingualText;
  foundationType: BilingualText;
  pileSize: BilingualText;
  footingDensitySpacing: BilingualText;
  foundationDepth: BilingualText;
  visibleStructuralCondition: BilingualText;
  adjacentBuildings: BilingualText;
  surroundingGround?: BilingualText;
  foundationEvidence: BilingualText;
  remarks: BilingualText;
}

export interface Section5TiltSettlement {
  differentialSettlement: {
    observed: boolean;
    observedDisplay: BilingualText;
    location: BilingualText;
  };
  componentDeterioration: {
    observed: boolean;
    observedDisplay: BilingualText;
    location: BilingualText;
  };
  evidenceOfRepairs: {
    observed: boolean;
    observedDisplay: BilingualText;
    location: BilingualText;
  };
  collapse: {
    observed: boolean;
    observedDisplay: BilingualText;
    location: BilingualText;
  };
  buildingInclination: {
    observed: boolean;
    observedDisplay: BilingualText;
    measured: string;
    details: BilingualText;
    location: BilingualText;
  };
  beamDeflection: {
    observed: boolean;
    observedDisplay: BilingualText;
    measured: string;
    location: BilingualText;
  };
  floorSlabInclination: {
    observed: boolean;
    measured: string;
  };
  beamSlabDeflection: {
    observed: boolean;
    measured: string;
  };
  basisOfDetermination: BilingualText;
  reliability: BilingualText;
  remarks: BilingualText;
  tiltPhoto?: {
    url: string;
    base64?: string;
    caption: BilingualText;
    alreadyWatermarked?: boolean;
  };
  settlementPhoto?: {
    url: string;
    base64?: string;
    caption: BilingualText;
    alreadyWatermarked?: boolean;
  };
}

export interface DefectFloorDistributionItem {
  floorName: BilingualText;
  surveyedObjectsCount: number;
  structuralCracksCount: number;
  masonryPlasterCracksCount: number;
  moistureCount: number;
  spallingCount: number;
  maxCrackWidthMm: string;
  conditionStatus: BilingualText;
}

export interface Section6DefectSummary {
  totalDefects: number;
  totalFloors: number;
  floorsWithDefectsCount: number;
  structuralCracksCount: number;
  masonryPlasterCracksCount: number;
  moistureDefectsCount: number;
  spallingDefectsCount: number;
  otherDefectsCount: number;
  totalSurveyedObjects?: number;
  maxCrackWidthMm: string;
  totalMaxCrackWidthDisplay?: string;
  maxCrackLengthM: string;
  governingDefect?: {
    code: string;
    location: BilingualText;
    type: BilingualText;
    wmaxMm: string;
    lengthM: string;
    status: BilingualText;
  };
  floorDistribution: DefectFloorDistributionItem[];
  checklist: Array<{
    groupVi: string;
    groupEn: string;
    indicatorVi: string;
    indicatorEn: string;
    recorded: boolean;
    recordedLabel: BilingualText;
    locationSeverity: BilingualText;
    riskLevel: BilingualText;
  }>;
  notes: BilingualText;
  discrepancyNote?: BilingualText;
  counts?: {
    surfaceFinishCracks: number;
    structuralCracks: number;
    damage: number;
    spallingOfFinish: number;
    crackedTiles: number;
    leakage: number;
    ceilingDamage: number;
    concreteSpallingRebar: number;
    slopingFloor: number;
  };
  crackQuantities?: {
    totalCracks: number;
    maxCrackWidthMm: number | string;
    maxCrackLengthM: number | string;
  };
}

export interface BurlandZoneSummaryItem {
  zoneCode: string;
  floorName: BilingualText;
  location: BilingualText;
  wallMaterial: BilingualText;
  wmaxMm: number | string;
  crackCount: number;
  burlandGrade: number;
}

export interface BurlandTableRow {
  grade: number;
  categoryVi: string;
  categoryEn: string;
  crackWidthLimit: string;
  descriptionVi: string;
  descriptionEn: string;
  isCurrentLevel: boolean;
}

export interface BurlandDistributionItem {
  grade: number;
  nameVi: string;
  nameEn: string;
  crackWidthLimit: string;
  count: number;
  percentage: string;
  isCurrentMax: boolean;
  isPredominant: boolean;
}

export interface Section7BurlandClassification {
  burlandTable: BurlandTableRow[];
  distribution: BurlandDistributionItem[];
  totalSurveyedObjects: number;
  predominantGrade: BilingualText;
  predominantPercentage: string;
  localMaxGrade: BilingualText;
  governingZone: BilingualText;
  governingZoneDescription?: BilingualText;
  representativeness: BilingualText;
  structuralFlagLevel: BilingualText;
  needStructuralReview: BilingualText;
  serviceabilityNarrative: BilingualText;
  legalInsuranceBaselineNarrative: BilingualText;
  gradeCounts?: Array<{
    grade: number;
    nameVi: string;
    nameEn: string;
    count: number;
  }>;
  zones?: BurlandZoneSummaryItem[];
  structuralDefectFlag?: BilingualText;
  structuralEngineerReview?: BilingualText;
}

export interface RiskScoreCategoryItem {
  code: string;                      // A, B, C, D, E
  title: BilingualText;
  basis: BilingualText;
  maxScore: number;
  scoreDisplay: string;              // "Chờ / Pending" or "8"
  scoreNumeric?: number;
}

export interface EcsAssessmentItem {
  code: string;                      // E1..E6
  title: BilingualText;
  basis: BilingualText;
  scale: string;                     // 0–4
  score: number;
}

export interface ViAssessmentItem {
  code: string;                      // V1..V6
  title: BilingualText;
  basis: BilingualText;
  scale: string;                     // 0–4 or 1–4
  score: number;
}

export interface BraMatrixCell {
  vCode: 'V1' | 'V2' | 'V3' | 'V4';
  iCode: 'I1' | 'I2' | 'I3' | 'I4';
  riskLevel: 'Low' | 'Medium' | 'High' | 'Very High';
  riskLevelVi: string;
  riskLevelEn: string;
  badgeBg: string;
  isCurrent: boolean;
}

export interface BraMatrixRow {
  vCode: 'V1' | 'V2' | 'V3' | 'V4';
  vLabel: BilingualText;
  cells: BraMatrixCell[];
}

export interface Section8BuildingConditionAssessment {
  ecs: {
    items: EcsAssessmentItem[];
    totalScore: number;              // 0–24
    classGrade: BilingualText;       // Tốt / Good, etc.
    burlandPredominantGrade?: number;
    burlandLocalMaxGrade?: number;
    structuralFlag?: string;
    engineeringJudgement?: {
      isApplied: boolean;
      action?: string;
      reason?: string;
    };
    isOverrideLocked?: boolean;
  };
  vi: {
    items: ViAssessmentItem[];
    totalScore: number;              // 6–24
    averageScore: number;            // 1.00–4.00
    classGrade: BilingualText;       // Thấp / Low, etc.
    vCode: 'V1' | 'V2' | 'V3' | 'V4';
    foundationCatScore?: number;
    engineeringJudgement?: {
      isApplied: boolean;
      action?: string;
      reason?: string;
    };
  };
  impact: {
    code: 'I1' | 'I2' | 'I3' | 'I4';
    levelText: BilingualText;
    distanceM: number;
    distanceType?: 'STATION_EDGE' | 'TUNNEL_CENTERLINE';
    distanceLabel?: BilingualText;
    basis: BilingualText;
  };
  braMatrix: {
    vCode: 'V1' | 'V2' | 'V3' | 'V4';
    iCode: 'I1' | 'I2' | 'I3' | 'I4';
    rows: BraMatrixRow[];
    finalRiskLevel: BilingualText;
    recommendation: BilingualText;
    narrative: BilingualText;
  };
  overallRisk: {
    grade: BilingualText;
    narrative: BilingualText;
  };
  riskMatrix?: {
    ecsGrade: BilingualText;
    burlandGrade: number;
    baselineRisk: BilingualText;
    narrative: BilingualText;
  };
  scoring?: {
    items: RiskScoreCategoryItem[];
    totalBraScoreDisplay: string;
    narrative: BilingualText;
  };
  supplementaryPhase1?: any;
}

export interface Section9ConclusionRecommendation {
  conclusions: BilingualText[];
  overallRisk: BilingualText;
  witnessNarrative: BilingualText;
  limitations: BilingualText[];
  recommendations: BilingualText[];
  phase1Notice: BilingualText;
  pendingFieldDesignItems: BilingualText[];
  hasWarningConclusion?: boolean;
  warningBadge?: BilingualText;
}

export interface Appendix1PhotoItem {
  photoCode: string;                 // P-01..P-05
  name: BilingualText;
  url: string;
  base64?: string;
  capturedAt: string;
  gpsCoords: string;
  originalTag?: string;
  alreadyWatermarked?: boolean;
}

export interface CadPinOverlayItem {
  id?: string;
  code: string;                      // Z-01, E-01, D-01
  label?: string;
  pinX: number;                      // 0 - 100 (%)
  pinY: number;                      // 0 - 100 (%)
  type: 'ZONE' | 'STRUCTURAL' | 'DEFECT';
  typeLower: 'zone' | 'element' | 'defect';
  description?: string;
}

export interface DefectPairPhotoItem {
  defectId: string;                  // D-01
  defectType: BilingualText;
  contextPhotoUrl?: string;
  contextPhotoBase64?: string;
  contextCaption: BilingualText;
  contextAlreadyWatermarked?: boolean;
  contextPhotoCode?: string;
  closeUpPhotoUrl?: string;
  closeUpPhotoBase64?: string;
  closeUpCaption: BilingualText;
  closeUpAlreadyWatermarked?: boolean;
  closeUpPhotoCode?: string;
  hasCrackGauge: boolean;
  wmaxMm: number | string;
  lengthM: number | string;
  // Bổ sung ảnh cận cảnh thứ 2 (ảnh thước đo nứt chuyên dụng)
  extraCloseUpPhotoUrl?: string;
  extraCloseUpPhotoBase64?: string;
  extraCloseUpCaption?: BilingualText;
  extraCloseUpAlreadyWatermarked?: boolean;
  extraCloseUpPhotoCode?: string;
  hasExtraCloseUp?: boolean;
  activityState?: string;            // S hoặc A
  activityStateDisplay?: BilingualText;
  notes?: string;                    // Ghi chú hiện trường KSV
  cadPinRef?: string;                // e.g. "D-01 trên CAD_01"
}

export interface RoomOverviewPhotoItem {
  photoId: string;
  roomName: BilingualText;
  zoneCode: string;
  url: string;
  base64?: string;
  caption: BilingualText;
  statusBadge: {
    isNormal: boolean;
    text: BilingualText;
  };
  alreadyWatermarked?: boolean;
}

export interface FloorOverviewPageViewModel {
  pageIndexInFloor: number;
  totalOverviewPagesInFloor: number;
  photos: RoomOverviewPhotoItem[];
}

export interface FloorConditionZoneElementItem {
  code: string;                      // Z-01..Z-09 or E-01..E-09
  location: BilingualText;
  memberMaterial: BilingualText;
  condition: BilingualText;
  photoRefLabel: string;             // e.g. "P-11" or "P-12,13"
  photoUrl?: string;
  photoBase64?: string;
}

export interface FloorDefectSummaryRow {
  no: number;
  defectId: string;
  location: BilingualText;
  defectType: BilingualText;
  widthMm: number | string;
  lengthM: number | string;
  burlandDamageCategory: BilingualText;
  burlandGrade: number;
  description: BilingualText;
  cadPinRef?: string;
}

export interface FloorPlanDefectReport {
  floorOrder: number;
  floorName: BilingualText;
  damageMapUrl?: string;
  damageMapBase64?: string;
  structuralMapUrl?: string;
  structuralMapBase64?: string;
  hasStructuralCadMap: boolean;      // True nếu có bản vẽ kết cấu riêng biệt với bản vẽ kiến trúc
  hasDefects: boolean;               // True nếu tầng có ít nhất 1 khuyết tật
  zeroDefectsNotice?: BilingualText; // Thông báo kỹ thuật khi tầng nguyên vẹn không có vết nứt
  cadPins?: CadPinOverlayItem[];     // Ghim Z, E, D trên bản vẽ kiến trúc CAD_01
  cadStructuralPins?: CadPinOverlayItem[]; // Ghim E, D trên bản vẽ kết cấu CAD_02
  defectSummaryRows: FloorDefectSummaryRow[];
  defectPairPhotos: DefectPairPhotoItem[];
  defectPairPages?: Array<{
    pageIndex: number;
    pairs: DefectPairPhotoItem[];
  }>;
  // BỔ SUNG: Toàn bộ ảnh tổng thể các phòng theo từng tầng (6 ảnh/trang)
  overviewPages?: FloorOverviewPageViewModel[];
  zoneAndElementConditions: FloorConditionZoneElementItem[];
  beamDeflectionRow?: {
    location: BilingualText;
    measuredDeflectionMm: number | string;
    extraMonitoringRequired: BilingualText;
  };
  overviewPhotos?: Array<{
    photoLabel: string;
    caption: BilingualText;
    url: string;
    base64?: string;
  }>;
}

export interface Appendix3SignedRecord {
  surveyTime: string;
  ownerRepresentative: BilingualText;
  localAuthority: BilingualText;
  supervisionConsultant: BilingualText;
  surveyUnit: BilingualText;
  fieldComments: BilingualText;
  electronicSignOff: BilingualText;
  dataSource: BilingualText;
  signedRecordPages: Array<{
    pageIndex: number;
    title: BilingualText;
    url: string;
    base64?: string;
  }>;
}

export interface Appendix4EquipmentAndAccess {
  equipmentList: Array<{
    no: number;
    equipment: BilingualText;
    specs: BilingualText;
    purpose: BilingualText;
  }>;
  calibrationNotes: BilingualText;
  accessAreas: Array<{
    area: BilingualText;
    accessed: boolean;
    notAccessed: boolean;
    remark: BilingualText;
  }>;
  accessClassification: BilingualText;
}

export interface ReportScenarioFlags {
  isAbsenteeSurvey: boolean;          // Khảo sát vắng mặt
  isVacantLand: boolean;              // Đất trống
  hasMainFacadePhoto: boolean;        // Có ảnh P-02
  hasSideOrRearPhotos: boolean;       // Có ảnh P-03
  hasTiltPhoto: boolean;              // Có ảnh P-05
  hasStructuralCadMap: boolean;       // Có CAD kết cấu riêng (CAD_STRUCT)
  hasAnyDefects: boolean;             // Có khuyết tật nứt (defects count > 0)
  exteriorPhotoLayout: 'grid_6' | 'party_wall_3' | 'minimal_2'; // Kiểu bố cục ngoại thất
}

export interface Appendix1PhotoPage {
  pageIndex: number;
  totalPages: number;
  photos: Appendix1PhotoItem[];
}

export interface TocPageNumbers {
  section1: number;
  section2: number;
  section3: number;
  section4: number;
  section5: number;
  section6: number;
  section7: number;
  section8: number;
  section9: number;
  appendix1: number;
  appendix2: number;
  appendix3: number;
  appendix4: number;
}

export interface ReportV2ViewModel {
  metadata: ReportV2Metadata;
  scenarioFlags: ReportScenarioFlags;
  tocPageNumbers: TocPageNumbers;
  signatures3Party: ApprovalSignatureItem[];
  section1: Section1GeneralInfo;
  section2: Section2BasicBuildingInfo;
  section3: Section3HistoryOccupancy;
  section4: Section4StructuralFoundation;
  section5: Section5TiltSettlement;
  section6: Section6DefectSummary;
  section7: Section7BurlandClassification;
  section8: Section8BuildingConditionAssessment;
  section9: Section9ConclusionRecommendation;
  appendix1: Appendix1PhotoItem[];
  appendix1Pages?: Appendix1PhotoPage[];
  appendix2: FloorPlanDefectReport[];
  appendix3: Appendix3SignedRecord;
  appendix4: Appendix4EquipmentAndAccess;
}
