import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FolderOpen, LoaderCircle, Search } from 'lucide-react';
import { getErrorMessage } from '../../../utils/errorUtils';
import { fetchProjectCadSketches } from '../engine/clientCadLabService';
import type { CadProjectSketch, CadProjectSketchType } from '../types/cadLab.types';

interface Props {
  selectedUrl: string | null;
  disabled: boolean;
  onPick: (item: CadProjectSketch) => void;
}

type TypeFilter = CadProjectSketchType | 'ALL';

const TYPE_TABS: { id: TypeFilter; label: string }[] = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'CAD_ARCH', label: 'CAD_01' },
  { id: 'CAD_STRUCT', label: 'CAD_02' },
  { id: 'CAD_BLUEPRINT', label: 'Mặt bằng' },
];

export const CAD_TYPE_BADGE: Record<CadProjectSketchType, { label: string; className: string }> = {
  CAD_ARCH: { label: 'CAD_01', className: 'bg-emerald-950 text-emerald-300 border-emerald-700' },
  CAD_STRUCT: { label: 'CAD_02', className: 'bg-amber-950 text-amber-300 border-amber-700' },
  CAD_BLUEPRINT: { label: 'MB tòa', className: 'bg-cyan-950 text-cyan-300 border-cyan-700' },
};

const PAGE_SIZE = 50;

/**
 * Danh sách bản vẽ CAD trong dự án, chỉ tải khi người dùng mở khối này.
 * Backend giới hạn theo Zone được gán của tài khoản.
 */
export const CadProjectSourcePicker: React.FC<Props> = ({ selectedUrl, disabled, onPick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<CadProjectSketch[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadPage = useCallback(
    async (offset: number) => {
      const seq = ++requestSeqRef.current;
      setIsLoading(true);
      setErrorMessage('');
      try {
        const page = await fetchProjectCadSketches({ type: typeFilter, search, offset, limit: PAGE_SIZE });
        if (seq !== requestSeqRef.current) return;
        setItems((prev) => (offset === 0 ? page.items : [...prev, ...page.items]));
        setTotal(page.total);
      } catch (err: unknown) {
        console.error('[CadProjectSourcePicker:LoadList] Không tải được danh mục bản vẽ CAD:', err);
        if (seq === requestSeqRef.current) setErrorMessage(`Không tải được danh sách: ${getErrorMessage(err)}`);
      } finally {
        if (seq === requestSeqRef.current) setIsLoading(false);
      }
    },
    [typeFilter, search]
  );

  useEffect(() => {
    if (isExpanded) void loadPage(0);
  }, [isExpanded, loadPage]);

  const selectedIndex = items.findIndex((i) => i.url === selectedUrl);
  const step = (delta: 1 | -1) => {
    const next = items[selectedIndex + delta];
    if (next) onPick(next);
  };

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <FolderOpen className="w-3.5 h-3.5 text-teal-600" /> Bản vẽ CAD trong dự án
      </button>
    );
  }

  return (
    <div className="space-y-2 pt-1 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
          <FolderOpen className="w-3.5 h-3.5 text-teal-600" /> Bản vẽ trong dự án
        </span>
        <span className="text-[10px] text-slate-500">
          {items.length}/{total}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {TYPE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTypeFilter(t.id)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer ${
              typeFilter === t.id ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-300 bg-white">
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Tìm mã hồ sơ, VD: B-0033"
          className="flex-1 min-w-0 text-[11px] outline-none bg-transparent"
        />
      </label>

      {errorMessage && <p className="text-[11px] text-rose-700">{errorMessage}</p>}

      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
        {items.map((item) => {
          const badge = CAD_TYPE_BADGE[item.cadType];
          const active = item.url === selectedUrl;
          return (
            <button
              key={item.url}
              type="button"
              disabled={disabled}
              onClick={() => onPick(item)}
              className={`w-full text-left px-2 py-1.5 flex items-center gap-1.5 text-[11px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                active ? 'bg-teal-50' : 'hover:bg-slate-50'
              }`}
            >
              <span className={`px-1 py-0.5 rounded border text-[9px] font-mono font-bold shrink-0 ${badge.className}`}>{badge.label}</span>
              <span className="px-1 py-0.5 rounded border text-[9px] bg-teal-950 text-teal-300 border-teal-700 font-mono font-bold shrink-0">
                {item.parcelCode || 'Chưa có mã'}
              </span>
              <span className="truncate text-slate-700">{item.floorName || '---'}</span>
            </button>
          );
        })}
        {!isLoading && items.length === 0 && !errorMessage && (
          <p className="px-2 py-3 text-[11px] text-slate-500 text-center">Không có bản vẽ phù hợp trong phạm vi Zone của bạn.</p>
        )}
        {isLoading && (
          <p className="px-2 py-2 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> Đang tải...
          </p>
        )}
        {!isLoading && items.length < total && (
          <button
            type="button"
            onClick={() => void loadPage(items.length)}
            className="w-full px-2 py-1.5 text-[11px] font-bold text-teal-700 hover:bg-teal-50 cursor-pointer"
          >
            Tải thêm {Math.min(PAGE_SIZE, total - items.length)} bản vẽ
          </button>
        )}
      </div>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={disabled || selectedIndex <= 0}
          className="flex-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center justify-center gap-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Trước
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={disabled || selectedIndex < 0 || selectedIndex >= items.length - 1}
          className="flex-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center justify-center gap-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Tiếp <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
