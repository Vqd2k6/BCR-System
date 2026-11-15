/**
 * Cập nhật ảnh tổng quan của Vùng Z / Cấu kiện E ở luồng khu vực chung (state cục bộ, không qua store).
 *
 * Quy tắc (sửa lỗi "chụp tấm mới là mất hình cũ" ở C&C-04-B-0236):
 * - Chụp mới (không có replacesUri): luôn NỐI THÊM vào đúng phần tử đang chụp, không thay ảnh tạm trước đó.
 * - Thăng cấp blob:local:// → URL Cloud (có replacesUri): tìm ảnh đó trong MỌI phần tử và thay đúng chỗ
 *   (KSV có thể đã chuyển sang vùng khác khi ảnh upload xong). Không thấy thì giữ nguyên, không nối vào vùng đang mở.
 * - Ảnh bối cảnh (ctxPhotoUrl) chỉ tự gán khi đang trống, hoặc đi theo đúng ảnh nó đang trỏ tới khi thăng cấp.
 */

export interface OverviewPhotoOwner {
  overviewPhotos?: string[];
  ctxPhotoUrl?: string;
}

export function applyOverviewPhotoChange<T extends OverviewPhotoOwner>(
  items: T[],
  targetIndex: number,
  url: string,
  replacesUri?: string
): T[] {
  const cleanUrl = (url || '').trim();
  if (!cleanUrl) return items;

  const replaces = (replacesUri || '').trim();
  if (replaces) {
    let changed = false;
    const next = items.map((item) => {
      const photos = item.overviewPhotos || [];
      const hasPhoto = photos.includes(replaces);
      const isCtx = item.ctxPhotoUrl === replaces;
      if (!hasPhoto && !isCtx) return item;
      changed = true;
      return {
        ...item,
        overviewPhotos: hasPhoto ? Array.from(new Set(photos.map((p) => (p === replaces ? cleanUrl : p)))) : photos,
        ctxPhotoUrl: isCtx ? cleanUrl : item.ctxPhotoUrl,
      };
    });
    if (!changed) {
      console.warn('[masterPhotoListMutator] Bỏ qua thăng cấp: không còn ảnh tạm', replaces);
    }
    return changed ? next : items;
  }

  const target = items[targetIndex];
  if (!target) return items;
  const photos = target.overviewPhotos || [];
  if (photos.includes(cleanUrl)) return items;
  const next = [...items];
  next[targetIndex] = {
    ...target,
    overviewPhotos: [...photos, cleanUrl],
    ctxPhotoUrl: target.ctxPhotoUrl || cleanUrl,
  };
  return next;
}

/**
 * Số thứ tự cho ảnh toàn cảnh mới = số lớn nhất đang có + 1 (theo hậu tố `_N` của photoCode).
 * Không dùng `length + 1`: sau khi xóa 1 ảnh, `length + 1` trùng mã của ảnh còn lại.
 */
export function nextOverviewPhotoIndex(photos: ReadonlyArray<{ photoCode?: string }>): number {
  let max = 0;
  for (const p of photos) {
    const m = /_(\d+)$/.exec(p.photoCode || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Math.max(max, photos.length) + 1;
}
