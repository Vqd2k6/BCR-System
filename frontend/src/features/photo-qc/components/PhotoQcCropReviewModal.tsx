import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Crop, Loader2, X, XCircle } from 'lucide-react';
import { getErrorMessage } from '../../../utils/errorUtils';
import { fetchPhotoQcDetail, reviewPhotoQcCrops } from '../api/photoQc.api';
import type { PhotoQcCropReviewItem, PhotoQcCropStatus, PhotoQcDetail, PhotoQcSlotView } from '../types';
import { RotatedPhoto } from './RotatedPhoto';

interface PhotoQcCropReviewModalProps {
  isOpen: boolean;
  reportId: string;
  onClose: () => void;
  /** Gọi sau mỗi lần duyệt thành công để nơi gọi làm mới số liệu (nếu cần). */
  onReviewed?: () => void;
  /** Chế độ chỉ đọc: chỉ xem, ẩn nút Duyệt / Từ chối. */
  readOnly?: boolean;
}

const STATUS_BADGE: Record<PhotoQcCropStatus, { label: string; className: string }> = {
  PENDING: { label: 'Chờ duyệt', className: 'bg-amber-950 text-amber-300 border-amber-700' },
  APPROVED: { label: 'Đã duyệt', className: 'bg-emerald-950 text-emerald-300 border-emerald-700' },
  REJECTED: { label: 'Đã từ chối', className: 'bg-rose-950 text-rose-300 border-rose-700' },
};

const ACTION_BUTTON =
  'px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * Thẩm định xem trước và duyệt từng ô crop trước khi xuất report.
 * Ảnh "Sau crop" dựng đúng khung crop trên ảnh đã xoay (giống bản in); chỉ crop APPROVED mới in.
 */
export const PhotoQcCropReviewModal: React.FC<PhotoQcCropReviewModalProps> = ({ isOpen, reportId, onClose, onReviewed, readOnly = false }) => {
  const [detail, setDetail] = useState<PhotoQcDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchPhotoQcDetail(reportId));
    } catch (err: unknown) {
      console.error('[PhotoQcCropReview:load] Không tải được danh sách crop', err);
      setError(getErrorMessage(err, 'Không tải được danh sách crop'));
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  const cropSlots = useMemo<PhotoQcSlotView[]>(() => (detail?.photos ?? []).filter((s) => s.qc?.crop), [detail]);

  const submit = async (items: PhotoQcCropReviewItem[]) => {
    if (items.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      await reviewPhotoQcCrops(reportId, items);
      await load();
      onReviewed?.();
    } catch (err: unknown) {
      console.error('[PhotoQcCropReview:submit] Không lưu được kết quả duyệt crop', err);
      setError(getErrorMessage(err, 'Không lưu được kết quả duyệt crop'));
    } finally {
      setSaving(false);
    }
  };

  const toItem = (slot: PhotoQcSlotView, decision: PhotoQcCropReviewItem['decision']): PhotoQcCropReviewItem[] => {
    const crop = slot.qc?.crop;
    if (!crop) return [];
    const { x, y, w, h, rotationAtCrop } = crop;
    return [{ photoKey: slot.photoKey, photoUrl: slot.url, crop: { x, y, w, h, rotationAtCrop }, decision }];
  };

  const decide = (slot: PhotoQcSlotView, decision: PhotoQcCropReviewItem['decision']) => submit(toItem(slot, decision));

  const approveAllPending = () =>
    submit(cropSlots.filter((s) => !s.qcStale && s.qc?.cropStatus === 'PENDING').flatMap((s) => toItem(s, 'APPROVED')));

  if (!isOpen) return null;
  const summary = detail?.cropReview;
  const pendingApprovable = cropSlots.filter((s) => !s.qcStale && s.qc?.cropStatus === 'PENDING').length;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <Crop className="w-4 h-4 text-teal-700 shrink-0" />
            <h3 className="text-sm font-bold text-slate-800 truncate">
              Duyệt crop ảnh{detail ? ` – ${detail.reportCode}` : ''}
              {readOnly ? ' (Chỉ Đọc)' : ''}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer" title="Đóng">
            <X className="w-4 h-4" />
          </button>
        </div>

        {summary && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-100 text-[11px] font-bold">
            <span className={`px-2 py-0.5 rounded-full border ${STATUS_BADGE.PENDING.className}`}>Chờ duyệt: {summary.pending}</span>
            <span className={`px-2 py-0.5 rounded-full border ${STATUS_BADGE.APPROVED.className}`}>Đã duyệt: {summary.approved}</span>
            <span className={`px-2 py-0.5 rounded-full border ${STATUS_BADGE.REJECTED.className}`}>Từ chối: {summary.rejected}</span>
            {summary.stale > 0 && (
              <span className="px-2 py-0.5 rounded-full border bg-rose-950 text-rose-300 border-rose-700">Quá hạn: {summary.stale}</span>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={approveAllPending}
                disabled={saving || pendingApprovable === 0}
                className={`${ACTION_BUTTON} ml-auto bg-emerald-600 hover:bg-emerald-700 text-white`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Duyệt tất cả chờ duyệt ({pendingApprovable})</span>
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && !detail && (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang tải...</span>
            </div>
          )}
          {detail && cropSlots.length === 0 && (
            <div className="py-10 text-center text-xs text-slate-500">Hồ sơ này chưa có ô ảnh nào được crop.</div>
          )}
          {cropSlots.map((slot) => {
            const qc = slot.qc;
            if (!qc?.crop) return null;
            const badge = STATUS_BADGE[qc.cropStatus];
            return (
              <div key={slot.photoKey} className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg border text-[11px] bg-teal-950 text-teal-300 border-teal-700 font-mono font-bold">{slot.photoKey}</span>
                  <span className="text-xs font-semibold text-slate-700 truncate">{slot.label}</span>
                  <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${slot.qcStale ? 'bg-rose-950 text-rose-300 border-rose-700' : badge.className}`}>
                    {slot.qcStale ? 'Quá hạn – cần crop lại' : badge.label}
                  </span>
                  {!readOnly && (
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        disabled={saving || slot.qcStale}
                        onClick={() => void decide(slot, 'REJECTED')}
                        className={`${ACTION_BUTTON} bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Từ chối</span>
                      </button>
                      <button
                        type="button"
                        disabled={saving || slot.qcStale || qc.cropStatus === 'APPROVED'}
                        onClick={() => void decide(slot, 'APPROVED')}
                        className={`${ACTION_BUTTON} bg-emerald-600 hover:bg-emerald-700 text-white`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Duyệt</span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 force-light">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase text-slate-500">Ảnh gốc (đã xoay)</div>
                    <RotatedPhoto url={slot.url} rotation={slot.rotation} boxHeight={220} fitHeight />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase text-slate-500">Sau crop ({qc.crop.ratio}) – như report in</div>
                    {slot.qcStale ? (
                      <div className="h-[220px] rounded-lg border border-dashed border-rose-300 flex items-center justify-center text-xs text-rose-600 px-3 text-center">
                        Ảnh hoặc góc xoay đã đổi sau khi crop. Vào Photo QC để crop lại.
                      </div>
                    ) : (
                      <RotatedPhoto url={slot.url} rotation={slot.rotation} boxHeight={220} fitHeight crop={qc.crop} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
