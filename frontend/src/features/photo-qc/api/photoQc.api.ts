import { api } from '../../../services/api';
import type {
  PhotoQcDetail,
  PhotoQcListParams,
  PhotoQcListResult,
  PhotoQcPhotoRow,
  PhotoQcPhotoUpdate,
  PhotoQcRecaptureLevel,
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

export async function downloadRecaptureList(params: { zone?: string; station?: string; level?: PhotoQcRecaptureLevel }): Promise<void> {
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
