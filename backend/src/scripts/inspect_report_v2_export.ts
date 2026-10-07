import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import { ReportV2ViewModelMapper } from '../modules/report_v2/mappers/report-v2-viewmodel.mapper';
import { PdfRenderV2Engine } from '../modules/report_v2/engine/pdf-render-v2.engine';

async function generateSampleAndScreenshots() {
  console.log('🚀 Đang khởi chạy quy trình xuất mẫu báo cáo và chụp ảnh kiểm thử...');

  const templatePath = path.join(__dirname, '../modules/report_v2/templates/residential/index.hbs');
  const stylesPath = path.join(__dirname, '../modules/report_v2/templates/residential/styles.css');

  const templateSource = fs.readFileSync(templatePath, 'utf8');
  const stylesSource = fs.readFileSync(stylesPath, 'utf8');

  Handlebars.registerHelper('eq', (a, b) => a === b);

  // Dữ liệu mẫu thực tế đầy đủ chi tiết của 1 nhà dân cư độc lập (Standalone Residential Building)
  const fullMockData = {
    project_parcel_code: 'C&C-01-B-01064',
    official_cadastral_code: '271330130431',
    owner_name: 'Nguyễn Văn An & Trần Thị Mai',
    house_number: '124/8',
    street: 'Cách Mạng Tháng Tám',
    ward: 'Phường 10',
    district: 'Quận 3',
    zone_id: 'ZONE_09',
    survey_date: '26/09/2026 (10:20)',
    surveyor_name: 'Nguyễn Trọng Tuấn',
    zone_admin_name: 'Lê Văn Kiểm',
    super_admin_name: 'Trần Đình Duyệt',
    building_specs: {
      structure_system: 'Khung bê tông cốt thép toàn khối (RC Frame), tường gạch bao che dày 200mm, ngăn phòng 100mm',
      foundation_type: 'Móng băng BTCT trên nền cọc tràm gia cố',
      above_floors: 3,
      underground_floors: 0,
      construction_year: 2012,
      construction_area_m2: 185.6,
      building_height_m: 11.8,
    },
    survey_data_json: {
      chainage: 'Km 6+420.50',
      metroOffsetDistance: '28.5m',
      buildingSpecs: {
        currentUsage: 'Nhà ở kết hợp kinh doanh tầng trệt',
        facadeOrientation: 'Hướng Đông Nam',
        adjacentLeft: 'Nhà phố 4 tầng kết cấu BTCT kiên cố (xây dựng năm 2018), khe lún 20mm',
        adjacentRight: 'Nhà cấp 4 tường gạch mái tôn (xây dựng năm 1995), sát vách',
        adjacentRear: 'Đất trống quy hoạch hẻm nội bộ',
      },
      settlementTilt: {
        settlementObservation: 'Không ghi nhận hiện tượng lún lệch bất thường ở chân tường và móng tiếp giáp',
        maxTiltAngle: '0.12° (Trong ngưỡng cho phép TCVN 9381:2012)',
        tiltDirection: 'Nghiêng nhẹ về phía Tây Nam (hướng ngõ)',
      },
      ecs: {
        ecsClass: 'MODERATE',
        predominantGrade: 1,
        localMaxGrade: 2,
        governingZone: 'Z-02',
      },
    },
  };

  const viewModel = ReportV2ViewModelMapper.buildViewModel(fullMockData);
  const compiled = Handlebars.compile(templateSource);
  const htmlOutput = compiled({
    ...viewModel,
    styles: stylesSource,
  });

  // 1. Xuất file PDF thực tế
  const pdfBuffer = await PdfRenderV2Engine.renderHtmlToPdf(htmlOutput, {
    buildingId: viewModel.metadata.buildingId,
    reportNo: viewModel.metadata.reportNo,
    headerTitle: 'LIÊN DANH CRLG–CRSRI–TT | DỰ ÁN METRO 2 BẾN THÀNH - THAM LƯƠNG',
  });

  const exportDir = '/Users/vqd2k6/.gemini/antigravity-ide/brain/e9fcce39-3111-4607-9a38-b82066dbf9d1/sample_export';
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const samplePdfPath = path.join(exportDir, 'BaoCao_Mau_0410_Export.pdf');
  fs.writeFileSync(samplePdfPath, pdfBuffer);
  console.log(`📄 Đã tạo file PDF mẫu tại: ${samplePdfPath} (${Math.round(pdfBuffer.length / 1024)} KB)`);

  // 2. Chụp ảnh từng phân đoạn chính của báo cáo bằng Chromium
  console.log('📸 Bắt đầu chụp ảnh các phần báo cáo để thẩm định layout...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 1414, deviceScaleFactor: 2 });

    // Lưu file HTML tạm thời để nạp
    const tmpHtmlPath = path.join(exportDir, 'preview_sample.html');
    fs.writeFileSync(tmpHtmlPath, htmlOutput, 'utf8');
    await page.goto(`file://${tmpHtmlPath}`, { waitUntil: 'networkidle0' });

    // 2.1 Chụp trang bìa (Cover Page)
    const coverElement = await page.$('.cover-page');
    if (coverElement) {
      const coverPath = path.join(exportDir, '01_cover_page.png');
      await coverElement.screenshot({ path: coverPath });
      console.log(`✅ Đã chụp: ${coverPath}`);
    }

    // 2.2 Chụp mục lục & trang ký xác nhận 3 bên
    const tocSignatures = await page.$('.doc-page:nth-of-type(2)');
    if (tocSignatures) {
      const tocPath = path.join(exportDir, '02_toc_and_signatures.png');
      await tocSignatures.screenshot({ path: tocPath });
      console.log(`✅ Đã chụp: ${tocPath}`);
    }

    // 2.3 Chụp Chương I đến Chương VII (Thông tin, quy mô, kết cấu)
    const ch1To7 = await page.$('.doc-page:nth-of-type(3)');
    if (ch1To7) {
      const ch1Path = path.join(exportDir, '03_chapters_general_and_specs.png');
      await ch1To7.screenshot({ path: ch1Path });
      console.log(`✅ Đã chụp: ${ch1Path}`);
    }

    // 2.4 Chụp Chương VIII & IX (Đánh giá khuyết tật Burland & Bảng điểm BRA 26 + A)
    const ch8And9 = await page.$('.doc-page:nth-of-type(4)');
    if (ch8And9) {
      const ch8Path = path.join(exportDir, '04_burland_and_bra_assessment.png');
      await ch8And9.screenshot({ path: ch8Path });
      console.log(`✅ Đã chụp: ${ch8Path}`);
    }

    // 2.5 Chụp Phụ lục 1 (Ảnh hiện trạng ngoại thất)
    const app1 = await page.$('.doc-page:nth-of-type(5)');
    if (app1) {
      const app1Path = path.join(exportDir, '05_appendix_1_exterior.png');
      await app1.screenshot({ path: app1Path });
      console.log(`✅ Đã chụp: ${app1Path}`);
    }

    // 2.6 Chụp Phụ lục 2 (Ảnh khuyết tật ghép đôi Toàn cảnh + Cận cảnh kèm thước nứt)
    const app2 = await page.$('.doc-page:nth-of-type(6)');
    if (app2) {
      const app2Path = path.join(exportDir, '06_appendix_2_defects_pairs.png');
      await app2.screenshot({ path: app2Path });
      console.log(`✅ Đã chụp: ${app2Path}`);
    }

    console.log('🎉 Đã xuất thành công toàn bộ ảnh kiểm thử layout!');
  } finally {
    await browser.close();
  }
}

generateSampleAndScreenshots().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
