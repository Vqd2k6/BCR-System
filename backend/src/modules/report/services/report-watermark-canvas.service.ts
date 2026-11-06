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

  public static async stampImageBase64(opts: StampOptions): Promise<string> {
    const { base64Uri, dateTimeText, photoCodeText, alreadyWatermarked } = opts;
    if (!base64Uri || !base64Uri.startsWith('data:image/')) {
      return base64Uri;
    }
    if (alreadyWatermarked) {
      return base64Uri;
    }

    const cacheKey = `${photoCodeText}|${dateTimeText}|${base64Uri.length}|${base64Uri.slice(-64)}`;
    if (this.stampCache.has(cacheKey)) {
      return this.stampCache.get(cacheKey)!;
    }

    try {
      const commaIdx = base64Uri.indexOf(',');
      if (commaIdx === -1) return base64Uri;
      const imgBuffer = Buffer.from(base64Uri.slice(commaIdx + 1), 'base64');

      const meta = await sharp(imgBuffer).metadata();
      const width = meta.width || 0;
      const height = meta.height || 0;
      if (width < 80 || height < 80) {
        return base64Uri;
      }

      const shortSide = Math.min(width, height);
      const layers: OverlayOptions[] = [];

      const logoLayers = await this.buildLogoLayers(width, height, shortSide);
      layers.push(...logoLayers);

      const textSvg = this.buildTextSvg(width, height, shortSide, dateTimeText, photoCodeText);
      if (textSvg) layers.push({ input: Buffer.from(textSvg), top: 0, left: 0 });

      const outBuffer = await sharp(imgBuffer).composite(layers).jpeg({ quality: 90 }).toBuffer();
      const stampedUri = `data:image/jpeg;base64,${outBuffer.toString('base64')}`;

      if (this.stampCache.size >= this.MAX_CACHE_SIZE) {
        const firstKey = this.stampCache.keys().next().value;
        if (firstKey) this.stampCache.delete(firstKey);
      }
      this.stampCache.set(cacheKey, stampedUri);
      return stampedUri;
    } catch (err) {
      console.error(`[ReportWatermark:stamp] Không thể dập watermark lên ảnh ${photoCodeText}`, err);
      return base64Uri;
    }
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

    const paddingRight = Math.round(shortSide * TEXT_PADDING_RIGHT_RATIO);
    const paddingBottom = Math.round(shortSide * TEXT_PADDING_BOTTOM_RATIO);
    let fontSize = Math.max(FONT_MIN_PX, Math.round(shortSide * FONT_RATIO));

    // Co chữ khi dòng dài nhất vượt bề ngang khả dụng (mã căn hộ dài), tối thiểu 60% cỡ chuẩn.
    const maxChars = Math.max(...lines.map((l) => l.length));
    const available = width - 2 * paddingRight;
    const estimated = maxChars * fontSize * AVG_CHAR_WIDTH_EM;
    if (estimated > available) {
      fontSize = Math.max(Math.round(fontSize * MIN_FONT_SHRINK), Math.floor(available / (maxChars * AVG_CHAR_WIDTH_EM)));
    }

    const lineHeight = Math.round(fontSize * LINE_HEIGHT_RATIO);
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

  public static async applyWatermarksToViewModel(vm: ReportViewModel): Promise<void> {
    const defaultDate = vm.metadata?.surveyDateFormatted || '';
    const parcel = vm.metadata?.projectParcelCode || vm.metadata?.buildingId || 'CHƯA_ĐỊNH_DANH';
    const unit = vm.metadata?.unitCode;
    const code = (raw: string) => normalizeMetroPhotoCode(raw, parcel, unit);

    if (vm.metadata?.coverPhotoBase64) {
      const p02Item = (vm.appendix1 || []).find((p) => p.photoCode === 'P-02');
      const heroDt = vm.metadata.coverWatermarkDateTime || p02Item?.watermarkDateTime || defaultDate;
      const coverCode = vm.metadata.coverWatermarkCode || code('P02_MAIN');
      vm.metadata.coverWatermarkCode = coverCode;
      // Cờ của chính ảnh bìa (ảnh bìa có thể lấy từ P-01 khi thiếu P-02), không mượn cờ của P-02.
      vm.metadata.coverPhotoBase64 = await this.stampImageBase64({
        base64Uri: vm.metadata.coverPhotoBase64,
        dateTimeText: heroDt,
        photoCodeText: coverCode,
        alreadyWatermarked: vm.metadata.coverAlreadyWatermarked,
      });
      vm.metadata.coverAlreadyWatermarked = true;
    }

    if (vm.section5?.tiltPhoto?.base64) {
      vm.section5.tiltPhoto.base64 = await this.stampImageBase64({
        base64Uri: vm.section5.tiltPhoto.base64,
        dateTimeText: defaultDate,
        photoCodeText: code('EXT_TILT_01'),
        alreadyWatermarked: vm.section5.tiltPhoto.alreadyWatermarked,
      });
      vm.section5.tiltPhoto.alreadyWatermarked = true;
    }

    if (vm.section5?.settlementPhoto?.base64) {
      vm.section5.settlementPhoto.base64 = await this.stampImageBase64({
        base64Uri: vm.section5.settlementPhoto.base64,
        dateTimeText: defaultDate,
        photoCodeText: code('FOUND_SETTLE_01'),
        alreadyWatermarked: vm.section5.settlementPhoto.alreadyWatermarked,
      });
      vm.section5.settlementPhoto.alreadyWatermarked = true;
    }

    for (const item of vm.appendix1 || []) {
      if (item.base64 && !item.alreadyWatermarked) {
        item.base64 = await this.stampImageBase64({
          base64Uri: item.base64,
          dateTimeText: item.watermarkDateTime || item.capturedAt || defaultDate,
          photoCodeText: item.metroPhotoCode || code(item.originalTag || item.photoCode),
        });
        item.alreadyWatermarked = true;
      }
    }

    for (const fl of vm.appendix2 || []) {
      for (const pair of fl.defectPairPhotos || []) {
        if (pair.contextPhotoBase64 && !pair.contextAlreadyWatermarked) {
          pair.contextPhotoBase64 = await this.stampImageBase64({
            base64Uri: pair.contextPhotoBase64,
            dateTimeText: pair.contextDateTime || defaultDate,
            photoCodeText: pair.contextWatermarkCode || code(pair.contextPhotoCode || `${pair.defectId}_CTX`),
          });
          pair.contextAlreadyWatermarked = true;
        }
        if (pair.closeUpPhotoBase64 && !pair.closeUpAlreadyWatermarked) {
          pair.closeUpPhotoBase64 = await this.stampImageBase64({
            base64Uri: pair.closeUpPhotoBase64,
            dateTimeText: pair.closeUpDateTime || defaultDate,
            photoCodeText: pair.closeUpWatermarkCode || code(pair.closeUpPhotoCode || `${pair.defectId}_CU_01`),
          });
          pair.closeUpAlreadyWatermarked = true;
        }
        if (pair.extraCloseUpPhotoBase64 && !pair.extraCloseUpAlreadyWatermarked) {
          pair.extraCloseUpPhotoBase64 = await this.stampImageBase64({
            base64Uri: pair.extraCloseUpPhotoBase64,
            dateTimeText: pair.extraCloseUpDateTime || defaultDate,
            photoCodeText:
              pair.extraCloseUpWatermarkCode || code(pair.extraCloseUpPhotoCode || `${pair.defectId}_CU_02`),
          });
          pair.extraCloseUpAlreadyWatermarked = true;
        }
      }

      for (const page of [...(fl.overviewPages || []), ...(fl.elementOverviewPages || [])]) {
        for (const photo of page.photos || []) {
          if (photo.base64 && !photo.alreadyWatermarked) {
            photo.base64 = await this.stampImageBase64({
              base64Uri: photo.base64,
              dateTimeText: photo.watermarkDateTime || defaultDate,
              photoCodeText: photo.metroPhotoCode || code(`${photo.zoneCode}_${photo.photoId}`),
            });
            photo.alreadyWatermarked = true;
          }
        }
      }
    }
  }
}
