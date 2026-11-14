import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';
import type { GisThematicLayoutId, ThematicSubModeId } from '../types';
import type { ThematicBucket, ThematicLayoutDef } from '../registry/thematicLayouts.registry';

export interface ThematicLegendData {
  buckets: ThematicBucket[];
  counts: Record<string, number>;
  total: number;
  activeBuckets: ReadonlySet<string>;
  onToggleBucket: (key: string) => void;
  onClearBuckets: () => void;
}

interface ThematicMapOverlayProps {
  layouts: ThematicLayoutDef[];
  layoutId: GisThematicLayoutId;
  onChangeLayout: (id: GisThematicLayoutId) => void;
  subMode: ThematicSubModeId | null;
  onChangeSubMode: (id: ThematicSubModeId) => void;
  /** Đang xem toàn tuyến: chỉ cho layout tác nghiệp. */
  isZoneAll: boolean;
  loading: boolean;
  error: string | null;
  onDismissError: () => void;
  legend: ThematicLegendData | null;
}

const pct = (n: number, total: number): string => (total > 0 ? `${((n / total) * 100).toFixed(1).replace('.', ',')}%` : '0%');

export const ThematicMapOverlay: React.FC<ThematicMapOverlayProps> = ({
  layouts,
  layoutId,
  onChangeLayout,
  subMode,
  onChangeSubMode,
  isZoneAll,
  loading,
  error,
  onDismissError,
  legend,
}) => {
  const [legendOpen, setLegendOpen] = useState(true);
  const activeDef = layouts.find((l) => l.id === layoutId);

  return (
    <div className="flex flex-col gap-1.5 w-[min(22rem,calc(100vw-1rem))]">
      {/* Thanh chọn layout — cuộn ngang trên màn hình hẹp */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur-md">
        {layouts.map((l) => {
          const Icon = l.icon;
          const isActive = l.id === layoutId;
          const disabled = isZoneAll && l.id !== 'WORKFLOW';
          return (
            <button
              key={l.id}
              type="button"
              title={disabled ? 'Chọn 1 Zone cụ thể để xem bản đồ chuyên đề' : l.label}
              disabled={disabled}
              onClick={() => onChangeLayout(l.id)}
              className={`flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                isActive ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon size={13} />
              <span className={isActive ? '' : 'hidden sm:inline'}>{l.label}</span>
            </button>
          );
        })}
      </div>

      {isZoneAll && (
        <div className="rounded-lg border border-slate-200 bg-white/95 px-2 py-1 text-[11px] text-slate-600 shadow-sm">
          Đang xem toàn tuyến: chọn 1 Zone để mở bản đồ chuyên đề.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700 shadow-sm">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span className="flex-1">Không tải được dữ liệu chuyên đề, đã quay về bản đồ khảo sát. {error}</span>
          <button type="button" onClick={onDismissError} className="cursor-pointer text-rose-700" aria-label="Đóng thông báo">
            <X size={13} />
          </button>
        </div>
      )}

      {activeDef && activeDef.subModes.length > 0 && (
        <div className="flex gap-1">
          {activeDef.subModes.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChangeSubMode(s.id)}
              className={`cursor-pointer rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-sm ${
                s.id === subMode ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white/95 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2 py-1 text-[11px] text-slate-600 shadow-sm">
          <Loader2 size={13} className="animate-spin" /> Đang tải dữ liệu chuyên đề…
        </div>
      )}

      {legend && (
        <div className="rounded-xl border border-slate-200 bg-white/95 shadow-md backdrop-blur-md">
          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            className="flex w-full cursor-pointer items-center justify-between px-2.5 py-1.5 text-[11px] font-bold text-slate-700"
          >
            <span>
              Chú giải · {legend.total} thửa
              {legend.activeBuckets.size > 0 ? ` · đang lọc ${legend.activeBuckets.size} nhóm` : ''}
            </span>
            {legendOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {legendOpen && (
            <div className="flex max-h-[45vh] flex-col gap-0.5 overflow-y-auto px-1.5 pb-1.5">
              {legend.buckets.map((b) => {
                const count = legend.counts[b.key] ?? 0;
                const isActive = legend.activeBuckets.has(b.key);
                const isDimmed = legend.activeBuckets.size > 0 && !isActive;
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => legend.onToggleBucket(b.key)}
                    disabled={count === 0 && !isActive}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 ${
                      isActive ? 'bg-sky-50 ring-1 ring-sky-300' : ''
                    } ${isDimmed ? 'opacity-60' : ''}`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: b.hex }} />
                    <span className="flex-1 text-slate-700">{b.label}</span>
                    <span className="font-mono font-bold text-slate-800">{count}</span>
                    <span className="w-11 text-right font-mono text-slate-500">{pct(count, legend.total)}</span>
                  </button>
                );
              })}
              {legend.activeBuckets.size > 0 && (
                <button
                  type="button"
                  onClick={legend.onClearBuckets}
                  className="mt-0.5 cursor-pointer self-end rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-50"
                >
                  Bỏ lọc
                </button>
              )}
              <div className="px-1.5 pt-1 text-[10px] leading-snug text-slate-500">
                Viền nét đứt: hồ sơ chưa phê duyệt. Viền tím: chung cư (theo Báo cáo Master).
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
