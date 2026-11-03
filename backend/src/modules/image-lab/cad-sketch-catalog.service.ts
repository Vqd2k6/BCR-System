/**
 * Danh mục bản vẽ CAD có sẵn trong dự án để thử ở CAD Lab. Chỉ đọc.
 * Nguồn: floor_surveys (CAD_01 kiến trúc, CAD_02 kết cấu) và building_floor_plans (mặt bằng tòa nhà).
 */

import { Database } from '../../database/db';

export type CadSketchType = 'CAD_ARCH' | 'CAD_STRUCT' | 'CAD_BLUEPRINT';

export interface CadSketchItem {
  url: string;
  cadType: CadSketchType;
  parcelCode: string;
  floorName: string;
  zoneId: string | null;
  reportStatus: string | null;
}

export interface CadSketchQuery {
  /** 'ALL' hoặc mã Zone đã qua kiểm tra quyền. */
  zone: string;
  type: CadSketchType | 'ALL';
  search: string;
  limit: number;
  offset: number;
}

export const CAD_SKETCH_MAX_LIMIT = 100;
export const CAD_SKETCH_DEFAULT_LIMIT = 50;

const CAD_TYPES: readonly CadSketchType[] = ['CAD_ARCH', 'CAD_STRUCT', 'CAD_BLUEPRINT'];

export function parseCadSketchType(raw: unknown): CadSketchType | 'ALL' {
  const value = String(raw ?? '').trim().toUpperCase();
  return (CAD_TYPES as readonly string[]).includes(value) ? (value as CadSketchType) : 'ALL';
}

export function clampCadSketchLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return CAD_SKETCH_DEFAULT_LIMIT;
  return Math.min(CAD_SKETCH_MAX_LIMIT, Math.round(n));
}

export function clampCadSketchOffset(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

const isAllZones = (zone: string): boolean => zone === 'ALL' || zone === 'ALL_ZONES';

export class CadSketchCatalogService {
  static async list(query: CadSketchQuery): Promise<{ total: number; items: CadSketchItem[] }> {
    const params: (string | number | null)[] = [
      isAllZones(query.zone) ? null : query.zone,
      query.type === 'ALL' ? null : query.type,
      query.search ? `%${query.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null,
      query.limit,
      query.offset,
    ];

    const result = await Database.query<{
      url: string;
      cad_type: CadSketchType;
      parcel_code: string | null;
      floor_name: string | null;
      zone_id: string | null;
      report_status: string | null;
      total: string | number;
    }>(
      `
      WITH sources AS (
        SELECT f.cad_drawing_url AS url, 'CAD_ARCH' AS cad_type, f.floor_name,
               p.project_parcel_code AS parcel_code, p.zone_id, r.status AS report_status,
               r.updated_at AS changed_at
        FROM floor_surveys f
        INNER JOIN base_survey_reports r ON r.id = f.report_id AND r.deleted_at IS NULL
        LEFT JOIN parcels p ON p.id = r.parcel_id
        UNION ALL
        SELECT f.cad_structural_drawing_url, 'CAD_STRUCT', f.floor_name,
               p.project_parcel_code, p.zone_id, r.status, r.updated_at
        FROM floor_surveys f
        INNER JOIN base_survey_reports r ON r.id = f.report_id AND r.deleted_at IS NULL
        LEFT JOIN parcels p ON p.id = r.parcel_id
        UNION ALL
        SELECT b.cad_photo_url, 'CAD_BLUEPRINT', b.floor_name,
               p.project_parcel_code, p.zone_id, NULL, COALESCE(b.updated_at, b.created_at)
        FROM building_floor_plans b
        LEFT JOIN parcels p ON p.id = b.parcel_id
        WHERE b.deleted_at IS NULL
      ),
      filtered AS (
        SELECT * FROM sources
        WHERE url ~* '^https?://'
          AND ($1::text IS NULL OR zone_id = $1)
          AND ($2::text IS NULL OR cad_type = $2)
          AND ($3::text IS NULL OR parcel_code ILIKE $3)
      ),
      deduped AS (
        -- Một URL có thể nằm ở cả CAD_01 và CAD_02: giữ bản mới nhất
        SELECT DISTINCT ON (url) * FROM filtered ORDER BY url, changed_at DESC NULLS LAST
      )
      SELECT url, cad_type, parcel_code, floor_name, zone_id, report_status, COUNT(*) OVER () AS total
      FROM deduped
      ORDER BY changed_at DESC NULLS LAST, parcel_code, floor_name, url
      LIMIT $4 OFFSET $5
      `,
      params
    );

    return {
      total: result.rows.length > 0 ? Number(result.rows[0].total) : 0,
      items: result.rows.map((row) => ({
        url: row.url,
        cadType: row.cad_type,
        parcelCode: row.parcel_code ?? '',
        floorName: row.floor_name ?? '',
        zoneId: row.zone_id,
        reportStatus: row.report_status,
      })),
    };
  }
}
