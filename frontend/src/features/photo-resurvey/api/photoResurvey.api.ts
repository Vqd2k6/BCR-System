import { api } from '../../../services/api';
import type { CapturedPhoto, ResurveyApplyStatus, ResurveyMarkerState, ResurveySessionView, ResurveySlotCode, ResurveyTask } from '../types';

/** API client Khảo sát bổ sung – mọi endpoint nằm dưới /photo-resurvey. */
const BASE = '/photo-resurvey';

interface Envelope<T> {
  success: boolean;
  data: T;
}

const enc = encodeURIComponent;

export async function fetchResurveyTasks(params: { zone?: string; state?: ResurveyMarkerState }): Promise<ResurveyTask[]> {
  const query: Record<string, string> = {};
  if (params.zone && params.zone !== 'ALL') query.zone = params.zone;
  if (params.state) query.state = params.state;
  const res = await api.get<Envelope<ResurveyTask[]>>(`${BASE}/tasks`, { params: query });
  return res.data.data;
}

export async function fetchResurveyView(reportId: string): Promise<ResurveySessionView> {
  const res = await api.get<Envelope<ResurveySessionView>>(`${BASE}/reports/${enc(reportId)}`);
  return res.data.data;
}

export async function startResurveySession(reportId: string): Promise<ResurveySessionView> {
  const res = await api.post<Envelope<ResurveySessionView>>(`${BASE}/reports/${enc(reportId)}/session`);
  return res.data.data;
}

export async function uploadReplacePhoto(sessionId: string, photoKey: string, photo: CapturedPhoto): Promise<ResurveySessionView> {
  const res = await api.post<Envelope<ResurveySessionView>>(`${BASE}/sessions/${enc(sessionId)}/photos`, {
    action: 'REPLACE',
    photoKey,
    ...photo,
  });
  return res.data.data;
}

export async function uploadExtraPhoto(sessionId: string, slotCode: ResurveySlotCode, photo: CapturedPhoto): Promise<ResurveySessionView> {
  const res = await api.post<Envelope<ResurveySessionView>>(`${BASE}/sessions/${enc(sessionId)}/photos`, {
    action: 'ADD_EXTRA',
    slotCode,
    ...photo,
  });
  return res.data.data;
}

export async function markResurveyNa(sessionId: string, photoKey: string, reason: string): Promise<ResurveySessionView> {
  const res = await api.post<Envelope<ResurveySessionView>>(`${BASE}/sessions/${enc(sessionId)}/na`, { photoKey, reason });
  return res.data.data;
}

export async function removeResurveyItem(sessionId: string, itemId: string): Promise<ResurveySessionView> {
  const res = await api.delete<Envelope<ResurveySessionView>>(`${BASE}/sessions/${enc(sessionId)}/items/${enc(itemId)}`);
  return res.data.data;
}

export async function rotateResurveyItem(sessionId: string, itemId: string, rotation: number): Promise<ResurveySessionView> {
  const res = await api.put<Envelope<ResurveySessionView>>(`${BASE}/sessions/${enc(sessionId)}/items/${enc(itemId)}/rotation`, { rotation });
  return res.data.data;
}

export async function submitResurvey(sessionId: string): Promise<ResurveySessionView> {
  const res = await api.post<Envelope<ResurveySessionView>>(`${BASE}/sessions/${enc(sessionId)}/submit`);
  return res.data.data;
}

export async function approveResurvey(
  sessionId: string,
  body: { note?: string; time2Overrides?: Record<string, string> }
): Promise<ResurveySessionView> {
  const res = await api.post<Envelope<ResurveySessionView>>(`${BASE}/sessions/${enc(sessionId)}/approve`, body);
  return res.data.data;
}

export async function rejectResurvey(sessionId: string, note: string): Promise<ResurveySessionView> {
  const res = await api.post<Envelope<ResurveySessionView>>(`${BASE}/sessions/${enc(sessionId)}/reject`, { note });
  return res.data.data;
}

/** Thẩm định: APPLIED = đưa vào report, DECLINED = giữ ảnh cũ, PENDING = hoàn tác (chỉ phiên đã duyệt). */
export async function decideResurveyApply(sessionId: string, itemIds: string[], decision: ResurveyApplyStatus): Promise<ResurveySessionView> {
  const res = await api.put<Envelope<ResurveySessionView>>(`${BASE}/sessions/${enc(sessionId)}/apply`, { itemIds, decision });
  return res.data.data;
}
