import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { GisParcel, ThematicMapBinding } from '../../../components/gis/shared/types';
import { getErrorMessage } from '../../../utils/errorUtils';
import { fetchZoneThematic } from '../api/gisVisualization.api';
import { ThematicMapOverlay } from '../components/ThematicMapOverlay';
import { allBuckets, buildThematicBinding, computeBucketCounts } from '../registry/thematicBinding';
import { getLayoutDef, isThematicLayoutId, THEMATIC_LAYOUTS } from '../registry/thematicLayouts.registry';
import type { GisThematicLayoutId, ParcelThematicMetrics, ThematicSubModeId } from '../types';

const STORAGE_KEY = 'metro2_gis_thematic_layout';
const CACHE_TTL_MS = 2 * 60 * 1000;

/** Cache theo Zone trong phiên: đổi qua lại giữa các layout không gọi lại API. */
const cache = new Map<string, { at: number; metrics: Map<string, ParcelThematicMetrics> }>();

const isAllZones = (zone: string): boolean => {
  const z = zone.trim().toUpperCase();
  return z === '' || z === 'ALL' || z === 'ALL_ZONES';
};

function readStoredLayout(): { layoutId: GisThematicLayoutId; subMode: ThematicSubModeId | null } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && 'layoutId' in parsed && isThematicLayoutId(parsed.layoutId)) {
        const def = getLayoutDef(parsed.layoutId);
        const sub = 'subMode' in parsed ? parsed.subMode : null;
        const validSub = def.subModes.find((s) => s.id === sub)?.id ?? def.subModes[0]?.id ?? null;
        return { layoutId: def.id, subMode: validSub };
      }
    }
  } catch (err: unknown) {
    console.error('[GisVisualization:readStoredLayout] Không đọc được layout đã lưu', err);
  }
  return { layoutId: 'WORKFLOW', subMode: null };
}

interface UseThematicMapArgs {
  zoneId: string;
  parcels: GisParcel[];
  /** false ⇒ không bao giờ gọi API và không hiện bộ chọn (Khảo sát viên). */
  enabled: boolean;
  /** true ⇒ nạp dữ liệu cả khi đang ở WORKFLOW (Guest cần cấp BRA thật cho thẻ / bảng / biểu đồ). */
  prefetch?: boolean;
}

export interface UseThematicMapResult {
  /** Truyền vào LeafletSweepMap.thematic; null ⇒ bản đồ tác nghiệp. */
  binding: ThematicMapBinding | null;
  /** Truyền vào LeafletSweepMap.thematicOverlay. */
  overlay: ReactNode;
  /** Chỉ số theo parcelId của Zone đang xem (rỗng khi chưa tải). */
  metricsById: ReadonlyMap<string, ParcelThematicMetrics>;
}

const EMPTY_METRICS: ReadonlyMap<string, ParcelThematicMetrics> = new Map();

export function useThematicMap({ zoneId, parcels, enabled, prefetch = false }: UseThematicMapArgs): UseThematicMapResult {
  const [{ layoutId, subMode }, setSelection] = useState(readStoredLayout);
  const [activeBuckets, setActiveBuckets] = useState<ReadonlySet<string>>(() => new Set());
  const [metricsById, setMetricsById] = useState<ReadonlyMap<string, ParcelThematicMetrics>>(EMPTY_METRICS);
  const [loadedZone, setLoadedZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zoneAll = isAllZones(zoneId);
  const effectiveLayout: GisThematicLayoutId = enabled && !zoneAll ? layoutId : 'WORKFLOW';
  const shouldFetch = enabled && !zoneAll && (prefetch || layoutId !== 'WORKFLOW');

  useEffect(() => {
    if (!shouldFetch) return;
    const cached = cache.get(zoneId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setMetricsById(cached.metrics);
      setLoadedZone(zoneId);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetchZoneThematic(zoneId, controller.signal)
      .then((payload) => {
        const map = new Map(payload.parcels.map((m) => [m.parcelId, m]));
        cache.set(zoneId, { at: Date.now(), metrics: map });
        setMetricsById(map);
        setLoadedZone(zoneId);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error('[GisVisualization:fetch] Lỗi tải dữ liệu chuyên đề Zone', zoneId, err);
        setError(getErrorMessage(err));
        setSelection({ layoutId: 'WORKFLOW', subMode: null });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      // Request bị hủy không chạy finally → tự hạ cờ tải để không treo spinner khi đổi Zone
      setLoading(false);
    };
  }, [shouldFetch, zoneId]);

  // Đổi Zone / layout / sub-mode thì bỏ lọc nhóm của thang cũ
  useEffect(() => {
    setActiveBuckets(new Set());
  }, [zoneId, layoutId, subMode]);

  const changeLayout = useCallback((id: GisThematicLayoutId) => {
    const def = getLayoutDef(id);
    const next = { layoutId: def.id, subMode: def.subModes[0]?.id ?? null };
    setSelection(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err: unknown) {
      console.error('[GisVisualization:changeLayout] Không lưu được layout', err);
    }
  }, []);

  const changeSubMode = useCallback((id: ThematicSubModeId) => {
    setSelection((prev) => {
      const next = { ...prev, subMode: id };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err: unknown) {
        console.error('[GisVisualization:changeSubMode] Không lưu được sub-mode', err);
      }
      return next;
    });
  }, []);

  const toggleBucket = useCallback((key: string) => {
    setActiveBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const clearBuckets = useCallback(() => setActiveBuckets(new Set()), []);

  const currentMetrics = loadedZone === zoneId ? metricsById : EMPTY_METRICS;
  const layoutDef = getLayoutDef(effectiveLayout);
  const scale = layoutDef.scaleFor(subMode);
  const dataReady = loadedZone === zoneId && !loading;

  const binding = useMemo<ThematicMapBinding | null>(() => {
    if (!scale || !dataReady) return null;
    const subLabel = layoutDef.subModes.find((s) => s.id === subMode)?.label;
    return buildThematicBinding({
      layoutLabel: subLabel ? `${layoutDef.label} · ${subLabel}` : layoutDef.label,
      scale,
      metricsById: currentMetrics,
      activeBuckets,
    });
  }, [scale, dataReady, layoutDef, subMode, currentMetrics, activeBuckets]);

  const counts = useMemo(
    () => (scale && dataReady ? computeBucketCounts(parcels, currentMetrics, scale) : null),
    [scale, dataReady, parcels, currentMetrics]
  );

  const overlay = enabled ? (
    <ThematicMapOverlay
      layouts={THEMATIC_LAYOUTS}
      layoutId={effectiveLayout}
      onChangeLayout={changeLayout}
      subMode={subMode}
      onChangeSubMode={changeSubMode}
      isZoneAll={zoneAll}
      loading={loading && effectiveLayout !== 'WORKFLOW'}
      error={error}
      onDismissError={() => setError(null)}
      legend={
        scale && counts
          ? {
              buckets: allBuckets(scale),
              counts,
              total: parcels.length,
              activeBuckets,
              onToggleBucket: toggleBucket,
              onClearBuckets: clearBuckets,
            }
          : null
      }
    />
  ) : null;

  return { binding, overlay, metricsById: currentMetrics };
}
