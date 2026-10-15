import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  RotateCcw,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Plus,
  ShieldCheck,
  Copy,
  ExternalLink,
  ZoomIn,
  Loader2,
  AlertTriangle,
  Calendar,
  User,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';

export interface PhotoHistoryItem {
  id: string;
  report_id: string;
  parcel_id: string;
  photo_category: string;
  photo_type: string;
  photo_code: string;
  photo_url: string;
  standardized_filename: string;
  sha256_hash: string;
  size_bytes?: number;
  mime_type?: string;
  status: 'ACTIVE' | 'SUPERSEDED' | 'DELETED';
  is_deleted: boolean;
  action_type: 'INITIAL_SURVEY' | 'ADD' | 'REPLACE' | 'DELETE' | 'RESTORE';
  action_reason: string;
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  deleted_at?: string;
  deleted_by_name?: string;
  replacement_for_url?: string;
  superseded_by_url?: string;
  metadata_json?: any;
  created_at: string;
  updated_at: string;
}

export interface AuditPhotoHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  photoCode?: string;
  photoType?: string;
  photoTitle?: string;
  currentPhotoUrl?: string;
  onPhotoRestored?: () => void;
  onStageRestoreAction?: (photo: PhotoHistoryItem, reason: string) => void;
}

export const AuditPhotoHistoryModal: React.FC<AuditPhotoHistoryModalProps> = ({
  isOpen,
  onClose,
  reportId,
  photoCode,
  photoType,
  photoTitle = 'Ảnh Hiện Trường',
  currentPhotoUrl,
  onPhotoRestored,
  onStageRestoreAction,
}) => {
  const [historyItems, setHistoryItems] = useState<PhotoHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);

  // Trạng thái modal khôi phục ảnh
  const [selectedItemToRestore, setSelectedItemToRestore] = useState<PhotoHistoryItem | null>(null);
  const [restoreReason, setRestoreReason] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreError, setRestoreError] = useState<string>('');

  // Trạng thái phóng to ảnh
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!reportId) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const params: Record<string, string> = {};
      if (photoCode) params.photoCode = photoCode;
      if (photoType) params.photoType = photoType;

      const res = await api.get(`/admin/reports/${reportId}/photo-registry`, { params });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setHistoryItems(res.data.data);
      } else {
        setHistoryItems([]);
      }
    } catch (err: unknown) {
      console.error('[AuditPhotoHistoryModal] Lỗi tải lịch sử ảnh:', err);
      setErrorMessage(getErrorMessage(err, 'Không thể tải lịch sử ảnh từ sổ cái kiểm toán.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      setSelectedItemToRestore(null);
      setRestoreReason('');
      setRestoreError('');
      setZoomUrl(null);
    }
  }, [isOpen, reportId, photoCode, photoType]);

  if (!isOpen) return null;

  const handleCopySha = (sha: string, id: string) => {
    if (!sha) return;
    navigator.clipboard.writeText(sha);
    setCopySuccessId(id);
    setTimeout(() => setCopySuccessId(null), 2000);
  };

  const handleConfirmRestore = async () => {
    if (!selectedItemToRestore) return;
    if (!restoreReason.trim()) {
      setRestoreError('Vui lòng nhập lý do khôi phục ảnh bắt buộc.');
      return;
    }

    if (onStageRestoreAction) {
      onStageRestoreAction(selectedItemToRestore, restoreReason.trim());
      setSelectedItemToRestore(null);
      setRestoreReason('');
      onClose();
      return;
    }

    setIsRestoring(true);
    setRestoreError('');

    try {
      const res = await api.post(`/admin/reports/${reportId}/restore-photo`, {
        registryPhotoId: selectedItemToRestore.id,
        restoreReason: restoreReason.trim(),
      });

      if (res.data?.success) {
        setSelectedItemToRestore(null);
        setRestoreReason('');
        await fetchHistory();
        if (onPhotoRestored) {
          onPhotoRestored();
        }
      } else {
        setRestoreError(res.data?.message || 'Không thể khôi phục ảnh.');
      }
    } catch (err: unknown) {
      console.error('[AuditPhotoHistoryModal] Lỗi khôi phục ảnh:', err);
      setRestoreError(getErrorMessage(err, 'Lỗi kết nối khi gửi yêu cầu khôi phục ảnh.'));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-sky-50/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-100 text-sky-700 shadow-sm">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 tracking-tight">
                  Phả Hệ & Lịch Sử Vòng Đời Ảnh
                </h3>
                {photoCode && (
                  <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded-md bg-sky-100 text-sky-800 border border-sky-200">
                    {photoCode}
                  </span>
                )}
                {photoType && !photoCode && (
                  <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                    {photoType}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {photoTitle} • Truy xuất toàn bộ biến thiên qua các lần Thêm, Xóa, Thay thế và Khôi phục
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
              <p className="text-sm font-medium">Đang truy xuất phả hệ ảnh từ sổ cái kiểm toán...</p>
            </div>
          ) : errorMessage ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          ) : historyItems.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <History className="w-12 h-12 mx-auto stroke-1 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Chưa có lịch sử biến động cho ảnh này</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Ảnh hiện trường này chưa qua các thao tác thay thế, xóa hoặc khôi phục trong sổ cái kiểm toán.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
                <span>Tổng cộng: <strong className="text-slate-800 font-semibold">{historyItems.length}</strong> phiên bản ghi nhận</span>
                <span>Sắp xếp: Mới nhất đến Cũ nhất</span>
              </div>

              {/* Timeline Items */}
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                {historyItems.map((item, index) => {
                  const isActive = item.status === 'ACTIVE' && !item.is_deleted;
                  const isDeleted = item.status === 'DELETED' || item.is_deleted;
                  const isSuperseded = item.status === 'SUPERSEDED';
                  const versionNum = historyItems.length - index;

                  return (
                    <div
                      key={item.id}
                      className={`relative p-4 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-emerald-50/50 border-emerald-300 shadow-sm ring-1 ring-emerald-200'
                          : isDeleted
                          ? 'bg-rose-50/40 border-rose-200 text-slate-600'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Timeline Node Icon */}
                      <div
                        className={`absolute -left-[31px] top-4 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                          isActive
                            ? 'bg-emerald-500 border-white text-white ring-2 ring-emerald-200'
                            : isDeleted
                            ? 'bg-rose-500 border-white text-white'
                            : 'bg-slate-300 border-white text-slate-700'
                        }`}
                      >
                        {versionNum}
                      </div>

                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        {/* Info details */}
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Status Badge */}
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Đang Hiệu Lực (Active)
                              </span>
                            ) : isDeleted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <Trash2 className="w-3.5 h-3.5" />
                                Đã Bị Xóa (Deleted)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                <RefreshCw className="w-3 h-3" />
                                Đã Bị Thay Thế (Superseded)
                              </span>
                            )}

                            {/* Action Type Badge */}
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                              {item.action_type === 'INITIAL_SURVEY'
                                ? 'Khảo sát ban đầu'
                                : item.action_type === 'REPLACE'
                                ? 'Thay thế ảnh'
                                : item.action_type === 'DELETE'
                                ? 'Xóa ảnh'
                                : item.action_type === 'RESTORE'
                                ? 'Khôi phục ảnh'
                                : 'Bổ sung ảnh'}
                            </span>

                            <span className="text-xs text-slate-400 font-mono">
                              Phiên bản #{versionNum}
                            </span>
                          </div>

                          {/* Reason */}
                          <div className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-lg border border-slate-200/80">
                            <span className="font-semibold text-slate-800">Lý do điều chỉnh:</span>{' '}
                            <span className="italic">{item.action_reason || 'Không có ghi chú'}</span>
                          </div>

                          {/* Meta: Actor & Timestamp */}
                          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 pt-1">
                            <div className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{item.actor_name || 'Hệ thống'}</span>
                              {item.actor_role && (
                                <span className="text-[10px] font-mono px-1 py-0.2 bg-slate-100 rounded text-slate-600">
                                  {item.actor_role}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{new Date(item.created_at).toLocaleString('vi-VN')}</span>
                            </div>
                          </div>

                          {/* SHA-256 Tamper-Proof Hash */}
                          {item.sha256_hash && (
                            <div className="flex items-center gap-2 pt-0.5">
                              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded max-w-md truncate">
                                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span className="truncate">SHA: {item.sha256_hash}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopySha(item.sha256_hash, item.id)}
                                className="text-[11px] text-sky-600 hover:text-sky-800 flex items-center gap-0.5 cursor-pointer font-medium"
                                title="Sao chép mã băm bảo mật SHA-256"
                              >
                                {copySuccessId === item.id ? (
                                  <span className="text-emerald-600 flex items-center gap-0.5 font-bold">
                                    <CheckCircle2 className="w-3 h-3" /> Đã sao chép
                                  </span>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" /> Sao chép
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Image Preview & Restore Button */}
                        <div className="flex flex-col items-center md:items-end gap-2.5 shrink-0">
                          {item.photo_url ? (
                            <div className="relative group w-28 h-24 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 shadow-xs">
                              <img
                                src={item.photo_url}
                                alt={`Version ${versionNum}`}
                                className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${
                                  isDeleted ? 'opacity-50 grayscale' : ''
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setZoomUrl(item.photo_url)}
                                className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                                title="Xem phóng to ảnh này"
                              >
                                <ZoomIn className="w-5 h-5 drop-shadow" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-28 h-24 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 text-xs">
                              <Trash2 className="w-5 h-5 mb-1 stroke-1" />
                              <span>Không có ảnh</span>
                            </div>
                          )}

                          {/* Restore Button (Only for past versions) */}
                          {!isActive && item.photo_url && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItemToRestore(item);
                                setRestoreReason(`Khôi phục về phiên bản #${versionNum} chụp ngày ${new Date(item.created_at).toLocaleDateString('vi-VN')}`);
                                setRestoreError('');
                              }}
                              className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors shadow-xs cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
                              Khôi phục ảnh này
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Nguyên tắc bất biến: Mọi ảnh cũ trên Cloudflare R2 / S3 đều được bảo lưu vĩnh viễn</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Restore Action */}
      {selectedItemToRestore && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-sky-50/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">
                  Xác Nhận Khôi Phục Ảnh Cũ
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemToRestore(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Hành động này sẽ thiết lập bức ảnh cũ này làm ảnh chính hiện hành, tự động chụp Snapshot phiên bản mới và ghi nhận vào Sổ cái kiểm toán.
                </span>
              </div>

              {/* Preview image being restored */}
              {selectedItemToRestore.photo_url && (
                <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <img
                    src={selectedItemToRestore.photo_url}
                    alt="Restoring target"
                    className="w-16 h-14 object-cover rounded-md border border-slate-300"
                  />
                  <div className="text-xs space-y-0.5 overflow-hidden">
                    <p className="font-semibold text-slate-800 truncate">
                      {selectedItemToRestore.photo_code || photoTitle}
                    </p>
                    <p className="text-slate-500 font-mono text-[11px]">
                      {new Date(selectedItemToRestore.created_at).toLocaleString('vi-VN')}
                    </p>
                    <p className="text-slate-400 text-[10px]">
                      {selectedItemToRestore.actor_name || 'Hệ thống'}
                    </p>
                  </div>
                </div>
              )}

              {/* Reason Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Lý do khôi phục ảnh này <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  rows={3}
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  placeholder="Nhập lý do nghiệp vụ (ví dụ: Ảnh v1 có góc chụp toàn cảnh rộng và chuẩn xác hơn)..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              {restoreError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {restoreError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setSelectedItemToRestore(null)}
                disabled={isRestoring}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring || !restoreReason.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang khôi phục...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Xác nhận khôi phục
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Zoom Preview Modal */}
      {zoomUrl && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150 cursor-zoom-out"
          onClick={() => setZoomUrl(null)}
        >
          <div className="relative max-w-5xl max-h-[92vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setZoomUrl(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-1 rounded-md"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={zoomUrl}
              alt="Phóng to"
              className="max-w-full max-h-[88vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};
