/**
 * Kiểm thử đa template report nhà dân (R0–R2, chốt 14/11/2026):
 *  1. Gọi không tham số vẫn là v1 nhà dân (script cũ) và CSS biên bản giống từng byte CSS cũ.
 *  2. Chọn template: chung cư luôn v1 và từ chối v2; Rev đã khóa thắng lựa chọn; mặc định theo env.
 *  3. v2 chưa dựng → báo lỗi rõ ràng; v2 có thư mục → môi trường Handlebars riêng, partial không đè v1.
 *  4. Template đóng băng theo Rev: đọc từ snapshot, cột report_releases.template_key có mặc định v1 + CHECK.
 *
 * Chạy: npx ts-node src/scripts/test_report_template_variants.ts
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ReportService } from '../modules/report/services/report.service';
import { MinutesExportService } from '../modules/report/services/minutes-export.service';
import { ReportFontsService } from '../modules/report/services/report-fonts.service';
import { defaultResidentialTemplateKey } from '../modules/report/services/report-template-kind';
import type { ReportSnapshot } from '../modules/report/schemas/report-snapshot.schema';
import { Database } from '../database/db';

let passed = 0;
let failed = 0;

function check(condition: boolean, label: string, detail?: unknown): void {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}`, detail ?? '');
  }
}

async function expectError(fn: () => unknown, errorName: string, label: string): Promise<void> {
  try {
    await fn();
    check(false, label, 'không ném lỗi');
  } catch (err: unknown) {
    const name = err instanceof Error ? err.constructor.name : String(err);
    check(name === errorName, label, name);
  }
}

const TEMPLATES_DIR = path.join(__dirname, '../modules/report/templates');
const V1_DIR = path.join(TEMPLATES_DIR, 'residential');
const V2_DIR = path.join(TEMPLATES_DIR, 'residential-v2');

const STANDALONE_RAW = { id: 'x', unit_id: null, building_type: 'TOWNHOUSE' };
const CONDO_UNIT_RAW = { id: 'y', unit_id: 'u-1', unit_type: 'UNIT', unit_code: 'U-101', building_type: 'CONDOMINIUM' };
const BUILDING_MASTER_RAW = { id: 'z', unit_id: null, building_type: 'CONDOMINIUM' };

function snapshotWith(frozenReportData?: Record<string, unknown>): ReportSnapshot {
  return { frozenReportData } as unknown as ReportSnapshot;
}

async function main(): Promise<void> {
  console.log('\n1. Tương thích ngược');
  const legacy = ReportService.getCompiledTemplate();
  const explicitV1 = ReportService.getCompiledTemplate('STANDALONE', 'residential_v1');
  check(legacy.template === explicitV1.template, 'getCompiledTemplate() không tham số = v1 nhà dân (cùng bản biên dịch)');
  const oldStyles = `${ReportFontsService.getFontCss()}\n${fs.readFileSync(path.join(V1_DIR, 'styles.css'), 'utf8')}`;
  check(legacy.styles === oldStyles, 'CSS v1 = font + residential/styles.css như trước');
  check(MinutesExportService.getStyles() === oldStyles, 'CSS biên bản giống từng byte CSS cũ (bản sao minutes/styles.css)');
  check(
    legacy.render.headerFooter && legacy.render.tocTwoPass && legacy.render.waitForReportReady,
    'v1 giữ cấu hình in cũ (đầu/chân trang engine, Mục lục 2 lượt, chờ __reportReady)'
  );

  console.log('\n2. Chọn template');
  const envBackup = process.env.DEFAULT_RESIDENTIAL_TEMPLATE;
  delete process.env.DEFAULT_RESIDENTIAL_TEMPLATE;
  check(defaultResidentialTemplateKey() === 'residential_v1', 'không đặt env → mặc định v1');
  process.env.DEFAULT_RESIDENTIAL_TEMPLATE = 'residential_v9';
  check(defaultResidentialTemplateKey() === 'residential_v1', 'env lạ → log lỗi và dùng v1');
  process.env.DEFAULT_RESIDENTIAL_TEMPLATE = 'residential_v2';
  check(ReportService.resolveTemplateKey(STANDALONE_RAW) === 'residential_v2', 'nhà dân theo env mặc định v2');
  check(ReportService.resolveTemplateKey(STANDALONE_RAW, 'residential_v1') === 'residential_v1', 'Admin chọn v1 thắng mặc định');
  check(
    ReportService.resolveTemplateKey(STANDALONE_RAW, 'residential_v2', 'residential_v1') === 'residential_v1',
    'Rev đã khóa v1 thắng lựa chọn v2 và env v2'
  );
  check(ReportService.resolveTemplateKey(CONDO_UNIT_RAW) === 'residential_v1', 'căn hộ U: env v2 không kéo theo (nền v1)');
  check(ReportService.resolveTemplateKey(BUILDING_MASTER_RAW) === 'residential_v1', 'Tòa mẹ: env v2 không kéo theo (nền v1)');
  await expectError(() => ReportService.resolveTemplateKey(CONDO_UNIT_RAW, 'residential_v2'), 'BadRequestError', 'căn hộ U chọn v2 → 400');
  await expectError(() => ReportService.resolveTemplateKey(BUILDING_MASTER_RAW, 'residential_v2'), 'BadRequestError', 'Tòa mẹ chọn v2 → 400');
  if (envBackup === undefined) delete process.env.DEFAULT_RESIDENTIAL_TEMPLATE;
  else process.env.DEFAULT_RESIDENTIAL_TEMPLATE = envBackup;

  console.log('\n3. Cô lập template v2');
  const v2Exists = fs.existsSync(path.join(V2_DIR, 'index.hbs'));
  if (!v2Exists) {
    check(!ReportService.isTemplateAvailable('residential_v2'), 'v2 chưa dựng → không có trong danh sách sẵn sàng');
    await expectError(() => ReportService.getCompiledTemplate('STANDALONE', 'residential_v2'), 'ConflictError', 'v2 chưa dựng → 409 rõ ràng');
    // Dựng tạm thư mục v2 giả để kiểm cô lập partial, xóa ngay sau khi kiểm.
    const createdDir = !fs.existsSync(V2_DIR);
    try {
      fs.mkdirSync(path.join(V2_DIR, 'partials'), { recursive: true });
      fs.writeFileSync(path.join(V2_DIR, 'index.hbs'), 'V2[{{> page-01-cover}}][{{> watermark-issues}}]');
      fs.writeFileSync(path.join(V2_DIR, 'styles.css'), '.v2-only{color:red}');
      fs.writeFileSync(path.join(V2_DIR, 'partials', 'page-01-cover.hbs'), 'COVER-V2');
      fs.writeFileSync(path.join(V2_DIR, 'render-options.json'), JSON.stringify({ headerFooter: false }));
      const v2 = ReportService.getCompiledTemplate('STANDALONE', 'residential_v2');
      const html = v2.template({ watermarkIssueCount: 0 });
      check(html.startsWith('V2[COVER-V2]'), 'v2 dùng partial cùng tên của chính nó', html.slice(0, 40));
      check(v2.styles.includes('.v2-only') && !v2.styles.includes(fs.readFileSync(path.join(V1_DIR, 'styles.css'), 'utf8').slice(0, 200)), 'v2 chỉ có CSS riêng, không kèm CSS v1');
      check(!v2.render.headerFooter && v2.render.tocTwoPass, 'render-options.json của v2 được áp, khóa thiếu giữ mặc định');
      const v1After = ReportService.getCompiledTemplate();
      const v1Html = v1After.template === legacy.template;
      check(v1Html, 'biên dịch v2 không làm v1 biên dịch lại');
      const globalCover = (await import('handlebars')).default.partials['page-01-cover'];
      check(typeof globalCover === 'string' && !globalCover.includes('COVER-V2'), 'partial toàn cục của v1 không bị v2 ghi đè');
    } finally {
      if (createdDir) fs.rmSync(V2_DIR, { recursive: true, force: true });
    }
  } else {
    check(ReportService.isTemplateAvailable('residential_v2'), 'v2 đã dựng → sẵn sàng');
    const v2 = ReportService.getCompiledTemplate('STANDALONE', 'residential_v2');
    check(v2.template !== legacy.template, 'v2 có bản biên dịch riêng');
  }

  console.log('\n4. Template đóng băng theo Rev');
  check(
    (await ReportService.getFrozenTemplateKey(null, snapshotWith({ template_key: 'residential_v2' }))) === 'residential_v2',
    'snapshot có template_key → dùng khóa trong snapshot'
  );
  check((await ReportService.getFrozenTemplateKey(null, snapshotWith({}))) === null, 'snapshot chưa phát hành → null (theo lựa chọn/mặc định)');
  check(
    (await ReportService.getFrozenTemplateKey('00000000-0000-0000-0000-000000000000', snapshotWith({}))) === null,
    'snapshot không gắn Rev nào → null'
  );
  const col = await Database.query<{ column_default: string | null; is_nullable: string }>(
    `SELECT column_default, is_nullable FROM information_schema.columns
     WHERE table_name = 'report_releases' AND column_name = 'template_key';`
  );
  check(
    col.rows[0]?.is_nullable === 'NO' && String(col.rows[0]?.column_default).includes('residential_v1'),
    'cột report_releases.template_key NOT NULL DEFAULT v1 (Rev cũ = v1)',
    col.rows[0]
  );
  const legacyRelease = await Database.query<{ snapshot_version_id: string; template_key: string }>(
    `SELECT snapshot_version_id, template_key FROM report_releases
     WHERE snapshot_version_id IS NOT NULL AND deleted_at IS NULL LIMIT 1;`
  );
  if (legacyRelease.rows[0]) {
    const r = legacyRelease.rows[0];
    check(
      (await ReportService.getFrozenTemplateKey(r.snapshot_version_id, snapshotWith({}))) === r.template_key,
      'snapshot cũ không có khóa → tra cột report_releases'
    );
  } else {
    console.log('  (bỏ qua: DB chưa có Rev nào để tra cột)');
  }

  console.log(`\nKết quả: ${passed} đạt, ${failed} lỗi`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('[test_report_template_variants] Lỗi không mong muốn', err);
  process.exit(1);
});
