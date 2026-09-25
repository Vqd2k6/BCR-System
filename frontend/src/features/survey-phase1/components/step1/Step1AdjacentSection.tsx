import React from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { Input, Select } from '../../../../core/components/ui/FormControls';
import { Compass } from 'lucide-react';
import { Phase1SurveyFormData } from '../../types/phase1.types';
import { ADJACENT_LEFT_RIGHT, ADJACENT_REAR } from './step1.constants';

interface Step1AdjacentSectionProps {
  formData: Phase1SurveyFormData;
  updateFormData: (updates: Partial<Phase1SurveyFormData>) => void;
}

export const Step1AdjacentSection: React.FC<Step1AdjacentSectionProps> = ({
  formData,
  updateFormData,
}) => {
  return (
    <Card className="border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            1.4. Công Trình Liền Kề Theo Các Hướng (Adjacent Structures)
          </h2>
        </div>
      </div>

      <div id="input-adjacent-buildings" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Bên Trái */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Compass className="w-4 h-4 text-emerald-600" />
            <span>Bên Trái (Theo hướng toà nhà) *</span>
          </div>
          <Select
            id="input-adjacentLeft"
            value={formData.adjacentBuildings?.left?.details || ''}
            onChange={(e) =>
              updateFormData({
                adjacentBuildings: {
                  ...formData.adjacentBuildings,
                  left: { ...formData.adjacentBuildings.left, details: e.target.value },
                },
              })
            }
            options={[
              { value: '', label: '--- Chọn hiện trạng bên trái ---' },
              ...ADJACENT_LEFT_RIGHT.map((opt) => ({ value: opt, label: opt })),
            ]}
          />
          <Input
            placeholder="Ghi chú chi tiết bên trái (nếu có)..."
            value={formData.adjacentBuildings?.left?.note || ''}
            onChange={(e) =>
              updateFormData({
                adjacentBuildings: {
                  ...formData.adjacentBuildings,
                  left: { ...formData.adjacentBuildings.left, note: e.target.value },
                },
              })
            }
          />
        </div>

        {/* Bên Phải */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Compass className="w-4 h-4 text-emerald-600" />
            <span>Bên Phải (Theo hướng toà nhà) *</span>
          </div>
          <Select
            id="input-adjacentRight"
            value={formData.adjacentBuildings?.right?.details || ''}
            onChange={(e) =>
              updateFormData({
                adjacentBuildings: {
                  ...formData.adjacentBuildings,
                  right: { ...formData.adjacentBuildings.right, details: e.target.value },
                },
              })
            }
            options={[
              { value: '', label: '--- Chọn hiện trạng bên phải ---' },
              ...ADJACENT_LEFT_RIGHT.map((opt) => ({ value: opt, label: opt })),
            ]}
          />
          <Input
            placeholder="Ghi chú chi tiết bên phải (nếu có)..."
            value={formData.adjacentBuildings?.right?.note || ''}
            onChange={(e) =>
              updateFormData({
                adjacentBuildings: {
                  ...formData.adjacentBuildings,
                  right: { ...formData.adjacentBuildings.right, note: e.target.value },
                },
              })
            }
          />
        </div>

        {/* Phía Sau */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Compass className="w-4 h-4 text-emerald-600" />
            <span>Phía Sau Tiếp Giáp *</span>
          </div>
          <Select
            id="input-adjacentBack"
            value={formData.adjacentBuildings?.back?.details || ''}
            onChange={(e) =>
              updateFormData({
                adjacentBuildings: {
                  ...formData.adjacentBuildings,
                  back: { ...formData.adjacentBuildings.back, details: e.target.value },
                },
              })
            }
            options={[
              { value: '', label: '--- Chọn hiện trạng phía sau ---' },
              ...ADJACENT_REAR.map((opt) => ({ value: opt, label: opt })),
            ]}
          />
          <Input
            placeholder="Ghi chú chi tiết phía sau (nếu có)..."
            value={formData.adjacentBuildings?.back?.note || ''}
            onChange={(e) =>
              updateFormData({
                adjacentBuildings: {
                  ...formData.adjacentBuildings,
                  back: { ...formData.adjacentBuildings.back, note: e.target.value },
                },
              })
            }
          />
        </div>
      </div>
    </Card>
  );
};
