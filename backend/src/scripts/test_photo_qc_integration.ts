/**
 * Kiểm thử tích hợp Photo QC trên CSDL local – CHỈ ĐỌC.
 *   1. Danh sách tổng quan theo ga (ST04) và chi tiết một hồ sơ.
 *   2. Hồi quy: hồ sơ không có QC → HTML giống hệt khi đi qua nhánh QC rỗng.
 *   3. Render với trạng thái QC giả lập (đóng băng, không ghi DB): bìa P04 + crop P-02 + crop ảnh khuyết tật.
 * Chạy: npx ts-node --transpile-only src/scripts/test_photo_qc_integration.ts [reportId]
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Database } from '../database/db';
import type { JwtPayload } from '../common/guards/auth.guard';
import { PhotoQcService } from '../modules/photo-qc/photo-qc.service';
import { ReportService } from '../modules/report/services/report.service';
import type { PhotoQcRenderState } from '../modules/photo-qc/photo-qc.types';

const OUT_DIR = process.env.PHOTO_QC_OUT || path.resolve(process.cwd(), '..', 'tmp_photo_qc');

function dims(dataUri: string | undefined): Promise<sharp.Metadata> {
  assert.ok(dataUri && dataUri.startsWith('data:image/'), 'ảnh phải là data URI');
  return sharp(Buffer.from(dataUri.split(',')[1], 'base64')).metadata();
}

/** Bỏ các dấu thời gian sinh lúc render để so HTML hai lượt. */
function stableHtml(html: string): string {
  return html.replace(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}(:\d{2})?/g, '<DT>').replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, '<ISO>');
}

async function main(): Promise<void> {
  const sa = await Database.query<{ id: string; username: string; full_name: string }>(
    `SELECT id, username, full_name FROM users WHERE role = 'SUPER_ADMIN' AND deleted_at IS NULL ORDER BY created_at LIMIT 1;`
  );
  assert.ok(sa.rows[0], 'cần một tài khoản SUPER_ADMIN ở local');
  const user: JwtPayload = { userId: sa.rows[0].id, username: sa.rows[0].username, role: 'SUPER_ADMIN', fullName: sa.rows[0].full_name };

  console.log('1. Danh sách ST04 (trang đầu)');
  const t0 = Date.now();
  const page = await PhotoQcService.list(user, { station: 'ST04', limit: 50 });
  console.log(`   ${page.items.length} hồ sơ, ${Date.now() - t0} ms, nextCursor=${page.nextCursor ? 'có' : 'không'}`);
  assert.ok(page.items.length > 0, 'ST04 phải có hồ sơ ở local');
  const sample = page.items[0];
  console.log(`   ${sample.reportCode} (${sample.kind}) ảnh P: ${sample.pPhotos.map((p) => `${p.photoKey}@${p.rotation}°`).join(', ')}`);
  if (page.nextCursor) {
    const page2 = await PhotoQcService.list(user, { station: 'ST04', limit: 50, cursor: page.nextCursor });
    assert.ok(page2.items.every((i) => i.reportCode > page.items[page.items.length - 1].reportCode), 'keyset phải sang trang mới');
    console.log(`   trang 2: ${page2.items.length} hồ sơ`);
  }

  const reportId = process.argv[2] || page.items.find((i) => i.pPhotos.some((p) => p.photoKey === 'P-04'))?.reportId || sample.reportId;
  console.log(`2. Chi tiết ${reportId}`);
  const t1 = Date.now();
  const detail = await PhotoQcService.detail(user, reportId);
  console.log(`   ${detail.photos.length} ảnh (${detail.photos.filter((p) => p.section === 'P').length} P), ${Date.now() - t1} ms, hasP04=${detail.hasP04}`);
  const listItem = page.items.find((i) => i.reportId === reportId);
  if (listItem) {
    const detailP = detail.photos.filter((p) => p.section === 'P').map((p) => `${p.photoKey}|${p.url}|${p.rotation}`);
    const listP = listItem.pPhotos.map((p) => `${p.photoKey}|${p.url}|${p.rotation}`);
    assert.deepStrictEqual(listP, detailP, 'ảnh P ở danh sách và chi tiết phải trùng khoá, URL và góc');
    console.log('   ✅ danh sách và chi tiết cùng ô P, cùng URL, cùng góc in');
  }

  console.log('3. Hồi quy: không QC');
  const raw = await ReportService.resolveReport(reportId);
  const baseline = await ReportService.generateHtmlFromReport(raw, undefined, false, true);
  const frozenEmpty = await ReportService.generateHtmlFromReport({ ...raw, photo_qc_frozen: true, photo_qc: null }, undefined, false, true);
  assert.strictEqual(stableHtml(frozenEmpty.html), stableHtml(baseline.html), 'không QC thì HTML phải giống hệt');
  console.log(`   ✅ HTML giống hệt (${baseline.html.length} ký tự)`);

  console.log('4. Render với QC giả lập');
  const p02 = detail.photos.find((p) => p.photoKey === 'P-02');
  const defect = detail.photos.find((p) => p.section !== 'P' && p.rotation !== 0) ?? detail.photos.find((p) => p.section !== 'P');
  const photos: PhotoQcRenderState['photos'] = [];
  if (p02) photos.push({ photoKey: 'P-02', photoUrl: p02.url, crop: { x: 0, y: 0, w: 0.5, h: 0.5, ratio: '4:3', rotationAtCrop: p02.rotation }, restampMode: 'NONE' });
  if (defect) photos.push({ photoKey: defect.photoKey, photoUrl: defect.url, crop: { x: 0.1, y: 0.1, w: 0.6, h: 0.6, ratio: '4:3', rotationAtCrop: defect.rotation }, restampMode: 'BOTH' });
  const state: PhotoQcRenderState = { coverSource: detail.hasP04 && detail.coverEligible ? 'P04' : null, photos };
  const qcRun = await ReportService.generateHtmlFromReport({ ...raw, photo_qc_frozen: true, photo_qc: state }, undefined, false, true);
  const vm0 = baseline.viewModel;
  const vm1 = qcRun.viewModel;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const save = (name: string, uri?: string) => {
    if (uri && uri.startsWith('data:image/')) fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(uri.split(',')[1], 'base64'));
  };
  if (state.coverSource === 'P04') {
    const p04 = vm1.appendix1.find((p) => p.photoCode === 'P-04');
    assert.strictEqual(vm1.metadata.coverPhotoUrl, p04?.url, 'bìa phải là URL P-04');
    assert.notStrictEqual(vm1.metadata.coverPhotoUrl, vm0.metadata.coverPhotoUrl);
    save('cover_p04.jpg', vm1.metadata.coverPhotoBase64);
    console.log('   ✅ bìa = P-04');
  }
  if (p02) {
    const before = vm0.appendix1.find((p) => p.photoCode === 'P-02');
    const after = vm1.appendix1.find((p) => p.photoCode === 'P-02');
    const [m0, m1] = await Promise.all([dims(before?.base64), dims(after?.base64)]);
    console.log(`   P-02 ${m0.width}×${m0.height} → ${m1.width}×${m1.height} (xoay ${p02.rotation}°)`);
    assert.ok(Math.abs((m1.width ?? 0) - Math.round((m0.width ?? 0) / 2)) <= 2, 'P-02 cắt còn nửa bề rộng');
    assert.ok(Math.abs((m1.height ?? 0) - Math.round((m0.height ?? 0) / 2)) <= 2, 'P-02 cắt còn nửa chiều cao');
    save('p02_before.jpg', before?.base64);
    save('p02_after.jpg', after?.base64);
    console.log('   ✅ P-02 đã cắt đúng kích thước, đã có dấu trong khung');
  }
  if (defect) {
    const { walkViewModelPhotos } = await import('../modules/photo-qc/photo-qc.vm-walker');
    const r0 = walkViewModelPhotos(vm0).find((r) => r.url === defect.url && r.section !== 'COVER');
    const r1 = walkViewModelPhotos(vm1).find((r) => r.url === defect.url && r.section !== 'COVER');
    const [d0, d1] = await Promise.all([dims(r0?.getBase64()), dims(r1?.getBase64())]);
    console.log(`   ${defect.label}: xoay ${defect.rotation}°, ${d0.width}×${d0.height} → ${d1.width}×${d1.height}, legacy=${defect.legacyWatermarked}`);
    assert.ok(Math.abs((d1.width ?? 0) - Math.round((d0.width ?? 0) * 0.6)) <= 2, 'ảnh khuyết tật cắt 60% bề rộng');
    assert.ok(Math.abs((d1.height ?? 0) - Math.round((d0.height ?? 0) * 0.6)) <= 2, 'ảnh khuyết tật cắt 60% chiều cao');
    save('defect_before.jpg', r0?.getBase64());
    save('defect_after.jpg', r1?.getBase64());
    console.log('   ✅ ảnh khuyết tật đã cắt đúng kích thước');
  }
  console.log(`   ảnh xuất ra: ${OUT_DIR}`);

  console.log('5. Góc in thật lúc render khớp góc màn rà soát (điều kiện để crop có hiệu lực)');
  const noWm = await ReportService.generateHtmlFromReport(raw, undefined, false, false);
  const { walkViewModelPhotos: walk } = await import('../modules/photo-qc/photo-qc.vm-walker');
  const { ReportImageResolver } = await import('../modules/report/services/report-image-resolver.service');
  const qcRot = new Map(detail.photos.map((p) => [p.url, p.rotation]));
  let rotatedCount = 0;
  const intentGap: string[] = [];
  const normalizeIntent = (d: number) => ((Math.round(Number(d) || 0) % 360) + 360) % 360;
  const mismatches: string[] = [];
  for (const r of walk(noWm.viewModel)) {
    const printed = ReportImageResolver.getRotationOrigin(r.getBase64())?.deg ?? 0;
    if (printed) rotatedCount++;
    if ((r.section === 'P' || r.section === 'DEFECT' || r.section === 'OVERVIEW') && normalizeIntent(r.rotation) !== printed) intentGap.push(`${r.label}: mapper ${r.rotation}° / in ${printed}°`);
    const q = qcRot.get(r.url);
    if (q !== undefined && q !== printed) mismatches.push(`${r.label}: in ${printed}° / rà soát ${q}° / mapper ${r.rotation}°`);
  }
  console.log(`   ảnh in có xoay: ${rotatedCount}, lệch: ${mismatches.length}`);
  if (intentGap.length) console.log(`   ℹ mapper muốn xoay nhưng bản in không xoay (lỗi có sẵn, không do Photo QC): ${intentGap.length}`, intentGap.slice(0, 5));
  mismatches.slice(0, 8).forEach((m) => console.log('   ⚠', m));
  assert.strictEqual(mismatches.length, 0, 'góc in và góc rà soát phải khớp');
  console.log('   ✅ khớp');
}

main()
  .catch((err) => {
    console.error('[test_photo_qc_integration] Lỗi', err);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 200));
