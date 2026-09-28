const { Pool } = require('pg');
const { randomUUID } = require('crypto');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5433),
  user: process.env.DB_USER || 'metro2_user',
  password: process.env.DB_PASSWORD || 'metro2_secure_password',
  database: process.env.DB_NAME || 'metro2_gis_db'
});

async function clone() {
  const origParcelCode = 'B-01064-C&C';
  const newParcelCode = 'B-01064-C&C-STRUCT';
  const newCadastralCode = '271330130431-STRUCT';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch original parcel
    const pRes = await client.query('SELECT * FROM parcels WHERE project_parcel_code = $1', [origParcelCode]);
    if (pRes.rows.length === 0) {
      throw new Error(`Không tìm thấy lô gốc ${origParcelCode}`);
    }
    const origP = pRes.rows[0];
    const origParcelId = origP.id;
    const origReportId = origP.active_phase1_report_id;

    // Check if new parcel already exists
    const checkP = await client.query('SELECT id FROM parcels WHERE project_parcel_code = $1', [newParcelCode]);
    if (checkP.rows.length > 0) {
      console.log(`Lô ${newParcelCode} đã tồn tại với ID:`, checkP.rows[0].id);
      await client.query('ROLLBACK');
      return;
    }

    const newParcelId = randomUUID();
    const newReportId = randomUUID();
    const newReportCode = `REPORT-${newParcelCode}-PHASE1`;

    // 2. Insert new parcel using SQL copy
    const pColRes = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'parcels' 
        AND column_name NOT IN ('id', 'project_parcel_code', 'official_cadastral_code', 'owner_name', 'active_phase1_report_id', 'created_at', 'updated_at')
      ORDER BY ordinal_position
    `);
    const pCols = pColRes.rows.map(x => x.column_name).join(', ');

    await client.query(`
      INSERT INTO parcels (id, project_parcel_code, official_cadastral_code, owner_name, active_phase1_report_id, created_at, updated_at, ${pCols})
      SELECT $1, $2, $3, $4, $5, NOW(), NOW(), ${pCols}
      FROM parcels WHERE id = $6
    `, [
      newParcelId,
      newParcelCode,
      newCadastralCode,
      'Nguyễn Thị Ngân Giang (Bản sao - Có Cờ Kết Cấu)',
      newReportId,
      origParcelId
    ]);
    console.log('✅ Đã tạo Parcel mới:', newParcelCode, 'ID:', newParcelId);

    // 3. Prepare updated survey_data_json
    const rRes = await client.query('SELECT * FROM base_survey_reports WHERE id = $1', [origReportId]);
    const origR = rRes.rows[0];

    const surveyDataJson = JSON.parse(JSON.stringify(origR.survey_data_json || {}));
    surveyDataJson.projectParcelCode = newParcelCode;
    surveyDataJson.officialCadastralCode = newCadastralCode;
    surveyDataJson.ownerName = 'Nguyễn Thị Ngân Giang (Bản sao - Có Cờ Kết Cấu)';
    
    // Đặt Burland & Cờ kết cấu HIGH
    surveyDataJson.burlandSummary = {
      localMaxGrade: 3,
      predominantGrade: 2,
      governingZoneCode: 'Z-08',
      representativeness: 'LOCAL',
      structuralFlagLevel: 'HIGH',
      governingZoneDescription: 'Nứt tiếp giáp tường & nứt nghiêng dầm cột kết cấu chịu lực',
      needStructuralEngineerReview: true
    };
    surveyDataJson.structuralDefectFlag = 'HIGH';
    surveyDataJson.requiresStructuralReview = true;
    surveyDataJson.ecs = {
      ...(surveyDataJson.ecs || {}),
      e1: 2,
      e2: 3, // Cờ kết cấu E2: 3đ
      totalEcs: 7,
      ecsClass: 'MEDIUM'
    };

    // Đánh dấu ít nhất 1 khuyết tật mang Cờ kết cấu chịu lực
    if (Array.isArray(surveyDataJson.floors)) {
      let foundDefect = false;
      for (const floor of surveyDataJson.floors) {
        if (Array.isArray(floor.zones)) {
          for (const zone of floor.zones) {
            if (Array.isArray(zone.defects) && zone.defects.length > 0) {
              const d = zone.defects[0];
              d.defectType = 'Nứt dầm bê tông cốt thép / Cột chịu lực';
              d.isStructuralElement = true;
              d.structuralSignificance = 'HIGH';
              d.structuralSignificanceLabel = 'HIGH - Nguy cơ chịu lực kết cấu (Cờ E2 = 3đ)';
              d.widthMaxMm = 2.5;
              d.lengthMm = 650;
              d.crackDirection = 'Xiên 45 độ gần gối dầm';
              d.burlandGrade = 3;
              d.notes = 'Vết nứt xiên 45 độ phát triển tại gối dầm BTCT, mép nứt sắc cạnh có dấu hiệu hoạt động - Cần kỹ sư kết cấu thẩm tra (CỜ KẾT CẤU HIGH).';
              foundDefect = true;
              break;
            }
          }
        }
        if (foundDefect) break;
      }
    }

    // 4. Insert new report using SQL copy
    const rColRes = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'base_survey_reports' 
        AND column_name NOT IN ('id', 'parcel_id', 'report_code', 'survey_data_json', 'created_at', 'updated_at')
      ORDER BY ordinal_position
    `);
    const rCols = rColRes.rows.map(x => x.column_name).join(', ');

    await client.query(`
      INSERT INTO base_survey_reports (id, parcel_id, report_code, survey_data_json, created_at, updated_at, ${rCols})
      SELECT $1, $2, $3, $4, NOW(), NOW(), ${rCols}
      FROM base_survey_reports WHERE id = $5
    `, [
      newReportId,
      newParcelId,
      newReportCode,
      JSON.stringify(surveyDataJson),
      origReportId
    ]);
    console.log('✅ Đã tạo Report mới:', newReportCode, 'ID:', newReportId);

    // 5. Clone risk_score_cards
    const scColRes = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'risk_score_cards' 
        AND column_name NOT IN ('id', 'report_id', 'e2_structure_score', 'total_ecs_score', 'ecs_class')
      ORDER BY ordinal_position
    `);
    const scCols = scColRes.rows.map(x => x.column_name).join(', ');

    await client.query(`
      INSERT INTO risk_score_cards (id, report_id, e2_structure_score, total_ecs_score, ecs_class, ${scCols})
      SELECT gen_random_uuid(), $1, 3, 7, 'MEDIUM'::ecs_class_enum, ${scCols}
      FROM risk_score_cards WHERE report_id = $2
    `, [newReportId, origReportId]);
    console.log('✅ Đã sao chép risk_score_cards (E2 = 3đ, cờ kết cấu HIGH)');

    // 6. Copy child tables using SQL directly
    const childTables = [
      'survey_identification_photos',
      'building_specifications',
      'floor_surveys',
      'damage_zones',
      'deformation_assessments'
    ];

    for (const table of childTables) {
      const cRes = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = $1 
          AND column_name NOT IN ('id', 'report_id')
        ORDER BY ordinal_position
      `, [table]);
      const cols = cRes.rows.map(x => x.column_name).join(', ');

      const res = await client.query(`
        INSERT INTO ${table} (id, report_id, ${cols})
        SELECT gen_random_uuid(), $1, ${cols}
        FROM ${table} WHERE report_id = $2
      `, [newReportId, origReportId]);
      console.log(`✅ Đã sao chép ${table} (${res.rowCount} dòng)`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 SAO CHÉP HOÀN TẤT THÀNH CÔNG!');
    console.log('--------------------------------------------------');
    console.log('Mã lô mới       :', newParcelCode);
    console.log('ID lô mới       :', newParcelId);
    console.log('Mã báo cáo mới  :', newReportCode);
    console.log('ID báo cáo mới  :', newReportId);
    console.log('Cờ kết cấu      : HIGH (E2 = 3đ, Thẩm tra kỹ sư = CÓ)');
    console.log('--------------------------------------------------');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('LỖI KHI SAO CHÉP:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

clone().catch((e) => {
  console.error(e);
  process.exit(1);
});
