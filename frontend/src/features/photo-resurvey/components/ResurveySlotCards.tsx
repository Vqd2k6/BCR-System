import React, { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Ban, Camera, Clock, Loader2, MapPin, Plus, RotateCw, Undo2 } from 'lucide-react';
import { ImageAnnotationModal } from '../../../components/common/ImageAnnotationModal';
import { dataUrlToBlob, prepareCapturedPhoto } from '../utils/capturePhoto';
import { ResurveyPhoto } from './ResurveyPhoto';
import type { CapturedPhoto, ResurveyExtraTimePreview, ResurveyItemRow, ResurveySlotCode, ResurveySlotView } from '../types';
import { NA_FORBIDDEN, NA_REASON_MIN, SLOT_TITLE } from '../types';

const formatTime1 = (iso: string | null): string => (iso ? new Date(iso).toLocaleString('vi-VN') : '---');

// ---------------------------------------------------------------------------
// Nút chụp: mở camera sau, nén trên máy; P-04 mở công cụ vẽ mũi tên trước khi tải
// ---------------------------------------------------------------------------

interface CaptureButtonProps {
  label: string;
  disabled: boolean;
  /** P-04: kéo mũi tên chỉ đúng ngôi nhà (vẽ thẳng vào ảnh như form khảo sát gốc). */
  annotateArrow?: boolean;
  variant?: 'primary' | 'outline';
  onCaptured: (photo: CapturedPhoto) => Promise<boolean>;
}

export const CaptureButton: React.FC<CaptureButtonProps> = ({ label, disabled, annotateArrow, variant = 'primary', onCaptured }) => {
  const inputId = `resurvey_cam_${useId().replace(/:/g, '_')}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [annotating, setAnnotating] = useState<{ dataUrl: string; capturedAt: Date } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const finish = async (source: File | Blob, capturedAt?: Date) => {
    const photo = await prepareCapturedPhoto(source, capturedAt);
    await onCaptured(photo);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLocalError(null);
    setProcessing(true);
    const capturedAt = file.lastModified ? new Date(file.lastModified) : new Date();
    try {
      if (annotateArrow) {
        const prepared = await prepareCapturedPhoto(file, capturedAt);
        setAnnotating({ dataUrl: prepared.base64, capturedAt });
      } else {
        await finish(file, capturedAt);
      }
    } catch (err: unknown) {
      console.error('[PhotoResurvey:capture] Không xử lý được ảnh vừa chụp', err);
      setLocalError('Không xử lý được ảnh, vui lòng chụp lại');
    } finally {
      setProcessing(false);
    }
  };

  const base =
    variant === 'primary'
      ? 'bg-sky-600 text-white hover:bg-sky-700 border-sky-600'
      : 'bg-white text-sky-700 hover:bg-sky-50 border-sky-300';

  return (
    <div className="space-y-1">
      <input ref={inputRef} id={inputId} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <button
        type="button"
        disabled={disabled || processing}
        onClick={() => inputRef.current?.click()}
        className={`w-full px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${base}`}
      >
        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        {processing ? 'Đang nén ảnh…' : label}
      </button>
      {localError && <div className="text-[11px] text-rose-600">{localError}</div>}
      {annotating && createPortal(
        // Màn khảo sát bổ sung nằm ở z-[2000]: đưa modal vẽ ra body, phủ trên cả thanh nộp.
        <div className="relative z-[3000]">
        <ImageAnnotationModal
          isOpen
          imageUrl={annotating.dataUrl}
          title="Đánh dấu mũi tên chỉ rõ vị trí ngôi nhà khảo sát trên ảnh P-04"
          initialTool="ARROW"
          onClose={() => setAnnotating(null)}
          onSave={(annotated) => {
            const capturedAt = annotating.capturedAt;
            setAnnotating(null);
            setProcessing(true);
            void (async () => {
              try {
                await finish(await dataUrlToBlob(annotated), capturedAt);
              } catch (err: unknown) {
                console.error('[PhotoResurvey:annotate] Không lưu được ảnh đã vẽ mũi tên', err);
                setLocalError('Không lưu được ảnh đã vẽ, vui lòng thử lại');
              } finally {
                setProcessing(false);
              }
            })();
          }}
        />
        </div>,
        document.body
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Thông tin ảnh mới: Time 1 (chụp thật) + Time 2 (in watermark) + khoảng cách
// ---------------------------------------------------------------------------

const NewPhotoMeta: React.FC<{ item: ResurveyItemRow; time2Text: string | null; time2Hint?: string }> = ({ item, time2Text, time2Hint }) => (
  <div className="text-[11px] space-y-0.5 text-slate-600">
    <div className="flex items-center gap-1">
      <Camera className="w-3 h-3 text-slate-400" /> Time 1 (chụp thật): <strong>{formatTime1(item.capturedAtClient ?? item.receivedAt)}</strong>
    </div>
    <div className="flex items-center gap-1">
      <Clock className="w-3 h-3 text-teal-600" /> Time 2 (in watermark): <strong className="text-teal-700">{time2Text || '---'}</strong>
      {time2Hint && <span className="text-slate-400">({time2Hint})</span>}
    </div>
    {item.distanceToParcelM !== null && (
      <div className={`flex items-center gap-1 ${item.distanceToParcelM > 100 ? 'text-amber-700 font-bold' : ''}`}>
        <MapPin className="w-3 h-3" /> Cách thửa {Math.round(item.distanceToParcelM)} m{item.distanceToParcelM > 100 ? ' – kiểm tra lại vị trí chụp' : ''}
      </div>
    )}
  </div>
);

interface ItemToolsProps {
  item: ResurveyItemRow;
  busy: boolean;
  onRotate: (itemId: string, rotation: number) => Promise<boolean>;
  onRemove: (itemId: string) => Promise<boolean>;
  removeLabel: string;
}

const ItemTools: React.FC<ItemToolsProps> = ({ item, busy, onRotate, onRemove, removeLabel }) => (
  <div className="flex gap-1.5">
    {item.action !== 'MARK_NA' && (
      <button
        type="button"
        disabled={busy}
        onClick={() => void onRotate(item.id, (item.rotation + 90) % 360)}
        className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RotateCw className="w-3.5 h-3.5" /> Xoay 90°
      </button>
    )}
    <button
      type="button"
      disabled={busy}
      onClick={() => void onRemove(item.id)}
      className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Undo2 className="w-3.5 h-3.5" /> {removeLabel}
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// Ô ảnh gốc: ảnh cũ + cờ "PHẢI CHỤP LẠI" + ảnh mới / N/A
// ---------------------------------------------------------------------------

interface SlotCardProps {
  slot: ResurveySlotView;
  item: ResurveyItemRow | null;
  canEdit: boolean;
  /** Đang có thao tác ghi bất kỳ → khoá mọi nút. */
  locked: boolean;
  busyHere: boolean;
  onReplace: (photoKey: string, photo: CapturedPhoto) => Promise<boolean>;
  onNa: (photoKey: string, reason: string) => Promise<boolean>;
  onRemove: (itemId: string) => Promise<boolean>;
  onRotate: (itemId: string, rotation: number) => Promise<boolean>;
}

export const ResurveySlotCard: React.FC<SlotCardProps> = ({ slot, item, canEdit, locked, busyHere, onReplace, onNa, onRemove, onRotate }) => {
  const [naOpen, setNaOpen] = useState(false);
  const [naReason, setNaReason] = useState('');
  const naAllowed = !NA_FORBIDDEN.includes(slot.slotCode);
  const editable = canEdit && slot.flagged;

  return (
    <div className={`rounded-2xl border p-3 space-y-2.5 ${slot.flagged ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-slate-800">{slot.label}</span>
        {slot.flagged && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-950 text-rose-300 border border-rose-700">
            <AlertTriangle className="w-3 h-3" /> PHẢI CHỤP LẠI
          </span>
        )}
        {busyHere && <Loader2 className="w-4 h-4 animate-spin text-sky-600 ml-auto" />}
      </div>

      <div className={`grid gap-2 ${item && item.action !== 'MARK_NA' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className="space-y-1">
          <ResurveyPhoto url={slot.url} rotation={slot.rotation} alt={`Ảnh gốc ${slot.label}`} tone={slot.flagged ? 'flag' : 'neutral'} />
          <div className="text-[11px] text-slate-500">
            Ảnh gốc • giờ in: <strong className="text-slate-700">{slot.dateTimeText || '---'}</strong>
          </div>
        </div>
        {item && item.action === 'REPLACE' && item.newUrl && (
          <div className="space-y-1">
            <ResurveyPhoto url={item.newUrl} rotation={item.rotation} alt={`Ảnh chụp lại ${slot.label}`} tone="new" />
            <NewPhotoMeta item={item} time2Text={item.time2Text} time2Hint="giờ ảnh gốc" />
          </div>
        )}
      </div>

      {item && item.action === 'MARK_NA' && (
        <div className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700">
          <span className="inline-flex items-center gap-1 font-bold text-slate-800">
            <Ban className="w-3.5 h-3.5" /> N/A – không áp dụng
          </span>
          <div className="mt-0.5">Lý do: {item.naReason}</div>
        </div>
      )}

      {editable && item && <ItemTools item={item} busy={locked} onRotate={onRotate} onRemove={onRemove} removeLabel={item.action === 'MARK_NA' ? 'Bỏ N/A' : 'Bỏ ảnh mới'} />}

      {editable && (
        <div className="space-y-2">
          <CaptureButton
            label={item?.action === 'REPLACE' ? 'Chụp lại lần nữa' : 'Chụp lại ảnh này'}
            variant={item?.action === 'REPLACE' ? 'outline' : 'primary'}
            disabled={locked}
            annotateArrow={slot.slotCode === 'P-04'}
            onCaptured={(photo) => onReplace(slot.photoKey, photo)}
          />
          {naAllowed && item?.action !== 'MARK_NA' && (
            naOpen ? (
              <div className="space-y-1.5">
                <textarea
                  value={naReason}
                  onChange={(e) => setNaReason(e.target.value)}
                  rows={2}
                  placeholder="Lý do không áp dụng (VD: nhà không có biển số, mặt bên sát vách...)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNaOpen(false)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Huỷ
                  </button>
                  <button
                    type="button"
                    disabled={locked || naReason.trim().length < NA_REASON_MIN}
                    onClick={() =>
                      void onNa(slot.photoKey, naReason.trim()).then((ok) => {
                        if (ok) {
                          setNaOpen(false);
                          setNaReason('');
                        }
                      })
                    }
                    className="flex-1 px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-[11px] font-bold text-white hover:bg-slate-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Xác nhận N/A
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={locked}
                onClick={() => setNaOpen(true)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Ban className="w-3.5 h-3.5" /> N/A (Không áp dụng)
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Ảnh phát sinh (chụp thêm) của một mục
// ---------------------------------------------------------------------------

interface ExtraSectionProps {
  slotCode: ResurveySlotCode;
  items: ResurveyItemRow[];
  previews: Map<string, ResurveyExtraTimePreview>;
  canEdit: boolean;
  locked: boolean;
  busyHere: boolean;
  onAdd: (slotCode: ResurveySlotCode, photo: CapturedPhoto) => Promise<boolean>;
  onRemove: (itemId: string) => Promise<boolean>;
  onRotate: (itemId: string, rotation: number) => Promise<boolean>;
}

export const ResurveyExtraSection: React.FC<ExtraSectionProps> = ({ slotCode, items, previews, canEdit, locked, busyHere, onAdd, onRemove, onRotate }) => {
  if (!canEdit && items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-dashed border-sky-300 bg-sky-50/40 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Plus className="w-4 h-4 text-sky-600" />
        <span className="text-xs font-bold text-slate-800">Ảnh chụp thêm – {SLOT_TITLE[slotCode]}</span>
        {busyHere && <Loader2 className="w-4 h-4 animate-spin text-sky-600 ml-auto" />}
      </div>
      <p className="text-[11px] text-slate-500">
        Giờ in watermark của ảnh chụp thêm được xếp tự động ngay sau ảnh cuối của mục (cách nhau tối đa 2 phút), không vượt ảnh kế tiếp trong hồ sơ.
      </p>
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {items.map((it) => {
            const preview = previews.get(it.id);
            return (
              <div key={it.id} className="space-y-1">
                {it.newUrl && <ResurveyPhoto url={it.newUrl} rotation={it.rotation} alt={`Ảnh chụp thêm ${slotCode}`} tone="new" height={120} />}
                <NewPhotoMeta item={it} time2Text={it.time2Text ?? preview?.time2Text ?? null} time2Hint={it.time2Text ? undefined : 'dự kiến'} />
                {canEdit && <ItemTools item={it} busy={locked} onRotate={onRotate} onRemove={onRemove} removeLabel="Bỏ ảnh" />}
              </div>
            );
          })}
        </div>
      )}
      {canEdit && (
        <CaptureButton label="Chụp thêm (+)" variant="outline" disabled={locked} onCaptured={(photo) => onAdd(slotCode, photo)} />
      )}
    </div>
  );
};
