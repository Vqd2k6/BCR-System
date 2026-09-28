import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';

// Khởi tạo PostgreSQL connection pool
export const pool = new Pool(config.db);

pool.on('error', (err) => {
  console.error('[DATABASE ERROR] Unexpected error on idle client:', err);
});

export class Database {
  /**
   * Thực thi câu lệnh SQL đơn lẻ thông qua connection pool
   */
  static async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await pool.query<T>(text, params);
      const duration = Date.now() - start;
      if (config.env === 'development' && duration > 100) {
        console.warn(`[SLOW QUERY] ${duration}ms: ${text.slice(0, 100)}...`);
      }
      return res;
    } catch (error) {
      console.error('[DATABASE QUERY ERROR]', { text, params, error });
      throw error;
    }
  }

  /**
   * Thực thi chuỗi thao tác bên trong một Database Transaction an toàn
   * Tự động BEGIN, COMMIT và ROLLBACK khi có ngoại lệ
   */
  static async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[TRANSACTION ROLLBACK ERROR]', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Kiểm tra kết nối CSDL và PostGIS extension
   */
  static async healthCheck(): Promise<{ status: string; postgisVersion?: string }> {
    try {
      const res = await this.query('SELECT PostGIS_Version() AS postgis_version, NOW() AS now;');
      return {
        status: 'UP',
        postgisVersion: res.rows[0]?.postgis_version,
      };
    } catch (error: any) {
      return {
        status: 'DOWN',
      };
    }
  }

  /**
   * Tự động áp dụng các câu lệnh DDL phòng vệ (ADD COLUMN IF NOT EXISTS)
   * Đảm bảo mọi môi trường (Docker, Local, Supabase Render) luôn có đầy đủ cột dữ liệu mới
   */
  static async runStartupMigrations(): Promise<void> {
    try {
      // 1. base_survey_reports
      await this.query(`
        ALTER TABLE base_survey_reports
          ADD COLUMN IF NOT EXISTS sync_version INT NOT NULL DEFAULT 1,
          ADD COLUMN IF NOT EXISTS last_edited_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS handover_security_code VARCHAR(8),
          ADD COLUMN IF NOT EXISTS is_ready_for_handover BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS handover_history JSONB NOT NULL DEFAULT '[]'::jsonb;
      `);

      await this.query(`
        CREATE INDEX IF NOT EXISTS idx_reports_draft_lookup 
          ON base_survey_reports(parcel_id, phase, status);
      `);

      // 2. deformation_assessments
      await this.query(`
        ALTER TABLE deformation_assessments
          ADD COLUMN IF NOT EXISTS diff_settlement_photo_code VARCHAR(150),
          ADD COLUMN IF NOT EXISTS tilt_photo_code VARCHAR(150),
          ADD COLUMN IF NOT EXISTS abnormal_photo_code VARCHAR(150),
          ADD COLUMN IF NOT EXISTS diff_settlement_photos_json JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS tilt_photos_json JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS abnormal_photos_json JSONB DEFAULT '[]'::jsonb;
      `);

      // 3. building_specifications
      await this.query(`
        ALTER TABLE building_specifications
          ADD COLUMN IF NOT EXISTS as_built_drawing_photos_json JSONB DEFAULT '[]'::jsonb;
      `);

      console.log('✅ [STARTUP MIGRATION] All idempotent migrations executed successfully.');
    } catch (error) {
      console.warn('⚠️ [STARTUP MIGRATION WARNING] Some startup migrations could not run:', error);
    }
  }
}

