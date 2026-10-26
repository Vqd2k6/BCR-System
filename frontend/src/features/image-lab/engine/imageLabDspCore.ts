/**
 * ============================================================================
 * FRONTEND FORENSIC DSP CORE ENGINE (TYPED-ARRAY / WEB WORKER COMPATIBLE)
 * Thực thi toàn bộ thuật toán Chẩn đoán & Làm rõ Vết nứt trực tiếp trên trình duyệt:
 * - Tách kênh Độ chói L (Luminance) bảo toàn sắc độ màu tự nhiên của vết thấm.
 * - Đường cong Nâng/Giảm sáng có bảo vệ vùng sáng (Toe-Limited + Highlight Protect LUT).
 * - Toán tử Hình thái học Đáy Mũ (Bottom-Hat v1/v2) trên mảng bất biến origLum
 *   kèm lọc khuếch tán 3x3 (Triệt tiêu 100% lỗi tự dao động Ziczac \/\/\/\/ và hạt đen).
 * - Toán tử CLAHE Nội suy Song tuyến tính 4 Ô lưới (Bilinear Tile-Interpolated CLAHE).
 * - Làm nét Thích nghi Có Cổng Chặn Hạt Tường (Separable Gaussian USM với Deadzone x1).
 * ============================================================================
 */

import type {
  ImageLabPreset,
  ImageEnhancementParams,
  ImageQualityMetrics,
} from '../ForensicImageLabModal';

export interface RoiPercentileBounds {
  lowClip: number;
  highClip: number;
}

/**
 * Tính phân vị P1% và P99.5% trên vùng ROI sạch (loại trừ 22% đỉnh Watermark THACO REC & 15% đáy Timestamp)
 */
export function computeCleanRoiPercentiles(
  lum: Uint8Array,
  width: number,
  height: number
): RoiPercentileBounds {
  const roiHist = new Uint32Array(256);
  const roiYMin = Math.floor(height * 0.22);
  const roiYMax = Math.floor(height * 0.85);
  const roiXMin = Math.floor(width * 0.06);
  const roiXMax = Math.floor(width * 0.94);
  let roiPixelCount = 0;

  for (let y = roiYMin; y <= roiYMax; y++) {
    const rowOff = y * width;
    for (let x = roiXMin; x <= roiXMax; x++) {
      roiHist[lum[rowOff + x]]++;
      roiPixelCount++;
    }
  }

  if (roiPixelCount === 0) {
    return { lowClip: 0, highClip: 255 };
  }

  let lowClip = 0;
  let highClip = 255;
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

  return { lowClip, highClip };
}

/**
 * Phân tích & Chẩn đoán chất lượng ảnh hiện trường trực tiếp từ kênh Độ chói L
 * (Tự động hạ mẫu xuống tối đa 768px để đồng nhất thang điểm với chuẩn Forensic v2.1)
 */
export function analyzeLuminanceQuality(
  lumFull: Uint8Array,
  fullWidth: number,
  fullHeight: number,
  origMeta: { origWidth: number; origHeight: number; format: string; sizeBytes: number }
): ImageQualityMetrics {
  const maxDim = 768;
  const scale = Math.min(1.0, maxDim / Math.max(1, Math.max(fullWidth, fullHeight)));
  const w = Math.max(8, Math.round(fullWidth * scale));
  const h = Math.max(8, Math.round(fullHeight * scale));

  let data: Uint8Array;
  if (w === fullWidth && h === fullHeight) {
    data = lumFull;
  } else {
    data = new Uint8Array(w * h);
    const xRatio = fullWidth / w;
    const yRatio = fullHeight / h;
    for (let y = 0; y < h; y++) {
      const srcY = Math.min(fullHeight - 1, Math.floor(y * yRatio));
      const srcRow = srcY * fullWidth;
      const dstRow = y * w;
      for (let x = 0; x < w; x++) {
        const srcX = Math.min(fullWidth - 1, Math.floor(x * xRatio));
        data[dstRow + x] = lumFull[srcRow + srcX];
      }
    }
  }

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
  const edgeHistogram = new Uint32Array(525);

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

      const rawLap =
        data[prevRow + x] +
        data[nextRow + x] +
        data[rowOffset + x - 1] +
        data[rowOffset + x + 1] -
        4 * center;

      const trimmedLap = Math.max(-140, Math.min(140, rawLap));
      lapSum += trimmedLap;
      lapValues[idx++] = trimmedLap;

      const absLap = Math.min(1024, Math.abs(rawLap));
      if (absLap > 0) {
        absLapNonZeroHist[absLap]++;
        nonZeroLapCount++;
      }

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

  const origMp = Math.max(0.3, (origMeta.origWidth * origMeta.origHeight) / 1_000_000);
  const kbPerMp = origMeta.sizeBytes > 0 ? origMeta.sizeBytes / 1024 / origMp : 180;
  const compressionNoisePenalty = kbPerMp < 105 ? 1.15 : kbPerMp < 150 ? 0.65 : 0.0;
  const noiseSigma = Math.max(1.2, medianAbsLap / 3.0165 + compressionNoisePenalty);

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
  const structuralLapVariance = Math.max(1.0, rawLapVariance - 10.0 * noiseSigma * noiseSigma);

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

  const warnings: string[] = [];
  const isBacklit = darkPixelRatio >= 16 && brightPixelRatio >= 2.0;
  const isHeavyCompressed = kbPerMp < 110 && origMeta.origWidth >= 1200;

  let blurStatus: ImageQualityMetrics['blurStatus'] = 'SHARP';
  if (structuralLapVariance < 85 || edgeGradientScore < 95) {
    blurStatus = 'CRITICAL_BLUR';
    warnings.push(
      `Ảnh bị mờ nhòe nặng (Độ nét vùng trung tâm: ${structuralLapVariance.toFixed(1)}). Chi tiết bề mặt và biên cấu trúc bị suy giảm mạnh.`
    );
  } else if (structuralLapVariance < 185 || edgeGradientScore < 165 || isHeavyCompressed) {
    blurStatus = 'MILD_BLUR';
    warnings.push(
      `Ảnh bị mềm nét / mất chi tiết bề mặt do nén JPEG (${kbPerMp.toFixed(0)} KB/MP, Độ nét: ${structuralLapVariance.toFixed(1)}). Đã kích hoạt chế độ làm nét biên sạch không gây hạt tường.`
    );
  }

  let exposureStatus: ImageQualityMetrics['exposureStatus'] = 'GOOD';
  if (meanY < 82 || darkPixelRatio > 42) {
    exposureStatus = 'UNDEREXPOSED';
    warnings.push(
      `Ảnh thiếu sáng toàn cục (Độ sáng TB: ${meanY.toFixed(0)}/255, ${darkPixelRatio}% vùng tối).`
    );
  } else if (isBacklit || (darkPixelRatio >= 15 && shadowMidRatio >= 32)) {
    exposureStatus = 'UNDEREXPOSED';
    warnings.push(
      `Ảnh bị ngược sáng / lóa đèn cục bộ (${darkPixelRatio}% vùng sập tối, ${shadowMidRatio}% vùng khuất sáng). Hệ thống tự động nâng sáng vùng tối và bảo vệ vùng sáng.`
    );
  } else if (meanY > 218 || brightPixelRatio > 38) {
    exposureStatus = 'OVEREXPOSED';
    warnings.push(`Ảnh bị dư sáng / lóa đèn Flash (${brightPixelRatio}% điểm cháy sáng).`);
  } else if (rmsContrast < 30) {
    exposureStatus = 'LOW_CONTRAST';
    warnings.push(`Độ tương phản bề mặt thấp / mù sương (RMS Contrast: ${rmsContrast.toFixed(1)}).`);
  }

  let overallVerdict: ImageQualityMetrics['overallVerdict'] = 'PASS';
  if (blurStatus === 'CRITICAL_BLUR' || (exposureStatus === 'UNDEREXPOSED' && meanY < 52)) {
    overallVerdict = 'CRITICAL';
  } else if (blurStatus !== 'SHARP' || exposureStatus !== 'GOOD') {
    overallVerdict = 'WARNING';
  }

  return {
    width: origMeta.origWidth,
    height: origMeta.origHeight,
    format: origMeta.format,
    sizeBytes: origMeta.sizeBytes,
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
 * Nội suy bộ tham số xử lý theo từng Preset trên Client
 */
export function resolveClientEnhancementParams(
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
    sharpenJaggedM2: 2.4,
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

    case 'CRACK_ENHANCE_V2': {
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

  params.claheTileSize = Math.max(32, Math.min(256, Math.round(Number(params.claheTileSize) || 128)));
  params.claheMaxSlope = Math.max(0, Math.min(10, Math.round(Number(params.claheMaxSlope) ?? 2)));
  params.gamma = Math.max(1.0, Math.min(3.0, Number(params.gamma) || 1.0));
  params.brightness = Math.max(0.5, Math.min(2.5, Number(params.brightness) || 1.0));
  params.saturation = Math.max(0.0, Math.min(2.0, Number(params.saturation) ?? 0.95));
  params.crackValleyBoost = Math.max(0.0, Math.min(2.5, Number(params.crackValleyBoost) ?? 0.0));
  params.sharpenSigma = Math.max(0.5, Math.min(3.0, Number(params.sharpenSigma) || 1.15));
  params.sharpenFlatM1 = Math.max(0, Math.min(5, Number(params.sharpenFlatM1) ?? 0.0));
  params.sharpenJaggedM2 = Math.max(0, Math.min(10, Number(params.sharpenJaggedM2) ?? 2.4));

  return params;
}

/**
 * Bảng Tra Cứu Đường Cong Độ Chói (Shadow-Lift + Dehaze + Highlight Protection LUT)
 */
function buildLuminanceToneCurveLut(
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

    if (dehazeStrength > 0.01) {
      const dehazed = Math.pow(u, 1.0 + dehazeStrength * 0.25);
      u = (1.0 - dehazeStrength) * u + dehazeStrength * dehazed;
    }

    let mapped = u;
    if (gamma > 1.005) {
      const shadowLifted = (Math.pow(u + uToe, invGamma) - baseMin) / baseDenom;
      const highlightProtect = Math.min(1.0, 0.55 * u * u);
      mapped = (1.0 - highlightProtect) * shadowLifted + highlightProtect * u;
    }

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
 * Toán tử Hình thái học Đáy Mũ Khử Ziczac (Đọc trên mảng bất biến origLum + Làm mượt khuếch tán 3x3)
 */
function applyMorphologicalBottomHatValleyBoost(
  lum: Uint8Array,
  width: number,
  height: number,
  radius: number,
  crackValleyBoost: number,
  noiseSigma: number
): void {
  if (crackValleyBoost <= 0.01 || width < 5 || height < 5) return;

  const total = width * height;
  const origLum = new Uint8Array(lum);
  const temp = new Uint8Array(total);
  const closed = new Uint8Array(total);
  const r = Math.max(1, Math.min(2, radius));

  // Dilation khả tách (Ngang -> Dọc)
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

  // Erosion khả tách (Ngang -> Dọc)
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

  // Làm mượt nhẹ 3x3 trên bản đồ rãnh nứt trước khi trừ vào lum
  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x;
      const centerDepth = rawValleyMap[idx];
      if (centerDepth > 0) {
        const smoothedDepth =
          0.5 * centerDepth +
          0.125 *
            (rawValleyMap[idx - 1] +
              rawValleyMap[idx + 1] +
              rawValleyMap[idx - width] +
              rawValleyMap[idx + width]);
        lum[idx] = Math.max(0, Math.round(origLum[idx] - smoothedDepth));
      }
    }
  }
}

/**
 * Toán tử CLAHE Nội suy Song tuyến tính 4 Ô lưới (Bilinear Tile-Interpolated CLAHE)
 * Tương đương chuẩn vips_clahe nhưng chạy 100% trên TypedArray trong ~12ms
 */
function applyBilinearTileClahe(
  lum: Uint8Array,
  width: number,
  height: number,
  tileSize: number,
  maxSlope: number
): void {
  if (maxSlope <= 1 || width < 16 || height < 16) return;

  const safeTile = Math.max(32, Math.min(256, tileSize));
  const numTilesX = Math.max(2, Math.ceil(width / safeTile));
  const numTilesY = Math.max(2, Math.ceil(height / safeTile));
  const tileW = width / numTilesX;
  const tileH = height / numTilesY;

  const cdfTable = new Uint8Array(numTilesX * numTilesY * 256);
  const hist = new Int32Array(256);

  // 1. Xây dựng bảng ánh xạ CDF có cắt đỉnh (Clip Limit) cho từng ô lưới
  for (let ty = 0; ty < numTilesY; ty++) {
    const y0 = Math.floor(ty * tileH);
    const y1 = ty === numTilesY - 1 ? height : Math.floor((ty + 1) * tileH);
    const actualH = Math.max(1, y1 - y0);

    for (let tx = 0; tx < numTilesX; tx++) {
      const x0 = Math.floor(tx * tileW);
      const x1 = tx === numTilesX - 1 ? width : Math.floor((tx + 1) * tileW);
      const actualW = Math.max(1, x1 - x0);
      const tilePixels = actualW * actualH;

      hist.fill(0);
      for (let y = y0; y < y1; y++) {
        const rowOff = y * width;
        for (let x = x0; x < x1; x++) {
          hist[lum[rowOff + x]]++;
        }
      }

      // Cắt đỉnh Histogram và phân phối lại đều phần dư
      const clipLimit = Math.max(1, Math.round((maxSlope * tilePixels) / 256));
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clipLimit) {
          excess += hist[i] - clipLimit;
          hist[i] = clipLimit;
        }
      }

      const redistrib = Math.floor(excess / 256);
      const residual = excess - redistrib * 256;
      for (let i = 0; i < 256; i++) {
        hist[i] += redistrib;
      }
      if (residual > 0) {
        const step = Math.max(1, Math.floor(256 / residual));
        for (let i = 0, added = 0; i < 256 && added < residual; i += step, added++) {
          hist[i]++;
        }
      }

      // Hòa trộn 65% CDF CLAHE + 35% Identity để chuyển sắc tự nhiên, không gây Halo
      const lutOffset = (ty * numTilesX + tx) * 256;
      let cdf = 0;
      const scale = 255.0 / Math.max(1, tilePixels);
      for (let i = 0; i < 256; i++) {
        cdf += hist[i];
        const eqVal = cdf * scale;
        const blended = 0.62 * eqVal + 0.38 * i;
        cdfTable[lutOffset + i] = Math.max(0, Math.min(255, Math.round(blended)));
      }
    }
  }

  // 2. Nội suy Song tuyến tính (Bilinear Interpolation) giữa 4 tâm ô lưới cho mọi điểm ảnh
  const srcLum = new Uint8Array(lum);
  const invTileW = 1.0 / tileW;
  const invTileH = 1.0 / tileH;

  for (let y = 0; y < height; y++) {
    const fy = (y + 0.5) * invTileH - 0.5;
    let ty0 = Math.floor(fy);
    let ty1 = ty0 + 1;
    let wy = fy - ty0;
    if (ty0 < 0) {
      ty0 = 0;
      ty1 = 0;
      wy = 0;
    } else if (ty1 >= numTilesY) {
      ty0 = numTilesY - 1;
      ty1 = numTilesY - 1;
      wy = 0;
    }
    const wyInv = 1.0 - wy;
    const rowOff = y * width;

    for (let x = 0; x < width; x++) {
      const fx = (x + 0.5) * invTileW - 0.5;
      let tx0 = Math.floor(fx);
      let tx1 = tx0 + 1;
      let wx = fx - tx0;
      if (tx0 < 0) {
        tx0 = 0;
        tx1 = 0;
        wx = 0;
      } else if (tx1 >= numTilesX) {
        tx0 = numTilesX - 1;
        tx1 = numTilesX - 1;
        wx = 0;
      }
      const wxInv = 1.0 - wx;

      const val = srcLum[rowOff + x];
      const v00 = cdfTable[(ty0 * numTilesX + tx0) * 256 + val];
      const v10 = cdfTable[(ty0 * numTilesX + tx1) * 256 + val];
      const v01 = cdfTable[(ty1 * numTilesX + tx0) * 256 + val];
      const v11 = cdfTable[(ty1 * numTilesX + tx1) * 256 + val];

      const top = wxInv * v00 + wx * v10;
      const bot = wxInv * v01 + wx * v11;
      lum[rowOff + x] = Math.round(wyInv * top + wy * bot);
    }
  }
}

/**
 * Làm nét Thích nghi Có Cổng Chặn Hạt Tường (Separable Gaussian Unsharp Masking với Deadzone x1)
 * - Vùng tường phẳng (|detail| <= adaptiveX1): m1 = 0 -> Giữ tường phẳng mịn sạch 100%
 * - Vùng biên vết nứt & vạch thước (|detail| > adaptiveX1): Khuếch đại m2 có kẹp trần chống Halo
 */
function applyAdaptiveUnsharpMask(
  lum: Uint8Array,
  width: number,
  height: number,
  sigma: number,
  flatM1: number,
  jaggedM2: number,
  adaptiveX1: number
): void {
  if ((flatM1 <= 0.01 && jaggedM2 <= 0.01) || width < 5 || height < 5) return;

  const total = width * height;
  const tempBlur = new Float32Array(total);
  const blurred = new Float32Array(total);

  // Nhân Gaussian 5-tap khả tách theo sigma (sigma ~ 1.1 - 1.25)
  const s2 = 2.0 * sigma * sigma;
  const w0 = 1.0;
  const w1 = Math.exp(-1.0 / s2);
  const w2 = Math.exp(-4.0 / s2);
  const norm = 1.0 / (w0 + 2.0 * (w1 + w2));
  const k0 = w0 * norm;
  const k1 = w1 * norm;
  const k2 = w2 * norm;

  // Lượt 1: Làm mờ Ngang (Horizontal 1D Pass)
  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      const xm2 = x >= 2 ? x - 2 : 0;
      const xm1 = x >= 1 ? x - 1 : 0;
      const xp1 = x + 1 < width ? x + 1 : width - 1;
      const xp2 = x + 2 < width ? x + 2 : width - 1;
      tempBlur[rowOff + x] =
        k0 * lum[rowOff + x] +
        k1 * (lum[rowOff + xm1] + lum[rowOff + xp1]) +
        k2 * (lum[rowOff + xm2] + lum[rowOff + xp2]);
    }
  }

  // Lượt 2: Làm mờ Dọc (Vertical 1D Pass)
  for (let y = 0; y < height; y++) {
    const ym2 = (y >= 2 ? y - 2 : 0) * width;
    const ym1 = (y >= 1 ? y - 1 : 0) * width;
    const y0 = y * width;
    const yp1 = (y + 1 < height ? y + 1 : height - 1) * width;
    const yp2 = (y + 2 < height ? y + 2 : height - 1) * width;

    for (let x = 0; x < width; x++) {
      blurred[y0 + x] =
        k0 * tempBlur[y0 + x] +
        k1 * (tempBlur[ym1 + x] + tempBlur[yp1 + x]) +
        k2 * (tempBlur[ym2 + x] + tempBlur[yp2 + x]);
    }
  }

  // Lượt 3: Cộng chi tiết tần số cao có cổng chặn nhiễu nền x1 & kẹp trần y2/y3 chống viền Halo
  const maxBrighten = 8.5; // y2: Không cho viền sáng Halo quanh chữ/vết nứt vượt quá +8.5 mức xám
  const maxDarken = 13.0;  // y3: Cho phép rãnh nứt tối sắc nét hơn tới -13 mức xám

  for (let i = 0; i < total; i++) {
    const orig = lum[i];
    const diff = orig - blurred[i];
    const absDiff = Math.abs(diff);

    let boost = 0;
    if (absDiff <= adaptiveX1) {
      boost = diff * flatM1;
    } else {
      const sign = diff >= 0 ? 1 : -1;
      const rawBoost = adaptiveX1 * flatM1 + (absDiff - adaptiveX1) * jaggedM2;
      if (sign > 0) {
        boost = (maxBrighten * rawBoost) / (rawBoost + maxBrighten);
      } else {
        boost = -(maxDarken * rawBoost) / (rawBoost + maxDarken);
      }
    }

    const res = Math.round(orig + boost);
    lum[i] = res <= 0 ? 0 : res >= 255 ? 255 : res;
  }
}

/**
 * Chạy trọn vẹn Pipeline Xử lý Kênh Độ chói L và Tái tạo Màu sRGB (Chrominance-Preserving)
 */
export function runClientLuminancePipeline(input: {
  width: number;
  height: number;
  rgbOrig: Uint8Array;
  lumOrig: Uint8Array;
  lowClip: number;
  highClip: number;
  beforeMetrics: ImageQualityMetrics;
  preset: ImageLabPreset;
  appliedParams: ImageEnhancementParams;
}): {
  rgbaOut: Uint8ClampedArray;
  lumFinal: Uint8Array;
} {
  const {
    width,
    height,
    rgbOrig,
    lumOrig,
    lowClip,
    highClip,
    beforeMetrics,
    preset,
    appliedParams,
  } = input;

  const totalPixels = width * height;
  const lumWork = new Uint8Array(lumOrig);

  // 1. Ánh xạ Đường cong Độ chói (Tone Curve LUT)
  const dehazeStrength =
    beforeMetrics.brightPixelRatio < 5.0 && beforeMetrics.meanLuminance > 105 ? 0.25 : 0.12;

  if (
    appliedParams.normalizeHistogram ||
    appliedParams.gamma > 1.005 ||
    Math.abs(appliedParams.brightness - 1.0) > 0.005
  ) {
    const toneLut = buildLuminanceToneCurveLut(
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

  // 2. Toán tử Hình thái học Đáy Mũ Khử Ziczac (cho v1 & v2)
  if (appliedParams.crackValleyBoost > 0.01) {
    const morphRadius = Math.max(width, height) >= 1200 ? 2 : 1;
    const shadowGainEstimate = Math.max(1.0, appliedParams.gamma * 0.75);
    applyMorphologicalBottomHatValleyBoost(
      lumWork,
      width,
      height,
      morphRadius,
      appliedParams.crackValleyBoost,
      beforeMetrics.noiseSigma * shadowGainEstimate
    );
  }

  // 3. Toán tử CLAHE Nội suy Song tuyến tính 4 Ô lưới
  if (appliedParams.enableClahe && appliedParams.claheMaxSlope > 0) {
    applyBilinearTileClahe(
      lumWork,
      width,
      height,
      appliedParams.claheTileSize,
      appliedParams.claheMaxSlope
    );
  }

  // 4. Làm nét Thích nghi Có Cổng Chặn Hạt Tường (Adaptive USM)
  if (appliedParams.sharpenFlatM1 > 0 || appliedParams.sharpenJaggedM2 > 0) {
    const minCleanX1 =
      preset === 'CRACK_ENHANCE_V1' || preset === 'CRACK_ENHANCE_V2' ? 5.5 : 6.8;
    const adaptiveX1 = Math.max(
      minCleanX1,
      Math.min(16.0, Number((2.5 * beforeMetrics.noiseSigma).toFixed(2)))
    );

    applyAdaptiveUnsharpMask(
      lumWork,
      width,
      height,
      appliedParams.sharpenSigma,
      appliedParams.sharpenFlatM1,
      appliedParams.sharpenJaggedM2,
      adaptiveX1
    );
  }

  // 5. Tái tạo Không gian màu sRGB Bảo toàn Sắc độ Gốc (Chrominance-Preserving Reconstruction)
  const rgbaOut = new Uint8ClampedArray(totalPixels * 4);
  const userSat = appliedParams.saturation;

  for (let i = 0; i < totalPixels; i++) {
    const yOrig = lumOrig[i];
    const yFinal = lumWork[i];
    const inOff = i * 3;
    const outOff = i * 4;

    const rOrig = rgbOrig[inOff];
    const gOrig = rgbOrig[inOff + 1];
    const bOrig = rgbOrig[inOff + 2];

    const lumRatio = Math.min(2.4, (yFinal + 1.0) / (yOrig + 1.0));
    const shadowChromaDamp = yOrig < 24 ? (yOrig + 8.0) / 32.0 : 1.0;
    const effectiveSat = userSat * shadowChromaDamp;

    const rScaled = rOrig * lumRatio;
    const gScaled = gOrig * lumRatio;
    const bScaled = bOrig * lumRatio;

    const rOut = yFinal + effectiveSat * (rScaled - yFinal);
    const gOut = yFinal + effectiveSat * (gScaled - yFinal);
    const bOut = yFinal + effectiveSat * (bScaled - yFinal);

    rgbaOut[outOff] = rOut <= 0 ? 0 : rOut >= 255 ? 255 : Math.round(rOut);
    rgbaOut[outOff + 1] = gOut <= 0 ? 0 : gOut >= 255 ? 255 : Math.round(gOut);
    rgbaOut[outOff + 2] = bOut <= 0 ? 0 : bOut >= 255 ? 255 : Math.round(bOut);
    rgbaOut[outOff + 3] = 255;
  }

  return {
    rgbaOut,
    lumFinal: lumWork,
  };
}
