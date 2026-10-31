import type { CondoEntityKind } from './condo-audit.types';

/**
 * Phân loại thực thể Chung cư theo `building_units.unit_type` (CHECK chỉ cho phép 'UNIT' | 'MASTER').
 * Mã phòng do Admin đặt tự do (`M-001`, `06.01`, `TER-02`...) nên tiền tố mã chỉ dùng cho bản ghi
 * chưa có `unit_type`, và `report_type` không phân biệt được vì khu vực chung cũng mang `CONDO_UNIT`.
 */
export const CONDO_AREA_UNIT_SQL = `(bu.unit_type = 'MASTER' OR (bu.unit_type IS NULL AND (bu.unit_code LIKE 'M-%' OR bu.unit_code LIKE 'MA-%' OR bu.unit_code LIKE 'AREA-%')))`;

export interface CondoEntityClassifierInput {
  unitId?: string | null;
  unitType?: string | null;
  unitCode?: string | null;
  reportType?: string | null;
}

export function isCondoAreaUnit(unitType?: string | null, unitCode?: string | null): boolean {
  const type = String(unitType || '').toUpperCase();
  if (type === 'MASTER' || type === 'MASTER_AREA') return true;
  if (type) return false;
  const code = String(unitCode || '').toUpperCase();
  return code.startsWith('M-') || code.startsWith('MA-') || code.startsWith('AREA-');
}

export function classifyCondoEntityKind(input: CondoEntityClassifierInput): CondoEntityKind {
  const reportType = String(input.reportType || '').toUpperCase();
  if (!input.unitId && ['BUILDING_MASTER', 'CONDO_MASTER', 'STANDALONE', ''].includes(reportType)) {
    return 'BUILDING_MASTER';
  }
  if (reportType === 'MASTER_AREA' || isCondoAreaUnit(input.unitType, input.unitCode)) {
    return 'MASTER_AREA';
  }
  return 'CONDO_UNIT';
}
