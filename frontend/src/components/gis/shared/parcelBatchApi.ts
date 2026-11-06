import { api } from '../../../services/api';
import type { ParcelExclusionType } from './types';

/**
 * API tác vụ hàng loạt trên bản đồ GIS (Zone Admin / Super Admin).
 * Backend chỉ ghi bảng parcels, không ghi survey_data_json; thửa không đủ điều kiện trả về trong `skipped`.
 */

/** Phân khu đã có quy tắc chuẩn hóa địa chỉ được kiểm chứng (khớp ADDRESS_BATCH_ZONES ở backend). */
export const ADDRESS_BATCH_ZONES: readonly string[] = ['ZONE_03', 'ZONE_07', 'ZONE_09'];

export const BATCH_MAX_PARCELS = 500;

export interface BatchResultItem {
  parcelId: string;
  projectParcelCode: string;
}

export interface BatchSkippedItem extends BatchResultItem {
  reason: string;
}

export interface BatchResult {
  batchId: string;
  updated: BatchResultItem[];
  skipped: BatchSkippedItem[];
}

export interface AddressFields {
  houseNumber: string;
  street: string;
  ward: string;
  district: string;
}

export type AddressFieldKey = keyof AddressFields;
export type AddressFieldSource = 'SURVEYOR' | 'CADASTRAL' | 'MANUAL';

export interface AddressPreviewRow {
  parcelId: string;
  projectParcelCode: string;
  zoneId: string | null;
  parcelRaw: AddressFields;
  surveyorEntered: AddressFields | null;
  suggested: AddressFields;
  sourceByField: Record<AddressFieldKey, AddressFieldSource>;
  khuPho: string;
  anomalyReasons: string[];
  requiresManualStreet: boolean;
  requiresManualHouseNumber: boolean;
  streetKeptAsIs: boolean;
  wardConflict: { cadastralWard: string; surveyorWard: string } | null;
  isSplitWard: boolean;
  splitWardCandidates: string[];
  suggestedStreetOptions: string[];
  diffCount: number;
  lockedReason: string | null;
  autoSelectable: boolean;
}

export interface LocalAuthoritySuggestion {
  name: string;
  role: string | null;
  phone: string | null;
  source: 'PARCEL' | 'RULE';
  parcelCount: number;
}

const unwrap = <T>(payload: unknown): T => {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  throw new Error('Phản hồi máy chủ không hợp lệ');
};

export const previewBatchAddress = async (parcelIds: string[]): Promise<AddressPreviewRow[]> => {
  const res = await api.post('/admin/parcels/batch/address-preview', { parcelIds });
  return unwrap<AddressPreviewRow[]>(res.data);
};

export const syncBatchAddress = async (items: Array<AddressFields & { parcelId: string }>): Promise<BatchResult> => {
  const res = await api.post('/admin/parcels/batch/address', { items });
  return unwrap<BatchResult>(res.data);
};

export const setBatchLocalAuthority = async (input: {
  parcelIds: string[];
  name: string;
  role: string | null;
  phone: string | null;
}): Promise<BatchResult> => {
  const res = await api.post('/admin/parcels/batch/local-authority', input);
  return unwrap<BatchResult>(res.data);
};

export const fetchLocalAuthoritySuggestions = async (zoneId: string): Promise<LocalAuthoritySuggestion[]> => {
  const res = await api.get('/admin/parcels/local-authority-suggestions', { params: { zoneId } });
  return unwrap<LocalAuthoritySuggestion[]>(res.data);
};

export const excludeBatchParcels = async (input: {
  parcelIds: string[];
  exclusionType: ParcelExclusionType;
  reason: string;
}): Promise<BatchResult> => {
  const res = await api.post('/admin/parcels/batch/exclude', input);
  return unwrap<BatchResult>(res.data);
};

export const restoreBatchParcels = async (input: { parcelIds: string[]; reason: string }): Promise<BatchResult> => {
  const res = await api.post('/admin/parcels/batch/restore', input);
  return unwrap<BatchResult>(res.data);
};

export interface LocalAuthorityPreviewRow {
  parcelId: string;
  projectParcelCode: string;
  current: { name: string; role: string | null; phone: string | null } | null;
  lockedReason: string | null;
}

export const previewBatchLocalAuthority = async (parcelIds: string[]): Promise<LocalAuthorityPreviewRow[]> => {
  const res = await api.post('/admin/parcels/batch/local-authority-preview', { parcelIds });
  return unwrap<LocalAuthorityPreviewRow[]>(res.data);
};
