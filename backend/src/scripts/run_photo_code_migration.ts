import fs from 'fs';
import path from 'path';
import { Database, pool } from '../database/db';

async function runMigration() {
  console.log('🚀 Đang thực thi Migration: Bổ sung các cột Photo ID cho dự án Metro 2...');
  const sqlPath = path.join(__dirname, '../database/migrations/20260928_add_photo_code_columns.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await Database.query(sql);
    console.log('✅ Migration thành công! Đã thêm các cột:');
    console.log('   - survey_identification_photos.photo_code');
    console.log('   - damage_zones.ctx_photo_code');
    console.log('   - defect_items.cu_photo_code');
    console.log('   - deformation_assessments.diff_settlement_photo_code');
    console.log('   - deformation_assessments.tilt_photo_code');
    console.log('   - deformation_assessments.abnormal_photo_code');
    console.log('   - Kèm các Index phục vụ tra cứu nhanh.');
  } catch (err) {
    console.error('❌ Lỗi thực thi Migration:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
