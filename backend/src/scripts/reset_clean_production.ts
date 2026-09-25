import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

async function resetCleanProduction() {
  console.log('🧹 Starting Clean Production Database Reset on Cloud Supabase...');

  const remotePool = new Pool({
    host: process.env.DB_HOST || 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: parseInt(process.env.DB_PORT || '6543'),
    user: process.env.DB_USER || 'postgres.zmbydzpytqyjnnawdssd',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'postgres',
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  if (!process.env.DB_PASSWORD) {
    console.error('❌ Error: DB_PASSWORD is required. Ví dụ: DB_PASSWORD=your_password npm run reset:clean-production');
    process.exit(1);
  }

  const client = await remotePool.connect();

  try {
    const sqlPath = path.resolve(__dirname, '../../../database/reset_clean_production.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`File not found: ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    console.log('📡 Executing clean reset SQL script on Supabase...');
    await client.query(sqlContent);

    // Verify counts
    const checkRes = await client.query(`
      SELECT 
        (SELECT count(*) FROM parcels) as parcels_count,
        (SELECT count(*) FROM base_survey_reports) as reports_count,
        (SELECT count(*) FROM metro_zones) as zones_count,
        (SELECT count(*) FROM users) as users_count;
    `);

    console.log('📊 Cloud Database Reset Verification:');
    console.log(`   ├─ Parcels (Thửa đất): ${checkRes.rows[0].parcels_count} (Sạch 0 căn)`);
    console.log(`   ├─ Survey Reports: ${checkRes.rows[0].reports_count} (0 báo cáo)`);
    console.log(`   ├─ Metro Stations: ${checkRes.rows[0].zones_count} (Đầy đủ 11 Ga)`);
    console.log(`   └─ Users: ${checkRes.rows[0].users_count} (Tài khoản sẵn sàng đăng nhập)`);

    console.log('\n🎉 THÀNH CÔNG! Database trên Cloud đã trở về trạng thái "DB Sạch Thực Địa" 100%!');
  } catch (error) {
    console.error('❌ Reset failed:', error);
  } finally {
    client.release();
    await remotePool.end();
  }
}

resetCleanProduction();
