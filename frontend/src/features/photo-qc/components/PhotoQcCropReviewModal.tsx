import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Crop, Loader2, Maximize2, X, XCircle } from 'lucide-react';
import { getErrorMessage } from '../../../utils/errorUtils';
import { fetchPhotoQcDetail, reviewPhotoQcCrops } from '../api/photoQc.api';
import type { PhotoQcCropInput, PhotoQcCropReviewItem, PhotoQcDetail, PhotoQcSlotView } from '../types';
import { RotatedPhoto } from './RotatedPhoto';
import { PhotoQcCropEditor } from './PhotoQcCropEditor';
import { PhotoQcLightbox } from './PhotoQcLightbox';

interface PhotoQcCropReviewModalProps {
  isOpen: boolean;
  reportId: string;
  onClose: () => void;
  /** Gọi sau mỗi lần duyệt / chỉnh thành công để Studio cập nhật ảnh ngay. */
  onReviewed?: () => void;
  /** Chế độ chỉ đọc: chỉ xem, ẩn nút Duyệt / Từ chối / Chỉnh khung. */
  readOnly?: boolean;
  /** Mở thẳng vào ô này (bấm badge "Crop chờ duyệt" trên thẻ ảnh Studio). */
  initialPhotoKey?: string | null;
}

type ReviewState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'STALE';
type Filter = 'ALL' | ReviewState;
type ViewMode = 'RESULT' | 'ORIGINAL' | 'EDIT';

const STATE_BADGE: Record<ReviewState, { label: string; className: string }> = {
  PENDING: { label: 'Chờ duyệt', className: 'bg-amber-950 text-amber-300 border-amber-700' },
  APPROVED: { label: 'Đã duyệt', className: 'bg-emerald-950 text-emerald-300 border-emerald-700' },
  REJECTED: { label: 'Đã từ chối', className: 'bg-rose-950 text-rose-300 border-rose-700' },
  STALE: { label: 'Quá hạn', className: 'bg-rose-950 text-rose-300 border-rose-700' },
};

const ACTION_BUTTON =
  'px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

function stateOf(slot: PhotoQcSlotView): ReviewState {
  if (slot.qcStale) return 'STALE';
  return slot.qc?.cropStatus ?? 'PENDING';
}

function useViewport(): { w: number; h: number } {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return vp;
}

/**
 * Thẩm định duyệt từng ô crop trước khi xuất report.
 * Trái: danh sách ô + lọc trạng thái. Phải: một ảnh lớn, xem "Kết quả" (đúng phần in), "Ảnh gốc" hoặc "Chỉnh khung".
 * Chỉnh khung rồi lưu = duyệt luôn. ← → chuyển ô, A duyệt, R từ chối, E chỉnh, Z phóng to, Esc đóng.
 */
export const PhotoQcCropReviewModal: React.FC<PhotoQcCropReviewModalProps> = ({
  isOpen,
  reportId,
  onClose,
  onReviewed,
  readOnly = false,
  initialPhotoKey = null,
}) => {
  const vp = useViewport();
  const [detail, setDetail] = useState<PhotoQcDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [activeKey, setActiveKey] = useState<string | null>(initialPhotoKey);
  const [mode, setMode] = useState<ViewMode>('RESULT');
  const [zoom, setZoom] = useState(false);

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

  useEffect(() => {
    if (isOpen && initialPhotoKey) setActiveKey(initialPhotoKey);
  }, [isOpen, initialPhotoKey]);

  const cropSlots = useMemo<PhotoQcSlotView[]>(() => (detail?.photos ?? []).filter((s) => s.qc?.crop), [detail]);
  const visible = useMemo(() => (filter === 'ALL' ? cropSlots : cropSlots.filter((s) => stateOf(s) === filter)), [cropSlots, filter]);
  const counts = useMemo(() => {
    const c: Record<ReviewState, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, STALE: 0 };
    for (const s of cropSlots) c[stateOf(s)]++;
    return c;
  }, [cropSlots]);

  // Ô đang xem: giữ nếu còn trong danh sách lọc, không thì ô đầu tiên.
  const activeIndex = Math.max(0, visible.findIndex((s) => s.photoKey === activeKey));
  const active = visible[activeIndex] ?? null;
  useEffect(() => {
    if (active && active.photoKey !== activeKey) setActiveKey(active.photoKey);
  }, [active, activeKey]);

  const go = useCallback(
    (delta: number) => {
      const next = visible[activeIndex + delta];
      if (next) {
        setActiveKey(next.photoKey);
        setMode('RESULT');
      }
    },
    [visible, activeIndex]
  );

  const submit = async (items: PhotoQcCropReviewItem[], advance: boolean) => {
    if (items.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      await reviewPhotoQcCrops(reportId, items);
      // Nhảy sang ô chờ duyệt kế tiếp (tính trên danh sách trước khi tải lại).
      if (advance && active) {
        const after = [...visible.slice(activeIndex + 1), ...visible.slice(0, activeIndex)];
        const nextPending = after.find((s) => stateOf(s) === 'PENDING');
        if (nextPending) setActiveKey(nextPending.photoKey);
      }
      setMode('RESULT');
      await load();
      onReviewed?.();
    } catch (err: unknown) {
      console.error('[PhotoQcCropReview:submit] Không lưu được kết quả duyệt crop', err);
      setError(getErrorMessage(err, 'Không lưu được kết quả duyệt crop'));
    } finally {
      setSaving(false);
    }
  };

  const toItem = (slot: PhotoQcSlotView, decision: PhotoQcCropReviewItem['decision'], newCrop?: PhotoQcCropInput): PhotoQcCropReviewItem[] => {
    const crop = slot.qc?.crop;
    if (!crop) return [];
    const { x, y, w, h, rotationAtCrop } = crop;
    return [{ photoKey: slot.photoKey, photoUrl: slot.url, crop: { x, y, w, h, rotationAtCrop }, decision, ...(newCrop ? { newCrop } : {}) }];
  };

  const canApprove = Boolean(active && !readOnly && stateOf(active) !== 'STALE' && stateOf(active) !== 'APPROVED');
  const canReject = Boolean(active && !readOnly && stateOf(active) !== 'REJECTED');

  const approve = () => active && canApprove && void submit(toItem(active, 'APPROVED'), true);
  const reject = () => active && canReject && void submit(toItem(active, 'REJECTED'), true);
  const approveAllPending = () =>
    void submit(cropSlots.filter((s) => stateOf(s) === 'PENDING').flatMap((s) => toItem(s, 'APPROVED')), false);

  useEffect(() => {
    if (!isOpen || zoom) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') {
        if (mode === 'EDIT') setMode('RESULT');
        else onClose();
      } else if (mode === 'EDIT') {
        return;
      } else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'a' || e.key === 'A') approve();
      else if (e.key === 'r' || e.key === 'R') reject();
      else if ((e.key === 'e' || e.key === 'E') && !readOnly && active) setMode('EDIT');
      else if (e.key === 'z' || e.key === 'Z') setZoom(true);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!isOpen) return null;

  const stageW = Math.max(320, vp.w - 320 - 64);
  const stageH = Math.max(240, vp.h - 190);
  const activeState = active ? stateOf(active) : null;

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-white flex flex-col" role="dialog" aria-modal="true">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200">
        <Crop className="w-4 h-4 text-teal-700 shrink-0" />
        <h3 className="text-sm font-bold text-slate-800 truncate">
          Duyệt crop ảnh{detail ? ` – ${detail.reportCode}` : ''}
          {readOnly ? ' (Chỉ Đọc)' : ''}
        </h3>
        <div className="ml-auto flex items-center gap-2">
          {!readOnly && (
            <button
              type="button"
              onClick={approveAllPending}
              disabled={saving || counts.PENDING === 0}
              className={`${ACTION_BUTTON} bg-emerald-600 hover:bg-emerald-700 text-white`}
              title="Duyệt nhanh mọi ô đang chờ (không tính ô quá hạn)"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Duyệt tất cả chờ duyệt ({counts.PENDING})</span>
            </button>
          )}
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer" title="Đóng (Esc)">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Danh sách ô */}
        <aside className="w-80 shrink-0 border-r border-slate-200 flex flex-col min-h-0">
          <div className="flex flex-wrap gap-1 p-2 border-b border-slate-100">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'STALE'] as const).map((f) => {
              const n = f === 'ALL' ? cropSlots.length : counts[f];
              if (f === 'STALE' && n === 0) return null;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-2 py-0.5 rounded-full border text-[11px] font-bold cursor-pointer ${
                    filter === f ? 'ring-2 ring-teal-500 ' : ''
                  }${f === 'ALL' ? 'bg-slate-100 text-slate-700 border-slate-300' : STATE_BADGE[f].className}`}
                >
                  {f === 'ALL' ? 'Tất cả' : STATE_BADGE[f].label}: {n}
                </button>
              );
            })}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && !detail && (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang tải...</span>
              </div>
            )}
            {detail && visible.length === 0 && (
              <div className="py-10 px-3 text-center text-xs text-slate-500">
                {cropSlots.length === 0 ? 'Hồ sơ này chưa có ô ảnh nào được crop.' : 'Không có ô nào ở trạng thái này.'}
              </div>
            )}
            {visible.map((slot) => {
              const st = stateOf(slot);
              const selected = slot.photoKey === active?.photoKey;
              return (
                <button
                  key={slot.photoKey}
                  type="button"
                  onClick={() => {
                    setActiveKey(slot.photoKey);
                    setMode('RESULT');
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-left border-b border-slate-100 cursor-pointer ${
                    selected ? 'bg-teal-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="w-16 h-12 shrink-0 force-light">
                    <RotatedPhoto
                      url={slot.url}
                      rotation={slot.rotation}
                      boxWidth={64}
                      boxHeight={48}
                      useThumb
                      lowPriority
                      crop={st === 'STALE' ? null : slot.qc?.crop ?? null}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-mono font-bold text-slate-700 truncate">{slot.photoKey}</div>
                    <div className="text-[11px] text-slate-600 truncate">{slot.label}</div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${STATE_BADGE[st].className}`}>
                    {STATE_BADGE[st].label}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Ảnh lớn */}
        <section className="flex-1 flex flex-col min-w-0">
          {active && activeState ? (
            <>
              <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-100">
                <span className="px-2 py-0.5 rounded-lg border text-[11px] bg-teal-950 text-teal-300 border-teal-700 font-mono font-bold">{active.photoKey}</span>
                <span className="text-xs font-semibold text-slate-700 truncate max-w-[30ch]">{active.label}</span>
                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${STATE_BADGE[activeState].className}`}>
                  {activeState === 'STALE' ? 'Quá hạn – chỉnh lại khung' : STATE_BADGE[activeState].label}
                </span>
                <span className="text-[11px] text-slate-500">
                  {activeIndex + 1}/{visible.length} • xoay {active.rotation}° • {active.qc?.crop?.ratio}
                </span>
                <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
                  {(
                    [
                      ['RESULT', 'Kết quả in'],
                      ['ORIGINAL', 'Ảnh gốc'],
                      ...(readOnly ? [] : [['EDIT', 'Chỉnh khung']]),
                    ] as Array<[ViewMode, string]>
                  ).map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${mode === m ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {mode !== 'EDIT' && (
                  <button
                    type="button"
                    onClick={() => setZoom(true)}
                    className={`${ACTION_BUTTON} border border-slate-200 text-slate-600 hover:bg-slate-50`}
                    title="Phóng to toàn màn hình (Z)"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {!readOnly && mode !== 'EDIT' && (
                  <>
                    <button
                      type="button"
                      disabled={saving || !canReject}
                      onClick={reject}
                      title={activeState === 'STALE' ? 'Từ chối crop quá hạn: report in ảnh không crop (R)' : 'Từ chối: report in ảnh không crop (R)'}
                      className={`${ACTION_BUTTON} bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Từ chối</span>
                    </button>
                    <button
                      type="button"
                      disabled={saving || !canApprove}
                      onClick={approve}
                      title="Duyệt (A)"
                      className={`${ACTION_BUTTON} bg-emerald-600 hover:bg-emerald-700 text-white`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Duyệt</span>
                    </button>
                  </>
                )}
              </div>

              <div className="relative flex-1 min-h-0 flex items-center justify-center bg-slate-100 overflow-auto force-light">
                {mode === 'EDIT' ? (
                  <div className="p-3 bg-white rounded-xl shadow-sm">
                    <PhotoQcCropEditor
                      key={`${active.photoKey}|${active.url}|${active.qc?.crop?.x}|${active.qc?.crop?.y}`}
                      slot={active}
                      saving={saving}
                      maxWidth={stageW - 40}
                      maxHeight={stageH - 130}
                      saveLabel="Lưu khung & duyệt"
                      hideRestamp
                      blockCutPins
                      onCancel={() => setMode('RESULT')}
                      onSave={(crop) => void submit(toItem(active, 'ADJUST', crop), true)}
                    />
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={activeIndex === 0}
                      onClick={() => go(-1)}
                      className="absolute left-3 z-10 p-2 rounded-full bg-slate-800/70 text-white hover:bg-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Ô trước (←)"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    {mode === 'RESULT' && activeState === 'STALE' ? (
                      <div className="max-w-md text-center text-sm text-rose-700 px-4">
                        Ảnh hoặc góc xoay đã đổi sau khi crop, khung cũ không còn đúng. Bấm <strong>Chỉnh khung</strong> để vẽ lại (lưu là duyệt), hoặc
                        <strong> Từ chối</strong> để in ảnh không crop.
                      </div>
                    ) : (
                      <button type="button" onClick={() => setZoom(true)} className="cursor-pointer" title="Bấm để phóng to">
                        <RotatedPhoto
                          key={`${active.url}|${mode}`}
                          url={active.url}
                          rotation={active.rotation}
                          boxWidth={stageW - 100}
                          boxHeight={stageH - 20}
                          crop={mode === 'RESULT' ? active.qc?.crop ?? null : null}
                          className="bg-transparent"
                        />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={activeIndex >= visible.length - 1}
                      onClick={() => go(1)}
                      className="absolute right-3 z-10 p-2 rounded-full bg-slate-800/70 text-white hover:bg-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Ô sau (→)"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}
              </div>
              <p className="text-center text-[11px] text-slate-500 py-1.5 border-t border-slate-100">
                ← → chuyển ô • Z phóng to{readOnly ? '' : ' • A duyệt • R từ chối • E chỉnh khung (lưu = duyệt)'} • Esc đóng
              </p>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              {loading ? 'Đang tải...' : 'Chọn một ô ở danh sách bên trái.'}
            </div>
          )}
        </section>
      </div>

      {zoom && active && (
        <PhotoQcLightbox
          photos={visible}
          index={activeIndex}
          onIndex={(i) => {
            const s = visible[i];
            if (s) setActiveKey(s.photoKey);
          }}
          onClose={() => setZoom(false)}
        />
      )}
    </div>,
    document.body
  );
};
