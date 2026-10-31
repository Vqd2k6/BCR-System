import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Cloud,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  ExternalLink,
  ImageIcon,
  Loader2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { ImageZoomModal } from '../../../../components/common/ImageZoomModal';
import { useResolvedPhotoUrl } from '../../../../core/storage/useResolvedPhotoUrl';
import {
  auditMasterAreaPhotos,
  retryUploadMasterAreaPhoto,
  type MasterAreaPhotoAuditItem,
} from '../../utils/masterAreaPhotoAudit';
import type { EvidencePhotoItem, DamageZoneData, StructuralElementData } from '../../../survey-phase1/types/phase1.types';

interface MasterAreaPhotoAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  parcelCode: string;
  unitCode: string;
  overviewPhotos: EvidencePhotoItem[];
  cadSketchPhotoUrl: string;
  cadStructuralSketchPhotoUrl: string;
  useSeparateStructuralCad: boolean;
  zones: DamageZoneData[];
  structuralElements: StructuralElementData[];
  hasStructuralElements: boolean;
  onUpdateOverviewPhotoUrl: (index: number, newUrl: string) => void;
  onUpdateCadSketchUrl: (newUrl: string) => void;
  onUpdateCadStructuralSketchUrl: (newUrl: string) => void;
  onUpdateZoneOverviewPhotoUrl: (zoneIndex: number, photoIndex: number, newUrl: string) => void;
  onUpdateZoneDefectPhotoUrl: (zoneIndex: number, defectIndex: number, field: string, newUrl: string) => void;
  onUpdateElementOverviewPhotoUrl: (elemIndex: number, photoIndex: number, newUrl: string) => void;
  onUpdateElementDefectPhotoUrl: (elemIndex: number, defectIndex: number, field: string, newUrl: string) => void;
  onNavigateToStep?: (step: 1 | 2 | 3 | 4 | 5) => void;
}

const PhotoThumbnailCell: React.FC<{ url: string; title: string; onClick: () => void }> = ({
  url,
  title,
  onClick,
}) => {
  const { displayUrl } = useResolvedPhotoUrl(url);

  return (
    <div
      onClick={onClick}
      className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer relative group flex items-center justify-center"
      title="Bấm để xem ảnh phóng to"
    >
      {displayUrl ? (
        <img src={displayUrl} alt={title} className="w-full h-full object-cover" />
      ) : (
        <ImageIcon className="w-5 h-5 text-slate-400" />
      )}
      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Eye className="w-4 h-4 text-white" />
      </div>
    </div>
  );
};

export const MasterAreaPhotoAuditModal: React.FC<MasterAreaPhotoAuditModalProps> = ({
  isOpen,
  onClose,
  parcelCode,
  unitCode,
  overviewPhotos,
  cadSketchPhotoUrl,
  cadStructuralSketchPhotoUrl,
  useSeparateStructuralCad,
  zones,
  structuralElements,
  hasStructuralElements,
  onUpdateOverviewPhotoUrl,
  onUpdateCadSketchUrl,
  onUpdateCadStructuralSketchUrl,
  onUpdateZoneOverviewPhotoUrl,
  onUpdateZoneDefectPhotoUrl,
  onUpdateElementOverviewPhotoUrl,
  onUpdateElementDefectPhotoUrl,
  onNavigateToStep,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNSYNCED' | 'SYNCED'>('ALL');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState<boolean>(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  // Quét toàn bộ ảnh trong hồ sơ khảo sát khu vực (Single Source of Truth)
  const audit = useMemo(() => {
    return auditMasterAreaPhotos({
      overviewPhotos,
      cadSketchPhotoUrl,
      cadStructuralSketchPhotoUrl,
      useSeparateStructuralCad,
      zones,
      structuralElements,
      hasStructuralElements,
      unitCode,
    });
  }, [
    overviewPhotos,
    cadSketchPhotoUrl,
    cadStructuralSketchPhotoUrl,
    useSeparateStructuralCad,
    zones,
    structuralElements,
    hasStructuralElements,
    unitCode,
  ]);

  const auditItems = audit.allPhotos;
  const totalCount = audit.total;
  const syncedPhotos = audit.syncedPhotos;
  const unsyncedPhotos = audit.unsyncedPhotos;
  const syncedCount = audit.synced;
  const unsyncedCount = audit.unsynced;

  const displayedList = useMemo(() => {
    if (activeTab === 'UNSYNCED') return unsyncedPhotos;
    if (activeTab === 'SYNCED') return syncedPhotos;
    return auditItems;
  }, [activeTab, unsyncedPhotos, syncedPhotos, auditItems]);

  const applyPromotedUrlToState = (item: MasterAreaPhotoAuditItem, newUrl: string) => {
    if (item.updateInStore) {
      item.updateInStore(newUrl);
    }
    if (item.fieldKey.startsWith('overviewPhotos[')) {
      const idx = parseInt(item.fieldKey.replace('overviewPhotos[', '').replace('].url', ''), 10);
      if (!isNaN(idx)) onUpdateOverviewPhotoUrl(idx, newUrl);
    } else if (item.fieldKey === 'cadSketchPhotoUrl') {
      onUpdateCadSketchUrl(newUrl);
    } else if (item.fieldKey === 'cadStructuralSketchPhotoUrl') {
      onUpdateCadStructuralSketchUrl(newUrl);
    }
  };

  // Thử lại tải lên 1 ảnh
  const handleRetrySingle = useCallback(
    async (item: MasterAreaPhotoAuditItem) => {
      try {
        setRetryingId(item.id);
        await retryUploadMasterAreaPhoto(item, parcelCode, unitCode, (newUrl) => {
          applyPromotedUrlToState(item, newUrl);
        });
      } catch (err) {
        console.error('[MasterAreaPhotoAuditModal] Lỗi tải lại ảnh:', err);
        alert(
          err instanceof Error
            ? err.message
            : 'Không thể tải ảnh lên Cloud R2. Vui lòng kiểm tra kết nối mạng!'
        );
      } finally {
        setRetryingId(null);
      }
    },
    [parcelCode, unitCode]
  );

  // Thử lại tải lên toàn bộ ảnh chưa đồng bộ
  const handleRetryAll = async () => {
    if (unsyncedPhotos.length === 0) return;
    try {
      setIsRetryingAll(true);
      for (const item of unsyncedPhotos) {
        try {
          await retryUploadMasterAreaPhoto(item, parcelCode, unitCode, (newUrl) => {
            applyPromotedUrlToState(item, newUrl);
          });
        } catch (subErr) {
          console.warn(`[MasterAreaPhotoAuditModal] Thất bại tải ảnh ${item.id}:`, subErr);
        }
      }
    } finally {
      setIsRetryingAll(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[125000] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center pt-10 sm:pt-14 pb-6 px-3 sm:px-6 select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[86vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header Modal */}
        <div className="bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Kiểm Toán Đồng Bộ Ảnh Cloud R2
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700">
                  {unitCode}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Theo dõi và tải lại tài nguyên hình ảnh khảo sát lên đám mây Cloud R2 an toàn.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Thanh tóm tắt trạng thái (3 Cards) */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">Tổng tài nguyên:</span>
            </div>
            <span className="text-sm font-bold text-slate-900 font-mono">{totalCount} ảnh</span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">Đã lên Cloud R2:</span>
            </div>
            <span className="text-sm font-bold text-emerald-700 font-mono">{syncedCount} ảnh</span>
          </div>

          <div
            className={`p-2.5 rounded-xl border flex items-center justify-between ${
              unsyncedCount > 0
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            <div className="flex items-center gap-2">
              <HardDrive className={`w-4 h-4 ${unsyncedCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
              <span className="text-xs font-semibold">Chưa lên Cloud:</span>
            </div>
            <span className="text-sm font-bold font-mono">{unsyncedCount} ảnh</span>
          </div>
        </div>

        {/* Toolbar lọc Tab & Nút Đồng bộ tất cả */}
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tất cả ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('UNSYNCED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'UNSYNCED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Chưa lên Cloud ({unsyncedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('SYNCED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'SYNCED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Đã lên Cloud ({syncedCount})
            </button>
          </div>

          {unsyncedCount > 0 && (
            <button
              type="button"
              onClick={handleRetryAll}
              disabled={isRetryingAll}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer transition-all"
            >
              {isRetryingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang tải lên tất cả...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Đồng bộ tất cả lên Cloud</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Danh sách ảnh */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50 flex flex-col gap-2.5">
          {displayedList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
              <p className="text-sm font-semibold text-slate-700">
                {activeTab === 'UNSYNCED'
                  ? 'Tuyệt vời! Tất cả hình ảnh đã được lưu trữ an toàn trên Cloud R2.'
                  : 'Không có ảnh nào trong danh mục này.'}
              </p>
            </div>
          ) : (
            displayedList.map((item) => (
              <div
                key={item.id}
                className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3 hover:border-slate-300 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PhotoThumbnailCell
                    url={item.url}
                    title={item.fieldTitle}
                    onClick={() => setZoomUrl(item.url)}
                  />

                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {item.fieldTitle}
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        {item.stepTitle}
                      </span>
                    </div>

                    {item.photoCode && (
                      <span className="text-[10px] font-mono text-indigo-600 truncate">
                        {item.photoCode}
                      </span>
                    )}

                    <div className="flex items-center gap-2 pt-0.5">
                      {item.isCloudUrl ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 size={11} /> Cloud R2
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <HardDrive size={11} /> Lưu tạm trong máy (Chưa đồng bộ)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!item.isCloudUrl && (
                    <button
                      type="button"
                      onClick={() => handleRetrySingle(item)}
                      disabled={retryingId === item.id || isRetryingAll}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 shadow-2xs disabled:opacity-50 cursor-pointer transition-all"
                    >
                      {retryingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">Tải lại lên Cloud</span>
                    </button>
                  )}

                  {onNavigateToStep && (
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateToStep(item.step as 1 | 2 | 3 | 4 | 5);
                        onClose();
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-colors cursor-pointer"
                      title={`Chuyển đến ${item.stepTitle}`}
                    >
                      <ExternalLink size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Modal */}
        <div className="bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Trạng thái: {syncedCount}/{totalCount} ảnh đã đồng bộ an toàn.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Modal Zoom Preview nếu click ảnh */}
      {zoomUrl && (
        <ImageZoomModal
          isOpen={Boolean(zoomUrl)}
          onClose={() => setZoomUrl(null)}
          imageUrl={zoomUrl}
          title="Xem Phóng To Ảnh Kiểm Toán"
        />
      )}
    </div>,
    document.body
  );
};
