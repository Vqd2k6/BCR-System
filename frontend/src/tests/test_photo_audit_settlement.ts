/**
 * Test kiểm toán ảnh Khảo sát lún lệch (Settlement Tilt) và Lưới an toàn tự động
 * Chạy bằng: npx tsx frontend/src/tests/test_photo_audit_settlement.ts
 */
import { auditSurveyPhotos } from '../features/survey-phase1/utils/photoSyncAudit';
import { getDefaultInitialFormData } from '../features/survey-phase1/store/initialFormData';
import type { Phase1SurveyFormData } from '../features/survey-phase1/types/phase1.types';

function runTest() {
  console.log('--- BẮT ĐẦU KIỂM THỬ KIỂM TOÁN ẢNH LÚN LỆCH & LƯỚI AN TOÀN ---');

  // Giả lập dữ liệu tương tự hồ sơ thực tế của Nuỵe
  const mockFormData: Phase1SurveyFormData = {
    ...getDefaultInitialFormData('3736b7da-a966-4c1f-a68b-b4787559e174'),
    projectParcelCode: 'C&C-05-B-0039',
    photoP01: {
      url: 'https://pub-4e9eb9f02bd948ca92dd0d3fe780f77d.r2.dev/surveys/C_C-05-B-0039/P01/photo1.jpg',
      photoCode: 'HCM_M2.[C&C-05-B-0039]_P01',
      notApplicable: false,
    },
    settlementTilt: {
      diffSettlement: {
        level: 0,
        position: '',
        notes: 'Không phát hiện lún chênh',
        photoUrl: 'https://pub-4e9eb9f02bd948ca92dd0d3fe780f77d.r2.dev/surveys/C_C-05-B-0039/SETTLE/HCM_M2__C_C-05-B-0039__FOUND_SETTLE_01_1791441617863_fccc16.jpg',
        photoCode: 'HCM_M2.[C&C-05-B-0039]_FOUND_SETTLE_01',
        photos: [
          {
            url: 'https://pub-4e9eb9f02bd948ca92dd0d3fe780f77d.r2.dev/surveys/C_C-05-B-0039/SETTLE/HCM_M2__C_C-05-B-0039__FOUND_SETTLE_01_1791441617863_fccc16.jpg',
            photoCode: 'HCM_M2.[C&C-05-B-0039]_FOUND_SETTLE_01',
          },
          {
            url: 'https://pub-4e9eb9f02bd948ca92dd0d3fe780f77d.r2.dev/surveys/C_C-05-B-0039/SETTLE/HCM_M2__C_C-05-B-0039__FOUND_SETTLE_02_1791441642711_ea3555.jpg',
            photoCode: 'HCM_M2.[C&C-05-B-0039]_FOUND_SETTLE_02',
          },
          {
            url: 'https://pub-4e9eb9f02bd948ca92dd0d3fe780f77d.r2.dev/surveys/C_C-05-B-0039/SETTLE/HCM_M2__C_C-05-B-0039__FOUND_SETTLE_03_1791441701148_89cb66.jpg',
            photoCode: 'HCM_M2.[C&C-05-B-0039]_FOUND_SETTLE_03',
          },
          // 2 ảnh còn dạng blob:local:// từ máy của Nuỵe
          {
            url: 'blob:local://photo_1791441844746_7co0a',
            photoCode: 'HCM_M2.[C&C-05-B-0039]_FOUND_SETTLE_04',
          },
          {
            url: 'blob:local://photo_1791441861390_fxatw',
            photoCode: 'HCM_M2.[C&C-05-B-0039]_FOUND_SETTLE_05',
          },
          {
            url: 'https://pub-4e9eb9f02bd948ca92dd0d3fe780f77d.r2.dev/surveys/C_C-05-B-0039/SETTLE/HCM_M2__C_C-05-B-0039__FOUND_SETTLE_06_1791441995750_5bcf6b.jpg',
            photoCode: 'HCM_M2.[C&C-05-B-0039]_FOUND_SETTLE_06',
          },
        ],
      },
      buildingTilt: {
        level: 0,
        xPermille: '',
        yPermille: '',
        notes: '',
        photos: [],
      },
      beamSagging: {
        level: 0,
        position: '',
        sagMm: '',
        notes: '',
      },
      dataSource: ['Quan sát trực quan'],
      reliability: 'HIGH',
      needAdditionalMonitoring: { required: false, notes: '' },
    },
    // Giả lập 1 trường ảnh lạ không khai báo trong schema chuẩn để test lưới an toàn
    extraCustomData: {
      unexpectedBlob: 'blob:local://photo_unexpected_safety_net',
    },
  } as unknown as Phase1SurveyFormData;

  let updatedState = mockFormData;
  const updateFormData = (updater: any) => {
    if (typeof updater === 'function') {
      updatedState = updater(updatedState);
    } else {
      updatedState = { ...updatedState, ...updater };
    }
  };

  const audit = auditSurveyPhotos(mockFormData, updateFormData);

  console.log(`- Tổng số ảnh ghi nhận: ${audit.totalPhotos}`);
  console.log(`- Số ảnh đã lên Cloud: ${audit.syncedPhotosCount}`);
  console.log(`- Số ảnh CHƯA đồng bộ: ${audit.unsyncedPhotosCount}`);

  // 1. Kiểm tra số lượng ảnh thiếu
  // Kỳ vọng: SETTLE_04 (blob), SETTLE_05 (blob) và unexpectedBlob (safety net) -> 3 ảnh thiếu
  if (audit.unsyncedPhotosCount !== 3) {
    throw new Error(`FAIL: Kỳ vọng 3 ảnh thiếu nhưng lại có ${audit.unsyncedPhotosCount}`);
  }
  console.log('✅ TEST 1 ĐẠT: Đã phát hiện chính xác toàn bộ ảnh thiếu (kể cả ảnh trong mảng và ảnh qua lưới an toàn).');

  // 2. Kiểm tra thông tin định danh của các ảnh thiếu
  const settle04 = audit.unsyncedPhotos.find((p) => p.photoCode === 'HCM_M2.[C&C-05-B-0039]_FOUND_SETTLE_04');
  if (!settle04) {
    throw new Error('FAIL: Không tìm thấy SETTLE_04 trong unsyncedPhotos');
  }
  if (settle04.step !== 1) {
    throw new Error(`FAIL: SETTLE_04 phải thuộc Step 1, hiện tại là Step ${settle04.step}`);
  }
  console.log('✅ TEST 2 ĐẠT: SETTLE_04 được gán chính xác về Bước 1:', settle04.fieldTitle);

  const settle05 = audit.unsyncedPhotos.find((p) => p.photoCode === 'HCM_M2.[C&C-05-B-0039]_FOUND_SETTLE_05');
  if (!settle05) {
    throw new Error('FAIL: Không tìm thấy SETTLE_05 trong unsyncedPhotos');
  }
  if (settle05.step !== 1) {
    throw new Error(`FAIL: SETTLE_05 phải thuộc Step 1, hiện tại là Step ${settle05.step}`);
  }
  console.log('✅ TEST 3 ĐẠT: SETTLE_05 được gán chính xác về Bước 1:', settle05.fieldTitle);

  // 3. Kiểm tra lưới an toàn Deep Safety Net
  const safetyNetItem = audit.unsyncedPhotos.find((p) => p.url === 'blob:local://photo_unexpected_safety_net');
  if (!safetyNetItem) {
    throw new Error('FAIL: Lưới an toàn không bắt được ảnh unexpectedBlob');
  }
  console.log('✅ TEST 4 ĐẠT: Lưới an toàn tự động phát hiện được ảnh ngoài schema:', safetyNetItem.fieldTitle);

  // 4. Kiểm tra cập nhật URL mới vào store
  settle04.updateInStore('https://pub-...r2.dev/settle04_fixed.jpg');
  const photosAfterUpdate = updatedState.settlementTilt.diffSettlement.photos || [];
  if (photosAfterUpdate[3]?.url !== 'https://pub-...r2.dev/settle04_fixed.jpg') {
    throw new Error('FAIL: updateInStore không cập nhật đúng URL của SETTLE_04 trong mảng photos');
  }
  console.log('✅ TEST 5 ĐẠT: updateInStore cập nhật chính xác phần tử trong mảng photos.');

  console.log('\n🎉 TẤT CẢ 5 BÀI TEST KIỂM TOÁN ẢNH ĐỀU ĐẠT 100%!');
}

runTest();
