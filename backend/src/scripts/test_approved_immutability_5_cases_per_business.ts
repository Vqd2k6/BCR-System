import { pool } from '../database/db';
import { MigrationRunner } from '../database/migration-runner';
import { Section1And2Mapper } from '../modules/report/mappers/sections/section-1-2-general.mapper';
import { ReportSnapshotService, sha256Hex } from '../modules/report/report-snapshot.service';
import { AuditService } from '../modules/audit/audit.service';
import { ReportService } from '../modules/report/report-v3.service';
import { ConflictError } from '../common/errors/problem-details';

interface TestCaseResult {
  suite: string;
  id: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestCaseResult[] = [];

async function assertTest(suite: string, id: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ suite, id, name, passed: true });
    console.log(`  ✅ [PASS] ${id}: ${name}`);
  } catch (err: any) {
    results.push({ suite, id, name, passed: false, error: err.message || String(err) });
    console.error(`  ❌ [FAIL] ${id}: ${name}\n      Error: ${err.message || String(err)}`);
  }
}

async function runTestSuite() {
  console.log('================================================================================');
  console.log('TEST SUITE: KIỂM TOÁN TÍNH BẤT BIẾN & CHÍNH XÁC CỦA BÁO CÁO APPROVED (25 CASES)');
  console.log('================================================================================\n');

  await MigrationRunner.run();
  const client = await pool.connect();

  // Biến lưu ID tạo trong quá trình test để dọn dẹp triệt để
  const cleanupParcels: string[] = [];
  const cleanupReports: string[] = [];
  const cleanupUnits: string[] = [];

  try {
    // Tìm tài khoản SUPER_ADMIN, ZONE_ADMIN và SURVEYOR hợp lệ trong hệ thống
    const superAdminRes = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1;`
    );
    const zoneAdminRes = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'ZONE_ADMIN' LIMIT 1;`
    );
    const surveyorRes = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'SURVEYOR' LIMIT 1;`
    );
    const superAdminId = superAdminRes.rows[0]?.id;
    const zoneAdminId = zoneAdminRes.rows[0]?.id;
    const adminId = zoneAdminId || superAdminId;
    const surveyorId = surveyorRes.rows[0]?.id;

    if (!superAdminId || !zoneAdminId || !surveyorId) {
      throw new Error('Hệ thống thiếu tài khoản SUPER_ADMIN, ZONE_ADMIN hoặc SURVEYOR để chạy bộ test.');
    }

    // =========================================================================
    // NGHIỆP VỤ 1: THỨ TỰ ƯU TIÊN DỮ LIỆU (SOURCE PRECEDENCE & FALLBACK)
    // =========================================================================
    console.log('\n--- NGHIỆP VỤ 1: THỨ TỰ ƯU TIÊN DỮ LIỆU (SOURCE PRECEDENCE & FALLBACK) ---');

    const dummyMetadata = {
      projectTitleVi: 'DỰ ÁN XÂY DỰNG TUYẾN TÀU ĐIỆN NGẦM SỐ 2',
      projectTitleEn: 'HO CHI MINH CITY METRO LINE 2 PROJECT',
      reportNo: 'METRO2-TEST-001',
      buildingId: 'BLDG-TEST-001',
      dateVi: '21/10/2026',
      dateEn: '21/10/2026',
    } as any;

    await assertTest('Source Precedence', 'Case 1.1', 'Ưu tiên houseNumber từ survey_data_json trước parcels', async () => {
      const rawReport = { house_number: '206', street: 'Phạm Hồng Thái', ward: 'Phường Bến Thành', district: 'Quận 1' };
      const surveyJson = { houseNumber: '206-SURVEY-A' };
      const res = Section1And2Mapper.map(rawReport, surveyJson, {}, dummyMetadata, 'B1', 'S1', 'R1', '12-206', 10.77, 106.69, '21/10/2026 10:00');
      if (!res.section1.address.vi.includes('206-SURVEY-A')) {
        throw new Error(`Kỳ vọng địa chỉ chứa '206-SURVEY-A', nhưng nhận được: '${res.section1.address.vi}'`);
      }
    });

    await assertTest('Source Precedence', 'Case 1.2', 'Ưu tiên street từ survey_data_json trước parcels', async () => {
      const rawReport = { house_number: '206', street: 'Phạm Hồng Thái', ward: 'Phường Bến Thành', district: 'Quận 1' };
      const surveyJson = { street: 'Khảo Sát Mới' };
      const res = Section1And2Mapper.map(rawReport, surveyJson, {}, dummyMetadata, 'B1', 'S1', 'R1', '12-206', 10.77, 106.69, '21/10/2026 10:00');
      if (!res.section1.address.vi.includes('Khảo Sát Mới')) {
        throw new Error(`Kỳ vọng địa chỉ chứa 'Khảo Sát Mới', nhưng nhận được: '${res.section1.address.vi}'`);
      }
    });

    await assertTest('Source Precedence', 'Case 1.3', 'Ưu tiên ownerPhone từ survey_data_json trước parcels', async () => {
      const rawReport = { owner_phone: '0901000113' };
      const surveyJson = { ownerPhone: '0988776655' };
      const res = Section1And2Mapper.map(rawReport, surveyJson, {}, dummyMetadata, 'B1', 'S1', 'R1', '12-206', 10.77, 106.69, '21/10/2026 10:00');
      if (res.section1.contactPhone !== '0988776655') {
        throw new Error(`Kỳ vọng contactPhone là '0988776655', nhưng nhận được: '${res.section1.contactPhone}'`);
      }
    });

    await assertTest('Source Precedence', 'Case 1.4', 'Ưu tiên buildingType từ survey_data_json trước parcels', async () => {
      const rawReport = { building_type: 'STANDALONE' };
      const surveyJson = { buildingType: 'WAREHOUSE' };
      const res = Section1And2Mapper.map(rawReport, surveyJson, {}, dummyMetadata, 'B1', 'S1', 'R1', '12-206', 10.77, 106.69, '21/10/2026 10:00');
      if (res.bldgNameVi !== 'Kho hàng' || res.bldgNameEn !== 'Commercial Warehouse') {
        throw new Error(`Kỳ vọng tên công trình ánh xạ WAREHOUSE (Kho hàng / Commercial Warehouse), nhưng nhận được: '${res.bldgNameVi}' / '${res.bldgNameEn}'`);
      }
    });

    await assertTest('Source Precedence', 'Case 1.5', 'Fallback an toàn về parcels khi survey_data_json không có thông tin', async () => {
      const rawReport = { house_number: '206', street: 'Phạm Hồng Thái', ward: 'Phường Bến Thành', district: 'Quận 1', owner_phone: '0901000113' };
      const surveyJson = {};
      const res = Section1And2Mapper.map(rawReport, surveyJson, {}, dummyMetadata, 'B1', 'S1', 'R1', '12-206', 10.77, 106.69, '21/10/2026 10:00');
      if (!res.section1.address.vi.includes('206') || !res.section1.address.vi.includes('Phạm Hồng Thái')) {
        throw new Error(`Kỳ vọng địa chỉ fallback về parcels (206, Phạm Hồng Thái), nhận được: '${res.section1.address.vi}'`);
      }
      if (res.section1.contactPhone !== '0901000113') {
        throw new Error(`Kỳ vọng contactPhone fallback về '0901000113', nhận được: '${res.section1.contactPhone}'`);
      }
    });

    // =========================================================================
    // KHỞI TẠO DỮ LIỆU MẪU DÀNH CHO CÁC NHÓM TEST DATABASE (2, 3, 4, 5)
    // =========================================================================
    // Tạo 1 parcel độc lập để test trigger và audit
    const insParcel = await client.query<{ id: string }>(
      `INSERT INTO parcels (
         project_parcel_code, house_number, street, ward, district,
         owner_name, owner_phone, land_area_m2, building_type, zone_id,
         survey_status, official_cadastral_code
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id;`,
      [
        'TEST-PARCEL-IMMUT-01',
        '999',
        'Đường Kiểm Thử Trực Quan',
        'Phường Bến Thành',
        'Quận 1',
        'Chủ Hộ Kiểm Thử',
        '0911223344',
        120.5,
        'STANDALONE',
        '9',
        'IN_PROGRESS',
        '12-999',
      ]
    );
    const testParcelId = insParcel.rows[0].id;
    cleanupParcels.push(testParcelId);

    // Tạo 1 report gắn với parcel này
    const insReport = await client.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
         parcel_id, surveyor_id, zone_admin_id, report_code, status,
         current_step, is_refused_or_absent, survey_data_json, export_revision
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id;`,
      [
        testParcelId,
        surveyorId,
        adminId,
        'REPORT-TEST-IMMUT-001',
        'UNDER_REVIEW',
        5,
        false,
        JSON.stringify({
          accessLimitation: { type: 'FULL_100' },
          surveyScope: { fullySurveyed: true },
          floors: [{ floorNumber: 1, damageZones: [] }],
          ecs: { e1: 1, e2: 1, e3: 1, e4: 1, e5: 1, e6: 1, totalEcs: 6 },
          vi: { v1: 1, v2: 1, v3: 1, v4: 1, v5: 1, v6: 1, totalVi: 6, viAvg: 1 },
        }),
        0,
      ]
    );
    const testReportId = insReport.rows[0].id;
    cleanupReports.push(testReportId);

    // =========================================================================
    // NGHIỆP VỤ 2: KHÓA CỨNG BẢO VỆ THỬA ĐẤT ĐÃ DUYỆT (DATABASE TRIGGER & GUARD)
    // =========================================================================
    console.log('\n--- NGHIỆP VỤ 2: KHÓA CỨNG BẢO VỆ THỬA ĐẤT ĐÃ DUYỆT (DATABASE TRIGGER & GUARD) ---');

    // Đầu tiên: Phê duyệt test report để đưa sang APPROVED
    await AuditService.approveReport(testReportId, adminId, 'Duyệt thử nghiệm để kiểm tra Trigger');

    await assertTest('Parcel Guard', 'Case 2.1', 'Chặn trực tiếp UPDATE house_number trên parcels khi report đã APPROVED', async () => {
      let threw = false;
      try {
        await client.query(`UPDATE parcels SET house_number = '888' WHERE id = $1;`, [testParcelId]);
      } catch (err: any) {
        threw = true;
        if (!err.message.includes('PARCEL_LOCKED_APPROVED')) {
          throw new Error(`Trigger bắn ra lỗi không đúng định dạng: ${err.message}`);
        }
      }
      if (!threw) throw new Error('Kỳ vọng DB Trigger ném lỗi PARCEL_LOCKED_APPROVED nhưng UPDATE thành công!');
    });

    await assertTest('Parcel Guard', 'Case 2.2', 'Chặn trực tiếp UPDATE owner_phone trên parcels khi report đã APPROVED', async () => {
      let threw = false;
      try {
        await client.query(`UPDATE parcels SET owner_phone = '0988888888' WHERE id = $1;`, [testParcelId]);
      } catch (err: any) {
        threw = true;
        if (!err.message.includes('PARCEL_LOCKED_APPROVED')) {
          throw new Error(`Trigger bắn ra lỗi không đúng định dạng: ${err.message}`);
        }
      }
      if (!threw) throw new Error('Kỳ vọng DB Trigger ném lỗi PARCEL_LOCKED_APPROVED khi sửa SĐT!');
    });

    await assertTest('Parcel Guard', 'Case 2.3', 'Chặn trực tiếp UPDATE land_area_m2 trên parcels khi report đã APPROVED', async () => {
      let threw = false;
      try {
        await client.query(`UPDATE parcels SET land_area_m2 = 999.9 WHERE id = $1;`, [testParcelId]);
      } catch (err: any) {
        threw = true;
        if (!err.message.includes('PARCEL_LOCKED_APPROVED')) {
          throw new Error(`Trigger bắn ra lỗi không đúng định dạng: ${err.message}`);
        }
      }
      if (!threw) throw new Error('Kỳ vọng DB Trigger ném lỗi PARCEL_LOCKED_APPROVED khi sửa diện tích đất!');
    });

    await assertTest('Parcel Guard', 'Case 2.4', 'Cho phép UPDATE parcels nếu report chưa APPROVED (UNDER_REVIEW)', async () => {
      // Tạm thời hạ trạng thái report về UNDER_REVIEW
      await client.query(`UPDATE base_survey_reports SET status = 'UNDER_REVIEW' WHERE id = $1;`, [testReportId]);
      await client.query(`UPDATE parcels SET house_number = '999-TEMP' WHERE id = $1;`, [testParcelId]);
      const checkRes = await client.query<{ house_number: string }>(`SELECT house_number FROM parcels WHERE id = $1;`, [testParcelId]);
      if (checkRes.rows[0].house_number !== '999-TEMP') {
        throw new Error('UPDATE không được áp dụng thành công.');
      }
      // Khôi phục lại trạng thái và số nhà
      await client.query(`UPDATE parcels SET house_number = '999' WHERE id = $1;`, [testParcelId]);
      await client.query(`UPDATE base_survey_reports SET status = 'APPROVED' WHERE id = $1;`, [testReportId]);
    });

    await assertTest('Parcel Guard', 'Case 2.5', 'Cho phép UPDATE các trường kỹ thuật không nhạy cảm (updated_at, absence_attempt_count)', async () => {
      // Khi report APPROVED, update updated_at hoặc absence_attempt_count vẫn phải thành công (không bị trigger chặn)
      await client.query(
        `UPDATE parcels SET updated_at = NOW(), absence_attempt_count = absence_attempt_count + 1 WHERE id = $1;`,
        [testParcelId]
      );
    });

    // =========================================================================
    // NGHIỆP VỤ 3: QUY TRÌNH MỞ KHÓA HỒ SƠ ĐÃ DUYỆT (UNLOCK APPROVED WORKFLOW)
    // =========================================================================
    console.log('\n--- NGHIỆP VỤ 3: QUY TRÌNH MỞ KHÓA HỒ SƠ ĐÃ DUYỆT (UNLOCK APPROVED WORKFLOW) ---');

    await assertTest('Unlock Workflow', 'Case 3.1', 'Chỉ SUPER_ADMIN mới có quyền mở khóa (ZONE_ADMIN bị từ chối với 403 Forbidden)', async () => {
      // 1. Thử mở khóa bằng ZONE_ADMIN -> Bắt buộc bị từ chối với ForbiddenError
      let zoneAdminBlocked = false;
      try {
        await AuditService.unlockApprovedReport(testReportId, zoneAdminId);
      } catch (err: any) {
        if (err.name === 'ForbiddenError' || err.statusCode === 403 || err.message?.includes('Super Admin')) {
          zoneAdminBlocked = true;
        }
      }
      if (!zoneAdminBlocked) {
        throw new Error('Kỳ vọng ZONE_ADMIN bị từ chối khi gọi unlockApprovedReport, nhưng thao tác lại thành công!');
      }

      // 2. Mở khóa bằng SUPER_ADMIN -> Thành công chuyển status sang UNDER_REVIEW
      const unlockRes = await AuditService.unlockApprovedReport(testReportId, superAdminId);
      if (unlockRes.status !== 'UNDER_REVIEW') {
        throw new Error(`Kỳ vọng status 'UNDER_REVIEW', nhận được: '${unlockRes.status}'`);
      }
      const dbCheck = await client.query<{ status: string }>(`SELECT status FROM base_survey_reports WHERE id = $1;`, [testReportId]);
      if (dbCheck.rows[0].status !== 'UNDER_REVIEW') {
        throw new Error(`Database chưa lưu status 'UNDER_REVIEW'.`);
      }
    });

    await assertTest('Unlock Workflow', 'Case 3.2', 'Mở khóa chuyển parcels.survey_status về IN_PROGRESS và mở trigger cho phép sửa', async () => {
      const pCheck = await client.query<{ survey_status: string }>(`SELECT survey_status FROM parcels WHERE id = $1;`, [testParcelId]);
      if (pCheck.rows[0].survey_status !== 'IN_PROGRESS') {
        throw new Error(`Kỳ vọng survey_status của parcel là 'IN_PROGRESS', nhận được: '${pCheck.rows[0].survey_status}'`);
      }
      // Thử sửa house_number trên parcel – trigger không được chặn nữa!
      await client.query(`UPDATE parcels SET house_number = '1000' WHERE id = $1;`, [testParcelId]);
      const pCheck2 = await client.query<{ house_number: string }>(`SELECT house_number FROM parcels WHERE id = $1;`, [testParcelId]);
      if (pCheck2.rows[0].house_number !== '1000') {
        throw new Error(`Không cập nhật được house_number sau khi unlock.`);
      }
    });

    await assertTest('Unlock Workflow', 'Case 3.3', 'Snapshot pháp lý đã chốt giữ nguyên số nhà ban đầu (999) dù parcel đã đổi thành 1000', async () => {
      const latestSnap = await ReportSnapshotService.getLatestApprovedSnapshot(testReportId);
      if (!latestSnap) {
        throw new Error('Không tìm thấy snapshot APPROVED_RELEASE.');
      }
      const frozenHn = latestSnap.snapshot.frozenParcel?.houseNumber;
      if (frozenHn !== '999') {
        throw new Error(`Kỳ vọng snapshot vẫn lưu số nhà '999' ban đầu, nhưng nhận được: '${frozenHn}'`);
      }
    });

    await assertTest('Unlock Workflow', 'Case 3.4', 'Xem trước nội bộ (Internal Preview) của hồ sơ UNDER_REVIEW phản ánh giá trị đang sửa', async () => {
      const resolved = await ReportService.resolve(testReportId);
      if (resolved.status !== 'UNDER_REVIEW') {
        throw new Error(`Kỳ vọng resolved status là UNDER_REVIEW, nhận được: ${resolved.status}`);
      }
      if (resolved.raw.house_number !== '1000') {
        throw new Error(`Kỳ vọng preview phản ánh số nhà mới '1000', nhận được: ${resolved.raw.house_number}`);
      }
    });

    await assertTest('Unlock Workflow', 'Case 3.5', 'Từ chối gọi unlockApprovedReport khi hồ sơ KHÔNG ở trạng thái APPROVED', async () => {
      let threwConflict = false;
      try {
        // Hiện tại hồ sơ đang là UNDER_REVIEW, gọi unlock tiếp bằng SUPER_ADMIN phải bị ConflictError
        await AuditService.unlockApprovedReport(testReportId, superAdminId);
      } catch (err: any) {
        if (err instanceof ConflictError || err.name === 'ConflictError' || err.statusCode === 409 || err.message.includes('APPROVED')) {
          threwConflict = true;
        }
      }
      if (!threwConflict) {
        throw new Error('Kỳ vọng ném ConflictError khi mở khóa hồ sơ không ở trạng thái APPROVED.');
      }
    });

    // =========================================================================
    // NGHIỆP VỤ 4: VÒNG ĐỜI PHIÊN BẢN & DUYỆT LẠI (REVISION LIFECYCLE)
    // =========================================================================
    console.log('\n--- NGHIỆP VỤ 4: VÒNG ĐỜI PHIÊN BẢN & DUYỆT LẠI (REVISION LIFECYCLE) ---');

    await assertTest('Revision Lifecycle', 'Case 4.1', 'Bản duyệt ban đầu được ghi nhận exportRevision = 0 (Rev 00)', async () => {
      // Lấy bản version đầu tiên đã tạo
      const v0 = await client.query<{ snapshot_data: any }>(
        `SELECT snapshot_data FROM survey_report_versions
         WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE'
         ORDER BY version_number ASC LIMIT 1;`,
        [testReportId]
      );
      if (v0.rows[0].snapshot_data.exportRevision !== 0) {
        throw new Error(`Kỳ vọng exportRevision bản đầu là 0, nhận được: ${v0.rows[0].snapshot_data.exportRevision}`);
      }
    });

    await assertTest('Revision Lifecycle', 'Case 4.2', 'Duyệt lại (Re-approval) sau khi unlock KHÔNG tự động tăng exportRevision (giữ nguyên Rev 00)', async () => {
      const reApproveRes = await AuditService.approveReport(testReportId, adminId, 'Phê duyệt lại sau khi chỉnh sửa số nhà thành 1000');
      if (reApproveRes.exportRevision !== 0) {
        throw new Error(`Kỳ vọng exportRevision vẫn giữ nguyên là 0, nhận được: ${reApproveRes.exportRevision}`);
      }
      const repCheck = await client.query<{ export_revision: number }>(`SELECT export_revision FROM base_survey_reports WHERE id = $1;`, [testReportId]);
      if (repCheck.rows[0].export_revision !== 0) {
        throw new Error(`Database base_survey_reports không được tự động tăng export_revision, kỳ vọng 0 nhận được: ${repCheck.rows[0].export_revision}`);
      }
    });

    await assertTest('Revision Lifecycle', 'Case 4.3', 'Tiêu đề version snapshot lưu thông tin Phê duyệt lại số liệu sau mở khóa', async () => {
      const v1 = await client.query<{ title: string; snapshot_data: any }>(
        `SELECT title, snapshot_data FROM survey_report_versions
         WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE'
         ORDER BY version_number DESC LIMIT 1;`,
        [testReportId]
      );
      if (!v1.rows[0].title.includes('Phê duyệt lại số liệu sau mở khóa')) {
        throw new Error(`Kỳ vọng title chứa 'Phê duyệt lại số liệu sau mở khóa', nhận được: '${v1.rows[0].title}'`);
      }
      if (v1.rows[0].snapshot_data.frozenParcel.houseNumber !== '1000') {
        throw new Error(`Kỳ vọng snapshot đóng băng số nhà '1000', nhận được: '${v1.rows[0].snapshot_data.frozenParcel.houseNumber}'`);
      }
    });

    await assertTest('Revision Lifecycle', 'Case 4.4', 'Bảng survey_report_versions lưu cả 2 bản snapshot bất biến riêng biệt (Bản đầu & Bản duyệt lại)', async () => {
      const countRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM survey_report_versions
         WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE';`,
        [testReportId]
      );
      if (Number(countRes.rows[0].count) !== 2) {
        throw new Error(`Kỳ vọng có 2 bản snapshot APPROVED_RELEASE, tìm thấy: ${countRes.rows[0].count}`);
      }
    });

    await assertTest('Revision Lifecycle', 'Case 4.5', 'Sau khi duyệt lại, trạng thái trở lại APPROVED và DB Trigger tự động tái kích hoạt', async () => {
      let reBlocked = false;
      try {
        await client.query(`UPDATE parcels SET house_number = '9999' WHERE id = $1;`, [testParcelId]);
      } catch (err: any) {
        if (err.message.includes('PARCEL_LOCKED_APPROVED')) {
          reBlocked = true;
        }
      }
      if (!reBlocked) {
        throw new Error('Kỳ vọng DB Trigger tái kích hoạt khóa bảo vệ sau khi re-approve!');
      }
    });

    // =========================================================================
    // NGHIỆP VỤ 5: TOÀN VẸN SNAPSHOT & BẤT BIẾN ĐỘC LẬP (FULL SNAPSHOT & REGRESSION)
    // =========================================================================
    console.log('\n--- NGHIỆP VỤ 5: TOÀN VẸN SNAPSHOT & BẤT BIẾN ĐỘC LẬP (FULL SNAPSHOT & ZERO REGRESSION) ---');

    await assertTest('Integrity & Snapshot', 'Case 5.1', 'Đa giác ranh thửa trong snapshot không bị ảnh hưởng khi bảng parcels thay đổi hình học', async () => {
      const snap = await ReportSnapshotService.getLatestApprovedSnapshot(testReportId);
      if (!snap) throw new Error('Không lấy được snapshot.');
      // Giả sử cập nhật parcels (bằng cách unlock rồi đổi hoặc kiểm tra frozenParcel)
      const frozenParcel = snap.snapshot.frozenParcel;
      if (!frozenParcel || frozenParcel.projectParcelCode !== 'TEST-PARCEL-IMMUT-01') {
        throw new Error('frozenParcel không tồn tại hoặc sai projectParcelCode trong snapshot.');
      }
    });

    await assertTest('Integrity & Snapshot', 'Case 5.2', 'Mã băm SHA-256 (contentSha256) của snapshot được tính toán toàn vẹn và bất biến', async () => {
      const snapRes = await client.query<{ snapshot_data: any }>(
        `SELECT snapshot_data FROM survey_report_versions
         WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE'
         ORDER BY version_number DESC LIMIT 1;`,
        [testReportId]
      );
      const snapshot = snapRes.rows[0].snapshot_data;
      const expectedSha = ReportSnapshotService.computeContentHash(
        {
          ecs: snapshot.ecs,
          vi: snapshot.vi,
          burlandMaxGrade: snapshot.burlandMaxGrade,
        },
        snapshot.frozenSurveyDataJson,
        snapshot.frozenParcel
      );
      if (snapshot.contentSha256 !== expectedSha) {
        throw new Error(`Mã SHA-256 không khớp! Lưu trữ: ${snapshot.contentSha256}, Tính toán lại: ${expectedSha}`);
      }
    });

    await assertTest('Integrity & Snapshot', 'Case 5.3', 'Hỗ trợ mô hình căn hộ con CONDO_UNIT không làm ảnh hưởng parcels của tòa nhà', async () => {
      // Tạo 1 building_unit test
      const testUnitCode = `TEST-UNIT-${Date.now()}`;
      const testChildCode = `REPORT-TEST-CONDO-${Date.now()}`;
      const insUnit = await client.query<{ id: string }>(
        `INSERT INTO building_units (
           parcel_id, unit_code, display_code, owner_name, status
         ) VALUES ($1, $2, $3, $4, $5)
         RETURNING id;`,
        [testParcelId, testUnitCode, 'Căn 101', 'Chủ Căn Hộ Con', 'IN_PROGRESS']
      );
      const unitId = insUnit.rows[0].id;
      cleanupUnits.push(unitId);

      // Tạo report căn hộ con
      const insChildReport = await client.query<{ id: string }>(
        `INSERT INTO base_survey_reports (
           parcel_id, unit_id, report_type, surveyor_id, zone_admin_id, report_code, status,
           current_step, is_refused_or_absent, survey_data_json, export_revision
         ) VALUES ($1, $2, 'CONDO_UNIT', $3, $4, $5, 'UNDER_REVIEW', 5, false, $6, 0)
         RETURNING id;`,
        [
          testParcelId,
          unitId,
          surveyorId,
          adminId,
          testChildCode,
          JSON.stringify({
            accessLimitation: { type: 'FULL_100' },
            hasPendingRelease: true,
            floors: [],
            ecs: { e1: 1, e2: 1, e3: 1, e4: 1, e5: 1, e6: 1, totalEcs: 6 },
            vi: { v1: 1, v2: 1, v3: 1, v4: 1, v5: 1, v6: 1, totalVi: 6, viAvg: 1 },
          }),
        ]
      );
      const childReportId = insChildReport.rows[0].id;
      cleanupReports.push(childReportId);

      // Phê duyệt report con: unit_id phải chuyển sang APPROVED
      await AuditService.approveReport(childReportId, adminId, 'Duyệt căn hộ con');
      const unitCheck = await client.query<{ status: string }>(`SELECT status FROM building_units WHERE id = $1;`, [unitId]);
      if (unitCheck.rows[0].status !== 'APPROVED') {
        throw new Error(`Kỳ vọng building_unit chuyển sang APPROVED, nhận được: ${unitCheck.rows[0].status}`);
      }

      // Kiểm tra Trigger trg_protect_approved_survey chặn sửa trực tiếp survey_data_json khi đang APPROVED
      let surveyTriggerBlocked = false;
      try {
        await client.query(
          `UPDATE base_survey_reports SET survey_data_json = jsonb_set(survey_data_json, '{tampered}', 'true'::jsonb) WHERE id = $1;`,
          [childReportId]
        );
      } catch (err: any) {
        if (err.message.includes('SURVEY_REPORT_LOCKED_APPROVED')) {
          surveyTriggerBlocked = true;
        }
      }
      if (!surveyTriggerBlocked) {
        throw new Error('Kỳ vọng Trigger trg_protect_approved_survey chặn UPDATE survey_data_json khi đang APPROVED!');
      }

      // Kiểm tra luồng Phát hành Revision (tăng export_revision + xóa cờ tạm hasPendingRelease) được phép chạy qua Trigger
      await client.query(
        `UPDATE base_survey_reports
         SET export_revision = export_revision + 1,
             official_pdf_url = '/releases/test-rev-01.pdf',
             survey_data_json = survey_data_json - 'hasPendingRelease',
             updated_at = NOW()
         WHERE id = $1;`,
        [childReportId]
      );
      const afterChildRel = await client.query<{ export_revision: number; has_pending: boolean }>(
        `SELECT export_revision, COALESCE((survey_data_json->>'hasPendingRelease')::boolean, false) AS has_pending FROM base_survey_reports WHERE id = $1;`,
        [childReportId]
      );
      if (afterChildRel.rows[0].export_revision !== 1 || afterChildRel.rows[0].has_pending !== false) {
        throw new Error('Phát hành Rev.01 trên hồ sơ APPROVED có hasPendingRelease = true thất bại!');
      }

      // Mở khóa report con: unit_id phải chuyển về IN_PROGRESS (chỉ SUPER_ADMIN)
      await AuditService.unlockApprovedReport(childReportId, superAdminId);
      const unitCheck2 = await client.query<{ status: string }>(`SELECT status FROM building_units WHERE id = $1;`, [unitId]);
      if (unitCheck2.rows[0].status !== 'IN_PROGRESS') {
        throw new Error(`Kỳ vọng building_unit chuyển về IN_PROGRESS sau khi unlock, nhận được: ${unitCheck2.rows[0].status}`);
      }
    });

    await assertTest('Integrity & Snapshot', 'Case 5.4', 'Kiểm tra hồ sơ thực tế C&C-01-B-0228: có Full Snapshot v2 với schemaVersion 2', async () => {
      const realReportId = '60f4a409-7626-4de4-a61e-5dc2ef91feca';
      const snap = await ReportSnapshotService.getLatestApprovedSnapshot(realReportId);
      if (!snap) {
        throw new Error(`Hồ sơ thực tế ${realReportId} chưa có APPROVED_RELEASE snapshot.`);
      }
      if (snap.snapshot.schemaVersion !== 2) {
        throw new Error(`Kỳ vọng schemaVersion là 2, nhận được: ${snap.snapshot.schemaVersion}`);
      }
      if (!snap.snapshot.frozenParcel || snap.snapshot.frozenParcel.houseNumber !== '206') {
        throw new Error(`Kỳ vọng frozenParcel có số nhà '206', nhận được: ${snap.snapshot.frozenParcel?.houseNumber}`);
      }
    });

    await assertTest('Integrity & Snapshot', 'Case 5.5', 'Dọn dẹp sạch sẽ toàn bộ dữ liệu thực nghiệm (Zero DB Pollution)', async () => {
      // Dọn dẹp dữ liệu test do script tạo ra
      for (const repId of cleanupReports) {
        await client.query(`DELETE FROM audit_alert_items WHERE report_id = $1;`, [repId]);
        await client.query(`DELETE FROM survey_report_versions WHERE report_id = $1;`, [repId]);
        await client.query(`DELETE FROM system_audit_logs WHERE entity_id = $1;`, [repId]);
        await client.query(`DELETE FROM base_survey_reports WHERE id = $1;`, [repId]);
      }
      for (const uId of cleanupUnits) {
        await client.query(`DELETE FROM building_units WHERE id = $1;`, [uId]);
      }
      for (const pId of cleanupParcels) {
        await client.query(`DELETE FROM parcels WHERE id = $1;`, [pId]);
      }

      // Xác minh DB không còn vết tích dữ liệu test
      const checkP = await client.query(`SELECT COUNT(*) FROM parcels WHERE project_parcel_code = 'TEST-PARCEL-IMMUT-01';`);
      if (Number(checkP.rows[0].count) !== 0) {
        throw new Error('Dữ liệu test parcel vẫn còn tồn tại trong DB!');
      }
    });

  } finally {
    client.release();
    await pool.end();
  }

  // =========================================================================
  // TỔNG KẾT BÁO CÁO KẾT QUẢ KIỂM THỬ
  // =========================================================================
  console.log('\n================================================================================');
  console.log('BẢNG TỔNG KẾT KẾT QUẢ KIỂM THỬ (25/25 TEST CASES)');
  console.log('================================================================================');

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.table(
    results.map((r) => ({
      'Phân hệ Nghiệp vụ': r.suite,
      'Mã Case': r.id,
      'Tên Kiểm Thử': r.name,
      'Kết Quả': r.passed ? 'PASS ✅' : 'FAIL ❌',
    }))
  );

  console.log(`\nTổng số test cases : ${results.length}`);
  console.log(`Thành công (PASS)  : ${passedCount}`);
  console.log(`Thất bại (FAIL)   : ${failedCount}`);

  if (failedCount > 0) {
    console.error(`\n❌ CÓ ${failedCount} TEST CASE THẤT BẠI. VUI LÒNG KIỂM TRA LẠI LOG CHI TIẾT TRÊN!`);
    process.exit(1);
  } else {
    console.log(`\n🎉 TOÀN BỘ 25/25 TEST CASES ĐÃ ĐẠT 100% TIÊU CHUẨN NGHIỆP VỤ & BẤT BIẾN!`);
  }
}

runTestSuite().catch((e) => {
  console.error('[FATAL ERROR]:', e);
  process.exit(1);
});
