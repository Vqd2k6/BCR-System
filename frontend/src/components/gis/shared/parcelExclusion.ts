import { api } from '../../../services/api';
import type { GisParcel, ParcelExclusionType } from './types';

export const EXCLUSION_TYPE_LABELS: Record<ParcelExclusionType, string> = {
  ROAD_TRAFFIC: 'Đất giao thông / Vỉa hè',
  VACANT_LAND: 'Đất trống không có nhà',
  CLICK_MISTAKE: 'KSV click nhầm',
  TRAINING_DEMO: 'Thửa tạo lúc tập huấn',
  DUPLICATE: 'Thửa trùng lặp',
};

export const EXCLUDED_PARCEL_STROKE = '#94a3b8';
export const EXCLUDED_PARCEL_FILL = '#cbd5e1';

export const isExcludedParcel = (parcel: GisParcel): boolean =>
  parcel.lifecycleStatus === 'EXCLUDED_NON_BUILDING' || parcel.lifecycleStatus === 'EXCLUDED_TRAINING_DEMO';

/** Chỉ thửa chưa nộp hồ sơ mới được loại trừ; backend kiểm tra lại đầy đủ. */
export const canExcludeParcel = (parcel: GisParcel): boolean =>
  ['NOT_SURVEYED', 'ASSIGNED_TO_ME', 'IN_PROGRESS'].includes(String(parcel.surveyStatus));

type GeoJsonGeometry = { type?: string; coordinates?: unknown };

const toLeafletRing = (geometry: GeoJsonGeometry | null | undefined): [number, number][] => {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  const polygon = geometry.type === 'MultiPolygon' ? geometry.coordinates[0] : geometry.coordinates;
  const ring = Array.isArray(polygon) ? polygon[0] : null;
  if (!Array.isArray(ring)) return [];
  // GeoJSON dùng [lng, lat] → Leaflet cần [lat, lng]
  return (ring as [number, number][]).map(([lng, lat]) => [lat, lng]);
};

const normalizeExcludedParcel = (raw: Record<string, unknown>): GisParcel => ({
  id: String(raw.id || ''),
  projectParcelCode: String(raw.project_parcel_code || ''),
  officialCadastralCode: String(raw.official_cadastral_code || ''),
  houseNumber: String(raw.house_number || ''),
  street: String(raw.street || ''),
  ownerName: String(raw.owner_name || ''),
  zoneId: String(raw.zone_id || ''),
  surveyStatus: raw.survey_status as GisParcel['surveyStatus'],
  lifecycleStatus: raw.lifecycle_status as GisParcel['lifecycleStatus'],
  exclusionType: raw.exclusion_type as ParcelExclusionType | undefined,
  exclusionReason: String(raw.exclusion_reason || ''),
  excludedAt: raw.excluded_at ? String(raw.excluded_at) : undefined,
  excludedByName: String(raw.excluded_by_name || ''),
  coordinates: toLeafletRing(raw.cadastral_geojson as GeoJsonGeometry | null | undefined),
});

export const fetchExcludedParcels = async (zoneId: string): Promise<GisParcel[]> => {
  const res = await api.get('/parcels/excluded', { params: { zoneId } });
  const rows = Array.isArray(res.data?.data) ? (res.data.data as Record<string, unknown>[]) : [];
  return rows.map(normalizeExcludedParcel);
};

export const excludeParcel = async (parcelId: string, exclusionType: ParcelExclusionType, reason: string): Promise<void> => {
  await api.patch(`/parcels/${parcelId}/lifecycle`, { action: 'EXCLUDE', exclusionType, reason });
};

export const restoreParcel = async (parcelId: string, reason: string): Promise<void> => {
  await api.patch(`/parcels/${parcelId}/lifecycle`, { action: 'RESTORE', reason });
};
