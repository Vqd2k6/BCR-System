/**
 * ============================================================================
 * PROGRESS REPORT PLUGIN – DOMAIN TYPES
 * Kiểu dữ liệu chuẩn hóa dùng chung giữa 3 lớp: DataSource → Rules → Renderer.
 * Module độc lập: KHÔNG import từ survey/ hay report/.
 * ============================================================================
 */

export type TimeMode = 'TODAY' | 'DATE_RANGE' | 'ALL_TIME';

export type AlignmentSide = 'RIGHT' | 'LEFT';

/** Mã tổng hợp phục vụ bảng Summary (Cần theo dõi / Nguy cơ cao / Không tiếp cận). */
export type ConditionCode = 'NEW' | 'OLD' | 'DEGRADED' | 'MONITOR' | 'HIGH_RISK' | 'INACCESSIBLE';

/** Cột "Tình trạng hiện tại" (ECS - 4 mức phân hạng + Không tiếp cận được). */
export type EcsConditionCode = 'GOOD' | 'MEDIUM' | 'DEFICIENT' | 'CRITICAL' | 'INACCESSIBLE';

/** Cột "Mức độ đánh giá rủi ro" (BRA - 4 mức phân hạng). */
export type BraRiskCode = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export type SurveyProgressCode = 'IN_PROGRESS' | 'SURVEY_DONE_REPORTING' | 'REPORT_DONE' | 'REPORT_SIGNED';

export type RecordKind = 'BUILDING' | 'CONDO_UNIT';

export interface ProgressFilter {
  zoneId: string; // 'ALL' hoặc mã zone (VD: ZONE_09)
  timeMode: TimeMode;
  fromDate?: string; // YYYY-MM-DD (DATE_RANGE)
  toDate?: string; // YYYY-MM-DD (DATE_RANGE)
  templateId: string;
}

/** Bản ghi thô lấy từ CSDL (1 dòng = 1 công trình độc lập hoặc 1 căn hộ con). */
export interface RawProgressRow {
  kind: RecordKind;
  parcelId: string;
  unitId: string | null;
  zoneId: string;
  zoneName: string | null;
  projectParcelCode: string;
  parcelHouseNumber: string | null;
  parcelStreet: string | null;
  parcelWard: string | null;
  parcelOwnerName: string | null;
  parcelOwnerPhone: string | null;
  parcelFloorCount: number | null;
  parcelFrontageWidth: number | null;
  parcelLotDepth?: number | null;
  parcelDistanceToCenterline: number | null;
  parcelSurveyStatus: string;
  unitCode: string | null;
  unitDisplayCode: string | null;
  unitFloorNumber: number | null;
  unitOwnerName: string | null;
  unitOwnerPhone: string | null;
  unitStatus: string | null;
  reportId: string | null;
  reportStatus: string | null;
  reportCreatedAt: Date | null;
  reportUpdatedAt: Date | null;
  reportSubmittedAt: Date | null;
  reportSurveyDate: Date | null;
  reportIsRefusedOrAbsent: boolean;
  reportJson: Record<string, unknown> | null;
  ownerRemarks: string | null;
  hasRelease: boolean;
  specBuildingName: string | null;
  specLandUseFunction: string | null;
  specFloorCount: number | null;
  specYear: number | null;
  specFoundationCategory: string | null;
  specFoundationDepth: number | null;
  specBuildingHeight: number | null;
  specFoundationCatScore: number | null;
  specBuildingGrade?: string | null;
  submittedLotDepth?: number | null;
  submittedFrontageWidth?: number | null;
  submittedBuildingHeight?: number | null;
  riskEcsClass: string | null;
  riskViClass?: string | null;
  riskViAvg?: number | null;
  riskBra: string | null;
  riskOverriddenEcsClass: string | null;
  riskOverriddenViClass?: string | null;
  riskOverriddenAvgVi?: number | null;
  riskOverriddenBra: string | null;
  riskOverriddenBurland: number | null;
  riskJudgementApplied: boolean;
  monitoringRequired: boolean;
  masterJson: Record<string, unknown> | null;
  masterBuildingName: string | null;
  masterYear: number | null;
  masterFoundationCategory?: string | null;
  masterFoundationDepth?: number | null;
  masterFloorCount?: number | null;
  absenceCount: number;
  absenceFirstAt: Date | null;
  absenceLastAt: Date | null;
  absenceReason: string | null;
  absenceNotes: string | null;
  computedSide: AlignmentSide | null;
  gisDistanceCenterlineM?: number | null;
  gisDistanceEdgeM?: number | null;
}

/** Bản ghi đã chuẩn hóa nghiệp vụ – đầu vào duy nhất cho Column Registry. */
export interface ProgressRecord {
  kind: RecordKind;
  parcelId: string;
  unitId: string | null;
  zoneId: string;
  stationCode: string;
  side: AlignmentSide | null;
  areaLabel: string;
  startDate: Date | null;
  endDate: Date | null;
  houseNumber: string;
  street: string;
  ward: string;
  buildingName: string;
  ownerName: string;
  ownerPhone: string;
  usageFunction: string;
  lengthM: number | null;
  widthM: number | null;
  heightM: number | null;
  foundationType: string;
  foundationDepth: number | string | null;
  floorsLabel: string | number;
  totalRooms: number | null;
  constructionYear: number | string | null;
  condition: ConditionCode | null;
  ecsCondition: EcsConditionCode | null;
  braGrade: BraRiskCode | null;
  designUnit: string;
  constructionUnit: string;
  asBuilt: string;
  distanceCenterlineM: number | null;
  distanceEdgeM: number | null;
  surveyProgress: SurveyProgressCode | null;
  notes: string;
  hasFoundationInfo: boolean;
  isSurveyed: boolean;
  activityDates: Date[];
  /** Nội dung dòng tòa mẹ trên sheet (null với công trình độc lập). */
  masterLabel: string | null;
}

export interface CellStyle {
  fillArgb?: string;
  bold?: boolean;
  numFmt?: string;
  align?: 'left' | 'center' | 'right';
}

export type CellValue = string | number | Date | null;

export interface SummaryRow {
  label: string;
  needed: number;
  surveyed: number;
  inaccessible: number;
  withFoundation: number;
  monitor: number;
  highRisk: number;
}

export interface ProgressSummary {
  groups: SummaryRow[];
  total: SummaryRow;
}

export interface ProgressPreview {
  title: string;
  periodLabel: string;
  generatedAt: string;
  totalRows: number;
  summary: ProgressSummary;
  sampleRows: Array<Record<string, CellValue>>;
  columns: Array<{ key: string; header: string; group?: string }>;
  configVersion: number | null;
}
