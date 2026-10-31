import React, { useState } from 'react';
import { AlertTriangle, CheckCheck, RotateCcw } from 'lucide-react';
import { api } from '../../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';

const MIN_REASON_LENGTH = 10;

interface AbsenceVerificationPanelProps {
  reportId: string;
  unitId?: string | null;
  entityLabel: string;
  missingEvidence: string[];
  isVerified: boolean;
  isApproved: boolean;
  onRefresh?: () => void;
}

/** Xác nhận vắng hoặc mở lại khảo sát; thiếu minh chứng thì Admin tự chịu trách nhiệm bằng lý do giải trình. */
export const AbsenceVerificationPanel: React.FC<AbsenceVerificationPanelProps> = ({
  reportId,
  unitId,
  entityLabel,
  missingEvidence,
  isVerified,
  isApproved,
  onRefresh,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiverReason, setWaiverReason] = useState('');
  const [isReopening, setIsReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  const hasMissingEvidence = missingEvidence.length > 0;
  const trimmedWaiver = waiverReason.trim();
  const trimmedReopen = reopenReason.trim();
  const canVerify = !isSubmitting && (!hasMissingEvidence || trimmedWaiver.length >= MIN_REASON_LENGTH);
  const canReopen = !isSubmitting && trimmedReopen.length >= MIN_REASON_LENGTH;

  const handleVerify = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post(`/admin/reports/${reportId}/approve-absentee`, {
        judgementNotes: trimmedWaiver || `Xác thực pháp lý hồ sơ vắng mặt ${entityLabel}`,
      });
      onRefresh?.();
    } catch (err: unknown) {
      console.error('[AbsenceVerificationPanel:verify] Lỗi xác thực hồ sơ vắng mặt:', err);
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopen = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post(`/admin/reports/${reportId}/revert-to-draft`, {
        unitId: unitId ?? undefined,
        reason: trimmedReopen,
        reopenAbsentSurvey: true,
      });
      onRefresh?.();
    } catch (err: unknown) {
      console.error('[AbsenceVerificationPanel:reopen] Lỗi mở lại khảo sát:', err);
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerified) {
    return (
      <div className="space-y-2">
        <span className="inline-flex px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 items-center gap-1.5">
          <CheckCheck className="w-4 h-4" /> Đã xác thực vắng mặt
        </span>
        <p className="text-[11px] text-slate-600">
          Hồ sơ đã khóa bất biến. Khi chủ hộ liên hệ lại, Super Admin phải mở khóa trước khi khảo sát lại.
        </p>
      </div>
    );
  }

  if (isApproved) return null;

  return (
    <div className="space-y-3">
      {hasMissingEvidence && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 space-y-2">
          <div className="flex items-start gap-2 text-xs font-bold text-rose-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>THIẾU MINH CHỨNG VẮNG MẶT: {missingEvidence.join(', ')}</span>
          </div>
          <p className="text-[11px] text-rose-800">
            Nên trả về để khảo sát viên bổ sung. Nếu vẫn xác nhận, bắt buộc ghi lý do giải trình.
          </p>
          <input
            type="text"
            value={waiverReason}
            onChange={(e) => setWaiverReason(e.target.value)}
            placeholder={`Lý do xác nhận khi thiếu minh chứng (tối thiểu ${MIN_REASON_LENGTH} ký tự)...`}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-rose-300 text-xs font-semibold text-slate-800"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canVerify}
          onClick={handleVerify}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-700 text-white hover:bg-purple-800 flex items-center gap-1.5 shadow-xs ${
            canVerify ? 'cursor-pointer' : 'disabled:opacity-50 cursor-not-allowed'
          }`}
        >
          <CheckCheck className="w-4 h-4" />
          <span>{isSubmitting ? 'Đang xử lý...' : 'Xác Nhận Vắng Mặt Hợp Lệ'}</span>
        </button>
        <button
          type="button"
          onClick={() => setIsReopening(!isReopening)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Mở Lại Khảo Sát</span>
        </button>
      </div>

      {isReopening && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <p className="text-[11px] text-slate-600">
            Dùng khi chủ hộ đã liên hệ lại. Ảnh tiếp cận và nhật ký vắng được giữ nguyên, khảo sát viên làm tiếp form đầy đủ.
          </p>
          <input
            type="text"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder={`Lý do mở lại (tối thiểu ${MIN_REASON_LENGTH} ký tự)...`}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-800"
          />
          <button
            type="button"
            disabled={!canReopen}
            onClick={handleReopen}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 ${
              canReopen ? 'cursor-pointer' : 'disabled:opacity-50 cursor-not-allowed'
            }`}
          >
            Xác Nhận Mở Lại
          </button>
        </div>
      )}

      {error && <div className="p-2 rounded-lg bg-rose-100 text-rose-800 text-xs font-bold">{error}</div>}
    </div>
  );
};
