import React from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { InfoPopover } from '../../../../core/components/ui/InfoPopover';
import { ShieldAlert } from 'lucide-react';
import { Phase1SurveyFormData } from '../../types/phase1.types';
import { OBJECT_GROUPS } from './step1.constants';

interface Step1ObjectGroupSectionProps {
  formData: Phase1SurveyFormData;
  updateFormData: (updates: Partial<Phase1SurveyFormData>) => void;
}

export const Step1ObjectGroupSection: React.FC<Step1ObjectGroupSectionProps> = ({
  formData,
  updateFormData,
}) => {
  return (
    <Card className="border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            1.2. Nhóm Đối Tượng Công Trình
          </h2>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {OBJECT_GROUPS.map((grp) => {
          const isSelected = formData.objectGroup === grp.value;
          return (
            <div
              key={grp.value}
              onClick={() => updateFormData({ objectGroup: grp.value })}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                isSelected
                  ? `${grp.badgeColor} border-emerald-600 shadow-xs ring-1 ring-emerald-600/30`
                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
              }`}
            >
              <div className="font-bold text-sm mb-1 text-slate-900">{grp.label}</div>
              <div className="text-xs text-slate-600 leading-relaxed">{grp.desc}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
