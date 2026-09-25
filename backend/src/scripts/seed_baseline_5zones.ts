import fs from 'fs';
import path from 'path';
import { pool } from '../database/db';

interface ZoneImportConfig {
  folder: string;
  zoneId: string;
  legacyCode: string;
  segmentType: 'C&C' | 'POR' | 'ELV' | 'DEP';
  name: string;
}

const ZONES_TO_IMPORT: ZoneImportConfig[] = [
  { folder: 'Zone_01', zoneId: 'ZONE_01', legacyCode: 'ZONE_S1', segmentType: 'C&C', name: 'Ga S1 Bến Thành' },
  { folder: 'Zone_02', zoneId: 'ZONE_02', legacyCode: 'ZONE_S2', segmentType: 'POR', name: 'Hầm TBM Bến Thành - Tao Đàn' },
  { folder: 'Zone_03', zoneId: 'ZONE_03', legacyCode: 'ZONE_S3', segmentType: 'C&C', name: 'Ga S2 Tao Đàn' },
  { folder: 'Zone_04', zoneId: 'ZONE_04', legacyCode: 'ZONE_S4', segmentType: 'POR', name: 'Hầm TBM Tao Đàn - Dân Chủ' },
  { folder: 'Zone_09', zoneId: 'ZONE_09', legacyCode: 'ZONE_S5', segmentType: 'C&C', name: 'Ga S5 Lê Thị Riêng' },
];

async function runSeed() {
  const client = await pool.connect();
  try {
    console.log('🚀 Bắt đầu nạp dữ liệu địa chính 5 Zone chuẩn B-XXXXX-YYY...');
    await client.query('BEGIN;');

    // Truncate parcels to start fresh
    console.log('🧹 Xóa sạch dữ liệu thửa đất cũ...');
    await client.query('TRUNCATE TABLE parcels CASCADE;');

    let globalSequence = 0;
    const summary: Record<string, { totalRaw: number; inserted: number; skipped: number; startCode: string; endCode: string }> = {};

    for (const z of ZONES_TO_IMPORT) {
      const filePath = path.resolve(__dirname, `../../../data/${z.folder}/ban_do_data.json`);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Không tìm thấy file: ${filePath}`);
        continue;
      }

      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const rawParcels = Object.values(raw.parcels || {}) as any[];
      let insertedCount = 0;
      let skippedCount = 0;
      let startCode = '';
      let endCode = '';

      console.log(`\n📥 Đang xử lý ${z.zoneId} (${z.name}, ${z.segmentType}) - Tổng: ${rawParcels.length} thửa...`);

      for (const p of rawParcels) {
        const mathuadat = p.mathuadat;
        if (!mathuadat) continue;

        // 1. Kiểm tra tồn tại theo quy tắc First-Come, First-Served
        const check = await client.query(
          `SELECT id, project_parcel_code, zone_id FROM parcels WHERE official_cadastral_code = $1 LIMIT 1;`,
          [String(mathuadat)]
        );

        if (check.rows.length > 0) {
          skippedCount++;
          continue; // Đã thuộc zone trước, giữ nguyên không nạp lại
        }

        // 2. Nhảy số liên tục toàn tuyến
        globalSequence++;
        const seqStr = String(globalSequence).padStart(5, '0');
        const projectParcelCode = `B-${seqStr}-${z.segmentType}`;
        const codeSlug = `B-${seqStr}-${z.segmentType.replace('&', '')}`;

        if (!startCode) startCode = projectParcelCode;
        endCode = projectParcelCode;

        // 3. Chuẩn hóa Closed Polygon WKT
        const coords = (p.ranh_coords || []) as [number, number][];
        if (coords.length < 3) continue;

        const wktPoints = coords.map(([lat, lng]) => `${lng} ${lat}`);
        if (wktPoints[0] !== wktPoints[wktPoints.length - 1]) {
          wktPoints.push(wktPoints[0]);
        }
        const wkt = `POLYGON((${wktPoints.join(', ')}))`;

        const sothua = p.sothua ? String(p.sothua) : String(globalSequence);
        const soto = p.soto ? String(p.soto) : '1';
        const street = p.logioi_details?.[0]?.tenduong || p.tenphuongxa || 'Đường chính';
        const ward = p.tenphuongxa || 'Phường Bến Thành';
        const district = p.tenquanhuyen || 'Quận 1';
        const landArea = parseFloat(p.dientich) || 65.0;
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
          z.zoneId,
          z.segmentType,
          projectParcelCode,
          codeSlug,
          String(mathuadat),
          `KS-${z.folder}-${mathuadat}`,
          sothua,
          street,
          ward,
          district,
          `Chủ hộ thửa ${sothua} (Tờ ${soto})`,
          '090' + String(1000000 + (globalSequence % 9000000)),
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

      summary[z.zoneId] = {
        totalRaw: rawParcels.length,
        inserted: insertedCount,
        skipped: skippedCount,
        startCode,
        endCode,
      };

      console.log(`✅ ${z.zoneId}: Nạp ${insertedCount} thửa [${startCode} -> ${endCode}] (Bỏ qua ${skippedCount} thửa trùng ranh)`);
    }

    // 4. Đồng bộ tổng số thửa vào metro_zones
    await client.query(`
      UPDATE metro_zones z
      SET total_parcels_count = (SELECT COUNT(*) FROM parcels p WHERE p.zone_id = z.zone_code),
          approved_parcels_count = 0;
    `);

    await client.query('COMMIT;');
    console.log('\n🎉 THÀNH CÔNG! Báo cáo tổng hợp nạp dữ liệu:');
    console.table(summary);
    console.log(`Tổng số thửa đất đang có trong CSDL: ${globalSequence}`);
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('❌ Lỗi khi nạp dữ liệu:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
