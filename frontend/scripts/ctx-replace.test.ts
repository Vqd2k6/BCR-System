import assert from 'node:assert/strict';

// offlinePhotoStorage đọc mapping ảnh từ localStorage: dùng bản giả trong bộ nhớ
const storage = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};
Object.assign(globalThis, { localStorage, window: { localStorage } });

async function runTest() {
  const { isCtxLinkAtRisk, keepCtxLink, confirmCtxReplace } = await import(
    '../src/features/survey-phase1/components/step3/confirmCtxReplace'
  );
  const { saveUploadedPhotoMapping } = await import('../src/core/storage/offlinePhotoStorage');

  const localCtx = 'blob:local://photo_1_abc';
  const cloudUrl = 'https://cdn.example/a.jpg';

  assert.equal(isCtxLinkAtRisk(localCtx, []), true, 'Ảnh cục bộ chỉ có ở CTX thì có nguy cơ mất liên kết');
  assert.equal(isCtxLinkAtRisk(localCtx, [localCtx]), false, 'Còn trong ảnh tổng quan thì không mất liên kết');
  assert.equal(isCtxLinkAtRisk(cloudUrl, []), false, 'Ảnh đã lên kho không có nguy cơ');
  assert.equal(isCtxLinkAtRisk('', []), false);

  assert.deepEqual(keepCtxLink(localCtx, [cloudUrl]), [cloudUrl, localCtx], 'Phải giữ URI ảnh cũ');
  assert.deepEqual(keepCtxLink(localCtx, [localCtx]), [localCtx], 'Không được nhân đôi ảnh');
  assert.deepEqual(keepCtxLink(cloudUrl, undefined), []);

  let prompts: string[] = [];
  let answer = true;
  Object.assign(globalThis, {
    confirm: (message: string) => {
      prompts.push(message);
      return answer;
    },
  });

  assert.equal(confirmCtxReplace({ defectCount: 0, ctxPhotoUrl: cloudUrl }), true);
  assert.equal(prompts.length, 0, 'Không có D và ảnh an toàn thì không hỏi');

  answer = false;
  assert.equal(confirmCtxReplace({ defectCount: 2, ctxPhotoUrl: cloudUrl }), false, 'Hủy thì giữ nguyên ảnh');
  assert.match(prompts[0], /2 ghim D-xx/);

  prompts = [];
  confirmCtxReplace({ defectCount: 0, ctxPhotoUrl: localCtx, overviewPhotos: [] });
  assert.match(prompts[0], /mất liên kết/);

  prompts = [];
  assert.equal(confirmCtxReplace({ defectCount: 0, ctxPhotoUrl: localCtx, keepsOldPhotoLink: true }), true);
  assert.equal(prompts.length, 0, 'Đã giữ URI thì không cần cảnh báo mất liên kết');

  saveUploadedPhotoMapping('photo_1_abc', cloudUrl);
  assert.equal(isCtxLinkAtRisk(localCtx, []), false, 'Đã có mapping lên kho thì không còn nguy cơ');

  console.log('✅ Đổi ảnh CTX: giữ liên kết ảnh chưa đồng bộ và cảnh báo đúng ca');
}

runTest().catch((err) => {
  console.error('❌ [CtxReplaceTest] Thất bại:', err);
  process.exit(1);
});
