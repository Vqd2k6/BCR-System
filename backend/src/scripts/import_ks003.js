/**
 * SCRIPT IMPORT 6.431 THỬA ĐẤT KS003 VÀO CSDL POSTGRESQL + POSTGIS
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function importKS003Parcels() {
  console.log('🚀 Bắt đầu Import 6.431 Thửa đất quy hoạch từ data/KS003 vào PostgreSQL PostGIS...');

  const dataPath = path.join(__dirname, '../../../data/KS003/ban_do_data.json');
  if (!fs.existsSync(dataPath)) {
    console.error('❌ Không tìm thấy file ban_do_data.json tại:', dataPath);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const parcels = rawData.parcels || {};
  const pKeys = Object.keys(parcels);

  console.log(`📊 Tìm thấy tổng cộng ${pKeys.length.toLocaleString()} thửa đất.`);

  let imported = 0;
  let skipped = 0;

  // Batch insert
  for (const key of pKeys) {
    const p = parcels[key];
    if (!p.ranh_coords || p.ranh_coords.length < 3) {
      skipped++;
      continue;
    }

    // Ensure polygon is closed
    const coords = [...p.ranh_coords];
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0]);
    }

    // Centroid point (first coord as default centroid)
    const cLat = coords[0][0];
    const cLng = coords[0][1];

    const polyStr = coords.map(pt => `${pt[1]} ${pt[0]}`).join(', ');
    const polygonSql = `ST_SetSRID(ST_GeomFromText('POLYGON((${polyStr}))'), 4326)`;
    const pointSql = `ST_SetSRID(ST_MakePoint(${cLng}, ${cLat}), 4326)`;

    const houseCode = `THUA-${p.sothua || 'X'}-TO-${p.soto || 'Y'}-${p.mathuadat}`;
    const address = `Thửa ${p.sothua}, Tờ ${p.soto}, ${p.tenphuongxa || ''}, ${p.tenquanhuyen || ''}`;

    try {
      await db.query(`
        INSERT INTO buildings (
          house_code, owner_name, address, ward, district,
          cadastral_plot_number, cadastral_map_sheet, raw_cadastral_data,
          status, hardware_gps, pin_gps, footprint, surveyor_id
        )
        VALUES (
          $1, 'Chưa xác định (Theo dữ liệu SQHKT)', $2, $3, $4,
          $5, $6, $7,
          'UNASSIGNED', ${pointSql}, ${pointSql}, ${polygonSql}, '00000000-0000-0000-0000-000000000003'
        )
        ON CONFLICT (house_code) DO NOTHING
      `, [
        houseCode,
        address,
        p.tenphuongxa || '',
        p.tenquanhuyen || '',
        p.sothua || '',
        p.soto || '',
        JSON.stringify(p)
      ]);
      imported++;
      if (imported % 500 === 0) {
        console.log(`⏳ Đã nạp ${imported.toLocaleString()} / ${pKeys.length.toLocaleString()} thửa...`);
      }
    } catch (e) {
      skipped++;
    }
  }

  console.log(`🎉 HOÀN THÀNH IMPORT!`);
  console.log(`✅ Thành công: ${imported.toLocaleString()} thửa`);
  console.log(`⚠️ Bỏ qua: ${skipped.toLocaleString()} thửa`);
  process.exit(0);
}

importKS003Parcels();
