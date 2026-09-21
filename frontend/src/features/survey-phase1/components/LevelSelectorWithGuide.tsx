import React, { useState } from 'react';
import { HelpCircle, X, Check } from 'lucide-react';

export interface LevelOptionGuide {
  level: number;
  scoreLabel?: string;
  title: string;
  subtitle?: string;
  physicalManifestation?: string;
  colorClass?: {
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

const DEFAULT_COLOR_CLASSES = [
  { border: 'border-emerald-300', bg: 'bg-emerald-50/60', text: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-800' },
  { border: 'border-blue-300', bg: 'bg-blue-50/60', text: 'text-blue-900', badge: 'bg-blue-100 text-blue-800' },
  { border: 'border-amber-300', bg: 'bg-amber-50/60', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-800' },
  { border: 'border-orange-300', bg: 'bg-orange-50/60', text: 'text-orange-900', badge: 'bg-orange-100 text-orange-800' },
  { border: 'border-red-400', bg: 'bg-red-50/70', text: 'text-red-900', badge: 'bg-red-100 text-red-800' },
];

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
            {options.some((o) => o.physicalManifestation) && (
              <button
                type="button"
                onClick={() => setShowGuideModal(true)}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-700 transition-colors"
                title="Xem hướng dẫn biểu hiện vật lý từng level"
                aria-label="Xem biểu hiện vật lý"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="text-xs font-bold px-2.5 py-1 rounded-full border bg-slate-50 text-slate-700">
          Mức chọn: <span className="text-emerald-700 font-extrabold">{selectedLevel}</span>
        </div>
      </div>

      {/* 5 Level Selection Grid (0 .. 4) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {options.map((opt) => {
          const isSelected = selectedLevel === opt.level;
          const colors = opt.colorClass || DEFAULT_COLOR_CLASSES[opt.level] || DEFAULT_COLOR_CLASSES[0];
          return (
            <button
              key={opt.level}
              type="button"
              onClick={() => onChangeLevel(opt.level)}
              className={`p-2.5 rounded-lg border text-left transition-all relative flex flex-col justify-between ${
                isSelected
                  ? `${colors.border} ${colors.bg} ring-2 ring-emerald-500 ring-offset-1 shadow-sm`
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] font-black px-1.5 py-0.5 rounded ${colors.badge}`}>
                    {opt.scoreLabel || `${opt.level}`}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />}
                </div>
                <div
                  className={`text-xs font-bold leading-tight line-clamp-2 ${
                    isSelected ? colors.text : 'text-slate-800'
                  }`}
                >
                  {opt.title}
                </div>
              </div>
              {opt.subtitle && (
                <div className="text-[10px] text-slate-500 italic mt-1.5 leading-tight">
                  {opt.subtitle}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Additional Expanded Details */}
      {selectedLevel > 0 && children && (
        <div className="mt-3 pt-3 border-t border-dashed border-slate-200 animate-in fade-in">
          <span className="text-[11px] font-bold text-slate-600 block mb-2 uppercase tracking-wide">
            📝 Thông tin định lượng chi tiết bổ sung (Additional Details):
          </span>
          {children}
        </div>
      )}

      {/* Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-100 rounded-lg text-sky-700">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                    Biểu Hiện Vật Lý Chi Tiết Theo Từng Mức (0 - 4)
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

            <div className="p-5 overflow-y-auto space-y-3.5 divide-y divide-slate-100">
              {options.map((opt) => {
                const colors = opt.colorClass || DEFAULT_COLOR_CLASSES[opt.level] || DEFAULT_COLOR_CLASSES[0];
                return (
                  <div key={opt.level} className="pt-3 first:pt-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-black px-2 py-0.5 rounded ${colors.badge}`}>
                        {opt.scoreLabel || `${opt.level}`}
                      </span>
                      <span className="font-bold text-xs sm:text-sm text-slate-800">
                        {opt.title}
                      </span>
                      {opt.subtitle && <span className="text-xs text-slate-500 italic">({opt.subtitle})</span>}
                    </div>
                    {opt.physicalManifestation && (
                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/70">
                        {opt.physicalManifestation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

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
