/**
 * Gán ảnh có sẵn: pool chỉ lấy ảnh của đúng hồ sơ, ô nguồn giữ nguyên, sổ cái không đánh dấu nhầm khi URL ở hai ô.
 * Mọi kịch bản ghi đều ROLLBACK. Chạy: DB_NAME=metro2_audit_test npx ts-node --transpile-only src/scripts/test_report_photo_pool.ts
 */
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import type { PoolClient } from 'pg';
import { Database } from '../database/db';
import { CondoCrudEngineService } from '../modules/audit/condo/services/condo-crud-engine.service';
import { CondoPhotoLineageService } from '../modules/audit/condo/services/condo-photo-lineage.service';
import { normalizeCondoSnapshot } from '../modules/audit/condo/services/condo-snapshot-restore.helpers';
import { listReportPhotoPool } from '../modules/audit/services/report-photo-pool';

dotenv.config();

class ScenarioRollback extends Error {}

async function inRollback(name: string, body: (client: PoolClient) => Promise<void>): Promise<void> {
  try {
    await Database.transaction(async (client) => {
      await body(client);
      throw new ScenarioRollback();
    });
  } catch (err) {
    if (!(err instanceof ScenarioRollback)) throw err;
  }
  console.log(`[PASS] ${name}`);
}

const IDENT = { category: 'IDENTIFICATION', targetPhotoType: 'P01_HOUSE_NUMBER', targetPhotoId: 'photoP01', photoCode: 'P-01' };

async function main(): Promise<void> {
  const row = await Database.query<{ id: string; other: string }>(
    `SELECT r.id, (SELECT o.id FROM base_survey_reports o WHERE o.id <> r.id AND o.deleted_at IS NULL LIMIT 1) AS other
     FROM base_survey_reports r JOIN building_units bu ON bu.id = r.unit_id JOIN parcels p ON p.id = r.parcel_id
     WHERE bu.unit_type = 'UNIT' AND r.deleted_at IS NULL AND r.status <> 'APPROVED' AND COALESCE(p.is_locked, false) = false
       AND COALESCE(r.survey_data_json->'photoP01'->>'url', '') = ''
       AND jsonb_array_length(CASE WHEN jsonb_typeof(r.survey_data_json->'workingMinutesPhotos') = 'array'
             THEN r.survey_data_json->'workingMinutesPhotos' ELSE '[]'::jsonb END) > 0
     LIMIT 1;`
  );
  assert.ok(row.rows[0], 'Thiếu hồ sơ P-01 trống có ảnh biên bản');
  const reportId = row.rows[0].id;
  const resolved = await CondoCrudEngineService.resolveCondoReportContext(reportId);
  assert.ok(resolved);
  const context = resolved.context;
  const baseJson = context.survey_data_json as Record<string, unknown>;
  const minutes = baseJson.workingMinutesPhotos as string[];
  const minutesUrl = typeof minutes[0] === 'string' ? minutes[0] : String((minutes[0] as unknown as { url: string }).url);

  const pool = await listReportPhotoPool(reportId);
  assert.ok(pool.some((item) => item.url === minutesUrl && item.category === 'MINUTES'), 'Có ảnh biên bản');
  assert.equal(new Set(pool.map((item) => item.url)).size, pool.length, 'Không trùng URL');
  const rawJson = JSON.stringify(baseJson);
  assert.ok(pool.every((item) => /^https?:/.test(item.url)));
  const signatureUrls = [baseJson.surveyorSignatureUrl, baseJson.ownerSignatureUrl].filter(Boolean);
  assert.ok(pool.every((item) => !signatureUrls.includes(item.url)), 'Không có chữ ký');
  assert.ok(rawJson.length > 0);
  const otherPool = await listReportPhotoPool(row.rows[0].other);
  assert.ok(!otherPool.some((item) => item.url === minutesUrl), 'Không lấy ảnh của hồ sơ khác');
  console.log(`[PASS] Pool đúng phạm vi hồ sơ (${pool.length} ảnh)`);

  const copyToP01 = async (client: PoolClient, json: Record<string, unknown>) => {
    await client.query(
      `INSERT INTO survey_photo_registry (report_id, parcel_id, photo_category, photo_type, photo_code, photo_url,
         standardized_filename, sha256_hash, mime_type, status, action_type, actor_role)
       SELECT $1, $2, 'MINUTES', 'WORKING_MINUTES', 'BB-TEST', $3, 'bb.jpg', md5($3), 'image/jpeg', 'ACTIVE', 'INITIAL_SURVEY', 'SURVEYOR'
       WHERE NOT EXISTS (SELECT 1 FROM survey_photo_registry WHERE report_id = $1 AND photo_url = $3);`,
      [reportId, context.parcel_id, minutesUrl]
    );
    const actor = (await client.query(`SELECT id FROM users WHERE status = 'ACTIVE' LIMIT 1;`)).rows[0];
    await CondoPhotoLineageService.applyPhotoActionInTx(client, reportId, context.parcel_id, actor.id, json, {
      ...IDENT,
      action: 'REPLACE',
      oldPhotoUrl: '',
      newPhotoUrl: minutesUrl,
      reason: 'Ảnh cửa KSV đặt nhầm mục biên bản',
      metadata: { source: 'REPORT_PHOTO_POOL', reusedFromUrl: minutesUrl },
    });
    return actor.id as string;
  };
  const sourceStatuses = async (client: PoolClient): Promise<string[]> =>
    (
      await client.query(
        `SELECT status FROM survey_photo_registry WHERE report_id = $1 AND photo_url = $2 AND photo_category <> 'IDENTIFICATION';`,
        [reportId, minutesUrl]
      )
    ).rows.map((item) => item.status);

  await inRollback('Gán ảnh biên bản vào P-01: ô đích có ảnh, ô nguồn giữ nguyên', async (client) => {
    const json = JSON.parse(rawJson) as Record<string, unknown>;
    await copyToP01(client, json);
    const p01 = json.photoP01 as Record<string, unknown>;
    assert.equal(p01.url, minutesUrl);
    assert.equal(p01.notApplicable, false);
    assert.deepEqual(json.workingMinutesPhotos, minutes, 'Biên bản không đổi');
    const sql = (
      await client.query(
        `SELECT raw_photo_url, is_not_applicable FROM survey_identification_photos WHERE report_id = $1 AND photo_type::text LIKE 'P01%';`,
        [reportId]
      )
    ).rows[0];
    assert.equal(sql.raw_photo_url, minutesUrl);
    assert.equal(sql.is_not_applicable, false);
    const ledger = (
      await client.query(
        `SELECT status, metadata_json FROM survey_photo_registry WHERE report_id = $1 AND photo_url = $2 AND photo_category = 'IDENTIFICATION';`,
        [reportId, minutesUrl]
      )
    ).rows[0];
    assert.equal(ledger.status, 'ACTIVE');
    assert.equal(ledger.metadata_json.source, 'REPORT_PHOTO_POOL');
  });

  await inRollback('Thay tiếp ô đích bằng ảnh tải lên: dòng ô nguồn vẫn ACTIVE', async (client) => {
    const json = JSON.parse(rawJson) as Record<string, unknown>;
    const actorId = await copyToP01(client, json);
    await CondoPhotoLineageService.applyPhotoActionInTx(client, reportId, context.parcel_id, actorId, json, {
      ...IDENT,
      action: 'REPLACE',
      oldPhotoUrl: minutesUrl,
      newPhotoUrl: 'https://kiem-thu.local/moi.jpg',
      photoCode: 'MA-TAI-LEN-MOI',
      reason: 'Thay ảnh rõ hơn',
    });
    assert.ok((await sourceStatuses(client)).every((status) => status === 'ACTIVE'));
    assert.equal((json.photoP01 as Record<string, unknown>).url, 'https://kiem-thu.local/moi.jpg');
  });

  await inRollback('Xóa ở ô đích: dòng ô nguồn vẫn ACTIVE', async (client) => {
    const json = JSON.parse(rawJson) as Record<string, unknown>;
    const actorId = await copyToP01(client, json);
    await CondoPhotoLineageService.applyPhotoActionInTx(client, reportId, context.parcel_id, actorId, json, {
      ...IDENT,
      action: 'DELETE',
      oldPhotoUrl: minutesUrl,
      reason: 'Gán nhầm ô',
    });
    assert.ok((await sourceStatuses(client)).every((status) => status === 'ACTIVE'));
    assert.deepEqual(json.workingMinutesPhotos, minutes);
  });

  await inRollback('Gán rồi rollback: P-01 về trống, biên bản giữ nguyên', async (client) => {
    const json = JSON.parse(rawJson) as Record<string, unknown>;
    await copyToP01(client, json);
    const strategy = CondoCrudEngineService.getStrategy('CONDO_UNIT');
    const { restoredSurveyJson } = await strategy.restoreSnapshotInTransaction(
      client,
      context,
      normalizeCondoSnapshot(JSON.parse(rawJson)),
      'admin-test',
      { restoreCadPosition: true, currentJson: json }
    );
    assert.equal(String((restoredSurveyJson.photoP01 as Record<string, unknown>).url || ''), '');
    assert.deepEqual(restoredSurveyJson.workingMinutesPhotos, minutes);
  });

  await inRollback('Gán ảnh có sẵn vào CTX của vùng: vùng có ảnh, biên bản giữ nguyên', async (client) => {
    const zone = (await client.query(`SELECT id FROM damage_zones WHERE report_id = $1 AND is_deleted IS NOT TRUE LIMIT 1;`, [reportId])).rows[0];
    assert.ok(zone, 'Hồ sơ không có vùng');
    const actor = (await client.query(`SELECT id FROM users WHERE status = 'ACTIVE' LIMIT 1;`)).rows[0];
    const json = JSON.parse(rawJson) as Record<string, unknown>;
    await CondoPhotoLineageService.applyPhotoActionInTx(client, reportId, context.parcel_id, actor.id, json, {
      action: 'REPLACE',
      category: 'ZONE_CTX',
      targetPhotoType: 'ZONE_CTX',
      targetPhotoId: zone.id,
      newPhotoUrl: minutesUrl,
      reason: 'Gán ảnh có sẵn',
    });
    const ctx = await client.query(`SELECT ctx_photo_url FROM damage_zones WHERE id = $1;`, [zone.id]);
    assert.equal(ctx.rows[0].ctx_photo_url, minutesUrl);
    assert.deepEqual(json.workingMinutesPhotos, minutes);
  });

  console.log('✅ test_report_photo_pool: đạt');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test_report_photo_pool] Thất bại:', err);
  process.exit(1);
});
