import { Database } from '../database/db';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';

async function main() {
  console.log('🚀 [BACKFILL] Bắt đầu khởi tạo phiên bản v0 (Baseline Snapshots) cho các hồ sơ khảo sát...');

  try {
    const res = await Database.query<{ id: string; report_code: string; surveyor_id: string; status: string }>(
      `SELECT r.id, r.report_code, r.surveyor_id, r.status
       FROM base_survey_reports r
       WHERE NOT EXISTS (
         SELECT 1 FROM survey_report_versions v WHERE v.report_id = r.id
       )
       ORDER BY r.created_at ASC;`
    );

    console.log(`📦 [BACKFILL] Tìm thấy ${res.rows.length} hồ sơ chưa có phiên bản v0.`);

    let successCount = 0;
    let errorCount = 0;

    for (const report of res.rows) {
      try {
        const snapRes = await AuditVersionService.createSnapshot(report.id, {
          versionTag: 'ORIGINAL_SUBMISSION',
          title: 'Bản nộp thực địa ban đầu',
          editReason: 'Khởi tạo phiên bản cơ sở ban đầu (Baseline v0)',
          userId: report.surveyor_id,
        });

        console.log(`  ✓ Đã tạo v${snapRes.versionNumber} cho hồ sơ [${report.report_code}] (${report.id})`);
        successCount++;
      } catch (err: any) {
        console.error(`  ✗ Thất bại khi tạo snapshot cho hồ sơ [${report.report_code}]:`, err?.message);
        errorCount++;
      }
    }

    console.log(`\n🎉 [BACKFILL HOÀN TẤT] Thành công: ${successCount}, Lỗi: ${errorCount}`);

    // Kiểm tra dung lượng bảng sau khi backfill
    const sizeRes = await Database.query<{ total_size: string; row_count: string }>(
      `SELECT pg_size_pretty(pg_total_relation_size('survey_report_versions')) AS total_size,
              COUNT(*)::text AS row_count
       FROM survey_report_versions;`
    );
    console.log(`📊 [STORAGE METRICS] Tổng số bản ghi Version: ${sizeRes.rows[0]?.row_count} | Tổng dung lượng ổ cứng: ${sizeRes.rows[0]?.total_size}`);

    process.exit(0);
  } catch (e: any) {
    console.error('💥 [BACKFILL ERROR]:', e);
    process.exit(1);
  }
}

main();
