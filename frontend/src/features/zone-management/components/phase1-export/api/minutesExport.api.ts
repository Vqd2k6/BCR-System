import { api } from '../../../../../services/api';
import type { MinutesJobStatus, ZoneMinutesSummary } from '../types';

export const fetchZoneMinutes = async (zoneId: string): Promise<ZoneMinutesSummary> => {
  const res = await api.get(`/reports/minutes/zone/${encodeURIComponent(zoneId)}`);
  return res.data.data as ZoneMinutesSummary;
};

export const fetchMinutePdfBlob = async (reportId: string): Promise<Blob> => {
  const res = await api.get(`/reports/${encodeURIComponent(reportId)}/minutes/pdf`, { responseType: 'blob' });
  return res.data as Blob;
};

export const startZoneMinutesJob = async (zoneId: string): Promise<MinutesJobStatus> => {
  const res = await api.post(`/reports/minutes/zone/${encodeURIComponent(zoneId)}/batch-zip`);
  return res.data.data as MinutesJobStatus;
};

export const fetchMinutesJob = async (jobId: string): Promise<MinutesJobStatus> => {
  const res = await api.get(`/reports/minutes/jobs/${jobId}`);
  return res.data.data as MinutesJobStatus;
};

/** ZIP có thể hàng trăm MB nên trình duyệt tải trực tiếp bằng vé ngắn hạn, không qua axios blob. */
export const downloadMinutesZip = async (jobId: string): Promise<void> => {
  const res = await api.post(`/reports/minutes/jobs/${jobId}/download-ticket`);
  const ticket = (res.data.data as { ticket: string }).ticket;
  const url = `${api.defaults.baseURL}/reports/minutes/jobs/${jobId}/download?ticket=${encodeURIComponent(ticket)}`;
  window.location.assign(url);
};
