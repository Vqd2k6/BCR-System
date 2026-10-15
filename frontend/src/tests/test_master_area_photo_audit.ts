/**
 * test_master_area_photo_audit.ts
 * Bộ kiểm thử tự động xác minh tính toàn vẹn 100% của tiện ích kiểm toán ảnh Khảo sát Master Area
 * Ngăn chặn hoàn toàn hiện tượng lệch pha số lượng ảnh (63 vs 32 ảnh)
 */

import { auditMasterAreaPhotos, type MasterAreaAuditInput } from '../features/survey-condo-master/utils/masterAreaPhotoAudit';

console.log('====================================================================');
console.log('KIỂM THỬ SINGLE SOURCE OF TRUTH CHO KIỂM TOÁN ẢNH MASTER AREA');
console.log('====================================================================\n');

// Mock localStorage cho Node.js môi trường test
const mockLocalStorage: Record<string, string> = {};
const mockStorageObj = {
  getItem: (key: string) => mockLocalStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockLocalStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete mockLocalStorage[key];
  },
};
Object.assign(globalThis, {
  localStorage: mockStorageObj,
  window: {
    localStorage: mockStorageObj,
    dispatchEvent: () => true,
  },
});

// TEST 1: Mô phỏng chính xác trường hợp thực tế của Khu vực M-023
// Gồm 63 ảnh tổng cộng, trong đó có 60 ảnh đã lên Cloud và 3 ảnh trong cuPhotos chưa lên Cloud
console.log('--- TEST 1: TÁI HIỆN TÌNH HUỐNG THỰC TẾ KHU VỰC M-023 (63 ẢNH vs 3 ẢNH CHƯA SYNC) ---');
{
  const input: MasterAreaAuditInput = {
    unitCode: 'M-023',
    overviewPhotos: [
      { url: 'https://r2.metro2.vn/overview_1.jpg', photoCode: 'OV_1' },
      { url: 'https://r2.metro2.vn/overview_2.jpg', photoCode: 'OV_2' },
    ],
    cadSketchPhotoUrl: 'https://r2.metro2.vn/cad_m023.jpg',
    useSeparateStructuralCad: true,
    cadStructuralSketchPhotoUrl: 'https://r2.metro2.vn/cad_str_m023.jpg',
    zones: [
      {
        id: 'z1',
        zoneCode: 'Z-01',
        floorName: 'Tầng 7',
        roomName: 'Hành lang',
        componentType: 'Tường',
        wallMaterial: 'Sơn nước',
        notes: '',
        overviewPhotos: ['https://r2.metro2.vn/z1_ov_1.jpg', 'https://r2.metro2.vn/z1_ov_2.jpg'],
        ctxPhotoUrl: 'https://r2.metro2.vn/z1_ctx.jpg',
        defects: [
          {
            defectCode: 'D01',
            pinX: 20,
            pinY: 30,
            screeningCategory: 'A',
            defectType: 'CRACK',
            widthMaxMm: 0.2,
            lengthMm: 150,
            activityState: 'S',
            materialDegradationE4: 0,
            structuralSignificanceE2: 0,
            hasScaleCard: true,
            isStructuralCritical: false,
            cuPhotoUrl: 'https://r2.metro2.vn/z1_d01_cu1.jpg',
            // d.cuPhotos chứa thêm các ảnh chụp cận cảnh phụ, bao gồm cả ảnh chưa lên Cloud
            cuPhotos: [
              'https://r2.metro2.vn/z1_d01_cu1.jpg', // Trùng cuPhotoUrl -> tự động dedupe
              'https://r2.metro2.vn/z1_d01_cu2.jpg',
              'blob:local://photo_unsynced_1', // <--- ẢNH CHƯA LÊN CLOUD #1
            ],
            macroPhotoUrl: 'https://r2.metro2.vn/z1_d01_macro.jpg',
          },
          {
            defectCode: 'D02',
            pinX: 45,
            pinY: 60,
            screeningCategory: 'A',
            defectType: 'CRACK',
            widthMaxMm: 0.4,
            lengthMm: 300,
            activityState: 'S',
            materialDegradationE4: 0,
            structuralSignificanceE2: 0,
            hasScaleCard: true,
            isStructuralCritical: false,
            cuPhotoUrl: 'https://r2.metro2.vn/z1_d02_cu1.jpg',
            cuPhotos: [
              'https://r2.metro2.vn/z1_d02_cu1.jpg',
              'blob:local://photo_unsynced_2', // <--- ẢNH CHƯA LÊN CLOUD #2
            ],
            macroPhotoUrl: 'https://r2.metro2.vn/z1_d02_macro.jpg',
          },
        ],
      },
      {
        id: 'z2',
        zoneCode: 'Z-02',
        floorName: 'Tầng 7',
        roomName: 'Sảnh thang',
        componentType: 'Tường',
        wallMaterial: 'Sơn nước',
        notes: '',
        overviewPhotos: ['https://r2.metro2.vn/z2_ov_1.jpg'],
        ctxPhotoUrl: 'https://r2.metro2.vn/z2_ctx.jpg',
        defects: [
          {
            defectCode: 'D01',
            pinX: 50,
            pinY: 50,
            screeningCategory: 'A',
            defectType: 'SPALLING',
            widthMaxMm: 1.0,
            lengthMm: 100,
            activityState: 'S',
            materialDegradationE4: 0,
            structuralSignificanceE2: 0,
            hasScaleCard: false,
            isStructuralCritical: false,
            cuPhotoUrl: 'https://r2.metro2.vn/z2_d01_cu1.jpg',
            cuPhotos: [
              'https://r2.metro2.vn/z2_d01_cu1.jpg',
              'blob:local://photo_unsynced_3', // <--- ẢNH CHƯA LÊN CLOUD #3
            ],
          },
        ],
      },
    ],
    hasStructuralElements: true,
    structuralElements: [
      {
        id: 'e1',
        elementCode: 'E-01',
        floorName: 'Tầng 7',
        roomName: 'Hành lang',
        elementType: 'Cột BTCT',
        materialType: 'BTCT toàn khối',
        notes: '',
        overviewPhotos: ['https://r2.metro2.vn/e1_ov_1.jpg'],
        ctxPhotoUrl: 'https://r2.metro2.vn/e1_ctx.jpg',
        defects: [
          {
            defectCode: 'D01',
            pinX: 30,
            pinY: 40,
            screeningCategory: 'A',
            defectType: 'CRACK',
            widthMaxMm: 0.15,
            lengthMm: 80,
            activityState: 'S',
            materialDegradationE4: 0,
            structuralSignificanceE2: 0,
            hasScaleCard: true,
            isStructuralCritical: false,
            cuPhotoUrl: 'https://r2.metro2.vn/e1_d01_cu1.jpg',
            cuPhotos: ['https://r2.metro2.vn/e1_d01_cu1.jpg', 'https://r2.metro2.vn/e1_d01_cu2.jpg'],
            macroPhotoUrl: 'https://r2.metro2.vn/e1_d01_macro.jpg',
          },
        ],
      },
    ],
  };

  // Thêm thêm các ảnh Cloud giả lập để đủ số lượng nếu cần
  for (let i = 1; i <= 40; i++) {
    input.zones![0].defects.push({
      defectCode: `D_SIM_${i}`,
      pinX: 10,
      pinY: 10,
      screeningCategory: 'A',
      defectType: 'CRACK',
      widthMaxMm: 0.1,
      lengthMm: 50,
      activityState: 'S',
      materialDegradationE4: 0,
      structuralSignificanceE2: 0,
      hasScaleCard: true,
      isStructuralCritical: false,
      cuPhotoUrl: `https://r2.metro2.vn/sim_${i}_cu.jpg`,
    });
  }

  const result = auditMasterAreaPhotos(input);
  console.log(`Kết quả kiểm toán: Tổng = ${result.total}, Đã lên Cloud = ${result.synced}, Chưa lên = ${result.unsynced}`);

  if (result.unsynced !== 3) {
    throw new Error(`Test 1 Thất bại: Số lượng ảnh chưa lên Cloud kỳ vọng là 3, thực tế là ${result.unsynced}`);
  }

  if (result.primaryUnsyncedStep !== 3) {
    throw new Error(`Test 1 Thất bại: Bước có ảnh chưa lên Cloud kỳ vọng là 3, thực tế là ${result.primaryUnsyncedStep}`);
  }

  // Khẳng định 3 ảnh chưa lên Cloud đều được gom đủ vào unsyncedPhotos
  const unsyncedUrls = result.unsyncedPhotos.map((p) => p.url);
  if (
    !unsyncedUrls.includes('blob:local://photo_unsynced_1') ||
    !unsyncedUrls.includes('blob:local://photo_unsynced_2') ||
    !unsyncedUrls.includes('blob:local://photo_unsynced_3')
  ) {
    throw new Error('Test 1 Thất bại: Danh sách unsyncedPhotos bị thiếu ảnh chưa lên Cloud!');
  }

  console.log('✅ TEST 1 PASS: Quét chính xác 100% ảnh cận cảnh phụ (cuPhotos) và phát hiện đúng 3 ảnh chưa lên Cloud!');
}

// TEST 2: Kiểm tra khả năng tự chữa lành (healLocalPhotoUris)
console.log('\n--- TEST 2: TỰ ĐỘNG CHỮA LÀNH KHI ẢNH ĐÃ CÓ CLOUD MAPPING TRONG LOCALSTORAGE ---');
{
  // Lưu mapping cho photo_unsynced_1 vào localStorage
  mockLocalStorage['metro2_uploaded_photo_map'] = JSON.stringify({
    photo_unsynced_1: 'https://r2.metro2.vn/healed_photo_1.jpg',
  });

  const input: MasterAreaAuditInput = {
    unitCode: 'M-023',
    overviewPhotos: [],
    zones: [
      {
        id: 'z1',
        zoneCode: 'Z-01',
        floorName: 'Tầng 7',
        roomName: 'Hành lang',
        componentType: 'Tường',
        wallMaterial: 'Sơn nước',
        notes: '',
        overviewPhotos: [],
        defects: [
          {
            defectCode: 'D01',
            pinX: 20,
            pinY: 30,
            screeningCategory: 'A',
            defectType: 'CRACK',
            widthMaxMm: 0.2,
            lengthMm: 150,
            activityState: 'S',
            materialDegradationE4: 0,
            structuralSignificanceE2: 0,
            hasScaleCard: true,
            isStructuralCritical: false,
            cuPhotoUrl: 'blob:local://photo_unsynced_1',
            cuPhotos: ['blob:local://photo_unsynced_1', 'blob:local://photo_unsynced_2'],
          },
        ],
      },
    ],
  };

  const result = auditMasterAreaPhotos(input);
  console.log(`Sau chữa lành: Tổng = ${result.total}, Đã lên Cloud = ${result.synced}, Chưa lên = ${result.unsynced}`);

  if (result.synced !== 1 || result.unsynced !== 1) {
    throw new Error(`Test 2 Thất bại: Kỳ vọng 1 đã sync, 1 chưa sync. Thực tế: synced=${result.synced}, unsynced=${result.unsynced}`);
  }

  console.log('✅ TEST 2 PASS: Tự động hồi phục URL Cloud từ mapping bền vững, giảm thiểu số ảnh unsynced ảo!');
}

console.log('\n====================================================================');
console.log('🎉 TẤT CẢ CÁC TEST CASES KIỂM TOÁN ẢNH MASTER AREA ĐỀU PASS 100%!');
console.log('====================================================================\n');
