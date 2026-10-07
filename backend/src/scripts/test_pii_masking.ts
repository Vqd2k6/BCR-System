/**
 * Test Suite: Xác thực cơ chế che mờ PII (Nghị định 13/2023/NĐ-CP) cho vai trò GUEST
 */
import { maskReportPii, maskName, maskPii } from '../common/utils/pii.utils';
import { ReportV2ViewModelMapper } from '../modules/report_v2/mappers/report-v2-viewmodel.mapper';
import { ReportV2Service } from '../modules/report_v2/report-v2.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runPiiTests() {
  console.log('🔒 Bắt đầu kiểm thử che mờ PII cho vai trò GUEST...');

  // 1. Kiểm thử Unit maskName và maskPii
  const name1 = maskName('Nguyễn Văn An');
  assert(name1 === 'Nguyễn V*** An', `maskName('Nguyễn Văn An') phải là 'Nguyễn V*** An', nhận được: ${name1}`);

  const phone1 = maskPii('0909123456', 3, 3);
  assert(phone1 === '090****456', `maskPii('0909123456') phải là '090****456', nhận được: ${phone1}`);

  const cccd1 = maskPii('079090123456', 3, 0);
  assert(Boolean(cccd1?.startsWith('079*********')), `maskPii CCCD phải ẩn đuôi: ${cccd1}`);

  // 2. Mock Báo cáo có đầy đủ PII chủ hộ
  const mockReportWithPii = {
    id: 'REP-TEST-001',
    project_parcel_code: 'C&C-01-B-01064',
    zone_id: 'ZONE_09',
    owner_name: 'Nguyễn Văn Hùng',
    owner_phone: '0912345678',
    owner_id_card: '079085001234',
    owner_signature_url: 'https://storage.metro2.vn/signatures/owner_sig.png',
    owner_signature_img: 'data:image/png;base64,mockSignatureData',
    survey_date: '26/09/2026',
    surveyor_name: 'KS. Trần Văn Nam',
    zone_admin_name: 'KS. Lê Văn Kiểm',
    super_admin_name: 'KS. Vũ Quốc Dũng',
    survey_data_json: {
      ownerName: 'Nguyễn Văn Hùng',
      ownerPhone: '0912345678',
      ownerIdNumber: '079085001234',
      signatures: {
        workingMinutesPhotos: ['https://storage.metro2.vn/records/record_p1.jpg'],
        ownerRepresentative: {
          fullName: 'Nguyễn Văn Hùng',
          phone: '0912345678',
          signatureImg: 'data:image/png;base64,mockSignatureData',
          signatureImageUrl: 'https://storage.metro2.vn/signatures/owner_sig.png',
        },
      },
      interviews: {
        intervieweeName: 'Nguyễn Văn Hùng',
        contactPhone: '0912345678',
        idCardNumber: '079085001234',
      },
      appendix3SignedRecordPages: [
        {
          pageIndex: 1,
          url: 'https://storage.metro2.vn/records/record_p1.jpg',
          title: { vi: 'Trang 1/2 Biên bản hiện trường', en: 'Page 1/2' },
        },
      ],
    },
  };

  // Test maskReportPii
  const maskedReport = maskReportPii(mockReportWithPii);
  assert(maskedReport.owner_name === 'Nguyễn V*** Hùng', 'Root owner_name đã được che');
  assert(maskedReport.owner_phone === '091****678', 'Root owner_phone đã được che');
  assert(maskedReport.owner_signature_url === null, 'owner_signature_url đã bị xóa');
  assert(maskedReport.owner_signature_img === null, 'owner_signature_img đã bị xóa');
  assert(maskedReport.survey_data_json.signatures.ownerRepresentative.signatureImg === null, 'survey_data_json signatureImg đã bị xóa');
  assert(maskedReport.survey_data_json.signatures.ownerRepresentative.fullName === 'Nguyễn V*** Hùng', 'signatures ownerRepresentative fullName đã che');

  // 3. Test HTML Rendering: Chế độ ADMIN (maskPii = false)
  const vmAdmin = ReportV2ViewModelMapper.buildViewModel(mockReportWithPii);
  const { template, styles } = ReportV2Service.getCompiledTemplate();
  const htmlAdmin = template({
    ...vmAdmin,
    styles,
    isPiiMasked: false,
  });

  assert(htmlAdmin.includes('Nguyễn Văn Hùng'), 'Bản in Admin PHẢI hiển thị tên đầy đủ của chủ nhà');
  assert(!htmlAdmin.includes('BẢO MẬT THÔNG TIN CÁ NHÂN (PII MASKED)'), 'BẢN in Admin KHÔNG ĐƯỢC có banner che PII');
  assert(!htmlAdmin.includes('filter: blur(6px)'), 'Bản in Admin KHÔNG ĐƯỢC làm mờ ảnh biên bản');
  assert(!htmlAdmin.includes('<body class="guest-watermark-mode">'), 'Bản in Admin KHÔNG ĐƯỢC có class guest-watermark-mode trên thẻ body');

  // 4. Test HTML Rendering: Chế độ GUEST (maskPii = true, isGuestWatermark = true)
  const vmGuest = ReportV2ViewModelMapper.buildViewModel(maskedReport);
  const htmlGuest = template({
    ...vmGuest,
    styles,
    isPiiMasked: true,
    isGuestWatermark: true,
  });

  assert(!htmlGuest.includes('Nguyễn Văn Hùng'), 'Bản in Guest KHÔNG ĐƯỢC chứa tên chưa che');
  assert(htmlGuest.includes('Nguyễn V*** Hùng'), 'Bản in Guest PHẢI hiển thị tên đã che (Nguyễn V*** Hùng)');
  assert(!htmlGuest.includes('0912345678'), 'Bản in Guest KHÔNG ĐƯỢC chứa số điện thoại thật');
  assert(htmlGuest.includes('091****678'), 'Bản in Guest PHẢI hiển thị SĐT đã che (091****678)');
  assert(htmlGuest.includes('BẢO MẬT THÔNG TIN CÁ NHÂN (PII MASKED)'), 'Bản in Guest PHẢI có banner bảo mật PII trên Phụ lục 3');
  assert(htmlGuest.includes('filter: blur(6px)'), 'Bản in Guest PHẢI áp dụng bộ lọc làm mờ blur(6px) trên ảnh quét');
  assert(htmlGuest.includes('<body class="guest-watermark-mode">'), 'Bản in Guest PHẢI có class guest-watermark-mode trên thẻ body');
  assert(htmlGuest.includes('BẢN XEM TRƯỚC - GUEST ONLY'), 'Bản in Guest PHẢI chứa watermark SVG BẢN XEM TRƯỚC - GUEST ONLY');
  assert(htmlGuest.includes('LIÊN DANH CRLG – CRSRI – TT'), 'Bản in Guest PHẢI chứa watermark SVG LIÊN DANH CRLG – CRSRI – TT');

  console.log('\n🎉 TẤT CẢ CÁC BÀI KIỂM THỬ CHE MỜ PII & AUTO WATERMARK ĐỀU THÀNH CÔNG VƯỢT TRỘI 100%!');
}

runPiiTests().catch((err) => {
  console.error('Lỗi khi chạy kiểm thử PII:', err);
  process.exit(1);
});
