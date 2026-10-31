import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Download, Loader2, X } from 'lucide-react';
import { getErrorMessage } from '@/utils/errorUtils';
import { downloadMinutesZip, fetchMinutesJob } from '../../api/minutesExport.api';
import type { MinutesJobStatus } from '../../types';

interface BatchMinutesExportProgressModalProps {
  job: MinutesJobStatus;
  onJobChange: (job: MinutesJobStatus) => void;
  onClose: () => void;
}

const POLL_INTERVAL_MS = 2000;

const isRunning = (job: MinutesJobStatus): boolean => job.status === 'QUEUED' || job.status === 'PROCESSING';

export const BatchMinutesExportProgressModal: React.FC<BatchMinutesExportProgressModalProps> = ({
  job,
  onJobChange,
  onClose,
}) => {
  const [pollError, setPollError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const running = isRunning(job);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(async () => {
      try {
        onJobChange(await fetchMinutesJob(job.id));
        setPollError(null);
      } catch (err: unknown) {
        console.error('[MinutesExport:Poll] Không lấy được tiến độ job:', err);
        setPollError(getErrorMessage(err, 'Không lấy được tiến độ, đang thử lại...'));
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [job.id, running, onJobChange]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadMinutesZip(job.id);
    } catch (err: unknown) {
      console.error('[MinutesExport:Download] Không tạo được vé tải:', err);
      setPollError(getErrorMessage(err, 'Không thể tải file ZIP.'));
    } finally {
      setIsDownloading(false);
    }
  };

  const percent = job.progressTotal > 0 ? Math.round((job.progressDone / job.progressTotal) * 100) : 0;
  const okCount = job.progressDone - job.failedCount;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-bold text-slate-900">Xuất Biên Bản Hiện Trường ({job.zoneId})</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
            title={running ? 'Đóng, job vẫn tiếp tục chạy' : 'Đóng'}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm text-slate-700">
          {running && (
            <>
              <div className="flex items-center gap-2 font-semibold">
                <Loader2 size={16} className="animate-spin text-indigo-600" />
                {job.status === 'QUEUED' ? 'Đang chờ đến lượt xuất...' : `Đang xuất: ${job.currentItem ?? '...'}`}
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-xs text-slate-600">
                {job.progressDone}/{job.progressTotal} hồ sơ – {percent}%
                {job.failedCount > 0 && ` – ${job.failedCount} lỗi`}
              </p>
              <p className="text-xs text-slate-500">Có thể đóng cửa sổ này, hệ thống vẫn tiếp tục xuất.</p>
            </>
          )}

          {job.status === 'COMPLETED' && (
            <>
              <div className="flex items-center gap-2 font-semibold text-emerald-700">
                <CheckCircle2 size={16} />
                Đã xuất {okCount} biên bản
              </div>
              {job.failedCount > 0 && (
                <div className="flex items-start gap-2 text-xs font-semibold text-amber-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {job.failedCount} hồ sơ lỗi, chi tiết trong file danh mục CSV trong ZIP.
                </div>
              )}
              {job.fileSizeBytes !== null && (
                <p className="text-xs text-slate-600">Dung lượng: {(job.fileSizeBytes / 1048576).toFixed(0)} MB</p>
              )}
              {job.checksumSha256 && (
                <p className="break-all font-mono text-[11px] text-slate-500">SHA-256: {job.checksumSha256}</p>
              )}
              {job.expiresAt && (
                <p className="text-xs text-slate-500">
                  Link tải hết hạn: {new Date(job.expiresAt).toLocaleString('vi-VN')}
                </p>
              )}
            </>
          )}

          {job.status === 'FAILED' && (
            <div className="flex items-start gap-2 font-semibold text-rose-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {job.errorMessage ?? 'Xuất ZIP thất bại.'}
            </div>
          )}

          {job.status === 'REVOKED' && <p className="text-xs text-slate-600">File ZIP này đã hết hạn, vui lòng xuất lại.</p>}

          {pollError && <p className="text-xs font-semibold text-rose-700">{pollError}</p>}
        </div>

        {job.status === 'COMPLETED' && (
          <div className="flex justify-end border-t border-slate-200 px-5 py-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              Tải file .ZIP
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
