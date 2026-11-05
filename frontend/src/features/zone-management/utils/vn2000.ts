/**
 * Chuyển tọa độ WGS84 (EPSG:4326) sang VN2000 múi chiếu 3° TP.HCM (kinh tuyến trục 105°45', k0 = 0.9999).
 * Module thuần, không phụ thuộc DOM hay thư viện ngoài để kiểm thử được ngoài trình duyệt.
 *
 * Quy ước trục theo bảng "TỌA ĐỘ ĐIỂM KHỐNG CHẾ" của bản vẽ: X = Northing (Bắc), Y = Easting (Đông).
 * Đầu vào theo thứ tự Leaflet [lat, lng].
 */

type LatLng = [number, number];

export interface Vn2000Point {
  /** Northing (m) */
  x: number;
  /** Easting (m) */
  y: number;
}

const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;
const E2 = WGS84_F * (2 - WGS84_F);
const EP2 = E2 / (1 - E2);

const CENTRAL_MERIDIAN_DEG = 105.75;
const SCALE_FACTOR = 0.9999;
const FALSE_EASTING = 500000;

const ARC_SECOND = Math.PI / 180 / 3600;

/** 7 tham số VN2000 → WGS84 (Bộ TN&MT, quy ước position vector). */
const TOWGS84 = {
  dx: -191.90441429,
  dy: -39.30318279,
  dz: -111.45032835,
  rx: -0.00928836 * ARC_SECOND,
  ry: 0.01975479 * ARC_SECOND,
  rz: -0.00427372 * ARC_SECOND,
  scale: 0.252906278e-6,
};

/**
 * Hiệu chỉnh hệ thống (m) cộng sau phép chuyển 7 tham số.
 * Dữ liệu WGS84 của repo lệch ổn định so với bản vẽ chính thức; hằng số là trung bình (PDF − tính toán)
 * trên 20 điểm khống chế của CAD-templete/ST01_ID building_A3_01.pdf. Sai số còn lại ≤ 0.07 m.
 */
export const VN2000_CALIBRATION = { dN: -0.198, dE: -0.52 } as const;
export const VN2000_CALIBRATION_SOURCE =
  'Hiệu chỉnh theo 20 điểm khống chế ST01_ID building_A3_01.pdf';

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

const geodeticToEcef = (lat: number, lon: number): [number, number, number] => {
  const sinLat = Math.sin(lat);
  const n = WGS84_A / Math.sqrt(1 - E2 * sinLat * sinLat);
  return [
    n * Math.cos(lat) * Math.cos(lon),
    n * Math.cos(lat) * Math.sin(lon),
    n * (1 - E2) * sinLat,
  ];
};

const ecefToGeodetic = ([x, y, z]: [number, number, number]): [number, number] => {
  const lon = Math.atan2(y, x);
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - E2));
  for (let i = 0; i < 8; i++) {
    const sinLat = Math.sin(lat);
    const n = WGS84_A / Math.sqrt(1 - E2 * sinLat * sinLat);
    lat = Math.atan2(z + E2 * n * sinLat, p);
  }
  return [lat, lon];
};

/** Nghịch đảo phép Helmert VN2000 → WGS84 (bậc nhất, sai số mm với góc xoay cỡ phần trăm giây). */
const wgs84EcefToVn2000Ecef = ([x, y, z]: [number, number, number]): [number, number, number] => {
  const { dx, dy, dz, rx, ry, rz, scale } = TOWGS84;
  const k = 1 / (1 + scale);
  const ux = (x - dx) * k;
  const uy = (y - dy) * k;
  const uz = (z - dz) * k;
  return [ux + rz * uy - ry * uz, -rz * ux + uy + rx * uz, ry * ux - rx * uy + uz];
};

/** Chiếu Transverse Mercator thuận (Snyder 1987) trên ellipsoid WGS84 mà VN2000 dùng. */
const transverseMercator = (lat: number, lon: number): { northing: number; easting: number } => {
  const lon0 = toRadians(CENTRAL_MERIDIAN_DEG);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const tanLat = Math.tan(lat);
  const n = WGS84_A / Math.sqrt(1 - E2 * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = EP2 * cosLat * cosLat;
  const a = (lon - lon0) * cosLat;
  const m =
    WGS84_A *
    ((1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256) * lat -
      ((3 * E2) / 8 + (3 * E2 * E2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * lat) +
      ((15 * E2 * E2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * lat) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * lat));

  const easting =
    FALSE_EASTING +
    SCALE_FACTOR *
      n *
      (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5) / 120);
  const northing =
    SCALE_FACTOR *
    (m +
      n *
        tanLat *
        ((a * a) / 2 +
          ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6) / 720));
  return { northing, easting };
};

/** WGS84 → VN2000 chưa hiệu chỉnh (dùng để tính hằng hiệu chỉnh và kiểm thử). */
export const wgs84ToVn2000Raw = ([lat, lng]: LatLng): Vn2000Point => {
  const ecef = geodeticToEcef(toRadians(lat), toRadians(lng));
  const [vnLat, vnLon] = ecefToGeodetic(wgs84EcefToVn2000Ecef(ecef));
  const { northing, easting } = transverseMercator(vnLat, vnLon);
  return { x: northing, y: easting };
};

/** WGS84 → VN2000 đã hiệu chỉnh theo bản vẽ chính thức. */
export const wgs84ToVn2000 = (coord: LatLng): Vn2000Point => {
  const raw = wgs84ToVn2000Raw(coord);
  return { x: raw.x + VN2000_CALIBRATION.dN, y: raw.y + VN2000_CALIBRATION.dE };
};
