import { Database } from '../../database/db';

export interface UserEntity {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR';
  assigned_zone_id: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
  status_reason: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class AuthRepository {
  static async findByUsername(username: string): Promise<UserEntity | null> {
    const res = await Database.query<UserEntity>(
      `SELECT * FROM users WHERE username = $1 AND deleted_at IS NULL LIMIT 1;`,
      [username]
    );
    return res.rows[0] || null;
  }

  static async findById(id: string): Promise<UserEntity | null> {
    const res = await Database.query<UserEntity>(
      `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1;`,
      [id]
    );
    return res.rows[0] || null;
  }

  static async listUsers(filters: {
    role?: string;
    zoneId?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: UserEntity[]; total: number }> {
    let whereClause = `WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (filters.role) {
      params.push(filters.role);
      whereClause += ` AND role = $${params.length}`;
    }
    if (filters.zoneId) {
      params.push(filters.zoneId);
      whereClause += ` AND assigned_zone_id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      whereClause += ` AND status = $${params.length}`;
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      whereClause += ` AND (username ILIKE $${params.length} OR full_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    const countRes = await Database.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM users ${whereClause};`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    params.push(limit, offset);

    const res = await Database.query<UserEntity>(
      `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length};`,
      params
    );

    return { users: res.rows, total };
  }

  static async createUser(userData: {
    username: string;
    passwordHash: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    role: string;
    assignedZoneId?: string | null;
  }): Promise<UserEntity> {
    const res = await Database.query<UserEntity>(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role, assigned_zone_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
       RETURNING *;`,
      [
        userData.username,
        userData.passwordHash,
        userData.fullName,
        userData.email || null,
        userData.phone || null,
        userData.role,
        userData.assignedZoneId || null,
      ]
    );
    return res.rows[0];
  }

  static async updateUser(
    id: string,
    data: {
      fullName?: string;
      email?: string | null;
      phone?: string | null;
      role?: string;
      assignedZoneId?: string | null;
    }
  ): Promise<UserEntity | null> {
    const fields: string[] = [];
    const params: any[] = [id];

    if (data.fullName !== undefined) {
      params.push(data.fullName);
      fields.push(`full_name = $${params.length}`);
    }
    if (data.email !== undefined) {
      params.push(data.email);
      fields.push(`email = $${params.length}`);
    }
    if (data.phone !== undefined) {
      params.push(data.phone);
      fields.push(`phone = $${params.length}`);
    }
    if (data.role !== undefined) {
      params.push(data.role);
      fields.push(`role = $${params.length}`);
    }
    if (data.assignedZoneId !== undefined) {
      params.push(data.assignedZoneId);
      fields.push(`assigned_zone_id = $${params.length}`);
    }

    if (fields.length === 0) return this.findById(id);

    const res = await Database.query<UserEntity>(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *;`,
      params
    );
    return res.rows[0] || null;
  }

  static async updateStatus(id: string, status: string, reason?: string): Promise<UserEntity | null> {
    const res = await Database.query<UserEntity>(
      `UPDATE users SET status = $2, status_reason = $3, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *;`,
      [id, status, reason || null]
    );
    return res.rows[0] || null;
  }

  static async updatePassword(id: string, passwordHash: string): Promise<boolean> {
    const res = await Database.query(
      `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL;`,
      [id, passwordHash]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async softDeleteUser(id: string): Promise<boolean> {
    const res = await Database.query(
      `UPDATE users SET deleted_at = NOW(), status = 'LOCKED' WHERE id = $1 AND deleted_at IS NULL;`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async saveSession(sessionData: {
    userId: string;
    refreshTokenHash: string;
    clientIp?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<void> {
    await Database.query(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, client_ip, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5);`,
      [
        sessionData.userId,
        sessionData.refreshTokenHash,
        sessionData.clientIp || null,
        sessionData.userAgent || null,
        sessionData.expiresAt,
      ]
    );
  }

  static async revokeSession(refreshTokenHash: string): Promise<void> {
    await Database.query(
      `UPDATE user_sessions SET is_revoked = TRUE WHERE refresh_token_hash = $1;`,
      [refreshTokenHash]
    );
  }

  static async isSessionActive(refreshTokenHash: string): Promise<boolean> {
    const res = await Database.query<{ is_revoked: boolean; expires_at: Date }>(
      `SELECT is_revoked, expires_at FROM user_sessions WHERE refresh_token_hash = $1 LIMIT 1;`,
      [refreshTokenHash]
    );
    if (!res.rows[0]) return false;
    const session = res.rows[0];
    return !session.is_revoked && new Date(session.expires_at) > new Date();
  }
}
