import {
  validateCondoUnitStep1,
  validateCondoUnitStep2,
  validateCondoUnitStep3,
  validateCondoUnitStep4AndCloud,
  validateCondoUnitSingleStep,
  validateCondoUnitFull,
} from '../features/survey-condo-unit/utils/condoUnitValidator';
import type { CondoUnitFormData } from '../features/survey-condo-unit/types/condo-unit.types';

console.log('====================================================================');
console.log('KIỂM THỬ TOÀN DIỆN CỔNG KIỂM SOÁT DỮ LIỆU CĂN HỘ CON (CONDO UNIT)');
console.log('====================================================================\n');

// Mock dữ liệu cơ bản
const createBaseFormData = (): CondoUnitFormData => ({
  parcelId: 'parcel-test-01',
  unitId: 'unit-test-101',
  parentInfo: {
    projectParcelCode: 'C&C-05-B-0129',
    officialCadastralCode: '2024-CC-01',
    buildingName: 'Chung cư Horizon Tower',
    address: '123 CMT8, Q.10',
    chainage: 'Km 3+450',
    metroOffsetDistance: '12.5m',
    isConfirmed: true,
  },
  unitCode: '01.06',
  displayCode: '106',
  floorNumber: 1,
  ownerName: 'Nguyễn Văn A',
  ownerPhone: '0901234567',
  ownerIdCard: '079090123456',
  residentStatus: 'CHỦ_HỘ_Ở',
  unitAreaM2: 75.5,
  photoP01: { url: 'https://r2.metro2.vn/p01.jpg', photoCode: 'P01-01', notApplicable: false },
  photoP04: { url: 'https://r2.metro2.vn/p04.jpg', photoCode: 'P04-01', notApplicable: false },
  historyInterview: {
    renovationLoad: 0,
    majorRepair: 0,
    pastSettlement: 0,
    neighborDamage: 0,
    fireFloodIncident: 0,
    usageStatus: 'Đang ở',
    continuousOperation247: false,
    sensitiveEquipment: { has: false, description: '' },
  },
  hasSensitiveEquipment: false,
  sensitiveEquipmentDesc: '',
  zones: [
    {
      id: 'z-01',
      zoneCode: 'Z-01',
      floorName: 'Tầng 1',
      roomName: 'Phòng khách',
      componentType: 'Tường gạch',
      wallMaterial: 'Sơn nước',
      overviewPhotos: [],
      notes: '',
      hasDamage: true,
      ctxPhotoUrl: 'https://r2.metro2.vn/ctx-z01.jpg',
      defects: [
        {
          defectCode: 'D-01',
          pinX: 25,
          pinY: 40,
          screeningCategory: 'CRACK',
          defectType: 'Nứt chân chim vữa trát',
          widthMaxMm: 0.35,
          lengthMm: 1200,
          notes: 'Nứt chân chim mảng tường phía đông',
          cuPhotoUrl: 'https://r2.metro2.vn/cu-d01.jpg',
          hasScaleCard: true,
          isStructuralCritical: false,
          activityState: 'U',
          materialDegradationE4: 1,
          structuralSignificanceE2: 1,
        },
      ],
    },
  ],
  structuralElements: [],
  hasStructuralElements: false,
  cadZonePins: [{ zoneCode: 'Z-01', pinX: 30, pinY: 50 }],
  cadElementPins: [],
  localDefects: [],
  upperFloorWaterLeakage: { has: false, leakageItems: [] },
  beamSagging: { hasSagging: false },
  doorJammingStatus: 'NORMAL',
  settlementObserved: 'NONE',
  settlementNotes: '',
  surveyorSignature: 'data:image/svg+xml;base64,mock',
  ownerSignature: 'data:image/svg+xml;base64,mock',
  ownerFeedback: 'Đồng ý kết quả khảo sát',
  surveyDate: '2026-10-12',
  workingMinutesPhotos: ['https://r2.metro2.vn/minutes-01.jpg'],
});

// TEST 1: Bước 1 - Thiếu mã định danh & Ảnh nhận diện cửa
console.log('--- TEST 1: KIỂM SOÁT BƯỚC 1 (ĐỐI SOÁT TÒA MẸ & ẢNH P01/P04) ---');
{
  const data = createBaseFormData();
  data.photoP01 = { url: '', notApplicable: false };
  const issues = validateCondoUnitStep1(data);
  const hasP01Error = issues.some((i) => i.target === 'PHOTO_P01' && i.isBlocking);
  if (!hasP01Error) throw new Error('Test 1 thất bại: Không chặn khi thiếu ảnh P01');
  console.log('✅ Bước 1 chặn thành công khi thiếu ảnh P01: Biển số phòng');

  data.photoP01 = { url: '', notApplicable: true }; // Tích chọn N/A
  const issuesAfterNA = validateCondoUnitStep1(data);
  if (issuesAfterNA.some((i) => i.target === 'PHOTO_P01')) {
    throw new Error('Test 1 thất bại: Không chấp nhận N/A cho ảnh P01');
  }
  console.log('✅ Bước 1 chấp nhận hợp lệ khi đánh dấu N/A cho ảnh P01');
}

// TEST 2: Bước 2 - Thông tin căn hộ con & Trạng thái cư trú
console.log('\n--- TEST 2: KIỂM SOÁT BƯỚC 2 (ĐỊNH DANH & TRẠNG THÁI CƯ TRÚ) ---');
{
  const data = createBaseFormData();
  // @ts-expect-error test invalid enum
  data.residentStatus = 'KHONG_HOP_LE';
  const issues = validateCondoUnitStep2(data);
  const hasResError = issues.some((i) => i.target === 'RESIDENT_STATUS' && i.isBlocking);
  if (!hasResError) throw new Error('Test 2 thất bại: Không chặn khi residentStatus không hợp lệ');
  console.log('✅ Bước 2 chặn thành công khi residentStatus không nằm trong Enum chuẩn');

  // Kiểm tra số điện thoại sai định dạng (Warning)
  data.residentStatus = 'CHỦ_HỘ_Ở';
  data.ownerPhone = '12345';
  const issuesPhone = validateCondoUnitStep2(data);
  const hasPhoneWarn = issuesPhone.some((i) => i.target === 'OWNER_PHONE' && !i.isBlocking);
  if (!hasPhoneWarn) throw new Error('Test 2 thất bại: Không cảnh báo số điện thoại sai');
  console.log('✅ Bước 2 cảnh báo chuẩn xác số điện thoại sai định dạng (Warning)');
}

// TEST 3: Bước 3 - Khuyết tật nứt D thiếu wmax (Quy chuẩn Phase 1 Metro 2)
console.log('\n--- TEST 3: KIỂM SOÁT BƯỚC 3 (ĐA TẦNG Z -> E -> D: BỀ RỘNG VẾT NỨT WMAX) ---');
{
  const data = createBaseFormData();
  // Đặt wmax = 0 cho vết nứt
  data.zones[0].defects[0].widthMaxMm = 0;
  const issues = validateCondoUnitStep3(data);
  const hasWmaxBlocking = issues.some(
    (i) => i.target === 'DEFECT' && i.fieldId.includes('wmax') && i.isBlocking
  );
  if (!hasWmaxBlocking) throw new Error('Test 3 thất bại: widthMaxMm <= 0 nhưng không bị CHẶN CỨNG');
  console.log('✅ Bước 3 CHẶN CỨNG thành công khi vết nứt có bề rộng wmax = 0');

  // Điền wmax hợp lệ
  data.zones[0].defects[0].widthMaxMm = 0.45;
  const issuesAfterFix = validateCondoUnitStep3(data);
  const stillHasWmax = issuesAfterFix.some((i) => i.fieldId.includes('wmax') && i.isBlocking);
  if (stillHasWmax) throw new Error('Test 3 thất bại: Đã nhập wmax hợp lệ nhưng vẫn báo lỗi');
  console.log('✅ Bước 3 thông qua thành công khi vết nứt có wmax = 0.45mm > 0');
}

// TEST 4: Bước 3 - Vùng Z có khuyết tật nhưng thiếu ảnh bối cảnh (CTX)
console.log('\n--- TEST 4: KIỂM SOÁT BƯỚC 3 (VÙNG Z CÓ D PHẢI CÓ ẢNH BỐI CẢNH CTX) ---');
{
  const data = createBaseFormData();
  data.zones[0].ctxPhotoUrl = ''; // Xóa ảnh bối cảnh
  const issues = validateCondoUnitStep3(data);
  const hasCtxBlocking = issues.some(
    (i) => i.target === 'ZONE' && i.fieldId.includes('ctx') && i.isBlocking
  );
  if (!hasCtxBlocking) throw new Error('Test 4 thất bại: Vùng Z có D nhưng không chặn khi thiếu CTX');
  console.log('✅ Bước 3 CHẶN CỨNG thành công khi Vùng Z có khuyết tật nhưng thiếu ảnh bối cảnh CTX');
}

// TEST 5: Bước 3 - Độ võng dầm/sàn (Mục 3.3)
console.log('\n--- TEST 5: KIỂM SOÁT BƯỚC 3 (MỤC 3.3: ĐỘ VÕNG DẦM/SÀN THEO TCVN 5574:2018) ---');
{
  const data = createBaseFormData();
  data.beamSagging = { hasSagging: true, sagMm: 0, spanM: 0 };
  const issues = validateCondoUnitStep3(data);
  const hasSagBlocking = issues.some((i) => i.target === 'SAGGING' && i.isBlocking);
  if (!hasSagBlocking) throw new Error('Test 5 thất bại: Có võng nhưng không chặn khi thiếu f hoặc L');
  console.log('✅ Bước 3 CHẶN CỨNG thành công khi có võng nhưng chưa nhập độ võng f hoặc nhịp L');

  data.beamSagging = { hasSagging: true, sagMm: 12, spanM: 6.0 };
  const issuesSagFixed = validateCondoUnitStep3(data);
  if (issuesSagFixed.some((i) => i.target === 'SAGGING' && i.isBlocking)) {
    throw new Error('Test 5 thất bại: Đã nhập f và L nhưng vẫn báo lỗi');
  }
  console.log('✅ Bước 3 thông qua độ võng khi nhập đủ f = 12mm, L = 6.0m');
}

// TEST 6: Toàn bộ quy trình - Đạt chuẩn 100%
console.log('\n--- TEST 6: THẨM ĐỊNH TOÀN BỘ HỒ SƠ HOÀN THIỆN ĐẠT CHUẨN 100% ---');
{
  const data = createBaseFormData();
  const result = validateCondoUnitFull(data);
  console.log(`Kết quả: isValid=${result.isValid}, Blocking Issues=${result.blockingIssues.length}, Warnings=${result.warnings.length}`);
  if (!result.isValid || result.blockingIssues.length > 0) {
    console.error('Blocking issues:', result.blockingIssues);
    throw new Error('Test 6 thất bại: Hồ sơ chuẩn bị báo lỗi chặn');
  }
  console.log('✅ Hồ sơ đạt chuẩn 100%, sẵn sàng nộp lên hệ thống Metro 2!');
}

// TEST 7: Bước 3 - Vùng Z ghim trên CAD nhưng không có ảnh nào (overviewPhotos rỗng & không có ctxPhotoUrl)
console.log('\n--- TEST 7: KIỂM SOÁT BƯỚC 3 (VÙNG Z GHIM TRÊN CAD BẮT BUỘC >= 1 ẢNH THỰC TẾ) ---');
{
  const data = createBaseFormData();
  // Vùng Z không có khuyết tật (defects rỗng, hasDamage: false), không có ảnh nào
  data.zones[0].hasDamage = false;
  data.zones[0].defects = [];
  data.zones[0].ctxPhotoUrl = '';
  data.zones[0].overviewPhotos = [];

  const issues = validateCondoUnitStep3(data);
  const hasPhotoBlocking = issues.some(
    (i) => i.target === 'ZONE' && i.fieldId.includes('zone-photo') && i.isBlocking
  );
  if (!hasPhotoBlocking) {
    throw new Error('Test 7 thất bại: Vùng Z không có ảnh nào nhưng KHÔNG BỊ CHẶN CỨNG');
  }
  console.log('✅ Bước 3 CHẶN CỨNG thành công khi Vùng Z không có bất kỳ ảnh thực tế nào (overviewPhotos hoặc CTX)');

  // Bổ sung 1 ảnh tổng quan không gian
  data.zones[0].overviewPhotos = ['https://r2.metro2.vn/zone-overview-01.jpg'];
  const issuesAfterPhoto = validateCondoUnitStep3(data);
  const stillBlocked = issuesAfterPhoto.some(
    (i) => i.target === 'ZONE' && i.fieldId.includes('zone-photo') && i.isBlocking
  );
  if (stillBlocked) {
    throw new Error('Test 7 thất bại: Đã thêm ảnh overview nhưng vẫn bị chặn');
  }
  console.log('✅ Bước 3 thông qua Vùng Z khi đã có 1 ảnh tổng quan không gian thực tế');
}

// TEST 8: Bước 3 - Cấu kiện E ghim trên CAD nhưng không có ảnh nào
console.log('\n--- TEST 8: KIỂM SOÁT BƯỚC 3 (CẤU KIỆN E KẾT CẤU BẮT BUỘC >= 1 ẢNH THỰC TẾ) ---');
{
  const data = createBaseFormData();
  data.hasStructuralElements = true;
  data.structuralElements = [
    {
      id: 'e-01',
      elementCode: 'E-01',
      floorName: 'Tầng 1',
      elementType: 'Cột bê tông cốt thép',
      materialType: 'BTCT',
      roomName: 'Phòng khách',
      notes: '',
      hasDamage: false,
      ctxPhotoUrl: '',
      overviewPhotos: [],
      defects: [],
    },
  ];

  const issues = validateCondoUnitStep3(data);
  const hasElemPhotoBlocking = issues.some(
    (i) => i.target === 'ELEMENT' && i.fieldId.includes('element-photo') && i.isBlocking
  );
  if (!hasElemPhotoBlocking) {
    throw new Error('Test 8 thất bại: Cấu kiện E không có ảnh nào nhưng KHÔNG BỊ CHẶN CỨNG');
  }
  console.log('✅ Bước 3 CHẶN CỨNG thành công khi Cấu kiện E không có bất kỳ ảnh chụp thực tế nào');

  // Bổ sung 1 ảnh cấu kiện
  data.structuralElements[0].overviewPhotos = ['https://r2.metro2.vn/elem-overview-01.jpg'];
  const issuesAfterElemPhoto = validateCondoUnitStep3(data);
  const elemStillBlocked = issuesAfterElemPhoto.some(
    (i) => i.target === 'ELEMENT' && i.fieldId.includes('element-photo') && i.isBlocking
  );
  if (elemStillBlocked) {
    throw new Error('Test 8 thất bại: Đã thêm ảnh cấu kiện E nhưng vẫn bị chặn');
  }
  console.log('✅ Bước 3 thông qua Cấu kiện E khi đã có ảnh chụp cấu kiện thực tế');
}

// TEST 9: Bước 4 - Hồ sơ thiếu cả ảnh biên bản làm việc giấy lẫn chữ ký điện tử
console.log('\n--- TEST 9: KIỂM SOÁT BƯỚC 4 (BẮT BUỘC ẢNH BIÊN BẢN LÀM VIỆC HOẶC CHỮ KÝ PHÁP LÝ) ---');
{
  const data = createBaseFormData();
  data.workingMinutesPhotos = [];
  data.ownerSignature = '';
  data.surveyorSignature = '';
  data.signatures = undefined;

  const issues = validateCondoUnitStep4AndCloud(data);
  const hasMinutesBlocking = issues.some(
    (i) => i.fieldId === 'step4-working-minutes' && i.isBlocking
  );
  if (!hasMinutesBlocking) {
    throw new Error('Test 9 thất bại: Bước 4 thiếu biên bản và chữ ký nhưng KHÔNG BỊ CHẶN CỨNG');
  }
  console.log('✅ Bước 4 CHẶN CỨNG thành công khi thiếu cả ảnh biên bản giấy lẫn chữ ký điện tử');

  // Khi có ảnh biên bản giấy
  data.workingMinutesPhotos = ['https://r2.metro2.vn/bb-01.jpg'];
  const issuesWithMinutes = validateCondoUnitStep4AndCloud(data);
  const minutesStillBlocked = issuesWithMinutes.some(
    (i) => i.fieldId === 'step4-working-minutes' && i.isBlocking
  );
  if (minutesStillBlocked) {
    throw new Error('Test 9 thất bại: Đã có ảnh biên bản giấy nhưng vẫn bị chặn');
  }
  console.log('✅ Bước 4 thông qua thành công khi có ảnh chụp Biên bản làm việc giấy tại hiện trường');
}

// TEST 10: Chế độ Vắng Mặt (Absentee Mode) - Kiểm soát chặt chẽ (Miễn 100% chữ ký)
console.log('\n--- TEST 10: KIỂM SOÁT CHẾ ĐỘ VẮNG MẶT (ABSENTEE WORKFLOW) ---');
{
  const data = createBaseFormData();
  data.isAbsentee = true;
  data.residentStatus = 'VẮNG_MẶT_KHÓA_CỬA';
  data.absenteeInfo = {
    absenceReason: 'HOMEOWNER_ABSENT',
    absenteeMinutesPhotos: [],
    attemptCount: 1,
    noticeDelivered: true,
  };
  data.surveyorSignature = '';

  const issuesStep3 = validateCondoUnitSingleStep(3, data);
  const missingAbsMinutes = issuesStep3.some(
    (i) => i.fieldId === 'step3-absentee-minutes-photos' && i.isBlocking
  );

  if (!missingAbsMinutes) {
    throw new Error('Test 10 thất bại: Chế độ vắng mặt không chặn khi thiếu biên bản vắng');
  }
  console.log('✅ Chế độ vắng mặt CHẶN CỨNG thành công khi thiếu ảnh biên bản vắng/giấy hẹn');

  // Điền đủ thông tin vắng mặt (Khẳng định: Miễn 100% chữ ký KSV và Chủ hộ)
  data.absenteeInfo = {
    absenceReason: 'HOMEOWNER_ABSENT',
    absenteeMinutesPhotos: ['https://r2.metro2.vn/abs-minutes.jpg'],
    attemptCount: 1,
    noticeDelivered: true,
  };
  data.surveyorSignature = ''; // Hoàn toàn không có chữ ký KSV
  const fullAbsenteeResult = validateCondoUnitFull(data);
  if (!fullAbsenteeResult.isValid) {
    console.error('Absentee blocking issues:', fullAbsenteeResult.blockingIssues);
    throw new Error('Test 10 thất bại: Đã điền đủ thông tin vắng mặt nhưng vẫn bị chặn');
  }
  console.log('✅ Chế độ vắng mặt thông qua 100% khi có ảnh giấy hẹn/biên bản vắng (Miễn 100% chữ ký)');
}

console.log('\n====================================================================');
console.log('🎉 TẤT CẢ 10 BỘ TEST CỔNG KIỂM SOÁT DỮ LIỆU ĐỀU PASS 100%!');
console.log('====================================================================\n');
