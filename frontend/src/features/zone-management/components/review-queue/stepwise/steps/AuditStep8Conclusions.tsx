import React from 'react';
import { Compass, TrendingUp } from 'lucide-react';
import { BRA_MATRIX_LOOKUP, calculateConstructionImpact, calculateBraRisk } from '../../../../../survey-phase1/engine/braEngine';
import type { AuditStepwiseFormState, StepwiseExecutiveSummary } from '../types';
import { ScoreExplanationPopover } from '../components/ScoreExplanationPopover';

interface Props {
  isEditMode: boolean;
  formState: AuditStepwiseFormState;
  handleNestedFieldChange: (parentKey: string, childKey: string, label: string, val: unknown) => void;
  handleFieldChange?: (fieldKey: string, label: string, val: unknown) => void;
  isFieldDirty?: (fieldKey: string, subKey?: string) => boolean;
}

export const AuditStep8Conclusions: React.FC<Props> = ({
  isEditMode,
  formState,
  handleNestedFieldChange,
  isFieldDirty,
}) => {
  const checkDirty = (fieldKey: string, subKey?: string) => {
    return isFieldDirty ? isFieldDirty(fieldKey, subKey) : false;
  };

  const getDirtyClass = (fieldKey: string, subKey?: string) => {
    return checkDirty(fieldKey, subKey)
      ? 'ring-2 ring-amber-400 border-amber-500 bg-amber-50/20'
      : '';
  };

  const renderDirtyBadge = (fieldKey: string, subKey?: string) => {
    if (checkDirty(fieldKey, subKey)) {
      return (
        <span className="ml-1.5 px-1 py-0.2 rounded text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 inline-block">
          Đã sửa
        </span>
      );
    }
    return null;
  };
  const exec: StepwiseExecutiveSummary = formState.executiveSummary || {};
  const objectGroup = (formState.objectGroup as string) || 'GENERAL';
  const isSpecialGroup = objectGroup === 'IMPORTANT' || objectGroup === 'CRITICAL';
  const objectGroupLabel =
    objectGroup === 'CRITICAL'
      ? 'Critical (Công trình đặc biệt)'
      : objectGroup === 'IMPORTANT'
      ? 'Important (Công trình quan trọng)'
      : 'General (Nhà dân thông thường)';

  // Tính toán gợi ý tự động từ khoảng cách mép ga / tim hầm theo chuẩn kỹ thuật braEngine
  // Nếu Thẩm định viên vừa cập nhật cự ly tim hầm ở Bước 1 mà chưa sửa riêng cự ly bao ngoài, ưu tiên lấy theo thông số vừa cập nhật ở trên
  const isMetroDistRecentlyEdited =
    Boolean(isFieldDirty?.('metroOffsetDistance') || isFieldDirty?.('manualMetroDistanceM')) &&
    !isFieldDirty?.('clearanceOffsetDistance');

  const effectiveCenterlineDist =
    (formState.manualMetroDistanceM as string | number | undefined) ||
    (formState.metroOffsetDistance as string | number | undefined) ||
    (formState.metroDistanceM as string | number | undefined) ||
    (formState.distanceToMetroCenterlineM as string | number | undefined);

  const effectiveStationEdgeDist = isMetroDistRecentlyEdited
    ? effectiveCenterlineDist
    : ((formState.clearanceOffsetDistance as string | number | undefined) ?? undefined);

  const autoImpact = calculateConstructionImpact(
    objectGroup,
    effectiveStationEdgeDist,
    effectiveCenterlineDist
  );

  const IMPACT_LABELS: Record<'I1' | 'I2' | 'I3' | 'I4', string> = {
    I1: 'I1 (Tác động rất nhẹ)',
    I2: 'I2 (Tác động nhẹ)',
    I3: 'I3 (Tác động trung bình)',
    I4: 'I4 (Tác động nghiêm trọng)',
  };

  const isDistanceOrGroupDirty = Boolean(
    isFieldDirty?.('metroOffsetDistance') ||
      isFieldDirty?.('clearanceOffsetDistance') ||
      isFieldDirty?.('manualMetroDistanceM') ||
      isFieldDirty?.('objectGroup') ||
      isFieldDirty?.('parcelCoordinates')
  );
  const isImpactDirtyInStep8 = Boolean(isFieldDirty?.('executiveSummary', 'constructionImpactStatus'));

  const rawExecImpact = String(exec.constructionImpactStatus || '').trim();
  const isValidExecImpact = /^I[1-4]/i.test(rawExecImpact);
  const rawImpactStr =
    (isDistanceOrGroupDirty && !isImpactDirtyInStep8) || !isValidExecImpact
      ? autoImpact.code
      : rawExecImpact;

  const impactCode: 'I1' | 'I2' | 'I3' | 'I4' = rawImpactStr.startsWith('I4')
    ? 'I4'
    : rawImpactStr.startsWith('I3')
    ? 'I3'
    : rawImpactStr.startsWith('I2')
    ? 'I2'
    : rawImpactStr.startsWith('I1')
    ? 'I1'
    : autoImpact.code;
  const currentImpactStr = IMPACT_LABELS[impactCode];
  const overrideReason: string =
    isDistanceOrGroupDirty && !isImpactDirtyInStep8 ? '' : ((exec.impactOverrideReason as string) || '');
  const isImpactOverridden = impactCode !== autoImpact.code || Boolean(overrideReason.trim());
  const isReasonValid = !isImpactOverridden || overrideReason.trim().length >= 5;

  // Xác định hàng vCode (V1..V4) từ phân hạng tổn thương VI (vi.viClass) theo đúng chuẩn braEngine.ts của FE Phase 1
  const viState = (formState.vi || {}) as { viClass?: string; viAvg?: number; avgVi?: number };
  const rawViAvg = Number(viState.viAvg ?? viState.avgVi ?? 0);
  const derivedViClass =
    viState.viClass ||
    (rawViAvg > 3.25 ? 'VERY_HIGH' : rawViAvg > 2.5 ? 'HIGH' : rawViAvg > 1.5 ? 'MEDIUM' : 'LOW');
  const braMatrixEval = calculateBraRisk(derivedViClass, impactCode);
  const vCode: 'V1' | 'V2' | 'V3' | 'V4' = braMatrixEval.vCode;
  const computedBraCode = braMatrixEval.riskLevel.toUpperCase().replace(/\s+/g, '_');
  const rawBraStr = String(exec.braStatus || '').trim().toUpperCase().replace(/\s+/g, '_');
  const isBraDirtyInStep8 = Boolean(isFieldDirty?.('executiveSummary', 'braStatus'));
  const currentBra =
    !rawBraStr || rawBraStr === 'PENDING' || (isDistanceOrGroupDirty && !isBraDirtyInStep8)
      ? computedBraCode
      : rawBraStr;

  const summaryConclusions = exec.summaryConclusions ?? formState.summaryConclusions ?? '';
  const keyRisksDefectsText = exec.keyRisksDefectsText ?? formState.keyRisksDefectsText ?? '';

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
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Đánh Giá Rủi Ro Cơ Sở (BRA Level):
              </span>
              <ScoreExplanationPopover metric="BRA" />
            </div>
            {isEditMode ? (
              <select
                value={currentBra}
                onChange={(e) =>
                  handleNestedFieldChange('executiveSummary', 'braStatus', 'Trạng thái BRA', e.target.value)
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-800 cursor-pointer"
              >
                <option value="LOW">LOW - Nguy cơ rủi ro thấp (An toàn)</option>
                <option value="MEDIUM">MEDIUM - Nguy cơ rủi ro trung bình</option>
                <option value="HIGH">HIGH - Nguy cơ rủi ro cao (Cần theo dõi)</option>
                <option value="VERY_HIGH">VERY_HIGH - Nguy cơ rất cao (Cảnh báo đặc biệt)</option>
              </select>
            ) : (
              <div className="text-base font-black text-slate-900">
                {currentBra}
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              Mức rủi ro tổng hợp dựa trên tính tổn thương công trình (VI: {vCode}) và tác động thi công tuyến Metro ({impactCode}) &rarr; Gợi ý ma trận: <strong className="text-slate-700">{computedBraCode}</strong>.
            </p>
          </div>

          <div className={`p-3.5 bg-slate-50 rounded-xl border space-y-2 transition-all ${
            isImpactOverridden ? 'border-purple-300 bg-purple-50/20' : 'border-slate-200'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-sky-600" />
                Phân Cấp Tác Động Thi Công Metro (Impact):
              </span>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 font-bold text-[10px]">
                  Nhóm: {objectGroupLabel}
                </span>
                {isImpactOverridden ? (
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 font-bold text-[10px]">
                    [Đã can thiệp thủ công]
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
                    ✓ Tính tự động
                  </span>
                )}
                <ScoreExplanationPopover metric="I" />
              </div>
            </div>

            {isEditMode ? (
              <select
                value={impactCode}
                onChange={(e) => {
                  const newICode = e.target.value as 'I1' | 'I2' | 'I3' | 'I4';
                  const newLabel = IMPACT_LABELS[newICode] || newICode;
                  handleNestedFieldChange('executiveSummary', 'constructionImpactStatus', 'Tác động Metro', newLabel);
                  const newBra = calculateBraRisk(derivedViClass, newICode);
                  const newBraCode = newBra.riskLevel.toUpperCase().replace(/\s+/g, '_');
                  handleNestedFieldChange('executiveSummary', 'braStatus', 'Trạng thái BRA', newBraCode);
                }}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 cursor-pointer"
              >
                {isSpecialGroup ? (
                  <>
                    <option value="I1">I1 - Rất nhẹ (Nhóm Important/Critical: d &ge; 30m)</option>
                    <option value="I2">I2 - Nhẹ (Nhóm Important/Critical: 20m &le; d &lt; 30m)</option>
                    <option value="I3">I3 - Trung bình (Nhóm Important/Critical: 10m &le; d &lt; 20m)</option>
                    <option value="I4">I4 - Nghiêm trọng (Nhóm Important/Critical: d &lt; 10m hoặc cắt qua ga)</option>
                  </>
                ) : (
                  <>
                    <option value="I1">I1 - Rất nhẹ (Nhóm General: d &ge; 20m)</option>
                    <option value="I2">I2 - Nhẹ (Nhóm General: 10m &le; d &lt; 20m)</option>
                    <option value="I3">I3 - Trung bình (Nhóm General: 5m &le; d &lt; 10m)</option>
                    <option value="I4">I4 - Nghiêm trọng (Nhóm General: d &lt; 5m hoặc cắt qua ga)</option>
                  </>
                )}
              </select>
            ) : (
              <div className="text-base font-black text-sky-800">
                {currentImpactStr}
              </div>
            )}

            {isImpactOverridden && (
              <div className="p-2.5 bg-purple-50/80 rounded-xl border border-purple-200 text-xs space-y-1.5">
                <div className="text-[11px] font-bold text-purple-900 flex items-center justify-between">
                  <span>Giá trị gợi ý ban đầu: <strong className="font-mono text-purple-700">{autoImpact.code} ({autoImpact.levelText})</strong></span>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => {
                        handleNestedFieldChange('executiveSummary', 'constructionImpactStatus', 'Tác động Metro', autoImpact.label);
                        handleNestedFieldChange('executiveSummary', 'impactOverrideReason', 'Lý do can thiệp Impact', '');
                        const revertedBra = calculateBraRisk(derivedViClass, autoImpact.code);
                        const revertedBraCode = revertedBra.riskLevel.toUpperCase().replace(/\s+/g, '_');
                        handleNestedFieldChange('executiveSummary', 'braStatus', 'Trạng thái BRA', revertedBraCode);
                      }}
                      className="text-[10px] text-purple-700 hover:text-purple-900 underline font-semibold cursor-pointer"
                    >
                      Hoàn nguyên gợi ý
                    </button>
                  )}
                </div>
                {isEditMode ? (
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                      Lý do điều chỉnh can thiệp thủ công (Bắt buộc &ge; 5 ký tự):
                    </label>
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) =>
                        handleNestedFieldChange('executiveSummary', 'impactOverrideReason', 'Lý do can thiệp Impact', e.target.value)
                      }
                      placeholder="Nhập lý do kỹ thuật can thiệp mức tác động (VD: Hố móng sâu giáp ranh nhà dân)..."
                      className={`w-full p-1.5 text-xs bg-white rounded-lg border ${
                        !isReasonValid ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-300'
                      }`}
                    />
                    {!isReasonValid && (
                      <span className="text-[10px] font-bold text-rose-600 block mt-0.5">
                        ⚠️ Bắt buộc nhập lý do điều chỉnh tác động Metro (tối thiểu 5 ký tự)
                      </span>
                    )}
                  </div>
                ) : (
                  overrideReason && (
                    <div className="text-[11px] text-purple-950 italic">
                      Lý do can thiệp: &ldquo;{overrideReason}&rdquo;
                    </div>
                  )
                )}
              </div>
            )}

            <div className="text-[11px] text-slate-500 space-y-0.5">
              <p>
                Phân cấp theo khoảng cách từ ranh công trình tới <strong>mép ga / biên hố đào Metro</strong> ({isSpecialGroup ? 'Quy tắc ngưỡng: 30m / 20m / 10m' : 'Quy tắc ngưỡng: 20m / 10m / 5m'}):
              </p>
              {autoImpact.hasStationEdge ? (
                <p className="font-semibold text-sky-700">
                  Cự ly mép ga: d = {autoImpact.distance}m &bull; Tự động: {autoImpact.code} ({autoImpact.conditionFormula})
                </p>
              ) : (
                <p className="font-semibold text-amber-700">
                  ⚠️ {autoImpact.stationNote} (Fallback theo tim: d = {autoImpact.distance}m &rarr; {autoImpact.code}: {autoImpact.conditionFormula})
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
                  const vName = vKey === 'V1' ? 'V1 (Low)' : vKey === 'V2' ? 'V2 (Medium)' : vKey === 'V3' ? 'V3 (High)' : 'V4 (Very High)';
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

          <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="font-bold text-slate-700">Thông số đầu vào ma trận:</span>{' '}
              Nhóm đối tượng: <strong className="text-sky-800">{objectGroupLabel}</strong> &bull;{' '}
              Khoảng cách <strong>d = {autoImpact.distance}m</strong> ({autoImpact.hasStationEdge ? 'mép ga/hố đào' : 'tim tuyến'}) &bull;{' '}
              Ngưỡng phân cấp: <span className="font-mono text-slate-800">{autoImpact.conditionFormula}</span>
            </div>
            <div className="font-bold text-sky-900">
              Khuyến nghị hệ thống: {braMatrixEval.recommendation}
            </div>
          </div>
        </div>

        {/* Khối 3: Tổng hợp khuyết tật chính & Rủi ro */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
            Tổng Hợp Khuyết Tật & Nguy Cơ Kết Cấu Chính Ghi Nhận {renderDirtyBadge('executiveSummary', 'keyRisksDefectsText') || renderDirtyBadge('keyRisksDefectsText')}
          </label>
          {isEditMode ? (
            <textarea
              rows={2}
              value={keyRisksDefectsText}
              onChange={(e) => {
                handleNestedFieldChange('executiveSummary', 'keyRisksDefectsText', 'Tổng hợp khuyết tật', e.target.value);
              }}
              className={`w-full p-2.5 rounded-xl text-xs text-slate-800 ${getDirtyClass('executiveSummary', 'keyRisksDefectsText') || getDirtyClass('keyRisksDefectsText') || 'bg-amber-50/50 border border-amber-300'}`}
              placeholder="Tóm tắt các khuyết tật đáng lưu ý (vết nứt lớn, võng dầm, lún lệch chân tường...)"
            />
          ) : (
            <div className={`p-3 rounded-xl text-xs text-slate-800 font-medium ${getDirtyClass('executiveSummary', 'keyRisksDefectsText') || getDirtyClass('keyRisksDefectsText') || 'bg-slate-50 border border-slate-200'}`}>
              {keyRisksDefectsText || 'Không'}
            </div>
          )}
        </div>

        {/* Khối 4: Kết luận tóm tắt tổng thể hiện trạng */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
            Kết Luận Tóm Tắt Hiện Trạng Toàn Diện {renderDirtyBadge('executiveSummary', 'summaryConclusions') || renderDirtyBadge('summaryConclusions')}
          </label>
          {isEditMode ? (
            <textarea
              rows={2}
              value={summaryConclusions}
              onChange={(e) => {
                handleNestedFieldChange('executiveSummary', 'summaryConclusions', 'Kết luận tổng thể', e.target.value);
              }}
              className={`w-full p-2.5 rounded-xl text-xs text-slate-800 ${getDirtyClass('executiveSummary', 'summaryConclusions') || getDirtyClass('summaryConclusions') || 'bg-amber-50/50 border border-amber-300'}`}
              placeholder="Kết luận tổng quan về hiện trạng công trình trước khi thi công tuyến Metro..."
            />
          ) : (
            <div className={`p-3 rounded-xl text-xs text-slate-800 font-medium ${getDirtyClass('executiveSummary', 'summaryConclusions') || getDirtyClass('summaryConclusions') || 'bg-slate-50 border border-slate-200'}`}>
              {summaryConclusions || 'Không'}
            </div>
          )}
        </div>

        {/* Khối 5: Khuyến nghị kỹ thuật của Kỹ sư Zone */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
            Khuyến Nghị Kỹ Thuật Của Kỹ Sư Zone Phụ Trách Thẩm Định {renderDirtyBadge('executiveSummary', 'specificRecommendationsText')}
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
              className={`w-full p-2.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 ${getDirtyClass('executiveSummary', 'specificRecommendationsText') || 'bg-amber-50/50 border border-amber-300'}`}
              placeholder="Nhập khuyến nghị kỹ thuật, cảnh báo hoặc lưu ý cho nhà thầu TBM..."
            />
          ) : (
            <div className={`p-3.5 rounded-xl text-xs text-slate-800 leading-relaxed font-medium ${getDirtyClass('executiveSummary', 'specificRecommendationsText') || 'bg-slate-50 border border-slate-200'}`}>
              {exec.specificRecommendationsText || 'Không'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

