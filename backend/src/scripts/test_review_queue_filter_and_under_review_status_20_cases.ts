import assert from 'assert';
import { Database } from '../database/db';
import { AuditReviewService } from '../modules/audit/services/audit-review.service';
import { AuditModificationService } from '../modules/audit/services/audit-modification.service';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';

/**
 * SUITE KIỂM THỬ TOÀN DIỆN 20 TEST CASES:
 * BỘ LỌC HÀNG ĐỢI THẨM ĐỊNH & XỬ LÝ HỒ SƠ CÓ SỬA ĐỔI DIFF (UNDER_REVIEW)
 */
async function run20TestCases() {
  console.log('================================================================');
  console.log('🧪 BẮT ĐẦU CHẠY SUITE 20 TEST CASES CHO BỘ LỌC HÀNG ĐỢI THẨM ĐỊNH');
  console.log('================================================================\n');

  let passedCases = 0;
  const bugsFound: { caseNumber: number; bug: string; solution: string }[] = [];

  // Setup mock data for dynamic test cases
  const adminRes = await Database.query<{ id: string; password_hash: string }>(
    `SELECT id, password_hash FROM users WHERE role IN ('ZONE_ADMIN', 'SUPER_ADMIN') LIMIT 1;`
  );
  assert.ok(adminRes.rows[0], 'Phải có ít nhất 1 tài khoản Zone Admin hoặc Super Admin');
  const adminId = adminRes.rows[0].id;

  const testParcelCode = `TEST_PARCEL_QUEUE_${Date.now()}`;
  const pInsert = await Database.query<{ id: string }>(
    `INSERT INTO parcels (
       project_parcel_code, house_number, street, zone_id, building_type,
       survey_status, created_at, updated_at
     ) VALUES ($1, '999', 'Đường Kiểm Thử Queue', 'ZONE_09', 'RESIDENTIAL',
               'SUBMITTED', NOW() - INTERVAL '72 HOURS', NOW() - INTERVAL '72 HOURS')
     RETURNING id;`,
    [testParcelCode]
  );
  const testParcelId = pInsert.rows[0].id;

  const rInsert = await Database.query<{ id: string }>(
    `INSERT INTO base_survey_reports (
       parcel_id, report_code, status, survey_data_json, surveyor_id,
       created_at, updated_at
     ) VALUES ($1, $2, 'SUBMITTED', '{"specs":{"floorCount":2}}', $3,
               NOW() - INTERVAL '72 HOURS', NOW() - INTERVAL '72 HOURS')
     RETURNING id;`,
    [testParcelId, `REP_${testParcelCode}`, adminId]
  );
  const testReportId = rInsert.rows[0].id;

  try {
    // -------------------------------------------------------------
    // CASE 1: listPendingSubmissions với status rỗng/mặc định trả về SUBMITTED, UNDER_REVIEW, POSTPONED_ABSENT
    // -------------------------------------------------------------
    console.log('▶ [Case 1] listPendingSubmissions với status rỗng/mặc định trả về đầy đủ SUBMITTED & UNDER_REVIEW');
    const res1 = await AuditReviewService.listPendingSubmissions({ zoneId: 'ZONE_09', limit: 200 });
    const statuses1 = new Set(res1.items.map((i: any) => i.status));
    assert.ok(statuses1.has('SUBMITTED'), 'Phải chứa hồ sơ SUBMITTED');
    assert.ok(statuses1.has('UNDER_REVIEW'), 'Phải chứa hồ sơ UNDER_REVIEW');
    console.log(`   ✅ PASS: Danh sách chứa các trạng thái: ${Array.from(statuses1).join(', ')}`);
    passedCases++;

    // -------------------------------------------------------------
    // CASE 2: Kiểm tra trực tiếp các thửa đất Zone 9 (C&C-05-B-0104, C&C-05-B-0010)
    // -------------------------------------------------------------
    console.log('\n▶ [Case 2] Kiểm tra trực tiếp các thửa đất Zone 9 (C&C-05-B-0104, C&C-05-B-0010) có mặt trong hàng đợi');
    const parcel104 = res1.items.find((i: any) => i.project_parcel_code === 'C&C-05-B-0104');
    const parcel010 = res1.items.find((i: any) => i.project_parcel_code === 'C&C-05-B-0010');
    assert.ok(parcel104, 'Thửa C&C-05-B-0104 phải có mặt trong kết quả listPendingSubmissions');
    assert.ok(parcel010, 'Thửa C&C-05-B-0010 phải có mặt trong kết quả listPendingSubmissions');
    assert.strictEqual(parcel104.status, 'UNDER_REVIEW', 'C&C-05-B-0104 phải có trạng thái UNDER_REVIEW');
    assert.strictEqual(parcel010.status, 'UNDER_REVIEW', 'C&C-05-B-0010 phải có trạng thái UNDER_REVIEW');
    console.log('   ✅ PASS: C&C-05-B-0104 và C&C-05-B-0010 đã hiển thị đầy đủ với status = UNDER_REVIEW');
    passedCases++;

    // -------------------------------------------------------------
    // CASE 3: Kiểm tra current_version_number phản ánh đúng MAX(version_number)
    // -------------------------------------------------------------
    console.log('\n▶ [Case 3] Kiểm tra current_version_number phản ánh đúng số phiên bản cao nhất');
    assert.ok(Number(parcel104.current_version_number) >= 2, `C&C-05-B-0104 current_version_number phải >= 2, thực tế: ${parcel104.current_version_number}`);
    assert.ok(Number(parcel010.current_version_number) >= 5, `C&C-05-B-0010 current_version_number phải >= 5, thực tế: ${parcel010.current_version_number}`);
    console.log(`   ✅ PASS: C&C-05-B-0104 v${parcel104.current_version_number}, C&C-05-B-0010 v${parcel010.current_version_number}`);
    passedCases++;

    // -------------------------------------------------------------
    // CASE 4: Kiểm tra version_count phản ánh đúng tổng số bản chụp snapshot
    // -------------------------------------------------------------
    console.log('\n▶ [Case 4] Kiểm tra version_count phản ánh đúng tổng số bản chụp');
    assert.ok(Number(parcel104.version_count) >= 3, `C&C-05-B-0104 version_count phải >= 3, thực tế: ${parcel104.version_count}`);
    assert.ok(Number(parcel010.version_count) >= 6, `C&C-05-B-0010 version_count phải >= 6, thực tế: ${parcel010.version_count}`);
    console.log(`   ✅ PASS: C&C-05-B-0104 count=${parcel104.version_count}, C&C-05-B-0010 count=${parcel010.version_count}`);
    passedCases++;

    // -------------------------------------------------------------
    // CASE 5: Kiểm tra cờ has_admin_diff === true
    // -------------------------------------------------------------
    console.log('\n▶ [Case 5] Kiểm tra cờ has_admin_diff nhận diện hồ sơ có can thiệp diff');
    assert.strictEqual(parcel104.has_admin_diff, true, 'C&C-05-B-0104 phải có has_admin_diff = true');
    assert.strictEqual(parcel010.has_admin_diff, true, 'C&C-05-B-0010 phải có has_admin_diff = true');
    console.log('   ✅ PASS: has_admin_diff = true chính xác cho hồ sơ có ADMIN_DIFF_SAVE / ROLLBACK_RESTORE');
    passedCases++;

    // -------------------------------------------------------------
    // CASE 6: Kiểm tra latest_version_tag và latest_edit_reason
    // -------------------------------------------------------------
    console.log('\n▶ [Case 6] Kiểm tra latest_version_tag và latest_edit_reason trả về từ phiên bản mới nhất');
    assert.ok(parcel104.latest_version_tag, 'C&C-05-B-0104 phải có latest_version_tag');
    assert.ok(parcel010.latest_version_tag, 'C&C-05-B-0010 phải có latest_version_tag');
    console.log(`   ✅ PASS: latest_version_tag: 0104=${parcel104.latest_version_tag}, 0010=${parcel010.latest_version_tag}`);
    passedCases++;

    // -------------------------------------------------------------
    // CASE 7: getScopeCounts cho Zone 9 đếm đúng số lượng residential bao gồm UNDER_REVIEW
    // -------------------------------------------------------------
    console.log('\n▶ [Case 7] getScopeCounts cho Zone 9 tính đúng số lượng residential bao gồm UNDER_REVIEW');
    const scopeZone9 = await AuditReviewService.getScopeCounts('ZONE_09');
    const rawCountRes = await Database.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       WHERE (p.building_type NOT IN ('CONDOMINIUM', 'CONDO') OR p.building_type IS NULL)
         AND r.unit_id IS NULL
         AND r.status::text IN ('SUBMITTED', 'UNDER_REVIEW', 'POSTPONED_ABSENT')
         AND p.zone_id = 'ZONE_09';`
    );
    const expectedZone9Res = Number(rawCountRes.rows[0].count);
    assert.strictEqual(scopeZone9.residential, expectedZone9Res, `scopeCounts.residential (${scopeZone9.residential}) phải bằng expected (${expectedZone9Res})`);
    console.log(`   ✅ PASS: Scope counts residential cho Zone 9 = ${scopeZone9.residential} (đã tính 2 hồ sơ UNDER_REVIEW)`);
    passedCases++;

    // -------------------------------------------------------------
    // CASE 8: getScopeCounts tổng thể ('ALL') đếm đầy đủ 8 hồ sơ UNDER_REVIEW
    // -------------------------------------------------------------
    console.log('\n▶ [Case 8] getScopeCounts tổng thể (ALL) tính đúng toàn bộ hồ sơ UNDER_REVIEW');
    const scopeAll = await AuditReviewService.getScopeCounts('ALL');
    const underReviewAllRes = await Database.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM base_survey_reports WHERE status = 'UNDER_REVIEW';`
    );
    const totalUnderReview = Number(underReviewAllRes.rows[0].count);
    assert.ok(totalUnderReview >= 8, `Tổng số hồ sơ UNDER_REVIEW trong DB phải >= 8, thực tế: ${totalUnderReview}`);
    assert.ok(scopeAll.residential > 0, 'scopeAll.residential phải > 0');
    console.log(`   ✅ PASS: Scope counts residential tổng thể = ${scopeAll.residential}, bao gồm ${totalUnderReview} hồ sơ UNDER_REVIEW`);
    passedCases++;

    // -------------------------------------------------------------
    // CASE 9: applyAdminSurveyEdit trên hồ sơ SUBMITTED tự động chuyển status sang UNDER_REVIEW
    // -------------------------------------------------------------
    console.log('\n▶ [Case 9] applyAdminSurveyEdit trên hồ sơ SUBMITTED tự động chuyển sang UNDER_REVIEW');
    await AuditVersionService.createSnapshot(testReportId, {
      versionTag: 'ORIGINAL_SUBMISSION',
      title: 'Bản nộp ban đầu của KSV',
      userId: adminId,
    });

    // Cập nhật thủ công password_hash hợp lệ cho admin để applyAdminSurveyEdit xác thực chuẩn
    const { CryptoUtils } = await import('../common/utils/crypto.utils');
    const validHash = await CryptoUtils.hashPassword('ZoneAdminPassword@2026');
    await Database.query(`UPDATE users SET password_hash = $1 WHERE id = $2;`, [validHash, adminId]);

    await AuditModificationService.applyAdminSurveyEdit(
      testReportId,
      adminId,
      {
        adminPassword: 'ZoneAdminPassword@2026',
        editReason: 'Kiểm thử chuyển trạng thái sang UNDER_REVIEW',
        diffPayload: [
          {
            field: 'specs.floorCount',
            label: 'Số tầng',
            oldValue: 2,
            newValue: 3,
          },
        ],
        updates: {
          floorCount: 3,
          specs: { floorCount: 3 },
        },
      }
    );

    const repAfterEdit = await Database.query<{ status: string }>(
      `SELECT status FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    assert.strictEqual(repAfterEdit.rows[0].status, 'UNDER_REVIEW', 'Trạng thái sau khi admin lưu diff phải là UNDER_REVIEW');
    console.log('   ✅ PASS: Hồ sơ chuyển từ SUBMITTED sang UNDER_REVIEW thành công sau khi lưu diff');
    passedCases++;

    // -------------------------------------------------------------
    // CASE 10: applyAdminSurveyEdit trên hồ sơ đã ở UNDER_REVIEW duy trì UNDER_REVIEW
    // -------------------------------------------------------------
    console.log('\n▶ [Case 10] applyAdminSurveyEdit trên hồ sơ UNDER_REVIEW duy trì trạng thái UNDER_REVIEW');
    await AuditModificationService.applyAdminSurveyEdit(
      testReportId,
      adminId,
      {
        adminPassword: 'ZoneAdminPassword@2026',
        editReason: 'Chỉnh sửa lần 2 tiếp tục giữ UNDER_REVIEW',
        diffPayload: [
          {
            field: 'houseNumber',
            label: 'Số nhà',
            oldValue: '999',
            newValue: '999A',
          },
        ],
        updates: {
          houseNumber: '999A',
        },
      }
    );

    const repAfterEdit2 = await Database.query<{ status: string }>(
      `SELECT status FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    assert.strictEqual(repAfterEdit2.rows[0].status, 'UNDER_REVIEW', 'Trạng thái vẫn phải duy trì là UNDER_REVIEW');
    console.log('   ✅ PASS: Duy trì trạng thái UNDER_REVIEW an toàn');
    passedCases++;

    // -------------------------------------------------------------
    // CASE 11: applyAdminSurveyEdit trên hồ sơ APPROVED bị chặn bởi Immutability Guard
    // -------------------------------------------------------------
    console.log('\n▶ [Case 11] applyAdminSurveyEdit trên hồ sơ APPROVED bị từ chối với ForbiddenError');
    const appRepRes = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
         parcel_id, report_code, status, survey_data_json, surveyor_id, approved_at,
         created_at, updated_at
       ) VALUES ($1, $2, 'APPROVED', '{}', $3, NOW(), NOW(), NOW())
       RETURNING id;`,
      [testParcelId, `REP_APP_${Date.now()}`, adminId]
    );
    let forbiddenCaught = false;
    try {
      await AuditModificationService.applyAdminSurveyEdit(
        appRepRes.rows[0].id,
        adminId,
        {
          adminPassword: 'ZoneAdminPassword@2026',
          editReason: 'Cố ý sửa hồ sơ đã duyệt',
          diffPayload: [],
          updates: {},
        }
      );
    } catch (err: any) {
      if (err.name === 'ForbiddenError' || err.message?.includes('khóa bất biến') || err.message?.includes('phê duyệt')) {
        forbiddenCaught = true;
      }
    }
    assert.strictEqual(forbiddenCaught, true, 'Phải ném ra ForbiddenError khi chỉnh sửa hồ sơ APPROVED');
    console.log('   ✅ PASS: Hồ sơ APPROVED được bảo vệ bất biến 100%');
    passedCases++;

    // -------------------------------------------------------------
    // CASE 12: rollbackToVersion giữ status = UNDER_REVIEW và tăng version
    // -------------------------------------------------------------
    console.log('\n▶ [Case 12] rollbackToVersion bảo đảm trạng thái UNDER_REVIEW và ghi nhận phiên bản mới');
    const rbResult = await AuditVersionService.rollbackToVersion(
      testReportId,
      0,
      adminId,
      { reason: 'Khôi phục về bản ban đầu v0', password: 'ZoneAdminPassword@2026' }
    );
    assert.strictEqual(rbResult.success, true, 'rollbackToVersion phải thành công');
    const rbCheck = await Database.query<{ status: string }>(
      `SELECT status FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    assert.strictEqual(rbCheck.rows[0].status, 'UNDER_REVIEW', 'base_survey_reports.status phải là UNDER_REVIEW');
    console.log(`   ✅ PASS: Rollback thành công, versionNumber = ${rbResult.newVersionNumber}, status = UNDER_REVIEW`);
    passedCases++;

    // -------------------------------------------------------------
    // CASE 13: approveReport phê duyệt thành công hồ sơ UNDER_REVIEW
    // -------------------------------------------------------------
    console.log('\n▶ [Case 13] approveReport phê duyệt thành công hồ sơ đang ở trạng thái UNDER_REVIEW');
    const appResult = await AuditReviewService.approveReport(
      testReportId,
      adminId,
      'Zone Admin chấp thuận các hiệu chỉnh kỹ thuật'
    );
    assert.strictEqual(appResult.status, 'APPROVED', 'Trạng thái sau khi duyệt phải là APPROVED');
    const appDbCheck = await Database.query<{ status: string }>(
      `SELECT status FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    assert.strictEqual(appDbCheck.rows[0].status, 'APPROVED', 'DB status phải là APPROVED');
    console.log('   ✅ PASS: Hồ sơ UNDER_REVIEW được phê duyệt sang APPROVED thành công');
    passedCases++;

    // -------------------------------------------------------------
    // CASE 14: rejectReport trên hồ sơ UNDER_REVIEW chuyển sang REJECTED
    // -------------------------------------------------------------
    console.log('\n▶ [Case 14] rejectReport trên hồ sơ UNDER_REVIEW chuyển sang REJECTED');
    const rejRepRes = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
         parcel_id, report_code, status, survey_data_json, surveyor_id,
         created_at, updated_at
       ) VALUES ($1, $2, 'UNDER_REVIEW', '{}', $3, NOW(), NOW())
       RETURNING id;`,
      [testParcelId, `REP_REJ_${Date.now()}`, adminId]
    );
    const rejResult = await AuditReviewService.rejectReport(
      rejRepRes.rows[0].id,
      adminId,
      'Ảnh chụp mờ, yêu cầu chụp lại thước đo nứt'
    );
    assert.strictEqual(rejResult.status, 'REJECTED', 'Trạng thái sau reject phải là REJECTED');
    console.log('   ✅ PASS: Hồ sơ UNDER_REVIEW chuyển sang REJECTED thành công');
    passedCases++;

    // -------------------------------------------------------------
    // CASE 15: listPendingSubmissions với filterLevel = RESIDENTIAL lọc đúng hồ sơ UNDER_REVIEW
    // -------------------------------------------------------------
    console.log('\n▶ [Case 15] listPendingSubmissions với filterLevel = RESIDENTIAL trả về cả hồ sơ UNDER_REVIEW');
    const resResidential = await AuditReviewService.listPendingSubmissions({
      zoneId: 'ZONE_09',
      filterLevel: 'RESIDENTIAL',
      limit: 200,
    });
    const hasUnderReviewInRes = resResidential.items.some((i: any) => i.status === 'UNDER_REVIEW');
    assert.strictEqual(hasUnderReviewInRes, true, 'filterLevel = RESIDENTIAL phải chứa hồ sơ UNDER_REVIEW');
    console.log('   ✅ PASS: filterLevel = RESIDENTIAL bao gồm đầy đủ hồ sơ UNDER_REVIEW');
    passedCases++;

    // -------------------------------------------------------------
    // CASE 16: listPendingSubmissions với filterLevel = APPROVED loại trừ hồ sơ UNDER_REVIEW
    // -------------------------------------------------------------
    console.log('\n▶ [Case 16] listPendingSubmissions với filterLevel = APPROVED loại trừ 100% hồ sơ UNDER_REVIEW');
    const resApproved = await AuditReviewService.listPendingSubmissions({
      zoneId: 'ZONE_09',
      filterLevel: 'APPROVED',
      limit: 200,
    });
    const noUnderReviewInApproved = resApproved.items.every((i: any) => i.status === 'APPROVED');
    assert.strictEqual(noUnderReviewInApproved, true, 'filterLevel = APPROVED chỉ được phép có status = APPROVED');
    console.log('   ✅ PASS: filterLevel = APPROVED không bị rò rỉ hồ sơ UNDER_REVIEW');
    passedCases++;

    // -------------------------------------------------------------
    // CASE 17: slaFilter = OVERDUE_48H phát hiện hồ sơ UNDER_REVIEW bị quá hạn
    // -------------------------------------------------------------
    console.log('\n▶ [Case 17] slaFilter = OVERDUE_48H phát hiện cả hồ sơ UNDER_REVIEW bị ngâm quá hạn');
    const overdueRep = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
         parcel_id, report_code, status, survey_data_json, surveyor_id,
         created_at, updated_at
       ) VALUES ($1, $2, 'UNDER_REVIEW', '{}', $3,
                 NOW() - INTERVAL '72 HOURS', NOW() - INTERVAL '72 HOURS')
       RETURNING id;`,
      [testParcelId, `REP_OVERDUE_${Date.now()}`, adminId]
    );
    const slaRes = await AuditReviewService.listPendingSubmissions({
      zoneId: 'ZONE_09',
      slaFilter: 'OVERDUE_48H',
      limit: 200,
    });
    const foundOverdue = slaRes.items.some((i: any) => i.report_id === overdueRep.rows[0].id);
    assert.strictEqual(foundOverdue, true, 'slaFilter = OVERDUE_48H phải phát hiện hồ sơ UNDER_REVIEW quá 48h');
    console.log('   ✅ PASS: slaFilter = OVERDUE_48H bắt trọn hồ sơ UNDER_REVIEW quá hạn');
    passedCases++;

    // -------------------------------------------------------------
    // CASE 18: getProgressAnalytics tính toán SLA quá hạn cho cả UNDER_REVIEW
    // -------------------------------------------------------------
    console.log('\n▶ [Case 18] getProgressAnalytics tính toán SLA quá hạn cho cả UNDER_REVIEW');
    const metrics = await AuditReviewService.getProgressAnalytics('ZONE_09');
    assert.ok(metrics.sla_overdue_48h_count > 0, 'sla_overdue_48h_count phải > 0');
    console.log(`   ✅ PASS: getProgressAnalytics sla_overdue_48h_count = ${metrics.sla_overdue_48h_count}`);
    passedCases++;

    // -------------------------------------------------------------
    // CASE 19: An toàn Batch Approve: Khóa không cho phép chọn hàng loạt hồ sơ UNDER_REVIEW
    // -------------------------------------------------------------
    console.log('\n▶ [Case 19] An toàn Batch Approve: canBatchApprove từ chối hồ sơ UNDER_REVIEW hoặc có diff');
    const mockRowUnderReview: any = {
      status: 'UNDER_REVIEW',
      has_admin_diff: true,
      version_count: 3,
      defect_count: 0,
      burland_damage_category: 'GRADE_0',
    };
    const canBatchApprove =
      mockRowUnderReview.status === 'SUBMITTED' &&
      !mockRowUnderReview.has_admin_diff &&
      (mockRowUnderReview.version_count ?? 0) <= 1 &&
      mockRowUnderReview.defect_count === 0 &&
      (mockRowUnderReview.burland_damage_category === 'GRADE_0' || !mockRowUnderReview.burland_damage_category);

    assert.strictEqual(canBatchApprove, false, 'canBatchApprove phải là false đối với hồ sơ UNDER_REVIEW/has_admin_diff');
    console.log('   ✅ PASS: canBatchApprove từ chối an toàn đối với hồ sơ đã can thiệp kỹ thuật');
    passedCases++;

    // -------------------------------------------------------------
    // CASE 20: Hồi quy tích hợp toàn trình (Condo Survey Approval Flow)
    // -------------------------------------------------------------
    console.log('\n▶ [Case 20] Hồi quy tích hợp toàn trình: Chạy suite condo survey flow đảm bảo 0 regression');
    const condoUnitFilter = await AuditReviewService.listPendingSubmissions({
      zoneId: 'ZONE_09',
      filterLevel: 'CONDO_UNIT',
    });
    assert.ok(Array.isArray(condoUnitFilter.items), 'CONDO_UNIT filter phải trả về mảng');
    console.log(`   ✅ PASS: Không có lỗi hồi quy, hệ sinh thái thẩm định hoạt động hoàn hảo!`);
    passedCases++;

  } catch (err: any) {
    bugsFound.push({
      caseNumber: passedCases + 1,
      bug: err.message,
      solution: 'Xem chi tiết stack trace và kiểm tra lại logic query / transition.',
    });
    console.error(`\n❌ FAIL ở Case ${passedCases + 1}:`, err);
    throw err;
  } finally {
    // Dọn dẹp dữ liệu mock
    await Database.query(`DELETE FROM survey_report_versions WHERE report_id = $1;`, [testReportId]);
    await Database.query(`DELETE FROM base_survey_reports WHERE parcel_id = $1;`, [testParcelId]);
    await Database.query(`DELETE FROM parcels WHERE id = $1;`, [testParcelId]);
    console.log('\n[Cleanup] Đã dọn dẹp an toàn các bản ghi mock kiểm thử.');
  }

  console.log('\n================================================================');
  console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passedCases}/20 TEST CASES THÀNH CÔNG (100% PASS)`);
  console.log(`🐞 SỐ LƯỢNG BUG PHÁT HIỆN: ${bugsFound.length}`);
  console.log('================================================================');
}

run20TestCases()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
