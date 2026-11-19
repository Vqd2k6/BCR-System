import React, { useMemo } from 'react';
import { X, Activity } from 'lucide-react';
import { formatBytes, getDataUsageTop } from '../../core/services/dataMeter';

interface DataUsageModalProps {
  onClose: () => void;
}

/** Bảng "Dung lượng đã dùng" hôm nay: KSV chụp màn hình gửi về khi máy tốn dữ liệu bất thường */
export const DataUsageModal: React.FC<DataUsageModalProps> = ({ onClose }) => {
  const usage = useMemo(() => getDataUsageTop(15), []);

  return (
    <div
      className="fixed inset-0 z-[100010] bg-slate-900/60 flex items-center justify-center p-4 cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden cursor-default">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-600" /> Dung lượng đã dùng hôm nay ({usage.day})
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-2 text-xs">
          <p className="text-slate-700">
            Tổng ghi nhận: <strong className="text-slate-900">{formatBytes(usage.totalBytes)}</strong> (API, tải ảnh lên, ảnh và bản đồ đo được). Ảnh lấy từ R2 không
            đo được dung lượng, chỉ đếm lượt.
          </p>
          {usage.entries.length === 0 ? (
            <p className="text-slate-500">Chưa có số liệu.</p>
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {usage.entries.map((e) => (
                <li key={e.key} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="font-mono text-[10px] text-slate-700 break-all">{e.key}</span>
                  <span className="shrink-0 text-right">
                    <strong className="text-slate-900">{formatBytes(e.bytes)}</strong>
                    <span className="text-slate-500"> · {e.count} lượt</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-slate-500">Chụp màn hình này gửi Zone Admin nếu máy tốn dữ liệu bất thường.</p>
        </div>
      </div>
    </div>
  );
};
