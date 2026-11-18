import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Maximize2,
  Move,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import type { MapBaseMode } from '../shared/baseTileSources';

export type Zone3DBaseMode = MapBaseMode;
export type Zone3DDragMode = 'orbit' | 'pan';

export const ZONE3D_PITCH_PRESETS: ReadonlyArray<{ deg: number; label: string }> = [
  { deg: 25, label: '25°' },
  { deg: 48, label: '48°' },
  { deg: 68, label: '68°' },
];

export const ZONE3D_MIN_SCALE = 1;
export const ZONE3D_MAX_SCALE = 2.5;

const BASE_OPTIONS: ReadonlyArray<{ mode: MapBaseMode; label: string }> = [
  { mode: 'white', label: 'Nền trắng' },
  { mode: 'standard', label: 'Đường phố' },
  { mode: 'satellite', label: 'Vệ tinh' },
  { mode: 'osm', label: 'OSM' },
];

interface Zone3DCameraControlsProps {
  dragMode: Zone3DDragMode;
  onDragMode: (mode: Zone3DDragMode) => void;
  autoOrbit: boolean;
  onToggleAutoOrbit: () => void;
  pitchDeg: number;
  onPitch: (deg: number) => void;
  onPitchScrub: (deg: number) => void;
  bearingDeg: number;
  onBearingScrub: (deg: number) => void;
  onRotate: (deltaDeg: number) => void;
  onResetNorth: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitZone: () => void;
  baseMode: Zone3DBaseMode;
  onBaseMode: (mode: Zone3DBaseMode) => void;
  scale: number;
  onScale: (scale: number) => void;
}

const chip = (active: boolean): string =>
  `rounded-md border px-1.5 py-1 text-[11px] font-bold whitespace-nowrap transition-colors ${
    active
      ? 'border-sky-600 bg-sky-600 text-white'
      : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
  }`;

const iconBtn =
  'flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer';

/** Thanh điều khiển 3D linh động (góc trên phải, ngang hàng với bộ chọn Layer bên trái). */
export const Zone3DCameraControls: React.FC<Zone3DCameraControlsProps> = ({
  dragMode,
  onDragMode,
  autoOrbit,
  onToggleAutoOrbit,
  pitchDeg,
  onPitch,
  onPitchScrub,
  bearingDeg,
  onBearingScrub,
  onRotate,
  onResetNorth,
  onZoomIn,
  onZoomOut,
  onFitZone,
  baseMode,
  onBaseMode,
  scale,
  onScale,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="absolute right-2 top-[56px] z-[950] w-[224px] rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-md">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between px-2.5 py-1.5 text-left text-[11px] font-bold text-slate-700 hover:bg-slate-50 rounded-xl"
        title={collapsed ? 'Mở bảng điều khiển 3D' : 'Thu gọn bảng điều khiển 3D'}
      >
        <span className="flex items-center gap-1.5">
          <Orbit size={13} className="text-sky-600" />
          <span>Điều khiển 3D</span>
        </span>
        <span className="flex items-center gap-1 font-mono text-[10px] font-semibold text-slate-500">
          {pitchDeg}° · {bearingDeg}°
          {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </span>
      </button>

      {!collapsed && (
        <div className="border-t border-slate-100 px-2.5 pb-2.5 pt-2">
          {/* 1. Chế độ kéo chuột + công cụ nhanh */}
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => onDragMode('orbit')}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1 ${chip(dragMode === 'orbit')}`}
              title="Kéo chuột trái để xoay & nghiêng 3D tự do"
            >
              <Orbit size={12} /> Xoay 3D
            </button>
            <button
              type="button"
              onClick={() => onDragMode('pan')}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1 ${chip(dragMode === 'pan')}`}
              title="Kéo chuột trái để trượt bản đồ"
            >
              <Move size={12} /> Trượt
            </button>
          </div>

          <div className="mb-2.5 flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <button type="button" onClick={onZoomIn} className={iconBtn} title="Phóng to">
                <ZoomIn size={13} />
              </button>
              <button type="button" onClick={onZoomOut} className={iconBtn} title="Thu nhỏ">
                <ZoomOut size={13} />
              </button>
              <button type="button" onClick={onFitZone} className={iconBtn} title="Khớp toàn Zone">
                <Maximize2 size={13} />
              </button>
            </div>
            <button
              type="button"
              onClick={onToggleAutoOrbit}
              className={`flex cursor-pointer items-center gap-1 ${chip(autoOrbit)}`}
              title="Tự động xoay quanh Zone"
            >
              {autoOrbit ? <Pause size={11} /> : <Play size={11} />}
              <span>{autoOrbit ? 'Dừng' : 'Tự xoay'}</span>
            </button>
          </div>

          {/* 2. Góc nghiêng liên tục */}
          <div className="mb-2">
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <span>Góc nghiêng</span>
              <span className="font-mono normal-case text-slate-700">{pitchDeg}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={75}
              step={1}
              value={pitchDeg}
              onChange={(e) => onPitchScrub(Number(e.target.value))}
              className="mb-1 w-full cursor-pointer accent-sky-600"
              aria-label="Góc nghiêng 3D"
            />
            <div className="grid grid-cols-3 gap-1">
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
          </div>

          {/* 3. Góc xoay liên tục */}
          <div className="mb-2">
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <span>Góc xoay</span>
              <span className="font-mono normal-case text-slate-700">{bearingDeg}°</span>
            </div>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={bearingDeg}
              onChange={(e) => onBearingScrub(Number(e.target.value))}
              className="mb-1 w-full cursor-pointer accent-sky-600"
              aria-label="Góc xoay 3D"
            />
            <div className="grid grid-cols-3 gap-1">
              <button type="button" onClick={() => onRotate(-45)} className={`cursor-pointer ${chip(false)}`} title="Xoay trái 45°">
                <RotateCcw size={11} className="inline" /> 45°
              </button>
              <button type="button" onClick={onResetNorth} className={`cursor-pointer ${chip(Math.abs(bearingDeg) < 3)}`} title="Về hướng Bắc">
                <Compass size={11} className="inline" /> Bắc
              </button>
              <button type="button" onClick={() => onRotate(45)} className={`cursor-pointer ${chip(false)}`} title="Xoay phải 45°">
                <RotateCw size={11} className="inline" /> 45°
              </button>
            </div>
          </div>

          {/* 4. Nền trong Zone */}
          <div className="mb-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Nền trong Zone</div>
            <div className="grid grid-cols-2 gap-1">
              {BASE_OPTIONS.map((o) => (
                <button
                  key={o.mode}
                  type="button"
                  onClick={() => onBaseMode(o.mode)}
                  className={`cursor-pointer ${chip(baseMode === o.mode)}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Tỉ lệ chiều cao */}
          <label className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <span>Tỉ lệ cao (minh hoạ)</span>
            <span className="font-mono text-[11px] normal-case text-slate-700">{scale.toFixed(1)}×</span>
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

          <p className="mt-1.5 text-[10px] leading-tight text-slate-500">
            {dragMode === 'orbit'
              ? 'Kéo trái: Xoay 3D · Shift+kéo: Trượt · Cuộn: Zoom.'
              : 'Kéo trái: Trượt · Chuột phải/Ctrl+kéo: Xoay 3D.'}
          </p>
        </div>
      )}
    </div>
  );
};
