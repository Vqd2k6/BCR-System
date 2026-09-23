import React from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Badge } from '../../../core/components/ui/Badge';
import { Textarea } from '../../../core/components/ui/FormControls';
import { InfoPopover } from '../../../core/components/ui/InfoPopover';
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {/* Card 1: ECS */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  1. Hiện trạng ECS / BCS
                </span>
                <InfoPopover title="1. Hiện trạng công trình (ECS / BCS)" size="sm">
                  <p><strong>Nguồn:</strong> Tổng hợp từ 6 chỉ tiêu kỹ thuật E1 đến E6 (thang 0-24 điểm) ở Bước 6.1.</p>
                  <p className="mt-1"><strong>Phân hạng:</strong> GOOD (0-4: Tốt), MEDIUM (5-12: Trung bình), DEFICIENT (13-24: Kém/Hư hại nặng).</p>
                  <p className="mt-1"><strong>Ý nghĩa:</strong> Làm căn cứ pháp lý hiện trạng trước thi công tuyến Metro nhằm phục vụ giải quyết bồi thường hoặc khước từ đền bù.</p>
                </InfoPopover>
              </div>
              <div className="text-center my-1">
                <span className="text-2xl font-black text-slate-800">{ecs.totalEcs} <span className="text-sm font-normal text-slate-400">/24</span></span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 text-center">
              <span className="text-xs font-bold text-emerald-700 block">{effectiveEcsClass}</span>
              {ecs.engineeringJudgement.action !== 'KEEP' && (
                <span className="text-[10px] text-amber-600 block italic">Gốc: {ecs.ecsClass}</span>
              )}
            </div>
          </div>

          {/* Card 2: Burland & Cờ kết cấu */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  2. Burland & Cờ Kết Cấu
                </span>
                <InfoPopover title="2. Cấp Burland & Cờ Khuyết Tật Kết Cấu" size="sm">
                  <p><strong>Nguồn:</strong> Tự động kế thừa từ các Vùng kiến trúc Z (Mục 3.1 & 4.1).</p>
                  <p className="mt-1"><strong>Burland:</strong> Grade phổ biến (Mode) và Grade lớn nhất (Max) theo quy chuẩn nứt tường xây Burland (1977) / Mair et al. (1996).</p>
                  <p className="mt-1"><strong>Cờ kết cấu:</strong> Đánh giá hư hại độc lập cho hệ cột/dầm/sàn chịu lực (None, Low, Moderate, High, Critical).</p>
                </InfoPopover>
              </div>
              <div className="flex items-center justify-center gap-2 my-1">
                <span className="text-xl font-black text-slate-800">Gr.{burland?.predominantGrade ?? 0}</span>
                <span className="text-xs text-slate-400 font-medium">(Max: Gr.{burland?.localMaxGrade ?? 0})</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 text-center">
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
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  3. Chỉ Số Tổn Thương (VI)
                </span>
                <InfoPopover title="3. Chỉ số dễ tổn thương (Vulnerability Index - VI)" size="sm">
                  <p><strong>Nguồn:</strong> Trung bình cộng 6 thông số độ nhạy cảm công trình (V1 đến V6, thang 1-4) ở Bước 6.2.</p>
                  <p className="mt-1"><strong>Phân hạng:</strong> VI-1 (&lt;1.5: Rất thấp), VI-2 (1.5-2.2: Thấp), VI-3 (2.3-3.0: Trung bình), VI-4 (&gt;3.0: Cao).</p>
                  <p className="mt-1"><strong>Ý nghĩa:</strong> Đánh giá mức độ nhạy cảm trước rung động và lún đất do máy đào hầm TBM gây ra.</p>
                </InfoPopover>
              </div>
              <div className="text-center my-1">
                <span className="text-2xl font-black text-purple-700">{vi.viAvg} <span className="text-sm font-normal text-slate-400">/4</span></span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 text-center">
              <span className="text-xs font-bold text-purple-800 block">{effectiveViClass}</span>
              {vi.engineeringJudgement?.action !== 'KEEP' && (
                <span className="text-[10px] text-amber-600 block italic">Gốc: {vi.viClass}</span>
              )}
            </div>
          </div>

          {/* Card 4: Construction Impact */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  4. Tác Động Thi Công Metro
                </span>
                <InfoPopover title="4. Tác động thi công dự kiến (Impact)" size="sm">
                  <p><strong>Nguồn:</strong> Mô hình tính toán bề mặt lún (Settlement Trough) và dịch chuyển ngang theo hồ sơ thiết kế kỹ thuật ngầm.</p>
                  <p className="mt-1"><strong>Trạng thái:</strong> PENDING - Chờ dữ liệu phân tích lún chi tiết từ Liên danh tư vấn tuyến Metro số 2.</p>
                </InfoPopover>
              </div>
              <div className="text-center my-1">
                <Badge variant="warning">PENDING</Badge>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 block mt-2 pt-2 border-t border-slate-200 text-center">
              Chờ số liệu thiết kế phê duyệt
            </span>
          </div>

          {/* Card 5: BRA Risk Assessment */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  5. Đánh Giá Rủi Ro Cơ Sở (BRA)
                </span>
                <InfoPopover title="5. Đánh giá rủi ro cơ sở (Baseline Risk Assessment - BRA)" size="sm">
                  <p><strong>Nguồn:</strong> Ma trận kết hợp giữa Hiện trạng kỹ thuật (ECS) và Tác động thi công dự báo (Impact).</p>
                  <p className="mt-1"><strong>Quy chuẩn:</strong> Phân nhóm rủi ro (Negligible / Slight / Moderate / High / Severe) để quyết định phương án gia cố bảo vệ công trình.</p>
                </InfoPopover>
              </div>
              <div className="text-center my-1">
                <Badge variant="warning">PENDING</Badge>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 block mt-2 pt-2 border-t border-slate-200 text-center">
              Chờ Hội đồng Dự án phê duyệt
            </span>
          </div>

          {/* Card 6: Quyết định Cổng Dữ Liệu */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  6. Cổng Kiểm Tra Dữ Liệu
                </span>
                <InfoPopover title="6. Quyết định cổng dữ liệu hiện trường (Gate Decision)" size="sm">
                  <p><strong>Nguồn:</strong> Quét tự động 6 tiêu chí kỹ thuật tại Bước 6.1 (Móng, Ảnh & ghim, Khảo sát trong, Lún nghiêng, Bản vẽ, Review kết cấu).</p>
                  <p className="mt-1"><strong>Phân loại:</strong> ALLOW (Đủ điều kiện phê duyệt), CONDITIONAL (Có điều kiện / hạn chế tiếp cận), PENDING (Chưa đủ hồ sơ).</p>
                </InfoPopover>
              </div>
              <div className="text-center my-1">
                <Badge
                  variant={
                    formData.gateDecision?.decision === 'ALLOW'
                      ? 'success'
                      : formData.gateDecision?.decision === 'CONDITIONAL'
                      ? 'warning'
                      : 'danger'
                  }
                >
                  {formData.gateDecision?.decision || 'ALLOW'}
                </Badge>
              </div>
            </div>
            <span className="text-[10px] text-slate-500 block mt-2 pt-2 border-t border-slate-100 truncate text-center">
              {formData.gateDecision?.reason || 'Đủ điều kiện chuyển tiếp'}
            </span>
          </div>
        </div>

        {/* Nhập text Rủi ro chính & Kiến nghị kỹ thuật */}
        <div className="space-y-4">
          <Textarea
            id="textarea-key-risks"
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
            id="textarea-technical-recommendations"
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
          {formData.unitId ? '⬅️ Quay lại Bước 5 (Bảng điểm ECS & VI)' : '⬅️ Quay lại Bước 6'}
        </Button>
        <Button onClick={nextStep}>
          {formData.unitId ? 'Tiếp tục: Bước 7 (Ký Biên Bản 3 Bên) ➔' : 'Tiếp tục: Bước 8 (Ký Biên Bản 3 Bên) ➔'}
        </Button>
      </div>
    </div>
  );
};
