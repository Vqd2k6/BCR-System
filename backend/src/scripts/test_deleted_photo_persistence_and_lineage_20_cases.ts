import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Database } from '../database/db';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';
import { AuditModificationService } from '../modules/audit/services/audit-modification.service';
import { AuditReviewService } from '../modules/audit/services/audit-review.service';
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
  console.log('🚀 [E2E SUITE] 20 TEST CASES DELETED PHOTO PERSISTENCE & LINEAGE RESTORATION');
  console.log('   (Kiểm chứng dứt điểm lỗi ảnh đã xóa vẫn hiển thị ở version hiện tại)');
  console.log('================================================================================\n');

  // 1. SETUP: Người dùng kiểm thử
  console.log('👤 [SETUP 1/3] Chuẩn bị người dùng kiểm thử...');
  const zoneAdminPassword = 'ZoneAdmin@2026';
  const zoneAdminHash = await CryptoUtils.hashPassword(zoneAdminPassword);

  let zoneAdminId: string;
  const existingZa = await Database.query<{ id: string }>(`SELECT id FROM users WHERE username = 'test_za_photo_persist';`);
  if (existingZa.rows[0]) {
    zoneAdminId = existingZa.rows[0].id;
    await Database.query(`UPDATE users SET password_hash = $1, role = 'ZONE_ADMIN' WHERE id = $2;`, [zoneAdminHash, zoneAdminId]);
  } else {
    const zaRes = await Database.query<{ id: string }>(
      `INSERT INTO users (username, email, role, full_name, password_hash)
       VALUES ('test_za_photo_persist', 'test_za_persist@metro2.vn', 'ZONE_ADMIN', 'Zone Admin Persist Test', $1)
       RETURNING id;`,
      [zoneAdminHash]
    );
    zoneAdminId = zaRes.rows[0].id;
  }

  // 2. SETUP: Thửa đất & Hồ sơ khảo sát
  console.log('🏠 [SETUP 2/3] Chuẩn bị thửa đất test...');
  const zoneRow = await Database.query<{ zone_id: string }>(
    `SELECT DISTINCT zone_id FROM parcels WHERE zone_id IS NOT NULL LIMIT 1;`
  );
  const defaultZoneId = zoneRow.rows[0]?.zone_id || 'ZONE_01';

  const testParcelCode = `P_PERSIST_${Date.now().toString().slice(-6)}`;
  const parcelRes = await Database.query<{ id: string }>(
    `INSERT INTO parcels (
       project_parcel_code, house_number, street, ward, district,
       owner_name, owner_phone, building_type, floor_count, zone_id
     ) VALUES (
       $1, '777/88', 'Đường Kiểm Thử Xóa Ảnh', 'Phường Bến Thành', 'Quận 1',
       'Bà Trần Thị Kiểm Thử', '0909888999', 'RESIDENTIAL', 3, $2
     ) RETURNING id;`,
    [testParcelCode, defaultZoneId]
  );
  const testParcelId = parcelRes.rows[0].id;

  console.log('📋 [SETUP 3/3] Tạo hồ sơ khảo sát có đầy đủ ảnh P01, P02, P03, P04, defect, CAD, CTX...');
  const initialP01 = 'https://minio.metro2.vn/surveys/p01_initial.jpg';
  const initialP02 = 'https://minio.metro2.vn/surveys/p02_initial.jpg';
  const initialP03 = 'https://minio.metro2.vn/surveys/p03_initial.jpg';
  const initialP04 = 'https://minio.metro2.vn/surveys/p04_initial.jpg';
  const initialCad = 'https://minio.metro2.vn/surveys/cad_initial.jpg';
  const initialCtx = 'https://minio.metro2.vn/surveys/ctx_initial.jpg';
  const initialCu1 = 'https://minio.metro2.vn/surveys/cu1_initial.jpg';
  const initialCu2 = 'https://minio.metro2.vn/surveys/cu2_initial.jpg';
  const initialSign = 'https://minio.metro2.vn/surveys/sign_initial.png';

  const initialSurveyJson = {
    surveyCaseType: 'NORMAL',
    photoP01: { url: initialP01, photoCode: 'P-01', notApplicable: false },
    photoP02: { url: initialP02, photoCode: 'P-02', notApplicable: false },
    photoP03: { url: initialP03, photoCode: 'P-03', notApplicable: false, additionalPhotos: [] },
    photoP04: { url: initialP04, photoCode: 'P-04', notApplicable: false },
    floors: [
      {
        id: 'floor_1',
        floorNumber: 1,
        cadStructuralSketchPhotoUrl: initialCad,
        zones: [
          {
            id: 'zone_1',
            zoneCode: 'Z-01',
            ctxPhotoUrl: initialCtx,
            defects: [
              {
                id: 'defect_1',
                defectCode: 'EC-01',
                cuPhotoUrl: initialCu1,
                cuPhotos: [initialCu1, initialCu2],
              },
            ],
          },
        ],
      },
    ],
    signatures: {
      surveyorSignatureUrl: initialSign,
    },
  };

  const repRes = await Database.query<{ id: string }>(
    `INSERT INTO base_survey_reports (
       parcel_id, surveyor_id, status, survey_data_json, report_code, surveyor_signature_url
     ) VALUES ($1, $2, 'UNDER_REVIEW', $3, $4, $5) RETURNING id;`,
    [testParcelId, zoneAdminId, JSON.stringify(initialSurveyJson), `BCS-${testParcelCode}`, initialSign]
  );
  const testReportId = repRes.rows[0].id;

  // Insert bảng survey_identification_photos
  await Database.query(
    `INSERT INTO survey_identification_photos (report_id, photo_type, photo_code, raw_photo_url, is_not_applicable)
     VALUES 
      ($1, 'P01_HOUSE_NUMBER', 'P-01', $2, false),
      ($1, 'P02_MAIN_FACADE', 'P-02', $3, false),
      ($1, 'P03_SIDE_OR_REAR', 'P-03', $4, false),
      ($1, 'P04_CONTEXT_STREET', 'P-04', $5, false);`,
    [testReportId, initialP01, initialP02, initialP03, initialP04]
  );

  // Insert bảng building_floor_plans
  await Database.query(
    `INSERT INTO building_floor_plans (parcel_id, floor_number, floor_name, cad_photo_url)
     VALUES ($1, 1, 'Tầng 1', $2);`,
    [testParcelId, initialCad]
  );

  // Insert bảng damage_zones
  const zRes = await Database.query<{ id: string }>(
    `INSERT INTO damage_zones (report_id, zone_code, floor_name, room_name, ctx_photo_url)
     VALUES ($1, 'Z-01', 'Tầng 1', 'Phòng khách', $2) RETURNING id;`,
    [testReportId, initialCtx]
  );
  const testZoneId = zRes.rows[0].id;

  // Insert bảng defect_items
  const dRes = await Database.query<{ id: string }>(
    `INSERT INTO defect_items (
       zone_id, defect_code, cu_photo_url, cu_photos_json, pin_x, pin_y,
       screening_category, defect_type, width_max_mm, length_mm,
       activity_state, material_degradation_e4, structural_significance_e2,
       has_scale_card, is_structural_critical, evolution_status, pin_color, is_deleted
     ) VALUES (
       $1, 'EC-01', $2, $3, 50, 50,
       'CRACK', 'CRACK', 0.5, 100,
       'A', 0, 0,
       true, false, 'STABLE', '#FF0000', false
     ) RETURNING id;`,
    [testZoneId, initialCu1, JSON.stringify([initialCu1, initialCu2])]
  );
  const testDefectId = dRes.rows[0].id;

  // Seed initial registry
  await AuditModificationService.seedInitialReportPhotos(testReportId);

  // Snapshot V1 đóng băng ban đầu
  const snapshotV1 = await AuditVersionService.createSnapshot(testReportId, {
    versionTag: 'ORIGINAL_SUBMISSION',
    title: 'Phiên bản V1 đầy đủ ảnh gốc ban đầu',
    userId: zoneAdminId,
  });

  console.log(`📸 Đã tạo Snapshot V1 (${snapshotV1.versionNumber}). Bắt đầu chạy 20 test cases...\n`);

  // ==============================================================================
  // 20 TEST CASES KIỂM CHỨNG TOÀN DIỆN
  // ==============================================================================

  // TC01: Xóa P-01 làm sạch CSDL quan hệ
  await runTestCase('TC01', 'Xóa P-01 đặt raw_photo_url = NULL, annotated_photo_url = NULL, is_not_applicable = true trong CSDL', async () => {
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'DELETE',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P01_HOUSE_NUMBER',
      oldPhotoUrl: initialP01,
      photoCode: 'P-01',
      reason: 'Biển số nhà bị mờ, không sử dụng cho thẩm định',
    });

    const pRow = await Database.query<{ raw_photo_url: string; is_not_applicable: boolean; na_reason: string }>(
      `SELECT raw_photo_url, is_not_applicable, na_reason FROM survey_identification_photos WHERE report_id = $1 AND photo_type = 'P01_HOUSE_NUMBER';`,
      [testReportId]
    );
    assert.strictEqual(pRow.rows[0].raw_photo_url, null, 'raw_photo_url phải là NULL');
    assert.strictEqual(pRow.rows[0].is_not_applicable, true, 'is_not_applicable phải là true');
    assert.strictEqual(pRow.rows[0].na_reason, 'Biển số nhà bị mờ, không sử dụng cho thẩm định');
  });

  // TC02: Xóa P-01 đồng bộ survey_data_json thành null và notApplicable = true
  await runTestCase('TC02', 'Xóa P-01 đồng bộ survey_data_json: url = null, notApplicable = true', async () => {
    const rep = await Database.query<{ survey_data_json: any }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    const sJson = rep.rows[0].survey_data_json;
    assert.strictEqual(sJson.photoP01.url, null, 'survey_data_json.photoP01.url phải là null');
    assert.strictEqual(sJson.photoP01.notApplicable, true, 'survey_data_json.photoP01.notApplicable phải là true');
  });

  // TC03: getSplitPaneAuditView chặn hồi sinh URL cho P-01
  await runTestCase('TC03', 'getSplitPaneAuditView không hồi sinh URL cho P-01: url, rawUrl, annotatedUrl đều là null', async () => {
    const view = await AuditReviewService.getSplitPaneAuditView(testReportId);
    const p01 = view.rightPane.identificationPhotos.photoP01;
    assert.strictEqual(p01.url, null, 'P01 url phải là null');
    assert.strictEqual(p01.rawUrl, null, 'P01 rawUrl phải là null');
    assert.strictEqual(p01.annotatedUrl, null, 'P01 annotatedUrl phải là null');
    assert.strictEqual(p01.notApplicable, true, 'P01 notApplicable phải là true');
  });

  // TC04: Xóa P-02 (Mặt đứng Facade)
  await runTestCase('TC04', 'Xóa P-02 (Facade): CSDL và View đồng bộ url = null, notApplicable = true', async () => {
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'DELETE',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P02_MAIN_FACADE',
      oldPhotoUrl: initialP02,
      photoCode: 'P-02',
      reason: 'Công trình bị che khuất hoàn toàn',
    });

    const view = await AuditReviewService.getSplitPaneAuditView(testReportId);
    const p02 = view.rightPane.identificationPhotos.photoP02;
    assert.strictEqual(p02.url, null, 'P02 url phải là null');
    assert.strictEqual(p02.notApplicable, true, 'P02 notApplicable phải là true');
  });

  // TC05: Xóa P-03 (Mặt bên/sau)
  await runTestCase('TC05', 'Xóa P-03 (Mặt bên/sau): View trả về url = null, notApplicable = true, additionalPhotos = []', async () => {
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'DELETE',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P03_SIDE_OR_REAR',
      oldPhotoUrl: initialP03,
      photoCode: 'P-03',
      reason: 'Không tiếp cận được mặt hông',
    });

    const view = await AuditReviewService.getSplitPaneAuditView(testReportId);
    const p03 = view.rightPane.identificationPhotos.photoP03;
    assert.strictEqual(p03.url, null, 'P03 url phải là null');
    assert.strictEqual(p03.notApplicable, true, 'P03 notApplicable phải là true');
    assert.deepStrictEqual(p03.additionalPhotos, [], 'additionalPhotos phải là mảng rỗng');
  });

  // TC06: Xóa P-04 (Toàn cảnh tuyến phố)
  await runTestCase('TC06', 'Xóa P-04 (Toàn cảnh tuyến phố): View trả về url = null, notApplicable = true', async () => {
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'DELETE',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P04_CONTEXT_STREET',
      oldPhotoUrl: initialP04,
      photoCode: 'P-04',
      reason: 'Hẻm cụt không có không gian tuyến phố',
    });

    const view = await AuditReviewService.getSplitPaneAuditView(testReportId);
    const p04 = view.rightPane.identificationPhotos.photoP04;
    assert.strictEqual(p04.url, null, 'P04 url phải là null');
    assert.strictEqual(p04.notApplicable, true, 'P04 notApplicable phải là true');
  });

  // TC07: Ghi sổ cái survey_photo_registry trạng thái DELETED
  await runTestCase('TC07', 'survey_photo_registry cập nhật status = DELETED, is_deleted = true, lưu vết lý do xóa', async () => {
    const regCheck = await Database.query<{ status: string; is_deleted: boolean; action_reason: string }>(
      `SELECT status, is_deleted, action_reason FROM survey_photo_registry 
       WHERE report_id = $1 AND photo_code = 'P-01' AND (photo_url = $2 OR is_deleted = true);`,
      [testReportId, initialP01]
    );
    assert(regCheck.rows.length > 0, 'Phải có bản ghi trong registry');
    const row = regCheck.rows[0];
    assert.strictEqual(row.status, 'DELETED', 'Status phải là DELETED');
    assert.strictEqual(row.is_deleted, true, 'is_deleted phải là true');
    assert.strictEqual(row.action_reason, 'Biển số nhà bị mờ, không sử dụng cho thẩm định');
  });

  // TC08: Truy vấn Lịch sử (includePhotoHistory) chứa bản ghi DELETED
  await runTestCase('TC08', 'Truy vấn lịch sử phả hệ trả về đầy đủ bản ghi đã bị xóa với flag isDeleted = true', async () => {
    const view = await AuditReviewService.getSplitPaneAuditView(testReportId, { includePhotoHistory: true });
    const p01 = view.rightPane.identificationPhotos.photoP01;
    assert(p01.history && p01.history.length > 0, 'Phải có lịch sử phiên bản');
    const deletedEntry = p01.history.find((h: any) => h.status === 'DELETED');
    assert(deletedEntry, 'Lịch sử phải chứa bản ghi DELETED');
    assert.strictEqual(deletedEntry.isDeleted, true, 'Bản ghi phải có isDeleted = true');
  });

  // TC09: Khôi phục ảnh (RESTORE) cập nhật CSDL quan hệ
  await runTestCase('TC09', 'Thực thi action RESTORE: Phục hồi raw_photo_url và đặt is_not_applicable = false', async () => {
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'RESTORE',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P01_HOUSE_NUMBER',
      newPhotoUrl: initialP01,
      photoCode: 'P-01',
      reason: 'Khôi phục lại ảnh biển số nhà theo thẩm định bổ sung',
    });

    const pRow = await Database.query<{ raw_photo_url: string; is_not_applicable: boolean; na_reason: string }>(
      `SELECT raw_photo_url, is_not_applicable, na_reason FROM survey_identification_photos WHERE report_id = $1 AND photo_type = 'P01_HOUSE_NUMBER';`,
      [testReportId]
    );
    assert.strictEqual(pRow.rows[0].raw_photo_url, initialP01, 'raw_photo_url phải được phục hồi đúng URL ban đầu');
    assert.strictEqual(pRow.rows[0].is_not_applicable, false, 'is_not_applicable phải là false');
    assert.strictEqual(pRow.rows[0].na_reason, null, 'na_reason phải là null');
  });

  // TC10: Bản ghi RESTORE trong survey_photo_registry
  await runTestCase('TC10', 'survey_photo_registry ghi nhận bản ghi mới với action_type = RESTORE, status = ACTIVE', async () => {
    const restoreReg = await Database.query<{ action_type: string; status: string }>(
      `SELECT action_type, status FROM survey_photo_registry 
       WHERE report_id = $1 AND photo_url = $2 AND action_type = 'RESTORE';`,
      [testReportId, initialP01]
    );
    assert.strictEqual(restoreReg.rows.length, 1, 'Phải có đúng 1 bản ghi action_type = RESTORE');
    assert.strictEqual(restoreReg.rows[0].status, 'ACTIVE', 'Bản ghi khôi phục phải có status = ACTIVE');
  });

  // TC11: getSplitPaneAuditView hiển thị ảnh sau khi RESTORE
  await runTestCase('TC11', 'getSplitPaneAuditView trả về ảnh đã phục hồi: url = initialP01, notApplicable = false', async () => {
    const view = await AuditReviewService.getSplitPaneAuditView(testReportId);
    const p01 = view.rightPane.identificationPhotos.photoP01;
    assert.strictEqual(p01.url, initialP01, 'P01 url phải hiển thị ảnh vừa phục hồi');
    assert.strictEqual(p01.notApplicable, false, 'P01 notApplicable phải là false');
  });

  // TC12: DEFECT_CU xóa ảnh đầu tiên trong mảng 2 ảnh -> đôn ảnh 2 lên làm primary
  await runTestCase('TC12', 'DEFECT_CU xóa ảnh 1 trong mảng 2 ảnh: đôn ảnh 2 lên primary cu_photo_url', async () => {
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'DELETE',
      category: 'DEFECT_CU',
      targetPhotoType: 'DEFECT_CU',
      targetPhotoId: testDefectId,
      oldPhotoUrl: initialCu1,
      photoCode: 'EC-01',
      reason: 'Xóa ảnh cận cảnh 1 mờ',
    });

    const dRow = await Database.query<{ cu_photo_url: string; cu_photos_json: any }>(
      `SELECT cu_photo_url, cu_photos_json FROM defect_items WHERE id = $1;`,
      [testDefectId]
    );
    assert.strictEqual(dRow.rows[0].cu_photo_url, initialCu2, 'Ảnh 2 phải được đôn lên làm cu_photo_url chính');
    const photos = Array.isArray(dRow.rows[0].cu_photos_json) ? dRow.rows[0].cu_photos_json : JSON.parse(dRow.rows[0].cu_photos_json);
    assert.deepStrictEqual(photos, [initialCu2], 'cu_photos_json chỉ còn chứa ảnh 2');
  });

  // TC13: DEFECT_CU xóa nốt ảnh duy nhất còn lại -> gán cu_photo_url = NULL (không còn ảnh ma)
  await runTestCase('TC13', 'DEFECT_CU xóa ảnh duy nhất còn lại: gán cu_photo_url = NULL và cu_photos_json = []', async () => {
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'DELETE',
      category: 'DEFECT_CU',
      targetPhotoType: 'DEFECT_CU',
      targetPhotoId: testDefectId,
      oldPhotoUrl: initialCu2,
      photoCode: 'EC-01',
      reason: 'Xóa ảnh cận cảnh 2 còn lại',
    });

    const dRow = await Database.query<{ cu_photo_url: string; cu_photos_json: any }>(
      `SELECT cu_photo_url, cu_photos_json FROM defect_items WHERE id = $1;`,
      [testDefectId]
    );
    assert(!dRow.rows[0].cu_photo_url, 'cu_photo_url phải là NULL hoặc rỗng sau khi xóa ảnh cuối cùng');
    const photos = Array.isArray(dRow.rows[0].cu_photos_json) ? dRow.rows[0].cu_photos_json : JSON.parse(dRow.rows[0].cu_photos_json);
    assert.deepStrictEqual(photos, [], 'cu_photos_json phải là mảng rỗng []');
  });

  // TC14: DEFECT_CU xóa đồng bộ vào survey_data_json.floors[].zones[].defects[]
  await runTestCase('TC14', 'DEFECT_CU xóa đồng bộ sạch vào survey_data_json.floors: cuPhotoUrl = null, cuPhotos = []', async () => {
    const rep = await Database.query<{ survey_data_json: any }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    const sJson = rep.rows[0].survey_data_json;
    const defectInJson = sJson.floors[0].zones[0].defects.find((d: any) => d.id === testDefectId || d.defectCode === 'EC-01');
    assert.strictEqual(defectInJson.cuPhotoUrl, null, 'cuPhotoUrl trong JSON phải là null');
    assert.deepStrictEqual(defectInJson.cuPhotos, [], 'cuPhotos trong JSON phải là mảng rỗng');
  });

  // TC15: CAD_FLOOR Xóa ảnh bản vẽ tầng gán cad_photo_url = NULL
  await runTestCase('TC15', 'CAD_FLOOR xóa bản vẽ tầng: building_floor_plans.cad_photo_url = NULL và sync vào survey_data_json', async () => {
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'DELETE',
      category: 'CAD_FLOOR',
      targetPhotoType: 'CAD_STRUCTURAL',
      photoIndex: 1,
      oldPhotoUrl: initialCad,
      photoCode: 'CAD',
      reason: 'Bản vẽ CAD chưa chuẩn, cần cấp mới',
    });

    const planRow = await Database.query<{ cad_photo_url: string }>(
      `SELECT cad_photo_url FROM building_floor_plans WHERE parcel_id = $1 AND floor_number = 1;`,
      [testParcelId]
    );
    assert.strictEqual(planRow.rows[0].cad_photo_url, null, 'cad_photo_url trong CSDL phải là NULL');

    const rep = await Database.query<{ survey_data_json: any }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    assert.strictEqual(rep.rows[0].survey_data_json.floors[0].cadStructuralSketchPhotoUrl, null, 'cadStructuralSketchPhotoUrl trong JSON phải là null');
  });

  // TC16: ZONE_CTX Xóa ảnh ngữ cảnh vùng hư hại gán ctx_photo_url = NULL
  await runTestCase('TC16', 'ZONE_CTX xóa ảnh ngữ cảnh: damage_zones.ctx_photo_url = NULL và sync vào survey_data_json', async () => {
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'DELETE',
      category: 'ZONE_CTX',
      targetPhotoType: 'ZONE_CTX',
      targetPhotoId: testZoneId,
      oldPhotoUrl: initialCtx,
      photoCode: 'Z-01',
      reason: 'Ảnh ngữ cảnh góc chụp bị ngược sáng',
    });

    const zoneDb = await Database.query<{ ctx_photo_url: string }>(
      `SELECT ctx_photo_url FROM damage_zones WHERE id = $1;`,
      [testZoneId]
    );
    assert(!zoneDb.rows[0].ctx_photo_url, 'ctx_photo_url trong CSDL phải là NULL hoặc rỗng');

    const rep = await Database.query<{ survey_data_json: any }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    assert.strictEqual(rep.rows[0].survey_data_json.floors[0].zones[0].ctxPhotoUrl, null, 'ctxPhotoUrl trong JSON phải là null');
  });

  // TC17: SIGNATURE Xóa chữ ký
  await runTestCase('TC17', 'SIGNATURE xóa chữ ký: surveyor_signature_url = NULL trong CSDL và survey_data_json', async () => {
    await AuditModificationService.executePhotoAction(testReportId, zoneAdminId, {
      action: 'DELETE',
      category: 'SIGNATURE',
      targetPhotoType: 'SURVEYOR_SIGNATURE',
      targetPhotoId: 'surveyor',
      oldPhotoUrl: initialSign,
      reason: 'Chữ ký KSV cần ký lại do sai thông tin',
    });

    const repRow = await Database.query<{ surveyor_signature_url: string; survey_data_json: any }>(
      `SELECT surveyor_signature_url, survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    assert.strictEqual(repRow.rows[0].surveyor_signature_url, null, 'surveyor_signature_url trong CSDL phải là NULL');
    assert.strictEqual(repRow.rows[0].survey_data_json.surveyorSignatureUrl, null, 'surveyorSignatureUrl trong JSON phải là null');
  });

  // TC18: Tính bất biến của Snapshot V1 (Snapshot bảo toàn ảnh gốc trước khi xóa)
  await runTestCase('TC18', 'Snapshot V1 chụp trước khi xóa bảo toàn 100% ảnh gốc ban đầu (Immutability)', async () => {
    const snap = await AuditVersionService.getVersionSnapshot(testReportId, snapshotV1.versionNumber);
    assert(snap, 'Phải truy vấn được Snapshot V1');
    const snapData = snap.snapshotData;
    const snapP01 = snapData.rightPane?.identificationPhotos?.photoP01?.url || snapData.surveyJson?.photoP01?.url;
    assert.strictEqual(snapP01, initialP01, 'Snapshot V1 phải giữ nguyên initialP01');
    const snapDefects = snapData.surveyJson?.floors?.[0]?.zones?.[0]?.defects;
    const snapCu = snapDefects?.[0]?.cuPhotoUrl || snapData.rightPane?.damageZones?.[0]?.defects?.[0]?.cuPhotoUrl;
    assert.strictEqual(snapCu, initialCu1, 'Snapshot V1 phải giữ nguyên initialCu1');
  });

  // TC19: Kiểm chứng Tự Lành hồ sơ thực tế C&C-05-B-0040 (43d992fa-90ce-4697-9bb4-40e2bcfcf1f9)
  await runTestCase('TC19', 'Hồ sơ thực tế C&C-05-B-0040: P-01 hoàn toàn NULL, notApplicable = true, hasHistory = true', async () => {
    const prodReportId = '43d992fa-90ce-4697-9bb4-40e2bcfcf1f9';
    const view = await AuditReviewService.getSplitPaneAuditView(prodReportId);
    const p01 = view.rightPane.identificationPhotos.photoP01;

    assert.strictEqual(p01.url, null, 'Ảnh số nhà 661 bị xóa phải không còn xuất hiện trong url');
    assert.strictEqual(p01.rawUrl, null, 'rawUrl phải là null');
    assert.strictEqual(p01.annotatedUrl, null, 'annotatedUrl phải là null');
    assert.strictEqual(p01.notApplicable, true, 'notApplicable phải là true');
    assert.strictEqual(p01.hasHistory, true, 'hasHistory phải là true để cho phép người dùng khôi phục');
  });

  // TC20: Time-Travel & Zero Data Loss qua Rollback chu kỳ
  await runTestCase('TC20', 'Time Travel: Rollback về V1 phục hồi toàn bộ ảnh -> Đảm bảo Zero Data Loss', async () => {
    // Rollback về Snapshot V1 (trước khi xóa các ảnh)
    await AuditVersionService.rollbackToVersion(testReportId, snapshotV1.versionNumber, zoneAdminId, {
      password: zoneAdminPassword,
      reason: 'Kiểm tra Time Travel: Phục hồi trạng thái trước khi xóa ảnh',
    });

    // Kiểm tra sau khi rollback, CSDL đã quay về trạng thái có ảnh
    const viewAfterRollback = await AuditReviewService.getSplitPaneAuditView(testReportId);
    assert.strictEqual(viewAfterRollback.rightPane.identificationPhotos.photoP01.url, initialP01, 'P01 phải được phục hồi về initialP01 sau khi rollback về V1');
    assert.strictEqual(viewAfterRollback.rightPane.identificationPhotos.photoP01.notApplicable, false, 'P01 notApplicable phải là false');
  });

  // ==============================================================================
  // TỔNG HỢP & DỌN DẸP
  // ==============================================================================
  console.log('\n================================================================================');
  console.log('📊 TỔNG HỢP KẾT QUẢ 20 TEST CASES DELETED PHOTO PERSISTENCE:');
  console.log('================================================================================');

  let passedCount = 0;
  for (const r of testResults) {
    if (r.passed) {
      passedCount++;
      console.log(`  ✅ ${r.code}: ${r.name} (${r.durationMs}ms)`);
    } else {
      console.log(`  ❌ ${r.code}: ${r.name} (${r.durationMs}ms) - Lỗi: ${r.error}`);
    }
  }

  console.log('--------------------------------------------------------------------------------');
  console.log(`Tổng kết: ${passedCount}/${testResults.length} test cases ĐẠT (${Math.round((passedCount / testResults.length) * 100)}%).`);

  if (passedCount === testResults.length) {
    console.log('🎉 TẤT CẢ 20 TEST CASES ĐÃ PASS 100%! LỖI ẢNH ĐÃ XÓA VẪN HIỂN THỊ ĐÃ ĐƯỢC KHẮC PHỤC TRIỆT ĐỂ.\n');
  } else {
    console.error('🚨 CÓ TEST CASES THẤT BẠI!\n');
    process.exit(1);
  }

  // Dọn dẹp dữ liệu test
  console.log('🧹 Dọn dẹp dữ liệu kiểm thử test parcel & report...');
  await Database.query(`DELETE FROM survey_photo_registry WHERE report_id = $1;`, [testReportId]);
  await Database.query(`DELETE FROM survey_identification_photos WHERE report_id = $1;`, [testReportId]);
  await Database.query(`DELETE FROM building_floor_plans WHERE parcel_id = $1;`, [testParcelId]);
  await Database.query(`DELETE FROM defect_items WHERE zone_id IN (SELECT id FROM damage_zones WHERE report_id = $1);`, [testReportId]);
  await Database.query(`DELETE FROM damage_zones WHERE report_id = $1;`, [testReportId]);
  await Database.query(`DELETE FROM survey_report_versions WHERE report_id = $1;`, [testReportId]);
  await Database.query(`DELETE FROM base_survey_reports WHERE id = $1;`, [testReportId]);
  await Database.query(`DELETE FROM parcels WHERE id = $1;`, [testParcelId]);
  console.log('✨ Dọn dẹp hoàn tất.');

  process.exit(0);
}

main().catch((err) => {
  console.error('Lỗi nghiêm trọng khi thực thi suite kiểm thử:', err);
  process.exit(1);
});
