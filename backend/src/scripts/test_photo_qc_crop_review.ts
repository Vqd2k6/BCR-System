/**
 * Kiểm thử duyệt crop Photo QC (repository, trong transaction rồi ROLLBACK – không để lại dữ liệu).
 *   A. Crop mới ghi mặc định PENDING và KHÔNG vào trạng thái render.
 *   B. Duyệt APPROVED thì vào render; từ chối REJECTED thì ra khỏi render, crop vẫn giữ.
 *   C. Ghi lại crop giống hệt không đổi trạng thái; đổi khung crop đặt lại PENDING và xoá người duyệt.
 * Chạy (DB test): DB_NAME=metro2_audit_test npx ts-node --transpile-only src/scripts/test_photo_qc_crop_review.ts
 */
import assert from 'assert';
import { Database } from '../database/db';
import { PhotoQcRepository } from '../modules/photo-qc/photo-qc.repository';
import type { PhotoQcCrop } from '../modules/photo-qc/photo-qc.types';

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

const CROP: PhotoQcCrop = { x: 0.1, y: 0.1, w: 0.6, h: 0.45, ratio: '4:3', rotationAtCrop: 0 };

async function main(): Promise<void> {
  const rep = await Database.query<{ id: string }>(`SELECT id FROM base_survey_reports WHERE deleted_at IS NULL LIMIT 1;`);
  const usr = await Database.query<{ id: string }>(`SELECT id FROM users WHERE deleted_at IS NULL LIMIT 1;`);
  if (!rep.rows[0] || !usr.rows[0]) {
    console.error('[TestPhotoQcCropReview] DB test không có hồ sơ/người dùng để thử');
    process.exitCode = 1;
    return;
  }
  const reportId = rep.rows[0].id;
  const userId = usr.rows[0].id;
  const base = { reportId, photoKey: 'P-TEST', photoUrl: 'https://example.invalid/a.jpg', photoLabel: 'Test', photoGroup: 'OUTDOOR' as const, userId };

  class Rollback extends Error {}
  try {
    await Database.transaction(async (client) => {
      await tc('A. crop mới là PENDING, chưa vào render', async () => {
        const row = await PhotoQcRepository.upsertPhoto(client, { ...base, crop: CROP });
        assert.equal(row.cropStatus, 'PENDING');
        const state = await PhotoQcRepository.loadRenderState(reportId, client);
        assert.ok(!state || !state.photos.some((p) => p.photoKey === 'P-TEST'));
      });

      await tc('B1. APPROVED thì vào render', async () => {
        const row = await PhotoQcRepository.setCropStatus(client, reportId, 'P-TEST', 'APPROVED', userId, { photoUrl: base.photoUrl, crop: CROP });
        assert.equal(row?.cropStatus, 'APPROVED');
        assert.ok(row?.cropReviewedAt);
        const state = await PhotoQcRepository.loadRenderState(reportId, client);
        assert.ok(state?.photos.some((p) => p.photoKey === 'P-TEST'));
      });

      await tc('C1. ghi lại crop giống hệt không đổi trạng thái', async () => {
        const row = await PhotoQcRepository.upsertPhoto(client, { ...base, crop: { ...CROP } });
        assert.equal(row.cropStatus, 'APPROVED');
      });

      await tc('C2. đổi khung crop đặt lại PENDING và ra khỏi render', async () => {
        const row = await PhotoQcRepository.upsertPhoto(client, { ...base, crop: { ...CROP, x: 0.2 } });
        assert.equal(row.cropStatus, 'PENDING');
        assert.equal(row.cropReviewedAt, null);
        const state = await PhotoQcRepository.loadRenderState(reportId, client);
        assert.ok(!state || !state.photos.some((p) => p.photoKey === 'P-TEST'));
      });

      await tc('E. duyệt theo khung cũ (người khác vừa đổi crop) bị từ chối, trạng thái giữ nguyên', async () => {
        const stale = await PhotoQcRepository.setCropStatus(client, reportId, 'P-TEST', 'APPROVED', userId, { photoUrl: base.photoUrl, crop: CROP });
        assert.equal(stale, null);
        const wrongUrl = await PhotoQcRepository.setCropStatus(client, reportId, 'P-TEST', 'APPROVED', userId, {
          photoUrl: 'https://example.invalid/khac.jpg',
          crop: { ...CROP, x: 0.2 },
        });
        assert.equal(wrongUrl, null);
        const ok = await PhotoQcRepository.setCropStatus(client, reportId, 'P-TEST', 'APPROVED', userId, { photoUrl: base.photoUrl, crop: { ...CROP, x: 0.2 } });
        assert.equal(ok?.cropStatus, 'APPROVED');
        // trả về PENDING cho ca B2 bên dưới
        await PhotoQcRepository.upsertPhoto(client, { ...base, crop: { ...CROP, x: 0.3 } });
      });

      await tc('G. đổi ảnh (chỉ bật cờ, không gửi crop) thì crop đã duyệt về PENDING, không trượt sang ảnh mới', async () => {
        const ok = await PhotoQcRepository.setCropStatus(client, reportId, 'P-TEST', 'APPROVED', userId, {
          photoUrl: base.photoUrl,
          crop: { ...CROP, x: 0.3 },
        });
        assert.equal(ok?.cropStatus, 'APPROVED');
        const moved = await PhotoQcRepository.upsertPhoto(client, { ...base, photoUrl: 'https://example.invalid/moi.jpg', recapture: true });
        assert.equal(moved.cropStatus, 'PENDING');
        assert.equal(moved.cropReviewedAt, null);
        const state = await PhotoQcRepository.loadRenderState(reportId, client);
        assert.ok(!state || !state.photos.some((p) => p.photoKey === 'P-TEST'));
        // cùng ảnh, chỉ bật/tắt cờ: giữ nguyên trạng thái
        const same = await PhotoQcRepository.upsertPhoto(client, { ...base, photoUrl: 'https://example.invalid/moi.jpg', recapture: false });
        assert.equal(same.cropStatus, 'PENDING');
        await PhotoQcRepository.upsertPhoto(client, { ...base });
      });

      await tc('B2. REJECTED ra khỏi render nhưng crop vẫn giữ', async () => {
        const row = await PhotoQcRepository.setCropStatus(client, reportId, 'P-TEST', 'REJECTED', userId);
        assert.equal(row?.cropStatus, 'REJECTED');
        assert.ok(row?.crop);
        const state = await PhotoQcRepository.loadRenderState(reportId, client);
        assert.ok(!state || !state.photos.some((p) => p.photoKey === 'P-TEST'));
      });

      await tc('H1. Thẩm định chỉnh khung: ghi khung mới và APPROVED luôn, vào render', async () => {
        const current = await PhotoQcRepository.upsertPhoto(client, { ...base, crop: CROP });
        assert.equal(current.cropStatus, 'PENDING');
        const fixed = { ...CROP, x: 0.25, y: 0.2 };
        const row = await PhotoQcRepository.adjustCrop(client, reportId, 'P-TEST', { photoUrl: base.photoUrl, crop: fixed }, userId, { photoUrl: base.photoUrl, crop: CROP });
        assert.equal(row?.cropStatus, 'APPROVED');
        assert.equal(row?.crop?.x, 0.25);
        const state = await PhotoQcRepository.loadRenderState(reportId, client);
        assert.ok(state?.photos.some((p) => p.photoKey === 'P-TEST'));
      });

      await tc('H2. Chỉnh khung theo bản cũ (khung đã bị đổi) bị từ chối, giữ nguyên', async () => {
        const row = await PhotoQcRepository.adjustCrop(client, reportId, 'P-TEST', { photoUrl: base.photoUrl, crop: { ...CROP, x: 0.05 } }, userId, { photoUrl: base.photoUrl, crop: CROP });
        assert.equal(row, null);
        const rows = await PhotoQcRepository.getPhotoRows([reportId], client);
        assert.equal(rows.find((r) => r.photoKey === 'P-TEST')?.crop?.x, 0.25);
      });

      await tc('D. ô không có crop không duyệt được', async () => {
        const none = await PhotoQcRepository.setCropStatus(client, reportId, 'P-KHONG-CO', 'APPROVED', userId);
        assert.equal(none, null);
      });

      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  }
  // F. Chốt chặn xuất (chỉ đọc): hồ sơ nháp còn crop PENDING phải bị từ chối với 409, báo đúng số crop.
  const pendingReport = await Database.query<{ report_id: string }>(
    `SELECT q.report_id FROM photo_qc_photos q JOIN base_survey_reports r ON r.id = q.report_id
      WHERE q.crop IS NOT NULL AND q.crop_status = 'PENDING' AND q.deleted_at IS NULL AND r.deleted_at IS NULL
        AND r.status::text <> 'APPROVED' LIMIT 1;`
  );
  if (pendingReport.rows[0]) {
    await tc('F. hồ sơ còn crop chờ duyệt bị chặn xuất (409)', async () => {
      const { PhotoQcService } = await import('../modules/photo-qc/photo-qc.service');
      let message = '';
      try {
        await PhotoQcService.assertCropsReviewed(pendingReport.rows[0].report_id);
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
      assert.match(message, /Không thể xuất report: còn \d+ crop chờ duyệt/);
    });
  } else {
    console.log('  (bỏ qua F: DB không có hồ sơ nháp nào còn crop PENDING)');
  }
  console.log(`\n${passed} kiểm thử đạt${process.exitCode ? ' (CÓ LỖI)' : ''}`);
}

main()
  .catch((err: unknown) => {
    console.error('[TestPhotoQcCropReview] Lỗi không mong đợi', err);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
