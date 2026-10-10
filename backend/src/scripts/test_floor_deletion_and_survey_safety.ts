import { Database } from '../database/db';
import { CadastralRepository } from '../modules/cadastral/cadastral.repository';
import { CadastralService } from '../modules/cadastral/cadastral.service';

async function runTests() {
  console.log('🚀 [START TEST SUITE] Floor Deletion & Survey Safety Guard Tests');

  let testParcelAId = '';
  let testParcelBId = '';

  try {
    // 0. Chuẩn bị 2 chung cư mẫu: Chung Cư A và Chung Cư B
    const createParcelA = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        project_parcel_code, official_cadastral_code, house_number, street,
        zone_id, land_area_m2, construction_area_m2, floor_count, building_type,
        location_geom, cadastral_polygon_geom, footprint_polygon_geom
      ) VALUES (
        'TEST-CONDO-A', 'TP-01-A', '100', 'Cách Mạng Tháng 8',
        'ZONE_01', 500, 400, 8, 'CONDOMINIUM',
        ST_SetSRID(ST_MakePoint(106.68, 10.77), 4326),
        ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(106.68 10.77, 106.69 10.77, 106.69 10.78, 106.68 10.78, 106.68 10.77)')), 4326),
        ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(106.68 10.77, 106.69 10.77, 106.69 10.78, 106.68 10.78, 106.68 10.77)')), 4326)
      ) RETURNING id;`
    );
    testParcelAId = createParcelA.rows[0].id;

    const createParcelB = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        project_parcel_code, official_cadastral_code, house_number, street,
        zone_id, land_area_m2, construction_area_m2, floor_count, building_type,
        location_geom, cadastral_polygon_geom, footprint_polygon_geom
      ) VALUES (
        'TEST-CONDO-B', 'TP-01-B', '200', 'Điện Biên Phủ',
        'ZONE_01', 600, 450, 8, 'CONDOMINIUM',
        ST_SetSRID(ST_MakePoint(106.70, 10.79), 4326),
        ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(106.70 10.79, 106.71 10.79, 106.71 10.80, 106.70 10.80, 106.70 10.79)')), 4326),
        ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(106.70 10.79, 106.71 10.79, 106.71 10.80, 106.70 10.80, 106.70 10.79)')), 4326)
      ) RETURNING id;`
    );
    testParcelBId = createParcelB.rows[0].id;

    console.log(`✅ [SETUP] Created Condo A (${testParcelAId}) and Condo B (${testParcelBId})`);

    // Tạo các căn hộ trên Chung cư A: Tầng 6, 7, 8
    // Tầng 6: 06.01 (Chưa khảo sát)
    // Tầng 7: 07.01, 07.02 (ĐÃ KHẢO SÁT 2 CĂN - status = 'SUBMITTED' hoặc 'APPROVED')
    // Tầng 8: 08.01, 08.02 (ĐÃ KHẢO SÁT 2 CĂN)
    await Database.query(`
      INSERT INTO building_units (parcel_id, unit_code, floor_number, status)
      VALUES 
        ('${testParcelAId}', 'P.601', 6, 'NOT_SURVEYED'),
        ('${testParcelAId}', 'P.701', 7, 'SUBMITTED'),
        ('${testParcelAId}', 'P.702', 7, 'APPROVED'),
        ('${testParcelAId}', 'P.801', 8, 'APPROVED'),
        ('${testParcelAId}', 'P.802', 8, 'SUBMITTED');
    `);

    // Tạo các căn hộ trên Chung cư B: Tầng 7 có 2 căn
    await Database.query(`
      INSERT INTO building_units (parcel_id, unit_code, floor_number, status)
      VALUES 
        ('${testParcelBId}', 'B.701', 7, 'APPROVED'),
        ('${testParcelBId}', 'B.702', 7, 'NOT_SURVEYED');
    `);

    // Tạo floor plans cho Tầng 7 trên cả 2 tòa
    await CadastralRepository.upsertFloorPlan({
      parcelId: testParcelAId,
      floorNumber: 7,
      floorName: 'Tầng 7 Chung Cư A',
      cadPhotoUrl: 'https://example.com/cad_a_7.png',
    });

    await CadastralRepository.upsertFloorPlan({
      parcelId: testParcelBId,
      floorNumber: 7,
      floorName: 'Tầng 7 Chung Cư B',
      cadPhotoUrl: 'https://example.com/cad_b_7.png',
    });

    // -------------------------------------------------------------
    // TEST 1: RÀO CHẮN BẢO VỆ PHÁP LÝ (Safety Guard)
    // Nếu Tầng 7 đã có 2 căn khảo sát, gọi DELETE_FLOOR PHẢI BỊ CHẶN!
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Thử xóa cả Tầng 7 khi có 2 căn đã khảo sát (Kỳ vọng: PHẢI BỊ CHẶN) ---');
    let test1Passed = false;
    try {
      await CadastralService.deleteFloorPlan(testParcelAId, 7, 'DELETE_FLOOR');
    } catch (err: any) {
      if (err.message && err.message.includes('Không thể xóa Tầng 7') && err.message.includes('2 căn hộ')) {
        test1Passed = true;
        console.log(`✅ [TEST 1 ĐẠT] Hệ thống đã chặn thành công: "${err.message}"`);
      } else {
        console.error('❌ [TEST 1 THẤT BẠI] Nhận được lỗi không mong đợi:', err);
      }
    }
    if (!test1Passed) {
      throw new Error('Test 1 Thất bại: Hệ thống không chặn thao tác xóa tầng khi có căn hộ đã khảo sát!');
    }

    // -------------------------------------------------------------
    // TEST 2: XÓA BẢN VẼ CAD (CLEAR_CAD) ĐỂ NẠP LẠI THÔNG TIN
    // Khi chọn CLEAR_CAD trên Tầng 7: Bản vẽ CAD bị gỡ, nhưng 2 căn khảo sát VẪN CÒN NGUYÊN
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Xóa bản vẽ CAD (CLEAR_CAD) để tải lại thông tin ---');
    const clearResult = await CadastralService.deleteFloorPlan(testParcelAId, 7, 'CLEAR_CAD');
    console.log(`Result: ${clearResult.message}`);

    const unitsA7 = await Database.query(
      `SELECT unit_code, status, floor_number FROM building_units WHERE parcel_id = $1 AND floor_number = 7 ORDER BY unit_code;`,
      [testParcelAId]
    );
    if (unitsA7.rows.length !== 2 || unitsA7.rows[0].unit_code !== 'P.701' || unitsA7.rows[1].unit_code !== 'P.702') {
      throw new Error('Test 2 Thất bại: 2 căn khảo sát của Tầng 7 bị mất!');
    }
    console.log(`✅ [TEST 2 ĐẠT] 2 căn hộ đã khảo sát P.701, P.702 được BẢO TOÀN NGUYÊN VẸN 100%!`);

    // -------------------------------------------------------------
    // TEST 3: NGUYÊN TẮC BẤT BIẾN: TẦNG 8 KHÔNG BAO GIỜ BỊ ĐỔI THÀNH TẦNG 7
    // Kiểm tra các căn hộ tầng 8: Vẫn là floor_number = 8, unit_code = P.801, P.802
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Kiểm tra Tầng 8 có bị biến thành Tầng 7 hay không ---');
    const unitsA8 = await Database.query(
      `SELECT unit_code, status, floor_number FROM building_units WHERE parcel_id = $1 AND floor_number = 8 ORDER BY unit_code;`,
      [testParcelAId]
    );
    if (unitsA8.rows.length !== 2 || unitsA8.rows[0].floor_number !== 8 || unitsA8.rows[1].floor_number !== 8) {
      throw new Error('Test 3 Thất bại: Tầng 8 đã bị dồn hoặc thay đổi số tầng!');
    }
    console.log(`✅ [TEST 3 ĐẠT] Tầng 8 GIỮ NGUYÊN 100% là Tầng 8 (P.801, P.802), không hề bị dồn số!`);

    // -------------------------------------------------------------
    // TEST 4: TÍNH CÁCH LY GIỮA 2 CHUNG CƯ KHÁC NHAU (CROSS-CONDO ISOLATION)
    // Kiểm tra Chung Cư B: Tầng 7 của Chung Cư B hoàn toàn không bị ảnh hưởng
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Kiểm tra tính cách ly giữa Chung Cư A và Chung Cư B ---');
    const unitsB7 = await Database.query(
      `SELECT unit_code, status, floor_number FROM building_units WHERE parcel_id = $1 AND floor_number = 7 ORDER BY unit_code;`,
      [testParcelBId]
    );
    const plansB7 = await Database.query(
      `SELECT floor_number, floor_name, cad_photo_url FROM building_floor_plans WHERE parcel_id = $1 AND floor_number = 7;`,
      [testParcelBId]
    );

    if (unitsB7.rows.length !== 2 || plansB7.rows.length !== 1) {
      throw new Error('Test 4 Thất bại: Dữ liệu Chung Cư B bị ảnh hưởng khi thao tác ở Chung Cư A!');
    }
    console.log(`✅ [TEST 4 ĐẠT] Chung Cư B còn nguyên 100% CAD và 2 căn hộ (B.701, B.702), cách ly dữ liệu an toàn tuyệt đối!`);

    // -------------------------------------------------------------
    // TEST 5: XÓA HẲN TẦNG CHƯA KHẢO SÁT (TẦNG 6) & NẠP LẠI (RE-ADD)
    // Tầng 6 chỉ có căn nháp P.601 (chưa khảo sát) -> Được phép xóa hẳn
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Xóa hẳn Tầng 6 chưa khảo sát và nạp lại ---');
    const delete6Result = await CadastralService.deleteFloorPlan(testParcelAId, 6, 'DELETE_FLOOR');
    console.log(`Result: ${delete6Result.message}`);

    const parcelCheck = await CadastralRepository.findById(testParcelAId);
    if (!parcelCheck?.deleted_floors || !parcelCheck.deleted_floors.includes(6)) {
      throw new Error('Test 5 Thất bại: Tầng 6 không được ghi nhận vào deleted_floors!');
    }
    console.log(`✅ [TEST 5.1 ĐẠT] Tầng 6 đã được ghi nhận vào deleted_floors: [${parcelCheck.deleted_floors.join(', ')}]`);

    // Nạp lại Tầng 6
    await CadastralRepository.restoreFloor(testParcelAId, 6);
    const parcelRestored = await CadastralRepository.findById(testParcelAId);
    if (parcelRestored?.deleted_floors && parcelRestored.deleted_floors.includes(6)) {
      throw new Error('Test 5 Thất bại: Tầng 6 chưa được gỡ khỏi deleted_floors sau khi nạp lại!');
    }
    console.log(`✅ [TEST 5.2 ĐẠT] Tầng 6 đã được nạp lại sạch sẽ, gỡ khỏi deleted_floors!`);

    console.log('\n🎉 TẤT CẢ 5 TEST CASE ĐỀU ĐẠT 100%!');
  } finally {
    // Dọn dẹp dữ liệu test
    if (testParcelAId) {
      await Database.query(`DELETE FROM building_units WHERE parcel_id = $1;`, [testParcelAId]);
      await Database.query(`DELETE FROM building_floor_plans WHERE parcel_id = $1;`, [testParcelAId]);
      await Database.query(`DELETE FROM parcels WHERE id = $1;`, [testParcelAId]);
    }
    if (testParcelBId) {
      await Database.query(`DELETE FROM building_units WHERE parcel_id = $1;`, [testParcelBId]);
      await Database.query(`DELETE FROM building_floor_plans WHERE parcel_id = $1;`, [testParcelBId]);
      await Database.query(`DELETE FROM parcels WHERE id = $1;`, [testParcelBId]);
    }
    const { pool } = await import('../database/db');
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
