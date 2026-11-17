/**
 * ============================================================================
 * DANH SÁCH THỬA Ở MÀN XUẤT REPORT PHASE 1 — PHÂN TRANG PHÍA MÁY CHỦ (18/11/2026)
 *   - Trước đây màn Xuất tải TOÀN BỘ thửa của Zone qua /parcels/zone-map (kèm GeoJSON + subquery KSV)
 *     rồi lọc ở trình duyệt. Endpoint này trả đúng 1 trang (mặc định 20), lọc/tìm trên máy chủ.
 *   - Chủ hộ / số nhà / đường lấy cùng nguồn với zone-map (hồ sơ mới nhất, ưu tiên active_phase1_report_id).
 *   - Chấm trạng thái ảnh cho từng hồ sơ trong trang:
 *       pendingCrops   = crop Photo QC đang PENDING (chấm đỏ),
 *       resurveyPending = ảnh chụp lại chưa xử lý xong: mục của phiên SUBMITTED (chờ duyệt phiên)
 *                         + mục PENDING của phiên APPROVED (chờ "Đưa vào") (chấm vàng).
 *     Chỉ là gợi ý: crop quá hạn và ảnh watermark vẫn chỉ biết khi xem trước / xuất (chốt chặn 409 giữ nguyên).
 * ============================================================================
 */
import { Database } from '../../../database/db';
import { BadRequestError, ForbiddenError } from '../../../common/errors/problem-details';
import type { JwtPayload } from '../../../common/guards/auth.guard';
import { CadastralRepository } from '../../cadastral/cadastral.repository';
import { canAccessZone } from '../utils/zone-access.utils';

export interface Phase1ExportListQuery {
  zoneId: string;
  status: string;
  q: string;
  page: number;
  pageSize: number;
}

export interface Phase1ExportListItem {
  id: string;
  project_parcel_code: string;
  official_cadastral_code: string | null;
  owner_name: string | null;
  house_number: string | null;
  street: string | null;
  survey_status: string;
  building_type: string | null;
  floor_count: number | null;
  updated_at: Date | null;
  active_phase1_report_id: string | null;
  report_id: string | null;
  pending_crops: number;
  resurvey_pending: number;
}

export interface Phase1ExportListResult {
  items: Phase1ExportListItem[];
  total: number;
  page: number;
  pageSize: number;
  hiddenCondoCount: number;
  zoneTotal: number;
}

const ALLOWED_STATUSES = new Set(['APPROVED', 'COMPLETED', 'SUBMITTED', 'IN_PROGRESS', 'NOT_SURVEYED']);
const CONDO_TYPES = ['CONDOMINIUM', 'CONDO'];

/** Thoát ký tự đặc biệt của LIKE để từ khoá tìm đúng nguyên văn. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export class Phase1ExportListService {
  static async list(user: JwtPayload, query: Phase1ExportListQuery): Promise<Phase1ExportListResult> {
    const zone = (query.zoneId || 'ALL').trim().toUpperCase();
    const isAll = zone === 'ALL' || zone === 'ALL_ZONES';
    if (user.role !== 'SUPER_ADMIN' && !canAccessZone(user, isAll ? 'ALL' : zone)) {
      throw new ForbiddenError('Zone này không thuộc phạm vi bạn quản lý');
    }
    const status = (query.status || 'ALL').trim().toUpperCase();
    if (status !== 'ALL' && status !== 'COMPLETED_ONLY' && !ALLOWED_STATUSES.has(status)) {
      throw new BadRequestError(`Trạng thái lọc không hợp lệ: ${query.status}`);
    }
    const pageSize = Math.min(100, Math.max(1, Math.trunc(query.pageSize) || 20));
    const page = Math.max(1, Math.trunc(query.page) || 1);
    const search = (query.q || '').trim();
    // Màn Xuất của Admin: chung cư xem / xuất ở tab riêng.
    const hideCondo = user.role === 'ZONE_ADMIN' || user.role === 'SUPER_ADMIN';

    const params: unknown[] = [];
    const bind = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    const zoneFilter = isAll ? '' : `AND p.zone_id = ANY(${bind(CadastralRepository.getZoneAliases(zone))}::text[])`;
    const condoTypes = bind(CONDO_TYPES);
    const matchParts: string[] = [];
    if (status === 'COMPLETED_ONLY') matchParts.push(`s.survey_status IN ('APPROVED', 'COMPLETED')`);
    else if (status !== 'ALL') matchParts.push(`s.survey_status = ${bind(status)}`);
    if (search) {
      const like = bind(`%${escapeLike(search)}%`);
      matchParts.push(
        `(s.project_parcel_code ILIKE ${like} OR s.official_cadastral_code ILIKE ${like} OR s.owner_name ILIKE ${like}` +
          ` OR s.house_number ILIKE ${like} OR s.street ILIKE ${like})`
      );
    }
    const matched = matchParts.length > 0 ? matchParts.join(' AND ') : 'TRUE';
    const listed = hideCondo ? `(${matched}) AND NOT s.is_condo` : matched;

    // Cùng nguồn chủ hộ / địa chỉ với CadastralRepository.listParcelsByZone (zone-map).
    const shapedCte = `
      WITH shaped AS (
        SELECT p.id,
               p.project_parcel_code,
               p.official_cadastral_code,
               p.survey_status::text AS survey_status,
               p.building_type::text AS building_type,
               p.floor_count,
               p.updated_at,
               p.active_phase1_report_id,
               r_latest.id AS report_id,
               UPPER(COALESCE(p.building_type::text, '')) = ANY(${condoTypes}::text[]) AS is_condo,
               COALESCE(
                 CASE
                   WHEN NULLIF(BTRIM(r_latest.survey_data_json->>'ownerName'), '') IS NOT NULL
                    AND BTRIM(r_latest.survey_data_json->>'ownerName') !~* '^(chủ\\s+hộ\\s+thửa|chưa\\s+cập\\s+nhật|chủ\\s+sở\\s+hữu\\s+thửa)'
                   THEN BTRIM(r_latest.survey_data_json->>'ownerName')
                 END,
                 CASE
                   WHEN NULLIF(BTRIM(p.owner_name), '') IS NOT NULL
                    AND BTRIM(p.owner_name) !~* '^(chủ\\s+hộ\\s+thửa|chưa\\s+cập\\s+nhật|chủ\\s+sở\\s+hữu\\s+thửa)'
                   THEN BTRIM(p.owner_name)
                 END,
                 NULLIF(BTRIM(r_latest.survey_data_json->>'ownerName'), ''),
                 p.owner_name
               ) AS owner_name,
               COALESCE(NULLIF(BTRIM(r_latest.survey_data_json->>'houseNumber'), ''), p.house_number) AS house_number,
               COALESCE(NULLIF(BTRIM(r_latest.survey_data_json->>'street'), ''), p.street) AS street
          FROM parcels p
          LEFT JOIN LATERAL (
            SELECT bsr.id, bsr.survey_data_json
              FROM base_survey_reports bsr
             WHERE bsr.parcel_id = p.id
               AND bsr.unit_id IS NULL
               AND bsr.deleted_at IS NULL
             ORDER BY (CASE WHEN bsr.id = p.active_phase1_report_id THEN 0 ELSE 1 END), bsr.updated_at DESC NULLS LAST, bsr.created_at DESC
             LIMIT 1
          ) r_latest ON TRUE
         WHERE p.lifecycle_status = 'ACTIVE' ${zoneFilter}
      )`;

    const countParams = [...params];
    const counts = await Database.query<{ zone_total: number; total: number; hidden_condo: number }>(
      `${shapedCte}
       SELECT COUNT(*)::int AS zone_total,
              (COUNT(*) FILTER (WHERE ${listed}))::int AS total,
              (COUNT(*) FILTER (WHERE (${matched}) AND s.is_condo))::int AS hidden_condo
         FROM shaped s;`,
      countParams
    );

    const limit = bind(pageSize);
    const offset = bind((page - 1) * pageSize);
    const rows = await Database.query<Omit<Phase1ExportListItem, 'pending_crops' | 'resurvey_pending'> & { is_condo: boolean }>(
      `${shapedCte}
       SELECT s.* FROM shaped s
        WHERE ${listed}
        ORDER BY s.project_parcel_code ASC
        LIMIT ${limit} OFFSET ${offset};`,
      params
    );

    const reportIds = rows.rows.map((r) => r.report_id).filter((id): id is string => Boolean(id));
    const pendingCrops = new Map<string, number>();
    const resurveyPending = new Map<string, number>();
    if (reportIds.length > 0) {
      const crops = await Database.query<{ report_id: string; n: number }>(
        `SELECT report_id, COUNT(*)::int AS n
           FROM photo_qc_photos
          WHERE report_id = ANY($1::uuid[]) AND crop IS NOT NULL AND crop_status = 'PENDING' AND deleted_at IS NULL
          GROUP BY report_id;`,
        [reportIds]
      );
      crops.rows.forEach((r) => pendingCrops.set(r.report_id, r.n));
      const resurvey = await Database.query<{ report_id: string; n: number }>(
        `SELECT s.report_id, COUNT(*)::int AS n
           FROM survey_photo_resurvey_items i
           JOIN survey_photo_resurveys s ON s.id = i.resurvey_id
          WHERE s.report_id = ANY($1::uuid[])
            AND s.deleted_at IS NULL AND i.deleted_at IS NULL
            AND (s.status = 'SUBMITTED' OR (s.status = 'APPROVED' AND i.apply_status = 'PENDING'))
          GROUP BY s.report_id;`,
        [reportIds]
      );
      resurvey.rows.forEach((r) => resurveyPending.set(r.report_id, r.n));
    }

    const summary = counts.rows[0];
    return {
      items: rows.rows.map(({ is_condo: _isCondo, ...row }) => ({
        ...row,
        pending_crops: row.report_id ? pendingCrops.get(row.report_id) ?? 0 : 0,
        resurvey_pending: row.report_id ? resurveyPending.get(row.report_id) ?? 0 : 0,
      })),
      total: summary?.total ?? 0,
      page,
      pageSize,
      hiddenCondoCount: hideCondo ? summary?.hidden_condo ?? 0 : 0,
      zoneTotal: summary?.zone_total ?? 0,
    };
  }
}
