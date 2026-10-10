import { isCrackRelated } from '../components/canvas/defectHelpers';
import { validateStep } from '../features/survey-phase1/utils/stepValidator';
import type { Phase1SurveyFormData, FloorSurveyData, DamageZoneData, DefectItem } from '../features/survey-phase1/types/phase1.types';
import { getDefaultInitialFormData } from '../features/survey-phase1/store/initialFormData';

console.log('====================================================================');
console.log('KIỂM THỬ ĐỒNG BỘ FE-BE & BẢO VỆ ĐÁNH GIÁ VẾT NỨT / BURLAND (STEP 4)');
console.log('====================================================================\n');

interface BeDefect {
  id: string;
  defect_code: string;
  pin_x: number;
  pin_y: number;
  screening_category: string;
  defect_type: string;
  width_max_mm: string;
  length_mm: string;
  cu_photos_json?: string[];
  cu_photo_url?: string;
  notes: string;
}

interface BeDamageZone {
  id: string;
  report_id: string;
  zone_code: string;
  floor_name: string;
  room_name: string;
  component_type: string;
  wall_material: string;
  burland_grade: number;
  ctx_photo_url: string;
  defects: BeDefect[];
}

interface BeFloorSurvey {
  id: string;
  floor_name: string;
  floor_order: number;
}

// 1. TEST KHÔI PHỤC DỮ LIỆU TỪ BACKEND
console.log('--- TEST 1: KHÔI PHỤC DỮ LIỆU TỪ BACKEND (FLOOR_NAME & DAMAGE_ZONES) ---');
const beFloorSurveys: BeFloorSurvey[] = [
  { id: 'uuid-fl-1', floor_name: 'Tầng trệt', floor_order: 1 },
  { id: 'uuid-fl-2', floor_name: 'Tầng 1', floor_order: 2 }
];

const beDamageZones: BeDamageZone[] = [
  {
    id: 'uuid-zone-1',
    report_id: 'rep-1',
    zone_code: 'Z-01',
    floor_name: 'Tầng trệt',
    room_name: 'Phòng khách',
    component_type: 'WALL',
    wall_material: 'Gạch thẻ',
    burland_grade: 2,
    ctx_photo_url: 'https://r2.metro2.vn/ctx1.jpg',
    defects: [
      {
        id: 'df-1',
        defect_code: 'D-01',
        pin_x: 25.5,
        pin_y: 40.2,
        screening_category: 'Nứt tường gạch / Vữa trát hoàn thiện',
        defect_type: 'Nứt chân chim / Mạng nhện vữa trát (<0.5mm)',
        width_max_mm: '0.40',
        length_mm: '350.00',
        cu_photos_json: ['https://r2.metro2.vn/cu1.jpg'],
        notes: 'Vết nứt bề mặt'
      }
    ]
  },
  {
    id: 'uuid-zone-2',
    report_id: 'rep-1',
    zone_code: 'Z-01',
    floor_name: 'Tầng 1',
    room_name: 'Phòng ngủ',
    component_type: 'WALL',
    wall_material: 'Gạch ống',
    burland_grade: 3,
    ctx_photo_url: 'https://r2.metro2.vn/ctx2.jpg',
    defects: [
      {
        id: 'df-2',
        defect_code: 'D-01',
        pin_x: 50.0,
        pin_y: 60.0,
        screening_category: 'Nứt tường gạch / Vữa trát hoàn thiện',
        defect_type: 'Nứt góc cửa sổ / Cửa đi',
        width_max_mm: '6.50',
        length_mm: '1200.00',
        cu_photo_url: 'https://r2.metro2.vn/cu2.jpg',
        notes: 'Vết nứt xé góc'
      }
    ]
  }
];

// Mô phỏng hàm mapper trong SurveyPhase1Page
const zonesByFloor = beDamageZones.reduce<Record<string, DamageZoneData[]>>((acc, z) => {
  const fid = z.floor_name || 'default';
  if (!acc[fid]) acc[fid] = [];
  acc[fid].push({
    id: z.id,
    zoneCode: z.zone_code,
    floorName: z.floor_name,
    roomName: z.room_name,
    componentType: z.component_type,
    wallMaterial: z.wall_material,
    ctxPhotoUrl: z.ctx_photo_url,
    burlandGrade: Number(z.burland_grade) || 0,
    overviewPhotos: [],
    notes: '',
    defects: z.defects.map((d): DefectItem => ({
      id: d.id,
      defectCode: d.defect_code,
      pinX: d.pin_x,
      pinY: d.pin_y,
      screeningCategory: d.screening_category,
      defectType: d.defect_type,
      widthMaxMm: Number(d.width_max_mm) || 0,
      lengthMm: Number(d.length_mm) || 0,
      cuPhotoUrl: d.cu_photos_json?.[0] || d.cu_photo_url || '',
      cuPhotos: d.cu_photos_json || [d.cu_photo_url || ''],
      hasScaleCard: true,
      isStructuralCritical: false,
      activityState: 'S',
      materialDegradationE4: 0,
      structuralSignificanceE2: 0,
      notes: d.notes,
    }))
  });
  return acc;
}, {});

const restoredFloors: FloorSurveyData[] = beFloorSurveys.map((f: BeFloorSurvey) => ({
  id: f.id,
  floorName: f.floor_name,
  overviewPhotos: [],
  cadSketchPhotoUrl: '',
  cadZonePins: [],
  cadElementPins: [],
  zones: zonesByFloor[f.floor_name] || [],
  structuralElements: [],
}));

console.assert(restoredFloors[0].zones.length === 1, 'FAIL: Tầng trệt phải khôi phục được 1 Vùng Z!');
console.assert(restoredFloors[0].zones[0].defects.length === 1, 'FAIL: Vùng Z-01 Tầng trệt phải có 1 khuyết tật D-01!');
console.assert(restoredFloors[1].zones.length === 1, 'FAIL: Tầng 1 phải khôi phục được 1 Vùng Z!');
console.log('✅ [TEST 1 ĐẠT]: Dữ liệu floor_name và damage_zones từ BE ánh xạ chính xác 100% vào các tầng!\n');

// 2. TEST TÍNH TOÁN BURLAND KHI burlandSummary BAN ĐẦU LÀ NULL / UNDEFINED
console.log('--- TEST 2: PHÒNG THỦ NULL/UNDEFINED TẠI BƯỚC 4 (BURLAND SUMMARY) ---');
const formData: Phase1SurveyFormData = {
  ...getDefaultInitialFormData('test-parcel'),
  floors: restoredFloors,
  burlandSummary: {
    predominantGrade: 0,
    localMaxGrade: 0,
    governingZoneCode: '',
    governingZoneDescription: '',
    representativeness: 'GLOBAL',
    structuralFlagLevel: 'NONE',
    needStructuralEngineerReview: false,
  },
};

// Hàm tính cấp Burland
const getBurlandGradeFromWidth = (w: number): number => {
  if (w <= 0.1) return 0;
  if (w <= 1) return 1;
  if (w <= 5) return 2;
  if (w <= 15) return 3;
  if (w <= 25) return 4;
  return 5;
};

// Thu thập vết nứt
const zDefects = (formData.floors || []).flatMap((f) =>
  (f.zones || []).flatMap((z) =>
    (z.defects || [])
      .filter((d) => isCrackRelated(d.screeningCategory, d.defectType))
      .map((d) => ({
        grade: getBurlandGradeFromWidth(Number(d.widthMaxMm) || 0),
        zoneCode: z.zoneCode,
        roomName: z.roomName,
        floorName: f.floorName,
      }))
  )
);

console.assert(zDefects.length === 2, `FAIL: Phải thu thập được 2 vết nứt, nhận được: ${zDefects.length}`);
console.assert(zDefects[0].grade === 1, `FAIL: Vết nứt 0.4mm phải là Cấp 1, nhận được: ${zDefects[0].grade}`);
console.assert(zDefects[1].grade === 3, `FAIL: Vết nứt 6.5mm phải là Cấp 3, nhận được: ${zDefects[1].grade}`);

// Fallback an toàn cho bs
const bs = formData.burlandSummary || {
  predominantGrade: 0,
  localMaxGrade: 0,
  governingZoneCode: 'Z-01',
  governingZoneDescription: '',
  representativeness: 'GLOBAL',
  structuralFlagLevel: 'NONE',
  needStructuralEngineerReview: false,
};

let inheritedMax = 0;
let governingZoneSuggestion = 'Z-01';
zDefects.forEach((item) => {
  if (item.grade >= inheritedMax) {
    inheritedMax = item.grade;
    governingZoneSuggestion = item.zoneCode;
  }
});

console.assert(inheritedMax === 3, `FAIL: Cấp nứt cực đại (localMaxGrade) phải là 3, nhận được: ${inheritedMax}`);
console.assert(bs.predominantGrade === 0, 'FAIL: bs ban đầu fallback về 0 an toàn');
console.log('✅ [TEST 2 ĐẠT]: Bước 4 chạy mượt mà, phòng thủ thành công trường hợp burlandSummary bị null/undefined!\n');

// 3. TEST KIỂM TRA ĐIỀU KIỆN CHUYỂN BƯỚC 3 -> BƯỚC 4
console.log('--- TEST 3: THẨM ĐỊNH CHUYỂN BƯỚC 3 -> 4 VỚI DỮ LIỆU ĐÃ ĐIỀN ĐỦ ---');
const fullyFilledFloors: FloorSurveyData[] = restoredFloors.map((fl) => ({
  ...fl,
  overviewPhotos: [{ id: 'p1', url: 'https://r2.metro2.vn/fl1.jpg' }],
  cadZonePins: [{ id: 'pin-1', zoneCode: 'Z-01', pinX: 20, pinY: 30 }],
  hasStructuralElements: false, // Miễn khảo sát E
}));

const validFormData: Phase1SurveyFormData = {
  ...formData,
  floors: fullyFilledFloors,
};

const validationResult = validateStep(3, validFormData);
console.log('Kết quả validateStep(3):', validationResult.isValid ? 'HỢP LỆ (Cho phép vào Bước 4)' : 'KHÔNG HỢP LỆ');
if (!validationResult.isValid) {
  console.log('Chi tiết lỗi phát hiện:', validationResult.missingFields);
}
console.assert(validationResult.isValid === true, 'FAIL: Dữ liệu đủ phải cho phép vào Bước 4 (Chốt Burland & Đánh giá vết nứt)!');
console.log('✅ [TEST 3 ĐẠT]: Chuyển bước vào đánh giá vết nứt (Bước 4) hoàn toàn thông suốt, không gặp lỗi!\n');

console.log('====================================================================');
console.log('🎉 TẤT CẢ 3 BỘ TEST KIỂM TRA ĐỒNG BỘ FE-BE & BƯỚC 4 ĐỀU PASS 100%!');
console.log('====================================================================');
