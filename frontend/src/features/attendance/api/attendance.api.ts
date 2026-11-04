import { api } from '@/services/api';
import { resolveAttendancePhotoUrl } from '@/core/utils/metroZoneUtils';
import type { AttendanceRecord } from '../types/attendance.types';
import type {
  AdminCheckIn,
  AdminCheckInDetail,
  AdminCheckInFilters,
  AdminCheckInPage,
  AttendanceAnomalyCode,
  AttendanceAuditEntry,
  AttendanceCounters,
  AttendanceVerificationStatus,
  AttendanceVerifyAction,
  BatchVerifyResult,
  GeoPoint,
  MonthlySummary,
  MonthlySummaryRow,
  PeriodStatus,
} from '../types/admin.types';

/** Toàn bộ lời gọi API của phân hệ Chấm công. Chuyển snake_case (server) → camelCase (UI) tại đây. */

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  scope?: string;
  pagination?: { total: number; limit?: number; offset?: number };
}

interface RawCheckIn {
  id: string;
  surveyor_id: string;
  surveyor_name?: string | null;
  surveyor_code?: string | null;
  surveyor_phone?: string | null;
  surveyor_assigned_zone_id?: string | null;
  zone_id: string;
  work_date?: string | null;
  checkin_time: string;
  checkout_time?: string | null;
  work_duration_minutes?: number | null;
  distance_to_zone_center_meters?: number | null;
  checkout_distance_to_zone_center_meters?: number | null;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  checkout_gps_latitude?: number | null;
  checkout_gps_longitude?: number | null;
  gps_accuracy_meters?: number | null;
  checkout_gps_accuracy_meters?: number | null;
  zone_center_lat?: number | null;
  zone_center_lng?: number | null;
  checkout_zone_center_lat?: number | null;
  checkout_zone_center_lng?: number | null;
  selfie_photo_url?: string | null;
  checkout_selfie_photo_url?: string | null;
  notes?: string | null;
  checkout_notes?: string | null;
  verification_status: AttendanceVerificationStatus;
  verification_notes?: string | null;
  verified_at?: string | null;
  verified_by_name?: string | null;
  anomaly_codes?: string[] | null;
  effective_anomaly_codes?: string[] | null;
  anomaly_reason?: string | null;
  is_missing_checkout?: boolean | null;
  is_companion: boolean;
  companion_name?: string | null;
  companion_role?: string | null;
  companion_phone?: string | null;
  surveys_created_count?: number | null;
  surveys_submitted_count?: number | null;
  is_period_locked?: boolean | null;
}

interface RawAuditEntry {
  id: string;
  action: string;
  performed_by_name: string | null;
  created_at: string;
  diff_payload: { previousStatus?: string; newStatus?: string; notes?: string | null } | null;
}

interface RawCheckInDetail extends RawCheckIn {
  is_own_checkin: boolean;
  verification_history: RawAuditEntry[];
  companions: RawCheckIn[];
}

interface RawSummaryRow {
  surveyor_id: string;
  surveyor_name: string;
  surveyor_code: string | null;
  assigned_zone_id: string | null;
  total_shift_days: number;
  work_days: number;
  approved_days: number;
  flagged_days: number;
  rejected_days: number;
  pending_days: number;
  completed_checkout_days: number;
  missing_checkout_days: number;
  total_work_minutes: number;
  anomaly_shift_count: number;
  companion_checkins_total: number;
  companion_accepted_count: number;
  companion_pending_count: number;
  companions: Array<{ name: string | null; phone: string | null }>;
  surveys_submitted: number;
}

const toNumberOrNull = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toPoint = (lat: number | null | undefined, lng: number | null | undefined): GeoPoint | null => {
  const la = toNumberOrNull(lat);
  const ln = toNumberOrNull(lng);
  return la === null || ln === null ? null : { lat: la, lng: ln };
};

const photoOrNull = (url: string | null | undefined): string | null => {
  const resolved = resolveAttendancePhotoUrl(url);
  return resolved || null;
};

export const mapCheckIn = (r: RawCheckIn): AdminCheckIn => ({
  id: r.id,
  surveyorId: r.surveyor_id,
  surveyorName: r.surveyor_name || '---',
  surveyorCode: r.surveyor_code ?? null,
  surveyorPhone: r.surveyor_phone ?? null,
  surveyorAssignedZoneId: r.surveyor_assigned_zone_id ?? null,
  zoneId: r.zone_id,
  workDate: r.work_date || '',
  checkInTime: r.checkin_time,
  checkOutTime: r.checkout_time ?? null,
  workDurationMinutes: toNumberOrNull(r.work_duration_minutes),
  distanceIn: toNumberOrNull(r.distance_to_zone_center_meters),
  distanceOut: toNumberOrNull(r.checkout_distance_to_zone_center_meters),
  gpsIn: toPoint(r.gps_latitude, r.gps_longitude),
  gpsOut: toPoint(r.checkout_gps_latitude, r.checkout_gps_longitude),
  gpsAccuracyIn: toNumberOrNull(r.gps_accuracy_meters),
  gpsAccuracyOut: toNumberOrNull(r.checkout_gps_accuracy_meters),
  zoneCenterIn: toPoint(r.zone_center_lat, r.zone_center_lng),
  zoneCenterOut: toPoint(r.checkout_zone_center_lat, r.checkout_zone_center_lng),
  selfieInUrl: photoOrNull(r.selfie_photo_url),
  selfieOutUrl: photoOrNull(r.checkout_selfie_photo_url),
  notesIn: r.notes ?? null,
  notesOut: r.checkout_notes ?? null,
  verificationStatus: r.verification_status,
  verificationNotes: r.verification_notes ?? null,
  verifiedAt: r.verified_at ?? null,
  verifiedByName: r.verified_by_name ?? null,
  anomalyCodes: (r.effective_anomaly_codes || r.anomaly_codes || []) as AttendanceAnomalyCode[],
  anomalyReason: r.anomaly_reason ?? null,
  isMissingCheckout: Boolean(r.is_missing_checkout),
  isCompanion: Boolean(r.is_companion),
  companionName: r.companion_name ?? null,
  companionRole: r.companion_role ?? null,
  companionPhone: r.companion_phone ?? null,
  surveysCreatedCount: toNumberOrNull(r.surveys_created_count),
  surveysSubmittedCount: toNumberOrNull(r.surveys_submitted_count),
  isPeriodLocked: Boolean(r.is_period_locked),
});

const mapAudit = (a: RawAuditEntry): AttendanceAuditEntry => ({
  id: a.id,
  action: a.action,
  performedByName: a.performed_by_name,
  createdAt: a.created_at,
  previousStatus: a.diff_payload?.previousStatus ?? null,
  newStatus: a.diff_payload?.newStatus ?? null,
  notes: a.diff_payload?.notes ?? null,
});

const mapSummaryRow = (r: RawSummaryRow): MonthlySummaryRow => ({
  surveyorId: r.surveyor_id,
  surveyorName: r.surveyor_name,
  surveyorCode: r.surveyor_code,
  assignedZoneId: r.assigned_zone_id,
  totalShiftDays: Number(r.total_shift_days),
  workDays: Number(r.work_days),
  approvedDays: Number(r.approved_days),
  flaggedDays: Number(r.flagged_days),
  rejectedDays: Number(r.rejected_days),
  pendingDays: Number(r.pending_days),
  completedCheckoutDays: Number(r.completed_checkout_days),
  missingCheckoutDays: Number(r.missing_checkout_days),
  totalWorkMinutes: Number(r.total_work_minutes),
  anomalyShiftCount: Number(r.anomaly_shift_count),
  companionCheckinsTotal: Number(r.companion_checkins_total),
  companionAcceptedCount: Number(r.companion_accepted_count),
  companionPendingCount: Number(r.companion_pending_count),
  companions: Array.isArray(r.companions) ? r.companions : [],
  surveysSubmitted: Number(r.surveys_submitted),
});

const compactParams = (params: Record<string, string | number | boolean | undefined>) => {
  const out: Record<string, string> = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') out[k] = String(v);
  });
  return out;
};

// --- KSV ---

export async function fetchMyHistory(params: { fromDate?: string; toDate?: string; isCompanion?: boolean } = {}): Promise<AttendanceRecord[]> {
  const res = await api.get<ApiEnvelope<AttendanceRecord[]>>('/attendance/my-history', { params: compactParams(params) });
  return Array.isArray(res.data?.data) ? res.data.data : [];
}

// --- ADMIN ---

export async function listAdminCheckIns(filters: AdminCheckInFilters): Promise<AdminCheckInPage> {
  const res = await api.get<ApiEnvelope<RawCheckIn[]>>('/admin/attendance', {
    params: compactParams({ ...filters }),
  });
  return {
    items: (res.data?.data || []).map(mapCheckIn),
    total: res.data?.pagination?.total ?? 0,
    scope: res.data?.scope || '',
  };
}

export async function getAdminCheckInDetail(id: string): Promise<AdminCheckInDetail> {
  const res = await api.get<ApiEnvelope<RawCheckInDetail>>(`/admin/attendance/${encodeURIComponent(id)}`);
  const raw = res.data.data;
  return {
    ...mapCheckIn(raw),
    isOwnCheckIn: Boolean(raw.is_own_checkin),
    history: (raw.verification_history || []).map(mapAudit),
    companions: (raw.companions || []).map(mapCheckIn),
  };
}

export async function verifyAdminCheckIn(id: string, action: AttendanceVerifyAction, notes: string | null): Promise<void> {
  await api.post(`/admin/attendance/${encodeURIComponent(id)}/verify`, { action, notes });
}

export async function batchVerifyClean(body: {
  zoneId?: string;
  fromDate?: string;
  toDate?: string;
  isCompanion?: boolean;
  search?: string;
  dryRun: boolean;
}): Promise<BatchVerifyResult> {
  const res = await api.post<ApiEnvelope<BatchVerifyResult>>('/admin/attendance/batch-verify-clean', body);
  return res.data.data;
}

export async function getAttendanceCounters(zoneId?: string): Promise<AttendanceCounters> {
  const res = await api.get<ApiEnvelope<{
    scope: string;
    main_today: number;
    companion_today: number;
    on_field_now: number;
    completed_today: number;
    pending_total: number;
    pending_with_anomaly: number;
    pending_missing_checkout: number;
    pending_distance: number;
  }>>('/admin/attendance/counters', { params: compactParams({ zoneId }) });
  const d = res.data.data;
  return {
    scope: d.scope,
    mainToday: Number(d.main_today),
    companionToday: Number(d.companion_today),
    onFieldNow: Number(d.on_field_now),
    completedToday: Number(d.completed_today),
    pendingTotal: Number(d.pending_total),
    pendingWithAnomaly: Number(d.pending_with_anomaly),
    pendingMissingCheckout: Number(d.pending_missing_checkout),
    pendingDistance: Number(d.pending_distance),
  };
}

export async function getMonthlySummary(zoneId: string | undefined, month: string): Promise<MonthlySummary> {
  const res = await api.get<ApiEnvelope<{
    scope: string;
    month: string;
    period: { status: 'OPEN' | 'LOCKED' };
    rows: RawSummaryRow[];
  }>>('/admin/attendance/summary', { params: compactParams({ zoneId, month }) });
  const d = res.data.data;
  return { scope: d.scope, month: d.month, periodStatus: d.period?.status ?? 'OPEN', rows: (d.rows || []).map(mapSummaryRow) };
}

export async function getPeriodStatus(zoneId: string | undefined, month: string): Promise<PeriodStatus> {
  const res = await api.get<ApiEnvelope<PeriodStatus>>('/admin/attendance/periods/status', {
    params: compactParams({ zoneId, month }),
  });
  return res.data.data;
}

export async function lockAttendancePeriod(zoneId: string | undefined, month: string): Promise<{ sha256: string }> {
  const res = await api.post<ApiEnvelope<{ sha256: string }>>('/admin/attendance/periods/lock', { zoneId, month });
  return res.data.data;
}

export async function unlockAttendancePeriod(zoneId: string | undefined, month: string, reason: string): Promise<void> {
  await api.post('/admin/attendance/periods/unlock', { zoneId, month, reason });
}

/** Tải CSV do server dựng (UTF-8 BOM, chống formula injection; kỳ đã chốt xuất từ snapshot). */
export async function downloadMonthlySummaryCsv(zoneId: string | undefined, month: string): Promise<void> {
  const res = await api.get<Blob>('/admin/attendance/summary/export', {
    params: compactParams({ zoneId, month }),
    responseType: 'blob',
  });
  const disposition = String(res.headers['content-disposition'] || '');
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match ? match[1] : `bang-cham-cong-${month}.csv`;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
