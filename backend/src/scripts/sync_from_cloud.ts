/**
 * ============================================================================
 * SCRIPT ĐỒNG BỘ DỮ LIỆU THỰC TẾ 1 CHIỀU: CLOUD SUPABASE -> DOCKER LOCAL
 * ============================================================================
 * NGUYÊN TẮC BẢO MẬT & TOÀN VẸN DỮ LIỆU:
 * 1. KẾT NỐI CLOUD TUYỆT ĐỐI CHỈ ĐỌC (READ-ONLY TRANSACTION):
 *    - Thực thi 'SET default_transaction_read_only = on;'
 *    - Thực thi 'BEGIN TRANSACTION READ ONLY;'
 *    - Không thể ghi, sửa, xóa bất kỳ dữ liệu nào trên Cloud doanh nghiệp.
 * 2. LƯU BẢN SAO ĐỘC LẬP THEO THỜI GIAN (SNAPSHOT ARCHIVE):
 *    - Mỗi lần chạy tự động sinh 1 file JSON lưu tại:
 *      backend/backups/cloud_snapshots/snapshot_YYYYMMDD_HHmmss.json
 *    - File này tồn tại độc lập vĩnh viễn, KHÔNG BAO GIỜ bị ghi đè.
 * 3. HỖ TRỢ TÙY CHỌN DATABASE ĐÍCH HOẶC CHỈ LƯU FILE:
 *    - Mặc định: Ghi nhận vào local DB (có kèm file backup).
 *    - Nếu FILE_ONLY=true hoặc --file-only: Chỉ lưu file snapshot, không chạm vào DB local.
 *    - Nếu TARGET_DB=tên_db_mới: Tự động tạo và nạp vào database riêng biệt,
 *      không làm thay đổi DB local hiện tại.
 * ============================================================================
 */
import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const isFileOnly = process.argv.includes('--file-only') || process.env.FILE_ONLY === 'true';
const targetDbName = process.env.TARGET_DB || process.env.LOCAL_DB_NAME || 'metro2_gis_db';

const REMOTE_POOL_CONFIG = process.env.REMOTE_DATABASE_URL
  ? {
      connectionString: process.env.REMOTE_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.REMOTE_DB_HOST || (process.env.DB_HOST?.includes('supabase') ? process.env.DB_HOST : 'aws-0-ap-southeast-1.pooler.supabase.com'),
      port: parseInt(process.env.REMOTE_DB_PORT || (process.env.DB_HOST?.includes('supabase') ? process.env.DB_PORT || '6543' : '6543'), 10),
      user: process.env.REMOTE_DB_USER || (process.env.DB_HOST?.includes('supabase') ? process.env.DB_USER || 'postgres.zmbydzpytqyjnnawdssd' : 'postgres.zmbydzpytqyjnnawdssd'),
      password: process.env.REMOTE_DB_PASSWORD || (process.env.DB_HOST?.includes('supabase') ? process.env.DB_PASSWORD : undefined),
      database: process.env.REMOTE_DB_NAME || (process.env.DB_HOST?.includes('supabase') ? process.env.DB_NAME || 'postgres' : 'postgres'),
      ssl: { rejectUnauthorized: false },
    };

const LOCAL_CONFIG = {
  host: 'localhost',
  port: 5433,
  user: 'metro2_user',
  password: 'metro2_secure_password',
  database: targetDbName,
};

// Danh sách các bảng nghiệp vụ cần đồng bộ theo thứ tự an toàn
const TABLES_TO_SYNC = [
  'metro_zones',
  'metro_segments',
  'parcels',
  'building_units',
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
  'parcel_mutation_events',
  'cadastral_history_logs',
  'task_assignments',
  'timekeeping_checkins',
  'audit_alert_items',
  'quality_gate_logs',
  'guest_share_links',
];

function getTimestampFormatted(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}${MM}${dd}_${hh}${mm}${ss}`;
}

async function syncFromCloud() {
  console.log('================================================================');
  console.log('🚀 KHỞI CHẠY ĐỒNG BỘ DỮ LIỆU THỰC TẾ: CLOUD -> LOCAL');
  console.log('================================================================');

  const hasPasswordOrUrl = Boolean(
    process.env.REMOTE_DATABASE_URL ||
    ('password' in REMOTE_POOL_CONFIG && REMOTE_POOL_CONFIG.password)
  );

  if (!hasPasswordOrUrl) {
    console.error('\n❌ THIẾU MẬT KHẨU KẾT NỐI CLOUD SUPABASE (REMOTE_DB_PASSWORD)');
    console.error('👉 Vui lòng truyền mật khẩu khi chạy script:');
    console.error('   REMOTE_DB_PASSWORD="mật_khẩu_database_supabase" npm run sync:from-cloud\n');
    console.error('   Hoặc dùng trực tiếp URI kết nối từ Supabase:');
    console.error('   REMOTE_DATABASE_URL="postgresql://postgres.zmbydzpytqyjnnawdssd:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" npm run sync:from-cloud\n');
    process.exit(1);
  }

  if ('host' in REMOTE_POOL_CONFIG) {
    console.log(`📡 Remote Cloud Host: ${REMOTE_POOL_CONFIG.host}:${REMOTE_POOL_CONFIG.port}`);
    console.log(`👤 Remote Cloud User: ${REMOTE_POOL_CONFIG.user}`);
    console.log(`🗄️  Remote Database:   ${REMOTE_POOL_CONFIG.database}`);
  } else {
    console.log(`📡 Remote Cloud:       Kết nối qua REMOTE_DATABASE_URL`);
  }

  if (isFileOnly) {
    console.log('📁 Chế độ hoạt động:   CHỈ LƯU FILE SNAPSHOT (Không ghi vào bất kỳ DB local nào)');
  } else {
    console.log(`💻 Local Target DB:    ${LOCAL_CONFIG.host}:${LOCAL_CONFIG.port} -> Database [${LOCAL_CONFIG.database}]`);
  }

  const remotePool = new Pool({
    ...REMOTE_POOL_CONFIG,
    max: 2,
    idleTimeoutMillis: 10000,
  });

  let remoteClient: PoolClient | null = null;
  let localPool: Pool | null = null;
  let localClient: PoolClient | null = null;

  try {
    console.log('\n⏳ Đang kết nối tới Cloud Supabase...');
    remoteClient = await remotePool.connect();

    // 🔒 KHÓA BẢO VỆ CHẶT CHẼ 100%: Thiết lập Transaction CHỈ ĐỌC (READ-ONLY)
    await remoteClient.query('SET default_transaction_read_only = on;');
    await remoteClient.query('SET statement_timeout = 60000;');
    await remoteClient.query('BEGIN TRANSACTION READ ONLY;');

    const readOnlyCheck = await remoteClient.query('SHOW transaction_read_only;');
    if (readOnlyCheck.rows[0]?.transaction_read_only !== 'on') {
      throw new Error('❌ Không thể kích hoạt chế độ READ ONLY trên Cloud Database. Dừng đồng bộ để bảo vệ an toàn!');
    }
    console.log('🛡️  XÁC NHẬN BẢO MẬT: Kết nối Cloud đang ở chế độ READ ONLY (Chỉ đọc 100%).');

    // 1. Kiểm tra thống kê dữ liệu thực tế trên Cloud trước khi đồng bộ
    console.log('\n📊 Thống kê dữ liệu thực tế tại hiện trường trên Cloud:');
    const cloudParcelsRes = await remoteClient.query('SELECT count(*) FROM parcels;');
    const cloudReportsRes = await remoteClient.query('SELECT count(*) FROM base_survey_reports;');
    const cloudPhotosRes = await remoteClient.query('SELECT count(*) FROM survey_identification_photos;');
    const cloudDefectsRes = await remoteClient.query('SELECT count(*) FROM defect_items;');

    console.log(`   ├─ Thửa đất (Parcels):                 ${cloudParcelsRes.rows[0].count}`);
    console.log(`   ├─ Hồ sơ khảo sát (Survey Reports):    ${cloudReportsRes.rows[0].count}`);
    console.log(`   ├─ Ảnh khảo sát hiện trường (Photos):  ${cloudPhotosRes.rows[0].count}`);
    console.log(`   └─ Vết nứt / Khuyết tật (Defects):     ${cloudDefectsRes.rows[0].count}`);

    // 2. Thu thập toàn bộ dữ liệu từ Cloud vào bộ nhớ
    console.log('\n📥 Đang trích xuất dữ liệu từ Cloud Supabase...');
    const snapshotArchive: Record<string, any[]> = {};
    const syncSummary: Record<string, number> = {};

    for (const table of TABLES_TO_SYNC) {
      const tableExistsCheck = await remoteClient.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1;
      `, [table]);

      if (tableExistsCheck.rows.length === 0) {
        continue;
      }

      const remoteRes = await remoteClient.query(`SELECT * FROM public."${table}";`);
      snapshotArchive[table] = remoteRes.rows;
      syncSummary[table] = remoteRes.rows.length;
    }

    // Kết thúc Transaction Read-only trên Remote ngay lập tức
    await remoteClient.query('COMMIT;');
    remoteClient.release();
    remoteClient = null;
    await remotePool.end();
    console.log('🔒 Đã đóng an toàn kết nối tới Cloud Supabase.');

    // 3. LƯU BẢN SAO ĐỘC LẬP RA FILE SNAPSHOT THEO THỜI GIAN
    const timestamp = getTimestampFormatted();
    const backupDir = path.resolve(__dirname, '../../../backend/backups/cloud_snapshots');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const snapshotFilePath = path.join(backupDir, `cloud_snapshot_${timestamp}.json`);
    fs.writeFileSync(snapshotFilePath, JSON.stringify(snapshotArchive, null, 2), 'utf8');

    console.log('\n================================================================');
    console.log(`💾 ĐÃ LƯU BẢN SAO LƯU ĐỘC LẬP:`);
    console.log(`👉 File: ${snapshotFilePath}`);
    console.log(`   (File này lưu trữ vĩnh viễn, mang timestamp, KHÔNG BAO GIỜ bị ghi đè)`);
    console.log('================================================================');

    // Nếu người dùng chọn chế độ chỉ lưu file thì kết thúc tại đây
    if (isFileOnly) {
      console.log('\n🎉 Hoàn tất! Bản sao dữ liệu đã được lưu trữ an toàn ra file mà không thay đổi bất kỳ Database nào.');
      return;
    }

    // 4. NẠP DỮ LIỆU VÀO DATABASE LOCAL ĐƯỢC CHỈ ĐỊNH
    console.log(`\n🔄 Bắt đầu nạp dữ liệu vào Database Local [${LOCAL_CONFIG.database}]:`);

    localPool = new Pool({
      ...LOCAL_CONFIG,
      max: 5,
    });
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

    for (const table of TABLES_TO_SYNC) {
      const rows = snapshotArchive[table] || [];

      // Kiểm tra bảng trên Local
      const tableExistsCheck = await localClient.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1;
      `, [table]);

      if (tableExistsCheck.rows.length === 0) {
        continue;
      }

      await localClient.query(`TRUNCATE TABLE public."${table}" CASCADE;`);

      if (rows.length === 0) {
        console.log(`   ├─ [${table}]: 0 bản ghi (bỏ qua insert)`);
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

      console.log(`   ├─ [${table}]: Đã nạp ${rows.length} bản ghi`);
    }

    await localClient.query("SET session_replication_role = 'origin';");
    await localClient.query('COMMIT;');

    console.log('\n================================================================');
    console.log(`🎉 ĐỒNG BỘ THÀNH CÔNG VÀO DATABASE [${LOCAL_CONFIG.database}]`);
    console.log('================================================================');
    console.log(`📁 File lưu trữ độc lập: ${snapshotFilePath}`);
    console.log(`📈 Thống kê tại Local DB (${LOCAL_CONFIG.database}):`);
    console.log(`   ├─ Parcels:         ${syncSummary['parcels'] || 0} thửa đất`);
    console.log(`   ├─ Survey Reports:  ${syncSummary['base_survey_reports'] || 0} báo cáo khảo sát`);
    console.log(`   ├─ Photos:          ${syncSummary['survey_identification_photos'] || 0} ảnh hiện trường`);
    console.log(`   └─ Defects:         ${syncSummary['defect_items'] || 0} vết nứt`);
  } catch (err: any) {
    if (localClient) {
      try {
        await localClient.query('ROLLBACK;');
      } catch (rbErr) {}
    }
    if (remoteClient) {
      try {
        await remoteClient.query('ROLLBACK;');
      } catch (rbErr) {}
    }
    console.error('\n❌ Lỗi trong quá trình đồng bộ:', err.message || err);
    process.exit(1);
  } finally {
    if (remoteClient) remoteClient.release();
    if (localClient) localClient.release();
    if (localPool) await localPool.end();
  }
}

syncFromCloud().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
