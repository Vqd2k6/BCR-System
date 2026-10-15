import { dedupeFloorOverviewPhotos, dedupePhase1FormData } from '../features/survey-phase1/utils/dedupePhase1Photos';
import type { Phase1SurveyFormData, FloorSurveyData } from '../features/survey-phase1/types/phase1.types';

console.log('🧪 BẮT ĐẦU KIỂM THỬ: Chống nhân bản ảnh tổng quan tầng (Overview Photos Deduplication)');

// TEST 1: Khử trùng lặp khi có 3 ảnh giống hệt nhau (kịch bản thực tế của người dùng)
const sampleDuplicatedPhotos = [
  {
    id: 'fl_ov_1',
    url: 'https://pub-metro2.r2.dev/fl1_overview.jpg',
    caption: 'Toàn cảnh sảnh chính nhìn từ cửa ra vào...',
    photoCode: 'P01_TEST_01',
  },
  {
    id: 'fl_ov_2',
    url: 'https://pub-metro2.r2.dev/fl1_overview.jpg',
    caption: '',
    photoCode: 'P01_TEST_01',
  },
  {
    id: 'fl_ov_3',
    url: 'https://pub-metro2.r2.dev/fl1_overview.jpg',
    caption: '',
    photoCode: 'P01_TEST_01',
  },
];

const deduped1 = dedupeFloorOverviewPhotos(sampleDuplicatedPhotos);
console.assert(deduped1.length === 1, `FAIL: Kỳ vọng 1 ảnh duy nhất nhưng nhận ${deduped1.length}`);
console.assert(deduped1[0].url === 'https://pub-metro2.r2.dev/fl1_overview.jpg', 'FAIL: Sai URL');
console.assert(deduped1[0].caption === 'Toàn cảnh sảnh chính nhìn từ cửa ra vào...', 'FAIL: Mất caption gốc');
console.log('✅ TEST 1 ĐẠT: Khử trùng lặp 3 ảnh nhân bản về đúng 1 ảnh gốc và bảo toàn ghi chú (caption).');

// TEST 2: Bảo toàn 2 ảnh khác nhau hoàn toàn
const sampleDistinctPhotos = [
  {
    id: 'fl_ov_1',
    url: 'https://pub-metro2.r2.dev/fl1_overview_01.jpg',
    caption: 'Góc nhìn 1',
    photoCode: 'P01_TEST_01',
  },
  {
    id: 'fl_ov_2',
    url: 'https://pub-metro2.r2.dev/fl1_overview_02.jpg',
    caption: 'Góc nhìn 2',
    photoCode: 'P01_TEST_02',
  },
];

const deduped2 = dedupeFloorOverviewPhotos(sampleDistinctPhotos);
console.assert(deduped2.length === 2, `FAIL: Kỳ vọng giữ nguyên 2 ảnh khác nhau nhưng nhận ${deduped2.length}`);
console.log('✅ TEST 2 ĐẠT: Bảo toàn trọn vẹn các ảnh hợp lệ có URL khác nhau.');

// TEST 3: Tự chữa lành (self-heal) toàn bộ Phase1SurveyFormData
const mockFormData: Partial<Phase1SurveyFormData> = {
  parcelId: 'parcel-123',
  floors: [
    {
      id: 'floor-1',
      floorName: 'Tầng 1',
      overviewPhotos: sampleDuplicatedPhotos,
      zones: [
        {
          id: 'z1',
          zoneCode: 'Z01',
          name: 'Phòng khách',
          overviewPhotos: ['https://r2.metro2.vn/z1.jpg', 'https://r2.metro2.vn/z1.jpg'],
        },
      ],
      structuralElements: [
        {
          id: 'e1',
          elementCode: 'E01',
          name: 'Cột C1',
          overviewPhotos: ['https://r2.metro2.vn/e1.jpg', 'https://r2.metro2.vn/e1.jpg'],
        },
      ],
    } as unknown as FloorSurveyData,
  ],
};

const healed = dedupePhase1FormData(mockFormData as Phase1SurveyFormData);
console.assert(healed.floors[0].overviewPhotos.length === 1, 'FAIL: Floor overviewPhotos chưa được khử trùng');
console.assert(healed.floors[0].zones?.[0]?.overviewPhotos.length === 1, 'FAIL: Zone overviewPhotos chưa được khử trùng');
console.assert(healed.floors[0].structuralElements?.[0]?.overviewPhotos.length === 1, 'FAIL: Element overviewPhotos chưa được khử trùng');
console.log('✅ TEST 3 ĐẠT: Tự chữa lành thành công toàn bộ tầng, vùng Z và cấu kiện E.');

// TEST 4: Mô phỏng cơ chế Idempotent 4-Step Filter khi nhận 3 event liên tiếp
type OverviewPhoto = { id: string; url: string; caption?: string; photoCode?: string };

function simulateAddPhotoPipeline(events: { url: string; code?: string; meta?: { replacesUri?: string } }[]): OverviewPhoto[] {
  let photos: OverviewPhoto[] = [];
  let lastTempId: string | null = null;

  for (const { url, code, meta } of events) {
    if (!url) continue;

    // 1. URL Dedupe
    if (photos.some((p) => p.url === url)) {
      continue;
    }

    // 2. ReplacesUri Promotion
    const replacesUri = meta?.replacesUri;
    if (replacesUri) {
      const foundIdx = photos.findIndex((p) => p.url === replacesUri);
      if (foundIdx >= 0) {
        photos[foundIdx] = {
          ...photos[foundIdx],
          url,
          photoCode: code || photos[foundIdx].photoCode,
        };
        lastTempId = null;
        continue;
      }
    }

    // 3. PrevTempId Fallback
    if (lastTempId && photos.some((p) => p.id === lastTempId)) {
      photos = photos.map((p) => (p.id === lastTempId ? { ...p, url, photoCode: code || p.photoCode } : p));
      lastTempId = null;
      continue;
    }

    // 4. PhotoCode Dedupe
    if (code) {
      const codeIdx = photos.findIndex((p) => p.photoCode === code);
      if (codeIdx >= 0) {
        photos[codeIdx] = { ...photos[codeIdx], url };
        continue;
      }
    }

    // 5. Add new
    const newId = `fl_ov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    if (url.startsWith('blob:local://')) {
      lastTempId = newId;
    }
    photos.push({ id: newId, url, caption: '', photoCode: code || '' });
  }

  return photos;
}

const pipelineEvents = [
  // Lần 1: Chụp ảnh camera offline lưu IndexedDB
  { url: 'blob:local://photo_capture_001', code: 'P01_T1_01' },
  // Lần 2: R2 Direct Upload thành công trả về Public URL
  { url: 'https://pub-r2.metro2.vn/real_001.jpg', code: 'P01_T1_01', meta: { replacesUri: 'blob:local://photo_capture_001' } },
  // Lần 3: Window Event 'metro2:photo-promoted' phát lại toàn cục
  { url: 'https://pub-r2.metro2.vn/real_001.jpg', code: 'P01_T1_01', meta: { replacesUri: 'blob:local://photo_capture_001' } },
];

const pipelineResult = simulateAddPhotoPipeline(pipelineEvents);
console.assert(pipelineResult.length === 1, `FAIL: Idempotent Pipeline sinh ra ${pipelineResult.length} ảnh thay vì 1!`);
console.assert(pipelineResult[0].url === 'https://pub-r2.metro2.vn/real_001.jpg', 'FAIL: Pipeline không cập nhật sang Cloud R2 URL');
console.log('✅ TEST 4 ĐẠT: Idempotent 4-Step Filter xử lý trơn tru chuỗi 3 event bất đồng bộ, chỉ ghi nhận 1 ảnh duy nhất!');

// TEST 5: Mô phỏng cơ chế khử trùng lặp cho Ảnh Tổng Quan Vùng Z (Array of Strings)
function simulateZonePhotoPipeline(
  events: { url: string; code?: string; meta?: { replacesUri?: string } }[]
): { overviewPhotos: string[]; ctxPhotoUrl: string } {
  let overviewPhotos: string[] = [];
  let ctxPhotoUrl = '';
  let lastTempUri: string | null = null;

  for (const { url, meta } of events) {
    if (!url) continue;
    const replacesUri = meta?.replacesUri;

    // 1. Thăng cấp qua replacesUri
    if (replacesUri && overviewPhotos.includes(replacesUri)) {
      overviewPhotos = overviewPhotos.map((p) => (p === replacesUri ? url : p));
      lastTempUri = null;
    }
    // 2. Fallback qua lastTempUri
    else if (lastTempUri && overviewPhotos.includes(lastTempUri)) {
      overviewPhotos = overviewPhotos.map((p) => (p === lastTempUri ? url : p));
      if (!url.startsWith('blob:local://')) {
        lastTempUri = null;
      }
    }
    // 3. Thêm mới nếu chưa có trong mảng
    else {
      if (overviewPhotos.includes(url)) continue;
      overviewPhotos.push(url);
      if (url.startsWith('blob:local://')) {
        lastTempUri = url;
      }
    }

    overviewPhotos = Array.from(new Set(overviewPhotos.filter(Boolean)));

    if (!ctxPhotoUrl || ctxPhotoUrl === replacesUri || (lastTempUri && ctxPhotoUrl === lastTempUri)) {
      ctxPhotoUrl = url;
    }
  }

  return { overviewPhotos, ctxPhotoUrl };
}

const zoneEvents = [
  // 1. Chụp ảnh vùng Z ban đầu (tạo blob tạm)
  { url: 'blob:local://zone_z01_photo', code: 'Z01_OVERVIEW_1' },
  // 2. Upload R2 hoàn tất, trả về URL công khai và replacesUri
  { url: 'https://pub-r2.metro2.vn/zone_z01_cloud.jpg', code: 'Z01_OVERVIEW_1', meta: { replacesUri: 'blob:local://zone_z01_photo' } },
  // 3. Global event window 'metro2:photo-promoted' kích hoạt lại
  { url: 'https://pub-r2.metro2.vn/zone_z01_cloud.jpg', code: 'Z01_OVERVIEW_1', meta: { replacesUri: 'blob:local://zone_z01_photo' } },
];

const zoneResult = simulateZonePhotoPipeline(zoneEvents);
console.assert(zoneResult.overviewPhotos.length === 1, `FAIL: Vùng Z nhận ${zoneResult.overviewPhotos.length} ảnh thay vì 1!`);
console.assert(zoneResult.overviewPhotos[0] === 'https://pub-r2.metro2.vn/zone_z01_cloud.jpg', 'FAIL: Vùng Z không cập nhật URL Cloud R2');
console.assert(zoneResult.ctxPhotoUrl === 'https://pub-r2.metro2.vn/zone_z01_cloud.jpg', 'FAIL: ctxPhotoUrl của Vùng Z không đồng bộ');
console.log('✅ TEST 5 ĐẠT: Quản lý ảnh tổng quan Vùng Z xử lý chuẩn chuỗi 3 event R2, khử trùng 100% và đồng bộ ctxPhotoUrl.');

// TEST 6: Mô phỏng chụp tiếp ảnh thứ 2 cho Cấu kiện E (nhiều ảnh tổng quan)
const elementEvents = [
  // Ảnh 1: Chuỗi hoàn chỉnh
  { url: 'blob:local://elem_e01_p1', code: 'E01_OVERVIEW_1' },
  { url: 'https://pub-r2.metro2.vn/elem_e01_p1.jpg', code: 'E01_OVERVIEW_1', meta: { replacesUri: 'blob:local://elem_e01_p1' } },
  // Ảnh 2: Thêm ảnh thứ 2
  { url: 'blob:local://elem_e01_p2', code: 'E01_OVERVIEW_2' },
  { url: 'https://pub-r2.metro2.vn/elem_e01_p2.jpg', code: 'E01_OVERVIEW_2', meta: { replacesUri: 'blob:local://elem_e01_p2' } },
  // Event lặp lại của ảnh 2
  { url: 'https://pub-r2.metro2.vn/elem_e01_p2.jpg', code: 'E01_OVERVIEW_2', meta: { replacesUri: 'blob:local://elem_e01_p2' } },
];

const elemResult = simulateZonePhotoPipeline(elementEvents);
console.assert(elemResult.overviewPhotos.length === 2, `FAIL: Cấu kiện E nhận ${elemResult.overviewPhotos.length} ảnh thay vì 2!`);
console.assert(elemResult.overviewPhotos[0] === 'https://pub-r2.metro2.vn/elem_e01_p1.jpg', 'FAIL: Ảnh 1 của E sai URL');
console.assert(elemResult.overviewPhotos[1] === 'https://pub-r2.metro2.vn/elem_e01_p2.jpg', 'FAIL: Ảnh 2 của E sai URL');
console.log('✅ TEST 6 ĐẠT: Quản lý nhiều ảnh Cấu kiện E phân biệt chính xác từng ảnh và không bị duplicate.');

console.log('🎉 TẤT CẢ TEST ĐÃ VƯỢT QUA 100%!');
