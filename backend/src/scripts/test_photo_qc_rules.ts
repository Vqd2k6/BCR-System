/**
 * Kiểm thử Photo QC – quy tắc thuần + hình học crop/xoay + pipeline cắt/dập dấu.
 * Chạy: npx ts-node src/scripts/test_photo_qc_rules.ts
 * Không đọc/ghi CSDL, không gọi mạng.
 */
import assert from 'assert';
import sharp from 'sharp';
import {
  assignSlotKeys,
  cropToNativeRect,
  isCropApplicable,
  isCoverEligibleKind,
  photoGroupFor,
  resolveReportKind,
  suggestRecaptureLevel,
  urlPhotoKey,
} from '../modules/photo-qc/photo-qc.rules';
import { parseFrozenPhotoQc } from '../modules/photo-qc/photo-qc.render';
import { ReportImageResolver } from '../modules/report/services/report-image-resolver.service';
import { ReportWatermarkCanvasService } from '../modules/report/services/report-watermark-canvas.service';

let passed = 0;
async function tc(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`, err);
    process.exitCode = 1;
  }
}

/** Ảnh W×H chia 4 góc phần tư màu khác nhau: TL đỏ, TR xanh lá, BL xanh dương, BR vàng. */
async function quadrantImage(W: number, H: number): Promise<Buffer> {
  const half = (c: [number, number, number], left: number, top: number) => ({
    input: { create: { width: W / 2, height: H / 2, channels: 3 as const, background: { r: c[0], g: c[1], b: c[2] } } },
    left,
    top,
  });
  return sharp({ create: { width: W, height: H, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([
      half([255, 0, 0], 0, 0),
      half([0, 255, 0], W / 2, 0),
      half([0, 0, 255], 0, H / 2),
      half([255, 255, 0], W / 2, H / 2),
    ])
    .png()
    .toBuffer();
}

async function avgColor(buf: Buffer): Promise<[number, number, number]> {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0;
  const n = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

async function main(): Promise<void> {
  console.log('Photo QC – rules');

  await tc('assignSlotKeys: P-03 lặp mang hậu tố #n', () => {
    assert.deepStrictEqual(assignSlotKeys(['P-01', 'P-03', 'P-03', 'P-04', 'P-03']), ['P-01', 'P-03', 'P-03#2', 'P-04', 'P-03#3']);
  });

  await tc('resolveReportKind', () => {
    assert.strictEqual(resolveReportKind('STANDALONE', null), 'HOUSE');
    assert.strictEqual(resolveReportKind('BUILDING_MASTER', null), 'MASTER');
    assert.strictEqual(resolveReportKind('CONDO_UNIT', 'MASTER'), 'M');
    assert.strictEqual(resolveReportKind('CONDO_UNIT', null), 'U');
  });

  await tc('Bìa P04 chỉ cho nhà dân và tòa mẹ', () => {
    assert.ok(isCoverEligibleKind('HOUSE') && isCoverEligibleKind('MASTER'));
    assert.ok(!isCoverEligibleKind('U') && !isCoverEligibleKind('M'));
  });

  await tc('Phân nhóm: căn U P-01..P-04 OUTDOOR, ảnh trong căn INDOOR', () => {
    assert.strictEqual(photoGroupFor('U', 'P-01', 'P'), 'OUTDOOR');
    assert.strictEqual(photoGroupFor('U', 'P-04', 'P'), 'OUTDOOR');
    assert.strictEqual(photoGroupFor('U', 'P-03#2', 'P'), 'OUTDOOR');
    assert.strictEqual(photoGroupFor('U', 'P-06', 'P'), 'INDOOR');
    assert.strictEqual(photoGroupFor('U', urlPhotoKey('https://x/a.jpg'), 'DEFECT'), 'INDOOR');
  });

  await tc('Phân nhóm: nhà dân P OUTDOOR trừ võng dầm P-06B, khuyết tật INDOOR', () => {
    assert.strictEqual(photoGroupFor('HOUSE', 'P-05-2', 'P'), 'OUTDOOR');
    assert.strictEqual(photoGroupFor('HOUSE', 'P-06B-1', 'P'), 'INDOOR');
    assert.strictEqual(photoGroupFor('HOUSE', 'U:abc', 'OVERVIEW'), 'INDOOR');
    assert.strictEqual(photoGroupFor('HOUSE', 'U:cad', 'CAD'), 'INDOOR');
  });

  await tc('Tái chiếu tọa độ điểm ghim khi crop CAD', () => {
    const crop = { x: 0.1, y: 0.25, w: 0.8, h: 0.5, ratio: '4:3' as const, rotationAtCrop: 0 };
    const pin = { code: 'Z-01', pinX: 35, pinY: 50 };
    const newX = Math.round(((pin.pinX - crop.x * 100) / crop.w) * 100) / 100;
    const newY = Math.round(((pin.pinY - crop.y * 100) / crop.h) * 100) / 100;
    assert.strictEqual(newX, 31.25);
    assert.strictEqual(newY, 50);
  });

  await tc('Gợi ý mức: chỉ cờ OUTDOOR → OUTDOOR_ONLY, có INDOOR → FULL, RESOLVED bỏ qua', () => {
    assert.strictEqual(suggestRecaptureLevel([]), 'NONE');
    assert.strictEqual(suggestRecaptureLevel([{ recapture: true, photoGroup: 'OUTDOOR', status: 'OPEN' }]), 'OUTDOOR_ONLY');
    assert.strictEqual(
      suggestRecaptureLevel([
        { recapture: true, photoGroup: 'OUTDOOR', status: 'OPEN' },
        { recapture: true, photoGroup: 'INDOOR', status: 'OPEN' },
      ]),
      'FULL'
    );
    assert.strictEqual(suggestRecaptureLevel([{ recapture: true, photoGroup: 'INDOOR', status: 'RESOLVED' }]), 'NONE');
  });

  await tc('Crop hết hiệu lực khi đổi URL / đổi góc, còn hiệu lực sau Studio Img', () => {
    const crop = { x: 0, y: 0, w: 1, h: 0.75, ratio: '4:3' as const, rotationAtCrop: 90 };
    assert.ok(isCropApplicable(crop, 'u1', 'u1', 90));
    assert.ok(!isCropApplicable(crop, 'u1', 'u1', 0));
    assert.ok(!isCropApplicable(crop, 'u1', 'u2', 90));
    assert.ok(isCropApplicable(crop, 'u1', 'studio1', 90, { studio1: { originalUrl: 'u1' } }));
  });

  await tc('parseFrozenPhotoQc: null / rỗng → không QC', () => {
    assert.strictEqual(parseFrozenPhotoQc(null), null);
    assert.strictEqual(parseFrozenPhotoQc({ coverSource: null, photos: [] }), null);
    const s = parseFrozenPhotoQc({ coverSource: 'P04', photos: [] });
    assert.strictEqual(s?.coverSource, 'P04');
  });

  console.log('Photo QC – hình học crop trên ảnh xoay (so với sharp)');
  const W = 400;
  const H = 300;
  const img = await quadrantImage(W, H);
  // Khung chọn đúng góc phần tư TRÊN-TRÁI của ảnh ĐÃ XOAY (như admin thấy).
  const topLeftOfRotated = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
  for (const deg of [0, 90, 180, 270]) {
    await tc(`deg=${deg}: cắt trên ảnh gốc rồi xoay = cắt trên ảnh đã xoay`, async () => {
      const rotated = await sharp(img).rotate(deg).png().toBuffer();
      const rm = await sharp(rotated).metadata();
      const rw = rm.width!;
      const rh = rm.height!;
      const expected = await sharp(rotated)
        .extract({
          left: Math.round(topLeftOfRotated.x * rw),
          top: Math.round(topLeftOfRotated.y * rh),
          width: Math.round(topLeftOfRotated.w * rw),
          height: Math.round(topLeftOfRotated.h * rh),
        })
        .png()
        .toBuffer();
      const rect = cropToNativeRect(topLeftOfRotated, W, H, deg);
      const actual = await sharp(img).extract(rect).rotate(deg).png().toBuffer();
      const [em, am] = await Promise.all([sharp(expected).metadata(), sharp(actual).metadata()]);
      assert.strictEqual(am.width, em.width);
      assert.strictEqual(am.height, em.height);
      assert.deepStrictEqual(await avgColor(actual), await avgColor(expected));
    });
  }

  console.log('Photo QC – pipeline cắt → dập dấu → xoay');
  await tc('cropStampRotate: ảnh xoay 90°, khung 3:4 trên ảnh đã xoay ra đúng kích thước và góc phần tư', async () => {
    const big = await quadrantImage(1600, 1200);
    const native = `data:image/png;base64,${big.toString('base64')}`;
    const rotated = await ReportImageResolver.rotateUncached(native, 90);
    // Đăng ký nguồn gốc xoay như preloadAndResolveAll làm khi nạp report.
    await ReportImageResolver.preloadAndResolveAll([{ url: native, rotation: 90 }]);
    const fromCache = ReportImageResolver.resolveToBase64(native, 90);
    assert.ok(ReportImageResolver.getRotationOrigin(fromCache), 'phải có rotationOrigin cho ảnh đã xoay');
    // Ảnh đã xoay 1200×1600; khung 3:4 ở nửa trên: 1200×(1600*0.5)=1200×800 → không 3:4, dùng w=0.5,h=0.5: 600×800 = 3:4.
    const out = await ReportWatermarkCanvasService.cropStampRotate({
      base64Uri: fromCache,
      crop: { x: 0, y: 0, w: 0.5, h: 0.5 },
      dateTimeText: '08/11/2026 10:00',
      photoCodeText: 'HCM_M2.1_TEST_P02_MAIN',
      stampLogo: true,
      stampText: true,
    });
    const meta = await sharp(Buffer.from(out.split(',')[1], 'base64')).metadata();
    assert.strictEqual(meta.width, 600);
    assert.strictEqual(meta.height, 800);
    // Góc phần tư trên-trái của ảnh xoay 90° là góc dưới-trái ảnh gốc (xanh dương); dấu chỉ phủ một phần nhỏ.
    const noStamp = await ReportWatermarkCanvasService.cropStampRotate({
      base64Uri: fromCache,
      crop: { x: 0, y: 0, w: 0.5, h: 0.5 },
      dateTimeText: '',
      photoCodeText: '',
      stampLogo: false,
      stampText: false,
    });
    const [r, g, b] = await avgColor(Buffer.from(noStamp.split(',')[1], 'base64'));
    assert.ok(b > 240 && r < 15 && g < 15, `màu trung bình ${r},${g},${b} phải là xanh dương`);
    assert.notStrictEqual(out, noStamp, 'bản có dấu phải khác bản không dấu');
    assert.ok(rotated.startsWith('data:image/'));
  });

  console.log(`\n${passed} ca đạt${process.exitCode ? ', CÓ CA LỖI' : ''}`);
}

main().catch((err) => {
  console.error('[test_photo_qc_rules] Lỗi không mong đợi', err);
  process.exit(1);
});
