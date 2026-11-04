import React, { useCallback, useEffect, useState } from 'react';
import { X, Lock, History, Users } from 'lucide-react';
import { getErrorMessage } from '@/utils/errorUtils';
import { getAdminCheckInDetail, verifyAdminCheckIn } from '../../api/attendance.api';
import type { AdminCheckInDetail, AttendanceVerifyAction } from '../../types/admin.types';
import {
  AnomalyBadge,
  DistanceBadge,
  RoleBadge,
  STATUS_LABEL,
  StatusBadge,
  ZoneBadge,
  formatDuration,
  formatVnDateTime,
  formatVnTime,
} from './AttendanceBadges';
import { AttendanceSpatialMiniMap } from './AttendanceSpatialMiniMap';

interface Props {
  checkInId: string;
  /** Ép chế độ chỉ đọc từ màn cha (ngoài các trường hợp tự động: kỳ đã chốt, ca của chính mình). */
  readOnly?: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const ACTIONS: Array<{ action: AttendanceVerifyAction; label: string; className: string }> = [
  { action: 'APPROVE', label: '✓ Duyệt', className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  { action: 'FLAG_WARNING', label: '⚠ Nhắc nhở', className: 'bg-amber-500 hover:bg-amber-600 text-white' },
  { action: 'REJECT', label: '✕ Từ chối', className: 'bg-rose-600 hover:bg-rose-700 text-white' },
  { action: 'RESET_PENDING', label: 'Đưa về Chờ duyệt', className: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300' },
];

const ACTION_STATUS: Record<AttendanceVerifyAction, AdminCheckInDetail['verificationStatus']> = {
  APPROVE: 'APPROVED',
  FLAG_WARNING: 'FLAGGED_WARNING',
  REJECT: 'REJECTED',
  RESET_PENDING: 'PENDING_VERIFICATION',
};

const Photo: React.FC<{ url: string | null; label: string; time: string | null }> = ({ url, label, time }) => (
  <figure className="space-y-1">
    {url ? (
      <a href={url} target="_blank" rel="noreferrer" className="block cursor-pointer">
        <img src={url} alt={label} className="w-full aspect-[3/4] object-cover rounded-xl border border-slate-200 bg-slate-100" />
      </a>
    ) : (
      <div className="w-full aspect-[3/4] rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
        Chưa có ảnh
      </div>
    )}
    <figcaption className="text-[11px] text-slate-500 text-center">
      {label} · {formatVnTime(time)}
    </figcaption>
  </figure>
);

/** Modal hậu kiểm 1 ca: soi 2 selfie, bản đồ 500m, cờ hệ thống, lượt đi kèm, lịch sử duyệt và form duyệt. */
export const AttendanceVerifyDetailModal: React.FC<Props> = ({ checkInId, readOnly = false, onClose, onChanged }) => {
  const [currentId, setCurrentId] = useState(checkInId);
  const [detail, setDetail] = useState<AdminCheckInDetail | null>(null);
  const [notes, setNotes] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoadError(null);
    try {
      setDetail(await getAdminCheckInDetail(id));
    } catch (err: unknown) {
      console.error('[AttendanceVerifyDetailModal:load] Không tải được chi tiết ca:', err);
      setLoadError(getErrorMessage(err, 'Không tải được chi tiết ca chấm công.'));
    }
  }, []);

  useEffect(() => {
    setDetail(null);
    setNotes('');
    setSubmitError(null);
    void load(currentId);
  }, [currentId, load]);

  const isReadOnly = readOnly || Boolean(detail?.isPeriodLocked) || Boolean(detail?.isOwnCheckIn);
  const readOnlyReason = detail?.isPeriodLocked
    ? 'Kỳ công đã chốt — cần Super Admin mở khóa kỳ để thay đổi.'
    : detail?.isOwnCheckIn
      ? 'Ca chấm công của chính bạn — do Super Admin duyệt.'
      : 'Chế độ xem tham khảo.';

  const submit = async (action: AttendanceVerifyAction) => {
    if (!detail || isSubmitting) return;
    const needsNotes = action === 'REJECT' || action === 'FLAG_WARNING' || detail.verificationStatus !== 'PENDING_VERIFICATION';
    if (needsNotes && !notes.trim()) {
      setSubmitError(
        detail.verificationStatus !== 'PENDING_VERIFICATION'
          ? 'Bắt buộc nhập lý do khi thay đổi quyết định đã duyệt.'
          : 'Bắt buộc nhập ghi chú thẩm định khi Từ chối hoặc Nhắc nhở.'
      );
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await verifyAdminCheckIn(detail.id, action, notes.trim() || null);
      setNotes('');
      await load(detail.id);
      onChanged();
    } catch (err: unknown) {
      console.error('[AttendanceVerifyDetailModal:submit] Duyệt ca thất bại:', err);
      setSubmitError(getErrorMessage(err, 'Không lưu được kết quả duyệt. Ghi chú bạn nhập vẫn được giữ nguyên.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1200] bg-slate-900/50 flex items-start sm:items-center justify-center p-2 sm:p-6 overflow-y-auto cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 cursor-default">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 flex-wrap">
              Hậu kiểm ca chấm công{isReadOnly ? ' (Chỉ Đọc)' : ''}
              {detail && <StatusBadge status={detail.verificationStatus} />}
              {detail && <ZoneBadge zoneId={detail.zoneId} />}
              {isReadOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold bg-slate-800 text-teal-300 border-teal-500/30">
                  <Lock size={11} /> {detail?.isPeriodLocked ? 'Kỳ đã chốt' : 'Tham khảo'}
                </span>
              )}
            </h3>
            {detail && (
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                <RoleBadge isCompanion={detail.isCompanion} />
                <strong className="text-slate-800">{detail.isCompanion ? detail.companionName : detail.surveyorName}</strong>
                {detail.isCompanion && <span>· tổ KSV {detail.surveyorName}</span>}
                {(detail.isCompanion ? detail.companionPhone : detail.surveyorPhone) && (
                  <span>· {detail.isCompanion ? detail.companionPhone : detail.surveyorPhone}</span>
                )}
                <span>· Ngày {detail.workDate}</span>
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        {loadError && <div className="m-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{loadError}</div>}
        {!detail && !loadError && <div className="p-10 text-center text-xs text-slate-400">Đang tải chi tiết ca…</div>}

        {detail && (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-2 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Photo url={detail.selfieInUrl} label="Selfie vào ca" time={detail.checkInTime} />
                <Photo url={detail.selfieOutUrl} label="Selfie ra ca" time={detail.checkOutTime} />
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>
                  Thời lượng:{' '}
                  <strong>
                    {detail.checkOutTime ? formatDuration(detail.workDurationMinutes) : detail.isMissingCheckout ? 'Thiếu Check-out' : 'Đang trong ca'}
                  </strong>
                </div>
                {detail.notesIn && <div>Giải trình lúc vào: “{detail.notesIn}”</div>}
                {detail.notesOut && <div>Ghi chú lúc ra: “{detail.notesOut}”</div>}
                {!detail.isCompanion && (
                  <div>
                    Sản lượng ngày: Tạo <strong>{detail.surveysCreatedCount ?? '---'}</strong> · Nộp{' '}
                    <strong>{detail.surveysSubmittedCount ?? '---'}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-3 space-y-3">
              <AttendanceSpatialMiniMap zoneCenter={detail.zoneCenterIn} gpsIn={detail.gpsIn} gpsOut={detail.gpsOut} />
              <div className="flex flex-wrap gap-1.5">
                <DistanceBadge meters={detail.distanceIn} label="Vào" />
                {detail.checkOutTime && <DistanceBadge meters={detail.distanceOut} label="Ra" />}
                {detail.gpsAccuracyIn !== null && <span className="text-[11px] text-slate-500">GPS vào ±{Math.round(detail.gpsAccuracyIn)}m</span>}
                {detail.gpsAccuracyOut !== null && <span className="text-[11px] text-slate-500">· GPS ra ±{Math.round(detail.gpsAccuracyOut)}m</span>}
              </div>
              {detail.anomalyCodes.length > 0 && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {detail.anomalyCodes.map((c) => (
                      <AnomalyBadge key={c} code={c} />
                    ))}
                  </div>
                  {detail.anomalyReason && <p className="text-[11px] text-rose-800">{detail.anomalyReason}</p>}
                </div>
              )}

              {!detail.isCompanion && detail.companions.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <Users size={12} /> Người đi kèm cùng ngày (duyệt riêng từng lượt)
                  </div>
                  {detail.companions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCurrentId(c.id)}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs cursor-pointer"
                    >
                      <span className="truncate">
                        <strong>{c.companionName}</strong> {c.companionPhone ? `· ${c.companionPhone}` : ''} · {formatVnTime(c.checkInTime)}
                      </span>
                      <StatusBadge status={c.verificationStatus} />
                    </button>
                  ))}
                </div>
              )}
              {detail.isCompanion && (
                <p className="text-[11px] text-slate-500">
                  Kết quả duyệt lượt đi kèm không ảnh hưởng tới ngày công của KSV.
                </p>
              )}

              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <History size={12} /> Lịch sử duyệt
                </div>
                {detail.history.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Chưa có thao tác duyệt nào.</p>
                ) : (
                  <ul className="space-y-1">
                    {detail.history.map((h) => (
                      <li key={h.id} className="text-[11px] text-slate-600">
                        <span className="text-slate-400">{formatVnDateTime(h.createdAt)}</span> · <strong>{h.performedByName || 'Hệ thống'}</strong>:{' '}
                        {h.previousStatus && h.newStatus
                          ? `${STATUS_LABEL[h.previousStatus as keyof typeof STATUS_LABEL] ?? h.previousStatus} → ${STATUS_LABEL[h.newStatus as keyof typeof STATUS_LABEL] ?? h.newStatus}`
                          : h.action}
                        {h.notes ? ` — “${h.notes}”` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {isReadOnly ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">{readOnlyReason}</div>
              ) : (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      detail.verificationStatus === 'PENDING_VERIFICATION'
                        ? 'Ghi chú thẩm định (bắt buộc khi Nhắc nhở / Từ chối)…'
                        : 'Lý do thay đổi quyết định (bắt buộc)…'
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  {submitError && <p className="text-xs text-rose-700">{submitError}</p>}
                  <div className="flex flex-wrap gap-2">
                    {ACTIONS.filter((a) => ACTION_STATUS[a.action] !== detail.verificationStatus).map((a) => (
                      <button
                        key={a.action}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void submit(a.action)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${a.className}`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {currentId !== checkInId && (
                <button
                  type="button"
                  onClick={() => setCurrentId(checkInId)}
                  className="text-[11px] font-bold text-sky-700 hover:underline cursor-pointer"
                >
                  ← Quay lại ca ban đầu
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
