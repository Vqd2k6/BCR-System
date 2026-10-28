import type { CellStyle, CellValue, ProgressRecord, ProgressSummary } from '../progress-report.types';
import type { ProgressReportConfig } from '../config/config.schema';

/**
 * COLUMN REGISTRY – mỗi cột Excel là 1 ColumnDefinition độc lập, resolve() thuần.
 * Thêm/bớt/đổi cột = sửa mảng cột của template, KHÔNG sửa engine/renderer.
 */

export interface RenderContext {
  config: ProgressReportConfig;
  rowIndex: number; // 0-based trong danh sách dữ liệu
}

export interface ColumnDefinition {
  key: string;
  header: string;
  group?: string; // tiêu đề tầng 1 gộp nhiều cột (VD "Địa chỉ Công Trình")
  width: number;
  numFmt?: string;
  align?: 'left' | 'center' | 'right';
  resolve: (r: ProgressRecord, ctx: RenderContext) => CellValue;
  style?: (r: ProgressRecord, ctx: RenderContext) => CellStyle | undefined;
}

export interface LegendItem {
  text: string;
  span: number; // số cột gộp
  colorKey?: 'MONITOR' | 'HIGH_RISK' | 'INACCESSIBLE';
}

export interface LegendRow {
  label: string;
  labelSpan: number;
  items: LegendItem[];
}

export interface TemplateHeaderContext {
  config: ProgressReportConfig;
  stationLabel: string; // "GA ST05" | "TOÀN TUYẾN" | "ZONE_08"
  periodLabel: string;
}

export interface ProgressTemplate {
  id: string;
  name: string;
  buildTitle: (ctx: TemplateHeaderContext) => string;
  legend: (config: ProgressReportConfig) => LegendRow[];
  columns: ColumnDefinition[];
  /** Có render bảng tổng hợp cuối sheet hay không. */
  includeSummary: boolean;
}

/** Bảng đã resolve – định dạng trung lập, renderer (Excel/PDF/CSV) chỉ việc vẽ. */
export interface ResolvedTable {
  templateId: string;
  title: string;
  periodLabel: string;
  generatedAtLabel: string;
  legend: LegendRow[];
  columns: Array<Pick<ColumnDefinition, 'key' | 'header' | 'group' | 'width' | 'numFmt' | 'align'>>;
  rows: Array<{ values: CellValue[]; styles: Array<CellStyle | undefined> }>;
  summary: ProgressSummary | null;
  colors: ProgressReportConfig['colors'];
}

