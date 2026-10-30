import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, Printer, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { getErrorMessage } from '@/utils/errorUtils';
import {
  METRO_CORRIDOR_BOUNDARIES,
  METRO_LINE2_CENTERLINE,
  METRO_STATION_DETAILED_OUTLINES,
  METRO_STATION_POLYGONS,
  getZoneByCode,
} from '../../../survey-phase1/constants/metroGisConstants';
import { useZoneSvgExportData } from '../../hooks/useZoneSvgExportData';
import { downloadSvgFile, generateZoneTechnicalSvg } from '../../utils/zoneSvgTechnicalExporter';
import type { ZoneSvgResult } from '../../utils/zoneSvgTechnicalExporter';

interface ZoneSvgPreviewModalProps {
  zoneId: string;
  onClose: () => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 12;

const buildFileName = (zoneCode: string): string => {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `BinhDo_${zoneCode}_${stamp}.svg`;
};

const printSvg = (svg: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page { size: A3 landscape; margin: 0; } html, body { margin: 0; } svg { display: block; width: 420mm; height: 297mm; }</style></head><body>${svg.replace(/^<\?xml[^>]*\?>\s*/, '')}</body></html>`;
  iframe.onload = () => {
    const printWindow = iframe.contentWindow;
    if (!printWindow) {
      console.error('[ZoneSvgExport:Print] Print frame has no window');
      iframe.remove();
      return;
    }
    printWindow.addEventListener('afterprint', () => iframe.remove());
    printWindow.focus();
    printWindow.print();
  };
  document.body.appendChild(iframe);
};

export const ZoneSvgPreviewModal: React.FC<ZoneSvgPreviewModalProps> = ({ zoneId, onClose }) => {
  const { parcels, isLoading, error: loadError } = useZoneSvgExportData(zoneId);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showCompass, setShowCompass] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const panOriginRef = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null);

  const zoneConfig = getZoneByCode(zoneId);
  const zoneCode = zoneConfig?.code ?? zoneId;
  const zoneName = zoneConfig?.name ?? zoneId;

  const { result, generateError } = useMemo<{ result: ZoneSvgResult | null; generateError: string | null }>(() => {
    if (isLoading || loadError) return { result: null, generateError: null };
    try {
      const generated = generateZoneTechnicalSvg({
        zoneCode,
        zoneName,
        parcels,
        centerlineCoords: METRO_LINE2_CENTERLINE,
        corridorBoundaries: METRO_CORRIDOR_BOUNDARIES,
        stationBoxes: METRO_STATION_POLYGONS,
        stationOutlines: METRO_STATION_DETAILED_OUTLINES,
        autoRotateHorizontal: autoRotate,
        includeCompass: showCompass,
        includeLabels: showLabels,
      });
      return { result: generated, generateError: null };
    } catch (err: unknown) {
      console.error('[ZoneSvgExport:Generate] Failed to generate SVG:', err);
      return { result: null, generateError: getErrorMessage(err, 'Không thể tạo bình đồ.') };
    }
  }, [isLoading, loadError, parcels, zoneCode, zoneName, autoRotate, showCompass, showLabels]);

  const svgContent = result?.svg ?? null;
  const errorMessage = loadError ?? generateError;

  useEffect(() => {
    if (!svgContent) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' }));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [svgContent]);

  const changeZoom = (factor: number) => {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current * factor)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    panOriginRef.current = { pointerX: e.clientX, pointerY: e.clientY, panX: pan.x, panY: pan.y };
    setIsPanning(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const origin = panOriginRef.current;
    if (!origin) return;
    setPan({ x: origin.panX + e.clientX - origin.pointerX, y: origin.panY + e.clientY - origin.pointerY });
  };

  const handlePointerUp = () => {
    panOriginRef.current = null;
    setIsPanning(false);
  };

  const toggles = [
    { label: 'Xoay tim tuyến nằm ngang', checked: autoRotate, onChange: setAutoRotate },
    { label: 'Hiển thị nhãn mã thửa đất', checked: showLabels, onChange: setShowLabels },
    { label: 'Hiển thị la bàn hướng Bắc', checked: showCompass, onChange: setShowCompass },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/70 p-4">
      <div className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900">Bình Đồ Kỹ Thuật Vector (.SVG)</h3>
            <p className="truncate text-xs text-slate-500">{zoneName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-5 py-2.5">
          {toggles.map(({ label, checked, onChange }) => (
            <label key={label} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="cursor-pointer"
              />
              {label}
            </label>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => changeZoom(1 / 1.4)}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer"
              title="Thu nhỏ"
            >
              <ZoomOut size={15} />
            </button>
            <span className="w-12 text-center font-mono text-xs text-slate-600">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => changeZoom(1.4)}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer"
              title="Phóng to"
            >
              <ZoomIn size={15} />
            </button>
            <button
              type="button"
              onClick={resetView}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer"
              title="Đặt lại khung nhìn"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        <div
          className={`force-light relative flex-1 overflow-hidden bg-slate-200 touch-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={(e) => changeZoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-600">
              <Loader2 size={18} className="animate-spin" />
              Đang tải dữ liệu thửa đất...
            </div>
          )}
          {errorMessage && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-semibold text-rose-700">
              {errorMessage}
            </div>
          )}
          {previewUrl && (
            <img
              src={previewUrl}
              alt={`Bình đồ kỹ thuật ${zoneName}`}
              draggable={false}
              className="h-full w-full select-none object-contain"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            {result && (
              <>
                <span>Số thửa: <strong>{result.parcelCount.toLocaleString('vi-VN')}</strong></span>
                <span>Tỷ lệ: <strong>1:{result.scaleDenominator.toLocaleString('vi-VN')}</strong></span>
                <span>Góc xoay: <strong>{result.rotationDeg.toFixed(2)}°</strong></span>
                <span>Độ lệch tim tuyến: <strong>±{result.residualMeters.toFixed(1)} m</strong></span>
                {result.skippedParcels > 0 && (
                  <span className="font-bold text-amber-700">Bỏ qua {result.skippedParcels} thửa thiếu mã hoặc hình học</span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => svgContent && printSvg(svgContent)}
              disabled={!svgContent}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer size={14} />
              In bản vẽ
            </button>
            <button
              type="button"
              onClick={() => svgContent && downloadSvgFile(svgContent, buildFileName(zoneCode))}
              disabled={!svgContent}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              Tải file .SVG
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
