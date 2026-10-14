import React from 'react';
import {
  Maximize2,
  RefreshCw,
  Trash2,
  Camera,
  AlertCircle,
  Eye,
  Plus,
} from 'lucide-react';
import type { AuditPhotoActionParams } from '../types';

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
  aspectRatio?: 'aspect-4/3' | 'aspect-video' | 'aspect-square' | 'h-24' | 'h-36' | 'h-48';
  badgeColor?: 'sky' | 'emerald' | 'amber' | 'rose' | 'slate' | 'indigo';
  extraBadges?: React.ReactNode;
  onOpenPhotoZoom?: (url: string, title?: string, photoCode?: string) => void;
  onOpenPhotoAction?: (params: AuditPhotoActionParams) => void;
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
  onOpenPhotoZoom,
  onOpenPhotoAction,
  className = '',
}) => {
  const hasUrl = Boolean(url && url.trim().length > 0);

  const handleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasUrl && onOpenPhotoZoom) {
      onOpenPhotoZoom(url!, title, photoCode);
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
          {photoCode && (
            <span className="px-2 py-0.5 rounded font-mono font-black text-[10px] bg-amber-200 text-amber-900 border border-amber-300">
              {photoCode}
            </span>
          )}
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

        {isEditMode && onOpenPhotoAction && (
          <button
            type="button"
            onClick={(e) => handleAction(e, 'REPLACE')}
            className="w-full py-1 px-2 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
          >
            <Plus className="w-3 h-3 text-amber-700" />
            <span>Bổ Sung / Khôi Phục Ảnh</span>
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
        {photoCode && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-200 text-slate-700">
            {photoCode}
          </span>
        )}
        <Camera className="w-6 h-6 text-slate-400 mb-1 group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-semibold text-slate-600 line-clamp-1 px-2">{title}</span>
        <span className="text-[10px] text-slate-400 italic mb-2">Chưa có ảnh</span>

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
      </div>
    );
  }

  // Trường hợp Có Ảnh
  return (
    <div
      onClick={handleZoom}
      className={`group relative rounded-xl border border-slate-200 bg-slate-900 overflow-hidden cursor-pointer shadow-2xs hover:shadow-md transition-all select-none ${aspectRatio} ${className}`}
    >
      <img
        src={url}
        alt={title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
      />

      {/* Top Bar Badges */}
      <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 pointer-events-none z-10">
        <div className="flex items-center gap-1">
          {photoCode && (
            <span
              className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] shadow-sm tracking-wide ${badgeColorClasses}`}
            >
              {photoCode}
            </span>
          )}
          {extraBadges}
        </div>
      </div>

      {/* Hover Action Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2 z-20">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleZoom}
            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/40 text-white backdrop-blur-xs transition-colors cursor-pointer"
            title="Phóng to ảnh chi tiết"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-white truncate drop-shadow-md">{title}</div>

          {/* Action Buttons for Edit Mode */}
          {isEditMode && onOpenPhotoAction && (
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={(e) => handleAction(e, 'REPLACE')}
                className="flex-1 py-1 px-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-sm"
                title="Thay thế bằng ảnh mới chuẩn M2"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Đổi Ảnh</span>
              </button>

              <button
                type="button"
                onClick={(e) => handleAction(e, 'DELETE')}
                className="p-1 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white transition-colors cursor-pointer shadow-sm shrink-0"
                title="Xóa ảnh hoặc đánh dấu Không Áp Dụng (N/A)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
