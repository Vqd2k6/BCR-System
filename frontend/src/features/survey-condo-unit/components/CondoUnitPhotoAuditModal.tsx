import React, { useState, useEffect, useMemo } from 'react';
import {
  Cloud,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  ImageIcon,
  Loader2,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { ImageZoomModal } from '../../../components/common/ImageZoomModal';
import { resolveOfflinePhotoUrl, getSafeDisplayUrl, replaceLocalUriInObject } from '../../../core/storage/offlinePhotoStorage';
import {
  auditCondoUnitPhotos,
  retryUploadCondoUnitPhoto,
  type CondoUnitPhotoAuditItem,
} from '../utils/condoUnitPhotoAudit';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToStep?: (step: 1 | 2 | 3 | 4) => void;
}

const PhotoThumbnailCell: React.FC<{ url: string; title: string; onClick: () => void }> = ({
  url,
  title,
  onClick,
}) => {
  const [displayUrl, setDisplayUrl] = useState<string>(() => getSafeDisplayUrl(url));

  useEffect(() => {
    let isSubscribed = true;
    if (url) {
      const immediate = getSafeDisplayUrl(url);
      if (immediate && isSubscribed) setDisplayUrl(immediate);
      resolveOfflinePhotoUrl(url).then((resolved) => {
        if (isSubscribed && resolved) setDisplayUrl(resolved);
      });
    }
    return () => {
      isSubscribed = false;
    };
  }, [url]);

  return (
    <div
      onClick={onClick}
      style={{ width: '56px', height: '56px', minWidth: '56px', minHeight: '56px', maxWidth: '56px', maxHeight: '56px' }}
      className="w-14 h-14 min-w-[56px] min-h-[56px] max-w-[56px] max-h-[56px] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer relative group flex items-center justify-center shadow-xs"
      title="Bấm để xem ảnh phóng to"
    >
      {displayUrl ? (
        <img
          src={displayUrl}
          alt={title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          className="w-full h-full object-cover block"
        />
      ) : (
        <ImageIcon className="w-5 h-5 text-slate-400" />
      )}
      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Eye className="w-4 h-4 text-white" />
      </div>
    </div>
  );
};

export const CondoUnitPhotoAuditModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onNavigateToStep,
}) => {
  const { formData } = useCondoUnitSurveyStore();
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNSYNCED' | 'SYNCED'>('ALL');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isBatchRetrying, setIsBatchRetrying] = useState(false);

  const parcelCode = formData.parentInfo?.projectParcelCode || 'GENERAL';
  const unitCode = formData.displayCode || formData.unitCode || 'UNIT';

  const audit = useMemo(() => auditCondoUnitPhotos(formData), [formData]);

  if (!isOpen) return null;

  const displayList =
    activeTab === 'UNSYNCED'
      ? audit.unsyncedPhotos
      : activeTab === 'SYNCED'
      ? audit.syncedPhotos
      : audit.allPhotos;

  const applyPromotedUrlToStore = (item: CondoUnitPhotoAuditItem, newUrl: string) => {
    const store = useCondoUnitSurveyStore.getState();
    if (item.updateInStore) {
      item.updateInStore(newUrl);
    }
    if (item.fieldKey === 'unitCadUrl') {
      store.updateFormData({ unitCadUrl: newUrl });
    } else if (item.fieldKey === 'unitStructuralCadUrl') {
      store.updateFormData({ unitStructuralCadUrl: newUrl });
    } else if (item.fieldKey.startsWith('absenteeMinutes_')) {
      const idx = parseInt(item.fieldKey.replace('absenteeMinutes_', ''), 10);
      if (!isNaN(idx)) {
        store.updateAbsenteeMinutesPhoto(idx, newUrl);
      }
    }
    const updated = replaceLocalUriInObject(store.formData, item.url, newUrl);
    store.updateFormData(updated);
  };

  const handleRetrySingle = async (item: CondoUnitPhotoAuditItem) => {
    try {
      setRetryingId(item.id);
      await retryUploadCondoUnitPhoto(item, parcelCode, unitCode, (newUrl) => {
        applyPromotedUrlToStore(item, newUrl);
      });
    } catch (err: unknown) {
      alert(`Không thể tải lại ảnh: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleBatchRetry = async () => {
    if (audit.unsyncedPhotos.length === 0) return;
    try {
      setIsBatchRetrying(true);
      for (const item of audit.unsyncedPhotos) {
        try {
          await retryUploadCondoUnitPhoto(item, parcelCode, unitCode, (newUrl) => {
            applyPromotedUrlToStore(item, newUrl);
          });
        } catch (_e) {}
      }
    } finally {
      setIsBatchRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120000] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Kiểm Toán Ảnh Khảo Sát Căn Hộ {unitCode}
                </h3>
                <span className="text-[10px] font-mono bg-teal-100 text-teal-900 border border-teal-200 px-2 py-0.5 rounded-full font-bold">
                  {parcelCode}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Đối soát trạng thái lưu trữ giữa bộ nhớ máy (IndexedDB) và máy chủ Cloudflare R2
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Summary KPI Cards */}
        <div className="p-3 sm:p-5 grid grid-cols-3 gap-2.5 sm:gap-4 shrink-0 bg-white border-b border-slate-100">
          <div
            onClick={() => setActiveTab('ALL')}
            className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
              activeTab === 'ALL'
                ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20 shadow-xs'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="text-lg sm:text-2xl font-black text-slate-900 font-mono">
              {audit.total}
            </div>
            <div className="text-[11px] sm:text-xs font-semibold text-slate-600">Tổng ảnh khảo sát</div>
          </div>

          <div
            onClick={() => setActiveTab('SYNCED')}
            className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
              activeTab === 'SYNCED'
                ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs'
                : 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            <div className="text-lg sm:text-2xl font-black text-emerald-700 font-mono flex items-center justify-center gap-1">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 inline" />
              {audit.synced}
            </div>
            <div className="text-[11px] sm:text-xs font-semibold text-emerald-800">Đã lên Cloud R2</div>
          </div>

          <div
            onClick={() => setActiveTab('UNSYNCED')}
            className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
              activeTab === 'UNSYNCED'
                ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/20 shadow-xs'
                : 'bg-amber-50/50 border-amber-200 hover:bg-amber-50'
            }`}
          >
            <div className="text-lg sm:text-2xl font-black text-amber-700 font-mono flex items-center justify-center gap-1">
              <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 inline" />
              {audit.unsynced}
            </div>
            <div className="text-[11px] sm:text-xs font-semibold text-amber-800">Lưu tạm trong máy</div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="px-4 sm:px-6 py-2 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-slate-600 font-medium">
            Hiển thị: <span className="font-bold text-slate-900">{displayList.length}</span> ảnh
          </div>

          {audit.unsynced > 0 && (
            <button
              type="button"
              disabled={isBatchRetrying}
              onClick={handleBatchRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBatchRetrying ? 'animate-spin' : ''}`} />
              <span>{isBatchRetrying ? 'Đang đẩy lên R2...' : 'Tải lại tất cả ảnh chưa lên mây'}</span>
            </button>
          )}
        </div>

        {/* Photos Table / List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 space-y-2.5">
          {displayList.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-700">Không có ảnh nào trong danh mục này</p>
              <p className="text-xs text-slate-500 mt-0.5">Toàn bộ ảnh khảo sát đều đã được kiểm toán an toàn</p>
            </div>
          ) : (
            displayList.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <PhotoThumbnailCell
                    url={item.url}
                    title={item.fieldTitle}
                    onClick={() => setPreviewImageUrl(item.url)}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {item.stepTitle.split(':')[0]}
                      </span>
                      {item.photoCode && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                          {item.photoCode}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-1 truncate">
                      {item.fieldTitle}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono truncate max-w-full mt-0.5">
                      {item.url}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {item.isCloudUrl ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Cloud R2
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Chờ tải lên
                      </span>
                      <button
                        type="button"
                        disabled={retryingId === item.id}
                        onClick={() => handleRetrySingle(item)}
                        className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition-colors cursor-pointer"
                        title="Tải lại ảnh này lên Cloud R2"
                      >
                        {retryingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}

                  {onNavigateToStep && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToStep(item.step);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      title={`Chuyển tới ${item.stepTitle}`}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            {audit.unsynced === 0
              ? '✓ 100% tài nguyên ảnh đã được tải lên Cloud R2 an toàn'
              : `⚠️ Còn ${audit.unsynced} ảnh chưa đồng bộ lên mây`}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Lightbox Zoom Modal */}
      {previewImageUrl && (
        <ImageZoomModal
          isOpen={Boolean(previewImageUrl)}
          imageUrl={previewImageUrl}
          onClose={() => setPreviewImageUrl(null)}
          title="Xem ảnh chi tiết"
        />
      )}
    </div>
  );
};
