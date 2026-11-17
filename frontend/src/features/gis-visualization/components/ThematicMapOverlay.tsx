import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, SlidersHorizontal, X } from 'lucide-react';
import type { GisThematicLayoutId, ThematicFilterDisplayMode, ThematicPrecisionFilter, ThematicSubModeId } from '../types';
import type { ThematicBucket, ThematicLayoutDef, ThematicScale } from '../registry/thematicLayouts.registry';
import { LAYOUT_GROUP_LABEL, LAYOUT_GROUP_ORDER } from '../registry/thematicLayouts.registry';
import type { BucketCount } from '../registry/thematicBinding';
import type { ActiveFilterChip } from '../registry/thematicFilter';
import { ThematicPrecisionFilterPanel } from './ThematicPrecisionFilterPanel';

export interface ThematicLegendData {
  scaleType: ThematicScale['scaleType'];
  /** Nhóm dữ liệu của thang (không gồm 2 nhóm chung) — dùng vẽ thanh gradient. */
  scaleBuckets: ThematicBucket[];
  buckets: ThematicBucket[];
  counts: Record<string, BucketCount>;
  total: number;
  activeBuckets: ReadonlySet<string>;
  onToggleBucket: (key: string) => void;
  onClearBuckets: () => void;
}

export interface ThematicFilterUiData {
  filter: ThematicPrecisionFilter;
  chips: ActiveFilterChip[];
  onChange: (next: ThematicPrecisionFilter) => void;
  onReset: () => void;
  displayMode: ThematicFilterDisplayMode;
  onChangeDisplayMode: (mode: ThematicFilterDisplayMode) => void;
  /** null khi chưa lọc gì (cả lọc chỉ định lẫn lọc nhóm). */
  matchedCount: number | null;
  total: number;
  /** Đang chờ tải số liệu để lọc. */
  pending: boolean;
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
  filterUi: ThematicFilterUiData;
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
  filterUi,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const activeDef = layouts.find((l) => l.id === layoutId);
  const ActiveIcon = activeDef?.icon;
  const filtering = filterUi.matchedCount !== null;
  const precisionOn = filterUi.chips.length > 0;

  return (
    <div className="flex flex-col gap-1.5 w-[min(22rem,calc(100vw-1rem))]">
      {/* Bộ chọn layout phân 3 nhóm, thu gọn còn 1 dòng layout đang xem */}
      <div className="rounded-xl border border-slate-200 bg-white/95 shadow-md backdrop-blur-md">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-slate-700"
          aria-expanded={pickerOpen}
        >
          {ActiveIcon && <ActiveIcon size={14} className="text-sky-600" />}
          <span className="flex-1 text-left">
            Layout: {activeDef?.label ?? ''}
            {activeDef && activeDef.group !== 'OPERATIONAL' && (
              <span className="font-normal text-slate-500"> · {LAYOUT_GROUP_LABEL[activeDef.group]}</span>
            )}
          </span>
          {pickerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {pickerOpen && (
          <div className="flex flex-col gap-1.5 border-t border-slate-100 px-1.5 pb-1.5 pt-1">
            {LAYOUT_GROUP_ORDER.map((group) => (
              <div key={group}>
                <div className="px-1 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{LAYOUT_GROUP_LABEL[group]}</div>
                <div className="grid grid-cols-2 gap-1">
                  {layouts
                    .filter((l) => l.group === group)
                    .map((l) => {
                      const Icon = l.icon;
                      const isActive = l.id === layoutId;
                      const disabled = isZoneAll && l.id !== 'WORKFLOW';
                      return (
                        <button
                          key={l.id}
                          type="button"
                          title={disabled ? 'Chọn 1 Zone cụ thể để xem bản đồ chuyên đề' : l.label}
                          disabled={disabled}
                          onClick={() => {
                            onChangeLayout(l.id);
                            setPickerOpen(false);
                          }}
                          className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            isActive ? 'bg-sky-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Icon size={13} className="shrink-0" />
                          <span className="truncate">{l.label}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isZoneAll && (
        <div className="rounded-lg border border-slate-200 bg-white/95 px-2 py-1 text-[11px] text-slate-600 shadow-sm">
          Đang xem toàn tuyến: chọn 1 Zone để mở bản đồ chuyên đề và bộ lọc chỉ định.
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

      {/* Lọc chỉ định: nút + chip tiêu chí + số khớp + chế độ hiển thị */}
      {!isZoneAll && (
        <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white/95 px-2 py-1.5 shadow-md backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${
                filterOpen || filterUi.chips.length > 0
                  ? 'border-sky-600 bg-sky-50 text-sky-700'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              aria-expanded={filterOpen}
            >
              <SlidersHorizontal size={12} /> Lọc chỉ định
              {filterUi.chips.length > 0 && (
                <span className="rounded-full bg-sky-600 px-1.5 text-[10px] text-white">{filterUi.chips.length}</span>
              )}
            </button>
            {filtering && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                Khớp {filterUi.matchedCount} / {filterUi.total} · {pct(filterUi.matchedCount ?? 0, filterUi.total)}
              </span>
            )}
            {filterUi.pending && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                <Loader2 size={12} className="animate-spin" /> Đang tải số liệu…
              </span>
            )}
          </div>
          {filterUi.chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {filterUi.chips.map((chip) => (
                <span
                  key={chip.key}
                  className="flex items-center gap-0.5 rounded-full border border-sky-200 bg-sky-50 py-0.5 pl-2 pr-1 text-[11px] text-sky-800"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => filterUi.onChange(chip.clear(filterUi.filter))}
                    className="cursor-pointer rounded-full p-0.5 hover:bg-sky-100"
                    aria-label={`Gỡ tiêu chí ${chip.label}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={filterUi.onReset}
                className="cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-50"
              >
                Xóa tất cả
              </button>
            </div>
          )}
          {filtering && (
            <div className="flex gap-1">
              {(
                [
                  { id: 'DIM', label: 'Làm mờ nền', icon: Eye },
                  { id: 'ISOLATE', label: 'Chỉ hiện thửa khớp', icon: EyeOff },
                ] as const
              ).map((o) => {
                const Icon = o.icon;
                const isActive = filterUi.displayMode === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => filterUi.onChangeDisplayMode(o.id)}
                    className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      isActive ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={11} /> {o.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {filterOpen && !isZoneAll && (
        <ThematicPrecisionFilterPanel
          filter={filterUi.filter}
          onChange={filterUi.onChange}
          onReset={filterUi.onReset}
          onClose={() => setFilterOpen(false)}
        />
      )}

      {loading && (
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2 py-1 text-[11px] text-slate-600 shadow-sm">
          <Loader2 size={13} className="animate-spin" /> Đang tải dữ liệu chuyên đề…
        </div>
      )}

      {legend && !filterOpen && (
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
              {(legend.scaleType === 'sequential' || legend.scaleType === 'risk_heatmap') && (
                <div className="px-1.5 pb-1">
                  <div
                    className="h-2 w-full rounded-full"
                    style={{ backgroundImage: `linear-gradient(to right, ${legend.scaleBuckets.map((b) => b.hex).join(', ')})` }}
                  />
                  <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
                    <span>{legend.scaleType === 'risk_heatmap' ? 'An toàn' : 'Thấp'}</span>
                    <span>{legend.scaleType === 'risk_heatmap' ? 'Nguy cơ cao' : 'Cao'}</span>
                  </div>
                </div>
              )}
              {legend.buckets.map((b) => {
                const c = legend.counts[b.key] ?? { total: 0, matched: 0 };
                const shown = precisionOn ? c.matched : c.total;
                const isActive = legend.activeBuckets.has(b.key);
                const isDimmed = legend.activeBuckets.size > 0 && !isActive;
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => legend.onToggleBucket(b.key)}
                    disabled={c.total === 0 && !isActive}
                    className={`flex cursor-pointer flex-col gap-0.5 rounded-md px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 ${
                      isActive ? 'bg-sky-50 ring-1 ring-sky-300' : ''
                    } ${isDimmed ? 'opacity-60' : ''}`}
                  >
                    <span className="flex w-full items-center gap-1.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-300" style={{ backgroundColor: b.hex }} />
                      <span className="flex-1 text-slate-700">{b.label}</span>
                      <span className="font-mono font-bold text-slate-800">
                        {precisionOn ? `${c.matched}/${c.total}` : c.total}
                      </span>
                      <span className="w-11 text-right font-mono text-slate-500">{pct(shown, legend.total)}</span>
                    </span>
                    {/* Thanh phân bố nhỏ theo tỉ lệ số thửa trong Zone */}
                    <span className="ml-4 h-1 rounded-full bg-slate-100">
                      <span
                        className="block h-1 rounded-full"
                        style={{ width: pct(shown, legend.total).replace(',', '.'), backgroundColor: b.hex }}
                      />
                    </span>
                  </button>
                );
              })}
              {legend.activeBuckets.size > 0 && (
                <button
                  type="button"
                  onClick={legend.onClearBuckets}
                  className="mt-0.5 cursor-pointer self-end rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-50"
                >
                  Bỏ lọc nhóm
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
