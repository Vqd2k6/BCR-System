import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { ReportV2Service } from '../modules/report_v2/report-v2.service';
import Handlebars from 'handlebars';
import { ReportV2ViewModelMapper } from '../modules/report_v2/mappers/report-v2-viewmodel.mapper';

async function exportAndCaptureScreenshots() {
  console.log('🚀 Khởi chạy quá trình xuất báo cáo V2 hiệu chỉnh và chụp ảnh kiểm thử trực quan...');

  const exportDir = '/Users/vqd2k6/.gemini/antigravity-ide/brain/e9fcce39-3111-4607-9a38-b82066dbf9d1/sample_export';
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  // 1. Tạo HTML và PDF từ dữ liệu thật trong DB (ID: 39fed16a-d786-4370-9277-9d8e2c6bd49c)
  console.log('📦 Đang truy vấn và biên dịch dữ liệu hồ sơ thực tế từ CSDL...');
  const testReportId = '39fed16a-d786-4370-9277-9d8e2c6bd49c';
  const { html, viewModel } = await ReportV2Service.generateResidentialHtml(testReportId);
  const { pdfBuffer } = await ReportV2Service.generateResidentialPdf(testReportId);

  const htmlOutputPath = path.join(exportDir, 'preview_calibrated.html');
  const pdfOutputPath = path.join(exportDir, 'preview_calibrated.pdf');

  fs.writeFileSync(htmlOutputPath, html, 'utf8');
  fs.writeFileSync(pdfOutputPath, pdfBuffer);

  console.log(`📄 Đã lưu HTML tại: ${htmlOutputPath} (${Math.round(html.length / 1024)} KB)`);
  console.log(`📄 Đã lưu PDF tại: ${pdfOutputPath} (${Math.round(pdfBuffer.length / 1024)} KB)`);

  // 2. Chụp ảnh các trang của hồ sơ thật bằng Puppeteer
  console.log('📸 Bắt đầu chụp ảnh kiểm tra trực quan các trang...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 1555, deviceScaleFactor: 2 });
    await page.goto(`file://${htmlOutputPath}`, { waitUntil: 'networkidle0' });

    // Lấy danh sách các trang .a4-page-sheet
    const pageSheets = await page.$$('.a4-page-sheet');
    console.log(`📊 Tổng số trang tài liệu phát hiện: ${pageSheets.length}`);

    // Trang 1: Trang bìa (Xác nhận bảng Header 3 cột có logo THACO REC)
    if (pageSheets[0]) {
      const p1Path = path.join(exportDir, '01_cover_page_header_thaco.png');
      await pageSheets[0].screenshot({ path: p1Path });
      console.log(`✅ Đã chụp Trang 1 (Bìa với Header 3 cột): ${p1Path}`);
    }

    // Trang 2: Mục lục & Chữ ký (Xác nhận KHÔNG còn bảng Header 3 cột, chỉ có subpage topbar)
    if (pageSheets[1]) {
      const p2Path = path.join(exportDir, '02_toc_no_bulky_header.png');
      await pageSheets[1].screenshot({ path: p2Path });
      console.log(`✅ Đã chụp Trang 2 (Mục lục không còn Header cồng kềnh): ${p2Path}`);
    }

    // Trang 3: Chương I (Thông tin chung)
    if (pageSheets[2]) {
      const p3Path = path.join(exportDir, '03_chapter1_general_info.png');
      await pageSheets[2].screenshot({ path: p3Path });
      console.log(`✅ Đã chụp Trang 3 (Chương I): ${p3Path}`);
    }

    // Trang Phụ lục 1: Mặt đứng ngoại thất
    if (pageSheets[8]) {
      const p8Path = path.join(exportDir, '04_appendix1_adaptive_exterior.png');
      await pageSheets[8].screenshot({ path: p8Path });
      console.log(`✅ Đã chụp Phụ lục 1 (Mặt đứng ngoại thất): ${p8Path}`);
    }

    // Trang Phụ lục 2: Mặt bằng khuyết tật & CAD
    if (pageSheets[9]) {
      const p9Path = path.join(exportDir, '05_appendix2_floor_defect_cad.png');
      await pageSheets[9].screenshot({ path: p9Path });
      console.log(`✅ Đã chụp Phụ lục 2 (Mặt bằng tầng & khuyết tật): ${p9Path}`);
    }

    // 3. Chụp kịch bản nhà ống giáp ranh (Party wall scenario) để kiểm tra banner party-wall
    console.log('📸 Đang tạo bản mẫu kịch bản Nhà ống giáp ranh (Party Wall) để kiểm tra trực quan...');
    const svgBase64 = (text: string, bg: string) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="${bg}"/><text x="300" y="200" fill="white" font-family="Arial" font-size="24" font-weight="bold" text-anchor="middle" dominant-baseline="central">${text}</text></svg>`;
      return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    };

    const partyWallMock = {
      project_parcel_code: 'C&C-05-B-0001',
      zone_id: 'ZONE_09',
      survey_date: '26/09/2026 (11:00)',
      surveyor_name: 'Nguyễn Trọng Tuấn',
      zone_admin_name: 'Lê Văn Kiểm',
      super_admin_name: 'Trần Đình Duyệt',
      survey_data_json: {
        photos: {
          p01: svgBase64('ẢNH P-01: BIỂN SỐ NHÀ', '#0284c7'),
          p02: svgBase64('ẢNH P-02: MẶT TIỀN CHÍNH', '#0f766e'),
          p04: svgBase64('ẢNH P-04: BỐI CẢNH ĐƯỜNG PHỐ', '#475569'),
        },
      },
    };

    const templatePath = path.join(__dirname, '../modules/report_v2/templates/residential/index.hbs');
    const stylesPath = path.join(__dirname, '../modules/report_v2/templates/residential/styles.css');
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const stylesSource = fs.readFileSync(stylesPath, 'utf8');
    Handlebars.registerHelper('eq', (a, b) => a === b);

    const partyWallVm = ReportV2ViewModelMapper.buildViewModel(partyWallMock);
    const compiled = Handlebars.compile(templateSource);
    const partyWallHtml = compiled({ ...partyWallVm, styles: stylesSource });

    const partyWallTmpPath = path.join(exportDir, 'tmp_party_wall.html');
    fs.writeFileSync(partyWallTmpPath, partyWallHtml, 'utf8');

    await page.goto(`file://${partyWallTmpPath}`, { waitUntil: 'networkidle0' });
    const pwSheets = await page.$$('.a4-page-sheet');
    if (pwSheets[8]) {
      const pwPath = path.join(exportDir, '06_appendix1_party_wall_notice.png');
      await pwSheets[8].screenshot({ path: pwPath });
      console.log(`✅ Đã chụp Phụ lục 1 (Bố cục Nhà giáp ranh có thông báo kỹ thuật): ${pwPath}`);
    }

    if (fs.existsSync(partyWallTmpPath)) {
      fs.unlinkSync(partyWallTmpPath);
    }

    // 4. Chụp kịch bản Kết cấu nguyên vẹn (Zero Defects) để kiểm tra banner xanh
    console.log('📸 Đang tạo bản mẫu kịch bản Kết cấu nguyên vẹn (Zero Defects)...');
    const zeroDefectsMock = {
      project_parcel_code: 'C&C-05-B-0002',
      zone_id: 'ZONE_09',
      survey_date: '26/09/2026 (12:00)',
      surveyor_name: 'Nguyễn Trọng Tuấn',
      zone_admin_name: 'Lê Văn Kiểm',
      super_admin_name: 'Trần Đình Duyệt',
      survey_data_json: {
        floors: [
          {
            floorId: 'FLOOR_01',
            floorName: 'Tầng 1 (Tầng Trệt)',
            damageMapUrl: svgBase64('SƠ ĐỒ CAD MẶT BẰNG KIẾN TRÚC TẦNG TRỆT', '#334155'),
            defects: [],
          },
        ],
      },
    };

    const zeroDefectsVm = ReportV2ViewModelMapper.buildViewModel(zeroDefectsMock);
    const zeroDefectsHtml = compiled({ ...zeroDefectsVm, styles: stylesSource });
    const zeroDefectsTmpPath = path.join(exportDir, 'tmp_zero_defects.html');
    fs.writeFileSync(zeroDefectsTmpPath, zeroDefectsHtml, 'utf8');

    await page.goto(`file://${zeroDefectsTmpPath}`, { waitUntil: 'networkidle0' });
    const zdSheets = await page.$$('.a4-page-sheet');
    if (zdSheets[9]) {
      const zdPath = path.join(exportDir, '07_appendix2_zero_defects.png');
      await zdSheets[9].screenshot({ path: zdPath });
      console.log(`✅ Đã chụp Phụ lục 2 (Kết cấu nguyên vẹn với banner xanh): ${zdPath}`);
    }

    if (fs.existsSync(zeroDefectsTmpPath)) {
      fs.unlinkSync(zeroDefectsTmpPath);
    }

    console.log('🎉 ĐÃ HOÀN TẤT TOÀN BỘ CÔNG TÁC XUẤT MẪU VÀ CHỤP ẢNH XÁC THỰC!');
  } finally {
    await browser.close();
  }

  process.exit(0);
}

exportAndCaptureScreenshots().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
