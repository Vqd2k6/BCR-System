import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Database, pool } from '../database/db';
import { AuditModificationService } from '../modules/audit/services/audit-modification.service';
import { AuditReviewService } from '../modules/audit/services/audit-review.service';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';
import { CryptoUtils } from '../common/utils/crypto.utils';

async function runComprehensiveE2ETest() {
  console.log('================================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN THẨM ĐỊNH ĐIỀU CHỈNH HỒ SƠ KHẢO SÁT (E2E)');
  console.log('   FE - BE - DATABASE - VERSION SNAPSHOTS (v0 vs v1)');
  console.log('================================================================================\n');

  // 1. Lấy hoặc tạo Admin user
  const adminRes = await Database.query<{ id: string; role: string }>(
    `SELECT id, role FROM users WHERE role IN ('ZONE_ADMIN', 'SUPER_ADMIN') LIMIT 1;`
  );
  if (!adminRes.rows[0]) {
    console.error('❌ Không tìm thấy tài khoản Zone Admin!');
    process.exit(1);
  }
  const adminId = adminRes.rows[0].id;
  const testPassword = 'AdminPassword123!';
  const newHash = await CryptoUtils.hashPassword(testPassword);
  await Database.query(`UPDATE users SET password_hash = $1 WHERE id = $2;`, [newHash, adminId]);
  console.log(`👤 1. Admin tài khoản: ${adminId} (${adminRes.rows[0].role}) - Đã sẵn sàng.`);

  // 2. Tạo Thửa đất & Hồ sơ khảo sát thử nghiệm riêng biệt để đảm bảo cô lập hoàn toàn
  const zoneRes = await Database.query<{ zone_id: string }>(
    `SELECT DISTINCT zone_id FROM parcels WHERE zone_id IS NOT NULL LIMIT 1;`
  );
  const zoneId = zoneRes.rows[0]?.zone_id || 'ZONE_01';

  const testParcelCode = `TEST_PARCEL_${Date.now()}`;
  const parcelInsert = await Database.query<{ id: string }>(
    `INSERT INTO parcels (
       zone_id, project_parcel_code, house_number, street, owner_name, survey_status, lifecycle_status, created_at, updated_at
     ) VALUES (
       $1, $2, '100', 'Đường Khởi Tạo, Quận 1', 'Nguyễn Văn Gốc (Phiên bản v0)', 'SUBMITTED', 'ACTIVE', NOW(), NOW()
     ) RETURNING id;`,
    [zoneId, testParcelCode]
  );
  const parcelId = parcelInsert.rows[0].id;

  // Dữ liệu ban đầu (Baseline - v0) bao phủ tất cả các phần mục nội dung:
  const baselineSurveyJson: any = {
    parcelCode: testParcelCode,
    ownerName: 'Nguyễn Văn Gốc (Phiên bản v0)',
    address: '100 Đường Khởi Tạo, Quận 1, TP.HCM',
    buildingSpecs: {
      structureType: 'NHA_CAP_4',
      roofType: 'MAI_TON',
      wallType: 'TUONG_GACH_100',
      foundationType: 'MONG_DON',
      floorsCount: 1,
    },
    photoP01: { url: 'https://example.com/p01_v0_original.jpg', photoCode: 'P01', notApplicable: false },
    photoP02: { url: 'https://example.com/p02_v0_facade.jpg', photoCode: 'P02', notApplicable: false },
    photoP03: { url: 'https://example.com/p03_v0_side.jpg', photoCode: 'P03', notApplicable: false },
    photoP04: { url: 'https://example.com/p04_v0_street.jpg', photoCode: 'P04', notApplicable: false },
    floors: [
      {
        id: 'floor-g',
        floorNumber: 1,
        floorName: 'Tầng Trệt',
        cadArchitecturalSketchPhotoUrl: 'https://example.com/cad_floor_g_v0.jpg',
        structuralElements: [
          {
            id: 'elem-c1',
            elementCode: 'E-COL-C1',
            elementType: 'COT',
            locationDescription: 'Cột trục A1',
            ctxPhotoUrl: 'https://example.com/elem_c1_ctx_v0.jpg',
            defects: [
              {
                id: 'defect-d1',
                defectCode: 'D-ORIG-01',
                defectType: 'CRACK',
                severity: 'MEDIUM',
                widthMaxMm: 0.2,
                lengthMm: 100,
                cuPhotoUrl: 'https://example.com/d1_cu_v0.jpg',
                pinX: 20.0,
                pinY: 30.0,
              }
            ]
          }
        ]
      }
    ],
    settlementTilt: {
      diffSettlement: {
        photos: [
          { url: 'https://example.com/settle_v0_1.jpg', photoCode: 'SETTLE_01' }
        ]
      },
      beamSagging: {
        photos: [
          { url: 'https://example.com/beam_v0_1.jpg', photoCode: 'BEAM_01' }
        ],
        photoUrl: 'https://example.com/beam_v0_1.jpg'
      }
    },
    vacantLandPhotos: [
      'https://example.com/vacant_v0_1.jpg'
    ],
    signatures: {
      surveyorSignatureUrl: 'https://example.com/sig_surveyor_v0.png',
      surveyorName: 'Kỹ sư Khảo Sát v0',
      ownerSignatureUrl: 'https://example.com/sig_owner_v0.png',
      ownerName: 'Nguyễn Văn Gốc (Phiên bản v0)',
      workingMinutesPhotos: ['https://example.com/minutes_v0.jpg']
    }
  };

  const surveyorRes = await Database.query<{ id: string }>(`SELECT id FROM users WHERE role = 'SURVEYOR' LIMIT 1;`);
  const surveyorId = surveyorRes.rows[0]?.id || adminId;

  const testReportCode = `REP_TEST_${Date.now()}`;
  const reportInsert = await Database.query<{ id: string }>(
    `INSERT INTO base_survey_reports (
       parcel_id, surveyor_id, report_code, phase, status, current_step,
       survey_data_json, surveyor_signature_url, owner_signature_url, created_at, updated_at
     ) VALUES (
       $1, $2, $3, 'PHASE_1', 'SUBMITTED', 6,
       $4, $5, $6, NOW(), NOW()
     ) RETURNING id;`,
    [
      parcelId,
      surveyorId,
      testReportCode,
      JSON.stringify(baselineSurveyJson),
      baselineSurveyJson.signatures.surveyorSignatureUrl,
      baselineSurveyJson.signatures.ownerSignatureUrl,
    ]
  );
  const reportId = reportInsert.rows[0].id;
  console.log(`📋 2. Đã tạo Thử nghiệm Hồ sơ: ReportID = ${reportId}, ParcelID = ${parcelId}`);

  // Chèn 4 ảnh định danh vào survey_identification_photos
  await Database.query(
    `INSERT INTO survey_identification_photos (report_id, photo_type, photo_code, raw_photo_url, annotated_photo_url, is_not_applicable)
     VALUES 
       ($1, 'P01_HOUSE_NUMBER', 'P01', 'https://example.com/p01_v0_original.jpg', 'https://example.com/p01_v0_original.jpg', false),
       ($1, 'P02_MAIN_FACADE', 'P02', 'https://example.com/p02_v0_facade.jpg', 'https://example.com/p02_v0_facade.jpg', false),
       ($1, 'P03_SIDE_OR_REAR', 'P03', 'https://example.com/p03_v0_side.jpg', 'https://example.com/p03_v0_side.jpg', false),
       ($1, 'P04_CONTEXT_STREET', 'P04', 'https://example.com/p04_v0_street.jpg', 'https://example.com/p04_v0_street.jpg', false);`,
    [reportId]
  );

  // Chèn một bản ghi lịch sử SUPERSEDED vào survey_photo_registry cho P03 để test tính năng RESTORE
  const p03OldRegistry = await Database.query<{ id: string }>(
    `INSERT INTO survey_photo_registry (
       report_id, parcel_id, photo_category, photo_type, photo_code, photo_url,
       standardized_filename, sha256_hash, status, action_type, action_reason, actor_id, actor_role
     ) VALUES (
       $1, $2, 'IDENTIFICATION', 'P03_SIDE_REAR', 'P03', 'https://example.com/p03_archived_historical.jpg',
       'M2__P03_HIST.jpg', 'hash_p03_hist', 'SUPERSEDED', 'INITIAL_SURVEY', 'Ảnh gốc đợt 1', $3, 'SURVEYOR'
     ) RETURNING id;`,
    [reportId, parcelId, adminId]
  );
  const p03HistoricalRegistryId = p03OldRegistry.rows[0].id;

  // Tạo Snapshot Phiên bản ban đầu v0 (Baseline Snapshot)
  await AuditVersionService.createSnapshot(reportId, {
    versionTag: 'ORIGINAL_SUBMISSION',
    title: 'Hồ sơ gốc do Khảo sát viên nộp (v0)',
    editReason: 'Khảo sát viên hoàn tất khảo sát hiện trường và ký nộp hồ sơ',
    userId: adminId,
    diffSummary: [{ field: 'status', label: 'Trạng thái', oldValue: 'DRAFT', newValue: 'SUBMITTED' }],
  });
  console.log('📸 3. Đã tạo Snapshot Phiên bản gốc v0 (ORIGINAL_SUBMISSION) trong survey_report_versions.');

  // Kiểm tra số lượng version ban đầu
  const initialVersions = await AuditVersionService.getVersionList(reportId);
  console.log(`   Số lượng version ban đầu: ${initialVersions.length} (Kỳ vọng: 1)`);

  // ================================================================================
  // 4. THỰC HIỆN THẨM ĐỊNH VÀ ĐIỀU CHỈNH TOÀN DIỆN TẤT CẢ CÁC MỤC NỘI DUNG (v1)
  // ================================================================================
  console.log('\n📝 4. Đang gửi dữ liệu điều chỉnh bao phủ TOÀN BỘ CÁC PHẦN MỤC qua applyAdminSurveyEdit...');

  const editPayload = {
    adminPassword: testPassword,
    editReason: 'Thẩm định viên Zone Admin điều chỉnh toàn diện các mục hồ sơ sau phúc tra thực địa',
    diffPayload: [
      { field: 'ownerName', label: 'Chủ sở hữu', oldValue: 'Nguyễn Văn Gốc (Phiên bản v0)', newValue: 'Nguyễn Văn Điều Chỉnh (Phiên bản v1)' },
      { field: 'buildingSpecs.floorsCount', label: 'Số tầng', oldValue: 1, newValue: 3 },
      { field: 'buildingSpecs.structureType', label: 'Kết cấu', oldValue: 'NHA_CAP_4', newValue: 'KHUNG_BTCT' },
      { field: 'P01', label: 'Ảnh biển số nhà P01', oldValue: 'https://example.com/p01_v0_original.jpg', newValue: 'https://example.com/p01_v1_adjusted.jpg' },
      { field: 'P02', label: 'Ảnh mặt tiền P02', oldValue: 'https://example.com/p02_v0_facade.jpg', newValue: 'Không áp dụng (N/A)' },
      { field: 'P03', label: 'Ảnh hông/sau P03', oldValue: 'https://example.com/p03_v0_side.jpg', newValue: 'https://example.com/p03_archived_historical.jpg' },
      { field: 'D-ZED-99', label: 'Ghim khuyết tật mới D-ZED-99', oldValue: 'None', newValue: 'https://example.com/cu_zed_99.jpg' },
      { field: 'vacantLandPhotos', label: 'Ảnh đất trống', oldValue: '1 ảnh', newValue: '2 ảnh' },
      { field: 'settlementTilt.diffSettlement', label: 'Ảnh lún chênh', oldValue: '1 ảnh', newValue: '2 ảnh' },
      { field: 'signatures.surveyorSignatureUrl', label: 'Chữ ký KSV', oldValue: 'sig_surveyor_v0.png', newValue: 'sig_surveyor_v1.png' },
    ],
    updates: {
      ownerName: 'Nguyễn Văn Điều Chỉnh (Phiên bản v1)',
      address: '100 Đường Đã Cập Nhật, Phường Mới, Quận 1, TP.HCM',
      buildingSpecs: {
        structureType: 'KHUNG_BTCT',
        roofType: 'MAI_BTCT',
        wallType: 'TUONG_GACH_200',
        foundationType: 'MONG_BANG',
        floorsCount: 3,
      },
      // Đồng bộ floors với cả structural elements E mới và CAD mới
      floors: [
        {
          id: 'floor-g',
          floorNumber: 1,
          floorName: 'Tầng Trệt (Đã chỉnh)',
          cadArchitecturalSketchPhotoUrl: 'https://example.com/cad_floor_g_v1.jpg',
          structuralElements: [
            {
              id: 'elem-c1',
              elementCode: 'E-COL-C1',
              elementType: 'COT',
              locationDescription: 'Cột trục A1',
              ctxPhotoUrl: 'https://example.com/elem_c1_ctx_v0.jpg',
              defects: [
                {
                  id: 'defect-d1',
                  defectCode: 'D-ORIG-01',
                  defectType: 'CRACK',
                  severity: 'MEDIUM',
                  widthMaxMm: 0.25,
                  lengthMm: 110,
                  cuPhotoUrl: 'https://example.com/d1_cu_v0.jpg',
                  pinX: 20.0,
                  pinY: 30.0,
                }
              ]
            },
            {
              id: 'elem-b1',
              elementCode: 'E-BEAM-D1',
              elementType: 'DAM',
              locationDescription: 'Dầm trục 1-2',
              ctxPhotoUrl: 'https://example.com/elem_d1_ctx_v1.jpg',
              defects: [
                {
                  id: 'defect-d2',
                  defectCode: 'D-BEAM-02',
                  defectType: 'CRACK',
                  severity: 'HIGH',
                  widthMaxMm: 0.45,
                  lengthMm: 350,
                  cuPhotoUrl: 'https://example.com/d2_cu_v1.jpg',
                  pinX: 55.0,
                  pinY: 40.0,
                }
              ]
            }
          ]
        }
      ],
      signatures: {
        surveyorSignatureUrl: 'https://example.com/sig_surveyor_v1.png',
        surveyorName: 'Kỹ sư Thẩm Định Phúc Tra',
        ownerSignatureUrl: 'https://example.com/sig_owner_v1.png',
        ownerName: 'Nguyễn Văn Điều Chỉnh (Phiên bản v1)',
        workingMinutesPhotos: [
          'https://example.com/minutes_v0.jpg',
          'https://example.com/minutes_v1_bosung.jpg'
        ]
      }
    },
    photoActions: [
      // 1. REPLACE ảnh P01
      {
        action: 'REPLACE' as const,
        category: 'IDENTIFICATION',
        targetPhotoType: 'P01',
        targetPhotoId: 'photoP01',
        oldPhotoUrl: 'https://example.com/p01_v0_original.jpg',
        newPhotoUrl: 'https://example.com/p01_v1_adjusted.jpg',
        reason: 'Chụp lại số nhà rõ nét hơn sau khi chủ nhà sơn lại cổng',
      },
      // 2. DELETE ảnh P02 thành Không áp dụng (is_not_applicable = true)
      {
        action: 'DELETE' as const,
        category: 'IDENTIFICATION',
        targetPhotoType: 'P02',
        targetPhotoId: 'photoP02',
        oldPhotoUrl: 'https://example.com/p02_v0_facade.jpg',
        isNotApplicable: true,
        naReason: 'Công trình nằm sâu trong hẻm cụt chật hẹp, không thể lùi xa để chụp mặt tiền',
        reason: 'Chuyển sang Không Áp Dụng theo biên bản hiện trường',
      },
      // 3. RESTORE ảnh P03 từ bản ghi lịch sử
      {
        action: 'RESTORE' as const,
        category: 'IDENTIFICATION',
        targetPhotoType: 'P03',
        targetPhotoId: 'photoP03',
        newPhotoUrl: 'https://example.com/p03_archived_historical.jpg',
        reason: 'Khôi phục ảnh P03 góc chuẩn từ hồ sơ gốc',
        metadata: { registryPhotoId: p03HistoricalRegistryId }
      },
      // 4. ADD khuyết tật mới ZED Pinning kèm tọa độ và kích thước bắt buộc (widthMaxMm, lengthMm)
      {
        action: 'ADD' as const,
        category: 'DEFECT_CU',
        targetPhotoType: 'CU',
        targetPhotoId: 'D-ZED-99',
        defectCode: 'D-ZED-99',
        pinX: 45.5,
        pinY: 72.3,
        widthMaxMm: 0.35,
        lengthMm: 150,
        newPhotoUrl: 'https://example.com/cu_zed_99.jpg',
        caption: 'Vết nứt chéo dầm bê tông phát hiện bổ sung',
        reason: 'Bổ sung khuyết tật dầm trục 2 sau khi kiểm tra kỹ trần thạch cao',
      },
      // 5. ADD ảnh lún chênh vào mảng settlementTilt.diffSettlement.photos
      {
        action: 'ADD' as const,
        category: 'SETTLEMENT_TILT',
        targetPhotoType: 'SETTLEMENT_DIFF',
        targetPhotoId: 'settlementTilt.diffSettlement.photos',
        newPhotoUrl: 'https://example.com/settle_v1_new.jpg',
        caption: 'Mốc đo lún chênh số 2',
        reason: 'Bổ sung mốc đo lún chênh theo yêu cầu tư vấn giám sát',
      },
      // 6. REPLACE ảnh đất trống vacantLandPhotos index 0
      {
        action: 'REPLACE' as const,
        category: 'OVERVIEW',
        targetPhotoType: 'VACANT_LAND',
        targetPhotoId: 'vacantLandPhotos',
        photoIndex: 0,
        oldPhotoUrl: 'https://example.com/vacant_v0_1.jpg',
        newPhotoUrl: 'https://example.com/vacant_v1_replaced.jpg',
        reason: 'Thay ảnh đất trống góc rộng toàn cảnh',
      },
      // 7. REPLACE chữ ký khảo sát viên và chủ sở hữu
      {
        action: 'REPLACE' as const,
        category: 'SIGNATURE',
        targetPhotoType: 'SURVEYOR_SIGNATURE',
        targetPhotoId: 'surveyorSignatureUrl',
        oldPhotoUrl: 'https://example.com/sig_surveyor_v0.png',
        newPhotoUrl: 'https://example.com/sig_surveyor_v1.png',
        reason: 'Cập nhật chữ ký điện tử có xác thực OTP',
      }
    ]
  };

  const editResult = await AuditModificationService.applyAdminSurveyEdit(reportId, adminId, editPayload);
  console.log('✅ 5. applyAdminSurveyEdit thực thi THÀNH CÔNG:', editResult.message);

  // ================================================================================
  // 5. KIỂM TRA ĐỐI CHIẾU PHIÊN BẢN CŨ (v0) VÀ MỚI (v1) CÓ THỰC SỰ ĐƯỢC LƯU TRỮ
  // ================================================================================
  console.log('\n================================================================================');
  console.log('🔍 6. KIỂM TRA ĐỐI CHIẾU PHIÊN BẢN: v0 (GỐC) vs v1 (ĐIỀU CHỈNH)');
  console.log('================================================================================');

  const versionsAfterEdit = await AuditVersionService.getVersionList(reportId);
  console.log(`📊 Tổng số lượng phiên bản hiện có trong survey_report_versions: ${versionsAfterEdit.length}`);

  if (versionsAfterEdit.length < 2) {
    console.error(`❌ THẤT BẠI: Kỳ vọng tối thiểu 2 phiên bản (v0 và v1), nhưng chỉ tìm thấy ${versionsAfterEdit.length}!`);
    process.exit(1);
  }

  // Version 0: Bản ghi cũ nhất (ở cuối mảng nếu ORDER BY version_number DESC)
  const v0Meta = versionsAfterEdit[versionsAfterEdit.length - 1];
  // Version 1: Bản ghi mới nhất (ở đầu mảng)
  const v1Meta = versionsAfterEdit[0];

  console.log(`📌 Phiên bản v0: v${v0Meta.versionNumber}, ID = ${v0Meta.id}, Tag = ${v0Meta.versionTag}, Title = "${v0Meta.title}"`);
  console.log(`📌 Phiên bản v1: v${v1Meta.versionNumber}, ID = ${v1Meta.id}, Tag = ${v1Meta.versionTag}, Title = "${v1Meta.title}"`);

  // Truy xuất chi tiết snapshot dữ liệu JSON của v0 và v1 qua getVersionSnapshot
  const v0Detail = await AuditVersionService.getVersionSnapshot(reportId, v0Meta.versionNumber);
  const v1Detail = await AuditVersionService.getVersionSnapshot(reportId, v1Meta.versionNumber);

  const v0Json = v0Detail.snapshotData?.surveyJson || v0Detail.snapshotData?.survey_data_json || v0Detail.snapshotData;
  const v1Json = v1Detail.snapshotData?.surveyJson || v1Detail.snapshotData?.survey_data_json || v1Detail.snapshotData;

  let allChecksPassed = true;
  const testResults: Array<{ section: string; check: string; v0Val: any; v1Val: any; passed: boolean }> = [];

  function recordCheck(section: string, check: string, v0Val: any, v1Val: any, passed: boolean) {
    testResults.push({ section, check, v0Val, v1Val, passed });
    if (!passed) allChecksPassed = false;
  }

  // CHECK 1: Chủ sở hữu v0 giữ nguyên, v1 cập nhật
  recordCheck(
    'Thông tin thửa',
    'Tên chủ sở hữu (v0 vs v1)',
    v0Json.ownerName,
    v1Json.ownerName,
    v0Json.ownerName === 'Nguyễn Văn Gốc (Phiên bản v0)' && v1Json.ownerName === 'Nguyễn Văn Điều Chỉnh (Phiên bản v1)'
  );

  // CHECK 2: Kết cấu công trình (buildingSpecs)
  recordCheck(
    'Kết cấu công trình',
    'Loại kết cấu (structureType)',
    v0Json.buildingSpecs?.structureType,
    v1Json.buildingSpecs?.structureType,
    v0Json.buildingSpecs?.structureType === 'NHA_CAP_4' && v1Json.buildingSpecs?.structureType === 'KHUNG_BTCT'
  );
  recordCheck(
    'Kết cấu công trình',
    'Số tầng (floorsCount)',
    v0Json.buildingSpecs?.floorsCount,
    v1Json.buildingSpecs?.floorsCount,
    Number(v0Json.buildingSpecs?.floorsCount) === 1 && Number(v1Json.buildingSpecs?.floorsCount) === 3
  );

  // CHECK 3: Ảnh định danh P01 (REPLACE)
  recordCheck(
    'Ảnh định danh P01',
    'URL ảnh P01 (v0 vs v1)',
    v0Json.photoP01?.url,
    v1Json.photoP01?.url,
    v0Json.photoP01?.url === 'https://example.com/p01_v0_original.jpg' && v1Json.photoP01?.url === 'https://example.com/p01_v1_adjusted.jpg'
  );

  // CHECK 4: Ảnh định danh P02 (DELETE -> Không áp dụng)
  recordCheck(
    'Ảnh định danh P02',
    'Trạng thái không áp dụng (notApplicable)',
    v0Json.photoP02?.notApplicable,
    v1Json.photoP02?.notApplicable || v1Json.photoP02?.isNotApplicable,
    Boolean(v0Json.photoP02?.notApplicable) === false && Boolean(v1Json.photoP02?.notApplicable || v1Json.photoP02?.isNotApplicable) === true
  );

  // CHECK 5: Ảnh định danh P03 (RESTORE)
  recordCheck(
    'Ảnh định danh P03',
    'Khôi phục ảnh lịch sử (v0 vs v1)',
    v0Json.photoP03?.url,
    v1Json.photoP03?.url,
    v0Json.photoP03?.url === 'https://example.com/p03_v0_side.jpg' && v1Json.photoP03?.url === 'https://example.com/p03_archived_historical.jpg'
  );

  // CHECK 6: Bản vẽ sơ đồ CAD tầng & phần tử kết cấu E
  const v0Floors = v0Json.floors || [];
  const v1Floors = v1Json.floors || [];
  const v0Elements = v0Floors[0]?.structuralElements || [];
  const v1Elements = v1Floors[0]?.structuralElements || [];
  recordCheck(
    'Sơ đồ CAD & Phần tử E',
    'Số lượng phần tử kết cấu E trong tầng Trệt',
    v0Elements.length,
    v1Elements.length,
    v0Elements.length === 1 && v1Elements.length === 2
  );

  // CHECK 7: Khuyết tật mới ZED Pinning (D-ZED-99)
  const zedDefectInV0 = JSON.stringify(v0Json).includes('D-ZED-99');
  const zedDefectInV1 = JSON.stringify(v1Json).includes('D-ZED-99');
  recordCheck(
    'Khuyết tật ZED Pinning',
    'D-ZED-99 có trong v1 và KHÔNG có trong v0',
    zedDefectInV0,
    zedDefectInV1,
    zedDefectInV0 === false && zedDefectInV1 === true
  );

  // CHECK 8: Mảng ảnh lún chênh (settlementTilt)
  const v0SettleCount = v0Json.settlementTilt?.diffSettlement?.photos?.length || 0;
  const v1SettleCount = v1Json.settlementTilt?.diffSettlement?.photos?.length || 0;
  recordCheck(
    'Lún chênh & Nghiêng lệch',
    'Số ảnh lún chênh trong mảng (v0 vs v1)',
    v0SettleCount,
    v1SettleCount,
    v0SettleCount === 1 && v1SettleCount === 2
  );

  // CHECK 9: Mảng ảnh đất trống (vacantLandPhotos)
  const v0VacantUrl = v0Json.vacantLandPhotos?.[0];
  const v1VacantUrl = v1Json.vacantLandPhotos?.[0];
  recordCheck(
    'Đất trống / Khuôn viên',
    'Ảnh đất trống index 0 (v0 vs v1)',
    v0VacantUrl,
    v1VacantUrl,
    v0VacantUrl === 'https://example.com/vacant_v0_1.jpg' && v1VacantUrl === 'https://example.com/vacant_v1_replaced.jpg'
  );

  // CHECK 10: Chữ ký KSV (signatures.surveyorSignatureUrl)
  recordCheck(
    'Chữ ký & Biên bản',
    'Chữ ký khảo sát viên (v0 vs v1)',
    v0Json.signatures?.surveyorSignatureUrl,
    v1Json.signatures?.surveyorSignatureUrl,
    v0Json.signatures?.surveyorSignatureUrl === 'https://example.com/sig_surveyor_v0.png' &&
    v1Json.signatures?.surveyorSignatureUrl === 'https://example.com/sig_surveyor_v1.png'
  );

  // ================================================================================
  // 6. KIỂM TRA BẢNG CƠ SỞ DỮ LIỆU QUAN HỆ (POSTGRESQL RELATIONAL TABLES)
  // ================================================================================
  console.log('\n================================================================================');
  console.log('🗄️  7. KIỂM TRA BẢNG DỮ LIỆU CSDL QUAN HỆ (POSTGRESQL INTEGRITY)');
  console.log('================================================================================');

  // Check CSDL 1: defect_items có lưu D-ZED-99 với pinX, pinY, width_max_mm, length_mm không?
  const defectRes = await Database.query<any>(
    `SELECT defect_code, pin_x, pin_y, width_max_mm, length_mm, cu_photo_url, is_deleted 
     FROM defect_items 
     WHERE defect_code = 'D-ZED-99';`
  );
  const defectRow = defectRes.rows[0];
  const defectDbOk = Boolean(
    defectRow &&
    Number(defectRow.pin_x) === 45.5 &&
    Number(defectRow.pin_y) === 72.3 &&
    Number(defectRow.width_max_mm) === 0.35 &&
    Number(defectRow.length_mm) === 150 &&
    defectRow.cu_photo_url === 'https://example.com/cu_zed_99.jpg' &&
    defectRow.is_deleted === false
  );
  recordCheck(
    'CSDL: defect_items',
    'Bản ghi D-ZED-99 đầy đủ tọa độ ghim và kích thước mm',
    'N/A',
    defectRow ? `pinX=${defectRow.pin_x}, pinY=${defectRow.pin_y}, w=${defectRow.width_max_mm}mm, l=${defectRow.length_mm}mm` : 'Không tìm thấy',
    defectDbOk
  );

  // Check CSDL 2: survey_identification_photos có cập nhật P01 và P02 is_not_applicable không?
  const identRes = await Database.query<any>(
    `SELECT photo_type, raw_photo_url, is_not_applicable, na_reason 
     FROM survey_identification_photos 
     WHERE report_id = $1 
     ORDER BY photo_type;`,
    [reportId]
  );
  const p01Db = identRes.rows.find((r: any) => r.photo_type.includes('P01'));
  const p02Db = identRes.rows.find((r: any) => r.photo_type.includes('P02'));
  const identDbOk = Boolean(
    p01Db && p01Db.raw_photo_url === 'https://example.com/p01_v1_adjusted.jpg' &&
    p02Db && p02Db.is_not_applicable === true && p02Db.na_reason?.includes('hẻm cụt')
  );
  recordCheck(
    'CSDL: survey_identification_photos',
    'P01 cập nhật URL mới & P02 lưu is_not_applicable=true và lý do N/A',
    'v0 active',
    `P01=${p01Db?.raw_photo_url?.slice(0, 30)}..., P02 NA=${p02Db?.is_not_applicable}`,
    identDbOk
  );

  // Check CSDL 3: survey_photo_registry có đầy đủ các hành động ADD, REPLACE, DELETE, RESTORE không?
  const regRes = await Database.query<any>(
    `SELECT action_type, status, photo_code, is_deleted 
     FROM survey_photo_registry 
     WHERE report_id = $1 
     ORDER BY created_at ASC;`,
    [reportId]
  );
  const actionTypes = regRes.rows.map((r: any) => r.action_type);
  const hasAdd = actionTypes.includes('ADD');
  const hasReplace = actionTypes.includes('REPLACE');
  const hasDelete = actionTypes.includes('DELETE');
  const hasRestore = actionTypes.includes('RESTORE');
  recordCheck(
    'CSDL: survey_photo_registry',
    'Sổ cái ghi nhận đủ 4 hành động: ADD, REPLACE, DELETE, RESTORE',
    'Chưa có hành động thẩm định',
    actionTypes.join(', '),
    hasAdd && hasReplace && hasDelete && hasRestore
  );

  // Check CSDL 4: system_audit_logs có ghi nhận ZONE_ADMIN_SURVEY_EDIT không?
  const logRes = await Database.query<any>(
    `SELECT action, performed_by_user_id, diff_payload 
     FROM system_audit_logs 
     WHERE entity_id = $1 AND action = 'ZONE_ADMIN_SURVEY_EDIT' 
     ORDER BY created_at DESC LIMIT 1;`,
    [reportId]
  );
  const auditLogOk = Boolean(logRes.rows[0] && logRes.rows[0].performed_by_user_id === adminId);
  recordCheck(
    'CSDL: system_audit_logs',
    'Nhật ký kiểm toán lưu vết ZONE_ADMIN_SURVEY_EDIT với actor ID của Admin',
    'Chưa có log',
    logRes.rows[0] ? `Action: ${logRes.rows[0].action}` : 'Không có log',
    auditLogOk
  );

  // Check CSDL 5: Gọi API AuditReviewService.getSplitPaneAuditView để đảm bảo FE load mượt mà không crash
  console.log('\n--- 8. Kiểm tra API AuditReviewService.getSplitPaneAuditView ---');
  let apiDetailOk = false;
  try {
    const apiDetail = await AuditReviewService.getSplitPaneAuditView(reportId, { includePhotoHistory: true });
    if (apiDetail && apiDetail.reportId === reportId && apiDetail.identificationPhotos?.photoP01) {
      apiDetailOk = true;
      console.log('   ✅ API getSplitPaneAuditView phản hồi đầy đủ dữ liệu chuẩn hóa cho FE Studio!');
    }
  } catch (apiErr: any) {
    console.error('   ❌ Lỗi khi gọi getSplitPaneAuditView:', apiErr.message);
  }
  recordCheck(
    'API Review Service',
    'getSplitPaneAuditView trả về dữ liệu chuẩn hóa không bị lỗi',
    'N/A',
    apiDetailOk ? 'SUCCESS (200 OK)' : 'ERROR',
    apiDetailOk
  );

  // IN BẢNG KẾT QUẢ TỔNG HỢP
  console.log('\n================================================================================');
  console.log('📋 BẢNG KẾT QUẢ KIỂM TRA CHI TIẾT CÁC PHẦN MỤC NỘI DUNG (TEST RESULTS)');
  console.log('================================================================================');
  console.table(
    testResults.map((r, i) => ({
      STT: i + 1,
      Phần_Mục: r.section,
      Nội_Dung_Kiểm_Tra: r.check,
      Phiên_Bản_Cũ_v0: typeof r.v0Val === 'string' ? r.v0Val.slice(0, 25) : r.v0Val,
      Phiên_Bản_Mới_v1: typeof r.v1Val === 'string' ? r.v1Val.slice(0, 35) : r.v1Val,
      Kết_Quả: r.passed ? '✅ PASS' : '❌ FAIL'
    }))
  );

  // Dọn dẹp dữ liệu test
  console.log('\n🧹 Dọn dẹp dữ liệu kiểm thử...');
  await Database.query(`DELETE FROM survey_report_versions WHERE report_id = $1;`, [reportId]);
  await Database.query(`DELETE FROM survey_photo_registry WHERE report_id = $1;`, [reportId]);
  await Database.query(`DELETE FROM survey_identification_photos WHERE report_id = $1;`, [reportId]);
  await Database.query(`DELETE FROM defect_items WHERE defect_code IN ('D-ZED-99', 'D-ORIG-01', 'D-BEAM-02');`);
  await Database.query(`DELETE FROM damage_zones WHERE report_id = $1;`, [reportId]);
  await Database.query(`DELETE FROM system_audit_logs WHERE entity_id = $1;`, [reportId]);
  await Database.query(`DELETE FROM base_survey_reports WHERE id = $1;`, [reportId]);
  await Database.query(`DELETE FROM parcels WHERE id = $1;`, [parcelId]);
  console.log('✅ Đã dọn dẹp dữ liệu test an toàn.');

  await pool.end();

  if (allChecksPassed) {
    console.log('\n🎉 ================================================================================');
    console.log('🎉 TẤT CẢ CÁC KIỂM TRA ĐỀU ĐẠT CHUẨN 100% (ALL CHECKS PASSED)');
    console.log('🎉 PHIÊN BẢN CŨ (v0) VÀ PHIÊN BẢN MỚI (v1) ĐÃ ĐƯỢC BẢO LƯU & XÁC THỰC BẤT BIẾN!');
    console.log('================================================================================\n');
    return true;
  } else {
    console.error('\n❌ CÓ BƯỚC KIỂM TRA THẤT BẠI!');
    process.exit(1);
  }
}

runComprehensiveE2ETest().catch((e) => {
  console.error('Fatal E2E test error:', e);
  process.exit(1);
});
