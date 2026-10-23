/**
 * ============================================================================
 * REPORT RELEASE SERVICE
 * Quản lý các Rev phát hành (D2): mỗi Rev lưu file riêng + SHA-256; xuất lại Rev cũ
 * trả đúng file cũ. Rev chỉ tăng khi Zone Admin / Super Admin bấm "Phát hành Rev mới".
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PoolClient } from 'pg';
import { Database } from '../../../database/db';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../common/errors/problem-details';
import type { JwtPayload } from '../../../common/guards/auth.guard';
import { ReportSnapshotService, sha256Hex } from '../snapshot/report-snapshot.service';
import { ReportService, type ResolvedReport } from './report.service';
import { ReportConfigService } from '../../report_config/report-config.service';

export const MIN_RELEASE_REASON_LENGTH = 10;

export function getReleaseStorageDir(): string {
  const fromEnv = process.env.REPORT_RELEASE_DIR;
  return fromEnv ? path.resolve(fromEnv) : path.resolve(__dirname, '../../../../storage/report-releases');
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
  snapshotVersionId?: string | null;
  releasedByUserId: string;
  releasedByName?: string | null;
  releasedByRole?: string | null;
  releasedAt: string;
  standardTextVersionId?: string | null;
  equipmentSnapshotJson?: unknown;
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
  snapshot_version_id?: string | null;
  released_by_user_id: string;
  released_by_name?: string | null;
  released_by_role?: string | null;
  released_at: Date;
  standard_text_version_id?: string | null;
  equipment_snapshot_json?: unknown;
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
    snapshotVersionId: row.snapshot_version_id ?? null,
    releasedByUserId: row.released_by_user_id,
    releasedByName: row.released_by_name ?? null,
    releasedByRole: row.released_by_role ?? null,
    releasedAt: row.released_at instanceof Date ? row.released_at.toISOString() : String(row.released_at),
    standardTextVersionId: row.standard_text_version_id ?? null,
    equipmentSnapshotJson: row.equipment_snapshot_json ?? null,
  };
}

function releaseFilePath(reportId: string, revision: number): string {
  return path.join(getReleaseStorageDir(), reportId, `rev-${String(revision).padStart(2, '0')}.pdf`);
}

const SELECT_RELEASE_COLS = `rr.id, rr.report_id, rr.revision, rr.reason, rr.is_final, rr.file_path,
  rr.file_size_bytes, rr.sha256, rr.snapshot_version_id,
  rr.released_by_user_id, u.full_name AS released_by_name, u.role::text AS released_by_role,
  rr.released_at, rr.standard_text_version_id, rr.equipment_snapshot_json`;

export class ReportReleaseService {
  public static async list(reportId: string): Promise<ReportReleaseRecord[]> {
    const res = await Database.query<ReleaseRow>(
      `SELECT ${SELECT_RELEASE_COLS} FROM report_releases rr
       LEFT JOIN users u ON u.id = rr.released_by_user_id
       WHERE rr.report_id = $1 AND rr.deleted_at IS NULL ORDER BY rr.revision DESC;`,
      [reportId]
    );
    return res.rows.map(toRecord);
  }

  public static async getReleaseSummary(reportId: string): Promise<{
    releases: ReportReleaseRecord[];
    latestRelease: ReportReleaseRecord | null;
    hasPendingRelease: boolean;
    currentExportRevision: number;
  }> {
    const releases = await this.list(reportId);
    const latestRelease = releases[0] ?? null;

    const repRes = await Database.query<{ export_revision: number; status: string; has_pending_flag: boolean }>(
      `SELECT export_revision, status::text AS status,
              COALESCE((survey_data_json->>'hasPendingRelease')::boolean, FALSE) AS has_pending_flag
       FROM base_survey_reports WHERE id = $1;`,
      [reportId]
    );
    const currentExportRevision = repRes.rows[0]?.export_revision ?? 0;
    const isApproved = repRes.rows[0]?.status === 'APPROVED';
    const hasPendingFlag = Boolean(repRes.rows[0]?.has_pending_flag);

    let hasPendingRelease = false;
    if (isApproved) {
      if (latestRelease) {
        const pendingCheck = await Database.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM survey_report_versions v
           WHERE v.report_id = $1
            AND v.version_tag IN ('APPROVED_RELEASE', 'ADMIN_DIFF_SAVE', 'ROLLBACK_RESTORE')
            AND v.created_at > (SELECT MAX(rr.released_at) FROM report_releases rr WHERE rr.report_id = $1 AND rr.deleted_at IS NULL)
            AND v.id NOT IN (SELECT rr.snapshot_version_id FROM report_releases rr WHERE rr.report_id = $1 AND rr.snapshot_version_id IS NOT NULL AND rr.deleted_at IS NULL);`,
          [reportId]
        );
        hasPendingRelease = Number(pendingCheck.rows[0]?.count || 0) > 0;
      } else {
        const multiApproveCheck = await Database.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM survey_report_versions WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE';`,
          [reportId]
        );
        hasPendingRelease = (Number(multiApproveCheck.rows[0]?.count || 0) > 1 || hasPendingFlag) && currentExportRevision === 0;
      }
    }

    return { releases, latestRelease, hasPendingRelease, currentExportRevision };
  }

  public static async get(reportId: string, revision?: number): Promise<ReportReleaseRecord | null> {
    const res = await Database.query<ReleaseRow>(
      revision === undefined
        ? `SELECT ${SELECT_RELEASE_COLS} FROM report_releases rr LEFT JOIN users u ON u.id = rr.released_by_user_id
           WHERE rr.report_id = $1 AND rr.deleted_at IS NULL ORDER BY rr.revision DESC LIMIT 1;`
        : `SELECT ${SELECT_RELEASE_COLS} FROM report_releases rr LEFT JOIN users u ON u.id = rr.released_by_user_id
           WHERE rr.report_id = $1 AND rr.revision = $2 AND rr.deleted_at IS NULL LIMIT 1;`,
      revision === undefined ? [reportId] : [reportId, revision]
    );
    return res.rows[0] ? toRecord(res.rows[0]) : null;
  }

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

  public static async getOrCreateFinalFile(
    resolved: ResolvedReport,
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

  public static async issueNewRevision(
    reportIdentifier: string,
    user: JwtPayload,
    reason: string
  ): Promise<ReportReleaseRecord> {
    const trimmed = (reason || '').trim();
    if (trimmed.length < MIN_RELEASE_REASON_LENGTH) {
      throw new BadRequestError(`Lý do phát hành Rev mới là bắt buộc (tối thiểu ${MIN_RELEASE_REASON_LENGTH} ký tự)`);
    }
    const resolved = await ReportService.resolve(reportIdentifier);
    this.assertCanRelease(resolved, user);
    return this.issue(resolved.id, user, trimmed, false);
  }

  public static assertCanRelease(resolved: ResolvedReport, user: JwtPayload): void {
    if (user.role === 'SUPER_ADMIN') return;
    if (user.role === 'ZONE_ADMIN' && user.assignedZoneId) {
      const normalizedAssigned = user.assignedZoneId.trim().toUpperCase();
      if (normalizedAssigned === 'ALL' || normalizedAssigned === 'ALL_ZONES' || user.assignedZoneId === resolved.zoneId) {
        return;
      }
    }
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
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1));`, [`report_release:${reportId}`]);

        const lockRes = await client.query<{ status: string; approved_at: Date | null; export_revision: number }>(
          `SELECT status, approved_at, export_revision FROM base_survey_reports WHERE id = $1 AND deleted_at IS NULL FOR UPDATE;`,
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
        if (isFirstFinal && hasAny) {
          const cur = await client.query<ReleaseRow>(
            `SELECT * FROM report_releases WHERE report_id = $1 AND revision = $2;`,
            [reportId, maxRev]
          );
          return toRecord(cur.rows[0]);
        }
        const nextRev = isFirstFinal
          ? (hasAny ? Number(maxRev) + 1 : 0)
          : Math.max(hasAny ? Number(maxRev) + 1 : 1, (Number(rep.export_revision) || 0) + 1);

        const approvedAt = rep.approved_at ?? new Date();
        const latestApprovedSnap = await ReportSnapshotService.getLatestApprovedSnapshot(reportId);
        let canReuseLatestSnap = false;
        if (latestApprovedSnap?.snapshot.frozenParcel && latestApprovedSnap.snapshot.frozenReportData) {
          const linkCheck = await client.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM report_releases WHERE report_id = $1 AND snapshot_version_id = $2 AND deleted_at IS NULL;`,
            [reportId, latestApprovedSnap.versionId]
          );
          canReuseLatestSnap = Number(linkCheck.rows[0]?.count || 0) === 0;
        }

        let snap: { versionId: string; versionNumber: number; snapshot: NonNullable<typeof latestApprovedSnap>['snapshot'] };
        if (canReuseLatestSnap && latestApprovedSnap) {
          const updatedSnapshot = { ...latestApprovedSnap.snapshot, exportRevision: nextRev };
          await client.query(`UPDATE survey_report_versions SET snapshot_data = $1 WHERE id = $2;`, [
            JSON.stringify(updatedSnapshot),
            latestApprovedSnap.versionId,
          ]);
          snap = { versionId: latestApprovedSnap.versionId, versionNumber: 0, snapshot: updatedSnapshot };
        } else {
          snap = await ReportSnapshotService.writeApprovedRelease(
            client,
            reportId,
            user.userId,
            approvedAt,
            `Phát hành Rev ${String(nextRev).padStart(2, '0')}`,
            nextRev
          );
        }

        const activeConfig = await ReportConfigService.getActiveConfig();
        const resolved = await ReportService.resolve(reportId);
        const { pdfBuffer } = await ReportService.renderFinalPdf(resolved, snap.snapshot, nextRev, activeConfig);

        const filePath = releaseFilePath(reportId, nextRev);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, pdfBuffer, { flag: 'wx' });
        writtenFile = filePath;
        const sha = sha256Hex(pdfBuffer);

        const ins = await client.query<ReleaseRow>(
          `INSERT INTO report_releases (
             report_id, revision, reason, is_final, file_path, file_size_bytes, sha256,
             snapshot_version_id, released_by_user_id, standard_text_version_id, equipment_snapshot_json
           ) VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, $8, $9, $10) RETURNING *;`,
          [reportId, nextRev, reason, filePath, pdfBuffer.length, sha, snap.versionId, user.userId, activeConfig.standardTextVersionId, JSON.stringify(activeConfig.equipment)]
        );

        await client.query(
          `UPDATE base_survey_reports
           SET export_revision = $2, official_pdf_url = $3,
               survey_data_json = CASE
                 WHEN survey_data_json IS NOT NULL AND jsonb_typeof(survey_data_json) = 'object'
                 THEN survey_data_json - 'hasPendingRelease' ELSE survey_data_json END,
               updated_at = NOW()
           WHERE id = $1;`,
          [reportId, nextRev, `/reports/${reportId}/export/pdf?rev=${nextRev}`]
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
              standardTextVersionNumber: activeConfig.standardTextVersionNumber,
              equipmentCount: activeConfig.equipment.length,
              timestamp: new Date().toISOString(),
            }),
          ]
        );

        return toRecord(ins.rows[0]);
      });
    } catch (err) {
      if (writtenFile && fs.existsSync(writtenFile)) {
        try { fs.unlinkSync(writtenFile); } catch { /* ignore */ }
      }
      console.error('[ReportRelease] Phát hành Rev thất bại:', reportId, err);
      throw err;
    }
  }
}

