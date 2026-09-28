import fs from 'fs';
import path from 'path';
import { pool } from '../database/db';

interface Zone08Summary {
  totalRaw: number;
  inserted: number;
  skipped: number;
  startCode: string;
  endCode: string;
}

export async function seedZone08(): Promise<Zone08Summary> {
  const client = await pool.connect();
  try {
    console.log('🚀 [TASK 2 & 3] Bắt đầu nạp dữ liệu địa chính Zone 8 chuẩn B-XXXXX-POR...');
    await client.query('BEGIN;');

    const filePath = path.resolve(__dirname, '../../../data/Zone_08/ban_do_data.json');
    if (!fs.existsSync(filePath)) {
      throw new Error(`⚠️ Không tìm thấy file dữ liệu Zone 8: ${filePath}`);
    }

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const rawParcels = Object.values(raw.parcels || {}) as any[];
    console.log(`📦 Đã đọc ${rawParcels.length} thửa từ file ban_do_data.json`);

    // 1. Kiểm tra mã số thứ tự cao nhất hiện tại trong DB
    const maxCodeRes = await client.query(`
      SELECT MAX(SUBSTRING(project_parcel_code FROM 3 FOR 5)::INTEGER) as max_seq 
      FROM parcels 
      WHERE project_parcel_code ~ '^B-[0-9]{5}-';
    `);
    let currentSequence = Number(maxCodeRes.rows[0]?.max_seq || 1228);
    console.log(`🔢 Thứ tự sequence hiện tại trong DB: ${currentSequence}`);

    // Xóa dữ liệu cũ của riêng ZONE_08 (nếu có nạp thử trước đó) để đảm bảo idempotent
    const deleted = await client.query("DELETE FROM parcels WHERE zone_id = 'ZONE_08';");
    if (deleted.rowCount && deleted.rowCount > 0) {
      console.log(`🧹 Đã xóa ${deleted.rowCount} thửa cũ của ZONE_08 để nạp mới.`);
      // Tính lại sequence nếu vừa xóa
      const recheck = await client.query(`
        SELECT MAX(SUBSTRING(project_parcel_code FROM 3 FOR 5)::INTEGER) as max_seq 
        FROM parcels 
        WHERE project_parcel_code ~ '^B-[0-9]{5}-';
      `);
      currentSequence = Number(recheck.rows[0]?.max_seq || 1228);
      console.log(`🔢 Thứ tự sequence sau khi làm sạch: ${currentSequence}`);
    }

    let insertedCount = 0;
    let skippedCount = 0;
    let startCode = '';
    let endCode = '';

    for (const p of rawParcels) {
      const mathuadat = p.mathuadat;
      if (!mathuadat) continue;

      // Kiểm tra xem thửa này đã tồn tại ở Zone khác chưa (First-Come, First-Served)
      const check = await client.query(
        `SELECT id, project_parcel_code, zone_id FROM parcels WHERE official_cadastral_code = $1 LIMIT 1;`,
        [String(mathuadat)]
      );

      if (check.rows.length > 0) {
        skippedCount++;
        continue;
      }

      currentSequence++;
      const seqStr = String(currentSequence).padStart(5, '0');
      const projectParcelCode = `B-${seqStr}-POR`;
      const codeSlug = `B-${seqStr}-POR`;

      if (!startCode) startCode = projectParcelCode;
      endCode = projectParcelCode;

      // Chuẩn hóa closed polygon WKT
      const coords = (p.ranh_coords || []) as [number, number][];
      if (coords.length < 3) continue;

      const wktPoints = coords.map(([lat, lng]) => `${lng} ${lat}`);
      if (wktPoints[0] !== wktPoints[wktPoints.length - 1]) {
        wktPoints.push(wktPoints[0]);
      }
      const wkt = `POLYGON((${wktPoints.join(', ')}))`;

      const sothua = p.sothua ? String(p.sothua) : String(currentSequence);
      const soto = p.soto ? String(p.soto) : '1';
      const street = p.logioi_details?.[0]?.tenduong || 'Đường Cách Mạng Tháng Tám';
      const ward = p.tenphuongxa || 'Phường 15';
      const district = p.tenquanhuyen || 'Quận 10';
      const landArea = parseFloat(p.dientich) || 60.0;
      const constructionArea = Math.round(landArea * 0.85 * 10) / 10;

      await client.query(`
        INSERT INTO parcels (
          zone_id,
          segment_type,
          project_parcel_code,
          code_slug,
          official_cadastral_code,
          field_survey_code,
          house_number,
          street,
          ward,
          district,
          owner_name,
          owner_phone,
          land_area_m2,
          construction_area_m2,
          floor_count,
          building_type,
          total_units,
          survey_status,
          lifecycle_status,
          location_geom,
          cadastral_polygon_geom,
          footprint_polygon_geom
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19,
          ST_SetSRID(ST_MakePoint($20, $21), 4326),
          ST_MakeValid(ST_SetSRID(ST_PolygonFromText($22), 4326)),
          ST_MakeValid(ST_SetSRID(ST_PolygonFromText($22), 4326))
        );
      `, [
        'ZONE_08',
        'POR',
        projectParcelCode,
        codeSlug,
        String(mathuadat),
        `KS-Zone_08-${mathuadat}`,
        sothua,
        street,
        ward,
        district,
        `Chủ hộ thửa ${sothua} (Tờ ${soto})`,
        '090' + String(1000000 + (currentSequence % 9000000)),
        landArea,
        constructionArea,
        2,
        'STANDALONE',
        1,
        'NOT_SURVEYED',
        'ACTIVE',
        p.longitude,
        p.latitude,
        wkt,
      ]);

      insertedCount++;
    }

    // 2. Cập nhật số lượng vào bảng metro_zones
    await client.query(`
      UPDATE metro_zones
      SET total_parcels_count = (SELECT COUNT(*) FROM parcels WHERE zone_id = 'ZONE_08'),
          approved_parcels_count = (SELECT COUNT(*) FROM parcels WHERE zone_id = 'ZONE_08' AND survey_status = 'APPROVED')
      WHERE zone_code = 'ZONE_08';
    `);

    await client.query('COMMIT;');

    const summary: Zone08Summary = {
      totalRaw: rawParcels.length,
      inserted: insertedCount,
      skipped: skippedCount,
      startCode,
      endCode,
    };

    console.log(`\n🎉 Nạp dữ liệu Zone 8 thành công!`);
    console.log(`   - Tổng thửa trong file: ${summary.totalRaw}`);
    console.log(`   - Thửa đã nạp mới: ${summary.inserted}`);
    console.log(`   - Thửa bỏ qua: ${summary.skipped}`);
    console.log(`   - Dải mã định danh: [${summary.startCode} -> ${summary.endCode}]`);

    return summary;
  } catch (error) {
    await client.query('ROLLBACK;');
    console.error('❌ Lỗi khi nạp dữ liệu Zone 8:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedZone08()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
