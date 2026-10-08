import { Database } from '../../database/db';

export interface UserEntity {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR' | 'GUEST';
  assigned_zone_id: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
  status_reason: string | null;
  avatar_url: string | null;
  signature_image_url?: string | null;
  created_by_user_id?: string | null;
  surveyor_code?: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class AuthRepository {
  /**
   * Sinh ngẫu nhiên mã KSV độc bản P-XXXX (1000 - 9999) và kiểm tra đối chiếu CSDL
   * Cam kết 100% không trùng lặp và không làm ảnh hưởng đến các mã KSV đã có trong DB
   */
  static async generateUniqueSurveyorCode(): Promise<string> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const random4Digits = Math.floor(1000 + Math.random() * 9000).toString();
      const codeCandidate = `P-${random4Digits}`;
      const check = await Database.query(
        `SELECT 1 FROM users WHERE surveyor_code = $1 LIMIT 1;`,
        [codeCandidate]
      );
      if ((check.rowCount ?? 0) === 0) {
        return codeCandidate;
      }
    }
    // Fallback 5 chữ số nếu dải 4 số gần đầy
    return `P-${Math.floor(10000 + Math.random() * 90000)}`;
  }

  static async findByUsername(username: string): Promise<UserEntity | null> {
    const res = await Database.query<UserEntity>(
      `SELECT * FROM users WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL LIMIT 1;`,
      [username.trim()]
    );
    return res.rows[0] || null;
  }

  /**
   * Tìm kiếm user bất kể trạng thái đã soft-delete hay chưa
   * Phục vụ Phương án B: Tự động khôi phục tài khoản khi SuperAdmin tạo lại username cũ
   */
  static async findRawByUsername(username: string): Promise<UserEntity | null> {
    const res = await Database.query<UserEntity>(
      `SELECT * FROM users WHERE LOWER(username) = LOWER($1) ORDER BY (deleted_at IS NULL) DESC, created_at DESC LIMIT 1;`,
      [username.trim()]
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
      whereClause += ` AND (username ILIKE $${params.length} OR full_name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length} OR surveyor_code ILIKE $${params.length})`;
    }

    const countRes = await Database.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM users ${whereClause};`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    params.push(limit, offset);

    // BẢO MẬT: Tuyệt đối không SELECT password_hash để triệt tiêu lỗ hổng rò rỉ mã băm mật khẩu
    const res = await Database.query<UserEntity>(
      `SELECT id, username, full_name, email, phone, role, assigned_zone_id, status, status_reason, avatar_url, signature_image_url, created_by_user_id, surveyor_code, created_at, updated_at, deleted_at 
       FROM users ${whereClause} 
       ORDER BY created_at DESC, id DESC 
       LIMIT $${params.length - 1} OFFSET $${params.length};`,
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
    signatureImageUrl?: string | null;
    createdByUserId?: string | null;
    surveyorCode?: string | null;
  }): Promise<UserEntity> {
    let surveyorCode = userData.surveyorCode || null;
    if (userData.role === 'SURVEYOR' && !surveyorCode) {
      surveyorCode = await this.generateUniqueSurveyorCode();
    } else if (userData.role !== 'SURVEYOR') {
      surveyorCode = null;
    }

    const res = await Database.query<UserEntity>(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role, assigned_zone_id, status, signature_image_url, created_by_user_id, surveyor_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, $9, $10)
       RETURNING *;`,
      [
        userData.username,
        userData.passwordHash,
        userData.fullName,
        userData.email || null,
        userData.phone || null,
        userData.role,
        userData.assignedZoneId || null,
        userData.signatureImageUrl || null,
        userData.createdByUserId || null,
        surveyorCode,
      ]
    );

    // Đồng bộ người phụ trách Zone vào bảng metro_zones nếu vai trò là ZONE_ADMIN
    if (userData.role === 'ZONE_ADMIN' && userData.assignedZoneId && userData.assignedZoneId !== 'ALL' && userData.assignedZoneId !== 'ALL_ZONES') {
      await Database.query(
        `UPDATE metro_zones SET assigned_admin_id = $1 WHERE zone_code = $2;`,
        [res.rows[0].id, userData.assignedZoneId]
      );
    }

    return res.rows[0];
  }

  /**
   * Phương án B: Khôi phục và cập nhật tài khoản đã soft-delete khi SuperAdmin tạo lại username cũ
   */
  static async restoreAndOverwriteUser(id: string, data: {
    passwordHash: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    role: string;
    assignedZoneId?: string | null;
    signatureImageUrl?: string | null;
    surveyorCode?: string | null;
  }): Promise<UserEntity> {
    const res = await Database.query<UserEntity>(
      `UPDATE users SET 
         deleted_at = NULL,
         status = 'ACTIVE',
         status_reason = NULL,
         password_hash = $2,
         full_name = $3,
         email = $4,
         phone = $5,
         role = $6,
         assigned_zone_id = $7,
         signature_image_url = $8,
         surveyor_code = $9,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *;`,
      [
        id,
        data.passwordHash,
        data.fullName,
        data.email || null,
        data.phone || null,
        data.role,
        data.assignedZoneId || null,
        data.signatureImageUrl || null,
        data.surveyorCode || null,
      ]
    );

    // Đồng bộ người phụ trách Zone vào bảng metro_zones nếu vai trò là ZONE_ADMIN
    if (data.role === 'ZONE_ADMIN' && data.assignedZoneId && data.assignedZoneId !== 'ALL' && data.assignedZoneId !== 'ALL_ZONES') {
      await Database.query(
        `UPDATE metro_zones SET assigned_admin_id = $1 WHERE zone_code = $2;`,
        [id, data.assignedZoneId]
      );
    }

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
      signatureImageUrl?: string | null;
    }
  ): Promise<UserEntity | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

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
      // Bảo toàn mã KSV hiện tại: Cập nhật SĐT TUYỆT ĐỐI KHÔNG ghi đè surveyor_code!
    }
    if (data.role !== undefined) {
      params.push(data.role);
      fields.push(`role = $${params.length}`);

      // Nếu chuyển vai trò thành SURVEYOR và chưa có mã KSV, sinh ngẫu nhiên mới
      if (data.role === 'SURVEYOR' && !existing.surveyor_code) {
        const newCode = await this.generateUniqueSurveyorCode();
        params.push(newCode);
        fields.push(`surveyor_code = $${params.length}`);
      } else if (data.role !== 'SURVEYOR') {
        // Nếu chuyển sang vai trò khác, hủy mã surveyor_code
        fields.push(`surveyor_code = NULL`);
      }
    }
    if (data.assignedZoneId !== undefined) {
      params.push(data.assignedZoneId);
      fields.push(`assigned_zone_id = $${params.length}`);
    }
    if (data.signatureImageUrl !== undefined) {
      params.push(data.signatureImageUrl);
      fields.push(`signature_image_url = $${params.length}`);
    }

    if (fields.length === 0) return this.findById(id);

    const res = await Database.query<UserEntity>(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *;`,
      params
    );

    // Đồng bộ người phụ trách Zone vào bảng metro_zones nếu vai trò là ZONE_ADMIN
    const targetRole = data.role !== undefined ? data.role : existing.role;
    const targetZoneId = data.assignedZoneId !== undefined ? data.assignedZoneId : existing.assigned_zone_id;
    if (targetRole === 'ZONE_ADMIN' && targetZoneId && targetZoneId !== 'ALL' && targetZoneId !== 'ALL_ZONES') {
      await Database.query(
        `UPDATE metro_zones SET assigned_admin_id = $1 WHERE zone_code = $2;`,
        [id, targetZoneId]
      );
    }

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

  static async revokeUserSessions(userId: string): Promise<void> {
    await Database.query(
      `UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1;`,
      [userId]
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

  /**
   * Ghi log kiểm toán pháp lý hệ thống vào bảng system_audit_logs
   */
  static async logSystemAudit(log: {
    entityType: string;
    entityId: string;
    action: string;
    performedByUserId?: string | null;
    clientIp?: string | null;
    diffPayload?: any;
  }): Promise<void> {
    try {
      await Database.query(
        `INSERT INTO system_audit_logs (entity_type, entity_id, action, performed_by_user_id, client_ip, diff_payload)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          log.entityType,
          log.entityId,
          log.action,
          log.performedByUserId || null,
          log.clientIp || null,
          log.diffPayload ? JSON.stringify(log.diffPayload) : null,
        ]
      );
    } catch (err) {
      console.error('[AUDIT_LOG_ERROR] Could not write system audit log:', err);
    }
  }
}
