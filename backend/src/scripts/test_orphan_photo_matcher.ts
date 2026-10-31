/**
 * test_orphan_photo_matcher.ts
 * Kiểm thử bộ ghép ảnh mồ côi. Dữ liệu theo đúng hồ sơ C&C-05-B-0002 (Z-03 Tầng trệt, Z-05 Tầng 1).
 */
import { collectOrphanTargets, matchOrphanTargets } from '../modules/survey/orphan-photo-matcher';

const BASE = 'https://pub-test.r2.dev';
const FOLDER = 'surveys/C_C-05-B-0002/CTX';
const name = (zone: string, seq: string, epoch: number, hex: string) =>
  `${FOLDER}/HCM_M2__C_C-05-B-0002__${zone}_CTX_${seq}_${epoch}_${hex}.jpg`;
const cloud = (key: string) => `${BASE}/${key}`;
const Z03 = `${FOLDER}/HCM_M2__C_C-05-B-0002__F00_Z-03_CTX_`;
const Z05 = `${FOLDER}/HCM_M2__C_C-05-B-0002__F01_Z-05_CTX_`;

const OV1 = 'photo_1791020346198_gullw';
const OV3 = 'photo_1791020370388_zwnza';
const OV4 = 'photo_1791081053706_tothz';

const z03_2 = name('F00_Z-03', '02', 1791020357139, '3fc051');
const z03_4 = name('F00_Z-03', '04', 1791020379411, 'bea30b');
const z05_3 = name('F01_Z-05', '03', 1791081048655, '48824d');
const z05_5 = name('F01_Z-05', '05', 1791081058271, '3677fe');

const draft = {
  _photoMappings: {},
  floors: [
    {
      zones: [
        {
          zoneCode: 'Z-03',
          ctxPhotoUrl: `blob:local://${OV1}`,
          ctxPhotoCode: 'HCM_M2.[C&C-05-B-0002]_F00_Z-03_CTX_01',
          overviewPhotos: [`blob:local://${OV1}`, cloud(z03_2), `blob:local://${OV3}`, cloud(z03_4)],
        },
      ],
    },
    {
      zones: [
        {
          zoneCode: 'Z-05',
          overviewPhotos: [cloud(z05_3), `blob:local://${OV4}`, cloud(z05_5)],
        },
      ],
    },
  ],
};

let passed = 0;
const check = (label: string, condition: boolean, detail?: unknown) => {
  if (!condition) throw new Error(`❌ ${label}: ${JSON.stringify(detail)}`);
  passed++;
  console.log(`✅ ${label}`);
};

const { targets, referencedKeys } = collectOrphanTargets(draft);
const byId = Object.fromEntries(targets.map((t) => [t.localId, t]));
check('CTX trùng ID ảnh #1 chỉ tạo 1 mục, có đủ ngữ cảnh', targets.length === 3 && byId[OV1].listPrefix === Z03, targets);
check('Mốc trên của ảnh #1 là ảnh #2', byId[OV1].nextCaptureMs === 1791020357139, byId[OV1]);
check('Mốc trên của ảnh Z-05 #4 là ảnh kế tiếp', byId[OV4].nextCaptureMs === 1791081058271, byId[OV4]);

const orphan1 = name('F00_Z-03', '01', 1791020346450, 'aaaaaa');
const orphan3 = name('F00_Z-03', '03', 1791020370600, 'bbbbbb');
const orphan4 = name('F01_Z-05', '04', 1791081053900, 'cccccc');

const happy = matchOrphanTargets(
  targets,
  { [Z03]: [z03_2, z03_4, orphan1, orphan3], [Z05]: [z05_3, z05_5, orphan4] },
  referencedKeys,
  ''
);
check('Hồ sơ thật: cứu đủ 3 ảnh', Object.keys(happy.recovered).length === 3 && happy.unresolved.length === 0, happy);
check('Ảnh #1 gắn đúng object', happy.recovered[OV1].url === cloud(orphan1), happy.recovered[OV1]);
check('Ảnh #3 gắn đúng object', happy.recovered[OV3].url === cloud(orphan3), happy.recovered[OV3]);

const none = matchOrphanTargets(targets, { [Z03]: [z03_2, z03_4] }, referencedKeys, '');
check('Không có object: giữ blob, không gán ảnh đã dùng', Object.keys(none.recovered).length === 0 && none.unresolved.every((u) => u.reason === 'NO_CANDIDATE'), none);

const outside = matchOrphanTargets(
  targets,
  { [Z03]: [name('F00_Z-03', '01', 1791020000000, 'dddddd'), name('F00_Z-03', '03', 1791020900000, 'eeeeee')] },
  referencedKeys,
  ''
);
check('Object ngoài khung thời gian không được nhận', Object.keys(outside.recovered).length === 0, outside);

const dup = matchOrphanTargets(
  [byId[OV3]],
  { [Z03]: [name('F00_Z-03', '07', 1791020370500, 'f1f1f1'), name('F00_Z-03', '08', 1791020370700, 'f2f2f2')] },
  referencedKeys,
  ''
);
check('2 ứng viên không phân xử được: giữ blob', Object.keys(dup.recovered).length === 0 && dup.unresolved[0].reason === 'AMBIGUOUS', dup);

const bySeq = matchOrphanTargets(
  [byId[OV3]],
  { [Z03]: [name('F00_Z-03', '03', 1791020370500, 'f1f1f1'), name('F00_Z-03', '08', 1791020370700, 'f2f2f2')] },
  referencedKeys,
  ''
);
check('2 ứng viên có đúng 1 khớp số thứ tự: nhận', bySeq.recovered[OV3]?.key.includes('CTX_03_'), bySeq);

const conflictTargets = [
  { ...byId[OV1], nextCaptureMs: 1791020400000, expectedSeq: null },
  { ...byId[OV3], capturedAtMs: 1791020346198, nextCaptureMs: 1791020400000, expectedSeq: null },
];
const conflict = matchOrphanTargets(conflictTargets, { [Z03]: [orphan1] }, new Set(), '');
check('2 ảnh tranh 1 object: không nhận ảnh nào', Object.keys(conflict.recovered).length === 0 && conflict.unresolved.every((u) => u.reason === 'CONFLICT'), conflict);

const ctxOnly = collectOrphanTargets({
  ctxPhotoUrl: `blob:local://${OV1}`,
  ctxPhotoCode: 'HCM_M2.[C&C-05-B-0002]_F00_Z-03_CTX_01',
});
check('CTX không có ảnh anh em: suy tiền tố từ mã ảnh', ctxOnly.targets[0].listPrefix === Z03, ctxOnly.targets);

const known = collectOrphanTargets(draft, { [OV1]: cloud(orphan1) });
check('Ảnh đã có mapping thì bỏ qua', !known.targets.some((t) => t.localId === OV1), known.targets);

// Hồ sơ C&C-05-B-0055: Z-06 mất ảnh #2, Z-07 mất ảnh #1 đang là CTX mang ghim D-01
const FOLDER_55 = 'surveys/C_C-05-B-0055/CTX';
const name55 = (zone: string, seq: string, epoch: number, hex: string) =>
  `${FOLDER_55}/HCM_M2__C_C-05-B-0055__F00_${zone}_CTX_${seq}_${epoch}_${hex}.jpg`;
const Z06_OV2 = 'photo_1791014419280_rlt1j';
const Z07_OV1 = 'photo_1791014772612_bsj5i';
const z06Keys = [name55('Z-06', '01', 1791014411289, '30e8e3'), name55('Z-06', '03', 1791014427115, 'ef7ef8'), name55('Z-06', '04', 1791014445191, '41f72d')];
const z07Key2 = name55('Z-07', '02', 1791014775109, '421beb');
const z06Orphan = name55('Z-06', '02', 1791014419282, 'aaaa01');
const z07Orphan = name55('Z-07', '01', 1791014772614, 'aaaa02');

const draft55 = {
  _photoMappings: {},
  floors: [
    {
      zones: [
        {
          zoneCode: 'Z-06',
          ctxPhotoUrl: cloud(z06Keys[0]),
          overviewPhotos: [cloud(z06Keys[0]), `blob:local://${Z06_OV2}`, cloud(z06Keys[1]), cloud(z06Keys[2])],
        },
        {
          zoneCode: 'Z-07',
          ctxPhotoUrl: `blob:local://${Z07_OV1}`,
          ctxPhotoCode: 'HCM_M2.[C&C-05-B-0055]_F00_Z-07_CTX_01',
          overviewPhotos: [`blob:local://${Z07_OV1}`, cloud(z07Key2)],
        },
      ],
    },
  ],
};

const collected55 = collectOrphanTargets(draft55);
check('0055: 3 tham chiếu blob chỉ là 2 ảnh', collected55.targets.length === 2, collected55.targets);

const matched55 = matchOrphanTargets(
  collected55.targets,
  {
    [`${FOLDER_55}/HCM_M2__C_C-05-B-0055__F00_Z-06_CTX_`]: [...z06Keys, z06Orphan],
    [`${FOLDER_55}/HCM_M2__C_C-05-B-0055__F00_Z-07_CTX_`]: [z07Key2, z07Orphan],
  },
  collected55.referencedKeys,
  ''
);
check(
  '0055: mỗi ảnh ghép đúng object của vùng mình',
  matched55.recovered[Z06_OV2]?.key === z06Orphan && matched55.recovered[Z07_OV1]?.key === z07Orphan && matched55.unresolved.length === 0,
  matched55
);

const noObject55 = matchOrphanTargets(collected55.targets, {}, collected55.referencedKeys, '');
check('0055: kho không có object thì giữ blob, không lấy ảnh #2 thay CTX', Object.keys(noObject55.recovered).length === 0, noObject55);

// Snapshot hiện tại của Z-03 thửa C&C-05-B-0002: 6 ảnh, CTX trùng ảnh #1 đang mang ghim D-01
const z03Orphan1 = name('F00_Z-03', '01', 1791020346200, 'bbbb01');
const z03Orphan3 = name('F00_Z-03', '03', 1791020370390, 'bbbb03');
const z03Six = collectOrphanTargets({
  zones: [
    {
      zoneCode: 'Z-03',
      ctxPhotoUrl: `blob:local://${OV1}`,
      ctxPhotoCode: 'HCM_M2.[C&C-05-B-0002]_F00_Z-03_CTX_01',
      overviewPhotos: [
        `blob:local://${OV1}`,
        cloud(z03_2),
        `blob:local://${OV3}`,
        cloud(z03_4),
        cloud(name('F00_Z-03', '05', 1791020392439, '0869bd')),
        cloud(name('F00_Z-03', '06', 1791020404404, '0828f5')),
      ],
    },
  ],
});
const z03SixMatched = matchOrphanTargets(z03Six.targets, { [Z03]: [z03_2, z03_4, z03Orphan1, z03Orphan3] }, z03Six.referencedKeys, '');
check(
  'Z-03 đủ 6 ảnh: CTX và #1 cùng ghép 1 object, #3 ghép object riêng',
  z03Six.targets.length === 2 && z03SixMatched.recovered[OV1]?.key === z03Orphan1 && z03SixMatched.recovered[OV3]?.key === z03Orphan3,
  z03SixMatched
);

console.log(`\n🎉 HOÀN TẤT: ${passed} kiểm thử đều đạt.`);
