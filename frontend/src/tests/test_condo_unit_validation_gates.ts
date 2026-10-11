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
      roomName: 'Phòng khách',
      componentType: 'Tường gạch',
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

console.log('\n====================================================================');
console.log('🎉 TẤT CẢ 6 BỘ TEST CỔNG KIỂM SOÁT DỮ LIỆU ĐỀU PASS 100%!');
console.log('====================================================================\n');
