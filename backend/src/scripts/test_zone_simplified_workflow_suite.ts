import fs from 'fs';
import path from 'path';
import { pool } from '../database/db';
import {
  CadastralIngestionService,
  RawParcelItem,
  ZoneOverviewItem,
} from '../modules/cadastral/services/cadastral-ingestion.service';
import { CadastralService } from '../modules/cadastral/cadastral.service';
import { BadRequestError } from '../common/errors/problem-details';

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
    console.log(`\n✅ [${id}] ${name}`);
    console.log('   👉 Kết quả: ĐẠT CHUẨN (PASSED)');
    if (details) console.log('   👉 Chi tiết:', JSON.stringify(details, null, 2));
  } else {
    console.error(`\n❌ [${id}] ${name}`);
    console.error('   👉 Kết quả: THẤT BẠI (FAILED)');
    if (error) console.error('   👉 Lỗi:', error);
    if (details) console.error('   👉 Chi tiết:', JSON.stringify(details, null, 2));
  }
}

async function runSimplifiedWorkflowSuite() {
  console.log('='.repeat(80));
  console.log('🚀 METRO 2 BCS: BỘ KIỂM THỬ TỔNG HỢP QUY TRÌNH ZONE ĐIỀU CHỈNH');
  console.log('   Theo kế hoạch: ke_hoach_dieu_chinh_4_van_de_zone.md');
  console.log('='.repeat(80));

  // Tải dữ liệu mẫu Zone 07
  const zone07Path = path.resolve(__dirname, '../../../data/Zone_07/ban_do_data.json');
  if (!fs.existsSync(zone07Path)) {
    throw new Error(`Không tìm thấy file nguồn data: ${zone07Path}`);
  }
  const rawFileContent = JSON.parse(fs.readFileSync(zone07Path, 'utf8'));
  const rawParcels = Object.values(rawFileContent.parcels || rawFileContent) as RawParcelItem[];

  // -------------------------------------------------------------
  // TC1: Fresh Import & Auto Active (Nạp mới & Luôn mở khảo sát)
  // -------------------------------------------------------------
  try {
    const auditRes = await CadastralIngestionService.auditZonePayload('ZONE_07', rawParcels);
    const validCountMatch = auditRes.totalIncoming === 391 && auditRes.validParcelsCount === 391;
    const startCodeMatch = auditRes.codePreview.startCode === 'C&C-04-B-0001';
    const endCodeMatch = auditRes.codePreview.endCode === 'C&C-04-B-0391';

    // Nạp dữ liệu Zone 07 (forceCleanReimport = true nếu đã có)
    const importRes = await CadastralIngestionService.executeImportZone('ZONE_07', rawParcels, undefined, true);

    // Kiểm tra DB: is_active = true, total_parcels_count = 391
    const zoneDb = await pool.query(
      `SELECT zone_code, total_parcels_count, is_active FROM metro_zones WHERE zone_code = 'ZONE_07';`
    );
    const row = zoneDb.rows[0];
    const isDbActive = row?.is_active === true;
    const countMatch = row?.total_parcels_count === 391;

    const passed = validCountMatch && startCodeMatch && endCodeMatch && importRes.insertedCount === 391 && isDbActive && countMatch;
    recordTest('TC1', 'Nạp mới Zone 07 (391 thửa, mã C&C-04-B-0001..0391, is_active = true)', passed, undefined, {
      totalIncoming: auditRes.totalIncoming,
      codePreview: auditRes.codePreview,
      insertedCount: importRes.insertedCount,
      zoneIsActive: row?.is_active,
      zoneTotalCount: row?.total_parcels_count,
    });
  } catch (err: unknown) {
    recordTest('TC1', 'Nạp mới Zone 07 (391 thửa, mã C&C-04-B-0001..0391, is_active = true)', false, String(err));
  }

  // -------------------------------------------------------------
  // TC2: Cross-Zone Spillage FCFS (Thửa tràn sang zone bên cạnh)
  // -------------------------------------------------------------
  try {
    // Lấy 1 thửa thực tế đang có ở Zone 07
    const existingP07 = await pool.query<{ official_cadastral_code: string; project_parcel_code: string }>(
      `SELECT official_cadastral_code, project_parcel_code FROM parcels WHERE zone_id = 'ZONE_07' LIMIT 1;`
    );
    const p07Code = existingP07.rows[0].official_cadastral_code;
    const p07ProjectCode = existingP07.rows[0].project_parcel_code;

    // Giả lập file nạp cho Zone lân cận (ZONE_06) có 2 thửa: 1 thửa trùng mã với Zone 07, 1 thửa mới tinh
    const testOverlappingPayload: RawParcelItem[] = [
      {
        mathuadat: p07Code, // Trùng với Zone 07
        dientich: 75.5,
        ranh_coords: [
          [10.785, 106.665],
          [10.786, 106.665],
          [10.786, 106.666],
          [10.785, 106.665],
        ],
        latitude: 10.7855,
        longitude: 106.6655,
        duong: 'Cách Mạng Tháng 8',
      },
      {
        mathuadat: 'TEST_06_001',
        dientich: 82.0,
        ranh_coords: [
          [10.787, 106.667],
          [10.788, 106.667],
          [10.788, 106.668],
          [10.787, 106.667],
        ],
        latitude: 10.7875,
        longitude: 106.6675,
        duong: 'Cách Mạng Tháng 8',
      },
    ];

    // 1. Audit kiểm tra: phát hiện trùng lặp
    const auditOverlap = await CadastralIngestionService.auditZonePayload('ZONE_06', testOverlappingPayload);
    const caughtDuplicate = auditOverlap.duplicatesOtherZones.some(
      (d) => d.mathuadat === p07Code && d.existingZoneId === 'ZONE_07'
    );

    // 2. Nạp vào Zone 06: thửa trùng phải bị bỏ qua (FCFS), thửa mới được nạp
    await CadastralIngestionService.executeImportZone('ZONE_06', testOverlappingPayload, undefined, false);

    // 3. Kiểm tra DB: thửa cũ ở Zone 07 không bị cướp hay đổi zone
    const checkOriginal = await pool.query(
      `SELECT zone_id, project_parcel_code FROM parcels WHERE official_cadastral_code = $1;`,
      [p07Code]
    );
    const originalUnchanged =
      checkOriginal.rows.length === 1 &&
      checkOriginal.rows[0].zone_id === 'ZONE_07' &&
      checkOriginal.rows[0].project_parcel_code === p07ProjectCode;

    // 4. Kiểm tra thửa mới đã vào Zone 06
    const checkNew = await pool.query(
      `SELECT zone_id FROM parcels WHERE official_cadastral_code = 'TEST_06_001';`
    );
    const newInsertedIn06 = checkNew.rows.length === 1 && checkNew.rows[0].zone_id === 'ZONE_06';

    // Dọn dẹp dữ liệu test Zone 06
    await pool.query(`DELETE FROM parcels WHERE zone_id = 'ZONE_06';`);
    await pool.query(`UPDATE metro_zones SET total_parcels_count = 0 WHERE zone_code = 'ZONE_06';`);

    const passed = caughtDuplicate && originalUnchanged && newInsertedIn06;
    recordTest('TC2', 'Thửa tràn sang zone bên cạnh tuân thủ FCFS (Bảo vệ thửa gốc, bỏ qua trùng lặp)', passed, undefined, {
      duplicateReportedInAudit: caughtDuplicate,
      originalZone07Untouched: originalUnchanged,
      newParcelInsertedZone06: newInsertedIn06,
    });
  } catch (err: unknown) {
    recordTest('TC2', 'Thửa tràn sang zone bên cạnh tuân thủ FCFS (Bảo vệ thửa gốc, bỏ qua trùng lặp)', false, String(err));
  }

  // -------------------------------------------------------------
  // TC3: Clean Re-import when Survey Count = 0 (Nạp lại sạch)
  // -------------------------------------------------------------
  try {
    // Đảm bảo Zone 07 có 0 thửa khảo sát
    await pool.query(`UPDATE parcels SET survey_status = 'NOT_SURVEYED' WHERE zone_id = 'ZONE_07';`);

    const auditReimport = await CadastralIngestionService.auditZonePayload('ZONE_07', rawParcels);
    const canReimport = auditReimport.canImport === true && auditReimport.isCleanReimport === true;
    const zeroSurveyed = auditReimport.existingSurveyedCount === 0;

    // Thực hiện nạp lại
    const reimportResult = await CadastralIngestionService.executeImportZone('ZONE_07', rawParcels, undefined, true);

    const zoneDb = await pool.query(
      `SELECT total_parcels_count, is_active FROM metro_zones WHERE zone_code = 'ZONE_07';`
    );

    const passed = canReimport && zeroSurveyed && reimportResult.insertedCount === 391 && zoneDb.rows[0]?.is_active === true;
    recordTest('TC3', 'Nạp lại an toàn khi chưa có khảo sát (0 thửa surveyed, thay thế sạch, giữ is_active = true)', passed, undefined, {
      canImport: auditReimport.canImport,
      isCleanReimport: auditReimport.isCleanReimport,
      existingSurveyedCount: auditReimport.existingSurveyedCount,
      reimportedCount: reimportResult.insertedCount,
    });
  } catch (err: unknown) {
    recordTest('TC3', 'Nạp lại an toàn khi chưa có khảo sát (0 thửa surveyed, thay thế sạch, giữ is_active = true)', false, String(err));
  }

  // -------------------------------------------------------------
  // TC4: Hard Lock Re-import when >= 1 Surveyed Parcel
  // -------------------------------------------------------------
  try {
    // Đặt 1 thửa sang trạng thái IN_PROGRESS để giả lập đã khảo sát
    const targetParcel = await pool.query<{ id: string; project_parcel_code: string }>(
      `SELECT id, project_parcel_code FROM parcels WHERE zone_id = 'ZONE_07' ORDER BY project_parcel_code ASC LIMIT 1;`
    );
    const parcelId = targetParcel.rows[0].id;
    const parcelCode = targetParcel.rows[0].project_parcel_code;

    await pool.query(`UPDATE parcels SET survey_status = 'IN_PROGRESS' WHERE id = $1;`, [parcelId]);

    // 1. Audit phải báo không thể nạp lại
    const auditLocked = await CadastralIngestionService.auditZonePayload('ZONE_07', rawParcels);
    const auditBlock = auditLocked.canImport === false && auditLocked.existingSurveyedCount === 1;

    // 2. Gọi executeImportZone phải văng BadRequestError (HTTP 400)
    let caughtHttp400 = false;
    let errorDetail = '';
    try {
      await CadastralIngestionService.executeImportZone('ZONE_07', rawParcels, undefined, true);
    } catch (e: unknown) {
      if (e instanceof BadRequestError || (e as Error).name === 'BadRequestError') {
        caughtHttp400 = true;
        errorDetail = (e as Error).message;
      } else {
        errorDetail = String(e);
      }
    }

    // 3. Khôi phục lại trạng thái thửa đất
    await pool.query(`UPDATE parcels SET survey_status = 'NOT_SURVEYED' WHERE id = $1;`, [parcelId]);

    const passed = auditBlock && caughtHttp400;
    recordTest('TC4', 'Khóa cứng nạp lại khi đã có >= 1 thửa khảo sát hiện trường (HTTP 400)', passed, undefined, {
      auditBlocked: auditBlock,
      existingSurveyedCount: auditLocked.existingSurveyedCount,
      caughtHttp400,
      errorMessage: errorDetail,
      testedParcel: parcelCode,
    });
  } catch (err: unknown) {
    recordTest('TC4', 'Khóa cứng nạp lại khi đã có >= 1 thửa khảo sát hiện trường (HTTP 400)', false, String(err));
  }

  // -------------------------------------------------------------
  // TC5: Khảo sát thông suốt không bị chặn bởi nháp / ẩn
  // -------------------------------------------------------------
  try {
    // Lấy 1 surveyor hợp lệ trong DB
    const surveyorUser = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'SURVEYOR' LIMIT 1;`
    );
    const surveyorId = surveyorUser.rows[0]?.id;

    const parcelRes = await pool.query<{ id: string; project_parcel_code: string }>(
      `SELECT id, project_parcel_code FROM parcels WHERE zone_id = 'ZONE_07' LIMIT 1;`
    );
    const testParcelId = parcelRes.rows[0].id;

    if (!surveyorId) {
      throw new Error('Không tìm thấy tài khoản SURVEYOR trong database');
    }

    // Thực hiện startAdHocSurvey
    const surveyReport = await CadastralService.startAdHocSurvey(testParcelId, surveyorId, 'PHASE_1');

    // Kiểm tra DB: thửa đất chuyển sang IN_PROGRESS thành công
    const checkStatus = await pool.query(
      `SELECT survey_status FROM parcels WHERE id = $1;`,
      [testParcelId]
    );

    // Rollback test: dọn report test và đưa parcel về NOT_SURVEYED
    await pool.query(`DELETE FROM phase1_report_details WHERE report_id = $1;`, [surveyReport.activeReportId]);
    await pool.query(`DELETE FROM base_survey_reports WHERE id = $1;`, [surveyReport.activeReportId]);
    await pool.query(`UPDATE parcels SET survey_status = 'NOT_SURVEYED' WHERE id = $1;`, [testParcelId]);

    const passed = !!surveyReport.activeReportId && checkStatus.rows[0]?.survey_status === 'IN_PROGRESS';
    recordTest('TC5', 'Khảo sát viên bắt đầu khảo sát trơn tru (Không bị rào cản nháp/ẩn)', passed, undefined, {
      activeReportId: surveyReport.activeReportId,
      surveyStatusBeforeRollback: checkStatus.rows[0]?.survey_status,
      parcelCode: parcelRes.rows[0].project_parcel_code,
    });
  } catch (err: unknown) {
    recordTest('TC5', 'Khảo sát viên bắt đầu khảo sát trơn tru (Không bị rào cản nháp/ẩn)', false, String(err));
  }

  // -------------------------------------------------------------
  // TC6: Toàn bộ 22 Zone đều mở (is_active = true) & Studio Overview
  // -------------------------------------------------------------
  try {
    const inactiveCount = await pool.query<{ count: string }>(
      `SELECT count(*) FROM metro_zones WHERE is_active = false;`
    );
    const totalCount = await pool.query<{ count: string }>(
      `SELECT count(*) FROM metro_zones;`
    );

    const allActive = parseInt(inactiveCount.rows[0].count, 10) === 0;
    const has22Zones = parseInt(totalCount.rows[0].count, 10) === 22;

    const overview: ZoneOverviewItem[] = await CadastralIngestionService.getZonesOverview();
    const overviewCount = overview.length === 22;
    const hasDataCount = overview.filter((z: ZoneOverviewItem) => z.totalParcelsCount > 0).length;

    const passed = allActive && has22Zones && overviewCount && hasDataCount >= 5;
    recordTest('TC6', 'Tính nhất quán DB & API Studio: Toàn bộ 22 Zone is_active = true, không có zone ẩn', passed, undefined, {
      totalZonesInDb: totalCount.rows[0].count,
      inactiveZonesCount: inactiveCount.rows[0].count,
      overviewZonesReturned: overview.length,
      zonesWithDataCount: hasDataCount,
    });
  } catch (err: unknown) {
    recordTest('TC6', 'Tính nhất quán DB & API Studio: Toàn bộ 22 Zone is_active = true, không có zone ẩn', false, String(err));
  }

  // -------------------------------------------------------------
  // TỔNG KẾT TOÀN BỘ TEST SUITE
  // -------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('📊 BẢNG TỔNG HỢP KẾT QUẢ KIỂM THỬ:');
  console.log('='.repeat(80));

  let allPassed = true;
  for (const r of reports) {
    const mark = r.passed ? 'PASSED ✅' : 'FAILED ❌';
    console.log(`- [${r.id}] ${r.name.padEnd(65)} : ${mark}`);
    if (!r.passed) allPassed = false;
  }

  console.log('='.repeat(80));
  if (allPassed) {
    console.log('🎉 TẤT CẢ 6 TEST CASE NGHIỆP VỤ ĐÃ ĐẠT CHUẨN 100%!');
  } else {
    console.error('⚠️  CÓ TEST CASE THẤT BẠI. VUI LÒNG KIỂM TRA LẠI CHI TIẾT TRÊN!');
    process.exit(1);
  }

  await pool.end();
}

runSimplifiedWorkflowSuite().catch(async (e) => {
  console.error('Lỗi ngoại lệ khi chạy test suite:', e);
  await pool.end();
  process.exit(1);
});
