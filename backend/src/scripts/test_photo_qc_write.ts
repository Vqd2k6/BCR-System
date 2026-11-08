/**
 * Kiểm thử đường ghi Photo QC trên CSDL local.
 *   A. Phân quyền Zone (Zone Admin không xem được Zone khác).
 *   B. Kiểm hợp lệ khi ghi (sai URL, sai góc, bìa P04 cho căn hộ, dập bù ảnh sạch).
 *   C. Ghi thật lên một hồ sơ chưa duyệt rồi trả về trạng thái trung tính (dòng QC giữ lại, không xoá cứng).
 *   D. Hồ sơ APPROVED: QC đóng băng vào snapshot mới, bản đã phát hành không đổi – chạy trong transaction rồi ROLLBACK.
 * Chạy: npx ts-node --transpile-only src/scripts/test_photo_qc_write.ts
 */
import assert from 'assert';
import { Database } from '../database/db';
import type { JwtPayload } from '../common/guards/auth.guard';
import { PhotoQcService } from '../modules/photo-qc/photo-qc.service';
import { PhotoQcRepository } from '../modules/photo-qc/photo-qc.repository';
import { ReportSnapshotService } from '../modules/report/snapshot/report-snapshot.service';
import { parseFrozenPhotoQc } from '../modules/photo-qc/photo-qc.render';

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

async function expectReject(p: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await p;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    assert.match(msg, pattern);
    return;
  }
  assert.fail(`phải bị từ chối (${pattern})`);
}

async function main(): Promise<void> {
  const sa = await Database.query<{ id: string; username: string; full_name: string }>(
    `SELECT id, username, full_name FROM users WHERE role = 'SUPER_ADMIN' AND deleted_at IS NULL ORDER BY created_at LIMIT 1;`
  );
  const superAdmin: JwtPayload = { userId: sa.rows[0].id, username: sa.rows[0].username, role: 'SUPER_ADMIN', fullName: sa.rows[0].full_name };
  const zoneAdmin07: JwtPayload = { ...superAdmin, role: 'ZONE_ADMIN', assignedZoneId: 'ZONE_07' };

  const houseRes = await Database.query<{ id: string }>(
    `SELECT r.id FROM base_survey_reports r JOIN parcels p ON p.id = r.parcel_id
     WHERE r.deleted_at IS NULL AND r.status <> 'APPROVED' AND r.report_type = 'STANDALONE' AND p.zone_id = 'ZONE_09'
       AND COALESCE(r.survey_data_json->'photoP04'->>'url', '') <> '' AND COALESCE(r.survey_data_json->'photoP02'->>'url', '') <> ''
     ORDER BY r.report_code LIMIT 1;`
  );
  const unitRes = await Database.query<{ id: string }>(
    `SELECT r.id FROM base_survey_reports r JOIN building_units bu ON bu.id = r.unit_id
     WHERE r.deleted_at IS NULL AND r.report_type = 'CONDO_UNIT' AND COALESCE(bu.unit_type, 'UNIT') = 'UNIT'
       AND COALESCE(r.survey_data_json->'photoP04'->>'url', '') <> '' ORDER BY r.report_code LIMIT 1;`
  );
  const houseId = houseRes.rows[0]?.id;
  assert.ok(houseId, 'cần một hồ sơ nhà dân ZONE_09 có P-02 và P-04');

  console.log('A. Phân quyền Zone');
  await tc('Zone Admin ZONE_07 không xem được ZONE_09', async () => {
    await expectReject(PhotoQcService.list(zoneAdmin07, { zone: 'ZONE_09' }), /Không có quyền/);
    await expectReject(PhotoQcService.detail(zoneAdmin07, houseId), /không thuộc phân khu/);
  });
  await tc('Zone Admin ZONE_07 chỉ thấy hồ sơ ZONE_07 khi không lọc', async () => {
    const res = await PhotoQcService.list(zoneAdmin07, { limit: 30 });
    assert.ok(res.items.length > 0 && res.items.every((i) => (i.zoneId || '').toUpperCase() === 'ZONE_07'));
  });

  console.log('B. Kiểm hợp lệ khi ghi');
  const detail = await PhotoQcService.detail(superAdmin, houseId);
  const p02 = detail.photos.find((p) => p.photoKey === 'P-02')!;
  await tc('Sai URL ảnh → từ chối (ảnh đã thay đổi)', async () => {
    await expectReject(PhotoQcService.updatePhotos(superAdmin, houseId, [{ photoKey: 'P-02', photoUrl: 'https://x/khac.jpg', recapture: true }]), /đã thay đổi/);
  });
  await tc('Sai góc xoay lúc crop → từ chối', async () => {
    const wrong = (p02.rotation + 90) % 360;
    await expectReject(
      PhotoQcService.updatePhotos(superAdmin, houseId, [{
        photoKey: 'P-02', photoUrl: p02.url,
        crop: { x: 0, y: 0, w: 0.5, h: 0.5, ratio: '4:3', rotationAtCrop: wrong, imageWidth: 2000, imageHeight: 1500 },
      }]),
      /Góc xoay/
    );
  });
  await tc('Ô ảnh không tồn tại → từ chối', async () => {
    await expectReject(PhotoQcService.updatePhotos(superAdmin, houseId, [{ photoKey: 'P-99', photoUrl: p02.url, recapture: true }]), /không còn trong hồ sơ/);
  });
  if (!p02.legacyWatermarked) {
    await tc('Dập bù cho ảnh chưa có watermark cũ → từ chối', async () => {
      await expectReject(PhotoQcService.updatePhotos(superAdmin, houseId, [{ photoKey: 'P-02', photoUrl: p02.url, restampMode: 'BOTH' }]), /không cần dập bù/);
    });
  }
  if (unitRes.rows[0]) {
    await tc('Bìa P04 cho căn hộ con → từ chối', async () => {
      await expectReject(PhotoQcService.updateReport(superAdmin, unitRes.rows[0].id, { coverSource: 'P04' }), /căn hộ/);
    });
  }

  console.log('C. Ghi thật trên hồ sơ chưa duyệt (local)');
  await tc('Cờ chụp lại + crop + bìa P04 → đọc lại đúng, mức gợi ý OUTDOOR_ONLY', async () => {
    const imgW = 1500;
    const imgH = 2000;
    const saved = await PhotoQcService.updatePhotos(superAdmin, houseId, [{
      photoKey: 'P-02', photoUrl: p02.url, recapture: true,
      crop: { x: 0, y: 0.1, w: 1, h: (imgW * 3) / 4 / imgH, ratio: '4:3', rotationAtCrop: p02.rotation, imageWidth: imgW, imageHeight: imgH },
    }]);
    assert.strictEqual(saved[0].photoGroup, 'OUTDOOR');
    assert.strictEqual(saved[0].status, 'OPEN');
    await PhotoQcService.updateReport(superAdmin, houseId, { coverSource: 'P04', recaptureLevel: 'OUTDOOR_ONLY' });
    const again = await PhotoQcService.detail(superAdmin, houseId);
    assert.strictEqual(again.qc?.coverSource, 'P04');
    assert.strictEqual(again.suggestedLevel, 'OUTDOOR_ONLY');
    const row = again.photos.find((p) => p.photoKey === 'P-02')?.qc;
    assert.ok(row?.crop && row.recapture && !again.photos.find((p) => p.photoKey === 'P-02')?.qcStale);
    const state = await PhotoQcRepository.loadRenderState(houseId);
    assert.strictEqual(state?.coverSource, 'P04');
    assert.strictEqual(state?.photos.length, 1);
    const list = await PhotoQcService.recaptureList(superAdmin, { zone: 'ZONE_09' });
    assert.ok(list.some((r) => r.reportId === houseId && r.recaptureLevel === 'OUTDOOR_ONLY'));
  });
  await tc('Trả về trung tính: bỏ crop, bỏ cờ, bỏ bìa → render không còn QC', async () => {
    await PhotoQcService.updatePhotos(superAdmin, houseId, [{ photoKey: 'P-02', photoUrl: p02.url, crop: null, recapture: false }]);
    await PhotoQcService.updateReport(superAdmin, houseId, { coverSource: null, recaptureLevel: 'NONE' });
    assert.strictEqual(await PhotoQcRepository.loadRenderState(houseId), null);
  });

  console.log('D. Hồ sơ APPROVED (transaction ROLLBACK)');
  const approved = await Database.query<{ id: string; approved_at: Date; export_revision: number }>(
    `SELECT id, approved_at, export_revision FROM base_survey_reports WHERE status = 'APPROVED' AND deleted_at IS NULL LIMIT 1;`
  );
  if (!approved.rows[0]) {
    console.log('  ⏭  không có hồ sơ APPROVED ở local, bỏ qua');
  } else {
    const appr = approved.rows[0];
    await tc('Snapshot mới mang QC; snapshot đã có giữ nguyên (không QC)', async () => {
      const before = await ReportSnapshotService.getLatestApprovedSnapshot(appr.id);
      const client = await (await import('../database/db')).pool.connect();
      try {
        await client.query('BEGIN');
        await PhotoQcRepository.upsertReport(client, { reportId: appr.id, zoneId: null, stationCode: null, coverSource: 'P04', userId: superAdmin.userId });
        const snap = await ReportSnapshotService.writeApprovedRelease(client, appr.id, superAdmin.userId, appr.approved_at, 'TEST Photo QC', appr.export_revision);
        const frozen = parseFrozenPhotoQc(snap.snapshot.frozenReportData?.photo_qc);
        assert.strictEqual(frozen?.coverSource, 'P04', 'snapshot mới phải đóng băng bìa P04');
        if (before) {
          const old = parseFrozenPhotoQc(before.snapshot.frozenReportData?.photo_qc);
          assert.strictEqual(old, null, 'snapshot cũ không có QC');
        }
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
      const after = await ReportSnapshotService.getLatestApprovedSnapshot(appr.id);
      assert.strictEqual(after?.versionId, before?.versionId, 'ROLLBACK: không để lại snapshot');
      assert.strictEqual(await PhotoQcRepository.loadRenderState(appr.id), null, 'ROLLBACK: không để lại dòng QC');
    });
  }

  console.log(`\n${passed} ca đạt${process.exitCode ? ', CÓ CA LỖI' : ''}`);
}

main()
  .catch((err) => {
    console.error('[test_photo_qc_write] Lỗi', err);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 200));
