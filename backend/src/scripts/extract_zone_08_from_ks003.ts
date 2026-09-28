import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool(config.db);

async function extractZone08() {
  console.log('🚀 [TASK 1] Bắt đầu trích xuất không gian Zone 8 từ tập dữ liệu KS003...');

  const ks003Path = path.resolve(__dirname, '../../../data/KS003/ban_do_data.json');
  if (!fs.existsSync(ks003Path)) {
    console.error(`❌ Không tìm thấy file KS003: ${ks003Path}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(ks003Path, 'utf8'));
  const allParcels = Object.values(rawData.parcels || {}) as any[];
  console.log(`📦 Tổng số thửa trong KS003: ${allParcels.length}`);

  // 1. Lấy ranh ZOI 35m của Zone 8 từ PostGIS
  const zRes = await pool.query(
    "SELECT ST_AsText(zoi_polygon_geom) as zoi_wkt FROM metro_segments WHERE segment_code = 'ZONE_08';"
  );
  if (!zRes.rows[0]?.zoi_wkt) {
    console.error('❌ Không tìm thấy thông tin ZOI của ZONE_08 trong metro_segments');
    process.exit(1);
  }
  const zoiWkt = zRes.rows[0].zoi_wkt;

  // 2. Lấy danh sách mã thửa đất đã có trong CSDL (Khử trùng theo FCFS)
  const existingParcelsRes = await pool.query('SELECT official_cadastral_code FROM parcels;');
  const existingCodeSet = new Set(existingParcelsRes.rows.map((r) => String(r.official_cadastral_code)));
  console.log(`🔒 Số thửa đã có trong CSDL (được bảo lưu): ${existingCodeSet.size}`);

  // 3. Lọc sơ bộ theo Bounding Box của Zone 8 (Quận 10 dọc CMT8)
  const candidates = allParcels.filter((p) => {
    if (!p.latitude || !p.longitude || !p.ranh_coords || p.ranh_coords.length < 3) return false;
    return (
      p.latitude >= 10.780 &&
      p.latitude <= 10.789 &&
      p.longitude >= 106.663 &&
      p.longitude <= 106.674
    );
  });
  console.log(`🎯 Số ứng viên sơ bộ trong bounding box Zone 8: ${candidates.length}`);

  // 4. Kiểm tra giao cắt không gian ST_Intersects với PostGIS ZOI Polygon
  const extractedParcels: Record<string, any> = {};
  let duplicateCount = 0;
  let validIntersectsCount = 0;

  for (const p of candidates) {
    const mathuadat = String(p.mathuadat);
    if (existingCodeSet.has(mathuadat)) {
      duplicateCount++;
      continue;
    }

    const coords = p.ranh_coords as [number, number][];
    const pts = coords.map(([lat, lng]) => `${lng} ${lat}`);
    if (pts[0] !== pts[pts.length - 1]) pts.push(pts[0]);
    const polyWkt = `POLYGON((${pts.join(', ')}))`;

    try {
      const q = await pool.query(
        'SELECT ST_Intersects(ST_SetSRID(ST_GeomFromText($1), 4326), ST_SetSRID(ST_GeomFromText($2), 4326)) as intersects;',
        [polyWkt, zoiWkt]
      );

      if (q.rows[0]?.intersects) {
        validIntersectsCount++;
        extractedParcels[mathuadat] = p;
      }
    } catch (err) {
      // Bỏ qua nếu có lỗi hình học tọa độ nhỏ
    }
  }

  const finalCount = Object.keys(extractedParcels).length;
  console.log(`✅ Kết quả lọc không gian:`);
  console.log(`   - Số thửa giao cắt ZOI Zone 8: ${validIntersectsCount + duplicateCount}`);
  console.log(`   - Bỏ qua do đã thuộc Zone khác (FCFS): ${duplicateCount}`);
  console.log(`   - Số thửa mới chuẩn xác cho Zone 8: ${finalCount}`);

  // 5. Lưu vào data/Zone_08/ban_do_data.json
  const targetDir = path.resolve(__dirname, '../../../data/Zone_08');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetFile = path.join(targetDir, 'ban_do_data.json');
  const payload = {
    timestamp: Date.now(),
    source: 'Extracted from KS003 via PostGIS Spatial Intersect with ZONE_08 ZOI',
    total_points: finalCount,
    scanned_points: finalCount,
    parcels: extractedParcels,
  };

  fs.writeFileSync(targetFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`💾 Đã xuất file thành công: ${targetFile} (${finalCount} thửa)`);

  await pool.end();
}

extractZone08().catch((err) => {
  console.error('❌ Lỗi trích xuất Zone 8:', err);
  process.exit(1);
});
