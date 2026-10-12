import {
  extractTimestampFromPhotoUrl,
  formatMetro2Timestamp,
  resolvePhotoTimestamp,
} from '../utils/photoTimestampHelper';

console.log('====================================================================');
console.log('KIỂM THỬ BẢO TOÀN THỜI GIAN CHỤP & WATERMARK ẢNH KHẢO SÁT HIỆN TRƯỜNG');
console.log('====================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

// -----------------------------------------------------------------------------
// TEST 1: Trích xuất Unix Timestamp (13 chữ số) từ URL ảnh Cloudflare R2 & Local ID
// -----------------------------------------------------------------------------
console.log('--- TEST 1: TRÍCH XUẤT TIMESTAMP TỪ ĐỊNH DẠNG URL VÀ TÊN FILE ---');

const testEpoch = 1712345678901; // Date: 2024-04-05T19:34:38.901Z
const expectedFormatted = formatMetro2Timestamp(testEpoch);

// Case 1.1: File R2 kết thúc bằng _<epoch>.jpg
const url1 = `https://pub-metro2.r2.dev/surveys/photos/p_HCM_M2_Z01_${testEpoch}.jpg`;
const epoch1 = extractTimestampFromPhotoUrl(url1);
assert(epoch1 === new Date(testEpoch).toISOString(), `Trích xuất từ URL kết thúc bằng _<epoch>.jpg (nhận được: ${epoch1})`);

// Case 1.2: File R2 có tiền tố __ và hậu tố __clean.jpg
const url2 = `https://pub-metro2.r2.dev/surveys/photos/HCM_M2__${testEpoch}__clean.jpg`;
const epoch2 = extractTimestampFromPhotoUrl(url2);
assert(epoch2 === new Date(testEpoch).toISOString(), `Trích xuất từ URL có dạng __<epoch>__clean.jpg (nhận được: ${epoch2})`);

// Case 1.3: Định danh IndexedDB local offline (photo_<epoch>_abc)
const localId = `photo_${testEpoch}_abc123`;
const epoch3 = extractTimestampFromPhotoUrl(localId);
assert(epoch3 === new Date(testEpoch).toISOString(), `Trích xuất từ IndexedDB local URI photo_<epoch>_uuid (nhận được: ${epoch3})`);

// Case 1.4: URL ảnh không chứa timestamp số hợp lệ
const noEpochUrl = 'https://pub-metro2.r2.dev/surveys/plans/ground_floor_cad.png';
const epoch4 = extractTimestampFromPhotoUrl(noEpochUrl);
assert(epoch4 === undefined, `URL không chứa timestamp phải trả về undefined (nhận được: ${epoch4})`);

// -----------------------------------------------------------------------------
// TEST 2: Cơ chế Thác đổ (Waterfall Resolution) của resolvePhotoTimestamp
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: NGUYÊN TẮC THÁC ĐỔ RESOLVE PHOTO TIMESTAMP ---');

// Case 2.1: Có timestamp tường minh (Explicit timestamp từ DB)
const explicitDate = '2024-04-05T08:30:00.000Z';
const resolved1 = resolvePhotoTimestamp(explicitDate, url1, '2024-04-01');
assert(
  resolved1 === formatMetro2Timestamp(explicitDate),
  `Ưu tiên 1: Lấy timestamp tường minh khi có sẵn (${resolved1})`
);

// Case 2.2: Không có timestamp tường minh nhưng URL có epoch
const resolved2 = resolvePhotoTimestamp(undefined, url1, '2024-04-01');
assert(
  resolved2 === expectedFormatted,
  `Ưu tiên 2: Trích xuất epoch từ URL khi không có explicit timestamp (${resolved2})`
);

// Case 2.3: Không có timestamp và URL không có epoch, nhưng có survey fallback date
const surveyFallback = '2024-04-05';
const resolved3 = resolvePhotoTimestamp(undefined, noEpochUrl, surveyFallback);
assert(
  resolved3 !== '' && resolved3.includes('05/04/2024'),
  `Ưu tiên 3: Dùng ngày bắt đầu ca khảo sát làm fallback khi ảnh không có metadata (${resolved3})`
);

// Case 2.4: Không có bất kỳ dữ kiện nào -> Tuyệt đối KHÔNG sinh new Date() hiện tại
const resolved4 = resolvePhotoTimestamp(undefined, noEpochUrl, undefined);
assert(
  resolved4 === '',
  `Bảo toàn tính pháp lý: Trả về chuỗi rỗng khi không có dữ liệu gốc, không tự tạo new Date() (${resolved4})`
);

// -----------------------------------------------------------------------------
// TEST 3: Giả lập ca khảo sát tiếp tục vào buổi tối (Scenario người dùng báo cáo)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: GIẢ LẬP KỊCH BẢN KHẢO SÁT SÁNG - ĐIỀU CHỈNH ĐIỂM GHIM TỐI ---');

// Buổi sáng 09:15:30 chụp ảnh tại hiện trường
const morningCaptureEpoch = new Date('2026-10-12T09:15:30.000+07:00').getTime();
const morningCaptureFormatted = formatMetro2Timestamp(morningCaptureEpoch);
const photoUrlFromMorning = `https://r2.metro2.vn/HCM_M2_Z01_E01_D01_${morningCaptureEpoch}.jpg`;

// Dữ liệu khuyết tật được lưu trên hệ thống
const defectItem = {
  id: 'defect-uuid-1',
  defectCode: 'D-01',
  capturedAt: new Date(morningCaptureEpoch).toISOString(),
  cuPhotoTimestamps: [new Date(morningCaptureEpoch).toISOString()],
  cuPhotoUrls: [photoUrlFromMorning],
};

// Buổi tối 21:45:00 surveyor mở laptop điều chỉnh lại điểm ghim (không chụp lại ảnh mới)
const eveningSessionTime = new Date('2026-10-12T21:45:00.000+07:00');
const eveningWatermark = resolvePhotoTimestamp(defectItem.capturedAt, defectItem.cuPhotoUrls[0]);

assert(
  eveningWatermark === morningCaptureFormatted,
  `Watermark hiển thị đúng thời gian chụp sáng (09:15:30) thay vì thời gian chỉnh sửa tối: ${eveningWatermark}`
);

// Kiểm tra kịch bản dữ liệu cũ (chưa có trường capturedAt, chỉ có URL ảnh cũ)
const legacyDefectWatermark = resolvePhotoTimestamp(undefined, defectItem.cuPhotoUrls[0]);
assert(
  legacyDefectWatermark === morningCaptureFormatted,
  `Khảo sát cũ chưa có capturedAt tự động trích xuất đúng thời gian sáng từ URL: ${legacyDefectWatermark}`
);

// -----------------------------------------------------------------------------
// TỔNG KẾT
// -----------------------------------------------------------------------------
console.log('\n====================================================================');
console.log(`KẾT QUẢ KIỂM THỬ: ${passCount} PASSED, ${failCount} FAILED`);
console.log('====================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
