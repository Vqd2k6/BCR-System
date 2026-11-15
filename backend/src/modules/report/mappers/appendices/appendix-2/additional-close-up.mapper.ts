/**
 * Ảnh cận cảnh chưa in ở ô 1–2 của một khuyết tật (thường là `cuPhotos[2..]`; cũng bắt `cuPhotos[0]` khi
 * ô 1 lấy từ `closeUpPhotoUrl` riêng).
 * Chỉ ghi URL / góc xoay / mã ảnh — KHÔNG nạp ảnh — để v1 (đóng băng, chỉ in 2 ảnh) không đổi gì.
 * Template v2 nạp và đưa vào `additionalCloseUps` ở ReportService (xem promoteAdditionalCloseUps).
 */

import type { AdditionalCloseUpItem } from '../../../report.types';
import { extractPhotoDateTime } from '../../formatters.mapper';

interface RawCloseUpDefect {
  id?: string | number;
  cuPhotos?: unknown;
  cuPhotoCodes?: unknown;
  cuPhotoTimestamps?: unknown;
}

function urlOf(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string') {
    return ((item as { url: string }).url).trim();
  }
  return '';
}

/**
 * @param scopeKeys các tiền tố khóa góc xoay theo vùng/cấu kiện, ví dụ `defect_f0_zZ-01_<id>`; hàm thêm `_cu_<i>`.
 * @param usedUrls URL ảnh cận cảnh 1–2 đã có (bỏ trùng).
 */
export function collectAdditionalCloseUps(
  d: RawCloseUpDefect,
  dCode: string,
  scopeKeys: string[],
  rotMap: Record<string, number>,
  usedUrls: Array<string | undefined>
): AdditionalCloseUpItem[] {
  if (!Array.isArray(d.cuPhotos) || d.cuPhotos.length === 0) return [];
  const codes = Array.isArray(d.cuPhotoCodes) ? d.cuPhotoCodes : [];
  const stamps = Array.isArray(d.cuPhotoTimestamps) ? d.cuPhotoTimestamps : [];
  const seen = new Set(usedUrls.filter((u): u is string => Boolean(u)).map((u) => u.trim()));
  const out: AdditionalCloseUpItem[] = [];

  d.cuPhotos.forEach((raw: unknown, i: number) => {
    const url = urlOf(raw);
    if (!url || url.startsWith('blob:') || seen.has(url)) return;
    seen.add(url);
    const keyed = [`defect_${d.id}_cu_${i}`, ...scopeKeys.map((k) => `${k}_cu_${i}`)]
      .map((k) => rotMap[k])
      .find((v) => v !== undefined);
    const rotation = Number(keyed ?? rotMap[url] ?? 0) || 0;
    const storedCode = typeof codes[i] === 'string' && codes[i] ? (codes[i] as string) : undefined;
    out.push({
      url,
      rotation,
      photoCode: storedCode || `${dCode}_CU_${String(i + 1).padStart(2, '0')}`,
      dateTime: extractPhotoDateTime(url, stamps[i] ?? null, null) || undefined,
    });
  });
  return out;
}
