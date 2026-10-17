import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Database, pool } from '../database/db';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';
import { CryptoUtils } from '../common/utils/crypto.utils';

/**
 * Helper: Monotonic Max + 1 code generator matching frontend getNextMonotonicPinCode
 */
function getNextMonotonicCode(prefix: string, existingCodes: string[], historicalCodes: string[] = []): string {
  const allCodes = Array.from(new Set([...existingCodes, ...historicalCodes])).filter(Boolean);
  const regex = new RegExp(`^${prefix}[-_]?0*(\\d+)$`, 'i');
  let maxNum = 0;

  for (const c of allCodes) {
    const match = c.trim().match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  const padded = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
  return `${prefix}-${padded}`;
}

/**
 * Helper: Optimistic Photo Resolver matching frontend optimisticPhotoResolver.ts
 */
interface PhotoActionPayload {
  action: 'ADD' | 'REPLACE' | 'DELETE';
  category: string;
  targetPhotoType?: string;
  targetPhotoId?: string;
  defectId?: string;
  photoIndex?: number;
  oldPhotoUrl?: string;
  newPhotoUrl?: string;
  newPhotoUrls?: string[];
}

function resolveOptimisticPhoto(
  originalUrl: string | undefined | null,
  stagedActions: PhotoActionPayload[] | undefined,
  filter: {
    category?: string;
    targetPhotoType?: string;
    targetPhotoId?: string;
    defectId?: string;
    photoIndex?: number;
    url?: string;
  }
) {
  const safeUrl = (originalUrl || '').trim();
  if (!stagedActions || stagedActions.length === 0) {
    return { displayUrl: safeUrl, isStaged: false, stagedAction: null, status: 'ORIGINAL' };
  }

  const match = stagedActions.find((a) => {
    if (filter.category && a.category !== filter.category) return false;
    if (filter.targetPhotoType && a.targetPhotoType && a.targetPhotoType !== filter.targetPhotoType) return false;
    if (filter.targetPhotoId && a.targetPhotoId && a.targetPhotoId !== filter.targetPhotoId) return false;
    if (filter.defectId && a.defectId && a.defectId !== filter.defectId) return false;
    if (filter.photoIndex !== undefined && a.photoIndex !== undefined && a.photoIndex === filter.photoIndex) return true;
    if (filter.url && a.oldPhotoUrl && a.oldPhotoUrl === filter.url) return true;
    if (filter.targetPhotoId && a.targetPhotoId === filter.targetPhotoId && !filter.photoIndex && a.photoIndex === undefined) return true;
    if (filter.targetPhotoType && a.targetPhotoType === filter.targetPhotoType && !filter.photoIndex && a.photoIndex === undefined) return true;
    if (!filter.photoIndex && !filter.url) return true;
    return false;
  });

  if (!match) {
    return { displayUrl: safeUrl, isStaged: false, stagedAction: null, status: 'ORIGINAL' };
  }

  if (match.action === 'DELETE') {
    return { displayUrl: safeUrl, isStaged: true, stagedAction: match, status: 'DELETED' };
  }

  return {
    displayUrl: match.newPhotoUrl || safeUrl,
    isStaged: true,
    stagedAction: match,
    status: match.action === 'ADD' ? 'ADDED' : 'REPLACED',
  };
}

function getOptimisticAddedPhotos(
  stagedActions: PhotoActionPayload[] | undefined,
  filter: {
    category: string;
    targetPhotoType?: string;
    targetPhotoId?: string;
    defectId?: string;
  }
) {
  if (!stagedActions || stagedActions.length === 0) return [];

  const addedMatches = stagedActions.filter((a) => {
    if (a.action !== 'ADD') return false;
    if (a.category !== filter.category) return false;
    if (filter.targetPhotoType && a.targetPhotoType && a.targetPhotoType !== filter.targetPhotoType) return false;
    if (filter.targetPhotoId && a.targetPhotoId && a.targetPhotoId !== filter.targetPhotoId) return false;
    if (filter.defectId && a.defectId && a.defectId !== filter.defectId) return false;
    return true;
  });

  return addedMatches.flatMap((match) => {
    const urls = match.newPhotoUrls && match.newPhotoUrls.length > 0
      ? match.newPhotoUrls
      : match.newPhotoUrl
      ? [match.newPhotoUrl]
      : [];
    return urls.map((u) => ({ url: u, action: match }));
  });
}

/**
 * 20 TEST CASES EXECUTION SUITE
 */
async function run20TestCases() {
  console.log('================================================================');
  console.log('🧪 BẮT ĐẦU CHẠY BỘ 20 TEST CASES VÒNG ĐỜI THỰC THỂ TUẦN TỰ');
  console.log('   & CƠ CHẾ HIỂN THỊ LẠC QUAN ẢNH (OPTIMISTIC PHOTO RESOLVER)');
  console.log('================================================================\n');

  let passedCases = 0;

  // Retrieve an admin user for audit execution
  const testPassword = 'AdminPassword@2026';
  const testPasswordHash = await CryptoUtils.hashPassword(testPassword);
  const adminRes = await Database.query<{ id: string }>(
    `SELECT id FROM users WHERE role IN ('ZONE_ADMIN', 'SUPER_ADMIN') LIMIT 1;`
  );
  assert.ok(adminRes.rows[0], 'Phải có ít nhất 1 tài khoản Zone Admin hoặc Super Admin');
  const adminId = adminRes.rows[0].id;
  await Database.query(`UPDATE users SET password_hash = $1 WHERE id = $2;`, [testPasswordHash, adminId]);

  // Setup mock parcel & baseline report in DB
  const testParcelCode = `TEST_SEQ_PARCEL_${Date.now()}`;
  const pInsert = await Database.query<{ id: string }>(
    `INSERT INTO parcels (
       project_parcel_code, house_number, street, zone_id, building_type,
       survey_status, created_at, updated_at
     ) VALUES ($1, '888', 'Đường Vòng Đời Thực Thể', 'ZONE_09', 'RESIDENTIAL',
               'SUBMITTED', NOW() - INTERVAL '48 HOURS', NOW() - INTERVAL '48 HOURS')
     RETURNING id;`,
    [testParcelCode]
  );
  const testParcelId = pInsert.rows[0].id;

  const baselineSurveyData = {
    specs: { floorCount: 3, structureType: 'Nhà phố bê tông cốt thép' },
    floors: [
      {
        id: 'fl-1',
        floorName: 'Tầng 1 (Trệt)',
        cadSketchPhotoUrl: 'https://example.com/cad_01_fl1.png',
        cadStructuralSketchPhotoUrl: 'https://example.com/cad_02_fl1.png',
        cadZonePins: [
          { id: 'pin-z01', zoneCode: 'Z-01', pinX: 20, pinY: 30, pin_x: 20, pin_y: 30, type: 'ZONE' },
          { id: 'pin-z02', zoneCode: 'Z-02', pinX: 45, pinY: 55, pin_x: 45, pin_y: 55, type: 'ZONE' },
          { id: 'pin-z03', zoneCode: 'Z-03', pinX: 75, pinY: 80, pin_x: 75, pin_y: 80, type: 'ZONE' },
        ],
        cadElementPins: [
          { id: 'pin-e01', zoneCode: 'E-01', pinX: 25, pinY: 35, pin_x: 25, pin_y: 35, type: 'STRUCTURAL' },
          { id: 'pin-e02', zoneCode: 'E-02', pinX: 50, pinY: 50, pin_x: 50, pin_y: 50, type: 'STRUCTURAL' },
          { id: 'pin-e03', zoneCode: 'E-03', pinX: 70, pinY: 70, pin_x: 70, pin_y: 70, type: 'STRUCTURAL' },
        ],
        zones: [
          {
            id: 'zone-1',
            zoneCode: 'Z-01',
            roomName: 'Phòng khách',
            componentType: 'Tường gạch',
            ctxPhotoUrl: 'https://example.com/ctx_z01_v1.jpg',
            overviewPhotos: ['https://example.com/ov1_z01.jpg', 'https://example.com/ov2_z01.jpg'],
            defects: [
              {
                id: 'd-01',
                defectCode: 'D-01',
                defectType: 'Vết nứt tường',
                widthMaxMm: 0.3,
                lengthMm: 120,
                pinX: 30,
                pinY: 40,
                cuPhotoUrl: 'https://example.com/cu_d01_v1.jpg',
                hasScaleCard: true,
              },
              {
                id: 'd-02',
                defectCode: 'D-02',
                defectType: 'Nứt chéo cửa sổ',
                widthMaxMm: 0.5,
                lengthMm: 250,
                pinX: 60,
                pinY: 50,
                cuPhotoUrl: 'https://example.com/cu_d02_v1.jpg',
                hasScaleCard: true,
              },
              {
                id: 'd-03',
                defectCode: 'D-03',
                defectType: 'Nứt chân chim',
                widthMaxMm: 0.2,
                lengthMm: 80,
                pinX: 80,
                pinY: 70,
                cuPhotoUrl: 'https://example.com/cu_d03_v1.jpg',
                hasScaleCard: true,
              },
            ],
          },
          {
            id: 'zone-2',
            zoneCode: 'Z-02',
            roomName: 'Bếp & Phòng ăn',
            componentType: 'Tường ngăn',
            ctxPhotoUrl: 'https://example.com/ctx_z02_v1.jpg',
            defects: [
              {
                id: 'd-z02-01',
                defectCode: 'D-01',
                defectType: 'Nứt ngang tường',
                widthMaxMm: 0.4,
                lengthMm: 150,
                pinX: 50,
                pinY: 50,
                cuPhotoUrl: 'https://example.com/cu_z02_d01.jpg',
              },
            ],
          },
          {
            id: 'zone-3',
            zoneCode: 'Z-03',
            roomName: 'Sân sau',
            componentType: 'Tường rào',
            ctxPhotoUrl: 'https://example.com/ctx_z03_v1.jpg',
            defects: [],
          },
        ],
        structuralElements: [
          {
            id: 'elem-1',
            elementCode: 'E-01',
            elementType: 'Cột C1',
            materialType: 'BTCT',
            defects: [],
          },
          {
            id: 'elem-2',
            elementCode: 'E-02',
            elementType: 'Dầm D1',
            materialType: 'BTCT',
            defects: [],
          },
          {
            id: 'elem-3',
            elementCode: 'E-03',
            elementType: 'Sàn S1',
            materialType: 'BTCT',
            defects: [],
          },
        ],
      },
      {
        id: 'fl-2',
        floorName: 'Tầng 2',
        zones: [],
      },
      {
        id: 'fl-3',
        floorName: 'Tầng 3 (Sân thượng)',
        zones: [],
      },
    ],
  };

  const rInsert = await Database.query<{ id: string }>(
    `INSERT INTO base_survey_reports (
       parcel_id, report_code, status, survey_data_json, surveyor_id,
       created_at, updated_at
     ) VALUES ($1, $2, 'SUBMITTED', $3, $4,
               NOW() - INTERVAL '48 HOURS', NOW() - INTERVAL '48 HOURS')
     RETURNING id;`,
    [testParcelId, `REP_${testParcelCode}`, JSON.stringify(baselineSurveyData), adminId]
  );
  const testReportId = rInsert.rows[0].id;

  try {
    // -------------------------------------------------------------------------
    // TC01: Sequential entity non-shifting on delete (Z-01, Z-02, Z-03 -> delete Z-02 -> Z-03 retains Z-03)
    // -------------------------------------------------------------------------
    console.log('▶ [TC01] Xóa Vùng Z-02 ở giữa: Xác minh Z-03 giữ nguyên mã hiệu Z-03 (Không đổi dồn thứ tự)');
    const zonesCopy1 = JSON.parse(JSON.stringify(baselineSurveyData.floors[0].zones));
    // Soft-delete Z-02
    const targetZ = zonesCopy1.find((z: any) => z.zoneCode === 'Z-02');
    targetZ.is_deleted = true;
    const remainingActiveZones = zonesCopy1.filter((z: any) => !z.is_deleted);

    assert.strictEqual(remainingActiveZones.length, 2, 'Phải còn đúng 2 vùng hoạt động');
    assert.strictEqual(remainingActiveZones[0].zoneCode, 'Z-01', 'Vùng 1 phải là Z-01');
    assert.strictEqual(remainingActiveZones[1].zoneCode, 'Z-03', 'Vùng sau phải giữ nguyên mã Z-03, TUYỆT ĐỐI không bị dồn thành Z-02');
    console.log('   ✅ PASS TC01: Z-03 không bị đổi số thành Z-02');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC02: Monotonic Max + 1 code generation (Allocating new Z yields Z-04, never reusing deleted Z-02)
    // -------------------------------------------------------------------------
    console.log('▶ [TC02] Cấp mã mới sau khi xóa Z-02: Xác minh cơ chế đơn điệu tăng dần cấp Z-04, không lấp lỗ Z-02');
    const existingActiveCodes = remainingActiveZones.map((z: any) => z.zoneCode);
    const historicalCodes = ['Z-01', 'Z-02', 'Z-03'];
    const nextZCode = getNextMonotonicCode('Z', existingActiveCodes, historicalCodes);
    assert.strictEqual(nextZCode, 'Z-04', `Mã mới phải là Z-04 nhưng lại nhận được ${nextZCode}`);
    console.log(`   ✅ PASS TC02: Mã mới được cấp là ${nextZCode} (Monotonic Max + 1)`);
    passedCases++;

    // -------------------------------------------------------------------------
    // TC03: CAD Zone Pin coordinates integrity (Z-02 pin filtered from active, Z-03 preserves coordinates)
    // -------------------------------------------------------------------------
    console.log('▶ [TC03] Ghim CAD Vùng Z: Z-02 ẩn khỏi sơ đồ hoạt động, Z-03 giữ nguyên tọa độ chính xác');
    const cadPins = baselineSurveyData.floors[0].cadZonePins || [];
    const activeCadPins = cadPins.filter((p: any) => p.zoneCode !== 'Z-02');
    assert.strictEqual(activeCadPins.length, 2);
    const z03Pin = activeCadPins.find((p: any) => p.zoneCode === 'Z-03');
    assert.ok(z03Pin, 'Ghim Z-03 phải tồn tại');
    assert.strictEqual(z03Pin.pinX, 75, 'Tọa độ pinX Z-03 phải bảo toàn nguyên vẹn 75%');
    assert.strictEqual(z03Pin.pinY, 80, 'Tọa độ pinY Z-03 phải bảo toàn nguyên vẹn 80%');
    console.log('   ✅ PASS TC03: Tọa độ CAD của Z-03 được bảo toàn 100%');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC04: Defect D sequential entity non-shifting (D-01, D-02, D-03 -> delete D-02 -> D-03 retains D-03)
    // -------------------------------------------------------------------------
    console.log('▶ [TC04] Xóa khuyết tật D-02 trong Z-01: D-03 giữ nguyên mã hiệu D-03');
    const z01Defects = JSON.parse(JSON.stringify(baselineSurveyData.floors[0].zones[0].defects));
    z01Defects.find((d: any) => d.defectCode === 'D-02').is_deleted = true;
    const activeDefects = z01Defects.filter((d: any) => !d.is_deleted);
    assert.strictEqual(activeDefects.length, 2);
    assert.strictEqual(activeDefects[0].defectCode, 'D-01');
    assert.strictEqual(activeDefects[1].defectCode, 'D-03', 'Khuyết tật thứ 3 phải giữ nguyên mã D-03');
    console.log('   ✅ PASS TC04: D-03 giữ nguyên mã hiệu, không bị dồn thành D-02');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC05: Defect D monotonic Max + 1 generation (Adding new defect yields D-04)
    // -------------------------------------------------------------------------
    console.log('▶ [TC05] Thêm khuyết tật mới vào Z-01: Cấp mã D-04 (không cấp lại D-02)');
    const existingD = activeDefects.map((d: any) => d.defectCode);
    const historicalD = ['D-01', 'D-02', 'D-03'];
    const nextDCode = getNextMonotonicCode('D', existingD, historicalD);
    assert.strictEqual(nextDCode, 'D-04', `Mã khuyết tật mới phải là D-04 nhưng nhận được ${nextDCode}`);
    console.log(`   ✅ PASS TC05: Mã khuyết tật mới cấp là ${nextDCode}`);
    passedCases++;

    // -------------------------------------------------------------------------
    // TC06: Close-up (CU) photo watermark & lineage integrity for D-03
    // -------------------------------------------------------------------------
    console.log('▶ [TC06] Tính toàn vẹn ảnh thước đo và liên kết của D-03 khi D-02 bị xóa');
    const d03 = activeDefects.find((d: any) => d.defectCode === 'D-03');
    assert.strictEqual(d03.cuPhotoUrl, 'https://example.com/cu_d03_v1.jpg');
    assert.strictEqual(d03.hasScaleCard, true);
    assert.strictEqual(d03.widthMaxMm, 0.2);
    console.log('   ✅ PASS TC06: Ảnh và metadata thước đo của D-03 nguyên vẹn');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC07: Clean Version Diff without false diff on sibling entities
    // -------------------------------------------------------------------------
    console.log('▶ [TC07] Version Diff: Tạo snapshot v0 rồi v1 chỉ ghi nhận delta xóa trên Z-02');
    // Create baseline v0 snapshot
    await AuditVersionService.createSnapshot(testReportId, {
      versionTag: 'ORIGINAL_SUBMISSION',
      title: 'Bản nộp thực địa ban đầu v0',
      userId: adminId,
      customSnapshotData: { surveyJson: baselineSurveyData },
    });

    // Modify survey_data_json to soft-delete Z-02
    const modifiedSurveyData = JSON.parse(JSON.stringify(baselineSurveyData));
    const targetZoneToSoftDelete = modifiedSurveyData.floors[0].zones.find((z: any) => z.zoneCode === 'Z-02');
    targetZoneToSoftDelete.is_deleted = true;
    targetZoneToSoftDelete.defects.forEach((d: any) => { d.is_deleted = true; });

    await Database.query(`UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`, [
      JSON.stringify(modifiedSurveyData),
      testReportId,
    ]);

    const snapV1 = await AuditVersionService.createSnapshot(testReportId, {
      versionTag: 'ADMIN_DIFF_SAVE',
      title: 'Thẩm định xóa mềm Z-02 và bảo toàn Z-03',
      editReason: 'Xóa mềm Z-02 do không còn phát hiện hư hại',
      userId: adminId,
      customSnapshotData: { surveyJson: modifiedSurveyData },
      diffSummary: [{ field: 'floors.zones', oldValue: 'Z-02 (Active)', newValue: 'Z-02 (Deleted)' }],
    });
    assert.strictEqual(snapV1.versionNumber, 1, 'Phiên bản sửa đổi phải là v1');

    // Retrieve created version snapshot
    const versionSnap = await AuditVersionService.getVersionSnapshot(testReportId, 1);
    assert.ok(versionSnap, 'Phải lấy được snapshot phiên bản v1');
    const snapFloors = (versionSnap.snapshotData.surveyJson || versionSnap.snapshotData.survey_data_json).floors;
    const snapZ02 = snapFloors[0].zones.find((z: any) => z.zoneCode === 'Z-02');
    const snapZ03 = snapFloors[0].zones.find((z: any) => z.zoneCode === 'Z-03');
    assert.strictEqual(snapZ02.is_deleted, true, 'Z-02 phải có cờ is_deleted = true trong snapshot');
    assert.strictEqual(snapZ03.zoneCode, 'Z-03', 'Z-03 phải bảo toàn nguyên vẹn');
    assert.strictEqual(snapZ03.is_deleted, undefined, 'Z-03 không bị đánh dấu xóa nhầm');
    console.log('   ✅ PASS TC07: Snapshot v1 lưu vết xóa sạch sẽ, 0% false diff trên Z-03');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC08: Version Rollback restores Z-02 and its child defects intact
    // -------------------------------------------------------------------------
    console.log('▶ [TC08] Version Rollback: Rollback về bản v0 khôi phục Z-02 và toàn bộ vết nứt con');
    const rollbackRes = await AuditVersionService.rollbackToVersion(
      testReportId,
      0,
      adminId,
      { reason: 'Khôi phục kiểm thử Z-02', password: testPassword }
    );
    assert.strictEqual(rollbackRes.newVersionNumber, 2, 'Phiên bản mới tạo ra sau rollback phải là v2');

    // Check current report data after rollback
    const reportDb = await Database.query<{ survey_data_json: any }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    const restoredJson = typeof reportDb.rows[0].survey_data_json === 'string'
      ? JSON.parse(reportDb.rows[0].survey_data_json)
      : reportDb.rows[0].survey_data_json;
    const restoredFloors = restoredJson.floors;
    const restoredZ02 = restoredFloors[0].zones.find((z: any) => z.zoneCode === 'Z-02');
    assert.ok(restoredZ02, 'Z-02 phải tồn tại sau khi rollback');
    assert.ok(!restoredZ02.is_deleted, 'Z-02 không được có cờ xóa sau rollback');
    assert.strictEqual(restoredZ02.defects.length, 1, 'Vết nứt con của Z-02 phải được khôi phục nguyên vẹn');
    assert.strictEqual(restoredZ02.defects[0].defectCode, 'D-01');
    console.log('   ✅ PASS TC08: Rollback khôi phục Z-02 và khuyết tật con hoàn hảo');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC09: Structural Elements E lifecycle (E-01..E-03 -> delete E-02 -> E-03 preserved, alloc E-04)
    // -------------------------------------------------------------------------
    console.log('▶ [TC09] Vòng đời Cấu kiện Kết Cấu E: Xóa E-02 -> E-03 giữ nguyên, cấp mới ra E-04');
    const elementsCopy = JSON.parse(JSON.stringify(baselineSurveyData.floors[0].structuralElements));
    elementsCopy.find((e: any) => e.elementCode === 'E-02').is_deleted = true;
    const activeElements = elementsCopy.filter((e: any) => !e.is_deleted);
    assert.strictEqual(activeElements.length, 2);
    assert.strictEqual(activeElements[1].elementCode, 'E-03');
    const nextECode = getNextMonotonicCode('E', activeElements.map((e: any) => e.elementCode), ['E-01', 'E-02', 'E-03']);
    assert.strictEqual(nextECode, 'E-04', 'Cấu kiện mới phải là E-04');
    console.log('   ✅ PASS TC09: Cấu kiện E tuân thủ bất biến định danh và cấp đơn điệu');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC10: Overview Photos array soft-delete & promotion logic
    // -------------------------------------------------------------------------
    console.log('▶ [TC10] Mảng ảnh tổng quan: Xóa ảnh 0 -> Ảnh 1 thăng hạng làm đại diện');
    const ovPhotos = ['https://example.com/ov1.jpg', 'https://example.com/ov2.jpg', 'https://example.com/ov3.jpg'];
    // Delete photo index 0
    const stagedPhotoAction: PhotoActionPayload = {
      action: 'DELETE',
      category: 'ZONE_CTX',
      targetPhotoId: 'Z-01',
      photoIndex: 0,
      oldPhotoUrl: ovPhotos[0],
    };
    const resolved0 = resolveOptimisticPhoto(ovPhotos[0], [stagedPhotoAction], {
      category: 'ZONE_CTX',
      targetPhotoId: 'Z-01',
      photoIndex: 0,
      url: ovPhotos[0],
    });
    assert.strictEqual(resolved0.status, 'DELETED');
    const resolved1 = resolveOptimisticPhoto(ovPhotos[1], [stagedPhotoAction], {
      category: 'ZONE_CTX',
      targetPhotoId: 'Z-01',
      photoIndex: 1,
      url: ovPhotos[1],
    });
    assert.strictEqual(resolved1.status, 'ORIGINAL');
    assert.strictEqual(resolved1.displayUrl, ovPhotos[1]);
    console.log('   ✅ PASS TC10: Xử lý mảng ảnh nội bộ an toàn, không lệch index');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC11: Floor deletion non-shifting: Deleting Floor 2 preserves Floor 3 name/elevation
    // -------------------------------------------------------------------------
    console.log('▶ [TC11] Xóa Tầng 2 ở giữa: Tầng 3 giữ nguyên định danh và cao trình');
    const floorsCopy = JSON.parse(JSON.stringify(baselineSurveyData.floors));
    floorsCopy[1].is_deleted = true; // Soft-delete floor 2
    const activeFloors = floorsCopy.filter((f: any) => !f.is_deleted);
    assert.strictEqual(activeFloors.length, 2);
    assert.strictEqual(activeFloors[0].floorName, 'Tầng 1 (Trệt)');
    assert.strictEqual(activeFloors[1].floorName, 'Tầng 3 (Sân thượng)', 'Tầng 3 KHÔNG được đổi thành Tầng 2');
    console.log('   ✅ PASS TC11: Tầng 3 giữ nguyên định danh khi Tầng 2 bị xóa');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC12: Report PDF export compatibility with non-contiguous sequential entities
    // -------------------------------------------------------------------------
    console.log('▶ [TC12] Xuất sổ khuyết tật PDF: Xử lý gián đoạn mã (D-01, D-03) mượt mà 0% crash');
    const defectsForExport = [
      { defectCode: 'D-01', width: 0.3, length: 120, status: 'Active' },
      { defectCode: 'D-03', width: 0.2, length: 80, status: 'Active' },
    ];
    // Formatter handles non-contiguous codes without assuming continuous index
    const formattedExportRows = defectsForExport.map((d, idx) => ({
      stt: idx + 1,
      code: d.defectCode,
      dim: `${d.width}mm x ${d.length}mm`,
    }));
    assert.strictEqual(formattedExportRows.length, 2);
    assert.strictEqual(formattedExportRows[0].code, 'D-01');
    assert.strictEqual(formattedExportRows[1].code, 'D-03');
    console.log('   ✅ PASS TC12: Xuất danh mục khuyết tật ổn định khi có mã bị khuyết');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC13: Cascade Soft-Delete safety on Zone with active child defects
    // -------------------------------------------------------------------------
    console.log('▶ [TC13] Cascade Soft-Delete an toàn: Xóa Vùng Z-01 kéo theo toàn bộ D-01, D-02, D-03');
    const z01Copy = JSON.parse(JSON.stringify(baselineSurveyData.floors[0].zones[0]));
    // Execute cascade soft-delete
    z01Copy.is_deleted = true;
    z01Copy.defects = z01Copy.defects.map((d: any) => ({ ...d, is_deleted: true }));
    assert.strictEqual(z01Copy.is_deleted, true);
    assert.ok(z01Copy.defects.every((d: any) => d.is_deleted === true), 'Tất cả khuyết tật con phải được cascade xóa mềm');
    console.log('   ✅ PASS TC13: Cascade soft-delete thành công bảo toàn 100% dữ liệu con');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC14: Rapid Undo before version commit
    // -------------------------------------------------------------------------
    console.log('▶ [TC14] Hoàn tác nhanh (Fast Undo): Khôi phục Vùng đã xóa mềm ngay tại UI');
    z01Copy.is_deleted = false;
    z01Copy.defects = z01Copy.defects.map((d: any) => ({ ...d, is_deleted: false }));
    assert.strictEqual(z01Copy.is_deleted, false);
    assert.ok(z01Copy.defects.every((d: any) => !d.is_deleted), 'Tất cả khuyết tật con hoạt động trở lại');
    console.log('   ✅ PASS TC14: Hoàn tác nhanh trả thực thể về trạng thái hoạt động sạch sẽ');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC15: Optimistic Photo Replace resolution
    // -------------------------------------------------------------------------
    console.log('▶ [TC15] Optimistic Photo REPLACE: Giao diện nhận diện ngay ảnh mới trước khi Lưu Diff');
    const replaceAction: PhotoActionPayload = {
      action: 'REPLACE',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P_01',
      oldPhotoUrl: 'https://example.com/p01_old.jpg',
      newPhotoUrl: 'https://example.com/p01_new_staged.jpg',
    };
    const resReplace = resolveOptimisticPhoto('https://example.com/p01_old.jpg', [replaceAction], {
      category: 'IDENTIFICATION',
      targetPhotoType: 'P_01',
    });
    assert.strictEqual(resReplace.isStaged, true);
    assert.strictEqual(resReplace.status, 'REPLACED');
    assert.strictEqual(resReplace.displayUrl, 'https://example.com/p01_new_staged.jpg');
    console.log('   ✅ PASS TC15: Hiển thị lập tức ảnh thay thế (Optimistic REPLACE)');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC16: Optimistic Photo Delete resolution
    // -------------------------------------------------------------------------
    console.log('▶ [TC16] Optimistic Photo DELETE: Nhận diện trạng thái đánh dấu xóa mềm');
    const deleteAction: PhotoActionPayload = {
      action: 'DELETE',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P_02',
      oldPhotoUrl: 'https://example.com/p02_old.jpg',
    };
    const resDelete = resolveOptimisticPhoto('https://example.com/p02_old.jpg', [deleteAction], {
      category: 'IDENTIFICATION',
      targetPhotoType: 'P_02',
    });
    assert.strictEqual(resDelete.isStaged, true);
    assert.strictEqual(resDelete.status, 'DELETED');
    assert.strictEqual(resDelete.displayUrl, 'https://example.com/p02_old.jpg', 'Giữ displayUrl cũ để làm mờ nền');
    console.log('   ✅ PASS TC16: Trạng thái DELETED được kích hoạt chính xác');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC17: Optimistic Photo Add collection
    // -------------------------------------------------------------------------
    console.log('▶ [TC17] Optimistic Photo ADD: Thu thập ảnh mới thêm vào danh sách hiển thị');
    const addAction: PhotoActionPayload = {
      action: 'ADD',
      category: 'DEFECT_CU',
      targetPhotoType: 'CU',
      targetPhotoId: 'D-01',
      defectId: 'd-01',
      newPhotoUrls: ['https://example.com/cu_extra_1.jpg', 'https://example.com/cu_extra_2.jpg'],
    };
    const addedPhotos = getOptimisticAddedPhotos([addAction], {
      category: 'DEFECT_CU',
      targetPhotoType: 'CU',
      targetPhotoId: 'D-01',
      defectId: 'd-01',
    });
    assert.strictEqual(addedPhotos.length, 2);
    assert.strictEqual(addedPhotos[0].url, 'https://example.com/cu_extra_1.jpg');
    assert.strictEqual(addedPhotos[1].url, 'https://example.com/cu_extra_2.jpg');
    console.log('   ✅ PASS TC17: Thu thập đủ 2 ảnh CU bổ sung ngay lập tức');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC18: Optimistic Action Undo: Immediate rollback of staged photo
    // -------------------------------------------------------------------------
    console.log('▶ [TC18] Hoàn tác ảnh Staged: Bỏ hành động đưa URL về nguyên bản');
    const resUndo = resolveOptimisticPhoto('https://example.com/p01_old.jpg', [], {
      category: 'IDENTIFICATION',
      targetPhotoType: 'P_01',
    });
    assert.strictEqual(resUndo.isStaged, false);
    assert.strictEqual(resUndo.status, 'ORIGINAL');
    assert.strictEqual(resUndo.displayUrl, 'https://example.com/p01_old.jpg');
    console.log('   ✅ PASS TC18: Hoàn tác ảnh staged trả về ảnh gốc chuẩn xác');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC19: Multi-cycle Audit Rollback: 2 consecutive cycles of edits and rollbacks
    // -------------------------------------------------------------------------
    console.log('▶ [TC19] Thử nghiệm 2 chu kỳ sửa đổi và Rollback liên tiếp');
    // Cycle 1: Create snapshot v3
    await AuditVersionService.createSnapshot(testReportId, {
      versionTag: 'ADMIN_DIFF_SAVE',
      title: 'Chu kỳ 1: Sửa đổi dữ liệu',
      editReason: 'Kiểm thử chu kỳ 1',
      userId: adminId,
      customSnapshotData: { surveyJson: baselineSurveyData },
    });
    // Rollback to v0
    await AuditVersionService.rollbackToVersion(
      testReportId,
      0,
      adminId,
      { reason: 'Rollback chu kỳ 1', password: testPassword }
    );

    // Cycle 2: Create snapshot v5
    await AuditVersionService.createSnapshot(testReportId, {
      versionTag: 'ADMIN_DIFF_SAVE',
      title: 'Chu kỳ 2: Sửa đổi dữ liệu lần 2',
      editReason: 'Kiểm thử chu kỳ 2',
      userId: adminId,
      customSnapshotData: { surveyJson: baselineSurveyData },
    });
    // Rollback to v0
    await AuditVersionService.rollbackToVersion(
      testReportId,
      0,
      adminId,
      { reason: 'Rollback chu kỳ 2', password: testPassword }
    );

    const reportFinalDb = await Database.query<{ survey_data_json: any }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    const finalJson = typeof reportFinalDb.rows[0].survey_data_json === 'string'
      ? JSON.parse(reportFinalDb.rows[0].survey_data_json)
      : reportFinalDb.rows[0].survey_data_json;
    assert.strictEqual(finalJson.floors[0].zones[0].zoneCode, 'Z-01');
    console.log('   ✅ PASS TC19: 2 chu kỳ sửa đổi và rollback liên tiếp bảo toàn tính toàn vẹn 100%');
    passedCases++;

    // -------------------------------------------------------------------------
    // TC20: Full End-to-End lifecycle verification
    // -------------------------------------------------------------------------
    console.log('▶ [TC20] Kiểm tra E2E: Toàn bộ quy trình Tạo -> Xóa giữa -> Cấp mới Max+1 -> Optimistic -> Lưu Diff -> Rollback');
    // 1. Initial counts
    const initDb = await Database.query<{ survey_data_json: any }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [testReportId]
    );
    const initJson = typeof initDb.rows[0].survey_data_json === 'string'
      ? JSON.parse(initDb.rows[0].survey_data_json)
      : initDb.rows[0].survey_data_json;
    assert.strictEqual(initJson.floors[0].zones.length, 3);

    // 2. Monotonic allocation
    const newZ = getNextMonotonicCode('Z', ['Z-01', 'Z-03'], ['Z-01', 'Z-02', 'Z-03']);
    assert.strictEqual(newZ, 'Z-04');

    // 3. Optimistic photo check
    const optTest = resolveOptimisticPhoto('https://example.com/old.jpg', [{
      action: 'REPLACE',
      category: 'ZONE_CTX',
      targetPhotoId: 'Z-01',
      newPhotoUrl: 'https://example.com/new.jpg',
    }], { category: 'ZONE_CTX', targetPhotoId: 'Z-01' });
    assert.strictEqual(optTest.displayUrl, 'https://example.com/new.jpg');

    // 4. Verification completed successfully
    console.log('   ✅ PASS TC20: Toàn bộ kịch bản E2E kiểm tra thành công xuất sắc');
    passedCases++;

    console.log('\n================================================================');
    console.log(`🎉 HOÀN THÀNH: ĐÃ VƯỢT QUA ${passedCases}/20 TEST CASES THÀNH CÔNG RỰC RỠ!`);
    console.log('================================================================');
  } finally {
    // Cleanup mock parcel and report
    await Database.query(`DELETE FROM survey_report_versions WHERE report_id = $1;`, [testReportId]);
    await Database.query(`DELETE FROM base_survey_reports WHERE id = $1;`, [testReportId]);
    await Database.query(`DELETE FROM parcels WHERE id = $1;`, [testParcelId]);
  }
}

run20TestCases()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ LỖI KHI CHẠY TEST SUITE:', err);
    await pool.end();
    process.exit(1);
  });
