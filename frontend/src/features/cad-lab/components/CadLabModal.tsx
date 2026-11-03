import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  BoxSelect,
  Compass,
  Download,
  DraftingCompass,
  Eraser,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  LoaderCircle,
  MousePointer2,
  PenLine,
  Play,
  Redo2,
  RotateCcw,
  RotateCw,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { getErrorMessage } from '../../../utils/errorUtils';
import type { CadGraph, CadLabParams, CadLabStats, CadProjectSketch, CadRect } from '../types/cadLab.types';
import { getDefaultCadLabParams } from '../engine/cadLabDspCore';
import {
  CAD_LAB_SAMPLE_URL,
  fetchSketchBlob,
  loadSketchImage,
  resetCadLabWorker,
  vectorizeInBackground,
} from '../engine/clientCadLabService';
import type { LoadedSketch, QuarterTurns } from '../engine/clientCadLabService';
import { renderCadSvg, svgToPngBlob } from '../utils/cadSvgRenderer';
import { renderCadDxf } from '../utils/cadDxfWriter';
import {
  countFilledTextBoxes,
  deleteColumn,
  deleteEdge,
  deleteTextBox,
  deleteVertex,
  resolveAllSuspectEdges,
  setEdgeAngleClass,
  straightenToAxis,
  updateTextBox,
} from '../utils/cadGraphEdit';
import { CadProjectSourcePicker, CAD_TYPE_BADGE } from './CadProjectSourcePicker';
import { CadSvgEditor } from './CadSvgEditor';
import type { CadEditorTool, CadSelection } from './CadSvgEditor';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_HISTORY = 60;

/** Ảnh đang dùng làm nguồn; giữ Blob để xoay lại mà không tải lại. */
interface SketchSource {
  label: string;
  baseName: string;
  blob: Blob;
  url: string | null;
}

const QUICK_TEXTS = ['20x20', '20x30', '20x35', '30x30', '40x25', 'Dầm D1', 'Cột C1', 'Tầng trệt'];

const TOOLS: { id: CadEditorTool; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'SELECT', label: 'Chọn / Kéo', hint: 'Chọn và kéo đỉnh, cột, ô chữ', icon: <MousePointer2 className="w-3.5 h-3.5" /> },
  { id: 'ADD_EDGE', label: 'Vẽ nét', hint: 'Bấm điểm đầu rồi điểm cuối; Esc để hủy', icon: <DraftingCompass className="w-3.5 h-3.5" /> },
  { id: 'ADD_COLUMN', label: 'Đóng dấu cột', hint: 'Bấm vào vị trí cột', icon: <Square className="w-3.5 h-3.5" /> },
  { id: 'ADD_TEXT', label: 'Ô chữ', hint: 'Bấm để đặt ô chữ với nội dung đang chọn', icon: <Type className="w-3.5 h-3.5" /> },
  { id: 'ERASE_RECT', label: 'Khoanh xóa nét', hint: 'Kéo khung quanh chữ dính vào khung rồi nhận dạng lại', icon: <Eraser className="w-3.5 h-3.5" /> },
];

interface SliderDef {
  key: keyof Omit<CadLabParams, 'eraseRects'>;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const SLIDERS: SliderDef[] = [
  { key: 'thresholdBiasPct', label: 'Độ nhạy tách mực', min: 3, max: 35, step: 1, unit: '%' },
  { key: 'orthoToleranceDeg', label: 'Ngưỡng ép vuông góc', min: 1, max: 12, step: 0.5, unit: '°' },
  { key: 'slantSuspectMaxDeg', label: 'Ngưỡng nghi cạnh xiên', min: 4, max: 25, step: 1, unit: '°' },
  { key: 'weldRadiusPx', label: 'Bán kính hàn đỉnh', min: 2, max: 20, step: 1, unit: 'px' },
  { key: 'beamGapMinPx', label: 'Bề rộng dầm tối thiểu', min: 3, max: 30, step: 1, unit: 'px' },
  { key: 'beamGapMaxPx', label: 'Bề rộng dầm tối đa', min: 8, max: 80, step: 1, unit: 'px' },
  { key: 'columnDensity', label: 'Mực tối thiểu trong ô cột', min: 0.05, max: 0.6, step: 0.01, unit: '' },
  { key: 'rdpEpsilonPx', label: 'Độ rút gọn nét', min: 1, max: 10, step: 0.5, unit: 'px' },
];

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const CadLabModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<SketchSource | null>(null);
  const [quarterTurns, setQuarterTurns] = useState<QuarterTurns>(0);
  const [sketch, setSketch] = useState<LoadedSketch | null>(null);
  const [params, setParams] = useState<CadLabParams | null>(null);
  const [history, setHistory] = useState<CadGraph[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [stats, setStats] = useState<CadLabStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [tool, setTool] = useState<CadEditorTool>('SELECT');
  const [orthoLock, setOrthoLock] = useState(true);
  const [selection, setSelection] = useState<CadSelection | null>(null);
  const [underlayOpacity, setUnderlayOpacity] = useState(0.35);
  const [showUnderlay, setShowUnderlay] = useState(true);
  const [pendingText, setPendingText] = useState('20x20');

  const graph = historyIndex >= 0 ? history[historyIndex] : null;
  const hasManualEdits = historyIndex > 0;

  /** Ô chữ đang gõ: các phím gõ liên tiếp gộp thành một bước hoàn tác. */
  const typingTextIdRef = useRef<string | null>(null);

  const commit = useCallback(
    (next: CadGraph, nextSelection?: CadSelection | null) => {
      typingTextIdRef.current = null;
      const kept = history.slice(0, historyIndex + 1);
      const list = [...kept, next].slice(-MAX_HISTORY);
      setHistory(list);
      setHistoryIndex(list.length - 1);
      if (nextSelection !== undefined) setSelection(nextSelection);
    },
    [history, historyIndex]
  );

  const commitTyping = useCallback(
    (textId: string, text: string) => {
      const current = history[historyIndex];
      if (!current) return;
      const next = updateTextBox(current, textId, { text });
      if (typingTextIdRef.current === textId && historyIndex > 0) {
        setHistory((prev) => prev.map((g, i) => (i === historyIndex ? next : g)));
        return;
      }
      commit(next);
      typingTextIdRef.current = textId;
    },
    [commit, history, historyIndex]
  );

  /** Chỉ lượt nhận dạng mới nhất được cập nhật giao diện; lượt cũ bị hủy khi người dùng chạy lại. */
  const runSeqRef = useRef(0);

  const runVectorize = useCallback(async (source: LoadedSketch, runParams: CadLabParams) => {
    const seq = ++runSeqRef.current;
    setIsProcessing(true);
    setErrorMessage('');
    setSelection(null);
    try {
      resetCadLabWorker();
      const result = await vectorizeInBackground(source.gray, source.width, source.height, runParams);
      if (seq !== runSeqRef.current) return;
      typingTextIdRef.current = null;
      setHistory([result.graph]);
      setHistoryIndex(0);
      setStats(result.stats);
    } catch (err: unknown) {
      if (seq !== runSeqRef.current) {
        console.warn('[CadLabModal:Vectorize] Lượt nhận dạng cũ đã bị thay bằng lượt mới:', err);
        return;
      }
      console.error('[CadLabModal:Vectorize] Nhận dạng bản vẽ thất bại:', err);
      setErrorMessage(`Nhận dạng thất bại: ${getErrorMessage(err)}`);
    } finally {
      if (seq === runSeqRef.current) setIsProcessing(false);
    }
  }, []);

  /** Nguồn mới chỉ thay nguồn cũ khi đọc ảnh thành công, để lỗi không làm mất bản vẽ đang có. */
  const loadAndRun = useCallback(
    async (nextSource: SketchSource, turns: QuarterTurns) => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const loaded = await loadSketchImage(nextSource.blob, turns);
        setSource(nextSource);
        setQuarterTurns(turns);
        const defaults = getDefaultCadLabParams(loaded.width, loaded.height);
        setSketch(loaded);
        setParams(defaults);
        await runVectorize(loaded, defaults);
      } catch (err: unknown) {
        console.error('[CadLabModal:LoadImage] Không đọc được ảnh phác thảo:', err);
        setErrorMessage(`Không đọc được ảnh: ${getErrorMessage(err)}`);
      } finally {
        setIsLoading(false);
      }
    },
    [runVectorize]
  );

  const confirmDiscardEdits = (): boolean =>
    !hasManualEdits || window.confirm('Nhận dạng lại sẽ bỏ các chỉnh sửa tay trên bản vẽ hiện tại. Tiếp tục?');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    if (!confirmDiscardEdits()) return;
    void loadAndRun({ label: picked.name, baseName: picked.name.replace(/\.[^.]+$/, ''), blob: picked, url: null }, 0);
  };

  const loadFromUrl = async (url: string, label: string, baseName: string) => {
    if (!confirmDiscardEdits()) return;
    setIsLoading(true);
    setErrorMessage('');
    let blob: Blob;
    try {
      blob = await fetchSketchBlob(url);
    } catch (err: unknown) {
      console.error('[CadLabModal:LoadProjectCad] Không tải được bản vẽ:', url, err);
      setErrorMessage(`Không tải được bản vẽ ${label}: ${getErrorMessage(err)}`);
      setIsLoading(false);
      return;
    }
    await loadAndRun({ label, baseName, blob, url }, 0);
  };

  const handlePickProject = (item: CadProjectSketch) => {
    const typeLabel = CAD_TYPE_BADGE[item.cadType].label;
    const label = `${typeLabel} · ${item.parcelCode || 'Chưa có mã'} · ${item.floorName || '---'}`;
    void loadFromUrl(item.url, label, `${item.parcelCode || 'ho-so'}-${item.floorName || 'tang'}-${typeLabel}`);
  };

  const handlePickSample = () => {
    void loadFromUrl(CAD_LAB_SAMPLE_URL, 'Mẫu vẽ tay: Mặt bằng kết cấu tầng trệt', 'mau-ve-tay-ket-cau');
  };

  const handleRotate = (delta: 1 | 3) => {
    if (!source || !confirmDiscardEdits()) return;
    void loadAndRun(source, ((quarterTurns + delta) % 4) as QuarterTurns);
  };

  const handleRerun = () => {
    if (!sketch || !params || !confirmDiscardEdits()) return;
    void runVectorize(sketch, params);
  };

  const handleResetParams = () => {
    if (!sketch) return;
    setParams(getDefaultCadLabParams(sketch.width, sketch.height));
  };

  const handleEraseRect = (rect: CadRect) => {
    if (!sketch || !params || !confirmDiscardEdits()) return;
    const nextParams = { ...params, eraseRects: [...params.eraseRects, rect] };
    setParams(nextParams);
    void runVectorize(sketch, nextParams);
  };

  const handleClearEraseRects = () => {
    if (!sketch || !params || params.eraseRects.length === 0 || !confirmDiscardEdits()) return;
    const nextParams = { ...params, eraseRects: [] };
    setParams(nextParams);
    void runVectorize(sketch, nextParams);
  };

  const undo = useCallback(() => {
    typingTextIdRef.current = null;
    setSelection(null);
    setHistoryIndex((i) => Math.max(0, i - 1));
  }, []);
  const redo = useCallback(() => {
    typingTextIdRef.current = null;
    setSelection(null);
    setHistoryIndex((i) => Math.min(history.length - 1, i + 1));
  }, [history.length]);

  const deleteSelection = useCallback(() => {
    if (!graph || !selection) return;
    const next =
      selection.kind === 'VERTEX'
        ? deleteVertex(graph, selection.id)
        : selection.kind === 'EDGE'
        ? deleteEdge(graph, selection.id)
        : selection.kind === 'COLUMN'
        ? deleteColumn(graph, selection.id)
        : deleteTextBox(graph, selection.id);
    commit(next, null);
  }, [commit, graph, selection]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, undo, redo, deleteSelection]);

  const exportBaseName = useMemo(() => {
    const raw = source?.baseName || 'ban-ve';
    return `cad-lab-${raw.replace(/[^\w.-]+/g, '_')}`;
  }, [source]);

  const handleExport = async (format: 'svg' | 'png' | 'dxf') => {
    if (!graph) return;
    setIsExporting(true);
    try {
      if (format === 'dxf') {
        downloadBlob(new Blob([renderCadDxf(graph)], { type: 'application/dxf' }), `${exportBaseName}.dxf`);
      } else {
        const svg = renderCadSvg(graph);
        if (format === 'svg') {
          downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${exportBaseName}.svg`);
        } else {
          downloadBlob(await svgToPngBlob(svg, graph.width, graph.height, 2), `${exportBaseName}.png`);
        }
      }
    } catch (err: unknown) {
      console.error(`[CadLabModal:Export] Xuất tệp ${format.toUpperCase()} thất bại:`, err);
      setErrorMessage(`Xuất ${format.toUpperCase()} thất bại: ${getErrorMessage(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const selectedEdge = graph && selection?.kind === 'EDGE' ? graph.edges.find((e) => e.id === selection.id) : undefined;
  const selectedText = graph && selection?.kind === 'TEXT' ? graph.textBoxes.find((t) => t.id === selection.id) : undefined;
  const suspectCount = graph ? graph.edges.filter((e) => e.angleClass === 'SLANT_SUSPECT').length : 0;
  const busy = isLoading || isProcessing;

  // Gắn thẳng vào body: modal nằm trong thanh trên có z-index thấp vẫn phủ được Sidebar
  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-white text-slate-900 w-full max-w-[1720px] h-[95vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 bg-white flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
              <DraftingCompass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-800">
                  CAD LAB: CHUYỂN PHÁC THẢO TAY SANG BẢN VẼ KỸ THUẬT
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-300">
                  SANDBOX ĐỘC LẬP
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Chỉ để thử nghiệm và tải bản vẽ về máy. Không ghi vào hồ sơ khảo sát, không thay ảnh phác thảo gốc.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-rose-600 text-slate-600 hover:text-white transition-all cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Cột trái: nguồn ảnh, tham số, đối tượng đang chọn */}
          <div className="w-full lg:w-[340px] border-r border-slate-200 bg-slate-50 flex flex-col overflow-y-auto shrink-0 p-3.5 space-y-3.5">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-teal-600" />
                1. Nguồn bản vẽ
              </span>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Chọn ảnh từ máy
                </button>
                <button
                  type="button"
                  onClick={handlePickSample}
                  disabled={busy}
                  title="Phác thảo mặt bằng kết cấu tầng trệt: cạnh xiên, giật cấp chữ L, dầm nét đôi, cột 20x20"
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-teal-300 hover:bg-teal-50 text-teal-800 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  Mẫu vẽ tay
                </button>
              </div>
              <CadProjectSourcePicker selectedUrl={source?.url ?? null} disabled={busy} onPick={handlePickProject} />
              {source && (
                <>
                  <div className="text-[11px] text-slate-600 truncate pt-1 border-t border-slate-100" title={source.label}>
                    {source.label}
                    {sketch && (
                      <span className="text-slate-400">
                        {' '}
                        · {sketch.sourceWidth}×{sketch.sourceHeight} → {sketch.width}×{sketch.height}px
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRotate(3)}
                      disabled={busy}
                      className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Xoay trái 90°
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRotate(1)}
                      disabled={busy}
                      className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Xoay phải 90°
                    </button>
                  </div>
                </>
              )}
            </div>

            {params && (
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">2. Tham số nhận dạng</span>
                  <button
                    type="button"
                    onClick={handleResetParams}
                    className="text-[10px] font-bold text-slate-500 hover:text-teal-700 cursor-pointer"
                  >
                    Mặc định
                  </button>
                </div>
                {SLIDERS.map((s) => (
                  <label key={s.key} className="block">
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>{s.label}</span>
                      <span className="font-mono font-bold text-slate-800">
                        {params[s.key]}
                        {s.unit}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={params[s.key]}
                      onChange={(e) => setParams({ ...params, [s.key]: Number(e.target.value) })}
                      className="w-full accent-teal-600 cursor-pointer"
                    />
                  </label>
                ))}
                {params.eraseRects.length > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                    <span>Đang xóa {params.eraseRects.length} vùng nét</span>
                    <button type="button" onClick={handleClearEraseRects} className="font-bold underline cursor-pointer">
                      Bỏ hết
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleRerun}
                  disabled={busy || !sketch}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-3.5 h-3.5" /> Nhận dạng lại với tham số này
                </button>
              </div>
            )}

            {graph && (
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">3. Đối tượng đang chọn</span>
                {!selection && <p className="text-[11px] text-slate-500">Dùng công cụ "Chọn / Kéo" rồi bấm vào cạnh, đỉnh, cột hoặc ô chữ.</p>}

                {selectedEdge && (
                  <div className="space-y-2">
                    <div className="text-[11px] text-slate-600">
                      Cạnh <span className="font-mono font-bold">{selectedEdge.id}</span> ·{' '}
                      {selectedEdge.kind === 'BEAM_PAIR' ? `nét dầm (rộng ${selectedEdge.beamWidthPx}px)` : 'nét đơn'} ·{' '}
                      {selectedEdge.angleClass === 'ORTHO' ? 'vuông góc' : selectedEdge.angleClass === 'SLANT' ? 'xiên' : 'nghi xiên, chưa chọn'}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => commit(setEdgeAngleClass(graph, selectedEdge.id, 'ORTHO'))}
                        className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 cursor-pointer"
                      >
                        Ép vuông
                      </button>
                      <button
                        type="button"
                        onClick={() => commit(setEdgeAngleClass(graph, selectedEdge.id, 'SLANT'))}
                        className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 cursor-pointer"
                      >
                        Giữ xiên
                      </button>
                    </div>
                  </div>
                )}

                {selectedText && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={selectedText.text}
                      placeholder="Nhập nội dung, VD: 20x20"
                      onChange={(e) => commitTyping(selectedText.id, e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-teal-500"
                    />
                    <div className="flex flex-wrap gap-1">
                      {QUICK_TEXTS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => commit(updateTextBox(graph, selectedText.id, { text: q }))}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 hover:bg-teal-100 text-slate-700 border border-slate-200 cursor-pointer"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selection && (
                  <button
                    type="button"
                    onClick={deleteSelection}
                    className="w-full px-2 py-1.5 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa đối tượng (Delete)
                  </button>
                )}

                {tool === 'ADD_TEXT' && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <span className="text-[11px] text-slate-600">Nội dung ô chữ mới</span>
                    <input
                      type="text"
                      value={pendingText}
                      onChange={(e) => setPendingText(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-teal-500"
                    />
                    <div className="flex flex-wrap gap-1">
                      {QUICK_TEXTS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setPendingText(q)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                            pendingText === q ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-100 hover:bg-teal-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Khu trung tâm: thanh công cụ, bản vẽ, thống kê */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <div className="px-3 py-2 border-b border-slate-200 bg-white flex flex-wrap items-center gap-1.5 shrink-0">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTool(t.id)}
                  disabled={!graph}
                  title={t.hint}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    tool === t.id ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
              <span className="w-px h-6 bg-slate-200 mx-1" />
              <button
                type="button"
                onClick={() => setOrthoLock((v) => !v)}
                title="Khóa vuông góc: kéo đỉnh và vẽ nét bám theo trục nhà. Tắt để vẽ góc tự do (nhà xiên)."
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border cursor-pointer ${
                  orthoLock ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {orthoLock ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
                {orthoLock ? 'Khóa vuông góc' : 'Góc tự do'}
              </button>
              <button
                type="button"
                onClick={undo}
                disabled={historyIndex <= 0}
                title="Hoàn tác (Ctrl+Z)"
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={historyIndex < 0 || historyIndex >= history.length - 1}
                title="Làm lại (Ctrl+Shift+Z)"
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              {graph && Math.abs(graph.axisAngleDeg) >= 0.2 && (
                <button
                  type="button"
                  onClick={() => commit(straightenToAxis(graph))}
                  title="Xoay cả bản vẽ và ảnh lót để trục nhà nằm ngang/dọc"
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5" /> Xoay thẳng ({graph.axisAngleDeg > 0 ? '+' : ''}
                  {graph.axisAngleDeg}°)
                </button>
              )}
              {suspectCount > 0 && graph && (
                <>
                  <button
                    type="button"
                    onClick={() => commit(resolveAllSuspectEdges(graph, 'ORTHO'), null)}
                    title="Mọi cạnh nghi xiên đều do rung tay: ép về vuông góc"
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 cursor-pointer"
                  >
                    Ép vuông {suspectCount} cạnh nghi xiên
                  </button>
                  <button
                    type="button"
                    onClick={() => commit(resolveAllSuspectEdges(graph, 'SLANT'), null)}
                    title="Mọi cạnh nghi xiên đều là nhà xiên thật: giữ nguyên góc"
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 cursor-pointer"
                  >
                    Giữ xiên tất cả
                  </button>
                </>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUnderlay((v) => !v)}
                  disabled={!sketch}
                  title={showUnderlay ? 'Ẩn ảnh gốc lót dưới' : 'Hiện ảnh gốc lót dưới'}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {showUnderlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={underlayOpacity}
                  onChange={(e) => setUnderlayOpacity(Number(e.target.value))}
                  disabled={!showUnderlay || !sketch}
                  title="Độ đậm ảnh gốc lót dưới"
                  className="w-28 accent-teal-600 cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{errorMessage}</span>
                <button type="button" onClick={() => setErrorMessage('')} className="cursor-pointer" title="Ẩn thông báo">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex-1 min-h-0 p-3 force-light">
              <div className="relative w-full h-full rounded-xl border border-slate-300 bg-slate-100 overflow-hidden">
                {graph && sketch ? (
                  <CadSvgEditor
                    graph={graph}
                    underlayUrl={sketch.previewUrl}
                    underlayOpacity={underlayOpacity}
                    showUnderlay={showUnderlay}
                    tool={tool}
                    orthoLock={orthoLock}
                    selection={selection}
                    pendingText={pendingText}
                    onSelect={setSelection}
                    onCommit={commit}
                    onEraseRect={handleEraseRect}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500 text-sm p-6 text-center">
                    <BoxSelect className="w-10 h-10 text-slate-300" />
                    <p className="font-bold text-slate-600">Chưa có bản vẽ</p>
                    <p className="text-xs max-w-md">
                      Chọn ảnh chụp phác thảo mặt bằng. Xoay ảnh cho đúng chiều trước khi chỉnh sửa, vì xoay lại sẽ nhận dạng từ đầu.
                    </p>
                  </div>
                )}
                {busy && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center gap-2 text-sm font-bold text-slate-700">
                    <LoaderCircle className="w-5 h-5 animate-spin text-teal-600" />
                    {isLoading ? 'Đang đọc ảnh...' : 'Đang nhận dạng nét vẽ...'}
                  </div>
                )}
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 bg-white flex flex-wrap items-center gap-x-4 gap-y-2 shrink-0 text-[11px] text-slate-600">
              {graph && stats ? (
                <>
                  <span>Đỉnh <strong className="text-slate-900">{graph.vertices.length}</strong></span>
                  <span>Cạnh <strong className="text-slate-900">{graph.edges.length}</strong></span>
                  <span>Nét dầm <strong className="text-slate-900">{graph.edges.filter((e) => e.kind === 'BEAM_PAIR').length}</strong></span>
                  <span>Cột <strong className="text-slate-900">{graph.columns.length}</strong></span>
                  <span>Cạnh xiên <strong className="text-teal-700">{graph.edges.filter((e) => e.angleClass === 'SLANT').length}</strong></span>
                  <span>Nghi xiên <strong className="text-amber-700">{suspectCount}</strong></span>
                  <span>
                    Ô chữ <strong className="text-slate-900">{countFilledTextBoxes(graph)}</strong>/{graph.textBoxes.length}
                  </span>
                  <span>Nhận dạng <strong className="text-slate-900">{stats.computeTimeMs} ms</strong></span>
                </>
              ) : (
                <span>Chưa có số liệu</span>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                {(['svg', 'png', 'dxf'] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => void handleExport(format)}
                    disabled={!graph || isExporting}
                    title={format === 'dxf' ? 'Mở được bằng AutoCAD / LibreCAD' : `Tải tệp ${format.toUpperCase()}`}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" /> {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
