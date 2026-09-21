import React from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Badge } from '../../../core/components/ui/Badge';
import { Select, Input } from '../../../core/components/ui/FormControls';
import { InfoPopover } from '../../../core/components/ui/InfoPopover';
import { verifyDataCompletenessGate } from '../engine/completenessGate';
import { Calculator, ShieldCheck, AlertTriangle, CheckCircle2, Lock, Info } from 'lucide-react';

export const Step7_TechnicalCalculations: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const ecs = formData.ecs;
  const vi = formData.vi;
  const gateDecision = formData.gateDecision || { decision: 'ALLOW', reason: '' };

  const gateResult = verifyDataCompletenessGate(formData);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. CỔNG KIỂM TRA ĐỦ DỮ LIỆU (DATA COMPLETENESS GATE) */}
      <Card className="border-sky-200 bg-sky-50/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-sky-100 gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                Cổng Kiểm Tra Đủ Dữ Liệu Hiện Trường (Data Completeness Gate)
              </h2>
              <p className="text-xs text-slate-500">
                Hệ thống tự động quét 6 tiêu chí kỹ thuật trước khi chuyển tiếp tính toán & kết luận
              </p>
            </div>
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

        {/* 6 Tiêu chí đánh giá */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-4">
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

        {/* Quyết định Cổng (Gate Decision BRA) */}
        <div className="p-3.5 bg-white rounded-xl border border-sky-200 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <Select
            label="Quyết định Cổng (Gate Decision BRA)"
            value={gateDecision.decision}
            onChange={(e) =>
              updateFormData({
                gateDecision: {
                  ...gateDecision,
                  decision: e.target.value as any,
                },
              })
            }
            options={[
              { value: 'ALLOW', label: 'Cho phép chuyển tiếp (ALLOW)' },
              { value: 'CONDITIONAL', label: 'Có điều kiện (CONDITIONAL)' },
              { value: 'PENDING', label: 'Chưa đủ - Pending (PENDING)' },
            ]}
          />

          <Input
            label="Lý do điều kiện / Ghi chú kiểm tra cổng"
            placeholder="Nhập ghi chú nếu chấp nhận có điều kiện hoặc tạm hoãn..."
            value={gateDecision.reason}
            onChange={(e) =>
              updateFormData({
                gateDecision: {
                  ...gateDecision,
                  reason: e.target.value,
                },
              })
            }
          />
        </div>
      </Card>

      {/* 2. BẢNG 11: ECS - EXISTING CONDITION SCORE */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                7.1. Bảng Điểm Hiện Hữu ECS (11. ECS – EXISTING CONDITION SCORE)
              </h2>
              <p className="text-xs text-slate-500 italic">
                Thang sàng lọc của dự án (0–24 điểm). Hệ thống tự động trích xuất điểm từ các bước trước.
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

        {/* Summary Badges Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Tổng ECS</span>
            <span className="text-base font-black text-emerald-700">{ecs.totalEcs} / 24</span>
            <span className="text-[11px] block font-bold text-slate-700">{ecs.ecsClass}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Burland Chủ Đạo</span>
            <span className="text-base font-black text-slate-800">Grade {formData.burlandSummary?.predominantGrade ?? 0}</span>
            <span className="text-[10px] text-slate-500 block">B3 & B4</span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Burland Cục Bộ Max</span>
            <span className="text-base font-black text-amber-700">Grade {formData.burlandSummary?.localMaxGrade ?? 0}</span>
            <span className="text-[10px] text-slate-500 block">B3 & B4</span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Cờ Kết Cấu</span>
            <span className={`text-base font-black ${
              formData.burlandSummary?.structuralFlagLevel === 'HIGH' || formData.burlandSummary?.structuralFlagLevel === 'CRITICAL'
                ? 'text-red-600'
                : formData.burlandSummary?.structuralFlagLevel === 'MODERATE'
                ? 'text-amber-600'
                : 'text-emerald-700'
            }`}>
              {formData.burlandSummary?.structuralFlagLevel || 'NONE'}
            </span>
            <span className="text-[10px] text-slate-500 block">Bước 4</span>
          </div>
        </div>

        {/* Bảng ma trận 6x5 ECS - Clean & gọn gàng */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl mb-4">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5 w-12 text-center">Mã</th>
                <th className="p-2.5 min-w-[200px]">Tiêu chí đánh giá</th>
                <th className="p-2.5 text-center">0đ</th>
                <th className="p-2.5 text-center">1đ</th>
                <th className="p-2.5 text-center">2đ</th>
                <th className="p-2.5 text-center">3–4đ</th>
                <th className="p-2.5 w-16 text-center">Điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* E1 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">E1</td>
                <td className="p-2.5 font-medium flex items-center justify-between">
                  <span>Hư hỏng nhìn thấy tường/khối xây</span>
                  <InfoPopover title="Quy tắc tính chỉ số E1" size="sm">
                    <p><strong>Nguồn:</strong> Lấy Burland Grade lớn nhất từ các Vùng Z ở Bước 3 và Bước 4.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> B ≤ 1: 0đ; B = 2: 1đ; B = 3: 2đ; B = 4: 3đ; B = 5: 4đ.</p>
                  </InfoPopover>
                </td>
                <td className="p-2.5 text-center text-slate-500">Burland 0–1</td>
                <td className="p-2.5 text-center text-slate-500">Burland 2</td>
                <td className="p-2.5 text-center text-slate-500">Burland 3</td>
                <td className="p-2.5 text-center text-slate-500">B4=3đ; B5=4đ</td>
                <td className="p-2.5 text-center font-bold text-emerald-700 bg-emerald-50/50">{ecs.e1}</td>
              </tr>

              {/* E2 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">E2</td>
                <td className="p-2.5 font-medium flex items-center justify-between">
                  <span>Khuyết tật kết cấu cột/dầm/sàn/tường</span>
                  <InfoPopover title="Quy tắc tính chỉ số E2" size="sm">
                    <p><strong>Nguồn:</strong> Cờ kết cấu ở Bước 4 và Ý nghĩa kết cấu của từng vết nứt D-xx ở Bước 3.3.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Max(Cờ KC, Vết nứt): None: 0đ; Low: 1đ; Moderate: 2đ; High: 3đ; Critical: 4đ.</p>
                  </InfoPopover>
                </td>
                <td className="p-2.5 text-center text-slate-500">Không</td>
                <td className="p-2.5 text-center text-slate-500">Low</td>
                <td className="p-2.5 text-center text-slate-500">Moderate</td>
                <td className="p-2.5 text-center text-slate-500">High=3đ; Crit=4đ</td>
                <td className="p-2.5 text-center font-bold text-emerald-700 bg-emerald-50/50">{ecs.e2}</td>
              </tr>

              {/* E3 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">E3</td>
                <td className="p-2.5 font-medium flex items-center justify-between">
                  <span>Lún/nghiêng/võng/biến dạng</span>
                  <InfoPopover title="Quy tắc tính chỉ số E3" size="sm">
                    <p><strong>Nguồn:</strong> Level Lún chênh & Độ nghiêng ở Bước 1 + Level Võng dầm/sàn ở Bước 5.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Max(Level Lún, Level Nghiêng, Level Võng) (0 đến 4đ).</p>
                  </InfoPopover>
                </td>
                <td className="p-2.5 text-center text-slate-500">Không</td>
                <td className="p-2.5 text-center text-slate-500">Nghi ngờ/nhẹ</td>
                <td className="p-2.5 text-center text-slate-500">Rõ ổn định</td>
                <td className="p-2.5 text-center text-slate-500">Tiến triển=3-4đ</td>
                <td className="p-2.5 text-center font-bold text-emerald-700 bg-emerald-50/50">{ecs.e3}</td>
              </tr>

              {/* E4 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">E4</td>
                <td className="p-2.5 font-medium flex items-center justify-between">
                  <span>Suy giảm vật liệu/độ bền</span>
                  <InfoPopover title="Quy tắc tính chỉ số E4" size="sm">
                    <p><strong>Nguồn:</strong> Trường Mức độ suy giảm vật liệu của toàn bộ Defect D-xx ở Bước 3.3.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Max(Suy giảm D-xx): Không: 0đ; Cục bộ: 1đ; Đáng kể: 2đ; Nặng/lộ thép: 3đ; Ảnh hưởng chịu lực: 4đ.</p>
                  </InfoPopover>
                </td>
                <td className="p-2.5 text-center text-slate-500">Không/nhẹ</td>
                <td className="p-2.5 text-center text-slate-500">Cục bộ</td>
                <td className="p-2.5 text-center text-slate-500">Đáng kể</td>
                <td className="p-2.5 text-center text-slate-500">Nặng/Chịu lực=3-4đ</td>
                <td className="p-2.5 text-center font-bold text-emerald-700 bg-emerald-50/50">{ecs.e4}</td>
              </tr>

              {/* E5 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">E5</td>
                <td className="p-2.5 font-medium flex items-center justify-between">
                  <span>Lịch sử/cơi nới/sự cố & toàn vẹn</span>
                  <InfoPopover title="Quy tắc tính chỉ số E5 & Cộng hưởng rủi ro" size="sm">
                    <p><strong>Nguồn:</strong> 5 câu hỏi phỏng vấn lịch sử ở Bước 2.2.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Max điểm 5 câu. Nếu có từ 2 yếu tố cùng lớn hơn 2 và bằng nhau (cùng 3đ) thì kích hoạt cộng hưởng E5 = 4đ.</p>
                  </InfoPopover>
                </td>
                <td className="p-2.5 text-center text-slate-500">Không</td>
                <td className="p-2.5 text-center text-slate-500">Nhẹ/Đã xử lý</td>
                <td className="p-2.5 text-center text-slate-500">Nhiều/Chưa rõ</td>
                <td className="p-2.5 text-center text-slate-500">Lớn/Sự cố=3-4đ</td>
                <td className="p-2.5 text-center font-bold text-emerald-700 bg-emerald-50/50">{ecs.e5}</td>
              </tr>

              {/* E6 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">E6</td>
                <td className="p-2.5 font-medium flex items-center justify-between">
                  <span>Tình trạng chức năng/tổng thể</span>
                  <InfoPopover title="Quy tắc tính chỉ số E6" size="sm">
                    <p><strong>Nguồn:</strong> Khuyết tật Thấm dột (1-4đ), Kẹt cửa (1-4đ) ở Bước 3.3 và Vùng cần sửa chữa ở Bước 3.2.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Max(Thấm dột, Kẹt cửa, Sửa chữa Vùng Z) (0 đến 4đ).</p>
                  </InfoPopover>
                </td>
                <td className="p-2.5 text-center text-slate-500">Tốt</td>
                <td className="p-2.5 text-center text-slate-500">TB</td>
                <td className="p-2.5 text-center text-slate-500">Kém</td>
                <td className="p-2.5 text-center text-slate-500">Nguy cấp=4đ</td>
                <td className="p-2.5 text-center font-bold text-emerald-700 bg-emerald-50/50">{ecs.e6}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Can thiệp của Kỹ sư ECS */}
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
            label="Lý do can thiệp kỹ sư (ECS)"
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
          <div className="mt-2 text-xs text-red-600 font-semibold flex items-center gap-1.5 p-2 bg-red-50 rounded-lg border border-red-200">
            <Lock className="w-4 h-4 flex-shrink-0" />
            <span>Khóa an toàn ECS Override: Do E2 ≥ 3 hoặc E3 ≥ 3 (Critical structural issue), không thể hạ ECS chỉ vì Burland thấp.</span>
          </div>
        )}
      </Card>

      {/* 3. BẢNG 13: VI - VULNERABILITY INDEX */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                7.2. Bảng Chỉ Số Dễ Tổn Thương VI (13. VI – VULNERABILITY INDEX)
              </h2>
              <p className="text-xs text-slate-500 italic">
                Phản ánh độ nhạy cảm của công trình trước các tác động lún/rung do thi công ngầm Metro (Thang 1 đến 4).
              </p>
            </div>
          </div>
          <Badge variant="purple">
            Điểm TB: {vi.viAvg} ({vi.viClass})
          </Badge>
        </div>

        {/* Summary Badges VI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          <div className="p-2.5 rounded-lg bg-purple-50/50 border border-purple-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Tổng Điểm VI</span>
            <span className="text-base font-black text-purple-700">{vi.totalVi} / 24</span>
          </div>

          <div className="p-2.5 rounded-lg bg-purple-50/50 border border-purple-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Điểm Trung Bình (V_avg)</span>
            <span className="text-base font-black text-purple-800">{vi.viAvg}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-purple-50/50 border border-purple-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Phân Hạng VI Class</span>
            <span className="text-base font-black text-purple-900">{vi.viClass}</span>
          </div>
        </div>

        {/* Bảng ma trận 6x5 VI - Gọn gàng */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl mb-4">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5 w-12 text-center">Mã</th>
                <th className="p-2.5 min-w-[200px]">Tiêu chí đánh giá</th>
                <th className="p-2.5 text-center">1đ</th>
                <th className="p-2.5 text-center">2đ</th>
                <th className="p-2.5 text-center">3đ</th>
                <th className="p-2.5 text-center">4đ</th>
                <th className="p-2.5 w-16 text-center">Điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* V1 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">V1</td>
                <td className="p-2.5 font-medium flex items-center justify-between">
                  <span>Công năng & Quy mô</span>
                  <InfoPopover title="Quy tắc tính chỉ số V1" size="sm">
                    <p><strong>Nguồn:</strong> Nhóm đối tượng công trình ở Bước 1.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> General: 1đ; Important: 2đ; Critical: 4đ.</p>
                  </InfoPopover>
                </td>
                <td className="p-2.5 text-center text-slate-500">General (1)</td>
                <td className="p-2.5 text-center text-slate-500">Important (2)</td>
                <td className="p-2.5 text-center text-slate-500">—</td>
                <td className="p-2.5 text-center text-slate-500">Critical (4)</td>
                <td className="p-2.5 text-center font-bold text-purple-700 bg-purple-50/50">{vi.v1}</td>
              </tr>

              {/* V2 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">V2</td>
                <td className="p-2.5 font-medium flex items-center justify-between">
                  <span>Hệ kết cấu chịu lực</span>
                  <InfoPopover title="Quy tắc tính chỉ số V2" size="sm">
                    <p><strong>Nguồn:</strong> Hệ kết cấu chịu lực ở Bước 2.1.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Khung BTCT toàn khối: 1đ; Khung BTCT + gạch: 2đ; Tường gạch chịu lực: 3đ; Kém ổn định: 4đ.</p>
                  </InfoPopover>
                </td>
                <td className="p-2.5 text-center text-slate-500">BTCT toàn khối</td>
                <td className="p-2.5 text-center text-slate-500">BTCT + tường gạch</td>
                <td className="p-2.5 text-center text-slate-500">Tường gạch/thép cũ</td>
                <td className="p-2.5 text-center text-slate-500">Kém ổn định</td>
                <td className="p-2.5 text-center font-bold text-purple-700 bg-purple-50/50">{vi.v2}</td>
              </tr>

              {/* V3 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">V3</td>
                <td className="p-2.5 font-medium flex items-center justify-between">
                  <span>Loại móng & Nền đất</span>
                  <InfoPopover title="Quy tắc tính chỉ số V3" size="sm">
                    <p><strong>Nguồn:</strong> Điểm CAT móng ở Bước 2.1.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Cat 1-2: 1đ; Cat 3: 2đ; Cat 4: 3đ; Cat 5: 4đ.</p>
                  </InfoPopover>
                </td>
                <td className="p-2.5 text-center text-slate-500">Cat 1–2 (Bản vẽ)</td>
                <td className="p-2.5 text-center text-slate-500">Cat 3 (Phỏng vấn)</td>
                <td className="p-2.5 text-center text-slate-500">Cat 4 (Suy luận)</td>
                <td className="p-2.5 text-center text-slate-500">Cat 5 (Không rõ)</td>
                <td className="p-2.5 text-center font-bold text-purple-700 bg-purple-50/50">{vi.v3}</td>
              </tr>

              {/* V4 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">V4</td>
                <td className="p-2.5 font-medium flex items-center justify-between">
                  <span>Tuổi đời / Cơi nới</span>
                  <InfoPopover title="Quy tắc tính chỉ số V4" size="sm">
                    <p><strong>Nguồn:</strong> Năm xây dựng ở Bước 2.1 & Cơi nới ở Bước 2.2.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Dưới 10 năm: 1đ; 10-25 năm: 2đ; 25-40 năm: 3đ; Trên 40 năm hoặc cơi nới nặng: 4đ.</p>
                  </InfoPopover>
                </td>
                <td className="p-2.5 text-center text-slate-500">&lt; 10 năm</td>
                <td className="p-2.5 text-center text-slate-500">10–25 năm</td>
                <td className="p-2.5 text-center text-slate-500">25–40 năm</td>
                <td className="p-2.5 text-center text-slate-500">&gt; 40n / Cơi nới</td>
                <td className="p-2.5 text-center font-bold text-purple-700 bg-purple-50/50">{vi.v4}</td>
              </tr>

              {/* V5 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">V5</td>
                <td className="p-2.5 font-medium flex items-center justify-between">
                  <span>Hiện trạng kỹ thuật ECS</span>
                  <InfoPopover title="Quy tắc tính chỉ số V5" size="sm">
                    <p><strong>Nguồn:</strong> Phân hạng ECS Class ở Mục 7.1.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Good: 1đ; Medium: 2đ; Deficient: 3đ; Critical: 4đ.</p>
                  </InfoPopover>
                </td>
                <td className="p-2.5 text-center text-slate-500">ECS Good</td>
                <td className="p-2.5 text-center text-slate-500">ECS Medium</td>
                <td className="p-2.5 text-center text-slate-500">ECS Deficient</td>
                <td className="p-2.5 text-center text-slate-500">ECS Critical</td>
                <td className="p-2.5 text-center font-bold text-purple-700 bg-purple-50/50">{vi.v5}</td>
              </tr>

              {/* V6 */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-2.5 text-center font-bold">V6</td>
                <td className="p-2.5 font-medium flex items-center justify-between">
                  <span>Thiết bị nhạy cảm</span>
                  <InfoPopover title="Quy tắc tính chỉ số V6" size="sm">
                    <p><strong>Nguồn:</strong> Câu hỏi thiết bị nhạy cảm ở Bước 2.2.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Không có: 1đ; Dân dụng: 2đ; Văn phòng/Kinh doanh: 3đ; Y tế/Thí nghiệm: 4đ.</p>
                  </InfoPopover>
                </td>
                <td className="p-2.5 text-center text-slate-500">Không có</td>
                <td className="p-2.5 text-center text-slate-500">Dân dụng</td>
                <td className="p-2.5 text-center text-slate-500">VP / KD</td>
                <td className="p-2.5 text-center text-slate-500">Y tế / TN</td>
                <td className="p-2.5 text-center font-bold text-purple-700 bg-purple-50/50">{vi.v6}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Can thiệp của Kỹ sư VI */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <Select
            label="Quyền Can Thiệp Của Kỹ Sư (Engineering Judgement VI)"
            value={vi.engineeringJudgement?.action || 'KEEP'}
            onChange={(e) =>
              updateFormData({
                vi: {
                  ...vi,
                  engineeringJudgement: {
                    ...vi.engineeringJudgement,
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
            label="Lý do can thiệp kỹ sư (VI)"
            placeholder="Nhập lý do kỹ thuật nếu thay đổi hạng VI..."
            value={vi.engineeringJudgement?.reason || ''}
            onChange={(e) =>
              updateFormData({
                vi: {
                  ...vi,
                  engineeringJudgement: {
                    ...vi.engineeringJudgement,
                    reason: e.target.value,
                  },
                },
              })
            }
          />
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
