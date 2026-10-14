import { getErrorMessage } from '@/utils/errorUtils';
import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, CheckCircle2, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { api } from '../../../../services/api';

export interface RiskCardData {
  e1_burland_score?: number | string;
  total_ecs_score?: number | string;
  ecs_class?: string;
  v1_importance_score?: number | string;
  avg_vi_score?: number | string;
  vi_class?: string;
  is_engineering_judgement_applied?: boolean;
  engineering_judgement_action?: 'UPGRADE' | 'DOWNGRADE' | 'KEEP';
  engineering_judgement_reason?: string;
  judgement_engineer_name?: string;
  overridden_total_ecs?: number | string | null;
  overridden_ecs_class?: string;
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
  riskCard,
  data,
  onClose,
  onSuccess,
}) => {
  const [action, setAction] = useState<'UPGRADE' | 'DOWNGRADE' | 'KEEP'>('UPGRADE');
  const [reason, setReason] = useState('');
  const [engineerName, setEngineerName] = useState('Kỹ Sư Trưởng Zone Admin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 2 Chỉ số cốt lõi: ECS & VI
  const rawSurveyJson = data?.surveyJson as Record<string, Record<string, unknown>> | undefined;
  const baselineTotalEcs = Number(riskCard?.total_ecs_score ?? rawSurveyJson?.ecs?.totalEcs ?? 0);
  const baselineAvgVi = Number(riskCard?.avg_vi_score ?? rawSurveyJson?.vi?.avgVi ?? 1.0);

  const [totalEcs, setTotalEcs] = useState<number>(baselineTotalEcs);
  const [avgVi, setAvgVi] = useState<number>(baselineAvgVi);

  const e2StructureScore = Number(riskCard?.e2_structure_score ?? 0);
  const isSafetyLocked = e2StructureScore >= 3;

  // Tính định tính tự động từ định lượng theo chuẩn backend
  const calculatedEcsClass: 'GOOD' | 'MEDIUM' | 'DEFICIENT' | 'CRITICAL' =
    totalEcs <= 5 ? 'GOOD' : totalEcs <= 10 ? 'MEDIUM' : totalEcs <= 16 ? 'DEFICIENT' : 'CRITICAL';

  const calculatedViClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' =
    avgVi < 1.5 ? 'LOW' : avgVi < 2.5 ? 'MEDIUM' : avgVi < 3.5 ? 'HIGH' : 'VERY_HIGH';

  useEffect(() => {
    if (isOpen) {
      if (riskCard?.is_engineering_judgement_applied) {
        const rawAction = riskCard.engineering_judgement_action as 'UPGRADE' | 'DOWNGRADE' | 'KEEP' | undefined;
        setAction(rawAction === 'KEEP' ? 'KEEP' : rawAction === 'DOWNGRADE' ? 'DOWNGRADE' : 'UPGRADE');
        setReason(riskCard.engineering_judgement_reason || '');
        if (riskCard.judgement_engineer_name) setEngineerName(riskCard.judgement_engineer_name);
        if (riskCard.overridden_total_ecs !== null && riskCard.overridden_total_ecs !== undefined) {
          setTotalEcs(Number(riskCard.overridden_total_ecs));
        } else {
          setTotalEcs(baselineTotalEcs);
        }
        if (riskCard.overridden_avg_vi !== null && riskCard.overridden_avg_vi !== undefined) {
          setAvgVi(Number(riskCard.overridden_avg_vi));
        } else {
          setAvgVi(baselineAvgVi);
        }
      } else {
        setAction('UPGRADE');
        setReason('');
        setTotalEcs(baselineTotalEcs);
        setAvgVi(baselineAvgVi);
      }
      setErrorMsg('');
    }
  }, [isOpen, riskCard, baselineTotalEcs, baselineAvgVi]);

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
      const payload = {
        action,
        reason: reason.trim(),
        engineerName: engineerName.trim(),
        overrides:
          action !== 'KEEP'
            ? {
                totalEcs: Number(totalEcs),
                ecsClass: calculatedEcsClass,
                avgVi: Number(avgVi),
                viClass: calculatedViClass,
              }
            : undefined,
      };

      const res = await api.post(`/admin/reports/${reportId}/engineering-judgement`, payload);

      if (res.data?.success || res.status === 200) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Không thể lưu can thiệp chuyên gia.');
      }
    } catch (err: unknown) {
      console.error('[EngineeringJudgementModal] Error:', err);
      setErrorMsg(getErrorMessage(err, 'Lỗi kết nối khi lưu can thiệp kỹ sư.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderEcsBadge = (cls: string) => {
    switch (cls) {
      case 'GOOD':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Tốt / Rất Thấp (≤5đ)</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">Trung Bình (6-10đ)</span>;
      case 'DEFICIENT':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">Xuống Cấp / Cao (11-16đ)</span>;
      case 'CRITICAL':
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">Nguy Cấp / Rất Cao (&gt;16đ)</span>;
    }
  };

  const renderViBadge = (cls: string) => {
    switch (cls) {
      case 'LOW':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Tổn Thương Thấp (&lt;1.5)</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">Trung Bình (1.5 - 2.5)</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">Tổn Thương Cao (2.5 - 3.5)</span>;
      case 'VERY_HIGH':
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">Rất Cao (&gt;3.5)</span>;
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
              <h3 className="text-base font-black tracking-tight">Phán Quyết Kỹ Sư Trưởng (Chuyên Môn Kết Cấu)</h3>
              <p className="text-xs text-indigo-100 mt-0.5">
                Thửa: <strong>{parcelCode}</strong> • ECS gốc: {baselineTotalEcs}đ • VI gốc: {baselineAvgVi.toFixed(2)}
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
            <span>
              CẢNH BÁO AN TOÀN: Công trình có khuyết tật dầm/cột chịu lực E2 ≥ 3 (Nguy cấp). Khóa chức năng Hạ mức (DOWNGRADE).
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {/* 1. Chọn Hành động (Chỉ 3 nút: Nâng / Hạ / Giữ) */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              1. Mục đích hành động can thiệp chuyên môn:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setAction('UPGRADE')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  action === 'UPGRADE'
                    ? 'border-rose-500 bg-rose-50/80 text-rose-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                <TrendingUp className={`w-4 h-4 mx-auto mb-1 ${action === 'UPGRADE' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span className="text-xs block font-bold">Nâng mức độ</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Tăng nguy cơ do lân cận hố đào</span>
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
                className={`p-3 rounded-xl border text-center transition-all ${
                  isSafetyLocked
                    ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200'
                    : action === 'DOWNGRADE'
                    ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 font-bold shadow-xs cursor-pointer'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white cursor-pointer'
                }`}
              >
                <TrendingDown className={`w-4 h-4 mx-auto mb-1 ${action === 'DOWNGRADE' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="text-xs block font-bold">Hạ mức độ</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Nứt vữa thứ cấp / đã gia cố</span>
              </button>

              <button
                type="button"
                onClick={() => setAction('KEEP')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  action === 'KEEP'
                    ? 'border-indigo-500 bg-indigo-50/80 text-indigo-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                <Minus className={`w-4 h-4 mx-auto mb-1 ${action === 'KEEP' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="text-xs block font-bold">Giữ nguyên gốc</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Khôi phục kết quả hiện trường</span>
              </button>
            </div>
          </div>

          {/* 2. Ma trận 2 Thông số cốt lõi: ECS & VI (Định lượng tự động quyết định Định tính) */}
          {action !== 'KEEP' ? (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  2. Điều chỉnh 2 chỉ số cốt lõi (ECS & VI):
                </span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                  Định tính tự động tính theo ngưỡng chuẩn
                </span>
              </div>

              {/* Trục 1: Tổng Điểm Hư Hỏng Kết Cấu ECS */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-800">Điểm Hư Hỏng Kết Cấu (ECS):</span>
                    <span className="text-[11px] font-semibold text-slate-400">Gốc: {baselineTotalEcs}/24đ</span>
                  </div>
                  {renderEcsBadge(calculatedEcsClass)}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={24}
                    value={totalEcs}
                    onChange={(e) => setTotalEcs(Number(e.target.value))}
                    className="flex-1 accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={totalEcs}
                      onChange={(e) => setTotalEcs(Math.max(0, Math.min(24, Number(e.target.value))))}
                      className="w-16 p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 text-center"
                    />
                    <span className="text-xs text-slate-500 font-bold">/ 24</span>
                  </div>
                </div>
              </div>

              {/* Trục 2: Chỉ Số Dễ Tổn Thương VI */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-800">Chỉ Số Dễ Tổn Thương (VI):</span>
                    <span className="text-[11px] font-semibold text-slate-400">Gốc: {baselineAvgVi.toFixed(2)}</span>
                  </div>
                  {renderViBadge(calculatedViClass)}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    step="0.05"
                    min={0}
                    max={4}
                    value={avgVi}
                    onChange={(e) => setAvgVi(parseFloat(e.target.value))}
                    className="flex-1 accent-purple-600 cursor-pointer"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      max={4}
                      value={avgVi}
                      onChange={(e) => setAvgVi(Math.max(0, Math.min(4, parseFloat(e.target.value) || 0)))}
                      className="w-16 p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 text-center"
                    />
                    <span className="text-xs text-slate-500 font-bold">/ 4.0</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 text-xs text-indigo-900 space-y-1">
              <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <span>Khôi Phục Toàn Vẹn Số Liệu Gốc Hiện Trường</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Khi chọn <strong>Giữ nguyên gốc</strong>, mọi ghi đè can thiệp kỹ sư trưởng trước đây sẽ được gỡ bỏ. Hồ sơ sẽ áp dụng chính xác điểm số ECS = {baselineTotalEcs} và VI = {baselineAvgVi.toFixed(2)} tự động tính toán từ biên bản khảo sát hiện trường.
              </p>
            </div>
          )}

          {/* 3. Tên Kỹ sư & Căn cứ kỹ thuật */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                2. Kỹ sư kết cấu thực hiện phán quyết (*):
              </label>
              <input
                type="text"
                value={engineerName}
                onChange={(e) => setEngineerName(e.target.value)}
                placeholder="VD: KS. Trần Quốc Hùng (Zone Admin)"
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                3. Căn cứ & Lý giải chuyên môn kỹ thuật kết cấu (*) (Tối thiểu 10 ký tự):
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập nhận định kỹ thuật chi tiết (VD: Vết nứt 1.2mm nằm trên dầm chuyển sát hố đào Metro cách 3.2m, nguy cơ trượt cắt cao, quyết định nâng ECS lên 14đ và phân loại VI High để bắt buộc lắp mốc quan trắc lún nghiêng)..."
                className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
              />
            </div>
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
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Đang lưu phán quyết...' : 'Lưu Phán Quyết Kỹ Sư'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
