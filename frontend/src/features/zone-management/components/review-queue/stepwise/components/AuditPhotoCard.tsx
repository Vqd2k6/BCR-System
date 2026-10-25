import React from 'react';
import {
  Maximize2,
  Trash2,
  Camera,
  Plus,
  Undo2,
  Edit3,
  History,
  RotateCw,
  RotateCcw,
  AlertTriangle,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import type { AuditPhotoActionParams, AuditPhotoHistoryParams } from '../types';
import { RotatableImageFrame } from './RotatableImageFrame';

export interface AuditPhotoCardProps {
  url?: string;
  photoCode?: string;
  title: string;
  category: string;
  targetPhotoType: string;
  targetPhotoId?: string;
  defectId?: string;
  defectCode?: string;
  hasMultiplePhotos?: boolean;
  floorCode?: string;
  zoneCode?: string;
  photoIndex?: number;
  isEditMode?: boolean;
  isNotApplicable?: boolean;
  naReason?: string;
  aspectRatio?: 'aspect-4/3' | 'aspect-video' | 'aspect-square' | 'h-16' | 'h-20' | 'h-24' | 'h-36' | 'h-48' | 'h-64' | 'h-80' | 'h-96';
  maxHeightPx?: number;
  badgeColor?: 'sky' | 'emerald' | 'amber' | 'rose' | 'slate' | 'indigo';
  extraBadges?: React.ReactNode;
  optimisticStatus?: 'REPLACED' | 'ADDED' | 'DELETED';
  historyCount?: number;
  hasHistory?: boolean;
  rotation?: number;
  isAutoRotated?: boolean;
  isOrientationMismatch?: boolean;
  isStrictOrientation?: boolean;
  orientationRecommendation?: string;
  expectedOrientation?: 'PORTRAIT' | 'LANDSCAPE' | 'ANY';
  onRotate?: (newRotation: number) => void;
  domId?: string;
  photoKey?: string;
  onUndoDelete?: () => void;
  onOpenPhotoZoom?: (url: string, title?: string, photoCode?: string, rotation?: number) => void;
  onOpenPhotoAction?: (params: AuditPhotoActionParams) => void;
  onOpenPhotoHistory?: (params: AuditPhotoHistoryParams) => void;
  className?: string;
}

export const AuditPhotoCard: React.FC<AuditPhotoCardProps> = ({
  url,
  photoCode,
  title,
  category,
  targetPhotoType,
  targetPhotoId,
  defectId,
  defectCode,
  hasMultiplePhotos = false,
  floorCode,
  zoneCode,
  photoIndex,
  isEditMode = true,
  isNotApplicable = false,
  naReason,
  aspectRatio = 'aspect-4/3',
  maxHeightPx,
  badgeColor = 'slate',
  extraBadges,
  optimisticStatus,
  historyCount,
  hasHistory,
  rotation = 0,
  isAutoRotated = false,
  isOrientationMismatch = false,
  isStrictOrientation = false,
  orientationRecommendation,
  expectedOrientation,
  onRotate,
  domId,
  photoKey,
  onUndoDelete,
  onOpenPhotoZoom,
  onOpenPhotoAction,
  onOpenPhotoHistory,
  className = '',
}) => {
  const hasUrl = Boolean(url && url.trim().length > 0);

  const handleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasUrl && onOpenPhotoZoom) {
      onOpenPhotoZoom(url!, title, photoKey || photoCode, rotation);
    }
  };

  const handleAction = (e: React.MouseEvent, mode: 'REPLACE' | 'ADD' | 'DELETE') => {
    e.stopPropagation();
    if (onOpenPhotoAction) {
      onOpenPhotoAction({
        initialMode: mode,
        category,
        targetPhotoType,
        targetPhotoId,
        defectId,
        defectCode,
        hasMultiplePhotos,
        currentPhotoUrl: url || '',
        currentPhotoCode: photoCode || '',
        photoTitle: title,
        floorCode,
        zoneCode,
        photoIndex,
      });
    }
  };

  const badgeColorClasses = {
    sky: 'bg-sky-600 text-white',
    emerald: 'bg-emerald-600 text-white',
    amber: 'bg-amber-600 text-white',
    rose: 'bg-rose-600 text-white',
    slate: 'bg-slate-900/80 text-white',
    indigo: 'bg-indigo-600 text-white',
  }[badgeColor];

  // Trường hợp Không Áp Dụng (N/A)
  if (isNotApplicable) {
    return (
      <div
        className={`group relative rounded-xl border border-amber-200 bg-amber-50/70 p-3 flex flex-col justify-between overflow-hidden shadow-2xs ${aspectRatio} ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {photoCode && (
              <span className="px-2 py-0.5 rounded font-mono font-black text-[10px] bg-amber-200 text-amber-900 border border-amber-300">
                {photoCode}
              </span>
            )}
            {onOpenPhotoHistory && ((historyCount !== undefined && historyCount > 0) || hasHistory) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPhotoHistory({
                    photoCode,
                    photoType: targetPhotoType,
                    photoTitle: title,
                    currentPhotoUrl: '',
                  });
                }}
                className="px-1.5 py-0.5 rounded font-mono font-bold text-[9px] bg-violet-600/90 hover:bg-violet-600 text-white flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                title={`Lịch sử phiên bản (${historyCount || 1} bản)`}
              >
                <History className="w-2.5 h-2.5" />
                <span>{historyCount ? `${historyCount} v` : 'LS'}</span>
              </button>
            )}
          </div>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500 text-slate-950">
            N/A
          </span>
        </div>

        <div className="text-center my-auto px-1 space-y-1">
          <div className="text-xs font-bold text-amber-950">{title}</div>
          <p className="text-[11px] text-amber-800 italic line-clamp-2">
            &ldquo;{naReason || 'Không áp dụng đối với công trình này'}&rdquo;
          </p>
        </div>

        <div className="flex items-center gap-1.5 w-full">
          {isEditMode && onOpenPhotoAction && (
            <button
              type="button"
              onClick={(e) => handleAction(e, 'REPLACE')}
              className="flex-1 py-1 px-2 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3 h-3 text-amber-700" />
              <span>Bổ Sung</span>
            </button>
          )}
          {onOpenPhotoHistory && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPhotoHistory({
                  photoCode,
                  photoType: targetPhotoType,
                  photoTitle: title,
                  currentPhotoUrl: '',
                });
              }}
              className="p-1 rounded-lg bg-white hover:bg-violet-100 text-violet-700 border border-violet-200 text-[10px] flex items-center justify-center transition-colors cursor-pointer"
              title="Lịch sử phiên bản ảnh"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Trường hợp Đã Xóa (Optimistic UI): Ẩn hẳn ảnh gốc, chỉ hiển thị thanh chip Hoàn tác gọn gàng
  if (optimisticStatus === 'DELETED') {
    const finalDeletedDomId = domId || (photoCode ? `audit-photo-card-${photoCode}` : undefined);
    return (
      <div
        id={finalDeletedDomId}
        onClick={(e) => e.stopPropagation()}
        className={`rounded-xl border border-dashed border-rose-300 bg-rose-50/80 px-3 py-2.5 flex items-center justify-between gap-2 shadow-2xs select-none ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {photoCode && (
            <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-rose-200 text-rose-800 shrink-0">
              {photoCode}
            </span>
          )}
          <span className="text-[11px] font-bold text-rose-700 truncate">
            Đã xóa ảnh ({title}) • Chờ lưu
          </span>
        </div>
        {onUndoDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUndoDelete();
            }}
            className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-[10px] font-black shadow-2xs flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
          >
            <Undo2 className="w-3 h-3 text-rose-600" />
            <span>Hoàn tác</span>
          </button>
        )}
      </div>
    );
  }

  // Trường hợp Chưa Có Ảnh
  if (!hasUrl) {
    return (
      <div
        className={`group relative rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 flex flex-col items-center justify-center text-center overflow-hidden shadow-2xs ${aspectRatio} ${className}`}
      >
        <div className="absolute top-2 left-2 flex items-center gap-1">
          {photoCode && (
            <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-200 text-slate-700">
              {photoCode}
            </span>
          )}
          {onOpenPhotoHistory && ((historyCount !== undefined && historyCount > 0) || hasHistory) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPhotoHistory({
                  photoCode,
                  photoType: targetPhotoType,
                  photoTitle: title,
                  currentPhotoUrl: '',
                });
              }}
              className="px-1.5 py-0.5 rounded font-mono font-bold text-[9px] bg-violet-600/90 hover:bg-violet-600 text-white flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
              title={`Lịch sử phiên bản (${historyCount || 1} bản)`}
            >
              <History className="w-2.5 h-2.5" />
              <span>{historyCount ? `${historyCount} v` : 'LS'}</span>
            </button>
          )}
        </div>
        <Camera className="w-6 h-6 text-slate-400 mb-1 group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-semibold text-slate-600 line-clamp-1 px-2">{title}</span>
        <span className="text-[10px] text-slate-400 italic mb-2">Chưa có ảnh</span>

        <div className="flex items-center gap-1.5">
          {isEditMode && onOpenPhotoAction && (
            <button
              type="button"
              onClick={(e) => handleAction(e, 'REPLACE')}
              className="py-1 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3 h-3" />
              <span>Tải Ảnh Lên</span>
            </button>
          )}
          {onOpenPhotoHistory && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPhotoHistory({
                  photoCode,
                  photoType: targetPhotoType,
                  photoTitle: title,
                  currentPhotoUrl: '',
                });
              }}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-violet-100 text-slate-600 hover:text-violet-700 border border-slate-200 hover:border-violet-200 transition-colors cursor-pointer"
              title="Lịch sử phiên bản ảnh"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Border & Glow styling theo trạng thái Optimistic hoặc Orientation Mismatch (Line vàng hổ phách)
  const statusBorderClass = optimisticStatus === 'REPLACED'
    ? 'border-2 border-amber-400 ring-2 ring-amber-400/30'
    : optimisticStatus === 'ADDED'
    ? 'border-2 border-emerald-500 ring-2 ring-emerald-500/30'
    : isOrientationMismatch || isAutoRotated
    ? isStrictOrientation
      ? 'border-2 border-amber-500 ring-2 ring-amber-500/30 shadow-xs' // Bắt buộc: Line vàng hổ phách đậm
      : 'border-2 border-amber-300 ring-1 ring-amber-300/30 shadow-2xs' // Khuyến nghị: Line vàng hổ phách nhẹ
    : 'border border-slate-200';

  // Trường hợp Có Ảnh
  const finalDomId = domId || (photoCode ? `audit-photo-card-${photoCode}` : undefined);
  const isCloseUpCuCard = category === 'DEFECT_CU' || targetPhotoType === 'CU' || targetPhotoType === 'DEFECT_CU';
  const resolvedMaxHeightPx =
    maxHeightPx ??
    (isCloseUpCuCard
      ? 340
      : aspectRatio === 'h-96'
      ? 360
      : aspectRatio === 'h-80'
      ? 320
      : aspectRatio === 'h-64'
      ? 260
      : 240);
  const viewportHeightClass = isCloseUpCuCard
    ? 'h-80 sm:h-[360px]'
    : aspectRatio === 'h-96'
    ? 'h-80 sm:h-96'
    : aspectRatio === 'h-80'
    ? 'h-72 sm:h-80'
    : 'h-56 sm:h-60';

  return (
    <div
      id={finalDomId}
      onClick={handleZoom}
      className={`group relative rounded-xl bg-white overflow-hidden cursor-pointer shadow-2xs hover:shadow-md transition-all select-none flex flex-col ${statusBorderClass} ${className}`}
    >
      {/* Vùng hiển thị ảnh (Image Viewport) - Tự động co giãn tỷ lệ khi xoay 90°/270°, không cắt 2 đầu và cân bằng ngang/dọc */}
      <div className={`relative w-full overflow-hidden bg-slate-950 flex items-center justify-center shrink-0 p-1 ${viewportHeightClass}`}>
        <RotatableImageFrame
          src={url!}
          alt={title}
          rotation={rotation}
          maxHeightPx={resolvedMaxHeightPx}
          wrapperClassName="w-full h-full"
          stageClassName="max-h-full rounded-sm shadow-xs"
        />

        {/* Minimal Chips góc trên bên trái: Mã ảnh & góc xoay */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 z-10 pointer-events-none">
          {photoCode && (
            <span
              className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] shadow-sm tracking-wide ${badgeColorClasses}`}
            >
              {photoCode}
            </span>
          )}
          {rotation > 0 && (
            <span
              className="px-1.5 py-0.5 rounded font-mono font-black text-[9px] bg-amber-500 text-slate-950 shadow-xs"
              title={`Ảnh đã xoay ${rotation}°`}
            >
              {rotation}°
            </span>
          )}
        </div>

        {/* Cụm Icon Thao Tác Tinh Gọn (Glassmorphic Toolbar) góc trên bên phải */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-black/60 hover:bg-black/85 backdrop-blur-xs rounded-lg p-0.5 shadow-sm transition-all z-10"
        >
          {onRotate && isEditMode && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextRot = ((rotation || 0) + 90) % 360;
                  onRotate(nextRot);
                }}
                className="p-1 rounded text-amber-300 hover:text-white hover:bg-amber-600 transition-colors cursor-pointer"
                title="Xoay 90° cùng chiều kim đồng hồ"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextRot = ((rotation || 0) + 270) % 360;
                  onRotate(nextRot);
                }}
                className="p-1 rounded text-amber-300 hover:text-white hover:bg-amber-600 transition-colors cursor-pointer"
                title="Xoay 90° ngược chiều kim đồng hồ"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleZoom}
            className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            title="Phóng to soi chi tiết"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {onOpenPhotoHistory && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPhotoHistory({
                  photoCode,
                  photoType: targetPhotoType,
                  photoTitle: title,
                  currentPhotoUrl: url || '',
                });
              }}
              className="p-1 rounded text-violet-300 hover:text-white hover:bg-violet-600 transition-colors cursor-pointer"
              title={historyCount ? `Xem lịch sử phiên bản (${historyCount})` : 'Xem lịch sử phiên bản ảnh'}
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}

          {isEditMode && onOpenPhotoAction && (
            <>
              <button
                type="button"
                onClick={(e) => handleAction(e, 'REPLACE')}
                className="p-1 rounded text-sky-300 hover:text-white hover:bg-sky-600 transition-colors cursor-pointer"
                title="Cập nhật / Thay thế / Bổ sung ảnh"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={(e) => handleAction(e, 'DELETE')}
                className="p-1 rounded text-rose-300 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
                title="Xóa ảnh / Đánh dấu Không Áp Dụng (N/A)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Chân Card (Card Footer Bar) - Nằm bên dưới ảnh, hiển thị chữ và thông tin rõ ràng */}
      <div className="p-2 sm:p-2.5 bg-white border-t border-slate-100 flex flex-col gap-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-xs font-bold text-slate-800 truncate" title={title}>
            {title}
          </span>
          {((historyCount !== undefined && historyCount > 0) || hasHistory) && (
            <span
              className="px-1.5 py-0.2 rounded font-mono font-bold text-[9px] bg-violet-100 text-violet-700 shrink-0"
              title={`Ảnh có ${historyCount || 1} phiên bản lịch sử`}
            >
              v{historyCount || 1}
            </span>
          )}
        </div>

        {/* Dòng metadata & badge trạng thái */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(isOrientationMismatch || isAutoRotated) && (
            <span
              className={`px-1.5 py-0.5 rounded font-bold text-[9px] shadow-2xs flex items-center gap-1 border shrink-0 ${
                isStrictOrientation
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
              title={
                orientationRecommendation ||
                (isStrictOrientation
                  ? `Quy chuẩn A4 bắt buộc: Ảnh cần xoay sang khổ ${expectedOrientation === 'PORTRAIT' ? 'DỌC (3:4)' : 'NGANG (4:3)'}.`
                  : `Khuyến nghị: Nên xoay sang khổ ${expectedOrientation === 'PORTRAIT' ? 'DỌC' : 'NGANG'}.`)
              }
            >
              {isStrictOrientation ? (
                <>
                  <AlertTriangle className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                  <span>Cần xoay A4</span>
                </>
              ) : (
                <>
                  <Lightbulb className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                  <span>
                    {expectedOrientation === 'PORTRAIT'
                      ? 'Khuyến nghị Dọc'
                      : expectedOrientation === 'LANDSCAPE'
                        ? 'Khuyến nghị Ngang'
                        : 'Gợi ý xoay'}
                  </span>
                </>
              )}
            </span>
          )}

          {optimisticStatus === 'REPLACED' && (
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[9px] shrink-0 animate-pulse flex items-center gap-1">
              <Edit3 className="w-2.5 h-2.5" />
              <span>Đã sửa</span>
            </span>
          )}

          {optimisticStatus === 'ADDED' && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[9px] shrink-0 animate-pulse flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Mới thêm</span>
            </span>
          )}

          {extraBadges}
        </div>
      </div>
    </div>
  );
};
