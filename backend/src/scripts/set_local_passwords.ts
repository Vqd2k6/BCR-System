/**
 * ============================================================================
 * ĐẶT MẬT KHẨU ĐĂNG NHẬP CHO TÀI KHOẢN TRONG DB DOCKER LOCAL
 * ============================================================================
 * Vì sao cần: `sync:from-cloud` cố ý không kéo password_hash (để không ghi hash ra file
 * snapshot), user đồng bộ về mang hash giả `!cloud-sync-no-login!` nên không đăng nhập local được.
 *
 * Cách dùng (trong thư mục backend):
 *   npm run db:set-local-passwords                       # superadmin, zoneadmin, surveyor_s9_01
 *   npm run db:set-local-passwords -- vqd2k6 zone_admin  # chỉ định username
 *   LOCAL_LOGIN_PASSWORD='Mk@456' npm run db:set-local-passwords
 *
 * An toàn:
 * - Chỉ chạy trên Docker local (chốt `lib/local-db-guard.ts`: host loopback + không phải Supabase).
 * - Chỉ UPDATE cột password_hash/updated_at của đúng username chỉ định, trong 1 transaction.
 *   Không đổi status/role, không xoá dữ liệu, không đụng Cloud.
 * - `sync:from-cloud` sau này giữ nguyên mật khẩu này (chỉ làm mới user còn mang hash giả).
 * ============================================================================
 */
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { CryptoUtils } from '../common/utils/crypto.utils';
import { assertLocalServer, assertLoopbackHost } from './lib/local-db-guard';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const GUARD_TAG = 'SetLocalPasswords';
const DEFAULT_USERNAMES = ['superadmin', 'zoneadmin', 'surveyor_s9_01'];
const DEFAULT_LOCAL_PASSWORD = 'Admin@123';

const LOCAL_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  user: process.env.DB_USER || 'metro2_user',
  password: process.env.DB_PASSWORD || 'metro2_secure_password',
  database: process.env.TARGET_DB || process.env.DB_NAME || 'metro2_gis_db',
};

interface UpdatedUserRow {
  username: string;
  role: string;
  status: string;
}

async function setLocalPasswords(): Promise<void> {
  assertLoopbackHost(LOCAL_CONFIG, GUARD_TAG);

  const argUsernames = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  const usernames = argUsernames.length > 0 ? argUsernames : DEFAULT_USERNAMES;
  const password = process.env.LOCAL_LOGIN_PASSWORD || DEFAULT_LOCAL_PASSWORD;

  console.log(`💻 DB đích: ${LOCAL_CONFIG.host}:${LOCAL_CONFIG.port}/${LOCAL_CONFIG.database}`);
  console.log(`👤 Tài khoản: ${usernames.join(', ')}`);

  const pool = new Pool({ ...LOCAL_CONFIG, max: 1 });
  let client: PoolClient | null = null;
  let failed = false;

  try {
    client = await pool.connect();
    await assertLocalServer(client, LOCAL_CONFIG, GUARD_TAG);

    const passwordHash = await CryptoUtils.hashPassword(password);

    await client.query('BEGIN;');
    for (const username of usernames) {
      const { rows } = await client.query<UpdatedUserRow>(
        `UPDATE users
            SET password_hash = $1, updated_at = NOW()
          WHERE lower(username) = lower($2) AND deleted_at IS NULL
          RETURNING username, role::text AS role, status::text AS status;`,
        [passwordHash, username]
      );
      const row = rows[0];
      if (!row) {
        failed = true;
        console.error(`[${GUARD_TAG}:Update] ❌ Không tìm thấy tài khoản đang hoạt động: "${username}"`);
        continue;
      }
      const note = row.status === 'ACTIVE' ? '' : `  ⚠️ status=${row.status} → vẫn KHÔNG đăng nhập được`;
      console.log(`   ✅ ${row.username} (${row.role})${note}`);
    }

    if (failed) {
      await client.query('ROLLBACK;');
      console.error(`[${GUARD_TAG}:Update] Đã ROLLBACK, không đổi mật khẩu tài khoản nào. Kiểm tra lại username.`);
      process.exitCode = 1;
      return;
    }
    await client.query('COMMIT;');
    console.log('🎉 Đã đặt mật khẩu local. Đăng nhập bằng mật khẩu này trên http://localhost:3000');
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK;');
      } catch (rollbackErr) {
        console.error(`[${GUARD_TAG}:Rollback] Lỗi ROLLBACK:`, rollbackErr);
      }
    }
    throw err;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

setLocalPasswords().catch((err: unknown) => {
  console.error(`[${GUARD_TAG}:Fatal]`, err instanceof Error ? err.message : err);
  process.exit(1);
});
