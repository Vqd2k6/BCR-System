import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Upload,
  Sparkles,
  Sliders,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Columns,
  SplitSquareHorizontal,
  Eye,
  RefreshCw,
  Image as ImageIcon,
  Zap,
  FlaskConical,
  Link2,
} from 'lucide-react';
import { api } from '../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';

export type ImageLabPreset =
  | 'AUTO_SMART'
  | 'CRACK_ENHANCE'
  | 'LOW_LIGHT_RESCUE'
  | 'DEBLOCK_COMPRESSION'
  | 'XRAY_NEGATIVE'
  | 'CUSTOM';

export interface ImageEnhancementParams {
  enableClahe: boolean;
  claheTileSize: number;
  claheMaxSlope: number;
  gamma: number;
  brightness: number;
  saturation: number;
  medianSize: number;
  sharpenSigma: number;
  sharpenFlatM1: number;
  sharpenJaggedM2: number;
  normalizeHistogram: boolean;
  invertNegative: boolean;
}

export interface ImageQualityMetrics {
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  meanLuminance: number;
  rmsContrast: number;
  darkPixelRatio: number;
  brightPixelRatio: number;
  laplacianVariance: number;
  edgeGradientScore: number;
  blurStatus: 'SHARP' | 'MILD_BLUR' | 'CRITICAL_BLUR';
  exposureStatus: 'GOOD' | 'UNDEREXPOSED' | 'OVEREXPOSED' | 'LOW_CONTRAST';
  overallVerdict: 'PASS' | 'WARNING' | 'CRITICAL';
  warnings: string[];
}

export interface ImageLabProcessResult {
  originalPreviewBase64: string;
  enhancedPreviewBase64: string;
  beforeMetrics: ImageQualityMetrics;
  afterMetrics: ImageQualityMetrics;
  presetUsed: ImageLabPreset;
  appliedParams: ImageEnhancementParams;
  processingTimeMs: number;
  improvementSummary: {
    sharpnessGainPercent: number;
    edgeGainPercent: number;
    contrastGainPercent: number;
    brightnessDelta: number;
  };
}

interface SampleSurveyPhoto {
  photo_url: string;
  photo_code: string;
  category: string;
  parcel_code: string;
  created_at: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_PARAMS: ImageEnhancementParams = {
  enableClahe: true,
  claheTileSize: 48,
  claheMaxSlope: 3,
  gamma: 1.6,
  brightness: 1.08,
  saturation: 0.9,
  medianSize: 0,
  sharpenSigma: 1.2,
  sharpenFlatM1: 0.5,
  sharpenJaggedM2: 3.0,
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
    label: 'Tự Động Chẩn Đoán (Auto Forensic)',
    desc: 'Tự đo độ tối & độ mờ để nội suy thông số CLAHE + Gamma + Làm nét tối ưu nhất.',
    badge: 'Khuyên dùng',
  },
  {
    id: 'CRACK_ENHANCE',
    label: 'Làm Nổi Vết Nứt & Thước Đo (Crack Boost)',
    desc: 'Tăng cực đại tương phản cục bộ 32x32 tại rãnh nứt 0.1mm và làm sắc nét vạch thước đo.',
    badge: 'Soi nứt',
  },
  {
    id: 'LOW_LIGHT_RESCUE',
    label: 'Cứu Ảnh Thiếu Sáng Sâu (Low-Light HDR)',
    desc: 'Kéo sáng góc tối, tầng hầm, gầm cầu thang bằng hàm Gamma phi tuyến + Khử nhiễu hạt ISO.',
    badge: 'Bù sáng',
  },
  {
    id: 'DEBLOCK_COMPRESSION',
    label: 'Khử Mờ Nén Ảnh (Deblock & Sharpen)',
    desc: 'Xóa hiện tượng vỡ ô vuông 8x8 do nén mạnh/Zalo, tái tạo biên chữ số sắc nét (4:4:4).',
    badge: 'Khử nén',
  },
  {
    id: 'XRAY_NEGATIVE',
    label: 'Bản Âm X-Ray (Soi Nứt Chân Chim)',
    desc: 'Đảo phổ âm bản kết hợp tương phản cao giúp vết nứt mảnh phát sáng trắng trên nền tối.',
    badge: 'X-Ray',
  },
];

/**
 * Tạo một bức ảnh mẫu mô phỏng "Tường thiếu sáng + Vết nứt 0.2mm + Thước đo nứt"
 * để Admin/Thẩm định viên có thể bấm test thuật toán ngay lập tức mà chưa cần tìm ảnh ngoài
 */
async function generateSyntheticDarkCrackImage(): Promise<File> {
  const canvas = document.createElement('canvas');
  const w = 1200;
  const h = 900;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Không thể khởi tạo Canvas tạo ảnh mẫu.');

  // 1. Nền tường thiếu sáng (màu xám tối 32-48/255 kèm chuyển sắc góc khuất tối)
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 80, w * 0.5, h * 0.5, w * 0.75);
  grad.addColorStop(0, 'rgb(52, 54, 58)');
  grad.addColorStop(0.6, 'rgb(36, 38, 42)');
  grad.addColorStop(1, 'rgb(20, 22, 25)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 2. Thêm nhiễu hạt cảm biến (ISO Noise trong điều kiện thiếu sáng)
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 14;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // 3. Vẽ vết nứt chính và các nhánh nứt chân chim mảnh (độ tương phản thấp trong bóng tối)
  ctx.save();
  ctx.strokeStyle = 'rgba(12, 13, 15, 0.78)';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.filter = 'blur(0.7px)'; // Mô phỏng hơi mất nét nhẹ

  ctx.beginPath();
  let cx = w * 0.25;
  let cy = h * 0.12;
  ctx.moveTo(cx, cy);
  const segments = [
    [45, 75], [30, 85], [-15, 65], [38, 90], [12, 70],
    [-22, 60], [28, 95], [40, 80], [15, 90], [35, 85],
  ];
  for (const [dx, dy] of segments) {
    cx += dx;
    cy += dy;
    ctx.lineTo(cx, cy);
  }
  ctx.stroke();

  // Vết nứt chân chim phụ (rất mảnh 0.15mm, khó nhìn bằng mắt thường khi ảnh tối)
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(18, 19, 22, 0.55)';
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.42);
  ctx.lineTo(w * 0.48, h * 0.46);
  ctx.lineTo(w * 0.58, h * 0.43);
  ctx.lineTo(w * 0.67, h * 0.49);
  ctx.stroke();
  ctx.restore();

  // 4. Vẽ Thước đo bề rộng vết nứt (Crack Width Ruler Card) đặt cạnh vết nứt nhưng bị tối
  const rx = w * 0.46;
  const ry = h * 0.52;
  const rw = 360;
  const rh = 190;

  ctx.save();
  ctx.fillStyle = 'rgb(78, 82, 88)';
  ctx.strokeStyle = 'rgb(45, 48, 52)';
  ctx.lineWidth = 2;
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeRect(rx, ry, rw, rh);

  ctx.fillStyle = 'rgb(22, 24, 28)';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('CRACK WIDTH GAUGE (mm) - METRO 2 BCS', rx + 16, ry + 28);

  // Vạch chia milimet từ 0.1mm đến 1.5mm
  const widths = [0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 1.5];
  widths.forEach((mm, idx) => {
    const tx = rx + 24 + idx * 46;
    ctx.fillStyle = 'rgb(20, 22, 25)';
    ctx.fillRect(tx, ry + 48, Math.max(0.8, mm * 2.2), 55);
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`${mm}`, tx - 6, ry + 122);
  });

  ctx.font = '12px sans-serif';
  ctx.fillText('MẪU TEST: ẢNH CHỤP TRONG NHÀ THIẾU SÁNG & HƠI MỜ', rx + 16, ry + 162);
  ctx.restore();

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Lỗi xuất ảnh mẫu'))), 'image/jpeg', 0.85);
  });

  return new File([blob], 'mau_test_vet_nut_thieu_sang.jpg', { type: 'image/jpeg' });
}

export const ForensicImageLabModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [activePreset, setActivePreset] = useState<ImageLabPreset>('AUTO_SMART');
  const [customParams, setCustomParams] = useState<ImageEnhancementParams>(DEFAULT_PARAMS);
  const [showAdvancedSliders, setShowAdvancedSliders] = useState<boolean>(false);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ImageLabProcessResult | null>(null);

  // Chế độ đối chứng trực quan
  const [compareMode, setCompareMode] = useState<'SIDE_BY_SIDE' | 'SPLIT_SLIDER' | 'HOLD_COMPARE'>('SIDE_BY_SIDE');
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isHoldingOriginal, setIsHoldingOriginal] = useState<boolean>(false);

  // Kính lúp Zoom & Pan đồng bộ (100% -> 600%)
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Danh sách ảnh khảo sát gần đây để chọn nhanh
  const [recentPhotos, setRecentPhotos] = useState<SampleSurveyPhoto[]>([]);
  const [loadingSamples, setLoadingSamples] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tải danh sách ảnh mẫu từ các hồ sơ khảo sát khi mở Modal
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoadingSamples(true);
    api
      .get('/image-lab/recent-survey-photos')
      .then((res) => {
        if (!isMounted) return;
        if (Array.isArray(res.data?.data)) {
          setRecentPhotos(res.data.data);
        }
      })
      .catch((err: unknown) => {
        console.warn('[ForensicImageLabModal] Không tải được danh sách ảnh mẫu:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingSamples(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Thực thi xử lý ảnh trên Backend
  const executeProcessing = useCallback(
    async (
      targetFile: File | null,
      targetUrl: string,
      presetToRun: ImageLabPreset,
      paramsToRun?: ImageEnhancementParams
    ) => {
      if (!targetFile && !targetUrl.trim()) {
        setErrorMsg('Vui lòng chọn một file ảnh từ máy tính, chọn ảnh mẫu hoặc dán đường dẫn URL ảnh.');
        return;
      }

      setIsProcessing(true);
      setErrorMsg(null);

      try {
        const formData = new FormData();
        if (targetFile) {
          formData.append('file', targetFile);
        } else if (targetUrl.trim()) {
          formData.append('imageUrl', targetUrl.trim());
        }
        formData.append('preset', presetToRun);
        if (presetToRun === 'CUSTOM' && paramsToRun) {
          formData.append('customParams', JSON.stringify(paramsToRun));
        }

        const res = await api.post('/image-lab/process', formData);
        const data = res.data?.data as ImageLabProcessResult | undefined;
        if (!data || !data.enhancedPreviewBase64) {
          throw new Error('Server không trả về dữ liệu ảnh sau xử lý.');
        }

        setResult(data);
        if (presetToRun !== 'CUSTOM' && data.appliedParams) {
          setCustomParams(data.appliedParams);
        }
      } catch (err: unknown) {
        console.error('[ForensicImageLabModal:executeProcessing] Lỗi xử lý ảnh:', err);
        setErrorMsg(getErrorMessage(err, 'Không thể xử lý ảnh. Vui lòng kiểm tra kết nối Backend.'));
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setImageUrlInput('');
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    void executeProcessing(file, '', activePreset, customParams);
    e.target.value = '';
  };

  const handleGenerateSyntheticSample = async () => {
    try {
      setIsProcessing(true);
      const sampleFile = await generateSyntheticDarkCrackImage();
      setSelectedFile(sampleFile);
      setImageUrlInput('');
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
      await executeProcessing(sampleFile, '', activePreset, customParams);
    } catch (err: unknown) {
      console.error('[ForensicImageLabModal:handleGenerateSyntheticSample] Lỗi tạo ảnh mẫu:', err);
      setErrorMsg(getErrorMessage(err));
      setIsProcessing(false);
    }
  };

  const handleSelectSampleUrl = (url: string) => {
    setSelectedFile(null);
    setImageUrlInput(url);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    void executeProcessing(null, url, activePreset, customParams);
  };

  const handleSelectPreset = (presetId: ImageLabPreset) => {
    setActivePreset(presetId);
    if (selectedFile || imageUrlInput.trim()) {
      void executeProcessing(selectedFile, imageUrlInput, presetId, customParams);
    }
  };

  const handleApplyCustomSliders = () => {
    setActivePreset('CUSTOM');
    void executeProcessing(selectedFile, imageUrlInput, 'CUSTOM', customParams);
  };

  const handleDownloadEnhanced = () => {
    if (!result?.enhancedPreviewBase64) return;
    const a = document.createElement('a');
    a.href = result.enhancedPreviewBase64;
    a.download = `metro2_enhanced_${activePreset.toLowerCase()}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Điều khiển Kính lúp đồng bộ (Synced Zoom & Pan)
  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.35 : -0.35;
    setZoom((prev) => {
      const next = Math.min(6.0, Math.max(1.0, Number((prev + delta).toFixed(2))));
      if (next === 1.0) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-white text-slate-900 w-full max-w-[1680px] h-[94vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* 1. Header Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  PHÒNG THÍ NGHIỆM XỬ LÝ & ĐỐI CHỨNG ẢNH VẾT NỨT (FORENSIC IMAGE LAB)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-700">
                  SANDBOX MODULE ĐỘC LẬP
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Kiểm định thuật toán khử tối (CLAHE + Gamma), khử mờ nén & làm nổi vết nứt 0.1mm trên máy tính Thẩm định viên (0% tải lên điện thoại KSV)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Main Split Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* CỘT TRÁI: Nguồn ảnh + Chế độ Preset + Thanh trượt tinh chỉnh (Width: 380px) */}
          <div className="w-full lg:w-[400px] border-r border-slate-200 bg-slate-50 flex flex-col overflow-y-auto shrink-0 p-4 space-y-4">
            {/* Khối 1: Nạp ảnh kiểm thử */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  1. Nguồn Ảnh Đưa Vào Kiểm Thử
                </span>
                {selectedFile && (
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 truncate max-w-[150px]">
                    {selectedFile.name}
                  </span>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Tải Ảnh Từ Máy Tính (.JPG / .PNG)</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateSyntheticSample}
                  disabled={isProcessing}
                  className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Tạo Ảnh Mẫu Vết Nứt Thiếu Sáng Để Test Ngay</span>
                </button>
              </div>

              {/* Nhập link URL ảnh */}
              <div className="pt-1 border-t border-slate-100 space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  Hoặc dán URL ảnh từ hồ sơ khảo sát:
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="https://... hoặc /uploads/..."
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      void executeProcessing(null, imageUrlInput, activePreset, customParams);
                    }}
                    disabled={!imageUrlInput.trim() || isProcessing}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Nạp
                  </button>
                </div>
              </div>

              {/* Chọn nhanh ảnh vết nứt thực tế trong DB (nếu có) */}
              {recentPhotos.length > 0 && (
                <div className="pt-1 border-t border-slate-100 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-600 block">
                    Ảnh vết nứt (CU) gần đây trong hệ thống ({recentPhotos.length}):
                  </span>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {recentPhotos.slice(0, 8).map((item, idx) => (
                      <button
                        key={`${item.photo_url}_${idx}`}
                        type="button"
                        onClick={() => handleSelectSampleUrl(item.photo_url)}
                        className="group relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:border-emerald-500 shrink-0 bg-slate-900 cursor-pointer"
                        title={`${item.parcel_code} - ${item.photo_code}`}
                      >
                        <img
                          src={item.photo_url}
                          alt={item.photo_code}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Khối 2: Chọn Chế độ Xử lý (Presets) */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                2. Chọn Chế Độ Thuật Toán (Presets)
              </span>

              <div className="space-y-1.5">
                {PRESET_LIST.map((preset) => {
                  const isSelected = activePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">{preset.label}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
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

            {/* Khối 3: Tinh chỉnh tham số chuyên sâu (Fine-tuning Sliders) */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <button
                type="button"
                onClick={() => setShowAdvancedSliders(!showAdvancedSliders)}
                className="w-full flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-slate-700 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-sky-600" />
                  3. Tinh Chỉnh Tham Số Toán Học
                </span>
                <span className="text-[11px] text-sky-600 font-bold">
                  {showAdvancedSliders ? 'Thu gọn ▲' : 'Mở rộng ▼'}
                </span>
              </button>

              {showAdvancedSliders && (
                <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
                  {/* CLAHE Max Slope */}
                  <div>
                    <div className="flex justify-between font-semibold text-slate-700 mb-1">
                      <span>Độ mạnh tương phản cục bộ (CLAHE Slope):</span>
                      <span className="font-mono font-bold text-emerald-700">{customParams.claheMaxSlope}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={8}
                      step={1}
                      value={customParams.claheMaxSlope}
                      onChange={(e) =>
                        setCustomParams((p) => ({
                          ...p,
                          enableClahe: Number(e.target.value) > 0,
                          claheMaxSlope: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* CLAHE Tile Size */}
                  <div>
                    <div className="flex justify-between font-semibold text-slate-700 mb-1">
                      <span>Kích thước ô lưới CLAHE (Tile px):</span>
                      <span className="font-mono font-bold text-emerald-700">{customParams.claheTileSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={16}
                      max={128}
                      step={16}
                      value={customParams.claheTileSize}
                      onChange={(e) =>
                        setCustomParams((p) => ({ ...p, claheTileSize: Number(e.target.value) }))
                      }
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* Gamma Correction */}
                  <div>
                    <div className="flex justify-between font-semibold text-slate-700 mb-1">
                      <span>Bù sáng vùng tối phi tuyến (Gamma):</span>
                      <span className="font-mono font-bold text-emerald-700">{customParams.gamma.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={1.0}
                      max={2.8}
                      step={0.1}
                      value={customParams.gamma}
                      onChange={(e) =>
                        setCustomParams((p) => ({ ...p, gamma: Number(e.target.value) }))
                      }
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* Brightness */}
                  <div>
                    <div className="flex justify-between font-semibold text-slate-700 mb-1">
                      <span>Hệ số khuếch đại sáng (Brightness):</span>
                      <span className="font-mono font-bold text-emerald-700">{customParams.brightness.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min={0.7}
                      max={1.8}
                      step={0.05}
                      value={customParams.brightness}
                      onChange={(e) =>
                        setCustomParams((p) => ({ ...p, brightness: Number(e.target.value) }))
                      }
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* Sharpen Jagged M2 (Crack Edge Gain) */}
                  <div>
                    <div className="flex justify-between font-semibold text-slate-700 mb-1">
                      <span>Độ sắc cạnh rãnh vết nứt & thước (m2):</span>
                      <span className="font-mono font-bold text-emerald-700">{customParams.sharpenJaggedM2.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={8}
                      step={0.2}
                      value={customParams.sharpenJaggedM2}
                      onChange={(e) =>
                        setCustomParams((p) => ({ ...p, sharpenJaggedM2: Number(e.target.value) }))
                      }
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* Sharpen Sigma */}
                  <div>
                    <div className="flex justify-between font-semibold text-slate-700 mb-1">
                      <span>Bán kính làm nét (Unsharp Sigma):</span>
                      <span className="font-mono font-bold text-emerald-700">{customParams.sharpenSigma.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={3.0}
                      step={0.1}
                      value={customParams.sharpenSigma}
                      onChange={(e) =>
                        setCustomParams((p) => ({ ...p, sharpenSigma: Number(e.target.value) }))
                      }
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* Median Denoise */}
                  <div>
                    <div className="flex justify-between font-semibold text-slate-700 mb-1">
                      <span>Khử nhiễu hạt ISO / Ô vuông nén (Median):</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {customParams.medianSize === 0 ? 'Tắt' : `${customParams.medianSize}x${customParams.medianSize}`}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[0, 3, 5].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setCustomParams((p) => ({ ...p, medianSize: sz }))}
                          className={`py-1 rounded-lg font-bold border cursor-pointer ${
                            customParams.medianSize === sz
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {sz === 0 ? 'Tắt (0)' : `Lọc ${sz}x${sz}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customParams.normalizeHistogram}
                        onChange={(e) =>
                          setCustomParams((p) => ({ ...p, normalizeHistogram: e.target.checked }))
                        }
                        className="accent-emerald-600"
                      />
                      <span className="font-semibold text-slate-700">Kéo giãn dải động toàn cục (Normalize P1-P99)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customParams.invertNegative}
                        onChange={(e) =>
                          setCustomParams((p) => ({ ...p, invertNegative: e.target.checked }))
                        }
                        className="accent-emerald-600"
                      />
                      <span className="font-semibold text-slate-700">Đảo bản âm X-Ray (Soi vết nứt siêu mảnh)</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyCustomSliders}
                    disabled={isProcessing || (!selectedFile && !imageUrlInput.trim())}
                    className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                    <span>Áp Dụng Thông Số Tùy Chỉnh</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* CỘT PHẢI: Chẩn đoán Chất lượng & Khung Đối Chứng Trực Quan */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-900 text-white overflow-hidden">
            {/* Thanh công cụ chế độ xem & Kính lúp Zoom */}
            <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
              {/* Chuyển đổi 3 chế độ xem */}
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCompareMode('SIDE_BY_SIDE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    compareMode === 'SIDE_BY_SIDE'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Song Song (Đồng Bộ Zoom)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCompareMode('SPLIT_SLIDER')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    compareMode === 'SPLIT_SLIDER'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <SplitSquareHorizontal className="w-3.5 h-3.5" />
                  <span>Thanh Kéo Gạt (Before/After)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCompareMode('HOLD_COMPARE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    compareMode === 'HOLD_COMPARE'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Nhấn Giữ Để So Sánh</span>
                </button>
              </div>

              {/* Điều khiển Zoom 100% -> 600% & Tải về */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() =>
                      setZoom((z) => {
                        const next = Math.max(1.0, Number((z - 0.5).toFixed(1)));
                        if (next === 1.0) setPan({ x: 0, y: 0 });
                        return next;
                      })
                    }
                    className="p-1 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
                    title="Thu nhỏ"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="px-2 text-xs font-mono font-bold text-emerald-400">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(6.0, Number((z + 0.5).toFixed(1))))}
                    className="p-1 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
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
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                    title="Đặt lại góc nhìn 100%"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {result && (
                  <button
                    type="button"
                    onClick={handleDownloadEnhanced}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải Ảnh Đã Làm Nét</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bảng Chẩn đoán Chất lượng & Chỉ số Đối chứng Trước / Sau */}
            {result && (
              <div className="px-4 py-2.5 bg-slate-900/95 border-b border-slate-800 space-y-2 shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {/* Chỉ số 1: Chẩn đoán tổng thể */}
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Chẩn Đoán Ảnh Gốc</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      {result.beforeMetrics.overallVerdict === 'PASS' ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đạt chuẩn
                        </span>
                      ) : result.beforeMetrics.overallVerdict === 'CRITICAL' ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-950 text-rose-300 border border-rose-700 flex items-center gap-1">
                          <AlertOctagon className="w-3.5 h-3.5" /> Mờ / Tối Nặng
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-950 text-amber-300 border border-amber-700 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Cần Tăng Cường
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chỉ số 2: Độ sắc nét Laplacian */}
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Độ Nét Cạnh (Laplacian)
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-0.5 font-mono">
                      <span className="text-xs text-slate-400">{result.beforeMetrics.laplacianVariance}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-sm font-black text-emerald-400">
                        {result.afterMetrics.laplacianVariance}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        {result.improvementSummary.sharpnessGainPercent >= 0
                          ? `+${result.improvementSummary.sharpnessGainPercent}%`
                          : `${result.improvementSummary.sharpnessGainPercent}%`}
                      </span>
                    </div>
                  </div>

                  {/* Chỉ số 3: Độ dốc biên vết nứt Sobel */}
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Biên Vết Nứt & Thước (Sobel)
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-0.5 font-mono">
                      <span className="text-xs text-slate-400">{result.beforeMetrics.edgeGradientScore}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-sm font-black text-sky-400">
                        {result.afterMetrics.edgeGradientScore}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800">
                        {result.improvementSummary.edgeGainPercent >= 0
                          ? `+${result.improvementSummary.edgeGainPercent}%`
                          : `${result.improvementSummary.edgeGainPercent}%`}
                      </span>
                    </div>
                  </div>

                  {/* Chỉ số 4: Độ sáng trung bình */}
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Độ Sáng TB (0-255)
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-0.5 font-mono">
                      <span className="text-xs text-slate-400">{result.beforeMetrics.meanLuminance}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-sm font-black text-amber-300">
                        {result.afterMetrics.meanLuminance}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        (Tối: {result.beforeMetrics.darkPixelRatio}% → {result.afterMetrics.darkPixelRatio}%)
                      </span>
                    </div>
                  </div>

                  {/* Chỉ số 5: Tương phản RMS & Thời gian */}
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Tương Phản RMS & Tốc Độ
                    </span>
                    <div className="flex items-baseline justify-between mt-0.5 font-mono">
                      <div>
                        <span className="text-xs text-slate-400">{result.beforeMetrics.rmsContrast}</span>
                        <span className="text-slate-500 mx-1">→</span>
                        <span className="text-sm font-black text-purple-300">
                          {result.afterMetrics.rmsContrast}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-bold">
                        {result.processingTimeMs} ms
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cảnh báo tự động cho Thẩm định viên nếu ảnh gốc bị mờ hoặc tối */}
                {result.beforeMetrics.warnings.length > 0 && (
                  <div className="px-3 py-1.5 rounded-lg bg-amber-950/70 border border-amber-700/80 text-amber-200 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      {result.beforeMetrics.warnings.map((w, idx) => (
                        <div key={idx}>• {w}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Thông báo lỗi nếu có */}
            {errorMsg && (
              <div className="m-4 p-3 rounded-xl bg-rose-950 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Khung Hiển Thị Đối Chứng Ảnh Chính */}
            <div
              onWheel={handleWheelZoom}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="flex-1 relative overflow-hidden flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
            >
              {isProcessing && (
                <div className="absolute inset-0 z-30 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-9 h-9 text-emerald-400 animate-spin" />
                  <span className="text-sm font-bold text-white">
                    Đang chạy Pipeline C++ Sharp (CLAHE + Gamma + Thresholded USM)...
                  </span>
                </div>
              )}

              {!result ? (
                <div className="max-w-md text-center p-8 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-200">
                    Chưa có ảnh nào được nạp vào Phòng Thí Nghiệm
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Hãy bấm <strong>&ldquo;Tải Ảnh Từ Máy Tính&rdquo;</strong> ở cột bên trái, chọn một ảnh vết nứt từ hệ thống, hoặc bấm nút tạo ảnh mẫu thiếu sáng bên dưới để kiểm tra trực tiếp hiệu quả làm rõ vết nứt và thước đo.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateSyntheticSample}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Nạp Ngay Ảnh Mẫu Vết Nứt Thiếu Sáng Để Thử Nghiệm</span>
                  </button>
                </div>
              ) : compareMode === 'SIDE_BY_SIDE' ? (
                /* CHẾ ĐỘ 1: SONG SONG 2 KHUNG ĐỒNG BỘ ZOOM 100% - 600% */
                <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
                  {/* Khung Trái: Ảnh Gốc */}
                  <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center">
                    <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700 text-xs font-bold text-slate-200 shadow-md">
                      1. ẢNH GỐC CHƯA XỬ LÝ (ORIGINAL)
                    </div>
                    <img
                      src={result.originalPreviewBase64}
                      alt="Ảnh gốc"
                      draggable={false}
                      className="max-w-full max-h-full object-contain pointer-events-none transition-transform duration-75"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                      }}
                    />
                  </div>

                  {/* Khung Phải: Ảnh Đã Xử Lý */}
                  <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500/70 bg-slate-950 flex items-center justify-center">
                    <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-600 text-xs font-bold text-emerald-300 shadow-md flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>2. SAU XỬ LÝ ({result.presetUsed} • 4:4:4 Q95)</span>
                    </div>
                    <img
                      src={result.enhancedPreviewBase64}
                      alt="Ảnh đã làm rõ vết nứt"
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
                /* CHẾ ĐỘ 2: THANH KÉO GẠT BEFORE / AFTER */
                <div className="relative w-full h-full flex items-center justify-center p-4 overflow-hidden">
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                    {/* Lớp dưới: Ảnh sau xử lý */}
                    <img
                      src={result.enhancedPreviewBase64}
                      alt="Sau xử lý"
                      draggable={false}
                      className="max-w-full max-h-full object-contain pointer-events-none"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                      }}
                    />

                    {/* Lớp trên cắt theo clip-path: Ảnh gốc */}
                    <div
                      className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none"
                      style={{
                        clipPath: `inset(0 ${100 - splitPercent}% 0 0)`,
                      }}
                    >
                      <img
                        src={result.originalPreviewBase64}
                        alt="Trước xử lý"
                        draggable={false}
                        className="max-w-full max-h-full object-contain pointer-events-none"
                        style={{
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                          transformOrigin: 'center center',
                        }}
                      />
                    </div>

                    {/* Đường ranh giới kéo */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 shadow-lg pointer-events-none z-20"
                      style={{ left: `${splitPercent}%` }}
                    />

                    <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700 text-xs font-bold text-slate-200">
                      TRƯỚC XỬ LÝ (GỐC)
                    </div>
                    <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-600 text-xs font-bold text-emerald-300">
                      SAU XỬ LÝ ({result.presetUsed})
                    </div>

                    {/* Thanh range điều khiển vị trí cắt */}
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 px-4 py-2 rounded-full border border-slate-700 flex items-center gap-3 w-72 sm:w-96"
                    >
                      <span className="text-[11px] font-bold text-slate-300">Gốc</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={splitPercent}
                        onChange={(e) => setSplitPercent(Number(e.target.value))}
                        className="flex-1 accent-emerald-400 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-emerald-400">Làm nét</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* CHẾ ĐỘ 3: NHẤN GIỮ ĐỂ ĐỐI CHIẾU */
                <div
                  onMouseDown={() => setIsHoldingOriginal(true)}
                  onMouseUp={() => setIsHoldingOriginal(false)}
                  onMouseLeave={() => setIsHoldingOriginal(false)}
                  className="relative w-full h-full flex items-center justify-center p-4"
                >
                  <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs font-bold">
                    {isHoldingOriginal ? (
                      <span className="text-amber-300">ĐANG XEM: ẢNH GỐC CHƯA XỬ LÝ</span>
                    ) : (
                      <span className="text-emerald-400">
                        ĐANG XEM: ẢNH ĐÃ LÀM RÕ VẾT NỨT (Nhấn giữ chuột vào ảnh để xem ảnh gốc)
                      </span>
                    )}
                  </div>
                  <img
                    src={isHoldingOriginal ? result.originalPreviewBase64 : result.enhancedPreviewBase64}
                    alt="So sánh"
                    draggable={false}
                    className="max-w-full max-h-full object-contain pointer-events-none transition-transform duration-75"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: 'center center',
                    }}
                  />
                </div>
              )}

              {/* Chú thích hướng dẫn cuộn chuột dưới đáy */}
              {result && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-4 py-1 rounded-full bg-slate-950/90 border border-slate-700 text-[11px] text-slate-300 pointer-events-none">
                  🖱️ <strong>Cuộn chuột</strong> để phóng đại đồng bộ (tới 600%) • <strong>Kéo chuột</strong> để di chuyển soi vạch chia thước đo mm & vết nứt
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

