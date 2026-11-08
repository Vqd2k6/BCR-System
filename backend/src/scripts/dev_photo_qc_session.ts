/**
 * Tiện ích dev: ký JWT ngắn hạn cho một Zone Admin local để chụp màn Photo QC bằng puppeteer.
 * Chạy: npx ts-node --transpile-only src/scripts/dev_photo_qc_session.ts <zone> <outFile>
 * Chỉ dùng với CSDL local; token hết hạn sau 20 phút.
 */
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { Database } from '../database/db';

(async () => {
  const zone = (process.argv[2] || 'ZONE_09').toUpperCase();
  const out = process.argv[3];
  const r = await Database.query<{ id: string; username: string; full_name: string; role: string; assigned_zone_id: string; token_version: number }>(
    `SELECT id, username, full_name, role, assigned_zone_id, token_version FROM users
     WHERE role = 'ZONE_ADMIN' AND UPPER(assigned_zone_id) = $1 AND deleted_at IS NULL AND status = 'ACTIVE' LIMIT 1;`,
    [zone]
  );
  const u = r.rows[0];
  if (!u || !out) {
    console.error('[dev_photo_qc_session] Không có Zone Admin cho', zone);
    process.exit(1);
  }
  const token = jwt.sign(
    { userId: u.id, username: u.username, role: u.role, assignedZoneId: u.assigned_zone_id, fullName: u.full_name, tokenVersion: u.token_version },
    config.jwt.secret,
    { expiresIn: '20m' }
  );
  fs.writeFileSync(out, JSON.stringify({ token, profile: { id: u.id, username: u.username, role: u.role, assignedZoneId: u.assigned_zone_id, fullName: u.full_name } }));
  console.log('ok', u.username);
  process.exit(0);
})();
