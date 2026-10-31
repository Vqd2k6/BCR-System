/**
 * test_photo_sync_audit.ts
 * Kiểm thử Kiểm Tra Ảnh Phase 1: CTX kế thừa ảnh tổng quan chỉ tính 1 ảnh và
 * định nghĩa "đã đồng bộ" dùng chung giữa audit với badge trên thumbnail.
 * Dữ liệu mẫu theo đúng hồ sơ C&C-05-B-0002 (Z-03 Tầng trệt, Z-05 Tầng 1).
 */

import { auditSurveyPhotos } from '../features/survey-phase1/utils/photoSyncAudit';
import { isPersistedPhotoUrl } from '../core/storage/offlinePhotoStorage';
import { planOverviewPhotoRemoval } from '../components/common/photo-capture/domain/photoCollectionMutator';
import type { Phase1SurveyFormData } from '../features/survey-phase1/types/phase1.types';

console.log('🧪 BẮT ĐẦU KIỂM THỬ: Đồng nhất kiểm tra đồng bộ ảnh Phase 1\n');

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
  window: { localStorage: mockStorageObj, dispatchEvent: () => true },
});

const cloud = (name: string) => `https://pub-metro2.r2.dev/surveys/${name}.jpg`;
const BLOB_OV1 = 'blob:local://photo_1791020346198_gullw';
const BLOB_OV3 = 'blob:local://photo_1791020370388_zwnza';
const BLOB_Z05_OV4 = 'blob:local://photo_1791081053706_tothz';

const buildFormData = (floors: unknown[]): Phase1SurveyFormData =>
  ({ floors, signatures: {} }) as unknown as Phase1SurveyFormData;

const audit = (floors: unknown[]) => auditSurveyPhotos(buildFormData(floors), () => undefined);

let passed = 0;
const check = (name: string, condition: boolean, detail?: unknown) => {
  if (!condition) {
    throw new Error(`❌ ${name}: ${JSON.stringify(detail)}`);
  }
  passed++;
  console.log(`✅ ${name}`);
};

// TEST 1: Hồ sơ thật - 4 tham chiếu blob nhưng chỉ có 3 ảnh
const realCase = audit([
  {
    floorName: 'Tầng trệt',
    hasStructuralElements: false,
    zones: [
      {
        zoneCode: 'Z-03',
        roomName: 'Phòng bếp / Ăn',
        ctxPhotoUrl: BLOB_OV1,
        ctxPhotoCode: 'HCM_M2.[C&C-05-B-0002]_F00_Z-03_CTX_01',
        overviewPhotos: [BLOB_OV1, cloud('z03_2'), BLOB_OV3, cloud('z03_4')],
        defects: [],
      },
    ],
  },
  {
    floorName: 'Tầng 1',
    hasStructuralElements: false,
    zones: [
      {
        zoneCode: 'Z-05',
        ctxPhotoUrl: cloud('z05_1'),
        overviewPhotos: [cloud('z05_1'), cloud('z05_2'), cloud('z05_3'), BLOB_Z05_OV4],
        defects: [],
      },
    ],
  },
]);
check('Hồ sơ thật: 3 ảnh thiếu, không đếm trùng CTX', realCase.unsyncedPhotosCount === 3, realCase.unsyncedPhotos.map((p) => p.fieldTitle));
check('Hồ sơ thật: tổng 8 ảnh riêng biệt', realCase.totalPhotos === 8, realCase.allPhotos.map((p) => p.url));
check(
  'Dòng CTX ghi rõ dùng chung ảnh tổng quan #1',
  realCase.unsyncedPhotos.some((p) => p.url === BLOB_OV1 && p.fieldTitle.includes('dùng chung ảnh tổng quan #1')),
  realCase.unsyncedPhotos.map((p) => p.fieldTitle)
);
check(
  'Ảnh tổng quan #3 độc lập vẫn báo thiếu',
  realCase.unsyncedPhotos.some((p) => p.url === BLOB_OV3 && p.fieldTitle.includes('#3')),
  realCase.unsyncedPhotos.map((p) => p.fieldTitle)
);

// TEST 2: CTX chụp riêng, khác ảnh tổng quan -> vẫn là 2 ảnh
const separateCtx = audit([
  {
    floorName: 'Tầng trệt',
    hasStructuralElements: false,
    zones: [{ zoneCode: 'Z-01', ctxPhotoUrl: cloud('ctx_rieng'), overviewPhotos: [cloud('ov_1')], defects: [] }],
  },
]);
check('CTX khác ảnh tổng quan được tính 2 dòng', separateCtx.totalPhotos === 2, separateCtx.allPhotos.map((p) => p.fieldTitle));

// TEST 3: Cấu kiện E cũng không đếm trùng
const element = audit([
  {
    floorName: 'Tầng trệt',
    structuralElements: [
      { elementCode: 'E-01', ctxPhotoUrl: BLOB_OV1, overviewPhotos: [BLOB_OV1, cloud('e01_2')], defects: [] },
    ],
  },
]);
check('Cấu kiện E: CTX dùng chung chỉ tính 1 ảnh thiếu', element.unsyncedPhotosCount === 1 && element.totalPhotos === 2, element.allPhotos.map((p) => p.fieldTitle));

// TEST 4: Có mapping trên thiết bị thì cùng một ảnh được cả CTX lẫn tổng quan công nhận
mockLocalStorage.metro2_uploaded_photo_map = JSON.stringify({ photo_1791020346198_gullw: cloud('z03_1') });
const healed = audit([
  {
    floorName: 'Tầng trệt',
    hasStructuralElements: false,
    zones: [{ zoneCode: 'Z-03', ctxPhotoUrl: BLOB_OV1, overviewPhotos: [BLOB_OV1, BLOB_OV3], defects: [] }],
  },
]);
check('Có mapping: chỉ còn ảnh #2 chưa đồng bộ', healed.unsyncedPhotosCount === 1 && healed.unsyncedPhotos[0].url === BLOB_OV3, healed.unsyncedPhotos.map((p) => p.url));

// TEST 5: Định nghĩa "đã đồng bộ" dùng chung
check('URL Cloud là đã đồng bộ', isPersistedPhotoUrl(cloud('a')));
check('URL /uploads là đã đồng bộ', isPersistedPhotoUrl('/uploads/surveys/a.jpg'));
check('blob:local có mapping là đã đồng bộ', isPersistedPhotoUrl(BLOB_OV1));
check('blob:local không mapping là chưa đồng bộ', !isPersistedPhotoUrl(BLOB_OV3));
check('Blob URL phiên làm việc là chưa đồng bộ', !isPersistedPhotoUrl('blob:http://localhost:3000/abc'));
check('Base64 là chưa đồng bộ', !isPersistedPhotoUrl('data:image/jpeg;base64,AAAA'));
check('Giá trị rỗng là chưa đồng bộ', !isPersistedPhotoUrl('') && !isPersistedPhotoUrl(null));

// TEST 6: Hồ sơ C&C-05-B-0055 - khôi phục xong thì CTX và tổng quan dùng chung cùng hết thiếu
const BLOB_Z06_OV2 = 'blob:local://photo_1791014419280_rlt1j';
const BLOB_Z07_OV1 = 'blob:local://photo_1791014772612_bsj5i';
const floors0055 = [
  {
    floorName: 'Tầng trệt',
    hasStructuralElements: false,
    zones: [
      { zoneCode: 'Z-06', ctxPhotoUrl: cloud('z06_1'), overviewPhotos: [cloud('z06_1'), BLOB_Z06_OV2, cloud('z06_3')], defects: [] },
      { zoneCode: 'Z-07', ctxPhotoUrl: BLOB_Z07_OV1, overviewPhotos: [BLOB_Z07_OV1, cloud('z07_2')], defects: [] },
    ],
  },
];
const before0055 = audit(floors0055);
check('0055 trước khôi phục: 2 ảnh thiếu, CTX dùng chung chỉ 1 dòng', before0055.unsyncedPhotosCount === 2, before0055.unsyncedPhotos);

mockLocalStorage.metro2_uploaded_photo_map = JSON.stringify({
  photo_1791014419280_rlt1j: cloud('z06_2'),
  photo_1791014772612_bsj5i: cloud('z07_1'),
});
const after0055 = audit(floors0055);
check('0055 sau khôi phục: không còn dòng thiếu', after0055.unsyncedPhotosCount === 0, after0055.unsyncedPhotos);

// TEST 7: Xóa ảnh tổng quan không được làm đổi ảnh dưới ghim D (ca thật Z-03 thửa C&C-05-B-0002)
const Z03_LIST = [BLOB_OV1, cloud('z03_2'), BLOB_OV3, cloud('z03_4'), cloud('z03_5'), cloud('z03_6')];

const blockedCtx = planOverviewPhotoRemoval({ overviewPhotos: Z03_LIST, ctxPhotoUrl: BLOB_OV1, defectCount: 1, index: 0 });
check('Xóa CTX đang có ghim D: bị chặn', blockedCtx.blocked === 'CTX_HAS_PINS', blockedCtx);

const plainRemoval = planOverviewPhotoRemoval({ overviewPhotos: Z03_LIST, ctxPhotoUrl: BLOB_OV1, defectCount: 1, index: 1 });
check(
  'Xóa ảnh không phải CTX: CTX giữ nguyên, chỉ bỏ đúng ảnh đó',
  !plainRemoval.blocked && plainRemoval.ctxPhotoUrl === BLOB_OV1 && plainRemoval.overviewPhotos.length === 5 && !plainRemoval.overviewPhotos.includes(cloud('z03_2')),
  plainRemoval
);

const ctxNoPins = planOverviewPhotoRemoval({ overviewPhotos: Z03_LIST, ctxPhotoUrl: BLOB_OV1, defectCount: 0, index: 0 });
check('Xóa CTX chưa có ghim: CTX chuyển sang ảnh đầu', !ctxNoPins.blocked && ctxNoPins.ctxPhotoUrl === cloud('z03_2'), ctxNoPins);

const lastPhoto = planOverviewPhotoRemoval({ overviewPhotos: [BLOB_OV1], ctxPhotoUrl: BLOB_OV1, defectCount: 0, index: 0 });
check('Xóa ảnh cuối cùng: CTX rỗng', !lastPhoto.blocked && lastPhoto.ctxPhotoUrl === '' && lastPhoto.overviewPhotos.length === 0, lastPhoto);

console.log(`\n🎉 HOÀN TẤT: ${passed} kiểm thử đều đạt.`);
