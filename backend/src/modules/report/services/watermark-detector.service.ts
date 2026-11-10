/**
 * ============================================================================
 * WATERMARK DETECTOR — NHẬN DIỆN ẢNH ĐÃ CÓ WATERMARK FE CŨ BẰNG LOGO (KHÔNG OCR)
 * App hiện trường bản cũ dập logo THACO-CREC vào pixel ở góc trên phải, tỉ lệ cố định theo
 * cạnh ngắn (frontend/src/utils/watermarkEngine.ts trước commit acb6a57). Máy chạy PWA cũ vẫn
 * upload ảnh có dấu sau mốc chuyển đổi, nên không thể đoán theo ngày: phải nhìn vào pixel.
 *
 * Cách dò: quét nhiều cỡ logo neo góc trên phải; tại mỗi khung so màu ảnh với logo mẫu
 * (legacy_fe_watermark_logo.png = đúng logo đã dập ở hiện trường).
 *   score = lệch màu ở phần trong suốt của khung logo / lệch màu ở phần chữ logo
 *   Tường trơn ≈ 1; có logo thật ≫ 1. Đo trên 128 ảnh thật: có dấu 2,6–7,9; sạch 0,95–1,08.
 * Chỉ dùng sharp; không ghi đè ảnh gốc.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

export const WATERMARK_DETECTOR_VERSION = 'logo-v1';

/** Ngưỡng: ≥ WATERMARKED chắc chắn có dấu; [UNSURE, WATERMARKED) lưng chừng → coi như có dấu, ghi log. */
const SCORE_WATERMARKED = 2;
const SCORE_UNSURE = 1.3;

/** Thu ảnh về cạnh dài này trước khi quét để nhanh và ổn định giữa các độ phân giải. */
const SCAN_LONG_SIDE_PX = 1200;
const WIDTH_RATIO_MIN = 0.25;
const WIDTH_RATIO_MAX = 0.8;
const WIDTH_RATIO_STEP = 0.0125;
const PADDING_RATIOS = [0.01, 0.018, 0.025, 0.035, 0.045];
const ALPHA_SOLID = 230;
const ALPHA_CLEAR = 10;
/** Lấy mẫu cách 1 điểm để quét nhanh; đủ dày với logo rộng hàng trăm px. */
const SAMPLE_STEP = 2;

export type LegacyWatermarkVerdict = 'WATERMARKED' | 'UNSURE' | 'CLEAN';

export interface LegacyWatermarkDetection {
  verdict: LegacyWatermarkVerdict;
  /** true cho WATERMARKED và UNSURE: không bao giờ dập chồng khi chưa chắc. */
  hasLegacyWatermark: boolean;
  score: number;
}

interface LogoTemplate {
  rgba: Buffer;
  width: number;
  height: number;
  meanR: number;
  meanG: number;
  meanB: number;
}

let logoSourcePromise: Promise<{ buffer: Buffer; aspect: number }> | null = null;
const templateCache = new Map<string, LogoTemplate>();

function resolveLogoPath(): string {
  const fileName = 'legacy_fe_watermark_logo.png';
  const candidates = [
    path.resolve(__dirname, '../assets', fileName),
    path.resolve(process.cwd(), 'src/modules/report/assets', fileName),
    path.resolve(process.cwd(), 'backend/src/modules/report/assets', fileName),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error(`[WatermarkDetector] Không tìm thấy logo mẫu ${fileName}`);
  return found;
}

function loadLogoSource(): Promise<{ buffer: Buffer; aspect: number }> {
  if (!logoSourcePromise) {
    logoSourcePromise = (async () => {
      const buffer = fs.readFileSync(resolveLogoPath());
      const meta = await sharp(buffer).metadata();
      if (!meta.width || !meta.height) throw new Error('[WatermarkDetector] Logo mẫu không đọc được kích thước');
      return { buffer, aspect: meta.height / meta.width };
    })();
    logoSourcePromise.catch((err: unknown) => {
      console.error('[WatermarkDetector:logo] Nạp logo mẫu thất bại:', err);
      logoSourcePromise = null;
    });
  }
  return logoSourcePromise;
}

async function templateAt(width: number): Promise<LogoTemplate> {
  const { buffer, aspect } = await loadLogoSource();
  const height = Math.max(4, Math.round(width * aspect));
  const key = `${width}x${height}`;
  const cached = templateCache.get(key);
  if (cached) return cached;
  const rgba = await sharp(buffer).resize(width, height).ensureAlpha().raw().toBuffer();
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < width * height; i++) {
    if (rgba[i * 4 + 3] < ALPHA_SOLID) continue;
    r += rgba[i * 4];
    g += rgba[i * 4 + 1];
    b += rgba[i * 4 + 2];
    n++;
  }
  const tpl: LogoTemplate = { rgba, width, height, meanR: r / (n || 1), meanG: g / (n || 1), meanB: b / (n || 1) };
  if (templateCache.size > 200) templateCache.clear();
  templateCache.set(key, tpl);
  return tpl;
}

function verdictOf(score: number): LegacyWatermarkVerdict {
  if (score >= SCORE_WATERMARKED) return 'WATERMARKED';
  if (score >= SCORE_UNSURE) return 'UNSURE';
  return 'CLEAN';
}

export class WatermarkDetectorService {
  /** Dò logo FE cũ trong ảnh (buffer JPEG/PNG gốc). Ném lỗi nếu ảnh không đọc được. */
  public static async detectLegacyLogo(imageBuffer: Buffer): Promise<LegacyWatermarkDetection> {
    const { data, info } = await sharp(imageBuffer)
      .rotate()
      .resize({ width: SCAN_LONG_SIDE_PX, height: SCAN_LONG_SIDE_PX, fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const W = info.width;
    const H = info.height;
    const ch = info.channels;
    const shortSide = Math.min(W, H);
    let best = 0;

    for (let wr = WIDTH_RATIO_MIN; wr <= WIDTH_RATIO_MAX + 1e-9; wr += WIDTH_RATIO_STEP) {
      const lw = Math.round(shortSide * wr);
      if (lw + 4 > W) continue;
      const tpl = await templateAt(lw);
      for (const pr of PADDING_RATIOS) {
        const pad = Math.round(shortSide * pr);
        const x0 = W - lw - pad;
        const y0 = pad;
        if (x0 < 0 || y0 + tpl.height > H) continue;
        let inSum = 0;
        let inN = 0;
        let outSum = 0;
        let outN = 0;
        for (let y = 0; y < tpl.height; y += SAMPLE_STEP) {
          for (let x = 0; x < lw; x += SAMPLE_STEP) {
            const li = (y * lw + x) * 4;
            const alpha = tpl.rgba[li + 3];
            const ri = ((y0 + y) * W + (x0 + x)) * ch;
            if (alpha >= ALPHA_SOLID) {
              inSum +=
                Math.abs(data[ri] - tpl.rgba[li]) +
                Math.abs(data[ri + 1] - tpl.rgba[li + 1]) +
                Math.abs(data[ri + 2] - tpl.rgba[li + 2]);
              inN++;
            } else if (alpha <= ALPHA_CLEAR) {
              outSum +=
                Math.abs(data[ri] - tpl.meanR) + Math.abs(data[ri + 1] - tpl.meanG) + Math.abs(data[ri + 2] - tpl.meanB);
              outN++;
            }
          }
        }
        if (!inN || !outN) continue;
        const score = outSum / outN / (inSum / inN + 1);
        if (score > best) best = score;
      }
    }

    const score = Math.round(best * 1000) / 1000;
    const verdict = verdictOf(score);
    return { verdict, hasLegacyWatermark: verdict !== 'CLEAN', score };
  }
}
