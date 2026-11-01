/**
 * Kiểm thử đọc CTX: phần đầu là ca logic, phần sau quét toàn bộ hồ sơ và chỉ dùng SELECT.
 * Chạy: npx ts-node src/scripts/test_zone_ctx_overlay.ts
 */
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { Database } from '../database/db';
import { isForeignParcelUrl, overlayZoneCtxFromJson } from '../modules/survey/zone-ctx.utils';

dotenv.config();

const FOREIGN = 'https://cdn/surveys/C&C-05-B-0148/zone_ctx/M2__CC-05-B-0148__Tng3__Z-04__CTX__ac71.jpg';
const OWN = 'https://cdn/surveys/C_C-05-B-0129/HCM_M2__C_C-05-B-0129__F01_Z-04_116ec1.jpg';
const row = (ctx: string, floor = 'Tầng 1', code = 'Z-04') => ({ zone_code: code, floor_name: floor, ctx_photo_url: ctx });
const overlay = (ctx: string, json: unknown, floor?: string) =>
  overlayZoneCtxFromJson([row(ctx, floor)], json, 'C&C-05-B-0129')[0].ctx_photo_url;

function runLogicCases(): void {
  for (const url of [FOREIGN, 'x/C_C-05-B-0148/a.jpg', 'x/CC-05-B-0148/a.jpg', 'x/C%26C-05-B-0148/a.jpg']) {
    assert.equal(isForeignParcelUrl(url, 'C&C-05-B-0129'), true, url);
  }
  assert.equal(isForeignParcelUrl(OWN, 'C&C-05-B-0129'), false);
  assert.equal(isForeignParcelUrl('x/C_C-05-B-0129/a.jpg', 'C&C-05-B-0129-DU'), false);
  assert.equal(isForeignParcelUrl('x/khong-co-ma.jpg', 'C&C-05-B-0129'), false);
  assert.equal(isForeignParcelUrl(FOREIGN, null), false);

  const flat = { zones: [{ zoneCode: 'Z-04', ctxPhotoUrl: OWN }] };
  assert.equal(overlay(FOREIGN, flat), OWN, 'JSON zones');
  assert.equal(overlay(FOREIGN, { damageZones: flat.zones }), OWN, 'JSON damageZones');
  assert.equal(overlay(FOREIGN, { floors: [{ floorName: 'Tầng 1', zones: flat.zones }] }), OWN, 'JSON floors');
  assert.equal(overlay(FOREIGN, { zones: [{ zoneCode: 'Z-04', ctxPhotoUrl: '' }] }), '', 'JSON rỗng, ảnh thửa khác');
  assert.equal(overlay(FOREIGN, { zones: [{ zoneCode: 'Z-04', ctxPhotoUrl: 'blob:local://x' }] }), '', 'blob không phải URL thật');
  assert.equal(overlay(OWN, {}), OWN, 'JSON rỗng, ảnh đúng thửa giữ nguyên');
  assert.equal(overlay(FOREIGN, { zones: [{ zoneCode: 'Z-04', ctxPhotoUrl: FOREIGN }] }), '', 'JSON cũng mang ảnh thửa khác');

  const twoFloors = {
    floors: [
      { floorName: 'Tầng 1', zones: [{ zoneCode: 'Z-04', ctxPhotoUrl: 'a.jpg' }] },
      { floorName: 'Tầng 2', zones: [{ zoneCode: 'Z-04', ctxPhotoUrl: 'b.jpg' }] },
    ],
  };
  assert.equal(overlay(OWN, twoFloors, 'Tầng 2'), 'b.jpg', 'đúng tầng');
  assert.equal(overlay(OWN, twoFloors, 'Tầng 9'), OWN, 'không suy tầng khi mã có ở nhiều tầng');
}

async function scanAllReports(): Promise<void> {
  const reports = await Database.query<{ id: string; survey_data_json: unknown; project_parcel_code: string; report_type: string }>(
    `SELECT r.id, r.survey_data_json, p.project_parcel_code, r.report_type
     FROM base_survey_reports r JOIN parcels p ON p.id = r.parcel_id WHERE r.deleted_at IS NULL;`
  );
  const zones = await Database.query<{ report_id: string; zone_code: string; floor_name: string; ctx_photo_url: string }>(
    `SELECT report_id, zone_code, floor_name, ctx_photo_url FROM damage_zones WHERE is_deleted IS NOT TRUE;`
  );
  const byReport = new Map<string, typeof zones.rows>();
  for (const zone of zones.rows) byReport.set(zone.report_id, [...(byReport.get(zone.report_id) ?? []), zone]);

  const samples: string[] = [];
  const stats = { zones: 0, infected: 0, fixed: 0, cleared: 0, stillInfected: 0, cleanChanged: 0, foreignLeft: 0 };
  for (const report of reports.rows) {
    const rows = byReport.get(report.id) ?? [];
    const next = overlayZoneCtxFromJson(rows, report.survey_data_json, report.project_parcel_code);
    next.forEach((after, idx) => {
      const before = rows[idx];
      const isInfected = before.ctx_photo_url.includes('1792234858466_ac71');
      stats.zones += 1;
      if (isForeignParcelUrl(after.ctx_photo_url, report.project_parcel_code)) {
        stats.foreignLeft += 1;
        samples.push(`FOREIGN ${report.project_parcel_code} ${before.zone_code} ${before.floor_name}: ${after.ctx_photo_url}`);
      }
      if (!isInfected) {
        if (after.ctx_photo_url !== before.ctx_photo_url) {
          stats.cleanChanged += 1;
          samples.push(`CHANGED ${report.project_parcel_code} ${before.zone_code} ${before.floor_name}: ${before.ctx_photo_url} => ${after.ctx_photo_url}`);
        }
        return;
      }
      stats.infected += 1;
      if (after.ctx_photo_url.includes('1792234858466_ac71')) stats.stillInfected += 1;
      else if (after.ctx_photo_url) stats.fixed += 1;
      else stats.cleared += 1;
    });
  }
  console.log('[test_zone_ctx_overlay] Quét toàn bộ:', stats);
  samples.slice(0, 20).forEach((line) => console.log(line));
  assert.equal(stats.cleanChanged, 0, 'Vùng không nhiễm không được đổi ảnh');
  assert.equal(stats.foreignLeft, 0, 'Không còn ảnh của thửa khác');

  const unit = next003(reports.rows, zones.rows);
  if (unit) assert.ok(unit.includes('116ec1'), `U-003 Z-04: ${unit}`);
}

function next003(
  reports: Array<{ id: string; survey_data_json: unknown; project_parcel_code: string }>,
  zones: Array<{ report_id: string; zone_code: string; floor_name: string; ctx_photo_url: string }>
): string | null {
  const report = reports.find((item) => item.id === 'bdd8097b-c959-4931-9c8a-8c741d164287');
  if (!report) return null;
  const rows = zones.filter((zone) => zone.report_id === report.id && zone.zone_code === 'Z-04');
  return overlayZoneCtxFromJson(rows, report.survey_data_json, report.project_parcel_code)[0]?.ctx_photo_url ?? null;
}

async function main(): Promise<void> {
  runLogicCases();
  await scanAllReports();
  console.log('[test_zone_ctx_overlay] OK');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test_zone_ctx_overlay] Thất bại:', err);
  process.exit(1);
});
