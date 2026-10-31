/**
 * Vá tham chiếu `users` bị mồ côi sau khi sync/restore từ Cloud. CHỈ chạy trên Docker local.
 *
 *   npm run db:repair-orphan-users
 *   TARGET_DB=metro2_audit_test npm run db:repair-orphan-users
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ensureUserRefs, findOrphanUserRefs } from './lib/ensure-user-refs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const LOCAL_PORT = 5433;

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || String(LOCAL_PORT), 10),
  user: process.env.DB_USER || 'metro2_user',
  password: process.env.DB_PASSWORD || 'metro2_secure_password',
  database: process.env.TARGET_DB || process.env.DB_NAME || 'metro2_gis_db',
};

async function main(): Promise<void> {
  if (!LOCAL_HOSTS.has(config.host) || config.port !== LOCAL_PORT) {
    throw new Error(`Từ chối chạy: chỉ cho phép localhost:${LOCAL_PORT}, nhận ${config.host}:${config.port}.`);
  }

  const pool = new Pool({ ...config, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    const { references, stubsCreated } = await ensureUserRefs(client);
    const remaining = await findOrphanUserRefs(client);
    if (remaining.references.length > 0) {
      throw new Error(`Vẫn còn ${remaining.references.length} cột mồ côi sau khi vá.`);
    }
    await client.query('COMMIT;');

    console.log(`[RepairOrphanUsers] Database: ${config.database}`);
    for (const ref of references) {
      console.log(`  ${ref.tableName}.${ref.columnName}: ${ref.orphanRows} dòng`);
    }
    console.log(`[RepairOrphanUsers] Đã tạo ${stubsCreated} user stub, còn 0 tham chiếu mồ côi.`);
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[RepairOrphanUsers:Main] Vá dữ liệu thất bại:', err);
  process.exit(1);
});
