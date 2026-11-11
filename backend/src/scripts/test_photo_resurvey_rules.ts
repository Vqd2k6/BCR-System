/**
 * Kiểm thử Khảo sát bổ sung (chụp lại ảnh ngoài nhà) – quy tắc thuần + lớp phủ ViewModel.
 * Chạy: npx ts-node src/scripts/test_photo_resurvey_rules.ts
 * Không đọc/ghi CSDL, không gọi mạng.
 */
import assert from 'assert';
import { StorageService } from '../common/services/storage.service';
import { extractPhotoDateTime, formatWatermarkDateTime } from '../modules/report/mappers/formatters.mapper';
import type { ReportViewModel } from '../modules/report/report.types';
import { applyResurveyToViewModel, parseFrozenResurvey } from '../modules/photo-resurvey/photo-resurvey.render';
import {
  buildResurveyFileName,
  computeExtraTimes,
  extraTimeBounds,
  formatTime2,
  parseWatermarkText,
  slotCodeOf,
  stableSha256,
  URL_EPOCH_PATTERN,
  type TimelineEntry,
} from '../modules/photo-resurvey/photo-resurvey.rules';
import type { ResurveyRenderState } from '../modules/photo-resurvey/photo-resurvey.types';

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

const at = (h: number, m: number, s: number) => new Date(2026, 9, 10, h, m, s);
const txt = (h: number, m: number, s: number) => formatTime2(at(h, m, s));

async function main(): Promise<void> {
  console.log('\n[1] Mã mục ảnh');
  await tc('khoá ô và mã ảnh quy về mục P-01..P-07', () => {
    assert.strictEqual(slotCodeOf('P-02'), 'P-02');
    assert.strictEqual(slotCodeOf('P-03#2'), 'P-03');
    assert.strictEqual(slotCodeOf('P-05-2'), 'P-05');
    assert.strictEqual(slotCodeOf('p-07-3'), 'P-07');
  });
  await tc('P-06B (võng dầm trong nhà), ảnh không thuộc Phụ lục 1 → null', () => {
    assert.strictEqual(slotCodeOf('P-06B'), null);
    assert.strictEqual(slotCodeOf('P-06B-2'), null);
    assert.strictEqual(slotCodeOf('U:abc'), null);
    assert.strictEqual(slotCodeOf('P-VL-01'), null);
  });

  console.log('\n[2] Đọc chữ watermark');
  await tc('đọc lại đúng chữ do formatTime2 tạo', () => {
    const p = parseWatermarkText(txt(8, 45, 10));
    assert.ok(p.hasTime);
    assert.strictEqual(p.at?.getTime(), at(8, 45, 10).getTime());
  });
  await tc(`giờ watermark luôn là giờ Việt Nam, không theo múi giờ máy chủ (TZ hiện tại: ${process.env.TZ ?? 'mặc định'})`, () => {
    // Lỗi gốc: prod chạy UTC → ảnh gốc 15:49:55 bị lưu thành 08:49:55.
    assert.strictEqual(formatWatermarkDateTime('2026-10-06T08:49:55.000Z'), '6 thg 10, 2026 15:49:55');
    assert.strictEqual(formatWatermarkDateTime(new Date('2026-10-06T08:49:55.000Z')), '6 thg 10, 2026 15:49:55');
    assert.strictEqual(formatWatermarkDateTime('2026-10-06T15:49:55+07:00'), '6 thg 10, 2026 15:49:55');
    assert.strictEqual(formatWatermarkDateTime('2026-10-06T15:49:55'), '6 thg 10, 2026 15:49:55', 'ISO không múi giờ = giờ VN');
    assert.strictEqual(formatWatermarkDateTime('06/10/2026 (15:49:55)'), '6 thg 10, 2026 15:49:55');
    assert.strictEqual(formatWatermarkDateTime('2026-10-06'), '6 thg 10, 2026', 'chỉ có ngày thì in ngày');
    assert.strictEqual(formatWatermarkDateTime(new Date(2026, 9, 6)), '6 thg 10, 2026', 'cột DATE của pg (00:00 giờ máy) in ngày');
    assert.strictEqual(extractPhotoDateTime('https://x/a_1791276595000.jpg'), formatTime2(new Date(1791276595000)));
    const p = parseWatermarkText('6 thg 10, 2026 15:49:55');
    assert.strictEqual(p.at?.toISOString(), '2026-10-06T08:49:55.000Z');
    assert.strictEqual(formatTime2(p.at as Date), '6 thg 10, 2026 15:49:55');
  });
  await tc('ảnh phát sinh chèn giữa 2 ảnh buổi chiều vẫn ra giờ buổi chiều', () => {
    const times = computeExtraTimes(
      [
        { slotCode: 'P-05', dateTimeText: '6 thg 10, 2026 15:51:38' },
        { slotCode: 'P-06', dateTimeText: '6 thg 10, 2026 15:49:55' },
      ],
      [{ itemId: 'a', slotCode: 'P-06' }],
      '6 thg 10, 2026'
    );
    const t = times.times.get('a');
    assert.ok(t, 'phải có giờ cho ảnh phát sinh');
    assert.match(t!.text, /^6 thg 10, 2026 15:/);
  });
  await tc('chữ chỉ có ngày → không có giờ', () => {
    const p = parseWatermarkText('10 thg 10, 2026');
    assert.strictEqual(p.hasTime, false);
  });

  console.log('\n[3] Xếp Time 2 ảnh phát sinh');
  const timeline: TimelineEntry[] = [
    { slotCode: 'P-01', dateTimeText: txt(8, 0, 0) },
    { slotCode: 'P-02', dateTimeText: txt(8, 1, 0) },
    { slotCode: 'P-05', dateTimeText: txt(8, 10, 0) },
    { slotCode: 'P-06', dateTimeText: txt(8, 20, 0) },
    { slotCode: null, dateTimeText: txt(9, 0, 0) }, // ảnh trong nhà
    { slotCode: null, dateTimeText: '10 thg 10, 2026' }, // Mục V chỉ có ngày → bỏ qua
  ];
  await tc('khoảng rộng: bước 120s sau ảnh cuối của mục', () => {
    const r = computeExtraTimes(timeline, [{ itemId: 'a', slotCode: 'P-05' }, { itemId: 'b', slotCode: 'P-05' }], 'X');
    assert.strictEqual(r.error, null);
    assert.strictEqual(r.times.get('a')?.text, txt(8, 12, 0));
    assert.strictEqual(r.times.get('b')?.text, txt(8, 14, 0));
    assert.strictEqual(r.times.get('a')?.source, 'INTERPOLATED');
  });
  await tc('khoảng hẹp: chia đều, không vượt ảnh kế tiếp', () => {
    const narrow: TimelineEntry[] = [
      { slotCode: 'P-05', dateTimeText: txt(8, 10, 0) },
      { slotCode: 'P-06', dateTimeText: txt(8, 10, 30) },
    ];
    const r = computeExtraTimes(narrow, [{ itemId: 'a', slotCode: 'P-05' }, { itemId: 'b', slotCode: 'P-05' }], 'X');
    assert.strictEqual(r.error, null);
    assert.strictEqual(r.times.get('a')?.text, txt(8, 10, 10));
    assert.strictEqual(r.times.get('b')?.text, txt(8, 10, 20));
  });
  await tc('không còn chỗ (khoảng < k+1 giây) → lỗi, không gán giờ', () => {
    const tight: TimelineEntry[] = [
      { slotCode: 'P-05', dateTimeText: txt(8, 10, 0) },
      { slotCode: 'P-06', dateTimeText: txt(8, 10, 1) },
    ];
    const r = computeExtraTimes(tight, [{ itemId: 'a', slotCode: 'P-05' }], 'X');
    assert.ok(r.error && r.error.includes('P-05'));
    assert.strictEqual(r.times.has('a'), false);
  });
  await tc('mục cuối dòng thời gian (không có ảnh sau) → T_prev + 120s·i', () => {
    const tail: TimelineEntry[] = [{ slotCode: 'P-07', dateTimeText: txt(10, 0, 0) }];
    const r = computeExtraTimes(tail, [{ itemId: 'a', slotCode: 'P-07' }, { itemId: 'b', slotCode: 'P-07' }], 'X');
    assert.strictEqual(r.times.get('b')?.text, txt(10, 4, 0));
  });
  await tc('ảnh trong nhà chụp sớm hơn ảnh ngoài nhà: vẫn chèn sau ảnh cuối của mục', () => {
    const r = computeExtraTimes(timeline, [{ itemId: 'a', slotCode: 'P-06' }], 'X');
    // P-06 lúc 8:20, ảnh kế tiếp 9:00 → 8:22
    assert.strictEqual(r.times.get('a')?.text, txt(8, 22, 0));
  });
  await tc('mục chưa có giờ → nối sau mục ngoài nhà đứng trước', () => {
    const r = computeExtraTimes(timeline, [{ itemId: 'a', slotCode: 'P-03' }], 'X');
    // P-03 không có ảnh có giờ → T_prev = P-02 8:01, T_next = P-05 8:10
    assert.strictEqual(r.times.get('a')?.text, txt(8, 3, 0));
  });
  await tc('report không có mốc giờ nào → in ngày khảo sát (DATE_ONLY)', () => {
    const dateOnly: TimelineEntry[] = [{ slotCode: 'P-05', dateTimeText: '10 thg 10, 2026' }];
    const r = computeExtraTimes(dateOnly, [{ itemId: 'a', slotCode: 'P-05' }], '10 thg 10, 2026');
    assert.strictEqual(r.times.get('a')?.text, '10 thg 10, 2026');
    assert.strictEqual(r.times.get('a')?.source, 'DATE_ONLY');
  });
  await tc('khoảng Admin được chỉnh = (T_prev, T_next)', () => {
    const b = extraTimeBounds(timeline, 'P-05');
    assert.strictEqual(b.prev?.getTime(), at(8, 10, 0).getTime());
    assert.strictEqual(b.next?.getTime(), at(8, 20, 0).getTime());
  });

  console.log('\n[4] Tên file không bị đọc nhầm thành giờ chụp');
  await tc('tên file và khoá R2 không chứa epoch 13 chữ số', () => {
    const name = buildResurveyFileName('B-01064', 'P-05', 'EXTRA', new Date('2026-11-20T07:30:15Z'));
    assert.ok(name.includes('_RS20261120143015'), name);
    assert.ok(!URL_EPOCH_PATTERN.test(name), name);
    const key = StorageService.buildUniqueKey(name, 'resurvey/ZONE_09/B-01064/r/s');
    assert.ok(!URL_EPOCH_PATTERN.test(key.split('/').pop() || ''), key);
    // Không có shotAt → extractPhotoDateTime rơi về ngày dự phòng, KHÔNG lấy giờ từ tên file.
    assert.strictEqual(extractPhotoDateTime(`https://r2.example/${key}`, undefined, '10/10/2026'), '10 thg 10, 2026');
  });

  console.log('\n[5] SHA-256 ổn định');
  await tc('cùng nội dung khác thứ tự khoá → cùng mã', () => {
    assert.strictEqual(stableSha256({ a: 1, b: [{ x: 1, y: 2 }] }), stableSha256({ b: [{ y: 2, x: 1 }], a: 1 }));
    assert.notStrictEqual(stableSha256({ a: 1 }), stableSha256({ a: 2 }));
  });

  console.log('\n[6] Lớp phủ ViewModel');
  const makeVm = (): ReportViewModel => {
    const item = (photoCode: string, url: string, wm: string) => ({
      photoCode, name: { vi: photoCode, en: photoCode }, url, base64: '', rotation: 0,
      capturedAt: '10/10/2026', gpsCoords: '10.7, 106.6', originalTag: photoCode, metroPhotoCode: `CODE_${photoCode}`,
      watermarkDateTime: wm, alreadyWatermarked: true,
    });
    return {
      metadata: { projectParcelCode: 'B-01064', buildingId: 'B-01064', coverPhotoUrl: 'u/p02.jpg', coverAlreadyWatermarked: true, surveyDateFormatted: '10/10/2026' },
      appendix1: [
        item('P-01', 'u/p01.jpg', txt(8, 0, 0)),
        item('P-02', 'u/p02.jpg', txt(8, 1, 0)),
        item('P-03', 'u/p03a.jpg', txt(8, 2, 0)),
        item('P-03', 'u/p03b.jpg', txt(8, 3, 0)),
        item('P-03', 'u/p03c.jpg', txt(8, 4, 0)),
        item('P-05', 'u/p05.jpg', txt(8, 10, 0)),
      ],
      appendix1Pages: [],
      section5: {
        tiltPhoto: { url: 'u/p05.jpg', caption: { vi: '', en: '' }, alreadyWatermarked: true },
      },
      appendix2: [],
    } as unknown as ReportViewModel;
  };
  const state: ResurveyRenderState = {
    sessions: [{
      sessionId: 's1',
      approvedAt: null,
      items: [
        { action: 'REPLACE', slotCode: 'P-02', photoKey: 'P-02', originalUrl: 'u/p02.jpg', extraIndex: null, newUrl: 'r/p02new.jpg', rotation: 90, time2Text: txt(8, 1, 0) },
        { action: 'MARK_NA', slotCode: 'P-03', photoKey: 'P-03#2', originalUrl: 'u/p03b.jpg', extraIndex: null, newUrl: null, rotation: 0, time2Text: null },
        { action: 'REPLACE', slotCode: 'P-05', photoKey: 'P-05', originalUrl: 'u/p05.jpg', extraIndex: null, newUrl: 'r/p05new.jpg', rotation: 0, time2Text: txt(8, 10, 0) },
        { action: 'ADD_EXTRA', slotCode: 'P-05', photoKey: null, originalUrl: null, extraIndex: 1, newUrl: 'r/p05x1.jpg', rotation: 0, time2Text: txt(8, 12, 0) },
        { action: 'ADD_EXTRA', slotCode: 'P-03', photoKey: null, originalUrl: null, extraIndex: 1, newUrl: 'r/p03x1.jpg', rotation: 0, time2Text: txt(8, 5, 0) },
      ],
    }],
  };
  await tc('REPLACE đổi ảnh ở Phụ lục 1 + bìa + Mục V, giữ nguyên chữ giờ và mã ảnh gốc', async () => {
    const vm = makeVm();
    const res = await applyResurveyToViewModel(vm, state, { loadImages: false });
    assert.deepStrictEqual(res.missed, []);
    const p02 = vm.appendix1.find((p) => p.photoCode === 'P-02');
    assert.strictEqual(p02?.url, 'r/p02new.jpg');
    assert.strictEqual(p02?.rotation, 90);
    assert.strictEqual(p02?.watermarkDateTime, txt(8, 1, 0));
    assert.strictEqual(p02?.metroPhotoCode, 'CODE_P-02');
    assert.strictEqual(p02?.alreadyWatermarked, false);
    assert.strictEqual(vm.metadata.coverPhotoUrl, 'r/p02new.jpg');
    assert.strictEqual(vm.metadata.coverAlreadyWatermarked, false);
    assert.strictEqual(vm.section5.tiltPhoto?.url, 'r/p05new.jpg');
  });
  await tc('MARK_NA bỏ đúng ô, ADD_EXTRA chèn sau ảnh cuối của mục, trang được dựng lại', async () => {
    const vm = makeVm();
    await applyResurveyToViewModel(vm, state, { loadImages: false });
    const urls = vm.appendix1.map((p) => p.url);
    assert.deepStrictEqual(urls, ['u/p01.jpg', 'r/p02new.jpg', 'u/p03a.jpg', 'u/p03c.jpg', 'r/p03x1.jpg', 'r/p05new.jpg', 'r/p05x1.jpg']);
    const extra = vm.appendix1.find((p) => p.url === 'r/p05x1.jpg');
    assert.strictEqual(extra?.photoCode, 'P-05-2');
    assert.strictEqual(extra?.watermarkDateTime, txt(8, 12, 0));
    assert.ok(extra?.metroPhotoCode?.includes('EXT_TILT_02'), extra?.metroPhotoCode);
    assert.strictEqual(vm.appendix1Pages?.length, 2);
    assert.strictEqual(vm.appendix1Pages?.[1].photos.length, 3);
  });
  await tc('ảnh gốc đã đổi sau khi duyệt → bỏ qua thao tác, báo missed', async () => {
    const vm = makeVm();
    vm.appendix1[1].url = 'u/p02-changed.jpg';
    const res = await applyResurveyToViewModel(vm, state, { loadImages: false });
    assert.ok(res.missed.some((m) => m.includes('P-02')));
    assert.strictEqual(vm.appendix1[1].url, 'u/p02-changed.jpg');
  });
  await tc('không có phiên đã duyệt → ViewModel giữ nguyên', async () => {
    const vm = makeVm();
    const before = JSON.stringify(vm);
    await applyResurveyToViewModel(vm, null, { loadImages: false });
    assert.strictEqual(JSON.stringify(vm), before);
  });
  await tc('đóng băng snapshot đọc lại đúng, dữ liệu rác bị loại', () => {
    const frozen = parseFrozenResurvey(JSON.parse(JSON.stringify(state)));
    assert.deepStrictEqual(frozen, state);
    assert.strictEqual(parseFrozenResurvey(null), null);
    const junk = parseFrozenResurvey({ sessions: [{ sessionId: 'x', items: [{ action: 'DROP', slotCode: 'P-02' }] }] });
    assert.strictEqual(junk?.sessions[0].items.length, 0);
  });

  console.log(`\n${process.exitCode ? '❌ CÓ LỖI' : '✅ ĐẠT'} – ${passed} ca`);
}

main().catch((err) => {
  console.error('[test_photo_resurvey_rules] Lỗi không mong đợi', err);
  process.exitCode = 1;
});
