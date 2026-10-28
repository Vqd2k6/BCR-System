/**
 * Kiểu dữ liệu plugin Progress Report (Frontend) – khớp contract API /progress-report.
 */

export type ProgressTimeMode = 'TODAY' | 'DATE_RANGE' | 'ALL_TIME';

export interface ProgressQueryParams {
  zoneId: string;
  timeMode: ProgressTimeMode;
  fromDate?: string;
  toDate?: string;
}

export interface ProgressSummaryRow {
  label: string;
  needed: number;
  surveyed: number;
  inaccessible: number;
  withFoundation: number;
  monitor: number;
  highRisk: number;
}

export type ProgressCellValue = string | number | null;

export interface ProgressPreviewData {
  title: string;
  periodLabel: string;
  generatedAt: string;
  totalRows: number;
  summary: { groups: ProgressSummaryRow[]; total: ProgressSummaryRow };
  sampleRows: Array<Record<string, ProgressCellValue>>;
  columns: Array<{ key: string; header: string; group?: string }>;
  configVersion: number | null;
}

export interface RiskRule {
  ecsClasses: string[];
  braValues: string[];
  burlandMin: number | null;
}

export interface SideOverrideRule {
  ward: string;
  street: string;
  houseNumbers: string[];
  side: 'RIGHT' | 'LEFT';
  force: boolean;
}

export interface ProgressReportConfig {
  titlePrefix: string;
  newBuildingMinYear: number;
  highRisk: RiskRule;
  monitor: RiskRule & { includeMonitoringRequired: boolean };
  degraded: { ecsClasses: string[] };
  includeNotSurveyedRows: boolean;
  labels: {
    condition: Record<'NEW' | 'OLD' | 'DEGRADED' | 'MONITOR' | 'HIGH_RISK' | 'INACCESSIBLE', string>;
    ecs: Record<'GOOD' | 'MEDIUM' | 'DEFICIENT' | 'CRITICAL' | 'INACCESSIBLE', string>;
    bra: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH', string>;
    surveyProgress: Record<'IN_PROGRESS' | 'SURVEY_DONE_REPORTING' | 'REPORT_DONE' | 'REPORT_SIGNED', string>;
    sideRight: string;
    sideLeft: string;
    sideUnknown: string;
  };
  colors: Record<'header' | 'legend' | 'total' | 'MONITOR' | 'HIGH_RISK' | 'INACCESSIBLE', string>;
  sideOverrides: SideOverrideRule[];
}

export interface ProgressConfigVersion {
  versionNumber: number;
  changeReason: string;
  createdAt: string;
  createdByName: string | null;
}

export interface ProgressConfigResponse {
  config: ProgressReportConfig;
  version: number | null;
  source: 'DB' | 'DEFAULT';
  defaults: ProgressReportConfig;
  versions: ProgressConfigVersion[];
}
