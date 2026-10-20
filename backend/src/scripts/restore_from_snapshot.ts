/**
 * ============================================================================
 * SCRIPT KHÔI PHỤC DỮ LIỆU TỪ FILE SNAPSHOT JSON -> DOCKER LOCAL POSTGRESQL
 * ============================================================================
 * Chức năng:
 * - Tự động tìm snapshot mới nhất trong backend/backups/cloud_snapshots/
 *   (hoặc nhận đường dẫn file chỉ định qua tham số: --file <tên_file.json>).
 * - Nạp an toàn vào PostgreSQL Docker Local (port 5433, db: metro2_gis_db).
 * - Không cần kết nối Internet hoặc mật khẩu Cloud Supabase.
 * ============================================================================
 */
import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const targetDbName = process.env.TARGET_DB || process.env.LOCAL_DB_NAME || 'metro2_gis_db';

const LOCAL_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  user: process.env.DB_USER || 'metro2_user',
  password: process.env.DB_PASSWORD || 'metro2_secure_password',
  database: targetDbName,
};

const TABLES_TO_SYNC = [
  'metro_zones',
  'metro_segments',
  'metro_alignments',
  'planning_zones',
  'parcels',
  'building_units',
  'building_floor_plans',
  'base_survey_reports',
  'phase1_report_details',
  'phase2_report_details',
  'survey_identification_photos',
  'building_specifications',
  'historical_sensitivities',
  'floor_surveys',
  'damage_zones',
  'defect_items',
  'damage_sketches',
  'deformation_assessments',
  'risk_score_cards',
  'survey_scopes',
  'survey_absence_logs',
  'parcel_absence_logs',
  'parcel_mutation_events',
  'cadastral_history_logs',
  'system_audit_logs',
  'survey_photo_registry',
  'survey_report_versions',
  'survey_audit_locks',
  'task_assignments',
  'timekeeping_checkins',
  'audit_alert_items',
  'quality_gate_logs',
  'guest_share_links',
];

async function restoreFromSnapshot() {
  console.log('================================================================');
  console.log('🔄 KHÔI PHỤC DỮ LIỆU LOCAL TỪ SNAPSHOT JSON ĐÃ LƯU');
  console.log('================================================================');

  const backupDir = path.resolve(__dirname, '../../../backend/backups/cloud_snapshots');
  if (!fs.existsSync(backupDir)) {
    console.error(`❌ Thư mục snapshot không tồn tại: ${backupDir}`);
    process.exit(1);
  }

  let snapshotFilePath = '';
  const fileArgIdx = process.argv.indexOf('--file');
  if (fileArgIdx !== -1 && process.argv[fileArgIdx + 1]) {
    const customFile = process.argv[fileArgIdx + 1];
    snapshotFilePath = path.isAbsolute(customFile) ? customFile : path.join(backupDir, customFile);
  } else {
    // Tìm file snapshot mới nhất
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      console.error(`❌ Không tìm thấy file snapshot nào trong: ${backupDir}`);
      process.exit(1);
    }
    snapshotFilePath = path.join(backupDir, files[0].name);
  }

  if (!fs.existsSync(snapshotFilePath)) {
    console.error(`❌ Không tìm thấy file snapshot: ${snapshotFilePath}`);
    process.exit(1);
  }

  console.log(`📁 File Snapshot nguồn: ${path.basename(snapshotFilePath)}`);
  console.log(`💻 Database đích:        ${LOCAL_CONFIG.host}:${LOCAL_CONFIG.port} -> [${LOCAL_CONFIG.database}]`);

  const fileRaw = fs.readFileSync(snapshotFilePath, 'utf8');
  const snapshotArchive: Record<string, any[]> = JSON.parse(fileRaw);

  const localPool = new Pool({
    ...LOCAL_CONFIG,
    max: 5,
  });

  let localClient: PoolClient | null = null;

  try {
    localClient = await localPool.connect();

    // Xác định các cột JSON/JSONB trên Local
    const { rows: colTypeRows } = await localClient.query(`
      SELECT table_name, column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public';
    `);

    const jsonCols = new Set(
      colTypeRows
        .filter(c => c.data_type === 'json' || c.data_type === 'jsonb' || c.udt_name === 'json' || c.udt_name === 'jsonb')
        .map(c => `${c.table_name}.${c.column_name}`)
    );

    await localClient.query('BEGIN;');
    await localClient.query("SET session_replication_role = 'replica';");

    // 1. Truncate các bảng có trong snapshot
    const tablesToTruncate: string[] = [];
    for (const table of TABLES_TO_SYNC) {
      const tableExistsCheck = await localClient.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1;
      `, [table]);
      if (tableExistsCheck.rows.length > 0) {
        tablesToTruncate.push(`public."${table}"`);
      }
    }

    if (tablesToTruncate.length > 0) {
      console.log(`\n🧹 Đang dọn dẹp các bảng cũ trước khi nạp...`);
      await localClient.query(`TRUNCATE TABLE ${tablesToTruncate.join(', ')} CASCADE;`);
    }

    // 2. Insert dữ liệu
    console.log(`📥 Đang nạp dữ liệu từ snapshot vào CSDL Local:`);
    const summary: Record<string, number> = {};

    for (const table of TABLES_TO_SYNC) {
      const rows = snapshotArchive[table] || [];

      const tableExistsCheck = await localClient.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1;
      `, [table]);

      if (tableExistsCheck.rows.length === 0) {
        continue;
      }

      if (rows.length === 0) {
        continue;
      }

      const localColRes = await localClient.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1;
      `, [table]);
      const validLocalCols = new Set(localColRes.rows.map(r => r.column_name));

      const commonCols = Object.keys(rows[0]).filter(c => validLocalCols.has(c));
      const colNames = commonCols.map(c => `"${c}"`).join(', ');

      const batchSize = Math.max(1, Math.floor(2000 / commonCols.length));
      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        const valuePlaceholders: string[] = [];
        const flatValues: any[] = [];
        let pIndex = 1;

        for (const row of chunk) {
          const rowPlaceholders: string[] = [];
          for (const col of commonCols) {
            rowPlaceholders.push(`$${pIndex++}`);
            let val = row[col];
            if (val !== null && val !== undefined && jsonCols.has(`${table}.${col}`)) {
              val = typeof val === 'string' ? val : JSON.stringify(val);
            }
            flatValues.push(val);
          }
          valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
        }

        const sql = `INSERT INTO public."${table}" (${colNames}) VALUES ${valuePlaceholders.join(', ')};`;
        await localClient.query(sql, flatValues);
      }

      summary[table] = rows.length;
      console.log(`   ├─ [${table}]: ${rows.length} bản ghi`);
    }

    await localClient.query("SET session_replication_role = 'origin';");
    await localClient.query('COMMIT;');

    console.log('\n================================================================');
    console.log(`🎉 KHÔI PHỤC THÀNH CÔNG VÀO DATABASE [${LOCAL_CONFIG.database}]`);
    console.log('================================================================');
    console.log(`📈 Thống kê chính:`);
    console.log(`   ├─ Parcels (Thửa đất):       ${summary['parcels'] || 0}`);
    console.log(`   ├─ Base Reports (Hồ sơ):     ${summary['base_survey_reports'] || 0}`);
    console.log(`   ├─ Photos (Ảnh hiện trường): ${summary['survey_identification_photos'] || 0}`);
    console.log(`   └─ Defects (Khuyết tật/nứt): ${summary['defect_items'] || 0}`);
  } catch (err: any) {
    if (localClient) {
      try {
        await localClient.query('ROLLBACK;');
      } catch (rbErr) {}
    }
    console.error('\n❌ Lỗi khi khôi phục từ snapshot:', err.message || err);
    process.exit(1);
  } finally {
    if (localClient) localClient.release();
    if (localPool) await localPool.end();
  }
}

restoreFromSnapshot().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
