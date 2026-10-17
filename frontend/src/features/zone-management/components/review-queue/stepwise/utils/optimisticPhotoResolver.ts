import type { PhotoActionPayload } from '../types';

export interface OptimisticPhotoFilter {
  category?: string;
  targetPhotoType?: string;
  targetPhotoId?: string;
  defectId?: string;
  photoIndex?: number;
  url?: string;
}

export interface OptimisticPhotoResult {
  displayUrl: string;
  isStaged: boolean;
  stagedAction: PhotoActionPayload | null;
  status: 'ORIGINAL' | 'REPLACED' | 'ADDED' | 'DELETED';
}

/**
 * Tra cứu và giải quyết URL hiển thị ảnh hiệu dụng tức thời (Optimistic Resolution)
 * dựa trên danh sách hành động can thiệp ảnh đang staged trong phiên Thẩm định.
 */
export function resolveOptimisticPhoto(
  originalUrl: string | undefined | null,
  stagedActions: PhotoActionPayload[] | undefined | null,
  filter: OptimisticPhotoFilter
): OptimisticPhotoResult {
  const safeUrl = (originalUrl || '').trim();
  if (!stagedActions || stagedActions.length === 0) {
    return { displayUrl: safeUrl, isStaged: false, stagedAction: null, status: 'ORIGINAL' };
  }

  const match = stagedActions.find((a) => {
    if (filter.category && a.category !== filter.category) return false;
    if (filter.targetPhotoType && a.targetPhotoType && a.targetPhotoType !== filter.targetPhotoType) return false;
    if (filter.targetPhotoId && a.targetPhotoId && a.targetPhotoId !== filter.targetPhotoId) return false;
    if (filter.defectId && a.defectId && a.defectId !== filter.defectId) return false;
    if (filter.photoIndex !== undefined && a.photoIndex !== undefined && a.photoIndex === filter.photoIndex) return true;
    if (filter.url && a.oldPhotoUrl && a.oldPhotoUrl === filter.url) return true;
    if (filter.targetPhotoId && a.targetPhotoId === filter.targetPhotoId && !filter.photoIndex && a.photoIndex === undefined) return true;
    if (filter.targetPhotoType && a.targetPhotoType === filter.targetPhotoType && !filter.photoIndex && a.photoIndex === undefined) return true;
    if (!filter.photoIndex && !filter.url) return true;
    return false;
  });

  if (!match) {
    return { displayUrl: safeUrl, isStaged: false, stagedAction: null, status: 'ORIGINAL' };
  }

  if (match.action === 'DELETE') {
    return { displayUrl: safeUrl, isStaged: true, stagedAction: match, status: 'DELETED' };
  }

  const newUrl = match.newPhotoUrl || (match.newPhotoUrls && match.newPhotoUrls[0]) || safeUrl;
  return {
    displayUrl: newUrl,
    isStaged: true,
    stagedAction: match,
    status: match.action === 'ADD' ? 'ADDED' : 'REPLACED',
  };
}

/**
 * Lọc danh sách các ảnh được thêm mới (ADD) cho một danh mục / mục tiêu cụ thể
 */
export function getOptimisticAddedPhotos(
  stagedActions: PhotoActionPayload[] | undefined | null,
  filter: OptimisticPhotoFilter
): Array<{ url: string; action: PhotoActionPayload }> {
  if (!stagedActions || stagedActions.length === 0) return [];
  const results: Array<{ url: string; action: PhotoActionPayload }> = [];

  for (const a of stagedActions) {
    if (a.action !== 'ADD') continue;
    if (filter.category && a.category !== filter.category) continue;
    if (filter.targetPhotoType && a.targetPhotoType && a.targetPhotoType !== filter.targetPhotoType) continue;
    if (filter.targetPhotoId && a.targetPhotoId && a.targetPhotoId !== filter.targetPhotoId) continue;
    if (filter.defectId && a.defectId && a.defectId !== filter.defectId) continue;

    const urls = a.newPhotoUrls || (a.newPhotoUrl ? [a.newPhotoUrl] : []);
    for (const u of urls) {
      if (u) results.push({ url: u, action: a });
    }
  }

  return results;
}
