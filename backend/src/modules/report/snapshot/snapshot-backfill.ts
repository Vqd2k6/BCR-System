/**
 * ============================================================================
 * SNAPSHOT AUTO-BACKFILL (SELF-HEALING ON BOOTSTRAP)
 * Tự động kiểm tra và đóng băng Full Snapshot v2 (1:1 nguyên trạng) cho các
 * hồ sơ APPROVED cũ chưa có bản chụp v2. Nếu 100% hồ sơ đã có, thoát ngay (~2ms).
 * ============================================================================
 */

import type { PoolClient } from 'pg';
import { Database } from '../../../database/db';
import { buildApprovedSnapshot } from './snapshot-builder';

export async function writeApprovedReleaseRecord(
  client: PoolClient,
  reportId: string,
  adminId: string,
  approvedAt: Date,
  title: string,
  exportRevision?: number
) {
  const snapshot = await buildApprovedSnapshot(client, reportId, adminId, approvedAt, exportRevision);
  const maxRes = await client.query<{ max_ver: number | null }>(
    `SELECT MAX(version_number) AS max_ver FROM survey_report_versions WHERE report_id = $1;`,
    [reportId]
  );
  const maxVer = maxRes.rows[0]?.max_ver;
  const nextVer = maxVer === null || maxVer === undefined ? 0 : Number(maxVer) + 1;
  const ins = await client.query<{ id: string }>(
    `INSERT INTO survey_report_versions (
       report_id, version_number, version_tag, title, edit_reason, snapshot_data, created_by_user_id
     ) VALUES ($1, $2, 'APPROVED_RELEASE', $3, $4, $5, $6)
     RETURNING id;`,
    [reportId, nextVer, title, 'Chốt snapshot bất biến tại thời điểm APPROVE', JSON.stringify(snapshot), adminId]
  );
  return { versionId: ins.rows[0].id, versionNumber: nextVer, snapshot };
}

export async function runAutoBackfillApprovedSnapshots(): Promise<void> {
  try {
    const checkRes = await Database.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM base_survey_reports r
       WHERE r.status = 'APPROVED' AND r.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM survey_report_versions v
           WHERE v.report_id = r.id
             AND v.version_tag = 'APPROVED_RELEASE'
             AND (v.snapshot_data->>'schemaVersion')::int = 2
             AND v.snapshot_data->'frozenParcel' IS NOT NULL
             AND v.snapshot_data->'frozenReportData' IS NOT NULL
             AND v.snapshot_data->'bra' IS NOT NULL
         );`
    );
    const neededCount = Number(checkRes.rows[0]?.count || 0);
    if (neededCount === 0) {
      return;
    }

    console.log(`🔄 [SNAPSHOT AUTO-HEAL] Phát hiện ${neededCount} hồ sơ APPROVED chưa có Full Snapshot v2. Đang tự động nâng cấp...`);

    const approvedReports = await Database.query<{
      id: string;
      report_code: string;
      approved_at: Date;
      zone_admin_id: string | null;
      export_revision: number;
    }>(
      `SELECT id, report_code, approved_at, zone_admin_id, export_revision
       FROM base_survey_reports
       WHERE status = 'APPROVED' AND deleted_at IS NULL
       ORDER BY approved_at ASC;`
    );

    await Database.transaction(async (client) => {
      for (const report of approvedReports.rows) {
        const existingSnap = await client.query<{
          id: string;
          version_number: number;
          snapshot_data: any;
        }>(
          `SELECT id, version_number, snapshot_data
           FROM survey_report_versions
           WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE'
           ORDER BY version_number DESC
           LIMIT 1;`,
          [report.id]
        );

        const row = existingSnap.rows[0];
        if (
          row &&
          row.snapshot_data?.schemaVersion === 2 &&
          row.snapshot_data?.frozenParcel &&
          row.snapshot_data?.frozenReportData &&
          row.snapshot_data?.bra
        ) {
          continue;
        }

        const adminUserRes = await client.query<{ id: string }>(
          `SELECT id FROM users WHERE id = $1 UNION SELECT id FROM users WHERE role IN ('ZONE_ADMIN', 'SUPER_ADMIN') LIMIT 1;`,
          [report.zone_admin_id]
        );
        const adminId = adminUserRes.rows[0]?.id;
        if (!adminId) continue;
        const approvedAt = report.approved_at || new Date();

        if (row) {
          const fullSnapshot = await buildApprovedSnapshot(
            client,
            report.id,
            adminId,
            approvedAt,
            report.export_revision
          );
          await client.query(
            `UPDATE survey_report_versions
             SET snapshot_data = $1,
                 edit_reason = 'Auto-Heal nâng cấp Full Snapshot v2 (bất biến dữ liệu khảo sát và thửa đất)'
             WHERE id = $2;`,
            [JSON.stringify(fullSnapshot), row.id]
          );
        } else {
          await writeApprovedReleaseRecord(
            client,
            report.id,
            adminId,
            approvedAt,
            `Khởi tạo snapshot APPROVED_RELEASE (Rev ${String(report.export_revision).padStart(2, '0')})`,
            report.export_revision
          );
        }
      }
    });
    console.log(`✅ [SNAPSHOT AUTO-HEAL] Đã tự động nâng cấp hoàn tất ${neededCount} hồ sơ lên Full Snapshot v2.`);
  } catch (err: unknown) {
    console.error('[SNAPSHOT AUTO-HEAL ERROR] Cảnh báo lỗi khi tự động nâng cấp snapshot:', err);
  }
}

