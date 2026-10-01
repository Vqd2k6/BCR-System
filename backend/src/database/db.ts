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
   * Đảm bảo mọi môi trường (Docker, Local, Supabase Render) luôn có đầy đủ cột dữ liệu mới.
   * Từng khối lệnh được cô lập trong try/catch độc lập để lỗi ở một bảng không làm gián đoạn bảng khác.
   */
  static async runStartupMigrations(): Promise<void> {
    // 1. survey_identification_photos.photo_code (Ưu tiên số 1)
    try {
      await this.query(`ALTER TABLE survey_identification_photos ADD COLUMN IF NOT EXISTS photo_code VARCHAR(150);`);
      await this.query(`CREATE INDEX IF NOT EXISTS idx_survey_photos_photo_code ON survey_identification_photos(photo_code);`);
      console.log('✅ [STARTUP MIGRATION] survey_identification_photos.photo_code ready.');
    } catch (e) {
      console.warn('⚠️ [STARTUP MIGRATION] survey_identification_photos.photo_code warning:', e);
    }

    // 2. damage_zones.ctx_photo_code
    try {
      await this.query(`ALTER TABLE damage_zones ADD COLUMN IF NOT EXISTS ctx_photo_code VARCHAR(150);`);
      await this.query(`CREATE INDEX IF NOT EXISTS idx_damage_zones_ctx_photo_code ON damage_zones(ctx_photo_code);`);
      console.log('✅ [STARTUP MIGRATION] damage_zones.ctx_photo_code ready.');
    } catch (e) {
      console.warn('⚠️ [STARTUP MIGRATION] damage_zones.ctx_photo_code warning:', e);
    }

    // 3. defect_items.cu_photo_code & cu_photos_json
    try {
      await this.query(`
        ALTER TABLE defect_items 
          ADD COLUMN IF NOT EXISTS cu_photo_code VARCHAR(150),
          ADD COLUMN IF NOT EXISTS cu_photos_json JSONB DEFAULT '[]'::jsonb;
      `);
      await this.query(`CREATE INDEX IF NOT EXISTS idx_defect_items_cu_photo_code ON defect_items(cu_photo_code);`);
      console.log('✅ [STARTUP MIGRATION] defect_items.cu_photo_code & cu_photos_json ready.');
    } catch (e) {
      console.warn('⚠️ [STARTUP MIGRATION] defect_items.cu_photo_code warning:', e);
    }

    // 4. deformation_assessments Photo IDs
    try {
      await this.query(`
        ALTER TABLE deformation_assessments
          ADD COLUMN IF NOT EXISTS diff_settlement_photo_code VARCHAR(150),
          ADD COLUMN IF NOT EXISTS tilt_photo_code VARCHAR(150),
          ADD COLUMN IF NOT EXISTS abnormal_photo_code VARCHAR(150),
          ADD COLUMN IF NOT EXISTS diff_settlement_photos_json JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS tilt_photos_json JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS abnormal_photos_json JSONB DEFAULT '[]'::jsonb;
      `);
      console.log('✅ [STARTUP MIGRATION] deformation_assessments photo codes ready.');
    } catch (e) {
      console.warn('⚠️ [STARTUP MIGRATION] deformation_assessments photo codes warning:', e);
    }

    // 5. building_specifications as_built
    try {
      await this.query(`
        ALTER TABLE building_specifications
          ADD COLUMN IF NOT EXISTS as_built_drawing_photos_json JSONB DEFAULT '[]'::jsonb;
      `);
      console.log('✅ [STARTUP MIGRATION] building_specifications as-built drawings ready.');
    } catch (e) {
      console.warn('⚠️ [STARTUP MIGRATION] building_specifications warning:', e);
    }

    // 6. base_survey_reports handover and draft sync
    try {
      await this.query(`
        ALTER TABLE base_survey_reports
          ADD COLUMN IF NOT EXISTS sync_version INT NOT NULL DEFAULT 1,
          ADD COLUMN IF NOT EXISTS last_edited_by_id UUID,
          ADD COLUMN IF NOT EXISTS handover_security_code VARCHAR(8),
          ADD COLUMN IF NOT EXISTS is_ready_for_handover BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS handover_history JSONB NOT NULL DEFAULT '[]'::jsonb;
      `);
      await this.query(`
        CREATE INDEX IF NOT EXISTS idx_reports_draft_lookup 
          ON base_survey_reports(parcel_id, phase, status);
      `);
      console.log('✅ [STARTUP MIGRATION] base_survey_reports handover & draft sync ready.');
    } catch (e) {
      console.warn('⚠️ [STARTUP MIGRATION] base_survey_reports handover warning:', e);
    }

    // 7. parcel_absence_logs
    try {
      await this.query(`
        CREATE TABLE IF NOT EXISTS parcel_absence_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
            surveyor_id UUID REFERENCES users(id),
            attempt_number INT NOT NULL DEFAULT 1,
            absence_reason TEXT,
            notes TEXT,
            photo_proof_url TEXT,
            reschedule_date DATE,
            owner_name VARCHAR(128),
            owner_phone VARCHAR(32),
            recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_absence_logs_parcel ON parcel_absence_logs(parcel_id);
      `);
      console.log('✅ [STARTUP MIGRATION] parcel_absence_logs ready.');
    } catch (e) {
      console.warn('⚠️ [STARTUP MIGRATION] parcel_absence_logs warning:', e);
    }
  }
}

