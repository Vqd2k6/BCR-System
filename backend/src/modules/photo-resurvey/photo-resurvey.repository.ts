/**
 * ============================================================================
 * PHOTO RESURVEY – REPOSITORY (SQL tham số hoá, không xoá cứng)
 * ============================================================================
 */

import type { PoolClient, QueryResultRow } from 'pg';
import { Database } from '../../database/db';
import type {
  ResurveyAction,
  ResurveyItemRow,
  ResurveyRenderState,
  ResurveySessionRow,
  ResurveySlotCode,
  ResurveyStatus,
  ResurveyTime2Source,
} from './photo-resurvey.types';

export type Queryable = Pick<PoolClient, 'query'>;

async function run<T extends QueryResultRow>(client: Queryable | null, text: string, params: unknown[]): Promise<T[]> {
  const res = client ? await client.query<T>(text, params) : await Database.query<T>(text, params);
  return res.rows;
}

interface SessionDbRow {
  id: string;
  report_id: string;
  parcel_id: string;
  zone_id: string | null;
  status: string;
  surveyor_id: string | null;
  surveyor_name: string | null;
  submitted_at: Date | null;
  submitted_sha256: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  reject_count: number;
  approved_sha256: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ItemDbRow {
  id: string;
  resurvey_id: string;
  action: string;
  slot_code: string;
  photo_key: string | null;
  original_url: string | null;
  extra_index: number | null;
  new_url: string | null;
  new_sha256: string | null;
  rotation: number;
  na_reason: string | null;
  time2_text: string | null;
  time2_at: Date | null;
  time2_source: string | null;
  captured_at_client: Date | null;
  received_at: Date;
  capture_lat: number | null;
  capture_lng: number | null;
  capture_accuracy_m: number | null;
  distance_to_parcel_m: number | null;
  created_at: Date;
}

const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

const SESSION_SELECT = `
  SELECT s.*, u.full_name AS surveyor_name
  FROM survey_photo_resurveys s
  LEFT JOIN users u ON u.id = s.surveyor_id`;

function toSession(r: SessionDbRow): ResurveySessionRow {
  return {
    id: r.id,
    reportId: r.report_id,
    parcelId: r.parcel_id,
    zoneId: r.zone_id,
    status: (['DRAFT', 'SUBMITTED', 'APPROVED'].includes(r.status) ? r.status : 'DRAFT') as ResurveyStatus,
    surveyorId: r.surveyor_id,
    surveyorName: r.surveyor_name,
    submittedAt: iso(r.submitted_at),
    submittedSha256: r.submitted_sha256,
    reviewedBy: r.reviewed_by,
    reviewedAt: iso(r.reviewed_at),
    reviewNote: r.review_note,
    rejectCount: Number(r.reject_count) || 0,
    approvedSha256: r.approved_sha256,
    createdAt: iso(r.created_at) ?? '',
    updatedAt: iso(r.updated_at) ?? '',
  };
}

function toItem(r: ItemDbRow): ResurveyItemRow {
  return {
    id: r.id,
    resurveyId: r.resurvey_id,
    action: r.action as ResurveyAction,
    slotCode: r.slot_code as ResurveySlotCode,
    photoKey: r.photo_key,
    originalUrl: r.original_url,
    extraIndex: r.extra_index,
    newUrl: r.new_url,
    newSha256: r.new_sha256,
    rotation: Number(r.rotation) || 0,
    naReason: r.na_reason,
    time2Text: r.time2_text,
    time2At: iso(r.time2_at),
    time2Source: (r.time2_source as ResurveyTime2Source | null) ?? null,
    capturedAtClient: iso(r.captured_at_client),
    receivedAt: iso(r.received_at) ?? '',
    captureLat: r.capture_lat,
    captureLng: r.capture_lng,
    captureAccuracyM: r.capture_accuracy_m,
    distanceToParcelM: r.distance_to_parcel_m,
    createdAt: iso(r.created_at) ?? '',
  };
}

export interface InsertItemInput {
  resurveyId: string;
  action: ResurveyAction;
  slotCode: ResurveySlotCode;
  photoKey: string | null;
  originalUrl: string | null;
  extraIndex: number | null;
  newUrl: string | null;
  newR2Key: string | null;
  newSha256: string | null;
  newSizeBytes: number | null;
  rotation: number;
  naReason: string | null;
  time2Text: string | null;
  time2At: Date | null;
  time2Source: ResurveyTime2Source | null;
  capturedAtClient: Date | null;
  captureLat: number | null;
  captureLng: number | null;
  captureAccuracyM: number | null;
  distanceToParcelM: number | null;
  createdBy: string;
}

export class PhotoResurveyRepository {
  static async getSession(id: string, client: Queryable | null = null): Promise<ResurveySessionRow | null> {
    const rows = await run<SessionDbRow>(client, `${SESSION_SELECT} WHERE s.id = $1 AND s.deleted_at IS NULL;`, [id]);
    return rows[0] ? toSession(rows[0]) : null;
  }

  /** Khoá dòng phiên trong transaction để nộp/duyệt/từ chối không chạy chồng nhau. */
  static async lockSession(client: Queryable, id: string): Promise<ResurveySessionRow | null> {
    await client.query(`SELECT id FROM survey_photo_resurveys WHERE id = $1 AND deleted_at IS NULL FOR UPDATE;`, [id]);
    return this.getSession(id, client);
  }

  static async getOpenSession(reportId: string, client: Queryable | null = null): Promise<ResurveySessionRow | null> {
    const rows = await run<SessionDbRow>(
      client,
      `${SESSION_SELECT} WHERE s.report_id = $1 AND s.deleted_at IS NULL AND s.status IN ('DRAFT', 'SUBMITTED')
       ORDER BY s.created_at DESC LIMIT 1;`,
      [reportId]
    );
    return rows[0] ? toSession(rows[0]) : null;
  }

  static async getLatestApprovedSession(reportId: string, client: Queryable | null = null): Promise<ResurveySessionRow | null> {
    const rows = await run<SessionDbRow>(
      client,
      `${SESSION_SELECT} WHERE s.report_id = $1 AND s.deleted_at IS NULL AND s.status = 'APPROVED'
       ORDER BY s.reviewed_at DESC NULLS LAST LIMIT 1;`,
      [reportId]
    );
    return rows[0] ? toSession(rows[0]) : null;
  }

  static async createSession(
    client: Queryable,
    input: { reportId: string; parcelId: string; zoneId: string | null; surveyorId: string }
  ): Promise<ResurveySessionRow> {
    const rows = await run<{ id: string }>(
      client,
      `INSERT INTO survey_photo_resurveys (report_id, parcel_id, zone_id, status, surveyor_id)
       VALUES ($1, $2, $3, 'DRAFT', $4)
       RETURNING id;`,
      [input.reportId, input.parcelId, input.zoneId, input.surveyorId]
    );
    const created = await this.getSession(rows[0].id, client);
    if (!created) throw new Error('[PhotoResurveyRepository:createSession] Không đọc lại được phiên vừa tạo');
    return created;
  }

  static async getActiveItems(sessionId: string, client: Queryable | null = null): Promise<ResurveyItemRow[]> {
    const rows = await run<ItemDbRow>(
      client,
      `SELECT * FROM survey_photo_resurvey_items
       WHERE resurvey_id = $1 AND deleted_at IS NULL
       ORDER BY slot_code, COALESCE(extra_index, 0), created_at;`,
      [sessionId]
    );
    return rows.map(toItem);
  }

  static async getItem(sessionId: string, itemId: string, client: Queryable | null = null): Promise<ResurveyItemRow | null> {
    const rows = await run<ItemDbRow>(
      client,
      `SELECT * FROM survey_photo_resurvey_items WHERE id = $1 AND resurvey_id = $2 AND deleted_at IS NULL;`,
      [itemId, sessionId]
    );
    return rows[0] ? toItem(rows[0]) : null;
  }

  /** Thay thao tác của một ô ảnh gốc: dòng cũ soft-delete (ảnh R2 cũ giữ nguyên), trả về số dòng đã thay. */
  static async softDeleteTarget(client: Queryable, sessionId: string, photoKey: string): Promise<ResurveyItemRow[]> {
    const rows = await run<ItemDbRow>(
      client,
      `UPDATE survey_photo_resurvey_items SET deleted_at = NOW(), updated_at = NOW()
       WHERE resurvey_id = $1 AND photo_key = $2 AND deleted_at IS NULL
       RETURNING *;`,
      [sessionId, photoKey]
    );
    return rows.map(toItem);
  }

  static async softDeleteItem(client: Queryable, sessionId: string, itemId: string): Promise<ResurveyItemRow | null> {
    const rows = await run<ItemDbRow>(
      client,
      `UPDATE survey_photo_resurvey_items SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND resurvey_id = $2 AND deleted_at IS NULL
       RETURNING *;`,
      [itemId, sessionId]
    );
    return rows[0] ? toItem(rows[0]) : null;
  }

  static async nextExtraIndex(client: Queryable, sessionId: string, slotCode: ResurveySlotCode): Promise<number> {
    const rows = await run<{ next: number }>(
      client,
      `SELECT COALESCE(MAX(extra_index), 0)::int + 1 AS next
       FROM survey_photo_resurvey_items
       WHERE resurvey_id = $1 AND slot_code = $2 AND action = 'ADD_EXTRA';`,
      [sessionId, slotCode]
    );
    return rows[0]?.next ?? 1;
  }

  static async insertItem(client: Queryable, i: InsertItemInput): Promise<ResurveyItemRow> {
    const rows = await run<ItemDbRow>(
      client,
      `INSERT INTO survey_photo_resurvey_items (
         resurvey_id, action, slot_code, photo_key, original_url, extra_index,
         new_url, new_r2_key, new_sha256, new_size_bytes, rotation, na_reason,
         time2_text, time2_at, time2_source, captured_at_client,
         capture_lat, capture_lng, capture_accuracy_m, distance_to_parcel_m, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING *;`,
      [
        i.resurveyId, i.action, i.slotCode, i.photoKey, i.originalUrl, i.extraIndex,
        i.newUrl, i.newR2Key, i.newSha256, i.newSizeBytes, i.rotation, i.naReason,
        i.time2Text, i.time2At, i.time2Source, i.capturedAtClient,
        i.captureLat, i.captureLng, i.captureAccuracyM, i.distanceToParcelM, i.createdBy,
      ]
    );
    return toItem(rows[0]);
  }

  static async updateRotation(client: Queryable, itemId: string, rotation: number): Promise<ResurveyItemRow | null> {
    const rows = await run<ItemDbRow>(
      client,
      `UPDATE survey_photo_resurvey_items SET rotation = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING *;`,
      [itemId, rotation]
    );
    return rows[0] ? toItem(rows[0]) : null;
  }

  static async updateTime2(
    client: Queryable,
    itemId: string,
    time2: { text: string; at: Date | null; source: ResurveyTime2Source }
  ): Promise<void> {
    await client.query(
      `UPDATE survey_photo_resurvey_items SET time2_text = $2, time2_at = $3, time2_source = $4, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL;`,
      [itemId, time2.text, time2.at, time2.source]
    );
  }

  static async markSubmitted(client: Queryable, sessionId: string, sha256: string): Promise<void> {
    await client.query(
      `UPDATE survey_photo_resurveys
       SET status = 'SUBMITTED', submitted_at = NOW(), submitted_sha256 = $2, updated_at = NOW()
       WHERE id = $1 AND status = 'DRAFT' AND deleted_at IS NULL;`,
      [sessionId, sha256]
    );
  }

  static async markApproved(client: Queryable, sessionId: string, userId: string, note: string | null, sha256: string): Promise<void> {
    await client.query(
      `UPDATE survey_photo_resurveys
       SET status = 'APPROVED', reviewed_by = $2, reviewed_at = NOW(), review_note = $3, approved_sha256 = $4, updated_at = NOW()
       WHERE id = $1 AND status = 'SUBMITTED' AND deleted_at IS NULL;`,
      [sessionId, userId, note, sha256]
    );
  }

  /** Từ chối: phiên quay về nháp để KSV sửa tiếp trên chính phiên đó (quyết định 09/11/2026). */
  static async markRejected(client: Queryable, sessionId: string, userId: string, note: string): Promise<void> {
    await client.query(
      `UPDATE survey_photo_resurveys
       SET status = 'DRAFT', reviewed_by = $2, reviewed_at = NOW(), review_note = $3,
           reject_count = reject_count + 1, submitted_at = NULL, submitted_sha256 = NULL, updated_at = NOW()
       WHERE id = $1 AND status = 'SUBMITTED' AND deleted_at IS NULL;`,
      [sessionId, userId, note]
    );
  }

  /** Đổi trạng thái cờ Photo QC của các ô ảnh (OPEN/ASSIGNED/RESOLVED), chỉ trên cờ chụp lại đang bật. */
  static async setQcFlagStatus(
    client: Queryable,
    reportId: string,
    photoKeys: string[],
    status: 'OPEN' | 'ASSIGNED' | 'RESOLVED',
    userId: string,
    onlyFrom?: Array<'OPEN' | 'ASSIGNED'>
  ): Promise<string[]> {
    if (photoKeys.length === 0) return [];
    const params: unknown[] = [reportId, photoKeys, status, userId];
    let fromSql = '';
    if (onlyFrom && onlyFrom.length > 0) {
      params.push(onlyFrom);
      fromSql = `AND status = ANY($5::text[])`;
    }
    const rows = await run<{ photo_key: string }>(
      client,
      `UPDATE photo_qc_photos SET status = $3, updated_by = $4, updated_at = NOW()
       WHERE report_id = $1 AND photo_key = ANY($2::text[]) AND deleted_at IS NULL AND recapture = TRUE ${fromSql}
       RETURNING photo_key;`,
      params
    );
    return rows.map((r) => r.photo_key);
  }

  /** Mọi phiên đã duyệt của hồ sơ, theo thứ tự duyệt – phần render đọc (và đóng băng vào snapshot). */
  static async loadRenderState(reportId: string, client: Queryable | null = null): Promise<ResurveyRenderState | null> {
    const sessions = await run<{ id: string; reviewed_at: Date | null }>(
      client,
      `SELECT id, reviewed_at FROM survey_photo_resurveys
       WHERE report_id = $1 AND status = 'APPROVED' AND deleted_at IS NULL
       ORDER BY reviewed_at ASC NULLS FIRST, created_at ASC;`,
      [reportId]
    );
    if (sessions.length === 0) return null;
    const out: ResurveyRenderState = { sessions: [] };
    // Tuần tự: client trong transaction không chạy song song.
    for (const s of sessions) {
      const items = await this.getActiveItems(s.id, client);
      out.sessions.push({
        sessionId: s.id,
        approvedAt: iso(s.reviewed_at),
        items: items.map((i) => ({
          action: i.action,
          slotCode: i.slotCode,
          photoKey: i.photoKey,
          originalUrl: i.originalUrl,
          extraIndex: i.extraIndex,
          newUrl: i.newUrl,
          rotation: i.rotation,
          time2Text: i.time2Text,
        })),
      });
    }
    return out;
  }

  static async writeAuditLog(
    client: Queryable,
    sessionId: string,
    userId: string,
    action: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await client.query(
      `INSERT INTO system_audit_logs (entity_type, entity_id, action, performed_by_user_id, client_ip, diff_payload)
       VALUES ('PHOTO_RESURVEY', $1, $2, $3, $4, $5);`,
      [
        sessionId,
        action,
        userId,
        typeof payload.clientIp === 'string' ? payload.clientIp : null,
        JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
      ]
    );
  }

  /** Khoảng cách (m) từ điểm chụp tới thửa (đa giác địa chính → nền nhà → điểm vị trí), theo mặt cầu. */
  static async distanceToParcel(parcelId: string, lat: number, lng: number): Promise<number | null> {
    const rows = await run<{ d: number | null }>(
      null,
      `SELECT ST_Distance(
                COALESCE(p.cadastral_polygon_geom, p.footprint_polygon_geom, p.location_geom)::geography,
                ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
              ) AS d
       FROM parcels p WHERE p.id = $1;`,
      [parcelId, lng, lat]
    );
    const d = rows[0]?.d;
    return typeof d === 'number' && Number.isFinite(d) ? d : null;
  }
}
