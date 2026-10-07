/**
 * ============================================================================
 * REPORT WATERMARK CANVAS SERVICE
 * Đóng watermark in-memory theo đúng chuẩn commit 3ff0fab (watermarkEngine.ts)
 * Tái sử dụng Chromium Headless của Puppeteer để render Canvas 2D độ nét cao
 * TUYỆT ĐỐI KHÔNG SỬA ĐỔI HOẶC GHI ĐÈ FILE ẢNH GỐC TRÊN ĐĨA / CLOUD
 * ============================================================================
 */

import { Page } from 'puppeteer-core';
import { PdfRenderV2Engine } from '../engine/pdf-render-v2.engine';
import { LOGO_THACO_REC_BASE64 } from '../assets/report-logos';
import { ReportV2ViewModel } from '../report-v2.types';
import { isPhotoAlreadyWatermarked } from '../mappers/floor-defect.mapper';

export interface WatermarkQueueItem {
  id: string;
  base64: string;
  photoCode: string;
  timestamp: string;
}

export class ReportWatermarkCanvasService {
  private static cache = new Map<string, string>();
  private static workerPage: Page | null = null;
  private static isInitializing = false;

  private static getCacheKey(item: WatermarkQueueItem): string {
    const head = item.base64.slice(0, 80);
    return `${item.photoCode}__${item.timestamp}__${item.base64.length}__${head}`;
  }

  /**
   * Khởi tạo hoặc lấy lại Chromium Page dành riêng cho việc xử lý đồ họa Canvas
   */
  private static async getWorkerPage(): Promise<Page> {
    if (this.workerPage && !this.workerPage.isClosed()) {
      return this.workerPage;
    }

    while (this.isInitializing) {
      await new Promise((r) => setTimeout(r, 80));
      if (this.workerPage && !this.workerPage.isClosed()) {
        return this.workerPage;
      }
    }

    this.isInitializing = true;
    try {
      const browser = await PdfRenderV2Engine.getBrowser();
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 960, deviceScaleFactor: 1 });
      await page.setContent('<html><head></head><body></body></html>');
      this.workerPage = page;
      return page;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Dập watermark in-memory cho 1 danh sách ảnh theo chuẩn commit 3ff0fab
   */
  public static async processBatch(
    items: WatermarkQueueItem[]
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    if (!items || items.length === 0) {
      return results;
    }

    const itemsToProcess: WatermarkQueueItem[] = [];

    // Kiểm tra cache trước
    for (const item of items) {
      if (!item.base64 || !item.base64.startsWith('data:image/')) {
        continue;
      }
      const key = this.getCacheKey(item);
      if (this.cache.has(key)) {
        results.set(item.id, this.cache.get(key)!);
      } else {
        itemsToProcess.push(item);
      }
    }

    if (itemsToProcess.length === 0) {
      return results;
    }

    try {
      const page = await this.getWorkerPage();

      // Thực thi đóng dấu Canvas trong context của trình duyệt Chromium
      const processed: Array<{ id: string; watermarkedBase64: string }> =
        await page.evaluate(
          async (queue, logoBase64) => {
            // Nạp Logo THACO - CREC trong suốt
            const logoImg = new Image();
            await new Promise<void>((resolve, reject) => {
              logoImg.onload = () => resolve();
              logoImg.onerror = () => reject(new Error('Lỗi nạp logo THACO-CREC'));
              logoImg.src = logoBase64;
            });

            const out: Array<{ id: string; watermarkedBase64: string }> = [];

            for (const item of queue) {
              try {
                // 1. Nạp ảnh gốc từ Base64
                const srcImg = new Image();
                await new Promise<void>((res, rej) => {
                  srcImg.onload = () => res();
                  srcImg.onerror = () => rej(new Error(`Lỗi nạp ảnh ID: ${item.id}`));
                  srcImg.src = item.base64;
                });

                const width = srcImg.naturalWidth;
                const height = srcImg.naturalHeight;
                if (!width || !height) {
                  out.push({ id: item.id, watermarkedBase64: item.base64 });
                  continue;
                }

                // 2. Khởi tạo Canvas và vẽ ảnh gốc
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  out.push({ id: item.id, watermarkedBase64: item.base64 });
                  continue;
                }

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(srcImg, 0, 0, width, height);

                // Lấy kích thước ảnh dọc làm quy chuẩn cơ sở theo Commit 3ff0fab:
                // Cạnh ngắn nhất luôn tương đương với bề rộng của ảnh dọc khi chụp cùng độ phân giải
                const basePortraitWidth = Math.min(width, height);

                // 3. Vẽ Logo THACO-CREC ở góc trên bên phải (chiếm 43.75% chiều rộng cạnh chuẩn)
                if (logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0) {
                  const logoWidth = Math.round(basePortraitWidth * 0.4375);
                  const logoHeight = Math.round(
                    logoWidth * (logoImg.naturalHeight / logoImg.naturalWidth)
                  );
                  const paddingRight = Math.round(basePortraitWidth * 0.025);
                  const paddingTop = Math.round(basePortraitWidth * 0.025);
                  const logoX = width - logoWidth - paddingRight;
                  const logoY = paddingTop;

                  ctx.save();
                  // Đổ bóng mờ trắng nhẹ phía sau để logo nổi trên ảnh tối
                  ctx.shadowColor = 'rgba(255, 255, 255, 0.75)';
                  ctx.shadowBlur = Math.max(3, Math.round(basePortraitWidth * 0.007));
                  ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
                  ctx.restore();
                }

                // 4. Vẽ Ngày giờ + Mã định danh Photo ID ở góc dưới bên phải
                const fontSize = Math.max(22, Math.round(basePortraitWidth * 0.031));
                const lineHeight = Math.round(fontSize * 1.35);
                const paddingRightText = Math.round(basePortraitWidth * 0.03);
                const paddingBottomText = Math.round(basePortraitWidth * 0.035);

                const textX = width - paddingRightText;
                const line2Y = height - paddingBottomText;
                const line1Y = line2Y - lineHeight;

                ctx.save();
                ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'alphabetic';

                // Đổ bóng mờ đen
                ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                ctx.shadowBlur = Math.round(fontSize * 0.28);
                ctx.shadowOffsetX = Math.max(1.5, Math.round(fontSize * 0.05));
                ctx.shadowOffsetY = Math.max(2, Math.round(fontSize * 0.08));

                // Viền nét mảnh đen (Stroke) chống chìm chữ trên nền giấy trắng/vỉa hè
                ctx.lineWidth = Math.max(2, fontSize * 0.07);
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
                ctx.strokeText(item.timestamp, textX, line1Y);
                ctx.strokeText(item.photoCode, textX, line2Y);

                // Chữ trắng tinh
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(item.timestamp, textX, line1Y);
                ctx.fillText(item.photoCode, textX, line2Y);
                ctx.restore();

                // 5. Xuất Base64 Data URL chất lượng cao 85%
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                // Dọn dẹp canvas
                ctx.clearRect(0, 0, width, height);
                canvas.width = 0;
                canvas.height = 0;

                out.push({ id: item.id, watermarkedBase64: dataUrl });
              } catch (_err) {
                out.push({ id: item.id, watermarkedBase64: item.base64 });
              }
            }

            return out;
          },
          itemsToProcess,
          LOGO_THACO_REC_BASE64
        );

      // Lưu vào cache và map kết quả
      for (const res of processed) {
        results.set(res.id, res.watermarkedBase64);
        const originalItem = itemsToProcess.find((it) => it.id === res.id);
        if (originalItem) {
          const key = this.getCacheKey(originalItem);
          this.cache.set(key, res.watermarkedBase64);
        }
      }
    } catch (err) {
      console.warn('[ReportWatermarkCanvasService] Lỗi khi dập watermark bằng Chromium, fallback ảnh gốc:', err);
      for (const item of itemsToProcess) {
        results.set(item.id, item.base64);
      }
    }

    return results;
  }

  /**
   * Áp dụng Watermark cho toàn bộ ảnh trong ReportV2ViewModel (in-memory)
   */
  public static async applyWatermarksToViewModel(
    viewModel: ReportV2ViewModel
  ): Promise<void> {
    const queue: WatermarkQueueItem[] = [];
    const defaultBuildingId = viewModel.metadata.buildingId || 'UNKNOWN';
    const defaultTimestamp =
      viewModel.metadata.watermarkDateTime ||
      viewModel.metadata.surveyDateFormatted ||
      '';

    // 1. Ảnh bìa P-02 mặt tiền
    if (
      viewModel.metadata.coverPhotoBase64 &&
      !isPhotoAlreadyWatermarked(viewModel.metadata.coverPhotoUrl)
    ) {
      queue.push({
        id: 'cover_p02',
        base64: viewModel.metadata.coverPhotoBase64,
        photoCode: `HCM_M2.[${defaultBuildingId}]_P02_MAIN`,
        timestamp: defaultTimestamp,
      });
    }

    // 2. Phụ lục 1: Danh sách ảnh ngoại thất (appendix1 & appendix1Pages)
    if (Array.isArray(viewModel.appendix1)) {
      viewModel.appendix1.forEach((photo, pIdx) => {
        if (photo.base64 && !isPhotoAlreadyWatermarked(photo.url, photo)) {
          queue.push({
            id: `app1_${pIdx}`,
            base64: photo.base64,
            photoCode: photo.metroPhotoCode || `HCM_M2.[${defaultBuildingId}]_${photo.photoCode.replace(/[^A-Za-z0-9_-]/g, '_')}_01`,
            timestamp: photo.watermarkDateTime || defaultTimestamp,
          });
        }
      });
    }

    // 3. Phụ lục 2: Thống kê mặt bằng khuyết tật (appendix2)
    if (Array.isArray(viewModel.appendix2)) {
      viewModel.appendix2.forEach((floor, fIdx) => {
        // Ảnh phòng Z
        floor.overviewPages?.forEach((ovPage, opIdx) => {
          ovPage.photos?.forEach((p, pIdx) => {
            if (p.base64 && !isPhotoAlreadyWatermarked(p.url, p)) {
              queue.push({
                id: `floor_${fIdx}_op_${opIdx}_z_${pIdx}`,
                base64: p.base64,
                photoCode: p.metroPhotoCode || `HCM_M2.[${defaultBuildingId}]_${p.zoneCode || 'Z'}_OVERVIEW_${String(pIdx + 1).padStart(2, '0')}`,
                timestamp: p.watermarkDateTime || defaultTimestamp,
              });
            }
          });
        });

        // Ảnh cấu kiện E
        floor.elementOverviewPages?.forEach((elPage, epIdx) => {
          elPage.photos?.forEach((p, pIdx) => {
            if (p.base64 && !isPhotoAlreadyWatermarked(p.url, p)) {
              queue.push({
                id: `floor_${fIdx}_ep_${epIdx}_e_${pIdx}`,
                base64: p.base64,
                photoCode: p.metroPhotoCode || `HCM_M2.[${defaultBuildingId}]_${p.zoneCode || 'E'}_OVERVIEW_${String(pIdx + 1).padStart(2, '0')}`,
                timestamp: p.watermarkDateTime || defaultTimestamp,
              });
            }
          });
        });

        // Ảnh khuyết tật
        floor.defectPairPhotos?.forEach((d, dIdx) => {
          if (d.contextPhotoBase64 && !isPhotoAlreadyWatermarked(d.contextPhotoUrl, { alreadyWatermarked: d.contextAlreadyWatermarked })) {
            queue.push({
              id: `floor_${fIdx}_d_${dIdx}_ctx`,
              base64: d.contextPhotoBase64,
              photoCode: d.contextPhotoCode || `HCM_M2.[${defaultBuildingId}]_${d.defectId}_CTX_01`,
              timestamp: d.contextDateTime || defaultTimestamp,
            });
          }
          if (d.closeUpPhotoBase64 && !isPhotoAlreadyWatermarked(d.closeUpPhotoUrl, { alreadyWatermarked: d.closeUpAlreadyWatermarked })) {
            queue.push({
              id: `floor_${fIdx}_d_${dIdx}_cu`,
              base64: d.closeUpPhotoBase64,
              photoCode: d.closeUpPhotoCode || `HCM_M2.[${defaultBuildingId}]_${d.defectId}_CU_01`,
              timestamp: d.closeUpDateTime || defaultTimestamp,
            });
          }
          if (d.extraCloseUpPhotoBase64 && !isPhotoAlreadyWatermarked(d.extraCloseUpPhotoUrl, { alreadyWatermarked: d.extraCloseUpAlreadyWatermarked })) {
            queue.push({
              id: `floor_${fIdx}_d_${dIdx}_extra`,
              base64: d.extraCloseUpPhotoBase64,
              photoCode: d.extraCloseUpPhotoCode || `HCM_M2.[${defaultBuildingId}]_${d.defectId}_CU_02`,
              timestamp: d.extraCloseUpDateTime || defaultTimestamp,
            });
          }
        });
      });
    }

    // 4. Phụ lục 3: Bản gốc biên bản hiện trường đã ký (appendix3)
    if (viewModel.appendix3?.signedRecordPages) {
      viewModel.appendix3.signedRecordPages.forEach((page, pIdx) => {
        if (page.base64 && !isPhotoAlreadyWatermarked(page.url, page)) {
          queue.push({
            id: `app3_signed_${pIdx}`,
            base64: page.base64,
            photoCode: page.metroPhotoCode || `HCM_M2.[${defaultBuildingId}]_DOC_MINUTES_${String(pIdx + 1).padStart(2, '0')}`,
            timestamp: page.watermarkDateTime || defaultTimestamp,
          });
        }
      });
    }

    if (queue.length === 0) {
      return;
    }

    // Tiến hành dập watermark hàng loạt in-memory
    const results = await this.processBatch(queue);

    // Gán lại kết quả Base64 vào ViewModel
    if (results.has('cover_p02')) {
      viewModel.metadata.coverPhotoBase64 = results.get('cover_p02')!;
      viewModel.metadata.coverAlreadyWatermarked = true;
    }

    if (Array.isArray(viewModel.appendix1)) {
      viewModel.appendix1.forEach((photo, pIdx) => {
        const key = `app1_${pIdx}`;
        if (results.has(key)) {
          photo.base64 = results.get(key)!;
          photo.alreadyWatermarked = true;
        }
      });
      // Đồng bộ vào appendix1Pages nếu có
      if (Array.isArray(viewModel.appendix1Pages)) {
        viewModel.appendix1Pages.forEach((pg) => {
          pg.photos?.forEach((p) => {
            const matched = viewModel.appendix1.find((it) => it.photoCode === p.photoCode);
            if (matched) {
              if (matched.base64) p.base64 = matched.base64;
              if (matched.alreadyWatermarked) p.alreadyWatermarked = true;
            }
          });
        });
      }
    }

    if (Array.isArray(viewModel.appendix2)) {
      viewModel.appendix2.forEach((floor, fIdx) => {
        floor.overviewPages?.forEach((ovPage, opIdx) => {
          ovPage.photos?.forEach((p, pIdx) => {
            const key = `floor_${fIdx}_op_${opIdx}_z_${pIdx}`;
            if (results.has(key)) {
              p.base64 = results.get(key)!;
              p.alreadyWatermarked = true;
            }
          });
        });

        floor.elementOverviewPages?.forEach((elPage, epIdx) => {
          elPage.photos?.forEach((p, pIdx) => {
            const key = `floor_${fIdx}_ep_${epIdx}_e_${pIdx}`;
            if (results.has(key)) {
              p.base64 = results.get(key)!;
              p.alreadyWatermarked = true;
            }
          });
        });

        floor.defectPairPhotos?.forEach((d, dIdx) => {
          const ctxKey = `floor_${fIdx}_d_${dIdx}_ctx`;
          if (results.has(ctxKey)) {
            d.contextPhotoBase64 = results.get(ctxKey)!;
            d.contextAlreadyWatermarked = true;
          }
          const cuKey = `floor_${fIdx}_d_${dIdx}_cu`;
          if (results.has(cuKey)) {
            d.closeUpPhotoBase64 = results.get(cuKey)!;
            d.closeUpAlreadyWatermarked = true;
          }
          const extraKey = `floor_${fIdx}_d_${dIdx}_extra`;
          if (results.has(extraKey)) {
            d.extraCloseUpPhotoBase64 = results.get(extraKey)!;
            d.extraCloseUpAlreadyWatermarked = true;
          }
        });

        // Đồng bộ vào defectPairPages nếu có
        floor.defectPairPages?.forEach((pg) => {
          pg.pairs?.forEach((p) => {
            const matched = floor.defectPairPhotos?.find((it) => it.defectId === p.defectId);
            if (matched) {
              if (matched.contextPhotoBase64) p.contextPhotoBase64 = matched.contextPhotoBase64;
              if (matched.closeUpPhotoBase64) p.closeUpPhotoBase64 = matched.closeUpPhotoBase64;
              if (matched.extraCloseUpPhotoBase64) p.extraCloseUpPhotoBase64 = matched.extraCloseUpPhotoBase64;
            }
          });
        });
      });
    }

    if (viewModel.appendix3?.signedRecordPages) {
      viewModel.appendix3.signedRecordPages.forEach((page, pIdx) => {
        const key = `app3_signed_${pIdx}`;
        if (results.has(key)) {
          page.base64 = results.get(key)!;
          page.alreadyWatermarked = true;
        }
      });
    }
  }
}
