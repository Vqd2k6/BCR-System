import React, { useState, useEffect } from 'react';
import {
  Cloud,
  HardDrive,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  X,
  ExternalLink,
  Image as ImageIcon,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useStorageInfo } from '../../../core/services/storageInfoService';
import { Button } from '../../../core/components/ui/Button';
import { Badge } from '../../../core/components/ui/Badge';
import {
  SurveyPhotoAuditItem,
  retryUploadSinglePhoto,
} from '../utils/photoSyncAudit';
import { uploadQueue } from '../../../core/services/uploadQueueService';
import { ImageZoomModal } from '../../../components/common/ImageZoomModal';
import { resolveOfflinePhotoUrl, getSafeDisplayUrl } from '../../../core/storage/offlinePhotoStorage';
import api from '../../../services/api';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';

interface CloudPhotoSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  allPhotos: SurveyPhotoAuditItem[];
  unsyncedPhotos: SurveyPhotoAuditItem[];
  syncedPhotos: SurveyPhotoAuditItem[];
  parcelCode: string;
  onNavigateToStep: (step: number) => void;
  isFromSubmitAttempt?: boolean;
  onProceedSubmitAnyway?: () => void;
}

const SyncPhotoThumbnailItem: React.FC<{
  url: string;
  fieldTitle: string;
  onClick: () => void;
}> = ({ url, fieldTitle, onClick }) => {
  const [displayUrl, setDisplayUrl] = useState<string>(() => getSafeDisplayUrl(url));
  const [isResolving, setIsResolving] = useState<boolean>(true);

  useEffect(() => {
    let isSubscribed = true;
    if (url) {
      const immediate = getSafeDisplayUrl(url);
      if (immediate && isSubscribed) {
        setDisplayUrl(immediate);
        setIsResolving(false);
      }
      resolveOfflinePhotoUrl(url)
        .then((resolved) => {
          if (isSubscribed) {
            if (resolved) setDisplayUrl(resolved);
            setIsResolving(false);
          }
        })
        .catch(() => {
          if (isSubscribed) setIsResolving(false);
        });
    } else {
      setDisplayUrl('');
      setIsResolving(false);
    }
    return () => {
      isSubscribed = false;
    };
  }, [url]);

  const currentSrc = displayUrl || getSafeDisplayUrl(url);

  return (
    <div
      onClick={onClick}
      className="relative w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 cursor-pointer group"
      title="Bấm để xem ảnh phóng to"
    >
      {currentSrc ? (
        <img
          src={currentSrc}
          alt={fieldTitle}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px] text-center p-1 leading-tight">
          {isResolving ? 'Nạp...' : 'Chưa có trên máy'}
        </div>
      )}
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
        <ImageIcon size={14} />
      </div>
    </div>
  );
};

export const CloudPhotoSyncModal: React.FC<CloudPhotoSyncModalProps> = ({
  isOpen,
  onClose,
  allPhotos,
  unsyncedPhotos,
  syncedPhotos,
  parcelCode,
  onNavigateToStep,
  isFromSubmitAttempt = false,
  onProceedSubmitAnyway,
}) => {
  const storageInfo = useStorageInfo();
  const [activeTab, setActiveTab] = useState<'UNSYNCED' | 'SYNCED' | 'ALL'>('UNSYNCED');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; code?: string } | null>(null);

  // Mặc định chọn tab UNSYNCED nếu có ảnh chưa đồng bộ, ngược lại chọn ALL
  useEffect(() => {
    if (unsyncedPhotos.length > 0) {
      setActiveTab('UNSYNCED');
    } else {
      setActiveTab('ALL');
    }
  }, [unsyncedPhotos.length, isOpen]);

  if (!isOpen) return null;

  const total = allPhotos.length;
  const syncedCount = syncedPhotos.length;
  const unsyncedCount = unsyncedPhotos.length;
  const percent = total > 0 ? Math.round((syncedCount / total) * 100) : 100;

  const displayedList =
    activeTab === 'UNSYNCED'
      ? unsyncedPhotos
      : activeTab === 'SYNCED'
      ? syncedPhotos
      : allPhotos;

  const persistSyncedPhotosToServer = async () => {
    try {
      const store = usePhase1SurveyStore.getState();
      store.saveDraftToStorage();
      const targetId = store.formData.parcelId || store.activeParcel?.id || parcelCode;
      if (targetId) {
        await api.patch(`/reports/${targetId}/survey-data`, {
          surveyDataJson: store.formData,
        });
      }
    } catch (persistErr) {
      console.warn('[CloudPhotoSyncModal] Tự động cập nhật survey-data lên máy chủ:', persistErr);
    }
  };

  const handleRetrySingle = async (item: SurveyPhotoAuditItem) => {
    setRetryingId(item.id);
    try {
      await retryUploadSinglePhoto(item, parcelCode);
      await persistSyncedPhotosToServer();
    } catch (err: any) {
      alert(`Không thể tải lại ảnh: ${err?.message || 'Lỗi lưu trữ ảnh'}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAll = async () => {
    setIsRetryingAll(true);
    let successCount = 0;
    let failCount = 0;
    let lastErrorMsg = '';

    try {
      for (const item of unsyncedPhotos) {
        try {
          await retryUploadSinglePhoto(item, parcelCode);
          successCount++;
        } catch (e: any) {
          failCount++;
          lastErrorMsg = e?.message || '';
          console.warn('Lỗi tải lại ảnh đơn:', e);
        }
      }
      if (successCount > 0) {
        await persistSyncedPhotosToServer();
        alert(`Đã lưu thành công ${successCount} ảnh vào ${storageInfo.providerLabel} an toàn!`);
      }
      if (failCount > 0 && successCount === 0) {
        alert(
          `Không thể tải lên ${failCount} ảnh thiếu.\n\nNguyên nhân: ${
            lastErrorMsg || 'Dữ liệu ảnh gốc không có trên thiết bị này.'
          }`
        );
      }
    } finally {
      setIsRetryingAll(false);
    }
  };

  const handleGoToStep = (step: number) => {
    onClose();
    onNavigateToStep(step);
  };

  const StorageHeaderIcon = storageInfo.isLocal ? HardDrive : Cloud;

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                unsyncedCount > 0
                  ? 'bg-amber-100 text-amber-700'
                  : storageInfo.isLocal
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <StorageHeaderIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                Kiểm Tra Ảnh Đã Lưu Trữ
                {unsyncedCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    Thiếu {unsyncedCount} ảnh
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    100% Hoàn tất
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mã thửa: <span className="font-mono font-bold text-slate-700">{parcelCode}</span> • Nơi lưu: <span className="font-semibold text-slate-700">{storageInfo.providerLabel}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress Bar & Summary Banner */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-white space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Tiến độ lưu ảnh ({storageInfo.providerLabel}):</span>
            <span className="font-bold font-mono">
              {syncedCount}/{total} ảnh ({percent}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                percent === 100
                  ? 'bg-emerald-500'
                  : percent > 50
                  ? 'bg-blue-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          {isFromSubmitAttempt && unsyncedCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-800 text-xs mt-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900">CHƯA THỂ NỘP HỒ SƠ DO CÒN ẢNH CHƯA ĐỒNG BỘ</p>
                <p className="mt-0.5 leading-relaxed text-amber-800">
                  Hệ thống phát hiện <strong>{unsyncedCount} ảnh</strong> mới chỉ lưu tạm trên thiết bị (chưa lưu vào {storageInfo.providerLabel}). Hãy bấm <strong>"Tải lại ảnh này"</strong> hoặc bấm <strong>"Đi tới bước này"</strong> để kiểm tra lại ảnh trước khi nộp.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Filter Tabs & Quick Action */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('UNSYNCED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'UNSYNCED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {storageInfo.unsyncedText} ({unsyncedCount})
            </button>
            <button
              onClick={() => setActiveTab('SYNCED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'SYNCED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {storageInfo.isLocal ? 'Đã lưu Local' : 'Đã lên Cloud'} ({syncedCount})
            </button>
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Tất cả ({total})
            </button>
          </div>

          {unsyncedCount > 0 && (
            <Button
              size="sm"
              onClick={handleRetryAll}
              disabled={isRetryingAll}
              icon={<RefreshCw size={13} className={isRetryingAll ? 'animate-spin' : ''} />}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs"
            >
              {isRetryingAll ? 'Đang tải lại tất cả...' : 'Tải lại tất cả ảnh thiếu'}
            </Button>
          )}
        </div>

        {/* Photo List Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {displayedList.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 font-mono text-xl font-bold flex items-center justify-center mx-auto mb-2">
                ✓
              </div>
              <p className="font-bold text-sm text-slate-700">Tuyệt vời! Không có ảnh nào chưa lưu trữ</p>
              <p className="text-xs text-slate-500 mt-1">
                Tất cả hình ảnh đã được dập watermark và đồng bộ an toàn trên {storageInfo.providerLabel}.
              </p>
            </div>
          ) : (
            displayedList.map((item) => {
              const isRetrying = retryingId === item.id;
              const isMissingCloud = !item.isCloudUrl;

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isMissingCloud
                      ? 'bg-amber-50/40 border-amber-200/80 shadow-xs'
                      : 'bg-white border-slate-200/80'
                  }`}
                >
                  {/* Photo Thumbnail + Info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Thumbnail Preview */}
                    <SyncPhotoThumbnailItem
                      url={item.url}
                      fieldTitle={item.fieldTitle}
                      onClick={() =>
                        setPreviewImage({
                          url: item.url,
                          title: item.fieldTitle,
                          code: item.photoCode,
                        })
                      }
                    />

                    {/* Metadata Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                          {item.stepTitle.split(':')[0]}
                        </span>
                        <h4 className="font-bold text-xs text-slate-800 truncate">
                          {item.fieldTitle}
                        </h4>
                      </div>

                      {item.photoCode && (
                        <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                          ID: <span className="text-slate-700 font-semibold">{item.photoCode}</span>
                        </p>
                      )}

                      {/* Status indicator */}
                      <div className="flex items-center gap-1.5 mt-1">
                        {isMissingCloud ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                            <AlertCircle size={12} className="text-amber-600" />
                            {item.isBase64
                              ? `Chưa đồng bộ (Lưu tạm Base64 trên máy)`
                              : `Chưa đồng bộ (Lưu tạm Offline trên thiết bị)`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <ShieldCheck size={12} className="text-emerald-600" />
                            {storageInfo.syncedText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {/* Nút Đi tới bước này */}
                    <button
                      type="button"
                      onClick={() => handleGoToStep(item.step)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                      title={`Chuyển tới ${item.stepTitle}`}
                    >
                      <span>Tới Bước {item.step}</span>
                      <ArrowRight size={12} />
                    </button>

                    {/* Nút Thử tải lại ảnh */}
                    {isMissingCloud && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetrySingle(item)}
                        disabled={isRetrying || isRetryingAll}
                        icon={<RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />}
                        className="border-amber-300 text-amber-800 hover:bg-amber-100 text-xs font-semibold"
                      >
                        {isRetrying ? 'Đang tải...' : 'Tải lại'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <Button size="sm" variant="outline" onClick={onClose}>
            Đóng cửa sổ
          </Button>

          {isFromSubmitAttempt && unsyncedCount > 0 && onProceedSubmitAnyway && (
            <Button
              size="sm"
              variant="outline"
              onClick={onProceedSubmitAnyway}
              className="border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold"
            >
              Vẫn nộp ngay (Bỏ qua ảnh chưa đồng bộ)
            </Button>
          )}
        </div>
      </div>

      {/* Lightbox Preview Modal with Zoom, Pan, Rotate */}
      {previewImage && (
        <ImageZoomModal
          isOpen={Boolean(previewImage)}
          imageUrl={previewImage.url}
          title={previewImage.title}
          photoCode={previewImage.code}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
};
