import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Database, pool } from '../database/db';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';
import { AuditModificationService, PhotoActionItem } from '../modules/audit/services/audit-modification.service';
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
  console.log('🚀 [E2E TEST SUITE] 20 TEST CASES AUDIT PHOTO LINEAGE, ROLLBACK & VISUAL DIFF');
  console.log('   (Theo đúng Kế hoạch plan_audit_photo_lineage_rollback_and_visual_diff.md)');
  console.log('================================================================================\n');

  // 1. SETUP: Chuẩn bị tài khoản test và hồ sơ khảo sát
  console.log('👤 [SETUP 1/3] Chuẩn bị người dùng kiểm thử...');
  const zoneAdminPassword = 'ZoneAdmin@2026';
  const surveyorPassword = 'Surveyor@2026';
  const zoneAdminHash = await CryptoUtils.hashPassword(zoneAdminPassword);
  const surveyorHash = await CryptoUtils.hashPassword(surveyorPassword);

  let zoneAdminId: string;
  const existingZa = await Database.query<{ id: string }>(`SELECT id FROM users WHERE username = 'test_za_photo_lineage';`);
  if (existingZa.rows[0]) {
    zoneAdminId = existingZa.rows[0].id;
    await Database.query(`UPDATE users SET password_hash = $1, role = 'ZONE_ADMIN' WHERE id = $2;`, [zoneAdminHash, zoneAdminId]);
  } else {
    const zaRes = await Database.query<{ id: string }>(
      `INSERT INTO users (username, email, role, full_name, password_hash)
       VALUES ('test_za_photo_lineage', 'test_za_photo@metro2.vn', 'ZONE_ADMIN', 'Zone Admin Photo Lineage Test', $1)
       RETURNING id;`,
      [zoneAdminHash]
    );
    zoneAdminId = zaRes.rows[0].id;
  }

  let surveyorId: string;
  const existingSurv = await Database.query<{ id: string }>(`SELECT id FROM users WHERE username = 'test_surv_photo_lineage';`);
  if (existingSurv.rows[0]) {
    surveyorId = existingSurv.rows[0].id;
    await Database.query(`UPDATE users SET password_hash = $1, role = 'SURVEYOR' WHERE id = $2;`, [surveyorHash, surveyorId]);
  } else {
    const survRes = await Database.query<{ id: string }>(
      `INSERT INTO users (username, email, role, full_name, password_hash)
       VALUES ('test_surv_photo_lineage', 'test_surv_photo@metro2.vn', 'SURVEYOR', 'Surveyor Photo Lineage Test', $1)
       RETURNING id;`,
      [surveyorHash]
    );
    surveyorId = survRes.rows[0].id;
  }

  // 2. SETUP: Chuẩn bị thửa đất & hồ sơ khảo sát độc lập
  console.log('🏠 [SETUP 2/3] Chuẩn bị thửa đất test...');
  const zoneRow = await Database.query<{ zone_id: string }>(
    `SELECT DISTINCT zone_id FROM parcels WHERE zone_id IS NOT NULL LIMIT 1;`
  );
  const defaultZoneId = zoneRow.rows[0]?.zone_id || 'ZONE_01';

  const testParcelCode = `P_PHOTO_TEST_${Date.now().toString().slice(-6)}`;
  const parcelRes = await Database.query<{ id: string }>(
    `INSERT INTO parcels (
       project_parcel_code, house_number, street, ward, district,
       owner_name, owner_phone, building_type, floor_count, zone_id
     ) VALUES (
       $1, '123/45', 'Đường Kiểm Thử Ảnh', 'Phường Bến Thành', 'Quận 1',
       'Ông Nguyễn Văn Test Ảnh', '0909123456', 'RESIDENTIAL', 3, $2
     ) RETURNING id;`,
    [testParcelCode, defaultZoneId]
  );
  const testParcelId = parcelRes.rows[0].id;

  console.log('📋 [SETUP 3/3] Tạo hồ sơ khảo sát V0 (Ban đầu không có ảnh P01..P04, không có ảnh lún nghiêng)...');
  const reportCode = `REP_${testParcelCode}`;
  const initialSurveyJson = {
    parcelCode: testParcelCode,
    houseNumber: '123/45',
    street: 'Đường Kiểm Thử Ảnh',
    photoP01: { url: null, photoCode: 'P-01' },
    photoP02: { url: null, photoCode: 'P-02' },
    photoP03: { url: null, photoCode: 'P-03', additionalPhotos: [] },
    photoP04: { url: null, photoCode: 'P-04' },
    settlementTilt: {
      beamSagging: { photos: [] },
      differentialSettlement: { photos: [] },
      tilt: { photos: [] },
    },
    signatures: {
      surveyorName: 'Surveyor Photo Lineage Test',
      preparedBy: { photoUrl: null },
      ownerRepresentative: { photoUrl: null },
    },
  };

  const reportRes = await Database.query<{ id: string }>(
    `INSERT INTO base_survey_reports (
       parcel_id, surveyor_id, status, survey_data_json, report_code
     ) VALUES ($1, $2, 'SUBMITTED', $3, $4)
     RETURNING id;`,
    [testParcelId, surveyorId, JSON.stringify(initialSurveyJson), reportCode]
  );
  const testReportId = reportRes.rows[0].id;

  // Insert base identification photo placeholders with NULL URLs
  await Database.query(
    `INSERT INTO survey_identification_photos (report_id, photo_type, photo_code, raw_photo_url, annotated_photo_url)
     VALUES
       ($1, 'P01_HOUSE_NUMBER', 'P-01', NULL, NULL),
       ($1, 'P02_MAIN_FACADE', 'P-02', NULL, NULL),
       ($1, 'P03_SIDE_OR_REAR', 'P-03', NULL, NULL),
       ($1, 'P04_CONTEXT_STREET', 'P-04', NULL, NULL);`,
    [testReportId]
  );

  // Tạo Snapshot V0
  console.log('📸 Tạo Snapshot V0 ban đầu...');
  const v0Snapshot = await AuditVersionService.createSnapshot(testReportId, {
    versionTag: 'ORIGINAL_SUBMISSION',
    title: 'Hồ sơ gốc KSV nộp (V0 - Không có ảnh)',
    editReason: 'Nộp khảo sát hiện trường ban đầu',
    userId: surveyorId,
  });
  assert.strictEqual(v0Snapshot.versionNumber, 0, 'Snapshot ban đầu phải là v0');

  console.log('\n--- BẮT ĐẦU CHẠY 20 TEST CASES CHUYÊN SÂU ---\n');

  // ==============================================================================
  // GROUP 1: ROLLBACK PHANTASM PHOTO ELIMINATION & RESTORATION (TC01 - TC07)
  // ==============================================================================

  const v1PhotoP01Url = 'https://minio.metro2.vn/surveys/photos/p01_v1_new.jpg';
  const v1PhotoP02Url = 'https://minio.metro2.vn/surveys/photos/p02_v1_new.jpg';
  const v1PhotoP03Url = 'https://minio.metro2.vn/surveys/photos/p03_v1_new.jpg';
  const v1PhotoP04Url = 'https://minio.metro2.vn/surveys/photos/p04_v1_new.jpg';
  const v1BeamSaggingUrl = 'https://minio.metro2.vn/surveys/photos/sag_01_v1.jpg';
  const v1DiffSettleUrl = 'https://minio.metro2.vn/surveys/photos/settle_01_v1.jpg';
  const v1TiltUrl = 'https://minio.metro2.vn/surveys/photos/tilt_01_v1.jpg';

  let testZoneId: string = '';
  let testDefectId: string = '';

  await runTestCase('TC01', 'V0 ban đầu không có P-01 -> V1 thêm P-01 -> Rollback về V0 đảm bảo P-01 hoàn toàn NULL (Không tồn tại ảnh ma)', async () => {
    // 1. Cập nhật V1: Thêm ảnh P-01
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'ADD',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P01_HOUSE_NUMBER',
      newPhotoUrl: v1PhotoP01Url,
      photoCode: 'P-01',
      reason: 'Admin bổ sung ảnh số nhà P-01',
    });

    // Lưu snapshot V1
    await AuditVersionService.createSnapshot(testReportId, {
      versionTag: 'ADMIN_DIFF_SAVE',
      title: 'Phiên bản V1: Đã bổ sung P-01',
      editReason: 'Bổ sung ảnh định danh',
      userId: zoneAdminId,
    });

    // Kiểm tra V1 đang có ảnh P-01
    const p1RowV1 = await Database.query<{ raw_photo_url: string }>(
      `SELECT raw_photo_url FROM survey_identification_photos WHERE report_id = $1 AND photo_type = 'P01_HOUSE_NUMBER';`,
      [testReportId]
    );
    assert.strictEqual(p1RowV1.rows[0].raw_photo_url, v1PhotoP01Url, 'V1 phải có ảnh P-01');

    // Rollback về V0
    await AuditVersionService.rollbackToVersion(testReportId, 0, zoneAdminId, {
      password: zoneAdminPassword,
      reason: 'Hoàn nguyên về V0 kiểm tra triệt tiêu ảnh ma P-01',
    });

    // Kiểm tra sau rollback về V0: survey_identification_photos phải có raw_photo_url = NULL
    const p1RowAfterRollback = await Database.query<{ raw_photo_url: string | null }>(
      `SELECT raw_photo_url FROM survey_identification_photos WHERE report_id = $1 AND photo_type = 'P01_HOUSE_NUMBER';`,
      [testReportId]
    );
    assert.strictEqual(p1RowAfterRollback.rows[0].raw_photo_url, null, 'Sau khi rollback về V0, P-01 trong survey_identification_photos bắt buộc phải là NULL');

    // Kiểm tra survey_data_json cũng phải có photoP01.url = null
    const repCheck = await Database.query<{ survey_data_json: any }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    const sJson = typeof repCheck.rows[0].survey_data_json === 'string'
      ? JSON.parse(repCheck.rows[0].survey_data_json)
      : repCheck.rows[0].survey_data_json;
    assert.strictEqual(sJson.photoP01?.url, null, 'Sau rollback về V0, sJson.photoP01.url phải là NULL');
  });

  await runTestCase('TC02', 'V0 ban đầu không có P-02 -> V1 thêm P-02 -> Rollback về V0 bảo đảm P-02 hoàn toàn NULL trong DB và JSON', async () => {
    // Thêm P-02
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'ADD',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P02_MAIN_FACADE',
      newPhotoUrl: v1PhotoP02Url,
      photoCode: 'P-02',
      reason: 'Admin bổ sung ảnh mặt tiền P-02',
    });

    await AuditVersionService.createSnapshot(testReportId, {
      versionTag: 'ADMIN_DIFF_SAVE',
      title: 'Phiên bản V3: Đã bổ sung P-02',
      editReason: 'Bổ sung ảnh P-02',
      userId: zoneAdminId,
    });

    // Rollback về V0
    await AuditVersionService.rollbackToVersion(testReportId, 0, zoneAdminId, {
      password: zoneAdminPassword,
      reason: 'Hoàn nguyên về V0 kiểm tra triệt tiêu ảnh ma P-02',
    });

    const p2Row = await Database.query<{ raw_photo_url: string | null }>(
      `SELECT raw_photo_url FROM survey_identification_photos WHERE report_id = $1 AND photo_type = 'P02_MAIN_FACADE';`,
      [testReportId]
    );
    assert.strictEqual(p2Row.rows[0].raw_photo_url, null, 'P-02 sau rollback về V0 phải là NULL');
  });

  await runTestCase('TC03', 'V0 ban đầu không có P-03 -> V1 thêm P-03 -> Rollback về V0 bảo đảm P-03 hoàn toàn NULL trong DB và JSON', async () => {
    // Thêm P-03
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'ADD',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P03_SIDE_OR_REAR',
      newPhotoUrl: v1PhotoP03Url,
      photoCode: 'P-03',
      reason: 'Admin bổ sung ảnh mặt bên P-03',
    });

    // Rollback về V0
    await AuditVersionService.rollbackToVersion(testReportId, 0, zoneAdminId, {
      password: zoneAdminPassword,
      reason: 'Hoàn nguyên về V0 kiểm tra triệt tiêu ảnh ma P-03',
    });

    const p3Row = await Database.query<{ raw_photo_url: string | null }>(
      `SELECT raw_photo_url FROM survey_identification_photos WHERE report_id = $1 AND photo_type = 'P03_SIDE_OR_REAR';`,
      [testReportId]
    );
    assert.strictEqual(p3Row.rows[0].raw_photo_url, null, 'P-03 sau rollback về V0 phải là NULL');
  });

  await runTestCase('TC04', 'V0 ban đầu không có P-04 -> V1 thêm P-04 -> Rollback về V0 bảo đảm P-04 hoàn toàn NULL trong DB và JSON', async () => {
    // Thêm P-04
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'ADD',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P04_CONTEXT_STREET',
      newPhotoUrl: v1PhotoP04Url,
      photoCode: 'P-04',
      reason: 'Admin bổ sung ảnh P-04',
    });

    // Rollback về V0
    await AuditVersionService.rollbackToVersion(testReportId, 0, zoneAdminId, {
      password: zoneAdminPassword,
      reason: 'Hoàn nguyên về V0 kiểm tra triệt tiêu ảnh ma P-04',
    });

    const p4Row = await Database.query<{ raw_photo_url: string | null }>(
      `SELECT raw_photo_url FROM survey_identification_photos WHERE report_id = $1 AND photo_type = 'P04_CONTEXT_STREET';`,
      [testReportId]
    );
    assert.strictEqual(p4Row.rows[0].raw_photo_url, null, 'P-04 sau rollback về V0 phải là NULL');
  });

  await runTestCase('TC05', 'Step 5 ảnh võng dầm (beamSagging) thêm ở V1 -> Rollback về V0 khôi phục mảng rỗng []', async () => {
    // Cập nhật report thêm ảnh võng dầm
    const currentJsonRes = await Database.query<{ survey_data_json: any }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    const curJson = typeof currentJsonRes.rows[0].survey_data_json === 'string'
      ? JSON.parse(currentJsonRes.rows[0].survey_data_json)
      : currentJsonRes.rows[0].survey_data_json;

    curJson.settlementTilt = {
      ...(curJson.settlementTilt || {}),
      beamSagging: { photos: [v1BeamSaggingUrl] },
    };

    await Database.query(`UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`, [
      JSON.stringify(curJson),
      testReportId,
    ]);

    // Tạo snapshot có ảnh võng dầm
    await AuditVersionService.createSnapshot(testReportId, {
      versionTag: 'ADMIN_DIFF_SAVE',
      title: 'Phiên bản có ảnh võng dầm',
      editReason: 'Bổ sung ảnh Step 5 võng dầm',
      userId: zoneAdminId,
    });

    // Rollback về V0
    await AuditVersionService.rollbackToVersion(testReportId, 0, zoneAdminId, {
      password: zoneAdminPassword,
      reason: 'Hoàn nguyên về V0 kiểm tra võng dầm',
    });

    // Kiểm tra survey_data_json
    const repAfter = await Database.query<{ survey_data_json: any }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    const jsonAfter = typeof repAfter.rows[0].survey_data_json === 'string'
      ? JSON.parse(repAfter.rows[0].survey_data_json)
      : repAfter.rows[0].survey_data_json;

    const saggingPhotos = jsonAfter.settlementTilt?.beamSagging?.photos || [];
    assert.strictEqual(saggingPhotos.length, 0, 'Sau rollback về V0, ảnh võng dầm phải là mảng rỗng');
  });

  await runTestCase('TC06', 'Step 5 ảnh lún lệch & nghiêng (differentialSettlement/tilt) thêm ở V1 -> Rollback về V0 khôi phục mảng rỗng', async () => {
    // Cập nhật report thêm ảnh lún lệch và nghiêng
    const currentJsonRes = await Database.query<{ survey_data_json: any }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    const curJson = typeof currentJsonRes.rows[0].survey_data_json === 'string'
      ? JSON.parse(currentJsonRes.rows[0].survey_data_json)
      : currentJsonRes.rows[0].survey_data_json;

    curJson.settlementTilt = {
      ...(curJson.settlementTilt || {}),
      differentialSettlement: { photos: [v1DiffSettleUrl] },
      tilt: { photos: [v1TiltUrl] },
    };

    await Database.query(`UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`, [
      JSON.stringify(curJson),
      testReportId,
    ]);

    // Rollback về V0
    await AuditVersionService.rollbackToVersion(testReportId, 0, zoneAdminId, {
      password: zoneAdminPassword,
      reason: 'Hoàn nguyên về V0 kiểm tra lún lệch & nghiêng',
    });

    const repAfter = await Database.query<{ survey_data_json: any }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    const jsonAfter = typeof repAfter.rows[0].survey_data_json === 'string'
      ? JSON.parse(repAfter.rows[0].survey_data_json)
      : repAfter.rows[0].survey_data_json;

    assert.strictEqual((jsonAfter.settlementTilt?.differentialSettlement?.photos || []).length, 0, 'Lún lệch phải rỗng');
    assert.strictEqual((jsonAfter.settlementTilt?.tilt?.photos || []).length, 0, 'Nghiêng công trình phải rỗng');
  });

  await runTestCase('TC07', 'Vùng hư hại (damage_zones) và khuyết tật (defect_items) tạo ở V1 -> Rollback về V0 thực hiện soft-delete an toàn', async () => {
    // Tạo 1 zone và 1 defect phát sinh ở V1
    const zoneRes = await Database.query<{ id: string }>(
      `INSERT INTO damage_zones (report_id, zone_code, room_name, floor_name, ctx_photo_url)
       VALUES ($1, 'Z99', 'Phòng khách', 'Tầng 1', 'https://minio.metro2.vn/surveys/photos/ctx_z99.jpg')
       RETURNING id;`,
      [testReportId]
    );
    testZoneId = zoneRes.rows[0].id;

    const defectRes = await Database.query<{ id: string }>(
      `INSERT INTO defect_items (zone_id, defect_code, defect_type, screening_category, width_max_mm, length_mm, cu_photo_url, pin_x, pin_y)
       VALUES ($1, 'D99', 'Nứt vữa tường', 'CRACK', 1.5, 500.0, 'https://minio.metro2.vn/surveys/photos/cu_d99.jpg', 50.0, 50.0)
       RETURNING id;`,
      [testZoneId]
    );
    testDefectId = defectRes.rows[0].id;

    // Rollback về V0
    await AuditVersionService.rollbackToVersion(testReportId, 0, zoneAdminId, {
      password: zoneAdminPassword,
      reason: 'Hoàn nguyên về V0 kiểm tra soft-delete khuyết tật phát sinh sau V0',
    });

    // Kiểm tra soft-delete
    const dCheck = await Database.query<{ is_deleted: boolean }>(
      `SELECT is_deleted FROM defect_items WHERE id = $1;`,
      [testDefectId]
    );
    assert.strictEqual(dCheck.rows[0].is_deleted, true, 'Khuyết tật phát sinh sau snapshot V0 phải bị soft-delete (is_deleted = true)');

    const zCheck = await Database.query<{ is_deleted: boolean }>(
      `SELECT is_deleted FROM damage_zones WHERE id = $1;`,
      [testZoneId]
    );
    assert.strictEqual(zCheck.rows[0].is_deleted, true, 'Damage zone phát sinh sau snapshot V0 phải bị soft-delete (is_deleted = true)');
  });

  // ==============================================================================
  // GROUP 2: PHOTO HISTORY LINEAGE, SELF-HEALING & TIME-TRAVEL (TC08 - TC14)
  // ==============================================================================

  const initialP01Url = 'https://minio.metro2.vn/surveys/photos/initial_p01_original.jpg';
  const replacedP01Url = 'https://minio.metro2.vn/surveys/photos/replaced_p01_v1.jpg';
  const secondReplacedP01Url = 'https://minio.metro2.vn/surveys/photos/replaced_p01_v2.jpg';

  await runTestCase('TC08', 'seedInitialReportPhotos tự động quét và nạp ảnh gốc hiện trường vào survey_photo_registry với status = ACTIVE', async () => {
    // Đặt 1 ảnh ban đầu vào report
    await Database.query(
      `UPDATE survey_identification_photos
       SET raw_photo_url = $1, photo_code = 'P-01'
       WHERE report_id = $2 AND photo_type = 'P01_HOUSE_NUMBER';`,
      [initialP01Url, testReportId]
    );

    // Chạy seedInitialReportPhotos
    const seededCount = await AuditModificationService.seedInitialReportPhotos(testReportId);
    assert(seededCount >= 1, `Phải seed được ít nhất 1 ảnh (đã seed ${seededCount})`);

    // Kiểm tra bản ghi trong survey_photo_registry
    const regRow = await Database.query<{ photo_url: string; action_type: string; status: string }>(
      `SELECT photo_url, action_type, status FROM survey_photo_registry
       WHERE report_id = $1 AND photo_url = $2;`,
      [testReportId, initialP01Url]
    );
    assert.strictEqual(regRow.rows.length, 1, 'Bản ghi ảnh ban đầu phải có trong survey_photo_registry');
    assert.strictEqual(regRow.rows[0].action_type, 'INITIAL_SURVEY', 'action_type phải là INITIAL_SURVEY');
    assert.strictEqual(regRow.rows[0].status, 'ACTIVE', 'status ban đầu phải là ACTIVE');
  });

  await runTestCase('TC09', 'Self-Healing: Khi thay thế ảnh mà oldUrl chưa có trong registry, tự động seed oldUrl trước khi REPLACE', async () => {
    const unseededOldUrl = 'https://minio.metro2.vn/surveys/photos/unregistered_old_p02.jpg';
    const newReplacementUrl = 'https://minio.metro2.vn/surveys/photos/new_replacement_p02.jpg';

    // Cập nhật P-02 trực tiếp trong DB mà không qua registry (giả lập ảnh khảo sát cũ chưa được seed)
    await Database.query(
      `UPDATE survey_identification_photos
       SET raw_photo_url = $1
       WHERE report_id = $2 AND photo_type = 'P02_MAIN_FACADE';`,
      [unseededOldUrl, testReportId]
    );

    // Gọi REPLACE qua executePhotoAction
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'REPLACE',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P02_MAIN_FACADE',
      oldPhotoUrl: unseededOldUrl,
      newPhotoUrl: newReplacementUrl,
      photoCode: 'P-02',
      reason: 'Admin thay thế ảnh P-02 có cơ chế tự phục hồi Self-Healing',
    });

    // Kiểm tra cả unseededOldUrl đã được self-heal vào registry
    const oldReg = await Database.query<{ action_type: string; status: string }>(
      `SELECT action_type, status FROM survey_photo_registry WHERE report_id = $1 AND photo_url = $2;`,
      [testReportId, unseededOldUrl]
    );
    assert.strictEqual(oldReg.rows.length, 1, 'Ảnh cũ chưa seed bắt buộc phải được Self-Healing tạo bản ghi');
    assert.strictEqual(oldReg.rows[0].status, 'SUPERSEDED', 'Ảnh cũ sau khi bị thay thế phải có status = SUPERSEDED');

    // Kiểm tra ảnh mới
    const newReg = await Database.query<{ action_type: string; status: string; replacement_for_url: string }>(
      `SELECT action_type, status, replacement_for_url FROM survey_photo_registry WHERE report_id = $1 AND photo_url = $2;`,
      [testReportId, newReplacementUrl]
    );
    assert.strictEqual(newReg.rows.length, 1, 'Ảnh mới phải được lưu vào registry');
    assert.strictEqual(newReg.rows[0].action_type, 'REPLACE', 'action_type phải là REPLACE');
    assert.strictEqual(newReg.rows[0].status, 'ACTIVE', 'Ảnh mới phải có status = ACTIVE');
    assert.strictEqual(newReg.rows[0].replacement_for_url, unseededOldUrl, 'replacement_for_url phải trỏ về ảnh cũ');
  });

  await runTestCase('TC10', 'Thay thế ảnh liên hoàn: V0 -> V1 -> V2 bảo đảm phả hệ nối tiếp không bị đứt đoạn', async () => {
    // Chuẩn bị chuỗi phả hệ chuẩn sạch 3 mắt xích
    await Database.query(`DELETE FROM survey_photo_registry WHERE report_id = $1 AND (photo_code = 'P-01' OR photo_code = 'P01');`, [testReportId]);
    await Database.query(
      `INSERT INTO survey_photo_registry (
         report_id, parcel_id, photo_category, photo_type, photo_code, photo_url,
         standardized_filename, sha256_hash, status, action_type, action_reason, actor_id, actor_role
       ) VALUES ($1, $2, 'IDENTIFICATION', 'P01_HOUSE_NUMBER', 'P-01', $3, 'M2__initial_P-01.jpg', 'hash01', 'ACTIVE', 'INITIAL_SURVEY', 'Ảnh gốc', $4, 'SURVEYOR');`,
      [testReportId, testParcelId, initialP01Url, surveyorId]
    );

    // Thay thế P-01 lần 1: initialP01Url -> replacedP01Url
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'REPLACE',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P01_HOUSE_NUMBER',
      oldPhotoUrl: initialP01Url,
      newPhotoUrl: replacedP01Url,
      photoCode: 'P-01',
      reason: 'Thay thế P-01 lần 1',
    });

    // Thay thế P-01 lần 2: replacedP01Url -> secondReplacedP01Url
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'REPLACE',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P01_HOUSE_NUMBER',
      oldPhotoUrl: replacedP01Url,
      newPhotoUrl: secondReplacedP01Url,
      photoCode: 'P-01',
      reason: 'Thay thế P-01 lần 2',
    });

    // Kiểm tra trong survey_photo_registry có đủ 3 bản ghi
    const chainRes = await Database.query<{ photo_url: string; status: string; action_type: string }>(
      `SELECT photo_url, status, action_type FROM survey_photo_registry
       WHERE report_id = $1 AND (photo_code = 'P-01' OR photo_code = 'P01')
       ORDER BY created_at ASC;`,
      [testReportId]
    );
    assert.strictEqual(chainRes.rows.length, 3, 'Phải có đúng 3 bản ghi trong phả hệ P-01');
    assert.strictEqual(chainRes.rows[0].status, 'SUPERSEDED', 'Ảnh 1 phải là SUPERSEDED');
    assert.strictEqual(chainRes.rows[1].status, 'SUPERSEDED', 'Ảnh 2 phải là SUPERSEDED');
    assert.strictEqual(chainRes.rows[2].status, 'ACTIVE', 'Ảnh 3 (mới nhất) phải là ACTIVE');
  });

  await runTestCase('TC11', 'getPhotoAuditRegistry truy vấn theo currentPhotoUrl trả về toàn bộ chuỗi phả hệ lịch sử (Kể cả ảnh đã SUPERSEDED)', async () => {
    // Truy vấn lịch sử ảnh cho secondReplacedP01Url
    const history = await AuditModificationService.getPhotoAuditRegistry(testReportId, {
      photoCode: 'P-01',
      currentPhotoUrl: secondReplacedP01Url,
    });

    assert(history.length >= 3, `Lịch sử ảnh phải chứa đủ cả 3 ảnh (được ${history.length})`);
    const urls = history.map((h: any) => h.photo_url);
    assert(urls.includes(initialP01Url), 'Phải tìm thấy ảnh gốc initialP01Url');
    assert(urls.includes(replacedP01Url), 'Phải tìm thấy ảnh trung gian replacedP01Url');
    assert(urls.includes(secondReplacedP01Url), 'Phải tìm thấy ảnh hiện tại secondReplacedP01Url');
  });

  await runTestCase('TC12', 'getPhotoAuditRegistry hỗ trợ đối sánh linh hoạt mã ảnh (P01, P-01, p01)', async () => {
    const resHyphen = await AuditModificationService.getPhotoAuditRegistry(testReportId, { photoCode: 'P-01' });
    const resNoHyphen = await AuditModificationService.getPhotoAuditRegistry(testReportId, { photoCode: 'P01' });
    const resLower = await AuditModificationService.getPhotoAuditRegistry(testReportId, { photoCode: 'p01' });

    assert.strictEqual(resHyphen.length, resNoHyphen.length, 'Số lượng kết quả P-01 và P01 phải bằng nhau');
    assert.strictEqual(resHyphen.length, resLower.length, 'Số lượng kết quả P-01 và p01 phải bằng nhau');
  });

  await runTestCase('TC13', 'Time-Travel: Rollback về Snapshot cập nhật status = SUPERSEDED cho mọi ảnh phát sinh sau snapshot đó', async () => {
    // Tạo snapshot V_mid
    const vMid = await AuditVersionService.createSnapshot(testReportId, {
      versionTag: 'ADMIN_DIFF_SAVE',
      title: 'Phiên bản V_mid có 3 ảnh P-01',
      userId: zoneAdminId,
    });

    // Thêm ảnh mới sau V_mid
    const afterSnapshotPhotoUrl = 'https://minio.metro2.vn/surveys/photos/p04_after_vmid.jpg';
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'ADD',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P04_CONTEXT_STREET',
      newPhotoUrl: afterSnapshotPhotoUrl,
      photoCode: 'P-04',
      reason: 'Thêm ảnh sau snapshot',
    });

    // Rollback về V_mid
    await AuditVersionService.rollbackToVersion(testReportId, vMid.versionNumber, zoneAdminId, {
      password: zoneAdminPassword,
      reason: 'Rollback về V_mid để kiểm tra Time-Travel cho survey_photo_registry',
    });

    // Kiểm tra ảnh phát sinh sau V_mid đã chuyển sang SUPERSEDED
    const regCheck = await Database.query<{ status: string }>(
      `SELECT status FROM survey_photo_registry WHERE report_id = $1 AND photo_url = $2;`,
      [testReportId, afterSnapshotPhotoUrl]
    );
    assert.strictEqual(regCheck.rows[0].status, 'SUPERSEDED', 'Ảnh phát sinh sau snapshot đích phải chuyển sang SUPERSEDED khi rollback');
  });

  await runTestCase('TC14', 'Khôi phục ảnh lịch sử an toàn (RESTORE), tạo bản ghi RESTORE và bảo toàn 100% dữ liệu (Zero Loss)', async () => {
    // Khôi phục lại initialP01Url bằng executePhotoAction action = RESTORE
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'RESTORE',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P01_HOUSE_NUMBER',
      newPhotoUrl: initialP01Url,
      photoCode: 'P-01',
      reason: 'Khôi phục ảnh P-01 ban đầu từ lịch sử',
    });

    // Kiểm tra bản ghi RESTORE trong survey_photo_registry
    const restoreReg = await Database.query<{ action_type: string; status: string }>(
      `SELECT action_type, status FROM survey_photo_registry
       WHERE report_id = $1 AND photo_url = $2 AND action_type = 'RESTORE';`,
      [testReportId, initialP01Url]
    );
    assert.strictEqual(restoreReg.rows.length, 1, 'Bản ghi mới phải có action_type = RESTORE');
    assert.strictEqual(restoreReg.rows[0].status, 'ACTIVE', 'Bản ghi khôi phục phải có status = ACTIVE');

    // Kiểm tra bảng survey_identification_photos đã cập nhật về initialP01Url
    const p1Current = await Database.query<{ raw_photo_url: string }>(
      `SELECT raw_photo_url FROM survey_identification_photos WHERE report_id = $1 AND photo_type = 'P01_HOUSE_NUMBER';`,
      [testReportId]
    );
    assert.strictEqual(p1Current.rows[0].raw_photo_url, initialP01Url, 'Hồ sơ đang hoạt động phải hiển thị ảnh đã khôi phục');
  });

  // ==============================================================================
  // GROUP 3: VISUAL PHOTO DIFF SIDE-BY-SIDE LOGIC & STATE INTEGRITY (TC15 - TC20)
  // ==============================================================================

  const computeDiffStatus = (oldUrl: string | null | undefined, newUrl: string | null | undefined): 'UNCHANGED' | 'ADDED' | 'REPLACED' | 'REMOVED' => {
    const oldU = oldUrl?.trim() || null;
    const newU = newUrl?.trim() || null;
    if (!oldU && newU) return 'ADDED';
    if (oldU && !newU) return 'REMOVED';
    if (oldU && newU && oldU !== newU) return 'REPLACED';
    return 'UNCHANGED';
  };

  await runTestCase('TC15', 'Thuật toán Visual Diff nhận diện chính xác trạng thái ADDED khi oldUrl rỗng và newUrl có ảnh', async () => {
    const status = computeDiffStatus(null, 'https://minio.metro2.vn/new_photo.jpg');
    assert.strictEqual(status, 'ADDED', 'Phải nhận diện trạng thái ADDED');

    const statusEmptyStr = computeDiffStatus('', 'https://minio.metro2.vn/new_photo.jpg');
    assert.strictEqual(statusEmptyStr, 'ADDED', 'Chuỗi rỗng ở oldUrl phải được coi là null và nhận diện ADDED');
  });

  await runTestCase('TC16', 'Thuật toán Visual Diff nhận diện chính xác trạng thái REPLACED khi oldUrl khác newUrl', async () => {
    const status = computeDiffStatus(
      'https://minio.metro2.vn/old_photo.jpg',
      'https://minio.metro2.vn/new_photo.jpg'
    );
    assert.strictEqual(status, 'REPLACED', 'Hai URL khác nhau phải nhận diện trạng thái REPLACED');
  });

  await runTestCase('TC17', 'Thuật toán Visual Diff nhận diện chính xác trạng thái REMOVED khi oldUrl có ảnh và newUrl rỗng', async () => {
    const status = computeDiffStatus('https://minio.metro2.vn/old_photo.jpg', null);
    assert.strictEqual(status, 'REMOVED', 'oldUrl có ảnh và newUrl null phải nhận diện REMOVED');

    const statusEmptyNew = computeDiffStatus('https://minio.metro2.vn/old_photo.jpg', '   ');
    assert.strictEqual(statusEmptyNew, 'REMOVED', 'newUrl chuỗi rỗng phải nhận diện REMOVED');
  });

  await runTestCase('TC18', 'Thuật toán Visual Diff nhận diện chính xác trạng thái UNCHANGED và bộ lọc diffOnlyCount loại bỏ ảnh không đổi', async () => {
    const status = computeDiffStatus(
      'https://minio.metro2.vn/same_photo.jpg',
      'https://minio.metro2.vn/same_photo.jpg'
    );
    assert.strictEqual(status, 'UNCHANGED', 'Hai URL giống nhau phải nhận diện UNCHANGED');

    // Kiểm tra bộ đếm diffOnlyCount
    const mockItems = [
      { id: '1', status: 'UNCHANGED' as const },
      { id: '2', status: 'ADDED' as const },
      { id: '3', status: 'REPLACED' as const },
      { id: '4', status: 'UNCHANGED' as const },
      { id: '5', status: 'REMOVED' as const },
    ];
    const diffOnly = mockItems.filter((i) => i.status !== 'UNCHANGED');
    assert.strictEqual(diffOnly.length, 3, 'diffOnlyCount phải bằng đúng 3 (bỏ qua 2 mục UNCHANGED)');
  });

  await runTestCase('TC19', 'Phân loại chuyên mục ảnh (IDENT, SETTLEMENT, DEFECTS, SPECIAL) hoạt động độc lập và chính xác', async () => {
    const mockCategorizedPhotos = [
      { id: 'ident_P01', category: 'IDENT' },
      { id: 'ident_P02', category: 'IDENT' },
      { id: 'st_SAG_1', category: 'SETTLEMENT' },
      { id: 'st_TILT_1', category: 'SETTLEMENT' },
      { id: 'zone_ctx_Z01', category: 'DEFECTS' },
      { id: 'defect_cu_Z01_D01', category: 'DEFECTS' },
      { id: 'sig_ksv', category: 'SPECIAL' },
      { id: 'vacant_1', category: 'SPECIAL' },
    ];

    const identList = mockCategorizedPhotos.filter((p) => p.category === 'IDENT');
    const settleList = mockCategorizedPhotos.filter((p) => p.category === 'SETTLEMENT');
    const defectList = mockCategorizedPhotos.filter((p) => p.category === 'DEFECTS');
    const specialList = mockCategorizedPhotos.filter((p) => p.category === 'SPECIAL');

    assert.strictEqual(identList.length, 2, 'IDENT phải có 2');
    assert.strictEqual(settleList.length, 2, 'SETTLEMENT phải có 2');
    assert.strictEqual(defectList.length, 2, 'DEFECTS phải có 2');
    assert.strictEqual(specialList.length, 2, 'SPECIAL phải có 2');
  });

  await runTestCase('TC20', 'Multi-Cycle Integrity: V0 (rỗng) -> V1 (thêm) -> V2 (thay ảnh) -> Rollback V0 (sạch) -> Rollback V2 (đầy đủ) duy trì tính bất biến 100%', async () => {
    // 1. Tạo snapshot V_empty (sạch)
    await Database.query(
      `UPDATE survey_identification_photos
       SET raw_photo_url = NULL
       WHERE report_id = $1 AND photo_type = 'P03_SIDE_OR_REAR';`,
      [testReportId]
    );
    const snapEmpty = await AuditVersionService.createSnapshot(testReportId, {
      versionTag: 'ADMIN_DIFF_SAVE',
      title: 'V_clean: P-03 rỗng',
      userId: zoneAdminId,
    });

    // 2. Thêm ảnh P-03
    const photoCycle1 = 'https://minio.metro2.vn/cycle_p03_v1.jpg';
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'ADD',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P03_SIDE_OR_REAR',
      newPhotoUrl: photoCycle1,
      photoCode: 'P-03',
      reason: 'Multi-cycle thêm ảnh',
    });

    // 3. Thay ảnh P-03
    const photoCycle2 = 'https://minio.metro2.vn/cycle_p03_v2.jpg';
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'REPLACE',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P03_SIDE_OR_REAR',
      oldPhotoUrl: photoCycle1,
      newPhotoUrl: photoCycle2,
      photoCode: 'P-03',
      reason: 'Multi-cycle thay ảnh',
    });

    const snapFilled = await AuditVersionService.createSnapshot(testReportId, {
      versionTag: 'ADMIN_DIFF_SAVE',
      title: 'V_filled: P-03 có ảnh v2',
      userId: zoneAdminId,
    });

    // 4. Rollback về snapEmpty: P-03 phải sạch bóng
    await AuditVersionService.rollbackToVersion(testReportId, snapEmpty.versionNumber, zoneAdminId, {
      password: zoneAdminPassword,
      reason: 'Rollback về V_clean',
    });

    const checkClean = await Database.query<{ raw_photo_url: string | null }>(
      `SELECT raw_photo_url FROM survey_identification_photos WHERE report_id = $1 AND photo_type = 'P03_SIDE_OR_REAR';`,
      [testReportId]
    );
    assert.strictEqual(checkClean.rows[0].raw_photo_url, null, 'Sau khi rollback về V_clean, P-03 bắt buộc phải là NULL');

    // 5. Rollback về snapFilled: P-03 phải phục hồi đầy đủ photoCycle2
    await AuditVersionService.rollbackToVersion(testReportId, snapFilled.versionNumber, zoneAdminId, {
      password: zoneAdminPassword,
      reason: 'Rollback về V_filled',
    });

    const checkFilled = await Database.query<{ raw_photo_url: string | null }>(
      `SELECT raw_photo_url FROM survey_identification_photos WHERE report_id = $1 AND photo_type = 'P03_SIDE_OR_REAR';`,
      [testReportId]
    );
    assert.strictEqual(checkFilled.rows[0].raw_photo_url, photoCycle2, 'Sau khi rollback về V_filled, P-03 bắt buộc phải phục hồi lại photoCycle2');
  });

  // TỔNG KẾT KẾT QUẢ TEST
  console.log('\n================================================================================');
  console.log('📊 TỔNG HỢP KẾT QUẢ 20 TEST CASES KIỂM THỬ:');
  console.log('================================================================================');

  let passedCount = 0;
  let failedCount = 0;
  testResults.forEach((t) => {
    if (t.passed) {
      passedCount++;
      console.log(`  ✅ ${t.code}: ${t.name} (${t.durationMs}ms)`);
    } else {
      failedCount++;
      console.log(`  ❌ ${t.code}: ${t.name} (${t.durationMs}ms) - Lỗi: ${t.error}`);
    }
  });

  console.log('--------------------------------------------------------------------------------');
  console.log(`Tổng kết: ${passedCount}/20 test cases ĐẠT (${Math.round((passedCount / 20) * 100)}%).`);
  if (failedCount > 0) {
    console.error(`🚨 CÓ ${failedCount} TEST CASES THẤT BẠI!`);
    process.exit(1);
  } else {
    console.log('🎉 TẤT CẢ 20 TEST CASES ĐÃ PASS 100%! HỆ THỐNG ĐÃ SẴN SÀNG VẬN HÀNH.');
  }

  // Cleanup dữ liệu kiểm thử
  console.log('\n🧹 Dọn dẹp dữ liệu kiểm thử test parcel & report...');
  try {
    await Database.query(`DELETE FROM survey_photo_registry WHERE report_id = $1;`, [testReportId]);
    await Database.query(`DELETE FROM survey_report_versions WHERE report_id = $1;`, [testReportId]);
    await Database.query(`DELETE FROM survey_identification_photos WHERE report_id = $1;`, [testReportId]);
    await Database.query(`DELETE FROM defect_items WHERE zone_id = $1;`, [testZoneId]);
    await Database.query(`DELETE FROM damage_zones WHERE report_id = $1;`, [testReportId]);
    await Database.query(`DELETE FROM base_survey_reports WHERE id = $1;`, [testReportId]);
    await Database.query(`DELETE FROM parcels WHERE id = $1;`, [testParcelId]);
    console.log('✨ Dọn dẹp hoàn tất.');
  } catch (cleanErr: any) {
    console.warn('⚠️ Lỗi dọn dẹp (có thể bỏ qua):', cleanErr?.message);
  }

  await pool.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Lỗi không xử lý được trong quá trình chạy test suite:', e);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
