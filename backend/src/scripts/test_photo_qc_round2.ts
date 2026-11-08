/**
 * Kiểm thử Photo QC đợt 2 trên CSDL local.
 *   1. Bộ ảnh rà soát ⊇ ảnh report in và ⊇ ảnh của hồ sơ (trừ chữ ký, CAD) cho HOUSE / MASTER / M / U.
 *   2. Hồ sơ M: ảnh đại diện ở danh sách, mọi ảnh thuộc nhóm OUTDOOR.
 *   3. Mức AUTO / NONE / chọn tay → mức hiệu lực.
 *   4. Danh sách giao KSV: JSON và Excel cùng số dòng.
 *   5. Ảnh chưa in của căn U: crop lưu được, sau đó trả về trung tính (dòng QC giữ lại, không xoá cứng).
 * Chạy: npx ts-node --transpile-only src/scripts/test_photo_qc_round2.ts
 */
import assert from 'assert';
import ExcelJS from 'exceljs';
import { Database } from '../database/db';
import type { JwtPayload } from '../common/guards/auth.guard';
import { PhotoQcService } from '../modules/photo-qc/photo-qc.service';
import { effectiveLevel } from '../modules/photo-qc/photo-qc.rules';
import { isExcludedPhotoPath } from '../modules/photo-qc/photo-qc.unprinted';
import { listReportPhotoPool } from '../modules/audit/services/report-photo-pool';
import { walkViewModelPhotos } from '../modules/photo-qc/photo-qc.vm-walker';
import { ReportViewModelMapper } from '../modules/report/mappers/report-viewmodel.mapper';
import { ReportConfigService } from '../modules/report_config/report-config.service';

let passed = 0;
async function tc(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`, err);
    process.exitCode = 1;
  }
}

async function pickReport(sql: string): Promise<string | null> {
  const res = await Database.query<{ id: string }>(sql);
  return res.rows[0]?.id ?? null;
}

async function main(): Promise<void> {
  const sa = await Database.query<{ id: string; username: string; full_name: string }>(
    `SELECT id, username, full_name FROM users WHERE role = 'SUPER_ADMIN' AND deleted_at IS NULL ORDER BY created_at LIMIT 1;`
  );
  const user: JwtPayload = { userId: sa.rows[0].id, username: sa.rows[0].username, role: 'SUPER_ADMIN', fullName: sa.rows[0].full_name };
  const cfg = await ReportConfigService.getActiveConfig();

  const base = `SELECT r.id FROM base_survey_reports r LEFT JOIN building_units bu ON bu.id = r.unit_id
                WHERE r.deleted_at IS NULL AND r.status IN ('SUBMITTED', 'UNDER_REVIEW')`;
  const samples: Record<string, string | null> = {
    HOUSE: await pickReport(`${base} AND r.report_type = 'STANDALONE' ORDER BY r.report_code LIMIT 1`),
    MASTER: await pickReport(`${base} AND r.report_type = 'BUILDING_MASTER' ORDER BY r.report_code LIMIT 1`),
    M: await pickReport(`${base} AND r.report_type = 'CONDO_UNIT' AND bu.unit_type = 'MASTER' ORDER BY r.report_code LIMIT 1`),
    U: await pickReport(
      `${base} AND r.report_type = 'CONDO_UNIT' AND COALESCE(bu.unit_type, 'UNIT') = 'UNIT'
         AND COALESCE((r.survey_data_json->>'isAbsentee')::boolean, FALSE) = FALSE
         AND jsonb_array_length(COALESCE(r.survey_data_json->'zones', '[]')) > 0 ORDER BY r.report_code LIMIT 1`
    ),
  };

  console.log('1. Bộ ảnh rà soát phủ đủ ảnh');
  for (const [kind, id] of Object.entries(samples)) {
    if (!id) {
      console.log(`  ⏭  không có hồ sơ ${kind} ở local`);
      continue;
    }
    await tc(`${kind}: ⊇ ảnh in và ⊇ ảnh hồ sơ (trừ chữ ký, CAD)`, async () => {
      const built = await PhotoQcService.buildAllSlots(id);
      const got = new Set(built.slots.map((s) => s.url));
      const vm = ReportViewModelMapper.buildViewModel(built.raw, undefined, cfg);
      const printed = walkViewModelPhotos(vm).filter((r) => r.section !== 'COVER').map((r) => r.url);
      assert.deepStrictEqual(printed.filter((u) => !got.has(u)), [], 'thiếu ảnh report in');
      const absent = built.raw.condoUnitAbsent === true || built.raw.residentialAbsent === true;
      if (!absent) {
        const pool = (await listReportPhotoPool(id)).filter((p) => p.category !== 'CAD' && !isExcludedPhotoPath(p.source));
        assert.deepStrictEqual(pool.map((p) => p.url).filter((u) => !got.has(u)), [], 'thiếu ảnh của hồ sơ');
      }
      const unprinted = built.slots.filter((s) => !s.printed);
      assert.ok(built.slots.filter((s) => s.section !== 'DOCUMENT').every((s) => s.printed === printed.includes(s.url)), 'cờ printed phải khớp ViewModel');
      console.log(`     ${built.slots.length} ảnh (${unprinted.length} chưa in) • ví dụ chưa in: ${unprinted.slice(0, 2).map((s) => s.label).join(' | ') || '—'}`);
      if (kind === 'U') assert.ok(unprinted.length > 0, 'căn U có ảnh vùng/khuyết tật chưa in');
      if (kind === 'M') assert.ok(built.slots.every((s) => s.photoGroup === 'OUTDOOR'), 'ảnh M phải là OUTDOOR');
    });
  }

  console.log('2. Danh sách: hồ sơ M có ảnh đại diện');
  await tc('M trong danh sách có previewPhotos, nhóm OUTDOOR', async () => {
    const res = await PhotoQcService.list(user, { kind: 'M', limit: 5 });
    assert.ok(res.items.length > 0, 'local phải có hồ sơ M');
    assert.ok(res.items.some((i) => i.previewPhotos.length > 0), 'phải có ảnh đại diện');
    assert.ok(res.items.every((i) => i.previewPhotos.length <= 8));
    assert.ok(res.items.every((i) => i.previewPhotos.every((p) => p.photoGroup === 'OUTDOOR')));
  });
  await tc('Ảnh đại diện nhẹ của M: mọi khoá và URL có trong bộ ảnh rà soát đầy đủ', async () => {
    const res = await PhotoQcService.list(user, { kind: 'M', limit: 10 });
    let checked = 0;
    for (const item of res.items.filter((i) => i.previewPhotos.length > 0)) {
      const full = await PhotoQcService.buildAllSlots(item.reportId);
      const byKey = new Map(full.slots.map((s) => [s.photoKey, s]));
      for (const p of item.previewPhotos) {
        const slot = byKey.get(p.photoKey);
        assert.ok(slot, `${item.reportCode}: khoá ${p.photoKey} (${p.label}) không có ở màn chi tiết`);
        assert.strictEqual(slot.url, p.url);
        assert.strictEqual(p.rotation, slot.rotation, `${item.reportCode}: góc preview ${p.rotation} ≠ chi tiết ${slot.rotation} (${p.label})`);
        checked++;
      }
    }
    console.log(`     đã đối chiếu ${checked} ảnh đại diện`);
    assert.ok(checked > 0);
  });

  console.log('3. Mức hiệu lực');
  await tc('AUTO theo gợi ý, NONE và mức chọn tay giữ nguyên', async () => {
    assert.strictEqual(effectiveLevel('AUTO', 'FULL'), 'FULL');
    assert.strictEqual(effectiveLevel(null, 'OUTDOOR_ONLY'), 'OUTDOOR_ONLY');
    assert.strictEqual(effectiveLevel('NONE', 'FULL'), 'NONE');
    assert.strictEqual(effectiveLevel('OUTDOOR_ONLY', 'FULL'), 'OUTDOOR_ONLY');
  });

  console.log('4/5. Ghi trên căn U (local) + danh sách giao KSV');
  const uId = samples.U;
  if (uId) {
    const detail = await PhotoQcService.detail(user, uId);
    const target = detail.photos.find((p) => !p.printed && p.section !== 'DOCUMENT');
    await tc('Ảnh chưa in: gắn cờ + crop lưu được, mức AUTO cho ra FULL', async () => {
      assert.ok(target, 'cần một ảnh chưa in');
      const w = 2000;
      const h = 1500;
      await PhotoQcService.updatePhotos(user, uId, [{
        photoKey: target!.photoKey,
        photoUrl: target!.url,
        recapture: true,
        crop: { x: 0, y: 0, w: 0.75, h: 0.75, ratio: '4:3', rotationAtCrop: target!.rotation, imageWidth: w, imageHeight: h },
      }]);
      await PhotoQcService.updateReport(user, uId, { recaptureLevel: 'AUTO' });
      const again = await PhotoQcService.detail(user, uId);
      const row = again.photos.find((p) => p.photoKey === target!.photoKey);
      assert.ok(row?.qc?.crop && row.qc.recapture && !row.qcStale);
      assert.strictEqual(again.effectiveLevel, 'FULL');
    });
    await tc('Danh sách giao KSV: JSON và Excel cùng số dòng, có ảnh + URL', async () => {
      const rows = await PhotoQcService.recaptureList(user, {});
      const mine = rows.find((r) => r.reportId === uId);
      assert.ok(mine && mine.levelIsAuto && mine.recaptureLevel === 'FULL' && mine.photos.length > 0 && mine.photos[0].url);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await PhotoQcService.recaptureWorkbook(rows));
      assert.strictEqual(wb.worksheets[0].rowCount - 1, rows.length);
    });
    await tc('NONE chọn tay loại hồ sơ khỏi danh sách dù còn cờ; trả về trung tính', async () => {
      await PhotoQcService.updateReport(user, uId, { recaptureLevel: 'NONE' });
      assert.ok(!(await PhotoQcService.recaptureList(user, {})).some((r) => r.reportId === uId));
      await PhotoQcService.updatePhotos(user, uId, [{ photoKey: target!.photoKey, photoUrl: target!.url, recapture: false, crop: null }]);
      await PhotoQcService.updateReport(user, uId, { recaptureLevel: 'AUTO' });
    });
  }

  console.log(`\n${passed} ca đạt${process.exitCode ? ', CÓ CA LỖI' : ''}`);
}

main()
  .catch((err) => {
    console.error('[test_photo_qc_round2] Lỗi', err);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 200));
