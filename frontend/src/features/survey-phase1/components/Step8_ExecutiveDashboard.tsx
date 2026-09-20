import React from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Badge } from '../../../core/components/ui/Badge';
import { Textarea } from '../../../core/components/ui/FormControls';
import { LayoutDashboard, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

export const Step8_ExecutiveDashboard: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const ecs = formData.ecs;
  const vi = formData.vi;
  const ex = formData.executiveSummary;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <Card>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <LayoutDashboard className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            8. Bảng Tổng Hợp Kết Luận Toàn Diện & Đề Xuất Kỹ Thuật (Executive Summary)
          </h2>
        </div>

        {/* 4 Thẻ chỉ số tổng hợp */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-center">
            <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
              1. Hiện trạng ECS
            </span>
            <span className="text-lg font-black text-slate-800">{ecs.totalEcs}/24</span>
            <span className="text-xs block font-bold text-emerald-700 mt-0.5">{ecs.ecsClass}</span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-center">
            <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
              2. Burland Chủ Đạo
            </span>
            <span className="text-lg font-black text-slate-800">
              Grade {formData.burlandSummary.predominantGrade}
            </span>
            <span className="text-xs block text-slate-500 mt-0.5">
              Max: Grade {formData.burlandSummary.localMaxGrade}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-center">
            <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
              3. Mức Tổn Thương (VI)
            </span>
            <span className="text-lg font-black text-purple-700">{vi.viAvg}</span>
            <span className="text-xs block font-bold text-purple-800 mt-0.5">{vi.viClass}</span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-center">
            <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
              4. Rủi ro BRA
            </span>
            <Badge variant="warning" className="mt-1">
              PENDING
            </Badge>
            <span className="text-[10px] block text-slate-400 mt-1">Chờ số liệu thiết kế</span>
          </div>
        </div>

        {/* Nhập text Rủi ro chính & Kiến nghị */}
        <div className="space-y-4">
          <Textarea
            label="Khuyết Tật / Rủi Ro Nổi Bật Nhất Của Công Trình"
            placeholder="Tóm tắt các khuyết tật đáng chú ý nhất trước khi Metro thi công..."
            rows={3}
            value={ex.keyRisksDefectsText}
            onChange={(e) =>
              updateFormData({
                executiveSummary: { ...ex, keyRisksDefectsText: e.target.value },
              })
            }
          />

          <Textarea
            label="Kiến Nghị Kỹ Thuật / Yêu Cầu Quan Trắc Cụ Thể"
            placeholder="Đề xuất lắp mốc quan trắc lún, nghiêng hoặc gia cố cục bộ nếu cần..."
            rows={3}
            value={ex.specificRecommendationsText}
            onChange={(e) =>
              updateFormData({
                executiveSummary: { ...ex, specificRecommendationsText: e.target.value },
              })
            }
          />
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={prevStep}>
          ⬅️ Quay lại Bước 7
        </Button>
        <Button onClick={nextStep}>
          Tiếp tục: Bước 9 (Ký Biên Bản 3 Bên) ➔
        </Button>
      </div>
    </div>
  );
};
