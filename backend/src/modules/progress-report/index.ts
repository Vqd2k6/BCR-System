/**
 * ============================================================================
 * PROGRESS REPORT PLUGIN – ĐIỂM CẮM DUY NHẤT
 *
 * Đăng ký trong app.ts bằng 1 dòng:
 *   api.use('/progress-report', createProgressReportRouter());
 * Gỡ module: xóa dòng trên + thư mục này (+ bảng progress_report_config_versions nếu muốn).
 *
 * Kiến trúc: DataSource (data/) → Rules (rules/, pure) → Column Registry (columns/)
 *            → Renderer (render/) → Delivery (delivery/). Config: config/ (DB append-only + DEFAULT).
 * ============================================================================
 */
export { createProgressReportRouter } from './progress-report.routes';
export { ProgressReportService } from './progress-report.service';
export type { ProgressDataSource } from './data/progress.datasource';
export type { ProgressRenderer } from './render/renderer.types';
export type { ColumnDefinition, ProgressTemplate } from './columns/column.types';

