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

  const strictViolations = violations.filter((v) => v.isStrict);
  const advisoryViolations = violations.filter((v) => !v.isStrict);

  return (
    <div className="w-full bg-amber-500/10 border border-amber-300/80 rounded-2xl p-3.5 backdrop-blur-xs shadow-sm transition-all mb-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle className="w-4 h-4 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-black text-amber-950">
                Phát Hiện {violations.length} Ảnh Cần Điều Chỉnh Hướng Quy Chuẩn A4
              </h4>
              {strictViolations.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                  {strictViolations.length} Bắt Buộc
                </span>
              )}
              {advisoryViolations.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {advisoryViolations.length} Khuyến Nghị
                </span>
              )}
            </div>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Ảnh vi phạm được viền line vàng hổ phách trên card. Bấm nút xoay 1-click để đưa về đúng hướng chuẩn in ấn A4.
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
        <div className="mt-3 pt-3 border-t border-amber-200/80 space-y-3">
          {/* Nhóm Bắt Buộc (Strict) */}
          {strictViolations.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-rose-900">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                <span>Nhóm Ảnh BẮT BUỘC Chuẩn A4 ({strictViolations.length} ảnh) — Cần xoay trước khi phê duyệt:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {strictViolations.map((v, vIdx) => (
                  <div
                    key={`orientation_${v.key}_${v.floorIndex ?? 'g'}_${v.zoneCode ?? ''}_${v.photoCode ?? ''}_${vIdx}`}
                    className="p-2.5 rounded-xl bg-white/95 border-2 border-amber-400 flex items-center justify-between gap-2 shadow-2xs hover:border-amber-500 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {v.photoCode && (
                        <span className="px-1.5 py-0.5 rounded font-mono font-black text-[10px] bg-amber-500 text-slate-950 border border-amber-600 shrink-0">
                          {v.photoCode}
                        </span>
                      )}
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-800 truncate block">
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
                          className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="Xoay nhanh 90° cùng chiều kim đồng hồ"
                        >
                          <RotateCw className="w-3 h-3 text-slate-950" />
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

          {/* Nhóm Khuyến Nghị (Advisory) */}
          {advisoryViolations.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-amber-200/50">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Nhóm Ảnh KHUYẾN NGHỊ Thẩm Mỹ ({advisoryViolations.length} ảnh) — Không chặn phê duyệt:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {advisoryViolations.map((v, vIdx) => (
                  <div
                    key={`orientation_${v.key}_${v.floorIndex ?? 'g'}_${v.zoneCode ?? ''}_${v.photoCode ?? ''}_${vIdx}`}
                    className="p-2.5 rounded-xl bg-white/80 border border-amber-200 flex items-center justify-between gap-2 shadow-2xs hover:border-amber-400 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {v.photoCode && (
                        <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                          {v.photoCode}
                        </span>
                      )}
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 truncate block">
                          {v.title}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          Đang là <strong className="text-slate-700 font-mono">{v.currentOrientation}</strong> ➔ Khuyến nghị{' '}
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
                        className="px-2 py-1 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
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
      )}
    </div>
  );
};
