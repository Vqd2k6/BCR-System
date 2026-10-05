import { Database } from '../database/db';
import { SurveyBaseRepository } from '../modules/survey/repositories/survey-base.repository';

async function main() {
  const testParcels = [
    'C&C-05-B-0054',
    'C&C-05-B-0056',
    'C&C-05-B-0058',
    'C&C-05-B-0154',
    'C&C-05-B-0156',
    'C&C-05-B-0158'
  ];

  for (const code of testParcels) {
    console.log(`\n======================================================`);
    console.log(`PARCEL: ${code}`);
    console.log(`======================================================`);
    const raw = await SurveyBaseRepository.findReportById(code);
    if (!raw) {
      console.log('NOT FOUND');
      continue;
    }

    console.log('--- BUILDING SPECS (Table) ---');
    console.log(JSON.stringify(raw.buildingSpecs, null, 2));

    console.log('--- HISTORICAL SENSITIVITY (Table) ---');
    console.log(JSON.stringify(raw.historicalSensitivity, null, 2));

    console.log('--- DEFORMATION ASSESSMENTS (Table) ---');
    console.log(JSON.stringify(raw.deformation, null, 2));

    let json: any = {};
    if (raw.survey_data_json) {
      json = typeof raw.survey_data_json === 'string' ? JSON.parse(raw.survey_data_json) : raw.survey_data_json;
    }
    console.log('--- SURVEY_DATA_JSON KEYS ---');
    console.log(Object.keys(json));
    if (json.historyInterview) console.log('historyInterview:', JSON.stringify(json.historyInterview, null, 2));
    if (json.settlementTilt) console.log('settlementTilt:', JSON.stringify(json.settlementTilt, null, 2));
    if (json.adjacentBuildings) console.log('adjacentBuildings:', JSON.stringify(json.adjacentBuildings, null, 2));
    if (json.structureSystem) console.log('structureSystem:', json.structureSystem);
    if (json.foundationType) console.log('foundationType:', json.foundationType);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
