import type { GisParcel, ThematicMapBinding, ThematicParcelStyle } from '../../../components/gis/shared/types';
import { isNonBuildingParcel } from '../../../components/gis/sweep-map/utils/sweepMapHelpers';
import type { ParcelThematicMetrics } from '../types';
import { bucketOf, DEFAULT_FILL_OPACITY, NON_BUILDING_BUCKET, UNASSESSED_BUCKET } from './thematicLayouts.registry';
import type { ThematicBucket, ThematicScale } from './thematicLayouts.registry';

/** Viền tách khỏi màu nền để thửa kề nhau cùng nhóm không dính thành 1 khối. */
const PARCEL_STROKE = '#334155';
const CONDO_STROKE = '#7c3aed';
const UNASSESSED_STROKE = '#94a3b8';

/** Kiểu thửa không khớp bộ lọc ở chế độ "Làm mờ nền". */
export const DIMMED_FILL_OPACITY = 0.06;
export const DIMMED_WEIGHT = 0.6;

/**
 * Nhóm của 1 thửa trên thang đang xem.
 * Thửa đã có giá trị chỉ số luôn được tô theo giá trị đó — không bao giờ bị xếp vào "phi công trình"
 * (isNonBuildingParcel coi constructionArea = 0 là phi công trình, mà parcel chưa có số liệu diện tích cũng = 0).
 */
export function classifyParcelBucket(
  parcel: GisParcel,
  metrics: ParcelThematicMetrics | undefined,
  scale: ThematicScale
): string {
  const key = metrics ? scale.classify(metrics) : null;
  if (key !== null) return key;
  if (metrics?.isVacantLand || isNonBuildingParcel(parcel)) return NON_BUILDING_BUCKET.key;
  return UNASSESSED_BUCKET.key;
}

export function allBuckets(scale: ThematicScale): ThematicBucket[] {
  return [...scale.buckets, UNASSESSED_BUCKET, NON_BUILDING_BUCKET];
}

export interface BucketCount {
  /** Số thửa của nhóm trong toàn Zone đang hiển thị. */
  total: number;
  /** Số thửa của nhóm khớp bộ lọc chỉ định (= total khi không lọc). */
  matched: number;
}

/**
 * Đếm theo nhóm. `precisionMatched` chỉ là kết quả lọc chỉ định (không gồm lọc nhóm trên chú giải),
 * để chú giải luôn cho thấy phân bố của tập đang phân tích ở mọi nhóm.
 */
export function computeBucketCounts(
  parcels: GisParcel[],
  metricsById: ReadonlyMap<string, ParcelThematicMetrics>,
  scale: ThematicScale,
  precisionMatched: ReadonlySet<string> | null
): Record<string, BucketCount> {
  const counts: Record<string, BucketCount> = {};
  for (const b of allBuckets(scale)) counts[b.key] = { total: 0, matched: 0 };
  for (const p of parcels) {
    const key = classifyParcelBucket(p, metricsById.get(p.id), scale);
    const c = counts[key] ?? { total: 0, matched: 0 };
    c.total += 1;
    if (!precisionMatched || precisionMatched.has(p.id)) c.matched += 1;
    counts[key] = c;
  }
  return counts;
}

export const REPORT_STATUS_LINE: Record<string, string> = {
  APPROVED: 'Hồ sơ đã phê duyệt',
  UNDER_REVIEW: 'Hồ sơ đang thẩm định (chưa phê duyệt)',
  SUBMITTED: 'Hồ sơ đã nộp, chờ thẩm định',
};

export function parcelDisplayCode(parcel: GisParcel): string {
  return parcel.officialCadastralCode || parcel.projectParcelCode || parcel.id;
}

interface BuildBindingArgs {
  layoutLabel: string;
  scale: ThematicScale;
  metricsById: ReadonlyMap<string, ParcelThematicMetrics>;
  /** Tập thửa khớp (lọc nhóm chú giải ∩ lọc chỉ định); null ⇒ không lọc. */
  matchedIds: ReadonlySet<string> | null;
}

export function buildThematicBinding({ layoutLabel, scale, metricsById, matchedIds }: BuildBindingArgs): ThematicMapBinding {
  const resolveStyle = (parcel: GisParcel): ThematicParcelStyle => {
    const metrics = metricsById.get(parcel.id);
    const key = classifyParcelBucket(parcel, metrics, scale);
    const bucket = bucketOf(scale, key);
    const dimmed = matchedIds !== null && !matchedIds.has(parcel.id);
    const isCondo = parcel.buildingType === 'CONDOMINIUM' || Boolean(metrics?.isCondoMaster);
    const isUnassessed = key === UNASSESSED_BUCKET.key || key === NON_BUILDING_BUCKET.key;
    const pending = Boolean(metrics?.reportStatus && metrics.reportStatus !== 'APPROVED');
    if (dimmed) {
      return { fillHex: bucket.hex, strokeHex: UNASSESSED_STROKE, fillOpacity: DIMMED_FILL_OPACITY, weight: DIMMED_WEIGHT };
    }
    return {
      fillHex: bucket.hex,
      strokeHex: isCondo ? CONDO_STROKE : isUnassessed ? UNASSESSED_STROKE : PARCEL_STROKE,
      fillOpacity: bucket.fillOpacity ?? DEFAULT_FILL_OPACITY,
      weight: isCondo ? 2.2 : 1,
      // Hồ sơ chưa phê duyệt: viền nét đứt để không lẫn với số liệu đã duyệt
      dashArray: pending ? '5 4' : undefined,
    };
  };

  const tooltipLines = (parcel: GisParcel): string[] => {
    const metrics = metricsById.get(parcel.id);
    const lines = [parcelDisplayCode(parcel)];
    const value = metrics ? scale.valueText(metrics) : null;
    if (value) lines.push(value);
    else if (classifyParcelBucket(parcel, metrics, scale) === NON_BUILDING_BUCKET.key) lines.push(NON_BUILDING_BUCKET.label);
    else lines.push('Chưa có số liệu cho chỉ số này');
    lines.push(metrics?.reportStatus ? REPORT_STATUS_LINE[metrics.reportStatus] : 'Chưa có hồ sơ đã nộp');
    if (metrics?.isCondoMaster || parcel.buildingType === 'CONDOMINIUM') lines.push('Chung cư: số liệu theo Báo cáo Master');
    return lines;
  };

  return {
    layoutLabel,
    resolveStyle,
    tooltipLines,
    legendRows: allBuckets(scale).map((b) => ({ key: b.key, hex: b.hex, label: b.label })),
  };
}
