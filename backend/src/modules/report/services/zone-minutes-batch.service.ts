/**
 * ============================================================================
 * ZONE MINUTES BATCH SERVICE
 * Job nền xuất ZIP biên bản hiện trường theo Zone: tuần tự từng căn, 1 job mỗi lúc,
 * ZIP ghi ra đĩa để không giữ PDF trong RAM. Tiến độ lưu trên compiled_report_batches.
 * ============================================================================
 */

import { createHash, randomUUID } from 'crypto';
import { once } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';
import jwt from 'jsonwebtoken';
import type { PoolClient } from 'pg';
import { config } from '../../../config';
import { Database } from '../../../database/db';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableEntityError,
} from '../../../common/errors/problem-details';
import type { JwtPayload } from '../../../common/guards/auth.guard';
import { canAccessZone } from '../utils/zone-access.utils';
import { MinutesExportService, safeFilePart, type MinutesListItem } from './minutes-export.service';
import { ReportService } from './report.service';

const JOB_KIND = 'FIELD_MINUTES';
const FILE_RETENTION_DAYS = 7;
const DOWNLOAD_TICKET_TTL = '5m';
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export interface MinutesJobStatus {
  id: string;
  zoneId: string;
  status: string;
  progressDone: number;
  progressTotal: number;
  failedCount: number;
  currentItem: string | null;
  fileSizeBytes: number | null;
  checksumSha256: string | null;
  errorMessage: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface JobRow {
  id: string;
  zone_id: string;
  status: string;
  progress_done: number;
  progress_total: number;
  failed_count: number;
  current_item: string | null;
  file_size_bytes: string | null;
  checksum_sha256: string | null;
  error_message: string | null;
  expires_at: Date | null;
  created_at: Date;
  file_path: string | null;
  exported_by_user_id: string;
}

interface ManifestRow {
  item: MinutesListItem;
  fileName: string | null;
  sha256: string | null;
  note: string | null;
}

export function getMinutesExportDir(): string {
  const fromEnv = process.env.MINUTES_EXPORT_DIR;
  return fromEnv ? path.resolve(fromEnv) : path.resolve(__dirname, '../../../../storage/minutes-exports');
}

/** Bọc dấu nháy và chặn CSV injection: ô bắt đầu bằng ký tự công thức được đệm dấu nháy đơn. */
const csvCell = (value: string | number | null): string => {
  const text = value === null ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
};

const buildManifestCsv = (rows: ManifestRow[]): string => {
  const header = ['Mã thửa', 'Mã căn', 'Trạng thái hồ sơ', 'Nhãn', 'Số trang bản quét', 'SHA-256 PDF', 'Tên file', 'Ghi chú'];
  const lines = rows.map(({ item, fileName, sha256, note }) =>
    [
      item.parcelCode,
      item.unitCode,
      item.reportStatus,
      item.label,
      item.docPageCount,
      sha256,
      fileName,
      note,
    ].map(csvCell).join(',')
  );
  return `﻿${[header.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`;
};

const hashFile = async (filePath: string): Promise<string> => {
  const hash = createHash('sha256');
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest('hex');
};

const removeFileQuietly = async (filePath: string): Promise<void> => {
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`[MinutesExport:RemoveFile] Không xóa được ${filePath}:`, err);
    }
  }
};

const toStatus = (row: JobRow): MinutesJobStatus => ({
  id: row.id,
  zoneId: row.zone_id,
  status: row.status,
  progressDone: row.progress_done,
  progressTotal: row.progress_total,
  failedCount: row.failed_count,
  currentItem: row.current_item,
  fileSizeBytes: row.file_size_bytes === null ? null : Number(row.file_size_bytes),
  checksumSha256: row.checksum_sha256,
  errorMessage: row.error_message,
  expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  createdAt: new Date(row.created_at).toISOString(),
});

export class ZoneMinutesBatchService {
  private static isWorkerRunning = false;

  public static async recordAudit(
    entityId: string,
    action: string,
    userId: string,
    clientIp: string | null,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      await Database.query(
        `INSERT INTO system_audit_logs (entity_type, entity_id, action, performed_by_user_id, client_ip, diff_payload)
         VALUES ('FIELD_MINUTES_EXPORT', $1, $2, $3, $4, $5);`,
        [entityId, action, userId, clientIp, JSON.stringify(payload)]
      );
    } catch (err) {
      console.error('[MinutesExport:Audit] Không ghi được audit log:', err);
    }
  }

  public static async createJob(zoneId: string, user: JwtPayload, clientIp: string | null): Promise<MinutesJobStatus> {
    const items = await MinutesExportService.listZoneMinutes(zoneId);
    const exportable = items.filter((item) => item.fileName);
    if (exportable.length === 0) {
      throw new UnprocessableEntityError('Zone này chưa có biên bản nào đủ điều kiện xuất');
    }

    const target = zoneId.trim().toUpperCase();
    const { job, isNew } = await Database.transaction(async (client: PoolClient) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1));`, [`minutes_batch:${target}`]);
      const existing = await client.query<JobRow>(
        `SELECT * FROM compiled_report_batches
         WHERE zone_id = $1 AND filter_criteria_json->>'kind' = $2 AND status IN ('QUEUED', 'PROCESSING')
         ORDER BY created_at DESC LIMIT 1;`,
        [target, JOB_KIND]
      );
      if (existing.rows[0]) return { job: existing.rows[0], isNew: false };

      const created = await client.query<JobRow>(
        `INSERT INTO compiled_report_batches (
           batch_code, zone_id, export_scope, filter_criteria_json, exported_by_user_id,
           export_format, include_gis_overview_map, include_ecs_summary_table, status, progress_total
         ) VALUES ($1, $2, 'FILTER_CRITERIA', $3, $4, 'ZIP_INDIVIDUAL_PDFS', FALSE, FALSE, 'QUEUED', $5)
         RETURNING *;`,
        [
          `MIN-${randomUUID().slice(0, 8).toUpperCase()}`,
          target,
          JSON.stringify({ kind: JOB_KIND, clientIp }),
          user.userId,
          exportable.length,
        ]
      );
      return { job: created.rows[0], isNew: true };
    });

    if (isNew) this.kickWorker();
    return toStatus(job);
  }

  private static kickWorker(): void {
    if (this.isWorkerRunning) return;
    this.isWorkerRunning = true;
    this.drainQueue()
      .catch((err) => console.error('[MinutesExport:Worker] Worker dừng bất thường:', err))
      .finally(() => {
        this.isWorkerRunning = false;
      });
  }

  private static async drainQueue(): Promise<void> {
    for (;;) {
      const claimed = await Database.query<JobRow>(
        `UPDATE compiled_report_batches SET status = 'PROCESSING'
         WHERE id = (
           SELECT id FROM compiled_report_batches
           WHERE status = 'QUEUED' AND filter_criteria_json->>'kind' = $1
           ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
         )
         RETURNING *;`,
        [JOB_KIND]
      );
      const job = claimed.rows[0];
      if (!job) return;

      try {
        await this.processJob(job);
      } catch (err) {
        console.error(`[MinutesExport:Job] Job ${job.id} thất bại:`, err);
        await Database.query(
          `UPDATE compiled_report_batches SET status = 'FAILED', error_message = $2, current_item = NULL WHERE id = $1;`,
          [job.id, err instanceof Error ? err.message : String(err)]
        );
      }
    }
  }

  private static async processJob(job: JobRow): Promise<void> {
    const exportDir = getMinutesExportDir();
    await fs.promises.mkdir(exportDir, { recursive: true });
    const finalPath = path.join(exportDir, `${job.id}.zip`);
    const partPath = `${finalPath}.part`;

    const output = fs.createWriteStream(partPath);
    const archive = archiver('zip', { store: true });
    const archiveDone = pipeline(archive, output);

    const manifest: ManifestRow[] = [];
    const usedNames = new Set<string>();
    let okCount = 0;
    let failedCount = 0;

    try {
      const items = await MinutesExportService.listZoneMinutes(job.zone_id);
      const total = items.filter((item) => item.fileName).length;
      await Database.query(`UPDATE compiled_report_batches SET progress_total = $2 WHERE id = $1;`, [job.id, total]);

      let done = 0;
      for (const item of items) {
        if (!item.reportId || !item.fileName) {
          manifest.push({ item, fileName: null, sha256: null, note: item.note });
          continue;
        }

        const display = [item.parcelCode, item.unitCode].filter(Boolean).join(' / ');
        await Database.query(`UPDATE compiled_report_batches SET current_item = $2 WHERE id = $1;`, [job.id, display.slice(0, 128)]);

        try {
          const resolved = await ReportService.resolve(item.reportId);
          const { pdfBuffer, fileName } = await MinutesExportService.renderMinutesPdf(resolved);
          const folder = safeFilePart(item.parcelCode);
          let entryName = `${folder}/${fileName}`;
          for (let suffix = 2; usedNames.has(entryName); suffix++) {
            entryName = `${folder}/${fileName.replace(/\.pdf$/, `_${suffix}.pdf`)}`;
          }
          usedNames.add(entryName);

          const entryWritten = once(archive, 'entry');
          archive.append(pdfBuffer, { name: entryName });
          await entryWritten;

          manifest.push({
            item,
            fileName: entryName,
            sha256: createHash('sha256').update(pdfBuffer).digest('hex'),
            note: item.note,
          });
          okCount++;
        } catch (err) {
          console.error(`[MinutesExport:Item] Lỗi xuất ${display}:`, err);
          failedCount++;
          manifest.push({
            item,
            fileName: null,
            sha256: null,
            note: `LỖI XUẤT: ${err instanceof Error ? err.message : String(err)}`,
          });
        }

        done++;
        await Database.query(
          `UPDATE compiled_report_batches SET progress_done = $2, failed_count = $3 WHERE id = $1;`,
          [job.id, done, failedCount]
        );
      }

      if (okCount === 0) {
        throw new Error(`Không xuất được file nào trong ${total} biên bản`);
      }

      archive.append(buildManifestCsv(manifest), { name: `Danh_muc_bien_ban_${job.zone_id}.csv` });
      await archive.finalize();
      await archiveDone;
    } catch (err) {
      archive.abort();
      await archiveDone.catch(() => undefined);
      await removeFileQuietly(partPath);
      throw err;
    }

    const checksum = await hashFile(partPath);
    await fs.promises.rename(partPath, finalPath);
    const { size } = await fs.promises.stat(finalPath);

    await Database.query(
      `UPDATE compiled_report_batches
       SET status = 'COMPLETED', current_item = NULL, file_path = $2, file_size_bytes = $3, checksum_sha256 = $4,
           total_reports_compiled = $5, expires_at = NOW() + make_interval(days => $6)
       WHERE id = $1;`,
      [job.id, finalPath, size, checksum, okCount, FILE_RETENTION_DAYS]
    );

    const criteria = await Database.query<{ filter_criteria_json: { clientIp?: string | null } }>(
      `SELECT filter_criteria_json FROM compiled_report_batches WHERE id = $1;`,
      [job.id]
    );
    await this.recordAudit(job.id, 'EXPORT_ZIP', job.exported_by_user_id, criteria.rows[0]?.filter_criteria_json?.clientIp ?? null, {
      zoneId: job.zone_id,
      totalFiles: okCount,
      failedCount,
      fileSizeBytes: size,
      sha256: checksum,
    });
  }

  private static async getJobRow(jobId: string): Promise<JobRow> {
    const res = await Database.query<JobRow>(
      `SELECT * FROM compiled_report_batches WHERE id = $1 AND filter_criteria_json->>'kind' = $2;`,
      [jobId, JOB_KIND]
    );
    if (!res.rows[0]) throw new NotFoundError('Không tìm thấy job xuất biên bản');
    return res.rows[0];
  }

  public static async getJob(jobId: string, user: JwtPayload): Promise<MinutesJobStatus> {
    const job = await this.getJobRow(jobId);
    if (!canAccessZone(user, job.zone_id)) {
      throw new ForbiddenError('Bạn không có quyền xem job của phân khu này');
    }
    return toStatus(job);
  }

  public static async getLatestJob(zoneId: string): Promise<MinutesJobStatus | null> {
    const res = await Database.query<JobRow>(
      `SELECT * FROM compiled_report_batches
       WHERE zone_id = $1 AND filter_criteria_json->>'kind' = $2
       ORDER BY created_at DESC LIMIT 1;`,
      [zoneId.trim().toUpperCase(), JOB_KIND]
    );
    return res.rows[0] ? toStatus(res.rows[0]) : null;
  }

  public static async issueDownloadTicket(jobId: string, user: JwtPayload): Promise<string> {
    const job = await this.getJobRow(jobId);
    if (!canAccessZone(user, job.zone_id)) {
      throw new ForbiddenError('Bạn không có quyền tải file của phân khu này');
    }
    if (job.status !== 'COMPLETED' || !job.file_path) {
      throw new ConflictError('File ZIP chưa sẵn sàng hoặc đã hết hạn');
    }
    return jwt.sign({ purpose: 'MINUTES_ZIP', jobId, userId: user.userId }, config.jwt.secret, {
      expiresIn: DOWNLOAD_TICKET_TTL,
    });
  }

  public static async resolveDownload(
    jobId: string,
    ticket: string
  ): Promise<{ filePath: string; fileName: string; userId: string; zoneId: string; sha256: string | null }> {
    let payload: { purpose?: string; jobId?: string; userId?: string };
    try {
      payload = jwt.verify(ticket, config.jwt.secret) as typeof payload;
    } catch (err) {
      console.error('[MinutesExport:Download] Vé tải không hợp lệ:', err);
      throw new UnauthorizedError('Vé tải không hợp lệ hoặc đã hết hạn');
    }
    if (payload.purpose !== 'MINUTES_ZIP' || payload.jobId !== jobId || !payload.userId) {
      throw new UnauthorizedError('Vé tải không hợp lệ');
    }

    const job = await this.getJobRow(jobId);
    if (job.status !== 'COMPLETED' || !job.file_path || !fs.existsSync(job.file_path)) {
      throw new ConflictError('File ZIP chưa sẵn sàng hoặc đã hết hạn');
    }
    return {
      filePath: job.file_path,
      fileName: `${job.zone_id}_Bien_Ban_Hien_Truong.zip`,
      userId: payload.userId,
      zoneId: job.zone_id,
      sha256: job.checksum_sha256,
    };
  }

  /** Job dang dở khi tiến trình dừng không thể chạy tiếp; xóa file ZIP hết hạn nhưng giữ lại bản ghi. */
  public static async recoverOnStartup(): Promise<void> {
    await Database.query(
      `UPDATE compiled_report_batches
       SET status = 'FAILED', current_item = NULL, error_message = 'Máy chủ khởi động lại khi đang xuất, vui lòng xuất lại'
       WHERE status = 'PROCESSING' AND filter_criteria_json->>'kind' = $1;`,
      [JOB_KIND]
    );
    await this.removeStalePartFiles();
    await this.cleanupExpired();
    this.kickWorker();

    const timer = setInterval(() => {
      this.cleanupExpired().catch((err) => console.error('[MinutesExport:Cleanup] Lỗi dọn file hết hạn:', err));
    }, CLEANUP_INTERVAL_MS);
    timer.unref();
  }

  private static async removeStalePartFiles(): Promise<void> {
    const exportDir = getMinutesExportDir();
    if (!fs.existsSync(exportDir)) return;
    const files = await fs.promises.readdir(exportDir);
    for (const file of files.filter((name) => name.endsWith('.part'))) {
      await removeFileQuietly(path.join(exportDir, file));
    }
  }

  public static async cleanupExpired(): Promise<void> {
    const expired = await Database.query<{ id: string; file_path: string | null }>(
      `SELECT id, file_path FROM compiled_report_batches
       WHERE status = 'COMPLETED' AND expires_at < NOW() AND filter_criteria_json->>'kind' = $1;`,
      [JOB_KIND]
    );
    for (const job of expired.rows) {
      if (job.file_path) await removeFileQuietly(job.file_path);
      await Database.query(`UPDATE compiled_report_batches SET status = 'REVOKED', file_path = NULL WHERE id = $1;`, [job.id]);
    }
  }
}
