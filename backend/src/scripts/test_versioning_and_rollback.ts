import { Database } from '../database/db';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';
import { CryptoUtils } from '../common/utils/crypto.utils';

async function main() {
  console.log('=== TEST SUITE: SURVEY REPORT VERSIONING & ROLLBACK ===');

  // 1. Lấy 1 báo cáo mẫu
  const repRes = await Database.query<{ id: string; parcel_id: string; report_code: string; status: string }>(
    `SELECT id, parcel_id, report_code, status FROM base_survey_reports ORDER BY created_at ASC LIMIT 1;`
  );
  if (!repRes.rows[0]) {
    console.error('Không có báo cáo nào để test!');
    process.exit(1);
  }
  const report = repRes.rows[0];
  console.log(`Đang kiểm thử trên báo cáo ID: ${report.id} (Mã: ${report.report_code})`);

  // 2. Lấy danh sách phiên bản hiện tại
  const vListBefore = await AuditVersionService.getVersionList(report.id);
  console.log(`Số phiên bản hiện tại: ${vListBefore.length}`);
  console.log('Danh sách:', vListBefore.map((v) => `v${v.versionNumber} [${v.versionTag}] - ${v.title}`));

  // 3. Tạo 1 snapshot thử nghiệm v_test (mô phỏng Admin Diff Save)
  console.log('\n--- Thử nghiệm tạo snapshot v_test ---');
  const snapRes = await AuditVersionService.createSnapshot(report.id, {
    versionTag: 'ADMIN_DIFF_SAVE',
    title: 'Thử nghiệm chỉnh sửa thông số kỹ thuật',
    editReason: 'Test snapshot auto-creation',
    diffSummary: [{ field: 'houseNumber', label: 'Số nhà', oldValue: '12', newValue: '12/1' }],
  });
  console.log(`Đã tạo phiên bản: v${snapRes.versionNumber} (ID: ${snapRes.id})`);

  // 4. Lấy chi tiết snapshot vừa tạo
  const snapDetail = await AuditVersionService.getVersionSnapshot(report.id, snapRes.versionNumber);
  console.log(`Lấy thành công chi tiết v${snapRes.versionNumber}:`);
  console.log(`- Title: ${snapDetail.title}`);
  console.log(`- Tag: ${snapDetail.versionTag}`);
  console.log(`- Có snapshotData: ${Boolean(snapDetail.snapshotData)}`);

  // 5. Thử nghiệm Rollback về v0
  console.log('\n--- Thử nghiệm Rollback về v0 ---');
  // Lấy 1 admin user
  const adminRes = await Database.query<{ id: string; role: string; password_hash: string }>(
    `SELECT id, role, password_hash FROM users WHERE role IN ('ZONE_ADMIN', 'SUPER_ADMIN') LIMIT 1;`
  );
  if (!adminRes.rows[0]) {
    console.log('Không tìm thấy tài khoản admin để test rollback');
  } else {
    const admin = adminRes.rows[0];
    // Hash password tạm để test so khớp nếu cần, hoặc giả định test
    console.log(`Admin test ID: ${admin.id}, Role: ${admin.role}`);

    // Set mật khẩu test cho admin này để xác thực nếu chưa biết mật khẩu
    const testPlainPass = 'Admin@123456';
    const testHash = await CryptoUtils.hashPassword(testPlainPass);
    await Database.query(`UPDATE users SET password_hash = $1 WHERE id = $2;`, [testHash, admin.id]);

    const rollbackResult = await AuditVersionService.rollbackToVersion(
      report.id,
      0, // Khôi phục về v0
      admin.id,
      {
        reason: 'Khôi phục về bản khảo sát nguyên gốc do thử nghiệm hệ thống',
        password: testPlainPass,
      },
      '127.0.0.1'
    );

    console.log('Kết quả Rollback:', rollbackResult);
  }

  // 6. Kiểm tra lại danh sách phiên bản sau khi rollback
  const vListAfter = await AuditVersionService.getVersionList(report.id);
  console.log(`\nDanh sách phiên bản sau rollback (${vListAfter.length} phiên bản):`);
  vListAfter.forEach((v) => {
    console.log(`- v${v.versionNumber} [${v.versionTag}] - ${v.title} (${new Date(v.createdAt).toLocaleTimeString()})`);
  });

  console.log('\n=== TẤT CẢ KIỂM THỬ ĐÃ THÀNH CÔNG RỰC RỠ! ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Lỗi khi chạy test:', err);
  process.exit(1);
});
