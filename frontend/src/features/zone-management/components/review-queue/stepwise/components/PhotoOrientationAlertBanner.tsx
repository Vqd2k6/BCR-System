import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, RotateCw, ChevronDown, ChevronUp } from 'lucide-react';
import type { PhotoOrientationViolation } from '../hooks/usePhotoOrientationAudit';

export interface PhotoOrientationAlertBannerProps {
  violations: PhotoOrientationViolation[];
  onNavigateToPhoto: (violation: PhotoOrientationViolation) => void;
  onQuickRotate?: (photoKey: string, currentRotation: number) => void;
}

export const PhotoOrientationAlertBanner: React.FC<PhotoOrientationAlertBannerProps> = ({
  violations,
  onNavigateToPhoto,
  onQuickRotate,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!violations || violations.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-amber-500/10 border border-amber-300/80 rounded-2xl p-3.5 backdrop-blur-xs shadow-sm transition-all mb-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle className="w-4 h-4 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-black text-amber-950">
                Phát Hiện {violations.length} Ảnh Chụp Lệch Khuyến Nghị Quy Chuẩn FE
              </h4>
              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                Nhà Dân
              </span>
            </div>
            <p className="text-[11px] text-amber-800">
              Khuyến nghị xoay đúng hướng quy chuẩn để khi xuất Báo cáo PDF A4 hiển thị ngay ngắn, không vỡ trang.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
          >
            <span>{isExpanded ? 'Thu gọn' : `Xem chi tiết (${violations.length})`}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded list of violations */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-amber-200/80 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {violations.map((v) => (
              <div
                key={v.key}
                className="p-2.5 rounded-xl bg-white/90 border border-amber-200 flex items-center justify-between gap-2 shadow-2xs hover:border-amber-400 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {v.photoCode && (
                    <span className="px-1.5 py-0.5 rounded font-mono font-black text-[10px] bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                      {v.photoCode}
                    </span>
                  )}
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 truncate block">
                      {v.title}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      Đang là <strong className="text-rose-600 font-mono">{v.currentOrientation}</strong> ➔ Cần{' '}
                      <strong className="text-emerald-700 font-mono">{v.expectedOrientation}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onQuickRotate && (
                    <button
                      type="button"
                      onClick={() => onQuickRotate(v.key, v.effectiveRotation)}
                      className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Xoay nhanh 90° cùng chiều kim đồng hồ"
                    >
                      <RotateCw className="w-3 h-3 text-amber-700" />
                      <span className="hidden sm:inline">Xoay 90°</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onNavigateToPhoto(v)}
                    className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    title="Điều hướng tới ảnh này trong biểu mẫu thẩm định"
                  >
                    <span>Xem ảnh</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
