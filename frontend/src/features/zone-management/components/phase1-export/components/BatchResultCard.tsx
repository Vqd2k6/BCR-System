import React from 'react';
import { CheckCircle2, Download, X } from 'lucide-react';
import type { BatchResultData } from '../types';

interface BatchResultCardProps {
  batchResult: BatchResultData | null;
  onClose: () => void;
}

export const BatchResultCard: React.FC<BatchResultCardProps> = ({
  batchResult,
  onClose,
}) => {
  if (!batchResult) return null;

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="text-sm font-black text-emerald-900">
            Mẻ Xuất Tập Hồ Sơ PDF: {batchResult.batchCode}
          </span>
        </div>
        <div className="text-xs text-emerald-800 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Số lượng báo cáo tích hợp: <strong>{batchResult.totalReportsCompiled} lô</strong>
          </span>
          <span>•</span>
          <span className="font-mono text-[11px] text-emerald-700">
            Mã Checksum SHA-256: {batchResult.checksumSha256.slice(0, 16)}...
            {batchResult.checksumSha256.slice(-8)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <a
          href={batchResult.downloadUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (batchResult.downloadUrl === '#') {
              e.preventDefault();
              alert(
                `[Demo Test Mode]\nFile Mẻ Xuất ${batchResult.batchCode}\nSHA-256 Checksum: ${batchResult.checksumSha256}`
              );
            }
          }}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
        >
          <Download size={14} />
          <span>Tải file mẻ xuất (.ZIP / .PDF)</span>
        </a>
        <button
          onClick={onClose}
          className="p-2 text-emerald-700 hover:bg-emerald-100 rounded-xl"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
