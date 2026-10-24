/**
 * ============================================================================
 * FORENSIC IMAGE LAB SERVICE (STANDALONE MODULE)
 * Chẩn đoán chất lượng ảnh hiện trường (Độ mờ Laplacian, Độ sáng, Tương phản)
 * và Tăng cường độ nét chi tiết & vết nứt bằng C++ libvips (Sharp).
 *
 * Tính chất kiến trúc:
 * - Độc lập 100% (Zero-Coupling): Không can thiệp vào luồng Mobile của KSV.
 * - Toán học xác định (Deterministic Signal Processing): Không dùng GAN/Diffusion
 *   sinh chi tiết giả, bảo toàn tuyệt đối hình học vết nứt và vạch thước đo mm.
 * ============================================================================
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

export type ImageLabPreset =
  | 'AUTO_SMART'
  | 'CRACK_ENHANCE'
  | 'LOW_LIGHT_RESCUE'
  | 'DEBLOCK_COMPRESSION'
  | 'XRAY_NEGATIVE'
  | 'CUSTOM';

export interface ImageEnhancementParams {
  enableClahe: boolean;
  claheTileSize: number;     // 16 - 128 (px)
  claheMaxSlope: number;     // 1 - 10 (clip limit)
  gamma: number;             // 1.0 - 3.0 (bù sáng phi tuyến vùng tối)
  brightness: number;        // 0.5 - 2.0 (hệ số nhân độ chói)
  saturation: number;        // 0.0 - 2.0 (độ bão hòa màu; giảm nhẹ giúp nổi vết nứt đen trắng)
  medianSize: number;        // 0, 3, 5 (khử nhiễu hạt ISO / ô vuông nén JPEG bảo toàn biên)
  sharpenSigma: number;      // 0.5 - 3.0 (bán kính tần số làm nét)
  sharpenFlatM1: number;     // 0.0 - 5.0 (độ nét vùng tường phẳng - giữ thấp để tránh nổi nhiễu)
  sharpenJaggedM2: number;   // 0.0 - 10.0 (độ nét tại rãnh vết nứt & vạch thước đo)
  normalizeHistogram: boolean;
  invertNegative: boolean;
}

export interface ImageQualityMetrics {
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  meanLuminance: number;       // 0 - 255
  rmsContrast: number;         // Độ lệch chuẩn độ chói (0 - 128)
  darkPixelRatio: number;      // Tỷ lệ % pixel tối (< 50/255)
  brightPixelRatio: number;    // Tỷ lệ % pixel cháy sáng (> 245/255)
  laplacianVariance: number;   // Phương sai đạo hàm bậc 2 Laplacian (Đo độ nét)
  edgeGradientScore: number;   // Cường độ biên Sobel Top-15% (Đo độ sắc cạnh vết nứt/thước đo)
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

export class ImageLabService {
  /**
   * Phân tích & Chẩn đoán chất lượng ảnh hiện trường cho Thẩm định viên
   * Thực thi trên mẫu chuẩn hóa 384x384 (Tập trung vùng trung tâm nơi đặt thước đo & vết nứt)
   */
  public static async analyzeImageQuality(buffer: Buffer): Promise<ImageQualityMetrics> {
    const metadata = await sharp(buffer).metadata();
    const origWidth = metadata.width || 0;
    const origHeight = metadata.height || 0;
    const format = metadata.format || 'jpeg';
    const sizeBytes = buffer.length;

    // Chuẩn hóa về kích thước phân tích cố định (384px) để điểm Laplacian không bị lệch theo độ phân giải máy ảnh
    const { data, info } = await sharp(buffer)
      .rotate() // Tự động xoay theo EXIF
      .resize(384, 384, { fit: 'inside', withoutEnlargement: false, kernel: 'lanczos3' })
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
        blurStatus: 'CRITICAL_BLUR',
        exposureStatus: 'UNDEREXPOSED',
        overallVerdict: 'CRITICAL',
        warnings: ['Không thể giải mã dữ liệu điểm ảnh.'],
      };
    }

    // 1. Tính thống kê độ sáng & tương phản toàn khung
    let sumY = 0;
    let darkCount = 0;
    let brightCount = 0;

    for (let i = 0; i < totalPixels; i++) {
      const y = data[i];
      sumY += y;
      if (y < 50) darkCount++;
      if (y > 245) brightCount++;
    }

    const meanY = sumY / totalPixels;
    let sumSqDiff = 0;
    for (let i = 0; i < totalPixels; i++) {
      const diff = data[i] - meanY;
      sumSqDiff += diff * diff;
    }
    const rmsContrast = Math.sqrt(sumSqDiff / totalPixels);
    const darkPixelRatio = Number(((darkCount / totalPixels) * 100).toFixed(1));
    const brightPixelRatio = Number(((brightCount / totalPixels) * 100).toFixed(1));

    // 2. Tính Variance of Laplacian & Sobel Edge Gradient trên vùng ROI trung tâm (80% diện tích giữa ảnh)
    const startX = Math.max(1, Math.floor(w * 0.1));
    const endX = Math.min(w - 2, Math.ceil(w * 0.9));
    const startY = Math.max(1, Math.floor(h * 0.1));
    const endY = Math.min(h - 2, Math.ceil(h * 0.9));

    let lapSum = 0;
    let lapCount = 0;
    const lapValues: number[] = [];
    const edgeMagnitudes: number[] = [];

    for (let y = startY; y <= endY; y++) {
      const rowOffset = y * w;
      const prevRow = (y - 1) * w;
      const nextRow = (y + 1) * w;

      for (let x = startX; x <= endX; x++) {
        const center = data[rowOffset + x];
        // Toán tử Laplacian 3x3: [0, 1, 0; 1, -4, 1; 0, 1, 0]
        const lap =
          data[prevRow + x] +
          data[nextRow + x] +
          data[rowOffset + x - 1] +
          data[rowOffset + x + 1] -
          4 * center;

        lapSum += lap;
        lapValues.push(lap);
        lapCount++;

        // Toán tử Sobel 3x3 đo độ dốc biên vết nứt
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

        const mag = Math.sqrt(gx * gx + gy * gy);
        edgeMagnitudes.push(mag);
      }
    }

    let lapVariance = 0;
    if (lapCount > 0) {
      const lapMean = lapSum / lapCount;
      let lapSq = 0;
      for (let i = 0; i < lapCount; i++) {
        const d = lapValues[i] - lapMean;
        lapSq += d * d;
      }
      lapVariance = lapSq / lapCount;
    }

    // Lấy trung bình 15% biên mạnh nhất (đại diện cho vết nứt và vạch chia thước đo)
    edgeMagnitudes.sort((a, b) => b - a);
    const topEdgeCount = Math.max(1, Math.floor(edgeMagnitudes.length * 0.15));
    let topEdgeSum = 0;
    for (let i = 0; i < topEdgeCount; i++) {
      topEdgeSum += edgeMagnitudes[i];
    }
    const edgeGradientScore = topEdgeSum / topEdgeCount;

    // 3. Phân loại trạng thái & Sinh cảnh báo nghiệp vụ cho Thẩm định viên
    const warnings: string[] = [];
    let blurStatus: ImageQualityMetrics['blurStatus'] = 'SHARP';
    if (lapVariance < 75 || edgeGradientScore < 55) {
      blurStatus = 'CRITICAL_BLUR';
      warnings.push(
        `Ảnh bị mờ/nhòe nặng (Điểm độ nét: ${lapVariance.toFixed(1)} < 75). Ranh giới vết nứt hoặc vạch chia thước đo bị nhòe, cần bật chế độ Khử mờ / Tăng nét cạnh.`
      );
    } else if (lapVariance < 145 || edgeGradientScore < 85) {
      blurStatus = 'MILD_BLUR';
      warnings.push(
        `Ảnh hơi mềm nét hoặc bị giảm chi tiết do nén (Điểm độ nét: ${lapVariance.toFixed(1)}). Khuyến nghị chạy bộ lọc Làm nổi Vết nứt & Thước đo.`
      );
    }

    let exposureStatus: ImageQualityMetrics['exposureStatus'] = 'GOOD';
    if (meanY < 75 || darkPixelRatio > 52) {
      exposureStatus = 'UNDEREXPOSED';
      warnings.push(
        `Ảnh thiếu sáng rõ rệt (Độ sáng TB: ${meanY.toFixed(0)}/255, ${darkPixelRatio}% điểm tối). Các vết nứt mảnh trong vùng tối dễ bị mất chi tiết khi in báo cáo.`
      );
    } else if (meanY > 215 || brightPixelRatio > 35) {
      exposureStatus = 'OVEREXPOSED';
      warnings.push(
        `Ảnh bị dư sáng / lóa đèn Flash (${brightPixelRatio}% điểm cháy sáng). Cần cân bằng lại tương phản cục bộ CLAHE.`
      );
    } else if (rmsContrast < 26) {
      exposureStatus = 'LOW_CONTRAST';
      warnings.push(
        `Độ tương phản bề mặt thấp (RMS Contrast: ${rmsContrast.toFixed(1)}). Nền tường và vết nứt bị bệt màu, khó đọc độ rộng vết nứt.`
      );
    }

    let overallVerdict: ImageQualityMetrics['overallVerdict'] = 'PASS';
    if (blurStatus === 'CRITICAL_BLUR' || (exposureStatus === 'UNDEREXPOSED' && meanY < 50)) {
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
      laplacianVariance: Number(lapVariance.toFixed(1)),
      edgeGradientScore: Number(edgeGradientScore.toFixed(1)),
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
    // Giá trị cơ sở
    let params: ImageEnhancementParams = {
      enableClahe: true,
      claheTileSize: 48,
      claheMaxSlope: 3,
      gamma: 1.0,
      brightness: 1.0,
      saturation: 0.95,
      medianSize: 0,
      sharpenSigma: 1.2,
      sharpenFlatM1: 0.6,
      sharpenJaggedM2: 2.5,
      normalizeHistogram: false,
      invertNegative: false,
    };

    switch (preset) {
      case 'AUTO_SMART': {
        // Tự động điều chỉnh dựa trên chẩn đoán thực tế của bức ảnh
        const isDark = beforeMetrics.meanLuminance < 85 || beforeMetrics.darkPixelRatio > 45;
        const isVeryDark = beforeMetrics.meanLuminance < 55 || beforeMetrics.darkPixelRatio > 65;
        const isLowContrast = beforeMetrics.rmsContrast < 32;
        const isBlurry = beforeMetrics.blurStatus !== 'SHARP';

        params = {
          enableClahe: true,
          claheTileSize: isLowContrast ? 36 : 48,
          claheMaxSlope: isVeryDark ? 4 : isDark || isLowContrast ? 3 : 2,
          gamma: isVeryDark ? 2.1 : isDark ? 1.65 : 1.15,
          brightness: isVeryDark ? 1.18 : isDark ? 1.08 : 1.0,
          saturation: isVeryDark ? 0.85 : 0.95, // Giảm nhẹ nhiễu màu Chroma khi kéo sáng vùng tối
          medianSize: isVeryDark ? 3 : 0,       // Khử nhiễu hạt ISO nếu ảnh quá tối
          sharpenSigma: isBlurry ? 1.35 : 1.1,
          sharpenFlatM1: isVeryDark ? 0.4 : 0.7,
          sharpenJaggedM2: isBlurry ? 3.2 : 2.2,
          normalizeHistogram: isLowContrast,
          invertNegative: false,
        };
        break;
      }

      case 'CRACK_ENHANCE': {
        // Chuyên dụng làm nổi bật rãnh vết nứt 0.1mm và vạch chia thước đo
        params = {
          enableClahe: true,
          claheTileSize: 32,
          claheMaxSlope: 4,
          gamma: beforeMetrics.meanLuminance < 90 ? 1.5 : 1.1,
          brightness: beforeMetrics.meanLuminance < 90 ? 1.05 : 1.0,
          saturation: 0.8, // Giảm bớt màu sơn tường để làm nổi tương phản đen-trắng của vết nứt
          medianSize: 0,
          sharpenSigma: 1.3,
          sharpenFlatM1: 0.5, // Giữ nền tường phẳng mịn
          sharpenJaggedM2: 3.8, // Đẩy mạnh độ dốc biên tại rãnh vết nứt và vạch thước đo
          normalizeHistogram: true,
          invertNegative: false,
        };
        break;
      }

      case 'LOW_LIGHT_RESCUE': {
        // Cứu ảnh chụp trong tầng hầm, gầm cầu thang, phòng khuất sáng
        params = {
          enableClahe: true,
          claheTileSize: 64,
          claheMaxSlope: 4,
          gamma: 2.2,
          brightness: 1.2,
          saturation: 0.85,
          medianSize: 3, // Khử nhiễu hạt ISO vùng tối trước khi làm nét
          sharpenSigma: 1.2,
          sharpenFlatM1: 0.4,
          sharpenJaggedM2: 2.6,
          normalizeHistogram: true,
          invertNegative: false,
        };
        break;
      }

      case 'DEBLOCK_COMPRESSION': {
        // Khử nhiễu ô vuông 8x8 do nén JPEG / Zalo và tái tạo lại biên chữ số
        params = {
          enableClahe: true,
          claheTileSize: 48,
          claheMaxSlope: 3,
          gamma: 1.2,
          brightness: 1.02,
          saturation: 0.95,
          medianSize: 3, // Làm mượt ranh giới khối nén 8x8 DCT
          sharpenSigma: 1.1,
          sharpenFlatM1: 0.3,
          sharpenJaggedM2: 3.4, // Tái tạo độ sắc cho chữ số và vạch thước
          normalizeHistogram: false,
          invertNegative: false,
        };
        break;
      }

      case 'XRAY_NEGATIVE': {
        // Chế độ bản âm X-Ray giúp vết nứt chân chim phát sáng trắng trên nền tối
        params = {
          enableClahe: true,
          claheTileSize: 32,
          claheMaxSlope: 5,
          gamma: 1.4,
          brightness: 1.0,
          saturation: 0.2,
          medianSize: 0,
          sharpenSigma: 1.4,
          sharpenFlatM1: 0.5,
          sharpenJaggedM2: 4.0,
          normalizeHistogram: true,
          invertNegative: true,
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

    // Ràng buộc giới hạn an toàn cho libvips
    params.claheTileSize = Math.max(8, Math.min(256, Math.round(Number(params.claheTileSize) || 48)));
    params.claheMaxSlope = Math.max(0, Math.min(10, Math.round(Number(params.claheMaxSlope) || 3)));
    params.gamma = Math.max(1.0, Math.min(3.0, Number(params.gamma) || 1.0));
    params.brightness = Math.max(0.5, Math.min(2.5, Number(params.brightness) || 1.0));
    params.saturation = Math.max(0.0, Math.min(2.0, Number(params.saturation) ?? 0.95));
    params.medianSize = [0, 3, 5].includes(Number(params.medianSize)) ? Number(params.medianSize) : 0;
    params.sharpenSigma = Math.max(0.3, Math.min(5.0, Number(params.sharpenSigma) || 1.2));
    params.sharpenFlatM1 = Math.max(0, Math.min(10, Number(params.sharpenFlatM1) ?? 0.5));
    params.sharpenJaggedM2 = Math.max(0, Math.min(15, Number(params.sharpenJaggedM2) ?? 2.5));

    return params;
  }

  /**
   * Thực thi Pipeline xử lý ảnh và trả về kết quả đối chứng đầy đủ Trước / Sau
   */
  public static async processAndCompare(
    inputBuffer: Buffer,
    preset: ImageLabPreset = 'AUTO_SMART',
    customParams?: Partial<ImageEnhancementParams>
  ): Promise<ImageLabProcessResult> {
    const startTime = Date.now();

    // 1. Chẩn đoán chất lượng ảnh gốc
    const beforeMetrics = await this.analyzeImageQuality(inputBuffer);

    // 2. Xác định bộ tham số xử lý
    const appliedParams = this.resolveEnhancementParams(preset, beforeMetrics, customParams);

    // 3. Chuẩn hóa ảnh gốc để hiển thị đối chứng (tự xoay đúng chiều EXIF)
    const normalizedOriginalBuffer = await sharp(inputBuffer)
      .rotate()
      .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
      .toBuffer();

    // 4. Xây dựng Pipeline xử lý tín hiệu ảnh bằng C++ Sharp
    let pipeline = sharp(inputBuffer)
      .rotate()
      .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' });

    // Bước 4.1: Khử nhiễu hạt ISO hoặc nhiễu nén khối JPEG bảo toàn biên (Median Filter)
    if (appliedParams.medianSize >= 3) {
      pipeline = pipeline.median(appliedParams.medianSize);
    }

    // Bước 4.2: Bù sáng phi tuyến vùng tối (Gamma Correction)
    if (appliedParams.gamma > 1.01) {
      pipeline = pipeline.gamma(appliedParams.gamma, 1.0);
    }

    // Bước 4.3: Điều chỉnh độ chói & giảm nhẹ bão hòa màu nhiễu nền tường
    if (Math.abs(appliedParams.brightness - 1.0) > 0.01 || Math.abs(appliedParams.saturation - 1.0) > 0.01) {
      pipeline = pipeline.modulate({
        brightness: appliedParams.brightness,
        saturation: Math.max(0.05, appliedParams.saturation),
      });
    }

    // Bước 4.4: Kéo giãn dải động toàn cục (Percentile Histogram Normalization)
    if (appliedParams.normalizeHistogram) {
      pipeline = pipeline.normalise({ lower: 1, upper: 99 });
    }

    // Bước 4.5: Cân bằng tương phản cục bộ thích nghi (CLAHE - Làm nổi rõ vết nứt trong vùng tối/bệt)
    if (appliedParams.enableClahe && appliedParams.claheMaxSlope > 0) {
      pipeline = pipeline.clahe({
        width: appliedParams.claheTileSize,
        height: appliedParams.claheTileSize,
        maxSlope: appliedParams.claheMaxSlope,
      });
    }

    // Bước 4.6: Làm sắc nét có ngưỡng (Thresholded Unsharp Masking)
    // m1 nhỏ để không làm nổi nhiễu trên mặt tường phẳng; m2 lớn để làm sắc lẹm rãnh vết nứt và vạch thước đo
    if (appliedParams.sharpenFlatM1 > 0 || appliedParams.sharpenJaggedM2 > 0) {
      pipeline = pipeline.sharpen({
        sigma: appliedParams.sharpenSigma,
        m1: appliedParams.sharpenFlatM1,
        m2: appliedParams.sharpenJaggedM2,
        x1: 2.0,
        y2: 12.0,
        y3: 24.0,
      });
    }

    // Bước 4.7: Đảo phổ âm bản X-Ray (nếu bật chế độ soi vết nứt chân chim)
    if (appliedParams.invertNegative) {
      pipeline = pipeline.negate({ alpha: false });
    }

    // Bước 4.8: Xuất ảnh chất lượng pháp lý cao nhất (Chroma Subsampling 4:4:4 chống nhòe biên màu)
    const enhancedBuffer = await pipeline
      .jpeg({
        quality: 95,
        chromaSubsampling: '4:4:4',
        mozjpeg: true,
      })
      .toBuffer();

    // 5. Chẩn đoán lại chất lượng ảnh sau khi xử lý để đối chứng định lượng
    const afterMetrics = await this.analyzeImageQuality(enhancedBuffer);
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
        ? Math.round(((afterMetrics.rmsContrast - beforeMetrics.rmsContrast) / beforeMetrics.rmsContrast) * 100)
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
      },
    };
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
      const cleanRelPath = trimmed.replace(/^.*?\/uploads\//, 'uploads/').split('?')[0];
      const candidates = [
        path.resolve(process.cwd(), cleanRelPath),
        path.resolve(process.cwd(), 'backend', cleanRelPath),
        path.resolve(process.cwd(), '..', cleanRelPath),
      ];
      for (const fullPath of candidates) {
        if (fs.existsSync(fullPath)) {
          return fs.readFileSync(fullPath);
        }
      }
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
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
}

