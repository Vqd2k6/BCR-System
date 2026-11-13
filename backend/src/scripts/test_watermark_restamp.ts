/**
 * Kiểm thử dập lại watermark cho ảnh crop của ảnh có dấu cũ cháy sẵn.
 * Ảnh "dấu cũ" giả lập bằng chính bố cục BE (giống hệt bố cục FE cũ: logo góc trên phải, giờ + mã góc dưới phải).
 * Chạy: npx ts-node src/scripts/test_watermark_restamp.ts
 * Không đọc/ghi CSDL, không gọi mạng.
 */
import assert from 'assert';
import sharp from 'sharp';
import { autoRestampLayers, isZoneInside } from '../modules/photo-qc/photo-qc.rules';
import { isFieldPhotoUrl } from '../modules/report/services/legacy-watermark-index.service';
import { ReportImageResolver } from '../modules/report/services/report-image-resolver.service';
import { ReportWatermarkCanvasService, legacyLogoZone } from '../modules/report/services/report-watermark-canvas.service';
import { WatermarkDetectorService } from '../modules/report/services/watermark-detector.service';

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

const DATE = '04/10/2026 14:52:33';
const CODE = 'HCM_M2.1_[C&C-05-B-0028]_P03_SIDE_01';

/** Ảnh nền có vân (gradient + nhiễu) để giống ảnh chụp, không phải tường trơn. */
async function texturedPhoto(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const n = rnd() * 40;
      raw[i] = Math.min(255, 70 + (x / width) * 90 + n);
      raw[i + 1] = Math.min(255, 80 + (y / height) * 70 + n);
      raw[i + 2] = Math.min(255, 60 + n);
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
}

function toUri(buf: Buffer): string {
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}
function fromUri(uri: string): Buffer {
  return Buffer.from(uri.split(',')[1], 'base64');
}

async function cropLegacy(
  uri: string,
  crop: { x: number; y: number; w: number; h: number },
  legacyTrusted = false
): Promise<{ out: string; mode: string; reason: string }> {
  let mode = '?';
  let reason = '';
  const out = await ReportWatermarkCanvasService.cropStampRotate({
    base64Uri: uri,
    crop,
    dateTimeText: DATE,
    photoCodeText: CODE,
    stampLogo: false,
    stampText: false,
    legacyAuto: true,
    legacyTrusted,
    onLayersDecided: (l, why) => {
      reason = why;
      mode = l.logo && l.text ? 'BOTH' : l.logo ? 'LOGO' : l.text ? 'TEXT' : 'NONE';
    },
  });
  return { out, mode, reason };
}

async function main(): Promise<void> {
  console.log('Quy tắc thuần');
  await tc('isZoneInside / autoRestampLayers: trọn → không dập, cắt → dập', () => {
    const rect = { left: 0, top: 100, width: 1000, height: 900 };
    const logo = { left: 500, top: 10, width: 400, height: 120 };
    const text = { left: 400, top: 900, width: 550, height: 80 };
    assert.strictEqual(isZoneInside(text, rect), true);
    assert.strictEqual(isZoneInside(logo, rect), false);
    assert.deepStrictEqual(autoRestampLayers({ logo, text }, rect), { logo: true, text: false });
  });
  // 13/11/2026: sơ đồ CAD chụp tay cũng mang dấu PWA cũ (C&C-05-B-0038 tầng trệt bị dập 2 lớp) → mọi ảnh raster đều được dò.
  await tc('Mọi ảnh raster đều được dò logo (biên bản, sơ đồ CAD, bản vẽ); PDF thì không', () => {
    assert.strictEqual(isFieldPhotoUrl('https://x/surveys/C_C-05-B-0028/DOC/HCM_M2__C_C-05-B-0028__DOC_MINUTES_03_1793438837210_7e4b7c.jpg'), true);
    assert.strictEqual(isFieldPhotoUrl('https://x/surveys/C_C-05-B-0074/CAD_STRUCT/HCM_M2__C_C-05-B-0074__F04_CAD_STRUCT_01_1.jpg'), true);
    assert.strictEqual(isFieldPhotoUrl('https://x/surveys/C_C-04-B-0148/DRAWING/HCM_M2__C_C-04-B-0148__DOC_HOANCONG_DRAWING_01.jpg'), true);
    assert.strictEqual(isFieldPhotoUrl('https://x/surveys/C_C-04-B-0148/DRAWING/ban_ve.pdf'), false);
    assert.strictEqual(isFieldPhotoUrl('data:image/jpeg;base64,AAAA'), false);
  });

  const clean = await texturedPhoto(1500, 2000);
  const legacy = await ReportWatermarkCanvasService.stampImage({ base64Uri: toUri(clean), dateTimeText: DATE, photoCodeText: 'HCM_M2.[C&C-05-B-0028]_P03_SIDE_01' });
  assert.strictEqual(legacy.outcome, 'stamped');
  const legacyUri = legacy.uri;

  console.log('Bộ dò logo');
  await tc('Ảnh có dấu cũ → WATERMARKED, khung logo nằm góc trên phải', async () => {
    const t0 = Date.now();
    const d = await WatermarkDetectorService.detectLegacyLogo(fromUri(legacyUri));
    console.log(`     score ${d.score}, ${Date.now() - t0} ms, box ${JSON.stringify(d.logoBox)}`);
    assert.strictEqual(d.verdict, 'WATERMARKED');
    assert.ok(d.logoBox && d.logoBox.x > 0.4 && d.logoBox.y < 0.05 && d.logoBox.x + d.logoBox.w > 0.95);
  });
  await tc('Ảnh sạch → CLEAN', async () => {
    const d = await WatermarkDetectorService.detectLegacyLogo(clean);
    assert.strictEqual(d.verdict, 'CLEAN', `score ${d.score}`);
  });

  console.log('Crop ảnh có dấu cũ – tự quyết dập lại');
  await tc('Giữ trọn hai góc phải → không dập gì', async () => {
    const { mode } = await cropLegacy(legacyUri, { x: 0.25, y: 0, w: 0.75, h: 1 });
    assert.strictEqual(mode, 'NONE');
  });
  await tc('Cắt bỏ phần trên (mất logo) → chỉ dập logo, ảnh ra có logo', async () => {
    const { out, mode } = await cropLegacy(legacyUri, { x: 0, y: 0.25, w: 1, h: 0.75 });
    assert.strictEqual(mode, 'LOGO');
    const d = await WatermarkDetectorService.detectLegacyLogo(fromUri(out));
    assert.strictEqual(d.verdict, 'WATERMARKED', `ảnh crop phải có logo, score ${d.score}`);
  });
  await tc('Cắt bỏ phần dưới (mất giờ + mã) → chỉ dập chữ', async () => {
    const { mode } = await cropLegacy(legacyUri, { x: 0, y: 0, w: 1, h: 0.75 });
    assert.strictEqual(mode, 'TEXT');
  });
  await tc('Cắt giữa (mất cả hai) → dập cả logo lẫn chữ, ảnh ra có logo', async () => {
    const { out, mode } = await cropLegacy(legacyUri, { x: 0.1, y: 0.12, w: 0.8, h: 0.76 });
    assert.strictEqual(mode, 'BOTH');
    const d = await WatermarkDetectorService.detectLegacyLogo(fromUri(out));
    assert.strictEqual(d.verdict, 'WATERMARKED', `score ${d.score}`);
  });
  await tc('Cắt bỏ mép phải → dập cả hai', async () => {
    const { mode } = await cropLegacy(legacyUri, { x: 0, y: 0, w: 0.5, h: 1 });
    assert.strictEqual(mode, 'BOTH');
  });
  await tc('Cờ "dấu cũ" từ luật ngày nhưng pixel không có logo → dập đủ cả hai', async () => {
    const { out, mode } = await cropLegacy(toUri(clean), { x: 0.25, y: 0, w: 0.75, h: 1 });
    assert.strictEqual(mode, 'BOTH');
    const d = await WatermarkDetectorService.detectLegacyLogo(fromUri(out));
    assert.strictEqual(d.verdict, 'WATERMARKED', `score ${d.score}`);
  });
  await tc('Ảnh in xoay 90°: bỏ dải phải của ảnh in (= dải trên ảnh gốc) → chỉ dập logo', async () => {
    await ReportImageResolver.preloadAndResolveAll([{ url: legacyUri, rotation: 90 }]);
    const rotated = ReportImageResolver.resolveToBase64(legacyUri, 90);
    assert.ok(ReportImageResolver.getRotationOrigin(rotated), 'phải có rotationOrigin');
    const { mode } = await cropLegacy(rotated, { x: 0, y: 0, w: 0.75, h: 1 });
    assert.strictEqual(mode, 'LOGO');
  });

  await tc('Ảnh có dấu WATERMARKED → vùng logo theo khung bộ dò', async () => {
    const { reason } = await cropLegacy(legacyUri, { x: 0, y: 0.25, w: 1, h: 0.75 });
    assert.ok(reason.includes('theo bộ dò'), reason);
  });

  console.log('Ảnh được người xác nhận "có dấu cũ" (MANUAL / snapshot) – bộ dò không được lật kết luận');
  await tc('Bộ dò không thấy logo nhưng người đã xác nhận có dấu: giữ trọn 2 góc phải → không dập gì (trước đây dập cả hai)', async () => {
    const { mode, reason } = await cropLegacy(toUri(clean), { x: 0.25, y: 0, w: 0.75, h: 1 }, true);
    assert.strictEqual(mode, 'NONE', reason);
    assert.ok(reason.includes('bố cục chuẩn'), reason);
  });
  await tc('Người đã xác nhận có dấu: bỏ phần trên (mất logo), giữ chữ → chỉ dập logo theo vùng bố cục chuẩn', async () => {
    const { mode, reason } = await cropLegacy(toUri(clean), { x: 0, y: 0.25, w: 1, h: 0.75 }, true);
    assert.strictEqual(mode, 'LOGO', reason);
  });
  await tc('Người đã xác nhận có dấu: bỏ phần dưới (mất chữ), giữ logo → chỉ dập chữ', async () => {
    const { mode, reason } = await cropLegacy(toUri(clean), { x: 0, y: 0, w: 1, h: 0.75 }, true);
    assert.strictEqual(mode, 'TEXT', reason);
  });
  await tc('Người đã xác nhận có dấu: cắt giữa (mất cả hai) → dập cả hai', async () => {
    const { mode, reason } = await cropLegacy(toUri(clean), { x: 0.1, y: 0.12, w: 0.8, h: 0.76 }, true);
    assert.strictEqual(mode, 'BOTH', reason);
  });
  await tc('Ảnh dọc, người đã xác nhận có dấu, crop chỉ bỏ dải trái 25% (giữ góc logo) → không dập chồng logo', async () => {
    const { mode, reason } = await cropLegacy(toUri(clean), { x: 0.25, y: 0, w: 0.75, h: 1 }, true);
    assert.strictEqual(mode, 'NONE', reason);
  });
  await tc('legacyLogoZone = lõi cỡ logo nhỏ nhất, bám góc trên phải', () => {
    const z = legacyLogoZone(4000, 3000);
    const glow = Math.round(3000 * 0.014);
    assert.ok(Math.abs(z.width - (3000 * 0.4375 + 2 * glow)) < 1e-6);
    assert.ok(Math.abs(z.left + z.width - (4000 - 3000 * 0.025 + glow)) < 1e-6);
  });

  console.log(`\n${passed} ca đạt${process.exitCode ? ', CÓ CA LỖI' : ''}`);
}

main().catch((err) => {
  console.error('[test_watermark_restamp] Lỗi không mong đợi', err);
  process.exit(1);
});
