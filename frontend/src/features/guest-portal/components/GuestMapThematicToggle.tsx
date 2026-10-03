import React from 'react';
import { Layers, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface GuestMapThematicToggleProps {
  thematicMode: 'WORKFLOW' | 'BRA_RISK';
  onChangeMode: (mode: 'WORKFLOW' | 'BRA_RISK') => void;
}

export const GuestMapThematicToggle: React.FC<GuestMapThematicToggleProps> = ({
  thematicMode,
  onChangeMode,
}) => {
  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-md rounded-xl p-1 flex items-center gap-1 select-none">
      <button
        type="button"
        onClick={() => onChangeMode('WORKFLOW')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          thematicMode === 'WORKFLOW'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
        title="Hiển thị màu sắc theo tiến độ khảo sát: Chưa KS, Chờ duyệt, Đã duyệt, Đang KS"
      >
        <CheckCircle2 size={14} className={thematicMode === 'WORKFLOW' ? 'text-white' : 'text-blue-500'} />
        <span>Theo Tiến Độ</span>
      </button>

      <button
        type="button"
        onClick={() => onChangeMode('BRA_RISK')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          thematicMode === 'BRA_RISK'
            ? 'bg-amber-600 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
        title="Hiển thị màu sắc theo cấp độ rủi ro xây dựng BRA (Negligible -> Severe)"
      >
        <ShieldAlert size={14} className={thematicMode === 'BRA_RISK' ? 'text-white' : 'text-amber-500'} />
        <span>Theo Cấp Rủi Ro BRA</span>
      </button>
    </div>
  );
};
