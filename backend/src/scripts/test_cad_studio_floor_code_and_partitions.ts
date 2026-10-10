import { Database } from '../database/db';
import { CadastralRepository } from '../modules/cadastral/cadastral.repository';

async function runTest() {
  console.log('============================================================');
  console.log('🧪 TEST: CAD STUDIO FLOOR CODE (B01) & PARTITIONS SYNC');
  console.log('============================================================');

  // 1. Tạo hoặc lấy một parcel test
  const parcelRes = await Database.query<{ id: string }>(
    `SELECT id FROM parcels WHERE project_parcel_code = 'TEST-CONDO-STUDIO-01';`
  );
  let parcelId = parcelRes.rows[0]?.id;

  if (!parcelId) {
    const existing = await Database.query<{ zone_id: string }>(`SELECT zone_id FROM parcels WHERE zone_id IS NOT NULL LIMIT 1;`);
    const zoneId = existing.rows[0]?.zone_id;
    if (!zoneId) throw new Error('Không tìm thấy zone_id để chạy test');

    const newP = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
        project_parcel_code, official_cadastral_code, zone_id, building_type, floor_count
      ) VALUES ('TEST-CONDO-STUDIO-01', 'OFF-CAD-STUDIO-01', $1, 'CONDOMINIUM', 2)
      RETURNING id;`,
      [zoneId]
    );
    parcelId = newP.rows[0].id;
  }
  console.log('1. Parcel ID:', parcelId);

  try {
    // 2. Test upsertFloorPlan với floorNumber = 1, floorName = 'Tầng hầm' (không truyền floorCode)
    console.log('\n2. Kiểm thử upsertFloorPlan khi tên là "Tầng hầm" và floorNumber = 1...');
    const plan = await CadastralRepository.upsertFloorPlan({
      parcelId,
      floorNumber: 1,
      floorName: 'Tầng hầm',
      cadPhotoUrl: 'https://r2.metro2.vn/test/basement_cad.jpg',
    });

    console.log('   Plan kết quả:', {
      floor_number: plan.floor_number,
      floor_name: plan.floor_name,
      floor_code: plan.floor_code,
      scope: plan.scope,
      area_type: plan.area_type,
    });

    if (plan.floor_code !== 'B01') {
      throw new Error(`FAIL: floor_code dự kiến B01 nhưng lại là ${plan.floor_code}`);
    }
    if (plan.scope !== 'MASTER') {
      throw new Error(`FAIL: scope dự kiến MASTER nhưng lại là ${plan.scope}`);
    }
    if (plan.area_type !== 'BASEMENT') {
      throw new Error(`FAIL: area_type dự kiến BASEMENT nhưng lại là ${plan.area_type}`);
    }
    console.log('   => PASS: Tầng hầm tự động gán floorCode = B01, scope = MASTER, area_type = BASEMENT!');

    // 3. Test lưu 4 ô phân chia Master Area
    console.log('\n3. Kiểm thử saveUnitPartitions cho 4 ô Master...');
    const savedUnits = await CadastralRepository.saveUnitPartitions(
      parcelId,
      1,
      plan.id,
      [
        { unitCode: 'TB01.01', unitType: 'MASTER', bbox: { x: 10, y: 10, width: 20, height: 20 } },
        { unitCode: 'TB01.02', unitType: 'MASTER', bbox: { x: 30, y: 10, width: 20, height: 20 } },
        { unitCode: 'TB01.03', unitType: 'MASTER', bbox: { x: 50, y: 10, width: 20, height: 20 } },
        { unitCode: 'TB01.04', unitType: 'MASTER', bbox: { x: 70, y: 10, width: 20, height: 20 } },
      ]
    );

    console.log(`   Đã lưu ${savedUnits.length} units.`);
    if (savedUnits.length !== 4) {
      throw new Error(`FAIL: Dự kiến lưu 4 units nhưng kết quả là ${savedUnits.length}`);
    }

    // 4. Kiểm tra truy vấn units theo parcelId
    console.log('\n4. Kiểm tra nạp lại units và bboxes từ CSDL...');
    const allUnits = await CadastralRepository.findUnitsByParcelId(parcelId);
    const floor1Units = allUnits.filter((u) => u.floor_number === 1);
    console.log('   Số units tầng 1 tìm thấy:', floor1Units.length);
    console.log('   Mã các units:', floor1Units.map((u) => u.unit_code));

    if (floor1Units.length !== 4) {
      throw new Error(`FAIL: Dự kiến 4 units tầng 1 nhưng tìm thấy ${floor1Units.length}`);
    }
    for (const u of floor1Units) {
      if (!u.cad_bbox || !u.cad_bbox.width) {
        throw new Error(`FAIL: Unit ${u.unit_code} không có tọa độ cad_bbox!`);
      }
      if (u.unit_type !== 'MASTER') {
        throw new Error(`FAIL: Unit ${u.unit_code} có unit_type không phải MASTER (${u.unit_type})!`);
      }
    }
    console.log('   => PASS: Cả 4 ô Master đều lưu trữ đầy đủ tọa độ CAD và unit_type = MASTER!');

    console.log('\n============================================================');
    console.log('🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ ĐỀU ĐẠT CHUẨN 100%!');
    console.log('============================================================');
  } finally {
    // Dọn dẹp dữ liệu test
    console.log('\n🧹 Dọn dẹp dữ liệu test...');
    await Database.query(`DELETE FROM building_units WHERE parcel_id = $1;`, [parcelId]);
    await Database.query(`DELETE FROM building_floor_plans WHERE parcel_id = $1;`, [parcelId]);
    await Database.query(`DELETE FROM parcels WHERE id = $1;`, [parcelId]);
    console.log('✅ Đã dọn dẹp sạch sẽ CSDL.');
    process.exit(0);
  }
}

runTest().catch((err) => {
  console.error('❌ TEST ERROR:', err);
  process.exit(1);
});
