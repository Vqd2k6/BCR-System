/**
 * ============================================================================
 * PHOTO QC – LỚP PHỦ KHI RENDER REPORT
 * Chạy sau khi dựng ViewModel và TRƯỚC lượt dập watermark thường:
 *   1. Bìa P04 (nếu admin chọn): lấy đúng ô P-04 của Phụ lục 1 (cùng URL, góc xoay, mã, giờ).
 *   2. Ảnh có crop còn hiệu lực: cắt trên ảnh gốc → dập dấu → xoay → encode một lần,
 *      rồi đánh dấu đã có watermark để lượt thường bỏ qua.
 * Không có trạng thái QC → không làm gì (report giữ nguyên từng byte như trước).
 * Hồ sơ APPROVED: trạng thái lấy từ snapshot (frozenReportData.photo_qc), không đọc bảng sống.
 * ============================================================================
 */

import type { ReportViewModel } from '../report/report.types';
import { ReportImageResolver } from '../report/services/report-image-resolver.service';
import { ReportWatermarkCanvasService } from '../report/services/report-watermark-canvas.service';
import { PhotoQcRepository } from './photo-qc.repository';
import { isCropApplicable, restampLayers, urlPhotoKey } from './photo-qc.rules';
import type { PhotoQcRenderPhoto, PhotoQcRenderState } from './photo-qc.types';
import { walkViewModelPhotos, type VmPhotoRef } from './photo-qc.vm-walker';

type StudioMap = Record<string, { originalUrl?: unknown }>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

/** Đọc trạng thái QC đã đóng băng trong snapshot (có thể null = không có QC lúc duyệt). */
export function parseFrozenPhotoQc(raw: unknown): PhotoQcRenderState | null {
  if (!isRecord(raw)) return null;
  const coverSource = raw.coverSource === 'P04' ? 'P04' : null;
  const photos: PhotoQcRenderPhoto[] = Array.isArray(raw.photos)
    ? raw.photos.filter(isRecord).flatMap((p) => {
        const crop = isRecord(p.crop) ? p.crop : null;
        if (!crop || typeof p.photoKey !== 'string' || typeof p.photoUrl !== 'string') return [];
        const nums = [crop.x, crop.y, crop.w, crop.h].map(Number);
        if (!nums.every(Number.isFinite)) return [];
        const mode = typeof p.restampMode === 'string' && ['LOGO', 'TEXT', 'BOTH'].includes(p.restampMode) ? p.restampMode : 'NONE';
        return [{
          photoKey: p.photoKey,
          photoUrl: p.photoUrl,
          crop: {
            x: nums[0], y: nums[1], w: nums[2], h: nums[3],
            ratio: crop.ratio === '3:4' ? '3:4' : '4:3',
            rotationAtCrop: Number(crop.rotationAtCrop) || 0,
          },
          restampMode: mode as PhotoQcRenderPhoto['restampMode'],
        }];
      })
    : [];
  if (!coverSource && photos.length === 0) return null;
  return { coverSource, photos };
}

/**
 * Nguồn trạng thái QC cho một lượt render:
 * - Bản ghi đã áp snapshot (photo_qc_frozen) → dùng đúng QC đóng băng của revision đó.
 * - Còn lại (bản nháp) → đọc bảng sống.
 */
export async function resolvePhotoQcStateForRender(report: Record<string, unknown>): Promise<PhotoQcRenderState | null> {
  if (report.photo_qc_frozen === true) {
    return parseFrozenPhotoQc(report.photo_qc);
  }
  const reportId = typeof report.id === 'string' ? report.id : null;
  if (!reportId) return null;
  return PhotoQcRepository.loadRenderState(reportId);
}

function swapCoverToP04(vm: ReportViewModel): boolean {
  const p04 = (vm.appendix1 || []).find((p) => p.photoCode === 'P-04' && p.url);
  if (!p04 || !vm.metadata) {
    console.error('[PhotoQcRender:cover] Hồ sơ chọn bìa P04 nhưng report không có ảnh P-04, giữ bìa cũ');
    return false;
  }
  vm.metadata.coverPhotoUrl = p04.url;
  vm.metadata.coverPhotoBase64 = p04.base64;
  vm.metadata.coverWatermarkDateTime = p04.watermarkDateTime;
  vm.metadata.coverWatermarkCode = p04.metroPhotoCode;
  vm.metadata.coverAlreadyWatermarked = Boolean(p04.alreadyWatermarked);
  return true;
}

function findRowForRef(ref: VmPhotoRef, byKey: Map<string, PhotoQcRenderPhoto>, pRowsByUrl: Map<string, PhotoQcRenderPhoto>): PhotoQcRenderPhoto | undefined {
  if (ref.section === 'P') {
    const bySlot = byKey.get(ref.photoKey);
    if (bySlot) return bySlot;
  }
  return byKey.get(urlPhotoKey(ref.url)) ?? pRowsByUrl.get(ref.url);
}

export async function applyPhotoQcToViewModel(
  vm: ReportViewModel,
  state: PhotoQcRenderState | null,
  opts: { watermark: boolean; studioEnhanced?: StudioMap | null }
): Promise<void> {
  if (!state) return;

  if (state.coverSource === 'P04') swapCoverToP04(vm);
  if (state.photos.length === 0) return;

  const byKey = new Map(state.photos.map((p) => [p.photoKey, p]));
  const pRowsByUrl = new Map<string, PhotoQcRenderPhoto>();
  for (const p of state.photos) {
    if (!p.photoKey.startsWith('U:') && !pRowsByUrl.has(p.photoUrl)) pRowsByUrl.set(p.photoUrl, p);
  }

  for (const ref of walkViewModelPhotos(vm)) {
    const row = findRowForRef(ref, byKey, pRowsByUrl);
    if (!row?.crop) continue;
    const base64 = ref.getBase64();
    if (!base64 || !base64.startsWith('data:image/')) {
      console.error(`[PhotoQcRender:crop] Ảnh ${ref.label} chưa nạp được, in ảnh gốc không crop`, ref.url);
      continue;
    }
    const printedDeg = ReportImageResolver.getRotationOrigin(base64)?.deg ?? 0;
    if (!isCropApplicable(row.crop, row.photoUrl, ref.url, printedDeg, opts.studioEnhanced)) {
      console.warn(`[PhotoQcRender:crop] Crop của ${ref.label} hết hiệu lực (đổi ảnh hoặc đổi góc xoay), in ảnh không crop`);
      continue;
    }

    const legacy = ref.isWatermarked();
    const layers = !opts.watermark ? { logo: false, text: false } : legacy ? restampLayers(row.restampMode) : { logo: true, text: true };
    try {
      const out = await ReportWatermarkCanvasService.cropStampRotate({
        base64Uri: base64,
        crop: row.crop,
        dateTimeText: ref.dateTimeText,
        photoCodeText: ref.photoCodeText,
        stampLogo: layers.logo,
        stampText: layers.text,
      });
      ref.setBase64(out);
      if (opts.watermark) ref.markWatermarked();
    } catch (err) {
      console.error(`[PhotoQcRender:crop] Không cắt được ảnh ${ref.label}, in ảnh gốc không crop`, err);
    }
  }
}
