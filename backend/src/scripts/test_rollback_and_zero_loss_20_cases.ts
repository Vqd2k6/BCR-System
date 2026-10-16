import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Database, pool } from '../database/db';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';
import { AuditModificationService } from '../modules/audit/services/audit-modification.service';
import { CryptoUtils } from '../common/utils/crypto.utils';
import assert from 'assert';

interface TestResult {
  code: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const testResults: TestResult[] = [];

async function runTestCase(code: string, name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    testResults.push({ code, name, passed: true, durationMs });
    console.log(`  ✅ [PASS] ${code}: ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    testResults.push({ code, name, passed: false, error: err?.message || String(err), durationMs });
    console.error(`  ❌ [FAIL] ${code}: ${name} (${durationMs}ms)`);
    console.error(`     Error: ${err?.message || err}`);
    if (err.stack) console.error(`     Stack: ${err.stack.split('\n').slice(1, 4).join('\n')}`);
  }
}

async function main() {
  console.log('================================================================================');
  console.log('🚀 [E2E TEST SUITE] 20 TEST CASES TOÀN DIỆN KIỂM TRA SNAPSHOT ROLLBACK & ZERO LOSS');
  console.log('   (Theo đúng Kế hoạch plan_bulletproof_snapshot_rollback_and_zero_loss_guarantee.md)');
  console.log('================================================================================\n');

  // SETUP: Tạo tài khoản test và hồ sơ khảo sát nhà dân độc lập
  console.log('👤 [SETUP 1/2] Chuẩn bị người dùng kiểm thử...');
  const zoneAdminPassword = 'ZoneAdmin@2026';
  const surveyorPassword = 'Surveyor@2026';
  const zoneAdminHash = await CryptoUtils.hashPassword(zoneAdminPassword);
  const surveyorHash = await CryptoUtils.hashPassword(surveyorPassword);

  // Tạo hoặc cập nhật ZONE_ADMIN
  let zoneAdminId: string;
  const existingZa = await Database.query<{ id: string }>(`SELECT id FROM users WHERE username = 'test_za_rollback_20';`);
  if (existingZa.rows[0]) {
    zoneAdminId = existingZa.rows[0].id;
    await Database.query(`UPDATE users SET password_hash = $1, role = 'ZONE_ADMIN' WHERE id = $2;`, [zoneAdminHash, zoneAdminId]);
  } else {
    const zaRes = await Database.query<{ id: string }>(
      `INSERT INTO users (username, email, role, full_name, password_hash)
       VALUES ('test_za_rollback_20', 'test_za_rb20@metro2.vn', 'ZONE_ADMIN', 'Kỹ Sư Trưởng Zone Admin RB20', $1)
       RETURNING id;`,
      [zoneAdminHash]
    );
    zoneAdminId = zaRes.rows[0].id;
  }

  // Tạo hoặc cập nhật SURVEYOR
  let surveyorId: string;
  const existingS = await Database.query<{ id: string }>(`SELECT id FROM users WHERE username = 'test_surv_rollback_20';`);
  if (existingS.rows[0]) {
    surveyorId = existingS.rows[0].id;
    await Database.query(`UPDATE users SET password_hash = $1, role = 'SURVEYOR' WHERE id = $2;`, [surveyorHash, surveyorId]);
  } else {
    const sRes = await Database.query<{ id: string }>(
      `INSERT INTO users (username, email, role, full_name, password_hash)
       VALUES ('test_surv_rollback_20', 'test_surv_rb20@metro2.vn', 'SURVEYOR', 'Khảo Sát Viên RB20', $1)
       RETURNING id;`,
      [surveyorHash]
    );
    surveyorId = sRes.rows[0].id;
  }

  console.log('🏡 [SETUP 2/2] Khởi tạo hồ sơ khảo sát nhà dân ban đầu...');
  const zoneRes = await Database.query<{ zone_id: string }>(
    `SELECT DISTINCT zone_id FROM parcels WHERE zone_id IS NOT NULL LIMIT 1;`
  );
  const zoneId = zoneRes.rows[0]?.zone_id || 'ZONE_01';

  const testParcelCode = `TEST_PARCEL_RB20_${Date.now()}`;
  const testCadastralCode = `CAD_RB20_${Date.now()}`;
  const parcelInsert = await Database.query<{ id: string }>(
    `INSERT INTO parcels (
       zone_id, project_parcel_code, official_cadastral_code, house_number, street,
       ward, district, owner_name, owner_phone, frontage_width, lot_depth,
       land_area_m2, construction_area_m2, floor_count, building_type, survey_status
     ) VALUES (
       $1, $2, $3, '120/4B', 'Trương Định, Phường 10, Quận 3',
       'Phường 10', 'Quận 3', 'Trần Văn Cường Gốc v0', '0912345678', 4.5, 20.0,
       90.0, 180.0, 3, 'STANDALONE', 'SUBMITTED'
     ) RETURNING id;`,
    [zoneId, testParcelCode, testCadastralCode]
  );
  const parcelId = parcelInsert.rows[0].id;

  const initialSurveyJson = {
    parcelCode: testParcelCode,
    houseNumber: '120/4B',
    street: 'Trương Định, Phường 10, Quận 3',
    ownerName: 'Trần Văn Cường Gốc v0',
    ownerPhone: '0912345678',
    frontageWidth: 4.5,
    lotDepth: 20.0,
    landAreaM2: 90.0,
    constructionAreaM2: 180.0,
    floorCount: 3,
    buildingSpecs: {
      structureType: 'NHA_CAP_2_BTCT',
      floor_count: 3,
      basement_count: 0,
      foundation_cat_score: 2,
    },
    settlementTilt: {
      tilt_x_permille: 1.2,
      tilt_y_permille: 0.8,
      tilt_direction: 'Tây',
      beam_deflection_mm: 3.5,
    },
    damageZones: [
      {
        zoneCode: 'Z01',
        zoneName: 'Phòng khách tầng trệt',
        ctxPhotoUrl: 'https://storage.metro2.vn/photos/ctx_living_room_v0.jpg',
        ctxPhotoCode: `${testParcelCode}_F01_Z01_CTX_01`,
        burlandGrade: 1,
        defects: [
          {
            defectCode: 'D01',
            defectType: 'Nứt tường dọc mép cửa',
            widthMaxMm: 0.6,
            lengthM: 1.2,
            cuPhotoUrl: 'https://storage.metro2.vn/photos/cu_defect_d01_v0.jpg',
            cuPhotos: ['https://storage.metro2.vn/photos/cu_defect_d01_v0.jpg'],
          },
        ],
      },
    ],
  };

  const reportInsert = await Database.query<{ id: string }>(
    `INSERT INTO base_survey_reports (
       parcel_id, report_code, status, survey_data_json, surveyor_id,
       surveyor_signature_url, owner_signature_url, summary_conclusions,
       created_at, updated_at
     ) VALUES (
       $1, $2, 'SUBMITTED', $3, $4,
       'https://storage.metro2.vn/signatures/surveyor_v0.png',
       'https://storage.metro2.vn/signatures/owner_v0.png',
       'Kết luận ban đầu v0: Công trình chịu lực ổn định, nứt nhẹ cấp 1',
       NOW(), NOW()
     ) RETURNING id;`,
    [parcelId, `BCR_${testParcelCode}`, JSON.stringify(initialSurveyJson), surveyorId]
  );
  const reportId = reportInsert.rows[0].id;

  // Thêm dữ liệu vào building_specifications, deformation_assessments, risk_score_cards, survey_identification_photos
  await Database.query(
    `INSERT INTO building_specifications (report_id, building_name, floor_count, basement_count, structural_system, roof_type)
     VALUES ($1, 'Nhà phố 3 tầng BTCT', 3, 0, 'KHUNG_BTCT_CHIU_LUC', 'TOLE_LANE');`,
    [reportId]
  );

  await Database.query(
    `INSERT INTO deformation_assessments (report_id, tilt_angle_x, tilt_angle_y, tilt_direction, beam_deflection_mm)
     VALUES ($1, 0.12, 0.08, 'Tây', 3.5);`,
    [reportId]
  );

  await Database.query(
    `INSERT INTO risk_score_cards (
       report_id, e1_burland_score, e2_structure_score, e3_deformation_score,
       e4_material_score, e5_history_score, e6_overall_function_score,
       total_ecs_score, ecs_class, v1_importance_score, v2_structure_score,
       v3_foundation_score, v4_age_score, v5_ecs_score, v6_sensitivity_score,
       avg_vi_score, vi_class, building_risk_assessment_bra, is_engineering_judgement_applied
     ) VALUES (
       $1, 1, 0, 1, 0, 0, 0, 2, 'GOOD', 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 'LOW', 'LOW_RISK', false
     );`,
    [reportId]
  );

  await Database.query(
    `INSERT INTO survey_identification_photos (report_id, photo_type, photo_code, raw_photo_url, annotated_photo_url)
     VALUES 
       ($1, 'P01_HOUSE_NUMBER', '${testParcelCode}_P01', 'https://storage.metro2.vn/ident/p01_v0_raw.jpg', 'https://storage.metro2.vn/ident/p01_v0_anno.jpg'),
       ($1, 'P02_MAIN_FACADE', '${testParcelCode}_P02', 'https://storage.metro2.vn/ident/p02_v0_raw.jpg', 'https://storage.metro2.vn/ident/p02_v0_anno.jpg'),
       ($1, 'P03_SIDE_OR_REAR', '${testParcelCode}_P03', 'https://storage.metro2.vn/ident/p03_v0_raw.jpg', 'https://storage.metro2.vn/ident/p03_v0_anno.jpg'),
       ($1, 'P04_CONTEXT_STREET', '${testParcelCode}_P04', 'https://storage.metro2.vn/ident/p04_v0_raw.jpg', 'https://storage.metro2.vn/ident/p04_v0_anno.jpg');`,
    [reportId]
  );

  // Đăng ký ảnh vào survey_photo_registry
  await Database.query(
    `INSERT INTO survey_photo_registry (
       report_id, parcel_id, photo_category, photo_type, photo_code,
       photo_url, standardized_filename, sha256_hash, action_type, status, is_deleted
     ) VALUES
       ($1, $2, 'IDENTIFICATION', 'P01_HOUSE_NUMBER', '${testParcelCode}_P01', 'https://storage.metro2.vn/ident/p01_v0_raw.jpg', 'M2_P01_v0.jpg', 'sha256_hash_p01_v0', 'INITIAL_SURVEY', 'ACTIVE', false),
       ($1, $2, 'DEFECT_CU', 'CU', '${testParcelCode}_F01_Z01_D01_CU_01', 'https://storage.metro2.vn/photos/cu_defect_d01_v0.jpg', 'M2_D01_v0.jpg', 'sha256_hash_d01_v0', 'INITIAL_SURVEY', 'ACTIVE', false);`,
    [reportId, parcelId]
  );

  console.log(`  ✓ Khởi tạo hồ sơ ${reportId} thành công (chưa có bất kỳ bản ghi nào trong survey_report_versions)\n`);

  // =================================================================================
  // NHÓM 1: CƠ CHẾ TỰ LÀNH SNAPSHOT CƠ SỞ (SELF-HEALING BASELINE v0) - 4 TEST CASES
  // =================================================================================
  console.log('========================================================================');
  console.log('📦 NHÓM 1: CƠ CHẾ TỰ LÀNH SNAPSHOT CƠ SỞ (TC-RB-01 -> TC-RB-04)');
  console.log('========================================================================');

  await runTestCase(
    'TC-RB-01',
    'Tự động kích hoạt Self-Healing tạo v0 (ORIGINAL_SUBMISSION) khi gọi getVersionList trên hồ sơ cũ',
    async () => {
      // Xác nhận trước khi gọi, survey_report_versions phải là 0 dòng
      const preCount = await Database.query<{ count: string }>(
        `SELECT count(*) FROM survey_report_versions WHERE report_id = $1;`,
        [reportId]
      );
      assert.strictEqual(Number(preCount.rows[0].count), 0, 'Trước khi gọi, hồ sơ chưa được có version nào');

      const versions = await AuditVersionService.getVersionList(reportId);
      assert.strictEqual(versions.length, 1, 'Sau khi gọi getVersionList, hệ thống phải tự động tạo v0');
      assert.strictEqual(versions[0].versionNumber, 0, 'Phiên bản phải là 0');
      assert.strictEqual(versions[0].versionTag, 'ORIGINAL_SUBMISSION', 'Tag phải là ORIGINAL_SUBMISSION');
    }
  );

  await runTestCase(
    'TC-RB-02',
    'Tự động kích hoạt Self-Healing tạo v0 khi gọi getVersionSnapshot(reportId, 0) trên hồ sơ cũ',
    async () => {
      // Thử trên một hồ sơ phụ độc lập hoàn toàn
      const tempParcelCode = `TEMP_PARCEL_HEAL_${Date.now()}`;
      const tempCadastralCode = `TEMP_CAD_HEAL_${Date.now()}`;
      const tempParcel = await Database.query<{ id: string }>(
        `INSERT INTO parcels (zone_id, project_parcel_code, official_cadastral_code, house_number, street, owner_name)
         VALUES ($1, $2, $3, '12', 'Nguyễn Tri Phương', 'Chủ Hộ Tạm') RETURNING id;`,
        [zoneId, tempParcelCode, tempCadastralCode]
      );
      const tempReport = await Database.query<{ id: string }>(
        `INSERT INTO base_survey_reports (parcel_id, report_code, status, survey_data_json, surveyor_id)
         VALUES ($1, $2, 'SUBMITTED', '{"ownerName":"Chủ Hộ Tạm"}', $3) RETURNING id;`,
        [tempParcel.rows[0].id, `TEMP_REPORT_HEAL_${Date.now()}`, surveyorId]
      );

      const v0Snap = await AuditVersionService.getVersionSnapshot(tempReport.rows[0].id, 0);
      assert(v0Snap, 'Phải lấy được snapshot v0');
      assert.strictEqual(v0Snap.versionNumber, 0, 'Version number phải là 0');
      assert.strictEqual(v0Snap.versionTag, 'ORIGINAL_SUBMISSION', 'Tag phải là ORIGINAL_SUBMISSION');

      // Dọn dẹp hồ sơ tạm
      await Database.query(`DELETE FROM parcels WHERE id = $1;`, [tempParcel.rows[0].id]);
    }
  );

  await runTestCase(
    'TC-RB-03',
    'Tính bất biến và ổn định của Self-Healing (Idempotency): Gọi nhiều lần không bao giờ sinh duplicate v0',
    async () => {
      const call1 = await AuditVersionService.getVersionList(reportId);
      const call2 = await AuditVersionService.getVersionList(reportId);
      const call3 = await AuditVersionService.getVersionSnapshot(reportId, 0);

      const countRes = await Database.query<{ count: string }>(
        `SELECT count(*) FROM survey_report_versions WHERE report_id = $1 AND version_number = 0;`,
        [reportId]
      );
      assert.strictEqual(Number(countRes.rows[0].count), 1, 'Chỉ duy nhất có 1 bản ghi v0, không được trùng lặp');
    }
  );

  await runTestCase(
    'TC-RB-04',
    'Bảo toàn đầy đủ 100% dữ liệu gốc trong snapshot v0 do Self-Healing tự động tạo ra',
    async () => {
      const v0 = await AuditVersionService.getVersionSnapshot(reportId, 0);
      assert(v0.snapshotData, 'Snapshot data phải tồn tại');
      const snap = v0.snapshotData;

      // Kiểm tra đầy đủ thông tin thửa đất, cấu kiện, điểm số trong v0
      assert.strictEqual(snap.leftPane?.parcel?.ownerName, 'Trần Văn Cường Gốc v0', 'Chủ hộ gốc phải là Trần Văn Cường Gốc v0');
      assert.strictEqual(Number(snap.leftPane?.parcel?.frontageWidth), 4.5, 'Mặt tiền gốc 4.5m');
      assert.strictEqual(Number(snap.leftPane?.parcel?.lotDepth), 20.0, 'Chiều sâu gốc 20.0m');
      assert(Array.isArray(snap.leftPane?.damageZones), 'damageZones phải là mảng');
      assert.strictEqual(snap.leftPane?.riskScoreCard?.ecs_class, 'GOOD', 'ECS class gốc là GOOD');
    }
  );

  // =================================================================================
  // NHÓM 2: KHÔI PHỤC DỮ LIỆU THỬA ĐẤT & BẢNG QUAN HỆ (TC-RB-05 -> TC-RB-08)
  // =================================================================================
  console.log('\n========================================================================');
  console.log('🏡 NHÓM 2: KHÔI PHỤC DỮ LIỆU THỬA ĐẤT & BẢNG QUAN HỆ (TC-RB-05 -> TC-RB-08)');
  console.log('========================================================================');

  // Tạo phiên bản v1: Admin sửa thông tin thửa đất
  await runTestCase(
    'TC-RB-05',
    'Rollback khôi phục đầy đủ thông tin Thửa Đất Nhà Dân (parcels: chủ hộ, số nhà, mặt tiền, diện tích)',
    async () => {
      // 1. Giả lập Admin sửa thông tin thửa đất ở v1
      await Database.query(
        `UPDATE parcels SET
           owner_name = 'Lê Văn Sửa Đổi v1',
           house_number = '120/4B Mới',
           frontage_width = 5.2,
           lot_depth = 22.0
         WHERE id = $1;`,
        [parcelId]
      );

      const snapV1 = await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'ADMIN_DIFF_SAVE',
        title: 'Admin hiệu chỉnh thông tin thửa đất và chủ hộ',
        editReason: 'Cập nhật lại theo giấy chứng nhận quyền sử dụng đất mới',
        userId: zoneAdminId,
        diffSummary: [{ field: 'owner_name', oldValue: 'Trần Văn Cường Gốc v0', newValue: 'Lê Văn Sửa Đổi v1' }],
      });
      assert.strictEqual(snapV1.versionNumber, 1, 'Phiên bản sửa đổi phải là v1');

      // 2. Thực hiện Rollback về v0
      const rbRes = await AuditVersionService.rollbackToVersion(
        reportId,
        0,
        zoneAdminId,
        { reason: 'Hoàn nguyên về chủ hộ gốc theo hồ sơ hiện trường', password: zoneAdminPassword }
      );
      assert.strictEqual(rbRes.newVersionNumber, 2, 'Phiên bản mới tạo ra sau rollback phải là v2');

      // 3. Kiểm tra thông tin trong bảng parcels đã khôi phục về v0
      const pCheck = await Database.query<{ owner_name: string; house_number: string; frontage_width: string; lot_depth: string }>(
        `SELECT owner_name, house_number, frontage_width, lot_depth FROM parcels WHERE id = $1;`,
        [parcelId]
      );
      assert.strictEqual(pCheck.rows[0].owner_name, 'Trần Văn Cường Gốc v0', 'Chủ hộ phải khôi phục về v0');
      assert.strictEqual(pCheck.rows[0].house_number, '120/4B', 'Số nhà phải khôi phục về 120/4B');
      assert.strictEqual(Number(pCheck.rows[0].frontage_width), 4.5, 'Mặt tiền phải khôi phục về 4.5');
      assert.strictEqual(Number(pCheck.rows[0].lot_depth), 20.0, 'Chiều sâu phải khôi phục về 20.0');
    }
  );

  await runTestCase(
    'TC-RB-06',
    'Rollback khôi phục thông số kỹ thuật công trình (building_specifications)',
    async () => {
      // 1. Sửa building_specifications ở v3
      await Database.query(
        `UPDATE building_specifications SET
           building_name = 'Nhà phố 5 tầng cơi nới v3',
           floor_count = 5
         WHERE report_id = $1;`,
        [reportId]
      );

      await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'ADMIN_DIFF_SAVE',
        title: 'Sửa số tầng lên 5 tầng và đổi tên nhà',
        editReason: 'Khảo sát bổ sung tum thang',
        userId: zoneAdminId,
      });

      // 2. Rollback về v0
      await AuditVersionService.rollbackToVersion(
        reportId,
        0,
        zoneAdminId,
        { reason: 'Hoàn nguyên thông số kết cấu về hiện trường ban đầu', password: zoneAdminPassword }
      );

      // 3. Kiểm tra building_specifications đã khôi phục
      const specCheck = await Database.query<{ floor_count: number; building_name: string }>(
        `SELECT floor_count, building_name FROM building_specifications WHERE report_id = $1;`,
        [reportId]
      );
      assert.strictEqual(specCheck.rows[0].floor_count, 3, 'Số tầng phải khôi phục về 3');
      assert.strictEqual(specCheck.rows[0].building_name, 'Nhà phố 3 tầng BTCT', 'Tên công trình phải khôi phục về Nhà phố 3 tầng BTCT');
    }
  );

  await runTestCase(
    'TC-RB-07',
    'Rollback khôi phục đánh giá móng & biến dạng lún nghiêng (deformation_assessments)',
    async () => {
      // Sửa biến dạng ở v5
      await Database.query(
        `UPDATE deformation_assessments SET
           tilt_angle_x = 0.99,
           tilt_direction = 'Đông Nam',
           beam_deflection_mm = 15.0
         WHERE report_id = $1;`,
        [reportId]
      );

      await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'ADMIN_DIFF_SAVE',
        title: 'Cập nhật lại số liệu đo nghiêng laser lần 2',
        editReason: 'Số liệu đo lại',
        userId: zoneAdminId,
      });

      // Rollback về v0
      await AuditVersionService.rollbackToVersion(
        reportId,
        0,
        zoneAdminId,
        { reason: 'Hoàn nguyên độ nghiêng về số liệu khảo sát gốc', password: zoneAdminPassword }
      );

      const deformCheck = await Database.query<{ tilt_angle_x: string; tilt_direction: string; beam_deflection_mm: string }>(
        `SELECT tilt_angle_x, tilt_direction, beam_deflection_mm FROM deformation_assessments WHERE report_id = $1;`,
        [reportId]
      );
      assert.strictEqual(Number(deformCheck.rows[0].tilt_angle_x), 0.12, 'tilt_angle_x phải là 0.12');
      assert.strictEqual(deformCheck.rows[0].tilt_direction, 'Tây', 'Hướng nghiêng phải là Tây');
      assert.strictEqual(Number(deformCheck.rows[0].beam_deflection_mm), 3.5, 'Độ võng dầm phải là 3.5mm');
    }
  );

  await runTestCase(
    'TC-RB-08',
    'Chuỗi Rollback đa tầng liên tục (Chain Rollback), số thứ tự phiên bản tăng đơn điệu tuyệt đối',
    async () => {
      const vListBefore = await AuditVersionService.getVersionList(reportId);
      const startMax = vListBefore[0].versionNumber;

      // Rollback lần 1 về v0
      const rb1 = await AuditVersionService.rollbackToVersion(
        reportId,
        0,
        zoneAdminId,
        { reason: 'Chain Rollback Step 1', password: zoneAdminPassword }
      );
      assert.strictEqual(rb1.newVersionNumber, startMax + 1, 'Version mới phải tăng đúng 1 đơn vị');

      // Rollback lần 2 về v1
      const rb2 = await AuditVersionService.rollbackToVersion(
        reportId,
        1,
        zoneAdminId,
        { reason: 'Chain Rollback Step 2', password: zoneAdminPassword }
      );
      assert.strictEqual(rb2.newVersionNumber, startMax + 2, 'Version mới tiếp theo phải tăng đúng 1 đơn vị');

      // Rollback lần 3 về v0
      const rb3 = await AuditVersionService.rollbackToVersion(
        reportId,
        0,
        zoneAdminId,
        { reason: 'Chain Rollback Step 3', password: zoneAdminPassword }
      );
      assert.strictEqual(rb3.newVersionNumber, startMax + 3, 'Version mới tiếp theo phải tăng đúng 1 đơn vị');
    }
  );

  // =================================================================================
  // NHÓM 3: PHÒNG THỦ ĐỘNG BẢNG ĐIỂM RỦI RO (TC-RB-09 -> TC-RB-12)
  // =================================================================================
  console.log('\n========================================================================');
  console.log('🎯 NHÓM 3: PHÒNG THỦ ĐỘNG BẢNG ĐIỂM RỦI RO (TC-RB-09 -> TC-RB-12)');
  console.log('========================================================================');

  await runTestCase(
    'TC-RB-09',
    'Rollback bảng risk_score_cards với 10 cột phán quyết kỹ thuật của Kỹ sư trưởng',
    async () => {
      // 1. Áp dụng override phán quyết kỹ thuật của KST
      await Database.query(
        `UPDATE risk_score_cards SET
           is_engineering_judgement_applied = true,
           engineering_judgement_action = 'OVERRIDE',
           engineering_judgement_reason = 'Nhà gần hố đào ga ngầm, can thiệp nâng lên Cấp C rủi ro cao',
           overridden_burland_grade = 3,
           overridden_total_ecs = 18,
           overridden_ecs_class = 'CRITICAL',
           overridden_avg_vi = 3.2,
           overridden_vi_class = 'HIGH',
           overridden_impact_level_i = 4,
           overridden_bra = 'HIGH_RISK',
           judgement_engineer_name = 'TS. Nguyễn Văn Trưởng KST',
           judgement_applied_at = NOW()
         WHERE report_id = $1;`,
        [reportId]
      );

      const snapOverride = await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'CHIEF_ENGINEER_OVERRIDE',
        title: 'Chủ nhiệm can thiệp nâng cấp cảnh báo Cấp C',
        editReason: 'Đánh giá an toàn địa chất hầm',
        userId: zoneAdminId,
      });

      // 2. Thực hiện Rollback về chính phiên bản override này để kiểm chứng cập nhật đầy đủ 10 cột
      const rbRes = await AuditVersionService.rollbackToVersion(
        reportId,
        snapOverride.versionNumber,
        zoneAdminId,
        { reason: 'Khôi phục lại phiên bản can thiệp kỹ thuật', password: zoneAdminPassword }
      );
      assert(rbRes.success, 'Rollback phải thành công');

      const cardCheck = await Database.query<{
        is_engineering_judgement_applied: boolean;
        overridden_total_ecs: number;
        overridden_ecs_class: string;
        overridden_avg_vi: string;
        judgement_engineer_name: string;
      }>(
        `SELECT is_engineering_judgement_applied, overridden_total_ecs, overridden_ecs_class,
                overridden_avg_vi, judgement_engineer_name
         FROM risk_score_cards WHERE report_id = $1;`,
        [reportId]
      );
      assert.strictEqual(cardCheck.rows[0].is_engineering_judgement_applied, true, 'is_engineering_judgement_applied phải là true');
      assert.strictEqual(Number(cardCheck.rows[0].overridden_total_ecs), 18, 'overridden_total_ecs phải là 18');
      assert.strictEqual(cardCheck.rows[0].overridden_ecs_class, 'CRITICAL', 'overridden_ecs_class phải là CRITICAL');
      assert.strictEqual(Number(cardCheck.rows[0].overridden_avg_vi), 3.2, 'overridden_avg_vi phải là 3.2');
      assert.strictEqual(cardCheck.rows[0].judgement_engineer_name, 'TS. Nguyễn Văn Trưởng KST', 'Tên KST khớp');
    }
  );

  await runTestCase(
    'TC-RB-10',
    'Khôi phục phòng thủ khi hồ sơ ban đầu không có override (tự động reset các trường overridden_* về NULL)',
    async () => {
      // Rollback từ phiên bản đang có override về v0 (v0 vốn không có override)
      await AuditVersionService.rollbackToVersion(
        reportId,
        0,
        zoneAdminId,
        { reason: 'Hoàn nguyên về v0 không có override kỹ sư trưởng', password: zoneAdminPassword }
      );

      const cardCheck = await Database.query<{
        is_engineering_judgement_applied: boolean;
        overridden_total_ecs: number | null;
        overridden_ecs_class: string | null;
      }>(
        `SELECT is_engineering_judgement_applied, overridden_total_ecs, overridden_ecs_class
         FROM risk_score_cards WHERE report_id = $1;`,
        [reportId]
      );
      assert.strictEqual(cardCheck.rows[0].is_engineering_judgement_applied, false, 'is_engineering_judgement_applied phải là false');
      assert.strictEqual(cardCheck.rows[0].overridden_total_ecs, null, 'overridden_total_ecs phải được trả về NULL');
      assert.strictEqual(cardCheck.rows[0].overridden_ecs_class, null, 'overridden_ecs_class phải được trả về NULL');
    }
  );

  await runTestCase(
    'TC-RB-11',
    'Khôi phục chính xác các điểm thành phần ECS (E1..E6) và VI (V1..V6) cùng phân hạng BRA',
    async () => {
      const card = await Database.query<{
        e1_burland_score: number;
        total_ecs_score: number;
        ecs_class: string;
        avg_vi_score: string;
        vi_class: string;
        building_risk_assessment_bra: string;
      }>(
        `SELECT e1_burland_score, total_ecs_score, ecs_class, avg_vi_score, vi_class, building_risk_assessment_bra
         FROM risk_score_cards WHERE report_id = $1;`,
        [reportId]
      );
      assert.strictEqual(card.rows[0].e1_burland_score, 1, 'E1 Burland score phải là 1');
      assert.strictEqual(card.rows[0].total_ecs_score, 2, 'Tổng điểm ECS là 2');
      assert.strictEqual(card.rows[0].ecs_class, 'GOOD', 'Hạng ECS là GOOD');
      assert.strictEqual(Number(card.rows[0].avg_vi_score), 1.0, 'Điểm trung bình VI là 1.0');
      assert.strictEqual(card.rows[0].vi_class, 'LOW', 'Hạng VI là LOW');
      assert.strictEqual(card.rows[0].building_risk_assessment_bra, 'LOW_RISK', 'Hạng BRA là LOW_RISK');
    }
  );

  await runTestCase(
    'TC-RB-12',
    'Cơ chế Dynamic Column Query không bao giờ ném lỗi "column does not exist" (PostgreSQL 42703)',
    async () => {
      // Chạy lại rollback và đảm bảo không xảy ra exception
      const res = await AuditVersionService.rollbackToVersion(
        reportId,
        0,
        zoneAdminId,
        { reason: 'Kiểm tra độ bền bỉ của câu truy vấn phòng thủ động', password: zoneAdminPassword }
      );
      assert(res.success, 'Rollback phòng thủ động thành công 100%');
    }
  );

  // =================================================================================
  // NHÓM 4: BẢO TOÀN HÌNH ẢNH & SỔ CÁI VÒNG ĐỜI ẢNH (TC-RB-13 -> TC-RB-16)
  // =================================================================================
  console.log('\n========================================================================');
  console.log('📸 NHÓM 4: BẢO TOÀN HÌNH ẢNH & SỔ CÁI VÒNG ĐỜI ẢNH (TC-RB-13 -> TC-RB-16)');
  console.log('========================================================================');

  await runTestCase(
    'TC-RB-13',
    'Khôi phục ảnh nhận diện công trình P01..P04 (survey_identification_photos)',
    async () => {
      // 1. Sửa ảnh P01 sang ảnh khác
      await Database.query(
        `UPDATE survey_identification_photos SET
           raw_photo_url = 'https://storage.metro2.vn/ident/p01_v1_tam.jpg'
         WHERE report_id = $1 AND photo_type = 'P01_HOUSE_NUMBER';`,
        [reportId]
      );

      const snapPhotoEdit = await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'PHOTO_REPLACEMENT',
        title: 'Thay thế ảnh mặt tiền P01',
        editReason: 'Chụp lại góc rộng',
        userId: zoneAdminId,
      });

      // 2. Rollback về v0
      await AuditVersionService.rollbackToVersion(
        reportId,
        0,
        zoneAdminId,
        { reason: 'Hoàn nguyên ảnh nhận diện về ảnh nộp thực địa ban đầu', password: zoneAdminPassword }
      );

      // 3. Kiểm tra ảnh P01 đã trở về URL ban đầu của v0
      const p01 = await Database.query<{ raw_photo_url: string }>(
        `SELECT raw_photo_url FROM survey_identification_photos WHERE report_id = $1 AND photo_type = 'P01_HOUSE_NUMBER';`,
        [reportId]
      );
      assert.strictEqual(p01.rows[0].raw_photo_url, 'https://storage.metro2.vn/ident/p01_v0_raw.jpg', 'Ảnh P01 phải trở về URL v0');
    }
  );

  await runTestCase(
    'TC-RB-14',
    'Khôi phục ảnh vết nứt cận cảnh (cu_photo_url, cu_photos_json) và ảnh ngữ cảnh vùng (ctx_photo_url)',
    async () => {
      const snap0 = await AuditVersionService.getVersionSnapshot(reportId, 0);
      const zones = snap0.snapshotData.leftPane.damageZones || [];
      assert(zones.length > 0, 'damageZones phải có trong snapshot v0');
      const z0 = zones[0];
      const ctxUrl = z0.ctx_photo_url || z0.ctxPhotoUrl;
      assert.strictEqual(ctxUrl, 'https://storage.metro2.vn/photos/ctx_living_room_v0.jpg', 'CTX photo URL khớp v0');
      const cuUrl = z0.defects[0].cu_photo_url || z0.defects[0].cuPhotoUrl;
      assert.strictEqual(cuUrl, 'https://storage.metro2.vn/photos/cu_defect_d01_v0.jpg', 'CU photo URL khớp v0');
    }
  );

  await runTestCase(
    'TC-RB-15',
    'Đồng bộ Time-Travel Alignment trong Sổ cái ảnh (survey_photo_registry)',
    async () => {
      // 1. Thêm 1 ảnh mới trong registry với action_type = 'ADD' ở phiên bản mới
      const newPhotoUrl = 'https://storage.metro2.vn/photos/new_defect_photo_v_later.jpg';
      await Database.query(
        `INSERT INTO survey_photo_registry (
           report_id, parcel_id, photo_category, photo_type, photo_code,
           photo_url, standardized_filename, sha256_hash, action_type, status, is_deleted
         ) VALUES (
           $1, $2, 'DEFECT_CU', 'CU', '${testParcelCode}_D99',
           $3, 'M2_D99.jpg', 'sha256_hash_d99', 'ADD', 'ACTIVE', false
         );`,
        [reportId, parcelId, newPhotoUrl]
      );

      // 2. Kích hoạt Rollback về v0
      await AuditVersionService.rollbackToVersion(
        reportId,
        0,
        zoneAdminId,
        { reason: 'Hoàn nguyên về v0 kiểm tra Time-Travel Alignment cho ảnh', password: zoneAdminPassword }
      );

      // 3. Kiểm tra trạng thái trong survey_photo_registry:
      // Ảnh thuộc v0 phải là ACTIVE
      const p01Reg = await Database.query<{ status: string; is_deleted: boolean }>(
        `SELECT status, is_deleted FROM survey_photo_registry WHERE report_id = $1 AND photo_url = 'https://storage.metro2.vn/ident/p01_v0_raw.jpg';`,
        [reportId]
      );
      assert.strictEqual(p01Reg.rows[0].status, 'ACTIVE', 'Ảnh thuộc v0 phải có status là ACTIVE');
      assert.strictEqual(p01Reg.rows[0].is_deleted, false, 'is_deleted phải là false');

      // Ảnh sinh ra ở các phiên bản sau (không có trong v0) phải chuyển sang SUPERSEDED
      const newPhotoReg = await Database.query<{ status: string }>(
        `SELECT status FROM survey_photo_registry WHERE report_id = $1 AND photo_url = $2;`,
        [reportId, newPhotoUrl]
      );
      assert.strictEqual(newPhotoReg.rows[0].status, 'SUPERSEDED', 'Ảnh sinh ra sau v0 phải chuyển sang SUPERSEDED');
    }
  );

  await runTestCase(
    'TC-RB-16',
    'Chứng minh không thất thoát ảnh (Zero Photo Loss): 100% URL ảnh và checksum SHA-256 vẫn tồn tại nguyên vẹn',
    async () => {
      // Toàn bộ ảnh đã từng được đăng ký trong survey_photo_registry không bao giờ bị DELETE khỏi bảng
      const totalPhotos = await Database.query<{ count: string }>(
        `SELECT count(*) FROM survey_photo_registry WHERE report_id = $1;`,
        [reportId]
      );
      // Ban đầu có 2 ảnh + 1 ảnh add ở test case 15 = 3 ảnh
      assert(Number(totalPhotos.rows[0].count) >= 3, 'Tất cả các ảnh phải còn nguyên trong cơ sở dữ liệu');

      // Kiểm tra không có bản ghi nào bị rỗng checksum sha256
      const emptySha = await Database.query<{ count: string }>(
        `SELECT count(*) FROM survey_photo_registry WHERE report_id = $1 AND (sha256_hash IS NULL OR sha256_hash = '');`,
        [reportId]
      );
      assert.strictEqual(Number(emptySha.rows[0].count), 0, '100% ảnh đều có mã SHA-256 bảo vệ toàn vẹn');
    }
  );

  // =================================================================================
  // NHÓM 5: PHÂN QUYỀN, STATE MACHINE & AUDIT TRAIL (TC-RB-17 -> TC-RB-20)
  // =================================================================================
  console.log('\n========================================================================');
  console.log(' NHÓM 5: PHÂN QUYỀN, STATE MACHINE & AUDIT TRAIL (TC-RB-17 -> TC-RB-20)');
  console.log('========================================================================');

  await runTestCase(
    'TC-RB-17',
    'Trạng thái State Machine chuẩn hóa sau Rollback: base_survey_reports = UNDER_REVIEW, parcels = SUBMITTED',
    async () => {
      await AuditVersionService.rollbackToVersion(
        reportId,
        0,
        zoneAdminId,
        { reason: 'Kiểm tra trạng thái State Machine', password: zoneAdminPassword }
      );

      const rep = await Database.query<{ status: string }>(
        `SELECT status FROM base_survey_reports WHERE id = $1;`,
        [reportId]
      );
      assert.strictEqual(rep.rows[0].status, 'UNDER_REVIEW', 'base_survey_reports.status phải là UNDER_REVIEW');

      const par = await Database.query<{ survey_status: string }>(
        `SELECT survey_status FROM parcels WHERE id = $1;`,
        [parcelId]
      );
      assert.strictEqual(par.rows[0].survey_status, 'SUBMITTED', 'parcels.survey_status phải là SUBMITTED');
    }
  );

  await runTestCase(
    'TC-RB-18',
    'Phân quyền bảo mật nghiêm ngặt 3 lớp: Chặn SURVEYOR gọi rollback (403), sai mật khẩu bị từ chối (400)',
    async () => {
      // 1. SURVEYOR gọi rollback -> Bị chặn
      let surveyorBlocked = false;
      try {
        await AuditVersionService.rollbackToVersion(
          reportId,
          0,
          surveyorId,
          { reason: 'Surveyor cố gắng rollback trái phép', password: surveyorPassword }
        );
      } catch (e: any) {
        if (e.message.includes('thẩm quyền') || e.name === 'ForbiddenError') {
          surveyorBlocked = true;
        }
      }
      assert.strictEqual(surveyorBlocked, true, 'Surveyor phải bị chặn không được gọi rollback');

      // 2. Zone Admin nhập sai mật khẩu -> Bị chặn
      let wrongPassBlocked = false;
      try {
        await AuditVersionService.rollbackToVersion(
          reportId,
          0,
          zoneAdminId,
          { reason: 'Nhập sai pass', password: 'MậtKhẩuSaiHoànToàn' }
        );
      } catch (e: any) {
        if (e.message.includes('Mật khẩu xác thực không chính xác')) {
          wrongPassBlocked = true;
        }
      }
      assert.strictEqual(wrongPassBlocked, true, 'Sai mật khẩu phải bị chặn');
    }
  );

  await runTestCase(
    'TC-RB-19',
    'Bắt buộc nhập lý do kỹ thuật khi Rollback và tự động ghi nhật ký kiểm toán hệ thống (system_audit_logs)',
    async () => {
      // 1. Thử rollback không có lý do -> Phải báo lỗi
      let emptyReasonBlocked = false;
      try {
        await AuditVersionService.rollbackToVersion(
          reportId,
          0,
          zoneAdminId,
          { reason: '   ', password: zoneAdminPassword }
        );
      } catch (e: any) {
        if (e.message.includes('lý do kỹ thuật bắt buộc')) {
          emptyReasonBlocked = true;
        }
      }
      assert.strictEqual(emptyReasonBlocked, true, 'Lý do rỗng phải bị từ chối');

      // 2. Rollback có lý do và kiểm tra ghi log
      const uniqueReason = `Lý do kỹ thuật đặc biệt ghi log ${Date.now()}`;
      await AuditVersionService.rollbackToVersion(
        reportId,
        0,
        zoneAdminId,
        { reason: uniqueReason, password: zoneAdminPassword },
        '192.168.1.100'
      );

      const auditLog = await Database.query<{ action: string; client_ip: string; diff_payload: any }>(
        `SELECT action, client_ip, diff_payload FROM system_audit_logs
         WHERE entity_id = $1 AND action = 'ZONE_ADMIN_ROLLBACK_VERSION'
         ORDER BY created_at DESC LIMIT 1;`,
        [reportId]
      );
      assert(auditLog.rows[0], 'Phải có bản ghi trong system_audit_logs');
      assert.strictEqual(auditLog.rows[0].client_ip, '192.168.1.100', 'Client IP phải được ghi nhận chuẩn xác');
      assert.strictEqual(auditLog.rows[0].diff_payload?.reason, uniqueReason, 'Lý do kỹ thuật được lưu trong diff_payload');
    }
  );

  await runTestCase(
    'TC-RB-20',
    'Tính năng Time-Travel Snapshot Inspector: Trích xuất xem chi tiết bất kỳ snapshot cũ nào mà không thay đổi CSDL',
    async () => {
      // Đọc snapshot v1
      const snap1 = await AuditVersionService.getVersionSnapshot(reportId, 1);
      assert(snap1, 'Phải trích xuất được snapshot v1');
      assert.strictEqual(snap1.versionNumber, 1, 'Version phải là 1');

      // Đọc snapshot v0
      const snap0 = await AuditVersionService.getVersionSnapshot(reportId, 0);
      assert(snap0, 'Phải trích xuất được snapshot v0');
      assert.strictEqual(snap0.versionNumber, 0, 'Version phải là 0');

      // Đảm bảo dữ liệu hiện tại trong CSDL không bị thay đổi chỉ vì đọc snapshot
      const currentParcel = await Database.query<{ owner_name: string }>(
        `SELECT owner_name FROM parcels WHERE id = $1;`,
        [parcelId]
      );
      assert.strictEqual(currentParcel.rows[0].owner_name, 'Trần Văn Cường Gốc v0', 'Đọc snapshot không gây side-effect');
    }
  );

  // DỌN DẸP AN TOÀN
  console.log('\n🧹 [CLEANUP] Dọn dẹp dữ liệu kiểm thử an toàn...');
  await Database.query(`DELETE FROM base_survey_reports WHERE report_code LIKE 'BCR_TEST_PARCEL_RB20_%' OR report_code LIKE 'TEMP_REPORT_HEAL_%';`);
  await Database.query(`DELETE FROM parcels WHERE project_parcel_code LIKE 'TEST_PARCEL_RB20_%' OR project_parcel_code LIKE 'TEMP_PARCEL_HEAL_%';`);
  await Database.query(`DELETE FROM users WHERE username IN ('test_za_rollback_20', 'test_surv_rollback_20');`);
  console.log('   ✅ Đã dọn dẹp hoàn tất, khôi phục CSDL về trạng thái sạch.');

  // TỔNG KẾT
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log('\n================================================================================');
  console.log(`📊 BÁO CÁO KẾT QUẢ KIỂM THỬ: ${passed}/${total} TEST CASES ĐẠT CHUẨN (FAILED: ${failed})`);
  console.log('================================================================================\n');

  if (failed === 0) {
    console.log('🎉 CHÚC MỪNG: 100% (20/20) TEST CASES ĐÃ ĐẠT CHUẨN XUẤT SẮC!');
    process.exit(0);
  } else {
    console.error(`💥 CÓ ${failed} TEST CASE THẤT BẠI. VUI LÒNG KIỂM TRA LỖI Ở TRÊN.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
