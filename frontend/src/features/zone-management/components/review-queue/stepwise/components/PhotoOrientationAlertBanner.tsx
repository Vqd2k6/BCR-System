import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, RotateCw, ChevronDown, ChevronUp, X, Compass, CheckCircle2 } from 'lucide-react';
import type { PhotoOrientationViolation } from '../hooks/usePhotoOrientationAudit';

export interface PhotoOrientationAlertBannerProps {
  violations: PhotoOrientationViolation[];
  onNavigateToPhoto: (violation: PhotoOrientationViolation) => void;
  onQuickRotate?: (photoKey: string, currentRotation: number) => void;
  isFloatingPanel?: boolean;
  onClose?: () => void;
  currentHouseOrientation?: 'PORTRAIT' | 'LANDSCAPE';
  onSelectHouseOrientation?: (orientation: 'PORTRAIT' | 'LANDSCAPE' | 'AUTO') => void;
}

export const PhotoOrientationAlertBanner: React.FC<PhotoOrientationAlertBannerProps> = ({
  violations,
  onNavigateToPhoto,
  onQuickRotate,
  isFloatingPanel = false,
  onClose,
  currentHouseOrientation = 'PORTRAIT',
  onSelectHouseOrientation,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!violations || violations.length === 0) {
    if (!isFloatingPanel) return null;
    return (
      <div className="w-full bg-white rounded-2xl p-5 border border-emerald-200 shadow-xl space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h4 className="text-sm font-black text-slate-800">Kiểm Tra Hướng Ảnh Quy Chuẩn A4</h4>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="p-4 bg-emerald-50 rounded-xl text-center space-y-1 border border-emerald-200">
          <div className="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Toàn bộ ảnh đã chuẩn hướng in ấn A4</span>
          </div>
          <p className="text-[11px] text-emerald-700">
            Không phát hiện ảnh nào bị lệch hướng hoặc sai quy chuẩn trang in báo cáo.
          </p>
        </div>
      </div>
    );
  }

  const strictViolations = violations.filter((v) => v.isStrict);
  const advisoryViolations = violations.filter((v) => !v.isStrict);

  const containerClasses = isFloatingPanel
    ? 'w-full max-h-[80vh] flex flex-col bg-white border border-amber-300 rounded-2xl shadow-2xl p-4 overflow-hidden'
    : 'w-full bg-amber-500/10 border border-amber-300/80 rounded-2xl p-3.5 backdrop-blur-xs shadow-sm transition-all mb-4';

  return (
    <div className={containerClasses}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-amber-200/80 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs font-black">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs sm:text-sm font-black text-slate-800">
                {violations.length} Ảnh Cần Điều Chỉnh Hướng A4
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
            <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">
              Bấm nút xoay 1-click hoặc bấm &ldquo;Xem ảnh&rdquo; để di chuyển tới vị trí ảnh trên biểu mẫu.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {!isFloatingPanel && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <span>{isExpanded ? 'Thu gọn' : `Xem chi tiết (${violations.length})`}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          {isFloatingPanel && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
              title="Đóng bảng"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tùy chọn hướng chính của ngôi nhà (Dọc vs Ngang) */}
      {onSelectHouseOrientation && (
        <div className="py-2 border-b border-amber-200/50 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-bold">
            <Compass className="w-3.5 h-3.5 text-sky-600" />
            <span>Hướng nhà chính:</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
            <button
              type="button"
              onClick={() => onSelectHouseOrientation('PORTRAIT')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                currentHouseOrientation === 'PORTRAIT'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dọc (Nhà hẹp/ống)
            </button>
            <button
              type="button"
              onClick={() => onSelectHouseOrientation('LANDSCAPE')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                currentHouseOrientation === 'LANDSCAPE'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ngang (Nhà rộng)
            </button>
            <button
              type="button"
              onClick={() => onSelectHouseOrientation('AUTO')}
              className="px-2 py-0.5 rounded text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
              title="Tự động nhận diện theo kích thước thửa đất"
            >
              Tự động
            </button>
          </div>
        </div>
      )}

      {/* Expanded list of violations */}
      {(isExpanded || isFloatingPanel) && (
        <div className={`space-y-3 pt-2 ${isFloatingPanel ? 'overflow-y-auto flex-1 pr-1' : ''}`}>
          {/* Nhóm Bắt Buộc (Strict) */}
          {strictViolations.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-rose-900">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                <span>Bắt buộc chuẩn A4 ({strictViolations.length} ảnh):</span>
              </div>
              <div className={`grid gap-2 ${isFloatingPanel ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                {strictViolations.map((v, vIdx) => (
                  <div
                    key={`orientation_s_${v.key}_${v.floorIndex ?? 'g'}_${v.zoneCode ?? ''}_${v.photoCode ?? ''}_${vIdx}`}
                    className="p-2.5 rounded-xl bg-white border-2 border-amber-400 flex items-center justify-between gap-2 shadow-2xs hover:border-amber-500 transition-colors"
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
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                          <span>Đang là</span>
                          <strong className="text-rose-600 font-mono">{v.currentOrientation}</strong>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Cần</span>
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
                          title="Xoay nhanh 90°"
                        >
                          <RotateCw className="w-3 h-3 text-slate-950" />
                          <span>Xoay 90°</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onNavigateToPhoto(v)}
                        className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Di chuyển tới ảnh này"
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
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Khuyến nghị xoay theo hướng nhà ({advisoryViolations.length} ảnh):</span>
              </div>
              <div className={`grid gap-2 ${isFloatingPanel ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                {advisoryViolations.map((v, vIdx) => (
                  <div
                    key={`orientation_a_${v.key}_${v.floorIndex ?? 'g'}_${v.zoneCode ?? ''}_${v.photoCode ?? ''}_${vIdx}`}
                    className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-300 flex items-center justify-between gap-2 shadow-2xs hover:bg-amber-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {v.photoCode && (
                        <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-200 text-amber-900 border border-amber-300 shrink-0">
                          {v.photoCode}
                        </span>
                      )}
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 truncate block">
                          {v.title}
                        </span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                          <span>Đang là</span>
                          <strong className="text-amber-700 font-mono">{v.currentOrientation}</strong>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Gợi ý</span>
                          <strong className="text-emerald-700 font-mono">{v.expectedOrientation}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onQuickRotate && (
                        <button
                          type="button"
                          onClick={() => onQuickRotate(v.key, v.effectiveRotation)}
                          className="px-2 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="Xoay nhanh 90°"
                        >
                          <RotateCw className="w-3 h-3 text-amber-900" />
                          <span>Xoay 90°</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onNavigateToPhoto(v)}
                        className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Di chuyển tới ảnh này"
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

