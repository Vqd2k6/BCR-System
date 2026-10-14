import { AuditService } from '../modules/audit/audit.service';
import { Database } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

async function runTest() {
  console.log('================================================================');
  console.log('🧪 TEST: CONDO SURVEY APPROVAL SYSTEM E2E FLOW');
  console.log('================================================================');

  // 1. Get Admin user
  const adminRes = await Database.query<{ id: string; full_name: string; role: string }>(
    `SELECT id, full_name, role FROM users WHERE role IN ('SUPER_ADMIN', 'ZONE_ADMIN') LIMIT 1;`
  );
  if (adminRes.rows.length === 0) {
    console.log('⚠️ Không tìm thấy Admin user nào trong DB.');
    process.exit(1);
  }
  const adminUser = adminRes.rows[0];
  console.log(`[Setup] Admin user: ${adminUser.full_name} (${adminUser.role}) - ID: ${adminUser.id}`);

  // 2. Create an isolated mock condo parcel for testing
  const testParcelId = uuidv4();
  const testParcelCode = `CONDO_TEST_${Date.now()}`;
  const testZoneId = 'ZONE_01';
  await Database.query(
    `INSERT INTO parcels (id, project_parcel_code, building_type, zone_id, survey_status, is_locked, created_at, updated_at)
     VALUES ($1, $2, 'CONDOMINIUM', $3, 'IN_PROGRESS', FALSE, NOW(), NOW());`,
    [testParcelId, testParcelCode, testZoneId]
  );
  console.log(`[Setup] Created mock condo parcel: ${testParcelCode} (${testParcelId})`);

  try {
    // Setup child units: 1 Master Area (M-01), 1 Normal Unit (U-101), 1 Absentee Unit (U-102)
    const masterAreaUnitId = uuidv4();
    const childUnit1Id = uuidv4();
    const childUnit2Id = uuidv4();

    await Database.query(
      `INSERT INTO building_units (id, parcel_id, unit_code, unit_type, floor_number, owner_name, status, created_at, updated_at)
       VALUES 
       ($1, $4, 'M-01', 'MASTER', 1, 'BQL Toà Nhà', 'SUBMITTED', NOW(), NOW()),
       ($2, $4, 'U-101', 'UNIT', 1, 'Nguyễn Văn A', 'SUBMITTED', NOW(), NOW()),
       ($3, $4, 'U-102', 'UNIT', 1, 'Trần Thị B', 'POSTPONED_ABSENT', NOW(), NOW());`,
      [masterAreaUnitId, childUnit1Id, childUnit2Id, testParcelId]
    );

    // Setup base_survey_reports for each
    const masterReportId = uuidv4();
    const unit1ReportId = uuidv4();
    const absenteeReportId = uuidv4();

    // 1) Master Area Report
    await Database.query(
      `INSERT INTO base_survey_reports (id, parcel_id, unit_id, report_code, report_type, phase, status, surveyor_id, current_step, survey_data_json, created_at, updated_at)
       VALUES ($1, $2, $3, 'REP_M01', 'MASTER_AREA', 'PHASE_1', 'SUBMITTED', $4, 4, '{"burlandDamageCategory": "GRADE_0", "zones": []}', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [masterReportId, testParcelId, masterAreaUnitId, adminUser.id]
    );

    // 2) Child Unit 1 Report (Grade 0, 0 defects -> eligible for safe batch approve)
    await Database.query(
      `INSERT INTO base_survey_reports (id, parcel_id, unit_id, report_code, report_type, phase, status, surveyor_id, current_step, survey_data_json, created_at, updated_at)
       VALUES ($1, $2, $3, 'REP_U101', 'CONDO_UNIT', 'PHASE_1', 'SUBMITTED', $4, 4, '{"burlandDamageCategory": "GRADE_0", "zones": []}', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [unit1ReportId, testParcelId, childUnit1Id, adminUser.id]
    );

    // 3) Absentee Unit Report (SUBMITTED with is_refused_or_absent = true, has absence photos)
    await Database.query(
      `INSERT INTO base_survey_reports (id, parcel_id, unit_id, report_code, report_type, phase, status, is_refused_or_absent, surveyor_id, current_step, survey_data_json, created_at, updated_at)
       VALUES ($1, $2, $3, 'REP_U102', 'CONDO_UNIT', 'PHASE_1', 'SUBMITTED', TRUE, $4, 2, '{"absenceNoticePhotos": [{"url": "https://example.com/door_notice.jpg"}]}', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [absenteeReportId, testParcelId, childUnit2Id, adminUser.id]
    );

    // TEST 1: listPendingSubmissions with filterLevel
    console.log('\n--- TEST 1: listPendingSubmissions với các cấp độ lọc Condo ---');
    const condoUnitFilter = await AuditService.listPendingSubmissions({
      zoneId: testZoneId,
      filterLevel: 'CONDO_UNIT',
    });
    console.log(`[Test 1.1] filterLevel = CONDO_UNIT: tìm thấy ${condoUnitFilter.items.length} hồ sơ`);
    const foundUnit1 = condoUnitFilter.items.find((i: { report_id?: string | null }) => i.report_id === unit1ReportId);
    if (!foundUnit1) {
      throw new Error(`FAIL: Không tìm thấy report U-101 trong filter CONDO_UNIT`);
    }
    console.log('✅ TEST 1.1 PASSED: CONDO_UNIT lọc chính xác hồ sơ căn hộ con.');

    const masterAreaFilter = await AuditService.listPendingSubmissions({
      zoneId: testZoneId,
      filterLevel: 'MASTER_AREA',
    });
    console.log(`[Test 1.2] filterLevel = MASTER_AREA: tìm thấy ${masterAreaFilter.items.length} hồ sơ`);
    const foundMaster = masterAreaFilter.items.find((i: { report_id?: string | null }) => i.report_id === masterReportId);
    if (!foundMaster) {
      throw new Error(`FAIL: Không tìm thấy report M-01 trong filter MASTER_AREA`);
    }
    console.log('✅ TEST 1.2 PASSED: MASTER_AREA lọc chính xác hồ sơ khu dùng chung.');

    const absentFilter = await AuditService.listPendingSubmissions({
      zoneId: testZoneId,
      filterLevel: 'ABSENT',
    });
    console.log(`[Test 1.3] filterLevel = ABSENT: tìm thấy ${absentFilter.items.length} hồ sơ`);
    const foundAbsent = absentFilter.items.find((i: { report_id?: string | null }) => i.report_id === absenteeReportId);
    if (!foundAbsent) {
      throw new Error(`FAIL: Không tìm thấy report U-102 trong filter ABSENT`);
    }
    console.log('✅ TEST 1.3 PASSED: ABSENT lọc chính xác hồ sơ vắng mặt.');

    // TEST 2: getSplitPaneAuditView with Warning Flags
    console.log('\n--- TEST 2: getSplitPaneAuditView & Audit Warning Flags ---');
    const auditView = await AuditService.getSplitPaneAuditView(unit1ReportId);
    if (!auditView.unitInfo || auditView.unitInfo.unit_code !== 'U-101') {
      throw new Error('FAIL: unitInfo không khớp với căn U-101');
    }
    if (!auditView.parentBuildingInfo || auditView.parentBuildingInfo.id !== testParcelId) {
      throw new Error('FAIL: parentBuildingInfo không khớp với parcelId');
    }
    if (!Array.isArray(auditView.auditWarningFlags)) {
      throw new Error('FAIL: auditWarningFlags không phải là mảng');
    }
    console.log(`[Test 2] auditWarningFlags count: ${auditView.auditWarningFlags.length}`);
    console.log('✅ TEST 2 PASSED: getSplitPaneAuditView trả về đầy đủ unitInfo, parentBuildingInfo và cờ cảnh báo.');

    // TEST 3: Single-Attempt Absentee Approval
    console.log('\n--- TEST 3: Phê duyệt hồ sơ vắng mặt (Single-Attempt Absentee Workflow) ---');
    const absenteeResult = await AuditService.approveAbsenteeReport(
      absenteeReportId,
      adminUser.id,
      'Admin xác nhận ảnh dán giấy hẹn và biên bản vắng mặt hợp lệ.'
    );
    if (absenteeResult.status !== 'APPROVED') {
      throw new Error(`FAIL: approveAbsenteeReport status không phải APPROVED (${absenteeResult.status})`);
    }
    // Verify in database: report status is APPROVED, unit status is POSTPONED_ABSENT_VERIFIED
    const absenteeDbCheck = await Database.query<{ r_status: string; u_status: string }>(
      `SELECT r.status AS r_status, u.status AS u_status 
       FROM base_survey_reports r
       JOIN building_units u ON r.unit_id = u.id
       WHERE r.id = $1;`,
      [absenteeReportId]
    );
    if (absenteeDbCheck.rows[0].r_status !== 'APPROVED') {
      throw new Error(`FAIL: Report status phải là APPROVED, thực tế: ${absenteeDbCheck.rows[0].r_status}`);
    }
    if (absenteeDbCheck.rows[0].u_status !== 'POSTPONED_ABSENT_VERIFIED') {
      throw new Error(`FAIL: Unit status phải là POSTPONED_ABSENT_VERIFIED, thực tế: ${absenteeDbCheck.rows[0].u_status}`);
    }
    console.log('✅ TEST 3 PASSED: approveAbsenteeReport chuyển unit sang POSTPONED_ABSENT_VERIFIED thành công.');

    // TEST 4: Safe Batch Approve (Condo Grade 0 only)
    console.log('\n--- TEST 4: Phê duyệt hàng loạt an toàn (Safe Batch Approve) ---');
    const batchResult = await AuditService.batchApproveReports(
      [unit1ReportId],
      adminUser.id,
      'Phê duyệt hàng loạt an toàn cho căn hộ Grade 0 không khuyết tật'
    );
    if (batchResult.approvedCount !== 1) {
      throw new Error(`FAIL: Batch approve thất bại, approvedCount: ${batchResult.approvedCount}`);
    }
    const unit1DbCheck = await Database.query<{ r_status: string; u_status: string }>(
      `SELECT r.status AS r_status, u.status AS u_status 
       FROM base_survey_reports r
       JOIN building_units u ON r.unit_id = u.id
       WHERE r.id = $1;`,
      [unit1ReportId]
    );
    if (unit1DbCheck.rows[0].r_status !== 'APPROVED' || unit1DbCheck.rows[0].u_status !== 'APPROVED') {
      throw new Error('FAIL: Unit 101 chưa được duyệt sang APPROVED');
    }
    console.log('✅ TEST 4 PASSED: Safe Batch Approve thành công cho căn hộ Grade 0.');

    // Approve the Master Area report too so 100% completion can be tested
    await AuditService.batchApproveReports(
      [masterReportId],
      adminUser.id,
      'Phê duyệt khu vực dùng chung M-01'
    );

    // TEST 5: Condo Progress Summary
    console.log('\n--- TEST 5: getCondoProgressSummary (Tiến độ cây phân cấp) ---');
    const progressSummary = await AuditService.getCondoProgressSummary(testParcelId);
    console.log(`[Test 5] Total items: ${progressSummary.stats.totalItems}, Completed: ${progressSummary.stats.completedItems}, Percentage: ${progressSummary.stats.completionRatePercent}%`);
    console.log(`[Test 5] Blocking items count: ${progressSummary.blockingItems.length}`);
    console.log(`[Test 5] isReadyForFinalSeal: ${progressSummary.isReadyForFinalSeal}`);

    if (progressSummary.blockingItems.length > 0) {
      throw new Error(`FAIL: Đáng lẽ phải có 0 blocking items, thực tế: ${progressSummary.blockingItems.length}`);
    }
    if (!progressSummary.isReadyForFinalSeal) {
      throw new Error(`FAIL: isReadyForFinalSeal phải là true khi 100% căn hộ đã duyệt hoặc duyệt vắng mặt`);
    }
    console.log('✅ TEST 5 PASSED: getCondoProgressSummary tính đúng 100% tiến độ và 0 blocking items.');

    // TEST 6: Final Legal Seal
    console.log('\n--- TEST 6: executeFinalSeal (Đóng dấu pháp lý & Khóa bất biến) ---');
    const sealResult = await AuditService.executeFinalSeal(
      testParcelId,
      adminUser.id,
      'Nghiệm thu toàn diện toà nhà chung cư Metro 2 - Đóng dấu pháp lý'
    );
    if (!sealResult.isLocked || !sealResult.sealHash) {
      throw new Error('FAIL: executeFinalSeal không tạo được sealHash hoặc không set isLocked');
    }
    console.log(`[Test 6] Seal Hash (SHA-256): ${sealResult.sealHash}`);

    const parcelDbCheck = await Database.query<{ is_locked: boolean; seal_hash: string; survey_status: string }>(
      `SELECT is_locked, seal_hash, survey_status FROM parcels WHERE id = $1;`,
      [testParcelId]
    );
    if (!parcelDbCheck.rows[0].is_locked) {
      throw new Error('FAIL: Parcel chưa được set is_locked = TRUE');
    }
    if (parcelDbCheck.rows[0].seal_hash !== sealResult.sealHash) {
      throw new Error('FAIL: seal_hash trong DB không khớp với kết quả trả về');
    }
    if (parcelDbCheck.rows[0].survey_status !== 'APPROVED') {
      throw new Error(`FAIL: Parcel survey_status chưa chuyển sang APPROVED, thực tế: ${parcelDbCheck.rows[0].survey_status}`);
    }
    console.log('✅ TEST 6 PASSED: Đóng dấu pháp lý thành công, mã hash SHA-256 và trạng thái khóa đã được ghi nhận.');

    console.log('\n================================================================');
    console.log('🎉 TẤT CẢ 6 TEST CASES CHO CONDO SURVEY APPROVAL SYSTEM ĐỀU THÀNH CÔNG!');
    console.log('================================================================');
  } finally {
    // Cleanup temporary test records if created mock parcel
    if (testParcelCode.startsWith('CONDO_TEST_')) {
      await Database.query(`DELETE FROM parcels WHERE id = $1;`, [testParcelId]);
      console.log(`[Cleanup] Đã dọn dẹp mock parcel: ${testParcelId}`);
    }
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ TEST FAILED WITH ERROR:', err);
    process.exit(1);
  });
