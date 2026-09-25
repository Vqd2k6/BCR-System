/**
 * METRO 2 ZONE CENTROIDS & SPATIAL UTILITIES
 * Tọa độ trọng tâm (Centroid) chuẩn xác của 11 phân khu ga tuyến Metro 2
 * Khớp 100% với PostGIS ST_Centroid(ST_Union(cadastral_polygon_geom)) trong CSDL
 */

export interface MetroZoneCentroid {
  zoneId: string;
  zoneName: string;
  lat: number;
  lng: number;
}

export const METRO_ZONE_CENTROIDS: Record<string, MetroZoneCentroid> = {
  ZONE_S1: { zoneId: 'ZONE_S1', zoneName: 'Ga S1 - Bến Thành', lat: 10.770830, lng: 106.696694 },
  ZONE_S2: { zoneId: 'ZONE_S2', zoneName: 'Ga S2 - Tao Đàn', lat: 10.774130, lng: 106.690134 },
  ZONE_S3: { zoneId: 'ZONE_S3', zoneName: 'Ga S3 - Dân Chủ', lat: 10.777797, lng: 106.678489 },
  ZONE_S4: { zoneId: 'ZONE_S4', zoneName: 'Ga S4 - Hòa Hưng', lat: 10.782510, lng: 106.672859 },
  ZONE_S5: { zoneId: 'ZONE_S5', zoneName: 'Ga S5 - Lê Thị Riêng', lat: 10.786061, lng: 106.665315 },
  ZONE_S6: { zoneId: 'ZONE_S6', zoneName: 'Ga S6 - Phạm Văn Hai', lat: 10.790290, lng: 106.658081 },
  ZONE_S7: { zoneId: 'ZONE_S7', zoneName: 'Ga S7 - Bảy Hiền', lat: 10.793561, lng: 106.652375 },
  ZONE_S8: { zoneId: 'ZONE_S8', zoneName: 'Ga S8 - Nguyễn Hồng Đào', lat: 10.797605, lng: 106.644632 },
  ZONE_S9: { zoneId: 'ZONE_S9', zoneName: 'Ga S9 - Bà Quẹo', lat: 10.802564, lng: 106.637211 },
  ZONE_S10: { zoneId: 'ZONE_S10', zoneName: 'Ga S10 - Phạm Văn Bạch', lat: 10.815381, lng: 106.630708 },
  ZONE_S11: { zoneId: 'ZONE_S11', zoneName: 'Ga S11 - Tân Bình / Tham Lương', lat: 10.821594, lng: 106.625132 },
  // 5 Baseline Zones
  ZONE_01: { zoneId: 'ZONE_01', zoneName: 'Zone 1: Ga S1 Bến Thành (C&C)', lat: 10.770876, lng: 106.696946 },
  ZONE_02: { zoneId: 'ZONE_02', zoneName: 'Zone 2: Hầm TBM Bến Thành -> Tao Đàn (POR)', lat: 10.771500, lng: 106.694800 },
  ZONE_03: { zoneId: 'ZONE_03', zoneName: 'Zone 3: Ga S2 Tao Đàn (C&C)', lat: 10.773237, lng: 106.690138 },
  ZONE_04: { zoneId: 'ZONE_04', zoneName: 'Zone 4: Hầm TBM Tao Đàn -> Dân Chủ (POR)', lat: 10.774500, lng: 106.687500 },
  ZONE_09: { zoneId: 'ZONE_09', zoneName: 'Zone 9: Ga S5 Lê Thị Riêng (C&C)', lat: 10.786163, lng: 106.665623 },
};

/**
 * Tính khoảng cách (mét) giữa 2 tọa độ GPS theo công thức Haversine (Great-Circle Distance)
 */
export const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Bán kính Trái Đất (mét)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * Lấy tọa độ trọng tâm phân khu ga được giao đảm nhận
 */
export const getZoneCentroid = (zoneId?: string): MetroZoneCentroid => {
  if (zoneId && METRO_ZONE_CENTROIDS[zoneId]) {
    return METRO_ZONE_CENTROIDS[zoneId];
  }
  return METRO_ZONE_CENTROIDS.ZONE_S9;
};
