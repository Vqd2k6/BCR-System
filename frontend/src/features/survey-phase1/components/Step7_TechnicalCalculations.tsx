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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs mb-4">
          <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-500 font-medium">1. Thông tin móng</span>
              <InfoPopover title="Tiêu chí 1: Thông tin móng công trình" size="sm">
                <p><strong>Nguồn:</strong> Cấp độ tin cậy kết cấu móng (CAT 1 - CAT 5) khảo sát ở Bước 2.1.</p>
                <p className="mt-1"><strong>Điều kiện đạt:</strong> Điểm CAT ≥ 1 (có thông tin móng từ bản vẽ, phỏng vấn hoặc suy luận).</p>
                <p className="mt-1"><strong>Điểm số hiện tại:</strong> CAT {gateResult.foundationInfo.score}/5.</p>
              </InfoPopover>
            </div>
            <span className="font-bold text-slate-800">{gateResult.foundationInfo.label}</span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-500 font-medium">2. Khảo sát hiện trạng chi tiết</span>
              <InfoPopover title="Tiêu chí 2: Khảo sát hiện trạng chi tiết (Z & E)" size="sm">
                <p><strong>Nguồn:</strong> Dữ liệu Vùng kiến trúc Z (Mục 3.1) và Cấu kiện kết cấu E (Mục 3.2).</p>
                <p className="mt-1"><strong>Quy chuẩn:</strong> Tách biệt số lượng Vùng Z (vết nứt hoàn thiện kiến trúc) và Cấu kiện E (khuyết tật kết cấu chịu lực).</p>
                <p className="mt-1"><strong>Điều kiện đạt:</strong> Chụp đủ ảnh mặt đứng P01, P02, P04 và có ít nhất 1 Vùng Z được tạo.</p>
              </InfoPopover>
            </div>
            <div>
              <span className="font-bold text-slate-800 block text-xs">{gateResult.photoMapping.label}</span>
              <span className="text-[11px] text-slate-600 block mt-0.5 leading-snug">
                {gateResult.photoMapping.details}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-500 font-medium">3. Khảo sát bên trong</span>
              <InfoPopover title="Tiêu chí 3: Khảo sát bên trong & Hạn chế tiếp cận" size="sm">
                <p><strong>Nguồn:</strong> Tình trạng tiếp cận công trình ghi nhận ở Bước 5.2.</p>
                <p className="mt-1"><strong>Quy chuẩn:</strong> Đạt khi tiếp cận được 100% các phòng/tầng. Nếu bị khóa cửa hoặc chủ nhà không cho vào (LIMITED), hệ thống xếp vào diện "Có điều kiện" và yêu cầu biên bản hiện trường.</p>
              </InfoPopover>
            </div>
            <span className="font-bold text-slate-800">{gateResult.internalAccess.label}</span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-500 font-medium">4. Dữ liệu lún nghiêng</span>
              <InfoPopover title="Tiêu chí 4: Hiện trạng lún nghiêng & Quan trắc" size="sm">
                <p><strong>Nguồn:</strong> Khảo sát lún chênh, độ nghiêng nhà (Bước 1) và võng dầm/sàn (Bước 3.3).</p>
                <p className="mt-1"><strong>Quy chuẩn:</strong> Đạt khi hiện trạng không cần lắp mốc đo đạc chuyên sâu. Nếu surveyor yêu cầu đo bổ sung, hệ thống sẽ lưu ý kiểm toán chu kỳ.</p>
              </InfoPopover>
            </div>
            <span className="font-bold text-slate-800">{gateResult.settlementData.label}</span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-500 font-medium">5. Hồ sơ / Bản vẽ</span>
              <InfoPopover title="Tiêu chí 5: Hồ sơ hoàn công & Bản vẽ kỹ thuật" size="md">
                <p><strong>Nguồn:</strong> Tệp hồ sơ, bản vẽ kỹ thuật tải lên ở danh mục đính kèm (Bước 1 hoặc hồ sơ công trình).</p>
                <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                  <p className="font-bold text-slate-800 mb-1">Các giá trị có thể xuất hiện & Ý nghĩa kỹ thuật/pháp lý:</p>
                  <ul className="space-y-1.5 pl-1 text-slate-600">
                    <li>
                      <span className="font-semibold text-emerald-700">● &quot;Có bản vẽ&quot; (Đạt):</span> Đã thu thập được bản vẽ hoàn công, bản vẽ thiết kế kết cấu hoặc bản vẽ cấp phép. <em>Ý nghĩa:</em> Đảm bảo căn cứ pháp lý và dữ liệu đối chiếu chuẩn xác nhất về kích thước, cốt móng, dầm sàn ban đầu nhằm bảo vệ quyền lợi dự án và chủ sở hữu nếu có tranh chấp nứt lún khi thi công metro.
                    </li>
                    <li>
                      <span className="font-semibold text-amber-700">● &quot;Không có / Một phần&quot; (Chưa đạt):</span> Chưa tải lên tệp bản vẽ kỹ thuật nào. <em>Ý nghĩa:</em> Hồ sơ sẽ chuyển sang diện <strong>&quot;Có điều kiện (CONDITIONAL)&quot;</strong>, tiềm ẩn rủi ro tranh chấp do chỉ đánh giá được phần lộ thiên, không kiểm chứng được cốt thép hoặc móng ngầm.
                    </li>
                  </ul>
                </div>
              </InfoPopover>
            </div>
            <span className="font-bold text-slate-800">{gateResult.asBuiltDrawings.label}</span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-500 font-medium">6. Structural Review</span>
              <InfoPopover title="Tiêu chí 6: Thẩm tra chuyên sâu Kỹ sư kết cấu (Structural Review)" size="md">
                <p><strong>Nguồn:</strong> Tự động phân tích từ chỉ số khuyết tật chịu lực E2 và Cờ kết cấu ở Bước 4 (Burland Summary).</p>
                <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                  <p className="font-bold text-slate-800 mb-1">Các giá trị có thể xuất hiện & Ý nghĩa kỹ thuật/an toàn:</p>
                  <ul className="space-y-1.5 pl-1 text-slate-600">
                    <li>
                      <span className="font-semibold text-emerald-700">● &quot;Đủ điều kiện&quot; (SUFFICIENT):</span> Khi E2 &lt; 3 và Cờ kết cấu ở mức None hoặc Low/Moderate. <em>Ý nghĩa:</em> Kết cấu chịu lực chính (cột, dầm, sàn) an toàn, không có vết nứt phá hoại nguy cấp; khảo sát viên được phép nghiệm thu chuyển tiếp bình thường.
                    </li>
                    <li>
                      <span className="font-semibold text-red-600">● &quot;⚠️ Cần Kỹ sư kết cấu Review (E2 &gt;= 3 / Cờ đỏ)&quot; (PENDING_REVIEW):</span> Tự động kích hoạt khi E2 ≥ 3 hoặc Cờ kết cấu ở mức HIGH/CRITICAL (ví dụ nứt xiên cắt cột, võng dầm lớn, rỉ đứt cốt thép). <em>Ý nghĩa:</em> Cảnh báo nguy cơ mất ổn định kết cấu nghiêm trọng. Hệ thống chuyển trạng thái cổng sang <strong>&quot;PENDING / CẦN XEM XÉT&quot;</strong>, bắt buộc Kỹ sư kết cấu chuyên môn cao phải vào đánh giá hiện trường và phê duyệt trước khi máy đào hầm Metro đi qua.
                    </li>
                  </ul>
                </div>
              </InfoPopover>
            </div>
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
                  <InfoPopover title="Quy tắc tính chỉ số E1" size="md">
                    <p><strong>Nguồn:</strong> Lấy Burland Grade lớn nhất từ các Vùng Z ở Bước 3 và Bước 4.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> B ≤ 1: 0đ; B = 2: 1đ; B = 3: 2đ; B = 4: 3đ; B = 5: 4đ.</p>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                      <strong className="text-slate-800 block mb-1">🔍 Chi tiết cách thức tính điểm:</strong>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-slate-600">
                        <li><strong>0 điểm (Burland 0–1):</strong> Không có vết nứt hoặc chỉ có vết nứt tóc siêu nhỏ (&lt; 0.1mm), không ảnh hưởng thẩm mỹ.</li>
                        <li><strong>1 điểm (Burland 2):</strong> Nứt nhẹ dễ sửa chữa (1–5mm), trám vá sơn lại bình thường.</li>
                        <li><strong>2 điểm (Burland 3):</strong> Nứt trung bình (5–15mm), cửa đi/sổ có thể kẹt nhẹ, cần thợ xây trát dặm vá lại.</li>
                        <li><strong>3 điểm (Burland 4):</strong> Nứt nặng (15–25mm), vết nứt xuyên tường gạch, lệch mặt phẳng tường, cần đục xây lại một phần.</li>
                        <li><strong>4 điểm (Burland 5):</strong> Hư hỏng kết cấu gạch rất nặng (&gt; 25mm), nguy cơ sập đổ tường/mái, cần chống đỡ khẩn cấp.</li>
                      </ul>
                    </div>
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
                  <InfoPopover title="Quy tắc tính chỉ số E2" size="md">
                    <p><strong>Nguồn:</strong> Cờ kết cấu ở Bước 4 và Ý nghĩa kết cấu của từng vết nứt D-xx ở Bước 3.3.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Max(Cờ KC, Vết nứt): None: 0đ; Low: 1đ; Moderate: 2đ; High: 3đ; Critical: 4đ.</p>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                      <strong className="text-slate-800 block mb-1">🔍 Chi tiết cách thức tính điểm:</strong>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-slate-600">
                        <li><strong>0 điểm (Không):</strong> Cột, dầm, sàn nguyên vẹn, không có vết nứt chịu lực.</li>
                        <li><strong>1 điểm (Low):</strong> Nứt vi mô bề mặt bê tông do co ngót, nứt không nằm trong vùng chịu cắt/nén cao.</li>
                        <li><strong>2 điểm (Moderate):</strong> Nứt rõ ở cấu kiện chịu lực nhưng bề rộng ổn định, chưa gây suy giảm sức kháng uốn/cắt.</li>
                        <li><strong>3 điểm (High):</strong> Nứt chéo xiên 45° gần gối tựa dầm/cột hoặc nứt vùng nén bê tông (Tự động kích hoạt Review kết cấu).</li>
                        <li><strong>4 điểm (Critical):</strong> Bê tông bị vỡ vụn, phồng rộp nén, cốt thép đứt hoặc biến dạng cong vênh (Báo động nguy cấp).</li>
                      </ul>
                    </div>
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
                  <InfoPopover title="Quy tắc tính chỉ số E3" size="md">
                    <p><strong>Nguồn:</strong> Level Lún chênh & Độ nghiêng ở Bước 1 + Level Võng dầm/sàn ở Bước 5.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Max(Level Lún, Level Nghiêng, Level Võng) (0 đến 4đ).</p>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                      <strong className="text-slate-800 block mb-1">🔍 Chi tiết cách thức tính điểm:</strong>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-slate-600">
                        <li><strong>0 điểm (Không):</strong> Không có dấu hiệu lún lệch, độ nghiêng &lt; 1/500, dầm sàn võng trong hạn mức tiêu chuẩn.</li>
                        <li><strong>1 điểm (Nghi ngờ/nhẹ):</strong> Độ nghiêng từ 1/500 đến 1/300 hoặc nghi ngờ lún nhẹ cảm quan không đều.</li>
                        <li><strong>2 điểm (Rõ ổn định):</strong> Lún lệch hoặc độ nghiêng 1/300 đến 1/150 nhưng đã ổn định lâu năm, không phát sinh nứt mới.</li>
                        <li><strong>3 điểm (Tiến triển):</strong> Độ nghiêng &gt; 1/150, lún chênh tiếp tục phát triển, xuất hiện kẹt cửa hàng loạt hoặc võng dầm thấy rõ.</li>
                        <li><strong>4 điểm (Nguy cấp):</strong> Độ nghiêng vượt giới hạn an toàn (&gt; 1/100), công trình có nguy cơ mất ổn định lật đổ khi chịu rung chấn ngầm.</li>
                      </ul>
                    </div>
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
                  <InfoPopover title="Quy tắc tính chỉ số E4" size="md">
                    <p><strong>Nguồn:</strong> Trường Mức độ suy giảm vật liệu của toàn bộ Defect D-xx ở Bước 3.3.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Max(Suy giảm D-xx): Không: 0đ; Cục bộ: 1đ; Đáng kể: 2đ; Nặng/lộ thép: 3đ; Ảnh hưởng chịu lực: 4đ.</p>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                      <strong className="text-slate-800 block mb-1">🔍 Chi tiết cách thức tính điểm:</strong>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-slate-600">
                        <li><strong>0 điểm (Không/nhẹ):</strong> Bê tông và gạch xây còn chắc đặc, không bị phong hóa.</li>
                        <li><strong>1 điểm (Cục bộ):</strong> Bong tróc nhẹ lớp sơn hoặc vữa trát bề mặt một vài vị trí nhỏ.</li>
                        <li><strong>2 điểm (Đáng kể):</strong> Rỗ tổ ong bê tông, ẩm mốc mục vữa diện rộng, phong hóa mặt gạch nhưng chưa lộ thép.</li>
                        <li><strong>3 điểm (Nặng/lộ thép):</strong> Bê tông nứt tách lớp làm lộ thanh thép rỉ sét, giảm tiết diện danh định của thanh thép.</li>
                        <li><strong>4 điểm (Ảnh hưởng chịu lực):</strong> Cốt thép bị ăn mòn đứt gãy từng phần, bê tông mục nát mất liên kết chịu lực nghiêm trọng.</li>
                      </ul>
                    </div>
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
                  <InfoPopover title="Quy tắc tính chỉ số E5 & Cộng hưởng rủi ro" size="md">
                    <p><strong>Nguồn:</strong> 5 câu hỏi phỏng vấn lịch sử ở Bước 2.2.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Max điểm 5 câu. Nếu có từ 2 yếu tố cùng lớn hơn 2 và bằng nhau (cùng 3đ) thì kích hoạt cộng hưởng E5 = 4đ.</p>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                      <strong className="text-slate-800 block mb-1">🔍 Chi tiết cách thức tính điểm:</strong>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-slate-600">
                        <li><strong>0 điểm:</strong> Công trình nguyên bản, không cơi nới, không có tiền sử sự cố.</li>
                        <li><strong>1 điểm:</strong> Cải tạo nội thất nhẹ hoặc cơi nới nhỏ có kiểm soát kỹ thuật.</li>
                        <li><strong>2 điểm:</strong> Đã nâng thêm 1 tầng nhẹ hoặc từng ngập nước cục bộ nhưng đã gia cố ổn định.</li>
                        <li><strong>3 điểm:</strong> Nâng từ 2 tầng trở lên không rõ hồ sơ móng, hoặc từng bị nứt lún rõ rệt do công trình lân cận thi công.</li>
                        <li><strong>4 điểm (Cộng hưởng):</strong> Có từ 2 yếu tố rủi ro nặng cùng đạt 3đ (vừa cơi nới vừa từng lún nứt) hoặc từng gặp sự cố cháy nổ/chấn động làm suy giảm tính toàn vẹn kết cấu.</li>
                      </ul>
                    </div>
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
                  <InfoPopover title="Quy tắc tính chỉ số E6" size="md">
                    <p><strong>Nguồn:</strong> Khuyết tật Thấm dột (1-4đ), Kẹt cửa (1-4đ) ở Bước 3.3 và Vùng cần sửa chữa ở Bước 3.2.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Max(Thấm dột, Kẹt cửa, Sửa chữa Vùng Z) (0 đến 4đ).</p>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                      <strong className="text-slate-800 block mb-1">🔍 Chi tiết cách thức tính điểm:</strong>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-slate-600">
                        <li><strong>0 điểm (Tốt):</strong> Mọi công năng sử dụng bình thường, không thấm ẩm, cửa đóng mở trơn tru.</li>
                        <li><strong>1 điểm (Khá/TB nhẹ):</strong> Ẩm chân tường nhẹ cục bộ hoặc có 1–2 vùng nhỏ cần dặm vá.</li>
                        <li><strong>2 điểm (Trung bình):</strong> Thấm dột mái/sàn vệ sinh rõ rệt, kẹt 1–2 bộ cửa do biến dạng khuôn, hoặc 3–4 vùng cần sửa chữa.</li>
                        <li><strong>3 điểm (Kém):</strong> Thấm dột chảy thành dòng, kẹt nhiều cửa chính/cửa sổ không đóng mở được, trên 4 vùng hư hỏng.</li>
                        <li><strong>4 điểm (Nguy cấp):</strong> Mất an toàn công năng toàn diện (nguy cơ chập cháy điện do ngấm nước hoặc biến dạng hình học cản trở thoát nạn khẩn cấp).</li>
                      </ul>
                    </div>
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
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          <Select
            id="select-ecs-action"
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

          {ecs.engineeringJudgement.action !== 'KEEP' && (
            <div>
              <Input
                id="input-ecs-reason"
                label="Lý do can thiệp kỹ sư (ECS) * Bắt buộc"
                placeholder="Bắt buộc: Nhập căn cứ kỹ thuật giải trình việc nâng/hạ hạng..."
                required
                value={ecs.engineeringJudgement.reason}
                error={
                  !ecs.engineeringJudgement.reason?.trim()
                    ? 'Bắt buộc nhập lý do kỹ thuật khi can thiệp thay đổi hạng ECS'
                    : undefined
                }
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
              {!ecs.engineeringJudgement.reason?.trim() && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">
                  ⚠️ Bắt buộc phải có lý do kỹ thuật để làm cơ sở bảo vệ quyết định điều chỉnh hạng ECS.
                </p>
              )}
            </div>
          )}
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
                  <InfoPopover title="Quy tắc tính chỉ số V1" size="md">
                    <p><strong>Nguồn:</strong> Nhóm đối tượng công trình ở Bước 1.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> General: 1đ; Important: 2đ; Critical: 4đ.</p>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                      <strong className="text-slate-800 block mb-1">🔍 Chi tiết cách thức tính điểm:</strong>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-slate-600">
                        <li><strong>1 điểm (General):</strong> Nhà ở riêng lẻ dân dụng thông thường, quy mô 1–3 tầng, mức độ rủi ro cộng đồng thấp.</li>
                        <li><strong>2 điểm (Important):</strong> Nhà phố kết hợp kinh doanh đông người, trường mầm non, chung cư mini, khách sạn mini (4–7 tầng).</li>
                        <li><strong>4 điểm (Critical):</strong> Bệnh viện, trường học lớn, di sản văn hóa/kiến trúc cổ, trụ sở cơ quan trọng yếu, công trình tập trung rất đông người.</li>
                      </ul>
                    </div>
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
                  <InfoPopover title="Quy tắc tính chỉ số V2" size="md">
                    <p><strong>Nguồn:</strong> Hệ kết cấu chịu lực ở Bước 2.1.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Khung BTCT toàn khối: 1đ; Khung BTCT + gạch: 2đ; Tường gạch chịu lực: 3đ; Kém ổn định: 4đ.</p>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                      <strong className="text-slate-800 block mb-1">🔍 Chi tiết cách thức tính điểm:</strong>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-slate-600">
                        <li><strong>1 điểm:</strong> Khung bê tông cốt thép toàn khối (độ dẻo dai cao, phân phối lại ứng suất tốt khi rung chấn).</li>
                        <li><strong>2 điểm:</strong> Khung BTCT kết hợp tường chèn gạch hoặc hệ kết cấu hỗn hợp thông thường.</li>
                        <li><strong>3 điểm:</strong> Tường gạch chịu lực không có khung bê tông (nhà xây gạch cũ, giòn và rất nhạy cảm với lún chênh).</li>
                        <li><strong>4 điểm:</strong> Kết cấu kém ổn định (kèo gỗ mục, tường gạch vôi cũ, kết cấu tạm, lắp ghép lỏng lẻo dễ sụp đổ khi rung chấn).</li>
                      </ul>
                    </div>
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
                  <InfoPopover title="Quy tắc tính chỉ số V3" size="md">
                    <p><strong>Nguồn:</strong> Điểm CAT móng ở Bước 2.1.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Cat 1-2: 1đ; Cat 3: 2đ; Cat 4: 3đ; Cat 5: 4đ.</p>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                      <strong className="text-slate-800 block mb-1">🔍 Chi tiết cách thức tính điểm:</strong>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-slate-600">
                        <li><strong>1 điểm (Cat 1–2):</strong> Móng cọc sâu tựa vào tầng địa chất tốt (có bản vẽ hoàn công/nhật ký ép cọc xác minh), ít bị ảnh hưởng bởi hạ mực nước ngầm.</li>
                        <li><strong>2 điểm (Cat 3):</strong> Móng băng hoặc móng cọc nhưng thông tin chỉ thu thập qua phỏng vấn chủ nhà/thợ xây.</li>
                        <li><strong>3 điểm (Cat 4):</strong> Móng nông (móng đơn, móng gạch, móng bè nông) trên nền đất yếu/cừ tràm, suy luận theo tập quán địa phương.</li>
                        <li><strong>4 điểm (Cat 5):</strong> Không rõ loại móng trên nền đất bùn sét yếu, cực kỳ nhạy cảm với sự dịch chuyển đất khi đào hầm TBM.</li>
                      </ul>
                    </div>
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
                  <InfoPopover title="Quy tắc tính chỉ số V4" size="md">
                    <p><strong>Nguồn:</strong> Năm xây dựng ở Bước 2.1 & Cơi nới ở Bước 2.2.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Dưới 10 năm: 1đ; 10-25 năm: 2đ; 25-40 năm: 3đ; Trên 40 năm hoặc cơi nới nặng: 4đ.</p>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                      <strong className="text-slate-800 block mb-1">🔍 Chi tiết cách thức tính điểm:</strong>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-slate-600">
                        <li><strong>1 điểm:</strong> Nhà mới xây (&lt; 10 năm), vật liệu còn nguyên cường độ thiết kế ban đầu.</li>
                        <li><strong>2 điểm:</strong> Tuổi đời 10–25 năm, bắt đầu có sự lão hóa nhẹ vật liệu nhưng kết cấu vẫn ổn định.</li>
                        <li><strong>3 điểm:</strong> Tuổi đời 25–40 năm, bê tông bị cacbonat hóa, độ dẻo dai suy giảm theo thời gian.</li>
                        <li><strong>4 điểm:</strong> Tuổi đời &gt; 40 năm HOẶC công trình đã từng nâng thêm tầng/tăng tải trọng nặng (dự trữ chịu lực suy kiệt).</li>
                      </ul>
                    </div>
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
                  <InfoPopover title="Quy tắc tính chỉ số V5" size="md">
                    <p><strong>Nguồn:</strong> Phân hạng ECS Class ở Mục 7.1.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Good: 1đ; Medium: 2đ; Deficient: 3đ; Critical: 4đ.</p>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                      <strong className="text-slate-800 block mb-1">🔍 Chi tiết cách thức tính điểm:</strong>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-slate-600">
                        <li><strong>1 điểm (ECS Good):</strong> Điểm ECS 0–5, công trình ở trạng thái tốt, không có khuyết tật kết cấu hoặc biến dạng.</li>
                        <li><strong>2 điểm (ECS Medium):</strong> Điểm ECS 6–10, tình trạng trung bình, có một số khuyết tật nứt hoàn thiện hoặc suy giảm vật liệu nhẹ.</li>
                        <li><strong>3 điểm (ECS Deficient):</strong> Điểm ECS 11–16, công trình xuống cấp, xuất hiện khuyết tật kết cấu hoặc lún nghiêng đáng kể.</li>
                        <li><strong>4 điểm (ECS Critical):</strong> Điểm ECS 17–24, hiện trạng nguy cấp, công trình đã bị tổn thương nghiêm trọng trước thi công metro.</li>
                      </ul>
                    </div>
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
                  <InfoPopover title="Quy tắc tính chỉ số V6" size="md">
                    <p><strong>Nguồn:</strong> Câu hỏi thiết bị nhạy cảm ở Bước 2.2.</p>
                    <p className="mt-1"><strong>Quy tắc:</strong> Không có: 1đ; Dân dụng: 2đ; Văn phòng/Kinh doanh: 3đ; Y tế/Thí nghiệm: 4đ.</p>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                      <strong className="text-slate-800 block mb-1">🔍 Chi tiết cách thức tính điểm:</strong>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-slate-600">
                        <li><strong>1 điểm (Không có):</strong> Nhà ở thông thường, không có thiết bị điện tử chính xác hay máy móc đặc biệt.</li>
                        <li><strong>2 điểm (Dân dụng):</strong> Thiết bị gia dụng thông thường (tivi, tủ lạnh, máy giặt, điều hòa không khí).</li>
                        <li><strong>3 điểm (VP / KD):</strong> Thiết bị văn phòng, máy chủ server, máy in ấn công nghiệp, thiết bị gia công cơ khí nhạy rung.</li>
                        <li><strong>4 điểm (Y tế / TN):</strong> Thiết bị y tế chẩn đoán chính xác cao (MRI, CT, X-quang, phòng mổ), phòng lab hoặc vận hành liên tục 24/7.</li>
                      </ul>
                    </div>
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
            id="select-vi-action"
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

          {(vi.engineeringJudgement?.action && vi.engineeringJudgement.action !== 'KEEP') && (
            <Input
              id="input-vi-reason"
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
          )}
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={prevStep}>
          ⬅️ Quay lại Bước 5
        </Button>
        <Button
          onClick={() => {
            if (ecs.engineeringJudgement.action !== 'KEEP' && !ecs.engineeringJudgement.reason?.trim()) {
              alert('⚠️ Bắt buộc phải nhập Lý do can thiệp kỹ sư (ECS) khi lựa chọn Nâng hoặc Hạ hạng!');
              const el = document.getElementById('input-ecs-reason');
              if (el) el.focus();
              return;
            }
            nextStep();
          }}
        >
          Tiếp tục: Bước 7 (Dashboard Tổng Hợp) ➔
        </Button>
      </div>
    </div>
  );
};
