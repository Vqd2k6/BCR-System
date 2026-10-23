/**
 * ============================================================================
 * REPORT WATERMARK CANVAS SERVICE (SHARP SVG COMPOSITING)
 * Dập trực tiếp Watermark kỹ thuật lên ảnh khảo sát In-Memory (Không ghi đè file gốc):
 *   - Góc dưới phải: Thời gian khảo sát (hoặc thời gian chụp ảnh thực tế)
 *   - Góc dưới trái: Tọa độ GPS thực tế của công trình
 *   - Góc trên trái: Mã ảnh chuẩn hóa HCM_M2.[Mã_Nhà]_[Loại_Ảnh]
 * ============================================================================
 */

import sharp from 'sharp';
import { ReportViewModel } from '../report.types';

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
  gpsText: string;
  photoCodeText: string;
  alreadyWatermarked?: boolean;
}

export class ReportWatermarkCanvasService {
  private static stampCache = new Map<string, string>();
  private static MAX_CACHE_SIZE = 400;

  public static async stampImageBase64(opts: StampOptions): Promise<string> {
    const { base64Uri, dateTimeText, gpsText, photoCodeText, alreadyWatermarked } = opts;
    if (!base64Uri || !base64Uri.startsWith('data:image/')) {
      return base64Uri;
    }
    if (alreadyWatermarked) {
      return base64Uri;
    }

    const cacheKey = `${photoCodeText}|${dateTimeText}|${gpsText}|${base64Uri.slice(-64)}`;
    if (this.stampCache.has(cacheKey)) {
      return this.stampCache.get(cacheKey)!;
    }

    try {
      const commaIdx = base64Uri.indexOf(',');
      if (commaIdx === -1) return base64Uri;
      const rawB64 = base64Uri.slice(commaIdx + 1);
      const imgBuffer = Buffer.from(rawB64, 'base64');

      const meta = await sharp(imgBuffer).metadata();
      const width = meta.width || 0;
      const height = meta.height || 0;

      if (width < 80 || height < 80) {
        return base64Uri;
      }

      const refDim = Math.min(width, height);
      const fontSize = Math.max(14, Math.min(48, Math.round(refDim * 0.032)));
      const padX = Math.max(12, Math.round(width * 0.022));
      const padY = Math.max(12, Math.round(height * 0.024));
      const strokeW = Math.max(2.5, Math.round(fontSize * 0.16));
      const bottomY = height - padY;

      const svgParts: string[] = [];
      if (photoCodeText) {
        svgParts.push(
          `<text x="${padX}" y="${padY + fontSize}" text-anchor="start" font-family="Times New Roman, Arial, sans-serif" font-weight="bold" font-size="${fontSize}" fill="#FACC15" stroke="rgba(0,0,0,0.85)" stroke-width="${strokeW}" paint-order="stroke">${escapeXml(photoCodeText)}</text>`
        );
      }
      if (gpsText) {
        svgParts.push(
          `<text x="${padX}" y="${bottomY}" text-anchor="start" font-family="Times New Roman, Arial, sans-serif" font-weight="bold" font-size="${fontSize}" fill="#FFFFFF" stroke="rgba(0,0,0,0.85)" stroke-width="${strokeW}" paint-order="stroke">${escapeXml(gpsText)}</text>`
        );
      }
      if (dateTimeText) {
        svgParts.push(
          `<text x="${width - padX}" y="${bottomY}" text-anchor="end" font-family="Times New Roman, Arial, sans-serif" font-weight="bold" font-size="${fontSize}" fill="#FFFFFF" stroke="rgba(0,0,0,0.85)" stroke-width="${strokeW}" paint-order="stroke">${escapeXml(dateTimeText)}</text>`
        );
      }

      const svgOverlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${svgParts.join('')}</svg>`;
      const outBuffer = await sharp(imgBuffer)
        .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
        .jpeg({ quality: 90 })
        .toBuffer();

      const stampedUri = `data:image/jpeg;base64,${outBuffer.toString('base64')}`;

      if (this.stampCache.size >= this.MAX_CACHE_SIZE) {
        const firstKey = this.stampCache.keys().next().value;
        if (firstKey) this.stampCache.delete(firstKey);
      }
      this.stampCache.set(cacheKey, stampedUri);

      return stampedUri;
    } catch (err) {
      console.warn('⚠️ [ReportWatermarkCanvasService] Không thể dập watermark lên ảnh:', err);
      return base64Uri;
    }
  }

  public static async applyWatermarksToViewModel(vm: ReportViewModel): Promise<void> {
    const buildingId = vm.metadata?.buildingId || 'CHƯA_ĐỊNH_DANH';
    const defaultDate = vm.metadata?.surveyDateFormatted || '';
    const gpsObj = vm.section1?.gpsCoords;
    const rawGps = gpsObj && (gpsObj.lat || gpsObj.lng) ? `${gpsObj.lat}, ${gpsObj.lng}` : '';
    const gpsText = rawGps && !rawGps.includes('--') ? `GPS: ${rawGps}` : '';

    if (vm.metadata?.coverPhotoBase64) {
      const p02Item = (vm.appendix1 || []).find((p) => p.photoCode === 'P-02');
      const heroDt = p02Item?.watermarkDateTime || defaultDate;
      vm.metadata.coverPhotoBase64 = await this.stampImageBase64({
        base64Uri: vm.metadata.coverPhotoBase64,
        dateTimeText: heroDt,
        gpsText,
        photoCodeText: `HCM_M2.[${buildingId}]_P02_MAIN`,
        alreadyWatermarked: p02Item?.alreadyWatermarked,
      });
    }

    if (vm.section5?.tiltPhoto?.base64) {
      vm.section5.tiltPhoto.base64 = await this.stampImageBase64({
        base64Uri: vm.section5.tiltPhoto.base64,
        dateTimeText: defaultDate,
        gpsText,
        photoCodeText: `HCM_M2.[${buildingId}]_EXT_TILT_01`,
      });
    }

    if (vm.section5?.settlementPhoto?.base64) {
      vm.section5.settlementPhoto.base64 = await this.stampImageBase64({
        base64Uri: vm.section5.settlementPhoto.base64,
        dateTimeText: defaultDate,
        gpsText,
        photoCodeText: `HCM_M2.[${buildingId}]_EXT_SETTLE_01`,
      });
    }

    for (const item of vm.appendix1 || []) {
      if (item.base64 && !item.alreadyWatermarked) {
        item.base64 = await this.stampImageBase64({
          base64Uri: item.base64,
          dateTimeText: item.watermarkDateTime || item.capturedAt || defaultDate,
          gpsText: item.gpsCoords ? `GPS: ${item.gpsCoords}` : gpsText,
          photoCodeText: item.metroPhotoCode || `HCM_M2.[${buildingId}]_${item.originalTag || item.photoCode}`,
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
            gpsText,
            photoCodeText: `HCM_M2.[${buildingId}]_${pair.contextPhotoCode || `${pair.defectId}_CTX`}`,
          });
          pair.contextAlreadyWatermarked = true;
        }
        if (pair.closeUpPhotoBase64 && !pair.closeUpAlreadyWatermarked) {
          pair.closeUpPhotoBase64 = await this.stampImageBase64({
            base64Uri: pair.closeUpPhotoBase64,
            dateTimeText: pair.closeUpDateTime || defaultDate,
            gpsText,
            photoCodeText: `HCM_M2.[${buildingId}]_${pair.closeUpPhotoCode || `${pair.defectId}_CU_01`}`,
          });
          pair.closeUpAlreadyWatermarked = true;
        }
        if (pair.extraCloseUpPhotoBase64 && !pair.extraCloseUpAlreadyWatermarked) {
          pair.extraCloseUpPhotoBase64 = await this.stampImageBase64({
            base64Uri: pair.extraCloseUpPhotoBase64,
            dateTimeText: pair.extraCloseUpDateTime || defaultDate,
            gpsText,
            photoCodeText: `HCM_M2.[${buildingId}]_${pair.extraCloseUpPhotoCode || `${pair.defectId}_CU_02`}`,
          });
          pair.extraCloseUpAlreadyWatermarked = true;
        }
      }

      for (const page of fl.overviewPages || []) {
        for (const photo of page.photos || []) {
          if (photo.base64 && !photo.alreadyWatermarked) {
            photo.base64 = await this.stampImageBase64({
              base64Uri: photo.base64,
              dateTimeText: photo.watermarkDateTime || defaultDate,
              gpsText,
              photoCodeText: photo.metroPhotoCode || `HCM_M2.[${buildingId}]_${photo.zoneCode}_${photo.photoId}`,
            });
            photo.alreadyWatermarked = true;
          }
        }
      }

      for (const page of fl.elementOverviewPages || []) {
        for (const photo of page.photos || []) {
          if (photo.base64 && !photo.alreadyWatermarked) {
            photo.base64 = await this.stampImageBase64({
              base64Uri: photo.base64,
              dateTimeText: photo.watermarkDateTime || defaultDate,
              gpsText,
              photoCodeText: photo.metroPhotoCode || `HCM_M2.[${buildingId}]_${photo.zoneCode}_${photo.photoId}`,
            });
            photo.alreadyWatermarked = true;
          }
        }
      }
    }
  }
}

