/**
 * ============================================================================
 * FORENSIC IMAGE LAB SERVICE v2.1 (STANDALONE MODULE)
 * Chẩn đoán chất lượng ảnh hiện trường (Loại trừ vùng đóng dấu Watermark THACO REC
 * & Timestamp, Phát hiện Ngược sáng / Lóa sương / Nén JPEG mạnh) và Khôi phục
 * chi tiết trên kênh Độ chói L (Halo-Free & Wall-Clean Luminance DSP).
 *
 * Khắc phục 4 Nguyên nhân gốc rễ từ kiểm thử thực tế (2cededa0 & a6398c9b):
 * 1. Sửa dứt điểm lỗi tràn bộ đệm 1-Channel -> 3-Channel sau sharp.sharpen()
 *    bằng cách đọc đúng bước nhảy lumFinalInfo.channels (loại bỏ hoàn toàn lỗi
 *    sọc ngang interlacing và bóng ma chữ THACO).
 * 2. Loại trừ vùng đóng dấu Watermark Kỹ thuật số (22% đỉnh & 15% đáy) kèm
 *    kẹp biên độ ngoại lai (Trimmed Laplacian) để chữ THACO REC và khung gương
 *    không làm ảo điểm độ nét và không đánh lừa chế độ AUTO_SMART.
 * 3. Chống nổi hạt bẩn JPEG trên tường trắng & chống quầng sáng Halo quanh chữ:
 *    - Dùng lưới CLAHE kích thước lớn (96px - 160px) với độ dốc êm (maxSlope 2-3).
 *    - Đặt m1 = 0.0 và ngưỡng x1 thích nghi theo mật độ nén JPEG (5.5 - 7.5) để
 *      giữ mặt tường phẳng mịn sạch 100%, chỉ làm sắc nét biên cấu trúc thật.
 * 4. Toán tử Bottom-Hat có kiểm tra tính liên tục hướng tuyến tính (Anisotropic
 *    Linearity Gate): Chỉ làm đậm rãnh nứt kéo dài, bỏ qua hạt nhiễu khối JPEG.
 * ============================================================================
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { Database } from '../../database/db';
import { StorageService } from '../../common/services/storage.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors/problem-details';

export interface StudioCommitItemInput {
  originalUrl: string;
  currentUrl: string;
  enhancedBase64: string;
  photoCode?: string;
  title?: string;
  presetUsed: ImageLabPreset;
  appliedParams: ImageEnhancementParams;
}

export interface StudioCommittedPhotoInfo {
  originalUrl: string;
  previousUrl: string;
  enhancedUrl: string;
  photoCode: string;
  title: string;
  presetUsed: ImageLabPreset;
  appliedParams: ImageEnhancementParams;
  updatedAt: string;
  updatedBy: string;
}

export type ImageLabPreset =
  | 'AUTO_SMART'
  | 'CRACK_ENHANCE_V1'
  | 'CRACK_ENHANCE_V2'
  | 'CRACK_ENHANCE'
  | 'LOW_LIGHT_RESCUE'
  | 'CUSTOM';

export interface ImageEnhancementParams {
  enableClahe: boolean;
  claheTileSize: number;     // 16 - 256 (px)
  claheMaxSlope: number;     // 0 - 10 (clip limit trên kênh Độ chói L)
  gamma: number;             // 1.0 - 3.0 (cường độ nâng sáng vùng tối có bảo vệ vùng sáng)
  brightness: number;        // 0.5 - 2.0 (hệ số khuếch đại độ chói có nén mềm vùng cao quang)
  saturation: number;        // 0.0 - 2.0 (tỉ lệ bảo toàn sắc độ màu khi tái tạo sRGB)
  crackValleyBoost: number;  // 0.0 - 2.5 (hệ số làm đậm rãnh nứt bằng Hình thái học Bottom-Hat có lọc hướng)
  medianSize: number;        // 0, 3, 5 (khử nhiễu hạt ISO / ô vuông nén JPEG bảo toàn biên)
  sharpenSigma: number;      // 0.5 - 3.0 (bán kính tần số làm nét)
  sharpenFlatM1: number;     // 0.0 - 5.0 (độ nét vùng tường phẳng - mặc định 0.0 để tường mịn sạch)
  sharpenJaggedM2: number;   // 0.0 - 10.0 (độ nét tại biên cấu trúc, rãnh vết nứt & vạch thước đo)
  normalizeHistogram: boolean;
  invertNegative: boolean;
}

export interface ImageQualityMetrics {
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  meanLuminance: number;       // 0 - 255 (Đo trên vùng ROI sạch đã loại trừ Watermark)
  rmsContrast: number;         // Độ lệch chuẩn độ chói (0 - 128)
  darkPixelRatio: number;      // Tỷ lệ % pixel tối (< 55/255)
  brightPixelRatio: number;    // Tỷ lệ % pixel cháy sáng (> 235/255)
  laplacianVariance: number;   // Phương sai Laplacian Cấu trúc (Đã loại trừ Watermark & ngoại lai)
  edgeGradientScore: number;   // Cường độ biên Sobel Top-5% (Đo trên vùng ROI sạch)
  noiseSigma: number;          // Mức nhiễu nền / nhiễu nén JPEG ước lượng (sigma_n)
  cnrScore: number;            // Tỷ số Tương phản biên trên Nhiễu nền (Contrast-to-Noise Ratio)
  histogram: number[];         // Phân bố độ sáng 64-bin (% tổng số điểm ảnh ROI sạch)
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

export class ImageLabService {
  /**
   * Phân tích & Chẩn đoán chất lượng ảnh hiện trường (v2.1):
   * - Loại trừ vùng đóng dấu Watermark "THACO REC" (22% đỉnh) và Timestamp (15% đáy)
   *   để biên chữ kỹ thuật số không làm ảo chỉ số độ nét Laplacian và Sobel.
   * - Kẹp biên độ Laplacian ngoại lai (|lap| <= 140) để 1% viền khung gương/cửa sổ
   *   không che lấp độ mờ thực tế của 99% diện tích tường và nội thất.
   * - Phát hiện chính xác tình trạng Ngược sáng (Backlit) và Mờ nén JPEG (KB/MP thấp).
   */
  public static async analyzeImageQuality(
    buffer: Buffer,
    options?: { isNegativeInverted?: boolean }
  ): Promise<ImageQualityMetrics> {
    const metadata = await sharp(buffer).metadata();
    const origWidth = metadata.width || 0;
    const origHeight = metadata.height || 0;
    const format = metadata.format || 'jpeg';
    const sizeBytes = buffer.length;

    const { data, info } = await sharp(buffer)
      .rotate()
      .resize(768, 768, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const totalPixels = w * h;

    if (totalPixels === 0) {
      return {
        width: origWidth,
        height: origHeight,
        format,
        sizeBytes,
        meanLuminance: 0,
        rmsContrast: 0,
        darkPixelRatio: 0,
        brightPixelRatio: 0,
        laplacianVariance: 0,
        edgeGradientScore: 0,
        noiseSigma: 0,
        cnrScore: 0,
        histogram: new Array<number>(64).fill(0),
        blurStatus: 'CRITICAL_BLUR',
        exposureStatus: 'UNDEREXPOSED',
        overallVerdict: 'CRITICAL',
        warnings: ['Không thể giải mã dữ liệu điểm ảnh.'],
      };
    }

    // Vùng ROI sạch: Loại trừ 22% đỉnh (Logo THACO REC) và 15% đáy (Chữ Timestamp HCM_M2...)
    const startX = Math.max(1, Math.floor(w * 0.06));
    const endX = Math.min(w - 2, Math.ceil(w * 0.94));
    const startY = Math.max(1, Math.floor(h * 0.22));
    const endY = Math.min(h - 2, Math.ceil(h * 0.85));

    const roiWidth = Math.max(1, endX - startX + 1);
    const roiHeight = Math.max(1, endY - startY + 1);
    const roiPixels = roiWidth * roiHeight;

    let sumY = 0;
    let darkCount = 0;
    let shadowMidCount = 0;
    let brightCount = 0;
    const rawBins = new Uint32Array(64);

    const lapValues = new Float32Array(roiPixels);
    const absLapNonZeroHist = new Uint32Array(1025);
    let nonZeroLapCount = 0;
    const edgeHistogram = new Uint32Array(1445);

    let lapSum = 0;
    let idx = 0;

    for (let y = startY; y <= endY; y++) {
      const rowOffset = y * w;
      const prevRow = (y - 1) * w;
      const nextRow = (y + 1) * w;

      for (let x = startX; x <= endX; x++) {
        const center = data[rowOffset + x];
        sumY += center;
        if (center < 55) darkCount++;
        if (center < 85) shadowMidCount++;
        if (center > 230) brightCount++;
        rawBins[Math.min(63, center >> 2)]++;

        // Toán tử Laplacian 3x3
        const rawLap =
          data[prevRow + x] +
          data[nextRow + x] +
          data[rowOffset + x - 1] +
          data[rowOffset + x + 1] -
          4 * center;

        // Kẹp biên độ ngoại lai (Trimmed Laplacian |lap| <= 140) để viền chữ/khung gương đen trắng
        // không làm thổi phồng phương sai độ nét của toàn bộ mặt tường
        const trimmedLap = Math.max(-140, Math.min(140, rawLap));
        lapSum += trimmedLap;
        lapValues[idx++] = trimmedLap;

        const absLap = Math.min(1024, Math.abs(rawLap));
        if (absLap > 0) {
          absLapNonZeroHist[absLap]++;
          nonZeroLapCount++;
        }

        // Toán tử Sobel 3x3 (Kẹp trần 480 để không bị nhiễu bởi biên nhảy bậc tuyệt đối)
        const gx =
          -data[prevRow + x - 1] +
          data[prevRow + x + 1] -
          2 * data[rowOffset + x - 1] +
          2 * data[rowOffset + x + 1] -
          data[nextRow + x - 1] +
          data[nextRow + x + 1];

        const gy =
          -data[prevRow + x - 1] -
          2 * data[prevRow + x] -
          data[prevRow + x + 1] +
          data[nextRow + x - 1] +
          2 * data[nextRow + x] +
          data[nextRow + x + 1];

        const magBin = Math.min(520, Math.round(Math.sqrt(gx * gx + gy * gy)));
        edgeHistogram[magBin]++;
      }
    }

    const histogram = Array.from(rawBins, (count) =>
      Number(((count / roiPixels) * 100).toFixed(2))
    );

    const meanY = sumY / roiPixels;
    let sumSqDiff = 0;
    for (let y = startY; y <= endY; y++) {
      const rowOffset = y * w;
      for (let x = startX; x <= endX; x++) {
        const diff = data[rowOffset + x] - meanY;
        sumSqDiff += diff * diff;
      }
    }
    const rmsContrast = Math.sqrt(sumSqDiff / roiPixels);
    const darkPixelRatio = Number(((darkCount / roiPixels) * 100).toFixed(1));
    const shadowMidRatio = Number(((shadowMidCount / roiPixels) * 100).toFixed(1));
    const brightPixelRatio = Number(((brightCount / roiPixels) * 100).toFixed(1));

    // Ước lượng mức nhiễu cảm biến & nhiễu khối JPEG (Tính trên các pixel có biến thiên khác 0 để không bị 0-inflation của JPEG đánh lừa)
    let medianAbsLap = 3;
    if (nonZeroLapCount > 0) {
      const halfCount = Math.floor(nonZeroLapCount * 0.45);
      let cumulative = 0;
      for (let v = 1; v <= 1024; v++) {
        cumulative += absLapNonZeroHist[v];
        if (cumulative >= halfCount) {
          medianAbsLap = v;
          break;
        }
      }
    }

    // Mật độ dung lượng theo Megapixel gốc (Phát hiện ảnh bị nén JPEG/Zalo mạnh < 115 KB/MP)
    const origMp = Math.max(0.3, (origWidth * origHeight) / 1_000_000);
    const kbPerMp = (sizeBytes / 1024) / origMp;
    const compressionNoisePenalty = kbPerMp < 105 ? 1.15 : kbPerMp < 150 ? 0.65 : 0.0;

    const noiseSigma = Math.max(1.2, medianAbsLap / 3.0165 + compressionNoisePenalty);

    // Phương sai Laplacian cấu trúc (Trimmed & Noise-Compensated)
    let rawLapVariance = 0;
    if (roiPixels > 0) {
      const lapMean = lapSum / roiPixels;
      let lapSq = 0;
      for (let i = 0; i < roiPixels; i++) {
        const d = lapValues[i] - lapMean;
        lapSq += d * d;
      }
      rawLapVariance = lapSq / roiPixels;
    }
    const structuralLapVariance = Math.max(
      1.0,
      rawLapVariance - 10.0 * noiseSigma * noiseSigma
    );

    // Trung bình Top-5% biên Sobel trong vùng ROI sạch
    let edgeGradientScore = 0;
    if (roiPixels > 0) {
      const top5Target = Math.max(1, Math.floor(roiPixels * 0.05));
      let remaining = top5Target;
      let edgeSum = 0;
      for (let mag = 520; mag >= 0 && remaining > 0; mag--) {
        const count = edgeHistogram[mag];
        if (count > 0) {
          const take = Math.min(remaining, count);
          edgeSum += take * mag;
          remaining -= take;
        }
      }
      edgeGradientScore = edgeSum / top5Target;
    }

    const cnrScore = edgeGradientScore / Math.max(1.2, noiseSigma);

    // Phân loại trạng thái & Sinh cảnh báo sát thực tế hiện trường
    const warnings: string[] = [];
    const isNegative = Boolean(options?.isNegativeInverted);
    const isBacklit = darkPixelRatio >= 16 && brightPixelRatio >= 2.0;
    const isHeavyCompressed = kbPerMp < 110 && origWidth >= 1200;

    let blurStatus: ImageQualityMetrics['blurStatus'] = 'SHARP';
    if (structuralLapVariance < 85 || edgeGradientScore < 95) {
      blurStatus = 'CRITICAL_BLUR';
      warnings.push(
        `Ảnh bị mờ nhòe nặng (Độ nét vùng trung tâm: ${structuralLapVariance.toFixed(1)}). Chi tiết bề mặt và biên cấu trúc bị suy giảm mạnh.`
      );
    } else if (structuralLapVariance < 185 || edgeGradientScore < 165 || isHeavyCompressed) {
      blurStatus = 'MILD_BLUR';
      warnings.push(
        `Ảnh bị mềm nét / mất chi tiết bề mặt do nén JPEG mạnh (${kbPerMp.toFixed(0)} KB/MP, Độ nét: ${structuralLapVariance.toFixed(1)}). Đã kích hoạt chế độ làm nét biên sạch không gây hạt tường.`
      );
    }

    let exposureStatus: ImageQualityMetrics['exposureStatus'] = 'GOOD';
    if (!isNegative) {
      if (meanY < 82 || darkPixelRatio > 42) {
        exposureStatus = 'UNDEREXPOSED';
        warnings.push(
          `Ảnh thiếu sáng toàn cục (Độ sáng TB: ${meanY.toFixed(0)}/255, ${darkPixelRatio}% vùng tối).`
        );
      } else if (isBacklit || (darkPixelRatio >= 15 && shadowMidRatio >= 32)) {
        exposureStatus = 'UNDEREXPOSED';
        warnings.push(
          `Ảnh bị ngược sáng / lóa đèn cục bộ (${darkPixelRatio}% vùng sập tối, ${shadowMidRatio}% vùng khuất sáng). Hệ thống tự động nâng sáng vùng tối và bảo vệ vùng sáng cửa sổ/đèn.`
        );
      } else if (meanY > 218 || brightPixelRatio > 38) {
        exposureStatus = 'OVEREXPOSED';
        warnings.push(
          `Ảnh bị dư sáng / lóa đèn Flash (${brightPixelRatio}% điểm cháy sáng).`
        );
      } else if (rmsContrast < 30) {
        exposureStatus = 'LOW_CONTRAST';
        warnings.push(
          `Độ tương phản bề mặt thấp / mù sương (RMS Contrast: ${rmsContrast.toFixed(1)}).`
        );
      }
    }

    let overallVerdict: ImageQualityMetrics['overallVerdict'] = 'PASS';
    if (blurStatus === 'CRITICAL_BLUR' || (!isNegative && exposureStatus === 'UNDEREXPOSED' && meanY < 52)) {
      overallVerdict = 'CRITICAL';
    } else if (blurStatus !== 'SHARP' || exposureStatus !== 'GOOD') {
      overallVerdict = 'WARNING';
    }

    return {
      width: origWidth,
      height: origHeight,
      format,
      sizeBytes,
      meanLuminance: Number(meanY.toFixed(1)),
      rmsContrast: Number(rmsContrast.toFixed(1)),
      darkPixelRatio,
      brightPixelRatio,
      laplacianVariance: Number(structuralLapVariance.toFixed(1)),
      edgeGradientScore: Number(edgeGradientScore.toFixed(1)),
      noiseSigma: Number(noiseSigma.toFixed(2)),
      cnrScore: Number(cnrScore.toFixed(1)),
      histogram,
      blurStatus,
      exposureStatus,
      overallVerdict,
      warnings,
    };
  }

  /**
   * Xác định bộ tham số chuẩn theo từng Preset hoặc nội suy thông minh từ chỉ số ảnh gốc
   */
  public static resolveEnhancementParams(
    preset: ImageLabPreset,
    beforeMetrics: ImageQualityMetrics,
    customParams?: Partial<ImageEnhancementParams>
  ): ImageEnhancementParams {
    let params: ImageEnhancementParams = {
      enableClahe: true,
      claheTileSize: 160,
      claheMaxSlope: 2,
      gamma: 1.45,
      brightness: 1.05,
      saturation: 0.98,
      crackValleyBoost: 0.0,
      medianSize: 0,
      sharpenSigma: 1.15,
      sharpenFlatM1: 0.0,
      sharpenJaggedM2: 2.5,
      normalizeHistogram: true,
      invertNegative: false,
    };

    switch (preset) {
      case 'AUTO_SMART': {
        const isVeryDark = beforeMetrics.meanLuminance < 65 || beforeMetrics.darkPixelRatio > 55;
        const hasDarkShadows = beforeMetrics.meanLuminance < 115 || beforeMetrics.darkPixelRatio >= 15;
        const isBacklit = beforeMetrics.darkPixelRatio >= 15 && beforeMetrics.brightPixelRatio >= 1.5;

        params = {
          enableClahe: true,
          claheTileSize: 160,
          claheMaxSlope: 2,
          gamma: isVeryDark ? 2.05 : isBacklit ? 1.68 : hasDarkShadows ? 1.48 : 1.25,
          brightness: isVeryDark ? 1.14 : isBacklit ? 1.06 : 1.04,
          saturation: 0.98,
          crackValleyBoost: 0.0,
          medianSize: 0,
          sharpenSigma: 1.15,
          sharpenFlatM1: 0.0,
          sharpenJaggedM2: 2.4,
          normalizeHistogram: true,
          invertNegative: false,
        };
        break;
      }

      case 'CRACK_ENHANCE_V1': {
        // v1: Dịu nhẹ, tự nhiên, giữ tường & gờ chỉ phẳng mịn tuyệt đối, không rải điểm đen
        params = {
          enableClahe: true,
          claheTileSize: 128,
          claheMaxSlope: 2,
          gamma: beforeMetrics.meanLuminance < 110 || beforeMetrics.darkPixelRatio >= 15 ? 1.45 : 1.20,
          brightness: 1.04,
          saturation: 0.95,
          crackValleyBoost: 0.30,
          medianSize: 0,
          sharpenSigma: 1.10,
          sharpenFlatM1: 0.0,
          sharpenJaggedM2: 2.0,
          normalizeHistogram: true,
          invertNegative: false,
        };
        break;
      }

      case 'CRACK_ENHANCE_V2':
      case 'CRACK_ENHANCE': {
        // v2: Tương phản cao hơn cho vết nứt mảnh/mờ, đã khắc phục triệt để lỗi tự dao động Ziczac
        params = {
          enableClahe: true,
          claheTileSize: 96,
          claheMaxSlope: 3,
          gamma: beforeMetrics.meanLuminance < 110 || beforeMetrics.darkPixelRatio >= 15 ? 1.50 : 1.22,
          brightness: 1.05,
          saturation: 0.92,
          crackValleyBoost: 0.65,
          medianSize: 0,
          sharpenSigma: 1.20,
          sharpenFlatM1: 0.0,
          sharpenJaggedM2: 2.8,
          normalizeHistogram: true,
          invertNegative: false,
        };
        break;
      }

      case 'LOW_LIGHT_RESCUE': {
        // Cứu ảnh thiếu sáng sâu: Nâng sáng góc tối có khống chế đạo hàm chân tối & bảo vệ vùng sáng
        params = {
          enableClahe: true,
          claheTileSize: 160,
          claheMaxSlope: 2,
          gamma: 2.15,
          brightness: 1.15,
          saturation: 0.95,
          crackValleyBoost: 0.0,
          medianSize: 0,
          sharpenSigma: 1.15,
          sharpenFlatM1: 0.0,
          sharpenJaggedM2: 2.3,
          normalizeHistogram: true,
          invertNegative: false,
        };
        break;
      }

      case 'CUSTOM':
      default:
        break;
    }

    if (customParams) {
      params = {
        ...params,
        ...customParams,
      };
    }

    params.claheTileSize = Math.max(16, Math.min(256, Math.round(Number(params.claheTileSize) || 128)));
    params.claheMaxSlope = Math.max(0, Math.min(10, Math.round(Number(params.claheMaxSlope) ?? 2)));
    params.gamma = Math.max(1.0, Math.min(3.0, Number(params.gamma) || 1.0));
    params.brightness = Math.max(0.5, Math.min(2.5, Number(params.brightness) || 1.0));
    params.saturation = Math.max(0.0, Math.min(2.0, Number(params.saturation) ?? 0.95));
    params.crackValleyBoost = Math.max(0.0, Math.min(2.5, Number(params.crackValleyBoost) ?? 0.0));
    params.medianSize = [0, 3, 5].includes(Number(params.medianSize)) ? Number(params.medianSize) : 0;
    params.sharpenSigma = Math.max(0.3, Math.min(5.0, Number(params.sharpenSigma) || 1.15));
    params.sharpenFlatM1 = Math.max(0, Math.min(10, Number(params.sharpenFlatM1) ?? 0.0));
    params.sharpenJaggedM2 = Math.max(0, Math.min(15, Number(params.sharpenJaggedM2) ?? 2.5));

    return params;
  }

  /**
   * Bảng Tra Cứu Đường Cong Độ Chói Thông Minh (Shadow-Lift + Dehaze + Highlight Protection LUT):
   * - Kéo sáng vùng tối (rèm cửa, góc phòng, người) mượt mà với độ dốc chân tối hữu hạn (<= 3.1x).
   * - Khử lớp mờ sương (Dehaze) ở vùng trung tối giúp ảnh lóa đèn trần trong trẻo hơn.
   * - Bảo vệ vùng sáng cao quang (u > 0.60) để cửa sổ ngược sáng, nền tường trắng và thẻ thước đo không bị cháy/mất tương phản.
   */
  private static buildLuminanceToneCurveLut(
    lowClip: number,
    highClip: number,
    gamma: number,
    brightness: number,
    dehazeStrength: number
  ): Uint8Array {
    const lut = new Uint8Array(256);
    const span = Math.max(1, highClip - lowClip);
    const invGamma = 1.0 / Math.max(1.0, gamma);

    const uToe = 0.05;
    const baseMin = Math.pow(uToe, invGamma);
    const baseMax = Math.pow(1.0 + uToe, invGamma);
    const baseDenom = Math.max(1e-6, baseMax - baseMin);

    for (let v = 0; v < 256; v++) {
      let u = Math.max(0.0, Math.min(1.0, (v - lowClip) / span));

      // Khử mờ sương nhẹ (Dehaze) nếu ảnh bị lóa đèn trần
      if (dehazeStrength > 0.01) {
        const dehazed = Math.pow(u, 1.0 + dehazeStrength * 0.25);
        u = (1.0 - dehazeStrength) * u + dehazeStrength * dehazed;
      }

      // Nâng sáng vùng tối kèm trọng số bảo vệ vùng sáng bậc hai (Highlight Protection)
      let mapped = u;
      if (gamma > 1.005) {
        const shadowLifted = (Math.pow(u + uToe, invGamma) - baseMin) / baseDenom;
        const highlightProtect = Math.min(1.0, 0.55 * u * u);
        mapped = (1.0 - highlightProtect) * shadowLifted + highlightProtect * u;
      }

      // Khuếch đại sáng kèm nén vai sáng mượt (Soft-Shoulder Roll-off)
      let gained = mapped * brightness;
      if (gained > 0.80) {
        const excess = gained - 0.80;
        gained = 0.80 + 0.20 * (excess / (excess + 0.20));
      }

      lut[v] = Math.max(0, Math.min(255, Math.round(gained * 255.0)));
    }

    return lut;
  }

  /**
   * Phép toán Hình thái học Đáy Mũ Có Lọc Hướng Tuyến Tính (Anisotropic Morphological Bottom-Hat)
   * Khắc phục triệt để lỗi tự kích dao động Ziczac (\/\/\/\/) và rải chấm đen:
   * 1. Tuyệt đối không đọc mảng bị biến đổi in-place: Tạo bản sao origLum để toàn bộ
   *    phép kiểm tra lân cận 4 hướng đọc trên dữ liệu gốc bất biến.
   * 2. Sử dụng bản đồ độ sâu rãnh valleyMap trung gian kèm làm mượt khuếch tán 3x3
   *    giúp bờ rãnh nứt liền mạch, không bị đứt đoạn hay rải hạt đen.
   */
  private static applyMorphologicalBottomHatValleyBoost(
    lum: Uint8Array,
    width: number,
    height: number,
    radius: number,
    crackValleyBoost: number,
    noiseSigma: number
  ): void {
    if (crackValleyBoost <= 0.01 || width < 5 || height < 5) return;

    const total = width * height;
    const origLum = new Uint8Array(lum); // Bản sao bất biến: Khử 100% dao động Ziczac
    const temp = new Uint8Array(total);
    const closed = new Uint8Array(total);
    const r = Math.max(1, Math.min(2, radius));

    // Bước 1: Dilation khả tách (Ngang -> Dọc)
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        let maxVal = 0;
        const xStart = Math.max(0, x - r);
        const xEnd = Math.min(width - 1, x + r);
        for (let kx = xStart; kx <= xEnd; kx++) {
          const val = origLum[rowOffset + kx];
          if (val > maxVal) maxVal = val;
        }
        temp[rowOffset + x] = maxVal;
      }
    }

    for (let y = 0; y < height; y++) {
      const yStart = Math.max(0, y - r);
      const yEnd = Math.min(height - 1, y + r);
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        let maxVal = 0;
        for (let ky = yStart; ky <= yEnd; ky++) {
          const val = temp[ky * width + x];
          if (val > maxVal) maxVal = val;
        }
        closed[rowOffset + x] = maxVal;
      }
    }

    // Bước 2: Erosion khả tách -> Tạo ảnh Đóng (Closing L • B_r)
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        let minVal = 255;
        const xStart = Math.max(0, x - r);
        const xEnd = Math.min(width - 1, x + r);
        for (let kx = xStart; kx <= xEnd; kx++) {
          const val = closed[rowOffset + kx];
          if (val < minVal) minVal = val;
        }
        temp[rowOffset + x] = minVal;
      }
    }

    // Ngưỡng lọc nhiễu thích nghi theo độ nhiễu nền
    const noiseGate = Math.max(7.0, Math.min(18.0, 2.5 * noiseSigma));
    const rawValleyMap = new Float32Array(total);

    for (let y = 1; y < height - 1; y++) {
      const yStart = Math.max(0, y - r);
      const yEnd = Math.min(height - 1, y + r);
      const rowOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        let closedVal = 255;
        for (let ky = yStart; ky <= yEnd; ky++) {
          const val = temp[ky * width + x];
          if (val < closedVal) closedVal = val;
        }

        const idx = rowOffset + x;
        const origL = origLum[idx];
        const valleyDepth = closedVal - origL;

        if (valleyDepth > noiseGate) {
          // Kiểm tra tính liên kết tuyến tính trên bản sao origLum (không bị lệch pha bởi điểm lân cận bị trừ trước)
          const tol = Math.max(8, Math.round(valleyDepth * 0.65));
          const isHoriz =
            Math.abs(origLum[idx - 1] - origL) <= tol && Math.abs(origLum[idx + 1] - origL) <= tol;
          const isVert =
            Math.abs(origLum[idx - width] - origL) <= tol && Math.abs(origLum[idx + width] - origL) <= tol;
          const isDiag1 =
            Math.abs(origLum[idx - width - 1] - origL) <= tol &&
            Math.abs(origLum[idx + width + 1] - origL) <= tol;
          const isDiag2 =
            Math.abs(origLum[idx - width + 1] - origL) <= tol &&
            Math.abs(origLum[idx + width - 1] - origL) <= tol;

          if (isHoriz || isVert || isDiag1 || isDiag2) {
            rawValleyMap[idx] = Math.min(32, (valleyDepth - noiseGate) * crackValleyBoost);
          }
        }
      }
    }

    // Bước 3: Làm mượt nhẹ 3x3 trên bản đồ rãnh nứt trước khi trừ vào lum (khử tuyệt đối điểm đen rời rạc)
    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = rowOffset + x;
        const centerDepth = rawValleyMap[idx];
        if (centerDepth > 0) {
          // Lọc khuếch tán 3x3 làm êm bờ rãnh nứt
          const smoothedDepth =
            0.5 * centerDepth +
            0.125 * (rawValleyMap[idx - 1] + rawValleyMap[idx + 1] + rawValleyMap[idx - width] + rawValleyMap[idx + width]);
          lum[idx] = Math.max(0, Math.round(origLum[idx] - smoothedDepth));
        }
      }
    }
  }

  /**
   * Thực thi Pipeline xử lý ảnh trên kênh Độ chói L (Luminance) và trả về kết quả đối chứng Trước / Sau
   */
  public static async processAndCompare(
    inputBuffer: Buffer,
    preset: ImageLabPreset = 'AUTO_SMART',
    customParams?: Partial<ImageEnhancementParams>
  ): Promise<ImageLabProcessResult> {
    const startTime = Date.now();

    // 1. Chẩn đoán chất lượng ảnh gốc (trên vùng ROI sạch đã loại trừ Watermark)
    const beforeMetrics = await this.analyzeImageQuality(inputBuffer, { isNegativeInverted: false });

    // 2. Xác định bộ tham số xử lý
    const appliedParams = this.resolveEnhancementParams(preset, beforeMetrics, customParams);

    // 3. Chuẩn hóa ảnh gốc để hiển thị đối chứng
    const normalizedOriginalBuffer = await sharp(inputBuffer)
      .rotate()
      .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
      .toBuffer();

    // 4. Giải mã ma trận điểm ảnh sRGB 3 kênh
    let decodePipeline = sharp(inputBuffer)
      .rotate()
      .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .removeAlpha()
      .toColorspace('srgb');

    if (appliedParams.medianSize >= 3) {
      decodePipeline = decodePipeline.median(appliedParams.medianSize);
    }

    const { data: rgbBuffer, info: rgbInfo } = await decodePipeline
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = rgbInfo.width;
    const h = rgbInfo.height;
    const channels = rgbInfo.channels;
    const totalPixels = w * h;

    // 5. Tách kênh Độ chói L_orig và thống kê phân vị trên vùng ROI sạch (loại trừ Watermark)
    const lumOrig = new Uint8Array(totalPixels);
    const lumWork = new Uint8Array(totalPixels);
    const roiHist = new Uint32Array(256);

    const roiYMin = Math.floor(h * 0.22);
    const roiYMax = Math.floor(h * 0.85);
    const roiXMin = Math.floor(w * 0.06);
    const roiXMax = Math.floor(w * 0.94);
    let roiPixelCount = 0;

    for (let y = 0; y < h; y++) {
      const rowOff = y * w;
      const inRoiY = y >= roiYMin && y <= roiYMax;
      for (let x = 0; x < w; x++) {
        const i = rowOff + x;
        const offset = i * channels;
        const r = rgbBuffer[offset];
        const g = channels > 1 ? rgbBuffer[offset + 1] : r;
        const b = channels > 2 ? rgbBuffer[offset + 2] : r;
        const luma = (77 * r + 150 * g + 29 * b + 128) >> 8;
        lumOrig[i] = luma;
        lumWork[i] = luma;
        if (inRoiY && x >= roiXMin && x <= roiXMax) {
          roiHist[luma]++;
          roiPixelCount++;
        }
      }
    }

    // 6. Tính phân vị P1% và P99.5% trên vùng ROI sạch (để chữ trắng/viền đen của Watermark không làm lệch điểm cắt)
    let lowClip = 0;
    let highClip = 255;
    if (appliedParams.normalizeHistogram && roiPixelCount > 0) {
      const p1Target = Math.floor(roiPixelCount * 0.01);
      const p995Target = Math.floor(roiPixelCount * 0.995);
      let acc = 0;
      for (let v = 0; v < 256; v++) {
        acc += roiHist[v];
        if (acc >= p1Target) {
          lowClip = Math.min(20, Math.floor(v * 0.75));
          break;
        }
      }
      acc = 0;
      for (let v = 0; v < 256; v++) {
        acc += roiHist[v];
        if (acc >= p995Target) {
          highClip = Math.max(238, Math.max(lowClip + 40, v));
          break;
        }
      }
    }

    // 7. Ánh xạ Đường cong Độ chói (Shadow Lift + Dehaze + Highlight Protection)
    const dehazeStrength =
      beforeMetrics.brightPixelRatio < 5.0 && beforeMetrics.meanLuminance > 105 ? 0.25 : 0.12;

    if (
      appliedParams.normalizeHistogram ||
      appliedParams.gamma > 1.005 ||
      Math.abs(appliedParams.brightness - 1.0) > 0.005
    ) {
      const toneLut = this.buildLuminanceToneCurveLut(
        lowClip,
        highClip,
        appliedParams.gamma,
        appliedParams.brightness,
        dehazeStrength
      );
      for (let i = 0; i < totalPixels; i++) {
        lumWork[i] = toneLut[lumWork[i]];
      }
    }

    // 8. Thực thi Toán tử Hình thái học Đáy Mũ có lọc hướng tuyến tính (nếu bật crackValleyBoost > 0)
    if (appliedParams.crackValleyBoost > 0.01) {
      const morphRadius = Math.max(w, h) >= 1200 ? 2 : 1;
      const shadowGainEstimate = Math.max(1.0, appliedParams.gamma * 0.75);
      this.applyMorphologicalBottomHatValleyBoost(
        lumWork,
        w,
        h,
        morphRadius,
        appliedParams.crackValleyBoost,
        beforeMetrics.noiseSigma * shadowGainEstimate
      );
    }

    // 9. Chạy CLAHE & Adaptive Unsharp Masking trên kênh Độ chói L
    let lumPipeline = sharp(Buffer.from(lumWork.buffer, lumWork.byteOffset, lumWork.byteLength), {
      raw: { width: w, height: h, channels: 1 },
    });

    if (appliedParams.enableClahe && appliedParams.claheMaxSlope > 0) {
      lumPipeline = lumPipeline.clahe({
        width: appliedParams.claheTileSize,
        height: appliedParams.claheTileSize,
        maxSlope: appliedParams.claheMaxSlope,
      });
    }

    if (appliedParams.sharpenFlatM1 > 0 || appliedParams.sharpenJaggedM2 > 0) {
      // Ngưỡng x1 thích nghi: Đảm bảo cao hơn biên độ khối nén JPEG 8x8 (x1 >= 5.5) để không làm bẩn tường phẳng
      const minCleanX1 =
        preset === 'CRACK_ENHANCE_V1' || preset === 'CRACK_ENHANCE_V2' || preset === 'CRACK_ENHANCE' ? 5.5 : 6.8;
      const adaptiveX1 = Math.max(
        minCleanX1,
        Math.min(16.0, Number((2.5 * beforeMetrics.noiseSigma).toFixed(2)))
      );

      lumPipeline = lumPipeline.sharpen({
        sigma: appliedParams.sharpenSigma,
        m1: appliedParams.sharpenFlatM1,
        m2: appliedParams.sharpenJaggedM2,
        x1: adaptiveX1,
        y2: 8.0,
        y3: 12.0,
      });
    }

    if (appliedParams.invertNegative) {
      lumPipeline = lumPipeline.negate({ alpha: false });
    }

    // [CRITICAL FIX]: vips_sharpen tự động trả về 3 kênh sRGB dù đầu vào là 1 kênh.
    // Phải đọc info.channels và lấy đúng bước nhảy lumChannels để tránh lỗi sọc ngang & bóng ma chữ THACO!
    const { data: lumFinalRaw, info: lumFinalInfo } = await lumPipeline
      .raw()
      .toBuffer({ resolveWithObject: true });
    const lumChannels = lumFinalInfo.channels || 1;

    // 10. Tái tạo Không gian màu sRGB Bảo toàn Sắc độ Gốc (Chrominance-Preserving Reconstruction)
    const outRgbBuffer = Buffer.allocUnsafe(totalPixels * 3);
    const isMonochromeMode = appliedParams.invertNegative || appliedParams.saturation <= 0.03;

    if (isMonochromeMode) {
      for (let i = 0; i < totalPixels; i++) {
        const yFinal = lumFinalRaw[i * lumChannels];
        const outOffset = i * 3;
        outRgbBuffer[outOffset] = yFinal;
        outRgbBuffer[outOffset + 1] = yFinal;
        outRgbBuffer[outOffset + 2] = yFinal;
      }
    } else {
      const userSat = appliedParams.saturation;
      for (let i = 0; i < totalPixels; i++) {
        const yOrig = lumOrig[i];
        const yFinal = lumFinalRaw[i * lumChannels];
        const inOffset = i * channels;
        const outOffset = i * 3;

        const rOrig = rgbBuffer[inOffset];
        const gOrig = channels > 1 ? rgbBuffer[inOffset + 1] : rOrig;
        const bOrig = channels > 2 ? rgbBuffer[inOffset + 2] : rOrig;

        // Kẹp trần hệ số nhân màu ở vùng tối sâu (<= 2.4x) để không làm bệt màu quần áo/rèm cửa
        const lumRatio = Math.min(2.4, (yFinal + 1.0) / (yOrig + 1.0));
        const shadowChromaDamp = yOrig < 24 ? (yOrig + 8.0) / 32.0 : 1.0;
        const effectiveSat = userSat * shadowChromaDamp;

        const rScaled = rOrig * lumRatio;
        const gScaled = gOrig * lumRatio;
        const bScaled = bOrig * lumRatio;

        const rOut = yFinal + effectiveSat * (rScaled - yFinal);
        const gOut = yFinal + effectiveSat * (gScaled - yFinal);
        const bOut = yFinal + effectiveSat * (bScaled - yFinal);

        outRgbBuffer[outOffset] = rOut <= 0 ? 0 : rOut >= 255 ? 255 : Math.round(rOut);
        outRgbBuffer[outOffset + 1] = gOut <= 0 ? 0 : gOut >= 255 ? 255 : Math.round(gOut);
        outRgbBuffer[outOffset + 2] = bOut <= 0 ? 0 : bOut >= 255 ? 255 : Math.round(bOut);
      }
    }

    // 11. Xuất ảnh chất lượng pháp lý cao nhất (Chroma Subsampling 4:4:4 chống nhòe biên)
    const enhancedBuffer = await sharp(outRgbBuffer, {
      raw: { width: w, height: h, channels: 3 },
    })
      .jpeg({
        quality: 95,
        chromaSubsampling: '4:4:4',
        mozjpeg: true,
      })
      .toBuffer();

    // 12. Chẩn đoán lại chất lượng ảnh sau xử lý
    const afterMetrics = await this.analyzeImageQuality(enhancedBuffer, {
      isNegativeInverted: appliedParams.invertNegative,
    });
    const processingTimeMs = Date.now() - startTime;

    const sharpnessGainPercent =
      beforeMetrics.laplacianVariance > 0
        ? Math.round(
            ((afterMetrics.laplacianVariance - beforeMetrics.laplacianVariance) /
              beforeMetrics.laplacianVariance) *
              100
          )
        : 0;

    const edgeGainPercent =
      beforeMetrics.edgeGradientScore > 0
        ? Math.round(
            ((afterMetrics.edgeGradientScore - beforeMetrics.edgeGradientScore) /
              beforeMetrics.edgeGradientScore) *
              100
          )
        : 0;

    const contrastGainPercent =
      beforeMetrics.rmsContrast > 0
        ? Math.round(
            ((afterMetrics.rmsContrast - beforeMetrics.rmsContrast) / beforeMetrics.rmsContrast) * 100
          )
        : 0;

    const cnrGainPercent =
      beforeMetrics.cnrScore > 0
        ? Math.round(((afterMetrics.cnrScore - beforeMetrics.cnrScore) / beforeMetrics.cnrScore) * 100)
        : 0;

    const brightnessDelta = Number((afterMetrics.meanLuminance - beforeMetrics.meanLuminance).toFixed(1));

    return {
      originalPreviewBase64: `data:image/jpeg;base64,${normalizedOriginalBuffer.toString('base64')}`,
      enhancedPreviewBase64: `data:image/jpeg;base64,${enhancedBuffer.toString('base64')}`,
      beforeMetrics,
      afterMetrics,
      presetUsed: preset,
      appliedParams,
      processingTimeMs,
      improvementSummary: {
        sharpnessGainPercent,
        edgeGainPercent,
        contrastGainPercent,
        brightnessDelta,
        cnrGainPercent,
      },
    };
  }

  /**
   * Kiểm tra hostname có phải dải IP nội bộ / Loopback để chống SSRF
   */
  private static isBlockedInternalHost(hostname: string): boolean {
    const h = hostname.toLowerCase().trim();
    if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1' || h === '[::1]') {
      return true;
    }
    if (
      h.startsWith('10.') ||
      h.startsWith('192.168.') ||
      h.startsWith('169.254.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)
    ) {
      return true;
    }
    return false;
  }

  /**
   * Nạp Buffer ảnh từ URL (Hỗ trợ cả đường dẫn cục bộ /uploads/... và URL Cloudflare R2 https://...)
   */
  public static async resolveBufferFromUrl(imageUrl: string): Promise<Buffer> {
    const trimmed = imageUrl.trim();
    if (trimmed.startsWith('data:image/')) {
      const commaIdx = trimmed.indexOf(',');
      if (commaIdx === -1) throw new Error('Chuỗi Base64 Data URI không hợp lệ.');
      return Buffer.from(trimmed.slice(commaIdx + 1), 'base64');
    }

    if (trimmed.includes('/uploads/') || trimmed.startsWith('uploads/')) {
      const rawRel = trimmed.replace(/^.*?\/uploads\//, '').replace(/^uploads\//, '').split('?')[0];
      const normalizedSubPath = path.normalize(rawRel).replace(/^(\.\.(\/|\\|$))+/, '');

      const uploadRoots = [
        path.resolve(process.cwd(), 'uploads'),
        path.resolve(process.cwd(), 'backend', 'uploads'),
        path.resolve(process.cwd(), '..', 'uploads'),
      ];

      for (const rootDir of uploadRoots) {
        const candidatePath = path.resolve(rootDir, normalizedSubPath);
        if (candidatePath.startsWith(rootDir + path.sep) && fs.existsSync(candidatePath)) {
          return fs.readFileSync(candidatePath);
        }
      }
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const parsedUrl = new URL(trimmed);
      const allowedPublicUrl = process.env.PUBLIC_APP_URL || '';
      const isConfiguredHost =
        allowedPublicUrl.length > 0 && trimmed.startsWith(allowedPublicUrl);

      if (!isConfiguredHost && this.isBlockedInternalHost(parsedUrl.hostname)) {
        throw new Error('Từ chối truy cập địa chỉ mạng nội bộ (SSRF Protection).');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(trimmed, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Không thể tải ảnh từ URL (HTTP ${res.status})`);
        }
        const arr = await res.arrayBuffer();
        return Buffer.from(arr);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw new Error('Đường dẫn ảnh không hợp lệ hoặc không tìm thấy file.');
  }

  /**
   * Đệ quy thay thế đường dẫn ảnh cũ bằng đường dẫn ảnh Studio mới trong cây JSON,
   * ngoại trừ các nhánh lưu trữ đối chiếu gốc (studioEnhancedPhotos & studioEnhancedByOriginal).
   */
  private static deepReplaceUrlInJson(
    node: unknown,
    urlMap: Map<string, string>,
    skipKeys: Set<string> = new Set(['studioEnhancedPhotos', 'studioEnhancedByOriginal'])
  ): unknown {
    if (typeof node === 'string') {
      const trimmed = node.trim();
      if (urlMap.has(trimmed)) {
        return urlMap.get(trimmed)!;
      }
      if (urlMap.has(node)) {
        return urlMap.get(node)!;
      }
      return node;
    }
    if (Array.isArray(node)) {
      return node.map((item) => this.deepReplaceUrlInJson(item, urlMap, skipKeys));
    }
    if (node !== null && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (skipKeys.has(k)) {
          out[k] = v;
        } else {
          out[k] = this.deepReplaceUrlInJson(v, urlMap, skipKeys);
        }
      }
      return out;
    }
    return node;
  }

  /**
   * Lưu chính thức các ảnh đã điều chỉnh từ Studio Img cho phiên thẩm định:
   * - Tạo file ảnh mới hoàn toàn độc lập với ảnh gốc KSV (lưu vào thư mục studio-img)
   * - Bảo toàn 100% ảnh gốc KSV và ánh xạ originalUrl <-> enhancedUrl
   * - Cập nhật phiên thẩm định hiện tại & đồng bộ cho xuất Báo cáo PDF
   */
  public static async commitStudioSession(
    reportId: string,
    adminId: string,
    items: StudioCommitItemInput[],
    clientIp?: string
  ): Promise<{
    reportId: string;
    committedItems: StudioCommittedPhotoInfo[];
    studioEnhancedPhotos: Record<string, StudioCommittedPhotoInfo>;
    studioEnhancedByOriginal: Record<string, string>;
  }> {
    if (!reportId || !reportId.trim()) {
      throw new BadRequestError('Thiếu mã hồ sơ thẩm định (reportId).');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestError('Chưa có ảnh nào được điều chỉnh để lưu trong Studio Img.');
    }

    const repRes = await Database.query<{
      id: string;
      parcel_id: string;
      status: string;
      surveyor_id: string | null;
      survey_data_json: Record<string, unknown> | string | null;
    }>(
      `SELECT id, parcel_id, status, surveyor_id, survey_data_json
       FROM base_survey_reports
       WHERE (id::text = $1 OR parcel_id::text = $1) AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1;`,
      [reportId.trim()]
    );

    if (!repRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với mã: ${reportId}`);
    }

    const report = repRes.rows[0];
    if (String(report.status || '').toUpperCase() === 'APPROVED') {
      throw new ForbiddenError('Hồ sơ đã được phê duyệt chính thức và khóa bất biến, không thể lưu ảnh Studio mới.');
    }

    const actualReportId = report.id;
    const existingJson: Record<string, unknown> =
      typeof report.survey_data_json === 'string'
        ? (JSON.parse(report.survey_data_json || '{}') as Record<string, unknown>)
        : { ...(report.survey_data_json || {}) };

    // Khởi tạo phiên bản gốc v0 nếu chưa có trước khi ghi nhận ảnh Studio
    try {
      const verCountRes = await Database.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM survey_report_versions WHERE report_id = $1;`,
        [actualReportId]
      );
      if (Number(verCountRes.rows[0]?.count || 0) === 0) {
        const { AuditVersionService } = await import('../audit/services/audit-version.service');
        await AuditVersionService.createSnapshot(actualReportId, {
          versionTag: 'ORIGINAL_SUBMISSION',
          title: 'Bản nộp thực địa ban đầu',
          editReason: 'Khởi tạo phiên bản cơ sở tự động trước khi lưu Studio Img lần đầu (Auto-Seed Baseline v0)',
          userId: report.surveyor_id || adminId,
        });
      }
    } catch (seedErr: unknown) {
      console.warn('[ImageLabService.commitStudioSession] Bỏ qua seed v0:', seedErr);
    }

    const existingEnhancedMap =
      existingJson.studioEnhancedPhotos && typeof existingJson.studioEnhancedPhotos === 'object'
        ? { ...(existingJson.studioEnhancedPhotos as Record<string, StudioCommittedPhotoInfo>) }
        : {};
    const existingByOriginalMap =
      existingJson.studioEnhancedByOriginal && typeof existingJson.studioEnhancedByOriginal === 'object'
        ? { ...(existingJson.studioEnhancedByOriginal as Record<string, string>) }
        : {};

    const nowIso = new Date().toISOString();
    const committedItems: StudioCommittedPhotoInfo[] = [];
    const urlReplaceMap = new Map<string, string>();
    const diffSummary: Array<{ field: string; label: string; oldValue: string; newValue: string }> = [];

    // 1. Tạo file ảnh mới riêng biệt cho từng bức ảnh đã chỉnh trong Studio Img
    for (const item of items) {
      if (!item.enhancedBase64 || !item.enhancedBase64.startsWith('data:image/')) {
        continue;
      }
      const rawCurrentUrl = (item.currentUrl || item.originalUrl || '').trim();
      const rawOriginalUrl = (item.originalUrl || rawCurrentUrl).trim();
      if (!rawCurrentUrl) continue;

      // Nếu ảnh trước đó đã từng qua Studio, truy ngược về URL gốc KSV thực sự
      const priorInfo = existingEnhancedMap[rawCurrentUrl] || existingEnhancedMap[rawOriginalUrl];
      const trueOriginalKsvUrl = priorInfo?.originalUrl || rawOriginalUrl;

      const safeCode = (item.photoCode || 'photo').replace(/[^a-zA-Z0-9_-]/g, '_');
      const uploadRes = await StorageService.uploadBase64(
        item.enhancedBase64,
        `studio_${safeCode}`,
        'studio-img',
        {
          reportId: actualReportId,
          originalKsvUrl: trueOriginalKsvUrl,
          presetUsed: item.presetUsed,
          source: 'AUDIT_STUDIO_IMG',
        }
      );

      const newEnhancedUrl = uploadRes.url;
      const info: StudioCommittedPhotoInfo = {
        originalUrl: trueOriginalKsvUrl,
        previousUrl: rawCurrentUrl,
        enhancedUrl: newEnhancedUrl,
        photoCode: item.photoCode || 'STUDIO_IMG',
        title: item.title || item.photoCode || 'Ảnh hiệu chỉnh Studio',
        presetUsed: item.presetUsed,
        appliedParams: item.appliedParams,
        updatedAt: nowIso,
        updatedBy: adminId,
      };

      committedItems.push(info);
      existingEnhancedMap[newEnhancedUrl] = info;
      existingByOriginalMap[trueOriginalKsvUrl] = newEnhancedUrl;
      existingByOriginalMap[rawCurrentUrl] = newEnhancedUrl;

      urlReplaceMap.set(rawCurrentUrl, newEnhancedUrl);
      urlReplaceMap.set(trueOriginalKsvUrl, newEnhancedUrl);

      diffSummary.push({
        field: `studio_img_${safeCode}`,
        label: `[Studio Img • ${item.presetUsed}] ${info.title}`,
        oldValue: trueOriginalKsvUrl,
        newValue: newEnhancedUrl,
      });
    }

    if (committedItems.length === 0) {
      throw new BadRequestError('Không có dữ liệu ảnh hợp lệ để tạo mới.');
    }

    // 2. Cập nhật survey_data_json và các bảng quan hệ trong Transaction
    const updatedSurveyJson = this.deepReplaceUrlInJson(existingJson, urlReplaceMap) as Record<string, unknown>;
    updatedSurveyJson.studioEnhancedPhotos = existingEnhancedMap;
    updatedSurveyJson.studioEnhancedByOriginal = existingByOriginalMap;

    await Database.transaction(async (client) => {
      await client.query(
        `UPDATE base_survey_reports SET survey_data_json = $1, updated_at = NOW() WHERE id = $2;`,
        [JSON.stringify(updatedSurveyJson), actualReportId]
      );

      for (const committed of committedItems) {
        const targetUrls = Array.from(new Set([committed.originalUrl, committed.previousUrl].filter(Boolean)));
        if (targetUrls.length === 0) continue;

        // 2.1. Đồng bộ bảng survey_identification_photos
        await client.query(
          `UPDATE survey_identification_photos
           SET raw_photo_url = CASE WHEN raw_photo_url = ANY($2::text[]) THEN $1 ELSE raw_photo_url END,
               annotated_photo_url = CASE WHEN annotated_photo_url = ANY($2::text[]) THEN $1 ELSE annotated_photo_url END
           WHERE report_id = $3
             AND (raw_photo_url = ANY($2::text[]) OR annotated_photo_url = ANY($2::text[]));`,
          [committed.enhancedUrl, targetUrls, actualReportId]
        );

        // 2.2. Đồng bộ bảng damage_zones (CTX photos)
        await client.query(
          `UPDATE damage_zones
           SET ctx_photo_url = $1
           WHERE report_id = $3 AND ctx_photo_url = ANY($2::text[]);`,
          [committed.enhancedUrl, targetUrls, actualReportId]
        );

        // 2.3. Đồng bộ bảng defect_items (CU photos + cu_photos_json)
        const matchingDefects = await client.query<{
          id: string;
          cu_photo_url: string | null;
          extra_photo_url: string | null;
          cu_photos_json: unknown;
        }>(
          `SELECT d.id, d.cu_photo_url, d.extra_photo_url, d.cu_photos_json
           FROM defect_items d
           INNER JOIN damage_zones z ON z.id = d.zone_id
           WHERE z.report_id = $1;`,
          [actualReportId]
        );

        for (const dRow of matchingDefects.rows) {
          let changed = false;
          let nextCuUrl = dRow.cu_photo_url;
          let nextExtraUrl = dRow.extra_photo_url;
          let nextCuList = Array.isArray(dRow.cu_photos_json) ? [...dRow.cu_photos_json] : null;

          if (nextCuUrl && targetUrls.includes(nextCuUrl.trim())) {
            nextCuUrl = committed.enhancedUrl;
            changed = true;
          }
          if (nextExtraUrl && targetUrls.includes(nextExtraUrl.trim())) {
            nextExtraUrl = committed.enhancedUrl;
            changed = true;
          }
          if (nextCuList) {
            nextCuList = nextCuList.map((entry: unknown) => {
              if (typeof entry === 'string' && targetUrls.includes(entry.trim())) {
                changed = true;
                return committed.enhancedUrl;
              }
              if (entry && typeof entry === 'object' && 'url' in entry) {
                const u = String((entry as { url?: unknown }).url || '').trim();
                if (targetUrls.includes(u)) {
                  changed = true;
                  return { ...(entry as Record<string, unknown>), url: committed.enhancedUrl };
                }
              }
              return entry;
            });
          }

          if (changed) {
            await client.query(
              `UPDATE defect_items
               SET cu_photo_url = $1,
                   extra_photo_url = $2,
                   cu_photos_json = COALESCE($3::jsonb, cu_photos_json)
               WHERE id = $4;`,
              [
                nextCuUrl,
                nextExtraUrl,
                nextCuList ? JSON.stringify(nextCuList) : null,
                dRow.id,
              ]
            );
          }
        }

        // 2.4. Đồng bộ bảng deformation_assessments (nếu có ảnh lún/nghiêng)
        const defRes = await client.query<{
          diff_settlement_photos_json: unknown;
          tilt_photos_json: unknown;
          abnormal_photos_json: unknown;
        }>(
          `SELECT diff_settlement_photos_json, tilt_photos_json, abnormal_photos_json
           FROM deformation_assessments
           WHERE report_id = $1;`,
          [actualReportId]
        );
        if (defRes.rows[0]) {
          const singleMap = new Map<string, string>();
          for (const tUrl of targetUrls) singleMap.set(tUrl, committed.enhancedUrl);
          const nextDiffJson = this.deepReplaceUrlInJson(defRes.rows[0].diff_settlement_photos_json, singleMap);
          const nextTiltJson = this.deepReplaceUrlInJson(defRes.rows[0].tilt_photos_json, singleMap);
          const nextAbnJson = this.deepReplaceUrlInJson(defRes.rows[0].abnormal_photos_json, singleMap);
          await client.query(
            `UPDATE deformation_assessments
             SET diff_settlement_photos_json = COALESCE($1::jsonb, diff_settlement_photos_json),
                 tilt_photos_json = COALESCE($2::jsonb, tilt_photos_json),
                 abnormal_photos_json = COALESCE($3::jsonb, abnormal_photos_json)
             WHERE report_id = $4;`,
            [
              nextDiffJson ? JSON.stringify(nextDiffJson) : null,
              nextTiltJson ? JSON.stringify(nextTiltJson) : null,
              nextAbnJson ? JSON.stringify(nextAbnJson) : null,
              actualReportId,
            ]
          );
        }
      }

      // 2.5. Ghi nhật ký kiểm toán Append-Only
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'BASE_SURVEY_REPORT',
          actualReportId,
          'STUDIO_IMG_ENHANCE',
          adminId,
          JSON.stringify({
            editReason: `Hiệu chỉnh ${committedItems.length} ảnh hiện trường qua Studio Img (Lưu bản mới độc lập với ảnh gốc KSV)`,
            committedCount: committedItems.length,
            items: committedItems,
            timestamp: nowIso,
          }),
          clientIp || null,
        ]
      );
    });

    // 3. Tạo Snapshot phiên bản thẩm định mới
    try {
      const { AuditVersionService } = await import('../audit/services/audit-version.service');
      await AuditVersionService.createSnapshot(actualReportId, {
        versionTag: 'ADMIN_DIFF_SAVE',
        title: `Studio Img: Hiệu chỉnh chất lượng ${committedItems.length} ảnh hiện trường`,
        editReason: `Tạo bản ảnh hiệu chỉnh Studio Img cho ${committedItems.length} ảnh (${committedItems.map((i) => i.photoCode).join(', ')})`,
        userId: adminId,
        clientIp: clientIp || '127.0.0.1',
        diffSummary,
      });
    } catch (snapErr: unknown) {
      console.warn('[ImageLabService.commitStudioSession] Không thể tạo version snapshot:', snapErr);
    }

    return {
      reportId: actualReportId,
      committedItems,
      studioEnhancedPhotos: existingEnhancedMap,
      studioEnhancedByOriginal: existingByOriginalMap,
    };
  }
}
