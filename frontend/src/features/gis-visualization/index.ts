/**
 * ============================================================================
 * GIS VISUALIZATION PLUGIN – PUBLIC API
 * 8 layout bản đồ chuyên đề (Hiện trạng KS, Năm XD, Móng & Kết cấu, ECS, Burland, VI, BRA, Số tầng).
 * Dùng: const { binding, overlay } = useThematicMap({ zoneId, parcels, enabled });
 *       <LeafletSweepMap thematic={binding} thematicOverlay={overlay} ... />
 * Gỡ module: bỏ 2 prop trên ở các màn hình + xóa thư mục này (backend: modules/gis-visualization).
 * ============================================================================
 */
export { useThematicMap } from './hooks/useThematicMap';
export type { UseThematicMapResult } from './hooks/useThematicMap';
export { THEMATIC_LAYOUTS } from './registry/thematicLayouts.registry';
export type { GisThematicLayoutId, ParcelThematicMetrics, RiskLevelCode } from './types';
export { ParcelThematicMetricsGrid } from './components/ParcelThematicMetricsGrid';
export type { ThematicPrecisionFilter, ThematicFilterDisplayMode } from './types';
