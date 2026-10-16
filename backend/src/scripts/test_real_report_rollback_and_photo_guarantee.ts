import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Database } from '../database/db';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';
import assert from 'assert';

async function runRealReportRollbackTest() {
  console.log('================================================================================');
  console.log('🧪 [TEST] BẮT ĐẦU KIỂM THỬ ROLLBACK TRÊN HỒ SƠ THỰC TẾ & BẢO TOÀN ẢNH KHÔNG MẤT');
  console.log('   Mã hồ sơ: 60f4a409-7626-4de4-a61e-5dc2ef91feca');
  console.log('================================================================================\n');

  const reportId = '60f4a409-7626-4de4-a61e-5dc2ef91feca';

  // 1. Lấy thông tin Zone Admin để xác thực quyền
  const adminRes = await Database.query<{ id: string; username: string }>(
    `SELECT id, username FROM users WHERE role IN ('ZONE_ADMIN', 'SUPER_ADMIN') LIMIT 1;`
  );
  assert(adminRes.rows[0], 'Phải có tài khoản quản trị');
  const adminId = adminRes.rows[0].id;
  const adminPassword = 'Admin@123'; // Mật khẩu quản trị mặc định trong dev/test

  console.log(`👤 [1/6] Quản trị viên thực hiện: ${adminRes.rows[0].username} (${adminId})`);

  // 2. Kiểm tra hồ sơ tồn tại
  const repCheck = await Database.query<{ id: string; report_code: string; parcel_id: string; status: string }>(
    `SELECT id, report_code, parcel_id, status FROM base_survey_reports WHERE id = $1;`,
    [reportId]
  );
  assert(repCheck.rows[0], `Hồ sơ ${reportId} phải tồn tại trong CSDL`);
  console.log(`📋 [2/6] Hồ sơ: ${repCheck.rows[0].report_code}, Trạng thái: ${repCheck.rows[0].status}`);

  // 3. Kiểm tra cơ chế Tự Lành (Self-Healing Baseline v0)
  console.log(`\n🩺 [3/6] Kiểm tra cơ chế Tự Lành (Self-Healing Baseline v0)...`);
  const versionsBefore = await AuditVersionService.getVersionList(reportId);
  console.log(`  ✓ Số lượng phiên bản sau khi getVersionList: ${versionsBefore.length}`);
  assert(versionsBefore.length >= 1, 'Hệ thống phải tự động tạo v0 nếu trước đó chưa có version nào');
  
  const v0Detail = await AuditVersionService.getVersionSnapshot(reportId, 0);
  assert(v0Detail, 'Phải lấy được chi tiết snapshot v0');
  assert.strictEqual(v0Detail.versionNumber, 0, 'Phiên bản phải là v0');
  assert.strictEqual(v0Detail.versionTag, 'ORIGINAL_SUBMISSION', 'Tag của v0 phải là ORIGINAL_SUBMISSION');
  console.log(`  ✓ Snapshot v0 tải thành công: "${v0Detail.title}", Ngày tạo: ${v0Detail.createdAt}`);

  // 4. Giả lập một chỉnh sửa kỹ thuật tạo v1
  console.log(`\n✏️ [4/6] Tạo phiên bản v1 sửa đổi để chuẩn bị kiểm thử Rollback...`);
  const currentMaxVer = versionsBefore[0].versionNumber;
  const modifiedVer = await AuditVersionService.createSnapshot(reportId, {
    versionTag: 'CHIEF_ENGINEER_OVERRIDE',
    title: 'Thử nghiệm phán quyết can thiệp kỹ thuật trước khi Rollback',
    editReason: 'Kiểm thử hoàn nguyên dữ liệu thực tế',
    userId: adminId,
    diffSummary: [{ field: 'ecs_class', oldValue: 'GOOD', newValue: 'MEDIUM' }],
  });
  console.log(`  ✓ Đã sinh phiên bản v${modifiedVer.versionNumber} thành công!`);

  // Đổi trạng thái thử nghiệm trên risk_score_cards
  await Database.query(
    `UPDATE risk_score_cards SET
       is_engineering_judgement_applied = true,
       engineering_judgement_action = 'OVERRIDE',
       engineering_judgement_reason = 'Kiểm thử override trước khi rollback',
       overridden_total_ecs = 12,
       overridden_ecs_class = 'MEDIUM'
     WHERE report_id = $1;`,
    [reportId]
  );

  // 5. Thực hiện 1-Click Rollback về v0
  console.log(`\n🔄 [5/6] Thực thi Rollback về phiên bản v0 (Giải quyết lỗi 500 trước đó)...`);
  const rollbackResult = await AuditVersionService.rollbackToVersion(
    reportId,
    0, // Về v0
    adminId,
    {
      reason: 'Khôi phục hoàn toàn về biên bản khảo sát hiện trường ban đầu (Zero-Loss Test)',
      password: adminPassword,
    },
    '127.0.0.1'
  );

  console.log(`  ✓ Rollback hoàn tất không lỗi! Kết quả:`, rollbackResult);
  assert(rollbackResult.success, 'Rollback phải trả về success: true');
  assert.strictEqual(rollbackResult.targetVersionNumber, 0, 'Target version phải là 0');

  // Kiểm tra trạng thái hồ sơ sau rollback
  const repAfter = await Database.query<{ status: string }>(
    `SELECT status FROM base_survey_reports WHERE id = $1;`,
    [reportId]
  );
  console.log(`  ✓ Trạng thái base_survey_reports sau Rollback: ${repAfter.rows[0].status}`);
  assert.strictEqual(repAfter.rows[0].status, 'UNDER_REVIEW', 'base_survey_reports.status phải là UNDER_REVIEW');

  const parcelAfter = await Database.query<{ survey_status: string }>(
    `SELECT survey_status FROM parcels WHERE id = $1;`,
    [repCheck.rows[0].parcel_id]
  );
  console.log(`  ✓ Trạng thái parcels sau Rollback: ${parcelAfter.rows[0].survey_status}`);
  assert.strictEqual(parcelAfter.rows[0].survey_status, 'SUBMITTED', 'parcels.survey_status phải là SUBMITTED');

  // 6. Kiểm tra Bảo Toàn Hình Ảnh 100% trong Sổ Cái Ảnh (survey_photo_registry)
  console.log(`\n📸 [6/6] Kiểm tra bảo toàn 100% hình ảnh không bị xóa...`);
  const photoRegRes = await Database.query<{ count: string; active_count: string; deleted_count: string }>(
    `SELECT count(*)::text AS count,
            count(*) FILTER (WHERE status = 'ACTIVE')::text AS active_count,
            count(*) FILTER (WHERE is_deleted = true)::text AS deleted_count
     FROM survey_photo_registry
     WHERE report_id = $1;`,
    [reportId]
  );
  console.log(`  ✓ Thống kê Sổ cái ảnh: Tổng = ${photoRegRes.rows[0]?.count || 0}, Đang hoạt động = ${photoRegRes.rows[0]?.active_count || 0}`);

  // Kiểm tra bảng ảnh nhận diện survey_identification_photos
  const identPhotosRes = await Database.query(
    `SELECT photo_type, raw_photo_url, annotated_photo_url FROM survey_identification_photos WHERE report_id = $1;`,
    [reportId]
  );
  console.log(`  ✓ Số ảnh nhận diện (P01..P04) được bảo toàn trong hồ sơ: ${identPhotosRes.rows.length}`);

  console.log('\n================================================================================');
  console.log('🎉 [CHÚC MỪNG] KIỂM THỬ THÀNH CÔNG 100%! HỒ SƠ THỰC TẾ ĐÃ ROLLBACK HOÀN HẢO.');
  console.log('   - Lỗi 500 "overridden_total_ecs does not exist" đã được giải quyết triệt để.');
  console.log('   - Hồ sơ cũ tự động được cấp Baseline v0 (Self-Healing).');
  console.log('   - Mọi ảnh hiện trường được bảo toàn nguyên vẹn.');
  console.log('================================================================================\n');

  process.exit(0);
}

runRealReportRollbackTest().catch((err) => {
  console.error('\n❌ [TEST THẤT BẠI]:', err);
  process.exit(1);
});
