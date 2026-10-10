import React, { useState, useEffect } from 'react';
import { Cloud, HardDrive, RefreshCw, AlertTriangle } from 'lucide-react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import {
  auditSurveyPhotos,
  type SurveyPhotoAuditItem,
} from '../utils/photoSyncAudit';
import { uploadQueue } from '../../../core/services/uploadQueueService';
import { useStorageInfo } from '../../../core/services/storageInfoService';

interface Props {
  onOpenAuditModal: () => void;
  onAuditCalculated?: (audit: {
    allPhotos: SurveyPhotoAuditItem[];
    unsyncedPhotos: SurveyPhotoAuditItem[];
    syncedPhotos: SurveyPhotoAuditItem[];
  }) => void;
}

export const CloudPhotoStatusBadge: React.FC<Props> = ({
  onOpenAuditModal,
  onAuditCalculated,
}) => {
  const { formData, updateFormData } = usePhase1SurveyStore();
  const storageInfo = useStorageInfo();
  const [queueStats, setQueueStats] = useState({
    total: 0,
    pending: 0,
    uploading: 0,
    success: 0,
    failed: 0,
  });

  // Lắng nghe biến động của UploadQueue
  useEffect(() => {
    const unsubscribe = uploadQueue.subscribe((stats) => {
      setQueueStats(stats);
    });
    return () => unsubscribe();
  }, []);

  const audit = auditSurveyPhotos(formData, updateFormData);

  useEffect(() => {
    if (onAuditCalculated) {
      onAuditCalculated({
        allPhotos: audit.allPhotos,
        unsyncedPhotos: audit.unsyncedPhotos,
        syncedPhotos: audit.syncedPhotos,
      });
    }
  }, [audit.totalPhotos, audit.unsyncedPhotosCount, audit.syncedPhotosCount]);

  if (audit.totalPhotos === 0) {
    return null;
  }

  // Trường hợp 1: Có ảnh chưa đồng bộ (Base64 / Blob offline chưa lưu lên Storage)
  if (audit.unsyncedPhotosCount > 0) {
    const isUploading = queueStats.uploading > 0 || queueStats.pending > 0;

    return (
      <div
        onClick={onOpenAuditModal}
        title={`Bấm để xem danh sách chi tiết các ảnh chưa đồng bộ lên ${storageInfo.providerLabel}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-xs cursor-pointer hover:bg-amber-100 hover:border-amber-400 transition-all select-none animate-in fade-in"
      >
        {isUploading ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        )}
        <span>
          {isUploading
            ? `Đang tải ${queueStats.uploading + queueStats.pending} ảnh...`
            : `⚠️ ${audit.unsyncedPhotosCount} ảnh ${storageInfo.unsyncedText} (Xem)`}
        </span>
      </div>
    );
  }

  // Trường hợp 2: Đang tải
  if (queueStats.uploading > 0 || queueStats.pending > 0) {
    return (
      <div
        onClick={onOpenAuditModal}
        title={`Đang lưu ảnh vào ${storageInfo.providerLabel}... Bấm để xem chi tiết`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs cursor-pointer hover:bg-blue-100 transition-colors animate-pulse select-none"
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
        <span>Đang tải {queueStats.uploading + queueStats.pending} ảnh...</span>
      </div>
    );
  }

  // Trường hợp 3: 100% ảnh đã lưu an toàn
  const StorageIcon = storageInfo.isLocal ? HardDrive : Cloud;
  const storageShortName = storageInfo.isLocal ? 'Local Disk:' : 'Cloud R2:';

  return (
    <div
      onClick={onOpenAuditModal}
      title={`${storageInfo.syncedText}. Bấm để xem danh mục ảnh.`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs cursor-pointer transition-colors select-none ${
        storageInfo.isLocal
          ? 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100/70'
      }`}
    >
      <StorageIcon className={`w-3.5 h-3.5 shrink-0 ${storageInfo.isLocal ? 'text-indigo-600' : 'text-emerald-600'}`} />
      <span className="hidden md:inline font-medium">{storageShortName}</span>
      <span className="font-semibold">{audit.syncedPhotosCount}/{audit.totalPhotos}<span className="hidden sm:inline"> ảnh</span></span>
      <span className={`px-1.5 py-0.2 rounded text-white font-mono font-bold text-[10px] tracking-wider shadow-2xs ${
        storageInfo.isLocal ? 'bg-indigo-600' : 'bg-emerald-600'
      }`}>
        ✓
      </span>
    </div>
  );
};
