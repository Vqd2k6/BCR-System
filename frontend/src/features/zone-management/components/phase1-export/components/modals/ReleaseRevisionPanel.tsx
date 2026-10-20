import React, { useState } from 'react';
import { FilePlus2, RefreshCw } from 'lucide-react';
import { api } from '../../../../../../services/api';
import { useAuth } from '../../../../../../context/AuthContext';
import { getErrorMessage } from '@/utils/errorUtils';

interface ReleaseRevisionPanelProps {
  reportId: string;
  onFeedback: (type: 'success' | 'error' | 'info', text: string) => void;
}

interface ReleaseResult {
  revision: number;
  sha256: string;
}

/**
 * Phát hành Rev mới cho báo cáo đã APPROVED (D3/D14): bắt buộc lý do ≥ 10 ký tự.
 * Chỉ Zone Admin (đúng khu) hoặc Super Admin; backend kiểm tra quyền và ghi audit log.
 */
export const ReleaseRevisionPanel: React.FC<ReleaseRevisionPanelProps> = ({ reportId, onFeedback }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ZONE_ADMIN')) return null;

  const submit = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await api.post<{ data: ReleaseResult }>(`/v3/reports/${encodeURIComponent(reportId)}/releases`, {
        reason: reason.trim(),
      });
      const rel = res.data.data;
      onFeedback('success', `Đã phát hành Rev ${String(rel.revision).padStart(2, '0')} (SHA-256: ${rel.sha256.substring(0, 12)}…).`);
      setOpen(false);
      setReason('');
    } catch (err: unknown) {
      console.error('[ReleaseRevision] Phát hành Rev thất bại:', err);
      onFeedback('error', `Không thể phát hành Rev mới: ${getErrorMessage(err, 'Lỗi server')}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {open ? (
        <>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lý do phát hành Rev mới (≥ 10 ký tự)"
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs w-72"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || reason.trim().length < 10}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {busy ? <RefreshCw size={14} className="animate-spin" /> : <FilePlus2 size={14} />}
            <span>Xác nhận phát hành</span>
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
          >
            Hủy
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-3.5 py-2 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
          title="Chỉ áp dụng cho báo cáo đã APPROVED – sinh Rev mới kèm lý do"
        >
          <FilePlus2 size={14} />
          <span>Phát hành Rev mới</span>
        </button>
      )}
    </div>
  );
};
