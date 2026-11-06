import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FilePlus2, Loader2, PanelRightClose, PanelRightOpen, Printer, RotateCcw, Save, X, ZoomIn, ZoomOut } from 'lucide-react';
import { getErrorMessage } from '@/utils/errorUtils';
import { useAuth } from '../../../../context/AuthContext';
import { CAD_TITLE_BLOCK_LOGOS } from '../../../../assets/cadTitleBlockLogos';
import {
  METRO_ALL_CORRIDOR_SEGMENTS,
  METRO_CORRIDOR_BOUNDARIES,
  METRO_LINE2_CENTERLINE,
  METRO_STATIONS,
  METRO_STATION_DETAILED_OUTLINES,
  METRO_STATION_POLYGONS,
  getZoneByCode,
} from '../../../survey-phase1/constants/metroGisConstants';
import { useZoneSvgExportData } from '../../hooks/useZoneSvgExportData';
import { useZoneDrawingConfig } from '../../hooks/useZoneDrawingConfig';
import type { TitleBlockFormValues } from '../../hooks/useZoneDrawingConfig';
import { DEFAULT_TITLE_BLOCK, downloadSvgFile, generateZoneTechnicalSvg } from '../../utils/zoneSvgTechnicalExporter';
import type { ParcelLabelMode, SvgStationInput, TitleBlockInput, TitleBlockLogoKey, ZoneSvgResult } from '../../utils/zoneSvgTechnicalExporter';

interface ZoneSvgPreviewModalProps {
  zoneId: string;
  onClose: () => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 12;

const LOGO_LABELS: Record<TitleBlockLogoKey, string> = {
  hcmcMetro: 'HCMC Metro',
  guangzhouMetro: 'Guangzhou Metro',
  yooshin: 'Yooshin',
  tediSouth: 'TEDI South',
  portcoast: 'Portcoast',
  thacoCrec: 'THACO – CREC',
};

const TITLE_BLOCK_FIELDS: { key: keyof TitleBlockFormValues; label: string }[] = [
  { key: 'preparedBy', label: 'Người vẽ (Prepared)' },
  { key: 'reviewedBy', label: 'Người kiểm tra (Reviewer)' },
  { key: 'approvedBy', label: 'Người duyệt (Approved by)' },
  { key: 'manager', label: 'Chủ nhiệm (Manager)' },
  { key: 'projectManager', label: 'Giám đốc dự án (Project Manager)' },
  { key: 'drawingNo', label: 'Số bản vẽ (Drawing No)' },
];

const ROLE_BADGES: Record<string, { label: string; className: string }> = {
  ZONE_ADMIN: { label: 'Zone Admin', className: 'bg-amber-950 text-amber-300 border-amber-700' },
  SURVEYOR: { label: 'Khảo Sát Viên', className: 'bg-sky-950 text-sky-300 border-sky-700' },
};
const DEFAULT_ROLE_BADGE = { label: 'Người Dân', className: 'bg-slate-800 text-slate-300 border-slate-600' };

const STATION_INPUTS: SvgStationInput[] = METRO_STATIONS.map((station) => ({
  code: station.code,
  name: station.name,
  coord: station.pos,
}));

const todayIso = (): string => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatDisplayDate = (iso: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
};

const LABEL_MODE_OPTIONS: { mode: ParcelLabelMode; label: string; hint: string; fileTag: string }[] = [
  { mode: 'METHOD_CODE', label: 'Mã Biện Pháp', hint: 'ST04-L-0146 · bản vẽ biện pháp bàn giao', fileTag: 'BP' },
  { mode: 'SURVEY_CODE', label: 'Mã Khảo Sát', hint: 'C&C-04-B-0146 · đối soát hiện trường', fileTag: 'KS' },
];

const buildFileName = (drawingCode: string, labelMode: ParcelLabelMode, revision: string): string => {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const tag = LABEL_MODE_OPTIONS.find((option) => option.mode === labelMode)?.fileTag ?? 'KS';
  return `BinhDo_${drawingCode}_${tag}_${revision}_${stamp}.svg`;
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

const StaticValue: React.FC<{ value: string }> = ({ value }) => (
  <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-750 text-slate-200 text-xs font-semibold min-h-[30px]">
    {value || '---'}
  </div>
);

export const ZoneSvgPreviewModal: React.FC<ZoneSvgPreviewModalProps> = ({ zoneId, onClose }) => {
  const { user } = useAuth();
  const canEditTitleBlock = user?.role === 'SUPER_ADMIN';
  const { parcels, isLoading, error: loadError } = useZoneSvgExportData(zoneId);

  const zoneConfig = getZoneByCode(zoneId);
  const zoneCode = zoneConfig?.code ?? zoneId;
  const zoneName = zoneConfig?.name ?? zoneId;
  const drawingConfig = useZoneDrawingConfig(zoneCode);

  const [labelMode, setLabelMode] = useState<ParcelLabelMode>('METHOD_CODE');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showCompass, setShowCompass] = useState<boolean>(true);
  const [showRouteScheme, setShowRouteScheme] = useState<boolean>(true);
  const [showControlTable, setShowControlTable] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [showScaleBar, setShowScaleBar] = useState<boolean>(false);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const panOriginRef = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null);

  const [form, setForm] = useState<TitleBlockFormValues>({
    preparedBy: DEFAULT_TITLE_BLOCK.preparedBy,
    reviewedBy: DEFAULT_TITLE_BLOCK.reviewedBy,
    approvedBy: DEFAULT_TITLE_BLOCK.approvedBy,
    manager: DEFAULT_TITLE_BLOCK.manager,
    projectManager: DEFAULT_TITLE_BLOCK.projectManager,
    drawingNo: DEFAULT_TITLE_BLOCK.drawingNo,
  });
  const [revisionDate, setRevisionDate] = useState<string>(todayIso());
  const [revisionDescription, setRevisionDescription] = useState<string>('');
  const [panelMessage, setPanelMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  // Đồng bộ form với cấu hình đã lưu mỗi khi tải lại từ máy chủ
  useEffect(() => {
    const saved = drawingConfig.config?.titleBlock;
    if (!saved) return;
    setForm({
      preparedBy: saved.preparedBy,
      reviewedBy: saved.reviewedBy,
      approvedBy: saved.approvedBy,
      manager: saved.manager,
      projectManager: saved.projectManager,
      drawingNo: saved.drawingNo,
    });
  }, [drawingConfig.config]);

  // Bản vẽ luôn dùng cấu hình ĐÃ LƯU (hoặc giá trị bản vẽ mẫu), không dùng nội dung đang gõ dở
  const titleBlock = useMemo<TitleBlockInput>(() => {
    const saved = drawingConfig.config?.titleBlock;
    const revisions = (drawingConfig.config?.revisions ?? []).map((rev) => ({
      revision: rev.revision,
      issueDate: rev.issueDate,
      description: rev.description,
    }));
    return saved
      ? {
          preparedBy: saved.preparedBy,
          reviewedBy: saved.reviewedBy,
          approvedBy: saved.approvedBy,
          manager: saved.manager,
          projectManager: saved.projectManager,
          drawingNo: saved.drawingNo,
          revisions,
        }
      : { ...DEFAULT_TITLE_BLOCK, revisions };
  }, [drawingConfig.config]);

  const surveyBoundary = useMemo<[number, number][] | undefined>(() => {
    if (!zoneConfig || zoneConfig.type === 'DEP') return undefined;
    return METRO_ALL_CORRIDOR_SEGMENTS[zoneConfig.index - 1]?.coords;
  }, [zoneConfig]);

  const isConfigPending = drawingConfig.isLoading;

  const { result, generateError } = useMemo<{ result: ZoneSvgResult | null; generateError: string | null }>(() => {
    if (isLoading || loadError || isConfigPending) return { result: null, generateError: null };
    if (!zoneConfig) {
      console.error('[ZoneSvgExport:Generate] Unknown zone code:', zoneId);
      return { result: null, generateError: `Không xác định được Zone ${zoneId}` };
    }
    if (!surveyBoundary && zoneConfig.type !== 'DEP') {
      console.error('[ZoneSvgExport:Boundary] Missing survey boundary polygon for zone:', zoneConfig.code);
    }
    try {
      const generated = generateZoneTechnicalSvg({
        zoneCode,
        zoneName,
        zoneKind: zoneConfig.type,
        zoneIndex: zoneConfig.index,
        parcels,
        centerlineCoords: METRO_LINE2_CENTERLINE,
        corridorBoundaries: METRO_CORRIDOR_BOUNDARIES,
        stationBoxes: METRO_STATION_POLYGONS,
        stationOutlines: METRO_STATION_DETAILED_OUTLINES,
        surveyBoundary,
        stations: STATION_INPUTS,
        titleBlock,
        logos: CAD_TITLE_BLOCK_LOGOS,
        autoRotateHorizontal: autoRotate,
        includeCompass: showCompass,
        includeLabels: showLabels,
        includeRouteScheme: showRouteScheme,
        includeControlTable: showControlTable,
        includeLegend: showLegend,
        includeScaleBar: showScaleBar,
        parcelLabelMode: labelMode,
      });
      if (generated.missingLogos.length > 0) {
        console.error('[ZoneSvgExport:Logo] Missing title block logos:', generated.missingLogos);
      }
      return { result: generated, generateError: null };
    } catch (err: unknown) {
      console.error('[ZoneSvgExport:Generate] Failed to generate SVG:', err);
      return { result: null, generateError: getErrorMessage(err, 'Không thể tạo bình đồ.') };
    }
  }, [
    isLoading, loadError, isConfigPending, zoneConfig, zoneId, zoneCode, zoneName, parcels, surveyBoundary, titleBlock,
    autoRotate, showCompass, showLabels, showRouteScheme, showControlTable, showLegend, showScaleBar, labelMode,
  ]);

  const svgContent = result?.svg ?? null;
  const errorMessage = loadError ?? generateError;
  const latestRevision = titleBlock.revisions[titleBlock.revisions.length - 1]?.revision ?? 'R00';

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

  const handleSaveTitleBlock = async () => {
    setPanelMessage(null);
    const errorText = await drawingConfig.saveTitleBlock(form);
    setPanelMessage(errorText ? { tone: 'error', text: errorText } : { tone: 'ok', text: 'Đã lưu khung tên.' });
  };

  const handleIssueRevision = async () => {
    setPanelMessage(null);
    const errorText = await drawingConfig.issueRevision(revisionDate, revisionDescription.trim());
    if (errorText) {
      setPanelMessage({ tone: 'error', text: errorText });
      return;
    }
    setRevisionDescription('');
    setPanelMessage({ tone: 'ok', text: 'Đã phát hành lần mới.' });
  };

  const toggles = [
    { label: 'Xoay tim tuyến nằm ngang', checked: autoRotate, onChange: setAutoRotate },
    { label: 'Nhãn mã thửa', checked: showLabels, onChange: setShowLabels },
    { label: 'La bàn', checked: showCompass, onChange: setShowCompass },
    { label: 'Sơ đồ tuyến', checked: showRouteScheme, onChange: setShowRouteScheme },
    { label: 'Bảng điểm khống chế', checked: showControlTable, onChange: setShowControlTable },
    { label: 'Chú giải', checked: showLegend, onChange: setShowLegend },
    { label: 'Thước tỷ lệ', checked: showScaleBar, onChange: setShowScaleBar },
  ];

  const roleBadge = ROLE_BADGES[user?.role ?? ''] ?? DEFAULT_ROLE_BADGE;
  const isRevisionFormValid = revisionDescription.trim().length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(revisionDate);

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/70 p-4">
      <div className="flex h-full max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900">
              Bình Đồ Kỹ Thuật Khổ A3 (.SVG){result ? ` · ${result.identity.drawingCode} · ${latestRevision}` : ''}
            </h3>
            <p className="truncate text-xs text-slate-500">{zoneName}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsPanelOpen((open) => !open)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
              title={isPanelOpen ? 'Ẩn khung tên' : 'Hiện khung tên'}
            >
              {isPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
              title="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-5 py-2.5">
          <div className="flex items-center rounded-xl border border-slate-300 bg-slate-100 p-0.5" role="tablist" aria-label="Chế độ nhãn thửa">
            {LABEL_MODE_OPTIONS.map(({ mode, label, hint }) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={labelMode === mode}
                onClick={() => setLabelMode(mode)}
                title={hint}
                className={`rounded-lg px-3 py-1 text-xs font-bold cursor-pointer ${
                  labelMode === mode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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

        {(drawingConfig.error || (result && result.missingLogos.length > 0)) && (
          <div className="space-y-0.5 border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs font-semibold text-amber-800">
            {drawingConfig.error && <p>{drawingConfig.error}</p>}
            {result && result.missingLogos.length > 0 && (
              <p>Thiếu logo khung tên: {result.missingLogos.map((key) => LOGO_LABELS[key]).join(', ')} (đang hiển thị ô chữ thay thế).</p>
            )}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <div
            className={`force-light relative flex-1 overflow-hidden bg-slate-200 touch-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={(e) => changeZoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)}
          >
            {(isLoading || isConfigPending) && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-600">
                <Loader2 size={18} className="animate-spin" />
                Đang tải dữ liệu thửa đất và khung tên...
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

          {isPanelOpen && (
            <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                  Khung Tên Bản Vẽ{canEditTitleBlock ? '' : ' (Chỉ Đọc)'}
                </h4>
                {!canEditTitleBlock && (
                  <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${roleBadge.className}`}>
                    {roleBadge.label}
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {TITLE_BLOCK_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <p className="mb-1 text-[11px] font-semibold text-slate-600">{label}</p>
                    {canEditTitleBlock ? (
                      <input
                        type="text"
                        value={form[key]}
                        maxLength={key === 'drawingNo' ? 60 : 80}
                        onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                      />
                    ) : (
                      <StaticValue value={titleBlock[key]} />
                    )}
                  </div>
                ))}
              </div>

              {canEditTitleBlock ? (
                <button
                  type="button"
                  onClick={handleSaveTitleBlock}
                  disabled={drawingConfig.isSaving || drawingConfig.isLoading}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {drawingConfig.isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Lưu khung tên
                </button>
              ) : (
                <div className="mt-3 rounded-xl border bg-slate-800 text-teal-300 border-teal-500/30 font-bold px-3 py-2 text-center text-xs">
                  Khung Tên Tham Khảo · Chỉ Super Admin được sửa
                </div>
              )}

              <div className="mt-5">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-800">Lịch sử phát hành</h4>
                {titleBlock.revisions.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Chưa phát hành lần nào; bản vẽ ghi R00 và ngày để trống như bản mẫu.
                    {canEditTitleBlock ? '' : ' Liên hệ Super Admin để phát hành bản chính thức.'}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {[...(drawingConfig.config?.revisions ?? [])].reverse().map((rev) => (
                      <li key={rev.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                        <span className="font-mono font-bold text-slate-900">{rev.revision}</span>
                        <span className="ml-2 text-slate-500">{formatDisplayDate(rev.issueDate)}</span>
                        <p className="mt-0.5">{rev.description}</p>
                        {rev.createdByName && <p className="mt-0.5 text-[10px] text-slate-400">{rev.createdByName}</p>}
                      </li>
                    ))}
                  </ul>
                )}

                {canEditTitleBlock && (
                  <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-semibold text-slate-600">Phát hành lần mới (số REV do hệ thống cấp)</p>
                    <input
                      type="date"
                      value={revisionDate}
                      onChange={(e) => setRevisionDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={revisionDescription}
                      maxLength={200}
                      placeholder="Nội dung sửa đổi (VD: Bổ sung 15 thửa khu B)"
                      onChange={(e) => setRevisionDescription(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={handleIssueRevision}
                      disabled={!isRevisionFormValid || drawingConfig.isSaving || drawingConfig.isLoading}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FilePlus2 size={14} />
                      Phát hành lần mới
                    </button>
                  </div>
                )}
              </div>

              {panelMessage && (
                <p className={`mt-3 text-xs font-semibold ${panelMessage.tone === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {panelMessage.text}
                </p>
              )}

              {result && result.controlPoints.length > 0 && (
                <p className="mt-4 text-[11px] text-slate-500">
                  {result.controlPoints.length} điểm khống chế VN2000 (TM-3 105°45′), hiệu chỉnh theo 20 điểm bản vẽ mẫu ST01.
                </p>
              )}
            </aside>
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
              In bản vẽ A3
            </button>
            <button
              type="button"
              onClick={() => svgContent && result && downloadSvgFile(svgContent, buildFileName(result.identity.drawingCode, result.labelMode, latestRevision))}
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
