import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Sparkles,
  Sliders,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Columns,
  SplitSquareHorizontal,
  Eye,
  RefreshCw,
  Image as ImageIcon,
  FlaskConical,
  BarChart3,
  MoveHorizontal,
  ChevronLeft,
  ChevronRight,
  Save,
  Trash2,
  Layers,
  Check,
  MousePointerClick,
} from 'lucide-react';
import { api } from '../../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import { ClientImageLabService } from '../../../../../image-lab/engine/clientImageLabService';
import type {
  ImageLabPreset,
  ImageEnhancementParams,
  ImageLabProcessResult,
} from '../../../../../image-lab/ForensicImageLabModal';
import {
  useAuditStudioImg,
  type StudioCommittedPhotoInfo,
} from '../context/AuditStudioImgContext';

interface AuditStudioImgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommittedSuccess?: (committedItems: StudioCommittedPhotoInfo[]) => void;
}

const DEFAULT_PARAMS: ImageEnhancementParams = {
  enableClahe: true,
  claheTileSize: 160,
  claheMaxSlope: 2,
  gamma: 1.55,
  brightness: 1.06,
  saturation: 0.98,
  crackValleyBoost: 0.0,
  medianSize: 0,
  sharpenSigma: 1.15,
  sharpenFlatM1: 0.0,
  sharpenJaggedM2: 2.6,
  normalizeHistogram: true,
  invertNegative: false,
};

const PRESET_LIST: Array<{
  id: ImageLabPreset;
  label: string;
  desc: string;
  badge: string;
}> = [
  {
    id: 'AUTO_SMART',
    label: 'Tự Động Chẩn Đoán',
    desc: 'Đo độ tối, độ mờ & tương phản để tự cân bằng sáng và làm sắc nét biên cấu trúc.',
    badge: 'Khuyên dùng',
  },
  {
    id: 'CRACK_ENHANCE_V1',
    label: 'Làm Nổi Vết Nứt & Thước Đo v1',
    desc: 'Làm rõ vết nứt & vạch thước đo ở mức dịu nhẹ, tự nhiên, giữ mặt tường phẳng mịn sạch 100%.',
    badge: 'Dịu nhẹ • Mịn sạch',
  },
  {
    id: 'CRACK_ENHANCE_V2',
    label: 'Làm Nổi Vết Nứt & Thước Đo v2',
    desc: 'Tăng cường độ sâu rãnh nứt và tương phản cao hơn cho vết nứt mảnh (đã triệt tiêu lỗi ziczac).',
    badge: 'Tương phản cao',
  },
  {
    id: 'LOW_LIGHT_RESCUE',
    label: 'Cứu Ảnh Thiếu Sáng Sâu',
    desc: 'Nâng sáng góc tối khuất đèn với đường cong chân tối có khống chế nhiễu hạt cảm biến ISO.',
    badge: 'Nâng sáng sạch',
  },
];

function buildHistogramSvgPath(bins: number[], width: number, height: number): string {
  if (!bins || bins.length === 0) return '';
  const maxVal = Math.max(1.5, ...bins);
  const points: string[] = [`M 0 ${height}`];

  for (let i = 0; i < bins.length; i++) {
    const x = Number(((i / (bins.length - 1)) * width).toFixed(1));
    const normalizedH = Math.min(1.0, bins[i] / maxVal);
    const y = Number((height - normalizedH * (height - 4)).toFixed(1));
    points.push(`L ${x} ${y}`);
  }
  points.push(`L ${width} ${height} Z`);
  return points.join(' ');
}

export const AuditStudioImgModal: React.FC<AuditStudioImgModalProps> = ({
  isOpen,
  onClose,
  onCommittedSuccess,
}) => {
  const {
    reportId,
    selectedPhotos,
    removeSelectedPhoto,
    clearSelectedPhotos,
    stagedAdjustments,
    committedPreviewsMap,
    setStagedAdjustment,
    removeStagedAdjustment,
    getStudioEnhancedInfo,
    registerCommittedPhotos,
  } = useAuditStudioImg();

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [activePreset, setActivePreset] = useState<ImageLabPreset>('AUTO_SMART');
  const [brightnessSlider, setBrightnessSlider] = useState<number>(1.0);
  const [sharpnessSlider, setSharpnessSlider] = useState<number>(2.4);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Chế độ đối chứng trực quan (Mặc định SIDE_BY_SIDE: Bản sau kế bên Bản chính)
  const [compareMode, setCompareMode] = useState<'SIDE_BY_SIDE' | 'SPLIT_SLIDER' | 'HOLD_COMPARE'>('SIDE_BY_SIDE');
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);
  const [isHoldingOriginal, setIsHoldingOriginal] = useState<boolean>(false);

  // Kính lúp Zoom & Pan đồng bộ (100% -> 600%)
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingPan, setIsDraggingPan] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Đảm bảo activeIndex luôn nằm trong phạm vi danh sách ảnh đã chọn
  useEffect(() => {
    if (selectedPhotos.length === 0) {
      setActiveIndex(0);
    } else if (activeIndex >= selectedPhotos.length) {
      setActiveIndex(selectedPhotos.length - 1);
    }
  }, [selectedPhotos.length, activeIndex]);

  const activePhoto = selectedPhotos[activeIndex] || null;
  const activeKey = activePhoto ? activePhoto.originalUrl.trim() : '';
  const activeStaged = activeKey
    ? stagedAdjustments[activeKey] || stagedAdjustments[activePhoto.url.trim()]
    : undefined;
  const activeCommittedPreview = activeKey
    ? committedPreviewsMap[activeKey] || committedPreviewsMap[activePhoto.url.trim()]
    : undefined;
  const result = activeStaged?.result || activeCommittedPreview?.result || null;
  const isActivePhotoAlreadyCommitted = Boolean(
    !activeStaged &&
      activePhoto &&
      (activeCommittedPreview ||
        getStudioEnhancedInfo(activePhoto.url) ||
        getStudioEnhancedInfo(activePhoto.originalUrl))
  );

  const stagedList = useMemo(() => Object.values(stagedAdjustments), [stagedAdjustments]);
  const stagedCount = stagedList.length;

  const committedInSelectionCount = useMemo(
    () =>
      selectedPhotos.filter(
        (item) =>
          Boolean(
            committedPreviewsMap[item.originalUrl.trim()] ||
              committedPreviewsMap[item.url.trim()] ||
              getStudioEnhancedInfo(item.url) ||
              getStudioEnhancedInfo(item.originalUrl)
          )
      ).length,
    [selectedPhotos, committedPreviewsMap, getStudioEnhancedInfo]
  );

  const buildCustomParams = useCallback((b: number, s: number): ImageEnhancementParams => {
    const isBrighter = b > 1.0;
    return {
      ...DEFAULT_PARAMS,
      brightness: Number(b.toFixed(2)),
      gamma: isBrighter ? Number((1.2 + (b - 1.0) * 1.1).toFixed(2)) : 1.0,
      sharpenFlatM1: 0.0,
      sharpenJaggedM2: Number(s.toFixed(1)),
    };
  }, []);

  // Thực thi xử lý ảnh trực tiếp tại Frontend (Client-Side Web Worker + RAM Pixel Cache)
  // Chỉ tạo bản xem trước trong RAM trình duyệt với độ trễ ~60-120ms, chưa lưu tạo file mới trên Server cho tới khi nhấn Lưu Studio
  const executeProcessingForPhoto = useCallback(
    async (
      photoItem: { url: string; originalUrl: string; title: string; photoCode?: string },
      presetToRun: ImageLabPreset,
      paramsToRun?: ImageEnhancementParams
    ): Promise<ImageLabProcessResult | null> => {
      const sourceUrl = (photoItem.originalUrl || photoItem.url || '').trim();
      if (!sourceUrl) return null;

      const data = await ClientImageLabService.processImage({
        file: null,
        imageUrl: sourceUrl,
        preset: presetToRun,
        customParams: presetToRun === 'CUSTOM' ? paramsToRun : undefined,
      });

      setStagedAdjustment(sourceUrl, {
        photoUrl: photoItem.url,
        originalUrl: sourceUrl,
        photoCode: photoItem.photoCode,
        title: photoItem.title,
        result: data,
        presetUsed: presetToRun,
        appliedParams: data.appliedParams,
        stagedAt: Date.now(),
      });

      return data;
    },
    [setStagedAdjustment]
  );

  const handleRunActivePhoto = useCallback(
    async (presetToRun: ImageLabPreset, paramsToRun?: ImageEnhancementParams) => {
      if (!activePhoto) return;
      setIsProcessing(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      try {
        const data = await executeProcessingForPhoto(activePhoto, presetToRun, paramsToRun);
        if (data?.appliedParams) {
          setBrightnessSlider(data.appliedParams.brightness || 1.0);
          setSharpnessSlider(data.appliedParams.sharpenJaggedM2 ?? 2.4);
        }
      } catch (err: unknown) {
        console.error('[AuditStudioImgModal] Lỗi xử lý ảnh:', err);
        setErrorMsg(getErrorMessage(err, 'Không thể xử lý ảnh hiện trường.'));
      } finally {
        setIsProcessing(false);
      }
    },
    [activePhoto, executeProcessingForPhoto]
  );

  // Tự động chạy chẩn đoán & tạo bản sau điều chỉnh kế bên bản chính khi chọn ảnh chưa có bản nháp
  useEffect(() => {
    if (!isOpen || !activePhoto) return;
    const existing =
      stagedAdjustments[activePhoto.originalUrl.trim()] ||
      stagedAdjustments[activePhoto.url.trim()] ||
      committedPreviewsMap[activePhoto.originalUrl.trim()] ||
      committedPreviewsMap[activePhoto.url.trim()];
    if (existing) {
      setActivePreset(existing.presetUsed);
      if (existing.appliedParams) {
        setBrightnessSlider(existing.appliedParams.brightness || 1.0);
        setSharpnessSlider(existing.appliedParams.sharpenJaggedM2 ?? 2.4);
      }
      return;
    }
    void handleRunActivePhoto('AUTO_SMART');
  }, [isOpen, activePhoto?.originalUrl]);

  // Lắng nghe sự kiện cuộn chuột Native với { passive: false } để triệt tiêu lỗi "Unable to preventDefault inside passive event listener invocation"
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !isOpen) return;
    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.35 : -0.35;
      setZoom((prev) => {
        const next = Math.min(6.0, Math.max(1.0, Number((prev + delta).toFixed(2))));
        if (next === 1.0) setPan({ x: 0, y: 0 });
        return next;
      });
    };
    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onNativeWheel);
    };
  }, [isOpen]);

  // Hỗ trợ phím Spacebar để nhấn giữ đối chiếu Ảnh Gốc
  useEffect(() => {
    if (!isOpen || !result) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsHoldingOriginal(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsHoldingOriginal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, result]);

  const handleSelectPreset = (presetId: ImageLabPreset) => {
    setActivePreset(presetId);
    void handleRunActivePhoto(presetId);
  };

  const handleApplySliders = (newBrightness: number, newSharpness: number) => {
    setActivePreset('CUSTOM');
    const params = buildCustomParams(newBrightness, newSharpness);
    void handleRunActivePhoto('CUSTOM', params);
  };

  const handleResetSliders = () => {
    setBrightnessSlider(1.0);
    setSharpnessSlider(2.4);
    setActivePreset('AUTO_SMART');
    void handleRunActivePhoto('AUTO_SMART');
  };

  // Áp dụng chế độ hiện tại cho toàn bộ các ảnh đã chọn trong danh sách Studio Img
  const handleBatchApplyAll = async () => {
    if (selectedPhotos.length === 0) return;
    setIsBatchProcessing(true);
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const customParams =
        activePreset === 'CUSTOM' ? buildCustomParams(brightnessSlider, sharpnessSlider) : undefined;
      for (const item of selectedPhotos) {
        await executeProcessingForPhoto(item, activePreset, customParams);
      }
      setSuccessMsg(
        `Đã tạo bản điều chỉnh (${activePreset}) cho toàn bộ ${selectedPhotos.length} ảnh trong danh sách. Hãy bấm "Xác Nhận Lưu Studio" để lưu chính thức.`
      );
    } catch (err: unknown) {
      console.error('[AuditStudioImgModal:handleBatchApplyAll] Lỗi xử lý hàng loạt:', err);
      setErrorMsg(getErrorMessage(err, 'Không thể xử lý hàng loạt ảnh.'));
    } finally {
      setIsBatchProcessing(false);
      setIsProcessing(false);
    }
  };

  // XÁC NHẬN LƯU STUDIO: Chỉ lúc này mới gửi tạo file ảnh mới trên Server (lưu riêng với ảnh gốc KSV)
  const handleConfirmCommitStudio = async () => {
    // Nếu toàn bộ các ảnh đã được lưu vào Studio trước đó và chưa có thay đổi mới, đóng modal để quay về hồ sơ thẩm định
    if (stagedList.length === 0) {
      if (committedInSelectionCount > 0) {
        onClose();
        return;
      }
      setErrorMsg('Chưa có ảnh nào được áp dụng điều chỉnh để lưu.');
      return;
    }

    setIsCommitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payloadItems = stagedList.map((st) => ({
        originalUrl: st.originalUrl,
        currentUrl: st.photoUrl,
        enhancedBase64: st.result.enhancedPreviewBase64,
        photoCode: st.photoCode || 'STUDIO_IMG',
        title: st.title,
        presetUsed: st.presetUsed,
        appliedParams: st.appliedParams,
      }));

      const res = await api.post('/image-lab/commit-studio-session', {
        reportId,
        items: payloadItems,
      });

      const responseData = res.data?.data as
        | {
            reportId: string;
            committedItems: StudioCommittedPhotoInfo[];
            studioEnhancedPhotos: Record<string, StudioCommittedPhotoInfo>;
            studioEnhancedByOriginal: Record<string, string>;
          }
        | undefined;

      if (!responseData || !Array.isArray(responseData.committedItems)) {
        throw new Error('Phản hồi lưu Studio Img không hợp lệ.');
      }

      registerCommittedPhotos(
        responseData.committedItems,
        responseData.studioEnhancedPhotos,
        responseData.studioEnhancedByOriginal
      );

      setSuccessMsg(
        `Đã lưu thành công ${responseData.committedItems.length} ảnh Studio mới (tách biệt với ảnh gốc KSV) vào phiên thẩm định & báo cáo!`
      );

      onCommittedSuccess?.(responseData.committedItems);
    } catch (err: unknown) {
      console.error('[AuditStudioImgModal:handleConfirmCommitStudio] Lỗi lưu Studio Img:', err);
      setErrorMsg(getErrorMessage(err, 'Không thể lưu ảnh Studio lên Server.'));
    } finally {
      setIsCommitting(false);
    }
  };

  const handleStepPhoto = (delta: -1 | 1) => {
    if (selectedPhotos.length === 0) return;
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setActiveIndex((prev) => (prev + delta + selectedPhotos.length) % selectedPhotos.length);
  };

  const handleViewportMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDraggingPan(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleViewportMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingSplit && splitContainerRef.current) {
      const rect = splitContainerRef.current.getBoundingClientRect();
      if (rect.width > 0) {
        const rawPct = ((e.clientX - rect.left) / rect.width) * 100;
        setSplitPercent(Math.max(2, Math.min(98, Number(rawPct.toFixed(1)))));
      }
      return;
    }

    if (isDraggingPan) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    }
  };

  const handleViewportMouseUp = () => {
    setIsDraggingPan(false);
    setIsDraggingSplit(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-white text-slate-900 w-full max-w-[1740px] h-[95vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* 1. Header Bar (Light Mode đồng bộ toàn dự án) */}
        <div className="px-5 py-3 bg-white text-slate-900 flex items-center justify-between border-b border-slate-200 shrink-0 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-800">
                  STUDIO IMG &mdash; HIỆU CHỈNH &amp; ĐỐI CHỨNG ẢNH THẨM ĐỊNH (MODULE IMG LAB)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                  CLIENT WEB WORKER &bull; RAM PIXEL CACHE
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-300">
                  BẢO TOÀN 100% ẢNH GỐC KSV
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Xử lý trực tiếp trên trình duyệt (Web Worker + RAM Cache, độ trễ 0ms mạng) &bull; Chỉ gửi tạo file ảnh mới riêng biệt sau khi bấm &ldquo;Xác Nhận Lưu Studio&rdquo;
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(stagedCount > 0 || committedInSelectionCount > 0) && (
              <button
                type="button"
                onClick={handleConfirmCommitStudio}
                disabled={isCommitting || isProcessing}
                className={`px-4 py-2 rounded-xl text-white font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-95 ${
                  stagedCount > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isCommitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : stagedCount > 0 ? (
                  <Save className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {isCommitting
                    ? 'Đang tạo ảnh mới & lưu Studio...'
                    : stagedCount > 0
                      ? `Xác Nhận Lưu Studio (${stagedCount} ảnh)`
                      : `Đã Lưu Studio (${committedInSelectionCount} ảnh) • Đóng`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-600 text-slate-600 hover:text-white transition-all cursor-pointer"
              title="Đóng cửa sổ Studio Img"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Main Split Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* CỘT TRÁI: Danh sách ảnh đã chọn (S+Click) + Chế độ Preset + Thanh trượt tinh chỉnh (Width: 420px) */}
          <div className="w-full lg:w-[420px] border-r border-slate-200 bg-slate-50 flex flex-col overflow-y-auto shrink-0 p-3.5 space-y-3.5">
            {/* Khối 1: Danh sách ảnh đã Select (S + Click) */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  1. Danh Sách Ảnh Đã Chọn ({selectedPhotos.length})
                </span>
                {selectedPhotos.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStepPhoto(-1)}
                      disabled={isProcessing || selectedPhotos.length <= 1}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3 h-3" />
                      <span>Trước</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepPhoto(1)}
                      disabled={isProcessing || selectedPhotos.length <= 1}
                      className="px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-0.5 cursor-pointer disabled:opacity-40"
                    >
                      <span>Tiếp</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={clearSelectedPhotos}
                      disabled={isProcessing || isCommitting}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Xóa toàn bộ danh sách đang chọn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {selectedPhotos.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-2">
                  <MousePointerClick className="w-6 h-6 text-indigo-500 mx-auto" />
                  <div className="text-xs font-bold text-slate-700">
                    Chưa có ảnh nào trong danh sách Studio Img
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Hãy đóng cửa sổ này, sau đó nhấn giữ phím{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono font-bold border border-indigo-300">
                      S
                    </kbd>{' '}
                    và <strong>Click chuột</strong> vào các bức ảnh cần chỉnh sửa trong hồ sơ thẩm định.
                  </p>
                </div>
              ) : (
                <>
                  {/* Lưới danh sách ảnh đã chọn */}
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {selectedPhotos.map((item, idx) => {
                      const isCurrent = idx === activeIndex;
                      const itemStaged =
                        stagedAdjustments[item.originalUrl.trim()] ||
                        stagedAdjustments[item.url.trim()];
                      const itemCommittedPreview =
                        committedPreviewsMap[item.originalUrl.trim()] ||
                        committedPreviewsMap[item.url.trim()];
                      const committedInfo =
                        getStudioEnhancedInfo(item.url) || getStudioEnhancedInfo(item.originalUrl);

                      return (
                        <div
                          key={`${item.originalUrl}_${idx}`}
                          onClick={() => {
                            setZoom(1.0);
                            setPan({ x: 0, y: 0 });
                            setActiveIndex(idx);
                          }}
                          className={`group flex items-center justify-between gap-2.5 p-2 rounded-xl border transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20'
                              : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-900 border border-slate-300 shrink-0">
                              <img
                                src={
                                  itemStaged?.result.enhancedPreviewBase64 ||
                                  itemCommittedPreview?.result.enhancedPreviewBase64 ||
                                  item.url
                                }
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute top-0.5 left-0.5 px-1 rounded bg-slate-950/80 text-white text-[8px] font-mono font-bold">
                                #{idx + 1}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.photoCode && (
                                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-white font-mono font-bold text-[9px]">
                                    {item.photoCode}
                                  </span>
                                )}
                                {itemStaged ? (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[9px] flex items-center gap-0.5">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    <span>Chờ lưu ({itemStaged.presetUsed})</span>
                                  </span>
                                ) : committedInfo ? (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[9px] flex items-center gap-0.5">
                                    <Check className="w-2.5 h-2.5" />
                                    <span>Đã lưu Studio</span>
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold text-[9px]">
                                    Chưa chỉnh
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-bold text-slate-800 truncate mt-0.5" title={item.title}>
                                {item.title}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {itemStaged && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeStagedAdjustment(item.originalUrl);
                                  removeStagedAdjustment(item.url);
                                }}
                                className="p-1 rounded-lg text-amber-700 hover:bg-amber-100 text-[10px] font-bold cursor-pointer"
                                title="Hủy bản điều chỉnh tạm của ảnh này"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSelectedPhoto(item.originalUrl);
                                removeSelectedPhoto(item.url);
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Bỏ ảnh này khỏi danh sách Studio Img"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Nút áp dụng hàng loạt cho toàn bộ ảnh đã chọn */}
                  {selectedPhotos.length > 1 && (
                    <button
                      type="button"
                      onClick={handleBatchApplyAll}
                      disabled={isProcessing || isBatchProcessing || isCommitting}
                      className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isBatchProcessing ? 'animate-spin' : ''}`} />
                      <span>
                        {isBatchProcessing
                          ? 'Đang xử lý hàng loạt...'
                          : `Áp Dụng Chế Độ Đang Chọn Cho Cả ${selectedPhotos.length} Ảnh`}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Khối 2: Chọn Chế độ Xử lý (Presets v2.0 từ module Img Lab) */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  2. Chế Độ Thuật Toán (Img Lab v2.0)
                </span>
                {activePreset === 'CUSTOM' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-700 border border-sky-300">
                    Tham số Tùy chỉnh
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {PRESET_LIST.map((preset) => {
                  const isSelected = activePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={!activePhoto || isProcessing}
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer disabled:opacity-50 ${
                        isSelected
                          ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">{preset.label}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {preset.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{preset.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Khối 3: Tinh chỉnh thủ công Sáng & Nét */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-sky-600" />
                  3. Tinh Chỉnh Sáng &amp; Nét
                </span>
                <button
                  type="button"
                  disabled={!activePhoto || isProcessing}
                  onClick={handleResetSliders}
                  className="text-[11px] font-bold text-slate-500 hover:text-emerald-700 hover:bg-slate-100 px-2 py-0.5 rounded cursor-pointer disabled:opacity-40"
                >
                  Đặt lại
                </button>
              </div>

              {/* 1. Độ sáng */}
              <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Độ sáng:</span>
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {brightnessSlider >= 1.0
                      ? `+${Math.round((brightnessSlider - 1.0) * 100)}% (Tăng sáng)`
                      : `-${Math.round((1.0 - brightnessSlider) * 100)}% (Giảm sáng)`}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(0.5, Number((brightnessSlider - 0.1).toFixed(2)));
                      setBrightnessSlider(next);
                      handleApplySliders(next, sharpnessSlider);
                    }}
                    disabled={!activePhoto || isProcessing}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold shrink-0 cursor-pointer disabled:opacity-40"
                  >
                    - Giảm sáng
                  </button>

                  <input
                    type="range"
                    min={0.5}
                    max={1.8}
                    step={0.05}
                    disabled={!activePhoto || isProcessing}
                    value={brightnessSlider}
                    onChange={(e) => setBrightnessSlider(Number(e.target.value))}
                    onMouseUp={() => handleApplySliders(brightnessSlider, sharpnessSlider)}
                    onTouchEnd={() => handleApplySliders(brightnessSlider, sharpnessSlider)}
                    className="flex-1 accent-amber-500 cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(1.8, Number((brightnessSlider + 0.1).toFixed(2)));
                      setBrightnessSlider(next);
                      handleApplySliders(next, sharpnessSlider);
                    }}
                    disabled={!activePhoto || isProcessing}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold shrink-0 cursor-pointer disabled:opacity-40"
                  >
                    + Tăng sáng
                  </button>
                </div>
              </div>

              {/* 2. Độ sắc nét */}
              <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Độ sắc nét:</span>
                  <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    {sharpnessSlider.toFixed(1)}x {sharpnessSlider === 0 ? '(Tắt)' : '(Tăng nét)'}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(0.0, Number((sharpnessSlider - 0.4).toFixed(1)));
                      setSharpnessSlider(next);
                      handleApplySliders(brightnessSlider, next);
                    }}
                    disabled={!activePhoto || isProcessing}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold shrink-0 cursor-pointer disabled:opacity-40"
                  >
                    - Giảm nét
                  </button>

                  <input
                    type="range"
                    min={0.0}
                    max={6.0}
                    step={0.2}
                    disabled={!activePhoto || isProcessing}
                    value={sharpnessSlider}
                    onChange={(e) => setSharpnessSlider(Number(e.target.value))}
                    onMouseUp={() => handleApplySliders(brightnessSlider, sharpnessSlider)}
                    onTouchEnd={() => handleApplySliders(brightnessSlider, sharpnessSlider)}
                    className="flex-1 accent-sky-600 cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(6.0, Number((sharpnessSlider + 0.4).toFixed(1)));
                      setSharpnessSlider(next);
                      handleApplySliders(brightnessSlider, next);
                    }}
                    disabled={!activePhoto || isProcessing}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold shrink-0 cursor-pointer disabled:opacity-40"
                  >
                    + Tăng nét
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleApplySliders(brightnessSlider, sharpnessSlider)}
                disabled={!activePhoto || isProcessing}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>Áp Dụng Điều Chỉnh Sáng &amp; Nét</span>
              </button>
            </div>
          </div>

          {/* CỘT PHẢI: Chẩn đoán Chất lượng, Biểu đồ Histogram & Khung Đối Chứng Bản Sau Kế Bên Bản Chính */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-100/90 text-slate-800 overflow-hidden">
            {/* Thanh công cụ chế độ xem & Kính lúp Zoom */}
            <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-2xs">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCompareMode('SIDE_BY_SIDE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    compareMode === 'SIDE_BY_SIDE'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Bản Sau Kế Bên Bản Chính (Đồng Bộ Zoom)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCompareMode('SPLIT_SLIDER')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    compareMode === 'SPLIT_SLIDER'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <SplitSquareHorizontal className="w-3.5 h-3.5" />
                  <span>Thanh Kéo Gạt Trực Tiếp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCompareMode('HOLD_COMPARE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    compareMode === 'HOLD_COMPARE'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Lật Nhanh Trước / Sau (Space)</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {selectedPhotos.length > 0 && (
                  <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleStepPhoto(-1)}
                      disabled={isProcessing || selectedPhotos.length <= 1}
                      className="px-2 py-1 rounded-lg hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Ảnh trước</span>
                    </button>
                    <span className="px-2 text-[11px] font-mono font-bold text-indigo-700">
                      #{activeIndex + 1}/{selectedPhotos.length}{' '}
                      {activePhoto?.photoCode ? `(${activePhoto.photoCode})` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStepPhoto(1)}
                      disabled={isProcessing || selectedPhotos.length <= 1}
                      className="px-2 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <span>Ảnh tiếp</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {result && (
                  <button
                    type="button"
                    onMouseDown={() => setIsHoldingOriginal(true)}
                    onMouseUp={() => setIsHoldingOriginal(false)}
                    onMouseLeave={() => setIsHoldingOriginal(false)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                      isHoldingOriginal
                        ? 'bg-amber-500 text-white border-amber-600 shadow-md'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isHoldingOriginal ? 'Đang hiện: BẢN CHÍNH' : 'Giữ nút / Space: Soi Bản Chính'}</span>
                  </button>
                )}

                <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() =>
                      setZoom((z) => {
                        const next = Math.max(1.0, Number((z - 0.5).toFixed(1)));
                        if (next === 1.0) setPan({ x: 0, y: 0 });
                        return next;
                      })
                    }
                    className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
                    title="Thu nhỏ"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="px-2 text-xs font-mono font-bold text-slate-800">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(6.0, Number((z + 0.5).toFixed(1))))}
                    className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
                    title="Phóng to soi thước đo (Tối đa 600%)"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1.0);
                      setPan({ x: 0, y: 0 });
                    }}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 cursor-pointer"
                    title="Đặt lại góc nhìn 100%"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bảng Chẩn đoán Chất lượng & Biểu đồ Lược đồ Xám 64-Bin */}
            {result && (
              <div className="px-4 py-2.5 bg-white border-b border-slate-200 space-y-2 shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Chẩn Đoán Bản Chính</span>
                    <div className="flex items-center justify-between gap-1 mt-1">
                      {result.beforeMetrics.overallVerdict === 'PASS' ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đạt chuẩn
                        </span>
                      ) : result.beforeMetrics.overallVerdict === 'CRITICAL' ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300 flex items-center gap-1">
                          <AlertOctagon className="w-3.5 h-3.5 text-rose-600" /> Mờ / Tối Nặng
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Cần Tăng Cường
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-emerald-700 font-bold">
                        {result.processingTimeMs}ms
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Độ Nét Cấu Trúc</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5 font-mono">
                      <span className="text-xs text-slate-500">{result.beforeMetrics.laplacianVariance}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-sm font-black text-emerald-700">
                        {result.afterMetrics.laplacianVariance}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {result.improvementSummary.sharpnessGainPercent >= 0
                          ? `+${result.improvementSummary.sharpnessGainPercent}%`
                          : `${result.improvementSummary.sharpnessGainPercent}%`}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Biên Vết Nứt (Top-5%)</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5 font-mono">
                      <span className="text-xs text-slate-500">{result.beforeMetrics.edgeGradientScore}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-sm font-black text-sky-700">
                        {result.afterMetrics.edgeGradientScore}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 border border-sky-300">
                        {result.improvementSummary.edgeGainPercent >= 0
                          ? `+${result.improvementSummary.edgeGainPercent}%`
                          : `${result.improvementSummary.edgeGainPercent}%`}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Tỉ Số CNR &amp; Nhiễu</span>
                    <div className="flex items-baseline justify-between mt-0.5 font-mono">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs text-slate-500">{result.beforeMetrics.cnrScore}</span>
                        <span className="text-slate-400">→</span>
                        <span className="text-sm font-black text-indigo-700">{result.afterMetrics.cnrScore}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">σ_n: {result.afterMetrics.noiseSigma}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Độ Sáng L (0–255)</span>
                    <div className="flex items-baseline justify-between mt-0.5 font-mono">
                      <div>
                        <span className="text-xs text-slate-500">{result.beforeMetrics.meanLuminance}</span>
                        <span className="text-slate-400 mx-1">→</span>
                        <span className="text-sm font-black text-amber-700">{result.afterMetrics.meanLuminance}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Tối: {result.afterMetrics.darkPixelRatio}%</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-slate-600 uppercase flex items-center gap-1">
                        <BarChart3 className="w-3 h-3 text-emerald-600" />
                        Phổ Độ Chói
                      </span>
                      <div className="flex items-center gap-1.5 text-[9px]">
                        <span className="text-slate-400">■ Gốc</span>
                        <span className="text-emerald-600 font-bold">■ Studio</span>
                      </div>
                    </div>
                    <div className="h-8 w-full mt-1 relative bg-white/70 rounded border border-slate-200/60 overflow-hidden">
                      <svg viewBox="0 0 180 32" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                        <path
                          d={buildHistogramSvgPath(result.beforeMetrics.histogram || [], 180, 32)}
                          className="fill-slate-300 stroke-slate-400"
                          strokeWidth="1"
                        />
                        <path
                          d={buildHistogramSvgPath(result.afterMetrics.histogram || [], 180, 32)}
                          className="fill-emerald-500/25 stroke-emerald-600"
                          strokeWidth="1.2"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Thông báo lỗi hoặc thành công */}
            {errorMsg && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center gap-2 shrink-0">
                <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between gap-2 flex-wrap shrink-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black shadow-2xs cursor-pointer"
                  >
                    Hoàn tất &amp; Xem trên hồ sơ →
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuccessMsg(null)}
                    className="text-emerald-700 hover:text-emerald-950 text-[11px] underline cursor-pointer"
                  >
                    Ẩn
                  </button>
                </div>
              </div>
            )}

            {/* Khung Hiển Thị Đối Chứng Ảnh Chính (Bản sau kế bên Bản chính) */}
            <div
              ref={viewportRef}
              onMouseDown={handleViewportMouseDown}
              onMouseMove={handleViewportMouseMove}
              onMouseUp={handleViewportMouseUp}
              onMouseLeave={handleViewportMouseUp}
              className="flex-1 relative overflow-hidden flex items-center justify-center select-none cursor-grab active:cursor-grabbing bg-slate-200/50"
            >
              {(isProcessing || isCommitting) && (
                <div className="absolute inset-0 z-40 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-9 h-9 text-emerald-600 animate-spin" />
                  <span className="text-sm font-bold text-slate-800">
                    {isCommitting
                      ? 'Đang gửi tạo file ảnh Studio mới riêng biệt & lưu vào phiên thẩm định...'
                      : 'Đang xử lý ảnh trực tiếp trên Client Web Worker (Luminance 4:4:4 • RAM Pixel Cache)...'}
                  </span>
                </div>
              )}

              {!activePhoto ? (
                <div className="max-w-md text-center p-8 space-y-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center mx-auto text-indigo-500">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">
                    Chưa có ảnh nào được chọn vào Studio Img
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Tại màn hình thẩm định, hãy nhấn giữ phím{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono font-bold text-slate-800">
                      S
                    </kbd>{' '}
                    và <strong>Click chuột</strong> vào các bức ảnh khảo sát chụp chưa chuẩn để đưa vào danh sách chỉnh sửa.
                  </p>
                </div>
              ) : !result ? (
                <div className="max-w-md text-center p-8 space-y-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                  <div className="text-sm font-bold text-slate-800">
                    Đang khởi tạo bản điều chỉnh cho {activePhoto.title}...
                  </div>
                </div>
              ) : compareMode === 'SIDE_BY_SIDE' ? (
                /* CHẾ ĐỘ 1: BẢN SAU ÁP DỤNG ĐIỀU CHỈNH KẾ BÊN BẢN CHÍNH */
                <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
                  {/* Khung Trái: Bản Chính (Ảnh Gốc KSV) */}
                  <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-slate-100 flex items-center justify-center shadow-xs">
                    <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-white/95 border border-slate-300 text-xs font-bold text-slate-700 shadow-sm">
                      1. BẢN CHÍNH &mdash; ẢNH GỐC KSV (BẢO TOÀN 100%)
                    </div>
                    <img
                      src={result.originalPreviewBase64}
                      alt="Bản chính (Ảnh gốc)"
                      draggable={false}
                      className="max-w-full max-h-full object-contain pointer-events-none transition-transform duration-75"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                      }}
                    />
                  </div>

                  {/* Khung Phải: Bản Sau Áp Dụng Điều Chỉnh Kế Bên Bản Chính */}
                  <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 bg-slate-100 flex items-center justify-center shadow-xs">
                    <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-sm flex items-center gap-1.5">
                      {isActivePhotoAlreadyCommitted ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isHoldingOriginal
                          ? 'ĐANG ĐỐI CHIẾU: BẢN CHÍNH (NHẢ PHÍM SPACE ĐỂ QUAY LẠI)'
                          : isActivePhotoAlreadyCommitted
                            ? `2. BẢN STUDIO ĐÃ LƯU (${result.presetUsed} • ĐÃ LƯU VÀO PHIÊN THẨM ĐỊNH)`
                            : `2. BẢN SAU ĐIỀU CHỈNH (${result.presetUsed} • CHỜ LƯU STUDIO)`}
                      </span>
                    </div>
                    <img
                      src={isHoldingOriginal ? result.originalPreviewBase64 : result.enhancedPreviewBase64}
                      alt="Bản sau áp dụng điều chỉnh"
                      draggable={false}
                      className="max-w-full max-h-full object-contain pointer-events-none transition-transform duration-75"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                      }}
                    />
                  </div>
                </div>
              ) : compareMode === 'SPLIT_SLIDER' ? (
                /* CHẾ ĐỘ 2: THANH KÉO GẠT TRỰC TIẾP TRÊN ẢNH */
                <div className="relative w-full h-full flex items-center justify-center p-4 overflow-hidden">
                  <div
                    ref={splitContainerRef}
                    className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-xs"
                  >
                    <img
                      src={result.enhancedPreviewBase64}
                      alt="Bản sau điều chỉnh"
                      draggable={false}
                      className="max-w-full max-h-full object-contain pointer-events-none"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                      }}
                    />

                    <div
                      className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none"
                      style={{
                        clipPath: `inset(0 ${100 - splitPercent}% 0 0)`,
                      }}
                    >
                      <img
                        src={result.originalPreviewBase64}
                        alt="Bản chính"
                        draggable={false}
                        className="max-w-full max-h-full object-contain pointer-events-none"
                        style={{
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                          transformOrigin: 'center center',
                        }}
                      />
                    </div>

                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setIsDraggingSplit(true);
                      }}
                      className="absolute top-0 bottom-0 w-9 -translate-x-1/2 z-30 cursor-ew-resize flex items-center justify-center group"
                      style={{ left: `${splitPercent}%` }}
                    >
                      <div className="w-1 h-full bg-emerald-600 group-hover:w-1.5 transition-all shadow-md" />
                      <div className="absolute top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-white transition-transform group-hover:scale-110">
                        <MoveHorizontal className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-white/95 border border-slate-300 text-xs font-bold text-slate-700 shadow-sm pointer-events-none">
                      BẢN CHÍNH (ẢNH GỐC KSV)
                    </div>
                    <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-sm pointer-events-none">
                      BẢN SAU ĐIỀU CHỈNH ({result.presetUsed})
                    </div>
                  </div>
                </div>
              ) : (
                /* CHẾ ĐỘ 3: LẬT NHANH TRƯỚC / SAU */
                <div className="relative w-full h-full flex items-center justify-center p-4 overflow-hidden">
                  <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-300 bg-slate-100 flex items-center justify-center shadow-xs">
                    <div
                      className={`absolute top-3 left-3 z-20 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${
                        isHoldingOriginal
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {isHoldingOriginal
                        ? 'ĐANG HIỂN THỊ: BẢN CHÍNH (ẢNH GỐC KSV)'
                        : `ĐANG HIỂN THỊ: BẢN SAU ĐIỀU CHỈNH (${result.presetUsed})`}
                    </div>
                    <img
                      src={isHoldingOriginal ? result.originalPreviewBase64 : result.enhancedPreviewBase64}
                      alt="Đối chứng ảnh"
                      draggable={false}
                      className="max-w-full max-h-full object-contain pointer-events-none"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Xác nhận lưu Studio */}
            <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap shrink-0">
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>
                  Đã chọn <strong>{selectedPhotos.length} ảnh</strong> &bull; Đã áp dụng điều chỉnh chờ lưu:{' '}
                  <strong className="text-emerald-700">{stagedCount} ảnh</strong>
                  {committedInSelectionCount > 0 && (
                    <>
                      {' '}
                      &bull; Đã lưu Studio:{' '}
                      <strong className="text-indigo-700">{committedInSelectionCount} ảnh</strong>
                    </>
                  )}
                  . Chỉ tạo mới file ảnh độc lập trên Server sau khi bấm{' '}
                  <strong>&ldquo;Xác Nhận Lưu Studio&rdquo;</strong>.
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Đóng / Chọn thêm ảnh (Giữ S + Click)
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCommitStudio}
                  disabled={(stagedCount === 0 && committedInSelectionCount === 0) || isCommitting || isProcessing}
                  className={`px-5 py-2 rounded-xl text-white font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-95 ${
                    stagedCount > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isCommitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : stagedCount > 0 ? (
                    <Save className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {isCommitting
                      ? 'Đang tạo mới & lưu vào phiên thẩm định...'
                      : stagedCount > 0
                        ? `Xác Nhận Lưu Studio (${stagedCount} ảnh)`
                        : `Đã Lưu Studio (${committedInSelectionCount} ảnh) • Hoàn Tất & Quay Lại Hồ Sơ`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

