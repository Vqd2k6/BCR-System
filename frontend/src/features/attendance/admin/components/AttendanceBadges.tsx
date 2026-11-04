import React from 'react';
import type {
  AttendanceAnomalyCode,
  AttendanceVerificationStatus,
  BatchSkipReason,
} from '../../types/admin.types';

/** Badge & nhãn dùng chung của màn Admin chấm công (bảng màu chuẩn CLAUDE.md Mục 4.2). */

const BASE = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold whitespace-nowrap';

export const STATUS_LABEL: Record<AttendanceVerificationStatus, string> = {
  PENDING_VERIFICATION: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  FLAGGED_WARNING: 'Nhắc nhở',
  REJECTED: 'Từ chối',
};

const STATUS_CLASS: Record<AttendanceVerificationStatus, string> = {
  PENDING_VERIFICATION: 'bg-slate-800 text-slate-200 border-slate-600',
  APPROVED: 'bg-emerald-950 text-emerald-300 border-emerald-700',
  FLAGGED_WARNING: 'bg-amber-950 text-amber-300 border-amber-700',
  REJECTED: 'bg-rose-950 text-rose-300 border-rose-700',
};

export const ANOMALY_LABEL: Record<AttendanceAnomalyCode, string> = {
  DISTANCE_OVER_500M_IN: 'Vào ca >500m',
  DISTANCE_OVER_500M_OUT: 'Ra ca >500m',
  SHORT_DURATION: 'Ca <30 phút',
  ZONE_NOT_ASSIGNED: 'Ngoài Zone phân công',
  MISSING_CHECKOUT: 'Thiếu Check-out',
};

export const BATCH_SKIP_LABEL: Record<BatchSkipReason, string> = {
  SELF_CHECKIN: 'Ca của chính bạn',
  NOT_CHECKED_OUT: 'Chưa Check-out',
  HAS_ANOMALY: 'Có cảnh báo hệ thống',
  NO_SELFIE: 'Thiếu ảnh selfie',
  PERIOD_LOCKED: 'Kỳ công đã chốt',
  OUT_OF_SCOPE: 'Ngoài phạm vi Zone',
  BATCH_LIMIT: 'Vượt giới hạn 500 ca/lần',
};

export const StatusBadge: React.FC<{ status: AttendanceVerificationStatus }> = ({ status }) => (
  <span className={`${BASE} ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
);

export const AnomalyBadge: React.FC<{ code: AttendanceAnomalyCode }> = ({ code }) => (
  <span
    className={`${BASE} ${
      code === 'MISSING_CHECKOUT' || code === 'SHORT_DURATION'
        ? 'bg-amber-950 text-amber-300 border-amber-700'
        : 'bg-rose-950 text-rose-300 border-rose-700'
    }`}
  >
    {ANOMALY_LABEL[code] || code}
  </span>
);

export const ZoneBadge: React.FC<{ zoneId: string }> = ({ zoneId }) => (
  <span className={`${BASE} bg-cyan-950 text-cyan-300 border-cyan-700 font-mono`}>{zoneId}</span>
);

export const RoleBadge: React.FC<{ isCompanion: boolean }> = ({ isCompanion }) =>
  isCompanion ? (
    <span className={`${BASE} bg-slate-800 text-slate-300 border-slate-600`}>Người đi kèm</span>
  ) : (
    <span className={`${BASE} bg-sky-950 text-sky-300 border-sky-700`}>Khảo Sát Viên</span>
  );

export const DistanceBadge: React.FC<{ meters: number | null; label: string }> = ({ meters, label }) => {
  if (meters === null) return <span className="text-[11px] text-slate-400">{label}: ---</span>;
  const ok = meters <= 500;
  return (
    <span
      className={`${BASE} ${
        ok ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-rose-950 text-rose-300 border-rose-700'
      }`}
    >
      {label}: {Math.round(meters)}m
    </span>
  );
};

export const formatVnTime = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '---';

export const formatVnDateTime = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Ho_Chi_Minh',
      })
    : '---';

export const formatDuration = (minutes: number | null): string => {
  if (minutes === null) return '---';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}p` : `${m}p`;
};

/** Ngày YYYY-MM-DD theo giờ VN, lệch `offsetDays` ngày so với hôm nay. */
export const vnDate = (offsetDays = 0): string => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};

export const vnMonth = (): string => vnDate(0).slice(0, 7);
