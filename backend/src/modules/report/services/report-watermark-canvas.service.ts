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
 * - already: ảnh đã có dấu cháy sẵn (ảnh cũ), không dập thêm.
 * - not-data-uri / too-small / error: ảnh trả về KHÔNG có dấu → template phải hiện lớp CSS dự phòng.
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
  cssFallback: number;
  errors: number;
}

/** Bộ đếm để chứng minh 100% ảnh có watermark khi bật chế độ. */
export interface WatermarkVerifyReport extends WatermarkSectionTally {
  bySection: Record<string, WatermarkSectionTally>;
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

  /**
   * Dập watermark lên mọi ảnh của report. Cờ *AlreadyWatermarked chỉ bật khi ảnh thực sự có dấu;
   * ảnh dập thất bại giữ cờ tắt để template hiện lớp watermark CSS dự phòng.
   */
  public static async applyWatermarksToViewModel(vm: ReportViewModel): Promise<WatermarkVerifyReport> {
    const defaultDate = vm.metadata?.surveyDateFormatted || '';
    const parcel = vm.metadata?.projectParcelCode || vm.metadata?.buildingId || 'CHƯA_ĐỊNH_DANH';
    const unit = vm.metadata?.unitCode;
    const code = (raw: string) => normalizeMetroPhotoCode(raw, parcel, unit);

    const report: WatermarkVerifyReport = { total: 0, stamped: 0, legacy: 0, cssFallback: 0, errors: 0, bySection: {} };
    const tally = (section: string, outcome: StampOutcome) => {
      const sec = (report.bySection[section] ||= { total: 0, stamped: 0, legacy: 0, cssFallback: 0, errors: 0 });
      for (const t of [report, sec]) {
        t.total += 1;
        if (outcome === 'stamped' || outcome === 'cached') t.stamped += 1;
        else if (outcome === 'already') t.legacy += 1;
        else {
          t.cssFallback += 1;
          if (outcome === 'error') t.errors += 1;
        }
      }
    };
    const stamp = async (
      section: string,
      base64Uri: string,
      dateTimeText: string,
      photoCodeText: string,
      alreadyWatermarked?: boolean
    ): Promise<StampResult> => {
      const r = await this.stampImage({ base64Uri, dateTimeText, photoCodeText, alreadyWatermarked });
      tally(section, r.outcome);
      if (!isStampApplied(r.outcome)) {
        console.error(`[ReportWatermark:verify] Ảnh ${photoCodeText} (${section}) không dập được (${r.outcome}), dùng lớp CSS dự phòng`);
      }
      return r;
    };

    if (vm.metadata?.coverPhotoBase64) {
      const p02Item = (vm.appendix1 || []).find((p) => p.photoCode === 'P-02');
      const heroDt = vm.metadata.coverWatermarkDateTime || p02Item?.watermarkDateTime || defaultDate;
      const coverCode = vm.metadata.coverWatermarkCode || code('P02_MAIN');
      vm.metadata.coverWatermarkCode = coverCode;
      // Cờ của chính ảnh bìa (ảnh bìa có thể lấy từ P-01 khi thiếu P-02), không mượn cờ của P-02.
      const r = await stamp('cover', vm.metadata.coverPhotoBase64, heroDt, coverCode, vm.metadata.coverAlreadyWatermarked);
      vm.metadata.coverPhotoBase64 = r.uri;
      vm.metadata.coverAlreadyWatermarked = isStampApplied(r.outcome);
    }

    if (vm.section5?.tiltPhoto?.base64) {
      const r = await stamp('section5', vm.section5.tiltPhoto.base64, defaultDate, code('EXT_TILT_01'), vm.section5.tiltPhoto.alreadyWatermarked);
      vm.section5.tiltPhoto.base64 = r.uri;
      vm.section5.tiltPhoto.alreadyWatermarked = isStampApplied(r.outcome);
    }

    if (vm.section5?.settlementPhoto?.base64) {
      const r = await stamp('section5', vm.section5.settlementPhoto.base64, defaultDate, code('FOUND_SETTLE_01'), vm.section5.settlementPhoto.alreadyWatermarked);
      vm.section5.settlementPhoto.base64 = r.uri;
      vm.section5.settlementPhoto.alreadyWatermarked = isStampApplied(r.outcome);
    }

    for (const item of vm.appendix1 || []) {
      if (!item.base64) continue;
      const r = await stamp(
        'appendix1',
        item.base64,
        item.watermarkDateTime || item.capturedAt || defaultDate,
        item.metroPhotoCode || code(item.originalTag || item.photoCode),
        item.alreadyWatermarked
      );
      item.base64 = r.uri;
      item.alreadyWatermarked = isStampApplied(r.outcome);
    }

    for (const fl of vm.appendix2 || []) {
      // Sơ đồ CAD mặt bằng kiến trúc / kết cấu (dấu theo chiều gốc bản vẽ, trình duyệt xoay dọc thì dấu xoay theo).
      if (fl.damageMapBase64) {
        const r = await stamp(
          'cad',
          fl.damageMapBase64,
          defaultDate,
          fl.damageMapWatermarkCode || code(`F${String(fl.floorOrder).padStart(2, '0')}_CAD_ARCH`),
          fl.damageMapAlreadyWatermarked
        );
        fl.damageMapBase64 = r.uri;
        fl.damageMapAlreadyWatermarked = isStampApplied(r.outcome);
      }
      if (fl.structuralMapBase64) {
        const r = await stamp(
          'cad',
          fl.structuralMapBase64,
          defaultDate,
          fl.structuralMapWatermarkCode || code(`F${String(fl.floorOrder).padStart(2, '0')}_CAD_STRUCT`),
          fl.structuralMapAlreadyWatermarked
        );
        fl.structuralMapBase64 = r.uri;
        fl.structuralMapAlreadyWatermarked = isStampApplied(r.outcome);
      }

      for (const pair of fl.defectPairPhotos || []) {
        if (pair.contextPhotoBase64) {
          const r = await stamp(
            'defects',
            pair.contextPhotoBase64,
            pair.contextDateTime || defaultDate,
            pair.contextWatermarkCode || code(pair.contextPhotoCode || `${pair.defectId}_CTX`),
            pair.contextAlreadyWatermarked
          );
          pair.contextPhotoBase64 = r.uri;
          pair.contextAlreadyWatermarked = isStampApplied(r.outcome);
        }
        if (pair.closeUpPhotoBase64) {
          const r = await stamp(
            'defects',
            pair.closeUpPhotoBase64,
            pair.closeUpDateTime || defaultDate,
            pair.closeUpWatermarkCode || code(pair.closeUpPhotoCode || `${pair.defectId}_CU_01`),
            pair.closeUpAlreadyWatermarked
          );
          pair.closeUpPhotoBase64 = r.uri;
          pair.closeUpAlreadyWatermarked = isStampApplied(r.outcome);
        }
        if (pair.extraCloseUpPhotoBase64) {
          const r = await stamp(
            'defects',
            pair.extraCloseUpPhotoBase64,
            pair.extraCloseUpDateTime || defaultDate,
            pair.extraCloseUpWatermarkCode || code(pair.extraCloseUpPhotoCode || `${pair.defectId}_CU_02`),
            pair.extraCloseUpAlreadyWatermarked
          );
          pair.extraCloseUpPhotoBase64 = r.uri;
          pair.extraCloseUpAlreadyWatermarked = isStampApplied(r.outcome);
        }
      }

      for (const page of [...(fl.overviewPages || []), ...(fl.elementOverviewPages || [])]) {
        for (const photo of page.photos || []) {
          if (!photo.base64) continue;
          const r = await stamp(
            'overview',
            photo.base64,
            photo.watermarkDateTime || defaultDate,
            photo.metroPhotoCode || code(`${photo.zoneCode}_${photo.photoId}`),
            photo.alreadyWatermarked
          );
          photo.base64 = r.uri;
          photo.alreadyWatermarked = isStampApplied(r.outcome);
        }
      }
    }

    // Mục XI: bản scan biên bản hiện trường / thông báo vắng chủ.
    for (const page of vm.appendix3?.signedRecordPages || []) {
      if (!page.base64) continue;
      const r = await stamp(
        'minutes',
        page.base64,
        page.watermarkDateTime || defaultDate,
        page.metroPhotoCode || code(`DOC_MINUTES_${String(page.pageIndex).padStart(2, '0')}`),
        page.alreadyWatermarked
      );
      page.base64 = r.uri;
      page.alreadyWatermarked = isStampApplied(r.outcome);
    }

    // Mục XII: bản vẽ thiết kế / hoàn công do chủ hộ cung cấp.
    for (const sheet of vm.section12AsBuilt?.sheets || []) {
      for (const drawing of sheet.drawings || []) {
        if (!drawing.base64) continue;
        const r = await stamp(
          'asbuilt',
          drawing.base64,
          defaultDate,
          code(drawing.photoCode || `CAT-DWG-${String(drawing.index).padStart(2, '0')}`),
          drawing.alreadyWatermarked
        );
        drawing.base64 = r.uri;
        drawing.alreadyWatermarked = isStampApplied(r.outcome);
      }
    }

    const summary = { reportNo: vm.metadata?.reportNo, total: report.total, stamped: report.stamped, legacy: report.legacy, cssFallback: report.cssFallback, errors: report.errors };
    if (report.cssFallback > 0) {
      console.error('[ReportWatermark:verify] Có ảnh không dập được watermark ở máy chủ:', summary, report.bySection);
    } else {
      console.log('[ReportWatermark:verify]', summary);
    }
    return report;
  }
}
