import type { ProgressFilter, RawProgressRow } from '../progress-report.types';

/**
 * Interface DataSource – lớp 1 của kiến trúc plugin.
 * Thay nguồn dữ liệu (VD: snapshot, API khác) chỉ cần cài đặt interface này.
 */
export interface ProgressDataSource {
  /** Toàn bộ "vũ trụ" công trình/căn hộ của phạm vi zone (không lọc thời gian). */
  fetchRows(filter: Pick<ProgressFilter, 'zoneId'>): Promise<RawProgressRow[]>;
  /** Tên hiển thị của zone (VD: "Zone 9: Ga S5 Lê Thị Riêng (C&C)"). */
  fetchZoneName(zoneId: string): Promise<string | null>;
}

