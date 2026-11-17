import React from 'react';
import { CheckCircle2, RefreshCw, Send, X } from 'lucide-react';
import type { WatermarkStagingControl } from '../../types';

interface WatermarkStagingBarProps {
  staging: WatermarkStagingControl;
}

/**
 * Thanh "gửi một lần" cho ảnh nghi ngờ dấu cũ ở bản xem trước.
 * Người dùng chọn kết quả TỪNG ảnh ngay trên ảnh (không nạp lại); thanh này chỉ gửi các lựa chọn đó.
 * Cố ý KHÔNG có nút "xác nhận tất cả" (luật 13/11/2026: mỗi ảnh phải được người xem).
 */
export const WatermarkStagingBar: React.FC<WatermarkStagingBarProps> = ({ staging }) => {
  const picked = staging.items.length;
  if (picked === 0 && staging.total === 0) return null;
  const withLegacy = staging.items.filter((it) => it.hasLegacyWatermark).length;
  const remaining = Math.max(0, staging.total - picked);

  return (
    <div className="shrink-0 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 border-t border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-200">
        <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>
          Đã chọn <strong>{picked}</strong>
          {staging.total > 0 && <> / {staging.total}</>} ảnh nghi ngờ dấu cũ
          {picked > 0 && (
            <span className="text-emerald-700 dark:text-emerald-300">
              {' '}
              ({withLegacy} có dấu cũ, {picked - withLegacy} chưa có dấu)
            </span>
          )}
          {remaining > 0 && <span className="text-amber-700 dark:text-amber-300"> · còn {remaining} ảnh chưa chọn</span>}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={staging.clear}
          disabled={picked === 0 || staging.isSubmitting}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X size={13} />
          Bỏ chọn
        </button>
        <button
          type="button"
          onClick={() => {
            void staging.submit();
          }}
          disabled={picked === 0 || staging.isSubmitting}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {staging.isSubmitting ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
          {staging.isSubmitting ? 'Đang gửi…' : `Gửi ${picked} xác nhận`}
        </button>
      </div>
    </div>
  );
};
