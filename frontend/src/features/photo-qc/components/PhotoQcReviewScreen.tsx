import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Crop, Flag, Image as ImageIcon, Loader2, Maximize2, Stamp, X } from 'lucide-react';
import { getErrorMessage } from '../../../utils/errorUtils';
import { fetchPhotoQcDetail, savePhotoQcPhotos, savePhotoQcReport } from '../api/photoQc.api';
import type {
  NaturalSize,
  PhotoQcCropInput,
  PhotoQcDetail,
  PhotoQcEffectiveLevel,
  PhotoQcPhotoRow,
  PhotoQcPhotoUpdate,
  PhotoQcRecaptureLevel,
  PhotoQcReportRow,
  PhotoQcReportUpdate,
  PhotoQcRestampMode,
  PhotoQcSection,
  PhotoQcSlotView,
} from '../types';
import { KIND_LABEL, LEVEL_OPTIONS, SECTION_LABEL, levelOptionLabel } from '../types';
import { cropAvoidingLegacyStamp, isStandardRatio, rotatedSize } from '../utils/photoQcGeometry';
import { PhotoQcCropEditor } from './PhotoQcCropEditor';
import { PhotoQcLightbox } from './PhotoQcLightbox';
import { RotatedPhoto } from './RotatedPhoto';

interface PhotoQcReviewScreenProps {
  reportId: string;
  onClose: () => void;
  /** Báo màn tổng quan cập nhật hàng của hồ sơ. */
  onChanged: (reportId: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  positionLabel?: string;
}

const FLAG_DEBOUNCE_MS = 1000;
const TABS: PhotoQcSection[] = ['P', 'DEFECT', 'OVERVIEW', 'DOCUMENT'];

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

function suggestLevel(photos: PhotoQcSlotView[]): PhotoQcEffectiveLevel {
  const open = photos.filter((p) => p.qc?.recapture && p.qc.status !== 'RESOLVED');
  if (open.length === 0) return 'NONE';
  return open.some((p) => p.photoGroup === 'INDOOR') ? 'FULL' : 'OUTDOOR_ONLY';
}

/**
 * Màn rà soát một hồ sơ, full màn hình. Hiện MỌI ảnh khảo sát (kể cả ảnh report hiện chưa in):
 * gắn cờ chụp lại cho mọi ảnh; crop cho mọi ảnh trừ tài liệu scan (crop ảnh chưa in sẽ áp khi report in ảnh đó).
 */
export const PhotoQcReviewScreen: React.FC<PhotoQcReviewScreenProps> = ({ reportId, onClose, onChanged, onPrev, onNext, positionLabel }) => {
  const [detail, setDetail] = useState<PhotoQcDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<PhotoQcSection>('P');
  const [editing, setEditing] = useState<PhotoQcSlotView | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const sizesRef = useRef<Map<string, NaturalSize>>(new Map());
  const [, forceSizeTick] = useState(0);
  const pendingFlags = useRef<Map<string, { reportId: string; item: PhotoQcPhotoUpdate }>>(new Map());
  const flagTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const d = await fetchPhotoQcDetail(reportId);
      setDetail(d);
      sizesRef.current = new Map();
      const firstTab = TABS.find((t) => d.photos.some((p) => p.section === t)) ?? 'P';
      setTab(firstTab);
    } catch (err: unknown) {
      console.error('[PhotoQc:ReviewScreen.load] Không tải được ảnh hồ sơ', err);
      setError(getErrorMessage(err, 'Không tải được ảnh hồ sơ'));
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    setDetail(null);
    setLightbox(null);
    setEditing(null);
    void load();
  }, [load]);

  /** Gửi các cờ đang chờ, gộp theo hồ sơ (cờ vẫn được lưu nếu người dùng chuyển hồ sơ trước 1 giây). */
  const flushFlags = useCallback(async () => {
    flagTimer.current = null;
    const entries = [...pendingFlags.current.values()];
    pendingFlags.current.clear();
    const byReport = new Map<string, PhotoQcPhotoUpdate[]>();
    for (const e of entries) byReport.set(e.reportId, [...(byReport.get(e.reportId) ?? []), e.item]);
    for (const [rid, items] of byReport) {
      try {
        const rows = await savePhotoQcPhotos(rid, items);
        setDetail((d) => (d && d.reportId === rid ? mergeRows(d, rows) : d));
        onChanged(rid);
      } catch (err: unknown) {
        console.error('[PhotoQc:ReviewScreen.flushFlags] Không lưu được cờ chụp lại', err);
        setError(getErrorMessage(err, 'Không lưu được cờ chụp lại'));
      }
    }
  }, [onChanged]);

  useEffect(
    () => () => {
      if (flagTimer.current !== null) {
        window.clearTimeout(flagTimer.current);
        void flushFlags();
      }
    },
    [flushFlags]
  );

  const toggleFlag = useCallback(
    (slot: PhotoQcSlotView) => {
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
      pendingFlags.current.set(`${reportId}|${slot.photoKey}`, { reportId, item: { photoKey: slot.photoKey, photoUrl: slot.url, recapture: next } });
      if (flagTimer.current !== null) window.clearTimeout(flagTimer.current);
      flagTimer.current = window.setTimeout(() => void flushFlags(), FLAG_DEBOUNCE_MS);
    },
    [reportId, flushFlags]
  );

  const saveReport = async (body: PhotoQcReportUpdate) => {
    setSaving(true);
    setError(null);
    try {
      const qc: PhotoQcReportRow = await savePhotoQcReport(reportId, body);
      setDetail((d) => (d ? { ...d, qc } : d));
      onChanged(reportId);
    } catch (err: unknown) {
      console.error('[PhotoQc:ReviewScreen.saveReport] Không lưu được thông tin hồ sơ', err);
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
      console.error('[PhotoQc:ReviewScreen.saveCrop] Không lưu được khung crop', err);
      setError(getErrorMessage(err, 'Không lưu được khung crop'));
    } finally {
      setSaving(false);
    }
  };

  const legacyPhotos = useMemo(() => (detail?.photos ?? []).filter((p) => p.legacyWatermarked && p.section !== 'DOCUMENT'), [detail]);

  /** Mọi ảnh có dấu cũ: crop bỏ vùng dấu cũ rồi dập lại cả logo và chữ. */
  const bulkRestamp = async () => {
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
      setNotice('Chưa tải xong ảnh nào có dấu cũ, hãy mở các tab rồi thử lại.');
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
      console.error('[PhotoQc:ReviewScreen.bulkRestamp] Không lưu được thao tác hàng loạt', err);
      setError(getErrorMessage(err, 'Không lưu được thao tác hàng loạt'));
    } finally {
      setSaving(false);
    }
  };

  const photos = (detail?.photos ?? []).filter((p) => p.section === tab);
  const level: PhotoQcRecaptureLevel = detail?.qc?.recaptureLevel ?? 'AUTO';
  const suggested = detail ? suggestLevel(detail.photos) : 'NONE';
  const coverOn = detail?.qc?.coverSource === 'P04';
  const coverDisabledReason = !detail
    ? ''
    : !detail.coverEligible
      ? 'Hồ sơ căn hộ giữ bìa cũ (P-04 căn hộ là cửa & hành lang)'
      : !detail.hasP04
        ? 'Hồ sơ không có ảnh P-04 hợp lệ'
        : '';

  // Portal ra body: lớp cha có transform (animate-in) làm position: fixed bám sai khung.
  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-slate-200 bg-white">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1 cursor-pointer" title="Quay lại danh sách">
          <ArrowLeft className="w-4 h-4" /> Danh sách
        </button>
        <button type="button" onClick={onPrev} disabled={!onPrev} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="Hồ sơ trước">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={onNext} disabled={!onNext} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="Hồ sơ sau">
          <ChevronRight className="w-4 h-4" />
        </button>
        {positionLabel && <span className="text-[11px] text-slate-500">{positionLabel}</span>}
        {detail && (
          <>
            <span className="px-2 py-0.5 rounded-md border text-xs bg-teal-950 text-teal-300 border-teal-700 font-mono font-bold">{detail.reportCode}</span>
            <span className="px-2 py-0.5 rounded-md border text-xs bg-slate-800 text-slate-300 border-slate-600">{KIND_LABEL[detail.kind]}</span>
            <span className="text-xs text-slate-500">{detail.status}</span>
          </>
        )}

        {detail && (
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <label className={`flex items-center gap-2 text-xs font-bold ${coverDisabledReason ? 'text-slate-400' : 'text-slate-700'}`} title={coverDisabledReason}>
              <input
                type="checkbox"
                checked={coverOn}
                disabled={Boolean(coverDisabledReason) || saving}
                onChange={(e) => void saveReport({ coverSource: e.target.checked ? 'P04' : null })}
                className="w-4 h-4 accent-teal-600 cursor-pointer disabled:cursor-not-allowed"
              />
              Bìa P-04
            </label>
            <select
              value={level}
              disabled={saving}
              onChange={(e) => void saveReport({ recaptureLevel: e.target.value as PhotoQcRecaptureLevel })}
              className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs cursor-pointer"
              title="Mức thu thập lại"
            >
              {LEVEL_OPTIONS.map((l) => (
                <option key={l} value={l}>{levelOptionLabel(l, suggested)}</option>
              ))}
            </select>
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
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Áp cho mọi ảnh có watermark cũ của hồ sơ"
              >
                <Stamp className="w-4 h-4" /> Crop bỏ dấu cũ và dập lại ({legacyPhotos.length})
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Đang tải mọi ảnh của hồ sơ…
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 flex items-center justify-between gap-2">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="cursor-pointer text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {notice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 flex items-center justify-between gap-2">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="cursor-pointer text-emerald-600 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {detail && !loading && (
          <>
            {detail.appliesFromNextRevision && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Hồ sơ đã duyệt: bản đã phát hành giữ nguyên. Thay đổi bìa, crop hay dập bù chỉ in từ lần phát hành Rev kế tiếp.
              </div>
            )}

            <div className="flex gap-1 border-b border-slate-200">
              {TABS.map((key) => {
                const count = detail.photos.filter((p) => p.section === key).length;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`px-4 py-2 text-xs font-bold border-b-2 -mb-px cursor-pointer ${tab === key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    {SECTION_LABEL[key]} ({count})
                  </button>
                );
              })}
            </div>

            {photos.length === 0 && <p className="text-xs text-slate-500 py-8 text-center">Không có ảnh trong mục này.</p>}

            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))' }}>
              {photos.map((p, idx) => {
                const size = sizesRef.current.get(p.photoKey);
                const validCrop = p.qc?.crop && !p.qcStale ? p.qc.crop : null;
                const printedSize = size ? rotatedSize(size, p.rotation) : null;
                const badRatio = printedSize && !validCrop && p.section !== 'DOCUMENT' ? !isStandardRatio(printedSize) : false;
                const flagged = Boolean(p.qc?.recapture && p.qc.status !== 'RESOLVED');
                const isCover = (coverOn && p.photoKey === 'P-04') || (!coverOn && p.photoKey === 'P-02');
                const canCrop = p.section !== 'DOCUMENT';
                return (
                  <div key={p.photoKey} className={`rounded-xl border p-2 space-y-2 bg-white ${flagged ? 'border-rose-300' : 'border-slate-200'}`}>
                    <RotatedPhoto
                      url={p.url}
                      rotation={p.rotation}
                      boxWidth={272}
                      boxHeight={210}
                      crop={validCrop}
                      useThumb
                      onClick={() => setLightbox(idx)}
                      title="Bấm để xem ảnh lớn"
                      onSize={(s) => {
                        if (!sizesRef.current.has(p.photoKey)) {
                          sizesRef.current.set(p.photoKey, s);
                          forceSizeTick((n) => n + 1);
                        }
                      }}
                      className="w-full"
                    >
                      <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1 pointer-events-none">
                        {isCover && p.section === 'P' && <span className="px-1.5 py-0.5 rounded bg-teal-600 text-white text-[10px] font-bold">Bìa</span>}
                        {validCrop && <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">Crop {validCrop.ratio}</span>}
                        {badRatio && <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold">⚠ Sai tỉ lệ</span>}
                        {p.legacyWatermarked && <span className="px-1.5 py-0.5 rounded bg-slate-700 text-white text-[10px] font-bold">Dấu cũ</span>}
                        {!p.printed && <span className="px-1.5 py-0.5 rounded bg-violet-600 text-white text-[10px] font-bold">Chưa in trong report</span>}
                      </div>
                      <Maximize2 className="absolute bottom-1.5 right-1.5 w-4 h-4 text-white drop-shadow pointer-events-none" />
                    </RotatedPhoto>
                    <p className="text-[11px] font-semibold text-slate-700 line-clamp-2" title={p.label}>{p.label}</p>
                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                      <span className={`px-1.5 py-0.5 rounded border ${p.photoGroup === 'OUTDOOR' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                        {p.photoGroup === 'OUTDOOR' ? 'Bên ngoài' : 'Bên trong'}
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
                      {canCrop && (
                        <button
                          type="button"
                          onClick={() => setEditing(p)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-white text-slate-600 border-slate-200 hover:bg-teal-50 flex items-center gap-1 cursor-pointer"
                        >
                          <Crop className="w-3.5 h-3.5" /> {validCrop ? 'Sửa crop' : 'Crop'}
                        </button>
                      )}
                      {canCrop && p.qc?.crop && (
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
          </>
        )}
      </div>

      {lightbox !== null && (
        <PhotoQcLightbox
          photos={photos}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          onToggleFlag={toggleFlag}
          onCrop={(slot) => {
            setLightbox(null);
            setEditing(slot);
          }}
        />
      )}

      {editing && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-4 space-y-3 max-h-[94vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-teal-600" /> Crop {editing.label}
              </h4>
              <button type="button" onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            {!editing.printed && (
              <p className="text-[11px] text-violet-700">Report hiện chưa in ảnh này. Khung crop được lưu và sẽ áp khi report in ảnh.</p>
            )}
            <PhotoQcCropEditor
              slot={editing}
              saving={saving}
              onCancel={() => setEditing(null)}
              onSave={(crop, restampMode) => void saveCrop(editing, crop, restampMode)}
            />
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
