import React from 'react';
import {
  Maximize2,
  RefreshCw,
  Trash2,
  Camera,
  AlertCircle,
  Eye,
  Plus,
  Undo2,
  Edit3,
  History,
  RotateCw,
  RotateCcw,
} from 'lucide-react';
import type { AuditPhotoActionParams, AuditPhotoHistoryParams } from '../types';

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
  aspectRatio?: 'aspect-4/3' | 'aspect-video' | 'aspect-square' | 'h-16' | 'h-20' | 'h-24' | 'h-36' | 'h-48';
  badgeColor?: 'sky' | 'emerald' | 'amber' | 'rose' | 'slate' | 'indigo';
  extraBadges?: React.ReactNode;
  optimisticStatus?: 'REPLACED' | 'ADDED' | 'DELETED';
  historyCount?: number;
  hasHistory?: boolean;
  rotation?: number;
  expectedOrientation?: 'PORTRAIT' | 'LANDSCAPE' | 'ANY';
  onRotate?: (newRotation: number) => void;
  domId?: string;
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
  badgeColor = 'slate',
  extraBadges,
  optimisticStatus,
  historyCount,
  hasHistory,
  rotation = 0,
  expectedOrientation,
  onRotate,
  domId,
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
      onOpenPhotoZoom(url!, title, photoCode, rotation);
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

  // Border & Glow styling theo trạng thái Optimistic
  const statusBorderClass =
    optimisticStatus === 'DELETED'
      ? 'border-2 border-rose-500 opacity-60'
      : optimisticStatus === 'REPLACED'
      ? 'border-2 border-amber-400 ring-2 ring-amber-400/30'
      : optimisticStatus === 'ADDED'
      ? 'border-2 border-emerald-500 ring-2 ring-emerald-500/30'
      : 'border border-slate-200';

  // Trường hợp Có Ảnh
  const finalDomId = domId || (photoCode ? `audit-photo-card-${photoCode}` : undefined);

  return (
    <div
      id={finalDomId}
      onClick={handleZoom}
      className={`group relative rounded-xl bg-slate-900 overflow-hidden cursor-pointer shadow-2xs hover:shadow-md transition-all select-none ${aspectRatio} ${statusBorderClass} ${className}`}
    >
      <img
        src={url}
        alt={title}
        style={{
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          transition: 'transform 0.3s ease',
        }}
        className={`w-full h-full ${
          rotation && rotation % 180 !== 0 ? 'object-contain' : 'object-cover'
        } group-hover:scale-105 transition-transform duration-300`}
        loading="lazy"
      />

      {/* Top Bar: Mã ảnh bên trái & Cụm Icon tinh gọn bên phải */}
      <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 z-10">
        <div className="flex items-center gap-1">
          {photoCode && (
            <span
              className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] shadow-sm tracking-wide ${badgeColorClasses}`}
            >
              {photoCode}
            </span>
          )}
          {((historyCount !== undefined && historyCount > 0) || hasHistory) && (
            <span
              className="px-1.5 py-0.5 rounded font-mono font-bold text-[9px] bg-violet-600/90 text-white shadow-xs"
              title={`Ảnh có ${historyCount || 1} phiên bản lịch sử`}
            >
              v{historyCount || 1}
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
          {extraBadges}
        </div>

        {/* Cụm Icon Thao Tác Tinh Gọn (Glassmorphic Toolbar) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 bg-black/60 hover:bg-black/80 backdrop-blur-xs rounded-lg p-0.5 shadow-sm transition-all"
        >
          {onRotate && isEditMode && optimisticStatus !== 'DELETED' && (
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
                <RotateCw className="w-3 h-3" />
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
                <RotateCcw className="w-3 h-3" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleZoom}
            className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            title="Phóng to soi chi tiết"
          >
            <Maximize2 className="w-3 h-3" />
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
              <History className="w-3 h-3" />
            </button>
          )}

          {isEditMode && onOpenPhotoAction && optimisticStatus !== 'DELETED' && (
            <>
              <button
                type="button"
                onClick={(e) => handleAction(e, 'REPLACE')}
                className="p-1 rounded text-sky-300 hover:text-white hover:bg-sky-600 transition-colors cursor-pointer"
                title="Cập nhật / Thay thế / Bổ sung ảnh"
              >
                <Edit3 className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={(e) => handleAction(e, 'DELETE')}
                className="p-1 rounded text-rose-300 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
                title="Xóa ảnh / Đánh dấu Không Áp Dụng (N/A)"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Trạng thái Optimistic UI Overlay khi ĐÃ XÓA */}
      {optimisticStatus === 'DELETED' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 bg-rose-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 p-2 z-30"
        >
          <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] shadow-sm animate-pulse">
            Đã đánh dấu Xóa • Chờ lưu
          </span>
          {onUndoDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUndoDelete();
              }}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-rose-800 rounded-lg text-[10px] font-black shadow-md flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
            >
              <Undo2 className="w-3 h-3 text-rose-600" />
              <span>Hoàn tác (Undo)</span>
            </button>
          )}
        </div>
      )}

      {/* Badges trạng thái Optimistic UI ở góc dưới */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-end justify-between gap-1 pointer-events-none z-10">
        <span className="text-[10px] font-bold text-white drop-shadow-md truncate max-w-[70%]">
          {title}
        </span>

        {optimisticStatus === 'REPLACED' && (
          <span className="px-1.5 py-0.5 rounded bg-amber-500 text-amber-950 font-black text-[9px] shadow-sm shrink-0 animate-pulse">
            Đã thay • Chờ lưu
          </span>
        )}

        {optimisticStatus === 'ADDED' && (
          <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-black text-[9px] shadow-sm shrink-0 animate-pulse">
            Mới thêm • Chờ lưu
          </span>
        )}
      </div>
    </div>
  );
};
