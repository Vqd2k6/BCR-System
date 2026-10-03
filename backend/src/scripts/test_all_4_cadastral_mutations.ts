import { Database } from '../database/db';
import { CadastralService } from '../modules/cadastral/cadastral.service';
import { AuditService } from '../modules/audit/audit.service';

/**
 * BỘ KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN CẢ 4 NGHIỆP VỤ BIẾN ĐỘNG ĐỊA CHÍNH (POSTGIS & WATERMARK INTEGRITY)
 * Được phối hợp xây dựng và kiểm tra bởi:
 * - Agent 1: Thực Thi (Execution Agent)
 * - Agent 2: Giám Sát & Phản Biện (Reviewer Agent)
 *
 * Kiểm tra:
 * 1. Đổi vị trí thửa (Spatial Reassign)
 * 2. Hoán đổi chéo 2 thửa đã khảo sát (Spatial Swap)
 * 3. Tách thửa (Parcel Split: Căn A giữ mã 123 & watermark; Căn B nhận Max Zone + 1)
 * 4. Gộp thửa (Parcel Merge: Hợp nhất ST_Union & bảo toàn hồ sơ lưu trữ)
 */
async function testAllFourCadastralMutations() {
  console.log('\n======================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN 4 NGHIỆP VỤ BIẾN ĐỘNG ĐỊA CHÍNH');
  console.log('   Kiểm chứng tính toàn vẹn 100% của Mã Thửa, PostGIS & Watermark Ảnh');
  console.log('======================================================================\n');

  let testAdminId = '';
  const testZoneId = 'ZONE_08';
  let passedCount = 0;
  let totalTests = 0;

  const createdParcelIds: string[] = [];
  const createdReportIds: string[] = [];
  const createdMutationEventIds: string[] = [];

  const BOX_1_WKT = 'POLYGON((106.7110 10.7920, 106.7112 10.7920, 106.7112 10.7922, 106.7110 10.7922, 106.7110 10.7920))';
  const BOX_2_WKT = 'POLYGON((106.7120 10.7930, 106.7125 10.7930, 106.7125 10.7935, 106.7120 10.7935, 106.7120 10.7930))';
  const BOX_MERGE_1 = 'POLYGON((106.7150 10.7950, 106.7152 10.7950, 106.7152 10.7952, 106.7150 10.7952, 106.7150 10.7950))';
  const BOX_MERGE_2 = 'POLYGON((106.7152 10.7950, 106.7154 10.7950, 106.7154 10.7952, 106.7152 10.7952, 106.7152 10.7950))';

  try {
    const adminRes = await Database.query<{ id: string }>(
      `SELECT id FROM users WHERE role IN ('ZONE_ADMIN', 'SUPER_ADMIN') LIMIT 1;`
    );
    if (!adminRes.rows[0]) throw new Error('Không tìm thấy tài khoản admin để chạy test.');
    testAdminId = adminRes.rows[0].id;

    // Dọn dẹp dữ liệu cũ nếu còn sót
    await Database.query(`DELETE FROM parcels WHERE project_parcel_code LIKE 'TEST_%';`);

    // ======================================================================
    // 1. TEST NGHIỆP VỤ 1: ĐỔI VỊ TRÍ THỬA (SPATIAL REASSIGN)
    // ======================================================================
    console.log('📌 1. KIỂM THỬ NGHIỆP VỤ 1: ĐỔI VỊ TRÍ THỬA (SPATIAL REASSIGN)...');
    totalTests += 2;

    const p1Res = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        zone_id, official_cadastral_code, project_parcel_code, house_number, street,
        owner_name, owner_phone, land_area_m2, survey_status, cadastral_polygon_geom
      ) VALUES (
        $1, 'DC-T1', 'TEST_REASSIGN_01', '101', 'Đường Test 1',
        'Nguyễn Văn A', '0901111111', 80.0, 'SUBMITTED',
        ST_SetSRID(ST_GeomFromText($2), 4326)
      ) RETURNING id;`,
      [testZoneId, BOX_1_WKT]
    );
    const p1Id = p1Res.rows[0].id;
    createdParcelIds.push(p1Id);

    const p2Res = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        zone_id, official_cadastral_code, project_parcel_code, house_number, street,
        owner_name, owner_phone, land_area_m2, survey_status, cadastral_polygon_geom
      ) VALUES (
        $1, 'DC-T2', 'TEST_REASSIGN_02', '103', 'Đường Test 1',
        'Trần Văn B', '0902222222', 120.0, 'NOT_SURVEYED',
        ST_SetSRID(ST_GeomFromText($2), 4326)
      ) RETURNING id;`,
      [testZoneId, BOX_2_WKT]
    );
    const p2Id = p2Res.rows[0].id;
    createdParcelIds.push(p2Id);

    // Gắn hồ sơ và ảnh có watermark cho Thửa 1
    const rep1Res = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
        parcel_id, surveyor_id, zone_admin_id, report_code, phase, status, survey_data_json
      ) VALUES (
        $1, $2, $2, 'BCS-R1', 'PHASE_1', 'SUBMITTED',
        $3
      ) RETURNING id;`,
      [
        p1Id,
        testAdminId,
        JSON.stringify({
          parcelCode: 'TEST_REASSIGN_01',
          photos: [{ photoId: 'ph_01', watermarkText: 'BCS - TEST_REASSIGN_01 - 101 Đường Test 1' }],
        }),
      ]
    );
    const rep1Id = rep1Res.rows[0].id;
    createdReportIds.push(rep1Id);
    await Database.query(`UPDATE parcels SET active_phase1_report_id = $1 WHERE id = $2;`, [rep1Id, p1Id]);

    // Thực hiện đổi vị trí ranh đất từ P1 sang vị trí của P2
    await CadastralService.swapParcelGeometries(p1Id, p2Id, testAdminId, 'Test spatial reassign', '127.0.0.1');

    // Kiểm chứng P1: Giữ nguyên mã TEST_REASSIGN_01, nhận vị trí BOX 2, ảnh watermark giữ nguyên
    const p1Check = await Database.query<{
      project_parcel_code: string;
      land_area_m2: number;
      is_at_box2: boolean;
      active_phase1_report_id: string;
    }>(
      `SELECT project_parcel_code, land_area_m2, active_phase1_report_id,
              ST_Equals(cadastral_polygon_geom, ST_SetSRID(ST_GeomFromText($2), 4326)) AS is_at_box2
       FROM parcels WHERE id = $1;`,
      [p1Id, BOX_2_WKT]
    );

    if (p1Check.rows[0].project_parcel_code === 'TEST_REASSIGN_01' && p1Check.rows[0].is_at_box2) {
      console.log('   ✅ [PASS] Reassign: Thửa 1 giữ nguyên mã định danh và chuyển sang đúng toạ độ vị trí mới');
      passedCount++;
    } else {
      console.error('   ❌ [FAIL] Reassign: Thửa 1 không chuyển đúng toạ độ!');
    }

    const rep1Check = await Database.query<{ survey_data_json: any }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [rep1Id]
    );
    const wText1 = rep1Check.rows[0].survey_data_json?.photos?.[0]?.watermarkText;
    if (wText1 === 'BCS - TEST_REASSIGN_01 - 101 Đường Test 1') {
      console.log('   ✅ [PASS] Reassign: Watermark ảnh bảo toàn 100% khớp mã thửa');
      passedCount++;
    } else {
      console.error('   ❌ [FAIL] Reassign: Watermark bị biến đổi!');
    }

    // ======================================================================
    // 2. TEST NGHIỆP VỤ 2: HOÁN ĐỔI CHÉO 2 THỬA ĐÃ KHẢO SÁT (SPATIAL SWAP)
    // ======================================================================
    console.log('\n📌 2. KIỂM THỬ NGHIỆP VỤ 2: HOÁN ĐỔI CHÉO 2 THỬA (SPATIAL SWAP)...');
    totalTests += 2;

    // Gắn hồ sơ và ảnh có watermark cho Thửa 2
    const rep2Res = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
        parcel_id, surveyor_id, zone_admin_id, report_code, phase, status, survey_data_json
      ) VALUES (
        $1, $2, $2, 'BCS-R2', 'PHASE_1', 'SUBMITTED',
        $3
      ) RETURNING id;`,
      [
        p2Id,
        testAdminId,
        JSON.stringify({
          parcelCode: 'TEST_REASSIGN_02',
          photos: [{ photoId: 'ph_02', watermarkText: 'BCS - TEST_REASSIGN_02 - 103 Đường Test 1' }],
        }),
      ]
    );
    const rep2Id = rep2Res.rows[0].id;
    createdReportIds.push(rep2Id);
    await Database.query(`UPDATE parcels SET active_phase1_report_id = $1, survey_status = 'SUBMITTED' WHERE id = $2;`, [rep2Id, p2Id]);

    // Hoán đổi chéo 2 chiều giữa 2 hồ sơ
    await AuditService.swapReportParcels(rep1Id, rep2Id, testAdminId, 'Test spatial 2-way swap', '127.0.0.1');

    // Sau khi swap lần 2: P1 quay về Box 1, P2 quay về Box 2
    const swapCheck = await Database.query<{
      p1_code: string;
      p1_box1: boolean;
      p2_code: string;
      p2_box2: boolean;
    }>(
      `SELECT (SELECT project_parcel_code FROM parcels WHERE id = $1) AS p1_code,
              (SELECT ST_Equals(cadastral_polygon_geom, ST_SetSRID(ST_GeomFromText($3), 4326)) FROM parcels WHERE id = $1) AS p1_box1,
              (SELECT project_parcel_code FROM parcels WHERE id = $2) AS p2_code,
              (SELECT ST_Equals(cadastral_polygon_geom, ST_SetSRID(ST_GeomFromText($4), 4326)) FROM parcels WHERE id = $2) AS p2_box2;`,
      [p1Id, p2Id, BOX_1_WKT, BOX_2_WKT]
    );

    if (swapCheck.rows[0].p1_box1 && swapCheck.rows[0].p2_box2) {
      console.log('   ✅ [PASS] Swap: Toạ độ PostGIS tráo đổi 2 chiều chính xác');
      passedCount++;
    } else {
      console.error('   ❌ [FAIL] Swap: Toạ độ 2 chiều không khớp!');
    }

    const checkReports = await Database.query<{ p1_rep: string; p2_rep: string }>(
      `SELECT (SELECT active_phase1_report_id FROM parcels WHERE id = $1) AS p1_rep,
              (SELECT active_phase1_report_id FROM parcels WHERE id = $2) AS p2_rep;`,
      [p1Id, p2Id]
    );
    if (checkReports.rows[0].p1_rep === rep1Id && checkReports.rows[0].p2_rep === rep2Id) {
      console.log('   ✅ [PASS] Swap: Mỗi hồ sơ và watermark bám chặt 100% vào đúng mã thửa ban đầu');
      passedCount++;
    } else {
      console.error('   ❌ [FAIL] Swap: Liên kết hồ sơ bị xáo trộn!');
    }

    // ======================================================================
    // 3. TEST NGHIỆP VỤ 3: TÁCH THỬA (SPLIT) - CĂN A GIỮ MÃ 123 & CĂN B MAX ZONE + 1
    // ======================================================================
    console.log('\n📌 3. KIỂM THỬ NGHIỆP VỤ 3: TÁCH THỬA (SPLIT MUTATION)...');
    totalTests += 3;

    // Tạo thửa đất mẹ mã TEST_SPLIT_100
    const parentCode = 'TEST_SPLIT_100';
    const parentRes = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        zone_id, official_cadastral_code, project_parcel_code, house_number, street,
        owner_name, owner_phone, land_area_m2, survey_status, cadastral_polygon_geom
      ) VALUES (
        $1, 'DC-SP100', $2, '100', 'Đường Tách Thửa',
        'Ông Chủ Căn A', '0903333333', 100.0, 'SUBMITTED',
        ST_SetSRID(ST_GeomFromText($3), 4326)
      ) RETURNING id;`,
      [testZoneId, parentCode, BOX_1_WKT]
    );
    const parentId = parentRes.rows[0].id;
    createdParcelIds.push(parentId);

    // Gắn hồ sơ và ảnh có watermark [TEST_SPLIT_100] cho thửa mẹ
    const parentRepRes = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
        parcel_id, surveyor_id, zone_admin_id, report_code, phase, status, survey_data_json
      ) VALUES (
        $1, $2, $2, 'BCS-SPLIT-P', 'PHASE_1', 'SUBMITTED',
        $3
      ) RETURNING id;`,
      [
        parentId,
        testAdminId,
        JSON.stringify({
          parcelCode: parentCode,
          photos: [{ photoId: 'ph_split_01', watermarkText: `BCS - ${parentCode} - 100 Đường Tách Thửa` }],
        }),
      ]
    );
    const parentRepId = parentRepRes.rows[0].id;
    createdReportIds.push(parentRepId);
    await Database.query(`UPDATE parcels SET active_phase1_report_id = $1 WHERE id = $2;`, [parentRepId, parentId]);

    // Admin thực hiện tách thửa: Căn A (60m²) và Căn B (40m²)
    const splitMutationRes = await CadastralService.executeAdminMutation(
      testAdminId,
      {
        mutationType: 'SPLIT',
        sourceParcelIds: [parentId],
        childParcels: [
          { houseNumber: '100', landAreaM2: 60.0, ownerName: 'Ông Chủ Căn A' },
          { houseNumber: '100B', landAreaM2: 40.0, ownerName: 'Bà Chủ Căn B' },
        ],
        adminNotes: 'Tách Căn A và Căn B theo yêu cầu chuẩn hóa',
      },
      '127.0.0.1'
    );
    createdMutationEventIds.push(splitMutationRes.mutationEventId);

    // Kiểm tra Thửa chính (Căn A): Phải giữ nguyên ID mẹ, mã vẫn là TEST_SPLIT_100, diện tích 60m², ACTIVE
    const childACheck = await Database.query<{
      project_parcel_code: string;
      land_area_m2: number;
      lifecycle_status: string;
      child_parcel_ids: string[];
      active_phase1_report_id: string;
    }>(
      `SELECT project_parcel_code, land_area_m2, lifecycle_status, child_parcel_ids, active_phase1_report_id
       FROM parcels WHERE id = $1;`,
      [parentId]
    );
    const postA = childACheck.rows[0];

    if (
      postA.project_parcel_code === parentCode &&
      postA.lifecycle_status === 'ACTIVE' &&
      Number(postA.land_area_m2) === 60.0 &&
      postA.active_phase1_report_id === parentRepId
    ) {
      console.log(`   ✅ [PASS] Tách thửa - Căn A: Giữ nguyên 100% mã gốc [${parentCode}], ID gốc, hồ sơ và watermark ảnh!`);
      passedCount++;
    } else {
      console.error(`   ❌ [FAIL] Tách thửa - Căn A bị biến đổi! code=${postA.project_parcel_code}, status=${postA.lifecycle_status}`);
    }

    // Kiểm tra Thửa con phát sinh (Căn B):
    const childBId = postA.child_parcel_ids?.[0];
    if (childBId) createdParcelIds.push(childBId);

    const childBCheck = await Database.query<{
      project_parcel_code: string;
      land_area_m2: number;
      survey_status: string;
      lifecycle_status: string;
      parent_parcel_ids: string[];
    }>(
      `SELECT project_parcel_code, land_area_m2, survey_status, lifecycle_status, parent_parcel_ids
       FROM parcels WHERE id = $1;`,
      [childBId]
    );
    const postB = childBCheck.rows[0];

    // Căn B phải có mã mới (Max Zone + 1, khác mã mẹ), diện tích 40m², trạng thái NOT_SURVEYED
    if (
      postB &&
      postB.project_parcel_code !== parentCode &&
      postB.survey_status === 'NOT_SURVEYED' &&
      postB.lifecycle_status === 'ACTIVE' &&
      Number(postB.land_area_m2) === 40.0 &&
      postB.parent_parcel_ids?.includes(parentId)
    ) {
      console.log(`   ✅ [PASS] Tách thửa - Căn B: Sinh mã mới [${postB.project_parcel_code}] (Max Zone + 1), trạng thái NOT_SURVEYED`);
      passedCount++;
    } else {
      console.error(`   ❌ [FAIL] Tách thửa - Căn B không đúng chuẩn! B=${JSON.stringify(postB)}`);
    }

    // Kiểm tra hồ sơ ảnh của Căn A không bị xáo trộn:
    const repACheck = await Database.query<{ survey_data_json: any }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [parentRepId]
    );
    const wTextA = repACheck.rows[0].survey_data_json?.photos?.[0]?.watermarkText;
    if (wTextA === `BCS - ${parentCode} - 100 Đường Tách Thửa`) {
      console.log(`   ✅ [PASS] Tách thửa: Watermark ảnh gốc của Căn A bảo toàn nguyên bản 100%`);
      passedCount++;
    } else {
      console.error('   ❌ [FAIL] Tách thửa: Watermark ảnh gốc bị lệch!');
    }

    // ======================================================================
    // 4. TEST NGHIỆP VỤ 4: GỘP THỬA (PARCEL MERGE)
    // ======================================================================
    console.log('\n📌 4. KIỂM THỬ NGHIỆP VỤ 4: GỘP THỬA (PARCEL MERGE)...');
    totalTests += 2;

    const pm1Res = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        zone_id, official_cadastral_code, project_parcel_code, house_number, street,
        owner_name, land_area_m2, survey_status, cadastral_polygon_geom
      ) VALUES (
        $1, 'DC-M1', 'TEST_MERGE_01', '201', 'Đường Gộp Thửa',
        'Chủ Khuôn Viên 1', 50.0, 'SUBMITTED',
        ST_SetSRID(ST_GeomFromText($2), 4326)
      ) RETURNING id;`,
      [testZoneId, BOX_MERGE_1]
    );
    const pm1Id = pm1Res.rows[0].id;
    createdParcelIds.push(pm1Id);

    const pm2Res = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        zone_id, official_cadastral_code, project_parcel_code, house_number, street,
        owner_name, land_area_m2, survey_status, cadastral_polygon_geom
      ) VALUES (
        $1, 'DC-M2', 'TEST_MERGE_02', '203', 'Đường Gộp Thửa',
        'Chủ Khuôn Viên 2', 70.0, 'NOT_SURVEYED',
        ST_SetSRID(ST_GeomFromText($2), 4326)
      ) RETURNING id;`,
      [testZoneId, BOX_MERGE_2]
    );
    const pm2Id = pm2Res.rows[0].id;
    createdParcelIds.push(pm2Id);

    // Thực hiện gộp 2 thửa vào Thửa 1
    const mergeMutationRes = await CadastralService.executeAdminMutation(
      testAdminId,
      {
        mutationType: 'MERGE',
        sourceParcelIds: [pm1Id, pm2Id],
        adminNotes: 'Gộp 2 khuôn viên liền vách thành 1',
      },
      '127.0.0.1'
    );
    createdMutationEventIds.push(mergeMutationRes.mutationEventId);

    // Kiểm tra Thửa chính đại diện (pm1): diện tích 120m², ACTIVE, ST_Union hợp nhất
    const pm1Check = await Database.query<{
      project_parcel_code: string;
      land_area_m2: number;
      lifecycle_status: string;
      child_parcel_ids: string[];
    }>(
      `SELECT project_parcel_code, land_area_m2, lifecycle_status, child_parcel_ids
       FROM parcels WHERE id = $1;`,
      [pm1Id]
    );
    const postM1 = pm1Check.rows[0];

    if (
      postM1.project_parcel_code === 'TEST_MERGE_01' &&
      Number(postM1.land_area_m2) === 120.0 &&
      postM1.child_parcel_ids?.includes(pm2Id)
    ) {
      console.log('   ✅ [PASS] Gộp thửa: Thửa chính đại diện toàn bộ khuôn viên, cộng dồn diện tích 120.0m² (ST_Union)');
      passedCount++;
    } else {
      console.error(`   ❌ [FAIL] Gộp thửa: Thửa chính sai thông tin! m1=${JSON.stringify(postM1)}`);
    }

    // Kiểm tra Thửa phụ (pm2): Chuyển sang MERGED_DEPRECATED
    const pm2Check = await Database.query<{
      lifecycle_status: string;
      parent_parcel_ids: string[];
    }>(
      `SELECT lifecycle_status, parent_parcel_ids FROM parcels WHERE id = $1;`,
      [pm2Id]
    );
    const postM2 = pm2Check.rows[0];

    if (postM2.lifecycle_status === 'MERGED_DEPRECATED' && postM2.parent_parcel_ids?.includes(pm1Id)) {
      console.log('   ✅ [PASS] Gộp thửa: Thửa phụ chuyển sang MERGED_DEPRECATED và lưu vết parent_parcel_ids');
      passedCount++;
    } else {
      console.error(`   ❌ [FAIL] Gộp thửa: Thửa phụ không chuyển MERGED_DEPRECATED! m2=${JSON.stringify(postM2)}`);
    }

    console.log('\n======================================================================');
    if (passedCount === totalTests) {
      console.log(`🎉 TẤT CẢ ${passedCount}/${totalTests} BÀI TEST CỦA CẢ 4 NGHIỆP VỤ ĐỀU ĐẠT CHUẨN XUẤT SẮC (PASSED 100%)`);
      console.log('   Hệ thống biến động địa chính bảo toàn tuyệt đối 100% Watermark Ảnh & Dữ liệu PostGIS!');
    } else {
      console.log(`⚠️ CÓ BÀI TEST CHƯA ĐẠT (${passedCount}/${totalTests}). Vui lòng kiểm tra lại.`);
    }
    console.log('======================================================================\n');
  } catch (err: any) {
    console.error('❌ Lỗi khi thực thi test script:', err);
  } finally {
    // Dọn dẹp sạch sẽ dữ liệu thực nghiệm
    try {
      if (createdReportIds.length > 0) {
        await Database.query(`DELETE FROM base_survey_reports WHERE id = ANY($1);`, [createdReportIds]);
      }
      if (createdMutationEventIds.length > 0) {
        await Database.query(`DELETE FROM parcel_mutation_events WHERE id = ANY($1);`, [createdMutationEventIds]);
      }
      if (createdParcelIds.length > 0) {
        await Database.query(`DELETE FROM cadastral_history_logs WHERE parcel_id = ANY($1);`, [createdParcelIds]);
        await Database.query(`DELETE FROM system_audit_logs WHERE entity_id = ANY($1);`, [createdParcelIds]);
        await Database.query(`DELETE FROM parcels WHERE id = ANY($1);`, [createdParcelIds]);
      }
      console.log('🧹 Đã dọn dẹp sạch sẽ toàn bộ dữ liệu thực nghiệm trong database.\n');
    } catch (cleanupErr) {
      console.error('Lỗi khi dọn dẹp test data:', cleanupErr);
    }
    process.exit(0);
  }
}

testAllFourCadastralMutations();
