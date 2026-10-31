import type { TableDivider } from '../columns/column.types';
import type { ProgressRecord } from '../progress-report.types';

/**
 * Bố cục sheet: Phần I nhà dân → Phần II chung cư (gom căn hộ theo tòa mẹ).
 * Giữ nguyên thứ tự đầu vào trong từng nhóm (datasource đã sắp zone → mã thửa → tầng → mã căn).
 * Dòng phân khối là dòng trình bày: không đếm STT, không vào bảng tổng hợp.
 */

export const SECTION_BUILDINGS_LABEL = 'I. CÔNG TRÌNH NHÀ DÂN DỤNG RIÊNG LẺ';
export const SECTION_CONDOS_LABEL = 'II. KHỐI NHÀ CHUNG CƯ & CĂN HỘ CON';

export interface ArrangedRecords {
  ordered: ProgressRecord[];
  dividers: TableDivider[];
}

export function arrangeRecords(records: ProgressRecord[]): ArrangedRecords {
  const buildings = records.filter((r) => r.kind === 'BUILDING');
  const towers = new Map<string, ProgressRecord[]>();
  for (const r of records) {
    if (r.kind !== 'CONDO_UNIT') continue;
    const units = towers.get(r.parcelId);
    if (units) units.push(r);
    else towers.set(r.parcelId, [r]);
  }

  const ordered: ProgressRecord[] = [...buildings];
  const dividers: TableDivider[] = [];
  if (buildings.length > 0) {
    dividers.push({ beforeRowIndex: 0, kind: 'SECTION', label: SECTION_BUILDINGS_LABEL });
  }
  if (towers.size > 0) {
    dividers.push({ beforeRowIndex: ordered.length, kind: 'SECTION', label: SECTION_CONDOS_LABEL });
  }
  for (const units of towers.values()) {
    dividers.push({ beforeRowIndex: ordered.length, kind: 'MASTER', label: units[0].masterLabel ?? '' });
    ordered.push(...units);
  }
  return { ordered, dividers };
}
