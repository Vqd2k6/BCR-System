import { Database } from '../database/db';

async function healCondoMasterReports() {
  console.log('=== BẮT ĐẦU CHẠY SCRIPT TỰ CHỮA LÀNH DỮ LIỆU KHẢO SÁT MASTER ===');

  await Database.transaction(async (client) => {
    // 1. Chữa lành parcels có active_phase1_report_id trỏ vào ID không tồn tại
    const invalidParcelLinks = await client.query<{ id: string; project_parcel_code: string; active_phase1_report_id: string }>(
      `SELECT p.id, p.project_parcel_code, p.active_phase1_report_id
       FROM parcels p
       WHERE p.active_phase1_report_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM base_survey_reports r WHERE r.id = p.active_phase1_report_id);`
    );

    console.log(`[Heal1] Phát hiện ${invalidParcelLinks.rows.length} thửa có active_phase1_report_id trỏ vào ID không tồn tại`);
    for (const p of invalidParcelLinks.rows) {
      // Tìm báo cáo mới nhất cho parcel này
      const latestRep = await client.query<{ id: string; status: string; created_at: Date }>(
        `SELECT id, status, created_at 
         FROM base_survey_reports 
         WHERE parcel_id = $1 AND unit_id IS NULL AND phase = 'PHASE_1'
         ORDER BY 
           CASE 
             WHEN status = 'APPROVED' THEN 1 
             WHEN status = 'SUBMITTED' THEN 2 
             WHEN status = 'DRAFT' THEN 3 
             ELSE 4 
           END ASC,
           updated_at DESC, created_at DESC 
         LIMIT 1;`,
        [p.id]
      );

      if (latestRep.rows[0]) {
        await client.query(
          `UPDATE parcels SET active_phase1_report_id = $1, updated_at = NOW() WHERE id = $2;`,
          [latestRep.rows[0].id, p.id]
        );
        console.log(`  -> Đã sửa thửa ${p.project_parcel_code} (${p.id}): active_phase1_report_id = ${latestRep.rows[0].id} (status: ${latestRep.rows[0].status})`);
      } else {
        await client.query(
          `UPDATE parcels SET active_phase1_report_id = NULL, updated_at = NOW() WHERE id = $1;`,
          [p.id]
        );
        console.log(`  -> Thửa ${p.project_parcel_code} (${p.id}) không có báo cáo nào, đặt active_phase1_report_id = NULL`);
      }
    }

    // 2. Chữa lành building_units có phase1_report_id bị NULL nhưng có báo cáo trong base_survey_reports
    const orphanUnits = await client.query<{ id: string; unit_code: string; parcel_id: string }>(
      `SELECT bu.id, bu.unit_code, bu.parcel_id
       FROM building_units bu
       WHERE bu.phase1_report_id IS NULL
         AND EXISTS (SELECT 1 FROM base_survey_reports r WHERE r.unit_id = bu.id);`
    );

    console.log(`[Heal2] Phát hiện ${orphanUnits.rows.length} căn hộ/phân vùng có báo cáo nhưng phase1_report_id đang bị NULL`);
    for (const u of orphanUnits.rows) {
      const rep = await client.query<{ id: string; status: string }>(
        `SELECT id, status 
         FROM base_survey_reports 
         WHERE unit_id = $1 
         ORDER BY updated_at DESC, created_at DESC 
         LIMIT 1;`,
        [u.id]
      );
      if (rep.rows[0]) {
        await client.query(
          `UPDATE building_units 
           SET phase1_report_id = $1, 
               status = CASE WHEN $2 IN ('SUBMITTED', 'APPROVED') THEN $2::parcel_survey_status_enum ELSE status END,
               updated_at = NOW() 
           WHERE id = $3;`,
          [rep.rows[0].id, rep.rows[0].status, u.id]
        );
        console.log(`  -> Đã liên kết căn/phân vùng ${u.unit_code} (${u.id}) với báo cáo ${rep.rows[0].id} (status: ${rep.rows[0].status})`);
      }
    }

    // 3. Khôi phục ảnh từ survey_identification_photos vào survey_data_json nếu survey_data_json bị rỗng ảnh
    const reportsWithPhotos = await client.query<{ id: string; survey_data_json: any }>(
      `SELECT r.id, r.survey_data_json
       FROM base_survey_reports r
       WHERE EXISTS (
         SELECT 1 FROM survey_identification_photos p 
         WHERE p.report_id = r.id AND p.raw_photo_url != '' AND p.raw_photo_url IS NOT NULL
       );`
    );

    console.log(`[Heal3] Kiểm tra ${reportsWithPhotos.rows.length} báo cáo có ảnh trong survey_identification_photos`);
    let healedJsonCount = 0;

    for (const r of reportsWithPhotos.rows) {
      const photos = await client.query<{ photo_type: string; raw_photo_url: string; is_not_applicable: boolean }>(
        `SELECT photo_type, raw_photo_url, is_not_applicable FROM survey_identification_photos WHERE report_id = $1;`,
        [r.id]
      );

      let currentData: Record<string, any> = {};
      if (typeof r.survey_data_json === 'string') {
        try {
          currentData = JSON.parse(r.survey_data_json);
        } catch {
          currentData = {};
        }
      } else if (r.survey_data_json && typeof r.survey_data_json === 'object') {
        currentData = { ...r.survey_data_json };
      }

      let modified = false;

      for (const p of photos.rows) {
        if (!p.raw_photo_url) continue;

        if (p.photo_type === 'P01_HOUSE_NUMBER') {
          if (!currentData.photoP01?.url) {
            currentData.photoP01 = { url: p.raw_photo_url, notApplicable: Boolean(p.is_not_applicable) };
            modified = true;
          }
        } else if (p.photo_type === 'P02_MAIN_FACADE') {
          if (!currentData.photoP02?.url) {
            currentData.photoP02 = {
              ...(currentData.photoP02 || {}),
              url: p.raw_photo_url,
              notApplicable: Boolean(p.is_not_applicable),
            };
            modified = true;
          }
        } else if (p.photo_type === 'P03_SIDE_OR_REAR') {
          if (!currentData.photoP03?.url) {
            currentData.photoP03 = {
              ...(currentData.photoP03 || {}),
              url: p.raw_photo_url,
              notApplicable: Boolean(p.is_not_applicable),
              tag: currentData.photoP03?.tag || 'Bên hông trái',
            };
            modified = true;
          }
        } else if (p.photo_type === 'P04_CONTEXT_STREET') {
          if (!currentData.photoP04?.url) {
            currentData.photoP04 = { url: p.raw_photo_url, notApplicable: Boolean(p.is_not_applicable) };
            modified = true;
          }
        }
      }

      if (modified) {
        await client.query(
          `UPDATE base_survey_reports SET survey_data_json = $1, updated_at = NOW() WHERE id = $2;`,
          [JSON.stringify(currentData), r.id]
        );
        healedJsonCount++;
        console.log(`  -> Đã khôi phục ảnh P01-P04 vào survey_data_json của báo cáo ${r.id}`);
      }
    }

    // 4. Đồng bộ active_phase1_report_id trỏ vào báo cáo cập nhật mới nhất (tránh trỏ vào draft cũ rỗng)
    const staleActiveReports = await client.query<{ parcel_id: string; project_parcel_code: string; active_id: string; latest_id: string }>(
      `SELECT p.id as parcel_id, p.project_parcel_code, p.active_phase1_report_id as active_id, r_latest.id as latest_id
       FROM parcels p
       JOIN base_survey_reports r_active ON r_active.id = p.active_phase1_report_id
       JOIN LATERAL (
         SELECT id, updated_at
         FROM base_survey_reports
         WHERE parcel_id = p.id AND unit_id IS NULL AND phase = 'PHASE_1'
         ORDER BY 
           CASE 
             WHEN status = 'APPROVED' THEN 1 
             WHEN status = 'SUBMITTED' THEN 2 
             WHEN status = 'DRAFT' THEN 3 
             ELSE 4 
           END ASC,
           updated_at DESC
         LIMIT 1
       ) r_latest ON true
       WHERE r_active.id != r_latest.id
         AND r_active.status = 'DRAFT';`
    );

    console.log(`[Heal4] Phát hiện ${staleActiveReports.rows.length} thửa đang trỏ vào draft cũ thay vì draft mới nhất`);
    for (const r of staleActiveReports.rows) {
      await client.query(
        `UPDATE parcels SET active_phase1_report_id = $1, updated_at = NOW() WHERE id = $2;`,
        [r.latest_id, r.parcel_id]
      );
      console.log(`  -> Đã cập nhật thửa ${r.project_parcel_code} (${r.parcel_id}) sang báo cáo mới nhất: ${r.latest_id}`);
    }

    console.log(`[Heal3] Đã khôi phục ảnh vào survey_data_json cho ${healedJsonCount} báo cáo.`);
    console.log('=== HOÀN TẤT TỰ CHỮA LÀNH DỮ LIỆU THÀNH CÔNG ===');
  });

  process.exit(0);
}

healCondoMasterReports().catch((err) => {
  console.error('[HealMasterReports] Thất bại khi chạy script tự chữa lành:', err);
  process.exit(1);
});
