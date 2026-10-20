import {
  CadastralIngestionService,
  RawParcelItem,
} from '../modules/cadastral/services/cadastral-ingestion.service';
import { pool } from '../database/db';
import fs from 'fs';
import path from 'path';

interface TestCaseReport {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

const reports: TestCaseReport[] = [];

function recordTest(id: string, name: string, passed: boolean, error?: string, details?: Record<string, unknown>) {
  reports.push({ id, name, passed, error, details });
  if (passed) {
    console.log(`✅ [${id}] ${name} - PASSED`);
    if (details) console.log('   Chi tiết:', JSON.stringify(details, null, 2));
  } else {
    console.error(`❌ [${id}] ${name} - FAILED`);
    if (error) console.error('   Lỗi:', error);
    if (details) console.error('   Chi tiết:', JSON.stringify(details, null, 2));
  }
}

async function runBusinessTestSuite() {
  console.log('='.repeat(70));
  console.log('🚀 METRO 2 BCS: BẮT ĐẦU BỘ TESTCASE NGHIỆP VỤ NẠP DỮ LIỆU ZONE_07');
  console.log('='.repeat(70));

  const zone07Path = path.resolve(__dirname, '../../../data/Zone_07/ban_do_data.json');
  if (!fs.existsSync(zone07Path)) {
    throw new Error(`Không tìm thấy file nguồn data: ${zone07Path}`);
  }
  const rawFileContent = JSON.parse(fs.readFileSync(zone07Path, 'utf8'));
  const rawParcels = Object.values(rawFileContent.parcels || rawFileContent) as RawParcelItem[];

  // -------------------------------------------------------------
  // TC1: Audit data validation
  // -------------------------------------------------------------
  try {
    const auditRes = await CadastralIngestionService.auditZonePayload('ZONE_07', rawParcels);
    const validCountMatch = auditRes.totalIncoming === 391 && auditRes.validParcelsCount === 391;
    const noInvalidGeom = auditRes.invalidGeometryCount === 0;

    // Test with 2 corrupted items:
    // 1. Bad coordinates length (< 3)
    // 2. Latitude out of HCMC bounds (> 11.5)
    const corruptPayload: RawParcelItem[] = [
      ...rawParcels.slice(0, 5),
      {
        mathuadat: 'CORRUPT_001',
        dientich: 50,
        ranh_coords: [[0, 0]], // Invalid: only 1 point
        latitude: 10.78,
        longitude: 106.67,
      },
      {
        mathuadat: 'CORRUPT_002',
        dientich: 50,
        ranh_coords: [[10.78, 106.67], [10.79, 106.67], [10.79, 106.68]],
        latitude: 99.0, // Out of HCM bounds
        longitude: 200.0,
      },
    ];
    const corruptAudit = await CadastralIngestionService.auditZonePayload('ZONE_07', corruptPayload);
    const caughtCorrupt = corruptAudit.invalidGeometryCount === 2;

    const passed = validCountMatch && noInvalidGeom && caughtCorrupt;
    recordTest('TC1', 'Audit Data Validation & Phát hiện hình học/tọa độ bất hợp lệ', passed, undefined, {
      totalIncoming: auditRes.totalIncoming,
      validParcelsCount: auditRes.validParcelsCount,
      corruptDetected: corruptAudit.invalidGeometryCount,
    });
  } catch (err: unknown) {
    recordTest('TC1', 'Audit Data Validation & Phát hiện hình học/tọa độ bất hợp lệ', false, String(err));
  }

  // -------------------------------------------------------------
  // TC2: Real DB Parcel Coding Convention (C&C-04-B-XXXX)
  // -------------------------------------------------------------
  try {
    const auditRes = await CadastralIngestionService.auditZonePayload('ZONE_07', rawParcels);
    const expectedStartCode = 'C&C-04-B-0001';
    const expectedEndCode = 'C&C-04-B-0391';
    const expectedSlugStart = 'CC-04-B-0001';
    const expectedSlugEnd = 'CC-04-B-0391';

    const passed =
      auditRes.codePreview.startCode === expectedStartCode &&
      auditRes.codePreview.endCode === expectedEndCode &&
      auditRes.codePreview.slugStartCode === expectedSlugStart &&
      auditRes.codePreview.slugEndCode === expectedSlugEnd;

    recordTest('TC2', 'Quy chuẩn mã hóa thửa đất (C&C-04-B-XXXX và CC-04-B-XXXX)', passed, undefined, {
      startCode: auditRes.codePreview.startCode,
      endCode: auditRes.codePreview.endCode,
      slugStart: auditRes.codePreview.slugStartCode,
      slugEnd: auditRes.codePreview.slugEndCode,
    });
  } catch (err: unknown) {
    recordTest('TC2', 'Quy chuẩn mã hóa thửa đất (C&C-04-B-XXXX và CC-04-B-XXXX)', false, String(err));
  }

  // -------------------------------------------------------------
  // TC3: First-Come-First-Served (FCFS) Deduplication
  // -------------------------------------------------------------
  try {
    // Lấy 1 official_cadastral_code đang có trong bảng parcels từ zone khác
    const existingRow = await pool.query<{ official_cadastral_code: string; zone_id: string }>(
      `SELECT official_cadastral_code, zone_id FROM parcels WHERE zone_id != 'ZONE_07' AND official_cadastral_code IS NOT NULL LIMIT 1`
    );

    if (existingRow.rows.length === 0) {
      recordTest('TC3', 'FCFS Deduplication cross-zone', true, undefined, { note: 'Chưa có zone nào khác có data' });
    } else {
      const otherParcel = existingRow.rows[0];
      const testPayloadWithDuplicate: RawParcelItem[] = [
        ...rawParcels.slice(0, 10),
        {
          mathuadat: otherParcel.official_cadastral_code, // Trùng với zone khác!
          dientich: 100,
          ranh_coords: rawParcels[0].ranh_coords,
          latitude: rawParcels[0].latitude,
          longitude: rawParcels[0].longitude,
        },
      ];

      const dedupAudit = await CadastralIngestionService.auditZonePayload('ZONE_07', testPayloadWithDuplicate);
      const duplicateFound = dedupAudit.duplicatesOtherZones.some(
        d => d.mathuadat === String(otherParcel.official_cadastral_code) && d.existingZoneId === otherParcel.zone_id
      );

      recordTest('TC3', 'First-Come-First-Served (FCFS) Deduplication cross-zone', duplicateFound, undefined, {
        conflictCadastralCode: otherParcel.official_cadastral_code,
        conflictZoneId: otherParcel.zone_id,
        duplicateCount: dedupAudit.duplicatesOtherZones.length,
      });
    }
  } catch (err: unknown) {
    recordTest('TC3', 'First-Come-First-Served (FCFS) Deduplication cross-zone', false, String(err));
  }

  // -------------------------------------------------------------
  // TC4: Clean Re-import when 100% NOT_SURVEYED
  // -------------------------------------------------------------
  try {
    // 1st Import
    const import1 = await CadastralIngestionService.executeImportZone('ZONE_07', rawParcels, undefined, true);
    const dbCount1 = await pool.query<{ cnt: string }>(`SELECT count(*) as cnt FROM parcels WHERE zone_id = 'ZONE_07'`);
    const count1 = parseInt(dbCount1.rows[0].cnt, 10);

    // 2nd Clean Re-import (must replace cleanly without error)
    const import2 = await CadastralIngestionService.executeImportZone('ZONE_07', rawParcels, undefined, true);
    const dbCount2 = await pool.query<{ cnt: string }>(`SELECT count(*) as cnt FROM parcels WHERE zone_id = 'ZONE_07'`);
    const count2 = parseInt(dbCount2.rows[0].cnt, 10);

    const passed = import1.insertedCount === 391 && count1 === 391 && import2.insertedCount === 391 && count2 === 391;
    recordTest('TC4', 'Clean Re-import an toàn khi 100% thửa đất NOT_SURVEYED', passed, undefined, {
      import1Count: import1.insertedCount,
      dbCountAfter1: count1,
      import2Count: import2.insertedCount,
      dbCountAfter2: count2,
    });
  } catch (err: unknown) {
    recordTest('TC4', 'Clean Re-import an toàn khi 100% thửa đất NOT_SURVEYED', false, String(err));
  }

  // -------------------------------------------------------------
  // TC5: Re-import Locked when survey has started
  // -------------------------------------------------------------
  try {
    // Pick 1 parcel in ZONE_07 and simulate survey started
    const sampleRow = await pool.query<{ id: string }>(
      `SELECT id FROM parcels WHERE zone_id = 'ZONE_07' LIMIT 1`
    );
    const sampleId = sampleRow.rows[0].id;

    await pool.query(
      `UPDATE parcels SET survey_status = 'IN_PROGRESS' WHERE id = $1`,
      [sampleId]
    );

    let lockedErrorCaught = false;
    let errorMessage = '';

    try {
      await CadastralIngestionService.executeImportZone('ZONE_07', rawParcels, undefined, true);
    } catch (err: unknown) {
      lockedErrorCaught = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    // Revert status back to NOT_SURVEYED
    await pool.query(
      `UPDATE parcels SET survey_status = 'NOT_SURVEYED' WHERE id = $1`,
      [sampleId]
    );

    const passed = lockedErrorCaught && errorMessage.includes('khảo sát hiện trường');
    recordTest('TC5', 'Khóa cưỡng bức (Re-import Locked) khi có thửa đang khảo sát', passed, undefined, {
      lockedErrorCaught,
      errorMessage,
    });
  } catch (err: unknown) {
    recordTest('TC5', 'Khóa cưỡng bức (Re-import Locked) khi có thửa đang khảo sát', false, String(err));
  }

  // -------------------------------------------------------------
  // TC6: Zone Draft vs Active Activation
  // -------------------------------------------------------------
  try {
    // Check initial active status after import (should be false/Draft)
    const initialZone = await pool.query<{ is_active: boolean }>(
      `SELECT is_active FROM metro_zones WHERE zone_code = 'ZONE_07'`
    );
    const initialActive = initialZone.rows[0]?.is_active;

    // Turn ON
    await CadastralIngestionService.setZoneActive('ZONE_07', true);
    const dbCheckOn = await pool.query<{ is_active: boolean }>(
      `SELECT is_active FROM metro_zones WHERE zone_code = 'ZONE_07'`
    );

    // Turn OFF
    await CadastralIngestionService.setZoneActive('ZONE_07', false);
    const dbCheckOff = await pool.query<{ is_active: boolean }>(
      `SELECT is_active FROM metro_zones WHERE zone_code = 'ZONE_07'`
    );

    // Turn back ON for system availability
    await CadastralIngestionService.setZoneActive('ZONE_07', true);
    const dbFinalCheck = await pool.query<{ is_active: boolean }>(
      `SELECT is_active FROM metro_zones WHERE zone_code = 'ZONE_07'`
    );

    const passed =
      initialActive === false &&
      dbCheckOn.rows[0].is_active === true &&
      dbCheckOff.rows[0].is_active === false &&
      dbFinalCheck.rows[0].is_active === true;

    recordTest('TC6', 'Cơ chế kích hoạt Zone (Draft Mode <-> Công Bố Khảo Sát)', passed, undefined, {
      initialActive,
      turnOnSuccess: dbCheckOn.rows[0].is_active,
      turnOffSuccess: !dbCheckOff.rows[0].is_active,
      finalState: 'ACTIVATED',
    });
  } catch (err: unknown) {
    recordTest('TC6', 'Cơ chế kích hoạt Zone (Draft Mode <-> Công Bố Khảo Sát)', false, String(err));
  }

  // -------------------------------------------------------------
  // TC7: PostGIS Spatial Validity
  // -------------------------------------------------------------
  try {
    const invalidGeomQuery = await pool.query<{ cnt: string }>(
      `SELECT count(*) as cnt FROM parcels WHERE zone_id = 'ZONE_07' AND ST_IsValid(cadastral_polygon_geom) = false`
    );
    const invalidGeomCount = parseInt(invalidGeomQuery.rows[0].cnt, 10);

    const sridCheck = await pool.query<{ cnt: string }>(
      `SELECT count(*) as cnt FROM parcels WHERE zone_id = 'ZONE_07' AND ST_SRID(cadastral_polygon_geom) != 4326`
    );
    const nonSrid4326Count = parseInt(sridCheck.rows[0].cnt, 10);

    const geomTypeCheck = await pool.query<{ cnt: string }>(
      `SELECT count(*) as cnt FROM parcels WHERE zone_id = 'ZONE_07' AND ST_GeometryType(cadastral_polygon_geom) != 'ST_Polygon'`
    );
    const nonPolygonCount = parseInt(geomTypeCheck.rows[0].cnt, 10);

    const totalZoneParcels = await pool.query<{ total_parcels_count: number }>(
      `SELECT total_parcels_count FROM metro_zones WHERE zone_code = 'ZONE_07'`
    );
    const syncedCount = totalZoneParcels.rows[0]?.total_parcels_count;

    const passed =
      invalidGeomCount === 0 &&
      nonSrid4326Count === 0 &&
      nonPolygonCount === 0 &&
      syncedCount === 391;

    recordTest('TC7', 'Chuẩn hóa không gian PostGIS (ST_IsValid, SRID 4326, Polygon ring)', passed, undefined, {
      invalidGeomCount,
      nonSrid4326Count,
      nonPolygonCount,
      metroZonesTotalCount: syncedCount,
    });
  } catch (err: unknown) {
    recordTest('TC7', 'Chuẩn hóa không gian PostGIS (ST_IsValid, SRID 4326, Polygon ring)', false, String(err));
  }

  // -------------------------------------------------------------
  // Tổng kết
  // -------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log('📊 TỔNG KẾT KẾT QUẢ TEST NGHIỆP VỤ:');
  console.log('='.repeat(70));
  const totalTests = reports.length;
  const passedTests = reports.filter(r => r.passed).length;
  const failedTests = reports.filter(r => !r.passed);

  console.log(`Tổng số test case: ${totalTests}`);
  console.log(`Đạt (PASSED): ${passedTests}`);
  console.log(`Thất bại (FAILED): ${failedTests.length}`);

  if (failedTests.length > 0) {
    console.error('\n❌ CÁC TESTCASE THẤT BÀI:');
    failedTests.forEach(f => {
      console.error(`- [${f.id}] ${f.name}: ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 TOÀN BỘ 7/7 TESTCASES NGHIỆP VỤ ĐÃ ĐẠT CHUẨN XUẤT SẮC!');
  }
}

runBusinessTestSuite()
  .catch((err) => {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
