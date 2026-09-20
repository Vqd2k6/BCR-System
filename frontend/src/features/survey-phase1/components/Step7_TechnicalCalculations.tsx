import React from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Badge } from '../../../core/components/ui/Badge';
import { Select, Input } from '../../../core/components/ui/FormControls';
import { verifyDataCompletenessGate } from '../engine/completenessGate';
import { Calculator, ShieldCheck, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';

export const Step7_TechnicalCalculations: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const ecs = formData.ecs;
  const vi = formData.vi;

  const gateResult = verifyDataCompletenessGate(formData);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. Cổng Kiểm Tra Đủ Dữ Liệu (Data Completeness Gate) */}
      <Card className="border-sky-200 bg-sky-50/30">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-sky-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              Cổng Kiểm Tra Đủ Dữ Liệu Hiện Trường (Data Completeness Gate)
            </h2>
          </div>
          <Badge
            variant={
              gateResult.overallSuggestedDecision === 'ALLOW'
                ? 'success'
                : gateResult.overallSuggestedDecision === 'CONDITIONAL'
                ? 'warning'
                : 'danger'
            }
          >
            {gateResult.overallSuggestedDecision === 'ALLOW' && 'ĐỦ ĐIỀU KIỆN CHUYỂN TIẾP'}
            {gateResult.overallSuggestedDecision === 'CONDITIONAL' && 'CÓ ĐIỀU KIỆN'}
            {gateResult.overallSuggestedDecision === 'PENDING' && 'PENDING / CẦN XEM XÉT'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-white border border-slate-200">
            <span className="text-slate-500 block">1. Thông tin móng</span>
            <span className="font-bold text-slate-800">{gateResult.foundationInfo.label}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-slate-200">
            <span className="text-slate-500 block">2. Ảnh & Ghim khuyết tật</span>
            <span className="font-bold text-slate-800">
              {gateResult.photoMapping.label} ({gateResult.photoMapping.details})
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-slate-200">
            <span className="text-slate-500 block">3. Khảo sát bên trong</span>
            <span className="font-bold text-slate-800">{gateResult.internalAccess.label}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-slate-200">
            <span className="text-slate-500 block">4. Dữ liệu lún nghiêng</span>
            <span className="font-bold text-slate-800">{gateResult.settlementData.label}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-slate-200">
            <span className="text-slate-500 block">5. Hồ sơ / Bản vẽ</span>
            <span className="font-bold text-slate-800">{gateResult.asBuiltDrawings.label}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-slate-200">
            <span className="text-slate-500 block">6. Structural Review</span>
            <span
              className={`font-bold ${
                gateResult.structuralReview.status === 'PENDING_REVIEW'
                  ? 'text-red-600'
                  : 'text-emerald-700'
              }`}
            >
              {gateResult.structuralReview.label}
            </span>
          </div>
        </div>
      </Card>

      {/* 2. Bảng 11: ECS - EXISTING CONDITION SCORE */}
      <Card>
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                7.1. Bảng Điểm Hiện Hữu ECS (11. ECS – EXISTING CONDITION SCORE)
              </h2>
              <p className="text-xs text-slate-500">
                Thang sàng lọc dự án (0–24 điểm). Hệ thống tự động tính toán từ các bước trước.
              </p>
            </div>
          </div>
          <Badge
            variant={
              ecs.ecsClass === 'GOOD'
                ? 'success'
                : ecs.ecsClass === 'MEDIUM'
                ? 'warning'
                : ecs.ecsClass === 'DEFICIENT'
                ? 'danger'
                : 'neutral'
            }
          >
            Tổng: {ecs.totalEcs}/24 ({ecs.ecsClass})
          </Badge>
        </div>

        {/* Bảng ma trận 6x5 ECS */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl mb-4">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5 w-12 text-center">Mã</th>
                <th className="p-2.5 min-w-[150px]">Tiêu chí đánh giá</th>
                <th className="p-2.5 w-20 text-center">0đ</th>
                <th className="p-2.5 w-20 text-center">1đ</th>
                <th className="p-2.5 w-20 text-center">2đ</th>
                <th className="p-2.5 w-24 text-center">3–4đ</th>
                <th className="p-2.5 min-w-[200px]">Nguồn map & Quy tắc</th>
                <th className="p-2.5 w-16 text-center">Điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* E1 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">E1</td>
                <td className="p-2.5 font-medium">Hư hỏng nhìn thấy tường/khối xây</td>
                <td className="p-2.5 text-center text-slate-500">Burland 0–1</td>
                <td className="p-2.5 text-center text-slate-500">Burland 2</td>
                <td className="p-2.5 text-center text-slate-500">Burland 3</td>
                <td className="p-2.5 text-center text-slate-500">B4=3; B5=4</td>
                <td className="p-2.5 text-slate-600 text-[11px]">Map từ Burland Max Bước 4</td>
                <td className="p-2.5 text-center font-bold text-emerald-700 bg-emerald-50/50">{ecs.e1}</td>
              </tr>

              {/* E2 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">E2</td>
                <td className="p-2.5 font-medium">Khuyết tật kết cấu cột/dầm/sàn/tường</td>
                <td className="p-2.5 text-center text-slate-500">Không</td>
                <td className="p-2.5 text-center text-slate-500">Low</td>
                <td className="p-2.5 text-center text-slate-500">Moderate</td>
                <td className="p-2.5 text-center text-slate-500">High=3; Crit=4</td>
                <td className="p-2.5 text-slate-600 text-[11px]">Map từ Cờ kết cấu & Ý nghĩa D-xx</td>
                <td className="p-2.5 text-center font-bold text-emerald-700 bg-emerald-50/50">{ecs.e2}</td>
              </tr>

              {/* E3 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">E3</td>
                <td className="p-2.5 font-medium">Lún/nghiêng/võng/biến dạng</td>
                <td className="p-2.5 text-center text-slate-500">Không</td>
                <td className="p-2.5 text-center text-slate-500">Nghi ngờ/nhẹ</td>
                <td className="p-2.5 text-center text-slate-500">Rõ ổn định</td>
                <td className="p-2.5 text-center text-slate-500">Tiến triển=3-4</td>
                <td className="p-2.5 text-slate-600 text-[11px]">Map từ Bước 5 Lún nghiêng ‰</td>
                <td className="p-2.5 text-center font-bold text-emerald-700 bg-emerald-50/50">{ecs.e3}</td>
              </tr>

              {/* E4 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">E4</td>
                <td className="p-2.5 font-medium">Suy giảm vật liệu/độ bền</td>
                <td className="p-2.5 text-center text-slate-500">Không/nhẹ</td>
                <td className="p-2.5 text-center text-slate-500">Cục bộ</td>
                <td className="p-2.5 text-center text-slate-500">Đáng kể</td>
                <td className="p-2.5 text-center text-slate-500">Nặng/Chịu lực=3-4</td>
                <td className="p-2.5 text-slate-600 text-[11px]">Quét max từ toàn bộ Defect D-xx</td>
                <td className="p-2.5 text-center font-bold text-emerald-700 bg-emerald-50/50">{ecs.e4}</td>
              </tr>

              {/* E5 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">E5</td>
                <td className="p-2.5 font-medium">Lịch sử/cơi nới/sự cố & tính toàn vẹn</td>
                <td className="p-2.5 text-center text-slate-500">Không</td>
                <td className="p-2.5 text-center text-slate-500">Nhẹ/Đã xử lý</td>
                <td className="p-2.5 text-center text-slate-500">Nhiều/Chưa rõ</td>
                <td className="p-2.5 text-center text-slate-500">Lớn/Sự cố=3-4</td>
                <td className="p-2.5 text-slate-600 text-[11px]">Quét max từ 5 câu phỏng vấn B2.2</td>
                <td className="p-2.5 text-center font-bold text-emerald-700 bg-emerald-50/50">{ecs.e5}</td>
              </tr>

              {/* E6 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">E6</td>
                <td className="p-2.5 font-medium">Tình trạng chức năng/tổng thể</td>
                <td className="p-2.5 text-center text-slate-500">Tốt</td>
                <td className="p-2.5 text-center text-slate-500">TB</td>
                <td className="p-2.5 text-center text-slate-500">Kém</td>
                <td className="p-2.5 text-center text-slate-500">Nguy cấp=4</td>
                <td className="p-2.5 text-slate-600 text-[11px]">Gợi ý từ số Vùng Z có cờ hỏng</td>
                <td className="p-2.5 text-center font-bold text-emerald-700 bg-emerald-50/50">{ecs.e6}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Can thiệp của Kỹ sư */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <Select
            label="Quyền Can Thiệp Của Kỹ Sư (Engineering Judgement ECS)"
            value={ecs.engineeringJudgement.action}
            disabled={ecs.isOverrideLocked}
            onChange={(e) =>
              updateFormData({
                ecs: {
                  ...ecs,
                  engineeringJudgement: {
                    ...ecs.engineeringJudgement,
                    action: e.target.value as any,
                  },
                },
              })
            }
            options={[
              { value: 'KEEP', label: 'Giữ nguyên hạng đề xuất' },
              { value: 'UPGRADE', label: 'Nâng hạng rủi ro (Tăng nặng)' },
              { value: 'DOWNGRADE', label: 'Hạ hạng rủi ro (Giảm nhẹ)' },
            ]}
          />

          <Input
            label="Lý do can thiệp kỹ sư"
            placeholder="Nhập lý do kỹ thuật nếu thay đổi hạng..."
            value={ecs.engineeringJudgement.reason}
            onChange={(e) =>
              updateFormData({
                ecs: {
                  ...ecs,
                  engineeringJudgement: {
                    ...ecs.engineeringJudgement,
                    reason: e.target.value,
                  },
                },
              })
            }
          />
        </div>

        {ecs.isOverrideLocked && (
          <div className="mt-2 text-xs text-red-600 font-semibold flex items-center gap-1.5">
            <Lock className="w-4 h-4" />
            <span>Đang khóa an toàn (ECS Override): Do E2 ≥ 3 hoặc E3 ≥ 3, không thể hạ hạng ECS.</span>
          </div>
        )}
      </Card>

      {/* 3. Bảng 13: VI - VULNERABILITY INDEX */}
      <Card>
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                7.2. Bảng Chỉ Số Dễ Tổn Thương VI (13. VI – VULNERABILITY INDEX)
              </h2>
              <p className="text-xs text-slate-500">
                Phản ánh độ nhạy cảm của công trình trước lún/rung do Metro. Thang 1 (thấp) đến 4 (rất cao).
              </p>
            </div>
          </div>
          <Badge variant="purple">
            Điểm TB: {vi.viAvg} ({vi.viClass})
          </Badge>
        </div>

        {/* Bảng ma trận 6x5 VI */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl mb-4">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5 w-12 text-center">Mã</th>
                <th className="p-2.5 min-w-[150px]">Tiêu chí đánh giá</th>
                <th className="p-2.5 text-center">1đ</th>
                <th className="p-2.5 text-center">2đ</th>
                <th className="p-2.5 text-center">3đ</th>
                <th className="p-2.5 text-center">4đ</th>
                <th className="p-2.5 min-w-[180px]">Nguồn map</th>
                <th className="p-2.5 w-16 text-center">Điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* V1 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">V1</td>
                <td className="p-2.5 font-medium">Công năng & Quy mô</td>
                <td className="p-2.5 text-center text-slate-500">General (1)</td>
                <td className="p-2.5 text-center text-slate-500">Important (2)</td>
                <td className="p-2.5 text-center text-slate-500">—</td>
                <td className="p-2.5 text-center text-slate-500">Critical (4)</td>
                <td className="p-2.5 text-slate-600 text-[11px]">Nhóm đối tượng Bước 1</td>
                <td className="p-2.5 text-center font-bold text-purple-700 bg-purple-50/50">{vi.v1}</td>
              </tr>

              {/* V2 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">V2</td>
                <td className="p-2.5 font-medium">Hệ kết cấu chịu lực</td>
                <td className="p-2.5 text-center text-slate-500">BTCT toàn khối</td>
                <td className="p-2.5 text-center text-slate-500">BTCT + tường gạch</td>
                <td className="p-2.5 text-center text-slate-500">Tường gạch/thép cũ</td>
                <td className="p-2.5 text-center text-slate-500">Kém ổn định</td>
                <td className="p-2.5 text-slate-600 text-[11px]">Hệ kết cấu Bước 2.1</td>
                <td className="p-2.5 text-center font-bold text-purple-700 bg-purple-50/50">{vi.v2}</td>
              </tr>

              {/* V3 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">V3</td>
                <td className="p-2.5 font-medium">Loại móng & Nền đất</td>
                <td className="p-2.5 text-center text-slate-500">Cọc tốt (Cat 4-5)</td>
                <td className="p-2.5 text-center text-slate-500">Cọc ma sát (Cat 3)</td>
                <td className="p-2.5 text-center text-slate-500">Nông/yếu (Cat 2)</td>
                <td className="p-2.5 text-center text-slate-500">Yếu/Không rõ (Cat 1)</td>
                <td className="p-2.5 text-slate-600 text-[11px]">CAT móng Bước 2.1</td>
                <td className="p-2.5 text-center font-bold text-purple-700 bg-purple-50/50">{vi.v3}</td>
              </tr>

              {/* V4 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">V4</td>
                <td className="p-2.5 font-medium">Tuổi đời / Cơi nới</td>
                <td className="p-2.5 text-center text-slate-500">&lt; 10 năm</td>
                <td className="p-2.5 text-center text-slate-500">10–25 năm</td>
                <td className="p-2.5 text-center text-slate-500">25–40 năm</td>
                <td className="p-2.5 text-center text-slate-500">&gt; 40n / Cơi nới</td>
                <td className="p-2.5 text-slate-600 text-[11px]">Năm XD B2.1 & Cơi nới B2.2</td>
                <td className="p-2.5 text-center font-bold text-purple-700 bg-purple-50/50">{vi.v4}</td>
              </tr>

              {/* V5 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">V5</td>
                <td className="p-2.5 font-medium">Hiện trạng kỹ thuật</td>
                <td className="p-2.5 text-center text-slate-500">ECS Good</td>
                <td className="p-2.5 text-center text-slate-500">ECS Medium</td>
                <td className="p-2.5 text-center text-slate-500">ECS Deficient</td>
                <td className="p-2.5 text-center text-slate-500">ECS Critical</td>
                <td className="p-2.5 text-slate-600 text-[11px]">ECS Class Mục 7.1</td>
                <td className="p-2.5 text-center font-bold text-purple-700 bg-purple-50/50">{vi.v5}</td>
              </tr>

              {/* V6 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">V6</td>
                <td className="p-2.5 font-medium">Thiết bị nhạy cảm</td>
                <td className="p-2.5 text-center text-slate-500">Không có</td>
                <td className="p-2.5 text-center text-slate-500">Gia dụng/thấp</td>
                <td className="p-2.5 text-center text-slate-500">VP/KD/cao</td>
                <td className="p-2.5 text-center text-slate-500">Y tế/TN 24/7/rất cao</td>
                <td className="p-2.5 text-slate-600 text-[11px]">Thiết bị B2.2</td>
                <td className="p-2.5 text-center font-bold text-purple-700 bg-purple-50/50">{vi.v6}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={prevStep}>
          ⬅️ Quay lại Bước 6
        </Button>
        <Button onClick={nextStep}>
          Tiếp tục: Bước 8 (Dashboard Tổng Hợp) ➔
        </Button>
      </div>
    </div>
  );
};
