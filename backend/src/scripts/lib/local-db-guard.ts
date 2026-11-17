/**
 * Chốt an toàn cho các script GHI/XOÁ dữ liệu chỉ được phép chạy trên PostgreSQL Docker local.
 *
 * Lớp 1 (trước khi kết nối): host phải là loopback (localhost / 127.0.0.1 / ::1).
 * Lớp 2 (sau khi kết nối, trước BEGIN/TRUNCATE): máy chủ không được mang dấu hiệu Supabase
 *   (role hệ thống của Supabase) — chặn cả trường hợp localhost bị port-forward/tunnel lên Cloud —
 *   và current_database() phải đúng tên DB đích.
 */
import type { PoolClient } from 'pg';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const SUPABASE_MARKER_ROLES = ['supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin', 'authenticator'];

export interface LocalTargetConfig {
  host: string;
  port: number;
  database: string;
}

/** Lớp 1: gọi TRƯỚC khi tạo Pool/kết nối. Ném lỗi nếu host không phải loopback. */
export function assertLoopbackHost(target: LocalTargetConfig, tag: string): void {
  const host = target.host.trim().toLowerCase();
  if (!LOOPBACK_HOSTS.has(host)) {
    const message =
      `Từ chối chạy: DB đích ${target.host}:${target.port}/${target.database} không phải máy local. ` +
      `Script này ghi/xoá dữ liệu nên chỉ được chạy trên Docker local (localhost). ` +
      `Kiểm tra DB_HOST trong backend/.env.`;
    console.error(`[${tag}:Guard] ${message}`);
    throw new Error(message);
  }
}

/** Lớp 2: gọi SAU khi kết nối, TRƯỚC BEGIN/TRUNCATE. Ném lỗi nếu máy chủ là Supabase hoặc sai DB. */
export async function assertLocalServer(client: PoolClient, target: LocalTargetConfig, tag: string): Promise<void> {
  const { rows } = await client.query<{ current_db: string; supabase_roles: number }>(
    `SELECT current_database() AS current_db,
            (SELECT count(*)::int FROM pg_roles WHERE rolname = ANY($1::text[])) AS supabase_roles;`,
    [SUPABASE_MARKER_ROLES]
  );
  const info = rows[0];
  if (!info) {
    const message = 'Không đọc được thông tin máy chủ PostgreSQL để xác minh DB đích.';
    console.error(`[${tag}:Guard] ${message}`);
    throw new Error(message);
  }
  if (info.supabase_roles > 0) {
    const message =
      `Từ chối chạy: máy chủ tại ${target.host}:${target.port} có role hệ thống Supabase ` +
      `(${info.supabase_roles}) — đây là Cloud, không phải Docker local.`;
    console.error(`[${tag}:Guard] ${message}`);
    throw new Error(message);
  }
  if (info.current_db !== target.database) {
    const message = `Từ chối chạy: đang kết nối DB "${info.current_db}" thay vì DB đích "${target.database}".`;
    console.error(`[${tag}:Guard] ${message}`);
    throw new Error(message);
  }
}
