import React from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { Activity, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';

const STRUCTURAL_FLAG_LEVELS = [
  { value: 'NONE', label: 'None - Không có cờ kết cấu (0 điểm)', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { value: 'LOW', label: 'Low - Cờ kết cấu thấp (1 điểm)', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  { value: 'MODERATE', label: 'Moderate - Cờ kết cấu trung bình (2 điểm)', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'HIGH', label: 'High - Cờ kết cấu cao / Nguy cơ chịu lực (3 điểm)', color: 'bg-orange-50 text-orange-800 border-orange-200' },
  { value: 'CRITICAL', label: 'Critical - Cờ kết cấu nguy cấp / Cảnh báo sập (4 điểm)', color: 'bg-red-50 text-red-800 border-red-200' },
];

export const Step4_BurlandSummary: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const bs = formData.burlandSummary;

  // Lấy danh sách tất cả các mã Zone Z-xx hiện có
  const allZones = formData.floors.flatMap((f) => f.zones);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 4.1. Tổng hợp Burland */}
      <Card>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <Activity className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            4.1. Tổng Hợp Burland Toàn Công Trình (Theo đúng Mục 9 Docx)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="1. Burland Chủ Đạo Toàn Nhà (Predominant Grade)"
            value={bs.predominantGrade}
            onChange={(e) =>
              updateFormData({
                burlandSummary: { ...bs, predominantGrade: Number(e.target.value) },
              })
            }
            options={[
              { value: 0, label: 'Grade 0 - Không đáng kể (<=0.1mm)' },
              { value: 1, label: 'Grade 1 - Rất nhẹ (~0.1-1mm)' },
              { value: 2, label: 'Grade 2 - Nhẹ (~1-5mm)' },
              { value: 3, label: 'Grade 3 - Trung bình (~5-15mm)' },
              { value: 4, label: 'Grade 4 - Nặng (~15-25mm)' },
              { value: 5, label: 'Grade 5 - Rất nặng (>=25mm)' },
            ]}
            hint="Mức độ nứt xuất hiện phổ biến nhất"
          />

          <Select
            label="2. Burland Cục Bộ Lớn Nhất (Local Max Grade)"
            value={bs.localMaxGrade}
            onChange={(e) =>
              updateFormData({
                burlandSummary: { ...bs, localMaxGrade: Number(e.target.value) },
              })
            }
            options={[
              { value: 0, label: 'Grade 0 - Không đáng kể (<=0.1mm)' },
              { value: 1, label: 'Grade 1 - Rất nhẹ (~0.1-1mm)' },
              { value: 2, label: 'Grade 2 - Nhẹ (~1-5mm)' },
              { value: 3, label: 'Grade 3 - Trung bình (~5-15mm)' },
              { value: 4, label: 'Grade 4 - Nặng (~15-25mm)' },
              { value: 5, label: 'Grade 5 - Rất nặng (>=25mm)' },
            ]}
            hint="Vết nứt nặng nhất ghi nhận được (dùng để tính E1)"
          />

          <Select
            label="3. Vùng Kiểm Soát Chi Phối (Governing Zone)"
            value={bs.governingZoneCode}
            onChange={(e) =>
              updateFormData({
                burlandSummary: { ...bs, governingZoneCode: e.target.value },
              })
            }
            options={
              allZones.length > 0
                ? allZones.map((z) => ({
                    value: z.zoneCode,
                    label: `${z.zoneCode} - ${z.floorName} - ${z.roomName} (${z.defects.length} nứt)`,
                  }))
                : [{ value: 'Z-01', label: 'Z-01 (Mặc định)' }]
            }
          />

          <Select
            label="4. Tính Đại Diện Toàn Cục (Representativeness)"
            value={bs.representativeness}
            onChange={(e) =>
              updateFormData({
                burlandSummary: {
                  ...bs,
                  representativeness: e.target.value as 'GLOBAL' | 'LOCAL',
                },
              })
            }
            options={[
              { value: 'GLOBAL', label: 'Toàn công trình (Đại diện chung)' },
              { value: 'LOCAL', label: 'Cục bộ (Chỉ xuất hiện tại 1 khu vực nhỏ)' },
            ]}
          />
        </div>
      </Card>

      {/* 4.2. Cờ khuyết tật kết cấu */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <ShieldAlert className="w-5 h-5 text-red-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            4.2. Đánh Giá Cờ Kết Cấu (Structural Flags & Safety Override)
          </h2>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          Cờ kết cấu đánh giá độc lập các nguy cơ cột/dầm/sàn/tường chịu lực (Dùng để tính điểm E2 và kích hoạt khóa an toàn).
        </p>

        <div className="space-y-2">
          {STRUCTURAL_FLAG_LEVELS.map((flag) => {
            const isSelected = bs.structuralFlagLevel === flag.value;
            return (
              <label
                key={flag.value}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? `${flag.color} border-current shadow-sm font-semibold`
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="structuralFlagLevel"
                  checked={isSelected}
                  onChange={() =>
                    updateFormData({
                      burlandSummary: {
                        ...bs,
                        structuralFlagLevel: flag.value as any,
                      },
                    })
                  }
                  className="text-red-600 focus:ring-red-500"
                />
                <span className="text-xs sm:text-sm">{flag.label}</span>
              </label>
            );
          })}
        </div>

        {/* Khóa an toàn */}
        {(bs.structuralFlagLevel === 'HIGH' || bs.structuralFlagLevel === 'CRITICAL') && (
          <div className="mt-4 p-3 rounded-xl border border-red-200 bg-red-50 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800">
              <strong>CẢNH BÁO AN TOÀN (ECS Override):</strong> Khi Cờ kết cấu ở mức High hoặc Critical, hệ thống sẽ tự động khóa <strong>KHÔNG CHO PHÉP HẠ HẠNG ECS</strong> để bảo đảm an toàn kết cấu và bảo vệ quyền lợi dự án.
            </div>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={prevStep}>
          ⬅️ Quay lại Bước 3
        </Button>
        <Button onClick={nextStep}>
          Tiếp tục: Bước 5 (Lún - Nghiêng ‰) ➔
        </Button>
      </div>
    </div>
  );
};
