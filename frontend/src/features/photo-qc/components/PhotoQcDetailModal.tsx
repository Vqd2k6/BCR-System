import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Crop, Flag, Image as ImageIcon, Loader2, Stamp, X } from 'lucide-react';
import { Modal } from '../../../core/components/ui/Modal';
import { getErrorMessage } from '../../../utils/errorUtils';
import { fetchPhotoQcDetail, savePhotoQcPhotos, savePhotoQcReport } from '../api/photoQc.api';
import type {
  NaturalSize,
  PhotoQcCropInput,
  PhotoQcDetail,
  PhotoQcPhotoRow,
  PhotoQcPhotoUpdate,
  PhotoQcRecaptureLevel,
  PhotoQcReportRow,
  PhotoQcRestampMode,
  PhotoQcSlotView,
} from '../types';
import { KIND_LABEL, LEVEL_LABEL } from '../types';
import { cropAvoidingLegacyStamp, isStandardRatio, rotatedSize } from '../utils/photoQcGeometry';
import { PhotoQcCropEditor } from './PhotoQcCropEditor';
import { RotatedPhoto } from './RotatedPhoto';

interface PhotoQcDetailModalProps {
  reportId: string;
  onClose: () => void;
  /** Báo lại cho màn tổng quan cập nhật hàng mà không phải tải lại cả trang. */
  onChanged: (reportId: string) => void;
}

const FLAG_DEBOUNCE_MS = 1000;

function mergeRows(detail: PhotoQcDetail, rows: PhotoQcPhotoRow[]): PhotoQcDetail {
  const byKey = new Map(rows.map((r) => [r.photoKey, r]));
  return {
    ...detail,
    photos: detail.photos.map((p) => {
      const row = byKey.get(p.photoKey);
      return row ? { ...p, qc: row, qcStale: false } : p;
    }),
  };
}

function suggestLevel(photos: PhotoQcSlotView[]): PhotoQcRecaptureLevel {
  const open = photos.filter((p) => p.qc?.recapture && p.qc.status !== 'RESOLVED');
  if (open.length === 0) return 'NONE';
  return open.some((p) => p.photoGroup === 'INDOOR') ? 'FULL' : 'OUTDOOR_ONLY';
}

export const PhotoQcDetailModal: React.FC<PhotoQcDetailModalProps> = ({ reportId, onClose, onChanged }) => {
  const [detail, setDetail] = useState<PhotoQcDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<'P' | 'IN'>('P');
  const [editing, setEditing] = useState<PhotoQcSlotView | null>(null);
  const [saving, setSaving] = useState(false);
  const sizesRef = useRef<Map<string, NaturalSize>>(new Map());
  const [, forceSizeTick] = useState(0);
  const pendingFlags = useRef<Map<string, PhotoQcPhotoUpdate>>(new Map());
  const flagTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchPhotoQcDetail(reportId));
    } catch (err: unknown) {
      console.error('[PhotoQc:DetailModal.load] Không tải được ảnh hồ sơ', err);
      setError(getErrorMessage(err, 'Không tải được ảnh hồ sơ'));
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  const flushFlags = useCallback(async () => {
    flagTimer.current = null;
    const items = [...pendingFlags.current.values()];
    pendingFlags.current.clear();
    if (items.length === 0) return;
    try {
      const rows = await savePhotoQcPhotos(reportId, items);
      setDetail((d) => (d ? mergeRows(d, rows) : d));
      onChanged(reportId);
    } catch (err: unknown) {
      console.error('[PhotoQc:DetailModal.flushFlags] Không lưu được cờ chụp lại', err);
      setError(getErrorMessage(err, 'Không lưu được cờ chụp lại'));
      void load();
    }
  }, [reportId, onChanged, load]);

  useEffect(
    () => () => {
      if (flagTimer.current !== null) {
        window.clearTimeout(flagTimer.current);
        void flushFlags();
      }
    },
    [flushFlags]
  );

  const toggleFlag = (slot: PhotoQcSlotView) => {
    const next = !(slot.qc?.recapture && slot.qc.status !== 'RESOLVED');
    setDetail((d) =>
      d
        ? {
            ...d,
            photos: d.photos.map((p) =>
              p.photoKey === slot.photoKey
                ? {
                    ...p,
                    qc: {
                      reportId,
                      photoKey: p.photoKey,
                      photoUrl: p.url,
                      photoLabel: p.label,
                      crop: p.qc?.crop ?? null,
                      restampMode: p.qc?.restampMode ?? 'NONE',
                      recapture: next,
                      photoGroup: p.photoGroup,
                      status: next ? 'OPEN' : p.qc?.status ?? 'OPEN',
                      updatedAt: p.qc?.updatedAt ?? null,
                    },
                  }
                : p
            ),
          }
        : d
    );
    pendingFlags.current.set(slot.photoKey, { photoKey: slot.photoKey, photoUrl: slot.url, recapture: next });
    if (flagTimer.current !== null) window.clearTimeout(flagTimer.current);
    flagTimer.current = window.setTimeout(() => void flushFlags(), FLAG_DEBOUNCE_MS);
  };

  const saveReport = async (body: Parameters<typeof savePhotoQcReport>[1]) => {
    setSaving(true);
    setError(null);
    try {
      const qc: PhotoQcReportRow = await savePhotoQcReport(reportId, body);
      setDetail((d) => (d ? { ...d, qc } : d));
      onChanged(reportId);
    } catch (err: unknown) {
      console.error('[PhotoQc:DetailModal.saveReport] Không lưu được thông tin hồ sơ', err);
      setError(getErrorMessage(err, 'Không lưu được thông tin hồ sơ'));
    } finally {
      setSaving(false);
    }
  };

  const saveCrop = async (slot: PhotoQcSlotView, crop: PhotoQcCropInput | null, restampMode: PhotoQcRestampMode | undefined) => {
    setSaving(true);
    setError(null);
    try {
      const rows = await savePhotoQcPhotos(reportId, [{ photoKey: slot.photoKey, photoUrl: slot.url, crop, ...(restampMode ? { restampMode } : {}) }]);
      setDetail((d) => (d ? mergeRows(d, rows) : d));
      setEditing(null);
      onChanged(reportId);
    } catch (err: unknown) {
      console.error('[PhotoQc:DetailModal.saveCrop] Không lưu được khung crop', err);
      setError(getErrorMessage(err, 'Không lưu được khung crop'));
    } finally {
      setSaving(false);
    }
  };

  const legacyPhotos = useMemo(() => (detail?.photos ?? []).filter((p) => p.legacyWatermarked), [detail]);

  /** Mọi ảnh có dấu cũ: crop bỏ vùng dấu cũ rồi dập lại cả logo và chữ. */
  const bulkRestamp = async () => {
    if (!detail) return;
    const items: PhotoQcPhotoUpdate[] = [];
    let missing = 0;
    for (const p of legacyPhotos) {
      const size = sizesRef.current.get(p.photoKey);
      if (!size) {
        missing++;
        continue;
      }
      const { rect, ratio } = cropAvoidingLegacyStamp(size, p.rotation);
      const rot = rotatedSize(size, p.rotation);
      items.push({
        photoKey: p.photoKey,
        photoUrl: p.url,
        crop: { ...rect, ratio, rotationAtCrop: p.rotation, imageWidth: rot.width, imageHeight: rot.height },
        restampMode: 'BOTH',
      });
    }
    if (items.length === 0) {
      setNotice('Chưa tải xong ảnh nào có dấu cũ, hãy mở cả hai tab rồi thử lại.');
      return;
    }
    const ok = window.confirm(
      `Crop bỏ vùng dấu cũ và dập lại logo + giờ/mã cho ${items.length} ảnh có watermark cũ${missing ? ` (${missing} ảnh chưa tải xong sẽ bỏ qua)` : ''}? Khung cũ của các ảnh này sẽ bị thay.`
    );
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const rows = await savePhotoQcPhotos(reportId, items);
      setDetail((d) => (d ? mergeRows(d, rows) : d));
      setNotice(`Đã đặt khung crop và dập bù cho ${rows.length} ảnh.`);
      onChanged(reportId);
    } catch (err: unknown) {
      console.error('[PhotoQc:DetailModal.bulkRestamp] Không lưu được thao tác hàng loạt', err);
      setError(getErrorMessage(err, 'Không lưu được thao tác hàng loạt'));
    } finally {
      setSaving(false);
    }
  };

  const photos = (detail?.photos ?? []).filter((p) => (tab === 'P' ? p.section === 'P' : p.section !== 'P'));
  const level = detail?.qc?.recaptureLevel ?? 'NONE';
  const suggested = detail ? suggestLevel(detail.photos) : 'NONE';
  const coverOn = detail?.qc?.coverSource === 'P04';
  const coverDisabledReason = !detail
    ? ''
    : !detail.coverEligible
      ? 'Hồ sơ căn hộ giữ bìa cũ (P-04 căn hộ là cửa & hành lang)'
      : !detail.hasP04
        ? 'Hồ sơ không có ảnh P-04 hợp lệ'
        : '';

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="full"
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span>Rà soát ảnh hồ sơ</span>
          {detail && (
            <>
              <span className="px-2 py-0.5 rounded-md border text-xs bg-teal-950 text-teal-300 border-teal-700 font-mono font-bold">{detail.reportCode}</span>
              <span className="px-2 py-0.5 rounded-md border text-xs bg-slate-800 text-slate-300 border-slate-600">{KIND_LABEL[detail.kind]}</span>
              <span className="text-xs text-slate-500">{detail.status}</span>
            </>
          )}
        </span>
      }
    >
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Đang tải ảnh như bản in…
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="cursor-pointer text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {notice && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 flex items-center justify-between gap-2">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="cursor-pointer text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {detail && !loading && (
        <div className="space-y-4">
          {detail.appliesFromNextRevision && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Hồ sơ đã duyệt: bản đã phát hành giữ nguyên. Thay đổi bìa, crop hay dập bù chỉ in từ lần phát hành Rev kế tiếp.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className={`flex items-center gap-2 text-xs font-bold ${coverDisabledReason ? 'text-slate-400' : 'text-slate-700'}`} title={coverDisabledReason}>
              <input
                type="checkbox"
                checked={coverOn}
                disabled={Boolean(coverDisabledReason) || saving}
                onChange={(e) => void saveReport({ coverSource: e.target.checked ? 'P04' : null })}
                className="w-4 h-4 accent-teal-600 cursor-pointer disabled:cursor-not-allowed"
              />
              Dùng P-04 làm ảnh bìa
            </label>
            {coverDisabledReason && <span className="text-[11px] text-slate-500">{coverDisabledReason}</span>}

            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-700">Mức thu thập lại</span>
              <select
                value={level}
                disabled={saving}
                onChange={(e) => void saveReport({ recaptureLevel: e.target.value as PhotoQcRecaptureLevel })}
                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs cursor-pointer"
              >
                {(Object.keys(LEVEL_LABEL) as PhotoQcRecaptureLevel[]).map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABEL[l]}
                    {l === suggested ? ' (gợi ý)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(detail.qc?.reviewed)}
                disabled={saving}
                onChange={(e) => void saveReport({ reviewed: e.target.checked })}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
              Đã rà xong
            </label>

            {legacyPhotos.length > 0 && (
              <button
                type="button"
                onClick={() => void bulkRestamp()}
                disabled={saving}
                className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Áp cho mọi ảnh có watermark cũ của hồ sơ"
              >
                <Stamp className="w-4 h-4" /> Crop bỏ dấu cũ và dập lại ({legacyPhotos.length})
              </button>
            )}
          </div>

          <div className="flex gap-2 border-b border-slate-200">
            {([
              ['P', `Ảnh P (${detail.photos.filter((p) => p.section === 'P').length})`],
              ['IN', `Trong nhà (${detail.photos.filter((p) => p.section !== 'P').length})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-4 py-2 text-xs font-bold border-b-2 -mb-px cursor-pointer ${tab === key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {photos.length === 0 && <p className="text-xs text-slate-500 py-8 text-center">Không có ảnh trong mục này.</p>}

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {photos.map((p) => {
              const size = sizesRef.current.get(p.photoKey);
              const validCrop = p.qc?.crop && !p.qcStale ? p.qc.crop : null;
              const printed = size ? rotatedSize(size, p.rotation) : null;
              const badRatio = printed && !validCrop ? !isStandardRatio(printed) : false;
              const flagged = Boolean(p.qc?.recapture && p.qc.status !== 'RESOLVED');
              const isCover = (coverOn && p.photoKey === 'P-04') || (!coverOn && p.photoKey === 'P-02');
              return (
                <div key={p.photoKey} className={`rounded-xl border p-2 space-y-2 bg-white ${flagged ? 'border-rose-300' : 'border-slate-200'}`}>
                  <div className="relative">
                    <RotatedPhoto
                      url={p.url}
                      rotation={p.rotation}
                      boxWidth={260}
                      boxHeight={195}
                      crop={validCrop}
                      useThumb
                      onSize={(s) => {
                        if (!sizesRef.current.has(p.photoKey)) {
                          sizesRef.current.set(p.photoKey, s);
                          forceSizeTick((n) => n + 1);
                        }
                      }}
                      className="w-full"
                    />
                    <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1">
                      {isCover && p.section === 'P' && <span className="px-1.5 py-0.5 rounded bg-teal-600 text-white text-[10px] font-bold">Bìa</span>}
                      {validCrop && <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">Crop {validCrop.ratio}</span>}
                      {badRatio && <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold">⚠ Sai tỉ lệ</span>}
                      {p.legacyWatermarked && <span className="px-1.5 py-0.5 rounded bg-slate-700 text-white text-[10px] font-bold">Dấu cũ</span>}
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-700 line-clamp-2" title={p.label}>{p.label}</p>
                  <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                    <span className={`px-1.5 py-0.5 rounded border ${p.photoGroup === 'OUTDOOR' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                      {p.photoGroup === 'OUTDOOR' ? 'Không cần chủ hộ' : 'Trong nhà'}
                    </span>
                    {p.rotation !== 0 && <span>xoay {p.rotation}°</span>}
                    {p.qc?.restampMode && p.qc.restampMode !== 'NONE' && validCrop && <span>dập bù {p.qc.restampMode}</span>}
                  </div>
                  {p.qcStale && (
                    <p className="text-[11px] text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Ảnh hoặc góc xoay đã đổi, cần crop lại
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleFlag(p)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 cursor-pointer ${flagged ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-rose-50'}`}
                    >
                      <Flag className="w-3.5 h-3.5" /> {flagged ? 'Cần chụp lại' : 'Chụp lại'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(p)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-white text-slate-600 border-slate-200 hover:bg-teal-50 flex items-center gap-1 cursor-pointer"
                    >
                      <Crop className="w-3.5 h-3.5" /> {validCrop ? 'Sửa crop' : 'Crop'}
                    </button>
                    {p.qc?.crop && (
                      <button
                        type="button"
                        onClick={() => void saveCrop(p, null, p.legacyWatermarked ? 'NONE' : undefined)}
                        disabled={saving}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-white text-slate-500 border-slate-200 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Bỏ crop
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-4 space-y-3 max-h-[94vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-teal-600" /> Crop {editing.label}
              </h4>
              <button type="button" onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <PhotoQcCropEditor
              slot={editing}
              saving={saving}
              onCancel={() => setEditing(null)}
              onSave={(crop, restampMode) => void saveCrop(editing, crop, restampMode)}
            />
          </div>
        </div>
      )}

      {detail && !loading && detail.qc?.reviewed && (
        <p className="mt-4 text-[11px] text-emerald-700 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Hồ sơ đã được đánh dấu rà xong.
        </p>
      )}
    </Modal>
  );
};
