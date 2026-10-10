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
    // Sử dụng PostgreSQL Advisory Lock để loại trừ hoàn toàn Deadlock (40P01) khi khởi động đa tiến trình hoặc nodemon reload
    const advisoryLockId = 987654321;
    let lockAcquired = false;
    try {
      const lockRes = await this.query<{ locked: boolean }>(`SELECT pg_try_advisory_lock($1) AS locked;`, [advisoryLockId]);
      lockAcquired = Boolean(lockRes.rows[0]?.locked);
      if (!lockAcquired) {
        console.log('ℹ️ [STARTUP MIGRATION] Tiến trình khác đang thực hiện migration, bỏ qua để tránh deadlock.');
        return;
      }

      // 0. PostgreSQL unaccent extension (Hỗ trợ tìm kiếm tiếng Việt không dấu)
    try {
      await this.query(`CREATE EXTENSION IF NOT EXISTS unaccent;`);
      console.log('✅ [STARTUP MIGRATION] PostgreSQL unaccent extension ready.');
    } catch (e) {
      console.warn('⚠️ [STARTUP MIGRATION] unaccent extension warning:', e);
    }

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

    // 8. mutation_type_enum SWAP_SPATIAL
    try {
      await this.query(`
        ALTER TYPE mutation_type_enum ADD VALUE IF NOT EXISTS 'SWAP_SPATIAL';
      `);
      console.log('✅ [STARTUP MIGRATION] mutation_type_enum SWAP_SPATIAL ready.');
    } catch (e) {
      console.warn('⚠️ [STARTUP MIGRATION] mutation_type_enum SWAP_SPATIAL warning:', e);
    }

    // 9. parcels assigned_surveyor_id & building attributes
    try {
      await this.query(`
        ALTER TABLE parcels
          ADD COLUMN IF NOT EXISTS assigned_surveyor_id UUID REFERENCES users(id),
          ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS assignment_notes TEXT,
          ADD COLUMN IF NOT EXISTS building_type VARCHAR(32) NOT NULL DEFAULT 'STANDALONE',
          ADD COLUMN IF NOT EXISTS total_units INT NOT NULL DEFAULT 1,
          ADD COLUMN IF NOT EXISTS code_slug VARCHAR(32),
          ADD COLUMN IF NOT EXISTS absence_attempt_count INT NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS deleted_floors INT[] DEFAULT '{}';

        CREATE INDEX IF NOT EXISTS idx_parcels_assigned_surveyor ON parcels(assigned_surveyor_id);
        CREATE INDEX IF NOT EXISTS idx_parcels_building_type ON parcels(building_type);
      `);
      console.log('✅ [STARTUP MIGRATION] parcels.assigned_surveyor_id & building attributes ready.');
    } catch (e) {
      console.warn('⚠️ [STARTUP MIGRATION] parcels.assigned_surveyor_id warning:', e);
    }

    // 10. building_units & base_survey_reports unit hierarchy
    try {
      await this.query(`
        CREATE TABLE IF NOT EXISTS building_units (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
            unit_code VARCHAR(32) NOT NULL,
            floor_number INT NOT NULL DEFAULT 1,
            owner_name VARCHAR(128),
            owner_phone VARCHAR(32),
            owner_id_card VARCHAR(32),
            status parcel_survey_status_enum NOT NULL DEFAULT 'NOT_SURVEYED',
            phase1_report_id UUID,
            phase2_report_id UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_parcel_unit UNIQUE (parcel_id, unit_code)
        );

        CREATE INDEX IF NOT EXISTS idx_building_units_parcel ON building_units(parcel_id);
        CREATE INDEX IF NOT EXISTS idx_building_units_status ON building_units(status);

        ALTER TABLE base_survey_reports
          ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES building_units(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS parent_report_id UUID REFERENCES base_survey_reports(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS report_type VARCHAR(32) NOT NULL DEFAULT 'STANDALONE';

        CREATE INDEX IF NOT EXISTS idx_reports_unit ON base_survey_reports(unit_id);
        CREATE INDEX IF NOT EXISTS idx_reports_parent ON base_survey_reports(parent_report_id);
        CREATE INDEX IF NOT EXISTS idx_reports_type ON base_survey_reports(report_type);

        -- 10.1 building_floor_plans & unit cad partition
        CREATE TABLE IF NOT EXISTS building_floor_plans (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
            floor_number INT NOT NULL,
            floor_name VARCHAR(64) NOT NULL,
            applicable_floors INT[] DEFAULT '{}',
            cad_photo_url TEXT NOT NULL,
            cad_photo_code VARCHAR(32),
            image_width INT,
            image_height INT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_parcel_floor_number UNIQUE (parcel_id, floor_number)
        );

        CREATE INDEX IF NOT EXISTS idx_floor_plans_parcel ON building_floor_plans(parcel_id);

        ALTER TABLE building_floor_plans
          ADD COLUMN IF NOT EXISTS scope VARCHAR(32) DEFAULT 'UNIT',
          ADD COLUMN IF NOT EXISTS area_type VARCHAR(64) DEFAULT 'TYPICAL_UNIT',
          ADD COLUMN IF NOT EXISTS floor_code VARCHAR(32);

        ALTER TABLE building_floor_plans
          ALTER COLUMN cad_photo_url DROP NOT NULL,
          ALTER COLUMN cad_photo_url SET DEFAULT '';

        CREATE INDEX IF NOT EXISTS idx_floor_plans_scope ON building_floor_plans(parcel_id, scope);
        CREATE INDEX IF NOT EXISTS idx_floor_plans_floor_code ON building_floor_plans(parcel_id, floor_code);

        ALTER TABLE building_units
          ADD COLUMN IF NOT EXISTS floor_plan_id UUID REFERENCES building_floor_plans(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS cad_bbox JSONB,
          ADD COLUMN IF NOT EXISTS cad_polygon JSONB,
          ADD COLUMN IF NOT EXISTS unit_cad_url TEXT,
          ADD COLUMN IF NOT EXISTS resident_status VARCHAR(32) DEFAULT 'CHỦ_HỘ_Ở',
          ADD COLUMN IF NOT EXISTS unit_type VARCHAR(32) DEFAULT 'UNIT',
          ADD COLUMN IF NOT EXISTS display_code VARCHAR(32);

        CREATE INDEX IF NOT EXISTS idx_building_units_floor_plan ON building_units(floor_plan_id);
        CREATE INDEX IF NOT EXISTS idx_building_units_unit_type ON building_units(unit_type);
        CREATE INDEX IF NOT EXISTS idx_building_units_display_code ON building_units(display_code);
      `);
      console.log('✅ [STARTUP MIGRATION] building_units (unit_type, display_code), floor_plans (scope/area_type) & report hierarchy ready.');
    } catch (e) {
      console.warn('⚠️ [STARTUP MIGRATION] building_units warning:', e);
    }

    // 11. role_enum GUEST (Chủ Đầu Tư MAUR)
    try {
      await this.query(`
        ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'GUEST';
      `);
      console.log('✅ [STARTUP MIGRATION] role_enum GUEST ready.');
    } catch (e) {
      console.warn('⚠️ [STARTUP MIGRATION] role_enum GUEST warning:', e);
    }

    // 12. survey_absence_logs.unit_id (Hỗ trợ vắng mặt/tạm hoãn khảo sát Master Area & Căn hộ con)
    try {
      await this.query(`
        ALTER TABLE survey_absence_logs
          ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES building_units(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_absence_unit ON survey_absence_logs(unit_id);
      `);
      console.log('✅ [STARTUP MIGRATION] survey_absence_logs.unit_id ready.');
    } catch (e) {
      console.warn('⚠️ [STARTUP MIGRATION] survey_absence_logs.unit_id warning:', e);
    }
    } finally {
      if (lockAcquired) {
        try {
          await this.query(`SELECT pg_advisory_unlock($1);`, [advisoryLockId]);
        } catch (unlockErr) {
          console.warn('⚠️ [STARTUP MIGRATION] Không thể giải phóng advisory lock:', unlockErr);
        }
      }
    }
  }
}

