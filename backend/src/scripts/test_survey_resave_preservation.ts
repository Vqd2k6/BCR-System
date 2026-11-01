/**
 * Kiểm thử lưu lại phiếu khảo sát: vùng và khuyết tật giữ ID, phần bị bỏ xóa mềm, URL cũ còn trong registry.
 * Hồ sơ tạo riêng cho kiểm thử rồi đánh dấu xóa mềm ở cuối.
 * Chạy: DB_NAME=metro2_audit_test npx ts-node src/scripts/test_survey_resave_preservation.ts
 */
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { Database } from '../database/db';
import { SurveyDefectsRepository } from '../modules/survey/repositories/survey-defects.repository';

dotenv.config();

const url = (name: string) => `https://cdn.test/surveys/KIEMTHU/${name}.jpg`;
const floorWith = (zones: unknown[]) => [{ floorName: 'Tầng 1', zones }];
const zone = (code: string, ctx: string, defects: unknown[] = []) => ({
  zoneCode: code,
  roomName: 'Phòng khách',
  componentType: 'Tường',
  ctxPhotoUrl: ctx,
  overviewPhotos: [ctx],
  defects,
});
const defect = (code: string, cu: string) => ({ defectCode: code, pinX: 10, pinY: 20, cuPhotos: [cu] });

async function main(): Promise<void> {
  if (process.env.DB_NAME !== 'metro2_audit_test') throw new Error('Chỉ chạy trên metro2_audit_test.');

  const created = await Database.query<{ id: string }>(
    `INSERT INTO base_survey_reports (parcel_id, surveyor_id, report_code, phase, status, current_step)
     SELECT parcel_id, surveyor_id, $1, phase, 'DRAFT', 1 FROM base_survey_reports WHERE surveyor_id IS NOT NULL LIMIT 1
     RETURNING id;`,
    [`TEST-RESAVE-${Date.now()}`]
  );
  const reportId = created.rows[0].id;
  const zones = () =>
    Database.query<{ id: string; zone_code: string; is_deleted: boolean; ctx_photo_url: string }>(
      `SELECT id, zone_code, is_deleted, ctx_photo_url FROM damage_zones WHERE report_id = $1 ORDER BY zone_code;`,
      [reportId]
    );
  const defects = () =>
    Database.query<{ id: string; defect_code: string; is_deleted: boolean; cu_photo_url: string }>(
      `SELECT d.id, d.defect_code, d.is_deleted, d.cu_photo_url FROM defect_items d
       JOIN damage_zones z ON z.id = d.zone_id WHERE z.report_id = $1 ORDER BY d.defect_code;`,
      [reportId]
    );

  try {
    await SurveyDefectsRepository.saveFloorSurveys(
      reportId,
      floorWith([
        zone('Z-01', url('ctx1'), [defect('D-01', url('cu1')), defect('D-02', url('cu2'))]),
        zone('Z-02', url('ctx2')),
      ])
    );
    const firstZones = (await zones()).rows;
    const firstDefects = (await defects()).rows;
    assert.equal(firstZones.length, 2);
    assert.equal(firstDefects.length, 2);

    // Lưu lại: đổi CTX Z-01, bỏ D-02, thêm D-03, bỏ Z-02, thêm Z-03
    await SurveyDefectsRepository.saveFloorSurveys(
      reportId,
      floorWith([
        zone('Z-01', url('ctx1b'), [defect('D-01', url('cu1')), defect('D-03', url('cu3'))]),
        zone('Z-03', url('ctx3')),
      ])
    );
    const nextZones = (await zones()).rows;
    const nextDefects = (await defects()).rows;
    const byZone = (code: string) => nextZones.find((row) => row.zone_code === code);
    const byDefect = (code: string) => nextDefects.find((row) => row.defect_code === code);

    assert.equal(byZone('Z-01')?.id, firstZones[0].id, 'Z-01 phải giữ ID');
    assert.equal(byZone('Z-01')?.ctx_photo_url, url('ctx1b'));
    assert.equal(byZone('Z-02')?.is_deleted, true, 'Z-02 phải xóa mềm, không mất hàng');
    assert.equal(byZone('Z-03')?.is_deleted, false);
    assert.equal(byDefect('D-01')?.id, firstDefects[0].id, 'D-01 phải giữ ID');
    assert.equal(byDefect('D-02')?.is_deleted, true, 'D-02 phải xóa mềm');
    assert.equal(byDefect('D-03')?.is_deleted, false, 'D-03 mới không được bị xóa mềm');

    const kept = await Database.query<{ photo_url: string; status: string }>(
      `SELECT photo_url, status FROM survey_photo_registry WHERE report_id = $1;`,
      [reportId]
    );
    const keptUrls = kept.rows.map((row) => row.photo_url);
    for (const dropped of [url('ctx1'), url('ctx2'), url('cu2')]) {
      assert.ok(keptUrls.includes(dropped), `Registry phải giữ ${dropped}`);
    }
    assert.ok(kept.rows.every((row) => row.status === 'SUPERSEDED'));
    console.log('[test_survey_resave_preservation] OK');
  } finally {
    await Database.query(`UPDATE base_survey_reports SET deleted_at = NOW() WHERE id = $1;`, [reportId]);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[test_survey_resave_preservation] Thất bại:', err);
  process.exit(1);
});
