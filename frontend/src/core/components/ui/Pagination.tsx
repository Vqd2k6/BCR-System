import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  /** Trang hiện tại, đánh số từ 1. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Đơn vị đếm hiển thị, VD "thửa". */
  unitLabel?: string;
  disabled?: boolean;
}

/** Dãy số trang gọn: luôn có trang đầu/cuối, 1 trang mỗi bên trang hiện tại, còn lại thay bằng "…". */
function pageItems(page: number, pageCount: number): Array<number | 'gap'> {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev > 1) out.push(p - prev === 2 ? prev + 1 : 'gap');
    out.push(p);
  });
  return out;
}

export const Pagination: React.FC<PaginationProps> = ({ page, pageSize, total, onPageChange, unitLabel = 'mục', disabled = false }) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const fmt = (n: number) => n.toLocaleString('vi-VN');

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 text-xs text-slate-500">
      <span>
        Hiển thị <strong className="text-slate-700">{fmt(from)}–{fmt(to)}</strong> / {fmt(total)} {unitLabel}
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Trang trước"
          >
            <ChevronLeft size={14} />
          </button>
          {pageItems(page, pageCount).map((item, i) =>
            item === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                disabled={disabled}
                onClick={() => onPageChange(item)}
                aria-current={item === page ? 'page' : undefined}
                className={`min-w-[28px] px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  item === page
                    ? 'bg-sky-600 border-sky-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item}
              </button>
            )
          )}
          <button
            type="button"
            disabled={disabled || page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Trang sau"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
