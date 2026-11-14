/**
 * ============================================================================
 * GIS VISUALIZATION PLUGIN – ĐIỂM CẮM DUY NHẤT
 *
 * Đăng ký trong app.ts bằng 1 dòng:
 *   api.use('/gis-visualization', createGisVisualizationRouter());
 * Gỡ module: xóa dòng trên + thư mục này. Không có bảng riêng.
 *
 * Kiến trúc: Repository (1 query thuộc tính, không geometry) → Rules (pure, dùng chung
 * report/mappers/sections/risk-resolvers.ts với PDF Mục VIII) → Service (scope zone) → Controller.
 * ============================================================================
 */
export { createGisVisualizationRouter } from './gis-visualization.routes';
export type { ParcelThematicMetrics, ZoneThematicPayload } from './types';
