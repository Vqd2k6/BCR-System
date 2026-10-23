import React, { useState, useEffect, useCallback } from 'react';
import {
  FilePlus2,
  RefreshCw,
  AlertCircle,
  History,
  Download,
  Eye,
  Copy,
  Check,
  X,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../../../../../services/api';
import { useAuth } from '../../../../../../context/AuthContext';
import { getErrorMessage } from '@/utils/errorUtils';

export interface ReleaseRecordItem {
  id?: string;
  revision: number;
  reason?: string;
  sha256: string;
  fileSizeBytes?: number;
  releasedByUserId?: string;
  releasedByName?: string | null;
  releasedByRole?: string | null;
  releasedAt: string;
}

interface ReleaseRevisionPanelProps {
  reportId: string;
  isApproved?: boolean;
  selectedRevision?: number;
  onSelectRevision?: (rev?: number) => void;
  onDownloadRevisionPdf?: (rev: number) => void;
  onFeedback: (type: 'success' | 'error' | 'info', text: string) => void;
}

interface ReleaseSummaryResponse {
  success: boolean;
  data: ReleaseRecordItem[];
  hasPendingRelease?: boolean;
  latestRelease?: ReleaseRecordItem | null;
  currentExportRevision?: number;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '–';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Trung tâm Quản lý & Truy xuất Phiên bản Phát hành (Revision Selector, History Log & Release Issuer)
 * - Cho phép chọn xem trước HTML / JSON và tải PDF theo từng phiên bản đã phát hành (Rev.00, Rev.01...)
 * - Hiển thị bảng lịch sử phát hành kèm người phát hành, lý do, dung lượng và mã băm toàn vẹn SHA-256
 * - Phát hành Rev mới cho báo cáo đã APPROVED (bắt buộc lý do ≥ 10 ký tự)
 */
export const ReleaseRevisionPanel: React.FC<ReleaseRevisionPanelProps> = ({
  reportId,
  isApproved = true,
  selectedRevision,
  onSelectRevision,
  onDownloadRevisionPdf,
  onFeedback,
}) => {
  const { user } = useAuth();
  const [openIssueForm, setOpenIssueForm] = useState<boolean>(false);
  const [openHistoryModal, setOpenHistoryModal] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [releases, setReleases] = useState<ReleaseRecordItem[]>([]);
  const [hasPendingRelease, setHasPendingRelease] = useState<boolean>(false);
  const [currentExportRevision, setCurrentExportRevision] = useState<number>(0);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const fetchReleaseStatus = useCallback(async (): Promise<void> => {
    if (!reportId || !isApproved) return;
    try {
      const res = await api.get<ReleaseSummaryResponse>(`/reports/${encodeURIComponent(reportId)}/releases`);
      setReleases(Array.isArray(res.data?.data) ? res.data.data : []);
      setHasPendingRelease(Boolean(res.data?.hasPendingRelease));
      if (typeof res.data?.currentExportRevision === 'number') {
        setCurrentExportRevision(res.data.currentExportRevision);
      }
    } catch (err: unknown) {
      console.warn('[ReleaseRevisionPanel] Không thể kiểm tra trạng thái release:', getErrorMessage(err));
    }
  }, [reportId, isApproved]);

  useEffect(() => {
    void fetchReleaseStatus();
  }, [fetchReleaseStatus]);

  // Chỉ hiển thị cho Zone Admin / Super Admin và khi hồ sơ đã APPROVED
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ZONE_ADMIN') || !isApproved) {
    return null;
  }

  const submitNewRelease = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await api.post<{ data: ReleaseRecordItem }>(`/reports/${encodeURIComponent(reportId)}/releases`, {
        reason: reason.trim(),
      });
      const rel = res.data.data;
      onFeedback(
        'success',
        `Đã phát hành chính thức Rev.${String(rel.revision).padStart(2, '0')} (SHA-256: ${rel.sha256.substring(0, 12)}…).`
      );
      setOpenIssueForm(false);
      setReason('');
      setHasPendingRelease(false);
      await fetchReleaseStatus();
      if (onSelectRevision) {
        onSelectRevision(rel.revision);
      }
    } catch (err: unknown) {
      console.error('[ReleaseRevision] Phát hành Rev thất bại:', err);
      onFeedback('error', `Không thể phát hành Rev mới: ${getErrorMessage(err, 'Lỗi server')}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCopySha = async (sha: string) => {
    try {
      await navigator.clipboard.writeText(sha);
      setCopiedSha(sha);
      setTimeout(() => setCopiedSha(null), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 relative">
      {/* 1. Bộ chọn phiên bản Rev (Dropdown) */}
      {(releases.length > 0 || hasPendingRelease) && onSelectRevision && (
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs">
          <span className="font-semibold text-slate-600">Phiên bản:</span>
          <select
            value={selectedRevision === undefined ? 'LATEST' : String(selectedRevision)}
            onChange={(e) => {
              const val = e.target.value;
              onSelectRevision(val === 'LATEST' ? undefined : Number(val));
            }}
            className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            title="Chọn phiên bản phát hành (Rev) để xem trước HTML, JSON hoặc tải PDF tương ứng"
          >
            <option value="LATEST">
              {hasPendingRelease
                ? `Bản duyệt mới nhất (Chờ phát hành Rev.${String(currentExportRevision + 1).padStart(2, '0')})`
                : `Hiện hành (Rev.${String(currentExportRevision).padStart(2, '0')})`}
            </option>
            {releases.map((r) => (
              <option key={r.revision} value={String(r.revision)}>
                Rev.{String(r.revision).padStart(2, '0')} — {new Date(r.releasedAt).toLocaleDateString('vi-VN')}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 2. Nút mở Bảng Lịch sử Phát hành (Revision History) */}
      {releases.length > 0 && (
        <button
          type="button"
          onClick={() => setOpenHistoryModal((prev) => !prev)}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
          title="Xem danh sách các bản Rev đã phát hành, mã toàn vẹn SHA-256 và tải lại từng bản PDF gốc"
        >
          <History size={14} className="text-sky-600" />
          <span>Lịch sử Rev ({releases.length})</span>
        </button>
      )}

      {/* 3. Cảnh báo có cập nhật mới sau khi phê duyệt lại */}
      {hasPendingRelease && (
        <span
          className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm animate-pulse"
          title="Hồ sơ đã được phê duyệt lại sau hiệu chỉnh. Bấm 'Phát hành Rev mới' để khóa file PDF chính thức tiếp theo."
        >
          <AlertCircle size={14} className="text-amber-600 shrink-0" />
          <span>Có cập nhật mới – Chờ phát hành Rev mới</span>
        </span>
      )}

      {/* 4. Form / Nút Phát hành Rev mới */}
      {openIssueForm ? (
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
            onClick={submitNewRelease}
            disabled={busy || reason.trim().length < 10}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {busy ? <RefreshCw size={14} className="animate-spin" /> : <FilePlus2 size={14} />}
            <span>Xác nhận phát hành</span>
          </button>
          <button
            type="button"
            onClick={() => setOpenIssueForm(false)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
          >
            Hủy
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setOpenIssueForm(true)}
          className="px-3.5 py-2 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
          title="Phát hành phiên bản Rev chính thức mới kèm lý do kiểm toán và lưu file PDF bất biến (SHA-256)"
        >
          <FilePlus2 size={14} />
          <span>Phát hành Rev mới</span>
        </button>
      )}

      {/* 5. Popover / Modal Lịch sử các bản phát hành (Rev.00, Rev.01...) */}
      {openHistoryModal && (
        <div
          className="fixed inset-0 z-[1000000] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setOpenHistoryModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={18} className="text-emerald-600" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Sổ Cái Lưu Trữ Phiên Bản Phát Hành Chính Thức (Revision Registry)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Mỗi bản Rev được đóng băng file PDF riêng trên máy chủ kèm chữ ký băm toàn vẹn SHA-256
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenHistoryModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-2.5">
              {releases.map((item) => {
                const isSelected = selectedRevision === item.revision;
                const revLabel = `Rev.${String(item.revision).padStart(2, '0')}`;
                return (
                  <div
                    key={item.revision}
                    className={`p-3.5 rounded-xl border transition-all flex flex-wrap items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-sky-50/70 border-sky-300 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1 flex-1 min-w-[260px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-slate-900 text-white rounded-lg font-mono text-xs font-bold">
                          {revLabel}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          {new Date(item.releasedAt).toLocaleString('vi-VN')}
                        </span>
                        {item.releasedByName && (
                          <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            Người phát hành: <strong>{item.releasedByName}</strong>
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500">
                          ({formatFileSize(item.fileSizeBytes)})
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">
                        <span className="font-semibold text-slate-500">Lý do: </span>
                        {item.reason || 'Phát hành bản Final chính thức'}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                        <span>SHA-256: {item.sha256.substring(0, 24)}…</span>
                        <button
                          type="button"
                          onClick={() => handleCopySha(item.sha256)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer flex items-center gap-1"
                          title="Sao chép toàn bộ mã SHA-256"
                        >
                          {copiedSha === item.sha256 ? (
                            <Check size={12} className="text-emerald-600" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onSelectRevision && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectRevision(item.revision);
                            setOpenHistoryModal(false);
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-sky-50 border border-sky-300 text-sky-700 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5"
                        >
                          <Eye size={13} />
                          <span>Xem {revLabel}</span>
                        </button>
                      )}
                      {onDownloadRevisionPdf && (
                        <button
                          type="button"
                          onClick={() => onDownloadRevisionPdf(item.revision)}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Download size={13} />
                          <span>Tải PDF ({revLabel})</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
