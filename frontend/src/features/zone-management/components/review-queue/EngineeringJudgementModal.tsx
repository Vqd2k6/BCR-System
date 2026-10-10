import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, CheckCircle2, TrendingUp, TrendingDown, Minus, Sliders, AlertTriangle } from 'lucide-react';
import { api } from '../../../../services/api';

export interface RiskCardData {
  e1_burland_score?: number | string;
  total_ecs_score?: number | string;
  ecs_class?: string;
  v1_importance_score?: number | string;
  avg_vi_score?: number | string;
  vi_class?: string;
  is_engineering_judgement_applied?: boolean;
  engineering_judgement_action?: 'UPGRADE' | 'DOWNGRADE' | 'CUSTOM_OVERRIDE' | 'KEEP';
  engineering_judgement_reason?: string;
  judgement_engineer_name?: string;
  overridden_burland_grade?: number | string | null;
  overridden_total_ecs?: number | string | null;
  overridden_ecs_class?: string;
  overridden_importance_score?: number | string | null;
  overridden_avg_vi?: number | string | null;
  overridden_vi_class?: string;
  [key: string]: unknown;
}

interface Props {
  isOpen: boolean;
  reportId: string;
  parcelCode: string;
  currentBurlandGrade?: string | number;
  riskCard?: RiskCardData | null;
  data?: Record<string, unknown> | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EngineeringJudgementModal: React.FC<Props> = ({
  isOpen,
  reportId,
  parcelCode,
  currentBurlandGrade,
  riskCard,
  data,
  onClose,
  onSuccess,
}) => {
  const [action, setAction] = useState<'UPGRADE' | 'DOWNGRADE' | 'CUSTOM_OVERRIDE' | 'KEEP'>('UPGRADE');
  const [reason, setReason] = useState('');
  const [engineerName, setEngineerName] = useState('Kỹ Sư Trưởng Zone Admin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 4 Trục thông số can thiệp
  const rawSurveyJson = data?.surveyJson as Record<string, Record<string, unknown>> | undefined;
  const baselineBurland = Number(riskCard?.e1_burland_score ?? rawSurveyJson?.ecs?.e1 ?? 0);
  const baselineTotalEcs = Number(riskCard?.total_ecs_score ?? rawSurveyJson?.ecs?.totalEcs ?? 0);
  const baselineEcsClass = riskCard?.ecs_class || 'GOOD';
  const baselineImportance = Number(riskCard?.v1_importance_score ?? rawSurveyJson?.vi?.v1 ?? 2.0);
  const baselineAvgVi = Number(riskCard?.avg_vi_score ?? rawSurveyJson?.vi?.avgVi ?? 1.0);
  const baselineViClass = riskCard?.vi_class || 'LOW';

  const [burlandGrade, setBurlandGrade] = useState<number>(baselineBurland);
  const [totalEcs, setTotalEcs] = useState<number>(baselineTotalEcs);
  const [ecsClass, setEcsClass] = useState<string>(baselineEcsClass);
  const [importanceScore, setImportanceScore] = useState<number>(baselineImportance);
  const [avgVi, setAvgVi] = useState<number>(baselineAvgVi);
  const [viClass, setViClass] = useState<string>(baselineViClass);

  const e2StructureScore = Number(riskCard?.e2_structure_score ?? 0);
  const isSafetyLocked = e2StructureScore >= 3;

  useEffect(() => {
    if (isOpen) {
      if (riskCard?.is_engineering_judgement_applied) {
        setAction(riskCard.engineering_judgement_action || 'CUSTOM_OVERRIDE');
        setReason(riskCard.engineering_judgement_reason || '');
        if (riskCard.judgement_engineer_name) setEngineerName(riskCard.judgement_engineer_name);
        if (riskCard.overridden_burland_grade !== null && riskCard.overridden_burland_grade !== undefined) {
          setBurlandGrade(Number(riskCard.overridden_burland_grade));
        }
        if (riskCard.overridden_total_ecs !== null && riskCard.overridden_total_ecs !== undefined) {
          setTotalEcs(Number(riskCard.overridden_total_ecs));
        }
        if (riskCard.overridden_ecs_class) setEcsClass(riskCard.overridden_ecs_class);
        if (riskCard.overridden_importance_score !== null && riskCard.overridden_importance_score !== undefined) {
          setImportanceScore(Number(riskCard.overridden_importance_score));
        }
        if (riskCard.overridden_avg_vi !== null && riskCard.overridden_avg_vi !== undefined) {
          setAvgVi(Number(riskCard.overridden_avg_vi));
        }
        if (riskCard.overridden_vi_class) setViClass(riskCard.overridden_vi_class);
      } else {
        setAction('UPGRADE');
        setReason('');
        setBurlandGrade(baselineBurland > 0 ? Math.min(baselineBurland + 1, 5) : 1);
        setTotalEcs(Math.min(baselineTotalEcs + 3, 24));
        setEcsClass(baselineTotalEcs + 3 > 16 ? 'CRITICAL' : baselineTotalEcs + 3 > 10 ? 'DEFICIENT' : 'MEDIUM');
        setImportanceScore(baselineImportance);
        setAvgVi(Math.min(baselineAvgVi + 0.5, 4.0));
        setViClass(baselineAvgVi + 0.5 > 2.5 ? 'HIGH' : 'MEDIUM');
      }
      setErrorMsg('');
    }
  }, [isOpen, riskCard]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 10) {
      setErrorMsg('Vui lòng nhập căn cứ & lý giải kỹ thuật kết cấu tối thiểu 10 ký tự!');
      return;
    }

    if (action === 'DOWNGRADE' && isSafetyLocked) {
      setErrorMsg('KHÓA AN TOÀN: Công trình có khuyết tật dầm/cột chịu lực E2 >= 3, không được phép hạ cấp rủi ro!');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      interface JudgementPayload {
        action: 'UPGRADE' | 'DOWNGRADE' | 'CUSTOM_OVERRIDE' | 'KEEP';
        reason: string;
        engineerName: string;
        overrides?: {
          burlandGrade: number;
          totalEcs: number;
          ecsClass: string;
          importanceScore: number;
          avgVi: number;
          viClass: string;
        };
      }

      const payload: JudgementPayload = {
        action,
        reason: reason.trim(),
        engineerName: engineerName.trim(),
      };

      if (action !== 'KEEP') {
        payload.overrides = {
          burlandGrade: Number(burlandGrade),
          totalEcs: Number(totalEcs),
          ecsClass,
          importanceScore: Number(importanceScore),
          avgVi: Number(avgVi),
          viClass,
        };
      }

      const res = await api.post(`/admin/reports/${reportId}/engineering-judgement`, payload);

      if (res.data?.success || res.status === 200) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Không thể lưu can thiệp chuyên gia.');
      }
    } catch (err: unknown) {
      console.error('[EngineeringJudgementModal] Error:', err);
      setErrorMsg(
        getErrorMessage(err, 'Lỗi kết nối khi lưu can thiệp kỹ sư.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              <ShieldAlert className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Phán Quyết Kỹ Sư Trưởng & Can Thiệp Chuyên Môn</h3>
              <p className="text-xs text-indigo-100 mt-0.5">
                Thửa: <strong>{parcelCode}</strong> • Burland gốc: Cấp {baselineBurland} • ECS gốc: {baselineTotalEcs}đ • VI gốc: {baselineAvgVi.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Lock Banner if E2 >= 3 */}
        {isSafetyLocked && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2.5 text-xs text-amber-900 font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>KHÓA AN TOÀN KỸ THUẬT KÍCH HOẠT: Phát hiện khuyết tật kết cấu chịu lực mức nguy cấp (E2 = {e2StructureScore}/4). Cấm hạ cấp rủi ro!</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Chọn Hành động phán đoán */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              1. Hành động phán đoán kỹ thuật:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setAction('UPGRADE')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  action === 'UPGRADE'
                    ? 'border-red-500 bg-red-50 text-red-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <TrendingUp className={`w-4 h-4 mx-auto mb-1 ${action === 'UPGRADE' ? 'text-red-600' : 'text-slate-400'}`} />
                <span className="text-xs block font-bold">Nâng cấp nguy cơ</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Tiếp giáp hố đào</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isSafetyLocked) {
                    alert('KHÓA AN TOÀN: Công trình có khuyết tật dầm/cột chịu lực E2 >= 3, không được phép hạ cấp!');
                    return;
                  }
                  setAction('DOWNGRADE');
                }}
                disabled={isSafetyLocked}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  isSafetyLocked
                    ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200'
                    : action === 'DOWNGRADE'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-xs cursor-pointer'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 cursor-pointer'
                }`}
              >
                <TrendingDown className={`w-4 h-4 mx-auto mb-1 ${action === 'DOWNGRADE' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="text-xs block font-bold">Hạ mức độ</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Nứt vữa co ngót</span>
              </button>

              <button
                type="button"
                onClick={() => setAction('CUSTOM_OVERRIDE')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  action === 'CUSTOM_OVERRIDE'
                    ? 'border-purple-500 bg-purple-50 text-purple-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <Sliders className={`w-4 h-4 mx-auto mb-1 ${action === 'CUSTOM_OVERRIDE' ? 'text-purple-600' : 'text-slate-400'}`} />
                <span className="text-xs block font-bold">Tùy chỉnh đa điểm</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Chọn từng chỉ số</span>
              </button>

              <button
                type="button"
                onClick={() => setAction('KEEP')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  action === 'KEEP'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <Minus className={`w-4 h-4 mx-auto mb-1 ${action === 'KEEP' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="text-xs block font-bold">Giữ nguyên gốc</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Theo máy tính</span>
              </button>
            </div>
          </div>

          {/* 2. Ma trận 4 Thông số can thiệp (Chỉ hiển thị khi không phải KEEP) */}
          {action !== 'KEEP' && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  2. Ma Trận Giá Trị Can Thiệp Chuyên Gia (Overrides Matrix):
                </span>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                  So sánh trực tiếp với số liệu hiện trường
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* 1. Burland BRA */}
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Cấp Nứt Burland (E1):</span>
                    <span className="text-[11px] text-slate-400">Gốc: Cấp {baselineBurland}</span>
                  </div>
                  <select
                    value={burlandGrade}
                    onChange={(e) => setBurlandGrade(Number(e.target.value))}
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-800"
                  >
                    {[0, 1, 2, 3, 4, 5].map((g) => (
                      <option key={g} value={g}>
                        Cấp {g} {g === baselineBurland ? '(Hiện trường)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Tầm quan trọng I (V1) */}
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Tầm Quan Trọng Công Năng (I):</span>
                    <span className="text-[11px] text-slate-400">Gốc: {baselineImportance}đ</span>
                  </div>
                  <select
                    value={importanceScore}
                    onChange={(e) => setImportanceScore(Number(e.target.value))}
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-800"
                  >
                    <option value={0}>0.0đ - Đất trống / Nhà bỏ hoang</option>
                    <option value={2}>2.0đ - Nhà ở dân dụng bình thường</option>
                    <option value={3}>3.0đ - Công trình quan trọng nhóm II</option>
                    <option value={4}>4.0đ - Công trình đặc biệt nguy cấp nhóm I</option>
                  </select>
                </div>

                {/* 3. Tổng điểm ECS & Hạng */}
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Tổng Điểm Hư Hỏng ECS:</span>
                    <span className="text-[11px] text-slate-400">Gốc: {baselineTotalEcs}/24 ({baselineEcsClass})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={totalEcs}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTotalEcs(val);
                        setEcsClass(val <= 5 ? 'GOOD' : val <= 10 ? 'MEDIUM' : val <= 16 ? 'DEFICIENT' : 'CRITICAL');
                      }}
                      className="w-20 p-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-800"
                    />
                    <select
                      value={ecsClass}
                      onChange={(e) => setEcsClass(e.target.value)}
                      className="flex-1 p-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-800"
                    >
                      <option value="GOOD">GOOD (Tốt)</option>
                      <option value="MEDIUM">MEDIUM (Trung bình)</option>
                      <option value="DEFICIENT">DEFICIENT (Xuống cấp)</option>
                      <option value="CRITICAL">CRITICAL (Nguy cấp)</option>
                    </select>
                  </div>
                </div>

                {/* 4. Chỉ số nhạy cảm VI & Hạng */}
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Chỉ Số Dễ Tổn Thương VI:</span>
                    <span className="text-[11px] text-slate-400">Gốc: {baselineAvgVi.toFixed(2)} ({baselineViClass})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      max={4}
                      value={avgVi}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setAvgVi(val);
                        setViClass(val < 1.5 ? 'LOW' : val < 2.5 ? 'MEDIUM' : val < 3.5 ? 'HIGH' : 'VERY_HIGH');
                      }}
                      className="w-20 p-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-800"
                    />
                    <select
                      value={viClass}
                      onChange={(e) => setViClass(e.target.value)}
                      className="flex-1 p-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-800"
                    >
                      <option value="LOW">LOW (Thấp)</option>
                      <option value="MEDIUM">MEDIUM (Trung bình)</option>
                      <option value="HIGH">HIGH (Cao)</option>
                      <option value="VERY_HIGH">VERY_HIGH (Rất cao)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Tên Kỹ sư & Căn cứ kỹ thuật */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
              3. Kỹ sư kết cấu thực hiện phán quyết (*):
            </label>
            <input
              type="text"
              value={engineerName}
              onChange={(e) => setEngineerName(e.target.value)}
              placeholder="VD: KS. Trần Quốc Hùng (Zone Admin)"
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
              4. Căn cứ & Lý giải chuyên môn kỹ thuật kết cấu (*) (Tối thiểu 10 ký tự):
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập nhận định kỹ thuật chi tiết (VD: Vết nứt 1.2mm nằm trên dầm chuyển sát hố đào Metro cách 3.2m, nguy cơ trượt cắt cao, quyết định nâng cấp nguy cơ lên Grade 4 và phân loại VI High để bắt buộc lắp mốc quan trắc)..."
              className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Đang lưu phán quyết...' : 'Lưu phán quyết kỹ sư'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
