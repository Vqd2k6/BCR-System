/**
 * Kiểm thử tích hợp API khung tên bình đồ CAD theo Zone (chạy trên DB local, app dựng trong tiến trình).
 * Chạy: cd backend && npx ts-node --transpile-only src/scripts/test_drawing_config_api.ts
 *
 * - GET mọi vai trò đọc được; PUT/POST chỉ SUPER_ADMIN (ZA/KSV → 403, không ghi DB).
 * - PUT ghi system_audit_logs before/after; POST cấp REV tuần tự, không trùng khi gửi đồng thời.
 * - Dữ liệu kiểm thử được xóa MỀM (deleted_at) khi kết thúc, không xóa cứng.
 */
import type { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { createApp } from '../app';
import { pool } from '../database/db';

const TEST_ZONE = 'ZONE_22';

interface UserRow {
  id: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR';
  full_name: string;
  assigned_zone_id: string | null;
  token_version: number | null;
}

const failures: string[] = [];
const check = (name: string, passed: boolean, detail = '') => {
  console.log(`${passed ? '✅' : '❌'} ${name}${passed || !detail ? '' : ` (${detail})`}`);
  if (!passed) failures.push(`${name} ${detail}`);
};

const tokenFor = (user: UserRow): string =>
  jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      assignedZoneId: user.assigned_zone_id,
      fullName: user.full_name,
      tokenVersion: user.token_version ?? 0,
    },
    config.jwt.secret,
    { expiresIn: '10m' }
  );

const main = async () => {
  const users = await pool.query<UserRow>(
    `SELECT DISTINCT ON (role) id, username, role, full_name, assigned_zone_id, token_version
       FROM users WHERE status = 'ACTIVE' AND role IN ('SUPER_ADMIN', 'ZONE_ADMIN', 'SURVEYOR')
      ORDER BY role, created_at;`
  );
  const byRole = new Map(users.rows.map((u) => [u.role, u]));
  const sa = byRole.get('SUPER_ADMIN');
  const za = byRole.get('ZONE_ADMIN');
  const ksv = byRole.get('SURVEYOR');
  if (!sa || !za || !ksv) throw new Error('DB local cần đủ 1 tài khoản ACTIVE cho SUPER_ADMIN, ZONE_ADMIN, SURVEYOR');

  const server = createApp().listen(0);
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}${config.apiPrefix}`;
  const call = async (method: string, url: string, user: UserRow, body?: unknown) => {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: { Authorization: `Bearer ${tokenFor(user)}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json: unknown = await res.json().catch(() => null);
    return { status: res.status, json: json as { data?: Record<string, unknown> } | null };
  };

  try {
    const probe = await call('GET', `/zones/${TEST_ZONE}/drawing-title-block`, ksv);
    check('KSV đọc được cấu hình khung tên', probe.status === 200, String(probe.status));
    check('Mã Zone sai → 400', (await call('GET', '/zones/ZONE_99/drawing-title-block', ksv)).status === 400);

    const auditBefore = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM system_audit_logs WHERE entity_type IN ('ZONE_DRAWING_TITLE_BLOCK', 'ZONE_DRAWING_REVISION');`
    );
    const body = {
      preparedBy: 'Kiểm Thử Người Vẽ',
      reviewedBy: 'DENG XIAO MING',
      approvedBy: 'LUO TAO',
      manager: '',
      projectManager: '',
      drawingNo: 'TEST-DEP-01',
    };
    check('Zone Admin sửa khung tên → 403', (await call('PUT', `/zones/${TEST_ZONE}/drawing-title-block`, za, body)).status === 403);
    check('KSV sửa khung tên → 403', (await call('PUT', `/zones/${TEST_ZONE}/drawing-title-block`, ksv, body)).status === 403);
    check('Zone Admin phát hành → 403', (await call('POST', `/zones/${TEST_ZONE}/drawing-revisions`, za, { issueDate: '2026-11-05', description: 'Không được phép' })).status === 403);
    const auditAfterDenied = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM system_audit_logs WHERE entity_type IN ('ZONE_DRAWING_TITLE_BLOCK', 'ZONE_DRAWING_REVISION');`
    );
    check('Bị chặn thì không ghi audit', auditAfterDenied.rows[0].n === auditBefore.rows[0].n);

    check('DTO sai (số bản vẽ quá dài) → 400', (await call('PUT', `/zones/${TEST_ZONE}/drawing-title-block`, sa, { ...body, drawingNo: 'X'.repeat(61) })).status === 400);
    const saved = await call('PUT', `/zones/${TEST_ZONE}/drawing-title-block`, sa, body);
    check('Super Admin lưu khung tên', saved.status === 200 && saved.json?.data?.drawingNo === 'TEST-DEP-01', String(saved.status));
    const audit = await pool.query<{ diff_payload: { before: unknown; after: { drawingNo: string } } }>(
      `SELECT diff_payload FROM system_audit_logs WHERE entity_type = 'ZONE_DRAWING_TITLE_BLOCK' ORDER BY created_at DESC LIMIT 1;`
    );
    check('Audit có before/after', audit.rows[0]?.diff_payload?.after?.drawingNo === 'TEST-DEP-01' && 'before' in (audit.rows[0]?.diff_payload ?? {}));

    const existing = await pool.query<{ next: number }>(
      `SELECT COALESCE(MAX(revision_number), -1) + 1 AS next FROM zone_drawing_revisions WHERE zone_code = $1;`,
      [TEST_ZONE]
    );
    const first = existing.rows[0].next;
    check('Ngày sai định dạng → 400', (await call('POST', `/zones/${TEST_ZONE}/drawing-revisions`, sa, { issueDate: '05/11/2026', description: 'Sai ngày' })).status === 400);
    const [a, b] = await Promise.all([
      call('POST', `/zones/${TEST_ZONE}/drawing-revisions`, sa, { issueDate: '2026-11-05', description: 'Kiểm thử song song A' }),
      call('POST', `/zones/${TEST_ZONE}/drawing-revisions`, sa, { issueDate: '2026-11-05', description: 'Kiểm thử song song B' }),
    ]);
    const numbers = [a.json?.data?.revisionNumber, b.json?.data?.revisionNumber].map(Number).sort((x, y) => x - y);
    check('Phát hành đồng thời: 2 lần đều 201', a.status === 201 && b.status === 201, `${a.status}/${b.status}`);
    check('REV tuần tự, không trùng', numbers[0] === first && numbers[1] === first + 1, numbers.join(','));

    const read = await call('GET', `/zones/${TEST_ZONE}/drawing-title-block`, za);
    const revisions = (read.json?.data?.revisions as { revision: string; issueDate: string }[] | undefined) ?? [];
    check('Zone Admin đọc thấy khung tên & lịch sử', read.status === 200 && revisions.length >= 2, String(revisions.length));
    check('REV định dạng Rnn, ngày YYYY-MM-DD', revisions.every((r) => /^R\d{2}$/.test(r.revision) && /^\d{4}-\d{2}-\d{2}$/.test(r.issueDate)));
  } finally {
    // Dọn dữ liệu kiểm thử bằng xóa mềm (không xóa cứng bảng nghiệp vụ)
    await pool.query(`UPDATE zone_drawing_revisions SET deleted_at = NOW() WHERE zone_code = $1 AND description LIKE 'Kiểm thử%' AND deleted_at IS NULL;`, [TEST_ZONE]);
    await pool.query(`UPDATE zone_drawing_title_blocks SET deleted_at = NOW() WHERE zone_code = $1 AND drawing_no = 'TEST-DEP-01';`, [TEST_ZONE]);
    server.close();
    await pool.end();
  }

  if (failures.length > 0) {
    console.error(`\nFAILED ${failures.length} kiểm tra`);
    process.exit(1);
  }
  console.log('\nPASSED: API khung tên bình đồ đạt toàn bộ kiểm tra.');
};

main().catch((err) => {
  console.error('[DrawingConfigApiTest] Failed:', err);
  process.exit(1);
});
