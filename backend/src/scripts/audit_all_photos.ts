import { pool } from '../database/db';

async function inspectRealData() {
  const codes = ['C&C-05-B-0054', 'C&C-05-B-0056', 'C&C-05-B-0058', 'C&C-05-B-0154', 'C&C-05-B-0156', 'C&C-05-B-0158'];

  for (const c of codes) {
    console.log('================================================================');
    console.log(`🔍 THỬA ĐẤT: ${c}`);

    // Get report
    const rptRes = await pool.query(
      `SELECT r.id, r.report_code, r.owner_signature_url, r.surveyor_signature_url, r.survey_data_json 
       FROM parcels p 
       JOIN base_survey_reports r ON r.parcel_id = p.id 
       WHERE p.project_parcel_code = $1`,
      [c]
    );
    if (rptRes.rows.length === 0) {
      console.log('  ❌ Không tìm thấy base_survey_reports');
      continue;
    }
    const reportId = rptRes.rows[0].id;
    const sjson = rptRes.rows[0].survey_data_json || {};

    // 1. survey_identification_photos
    const ident = await pool.query(
      `SELECT photo_type, photo_code, raw_photo_url, annotated_photo_url, dimensions_json, is_not_applicable, na_reason 
       FROM survey_identification_photos 
       WHERE report_id = $1 
       ORDER BY photo_code, photo_type`,
      [reportId]
    );
    console.log(`\n  📸 1. survey_identification_photos (${ident.rows.length} ảnh):`);
    ident.rows.forEach(r =>
      console.log(`     - [${r.photo_type}] ${r.photo_code || '(no code)'}: raw=${(r.raw_photo_url || '').substring(0, 50)}... ${r.is_not_applicable ? '(N/A: ' + r.na_reason + ')' : ''}`)
    );

    // 2. floor_surveys
    const floors = await pool.query(
      `SELECT floor_name, floor_order, cad_drawing_url, cad_structural_drawing_url, overview_photos_json, notes 
       FROM floor_surveys 
       WHERE report_id = $1 
       ORDER BY floor_order`,
      [reportId]
    );
    console.log(`\n  🏢 2. floor_surveys (${floors.rows.length} tầng):`);
    floors.rows.forEach(r => {
      const ov = r.overview_photos_json || [];
      console.log(`     - ${r.floor_name}: CAD=${(r.cad_drawing_url || '').substring(0, 40)} | StructCAD=${(r.cad_structural_drawing_url || '').substring(0, 40)} | OverviewPhotos=${Array.isArray(ov) ? ov.length : 0} ảnh`);
      if (Array.isArray(ov) && ov.length > 0) {
        ov.forEach((p: any, idx: number) => console.log(`        * Overview [${idx}]:`, typeof p === 'string' ? p.substring(0, 60) : JSON.stringify(p).substring(0, 60)));
      }
    });

    // 3. damage_zones & defect_items
    const zones = await pool.query(
      `SELECT dz.id, dz.zone_code, dz.floor_name, dz.room_name, dz.component_type, dz.ctx_photo_url, dz.notes,
              COUNT(di.id) as defect_count
       FROM damage_zones dz
       LEFT JOIN defect_items di ON di.zone_id = dz.id
       WHERE dz.report_id = $1
       GROUP BY dz.id, dz.zone_code, dz.floor_name, dz.room_name, dz.component_type, dz.ctx_photo_url, dz.notes
       ORDER BY dz.zone_code`,
      [reportId]
    );
    console.log(`\n  📍 3. damage_zones (${zones.rows.length} zones):`);
    for (const z of zones.rows) {
      console.log(`     - Zone ${z.zone_code} (${z.floor_name} - ${z.room_name}): CtxPhoto=${(z.ctx_photo_url || '').substring(0, 40)}... (${z.defect_count} defects)`);
      const defects = await pool.query(
        `SELECT defect_code, cu_photo_code, cu_photo_url, extra_photo_url, cu_photos_json, width_max_mm, defect_type
         FROM defect_items 
         WHERE zone_id = $1 
         ORDER BY defect_code`,
        [z.id]
      );
      defects.rows.forEach(d => {
        const extraCu = d.cu_photos_json ? (Array.isArray(d.cu_photos_json) ? d.cu_photos_json.length : 0) : 0;
        console.log(`        * Defect ${d.defect_code}: CU=${(d.cu_photo_url || '').substring(0, 35)}... | Extra=${(d.extra_photo_url || '').substring(0, 30)}... | CuJson=${extraCu} ảnh`);
      });
    }

    // 4. deformation_assessments
    const def = await pool.query(
      `SELECT tilt_photo_code, tilt_photos_json, diff_settlement_photo_code, diff_settlement_photos_json, abnormal_photo_code, abnormal_photos_json 
       FROM deformation_assessments 
       WHERE report_id = $1`,
      [reportId]
    );
    console.log(`\n  📐 4. deformation_assessments (${def.rows.length}):`);
    def.rows.forEach(r => {
      console.log(`     - Tilt:`, r.tilt_photos_json);
      console.log(`     - Settlement:`, r.diff_settlement_photos_json);
      console.log(`     - Abnormal:`, r.abnormal_photos_json);
    });

    // 5. building_specifications
    const bspec = await pool.query(
      `SELECT as_built_drawing_photos_json 
       FROM building_specifications 
       WHERE report_id = $1`,
      [reportId]
    );
    console.log(`\n  📑 5. building_specifications as_built drawings (${bspec.rows.length}):`);
    bspec.rows.forEach(r => console.log(`     -`, JSON.stringify(r.as_built_drawing_photos_json)));

    // 6. survey_data_json (Signatures, minutes, steps)
    console.log(`\n  ✍️ 6. survey_data_json:`);
    const minutesPhotos = sjson.signatures?.signedRecordPhotos || sjson.signedMinutesPhotos || sjson.signatures?.minutesPhotos || [];
    console.log(`     - Biên bản hiện trường ký tên (signedRecordPhotos): ${minutesPhotos.length} trang`);
    minutesPhotos.forEach((m: any, idx: number) => console.log(`        [Trang ${idx + 1}]:`, typeof m === 'string' ? m.substring(0, 60) : JSON.stringify(m).substring(0, 60)));
    console.log(`     - Chữ ký chủ nhà: ${(rptRes.rows[0].owner_signature_url || sjson.signatures?.ownerSignatureUrl || '').substring(0, 50)}`);
    console.log(`     - Chữ ký KSV: ${(rptRes.rows[0].surveyor_signature_url || sjson.signatures?.surveyorSignatureUrl || '').substring(0, 50)}`);

    // Any other photos in survey_data_json
    const findOtherPhotos = (obj: any, path = ''): string[] => {
      if (!obj || typeof obj !== 'object') return [];
      let res: string[] = [];
      for (const k of Object.keys(obj)) {
        const val = obj[k];
        if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('blob:') || val.includes('.jpg') || val.includes('.png'))) {
          // ignore already checked
          if (!path.includes('signedRecordPhotos') && !path.includes('signatures') && !path.includes('photos') && !path.includes('overview')) {
            res.push(`${path}.${k} = ${val.substring(0, 60)}`);
          }
        } else if (Array.isArray(val)) {
          val.forEach((item, idx) => {
            if (typeof item === 'string' && (item.startsWith('http') || item.startsWith('blob:') || item.includes('.jpg') || item.includes('.png'))) {
              if (!path.includes('signedRecordPhotos') && !path.includes('signatures') && !path.includes('photos') && !path.includes('overview')) {
                res.push(`${path}.${k}[${idx}] = ${item.substring(0, 60)}`);
              }
            } else if (typeof item === 'object') {
              res = res.concat(findOtherPhotos(item, `${path}.${k}[${idx}]`));
            }
          });
        } else if (typeof val === 'object') {
          res = res.concat(findOtherPhotos(val, `${path}.${k}`));
        }
      }
      return res;
    };
    const otherPhotos = findOtherPhotos(sjson);
    if (otherPhotos.length > 0) {
      console.log(`     - Các ảnh khác tìm thấy trong JSON (${otherPhotos.length}):`);
      otherPhotos.forEach(p => console.log(`        * ${p}`));
    }
  }

  await pool.end();
}

inspectRealData();
