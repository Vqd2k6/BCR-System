/**
 * ============================================================================
 * THỬA LÂN CẬN CHO SƠ ĐỒ MỤC II (chỉ để vẽ ngữ cảnh, không phải số liệu pháp lý)
 * Khớp Bình đồ khảo sát (/parcels/zone-map → CadastralRepository.listParcelsByZone):
 * chỉ thửa lifecycle_status = 'ACTIVE', vẽ ranh địa chính cadastral_polygon_geom, hệ EPSG:4326.
 * Không giới hạn theo Zone để sơ đồ liền mạch ở mép Zone.
 * Bộ vẽ tự cắt theo khung nhìn, nên chỉ cần bán kính đủ rộng hơn khung.
 * ============================================================================
 */

import { Database } from '../../../database/db';

/** Vòng ranh dạng [lat, lng] (cùng thứ tự với extractParcelPolygonCoords). */
export type LatLngRing = [number, number][];

/** Bán kính lấy thửa lân cận (mét): rộng hơn khung nhìn Mục II (cạnh ngắn ~50–110 m). */
const NEIGHBOUR_RADIUS_M = 250;
const NEIGHBOUR_LIMIT = 800;

interface NeighbourRow {
  geo: string | null;
}

function ringsFromGeoJson(raw: string): LatLngRing[] {
  const geo: unknown = JSON.parse(raw);
  if (!geo || typeof geo !== 'object') return [];
  const { type, coordinates } = geo as { type?: unknown; coordinates?: unknown };
  // GeoJSON/PostGIS dùng [lng, lat]: đảo sang [lat, lng] cho bộ vẽ.
  const toRing = (ring: unknown): LatLngRing | null => {
    if (!Array.isArray(ring) || ring.length < 3) return null;
    const out: LatLngRing = [];
    for (const pt of ring) {
      if (!Array.isArray(pt) || pt.length < 2) return null;
      const lng = Number(pt[0]);
      const lat = Number(pt[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      out.push([lat, lng]);
    }
    return out;
  };
  if (type === 'Polygon' && Array.isArray(coordinates)) {
    const r = toRing(coordinates[0]);
    return r ? [r] : [];
  }
  if (type === 'MultiPolygon' && Array.isArray(coordinates)) {
    return coordinates
      .map((poly: unknown) => (Array.isArray(poly) ? toRing(poly[0]) : null))
      .filter((r): r is LatLngRing => r !== null);
  }
  return [];
}

/**
 * Ranh các thửa trong bán kính quanh thửa khảo sát (không gồm chính nó).
 * Lỗi truy vấn chỉ ghi log và trả mảng rỗng: sơ đồ vẫn vẽ thửa chính.
 */
export async function loadNeighbourParcelRings(parcelId: string | null | undefined): Promise<LatLngRing[]> {
  if (!parcelId) return [];
  try {
    const res = await Database.query<NeighbourRow>(
      `WITH target AS (
         SELECT COALESCE(footprint_polygon_geom, cadastral_polygon_geom) AS g
         FROM parcels WHERE id = $1
       )
       SELECT ST_AsGeoJSON(p.cadastral_polygon_geom) AS geo
       FROM parcels p, target t
       WHERE p.id <> $1
         AND p.lifecycle_status = 'ACTIVE'
         AND t.g IS NOT NULL
         AND p.cadastral_polygon_geom IS NOT NULL
         AND ST_DWithin(p.cadastral_polygon_geom::geography, t.g::geography, $2)
       ORDER BY ST_Distance(p.cadastral_polygon_geom::geography, t.g::geography)
       LIMIT $3;`,
      [parcelId, NEIGHBOUR_RADIUS_M, NEIGHBOUR_LIMIT]
    );
    const rings: LatLngRing[] = [];
    for (const row of res.rows) {
      if (!row.geo) continue;
      try {
        rings.push(...ringsFromGeoJson(row.geo));
      } catch (parseErr: unknown) {
        console.error('[SpatialMap:neighbours] Bỏ qua 1 thửa lân cận có GeoJSON lỗi:', parseErr);
      }
    }
    return rings;
  } catch (err: unknown) {
    console.error(`[SpatialMap:neighbours] Không lấy được thửa lân cận của ${parcelId}, vẽ sơ đồ không có lân cận:`, err);
    return [];
  }
}
