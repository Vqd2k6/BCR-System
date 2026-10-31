/**
 * Kiểm thử phạm vi zone của GET /parcels/zone-map trên CSDL thật (CHỈ ĐỌC).
 * Chạy: cd backend && npx ts-node src/scripts/test_zone_map_scope.ts
 */
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { pool } from '../database/db';
import type { JwtPayload } from '../common/guards/auth.guard';
import { CadastralController } from '../modules/cadastral/cadastral.controller';
import { resolveZoneMapScope } from '../modules/cadastral/utils/zone-scope.utils';

function user(role: JwtPayload['role'], assignedZoneId: string | null): JwtPayload {
  return { userId: 'u1', username: 'u1', role, assignedZoneId, fullName: 'Test' };
}

const zoneAdmin = user('ZONE_ADMIN', 'ZONE_09');
const allAdmin = user('ZONE_ADMIN', 'ALL');
const superAdmin = user('SUPER_ADMIN', null);

const pureCases: Array<[string, JwtPayload, string | undefined, string]> = [
  ['Zone Admin không gửi zone → zone được gán', zoneAdmin, undefined, 'ZONE_09'],
  ['Zone Admin gửi ALL → thu hẹp về zone được gán', zoneAdmin, 'ALL', 'ZONE_09'],
  ['Zone Admin gửi ALL_ZONES → thu hẹp về zone được gán', zoneAdmin, 'all_zones', 'ZONE_09'],
  ['Zone Admin gửi đúng zone', zoneAdmin, 'zone_09', 'ZONE_09'],
  ['Zone Admin gửi mã zone cũ cùng alias', zoneAdmin, 'ZONE_S9', 'ZONE_S9'],
  ['Zone Admin gán ALL giữ toàn tuyến', allAdmin, 'ALL', 'ALL'],
  ['Zone Admin gán ALL chọn được zone', allAdmin, 'ZONE_01', 'ZONE_01'],
  ['Zone Admin gán ALL không gửi zone', allAdmin, undefined, 'ALL'],
  ['Super Admin xem toàn tuyến', superAdmin, 'ALL', 'ALL'],
  ['Super Admin chọn zone', superAdmin, 'ZONE_01', 'ZONE_01'],
  ['Surveyor giữ logic cũ', user('SURVEYOR', 'ZONE_09'), 'ZONE_01', 'ZONE_01'],
  ['Guest bị ép về zone được gán', user('GUEST', 'ZONE_01'), 'ZONE_09', 'ZONE_01'],
];

async function callZoneMap(u: JwtPayload, zoneId: string): Promise<{ count?: number; status?: number }> {
  let count: number | undefined;
  let status: number | undefined;
  const res = {
    status: () => res,
    json: (body: { data: unknown[] }) => {
      count = body.data.length;
      return res;
    },
  };
  await CadastralController.getZoneMap(
    { user: u, query: { zoneId } } as unknown as Request,
    res as unknown as Response,
    (err?: unknown) => {
      status = (err as { statusCode?: number; status?: number } | undefined)?.statusCode ?? (err as { status?: number } | undefined)?.status;
      if (status === undefined) throw err;
    }
  );
  return { count, status };
}

async function main(): Promise<void> {
  for (const [name, u, requested, expected] of pureCases) {
    assert.equal(resolveZoneMapScope(u, requested), expected, name);
    console.log(`  ✓ ${name}`);
  }
  assert.throws(() => resolveZoneMapScope(zoneAdmin, 'ZONE_01'), /không có quyền/);
  console.log('  ✓ Zone Admin gửi zone khác bị từ chối');
  assert.throws(() => resolveZoneMapScope(user('ZONE_ADMIN', null), 'ZONE_01'), /chưa được phân công/);
  console.log('  ✓ Zone Admin chưa gán zone bị từ chối');

  const scoped = await callZoneMap(zoneAdmin, 'ALL');
  const own = await callZoneMap(superAdmin, 'ZONE_09');
  const line = await callZoneMap(superAdmin, 'ALL');
  const lineAdmin = await callZoneMap(allAdmin, 'ALL');
  const other = await callZoneMap(zoneAdmin, 'ZONE_01');
  const unassigned = await callZoneMap(user('ZONE_ADMIN', null), 'ZONE_01');
  console.log({ scoped, own, line, lineAdmin, other, unassigned });

  assert.equal(scoped.count, own.count);
  assert.ok((scoped.count ?? 0) > 0 && (scoped.count ?? 0) < (line.count ?? 0));
  assert.equal(lineAdmin.count, line.count);
  assert.equal(other.status, 403);
  assert.equal(unassigned.status, 403);
  console.log('  ✓ Controller trên CSDL thật');
}

main()
  .catch((err: unknown) => {
    console.error('[ZoneMapScopeTest] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
