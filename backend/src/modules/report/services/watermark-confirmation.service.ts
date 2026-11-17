/**
 * ============================================================================
 * XÁC NHẬN DẤU CŨ & GỢI Ý ẢNH THAY (sửa lỗi watermark 13/11/2026)
 *   - confirmLegacy: Zone Admin của Zone / Super Admin xác nhận TỪNG ảnh nghi ngờ "Có dấu cũ" / "Chưa có dấu".
 *     Không có "xác nhận tất cả": người dùng chọn kết quả cho TỪNG ảnh; confirmLegacyBatch chỉ gửi một lần
 *     các lựa chọn từng ảnh đó (18/11/2026). Kết quả gắn theo URL (các ô dùng chung URL dùng chung kết quả).
 *     Kết quả đã xác nhận chỉ Super Admin được sửa. Mọi lần ghi có audit (trước/sau) trong cùng transaction.
 *   - replacementCandidates: ảnh mất file trên R2 / ảnh quá nhỏ → gợi ý (a) bản cùng SHA-256 ở key khác,
 *     (b) ảnh trước đó của cùng ô trong lịch sử. Chỉ GỢI Ý: Admin tự thay qua Studio, render không tự đổi nguồn.
 * ============================================================================
 */

import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { Database } from '../../../database/db';
import { ForbiddenError, BadRequestError } from '../../../common/errors/problem-details';
import type { JwtPayload } from '../../../common/guards/auth.guard';
import { StorageService } from '../../../common/services/storage.service';
import { canAccessZone } from '../utils/zone-access.utils';
import { extractAllImageUrls } from '../utils/report-preload.utils';
import { ReportService } from './report.service';
import { LegacyWatermarkIndex, isFieldPhotoUrl } from './legacy-watermark-index.service';

export interface ConfirmLegacyInput {
  photoUrl: string;
  hasLegacyWatermark: boolean;
  reason?: string | null;
}

export interface ReplacementCandidate {
  url: string;
  /** SAME_SHA = trùng từng bit với ảnh đang mất; PREVIOUS_VERSION = ảnh trước đó của cùng ô (khác nội dung). */
  kind: 'SAME_SHA' | 'PREVIOUS_VERSION';
  photoCode: string | null;
  createdAt: string | null;
  /** File còn trên R2 (null = không kiểm được vì thiếu cấu hình đọc bucket). */
  exists: boolean | null;
}

async function loadReportForUser(user: JwtPayload, reportId: string) {
  const resolved = await ReportService.resolve(reportId);
  if (!canAccessZone(user, resolved.zoneId)) {
    throw new ForbiddenError('Hồ sơ không thuộc Zone bạn quản lý');
  }
  return resolved;
}

/** URL có thật sự nằm trong hồ sơ này (dữ liệu khảo sát hoặc ảnh chụp lại) không, để chặn ghi kết quả cho ảnh lạ. */
async function urlBelongsToReport(reportId: string, raw: Record<string, unknown>, photoUrl: string): Promise<boolean> {
  if (extractAllImageUrls(raw).includes(photoUrl)) return true;
  const res = await Database.query<{ ok: number }>(
    `SELECT 1 AS ok
       FROM survey_photo_resurvey_items i
       JOIN survey_photo_resurveys s ON s.id = i.resurvey_id
      WHERE s.report_id = $1 AND i.deleted_at IS NULL AND (i.new_url = $2 OR i.original_url = $2)
      LIMIT 1;`,
    [reportId, photoUrl]
  );
  if (res.rows.length > 0) return true;
  const reg = await Database.query<{ ok: number }>(
    `SELECT 1 AS ok FROM survey_photo_registry WHERE report_id = $1 AND photo_url = $2 LIMIT 1;`,
    [reportId, photoUrl]
  );
  return reg.rows.length > 0;
}

interface WatermarkStatusRow {
  photo_url: string;
  has_legacy_watermark: boolean;
  verdict: string;
  score: string | null;
  source: string;
  confirmed_by: string | null;
  confirmed_at: Date | null;
}

export interface ConfirmLegacyResult {
  photoUrl: string;
  hasLegacyWatermark: boolean;
  previous: string | null;
}

/** Khoá (FOR UPDATE) các dòng kết quả hiện có của danh sách URL, trả về theo URL. */
async function lockStatusRows(client: PoolClient, photoUrls: string[]): Promise<Map<string, WatermarkStatusRow>> {
  const res = await client.query<WatermarkStatusRow>(
    `SELECT photo_url, has_legacy_watermark, verdict, score, source, confirmed_by, confirmed_at
       FROM photo_watermark_status WHERE photo_url = ANY($1::text[]) FOR UPDATE;`,
    [photoUrls]
  );
  return new Map(res.rows.map((row) => [row.photo_url, row]));
}

/** Ghi 1 xác nhận MANUAL + 1 dòng audit (trước/sau) cho đúng 1 ảnh, trong transaction của người gọi. */
async function writeConfirmation(
  client: PoolClient,
  user: JwtPayload,
  reportId: string,
  input: ConfirmLegacyInput & { photoUrl: string },
  prev: WatermarkStatusRow | null,
  clientIp: string | null,
  batchId: string | null
): Promise<ConfirmLegacyResult> {
  await client.query(
    `INSERT INTO photo_watermark_status
       (photo_url, has_legacy_watermark, verdict, score, detector_version, detected_at, source, confirmed_by, confirmed_at, confirm_reason)
     VALUES ($1, $2, $3, NULL, 'MANUAL', NOW(), 'MANUAL', $4, NOW(), $5)
     ON CONFLICT (photo_url) DO UPDATE
       SET has_legacy_watermark = EXCLUDED.has_legacy_watermark,
           verdict = EXCLUDED.verdict,
           source = 'MANUAL',
           confirmed_by = EXCLUDED.confirmed_by,
           confirmed_at = NOW(),
           confirm_reason = EXCLUDED.confirm_reason;`,
    [input.photoUrl, input.hasLegacyWatermark, input.hasLegacyWatermark ? 'WATERMARKED' : 'CLEAN', user.userId, input.reason ?? null]
  );
  await client.query(
    `INSERT INTO system_audit_logs (entity_type, entity_id, action, performed_by_user_id, client_ip, diff_payload)
     VALUES ('BASE_SURVEY_REPORT', $1, 'PHOTO_WATERMARK_CONFIRM', $2, $3, $4);`,
    [
      reportId,
      user.userId,
      clientIp,
      JSON.stringify({
        photoUrl: input.photoUrl,
        ...(batchId ? { batchId } : {}),
        before: prev
          ? { hasLegacyWatermark: prev.has_legacy_watermark, verdict: prev.verdict, score: prev.score, source: prev.source, confirmedBy: prev.confirmed_by }
          : null,
        after: { hasLegacyWatermark: input.hasLegacyWatermark, source: 'MANUAL', reason: input.reason ?? null },
      }),
    ]
  );
  return { photoUrl: input.photoUrl, hasLegacyWatermark: input.hasLegacyWatermark, previous: prev ? prev.source : null };
}

const ALREADY_CONFIRMED_MESSAGE = 'Chỉ Super Admin được sửa kết quả đã xác nhận.';

export class WatermarkConfirmationService {
  static async confirmLegacy(user: JwtPayload, reportId: string, input: ConfirmLegacyInput, clientIp: string | null) {
    const photoUrl = (input.photoUrl || '').trim();
    if (!photoUrl || !isFieldPhotoUrl(photoUrl)) throw new BadRequestError('URL ảnh không hợp lệ');
    if (typeof input.hasLegacyWatermark !== 'boolean') throw new BadRequestError('Thiếu kết quả xác nhận (có / chưa có dấu cũ)');
    const resolved = await loadReportForUser(user, reportId);
    if (!(await urlBelongsToReport(resolved.id, resolved.raw, photoUrl))) {
      throw new BadRequestError('Ảnh này không thuộc hồ sơ đang xem');
    }

    const result = await Database.transaction(async (client) => {
      const prev = (await lockStatusRows(client, [photoUrl])).get(photoUrl) ?? null;
      if (prev?.source === 'MANUAL' && user.role !== 'SUPER_ADMIN') {
        throw new ForbiddenError(`Ảnh này đã được xác nhận. ${ALREADY_CONFIRMED_MESSAGE}`);
      }
      return writeConfirmation(client, user, resolved.id, { ...input, photoUrl }, prev, clientIp, null);
    });
    LegacyWatermarkIndex.rememberManual(photoUrl, input.hasLegacyWatermark);
    return result;
  }

  /**
   * Gửi một lần nhiều xác nhận mà người dùng đã chọn TỪNG ẢNH trong bản xem trước (không phải "xác nhận tất cả").
   * All-or-nothing: một ảnh không hợp lệ / đã xác nhận (với Zone Admin) thì không ghi ảnh nào.
   * Mỗi ảnh vẫn có 1 dòng audit riêng, cùng batchId.
   */
  static async confirmLegacyBatch(
    user: JwtPayload,
    reportId: string,
    inputs: ConfirmLegacyInput[],
    clientIp: string | null
  ): Promise<{ batchId: string; items: ConfirmLegacyResult[] }> {
    if (inputs.length === 0) throw new BadRequestError('Chưa chọn ảnh nào để xác nhận');
    const items = inputs.map((input) => ({ ...input, photoUrl: (input.photoUrl || '').trim() }));
    const seen = new Set<string>();
    for (const item of items) {
      if (!item.photoUrl || !isFieldPhotoUrl(item.photoUrl)) throw new BadRequestError(`URL ảnh không hợp lệ: ${item.photoUrl}`);
      if (typeof item.hasLegacyWatermark !== 'boolean') throw new BadRequestError('Thiếu kết quả xác nhận (có / chưa có dấu cũ)');
      if (seen.has(item.photoUrl)) throw new BadRequestError(`Ảnh bị chọn trùng trong cùng một lần gửi: ${item.photoUrl}`);
      seen.add(item.photoUrl);
    }

    const resolved = await loadReportForUser(user, reportId);
    for (const item of items) {
      if (!(await urlBelongsToReport(resolved.id, resolved.raw, item.photoUrl))) {
        throw new BadRequestError(`Ảnh không thuộc hồ sơ đang xem: ${item.photoUrl}`);
      }
    }

    const batchId = randomUUID();
    const results = await Database.transaction(async (client) => {
      const prevByUrl = await lockStatusRows(client, items.map((item) => item.photoUrl));
      if (user.role !== 'SUPER_ADMIN') {
        const alreadyConfirmed = items.filter((item) => prevByUrl.get(item.photoUrl)?.source === 'MANUAL');
        if (alreadyConfirmed.length > 0) {
          throw new ForbiddenError(
            `${alreadyConfirmed.length} ảnh đã được xác nhận trước đó, không ghi ảnh nào. ${ALREADY_CONFIRMED_MESSAGE} ` +
              alreadyConfirmed.map((item) => item.photoUrl).join(', ')
          );
        }
      }
      const written: ConfirmLegacyResult[] = [];
      for (const item of items) {
        written.push(await writeConfirmation(client, user, resolved.id, item, prevByUrl.get(item.photoUrl) ?? null, clientIp, batchId));
      }
      return written;
    });
    for (const item of results) LegacyWatermarkIndex.rememberManual(item.photoUrl, item.hasLegacyWatermark);
    return { batchId, items: results };
  }

  /**
   * Ảnh nghi ngờ dấu cũ của hồ sơ (điểm dò trong vùng nghi ngờ), để Studio gắn badge "Cần xác nhận dấu cũ".
   * Chỉ đọc kết quả đã lưu, không dò mới (ảnh chưa dò sẽ được dò ở lần xem trước / xuất report).
   */
  static async listSuspects(user: JwtPayload, reportId: string): Promise<Array<{ url: string; score: number | null }>> {
    const resolved = await loadReportForUser(user, reportId);
    const resurvey = await Database.query<{ new_url: string }>(
      `SELECT i.new_url FROM survey_photo_resurvey_items i JOIN survey_photo_resurveys s ON s.id = i.resurvey_id
        WHERE s.report_id = $1 AND i.deleted_at IS NULL AND i.new_url IS NOT NULL;`,
      [resolved.id]
    );
    const urls = [...new Set([...extractAllImageUrls(resolved.raw), ...resurvey.rows.map((r) => r.new_url)])].filter(isFieldPhotoUrl);
    await LegacyWatermarkIndex.load(urls);
    return urls.flatMap((url) => {
      const info = LegacyWatermarkIndex.statusOf(url);
      return info?.status === 'SUSPECT' && info.suspectReason === 'UNSURE' ? [{ url, score: info.score }] : [];
    });
  }

  static async replacementCandidates(user: JwtPayload, reportId: string, photoUrlRaw: string): Promise<ReplacementCandidate[]> {
    const photoUrl = (photoUrlRaw || '').trim();
    if (!photoUrl) throw new BadRequestError('Thiếu URL ảnh');
    const resolved = await loadReportForUser(user, reportId);
    const rows = await Database.query<{ photo_url: string; photo_code: string | null; created_at: Date | null; kind: string }>(
      `WITH target AS (
         SELECT DISTINCT sha256_hash FROM survey_photo_registry WHERE photo_url = $1 AND sha256_hash IS NOT NULL
       )
       SELECT r.photo_url, r.photo_code, r.created_at, 'SAME_SHA' AS kind
         FROM survey_photo_registry r
        WHERE r.sha256_hash IN (SELECT sha256_hash FROM target) AND r.photo_url <> $1
       UNION
       SELECT r.photo_url, r.photo_code, r.created_at, 'PREVIOUS_VERSION' AS kind
         FROM survey_photo_registry r
        WHERE r.report_id = $2 AND (r.superseded_by_url = $1 OR r.photo_url IN (
                SELECT replacement_for_url FROM survey_photo_registry WHERE photo_url = $1 AND replacement_for_url IS NOT NULL))
        ORDER BY created_at DESC NULLS LAST
        LIMIT 20;`,
      [photoUrl, resolved.id]
    );
    const bucket = StorageService.getPhotoBucket();
    const seen = new Set<string>();
    const out: ReplacementCandidate[] = [];
    for (const r of rows.rows) {
      const key = `${r.kind}|${r.photo_url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let exists: boolean | null = null;
      const objectKey = StorageService.keyFromPublicUrl(r.photo_url);
      if (bucket && objectKey) {
        try {
          exists = await StorageService.objectExists(objectKey, bucket);
        } catch (err) {
          console.error(`[WatermarkConfirmation:candidates] Không kiểm được file R2 ${objectKey}`, err);
        }
      }
      out.push({
        url: r.photo_url,
        kind: r.kind === 'SAME_SHA' ? 'SAME_SHA' : 'PREVIOUS_VERSION',
        photoCode: r.photo_code,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        exists,
      });
    }
    return out;
  }
}
