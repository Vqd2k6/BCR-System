import React, { useState } from 'react';
import { HelpCircle, X, Check, AlertCircle } from 'lucide-react';
import { Modal } from '../../../core/components/ui/Modal';

export interface LevelOptionGuide {
  level: number;
  scoreLabel: string;
  title: string;
  subtitle: string;
  physicalManifestation: string;
  colorClass: {
    border: string;
    bg: string;
    text: string;
    badge: string;
  };
}

interface LevelSelectorWithGuideProps {
  title: string;
  subtitle?: string;
  selectedLevel: number;
  onChangeLevel: (level: number) => void;
  options: LevelOptionGuide[];
  children?: React.ReactNode;
}

export const LevelSelectorWithGuide: React.FC<LevelSelectorWithGuideProps> = ({
  title,
  subtitle,
  selectedLevel,
  onChangeLevel,
  options,
  children,
}) => {
  const [showGuideModal, setShowGuideModal] = useState(false);

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
      {/* Header with Title and Help Button */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm sm:text-base text-slate-800">{title}</h3>
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-700 transition-colors title='Xem hướng dẫn biểu hiện vật lý từng level'"
              aria-label="Xem biểu hiện vật lý"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="text-xs font-bold px-2.5 py-1 rounded-full border bg-slate-50 text-slate-700">
          Mức chọn: <span className="text-emerald-700 font-extrabold">{selectedLevel}đ</span>
        </div>
      </div>

      {/* 4/5 Level Selection Grid (0đ .. 4đ) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {options.map((opt) => {
          const isSelected = selectedLevel === opt.level;
          return (
            <button
              key={opt.level}
              type="button"
              onClick={() => onChangeLevel(opt.level)}
              className={`p-2.5 rounded-lg border text-left transition-all relative flex flex-col justify-between ${
                isSelected
                  ? `${opt.colorClass.border} ${opt.colorClass.bg} ring-2 ring-emerald-500 ring-offset-1 shadow-sm`
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[11px] font-black px-1.5 py-0.5 rounded ${opt.colorClass.badge}`}
                  >
                    {opt.scoreLabel}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />}
                </div>
                <div
                  className={`text-xs font-bold leading-tight line-clamp-2 ${
                    isSelected ? opt.colorClass.text : 'text-slate-800'
                  }`}
                >
                  {opt.title}
                </div>
              </div>
              <div className="text-[10px] text-slate-500 italic mt-1.5 leading-tight">
                ({opt.subtitle})
              </div>
            </button>
          );
        })}
      </div>

      {/* Additional Expanded Details (Vị trí, thông số đo) */}
      {selectedLevel > 0 && children && (
        <div className="mt-3 pt-3 border-t border-dashed border-slate-200 animate-in fade-in">
          <span className="text-[11px] font-bold text-slate-600 block mb-2 uppercase tracking-wide">
            📝 Thông tin định lượng chi tiết bổ sung (Additional Details):
          </span>
          {children}
        </div>
      )}

      {/* Guide Modal Showing Full Physical Manifestation of each Level */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-100 rounded-lg text-sky-700">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                    Biểu Hiện Vật Lý Chi Tiết Theo Từng Mức (0đ - 4đ)
                  </h4>
                  <p className="text-xs text-slate-500">{title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-3.5 divide-y divide-slate-100">
              {options.map((opt) => (
                <div key={opt.level} className="pt-3 first:pt-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded ${opt.colorClass.badge}`}
                    >
                      {opt.scoreLabel}
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-slate-800">
                      {opt.title}
                    </span>
                    <span className="text-xs text-slate-500 italic">({opt.subtitle})</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/70">
                    {opt.physicalManifestation}
                  </p>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
              >
                Đã hiểu & Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
