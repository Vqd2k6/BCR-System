import { Database } from '../../../database/db';
import { collectReportPhotoUrls } from '../../survey/repositories/survey-photo-preservation';

export interface ReportPhotoPoolItem {
  url: string;
  category: string;
  label: string;
  /** Đường dẫn JSON (vd `zones.0.defects.0.cuPhotos`) hoặc tên bảng nguồn – để dựng nhãn ô ảnh. */
  source: string;
}

const STORED_IMAGE_URL = /^https?:\/\/\S+\.(jpe?g|png|webp)(\?\S*)?$/i;

const POOL_GROUPS: Array<[RegExp, string, string]> = [
  [/workingMinutes|minutes/i, 'MINUTES', 'Ảnh biên bản'],
  [/absen|notice/i, 'ABSENCE', 'Ảnh vắng mặt'],
  [/photoP0\d|IDENTIFICATION/i, 'IDENTIFICATION', 'Ảnh định danh'],
  [/cad/i, 'CAD', 'Sơ đồ CAD'],
  [/ctx/i, 'CTX', 'Ảnh bối cảnh'],
  [/cuPhoto|DEFECT|cu_photo/i, 'DEFECT_CU', 'Ảnh cận cảnh khuyết tật'],
  [/overview/i, 'OVERVIEW', 'Ảnh tổng quan'],
];

function classify(source: string): { category: string; label: string } {
  const group = POOL_GROUPS.find(([pattern]) => pattern.test(source));
  return group ? { category: group[1], label: group[2] } : { category: 'OTHER', label: 'Ảnh khác' };
}

/** Chữ ký không phải ảnh hiện trường; riêng ảnh biên bản nằm trong khối `signatures` nên vẫn lấy. */
function isExcludedKey(key: string, path: string): boolean {
  if (key.startsWith('_') || /override/i.test(key)) return true;
  if (/signature/i.test(key) && key !== 'signatures') return true;
  return path.startsWith('signatures.') && !path.startsWith('signatures.workingMinutesPhotos');
}

function walkJsonPhotos(value: unknown, path: string, found: Map<string, string>): void {
  if (typeof value === 'string') {
    if (STORED_IMAGE_URL.test(value) && !found.has(value)) found.set(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => walkJsonPhotos(item, path, found));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (!isExcludedKey(key, childPath)) walkJsonPhotos(child, childPath, found);
    }
  }
}

/** Gộp cả JSON vì sổ cái ảnh còn thiếu ảnh cũ; chỉ trong đúng một hồ sơ, không đọc file trên kho ảnh. */
export async function listReportPhotoPool(reportId: string): Promise<ReportPhotoPoolItem[]> {
  return Database.transaction(async (client) => {
    const fromTables = await collectReportPhotoUrls(client, reportId);
    const res = await client.query<{ survey_data_json: Record<string, unknown> | null }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [reportId]
    );
    const fromJson = new Map<string, string>();
    walkJsonPhotos(res.rows[0]?.survey_data_json ?? {}, '', fromJson);

    const sources = new Map<string, string>(fromJson);
    for (const [url, category] of fromTables) {
      if (!sources.has(url) && !/signature/i.test(category)) sources.set(url, category);
    }
    return [...sources.entries()].map(([url, source]) => ({ url, source, ...classify(source) }));
  });
}
