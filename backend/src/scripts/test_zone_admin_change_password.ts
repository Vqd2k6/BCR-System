/**
 * Kiểm thử đổi mật khẩu và thu hồi token của Zone Admin. CHỈ chạy trên DB bản sao vì có ghi tài khoản:
 *   DB_NAME=metro2_audit_test npx ts-node src/scripts/test_zone_admin_change_password.ts
 * Đi qua app Express thật (DTO, guard, controller) nên lỗi validate và 401/403 được kiểm tra đúng tầng.
 */
import assert from 'assert';
import type { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { createApp } from '../app';
import { Database, pool } from '../database/db';
import { CryptoUtils } from '../common/utils/crypto.utils';
import { AuthRepository } from '../modules/auth/auth.repository';
import { AuthService } from '../modules/auth/auth.service';

const OLD_PASSWORD = 'OldPass@123';
const NEW_PASSWORD = 'NewPass@456';

if (config.db.database === 'metro2_gis_db' || process.env.DATABASE_URL) {
  throw new Error('[test_zone_admin_change_password] Từ chối chạy: chỉ dùng DB bản sao (DB_NAME=metro2_audit_test).');
}

let baseUrl = '';

async function call(method: string, path: string, token: string | null, body?: unknown) {
  const res = await fetch(`${baseUrl}${config.apiPrefix}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  return { status: res.status, json };
}

async function createUser(role: string, password: string) {
  const user = await AuthRepository.createUser({
    username: `test_pwd_${role.toLowerCase()}_${Date.now()}`,
    passwordHash: await CryptoUtils.hashPassword(password),
    fullName: 'Tài khoản test đổi mật khẩu',
    role,
    assignedZoneId: role === 'ZONE_ADMIN' ? 'ZONE_01' : null,
  });
  return user;
}

async function readUser(id: string) {
  const res = await Database.query<{ password_hash: string; token_version: number }>(
    `SELECT password_hash, token_version FROM users WHERE id = $1;`,
    [id]
  );
  return res.rows[0];
}

async function loginToken(username: string, password: string): Promise<string> {
  const res = await call('POST', '/auth/login', null, { username, password });
  assert.strictEqual(res.status, 200, 'Đăng nhập phải thành công');
  const token = res.json.data?.accessToken;
  assert.ok(token, 'Đăng nhập phải trả accessToken');
  return token;
}

async function run(): Promise<void> {
  const server = createApp().listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const zoneAdmin = await createUser('ZONE_ADMIN', OLD_PASSWORD);
  const superAdmin = await createUser('SUPER_ADMIN', OLD_PASSWORD);
  const surveyor = await createUser('SURVEYOR', OLD_PASSWORD);

  try {
    const oldToken = await loginToken(zoneAdmin.username, OLD_PASSWORD);

    // 1. Ba trường hợp 400 không làm đổi token_version
    const invalid = [
      { currentPassword: 'SaiMatKhau1', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD },
      { currentPassword: OLD_PASSWORD, newPassword: OLD_PASSWORD, confirmPassword: OLD_PASSWORD },
      { currentPassword: OLD_PASSWORD, newPassword: '12345', confirmPassword: '12345' },
    ];
    for (const body of invalid) {
      const res = await call('POST', '/auth/change-password', oldToken, body);
      assert.strictEqual(res.status, 400, `Phải trả 400: ${JSON.stringify(body)}`);
    }
    assert.strictEqual((await readUser(zoneAdmin.id)).token_version, 0);

    // 4. JWT cũ không có claim tokenVersion vẫn qua guard khi token_version = 0
    const legacyToken = jwt.sign(
      { userId: zoneAdmin.id, username: zoneAdmin.username, role: 'ZONE_ADMIN', fullName: zoneAdmin.full_name },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    assert.strictEqual((await call('GET', '/auth/me', legacyToken)).status, 200);

    // 5. Ghi audit lỗi thì rollback toàn bộ
    await assert.rejects(
      AuthRepository.applyOwnPasswordChange(zoneAdmin.id, 'hash-khong-duoc-luu', {
        diffPayload: { force: 'fail' },
        clientIp: 'khong-phai-ip-hop-le-'.repeat(20),
      })
    );
    const afterFailure = await readUser(zoneAdmin.id);
    assert.strictEqual(afterFailure.token_version, 0, 'Rollback phải giữ token_version');
    assert.ok(await CryptoUtils.comparePassword(OLD_PASSWORD, afterFailure.password_hash), 'Rollback phải giữ mật khẩu cũ');

    // 2 + 3. Đổi thành công: hash, version, session, audit và token
    const changed = await call('POST', '/auth/change-password', oldToken, {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    assert.strictEqual(changed.status, 200);
    const newToken = changed.json.data?.accessToken;
    assert.ok(newToken, 'Phải cấp accessToken mới');

    const afterChange = await readUser(zoneAdmin.id);
    assert.strictEqual(afterChange.token_version, 1);
    assert.ok(await CryptoUtils.comparePassword(NEW_PASSWORD, afterChange.password_hash));

    const activeSessions = await Database.query(
      `SELECT 1 FROM user_sessions WHERE user_id = $1 AND is_revoked = FALSE;`,
      [zoneAdmin.id]
    );
    assert.strictEqual(activeSessions.rows.length, 0, 'Mọi session phải bị thu hồi');

    const audits = await Database.query(
      `SELECT 1 FROM system_audit_logs WHERE entity_id = $1 AND action = 'USER_CHANGED_OWN_PASSWORD';`,
      [zoneAdmin.id]
    );
    assert.strictEqual(audits.rows.length, 1, 'Phải có đúng 1 audit');

    assert.strictEqual((await call('GET', '/auth/me', oldToken)).status, 401, 'Token cũ phải bị từ chối');
    assert.strictEqual((await call('GET', '/auth/me', legacyToken)).status, 401, 'Token không claim phải bị từ chối');
    assert.strictEqual((await call('GET', '/auth/me', newToken)).status, 200, 'Token mới phải dùng được');

    // 7. Zone Admin không tự sửa hồ sơ, Super Admin vẫn sửa được
    const blocked = await call('PUT', '/auth/me', newToken, { fullName: 'Tên Bị Chặn' });
    assert.strictEqual(blocked.status, 403);
    const superToken = await loginToken(superAdmin.username, OLD_PASSWORD);
    assert.strictEqual((await call('PUT', '/auth/me', superToken, { phone: '0900000000' })).status, 200);

    // 6. Super Admin đặt lại mật khẩu cũng vô hiệu token đang dùng
    await AuthService.resetPassword(zoneAdmin.id, 'ResetPass@789', superAdmin.id);
    assert.strictEqual((await call('GET', '/auth/me', newToken)).status, 401, 'Reset phải thu hồi token');

    // 8. Khảo sát viên không tự sửa được bất kỳ trường hồ sơ nào, kể cả body rỗng hoặc sai định dạng
    const surveyorToken = await loginToken(surveyor.username, OLD_PASSWORD);
    const readSurveyorProfile = async () =>
      (
        await Database.query(`SELECT full_name, email, phone, signature_image_url, updated_at FROM users WHERE id = $1;`, [
          surveyor.id,
        ])
      ).rows[0];
    const profileBefore = await readSurveyorProfile();
    const surveyorBodies = [
      { fullName: 'Tên Tự Đổi' },
      { email: 'tu-doi@example.com' },
      { phone: '0911111111' },
      { signatureImageUrl: 'https://example.com/chu-ky.png' },
      {},
      { email: 'khong-phai-email' },
    ];
    for (const body of surveyorBodies) {
      const res = await call('PUT', '/auth/me', surveyorToken, body);
      assert.strictEqual(res.status, 403, `Khảo sát viên phải nhận 403: ${JSON.stringify(body)}`);
    }
    assert.deepStrictEqual(await readSurveyorProfile(), profileBefore, 'Hồ sơ Khảo sát viên không được thay đổi');

    assert.strictEqual((await call('GET', '/auth/me', surveyorToken)).status, 200);
    const surveyorChanged = await call('POST', '/auth/change-password', surveyorToken, {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    assert.strictEqual(surveyorChanged.status, 200, 'Khảo sát viên vẫn phải đổi được mật khẩu');

    console.log('✅ test_zone_admin_change_password: toàn bộ kịch bản đạt');
  } finally {
    await AuthRepository.softDeleteUser(zoneAdmin.id);
    await AuthRepository.softDeleteUser(superAdmin.id);
    await AuthRepository.softDeleteUser(surveyor.id);
    server.close();
    await pool.end();
  }
}

run().catch((err: unknown) => {
  console.error('[test_zone_admin_change_password] Thất bại:', err);
  process.exitCode = 1;
});
