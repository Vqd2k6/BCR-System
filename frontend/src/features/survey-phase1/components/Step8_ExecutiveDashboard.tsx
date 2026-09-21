import React from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Badge } from '../../../core/components/ui/Badge';
import { Textarea } from '../../../core/components/ui/FormControls';
import { LayoutDashboard, AlertCircle, FileText, CheckCircle2, Building, ShieldAlert, ShieldCheck, MapPin } from 'lucide-react';

export const Step8_ExecutiveDashboard: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const ecs = formData.ecs;
  const vi = formData.vi;
  const ex = formData.executiveSummary;
  const burland = formData.burlandSummary;

  // Tính toán hạng sau can thiệp kỹ sư
  const effectiveEcsClass = ecs.engineeringJudgement.action === 'UPGRADE'
    ? 'TĂNG NẶNG (Can thiệp KS)'
    : ecs.engineeringJudgement.action === 'DOWNGRADE'
    ? 'GIẢM NHẸ (Can thiệp KS)'
    : ecs.ecsClass;

  const effectiveViClass = vi.engineeringJudgement?.action === 'UPGRADE'
    ? 'TĂNG NẶNG (Can thiệp KS)'
    : vi.engineeringJudgement?.action === 'DOWNGRADE'
    ? 'GIẢM NHẸ (Can thiệp KS)'
    : vi.viClass;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Thông tin nhận diện công trình tóm tắt */}
      <Card className="bg-slate-50 border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-slate-700" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {formData.projectParcelCode} - {formData.buildingName || formData.officialCadastralCode || 'Công trình khảo sát'}
              </h2>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {formData.houseNumber} {formData.street} | Chủ hộ: <span className="font-semibold text-slate-700">{formData.ownerName || 'Chưa rõ'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="neutral">Lý trình: {formData.chainage || 'Km --+---'}</Badge>
            <Badge variant="neutral">Tim Metro: {formData.metroOffsetDistance || '--'} m</Badge>
            <Badge variant="neutral">Ranh GPMB: {formData.clearanceOffsetDistance || '--'} m</Badge>
          </div>
        </div>
      </Card>

      {/* 6 Khối Thẻ Chỉ Số Tổng Hợp Executive Cards */}
      <Card>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <LayoutDashboard className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              8. Bảng Tổng Hợp Kết Luận Toàn Diện & Đề Xuất Kỹ Thuật (Executive Summary Dashboard)
            </h2>
            <p className="text-xs text-slate-500">
              Tổng hợp tự động toàn bộ kết quả khảo sát hiện trường trước khi ký biên bản
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {/* Card 1: ECS */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs text-center flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                1. Hiện trạng ECS / BCS
              </span>
              <span className="text-2xl font-black text-slate-800">{ecs.totalEcs} <span className="text-sm font-normal text-slate-400">/24</span></span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-emerald-700 block">{effectiveEcsClass}</span>
              {ecs.engineeringJudgement.action !== 'KEEP' && (
                <span className="text-[10px] text-amber-600 block italic">Gốc: {ecs.ecsClass}</span>
              )}
            </div>
          </div>

          {/* Card 2: Burland & Cờ kết cấu */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs text-center flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                2. Burland & Cờ Kết Cấu
              </span>
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-black text-slate-800">Gr.{burland?.predominantGrade ?? 0}</span>
                <span className="text-xs text-slate-400 font-medium">(Max: Gr.{burland?.localMaxGrade ?? 0})</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100">
              <span className={`text-xs font-bold block ${
                burland?.structuralFlagLevel === 'HIGH' || burland?.structuralFlagLevel === 'CRITICAL'
                  ? 'text-red-600'
                  : burland?.structuralFlagLevel === 'MODERATE'
                  ? 'text-amber-600'
                  : 'text-emerald-700'
              }`}>
                Cờ KC: {burland?.structuralFlagLevel || 'NONE'}
              </span>
              {burland?.governingZoneDescription && (
                <span className="text-[10px] text-slate-500 block truncate" title={burland.governingZoneDescription}>
                  {burland.governingZoneDescription}
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Vulnerability VI */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs text-center flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                3. Chỉ Số Tổn Thương (VI)
              </span>
              <span className="text-2xl font-black text-purple-700">{vi.viAvg} <span className="text-sm font-normal text-slate-400">/4</span></span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-purple-800 block">{effectiveViClass}</span>
              {vi.engineeringJudgement?.action !== 'KEEP' && (
                <span className="text-[10px] text-amber-600 block italic">Gốc: {vi.viClass}</span>
              )}
            </div>
          </div>

          {/* Card 4: Construction Impact */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-center flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                4. Tác Động Thi Công Metro
              </span>
              <Badge variant="warning" className="mt-1">
                PENDING
              </Badge>
            </div>
            <span className="text-[10px] text-slate-400 block mt-2 pt-2 border-t border-slate-200">
              Chờ số liệu thiết kế phê duyệt
            </span>
          </div>

          {/* Card 5: BRA Risk Assessment */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-center flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                5. Đánh Giá Rủi Ro Cơ Sở (BRA)
              </span>
              <Badge variant="warning" className="mt-1">
                PENDING
              </Badge>
            </div>
            <span className="text-[10px] text-slate-400 block mt-2 pt-2 border-t border-slate-200">
              Chờ Hội đồng Dự án phê duyệt
            </span>
          </div>

          {/* Card 6: Quyết định Cổng Dữ Liệu */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white text-center flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                6. Cổng Kiểm Tra Dữ Liệu
              </span>
              <Badge
                variant={
                  formData.gateDecision?.decision === 'ALLOW'
                    ? 'success'
                    : formData.gateDecision?.decision === 'CONDITIONAL'
                    ? 'warning'
                    : 'danger'
                }
                className="mt-1"
              >
                {formData.gateDecision?.decision || 'ALLOW'}
              </Badge>
            </div>
            <span className="text-[10px] text-slate-500 block mt-2 pt-2 border-t border-slate-100 truncate">
              {formData.gateDecision?.reason || 'Đủ điều kiện chuyển tiếp'}
            </span>
          </div>
        </div>

        {/* Nhập text Rủi ro chính & Kiến nghị kỹ thuật */}
        <div className="space-y-4">
          <Textarea
            label="Khuyết Tật / Rủi Ro Chính Nổi Bật Nhất Của Công Trình"
            placeholder="Mô tả tóm quát các khuyết tật đáng chú ý nhất tại hiện trường (vết nứt chi phối, vị trí nguy cơ, vật liệu suy giảm)..."
            rows={3}
            value={ex.keyRisksDefectsText}
            onChange={(e) =>
              updateFormData({
                executiveSummary: { ...ex, keyRisksDefectsText: e.target.value },
              })
            }
          />

          <Textarea
            label="Kiến Nghị Cụ Thể / Đề Xuất Giải Pháp Kỹ Thuật & Quan Trắc"
            placeholder="Đề xuất các biện pháp theo dõi, đặt mốc quan trắc lún/nghiêng, cắm tấm đo nứt thạch cao/tell-tale, hoặc biện pháp chống đỡ gia cố trước khi đào hầm..."
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
