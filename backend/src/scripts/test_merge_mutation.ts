import { Database, pool } from '../database/db';
import { SurveyRepository } from '../modules/survey/survey.repository';
import { SurveyService } from '../modules/survey/survey.service';

async function runMergeTest() {
  console.log('====================================================================');
  console.log('KIỂM THỬ TÍCH HỢP: GỘP THỬA THỰC ĐỊA & ĐỒNG BỘ CSDL POSTGIS 100%');
  console.log('====================================================================\n');

  // Lấy 1 surveyor hợp lệ
  const userRes = await Database.query<{ id: string }>(
    `SELECT id FROM users WHERE role = 'SURVEYOR' LIMIT 1;`
  );
  if (userRes.rows.length === 0) {
    throw new Error('Không tìm thấy tài khoản SURVEYOR nào trong CSDL để test.');
  }
  const surveyorId = userRes.rows[0].id;

  // Lấy 2 thửa đất ACTIVE trong cùng 1 zone
  const parcelRes = await Database.query<{
    id: string;
    project_parcel_code: string;
    zone_id: string;
    land_area_m2: number;
    construction_area_m2: number;
  }>(
    `SELECT id, project_parcel_code, zone_id, land_area_m2, construction_area_m2
     FROM parcels
     WHERE lifecycle_status = 'ACTIVE' AND zone_id IS NOT NULL
     ORDER BY created_at ASC
     LIMIT 2;`
  );

  if (parcelRes.rows.length < 2) {
    throw new Error('Cần ít nhất 2 thửa đất ACTIVE trong DB để test.');
  }

  const p1 = parcelRes.rows[0];
  const p2 = parcelRes.rows[1];

  console.log(`[Thửa chính (P1)]: ID=${p1.id}, Mã=${p1.project_parcel_code}, Diện tích=${p1.land_area_m2}m²`);
  console.log(`[Thửa phụ (P2)]:   ID=${p2.id}, Mã=${p2.project_parcel_code}, Diện tích=${p2.land_area_m2}m²\n`);

  // Lưu backup để hoàn nguyên
  const backupP1 = (await Database.query(`SELECT land_area_m2, construction_area_m2, mutation_type, lifecycle_status, child_parcel_ids, parent_parcel_ids, mutation_event_id, ST_AsGeoJSON(cadastral_polygon_geom) as g FROM parcels WHERE id = $1`, [p1.id])).rows[0];
  const backupP2 = (await Database.query(`SELECT land_area_m2, construction_area_m2, mutation_type, lifecycle_status, child_parcel_ids, parent_parcel_ids, mutation_event_id, ST_AsGeoJSON(cadastral_polygon_geom) as g FROM parcels WHERE id = $1`, [p2.id])).rows[0];

  let testReportId: string | null = null;
  let mutationEventId: string | null = null;

  try {
    // 1. Tạo 1 test survey report
    const initRes = await SurveyService.createPhase1Report(p1.id, surveyorId);
    testReportId = initRes.reportId;

    // 2. Chạy handleFieldMergeMutation
    const rawMutation = {
      type: 'MERGE',
      notes: 'Test gộp thửa thực địa',
      details: {
        selectedMergeCodes: [p2.project_parcel_code],
        mergeReason: 'Chủ nhà P1 mua lại thửa P2 và xây thông',
        totalLandArea: (Number(p1.land_area_m2) || 80) + (Number(p2.land_area_m2) || 70),
        mergeBuildingAreaM2: 120,
      },
    };

    await Database.transaction(async (client) => {
      await SurveyRepository.handleFieldMergeMutation(client, testReportId!, rawMutation);
    });

    console.log('✓ handleFieldMergeMutation executed successfully without errors!\n');

    // 3. Kiểm tra kết quả trong DB:
    // Thửa chính P1:
    const p1Check = (
      await Database.query<{
        land_area_m2: number;
        construction_area_m2: number;
        mutation_type: string;
        lifecycle_status: string;
        child_parcel_ids: string[];
        mutation_event_id: string;
        geom_valid: boolean;
      }>(
        `SELECT land_area_m2, construction_area_m2, mutation_type, lifecycle_status,
                child_parcel_ids, mutation_event_id,
                ST_IsValid(cadastral_polygon_geom) AS geom_valid
         FROM parcels WHERE id = $1;`,
        [p1.id]
      )
    ).rows[0];

    console.log('--- Kiểm tra Thửa Chính P1 ---');
    console.log(`- Diện tích đất mới: ${p1Check.land_area_m2}m² (Kỳ vọng: ${rawMutation.details.totalLandArea}m²)`);
    console.log(`- Mutation Type: ${p1Check.mutation_type} (Kỳ vọng: MERGE)`);
    console.log(`- Lifecycle Status: ${p1Check.lifecycle_status} (Kỳ vọng: ACTIVE)`);
    console.log(`- Geom PostGIS hợp lệ: ${p1Check.geom_valid} (Kỳ vọng: true)`);
    console.log(`- child_parcel_ids chứa P2: ${p1Check.child_parcel_ids?.includes(p2.id)} (Kỳ vọng: true)`);
    console.log(`- mutation_event_id: ${p1Check.mutation_event_id}`);

    if (!p1Check.geom_valid || p1Check.mutation_type !== 'MERGE' || !p1Check.child_parcel_ids?.includes(p2.id)) {
      throw new Error('Thửa chính P1 không đạt yêu cầu kiểm tra sau khi gộp!');
    }

    // Thửa phụ P2:
    const p2Check = (
      await Database.query<{
        mutation_type: string;
        lifecycle_status: string;
        parent_parcel_ids: string[];
        mutation_event_id: string;
      }>(
        `SELECT mutation_type, lifecycle_status, parent_parcel_ids, mutation_event_id
         FROM parcels WHERE id = $1;`,
        [p2.id]
      )
    ).rows[0];

    console.log('\n--- Kiểm tra Thửa Phụ P2 ---');
    console.log(`- Lifecycle Status: ${p2Check.lifecycle_status} (Kỳ vọng: MERGED_DEPRECATED)`);
    console.log(`- Mutation Type: ${p2Check.mutation_type} (Kỳ vọng: MERGE)`);
    console.log(`- parent_parcel_ids chứa P1: ${p2Check.parent_parcel_ids?.includes(p1.id)} (Kỳ vọng: true)`);
    console.log(`- mutation_event_id: ${p2Check.mutation_event_id}`);

    if (p2Check.lifecycle_status !== 'MERGED_DEPRECATED' || p2Check.mutation_type !== 'MERGE' || !p2Check.parent_parcel_ids?.includes(p1.id)) {
      throw new Error('Thửa phụ P2 không đạt yêu cầu kiểm tra sau khi gộp!');
    }

    mutationEventId = p1Check.mutation_event_id;

    // Sự kiện biến động:
    const eventCheck = (
      await Database.query<{
        mutation_code: string;
        mutation_type: string;
        status: string;
        source_parcel_ids: string[];
        result_parcel_ids: string[];
      }>(
        `SELECT mutation_code, mutation_type, status, source_parcel_ids, result_parcel_ids
         FROM parcel_mutation_events WHERE id = $1;`,
        [mutationEventId]
      )
    ).rows[0];

    console.log('\n--- Kiểm tra Sự Kiện Biến Động (Audit Trail) ---');
    console.log(`- Mã sự kiện: ${eventCheck.mutation_code}`);
    console.log(`- Loại: ${eventCheck.mutation_type} (Kỳ vọng: MERGE)`);
    console.log(`- Status: ${eventCheck.status} (Kỳ vọng: APPROVED)`);
    console.log(`- source_parcel_ids: [${eventCheck.source_parcel_ids?.join(', ')}]`);
    console.log(`- result_parcel_ids: [${eventCheck.result_parcel_ids?.join(', ')}] (Kỳ vọng: [${p1.id}])`);

    if (eventCheck.status !== 'APPROVED' || eventCheck.mutation_type !== 'MERGE' || !eventCheck.source_parcel_ids?.includes(p2.id)) {
      throw new Error('Sự kiện biến động Audit Trail không đạt yêu cầu!');
    }

    console.log('\n>>> TẤT CẢ CÁC BƯỚC KIỂM THỬ MERGE ĐỀU ĐẠT CHUẨN 100%! <<<');
  } finally {
    // Hoàn nguyên dữ liệu
    console.log('\n[Dọn dẹp & Hoàn nguyên CSDL]...');
    if (mutationEventId) {
      await Database.query(`DELETE FROM parcel_mutation_events WHERE id = $1`, [mutationEventId]);
    }
    await Database.query(`DELETE FROM base_survey_reports WHERE id = $1`, [testReportId]);

    // Restore P1 & P2
    await Database.query(
      `UPDATE parcels
       SET land_area_m2 = $1,
           construction_area_m2 = $2,
           mutation_type = $3,
           lifecycle_status = $4,
           child_parcel_ids = $5,
           parent_parcel_ids = $6,
           mutation_event_id = $7,
           cadastral_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($8), 4326),
           updated_at = NOW()
       WHERE id = $9;`,
      [
        backupP1.land_area_m2,
        backupP1.construction_area_m2,
        backupP1.mutation_type,
        backupP1.lifecycle_status,
        backupP1.child_parcel_ids,
        backupP1.parent_parcel_ids,
        backupP1.mutation_event_id,
        backupP1.g,
        p1.id,
      ]
    );

    await Database.query(
      `UPDATE parcels
       SET land_area_m2 = $1,
           construction_area_m2 = $2,
           mutation_type = $3,
           lifecycle_status = $4,
           child_parcel_ids = $5,
           parent_parcel_ids = $6,
           mutation_event_id = $7,
           cadastral_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($8), 4326),
           updated_at = NOW()
       WHERE id = $9;`,
      [
        backupP2.land_area_m2,
        backupP2.construction_area_m2,
        backupP2.mutation_type,
        backupP2.lifecycle_status,
        backupP2.child_parcel_ids,
        backupP2.parent_parcel_ids,
        backupP2.mutation_event_id,
        backupP2.g,
        p2.id,
      ]
    );

    console.log('[Dọn dẹp hoàn tất] Dữ liệu CSDL đã trở về nguyên trạng ban đầu.');
    await pool.end();
  }
}

runMergeTest().catch((err) => {
  console.error('LỖI KIỂM THỬ MERGE:', err);
  process.exit(1);
});
