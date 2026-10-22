import { Database, pool } from '../database/db';
import { ReportSnapshotService } from '../modules/report_v3/report-snapshot.service';

/**
 * Script backfill: Rà soát tất cả các báo cáo APPROVED trong DB,
 * nếu chưa có bản APPROVED_RELEASE hoặc bản snapshot cũ chưa có schemaVersion 2 (frozenParcel),
 * tự động chụp Full Snapshot v2 lưu vào survey_report_versions.
 */
async function backfillFullApprovedSnapshots() {
  console.log('=== [BACKFILL] BẮT ĐẦU RÀ SOÁT & NÂNG CẤP SNAPSHOT CHO TOÀN BỘ HỒ SƠ APPROVED ===');

  const client = await pool.connect();
  try {
    const approvedReports = await client.query<{
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

    console.log(`Tìm thấy ${approvedReports.rows.length} hồ sơ APPROVED cần kiểm tra.`);

    for (const report of approvedReports.rows) {
      console.log(`\n--- Kiểm tra report: ${report.report_code} (${report.id}) ---`);

      // Kiểm tra xem đã có APPROVED_RELEASE chưa
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
      const adminUserRes = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE id = $1 UNION SELECT id FROM users WHERE role IN ('ZONE_ADMIN', 'SUPER_ADMIN') LIMIT 1;`,
        [report.zone_admin_id]
      );
      const adminId = adminUserRes.rows[0]?.id;
      if (!adminId) {
        throw new Error('Không tìm thấy tài khoản ADMIN trong hệ thống để thực hiện backfill.');
      }
      const approvedAt = report.approved_at || new Date();

      if (row && row.snapshot_data?.schemaVersion === 2 && row.snapshot_data?.frozenParcel) {
        console.log(`  [OK] Đã có Full Snapshot v2 (Version ID: ${row.id}, Rev: ${row.snapshot_data.exportRevision}). Bỏ qua.`);
        continue;
      }

      if (row) {
        console.log(`  [UPGRADE] Nâng cấp snapshot v1 (Version ID: ${row.id}) lên Full Snapshot v2...`);
        const fullSnapshot = await ReportSnapshotService.buildSnapshot(
          client,
          report.id,
          adminId,
          approvedAt,
          report.export_revision
        );

        await client.query(
          `UPDATE survey_report_versions
           SET snapshot_data = $1,
               edit_reason = 'Backfill nâng cấp Full Snapshot v2 (bất biến dữ liệu khảo sát và thửa đất)'
           WHERE id = $2;`,
          [JSON.stringify(fullSnapshot), row.id]
        );
        console.log(`  [UPGRADE HOÀN TẤT] Version ${row.id} đã được nâng cấp lên schemaVersion 2.`);
      } else {
        console.log(`  [CREATE] Chưa có APPROVED_RELEASE. Tạo mới Full Snapshot v2...`);
        const result = await ReportSnapshotService.writeApprovedRelease(
          client,
          report.id,
          adminId,
          approvedAt,
          `Khởi tạo snapshot APPROVED_RELEASE (Rev ${String(report.export_revision).padStart(2, '0')})`,
          report.export_revision
        );
        console.log(`  [TẠO MỚI HOÀN TẤT] Tạo thành công Version ID: ${result.versionId}, VerNumber: ${result.versionNumber}, SHA-256: ${result.snapshot.contentSha256}`);
      }
    }

    console.log('\n=== [BACKFILL] HOÀN TẤT THÀNH CÔNG ===');
  } catch (error) {
    console.error('[BACKFILL] LỖI:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

backfillFullApprovedSnapshots().catch((e) => {
  console.error(e);
  process.exit(1);
});
