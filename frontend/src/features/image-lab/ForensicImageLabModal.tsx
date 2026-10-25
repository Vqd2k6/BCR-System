import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  BarChart3,
  MoveHorizontal,
  ChevronLeft,
  ChevronRight,
  Search,
  Building2,
} from 'lucide-react';
import { api } from '../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';

export type ImageLabPreset =
  | 'AUTO_SMART'
  | 'CRACK_ENHANCE_V1'
  | 'CRACK_ENHANCE_V2'
  | 'LOW_LIGHT_RESCUE'
  | 'CUSTOM';

export interface ImageEnhancementParams {
  enableClahe: boolean;
  claheTileSize: number;
  claheMaxSlope: number;
  gamma: number;
  brightness: number;
  saturation: number;
  crackValleyBoost: number;
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
  noiseSigma: number;
  cnrScore: number;
  histogram: number[];
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
    cnrGainPercent: number;
  };
}

interface SampleSurveyPhoto {
  photo_url: string;
  photo_code: string;
  category: string;
  photo_type?: 'CU' | 'CTX';
  parcel_code: string;
  rank_in_parcel?: number;
  created_at: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
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

/**
 * Tạo bức ảnh mẫu chuẩn Forensic v2.0 mô phỏng sát thực tế hiện trường:
 * - Tường vữa trát đa tần số trong góc tối thiếu sáng (Luminance 22 - 58/255)
 * - Vết ố vàng thấm nước nhẹ (để kiểm chứng thuật toán kênh L không làm sai lệch màu)
 * - 3 cấp độ vết nứt: Nứt chính (0.45mm), Nứt nhánh (0.20mm), Nứt chân chim siêu mảnh (0.10mm)
 * - Thẻ thước đo bề rộng vết nứt (Crack Width Gauge 0.1mm - 1.5mm) + Nhiễu Poisson-Gaussian
 */
async function generateSyntheticDarkCrackImage(): Promise<File> {
  const canvas = document.createElement('canvas');
  const w = 1280;
  const h = 920;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Không thể khởi tạo Canvas tạo ảnh mẫu.');

  // 1. Nền tường thiếu sáng bất đối xứng (mô phỏng góc tường khuất sáng đèn)
  const grad = ctx.createRadialGradient(w * 0.42, h * 0.38, 60, w * 0.5, h * 0.5, w * 0.82);
  grad.addColorStop(0, 'rgb(58, 60, 64)');
  grad.addColorStop(0.55, 'rgb(36, 38, 42)');
  grad.addColorStop(1, 'rgb(18, 20, 24)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 2. Vết ố thấm nước màu vàng nâu nhạt (kiểm chứng bảo toàn sắc độ màu trên kênh L)
  const stainGrad = ctx.createRadialGradient(w * 0.32, h * 0.34, 20, w * 0.32, h * 0.34, 210);
  stainGrad.addColorStop(0, 'rgba(72, 58, 36, 0.38)');
  stainGrad.addColorStop(0.7, 'rgba(56, 46, 30, 0.18)');
  stainGrad.addColorStop(1, 'rgba(36, 38, 42, 0)');
  ctx.fillStyle = stainGrad;
  ctx.fillRect(0, 0, w, h);

  // 3. Vẽ Thước đo bề rộng vết nứt (Crack Width Ruler Card) đặt cạnh vết nứt nhưng bị tối
  const rx = Math.round(w * 0.48);
  const ry = Math.round(h * 0.50);
  const rw = 420;
  const rh = 215;

  ctx.save();
  ctx.fillStyle = 'rgb(84, 88, 94)';
  ctx.strokeStyle = 'rgb(46, 49, 54)';
  ctx.lineWidth = 2;
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeRect(rx, ry, rw, rh);

  ctx.fillStyle = 'rgb(20, 22, 26)';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('CRACK WIDTH GAUGE (mm) - METRO 2 FORENSIC', rx + 16, ry + 28);

  const widths = [0.1, 0.15, 0.2, 0.3, 0.5, 0.8, 1.0, 1.5];
  widths.forEach((mm, idx) => {
    const tx = rx + 22 + idx * 48;
    ctx.fillStyle = 'rgb(18, 20, 24)';
    ctx.fillRect(tx, ry + 48, Math.max(0.75, mm * 2.2), 58);
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${mm}`, tx - 6, ry + 124);
  });

  ctx.font = '12px sans-serif';
  ctx.fillText('MẪU KIỂM ĐỊNH v2.0: 3 CẤP ĐỘ NỨT (0.45mm / 0.20mm / 0.10mm)', rx + 16, ry + 160);
  ctx.fillText('KÈM VẾT THẤM Ố VÀNG & NHIỄU CẢM BIẾN THIẾU SÁNG', rx + 16, ry + 182);
  ctx.restore();

  // 4. Vẽ 3 cấp độ vết nứt kết cấu (Nứt chính 0.45mm, Nứt nhánh 0.20mm, Nứt chân chim 0.10mm)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Cấp 1: Vết nứt kết cấu chính (0.45mm - rộng ~2.4px)
  ctx.strokeStyle = 'rgba(11, 12, 15, 0.82)';
  ctx.lineWidth = 2.4;
  ctx.filter = 'blur(0.45px)';
  ctx.beginPath();
  let cx = w * 0.22;
  let cy = h * 0.10;
  ctx.moveTo(cx, cy);
  const mainSegments = [
    [38, 68], [26, 74], [-14, 58], [34, 82], [14, 66],
    [-18, 56], [28, 86], [36, 74], [12, 82], [30, 78],
  ];
  for (const [dx, dy] of mainSegments) {
    cx += dx;
    cy += dy;
    ctx.lineTo(cx, cy);
  }
  ctx.stroke();

  // Cấp 2: Vết nứt nhánh xiên (0.20mm - rộng ~1.35px)
  ctx.lineWidth = 1.35;
  ctx.strokeStyle = 'rgba(15, 16, 20, 0.68)';
  ctx.beginPath();
  ctx.moveTo(w * 0.31, h * 0.36);
  ctx.lineTo(w * 0.41, h * 0.41);
  ctx.lineTo(w * 0.49, h * 0.39);
  ctx.lineTo(w * 0.58, h * 0.44);
  ctx.lineTo(w * 0.66, h * 0.42);
  ctx.stroke();

  // Cấp 3: Vết nứt chân chim siêu mảnh (0.10mm - rộng ~0.85px, chênh lệch độ sáng cực thấp)
  ctx.lineWidth = 0.85;
  ctx.filter = 'none';
  ctx.strokeStyle = 'rgba(22, 24, 28, 0.52)';
  ctx.beginPath();
  ctx.moveTo(w * 0.31, h * 0.56);
  ctx.lineTo(w * 0.36, h * 0.53);
  ctx.lineTo(w * 0.41, h * 0.55);
  ctx.lineTo(w * 0.45, h * 0.52);
  ctx.moveTo(w * 0.25, h * 0.24);
  ctx.lineTo(w * 0.18, h * 0.29);
  ctx.lineTo(w * 0.13, h * 0.27);
  ctx.stroke();
  ctx.restore();

  // 5. Mô phỏng cấu trúc hạt vữa trát + Nhiễu cảm biến Poisson-Gaussian vùng tối
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      // Hạt vữa tần số trung bình
      const mortarGrain = Math.sin(x * 0.37) * Math.cos(y * 0.41) * 1.8;
      // Nhiễu đọc cảm biến (Read noise + Chroma noise nhẹ ở vùng tối)
      const lumaNoise = (nextRand() + nextRand() - 1.0) * 5.2;
      const chromaNoiseR = (nextRand() - 0.5) * 3.5;
      const chromaNoiseB = (nextRand() - 0.5) * 3.5;

      data[idx] = Math.max(0, Math.min(255, Math.round(data[idx] + mortarGrain + lumaNoise + chromaNoiseR)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(data[idx + 1] + mortarGrain + lumaNoise)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(data[idx + 2] + mortarGrain + lumaNoise + chromaNoiseB)));
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Lỗi xuất ảnh mẫu'))), 'image/jpeg', 0.84);
  });

  return new File([blob], 'mau_kiem_dinh_vet_nut_v2.jpg', { type: 'image/jpeg' });
}

/**
 * Xây dựng chuỗi SVG Path từ mảng Histogram 64-bin
 */
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

export const ForensicImageLabModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [activePreset, setActivePreset] = useState<ImageLabPreset>('AUTO_SMART');
  // Cụm tham số điều chỉnh thủ công trực quan: Tăng/giảm sáng & Tăng nét
  const [brightnessSlider, setBrightnessSlider] = useState<number>(1.0); // 0.50 -> 1.80
  const [sharpnessSlider, setSharpnessSlider] = useState<number>(2.4);  // 0.0 -> 6.0

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ImageLabProcessResult | null>(null);

  // Chế độ đối chứng trực quan
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

  // Danh sách 100 ảnh khảo sát thực tế (tối đa 5 ảnh/căn) để chọn nhanh & duyệt tuần tự
  const [recentPhotos, setRecentPhotos] = useState<SampleSurveyPhoto[]>([]);
  const [photoTypeFilter, setPhotoTypeFilter] = useState<'ALL' | 'CU' | 'CTX'>('ALL');
  const [selectedParcelFilter, setSelectedParcelFilter] = useState<string>('ALL');
  const [photoSearchQuery, setPhotoSearchQuery] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tải bộ 100 ảnh mẫu từ các hồ sơ khảo sát (tối đa 5 ảnh/căn) khi mở Modal
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    api
      .get('/image-lab/recent-survey-photos', {
        params: { limit: 100, maxPerParcel: 5 },
      })
      .then((res) => {
        if (!isMounted) return;
        if (Array.isArray(res.data?.data)) {
          setRecentPhotos(res.data.data);
        }
      })
      .catch((err: unknown) => {
        console.warn('[ForensicImageLabModal] Không tải được danh sách ảnh mẫu:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Thống kê danh sách các căn (parcels) trong bộ 100 ảnh
  const distinctParcels = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of recentPhotos) {
      const code = item.parcel_code || 'METRO2';
      map.set(code, (map.get(code) || 0) + 1);
    }
    return Array.from(map.entries()).map(([code, count]) => ({ code, count }));
  }, [recentPhotos]);

  const cuPhotoCount = useMemo(
    () => recentPhotos.filter((p) => (p.photo_type || (p.category.includes('(CTX)') ? 'CTX' : 'CU')) === 'CU').length,
    [recentPhotos]
  );

  const ctxPhotoCount = useMemo(
    () => recentPhotos.filter((p) => (p.photo_type || (p.category.includes('(CTX)') ? 'CTX' : 'CU')) === 'CTX').length,
    [recentPhotos]
  );

  // Lọc danh sách ảnh theo loại (ALL / CU / CTX), mã căn và từ khóa tìm kiếm
  const filteredRecentPhotos = useMemo(() => {
    const q = photoSearchQuery.trim().toLowerCase();
    return recentPhotos.filter((item) => {
      const pType = item.photo_type || (item.category.includes('(CTX)') ? 'CTX' : 'CU');
      if (photoTypeFilter !== 'ALL' && pType !== photoTypeFilter) return false;
      if (selectedParcelFilter !== 'ALL' && item.parcel_code !== selectedParcelFilter) return false;
      if (
        q.length > 0 &&
        !item.parcel_code.toLowerCase().includes(q) &&
        !item.photo_code.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [recentPhotos, photoTypeFilter, selectedParcelFilter, photoSearchQuery]);

  // Vị trí ảnh hiện tại đang được chọn trong danh sách lọc
  const currentSampleIndex = useMemo(() => {
    if (!imageUrlInput.trim()) return -1;
    return filteredRecentPhotos.findIndex((p) => p.photo_url === imageUrlInput.trim());
  }, [filteredRecentPhotos, imageUrlInput]);

  // Hỗ trợ phím tắt Spacebar để nhấn giữ đối chiếu Ảnh Gốc mọi lúc mà không xung đột chuột kéo Pan
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
        if (data.appliedParams) {
          setBrightnessSlider(data.appliedParams.brightness || 1.0);
          setSharpnessSlider(data.appliedParams.sharpenJaggedM2 ?? 2.4);
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

  // Xây dựng params từ 2 thanh trượt trực quan Tăng/Giảm sáng và Tăng nét
  const buildCustomParams = useCallback(
    (b: number, s: number): ImageEnhancementParams => {
      const isBrighter = b > 1.0;
      return {
        ...DEFAULT_PARAMS,
        brightness: Number(b.toFixed(2)),
        // Tăng sáng tự động nâng kèm gamma để kéo sáng góc tối, giảm sáng giữ gamma mượt
        gamma: isBrighter ? Number((1.2 + (b - 1.0) * 1.1).toFixed(2)) : 1.0,
        sharpenFlatM1: 0.0, // Luôn giữ m1 = 0.0 để không bẩn tường
        sharpenJaggedM2: Number(s.toFixed(1)),
      };
    },
    []
  );

  const handleApplySliders = (newBrightness: number, newSharpness: number) => {
    setActivePreset('CUSTOM');
    const params = buildCustomParams(newBrightness, newSharpness);
    if (selectedFile || imageUrlInput.trim()) {
      void executeProcessing(selectedFile, imageUrlInput, 'CUSTOM', params);
    }
  };

  const handleResetSliders = () => {
    setBrightnessSlider(1.0);
    setSharpnessSlider(2.4);
    setActivePreset('AUTO_SMART');
    if (selectedFile || imageUrlInput.trim()) {
      void executeProcessing(selectedFile, imageUrlInput, 'AUTO_SMART');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setImageUrlInput('');
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    void executeProcessing(file, '', activePreset, buildCustomParams(brightnessSlider, sharpnessSlider));
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
      await executeProcessing(sampleFile, '', activePreset, buildCustomParams(brightnessSlider, sharpnessSlider));
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
    void executeProcessing(null, url, activePreset, buildCustomParams(brightnessSlider, sharpnessSlider));
  };

  const handleStepSamplePhoto = (delta: -1 | 1) => {
    if (filteredRecentPhotos.length === 0) return;
    let nextIdx = 0;
    if (currentSampleIndex >= 0) {
      nextIdx = (currentSampleIndex + delta + filteredRecentPhotos.length) % filteredRecentPhotos.length;
    } else {
      nextIdx = delta > 0 ? 0 : filteredRecentPhotos.length - 1;
    }
    const target = filteredRecentPhotos[nextIdx];
    if (target) {
      handleSelectSampleUrl(target.photo_url);
    }
  };

  const handleSelectPreset = (presetId: ImageLabPreset) => {
    setActivePreset(presetId);
    if (selectedFile || imageUrlInput.trim()) {
      void executeProcessing(selectedFile, imageUrlInput, presetId);
    }
  };

  const handleDownloadEnhanced = () => {
    if (!result?.enhancedPreviewBase64) return;
    const a = document.createElement('a');
    a.href = result.enhancedPreviewBase64;
    a.download = `metro2_forensic_${activePreset.toLowerCase()}_${Date.now()}.jpg`;
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

  const handleViewportMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDraggingPan(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleViewportMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ưu tiên 1: Nếu đang kéo trực tiếp thanh chia SPLIT_SLIDER trên màn hình ảnh (Khắc phục Lỗi UI #1)
    if (isDraggingSplit && splitContainerRef.current) {
      const rect = splitContainerRef.current.getBoundingClientRect();
      if (rect.width > 0) {
        const rawPct = ((e.clientX - rect.left) / rect.width) * 100;
        setSplitPercent(Math.max(2, Math.min(98, Number(rawPct.toFixed(1)))));
      }
      return;
    }

    // Ưu tiên 2: Kéo trượt Pan ảnh
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
    <div className="fixed inset-0 z-[10000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-white text-slate-900 w-full max-w-[1720px] h-[95vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* 1. Header Bar (Light Mode) */}
        <div className="px-5 py-3 bg-white text-slate-900 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-800">
                  PHÒNG THÍ NGHIỆM XỬ LÝ & ĐỐI CHỨNG ẢNH VẾT NỨT (FORENSIC DSP LAB)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                  LUMINANCE 4:4:4 ENGINE
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-300">
                  SANDBOX ĐỘC LẬP
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Xử lý trên kênh Độ chói L bảo toàn sắc độ màu • Nổi vết nứt v1/v2 không hạt đen • Nâng sáng thông minh (0% tải lên điện thoại KSV)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-rose-600 text-slate-600 hover:text-white transition-all cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Main Split Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* CỘT TRÁI: Nguồn ảnh + Chế độ Preset + Thanh trượt tinh chỉnh (Width: 410px) */}
          <div className="w-full lg:w-[410px] border-r border-slate-200 bg-slate-50 flex flex-col overflow-y-auto shrink-0 p-3.5 space-y-3.5">
            {/* Khối 1: Nạp ảnh kiểm thử */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  1. Nguồn Ảnh Đưa Vào Kiểm Thử
                </span>
                {selectedFile && (
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 truncate max-w-[155px]">
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
                  <span>Tạo Ảnh Mẫu Chuẩn 3 Cấp Nứt (0.45 / 0.2 / 0.1mm)</span>
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
                      void executeProcessing(
                        null,
                        imageUrlInput,
                        activePreset,
                        buildCustomParams(brightnessSlider, sharpnessSlider)
                      );
                    }}
                    disabled={!imageUrlInput.trim() || isProcessing}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Nạp
                  </button>
                </div>
              </div>

              {/* Bộ 100 ảnh thực tế (Tối đa 5 ảnh/căn) để duyệt & kiểm thử */}
              {recentPhotos.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                      Bộ {recentPhotos.length} ảnh thực tế ({distinctParcels.length} căn • ≤5 ảnh/căn)
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStepSamplePhoto(-1)}
                        disabled={isProcessing || filteredRecentPhotos.length === 0}
                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer disabled:opacity-40"
                        title="Chuyển về ảnh trước trong danh sách lọc"
                      >
                        <ChevronLeft className="w-3 h-3" />
                        <span>Trước</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStepSamplePhoto(1)}
                        disabled={isProcessing || filteredRecentPhotos.length === 0}
                        className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-0.5 cursor-pointer disabled:opacity-40"
                        title="Chuyển sang ảnh tiếp theo trong danh sách lọc"
                      >
                        <span>Tiếp</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Bộ lọc Loại ảnh (Tất cả / Vết nứt CU / Bối cảnh CTX) */}
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setPhotoTypeFilter('ALL')}
                      className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        photoTypeFilter === 'ALL'
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Tất cả ({recentPhotos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoTypeFilter('CU')}
                      className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        photoTypeFilter === 'CU'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-emerald-50/60 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70'
                      }`}
                    >
                      Vết nứt CU ({cuPhotoCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoTypeFilter('CTX')}
                      className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        photoTypeFilter === 'CTX'
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-sky-50/60 text-sky-800 border-sky-200 hover:bg-sky-100/70'
                      }`}
                    >
                      Bối cảnh CTX ({ctxPhotoCount})
                    </button>
                  </div>

                  {/* Lọc theo Mã căn (Parcel) + Ô tìm kiếm nhanh */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={selectedParcelFilter}
                      onChange={(e) => setSelectedParcelFilter(e.target.value)}
                      className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                    >
                      <option value="ALL">Tất cả ({distinctParcels.length} căn)</option>
                      {distinctParcels.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.code} ({p.count}/5 ảnh)
                        </option>
                      ))}
                    </select>

                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={photoSearchQuery}
                        onChange={(e) => setPhotoSearchQuery(e.target.value)}
                        placeholder="Tìm mã căn / mã ảnh..."
                        className="w-full pl-6 pr-2 py-1 text-[11px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                  </div>

                  {/* Trạng thái ảnh đang chọn */}
                  {currentSampleIndex >= 0 && filteredRecentPhotos[currentSampleIndex] && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 text-[10px]">
                      <span className="font-bold text-emerald-900 truncate">
                        Đang chọn #{currentSampleIndex + 1}/{filteredRecentPhotos.length}:{' '}
                        <span className="font-mono">{filteredRecentPhotos[currentSampleIndex].parcel_code}</span>
                      </span>
                      <span className="font-mono font-bold text-emerald-700 shrink-0">
                        {filteredRecentPhotos[currentSampleIndex].photo_type || 'CU'}
                      </span>
                    </div>
                  )}

                  {/* Lưới cuộn toàn bộ 100 ảnh (4 cột) */}
                  <div className="max-h-56 overflow-y-auto grid grid-cols-4 gap-1.5 pr-1 pt-0.5">
                    {filteredRecentPhotos.map((item, idx) => {
                      const isCurrent = imageUrlInput.trim() === item.photo_url;
                      const pType = item.photo_type || (item.category.includes('(CTX)') ? 'CTX' : 'CU');
                      return (
                        <button
                          key={`${item.photo_url}_${idx}`}
                          type="button"
                          onClick={() => handleSelectSampleUrl(item.photo_url)}
                          className={`group relative h-16 rounded-lg overflow-hidden border transition-all bg-slate-900 cursor-pointer ${
                            isCurrent
                              ? 'border-emerald-500 ring-2 ring-emerald-500/40 scale-[0.98]'
                              : 'border-slate-200 hover:border-emerald-400'
                          }`}
                          title={`#${idx + 1} • Căn: ${item.parcel_code} (Ảnh #${item.rank_in_parcel || 1}/5) • ${item.photo_code}`}
                        >
                          <img
                            src={item.photo_url}
                            alt={item.photo_code}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <span className="absolute top-0.5 left-0.5 px-1 py-0.2 rounded bg-slate-950/80 text-white text-[9px] font-mono font-bold">
                            #{idx + 1}
                          </span>
                          <span
                            className={`absolute top-0.5 right-0.5 px-1 py-0.2 rounded text-[8px] font-mono font-extrabold ${
                              pType === 'CTX'
                                ? 'bg-sky-600/90 text-white'
                                : 'bg-emerald-600/90 text-white'
                            }`}
                          >
                            {pType}
                          </span>
                          <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 px-1 py-0.5 text-[8px] font-mono text-slate-200 truncate text-left">
                            {item.parcel_code}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Khối 2: Chọn Chế độ Xử lý (Presets) */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  2. Chế Độ Thuật Toán (Presets v2.0)
                </span>
                {activePreset === 'CUSTOM' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-700 border border-sky-300">
                    Đang dùng Tham số Tùy chỉnh
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
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
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

            {/* Khối 3: Tinh chỉnh thủ công: Tăng sáng, Giảm sáng & Tăng nét */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-sky-600" />
                  3. Tinh Chỉnh Sáng & Nét
                </span>
                <button
                  type="button"
                  onClick={handleResetSliders}
                  className="text-[11px] font-bold text-slate-500 hover:text-emerald-700 hover:bg-slate-100 px-2 py-0.5 rounded cursor-pointer"
                  title="Đặt lại mức sáng và nét chuẩn"
                >
                  Đặt lại
                </button>
              </div>

              {/* 1. Điều chỉnh Độ sáng (Giảm sáng / Tăng sáng) */}
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
                    disabled={isProcessing}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold shrink-0 cursor-pointer disabled:opacity-40"
                    title="Giảm độ sáng 10%"
                  >
                    - Giảm sáng
                  </button>

                  <input
                    type="range"
                    min={0.5}
                    max={1.8}
                    step={0.05}
                    value={brightnessSlider}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setBrightnessSlider(next);
                    }}
                    onMouseUp={() => handleApplySliders(brightnessSlider, sharpnessSlider)}
                    className="flex-1 accent-amber-500 cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(1.8, Number((brightnessSlider + 0.1).toFixed(2)));
                      setBrightnessSlider(next);
                      handleApplySliders(next, sharpnessSlider);
                    }}
                    disabled={isProcessing}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold shrink-0 cursor-pointer disabled:opacity-40"
                    title="Tăng độ sáng 10%"
                  >
                    + Tăng sáng
                  </button>
                </div>
              </div>

              {/* 2. Điều chỉnh Độ nét (Tăng nét) */}
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
                    disabled={isProcessing}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold shrink-0 cursor-pointer disabled:opacity-40"
                    title="Giảm bớt nét"
                  >
                    - Giảm nét
                  </button>

                  <input
                    type="range"
                    min={0.0}
                    max={6.0}
                    step={0.2}
                    value={sharpnessSlider}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setSharpnessSlider(next);
                    }}
                    onMouseUp={() => handleApplySliders(brightnessSlider, sharpnessSlider)}
                    className="flex-1 accent-sky-600 cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(6.0, Number((sharpnessSlider + 0.4).toFixed(1)));
                      setSharpnessSlider(next);
                      handleApplySliders(brightnessSlider, next);
                    }}
                    disabled={isProcessing}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold shrink-0 cursor-pointer disabled:opacity-40"
                    title="Tăng thêm độ nét"
                  >
                    + Tăng nét
                  </button>
                </div>
              </div>

              {/* Nút bấm thực thi */}
              <button
                type="button"
                onClick={() => handleApplySliders(brightnessSlider, sharpnessSlider)}
                disabled={isProcessing || (!selectedFile && !imageUrlInput.trim())}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>Áp Dụng Điều Chỉnh Sáng & Nét</span>
              </button>
            </div>
          </div>

          {/* CỘT PHẢI: Chẩn đoán Chất lượng, Biểu đồ Histogram & Khung Đối Chứng Trực Quan (Tone Sáng Đồng Bộ) */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-100/90 text-slate-800 overflow-hidden">
            {/* Thanh công cụ chế độ xem & Kính lúp Zoom */}
            <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-2xs">
              {/* Chuyển đổi 3 chế độ xem */}
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
                  <span>Song Song (Đồng Bộ Zoom)</span>
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

              {/* Điều khiển Duyệt 100 ảnh, Zoom 100% -> 600%, Nút giữ xem ảnh gốc & Tải về */}
              <div className="flex items-center gap-2 flex-wrap">
                {filteredRecentPhotos.length > 0 && (
                  <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleStepSamplePhoto(-1)}
                      disabled={isProcessing}
                      className="px-2 py-1 rounded-lg hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      title="Ảnh trước trong bộ 100 ảnh"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Ảnh trước</span>
                    </button>
                    <span className="px-2 text-[11px] font-mono font-bold text-emerald-700">
                      {currentSampleIndex >= 0
                        ? `#${currentSampleIndex + 1}/${filteredRecentPhotos.length} (${filteredRecentPhotos[currentSampleIndex]?.parcel_code})`
                        : `${filteredRecentPhotos.length} ảnh mẫu`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStepSamplePhoto(1)}
                      disabled={isProcessing}
                      className="px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      title="Ảnh tiếp theo trong bộ 100 ảnh"
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
                    title="Nhấn giữ chuột vào nút này hoặc nhấn giữ phím Space để xem Ảnh Gốc"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isHoldingOriginal ? 'Đang hiện: ẢNH GỐC' : 'Giữ nút / Phím Space: Soi Gốc'}</span>
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

                {result && (
                  <button
                    type="button"
                    onClick={handleDownloadEnhanced}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải Ảnh</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bảng Chẩn đoán Chất lượng & Biểu đồ Lược đồ Xám 64-Bin (Tone Sáng Rõ Nét) */}
            {result && (
              <div className="px-4 py-2.5 bg-white border-b border-slate-200 space-y-2 shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  {/* Chỉ số 1: Chẩn đoán tổng thể */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Chẩn Đoán Ảnh Gốc</span>
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

                  {/* Chỉ số 2: Độ sắc nét Cấu trúc */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Độ Nét Cấu Trúc
                    </span>
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

                  {/* Chỉ số 3: Độ dốc biên vết nứt Top-5% Sobel */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Biên Vết Nứt (Top-5%)
                    </span>
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

                  {/* Chỉ số 4: Tỉ số CNR & Sàn nhiễu */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Tỉ Số CNR & Nhiễu
                    </span>
                    <div className="flex items-baseline justify-between mt-0.5 font-mono">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs text-slate-500">{result.beforeMetrics.cnrScore}</span>
                        <span className="text-slate-400">→</span>
                        <span className="text-sm font-black text-indigo-700">
                          {result.afterMetrics.cnrScore}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        σ_n: {result.afterMetrics.noiseSigma}
                      </span>
                    </div>
                  </div>

                  {/* Chỉ số 5: Độ sáng trung bình */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Độ Sáng L (0–255)
                    </span>
                    <div className="flex items-baseline justify-between mt-0.5 font-mono">
                      <div>
                        <span className="text-xs text-slate-500">{result.beforeMetrics.meanLuminance}</span>
                        <span className="text-slate-400 mx-1">→</span>
                        <span className="text-sm font-black text-amber-700">
                          {result.afterMetrics.meanLuminance}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Tối: {result.afterMetrics.darkPixelRatio}%
                      </span>
                    </div>
                  </div>

                  {/* Chỉ số 6: Biểu đồ Histogram 64-Bin (Trên nền sáng) */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-slate-600 uppercase flex items-center gap-1">
                        <BarChart3 className="w-3 h-3 text-emerald-600" />
                        Phổ Độ Chói
                      </span>
                      <div className="flex items-center gap-1.5 text-[9px]">
                        <span className="text-slate-400">■ Gốc</span>
                        <span className="text-emerald-600 font-bold">■ Xử lý</span>
                      </div>
                    </div>
                    <div className="h-8 w-full mt-1 relative bg-white/70 rounded border border-slate-200/60 overflow-hidden">
                      <svg
                        viewBox="0 0 180 32"
                        preserveAspectRatio="none"
                        className="w-full h-full overflow-visible"
                      >
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

                {/* Cảnh báo chất lượng nếu có */}
                {result.beforeMetrics.warnings.length > 0 && (
                  <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
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
              <div className="m-4 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Khung Hiển Thị Đối Chứng Ảnh Chính (Tone Sáng) */}
            <div
              onWheel={handleWheelZoom}
              onMouseDown={handleViewportMouseDown}
              onMouseMove={handleViewportMouseMove}
              onMouseUp={handleViewportMouseUp}
              onMouseLeave={handleViewportMouseUp}
              className="flex-1 relative overflow-hidden flex items-center justify-center select-none cursor-grab active:cursor-grabbing bg-slate-200/50"
            >
              {isProcessing && (
                <div className="absolute inset-0 z-40 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-9 h-9 text-emerald-600 animate-spin" />
                  <span className="text-sm font-bold text-slate-800">
                    Đang xử lý ảnh trên kênh Độ chói Luminance 4:4:4...
                  </span>
                </div>
              )}

              {!result ? (
                <div className="max-w-md text-center p-8 space-y-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">
                    Chưa có ảnh nào được nạp vào Phòng Thí Nghiệm
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Hãy bấm <strong>&ldquo;Tải Ảnh Từ Máy Tính&rdquo;</strong>, chọn 1 trong bộ 100 ảnh mẫu khảo sát ở cột bên trái hoặc bấm nút tạo ảnh mẫu bên dưới để kiểm nghiệm ngay.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateSyntheticSample}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Nạp Ảnh Mẫu 3 Cấp Nứt (0.45mm / 0.20mm / 0.10mm)</span>
                  </button>
                </div>
              ) : compareMode === 'SIDE_BY_SIDE' ? (
                /* CHẾ ĐỘ 1: SONG SONG 2 KHUNG ĐỒNG BỘ ZOOM */
                <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
                  {/* Khung Trái: Ảnh Gốc */}
                  <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-slate-100 flex items-center justify-center shadow-xs">
                    <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-white/95 border border-slate-300 text-xs font-bold text-slate-700 shadow-sm">
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
                  <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 bg-slate-100 flex items-center justify-center shadow-xs">
                    <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-sm flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {isHoldingOriginal
                          ? 'ĐANG ĐỐI CHIẾU: ẢNH GỐC (NHẢ PHÍM SPACE ĐỂ QUAY LẠI)'
                          : `2. SAU XỬ LÝ (${result.presetUsed} • L-CHANNEL 4:4:4)`}
                      </span>
                    </div>
                    <img
                      src={isHoldingOriginal ? result.originalPreviewBase64 : result.enhancedPreviewBase64}
                      alt="Ảnh đã xử lý"
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

                    {/* Thanh nắm kéo trực tiếp trên màn hình ảnh */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setIsDraggingSplit(true);
                      }}
                      className="absolute top-0 bottom-0 w-9 -translate-x-1/2 z-30 cursor-ew-resize flex items-center justify-center group"
                      style={{ left: `${splitPercent}%` }}
                      title="Kéo sang trái / phải để gạt so sánh Trước & Sau xử lý"
                    >
                      <div className="w-1 h-full bg-emerald-600 group-hover:w-1.5 transition-all shadow-md" />
                      <div className="absolute top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-white transition-transform group-hover:scale-110">
                        <MoveHorizontal className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-white/95 border border-slate-300 text-xs font-bold text-slate-700 shadow-sm pointer-events-none">
                      TRƯỚC XỬ LÝ (GỐC)
                    </div>
                    <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-sm pointer-events-none">
                      SAU XỬ LÝ ({result.presetUsed})
                    </div>

                    {/* Thanh range phụ trợ bên dưới */}
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 bg-white/95 px-4 py-2 rounded-full border border-slate-300 shadow-lg flex items-center gap-3 w-72 sm:w-96"
                    >
                      <span className="text-[11px] font-bold text-slate-600">Gốc</span>
                      <input
                        type="range"
                        min={2}
                        max={98}
                        value={splitPercent}
                        onChange={(e) => setSplitPercent(Number(e.target.value))}
                        className="flex-1 accent-emerald-600 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-emerald-700">Làm nét</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* CHẾ ĐỘ 3: LẬT NHANH TRƯỚC / SAU KHÔNG XUNG ĐỘT KÉO PAN */
                <div className="relative w-full h-full flex items-center justify-center p-4">
                  <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-xl bg-white/95 border border-slate-300 shadow-sm text-xs font-bold pointer-events-none">
                    {isHoldingOriginal ? (
                      <span className="text-amber-700">
                        ĐANG XEM: ẢNH GỐC CHƯA XỬ LÝ (Nhả nút hoặc phím SPACE để xem ảnh đã xử lý)
                      </span>
                    ) : (
                      <span className="text-emerald-700">
                        ĐANG XEM: ẢNH ĐÃ XỬ LÝ (Kéo chuột để Pan • Giữ phím SPACE hoặc nút bên dưới để lật Ảnh Gốc)
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

                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsHoldingOriginal(true);
                    }}
                    onMouseUp={() => setIsHoldingOriginal(false)}
                    onMouseLeave={() => setIsHoldingOriginal(false)}
                    className={`absolute bottom-12 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-full font-bold text-xs border shadow-xl flex items-center gap-2 transition-all cursor-pointer ${
                      isHoldingOriginal
                        ? 'bg-amber-500 text-white border-amber-600 scale-105'
                        : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                    }`}
                  >
                    <Eye className="w-4 h-4 text-emerald-600" />
                    <span>
                      {isHoldingOriginal
                        ? 'Đang Hiển Thị Ảnh Gốc (Nhả Chuột Để Xem Ảnh Đã Xử Lý)'
                        : 'Nhấn Giữ Nút Này (Hoặc Phím SPACE) Để So Sánh Với Ảnh Gốc'}
                    </span>
                  </button>
                </div>
              )}

              {/* Chú thích hướng dẫn cuộn chuột dưới đáy */}
              {result && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-4 py-1 rounded-full bg-white/90 border border-slate-300 text-[11px] text-slate-600 shadow-sm pointer-events-none">
                  🖱️ <strong>Cuộn chuột</strong> phóng đại đồng bộ (tới 600%) • <strong>Kéo chuột</strong> di chuyển soi vạch thước mm • <strong>Giữ phím SPACE</strong> lật xem Ảnh Gốc
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
