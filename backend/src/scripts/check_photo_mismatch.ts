import { ReportV2Service } from '../modules/report_v2/report-v2.service';
import { pool } from '../database/db';

async function checkMismatch() {
  const r = await ReportV2Service.resolveReport('06286cda-6111-4880-aab3-081834e75233');
  const json = r.survey_data_json || {};
  const floors = json.floors || [];
  for (let fi = 0; fi < floors.length; fi++) {
    const f = floors[fi];
    console.log(`=== FLOOR ${fi}: ${f.floorName} ===`);
    for (const z of (f.zones || [])) {
      const zPhotos = [z.photoUrl, z.ctxPhotoUrl, ...(Array.isArray(z.overviewPhotos) ? z.overviewPhotos : [])].filter(Boolean);
      for (const p of zPhotos) {
        const urlStr = typeof p === 'string' ? p : p.url;
        const fn = urlStr.split('/').pop() || '';
        console.log(`  Zone ${z.zoneCode} (${z.roomName}): ${fn}`);
      }
      for (const d of (z.defects || [])) {
        console.log(`    Defect in Z ${d.defectCode}: cu=${(d.closeUpPhotoUrl||'').split('/').pop()}, ctx=${(d.contextPhotoUrl||'').split('/').pop()}`);
      }
    }
    for (const e of (f.structuralElements || [])) {
      const ePhotos = [e.photoUrl, e.ctxPhotoUrl, ...(Array.isArray(e.overviewPhotos) ? e.overviewPhotos : [])].filter(Boolean);
      for (const p of ePhotos) {
        const urlStr = typeof p === 'string' ? p : p.url;
        const fn = urlStr.split('/').pop() || '';
        console.log(`  Elem ${e.elementCode} (${e.elementType}): ${fn}`);
      }
      for (const d of (e.defects || [])) {
        console.log(`    Defect in E ${d.defectCode}: cu=${(d.closeUpPhotoUrl||'').split('/').pop()}, ctx=${(d.contextPhotoUrl||'').split('/').pop()}`);
      }
    }
  }
  await pool.end();
}
checkMismatch();
