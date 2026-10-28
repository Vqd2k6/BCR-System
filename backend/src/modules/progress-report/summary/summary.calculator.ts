import type { ProgressRecord, ProgressSummary, SummaryRow } from '../progress-report.types';
import type { ProgressReportConfig } from '../config/config.schema';

/**
 * Bảng tổng hợp cuối sheet: nhóm theo Phải/Trái tuyến (1 zone) hoặc "<Ga> <Phía>" (toàn tuyến).
 * - needed: toàn bộ công trình/căn hộ cần khảo sát trong phạm vi (không lọc thời gian).
 * - các chỉ tiêu còn lại: đếm trên tập bản ghi đã lọc theo kỳ báo cáo.
 */

function emptyRow(label: string): SummaryRow {
  return { label, needed: 0, surveyed: 0, inaccessible: 0, withFoundation: 0, monitor: 0, highRisk: 0 };
}

export function groupLabelOf(record: ProgressRecord, multiZone: boolean, config: ProgressReportConfig): string {
  const sideLabel =
    record.side === 'RIGHT'
      ? config.labels.sideRight
      : record.side === 'LEFT'
        ? config.labels.sideLeft
        : config.labels.sideUnknown || 'Chưa xác định';
  return multiZone ? `${record.stationCode} ${sideLabel}` : sideLabel;
}

export function calculateSummary(
  universe: ProgressRecord[],
  filtered: ProgressRecord[],
  multiZone: boolean,
  config: ProgressReportConfig
): ProgressSummary {
  const groups = new Map<string, SummaryRow>();
  const ensure = (label: string): SummaryRow => {
    let g = groups.get(label);
    if (!g) {
      g = emptyRow(label);
      groups.set(label, g);
    }
    return g;
  };

  // Luôn hiển thị 2 nhóm Phải/Trái trước (giống mẫu) khi xuất 1 zone
  if (!multiZone) {
    ensure(config.labels.sideRight);
    ensure(config.labels.sideLeft);
  }

  for (const r of universe) ensure(groupLabelOf(r, multiZone, config)).needed += 1;
  for (const r of filtered) {
    const g = ensure(groupLabelOf(r, multiZone, config));
    if (r.isSurveyed) g.surveyed += 1;
    if (r.condition === 'INACCESSIBLE') g.inaccessible += 1;
    if (r.hasFoundationInfo) g.withFoundation += 1;
    if (r.condition === 'MONITOR') g.monitor += 1;
    if (r.condition === 'HIGH_RISK') g.highRisk += 1;
  }

  const fixedLabels = new Set([config.labels.sideRight, config.labels.sideLeft]);
  const list = Array.from(groups.values()).filter(
    (g) => g.needed > 0 || g.surveyed > 0 || g.inaccessible > 0 || (!multiZone && fixedLabels.has(g.label))
  );
  const total = list.reduce<SummaryRow>(
    (acc, g) => ({
      label: 'TỔNG SỐ LƯỢNG',
      needed: acc.needed + g.needed,
      surveyed: acc.surveyed + g.surveyed,
      inaccessible: acc.inaccessible + g.inaccessible,
      withFoundation: acc.withFoundation + g.withFoundation,
      monitor: acc.monitor + g.monitor,
      highRisk: acc.highRisk + g.highRisk,
    }),
    emptyRow('TỔNG SỐ LƯỢNG')
  );
  return { groups: list, total };
}
