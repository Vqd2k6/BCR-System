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
import { cropToNativeRect } from '../../photo-qc/photo-qc.rules';

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

    // Ảnh đã xoay để dàn trang: dập lên ảnh gốc rồi xoay lại, để dấu quay cùng ảnh (bám chiều gốc).
    const origin = ReportImageResolver.getRotationOrigin(base64Uri);
    const sourceUri = origin?.nativeUri ?? base64Uri;
    const deg = origin?.deg ?? 0;

    const cacheKey = `${photoCodeText}|${dateTimeText}|${deg}|${sourceUri.length}|${sourceUri.slice(-64)}`;
    if (this.stampCache.has(cacheKey)) {
      return this.stampCache.get(cacheKey)!;
    }

    try {
      const commaIdx = sourceUri.indexOf(',');
      if (commaIdx === -1) return base64Uri;
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
        return base64Uri;
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
      return stampedUri;
    } catch (err) {
      console.error(`[ReportWatermark:stamp] Không thể dập watermark lên ảnh ${photoCodeText}`, err);
      return base64Uri;
    }
  }

  /**
   * Photo QC: cắt ảnh theo khung crop rồi dập watermark lên mảnh đã cắt, theo chiều gốc của ảnh
   * (giống stampImageBase64), sau đó mới xoay và encode MỘT lần.
   * - Khung crop tính trên ảnh đã xoay (như admin thấy), được quy về toạ độ ảnh gốc.
   * - stampLogo / stampText tách riêng để dập bù cho ảnh đã có watermark cháy sẵn.
   * - Không cache, không ghi file: ảnh gốc trên R2 giữ nguyên từng bit.
   */
  public static async cropStampRotate(opts: {
    base64Uri: string;
    crop: { x: number; y: number; w: number; h: number };
    dateTimeText: string;
    photoCodeText: string;
    stampLogo: boolean;
    stampText: boolean;
  }): Promise<string> {
    const { base64Uri, crop, dateTimeText, photoCodeText, stampLogo, stampText } = opts;
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
      // Sơ đồ CAD mặt bằng kiến trúc / kết cấu (dấu theo chiều gốc bản vẽ, trình duyệt xoay dọc thì dấu xoay theo).
      if (fl.damageMapBase64 && !fl.damageMapAlreadyWatermarked) {
        fl.damageMapBase64 = await this.stampImageBase64({
          base64Uri: fl.damageMapBase64,
          dateTimeText: defaultDate,
          photoCodeText: fl.damageMapWatermarkCode || code(`F${String(fl.floorOrder).padStart(2, '0')}_CAD_ARCH`),
        });
        fl.damageMapAlreadyWatermarked = true;
      }
      if (fl.structuralMapBase64 && !fl.structuralMapAlreadyWatermarked) {
        fl.structuralMapBase64 = await this.stampImageBase64({
          base64Uri: fl.structuralMapBase64,
          dateTimeText: defaultDate,
          photoCodeText: fl.structuralMapWatermarkCode || code(`F${String(fl.floorOrder).padStart(2, '0')}_CAD_STRUCT`),
        });
        fl.structuralMapAlreadyWatermarked = true;
      }

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

    // Mục XI: bản scan biên bản hiện trường / thông báo vắng chủ.
    for (const page of vm.appendix3?.signedRecordPages || []) {
      if (page.base64 && !page.alreadyWatermarked) {
        page.base64 = await this.stampImageBase64({
          base64Uri: page.base64,
          dateTimeText: page.watermarkDateTime || defaultDate,
          photoCodeText: page.metroPhotoCode || code(`DOC_MINUTES_${String(page.pageIndex).padStart(2, '0')}`),
        });
        page.alreadyWatermarked = true;
      }
    }

    // Mục XII: bản vẽ thiết kế / hoàn công do chủ hộ cung cấp.
    for (const sheet of vm.section12AsBuilt?.sheets || []) {
      for (const drawing of sheet.drawings || []) {
        if (drawing.base64 && !drawing.alreadyWatermarked) {
          drawing.base64 = await this.stampImageBase64({
            base64Uri: drawing.base64,
            dateTimeText: defaultDate,
            photoCodeText: code(drawing.photoCode || `CAT-DWG-${String(drawing.index).padStart(2, '0')}`),
          });
          drawing.alreadyWatermarked = true;
        }
      }
    }
  }
}
