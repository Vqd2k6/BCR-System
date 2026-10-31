/**
 * Bảo toàn tham chiếu tới `users` cho các luồng nạp dữ liệu ở
 * `session_replication_role = 'replica'` (sync Cloud, restore snapshot).
 *
 * Chế độ replica tắt kiểm tra FK, nên hồ sơ trỏ tới user chưa có ở local vẫn nạp được
 * nhưng sẽ lỗi FK ở lần UPDATE thứ hai trên cùng dòng trong một transaction
 * (VD: audit-edit, rollback phiên bản).
 *
 * Chỉ dùng cho DB local. Không đưa vào migration vì stub không phải dữ liệu thật.
 */
import type { PoolClient } from 'pg';

/** Không phải hash bcrypt hợp lệ, nên tài khoản không thể đăng nhập. */
export const UNUSABLE_PASSWORD_HASH = '!cloud-sync-no-login!';

const ADMIN_REFERENCE_COLUMNS = new Set(['zone_admin_id', 'assigned_admin_id']);

export interface CloudUserRow {
  id: string;
  username: string;
  full_name: string;
  role: string;
  status?: string | null;
  email?: string | null;
  phone?: string | null;
  assigned_zone_id?: string | null;
  surveyor_code?: string | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
  deleted_at?: string | Date | null;
  [column: string]: unknown;
}

export interface OrphanReference {
  tableName: string;
  columnName: string;
  orphanRows: number;
}

export interface EnsureUserRefsResult {
  references: OrphanReference[];
  stubsCreated: number;
}

export interface MergeCloudUsersResult {
  merged: number;
  skippedUsernameConflict: number;
}

interface UserForeignKey {
  table_name: string;
  column_name: string;
  orphan_sql: string;
}

/** Bỏ `password_hash` để hash mật khẩu Cloud không bao giờ bị ghi ra file snapshot. */
export function stripPasswordHash<T extends Record<string, unknown>>(row: T): Omit<T, 'password_hash'> {
  const { password_hash: _omitted, ...safeRow } = row;
  return safeRow;
}

async function listUserForeignKeys(client: PoolClient): Promise<UserForeignKey[]> {
  const { rows } = await client.query<UserForeignKey>(
    `SELECT c.conrelid::regclass::text AS table_name,
            a.attname AS column_name,
            format(
              'SELECT t.%1$I AS id, count(*)::int AS row_count FROM %2$s t
               LEFT JOIN public.users u ON u.id = t.%1$I
               WHERE t.%1$I IS NOT NULL AND u.id IS NULL
               GROUP BY t.%1$I',
              a.attname,
              c.conrelid::regclass
            ) AS orphan_sql
     FROM pg_constraint c
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass
     ORDER BY 1, 2;`
  );
  return rows;
}

/** Quét mọi FK trỏ `users`, trả về số dòng mồ côi theo từng cột và tập id còn thiếu. */
export async function findOrphanUserRefs(client: PoolClient): Promise<{
  references: OrphanReference[];
  roleByUserId: Map<string, 'SURVEYOR' | 'ZONE_ADMIN'>;
}> {
  const references: OrphanReference[] = [];
  const roleByUserId = new Map<string, 'SURVEYOR' | 'ZONE_ADMIN'>();

  for (const fk of await listUserForeignKeys(client)) {
    const { rows } = await client.query<{ id: string; row_count: number }>(fk.orphan_sql);
    if (rows.length === 0) continue;

    references.push({
      tableName: fk.table_name,
      columnName: fk.column_name,
      orphanRows: rows.reduce((sum, row) => sum + row.row_count, 0),
    });

    const isAdminColumn = ADMIN_REFERENCE_COLUMNS.has(fk.column_name);
    for (const { id } of rows) {
      if (!isAdminColumn) {
        if (fk.column_name === 'surveyor_id' || !roleByUserId.has(id)) roleByUserId.set(id, 'SURVEYOR');
      } else if (!roleByUserId.has(id)) {
        roleByUserId.set(id, 'ZONE_ADMIN');
      }
    }
  }
  return { references, roleByUserId };
}

/**
 * Nạp user Cloud vào local: chỉ thêm user còn thiếu hoặc làm mới dòng do sync tạo,
 * không đụng tới tài khoản đăng nhập local.
 */
export async function mergeCloudUsers(client: PoolClient, users: CloudUserRow[]): Promise<MergeCloudUsersResult> {
  let merged = 0;
  let skippedUsernameConflict = 0;

  for (const user of users) {
    if (!user.deleted_at) {
      const conflict = await client.query(
        `SELECT 1 FROM users WHERE lower(username) = lower($1) AND deleted_at IS NULL AND id <> $2 LIMIT 1;`,
        [user.username, user.id]
      );
      if (conflict.rows.length > 0) {
        skippedUsernameConflict += 1;
        continue;
      }
    }

    const result = await client.query(
      `INSERT INTO users (
         id, username, password_hash, full_name, email, phone, role, assigned_zone_id,
         status, surveyor_code, created_at, updated_at, deleted_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7::role_enum, $8,
         COALESCE($9::user_status_enum, 'ACTIVE'::user_status_enum), $10,
         COALESCE($11::timestamptz, NOW()), COALESCE($12::timestamptz, NOW()), $13::timestamptz
       )
       ON CONFLICT (id) DO UPDATE SET
         username = EXCLUDED.username,
         full_name = EXCLUDED.full_name,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         role = EXCLUDED.role,
         assigned_zone_id = EXCLUDED.assigned_zone_id,
         status = EXCLUDED.status,
         surveyor_code = EXCLUDED.surveyor_code,
         updated_at = EXCLUDED.updated_at,
         deleted_at = EXCLUDED.deleted_at
       WHERE users.password_hash = $3;`,
      [
        user.id,
        user.username,
        UNUSABLE_PASSWORD_HASH,
        user.full_name,
        user.email ?? null,
        user.phone ?? null,
        user.role,
        user.assigned_zone_id ?? null,
        user.status ?? null,
        user.surveyor_code ?? null,
        user.created_at ?? null,
        user.updated_at ?? null,
        user.deleted_at ?? null,
      ]
    );
    merged += result.rowCount ?? 0;
  }

  return { merged, skippedUsernameConflict };
}

/**
 * Tạo dòng stub cho mọi user còn bị tham chiếu nhưng không có ở local.
 * Stub giữ nguyên UUID để không đổi quy kết hồ sơ, bị khóa và soft-delete nên không đăng nhập được.
 */
export async function ensureUserRefs(client: PoolClient): Promise<EnsureUserRefsResult> {
  const { references, roleByUserId } = await findOrphanUserRefs(client);
  let stubsCreated = 0;

  for (const [userId, role] of roleByUserId) {
    const shortId = userId.slice(0, 8);
    const result = await client.query(
      `INSERT INTO users (id, username, password_hash, full_name, role, status, deleted_at)
       VALUES ($1, $2, $3, $4, $5::role_enum, 'LOCKED'::user_status_enum, NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [userId, `cloud_${userId.replace(/-/g, '')}`, UNUSABLE_PASSWORD_HASH, `Tài khoản Cloud chưa đồng bộ (${shortId})`, role]
    );
    stubsCreated += result.rowCount ?? 0;
  }

  return { references, stubsCreated };
}
