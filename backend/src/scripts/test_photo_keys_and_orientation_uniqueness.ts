import assert from 'assert';
import { buildFloorSurveys } from '../modules/report/generators/residential/residential.floor-builder';

/**
 * ============================================================================
 * TEST SUITE: PHOTO KEYS UNIQUENESS, ROTATION ISOLATION & AUDIT NAVIGATION
 * Nghiệp vụ: Khắc phục React duplicate key 'defect_D-01_cu', đảm bảo định danh
 * duy nhất composite key theo tầng, cô lập góc xoay, đồng bộ URL và chuyển tab tầng.
 * ============================================================================
 */

let passedCount = 0;
let failedCount = 0;

function runTestCase(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedCount++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Nguyên nhân: ${err.message}`);
    failedCount++;
  }
}

console.log('\n================================================================================');
console.log('🧪 TEST SUITE: PHOTO KEYS UNIQUENESS & ORIENTATION ISOLATION AUDIT');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// NHÓM 1: TẠO COMPOSITE KEY & DOM ID DUY NHẤT (MÔ PHỎNG THỰC TẾ C&C-05-B-0062)
// -----------------------------------------------------------------------------
console.log('--- NHÓM 1: TẠO COMPOSITE KEY & DOM ID DUY NHẤT CHO CÁC TẦNG ---');

runTestCase('Case 1: 8 khuyết tật mang mã D-01 trên 6 tầng sinh ra 8 composite keys và DOM IDs hoàn toàn phân biệt', () => {
  // Mô phỏng 6 tầng của hồ sơ C&C-05-B-0062, không có d.id riêng, tất cả đều mang defectCode: 'D-01'
  const mockFloors = [
    { floorName: 'Tầng 1', zones: [{ zoneCode: 'Z-01', defects: [{ defectCode: 'D-01', cuPhotoUrl: 'https://cdn.example.com/p_f0_d01.jpg' }] }] },
    { floorName: 'Tầng 2', zones: [{ zoneCode: 'Z-01', defects: [{ defectCode: 'D-01', cuPhotoUrl: 'https://cdn.example.com/p_f1_d01.jpg' }] }] },
    { floorName: 'Tầng 3', zones: [{ zoneCode: 'Z-01', defects: [{ defectCode: 'D-01', cuPhotoUrl: 'https://cdn.example.com/p_f2_d01.jpg' }] }] },
    { floorName: 'Tầng 4', zones: [{ zoneCode: 'Z-01', defects: [{ defectCode: 'D-01', cuPhotoUrl: 'https://cdn.example.com/p_f3_d01.jpg' }] }] },
    { floorName: 'Tầng 5', zones: [{ zoneCode: 'Z-01', defects: [
        { defectCode: 'D-01', cuPhotoUrl: 'https://cdn.example.com/p_f4_d01_a.jpg' },
        { defectCode: 'D-01', cuPhotoUrl: 'https://cdn.example.com/p_f4_d01_b.jpg' },
        { defectCode: 'D-01', cuPhotoUrl: 'https://cdn.example.com/p_f4_d01_c.jpg' }
      ] }] },
    { floorName: 'Tầng mái', zones: [{ zoneCode: 'Z-01', defects: [{ defectCode: 'D-01', cuPhotoUrl: 'https://cdn.example.com/p_f5_d01.jpg' }] }] },
  ];

  const generatedKeys: string[] = [];
  const generatedDomIds: string[] = [];

  mockFloors.forEach((f, fIdx) => {
    f.zones.forEach(z => {
      const zCode = z.zoneCode || 'Z-01';
      z.defects.forEach((d, dIdx) => {
        const dCode = d.defectCode || 'D-01';
        // Logic composite key mới tương thích hook usePhotoOrientationAudit
        const compositeKey = (d as any).id
          ? `defect_${(d as any).id}_cu`
          : (z.defects.length > 1
              ? `defect_f${fIdx}_z${zCode}_d${dCode}_cu_${dIdx}`
              : `defect_f${fIdx}_z${zCode}_d${dCode}_cu`);
        const domId = `audit-photo-card-defect-f${fIdx}-z${zCode}-d${dCode}-cu${z.defects.length > 1 ? `-${dIdx}` : ''}`;
        
        generatedKeys.push(compositeKey);
        generatedDomIds.push(domId);
      });
    });
  });

  assert.strictEqual(generatedKeys.length, 8, 'Phải có đúng 8 keys được sinh ra');
  assert.strictEqual(new Set(generatedKeys).size, 8, 'Tất cả 8 keys phải tuyệt đối không trùng lặp (Set.size === 8)');
  assert.strictEqual(new Set(generatedDomIds).size, 8, 'Tất cả 8 DOM IDs phải tuyệt đối không trùng lặp (Set.size === 8)');

  // Kiểm tra cấu trúc key đúng chuẩn
  assert.ok(generatedKeys.includes('defect_f0_zZ-01_dD-01_cu'));
  assert.ok(generatedKeys.includes('defect_f1_zZ-01_dD-01_cu'));
  assert.ok(generatedKeys.includes('defect_f4_zZ-01_dD-01_cu_0'));
  assert.ok(generatedKeys.includes('defect_f4_zZ-01_dD-01_cu_1'));
  assert.ok(generatedKeys.includes('defect_f4_zZ-01_dD-01_cu_2'));
  assert.ok(generatedKeys.includes('defect_f5_zZ-01_dD-01_cu'));
});

runTestCase('Case 2: 6 khu vực khảo sát Z-01 trên 6 tầng sinh ra 6 composite keys và DOM IDs độc lập', () => {
  const mockFloors = [
    { floorName: 'Tầng 1', zones: [{ zoneCode: 'Z-01', ctxPhotoUrl: 'https://cdn.example.com/z0.jpg' }] },
    { floorName: 'Tầng 2', zones: [{ zoneCode: 'Z-01', ctxPhotoUrl: 'https://cdn.example.com/z1.jpg' }] },
    { floorName: 'Tầng 3', zones: [{ zoneCode: 'Z-01', ctxPhotoUrl: 'https://cdn.example.com/z2.jpg' }] },
    { floorName: 'Tầng 4', zones: [{ zoneCode: 'Z-01', ctxPhotoUrl: 'https://cdn.example.com/z3.jpg' }] },
    { floorName: 'Tầng 5', zones: [{ zoneCode: 'Z-01', ctxPhotoUrl: 'https://cdn.example.com/z4.jpg' }] },
    { floorName: 'Tầng mái', zones: [{ zoneCode: 'Z-01', ctxPhotoUrl: 'https://cdn.example.com/z5.jpg' }] },
  ];

  const zoneKeys: string[] = [];
  const zoneDomIds: string[] = [];

  mockFloors.forEach((f, fIdx) => {
    f.zones.forEach(z => {
      const zCode = z.zoneCode || 'Z-01';
      const compositeKey = (z as any).id ? `zone_${(z as any).id}_ctx` : `zone_f${fIdx}_z${zCode}_ctx`;
      const domId = `audit-photo-card-zone-f${fIdx}-z${zCode}-ctx`;
      zoneKeys.push(compositeKey);
      zoneDomIds.push(domId);
    });
  });

  assert.strictEqual(zoneKeys.length, 6);
  assert.strictEqual(new Set(zoneKeys).size, 6, 'Không có zone key nào bị đè nhau');
  assert.strictEqual(new Set(zoneDomIds).size, 6, 'Không có zone DOM ID nào bị đè nhau');
  assert.ok(zoneKeys.includes('zone_f0_zZ-01_ctx'));
  assert.ok(zoneKeys.includes('zone_f5_zZ-01_ctx'));
});

runTestCase('Case 3: Một khuyết tật có mảng nhiều ảnh cận cảnh cuPhotos sinh ra các key phân mảnh _cu_0, _cu_1, ...', () => {
  const defect = {
    defectCode: 'D-02',
    cuPhotos: [
      'https://cdn.example.com/cu_photo_0.jpg',
      'https://cdn.example.com/cu_photo_1.jpg',
      'https://cdn.example.com/cu_photo_2.jpg'
    ]
  };

  const fIdx = 1;
  const zCode = 'Z-02';
  const dCode = defect.defectCode;

  const photoKeys = defect.cuPhotos.map((_, cuIdx) => {
    return cuIdx === 0
      ? `defect_f${fIdx}_z${zCode}_d${dCode}_cu`
      : `defect_f${fIdx}_z${zCode}_d${dCode}_cu_${cuIdx}`;
  });

  assert.strictEqual(photoKeys.length, 3);
  assert.strictEqual(new Set(photoKeys).size, 3);
  assert.strictEqual(photoKeys[0], 'defect_f1_zZ-02_dD-02_cu');
  assert.strictEqual(photoKeys[1], 'defect_f1_zZ-02_dD-02_cu_1');
  assert.strictEqual(photoKeys[2], 'defect_f1_zZ-02_dD-02_cu_2');
});

// -----------------------------------------------------------------------------
// NHÓM 2: CÔ LẬP GÓC XOAY & HỆ THỐNG TRA CỨU VIOLATIONS_MAP ĐA CHIỀU
// -----------------------------------------------------------------------------
console.log('\n--- NHÓM 2: CÔ LẬP GÓC XOAY & TRA CỨU VIOLATIONS_MAP ĐA CHIỀU ---');

runTestCase('Case 4: Cô lập góc xoay - Xoay D-01 ở Tầng 1 không làm ảnh hưởng đến D-01 ở Tầng 2', () => {
  const stagedPhotoRotations: Record<string, number> = {};

  // Giả lập hàm setPhotoRotation theo composite key và photoUrl
  const setPhotoRotation = (key: string, angle: number, photoUrl?: string) => {
    stagedPhotoRotations[key] = angle;
    if (photoUrl) {
      stagedPhotoRotations[photoUrl] = angle;
    }
  };

  const keyFloor1 = 'defect_f0_zZ-01_dD-01_cu';
  const urlFloor1 = 'https://cdn.example.com/f0_d01.jpg';
  const keyFloor2 = 'defect_f1_zZ-01_dD-01_cu';
  const urlFloor2 = 'https://cdn.example.com/f1_d01.jpg';

  // Người dùng xoay ảnh ở tầng 1 thành 90 độ
  setPhotoRotation(keyFloor1, 90, urlFloor1);

  // Đọc lại góc xoay tầng 1
  const rotFloor1 = stagedPhotoRotations[keyFloor1] ?? 0;
  // Đọc lại góc xoay tầng 2
  const rotFloor2 = stagedPhotoRotations[keyFloor2] ?? 0;

  assert.strictEqual(rotFloor1, 90, 'Tầng 1 phải nhận đúng góc xoay 90 độ');
  assert.strictEqual(rotFloor2, 0, 'Tầng 2 phải giữ nguyên góc xoay 0 độ, không bị lây nhiễm');
  assert.strictEqual(stagedPhotoRotations[urlFloor1], 90, 'URL tầng 1 cũng được gán 90 độ song song');
  assert.strictEqual(stagedPhotoRotations[urlFloor2], undefined, 'URL tầng 2 chưa bị đụng chạm');
});

runTestCase('Case 5: Tra cứu violationsMap hỗ trợ đồng thời key, photoUrl, domElementId, photoCode', () => {
  // Mô phỏng cấu trúc indexing của violationsMap trong usePhotoOrientationAudit
  const mockViolations = [
    {
      key: 'defect_f2_zZ-01_dD-01_cu',
      photoCode: 'D-01-CU',
      photoUrl: 'https://cdn.example.com/f2_d01.jpg',
      domElementId: 'audit-photo-card-defect-f2-zZ-01-dD-01-cu',
      currentAngle: 0,
      suggestedRotation: 90,
      isStrict: false,
    }
  ];

  const violationsMap = new Map<string, any>();
  mockViolations.forEach(v => {
    violationsMap.set(v.key, v);
    if (v.photoUrl) violationsMap.set(v.photoUrl, v);
    if (v.domElementId) violationsMap.set(v.domElementId, v);
    if (v.photoCode) violationsMap.set(v.photoCode, v);
  });

  // Kiểm tra tra cứu qua các chiều khác nhau đều ra cùng 1 violation
  const byKey = violationsMap.get('defect_f2_zZ-01_dD-01_cu');
  const byUrl = violationsMap.get('https://cdn.example.com/f2_d01.jpg');
  const byDomId = violationsMap.get('audit-photo-card-defect-f2-zZ-01-dD-01-cu');
  const byCode = violationsMap.get('D-01-CU');

  assert.ok(byKey, 'Tìm theo key phải thành công');
  assert.ok(byUrl, 'Tìm theo URL phải thành công');
  assert.ok(byDomId, 'Tìm theo DOM Element ID phải thành công');
  assert.ok(byCode, 'Tìm theo photoCode phải thành công');
  assert.strictEqual(byKey, byUrl, 'Phải tham chiếu tới cùng 1 đối tượng');
  assert.strictEqual(byKey.suggestedRotation, 90);
});

// -----------------------------------------------------------------------------
// NHÓM 3: 4 TẦNG DỰ PHÒNG (4-TIER FALLBACK) & TƯƠNG THÍCH NGƯỢC 100%
// -----------------------------------------------------------------------------
console.log('\n--- NHÓM 3: 4 TẦNG DỰ PHÒNG & TƯƠNG THÍCH NGƯỢC 100% ---');

runTestCase('Case 6: Thứ tự ưu tiên 4 tầng: compositeKey > photoUrl > legacyKey > photoCode', () => {
  // Giả định hàm resolve rotation theo đúng spec 4 tầng
  const resolveRotation = (
    rotations: Record<string, number>,
    compositeKey: string,
    photoUrl?: string,
    legacyKey?: string,
    photoCode?: string
  ): number => {
    return rotations[compositeKey] ??
      (photoUrl ? rotations[photoUrl] : undefined) ??
      (legacyKey ? rotations[legacyKey] : undefined) ??
      (photoCode ? rotations[photoCode] : undefined) ?? 0;
  };

  // Kịch bản A: Cả 4 tầng đều có giá trị khác nhau -> Tầng 1 (compositeKey) thắng
  const rotA: Record<string, number> = {
    'defect_f0_zZ-01_dD-01_cu': 90,
    'https://cdn.example.com/img.jpg': 180,
    'defect_D-01_cu': 270,
    'D-01': 90
  };
  assert.strictEqual(resolveRotation(rotA, 'defect_f0_zZ-01_dD-01_cu', 'https://cdn.example.com/img.jpg', 'defect_D-01_cu', 'D-01'), 90);

  // Kịch bản B: Khuyết compositeKey -> Tầng 2 (photoUrl) thắng
  const rotB: Record<string, number> = {
    'https://cdn.example.com/img.jpg': 180,
    'defect_D-01_cu': 270,
    'D-01': 90
  };
  assert.strictEqual(resolveRotation(rotB, 'defect_f0_zZ-01_dD-01_cu', 'https://cdn.example.com/img.jpg', 'defect_D-01_cu', 'D-01'), 180);

  // Kịch bản C: Khuyết cả compositeKey và photoUrl -> Tầng 3 (legacyKey) thắng
  const rotC: Record<string, number> = {
    'defect_D-01_cu': 270,
    'D-01': 90
  };
  assert.strictEqual(resolveRotation(rotC, 'defect_f0_zZ-01_dD-01_cu', 'https://cdn.example.com/img.jpg', 'defect_D-01_cu', 'D-01'), 270);

  // Kịch bản D: Chỉ có photoCode -> Tầng 4 thắng
  const rotD: Record<string, number> = {
    'D-01': 90
  };
  assert.strictEqual(resolveRotation(rotD, 'defect_f0_zZ-01_dD-01_cu', 'https://cdn.example.com/img.jpg', 'defect_D-01_cu', 'D-01'), 90);

  // Kịch bản E: Không có bất kỳ key nào -> Trả về 0 mặc định
  assert.strictEqual(resolveRotation({}, 'defect_f0_zZ-01_dD-01_cu', 'https://cdn.example.com/img.jpg', 'defect_D-01_cu', 'D-01'), 0);
});

runTestCase('Case 7: Chống quét trùng (Double-Scanning Prevention) khi có mảng floors', () => {
  // Khi surveyData có `floors`, danh sách damageZones phẳng bên ngoài KHÔNG được quét thêm lần nữa
  const surveyData = {
    floors: [
      {
        floorName: 'Tầng 1',
        zones: [
          { zoneCode: 'Z-01', ctxPhotoUrl: 'https://cdn.example.com/z1.jpg', defects: [{ defectCode: 'D-01', cuPhotoUrl: 'https://cdn.example.com/d1.jpg' }] }
        ]
      }
    ],
    // Dữ liệu flat legacy nằm ngoài
    damageZones: [
      { zoneCode: 'Z-01', ctxPhotoUrl: 'https://cdn.example.com/z1.jpg', defects: [{ defectCode: 'D-01', cuPhotoUrl: 'https://cdn.example.com/d1.jpg' }] }
    ]
  };

  const hasFloors = Array.isArray(surveyData.floors) && surveyData.floors.length > 0;
  const auditedItems: any[] = [];
  const scannedUrls = new Set<string>();

  if (hasFloors) {
    surveyData.floors.forEach((f, fIdx) => {
      f.zones.forEach(z => {
        if (z.ctxPhotoUrl && !scannedUrls.has(z.ctxPhotoUrl)) {
          scannedUrls.add(z.ctxPhotoUrl);
          auditedItems.push({ key: `zone_f${fIdx}_z${z.zoneCode}_ctx`, url: z.ctxPhotoUrl });
        }
        z.defects.forEach(d => {
          if (d.cuPhotoUrl && !scannedUrls.has(d.cuPhotoUrl)) {
            scannedUrls.add(d.cuPhotoUrl);
            auditedItems.push({ key: `defect_f${fIdx}_z${z.zoneCode}_d${d.defectCode}_cu`, url: d.cuPhotoUrl });
          }
        });
      });
    });
  } else {
    // Chỉ chạy nhánh flat khi !hasFloors
    surveyData.damageZones.forEach(z => {
      if (z.ctxPhotoUrl && !scannedUrls.has(z.ctxPhotoUrl)) {
        scannedUrls.add(z.ctxPhotoUrl);
        auditedItems.push({ key: `zone_${z.zoneCode}_ctx`, url: z.ctxPhotoUrl });
      }
    });
  }

  // Kết quả: đúng 2 ảnh, không bị quét gấp đôi thành 4 ảnh
  assert.strictEqual(auditedItems.length, 2, 'Chỉ được có đúng 2 ảnh được thẩm định');
  assert.strictEqual(auditedItems[0].key, 'zone_f0_zZ-01_ctx');
  assert.strictEqual(auditedItems[1].key, 'defect_f0_zZ-01_dD-01_cu');
});

// -----------------------------------------------------------------------------
// NHÓM 4: ĐIỀU HƯỚNG TAB TẦNG & GIAO TIẾP SỰ KIỆN (UI EVENT DISPATCH)
// -----------------------------------------------------------------------------
console.log('\n--- NHÓM 4: ĐIỀU HƯỚNG TAB TẦNG & SỰ KIỆN AUDIT-SWITCH-FLOOR-TAB ---');

runTestCase('Case 8: Click vi phạm ở alert banner phát sinh đúng floorIndex và domElementId', () => {
  const violation = {
    key: 'defect_f3_zZ-01_dD-01_cu',
    floorIndex: 3,
    domElementId: 'audit-photo-card-defect-f3-zZ-01-dD-01-cu',
    suggestedRotation: 90
  };

  let dispatchedEventDetail: any = null;
  const mockDispatchEvent = (event: { detail: any }) => {
    dispatchedEventDetail = event.detail;
  };

  // Giả lập hàm handleNavigateToPhoto
  const handleNavigateToPhoto = (v: typeof violation) => {
    if (v.floorIndex !== undefined) {
      mockDispatchEvent({
        detail: {
          floorIndex: v.floorIndex,
          targetDomId: v.domElementId
        }
      });
    }
  };

  handleNavigateToPhoto(violation);

  assert.ok(dispatchedEventDetail, 'Sự kiện điều hướng phải được phát');
  assert.strictEqual(dispatchedEventDetail.floorIndex, 3, 'Phải chuyển tab sang Tầng 4 (floorIndex = 3)');
  assert.strictEqual(dispatchedEventDetail.targetDomId, 'audit-photo-card-defect-f3-zZ-01-dD-01-cu', 'Target DOM ID phải khớp chính xác');
});

// -----------------------------------------------------------------------------
// NHÓM 5: TÍCH HỢP BACKEND REPORT GENERATOR (RESIDENTIAL.FLOOR-BUILDER)
// -----------------------------------------------------------------------------
console.log('\n--- NHÓM 5: TÍCH HỢP BACKEND REPORT GENERATOR (BUILD_FLOOR_SURVEYS) ---');

runTestCase('Case 9: buildFloorSurveys ánh xạ đúng các góc xoay độc lập từ photoRotations vào ViewModel', () => {
  const surveyJson = {
    floors: [
      {
        id: 'floor_101',
        floorName: 'Tầng 1',
        cadSketchPhotoUrl: 'https://cdn.example.com/cad_f1.png',
        zones: [
          {
            id: 'zone_201',
            zoneCode: 'Z-01',
            ctxPhotoUrl: 'https://cdn.example.com/ctx_f1.jpg',
            defects: [
              {
                id: 'defect_301',
                defectCode: 'D-01',
                cuPhotoUrl: 'https://cdn.example.com/cu_f1_d01.jpg',
                cuPhotoCode: 'D-01-CU'
              }
            ]
          }
        ]
      },
      {
        id: '', // Không có id (như hồ sơ thực tế)
        floorName: 'Tầng 2',
        cadSketchPhotoUrl: 'https://cdn.example.com/cad_f2.png',
        zones: [
          {
            id: '',
            zoneCode: 'Z-01',
            ctxPhotoUrl: 'https://cdn.example.com/ctx_f2.jpg',
            defects: [
              {
                id: '',
                defectCode: 'D-01',
                cuPhotoUrl: 'https://cdn.example.com/cu_f2_d01.jpg',
                cuPhotoCode: 'D-01-CU'
              }
            ]
          }
        ]
      },
      {
        id: '',
        floorName: 'Tầng 3',
        cadSketchPhotoUrl: 'https://cdn.example.com/cad_f3.png',
        zones: [
          {
            zoneCode: 'Z-01',
            ctxPhotoUrl: 'https://cdn.example.com/ctx_f3.jpg',
            defects: [
              {
                defectCode: 'D-01',
                // Defect này test fallback qua URL
                cuPhotoUrl: 'https://cdn.example.com/cu_f3_d01_url_fallback.jpg',
                cuPhotoCode: 'D-01-CU'
              }
            ]
          }
        ]
      }
    ],
    photoRotations: {
      // Tầng 1 dùng id
      'defect_301_cu': 90,
      'zone_201_ctx': 180,
      'floor_floor_101_cad': 90,

      // Tầng 2 dùng composite key không có id: defect_f1_zZ-01_dD-01_cu
      'defect_f1_zZ-01_dD-01_cu': 270,
      'zone_f1_zZ-01_ctx': 90,
      'https://cdn.example.com/cad_f2.png': 180, // Test cadSketchPhotoUrl fallback

      // Tầng 3 dùng URL binding fallback
      'https://cdn.example.com/cu_f3_d01_url_fallback.jpg': 180
    }
  };

  const reportData = {
    floorSurveys: [],
    damageZones: [],
    structuralElements: []
  };

  const result = buildFloorSurveys(surveyJson, reportData);
  assert.strictEqual(result.floors.length, 3, 'Phải build đủ 3 tầng');

  const f0 = result.floors[0];
  const f1 = result.floors[1];
  const f2 = result.floors[2];

  // Kiểm tra tầng 1 (dùng id)
  assert.strictEqual(f0.zones[0].defects[0].cuPhotoRotation, 90, 'Tầng 1 defect cuPhotoRotation = 90');
  assert.strictEqual(f0.zones[0].ctxPhotoRotation, 180, 'Tầng 1 zone ctxPhotoRotation = 180');
  assert.strictEqual(f0.cadSketchRotation, 90, 'Tầng 1 cadSketchRotation = 90');

  // Kiểm tra tầng 2 (dùng composite key không có id)
  assert.strictEqual(f1.zones[0].defects[0].cuPhotoRotation, 270, 'Tầng 2 defect cuPhotoRotation = 270 (composite key cô lập)');
  assert.strictEqual(f1.zones[0].ctxPhotoRotation, 90, 'Tầng 2 zone ctxPhotoRotation = 90 (composite key cô lập)');
  assert.strictEqual(f1.cadSketchRotation, 180, 'Tầng 2 cadSketchRotation = 180 (qua cadSketchPhotoUrl fallback)');

  // Kiểm tra tầng 3 (dùng URL fallback)
  assert.strictEqual(f2.zones[0].defects[0].cuPhotoRotation, 180, 'Tầng 3 defect cuPhotoRotation = 180 (qua photoUrl fallback)');
});

runTestCase('Case 10: Toàn bộ quá trình phê duyệt và lưu diff không làm mất hoặc ghi đè photoRotations hiện có', () => {
  const existingSurveyJson = {
    photoRotations: {
      'p01': 90,
      'p02': 0,
      'defect_f0_zZ-01_dD-01_cu': 90
    }
  };

  const stagedRotations = {
    'defect_f1_zZ-01_dD-01_cu': 180,
    'https://cdn.example.com/new_photo.jpg': 180
  };

  // Giả lập logic merge trong handleSaveDiffFirst của AuditStudioModal
  const mergedRotations = {
    ...(existingSurveyJson.photoRotations || {}),
    ...stagedRotations
  };

  assert.strictEqual(Object.keys(mergedRotations).length, 5, 'Phải có đủ 5 mục sau khi merge');
  assert.strictEqual(mergedRotations['p01'], 90, 'p01 cũ được bảo toàn');
  assert.strictEqual(mergedRotations['defect_f0_zZ-01_dD-01_cu'], 90, 'Tầng 0 cũ được bảo toàn');
  assert.strictEqual(mergedRotations['defect_f1_zZ-01_dD-01_cu'], 180, 'Tầng 1 mới được bổ sung');
  assert.strictEqual(mergedRotations['https://cdn.example.com/new_photo.jpg'], 180, 'URL mới được bổ sung');
});

// -----------------------------------------------------------------------------
// TỔNG KẾT
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`📊 TỔNG KẾT TEST SUITE: ${passedCount} / ${passedCount + failedCount} PASSED (${failedCount} FAILED)`);
console.log('================================================================================\n');

if (failedCount > 0) {
  console.error(`💥 CÓ ${failedCount} TEST CASES THẤT BẠI! HÃY KIỂM TRA LẠI.`);
  process.exit(1);
} else {
  console.log('🎉 TOÀN BỘ CÁC TEST CASES ĐÃ ĐẠT CHUẨN 100%!');
  process.exit(0);
}
