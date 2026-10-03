import { Database } from '../database/db';
import { SurveyBaseRepository } from '../modules/survey/repositories/survey-base.repository';

/**
 * KIỂM THỬ TỰ ĐỘNG TOÀN TRÌNH LOGIC BIẾN ĐỘNG THỰC ĐỊA CỦA SURVEYOR (PHASE 1 SURVEY)
 * 
 * Kiểm tra 4 Kịch Bản Theo Chuẩn Điều 3.3 Quy Chuẩn Kiến Trúc:
 * 1. Tách thửa - Đất dôi dư/Sân vườn (NON_BUILDING -> Thửa A giữ mã gốc, sinh {Mã}-DU, NOT_SURVEYED, ACTIVE)
 * 2. Tách thửa - Căn nhà mới độc lập (NEW_BUILDING -> Thửa A giữ mã gốc, sinh Lô B Max Zone + 1, ASSIGNED_TO_ME, ACTIVE)
 * 3. Gộp thửa - 100% công trình (Thửa chính mang tổng diện tích, thửa phụ -> MERGED_DEPRECATED)
 * 4. Gộp thửa - Có đất dôi dư (Thửa chính mang S_xd, thửa phụ -> MERGED_DEPRECATED, sinh {Mã}-DU mang S_du = S_tong - S_xd)
 */
async function runSurveyorFieldMutationsTest() {
  console.log('\n======================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN 4 KỊCH BẢN BIẾN ĐỘNG THỰC ĐỊA CỦA SURVEYOR');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;
  const createdParcelIds: string[] = [];
  const createdReportIds: string[] = [];

  const SAMPLE_POLYGON_WKT_1 = 'POLYGON((106.7110 10.7920, 106.7115 10.7920, 106.7115 10.7925, 106.7110 10.7925, 106.7110 10.7920))';
  const SAMPLE_POLYGON_WKT_2 = 'POLYGON((106.7116 10.7920, 106.7120 10.7920, 106.7120 10.7925, 106.7116 10.7925, 106.7116 10.7920))';

  try {
    // 1. Lấy surveyor và zone hợp lệ
    const surveyorRes = await Database.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'SURVEYOR' LIMIT 1;`
    );
    const surveyorId = surveyorRes.rows[0]?.id;
    if (!surveyorId) throw new Error('Không tìm thấy tài khoản SURVEYOR trong hệ thống.');

    const zoneRes = await Database.query<{ zone_id: string }>(
      `SELECT DISTINCT zone_id FROM parcels LIMIT 1;`
    );
    const zoneId = zoneRes.rows[0]?.zone_id || 'ZONE_01';

    // 2. Dọn dẹp dữ liệu test cũ
    await Database.query(`DELETE FROM parcels WHERE project_parcel_code LIKE 'TEST_FS_%';`);

    // ======================================================================
    // TEST 1: TÁCH THỬA - ĐẤT DÔI DƯ / SÂN VƯỜN (NON_BUILDING)
    // ======================================================================
    console.log('📌 [KỊCH BẢN 1] Kiểm tra Tách thửa - Đất dôi dư/Sân vườn (NON_BUILDING)...');
    total += 3;

    const p1Res = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        zone_id, official_cadastral_code, project_parcel_code, house_number, street,
        owner_name, land_area_m2, construction_area_m2, survey_status, lifecycle_status,
        assigned_surveyor_id, cadastral_polygon_geom, footprint_polygon_geom, location_geom
      ) VALUES (
        $1, 'DC_FS_01', 'TEST_FS_01', '101A', 'Đường Test',
        'Ông Nguyễn Văn A', 100.0, 100.0, 'ASSIGNED_TO_ME', 'ACTIVE',
        $2, ST_SetSRID(ST_GeomFromText($3), 4326), ST_SetSRID(ST_GeomFromText($3), 4326), ST_Centroid(ST_SetSRID(ST_GeomFromText($3), 4326))
      ) RETURNING id;`,
      [zoneId, surveyorId, SAMPLE_POLYGON_WKT_1]
    );
    const p1Id = p1Res.rows[0].id;
    createdParcelIds.push(p1Id);

    const r1Res = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
        parcel_id, surveyor_id, report_code, phase, status
      ) VALUES (
        $1, $2, 'REP_FS_01', 'PHASE_1', 'DRAFT'
      ) RETURNING id;`,
      [p1Id, surveyorId]
    );
    const r1Id = r1Res.rows[0].id;
    createdReportIds.push(r1Id);

    // KSV nộp báo cáo với biến động tách đất dôi dư
    await SurveyBaseRepository.submitReport(r1Id, {
      ownerName: 'Ông Nguyễn Văn A',
      surveyDataJson: {
        gisMutationConfirmed: {
          type: 'SPLIT',
          notes: 'Thực tế có 30m2 đất vườn dôi dư phía sau',
          details: {
            activeProposalType: 'SPLIT',
            residualKind: 'NON_BUILDING',
            splitReason: 'Có 30m2 đất dôi dư phía sau',
            splitChildren: [
              { label: 'Căn A (Đang KS)', areaM2: 70, residualKind: 'NON_BUILDING' },
              { label: 'Đất dôi dư', areaM2: 30, residualKind: 'NON_BUILDING' }
            ]
          }
        }
      }
    });

    // Kiểm tra Thửa A
    const checkA1 = await Database.query<{ land_area_m2: number; mutation_type: string; survey_status: string }>(
      `SELECT land_area_m2, mutation_type, survey_status FROM parcels WHERE id = $1;`,
      [p1Id]
    );
    if (Number(checkA1.rows[0]?.land_area_m2) === 70 && checkA1.rows[0]?.mutation_type === 'SPLIT') {
      console.log('   ✅ Thửa A giữ mã TEST_FS_01, diện tích cập nhật thành 70m², mutation_type = SPLIT.');
      passed++;
    } else {
      console.error('   ❌ Thửa A không đúng kỳ vọng:', checkA1.rows[0]);
    }

    // Kiểm tra Thửa Đất dư {Mã}-DU
    const checkDu1 = await Database.query<{
      id: string;
      project_parcel_code: string;
      land_area_m2: number;
      survey_status: string;
      lifecycle_status: string;
    }>(
      `SELECT id, project_parcel_code, land_area_m2, survey_status, lifecycle_status 
       FROM parcels 
       WHERE project_parcel_code = 'TEST_FS_01-DU';`
    );
    if (
      checkDu1.rows[0] &&
      Number(checkDu1.rows[0].land_area_m2) === 30 &&
      checkDu1.rows[0].survey_status === 'NOT_SURVEYED' &&
      checkDu1.rows[0].lifecycle_status === 'ACTIVE'
    ) {
      console.log('   ✅ Đã tự động sinh thửa [TEST_FS_01-DU] với 30m², NOT_SURVEYED, ACTIVE.');
      createdParcelIds.push(checkDu1.rows[0].id);
      passed++;
    } else {
      console.error('   ❌ Thửa đất dư TEST_FS_01-DU không đúng kỳ vọng:', checkDu1.rows[0]);
    }

    // Kiểm tra sự kiện biến động parcel_mutation_events
    const checkEv1 = await Database.query<{ mutation_type: string; source_parcel_ids: string[]; result_parcel_ids: string[] }>(
      `SELECT mutation_type, source_parcel_ids, result_parcel_ids 
       FROM parcel_mutation_events 
       WHERE $1 = ANY(source_parcel_ids);`,
      [p1Id]
    );
    if (checkEv1.rows[0]?.mutation_type === 'SPLIT' && checkEv1.rows[0]?.result_parcel_ids?.length >= 2) {
      console.log('   ✅ Bản ghi parcel_mutation_events đã lưu vết đầy đủ source & result parcels.');
      passed++;
    } else {
      console.error('   ❌ Sự kiện biến động không đúng kỳ vọng:', checkEv1.rows[0]);
    }

    // ======================================================================
    // TEST 2: TÁCH THỬA - CĂN NHÀ MỚI ĐỘC LẬP (NEW_BUILDING)
    // ======================================================================
    console.log('\n📌 [KỊCH BẢN 2] Kiểm tra Tách thửa - Căn nhà mới độc lập (NEW_BUILDING)...');
    total += 3;

    const p2Res = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        zone_id, official_cadastral_code, project_parcel_code, house_number, street,
        owner_name, land_area_m2, construction_area_m2, survey_status, lifecycle_status,
        assigned_surveyor_id, cadastral_polygon_geom, footprint_polygon_geom, location_geom
      ) VALUES (
        $1, 'DC_FS_02', 'TEST_FS_02', '102A', 'Đường Test',
        'Bà Trần Thị B', 120.0, 120.0, 'ASSIGNED_TO_ME', 'ACTIVE',
        $2, ST_SetSRID(ST_GeomFromText($3), 4326), ST_SetSRID(ST_GeomFromText($3), 4326), ST_Centroid(ST_SetSRID(ST_GeomFromText($3), 4326))
      ) RETURNING id;`,
      [zoneId, surveyorId, SAMPLE_POLYGON_WKT_1]
    );
    const p2Id = p2Res.rows[0].id;
    createdParcelIds.push(p2Id);

    const r2Res = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
        parcel_id, surveyor_id, report_code, phase, status
      ) VALUES (
        $1, $2, 'REP_FS_02', 'PHASE_1', 'DRAFT'
      ) RETURNING id;`,
      [p2Id, surveyorId]
    );
    const r2Id = r2Res.rows[0].id;
    createdReportIds.push(r2Id);

    await SurveyBaseRepository.submitReport(r2Id, {
      ownerName: 'Bà Trần Thị B',
      surveyDataJson: {
        gisMutationConfirmed: {
          type: 'SPLIT',
          notes: 'Thực tế đã tách thêm 1 căn nhà độc lập',
          details: {
            activeProposalType: 'SPLIT',
            residualKind: 'NEW_BUILDING',
            splitReason: 'Tách nhà mới cho con',
            splitChildren: [
              { label: 'Căn A (Đang KS)', areaM2: 65, residualKind: 'NON_BUILDING' },
              {
                label: 'Căn B (Nhà mới độc lập)',
                areaM2: 55,
                residualKind: 'NEW_BUILDING',
                ownerName: 'Trần Văn C (Con)',
                houseNumber: '102B'
              }
            ]
          }
        }
      }
    });

    // Kiểm tra Thửa A
    const checkA2 = await Database.query<{ land_area_m2: number; mutation_type: string }>(
      `SELECT land_area_m2, mutation_type FROM parcels WHERE id = $1;`,
      [p2Id]
    );
    if (Number(checkA2.rows[0]?.land_area_m2) === 65 && checkA2.rows[0]?.mutation_type === 'SPLIT') {
      console.log('   ✅ Thửa A giữ mã TEST_FS_02, diện tích cập nhật thành 65m².');
      passed++;
    } else {
      console.error('   ❌ Thửa A không đúng kỳ vọng:', checkA2.rows[0]);
    }

    // Kiểm tra Thửa Căn B mới độc lập
    const checkNewB = await Database.query<{
      id: string;
      project_parcel_code: string;
      land_area_m2: number;
      assigned_surveyor_id: string;
      survey_status: string;
      lifecycle_status: string;
      owner_name: string;
    }>(
      `SELECT id, project_parcel_code, land_area_m2, assigned_surveyor_id, survey_status, lifecycle_status, owner_name 
       FROM parcels 
       WHERE $1 = ANY(parent_parcel_ids);`,
      [p2Id]
    );
    const newB = checkNewB.rows[0];
    if (
      newB &&
      Number(newB.land_area_m2) === 55 &&
      newB.assigned_surveyor_id === surveyorId &&
      newB.survey_status === 'ASSIGNED_TO_ME' &&
      newB.lifecycle_status === 'ACTIVE'
    ) {
      console.log(`   ✅ Đã sinh Thửa mới Căn B [${newB.project_parcel_code}] (${newB.land_area_m2}m²), tự động gán cho KSV (${surveyorId}) tiếp tục khảo sát.`);
      createdParcelIds.push(newB.id);
      passed++;
    } else {
      console.error('   ❌ Thửa Căn B mới không đúng kỳ vọng:', newB);
    }

    // Kiểm tra sự kiện biến động
    const checkEv2 = await Database.query<{ result_parcel_ids: string[] }>(
      `SELECT result_parcel_ids FROM parcel_mutation_events WHERE $1 = ANY(source_parcel_ids);`,
      [p2Id]
    );
    if (checkEv2.rows[0]?.result_parcel_ids?.includes(p2Id) && checkEv2.rows[0]?.result_parcel_ids?.includes(newB?.id)) {
      console.log('   ✅ Sự kiện biến động đã liên kết cả Thửa A và Thửa B.');
      passed++;
    } else {
      console.error('   ❌ Sự kiện biến động kịch bản 2 lỗi:', checkEv2.rows[0]);
    }

    // ======================================================================
    // TEST 3: GỘP THỬA - 100% CÔNG TRÌNH
    // ======================================================================
    console.log('\n📌 [KỊCH BẢN 3] Kiểm tra Gộp thửa - 100% công trình...');
    total += 3;

    const p3Res = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        zone_id, official_cadastral_code, project_parcel_code, house_number, street,
        owner_name, land_area_m2, construction_area_m2, survey_status, lifecycle_status,
        assigned_surveyor_id, cadastral_polygon_geom, footprint_polygon_geom, location_geom
      ) VALUES (
        $1, 'DC_FS_03', 'TEST_FS_03', '103', 'Đường Test',
        'Lê Văn D', 80.0, 80.0, 'ASSIGNED_TO_ME', 'ACTIVE',
        $2, ST_SetSRID(ST_GeomFromText($3), 4326), ST_SetSRID(ST_GeomFromText($3), 4326), ST_Centroid(ST_SetSRID(ST_GeomFromText($3), 4326))
      ) RETURNING id;`,
      [zoneId, surveyorId, SAMPLE_POLYGON_WKT_1]
    );
    const p3Id = p3Res.rows[0].id;
    createdParcelIds.push(p3Id);

    const p4Res = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        zone_id, official_cadastral_code, project_parcel_code, house_number, street,
        owner_name, land_area_m2, construction_area_m2, survey_status, lifecycle_status,
        assigned_surveyor_id, cadastral_polygon_geom, footprint_polygon_geom, location_geom
      ) VALUES (
        $1, 'DC_FS_04', 'TEST_FS_04', '105', 'Đường Test',
        'Lê Văn E', 60.0, 60.0, 'NOT_SURVEYED', 'ACTIVE',
        $2, ST_SetSRID(ST_GeomFromText($3), 4326), ST_SetSRID(ST_GeomFromText($3), 4326), ST_Centroid(ST_SetSRID(ST_GeomFromText($3), 4326))
      ) RETURNING id;`,
      [zoneId, surveyorId, SAMPLE_POLYGON_WKT_2]
    );
    const p4Id = p4Res.rows[0].id;
    createdParcelIds.push(p4Id);

    const r3Res = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
        parcel_id, surveyor_id, report_code, phase, status
      ) VALUES (
        $1, $2, 'REP_FS_03', 'PHASE_1', 'DRAFT'
      ) RETURNING id;`,
      [p3Id, surveyorId]
    );
    const r3Id = r3Res.rows[0].id;
    createdReportIds.push(r3Id);

    await SurveyBaseRepository.submitReport(r3Id, {
      ownerName: 'Lê Văn D',
      surveyDataJson: {
        gisMutationConfirmed: {
          type: 'MERGE',
          notes: 'Đã xây 1 căn nhà chung trên cả 2 thửa 103 và 105',
          details: {
            activeProposalType: 'MERGE',
            selectedMergeCodes: ['TEST_FS_04'],
            mergeHasPartialBuilding: false,
            mergeReason: 'Hai thửa đã hợp nhất thành một nhà'
          }
        }
      }
    });

    // Kiểm tra Thửa chính
    const checkP3 = await Database.query<{ land_area_m2: number; mutation_type: string; survey_status: string }>(
      `SELECT land_area_m2, mutation_type, survey_status FROM parcels WHERE id = $1;`,
      [p3Id]
    );
    if (Number(checkP3.rows[0]?.land_area_m2) === 140 && checkP3.rows[0]?.mutation_type === 'MERGE') {
      console.log('   ✅ Thửa chính TEST_FS_03 kế thừa tổng diện tích gộp = 140m² (80 + 60), mutation_type = MERGE.');
      passed++;
    } else {
      console.error('   ❌ Thửa chính TEST_FS_03 không đúng kỳ vọng:', checkP3.rows[0]);
    }

    // Kiểm tra Thửa phụ
    const checkP4 = await Database.query<{ lifecycle_status: string; mutation_type: string; parent_parcel_ids: string[] }>(
      `SELECT lifecycle_status, mutation_type, parent_parcel_ids FROM parcels WHERE id = $1;`,
      [p4Id]
    );
    if (
      checkP4.rows[0]?.lifecycle_status === 'MERGED_DEPRECATED' &&
      checkP4.rows[0]?.mutation_type === 'MERGE' &&
      checkP4.rows[0]?.parent_parcel_ids?.includes(p3Id)
    ) {
      console.log('   ✅ Thửa phụ TEST_FS_04 đã chuyển sang MERGED_DEPRECATED và trỏ về thửa chính.');
      passed++;
    } else {
      console.error('   ❌ Thửa phụ TEST_FS_04 không đúng kỳ vọng:', checkP4.rows[0]);
    }

    // Kiểm tra sự kiện biến động
    const checkEv3 = await Database.query<{ source_parcel_ids: string[] }>(
      `SELECT source_parcel_ids FROM parcel_mutation_events WHERE $1 = ANY(source_parcel_ids);`,
      [p3Id]
    );
    if (checkEv3.rows[0]?.source_parcel_ids?.includes(p3Id) && checkEv3.rows[0]?.source_parcel_ids?.includes(p4Id)) {
      console.log('   ✅ Sự kiện biến động gộp lưu đầy đủ nguồn gồm cả 2 thửa.');
      passed++;
    } else {
      console.error('   ❌ Sự kiện biến động gộp 100% lỗi:', checkEv3.rows[0]);
    }

    // ======================================================================
    // TEST 4: GỘP THỬA - CÓ ĐẤT DÔI DƯ NGOÀI CÔNG TRÌNH
    // ======================================================================
    console.log('\n📌 [KỊCH BẢN 4] Kiểm tra Gộp thửa - Có đất dôi dư ngoài công trình...');
    total += 4;

    const p5Res = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        zone_id, official_cadastral_code, project_parcel_code, house_number, street,
        owner_name, land_area_m2, construction_area_m2, survey_status, lifecycle_status,
        assigned_surveyor_id, cadastral_polygon_geom, footprint_polygon_geom, location_geom
      ) VALUES (
        $1, 'DC_FS_05', 'TEST_FS_05', '201', 'Đường Test',
        'Hoàng Văn F', 100.0, 100.0, 'ASSIGNED_TO_ME', 'ACTIVE',
        $2, ST_SetSRID(ST_GeomFromText($3), 4326), ST_SetSRID(ST_GeomFromText($3), 4326), ST_Centroid(ST_SetSRID(ST_GeomFromText($3), 4326))
      ) RETURNING id;`,
      [zoneId, surveyorId, SAMPLE_POLYGON_WKT_1]
    );
    const p5Id = p5Res.rows[0].id;
    createdParcelIds.push(p5Id);

    const p6Res = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        zone_id, official_cadastral_code, project_parcel_code, house_number, street,
        owner_name, land_area_m2, construction_area_m2, survey_status, lifecycle_status,
        assigned_surveyor_id, cadastral_polygon_geom, footprint_polygon_geom, location_geom
      ) VALUES (
        $1, 'DC_FS_06', 'TEST_FS_06', '203', 'Đường Test',
        'Hoàng Văn G', 100.0, 100.0, 'NOT_SURVEYED', 'ACTIVE',
        $2, ST_SetSRID(ST_GeomFromText($3), 4326), ST_SetSRID(ST_GeomFromText($3), 4326), ST_Centroid(ST_SetSRID(ST_GeomFromText($3), 4326))
      ) RETURNING id;`,
      [zoneId, surveyorId, SAMPLE_POLYGON_WKT_2]
    );
    const p6Id = p6Res.rows[0].id;
    createdParcelIds.push(p6Id);

    const r5Res = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
        parcel_id, surveyor_id, report_code, phase, status
      ) VALUES (
        $1, $2, 'REP_FS_05', 'PHASE_1', 'DRAFT'
      ) RETURNING id;`,
      [p5Id, surveyorId]
    );
    const r5Id = r5Res.rows[0].id;
    createdReportIds.push(r5Id);

    // Tổng diện tích 2 thửa = 200m². Công trình chiếm 130m², dôi dư 70m² đất vườn
    await SurveyBaseRepository.submitReport(r5Id, {
      ownerName: 'Hoàng Văn F',
      surveyDataJson: {
        gisMutationConfirmed: {
          type: 'MERGE',
          notes: 'Gộp 2 thửa nhưng nhà chỉ xây 130m2, còn 70m2 đất vườn phía sau',
          details: {
            activeProposalType: 'MERGE',
            selectedMergeCodes: ['TEST_FS_06'],
            mergeHasPartialBuilding: true,
            mergeBuildingAreaM2: 130,
            mergeResidualAreaM2: 70,
            mergeReason: 'Xây dựng 130m2 trên 2 thửa, còn lại 70m2 sân vườn dôi dư'
          }
        }
      }
    });

    // Kiểm tra Thửa chính
    const checkP5 = await Database.query<{ land_area_m2: number; construction_area_m2: number; mutation_type: string }>(
      `SELECT land_area_m2, construction_area_m2, mutation_type FROM parcels WHERE id = $1;`,
      [p5Id]
    );
    if (Number(checkP5.rows[0]?.land_area_m2) === 130 && checkP5.rows[0]?.mutation_type === 'MERGE') {
      console.log('   ✅ Thửa chính TEST_FS_05 mang đúng diện tích xây dựng = 130m².');
      passed++;
    } else {
      console.error('   ❌ Thửa chính TEST_FS_05 không đúng kỳ vọng:', checkP5.rows[0]);
    }

    // Kiểm tra Thửa phụ
    const checkP6 = await Database.query<{ lifecycle_status: string }>(
      `SELECT lifecycle_status FROM parcels WHERE id = $1;`,
      [p6Id]
    );
    if (checkP6.rows[0]?.lifecycle_status === 'MERGED_DEPRECATED') {
      console.log('   ✅ Thửa phụ TEST_FS_06 chuyển sang MERGED_DEPRECATED.');
      passed++;
    } else {
      console.error('   ❌ Thửa phụ TEST_FS_06 không đúng kỳ vọng:', checkP6.rows[0]);
    }

    // Kiểm tra Thửa đất dôi dư sau gộp {Mã}-DU
    const checkDu5 = await Database.query<{
      id: string;
      project_parcel_code: string;
      land_area_m2: number;
      survey_status: string;
      lifecycle_status: string;
    }>(
      `SELECT id, project_parcel_code, land_area_m2, survey_status, lifecycle_status 
       FROM parcels 
       WHERE project_parcel_code = 'TEST_FS_05-DU';`
    );
    if (
      checkDu5.rows[0] &&
      Number(checkDu5.rows[0].land_area_m2) === 70 &&
      checkDu5.rows[0].survey_status === 'NOT_SURVEYED' &&
      checkDu5.rows[0].lifecycle_status === 'ACTIVE'
    ) {
      console.log('   ✅ Đã tự động sinh thửa đất dư sau gộp [TEST_FS_05-DU] với 70m² (200m² - 130m²), NOT_SURVEYED, ACTIVE.');
      createdParcelIds.push(checkDu5.rows[0].id);
      passed++;
    } else {
      console.error('   ❌ Thửa đất dư sau gộp TEST_FS_05-DU không đúng kỳ vọng:', checkDu5.rows[0]);
    }

    // Kiểm tra sự kiện biến động
    const checkEv5 = await Database.query<{ result_parcel_ids: string[] }>(
      `SELECT result_parcel_ids FROM parcel_mutation_events WHERE $1 = ANY(source_parcel_ids);`,
      [p5Id]
    );
    if (checkEv5.rows[0]?.result_parcel_ids?.includes(p5Id) && checkEv5.rows[0]?.result_parcel_ids?.includes(checkDu5.rows[0]?.id)) {
      console.log('   ✅ Sự kiện biến động đã ghi nhận cả Thửa chính và Thửa đất dư sau gộp.');
      passed++;
    } else {
      console.error('   ❌ Sự kiện biến động kịch bản 4 lỗi:', checkEv5.rows[0]);
    }

  } catch (err) {
    console.error('💥 LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', err);
  } finally {
    // 3. Dọn dẹp dữ liệu test
    console.log('\n🧹 Dọn dẹp dữ liệu test...');
    try {
      if (createdReportIds.length > 0) {
        await Database.query(`DELETE FROM base_survey_reports WHERE id = ANY($1::uuid[]);`, [createdReportIds]);
      }
      if (createdParcelIds.length > 0) {
        await Database.query(`DELETE FROM parcel_mutation_events WHERE source_parcel_ids && $1::uuid[];`, [createdParcelIds]);
        await Database.query(`DELETE FROM parcels WHERE id = ANY($1::uuid[]);`, [createdParcelIds]);
      }
      await Database.query(`DELETE FROM parcels WHERE project_parcel_code LIKE 'TEST_FS_%';`);
      console.log('   ✅ Dọn dẹp dữ liệu test thành công.');
    } catch (cleanupErr) {
      console.warn('   ⚠️ Cảnh báo dọn dẹp:', cleanupErr);
    }

    console.log('\n======================================================================');
    console.log(`📊 KẾT QUẢ KIỂM ĐỊNH: ${passed}/${total} TIÊU CHÍ ĐẠT (${Math.round((passed / total) * 100)}%)`);
    if (passed === total) {
      console.log('🎉 TẤT CẢ 4 KỊCH BẢN BIẾN ĐỘNG THỰC ĐỊA CỦA SURVEYOR ĐỀU ĐẠT CHUẨN 100%!');
    } else {
      console.error('⚠️ CÓ TIÊU CHÍ CHƯA ĐẠT - VUI LÒNG KIỂM TRA LOGS Ở TRÊN.');
    }
    console.log('======================================================================\n');
  }
}

runSurveyorFieldMutationsTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
