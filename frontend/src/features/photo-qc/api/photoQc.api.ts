import { api } from '../../../services/api';
import type {
  PhotoQcCropReviewItem,
  PhotoQcDetail,
  PhotoQcListParams,
  PhotoQcListResult,
  PhotoQcPhotoRow,
  PhotoQcPhotoUpdate,
  PhotoQcEffectiveLevel,
  PhotoQcRecaptureRow,
  PhotoQcReportRow,
  PhotoQcReportUpdate,
} from '../types';

/** API client plugin Photo QC – mọi endpoint nằm dưới /photo-qc. */
const BASE = '/photo-qc';

interface Envelope<T> {
  success: boolean;
  data: T;
}

function cleanParams(params: object): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === 'ALL') continue;
    if (typeof v === 'string' || typeof v === 'number') out[k] = v;
  }
  return out;
}

export async function fetchPhotoQcList(params: PhotoQcListParams): Promise<PhotoQcListResult> {
  const res = await api.get<Envelope<PhotoQcListResult>>(`${BASE}/reports`, { params: cleanParams(params) });
  return res.data.data;
}

export async function fetchPhotoQcDetail(reportId: string): Promise<PhotoQcDetail> {
  const res = await api.get<Envelope<PhotoQcDetail>>(`${BASE}/reports/${encodeURIComponent(reportId)}/photos`);
  return res.data.data;
}

export async function savePhotoQcReport(reportId: string, body: PhotoQcReportUpdate): Promise<PhotoQcReportRow> {
  const res = await api.put<Envelope<PhotoQcReportRow>>(`${BASE}/reports/${encodeURIComponent(reportId)}`, body);
  return res.data.data;
}

export async function savePhotoQcPhotos(reportId: string, items: PhotoQcPhotoUpdate[]): Promise<PhotoQcPhotoRow[]> {
  const res = await api.put<Envelope<PhotoQcPhotoRow[]>>(`${BASE}/reports/${encodeURIComponent(reportId)}/photos`, { items });
  return res.data.data;
}

/** Thẩm định duyệt/từ chối crop. Chỉ crop APPROVED mới in vào report. */
export async function reviewPhotoQcCrops(reportId: string, items: PhotoQcCropReviewItem[]): Promise<PhotoQcPhotoRow[]> {
  const res = await api.put<Envelope<PhotoQcPhotoRow[]>>(`${BASE}/reports/${encodeURIComponent(reportId)}/crop-review`, { items });
  return res.data.data;
}

export interface RecaptureListParams {
  zone?: string;
  station?: string;
  level?: Exclude<PhotoQcEffectiveLevel, 'NONE'>;
}

/** Cùng nguồn dữ liệu với file Excel (backend recaptureList), nên bảng xem trước luôn khớp file. */
export async function fetchRecaptureList(params: RecaptureListParams): Promise<PhotoQcRecaptureRow[]> {
  const res = await api.get<Envelope<PhotoQcRecaptureRow[]>>(`${BASE}/recapture-list`, { params: { ...cleanParams(params), format: 'json' } });
  return res.data.data;
}

export async function downloadRecaptureList(params: RecaptureListParams): Promise<void> {
  const res = await api.get<Blob>(`${BASE}/recapture-list`, {
    params: { ...cleanParams(params), format: 'xlsx' },
    responseType: 'blob',
  });
  const disposition = String(res.headers['content-disposition'] || '');
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename = match?.[1] || `DanhSach_ChupLai_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
