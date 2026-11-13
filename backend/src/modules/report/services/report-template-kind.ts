/**
 * Phân loại hồ sơ để chọn bộ template report (plan report chung cư, chốt 13/11/2026):
 * - STANDALONE: nhà dân / công trình độc lập (template `residential`, giữ nguyên).
 * - BUILDING_MASTER: hồ sơ Tòa mẹ chung cư (`unit_id IS NULL` trên thửa chung cư).
 * - MASTER_AREA: khu vực dùng chung (`building_units.unit_type = 'MASTER'`).
 * - CONDO_UNIT: căn hộ con (`building_units.unit_type = 'UNIT'`).
 *
 * Hồ sơ có `unit_id` luôn là chung cư dù `building_type` của thửa bị ghi sai; phân biệt M/U dùng chung
 * bộ phân loại của phân hệ thẩm định để report và màn thẩm định không bao giờ lệch nhau.
 */

import { classifyCondoEntityKind } from '../../audit/condo/condo-entity-classifier';

export type ReportTemplateKind = 'STANDALONE' | 'BUILDING_MASTER' | 'MASTER_AREA' | 'CONDO_UNIT';

const CONDO_BUILDING_TYPES = new Set(['CONDOMINIUM', 'CONDO']);

function readText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function isCondoBuildingType(buildingType: unknown): boolean {
  return CONDO_BUILDING_TYPES.has(String(buildingType ?? '').trim().toUpperCase());
}

export function resolveReportTemplateKind(rawReport: Record<string, unknown>): ReportTemplateKind {
  const unitId = readText(rawReport.unit_id);
  if (unitId) {
    const kind = classifyCondoEntityKind({
      unitId,
      unitType: readText(rawReport.unit_type),
      unitCode: readText(rawReport.unit_code),
      reportType: readText(rawReport.report_type),
    });
    return kind === 'MASTER_AREA' ? 'MASTER_AREA' : 'CONDO_UNIT';
  }
  return isCondoBuildingType(rawReport.building_type) ? 'BUILDING_MASTER' : 'STANDALONE';
}

export function isCondoChildKind(kind: ReportTemplateKind): kind is 'MASTER_AREA' | 'CONDO_UNIT' {
  return kind === 'MASTER_AREA' || kind === 'CONDO_UNIT';
}
