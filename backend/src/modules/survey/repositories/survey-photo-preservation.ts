/**
 * Bảo toàn ảnh khi hồ sơ được ghi lại. Hàng trong bảng có thể đổi, nhưng mọi URL từng thuộc hồ sơ
 * phải còn dấu vết trong survey_photo_registry để truy lại và khôi phục được.
 */
import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { ForbiddenError, NotFoundError } from '../../../common/errors/problem-details';

const LOCKED_REPORT_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'];

export interface SurveyWriteOptions {
  /** Chỉ luồng Zone Admin sửa tại chỗ được ghi vào hồ sơ đã nộp. */
  allowLockedReport?: boolean;
}

export async function assertSurveyContentWritable(
  client: PoolClient,
  reportId: string,
  options?: SurveyWriteOptions
): Promise<void> {
  const res = await client.query<{ status: string }>(
    `SELECT status FROM base_survey_reports WHERE id = $1 FOR UPDATE;`,
    [reportId]
  );
  if (!res.rows[0]) throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
  if (LOCKED_REPORT_STATUSES.includes(res.rows[0].status) && !options?.allowLockedReport) {
    throw new ForbiddenError('Hồ sơ đã nộp nên không ghi đè được nội dung khảo sát; Zone Admin sửa qua màn thẩm định.');
  }
}

const isStoredUrl = (url: unknown): url is string => typeof url === 'string' && /^https?:\/\//.test(url);

function urlsFromJsonList(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>).url : item))
    .filter(isStoredUrl);
}

/** Toàn bộ URL ảnh hồ sơ đang giữ trong các bảng quan hệ, kèm nhóm ảnh để ghi vào registry. */
export async function collectReportPhotoUrls(client: PoolClient, reportId: string): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const add = (category: string, values: unknown[]) =>
    values.filter(isStoredUrl).forEach((url) => {
      if (!urls.has(url)) urls.set(url, category);
    });

  const idPhotos = await client.query(
    `SELECT raw_photo_url, annotated_photo_url FROM survey_identification_photos WHERE report_id = $1;`,
    [reportId]
  );
  idPhotos.rows.forEach((row) => add('IDENTIFICATION', [row.raw_photo_url, row.annotated_photo_url]));

  const floors = await client.query(
    `SELECT overview_photos_json, cad_drawing_url, cad_structural_drawing_url FROM floor_surveys WHERE report_id = $1;`,
    [reportId]
  );
  floors.rows.forEach((row) => {
    add('FLOOR_OVERVIEW', urlsFromJsonList(row.overview_photos_json));
    add('CAD_FLOOR', [row.cad_drawing_url, row.cad_structural_drawing_url]);
  });

  const zones = await client.query(
    `SELECT ctx_photo_url, overview_photos_json FROM damage_zones WHERE report_id = $1 AND is_deleted IS NOT TRUE;`,
    [reportId]
  );
  zones.rows.forEach((row) => {
    add('ZONE_CTX', [row.ctx_photo_url]);
    add('ZONE_OVERVIEW', urlsFromJsonList(row.overview_photos_json));
  });

  const defects = await client.query(
    `SELECT d.cu_photo_url, d.cu_photos_json FROM defect_items d
     JOIN damage_zones z ON z.id = d.zone_id
     WHERE z.report_id = $1 AND d.is_deleted IS NOT TRUE AND z.is_deleted IS NOT TRUE;`,
    [reportId]
  );
  defects.rows.forEach((row) => add('DEFECT_CU', [row.cu_photo_url, ...urlsFromJsonList(row.cu_photos_json)]));

  return urls;
}

/** Ghi vết các URL không còn trong hồ sơ sau một lần lưu; URL đã có trong registry thì đánh dấu thay thế. */
export async function recordDroppedPhotosInTx(
  client: PoolClient,
  reportId: string,
  before: Map<string, string>,
  after: Map<string, string>,
  reason: string
): Promise<void> {
  for (const [url, category] of before) {
    if (after.has(url)) continue;
    const updated = await client.query(
      `UPDATE survey_photo_registry SET status = 'SUPERSEDED', action_reason = $3, updated_at = NOW()
       WHERE report_id = $1 AND photo_url = $2 AND status = 'ACTIVE';`,
      [reportId, url, reason]
    );
    if (updated.rowCount) continue;
    const known = await client.query(`SELECT 1 FROM survey_photo_registry WHERE report_id = $1 AND photo_url = $2 LIMIT 1;`, [
      reportId,
      url,
    ]);
    if (known.rows.length > 0) continue;
    await client.query(
      `INSERT INTO survey_photo_registry (
         report_id, parcel_id, photo_category, photo_type, photo_code, photo_url,
         standardized_filename, sha256_hash, status, action_type, action_reason
       )
       SELECT id, parcel_id, $2, $2, $2, $3, $4, $5, 'SUPERSEDED', 'SURVEY_RESAVE', $6
       FROM base_survey_reports WHERE id = $1;`,
      [
        reportId,
        category,
        url,
        decodeURIComponent(url.split('/').pop() || url),
        crypto.createHash('sha256').update(url).digest('hex'),
        reason,
      ]
    );
  }
}

/** Đổi CTX qua form (không qua thao tác ảnh) cũng phải để lại chuỗi lịch sử như thao tác ảnh. */
export async function recordCtxChangeInTx(
  client: PoolClient,
  reportId: string,
  zoneId: string,
  newUrl: string,
  reason: string
): Promise<void> {
  if (!isStoredUrl(newUrl)) return;
  const zone = await client.query<{ zone_code: string; ctx_photo_url: string | null }>(
    `SELECT zone_code, ctx_photo_url FROM damage_zones WHERE id = $1;`,
    [zoneId]
  );
  const oldUrl = zone.rows[0]?.ctx_photo_url || '';
  if (!zone.rows[0] || oldUrl === newUrl) return;

  await client.query(
    `UPDATE survey_photo_registry SET status = 'SUPERSEDED', superseded_by_url = $3, updated_at = NOW()
     WHERE report_id = $1 AND photo_url = $2 AND status = 'ACTIVE' AND photo_type = 'CTX';`,
    [reportId, oldUrl, newUrl]
  );
  await client.query(
    `INSERT INTO survey_photo_registry (
       report_id, parcel_id, photo_category, photo_type, photo_code, photo_url, replacement_for_url,
       standardized_filename, sha256_hash, status, action_type, action_reason, actor_role
     )
     SELECT id, parcel_id, 'ZONE_CTX', 'CTX', $2, $3, NULLIF($4, ''), $5, $6, 'ACTIVE', $7, $8, 'ZONE_ADMIN'
     FROM base_survey_reports WHERE id = $1;`,
    [
      reportId,
      zone.rows[0].zone_code,
      newUrl,
      oldUrl,
      decodeURIComponent(newUrl.split('/').pop() || newUrl),
      crypto.createHash('sha256').update(newUrl).digest('hex'),
      oldUrl ? 'REPLACE' : 'ADD',
      reason,
    ]
  );
}
