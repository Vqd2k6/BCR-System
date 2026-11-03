/**
 * Kiểm thử GET /image-lab/cad-sketches trên CSDL thật (CHỈ ĐỌC).
 * Chạy: cd backend && DB_NAME=metro2_audit_test npx ts-node src/scripts/test_cad_sketch_scope.ts
 */
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { Database, pool } from '../database/db';
import type { JwtPayload } from '../common/guards/auth.guard';
import { ImageLabController } from '../modules/image-lab/image-lab.controller';
import type { CadSketchItem } from '../modules/image-lab/cad-sketch-catalog.service';

interface CallResult {
  status?: number;
  total?: number;
  items?: CadSketchItem[];
  limit?: number;
}

function user(role: JwtPayload['role'], assignedZoneId: string | null): JwtPayload {
  return { userId: 'u1', username: 'u1', role, assignedZoneId, fullName: 'Test' };
}

async function call(u: JwtPayload, query: Record<string, string>): Promise<CallResult> {
  const out: CallResult = {};
  const res = {
    status: () => res,
    json: (body: { meta: { total: number; limit: number }; data: CadSketchItem[] }) => {
      out.total = body.meta.total;
      out.limit = body.meta.limit;
      out.items = body.data;
      return res;
    },
  };
  await ImageLabController.getProjectCadSketches(
    { user: u, query } as unknown as Request,
    res as unknown as Response,
    (err?: unknown) => {
      out.status = (err as { statusCode?: number } | undefined)?.statusCode ?? (err as { status?: number } | undefined)?.status;
      if (out.status === undefined) throw err;
    }
  );
  return out;
}

async function main(): Promise<void> {
  const superAdmin = user('SUPER_ADMIN', null);
  const line = await call(superAdmin, { limit: '100' });
  assert.ok((line.total ?? 0) > 0, 'CSDL thử phải có bản vẽ CAD');

  // Chọn Zone có bản vẽ và một Zone khác để thử chặn
  const zones = await Database.query<{ zone_id: string }>(
    `SELECT p.zone_id FROM floor_surveys f
     JOIN base_survey_reports r ON r.id = f.report_id AND r.deleted_at IS NULL
     JOIN parcels p ON p.id = r.parcel_id
     WHERE f.cad_drawing_url ~* '^https?://' AND p.zone_id IS NOT NULL
     GROUP BY p.zone_id ORDER BY COUNT(*) DESC LIMIT 2`
  );
  assert.ok(zones.rows.length === 2, 'Cần ít nhất 2 Zone có bản vẽ');
  const [ownZone, otherZone] = zones.rows.map((r) => r.zone_id);
  const zoneAdmin = user('ZONE_ADMIN', ownZone);

  const scoped = await call(zoneAdmin, { limit: '100' });
  assert.ok((scoped.total ?? 0) > 0 && (scoped.total ?? 0) < (line.total ?? 0), 'Zone Admin chỉ thấy một phần toàn tuyến');
  assert.ok(scoped.items?.every((i) => i.zoneId === ownZone), 'Mọi bản vẽ phải thuộc Zone được gán');
  console.log(`  ✓ Zone Admin ${ownZone} chỉ thấy Zone mình: ${scoped.total}/${line.total}`);

  const askAll = await call(zoneAdmin, { zone: 'ALL', limit: '5' });
  assert.equal(askAll.total, scoped.total, 'Xin toàn tuyến bị thu hẹp về Zone được gán');
  const askOther = await call(zoneAdmin, { zone: otherZone });
  assert.equal(askOther.status, 403, 'Xin Zone khác bị 403');
  assert.equal((await call(user('ZONE_ADMIN', null), {})).status, 403, 'Zone Admin chưa gán Zone bị 403');
  console.log('  ✓ Xin toàn tuyến bị thu hẹp, xin Zone khác và chưa gán Zone bị 403');

  const superZone = await call(superAdmin, { zone: ownZone, limit: '1' });
  assert.equal(superZone.total, scoped.total, 'Super Admin chọn Zone ra cùng số lượng');
  console.log('  ✓ Super Admin thấy toàn tuyến và chọn được Zone');

  const clamped = await call(superAdmin, { limit: '5000' });
  assert.equal(clamped.limit, 100);
  assert.ok((clamped.items?.length ?? 0) <= 100);
  console.log('  ✓ limit lớn hơn 100 bị cắt về 100');

  const all: CadSketchItem[] = [];
  for (let offset = 0; offset < (line.total ?? 0); offset += 100) {
    const page = await call(superAdmin, { limit: '100', offset: String(offset) });
    all.push(...(page.items ?? []));
  }
  assert.equal(all.length, line.total, 'Phân trang lấy đủ tổng số');
  assert.ok(all.every((i) => /^https?:\/\//i.test(i.url)), 'Không có URL data:/blob:');
  assert.equal(new Set(all.map((i) => i.url)).size, all.length, 'Không có URL trùng');
  console.log(`  ✓ ${all.length} bản vẽ, không trùng URL, không có data:/blob:`);

  const deleted = await Database.query<{ url: string }>(
    `SELECT f.cad_drawing_url AS url FROM floor_surveys f
     JOIN base_survey_reports r ON r.id = f.report_id
     WHERE r.deleted_at IS NOT NULL AND f.cad_drawing_url ~* '^https?://'
       AND NOT EXISTS (
         SELECT 1 FROM floor_surveys f2 JOIN base_survey_reports r2 ON r2.id = f2.report_id AND r2.deleted_at IS NULL
         WHERE f2.cad_drawing_url = f.cad_drawing_url OR f2.cad_structural_drawing_url = f.cad_drawing_url)`
  );
  const urls = new Set(all.map((i) => i.url));
  assert.ok(deleted.rows.every((r) => !urls.has(r.url)), 'Bản vẽ của hồ sơ đã xóa mềm không được trả về');
  console.log(`  ✓ Bỏ ${deleted.rows.length} bản vẽ của hồ sơ đã xóa mềm`);

  const typed = await call(superAdmin, { type: 'CAD_STRUCT', limit: '100' });
  assert.ok(typed.items?.every((i) => i.cadType === 'CAD_STRUCT'));
  const sample = scoped.items?.find((i) => i.parcelCode)?.parcelCode ?? '';
  const searched = await call(superAdmin, { q: sample.toLowerCase(), limit: '100' });
  assert.ok((searched.total ?? 0) > 0 && searched.items?.every((i) => i.parcelCode.toLowerCase().includes(sample.toLowerCase())));
  const wildcard = await call(superAdmin, { q: '%' });
  assert.equal(wildcard.total, 0, 'Ký tự % trong ô tìm không được khớp mọi thứ');
  console.log(`  ✓ Lọc loại, tìm "${sample}" và chặn ký tự đại diện`);
}

main()
  .catch((err: unknown) => {
    console.error('[CadSketchScopeTest] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
