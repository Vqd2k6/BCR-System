import type { PhotoActionPayload } from '../types';

export interface OptimisticPhotoFilter {
  category?: string;
  targetPhotoType?: string;
  targetPhotoId?: string;
  defectId?: string;
  defectCode?: string;
  floorCode?: string;
  zoneCode?: string;
  photoIndex?: number;
  url?: string;
  currentUrl?: string;
}

export type OptimisticPhotoStatus = 'UNCHANGED' | 'ORIGINAL' | 'REPLACED' | 'ADDED' | 'DELETED';

export interface OptimisticPhotoResult {
  displayUrl: string;
  effectiveUrl: string;
  isStaged: boolean;
  isDeleted: boolean;
  stagedAction: PhotoActionPayload | null;
  matchedAction: PhotoActionPayload | null;
  status: OptimisticPhotoStatus;
  state: OptimisticPhotoStatus;
}

export interface OptimisticAddedPhotoItem {
  url: string;
  displayUrl: string;
  action: PhotoActionPayload;
  matchedAction: PhotoActionPayload;
}

function isSameTargetId(aId?: string, bId?: string): boolean {
  if (!aId || !bId) return true;
  if (aId === bId) return true;
  if (aId.endsWith(`.${bId}`) || bId.endsWith(`.${aId}`)) return true;
  return false;
}

function isSameCategory(a: PhotoActionPayload, filter: OptimisticPhotoFilter): boolean {
  if (!filter.category || !a.category) return true;
  if (a.category === filter.category) return true;
  if (a.targetPhotoType === filter.category || filter.targetPhotoType === a.category) return true;
  return false;
}

/**
 * Tra cứu và giải quyết URL hiển thị ảnh hiệu dụng tức thời (Optimistic Resolution)
 * dựa trên danh sách hành động can thiệp ảnh đang staged trong phiên Thẩm định.
 */
export function resolveOptimisticPhoto(
  originalUrl: string | undefined | null,
  stagedActions: PhotoActionPayload[] | undefined | null,
  filter: OptimisticPhotoFilter
): OptimisticPhotoResult;
export function resolveOptimisticPhoto(
  stagedActions: PhotoActionPayload[] | undefined | null,
  filter: OptimisticPhotoFilter
): OptimisticPhotoResult;
export function resolveOptimisticPhoto(
  arg1: string | undefined | null | PhotoActionPayload[],
  arg2: PhotoActionPayload[] | undefined | null | OptimisticPhotoFilter,
  arg3?: OptimisticPhotoFilter
): OptimisticPhotoResult {
  let originalUrl: string | undefined | null;
  let stagedActions: PhotoActionPayload[] | undefined | null;
  let filter: OptimisticPhotoFilter;

  if (Array.isArray(arg1) || (arg1 === undefined && arg3 === undefined) || (arg1 === null && arg3 === undefined)) {
    stagedActions = (arg1 as PhotoActionPayload[] | undefined | null) ?? null;
    filter = (arg2 as OptimisticPhotoFilter) || {};
    originalUrl = filter.url ?? filter.currentUrl ?? '';
  } else {
    originalUrl = arg1 as string | undefined | null;
    stagedActions = arg2 as PhotoActionPayload[] | undefined | null;
    filter = arg3 || {};
  }

  const safeUrl = (originalUrl || filter.url || filter.currentUrl || '').trim();
  if (!stagedActions || stagedActions.length === 0) {
    return {
      displayUrl: safeUrl,
      effectiveUrl: safeUrl,
      isStaged: false,
      isDeleted: false,
      stagedAction: null,
      matchedAction: null,
      status: 'UNCHANGED',
      state: 'UNCHANGED',
    };
  }

  const getActionMode = (a: PhotoActionPayload): string => {
    const rec = a as unknown as { action?: string; actionType?: string };
    return (rec.action || rec.actionType || '').toUpperCase();
  };

  const match = [...stagedActions].reverse().find((a) => {
    const mode = getActionMode(a);
    if (mode === 'ADD') return false;
    if (!isSameCategory(a, filter)) return false;
    if (
      filter.targetPhotoType &&
      a.targetPhotoType &&
      a.targetPhotoType !== filter.targetPhotoType &&
      a.category !== filter.targetPhotoType
    ) {
      return false;
    }
    if (filter.targetPhotoId && a.targetPhotoId && !isSameTargetId(a.targetPhotoId, filter.targetPhotoId)) {
      return false;
    }
    const actExt = a as PhotoActionPayload & { zoneCode?: string; floorCode?: string };
    const actZoneCode = actExt.zoneCode || (a.metadata?.zoneCode as string | undefined);
    const actFloorCode = actExt.floorCode || (a.metadata?.floorCode as string | undefined);
    const hasExactDefectIdMatch = Boolean(filter.defectId && a.defectId && filter.defectId === a.defectId);
    if (filter.defectId && a.defectId && a.defectId !== filter.defectId) return false;
    if (filter.defectCode && a.defectCode && a.defectCode !== filter.defectCode) return false;
    if (filter.zoneCode) {
      if (actZoneCode && actZoneCode !== filter.zoneCode) return false;
      if (!actZoneCode && !hasExactDefectIdMatch) return false;
    }
    if (filter.floorCode) {
      if (actFloorCode && actFloorCode !== filter.floorCode) return false;
      if (!actFloorCode && !hasExactDefectIdMatch) return false;
    }
    const sameDefectCode = Boolean(
      filter.defectCode &&
        (a.defectCode === filter.defectCode || a.targetPhotoId === filter.defectCode)
    );

    if (
      mode === 'DELETE' &&
      Boolean(a.deleteDefectItem) &&
      (hasExactDefectIdMatch ||
        (sameDefectCode &&
          (!filter.zoneCode || actZoneCode === filter.zoneCode) &&
          (!filter.floorCode || actFloorCode === filter.floorCode)))
    ) {
      return true;
    }

    if (filter.photoIndex !== undefined && a.photoIndex !== undefined) {
      return a.photoIndex === filter.photoIndex;
    }
    if (filter.photoIndex !== undefined && a.photoIndex === undefined) {
      const targetUrl = filter.url || filter.currentUrl || safeUrl;
      if (targetUrl && a.oldPhotoUrl) {
        return a.oldPhotoUrl === targetUrl;
      }
      if (filter.defectId && a.defectId && a.defectId === filter.defectId) {
        return true;
      }
      return false;
    }
    if (filter.photoIndex === undefined && a.photoIndex !== undefined) {
      return false;
    }

    const targetUrl = filter.url || filter.currentUrl;
    if (targetUrl && a.oldPhotoUrl) {
      return a.oldPhotoUrl === targetUrl;
    }
    if (filter.targetPhotoId && a.targetPhotoId && isSameTargetId(a.targetPhotoId, filter.targetPhotoId)) {
      return true;
    }
    if (filter.targetPhotoType && a.targetPhotoType && a.targetPhotoType === filter.targetPhotoType) {
      return true;
    }
    if (!targetUrl) return true;
    return false;
  });

  if (!match) {
    return {
      displayUrl: safeUrl,
      effectiveUrl: safeUrl,
      isStaged: false,
      isDeleted: false,
      stagedAction: null,
      matchedAction: null,
      status: 'UNCHANGED',
      state: 'UNCHANGED',
    };
  }

  const matchedMode = getActionMode(match);
  if (matchedMode === 'DELETE') {
    return {
      displayUrl: safeUrl,
      effectiveUrl: '',
      isStaged: true,
      isDeleted: true,
      stagedAction: match,
      matchedAction: match,
      status: 'DELETED',
      state: 'DELETED',
    };
  }

  const newUrl = match.newPhotoUrl || (match.newPhotoUrls && match.newPhotoUrls[0]) || safeUrl;
  const resolvedStatus: OptimisticPhotoStatus = matchedMode === 'ADD' ? 'ADDED' : 'REPLACED';
  return {
    displayUrl: newUrl,
    effectiveUrl: newUrl,
    isStaged: true,
    isDeleted: false,
    stagedAction: match,
    matchedAction: match,
    status: resolvedStatus,
    state: resolvedStatus,
  };
}

/**
 * Lọc danh sách các ảnh được thêm mới (ADD) cho một danh mục / mục tiêu cụ thể
 */
export function getOptimisticAddedPhotos(
  stagedActions: PhotoActionPayload[] | undefined | null,
  filter: OptimisticPhotoFilter
): OptimisticAddedPhotoItem[] {
  if (!stagedActions || stagedActions.length === 0) return [];
  const results: OptimisticAddedPhotoItem[] = [];

  // Tập hợp các URL đã bị đánh dấu DELETE trong phiên để ẩn ngay các ảnh mới thêm nếu bị xóa
  const deletedUrls = new Set<string>();
  for (const act of stagedActions) {
    const rec = act as unknown as { action?: string; actionType?: string };
    const mode = (rec.action || rec.actionType || '').toUpperCase();
    if (mode === 'DELETE' && act.oldPhotoUrl) {
      deletedUrls.add(act.oldPhotoUrl.trim());
    }
  }

  for (const a of stagedActions) {
    const rec = a as unknown as { action?: string; actionType?: string };
    const mode = (rec.action || rec.actionType || '').toUpperCase();
    if (mode !== 'ADD') continue;
    if (!isSameCategory(a, filter)) continue;
    if (
      filter.targetPhotoType &&
      a.targetPhotoType &&
      a.targetPhotoType !== filter.targetPhotoType &&
      a.category !== filter.targetPhotoType
    ) {
      continue;
    }
    if (filter.targetPhotoId && a.targetPhotoId && !isSameTargetId(a.targetPhotoId, filter.targetPhotoId)) {
      continue;
    }
    const actExt = a as PhotoActionPayload & { zoneCode?: string; floorCode?: string };
    const actZoneCode = actExt.zoneCode || (a.metadata?.zoneCode as string | undefined);
    const actFloorCode = actExt.floorCode || (a.metadata?.floorCode as string | undefined);
    const hasExactDefectIdMatch = Boolean(filter.defectId && a.defectId && filter.defectId === a.defectId);
    if (filter.defectId && a.defectId && a.defectId !== filter.defectId) continue;
    if (filter.defectCode && a.defectCode && a.defectCode !== filter.defectCode) continue;
    if (filter.defectCode && !a.defectCode && a.targetPhotoId && a.targetPhotoId !== filter.defectCode) continue;
    if (filter.zoneCode) {
      if (actZoneCode && actZoneCode !== filter.zoneCode) continue;
      if (!actZoneCode && !hasExactDefectIdMatch) continue;
    }
    if (filter.floorCode) {
      if (actFloorCode && actFloorCode !== filter.floorCode) continue;
      if (!actFloorCode && !hasExactDefectIdMatch) continue;
    }

    const urls = a.newPhotoUrls || (a.newPhotoUrl ? [a.newPhotoUrl] : []);
    for (const u of urls) {
      if (u && !deletedUrls.has(u.trim())) {
        results.push({
          url: u,
          displayUrl: u,
          action: a,
          matchedAction: a,
        });
      }
    }
  }

  return results;
}
