export interface EditFormDefectItem {
  id: string;
  floorIndex: number;
  floorName: string;
  zoneIndex: number;
  zoneCode: string;
  defectIndex: number;
  defectCode: string;
  defectType: string;
  crackDirection: string;
  widthMaxMm: number | string;
  lengthMm: number | string;
  activityState: string;
  notes: string;
  zoneNotes?: string;
  burlandGrade?: number;
}

export interface EditFormData {
  // ── 0. Định danh hồ sơ & Cán bộ khảo sát ──
  reportCode: string;
  officialCadastralCode: string;
  surveyDate: string;
  surveyorName: string;
  surveyorCode: string;
  zoneAdminName: string;

  // ── 1. Thông tin chung & Quy mô ──
  buildingName: string;
  ownerName: string;
  ownerPhone: string;
  houseNumber: string;
  street: string;
  usageFunction: string;
  aboveFloors: number | string;
  undergroundFloors: number | string;
  constructionYear: number | string;
  isEstimatedYear: boolean;
  constructionAreaM2: number | string;
  buildingHeightM: number | string;
  structureSystem: string;

  // ── 2. Tuyến Metro, Tọa độ & Phân loại đối tượng ──
  chainage: string;
  metroOffsetDistance: number | string;
  surveyCaseType: string; // NORMAL | ABSENTEE | VACANT_LAND | APARTMENT | UNDER_CONSTRUCTION
  objectGroup: string;    // GENERAL | IMPORTANT | SENSITIVE

  // ── 3. Nền móng chi tiết ──
  foundationType: string;
  foundationSource: string;
  foundationDepthM: string;
  pileDimensionMm: string;
  pileLengthMm: string;
  foundationCatScore: number | string;
  foundationNotes: string;

  // ── 4. Công trình liền kề ──
  adjacentLeftDetails: string;
  adjacentLeftNote: string;
  adjacentRightDetails: string;
  adjacentRightNote: string;
  adjacentBackDetails: string;
  adjacentBackNote: string;

  // ── 5. Phạm vi khảo sát & Hạn chế tiếp cận ──
  accessLimitationLevel: string; // NONE | PARTIAL | SEVERE
  accessRestrictedAreas: string;
  accessMainReason: string;
  accessMitigationAction: string;

  // ── 6. Lịch sử công trình (History Interview) ──
  historyRemodeling: string;
  historyRepairNotes: string;
  historySettlementNotes: string;

  // ── 7. Biến dạng & Lún nghiêng ──
  tiltX: number | string;
  tiltY: number | string;
  tiltDirection: string;
  buildingTiltLevel: number | string; // 0–4
  diffSettlementLevel: number | string; // 0–4
  diffSettlementPosition: string;
  beamSagMm: number | string;
  beamSaggingLevel: number | string; // 0–4
  beamSaggingPosition: string;
  deformationNotes: string;

  // ── 8. Sổ khuyết tật ──
  defects: EditFormDefectItem[];

  // ── 9. Burland (1977) & Cờ kết cấu ──
  burlandPredominantGrade: number | string; // 0–5
  burlandLocalMaxGrade: number | string;    // 0–5
  governingZoneCode: string;
  governingZoneDescription: string;
  burlandStructuralFlagLevel: string; // NONE | LOW | MODERATE | HIGH | CRITICAL
  burlandRepresentativeness: string;  // GLOBAL | LOCAL
  structuralDefectFlag: string;
  requiresStructuralReview: boolean;

  // ── 10. Điểm ECS (E1–E6) ──
  ecsE1: number | string;
  ecsE2: number | string;
  ecsE3: number | string;
  ecsE4: number | string;
  ecsE5: number | string;
  ecsE6: number | string;
  ecsTotalScore: number | string;
  ecsClass: string;   // GOOD | MEDIUM | DEFICIENT | CRITICAL
  ecsJudgementAction: string; // KEEP | OVERRIDE
  ecsJudgementReason: string;

  // ── 11. Chỉ số VI (V1–V6) ──
  viV1: number | string;
  viV2: number | string;
  viV3: number | string;
  viV4: number | string;
  viV5: number | string;
  viV6: number | string;
  viAvgScore: number | string;
  viClass: string;    // LOW | MEDIUM | HIGH | VERY_HIGH
  viJudgementAction: string; // KEEP | OVERRIDE
  viJudgementReason: string;

  // ── 12. BRA & Dự báo rủi ro Metro ──
  constructionImpactLevel: number | string; // 1–5
  buildingRiskBra: string;        // LOW | MEDIUM | HIGH | CRITICAL
  predictedSettlementSmax: number | string;
  angularDistortion: string;
  vibrationPpv: number | string;
  braMandatoryAction: string;

  // ── 13. Cổng kiểm tra dữ liệu Gate ──
  gateDecision: string; // ALLOW | CONDITIONAL | BLOCK
  gateReason: string;

  // ── 14. Kết luận & Kiến nghị ──
  summaryConclusions: string;
  engineeringRecommendations: string;
  ownerRemarks: string;
  requiresPhase2: boolean;
  requiresMonitoring: boolean;
}

export interface ExportParcelItem {
  id: string;
  projectParcelCode: string;
  officialCadastralCode?: string;
  houseNumber: string;
  street: string;
  ownerName: string;
  surveyStatus: string;
  buildingType: string;
  floorCount: number;
  activePhase1ReportId?: string;
  ecsClass?: string;
  viClass?: string;
  braClass?: string;
  updatedAt?: string;
}

export interface BatchResultData {
  batchCode: string;
  downloadUrl: string;
  checksumSha256: string;
  totalReportsCompiled: number;
  expiresAt: string;
}

export interface ActionFeedbackMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

export interface ModalFeedbackMessage {
  type: 'success' | 'error' | 'info';
  text: string;
  timestamp: string;
}

export interface Phase1ExportModuleBoxProps {
  initialZoneId?: string;
  className?: string;
}
