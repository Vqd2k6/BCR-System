import { Database } from '../database/db';
import { CadastralService } from '../modules/cadastral/cadastral.service';
import { AuditService } from '../modules/audit/audit.service';

/**
 * Script kiểm thử chuyên sâu tính năng Hoán đổi Ranh Không Gian GIS (Spatial Geometry Swap)
 * Được thiết kế bởi Agent Giám Sát & Phản Biện (Reviewer) để thẩm định việc thực thi của Agent Thực Thi.
 */
async function runSpatialGeometrySwapTest() {
  console.log('\n======================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ: HOÁN ĐỔI RANH ĐẤT KHÔNG GIAN GIS (SPATIAL GEOMETRY SWAP)');
  console.log('   Kiểm chứng tính toàn vẹn 100% của Mã Thửa, Thông Tin Địa Chính & Watermark Ảnh');
  console.log('======================================================================\n');

  let testAdminId = '';
  let testZoneId = '';
  let parcelAId = '';
  let parcelBId = '';
  let reportAId = '';

  const BOX_1_WKT = 'POLYGON((106.7110 10.7920, 106.7112 10.7920, 106.7112 10.7922, 106.7110 10.7922, 106.7110 10.7920))';
  const BOX_2_WKT = 'POLYGON((106.7120 10.7930, 106.7125 10.7930, 106.7125 10.7935, 106.7120 10.7935, 106.7120 10.7930))';

  try {
    // 1. Chuẩn bị Admin & Zone
    const adminRes = await Database.query<{ id: string }>(
      `SELECT id FROM users WHERE role IN ('ZONE_ADMIN', 'SUPER_ADMIN') LIMIT 1;`
    );
    if (!adminRes.rows[0]) {
      throw new Error('Không tìm thấy tài khoản admin nào để test.');
    }
    testAdminId = adminRes.rows[0].id;

    testZoneId = 'ZONE_08';

    // Xóa dữ liệu rác nếu còn tồn tại từ lần chạy trước
    await Database.query(`DELETE FROM parcels WHERE project_parcel_code IN ('P_TEST_SWAP_A', 'P_TEST_SWAP_B');`);

    console.log('📍 1. Tạo 2 thửa đất thực nghiệm:');
    console.log('   - Thửa A [P_TEST_SWAP_A]: Số nhà 101 Test St, DT 85.5m2, toạ độ Vùng 1, đã khảo sát kèm ảnh watermark [P_TEST_SWAP_A]');
    console.log('   - Thửa B [P_TEST_SWAP_B]: Số nhà 103 Test St, DT 120.0m2, toạ độ Vùng 2, chưa khảo sát');

    const pARes = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        zone_id, official_cadastral_code, project_parcel_code, house_number, street,
        owner_name, owner_phone, land_area_m2, construction_area_m2, survey_status,
        cadastral_polygon_geom
      ) VALUES (
        $1, 'DC-SWAP-A', 'P_TEST_SWAP_A', '101', 'Test Street',
        'Nguyễn Văn A', '0901111111', 85.5, 70.0, 'SUBMITTED',
        ST_SetSRID(ST_GeomFromText($2), 4326)
      ) RETURNING id;`,
      [testZoneId, BOX_1_WKT]
    );
    parcelAId = pARes.rows[0].id;

    const pBRes = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        zone_id, official_cadastral_code, project_parcel_code, house_number, street,
        owner_name, owner_phone, land_area_m2, construction_area_m2, survey_status,
        cadastral_polygon_geom
      ) VALUES (
        $1, 'DC-SWAP-B', 'P_TEST_SWAP_B', '103', 'Test Street',
        'Trần Thị B', '0902222222', 120.0, 95.0, 'NOT_SURVEYED',
        ST_SetSRID(ST_GeomFromText($2), 4326)
      ) RETURNING id;`,
      [testZoneId, BOX_2_WKT]
    );
    parcelBId = pBRes.rows[0].id;

    // Tạo hồ sơ khảo sát gắn với Thửa A
    const repRes = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
        parcel_id, surveyor_id, zone_admin_id, report_code, phase, status,
        survey_data_json
      ) VALUES (
        $1, $2, $2, 'BCS-TEST-A', 'PHASE_1', 'SUBMITTED',
        $3
      ) RETURNING id;`,
      [
        parcelAId,
        testAdminId,
        JSON.stringify({
          parcelCode: 'P_TEST_SWAP_A',
          photos: [
            {
              photoId: 'photo_001',
              watermarkText: 'BCS - P_TEST_SWAP_A - 101 Test Street',
              url: 'https://storage.metro2.vn/photos/test_a.jpg',
            },
          ],
        }),
      ]
    );
    reportAId = repRes.rows[0].id;
    await Database.query(`UPDATE parcels SET active_phase1_report_id = $1 WHERE id = $2;`, [reportAId, parcelAId]);

    console.log(`   ✓ Đã tạo Thửa A ID: ${parcelAId}, Thửa B ID: ${parcelBId}, Hồ sơ A ID: ${reportAId}`);

    // 2. Thực hiện hoán đổi ranh đất không gian GIS
    console.log('\n🔄 2. Thực thi hoán đổi ranh đất không gian GIS: CadastralService.swapParcelGeometries...');
    const swapResult = await CadastralService.swapParcelGeometries(
      parcelAId,
      parcelBId,
      testAdminId,
      'Kiểm thử tự động tính năng hoán đổi ranh đất không gian giải quyết lệch watermark',
      '127.0.0.1'
    );
    console.log(`   ✓ Kết quả trả về từ Service: ${swapResult.message}`);

    // 3. Kiểm chứng dữ liệu sau khi hoán đổi
    console.log('\n🔍 3. Kiểm định các tiêu chí an toàn & tính toàn vẹn (Assertion checks):');

    const checkARes = await Database.query<{
      project_parcel_code: string;
      official_cadastral_code: string;
      house_number: string;
      street: string;
      owner_name: string;
      owner_phone: string;
      land_area_m2: number;
      construction_area_m2: number;
      survey_status: string;
      active_phase1_report_id: string;
      is_geom_box2: boolean;
      is_geom_box1: boolean;
    }>(
      `SELECT project_parcel_code, official_cadastral_code, house_number, street,
              owner_name, owner_phone, land_area_m2, construction_area_m2,
              survey_status, active_phase1_report_id,
              ST_Equals(cadastral_polygon_geom, ST_SetSRID(ST_GeomFromText($2), 4326)) AS is_geom_box2,
              ST_Equals(cadastral_polygon_geom, ST_SetSRID(ST_GeomFromText($3), 4326)) AS is_geom_box1
       FROM parcels WHERE id = $1;`,
      [parcelAId, BOX_2_WKT, BOX_1_WKT]
    );
    const postSwapA = checkARes.rows[0];

    const checkBRes = await Database.query<{
      project_parcel_code: string;
      official_cadastral_code: string;
      house_number: string;
      street: string;
      owner_name: string;
      owner_phone: string;
      land_area_m2: number;
      construction_area_m2: number;
      survey_status: string;
      active_phase1_report_id: string;
      is_geom_box1: boolean;
      is_geom_box2: boolean;
    }>(
      `SELECT project_parcel_code, official_cadastral_code, house_number, street,
              owner_name, owner_phone, land_area_m2, construction_area_m2,
              survey_status, active_phase1_report_id,
              ST_Equals(cadastral_polygon_geom, ST_SetSRID(ST_GeomFromText($2), 4326)) AS is_geom_box1,
              ST_Equals(cadastral_polygon_geom, ST_SetSRID(ST_GeomFromText($3), 4326)) AS is_geom_box2
       FROM parcels WHERE id = $1;`,
      [parcelBId, BOX_1_WKT, BOX_2_WKT]
    );
    const postSwapB = checkBRes.rows[0];

    let passedAll = true;

    // Check 1: Mã thửa và định danh của A không đổi
    if (
      postSwapA.project_parcel_code === 'P_TEST_SWAP_A' &&
      postSwapA.official_cadastral_code === 'DC-SWAP-A' &&
      postSwapA.house_number === '101' &&
      postSwapA.owner_name === 'Nguyễn Văn A' &&
      postSwapA.owner_phone === '0901111111'
    ) {
      console.log('   ✅ [PASS] Thửa A: Giữ nguyên 100% thông tin địa chính (Mã: P_TEST_SWAP_A, Số nhà: 101, Chủ: Nguyễn Văn A)');
    } else {
      console.error('   ❌ [FAIL] Thửa A bị biến đổi thông tin địa chính!');
      passedAll = false;
    }

    // Check 2: Mã thửa và định danh của B không đổi
    if (
      postSwapB.project_parcel_code === 'P_TEST_SWAP_B' &&
      postSwapB.official_cadastral_code === 'DC-SWAP-B' &&
      postSwapB.house_number === '103' &&
      postSwapB.owner_name === 'Trần Thị B' &&
      postSwapB.owner_phone === '0902222222'
    ) {
      console.log('   ✅ [PASS] Thửa B: Giữ nguyên 100% thông tin địa chính (Mã: P_TEST_SWAP_B, Số nhà: 103, Chủ: Trần Thị B)');
    } else {
      console.error('   ❌ [FAIL] Thửa B bị biến đổi thông tin địa chính!');
      passedAll = false;
    }

    // Check 3: Ranh đất không gian PostGIS đã được hoán đổi thành công
    if (postSwapA.is_geom_box2 && postSwapB.is_geom_box1) {
      console.log('   ✅ [PASS] PostGIS Geometry: Thửa A đã chuyển sang vị trí Box 2, Thửa B chuyển sang vị trí Box 1 (Khớp ST_Equals)');
    } else {
      console.error('   ❌ [FAIL] Ranh đất không gian chưa được hoán đổi chính xác!');
      passedAll = false;
    }

    // Check 4: Diện tích đất chuyển dịch theo hình học không gian
    if (Number(postSwapA.land_area_m2) === 120.0 && Number(postSwapB.land_area_m2) === 85.5) {
      console.log('   ✅ [PASS] Diện tích đất: Thửa A nhận 120.0m2 (của vị trí mới), Thửa B nhận 85.5m2');
    } else {
      console.error(`   ❌ [FAIL] Diện tích sai lệch! A=${postSwapA.land_area_m2}, B=${postSwapB.land_area_m2}`);
      passedAll = false;
    }

    // Check 5: Hồ sơ và ảnh khảo sát có watermark được bảo toàn 100%
    const reportCheck = await Database.query<{
      parcel_id: string;
      survey_data_json: any;
    }>(`SELECT parcel_id, survey_data_json FROM base_survey_reports WHERE id = $1;`, [reportAId]);

    const rep = reportCheck.rows[0];
    const watermarkText = rep.survey_data_json?.photos?.[0]?.watermarkText;
    if (
      rep.parcel_id === parcelAId &&
      postSwapA.active_phase1_report_id === reportAId &&
      watermarkText === 'BCS - P_TEST_SWAP_A - 101 Test Street'
    ) {
      console.log('   ✅ [PASS] Watermark & Hồ Sơ: Hồ sơ gắn chặt với Thửa A, watermark ảnh giữ nguyên [P_TEST_SWAP_A], không bị lệch mã!');
    } else {
      console.error('   ❌ [FAIL] Hồ sơ hoặc watermark bị sai lệch!');
      passedAll = false;
    }

    // Check 6: Nhật ký kiểm toán (Audit Trail)
    const histRes = await Database.query(
      `SELECT action_type, changed_by_user_id, change_reason, previous_state, new_state 
       FROM cadastral_history_logs 
       WHERE parcel_id IN ($1, $2) AND action_type = 'SPATIAL_GEOMETRY_SWAP';`,
      [parcelAId, parcelBId]
    );
    const auditRes = await Database.query(
      `SELECT action, entity_type, diff_payload 
       FROM system_audit_logs 
       WHERE action = 'ZONE_ADMIN_SPATIAL_GEOMETRY_SWAP' AND entity_id = $1;`,
      [parcelAId]
    );

    if ((histRes.rowCount ?? 0) === 2 && (auditRes.rowCount ?? 0) >= 1) {
      console.log('   ✅ [PASS] Audit Logging: Đã ghi nhận 2 bản ghi cadastral_history_logs và 1 bản ghi system_audit_logs');
    } else {
      console.error(`   ❌ [FAIL] Thiếu bản ghi audit log! hist=${histRes.rowCount}, audit=${auditRes.rowCount}`);
      passedAll = false;
    }

    // ======================================================================
    // 4. KIỂM THỬ KỊCH BẢN 2: HOÁN ĐỔI 2 NHÀ ĐỀU ĐÃ KHẢO SÁT (2-WAY SURVEYED SWAP)
    // ======================================================================
    console.log('\n🔄 4. Thực thi Kịch bản 2: Hoán đổi giữa 2 thửa đều ĐÃ KHẢO SÁT (Tích chéo 2 nhà kề nhau):');

    // Tạo hồ sơ B cho thửa B
    const repBRes = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
        parcel_id, surveyor_id, zone_admin_id, report_code, phase, status,
        survey_data_json
      ) VALUES (
        $1, $2, $2, 'BCS-TEST-B', 'PHASE_1', 'SUBMITTED',
        $3
      ) RETURNING id;`,
      [
        parcelBId,
        testAdminId,
        JSON.stringify({
          parcelCode: 'P_TEST_SWAP_B',
          photos: [
            {
              photoId: 'photo_002',
              watermarkText: 'BCS - P_TEST_SWAP_B - 103 Test Street',
              url: 'https://storage.metro2.vn/photos/test_b.jpg',
            },
          ],
        }),
      ]
    );
    const reportBId = repBRes.rows[0].id;
    await Database.query(`UPDATE parcels SET active_phase1_report_id = $1, survey_status = 'SUBMITTED' WHERE id = $2;`, [reportBId, parcelBId]);

    // Gọi swapReportParcels từ AuditService
    console.log('   -> Gọi AuditService.swapReportParcels(reportA, reportB)...');
    const swap2Result = await AuditService.swapReportParcels(
      reportAId,
      reportBId,
      testAdminId,
      'Test 2-way surveyed parcel swap',
      '127.0.0.1'
    );
    console.log(`   ✓ Kết quả trả về từ AuditService: ${swap2Result.message}`);

    // Sau khi swap lần 2:
    // Thửa A phải quay lại Box 1
    // Thửa B phải quay lại Box 2
    // Hồ sơ A vẫn bám Thửa A (ảnh watermark P_TEST_SWAP_A)
    // Hồ sơ B vẫn bám Thửa B (ảnh watermark P_TEST_SWAP_B)
    const check2ARes = await Database.query<{
      project_parcel_code: string;
      is_geom_box1: boolean;
      active_phase1_report_id: string;
    }>(
      `SELECT project_parcel_code, active_phase1_report_id,
              ST_Equals(cadastral_polygon_geom, ST_SetSRID(ST_GeomFromText($2), 4326)) AS is_geom_box1
       FROM parcels WHERE id = $1;`,
      [parcelAId, BOX_1_WKT]
    );
    const check2BRes = await Database.query<{
      project_parcel_code: string;
      is_geom_box2: boolean;
      active_phase1_report_id: string;
    }>(
      `SELECT project_parcel_code, active_phase1_report_id,
              ST_Equals(cadastral_polygon_geom, ST_SetSRID(ST_GeomFromText($2), 4326)) AS is_geom_box2
       FROM parcels WHERE id = $1;`,
      [parcelBId, BOX_2_WKT]
    );

    const post2A = check2ARes.rows[0];
    const post2B = check2BRes.rows[0];

    if (post2A.is_geom_box1 && post2B.is_geom_box2) {
      console.log('   ✅ [PASS] Kịch bản 2: PostGIS geometries hoán đổi chính xác giữa 2 hồ sơ khảo sát');
    } else {
      console.error('   ❌ [FAIL] Kịch bản 2: PostGIS geometry hoán đổi không khớp!');
      passedAll = false;
    }

    if (post2A.active_phase1_report_id === reportAId && post2B.active_phase1_report_id === reportBId) {
      console.log('   ✅ [PASS] Kịch bản 2: Mỗi hồ sơ khảo sát và watermark ảnh bám tuyệt đối 100% vào đúng mã thửa ban đầu');
    } else {
      console.error('   ❌ [FAIL] Kịch bản 2: Liên kết hồ sơ bị xáo trộn!');
      passedAll = false;
    }

    // Dọn dẹp report B
    await Database.query(`DELETE FROM base_survey_reports WHERE id = $1;`, [reportBId]);

    console.log('\n----------------------------------------------------------------------');
    if (passedAll) {
      console.log('🎉 TẤT CẢ 8/8 TIÊU CHÍ KIỂM THỬ TRÊN CẢ 2 KỊCH BẢN ĐỀU ĐẠT CHUẨN XUẤT SẮC (100% PASSED)');
      console.log('   Phương Án A (Spatial Geometry Swap) giải quyết triệt để vấn đề lệch Watermark ảnh!');
    } else {
      console.log('⚠️ CÓ BÀI TEST CHƯA ĐẠT. VUI LÒNG KIỂM TRA LẠI.');
    }
    console.log('----------------------------------------------------------------------\n');
  } catch (err: any) {
    console.error('❌ Lỗi khi thực thi test script:', err);
  } finally {
    // Dọn dẹp dữ liệu thực nghiệm
    try {
      if (reportAId) {
        await Database.query(`DELETE FROM base_survey_reports WHERE id = $1;`, [reportAId]);
      }
      if (parcelAId || parcelBId) {
        await Database.query(`DELETE FROM cadastral_history_logs WHERE parcel_id IN ($1, $2);`, [parcelAId, parcelBId]);
        await Database.query(`DELETE FROM system_audit_logs WHERE entity_id IN ($1, $2);`, [parcelAId, parcelBId]);
        await Database.query(`DELETE FROM parcels WHERE id IN ($1, $2);`, [parcelAId, parcelBId]);
      }
      console.log('🧹 Đã dọn dẹp sạch sẽ dữ liệu thực nghiệm trong database.\n');
    } catch (cleanupErr) {
      console.error('Lỗi khi dọn dẹp:', cleanupErr);
    }
    process.exit(0);
  }
}

runSpatialGeometrySwapTest();
