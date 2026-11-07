import { firstText, getPath, type Json } from './json-reader';

/**
 * Hồ sơ "Đang thi công" / "Đất trống": KSV chọn ở Bước 1, app chỉ bắt ảnh hiện trạng + ghi chú
 * (frontend stepValidator: chỉ Bước 1), không có biên bản ký và không chấm điểm kết cấu.
 * Nguồn phân loại DUY NHẤT dùng chung cho Excel tiến độ và Xuất biên bản hiện trường:
 * chỉ đọc cờ KSV chọn, không suy từ việc có ảnh thi công, để hai báo cáo không thể lệch nhau.
 */
export type SiteCase = 'UNDER_CONSTRUCTION' | 'VACANT_LAND';

const asJson = (value: unknown): Json | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;

export function resolveSiteCase(json: unknown): SiteCase | null {
  const source = asJson(json);
  if (!source) return null;
  const caseType = firstText(getPath(source, 'surveyCaseType')).toUpperCase();
  if (caseType === 'UNDER_CONSTRUCTION') return 'UNDER_CONSTRUCTION';
  if (caseType === 'VACANT_LAND' || getPath(source, 'isVacantLand') === true) return 'VACANT_LAND';
  return null;
}

export const SITE_CASE_TITLE: Record<SiteCase, string> = {
  UNDER_CONSTRUCTION: 'Đang thi công',
  VACANT_LAND: 'Đất trống',
};

/** Ghi chú in ra Excel: "<Loại>: <mô tả giai đoạn KSV ghi>". */
export function siteCaseNote(json: unknown, siteCase: SiteCase): string {
  const source = asJson(json);
  const detail =
    siteCase === 'UNDER_CONSTRUCTION'
      ? firstText(getPath(source, 'constructionStageNotes'), getPath(source, 'constructionStage'))
      : firstText(getPath(source, 'vacantLandNotes'), getPath(source, 'vacantLandStatus'));
  const clean = detail.replace(/\s+/g, ' ').trim();
  return clean ? `${SITE_CASE_TITLE[siteCase]}: ${clean}` : SITE_CASE_TITLE[siteCase];
}

/** Ghi chú ở màn Xuất biên bản / thông điệp từ chối xuất PDF. */
export const SITE_CASE_MINUTES_NOTE: Record<SiteCase, string> = {
  UNDER_CONSTRUCTION: 'Công trình đang thi công – không lập biên bản hiện trường',
  VACANT_LAND: 'Đất trống – không lập biên bản hiện trường',
};
