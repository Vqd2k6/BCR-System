/**
 * ============================================================================
 * PHOTO QC – REPOSITORY (SQL tham số hoá, không xoá cứng)
 * ============================================================================
 */

import type { PoolClient, QueryResultRow } from 'pg';
import { Database } from '../../database/db';
import type {
  PhotoQcCrop,
  PhotoQcCropStatus,
  PhotoQcFlagStatus,
  PhotoQcGroup,
  PhotoQcPhotoRow,
  PhotoQcRecaptureLevel,
  PhotoQcRenderState,
  PhotoQcReportRow,
  PhotoQcRestampMode,
  PhotoQcCoverSource,
} from './photo-qc.types';

type Queryable = Pick<PoolClient, 'query'>;

async function run<T extends QueryResultRow>(client: Queryable | null, text: string, params: unknown[]): Promise<T[]> {
  const res = client ? await client.query<T>(text, params) : await Database.query<T>(text, params);
  return res.rows;
}

interface QcReportDbRow {
  report_id: string;
  zone_id: string | null;
  station_code: string | null;
  cover_source: string | null;
  recapture_level: string;
  reviewed: boolean;
  updated_by: string | null;
  updated_at: Date | null;
}

interface QcPhotoDbRow {
  report_id: string;
  photo_key: string;
  photo_url: string;
  photo_label: string | null;
  crop: unknown;
  crop_status: string;
  crop_reviewed_at: Date | null;
  restamp_mode: string;
  recapture: boolean;
  photo_group: string;
  status: string;
  updated_at: Date | null;
}

function parseCrop(raw: unknown): PhotoQcCrop | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
  const crop: PhotoQcCrop = {
    x: num(c.x),
    y: num(c.y),
    w: num(c.w),
    h: num(c.h),
    ratio: c.ratio === '3:4' ? '3:4' : '4:3',
    rotationAtCrop: Number.isFinite(Number(c.rotationAtCrop)) ? Number(c.rotationAtCrop) : 0,
  };
  if (![crop.x, crop.y, crop.w, crop.h].every(Number.isFinite)) {
    console.error('[PhotoQcRepository:parseCrop] Khung crop đã lưu không hợp lệ, bỏ qua', raw);
    return null;
  }
  return crop;
}

export function toReportRow(r: QcReportDbRow): PhotoQcReportRow {
  return {
    reportId: r.report_id,
    zoneId: r.zone_id,
    stationCode: r.station_code,
    coverSource: r.cover_source === 'P04' ? 'P04' : null,
    recaptureLevel: (['AUTO', 'NONE', 'OUTDOOR_ONLY', 'FULL'].includes(r.recapture_level) ? r.recapture_level : 'AUTO') as PhotoQcRecaptureLevel,
    reviewed: Boolean(r.reviewed),
    updatedBy: r.updated_by,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

export function toPhotoRow(r: QcPhotoDbRow): PhotoQcPhotoRow {
  return {
    reportId: r.report_id,
    photoKey: r.photo_key,
    photoUrl: r.photo_url,
    photoLabel: r.photo_label,
    crop: parseCrop(r.crop),
    cropStatus: (['PENDING', 'APPROVED', 'REJECTED'].includes(r.crop_status) ? r.crop_status : 'PENDING') as PhotoQcCropStatus,
    cropReviewedAt: r.crop_reviewed_at ? new Date(r.crop_reviewed_at).toISOString() : null,
    restampMode: (['NONE', 'LOGO', 'TEXT', 'BOTH'].includes(r.restamp_mode) ? r.restamp_mode : 'NONE') as PhotoQcRestampMode,
    recapture: Boolean(r.recapture),
    photoGroup: (r.photo_group === 'INDOOR' ? 'INDOOR' : 'OUTDOOR') as PhotoQcGroup,
    status: (['OPEN', 'ASSIGNED', 'RESOLVED'].includes(r.status) ? r.status : 'OPEN') as PhotoQcFlagStatus,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

export class PhotoQcRepository {
  /** Trạng thái QC phục vụ render (bìa + crop + dập bù). Không có thao tác nào → null (report giữ nguyên). */
  static async loadRenderState(reportId: string, client: Queryable | null = null): Promise<PhotoQcRenderState | null> {
    // Tuần tự: client trong transaction không chạy song song.
    const reportRows = await run<QcReportDbRow>(client, `SELECT * FROM photo_qc_reports WHERE report_id = $1 AND deleted_at IS NULL;`, [reportId]);
    const photoRows = await run<QcPhotoDbRow>(
      client,
      `SELECT * FROM photo_qc_photos WHERE report_id = $1 AND deleted_at IS NULL AND crop IS NOT NULL AND crop_status = 'APPROVED' ORDER BY photo_key;`,
      [reportId]
    );
    const coverSource: PhotoQcCoverSource | null = reportRows[0]?.cover_source === 'P04' ? 'P04' : null;
    const photos = photoRows
      .map(toPhotoRow)
      .filter((p) => p.crop)
      .map((p) => ({ photoKey: p.photoKey, photoUrl: p.photoUrl, crop: p.crop, restampMode: p.restampMode }));
    if (!coverSource && photos.length === 0) return null;
    return { coverSource, photos };
  }

  static async getReportRow(reportId: string, client: Queryable | null = null): Promise<PhotoQcReportRow | null> {
    const rows = await run<QcReportDbRow>(client, `SELECT * FROM photo_qc_reports WHERE report_id = $1 AND deleted_at IS NULL;`, [reportId]);
    return rows[0] ? toReportRow(rows[0]) : null;
  }

  static async getPhotoRows(reportIds: string[], client: Queryable | null = null): Promise<PhotoQcPhotoRow[]> {
    if (reportIds.length === 0) return [];
    const rows = await run<QcPhotoDbRow>(
      client,
      `SELECT * FROM photo_qc_photos WHERE report_id = ANY($1::uuid[]) AND deleted_at IS NULL ORDER BY report_id, photo_key;`,
      [reportIds]
    );
    return rows.map(toPhotoRow);
  }

  static async getReportRows(reportIds: string[], client: Queryable | null = null): Promise<PhotoQcReportRow[]> {
    if (reportIds.length === 0) return [];
    const rows = await run<QcReportDbRow>(
      client,
      `SELECT * FROM photo_qc_reports WHERE report_id = ANY($1::uuid[]) AND deleted_at IS NULL;`,
      [reportIds]
    );
    return rows.map(toReportRow);
  }

  static async upsertReport(
    client: Queryable,
    input: {
      reportId: string;
      zoneId: string | null;
      stationCode: string | null;
      coverSource?: PhotoQcCoverSource | null;
      recaptureLevel?: PhotoQcRecaptureLevel;
      reviewed?: boolean;
      userId: string;
    }
  ): Promise<PhotoQcReportRow> {
    const rows = await run<QcReportDbRow>(
      client,
      `INSERT INTO photo_qc_reports (report_id, zone_id, station_code, cover_source, recapture_level, reviewed, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'AUTO'), COALESCE($6, FALSE), $7, NOW())
       ON CONFLICT (report_id) DO UPDATE SET
         zone_id = EXCLUDED.zone_id,
         station_code = EXCLUDED.station_code,
         cover_source = CASE WHEN $8::boolean THEN EXCLUDED.cover_source ELSE photo_qc_reports.cover_source END,
         recapture_level = COALESCE($5, photo_qc_reports.recapture_level),
         reviewed = COALESCE($6, photo_qc_reports.reviewed),
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW(),
         deleted_at = NULL
       RETURNING *;`,
      [
        input.reportId,
        input.zoneId,
        input.stationCode,
        input.coverSource ?? null,
        input.recaptureLevel ?? null,
        input.reviewed ?? null,
        input.userId,
        input.coverSource !== undefined,
      ]
    );
    return toReportRow(rows[0]);
  }

  /** Ghi 1 ô ảnh. Trường không truyền giữ nguyên; tắt cờ hay bỏ crop là cập nhật, không xoá dòng. */
  static async upsertPhoto(
    client: Queryable,
    input: {
      reportId: string;
      photoKey: string;
      photoUrl: string;
      photoLabel: string;
      photoGroup: PhotoQcGroup;
      crop?: PhotoQcCrop | null;
      restampMode?: PhotoQcRestampMode;
      recapture?: boolean;
      userId: string;
    }
  ): Promise<PhotoQcPhotoRow> {
    const rows = await run<QcPhotoDbRow>(
      client,
      `INSERT INTO photo_qc_photos (report_id, photo_key, photo_url, photo_label, crop, restamp_mode, recapture, photo_group, status, updated_by, updated_at)
       VALUES ($1, $2, $3, $10, $4::jsonb, COALESCE($5, 'NONE'), COALESCE($6, FALSE), $7, 'OPEN', $8, NOW())
       ON CONFLICT (report_id, photo_key) DO UPDATE SET
         photo_url = EXCLUDED.photo_url,
         photo_label = EXCLUDED.photo_label,
         -- Đổi khung crop HOẶC đổi ảnh (photo_url) đều phải duyệt lại: không để crop đã duyệt trượt sang ảnh khác.
         crop_status = CASE
           WHEN ($9::boolean AND photo_qc_photos.crop IS DISTINCT FROM EXCLUDED.crop)
             OR photo_qc_photos.photo_url IS DISTINCT FROM EXCLUDED.photo_url THEN 'PENDING'
           ELSE photo_qc_photos.crop_status
         END,
         crop_reviewed_by = CASE
           WHEN ($9::boolean AND photo_qc_photos.crop IS DISTINCT FROM EXCLUDED.crop)
             OR photo_qc_photos.photo_url IS DISTINCT FROM EXCLUDED.photo_url THEN NULL
           ELSE photo_qc_photos.crop_reviewed_by
         END,
         crop_reviewed_at = CASE
           WHEN ($9::boolean AND photo_qc_photos.crop IS DISTINCT FROM EXCLUDED.crop)
             OR photo_qc_photos.photo_url IS DISTINCT FROM EXCLUDED.photo_url THEN NULL
           ELSE photo_qc_photos.crop_reviewed_at
         END,
         crop = CASE WHEN $9::boolean THEN EXCLUDED.crop ELSE photo_qc_photos.crop END,
         restamp_mode = COALESCE($5, photo_qc_photos.restamp_mode),
         recapture = COALESCE($6, photo_qc_photos.recapture),
         photo_group = EXCLUDED.photo_group,
         status = CASE
           WHEN $6::boolean IS TRUE AND (photo_qc_photos.recapture IS DISTINCT FROM TRUE OR photo_qc_photos.status = 'RESOLVED') THEN 'OPEN'
           ELSE photo_qc_photos.status
         END,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW(),
         deleted_at = NULL
       RETURNING *;`,
      [
        input.reportId,
        input.photoKey,
        input.photoUrl,
        input.crop === undefined || input.crop === null ? null : JSON.stringify(input.crop),
        input.restampMode ?? null,
        input.recapture ?? null,
        input.photoGroup,
        input.userId,
        input.crop !== undefined,
        input.photoLabel,
      ]
    );
    return toPhotoRow(rows[0]);
  }

  /** Duyệt hoặc từ chối crop của một ô. Chỉ ô đang có crop; crop không bị xoá khi từ chối. */
  static async setCropStatus(
    client: Queryable,
    reportId: string,
    photoKey: string,
    status: Exclude<PhotoQcCropStatus, 'PENDING'>,
    userId: string,
    /** Bản ảnh + crop admin đã xem: chỉ cập nhật khi DB vẫn đúng bản này (chống ghi đè crop vừa đổi). */
    expected?: { photoUrl: string; crop: PhotoQcCrop }
  ): Promise<PhotoQcPhotoRow | null> {
    const rows = await run<QcPhotoDbRow>(
      client,
      `UPDATE photo_qc_photos
          SET crop_status = $3, crop_reviewed_by = $4, crop_reviewed_at = NOW(), updated_at = NOW()
        WHERE report_id = $1 AND photo_key = $2 AND crop IS NOT NULL AND deleted_at IS NULL
          AND ($5::text IS NULL OR photo_url = $5)
          AND ($6::jsonb IS NULL OR (crop->>'x')::float8 = ($6::jsonb->>'x')::float8
               AND (crop->>'y')::float8 = ($6::jsonb->>'y')::float8
               AND (crop->>'w')::float8 = ($6::jsonb->>'w')::float8
               AND (crop->>'h')::float8 = ($6::jsonb->>'h')::float8
               AND COALESCE((crop->>'rotationAtCrop')::int, 0) = COALESCE(($6::jsonb->>'rotationAtCrop')::int, 0))
        RETURNING *;`,
      [
        reportId,
        photoKey,
        status,
        userId,
        expected?.photoUrl ?? null,
        expected ? JSON.stringify(expected.crop) : null,
      ]
    );
    return rows[0] ? toPhotoRow(rows[0]) : null;
  }

  /**
   * Thẩm định chỉnh lại khung crop: ghi khung mới + ảnh hiện tại của ô và đặt APPROVED trong một lệnh.
   * Chỉ ghi khi DB vẫn đúng ảnh + khung admin đã xem (cùng điều kiện với setCropStatus).
   */
  static async adjustCrop(
    client: Queryable,
    reportId: string,
    photoKey: string,
    input: { photoUrl: string; crop: PhotoQcCrop },
    userId: string,
    expected: { photoUrl: string; crop: PhotoQcCrop }
  ): Promise<PhotoQcPhotoRow | null> {
    const rows = await run<QcPhotoDbRow>(
      client,
      `UPDATE photo_qc_photos
          SET crop = $3::jsonb, photo_url = $4, crop_status = 'APPROVED', crop_reviewed_by = $5, crop_reviewed_at = NOW(),
              updated_by = $5, updated_at = NOW()
        WHERE report_id = $1 AND photo_key = $2 AND crop IS NOT NULL AND deleted_at IS NULL
          AND photo_url = $6
          AND (crop->>'x')::float8 = ($7::jsonb->>'x')::float8
          AND (crop->>'y')::float8 = ($7::jsonb->>'y')::float8
          AND (crop->>'w')::float8 = ($7::jsonb->>'w')::float8
          AND (crop->>'h')::float8 = ($7::jsonb->>'h')::float8
          AND COALESCE((crop->>'rotationAtCrop')::int, 0) = COALESCE(($7::jsonb->>'rotationAtCrop')::int, 0)
        RETURNING *;`,
      [reportId, photoKey, JSON.stringify(input.crop), input.photoUrl, userId, expected.photoUrl, JSON.stringify(expected.crop)]
    );
    return rows[0] ? toPhotoRow(rows[0]) : null;
  }

  static async writeAuditLog(client: Queryable, reportId: string, userId: string, action: string, payload: Record<string, unknown>): Promise<void> {
    await client.query(
      `INSERT INTO system_audit_logs (entity_type, entity_id, action, performed_by_user_id, diff_payload)
       VALUES ('PHOTO_QC', $1, $2, $3, $4);`,
      [reportId, action, userId, JSON.stringify({ ...payload, timestamp: new Date().toISOString() })]
    );
  }
}

/** Dòng nguồn cho màn tổng quan: chỉ các khoá JSON mà mapper Phụ lục 1 đọc, không trả cả survey_data_json. */
export interface PhotoQcSourceRow {
  id: string;
  report_code: string;
  report_type: string;
  status: string;
  unit_id: string | null;
  unit_code: string | null;
  unit_type: string | null;
  parcel_id: string;
  project_parcel_code: string | null;
  house_number: string | null;
  street: string | null;
  zone_id: string | null;
  zone_name: string | null;
  updated_at: Date;
  json_subset: Record<string, unknown> | null;
  ident_photos: Array<Record<string, unknown>> | null;
  deformation: Record<string, unknown> | null;
}

export const PHOTO_SOURCE_SELECT = `
  SELECT r.id, r.report_code, r.report_type, r.status::text AS status, r.unit_id,
         bu.unit_code, bu.unit_type, r.parcel_id, p.project_parcel_code, p.house_number, p.street,
         p.zone_id, mz.zone_name, r.updated_at,
         jsonb_strip_nulls(jsonb_build_object(
           'photoP01', r.survey_data_json->'photoP01',
           'photoP02', r.survey_data_json->'photoP02',
           'photoP03', r.survey_data_json->'photoP03',
           'photoP04', r.survey_data_json->'photoP04',
           'photoP05', r.survey_data_json->'photoP05',
           'photoP06', r.survey_data_json->'photoP06',
           'photos', r.survey_data_json->'photos',
           'step1Photos', r.survey_data_json->'step1Photos',
           'photoRotations', r.survey_data_json->'photoRotations',
           'vacantLandPhotos', r.survey_data_json->'vacantLandPhotos',
           'underConstructionPhotos', r.survey_data_json->'underConstructionPhotos',
           'settlementTilt', r.survey_data_json->'settlementTilt',
           'projectParcelCode', r.survey_data_json->'projectParcelCode',
           'studioEnhancedPhotos', r.survey_data_json->'studioEnhancedPhotos'
         )) AS json_subset,
         (SELECT COALESCE(json_agg(sp.*), '[]'::json) FROM survey_identification_photos sp WHERE sp.report_id = r.id) AS ident_photos,
         (SELECT row_to_json(da.*) FROM deformation_assessments da WHERE da.report_id = r.id LIMIT 1) AS deformation
  FROM base_survey_reports r
  JOIN parcels p ON p.id = r.parcel_id
  LEFT JOIN metro_zones mz ON mz.zone_code = p.zone_id
  LEFT JOIN building_units bu ON bu.id = r.unit_id`;

export async function fetchPhotoSourceRows(
  where: string[],
  params: unknown[],
  limit: number | null
): Promise<PhotoQcSourceRow[]> {
  // `where` chỉ gồm các mệnh đề hằng có placeholder $n; giá trị luôn đi qua params.
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const allParams = [...params];
  let limitSql = '';
  if (limit) {
    allParams.push(Math.max(1, Math.min(200, Math.floor(limit))));
    limitSql = `LIMIT $${allParams.length}`;
  }
  const res = await Database.query<PhotoQcSourceRow>(
    `${PHOTO_SOURCE_SELECT}
     ${whereSql}
     ORDER BY r.report_code ASC
     ${limitSql};`,
    allParams
  );
  return res.rows;
}

/** survey_data_json đầy đủ của nhiều hồ sơ trong một lượt (ảnh đại diện nhẹ ở màn danh sách). */
export async function fetchSurveyJsonByIds(ids: string[]): Promise<Map<string, unknown>> {
  if (ids.length === 0) return new Map();
  const res = await Database.query<{ id: string; survey_data_json: unknown }>(
    `SELECT id, survey_data_json FROM base_survey_reports WHERE id = ANY($1::uuid[]);`,
    [ids]
  );
  return new Map(res.rows.map((r) => [r.id, r.survey_data_json]));
}
