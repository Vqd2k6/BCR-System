/**
 * Unit test bộ sinh "Mã ĐC" R####### – không cần DB.
 * Chạy: cd backend && npx ts-node --transpile-only src/scripts/cadastral_code_generator.test.ts
 */
import assert from 'node:assert/strict';
import {
  generateUniqueCadastralCode,
  isRandomCadastralCode,
  randomCadastralCode,
  resolveCadastralCode,
  type CadastralCodeQueryClient,
} from '../modules/cadastral/utils/cadastral-code.generator';

function mockClient(existing: Set<string>): CadastralCodeQueryClient & { calls: number } {
  const c = {
    calls: 0,
    async query(_text: string, params?: unknown[]) {
      c.calls += 1;
      return { rowCount: existing.has(String(params?.[0])) ? 1 : 0 };
    },
  };
  return c;
}

const tests: Array<[string, () => Promise<void> | void]> = [
  [
    'randomCadastralCode đúng định dạng R + 7 chữ số (1000 mẫu)',
    () => {
      for (let i = 0; i < 1000; i++) assert.match(randomCadastralCode(), /^R\d{7}$/);
    },
  ],
  [
    'isRandomCadastralCode nhận diện đúng',
    () => {
      assert.equal(isRandomCadastralCode('R0000123'), true);
      assert.equal(isRandomCadastralCode('R123456'), false);
      assert.equal(isRandomCadastralCode('267430130127-B'), false);
      assert.equal(isRandomCadastralCode(null), false);
    },
  ],
  [
    'generateUniqueCadastralCode thử lại khi trùng',
    async () => {
      const seq = ['R1111111', 'R2222222', 'R3333333'];
      const client = mockClient(new Set(['R1111111', 'R2222222']));
      const code = await generateUniqueCadastralCode(client, () => seq.shift() ?? 'R9999999');
      assert.equal(code, 'R3333333');
      assert.equal(client.calls, 3);
    },
  ],
  [
    'generateUniqueCadastralCode ném lỗi sau 20 lần trùng',
    async () => {
      const client = mockClient(new Set(['R0000001']));
      await assert.rejects(() => generateUniqueCadastralCode(client, () => 'R0000001'));
      assert.equal(client.calls, 20);
    },
  ],
  [
    'resolveCadastralCode giữ mã nhập tay, rỗng thì sinh R#######',
    async () => {
      const client = mockClient(new Set());
      assert.equal(await resolveCadastralCode(client, ' 271330130449 '), '271330130449');
      assert.equal(client.calls, 0);
      assert.match(await resolveCadastralCode(client, '   '), /^R\d{7}$/);
      assert.match(await resolveCadastralCode(client, undefined), /^R\d{7}$/);
    },
  ],
];

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
    } catch (err: unknown) {
      failed += 1;
      console.error(`  ✗ ${name}`, err);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  if (failed > 0) process.exitCode = 1;
})();

