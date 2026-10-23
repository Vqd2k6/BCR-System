/**
 * ============================================================================
 * SATELLITE TILE & PARCEL POLYGON EXTRACTION UTILS
 * Phục vụ nạp và cache mảnh ảnh vệ tinh Esri World Imagery (LOD 18)
 * cho sơ đồ vị trí trang bìa báo cáo.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

let cachedBoundaryData: {
  centerline?: [number, number][];
  stationDetailedFootprints?: Array<{ name: string; coords: [number, number][] }>;
  corridorBoundaries?: Array<{ name: string; coords: [number, number][] }>;
} | null = null;

export function getMetroBoundaryData() {
  if (cachedBoundaryData) return cachedBoundaryData;

  const candidatePaths = [
    path.resolve(process.cwd(), '../data/metro_boundary_data.json'),
    path.resolve(process.cwd(), 'data/metro_boundary_data.json'),
    path.resolve(__dirname, '../../../../../data/metro_boundary_data.json'),
    path.resolve(__dirname, '../../../../../frontend/src/features/survey-phase1/constants/metro_boundary_data.json'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        cachedBoundaryData = JSON.parse(raw);
        return cachedBoundaryData;
      } catch {
        // Tiếp tục thử đường dẫn khác
      }
    }
  }

  return null;
}

/**
 * Trích xuất mảng tọa độ [lat, lng] đã lưu từ dữ liệu thửa đất.
 */
export function extractParcelPolygonCoords(rawReport: any, json: any): [number, number][] | null {
  const ksvCoords =
    Array.isArray(json?.parcelCoordinates) && json.parcelCoordinates.length >= 3
      ? json.parcelCoordinates
      : Array.isArray(json?.polygonCoords) && json.polygonCoords.length >= 3
      ? json.polygonCoords
      : null;

  if (json?.keepKsvBoundaryConfirmed === true && ksvCoords) {
    return ksvCoords;
  }

  const rawGeo = rawReport?.parcel_polygon_geojson || rawReport?.cadastral_geojson;
  if (rawGeo) {
    try {
      const geojson = typeof rawGeo === 'string' ? JSON.parse(rawGeo) : rawGeo;
      if (geojson && geojson.coordinates && Array.isArray(geojson.coordinates[0]) && geojson.coordinates[0].length >= 3) {
        const ring = geojson.coordinates[0];
        return ring.map((pt: any) => [Number(pt[1]), Number(pt[0])] as [number, number]);
      }
    } catch {
      // Bỏ qua lỗi parse
    }
  }

  if (ksvCoords) {
    return ksvCoords;
  }

  return null;
}

function getSatelliteCacheDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data/cache/satellite_tiles'),
    path.resolve(process.cwd(), 'backend/data/cache/satellite_tiles'),
    path.resolve(__dirname, '../../../../data/cache/satellite_tiles'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  const defaultDir = path.resolve(process.cwd(), 'data/cache/satellite_tiles');
  try {
    fs.mkdirSync(defaultDir, { recursive: true });
  } catch {
    // ignore
  }
  return defaultDir;
}

export function fetchSatelliteTileBase64Sync(z: number, y: number, x: number): string | null {
  const cacheDir = getSatelliteCacheDir();
  const cacheFile = path.join(cacheDir, `${z}_${y}_${x}.jpg`);
  if (fs.existsSync(cacheFile)) {
    try {
      const buf = fs.readFileSync(cacheFile);
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    } catch {
      // ignore
    }
  }
  return null;
}

export async function fetchSatelliteTileBase64(z: number, y: number, x: number): Promise<string | null> {
  const cacheDir = getSatelliteCacheDir();
  const cacheFile = path.join(cacheDir, `${z}_${y}_${x}.jpg`);
  if (fs.existsSync(cacheFile)) {
    try {
      const buf = fs.readFileSync(cacheFile);
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    } catch {
      // ignore
    }
  }

  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      try {
        fs.writeFileSync(cacheFile, buffer);
      } catch {
        // ignore
      }
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function preloadSatelliteTiles(polygonCoords: [number, number][]): Promise<void> {
  if (!polygonCoords || polygonCoords.length === 0) return;
  const normalized = polygonCoords.map((p) => (p[0] > p[1] ? [p[1], p[0]] : p) as [number, number]);
  const centerLat = normalized.reduce((s, p) => s + p[0], 0) / normalized.length;
  const centerLng = normalized.reduce((s, p) => s + p[1], 0) / normalized.length;

  const zoom = 18;
  const n = 2 ** zoom;
  const dLat = 0.0015;
  const dLng = 0.0015;

  const leftLng = centerLng - dLng;
  const rightLng = centerLng + dLng;
  const topLat = centerLat + dLat;
  const bottomLat = centerLat - dLat;

  const minTileX = Math.floor(((leftLng + 180) / 360) * n);
  const maxTileX = Math.floor(((rightLng + 180) / 360) * n);
  const minTileY = Math.floor(((1 - Math.log(Math.tan((topLat * Math.PI) / 180) + 1 / Math.cos((topLat * Math.PI) / 180)) / Math.PI) / 2) * n);
  const maxTileY = Math.floor(((1 - Math.log(Math.tan((bottomLat * Math.PI) / 180) + 1 / Math.cos((bottomLat * Math.PI) / 180)) / Math.PI) / 2) * n);

  const tasks: Promise<any>[] = [];
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      tasks.push(fetchSatelliteTileBase64(zoom, ty, tx));
    }
  }
  await Promise.allSettled(tasks);
}

