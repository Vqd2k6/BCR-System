import rawBoundaryData from './metro_boundary_data.json';
import gisData from './metroGisConstants.json';

export interface MetroStationMarker {
  code: string;
  name: string;
  km: string;
  pos: [number, number];
  type: string;
  desc?: string;
}

export interface MetroStationPolygon {
  name: string;
  code: string;
  type: string;
  desc?: string;
  km?: string;
  coords: [number, number][];
  center: [number, number];
}

export interface MetroCorridorBoundary {
  name: string;
  coords: [number, number][];
}

export interface MetroZoneConfig {
  index: number;
  code: string;
  legacyCode?: string;
  name: string;
  shortName: string;
  type: 'C&C' | 'POR' | 'ELV' | 'DEP';
  startKm: string;
  endKm: string;
  zoi: number;
  center: [number, number];
  polygon: [number, number][];
  isDataReady: boolean;
  rawParcelCount?: number;
}

// 1. Ranh Giải Phóng Mặt Bằng Tả Tuyến & Hữu Tuyến (File gốc CAD/KML)
export const METRO_CORRIDOR_BOUNDARIES: MetroCorridorBoundary[] =
  (rawBoundaryData.corridorBoundaries as any[]) || [];

// 2. Các Hộp Ga Metro (11 Hộp Ga vẽ theo CAD chuẩn của Ban QLDA ĐSĐT MAUR)
export const METRO_STATION_POLYGONS: MetroStationPolygon[] =
  (rawBoundaryData.stationPolygons as any[]) || [];

// 2b. Các Phân đoạn Hầm TBM nối liền các ga (CAD chuẩn MAUR, khép kín hành lang)
export const METRO_TBM_POLYGONS: { rawName: string; coords: [number, number][]; center: [number, number] }[] =
  ((rawBoundaryData as any).tbmPolygons as any[]) || [];

export const METRO_ALL_CORRIDOR_SEGMENTS: any[] =
  ((rawBoundaryData as any).allCorridorSegments as any[]) || [];

// 3. Danh sách các Trạm Ga (11 Ga + Depot Tham Lương)
export const METRO_STATIONS: MetroStationMarker[] = [
  ...((rawBoundaryData.stations as any[]) || []).map((s: any) => ({
    code: s.code,
    name: s.name,
    km: s.km || '',
    pos: s.pos as [number, number],
    type: s.type || 'Ga ngầm',
    desc: s.desc,
  })),
  {
    code: 'DEP',
    name: 'Depot Tham Lương',
    km: 'KM11+040',
    pos: [10.830600, 106.618500],
    type: 'Depot Kỹ thuật',
    desc: 'Khu bảo dưỡng kỹ thuật 25.7 ha Tham Lương',
  },
];

// 4. Tim tuyến Metro 2 (Đường nét đỏ chuẩn chạy chính giữa cặp line màu xanh Tả Tuyến & Hữu Tuyến)
export const METRO_LINE2_CENTERLINE: [number, number][] =
  ((rawBoundaryData as any).centerline as [number, number][]) &&
  (rawBoundaryData as any).centerline.length > 0
    ? (rawBoundaryData as any).centerline
    : METRO_STATIONS.map((s) => s.pos);

// Phân bổ 22 Zone theo chuẩn DB_GIS
const LEGACY_MAP: Record<string, string> = {
  ZONE_01: 'ZONE_S1',
  ZONE_03: 'ZONE_S2',
  ZONE_05: 'ZONE_S3',
  ZONE_07: 'ZONE_S4',
  ZONE_09: 'ZONE_S5',
  ZONE_11: 'ZONE_S6',
  ZONE_13: 'ZONE_S7',
  ZONE_15: 'ZONE_S8',
  ZONE_17: 'ZONE_S9',
  ZONE_19: 'ZONE_S10',
  ZONE_21: 'ZONE_S11',
};

const READY_ZONES: Record<string, number> = {
  ZONE_01: 302,
  ZONE_02: 153,
  ZONE_03: 138,
  ZONE_04: 442,
  ZONE_09: 192,
};

export const METRO_22_ZONES: MetroZoneConfig[] = (gisData.segments as any[]).map((seg) => {
  const isReady = seg.code in READY_ZONES;
  const rawCount = READY_ZONES[seg.code];
  return {
    index: seg.index,
    code: seg.code,
    legacyCode: LEGACY_MAP[seg.code],
    name: seg.name,
    shortName: `Zone ${String(seg.index).padStart(2, '0')} [${seg.type}]`,
    type: seg.type,
    startKm: seg.startKm,
    endKm: seg.endKm,
    zoi: seg.zoi,
    center: seg.center as [number, number],
    polygon: seg.polygonCoords as [number, number][],
    isDataReady: isReady,
    rawParcelCount: rawCount,
  };
});

export const getZoneByCode = (code: string): MetroZoneConfig | undefined => {
  const upper = code.toUpperCase();
  return (
    METRO_22_ZONES.find((z) => z.code === upper) ||
    METRO_22_ZONES.find((z) => z.legacyCode === upper) ||
    METRO_22_ZONES.find((z) => `ZONE_${z.index}` === upper)
  );
};

export const getZoneColor = (type: 'C&C' | 'POR' | 'ELV' | 'DEP') => {
  switch (type) {
    case 'C&C':
      return {
        stroke: '#ea580c',
        fill: '#f97316',
        bg: '#fff7ed',
        text: '#c2410c',
        badge: 'Ga đào hở C&C',
      };
    case 'POR':
      return {
        stroke: '#4f46e5',
        fill: '#6366f1',
        bg: '#eef2ff',
        text: '#3730a3',
        badge: 'Hầm khoan TBM POR',
      };
    case 'DEP':
      return {
        stroke: '#059669',
        fill: '#10b981',
        bg: '#ecfdf5',
        text: '#047857',
        badge: 'Depot Tham Lương',
      };
    case 'ELV':
    default:
      return {
        stroke: '#0284c7',
        fill: '#38bdf8',
        bg: '#f0f9ff',
        text: '#0369a1',
        badge: 'Cầu cạn ELV',
      };
  }
};
