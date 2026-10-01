/**
 * Script Phục Hồi An Toàn (Rollback / Restore) Dữ Liệu Khảo Sát Trước Triển Khai Multi-Photo
 * File: backend/database/backups/restore_pre_multiphoto_backup.js
 * 
 * Cách dùng:
 *   node backend/database/backups/restore_pre_multiphoto_backup.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME || 'metro2_gis_db',
  user: process.env.DB_USER || 'metro2_user',
  password: process.env.DB_PASSWORD || 'metro2_secure_password',
});

async function restore() {
  const backupFile = path.join(__dirname, 'survey_data_pre_multiphoto_backup_1790834717033.json');
  if (!fs.existsSync(backupFile)) {
    console.error('❌ Không tìm thấy tệp sao lưu:', backupFile);
    process.exit(1);
  }

  const raw = fs.readFileSync(backupFile, 'utf8');
  const backup = JSON.parse(raw);
  console.log(`📦 Đang đọc dữ liệu sao lưu lúc: ${backup.timestamp}`);
  console.log(`📋 Số lượng hồ sơ cần kiểm tra / phục hồi: ${backup.reports.length}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const report of backup.reports) {
      console.log(`🔄 Đang kiểm tra hồ sơ ${report.report_code} (ID: ${report.id})...`);
      
      const checkRes = await client.query(
        'SELECT id FROM base_survey_reports WHERE id = $1',
        [report.id]
      );

      if (checkRes.rows.length > 0) {
        await client.query(
          `UPDATE base_survey_reports
           SET survey_data_json = $1,
               status = $2,
               updated_at = $3
           WHERE id = $4`,
          [report.survey_data_json, report.status, report.updated_at, report.id]
        );
        console.log(`  ✅ Đã đồng bộ an toàn dữ liệu khảo sát cho hồ sơ: ${report.report_code}`);
      } else {
        await client.query(
          `INSERT INTO base_survey_reports (
             id, parcel_id, surveyor_id, report_code, survey_type, status,
             current_step, survey_data_json, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            report.id, report.parcel_id, report.surveyor_id, report.report_code,
            report.survey_type, report.status, report.current_step,
            report.survey_data_json, report.created_at, report.updated_at
          ]
        );
        console.log(`  ✅ Đã phục hồi mới hồ sơ: ${report.report_code}`);
      }
    }

    await client.query('COMMIT');
    console.log('🎉 PHỤC HỒI DỮ LIỆU THÀNH CÔNG 100%! Toàn bộ dữ liệu nguyên bản đã được bảo toàn.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi trong quá trình phục hồi:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  restore();
}
