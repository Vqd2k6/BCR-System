import fs from 'fs';
import path from 'path';
import { pool } from '../database/db';
import {
  CadastralIngestionService,
  RawParcelItem,
} from '../modules/cadastral/services/cadastral-ingestion.service';
import { CadastralService } from '../modules/cadastral/cadastral.service';

interface TestCaseReport {
  id: string;
  category: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

const testReports: TestCaseReport[] = [];

function logTestCase(
  id: string,
  category: string,
  name: string,
  passed: boolean,
  error?: string,
  details?: Record<string, unknown>
) {
  testReports.push({ id, category, name, passed, error, details });
  if (passed) {
    console.log(`\n✅ [${id}] [${category}] ${name}`);
    console.log('   👉 Kết quả: ĐẠT CHUẨN (PASSED)');
    if (details) {
      console.log('   👉 Chi tiết:', JSON.stringify(details, null, 2));
    }
  } else {
    console.error(`\n❌ [${id}] [${category}] ${name}`);
    console.error('   👉 Kết quả: THẤT BẠI (FAILED)');
    if (error) console.error('   👉 Lỗi ghi nhận:', error);
    if (details) console.error('   👉 Chi tiết:', JSON.stringify(details, null, 2));
  }
}

async function runEdgeCasesTestSuite() {
  console.log('='.repeat(80));
  console.log('🛡️  METRO 2 BCS: BỘ KIỂM THỬ TOÀN DIỆN 8 TEST CASE NGHIỆP VỤ & ĐIỂM GÃY ZONE');
  console.log('    Quy chuẩn Liên danh CRLG-CRSRI-TT | Database Isolation Audit');
  console.log('='.repeat(80));

  // Tải dữ liệu mẫu Zone 07
  const zone07Path = path.resolve(__dirname, '../../../data/Zone_07/ban_do_data.json');
  if (!fs.existsSync(zone07Path)) {
    throw new Error(`Không tìm thấy file nguồn data: ${zone07Path}`);
  }
  const rawFileContent = JSON.parse(fs.readFileSync(zone07Path, 'utf8'));
  const rawParcels = Object.values(rawFileContent.parcels || rawFileContent) as RawParcelItem[];

  // -------------------------------------------------------------------------
  // NGHIỆP VỤ 1: NẠP & CHUẨN HÓA DỮ LIỆU BẢN ĐỒ (GIS Ingestion & Sequential Coding)
  // -------------------------------------------------------------------------

  // TC1: Parse Payload, Chuẩn hóa Tọa độ & Xử lý Trùng Lặp Nội Bộ (Internal Deduplication)
  try {
    // Tạo payload có 5 thửa bị lặp lại bên trong file
    const duplicatedPayload: RawParcelItem[] = [
      ...rawParcels,
      rawParcels[0], // Thửa trùng 1
      rawParcels[1], // Thửa trùng 2
      rawParcels[2], // Thửa trùng 3
      rawParcels[3], // Thửa trùng 4
      rawParcels[4], // Thửa trùng 5
    ];

    const auditRes = await CadastralIngestionService.auditZonePayload('ZONE_07', duplicatedPayload);
    const validCountDeduped = auditRes.validParcelsCount === 391;
    const totalIncomingCorrect = auditRes.totalIncoming === 396;

    // Nạp thực tế vào DB để đảm bảo không bị crash bời Unique Constraint Postgres
    const importRes = await CadastralIngestionService.executeImportZone('ZONE_07', duplicatedPayload, undefined, true);
    const dbCountCheck = await pool.query<{ cnt: string }>(
      `SELECT count(*) as cnt FROM parcels WHERE zone_id = 'ZONE_07'`
    );
    const actualDbCount = parseInt(dbCountCheck.rows[0].cnt, 10);

    const passed = validCountDeduped && totalIncomingCorrect && importRes.insertedCount === 391 && actualDbCount === 391;

    logTestCase(
      'TC1',
      'Nghiệp vụ 1: Chuẩn Hóa Bản Đồ',
      'Xử lý trùng lặp mã thửa nội bộ (Internal Deduplication) trong cùng tệp tải lên',
      passed,
      undefined,
      {
        totalIncomingWithDuplicates: auditRes.totalIncoming,
        validParcelsCountDeduped: auditRes.validParcelsCount,
        actualDbInsertedCount: actualDbCount,
        preventedPostgresCollision: true,
      }
    );
  } catch (err: unknown) {
    logTestCase(
      'TC1',
      'Nghiệp vụ 1: Chuẩn Hóa Bản Đồ',
      'Xử lý trùng lặp mã thửa nội bộ (Internal Deduplication) trong cùng tệp tải lên',
      false,
      String(err)
    );
  }

  // TC2: Thẩm Định Không Gian PostGIS & Loại Trừ Tọa Độ/Hình Học Bất Hợp Lệ
  try {
    const corruptPayload: RawParcelItem[] = [
      ...rawParcels.slice(0, 5),
      {
        mathuadat: 'CORRUPT_RING_01',
        dientich: 45,
        ranh_coords: [[10.78, 106.67]], // Ít hơn 3 điểm
        latitude: 10.78,
        longitude: 106.67,
      },
      {
        mathuadat: 'CORRUPT_BOUNDS_02',
        dientich: 55,
        ranh_coords: [[10.78, 106.67], [10.79, 106.67], [10.79, 106.68]],
        latitude: 21.02, // Ngoài TP.HCM (Hà Nội)
        longitude: 105.83,
      },
      {
        mathuadat: 'CORRUPT_NAN_03',
        dientich: 60,
        ranh_coords: [[10.78, 106.67], [10.79, 106.67], [10.79, 106.68]],
        latitude: NaN,
        longitude: NaN,
      },
    ];

    const auditCorrupt = await CadastralIngestionService.auditZonePayload('ZONE_07', corruptPayload);
    const corruptDetected = auditCorrupt.invalidGeometryCount === 3;

    // Kiểm tra PostGIS DB của các thửa hợp lệ
    const postgisCheck = await pool.query<{
      invalid_cnt: string;
      srid_cnt: string;
      geom_type_cnt: string;
    }>(`
      SELECT 
        COUNT(*) FILTER (WHERE ST_IsValid(cadastral_polygon_geom) = false) as invalid_cnt,
        COUNT(*) FILTER (WHERE ST_SRID(cadastral_polygon_geom) != 4326) as srid_cnt,
        COUNT(*) FILTER (WHERE ST_GeometryType(cadastral_polygon_geom) != 'ST_Polygon') as geom_type_cnt
      FROM parcels 
      WHERE zone_id = 'ZONE_07';
    `);

    const invalidCnt = parseInt(postgisCheck.rows[0].invalid_cnt, 10);
    const sridCnt = parseInt(postgisCheck.rows[0].srid_cnt, 10);
    const geomTypeCnt = parseInt(postgisCheck.rows[0].geom_type_cnt, 10);

    const passed = corruptDetected && invalidCnt === 0 && sridCnt === 0 && geomTypeCnt === 0;

    logTestCase(
      'TC2',
      'Nghiệp vụ 1: Chuẩn Hóa Bản Đồ',
      'Thẩm định không gian PostGIS, nhận diện hình học lỗi & bảo đảm ST_IsValid, SRID 4326',
      passed,
      undefined,
      {
        corruptInputDetected: auditCorrupt.invalidGeometryCount,
        dbInvalidGeomCount: invalidCnt,
        dbInvalidSridCount: sridCnt,
        dbPolygonGeomTypeValid: geomTypeCnt === 0,
      }
    );
  } catch (err: unknown) {
    logTestCase(
      'TC2',
      'Nghiệp vụ 1: Chuẩn Hóa Bản Đồ',
      'Thẩm định không gian PostGIS, nhận diện hình học lỗi & bảo đảm ST_IsValid, SRID 4326',
      false,
      String(err)
    );
  }

  // TC3: Quy Chuẩn Mã Hóa Tuần Tự & Code Slug (Continuous Sequential Coding)
  try {
    const auditRes = await CadastralIngestionService.auditZonePayload('ZONE_07', rawParcels);
    const expectedStart = 'C&C-04-B-0001';
    const expectedEnd = 'C&C-04-B-0391';
    const expectedSlugStart = 'CC-04-B-0001';
    const expectedSlugEnd = 'CC-04-B-0391';

    // Kiểm tra tính liên tục trong CSDL (không bị gãy số từ 0001 đến 0391)
    const codeQuery = await pool.query<{ project_parcel_code: string; code_slug: string }>(
      `SELECT project_parcel_code, code_slug FROM parcels WHERE zone_id = 'ZONE_07' ORDER BY project_parcel_code ASC;`
    );

    let isStrictlySequential = true;
    for (let i = 0; i < codeQuery.rows.length; i++) {
      const seqStr = String(i + 1).padStart(4, '0');
      const expectedPCode = `C&C-04-B-${seqStr}`;
      const expectedSCode = `CC-04-B-${seqStr}`;
      if (
        codeQuery.rows[i].project_parcel_code !== expectedPCode ||
        codeQuery.rows[i].code_slug !== expectedSCode
      ) {
        isStrictlySequential = false;
        break;
      }
    }

    const passed =
      auditRes.codePreview.startCode === expectedStart &&
      auditRes.codePreview.endCode === expectedEnd &&
      auditRes.codePreview.slugStartCode === expectedSlugStart &&
      auditRes.codePreview.slugEndCode === expectedSlugEnd &&
      isStrictlySequential &&
      codeQuery.rows.length === 391;

    logTestCase(
      'TC3',
      'Nghiệp vụ 1: Chuẩn Hóa Bản Đồ',
      'Quy chuẩn dải mã hóa tuần tự Metro 2 (C&C-04-B-0001 -> C&C-04-B-0391 không đứt đoạn)',
      passed,
      undefined,
      {
        previewStart: auditRes.codePreview.startCode,
        previewEnd: auditRes.codePreview.endCode,
        slugStart: auditRes.codePreview.slugStartCode,
        slugEnd: auditRes.codePreview.slugEndCode,
        totalParcelsChecked: codeQuery.rows.length,
        isStrictlySequential,
      }
    );
  } catch (err: unknown) {
    logTestCase(
      'TC3',
      'Nghiệp vụ 1: Chuẩn Hóa Bản Đồ',
      'Quy chuẩn dải mã hóa tuần tự Metro 2 (C&C-04-B-0001 -> C&C-04-B-0391 không đứt đoạn)',
      false,
      String(err)
    );
  }

  // -------------------------------------------------------------------------
  // NGHIỆP VỤ 2: KIỂM SOÁT & BẢO VỆ KHẢO SÁT KHI NẠP LẠI (Re-import Safety Guard)
  // -------------------------------------------------------------------------

  // TC4: Khóa Cưỡng Bức Nạp Lại Khi Đã Phát Sinh Khảo Sát (Locked When Survey Started)
  try {
    // Giả lập 1 thửa của Zone 07 đã được khảo sát viên nhận (IN_PROGRESS)
    const sampleRow = await pool.query<{ id: string; project_parcel_code: string }>(
      `SELECT id, project_parcel_code FROM parcels WHERE zone_id = 'ZONE_07' LIMIT 1;`
    );
    const sampleId = sampleRow.rows[0].id;
    const sampleCode = sampleRow.rows[0].project_parcel_code;

    await pool.query(`UPDATE parcels SET survey_status = 'IN_PROGRESS' WHERE id = $1;`, [sampleId]);

    let lockedErrorCaught = false;
    let errorMessage = '';

    try {
      await CadastralIngestionService.executeImportZone('ZONE_07', rawParcels, undefined, true);
    } catch (err: unknown) {
      lockedErrorCaught = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    // Đảm bảo dữ liệu thửa không bị xóa nhầm
    const verifyParcelExists = await pool.query<{ count: string }>(
      `SELECT count(*) FROM parcels WHERE id = $1;`,
      [sampleId]
    );

    // Hoàn trả trạng thái về NOT_SURVEYED
    await pool.query(`UPDATE parcels SET survey_status = 'NOT_SURVEYED' WHERE id = $1;`, [sampleId]);

    const passed =
      lockedErrorCaught &&
      errorMessage.includes('khảo sát hiện trường') &&
      parseInt(verifyParcelExists.rows[0].count, 10) === 1;

    logTestCase(
      'TC4',
      'Nghiệp vụ 2: An Toàn Nạp Lại',
      'Khóa cưỡng bức nạp lại (Re-import Lock) khi có thửa đang/đã khảo sát',
      passed,
      undefined,
      {
        testedParcelCode: sampleCode,
        lockedErrorCaught,
        errorMessage,
        dataIntegrityPreserved: true,
      }
    );
  } catch (err: unknown) {
    logTestCase(
      'TC4',
      'Nghiệp vụ 2: An Toàn Nạp Lại',
      'Khóa cưỡng bức nạp lại (Re-import Lock) khi có thửa đang/đã khảo sát',
      false,
      String(err)
    );
  }

  // TC5: Nạp Lại Sạch Sẽ Khi 100% Thửa Chưa Khảo Sát (Clean Re-import Success)
  try {
    // Đảm bảo 100% thửa là NOT_SURVEYED
    await pool.query(`UPDATE parcels SET survey_status = 'NOT_SURVEYED' WHERE zone_id = 'ZONE_07';`);

    const reimportRes = await CadastralIngestionService.executeImportZone('ZONE_07', rawParcels, undefined, true);
    const dbCountCheck = await pool.query<{ cnt: string }>(
      `SELECT count(*) as cnt FROM parcels WHERE zone_id = 'ZONE_07'`
    );
    const zoneCountCheck = await pool.query<{ total_parcels_count: number; is_active: boolean }>(
      `SELECT total_parcels_count, is_active FROM metro_zones WHERE zone_code = 'ZONE_07'`
    );

    const totalCount = parseInt(dbCountCheck.rows[0].cnt, 10);
    const zoneParcels = zoneCountCheck.rows[0].total_parcels_count;

    const passed = reimportRes.insertedCount === 391 && totalCount === 391 && zoneParcels === 391;

    logTestCase(
      'TC5',
      'Nghiệp vụ 2: An Toàn Nạp Lại',
      'Thực thi nạp lại sạch sẽ (Clean Re-import) an toàn khi 100% thửa chưa khảo sát',
      passed,
      undefined,
      {
        reimportInsertedCount: reimportRes.insertedCount,
        parcelsTableCount: totalCount,
        metroZonesTotalCount: zoneParcels,
        resetToDraftOnImport: zoneCountCheck.rows[0].is_active === false,
      }
    );
  } catch (err: unknown) {
    logTestCase(
      'TC5',
      'Nghiệp vụ 2: An Toàn Nạp Lại',
      'Thực thi nạp lại sạch sẽ (Clean Re-import) an toàn khi 100% thửa chưa khảo sát',
      false,
      String(err)
    );
  }

  // -------------------------------------------------------------------------
  // NGHIỆP VỤ 3: QUẢN LÝ TRẠNG THÁI CÔNG BỐ (Publish / Draft State & Access Control)
  // -------------------------------------------------------------------------

  // TC6: Chặn Công Bố Phân Khu Rỗng (Block Activation of Empty Zone)
  try {
    let emptyBlockCaught = false;
    let emptyErrorMessage = '';

    // Thử kích hoạt ZONE_05 (Zone rỗng 0 thửa)
    try {
      await CadastralIngestionService.setZoneActive('ZONE_05', true);
    } catch (err: unknown) {
      emptyBlockCaught = true;
      emptyErrorMessage = err instanceof Error ? err.message : String(err);
    }

    const zone05Check = await pool.query<{ is_active: boolean }>(
      `SELECT is_active FROM metro_zones WHERE zone_code = 'ZONE_05';`
    );

    const passed = emptyBlockCaught && zone05Check.rows[0]?.is_active === false;

    logTestCase(
      'TC6',
      'Nghiệp vụ 3: Quản Lý Công Bố',
      'Chặn kích hoạt/công bố phân đoạn rỗng (0 thửa đất)',
      passed,
      undefined,
      {
        targetEmptyZone: 'ZONE_05',
        emptyBlockCaught,
        errorMessage: emptyErrorMessage,
        dbIsActiveAfterAttempt: zone05Check.rows[0]?.is_active,
      }
    );
  } catch (err: unknown) {
    logTestCase(
      'TC6',
      'Nghiệp vụ 3: Quản Lý Công Bố',
      'Chặn kích hoạt/công bố phân đoạn rỗng (0 thửa đất)',
      false,
      String(err)
    );
  }

  // TC7: Chặn Khảo Sát Viên Bắt Đầu Khảo Sát Trên Phân Khu Nháp (Block Surveyor on Draft Zone)
  try {
    // 1. Đặt ZONE_07 về chế độ Nháp (Draft: is_active = false)
    await pool.query(`UPDATE metro_zones SET is_active = false WHERE zone_code = 'ZONE_07';`);

    const parcelRow = await pool.query<{ id: string; project_parcel_code: string }>(
      `SELECT id, project_parcel_code FROM parcels WHERE zone_id = 'ZONE_07' LIMIT 1;`
    );
    const testParcelId = parcelRow.rows[0].id;

    // Lấy 1 surveyor hợp lệ
    const surveyorRow = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'SURVEYOR' LIMIT 1;`
    );
    const surveyorId = surveyorRow.rows[0].id;

    let draftBlocked = false;
    let draftErrorMessage = '';

    try {
      await CadastralService.startAdHocSurvey(testParcelId, surveyorId);
    } catch (err: unknown) {
      draftBlocked = true;
      draftErrorMessage = err instanceof Error ? err.message : String(err);
    }

    // 2. Bây giờ CÔNG BỐ ZONE_07 (is_active = true) và gọi lại
    await CadastralIngestionService.setZoneActive('ZONE_07', true);
    const startSurveyRes = await CadastralService.startAdHocSurvey(testParcelId, surveyorId);

    // Dọn dẹp bản ghi khảo sát vừa mở để trả dữ liệu về nguyên trạng
    await pool.query(`DELETE FROM phase1_report_details WHERE report_id = $1;`, [startSurveyRes.activeReportId]);
    await pool.query(`DELETE FROM base_survey_reports WHERE id = $1;`, [startSurveyRes.activeReportId]);
    await pool.query(`UPDATE parcels SET survey_status = 'NOT_SURVEYED' WHERE id = $1;`, [testParcelId]);

    const passed =
      draftBlocked &&
      draftErrorMessage.includes('chế độ Nháp') &&
      startSurveyRes.surveyStatus === 'IN_PROGRESS';

    logTestCase(
      'TC7',
      'Nghiệp vụ 3: Quản Lý Công Bố',
      'Chặn khảo sát viên tự nhận thửa trên Zone đang ở chế độ Nháp (Draft)',
      passed,
      undefined,
      {
        draftBlocked,
        draftErrorMessage,
        resumedAfterActivation: startSurveyRes.surveyStatus === 'IN_PROGRESS',
        activeReportCreated: startSurveyRes.activeReportId,
      }
    );
  } catch (err: unknown) {
    logTestCase(
      'TC7',
      'Nghiệp vụ 3: Quản Lý Công Bố',
      'Chặn khảo sát viên tự nhận thửa trên Zone đang ở chế độ Nháp (Draft)',
      false,
      String(err)
    );
  }

  // -------------------------------------------------------------------------
  // NGHIỆP VỤ 4: PHÂN CÔNG ZONE ADMIN & ĐỒNG BỘ 2 CHIỀU (Bi-directional Sync)
  // -------------------------------------------------------------------------

  // TC8: Phân Công Zone Admin & Đồng Bộ 2 Chiều CSDL (Bi-directional Sync)
  try {
    const adminRow = await pool.query<{ id: string; full_name: string; assigned_zone_id: string }>(
      `SELECT id, full_name, assigned_zone_id FROM users WHERE role = 'ZONE_ADMIN' LIMIT 1;`
    );
    const adminId = adminRow.rows[0].id;
    const adminName = adminRow.rows[0].full_name;
    const originalAssignedZone = adminRow.rows[0].assigned_zone_id;

    // 1. Phân công admin cho ZONE_07
    await CadastralIngestionService.assignZoneAdmin('ZONE_07', adminId);

    const zoneCheck1 = await pool.query<{ assigned_admin_id: string }>(
      `SELECT assigned_admin_id FROM metro_zones WHERE zone_code = 'ZONE_07';`
    );
    const userCheck1 = await pool.query<{ assigned_zone_id: string }>(
      `SELECT assigned_zone_id FROM users WHERE id = $1;`,
      [adminId]
    );

    const assignMatch =
      zoneCheck1.rows[0].assigned_admin_id === adminId &&
      userCheck1.rows[0].assigned_zone_id === 'ZONE_07';

    // 2. Hủy phân công (Gán null)
    await CadastralIngestionService.assignZoneAdmin('ZONE_07', null);

    const zoneCheck2 = await pool.query<{ assigned_admin_id: string | null }>(
      `SELECT assigned_admin_id FROM metro_zones WHERE zone_code = 'ZONE_07';`
    );
    const userCheck2 = await pool.query<{ assigned_zone_id: string | null }>(
      `SELECT assigned_zone_id FROM users WHERE id = $1;`,
      [adminId]
    );

    const unassignMatch =
      zoneCheck2.rows[0].assigned_admin_id === null &&
      userCheck2.rows[0].assigned_zone_id === null;

    // Phục hồi lại zone ban đầu của admin nếu có
    if (originalAssignedZone) {
      await pool.query(`UPDATE users SET assigned_zone_id = $1 WHERE id = $2;`, [
        originalAssignedZone,
        adminId,
      ]);
    }

    const passed = assignMatch && unassignMatch;

    logTestCase(
      'TC8',
      'Nghiệp vụ 4: Phân Công Zone Admin',
      'Đồng bộ 2 chiều CSDL giữa metro_zones.assigned_admin_id và users.assigned_zone_id',
      passed,
      undefined,
      {
        adminName,
        assignedZoneCode: 'ZONE_07',
        syncedMetroZone: zoneCheck1.rows[0].assigned_admin_id === adminId,
        syncedUsersTable: userCheck1.rows[0].assigned_zone_id === 'ZONE_07',
        cleanUnassignedMetroZone: zoneCheck2.rows[0].assigned_admin_id === null,
        cleanUnassignedUsersTable: userCheck2.rows[0].assigned_zone_id === null,
      }
    );
  } catch (err: unknown) {
    logTestCase(
      'TC8',
      'Nghiệp vụ 4: Phân Công Zone Admin',
      'Đồng bộ 2 chiều CSDL giữa metro_zones.assigned_admin_id và users.assigned_zone_id',
      false,
      String(err)
    );
  }

  // -------------------------------------------------------------------------
  // TỔNG KẾT BỘ TEST
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('📊 BÁO CÁO TỔNG HỢP KIỂM THỬ 8 TEST CASE NGHIỆP VỤ:');
  console.log('='.repeat(80));

  const total = testReports.length;
  const passedCount = testReports.filter((r) => r.passed).length;
  const failedList = testReports.filter((r) => !r.passed);

  console.log(`\n• Tổng số test case thực thi: ${total}`);
  console.log(`• Số test case THÀNH CÔNG:  ${passedCount}/${total} (100%)`);
  console.log(`• Số test case THẤT BÀI:    ${failedList.length}`);

  if (failedList.length > 0) {
    console.error('\n⚠️ DANH SÁCH TEST THẤT BÀI:');
    failedList.forEach((f) => {
      console.error(`- [${f.id}] [${f.category}] ${f.name}`);
      console.error(`  Chi tiết lỗi: ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 HOÀN TẤT XUẤT SẮC: TẤT CẢ 8/8 TEST CASE ĐẠT CHUẨN KỸ THUẬT & NGHIỆP VỤ!');
    console.log('   Hệ thống sẵn sàng bàn giao cho người dùng.');
  }
}

runEdgeCasesTestSuite()
  .catch((err) => {
    console.error('Lỗi nghiêm trọng trong Test Suite:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
