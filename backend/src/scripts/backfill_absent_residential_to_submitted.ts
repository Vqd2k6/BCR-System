/**
 * Đưa hồ sơ nhà dân vắng mặt cũ (kẹt ở DRAFT) vào hàng đợi thẩm định. CHỈ đổi status/submitted_at, không đụng dữ liệu khảo sát.
 *
 *   npx ts-node src/scripts/backfill_absent_residential_to_submitted.ts            # Xem trước
 *   npx ts-node src/scripts/backfill_absent_residential_to_submitted.ts --apply    # Ghi thật
 */
import { Database } from '../database/db';

interface PendingRow {
  id: string;
  report_code: string | null;
  parcel_code: string;
  updated_at: Date;
}

const PENDING_SQL = `
  SELECT r.id, r.report_code, p.project_parcel_code AS parcel_code, r.updated_at
  FROM base_survey_reports r
  JOIN parcels p ON p.id = r.parcel_id
  WHERE r.unit_id IS NULL
    AND r.status = 'DRAFT'
    AND r.deleted_at IS NULL
    AND r.is_refused_or_absent = TRUE
    AND p.survey_status = 'POSTPONED_ABSENT'
    AND (r.survey_data_json->>'surveyCaseType' = 'ABSENTEE' OR r.survey_data_json->>'isAbsenteeSurvey' = 'true')
  ORDER BY r.updated_at;`;

async function main(): Promise<void> {
  const shouldApply = process.argv.includes('--apply');
  const pending = await Database.query<PendingRow>(PENDING_SQL);
  console.log(`[BackfillAbsentResidential] Tìm thấy ${pending.rows.length} hồ sơ:`);
  pending.rows.forEach((row) => console.log(`  - ${row.parcel_code} | ${row.report_code ?? row.id}`));

  if (!shouldApply) {
    console.log('[BackfillAbsentResidential] Chế độ xem trước, chưa ghi gì. Thêm --apply để ghi thật.');
    return;
  }

  await Database.transaction(async (client) => {
    for (const row of pending.rows) {
      // Thời điểm nộp thật là lần KSV ghi nhận vắng cuối cùng, giữ nguyên updated_at để không làm sai hàng đợi SLA
      await client.query(
        `UPDATE base_survey_reports
         SET status = 'SUBMITTED', submitted_at = COALESCE(submitted_at, updated_at)
         WHERE id = $1 AND status = 'DRAFT';`,
        [row.id]
      );
      await client.query(
        `INSERT INTO system_audit_logs (entity_type, entity_id, action, diff_payload) VALUES ($1, $2, $3, $4);`,
        ['BASE_SURVEY_REPORT', row.id, 'BACKFILL_ABSENT_RESIDENTIAL_SUBMITTED', JSON.stringify({ from: 'DRAFT', to: 'SUBMITTED' })]
      );
    }
  });
  console.log(`[BackfillAbsentResidential] Đã chuyển ${pending.rows.length} hồ sơ sang SUBMITTED.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[BackfillAbsentResidential:Main] Backfill thất bại:', err);
    process.exit(1);
  });
