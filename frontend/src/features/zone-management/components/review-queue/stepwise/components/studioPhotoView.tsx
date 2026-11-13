/**
 * Hiển thị ảnh Studio giống bản in: ảnh chụp lại đã Đưa vào (thay ảnh / bỏ ô N/A / ảnh thêm) và crop đã duyệt.
 * Dùng chung cho AuditPhotoCard (Bước 3/5, căn hộ) và Bước 1 (P-01→P-04) để mọi nơi cùng một luật.
 * Chỉ đọc lớp phủ, không ghi gì vào dữ liệu Studio (ảnh gốc vẫn nằm nguyên trong hồ sơ).
 */
import React, { useContext } from 'react';
import { Ban, Eye } from 'lucide-react';
import {
  ApprovedCropContext,
  useStudioPhotoStatus,
  type ApprovedCropMap,
  type ApprovedCropRect,
  type StudioPhotoStatus,
  type StudioResurveyExtraCard,
  type StudioResurveyPhotoMark,
} from '../context/ApprovedCropContext';
import { RotatableImageFrame } from './RotatableImageFrame';

export type StudioPhotoMode = 'NA_REMOVED' | 'REPLACED' | 'CROPPED' | 'ORIGINAL';

export interface StudioPhotoView {
  /** URL đang in ở ô (ảnh gốc, hoặc ảnh mới chụp lại nếu đã Đưa vào). */
  printedUrl: string | null;
  mode: StudioPhotoMode;
  resurveyMark: StudioResurveyPhotoMark | null;
  approvedCrop: ApprovedCropRect | null;
  /** photoKey của ô có crop chờ duyệt / quá hạn (null nếu không có hoặc ảnh không còn in). */
  pendingCropKey: string | null;
  isRecentlyUpdated: boolean;
}

const normDeg = (d: number): number => (((d ?? 0) % 360) + 360) % 360;

export function useStudioPhotoView(url: string | undefined, rotation: number): StudioPhotoView {
  const approvedCrops = useContext(ApprovedCropContext);
  const photoStatus = useStudioPhotoStatus();
  return resolveStudioPhotoView(url, rotation, approvedCrops, photoStatus);
}

/** Bản không dùng hook, để gọi trong vòng lặp (Bước 1 dựng nhiều ô ảnh trong một map). */
export function resolveStudioPhotoView(
  url: string | undefined,
  rotation: number,
  approvedCrops: ApprovedCropMap,
  photoStatus: StudioPhotoStatus
): StudioPhotoView {
  const approvedCrop = url ? approvedCrops.get(url) ?? null : null;
  const resurveyMark = url ? photoStatus.resurvey.get(url) ?? null : null;
  const applied = resurveyMark?.state === 'APPLIED';
  // Ô N/A đã Đưa vào: report bỏ ô này, Studio hiện ô N/A (ảnh gốc xem qua nút riêng).
  const removed = applied && resurveyMark?.action === 'MARK_NA';
  // Ảnh thay thế đã Đưa vào: report in ảnh mới ở ô này.
  const replaced = applied && resurveyMark?.action === 'REPLACE' && Boolean(resurveyMark?.newUrl);
  const printsOriginal = !removed && !replaced;
  // Chỉ hiện ảnh crop khi góc xoay hiện tại còn khớp lúc crop; lệch thì report in ảnh nguyên.
  const cropped = printsOriginal && Boolean(approvedCrop) && normDeg(approvedCrop?.rotationAtCrop ?? 0) === normDeg(rotation);
  return {
    printedUrl: removed ? null : replaced ? resurveyMark?.newUrl ?? null : url ?? null,
    mode: removed ? 'NA_REMOVED' : replaced ? 'REPLACED' : cropped ? 'CROPPED' : 'ORIGINAL',
    resurveyMark,
    approvedCrop: cropped ? approvedCrop : null,
    pendingCropKey: url && printsOriginal ? photoStatus.pendingCrops.get(url) ?? null : null,
    isRecentlyUpdated: Boolean(url && photoStatus.recent.has(url)),
  };
}

const RESURVEY_BADGE: Record<StudioResurveyPhotoMark['state'], { label: string; cls: string }> = {
  NEED: { label: 'Cần chụp lại', cls: 'bg-rose-950 text-rose-300 border-rose-700' },
  CAPTURED: { label: 'KSV đã chụp lại', cls: 'bg-sky-950 text-sky-300 border-sky-700' },
  SUBMITTED: { label: 'Ảnh mới chờ duyệt phiên', cls: 'bg-sky-950 text-sky-300 border-sky-700' },
  READY: { label: 'Có ảnh mới – chờ đưa vào', cls: 'bg-amber-950 text-amber-300 border-amber-700' },
  APPLIED: { label: 'Ảnh mới chụp lại', cls: 'bg-emerald-950 text-emerald-300 border-emerald-700' },
  DECLINED: { label: 'Đã bỏ qua ảnh mới', cls: 'bg-slate-800 text-slate-300 border-slate-600' },
};

function resurveyBadge(mark: StudioResurveyPhotoMark): { label: string; cls: string } {
  if (mark.state === 'APPLIED' && mark.action === 'MARK_NA') return { label: 'Đã bỏ khỏi report (N/A)', cls: 'bg-slate-800 text-slate-300 border-slate-600' };
  if (mark.state === 'READY' && mark.action === 'MARK_NA') return { label: 'KSV đề xuất N/A – chờ đưa vào', cls: 'bg-amber-950 text-amber-300 border-amber-700' };
  return RESURVEY_BADGE[mark.state];
}

/** Badge Đã crop / Crop chờ duyệt / trạng thái ảnh chụp lại, đặt ở góc dưới trái thẻ ảnh. */
export const StudioPhotoBadges: React.FC<{ view: StudioPhotoView; className?: string }> = ({ view, className = '' }) => {
  const photoStatus = useStudioPhotoStatus();
  const { mode, pendingCropKey, resurveyMark, printedUrl } = view;
  const suspectUrl = printedUrl && photoStatus.legacySuspects.has(printedUrl) ? printedUrl : null;
  if (mode !== 'CROPPED' && !pendingCropKey && !resurveyMark && !suspectUrl) return null;
  return (
    <div className={`absolute bottom-1.5 left-1.5 z-10 flex flex-wrap items-center gap-1 max-w-[calc(100%-12px)] ${className}`}>
      {suspectUrl && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            photoStatus.confirmLegacy?.(suspectUrl);
          }}
          className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-rose-950 text-rose-300 border-rose-700 cursor-pointer hover:brightness-125 animate-pulse"
          title={`Bộ dò logo không chắc ảnh này đã có dấu cũ (điểm ${photoStatus.legacySuspects.get(suspectUrl)?.toFixed(2) ?? '—'}). Report chặn xuất tới khi xác nhận. Bấm để xác nhận.`}
        >
          Cần xác nhận dấu cũ
        </button>
      )}
      {mode === 'CROPPED' && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-emerald-950 text-emerald-300 border-emerald-700 pointer-events-none">
          Đã crop
        </span>
      )}
      {pendingCropKey && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            photoStatus.openCropReview?.(pendingCropKey);
          }}
          className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-amber-950 text-amber-300 border-amber-700 cursor-pointer hover:brightness-125"
          title="Crop của ảnh này chưa được duyệt: report chưa in phần crop. Bấm để duyệt."
        >
          Crop chờ duyệt
        </button>
      )}
      {resurveyMark?.state === 'READY' && photoStatus.openResurveyPanel ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            photoStatus.openResurveyPanel?.();
          }}
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer hover:brightness-125 animate-pulse ${resurveyBadge(resurveyMark).cls}`}
          title="Có kết quả KSV chụp lại đã duyệt. Bấm để so sánh và Đưa vào thẩm định."
        >
          {resurveyMark.action === 'MARK_NA' ? 'KSV đề xuất N/A – bấm để xem' : 'Có ảnh mới – bấm để đưa vào'}
        </button>
      ) : (
        resurveyMark && (
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border pointer-events-none ${resurveyBadge(resurveyMark).cls}`}
            title="Trạng thái ảnh KSV chụp lại (xem ở nút Ảnh Chụp Lại trên header)"
          >
            {resurveyBadge(resurveyMark).label}
          </span>
        )
      )}
    </div>
  );
};

/** Ô N/A thay cho ảnh gốc khi Thẩm định đã Đưa vào kết quả N/A của KSV (report không in ô này). */
export const ResurveyNaPlaceholder: React.FC<{ reason: string | null; onViewOriginal?: () => void }> = ({ reason, onViewOriginal }) => (
  <div className="w-full h-full p-3 text-center flex flex-col items-center justify-center gap-1.5 bg-slate-50 border border-dashed border-slate-300 rounded-lg">
    <Ban className="w-5 h-5 text-slate-400" />
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700 border border-slate-300">
      N/A – Đã bỏ khỏi report (khảo sát lại)
    </span>
    <p className="text-[11px] text-slate-700 font-medium line-clamp-2 px-2">
      {reason ? `Lý do KSV: ${reason}` : 'KSV đánh dấu không áp dụng'}
    </p>
    {onViewOriginal && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onViewOriginal();
        }}
        className="mt-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
        title="Ảnh gốc vẫn được lưu trong hồ sơ, chỉ không in vào report"
      >
        <Eye className="w-3 h-3" />
        <span>Xem ảnh gốc</span>
      </button>
    )}
  </div>
);

/**
 * Thẻ chỉ đọc cho ảnh phát sinh thêm của phiên chụp lại (ADD_EXTRA) thuộc các mục `slotCodes`.
 * APPLIED: report in thêm ảnh này. READY: chờ Thẩm định Đưa vào (bấm để mở panel).
 */
export const ResurveyExtraCards: React.FC<{
  slotCodes: readonly string[];
  cardClassName?: string;
  onOpenPhotoZoom?: (url: string, title?: string, photoCode?: string, rotation?: number) => void;
}> = ({ slotCodes, cardClassName = '', onOpenPhotoZoom }) => {
  const photoStatus = useStudioPhotoStatus();
  const extras = photoStatus.extras.filter((x) => slotCodes.includes(x.slotCode));
  if (extras.length === 0) return null;
  return (
    <>
      {extras.map((x: StudioResurveyExtraCard) => {
        const applied = x.state === 'APPLIED';
        const title = `${x.slotCode} – Ảnh phát sinh thêm (khảo sát lại)`;
        return (
          <div
            key={x.key}
            onClick={() => onOpenPhotoZoom?.(x.newUrl, title, x.slotCode, x.newRotation)}
            className={`group relative rounded-xl bg-white overflow-hidden cursor-pointer shadow-2xs hover:shadow-md transition-all flex flex-col border-2 ${
              applied ? 'border-emerald-500' : 'border-dashed border-amber-400'
            } ${cardClassName}`}
          >
            <div className="relative w-full overflow-hidden bg-slate-950 flex items-center justify-center shrink-0 p-1 h-56 sm:h-60">
              <RotatableImageFrame
                src={x.newUrl}
                alt={title}
                rotation={x.newRotation}
                maxHeightPx={240}
                wrapperClassName="w-full h-full"
                stageClassName="max-h-full rounded-sm shadow-xs"
              />
              <span className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded font-mono font-black text-[10px] bg-teal-950 text-teal-300 border border-teal-700 pointer-events-none">
                {x.slotCode} +
              </span>
              <div className="absolute bottom-1.5 left-1.5 z-10">
                {applied ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-emerald-950 text-emerald-300 border-emerald-700 pointer-events-none">
                    Ảnh thêm – đã đưa vào report
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      photoStatus.openResurveyPanel?.();
                    }}
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-amber-950 text-amber-300 border-amber-700 cursor-pointer hover:brightness-125 animate-pulse"
                    title="Ảnh KSV chụp thêm đã duyệt phiên nhưng chưa vào report. Bấm để Đưa vào hoặc Bỏ qua."
                  >
                    Ảnh thêm – bấm để đưa vào
                  </button>
                )}
              </div>
            </div>
            <div className="px-3 py-2 flex flex-col gap-0.5">
              <span className="text-xs font-bold text-slate-800 truncate">{title}</span>
              <span className="text-[10px] text-slate-500">
                Giờ in report: {x.printTimeText ? x.printTimeText : '---'}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
};
