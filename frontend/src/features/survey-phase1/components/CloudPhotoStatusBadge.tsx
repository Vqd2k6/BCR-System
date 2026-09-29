import React, { useState, useEffect } from 'react';
import { Cloud, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { auditSurveyPhotos, SurveyPhotoAuditItem } from '../utils/photoSyncAudit';
import { uploadQueue } from '../../../core/services/uploadQueueService';

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

  // Trường hợp 1: Có ảnh chưa đồng bộ (Base64 chưa lên Cloud)
  if (audit.unsyncedPhotosCount > 0) {
    const isUploading = queueStats.uploading > 0 || queueStats.pending > 0;

    return (
      <div
        onClick={onOpenAuditModal}
        title="Bấm để xem danh sách chi tiết các ảnh chưa lên Cloudflare R2"
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
            : `⚠️ ${audit.unsyncedPhotosCount} ảnh chưa lên Cloud (Xem)`}
        </span>
      </div>
    );
  }

  // Trường hợp 2: Đang tải
  if (queueStats.uploading > 0 || queueStats.pending > 0) {
    return (
      <div
        onClick={onOpenAuditModal}
        title="Đang tải ảnh lên Cloudflare R2... Bấm để xem chi tiết"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs cursor-pointer hover:bg-blue-100 transition-colors animate-pulse select-none"
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
        <span>Đang tải {queueStats.uploading + queueStats.pending} ảnh...</span>
      </div>
    );
  }

  // Trường hợp 3: 100% ảnh đã lên Cloudflare R2 an toàn
  return (
    <div
      onClick={onOpenAuditModal}
      title="Toàn bộ ảnh đã được lưu trữ an toàn trên Cloudflare R2. Bấm để xem danh mục ảnh."
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs cursor-pointer hover:bg-emerald-100/70 transition-colors select-none"
    >
      <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
      <span className="hidden md:inline">Cloud R2:</span>
      <span className="font-semibold">{audit.syncedPhotosCount}/{audit.totalPhotos}<span className="hidden sm:inline"> ảnh</span></span>
      <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white font-mono font-bold text-[10px] tracking-wider shadow-2xs">
        ✓
      </span>
    </div>
  );
};
