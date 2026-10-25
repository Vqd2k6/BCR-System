import type { PhotoChangeMeta } from '../types';

/**
 * TRỤ CỘT KIẾN TRÚC 1: PHOTO COLLECTION MUTATOR (PURE IMMUTABLE DOMAIN ENGINE)
 * Quản lý vòng đời danh sách ảnh (từ bản tạm blob:local:// sang URL Cloud R2)
 * một cách nguyên tử, bất biến (immutable), lũy đẳng (idempotent) và không dùng biến useRef tạm.
 *
 * Triệt tiêu hoàn toàn:
 * - Lỗi nhân bản 2-3 lần ảnh khi bỏ qua meta.replacesUri ([ND-02])
 * - Lỗi chụp ảnh liên tiếp làm ảnh chụp sau ghi đè mất ảnh chụp trước qua biến ref tạm ([ND-04])
 * - Lỗi lệch trường URL ảnh đại diện đầu tiên khi thêm/thay thế/xóa phần tử ([CC-02])
 */

/**
 * Thêm mới hoặc thay thế nguyên tử một URL ảnh trong mảng string[]
 */
export function upsertPhotoUrlList(
  currentList: readonly string[] | undefined | null,
  incomingUrl: string,
  meta?: PhotoChangeMeta
): string[] {
  const baseList = Array.isArray(currentList)
    ? currentList.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    : [];

  const cleanIncoming = typeof incomingUrl === 'string' ? incomingUrl.trim() : '';
  if (!cleanIncoming) {
    return baseList;
  }

  const replacesUri = meta?.replacesUri?.trim();
  let nextList: string[];

  if (replacesUri && baseList.includes(replacesUri)) {
    nextList = baseList.map((u) => (u === replacesUri ? cleanIncoming : u));
  } else if (baseList.includes(cleanIncoming)) {
    nextList = [...baseList];
  } else {
    nextList = [...baseList, cleanIncoming];
  }

  return Array.from(new Set(nextList));
}

/**
 * Thêm mới hoặc thay thế nguyên tử một đối tượng ảnh { url, photoCode, ... } trong mảng
 */
export function upsertPhotoObjectList<T extends { url: string; photoCode?: string }>(
  currentList: readonly T[] | undefined | null,
  incomingItem: T,
  meta?: PhotoChangeMeta
): T[] {
  const baseList = Array.isArray(currentList)
    ? currentList.filter((item): item is T => Boolean(item && typeof item.url === 'string' && item.url.trim().length > 0))
    : [];

  const cleanIncomingUrl = typeof incomingItem?.url === 'string' ? incomingItem.url.trim() : '';
  if (!cleanIncomingUrl) {
    return baseList;
  }

  const normalizedIncoming: T = {
    ...incomingItem,
    url: cleanIncomingUrl,
  };

  const replacesUri = meta?.replacesUri?.trim();
  let rawUpdated: T[];

  if (replacesUri && baseList.some((item) => item.url === replacesUri)) {
    rawUpdated = baseList.map((item) =>
      item.url === replacesUri
        ? {
            ...item,
            ...normalizedIncoming,
            url: cleanIncomingUrl,
            photoCode: normalizedIncoming.photoCode || item.photoCode,
          }
        : item
    );
  } else if (baseList.some((item) => item.url === cleanIncomingUrl)) {
    rawUpdated = baseList.map((item) =>
      item.url === cleanIncomingUrl
        ? {
            ...item,
            ...normalizedIncoming,
            photoCode: normalizedIncoming.photoCode || item.photoCode,
          }
        : item
    );
  } else {
    rawUpdated = [...baseList, normalizedIncoming];
  }

  // Khử trùng lặp theo url nhưng giữ nguyên thứ tự xuất hiện đầu tiên
  const seenUrls = new Set<string>();
  const deduplicated: T[] = [];
  for (const item of rawUpdated) {
    if (!seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      deduplicated.push(item);
    }
  }

  return deduplicated;
}

/**
 * Đồng bộ trường URL ảnh đại diện đầu tiên từ danh sách đối tượng ảnh
 */
export function syncPrimaryPhotoUrl<T extends { url: string }>(
  items: readonly T[] | undefined | null
): string {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }
  const firstValid = items.find((item) => typeof item?.url === 'string' && item.url.trim().length > 0);
  return firstValid ? firstValid.url.trim() : '';
}

/**
 * Xóa phần tử tại vị trí chỉ định và trả về cả danh sách mới lẫn URL ảnh đại diện đầu tiên
 */
export function removePhotoObjectAtIndex<T extends { url: string }>(
  currentList: readonly T[] | undefined | null,
  removeIndex: number
): { updatedList: T[]; primaryUrl: string } {
  const baseList = Array.isArray(currentList) ? [...currentList] : [];
  const updatedList = baseList.filter((_, idx) => idx !== removeIndex);
  return {
    updatedList,
    primaryUrl: syncPrimaryPhotoUrl(updatedList),
  };
}

