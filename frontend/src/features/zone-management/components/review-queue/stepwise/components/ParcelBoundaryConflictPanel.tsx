import React from 'react';
import { ArrowRight, CheckCircle2, Compass, RefreshCw, ShieldAlert, X } from 'lucide-react';

interface BoundaryDistancePreview {
  oldVertexCount: number;
  newVertexCount: number;
  oldMetroDisplay: string;
  newMetroDisplay: string;
  oldClearanceDisplay: string;
  newClearanceDisplay: string;
}

interface Props {
  hasConflict: boolean;
  isOpen: boolean;
  preview: BoundaryDistancePreview;
  keepConfirmed: boolean;
  keepReason: string;
  landAreaLabel: string;
  /** Tòa mẹ không tự bật chế độ sửa từ bước con nên khóa thao tác ghi khi đang chỉ xem. */
  canEdit?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onConfirm: () => void;
  onChangeKeepConfirmed: (val: boolean) => void;
  onChangeKeepReason: (val: string) => void;
}

/** Banner lệch ranh PostGIS, giữ ranh KSV kèm giải trình và popover so sánh cự ly trước/sau đồng bộ. */
export const ParcelBoundaryConflictPanel: React.FC<Props> = ({
  hasConflict,
  isOpen,
  preview,
  keepConfirmed,
  keepReason,
  landAreaLabel,
  canEdit = true,
  onOpen,
  onClose,
  onConfirm,
  onChangeKeepConfirmed,
  onChangeKeepReason,
}) => (
  <>
          {/* BANNER CAM CẢNH BÁO XUNG ĐỘT RANH ĐẤT GPMB (TC-SPA-01 & TC-GAT-01/02) */}
          {hasConflict && (
            <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-400 shadow-xs space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black uppercase text-amber-950">
                        Phát Hiện Lệch Ranh Đất GPMB / Nắn Chỉnh Trên Bản Đồ GIS PostGIS
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-400">
                        KSV ({preview.oldVertexCount} đỉnh) ≠ PostGIS ({preview.newVertexCount} đỉnh)
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 mt-0.5">
                      Đa giác ranh thửa trên CSDL PostGIS đã được nắn chỉnh so với ranh khảo sát gốc trong hồ sơ. Vui lòng đồng bộ ranh PostGIS mới hoặc xác nhận giữ ranh KSV kèm lý do giải trình trước khi Phê duyệt.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpen}
                  disabled={!canEdit}
                  className={`px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 shrink-0 shadow-xs transition-all ${
                    canEdit ? 'cursor-pointer' : 'disabled:opacity-50 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>1-Click Đồng Bộ Ranh Đất Đã Nắn Chỉnh</span>
                </button>
              </div>

              {/* Tuỳ chọn xác nhận giữ ranh KSV thực địa kèm giải trình >= 10 ký tự (TC-GAT-02) */}
              <div className="pt-2 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center gap-2.5 text-xs">
                <label className="flex items-center gap-2 font-bold text-amber-950 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={keepConfirmed}
                    disabled={!canEdit}
                    onChange={(e) => onChangeKeepConfirmed(e.target.checked)}
                    className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>Xác nhận giữ ranh KSV thực địa (không áp dụng ranh PostGIS)</span>
                </label>
                {keepConfirmed && (
                  <input
                    type="text"
                    value={keepReason}
                    disabled={!canEdit}
                    onChange={(e) => onChangeKeepReason(e.target.value)}
                    placeholder="Nhập lý do giải trình kỹ thuật (tối thiểu 10 ký tự)..."
                    className="flex-1 px-2.5 py-1 rounded-lg bg-white border border-amber-400 text-xs font-semibold text-slate-800"
                  />
                )}
              </div>
            </div>
          )}

          {/* POPOVER SO SÁNH CỰ LY TRƯỚC / SAU KHI BẤM ĐỒNG BỘ (TC-SPA-03 & TC-SPA-04) */}
          {isOpen && (
            <div className="p-4 rounded-xl bg-white border-2 border-sky-500 shadow-lg space-y-3 z-20">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-black uppercase text-slate-900">
                    So Sánh Cự Ly Trắc Địa Trước / Sau Đồng Bộ PostGIS
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-2 py-0.5 text-xs font-bold text-slate-500 hover:text-slate-800 rounded cursor-pointer flex items-center gap-1"
                >
                  <span>Đóng</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Khoảng cách đến Tim hầm Metro 2
                  </span>
                  <div className="flex items-center gap-2 mt-1 font-mono">
                    <span className="text-slate-500 line-through">{preview.oldMetroDisplay}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sm font-black text-emerald-700">{preview.newMetroDisplay}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Khoảng cách đến Mép ga / Đường bao ngoài
                  </span>
                  <div className="flex items-center gap-2 mt-1 font-mono">
                    <span className="text-slate-500 line-through">{preview.oldClearanceDisplay}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sm font-black text-emerald-700">{preview.newClearanceDisplay}</span>
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Bảo toàn chỉ số thực địa (Ràng buộc 02):</strong> Chỉ cập nhật tọa độ ranh (<code>parcelCoordinates</code>) và 2 cự ly Metro; giữ nguyên 100% <code>landAreaM2</code> ({landAreaLabel} m²), <code>constructionAreaM2</code>, <code>frontageWidth</code> và <code>lotDepth</code>.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Xác Nhận Áp Dụng Cự Ly & Ranh Mới</span>
                </button>
              </div>
            </div>
          )}
  </>
);
