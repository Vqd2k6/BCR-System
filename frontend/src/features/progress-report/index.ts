/**
 * PROGRESS REPORT PLUGIN (Frontend) – public API duy nhất.
 * Màn hình khác chỉ được import từ file này:
 *   - <ProgressReportExportButton zoneId="ZONE_09" />  (nút + modal xuất file tiến độ)
 *   - <ProgressConfigTab />                              (cấu hình, chỉ SUPER_ADMIN)
 * Gỡ plugin: xóa các dòng nhúng trên + thư mục features/progress-report.
 */
export { ProgressReportExportButton } from './components/ProgressReportExportButton';
export type { ProgressReportExportButtonProps } from './components/ProgressReportExportButton';
export { ProgressConfigTab } from './components/ProgressConfigTab';
