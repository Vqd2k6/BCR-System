import type { PoolClient } from 'pg';
import { ZONE_SEGMENT_PREFIX_MAP } from '../../../common/constants/zone-prefixes';
import { computeAlignmentSide } from '../../progress-report/geo/alignment-geometry';
import type { AlignmentSide } from '../../progress-report/progress-report.types';

/**
 * Mã số biện pháp trước thi công (parcels.method_code).
 *
 *   C&C : ST{seq}-{L|R}-{số}[-XD|-DU]      VD ST04-L-0146
 *   POR : POR-{seq}-{L|R}-{số}[-XD|-DU]    VD POR-01-R-1111 (seq = ga xuất phát của đoạn hầm)
 *   DEP : DEP-01-{L|R}-{số}[-XD|-DU]
 *
 * - Tiền tố suy từ zone_id của thửa (ZONE_SEGMENT_PREFIX_MAP), khớp mã bản vẽ resolveZoneDrawingIdentity ở frontend.
 * - Số thứ tự giữ nguyên dãy số cuối của mã khảo sát (không pad lại), giữ hậu tố -XD/-DU.
 * - Trái/Phải dùng chung computeAlignmentSide (tim tuyến CAD MAUR 537 điểm) với Báo cáo tiến độ,
 *   tâm thửa lấy cùng biểu thức COALESCE như PARCEL_GEO_CTE của Báo cáo tiến độ.
 * - Mã đã cấp là bất biến (trigger trg_protect_parcel_method_code); helper chỉ ghi vào dòng còn NULL.
 */

export const METHOD_CODE_PATTERN = /^(ST\d{2}|POR-\d{2}|DEP-01)-[LR]-\d{4,}(-XD|-DU)?$/;

const SURVEY_CODE_TAIL = /(\d+)(-XD|-DU)?$/;

/**
 * Chỉ nhận zone_id chuẩn ZONE_01..ZONE_22. Zone id cũ ZONE_S{n} KHÔNG được suy diễn vì hai nguồn cũ
 * hiểu khác nhau (import_ks003: ZONE_S2 = Ga S2; deploy_5zones_to_cloud: ZONE_S2 -> ZONE_02 đoạn hầm POR).
 */
export function resolveMethodCodePrefix(zoneId: string): string {
  const meta = ZONE_SEGMENT_PREFIX_MAP[zoneId];
  if (!meta) {
    throw new Error(`[ParcelMethodCode:Prefix] Zone "${zoneId}" không có trong bảng phân vùng, không sinh được mã biện pháp.`);
  }
  const seq = String(meta.seq).padStart(2, '0');
  switch (meta.type) {
    case 'C&C':
      return `ST${seq}`;
    case 'POR':
      return `POR-${seq}`;
    case 'DEP':
      return `DEP-${seq}`;
    default:
      throw new Error(`[ParcelMethodCode:Prefix] Loại Zone "${meta.type}" (${zoneId}) chưa có quy ước mã biện pháp.`);
  }
}

export function buildMethodCode(zoneId: string, projectParcelCode: string, side: AlignmentSide): string {
  const prefix = resolveMethodCodePrefix(zoneId);
  const match = SURVEY_CODE_TAIL.exec(projectParcelCode.trim());
  if (!match) {
    throw new Error(`[ParcelMethodCode:Build] Mã khảo sát "${projectParcelCode}" không tách được số thứ tự công trình.`);
  }
  const [, digits, suffix = ''] = match;
  if (digits.length < 4) {
    throw new Error(`[ParcelMethodCode:Build] Mã khảo sát "${projectParcelCode}" có số thứ tự ít hơn 4 chữ số.`);
  }
  const sideLetter = side === 'LEFT' ? 'L' : 'R';
  const code = `${prefix}-${sideLetter}-${digits}${suffix}`;
  if (!METHOD_CODE_PATTERN.test(code)) {
    throw new Error(`[ParcelMethodCode:Build] Mã biện pháp "${code}" sinh từ "${projectParcelCode}" sai định dạng.`);
  }
  return code;
}

export interface ParcelMethodSourceRow {
  id: string;
  zone_id: string;
  project_parcel_code: string;
  method_code: string | null;
  pt_lng: number | null;
  pt_lat: number | null;
}

/** Tâm thửa lấy cùng biểu thức với PARCEL_GEO_CTE của Báo cáo tiến độ để Trái/Phải hai nơi trùng nhau */
export const METHOD_CODE_SOURCE_SELECT = `
  SELECT p.id, p.zone_id, p.project_parcel_code, p.method_code,
         ST_X(pt.g) AS pt_lng, ST_Y(pt.g) AS pt_lat
    FROM parcels p
    LEFT JOIN LATERAL (
      SELECT ST_SetSRID(
               COALESCE(p.location_geom, ST_Centroid(p.footprint_polygon_geom), ST_Centroid(p.cadastral_polygon_geom)),
               4326
             ) AS g
    ) pt ON TRUE`;

/** Tính mã biện pháp từ dữ liệu nguồn (hàm thuần, dùng chung cho luồng tạo thửa và chế độ xem trước của backfill) */
export function computeMethodCode(row: ParcelMethodSourceRow): string {
  const lng = row.pt_lng === null ? NaN : Number(row.pt_lng);
  const lat = row.pt_lat === null ? NaN : Number(row.pt_lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error(`[ParcelMethodCode:Compute] Thửa ${row.project_parcel_code} thiếu toạ độ/hình học, không xác định được Trái/Phải tuyến.`);
  }
  const { side } = computeAlignmentSide([lng, lat]);
  if (!side) {
    throw new Error(`[ParcelMethodCode:Compute] Thửa ${row.project_parcel_code} nằm đúng trên tim tuyến, không xác định được Trái/Phải tuyến.`);
  }
  return buildMethodCode(row.zone_id, row.project_parcel_code, side);
}

/**
 * Sinh và ghi mã biện pháp cho 1 thửa, chạy trong transaction của luồng tạo thửa (cùng client).
 * Thửa đã có mã thì trả lại mã cũ, không tính lại. Không tính được thì throw để transaction rollback.
 */
export async function assignMethodCode(client: PoolClient, parcelId: string): Promise<string> {
  const res = await client.query<ParcelMethodSourceRow>(
    `${METHOD_CODE_SOURCE_SELECT}
      WHERE p.id = $1::uuid;`,
    [parcelId]
  );
  const row = res.rows[0];
  if (!row) {
    throw new Error(`[ParcelMethodCode:Assign] Không tìm thấy thửa ${parcelId}.`);
  }
  if (row.method_code) return row.method_code;

  const methodCode = computeMethodCode(row);
  const upd = await client.query<{ method_code: string }>(
    `UPDATE parcels SET method_code = $1
      WHERE id = $2::uuid AND method_code IS NULL
      RETURNING method_code;`,
    [methodCode, parcelId]
  );
  if (upd.rowCount !== 1) {
    throw new Error(`[ParcelMethodCode:Assign] Không ghi được mã biện pháp ${methodCode} cho thửa ${row.project_parcel_code}.`);
  }
  return methodCode;
}
