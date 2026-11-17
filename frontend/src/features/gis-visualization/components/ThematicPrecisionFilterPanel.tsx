import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import {
  FOUNDATION_BUCKET_CODES,
  IMPACT_CODES,
  REPORT_STATUS_CODES,
  REPORT_STATUS_LABEL,
  RISK_LEVEL_CODES,
  STRUCTURE_CLASS_CODES,
} from '../registry/thematicFilter';
import { FOUNDATION_TYPE_SCALE, RISK_LEVEL_LABEL, STRUCTURE_SCALE } from '../registry/thematicLayouts.registry';
import type { BasementFilterMode, ThematicPrecisionFilter } from '../types';

interface Props {
  filter: ThematicPrecisionFilter;
  onChange: (next: ThematicPrecisionFilter) => void;
  onReset: () => void;
  onClose: () => void;
}

type NumKey = 'yearMin' | 'yearMax' | 'aboveFloorsMin' | 'aboveFloorsMax' | 'catMin' | 'catMax' | 'ecsMin' | 'ecsMax' | 'burlandMin' | 'burlandMax' | 'viMin' | 'viMax';

const shortLabel = (buckets: { key: string; label: string }[], key: string): string =>
  buckets.find((b) => b.key === key)?.label.split(' (')[0] ?? key;

const YEAR_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: '< 1985', min: null, max: 1984 },
  { label: '1985–2000', min: 1985, max: 2000 },
  { label: '2001–2015', min: 2001, max: 2015 },
  { label: '> 2015', min: 2016, max: null },
];

const BASEMENT_OPTIONS: { id: BasementFilterMode; label: string }[] = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'HAS_BASEMENT', label: 'Có hầm' },
  { id: 'NO_BASEMENT', label: 'Không hầm' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{title}</div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        active ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

export const ThematicPrecisionFilterPanel: React.FC<Props> = ({ filter, onChange, onReset, onClose }) => {
  const setNum = (key: NumKey, raw: string) => {
    const trimmed = raw.trim().replace(',', '.');
    const n = trimmed === '' ? null : Number(trimmed);
    onChange({ ...filter, [key]: n === null || Number.isFinite(n) ? n : null });
  };

  const toggleIn = <T extends string>(list: T[] | undefined, code: T): T[] => {
    const cur = list ?? [];
    return cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
  };

  const RangeRow = ({
    label,
    minKey,
    maxKey,
    min,
    max,
    step = 1,
  }: {
    label: string;
    minKey: NumKey;
    maxKey: NumKey;
    min: number;
    max: number;
    step?: number;
  }) => (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className="w-24 shrink-0 text-slate-600">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        placeholder={`Từ ${min}`}
        value={filter[minKey] ?? ''}
        onChange={(e) => setNum(minKey, e.target.value)}
        className="w-full min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-800"
      />
      <span className="text-slate-400">–</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        placeholder={`Đến ${max}`}
        value={filter[maxKey] ?? ''}
        onChange={(e) => setNum(maxKey, e.target.value)}
        className="w-full min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-800"
      />
    </div>
  );

  const yearActive = filter.yearMin != null || filter.yearMax != null;

  return (
    <div className="flex max-h-[60vh] flex-col rounded-xl border border-slate-200 bg-white/95 shadow-md backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-100 px-2.5 py-1.5">
        <span className="text-[11px] font-bold text-slate-700">Lọc chỉ định (áp dụng cho mọi layer)</span>
        <button type="button" onClick={onClose} className="cursor-pointer text-slate-500 hover:text-slate-700" aria-label="Đóng bộ lọc">
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto px-2.5 py-2">
        <Section title="1. Thời gian & Quy mô">
          {RangeRow({ label: 'Năm xây dựng', minKey: 'yearMin', maxKey: 'yearMax', min: 1900, max: 2030 })}
          <div className="flex flex-wrap gap-1">
            {YEAR_PRESETS.map((p) => (
              <Chip
                key={p.label}
                active={(filter.yearMin ?? null) === p.min && (filter.yearMax ?? null) === p.max}
                onClick={() => onChange({ ...filter, yearMin: p.min, yearMax: p.max })}
              >
                {p.label}
              </Chip>
            ))}
          </div>
          <label className={`flex items-center gap-1.5 text-[11px] ${yearActive ? 'cursor-pointer text-slate-600' : 'cursor-not-allowed text-slate-400'}`}>
            <input
              type="checkbox"
              disabled={!yearActive}
              checked={Boolean(filter.excludeEstimatedYear)}
              onChange={(e) => onChange({ ...filter, excludeEstimatedYear: e.target.checked })}
              className="cursor-pointer disabled:cursor-not-allowed"
            />
            Bỏ năm ước lượng (chỉ năm chủ nhà khai / giấy tờ)
          </label>
          {RangeRow({ label: 'Số tầng nổi', minKey: 'aboveFloorsMin', maxKey: 'aboveFloorsMax', min: 1, max: 60 })}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-24 shrink-0 text-slate-600">Tầng hầm</span>
            <div className="flex flex-wrap gap-1">
              {BASEMENT_OPTIONS.map((o) => (
                <Chip key={o.id} active={(filter.basementMode ?? 'ALL') === o.id} onClick={() => onChange({ ...filter, basementMode: o.id })}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>
        </Section>

        <Section title="2. Móng & Kết cấu">
          <div className="flex flex-wrap gap-1">
            {FOUNDATION_BUCKET_CODES.map((code) => (
              <Chip
                key={code}
                active={Boolean(filter.foundationBuckets?.includes(code))}
                onClick={() => onChange({ ...filter, foundationBuckets: toggleIn(filter.foundationBuckets, code) })}
              >
                {shortLabel(FOUNDATION_TYPE_SCALE.buckets, code)}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {STRUCTURE_CLASS_CODES.map((code) => (
              <Chip
                key={code}
                active={Boolean(filter.structureClasses?.includes(code))}
                onClick={() => onChange({ ...filter, structureClasses: toggleIn(filter.structureClasses, code) })}
              >
                {shortLabel(STRUCTURE_SCALE.buckets, code)}
              </Chip>
            ))}
          </div>
          {RangeRow({ label: 'CAT hồ sơ móng', minKey: 'catMin', maxKey: 'catMax', min: 1, max: 5 })}
        </Section>

        <Section title="3. Hư hỏng & Rủi ro">
          {RangeRow({ label: 'Cấp Burland', minKey: 'burlandMin', maxKey: 'burlandMax', min: 0, max: 5 })}
          {RangeRow({ label: 'Điểm ECS', minKey: 'ecsMin', maxKey: 'ecsMax', min: 0, max: 24 })}
          <div className="flex flex-wrap gap-1">
            <Chip active={filter.ecsMin === 11 && filter.ecsMax == null} onClick={() => onChange({ ...filter, ecsMin: 11, ecsMax: null })}>
              ECS ≥ 11 (Kém / Nguy hiểm)
            </Chip>
            <Chip
              active={filter.burlandMin === 3 && filter.burlandMax == null}
              onClick={() => onChange({ ...filter, burlandMin: 3, burlandMax: null })}
            >
              Burland ≥ Cấp 3
            </Chip>
          </div>
          {RangeRow({ label: 'Chỉ số VI', minKey: 'viMin', maxKey: 'viMax', min: 0, max: 5, step: 0.01 })}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-24 shrink-0 text-slate-600">Cấp BRA</span>
            <div className="flex flex-wrap gap-1">
              {RISK_LEVEL_CODES.map((code) => (
                <Chip
                  key={code}
                  active={Boolean(filter.braLevels?.includes(code))}
                  onClick={() => onChange({ ...filter, braLevels: toggleIn(filter.braLevels, code) })}
                >
                  {RISK_LEVEL_LABEL[code]}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-24 shrink-0 text-slate-600">Tác động</span>
            <div className="flex flex-wrap gap-1">
              {IMPACT_CODES.map((code) => (
                <Chip
                  key={code}
                  active={Boolean(filter.impactCodes?.includes(code))}
                  onClick={() => onChange({ ...filter, impactCodes: toggleIn(filter.impactCodes, code) })}
                >
                  {code}
                </Chip>
              ))}
            </div>
          </div>
        </Section>

        <Section title="4. Hồ sơ">
          <div className="flex flex-wrap gap-1">
            {REPORT_STATUS_CODES.map((code) => (
              <Chip
                key={code}
                active={Boolean(filter.reportStatuses?.includes(code))}
                onClick={() => onChange({ ...filter, reportStatuses: toggleIn(filter.reportStatuses, code) })}
              >
                {REPORT_STATUS_LABEL[code]}
              </Chip>
            ))}
          </div>
        </Section>

        <div className="text-[10px] leading-snug text-slate-500">
          Các tiêu chí ghép với nhau (VÀ). Thửa chưa có số liệu cho tiêu chí đang bật sẽ không khớp.
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-100 px-2.5 py-1.5">
        <button
          type="button"
          onClick={onReset}
          className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-50"
        >
          <RotateCcw size={12} /> Đặt lại bộ lọc
        </button>
      </div>
    </div>
  );
};
