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

    // Ảnh KSV chụp lại (chờ duyệt hoặc đã duyệt): nhóm riêng, nhãn ghi rõ ô gốc để không lẫn với ảnh cũ.
    // Bảng chỉ có sau migration 20261111: kiểm trước để DB chưa migrate không làm hỏng cả pool (lỗi SQL huỷ transaction).
    const hasResurvey = await client.query<{ ok: boolean }>(
      `SELECT to_regclass('survey_photo_resurvey_items') IS NOT NULL AS ok;`
    );
    const resurvey = await client.query<{ new_url: string; slot_code: string; status: string }>(
      hasResurvey.rows[0]?.ok
        ? `SELECT i.new_url, i.slot_code, s.status::text AS status
         FROM survey_photo_resurvey_items i
         JOIN survey_photo_resurveys s ON s.id = i.resurvey_id
        WHERE s.report_id = $1 AND s.deleted_at IS NULL AND s.status IN ('SUBMITTED', 'APPROVED')
          AND i.deleted_at IS NULL AND i.new_url IS NOT NULL
        ORDER BY i.slot_code, i.created_at;`
        : `SELECT NULL::text AS new_url, NULL::text AS slot_code, NULL::text AS status WHERE FALSE AND $1::uuid IS NOT NULL;`,
      [reportId]
    );
    const newPhotos: ReportPhotoPoolItem[] = [];
    const seenNew = new Set<string>();
    for (const row of resurvey.rows) {
      if (seenNew.has(row.new_url)) continue;
      seenNew.add(row.new_url);
      newPhotos.push({ url: row.new_url, category: 'RESURVEY_NEW', label: `Ảnh MỚI chụp lại – ${row.slot_code}${row.status === 'SUBMITTED' ? ' (chờ duyệt)' : ''}`, source: 'photo_resurvey_items' });
    }

    const old = [...sources.entries()]
      .filter(([url]) => !seenNew.has(url))
      .map(([url, source]) => ({ url, source, ...classify(source) }));
    return [...newPhotos, ...old];
  });
}
