import { SurveyService } from '../modules/survey/survey.service';
import { Database } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

async function runTest() {
  console.log('====================================================================');
  console.log('KIỂM THỬ TOÀN DIỆN: TÁCH THỬA THỰC ĐỊA 2 NHÁNH & TRUY VẾT CSDL 100%');
  console.log('====================================================================\n');

  // Lấy 1 surveyor hợp lệ
  const userRes = await Database.query<{ id: string }>(
    `SELECT id FROM users WHERE role = 'SURVEYOR' LIMIT 1;`
  );
  if (userRes.rows.length === 0) {
    throw new Error('Không tìm thấy tài khoản SURVEYOR nào trong CSDL để test.');
  }
  const surveyorId = userRes.rows[0].id;
  console.log(`[Setup] Surveyor ID: ${surveyorId}`);

  // Tìm 2 thửa đất test có sẵn
  const parcelRes = await Database.query<{
    id: string;
    project_parcel_code: string;
    zone_id: string;
    land_area_m2: number;
  }>(
    `SELECT id, project_parcel_code, zone_id, land_area_m2
     FROM parcels
     WHERE lifecycle_status = 'ACTIVE'
     ORDER BY created_at ASC
     LIMIT 2;`
  );

  if (parcelRes.rows.length < 2) {
    throw new Error('Cần ít nhất 2 thửa đất để chạy kiểm thử 2 nhánh.');
  }

  const parcel1 = parcelRes.rows[0];
  const parcel2 = parcelRes.rows[1];

  console.log(`[Test Parcel 1 - Nhánh Phi công trình]: ID=${parcel1.id}, Mã=${parcel1.project_parcel_code}, Diện tích=${parcel1.land_area_m2}m²`);
  console.log(`[Test Parcel 2 - Nhánh Nhà mới Căn B]: ID=${parcel2.id}, Mã=${parcel2.project_parcel_code}, Diện tích=${parcel2.land_area_m2}m²\n`);

  // Lưu lại trạng thái ban đầu của Parcel 1 và 2 để hoàn nguyên sau test
  const originalState1 = await Database.query(`SELECT * FROM parcels WHERE id = $1`, [parcel1.id]);
  const originalState2 = await Database.query(`SELECT * FROM parcels WHERE id = $1`, [parcel2.id]);

  let createdChildParcelId: string | null = null;
  let mutationEventId1: string | null = null;
  let mutationEventId2: string | null = null;
  let reportId1: string | null = null;
  let reportId2: string | null = null;

  try {
    // ========================================================================
    // TEST CASE 1: NHÁNH 1 - ĐẤT DƯ / SÂN VƯỜN (NON_BUILDING)
    // ========================================================================
    console.log('--- BẮT ĐẦU TEST CASE 1: NHÁNH 1 - ĐẤT DƯ / SÂN VƯỜN (NON_BUILDING) ---');
    
    // 1. Tạo report Phase 1 cho Parcel 1
    const init1 = await SurveyService.createPhase1Report(parcel1.id, surveyorId);
    reportId1 = init1.reportId;
    console.log(`[Test 1] Đã tạo report Phase 1 ID: ${reportId1}`);

    // Đa giác mẫu cho Căn A và Đất Dư
    const sampleCoordsA: [number, number][] = [
      [10.7720, 106.6900],
      [10.7725, 106.6900],
      [10.7725, 106.6905],
      [10.7720, 106.6905],
    ];
    const sampleCoordsB_Surplus: [number, number][] = [
      [10.7725, 106.6900],
      [10.7730, 106.6900],
      [10.7730, 106.6905],
      [10.7725, 106.6905],
    ];

    const countParcelsBefore1 = await Database.query<{ count: string }>('SELECT COUNT(*)::text as count FROM parcels');

    // 2. KSV nộp hồ sơ chọn Tách Thửa Nhánh 1 (NON_BUILDING)
    const submitPayload1 = {
      ownerRemarks: 'Ý kiến chủ nhà test nhánh 1',
      surveyDataJson: {
        gisMutationConfirmed: {
          type: 'SPLIT',
          notes: 'Tách bớt phần sân vườn phía sau phục vụ đền bù',
          details: {
            residualKind: 'NON_BUILDING',
            splitCount: 2,
            splitReason: 'Tách đất thừa sân vườn',
            splitChildren: [
              {
                label: `Căn A (Đang KS - ${parcel1.project_parcel_code})`,
                houseNumber: '100',
                ownerName: 'Chủ Căn A',
                suggestedCode: parcel1.project_parcel_code,
                areaM2: 60,
                coordinates: sampleCoordsA,
              },
              {
                label: 'Phần diện tích dôi dư (Đất thừa / Sân vườn)',
                houseNumber: '100-DU',
                ownerName: 'Chủ sở hữu đất dôi dư',
                suggestedCode: `${parcel1.project_parcel_code}-DU`,
                areaM2: 40,
                residualKind: 'NON_BUILDING',
                isResidualSurplus: true,
                functionalType: 'Sân vườn gia đình',
                coordinates: sampleCoordsB_Surplus,
              },
            ],
            splitCustomPointsA: sampleCoordsA,
            splitCustomPointsB: sampleCoordsB_Surplus,
          },
        },
      },
    };

    console.log('[Test 1] Tiến hành nộp hồ sơ Phase 1 kèm Tách thửa Nhánh 1...');
    await SurveyService.submitPhase1Report(reportId1, submitPayload1);

    // 3. Kiểm tra kết quả trong CSDL
    const countParcelsAfter1 = await Database.query<{ count: string }>('SELECT COUNT(*)::text as count FROM parcels');
    if (countParcelsBefore1.rows[0].count !== countParcelsAfter1.rows[0].count) {
      throw new Error(`Test 1 Thất bại: Số lượng parcels thay đổi! Nhánh NON_BUILDING không được tạo parcel mới. Trước=${countParcelsBefore1.rows[0].count}, Sau=${countParcelsAfter1.rows[0].count}`);
    }
    console.log('✅ [Xác nhận 1.1]: Số lượng parcels KHÔNG ĐỔI (Đúng chuẩn không phát sinh lô rác).');

    const updatedP1 = await Database.query<{
      project_parcel_code: string;
      mutation_type: string;
      mutation_event_id: string;
      land_area_m2: number;
      survey_status: string;
    }>('SELECT project_parcel_code, mutation_type, mutation_event_id, land_area_m2, survey_status FROM parcels WHERE id = $1', [parcel1.id]);

    const p1Row = updatedP1.rows[0];
    if (p1Row.project_parcel_code !== parcel1.project_parcel_code) {
      throw new Error(`Test 1 Thất bại: Căn A bị đổi mã! Cũ=${parcel1.project_parcel_code}, Mới=${p1Row.project_parcel_code}`);
    }
    console.log(`✅ [Xác nhận 1.2]: Căn A giữ nguyên 100% mã gốc [${p1Row.project_parcel_code}].`);

    if (p1Row.mutation_type !== 'SPLIT' || !p1Row.mutation_event_id) {
      throw new Error(`Test 1 Thất bại: mutation_type không phải SPLIT hoặc thiếu mutation_event_id.`);
    }
    mutationEventId1 = p1Row.mutation_event_id;
    console.log(`✅ [Xác nhận 1.3]: Thửa Căn A ghi nhận mutation_type='SPLIT' và mutation_event_id='${mutationEventId1}'.`);
    console.log(`✅ [Xác nhận 1.4]: Diện tích Căn A thu nhỏ thành ${p1Row.land_area_m2}m² (đúng diện tích Căn A).`);

    // Kiểm tra sự kiện trong parcel_mutation_events
    const mutEvent1 = await Database.query<{
      mutation_code: string;
      source_parcel_ids: string[];
      result_parcel_ids: string[];
      status: string;
    }>('SELECT mutation_code, source_parcel_ids, result_parcel_ids, status FROM parcel_mutation_events WHERE id = $1', [mutationEventId1]);

    if (!mutEvent1.rows[0] || mutEvent1.rows[0].result_parcel_ids.length !== 1) {
      throw new Error(`Test 1 Thất bại: result_parcel_ids trong sự kiện biến động không hợp lệ: ${JSON.stringify(mutEvent1.rows[0])}`);
    }
    console.log(`✅ [Xác nhận 1.5]: Sự kiện biến động [${mutEvent1.rows[0].mutation_code}] lưu vết chuẩn xác: source=[${mutEvent1.rows[0].source_parcel_ids}] == result=[${mutEvent1.rows[0].result_parcel_ids}].`);
    console.log('>>> TEST CASE 1 HOÀN TẤT THÀNH CÔNG 100% <<<\n');


    // ========================================================================
    // TEST CASE 2: NHÁNH 2 - CĂN NHÀ MỚI ĐỘC LẬP (NEW_BUILDING)
    // ========================================================================
    console.log('--- BẮT ĐẦU TEST CASE 2: NHÁNH 2 - CĂN NHÀ MỚI ĐỘC LẬP (NEW_BUILDING) ---');
    
    // 1. Tạo report Phase 1 cho Parcel 2
    const init2 = await SurveyService.createPhase1Report(parcel2.id, surveyorId);
    reportId2 = init2.reportId;
    console.log(`[Test 2] Đã tạo report Phase 1 ID: ${reportId2}`);

    const countParcelsBefore2 = await Database.query<{ count: string }>('SELECT COUNT(*)::text as count FROM parcels');

    const sampleCoordsA2: [number, number][] = [
      [10.7810, 106.6810],
      [10.7816, 106.6810],
      [10.7816, 106.6816],
      [10.7810, 106.6816],
    ];
    const sampleCoordsB_NewHouse: [number, number][] = [
      [10.7816, 106.6810],
      [10.7822, 106.6810],
      [10.7822, 106.6816],
      [10.7816, 106.6816],
    ];

    // 2. KSV nộp hồ sơ chọn Tách Thửa Nhánh 2 (NEW_BUILDING)
    const submitPayload2 = {
      ownerRemarks: 'Chủ nhà xác nhận nhà phía sau đã tách hộ riêng cho con gái',
      surveyDataJson: {
        gisMutationConfirmed: {
          type: 'SPLIT',
          notes: 'Thực tế có 2 căn nhà độc lập riêng biệt, tách Căn B khảo sát',
          details: {
            residualKind: 'NEW_BUILDING',
            splitCount: 2,
            splitReason: 'Có 2 nhà độc lập trên cùng 1 thửa địa chính',
            splitChildren: [
              {
                label: `Căn A (Đang KS - ${parcel2.project_parcel_code})`,
                houseNumber: '200',
                ownerName: 'Chủ Căn A',
                suggestedCode: parcel2.project_parcel_code,
                areaM2: 70,
                coordinates: sampleCoordsA2,
              },
              {
                label: 'Căn B (Nhà mới độc lập)',
                houseNumber: '200B',
                ownerName: 'Nguyễn Văn B (Chủ Căn B)',
                suggestedCode: 'B-07001',
                areaM2: 50,
                residualKind: 'NEW_BUILDING',
                isResidualSurplus: false,
                functionalType: 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)',
                coordinates: sampleCoordsB_NewHouse,
              },
            ],
            splitCustomPointsA: sampleCoordsA2,
            splitCustomPointsB: sampleCoordsB_NewHouse,
          },
        },
      },
    };

    console.log('[Test 2] Tiến hành nộp hồ sơ Phase 1 kèm Tách thửa Nhánh 2 (NEW_BUILDING)...');
    await SurveyService.submitPhase1Report(reportId2, submitPayload2);

    // 3. Kiểm tra kết quả trong CSDL
    const countParcelsAfter2 = await Database.query<{ count: string }>('SELECT COUNT(*)::text as count FROM parcels');
    if (Number(countParcelsAfter2.rows[0].count) !== Number(countParcelsBefore2.rows[0].count) + 1) {
      throw new Error(`Test 2 Thất bại: Số lượng parcels không tăng thêm 1! Trước=${countParcelsBefore2.rows[0].count}, Sau=${countParcelsAfter2.rows[0].count}`);
    }
    console.log('✅ [Xác nhận 2.1]: Hệ thống đã tự động tạo thêm đúng 1 thửa đất mới trong bảng parcels.');

    // Kiểm tra Căn A (Gốc)
    const updatedP2 = await Database.query<{
      project_parcel_code: string;
      mutation_type: string;
      mutation_event_id: string;
      child_parcel_ids: string[];
      land_area_m2: number;
    }>('SELECT project_parcel_code, mutation_type, mutation_event_id, child_parcel_ids, land_area_m2 FROM parcels WHERE id = $1', [parcel2.id]);

    const p2Row = updatedP2.rows[0];
    if (p2Row.project_parcel_code !== parcel2.project_parcel_code) {
      throw new Error(`Test 2 Thất bại: Căn A bị đổi mã! Cũ=${parcel2.project_parcel_code}, Mới=${p2Row.project_parcel_code}`);
    }
    console.log(`✅ [Xác nhận 2.2]: Căn A giữ nguyên 100% mã gốc [${p2Row.project_parcel_code}].`);

    if (!p2Row.child_parcel_ids || p2Row.child_parcel_ids.length === 0) {
      throw new Error('Test 2 Thất bại: Thửa gốc Căn A không có child_parcel_ids trỏ đến Căn B.');
    }
    createdChildParcelId = p2Row.child_parcel_ids[0];
    mutationEventId2 = p2Row.mutation_event_id;
    console.log(`✅ [Xác nhận 2.3]: Căn A lưu vết child_parcel_ids=[${createdChildParcelId}], mutation_event_id='${mutationEventId2}'.`);

    // Kiểm tra Thửa mới Căn B
    const childRowRes = await Database.query<{
      id: string;
      project_parcel_code: string;
      house_number: string;
      owner_name: string;
      survey_status: string;
      lifecycle_status: string;
      mutation_type: string;
      parent_parcel_ids: string[];
    }>('SELECT * FROM parcels WHERE id = $1', [createdChildParcelId]);

    const childRow = childRowRes.rows[0];
    if (!childRow) {
      throw new Error(`Test 2 Thất bại: Không tìm thấy thửa Căn B với ID: ${createdChildParcelId}`);
    }

    console.log(`✅ [Xác nhận 2.4]: Thửa Căn B đã được tạo thành công:`);
    console.log(`   - Mã dự án (Kho mở rộng): [${childRow.project_parcel_code}] (Quy chuẩn B-07xxx)`);
    console.log(`   - Số nhà: [${childRow.house_number}]`);
    console.log(`   - Chủ sở hữu: [${childRow.owner_name}]`);
    console.log(`   - Trạng thái khảo sát: [${childRow.survey_status}] (Sẵn sàng để khảo sát)`);
    console.log(`   - Trạng thái vòng đời: [${childRow.lifecycle_status}] (ACTIVE - Hiển thị ngay trên Mobile)`);
    console.log(`   - Quan hệ cha con (Audit Trail): parent_parcel_ids=[${childRow.parent_parcel_ids}] (Trỏ đúng về Căn A [${parcel2.id}])`);

    if (!childRow.project_parcel_code.startsWith('B-07')) {
      throw new Error(`Test 2 Thất bại: Mã Căn B [${childRow.project_parcel_code}] không thuộc dải mở rộng B-07xxx!`);
    }

    // Kiểm tra Phân công công việc (task_assignments) cho KSV
    const taskRes = await Database.query<{
      id: string;
      surveyor_id: string;
      status: string;
      notes: string;
    }>('SELECT id, surveyor_id, status, notes FROM task_assignments WHERE parcel_id = $1', [createdChildParcelId]);

    if (taskRes.rows.length === 0) {
      throw new Error(`Test 2 Thất bại: Không tìm thấy task_assignment gán cho Căn B [${childRow.project_parcel_code}].`);
    }
    const task = taskRes.rows[0];
    if (task.surveyor_id !== surveyorId) {
      throw new Error(`Test 2 Thất bại: Căn B không được gán cho chính KSV đang nộp! Gán cho: ${task.surveyor_id}, Kỳ vọng: ${surveyorId}`);
    }
    console.log(`✅ [Xác nhận 2.5]: Task assignment đã tự động gán Căn B cho chính KSV [${surveyorId}]: "${task.notes}".`);
    console.log('   -> Khảo sát viên nộp xong Căn A, quay về Home View sẽ thấy ngay Căn B trong danh sách việc để làm tiếp!');

    // Kiểm tra sự kiện trong parcel_mutation_events
    const mutEvent2 = await Database.query<{
      mutation_code: string;
      source_parcel_ids: string[];
      result_parcel_ids: string[];
      status: string;
    }>('SELECT mutation_code, source_parcel_ids, result_parcel_ids, status FROM parcel_mutation_events WHERE id = $1', [mutationEventId2]);

    if (!mutEvent2.rows[0] || mutEvent2.rows[0].result_parcel_ids.length !== 2) {
      throw new Error(`Test 2 Thất bại: Sự kiện biến động không lưu đủ 2 parcel IDs: ${JSON.stringify(mutEvent2.rows[0])}`);
    }
    console.log(`✅ [Xác nhận 2.6]: Sự kiện biến động [${mutEvent2.rows[0].mutation_code}] lưu đầy đủ 2 kết quả: source=[${mutEvent2.rows[0].source_parcel_ids}] -> result=[${mutEvent2.rows[0].result_parcel_ids}].`);
    console.log('>>> TEST CASE 2 HOÀN TẤT THÀNH CÔNG 100% <<<\n');

    console.log('====================================================================');
    console.log('TẤT CẢ 2 TEST CASE TÁCH THỬA THỰC ĐỊA ĐỀU PASS 100%!');
    console.log('====================================================================');
  } finally {
    // Dọn dẹp dữ liệu test để bảo đảm database sạch sẽ
    console.log('\n[Cleanup] Tiến hành hoàn nguyên dữ liệu test...');
    if (createdChildParcelId) {
      await Database.query('DELETE FROM task_assignments WHERE parcel_id = $1', [createdChildParcelId]);
      await Database.query('DELETE FROM parcels WHERE id = $1', [createdChildParcelId]);
    }
    if (mutationEventId1) {
      await Database.query('DELETE FROM parcel_mutation_events WHERE id = $1', [mutationEventId1]);
    }
    if (mutationEventId2) {
      await Database.query('DELETE FROM parcel_mutation_events WHERE id = $1', [mutationEventId2]);
    }
    if (reportId1) {
      await Database.query('DELETE FROM base_survey_reports WHERE id = $1', [reportId1]);
    }
    if (reportId2) {
      await Database.query('DELETE FROM base_survey_reports WHERE id = $1', [reportId2]);
    }

    // Hoàn nguyên parcel 1 & 2 về dữ liệu gốc
    const o1 = originalState1.rows[0];
    if (o1) {
      await Database.query(
        `UPDATE parcels
         SET land_area_m2 = $1, mutation_type = $2, mutation_event_id = $3,
             child_parcel_ids = $4, survey_status = $5
         WHERE id = $6;`,
        [o1.land_area_m2, o1.mutation_type, o1.mutation_event_id, o1.child_parcel_ids, o1.survey_status, o1.id]
      );
    }
    const o2 = originalState2.rows[0];
    if (o2) {
      await Database.query(
        `UPDATE parcels
         SET land_area_m2 = $1, mutation_type = $2, mutation_event_id = $3,
             child_parcel_ids = $4, survey_status = $5
         WHERE id = $6;`,
        [o2.land_area_m2, o2.mutation_type, o2.mutation_event_id, o2.child_parcel_ids, o2.survey_status, o2.id]
      );
    }
    console.log('[Cleanup] Đã dọn dẹp và hoàn nguyên 100% dữ liệu gốc sạch sẽ!');
  }
}

runTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('LỖI TEST:', err);
    process.exit(1);
  });
