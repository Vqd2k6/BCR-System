import assert from 'node:assert/strict';
import { formatRestrictedAreas, readCustomRestrictedAreas } from '../modules/survey/access-limitation.utils';
import { syncSurveyScopeInTx } from '../modules/audit/services/audit-sql-sync.helpers';
import { Section9ConclusionMapper } from '../modules/report/mappers/sections/section-9-conclusions-monitoring.mapper';
import type { PoolClient } from 'pg';

const OTHER = 'Khác (Nhập chi tiết...)';

const limitationsOf = (accessLimitation: Record<string, unknown>): string[] =>
  Section9ConclusionMapper.map({}, { accessLimitation }, [], {}, {}, {}).limitations.map((item) => item.vi);

async function syncedParams(json: Record<string, unknown>): Promise<unknown[]> {
  let params: unknown[] = [];
  const client = {
    query: async (_sql: string, values: unknown[]) => {
      params = values;
      return { rows: [] };
    },
  } as unknown as PoolClient;
  await syncSurveyScopeInTx(client, 'report-1', json);
  return params;
}

async function run() {
  assert.equal(formatRestrictedAreas({ restrictedAreas: ['Mái / Sân thượng', OTHER], customRestrictedArea: 'Phòng khách' }), 'Mái / Sân thượng, Phòng khách');
  assert.equal(formatRestrictedAreas({ restrictedAreas: [OTHER], notes: 'A [Khu vực khác: Phòng phám lầu 1 ]' }), 'Phòng phám lầu 1');
  assert.equal(formatRestrictedAreas({ restrictedAreas: [OTHER] }), OTHER);
  assert.equal(
    formatRestrictedAreas({ restrictedAreas: ['Tầng hầm', OTHER], customRestrictedAreas: ['Phòng ngủ lầu 1', 'Phòng WC lầu 3'] }),
    'Tầng hầm, Phòng ngủ lầu 1, Phòng WC lầu 3'
  );
  assert.deepEqual(readCustomRestrictedAreas({ customRestrictedAreas: ['A', 1, ' '] }), ['A']);
  assert.deepEqual(readCustomRestrictedAreas({ customRestrictedAreas: [], notes: 'x [Khu vực khác: Sau nhà]' }), ['Sau nhà']);
  assert.equal(
    formatRestrictedAreas({ restrictedAreas: ['Các tầng lầu trên cao'], restrictedFloorLevels: ['Tầng 2 (Lầu 1)', 'Tầng 3 (Lầu 2)'] }),
    'Các tầng lầu trên cao (Tầng 2 (Lầu 1),Tầng 3 (Lầu 2))'
  );
  assert.equal(formatRestrictedAreas({ restrictedAreas: ['Các tầng lầu trên cao'], restrictedFloorLevels: [] }), 'Các tầng lầu trên cao');
  assert.equal(formatRestrictedAreas({ restrictedAreas: [] }), null);
  assert.equal(formatRestrictedAreas(null), null);

  const fresh = limitationsOf({ type: 'LIMITED', restrictedAreas: [OTHER], customRestrictedArea: 'Phòng ngủ 1', mainReason: 'Khóa cửa', notes: 'Chủ đi vắng' });
  assert.ok(fresh.includes('Khu vực chưa tiếp cận khảo sát: Khác (Phòng ngủ 1)'), fresh.join(' | '));
  assert.ok(fresh.includes('Lý do hạn chế tiếp cận: Khóa cửa (Chủ đi vắng)'), fresh.join(' | '));

  const many = limitationsOf({ type: 'LIMITED', restrictedAreas: [OTHER], customRestrictedAreas: ['Phòng ngủ lầu 1', 'Phòng WC lầu 3'] });
  assert.ok(many.includes('Khu vực chưa tiếp cận khảo sát: Khác (Phòng ngủ lầu 1; Phòng WC lầu 3)'), many.join(' | '));

  const legacy = limitationsOf({ type: 'LIMITED', restrictedAreas: [OTHER], mainReason: 'Khóa cửa', notes: 'Chủ đi vắng [Khu vực khác: Phía sau]' });
  assert.ok(legacy.includes('Khu vực chưa tiếp cận khảo sát: Khác (Phía sau)'), legacy.join(' | '));
  assert.ok(!legacy.join(' ').includes('[Khu vực khác'), legacy.join(' | '));

  const limited = await syncedParams({ accessLimitation: { type: 'LIMITED', restrictedAreas: [OTHER], customRestrictedAreas: ['Phòng khách', 'Kho'] } });
  assert.equal(limited[2], 'Phòng khách, Kho');

  const json: Record<string, unknown> = {
    accessLimitation: { type: 'FULL_100', restrictedAreas: [OTHER], restrictedFloorLevels: ['Tầng 3 (Lầu 3)'], customRestrictedAreas: ['Phòng khách'], notes: 'x' },
  };
  const full = await syncedParams(json);
  assert.equal(full[2], null);
  const cleared = json.accessLimitation as Record<string, unknown>;
  assert.deepEqual(cleared.restrictedFloorLevels, []);
  assert.deepEqual(cleared.customRestrictedAreas, []);

  console.log('test_access_limitation_scope: OK');
}

run().catch((err: unknown) => {
  console.error('[test_access_limitation_scope] FAILED', err);
  process.exit(1);
});
