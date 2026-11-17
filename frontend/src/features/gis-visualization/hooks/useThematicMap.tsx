import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { GisParcel, ThematicFilterMatch, ThematicMapBinding } from '../../../components/gis/shared/types';
import { getErrorMessage } from '../../../utils/errorUtils';
import { fetchZoneThematic } from '../api/gisVisualization.api';
import { ParcelThematicMetricsGrid } from '../components/ParcelThematicMetricsGrid';
import { ThematicMapOverlay } from '../components/ThematicMapOverlay';
import { allBuckets, buildThematicBinding, classifyParcelBucket, computeBucketCounts } from '../registry/thematicBinding';
import {
  describeActiveFilterChips,
  EMPTY_PRECISION_FILTER,
  matchesPrecisionFilter,
  sanitizeStoredFilter,
} from '../registry/thematicFilter';
import { getLayoutDef, isThematicLayoutId, THEMATIC_LAYOUTS } from '../registry/thematicLayouts.registry';
import type {
  GisThematicLayoutId,
  ParcelThematicMetrics,
  ThematicFilterDisplayMode,
  ThematicPrecisionFilter,
  ThematicSubModeId,
} from '../types';

const STORAGE_KEY = 'metro2_gis_thematic_layout';
/** Bộ lọc chỉ định giữ suốt phiên (đổi layout, đổi Zone vẫn giữ); chỉ mất khi "Xóa tất cả" hoặc đóng tab. */
const FILTER_STORAGE_KEY = 'metro2_gis_precision_filter';
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

interface StoredFilterState {
  filter: ThematicPrecisionFilter;
  mode: ThematicFilterDisplayMode;
}

function readStoredFilter(): StoredFilterState {
  try {
    const raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        const filter = sanitizeStoredFilter('filter' in parsed ? parsed.filter : null);
        const mode: ThematicFilterDisplayMode = 'mode' in parsed && parsed.mode === 'ISOLATE' ? 'ISOLATE' : 'DIM';
        return { filter, mode };
      }
    }
  } catch (err: unknown) {
    console.error('[GisVisualization:readStoredFilter] Không đọc được bộ lọc đã lưu', err);
  }
  return { filter: EMPTY_PRECISION_FILTER, mode: 'DIM' };
}

function writeStoredFilter(state: StoredFilterState): void {
  try {
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
  } catch (err: unknown) {
    console.error('[GisVisualization:writeStoredFilter] Không lưu được bộ lọc', err);
  }
}

interface UseThematicMapArgs {
  zoneId: string;
  parcels: GisParcel[];
  /** false ⇒ không bao giờ gọi API và không hiện bộ chọn (Khảo sát viên). */
  enabled: boolean;
  /**
   * true ⇒ nạp dữ liệu cả khi đang ở WORKFLOW: để click thửa luôn hiện đủ chỉ số và bộ lọc chỉ định chạy ngay
   * (Guest còn cần cấp BRA thật cho thẻ / bảng / biểu đồ).
   */
  prefetch?: boolean;
}

export interface UseThematicMapResult {
  /** Truyền vào LeafletSweepMap.thematic; null ⇒ bản đồ tác nghiệp. */
  binding: ThematicMapBinding | null;
  /** Truyền vào LeafletSweepMap.thematicOverlay. */
  overlay: ReactNode;
  /** Chỉ số theo parcelId của Zone đang xem (rỗng khi chưa tải). */
  metricsById: ReadonlyMap<string, ParcelThematicMetrics>;
  /** Layout đang hiển thị thực tế (WORKFLOW khi tắt / Zone = ALL). */
  layoutId: GisThematicLayoutId;
  /** Truyền vào LeafletSweepMap.thematicFilterMatch — có hiệu lực cả ở WORKFLOW. */
  filterMatch: ThematicFilterMatch | null;
  /** Truyền vào LeafletSweepMap.renderParcelInsights; trả null khi chưa có dữ liệu / bị tắt. */
  renderParcelInsights: (parcel: GisParcel) => ReactNode;
}

const EMPTY_METRICS: ReadonlyMap<string, ParcelThematicMetrics> = new Map();

export function useThematicMap({ zoneId, parcels, enabled, prefetch = false }: UseThematicMapArgs): UseThematicMapResult {
  const [{ layoutId, subMode }, setSelection] = useState(readStoredLayout);
  const [activeBuckets, setActiveBuckets] = useState<ReadonlySet<string>>(() => new Set());
  const [filterState, setFilterState] = useState<StoredFilterState>(readStoredFilter);
  const [metricsById, setMetricsById] = useState<ReadonlyMap<string, ParcelThematicMetrics>>(EMPTY_METRICS);
  const [loadedZone, setLoadedZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { filter: precisionFilter, mode: displayMode } = filterState;
  const filterChips = useMemo(() => describeActiveFilterChips(precisionFilter), [precisionFilter]);
  const precisionActive = filterChips.length > 0;

  const zoneAll = isAllZones(zoneId);
  const available = enabled && !zoneAll;
  const effectiveLayout: GisThematicLayoutId = available ? layoutId : 'WORKFLOW';
  const shouldFetch = available && (prefetch || layoutId !== 'WORKFLOW' || precisionActive);

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

  // Đổi Zone / layout / sub-mode thì bỏ lọc nhóm của thang cũ (lọc chỉ định thì giữ)
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

  const updateFilterState = useCallback((patch: Partial<StoredFilterState>) => {
    setFilterState((prev) => {
      const next = { ...prev, ...patch };
      writeStoredFilter(next);
      return next;
    });
  }, []);
  const changeFilter = useCallback((filter: ThematicPrecisionFilter) => updateFilterState({ filter }), [updateFilterState]);
  const resetFilter = useCallback(() => updateFilterState({ filter: EMPTY_PRECISION_FILTER }), [updateFilterState]);
  const changeDisplayMode = useCallback((mode: ThematicFilterDisplayMode) => updateFilterState({ mode }), [updateFilterState]);

  const dataReady = loadedZone === zoneId && !loading;
  const currentMetrics = loadedZone === zoneId ? metricsById : EMPTY_METRICS;
  const layoutDef = getLayoutDef(effectiveLayout);
  const scale = layoutDef.scaleFor(subMode);

  // Tập thửa khớp lọc chỉ định (null ⇒ không lọc / chưa có số liệu để lọc)
  const precisionMatched = useMemo<ReadonlySet<string> | null>(() => {
    if (!available || !precisionActive || !dataReady) return null;
    return new Set(parcels.filter((p) => matchesPrecisionFilter(currentMetrics.get(p.id), precisionFilter)).map((p) => p.id));
  }, [available, precisionActive, dataReady, parcels, currentMetrics, precisionFilter]);

  // Giao với lọc nhóm trên chú giải của layout đang xem
  const matchedIds = useMemo<ReadonlySet<string> | null>(() => {
    const bucketActive = Boolean(scale) && activeBuckets.size > 0 && dataReady;
    if (!bucketActive) return precisionMatched;
    const ids = new Set<string>();
    for (const p of parcels) {
      if (precisionMatched && !precisionMatched.has(p.id)) continue;
      if (scale && activeBuckets.has(classifyParcelBucket(p, currentMetrics.get(p.id), scale))) ids.add(p.id);
    }
    return ids;
  }, [scale, activeBuckets, dataReady, parcels, precisionMatched, currentMetrics]);

  const filterMatch = useMemo<ThematicFilterMatch | null>(
    () => (matchedIds ? { matchedIds, mode: displayMode } : null),
    [matchedIds, displayMode]
  );

  const binding = useMemo<ThematicMapBinding | null>(() => {
    if (!scale || !dataReady) return null;
    const subLabel = layoutDef.subModes.find((s) => s.id === subMode)?.label;
    return buildThematicBinding({
      layoutLabel: subLabel ? `${layoutDef.label} · ${subLabel}` : layoutDef.label,
      scale,
      metricsById: currentMetrics,
      matchedIds,
    });
  }, [scale, dataReady, layoutDef, subMode, currentMetrics, matchedIds]);

  const counts = useMemo(
    () => (scale && dataReady ? computeBucketCounts(parcels, currentMetrics, scale, precisionMatched) : null),
    [scale, dataReady, parcels, currentMetrics, precisionMatched]
  );

  const renderParcelInsights = useCallback(
    (parcel: GisParcel): ReactNode =>
      available && dataReady ? (
        <ParcelThematicMetricsGrid parcel={parcel} metrics={currentMetrics.get(parcel.id)} activeLayoutId={effectiveLayout} />
      ) : null,
    [available, dataReady, currentMetrics, effectiveLayout]
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
              scaleType: scale.scaleType,
              scaleBuckets: scale.buckets,
              buckets: allBuckets(scale),
              counts,
              total: parcels.length,
              activeBuckets,
              onToggleBucket: toggleBucket,
              onClearBuckets: clearBuckets,
            }
          : null
      }
      filterUi={{
        filter: precisionFilter,
        chips: filterChips,
        onChange: changeFilter,
        onReset: resetFilter,
        displayMode,
        onChangeDisplayMode: changeDisplayMode,
        matchedCount: matchedIds ? matchedIds.size : null,
        total: parcels.length,
        pending: precisionActive && !dataReady && available,
      }}
    />
  ) : null;

  return {
    binding,
    overlay,
    metricsById: currentMetrics,
    layoutId: effectiveLayout,
    filterMatch,
    renderParcelInsights,
  };
}
