/**
 * Bộ lọc chỉ định đa tiêu chí (Cross-Layer Precision Filter) — hàm thuần, không phụ thuộc React.
 * Quy tắc:
 * - Trường null / undefined / mảng rỗng ⇒ không ràng buộc.
 * - Các tiêu chí ghép AND; trong 1 tập chọn (loại móng, cấp BRA…) là OR.
 * - Tiêu chí đang bật mà thửa chưa có giá trị ⇒ không khớp (thửa chưa đánh giá không lọt vào kết quả).
 */
import type {
  BasementFilterMode,
  FoundationBucket,
  ImpactCode,
  ParcelThematicMetrics,
  RiskLevelCode,
  StructureClass,
  ThematicPrecisionFilter,
  ThematicReportStatus,
} from '../types';
import { fmt2, FOUNDATION_TYPE_SCALE, RISK_LEVEL_LABEL, STRUCTURE_SCALE } from './thematicLayouts.registry';

export const EMPTY_PRECISION_FILTER: ThematicPrecisionFilter = {};

export const FOUNDATION_BUCKET_CODES: FoundationBucket[] = ['SHALLOW', 'WOOD', 'PRECAST_PILE', 'BORED_PILE', 'RAFT', 'OTHER', 'UNKNOWN'];
export const STRUCTURE_CLASS_CODES: StructureClass[] = ['RC', 'MIXED', 'MASONRY', 'STEEL', 'SUBSTANDARD', 'OTHER', 'UNKNOWN'];
export const RISK_LEVEL_CODES: RiskLevelCode[] = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
export const IMPACT_CODES: ImpactCode[] = ['I1', 'I2', 'I3', 'I4'];
export const REPORT_STATUS_CODES: ThematicReportStatus[] = ['APPROVED', 'UNDER_REVIEW', 'SUBMITTED'];
const BASEMENT_MODES: BasementFilterMode[] = ['ALL', 'HAS_BASEMENT', 'NO_BASEMENT'];

export const REPORT_STATUS_LABEL: Record<ThematicReportStatus, string> = {
  APPROVED: 'Đã duyệt',
  UNDER_REVIEW: 'Đang thẩm định',
  SUBMITTED: 'Chờ duyệt',
};

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** Giá trị nằm trong [min, max] (đầu mút nào trống thì bỏ). Khoảng đang bật mà giá trị null ⇒ false. */
function inRange(value: number | null, min: number | null | undefined, max: number | null | undefined): boolean {
  if (!isNum(min) && !isNum(max)) return true;
  if (value === null) return false;
  if (isNum(min) && value < min) return false;
  if (isNum(max) && value > max) return false;
  return true;
}

function inSet<T extends string>(value: T | null, set: readonly T[] | undefined): boolean {
  if (!set || set.length === 0) return true;
  return value !== null && set.includes(value);
}

export function hasActivePrecisionFilter(f: ThematicPrecisionFilter): boolean {
  return countActivePrecisionRules(f) > 0;
}

export function countActivePrecisionRules(f: ThematicPrecisionFilter): number {
  return describeActiveFilterChips(f).length;
}

export function matchesPrecisionFilter(metrics: ParcelThematicMetrics | undefined, f: ThematicPrecisionFilter): boolean {
  if (!hasActivePrecisionFilter(f)) return true;
  if (!metrics) return false;

  const yearActive = isNum(f.yearMin) || isNum(f.yearMax);
  if (!inRange(metrics.constructionYear, f.yearMin, f.yearMax)) return false;
  if (yearActive && f.excludeEstimatedYear && metrics.isYearEstimated) return false;

  if (!inRange(metrics.aboveFloors, f.aboveFloorsMin, f.aboveFloorsMax)) return false;
  if (f.basementMode === 'HAS_BASEMENT' && !(metrics.basementFloors !== null && metrics.basementFloors > 0)) return false;
  if (f.basementMode === 'NO_BASEMENT' && metrics.basementFloors !== 0) return false;

  if (!inSet(metrics.foundationBucket, f.foundationBuckets)) return false;
  if (!inSet(metrics.structureClass, f.structureClasses)) return false;
  if (!inRange(metrics.foundationCatScore, f.catMin, f.catMax)) return false;

  if (!inRange(metrics.totalEcs, f.ecsMin, f.ecsMax)) return false;
  if (!inRange(metrics.burlandMaxGrade, f.burlandMin, f.burlandMax)) return false;
  if (!inRange(metrics.avgViScore, f.viMin, f.viMax)) return false;

  if (!inSet(metrics.braLevel, f.braLevels)) return false;
  if (!inSet(metrics.impactCode, f.impactCodes)) return false;
  if (!inSet(metrics.reportStatus, f.reportStatuses)) return false;
  return true;
}

export interface ActiveFilterChip {
  key: string;
  label: string;
  clear: (f: ThematicPrecisionFilter) => ThematicPrecisionFilter;
}

function rangeText(min: number | null | undefined, max: number | null | undefined, fmt: (n: number) => string = String): string {
  if (isNum(min) && isNum(max)) return min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
  if (isNum(min)) return `≥ ${fmt(min)}`;
  return isNum(max) ? `≤ ${fmt(max)}` : '';
}

const labelOf = (buckets: { key: string; label: string }[], key: string): string =>
  buckets.find((b) => b.key === key)?.label.split(' (')[0] ?? key;

/** Chip tóm tắt từng tiêu chí đang bật; bấm × gỡ đúng tiêu chí đó. */
export function describeActiveFilterChips(f: ThematicPrecisionFilter): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (isNum(f.yearMin) || isNum(f.yearMax)) {
    chips.push({
      key: 'year',
      label: `Năm XD: ${rangeText(f.yearMin, f.yearMax)}${f.excludeEstimatedYear ? ' (bỏ ước lượng)' : ''}`,
      clear: (x) => ({ ...x, yearMin: null, yearMax: null, excludeEstimatedYear: false }),
    });
  }
  if (isNum(f.aboveFloorsMin) || isNum(f.aboveFloorsMax)) {
    chips.push({
      key: 'floors',
      label: `Số tầng nổi: ${rangeText(f.aboveFloorsMin, f.aboveFloorsMax)}`,
      clear: (x) => ({ ...x, aboveFloorsMin: null, aboveFloorsMax: null }),
    });
  }
  if (f.basementMode && f.basementMode !== 'ALL') {
    chips.push({
      key: 'basement',
      label: f.basementMode === 'HAS_BASEMENT' ? 'Có tầng hầm' : 'Không có tầng hầm',
      clear: (x) => ({ ...x, basementMode: 'ALL' }),
    });
  }
  if (f.foundationBuckets && f.foundationBuckets.length > 0) {
    chips.push({
      key: 'foundation',
      label: `Móng: ${f.foundationBuckets.map((k) => labelOf(FOUNDATION_TYPE_SCALE.buckets, k)).join(', ')}`,
      clear: (x) => ({ ...x, foundationBuckets: [] }),
    });
  }
  if (f.structureClasses && f.structureClasses.length > 0) {
    chips.push({
      key: 'structure',
      label: `Kết cấu: ${f.structureClasses.map((k) => labelOf(STRUCTURE_SCALE.buckets, k)).join(', ')}`,
      clear: (x) => ({ ...x, structureClasses: [] }),
    });
  }
  if (isNum(f.catMin) || isNum(f.catMax)) {
    chips.push({ key: 'cat', label: `CAT móng: ${rangeText(f.catMin, f.catMax)}`, clear: (x) => ({ ...x, catMin: null, catMax: null }) });
  }
  if (isNum(f.ecsMin) || isNum(f.ecsMax)) {
    chips.push({ key: 'ecs', label: `ECS: ${rangeText(f.ecsMin, f.ecsMax)}`, clear: (x) => ({ ...x, ecsMin: null, ecsMax: null }) });
  }
  if (isNum(f.burlandMin) || isNum(f.burlandMax)) {
    chips.push({
      key: 'burland',
      label: `Burland: Cấp ${rangeText(f.burlandMin, f.burlandMax)}`,
      clear: (x) => ({ ...x, burlandMin: null, burlandMax: null }),
    });
  }
  if (isNum(f.viMin) || isNum(f.viMax)) {
    chips.push({ key: 'vi', label: `VI: ${rangeText(f.viMin, f.viMax, fmt2)}`, clear: (x) => ({ ...x, viMin: null, viMax: null }) });
  }
  if (f.braLevels && f.braLevels.length > 0) {
    chips.push({
      key: 'bra',
      label: `BRA: ${f.braLevels.map((k) => RISK_LEVEL_LABEL[k]).join(', ')}`,
      clear: (x) => ({ ...x, braLevels: [] }),
    });
  }
  if (f.impactCodes && f.impactCodes.length > 0) {
    chips.push({ key: 'impact', label: `Tác động: ${f.impactCodes.join(', ')}`, clear: (x) => ({ ...x, impactCodes: [] }) });
  }
  if (f.reportStatuses && f.reportStatuses.length > 0) {
    chips.push({
      key: 'status',
      label: `Hồ sơ: ${f.reportStatuses.map((k) => REPORT_STATUS_LABEL[k]).join(', ')}`,
      clear: (x) => ({ ...x, reportStatuses: [] }),
    });
  }
  return chips;
}

// ─── Đọc an toàn từ sessionStorage ──────────────────────────────────────────

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function readNum(src: Record<string, unknown>, key: string): number | null {
  const v = src[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function readCodes<T extends string>(src: Record<string, unknown>, key: string, allowed: readonly T[]): T[] {
  const v = src[key];
  if (!Array.isArray(v)) return [];
  return allowed.filter((code) => v.includes(code));
}

/** Chuẩn hóa dữ liệu lạ (sessionStorage hỏng / phiên bản cũ) về bộ lọc hợp lệ; bỏ mọi trường không nhận ra. */
export function sanitizeStoredFilter(raw: unknown): ThematicPrecisionFilter {
  if (!isRecord(raw)) return EMPTY_PRECISION_FILTER;
  const basement = raw.basementMode;
  return {
    yearMin: readNum(raw, 'yearMin'),
    yearMax: readNum(raw, 'yearMax'),
    excludeEstimatedYear: raw.excludeEstimatedYear === true,
    aboveFloorsMin: readNum(raw, 'aboveFloorsMin'),
    aboveFloorsMax: readNum(raw, 'aboveFloorsMax'),
    basementMode: BASEMENT_MODES.find((m) => m === basement) ?? 'ALL',
    foundationBuckets: readCodes(raw, 'foundationBuckets', FOUNDATION_BUCKET_CODES),
    structureClasses: readCodes(raw, 'structureClasses', STRUCTURE_CLASS_CODES),
    catMin: readNum(raw, 'catMin'),
    catMax: readNum(raw, 'catMax'),
    ecsMin: readNum(raw, 'ecsMin'),
    ecsMax: readNum(raw, 'ecsMax'),
    burlandMin: readNum(raw, 'burlandMin'),
    burlandMax: readNum(raw, 'burlandMax'),
    viMin: readNum(raw, 'viMin'),
    viMax: readNum(raw, 'viMax'),
    braLevels: readCodes(raw, 'braLevels', RISK_LEVEL_CODES),
    impactCodes: readCodes(raw, 'impactCodes', IMPACT_CODES),
    reportStatuses: readCodes(raw, 'reportStatuses', REPORT_STATUS_CODES),
  };
}
