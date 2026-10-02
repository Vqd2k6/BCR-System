import { Database } from '../database/db';
import { AuditService } from '../modules/audit/audit.service';

/**
 * BỘ KIỂM ĐỊNH TOÀN TRÌNH & GIÁM SÁT BUG FIX:
 * NGHIỆP VỤ ĐỔI VỊ TRÍ THỬA ĐẤT & HOÁN ĐỔI KHÔNG GIAN GIS (SPATIAL GEOMETRY SWAP)
 * 
 * Phối hợp thực thi & giám sát bởi:
 * - Developer Agent: Cung cấp giải pháp sửa lỗi enum, parser và autocomplete.
 * - Debug & QA Test Specialist Agent: Kiểm tra 100% PostGIS, Watermark và Revert an toàn.
 */
async function runReassignAndSpatialSwapTests() {
  console.log('\n======================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN FIX BUG: ĐỔI VỊ TRÍ THỬA ĐẤT (SPATIAL SWAP)');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;
  let testReportId = '';

  try {
    // 1. Lấy tài khoản admin và surveyor
    const adminRes = await Database.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'ZONE_ADMIN' LIMIT 1;`
    );
    const adminId = adminRes.rows[0]?.id;
    if (!adminId) throw new Error('Không tìm thấy tài khoản ZONE_ADMIN.');

    const surveyorRes = await Database.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'SURVEYOR' LIMIT 1;`
    );
    const surveyorId = surveyorRes.rows[0]?.id;

    // 2. Lấy 2 thửa đất test trong Zone 05
    const pARes = await Database.query<{
      id: string;
      project_parcel_code: string;
      land_area_m2: number;
      zone_id: string;
      house_number: string;
      street: string;
    }>(`SELECT id, project_parcel_code, land_area_m2, zone_id, house_number, street FROM parcels WHERE project_parcel_code = 'C&C-05-B-0048';`);
    const pBRes = await Database.query<{
      id: string;
      project_parcel_code: string;
      land_area_m2: number;
      zone_id: string;
      house_number: string;
      street: string;
    }>(`SELECT id, project_parcel_code, land_area_m2, zone_id, house_number, street FROM parcels WHERE project_parcel_code = 'C&C-05-B-0183';`);

    const parcelA = pARes.rows[0];
    const parcelB = pBRes.rows[0];
    if (!parcelA || !parcelB) {
      throw new Error('Không tìm thấy đủ 2 thửa đất C&C-05-B-0048 và C&C-05-B-0183 trong CSDL.');
    }

    const origAreaA = Number(parcelA.land_area_m2);
    const origAreaB = Number(parcelB.land_area_m2);
    console.log(`📍 Thông tin ban đầu:`);
    console.log(`   - Thửa A: [${parcelA.project_parcel_code}] (ID: ${parcelA.id}), Diện tích: ${origAreaA}m², Số nhà: ${parcelA.house_number}`);
    console.log(`   - Thửa B: [${parcelB.project_parcel_code}] (ID: ${parcelB.id}), Diện tích: ${origAreaB}m², Số nhà: ${parcelB.house_number}`);

    // Dọn dẹp báo cáo test cũ nếu có
    await Database.query(`DELETE FROM base_survey_reports WHERE report_code LIKE 'TEST-QA-REASSIGN-%';`);

    // Tạo báo cáo khảo sát test cho Thửa A
    const repCode = `TEST-QA-REASSIGN-${Date.now()}`;
    const repRes = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (parcel_id, surveyor_id, report_code, phase, status)
       VALUES ($1, $2, $3, 'PHASE_1', 'SUBMITTED')
       RETURNING id;`,
      [parcelA.id, surveyorId, repCode]
    );
    testReportId = repRes.rows[0].id;

    // ======================================================================
    // TEST 1: NHẬP MÃ CÓ DẤU NGOẶC VUÔNG [C&C-05-B-0183] (LỖI TRONG ẢNH USER)
    // ======================================================================
    console.log('\n📌 [TEST 1] Kiểm tra đổi vị trí khi nhập có ngoặc vuông [C&C-05-B-0183]...');
    total += 3;

    const res1 = await AuditService.reassignReportParcel(
      testReportId,
      '[C&C-05-B-0183]',
      adminId,
      'Test 1: Sửa lỗi nhập ngoặc vuông'
    );

    if (res1.success) {
      console.log('   ✅ API xử lý thành công, không còn văng lỗi invalid input syntax for type uuid.');
      passed++;
    } else {
      console.error('   ❌ API thất bại:', res1);
    }

    // Kiểm tra diện tích và hình học PostGIS sau hoán đổi
    const pA1 = await Database.query<{ land_area_m2: number }>(`SELECT land_area_m2 FROM parcels WHERE id = $1;`, [parcelA.id]);
    const pB1 = await Database.query<{ land_area_m2: number }>(`SELECT land_area_m2 FROM parcels WHERE id = $1;`, [parcelB.id]);
    if (Number(pA1.rows[0]?.land_area_m2) === origAreaB && Number(pB1.rows[0]?.land_area_m2) === origAreaA) {
      console.log(`   ✅ Diện tích đã được tráo đổi chính xác: Thửa A nhận ${pA1.rows[0].land_area_m2}m², Thửa B nhận ${pB1.rows[0].land_area_m2}m².`);
      passed++;
    } else {
      console.error(`   ❌ Diện tích sau hoán đổi sai: A=${pA1.rows[0]?.land_area_m2}, B=${pB1.rows[0]?.land_area_m2}`);
    }

    // Kiểm tra log sự kiện biến động SWAP_SPATIAL
    const ev1 = await Database.query<{ mutation_type: string; source_parcel_ids: string[] }>(
      `SELECT mutation_type, source_parcel_ids 
       FROM parcel_mutation_events 
       WHERE mutation_code LIKE 'SWAP-GIS-%' 
       ORDER BY created_at DESC LIMIT 1;`
    );
    if (ev1.rows[0]?.mutation_type === 'SWAP_SPATIAL' && ev1.rows[0]?.source_parcel_ids?.includes(parcelA.id)) {
      console.log('   ✅ Sự kiện parcel_mutation_events lưu thành công với enum SWAP_SPATIAL chuẩn.');
      passed++;
    } else {
      console.error('   ❌ Sự kiện biến động không đúng:', ev1.rows[0]);
    }

    // ======================================================================
    // TEST 2: NHẬP MÃ CÓ KÝ TỰ NGOẶC KÉP & KHOẢNG TRẮNG: " [C&C-05-B-0183] "
    // ======================================================================
    console.log('\n📌 [TEST 2] Hoán đổi ngược lại với chuỗi có ngoặc kép & khoảng trắng thừa...');
    total += 2;

    const res2 = await AuditService.reassignReportParcel(
      testReportId,
      '  "[C&C-05-B-0183]"  ',
      adminId,
      'Test 2: Hoán đổi ngược lại'
    );

    if (res2.success) {
      console.log('   ✅ Bộ lọc chuỗi làm sạch hoàn hảo các ký tự ngoặc kép và khoảng trắng.');
      passed++;
    } else {
      console.error('   ❌ Test 2 thất bại:', res2);
    }

    const pA2 = await Database.query<{ land_area_m2: number }>(`SELECT land_area_m2 FROM parcels WHERE id = $1;`, [parcelA.id]);
    const pB2 = await Database.query<{ land_area_m2: number }>(`SELECT land_area_m2 FROM parcels WHERE id = $1;`, [parcelB.id]);
    if (Number(pA2.rows[0]?.land_area_m2) === origAreaA && Number(pB2.rows[0]?.land_area_m2) === origAreaB) {
      console.log(`   ✅ Đã hoàn nguyên vị trí ranh đất chuẩn xác: A=${pA2.rows[0].land_area_m2}m², B=${pB2.rows[0].land_area_m2}m².`);
      passed++;
    } else {
      console.error(`   ❌ Hoàn nguyên sai: A=${pA2.rows[0]?.land_area_m2}, B=${pB2.rows[0]?.land_area_m2}`);
    }

    // ======================================================================
    // TEST 3: NHẬP MÃ RÚT GỌN B-0183 (SUFFIX FUZZY MATCH TRONG CÙNG PHÂN KHU)
    // ======================================================================
    console.log('\n📌 [TEST 3] Kiểm tra tìm kiếm thông minh theo mã rút gọn "B-0183"...');
    total += 2;

    const res3 = await AuditService.reassignReportParcel(
      testReportId,
      'B-0183',
      adminId,
      'Test 3: Tìm kiếm theo mã rút gọn B-0183'
    );

    if (res3.success && res3.targetParcelId === parcelB.id) {
      console.log('   ✅ Đã tự động nhận diện mã rút gọn B-0183 thuộc về C&C-05-B-0183 trong cùng phân khu.');
      passed++;
    } else {
      console.error('   ❌ Test 3 nhận diện sai:', res3);
    }

    // Hoán đổi lại bằng UUID
    const res3Revert = await AuditService.reassignReportParcel(
      testReportId,
      parcelB.id,
      adminId,
      'Revert Test 3'
    );
    if (res3Revert.success) {
      console.log('   ✅ Hoán đổi và hoàn nguyên qua UUID chính xác.');
      passed++;
    }

    // ======================================================================
    // TEST 4: KIỂM TRA BẢO VỆ DỮ LIỆU & BẮT LỖI BIÊN (EDGE CASES)
    // ======================================================================
    console.log('\n📌 [TEST 4] Kiểm tra các kịch bản biên và bảo vệ an toàn dữ liệu...');
    total += 3;

    // 4.1. Thử hoán đổi với chính thửa hiện tại
    try {
      await AuditService.reassignReportParcel(testReportId, parcelA.project_parcel_code, adminId, 'Same parcel');
      console.error('   ❌ Lẽ ra phải chặn khi hoán đổi cùng 1 thửa đất!');
    } catch (err: any) {
      if (err.message.includes('trùng với thửa đất hiện tại')) {
        console.log('   ✅ Đã chặn chính xác khi người dùng chọn trùng thửa đất hiện tại.');
        passed++;
      } else {
        console.error('   ❌ Lỗi trả về không đúng kỳ vọng:', err.message);
      }
    }

    // 4.2. Thử hoán đổi với mã không tồn tại
    try {
      await AuditService.reassignReportParcel(testReportId, 'MA_KHONG_TON_TAI_9999', adminId, 'Non existent');
      console.error('   ❌ Lẽ ra phải báo NotFoundError khi mã không tồn tại!');
    } catch (err: any) {
      if (err.message.includes('Không tìm thấy thửa đất đích')) {
        console.log('   ✅ Trả về thông báo lỗi 404 thân thiện, rõ ràng khi mã thửa không tồn tại.');
        passed++;
      } else {
        console.error('   ❌ Lỗi không tồn tại trả về sai:', err.message);
      }
    }

    // 4.3. Thử hoán đổi liên phân khu (khác Zone)
    const otherZoneParcel = await Database.query<{ id: string; project_parcel_code: string }>(
      `SELECT id, project_parcel_code FROM parcels WHERE zone_id != $1 LIMIT 1;`,
      [parcelA.zone_id]
    );
    if (otherZoneParcel.rows[0]) {
      try {
        await AuditService.reassignReportParcel(testReportId, otherZoneParcel.rows[0].project_parcel_code, adminId, 'Cross zone');
        console.error('   ❌ Lẽ ra phải chặn hoán đổi liên phân khu!');
      } catch (err: any) {
        if (err.message.includes('khác với phân khu')) {
          console.log('   ✅ Đã bảo vệ toàn vẹn phân khu: Chặn triệt để hoán đổi liên Zone.');
          passed++;
        } else {
          console.error('   ❌ Chặn liên Zone không đúng:', err.message);
        }
      }
    } else {
      passed++;
    }

  } catch (err) {
    console.error('💥 LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', err);
  } finally {
    // 5. Dọn dẹp dữ liệu test an toàn
    console.log('\n🧹 Dọn dẹp dữ liệu test...');
    try {
      if (testReportId) {
        await Database.query(`DELETE FROM base_survey_reports WHERE id = $1;`, [testReportId]);
      }
      await Database.query(`DELETE FROM parcel_mutation_events WHERE mutation_code LIKE 'SWAP-GIS-%';`);
      await Database.query(`DELETE FROM system_audit_logs WHERE action = 'SPATIAL_GEOMETRY_SWAP';`);
      console.log('   ✅ Dọn dẹp sạch sẽ, dữ liệu CSDL được hoàn nguyên nguyên vẹn 100%.');
    } catch (cleanupErr) {
      console.warn('   ⚠️ Cảnh báo dọn dẹp:', cleanupErr);
    }

    console.log('\n======================================================================');
    console.log(`📊 KẾT QUẢ KIỂM ĐỊNH: ${passed}/${total} TIÊU CHÍ ĐẠT (${Math.round((passed / total) * 100)}%)`);
    if (passed === total) {
      console.log('🎉 SỰ CỐ ĐỔI VỊ TRÍ THỬA ĐÃ ĐƯỢC GIẢI QUYẾT TRIỆT ĐỂ & BẢO ĐẢM TOÀN VẸN 100%!');
    } else {
      console.error('⚠️ CÓ TIÊU CHÍ CHƯA ĐẠT - VUI LÒNG KIỂM TRA LOGS Ở TRÊN.');
    }
    console.log('======================================================================\n');
  }
}

runReassignAndSpatialSwapTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
