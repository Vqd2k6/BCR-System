import { ResidentialReportGenerator } from '../src/modules/report/generators/residential.generator';

console.log('🧪 [DEBUG/QA AGENT] Đang kiểm tra biên dịch và render Handlebars PDF Template...');

try {
  // Mock dữ liệu kiểm thử
  const mockViewModel: any = {
    docCode: 'BCS-P1-CRLG-001',
    surveyDate: '03/10/2026',
    surveyCaseType: 'NORMAL',
    parcelCode: 'C&C-05-B-0048',
    stationName: 'GA TAO ĐÀN (S5)',
    p01: {
      photoId: 'P01-TEST',
      photoType: 'P01_HOUSE_NUMBER',
      url: 'https://cdn.metro2-survey.vn/surveys/p01_sample.jpg',
      capturedAt: '03/10/2026 09:15:00',
      gpsLat: 10.776889,
      gpsLng: 106.690833,
    },
    p02: {
      photoId: 'P02-TEST',
      photoType: 'P02_MAIN_FACADE',
      url: 'https://cdn.metro2-survey.vn/surveys/p02_sample.jpg',
      capturedAt: '03/10/2026 09:16:30',
      gpsLat: 10.776889,
      gpsLng: 106.690833,
    },
    p03: {
      photoId: 'P03-TEST',
      photoType: 'P03_SIDE_OR_REAR',
      url: 'https://cdn.metro2-survey.vn/surveys/p03_sample.jpg',
      capturedAt: '03/10/2026 09:18:00',
      gpsLat: 10.776889,
      gpsLng: 106.690833,
    },
    p04: {
      photoId: 'P04-TEST',
      photoType: 'P04_CONTEXT_STREET',
      url: 'https://cdn.metro2-survey.vn/surveys/p04_sample.jpg',
      capturedAt: '03/10/2026 09:20:00',
      gpsLat: 10.776889,
      gpsLng: 106.690833,
    },
    floors: [
      {
        floorName: 'TẦNG TRỆT',
        floorCode: 'FL-00',
        zones: [
          {
            zoneCode: 'Z-01',
            roomName: 'Phòng khách',
            componentType: 'Tường gạch',
            defects: [
              {
                defectCode: 'D-01',
                defectType: 'Vết nứt xiên 45 độ',
                widthMaxMm: '0.25',
                lengthMm: '450',
                crackDirection: 'Xiên',
                activityStateLabel: 'Đang phát triển',
                structuralSignificanceLabel: 'Cần quan trắc',
                ctxPhotoUrl: 'https://cdn.metro2-survey.vn/surveys/d01_ctx.jpg',
                cuPhotos: ['https://cdn.metro2-survey.vn/surveys/d01_cu1.jpg'],
              },
            ],
          },
        ],
      },
    ],
  };

  const html = ResidentialReportGenerator.generateHtml(mockViewModel);

  // Kiểm tra các class watermark đã được in vào HTML kết quả
  const hasOverlay = html.includes('pdf-watermark-overlay');
  const hasBadgeTr = html.includes('pdf-watermark-top-right');
  const hasBadgeBr = html.includes('pdf-watermark-bottom-right');
  const hasP01Tag = html.includes('CRLG-CRSRI-TT &bull; METRO LINE 2');
  const hasDefectOverlay = html.includes('CRLG-CRSRI-TT &bull; CRACK GAUGE');

  console.log(`- Có class pdf-watermark-overlay: ${hasOverlay ? '✅ ĐẠT' : '❌ LỖI'}`);
  console.log(`- Có class pdf-watermark-top-right: ${hasBadgeTr ? '✅ ĐẠT' : '❌ LỖI'}`);
  console.log(`- Có class pdf-watermark-bottom-right: ${hasBadgeBr ? '✅ ĐẠT' : '❌ LỖI'}`);
  console.log(`- Có watermark định danh ảnh P-01: ${hasP01Tag ? '✅ ĐẠT' : '❌ LỖI'}`);
  console.log(`- Có watermark thước đo nứt khuyết tật: ${hasDefectOverlay ? '✅ ĐẠT' : '❌ LỖI'}`);

  if (hasOverlay && hasBadgeTr && hasBadgeBr && hasP01Tag && hasDefectOverlay) {
    console.log('🎉 [DEBUG/QA AGENT] TẤT CẢ KIỂM THỬ TEMPLATE PDF WATERMARK ĐỀU ĐẠT CHUẨN 100%!');
    process.exit(0);
  } else {
    console.error('❌ [DEBUG/QA AGENT] Một số kiểm thử watermark không đạt!');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Lỗi khi render template Handlebars:', error);
  process.exit(1);
}
