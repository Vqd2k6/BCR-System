/**
 * ============================================================================
 * REPORT RELEASE SERVICE (V3)
 * Quản lý các Rev phát hành (D2): mỗi Rev lưu file riêng + SHA-256; xuất lại Rev cũ
 * trả đúng file cũ. Rev chỉ tăng khi Zone Admin / Super Admin bấm "Phát hành Rev mới"
 * kèm lý do bắt buộc (D14), có nhật ký kiểm toán.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PoolClient } from 'pg';
import { Database } from '../../database/db';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/problem-details';
import type { JwtPayload } from '../../common/guards/auth.guard';
import { ReportSnapshotService, sha256Hex } from './report-snapshot.service';
import { ReportV3Service, type ResolvedReportV3 } from './report-v3.service';

export const MIN_RELEASE_REASON_LENGTH = 10;

/** Thư mục lưu file Rev – KHÔNG nằm trong /uploads (không public) */
export function getReleaseStorageDir(): string {
  const fromEnv = process.env.REPORT_RELEASE_DIR;
  return fromEnv ? path.resolve(fromEnv) : path.resolve(__dirname, '../../../storage/report-releases');
}

export interface ReportReleaseRecord {
  id: string;
  reportId: string;
  revision: number;
  reason: string;
  isFinal: boolean;
  filePath: string;
  fileSizeBytes: number;
  sha256: string;
  releasedByUserId: string;
  releasedAt: string;
}

interface ReleaseRow {
  id: string;
  report_id: string;
  revision: number;
  reason: string;
  is_final: boolean;
  file_path: string;
  file_size_bytes: string | number;
  sha256: string;
  released_by_user_id: string;
  released_at: Date;
}

function toRecord(row: ReleaseRow): ReportReleaseRecord {
  return {
    id: row.id,
    reportId: row.report_id,
    revision: row.revision,
    reason: row.reason,
    isFinal: row.is_final,
    filePath: row.file_path,
    fileSizeBytes: Number(row.file_size_bytes),
    sha256: row.sha256,
    releasedByUserId: row.released_by_user_id,
    releasedAt: row.released_at.toISOString(),
  };
}

function releaseFilePath(reportId: string, revision: number): string {
  return path.join(getReleaseStorageDir(), reportId, `rev-${String(revision).padStart(2, '0')}.pdf`);
}

export class ReportReleaseService {
  public static async list(reportId: string): Promise<ReportReleaseRecord[]> {
    const res = await Database.query<ReleaseRow>(
      `SELECT id, report_id, revision, reason, is_final, file_path, file_size_bytes, sha256,
              released_by_user_id, released_at
       FROM report_releases
       WHERE report_id = $1 AND deleted_at IS NULL
       ORDER BY revision DESC;`,
      [reportId]
    );
    return res.rows.map(toRecord);
  }

  public static async get(reportId: string, revision?: number): Promise<ReportReleaseRecord | null> {
    const res = await Database.query<ReleaseRow>(
      revision === undefined
        ? `SELECT * FROM report_releases WHERE report_id = $1 AND deleted_at IS NULL ORDER BY revision DESC LIMIT 1;`
        : `SELECT * FROM report_releases WHERE report_id = $1 AND revision = $2 AND deleted_at IS NULL LIMIT 1;`,
      revision === undefined ? [reportId] : [reportId, revision]
    );
    return res.rows[0] ? toRecord(res.rows[0]) : null;
  }

  /** Đọc file Rev và kiểm tra toàn vẹn SHA-256; sai hash → lỗi (không trả file hỏng) */
  public static readVerifiedFile(release: ReportReleaseRecord): Buffer {
    if (!fs.existsSync(release.filePath)) {
      console.error('[ReportRelease] Thiếu file Rev trên đĩa:', release.filePath);
      throw new NotFoundError(`Không tìm thấy file của Rev ${release.revision} trên máy chủ`);
    }
    const buf = fs.readFileSync(release.filePath);
    const actual = sha256Hex(buf);
    if (actual !== release.sha256) {
      console.error('[ReportRelease] SHA-256 không khớp!', { expected: release.sha256, actual, file: release.filePath });
      throw new ConflictError(`File Rev ${release.revision} không còn toàn vẹn (SHA-256 không khớp)`);
    }
    return buf;
  }

  /**
   * Trả file FINAL của hồ sơ APPROVED. Nếu chưa có Rev nào → phát hành Rev 00 (lần xuất Final đầu tiên).
   * Nếu `revision` được chỉ định → trả đúng file Rev đó.
   */
  public static async getOrCreateFinalFile(
    resolved: ResolvedReportV3,
    user: JwtPayload,
    revision?: number
  ): Promise<{ buffer: Buffer; release: ReportReleaseRecord; created: boolean }> {
    const existing = await this.get(resolved.id, revision);
    if (existing) {
      return { buffer: this.readVerifiedFile(existing), release: existing, created: false };
    }
    if (revision !== undefined) {
      throw new NotFoundError(`Hồ sơ chưa có Rev ${revision}`);
    }
    const release = await this.issue(resolved.id, user, 'Phát hành bản Final đầu tiên khi APPROVED', true);
    return { buffer: this.readVerifiedFile(release), release, created: true };
  }

  /** Phát hành Rev mới (D2, D14) */
  public static async issueNewRevision(
    reportIdentifier: string,
    user: JwtPayload,
    reason: string
  ): Promise<ReportReleaseRecord> {
    const trimmed = (reason || '').trim();
    if (trimmed.length < MIN_RELEASE_REASON_LENGTH) {
      throw new BadRequestError(`Lý do phát hành Rev mới là bắt buộc (tối thiểu ${MIN_RELEASE_REASON_LENGTH} ký tự)`);
    }
    const resolved = await ReportV3Service.resolve(reportIdentifier);
    this.assertCanRelease(resolved, user);
    return this.issue(resolved.id, user, trimmed, false);
  }

  /** D14: Zone Admin của đúng phân khu + Super Admin */
  public static assertCanRelease(resolved: ResolvedReportV3, user: JwtPayload): void {
    if (user.role === 'SUPER_ADMIN') return;
    if (user.role === 'ZONE_ADMIN' && user.assignedZoneId && user.assignedZoneId === resolved.zoneId) return;
    throw new ForbiddenError('Chỉ Zone Admin của phân khu chứa hồ sơ này hoặc Super Admin mới được phát hành Rev mới');
  }

  private static async issue(
    reportId: string,
    user: JwtPayload,
    reason: string,
    isFirstFinal: boolean
  ): Promise<ReportReleaseRecord> {
    let writtenFile: string | null = null;
    try {
      return await Database.transaction(async (client: PoolClient) => {
        // Tuần tự hóa phát hành theo hồ sơ (tránh 2 Rev trùng khi bấm đồng thời)
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1));`, [`report_release:${reportId}`]);

        const lockRes = await client.query<{ status: string; approved_at: Date | null; export_revision: number }>(
          `SELECT status, approved_at, export_revision
           FROM base_survey_reports
           WHERE id = $1 AND deleted_at IS NULL FOR UPDATE;`,
          [reportId]
        );
        const rep = lockRes.rows[0];
        if (!rep) throw new NotFoundError(`Không tìm thấy hồ sơ: ${reportId}`);
        if (rep.status !== 'APPROVED') {
          throw new ConflictError('Chỉ hồ sơ đã APPROVED mới phát hành được Rev (hồ sơ chưa duyệt chỉ xuất DRAFT)');
        }

        const maxRes = await client.query<{ max_rev: number | null }>(
          `SELECT MAX(revision) AS max_rev FROM report_releases WHERE report_id = $1;`,
          [reportId]
        );
        const maxRev = maxRes.rows[0]?.max_rev;
        const hasAny = maxRev !== null && maxRev !== undefined;
        // Người khác vừa phát hành Rev đầu tiên trong lúc ta chờ lock → trả lại bản đó
        if (isFirstFinal && hasAny) {
          const cur = await client.query<ReleaseRow>(
            `SELECT * FROM report_releases WHERE report_id = $1 AND revision = $2;`,
            [reportId, maxRev]
          );
          return toRecord(cur.rows[0]);
        }
        const nextRev = hasAny ? Number(maxRev) + 1 : 0;

        // Chụp lại điểm tại thời điểm phát hành Rev này
        const approvedAt = rep.approved_at ?? new Date();
        const snap = await ReportSnapshotService.writeApprovedRelease(
          client,
          reportId,
          user.userId,
          approvedAt,
          `Phát hành Rev ${String(nextRev).padStart(2, '0')}`
        );

        const resolved = await ReportV3Service.resolve(reportId);
        const { pdfBuffer } = await ReportV3Service.renderFinalPdf(resolved, snap.snapshot, nextRev);

        const filePath = releaseFilePath(reportId, nextRev);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, pdfBuffer, { flag: 'wx' });
        writtenFile = filePath;
        const sha = sha256Hex(pdfBuffer);

        const ins = await client.query<ReleaseRow>(
          `INSERT INTO report_releases (
             report_id, revision, reason, is_final, file_path, file_size_bytes, sha256,
             snapshot_version_id, released_by_user_id
           ) VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, $8)
           RETURNING *;`,
          [reportId, nextRev, reason, filePath, pdfBuffer.length, sha, snap.versionId, user.userId]
        );

        await client.query(
          `UPDATE base_survey_reports
           SET export_revision = $2, official_pdf_url = $3, updated_at = NOW()
           WHERE id = $1;`,
          [reportId, nextRev, `/v3/reports/${reportId}/export/pdf?rev=${nextRev}`]
        );

        await client.query(
          `INSERT INTO system_audit_logs (entity_type, entity_id, action, performed_by_user_id, diff_payload)
           VALUES ($1, $2, $3, $4, $5);`,
          [
            'BASE_SURVEY_REPORT',
            reportId,
            isFirstFinal ? 'REPORT_FINAL_RELEASED' : 'REPORT_NEW_REVISION_RELEASED',
            user.userId,
            JSON.stringify({
              reportId,
              oldRevision: hasAny ? Number(maxRev) : null,
              newRevision: nextRev,
              reason,
              sha256: sha,
              snapshotVersionId: snap.versionId,
              timestamp: new Date().toISOString(),
            }),
          ]
        );

        return toRecord(ins.rows[0]);
      });
    } catch (err) {
      if (writtenFile && fs.existsSync(writtenFile)) {
        try {
          fs.unlinkSync(writtenFile);
        } catch (unlinkErr) {
          console.error('[ReportRelease] Không dọn được file mồ côi sau khi rollback:', writtenFile, unlinkErr);
        }
      }
      console.error('[ReportRelease] Phát hành Rev thất bại:', reportId, err);
      throw err;
    }
  }
}
