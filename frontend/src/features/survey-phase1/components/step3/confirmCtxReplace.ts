import { isLocalBlobUri, isPersistedPhotoUrl } from '../../../../core/storage/offlinePhotoStorage';

/**
 * Ảnh CTX chưa lên kho và không nằm trong ảnh tổng quan: bản nháp chỉ còn giữ URI của nó ở đây.
 * Mất URI này thì bộ tự tìm ảnh mồ côi không còn biết phải tìm ảnh nào.
 */
export function isCtxLinkAtRisk(ctxPhotoUrl: string | undefined, overviewPhotos: string[] | undefined): boolean {
  if (!ctxPhotoUrl || !isLocalBlobUri(ctxPhotoUrl) || isPersistedPhotoUrl(ctxPhotoUrl)) return false;
  return !overviewPhotos?.includes(ctxPhotoUrl);
}

/** Danh sách ảnh tổng quan sau khi đổi CTX: giữ lại URI ảnh cũ nếu nó sắp mất liên kết. */
export function keepCtxLink(ctxPhotoUrl: string | undefined, overviewPhotos: string[] | undefined): string[] {
  const photos = overviewPhotos || [];
  return ctxPhotoUrl && isCtxLinkAtRisk(ctxPhotoUrl, photos) ? [...photos, ctxPhotoUrl] : photos;
}

/** Xin xác nhận trước khi thay ảnh CTX; không có gì cần cảnh báo thì cho qua. */
export function confirmCtxReplace(params: {
  defectCount: number;
  ctxPhotoUrl?: string;
  overviewPhotos?: string[];
  keepsOldPhotoLink?: boolean;
}): boolean {
  const { defectCount, ctxPhotoUrl, overviewPhotos, keepsOldPhotoLink } = params;
  const warnings: string[] = [];
  if (defectCount > 0) {
    warnings.push(
      `Vị trí của ${defectCount} ghim D-xx được chấm trên ảnh bối cảnh cũ. Sau khi đổi ảnh, bạn PHẢI kéo lại từng ghim về đúng vị trí trên ảnh mới.`
    );
  }
  if (!keepsOldPhotoLink && isCtxLinkAtRisk(ctxPhotoUrl, overviewPhotos)) {
    warnings.push('Ảnh bối cảnh cũ chưa lên kho lưu trữ. Thay ảnh sẽ mất liên kết tới ảnh này vĩnh viễn.');
  }
  return warnings.length === 0 || confirm(`${warnings.join('\n\n')}\n\nTiếp tục đổi ảnh?`);
}
