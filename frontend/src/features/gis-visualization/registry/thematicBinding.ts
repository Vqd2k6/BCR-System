import type { GisParcel, ThematicMapBinding, ThematicParcelStyle } from '../../../components/gis/shared/types';
import { isNonBuildingParcel } from '../../../components/gis/sweep-map/utils/sweepMapHelpers';
import type { ParcelThematicMetrics } from '../types';
import { NON_BUILDING_BUCKET, UNASSESSED_BUCKET } from './thematicLayouts.registry';
import type { ThematicBucket, ThematicScale } from './thematicLayouts.registry';

const CONDO_STROKE = '#7c3aed';

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

export function computeBucketCounts(
  parcels: GisParcel[],
  metricsById: ReadonlyMap<string, ParcelThematicMetrics>,
  scale: ThematicScale
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of allBuckets(scale)) counts[b.key] = 0;
  for (const p of parcels) {
    const key = classifyParcelBucket(p, metricsById.get(p.id), scale);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

const STATUS_LINE: Record<string, string> = {
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
  /** Nhóm đang được lọc trên chú giải; rỗng ⇒ không lọc. */
  activeBuckets: ReadonlySet<string>;
}

export function buildThematicBinding({ layoutLabel, scale, metricsById, activeBuckets }: BuildBindingArgs): ThematicMapBinding {
  const hexByKey = new Map(allBuckets(scale).map((b) => [b.key, b.hex]));

  const resolveStyle = (parcel: GisParcel): ThematicParcelStyle => {
    const metrics = metricsById.get(parcel.id);
    const key = classifyParcelBucket(parcel, metrics, scale);
    const hex = hexByKey.get(key) ?? UNASSESSED_BUCKET.hex;
    const dimmed = activeBuckets.size > 0 && !activeBuckets.has(key);
    const isCondo = parcel.buildingType === 'CONDOMINIUM' || Boolean(metrics?.isCondoMaster);
    const pending = Boolean(metrics?.reportStatus && metrics.reportStatus !== 'APPROVED');
    const baseOpacity = key === NON_BUILDING_BUCKET.key ? 0.15 : key === UNASSESSED_BUCKET.key ? 0.25 : 0.7;
    return {
      fillHex: hex,
      strokeHex: isCondo && !dimmed ? CONDO_STROKE : hex,
      fillOpacity: dimmed ? 0.06 : baseOpacity,
      weight: dimmed ? 0.6 : isCondo ? 2.5 : 1.2,
      // Hồ sơ chưa phê duyệt: viền nét đứt để không lẫn với số liệu đã duyệt
      dashArray: pending && !dimmed ? '5 4' : undefined,
    };
  };

  const tooltipLines = (parcel: GisParcel): string[] => {
    const metrics = metricsById.get(parcel.id);
    const lines = [parcelDisplayCode(parcel)];
    const value = metrics ? scale.valueText(metrics) : null;
    if (value) lines.push(value);
    else if (classifyParcelBucket(parcel, metrics, scale) === NON_BUILDING_BUCKET.key) lines.push(NON_BUILDING_BUCKET.label);
    else lines.push('Chưa có số liệu cho chỉ số này');
    lines.push(metrics?.reportStatus ? STATUS_LINE[metrics.reportStatus] : 'Chưa có hồ sơ đã nộp');
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
