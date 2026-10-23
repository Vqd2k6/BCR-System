import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import sharp from 'sharp';
import { Database, pool } from '../database/db';
import { AuditModificationService } from '../modules/audit/services/audit-modification.service';
import { AuditReviewService } from '../modules/audit/services/audit-review.service';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';
import { SurveyBaseRepository } from '../modules/survey/repositories/survey-base.repository';
import { ReportV2ViewModelMapper } from '../modules/report_v2/mappers/report-v2-viewmodel.mapper';
import { ReportV2Service } from '../modules/report_v2/report-v2.service';
import { ReportSnapshotService } from '../modules/report_v3/report-snapshot.service';
import { CondoUnitReportGenerator } from '../modules/report/generators/condo-unit.generator';
import { CryptoUtils } from '../common/utils/crypto.utils';

function loadFrontendOrientationStandards(): {
  RESIDENTIAL_PHOTO_RULES: Record<string, any>;
  evaluateResidentialOrientation: (w: number, h: number, rot?: number, ruleKey?: string) => any;
} {
  const filePath = path.resolve(
    __dirname,
    '../../../frontend/src/features/zone-management/components/review-queue/stepwise/utils/residentialPhotoOrientationStandards.ts'
  );
  const src = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const modExports: any = {};
  const fn = new Function('exports', transpiled.outputText);
  fn(modExports);
  return modExports;
}

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  assertionsCount: number;
  error?: string;
}

const results: TestResult[] = [];
let currentAssertions = 0;

function assert(condition: any, message: string) {
  currentAssertions++;
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function assertIncludes(haystack: any, needle: string, label: string) {
  currentAssertions++;
  const str = String(haystack ?? '');
  if (!str.includes(needle)) {
    throw new Error(`Assertion Failed [${label}]: Expected "${str}" to include "${needle}"`);
  }
}

function assertEqual(actual: any, expected: any, label: string) {
  currentAssertions++;
  if (actual !== expected) {
    throw new Error(`Assertion Failed [${label}]: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function runTest(id: string, name: string, fn: () => Promise<void>) {
  currentAssertions = 0;
  try {
    await fn();
    results.push({ id, name, passed: true, assertionsCount: currentAssertions });
    console.log(`✅ [${id}] ${name} (${currentAssertions} assertions passed)`);
  } catch (err: any) {
    results.push({ id, name, passed: false, assertionsCount: currentAssertions, error: err?.message || String(err) });
    console.error(`❌ [${id}] ${name} FAILED: ${err?.message || err}`);
  }
}

async function loadApprovedReportForRender(reportId: string): Promise<any> {
  const rawReport = await SurveyBaseRepository.findReportById(reportId);
  assert(rawReport, `Report ${reportId} must exist`);
  const snapEntry = await ReportSnapshotService.getLatestApprovedSnapshot(reportId);
  assert(snapEntry && snapEntry.snapshot, `APPROVED_RELEASE snapshot must exist for ${reportId}`);
  return ReportSnapshotService.applySnapshotToReport(rawReport as any, snapEntry!.snapshot);
}

async function main() {
  console.log('================================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ E2E 100%: THẨM ĐỊNH -> LƯU TRỮ -> APPROVED SNAPSHOT -> REPORT');
  console.log('================================================================================\n');

  // Prepare test Admin user with known password for verification
  const testPassword = 'AdminTestPassword123!';
  const passwordHash = await CryptoUtils.hashPassword(testPassword);

  const adminRes = await Database.query<{ id: string }>(
    `SELECT id FROM users WHERE role IN ('ZONE_ADMIN', 'SUPER_ADMIN') LIMIT 1;`
  );
  if (!adminRes.rows[0]) {
    throw new Error('Không tìm thấy tài khoản ZONE_ADMIN/SUPER_ADMIN trong DB để chạy test');
  }
  const adminId = adminRes.rows[0].id;
  const origHashRes = await Database.query<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = $1;`,
    [adminId]
  );
  const origPasswordHash = origHashRes.rows[0]?.password_hash;
  await Database.query(`UPDATE users SET password_hash = $1 WHERE id = $2;`, [passwordHash, adminId]);

  // Find a base parcel and surveyor to clone temporary test reports cleanly inside savepoints/cleanup
  const baseReportRes = await Database.query<{
    id: string;
    parcel_id: string;
    surveyor_id: string;
  }>(
    `SELECT r.id, r.parcel_id, r.surveyor_id
     FROM base_survey_reports r
     JOIN parcels p ON r.parcel_id = p.id
     WHERE r.deleted_at IS NULL AND r.unit_id IS NULL
     LIMIT 1;`
  );
  if (!baseReportRes.rows[0]) {
    throw new Error('Không tìm thấy hồ sơ nhà dân mẫu trong DB');
  }
  const sampleSurveyorId = baseReportRes.rows[0].surveyor_id;

  const createdReportIds: string[] = [];
  const createdParcelIds: string[] = [];
  const createdUnitIds: string[] = [];

  async function createIsolatedResidentialReport(tag: string): Promise<{ reportId: string; parcelId: string }> {
    const uniqueSuffix = `${tag}-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`;
    const pRes = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
         zone_id, project_parcel_code, official_cadastral_code,
         house_number, street, ward, district, building_type,
         owner_name, owner_phone, land_area_m2, construction_area_m2, floor_count,
         cadastral_polygon_geom
       )
       SELECT
         zone_id, $1, $2,
         '10', 'Đường Cũ', 'Phường 1', 'Quận 3', 'RESIDENTIAL',
         'Chủ Hộ Ban Đầu', '0900000001', 50.0, 120.0, 2,
         cadastral_polygon_geom
       FROM parcels WHERE id = $3
       RETURNING id;`,
      [`TEST-${uniqueSuffix}`, `DC-INIT-${uniqueSuffix}`, baseReportRes.rows[0].parcel_id]
    );
    const parcelId = pRes.rows[0].id;
    createdParcelIds.push(parcelId);

    const rRes = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
         parcel_id, report_code, surveyor_id, status, report_type,
         survey_date, summary_conclusions, engineering_recommendations, owner_remarks,
         survey_data_json
       ) VALUES (
         $1, $2, $3, 'UNDER_REVIEW', 'STANDALONE',
         '2026-01-15T08:00:00.000Z', 'Kết luận ban đầu', 'Kiến nghị ban đầu', 'Ý kiến ban đầu',
         $4::jsonb
       ) RETURNING id;`,
      [
        parcelId,
        `BC-TEST-${tag}-${Date.now().toString().slice(-4)}`,
        sampleSurveyorId,
        JSON.stringify({
          projectParcelCode: `TEST-${tag}`,
          houseNumber: '10',
          street: 'Đường Cũ',
          ward: 'Phường 1',
          ownerName: 'Chủ Hộ Ban Đầu',
          ownerPhone: '0900000001',
          aboveFloors: 2,
          undergroundFloors: 0,
          constructionYear: 2005,
          foundationCatScore: 3,
        }),
      ]
    );
    const reportId = rRes.rows[0].id;
    createdReportIds.push(reportId);

    await Database.query(
      `INSERT INTO risk_score_cards (
         report_id, e1_burland_score, e2_structure_score, e3_deformation_score,
         e4_material_score, e5_history_score, e6_overall_function_score,
         total_ecs_score, ecs_class
       ) VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 'GOOD')
       ON CONFLICT (report_id) DO NOTHING;`,
      [reportId]
    );

    return { reportId, parcelId };
  }

  try {
    // =========================================================================
    // TEST SUITE 1: KIỂM THỬ THAY ĐỔI TOÀN BỘ THÔNG TIN TRONG TỪNG MỤC (STEP 1 -> STEP 9)
    // =========================================================================

    // --- TC-S1: STEP 1 FULL MUTATION ---
    await runTest('TC-S1', 'Step 1: Thay đổi 100% thông tin Định danh, Địa chỉ, Quy mô, GPS & Bộ ảnh P-01..P-04 (kèm ảnh phụ P-03)', async () => {
      const { reportId } = await createIsolatedResidentialReport('S1');
      const step1Updates = {
        projectParcelCode: 'M2-Z9-S1-999',
        officialCadastralCode: 'THUA-88-TO-12',
        houseNumber: '123A/45',
        street: 'Cách Mạng Tháng Tám',
        ward: 'Phường 11',
        district: 'Quận 3',
        buildingName: 'Nhà ở kết hợp kinh doanh (Shophouse)',
        usageFunction: 'Nhà ở kết hợp kinh doanh',
        ownerName: 'Nguyễn Văn Thẩm Định S1',
        ownerPhone: '0912345678',
        buildingType: 'COMMERCIAL',
        objectGroup: 'IMPORTANT',
        aboveFloors: 5,
        undergroundFloors: 1,
        constructionYear: 2018,
        isEstimatedYear: true,
        constructionAreaM2: 385.5,
        buildingHeightM: 18.5,
        typicalStoreyHeightM: 3.6,
        surveyCaseType: 'UNDER_CONSTRUCTION',
        constructionStageNotes: 'Đang đổ sàn tầng 5 và xây tường bao',
        gpsCoords: { lat: 10.785123, lng: 106.678456, accuracy: 2.1 },
        photoP01: { url: '/uploads/test/s1_p01.jpg', notApplicable: false },
        photoP02: { url: '/uploads/test/s1_p02.jpg', notApplicable: false },
        photoP03: {
          url: '/uploads/test/s1_p03_left.jpg',
          tag: 'Bên hông trái',
          notApplicable: false,
          additionalPhotos: [
            { url: '/uploads/test/s1_p03_right.jpg', tag: 'Bên hông phải' },
            { url: '/uploads/test/s1_p03_rear.jpg', tag: 'Phía sau' },
          ],
        },
        photoP04: { url: '/uploads/test/s1_p04.jpg', notApplicable: false },
        photoRotations: { 'P-01': 90, 'P-02': 180 },
      };

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-S1: Thay đổi toàn bộ thông tin Bước 1',
        updates: step1Updates,
        diffPayload: [{ field: 'step1', label: 'Bước 1', oldValue: 'old', newValue: 'new' }],
      });

      await AuditReviewService.approveReport(reportId, adminId);

      const reportForRender = await loadApprovedReportForRender(reportId);
      const vm = ReportV2ViewModelMapper.buildViewModel(reportForRender);

      assertIncludes(vm.metadata.buildingId, '00999', 'metadata.buildingId');
      assertEqual(vm.metadata.cadastralCode, 'THUA-88-TO-12', 'metadata.cadastralCode');
      assertEqual(vm.metadata.coverPhotoUrl, '/uploads/test/s1_p02.jpg', 'metadata.coverPhotoUrl');
      assertIncludes(vm.section1.buildingName.vi, 'Nhà ở kết hợp kinh doanh', 'section1.buildingName.vi');
      assertIncludes(vm.section1.buildingName.vi, 'Đang thi công xây dựng', 'section1.buildingName.vi under construction');
      assertIncludes(vm.section1.address.vi, '123A/45', 'section1.address.vi houseNumber');
      assertIncludes(vm.section1.address.vi, 'Cách Mạng Tháng Tám', 'section1.address.vi street');
      assertEqual(vm.section1.ownerName, 'Nguyễn Văn Thẩm Định S1', 'section1.ownerName');
      assertEqual(vm.section1.contactPhone, '0912345678', 'section1.contactPhone');
      assertEqual(vm.section1.gpsCoords.lat, 10.785123, 'section1.gpsCoords.lat');
      assertEqual(vm.section1.gpsCoords.lng, 106.678456, 'section1.gpsCoords.lng');

      assertEqual(vm.section2.storeysAbove, 5, 'section2.storeysAbove');
      assertEqual(vm.section2.storeysBasement, 1, 'section2.storeysBasement');
      assertEqual(vm.section2.totalFloorAreaM2, '385.5', 'section2.totalFloorAreaM2');
      assertEqual(vm.section2.maxHeightM, '18.5', 'section2.maxHeightM');
      assertEqual(vm.section2.typicalStoreyHeightM, '3.6 m', 'section2.typicalStoreyHeightM');
      assertEqual(Number(vm.section2.yearConstructed), 2018, 'section2.yearConstructed');
      assertEqual(vm.section2.isEstimatedYear, true, 'section2.isEstimatedYear');
      assertIncludes(vm.section2.constructionStageNotes?.vi, 'Đang đổ sàn tầng 5', 'section2.constructionStageNotes');

      // Kiểm tra Appendix 1 có đủ P-01, P-02, 3 ảnh P-03, P-04
      const p01Items = vm.appendix1.filter((p) => p.photoCode === 'P-01');
      const p02Items = vm.appendix1.filter((p) => p.photoCode === 'P-02');
      const p03Items = vm.appendix1.filter((p) => p.photoCode === 'P-03');
      const p04Items = vm.appendix1.filter((p) => p.photoCode === 'P-04');
      assertEqual(p01Items.length, 1, 'P-01 count');
      assertEqual(p01Items[0].url, '/uploads/test/s1_p01.jpg', 'P-01 url');
      assertEqual(p01Items[0].rotation, 90, 'P-01 rotation');
      assertEqual(p02Items.length, 1, 'P-02 count');
      assertEqual(p02Items[0].rotation, 180, 'P-02 rotation');
      assertEqual(p03Items.length, 3, 'P-03 count (1 main + 2 additional)');
      assertEqual(p04Items.length, 1, 'P-04 count');
    });

    // --- TC-S2: STEP 2 FULL MUTATION ---
    await runTest('TC-S2', 'Step 2: Thay đổi 100% thông tin Kết cấu, Móng, Cự ly Metro, Hố đào, Tiếp giáp & Lịch sử sử dụng (Chương III & IV)', async () => {
      const { reportId } = await createIsolatedResidentialReport('S2');
      const step2Updates = {
        structureSystem: 'Khung BTCT chịu lực chính',
        structuralForm: 'Nhà phố thương mại / Văn phòng dịch vụ',
        foundationType: 'Móng cọc khoan nhồi (CIP)',
        foundationCatScore: 3,
        foundationDepthM: 14.5,
        foundationDensity: '4 cọc/đài',
        foundationSpacingM: 4.2,
        pileDimensionMm: 'D400 mm',
        foundationNotes: 'Chủ hộ xác nhận móng cọc khoan nhồi sâu 14.5m khi xây dựng năm 2019',
        manualMetroDistanceM: 16.4,
        clearanceOffsetDistance: 8.2,
        tunnelCrownDepthM: 22.0,
        adjacentBuildings: {
          left: { type: 'Nhà phố', floors: 4, contact: 'Chung tường', notes: 'Ổn định' },
          right: { type: 'Hẻm nội bộ', floors: 0, contact: 'Độc lập', notes: 'Hẻm 3m' },
          back: { type: 'Nhà dân', floors: 3, contact: 'Khe lún 5cm', notes: 'Bình thường' },
        },
        historyInterview: {
          renovationLoad: 2,
          majorRepair: 1,
          pastSettlement: 1,
          neighborDamage: 2,
          fireFloodIncident: 1,
          usageStatus: 'Đang sử dụng một phần',
          continuousOperation247: true,
          sensitiveEquipment: {
            has: true,
            description: 'Hệ thống máy chủ CNC và thiết bị y tế chính xác cao',
          },
          renovationNotes: 'Cải tạo nâng thêm 1 tầng nhẹ năm 2021',
        },
      };

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-S2: Thay đổi toàn bộ thông tin Bước 2',
        updates: step2Updates,
        diffPayload: [{ field: 'step2', label: 'Bước 2', oldValue: 'old', newValue: 'new' }],
      });

      await AuditReviewService.approveReport(reportId, adminId);

      const reportForRender = await loadApprovedReportForRender(reportId);
      const vm = ReportV2ViewModelMapper.buildViewModel(reportForRender);

      // Kiểm tra khoảng cách Metro & Tĩnh không đứng (Chương II)
      assertEqual(vm.section2.distanceToMetroAlignmentM, '16.4', 'section2.distanceToMetroAlignmentM');
      assertEqual(vm.section2.distanceToMetroEdgeM, '8.2', 'section2.distanceToMetroEdgeM');
      assertEqual(vm.section2.clearanceVerticalM, '7.5', 'section2.clearanceVerticalM (22.0 - 14.5)');

      // Kiểm tra Chương III (Lịch sử và tình trạng sử dụng)
      assertIncludes(vm.section3.changeOfUse.vi, 'Nhiều', 'section3.changeOfUse (renovationLoad=2)');
      assertIncludes(vm.section3.majorRepair.vi, 'Nhẹ', 'section3.majorRepair (majorRepair=1)');
      assertIncludes(vm.section3.previousSettlementTilt.vi, 'lún nghiêng nhẹ', 'section3.previousSettlementTilt (pastSettlement=1)');
      assertIncludes(vm.section3.damageByAdjacentWorks.vi, 'Ảnh hưởng đáng kể', 'section3.damageByAdjacentWorks (neighborDamage=2)');
      assertIncludes(vm.section3.flooding.vi, 'Nhẹ', 'section3.flooding (fireFloodIncident=1)');
      assertIncludes(vm.section3.occupancyStatus.vi, 'một phần', 'section3.occupancyStatus');
      assertIncludes(vm.section3.sensitiveEquipment.vi, 'Hệ thống máy chủ CNC', 'section3.sensitiveEquipment');

      // Kiểm tra Chương IV (Đặc điểm kết cấu & Móng)
      assertIncludes(vm.section4.structuralType.vi.toLowerCase(), 'bê tông cốt thép', 'section4.structuralType');
      assertIncludes(vm.section4.structuralForm.vi, 'Nhà phố thương mại', 'section4.structuralForm');
      assertIncludes(vm.section4.foundationType.vi, 'Móng cọc khoan nhồi (CIP)', 'section4.foundationType');
      assertEqual(vm.section4.pileSize.vi, 'D400 mm', 'section4.pileSize');
      assertIncludes(vm.section4.footingDensitySpacing.vi, '4 cọc/đài', 'section4.footingDensitySpacing density');
      assertIncludes(vm.section4.footingDensitySpacing.vi, '4.2 m', 'section4.footingDensitySpacing spacing');
      assertIncludes(vm.section4.foundationDepth.vi, '14.5 m', 'section4.foundationDepth');
      assertIncludes(vm.section4.foundationEvidence.vi, 'CAT 3', 'section4.foundationEvidence');
      assertIncludes(vm.section4.adjacentBuildings.vi, 'Chung tường', 'section4.adjacentBuildings left');
      assertIncludes(vm.section4.adjacentBuildings.vi, 'Hẻm 3m', 'section4.adjacentBuildings right');
      assertIncludes(vm.section4.adjacentBuildings.vi, 'Khe lún 5cm', 'section4.adjacentBuildings back');
      assertIncludes(vm.section4.remarks.vi, 'Chủ hộ xác nhận móng cọc khoan nhồi sâu 14.5m', 'section4.remarks');
    });

    // --- TC-S3: STEP 3 FULL MUTATION ---
    await runTest('TC-S3', 'Step 3: Thay đổi 100% Mặt bằng tầng, Vùng Z-xx, Cấu kiện E-xx & Ghim khuyết tật D-xx (Chương VI & Phụ lục 2)', async () => {
      const { reportId } = await createIsolatedResidentialReport('S3');
      const step3Updates = {
        floors: [
          {
            floorId: 'FL-01',
            floorName: 'Tầng 1 (Trệt)',
            floorLevel: 1,
            cadSketchUrl: '/uploads/test/s3_cad_fl1.jpg',
            zones: [
              {
                zoneCode: 'Z-01',
                floorName: 'Tầng 1 (Trệt)',
                roomName: 'Phòng khách chính',
                componentType: 'WALL',
                wallMaterial: 'Tường gạch xây',
                ctxPhotoUrl: '/uploads/test/s3_z01_ctx.jpg',
                pinX: 25.5,
                pinY: 40.2,
                notes: 'Vùng tường trục A-B có vết nứt xiên',
                defects: [
                  {
                    defectCode: 'D-01',
                    screeningCategory: 'CRACK',
                    defectType: 'DIAGONAL_CRACK',
                    crackDirection: 'DIAGONAL',
                    widthMaxMm: 3.5,
                    lengthMm: 1850,
                    activityState: 'ACTIVE',
                    structuralSignificanceE2: 1,
                    materialDegradationE4: 1,
                    hasScaleCard: true,
                    isStructuralCritical: false,
                    pinX: 28.0,
                    pinY: 42.0,
                    cuPhotoUrl: '/uploads/test/s3_d01_cu.jpg',
                    notes: 'Vết nứt xiên tường gạch phòng khách rộng 3.5mm',
                  },
                ],
              },
            ],
            structuralElements: [
              {
                elementCode: 'E-01',
                zoneCode: 'E-01',
                floorName: 'Tầng 1 (Trệt)',
                roomName: 'Trục cột C2',
                elementType: 'COLUMN',
                componentType: 'COLUMN',
                ctxPhotoUrl: '/uploads/test/s3_e01_ctx.jpg',
                pinX: 60.0,
                pinY: 50.0,
                notes: 'Cột chịu lực C2 có vết nứt ngang',
                defects: [
                  {
                    defectCode: 'D-02',
                    screeningCategory: 'CRACK',
                    defectType: 'STRUCTURAL_CRACK',
                    crackDirection: 'HORIZONTAL',
                    widthMaxMm: 6.2,
                    lengthMm: 450,
                    activityState: 'ACTIVE',
                    structuralSignificanceE2: 3,
                    materialDegradationE4: 2,
                    hasScaleCard: true,
                    isStructuralCritical: true,
                    pinX: 61.5,
                    pinY: 52.0,
                    cuPhotoUrl: '/uploads/test/s3_d02_cu.jpg',
                    notes: 'Nứt kết cấu cột C2 rộng 6.2mm',
                  },
                ],
              },
            ],
          },
          {
            floorId: 'FL-02',
            floorName: 'Tầng 2 (Lầu 1)',
            floorLevel: 2,
            cadSketchUrl: '/uploads/test/s3_cad_fl2.jpg',
            zones: [
              {
                zoneCode: 'Z-02',
                floorName: 'Tầng 2 (Lầu 1)',
                roomName: 'Phòng ngủ trước',
                componentType: 'CEILING',
                ctxPhotoUrl: '/uploads/test/s3_z02_ctx.jpg',
                pinX: 45.0,
                pinY: 30.0,
                defects: [
                  {
                    defectCode: 'D-03',
                    screeningCategory: 'WATER_LEAK',
                    defectType: 'SEEPAGE',
                    widthMaxMm: 0.5,
                    lengthMm: 900,
                    activityState: 'STABILIZED',
                    structuralSignificanceE2: 0,
                    materialDegradationE4: 1,
                    hasScaleCard: true,
                    isStructuralCritical: false,
                    pinX: 46.0,
                    pinY: 31.0,
                    cuPhotoUrl: '/uploads/test/s3_d03_cu.jpg',
                    notes: 'Thấm ố trần ban công tầng 2',
                  },
                ],
              },
            ],
          },
        ],
      };

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-S3: Thay đổi toàn bộ thông tin Bước 3 (T층, Z, E, D)',
        updates: step3Updates,
        diffPayload: [{ field: 'floors', label: 'Mặt bằng tầng', oldValue: [], newValue: step3Updates.floors }],
      });

      await AuditReviewService.approveReport(reportId, adminId);

      const reportForRender = await loadApprovedReportForRender(reportId);
      const vm = ReportV2ViewModelMapper.buildViewModel(reportForRender);

      assertEqual(vm.appendix2.length, 2, 'appendix2 floor count');
      assertEqual(vm.appendix2[0].floorName.vi, 'Tầng 1 (Trệt)', 'appendix2[0] title');
      assertEqual(vm.appendix2[1].floorName.vi, 'Tầng 2 (Lầu 1)', 'appendix2[1] title');

      const allDefectsFl1 = vm.appendix2[0].defectSummaryRows;
      const allDefectsFl2 = vm.appendix2[1].defectSummaryRows;
      assertEqual(allDefectsFl1.length, 2, 'Floor 1 defects count (D-01 + D-02)');
      assertEqual(allDefectsFl2.length, 1, 'Floor 2 defects count (D-03)');
      assertIncludes(allDefectsFl1[0].widthMm, '3.5', 'D-01 widthMm');
      assertIncludes(allDefectsFl1[0].lengthM, '1.85', 'D-01 lengthM');
      assertIncludes(allDefectsFl1[1].widthMm, '6.2', 'D-02 widthMm');
    });

    // --- TC-S4: STEP 4 FULL MUTATION ---
    await runTest('TC-S4', 'Step 4: Thay đổi 100% Bảng phân loại hư hỏng Burland 1977 (Chương VII)', async () => {
      const { reportId } = await createIsolatedResidentialReport('S4');
      const step4Updates = {
        floors: [
          {
            floorName: 'Tầng 1',
            zones: [
              {
                zoneCode: 'Z-01',
                roomName: 'Phòng khách',
                componentType: 'WALL',
                defects: [
                  { defectCode: 'D-01', widthMaxMm: 12.0, lengthMm: 2000 },
                  { defectCode: 'D-02', widthMaxMm: 2.5, lengthMm: 1200 },
                  { defectCode: 'D-03', widthMaxMm: 2.0, lengthMm: 1000 },
                ],
              },
            ],
          },
        ],
        burlandSummary: {
          localMaxGrade: 3,
          predominantGrade: 2,
          structuralFlagLevel: 'MODERATE',
          governingZoneCode: 'Z-01',
          representativeness: 'Cục bộ tại tường trục B',
          needStructuralEngineerReview: true,
          evaluationNotes: 'Ghi nhận vết nứt cực đại 12mm (Cấp 3) và phổ biến 2-2.5mm (Cấp 2)',
          engineerReviewNotes: 'Đề nghị kỹ sư kết cấu kiểm tra chuyên sâu vùng Z-01',
        },
      };

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-S4: Thay đổi toàn bộ thông tin Bước 4 Burland',
        updates: step4Updates,
        diffPayload: [{ field: 'burlandSummary', label: 'Burland Summary', oldValue: {}, newValue: step4Updates.burlandSummary }],
      });

      await AuditReviewService.approveReport(reportId, adminId);

      const reportForRender = await loadApprovedReportForRender(reportId);
      const vm = ReportV2ViewModelMapper.buildViewModel(reportForRender);

      assertIncludes(vm.section7.localMaxGrade.vi, 'Cấp 3', 'section7.localMaxGrade.vi');
      assertIncludes(vm.section7.predominantGrade.vi, 'Cấp 2', 'section7.predominantGrade.vi');
    });

    // --- TC-S5: STEP 5 FULL MUTATION ---
    await runTest('TC-S5', 'Step 5: Thay đổi 100% Độ nghiêng, Lún lệch, Độ võng dầm, Ngoại quan bất thường & Ảnh P-05, P-06, P-07 (Chương V & Phụ lục 1)', async () => {
      const { reportId } = await createIsolatedResidentialReport('S5');
      const step5Updates = {
        settlementTilt: {
          diffSettlement: {
            level: 2,
            position: 'Chân tường biên trục A giáp nhà số 12',
            notes: 'Nứt tách chân tường và nền sân rộng 8mm',
            photoCode: 'P-06',
            photos: [{ url: '/uploads/test/s5_p06_settle.jpg', photoCode: 'P-06' }],
          },
          buildingTilt: {
            level: 2,
            xPermille: 4.25,
            yPermille: -2.75,
            direction: 'Nghiêng về hướng Đông Nam (phía hẻm phụ)',
            notes: 'Đo bằng máy kinh vỹ Laser Bosch tại 2 góc mặt tiền',
            photoCode: 'P-05',
            photos: [{ url: '/uploads/test/s5_p05_tilt.jpg', photoCode: 'P-05' }],
          },
          beamSagging: {
            level: 2,
            sagMm: 14.5,
            position: 'Dầm chính D1 nhịp 5.5m tầng 2',
            description: 'Võng nhịp giữa dầm D1 quan sát rõ và đo bằng thước laser',
          },
          abnormalCase: {
            hasAbnormal: true,
            description: 'Tường rào cổng trước có hiện tượng xô lệch nhẹ 15mm',
            notes: 'Tường rào cổng trước có hiện tượng xô lệch nhẹ 15mm',
            photoCode: 'P-07',
            photos: [{ url: '/uploads/test/s5_p07_anomaly.jpg', photoCode: 'P-07' }],
          },
          dataSource: ['Đo Laser hiện trường', 'Quan sát trực quan'],
          reliability: 'HIGH',
          needAdditionalMonitoring: {
            required: true,
            notes: 'Cần gắn mốc đo lún thủy chuẩn và gương phản xạ toàn đạc tại mặt tiền',
          },
        },
      };

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-S5: Thay đổi toàn bộ thông tin Bước 5 Lún Nghiêng Võng',
        updates: step5Updates,
        diffPayload: [{ field: 'settlementTilt', label: 'Lún nghiêng võng', oldValue: {}, newValue: step5Updates.settlementTilt }],
      });

      await AuditReviewService.approveReport(reportId, adminId);

      // Kiểm tra giá trị lưu trong bảng SQL deformation_assessments (không bị chia 10 sai đơn vị)
      const defDbRes = await Database.query<{ tilt_angle_x: number; tilt_angle_y: number; beam_deflection_mm: number }>(
        `SELECT tilt_angle_x, tilt_angle_y, beam_deflection_mm FROM deformation_assessments WHERE report_id = $1;`,
        [reportId]
      );
      assertEqual(Number(defDbRes.rows[0].tilt_angle_x), 4.25, 'SQL deformation_assessments.tilt_angle_x (4.25 permille)');
      assertEqual(Number(defDbRes.rows[0].tilt_angle_y), -2.75, 'SQL deformation_assessments.tilt_angle_y (-2.75 permille)');
      assertEqual(Number(defDbRes.rows[0].beam_deflection_mm), 14.5, 'SQL deformation_assessments.beam_deflection_mm');

      const reportForRender = await loadApprovedReportForRender(reportId);
      const vm = ReportV2ViewModelMapper.buildViewModel(reportForRender);

      assertEqual(vm.section5.differentialSettlement.observed, true, 'section5.differentialSettlement.observed');
      assertIncludes(vm.section5.differentialSettlement.location.vi, 'Chân tường biên trục A', 'diffSettlement position');
      assertIncludes(vm.section5.differentialSettlement.location.vi, 'Nứt tách chân tường và nền sân rộng 8mm', 'diffSettlement notes');

      assertEqual(vm.section5.buildingInclination.observed, true, 'section5.buildingInclination.observed');
      assertIncludes(vm.section5.buildingInclination.measured, '4.250‰', 'tiltX measured');
      assertIncludes(vm.section5.buildingInclination.measured, '-2.750‰', 'tiltY measured');
      assertIncludes(vm.section5.buildingInclination.measured, 'Đông Nam', 'tilt direction');
      assertIncludes(vm.section5.buildingInclination.location.vi, 'Mức 2/4', 'tilt level');
      assertIncludes(vm.section5.buildingInclination.location.vi, 'Đo bằng máy kinh vỹ Laser Bosch', 'tilt notes');

      assertEqual(vm.section5.beamDeflection.observed, true, 'section5.beamDeflection.observed');
      assertIncludes(vm.section5.beamDeflection.measured, '14.5 mm', 'beamDeflection measured');
      assertIncludes(vm.section5.beamDeflection.location.vi, 'Dầm chính D1 nhịp 5.5m tầng 2', 'beamDeflection position');
      assertIncludes(vm.section5.beamDeflection.location.vi, 'Võng nhịp giữa dầm D1', 'beamDeflection description');

      assertIncludes(vm.section5.remarks.vi, 'Tường rào cổng trước có hiện tượng xô lệch nhẹ 15mm', 'abnormalCase description in remarks');
      assertIncludes(vm.section5.remarks.vi, 'Cần gắn mốc đo lún thủy chuẩn', 'needAdditionalMonitoring notes in remarks');
      assertEqual(vm.section5.tiltPhoto?.url, '/uploads/test/s5_p05_tilt.jpg', 'section5.tiltPhoto.url');
      assertEqual(vm.section5.settlementPhoto?.url, '/uploads/test/s5_p06_settle.jpg', 'section5.settlementPhoto.url');

      const p05 = vm.appendix1.find((p) => p.photoCode === 'P-05');
      const p06 = vm.appendix1.find((p) => p.photoCode === 'P-06');
      const p07 = vm.appendix1.find((p) => p.photoCode === 'P-07');
      assertEqual(p05?.url, '/uploads/test/s5_p05_tilt.jpg', 'Appendix 1 P-05 url');
      assertEqual(p06?.url, '/uploads/test/s5_p06_settle.jpg', 'Appendix 1 P-06 url');
      assertEqual(p07?.url, '/uploads/test/s5_p07_anomaly.jpg', 'Appendix 1 P-07 url');
    });

    // --- TC-S6: STEP 6 FULL MUTATION ---
    await runTest('TC-S6', 'Step 6: Thay đổi 100% Phạm vi khảo sát, Hạn chế tiếp cận, Biến động GIS & Kích thước thửa đất (Chương II, IX & Phụ lục 4)', async () => {
      const { reportId } = await createIsolatedResidentialReport('S6');
      const step6Updates = {
        frontageWidth: 6.8,
        lotDepth: 19.5,
        landAreaM2: 132.6,
        surveyScope: {
          externalFront: true,
          surveyedFloors: ['Tầng 1', 'Tầng 2'],
          roofTerrace: false,
          basement: false,
          backyardOuthouse: true,
        },
        accessLimitation: {
          type: 'PARTIAL',
          isRestricted: true,
          mainReason: 'Phòng kho tầng 3 khóa cửa do người thuê đi vắng',
          restrictedAreas: ['Mái / Sân thượng', 'Phòng kho tầng 3'],
          restrictedFloorLevels: ['Tầng 3', 'Sân thượng'],
          notes: 'Chủ nhà hẹn mở cửa kiểm tra bổ sung nếu cần thiết',
        },
        gisMutationConfirmed: {
          isMutated: true,
          type: 'MERGE',
          details: {
            selectedMergeCodes: ['THUA-101', 'THUA-102'],
            mergeBuildingAreaM2: 115.0,
            mergeResidualAreaM2: 17.6,
          },
        },
      };

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-S6: Thay đổi toàn bộ thông tin Bước 6 Phạm vi & GIS',
        updates: step6Updates,
        diffPayload: [{ field: 'step6', label: 'Bước 6', oldValue: {}, newValue: step6Updates }],
      });

      await AuditReviewService.approveReport(reportId, adminId);

      const reportForRender = await loadApprovedReportForRender(reportId);
      const vm = ReportV2ViewModelMapper.buildViewModel(reportForRender);

      assertEqual(vm.section2.landAreaM2, '132.6', 'section2.landAreaM2');
      assertIncludes(vm.section2.mainDimensions.vi, 'Mặt tiền 6.8 m × Chiều sâu 19.5 m', 'section2.mainDimensions.vi');
      assertIncludes(vm.section2.gisMergedInfo?.vi, 'THUA-101, THUA-102', 'section2.gisMergedInfo merge codes');
      assertIncludes(vm.section2.gisMergedInfo?.vi, '115', 'section2.gisMergedInfo building area');

      const limVi = vm.section9.limitations.map((l) => l.vi).join(' | ');
      assertIncludes(limVi, 'Mái / Sân thượng', 'section9.limitations restrictedAreas');
      assertIncludes(limVi, 'Phòng kho tầng 3', 'section9.limitations restrictedAreas 2');
      assertIncludes(limVi, 'Tầng 3, Sân thượng', 'section9.limitations restrictedFloorLevels');
      assertIncludes(limVi, 'Chủ nhà hẹn mở cửa kiểm tra bổ sung', 'section9.limitations notes');
      const roofArea = vm.appendix4.accessAreas.find((a) => a.area.vi.includes('Mái'));
      assertEqual(roofArea?.notAccessed, true, 'appendix4 roofTerrace notAccessed');
    });

    // --- TC-S7: STEP 7 FULL MUTATION ---
    await runTest('TC-S7', 'Step 7: Thay đổi 100% Chấm điểm ECS (E1..E6) & Chỉ số tổn thương VI (V1..V6) (Chương VIII)', async () => {
      const { reportId } = await createIsolatedResidentialReport('S7');
      const step7Updates = {
        ecs: {
          e1: 2,
          e2: 2,
          e3: 1,
          e4: 2,
          e5: 1,
          e6: 1,
          totalEcs: 9,
          ecsClass: 'MEDIUM',
          engineeringJudgement: {
            action: 'UPGRADE',
            reason: 'Nâng cấp theo dõi do tường chịu lực có vết nứt xiên',
          },
        },
        vi: {
          v1: 3,
          v2: 3,
          v3: 3,
          v4: 2,
          v5: 2,
          v6: 2,
          totalVi: 15,
          viAvg: 2.5,
          viClass: 'MEDIUM',
          engineeringJudgement: {
            action: 'CUSTOM_OVERRIDE',
            reason: 'Chốt điểm VI = 2.50 (Cấp V2) sau khi rà soát kết cấu',
          },
        },
        gateDecision: {
          decision: 'ALLOW',
          reason: 'Đủ điều kiện phê duyệt hồ sơ Phase 1',
        },
      };

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-S7: Thay đổi toàn bộ điểm số Bước 7 (ECS & VI)',
        updates: step7Updates,
        diffPayload: [{ field: 'step7', label: 'Bước 7', oldValue: {}, newValue: step7Updates }],
      });

      await AuditReviewService.approveReport(reportId, adminId);

      const reportForRender = await loadApprovedReportForRender(reportId);
      const vm = ReportV2ViewModelMapper.buildViewModel(reportForRender);

      assertEqual(vm.section8.ecs.totalScore, 9, 'section8.ecs.totalScore');
      assertIncludes(vm.section8.ecs.classGrade.en, 'Medium', 'section8.ecs.classGrade');
      assertEqual(vm.section8.ecs.engineeringJudgement?.isApplied, true, 'ecs.engineeringJudgement.isApplied');
      assertIncludes(vm.section8.ecs.engineeringJudgement?.reason, 'Nâng cấp theo dõi', 'ecs.engineeringJudgement.reason');

      assertEqual(vm.section8.vi.totalScore, 15, 'section8.vi.totalScore');
      assertEqual(vm.section8.vi.averageScore, 2.5, 'section8.vi.averageScore');
      assertEqual(vm.section8.vi.vCode, 'V2', 'section8.vi.vCode');
      assertEqual(vm.section8.vi.engineeringJudgement?.isApplied, true, 'vi.engineeringJudgement.isApplied');
    });

    // --- TC-S8: STEP 8 FULL MUTATION ---
    await runTest('TC-S8', 'Step 8: Thay đổi 100% Kết luận tổng hợp, Rủi ro trọng yếu, Kiến nghị kỹ thuật, Cấp tác động I & Ma trận BRA (Chương VIII & IX)', async () => {
      const { reportId } = await createIsolatedResidentialReport('S8');
      const step8Updates = {
        executiveSummary: {
          braStatus: 'HIGH',
          constructionImpactStatus: 'I3 (Tác động trung bình)',
          impactOverrideReason: 'Công trình nằm sát vùng chuyển tiếp hố đào ga ngầm',
          summaryConclusions: 'Công trình có kết cấu khung BTCT ổn định nhưng cần lưu ý vùng tường Z-01',
          keyRisksDefectsText: 'Nguy cơ phát triển vết nứt xiên tường biên khi hạ mực nước ngầm',
          specificRecommendationsText: 'Lắp đặt 03 mốc quan trắc lún và đo kiểm tra định kỳ 2 lần/tuần',
        },
        summaryConclusions: 'Công trình có kết cấu khung BTCT ổn định nhưng cần lưu ý vùng tường Z-01',
        keyRisksDefectsText: 'Nguy cơ phát triển vết nứt xiên tường biên khi hạ mực nước ngầm',
        engineeringRecommendations: 'Lắp đặt 03 mốc quan trắc lún và đo kiểm tra định kỳ 2 lần/tuần',
      };

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-S8: Thay đổi toàn bộ thông tin Bước 8 (BRA, Impact, Kết luận, Kiến nghị)',
        updates: step8Updates,
        diffPayload: [{ field: 'step8', label: 'Bước 8', oldValue: {}, newValue: step8Updates }],
      });

      await AuditReviewService.approveReport(reportId, adminId);

      const reportForRender = await loadApprovedReportForRender(reportId);
      const vm = ReportV2ViewModelMapper.buildViewModel(reportForRender);

      assertEqual(vm.section8.impact.code, 'I3', 'section8.impact.code');
      assertEqual(vm.section8.braMatrix.iCode, 'I3', 'section8.braMatrix.iCode');
      assertEqual(vm.section8.braMatrix.finalRiskLevel.vi, 'Rủi ro cao', 'section8.braMatrix.finalRiskLevel.vi');
      assertIncludes(vm.section9.overallRisk.vi, 'Rủi ro cao', 'section9.overallRisk.vi');

      const conclusionsVi = vm.section9.conclusions.map((c) => c.vi).join(' | ');
      assertIncludes(conclusionsVi, 'Công trình có kết cấu khung BTCT ổn định nhưng cần lưu ý vùng tường Z-01', 'section9.conclusions summaryConclusions');
      assertIncludes(conclusionsVi, 'Nguy cơ phát triển vết nứt xiên tường biên', 'section9.conclusions keyRisksDefectsText');

      const recsVi = vm.section9.recommendations.map((r) => r.vi).join(' | ');
      assertIncludes(recsVi, 'Lắp đặt 03 mốc quan trắc lún và đo kiểm tra định kỳ 2 lần/tuần', 'section9.recommendations specificRecommendationsText');
    });

    // --- TC-S9: STEP 9 FULL MUTATION ---
    await runTest('TC-S9', 'Step 9: Thay đổi 100% Ngày khảo sát, Chữ ký 3 bên, Tên/SĐT KSV, Người chứng kiến & Biên bản hiện trường (Bìa, Chương I, IX & Phụ lục 3)', async () => {
      const { reportId } = await createIsolatedResidentialReport('S9');
      const step9Updates = {
        surveyDate: '2026-03-20T14:30:00.000Z',
        surveyorName: 'KS. Trần Quốc Bảo',
        surveyorPhone: '0988776655',
        surveyorSignatureUrl: '/uploads/test/s9_surveyor_sig.png',
        ownerName: 'Lê Thị Minh Nguyệt',
        ownerFeedback: 'Gia đình hoàn toàn đồng ý với biên bản đo đạc hiện trạng ngày 20/03/2026',
        signatures: {
          surveyorName: 'KS. Trần Quốc Bảo',
          surveyorPhone: '0988776655',
          surveyorSignatureUrl: '/uploads/test/s9_surveyor_sig.png',
          ownerName: 'Lê Thị Minh Nguyệt',
          ownerPhone: '0911223344',
          ownerSignatureUrl: '/uploads/test/s9_owner_sig.png',
          ownerFeedback: 'Gia đình hoàn toàn đồng ý với biên bản đo đạc hiện trạng ngày 20/03/2026',
          witnessName: 'Ông Phạm Văn Chính',
          witnessRole: 'Tổ trưởng Tổ dân phố 14',
          supervisionConsultant: {
            fullName: 'KS. Hoàng Minh Tuấn',
            title: 'Tư vấn giám sát hiện trường',
          },
          workingMinutesPhotos: [
            '/uploads/test/s9_minutes_p1.jpg',
            '/uploads/test/s9_minutes_p2.jpg',
          ],
        },
      };

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-S9: Thay đổi toàn bộ thông tin Bước 9 (Chữ ký & Biên bản)',
        updates: step9Updates,
        diffPayload: [{ field: 'step9', label: 'Bước 9', oldValue: {}, newValue: step9Updates }],
      });

      await AuditReviewService.approveReport(reportId, adminId);

      const reportForRender = await loadApprovedReportForRender(reportId);
      const vm = ReportV2ViewModelMapper.buildViewModel(reportForRender);

      assertEqual(vm.metadata.surveyId, 'P-6655', 'metadata.surveyId from edited surveyorPhone');
      assertIncludes(vm.metadata.surveyDateFormatted, '20/03/2026', 'metadata.surveyDateFormatted');
      assertEqual(vm.signatures3Party[0].fullName, 'KS. Trần Quốc Bảo', 'signatures3Party[0].fullName');
      assertEqual(vm.signatures3Party[0].signatureUrl, '/uploads/test/s9_surveyor_sig.png', 'signatures3Party[0].signatureUrl');

      assertIncludes(vm.section9.witnessNarrative.vi, 'Lê Thị Minh Nguyệt', 'section9.witnessNarrative ownerName');
      assertIncludes(vm.section9.witnessNarrative.vi, 'Gia đình hoàn toàn đồng ý với biên bản đo đạc hiện trạng ngày 20/03/2026', 'section9.witnessNarrative ownerFeedback');

      assertIncludes(vm.appendix3.ownerRepresentative.vi, 'Lê Thị Minh Nguyệt', 'appendix3.ownerRepresentative');
      assertIncludes(vm.appendix3.localAuthority.vi, 'Ông Phạm Văn Chính - Tổ trưởng Tổ dân phố 14', 'appendix3.localAuthority');
      assertIncludes(vm.appendix3.supervisionConsultant.vi, 'KS. Hoàng Minh Tuấn - Tư vấn giám sát hiện trường', 'appendix3.supervisionConsultant');
      assertIncludes(vm.appendix3.surveyUnit.vi, 'KS. Trần Quốc Bảo', 'appendix3.surveyUnit');
      assertEqual(vm.appendix3.fieldComments.vi, 'Gia đình hoàn toàn đồng ý với biên bản đo đạc hiện trạng ngày 20/03/2026', 'appendix3.fieldComments');
      assertEqual(vm.appendix3.signedRecordPages.length, 2, 'appendix3.signedRecordPages count');
      assertEqual(vm.appendix3.signedRecordPages[0].url, '/uploads/test/s9_minutes_p1.jpg', 'appendix3.signedRecordPages[0].url');
    });

    // =========================================================================
    // TEST SUITE 2: THAY ĐỔI MỌI THÔNG TIN TRONG TOÀN BỘ FORM (ALL 9 STEPS) + BẤT BIẾN SNAPSHOT SAU APPROVED
    // =========================================================================
    await runTest('TC-FULL-RESIDENTIAL', 'Full Form Mutation (Tất cả 9 Bước đồng thời) + Kiểm chứng Bất biến 100% sau APPROVED (kể cả khi DB live bị sửa sau duyệt)', async () => {
      const { reportId, parcelId } = await createIsolatedResidentialReport('FULL');

      const fullFormUpdates = {
        // Step 1
        projectParcelCode: 'M2-Z9-FULL-777',
        officialCadastralCode: 'THUA-777-TO-99',
        houseNumber: '777B',
        street: 'Nguyễn Thị Minh Khai',
        ward: 'Phường 6',
        district: 'Quận 3',
        buildingName: 'Tòa nhà văn phòng',
        usageFunction: 'Tòa nhà văn phòng',
        ownerName: 'Công Ty TNHH Đầu Tư Minh Khai',
        ownerPhone: '0909888777',
        buildingType: 'COMMERCIAL',
        objectGroup: 'CRITICAL',
        aboveFloors: 6,
        undergroundFloors: 1,
        constructionYear: 2020,
        isEstimatedYear: false,
        constructionAreaM2: 720.0,
        buildingHeightM: 22.8,
        typicalStoreyHeightM: 3.8,
        surveyCaseType: 'NORMAL',
        gpsCoords: { lat: 10.779999, lng: 106.689999, accuracy: 1.5 },
        photoP01: { url: '/uploads/test/full_p01.jpg', notApplicable: false },
        photoP02: { url: '/uploads/test/full_p02.jpg', notApplicable: false },
        photoP03: {
          url: '/uploads/test/full_p03_1.jpg',
          tag: 'Bên hông trái',
          notApplicable: false,
          additionalPhotos: [{ url: '/uploads/test/full_p03_2.jpg', tag: 'Phía sau' }],
        },
        photoP04: { url: '/uploads/test/full_p04.jpg', notApplicable: false },

        // Step 2
        structureSystem: 'Khung BTCT kết hợp vách cứng',
        structuralForm: 'Nhà phố thương mại / Văn phòng dịch vụ',
        foundationType: 'Móng cọc ép bê tông cốt thép (PC)',
        foundationCatScore: 3,
        foundationDepthM: 16.0,
        foundationDensity: '6 cọc/đài',
        foundationSpacingM: 4.5,
        pileDimensionMm: '250 × 250 mm',
        foundationNotes: 'Móng cọc ép BTCT 250x250mm sâu 16m có nhật ký ép cọc',
        manualMetroDistanceM: 14.0,
        clearanceOffsetDistance: 7.5,
        tunnelCrownDepthM: 24.0,
        adjacentBuildings: {
          left: { type: 'Nhà phố', floors: 5, contact: 'Khe lún 3cm', notes: 'Tốt' },
          right: { type: 'Nhà phố', floors: 4, contact: 'Chung tường', notes: 'Ổn định' },
          back: { type: 'Hẻm sau', floors: 0, contact: 'Độc lập', notes: 'Hẻm 4m' },
        },
        historyInterview: {
          renovationLoad: 1,
          majorRepair: 1,
          pastSettlement: 0,
          neighborDamage: 1,
          fireFloodIncident: 0,
          usageStatus: 'Đầy đủ',
          continuousOperation247: true,
          sensitiveEquipment: {
            has: true,
            description: 'Phòng Server trung tâm dữ liệu tầng 3 hoạt động 24/7',
          },
        },

        // Step 3
        floors: [
          {
            floorId: 'FL-1',
            floorName: 'Tầng 1',
            floorLevel: 1,
            cadSketchUrl: '/uploads/test/full_cad_f1.jpg',
            zones: [
              {
                zoneCode: 'Z-01',
                floorName: 'Tầng 1',
                roomName: 'Sảnh lễ tân',
                componentType: 'WALL',
                ctxPhotoUrl: '/uploads/test/full_z01.jpg',
                defects: [
                  {
                    defectCode: 'D-01',
                    screeningCategory: 'CRACK',
                    defectType: 'PLASTER_CRACK',
                    widthMaxMm: 1.8,
                    lengthMm: 1500,
                    activityState: 'STABILIZED',
                    structuralSignificanceE2: 1,
                    materialDegradationE4: 1,
                    hasScaleCard: true,
                    isStructuralCritical: false,
                    cuPhotoUrl: '/uploads/test/full_d01.jpg',
                    notes: 'Nứt vữa sảnh lễ tân rộng 1.8mm',
                  },
                ],
              },
            ],
          },
        ],

        // Step 4
        burlandSummary: {
          localMaxGrade: 2,
          predominantGrade: 2,
          structuralFlagLevel: 'LOW',
          governingZoneCode: 'Z-01',
        },

        // Step 5
        settlementTilt: {
          diffSettlement: {
            level: 1,
            position: 'Bậc tam cấp mặt tiền',
            notes: 'Lún nhẹ bậc tam cấp 3mm',
            photoCode: 'P-06',
            photos: [{ url: '/uploads/test/full_p06.jpg', photoCode: 'P-06' }],
          },
          buildingTilt: {
            level: 1,
            xPermille: 1.8,
            yPermille: -1.2,
            direction: 'Tây Bắc',
            notes: 'Trong giới hạn cho phép TCVN',
            photoCode: 'P-05',
            photos: [{ url: '/uploads/test/full_p05.jpg', photoCode: 'P-05' }],
          },
          beamSagging: {
            level: 1,
            sagMm: 6.0,
            position: 'Dầm phụ tầng 1',
            description: 'Võng nhẹ 6mm trong giới hạn',
          },
          abnormalCase: {
            hasAbnormal: true,
            description: 'Vỉa hè trước nhà có vết rạn nhẹ',
            photos: [{ url: '/uploads/test/full_p07.jpg', photoCode: 'P-07' }],
          },
          dataSource: ['Đo Laser & Thủy chuẩn'],
          reliability: 'HIGH',
          needAdditionalMonitoring: {
            required: true,
            notes: 'Theo dõi định kỳ suốt quá trình đào TBM',
          },
        },

        // Step 6
        frontageWidth: 8.0,
        lotDepth: 15.0,
        landAreaM2: 120.0,
        surveyScope: {
          externalFront: true,
          surveyedFloors: ['Tầng 1', 'Tầng 2', 'Tầng 3', 'Tầng 4', 'Tầng 5', 'Tầng 6'],
          roofTerrace: false,
          basement: true,
          backyardOuthouse: false,
        },
        accessLimitation: {
          type: 'PARTIAL',
          isRestricted: true,
          restrictedAreas: ['Mái / Sân thượng'],
          restrictedFloorLevels: ['Tầng mái'],
          notes: 'Cửa lên mái khóa an ninh ngân hàng',
        },
        gisMutationConfirmed: {
          isMutated: true,
          type: 'MERGE',
          details: {
            selectedMergeCodes: ['THUA-777A', 'THUA-777B'],
            mergeBuildingAreaM2: 120.0,
            mergeResidualAreaM2: 0.0,
          },
        },

        // Step 7
        ecs: {
          e1: 1,
          e2: 1,
          e3: 1,
          e4: 1,
          e5: 1,
          e6: 1,
          totalEcs: 6,
          ecsClass: 'MEDIUM',
        },
        vi: {
          v1: 4,
          v2: 2,
          v3: 3,
          v4: 1,
          v5: 2,
          v6: 3,
          totalVi: 15,
          viAvg: 2.5,
          viClass: 'MEDIUM',
        },

        // Step 8
        executiveSummary: {
          braStatus: 'HIGH',
          constructionImpactStatus: 'I4 (Tác động nghiêm trọng)',
          impactOverrideReason: 'Công trình CRITICAL cách mép ga 7.5m (<10m)',
          summaryConclusions: 'Kết luận tổng thể Full Form: Tòa nhà 6 tầng + 1 hầm hiện trạng tốt, cần giám sát chặt khi đào ga',
          keyRisksDefectsText: 'Phòng Server tầng 3 nhạy cảm rung động và cự ly mép ga chỉ 7.5m',
          specificRecommendationsText: 'Lắp cảm biến đo nghiêng tự động và cảnh báo rung động thời gian thực',
        },
        summaryConclusions: 'Kết luận tổng thể Full Form: Tòa nhà 6 tầng + 1 hầm hiện trạng tốt, cần giám sát chặt khi đào ga',
        keyRisksDefectsText: 'Phòng Server tầng 3 nhạy cảm rung động và cự ly mép ga chỉ 7.5m',
        engineeringRecommendations: 'Lắp cảm biến đo nghiêng tự động và cảnh báo rung động thời gian thực',

        // Step 9
        surveyDate: '2026-04-01T09:15:00.000Z',
        surveyorName: 'KS. Vũ Quốc Dũng',
        surveyorPhone: '0977112233',
        surveyorSignatureUrl: '/uploads/test/full_surveyor_sig.png',
        ownerFeedback: 'Công ty Minh Khai xác nhận đúng 100% số liệu khảo sát hiện trạng',
        signatures: {
          surveyorName: 'KS. Vũ Quốc Dũng',
          surveyorPhone: '0977112233',
          surveyorSignatureUrl: '/uploads/test/full_surveyor_sig.png',
          ownerName: 'Công Ty TNHH Đầu Tư Minh Khai',
          ownerSignatureUrl: '/uploads/test/full_owner_sig.png',
          ownerFeedback: 'Công ty Minh Khai xác nhận đúng 100% số liệu khảo sát hiện trạng',
          witnessName: 'Bà Nguyễn Thị Thanh',
          witnessRole: 'Cán bộ Địa chính Phường 6',
          workingMinutesPhotos: ['/uploads/test/full_minutes_1.jpg'],
        },
      };

      // 1. Lưu chỉnh sửa toàn bộ Form
      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-FULL-RESIDENTIAL: Thay đổi toàn bộ 9 bước trong Form thẩm định',
        updates: fullFormUpdates,
        diffPayload: [{ field: 'fullForm', label: 'Toàn bộ Form', oldValue: 'old', newValue: 'new' }],
      });

      // 2. Phê duyệt hồ sơ (Chốt bất biến APPROVED_RELEASE Snapshot v2)
      await AuditReviewService.approveReport(reportId, adminId);

      // 3. KIỂM CHỨNG KHÓA VẬT LÝ TRÊN DB (PARCEL_LOCKED_APPROVED & SURVEY_REPORT_LOCKED_APPROVED)
      //    + GIẢ LẬP ĐỘT BIẾN TRÁI PHÉP TRÊN CÁC BẢNG PHỤ LIVE SAU KHI ĐÃ APPROVED
      let parcelLockedByTrigger = false;
      try {
        await Database.query(
          `UPDATE parcels SET owner_name = 'TÊN BỊ SỬA TRÁI PHÉP SAU DUYỆT', house_number = '9999', land_area_m2 = 9999 WHERE id = $1;`,
          [parcelId]
        );
      } catch (err: any) {
        if (String(err?.message || '').includes('PARCEL_LOCKED_APPROVED')) {
          parcelLockedByTrigger = true;
        }
      }
      assertEqual(parcelLockedByTrigger, true, 'DB Trigger PARCEL_LOCKED_APPROVED blocks direct parcel mutation after APPROVED');

      let reportLockedByTrigger = false;
      try {
        await Database.query(
          `UPDATE base_survey_reports SET summary_conclusions = 'KẾT LUẬN BỊ XÓA SAU DUYỆT', owner_remarks = 'Ý KIẾN BỊ SỬA SAU DUYỆT' WHERE id = $1;`,
          [reportId]
        );
      } catch (err: any) {
        if (String(err?.message || '').includes('SURVEY_REPORT_LOCKED_APPROVED')) {
          reportLockedByTrigger = true;
        }
      }
      assertEqual(reportLockedByTrigger, true, 'DB Trigger SURVEY_REPORT_LOCKED_APPROVED blocks direct base_survey_reports mutation after APPROVED');

      await Database.query(
        `UPDATE building_specifications SET floor_count = 99, basement_count = 9 WHERE report_id = $1;`,
        [reportId]
      );
      await Database.query(
        `UPDATE deformation_assessments SET tilt_angle_x = 99.9, tilt_angle_y = 99.9 WHERE report_id = $1;`,
        [reportId]
      );
      await Database.query(
        `UPDATE survey_scopes SET survey_coverage = 'KHONG_THE_TIEP_CAN', inaccessible_areas = 'BỊ SỬA TRÁI PHÉP' WHERE report_id = $1;`,
        [reportId]
      );

      // 4. Nạp báo cáo từ APPROVED_RELEASE Snapshot và xuất ViewModel cho Report
      const reportForRender = await loadApprovedReportForRender(reportId);
      const vm = ReportV2ViewModelMapper.buildViewModel(reportForRender);

      // 5. Kiểm tra 1:1 toàn bộ 9 bước từ ViewModel
      assertEqual(vm.metadata.surveyId, 'P-2233', 'FullForm metadata.surveyId');
      assertEqual(vm.metadata.cadastralCode, 'THUA-777-TO-99', 'FullForm metadata.cadastralCode');
      assertIncludes(vm.section1.buildingName.vi, 'Tòa nhà văn phòng', 'FullForm section1.buildingName');
      assertIncludes(vm.section1.address.vi, '777B', 'FullForm section1.address houseNumber (immune to live DB 9999)');
      assertIncludes(vm.section1.address.vi, 'Nguyễn Thị Minh Khai', 'FullForm section1.address street');
      assertEqual(vm.section1.ownerName, 'Công Ty TNHH Đầu Tư Minh Khai', 'FullForm section1.ownerName (immune to live DB mutation)');
      assertEqual(vm.section1.contactPhone, '0909888777', 'FullForm section1.contactPhone');

      assertEqual(vm.section2.storeysAbove, 6, 'FullForm section2.storeysAbove (immune to live DB 99)');
      assertEqual(vm.section2.storeysBasement, 1, 'FullForm section2.storeysBasement (immune to live DB 9)');
      assertEqual(vm.section2.landAreaM2, '120.0', 'FullForm section2.landAreaM2 (immune to live DB 9999)');
      assertEqual(vm.section2.totalFloorAreaM2, '720.0', 'FullForm section2.totalFloorAreaM2');
      assertEqual(vm.section2.maxHeightM, '22.8', 'FullForm section2.maxHeightM');
      assertIncludes(vm.section2.mainDimensions.vi, 'Mặt tiền 8.0 m × Chiều sâu 15.0 m', 'FullForm section2.mainDimensions');
      assertEqual(vm.section2.distanceToMetroAlignmentM, '14.0', 'FullForm section2.distanceToMetroAlignmentM');
      assertEqual(vm.section2.distanceToMetroEdgeM, '7.5', 'FullForm section2.distanceToMetroEdgeM');
      assertEqual(vm.section2.clearanceVerticalM, '8.0', 'FullForm section2.clearanceVerticalM (24.0 - 16.0)');
      assertIncludes(vm.section2.gisMergedInfo?.vi, 'THUA-777A, THUA-777B', 'FullForm section2.gisMergedInfo');

      assertIncludes(vm.section3.sensitiveEquipment.vi, 'Phòng Server trung tâm dữ liệu tầng 3', 'FullForm section3.sensitiveEquipment');
      assertIncludes(vm.section4.foundationType.vi, 'Móng cọc ép bê tông cốt thép (PC)', 'FullForm section4.foundationType');
      assertEqual(vm.section4.pileSize.vi, '250 × 250 mm', 'FullForm section4.pileSize');
      assertIncludes(vm.section4.foundationDepth.vi, '16.0 m', 'FullForm section4.foundationDepth');
      assertIncludes(vm.section4.remarks.vi, 'Móng cọc ép BTCT 250x250mm sâu 16m', 'FullForm section4.remarks');

      assertIncludes(vm.section5.buildingInclination.measured, '1.800‰', 'FullForm section5 tiltX (immune to live DB 99.9)');
      assertIncludes(vm.section5.buildingInclination.measured, '-1.200‰', 'FullForm section5 tiltY');
      assertIncludes(vm.section5.differentialSettlement.location.vi, 'Lún nhẹ bậc tam cấp 3mm', 'FullForm section5 diffSettlement');
      assertIncludes(vm.section5.beamDeflection.measured, '6 mm', 'FullForm section5 beamDeflection');
      assertIncludes(vm.section5.remarks.vi, 'Vỉa hè trước nhà có vết rạn nhẹ', 'FullForm section5 abnormalCase');

      assertEqual(vm.appendix2.length, 1, 'FullForm appendix2 floors');
      assertIncludes(vm.appendix2[0].defectSummaryRows[0].widthMm, '1.8', 'FullForm defect D-01 widthMm');
      assertIncludes(vm.section7.localMaxGrade.vi, 'Cấp 2', 'FullForm section7 localMaxGrade');

      assertEqual(vm.section8.ecs.totalScore, 6, 'FullForm section8.ecs.totalScore');
      assertEqual(vm.section8.vi.totalScore, 15, 'FullForm section8.vi.totalScore');
      assertEqual(vm.section8.impact.code, 'I4', 'FullForm section8.impact.code');
      assertEqual(vm.section8.braMatrix.finalRiskLevel.vi, 'Rủi ro cao', 'FullForm section8.braMatrix.finalRiskLevel.vi');

      const fullConclusionsVi = vm.section9.conclusions.map((c) => c.vi).join(' | ');
      assertIncludes(fullConclusionsVi, 'Kết luận tổng thể Full Form', 'FullForm section9 conclusions (immune to live DB mutation)');
      assertIncludes(fullConclusionsVi, 'Phòng Server tầng 3 nhạy cảm rung động', 'FullForm section9 keyRisks');
      const fullRecsVi = vm.section9.recommendations.map((r) => r.vi).join(' | ');
      assertIncludes(fullRecsVi, 'Lắp cảm biến đo nghiêng tự động', 'FullForm section9 recommendations');
      assertIncludes(vm.section9.witnessNarrative.vi, 'Công ty Minh Khai xác nhận đúng 100%', 'FullForm section9 witnessNarrative');
      assertIncludes(vm.appendix3.localAuthority.vi, 'Bà Nguyễn Thị Thanh - Cán bộ Địa chính Phường 6', 'FullForm appendix3 localAuthority');
      assertEqual(vm.appendix1.length, 8, 'FullForm appendix1 total photos (P01, P02, 2xP03, P04, P05, P06, P07)');
    });

    // =========================================================================
    // TEST SUITE 3: THAY ĐỔI MỌI THÔNG TIN TRONG FORM CĂN HỘ CON CHUNG CƯ (CONDO UNIT FULL MUTATION)
    // =========================================================================
    await runTest('TC-FULL-CONDO-UNIT', 'Condo Unit Full Form Mutation: Thay đổi 100% thông tin Căn hộ con -> Approve -> Handover sang CondoUnitReportGenerator', async () => {
      const { parcelId } = await createIsolatedResidentialReport('CONDO-M');

      const uRes = await Database.query<{ id: string }>(
        `INSERT INTO building_units (
           parcel_id, unit_code, display_code, floor_number,
           resident_status, owner_name, owner_phone, owner_id_card, status
         ) VALUES (
           $1, 'A-08.05', 'A-08.05', 8,
           'CHỦ_HỘ_Ở', 'Chủ Căn Hộ Cũ', '0901112222', '079000000001', 'SUBMITTED'
         ) RETURNING id;`,
        [parcelId]
      );
      const unitId = uRes.rows[0].id;
      createdUnitIds.push(unitId);

      const rRes = await Database.query<{ id: string }>(
        `INSERT INTO base_survey_reports (
           parcel_id, unit_id, report_code, surveyor_id, status, report_type,
           survey_date, summary_conclusions, engineering_recommendations, owner_remarks,
           survey_data_json
         ) VALUES (
           $1, $2, $3, $4, 'UNDER_REVIEW', 'CONDO_UNIT',
           '2026-02-10T09:00:00.000Z', 'Kết luận căn hộ cũ', 'Kiến nghị căn hộ cũ', 'Ý kiến căn hộ cũ',
           $5::jsonb
         ) RETURNING id;`,
        [
          parcelId,
          unitId,
          `CONDO-TEST-${Date.now().toString().slice(-4)}`,
          sampleSurveyorId,
          JSON.stringify({
            unitCode: 'A-08.05',
            displayCode: 'A-08.05',
            floorNumber: 8,
            unitAreaM2: 65.0,
            ownerName: 'Chủ Căn Hộ Cũ',
            ownerPhone: '0901112222',
          }),
        ]
      );
      const condoReportId = rRes.rows[0].id;
      createdReportIds.push(condoReportId);

      await Database.query(
        `INSERT INTO risk_score_cards (
           report_id, e1_burland_score, e2_structure_score, e3_deformation_score,
           e4_material_score, e5_history_score, e6_overall_function_score,
           total_ecs_score, ecs_class
         ) VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 'GOOD')
         ON CONFLICT (report_id) DO NOTHING;`,
        [condoReportId]
      );

      const condoFullUpdates = {
        unitCode: 'A-08.05',
        displayCode: 'A-805-VIP',
        floorNumber: 8,
        unitAreaM2: 78.5,
        ownerName: 'Trần Hoàng Phúc (Căn Hộ Đã Thẩm Định)',
        ownerPhone: '0933445566',
        ownerIdCard: '079199887766',
        residentStatus: 'CHO_THUÊ',
        doorJammingStatus: 'JAMMED',
        hasSensitiveEquipment: true,
        sensitiveEquipmentDesc: 'Đàn Piano cơ & Tủ rượu âm tường chống rung',
        upperFloorWaterLeakage: {
          has: true,
          location: 'Trần phòng vệ sinh master',
          description: 'Thấm nước nhỏ giọt từ cổ ống thoát sàn tầng 9',
          photoUrl: '/uploads/test/condo_leak_01.jpg',
        },
        beamSagging: {
          hasSagging: true,
          location: 'Dầm phòng khách căn A-805',
          sagMm: 9.5,
          spanM: 4.2,
          ratioText: '1/442',
          photoUrl: '/uploads/test/condo_sag_01.jpg',
        },
        photoP01: { url: '/uploads/test/condo_p01.jpg', notApplicable: false },
        photoP04: { url: '/uploads/test/condo_p04.jpg', notApplicable: false },
        damageZones: [
          {
            zoneCode: 'Z-01',
            floorName: 'Tầng 8',
            roomName: 'Phòng ngủ Master',
            componentType: 'WALL',
            ctxPhotoUrl: '/uploads/test/condo_z01_ctx.jpg',
            defects: [
              {
                defectCode: 'D-01',
                defectType: 'CRACK',
                widthMaxMm: 2.4,
                lengthMm: 1400,
                activityState: 'ACTIVE',
                hasScaleCard: true,
                cuPhotoUrl: '/uploads/test/condo_d01_cu.jpg',
                notes: 'Nứt tường ngăn phòng ngủ Master rộng 2.4mm',
              },
            ],
          },
        ],
        summaryConclusions: 'Căn hộ A-805-VIP có 01 vết nứt tường 2.4mm (Cấp 2) và hiện tượng thấm trần WC.',
        engineeringRecommendations: 'Theo dõi vết nứt D-01 và xử lý chống thấm cổ ống tầng 9 trước khi TBM đi qua.',
        ownerFeedback: 'Chủ căn hộ đồng ý với toàn bộ nội dung biên bản sau chỉnh sửa.',
        surveyorName: 'KS. Nguyễn Thành Nam',
        surveyorSignature: '/uploads/test/condo_ksv_sig.png',
        ownerSignature: '/uploads/test/condo_owner_sig.png',
        workingMinutesPhotos: ['/uploads/test/condo_minutes_01.jpg'],
      };

      await AuditModificationService.applyAdminSurveyEdit(condoReportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-FULL-CONDO-UNIT: Thay đổi toàn bộ thông tin căn hộ con',
        updates: condoFullUpdates,
        diffPayload: [{ field: 'condoFullForm', label: 'Toàn bộ Căn hộ con', oldValue: 'old', newValue: 'new' }],
      });

      await AuditReviewService.approveReport(condoReportId, adminId);

      // Kiểm tra bảng SQL building_units đã được đồng bộ 100%
      const unitDbRes = await Database.query<{
        display_code: string;
        owner_name: string;
        owner_phone: string;
        owner_id_card: string;
      }>(`SELECT display_code, owner_name, owner_phone, owner_id_card FROM building_units WHERE id = $1;`, [unitId]);
      assertEqual(unitDbRes.rows[0].display_code, 'A-805-VIP', 'SQL building_units.display_code');
      assertEqual(unitDbRes.rows[0].owner_name, 'Trần Hoàng Phúc (Căn Hộ Đã Thẩm Định)', 'SQL building_units.owner_name');
      assertEqual(unitDbRes.rows[0].owner_phone, '0933445566', 'SQL building_units.owner_phone');
      assertEqual(unitDbRes.rows[0].owner_id_card, '079199887766', 'SQL building_units.owner_id_card');

      const condoForRender = await loadApprovedReportForRender(condoReportId);
      const condoVm = CondoUnitReportGenerator.buildViewModel(condoForRender);

      assertEqual(condoVm.unitCode, 'A-08.05', 'condoVm.unitCode');
      assertEqual(condoVm.displayCode, 'A-805-VIP', 'condoVm.displayCode');
      assertEqual(condoVm.isDifferentCode, true, 'condoVm.isDifferentCode');
      assertEqual(Number(condoVm.unitAreaM2), 78.5, 'condoVm.unitAreaM2');
      assertEqual(condoVm.ownerName, 'Trần Hoàng Phúc (Căn Hộ Đã Thẩm Định)', 'condoVm.ownerName');
      assertEqual(condoVm.ownerPhone, '0933445566', 'condoVm.ownerPhone');
      assertEqual(condoVm.ownerIdCard, '079199887766', 'condoVm.ownerIdCard');
      assertEqual(condoVm.residentStatus, 'CHO_THUÊ', 'condoVm.residentStatus');
      assertEqual(condoVm.doorJammingStatus, 'JAMMED', 'condoVm.doorJammingStatus');
      assertEqual(condoVm.hasSensitiveEquipment, true, 'condoVm.hasSensitiveEquipment');
      assertEqual(condoVm.sensitiveEquipmentDesc, 'Đàn Piano cơ & Tủ rượu âm tường chống rung', 'condoVm.sensitiveEquipmentDesc');
      assertEqual(condoVm.hasUpperFloorWaterLeakage, true, 'condoVm.hasUpperFloorWaterLeakage');
      assertEqual(condoVm.waterLeakageItems.length, 1, 'condoVm.waterLeakageItems.length');
      assertIncludes(condoVm.waterLeakageItems[0].description, 'Thấm nước nhỏ giọt từ cổ ống', 'condoVm.waterLeakageItems[0].description');
      assertEqual(condoVm.hasBeamSagging, true, 'condoVm.hasBeamSagging');
      assertEqual(condoVm.beamSagMm, 9.5, 'condoVm.beamSagMm');
      assertEqual(condoVm.beamSpanM, 4.2, 'condoVm.beamSpanM');
      assertEqual(condoVm.isBeamSagCritical, true, 'condoVm.isBeamSagCritical (9.5 / 4200 > 1/500)');
      assertEqual(condoVm.p01.url, '/uploads/test/condo_p01.jpg', 'condoVm.p01.url');
      assertEqual(condoVm.p04.url, '/uploads/test/condo_p04.jpg', 'condoVm.p04.url');
      assertEqual(condoVm.localDefects.length, 1, 'condoVm.localDefects.length (from damageZones)');
      assertEqual(condoVm.localDefects[0].widthMaxMm, 2.4, 'condoVm.localDefects[0].widthMaxMm');
      assertEqual(condoVm.burlandMaxGrade, 2, 'condoVm.burlandMaxGrade');
      assertEqual(condoVm.summaryConclusions, 'Căn hộ A-805-VIP có 01 vết nứt tường 2.4mm (Cấp 2) và hiện tượng thấm trần WC.', 'condoVm.summaryConclusions');
      assertEqual(condoVm.engineeringRecommendations, 'Theo dõi vết nứt D-01 và xử lý chống thấm cổ ống tầng 9 trước khi TBM đi qua.', 'condoVm.engineeringRecommendations');
      assertEqual(condoVm.ownerFeedback, 'Chủ căn hộ đồng ý với toàn bộ nội dung biên bản sau chỉnh sửa.', 'condoVm.ownerFeedback');
      assertEqual(condoVm.surveyorName, 'KS. Nguyễn Thành Nam', 'condoVm.surveyorName');
      assertEqual(condoVm.workingMinutesPhotos.length, 1, 'condoVm.workingMinutesPhotos.length');
    });

    // =========================================================================
    // TEST SUITE 4: BỔ SUNG MỚI Z, E, D + DỊCH CHUYỂN TỌA ĐỘ GHIM (CAD PINS & CTX DEFECT PINS)
    // =========================================================================
    await runTest('TC-ZED-ADD-AND-PIN-MOVE', 'Bổ sung mới Z, E, D & Dịch chuyển tọa độ ghim trên bản vẽ CAD (Z/E) + ảnh toàn cảnh CTX (D của Z và E) -> Approve -> Handover 100% sang Report', async () => {
      const { reportId } = await createIsolatedResidentialReport('ZED-MOVE');

      // 1. Khởi tạo trạng thái ban đầu gồm Z-01 (1 D-01) và E-01 (1 D-01) với tọa độ ghim ban đầu
      const initialFloors = [
        {
          floorId: 'FL-1',
          floorName: 'Tầng 1',
          floorLevel: 1,
          cadSketchUrl: '/uploads/test/zed_cad_z_f1.jpg',
          cadStructuralSketchUrl: '/uploads/test/zed_cad_e_f1.jpg',
          cadZonePins: [{ zoneCode: 'Z-01', pinX: 20.5, pinY: 30.2 }],
          cadElementPins: [{ elementCode: 'E-01', pinX: 70.0, pinY: 80.0 }],
          zones: [
            {
              zoneCode: 'Z-01',
              floorName: 'Tầng 1',
              roomName: 'Phòng khách',
              componentType: 'WALL',
              pinX: 20.5,
              pinY: 30.2,
              ctxPhotoUrl: '/uploads/test/zed_z01_ctx.jpg',
              defects: [
                {
                  defectCode: 'D-01',
                  screeningCategory: 'CRACK',
                  defectType: 'PLASTER_CRACK',
                  widthMaxMm: 1.2,
                  lengthMm: 900,
                  activityState: 'STABILIZED',
                  hasScaleCard: true,
                  pinX: 15.0,
                  pinY: 25.0,
                  cuPhotoUrl: '/uploads/test/zed_z01_d01_cu.jpg',
                  notes: 'Vết nứt Z-01/D-01 ban đầu',
                },
              ],
            },
          ],
          structuralElements: [
            {
              elementCode: 'E-01',
              floorName: 'Tầng 1',
              roomName: 'Trục cột A1',
              componentType: 'COLUMN',
              pinX: 70.0,
              pinY: 80.0,
              conditionStatus: 'DAMAGED',
              ctxPhotoUrl: '/uploads/test/zed_e01_ctx.jpg',
              defects: [
                {
                  defectCode: 'D-01',
                  screeningCategory: 'CRACK',
                  defectType: 'HAIRLINE_CRACK',
                  widthMaxMm: 0.3,
                  lengthMm: 450,
                  activityState: 'STABILIZED',
                  hasScaleCard: true,
                  pinX: 40.0,
                  pinY: 50.0,
                  cuPhotoUrl: '/uploads/test/zed_e01_d01_cu.jpg',
                  notes: 'Vết rạn cột E-01/D-01 ban đầu',
                },
              ],
            },
          ],
        },
      ];

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-ZED-ADD-AND-PIN-MOVE: Khởi tạo Z-01, E-01 ban đầu',
        updates: { floors: initialFloors },
        diffPayload: [{ field: 'floors', label: 'Khởi tạo tầng', oldValue: [], newValue: initialFloors }],
      });

      // 2. Thực hiện chỉnh sửa:
      //    - Dịch chuyển ghim CAD: Z-01 -> (64.8, 38.4), E-01 -> (82.1, 19.6)
      //    - Dịch chuyển ghim CTX: Z-01/D-01 -> (55.5, 66.7), E-01/D-01 -> (77.2, 88.9)
      //    - Bổ sung D-02 vào Z-01 tại (33.3, 44.4)
      //    - Bổ sung mới vùng Z-02 tại CAD (41.2, 52.9) kèm D-01 tại CTX (61.5, 72.3)
      //    - Bổ sung D-02 vào E-01 tại CTX (28.4, 39.1)
      //    - Bổ sung mới cấu kiện E-02 tại CAD (12.7, 84.5) kèm D-01 tại CTX (49.8, 51.2)
      const mutatedFloors = [
        {
          floorId: 'FL-1',
          floorName: 'Tầng 1',
          floorLevel: 1,
          cadSketchUrl: '/uploads/test/zed_cad_z_f1.jpg',
          cadStructuralSketchUrl: '/uploads/test/zed_cad_e_f1.jpg',
          cadZonePins: [
            { zoneCode: 'Z-01', pinX: 64.8, pinY: 38.4 },
            { zoneCode: 'Z-02', pinX: 41.2, pinY: 52.9 },
          ],
          cadElementPins: [
            { elementCode: 'E-01', pinX: 82.1, pinY: 19.6 },
            { elementCode: 'E-02', pinX: 12.7, pinY: 84.5 },
          ],
          zones: [
            {
              zoneCode: 'Z-01',
              floorName: 'Tầng 1',
              roomName: 'Phòng khách (Đã dời ghim)',
              componentType: 'WALL',
              pinX: 64.8,
              pinY: 38.4,
              ctxPhotoUrl: '/uploads/test/zed_z01_ctx.jpg',
              defects: [
                {
                  defectCode: 'D-01',
                  screeningCategory: 'CRACK',
                  defectType: 'PLASTER_CRACK',
                  widthMaxMm: 1.5,
                  lengthMm: 950,
                  activityState: 'STABILIZED',
                  hasScaleCard: true,
                  pinX: 55.5,
                  pinY: 66.7,
                  cuPhotoUrl: '/uploads/test/zed_z01_d01_cu.jpg',
                  notes: 'Z-01/D-01 đã dời ghim sang (55.5, 66.7)',
                },
                {
                  defectCode: 'D-02',
                  screeningCategory: 'SPALLING',
                  defectType: 'SPALLING',
                  widthMaxMm: 5.0,
                  lengthMm: 300,
                  activityState: 'ACTIVE',
                  hasScaleCard: true,
                  pinX: 33.3,
                  pinY: 44.4,
                  cuPhotoUrl: '/uploads/test/zed_z01_d02_cu.jpg',
                  notes: 'Bổ sung mới Z-01/D-02 tại (33.3, 44.4)',
                },
              ],
            },
            {
              zoneCode: 'Z-02',
              floorName: 'Tầng 1',
              roomName: 'Phòng bếp (Bổ sung mới)',
              componentType: 'CEILING',
              pinX: 41.2,
              pinY: 52.9,
              ctxPhotoUrl: '/uploads/test/zed_z02_ctx.jpg',
              defects: [
                {
                  defectCode: 'D-01',
                  screeningCategory: 'SEEPAGE',
                  defectType: 'WATER_SEEPAGE',
                  widthMaxMm: 0,
                  lengthMm: 1200,
                  activityState: 'ACTIVE',
                  hasScaleCard: true,
                  pinX: 61.5,
                  pinY: 72.3,
                  cuPhotoUrl: '/uploads/test/zed_z02_d01_cu.jpg',
                  notes: 'Bổ sung mới vùng Z-02 kèm D-01 tại (61.5, 72.3)',
                },
              ],
            },
          ],
          structuralElements: [
            {
              elementCode: 'E-01',
              floorName: 'Tầng 1',
              roomName: 'Trục cột A1 (Đã dời ghim)',
              componentType: 'COLUMN',
              pinX: 82.1,
              pinY: 19.6,
              conditionStatus: 'DAMAGED',
              ctxPhotoUrl: '/uploads/test/zed_e01_ctx.jpg',
              defects: [
                {
                  defectCode: 'D-01',
                  screeningCategory: 'CRACK',
                  defectType: 'HAIRLINE_CRACK',
                  widthMaxMm: 0.4,
                  lengthMm: 500,
                  activityState: 'STABILIZED',
                  hasScaleCard: true,
                  pinX: 77.2,
                  pinY: 88.9,
                  cuPhotoUrl: '/uploads/test/zed_e01_d01_cu.jpg',
                  notes: 'E-01/D-01 đã dời ghim sang (77.2, 88.9)',
                },
                {
                  defectCode: 'D-02',
                  screeningCategory: 'SPALLING',
                  defectType: 'CORROSION',
                  widthMaxMm: 1.0,
                  lengthMm: 250,
                  activityState: 'ACTIVE',
                  hasScaleCard: true,
                  pinX: 28.4,
                  pinY: 39.1,
                  cuPhotoUrl: '/uploads/test/zed_e01_d02_cu.jpg',
                  notes: 'Bổ sung mới E-01/D-02 tại (28.4, 39.1)',
                },
              ],
            },
            {
              elementCode: 'E-02',
              floorName: 'Tầng 1',
              roomName: 'Dầm chính B1-B2 (Bổ sung mới)',
              componentType: 'BEAM',
              pinX: 12.7,
              pinY: 84.5,
              conditionStatus: 'DAMAGED',
              ctxPhotoUrl: '/uploads/test/zed_e02_ctx.jpg',
              defects: [
                {
                  defectCode: 'D-01',
                  screeningCategory: 'CRACK',
                  defectType: 'STRUCTURAL_CRACK',
                  widthMaxMm: 0.8,
                  lengthMm: 600,
                  activityState: 'STABILIZED',
                  hasScaleCard: true,
                  pinX: 49.8,
                  pinY: 51.2,
                  cuPhotoUrl: '/uploads/test/zed_e02_d01_cu.jpg',
                  notes: 'Bổ sung mới cấu kiện E-02 kèm D-01 tại (49.8, 51.2)',
                },
              ],
            },
          ],
        },
      ];

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-ZED-ADD-AND-PIN-MOVE: Bổ sung Z-02, E-02, D-02 và cập nhật toàn bộ tọa độ ghim CAD + CTX',
        updates: { floors: mutatedFloors },
        diffPayload: [{ field: 'floors', label: 'Cập nhật Z/E/D & Ghim', oldValue: initialFloors, newValue: mutatedFloors }],
      });

      await AuditReviewService.approveReport(reportId, adminId);

      // 3. Kiểm tra bảng SQL floor_surveys, damage_zones, defect_items
      const fsRes = await Database.query<{
        cad_zone_pins_json: any[];
        cad_element_pins_json: any[];
      }>(`SELECT cad_zone_pins_json, cad_element_pins_json FROM floor_surveys WHERE report_id = $1 AND floor_name = 'Tầng 1';`, [reportId]);
      assertEqual(fsRes.rows.length, 1, 'SQL floor_surveys row exists for Tầng 1');
      assertEqual(fsRes.rows[0].cad_zone_pins_json.length, 2, 'SQL floor_surveys.cad_zone_pins_json count');
      assertEqual(Number(fsRes.rows[0].cad_zone_pins_json.find((p: any) => p.zoneCode === 'Z-01')?.pinX), 64.8, 'SQL floor_surveys Z-01 pinX');
      assertEqual(Number(fsRes.rows[0].cad_zone_pins_json.find((p: any) => p.zoneCode === 'Z-01')?.pinY), 38.4, 'SQL floor_surveys Z-01 pinY');
      assertEqual(Number(fsRes.rows[0].cad_zone_pins_json.find((p: any) => p.zoneCode === 'Z-02')?.pinX), 41.2, 'SQL floor_surveys Z-02 pinX');
      assertEqual(Number(fsRes.rows[0].cad_element_pins_json.find((p: any) => p.elementCode === 'E-01')?.pinX), 82.1, 'SQL floor_surveys E-01 pinX');
      assertEqual(Number(fsRes.rows[0].cad_element_pins_json.find((p: any) => p.elementCode === 'E-02')?.pinX), 12.7, 'SQL floor_surveys E-02 pinX');

      const dzRes = await Database.query<{
        zone_code: string;
        room_name: string;
        is_deleted: boolean;
      }>(`SELECT zone_code, room_name, is_deleted FROM damage_zones WHERE report_id = $1 ORDER BY zone_code ASC;`, [reportId]);
      assertEqual(dzRes.rows.length, 4, 'SQL damage_zones total rows (E-01, E-02, Z-01, Z-02)');
      assertEqual(dzRes.rows.every((r) => r.is_deleted === false), true, 'SQL damage_zones all active');

      const defSqlRes = await Database.query<{
        zone_code: string;
        defect_code: string;
        pin_x: string;
        pin_y: string;
      }>(
        `SELECT z.zone_code, d.defect_code, d.pin_x, d.pin_y
         FROM defect_items d
         JOIN damage_zones z ON d.zone_id = z.id
         WHERE z.report_id = $1 AND d.is_deleted = false
         ORDER BY z.zone_code ASC, d.defect_code ASC;`,
        [reportId]
      );
      assertEqual(defSqlRes.rows.length, 6, 'SQL defect_items total active rows (6 defects across Z and E)');
      assertEqual(Number(defSqlRes.rows.find((r) => r.zone_code === 'Z-01' && r.defect_code === 'D-01')?.pin_x), 55.5, 'SQL defect_items Z-01/D-01 pin_x');
      assertEqual(Number(defSqlRes.rows.find((r) => r.zone_code === 'E-01' && r.defect_code === 'D-01')?.pin_x), 77.2, 'SQL defect_items E-01/D-01 pin_x');

      // 4. Kiểm tra ReportV2ViewModel sau khi nạp từ APPROVED_RELEASE Snapshot
      const reportForRender = await loadApprovedReportForRender(reportId);
      const vm = ReportV2ViewModelMapper.buildViewModel(reportForRender);
      const flVm = vm.appendix2[0];

      assertEqual(flVm.cadPins?.filter((p) => p.type === 'ZONE').length, 2, 'ViewModel cadPins ZONE count');
      assertEqual(flVm.cadPins?.find((p) => p.code === 'Z-01')?.pinX, 64.8, 'ViewModel cadPins Z-01 pinX');
      assertEqual(flVm.cadPins?.find((p) => p.code === 'Z-01')?.pinY, 38.4, 'ViewModel cadPins Z-01 pinY');
      assertEqual(flVm.cadPins?.find((p) => p.code === 'Z-02')?.pinX, 41.2, 'ViewModel cadPins Z-02 pinX');
      assertEqual(flVm.cadPins?.find((p) => p.code === 'Z-02')?.pinY, 52.9, 'ViewModel cadPins Z-02 pinY');

      assertEqual(flVm.cadStructuralPins?.length, 2, 'ViewModel cadStructuralPins count');
      assertEqual(flVm.cadStructuralPins?.find((p) => p.code === 'E-01')?.pinX, 82.1, 'ViewModel cadStructuralPins E-01 pinX');
      assertEqual(flVm.cadStructuralPins?.find((p) => p.code === 'E-01')?.pinY, 19.6, 'ViewModel cadStructuralPins E-01 pinY');
      assertEqual(flVm.cadStructuralPins?.find((p) => p.code === 'E-02')?.pinX, 12.7, 'ViewModel cadStructuralPins E-02 pinX');
      assertEqual(flVm.cadStructuralPins?.find((p) => p.code === 'E-02')?.pinY, 84.5, 'ViewModel cadStructuralPins E-02 pinY');

      assertEqual(flVm.defectSummaryRows.length, 6, 'ViewModel defectSummaryRows count (3 from Z + 3 from E)');
      assertEqual(flVm.defectSummaryRows.map((r) => r.no).join(','), '1,2,3,4,5,6', 'ViewModel defectSummaryRows continuous no sequence');
      assertEqual(flVm.zoneAndElementConditions.map((c) => c.code).join(','), 'Z-01,Z-02,E-01,E-02', 'ViewModel zoneAndElementConditions codes');

      // Kiểm tra tọa độ ghim D trên ảnh CTX của cả Z và E trong defectPairPhotos
      assertEqual(flVm.defectPairPhotos.length, 6, 'ViewModel defectPairPhotos total (3 from Z + 3 from E)');
      const pairZ01D01 = flVm.defectPairPhotos.find((p) => p.cadPinRef?.includes('Z-01') && p.defectId === 'D-01')!;
      const pairZ01D02 = flVm.defectPairPhotos.find((p) => p.cadPinRef?.includes('Z-01') && p.defectId === 'D-02')!;
      const pairZ02D01 = flVm.defectPairPhotos.find((p) => p.cadPinRef?.includes('Z-02') && p.defectId === 'D-01')!;
      const pairE01D01 = flVm.defectPairPhotos.find((p) => p.cadPinRef?.includes('E-01') && p.defectId === 'D-01')!;
      const pairE01D02 = flVm.defectPairPhotos.find((p) => p.cadPinRef?.includes('E-01') && p.defectId === 'D-02')!;
      const pairE02D01 = flVm.defectPairPhotos.find((p) => p.cadPinRef?.includes('E-02') && p.defectId === 'D-01')!;

      assertEqual(pairZ01D01.hasPin, true, 'Z-01/D-01 hasPin');
      assertEqual(pairZ01D01.pinX, 55.5, 'Z-01/D-01 pinX');
      assertEqual(pairZ01D01.pinY, 66.7, 'Z-01/D-01 pinY');
      assertEqual(pairZ01D02.pinX, 33.3, 'Z-01/D-02 pinX');
      assertEqual(pairZ01D02.pinY, 44.4, 'Z-01/D-02 pinY');
      assertEqual(pairZ02D01.pinX, 61.5, 'Z-02/D-01 pinX');
      assertEqual(pairZ02D01.pinY, 72.3, 'Z-02/D-01 pinY');

      assertEqual(pairE01D01.hasPin, true, 'E-01/D-01 hasPin');
      assertEqual(pairE01D01.pinX, 77.2, 'E-01/D-01 pinX');
      assertEqual(pairE01D01.pinY, 88.9, 'E-01/D-01 pinY');
      assertEqual(pairE01D02.pinX, 28.4, 'E-01/D-02 pinX');
      assertEqual(pairE01D02.pinY, 39.1, 'E-01/D-02 pinY');
      assertEqual(pairE02D01.pinX, 49.8, 'E-02/D-01 pinX');
      assertEqual(pairE02D01.pinY, 51.2, 'E-02/D-01 pinY');
    });

    // =========================================================================
    // TEST SUITE 5: XÓA MỀM PHẦN TỬ GIỮA + BỔ SUNG MỚI + TOÀN VẸN SỐ THỨ TỰ (MONOTONIC CODE & CONTINUOUS STT)
    // =========================================================================
    await runTest('TC-ZED-DELETE-AND-SEQUENCE-INTEGRITY', 'Xóa mềm phần tử ở giữa (Z-02, E-02, D-02) & thêm mới (Z-04, E-04, D-04): Kiểm chứng bất biến mã Monotonic, lọc sạch ghim đã xóa & số thứ tự STT liên tục 1..N không đứt quãng', async () => {
      const { reportId } = await createIsolatedResidentialReport('ZED-SEQ');

      // 1. Tạo danh sách ban đầu có Z-01 (D-01, D-02, D-03), Z-02 (D-01), Z-03 (D-01) và E-01, E-02, E-03
      const baseFloors = [
        {
          floorId: 'FL-1',
          floorName: 'Tầng 1',
          floorLevel: 1,
          cadSketchUrl: '/uploads/test/seq_cad_z.jpg',
          cadStructuralSketchUrl: '/uploads/test/seq_cad_e.jpg',
          cadZonePins: [
            { zoneCode: 'Z-01', pinX: 10, pinY: 10 },
            { zoneCode: 'Z-02', pinX: 20, pinY: 20 },
            { zoneCode: 'Z-03', pinX: 30, pinY: 30 },
          ],
          cadElementPins: [
            { elementCode: 'E-01', pinX: 40, pinY: 40 },
            { elementCode: 'E-02', pinX: 50, pinY: 50 },
            { elementCode: 'E-03', pinX: 60, pinY: 60 },
          ],
          zones: [
            {
              zoneCode: 'Z-01',
              floorName: 'Tầng 1',
              roomName: 'Phòng 1',
              componentType: 'WALL',
              pinX: 10,
              pinY: 10,
              ctxPhotoUrl: '/uploads/test/seq_z01.jpg',
              defects: [
                { defectCode: 'D-01', defectType: 'PLASTER_CRACK', widthMaxMm: 1.0, lengthMm: 500, pinX: 11, pinY: 11, cuPhotoUrl: '/uploads/test/seq_z01_d01.jpg' },
                { defectCode: 'D-02', defectType: 'PLASTER_CRACK', widthMaxMm: 2.0, lengthMm: 600, pinX: 12, pinY: 12, cuPhotoUrl: '/uploads/test/seq_z01_d02.jpg' },
                { defectCode: 'D-03', defectType: 'PLASTER_CRACK', widthMaxMm: 3.0, lengthMm: 700, pinX: 13, pinY: 13, cuPhotoUrl: '/uploads/test/seq_z01_d03.jpg' },
              ],
            },
            {
              zoneCode: 'Z-02',
              floorName: 'Tầng 1',
              roomName: 'Phòng 2 (Sẽ xóa mềm)',
              componentType: 'WALL',
              pinX: 20,
              pinY: 20,
              ctxPhotoUrl: '/uploads/test/seq_z02.jpg',
              defects: [
                { defectCode: 'D-01', defectType: 'PLASTER_CRACK', widthMaxMm: 1.5, lengthMm: 500, pinX: 21, pinY: 21, cuPhotoUrl: '/uploads/test/seq_z02_d01.jpg' },
              ],
            },
            {
              zoneCode: 'Z-03',
              floorName: 'Tầng 1',
              roomName: 'Phòng 3',
              componentType: 'WALL',
              pinX: 30,
              pinY: 30,
              ctxPhotoUrl: '/uploads/test/seq_z03.jpg',
              defects: [
                { defectCode: 'D-01', defectType: 'PLASTER_CRACK', widthMaxMm: 2.5, lengthMm: 800, pinX: 31, pinY: 31, cuPhotoUrl: '/uploads/test/seq_z03_d01.jpg' },
              ],
            },
          ],
          structuralElements: [
            { elementCode: 'E-01', floorName: 'Tầng 1', roomName: 'Cột C1', componentType: 'COLUMN', pinX: 40, pinY: 40, conditionStatus: 'NORMAL', ctxPhotoUrl: '/uploads/test/seq_e01.jpg', defects: [] },
            { elementCode: 'E-02', floorName: 'Tầng 1', roomName: 'Cột C2 (Sẽ xóa mềm)', componentType: 'COLUMN', pinX: 50, pinY: 50, conditionStatus: 'NORMAL', ctxPhotoUrl: '/uploads/test/seq_e02.jpg', defects: [] },
            { elementCode: 'E-03', floorName: 'Tầng 1', roomName: 'Dầm B1', componentType: 'BEAM', pinX: 60, pinY: 60, conditionStatus: 'NORMAL', ctxPhotoUrl: '/uploads/test/seq_e03.jpg', defects: [] },
          ],
        },
      ];

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-ZED-DELETE-AND-SEQUENCE-INTEGRITY: Tạo danh sách Z-01..Z-03 và E-01..E-03 ban đầu',
        updates: { floors: baseFloors },
        diffPayload: [{ field: 'floors', label: 'Khởi tạo', oldValue: [], newValue: baseFloors }],
      });

      // 2. Xóa mềm Z-02, xóa mềm D-02 trong Z-01, xóa mềm E-02; đồng thời thêm mới Z-04, D-04 (trong Z-01), E-04
      //    Đặc biệt: giữ lại cả pin của Z-02, E-02 trong mảng cadZonePins/cadElementPins để kiểm chứng cả Backend & Mapper tự động lọc sạch ghim đã xóa mềm!
      const updatedFloors = [
        {
          floorId: 'FL-1',
          floorName: 'Tầng 1',
          floorLevel: 1,
          cadSketchUrl: '/uploads/test/seq_cad_z.jpg',
          cadStructuralSketchUrl: '/uploads/test/seq_cad_e.jpg',
          cadZonePins: [
            { zoneCode: 'Z-01', pinX: 10, pinY: 10 },
            { zoneCode: 'Z-02', pinX: 20, pinY: 20 }, // Ghim của Z-02 đã bị xóa mềm
            { zoneCode: 'Z-03', pinX: 30, pinY: 30 },
            { zoneCode: 'Z-04', pinX: 35, pinY: 35 },
          ],
          cadElementPins: [
            { elementCode: 'E-01', pinX: 40, pinY: 40 },
            { elementCode: 'E-02', pinX: 50, pinY: 50 }, // Ghim của E-02 đã bị xóa mềm
            { elementCode: 'E-03', pinX: 60, pinY: 60 },
            { elementCode: 'E-04', pinX: 65, pinY: 65 },
          ],
          zones: [
            {
              zoneCode: 'Z-01',
              floorName: 'Tầng 1',
              roomName: 'Phòng 1',
              componentType: 'WALL',
              pinX: 10,
              pinY: 10,
              ctxPhotoUrl: '/uploads/test/seq_z01.jpg',
              defects: [
                { defectCode: 'D-01', defectType: 'PLASTER_CRACK', widthMaxMm: 1.0, lengthMm: 500, pinX: 11, pinY: 11, cuPhotoUrl: '/uploads/test/seq_z01_d01.jpg' },
                { defectCode: 'D-02', defectType: 'PLASTER_CRACK', widthMaxMm: 2.0, lengthMm: 600, pinX: 12, pinY: 12, cuPhotoUrl: '/uploads/test/seq_z01_d02.jpg', isDeleted: true },
                { defectCode: 'D-03', defectType: 'PLASTER_CRACK', widthMaxMm: 3.0, lengthMm: 700, pinX: 13, pinY: 13, cuPhotoUrl: '/uploads/test/seq_z01_d03.jpg' },
                { defectCode: 'D-04', defectType: 'PLASTER_CRACK', widthMaxMm: 4.0, lengthMm: 800, pinX: 14, pinY: 14, cuPhotoUrl: '/uploads/test/seq_z01_d04.jpg' },
              ],
            },
            {
              zoneCode: 'Z-02',
              floorName: 'Tầng 1',
              roomName: 'Phòng 2 (Đã xóa mềm)',
              componentType: 'WALL',
              pinX: 20,
              pinY: 20,
              isDeleted: true,
              ctxPhotoUrl: '/uploads/test/seq_z02.jpg',
              defects: [
                { defectCode: 'D-01', defectType: 'PLASTER_CRACK', widthMaxMm: 1.5, lengthMm: 500, pinX: 21, pinY: 21, cuPhotoUrl: '/uploads/test/seq_z02_d01.jpg' },
              ],
            },
            {
              zoneCode: 'Z-03',
              floorName: 'Tầng 1',
              roomName: 'Phòng 3',
              componentType: 'WALL',
              pinX: 30,
              pinY: 30,
              ctxPhotoUrl: '/uploads/test/seq_z03.jpg',
              defects: [
                { defectCode: 'D-01', defectType: 'PLASTER_CRACK', widthMaxMm: 2.5, lengthMm: 800, pinX: 31, pinY: 31, cuPhotoUrl: '/uploads/test/seq_z03_d01.jpg' },
              ],
            },
            {
              zoneCode: 'Z-04',
              floorName: 'Tầng 1',
              roomName: 'Phòng 4 (Thêm mới không tái sử dụng Z-02)',
              componentType: 'WALL',
              pinX: 35,
              pinY: 35,
              ctxPhotoUrl: '/uploads/test/seq_z04.jpg',
              defects: [
                { defectCode: 'D-01', defectType: 'PLASTER_CRACK', widthMaxMm: 1.8, lengthMm: 650, pinX: 36, pinY: 36, cuPhotoUrl: '/uploads/test/seq_z04_d01.jpg' },
              ],
            },
          ],
          structuralElements: [
            { elementCode: 'E-01', floorName: 'Tầng 1', roomName: 'Cột C1', componentType: 'COLUMN', pinX: 40, pinY: 40, conditionStatus: 'NORMAL', ctxPhotoUrl: '/uploads/test/seq_e01.jpg', defects: [] },
            { elementCode: 'E-02', floorName: 'Tầng 1', roomName: 'Cột C2 (Đã xóa mềm)', componentType: 'COLUMN', pinX: 50, pinY: 50, isDeleted: true, conditionStatus: 'NORMAL', ctxPhotoUrl: '/uploads/test/seq_e02.jpg', defects: [] },
            { elementCode: 'E-03', floorName: 'Tầng 1', roomName: 'Dầm B1', componentType: 'BEAM', pinX: 60, pinY: 60, conditionStatus: 'NORMAL', ctxPhotoUrl: '/uploads/test/seq_e03.jpg', defects: [] },
            { elementCode: 'E-04', floorName: 'Tầng 1', roomName: 'Sàn S1 (Thêm mới không tái sử dụng E-02)', componentType: 'SLAB', pinX: 65, pinY: 65, conditionStatus: 'NORMAL', ctxPhotoUrl: '/uploads/test/seq_e04.jpg', defects: [] },
          ],
        },
      ];

      await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'TC-ZED-DELETE-AND-SEQUENCE-INTEGRITY: Xóa mềm phần tử giữa và thêm mới Monotonic',
        updates: { floors: updatedFloors },
        diffPayload: [{ field: 'floors', label: 'Xóa mềm & Thêm mới', oldValue: baseFloors, newValue: updatedFloors }],
      });

      await AuditReviewService.approveReport(reportId, adminId);

      // 3. Kiểm tra SQL: Z-02, E-02 và Z-01/D-02 phải có is_deleted = true, không bị mất dấu vết audit
      const dzSeqRes = await Database.query<{ zone_code: string; is_deleted: boolean }>(
        `SELECT zone_code, is_deleted FROM damage_zones WHERE report_id = $1 ORDER BY zone_code ASC;`,
        [reportId]
      );
      assertEqual(dzSeqRes.rows.find((r) => r.zone_code === 'Z-02')?.is_deleted, true, 'SQL Z-02 is_deleted = true');
      assertEqual(dzSeqRes.rows.find((r) => r.zone_code === 'E-02')?.is_deleted, true, 'SQL E-02 is_deleted = true');
      assertEqual(dzSeqRes.rows.find((r) => r.zone_code === 'Z-04')?.is_deleted, false, 'SQL Z-04 is_deleted = false');
      assertEqual(dzSeqRes.rows.find((r) => r.zone_code === 'E-04')?.is_deleted, false, 'SQL E-04 is_deleted = false');

      // 4. Kiểm tra ReportV2ViewModel:
      const reportForRender = await loadApprovedReportForRender(reportId);
      const vm = ReportV2ViewModelMapper.buildViewModel(reportForRender);
      const flVm = vm.appendix2[0];

      // - Ghim CAD chỉ giữ lại các mã active: Z-01, Z-03, Z-04 và E-01, E-03, E-04 (không có Z-02, E-02)
      assertEqual(flVm.cadPins?.filter((p) => p.type === 'ZONE').map((p) => p.code).join(','), 'Z-01,Z-03,Z-04', 'Active CAD Zone Pins exclude deleted Z-02');
      assertEqual(flVm.cadStructuralPins?.map((p) => p.code).join(','), 'E-01,E-03,E-04', 'Active CAD Element Pins exclude deleted E-02');

      // - Bảng tổng hợp hư hỏng (defectSummaryRows):
      //   + Mã định danh giữ nguyên bất biến Monotonic: Z-01 (D-01, D-03, D-04), Z-03 (D-01), Z-04 (D-01)
      //   + Số thứ tự dòng (no) liên tục tuyệt đối: 1, 2, 3, 4, 5 (không bị nhảy cóc)
      assertEqual(
        flVm.defectSummaryRows.map((r) => `${r.cadPinRef?.split(' tại ')[1]}/${r.defectId}`).join(','),
        'Z-01/D-01,Z-01/D-03,Z-01/D-04,Z-03/D-01,Z-04/D-01',
        'Monotonic Zone/Defect codes in Report table'
      );
      assertEqual(
        flVm.defectSummaryRows.map((r) => r.no).join(','),
        '1,2,3,4,5',
        'Continuous ordinal no (1..5) in defectSummaryRows without gaps'
      );

      // - Bảng hiện trạng vùng & cấu kiện (zoneAndElementConditions):
      //   + Mã vùng & cấu kiện giữ nguyên Monotonic: Z-01, Z-03, Z-04, E-01, E-03, E-04 (không có Z-02, E-02)
      assertEqual(
        flVm.zoneAndElementConditions.map((c) => c.code).join(','),
        'Z-01,Z-03,Z-04,E-01,E-03,E-04',
        'Monotonic Zone & Structural Element codes in Report table excluding soft-deleted Z-02 and E-02'
      );
    });

    // =========================================================================
    // TEST SUITE 6: LỊCH SỬ PHIÊN BẢN (HISTORY) & KHÔI PHỤC ĐA TẦNG (MULTI-VERSION ROLLBACK)
    // =========================================================================
    await runTest('TC-HISTORY-AND-MULTI-VERSION-ROLLBACK', 'Kiểm thử toàn diện History (v0 -> v1 -> v2) & Multi-Version Rollback (v2 -> v1 -> v0 -> v1 -> Approve v6): Toàn vẹn 100% dữ liệu, tọa độ ghim, trạng thái xóa mềm Z/E/D và chuỗi số thứ tự phiên bản', async () => {
      const { reportId, parcelId } = await createIsolatedResidentialReport('HIST-RB');

      // 0. Chuẩn bị trạng thái cơ sở v0 (Baseline) đầy đủ cả tầng/Z-01/E-01 trước khi phát sinh chỉnh sửa đầu tiên
      const v0Floors = [
        {
          floorId: 'FL-1',
          floorName: 'Tầng 1',
          floorLevel: 1,
          cadSketchUrl: '/uploads/test/rb_cad_z_v0.jpg',
          cadStructuralSketchUrl: '/uploads/test/rb_cad_e_v0.jpg',
          cadZonePins: [{ zoneCode: 'Z-01', pinX: 10.0, pinY: 20.0 }],
          cadElementPins: [{ elementCode: 'E-01', pinX: 30.0, pinY: 40.0 }],
          zones: [
            {
              zoneCode: 'Z-01',
              floorName: 'Tầng 1',
              roomName: 'Phòng khách v0',
              componentType: 'WALL',
              pinX: 10.0,
              pinY: 20.0,
              ctxPhotoUrl: '/uploads/test/rb_z01_v0.jpg',
              defects: [
                {
                  defectCode: 'D-01',
                  screeningCategory: 'CRACK',
                  defectType: 'PLASTER_CRACK',
                  widthMaxMm: 1.0,
                  lengthMm: 500,
                  activityState: 'STABILIZED',
                  hasScaleCard: true,
                  pinX: 15.0,
                  pinY: 25.0,
                  cuPhotoUrl: '/uploads/test/rb_z01_d01_v0.jpg',
                  notes: 'Vết nứt gốc v0 rộng 1.0mm',
                },
              ],
            },
          ],
          structuralElements: [
            {
              elementCode: 'E-01',
              floorName: 'Tầng 1',
              roomName: 'Cột gốc v0',
              componentType: 'COLUMN',
              pinX: 30.0,
              pinY: 40.0,
              conditionStatus: 'NORMAL',
              ctxPhotoUrl: '/uploads/test/rb_e01_v0.jpg',
              defects: [],
            },
          ],
        },
      ];

      await Database.query(
        `UPDATE base_survey_reports
         SET survey_data_json = survey_data_json || $1::jsonb
         WHERE id = $2;`,
        [JSON.stringify({ floors: v0Floors, damageZones: v0Floors[0].zones }), reportId]
      );
      await Database.query(
        `INSERT INTO floor_surveys (
           report_id, floor_name, floor_order, overview_photos_json,
           cad_drawing_url, cad_zone_pins_json, cad_structural_drawing_url, cad_element_pins_json
         ) VALUES ($1, 'Tầng 1', 1, '[]'::jsonb, '/uploads/test/rb_cad_z_v0.jpg', $2::jsonb, '/uploads/test/rb_cad_e_v0.jpg', $3::jsonb);`,
        [
          reportId,
          JSON.stringify(v0Floors[0].cadZonePins),
          JSON.stringify(v0Floors[0].cadElementPins),
        ]
      );
      const z01V0Res = await Database.query<{ id: string }>(
        `INSERT INTO damage_zones (report_id, zone_code, floor_name, room_name, component_type, ctx_photo_url, is_deleted)
         VALUES ($1, 'Z-01', 'Tầng 1', 'Phòng khách v0', 'WALL', '/uploads/test/rb_z01_v0.jpg', false)
         RETURNING id;`,
        [reportId]
      );
      await Database.query(
        `INSERT INTO defect_items (zone_id, defect_code, screening_category, defect_type, width_max_mm, length_mm, activity_state, has_scale_card, cu_photo_url, pin_x, pin_y, is_deleted)
         VALUES ($1, 'D-01', 'CRACK', 'PLASTER_CRACK', 1.0, 500, 'S', true, '/uploads/test/rb_z01_d01_v0.jpg', 15.0, 25.0, false);`,
        [z01V0Res.rows[0].id]
      );
      await Database.query(
        `INSERT INTO damage_zones (report_id, zone_code, floor_name, room_name, component_type, ctx_photo_url, is_deleted)
         VALUES ($1, 'E-01', 'Tầng 1', 'Cột gốc v0', 'COLUMN', '/uploads/test/rb_e01_v0.jpg', false);`,
        [reportId]
      );

      // 1. Chỉnh sửa lần 1 (Tự động chụp v0 = ORIGINAL_SUBMISSION, tạo ra v1 = ADMIN_MODIFIED)
      const v1Floors = [
        {
          floorId: 'FL-1',
          floorName: 'Tầng 1',
          floorLevel: 1,
          cadSketchUrl: '/uploads/test/rb_cad_z_v1.jpg',
          cadStructuralSketchUrl: '/uploads/test/rb_cad_e_v1.jpg',
          cadZonePins: [
            { zoneCode: 'Z-01', pinX: 45.0, pinY: 55.0 },
            { zoneCode: 'Z-02', pinX: 60.0, pinY: 70.0 },
          ],
          cadElementPins: [
            { elementCode: 'E-01', pinX: 30.0, pinY: 40.0 },
            { elementCode: 'E-02', pinX: 80.0, pinY: 85.0 },
          ],
          zones: [
            {
              zoneCode: 'Z-01',
              floorName: 'Tầng 1',
              roomName: 'Phòng khách v1 (Đã dời ghim)',
              componentType: 'WALL',
              pinX: 45.0,
              pinY: 55.0,
              ctxPhotoUrl: '/uploads/test/rb_z01_v1.jpg',
              defects: [
                {
                  defectCode: 'D-01',
                  screeningCategory: 'CRACK',
                  defectType: 'PLASTER_CRACK',
                  widthMaxMm: 2.2,
                  lengthMm: 950,
                  activityState: 'ACTIVE',
                  hasScaleCard: true,
                  pinX: 48.0,
                  pinY: 58.0,
                  cuPhotoUrl: '/uploads/test/rb_z01_d01_v1.jpg',
                  notes: 'Vết nứt v1 rộng 2.2mm tại (48, 58)',
                },
              ],
            },
            {
              zoneCode: 'Z-02',
              floorName: 'Tầng 1',
              roomName: 'Phòng bếp thêm ở v1',
              componentType: 'WALL',
              pinX: 60.0,
              pinY: 70.0,
              ctxPhotoUrl: '/uploads/test/rb_z02_v1.jpg',
              defects: [
                {
                  defectCode: 'D-01',
                  screeningCategory: 'CRACK',
                  defectType: 'PLASTER_CRACK',
                  widthMaxMm: 1.5,
                  lengthMm: 700,
                  activityState: 'STABILIZED',
                  hasScaleCard: true,
                  pinX: 62.0,
                  pinY: 72.0,
                  cuPhotoUrl: '/uploads/test/rb_z02_d01_v1.jpg',
                  notes: 'Vết nứt Z-02/D-01 thêm ở v1 rộng 1.5mm',
                },
              ],
            },
          ],
          structuralElements: [
            {
              elementCode: 'E-01',
              floorName: 'Tầng 1',
              roomName: 'Cột gốc v0',
              componentType: 'COLUMN',
              pinX: 30.0,
              pinY: 40.0,
              conditionStatus: 'NORMAL',
              ctxPhotoUrl: '/uploads/test/rb_e01_v0.jpg',
              defects: [],
            },
            {
              elementCode: 'E-02',
              floorName: 'Tầng 1',
              roomName: 'Dầm chính thêm ở v1',
              componentType: 'BEAM',
              pinX: 80.0,
              pinY: 85.0,
              conditionStatus: 'DAMAGED',
              ctxPhotoUrl: '/uploads/test/rb_e02_v1.jpg',
              defects: [
                {
                  defectCode: 'D-01',
                  screeningCategory: 'CRACK',
                  defectType: 'HAIRLINE_CRACK',
                  widthMaxMm: 0.3,
                  lengthMm: 400,
                  activityState: 'STABILIZED',
                  hasScaleCard: true,
                  pinX: 82.0,
                  pinY: 87.0,
                  cuPhotoUrl: '/uploads/test/rb_e02_d01_v1.jpg',
                  notes: 'Vết rạn E-02/D-01 thêm ở v1',
                },
              ],
            },
          ],
        },
      ];

      const v1Updates = {
        ownerName: 'Chủ Hộ Phiên Bản V1',
        aboveFloors: 4,
        undergroundFloors: 1,
        constructionAreaM2: 240.0,
        settlementTilt: {
          buildingTilt: {
            level: 1,
            xPermille: 2.5,
            yPermille: -1.5,
            direction: 'Đông Bắc',
            notes: 'Độ nghiêng chuẩn tại V1',
          },
        },
        ecs: { e1: 1, e2: 1, e3: 1, e4: 1, e5: 1, e6: 1, totalEcs: 6, ecsClass: 'MEDIUM' },
        vi: { v1: 2, v2: 2, v3: 2, v4: 2, v5: 2, v6: 2, totalVi: 12, viAvg: 2.0, viClass: 'MEDIUM' },
        executiveSummary: {
          braStatus: 'MEDIUM',
          constructionImpactStatus: 'I2 (Tác động nhẹ)',
          summaryConclusions: 'Kết luận chuẩn tại Phiên bản V1',
          specificRecommendationsText: 'Kiến nghị chuẩn tại Phiên bản V1',
        },
        summaryConclusions: 'Kết luận chuẩn tại Phiên bản V1',
        engineeringRecommendations: 'Kiến nghị chuẩn tại Phiên bản V1',
        floors: v1Floors,
      };

      const edit1Res = await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'Chỉnh sửa lần 1: Chuẩn hóa dữ liệu lên Phiên bản V1',
        updates: v1Updates,
        diffPayload: [{ field: 'ownerName', label: 'Chủ hộ', oldValue: 'Chủ Hộ Ban Đầu', newValue: 'Chủ Hộ Phiên Bản V1' }],
      });
      assertEqual(edit1Res.success, true, 'Edit 1 succeeds (after auto-seeding v0)');

      // 2. Chỉnh sửa lần 2 (Tạo ra v2 = ADMIN_MODIFIED với dữ liệu bị thay đổi/xóa nhầm Z-01 và thêm Z-03)
      const v2Floors = [
        {
          floorId: 'FL-1',
          floorName: 'Tầng 1',
          floorLevel: 1,
          cadSketchUrl: '/uploads/test/rb_cad_z_v2.jpg',
          cadStructuralSketchUrl: '/uploads/test/rb_cad_e_v2.jpg',
          cadZonePins: [
            { zoneCode: 'Z-02', pinX: 90.0, pinY: 95.0 },
            { zoneCode: 'Z-03', pinX: 11.0, pinY: 22.0 },
          ],
          cadElementPins: [
            { elementCode: 'E-01', pinX: 30.0, pinY: 40.0 },
          ],
          zones: [
            {
              zoneCode: 'Z-01',
              floorName: 'Tầng 1',
              roomName: 'Phòng khách v1 (Bị xóa nhầm ở v2)',
              componentType: 'WALL',
              pinX: 45.0,
              pinY: 55.0,
              isDeleted: true,
              ctxPhotoUrl: '/uploads/test/rb_z01_v1.jpg',
              defects: [
                {
                  defectCode: 'D-01',
                  defectType: 'PLASTER_CRACK',
                  widthMaxMm: 2.2,
                  lengthMm: 950,
                  pinX: 48.0,
                  pinY: 58.0,
                  cuPhotoUrl: '/uploads/test/rb_z01_d01_v1.jpg',
                },
              ],
            },
            {
              zoneCode: 'Z-02',
              floorName: 'Tầng 1',
              roomName: 'Phòng bếp dời ghim sai ở v2',
              componentType: 'WALL',
              pinX: 90.0,
              pinY: 95.0,
              ctxPhotoUrl: '/uploads/test/rb_z02_v1.jpg',
              defects: [
                {
                  defectCode: 'D-01',
                  defectType: 'PLASTER_CRACK',
                  widthMaxMm: 9.9,
                  lengthMm: 700,
                  pinX: 91.0,
                  pinY: 96.0,
                  cuPhotoUrl: '/uploads/test/rb_z02_d01_v1.jpg',
                },
              ],
            },
            {
              zoneCode: 'Z-03',
              floorName: 'Tầng 1',
              roomName: 'Vùng Z-03 tạo thừa ở v2',
              componentType: 'WALL',
              pinX: 11.0,
              pinY: 22.0,
              ctxPhotoUrl: '/uploads/test/rb_z03_v2.jpg',
              defects: [
                {
                  defectCode: 'D-01',
                  defectType: 'STRUCTURAL_CRACK',
                  widthMaxMm: 5.0,
                  lengthMm: 1000,
                  pinX: 12.0,
                  pinY: 23.0,
                  cuPhotoUrl: '/uploads/test/rb_z03_d01_v2.jpg',
                },
              ],
            },
          ],
          structuralElements: [
            {
              elementCode: 'E-01',
              floorName: 'Tầng 1',
              roomName: 'Cột gốc v0',
              componentType: 'COLUMN',
              pinX: 30.0,
              pinY: 40.0,
              conditionStatus: 'NORMAL',
              ctxPhotoUrl: '/uploads/test/rb_e01_v0.jpg',
              defects: [],
            },
            {
              elementCode: 'E-02',
              floorName: 'Tầng 1',
              roomName: 'Dầm chính bị xóa nhầm ở v2',
              componentType: 'BEAM',
              pinX: 80.0,
              pinY: 85.0,
              isDeleted: true,
              conditionStatus: 'DAMAGED',
              ctxPhotoUrl: '/uploads/test/rb_e02_v1.jpg',
              defects: [],
            },
          ],
        },
      ];

      const v2Updates = {
        ownerName: 'Chủ Hộ Phiên Bản V2 (Sửa Sai)',
        aboveFloors: 9,
        undergroundFloors: 2,
        settlementTilt: {
          buildingTilt: {
            level: 2,
            xPermille: 8.8,
            yPermille: -6.6,
            direction: 'Tây Nam',
          },
        },
        ecs: { e1: 3, e2: 3, e3: 2, e4: 2, e5: 2, e6: 2, totalEcs: 14, ecsClass: 'POOR' },
        vi: { v1: 4, v2: 4, v3: 3, v4: 3, v5: 3, v6: 4, totalVi: 21, viAvg: 3.5, viClass: 'HIGH' },
        summaryConclusions: 'Kết luận bị sửa sai tại V2',
        engineeringRecommendations: 'Kiến nghị bị sửa sai tại V2',
        floors: v2Floors,
      };

      const edit2Res = await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
        adminPassword: testPassword,
        editReason: 'Chỉnh sửa lần 2: Giả lập nhập sai ở Phiên bản V2',
        updates: v2Updates,
        diffPayload: [{ field: 'ownerName', label: 'Chủ hộ', oldValue: 'Chủ Hộ Phiên Bản V1', newValue: 'Chủ Hộ Phiên Bản V2 (Sửa Sai)' }],
      });
      assertEqual(edit2Res.success, true, 'Edit 2 succeeds');

      // 3. Kiểm tra History List & Version Snapshots (v0, v1, v2)
      const historyBeforeRb = await AuditVersionService.getVersionList(reportId);
      assertEqual(historyBeforeRb.length, 3, 'Version list has 3 versions (v2, v1, v0)');
      assertEqual(historyBeforeRb.map((v) => v.versionNumber).join(','), '2,1,0', 'Version numbers are 2,1,0');
      assertEqual(historyBeforeRb.map((v) => v.versionTag).join(','), 'ADMIN_DIFF_SAVE,ADMIN_DIFF_SAVE,ORIGINAL_SUBMISSION', 'Version tags for v2,v1,v0');

      const snapV1 = await AuditVersionService.getVersionSnapshot(reportId, 1);
      const snapV2 = await AuditVersionService.getVersionSnapshot(reportId, 2);
      assertEqual(snapV1.versionNumber, 1, 'getVersionSnapshot v1 versionNumber = 1');
      assertEqual(snapV2.versionNumber, 2, 'getVersionSnapshot v2 versionNumber = 2');

      // 4. ROLLBACK LẦN 1: Khôi phục từ v2 về v1 (Tạo ra v3 = ROLLBACK_RESTORE)
      const rbToV1Res = await AuditVersionService.rollbackToVersion(
        reportId,
        1,
        adminId,
        {
          reason: 'Khôi phục về phiên bản v1 do phiên bản v2 nhập sai số tầng và xóa nhầm Z-01, E-02',
          password: testPassword,
        }
      );
      assertEqual(rbToV1Res.newVersionNumber, 3, 'Rollback v2 -> v1 creates v3');
      assertEqual(rbToV1Res.targetVersionNumber, 1, 'targetVersionNumber = 1');

      // Kiểm chứng toàn vẹn dữ liệu SQL sau Rollback về v1:
      const pAfterRb1 = await Database.query<{ owner_name: string; floor_count: number }>(`SELECT owner_name, floor_count FROM parcels WHERE id = $1;`, [parcelId]);
      assertEqual(pAfterRb1.rows[0].owner_name, 'Chủ Hộ Phiên Bản V1', 'After Rollback to v1: parcels.owner_name');
      assertEqual(Number(pAfterRb1.rows[0].floor_count), 4, 'After Rollback to v1: parcels.floor_count');

      const defAfterRb1 = await Database.query<{ tilt_angle_x: string; tilt_angle_y: string }>(`SELECT tilt_angle_x, tilt_angle_y FROM deformation_assessments WHERE report_id = $1;`, [reportId]);
      assertEqual(Number(defAfterRb1.rows[0].tilt_angle_x), 2.5, 'After Rollback to v1: tilt_angle_x preserved as 2.5 permille (no /10 bug)');
      assertEqual(Number(defAfterRb1.rows[0].tilt_angle_y), -1.5, 'After Rollback to v1: tilt_angle_y preserved as -1.5 permille');

      const dzAfterRb1 = await Database.query<{ zone_code: string; is_deleted: boolean }>(
        `SELECT zone_code, is_deleted FROM damage_zones WHERE report_id = $1 ORDER BY zone_code ASC;`,
        [reportId]
      );
      const fsAfterRb1 = await Database.query<{ cad_zone_pins_json: any[] }>(
        `SELECT cad_zone_pins_json FROM floor_surveys WHERE report_id = $1 AND floor_name = 'Tầng 1';`,
        [reportId]
      );
      assertEqual(dzAfterRb1.rows.find((r) => r.zone_code === 'Z-01')?.is_deleted, false, 'After Rollback to v1: Z-01 is restored (is_deleted = false)');
      assertEqual(Number(fsAfterRb1.rows[0].cad_zone_pins_json.find((p: any) => p.zoneCode === 'Z-01')?.pinX), 45.0, 'After Rollback to v1: Z-01 pinX = 45.0');
      assertEqual(dzAfterRb1.rows.find((r) => r.zone_code === 'Z-02')?.is_deleted, false, 'After Rollback to v1: Z-02 is active');
      assertEqual(Number(fsAfterRb1.rows[0].cad_zone_pins_json.find((p: any) => p.zoneCode === 'Z-02')?.pinX), 60.0, 'After Rollback to v1: Z-02 pinX restored from 90.0 back to 60.0');
      assertEqual(dzAfterRb1.rows.find((r) => r.zone_code === 'E-02')?.is_deleted, false, 'After Rollback to v1: E-02 is restored (is_deleted = false)');
      assertEqual(dzAfterRb1.rows.find((r) => r.zone_code === 'Z-03')?.is_deleted, true, 'After Rollback to v1: post-v1 zone Z-03 is soft-deleted (is_deleted = true)');

      // 5. ROLLBACK LẦN 2: Khôi phục tiếp từ v3 về v0 (Bản nộp thực địa ban đầu) -> Tạo ra v4 = ROLLBACK_RESTORE
      const rbToV0Res = await AuditVersionService.rollbackToVersion(
        reportId,
        0,
        adminId,
        {
          reason: 'Kiểm tra khôi phục hoàn toàn về bản gốc v0 ban đầu',
          password: testPassword,
        }
      );
      assertEqual(rbToV0Res.newVersionNumber, 4, 'Rollback v3 -> v0 creates v4');
      assertEqual(rbToV0Res.targetVersionNumber, 0, 'targetVersionNumber = 0');

      const pAfterRb0 = await Database.query<{ owner_name: string; floor_count: number }>(`SELECT owner_name, floor_count FROM parcels WHERE id = $1;`, [parcelId]);
      assertEqual(pAfterRb0.rows[0].owner_name, 'Chủ Hộ Ban Đầu', 'After Rollback to v0: parcels.owner_name restored to baseline');
      assertEqual(Number(pAfterRb0.rows[0].floor_count), 2, 'After Rollback to v0: parcels.floor_count restored to 2');

      const dzAfterRb0 = await Database.query<{ zone_code: string; is_deleted: boolean }>(
        `SELECT zone_code, is_deleted FROM damage_zones WHERE report_id = $1 ORDER BY zone_code ASC;`,
        [reportId]
      );
      const fsAfterRb0 = await Database.query<{ cad_zone_pins_json: any[] }>(
        `SELECT cad_zone_pins_json FROM floor_surveys WHERE report_id = $1 AND floor_name = 'Tầng 1';`,
        [reportId]
      );
      assertEqual(dzAfterRb0.rows.find((r) => r.zone_code === 'Z-01')?.is_deleted, false, 'After Rollback to v0: Z-01 is active');
      assertEqual(Number(fsAfterRb0.rows[0].cad_zone_pins_json.find((p: any) => p.zoneCode === 'Z-01')?.pinX), 10.0, 'After Rollback to v0: Z-01 pinX restored to 10.0');
      assertEqual(dzAfterRb0.rows.find((r) => r.zone_code === 'E-01')?.is_deleted, false, 'After Rollback to v0: E-01 is active');
      assertEqual(dzAfterRb0.rows.find((r) => r.zone_code === 'Z-02')?.is_deleted, true, 'After Rollback to v0: Z-02 (created in v1) is soft-deleted');
      assertEqual(dzAfterRb0.rows.find((r) => r.zone_code === 'E-02')?.is_deleted, true, 'After Rollback to v0: E-02 (created in v1) is soft-deleted');
      assertEqual(dzAfterRb0.rows.find((r) => r.zone_code === 'Z-03')?.is_deleted, true, 'After Rollback to v0: Z-03 (created in v2) is soft-deleted');

      // 6. ROLLBACK LẦN 3: Khôi phục ngược lại từ v4 lên v1 (Tạo ra v5 = ROLLBACK_RESTORE) rồi Phê duyệt (Tạo ra v6 = APPROVED_RELEASE)
      const rbBackToV1Res = await AuditVersionService.rollbackToVersion(
        reportId,
        1,
        adminId,
        {
          reason: 'Khôi phục lại phiên bản thẩm định chuẩn v1 để tiến hành phê duyệt chính thức',
          password: testPassword,
        }
      );
      assertEqual(rbBackToV1Res.newVersionNumber, 5, 'Rollback v4 -> v1 creates v5');

      await AuditReviewService.approveReport(reportId, adminId);

      // 7. Kiểm tra tính toàn vẹn chuỗi số thứ tự phiên bản (Version Sequence Integrity: 0, 1, 2, 3, 4, 5, 6)
      const finalVersionList = await AuditVersionService.getVersionList(reportId);
      const ascVersions = [...finalVersionList].sort((a, b) => a.versionNumber - b.versionNumber);
      assertEqual(ascVersions.map((v) => v.versionNumber).join(','), '0,1,2,3,4,5,6', 'Strictly continuous versionNumber sequence 0..6');
      assertEqual(
        ascVersions.map((v) => v.versionTag).join(','),
        'ORIGINAL_SUBMISSION,ADMIN_DIFF_SAVE,ADMIN_DIFF_SAVE,ROLLBACK_RESTORE,ROLLBACK_RESTORE,ROLLBACK_RESTORE,APPROVED_RELEASE',
        'Exact versionTag sequence across edits, multi-rollbacks, and approval'
      );

      // 8. Kiểm tra ReportV2ViewModel sau khi Approve ở v6 khớp 100% với dữ liệu của v1
      const reportForRender = await loadApprovedReportForRender(reportId);
      const vm = ReportV2ViewModelMapper.buildViewModel(reportForRender);
      assertEqual(vm.section1.ownerName, 'Chủ Hộ Phiên Bản V1', 'Final Approved VM ownerName matches v1');
      assertEqual(vm.section2.storeysAbove, 4, 'Final Approved VM storeysAbove matches v1');
      assertEqual(vm.section2.storeysBasement, 1, 'Final Approved VM storeysBasement matches v1');
      assertIncludes(vm.section5.buildingInclination.measured, '2.500‰', 'Final Approved VM tiltX matches v1 (2.500‰)');
      assertIncludes(vm.section5.buildingInclination.measured, '-1.500‰', 'Final Approved VM tiltY matches v1 (-1.500‰)');
      assertEqual(vm.section8.ecs.totalScore, 6, 'Final Approved VM ECS matches v1');
      assertEqual(vm.section8.vi.totalScore, 12, 'Final Approved VM VI matches v1');
      assertIncludes(vm.section9.conclusions.map((c) => c.vi).join(' | '), 'Kết luận chuẩn tại Phiên bản V1', 'Final Approved VM conclusions match v1');

      const flVm = vm.appendix2[0];
      assertEqual(flVm.cadPins?.filter((p) => p.type === 'ZONE').map((p) => `${p.code}@(${p.pinX},${p.pinY})`).join(','), 'Z-01@(45,55),Z-02@(60,70)', 'Final Approved VM cadPins ZONE match v1');
      assertEqual(flVm.cadStructuralPins?.map((p) => `${p.code}@(${p.pinX},${p.pinY})`).join(','), 'E-01@(30,40),E-02@(80,85)', 'Final Approved VM cadStructuralPins match v1');
      assertEqual(
        flVm.defectSummaryRows.map((r) => `${r.no}:${r.cadPinRef?.split(' tại ')[1]}/${r.defectId}(${r.widthMm})`).join(','),
        '1:Z-01/D-01(2.2 mm),2:Z-02/D-01(1.5 mm),3:E-02/D-01(0.3 mm)',
        'Final Approved VM defectSummaryRows match v1 with continuous no 1,2,3'
      );
      assertEqual(
        flVm.zoneAndElementConditions.map((c) => c.code).join(','),
        'Z-01,Z-02,E-01,E-02',
        'Final Approved VM zoneAndElementConditions match v1'
      );

      const pairZ01D01 = flVm.defectPairPhotos.find((p) => p.cadPinRef?.includes('Z-01') && p.defectId === 'D-01')!;
      const pairE02D01 = flVm.defectPairPhotos.find((p) => p.cadPinRef?.includes('E-02') && p.defectId === 'D-01')!;
      assertEqual(pairZ01D01.pinX, 48.0, 'Final Approved VM Z-01/D-01 pinX matches v1');
      assertEqual(pairZ01D01.pinY, 58.0, 'Final Approved VM Z-01/D-01 pinY matches v1');
      assertEqual(pairE02D01.pinX, 82.0, 'Final Approved VM E-02/D-01 pinX matches v1');
      assertEqual(pairE02D01.pinY, 87.0, 'Final Approved VM E-02/D-01 pinY matches v1');
    });

    // =========================================================================
    // TEST SUITE 7: CHUẨN HÓA CHIỀU ẢNH (ORIENTATION STANDARDS), BỎ RÀNG BUỘC ẢNH VUÔNG,
    // XOAY ẢNH 90° KÈM CHUYỂN VỊ GHIM Z_CTX/CAD & BÀN GIAO XOAY VẬT LÝ SANG REPORT V3
    // =========================================================================
    await runTest(
      'TC-PHOTO-ORIENTATION-AND-ROTATION-V3',
      'Chuẩn hóa chiều ảnh 24 vị trí, bỏ ràng buộc ảnh vuông (w===h luôn hợp lệ), xoay ảnh 90° kèm chuyển vị ghim Z_CTX/CAD (100-y, x) & xoay vật lý Base64 sang Report V3 (kể cả Mục XII 2 cột dọc)',
      async () => {
        const { RESIDENTIAL_PHOTO_RULES, evaluateResidentialOrientation } = loadFrontendOrientationStandards();
        // 1. Kiểm chứng bộ quy chuẩn chiều ảnh (residentialPhotoOrientationStandards.ts)
        assertEqual(RESIDENTIAL_PHOTO_RULES.CAD_SKETCH.expected, 'PORTRAIT', 'CAD_SKETCH expected = PORTRAIT');
        assertEqual(RESIDENTIAL_PHOTO_RULES.CAD_SKETCH.isStrict, true, 'CAD_SKETCH isStrict = true');
        assertEqual(RESIDENTIAL_PHOTO_RULES.AS_BUILT_DRAWING.expected, 'PORTRAIT', 'AS_BUILT_DRAWING expected = PORTRAIT');
        assertEqual(RESIDENTIAL_PHOTO_RULES.AS_BUILT_DRAWING.isStrict, false, 'AS_BUILT_DRAWING isStrict = false');
        assertEqual(RESIDENTIAL_PHOTO_RULES.ABSENCE_NOTICE.expected, 'PORTRAIT', 'ABSENCE_NOTICE expected = PORTRAIT');
        assertEqual(RESIDENTIAL_PHOTO_RULES.ABSENCE_NOTICE.isStrict, false, 'ABSENCE_NOTICE isStrict = false');
        assertEqual(RESIDENTIAL_PHOTO_RULES.Z_CTX.expected, 'LANDSCAPE', 'Z_CTX expected = LANDSCAPE');
        assertEqual(RESIDENTIAL_PHOTO_RULES.Z_CTX.isStrict, true, 'Z_CTX isStrict = true');
        assertEqual(RESIDENTIAL_PHOTO_RULES.D_CU.expected, 'LANDSCAPE', 'D_CU expected = LANDSCAPE');
        assertEqual(RESIDENTIAL_PHOTO_RULES.D_CU.isStrict, true, 'D_CU isStrict = true');

        // Kiểm chứng bỏ ràng buộc ảnh vuông (SQUARE w === h luôn hợp lệ cho cả loại ảnh Ngang và Dọc, kể cả isStrict = true)
        const sqZCtx = evaluateResidentialOrientation(700, 700, 0, 'Z_CTX');
        assertEqual(sqZCtx.currentOrientation, 'SQUARE', '700x700 currentOrientation = SQUARE');
        assertEqual(sqZCtx.isValid, true, 'Square image 700x700 is valid for strict LANDSCAPE Z_CTX');
        const sqCad = evaluateResidentialOrientation(700, 700, 90, 'CAD_SKETCH');
        assertEqual(sqCad.isValid, true, 'Square image 700x700 rotated 90° is valid for strict PORTRAIT CAD_SKETCH');

        // Kiểm chứng không còn buffer 1.08 (801x800 là LANDSCAPE, 800x801 là PORTRAIT)
        const nearSqLand = evaluateResidentialOrientation(801, 800, 0, 'Z_CTX');
        assertEqual(nearSqLand.currentOrientation, 'LANDSCAPE', '801x800 is LANDSCAPE without 1.08 buffer');
        assertEqual(nearSqLand.isValid, true, '801x800 is valid for Z_CTX');
        const nearSqPort = evaluateResidentialOrientation(800, 801, 0, 'CAD_SKETCH');
        assertEqual(nearSqPort.currentOrientation, 'PORTRAIT', '800x801 is PORTRAIT without 1.08 buffer');
        assertEqual(nearSqPort.isValid, true, '800x801 is valid for CAD_SKETCH');

        // Kiểm chứng phát hiện ngược chiều và tự hết lỗi sau khi xoay +90°
        const wrongCad = evaluateResidentialOrientation(800, 600, 0, 'CAD_SKETCH');
        assertEqual(wrongCad.isValid, false, 'Landscape 800x600 CAD_SKETCH at 0° is invalid');
        const fixedCad = evaluateResidentialOrientation(800, 600, 90, 'CAD_SKETCH');
        assertEqual(fixedCad.isValid, true, 'Landscape 800x600 CAD_SKETCH rotated 90° becomes valid PORTRAIT (600x800)');

        const wrongZCtx = evaluateResidentialOrientation(600, 800, 0, 'Z_CTX');
        assertEqual(wrongZCtx.isValid, false, 'Portrait 600x800 Z_CTX at 0° is invalid');
        const fixedZCtx = evaluateResidentialOrientation(600, 800, 90, 'Z_CTX');
        assertEqual(fixedZCtx.isValid, true, 'Portrait 600x800 Z_CTX rotated 90° becomes valid LANDSCAPE (800x600)');

        // 2. Tạo file ảnh vật lý thực tế (800x600 Landscape và 600x800 Portrait) trong thư mục uploads/test_orient_v3
        const testUploadDir = path.resolve(process.cwd(), 'uploads/test_orient_v3');
        fs.mkdirSync(testUploadDir, { recursive: true });
        const landFile = path.join(testUploadDir, 'raw_landscape_800x600.jpg');
        const portFile = path.join(testUploadDir, 'raw_portrait_600x800.jpg');

        await sharp({
          create: { width: 800, height: 600, channels: 3, background: { r: 40, g: 120, b: 200 } },
        })
          .jpeg({ quality: 85 })
          .toFile(landFile);

        await sharp({
          create: { width: 600, height: 800, channels: 3, background: { r: 200, g: 80, b: 60 } },
        })
          .jpeg({ quality: 85 })
          .toFile(portFile);

        const landUrl = '/uploads/test_orient_v3/raw_landscape_800x600.jpg';
        const portUrl = '/uploads/test_orient_v3/raw_portrait_600x800.jpg';

        const getBase64Dims = async (b64DataUri: string | undefined): Promise<{ width: number; height: number }> => {
          assert(Boolean(b64DataUri && b64DataUri.startsWith('data:image/')), 'Expected valid data:image/... base64 string');
          const rawB64 = b64DataUri!.split(',')[1];
          const meta = await sharp(Buffer.from(rawB64, 'base64')).metadata();
          return { width: meta.width || 0, height: meta.height || 0 };
        };

        try {
          const { reportId } = await createIsolatedResidentialReport('ORIENT-V3');

          // Giả lập công thức chuyển vị tọa độ ghim +90° clockwise: (x, y) -> (100 - y, x)
          const rotatePin90CW = (x: number, y: number) => ({
            pinX: Math.round(Math.max(1, Math.min(99, 100 - y)) * 10) / 10,
            pinY: Math.round(Math.max(1, Math.min(99, x)) * 10) / 10,
          });

          // Ban đầu: CAD Z-01 ở (20, 30) -> sau xoay CAD 90° thành (70, 20)
          // Ban đầu: Z_CTX D-01 ở (25, 40) -> sau xoay Z_CTX 90° thành (60, 25)
          const rotatedCadPinZ01 = rotatePin90CW(20, 30);
          const rotatedCtxPinD01 = rotatePin90CW(25, 40);
          assertEqual(rotatedCadPinZ01.pinX, 70, 'Rotated CAD pinX (100 - 30 = 70)');
          assertEqual(rotatedCadPinZ01.pinY, 20, 'Rotated CAD pinY (x = 20)');
          assertEqual(rotatedCtxPinD01.pinX, 60, 'Rotated Z_CTX D-01 pinX (100 - 40 = 60)');
          assertEqual(rotatedCtxPinD01.pinY, 25, 'Rotated Z_CTX D-01 pinY (x = 25)');

          const photoRotations: Record<string, number> = {
            photoP01: 90, // landUrl (800x600) -> 600x800 (PORTRAIT)
            photoP03_extra_0: 90, // landUrl (800x600) -> 600x800 (PORTRAIT)
            buildingTilt: 90, // landUrl (800x600) -> 600x800 (PORTRAIT P-05)
            diffSettlement: 90, // portUrl (600x800) -> 800x600 (LANDSCAPE P-06)
            abnormalCase: 90, // landUrl (800x600) -> 600x800 (PORTRAIT P-07)
            asBuiltDrawing_0: 90, // landUrl (800x600) -> 600x800 (PORTRAIT Section XII #1)
            asBuiltDrawing_1: 90, // landUrl (800x600) -> 600x800 (PORTRAIT Section XII #2)
            floor_0_cad: 90, // landUrl (800x600) -> 600x800 (PORTRAIT CAD_01)
            'zone_f0_zZ-01_ctx': 90, // portUrl (600x800) -> 800x600 (LANDSCAPE Z_CTX)
            'defect_f0_zZ-01_dD-01_cu_0': 90, // portUrl (600x800) -> 800x600 (LANDSCAPE D_CU #1)
            'defect_f0_zZ-01_dD-01_cu_1': 90, // portUrl (600x800) -> 800x600 (LANDSCAPE D_CU #2 extra)
            'elem_f0_eE-01_ctx': 90, // landUrl (800x600) -> 600x800 (PORTRAIT E_COL)
            'defect_f0_eE-01_dD-01_cu': 90, // portUrl (600x800) -> 800x600 (LANDSCAPE E_COL/D_CU)
            minutes_0: 90, // landUrl (800x600) -> 600x800 (PORTRAIT Appendix 3)
          };

          const updatesPayload = {
            photoP01: { url: landUrl, caption: 'P-01 xoay 90° sang Dọc' },
            photoP02: { url: portUrl, caption: 'P-02 Dọc nguyên bản' },
            photoP03: {
              url: portUrl,
              tag: 'P03_TRI',
              additionalPhotos: [{ url: landUrl, tag: 'P03_PHI' }],
            },
            photoP04: { url: landUrl, caption: 'P-04 Ngang nguyên bản' },
            settlementTilt: {
              buildingTilt: {
                level: 1,
                xPermille: 1.8,
                yPermille: -0.9,
                direction: 'Đông',
                photos: [{ url: landUrl, photoCode: 'P05_TILT_ROT' }],
              },
              diffSettlement: {
                level: 1,
                position: 'Góc móng trục A',
                photos: [{ url: portUrl, photoCode: 'P06_SETTLE_ROT' }],
              },
              abnormalCase: {
                hasAbnormal: true,
                description: 'Nứt bậc tam cấp',
                photos: [{ url: landUrl, photoCode: 'P07_ABN_ROT' }],
              },
            },
            asBuiltDrawingPhotos: [
              { url: landUrl, photoCode: 'CAT-DWG-01', title: 'Bản vẽ hoàn công móng #1 (xoay Dọc)' },
              { url: landUrl, photoCode: 'CAT-DWG-02', title: 'Bản vẽ hoàn công móng #2 (xoay Dọc)' },
            ],
            floors: [
              {
                floorName: 'Tầng 1',
                floorLevel: 1,
                cadSketchPhotoUrl: landUrl,
                cadSketchRotation: 90,
                cadZonePins: [{ zoneCode: 'Z-01', pinX: rotatedCadPinZ01.pinX, pinY: rotatedCadPinZ01.pinY }],
                cadElementPins: [{ zoneCode: 'E-01', elementCode: 'E-01', pinX: 75, pinY: 25 }],
                zones: [
                  {
                    zoneCode: 'Z-01',
                    floorName: 'Tầng 1',
                    roomName: 'Phòng khách',
                    componentType: 'WALL',
                    wallMaterial: 'Tường gạch',
                    pinX: rotatedCadPinZ01.pinX,
                    pinY: rotatedCadPinZ01.pinY,
                    ctxPhotoUrl: portUrl,
                    defects: [
                      {
                        defectCode: 'D-01',
                        defectType: 'Vết nứt tường',
                        widthMaxMm: 1.2,
                        lengthMm: 800,
                        activityState: 'S',
                        hasScaleCard: true,
                        pinX: rotatedCtxPinD01.pinX,
                        pinY: rotatedCtxPinD01.pinY,
                        cuPhotoUrl: portUrl,
                        cuPhotos: [portUrl, portUrl],
                        notes: 'Nứt tường đã xoay CTX 90° & chuyển vị ghim D',
                      },
                    ],
                  },
                ],
                structuralElements: [
                  {
                    elementCode: 'E-01',
                    floorName: 'Tầng 1',
                    roomName: 'Trục cột C1',
                    elementType: 'Cột BTCT',
                    materialType: 'BTCT',
                    pinX: 75,
                    pinY: 25,
                    ctxPhotoUrl: landUrl,
                    defects: [
                      {
                        defectCode: 'D-01',
                        defectType: 'Nứt cột BTCT',
                        widthMaxMm: 0.4,
                        lengthMm: 500,
                        activityState: 'S',
                        hasScaleCard: true,
                        pinX: 50,
                        pinY: 50,
                        cuPhotoUrl: portUrl,
                        cuPhotos: [portUrl],
                        notes: 'Nứt cột E-01/D-01',
                      },
                    ],
                  },
                ],
              },
            ],
            signatures: {
              workingMinutesPhotos: [{ url: landUrl, photoCode: 'BB_01', caption: 'Trang biên bản 1 (xoay Dọc)' }],
            },
            photoRotations,
          };

          await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, {
            adminPassword: testPassword,
            editReason: 'TC-PHOTO-ORIENTATION-AND-ROTATION-V3: Xoay chuẩn hóa chiều ảnh & chuyển vị ghim',
            updates: updatesPayload,
            diffPayload: [{ field: 'photoRotations', label: 'Xoay ảnh chuẩn hóa chiều', oldValue: {}, newValue: photoRotations }],
          });

          // Kiểm chứng computeDeepLegalHash thay đổi khi photoRotations thay đổi
          const dummyScores = ReportSnapshotService.resolveScores(updatesPayload, null, 2);
          const hashWithRot = ReportSnapshotService.computeDeepLegalHash(dummyScores, updatesPayload, {});
          const hashWithoutRot = ReportSnapshotService.computeDeepLegalHash(dummyScores, { ...updatesPayload, photoRotations: {} }, {});
          assert(hashWithRot !== hashWithoutRot, 'ReportSnapshotService.computeDeepLegalHash must change when photoRotations changes');

          await AuditReviewService.approveReport(reportId, adminId);

          // 3. Render qua ReportV2Service.generateResidentialHtmlFromReport (đường ống của Report V3)
          const reportForRender = await loadApprovedReportForRender(reportId);
          const { html, viewModel: vm } = await ReportV2Service.generateResidentialHtmlFromReport(reportForRender, undefined, false, false);

          // Kiểm tra Phụ lục 1 (P-01..P-07) đã được xoay vật lý bằng Sharp đúng chiều chuẩn
          const p01Item = vm.appendix1.find((p) => p.photoCode === 'P-01')!;
          const p01Dims = await getBase64Dims(p01Item.base64);
          assertEqual(p01Dims.width, 600, 'P-01 physical base64 width after 90° rotation = 600 (PORTRAIT)');
          assertEqual(p01Dims.height, 800, 'P-01 physical base64 height after 90° rotation = 800 (PORTRAIT)');

          const p03Items = vm.appendix1.filter((p) => p.photoCode === 'P-03');
          assertEqual(p03Items.length, 2, 'Appendix 1 has 2 P-03 items (main + extra_0)');
          const p03ExtraDims = await getBase64Dims(p03Items[1].base64);
          assertEqual(p03ExtraDims.width, 600, 'P-03 extra_0 physical base64 width after 90° rotation = 600 (PORTRAIT)');
          assertEqual(p03ExtraDims.height, 800, 'P-03 extra_0 physical base64 height after 90° rotation = 800 (PORTRAIT)');

          const p05Item = vm.appendix1.find((p) => p.photoCode === 'P-05')!;
          const p05Dims = await getBase64Dims(p05Item.base64);
          assertEqual(p05Dims.width, 600, 'P-05 (buildingTilt) physical base64 width after 90° rotation = 600 (PORTRAIT)');
          assertEqual(p05Dims.height, 800, 'P-05 (buildingTilt) physical base64 height after 90° rotation = 800 (PORTRAIT)');

          const p06Item = vm.appendix1.find((p) => p.photoCode === 'P-06')!;
          const p06Dims = await getBase64Dims(p06Item.base64);
          assertEqual(p06Dims.width, 800, 'P-06 (diffSettlement) physical base64 width after 90° rotation = 800 (LANDSCAPE)');
          assertEqual(p06Dims.height, 600, 'P-06 (diffSettlement) physical base64 height after 90° rotation = 600 (LANDSCAPE)');

          const p07Item = vm.appendix1.find((p) => p.photoCode === 'P-07')!;
          const p07Dims = await getBase64Dims(p07Item.base64);
          assertEqual(p07Dims.width, 600, 'P-07 (abnormalCase) physical base64 width after 90° rotation = 600 (PORTRAIT)');
          assertEqual(p07Dims.height, 800, 'P-07 (abnormalCase) physical base64 height after 90° rotation = 800 (PORTRAIT)');

          // Kiểm tra Section 5 (tiltPhoto & settlementPhoto)
          const sec5TiltDims = await getBase64Dims(vm.section5.tiltPhoto?.base64);
          assertEqual(sec5TiltDims.width, 600, 'Section 5 tiltPhoto base64 width = 600 (PORTRAIT)');
          const sec5SettleDims = await getBase64Dims(vm.section5.settlementPhoto?.base64);
          assertEqual(sec5SettleDims.width, 800, 'Section 5 settlementPhoto base64 width = 800 (LANDSCAPE)');

          // Kiểm tra Section XII (As-Built Drawings: xoay Dọc 600x800 + dàn trang 2 cột trái-phải 185mm)
          assertEqual(vm.section12AsBuilt?.hasDrawings, true, 'Section XII hasDrawings = true');
          assertEqual(vm.section12AsBuilt?.sheets[0].drawings.length, 2, 'Section XII sheet 1 has 2 drawings');
          const asBuiltDims = await getBase64Dims(vm.section12AsBuilt?.sheets[0].drawings[0].base64);
          assertEqual(asBuiltDims.width, 600, 'Section XII drawing #1 physical base64 width after 90° rotation = 600 (PORTRAIT)');
          assertEqual(asBuiltDims.height, 800, 'Section XII drawing #1 physical base64 height after 90° rotation = 800 (PORTRAIT)');
          assertIncludes(html, 'grid-template-columns: repeat(2, 1fr)', 'Section XII HTML uses 2-column side-by-side grid');
          assertIncludes(html, 'height: 185mm', 'Section XII HTML uses 185mm portrait drawing container height');

          // Kiểm tra Phụ lục 2: CAD_SKETCH (xoay Dọc 600x800), tọa độ ghim CAD (70, 20), Z_CTX & D_CU (xoay Ngang 800x600), tọa độ ghim D (60, 25), E_COL (xoay Dọc 600x800)
          const flVm = vm.appendix2[0];
          const cadDims = await getBase64Dims(flVm.damageMapBase64);
          assertEqual(cadDims.width, 600, 'Appendix 2 CAD_SKETCH physical base64 width after 90° rotation = 600 (PORTRAIT)');
          assertEqual(cadDims.height, 800, 'Appendix 2 CAD_SKETCH physical base64 height after 90° rotation = 800 (PORTRAIT)');
          assertEqual(flVm.cadPins?.find((p) => p.code === 'Z-01')?.pinX, 70, 'Appendix 2 CAD pin Z-01 pinX = 70 after 90° rotation');
          assertEqual(flVm.cadPins?.find((p) => p.code === 'Z-01')?.pinY, 20, 'Appendix 2 CAD pin Z-01 pinY = 20 after 90° rotation');

          const pairZ = flVm.defectPairPhotos.find((p) => p.cadPinRef?.includes('Z-01') && p.defectId === 'D-01')!;
          const zCtxDims = await getBase64Dims(pairZ.contextPhotoBase64);
          assertEqual(zCtxDims.width, 800, 'Z-01/D-01 contextPhotoBase64 (Z_CTX) physical width after 90° rotation = 800 (LANDSCAPE)');
          assertEqual(zCtxDims.height, 600, 'Z-01/D-01 contextPhotoBase64 (Z_CTX) physical height after 90° rotation = 600 (LANDSCAPE)');
          const zCu0Dims = await getBase64Dims(pairZ.closeUpPhotoBase64);
          assertEqual(zCu0Dims.width, 800, 'Z-01/D-01 closeUpPhotoBase64 (D_CU #1) physical width after 90° rotation = 800 (LANDSCAPE)');
          const zCu1Dims = await getBase64Dims(pairZ.extraCloseUpPhotoBase64);
          assertEqual(zCu1Dims.width, 800, 'Z-01/D-01 extraCloseUpPhotoBase64 (D_CU #2) physical width after 90° rotation = 800 (LANDSCAPE)');
          assertEqual(pairZ.pinX, 60, 'Z-01/D-01 pinX on Z_CTX = 60 after 90° rotation');
          assertEqual(pairZ.pinY, 25, 'Z-01/D-01 pinY on Z_CTX = 25 after 90° rotation');

          const pairE = flVm.defectPairPhotos.find((p) => p.cadPinRef?.includes('E-01') && p.defectId === 'D-01')!;
          const eCtxDims = await getBase64Dims(pairE.contextPhotoBase64);
          assertEqual(eCtxDims.width, 600, 'E-01/D-01 contextPhotoBase64 (E_COL) physical width after 90° rotation = 600 (PORTRAIT)');
          assertEqual(eCtxDims.height, 800, 'E-01/D-01 contextPhotoBase64 (E_COL) physical height after 90° rotation = 800 (PORTRAIT)');
          const eCuDims = await getBase64Dims(pairE.closeUpPhotoBase64);
          assertEqual(eCuDims.width, 800, 'E-01/D-01 closeUpPhotoBase64 (D_CU) physical width after 90° rotation = 800 (LANDSCAPE)');

          // Kiểm tra Phụ lục 3 (Biên bản hiện trường xoay Dọc 600x800)
          assertEqual(vm.appendix3.signedRecordPages?.length, 1, 'Appendix 3 has 1 signedRecordPage');
          const minDims = await getBase64Dims(vm.appendix3.signedRecordPages?.[0].base64);
          assertEqual(minDims.width, 600, 'Appendix 3 signedRecordPage[0] physical width after 90° rotation = 600 (PORTRAIT)');
          assertEqual(minDims.height, 800, 'Appendix 3 signedRecordPage[0] physical height after 90° rotation = 800 (PORTRAIT)');
        } finally {
          fs.rmSync(testUploadDir, { recursive: true, force: true });
        }
      }
    );

  } finally {
    // Cleanup all temporary test records and restore admin password hash
    if (origPasswordHash) {
      await Database.query(`UPDATE users SET password_hash = $1 WHERE id = $2;`, [origPasswordHash, adminId]);
    }
    for (const rId of createdReportIds) {
      await Database.query(`DELETE FROM survey_report_versions WHERE report_id = $1;`, [rId]);
      await Database.query(`DELETE FROM system_audit_logs WHERE entity_id = $1;`, [rId]);
      await Database.query(`DELETE FROM defect_items WHERE zone_id IN (SELECT id FROM damage_zones WHERE report_id = $1);`, [rId]);
      await Database.query(`DELETE FROM damage_zones WHERE report_id = $1;`, [rId]);
      await Database.query(`DELETE FROM floor_surveys WHERE report_id = $1;`, [rId]);
      await Database.query(`DELETE FROM survey_identification_photos WHERE report_id = $1;`, [rId]);
      await Database.query(`DELETE FROM building_specifications WHERE report_id = $1;`, [rId]);
      await Database.query(`DELETE FROM historical_sensitivities WHERE report_id = $1;`, [rId]);
      await Database.query(`DELETE FROM deformation_assessments WHERE report_id = $1;`, [rId]);
      await Database.query(`DELETE FROM survey_scopes WHERE report_id = $1;`, [rId]);
      await Database.query(`DELETE FROM risk_score_cards WHERE report_id = $1;`, [rId]);
      await Database.query(`DELETE FROM base_survey_reports WHERE id = $1;`, [rId]);
    }
    for (const uId of createdUnitIds) {
      await Database.query(`DELETE FROM building_units WHERE id = $1;`, [uId]);
    }
    for (const pId of createdParcelIds) {
      await Database.query(`DELETE FROM parcels WHERE id = $1;`, [pId]);
    }
    // Clean up any leftover test records from previous interrupted run
    await Database.query(`DELETE FROM risk_score_cards WHERE report_id IN (SELECT id FROM base_survey_reports WHERE report_code LIKE 'BC-TEST-%' OR report_code LIKE 'CONDO-TEST-%');`);
    await Database.query(`DELETE FROM base_survey_reports WHERE report_code LIKE 'BC-TEST-%' OR report_code LIKE 'CONDO-TEST-%';`);
    await Database.query(`DELETE FROM parcels WHERE project_parcel_code LIKE 'TEST-%' OR official_cadastral_code = 'DC-INIT-001';`);
    await pool.end();
  }

  console.log('\n================================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const totalAssertions = results.reduce((acc, r) => acc + r.assertionsCount, 0);
  console.log(`📊 KẾT QUẢ TỔNG HỢP: ${passedCount}/${results.length} Test Cases PASSED (${totalAssertions} assertions verified)`);
  console.log('================================================================================');

  if (passedCount < results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
