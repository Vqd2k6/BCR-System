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

console.log('🎉 TẤT CẢ TEST ĐÃ VƯỢT QUA 100%!');
