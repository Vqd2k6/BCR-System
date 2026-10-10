import React from 'react';
import {
  Layers,
  AlertCircle,
  Building2,
  Home,
  Trash2,
} from 'lucide-react';
import type { UnitPartitionBox } from './FloorPlanCadPartitionCanvas';
import { formatShortUnitDisplay } from '../../core/utils/codeFormattingUtils';

interface CadPartitionListSidebarProps {
  floorNumber: number;
  floorCode?: string;
  projectParcelCode?: string;
  partitions: UnitPartitionBox[];
  selectedBoxId: string | null;
  setSelectedBoxId: (id: string | null) => void;
  duplicateBoxIds: Set<string>;
  duplicateErrors: Map<string, string>;
  surveyedUnitIds: Set<string>;
  readOnly?: boolean;
  onRenameBox: (id: string, newCode: string) => void;
  onDeleteBox: (id: string, e: React.MouseEvent) => void;
  onTogglePartitionType: (id: string, e: React.MouseEvent) => void;
}

export const CadPartitionListSidebar: React.FC<CadPartitionListSidebarProps> = ({
  floorNumber,
  floorCode,
  projectParcelCode,
  partitions,
  selectedBoxId,
  setSelectedBoxId,
  duplicateBoxIds,
  duplicateErrors,
  surveyedUnitIds,
  readOnly = false,
  onRenameBox,
  onDeleteBox,
  onTogglePartitionType,
}) => {
  return (
    <div className="w-72 sm:w-80 bg-white border-l border-slate-200 flex flex-col h-full z-30 animate-in slide-in-from-right-4 duration-150">
      <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
        <span className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-teal-600" />
          Vị Trí Tầng {floorNumber}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-mono text-[11px] border border-slate-200">
          {partitions.length} vị trí
        </span>
      </div>

      {duplicateBoxIds.size > 0 && (
        <div className="px-3 py-2 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="font-semibold">Phát hiện {duplicateBoxIds.size} ô trùng hoặc thiếu mã!</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {partitions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 leading-relaxed">
            Chưa có ô phân chia nào.<br />Chọn công cụ <strong className="text-teal-700">[Vẽ Căn Hộ]</strong> hoặc <strong className="text-indigo-700">[Vẽ Khu Chung]</strong> rồi kéo thả chuột trên bản vẽ để tạo.
          </div>
        ) : (
          partitions.map((box, idx) => {
            const isSelected = selectedBoxId === box.id;
            const isDuplicate = duplicateBoxIds.has(box.id);
            const isMaster = box.partitionType === 'MASTER';
            const isSurveyed = surveyedUnitIds.has(box.id) || surveyedUnitIds.has(box.unitCode.trim().toLowerCase());

            return (
              <div
                key={box.id}
                onClick={() => setSelectedBoxId(box.id)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                  isDuplicate
                    ? 'border-rose-400 bg-rose-50/80 text-rose-900 ring-1 ring-rose-400/60 shadow-xs'
                    : isSelected
                    ? 'border-amber-400 bg-amber-50/80 text-slate-900 ring-1 ring-amber-400/60 shadow-xs'
                    : isMaster
                    ? 'border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50/80 text-slate-800 hover:border-indigo-300'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 text-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0 pr-1">
                    <span className={`w-5 h-5 rounded-md border text-[10px] font-mono font-bold flex items-center justify-center shadow-2xs shrink-0 ${
                      isMaster ? 'bg-indigo-100 border-indigo-200 text-indigo-800' : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      {idx + 1}
                    </span>

                    {/* Nhãn mã hiển thị thân thiện trên Hub & Canvas (U-001 / M-001) */}
                    <span
                      className={`px-2 py-0.5 rounded-lg text-xs font-mono font-black flex items-center gap-1 shadow-2xs shrink-0 ${
                        isMaster ? 'bg-indigo-700 text-white' : 'bg-teal-700 text-white'
                      }`}
                      title={`Mã hiển thị giao diện: ${formatShortUnitDisplay(box.unitCode, box.partitionType)}`}
                    >
                      {isMaster ? <Building2 className="w-3 h-3" /> : <Home className="w-3 h-3" />}
                      <span>{formatShortUnitDisplay(box.unitCode, box.partitionType) || '---'}</span>
                    </span>

                    {readOnly || isSurveyed ? (
                      <span className="font-mono text-[11px] text-slate-500 font-semibold truncate flex items-center gap-1">
                        {isSurveyed && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 font-sans font-bold">
                            Đã khảo sát
                          </span>
                        )}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={box.unitCode}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onRenameBox(box.id, e.target.value)}
                        placeholder={isMaster ? 'M-001' : 'U-001'}
                        title={`Mã định danh CSDL: ${box.unitCode}`}
                        className={`w-20 px-1.5 py-0.5 rounded font-mono font-bold text-xs focus:outline-none transition-colors ${
                          isDuplicate
                            ? 'bg-rose-100 border border-rose-300 text-rose-800 focus:border-rose-500'
                            : isMaster
                            ? 'bg-white border border-indigo-300 text-indigo-900 focus:border-indigo-600'
                            : 'bg-white border border-slate-300 text-slate-900 focus:border-teal-600'
                        }`}
                      />
                    )}
                  </div>

                  {!readOnly && !isSurveyed && (
                    <button
                      type="button"
                      onClick={(e) => onDeleteBox(box.id, e)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-100/50 transition-colors cursor-pointer shrink-0"
                      title="Xóa ô này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dòng định danh kỹ thuật & metadata phục vụ xuất báo cáo tự động Metro 2 */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-0.5 pt-1 border-t border-slate-200/60">
                  <span className="truncate" title={`Metadata xuất báo cáo tự động: [${projectParcelCode || 'PARCEL'}]_${floorCode || `F${floorNumber}`}_${box.unitCode}`}>
                    ID: <strong className="text-slate-700 font-bold">[{projectParcelCode || 'LÔ'}]_{floorCode || `F${floorNumber}`}_{box.unitCode}</strong>
                  </span>
                  {box.unitCadUrl && (
                    <span className={`text-[9px] font-bold px-1 rounded text-white shrink-0 ml-1 ${isMaster ? 'bg-indigo-700' : 'bg-teal-700'}`}>
                      CAD ✓
                    </span>
                  )}
                </div>

                {isDuplicate && (
                  <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    <span>{duplicateErrors.get(box.id) || 'Mã bị trùng hoặc để trống!'}</span>
                  </div>
                )}

                {/* Phân loại & Trạng thái CAD */}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={(e) => onTogglePartitionType(box.id, e)}
                      className={`px-2 py-0.5 rounded-md font-semibold text-[10px] flex items-center gap-1 border transition-colors cursor-pointer ${
                        isMaster
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100'
                          : 'bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-100'
                      }`}
                      title="Nhấp để đổi giữa Căn hộ và Khu vực Master"
                    >
                      {isMaster ? (
                        <>
                          <Building2 className="w-3 h-3 text-indigo-600" />
                          <span>Khu Master (M)</span>
                        </>
                      ) : (
                        <>
                          <Home className="w-3 h-3 text-teal-600" />
                          <span>Căn Hộ</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <span className={`text-[10px] font-semibold flex items-center gap-1 ${
                      isMaster ? 'text-indigo-700' : 'text-teal-700'
                    }`}>
                      {isMaster ? <Building2 className="w-3 h-3" /> : <Home className="w-3 h-3" />}
                      {isMaster ? 'Khu Master (M)' : 'Căn Hộ'}
                    </span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400" title={`Mã lưu CSDL chuẩn: ${box.unitCode}`}>
                      CSDL: {box.unitCode}
                    </span>
                    {box.unitCadUrl ? (
                      <span className={`font-bold text-[10px] ${isMaster ? 'text-indigo-700' : 'text-teal-700'}`}>
                        CAD ✓
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">Chờ crop</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
