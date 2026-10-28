import { Database } from '../../../database/db';
import { DEFAULT_PROGRESS_CONFIG } from './default-config';
import { progressReportConfigSchema, type ProgressReportConfig } from './config.schema';

export interface ResolvedConfig {
  config: ProgressReportConfig;
  version: number | null; // null = đang dùng DEFAULT trong code
  source: 'DB' | 'DEFAULT';
}

export interface ConfigVersionInfo {
  versionNumber: number;
  changeReason: string;
  createdAt: string;
  createdByName: string | null;
}

/**
 * ConfigProvider: đọc phiên bản cấu hình mới nhất, validate bằng Zod, fallback DEFAULT.
 * Bảng chưa tồn tại (chưa chạy migration) cũng fallback an toàn, không làm hỏng export.
 */
export class ProgressConfigProvider {
  static async getActive(): Promise<ResolvedConfig> {
    try {
      const res = await Database.query<{ version_number: number; content_json: unknown }>(
        `SELECT version_number, content_json
           FROM progress_report_config_versions
          WHERE deleted_at IS NULL
          ORDER BY version_number DESC
          LIMIT 1;`
      );
      const row = res.rows[0];
      if (!row) {
        return { config: DEFAULT_PROGRESS_CONFIG, version: null, source: 'DEFAULT' };
      }
      const parsed = progressReportConfigSchema.safeParse(row.content_json);
      if (!parsed.success) {
        console.error('[ProgressReport] Cấu hình DB không hợp lệ, dùng DEFAULT:', parsed.error.flatten());
        return { config: DEFAULT_PROGRESS_CONFIG, version: null, source: 'DEFAULT' };
      }
      return { config: parsed.data, version: row.version_number, source: 'DB' };
    } catch (err: unknown) {
      console.error('[ProgressReport] Không đọc được progress_report_config_versions, dùng DEFAULT:', err);
      return { config: DEFAULT_PROGRESS_CONFIG, version: null, source: 'DEFAULT' };
    }
  }

  static async listVersions(limit = 20): Promise<ConfigVersionInfo[]> {
    try {
      const res = await Database.query<{
        version_number: number;
        change_reason: string;
        created_at: Date;
        full_name: string | null;
      }>(
        `SELECT v.version_number, v.change_reason, v.created_at, u.full_name
           FROM progress_report_config_versions v
           LEFT JOIN users u ON u.id = v.created_by_user_id
          WHERE v.deleted_at IS NULL
          ORDER BY v.version_number DESC
          LIMIT $1;`,
        [limit]
      );
      return res.rows.map((r) => ({
        versionNumber: r.version_number,
        changeReason: r.change_reason,
        createdAt: new Date(r.created_at).toISOString(),
        createdByName: r.full_name,
      }));
    } catch (err: unknown) {
      console.error('[ProgressReport] Không đọc được lịch sử progress_report_config_versions:', err);
      return [];
    }
  }

  /** Append-only: luôn tạo version mới, không UPDATE/DELETE bản cũ. */
  static async saveNewVersion(
    content: ProgressReportConfig,
    changeReason: string,
    userId: string
  ): Promise<number> {
    return Database.transaction(async (client) => {
      await client.query('LOCK TABLE progress_report_config_versions IN SHARE ROW EXCLUSIVE MODE;');
      const next = await client.query<{ next: number }>(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM progress_report_config_versions;`
      );
      const versionNumber = Number(next.rows[0]?.next ?? 1);
      await client.query(
        `INSERT INTO progress_report_config_versions (version_number, content_json, change_reason, created_by_user_id)
         VALUES ($1, $2, $3, $4);`,
        [versionNumber, JSON.stringify(content), changeReason, userId]
      );
      return versionNumber;
    });
  }
}

