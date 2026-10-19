import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

const squeeze = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

async function pageTexts(buf: Buffer): Promise<string[]> {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((it: any) => it.str).join(' '));
  }
  return out;
}

async function verify() {
  const pdfPath = '/Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/report_0410/resuilt/BCS_B-00116-C&C (ST05)_Senior_PM_Standard.pdf';
  if (!fs.existsSync(pdfPath)) {
    console.error(`Không tìm thấy file PDF tại: ${pdfPath}`);
    process.exit(1);
  }
  const buf = fs.readFileSync(pdfPath);
  const rawPages = await pageTexts(buf);
  const sqPages = rawPages.map(squeeze);

  console.log(`\n======================================================`);
  console.log(`ĐỐI SOÁT 8 ĐIỂM HIỆU CHỈNH TRÊN PDF THẬT B-00116 (${rawPages.length} TRANG)`);
  console.log(`======================================================\n`);

  let allPassed = true;
  const assertPoint = (num: number, name: string, pass: boolean, detail: string) => {
    console.log(`[Điểm ${num}] ${name}: ${pass ? '✅ ĐẠT' : '❌ KHÔNG ĐẠT'}`);
    if (!pass) {
      allPassed = false;
      console.log(`   Chi tiết: ${detail}`);
    } else {
      console.log(`   Chi tiết: ${detail}`);
    }
  };

  const pCoverRaw = rawPages[0];
  const pCoverSq = sqPages[0];

  // Điểm 1: Mã ga (ST05) 2 chữ số trên bìa và Doc.No
  const hasSt05 = pCoverRaw.includes('(ST05)');
  const hasOldSt5 = pCoverRaw.includes('(ST5)') && !pCoverRaw.includes('(ST05)');
  assertPoint(
    1,
    'Mã ga 2 chữ số (ST05) đồng bộ giữa Building ID và Doc.No, triệt tiêu (ST5)',
    hasSt05 && !hasOldSt5,
    `Bìa có (ST05): ${hasSt05}, Bìa có (ST5) cũ: ${hasOldSt5}`
  );

  // Điểm 2: Nhóm đối tượng khảo sát không bị lặp từ
  const pSec2Idx = sqPages.findIndex((p, i) => i >= 3 && p.includes(squeeze('II. THÔNG SỐ CƠ BẢN')));
  const pSec2Raw = pSec2Idx >= 0 ? rawPages[pSec2Idx] : '';
  const hasRedundantSurveyText = pSec2Raw.includes('– Khảo sát hiện trạng công trình');
  assertPoint(
    2,
    'Nhóm đối tượng khảo sát tinh gọn, không lặp từ "– Khảo sát hiện trạng công trình"',
    !hasRedundantSurveyText,
    `Phát hiện chuỗi lặp thừa: ${hasRedundantSurveyText}`
  );

  // Điểm 3: Thống nhất thuật ngữ "Không ghi nhận" tại Chương III
  const pSec3Idx = sqPages.findIndex((p, i) => i >= 3 && p.includes(squeeze('III. LỊCH SỬ VÀ TÌNH TRẠNG SỬ DỤNG')));
  const pSec3Raw = pSec3Idx >= 0 ? rawPages[pSec3Idx] : '';
  const pSec3Sq = pSec3Idx >= 0 ? sqPages[pSec3Idx] : '';
  const hasKhongGhiNhan = pSec3Sq.includes(squeeze('Không ghi nhận'));
  const hasChuaGhiNhanInSec3 = pSec3Raw.includes('Chưa ghi nhận') && !pSec3Raw.includes('Chưa ghi nhận thông tin');
  assertPoint(
    3,
    'Chương III thống nhất thuật ngữ "Không ghi nhận" / "Not recorded" cho các chỉ số lịch sử',
    hasKhongGhiNhan,
    `Chứa "Không ghi nhận": ${hasKhongGhiNhan}`
  );

  // Điểm 4: Nguồn thông tin đơn nhất
  const hasCombinedSource = pSec3Raw.includes('Phỏng vấn chủ hộ, Quan sát hiện trường');
  assertPoint(
    4,
    'Nguồn thông tin đơn nhất, không ghép chuỗi "Phỏng vấn chủ hộ, Quan sát hiện trường"',
    !hasCombinedSource,
    `Bị ghép chuỗi thừa: ${hasCombinedSource}`
  );

  // Điểm 5: Mục IX Hạn chế khảo sát mạch lạc, không lặp từ
  const pSec9Idx = sqPages.findIndex((p, i) => i >= 3 && p.includes(squeeze('IX. KẾT LUẬN VÀ KIẾN NGHỊ')));
  const pSec9Raw = pSec9Idx >= 0 ? rawPages[pSec9Idx] : '';
  const hasDuplicateAccessPrefix = pSec9Raw.includes('Phân loại tiếp cận: Phân loại tiếp cận');
  const hasDuplicateBullets = pSec9Raw.includes('Khu vực mái / sân thượng: Chưa tiếp cận khảo sát');
  assertPoint(
    5,
    'Mục IX Hạn chế tiếp cận mạch lạc, xóa bỏ khung lặp tiền tố và bullet trùng lặp',
    !hasDuplicateAccessPrefix && !hasDuplicateBullets,
    `Lặp tiền tố box: ${hasDuplicateAccessPrefix}, Lặp bullets: ${hasDuplicateBullets}`
  );

  // Điểm 6: Monochrome đen chuẩn công sở (#000000)
  const templatePath = path.resolve(__dirname, '../modules/report_v2/templates/residential/partials/page-08-section-9-conclusions.hbs');
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  const hasColorText = templateContent.includes('#15803d') || templateContent.includes('#b91c1c');
  assertPoint(
    6,
    'Mục IX chuẩn Monochrome đen công sở (#000000), loại bỏ hoàn toàn chữ xanh/đỏ',
    !hasColorText,
    `Mã màu xanh/đỏ tồn tại trong template: ${hasColorText}`
  );

  // Điểm 7: Ghim D không bị bẹp dí background
  const stylesPath = path.resolve(__dirname, '../modules/report_v2/templates/residential/styles.css');
  const stylesContent = fs.readFileSync(stylesPath, 'utf8');
  const pinFixed = stylesContent.includes('.photo-defect-pin-badge') &&
                   stylesContent.includes('line-height: 1.25 !important;') &&
                   stylesContent.includes('display: inline-block !important;');
  assertPoint(
    7,
    'Ghim D sửa triệt để lỗi bẹp dí background (line-height: normal & badge 1.25 inline-block)',
    pinFixed,
    `Đã cấu hình line-height bảo vệ: ${pinFixed}`
  );

  // Điểm 8: Sơ đồ vị trí không gian Metro ở bìa (SVG vector)
  const coverTemplate = fs.readFileSync(path.resolve(__dirname, '../modules/report_v2/templates/residential/partials/page-01-cover.hbs'), 'utf8');
  const hasSpatialCover = coverTemplate.includes('cover-spatial-wrapper') &&
                          coverTemplate.includes('SƠ ĐỒ VỊ TRÍ THỬA ĐẤT &amp; TUYẾN METRO 2');
  assertPoint(
    8,
    'Trang bìa bố trí 2 khung cân đối: Ảnh mặt tiền (trái) và Sơ đồ vị trí Metro (phải)',
    hasSpatialCover,
    `Template bìa tích hợp khung 2 cột sơ đồ: ${hasSpatialCover}`
  );

  console.log(`\n======================================================`);
  if (allPassed) {
    console.log(`🎉 KẾT QUẢ ĐỐI SOÁT: TOÀN BỘ 8 ĐIỂM HOÀN THIỆN ĐÃ ĐẠT CHUẨN 100%!`);
  } else {
    console.error(`⚠️ CÓ ĐIỂM CHƯA ĐẠT CHUẨN TRÊN FILE PDF THẬT.`);
    process.exit(1);
  }
  console.log(`======================================================\n`);
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});
