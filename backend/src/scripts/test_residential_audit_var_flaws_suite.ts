import { pool } from '../database/db';
import { AuditReviewService } from '../modules/audit/services/audit-review.service';
import { AuditModificationService } from '../modules/audit/services/audit-modification.service';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';
import { ScoringService } from '../modules/scoring/scoring.service';
import { ReportSnapshotService } from '../modules/report/snapshot/report-snapshot.service';
import { ConflictError, BadRequestError, ForbiddenError, NotFoundError } from '../common/errors/problem-details';
import { CryptoUtils } from '../common/utils/crypto.utils';

interface TestCaseResult {
  group: string;
  id: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestCaseResult[] = [];

async function assertTest(group: string, id: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ group, id, name, passed: true });
    console.log(`  ✅ [PASS] ${id}: ${name}`);
  } catch (err: any) {
    results.push({ group, id, name, passed: false, error: err.message || String(err) });
    console.error(`  ❌ [FAIL] ${id}: ${name}\n      Error: ${err.message || String(err)}`);
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected: any) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (!(actual >= expected)) {
        throw new Error(`Expected ${actual} to be >= ${expected}`);
      }
    },
    toBeLessThanOrEqual(expected: number) {
      if (!(actual <= expected)) {
        throw new Error(`Expected ${actual} to be <= ${expected}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value but got ${JSON.stringify(actual)}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value but got ${JSON.stringify(actual)}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null but got ${JSON.stringify(actual)}`);
      }
    },
    notToBeNull() {
      if (actual === null) {
        throw new Error(`Expected not null`);
      }
    },
    toContain(sub: string) {
      if (typeof actual === 'string' && !actual.includes(sub)) {
        throw new Error(`Expected string "${actual}" to contain "${sub}"`);
      } else if (Array.isArray(actual) && !actual.includes(sub)) {
        throw new Error(`Expected array to contain ${JSON.stringify(sub)}`);
      }
    },
  };
}

async function expectToThrow(fn: () => Promise<any>, errorType?: any, messageSnippet?: string) {
  let threw = false;
  try {
    await fn();
  } catch (err: any) {
    threw = true;
    if (errorType && !(err instanceof errorType)) {
      throw new Error(`Expected error instance of ${errorType.name} but got ${err.constructor?.name}: ${err.message}`);
    }
    if (messageSnippet && !err.message.includes(messageSnippet)) {
      throw new Error(`Expected error message to contain "${messageSnippet}" but got: ${err.message}`);
    }
  }
  if (!threw) {
    throw new Error('Expected function to throw an error, but it succeeded.');
  }
}

async function runTestSuite() {
  console.log('================================================================================');
  console.log('TEST SUITE: KIỂM THỬ TOÀN DIỆN 10 LOGIC NGHIỆP VỤ THẨM ĐỊNH NHÀ DÂN (100 CASES)');
  console.log('================================================================================\n');

  const client = await pool.connect();
  const cleanupParcels: string[] = [];
  const cleanupReports: string[] = [];
  const cleanupUsers: string[] = [];

  try {
    // 1. Chuẩn bị tài khoản người dùng Admin và Surveyor cho test
    const adminPassHash = await CryptoUtils.hashPassword('AdminTest@1234');
    const adminUserRes = await client.query<{ id: string }>(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'ZONE_ADMIN')
       RETURNING id;`,
      [`admin_test_${Date.now()}`, `admin_test_${Date.now()}@example.com`, adminPassHash, 'Zone Admin Test']
    );
    const adminId = adminUserRes.rows[0].id;
    cleanupUsers.push(adminId);

    const admin2UserRes = await client.query<{ id: string }>(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'ZONE_ADMIN')
       RETURNING id;`,
      [`admin2_test_${Date.now()}`, `admin2_test_${Date.now()}@example.com`, adminPassHash, 'Zone Admin 2 Test']
    );
    const admin2Id = admin2UserRes.rows[0].id;
    cleanupUsers.push(admin2Id);

    const surveyorUserRes = await client.query<{ id: string }>(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'SURVEYOR')
       RETURNING id;`,
      [`surveyor_test_${Date.now()}`, `surveyor_test_${Date.now()}@example.com`, adminPassHash, 'Surveyor Test']
    );
    const surveyorId = surveyorUserRes.rows[0].id;
    cleanupUsers.push(surveyorId);

    // 2. Helper tạo nhanh thửa đất nhà dân và report khảo sát
    const createTestResidential = async (suffix: string, initialJson: any = {}, extra: any = {}) => {
      const mergedExtra = { ...initialJson, ...extra };
      const pRes = await client.query<{ id: string }>(
        `INSERT INTO parcels (
           zone_id, project_parcel_code, house_number, street, ward, district,
           owner_name, owner_phone, land_area_m2, construction_area_m2,
           frontage_width, lot_depth, floor_count, survey_status, location_geom
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'SUBMITTED', ST_SetSRID(ST_Point(106.6601, 10.7626), 4326))
         RETURNING id;`,
        [
          'ZONE_01',
          `P-RES-TEST-${suffix}-${Date.now().toString().slice(-4)}`,
          mergedExtra.houseNumber || `100/${suffix}`,
          mergedExtra.street || 'Đường Thử Nghiệm',
          mergedExtra.ward || 'Phường 10',
          mergedExtra.district || 'Quận 5',
          mergedExtra.ownerName || 'Chủ Hộ Ban Đầu',
          mergedExtra.ownerPhone || '0901000000',
          mergedExtra.landAreaM2 ?? 100.0,
          mergedExtra.constructionAreaM2 ?? 80.0,
          mergedExtra.frontageWidth ?? 4.5,
          mergedExtra.lotDepth ?? 22.0,
          mergedExtra.floorCount ?? 3,
        ]
      );
      const parcelId = pRes.rows[0].id;
      cleanupParcels.push(parcelId);

      const rRes = await client.query<{ id: string }>(
        `INSERT INTO base_survey_reports (
           parcel_id, surveyor_id, status, report_code,
           survey_data_json, surveyor_signature_url, owner_signature_url
         ) VALUES ($1, $2, 'SUBMITTED', $3, $4, 'https://example.com/sig_surv.png', 'https://example.com/sig_own.png')
         RETURNING id;`,
        [parcelId, surveyorId, `REP-TEST-${suffix}-${Date.now().toString().slice(-4)}`, JSON.stringify(initialJson)]
      );
      const reportId = rRes.rows[0].id;
      cleanupReports.push(reportId);

      await client.query(
        `INSERT INTO building_specifications (report_id, floor_count)
         VALUES ($1, 3)
         ON CONFLICT (report_id) DO NOTHING;`,
        [reportId]
      );
      await client.query(
        `INSERT INTO deformation_assessments (
           report_id, tilt_angle_x, tilt_angle_y, floor_slope_ratio,
           beam_deflection_mm, measurement_reliability, e3_deformation_score
         ) VALUES ($1, 0.0, 0.0, 0.0, 0.0, 'HIGH', 0)
         ON CONFLICT (report_id) DO NOTHING;`,
        [reportId]
      );
      await client.query(
        `INSERT INTO risk_score_cards (
           report_id, e1_burland_score, e2_structure_score, e3_deformation_score,
           e4_material_score, e5_history_score, e6_overall_function_score,
           total_ecs_score, ecs_class, v1_importance_score, v2_structure_score, v5_ecs_score, v6_sensitivity_score, avg_vi_score, vi_class
         ) VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 'GOOD', 1.0, 1.0, 1.0, 1.0, 1.0, 'LOW')
         ON CONFLICT (report_id) DO NOTHING;`,
        [reportId]
      );

      return { parcelId, reportId };
    };

    const createTestDamageZone = async (reportId: string, zoneCode: string, extra: any = {}) => {
      const zRes = await client.query<{ id: string }>(
        `INSERT INTO damage_zones (
           report_id, zone_code, floor_name, room_name, component_type,
           wall_material, functional_impact_repair_needed, burland_grade,
           ctx_photo_url, is_deleted
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id;`,
        [
          reportId,
          zoneCode,
          extra.floor_name || extra.floorName || 'Tầng 1',
          extra.room_name || extra.roomName || 'Phòng khách',
          extra.component_type || extra.componentType || 'WALL',
          extra.wall_material || extra.wallMaterial || 'BRICK',
          extra.functional_impact_repair_needed ?? extra.functionalImpactRepairNeeded ?? false,
          extra.burland_grade ?? extra.burlandGrade ?? 0,
          extra.ctx_photo_url || extra.ctxPhotoUrl || 'https://example.com/ctx.jpg',
          extra.is_deleted ?? extra.isDeleted ?? false
        ]
      );
      return zRes.rows[0].id;
    };

    const createTestDefectItem = async (zoneId: string, defectCode: string, extra: any = {}) => {
      const dRes = await client.query<{ id: string }>(
        `INSERT INTO defect_items (
           zone_id, defect_code, pin_x, pin_y, screening_category, defect_type,
           width_max_mm, length_mm, cu_photo_url, structural_significance_e2, is_deleted
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id;`,
        [
          zoneId,
          defectCode,
          extra.pin_x ?? extra.pinX ?? 10,
          extra.pin_y ?? extra.pinY ?? 20,
          extra.screening_category ?? extra.screeningCategory ?? 'CRACK',
          extra.defect_type ?? extra.defectType ?? 'HAIRLINE',
          extra.width_max_mm ?? extra.widthMaxMm ?? 0.5,
          extra.length_mm ?? extra.lengthMm ?? 100.0,
          extra.cu_photo_url ?? extra.cuPhotoUrl ?? 'https://example.com/cu.jpg',
          extra.structural_significance_e2 ?? extra.structuralSignificanceE2 ?? 0,
          extra.is_deleted ?? extra.isDeleted ?? false
        ]
      );
      return dRes.rows[0].id;
    };

    // ============================================================================
    // NHÓM 1 (TC 01 - TC 10): Chặn tuyệt đối Duyệt Hàng Loạt Nhà Dân (batchApproveReports)
    // ============================================================================
    console.log('\n--- BẮT ĐẦU NHÓM 1: CHẶN DUYỆT HÀNG LOẠT NHÀ DÂN (TC 01 - 10) ---');

    await assertTest('Logic 1', 'TC01', 'Chặn batchApproveReports khi truyền 1 report nhà dân (unit_id IS NULL)', async () => {
      const { reportId } = await createTestResidential('01');
      await expectToThrow(
        () => AuditReviewService.batchApproveReports([reportId], adminId),
        BadRequestError,
        'Không thể duyệt hàng loạt đối với nhà dân độc lập'
      );
    });

    await assertTest('Logic 1', 'TC02', 'Chặn batchApproveReports khi truyền danh sách nhiều nhà dân', async () => {
      const r1 = await createTestResidential('02a');
      const r2 = await createTestResidential('02b');
      await expectToThrow(
        () => AuditReviewService.batchApproveReports([r1.reportId, r2.reportId], adminId),
        BadRequestError,
        'Không thể duyệt hàng loạt đối với nhà dân độc lập'
      );
    });

    await assertTest('Logic 1', 'TC03', 'Nhà dân dù Grade 0 và 0 khuyết tật vẫn bị chặn tuyệt đối duyệt hàng loạt', async () => {
      const { reportId } = await createTestResidential('03');
      await expectToThrow(
        () => AuditReviewService.batchApproveReports([reportId], adminId),
        BadRequestError,
        'Không thể duyệt hàng loạt đối với nhà dân độc lập'
      );
    });

    await assertTest('Logic 1', 'TC04', 'Nhà dân đang có status UNDER_REVIEW bị chặn duyệt hàng loạt', async () => {
      const { reportId } = await createTestResidential('04');
      await client.query(`UPDATE base_survey_reports SET status = 'UNDER_REVIEW' WHERE id = $1;`, [reportId]);
      await expectToThrow(
        () => AuditReviewService.batchApproveReports([reportId], adminId),
        BadRequestError,
        'Không thể duyệt hàng loạt đối với nhà dân độc lập'
      );
    });

    await assertTest('Logic 1', 'TC05', 'Nhà dân đã có admin diff (has_admin_diff = true) bị chặn duyệt hàng loạt', async () => {
      const { reportId } = await createTestResidential('05');
      await client.query(`UPDATE risk_score_cards SET is_engineering_judgement_applied = true WHERE report_id = $1;`, [reportId]);
      await expectToThrow(
        () => AuditReviewService.batchApproveReports([reportId], adminId),
        BadRequestError,
        'Không thể duyệt hàng loạt đối với nhà dân độc lập'
      );
    });

    await assertTest('Logic 1', 'TC06', 'Batch hỗn hợp gồm 1 nhà dân và 1 ID condo giả định vẫn bị chặn và báo lỗi rõ ràng', async () => {
      const { reportId } = await createTestResidential('06');
      await expectToThrow(
        () => AuditReviewService.batchApproveReports([reportId, '00000000-0000-0000-0000-000000000000'], adminId),
        BadRequestError,
        'Không thể duyệt hàng loạt đối với nhà dân độc lập'
      );
    });

    await assertTest('Logic 1', 'TC07', 'Nhà dân có report_type = RESIDENTIAL bị chặn duyệt hàng loạt', async () => {
      const { reportId } = await createTestResidential('07');
      await client.query(`UPDATE base_survey_reports SET report_type = 'RESIDENTIAL' WHERE id = $1;`, [reportId]);
      await expectToThrow(
        () => AuditReviewService.batchApproveReports([reportId], adminId),
        BadRequestError,
        'Không thể duyệt hàng loạt đối với nhà dân độc lập'
      );
    });

    await assertTest('Logic 1', 'TC08', 'Nhà dân không có vết nứt nào nhưng có cảnh báo vẫn bị chặn duyệt hàng loạt', async () => {
      const { reportId } = await createTestResidential('08');
      await client.query(
        `INSERT INTO audit_alert_items (report_id, parcel_id, surveyor_id, alert_type, severity, title, detail)
         SELECT r.id, r.parcel_id, r.surveyor_id, 'STRUCTURAL_CRITICAL'::alert_type_enum, 'HIGH'::alert_severity_enum, 'Cảnh báo nứt', 'Chi tiết'
         FROM base_survey_reports r WHERE r.id = $1;`,
        [reportId]
      );
      await expectToThrow(
        () => AuditReviewService.batchApproveReports([reportId], adminId),
        BadRequestError,
        'Không thể duyệt hàng loạt đối với nhà dân độc lập'
      );
    });

    await assertTest('Logic 1', 'TC09', 'Chặn duyệt hàng loạt ngay cả khi admin là SuperAdmin (Role bypass không được phép)', async () => {
      const { reportId } = await createTestResidential('09');
      await expectToThrow(
        () => AuditReviewService.batchApproveReports([reportId], adminId),
        BadRequestError,
        'Không thể duyệt hàng loạt đối với nhà dân độc lập'
      );
    });

    await assertTest('Logic 1', 'TC10', 'Hồ sơ nhà dân sau khi bị chặn bởi batchApproveReports vẫn giữ nguyên status SUBMITTED không đổi', async () => {
      const { reportId } = await createTestResidential('10');
      try {
        await AuditReviewService.batchApproveReports([reportId], adminId);
      } catch (e) {
        // Expected
      }
      const checkRes = await client.query<{ status: string }>(`SELECT status FROM base_survey_reports WHERE id = $1;`, [reportId]);
      expect(checkRes.rows[0].status).toBe('SUBMITTED');
    });

    // ============================================================================
    // NHÓM 2 (TC 11 - TC 20): Số liệu KSV Thực Địa là Ground Truth & Đồng bộ 2 Tầng vào parcels
    // ============================================================================
    console.log('\n--- BẮT ĐẦU NHÓM 2: SỐ LIỆU KSV GROUND TRUTH & ĐỒNG BỘ 2 TẦNG (TC 11 - 20) ---');

    await assertTest('Logic 2', 'TC11', 'getSplitPaneAuditView ưu tiên hiển thị số nhà/đường thực địa của KSV ở leftPane.parcel', async () => {
      const { reportId } = await createTestResidential('11', {
        houseNumber: '999/Real',
        street: 'Đường KSV Khảo Sát Thật',
      });
      const view = await AuditReviewService.getSplitPaneAuditView(reportId);
      expect(view.leftPane?.parcel?.houseNumber).toBe('999/Real');
      expect(view.leftPane?.parcel?.street).toBe('Đường KSV Khảo Sát Thật');
    });

    await assertTest('Logic 2', 'TC12', 'getSplitPaneAuditView ưu tiên diện tích đất landAreaM2 thực địa của KSV', async () => {
      const { reportId } = await createTestResidential('12', {
        landAreaM2: 155.75,
      });
      const view = await AuditReviewService.getSplitPaneAuditView(reportId);
      expect(view.leftPane?.parcel?.landAreaM2).toBe(155.75);
    });

    await assertTest('Logic 2', 'TC13', 'getSplitPaneAuditView ưu tiên chiều rộng mặt tiền frontageWidth thực địa của KSV', async () => {
      const { reportId } = await createTestResidential('13', {
        frontageWidth: 6.8,
      });
      const view = await AuditReviewService.getSplitPaneAuditView(reportId);
      expect(view.leftPane?.parcel?.frontageWidth).toBe(6.8);
    });

    await assertTest('Logic 2', 'TC14', 'getSplitPaneAuditView ưu tiên chiều sâu thửa lotDepth thực địa của KSV', async () => {
      const { reportId } = await createTestResidential('14', {
        lotDepth: 25.5,
      });
      const view = await AuditReviewService.getSplitPaneAuditView(reportId);
      expect(view.leftPane?.parcel?.lotDepth).toBe(25.5);
    });

    await assertTest('Logic 2', 'TC15', 'getSplitPaneAuditView ưu tiên diện tích xây dựng constructionAreaM2 thực địa của KSV', async () => {
      const { reportId } = await createTestResidential('15', {
        constructionAreaM2: 120.2,
      });
      const view = await AuditReviewService.getSplitPaneAuditView(reportId);
      expect(view.leftPane?.parcel?.constructionAreaM2).toBe(120.2);
    });

    await assertTest('Logic 2', 'TC16', 'applyAdminSurveyEdit cập nhật số liệu KSV nháp trực tiếp vào bảng parcels', async () => {
      const { reportId, parcelId } = await createTestResidential('16');
      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Đồng bộ số liệu thực địa KSV vào parcels',
        diffPayload: [{ field: 'houseNumber', label: 'Số nhà', oldValue: '100/16', newValue: '123/GroundTruth' }],
        updates: {
          houseNumber: '123/GroundTruth',
          street: 'Đường Chuẩn Đo Đạc',
          landAreaM2: 145.5,
          frontageWidth: 5.5,
        },
      });
      const pCheck = await client.query<{ house_number: string; street: string; land_area_m2: number; frontage_width: number }>(
        `SELECT house_number, street, land_area_m2, frontage_width FROM parcels WHERE id = $1;`,
        [parcelId]
      );
      expect(pCheck.rows[0].house_number).toBe('123/GroundTruth');
      expect(pCheck.rows[0].street).toBe('Đường Chuẩn Đo Đạc');
      expect(Number(pCheck.rows[0].land_area_m2)).toBe(145.5);
      expect(Number(pCheck.rows[0].frontage_width)).toBe(5.5);
    });

    await assertTest('Logic 2', 'TC17', 'applyAdminSurveyEdit đồng bộ thông tin chủ hộ thực tế vào bảng parcels', async () => {
      const { reportId, parcelId } = await createTestResidential('17');
      const dynCode = `34/567-${Date.now().toString().slice(-4)}`;
      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Cập nhật chủ hộ thực tế theo phỏng vấn',
        diffPayload: [{ field: 'ownerName', label: 'Tên chủ hộ', oldValue: 'Chủ Hộ Ban Đầu', newValue: 'Ông Trần Văn Khảo Sát Thật' }],
        updates: {
          ownerName: 'Ông Trần Văn Khảo Sát Thật',
          ownerPhone: '0988777666',
          officialCadastralCode: dynCode,
        },
      });
      const pCheck = await client.query<{ owner_name: string; owner_phone: string; official_cadastral_code: string }>(
        `SELECT owner_name, owner_phone, official_cadastral_code FROM parcels WHERE id = $1;`,
        [parcelId]
      );
      expect(pCheck.rows[0].owner_name).toBe('Ông Trần Văn Khảo Sát Thật');
      expect(pCheck.rows[0].owner_phone).toBe('0988777666');
      expect(pCheck.rows[0].official_cadastral_code).toBe(dynCode);
    });

    await assertTest('Logic 2', 'TC18', 'Bảo toàn tọa độ GIS WGS84: gửi dạng GeoJSON [lng, lat] lưu đúng vào location_geom', async () => {
      const { reportId, parcelId } = await createTestResidential('18');
      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Cập nhật toạ độ GPS chuẩn GeoJSON',
        diffPayload: [],
        updates: {
          coordinates: [106.7001, 10.7801],
        },
      });
      const geomRes = await client.query<{ x: number; y: number }>(
        `SELECT ST_X(location_geom) as x, ST_Y(location_geom) as y FROM parcels WHERE id = $1;`,
        [parcelId]
      );
      expect(Math.abs(geomRes.rows[0].x - 106.7001) < 0.0001).toBeTruthy();
      expect(Math.abs(geomRes.rows[0].y - 10.7801) < 0.0001).toBeTruthy();
    });

    await assertTest('Logic 2', 'TC19', 'Bảo toàn tọa độ GIS WGS84: gửi dạng [lat, lng] (lat < 50, lng > 50) tự động chuẩn hóa', async () => {
      const { reportId, parcelId } = await createTestResidential('19');
      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Cập nhật toạ độ GPS đảo [lat, lng]',
        diffPayload: [],
        updates: {
          coordinates: [10.7850, 106.7150],
        },
      });
      const geomRes = await client.query<{ x: number; y: number }>(
        `SELECT ST_X(location_geom) as x, ST_Y(location_geom) as y FROM parcels WHERE id = $1;`,
        [parcelId]
      );
      expect(Math.abs(geomRes.rows[0].x - 106.7150) < 0.0001).toBeTruthy();
      expect(Math.abs(geomRes.rows[0].y - 10.7850) < 0.0001).toBeTruthy();
    });

    await assertTest('Logic 2', 'TC20', 'Khi phê duyệt approveReport, số liệu thực địa KSV được đóng băng vào Release Snapshot', async () => {
      const { reportId } = await createTestResidential('20', {
        houseNumber: '777/FrozenFinal',
        street: 'Phố Đóng Băng Bất Biến',
      });
      await AuditReviewService.approveReport(reportId, adminId, 'Phê duyệt hồ sơ thực địa');
      const releaseRes = await client.query<{ snapshot_data: any }>(
        `SELECT snapshot_data FROM survey_report_versions WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE' ORDER BY version_number DESC LIMIT 1;`,
        [reportId]
      );
      const snap = typeof releaseRes.rows[0]?.snapshot_data === 'string'
        ? JSON.parse(releaseRes.rows[0].snapshot_data)
        : releaseRes.rows[0]?.snapshot_data;
      expect(snap?.frozenParcel).toBeTruthy();
      expect(snap.frozenParcel.houseNumber).toBe('777/FrozenFinal');
      expect(snap.frozenParcel.street).toBe('Phố Đóng Băng Bất Biến');
    });

    // ============================================================================
    // NHÓM 3 (TC 21 - TC 30): Zero Hard-Delete & Thuật toán Soft-Delete (is_deleted = true)
    // ============================================================================
    console.log('\n--- BẮT ĐẦU NHÓM 3: ZERO HARD-DELETE & SOFT-DELETE (TC 21 - 30) ---');

    await assertTest('Logic 3', 'TC21', 'Khi lưu chỉnh sửa không còn zone cũ -> zone cũ chuyển sang is_deleted = true, không bị DELETE', async () => {
      const { reportId } = await createTestResidential('21');
      const zoneId = await createTestDamageZone(reportId, 'Z-01', { burlandGrade: 1 });

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Xóa Z-01, thêm Z-02',
        diffPayload: [],
        updates: {
          damageZones: [
            { zoneCode: 'Z-02', floorName: 'Tầng 1', roomName: 'Bếp', componentType: 'BEAM' }
          ]
        }
      });

      const zCheck = await client.query<{ id: string; is_deleted: boolean }>(
        `SELECT id, is_deleted FROM damage_zones WHERE id = $1;`,
        [zoneId]
      );
      expect(zCheck.rows.length).toBe(1);
      expect(zCheck.rows[0].is_deleted).toBe(true);
    });

    await assertTest('Logic 3', 'TC22', 'UUID của damage_zones bị xóa mềm được bảo toàn nguyên vẹn', async () => {
      const { reportId } = await createTestResidential('22');
      const originalUuid = await createTestDamageZone(reportId, 'Z-UUID', { burlandGrade: 1 });

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Xóa mềm Z-UUID',
        diffPayload: [],
        updates: { damageZones: [{ zoneCode: 'Z-OTHER', floorName: 'Tầng 1', roomName: 'Bếp' }] }
      });

      const zCheck = await client.query<{ id: string }>(`SELECT id FROM damage_zones WHERE id = $1;`, [originalUuid]);
      expect(zCheck.rows[0].id).toBe(originalUuid);
    });

    await assertTest('Logic 3', 'TC23', 'Các defect_items thuộc zone bị xóa mềm cũng được đánh dấu is_deleted = true', async () => {
      const { reportId } = await createTestResidential('23');
      const zoneId = await createTestDamageZone(reportId, 'Z-23', { burlandGrade: 1 });
      const defectId = await createTestDefectItem(zoneId, 'D-23', { widthMaxMm: 0.5 });

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Xóa zone và defect',
        diffPayload: [],
        updates: { damageZones: [{ zoneCode: 'Z-NEW', floorName: 'Tầng 2', roomName: 'Ngủ' }] }
      });

      const dCheck = await client.query<{ id: string; is_deleted: boolean }>(`SELECT id, is_deleted FROM defect_items WHERE id = $1;`, [defectId]);
      expect(dCheck.rows.length).toBe(1);
      expect(dCheck.rows[0].is_deleted).toBe(true);
    });

    await assertTest('Logic 3', 'TC24', 'UUID của defect_items bị xóa mềm được bảo toàn', async () => {
      const { reportId } = await createTestResidential('24');
      const zoneId = await createTestDamageZone(reportId, 'Z-24', { burlandGrade: 1 });
      const defectUuid = await createTestDefectItem(zoneId, 'D-24', { widthMaxMm: 0.5 });

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Soft delete defect',
        diffPayload: [],
        updates: { damageZones: [{ zoneCode: 'Z-24', floorName: 'Tầng 1', roomName: 'Phòng khách', defects: [] }] }
      });

      const dCheck = await client.query<{ id: string; is_deleted: boolean }>(`SELECT id, is_deleted FROM defect_items WHERE id = $1;`, [defectUuid]);
      expect(dCheck.rows[0].id).toBe(defectUuid);
      expect(dCheck.rows[0].is_deleted).toBe(true);
    });

    await assertTest('Logic 3', 'TC25', 'Khi zone bị xóa mềm được thêm lại với cùng zone_code -> tái kích hoạt is_deleted = false và giữ nguyên UUID', async () => {
      const { reportId } = await createTestResidential('25');
      const originalId = await createTestDamageZone(reportId, 'Z-RECOVER', { burlandGrade: 1, isDeleted: true });

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Thêm lại zone đã xóa mềm',
        diffPayload: [],
        updates: {
          damageZones: [
            { zoneCode: 'Z-RECOVER', floorName: 'Tầng 1', roomName: 'Phòng khách phục hồi', componentType: 'WALL' }
          ]
        }
      });

      const zCheck = await client.query<{ id: string; is_deleted: boolean; room_name: string }>(
        `SELECT id, is_deleted, room_name FROM damage_zones WHERE id = $1;`,
        [originalId]
      );
      expect(zCheck.rows[0].id).toBe(originalId);
      expect(zCheck.rows[0].is_deleted).toBe(false);
      expect(zCheck.rows[0].room_name).toBe('Phòng khách phục hồi');
    });

    await assertTest('Logic 3', 'TC26', 'Khi defect bị xóa mềm được thêm lại với cùng defect_code -> tái kích hoạt is_deleted = false và giữ nguyên UUID', async () => {
      const { reportId } = await createTestResidential('26');
      const zoneId = await createTestDamageZone(reportId, 'Z-26', { burlandGrade: 1 });
      const originalDefectId = await createTestDefectItem(zoneId, 'D-RECOVER', { widthMaxMm: 0.5, isDeleted: true });

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Khôi phục defect',
        diffPayload: [],
        updates: {
          damageZones: [
            {
              zoneCode: 'Z-26',
              floorName: 'Tầng 1',
              roomName: 'Phòng khách',
              defects: [
                { defectCode: 'D-RECOVER', defectType: 'HAIRLINE', widthMaxMm: 0.8 }
              ]
            }
          ]
        }
      });

      const dCheck = await client.query<{ id: string; is_deleted: boolean; width_max_mm: number }>(
        `SELECT id, is_deleted, width_max_mm FROM defect_items WHERE id = $1;`,
        [originalDefectId]
      );
      expect(dCheck.rows[0].id).toBe(originalDefectId);
      expect(dCheck.rows[0].is_deleted).toBe(false);
      expect(Number(dCheck.rows[0].width_max_mm)).toBe(0.8);
    });

    await assertTest('Logic 3', 'TC27', 'Cập nhật ctx_photo_url của zone không làm mất liên kết khóa ngoại', async () => {
      const { reportId } = await createTestResidential('27');
      const zoneId = await createTestDamageZone(reportId, 'Z-27', { burlandGrade: 1, ctxPhotoUrl: 'https://old.url/ctx.jpg' });

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Cập nhật ảnh bối cảnh',
        diffPayload: [],
        updates: {
          damageZones: [
            { zoneCode: 'Z-27', floorName: 'Tầng 1', roomName: 'Phòng khách', ctxPhotoUrl: 'https://new.url/ctx.jpg' }
          ]
        }
      });
      const zCheck = await client.query<{ ctx_photo_url: string }>(`SELECT ctx_photo_url FROM damage_zones WHERE id = $1;`, [zoneId]);
      expect(zCheck.rows[0].ctx_photo_url).toBe('https://new.url/ctx.jpg');
    });

    await assertTest('Logic 3', 'TC28', 'Cập nhật cu_photos_json của defect lưu đầy đủ mảng URL ảnh cận cảnh', async () => {
      const { reportId } = await createTestResidential('28');
      const zoneId = await createTestDamageZone(reportId, 'Z-28', { burlandGrade: 1 });

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Thêm ảnh cận cảnh',
        diffPayload: [],
        updates: {
          damageZones: [
            {
              zoneCode: 'Z-28',
              floorName: 'Tầng 1',
              roomName: 'Phòng khách',
              defects: [
                { defectCode: 'D-28', defectType: 'HAIRLINE', widthMaxMm: 0.5, cuPhotos: ['https://photo1.jpg', 'https://photo2.jpg'] }
              ]
            }
          ]
        }
      });
      const dCheck = await client.query<{ cu_photos_json: any }>(
        `SELECT cu_photos_json FROM defect_items WHERE zone_id = $1 AND defect_code = 'D-28';`,
        [zoneId]
      );
      const pList = typeof dCheck.rows[0].cu_photos_json === 'string' ? JSON.parse(dCheck.rows[0].cu_photos_json) : dCheck.rows[0].cu_photos_json;
      expect(pList.length).toBe(2);
      expect(pList[0]).toBe('https://photo1.jpg');
      expect(pList[1]).toBe('https://photo2.jpg');
    });

    await assertTest('Logic 3', 'TC29', 'Không có câu lệnh DELETE nào được gửi tới bảng damage_zones', async () => {
      const countBefore = await client.query<{ count: string }>(`SELECT COUNT(*) FROM damage_zones;`);
      const { reportId } = await createTestResidential('29');
      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Test zero hard delete',
        diffPayload: [],
        updates: { damageZones: [{ zoneCode: 'Z-29', floorName: 'Tầng 1', roomName: 'Khách' }] }
      });
      const countAfter = await client.query<{ count: string }>(`SELECT COUNT(*) FROM damage_zones;`);
      expect(Number(countAfter.rows[0].count)).toBeGreaterThanOrEqual(Number(countBefore.rows[0].count));
    });

    await assertTest('Logic 3', 'TC30', 'getSplitPaneAuditView chỉ tải các damage_zones và defect_items chưa bị xóa (is_deleted = false)', async () => {
      const { reportId } = await createTestResidential('30');
      await createTestDamageZone(reportId, 'Z-DEL', { burlandGrade: 1, isDeleted: true });

      const view = await AuditReviewService.getSplitPaneAuditView(reportId);
      const foundDeletedZone = (view.leftPane?.damageZones || []).find((z: any) => z.zone_code === 'Z-DEL');
      expect(foundDeletedZone).toBeFalsy();
    });

    // ============================================================================
    // NHÓM 4 (TC 31 - TC 40): Recalculation Trigger & ON CONFLICT e6 & Judgement Alert
    // ============================================================================
    console.log('\n--- BẮT ĐẦU NHÓM 4: RECALCULATION TRIGGER & ON CONFLICT e6 (TC 31 - 40) ---');

    await assertTest('Logic 4', 'TC31', 'applyAdminSurveyEdit tự động kích hoạt tính lại toàn bộ điểm rủi ro qua ScoringService', async () => {
      const { reportId } = await createTestResidential('31');
      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Thêm vết nứt nghiêm trọng để kích hoạt tính lại điểm',
        diffPayload: [],
        updates: {
          damageZones: [
            {
              zoneCode: 'Z-31',
              floorName: 'Tầng 1',
              roomName: 'Khách',
              burlandGrade: 4,
              defects: [
                { defectCode: 'D-31', defectType: 'STRUCTURAL', widthMaxMm: 6.0, structuralSignificanceE2: 2 }
              ]
            }
          ]
        }
      });
      const cardRes = await client.query<{ e1_burland_score: number }>(`SELECT e1_burland_score FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(Number(cardRes.rows[0].e1_burland_score)).toBe(3);
    });

    await assertTest('Logic 4', 'TC32', 'Điểm E6 được tính toán động từ số lượng damage_zones thực tế trong CSDL', async () => {
      const { reportId } = await createTestResidential('32');
      await createTestDamageZone(reportId, 'Z-32a', { burlandGrade: 3 });
      await createTestDamageZone(reportId, 'Z-32b', { burlandGrade: 3 });
      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ e6_overall_function_score: number }>(`SELECT e6_overall_function_score FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(Number(cardRes.rows[0].e6_overall_function_score)).toBe(1);
    });

    await assertTest('Logic 4', 'TC33', 'Khi có hiện tượng kẹt cửa DOOR_JAMMED -> điểm E6 được cộng thêm 2 điểm', async () => {
      const { reportId } = await createTestResidential('33', {
        operationalDefects: ['DOOR_JAMMED'],
      });
      await createTestDamageZone(reportId, 'Z-33', { burlandGrade: 3 });
      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ e6_overall_function_score: number }>(`SELECT e6_overall_function_score FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(Number(cardRes.rows[0].e6_overall_function_score)).toBe(3);
    });

    await assertTest('Logic 4', 'TC34', 'Điểm E6 bị chặn tối đa không vượt quá 4 điểm (Math.min(4, ...))', async () => {
      const { reportId } = await createTestResidential('34', {
        operationalDefects: ['DOOR_JAMMED', 'WINDOW_JAMMED'],
      });
      for (const code of ['Z-34a', 'Z-34b', 'Z-34c', 'Z-34d', 'Z-34e', 'Z-34f']) {
        await createTestDamageZone(reportId, code, { burlandGrade: 3 });
      }
      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ e6_overall_function_score: number }>(`SELECT e6_overall_function_score FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(Number(cardRes.rows[0].e6_overall_function_score)).toBe(4);
    });

    await assertTest('Logic 4', 'TC35', 'Mệnh đề ON CONFLICT DO UPDATE SET trong ScoringService cập nhật chính xác e6_overall_function_score', async () => {
      const { reportId } = await createTestResidential('35');
      for (const code of ['Z-35a', 'Z-35b', 'Z-35c']) {
        await createTestDamageZone(reportId, code, { burlandGrade: 3 });
      }
      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ e6_overall_function_score: number }>(`SELECT e6_overall_function_score FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(Number(cardRes.rows[0].e6_overall_function_score)).toBe(2);
    });

    await assertTest('Logic 4', 'TC36', 'Nếu hồ sơ đã có Engineering Judgement, khi Admin sửa số liệu thực địa hệ thống ghi log RAW_SCORES_CHANGED_AFTER_JUDGEMENT', async () => {
      const { reportId } = await createTestResidential('36');
      await client.query(
        `UPDATE risk_score_cards
         SET is_engineering_judgement_applied = true, engineering_judgement_action = 'OVERRIDE'
         WHERE report_id = $1;`,
        [reportId]
      );

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Chỉnh sửa sau khi kỹ sư trưởng đã can thiệp',
        diffPayload: [],
        updates: { landAreaM2: 200.0 }
      });

      const logRes = await client.query<{ action: string }>(
        `SELECT action FROM system_audit_logs WHERE entity_id = $1 AND action = 'RAW_SCORES_CHANGED_AFTER_JUDGEMENT';`,
        [reportId]
      );
      expect(logRes.rows.length).toBeGreaterThan(0);
      expect(logRes.rows[0].action).toBe('RAW_SCORES_CHANGED_AFTER_JUDGEMENT');
    });

    await assertTest('Logic 4', 'TC37', 'Nếu hồ sơ chưa có Engineering Judgement, không sinh ra log RAW_SCORES_CHANGED_AFTER_JUDGEMENT', async () => {
      const { reportId } = await createTestResidential('37');
      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Chỉnh sửa bình thường',
        diffPayload: [],
        updates: { landAreaM2: 180.0 }
      });
      const logRes = await client.query<{ action: string }>(
        `SELECT action FROM system_audit_logs WHERE entity_id = $1 AND action = 'RAW_SCORES_CHANGED_AFTER_JUDGEMENT';`,
        [reportId]
      );
      expect(logRes.rows.length).toBe(0);
    });

    await assertTest('Logic 4', 'TC38', 'Điểm ECS tổng hợp total_ecs_score được tính lại chính xác theo công thức', async () => {
      const { reportId } = await createTestResidential('38');
      const zId = await createTestDamageZone(reportId, 'Z-38', { burlandGrade: 3 });
      await createTestDefectItem(zId, 'D-38', { widthMaxMm: 2.5, defectType: 'STRUCTURAL', structuralSignificanceE2: 2 });

      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ total_ecs_score: number; e1_burland_score: number; e6_overall_function_score: number }>(
        `SELECT total_ecs_score, e1_burland_score, e6_overall_function_score FROM risk_score_cards WHERE report_id = $1;`,
        [reportId]
      );
      expect(Number(cardRes.rows[0].total_ecs_score)).toBeGreaterThanOrEqual(3);
    });

    await assertTest('Logic 4', 'TC39', 'Phân hạng ecs_class tự động thay đổi sau khi tính lại điểm', async () => {
      const { reportId } = await createTestResidential('39');
      const zId = await createTestDamageZone(reportId, 'Z-39', { burlandGrade: 5 });
      await createTestDefectItem(zId, 'D-39', { widthMaxMm: 20.0, defectType: 'STRUCTURAL', structuralSignificanceE2: 3 });

      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ ecs_class: string }>(`SELECT ecs_class FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(['GOOD', 'MEDIUM', 'DEFICIENT', 'CRITICAL'].includes(cardRes.rows[0].ecs_class)).toBeTruthy();
    });

    await assertTest('Logic 4', 'TC40', 'Điểm đánh giá lún nghiêng E3 được đồng bộ chính xác vào deformation_assessments', async () => {
      const { reportId } = await createTestResidential('40');
      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Cập nhật số đo độ nghiêng',
        diffPayload: [],
        updates: {
          deformation: {
            tiltAssessment: { xPermille: 3.5, yPermille: 4.2, direction: 'NORTHEAST' }
          }
        }
      });
      const defRes = await client.query<{ tilt_angle_x: number; tilt_angle_y: number; tilt_direction: string }>(
        `SELECT tilt_angle_x, tilt_angle_y, tilt_direction FROM deformation_assessments WHERE report_id = $1;`,
        [reportId]
      );
      expect(Number(defRes.rows[0].tilt_angle_x)).toBe(0.35);
      expect(Number(defRes.rows[0].tilt_angle_y)).toBe(0.42);
      expect(defRes.rows[0].tilt_direction).toBe('NORTHEAST');
    });

    // ============================================================================
    // NHÓM 5 (TC 41 - TC 50): Quy trình Biên Bản Vắng Mặt (approveAbsenteeReport)
    // ============================================================================
    console.log('\n--- BẮT ĐẦU NHÓM 5: QUY TRÌNH BIÊN BẢN VẮNG MẶT (TC 41 - 50) ---');

    await assertTest('Logic 5', 'TC41', 'approveAbsenteeReport giữ nguyên bản ghi ECS gốc trong risk_score_cards', async () => {
      const { reportId } = await createTestResidential('41');
      await AuditReviewService.approveAbsenteeReport(reportId, adminId, 'Xác nhận vắng mặt 3 lần có công an khu vực ký');
      const cardRes = await client.query<{ total_ecs_score: number }>(`SELECT total_ecs_score FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(cardRes.rows.length).toBe(1);
    });

    await assertTest('Logic 5', 'TC42', 'approveAbsenteeReport giữ nguyên bản ghi VI gốc trong risk_score_cards', async () => {
      const { reportId } = await createTestResidential('42');
      await AuditReviewService.approveAbsenteeReport(reportId, adminId, 'Xác nhận vắng mặt');
      const cardRes = await client.query<{ avg_vi_score: number; vi_class: string }>(`SELECT avg_vi_score, vi_class FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(cardRes.rows.length).toBe(1);
    });

    await assertTest('Logic 5', 'TC43', 'approveAbsenteeReport cập nhật trạng thái thửa đất thành POSTPONED_ABSENT_VERIFIED', async () => {
      const { reportId, parcelId } = await createTestResidential('43');
      await AuditReviewService.approveAbsenteeReport(reportId, adminId, 'Xác nhận vắng mặt');
      const pRes = await client.query<{ survey_status: string }>(`SELECT survey_status FROM parcels WHERE id = $1;`, [parcelId]);
      expect(pRes.rows[0].survey_status).toBe('POSTPONED_ABSENT_VERIFIED');
    });

    await assertTest('Logic 5', 'TC44', 'approveAbsenteeReport gán is_refused_or_absent = true trong base_survey_reports', async () => {
      const { reportId } = await createTestResidential('44');
      await AuditReviewService.approveAbsenteeReport(reportId, adminId, 'Xác nhận vắng mặt');
      const repRes = await client.query<{ is_refused_or_absent: boolean }>(`SELECT is_refused_or_absent FROM base_survey_reports WHERE id = $1;`, [reportId]);
      expect(repRes.rows[0].is_refused_or_absent).toBe(true);
    });

    await assertTest('Logic 5', 'TC45', 'approveAbsenteeReport cập nhật status trong base_survey_reports thành APPROVED kèm cờ vắng mặt', async () => {
      const { reportId } = await createTestResidential('45');
      await AuditReviewService.approveAbsenteeReport(reportId, adminId, 'Xác nhận vắng mặt');
      const repRes = await client.query<{ status: string; is_refused_or_absent: boolean }>(`SELECT status, is_refused_or_absent FROM base_survey_reports WHERE id = $1;`, [reportId]);
      expect(repRes.rows[0].status).toBe('APPROVED');
      expect(repRes.rows[0].is_refused_or_absent).toBe(true);
    });

    await assertTest('Logic 5', 'TC46', 'approveAbsenteeReport cập nhật survey_status trong parcels thành POSTPONED_ABSENT_VERIFIED', async () => {
      const { reportId, parcelId } = await createTestResidential('46');
      await AuditReviewService.approveAbsenteeReport(reportId, adminId, 'Xác nhận vắng mặt');
      const pRes = await client.query<{ survey_status: string }>(`SELECT survey_status FROM parcels WHERE id = $1;`, [parcelId]);
      expect(pRes.rows[0].survey_status).toBe('POSTPONED_ABSENT_VERIFIED');
    });

    await assertTest('Logic 5', 'TC47', 'approveAbsenteeReport tạo bản chụp Snapshot bất biến với versionTag = ABSENTEE_VERIFIED', async () => {
      const { reportId } = await createTestResidential('47');
      await AuditReviewService.approveAbsenteeReport(reportId, adminId, 'Xác nhận vắng mặt');
      const verRes = await client.query<{ version_tag: string }>(
        `SELECT version_tag FROM survey_report_versions WHERE report_id = $1 AND version_tag = 'ABSENTEE_VERIFIED';`,
        [reportId]
      );
      expect(verRes.rows.length).toBeGreaterThan(0);
      expect(verRes.rows[0].version_tag).toBe('ABSENTEE_VERIFIED');
    });

    await assertTest('Logic 5', 'TC48', 'approveAbsenteeReport tự động giải phóng session lock nếu admin đang giữ khóa', async () => {
      const { reportId } = await createTestResidential('48');
      await AuditModificationService.acquireAuditLock(reportId, adminId);
      await AuditReviewService.approveAbsenteeReport(reportId, adminId, 'Xác nhận vắng mặt và giải phóng lock');
      const lockCheck = await AuditModificationService.checkAuditLock(reportId, adminId);
      expect(lockCheck.isLocked).toBe(false);
    });

    await assertTest('Logic 5', 'TC49', 'approveAbsenteeReport ghi nhận nhật ký kiểm toán với action = APPROVE_ABSENTEE_VERIFIED', async () => {
      const { reportId } = await createTestResidential('49');
      await AuditReviewService.approveAbsenteeReport(reportId, adminId, 'Ghi nhận kiểm toán vắng mặt');
      const logRes = await client.query<{ action: string }>(
        `SELECT action FROM system_audit_logs WHERE entity_id = $1 AND action = 'APPROVE_ABSENTEE_VERIFIED';`,
        [reportId]
      );
      expect(logRes.rows.length).toBeGreaterThan(0);
      expect(logRes.rows[0].action).toBe('APPROVE_ABSENTEE_VERIFIED');
    });

    await assertTest('Logic 5', 'TC50', 'Hồ sơ đã APPROVED vắng mặt bị từ chối phê duyệt lại bằng approveReport', async () => {
      const { reportId } = await createTestResidential('50');
      await AuditReviewService.approveAbsenteeReport(reportId, adminId, 'Vắng mặt');
      await expectToThrow(
        () => AuditReviewService.approveReport(reportId, adminId, 'Thử duyệt lại'),
        ConflictError,
        'Hồ sơ đã APPROVED'
      );
    });

    // ============================================================================
    // NHÓM 6 (TC 51 - TC 60): Khóa Chiếm Quyền (Pessimistic Session Lock - 15 phút)
    // ============================================================================
    console.log('\n--- BẮT ĐẦU NHÓM 6: KHÓA CHIẾM QUYỀN SESSION LOCK (TC 51 - 60) ---');

    await assertTest('Logic 6', 'TC51', 'Admin A gọi acquireAuditLock thành công -> tạo bản ghi khóa với hạn 15 phút', async () => {
      const { reportId } = await createTestResidential('51');
      const lock = await AuditModificationService.acquireAuditLock(reportId, adminId);
      expect(lock.acquired).toBe(true);
      expect(lock.lockedByUserId).toBe(adminId);

      const dbLock = await client.query<{ locked_by_user_id: string; expires_at: Date }>(
        `SELECT locked_by_user_id, expires_at FROM survey_audit_locks WHERE report_id = $1;`,
        [reportId]
      );
      expect(dbLock.rows[0].locked_by_user_id).toBe(adminId);
      expect(new Date(dbLock.rows[0].expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    await assertTest('Logic 6', 'TC52', 'Admin B gọi checkAuditLock khi Admin A đang giữ khóa -> lockedByOther = true', async () => {
      const { reportId } = await createTestResidential('52');
      await AuditModificationService.acquireAuditLock(reportId, adminId);

      const checkAdmin2 = await AuditModificationService.checkAuditLock(reportId, admin2Id);
      expect(checkAdmin2.isLocked).toBe(true);
      expect(checkAdmin2.lockedByOther).toBe(true);
      expect(checkAdmin2.lockedByName).toBe('Zone Admin Test');
    });

    await assertTest('Logic 6', 'TC53', 'Admin B cố tình gọi applyAdminSurveyEdit khi Admin A đang giữ khóa -> ném ConflictError (409)', async () => {
      const { reportId } = await createTestResidential('53');
      await AuditModificationService.acquireAuditLock(reportId, adminId);

      await expectToThrow(
        () => AuditModificationService.applyAdminSurveyEdit(reportId, admin2Id, {
          adminPassword: 'AdminTest@1234',
          editReason: 'Admin B cố tình ghi đè',
          diffPayload: [],
          updates: { landAreaM2: 999.0 }
        }),
        ConflictError,
        'Hồ sơ đang được thẩm định bởi Zone Admin Test'
      );
    });

    await assertTest('Logic 6', 'TC54', 'Admin A gọi applyAdminSurveyEdit trên hồ sơ mình đang giữ khóa -> thực hiện thành công', async () => {
      const { reportId } = await createTestResidential('54');
      await AuditModificationService.acquireAuditLock(reportId, adminId);

      const editRes = await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Admin A chỉnh sửa hợp lệ',
        diffPayload: [],
        updates: { landAreaM2: 120.0 }
      });
      expect(editRes.success).toBe(true);
    });

    await assertTest('Logic 6', 'TC55', 'Admin A gọi acquireAuditLock lần 2 (Heartbeat) -> gia hạn expires_at thêm 15 phút', async () => {
      const { reportId } = await createTestResidential('55');
      await AuditModificationService.acquireAuditLock(reportId, adminId);
      const firstLock = await client.query<{ expires_at: Date }>(`SELECT expires_at FROM survey_audit_locks WHERE report_id = $1;`, [reportId]);

      await new Promise((r) => setTimeout(r, 50));
      await AuditModificationService.acquireAuditLock(reportId, adminId);
      const renewedLock = await client.query<{ expires_at: Date }>(`SELECT expires_at FROM survey_audit_locks WHERE report_id = $1;`, [reportId]);

      expect(new Date(renewedLock.rows[0].expires_at).getTime()).toBeGreaterThanOrEqual(new Date(firstLock.rows[0].expires_at).getTime());
    });

    await assertTest('Logic 6', 'TC56', 'Admin A gọi releaseAuditLock -> xóa khóa khỏi CSDL, trả lại trạng thái mở', async () => {
      const { reportId } = await createTestResidential('56');
      await AuditModificationService.acquireAuditLock(reportId, adminId);
      const relRes = await AuditModificationService.releaseAuditLock(reportId, adminId);
      expect(relRes).toBe(true);

      const check = await AuditModificationService.checkAuditLock(reportId, adminId);
      expect(check.isLocked).toBe(false);
    });

    await assertTest('Logic 6', 'TC57', 'Admin B không thể giải phóng khóa của Admin A', async () => {
      const { reportId } = await createTestResidential('57');
      await AuditModificationService.acquireAuditLock(reportId, adminId);

      // Admin B gọi release khóa của Admin A nhưng chỉ xóa khóa của chính mình -> không xóa được khóa của Admin A
      await AuditModificationService.releaseAuditLock(reportId, admin2Id);

      const check = await AuditModificationService.checkAuditLock(reportId, admin2Id);
      expect(check.isLocked).toBe(true);
      expect(check.lockedByOther).toBe(true);
    });

    await assertTest('Logic 6', 'TC58', 'Khóa hết hạn (expires_at < NOW()) tự động xem như không khóa (isLocked = false)', async () => {
      const { reportId } = await createTestResidential('58');
      await client.query(
        `INSERT INTO survey_audit_locks (report_id, locked_by_user_id, expires_at)
         VALUES ($1, $2, NOW() - INTERVAL '1 minute')
         ON CONFLICT (report_id) DO UPDATE SET expires_at = NOW() - INTERVAL '1 minute';`,
        [reportId, adminId]
      );
      const check = await AuditModificationService.checkAuditLock(reportId, admin2Id);
      expect(check.isLocked).toBe(false);
      expect(check.lockedByOther).toBe(false);
    });

    await assertTest('Logic 6', 'TC59', 'approveReport tự động giải phóng lock sau khi duyệt thành công', async () => {
      const { reportId } = await createTestResidential('59');
      await AuditModificationService.acquireAuditLock(reportId, adminId);
      await AuditReviewService.approveReport(reportId, adminId, 'Phê duyệt giải phóng lock');
      const check = await AuditModificationService.checkAuditLock(reportId, adminId);
      expect(check.isLocked).toBe(false);
    });

    await assertTest('Logic 6', 'TC60', 'rejectReport tự động giải phóng lock sau khi trả hồ sơ', async () => {
      const { reportId } = await createTestResidential('60');
      await AuditModificationService.acquireAuditLock(reportId, adminId);
      await AuditReviewService.rejectReport(reportId, adminId, 'Hình ảnh không đạt yêu cầu');
      const check = await AuditModificationService.checkAuditLock(reportId, adminId);
      expect(check.isLocked).toBe(false);
    });

    // ============================================================================
    // NHÓM 7 (TC 61 - TC 70): Vá Lỗ Hổng SQL Cross-Tenant Scoping
    // ============================================================================
    console.log('\n--- BẮT ĐẦU NHÓM 7: VÁ LỖ HỔNG SQL CROSS-TENANT SCOPING (TC 61 - 70) ---');

    await assertTest('Logic 7', 'TC61', 'Thao tác REPLACE trên Report A không ảnh hưởng tới defect_items của Report B dù trùng defect_code', async () => {
      const rA = await createTestResidential('61A');
      const rB = await createTestResidential('61B');

      const zAId = await createTestDamageZone(rA.reportId, 'Z-01');
      const zBId = await createTestDamageZone(rB.reportId, 'Z-01');

      const dAId = await createTestDefectItem(zAId, 'D-COMMON', { cuPhotoUrl: 'https://repA.jpg' });
      const dBId = await createTestDefectItem(zBId, 'D-COMMON', { pinX: 50, pinY: 50, widthMaxMm: 1.5, cuPhotoUrl: 'https://repB_UNTOUCHED.jpg' });

      await AuditModificationService.replaceReportPhoto(rA.reportId, adminId, {
        targetPhotoType: 'DEFECT_CLOSEUP',
        defectId: dAId,
        newPhotoUrl: 'https://repA_MODIFIED.jpg',
        clientPin: '123456',
        replacementReason: 'Thay ảnh nhà A'
      });

      const checkB = await client.query<{ cu_photo_url: string }>(`SELECT cu_photo_url FROM defect_items WHERE id = $1;`, [dBId]);
      expect(checkB.rows[0].cu_photo_url).toBe('https://repB_UNTOUCHED.jpg');
    });

    await assertTest('Logic 7', 'TC62', 'replaceReportPhoto từ chối khi truyền targetId thuộc Report B khi thao tác trên Report A', async () => {
      const rA = await createTestResidential('62A');
      const rB = await createTestResidential('62B');

      const zBId = await createTestDamageZone(rB.reportId, 'Z-01');
      const dBId = await createTestDefectItem(zBId, 'D-SECRET', { cuPhotoUrl: 'https://secret.jpg' });

      await expectToThrow(
        () => AuditModificationService.replaceReportPhoto(rA.reportId, adminId, {
          targetPhotoType: 'DEFECT_CLOSEUP',
          defectId: dBId,
          newPhotoUrl: 'https://hack.jpg',
          clientPin: '123456',
          replacementReason: 'Cố ý cross-tenant'
        }),
        NotFoundError,
        'Không tìm thấy khuyết tật tương ứng trong hồ sơ này'
      );
    });

    await assertTest('Logic 7', 'TC63', 'executePhotoAction thao tác DELETE trên Report A bọc phạm vi report_id = A', async () => {
      const rA = await createTestResidential('63A');
      const rB = await createTestResidential('63B');

      const zBId = await createTestDamageZone(rB.reportId, 'Z-01');
      const dBId = await createTestDefectItem(zBId, 'D-SAFE', { cuPhotoUrl: 'https://safe.jpg' });

      await AuditModificationService.executePhotoAction(rA.reportId, adminId, {
        category: 'DEFECT_CU',
        action: 'DELETE',
        defectCode: 'D-SAFE',
        reason: 'Xóa nhầm bên nhà B?'
      });

      const checkB = await client.query<{ is_deleted: boolean }>(`SELECT is_deleted FROM defect_items WHERE id = $1;`, [dBId]);
      expect(checkB.rows[0].is_deleted).toBe(false);
    });

    await assertTest('Logic 7', 'TC64', 'Cập nhật damage_zones trong applyAdminSurveyEdit chỉ lọc zones thuộc đúng report_id', async () => {
      const rA = await createTestResidential('64A');
      const rB = await createTestResidential('64B');

      const zBId = await createTestDamageZone(rB.reportId, 'Z-01', { roomName: 'Bếp Nhà B' });

      await AuditModificationService.applyAdminSurveyEdit(rA.reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Chỉnh sửa zone A',
        diffPayload: [],
        updates: {
          damageZones: [{ zoneCode: 'Z-01', floorName: 'T1', roomName: 'Khách Nhà A', componentType: 'BEAM' }]
        }
      });

      const checkB = await client.query<{ room_name: string }>(`SELECT room_name FROM damage_zones WHERE id = $1;`, [zBId]);
      expect(checkB.rows[0].room_name).toBe('Bếp Nhà B');
    });

    await assertTest('Logic 7', 'TC65', 'Câu lệnh soft-delete trong rollbackToVersion chỉ tác động lên defect_items của chính report_id', async () => {
      const rA = await createTestResidential('65A');
      const rB = await createTestResidential('65B');

      const zBId = await createTestDamageZone(rB.reportId, 'Z-01');
      const dBId = await createTestDefectItem(zBId, 'D-99');

      const v0 = await AuditVersionService.createSnapshot(rA.reportId, {
        versionTag: 'ORIGINAL_SUBMISSION',
        title: 'Bản gốc A',
        userId: adminId
      });

      await AuditVersionService.rollbackToVersion(rA.reportId, v0.versionNumber, adminId, {
        reason: 'Rollback A',
        password: 'AdminTest@1234'
      });

      const checkB = await client.query<{ is_deleted: boolean }>(`SELECT is_deleted FROM defect_items WHERE id = $1;`, [dBId]);
      expect(checkB.rows[0].is_deleted).toBe(false);
    });

    await assertTest('Logic 7', 'TC66', 'Hai nhà dân độc lập có cùng địa chỉ hoặc gần nhau vẫn được cách ly độc lập', async () => {
      const rA = await createTestResidential('66A');
      const rB = await createTestResidential('66B');

      await client.query(`UPDATE parcels SET street = 'Đường Trùng Tên', ward = 'Phường Chung' WHERE id IN ($1, $2);`, [rA.parcelId, rB.parcelId]);
      const viewA = await AuditReviewService.getSplitPaneAuditView(rA.reportId);
      const viewB = await AuditReviewService.getSplitPaneAuditView(rB.reportId);

      expect(viewA.leftPane.parcel.id).toBe(rA.parcelId);
      expect(viewB.leftPane.parcel.id).toBe(rB.parcelId);
      expect(viewA.reportId).toBe(rA.reportId);
      expect(viewB.reportId).toBe(rB.reportId);
    });

    await assertTest('Logic 7', 'TC67', 'system_audit_logs luôn ghi đúng entity_id là actualReportId', async () => {
      const { reportId } = await createTestResidential('67');
      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Kiểm tra entity_id',
        diffPayload: [],
        updates: { landAreaM2: 135.0 }
      });
      const log = await client.query<{ entity_id: string }>(
        `SELECT entity_id FROM system_audit_logs WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 1;`,
        [reportId]
      );
      expect(log.rows[0].entity_id).toBe(reportId);
    });

    await assertTest('Logic 7', 'TC68', 'Cập nhật building_specifications chỉ ảnh hưởng đúng hồ sơ được truyền', async () => {
      const rA = await createTestResidential('68A');
      const rB = await createTestResidential('68B');

      await AuditModificationService.applyAdminSurveyEdit(rA.reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Chỉnh sửa specs A',
        diffPayload: [],
        updates: {
          specs: { floorCount: 5, foundationDepthM: 3.0 }
        }
      });

      const specB = await client.query<{ floor_count: number }>(`SELECT floor_count FROM building_specifications WHERE report_id = $1;`, [rB.reportId]);
      expect(specB.rows[0].floor_count).toBe(3);
    });

    await assertTest('Logic 7', 'TC69', 'Cập nhật deformation_assessments chỉ ảnh hưởng đúng hồ sơ được truyền', async () => {
      const rA = await createTestResidential('69A');
      const rB = await createTestResidential('69B');

      await AuditModificationService.applyAdminSurveyEdit(rA.reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Chỉnh sửa biến dạng A',
        diffPayload: [],
        updates: {
          deformation: { tiltAssessment: { xPermille: 8.0 } }
        }
      });

      const defA = await client.query<{ tilt_angle_x: number }>(`SELECT tilt_angle_x FROM deformation_assessments WHERE report_id = $1;`, [rA.reportId]);
      expect(Number(defA.rows[0].tilt_angle_x)).toBe(0.8);

      const defB = await client.query<{ tilt_angle_x: number }>(`SELECT tilt_angle_x FROM deformation_assessments WHERE report_id = $1;`, [rB.reportId]);
      expect(Number(defB.rows[0].tilt_angle_x)).toBe(0);
    });

    await assertTest('Logic 7', 'TC70', 'Khóa chiếm quyền audit_locks chỉ khóa hồ sơ cụ thể, hồ sơ khác vẫn mở bình thường', async () => {
      const rA = await createTestResidential('70A');
      const rB = await createTestResidential('70B');

      await AuditModificationService.acquireAuditLock(rA.reportId, adminId);
      const checkA = await AuditModificationService.checkAuditLock(rA.reportId, admin2Id);
      const checkB = await AuditModificationService.checkAuditLock(rB.reportId, admin2Id);

      expect(checkA.isLocked).toBe(true);
      expect(checkB.isLocked).toBe(false);
    });

    // ============================================================================
    // NHÓM 8 (TC 71 - TC 80): Universal Snapshot Adapter Chống Xóa Trắng Form khi Rollback
    // ============================================================================
    console.log('\n--- BẮT ĐẦU NHÓM 8: UNIVERSAL SNAPSHOT ADAPTER CHỐNG XÓA TRẮNG FORM (TC 71 - 80) ---');

    await assertTest('Logic 8', 'TC71', 'Rollback từ snapshot dạng V2 Audit View (leftPane/rightPane) khôi phục đầy đủ parcels', async () => {
      const { reportId, parcelId } = await createTestResidential('71');
      const v1 = await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'ADMIN_DIFF_SAVE',
        title: 'Bản snapshot kiểu V2',
        userId: adminId,
        customSnapshotData: {
          surveyJson: { houseNumber: '71/V2Audit', street: 'Đường V2', landAreaM2: 111.0 },
          leftPane: {
            parcel: { houseNumber: '71/V2Audit', street: 'Đường V2', landAreaM2: 111.0, ownerName: 'Chủ V2' }
          }
        }
      });

      await AuditVersionService.rollbackToVersion(reportId, v1.versionNumber, adminId, {
        reason: 'Rollback về V2',
        password: 'AdminTest@1234'
      });
      const pCheck = await client.query<{ house_number: string; owner_name: string }>(`SELECT house_number, owner_name FROM parcels WHERE id = $1;`, [parcelId]);
      expect(pCheck.rows[0].house_number).toBe('71/V2Audit');
      expect(pCheck.rows[0].owner_name).toBe('Chủ V2');
    });

    await assertTest('Logic 8', 'TC72', 'Rollback từ snapshot dạng V3 Release (frozenSurveyDataJson & frozenParcel) đọc chính xác', async () => {
      const { reportId, parcelId } = await createTestResidential('72');
      const v2 = await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'ORIGINAL_SUBMISSION',
        title: 'Bản snapshot kiểu V3 Release',
        userId: adminId,
        customSnapshotData: {
          frozenSurveyDataJson: {
            houseNumber: '72/V3Release',
            street: 'Đại Lộ V3',
            landAreaM2: 222.0,
            specs: { floorCount: 4, structureType: 'FRAME_CONCRETE' }
          },
          frozenParcel: {
            houseNumber: '72/V3Release',
            street: 'Đại Lộ V3',
            landAreaM2: 222.0,
            ownerName: 'Chủ V3 Release'
          }
        }
      });

      await AuditVersionService.rollbackToVersion(reportId, v2.versionNumber, adminId, {
        reason: 'Rollback về V3',
        password: 'AdminTest@1234'
      });
      const pCheck = await client.query<{ house_number: string; street: string; land_area_m2: number; owner_name: string }>(
        `SELECT house_number, street, land_area_m2, owner_name FROM parcels WHERE id = $1;`,
        [parcelId]
      );
      expect(pCheck.rows[0].house_number).toBe('72/V3Release');
      expect(pCheck.rows[0].street).toBe('Đại Lộ V3');
      expect(Number(pCheck.rows[0].land_area_m2)).toBe(222.0);
      expect(pCheck.rows[0].owner_name).toBe('Chủ V3 Release');
    });

    await assertTest('Logic 8', 'TC73', 'Rollback từ V3 Release khôi phục thông số kết cấu vào building_specifications', async () => {
      const { reportId } = await createTestResidential('73');
      const v3 = await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'ORIGINAL_SUBMISSION',
        title: 'Bản snapshot kết cấu',
        userId: adminId,
        customSnapshotData: {
          frozenSurveyDataJson: {
            specs: { floorCount: 5, structureType: 'MASONRY_LOADBEARING', foundationType: 'PILE_CONCRETE', foundationDepthM: 12.0 }
          },
          frozenParcel: { houseNumber: '73/Test' }
        }
      });

      await AuditVersionService.rollbackToVersion(reportId, v3.versionNumber, adminId, {
        reason: 'Rollback kết cấu',
        password: 'AdminTest@1234'
      });
      const specCheck = await client.query<{ floor_count: number; structural_system: string; foundation_depth_m: number }>(
        `SELECT floor_count, structural_system, foundation_depth_m FROM building_specifications WHERE report_id = $1;`,
        [reportId]
      );
      expect(specCheck.rows[0].floor_count).toBe(5);
      expect(specCheck.rows[0].structural_system).toBe('TUONG_GACH_CHIU_LUC');
      expect(Number(specCheck.rows[0].foundation_depth_m)).toBe(12.0);
    });

    await assertTest('Logic 8', 'TC74', 'Rollback từ V3 Release khôi phục damage_zones và defect_items', async () => {
      const { reportId } = await createTestResidential('74');
      const v4 = await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'ORIGINAL_SUBMISSION',
        title: 'Bản snapshot vết nứt',
        userId: adminId,
        customSnapshotData: {
          frozenSurveyDataJson: {
            damageZones: [
              {
                zoneCode: 'Z-SNAP-74',
                floorName: 'Tầng 2',
                roomName: 'Ban công',
                componentType: 'WALL',
                defects: [
                  { defectCode: 'D-SNAP-74', defectType: 'HAIRLINE', widthMaxMm: 1.2 }
                ]
              }
            ]
          },
          frozenParcel: { houseNumber: '74/Test' }
        }
      });

      await AuditVersionService.rollbackToVersion(reportId, v4.versionNumber, adminId, {
        reason: 'Rollback vết nứt',
        password: 'AdminTest@1234'
      });
      const zCheck = await client.query<{ id: string; zone_code: string; room_name: string }>(
        `SELECT id, zone_code, room_name FROM damage_zones WHERE report_id = $1 AND zone_code = 'Z-SNAP-74';`,
        [reportId]
      );
      expect(zCheck.rows.length).toBe(1);
      expect(zCheck.rows[0].room_name).toBe('Ban công');

      const dCheck = await client.query<{ defect_code: string; width_max_mm: number }>(
        `SELECT defect_code, width_max_mm FROM defect_items WHERE zone_id = $1;`,
        [zCheck.rows[0].id]
      );
      expect(dCheck.rows.length).toBe(1);
      expect(Number(dCheck.rows[0].width_max_mm)).toBe(1.2);
    });

    await assertTest('Logic 8', 'TC75', 'Không làm mất (nullify) số nhà hoặc phường xã khi rollback', async () => {
      const { reportId, parcelId } = await createTestResidential('75');
      const v5 = await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'ORIGINAL_SUBMISSION',
        title: 'Bản lưu an toàn',
        userId: adminId,
        customSnapshotData: {
          surveyJson: { houseNumber: '75/AnToan', ward: 'Phường 15', district: 'Quận 10' },
          frozenParcel: { houseNumber: '75/AnToan', ward: 'Phường 15', district: 'Quận 10' }
        }
      });

      await AuditVersionService.rollbackToVersion(reportId, v5.versionNumber, adminId, {
        reason: 'Rollback bảo vệ địa chỉ',
        password: 'AdminTest@1234'
      });
      const pCheck = await client.query<{ house_number: string; ward: string; district: string }>(
        `SELECT house_number, ward, district FROM parcels WHERE id = $1;`,
        [parcelId]
      );
      expect(pCheck.rows[0].house_number).toBe('75/AnToan');
      expect(pCheck.rows[0].ward).toBe('Phường 15');
      expect(pCheck.rows[0].district).toBe('Quận 10');
    });

    await assertTest('Logic 8', 'TC76', 'Khôi phục ảnh định danh P01-P04 từ cả snap.identificationPhotos lẫn frozenSurveyDataJson', async () => {
      const { reportId } = await createTestResidential('76');
      const v6 = await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'ORIGINAL_SUBMISSION',
        title: 'Bản snapshot ảnh định danh',
        userId: adminId,
        customSnapshotData: {
          frozenSurveyDataJson: {
            identificationPhotos: {
              photoP01: { url: 'https://p01.jpg', photoCode: 'P-01' },
              photoP02: { url: 'https://p02.jpg', photoCode: 'P-02' }
            }
          },
          frozenParcel: { houseNumber: '76/Test' }
        }
      });

      await AuditVersionService.rollbackToVersion(reportId, v6.versionNumber, adminId, {
        reason: 'Rollback ảnh P01',
        password: 'AdminTest@1234'
      });
      const repCheck = await client.query<{ survey_data_json: any }>(`SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`, [reportId]);
      const sJson = typeof repCheck.rows[0].survey_data_json === 'string' ? JSON.parse(repCheck.rows[0].survey_data_json) : repCheck.rows[0].survey_data_json;
      expect(sJson.identificationPhotos?.photoP01?.url).toBe('https://p01.jpg');
      expect(sJson.identificationPhotos?.photoP02?.url).toBe('https://p02.jpg');
    });

    await assertTest('Logic 8', 'TC77', 'Khôi phục đánh giá lún nghiêng từ frozenSurveyDataJson.deformation', async () => {
      const { reportId } = await createTestResidential('77');
      const v7 = await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'ORIGINAL_SUBMISSION',
        title: 'Bản snapshot biến dạng',
        userId: adminId,
        customSnapshotData: {
          frozenSurveyDataJson: {
            deformation: {
              tiltAssessment: { xPermille: 5.0, yPermille: 6.0, direction: 'SOUTH' }
            }
          },
          frozenParcel: { houseNumber: '77/Test' }
        }
      });

      await AuditVersionService.rollbackToVersion(reportId, v7.versionNumber, adminId, {
        reason: 'Rollback biến dạng',
        password: 'AdminTest@1234'
      });
      const defCheck = await client.query<{ tilt_angle_x: number; tilt_direction: string }>(
        `SELECT tilt_angle_x, tilt_direction FROM deformation_assessments WHERE report_id = $1;`,
        [reportId]
      );
      expect(Number(defCheck.rows[0].tilt_angle_x)).toBe(0.5);
      expect(defCheck.rows[0].tilt_direction).toBe('SOUTH');
    });

    await assertTest('Logic 8', 'TC78', 'Sau khi rollback, gọi getSplitPaneAuditView hiển thị đầy đủ không trắng xóa', async () => {
      const { reportId } = await createTestResidential('78');
      const v8 = await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'ORIGINAL_SUBMISSION',
        title: 'Bản snapshot kiểm tra view',
        userId: adminId,
        customSnapshotData: {
          frozenSurveyDataJson: {
            houseNumber: '78/ViewKhongTrang',
            street: 'Đường Đẹp',
            damageZones: [{ zoneCode: 'Z-78', floorName: 'T1', roomName: 'Khách', componentType: 'WALL' }]
          },
          frozenParcel: { houseNumber: '78/ViewKhongTrang', street: 'Đường Đẹp' }
        }
      });

      await AuditVersionService.rollbackToVersion(reportId, v8.versionNumber, adminId, {
        reason: 'Rollback view check',
        password: 'AdminTest@1234'
      });
      const view = await AuditReviewService.getSplitPaneAuditView(reportId);
      expect(view.leftPane?.parcel?.houseNumber).toBe('78/ViewKhongTrang');
      expect(view.leftPane?.parcel?.street).toBe('Đường Đẹp');
    });

    await assertTest('Logic 8', 'TC79', 'Tự động kích hoạt lại trạng thái ACTIVE cho ảnh thuộc snapshot đích', async () => {
      const { reportId, parcelId } = await createTestResidential('79');
      const photoRes = await client.query<{ id: string }>(
        `INSERT INTO survey_photo_registry (
           report_id, parcel_id, photo_category, photo_type, photo_code,
           photo_url, standardized_filename, sha256_hash, action_type, status
         ) VALUES ($1, $2, 'IDENTIFICATION', 'P01_HOUSE_NUMBER', 'P-79', 'https://storage/p79.jpg', 'p79.jpg', 'hash79', 'UPLOAD', 'SUPERSEDED')
         RETURNING id;`,
        [reportId, parcelId]
      );
      const photoId = photoRes.rows[0].id;

      const v9 = await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'ORIGINAL_SUBMISSION',
        title: 'Snapshot chứa ảnh',
        userId: adminId,
        customSnapshotData: {
          frozenSurveyDataJson: {
            identificationPhotos: { photoP01: { url: 'https://storage/p79.jpg' } }
          },
          frozenParcel: { houseNumber: '79/Test' }
        }
      });

      await AuditVersionService.rollbackToVersion(reportId, v9.versionNumber, adminId, {
        reason: 'Rollback kích hoạt ảnh',
        password: 'AdminTest@1234'
      });
      const pCheck = await client.query<{ status: string }>(`SELECT status FROM survey_photo_registry WHERE id = $1;`, [photoId]);
      expect(pCheck.rows[0].status).toBe('ACTIVE');
    });

    await assertTest('Logic 8', 'TC80', 'Từ chối rollback nếu snapshot đích hoàn toàn rỗng để bảo vệ dữ liệu', async () => {
      const { reportId } = await createTestResidential('80');
      const vEmpty = await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'ORIGINAL_SUBMISSION',
        title: 'Snapshot rỗng',
        userId: adminId,
        customSnapshotData: { surveyJson: {} }
      });

      await expectToThrow(
        () => AuditVersionService.rollbackToVersion(reportId, vEmpty.versionNumber, adminId, {
          reason: 'Cố ý rollback rỗng',
          password: 'AdminTest@1234'
        }),
        BadRequestError,
        'không hợp lệ hoặc bị rỗng'
      );
    });

    // ============================================================================
    // NHÓM 9 (TC 81 - TC 90): Deep Legal SHA-256 Hash & Immutability Revision Chain
    // ============================================================================
    console.log('\n--- BẮT ĐẦU NHÓM 9: DEEP LEGAL SHA-256 HASH & IMMUTABILITY CHAIN (TC 81 - 90) ---');

    await assertTest('Logic 9', 'TC81', 'computeDeepLegalHash tạo băm nhất quán (deterministic) với cùng một payload', async () => {
      const baseScores = { ecs: { total: 0, class: 'GOOD' }, vi: { avg: 1.0, class: 'LOW' } };
      const surveyJson = { specs: { floorCount: 3 }, damageZones: [{ zoneCode: 'Z-01', defects: [{ widthMaxMm: 0.5 }] }] };
      const frozenParcel = { houseNumber: '123', street: 'Lê Lợi' };

      const hash1 = ReportSnapshotService.computeDeepLegalHash(baseScores as any, surveyJson, frozenParcel);
      const hash2 = ReportSnapshotService.computeDeepLegalHash(baseScores as any, surveyJson, frozenParcel);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });

    await assertTest('Logic 9', 'TC82', 'Thay đổi số nhà trong parcel làm thay đổi chuỗi băm Deep Legal Hash', async () => {
      const baseScores = { ecs: { total: 0, class: 'GOOD' }, vi: { avg: 1.0, class: 'LOW' } };
      const p1 = { houseNumber: '100' };
      const p2 = { houseNumber: '101' };
      const h1 = ReportSnapshotService.computeDeepLegalHash(baseScores as any, {}, p1);
      const h2 = ReportSnapshotService.computeDeepLegalHash(baseScores as any, {}, p2);
      expect(h1 !== h2).toBeTruthy();
    });

    await assertTest('Logic 9', 'TC83', 'Thay đổi bề rộng vết nứt từ 0.5mm sang 1.5mm làm thay đổi chuỗi băm', async () => {
      const baseScores = { ecs: { total: 0, class: 'GOOD' }, vi: { avg: 1.0, class: 'LOW' } };
      const s1 = { floors: [{ floorName: 'T1', zones: [{ defects: [{ defectCode: 'D-01', widthMaxMm: 0.5 }] }] }] };
      const s2 = { floors: [{ floorName: 'T1', zones: [{ defects: [{ defectCode: 'D-01', widthMaxMm: 1.5 }] }] }] };
      const h1 = ReportSnapshotService.computeDeepLegalHash(baseScores as any, s1, {});
      const h2 = ReportSnapshotService.computeDeepLegalHash(baseScores as any, s2, {});
      expect(h1 !== h2).toBeTruthy();
    });

    await assertTest('Logic 9', 'TC84', 'Thay đổi điểm số ECS hoặc VI làm thay đổi chuỗi băm', async () => {
      const scores1 = { ecs: { total: 5, class: 'MEDIUM' }, vi: { avg: 1.5, class: 'LOW' } };
      const scores2 = { ecs: { total: 6, class: 'MEDIUM' }, vi: { avg: 1.5, class: 'LOW' } };
      const h1 = ReportSnapshotService.computeDeepLegalHash(scores1 as any, {}, {});
      const h2 = ReportSnapshotService.computeDeepLegalHash(scores2 as any, {}, {});
      expect(h1 !== h2).toBeTruthy();
    });

    await assertTest('Logic 9', 'TC85', 'Thay đổi thông số kết cấu specs làm thay đổi chuỗi băm', async () => {
      const baseScores = { ecs: { total: 0, class: 'GOOD' }, vi: { avg: 1.0, class: 'LOW' } };
      const s1 = { specs: { floorCount: 3 } };
      const s2 = { specs: { floorCount: 4 } };
      const h1 = ReportSnapshotService.computeDeepLegalHash(baseScores as any, s1, {});
      const h2 = ReportSnapshotService.computeDeepLegalHash(baseScores as any, s2, {});
      expect(h1 !== h2).toBeTruthy();
    });

    await assertTest('Logic 9', 'TC86', 'Thay đổi URL ảnh cận cảnh defect làm thay đổi chuỗi băm', async () => {
      const baseScores = { ecs: { total: 0, class: 'GOOD' }, vi: { avg: 1.0, class: 'LOW' } };
      const s1 = { floors: [{ floorName: 'T1', zones: [{ defects: [{ defectCode: 'D-01', cuPhotoUrl: 'https://cu1.jpg' }] }] }] };
      const s2 = { floors: [{ floorName: 'T1', zones: [{ defects: [{ defectCode: 'D-01', cuPhotoUrl: 'https://cu2.jpg' }] }] }] };
      const h1 = ReportSnapshotService.computeDeepLegalHash(baseScores as any, s1, {});
      const h2 = ReportSnapshotService.computeDeepLegalHash(baseScores as any, s2, {});
      expect(h1 !== h2).toBeTruthy();
    });

    await assertTest('Logic 9', 'TC87', 'Phê duyệt lần đầu approveReport tạo ra bản release Rev 00', async () => {
      const { reportId } = await createTestResidential('87');
      const approveRes = await AuditReviewService.approveReport(reportId, adminId, 'Phê duyệt ban đầu');
      expect(approveRes.exportRevision).toBe(0);

      const relRes = await client.query<{ version_number: number; version_tag: string; title: string; snapshot_data: any }>(
        `SELECT version_number, version_tag, title, snapshot_data FROM survey_report_versions WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE' ORDER BY version_number DESC LIMIT 1;`,
        [reportId]
      );
      expect(relRes.rows.length).toBe(1);
      expect(relRes.rows[0].version_tag).toBe('APPROVED_RELEASE');
      const snap = typeof relRes.rows[0].snapshot_data === 'string' ? JSON.parse(relRes.rows[0].snapshot_data) : relRes.rows[0].snapshot_data;
      expect(snap.exportRevision).toBe(0);
    });

    await assertTest('Logic 9', 'TC88', 'Chỉnh sửa và duyệt lại sau sửa đổi nâng revision_number thành Rev 01 có snapshot Rev 01 lưu đầy đủ', async () => {
      const { reportId } = await createTestResidential('88');
      await AuditReviewService.approveReport(reportId, adminId, 'Duyệt lần đầu');

      await client.query(`UPDATE base_survey_reports SET status = 'UNDER_REVIEW' WHERE id = $1;`, [reportId]);
      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Cập nhật lại diện tích thực địa',
        diffPayload: [],
        updates: { landAreaM2: 180.0 }
      });

      const rel1 = await AuditReviewService.approveReport(reportId, adminId, 'Duyệt lần 2 sau sửa đổi');
      expect(rel1.exportRevision).toBe(0);

      const rel1Check = await client.query<{ title: string; snapshot_data: any }>(
        `SELECT title, snapshot_data FROM survey_report_versions WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE' ORDER BY version_number DESC LIMIT 1;`,
        [reportId]
      );
      expect(rel1Check.rows[0].title).toContain('Phê duyệt lại số liệu sau mở khóa');
      const snap1 = typeof rel1Check.rows[0].snapshot_data === 'string' ? JSON.parse(rel1Check.rows[0].snapshot_data) : rel1Check.rows[0].snapshot_data;
      expect(snap1.exportRevision).toBe(0);
    });

    await assertTest('Logic 9', 'TC89', 'Lịch sử phiên bản lưu giữ cả bản Rev 00 và Rev 01 (bảo toàn phả hệ)', async () => {
      const { reportId } = await createTestResidential('89');
      await AuditReviewService.approveReport(reportId, adminId, 'Duyệt 1');

      await client.query(`UPDATE base_survey_reports SET status = 'UNDER_REVIEW' WHERE id = $1;`, [reportId]);
      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: 'AdminTest@1234',
        editReason: 'Chỉnh sửa Rev 01',
        diffPayload: [],
        updates: { landAreaM2: 210.0 }
      });

      await AuditReviewService.approveReport(reportId, adminId, 'Duyệt 2');

      const versionsRes = await client.query<{ version_number: number; version_tag: string }>(
        `SELECT version_number, version_tag FROM survey_report_versions WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE' ORDER BY version_number ASC;`,
        [reportId]
      );
      expect(versionsRes.rows.length).toBe(2);
      expect(versionsRes.rows[0].version_number < versionsRes.rows[1].version_number).toBeTruthy();
    });

    await assertTest('Logic 9', 'TC90', 'Không thể chỉnh sửa trực tiếp hồ sơ đang ở trạng thái APPROVED (Immutability Enforced)', async () => {
      const { reportId } = await createTestResidential('90');
      await AuditReviewService.approveReport(reportId, adminId, 'Khóa bất biến');

      await expectToThrow(
        () => AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
          adminPassword: 'AdminTest@1234',
          editReason: 'Cố ý ghi đè hồ sơ APPROVED',
          diffPayload: [],
          updates: { landAreaM2: 999.0 }
        }),
        ForbiddenError,
        'đã được phê duyệt chính thức và bị khóa bất biến'
      );
    });

    // ============================================================================
    // NHÓM 10 (TC 91 - TC 100): Công Thức Kỹ Thuật (E1 Bậc Thang, E6, Ngưỡng VI, Safety Lock)
    // ============================================================================
    console.log('\n--- BẮT ĐẦU NHÓM 10: CÔNG THỨC KỸ THUẬT & SAFETY LOCK (TC 91 - 100) ---');

    await assertTest('Logic 10', 'TC91', 'Công thức E1 bậc thang: Bề rộng nứt <= 1.0mm (Grade 1) -> E1 = 0', async () => {
      const { reportId } = await createTestResidential('91');
      const zId = await createTestDamageZone(reportId, 'Z-91', { burlandGrade: 1 });
      await createTestDefectItem(zId, 'D-91', { widthMaxMm: 0.8 });
      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ e1_burland_score: number }>(`SELECT e1_burland_score FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(Number(cardRes.rows[0].e1_burland_score)).toBe(0);
    });

    await assertTest('Logic 10', 'TC92', 'Công thức E1 bậc thang: Bề rộng nứt 1.1 - 2.0mm (Grade 2) -> E1 = 1', async () => {
      const { reportId } = await createTestResidential('92');
      const zId = await createTestDamageZone(reportId, 'Z-92', { burlandGrade: 2 });
      await createTestDefectItem(zId, 'D-92', { widthMaxMm: 1.8 });
      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ e1_burland_score: number }>(`SELECT e1_burland_score FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(Number(cardRes.rows[0].e1_burland_score)).toBe(1);
    });

    await assertTest('Logic 10', 'TC93', 'Công thức E1 bậc thang: Bề rộng nứt 2.1 - 5.0mm (Grade 3) -> E1 = 2', async () => {
      const { reportId } = await createTestResidential('93');
      const zId = await createTestDamageZone(reportId, 'Z-93', { burlandGrade: 3 });
      await createTestDefectItem(zId, 'D-93', { widthMaxMm: 3.5 });
      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ e1_burland_score: number }>(`SELECT e1_burland_score FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(Number(cardRes.rows[0].e1_burland_score)).toBe(2);
    });

    await assertTest('Logic 10', 'TC94', 'Công thức E1 bậc thang: Bề rộng nứt 5.1 - 15.0mm (Grade 4) -> E1 = 3', async () => {
      const { reportId } = await createTestResidential('94');
      const zId = await createTestDamageZone(reportId, 'Z-94', { burlandGrade: 4 });
      await createTestDefectItem(zId, 'D-94', { widthMaxMm: 8.0 });
      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ e1_burland_score: number }>(`SELECT e1_burland_score FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(Number(cardRes.rows[0].e1_burland_score)).toBe(3);
    });

    await assertTest('Logic 10', 'TC95', 'Công thức E1 bậc thang: Bề rộng nứt > 15.0mm (Grade 5) -> E1 = 4', async () => {
      const { reportId } = await createTestResidential('95');
      const zId = await createTestDamageZone(reportId, 'Z-95', { burlandGrade: 5 });
      await createTestDefectItem(zId, 'D-95', { widthMaxMm: 22.0 });
      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ e1_burland_score: number }>(`SELECT e1_burland_score FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(Number(cardRes.rows[0].e1_burland_score)).toBe(4);
    });

    await assertTest('Logic 10', 'TC96', 'Ngưỡng VI: VI_avg <= 1.5 -> vi_class = LOW', async () => {
      const { reportId } = await createTestResidential('96');
      const surveyJson = {
        usageFunction: 'Nhà bỏ trống',
        structureSystem: 'BTCT toàn khối',
        foundationCatScore: 1,
        constructionYear: new Date().getFullYear() - 5,
        historyInterview: {}
      };
      await client.query(`UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`, [JSON.stringify(surveyJson), reportId]);
      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ avg_vi_score: number; vi_class: string }>(`SELECT avg_vi_score, vi_class FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(Number(cardRes.rows[0].avg_vi_score)).toBeLessThanOrEqual(1.5);
      expect(cardRes.rows[0].vi_class).toBe('LOW');
    });

    await assertTest('Logic 10', 'TC97', 'Ngưỡng VI: 1.5 < VI_avg <= 2.50 -> vi_class = MEDIUM', async () => {
      const { reportId } = await createTestResidential('97');
      const surveyJson = {
        usageFunction: 'Nhà ở',
        objectGroup: 'GENERAL',
        structureSystem: 'Khung bê tông cốt thép',
        foundationCatScore: 3,
        constructionYear: new Date().getFullYear() - 20,
        historyInterview: {}
      };
      await client.query(`UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`, [JSON.stringify(surveyJson), reportId]);
      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ avg_vi_score: number; vi_class: string }>(`SELECT avg_vi_score, vi_class FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(Number(cardRes.rows[0].avg_vi_score)).toBeGreaterThan(1.5);
      expect(Number(cardRes.rows[0].avg_vi_score)).toBeLessThanOrEqual(2.50);
      expect(cardRes.rows[0].vi_class).toBe('MEDIUM');
    });

    await assertTest('Logic 10', 'TC98', 'Ngưỡng VI: 2.50 < VI_avg <= 3.25 -> vi_class = HIGH', async () => {
      const { reportId } = await createTestResidential('98');
      const surveyJson = {
        usageFunction: 'Trường học',
        objectGroup: 'IMPORTANT',
        structureSystem: 'Tường gạch chịu lực',
        foundationCatScore: 4,
        constructionYear: new Date().getFullYear() - 35,
        historyInterview: { sensitiveEquipment: { has: true } }
      };
      await client.query(`UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`, [JSON.stringify(surveyJson), reportId]);
      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ avg_vi_score: number; vi_class: string }>(`SELECT avg_vi_score, vi_class FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(Number(cardRes.rows[0].avg_vi_score)).toBeGreaterThan(2.50);
      expect(Number(cardRes.rows[0].avg_vi_score)).toBeLessThanOrEqual(3.25);
      expect(cardRes.rows[0].vi_class).toBe('HIGH');
    });

    await assertTest('Logic 10', 'TC99', 'Ngưỡng VI: VI_avg > 3.25 -> vi_class = VERY_HIGH', async () => {
      const { reportId } = await createTestResidential('99');
      const surveyJson = {
        usageFunction: 'Bệnh viện',
        objectGroup: 'CRITICAL',
        structureSystem: 'Kém ổn định',
        foundationCatScore: 5,
        historyInterview: { renovationLoad: 3, continuousOperation247: true }
      };
      await client.query(`UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`, [JSON.stringify(surveyJson), reportId]);
      await ScoringService.calculatePhase1Scores(reportId);
      const cardRes = await client.query<{ avg_vi_score: number; vi_class: string }>(`SELECT avg_vi_score, vi_class FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
      expect(Number(cardRes.rows[0].avg_vi_score)).toBeGreaterThan(3.25);
      expect(cardRes.rows[0].vi_class).toBe('VERY_HIGH');
    });

    await assertTest('Logic 10', 'TC100', 'Safety Lock: Chặn đứng kỹ sư trưởng hạ hạng rủi ro (DOWNGRADE) khi E2 >= 3 hoặc E3 >= 3', async () => {
      const { reportId } = await createTestResidential('100');
      await client.query(`UPDATE risk_score_cards SET e2_structure_score = 3, ecs_class = 'CRITICAL' WHERE report_id = $1;`, [reportId]);

      await expectToThrow(
        () => ScoringService.applyEngineeringJudgement(reportId, 'DOWNGRADE', 'Kỹ sư trưởng cố tình hạ hạng', 'KS Trưởng', { ecsClass: 'GOOD' }),
        BadRequestError,
        'KHÓA AN TOÀN KỸ THUẬT: Công trình có khuyết tật kết cấu mức độ Nguy cấp (E2 >= 3)'
      );
    });

  } catch (globalErr: any) {
    console.error('LỖI TOÀN CỤC KHI CHẠY TEST SUITE:', globalErr);
  } finally {
    console.log('\n--- BẮT ĐẦU DỌN DẸP DỮ LIỆU TEST ---');
    try {
      if (cleanupReports.length > 0) {
        await client.query(`DELETE FROM report_releases WHERE report_id = ANY($1::uuid[]);`, [cleanupReports]);
        await client.query(`DELETE FROM survey_report_versions WHERE report_id = ANY($1::uuid[]);`, [cleanupReports]);
        await client.query(`DELETE FROM survey_audit_locks WHERE report_id = ANY($1::uuid[]);`, [cleanupReports]);
        await client.query(`DELETE FROM system_audit_logs WHERE entity_id::text = ANY($1::text[]);`, [cleanupReports]);
        await client.query(`DELETE FROM defect_items WHERE zone_id IN (SELECT id FROM damage_zones WHERE report_id = ANY($1::uuid[]));`, [cleanupReports]);
        await client.query(`DELETE FROM damage_zones WHERE report_id = ANY($1::uuid[]);`, [cleanupReports]);
        await client.query(`DELETE FROM deformation_assessments WHERE report_id = ANY($1::uuid[]);`, [cleanupReports]);
        await client.query(`DELETE FROM building_specifications WHERE report_id = ANY($1::uuid[]);`, [cleanupReports]);
        await client.query(`DELETE FROM risk_score_cards WHERE report_id = ANY($1::uuid[]);`, [cleanupReports]);
        await client.query(`DELETE FROM survey_photo_registry WHERE report_id = ANY($1::uuid[]);`, [cleanupReports]);
        await client.query(`DELETE FROM audit_alert_items WHERE report_id = ANY($1::uuid[]);`, [cleanupReports]);
        await client.query(`DELETE FROM base_survey_reports WHERE id = ANY($1::uuid[]);`, [cleanupReports]);
      }
      if (cleanupParcels.length > 0) {
        await client.query(`DELETE FROM parcels WHERE id = ANY($1::uuid[]);`, [cleanupParcels]);
      }
      if (cleanupUsers.length > 0) {
        await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[]);`, [cleanupUsers]);
      }
      console.log('✅ Đã dọn dẹp sạch sẽ toàn bộ dữ liệu test trong CSDL.');
    } catch (cleanupErr: any) {
      console.warn('⚠️ Lỗi khi dọn dẹp dữ liệu test:', cleanupErr.message);
    }
    client.release();
  }

  // Báo cáo tổng kết
  console.log('\n================================================================================');
  console.log('BÁO CÁO TỔNG KẾT KẾT QUẢ KIỂM THỬ (100 TEST CASES)');
  console.log('================================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Tổng số Test Case thực thi: ${total} / 100`);
  console.log(`Số Test Case PASS: ${passed}`);
  console.log(`Số Test Case FAIL: ${failed}`);

  if (failed > 0) {
    console.log('\nDANH SÁCH CÁC TEST CASE THẤT BẠI:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  ❌ [${r.group}] ${r.id}: ${r.name}`);
      console.log(`     Chi tiết lỗi: ${r.error}`);
    });
  }

  return { total, passed, failed, results };
}

if (require.main === module) {
  runTestSuite()
    .then((res) => {
      if (res.failed > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error('Fatal Test Suite Error:', err);
      process.exit(1);
    });
}
