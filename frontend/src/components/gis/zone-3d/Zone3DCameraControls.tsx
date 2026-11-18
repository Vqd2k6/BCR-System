import React from 'react';
import { RotateCcw, RotateCw, Compass } from 'lucide-react';

export type Zone3DBaseMode = 'maquette' | 'satellite' | 'street';

export const ZONE3D_PITCH_PRESETS: ReadonlyArray<{ deg: number; label: string }> = [
  { deg: 22, label: '22°' },
  { deg: 48, label: '48°' },
  { deg: 65, label: '65°' },
];

export const ZONE3D_MIN_SCALE = 1;
export const ZONE3D_MAX_SCALE = 2.5;

const BASE_OPTIONS: ReadonlyArray<{ mode: Zone3DBaseMode; label: string }> = [
  { mode: 'maquette', label: 'Sa bàn' },
  { mode: 'satellite', label: 'Vệ tinh' },
  { mode: 'street', label: 'Đường phố' },
];

interface Zone3DCameraControlsProps {
  pitchDeg: number;
  onPitch: (deg: number) => void;
  onRotate: (deltaDeg: number) => void;
  onResetNorth: () => void;
  baseMode: Zone3DBaseMode;
  onBaseMode: (mode: Zone3DBaseMode) => void;
  scale: number;
  onScale: (scale: number) => void;
}

const chip = (active: boolean): string =>
  `rounded-md border px-2 py-1 text-[11px] font-bold whitespace-nowrap ${
    active
      ? 'border-sky-600 bg-sky-600 text-white'
      : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
  }`;

/** Thanh điều khiển góc nhìn 3D (góc trên phải, dưới thanh tiêu đề). */
export const Zone3DCameraControls: React.FC<Zone3DCameraControlsProps> = ({
  pitchDeg,
  onPitch,
  onRotate,
  onResetNorth,
  baseMode,
  onBaseMode,
  scale,
  onScale,
}) => (
  <div className="absolute right-2 top-[96px] z-[950] w-[190px] rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur-md">
    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Góc nhìn</div>
    <div className="mb-2 flex gap-1">
      {ZONE3D_PITCH_PRESETS.map((p) => (
        <button
          key={p.deg}
          type="button"
          onClick={() => onPitch(p.deg)}
          className={`cursor-pointer ${chip(Math.abs(pitchDeg - p.deg) < 4)}`}
          title={`Nghiêng ${p.deg}°`}
        >
          {p.label}
        </button>
      ))}
    </div>

    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Xoay</div>
    <div className="mb-2 flex gap-1">
      <button type="button" onClick={() => onRotate(-45)} className={`cursor-pointer ${chip(false)}`} title="Xoay trái 45°">
        <RotateCcw size={12} className="inline" /> 45°
      </button>
      <button type="button" onClick={onResetNorth} className={`cursor-pointer ${chip(false)}`} title="Về hướng Bắc">
        <Compass size={12} className="inline" /> Bắc
      </button>
      <button type="button" onClick={() => onRotate(45)} className={`cursor-pointer ${chip(false)}`} title="Xoay phải 45°">
        <RotateCw size={12} className="inline" /> 45°
      </button>
    </div>

    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Nền trong Zone</div>
    <div className="mb-2 flex flex-wrap gap-1">
      {BASE_OPTIONS.map((o) => (
        <button key={o.mode} type="button" onClick={() => onBaseMode(o.mode)} className={`cursor-pointer ${chip(baseMode === o.mode)}`}>
          {o.label}
        </button>
      ))}
    </div>

    <label className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500">
      <span>Tỉ lệ cao (minh hoạ)</span>
      <span className="text-[11px] normal-case text-slate-700">{scale.toFixed(1)}×</span>
    </label>
    <input
      type="range"
      min={ZONE3D_MIN_SCALE}
      max={ZONE3D_MAX_SCALE}
      step={0.1}
      value={scale}
      onChange={(e) => onScale(Number(e.target.value))}
      className="w-full cursor-pointer accent-sky-600"
      aria-label="Tỉ lệ chiều cao khối nhà"
    />
    <p className="mt-1 text-[10px] leading-tight text-slate-500">Chuột phải / Ctrl + kéo để xoay và nghiêng.</p>
  </div>
);
