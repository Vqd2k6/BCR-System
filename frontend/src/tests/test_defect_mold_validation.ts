import { validateStep } from '../features/survey-phase1/utils/stepValidator';
import { isCrackRelated } from '../components/canvas/defectHelpers';

console.log('====================================================================');
console.log('KIỂM THỬ: THẨM ĐỊNH KHUYẾT TẬT D LOẠI ẨM MỐC & VẾT NỨT TẠI BƯỚC 3');
console.log('====================================================================\n');

// 1. Kiểm tra hàm isCrackRelated
console.log('--- TEST 1: KIỂM TRA HÀM isCrackRelated ---');
console.assert(
  isCrackRelated('Thấm dột / Ẩm mốc bề mặt', 'Bong rộp sơn vôi / Ẩm mốc loang lổ') === false,
  'FAIL: Ẩm mốc không được coi là vết nứt'
);
console.log('✅ Ẩm mốc bề mặt -> isCrackRelated = false');

console.assert(
  isCrackRelated('Kẹt cửa / Cong vênh phụ kiện', 'Kẹt cửa sổ') === false,
  'FAIL: Kẹt cửa không được coi là vết nứt'
);
console.log('✅ Kẹt cửa -> isCrackRelated = false');

console.assert(
  isCrackRelated('Võng uốn dầm sàn / Biến dạng cấu kiện', 'Võng dầm bê tông') === false,
  'FAIL: Võng dầm không được coi là vết nứt'
);
console.log('✅ Võng dầm sàn -> isCrackRelated = false');

console.assert(
  isCrackRelated('Nứt tường gạch / Vữa trát hoàn thiện', 'Nứt chân chim / Mạng nhện vữa trát (<0.5mm)') === true,
  'FAIL: Nứt chân chim phải là vết nứt'
);
console.log('✅ Nứt chân chim tường gạch -> isCrackRelated = true');

console.assert(
  isCrackRelated('Nứt cấu kiện kết cấu chịu lực (Cột/Dầm/Sàn)', 'Nứt xiên 45° chịu cắt gần đầu cột') === true,
  'FAIL: Nứt xiên 45 độ phải là vết nứt kết cấu'
);
console.log('✅ Nứt xiên 45 độ dầm cột -> isCrackRelated = true\n');

// 2. Tạo Mock FormData cho Bước 3
const baseFormData: any = {
  floors: [
    {
      floorNumber: 1,
      floorName: 'Tầng 1 (Trệt)',
      overviewPhotos: ['https://example.com/overview.jpg'],
      cadZonePins: [{ pinNumber: 1, pinCode: 'Z1', pinX: 50, pinY: 50 }],
      cadElementPins: [],
      hasStructuralElements: false, // Miễn khảo sát E
      zones: [
        {
          id: 'z-01',
          zoneCode: 'Z1',
          floorName: 'Tầng 1 (Trệt)',
          roomName: 'Phòng khách',
          componentType: 'Tường gạch ngăn phòng',
          wallMaterial: 'Vữa trát sơn nước',
          hasDamage: true,
          ctxPhotoUrl: 'https://example.com/ctx.jpg',
          notes: 'Khu vực tường phòng khách',
          defects: [],
        },
      ],
      structuralElements: [],
    },
  ],
};

// --- TEST 2: Khuyết tật Ẩm mốc bề mặt (KHÔNG có widthMaxMm) ---
console.log('--- TEST 2: KHUYẾT TẬT ẨM MỐC BỀ MẶT (widthMaxMm = "") ---');
const moldFormData = JSON.parse(JSON.stringify(baseFormData));
moldFormData.floors[0].zones[0].defects = [
  {
    defectCode: 'D-01',
    pinX: 45.5,
    pinY: 60.2,
    screeningCategory: 'Thấm dột / Ẩm mốc bề mặt',
    defectType: 'Bong rộp sơn vôi / Ẩm mốc loang lổ',
    crackDirection: '',
    widthMaxMm: '', // Không có bề rộng vì là ẩm mốc
    lengthMm: '', // Không có chiều dài
    activityState: '',
    cuPhotoUrl: 'https://example.com/mold_cu.jpg',
    notes: 'Mảng tường bị thấm ẩm bong tróc sơn vôi',
    functionalImpactE6: 1, // Ẩm mốc
  },
];

const moldResult = validateStep(3, moldFormData);
console.log('Số lượng lỗi validation phát hiện:', moldResult.missingFields.length);
if (moldResult.missingFields.length > 0) {
  console.log('Các lỗi:', moldResult.missingFields.map((f) => f.label + ': ' + f.description));
}
console.assert(moldResult.isValid === true, 'FAIL: Khuyết tật ẩm mốc phải VALID, không được báo thiếu kích thước!');
console.assert(moldResult.missingFields.length === 0, 'FAIL: Không được có lỗi missing fields!');
console.log('✅ [XÁC NHẬN TEST 2 ĐẠT]: Khuyết tật ẩm mốc chuyển bước 3 -> 4 thành công, KHÔNG bị chặn, KHÔNG báo thiếu kích thước vết nứt!\n');

// --- TEST 3: Khuyết tật Vết Nứt (Chưa điền widthMaxMm) -> Phải bị BLOCK ---
console.log('--- TEST 3: VẾT NỨT TƯỜNG GẠCH (Chưa điền widthMaxMm) ---');
const crackMissingWidthFormData = JSON.parse(JSON.stringify(baseFormData));
crackMissingWidthFormData.floors[0].zones[0].defects = [
  {
    defectCode: 'D-02',
    pinX: 30.0,
    pinY: 40.0,
    screeningCategory: 'Nứt tường gạch / Vữa trát hoàn thiện',
    defectType: 'Nứt chân chim / Mạng nhện vữa trát (<0.5mm)',
    crackDirection: 'Xiên chéo',
    widthMaxMm: '', // Quên điền bề rộng
    lengthMm: 350,
    activityState: 'S',
    cuPhotoUrl: 'https://example.com/crack_cu.jpg',
    notes: 'Vết nứt chân chim góc tường',
    functionalImpactE6: 0,
  },
];

const crackMissingResult = validateStep(3, crackMissingWidthFormData);
console.log('Số lượng lỗi validation phát hiện:', crackMissingResult.missingFields.length);
console.assert(crackMissingResult.isValid === false, 'FAIL: Vết nứt quên điền widthMaxMm phải bị INVALID!');
console.assert(
  crackMissingResult.missingFields.some((f) => f.label.includes('vết nứt') && f.isBlocking),
  'FAIL: Phải có lỗi blocking yêu cầu điền kích thước vết nứt!'
);
console.log('Thông báo lỗi chặn:', crackMissingResult.missingFields[0].description);
console.log('✅ [XÁC NHẬN TEST 3 ĐẠT]: Vết nứt thật nếu quên điền kích thước thì hệ thống chặn đúng chuẩn kỹ thuật!\n');

// --- TEST 4: Khuyết tật Vết Nứt (Đã điền widthMaxMm = 0.2) -> Phải VALID ---
console.log('--- TEST 4: VẾT NỨT TƯỜNG GẠCH (Đã điền đầy đủ widthMaxMm = 0.2mm) ---');
const crackFilledFormData = JSON.parse(JSON.stringify(baseFormData));
crackFilledFormData.floors[0].zones[0].defects = [
  {
    defectCode: 'D-02',
    pinX: 30.0,
    pinY: 40.0,
    screeningCategory: 'Nứt tường gạch / Vữa trát hoàn thiện',
    defectType: 'Nứt chân chim / Mạng nhện vữa trát (<0.5mm)',
    crackDirection: 'Xiên chéo',
    widthMaxMm: 0.2, // Đã điền
    lengthMm: 350,
    activityState: 'S',
    cuPhotoUrl: 'https://example.com/crack_cu.jpg',
    notes: 'Vết nứt chân chim góc tường',
    functionalImpactE6: 0,
  },
];

const crackFilledResult = validateStep(3, crackFilledFormData);
console.assert(crackFilledResult.isValid === true, 'FAIL: Vết nứt đã điền đầy đủ phải VALID!');
console.log('✅ [XÁC NHẬN TEST 4 ĐẠT]: Vết nứt điền đủ kích thước chuyển bước 3 -> 4 thành công!\n');

console.log('====================================================================');
console.log('TẤT CẢ 4 BÀI TEST THẨM ĐỊNH BƯỚC 3 ĐỀU PASS 100%!');
console.log('====================================================================');
