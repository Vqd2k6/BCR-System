/**
 * NGHIỆM THU PDF THẬT (Bước 0): render qua ReportV3Service.renderDraftPdf (có header/footer, TOC 2-pass)
 * rồi kiểm tra nội dung từng trang bằng pdfjs.
 * Dùng: npx ts-node src/scripts/test_report_pdf_acceptance.ts <reportId|parcelCode> [...]
 */
import { pool } from '../database/db';
import { ReportV3Service } from '../modules/report_v3/report-v3.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

const squeeze = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const FORBIDDEN = [
  'blob:',
  'localhost',
  '[[',
  'undefined',
  'NaN',
  '[ Đã ký',
  'zoneAdminTest',
  '(cần kiểm tra)',
  'CẢNH BÁO HIỆN TRƯỜNG',
  'lưu tại hồ sơ phòng thí nghiệm',
];

async function pageTexts(buf: Buffer): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, disableFontFace: true, verbosity: 0 }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((it: any) => it.str).join(' '));
  }
  return out;
}

async function main() {
  let failures = 0;
  const check = (ok: boolean, msg: string) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
    if (!ok) failures++;
  };

  for (const id of process.argv.slice(2)) {
    const resolved = await ReportV3Service.resolve(id);
    const { pdfBuffer, buildingId } = await ReportV3Service.renderDraftPdf(resolved, undefined, true);
    const texts = await pageTexts(pdfBuffer);
    const sq = texts.map(squeeze);
    console.log(`\n=== ${buildingId}: ${texts.length} trang ===`);

    // 1. Header/footer trên mọi trang: "Trang N / total"
    const total = texts.length;
    const allFooter = sq.every((t, i) => t.includes(squeeze(`Trang ${i + 1} / ${total}`)));
    check(allFooter, `Footer "Trang N / ${total}" có trên mọi trang`);
    check(sq.every((t) => t.includes(squeeze('LIÊN DANH CRLG'))), 'Header liên danh có trên mọi trang');

    // 2. Chuỗi cấm
    for (const f of FORBIDDEN) {
      const hit = texts.findIndex((t) => t.includes(f));
      check(hit < 0, `Không chứa "${f}"${hit >= 0 ? ` (trang ${hit + 1})` : ''}`);
    }

    // 3. Phụ lục 1 phải có khuyết tật khi DB có khuyết tật
    const raw: any = resolved.raw;
    const defectCount = JSON.stringify(raw).match(/"defect_type"/g)?.length ?? 0;
    const tocIdx = sq.findIndex((t) => t.includes('tableofcontents'));
    const pl1Start = sq.findIndex((t, i) => i > tocIdx && t.includes(squeeze('PHỤ LỤC 1: HỒ SƠ KHUYẾT TẬT')) );
    if (pl1Start >= 0 && defectCount === 0) {
      check(sq[pl1Start].includes(squeeze('không phát hiện')), 'Phụ lục 1 nêu rõ "không phát hiện vết nứt" khi DB không có khuyết tật');
    } else if (pl1Start >= 0) {
      const pl1Pages = sq.filter((t) => t.includes(squeeze('Bảng tổng hợp khuyết tật tầng')) || t.includes('d01') || t.includes('d02'));
      check(pl1Pages.length > 0, `Phụ lục 1 có bảng khuyết tật (DB ~${defectCount} bản ghi defect_type)`);
    } else {
      check(defectCount === 0, `Không có Phụ lục 1 và DB không có khuyết tật (defect_type=${defectCount})`);
    }

    // 4. Mục lục khớp trang thật: số trang cuối mỗi dòng TOC của Phụ lục 1/2/3
    const tocPage = sq.findIndex((t) => t.includes('tableofcontents'));
    const tocText = texts[tocPage] || '';
    const pl3 = sq.findIndex((t, i) => i > tocPage && t.includes(squeeze('PHỤ LỤC 3: THIẾT BỊ')));
    check(pl3 >= 0 && tocText.replace(/\s+/g, ' ').includes(` ${pl3 + 1} `), `Mục lục ghi đúng trang Phụ lục 3 (thực tế trang ${pl3 + 1})`);

    // 5. Tổng số trang trên bìa khớp
    check(sq[0].includes(squeeze(`1 of ${total}`)), `Bìa ghi tổng số trang = ${total}`);
  }

  await pool.end();
  console.log(failures ? `\n${failures} kiểm tra THẤT BẠI` : '\nTất cả kiểm tra PASS');
  process.exit(failures ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
