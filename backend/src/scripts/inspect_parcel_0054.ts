import { pool } from '../database/db';

async function main() {
  const reportId = '2ba54dae-0af2-4a40-9896-acdc71e3a914';
  const reportRes = await pool.query('SELECT * FROM base_survey_reports WHERE id = $1', [reportId]);
  const row = reportRes.rows[0];
  console.log('=== BASE REPORT ===');
  console.log('project_parcel_code:', row.project_parcel_code);
  console.log('owner_remarks:', row.owner_remarks);
  console.log('summary_conclusions:', row.summary_conclusions);
  console.log('SURVEY_DATA_KEYS:', Object.keys(row.survey_data_json || {}));
  console.log('HISTORY_INTERVIEW:', JSON.stringify(row.survey_data_json?.historyInterview, null, 2));
  console.log('FOUNDATION_DATA:', {
    foundationType: row.survey_data_json?.foundationType,
    foundationSource: row.survey_data_json?.foundationSource,
    foundationDepthM: row.survey_data_json?.foundationDepthM,
    foundationCatScore: row.survey_data_json?.foundationCatScore,
    adjacentBuildings: row.survey_data_json?.adjacentBuildings,
    structuralType: row.survey_data_json?.structuralType,
    structuralForm: row.survey_data_json?.structuralForm,
    constructionAreaM2: row.survey_data_json?.constructionAreaM2,
    buildingHeightM: row.survey_data_json?.buildingHeightM,
    aboveFloors: row.survey_data_json?.aboveFloors,
    undergroundFloors: row.survey_data_json?.undergroundFloors,
    constructionYear: row.survey_data_json?.constructionYear,
  });
  console.log('SETTLEMENT_TILT:', JSON.stringify(row.survey_data_json?.settlementTilt, null, 2));
  console.log('SIGNATURES:', JSON.stringify(row.survey_data_json?.signatures, null, 2));

  console.log('=== FLOOR 0 DETAIL ===');
  const f0 = row.survey_data_json?.floors?.[0];
  console.log('Floor 0 keys:', Object.keys(f0 || {}));
  console.log('Floor 0 CAD properties:', {
    planPhotoUrl: f0?.planPhotoUrl,
    damageMapUrl: f0?.damageMapUrl,
    cadDrawingUrl: f0?.cadDrawingUrl,
    cadArchUrl: f0?.cadArchUrl,
    cadFiles: f0?.cadFiles,
    canvasDataUrl: f0?.canvasDataUrl?.substring(0, 50),
    cadArchPhoto: f0?.cadArchPhoto,
    cadStructuralPhoto: f0?.cadStructuralPhoto
  });
  const fsRes = await pool.query('SELECT * FROM floor_surveys WHERE report_id = $1', [reportId]);
  console.log('floor_surveys rows count:', fsRes.rows.length);
  if (fsRes.rows.length > 0) {
    console.log('floor_surveys row 0:', fsRes.rows[0]);
  }
  await pool.end();
}

main().catch(console.error);
