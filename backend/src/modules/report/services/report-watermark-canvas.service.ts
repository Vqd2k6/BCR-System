/**
 * ============================================================================
 * REPORT WATERMARK CANVAS SERVICE (SHARP SVG COMPOSITING)
 * Dập Watermark lên ảnh khảo sát In-Memory (không ghi đè file gốc trên R2),
 * theo ĐÚNG bố cục watermark FE cũ (frontend/src/utils/watermarkEngine.ts, commit 3ff0fab):
 *   - Góc trên phải: Logo liên danh THACO - CREC, rộng 43.75% cạnh ngắn, cách mép 2.5%.
 *   - Góc dưới phải: 2 dòng chữ trắng viền đen + bóng đổ:
 *       dòng 1 = ngày giờ chụp, dòng 2 = mã ảnh HCM_M2.1_[Mã thửa]_...
 *   - Không in GPS.
 * ============================================================================
 */

import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import { ReportViewModel } from '../report.types';
import { LOGO_THACO_REC_BASE64 } from '../assets/report-logos';
import { normalizeMetroPhotoCode } from '../utils/metro-photo-code.utils';
import { ReportImageResolver } from './report-image-resolver.service';
import { autoRestampLayers, cropToNativeRect, type PixelRect } from '../../photo-qc/photo-qc.rules';
import { WatermarkDetectorService, type LegacyWatermarkDetection } from './watermark-detector.service';
import { LegacyWatermarkIndex } from './legacy-watermark-index.service';
import { walkViewModelPhotos, type VmPhotoRef } from '../../photo-qc/photo-qc.vm-walker';

function clampRect(r: PixelRect, W: number, H: number): PixelRect {
  const left = Math.max(0, Math.min(W, r.left));
  const top = Math.max(0, Math.min(H, r.top));
  return {
    left,
    top,
    width: Math.max(0, Math.min(W, r.left + r.width) - left),
    height: Math.max(0, Math.min(H, r.top + r.height) - top),
  };
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface StampOptions {
  base64Uri: string;
  dateTimeText: string;
  photoCodeText: string;
  alreadyWatermarked?: boolean;
}

/**
 * Kết quả dập 1 ảnh:
 * - stamped / cached: ảnh trả về đã có dấu.
 * - already: ảnh đã có dấu cháy sẵn (ảnh cũ, đã dò hoặc đã xác nhận), không dập thêm.
 * - not-data-uri / too-small / error: ảnh KHÔNG có dấu → report chặn xuất PDF.
 */
export type StampOutcome = 'stamped' | 'cached' | 'already' | 'not-data-uri' | 'too-small' | 'error';

export interface StampResult {
  uri: string;
  outcome: StampOutcome;
}

export interface WatermarkSectionTally {
  total: number;
  stamped: number;
  legacy: number;
  /** Ảnh chưa dập được (mọi loại lỗi). Khác 0 thì PDF nháp và Rev đều bị chặn. */
  failed: number;
}

/** Vì sao một ảnh chưa dập được dấu thật. */
export type WatermarkIssueReason = 'LOAD_FAILED' | 'TOO_SMALL' | 'STAMP_ERROR' | 'SUSPECT_LEGACY';

export interface WatermarkIssue {
  reason: WatermarkIssueReason;
  section: string;
  label: string;
  photoCode: string;
  url: string;
  /** Chi tiết cho người xem: mã HTTP, lý do nghi ngờ, điểm dò… */
  detail: string;
  httpStatus: number | null;
  /** Ảnh dò dấu cũ lưng chừng / dò lỗi: Zone Admin hoặc Super Admin xác nhận từng ảnh. */
  needsLegacyConfirmation: boolean;
  /** File không còn trên R2: Admin phải thay ảnh qua Studio (hệ thống chỉ gợi ý bản thay). */
  fileMissing: boolean;
  score: number | null;
  /** Ảnh nghi ngờ dấu cũ: ảnh gốc thu nhỏ + 2 góc phóng to (logo, chữ giờ/mã) để người xác nhận đối chứng. */
  preview?: WatermarkIssuePreview | null;
}

/** Ảnh đối chứng (data URI JPEG nhỏ) cho hộp lỗi của bản xem trước. */
export interface WatermarkIssuePreview {
  full: string;
  topRight: string;
  bottomRight: string;
}

/** Data URI khung lỗi mang số thứ tự lỗi để script bản xem trước tìm ảnh: data:image/svg+xml;wmissue=<n>;base64,... */
export const WM_ISSUE_URI_PREFIX = 'data:image/svg+xml;wmissue=';

/** Bộ đếm| null;
}

/** Bộ đếm để chứng minh 100% ảnh có watermark thật khi bật chế độ. */
export interface WatermarkVerifyReport extends WatermarkSectionTally {
  bySection: Record<string, WatermarkSectionTally>;
  /** Từng ảnh chưa dập được (mỗi URL một dòng dù xuất hiện ở nhiều ô). */
  issues: WatermarkIssue[];
}

export function isStampApplied(outcome: StampOutcome): boolean {
  return outcome === 'stamped' || outcome === 'cached' || outcome === 'already';
}

/** Thông số bố cục watermark FE cũ (tỉ lệ theo cạnh ngắn của ảnh). */
const LOGO_WIDTH_RATIO = 0.4375;
const LOGO_PADDING_RATIO = 0.025;
const FONT_RATIO = 0.031;
const FONT_MIN_PX = 22;
const LINE_HEIGHT_RATIO = 1.35;
const TEXT_PADDING_RIGHT_RATIO = 0.03;
const TEXT_PADDING_BOTTOM_RATIO = 0.035;
/** Bề rộng trung bình 1 ký tự sans-serif đậm so với cỡ chữ (ước lượng để co chữ khi mã quá dài). */
const AVG_CHAR_WIDTH_EM = 0.6;
const MIN_FONT_SHRINK = 0.6;

export class ReportWatermarkCanvasService {
  private static stampCache = new Map<string, string>();
  private static MAX_CACHE_SIZE = 400;

  /** Giữ cho các nơi chỉ cần ảnh (Photo QC). Dùng stampImage khi cần biết đã dập được hay chưa. */
  public static async stampImageBase64(opts: StampOptions): Promise<string> {
    return (await this.stampImage(opts)).uri;
  }

  public static async stampImage(opts: StampOptions): Promise<StampResult> {
    const { base64Uri, dateTimeText, photoCodeText, alreadyWatermarked } = opts;
    if (alreadyWatermarked) {
      return { uri: base64Uri, outcome: 'already' };
    }
    if (!base64Uri || !base64Uri.startsWith('data:image/')) {
      return { uri: base64Uri, outcome: 'not-data-uri' };
    }

    // Ảnh đã xoay để dàn trang: dập lên ảnh gốc rồi xoay lại, để dấu quay cùng ảnh (bám chiều gốc).
    const origin = ReportImageResolver.getRotationOrigin(base64Uri);
    const sourceUri = origin?.nativeUri ?? base64Uri;
    const deg = origin?.deg ?? 0;

    const cacheKey = `${photoCodeText}|${dateTimeText}|${deg}|${sourceUri.length}|${sourceUri.slice(-64)}`;
    const cached = this.stampCache.get(cacheKey);
    if (cached) {
      return { uri: cached, outcome: 'cached' };
    }

    try {
      const commaIdx = sourceUri.indexOf(',');
      if (commaIdx === -1) return { uri: base64Uri, outcome: 'not-data-uri' };
      let imgBuffer = Buffer.from(sourceUri.slice(commaIdx + 1), 'base64');
      const isPng = sourceUri.startsWith('data:image/png');

      let meta = await sharp(imgBuffer).metadata();
      // Cờ EXIF xoay (ảnh chụp trực tiếp từ máy): đưa pixel về đúng chiều trước khi tính bố cục dấu.
      if (meta.orientation && meta.orientation > 1) {
        imgBuffer = await sharp(imgBuffer).rotate().toBuffer();
        meta = await sharp(imgBuffer).metadata();
      }
      const width = meta.width || 0;
      const height = meta.height || 0;
      if (width < 80 || height < 80) {
        return { uri: base64Uri, outcome: 'too-small' };
      }

      const shortSide = Math.min(width, height);
      const layers: OverlayOptions[] = [];

      const logoLayers = await this.buildLogoLayers(width, height, shortSide);
      layers.push(...logoLayers);

      const textSvg = this.buildTextSvg(width, height, shortSide, dateTimeText, photoCodeText);
      if (textSvg) layers.push({ input: Buffer.from(textSvg), top: 0, left: 0 });

      // PNG (sơ đồ CAD, bản scan) giữ PNG để nét vẽ không bị nhòe do nén JPEG.
      const composed = sharp(imgBuffer).composite(layers);
      const outBuffer = isPng ? await composed.png().toBuffer() : await composed.jpeg({ quality: 90 }).toBuffer();
      const stampedNative = `data:${isPng ? 'image/png' : 'image/jpeg'};base64,${outBuffer.toString('base64')}`;
      const stampedUri = deg ? await ReportImageResolver.rotateUncached(stampedNative, deg) : stampedNative;

      if (this.stampCache.size >= this.MAX_CACHE_SIZE) {
        const firstKey = this.stampCache.keys().next().value;
        if (firstKey) this.stampCache.delete(firstKey);
      }
      this.stampCache.set(cacheKey, stampedUri);
      return { uri: stampedUri, outcome: 'stamped' };
    } catch (err) {
      console.error(`[ReportWatermark:stamp] Không thể dập watermark lên ảnh ${photoCodeText}`, err);
      return { uri: base64Uri, outcome: 'error' };
    }
  }

  /**
   * Photo QC: cắt ảnh theo khung crop rồi dập watermark lên mảnh đã cắt, theo chiều gốc của ảnh
   * (giống stampImageBase64), sau đó mới xoay và encode MỘT lần.
   * - Khung crop tính trên ảnh đã xoay (như admin thấy), được quy về toạ độ ảnh gốc.
   * - stampLogo / stampText tách riêng để dập bù cho ảnh đã có watermark cháy sẵn.
   * - legacyAuto: ảnh có dấu cũ cháy sẵn → tự quyết theo khung cắt (bỏ qua stampLogo/stampText):
   *   vùng logo cũ (vị trí thật do bộ dò tìm) hoặc dòng giờ + mã cũ không còn trọn trong khung thì dập lại phần đó.
   *   Bộ dò không thấy logo trên pixel (cờ "dấu cũ" đến từ luật ngày dự phòng) → ảnh không có dấu, dập đủ cả hai.
   * - Không cache, không ghi file: ảnh gốc trên R2 giữ nguyên từng bit.
   */
  public static async cropStampRotate(opts: {
    base64Uri: string;
    crop: { x: number; y: number; w: number; h: number };
    dateTimeText: string;
    photoCodeText: string;
    stampLogo: boolean;
    stampText: boolean;
    legacyAuto?: boolean;
    onLayersDecided?: (layers: { logo: boolean; text: boolean }, reason: string) => void;
  }): Promise<string> {
    const { base64Uri, crop, dateTimeText, photoCodeText, legacyAuto, onLayersDecided } = opts;
    let { stampLogo, stampText } = opts;
    const origin = ReportImageResolver.getRotationOrigin(base64Uri);
    const sourceUri = origin?.nativeUri ?? base64Uri;
    const deg = origin?.deg ?? 0;
    const commaIdx = sourceUri.indexOf(',');
    if (!sourceUri.startsWith('data:image/') || commaIdx === -1) {
      throw new Error('Ảnh chưa được nạp thành data URI, không cắt được');
    }
    const isPng = sourceUri.startsWith('data:image/png');
    const input = Buffer.from(sourceUri.slice(commaIdx + 1), 'base64');

    // Đưa cờ EXIF về pixel (như stampImageBase64) rồi làm việc trên raw để chỉ nén một lần ở cuối.
    const oriented = await sharp(input).rotate().raw().toBuffer({ resolveWithObject: true });
    const { width: nativeW, height: nativeH, channels } = oriented.info;
    const rect = cropToNativeRect(crop, nativeW, nativeH, deg);
    if (legacyAuto) {
      const decided = await this.decideLegacyRestamp(input, nativeW, nativeH, rect, dateTimeText, photoCodeText);
      stampLogo = decided.layers.logo;
      stampText = decided.layers.text;
      if (onLayersDecided) onLayersDecided(decided.layers, decided.reason);
    }
    const cut = await sharp(oriented.data, { raw: { width: nativeW, height: nativeH, channels } })
      .extract(rect)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const cw = cut.info.width;
    const ch = cut.info.height;

    let pixels = cut.data;
    let pixelChannels = cut.info.channels;
    const layers: OverlayOptions[] = [];
    if (cw >= 80 && ch >= 80) {
      const shortSide = Math.min(cw, ch);
      if (stampLogo) layers.push(...(await this.buildLogoLayers(cw, ch, shortSide)));
      if (stampText) {
        const textSvg = this.buildTextSvg(cw, ch, shortSide, dateTimeText, photoCodeText);
        if (textSvg) layers.push({ input: Buffer.from(textSvg), top: 0, left: 0 });
      }
    }
    if (layers.length > 0) {
      const composed = await sharp(cut.data, { raw: { width: cw, height: ch, channels: cut.info.channels } })
        .composite(layers)
        .raw()
        .toBuffer({ resolveWithObject: true });
      pixels = composed.data;
      pixelChannels = composed.info.channels;
    }

    let out = sharp(pixels, { raw: { width: cw, height: ch, channels: pixelChannels } });
    if (deg) out = out.rotate(deg);
    const outBuffer = isPng ? await out.png().toBuffer() : await out.jpeg({ quality: 92 }).toBuffer();
    return `data:${isPng ? 'image/png' : 'image/jpeg'};base64,${outBuffer.toString('base64')}`;
  }

  /**
   * Quyết định dập lại logo / chữ cho mảnh crop của ảnh có dấu cũ. Toạ độ: pixel ảnh gốc đã xoay theo EXIF.
   * - Logo: khung bộ dò tìm được (+ quầng sáng); bộ dò không thấy logo → coi ảnh không có dấu, dập cả hai.
   * - Chữ: bố cục FE cũ giống hệt bố cục BE (cùng tỉ lệ), ước bề ngang theo độ dài dòng giờ / mã.
   */
  private static async decideLegacyRestamp(
    encoded: Buffer,
    nativeW: number,
    nativeH: number,
    rect: PixelRect,
    dateTimeText: string,
    photoCodeText: string
  ): Promise<{ layers: { logo: boolean; text: boolean }; reason: string }> {
    let detection: LegacyWatermarkDetection;
    try {
      detection = await WatermarkDetectorService.detectLegacyLogo(encoded);
    } catch (err) {
      // Không dò được: giữ an toàn pháp lý theo hướng "mọi ảnh in ra đều có dấu" → vùng logo theo bố cục chuẩn.
      console.error('[ReportWatermark:crop] Không dò được logo cũ trên ảnh crop, dùng vùng logo chuẩn', err);
      detection = { verdict: 'UNSURE', hasLegacyWatermark: true, score: 0, logoBox: null };
    }
    if (!detection.hasLegacyWatermark) {
      return { layers: { logo: true, text: true }, reason: `bộ dò không thấy logo cũ (score ${detection.score})` };
    }

    const shortSide = Math.min(nativeW, nativeH);
    const glow = Math.round(shortSide * 0.014);
    const logoZone: PixelRect = detection.logoBox
      ? {
          left: detection.logoBox.x * nativeW - glow,
          top: detection.logoBox.y * nativeH - glow,
          width: detection.logoBox.w * nativeW + 2 * glow,
          height: detection.logoBox.h * nativeH + 2 * glow,
        }
      : {
          left: nativeW - shortSide * (LOGO_PADDING_RATIO + LOGO_WIDTH_RATIO) - glow,
          top: shortSide * LOGO_PADDING_RATIO - glow,
          width: shortSide * LOGO_WIDTH_RATIO + 2 * glow,
          height: shortSide * LOGO_WIDTH_RATIO * 0.3 + 2 * glow,
        };
    const textZone = await this.textZone(nativeW, nativeH, shortSide, [dateTimeText, photoCodeText]);
    const layers = autoRestampLayers({ logo: clampRect(logoZone, nativeW, nativeH), text: clampRect(textZone, nativeW, nativeH) }, rect);
    return { layers, reason: `dấu cũ ${detection.verdict} (score ${detection.score})` };
  }

  /**
   * Khung bao 2 dòng chữ góc dưới phải: render đúng SVG chữ (cùng bố cục buildTextSvg) rồi lấy khung pixel thật
   * (gồm viền + bóng đổ). Dấu cũ cùng bố cục; mã cũ "HCM_M2.[...]" ngắn hơn mã mới nên khung này phủ trọn chữ cũ.
   */
  private static async textZone(width: number, height: number, shortSide: number, lines: string[]): Promise<PixelRect> {
    const layout = this.textLayout(width, shortSide, Math.max(1, ...lines.map((l) => (l || '').length)));
    const fallback: PixelRect = {
      left: width * 0.3,
      top: height - layout.paddingBottom - layout.lineHeight - layout.fontSize * 1.3,
      width: width * 0.7,
      height: layout.paddingBottom + layout.lineHeight + layout.fontSize * 1.3,
    };
    const svg = this.buildTextSvg(width, height, shortSide, lines[0] || '', lines[1] || '');
    if (!svg) return fallback;
    try {
      const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
      let minX = info.width;
      let minY = info.height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < info.height; y++) {
        const row = y * info.width;
        for (let x = 0; x < info.width; x++) {
          if (data[row + x] < 24) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < 0) return fallback;
      const margin = Math.round(layout.fontSize * 0.25);
      return { left: minX - margin, top: minY - margin, width: maxX - minX + 1 + 2 * margin, height: maxY - minY + 1 + 2 * margin };
    } catch (err) {
      console.error('[ReportWatermark:crop] Không đo được vùng chữ cũ, dùng vùng ước lượng', err);
      return fallback;
    }
  }

  private static textLayout(width: number, shortSide: number, maxChars: number): { fontSize: number; lineHeight: number; paddingRight: number; paddingBottom: number } {
    const paddingRight = Math.round(shortSide * TEXT_PADDING_RIGHT_RATIO);
    const paddingBottom = Math.round(shortSide * TEXT_PADDING_BOTTOM_RATIO);
    let fontSize = Math.max(FONT_MIN_PX, Math.round(shortSide * FONT_RATIO));
    // Co chữ khi dòng dài nhất vượt bề ngang khả dụng (mã căn hộ dài), tối thiểu 60% cỡ chuẩn.
    const available = width - 2 * paddingRight;
    const estimated = maxChars * fontSize * AVG_CHAR_WIDTH_EM;
    if (estimated > available) {
      fontSize = Math.max(Math.round(fontSize * MIN_FONT_SHRINK), Math.floor(available / (maxChars * AVG_CHAR_WIDTH_EM)));
    }
    return { fontSize, lineHeight: Math.round(fontSize * LINE_HEIGHT_RATIO), paddingRight, paddingBottom };
  }

  /** 2 dòng chữ trắng góc dưới phải: ngày giờ (trên) + mã ảnh (dưới). */
  private static buildTextSvg(
    width: number,
    height: number,
    shortSide: number,
    dateTimeText: string,
    photoCodeText: string
  ): string | null {
    const lines = [dateTimeText, photoCodeText].filter((t) => Boolean(t && t.trim()));
    if (lines.length === 0) return null;

    const maxChars = Math.max(...lines.map((l) => l.length));
    const { fontSize, lineHeight, paddingRight, paddingBottom } = this.textLayout(width, shortSide, maxChars);
    const x = width - paddingRight;
    const lastY = height - paddingBottom;
    const strokeW = Math.max(2, fontSize * 0.07).toFixed(1);
    const shadowBlur = (fontSize * 0.14).toFixed(1);
    const shadowDx = Math.max(1.5, Math.round(fontSize * 0.05));
    const shadowDy = Math.max(2, Math.round(fontSize * 0.08));

    const texts = lines
      .map((line, idx) => {
        const y = lastY - (lines.length - 1 - idx) * lineHeight;
        return `<text x="${x}" y="${y}" text-anchor="end" font-family="Arial, Helvetica, 'DejaVu Sans', sans-serif" font-weight="700" font-size="${fontSize}" fill="#FFFFFF" stroke="rgba(0,0,0,0.85)" stroke-width="${strokeW}" paint-order="stroke" filter="url(#wmShadow)">${escapeXml(line)}</text>`;
      })
      .join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><filter id="wmShadow" x="-10%" y="-50%" width="120%" height="200%"><feDropShadow dx="${shadowDx}" dy="${shadowDy}" stdDeviation="${shadowBlur}" flood-color="#000000" flood-opacity="0.9"/></filter></defs>${texts}</svg>`;
  }

  private static logoBuffer: Buffer | null | undefined;

  /** Logo góc trên phải rộng 43.75% cạnh ngắn + quầng trắng mờ phía sau (như FE cũ). */
  private static async buildLogoLayers(width: number, height: number, shortSide: number): Promise<OverlayOptions[]> {
    if (this.logoBuffer === undefined) {
      const commaIdx = LOGO_THACO_REC_BASE64.indexOf(',');
      this.logoBuffer = commaIdx === -1 ? null : Buffer.from(LOGO_THACO_REC_BASE64.slice(commaIdx + 1), 'base64');
      if (!this.logoBuffer) {
        console.error('[ReportWatermark:logo] Không có logo THACO - CREC để dập watermark');
      }
    }
    if (!this.logoBuffer) return [];

    const logoWidth = Math.round(shortSide * LOGO_WIDTH_RATIO);
    const padding = Math.round(shortSide * LOGO_PADDING_RATIO);
    const logo = await sharp(this.logoBuffer).resize({ width: logoWidth }).png().toBuffer();
    const logoMeta = await sharp(logo).metadata();
    const logoHeight = logoMeta.height || 0;
    if (!logoHeight || logoWidth + 2 * padding > width || logoHeight + 2 * padding > height) {
      return [];
    }

    const left = width - padding - logoWidth;
    const top = padding;

    // Quầng trắng: bản trắng của logo làm mờ, đặt dưới logo để logo xanh nổi trên nền tối.
    const glowSigma = Math.max(3, Math.round(shortSide * 0.007));
    const glow = await sharp(logo)
      .ensureAlpha()
      .linear([0, 0, 0, 0.75], [255, 255, 255, 0])
      .blur(glowSigma)
      .png()
      .toBuffer();

    return [
      { input: glow, top, left },
      { input: logo, top, left },
    ];
  }


  /** Tách data URI ảnh raster thành Buffer; SVG / không phải data URI → null. */
  private static rasterBuffer(imageUri: string | undefined): Buffer | null {
    if (!imageUri || !imageUri.startsWith('data:image/') || imageUri.startsWith('data:image/svg')) return null;
    const comma = imageUri.indexOf(',');
    return comma > 0 ? Buffer.from(imageUri.slice(comma + 1), 'base64') : null;
  }

  /** Kích thước hiển thị (đã tính EXIF xoay) của ảnh raster trong data URI; lỗi → null kèm log. */
  private static async rasterDims(imageUri: string | undefined, photoCode: string): Promise<{ width: number; height: number } | null> {
    const buf = this.rasterBuffer(imageUri);
    if (!buf) return null;
    try {
      const meta = await sharp(buf).metadata();
      if (!meta.width || !meta.height) return null;
      const swap = (meta.orientation ?? 1) >= 5;
      return swap ? { width: meta.height, height: meta.width } : { width: meta.width, height: meta.height };
    } catch (err) {
      console.error(`[ReportWatermark:preview] Không đọc được kích thước ảnh ${photoCode}:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Ảnh đối chứng cho ảnh nghi ngờ dấu cũ: ảnh gốc thu nhỏ, góc trên phải (vùng logo) và góc dưới phải
   * (vùng chữ giờ/mã) phóng to. Lỗi thì log và bỏ preview, không làm hỏng lượt render.
   */
  private static async buildIssuePreview(imageUri: string | undefined, photoCode: string): Promise<{ preview: WatermarkIssuePreview; width: number; height: number } | null> {
    const buf = this.rasterBuffer(imageUri);
    if (!buf) return null;
    try {
      const oriented = await sharp(buf).rotate().toBuffer({ resolveWithObject: true });
      const W = oriented.info.width;
      const H = oriented.info.height;
      const toUri = (b: Buffer) => `data:image/jpeg;base64,${b.toString('base64')}`;
      const cw = Math.max(1, Math.round(W * 0.35));
      const ch = Math.max(1, Math.round(H * 0.25));
      const corner = (top: number) => sharp(oriented.data)
        .extract({ left: W - cw, top, width: cw, height: ch })
        .resize({ width: 280 })
        .jpeg({ quality: 82 })
        .toBuffer();
      const [full, topRight, bottomRight] = await Promise.all([
        sharp(oriented.data).resize({ width: 360, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer(),
        corner(0),
        corner(H - ch),
      ]);
      return { preview: { full: toUri(full), topRight: toUri(topRight), bottomRight: toUri(bottomRight) }, width: W, height: H };
    } catch (err) {
      console.error(`[ReportWatermark:preview] Không tạo được ảnh đối chứng cho ${photoCode}:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Ảnh thay chỗ ảnh chưa dập được trong bản XEM TRƯỚC HTML (PDF không bao giờ in khi còn ảnh lỗi).
   * - Nghi ngờ dấu cũ: ảnh gốc RÕ NÉT, đúng tỉ lệ, chỉ viền đỏ + dải nhãn nhỏ ở cạnh dưới bên trái
   *   (để trống 2 góc phải, nơi người xác nhận cần soi logo và chữ giờ/mã).
   * - Lỗi khác: khung đỏ, băng nhãn giữa ảnh, ảnh gốc mờ bên dưới nếu đã nạp được.
   * Data URI mang số thứ tự lỗi (`WM_ISSUE_URI_PREFIX<n>`) để script bản xem trước gắn thanh nút cạnh ảnh.
   */
  private static issuePlaceholder(issue: WatermarkIssue, issueIndex: number, imageUri: string | undefined, dims: { width: number; height: number } | null): string {
    const label = {
      LOAD_FAILED: issue.fileMissing ? 'KHÔNG CÒN FILE ẢNH TRÊN R2' : 'KHÔNG TẢI ĐƯỢC ẢNH',
      TOO_SMALL: 'ẢNH QUÁ NHỎ ĐỂ DẬP DẤU',
      STAMP_ERROR: 'DẬP DẤU LỖI (FILE HỎNG)',
      SUSPECT_LEGACY: 'NGHI NGỜ CÓ DẤU CŨ – CẦN XÁC NHẬN',
    }[issue.reason];
    const raster = this.rasterBuffer(imageUri) ? imageUri : undefined;
    let svg: string;
    if (issue.reason === 'SUSPECT_LEGACY' && raster && dims) {
      const W = dims.width;
      const H = dims.height;
      const u = Math.max(W, H) / 800;
      const stroke = Math.round(8 * u);
      const stripW = Math.round(W * 0.6);
      const stripH = Math.round(64 * u);
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
        + `<image href="${raster}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>`
        + `<rect x="${stroke / 2}" y="${stroke / 2}" width="${W - stroke}" height="${H - stroke}" fill="none" stroke="#c81e1e" stroke-width="${stroke}"/>`
        + `<rect x="${stroke}" y="${H - stroke - stripH}" width="${stripW}" height="${stripH}" fill="#c81e1e" opacity="0.9"/>`
        + `<text x="${stroke + 12 * u}" y="${H - stroke - stripH + 27 * u}" font-family="Arial, sans-serif" font-size="${Math.round(20 * u)}" font-weight="700" fill="#ffffff">CHƯA DẬP · ${escapeXml(label)}</text>`
        + `<text x="${stroke + 12 * u}" y="${H - stroke - stripH + 52 * u}" font-family="Arial, sans-serif" font-size="${Math.round(15 * u)}" fill="#ffffff">${escapeXml(issue.photoCode)}</text>`
        + `</svg>`;
    } else {
      const W = 800;
      const H = 600;
      const img = raster
        ? `<image href="${raster}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet" opacity="0.55"/>`
        : '';
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
        + `<rect width="${W}" height="${H}" fill="#f1f1f1"/>${img}`
        + `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" fill="none" stroke="#c81e1e" stroke-width="12"/>`
        + `<rect x="40" y="${H / 2 - 70}" width="${W - 80}" height="140" fill="#c81e1e" opacity="0.92"/>`
        + `<text x="${W / 2}" y="${H / 2 - 18}" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">CHƯA DẬP ĐƯỢC</text>`
        + `<text x="${W / 2}" y="${H / 2 + 24}" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#ffffff">${escapeXml(label)}</text>`
        + `<text x="${W / 2}" y="${H / 2 + 56}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#ffffff">${escapeXml(issue.photoCode)}</text>`
        + `</svg>`;
    }
    return `${WM_ISSUE_URI_PREFIX}${issueIndex};base64,${Buffer.from(svg).toString('base64')}`;
  }

  /**
   * Dập watermark lên mọi ảnh report sẽ in (walkViewModelPhotos, gồm cả biên bản và bản vẽ) và kiểm 100%:
   * - Ảnh có dấu cũ (dò ≥ ngưỡng hoặc người xác nhận): không dập thêm.
   * - Ảnh nghi ngờ dấu cũ (lưng chừng / dò lỗi / chưa dò): KHÔNG dập, ghi lỗi chờ người xác nhận.
   * - Ảnh không nạp được, quá nhỏ, dập lỗi (đã thử lại 1 lần): ghi lỗi kèm lý do.
   * Ảnh lỗi được thay bằng khung đỏ để bản xem trước chỉ rõ; PDF nháp và Rev bị chặn khi còn lỗi.
   * `stamp = false` (tắt watermark): chỉ kiểm ảnh nạp được hay không, không dập, không xét dấu cũ.
   */
  public static async applyWatermarksToViewModel(vm: ReportViewModel, options: { stamp?: boolean } = {}): Promise<WatermarkVerifyReport> {
    const doStamp = options.stamp !== false;
    const report: WatermarkVerifyReport = { total: 0, stamped: 0, legacy: 0, failed: 0, bySection: {}, issues: [] };
    const issueByUrl = new Map<string, WatermarkIssue>();
    const tally = (section: string, kind: 'stamped' | 'legacy' | 'failed') => {
      const sec = (report.bySection[section] ||= { total: 0, stamped: 0, legacy: 0, failed: 0 });
      for (const t of [report, sec]) {
        t.total += 1;
        t[kind] += 1;
      }
    };
    const issueIndexByUrl = new Map<string, number>();
    const fail = async (ref: VmPhotoRef, issue: Omit<WatermarkIssue, 'section' | 'label' | 'photoCode' | 'url'>): Promise<void> => {
      const full: WatermarkIssue = { ...issue, section: ref.section, label: ref.label, photoCode: ref.photoCodeText, url: ref.url };
      const imageUri = ref.getBase64();
      let dims: { width: number; height: number } | null = null;
      if (!issueByUrl.has(ref.url)) {
        if (issue.reason === 'SUSPECT_LEGACY') {
          const built = await this.buildIssuePreview(imageUri, ref.photoCodeText);
          full.preview = built?.preview ?? null;
          dims = built ? { width: built.width, height: built.height } : null;
        }
        issueIndexByUrl.set(ref.url, issueByUrl.size);
        issueByUrl.set(ref.url, full);
      } else if (issue.reason === 'SUSPECT_LEGACY') {
        // Cùng URL ở ô khác (có thể crop/xoay khác): chỉ cần kích thước ảnh của ô này.
        dims = await this.rasterDims(imageUri, ref.photoCodeText);
      }
      tally(ref.section, 'failed');
      console.error(`[ReportWatermark:verify] ${ref.label} (${ref.photoCodeText}) chưa dập được: ${issue.reason} – ${issue.detail}`, ref.url);
      // Bản xem trước: thay bằng khung đỏ, đánh dấu đã xử lý để template không phủ thêm chữ.
      ref.setBase64(this.issuePlaceholder(full, issueIndexByUrl.get(ref.url) ?? 0, imageUri, dims));
      ref.markWatermarked();
    };

    if (vm.metadata && !vm.metadata.coverWatermarkCode) {
      const parcel = vm.metadata.projectParcelCode || vm.metadata.buildingId || 'CHƯA_ĐỊNH_DANH';
      vm.metadata.coverWatermarkCode = normalizeMetroPhotoCode('P02_MAIN', parcel, vm.metadata.unitCode);
    }

    for (const ref of walkViewModelPhotos(vm, { includeDocuments: true })) {
      const base64 = ref.getBase64();
      if (!base64 || !base64.startsWith('data:image/')) {
        const lf = ReportImageResolver.getLoadFailure(ref.url);
        await fail(ref, {
          reason: 'LOAD_FAILED',
          detail: lf ? lf.message : 'Ảnh chưa được nạp vào lượt render',
          httpStatus: lf?.httpStatus ?? null,
          needsLegacyConfirmation: false,
          fileMissing: lf?.kind === 'NOT_FOUND',
          score: null,
        });
        continue;
      }
      if (!doStamp) {
        tally(ref.section, 'stamped');
        continue;
      }

      const legacy = LegacyWatermarkIndex.statusOf(ref.url);
      if (legacy?.status === 'SUSPECT') {
        const why = legacy.suspectReason === 'UNSURE'
          ? `Điểm dò logo ${legacy.score?.toFixed(2)} nằm trong vùng nghi ngờ`
          : legacy.suspectReason === 'DETECT_FAILED' ? 'Bộ dò logo không đọc được ảnh' : 'Ảnh chưa được dò dấu cũ';
        await fail(ref, { reason: 'SUSPECT_LEGACY', detail: why, httpStatus: null, needsLegacyConfirmation: true, fileMissing: false, score: legacy.score });
        continue;
      }
      if (legacy?.status === 'LEGACY') {
        ref.markWatermarked();
        tally(ref.section, 'legacy');
        continue;
      }
      // Sạch (hoặc ảnh không phải URL ảnh hiện trường). Đã dập ở bước crop Photo QC thì không dập lại.
      if (ref.isWatermarked()) {
        tally(ref.section, 'stamped');
        continue;
      }
      let r = await this.stampImage({ base64Uri: base64, dateTimeText: ref.dateTimeText, photoCodeText: ref.photoCodeText });
      if (r.outcome === 'error') {
        console.warn(`[ReportWatermark:stamp] Dập lỗi, thử lại 1 lần: ${ref.label}`, ref.url);
        r = await this.stampImage({ base64Uri: base64, dateTimeText: ref.dateTimeText, photoCodeText: ref.photoCodeText });
      }
      if (isStampApplied(r.outcome)) {
        ref.setBase64(r.uri);
        ref.markWatermarked();
        tally(ref.section, 'stamped');
        continue;
      }
      await fail(ref, {
        reason: r.outcome === 'too-small' ? 'TOO_SMALL' : 'STAMP_ERROR',
        detail: r.outcome === 'too-small' ? 'Ảnh nhỏ hơn 80px, không đủ chỗ dập dấu' : 'Dập dấu lỗi sau 2 lần thử (file ảnh có thể hỏng)',
        httpStatus: null,
        needsLegacyConfirmation: false,
        fileMissing: false,
        score: null,
      });
    }

    report.issues = [...issueByUrl.values()];
    const summary = { reportNo: vm.metadata?.reportNo, total: report.total, stamped: report.stamped, legacy: report.legacy, failed: report.failed };
    if (report.failed > 0) {
      console.error('[ReportWatermark:verify] Có ảnh chưa dập được watermark, PDF sẽ bị chặn:', summary, report.bySection);
    } else {
      console.log('[ReportWatermark:verify]', summary);
    }
    return report;
  }
}
