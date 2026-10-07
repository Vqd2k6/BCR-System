import React from 'react';
import { FileCheck2, Compass, TrendingUp, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { BRA_MATRIX_LOOKUP } from '../../../../../survey-phase1/engine/braEngine';

interface Props {
  isEditMode: boolean;
  formState: Record<string, any>;
  handleNestedFieldChange: (parentKey: string, childKey: string, label: string, val: any) => void;
  handleFieldChange?: (fieldKey: string, label: string, val: any) => void;
}

export const AuditStep8Conclusions: React.FC<Props> = ({
  isEditMode,
  formState,
  handleNestedFieldChange,
  handleFieldChange,
}) => {
  const exec = formState.executiveSummary || {};
  const currentBra = (exec.braStatus || 'LOW').toUpperCase();
  const currentImpactStr = exec.constructionImpactStatus || 'I1 (Tác động rất nhẹ)';
  const impactCode = (currentImpactStr.startsWith('I4') ? 'I4' : currentImpactStr.startsWith('I3') ? 'I3' : currentImpactStr.startsWith('I2') ? 'I2' : 'I1') as 'I1' | 'I2' | 'I3' | 'I4';

  // Map braStatus to code
  const vCode: 'V1' | 'V2' | 'V3' | 'V4' = currentBra === 'VERY_HIGH' ? 'V4' : currentBra === 'HIGH' ? 'V3' : currentBra === 'MEDIUM' ? 'V2' : 'V1';

  const summaryConclusions = formState.summaryConclusions || exec.summaryConclusions || '';
  const keyRisksDefectsText = formState.keyRisksDefectsText || exec.keyRisksDefectsText || '';

  return (
    <section id="step-8" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 08
          </span>
          <h3 className="text-sm sm:text-base font-black text-slate-800">
            Kết Luận Toàn Diện, Ma Trận BRA & Tác Động Thi Công TBM
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-xl text-xs font-black border ${
            currentBra === 'VERY_HIGH' ? 'bg-red-100 text-red-900 border-red-300' :
            currentBra === 'HIGH' ? 'bg-orange-100 text-orange-900 border-orange-300' :
            currentBra === 'MEDIUM' ? 'bg-amber-100 text-amber-900 border-amber-300' :
            'bg-emerald-100 text-emerald-900 border-emerald-300'
          }`}>
            BRA: {currentBra}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Khối 1: Trạng thái BRA & Tác động thi công */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Đánh Giá Rủi Ro Cơ Sở (BRA Level):
            </span>
            {isEditMode ? (
              <select
                value={exec.braStatus || 'LOW'}
                onChange={(e) =>
                  handleNestedFieldChange('executiveSummary', 'braStatus', 'Trạng thái BRA', e.target.value)
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-800"
              >
                <option value="LOW">LOW - Nguy cơ rủi ro thấp (An toàn)</option>
                <option value="MEDIUM">MEDIUM - Nguy cơ rủi ro trung bình</option>
                <option value="HIGH">HIGH - Nguy cơ rủi ro cao (Cần theo dõi)</option>
                <option value="VERY_HIGH">VERY_HIGH - Nguy cơ rất cao (Cảnh báo đặc biệt)</option>
              </select>
            ) : (
              <div className="text-base font-black text-slate-900">
                {exec.braStatus || 'LOW'}
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              Mức rủi ro tổng hợp dựa trên tính tổn thương công trình (VI) và tác động thi công tuyến Metro.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-sky-600" />
              Phân Cấp Tác Động Thi Công Metro (Impact):
            </span>
            {isEditMode ? (
              <select
                value={exec.constructionImpactStatus || 'I1 (Tác động rất nhẹ)'}
                onChange={(e) =>
                  handleNestedFieldChange('executiveSummary', 'constructionImpactStatus', 'Tác động Metro', e.target.value)
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
              >
                <option value="I1 (Tác động rất nhẹ)">I1 - Rất nhẹ (Khoảng cách mép ga d &ge; 20m)</option>
                <option value="I2 (Tác động nhẹ)">I2 - Nhẹ (10m &le; d &lt; 20m)</option>
                <option value="I3 (Tác động trung bình)">I3 - Trung bình (5m &le; d &lt; 10m)</option>
                <option value="I4 (Tác động nghiêm trọng)">I4 - Nghiêm trọng (d &lt; 5m hoặc cắt qua ga)</option>
              </select>
            ) : (
              <div className="text-base font-black text-sky-800">
                {exec.constructionImpactStatus || 'I1 (Tác động rất nhẹ)'}
              </div>
            )}
            <div className="text-[11px] text-slate-500 space-y-0.5">
              <p>
                Phân cấp theo khoảng cách từ ranh công trình tới <strong>mép ga / biên hố đào Metro</strong>.
              </p>
              {formState.clearanceOffsetDistance ? (
                <p className="font-semibold text-sky-700">
                  Cự ly mép ga ghi nhận: {formState.clearanceOffsetDistance} (Tim Metro: {formState.metroOffsetDistance || '--'})
                </p>
              ) : (
                <p className="font-semibold text-amber-700">
                  ⚠️ Không có công trình ga trong zone (Dự phòng theo tim: {formState.metroOffsetDistance || '--'})
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Khối 2: Ma trận Rủi ro Cơ sở BRA 4x4 (Interactive Matrix) */}
        <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Ma Trận Đánh Giá Rủi Ro Cơ Sở BRA (4 &times; 4 Matrix)
            </span>
            <span className="text-[10px] text-slate-500">
              🎯 Ô có biểu tượng là kết quả đánh giá thực tế của công trình
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse border border-slate-200">
              <thead>
                <tr className="bg-sky-100 text-sky-950 font-bold">
                  <th className="border border-slate-200 p-2 text-left">Vulnerability (VI) &darr; / Impact (I) &rarr;</th>
                  <th className={`border border-slate-200 p-2 ${impactCode === 'I1' ? 'bg-sky-200 font-black' : ''}`}>I1 (Low)</th>
                  <th className={`border border-slate-200 p-2 ${impactCode === 'I2' ? 'bg-sky-200 font-black' : ''}`}>I2 (Medium)</th>
                  <th className={`border border-slate-200 p-2 ${impactCode === 'I3' ? 'bg-sky-200 font-black' : ''}`}>I3 (High)</th>
                  <th className={`border border-slate-200 p-2 ${impactCode === 'I4' ? 'bg-sky-200 font-black' : ''}`}>I4 (Very High)</th>
                </tr>
              </thead>
              <tbody>
                {(['V1', 'V2', 'V3', 'V4'] as const).map((vKey) => {
                  const isCurrentV = vCode === vKey;
                  const vName = vKey === 'V1' ? 'V1 (Rất thấp)' : vKey === 'V2' ? 'V2 (Thấp)' : vKey === 'V3' ? 'V3 (Trung bình)' : 'V4 (Cao)';
                  return (
                    <tr key={vKey} className={isCurrentV ? 'bg-sky-50 font-bold' : ''}>
                      <td className={`border border-slate-200 p-2 text-left font-bold bg-slate-100 ${isCurrentV ? 'text-sky-900 bg-sky-100' : 'text-slate-700'}`}>
                        {vName}
                      </td>
                      {(['I1', 'I2', 'I3', 'I4'] as const).map((iKey) => {
                        const cell = BRA_MATRIX_LOOKUP[vKey][iKey];
                        const isCurrentCell = vCode === vKey && impactCode === iKey;
                        return (
                          <td
                            key={iKey}
                            className={`border border-slate-200 p-2 font-black transition-all ${
                              cell.riskLevel === 'Low'
                                ? 'bg-emerald-50 text-emerald-800'
                                : cell.riskLevel === 'Medium'
                                ? 'bg-amber-50 text-amber-800'
                                : cell.riskLevel === 'High'
                                ? 'bg-orange-50 text-orange-800'
                                : 'bg-red-50 text-red-800'
                            } ${isCurrentCell ? 'ring-3 ring-sky-600 scale-105 shadow-md z-10 relative bg-white' : ''}`}
                          >
                            {isCurrentCell ? `🎯 ${cell.riskLevel}` : cell.riskLevel}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Khối 3: Tổng hợp khuyết tật chính & Rủi ro */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
            Tổng Hợp Khuyết Tật & Nguy Cơ Kết Cấu Chính Ghi Nhận
          </label>
          {isEditMode ? (
            <textarea
              rows={2}
              value={keyRisksDefectsText}
              onChange={(e) => {
                if (handleFieldChange) handleFieldChange('keyRisksDefectsText', 'Tổng hợp khuyết tật', e.target.value);
                handleNestedFieldChange('executiveSummary', 'keyRisksDefectsText', 'Tổng hợp khuyết tật', e.target.value);
              }}
              className="w-full p-2.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs text-slate-800"
              placeholder="Tóm tắt các khuyết tật đáng lưu ý (vết nứt lớn, võng dầm, lún lệch chân tường...)"
            />
          ) : (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800">
              {keyRisksDefectsText || 'Chưa ghi nhận khuyết tật nguy hiểm đe dọa trực tiếp đến an toàn chịu lực của công trình.'}
            </div>
          )}
        </div>

        {/* Khối 4: Kết luận tóm tắt tổng thể hiện trạng */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
            Kết Luận Tóm Tắt Hiện Trạng Toàn Diện
          </label>
          {isEditMode ? (
            <textarea
              rows={2}
              value={summaryConclusions}
              onChange={(e) => {
                if (handleFieldChange) handleFieldChange('summaryConclusions', 'Kết luận tổng thể', e.target.value);
                handleNestedFieldChange('executiveSummary', 'summaryConclusions', 'Kết luận tổng thể', e.target.value);
              }}
              className="w-full p-2.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs text-slate-800"
              placeholder="Kết luận tổng quan về hiện trạng công trình trước khi thi công tuyến Metro..."
            />
          ) : (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800">
              {summaryConclusions || 'Công trình đủ điều kiện an toàn, duy trì trạng thái ổn định trước khi triển khai thi công đoạn hầm lân cận.'}
            </div>
          )}
        </div>

        {/* Khối 5: Khuyến nghị kỹ thuật của Kỹ sư Zone */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
            Khuyến Nghị Kỹ Thuật Của Kỹ Sư Zone Phụ Trách Thẩm Định
          </label>
          {isEditMode ? (
            <textarea
              rows={3}
              value={exec.specificRecommendationsText || ''}
              onChange={(e) =>
                handleNestedFieldChange(
                  'executiveSummary',
                  'specificRecommendationsText',
                  'Khuyến nghị kỹ thuật',
                  e.target.value
                )
              }
              className="w-full p-2.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Nhập khuyến nghị kỹ thuật, cảnh báo hoặc lưu ý cho nhà thầu TBM..."
            />
          ) : (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed">
              {exec.specificRecommendationsText || 'Công trình duy trì theo dõi định kỳ trong quá trình khiên đào TBM vận hành. Không có yêu cầu xử lý kết cấu khẩn cấp.'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

