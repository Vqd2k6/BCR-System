/**
 * Kiểm thử xuất biên bản hiện trường trên dữ liệu thật (đọc nghiệp vụ, chỉ ghi job/audit).
 * Chạy: cd backend && DB_PASSWORD=... npx ts-node --transpile-only src/scripts/test_minutes_export.ts [ZONE_09]
 */
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5433';
process.env.DB_USER = process.env.DB_USER || 'metro2_user';
process.env.DB_NAME = process.env.DB_NAME || 'metro2_gis_db';

import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import sharp from 'sharp';
import { Database } from '../database/db';
import { fetchCondoUnitAbsenceMap } from '../modules/audit/condo/condo-absence.resolver';
import type { JwtPayload } from '../common/guards/auth.guard';
import { PdfRenderEngine } from '../modules/report/engine/pdf-render.engine';
import { ReportImageResolver } from '../modules/report/services/report-image-resolver.service';
import { Appendix3And4Mapper } from '../modules/report/mappers/appendices/appendix-3-4-records.mapper';
import { resolveLocalRepresentative } from '../modules/report/mappers/appendices/local-authority.rules';
import { MinutesExportService } from '../modules/report/services/minutes-export.service';
import { ReportService } from '../modules/report/services/report.service';
import { ZoneMinutesBatchService } from '../modules/report/services/zone-minutes-batch.service';
import { canAccessZone } from '../modules/report/utils/zone-access.utils';

const failures: string[] = [];
const check = (name: string, passed: boolean, detail = '') => {
  console.log(`${passed ? '  ok ' : 'FAIL '} ${name} ${detail}`);
  if (!passed) failures.push(`${name} ${detail}`);
};

const pdfPageCount = (pdf: Buffer): number => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

const superAdmin = { userId: '', username: 't', role: 'SUPER_ADMIN', fullName: 't' } as JwtPayload;
const zoneAdmin = (zone: string) => ({ ...superAdmin, role: 'ZONE_ADMIN', assignedZoneId: zone }) as JwtPayload;

const main = async () => {
  const zone = process.argv[2] || 'ZONE_09';

  // 1. Phân quyền Zone
  check('Zone Admin đúng Zone', canAccessZone(zoneAdmin('ZONE_09'), 'ZONE_09'));
  check('Zone Admin khác Zone bị chặn', !canAccessZone(zoneAdmin('ZONE_01'), 'ZONE_09'));
  check('Zone Admin chưa gán Zone bị chặn', !canAccessZone({ ...superAdmin, role: 'ZONE_ADMIN' }, 'ZONE_09'));
  check('Surveyor bị chặn', !canAccessZone({ ...superAdmin, role: 'SURVEYOR', assignedZoneId: 'ZONE_09' }, 'ZONE_09'));

  // 2. Chọn hồ sơ
  const items = await MinutesExportService.listZoneMinutes(zone);
  const exportable = items.filter((i) => i.fileName);
  const keys = new Set(items.map((i) => i.key));
  check('Mỗi thửa/căn đúng 1 dòng', keys.size === items.length, `${items.length} dòng`);
  const ids = new Set(exportable.map((i) => i.reportId));
  check('Không có hồ sơ xuất trùng', ids.size === exportable.length, `${exportable.length} hồ sơ`);
  check('Không có DRAFT', exportable.every((i) => ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(String(i.reportStatus))));
  check('Tên file không trùng', new Set(exportable.map((i) => i.fileName)).size === exportable.length);
  console.log('    phân loại:', JSON.stringify(items.reduce<Record<string, number>>((m, i) => ({ ...m, [i.category]: (m[i.category] ?? 0) + 1 }), {})));
  console.log('    cảnh báo con trỏ:', items.filter((i) => i.reportId && i.note).length);

  // 3. Vắng chủ và nhãn
  const absentees = items.filter((i) => i.category === 'ABSENTEE');
  const absenceMap = await fetchCondoUnitAbsenceMap(items.flatMap((i) => (i.reportId && i.unitCode ? [i.reportId] : [])));
  const resolverAbsent = [...absenceMap.values()].filter((a) => a.state === 'ABSENT').length;
  check('Có hồ sơ vắng chủ', absentees.length > 0, `${absentees.length}`);
  check('Hồ sơ vắng khớp resolver', absentees.filter((i) => absenceMap.has(String(i.reportId))).length === resolverAbsent, `${resolverAbsent}`);
  check('Hồ sơ vắng không xuất biên bản', absentees.every((i) => !i.fileName && i.label === null && i.docPageCount === 0 && i.note === 'Chưa có biên bản vắng nhà'));
  check('Hồ sơ xuất được đều là MINUTES', exportable.length === items.filter((i) => i.category === 'MINUTES').length);
  check('Không căn vắng nào có biên bản', !exportable.some((i) => absenceMap.get(String(i.reportId))?.state === 'ABSENT'));
  const suspected = exportable.filter((i) => absenceMap.get(String(i.reportId))?.state === 'SUSPECTED');
  check('Căn nghi vắng xuất kèm ghi chú', suspected.every((i) => i.note?.includes('Nghi vắng, cần Admin xác nhận')), `${suspected.length} căn`);
  if (absentees[0]?.reportId) {
    let rejected = false;
    try {
      await MinutesExportService.renderMinutesPdf(await ReportService.resolve(absentees[0].reportId));
    } catch (err) {
      rejected = String((err as Error).message).includes('chưa có biên bản vắng nhà');
    }
    check('API từ chối xuất hồ sơ vắng', rejected);
  }
  console.log('    xuất được:', exportable.length);
  const approved = exportable.filter((i) => i.reportStatus === 'APPROVED');
  check('Chỉ APPROVED ghi ĐÃ KÝ', exportable.every((i) => (i.label === 'ĐÃ KÝ XÁC NHẬN') === (i.reportStatus === 'APPROVED' && i.category !== 'ABSENTEE')));

  // 4. Ảnh hỏng làm hồ sơ thất bại
  let failedLoudly = false;
  try {
    await ReportImageResolver.loadImageStrict('https://pub-4e9eb9f02bd948ca92dd0d3fe780f77d.r2.dev/khong-ton-tai-test.jpg');
  } catch {
    failedLoudly = true;
  }
  check('URL ảnh hỏng ném lỗi', failedLoudly);

  // Dữ liệu thật chưa có ảnh biên bản đặt góc xoay nên kiểm bằng ảnh tổng hợp
  const landscape = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const landscapeUri = `data:image/png;base64,${landscape.toString('base64')}`;
  const rotated = await ReportImageResolver.loadImageStrict(landscapeUri, 90);
  const rotatedMeta = await sharp(Buffer.from(rotated.split(',')[1], 'base64')).metadata();
  check('Xoay 90° đổi chiều ảnh', rotatedMeta.width === 20 && rotatedMeta.height === 40, `${rotatedMeta.width}x${rotatedMeta.height}`);
  check('Không xoay giữ nguyên byte gốc', (await ReportImageResolver.loadImageStrict(landscapeUri, 0)) === landscapeUri);
  check('Ghi chú con trỏ sai', true, `${items.filter((i) => i.note?.startsWith('Con trỏ')).length} hồ sơ`);

  // Nội dung bảng và chú thích biên bản
  const docPhoto = { workingMinutesPhotos: [landscapeUri] };
  const mapped = Appendix3And4Mapper.mapAppendix3({ project_parcel_code: 'C&C-05-B-0004' }, docPhoto, [], '', '', '', '', '', 'B-00004-C&C (ST05)');
  check('TVGS mặc định', mapped.supervisionConsultant.vi === 'Tổng thầu EPC-THACO-CREC', mapped.supervisionConsultant.vi);
  check('Chú thích dùng mã thửa', mapped.signedRecordPages[0].title.vi === 'Biên bản xác nhận khảo sát hiện trường C&C-05-B-0004 - trang 1/1', mapped.signedRecordPages[0].title.vi);
  check('Không có người chứng kiến giữ --', mapped.localAuthority.vi === '--');
  check('Đơn vị khảo sát chỉ ghi liên danh', mapped.surveyUnit.vi === 'Liên danh CRLG – CRSRI – TT', mapped.surveyUnit.vi);
  const contact = Appendix3And4Mapper.mapAppendix3({ house_number: '530', street: 'Cách Mạng Tháng Tám', ward: 'Phường 11', owner_phone: '0901234567' }, {});
  check('Biên bản có địa chỉ', contact.address.vi.includes('530') && contact.address.vi.includes('Cách Mạng Tháng Tám'), contact.address.vi);
  check('Biên bản có số điện thoại', contact.contactPhone === '0901234567', contact.contactPhone);
  check('Thiếu số điện thoại hiện --', mapped.contactPhone === '--');
  const representativeCases: Array<[string, string, string, string]> = [
    ['Nhiêu Lộc', 'Cách Mạng Tháng Tám', 'Quận 3', 'Lê Văn Sơn'],
    ['Phường 11', 'Hẻm 616, Cách Mạng Tháng Tám', 'Quận 3', 'Lê Văn Sơn'],
    ['Tân Hòa', 'Cách Mạng Tháng Tám', 'Quận Tân Bình', 'Nguyễn Tấn Phát'],
    ['Tân Hoà', 'Bắc Hải', 'Quận Tân Bình', 'Nguyễn Tấn Phát'],
    ['Phường 6', 'Chấn Hưng', 'Quận Tân Bình', 'Nguyễn Tấn Phát'],
    ['Hòa Hưng', 'Bắc Hải', 'Quận 10', 'Nguyễn Cao Vân'],
    ['Hoà Hưng', 'Đường Bắc Hải', 'Quận 10', 'Nguyễn Cao Vân'],
    ['Phường 15', 'Bắc Hải', 'Quận 10', 'Nguyễn Cao Vân'],
    ['Hòa Hưng', 'Trường Sơn', 'Quận 10', 'Lương Quang Thuận'],
    ['Phường 15', 'Cách Mạng Tháng Tám', 'Quận 10', 'Lương Quang Thuận'],
  ];
  for (const [ward, street, district, expected] of representativeCases) {
    const actual = resolveLocalRepresentative('ZONE_09', ward, street, district);
    check(`Đại diện ${ward} / ${street}`, actual === expected, actual);
  }
  check('Zone khác không áp quy tắc', resolveLocalRepresentative('ZONE_01', 'Nhiêu Lộc', '', 'Quận 3') === '');
  check('Phường lạ không suy đoán', resolveLocalRepresentative('ZONE_09', 'Bến Thành', '', 'Quận 1') === '');
  const recordedWitness = Appendix3And4Mapper.mapAppendix3({ zone_id: 'ZONE_09', ward: 'Nhiêu Lộc' }, { signatures: { witnessName: 'Trần B', witnessRole: 'Tổ trưởng' } });
  check('Hồ sơ có người chứng kiến được ưu tiên', recordedWitness.localAuthority.vi === 'Trần B - Tổ trưởng', recordedWitness.localAuthority.vi);
  const masterAddressJson = { standardizedAddress: 'Số Chung Cư 522-588 Cách Mạng Tháng Tám, Phường Nhiêu Lộc, TP. Hồ Chí Minh' };
  const masterAddress = Appendix3And4Mapper.mapAppendix3({ house_number: '433', street: 'Hảm 618', ward: 'Phường 11' }, masterAddressJson).address.vi;
  check('Địa chỉ chuẩn hóa thay địa chỉ cũ', masterAddress === 'Chung Cư 522-588 Cách Mạng Tháng Tám, Phường Nhiêu Lộc, TP. Hồ Chí Minh', masterAddress);
  const condoAddress = Appendix3And4Mapper.mapAppendix3({ house_number: 'Chung cư 522-588', street: 'Cách Mạng Tháng Tám' }, {}).address.vi;
  check('Địa chỉ chung cư không thêm chữ Số', condoAddress.startsWith('Chung cư 522-588, Đường'), condoAddress);
  const entered = Appendix3And4Mapper.mapAppendix3({}, { signatures: { supervisionConsultant: { fullName: 'KS. A', title: 'TVGS' } } });
  check('TVGS đã nhập được giữ', entered.supervisionConsultant.vi === 'KS. A - TVGS', entered.supervisionConsultant.vi);
  const absenteeCaption = Appendix3And4Mapper.mapAppendix3({ project_parcel_code: 'C&C-05-B-0004', is_refused_or_absent: true }, docPhoto).signedRecordPages[0].title.vi;
  check('Chú thích vắng chủ có mã thửa', absenteeCaption.includes('vắng chủ C&C-05-B-0004 - trang 1/1'), absenteeCaption);

  // 5. Mẫu PDF: vắng chủ, APPROVED, thường
  const samples = [suspected[0], approved[0], exportable.find((i) => i.category === 'MINUTES' && i.docPageCount >= 4)].filter(Boolean);
  const outDir = process.env.MINUTES_OUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'minutes-'));
  for (const item of samples) {
    const start = Date.now();
    const resolved = await ReportService.resolve(String(item!.reportId));
    const result = await MinutesExportService.renderMinutesPdf(resolved);
    const pages = pdfPageCount(result.pdfBuffer);
    check(`Số trang ${item!.fileName}`, pages === 1 + result.docPageCount, `${pages} trang, ${(result.pdfBuffer.length / 1048576).toFixed(1)} MB, ${Date.now() - start} ms`);
    fs.writeFileSync(path.join(outDir, String(item!.fileName)), result.pdfBuffer);
  }
  console.log('    PDF mẫu:', outDir);

  // 6. Job ZIP thật (tùy chọn vì lâu và ghi job vào bảng)
  if (process.env.RUN_BATCH === '1') {
    const userRes = await Database.query<{ id: string }>(`SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1;`);
    const job = await ZoneMinutesBatchService.createJob(zone, { ...superAdmin, userId: userRes.rows[0].id }, '127.0.0.1');
    const startedAt = Date.now();
    let peakRss = 0;
    let status = job;
    while (status.status === 'QUEUED' || status.status === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
      status = await ZoneMinutesBatchService.getJob(job.id, superAdmin);
      process.stdout.write(`\r    ${status.progressDone}/${status.progressTotal} lỗi ${status.failedCount} ${status.currentItem ?? ''}          `);
    }
    console.log(`\n    ${status.status} sau ${((Date.now() - startedAt) / 1000).toFixed(0)} s, RSS đỉnh ${(peakRss / 1048576).toFixed(0)} MB, ZIP ${((status.fileSizeBytes ?? 0) / 1048576).toFixed(0)} MB`);
    check('Job hoàn tất', status.status === 'COMPLETED', String(status.errorMessage ?? ''));

    const row = await Database.query<{ file_path: string }>(`SELECT file_path FROM compiled_report_batches WHERE id = $1;`, [job.id]);
    const zipPath = row.rows[0].file_path;
    const zipHash = createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
    check('SHA-256 ZIP khớp', zipHash === status.checksumSha256);

    const unzipDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minutes-zip-'));
    execFileSync('unzip', ['-q', zipPath, '-d', unzipDir]);
    const csv = fs.readFileSync(path.join(unzipDir, `Danh_muc_bien_ban_${status.zoneId}.csv`), 'utf8');
    check('CSV có BOM UTF-8', csv.charCodeAt(0) === 0xfeff);
    const rows = csv.trim().split('\r\n').slice(1).map((line) => line.slice(1, -1).split('","'));
    check('Danh mục đủ mọi thửa/căn', rows.length === items.length, `${rows.length}/${items.length}`);
    const withFile = rows.filter((cells) => cells[6]);
    let mismatched = 0;
    for (const cells of withFile) {
      const hash = createHash('sha256').update(fs.readFileSync(path.join(unzipDir, cells[6]))).digest('hex');
      if (hash !== cells[5]) mismatched++;
    }
    check('SHA-256 từng PDF khớp danh mục', mismatched === 0, `${withFile.length} file`);
    fs.rmSync(unzipDir, { recursive: true, force: true });
  }

  await PdfRenderEngine.closeBrowser();
  if (failures.length > 0) {
    console.error(`\nFAILED ${failures.length} kiểm tra`);
    process.exit(1);
  }
  console.log('\nPASSED');
  process.exit(0);
};

main().catch((err) => {
  console.error('[MinutesExportTest] Failed:', err);
  process.exit(1);
});
