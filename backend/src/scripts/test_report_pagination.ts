/**
 * Kiểm thử bố cục PDF báo cáo Phase 1 (gom liên tục Mục I–IX, đầu/chân trang, Mục lục theo trang thật).
 *
 *   cd backend && npx ts-node --transpile-only src/scripts/test_report_pagination.ts [reportId ...]
 *
 * Không truyền id: lấy ngẫu nhiên 3 hồ sơ chưa xoá trong DB. Thoát mã 1 nếu có ca lỗi.
 * Kiểm: (a) mỗi trang từ Mục I đến Mục IX lấp ≥ 40%, trừ trang cuối của Mục IX;
 *       (b) số trang in trong Mục lục = trang thật của tiêu đề; (c) bìa không có đầu/chân trang, trang ≥ 2 có đủ
 *       và "Trang i / N" đúng; (d) bìa in "Page: 1 of N" đúng tổng số trang; (e) hồ sơ nặng vẫn xuất được.
 */
import 'dotenv/config';
import { Database } from '../database/db';
import { ReportService } from '../modules/report/services/report.service';
import { PdfRenderEngine } from '../modules/report/engine/pdf-render.engine';
import {
  analyzePdfPages,
  locateSectionPages,
  readPageText,
  readTocPageNumbers,
  type SectionHeading,
} from '../modules/report/engine/pdf-page-analysis';

const MIN_BODY_FILL_PCT = 40;
const BODY_FIRST_KEY = 'sec-1';
const BODY_LAST_KEY = 'sec-9';
/** Tiêu đề chương Mục I–IX và phụ lục dùng để dò (khớp chữ trong template, đủ để định vị trang). */
const HEADINGS: SectionHeading[] = [
  { key: 'sec-1', text: 'I. THÔNG TIN CHUNG - GENERAL INFORMATION' },
  { key: 'sec-2', text: 'II. THÔNG TIN CƠ BẢN VỀ TÒA NHÀ - BASIC BUILDING' },
  { key: 'sec-3', text: 'III. LỊCH SỬ VÀ TÌNH TRẠNG SỬ DỤNG - BUILDING' },
  { key: 'sec-5', text: 'V. ĐỘ NGHIÊNG/LÚN - GHI NHẬN SƠ BỘ' },
  { key: 'sec-7', text: 'VII. PHÂN LOẠI HƯ HẠI THEO BURLAND' },
  { key: 'sec-8', text: 'VIII. ĐÁNH GIÁ TÌNH TRẠNG CÔNG TRÌNH - BUILDING' },
  { key: 'sec-9', text: 'IX. KẾT LUẬN VÀ KIẾN NGHỊ - CONCLUSION' },
];

let failures = 0;
function check(ok: boolean, label: string, detail = ''): void {
  if (ok) {
    console.log(`  ✅ ${label}`);
  } else {
    failures += 1;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function pickReportIds(): Promise<string[]> {
  const res = await Database.query<{ id: string }>(
    `SELECT id FROM base_survey_reports WHERE deleted_at IS NULL ORDER BY random() LIMIT 3;`
  );
  return res.rows.map((r) => r.id);
}

async function testReport(id: string): Promise<void> {
  console.log(`\n=== ${id}`);
  const t0 = Date.now();
  const resolved = await ReportService.resolve(id);
  const { pdfBuffer } = await ReportService.renderDraftPdf(resolved, undefined, false, undefined);
  console.log(`  PDF ${(pdfBuffer.length / 1e6).toFixed(1)} MB trong ${Date.now() - t0} ms`);
  check(pdfBuffer.length > 1000, '(e) xuất được PDF');

  const stats = await analyzePdfPages(pdfBuffer);
  const total = stats.length;
  const located = await locateSectionPages(pdfBuffer, HEADINGS);
  const present = HEADINGS.filter((h) => located.pages[h.key] !== undefined);
  const absentVariant = located.pages[BODY_FIRST_KEY] === undefined || located.pages[BODY_LAST_KEY] === undefined;

  // (c) đầu/chân trang
  check(stats[0].headerText === '' && stats[0].footerText === '', '(c) bìa không có đầu/chân trang', `H=[${stats[0].headerText}] F=[${stats[0].footerText}]`);
  const missing = stats.slice(1).filter((s) => !s.headerText || !new RegExp(`Trang ${s.page} / ${total}\\b`).test(s.footerText));
  check(missing.length === 0, `(c) trang 2–${total} có đầu trang và "Trang i / ${total}" đúng`, missing.slice(0, 3).map((s) => `p${s.page}`).join(', '));

  // (d) tổng số trang trên bìa
  const cover = (await readPageText(pdfBuffer, 1)).replace(/\s+/g, '');
  check(cover.includes(`of${total}`) || cover.includes(`of${total}.`), `(d) bìa in "Page: 1 of ${total}"`);

  // (b) Mục lục
  const printed = await readTocPageNumbers(pdfBuffer, present);
  const wrongToc = present.filter((h) => printed[h.key] !== located.pages[h.key]);
  check(wrongToc.length === 0, '(b) Mục lục khớp trang thật', wrongToc.map((h) => `${h.key}: in ${printed[h.key]}, thật ${located.pages[h.key]}`).join('; '));

  // (a) không còn trang gần trống giữa Mục I và Mục IX
  if (absentVariant) {
    console.log('  ℹ️  hồ sơ biến thể (vắng chủ/không đủ Mục I–IX): bỏ qua kiểm (a)');
  } else {
    const first = located.pages[BODY_FIRST_KEY];
    const last = located.pages[BODY_LAST_KEY];
    const lastIxPage = stats.slice(last - 1).findIndex((s, i) => i > 0 && /^(X|XI)\./.test(s.firstLine));
    const ixEnd = lastIxPage > 0 ? last - 1 + lastIxPage : last;
    const sparse = stats.filter((s) => s.page >= first && s.page < ixEnd && s.fillPct < MIN_BODY_FILL_PCT);
    check(sparse.length === 0, `(a) trang ${first}–${ixEnd - 1} (Mục I–IX) đều lấp ≥ ${MIN_BODY_FILL_PCT}%`, sparse.map((s) => `p${s.page}=${s.fillPct}%`).join(', '));
  }
}

async function main(): Promise<void> {
  const ids = process.argv.slice(2).length > 0 ? process.argv.slice(2) : await pickReportIds();
  if (ids.length === 0) {
    console.error('Không có hồ sơ để kiểm thử.');
    process.exit(1);
  }
  for (const id of ids) {
    try {
      await testReport(id);
    } catch (err: unknown) {
      failures += 1;
      console.error(`  ❌ ${id}: lỗi khi xuất/đo PDF`, err);
    }
  }
  await PdfRenderEngine.closeBrowser();
  console.log(failures === 0 ? '\n✅ TẤT CẢ ĐẠT' : `\n❌ ${failures} ca lỗi`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
