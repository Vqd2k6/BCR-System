import React from 'react';
import { X } from 'lucide-react';
import {
  DefectPinningCanvas,
  type DefectCuPhotoBridge,
  type DefectItem,
} from '../../../../../../components/canvas/DefectPinningCanvas';

interface CondoDefectCanvasModalProps {
  mode: 'ARCHITECTURAL' | 'STRUCTURAL';
  parentCode: string;
  ctxPhotoUrl: string;
  defects: DefectItem[];
  cuPhotoBridge: DefectCuPhotoBridge;
  onChange: (defects: DefectItem[]) => void;
  onClose: () => void;
}

/** Cùng canvas KSV dùng ngoài hiện trường. Nằm dưới hộp ảnh (z-50) vì ảnh CU được chọn ngay khi canvas đang mở. */
export const CondoDefectCanvasModal: React.FC<CondoDefectCanvasModalProps> = ({
  mode,
  parentCode,
  ctxPhotoUrl,
  defects,
  cuPhotoBridge,
  onChange,
  onClose,
}) => (
  <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden force-light">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 text-xs font-mono font-bold shrink-0">
            {parentCode}
          </span>
          <h3 className="font-bold text-sm text-slate-800 truncate">Chấm Ghim & Ghi Sổ Khuyết Tật D-xx</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Đóng"
          className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <DefectPinningCanvas
          ctxPhotoUrl={ctxPhotoUrl}
          defects={defects}
          mode={mode}
          zoneOrElementCode={parentCode}
          onChange={onChange}
          cuPhotoBridge={cuPhotoBridge}
        />
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
        <span className="text-xs text-slate-500">Ghim xanh: đã điền xong • Ghim cam: còn thiếu thông tin</span>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
        >
          Xong & Đóng Lại
        </button>
      </div>
    </div>
  </div>
);
