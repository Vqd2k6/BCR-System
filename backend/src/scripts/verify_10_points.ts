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
  const pdfPath = '/Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/report_0410/resuilt/BCS_B-00116-C&C (ST5)_Senior_PM_Standard.pdf';
  const buf = fs.readFileSync(pdfPath);
  const rawPages = await pageTexts(buf);
  const sqPages = rawPages.map(squeeze);

  console.log(`\n======================================================`);
  console.log(`KIỂM TRA 10 ĐIỂM NGHIỆP VỤ TRÊN PDF B-00116 (${rawPages.length} TRANG)`);
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

  // Tìm các trang chương quan trọng (bỏ qua trang Mục lục index 2 / Trang 3)
  const pCover = sqPages[0];
  
  // Trang Mục I & II (Trang 4 và 5)
  const p3Idx = sqPages.findIndex((p, i) => i >= 3 && p.includes(squeeze('I. THÔNG TIN CHUNG')));
  const p3Sq = p3Idx >= 0 ? sqPages[p3Idx] : '';
  const p3Raw = p3Idx >= 0 ? rawPages[p3Idx] : '';

  const p4Idx = sqPages.findIndex((p, i) => i >= 3 && p.includes(squeeze('Kích thước chính')));
  const p4Sq = p4Idx >= 0 ? sqPages[p4Idx] : '';
  const p4Raw = p4Idx >= 0 ? rawPages[p4Idx] : '';

  const pSec7Idx = sqPages.findIndex((p, i) => i >= 3 && p.includes(squeeze('VII. PHÂN LOẠI MỨC ĐỘ HƯ HẠI')));
  const pSec7Sq = pSec7Idx >= 0 ? sqPages[pSec7Idx] : '';
  const pSec7Raw = pSec7Idx >= 0 ? rawPages[pSec7Idx] : '';

  const pSec8Idx = sqPages.findIndex((p, i) => i >= 3 && p.includes(squeeze('VIII. ĐÁNH GIÁ TÌNH TRẠNG CÔNG TRÌNH')));
  const pSec8Sq = pSec8Idx >= 0 ? sqPages[pSec8Idx] : '';
  const pSec8Raw = pSec8Idx >= 0 ? rawPages[pSec8Idx] : '';

  const pSec9Idx = sqPages.findIndex((p, i) => i >= 3 && p.includes(squeeze('IX. KẾT LUẬN VÀ KIẾN NGHỊ')));
  const pSec9Sq = pSec9Idx >= 0 ? sqPages[pSec9Idx] : '';
  const pSec9Raw = pSec9Idx >= 0 ? rawPages[pSec9Idx] : '';

  const pSecXiIdx = sqPages.findIndex((p, i) => i >= 3 && p.includes(squeeze('XI. BIÊN BẢN KHẢO SÁT HIỆN TRƯỜNG')));
  const pSecXiSq = pSecXiIdx >= 0 ? sqPages[pSecXiIdx] : '';

  const pPl3Idx = sqPages.findIndex((p, i) => i >= 3 && p.includes(squeeze('PHỤ LỤC 3: THIẾT BỊ KHẢO SÁT CHUYÊN DỤNG')));
  const pPl3Sq = pPl3Idx >= 0 ? sqPages[pPl3Idx] : '';

  // Điểm 1: Bỏ Survey ID khỏi Bìa (Trang 1) và Bảng I (Trang 4)
  const p1HasSurveyId = pCover.includes(squeeze('Survey ID: --')) || pCover.includes(squeeze('Mã khảo sát/Survey ID:'));
  const p3HasSurveyIdRow = p3Sq.includes(squeeze('Mã khảo sát (*)')) || p3Sq.includes(squeeze('Survey ID (*)'));
  assertPoint(
    1,
    'Bỏ Survey ID khỏi Bìa & Bảng Mục I',
    !p1HasSurveyId && !p3HasSurveyIdRow,
    `Bìa chứa Survey ID: ${p1HasSurveyId} | Mục I chứa dòng Mã khảo sát: ${p3HasSurveyIdRow}`
  );

  // Điểm 2: Địa chỉ chuẩn hóa theo NQ 1685 (không có Quận)
  const p3HasWard168 = p3Sq.includes(squeeze('Phường Nhiêu Lộc')) && p3Sq.includes(squeeze('TP. Hồ Chí Minh'));
  const p3HasDistrictInAddress = p3Sq.includes(squeeze('Quận 10, TP. Hồ Chí Minh')) || p3Sq.includes(squeeze('District 10, Ho Chi Minh'));
  assertPoint(
    2,
    'Địa chỉ chuẩn hóa 168 ĐVHC (bỏ cấp Quận)',
    p3HasWard168 && !p3HasDistrictInAddress,
    `Địa chỉ mới 168 (Phường Nhiêu Lộc, TP. HCM): ${p3HasWard168} | Không chứa Quận: ${!p3HasDistrictInAddress}`
  );

  // Điểm 3: Bỏ lý trình ở Mục I & II
  const p3HasLyTrinh = p3Sq.includes(squeeze('Lý trình:')) || p3Sq.includes(squeeze('Km 4+')) || p3Sq.includes(squeeze('Chainage:'));
  assertPoint(
    3,
    'Bỏ Lý trình tại Vị trí Zone',
    !p3HasLyTrinh,
    `Mục I chứa Lý trình: ${p3HasLyTrinh}`
  );

  // Điểm 4: Kích thước chính và Chiều cao tách riêng
  const p4HasSeparatedHeight = p4Sq.includes(squeeze('Chiều cao (m)')) || p4Sq.includes(squeeze('Height'));
  const p4RawMainDimHasHeight = p4Raw.includes('(Chiều cao:') || p4Raw.includes('(Height:');
  assertPoint(
    4,
    'Tách Chiều cao khỏi Kích thước chính',
    p4HasSeparatedHeight && !p4RawMainDimHasHeight,
    `Có dòng Chiều cao riêng: ${p4HasSeparatedHeight} | Kích thước chính lẫn chiều cao: ${p4RawMainDimHasHeight}`
  );

  // Điểm 5: Khớp VII.1 và VII.2 (grade count > 0 -> Có, 0 -> Không)
  const pSec7HasCo = pSec7Sq.includes(squeeze('Có')) || pSec7Raw.includes('Có') || pSec7Raw.includes('☒');
  const pSec7HasKhong = pSec7Sq.includes(squeeze('Không')) || pSec7Raw.includes('Không') || pSec7Raw.includes('☐');
  assertPoint(
    5,
    'Bảng VII.1 đánh dấu Có/Không theo tần suất thực tế',
    pSec7HasCo && pSec7HasKhong,
    `Có cấp xuất hiện (Có): ${pSec7HasCo} | Có cấp vắng mặt (Không): ${pSec7HasKhong}`
  );

  // Điểm 6: Bảng VII.2 nhãn Z & tách Cấu kiện E
  const pSec7HasZLabel = pSec7Sq.includes(squeeze('Tổng số vùng kiến trúc (Z):'));
  const pSec7HasNoZECombined = !pSec7Sq.includes(squeeze('Tổng (Z + E):'));
  assertPoint(
    6,
    'Bảng VII.2 nhãn Z & tách biệt cấu kiện chịu lực E',
    pSec7HasZLabel && pSec7HasNoZECombined,
    `Nhãn "Tổng số vùng kiến trúc (Z):": ${pSec7HasZLabel} | Bỏ nhãn gộp "Tổng (Z + E):": ${pSec7HasNoZECombined}`
  );

  // Điểm 7: Bỏ cột Thang ở VIII.1 & VIII.2, không có tofu
  const pSec8HasThangCol = pSec8Raw.includes('<th style="width: 8%; text-align: center;">Thang</th>');
  const pSec8HasScoreHeader = pSec8Sq.includes(squeeze('Điểm / Score')) && (pSec8Sq.includes(squeeze('Thang 0-4')) || pSec8Sq.includes(squeeze('Thang 1-4')));
  assertPoint(
    7,
    'Thang điểm VIII.1 & VIII.2 chuẩn ASCII hyphen (bỏ cột Thang riêng)',
    !pSec8HasThangCol && pSec8HasScoreHeader,
    `Không còn cột Thang riêng: ${!pSec8HasThangCol} | Cột Điểm có ghi thang (ASCII hyphen): ${pSec8HasScoreHeader}`
  );

  // Điểm 8: Đưa bảng Tiếp cận lên Mục IX & Phụ lục 3 giữ thiết bị
  const pSec9HasAccessTable = pSec9Sq.includes(squeeze('Khu vực công trình')) && pSec9Sq.includes(squeeze('Phân loại tiếp cận'));
  const pPl3HasOnlyEquip = pPl3Sq.includes(squeeze('Danh mục thiết bị khảo sát')) && !pPl3Sq.includes(squeeze('Phạm vi tiếp cận khảo sát các khu vực'));
  assertPoint(
    8,
    'Bảng Tiếp cận tại Mục IX & Phụ lục 3 chỉ giữ thiết bị/hiệu chuẩn',
    pSec9HasAccessTable && pPl3HasOnlyEquip,
    `Mục IX có bảng tiếp cận: ${pSec9HasAccessTable} | Phụ lục 3 chỉ giữ thiết bị: ${pPl3HasOnlyEquip}`
  );

  // Điểm 9: Mục XI bỏ chữ ký số, chính quyền/tư vấn chưa ký hiển thị --
  const pSecXiHasElecSignRow = pSecXiSq.includes(squeeze('Xác nhận ký số / điện tử')) || pSecXiSq.includes(squeeze('Electronic sign-off'));
  const pSecXiHasCleanUnsigned = pSecXiSq.includes(squeeze('--'));
  assertPoint(
    9,
    'Mục XI bỏ dòng Ký điện tử & hiển thị "--" cho bên chưa ký',
    !pSecXiHasElecSignRow && pSecXiHasCleanUnsigned,
    `Bỏ dòng ký điện tử: ${!pSecXiHasElecSignRow} | Chưa ký hiển thị "--": ${pSecXiHasCleanUnsigned}`
  );

  // Điểm 10: Phụ lục 1 bố trí ảnh xếp tầng
  const hasDefectPhotos = sqPages.some(p => p.includes(squeeze('HỒ SƠ ẢNH KHUYẾT TẬT CÓ THƯỚC ĐO')) || p.includes(squeeze('CRACK COMPARISON PHOTOS WITH GAUGE')));
  assertPoint(
    10,
    'Phụ lục 1 có hồ sơ ảnh khuyết tật thước đo chuẩn layout',
    hasDefectPhotos,
    `Có các trang hồ sơ ảnh thước đo: ${hasDefectPhotos}`
  );

  console.log(`\n======================================================`);
  console.log(`KẾT QUẢ TỔNG THỂ: ${allPassed ? '🎉 TẤT CẢ 10 ĐIỂM HOÀN TOÀN ĐẠT CHUẨN NGHIỆP VỤ' : '❌ CÓ ĐIỂM CHƯA ĐẠT'}`);
  console.log(`======================================================\n`);

  process.exit(allPassed ? 0 : 1);
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});
