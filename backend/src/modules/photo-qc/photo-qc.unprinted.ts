/**
 * ============================================================================
 * PHOTO QC – ẢNH CHƯA IN TRONG REPORT
 * Mọi ảnh khảo sát đều phải rà được (report căn hộ chưa in hết, nhưng ảnh sẽ đóng vào report sau).
 * Hàm này duyệt survey_data_json để đặt nhãn dễ đọc (tầng • vùng • khuyết tật • loại ảnh #n)
 * và phân mục cho các URL report hiện chưa in. Không đọc file ảnh.
 * ============================================================================
 */

import type { PhotoQcSection } from './photo-qc.types';

const STORED_IMAGE_URL = /^https?:\/\/\S+\.(jpe?g|png|webp)(\?\S*)?$/i;

/** Không phải ảnh khảo sát để rà: chữ ký và sơ đồ CAD. */
export function isExcludedPhotoPath(path: string): boolean {
  return /signature/i.test(path) && !/workingMinutes/i.test(path) ? true : /cad/i.test(path);
}

export interface UnprintedPhotoInfo {
  label: string;
  section: PhotoQcSection;
}

const KEY_LABELS: Array<[RegExp, string, PhotoQcSection]> = [
  [/workingMinutes|minutes/i, 'Biên bản hiện trường', 'DOCUMENT'],
  [/absen|notice/i, 'Thông báo vắng mặt', 'DOCUMENT'],
  [/idcard|legal|cccd/i, 'Giấy tờ chủ hộ', 'DOCUMENT'],
  [/asBuilt|drawing/i, 'Bản vẽ chủ hộ cung cấp', 'DOCUMENT'],
  [/extraCu|cuPhotos?|cuPhotoUrl|closeUp/i, 'Cận cảnh', 'DEFECT'],
  [/ctx/i, 'Bối cảnh', 'DEFECT'],
  [/overview/i, 'Tổng quan', 'OVERVIEW'],
  [/beamSagging/i, 'Võng dầm / sàn', 'OVERVIEW'],
  [/buildingTilt|tilt/i, 'Kiểm tra nghiêng', 'OVERVIEW'],
  [/diffSettlement|settle/i, 'Khảo sát lún', 'OVERVIEW'],
  [/abnormal/i, 'Bất thường ngoại quan', 'OVERVIEW'],
  [/photoP0(\d)/i, 'Ảnh P', 'P'],
];

/** Tầng, vùng, khuyết tật, phòng của một nút JSON (có thể nhiều cùng lúc). */
function contextOf(obj: Record<string, unknown>): string[] {
  const pick = (k: string) => (typeof obj[k] === 'string' && String(obj[k]).trim() ? String(obj[k]).trim() : null);
  const id = pick('id');
  const values = [
    pick('floorName'),
    pick('zoneCode'),
    pick('defectCode') || (id && /^[DEZ]-\d+/i.test(id) ? id : null),
    pick('roomName'),
  ];
  return values.filter((v): v is string => Boolean(v));
}

/** URL → nhãn + mục, theo vị trí đầu tiên URL xuất hiện trong survey_data_json. */
export function describeJsonPhotos(json: unknown): Map<string, UnprintedPhotoInfo> {
  const out = new Map<string, UnprintedPhotoInfo>();
  const walk = (value: unknown, keyPath: string[], ctx: string[], index: number | null): void => {
    if (typeof value === 'string') {
      if (!STORED_IMAGE_URL.test(value) || out.has(value)) return;
      const path = keyPath.join('.');
      if (isExcludedPhotoPath(path)) return;
      const lastKeys = keyPath.slice(-2).join('.');
      const hit = KEY_LABELS.find(([re]) => re.test(lastKeys)) ?? KEY_LABELS.find(([re]) => re.test(path));
      const pMatch = path.match(/photoP0(\d)/i);
      const kind = hit ? (pMatch && hit[2] === 'P' ? `P-0${pMatch[1]}` : hit[1]) : 'Ảnh khác';
      const suffix = index !== null ? ` #${index + 1}` : '';
      out.set(value, { label: [...ctx, `${kind}${suffix}`].join(' • '), section: hit ? hit[2] : 'OVERVIEW' });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, keyPath, ctx, i));
      return;
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const nextCtx = [...ctx, ...contextOf(obj).filter((v) => !ctx.includes(v))];
      for (const [k, v] of Object.entries(obj)) {
        if (k.startsWith('_') || /override/i.test(k)) continue;
        walk(v, [...keyPath, k], nextCtx, null);
      }
    }
  };
  walk(json, [], [], null);
  return out;
}

/** Ảnh chỉ có trong bảng DB (không có trong JSON): phân mục theo nguồn của bộ gom ảnh. */
export function sectionFromPoolCategory(category: string): PhotoQcSection {
  if (category === 'MINUTES' || category === 'ABSENCE') return 'DOCUMENT';
  if (category === 'IDENTIFICATION') return 'P';
  if (category === 'OVERVIEW') return 'OVERVIEW';
  return 'DEFECT';
}
