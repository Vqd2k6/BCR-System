import { Database } from '../database/db';
import { CadastralService } from '../modules/cadastral/cadastral.service';

async function runTests() {
  console.log('🚀 [START TEST SUITE] Unit/Master CAD Spatial Geometry Swap Tests');

  let testParcelId = '';
  let unitAId = '';
  let unitBId = '';
  let reportAId = '';

  try {
    // 1. Tạo chung cư mẫu
    const createParcel = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        project_parcel_code, official_cadastral_code, house_number, street,
        zone_id, land_area_m2, construction_area_m2, floor_count, building_type,
        location_geom, cadastral_polygon_geom, footprint_polygon_geom
      ) VALUES (
        'TEST-SWAP-CONDO', 'SWAP-01', '999', 'Nguyễn Thị Minh Khai',
        'ZONE_01', 800, 600, 10, 'CONDOMINIUM',
        ST_SetSRID(ST_MakePoint(106.68, 10.77), 4326),
        ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(106.68 10.77, 106.69 10.77, 106.69 10.78, 106.68 10.78, 106.68 10.77)')), 4326),
        ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(106.68 10.77, 106.69 10.77, 106.69 10.78, 106.68 10.78, 106.68 10.77)')), 4326)
      ) RETURNING id;`
    );
    testParcelId = createParcel.rows[0].id;
    console.log(`✅ [SETUP] Created Test Condo (${testParcelId})`);

    // 2. Tạo 2 vị trí trên Tầng 2: Unit A và Master B
    const bboxA = { x: 10, y: 15, width: 20, height: 25 };
    const polyA = [{ x: 10, y: 15 }, { x: 30, y: 15 }, { x: 30, y: 40 }, { x: 10, y: 40 }];
    const urlA = 'https://r2.test/unit_a_cad.jpg';

    const bboxB = { x: 55, y: 60, width: 35, height: 30 };
    const polyB = [{ x: 55, y: 60 }, { x: 90, y: 60 }, { x: 90, y: 90 }, { x: 55, y: 90 }];
    const urlB = 'https://r2.test/master_b_cad.jpg';

    const resA = await Database.query<{ id: string }>(
      `INSERT INTO building_units (
        parcel_id, unit_code, display_code, unit_type, floor_number,
        cad_bbox, cad_polygon, unit_cad_url, status, owner_name
      ) VALUES ($1, 'U-201', 'Phòng 201', 'UNIT', 2, $2, $3, $4, 'SUBMITTED', 'Nguyễn Văn A')
      RETURNING id;`,
      [testParcelId, JSON.stringify(bboxA), JSON.stringify(polyA), urlA]
    );
    unitAId = resA.rows[0].id;

    const resB = await Database.query<{ id: string }>(
      `INSERT INTO building_units (
        parcel_id, unit_code, display_code, unit_type, floor_number,
        cad_bbox, cad_polygon, unit_cad_url, status, owner_name
      ) VALUES ($1, 'M-201', 'Sảnh Thang Máy T2', 'MASTER', 2, $2, $3, $4, 'NOT_SURVEYED', 'BQL Tòa Nhà')
      RETURNING id;`,
      [testParcelId, JSON.stringify(bboxB), JSON.stringify(polyB), urlB]
    );
    unitBId = resB.rows[0].id;

    console.log(`✅ [SETUP] Created Unit A (${unitAId}, U-201) and Master B (${unitBId}, M-201)`);

    // Lấy 1 surveyor_id hợp lệ từ users
    const userRes = await Database.query<{ id: string }>(`SELECT id FROM users LIMIT 1;`);
    const validSurveyorId = userRes.rows[0]?.id;

    // 3. Tạo báo cáo khảo sát đính kèm cho Unit A
    const repRes = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
        parcel_id, surveyor_id, unit_id, report_code, phase, status, survey_data_json
      ) VALUES ($1, $2, $3, 'BCS-U201-TEST', 'PHASE_1', 'SUBMITTED', $4)
      RETURNING id;`,
      [
        testParcelId,
        validSurveyorId,
        unitAId,
        JSON.stringify({
          unitCode: 'U-201',
          cadBbox: bboxA,
          cadPolygon: polyA,
          unitCadUrl: urlA,
          notes: 'Test survey data for Unit A',
        }),
      ]
    );
    reportAId = repRes.rows[0].id;

    // Gắn phase1_report_id cho Unit A
    await Database.query(`UPDATE building_units SET phase1_report_id = $1 WHERE id = $2;`, [
      reportAId,
      unitAId,
    ]);

    console.log(`✅ [SETUP] Created attached report (${reportAId}) for Unit A`);

    // 4. KIỂM THỬ: Thực hiện hoán đổi tọa độ CAD giữa Unit A và Master B
    console.log('\n📌 [TEST 1] Gọi CadastralService.swapUnitCadGeometries...');
    const swapResult = await CadastralService.swapUnitCadGeometries(
      testParcelId,
      unitAId,
      unitBId,
      { userId: validSurveyorId, role: 'ZONE_ADMIN', assignedZoneId: 'ZONE_01' },
      'KSV ấn nhầm vị trí căn hộ sang khu vực dùng chung',
      '127.0.0.1'
    );

    console.log('   Message:', swapResult.message);
    console.log('   SwapEventCode:', swapResult.swapEventCode);

    // 5. Xác minh dữ liệu trong building_units
    console.log('\n📌 [TEST 2] Kiểm tra tính đúng đắn của toạ độ sau hoán đổi trong building_units...');
    const checkA = await Database.query<{
      unit_code: string;
      display_code: string;
      unit_type: string;
      cad_bbox: { x: number; y: number; width: number; height: number };
      cad_polygon: { x: number; y: number }[];
      unit_cad_url: string;
      owner_name: string;
      phase1_report_id: string;
    }>(`SELECT * FROM building_units WHERE id = $1;`, [unitAId]);

    const checkB = await Database.query<{
      unit_code: string;
      display_code: string;
      unit_type: string;
      cad_bbox: { x: number; y: number; width: number; height: number };
      cad_polygon: { x: number; y: number }[];
      unit_cad_url: string;
      owner_name: string;
    }>(`SELECT * FROM building_units WHERE id = $1;`, [unitBId]);

    const unitAAfter = checkA.rows[0];
    const unitBAfter = checkB.rows[0];

    // Xác nhận Unit A giữ nguyên mã, chủ hộ, report_id nhưng nhận tọa độ của B
    if (unitAAfter.unit_code !== 'U-201' || unitAAfter.display_code !== 'Phòng 201' || unitAAfter.owner_name !== 'Nguyễn Văn A') {
      throw new Error(`❌ FAIL: Unit A metadata bị thay đổi! unit_code=${unitAAfter.unit_code}`);
    }
    if (unitAAfter.cad_bbox.x !== bboxB.x || unitAAfter.unit_cad_url !== urlB) {
      throw new Error(`❌ FAIL: Unit A chưa nhận được tọa độ của B! x=${unitAAfter.cad_bbox.x}`);
    }
    console.log('   ✅ [PASS] Unit A: Giữ nguyên mã U-201 & metadata, đã nhận toạ độ CAD của B (x=55, url=master_b_cad.jpg)');

    // Xác nhận Master B giữ nguyên mã M-201 nhưng nhận tọa độ của A
    if (unitBAfter.unit_code !== 'M-201' || unitBAfter.display_code !== 'Sảnh Thang Máy T2' || unitBAfter.unit_type !== 'MASTER') {
      throw new Error(`❌ FAIL: Master B metadata bị thay đổi! unit_code=${unitBAfter.unit_code}`);
    }
    if (unitBAfter.cad_bbox.x !== bboxA.x || unitBAfter.unit_cad_url !== urlA) {
      throw new Error(`❌ FAIL: Master B chưa nhận được tọa độ của A! x=${unitBAfter.cad_bbox.x}`);
    }
    console.log('   ✅ [PASS] Master B: Giữ nguyên mã M-201 & loại MASTER, đã nhận toạ độ CAD của A (x=10, url=unit_a_cad.jpg)');

    // 6. Kiểm tra đồng bộ trong base_survey_reports
    console.log('\n📌 [TEST 3] Kiểm tra đồng bộ tọa độ mới vào base_survey_reports.survey_data_json...');
    const reportCheck = await Database.query<{ survey_data_json: { cadBbox: { x: number }; cadPolygon: unknown; unitCadUrl: string } }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [reportAId]
    );
    const repData = reportCheck.rows[0].survey_data_json;
    if (repData.cadBbox.x !== bboxB.x || repData.unitCadUrl !== urlB) {
      throw new Error(`❌ FAIL: Báo cáo khảo sát chưa được cập nhật tọa độ CAD mới! repX=${repData.cadBbox.x}`);
    }
    console.log('   ✅ [PASS] Báo cáo khảo sát Unit A: survey_data_json tự động đồng bộ sang tọa độ B mới');

    // 7. Kiểm tra system_audit_logs
    console.log('\n📌 [TEST 4] Kiểm tra nhật ký kiểm toán system_audit_logs...');
    const auditCheck = await Database.query<{ action: string; diff_payload: { reason: string; swapEventCode: string } }>(
      `SELECT action, diff_payload FROM system_audit_logs WHERE action = 'UNIT_CAD_SPATIAL_SWAP' AND entity_id = $1 ORDER BY created_at DESC LIMIT 1;`,
      [unitAId]
    );
    if (auditCheck.rows.length === 0) {
      throw new Error('❌ FAIL: Không tìm thấy bản ghi kiểm toán trong system_audit_logs!');
    }
    console.log('   Audit Action:', auditCheck.rows[0].action);
    console.log('   Audit Reason:', auditCheck.rows[0].diff_payload.reason);
    console.log('   ✅ [PASS] Đã ghi nhận bản ghi kiểm toán pháp lý hoàn chỉnh vào system_audit_logs');

    console.log('\n🎉 TẤT CẢ 4 BÀI TEST HOÁN ĐỔI TỌA ĐỘ CAD ĐỀU VƯỢT QUA 100%!');
  } catch (error) {
    console.error('❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', error);
    process.exitCode = 1;
  } finally {
    // Dọn dẹp dữ liệu test
    if (reportAId) {
      await Database.query(`DELETE FROM base_survey_reports WHERE id = $1;`, [reportAId]);
    }
    if (unitAId || unitBId) {
      await Database.query(`DELETE FROM building_units WHERE id IN ($1, $2);`, [unitAId, unitBId]);
    }
    if (testParcelId) {
      await Database.query(`DELETE FROM parcels WHERE id = $1;`, [testParcelId]);
      await Database.query(`DELETE FROM system_audit_logs WHERE entity_id = $1;`, [unitAId]);
    }
    console.log('🧹 [CLEANUP] Đã dọn dẹp sạch sẽ dữ liệu kiểm thử.');
  }
}

runTests().then(() => {
  process.exit(process.exitCode || 0);
});
