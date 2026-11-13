/**
 * Kiểm thử sửa lỗi watermark 13/11/2026 (không cần DB, không gọi mạng: fetch và R2 đều giả lập).
 *   cd backend && TZ=UTC npx ts-node --transpile-only src/scripts/test_watermark_release_gate.ts
 *   cd backend && TZ=Asia/Ho_Chi_Minh npx ts-node --transpile-only src/scripts/test_watermark_release_gate.ts
 *
 * Phủ: kho ảnh theo lượt render (L1), log + phân loại lỗi tải và đọc R2 dự phòng (L3/3b), chốt chặn cứng (L2),
 * ảnh nghi ngờ dấu cũ + ngưỡng 1,15–4,5 + xác nhận tay theo URL (L4/L8), ảnh CAD được dò, hàm ngày theo giờ VN (L10).
 */
import assert from 'assert';
import sharp from 'sharp';
import type { ReportViewModel } from '../modules/report/report.types';
import { ReportImageResolver } from '../modules/report/services/report-image-resolver.service';
import { currentRenderImageScope, runWithRenderImageScope } from '../modules/report/services/report-image-scope';
import { ReportWatermarkCanvasService, WM_ISSUE_URI_PREFIX } from '../modules/report/services/report-watermark-canvas.service';
import { LegacyWatermarkIndex, isFieldPhotoUrl } from '../modules/report/services/legacy-watermark-index.service';
import { verdictOfScore } from '../modules/report/services/watermark-detector.service';
import { ReportService } from '../modules/report/services/report.service';
import { WatermarkIncompleteError } from '../common/errors/problem-details';
import { StorageService } from '../common/services/storage.service';
import { formatDateVi } from '../modules/report/mappers/formatters.mapper';

let passed = 0;
async function tc(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`);
    throw err;
  }
}

async function jpeg(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 140, g: 150, b: 160 } } }).jpeg().toBuffer();
}
const uri = (b: Buffer) => `data:image/jpeg;base64,${b.toString('base64')}`;

function vmWith(items: Array<{ url: string; base64?: string; code: string }>): ReportViewModel {
  return {
    metadata: { projectParcelCode: 'C&C-05-B-0038', surveyDateFormatted: '03/10/2026', reportNo: 'TEST' },
    appendix1: items.map((i) => ({
      photoCode: i.code,
      name: { vi: i.code, en: i.code },
      url: i.url,
      base64: i.base64,
      capturedAt: '3 thg 10, 2026 16:21:41',
      watermarkDateTime: '3 thg 10, 2026 16:21:41',
      metroPhotoCode: `HCM_M2.1_[C&C-05-B-0038]_${i.code}`,
      alreadyWatermarked: false,
    })),
    appendix2: [],
  } as unknown as ReportViewModel;
}

async function main(): Promise<void> {
  const big = await jpeg(400, 300);
  const tiny = await jpeg(60, 60);
  const realFetch = globalThis.fetch;
  const origBucket = StorageService.getPhotoBucket;
  const origGet = StorageService.getObjectBuffer;

  console.log('\n[1] Ngưỡng và phạm vi dò dấu cũ');
  await tc('Ngưỡng logo-v2: 1,10 sạch; 1,25 và 3,0 nghi ngờ; 5,0 có dấu', () => {
    assert.strictEqual(verdictOfScore(1.1), 'CLEAN');
    assert.strictEqual(verdictOfScore(1.25), 'UNSURE');
    assert.strictEqual(verdictOfScore(3.0), 'UNSURE');
    assert.strictEqual(verdictOfScore(5.0), 'WATERMARKED');
  });
  await tc('Ảnh CAD chụp tay của C&C-05-B-0038 được đưa vào bộ dò', () => {
    assert.strictEqual(isFieldPhotoUrl('https://x/surveys/C_C-05-B-0038/CAD_ARCH/HCM_M2__C_C-05-B-0038__F00_CAD_ARCH_01_1791019491903_d77d40.jpg'), true);
  });
  await tc('Ảnh chưa dò là NGHI NGỜ, không bao giờ bị coi là có dấu (không còn luật ngày)', () => {
    const url = 'https://x/surveys/OLD/HCM_M2__C_C-05-B-0001__EXT_P03_01_1790000000000_aaaaaa.jpg';
    assert.strictEqual(LegacyWatermarkIndex.has(url), false);
    assert.strictEqual(LegacyWatermarkIndex.statusOf(url)?.status, 'SUSPECT');
  });

  console.log('\n[2] Kho ảnh theo lượt render (L1)');
  await tc('Ảnh chưa nạp được ghi vào danh sách cần nạp, không trả ảnh chưa xoay thay ảnh đã xoay', async () => {
    await runWithRenderImageScope(async (scope) => {
      const url = 'https://x/a.jpg';
      scope.native.set(url, uri(big));
      assert.strictEqual(ReportImageResolver.resolveToBase64(url, 0), uri(big));
      assert.strictEqual(ReportImageResolver.resolveToBase64(url, 90), url);
      assert.deepStrictEqual([...(scope.requested.get(url) ?? [])], [90]);
    });
  });
  await tc('400 ảnh trong một lượt render: không ảnh nào bị đẩy ra (cache cũ chỉ giữ 300)', async () => {
    globalThis.fetch = (async () => new Response(new Uint8Array(big), { status: 200, headers: { 'content-type': 'image/jpeg' } })) as typeof fetch;
    await runWithRenderImageScope(async () => {
      const urls = Array.from({ length: 400 }, (_, i) => `https://x/many/${i}.jpg`);
      await ReportImageResolver.preloadRemoteImages(urls);
      const missing = urls.filter((u) => !ReportImageResolver.resolveToBase64(u).startsWith('data:image/'));
      assert.strictEqual(missing.length, 0);
    });
  });
  await tc('Hai lượt render song song có kho riêng, không thấy ảnh của nhau', async () => {
    await Promise.all([
      runWithRenderImageScope(async (s) => {
        s.native.set('https://x/only-a.jpg', uri(big));
        await new Promise((r) => setTimeout(r, 20));
        assert.ok(currentRenderImageScope()?.native.has('https://x/only-a.jpg'));
        assert.ok(!currentRenderImageScope()?.native.has('https://x/only-b.jpg'));
      }),
      runWithRenderImageScope(async (s) => {
        s.native.set('https://x/only-b.jpg', uri(big));
        await new Promise((r) => setTimeout(r, 10));
        assert.ok(!currentRenderImageScope()?.native.has('https://x/only-a.jpg'));
      }),
    ]);
  });

  console.log('\n[3] Lỗi tải ảnh và đọc R2 có xác thực (L3, 3b)');
  await tc('URL công khai lỗi 503 nhưng R2 có xác thực đọc được → nạp được, không chặn', async () => {
    globalThis.fetch = (async () => new Response('busy', { status: 503 })) as typeof fetch;
    StorageService.getPhotoBucket = () => 'bucket-test';
    StorageService.getObjectBuffer = async () => big;
    await runWithRenderImageScope(async (scope) => {
      await ReportImageResolver.preloadRemoteImages(['https://cdn.example/surveys/X/ok.jpg']);
      assert.ok(scope.native.has('https://cdn.example/surveys/X/ok.jpg'));
      assert.strictEqual(scope.failures.size, 0);
    });
  });
  await tc('r2.dev trả 429 hai lần (Retry-After: 0.1s) rồi 200 → chờ và nạp được, không chặn', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return calls <= 2
        ? new Response('slow down', { status: 429, headers: { 'retry-after': '0.1' } })
        : new Response(new Uint8Array(big), { status: 200, headers: { 'content-type': 'image/jpeg' } });
    }) as typeof fetch;
    StorageService.getObjectBuffer = async () => null;
    await runWithRenderImageScope(async (scope) => {
      await ReportImageResolver.preloadRemoteImages(['https://cdn.example/surveys/X/throttled.jpg']);
      assert.ok(scope.native.has('https://cdn.example/surveys/X/throttled.jpg'));
      assert.strictEqual(calls, 3);
    });
  });
  await tc('404 và R2 cũng không có key → lỗi NOT_FOUND (file mất, cần Admin thay ảnh)', async () => {
    globalThis.fetch = (async () => new Response('missing', { status: 404 })) as typeof fetch;
    StorageService.getObjectBuffer = async () => null;
    await runWithRenderImageScope(async (scope) => {
      await ReportImageResolver.preloadRemoteImages(['https://cdn.example/surveys/X/gone.jpg']);
      assert.strictEqual(scope.failures.get('https://cdn.example/surveys/X/gone.jpg')?.kind, 'NOT_FOUND');
    });
  });

  console.log('\n[4] Chốt chặn cứng (L2) và từng loại lỗi');
  await tc('Report có ảnh mất file, ảnh quá nhỏ, ảnh nghi ngờ → 3 lỗi, PDF bị chặn; ảnh sạch dập, ảnh có dấu cũ giữ nguyên', async () => {
    await runWithRenderImageScope(async (scope) => {
      const gone = 'https://cdn.example/surveys/X/P01_gone.jpg';
      const small = 'https://cdn.example/surveys/X/P02_small.jpg';
      const suspect = 'https://cdn.example/surveys/X/F00_CAD_ARCH_01.jpg';
      const clean = 'https://cdn.example/surveys/X/P03_clean.jpg';
      const legacy = 'https://cdn.example/surveys/X/P04_legacy.jpg';
      scope.failures.set(gone, { kind: 'NOT_FOUND', httpStatus: 404, message: 'Không còn file trên R2' });
      LegacyWatermarkIndex.rememberManual(small, false);
      LegacyWatermarkIndex.rememberManual(clean, false);
      LegacyWatermarkIndex.rememberManual(legacy, true);
      const vm = vmWith([
        { url: gone, base64: gone, code: 'P-01' },
        { url: small, base64: uri(tiny), code: 'P-02' },
        { url: suspect, base64: uri(big), code: 'P-03' },
        { url: clean, base64: uri(big), code: 'P-03' },
        { url: legacy, base64: uri(big), code: 'P-04' },
      ]);
      const report = await ReportWatermarkCanvasService.applyWatermarksToViewModel(vm, { stamp: true });
      assert.strictEqual(report.failed, 3);
      assert.strictEqual(report.stamped, 1);
      assert.strictEqual(report.legacy, 1);
      const byUrl = new Map(report.issues.map((i) => [i.url, i]));
      assert.strictEqual(byUrl.get(gone)?.reason, 'LOAD_FAILED');
      assert.strictEqual(byUrl.get(gone)?.fileMissing, true);
      assert.strictEqual(byUrl.get(small)?.reason, 'TOO_SMALL');
      assert.strictEqual(byUrl.get(suspect)?.reason, 'SUSPECT_LEGACY');
      assert.strictEqual(byUrl.get(suspect)?.needsLegacyConfirmation, true);
      // Ảnh lỗi trong bản xem trước được thay bằng khung đỏ, data URI mang số thứ tự lỗi để script gắn thanh nút.
      const suspectIndex = report.issues.findIndex((i) => i.url === suspect);
      assert.ok(vm.appendix1?.[2].base64?.startsWith(`${WM_ISSUE_URI_PREFIX}${suspectIndex};base64,`));
      assert.ok(vm.appendix1?.[0].base64?.startsWith(`${WM_ISSUE_URI_PREFIX}${report.issues.findIndex((i) => i.url === gone)};base64,`));
      // Ảnh nghi ngờ có ảnh đối chứng (toàn cảnh + 2 góc phải) cho người xác nhận; lỗi khác thì không.
      const pv = byUrl.get(suspect)?.preview;
      assert.ok(pv && [pv.full, pv.topRight, pv.bottomRight].every((u) => u.startsWith('data:image/jpeg;base64,')));
      assert.ok(!byUrl.get(gone)?.preview);
      // Khung ảnh nghi ngờ giữ ảnh gốc rõ nét (không làm mờ) và đúng tỉ lệ ảnh.
      const svg = Buffer.from(String(vm.appendix1?.[2].base64).split(',')[1], 'base64').toString();
      assert.ok(!svg.includes('opacity="0.55"'));
      assert.ok(svg.includes('viewBox="0 0 400 300"'), svg.slice(0, 120));
      // Ảnh có dấu cũ không bị dập thêm (giữ nguyên bytes).
      assert.strictEqual(vm.appendix1?.[4].base64, uri(big));
      assert.throws(() => ReportService.assertWatermarkComplete(report, 'nháp'), WatermarkIncompleteError);
      assert.throws(() => ReportService.assertWatermarkComplete(report, 'Rev'), WatermarkIncompleteError);
    });
  });
  await tc('Xác nhận tay theo URL: các ô cùng URL hết nghi ngờ, report đủ dấu thì không chặn', async () => {
    await runWithRenderImageScope(async () => {
      const shared = 'https://cdn.example/surveys/X/shared.jpg';
      LegacyWatermarkIndex.rememberManual(shared, false);
      const vm = vmWith([
        { url: shared, base64: uri(big), code: 'P-01' },
        { url: shared, base64: uri(big), code: 'P-04' },
      ]);
      const report = await ReportWatermarkCanvasService.applyWatermarksToViewModel(vm, { stamp: true });
      assert.strictEqual(report.failed, 0);
      assert.strictEqual(report.stamped, 2);
      assert.doesNotThrow(() => ReportService.assertWatermarkComplete(report, 'Rev'));
    });
  });
  await tc('Rev đã phát hành đọc trạng thái dấu cũ đóng băng, không đọc bảng sống', async () => {
    await runWithRenderImageScope(async (scope) => {
      const url = 'https://cdn.example/surveys/X/frozen.jpg';
      LegacyWatermarkIndex.rememberManual(url, false);
      scope.frozenLegacy = new Map([[url, true]]);
      assert.strictEqual(LegacyWatermarkIndex.statusOf(url)?.status, 'LEGACY');
      assert.strictEqual(LegacyWatermarkIndex.statusOf(url)?.source, 'FROZEN');
    });
  });
  await tc('Tắt watermark: không dập, không xét dấu cũ, nhưng ảnh không nạp được vẫn bị chặn', async () => {
    await runWithRenderImageScope(async (scope) => {
      const gone = 'https://cdn.example/surveys/X/nowm_gone.jpg';
      scope.failures.set(gone, { kind: 'TIMEOUT', httpStatus: null, message: 'Quá thời gian' });
      const vm = vmWith([
        { url: 'https://cdn.example/surveys/X/nowm_suspect.jpg', base64: uri(big), code: 'P-01' },
        { url: gone, base64: gone, code: 'P-02' },
      ]);
      const report = await ReportWatermarkCanvasService.applyWatermarksToViewModel(vm, { stamp: false });
      assert.strictEqual(report.failed, 1);
      assert.strictEqual(report.issues[0].reason, 'LOAD_FAILED');
      assert.strictEqual(report.issues[0].fileMissing, false);
    });
  });

  console.log('\n[5] Ngày theo giờ Việt Nam (L10)');
  await tc('formatDateVi không phụ thuộc múi giờ máy chủ', () => {
    assert.strictEqual(formatDateVi(new Date('2026-10-02T18:30:00Z')), '03/10/2026');
    assert.strictEqual(formatDateVi(new Date('2026-10-03T09:24:51Z'), true), '03/10/2026 (16:24)');
    assert.strictEqual(formatDateVi('2026-10-03'), '03/10/2026');
    assert.strictEqual(formatDateVi('2026-10-03T16:24:00', true), '03/10/2026 (16:24)');
    assert.strictEqual(formatDateVi('03/10/2026'), '03/10/2026');
  });

  globalThis.fetch = realFetch;
  StorageService.getPhotoBucket = origBucket;
  StorageService.getObjectBuffer = origGet;
  console.log(`\n✅ ĐẠT – ${passed} ca (TZ=${process.env.TZ || 'mặc định'})`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('[test_watermark_release_gate] THẤT BẠI', err);
  process.exit(1);
});
