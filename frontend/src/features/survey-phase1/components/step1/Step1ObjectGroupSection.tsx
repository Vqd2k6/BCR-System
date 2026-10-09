import React, { useEffect } from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { InfoPopover } from '../../../../core/components/ui/InfoPopover';
import { ShieldAlert, Lock, CheckCircle2 } from 'lucide-react';
import type { Phase1SurveyFormData } from '../../types/phase1.types';
import { OBJECT_GROUPS } from './step1.constants';

interface Step1ObjectGroupSectionProps {
  formData: Phase1SurveyFormData;
  updateFormData: (updates: Partial<Phase1SurveyFormData>) => void;
  isCondoMaster?: boolean;
}

export const Step1ObjectGroupSection: React.FC<Step1ObjectGroupSectionProps> = ({
  formData,
  updateFormData,
  isCondoMaster = false,
}) => {
  useEffect(() => {
    if (isCondoMaster && formData.objectGroup !== 'IMPORTANT') {
      updateFormData({ objectGroup: 'IMPORTANT' });
    }
  }, [isCondoMaster, formData.objectGroup, updateFormData]);

  return (
    <Card className="border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            1.2. Nhóm Đối Tượng Công Trình
          </h2>
          {isCondoMaster && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Lock className="w-3 h-3 text-indigo-600" />
              Cố định Chung Cư
            </span>
          )}
        </div>
        <InfoPopover title="Hướng dẫn phân loại nhóm đối tượng (V1)">
          <p className="mb-2 font-semibold">Quy tắc phân cấp đối tượng xây dựng Metro Line 2:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>General (1đ):</strong> Nhà ở gia đình, nhà phố 1-5 tầng, ki-ốt thông thường.</li>
            <li><strong>Important (2đ):</strong> Công trình công cộng, trường học, trạm y tế, chung cư tập trung đông dân cư (≥ 5 tầng).</li>
            <li><strong>Critical (4đ):</strong> Công trình bảo tồn di sản, chùa chiền, nhà thờ cổ, cơ sở hạ tầng an ninh quốc phòng trọng yếu.</li>
          </ul>
        </InfoPopover>
      </div>

      {isCondoMaster && (
        <div className="mb-3 p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-indigo-900 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              Công trình là <strong>Khối Tháp Chung Cư</strong>: Nhóm đối tượng được cố định bắt buộc là <strong>Important (2đ)</strong> theo chuẩn Metro 2.
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200 shrink-0">
            KHÔNG CHO PHÉP ĐỔI
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {OBJECT_GROUPS.map((grp) => {
          const isSelected = isCondoMaster ? grp.value === 'IMPORTANT' : formData.objectGroup === grp.value;
          const isLockedOut = isCondoMaster && grp.value !== 'IMPORTANT';

          return (
            <div
              key={grp.value}
              onClick={() => {
                if (isCondoMaster) return;
                updateFormData({ objectGroup: grp.value });
              }}
              className={`p-4 rounded-xl border-2 transition-all relative ${
                isLockedOut
                  ? 'opacity-40 grayscale cursor-not-allowed bg-slate-100/70 border-slate-200 pointer-events-none select-none'
                  : isSelected
                  ? `${grp.badgeColor} border-emerald-600 shadow-xs ring-1 ring-emerald-600/30 ${isCondoMaster ? 'cursor-default' : 'cursor-pointer'}`
                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-sm text-slate-900">{grp.label}</div>
                {isCondoMaster && grp.value === 'IMPORTANT' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    Cố định
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">{grp.desc}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
