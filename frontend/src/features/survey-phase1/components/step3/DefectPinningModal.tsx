import React from 'react';
import { Button } from '../../../../core/components/ui/Button';
import { DefectPinningCanvas, DefectItem } from '../../../../components/canvas/DefectPinningCanvas';
import { X } from 'lucide-react';

interface DefectPinningModalProps {
  isOpen: boolean;
  mode: 'ARCHITECTURAL' | 'STRUCTURAL';
  code: string;
  name: string;
  ctxPhotoUrl?: string;
  defects: DefectItem[];
  onChange: (defects: DefectItem[]) => void;
  onClose: () => void;
}

export const DefectPinningModal: React.FC<DefectPinningModalProps> = ({
  isOpen,
  mode,
  code,
  name,
  ctxPhotoUrl,
  defects,
  onChange,
  onClose,
}) => {
  if (!isOpen || !ctxPhotoUrl) return null;

  const isStructural = mode === 'STRUCTURAL';
  const badgeColor = isStructural ? 'bg-amber-700' : 'bg-emerald-700';
  const headerBg = isStructural ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200';
  const title = isStructural
    ? `Ghi Sổ Khuyết Tật Kết Cấu Chịu Lực D-xx (${name})`
    : `Ghi Sổ Khuyết Tật Kiến Trúc D-xx (${name})`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div
        className={`bg-white rounded-2xl shadow-2xl border ${
          isStructural ? 'border-amber-200' : 'border-slate-200'
        } w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden`}
      >
        <div className={`flex items-center justify-between px-4 py-3 border-b ${headerBg}`}>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded ${badgeColor} text-white text-xs font-mono font-bold`}>
              {code}
            </span>
            <h3 className="font-bold text-sm sm:text-base text-slate-800">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <DefectPinningCanvas
            ctxPhotoUrl={ctxPhotoUrl}
            defects={defects}
            mode={mode}
            onChange={onChange}
          />
        </div>

        <div className={`flex items-center justify-between px-4 py-3 border-t ${headerBg}`}>
          <span className="text-xs text-slate-500">
            Ghim màu xanh: Đã điền xong • Ghim màu cam: Đang chờ cập nhật
          </span>
          <Button
            size="sm"
            className={isStructural ? 'bg-amber-600 hover:bg-amber-700 text-white' : undefined}
            onClick={onClose}
          >
            Xong & Đóng lại
          </Button>
        </div>
      </div>
    </div>
  );
};
