import React from 'react';
import { CheckSquare, Square, AlertCircle, FileCheck, FileSignature } from 'lucide-react';
import type { EditFormData } from '../../../types';

interface RiskAssessmentAndConclusionsSectionProps {
  editFormData: EditFormData;
  handleUpdateFormField: <K extends keyof EditFormData>(field: K, value: EditFormData[K]) => void;
}

export const RiskAssessmentAndConclusionsSection: React.FC<RiskAssessmentAndConclusionsSectionProps> = ({
  editFormData,
  handleUpdateFormField,
}) => {
  return (
    <>
      {/* ── Section 10: Đánh giá Tình trạng Công trình ECS (E1 - E6) ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-800 flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-1.5">
            <CheckSquare size={14} className="text-blue-600" />
            <span>10. Điểm Tình Trạng Công Trình ECS (Existing Condition Score: E1–E6)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-600">Tổng điểm:</span>
            <input
              type="number"
              value={editFormData.ecsTotalScore}
              onChange={(e) => handleUpdateFormField('ecsTotalScore', e.target.value)}
              className="w-16 bg-blue-50 border border-blue-300 rounded p-1 text-xs font-mono font-bold text-blue-800 text-center"
            />
            <select
              value={editFormData.ecsClass}
              onChange={(e) => handleUpdateFormField('ecsClass', e.target.value)}
              className="bg-blue-600 text-white rounded p-1 text-xs font-bold outline-none"
            >
              <option value="GOOD">Cấp A - Tốt (GOOD)</option>
              <option value="MEDIUM">Cấp B - Trung bình (MEDIUM)</option>
              <option value="DEFICIENT">Cấp C - Kém (DEFICIENT)</option>
              <option value="CRITICAL">Cấp D - Nguy hiểm (CRITICAL)</option>
            </select>
          </div>
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-3">
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">E1: Hư hỏng khối xây</label>
            <input
              type="number"
              min="0"
              max="5"
              value={editFormData.ecsE1}
              onChange={(e) => handleUpdateFormField('ecsE1', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono text-center font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">E2: Khuyết tật kết cấu</label>
            <input
              type="number"
              min="0"
              max="5"
              value={editFormData.ecsE2}
              onChange={(e) => handleUpdateFormField('ecsE2', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono text-center font-bold text-rose-700"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">E3: Biến dạng móng</label>
            <input
              type="number"
              min="0"
              max="5"
              value={editFormData.ecsE3}
              onChange={(e) => handleUpdateFormField('ecsE3', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono text-center font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">E4: Suy thoái vật liệu</label>
            <input
              type="number"
              min="0"
              max="5"
              value={editFormData.ecsE4}
              onChange={(e) => handleUpdateFormField('ecsE4', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono text-center font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">E5: Lịch sử sự cố</label>
            <input
              type="number"
              min="0"
              max="5"
              value={editFormData.ecsE5}
              onChange={(e) => handleUpdateFormField('ecsE5', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono text-center font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">E6: Tải trọng & công năng</label>
            <input
              type="number"
              min="0"
              max="5"
              value={editFormData.ecsE6}
              onChange={(e) => handleUpdateFormField('ecsE6', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono text-center font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Phán đoán chuyên gia ECS</label>
            <select
              value={editFormData.ecsJudgementAction}
              onChange={(e) => handleUpdateFormField('ecsJudgementAction', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
            >
              <option value="KEEP">KEEP - Giữ nguyên tính toán tự động</option>
              <option value="OVERRIDE">OVERRIDE - Điều chỉnh theo phán đoán</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Lý do điều chỉnh ECS (nếu có)</label>
            <input
              type="text"
              value={editFormData.ecsJudgementReason}
              onChange={(e) => handleUpdateFormField('ecsJudgementReason', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
              placeholder="Nhập cơ sở phán đoán kỹ sư..."
            />
          </div>
        </div>
      </div>

      {/* ── Section 11: Chỉ số tổn thương công trình VI (V1 - V6) ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-800 flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-1.5">
            <Square size={14} className="text-purple-600" />
            <span>11. Chỉ Số Tổn Thương Công Trình VI (Vulnerability Index: V1–V6)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-600">Điểm VI trung bình:</span>
            <input
              type="text"
              value={editFormData.viAvgScore}
              onChange={(e) => handleUpdateFormField('viAvgScore', e.target.value)}
              className="w-16 bg-purple-50 border border-purple-300 rounded p-1 text-xs font-mono font-bold text-purple-800 text-center"
            />
            <select
              value={editFormData.viClass}
              onChange={(e) => handleUpdateFormField('viClass', e.target.value)}
              className="bg-purple-600 text-white rounded p-1 text-xs font-bold outline-none"
            >
              <option value="LOW">Thấp (LOW)</option>
              <option value="MEDIUM">Trung bình (MEDIUM)</option>
              <option value="HIGH">Cao (HIGH)</option>
              <option value="VERY_HIGH">Rất cao (VERY_HIGH)</option>
            </select>
          </div>
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-3">
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">V1: Tầm quan trọng</label>
            <input
              type="text"
              value={editFormData.viV1}
              onChange={(e) => handleUpdateFormField('viV1', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono text-center font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">V2: Hệ kết cấu</label>
            <input
              type="text"
              value={editFormData.viV2}
              onChange={(e) => handleUpdateFormField('viV2', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono text-center font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">V3: Nền móng</label>
            <input
              type="text"
              value={editFormData.viV3}
              onChange={(e) => handleUpdateFormField('viV3', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono text-center font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">V4: Tuổi thọ</label>
            <input
              type="text"
              value={editFormData.viV4}
              onChange={(e) => handleUpdateFormField('viV4', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono text-center font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">V5: Hiện trạng ECS</label>
            <input
              type="text"
              value={editFormData.viV5}
              onChange={(e) => handleUpdateFormField('viV5', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono text-center font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">V6: Độ nhạy địa chất</label>
            <input
              type="text"
              value={editFormData.viV6}
              onChange={(e) => handleUpdateFormField('viV6', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono text-center font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Phán đoán chuyên gia VI</label>
            <select
              value={editFormData.viJudgementAction}
              onChange={(e) => handleUpdateFormField('viJudgementAction', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
            >
              <option value="KEEP">KEEP - Giữ nguyên tính toán tự động</option>
              <option value="OVERRIDE">OVERRIDE - Điều chỉnh theo phán đoán</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Lý do điều chỉnh VI (nếu có)</label>
            <input
              type="text"
              value={editFormData.viJudgementReason}
              onChange={(e) => handleUpdateFormField('viJudgementReason', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
              placeholder="Nhập cơ sở phán đoán kỹ sư..."
            />
          </div>
        </div>
      </div>

      {/* ── Section 12: Đánh giá Rủi ro BRA & Thi công Metro ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 pb-2.5 border-b border-slate-100 mb-3">
          <AlertCircle size={14} className="text-orange-600" />
          <span>12. Đánh Giá Rủi Ro Tác Động Thi Công Hầm Metro (BRA Matrix)</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Cấp tác động thi công I</label>
            <select
              value={editFormData.constructionImpactLevel}
              onChange={(e) => handleUpdateFormField('constructionImpactLevel', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
            >
              <option value="1">I1 - Rất thấp (&lt; 5mm)</option>
              <option value="2">I2 - Thấp (5–10mm)</option>
              <option value="3">I3 - Trung bình (10–25mm)</option>
              <option value="4">I4 - Cao (25–50mm)</option>
              <option value="5">I5 - Rất cao (&gt; 50mm)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Cấp rủi ro BRA</label>
            <select
              value={editFormData.buildingRiskBra}
              onChange={(e) => handleUpdateFormField('buildingRiskBra', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-orange-700"
            >
              <option value="LOW">Rủi ro Thấp (LOW)</option>
              <option value="MEDIUM">Rủi ro Trung bình (MEDIUM)</option>
              <option value="HIGH">Rủi ro Cao (HIGH)</option>
              <option value="CRITICAL">Rủi ro Nguy cấp (CRITICAL)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Lún dự báo Smax (mm)</label>
            <input
              type="text"
              value={editFormData.predictedSettlementSmax}
              onChange={(e) => handleUpdateFormField('predictedSettlementSmax', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Độ méo góc β (Angular)</label>
            <input
              type="text"
              value={editFormData.angularDistortion}
              onChange={(e) => handleUpdateFormField('angularDistortion', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
              placeholder="1/500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Độ rung dự kiến PPV</label>
            <input
              type="text"
              value={editFormData.vibrationPpv}
              onChange={(e) => handleUpdateFormField('vibrationPpv', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Hành động bắt buộc</label>
            <input
              type="text"
              value={editFormData.braMandatoryAction}
              onChange={(e) => handleUpdateFormField('braMandatoryAction', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 pt-1 border-t border-slate-100">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={editFormData.requiresPhase2}
              onChange={(e) => handleUpdateFormField('requiresPhase2', e.target.checked)}
              className="rounded text-sky-600"
            />
            <span>Yêu cầu khảo sát chi tiết Phase 2 (Detailed Survey)</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={editFormData.requiresMonitoring}
              onChange={(e) => handleUpdateFormField('requiresMonitoring', e.target.checked)}
              className="rounded text-sky-600"
            />
            <span>Yêu cầu bố trí mốc quan trắc bổ sung trong quá trình thi công</span>
          </label>
        </div>
      </div>

      {/* ── Section 13: Cổng kiểm tra dữ liệu Gate ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 pb-2.5 border-b border-slate-100 mb-3">
          <FileCheck size={14} className="text-emerald-600" />
          <span>13. Cổng Kiểm Tra Dữ Liệu Hiện Trường (Data Completeness Gate)</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Quyết định Cổng (Decision)</label>
            <select
              value={editFormData.gateDecision}
              onChange={(e) => handleUpdateFormField('gateDecision', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
            >
              <option value="ALLOW">Đủ điều kiện chuyển tiếp (ALLOW)</option>
              <option value="CONDITIONAL">Chấp thuận có điều kiện (CONDITIONAL)</option>
              <option value="BLOCK">Chưa đạt yêu cầu (BLOCK)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Căn cứ / Lý do quyết định</label>
            <input
              type="text"
              value={editFormData.gateReason}
              onChange={(e) => handleUpdateFormField('gateReason', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
              placeholder="Ghi nhận hồ sơ khảo sát hiện trường đầy đủ hợp lệ..."
            />
          </div>
        </div>
      </div>

      {/* ── Section 14: Kết luận, Kiến nghị kỹ thuật & Ý kiến chủ nhà ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 pb-2.5 border-b border-slate-100 mb-3">
          <FileSignature size={14} className="text-emerald-600" />
          <span>14. Kết Luận, Kiến Nghị Kỹ Thuật & Ý Kiến Chủ Nhà</span>
        </h4>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Kết luận các rủi ro & khuyết tật then chốt (Summary Conclusions)
            </label>
            <textarea
              rows={2}
              value={editFormData.summaryConclusions}
              onChange={(e) => handleUpdateFormField('summaryConclusions', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Kiến nghị kỹ thuật cụ thể phục vụ thi công hầm Metro (Engineering Recommendations)
            </label>
            <textarea
              rows={2}
              value={editFormData.engineeringRecommendations}
              onChange={(e) => handleUpdateFormField('engineeringRecommendations', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1 flex items-center justify-between">
              <span>Ý kiến / Ghi chú bảo lưu của Chủ sở hữu công trình (Owner Remarks)</span>
              <span className="text-[10px] text-amber-600 font-bold">Mục 12 Biên bản hiện trường</span>
            </label>
            <textarea
              rows={2}
              value={editFormData.ownerRemarks}
              onChange={(e) => handleUpdateFormField('ownerRemarks', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
              placeholder="Nhập ý kiến hoặc yêu cầu bảo lưu của chủ nhà tại hiện trường..."
            />
          </div>
        </div>
      </div>
    </>
  );
};
