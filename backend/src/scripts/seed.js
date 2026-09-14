/**
 * SEED SCRIPT FOR KSQH METRO 2 DATABASE
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
  console.log('🌱 Bắt đầu nạp dữ liệu khởi tạo cho KSQH Metro 2...');

  try {
    // 1. Run Schema SQL
    const schemaPath = path.join(__dirname, '../../../database_schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('📄 Đang thực thi database_schema.sql...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await db.query(schemaSql);
      console.log('✅ Đã khởi tạo bảng và trigger PostGIS thành công!');
    }

    // 2. Hash default password
    const hashedPassword = await bcrypt.hash('123456', 10);

    // 3. Insert Users (3 Tiers)
    console.log('👤 Đang nạp tài khoản người dùng mẫu...');
    await db.query(`
      INSERT INTO users (id, username, password_hash, full_name, employee_code, role, phone_number, email)
      VALUES 
        ('00000000-0000-0000-0000-000000000001', 'admin', $1, 'Ban Quản Lý Dự Án Metro Số 2', 'QLDA-01', 'SUPER_ADMIN', '0901234567', 'admin@metro2.tphcm.gov.vn'),
        ('00000000-0000-0000-0000-000000000002', 'manager', $1, 'Trần Minh Tuấn (Tổ Trưởng Tân Bình)', 'ZM-TB01', 'ZONE_MANAGER', '0912345678', 'manager.tb@metro2.tphcm.gov.vn'),
        ('00000000-0000-0000-0000-000000000003', 'surveyor', $1, 'Nguyễn Văn Hùng', 'NV-08', 'FIELD_SURVEYOR', '0987654321', 'hung.nv@ksqh.vn')
      ON CONFLICT (username) DO NOTHING;
    `, [hashedPassword]);

    // 4. Insert Metro Line 2 Corridor
    console.log('🚇 Đang nạp tim tuyến Metro Số 2...');
    await db.query(`
      INSERT INTO metro_corridors (id, name, centerline, buffer_corridor, total_length_km)
      VALUES (
        '10000000-0000-0000-0000-000000000001',
        'Tuyến Metro Số 2 (Bến Thành – Tham Lương)',
        ST_SetSRID(ST_GeomFromText('LINESTRING(106.6983 10.77197, 106.6912 10.77485, 106.6815 10.7788, 106.6718 10.7842, 106.6632 10.7895, 106.6572 10.7938, 106.6521 10.7975, 106.6438 10.8035, 106.6362 10.8092, 106.6298 10.8155, 106.6235 10.8228)'), 4326),
        ST_Buffer(ST_SetSRID(ST_GeomFromText('LINESTRING(106.6983 10.77197, 106.6912 10.77485, 106.6815 10.7788, 106.6718 10.7842, 106.6632 10.7895, 106.6572 10.7938, 106.6521 10.7975, 106.6438 10.8035, 106.6362 10.8092, 106.6298 10.8155, 106.6235 10.8228)'), 4326), 0.0005),
        11.04
      )
      ON CONFLICT (id) DO NOTHING;
    `);

    // 5. Insert Sample Survey Zones
    console.log('📐 Đang nạp phân vùng khảo sát mẫu...');
    await db.query(`
      INSERT INTO survey_zones (id, name, corridor_id, manager_id, assigned_surveyor_id, boundary, color_hex, estimated_buildings, completed_buildings)
      VALUES 
        (
          'ZONE-TB01',
          'Phân vùng 01: Đoạn Ga Bảy Hiền (Tân Bình)',
          '10000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-000000000003',
          ST_SetSRID(ST_GeomFromText('POLYGON((106.6500 10.7955, 106.6545 10.7995, 106.6575 10.7960, 106.6530 10.7925, 106.6500 10.7955))'), 4326),
          '#0284c7', 250, 42
        ),
        (
          'ZONE-Q302',
          'Phân vùng 02: Đoạn Ga Dân Chủ (Quận 3)',
          '10000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-000000000003',
          ST_SetSRID(ST_GeomFromText('POLYGON((106.6790 10.7765, 106.6840 10.7810, 106.6870 10.7775, 106.6820 10.7735, 106.6790 10.7765))'), 4326),
          '#9333ea', 180, 28
        )
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('🎉 NẠP DỮ LIỆU THÀNH CÔNG!');
  } catch (error) {
    console.error('❌ Lỗi khi nạp dữ liệu:', error);
  } finally {
    process.exit(0);
  }
}

seedDatabase();
