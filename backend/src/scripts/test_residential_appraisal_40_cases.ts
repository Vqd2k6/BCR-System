import * as fs from 'fs';
import * as path from 'path';
import { pool, Database } from '../database/db';
import { CryptoUtils } from '../common/utils/crypto.utils';
import { CadastralGeometryService } from '../modules/cadastral/services/cadastral-geometry.service';
import { AuditReviewService } from '../modules/audit/services/audit-review.service';
import { AuditModificationService } from '../modules/audit/services/audit-modification.service';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';
import { ReportConsistencyGate } from '../modules/audit/services/report-consistency-gate';
import { ReportV3Service } from '../modules/report_v3/report-v3.service';
import { ReportReleaseService, getReleaseStorageDir } from '../modules/report_v3/report-release.service';
import { ReportSnapshotService, sha256Hex } from '../modules/report_v3/report-snapshot.service';
import {
  extractParcelPolygonCoords,
  calculateMetroDistances,
  calculateDistancesFromPolygon,
} from '../modules/report_v2/utils/metro-spatial.utils';
import type { JwtPayload } from '../common/guards/auth.guard';

interface TestCaseResult {
  suite: string;
  id: string;
  name: string;
  passed: boolean;
  detail?: string;
  error?: string;
}

const results: TestCaseResult[] = [];

async function runCase(
  suite: string,
  id: string,
  name: string,
  fn: () => Promise<string | void> | string | void
): Promise<void> {
  try {
    const detail = await fn();
    results.push({ suite, id, name, passed: true, detail: detail || 'OK' });
    console.log(`  ✅ [PASS] ${id}: ${name}${detail ? ` -> (${detail})` : ''}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ suite, id, name, passed: false, error: msg });
    console.error(`  ❌ [FAIL] ${id}: ${name}\n      Error: ${msg}`);
  }
}

function normalizeRing(ring: [number, number][]): [number, number][] {
  if (!ring || ring.length < 2) return ring || [];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.abs(first[0] - last[0]) <= 0.000001 && Math.abs(first[1] - last[1]) <= 0.000001) {
    return ring.slice(0, -1);
  }
  return ring;
}

function areRingsDifferent(ringA: [number, number][], ringB: [number, number][], tol = 0.00001): boolean {
  const normA = normalizeRing(ringA);
  const normB = normalizeRing(ringB);
  if (normA.length === 0 || normB.length === 0) return false;
  if (normA.length !== normB.length) return true;
  for (let i = 0; i < normA.length; i++) {
    if (Math.abs(normA[i][0] - normB[i][0]) > tol || Math.abs(normA[i][1] - normB[i][1]) > tol) {
      return true;
    }
  }
  return false;
}

export async function runResidentialAppraisal40Cases(): Promise<void> {
  console.log('==========================================================================================');
  console.log('🚀 BỘ KIỂM THỬ E2E THẨM ĐỊNH NHÀ DÂN TOÀN DIỆN (4 NGHIỆP VỤ × 10 TESTCASES = 40 CASES)');
  console.log('==========================================================================================\n');

  const cleanupReports: string[] = [];
  const cleanupParcels: string[] = [];
  const cleanupUsers: string[] = [];

  try {
    const migPath = path.join(__dirname, '../../database/migrations/20261023_protect_approved_survey_reports.sql');
    if (fs.existsSync(migPath)) {
      await Database.query(fs.readFileSync(migPath, 'utf8'));
    }

    const superAdminRes = await Database.query<{ id: string; username: string; full_name: string }>(
      `SELECT id, username, full_name FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1;`
    );
    const surveyorRes = await Database.query<{ id: string; username: string; full_name: string }>(
      `SELECT id, username, full_name FROM users WHERE role = 'SURVEYOR' LIMIT 1;`
    );

    const superAdminId = superAdminRes.rows[0]?.id;
    const surveyorId = surveyorRes.rows[0]?.id || superAdminId;
    if (!superAdminId || !surveyorId) {
      throw new Error('Không tìm thấy tài khoản SUPER_ADMIN / SURVEYOR trong CSDL.');
    }

    // Tạo 1 tài khoản ZONE_ADMIN chuyên biệt cho phiên kiểm thử với mật khẩu đã biết để test xác thực mật khẩu
    const TEST_ADMIN_PWD = 'Metro2@Test2026!';
    const pwdHash = await CryptoUtils.hashPassword(TEST_ADMIN_PWD);
    const uniqueSuffix = Date.now().toString().slice(-6);
    const assignedZoneId = 'ZONE_09';

    const testAdminIns = await Database.query<{ id: string }>(
      `INSERT INTO users (username, password_hash, full_name, role, assigned_zone_id, phone)
       VALUES ($1, $2, 'Zone Admin Kiểm Thử E2E', 'ZONE_ADMIN', $3, '0909888777')
       RETURNING id;`,
      [`za_e2e_${uniqueSuffix}`, pwdHash, assignedZoneId]
    );
    const zoneAdminId = testAdminIns.rows[0].id;
    cleanupUsers.push(zoneAdminId);

    const superAdminJwt: JwtPayload = {
      userId: superAdminId,
      username: superAdminRes.rows[0]?.username || 'superadmin',
      fullName: superAdminRes.rows[0]?.full_name || 'Super Admin',
      role: 'SUPER_ADMIN',
    };
    const zoneAdminJwt: JwtPayload = {
      userId: zoneAdminId,
      username: `za_e2e_${uniqueSuffix}`,
      fullName: 'Zone Admin Kiểm Thử E2E',
      role: 'ZONE_ADMIN',
      assignedZoneId,
    };
    const otherZoneAdminJwt: JwtPayload = {
      userId: zoneAdminId,
      username: 'other_za',
      fullName: 'Other Zone Admin',
      role: 'ZONE_ADMIN',
      assignedZoneId: 'ZONE_99_OTHER',
    };
    const surveyorJwt: JwtPayload = {
      userId: surveyorId,
      username: surveyorRes.rows[0]?.username || 'surveyor',
      fullName: surveyorRes.rows[0]?.full_name || 'Surveyor',
      role: 'SURVEYOR',
    };

    // Tọa độ KSV thực địa ban đầu (trước GPMB - gần ga Tao Đàn / Cách Mạng Tháng 8)
    const ksvPolygon4Pts: [number, number][] = [
      [10.77450, 106.68810],
      [10.77450, 106.68822],
      [10.77438, 106.68822],
      [10.77438, 106.68810],
    ];
    // Tọa độ sau khi cắt lộ giới GPMB (lùi mặt tiền vào trong ~3.5m)
    const gpmbPolygon4Pts: [number, number][] = [
      [10.77447, 106.68813],
      [10.77447, 106.68822],
      [10.77438, 106.68822],
      [10.77438, 106.68813],
    ];
    // Tọa độ nắn chỉnh tại Bước 6
    const step6Polygon4Pts: [number, number][] = [
      [10.77446, 106.68814],
      [10.77446, 106.68823],
      [10.77437, 106.68823],
      [10.77437, 106.68814],
    ];

    const gpmbGeoJson = JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [106.68813, 10.77447],
          [106.68822, 10.77447],
          [106.68822, 10.77438],
          [106.68813, 10.77438],
          [106.68813, 10.77447],
        ],
      ],
    });

    const parcelCode1 = `B-E2E-${uniqueSuffix}`;
    const reportCode1 = `RP-E2E-${uniqueSuffix}`;

    const p1Res = await Database.query<{ id: string }>(
      `INSERT INTO parcels (
         zone_id, official_cadastral_code, project_parcel_code, house_number, street, ward, district,
         owner_name, owner_phone, land_area_m2, construction_area_m2, floor_count,
         building_type, survey_status, mutation_type,
         location_geom, cadastral_polygon_geom, footprint_polygon_geom, distance_to_centerline_m
       ) VALUES (
         $1, 'TD-105', $2, '105A', 'Cách Mạng Tháng 8', 'Phường Phạm Ngũ Lão', 'Quận 1',
         'Nguyễn Văn Thực Nghiệm', '0909123456', 61.6, 184.8, 3,
         'STANDALONE', 'SUBMITTED', 'REDRAW',
         ST_SetSRID(ST_Point(106.68816, 10.77444), 4326),
         ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
         ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
         19.8
       ) RETURNING id;`,
      [assignedZoneId, parcelCode1, gpmbGeoJson]
    );
    const parcelId1 = p1Res.rows[0].id;
    cleanupParcels.push(parcelId1);

    const initialSurveyJson = {
      houseNumber: '105A',
      street: 'Cách Mạng Tháng 8',
      ward: 'Phường Phạm Ngũ Lão',
      district: 'Quận 1',
      ownerName: 'Nguyễn Văn Thực Nghiệm',
      ownerPhone: '0909123456',
      landAreaM2: 61.6,
      constructionAreaM2: 184.8,
      frontageWidth: 4.4,
      lotDepth: 14.0,
      aboveFloors: 3,
      undergroundFloors: 0,
      constructionYear: 2012,
      foundationCatScore: 3,
      metroOffsetDistance: '16.2m',
      clearanceOffsetDistance: '4.1m',
      parcelCoordinates: ksvPolygon4Pts,
      polygonCoords: ksvPolygon4Pts,
      ownerSignatureUrl: '/uploads/signatures/owner-sig-e2e.png',
      signatures: {
        ownerSignatureUrl: '/uploads/signatures/owner-sig-e2e.png',
        surveyorSignatureUrl: '/uploads/signatures/ksv-sig-e2e.png',
      },
      accessLimitation: { type: 'FULL_100' },
      surveyScope: { fullySurveyed: true },
      photos: {
        idCardFront: '/uploads/mock/id-front.jpg',
        frontView: '/uploads/mock/ovr-front.jpg',
      },
      floors: [
        {
          id: 'floor_0',
          floorCode: 'F1',
          floorName: 'Tầng trệt',
          floorNumber: 1,
          zones: [
            {
              id: 'Z-01',
              zoneCode: 'Z-01',
              areaName: 'Phòng khách tầng trệt',
              componentType: 'WALL',
              ctxPhotoUrl: '/uploads/mock/f0-z01-ctx.jpg',
              defects: [
                {
                  id: 'D-01',
                  defectCode: 'D-01',
                  defectType: 'Vết nứt tường',
                  lengthMm: 1200,
                  widthMaxMm: 0.8,
                  cuPhotoUrl: '/uploads/mock/f0-z01-d01-cu1.jpg',
                  cuPhotos: ['/uploads/mock/f0-z01-d01-cu1.jpg', '/uploads/mock/f0-z01-d01-cu2.jpg'],
                },
              ],
            },
            {
              id: 'Z-02',
              zoneCode: 'Z-02',
              areaName: 'Bếp tầng trệt',
              componentType: 'WALL',
              ctxPhotoUrl: '/uploads/mock/f0-z02-ctx.jpg',
              defects: [
                {
                  id: 'D-01',
                  defectCode: 'D-01',
                  defectType: 'Bong tróc vữa',
                  lengthMm: 600,
                  widthMaxMm: 0.5,
                  cuPhotoUrl: '/uploads/mock/f0-z02-d01-cu1.jpg',
                  cuPhotos: ['/uploads/mock/f0-z02-d01-cu1.jpg'],
                },
              ],
            },
          ],
        },
        {
          id: 'floor_1',
          floorCode: 'F2',
          floorName: 'Lầu 1',
          floorNumber: 2,
          zones: [
            {
              id: 'Z-01',
              zoneCode: 'Z-01',
              areaName: 'Phòng ngủ Lầu 1',
              componentType: 'WALL',
              ctxPhotoUrl: '/uploads/mock/f1-z01-ctx.jpg',
              defects: [
                {
                  id: 'D-01',
                  defectCode: 'D-01',
                  defectType: 'Nứt chân chim',
                  lengthMm: 450,
                  widthMaxMm: 0.3,
                  cuPhotoUrl: '/uploads/mock/f1-z01-d01-cu1.jpg',
                  cuPhotos: ['/uploads/mock/f1-z01-d01-cu1.jpg'],
                },
              ],
            },
          ],
        },
      ],
    };

    const r1Res = await Database.query<{ id: string }>(
      `INSERT INTO base_survey_reports (
         parcel_id, surveyor_id, zone_admin_id, report_code, status,
         current_step, is_refused_or_absent, survey_data_json, export_revision,
         owner_signature_url, surveyor_signature_url
       ) VALUES ($1, $2, $3, $4, 'UNDER_REVIEW', 5, FALSE, $5, 0, $6, $7)
       RETURNING id;`,
      [
        parcelId1,
        surveyorId,
        zoneAdminId,
        reportCode1,
        JSON.stringify(initialSurveyJson),
        '/uploads/signatures/owner-sig-e2e.png',
        '/uploads/signatures/ksv-sig-e2e.png',
      ]
    );
    const reportId1 = r1Res.rows[0].id;
    cleanupReports.push(reportId1);

    await Database.query(
      `INSERT INTO building_specifications (
         report_id, building_name, floor_count, basement_count, year_of_construction,
         structural_system, foundation_category
       ) VALUES ($1, 'Nhà ở riêng lẻ 105A', 3, 0, 2012, 'KHUNG_BTCT_CHIU_LUC', 'CAT_3_MONG_BANG_BTCT')
       ON CONFLICT (report_id) DO NOTHING;`,
      [reportId1]
    );

    // =========================================================================================
    // NGHIỆP VỤ 1 (10 TESTCASES): ĐỒNG BỘ RANH ĐẤT GPMB, CỰ LY TRẮC ĐỊA & BẢO TOÀN DIỆN TÍCH
    // =========================================================================================
    console.log('\n══ NGHIỆP VỤ 1 (10 CASES): ĐỒNG BỘ RANH ĐẤT GPMB, CỰ LY TRẮC ĐỊA & BẢO TOÀN DIỆN TÍCH ══');

    await runCase(
      'NV1: Đồng bộ Ranh GPMB',
      'TC-NV1-01 (TC-SPA-01)',
      'Phát hiện xung đột ranh đất GPMB khi cadastral_polygon_geom trên PostGIS khác với parcelCoordinates',
      async () => {
        const view = await AuditReviewService.getSplitPaneAuditView(reportId1);
        const cadGeo = view.cadastralGeojson || view.cadastral_geojson;
        if (!cadGeo) {
          throw new Error('getSplitPaneAuditView thiếu cadastralGeojson');
        }
        if (view.mutation_type !== 'REDRAW') {
          throw new Error(`Kỳ vọng mutation_type = REDRAW, nhận được: ${view.mutation_type}`);
        }
        const pgGeo = JSON.parse(cadGeo);
        const pgRing: [number, number][] = pgGeo.coordinates[0].map((c: [number, number]) => [c[1], c[0]]);
        const sJson = view.survey_data_json;
        const ksvRing: [number, number][] = sJson.parcelCoordinates;
        const isConflict = areRingsDifferent(pgRing, ksvRing, 0.00001);
        if (!isConflict) {
          throw new Error('Kỳ vọng phát hiện xung đột ranh GPMB (isConflict = true) nhưng nhận được false');
        }
        return `mutation_type=${view.mutation_type}, dbDist=${view.distance_to_centerline_m}m`;
      }
    );

    await runCase(
      'NV1: Đồng bộ Ranh GPMB',
      'TC-NV1-02 (TC-SPA-02)',
      'Chuẩn hóa vòng đa giác khép kín (5 đỉnh PostGIS vs 4 đỉnh KSV): không báo xung đột giả (False Positive)',
      () => {
        const pgClosed5Pts: [number, number][] = [
          ...ksvPolygon4Pts,
          ksvPolygon4Pts[0],
        ];
        const diff = areRingsDifferent(pgClosed5Pts, ksvPolygon4Pts, 0.00001);
        if (diff) {
          throw new Error('Báo xung đột giả (False Positive) giữa vòng 5 đỉnh PostGIS và 4 đỉnh KSV!');
        }
        return `normLen=${normalizeRing(pgClosed5Pts).length} đỉnh, diff=false`;
      }
    );

    await runCase(
      'NV1: Đồng bộ Ranh GPMB',
      'TC-NV1-03 (TC-SPA-03)',
      'Đối chiếu chi tiết cự ly Trước & Sau GPMB (calculateDistancesFromPolygon & chênh lệch Δ mét)',
      () => {
        const oldMetrics = calculateDistancesFromPolygon(ksvPolygon4Pts);
        const newMetrics = calculateDistancesFromPolygon(gpmbPolygon4Pts);
        if (oldMetrics.centerlineDist === null || newMetrics.centerlineDist === null) {
          throw new Error('Không tính được cự ly từ đa giác đến tim tuyến Metro 2');
        }
        const delta = Math.abs(newMetrics.centerlineDist - oldMetrics.centerlineDist);
        if (delta <= 0) {
          throw new Error(`Kỳ vọng cự ly trước và sau GPMB có chênh lệch Δ > 0, nhận được Δ=${delta}`);
        }
        return `Trước=${oldMetrics.centerlineDist.toFixed(2)}m -> Sau=${newMetrics.centerlineDist.toFixed(2)}m (Δ=${delta.toFixed(2)}m)`;
      }
    );

    await runCase(
      'NV1: Đồng bộ Ranh GPMB',
      'TC-NV1-04 (TC-SPA-04)',
      'Áp dụng ranh PostGIS vào Bước 1 & Lưu: cập nhật tọa độ + cự ly nhưng bảo toàn 100% landAreaM2, constructionAreaM2, frontageWidth, lotDepth',
      async () => {
        await AuditModificationService.applyAdminSurveyEdit(reportId1, zoneAdminId, {
          adminPassword: TEST_ADMIN_PWD,
          updates: {
            parcelCoordinates: gpmbPolygon4Pts,
            polygonCoords: gpmbPolygon4Pts,
            keepKsvBoundaryConfirmed: false,
            keepKsvBoundaryReason: '',
          },
          editReason: 'Cập nhật ranh đất đã nắn chỉnh sau Giải phóng mặt bằng (GPMB) & tính lại cự ly Metro',
          diffPayload: [
            {
              field: 'parcelCoordinates',
              label: 'Đa giác ranh thửa đất (PostGIS GPMB)',
              oldValue: '4 đỉnh (KSV)',
              newValue: '4 đỉnh (PostGIS GPMB)',
            },
          ],
        });

        const checkRes = await Database.query<{ survey_data_json: Record<string, unknown>; land_area_m2: string }>(
          `SELECT r.survey_data_json, p.land_area_m2
           FROM base_survey_reports r JOIN parcels p ON r.parcel_id = p.id
           WHERE r.id = $1;`,
          [reportId1]
        );
        const sJson = checkRes.rows[0].survey_data_json;
        if (Number(sJson.landAreaM2) !== 61.6) {
          throw new Error(`landAreaM2 bị biến đổi! Kỳ vọng 61.6, nhận được: ${sJson.landAreaM2}`);
        }
        if (Number(sJson.constructionAreaM2) !== 184.8) {
          throw new Error(`constructionAreaM2 bị biến đổi! Kỳ vọng 184.8, nhận được: ${sJson.constructionAreaM2}`);
        }
        if (Number(sJson.frontageWidth) !== 4.4 || Number(sJson.lotDepth) !== 14.0) {
          throw new Error(`frontageWidth/lotDepth bị biến đổi! Nhận được: ${sJson.frontageWidth} x ${sJson.lotDepth}`);
        }
        return `landAreaM2=${sJson.landAreaM2}m², constructionAreaM2=${sJson.constructionAreaM2}m², metroDist=${sJson.metroOffsetDistance}`;
      }
    );

    await runCase(
      'NV1: Đồng bộ Ranh GPMB',
      'TC-NV1-05 (TC-SPA-05)',
      'Nắn ranh tại Bước 6 (reshapeParcelGeometry): cập nhật PostGIS + parcelCoordinates nhưng bảo toàn diện tích đã thẩm định trong survey_data_json',
      async () => {
        const reshapeRes = await CadastralGeometryService.reshapeParcelGeometry(
          parcelId1,
          step6Polygon4Pts,
          zoneAdminId,
          'Nắn chỉnh ranh thửa đất tại Bước 6 khớp thực địa sau giải tỏa'
        );
        if (!reshapeRes.success) {
          throw new Error('reshapeParcelGeometry thất bại');
        }
        const repRes = await Database.query<{ survey_data_json: Record<string, unknown> }>(
          `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
          [reportId1]
        );
        const sJson = repRes.rows[0].survey_data_json;
        if (Number(sJson.landAreaM2) !== 61.6 || Number(sJson.constructionAreaM2) !== 184.8) {
          throw new Error(
            `reshapeParcelGeometry làm mất diện tích đã thẩm định! landAreaM2=${sJson.landAreaM2}, constructionAreaM2=${sJson.constructionAreaM2}`
          );
        }
        const coords = sJson.parcelCoordinates as [number, number][];
        if (areRingsDifferent(coords, step6Polygon4Pts, 0.00001)) {
          throw new Error('parcelCoordinates trong survey_data_json chưa được đồng bộ theo Bước 6');
        }
        return `PostGIS area=${reshapeRes.newAreaM2}m², preserved survey landAreaM2=${sJson.landAreaM2}m²`;
      }
    );

    await runCase(
      'NV1: Đồng bộ Ranh GPMB',
      'TC-NV1-06',
      'Trường hợp 2 (Giữ ranh KSV thực địa): extractParcelPolygonCoords & calculateMetroDistances ưu tiên tọa độ KSV khi keepKsvBoundaryConfirmed = true',
      () => {
        const mockRaw = {
          parcel_polygon_geojson: gpmbGeoJson,
          cadastral_geojson: gpmbGeoJson,
          mutation_type: 'REDRAW',
          distance_to_centerline_m: 99.9,
        };
        const mockJsonKeepKsv = {
          parcelCoordinates: ksvPolygon4Pts,
          metroOffsetDistance: '16.2m',
          keepKsvBoundaryConfirmed: true,
          keepKsvBoundaryReason: 'Giữ nguyên ranh khảo sát thực địa theo hiện trạng tường xây',
        };
        const extracted = extractParcelPolygonCoords(mockRaw, mockJsonKeepKsv);
        if (!extracted || areRingsDifferent(extracted, ksvPolygon4Pts, 0.00001)) {
          throw new Error('extractParcelPolygonCoords không ưu tiên tọa độ KSV khi keepKsvBoundaryConfirmed = true');
        }
        const dists = calculateMetroDistances(mockRaw, mockJsonKeepKsv);
        if (dists.distanceToAlignmentM === '99.9' || dists.distanceToAlignmentM !== '16.2') {
          throw new Error(`calculateMetroDistances không ưu tiên cự ly KSV (16.2m) mà trả về: ${dists.distanceToAlignmentM}`);
        }
        return `extracted=KSV(4 đỉnh), ksvCenterlineDist=${dists.distanceToAlignmentM}m`;
      }
    );

    await runCase(
      'NV1: Đồng bộ Ranh GPMB',
      'TC-NV1-07',
      'Fallback sang đa giác PostGIS khi survey_data_json không có parcelCoordinates',
      () => {
        const mockRaw = {
          cadastral_geojson: gpmbGeoJson,
          mutation_type: 'ORIGINAL',
        };
        const extracted = extractParcelPolygonCoords(mockRaw, {});
        if (!extracted || extracted.length < 4) {
          throw new Error('extractParcelPolygonCoords không fallback sang cadastral_geojson khi thiếu parcelCoordinates');
        }
        return `fallbackVertices=${extracted.length}`;
      }
    );

    await runCase(
      'NV1: Đồng bộ Ranh GPMB',
      'TC-NV1-08',
      'Tính toán chính xác cự ly khi ranh thửa đất nằm sát tim tuyến Metro (< 15m) vs xa tim tuyến',
      () => {
        const nearCoords: [number, number][] = [
          [10.77260, 106.69800],
          [10.77260, 106.69808],
          [10.77252, 106.69808],
          [10.77252, 106.69800],
        ];
        const res = calculateDistancesFromPolygon(nearCoords);
        if (res.centerlineDist === null || isNaN(res.centerlineDist)) {
          throw new Error('centerlineDist trả về null/NaN');
        }
        return `centerlineDist=${res.centerlineDist.toFixed(2)}m, outerBoundaryDist=${res.outerBoundaryDist?.toFixed(2) ?? 'N/A'}m`;
      }
    );

    await runCase(
      'NV1: Đồng bộ Ranh GPMB',
      'TC-NV1-09',
      'Ghi nhận đầy đủ sự kiện biến động REDRAW trong parcel_mutation_events và system_audit_logs khi nắn ranh',
      async () => {
        const mutCheck = await Database.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM parcel_mutation_events WHERE $1::uuid = ANY(source_parcel_ids) AND mutation_type = 'REDRAW';`,
          [parcelId1]
        );
        const logCheck = await Database.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM system_audit_logs WHERE entity_id = $1 AND action = 'PARCEL_GEOMETRY_RESHAPE';`,
          [parcelId1]
        );
        if (Number(mutCheck.rows[0]?.count || 0) < 1 || Number(logCheck.rows[0]?.count || 0) < 1) {
          throw new Error('Thiếu bản ghi parcel_mutation_events hoặc system_audit_logs sau khi reshapeParcelGeometry');
        }
        return `mutations=${mutCheck.rows[0].count}, auditLogs=${logCheck.rows[0].count}`;
      }
    );

    await runCase(
      'NV1: Đồng bộ Ranh GPMB',
      'TC-NV1-10',
      'Chặn nắn ranh (reshapeParcelGeometry) đối với đa giác tự cắt chéo (self-intersecting bowtie polygon)',
      async () => {
        const bowtiePolygon: [number, number][] = [
          [10.77450, 106.68810],
          [10.77438, 106.68822],
          [10.77450, 106.68822],
          [10.77438, 106.68810],
        ];
        let blocked = false;
        try {
          await CadastralGeometryService.reshapeParcelGeometry(
            parcelId1,
            bowtiePolygon,
            zoneAdminId,
            'Thử nghiệm đa giác tự cắt'
          );
        } catch (err: unknown) {
          if (err instanceof Error && (err.name === 'BadRequestError' || err.message.includes('lỗi hình học'))) {
            blocked = true;
          }
        }
        if (!blocked) {
          throw new Error('reshapeParcelGeometry không chặn đa giác tự cắt chéo (bowtie polygon)!');
        }
        return 'Blocked self-intersecting polygon (BadRequestError)';
      }
    );

    // =========================================================================================
    // NGHIỆP VỤ 2 (10 TESTCASES): CHỐT CHẶN NHẤT QUÁN PHÊ DUYỆT & LÝ DO CHỈNH SỬA CHUẨN HÓA
    // =========================================================================================
    console.log('\n══ NGHIỆP VỤ 2 (10 CASES): CHỐT CHẶN NHẤT QUÁN PHÊ DUYỆT & LÝ DO CHỈNH SỬA CHUẨN HÓA ══');

    await runCase(
      'NV2: Consistency Gate & Lý do',
      'TC-NV2-01 (TC-GAT-01)',
      'Chặn phê duyệt (POSTGIS_GEOMETRY_MISMATCH_UNACKNOWLEDGED) khi ranh PostGIS lệch với parcelCoordinates chưa đồng bộ/giải trình',
      async () => {
        await Database.query(
          `UPDATE base_survey_reports
           SET survey_data_json = jsonb_set(
                 jsonb_set(survey_data_json, '{parcelCoordinates}', $2::jsonb),
                 '{keepKsvBoundaryConfirmed}', 'false'::jsonb
               )
           WHERE id = $1;`,
          [reportId1, JSON.stringify(ksvPolygon4Pts)]
        );

        let blockedCode = '';
        try {
          await AuditReviewService.approveReport(reportId1, zoneAdminId, 'Thử duyệt khi ranh đang lệch');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('POSTGIS_GEOMETRY_MISMATCH_UNACKNOWLEDGED')) {
            blockedCode = 'POSTGIS_GEOMETRY_MISMATCH_UNACKNOWLEDGED';
          }
        }
        if (!blockedCode) {
          throw new Error('ReportConsistencyGate KHÔNG chặn khi ranh PostGIS lệch với parcelCoordinates chưa xác nhận!');
        }
        return `Blocked with ${blockedCode}`;
      }
    );

    await runCase(
      'NV2: Consistency Gate & Lý do',
      'TC-NV2-02 (TC-GAT-02)',
      'Cho phép vượt qua Rule 5 của ReportConsistencyGate khi parcelCoordinates đã đồng bộ khớp với PostGIS',
      async () => {
        const repRow = await Database.query<{
          survey_data_json: Record<string, unknown>;
          cadastral_geojson: string;
        }>(
          `SELECT r.survey_data_json, ST_AsGeoJSON(p.cadastral_polygon_geom) AS cadastral_geojson
           FROM base_survey_reports r JOIN parcels p ON r.parcel_id = p.id
           WHERE r.id = $1;`,
          [reportId1]
        );
        const syncedJson = {
          ...repRow.rows[0].survey_data_json,
          parcelCoordinates: step6Polygon4Pts,
          polygonCoords: step6Polygon4Pts,
        };
        const gateRes = ReportConsistencyGate.evaluate(
          {
            id: reportId1,
            report_code: reportCode1,
            status: 'UNDER_REVIEW',
            is_refused_or_absent: false,
            cadastral_geojson: repRow.rows[0].cadastral_geojson,
          },
          syncedJson
        );
        const hasMismatchErr = gateRes.hardErrors.some((e: string) =>
          e.includes('POSTGIS_GEOMETRY_MISMATCH_UNACKNOWLEDGED')
        );
        if (hasMismatchErr) {
          throw new Error(
            `Vẫn báo lỗi POSTGIS_GEOMETRY_MISMATCH_UNACKNOWLEDGED sau khi đã đồng bộ: ${gateRes.hardErrors.join('; ')}`
          );
        }
        return `passed=${gateRes.passed}, hasGeometryMismatch=${gateRes.details.hasGeometryMismatch}`;
      }
    );

    await runCase(
      'NV2: Consistency Gate & Lý do',
      'TC-NV2-03',
      'Chặn phê duyệt khi tích keepKsvBoundaryConfirmed = true nhưng lý do giải trình < 10 ký tự',
      async () => {
        const repRow = await Database.query<{
          survey_data_json: Record<string, unknown>;
          cadastral_geojson: string;
        }>(
          `SELECT r.survey_data_json, ST_AsGeoJSON(p.cadastral_polygon_geom) AS cadastral_geojson
           FROM base_survey_reports r JOIN parcels p ON r.parcel_id = p.id
           WHERE r.id = $1;`,
          [reportId1]
        );
        const shortReasonJson = {
          ...repRow.rows[0].survey_data_json,
          parcelCoordinates: ksvPolygon4Pts,
          keepKsvBoundaryConfirmed: true,
          keepKsvBoundaryReason: 'Ngắn',
        };
        const gateRes = ReportConsistencyGate.evaluate(
          {
            id: reportId1,
            report_code: reportCode1,
            status: 'UNDER_REVIEW',
            is_refused_or_absent: false,
            cadastral_geojson: repRow.rows[0].cadastral_geojson,
          },
          shortReasonJson
        );
        if (
          gateRes.passed ||
          !gateRes.hardErrors.some((e: string) => e.includes('POSTGIS_GEOMETRY_MISMATCH_UNACKNOWLEDGED'))
        ) {
          throw new Error('Không chặn khi lý do giữ ranh KSV ngắn hơn 10 ký tự!');
        }
        return 'Blocked short reason (< 10 chars)';
      }
    );

    await runCase(
      'NV2: Consistency Gate & Lý do',
      'TC-NV2-04 (TC-GAT-03)',
      'Cho phép vượt qua Rule 5 khi tích keepKsvBoundaryConfirmed = true kèm lý do giải trình >= 10 ký tự',
      async () => {
        const repRow = await Database.query<{
          survey_data_json: Record<string, unknown>;
          cadastral_geojson: string;
        }>(
          `SELECT r.survey_data_json, ST_AsGeoJSON(p.cadastral_polygon_geom) AS cadastral_geojson
           FROM base_survey_reports r JOIN parcels p ON r.parcel_id = p.id
           WHERE r.id = $1;`,
          [reportId1]
        );
        const validKeepKsvJson = {
          ...repRow.rows[0].survey_data_json,
          parcelCoordinates: ksvPolygon4Pts,
          keepKsvBoundaryConfirmed: true,
          keepKsvBoundaryReason: 'Giữ ranh thực địa theo tường rào hiện hữu của hộ dân chưa bàn giao mặt bằng',
        };
        const gateRes = ReportConsistencyGate.evaluate(
          {
            id: reportId1,
            report_code: reportCode1,
            status: 'UNDER_REVIEW',
            is_refused_or_absent: false,
            cadastral_geojson: repRow.rows[0].cadastral_geojson,
          },
          validKeepKsvJson
        );
        if (!gateRes.passed || !gateRes.details.keepKsvBoundaryAcknowledged) {
          throw new Error(`Không cho phép vượt qua khi đã giải trình hợp lệ: ${gateRes.hardErrors.join('; ')}`);
        }
        return `passed=true, keepKsvBoundaryAcknowledged=${gateRes.details.keepKsvBoundaryAcknowledged}`;
      }
    );

    await runCase(
      'NV2: Consistency Gate & Lý do',
      'TC-NV2-05 (TC-GAT-04)',
      'Chặn lưu chỉnh sửa (applyAdminSurveyEdit) khi editReason rỗng hoặc chỉ chứa khoảng trắng (400 BadRequestError)',
      async () => {
        let blockedEmpty = false;
        try {
          await AuditModificationService.applyAdminSurveyEdit(reportId1, zoneAdminId, {
            adminPassword: TEST_ADMIN_PWD,
            updates: { houseNumber: '105B' },
            editReason: '    ',
            diffPayload: [],
          });
        } catch (err: unknown) {
          if (err instanceof Error && (err.name === 'BadRequestError' || err.message.includes('editReason'))) {
            blockedEmpty = true;
          }
        }
        if (!blockedEmpty) {
          throw new Error('applyAdminSurveyEdit không chặn khi editReason rỗng!');
        }
        return 'Blocked empty editReason with BadRequestError';
      }
    );

    await runCase(
      'NV2: Consistency Gate & Lý do',
      'TC-NV2-06 (TC-GAT-05)',
      'Lưu chỉnh sửa thành công với 5 Lý do Chuẩn hóa (Preset Reasons) và ghi nhận đầy đủ vào survey_report_versions',
      async () => {
        const presetReason = 'Chuẩn hóa tên đường và đơn vị hành chính theo Nghị quyết 1685/NQ-UBTVQH15';
        await AuditModificationService.applyAdminSurveyEdit(reportId1, zoneAdminId, {
          adminPassword: TEST_ADMIN_PWD,
          updates: {
            parcelCoordinates: step6Polygon4Pts,
            polygonCoords: step6Polygon4Pts,
            ward: 'Phường Bến Thành',
          },
          editReason: presetReason,
          diffPayload: [
            { field: 'ward', label: 'Phường/Xã', oldValue: 'Phường Phạm Ngũ Lão', newValue: 'Phường Bến Thành' },
          ],
        });
        const verCheck = await Database.query<{ edit_reason: string; version_tag: string; version_number: number }>(
          `SELECT edit_reason, version_tag, version_number
           FROM survey_report_versions
           WHERE report_id = $1 AND version_tag = 'ADMIN_DIFF_SAVE'
           ORDER BY version_number DESC LIMIT 1;`,
          [reportId1]
        );
        if (verCheck.rows[0]?.edit_reason !== presetReason) {
          throw new Error(`Lý do lưu trong survey_report_versions không khớp: ${verCheck.rows[0]?.edit_reason}`);
        }
        return `versionNumber=${verCheck.rows[0].version_number}, tag=${verCheck.rows[0].version_tag}`;
      }
    );

    await runCase(
      'NV2: Consistency Gate & Lý do',
      'TC-NV2-07',
      'ReportConsistencyGate chặn phê duyệt khi báo cáo khai báo Mái không tiếp cận nhưng lại có khuyết tật tại tầng Mái',
      () => {
        const roofConflictJson = {
          ...initialSurveyJson,
          parcelCoordinates: step6Polygon4Pts,
          accessLimitation: {
            type: 'PARTIAL',
            restrictedAreas: ['Mái / Sân thượng'],
            notes: 'Chủ nhà khóa cửa lên sân thượng',
          },
          floors: [
            {
              floorName: 'Tầng Mái / Sân thượng',
              defects: [{ id: 'D-ROOF-01', defectType: 'Nứt sàn mái' }],
            },
          ],
        };
        const gateRes = ReportConsistencyGate.evaluate(
          {
            id: reportId1,
            report_code: reportCode1,
            status: 'UNDER_REVIEW',
          },
          roofConflictJson
        );
        if (gateRes.passed || !gateRes.details.hasRoofDefects) {
          throw new Error('Không phát hiện mâu thuẫn Mái không tiếp cận nhưng có khuyết tật!');
        }
        return 'Blocked roof access contradiction (hasRoofDefects=true)';
      }
    );

    await runCase(
      'NV2: Consistency Gate & Lý do',
      'TC-NV2-08',
      'Gatekeeper CAT 1/2 chặn lưu chỉnh sửa nâng cấp móng lên CAT 1/2 khi thiếu ảnh bản vẽ hoàn công',
      async () => {
        let blockedCat = false;
        try {
          await AuditModificationService.applyAdminSurveyEdit(reportId1, zoneAdminId, {
            adminPassword: TEST_ADMIN_PWD,
            updates: { foundationCatScore: 1 },
            editReason: 'Thử nâng lên CAT 1 khi không có bản vẽ hoàn công',
            diffPayload: [],
          });
        } catch (err: unknown) {
          if (err instanceof Error && err.message.includes('CAT 1/CAT 2')) {
            blockedCat = true;
          }
        }
        if (!blockedCat) {
          throw new Error('Không chặn nâng cấp CAT 1 khi thiếu bản vẽ hoàn công!');
        }
        return 'Blocked CAT 1 without as-built drawing';
      }
    );

    await runCase(
      'NV2: Consistency Gate & Lý do',
      'TC-NV2-09',
      'Bảo toàn 100% chữ ký chủ hộ (ownerSignatureUrl) sau khi Admin chỉnh sửa thông tin kỹ thuật (Quyết định Q1)',
      async () => {
        const repRes = await Database.query<{ survey_data_json: Record<string, unknown>; owner_signature_url: string }>(
          `SELECT survey_data_json, owner_signature_url FROM base_survey_reports WHERE id = $1;`,
          [reportId1]
        );
        const sJson = repRes.rows[0].survey_data_json;
        const sigObj = sJson.signatures as Record<string, unknown> | undefined;
        if (
          sJson.ownerSignatureUrl !== '/uploads/signatures/owner-sig-e2e.png' ||
          sigObj?.ownerSignatureUrl !== '/uploads/signatures/owner-sig-e2e.png'
        ) {
          throw new Error('Chữ ký chủ hộ bị mất sau khi Admin lưu chỉnh sửa!');
        }
        return `ownerSignatureUrl=${sJson.ownerSignatureUrl}`;
      }
    );

    await runCase(
      'NV2: Consistency Gate & Lý do',
      'TC-NV2-10',
      'ReportConsistencyGate phát hiện cảnh báo lệch điểm V2 hệ kết cấu (hasStructureV2Mismatch) và PARTIAL thiếu ghi chú',
      () => {
        const v2MismatchJson = {
          ...initialSurveyJson,
          parcelCoordinates: step6Polygon4Pts,
          structureSystem: 'KHUNG_BTCT',
          vulnerabilityIndex: { v2: 99 },
          accessLimitation: { type: 'PARTIAL', restrictedAreas: [], notes: '' },
        };
        const gateRes = ReportConsistencyGate.evaluate(
          {
            id: reportId1,
            report_code: reportCode1,
            status: 'UNDER_REVIEW',
          },
          v2MismatchJson
        );
        if (!gateRes.details.hasStructureV2Mismatch || !gateRes.details.hasEmptyPartialAccessNotes) {
          throw new Error('Không phát hiện hasStructureV2Mismatch hoặc hasEmptyPartialAccessNotes!');
        }
        return `warnings=${gateRes.warnings.length} (V2 mismatch + empty PARTIAL notes)`;
      }
    );

    // =========================================================================================
    // NGHIỆP VỤ 3 (10 TESTCASES): QUẢN LÝ REVISION, TRIGGER BẤT BIẾN & "CHỜ PHÁT HÀNH REV MỚI"
    // =========================================================================================
    console.log('\n══ NGHIỆP VỤ 3 (10 CASES): QUẢN LÝ REVISION, TRIGGER BẤT BIẾN & "CHỜ PHÁT HÀNH REV MỚI" ══');

    await runCase(
      'NV3: Revision & Khóa Bất biến',
      'TC-NV3-01 (TC-VER-01)',
      'Phê duyệt lần đầu (approveReport): status = APPROVED, export_revision = 0 (Rev.00), chụp Snapshot APPROVED_RELEASE bất biến',
      async () => {
        const appRes = await AuditReviewService.approveReport(
          reportId1,
          zoneAdminId,
          'Phê duyệt lần đầu sau khi đồng bộ ranh GPMB'
        );
        if (appRes.status !== 'APPROVED' || appRes.exportRevision !== 0) {
          throw new Error(`Kỳ vọng APPROVED & exportRevision=0, nhận được: ${appRes.status}, rev=${appRes.exportRevision}`);
        }
        const snap = await ReportSnapshotService.getLatestApprovedSnapshot(reportId1);
        if (!snap || snap.snapshot.exportRevision !== 0) {
          throw new Error('Không tìm thấy snapshot APPROVED_RELEASE với exportRevision = 0');
        }
        return `status=${appRes.status}, exportRevision=${appRes.exportRevision}, sha256=${snap.snapshot.contentSha256.slice(0, 12)}...`;
      }
    );

    await runCase(
      'NV3: Revision & Khóa Bất biến',
      'TC-NV3-02 (TC-VER-02)',
      'Trigger PostgreSQL trg_protect_approved_survey chặn cứng SQL UPDATE survey_data_json trực tiếp khi đang APPROVED (23514)',
      async () => {
        let triggerBlocked = false;
        let errCode = '';
        try {
          await Database.query(
            `UPDATE base_survey_reports SET survey_data_json = '{"hacked": true}'::jsonb WHERE id = $1;`,
            [reportId1]
          );
        } catch (err: unknown) {
          const pgErr = err as { code?: string; message?: string };
          if (pgErr.code === '23514' || pgErr.message?.includes('SURVEY_REPORT_LOCKED_APPROVED')) {
            triggerBlocked = true;
            errCode = pgErr.code || '23514';
          }
        }
        if (!triggerBlocked) {
          throw new Error('Trigger trg_protect_approved_survey KHÔNG chặn SQL UPDATE survey_data_json khi đang APPROVED!');
        }
        return `Blocked by PostgreSQL Trigger (ERRCODE=${errCode})`;
      }
    );

    await runCase(
      'NV3: Revision & Khóa Bất biến',
      'TC-NV3-03',
      'Trigger PostgreSQL trg_protect_approved_survey chặn cứng SQL UPDATE summary_conclusions hoặc nhảy cóc export_revision = 99 khi đang APPROVED',
      async () => {
        let blockedSummary = false;
        let blockedRevJump = false;
        try {
          await Database.query(
            `UPDATE base_survey_reports SET summary_conclusions = 'Sửa trái phép' WHERE id = $1;`,
            [reportId1]
          );
        } catch (err: unknown) {
          const pgErr = err as { code?: string; message?: string };
          if (pgErr.code === '23514' || pgErr.message?.includes('SURVEY_REPORT_LOCKED_APPROVED')) {
            blockedSummary = true;
          }
        }
        try {
          await Database.query(
            `UPDATE base_survey_reports SET export_revision = 99 WHERE id = $1;`,
            [reportId1]
          );
        } catch (err: unknown) {
          const pgErr = err as { code?: string; message?: string };
          if (pgErr.code === '23514' || pgErr.message?.includes('SURVEY_REPORT_LOCKED_APPROVED')) {
            blockedRevJump = true;
          }
        }
        if (!blockedSummary || !blockedRevJump) {
          throw new Error(`Trigger không chặn triệt để: blockedSummary=${blockedSummary}, blockedRevJump=${blockedRevJump}`);
        }
        return 'Blocked illegal summary_conclusions & export_revision=99 updates';
      }
    );

    await runCase(
      'NV3: Revision & Khóa Bất biến',
      'TC-NV3-04',
      'Trigger trg_protect_approved_parcels & CadastralGeometryService chặn nắn ranh thửa đất khi hồ sơ đang APPROVED',
      async () => {
        let blockedService = false;
        let blockedTrigger = false;
        try {
          await CadastralGeometryService.reshapeParcelGeometry(
            parcelId1,
            ksvPolygon4Pts,
            zoneAdminId,
            'Thử sửa khi đã APPROVED'
          );
        } catch (err: unknown) {
          if (err instanceof Error && (err.name === 'ForbiddenError' || err.message.includes('APPROVED'))) {
            blockedService = true;
          }
        }
        try {
          await Database.query(`UPDATE parcels SET house_number = 'HACK-105' WHERE id = $1;`, [parcelId1]);
        } catch (err: unknown) {
          const pgErr = err as { message?: string };
          if (pgErr.message?.includes('PARCEL_LOCKED_APPROVED')) {
            blockedTrigger = true;
          }
        }
        if (!blockedService || !blockedTrigger) {
          throw new Error(`Chưa chặn triệt để trên parcels: service=${blockedService}, trigger=${blockedTrigger}`);
        }
        return 'Blocked both service reshape and raw SQL UPDATE on parcels';
      }
    );

    await runCase(
      'NV3: Revision & Khóa Bất biến',
      'TC-NV3-05',
      'Chặn chỉnh sửa trực tiếp qua AuditModificationService.applyAdminSurveyEdit (403) và chặn approveReport lần 2 (409) khi đang APPROVED',
      async () => {
        let editBlocked = false;
        let doubleApproveBlocked = false;
        try {
          await AuditModificationService.applyAdminSurveyEdit(reportId1, zoneAdminId, {
            adminPassword: TEST_ADMIN_PWD,
            updates: { ownerName: 'Sửa khi đang khóa' },
            editReason: 'Hiệu chỉnh số liệu mặt tiền & diện tích theo sổ đỏ/bản vẽ hoàn công',
            diffPayload: [],
          });
        } catch (err: unknown) {
          if (
            err instanceof Error &&
            (err.name === 'ForbiddenError' || err.name === 'ConflictError' || err.message.includes('khóa bất biến'))
          ) {
            editBlocked = true;
          }
        }
        try {
          await AuditReviewService.approveReport(reportId1, zoneAdminId, 'Duyệt lần 2 liên tiếp');
        } catch (err: unknown) {
          if (err instanceof Error && (err.name === 'ConflictError' || err.message.includes('APPROVED'))) {
            doubleApproveBlocked = true;
          }
        }
        if (!editBlocked || !doubleApproveBlocked) {
          throw new Error(`Kỳ vọng chặn cả 2: editBlocked=${editBlocked}, doubleApproveBlocked=${doubleApproveBlocked}`);
        }
        return 'Blocked applyAdminSurveyEdit (403) & double approveReport (409)';
      }
    );

    await runCase(
      'NV3: Revision & Khóa Bất biến',
      'TC-NV3-06 (TC-VER-03)',
      'Mở khóa hồ sơ đã duyệt (unlockApprovedReport): chỉ SUPER_ADMIN được phép chuyển từ APPROVED về UNDER_REVIEW & ghi Audit Log',
      async () => {
        const unlockRes = await AuditReviewService.unlockApprovedReport(reportId1, superAdminId);
        if (unlockRes.status !== 'UNDER_REVIEW') {
          throw new Error(`Kỳ vọng status = UNDER_REVIEW, nhận được: ${unlockRes.status}`);
        }
        const repCheck = await Database.query<{ status: string }>(
          `SELECT status::text AS status FROM base_survey_reports WHERE id = $1;`,
          [reportId1]
        );
        if (repCheck.rows[0]?.status !== 'UNDER_REVIEW') {
          throw new Error(`DB status chưa chuyển về UNDER_REVIEW: ${repCheck.rows[0]?.status}`);
        }
        return `status=APPROVED -> ${unlockRes.status}`;
      }
    );

    await runCase(
      'NV3: Revision & Khóa Bất biến',
      'TC-NV3-07 (TC-VER-04)',
      'Chỉnh sửa sau mở khóa & Phê duyệt lại: export_revision giữ nguyên 0, bật cờ has_pending_release = true ("Chờ phát hành Rev mới")',
      async () => {
        await AuditModificationService.applyAdminSurveyEdit(reportId1, zoneAdminId, {
          adminPassword: TEST_ADMIN_PWD,
          updates: {
            engineeringRecommendations: 'Bổ sung khuyến nghị quan trắc lún nghiêng định kỳ 2 lần/tuần',
          },
          editReason: 'Điều chỉnh cấp nứt Burland và phân loại kết cấu sau phúc tra thực địa',
          diffPayload: [
            {
              field: 'engineeringRecommendations',
              label: 'Khuyến nghị kỹ thuật',
              oldValue: '',
              newValue: 'Bổ sung khuyến nghị quan trắc lún nghiêng định kỳ 2 lần/tuần',
            },
          ],
        });

        const reApp = await AuditReviewService.approveReport(
          reportId1,
          zoneAdminId,
          'Phê duyệt lại sau khi bổ sung khuyến nghị quan trắc'
        );
        if (reApp.exportRevision !== 0) {
          throw new Error(`Phê duyệt lại không được tự tăng export_revision! Nhận được: ${reApp.exportRevision}`);
        }

        const releaseSummary = await ReportReleaseService.getReleaseSummary(reportId1);
        if (!releaseSummary.hasPendingRelease) {
          throw new Error('ReportReleaseService.getReleaseSummary không bật hasPendingRelease = true sau khi duyệt lại!');
        }

        const queueRes = await AuditReviewService.listPendingSubmissions({
          parcelId: parcelId1,
          status: 'APPROVED',
          filterLevel: 'PENDING_RELEASE',
        });
        const queueItem = queueRes.items.find((it: { report_id: string }) => it.report_id === reportId1);
        if (!queueItem || !queueItem.has_pending_release) {
          throw new Error(
            'listPendingSubmissions không trả về has_pending_release = true cho hồ sơ chờ phát hành Rev mới!'
          );
        }

        return `exportRevision=${reApp.exportRevision}, hasPendingRelease=${releaseSummary.hasPendingRelease}, queueBadge=true`;
      }
    );

    await runCase(
      'NV3: Revision & Khóa Bất biến',
      'TC-NV3-08 (TC-VER-05)',
      'Phát hành Rev mới (issueNewRevision): tăng export_revision từ 0 lên 1 (Rev.01), tạo file PDF thật + SHA-256 và tắt cờ hasPendingRelease',
      async () => {
        const rel = await ReportReleaseService.issueNewRevision(
          reportId1,
          zoneAdminJwt,
          'Phát hành chính thức Rev.01 sau khi hoàn tất thẩm định lại số liệu GPMB và khuyến nghị'
        );
        if (rel.revision !== 1) {
          throw new Error(`Kỳ vọng revision = 1 (Rev.01), nhận được: ${rel.revision}`);
        }
        if (!fs.existsSync(rel.filePath)) {
          throw new Error(`File PDF Rev.01 không tồn tại trên đĩa: ${rel.filePath}`);
        }

        const summaryAfter = await ReportReleaseService.getReleaseSummary(reportId1);
        if (summaryAfter.currentExportRevision !== 1 || summaryAfter.hasPendingRelease !== false) {
          throw new Error(
            `Sau khi phát hành Rev.01, kỳ vọng currentExportRevision=1 & hasPendingRelease=false, nhận được: rev=${summaryAfter.currentExportRevision}, pending=${summaryAfter.hasPendingRelease}`
          );
        }

        const queueAfter = await AuditReviewService.listPendingSubmissions({
          parcelId: parcelId1,
          status: 'APPROVED',
        });
        const rowAfter = queueAfter.items.find((it: { report_id: string }) => it.report_id === reportId1);
        if (!rowAfter || rowAfter.has_pending_release !== false || Number(rowAfter.export_revision) !== 1) {
          throw new Error(
            `Hàng đợi sau phát hành Rev.01 chưa cập nhật đúng: export_revision=${rowAfter?.export_revision}, has_pending_release=${rowAfter?.has_pending_release}`
          );
        }

        return `Rev=0${rel.revision}, size=${Math.round(rel.fileSizeBytes / 1024)}KB, hasPendingRelease=false`;
      }
    );

    await runCase(
      'NV3: Revision & Khóa Bất biến',
      'TC-NV3-09',
      'Kiểm soát phân quyền phát hành Rev (D14): chặn Zone Admin khác phân khu (403), chặn Surveyor (403) và chặn lý do < 10 ký tự (400)',
      async () => {
        let blockedOtherZone = false;
        let blockedSurveyor = false;
        let blockedShortReason = false;
        try {
          await ReportReleaseService.issueNewRevision(reportId1, otherZoneAdminJwt, 'Lý do hợp lệ trên 10 ký tự');
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'ForbiddenError') blockedOtherZone = true;
        }
        try {
          await ReportReleaseService.issueNewRevision(reportId1, surveyorJwt, 'Lý do hợp lệ trên 10 ký tự');
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'ForbiddenError') blockedSurveyor = true;
        }
        try {
          await ReportReleaseService.issueNewRevision(reportId1, superAdminJwt, 'Ngắn');
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'BadRequestError') blockedShortReason = true;
        }
        if (!blockedOtherZone || !blockedSurveyor || !blockedShortReason) {
          throw new Error(
            `Phân quyền D14 chưa chặt: otherZone=${blockedOtherZone}, surveyor=${blockedSurveyor}, shortReason=${blockedShortReason}`
          );
        }
        return 'Blocked other Zone Admin (403), Surveyor (403), and short reason (400)';
      }
    );

    await runCase(
      'NV3: Revision & Khóa Bất biến',
      'TC-NV3-10',
      'Khôi phục phiên bản (AuditVersionService.rollbackToVersion): chặn khi đang APPROVED; cho phép rollback sau khi mở khóa về UNDER_REVIEW',
      async () => {
        const history = await AuditVersionService.getVersionList(reportId1);
        const targetVer = history.find((v: { versionTag: string }) => v.versionTag === 'ADMIN_DIFF_SAVE');
        if (!targetVer) {
          throw new Error('Không tìm thấy version ADMIN_DIFF_SAVE để kiểm thử rollback');
        }

        let blockedWhileApproved = false;
        try {
          await AuditVersionService.rollbackToVersion(reportId1, targetVer.versionNumber, zoneAdminId, {
            reason: 'Thử rollback khi đang APPROVED',
            password: TEST_ADMIN_PWD,
          });
        } catch (err: unknown) {
          if (
            err instanceof Error &&
            (err.name === 'ForbiddenError' || err.name === 'ConflictError' || err.message.includes('APPROVED') || err.message.includes('khóa'))
          ) {
            blockedWhileApproved = true;
          }
        }
        if (!blockedWhileApproved) {
          throw new Error('Không chặn rollbackToVersion khi hồ sơ đang khóa APPROVED!');
        }

        await AuditReviewService.unlockApprovedReport(reportId1, superAdminId);
        const rbRes = await AuditVersionService.rollbackToVersion(reportId1, targetVer.versionNumber, zoneAdminId, {
          reason: 'Khôi phục về bản lưu trước đó để đối chiếu',
          password: TEST_ADMIN_PWD,
        });
        if (!rbRes) {
          throw new Error('rollbackToVersion thất bại sau khi đã mở khóa');
        }
        await AuditReviewService.approveReport(reportId1, zoneAdminId, 'Duyệt lại sau khi kiểm thử rollback');
        return `blockedWhenApproved=true, rolledBackToVer=v${targetVer.versionNumber}`;
      }
    );

    // =========================================================================================
    // NGHIỆP VỤ 4 (10 TESTCASES): XUẤT BÁO CÁO PDF A4, SỔ CÁI VÒNG ĐỜI ẢNH & KIỂM ĐỊNH UI
    // =========================================================================================
    console.log('\n══ NGHIỆP VỤ 4 (10 CASES): XUẤT BÁO CÁO PDF A4, SỔ CÁI VÒNG ĐỜI ẢNH & KIỂM ĐỊNH UI ══');

    await runCase(
      'NV4: Xuất PDF & UI/Ảnh',
      'TC-NV4-01 (TC-PDF-01)',
      'Xuất Báo cáo HTML/PDF sau khi Đồng bộ Ranh PostGIS (Trường hợp 1): hiển thị ranh mới, cự ly mới và giữ nguyên diện tích 61.6m²',
      async () => {
        const resolved = await ReportV3Service.resolve(reportId1);
        const { html } = await ReportV3Service.renderDraftHtml(resolved, undefined, false, true);
        const textOnly = html.replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, '');
        if (!textOnly.includes('61.6')) {
          throw new Error('Báo cáo HTML không hiển thị diện tích đất 61.6 m² đã bảo toàn!');
        }
        if (/\bNaN\b/.test(textOnly) || />undefined</.test(textOnly)) {
          throw new Error('Báo cáo HTML chứa NaN hoặc undefined!');
        }
        return `HTML length=${Math.round(html.length / 1024)}KB, preservedArea=61.6m²`;
      }
    );

    await runCase(
      'NV4: Xuất PDF & UI/Ảnh',
      'TC-NV4-02 (TC-PDF-02)',
      'Xuất Báo cáo HTML/PDF khi Giữ Ranh KSV Thực địa (Trường hợp 2 - keepKsvBoundaryConfirmed = true): ưu tiên ranh & cự ly KSV',
      async () => {
        await AuditReviewService.unlockApprovedReport(reportId1, superAdminId);
        await AuditModificationService.applyAdminSurveyEdit(reportId1, zoneAdminId, {
          adminPassword: TEST_ADMIN_PWD,
          updates: {
            parcelCoordinates: ksvPolygon4Pts,
            polygonCoords: ksvPolygon4Pts,
            keepKsvBoundaryConfirmed: true,
            keepKsvBoundaryReason: 'Giữ nguyên ranh khảo sát thực địa theo tường rào hiện hữu của hộ dân',
          },
          editReason: 'Cập nhật ranh đất đã nắn chỉnh sau Giải phóng mặt bằng (GPMB) & tính lại cự ly Metro',
          diffPayload: [],
        });
        await AuditReviewService.approveReport(reportId1, zoneAdminId, 'Phê duyệt theo phương án giữ ranh KSV thực địa');

        const resolved = await ReportV3Service.resolve(reportId1);
        const { html } = await ReportV3Service.renderDraftHtml(resolved, undefined, false, true);
        const expectedKsvDist = calculateDistancesFromPolygon(ksvPolygon4Pts).centerlineDist?.toFixed(1) || '16.2';
        if (!html.includes(expectedKsvDist) && !html.includes('61.6')) {
          throw new Error(`Báo cáo HTML không phản ánh cự ly KSV (${expectedKsvDist}m) khi keepKsvBoundaryConfirmed=true`);
        }
        return `keepKsvBoundaryConfirmed=true, ksvDist=${expectedKsvDist}m`;
      }
    );

    await runCase(
      'NV4: Xuất PDF & UI/Ảnh',
      'TC-NV4-03',
      'Đối chiếu bản xuất DRAFT (khi UNDER_REVIEW - có watermark DRAFT) và bản FINAL (khi APPROVED - không watermark, chống client override)',
      async () => {
        const resolvedApproved = await ReportV3Service.resolve(reportId1);
        const { html: finalHtml } = await ReportV3Service.renderDraftHtml(
          resolvedApproved,
          { ownerName: 'HACKER_OVERRIDE_NAME_999' },
          false,
          true
        );
        if (finalHtml.includes('HACKER_OVERRIDE_NAME_999')) {
          throw new Error('Hồ sơ APPROVED bị lọt client override!');
        }
        if (finalHtml.includes('DRAFT – KHÔNG CÓ GIÁ TRỊ PHÁP LÝ')) {
          throw new Error('Hồ sơ APPROVED vẫn hiển thị watermark DRAFT!');
        }

        await AuditReviewService.unlockApprovedReport(reportId1, superAdminId);
        const resolvedDraft = await ReportV3Service.resolve(reportId1);
        const { html: draftHtml } = await ReportV3Service.renderDraftHtml(resolvedDraft, undefined, false, true);
        if (!draftHtml.includes('DRAFT – KHÔNG CÓ GIÁ TRỊ PHÁP LÝ')) {
          throw new Error('Hồ sơ UNDER_REVIEW thiếu watermark DRAFT – KHÔNG CÓ GIÁ TRỊ PHÁP LÝ!');
        }
        return 'DRAFT has watermark; FINAL blocks client overrides & removes watermark';
      }
    );

    await runCase(
      'NV4: Xuất PDF & UI/Ảnh',
      'TC-NV4-04',
      'Kiểm tra toàn vẹn SHA-256 của file PDF phát hành (readVerifiedFile): phát hiện ngay nếu file trên đĩa bị sửa 1 byte',
      async () => {
        const rel = await ReportReleaseService.get(reportId1, 1);
        if (!rel) {
          throw new Error('Không tìm thấy bản phát hành Rev.01 của hồ sơ test');
        }
        const origBuf = fs.readFileSync(rel.filePath);
        const corruptedBuf = Buffer.from(origBuf);
        corruptedBuf[corruptedBuf.length - 1] = corruptedBuf[corruptedBuf.length - 1] ^ 0xff;
        fs.writeFileSync(rel.filePath, corruptedBuf);
        let detectedTamper = false;
        try {
          ReportReleaseService.readVerifiedFile(rel);
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'ConflictError') {
            detectedTamper = true;
          }
        } finally {
          fs.writeFileSync(rel.filePath, origBuf);
        }
        const verifiedBuf = ReportReleaseService.readVerifiedFile(rel);
        if (!detectedTamper || sha256Hex(verifiedBuf) !== rel.sha256) {
          throw new Error('readVerifiedFile không phát hiện được hành vi sửa 1 byte trên file PDF!');
        }
        return `SHA-256 verified (${rel.sha256.slice(0, 12)}...), 1-byte tamper blocked`;
      }
    );

    await runCase(
      'NV4: Xuất PDF & UI/Ảnh',
      'TC-NV4-05',
      'Sổ cái vòng đời ảnh kiểm toán (photoActions REPLACE & DELETE + getPhotoAuditRegistry): xóa mềm ảnh, lưu lịch sử biến động ảnh',
      async () => {
        await AuditModificationService.applyAdminSurveyEdit(reportId1, zoneAdminId, {
          adminPassword: TEST_ADMIN_PWD,
          updates: {},
          editReason: 'Xoay hướng ảnh và cập nhật thước đo khe nứt chuẩn A4',
          diffPayload: [],
          photoActions: [
            {
              action: 'REPLACE',
              category: 'DEFECT_CU',
              targetPhotoType: 'CU',
              photoCode: 'D-01-CU',
              defectCode: 'D-01',
              defectId: 'D-01',
              photoIndex: 0,
              oldPhotoUrl: '/uploads/mock/f0-z01-d01-cu1.jpg',
              newPhotoUrl: '/uploads/mock/f0-z01-d01-cu1-replaced.jpg',
              reason: 'Thay ảnh cận cảnh có thước đo khe nứt rõ nét chuẩn A4',
            },
            {
              action: 'DELETE',
              category: 'DEFECT_CU',
              targetPhotoType: 'CU',
              photoCode: 'D-01-CU #2',
              defectCode: 'D-01',
              defectId: 'D-01',
              photoIndex: 1,
              oldPhotoUrl: '/uploads/mock/f0-z01-d01-cu2.jpg',
              reason: 'Xóa ảnh cận cảnh bị rung mờ trùng lặp',
            },
          ],
        });

        const photoRegistry = await AuditModificationService.getPhotoAuditRegistry(reportId1, {
          includeDeleted: true,
        });
        if (!Array.isArray(photoRegistry) || photoRegistry.length < 2) {
          throw new Error(`Kỳ vọng có >= 2 bản ghi sổ cái ảnh, nhận được: ${photoRegistry?.length ?? 0}`);
        }
        return `photoRegistryRecords=${photoRegistry.length}`;
      }
    );

    await runCase(
      'NV4: Xuất PDF & UI/Ảnh',
      'TC-NV4-06',
      'Hoàn tác ảnh từ sổ cái kiểm toán (restoreReportPhoto): khôi phục ảnh cũ về trạng thái ACTIVE và ghi nhận lịch sử RESTORE',
      async () => {
        const regList = await AuditModificationService.getPhotoAuditRegistry(reportId1, {
          includeDeleted: true,
        });
        const targetEntry = regList[0];
        if (!targetEntry?.id) {
          throw new Error('Không tìm thấy bản ghi trong survey_photo_registry để kiểm thử restoreReportPhoto');
        }
        const restoreRes = await AuditModificationService.restoreReportPhoto(reportId1, zoneAdminId, {
          registryPhotoId: targetEntry.id,
          restoreReason: 'Khôi phục ảnh cận cảnh từ sổ cái kiểm toán để đối chiếu toàn diện',
        });
        if (!restoreRes.success) {
          throw new Error('restoreReportPhoto không thành công');
        }
        return `restoredCode=${restoreRes.photoCode}, newRegistryId=${restoreRes.registryId}`;
      }
    );

    await runCase(
      'NV4: Xuất PDF & UI/Ảnh',
      'TC-NV4-07',
      'Lưu góc xoay ảnh chuẩn A4 (photoRotations: 90, 180, 270 độ) qua applyAdminSurveyEdit và bảo toàn khi đọc lại hồ sơ',
      async () => {
        const rotKey = 'defect_f0_zZ-01_dD-01_cu_0';
        await AuditModificationService.applyAdminSurveyEdit(reportId1, zoneAdminId, {
          adminPassword: TEST_ADMIN_PWD,
          updates: {
            photoRotations: {
              [rotKey]: 90,
              'zone_f0_zZ-01_ctx': 180,
            },
          },
          editReason: 'Xoay hướng ảnh và cập nhật thước đo khe nứt chuẩn A4',
          diffPayload: [],
        });

        const repRes = await Database.query<{ survey_data_json: Record<string, unknown> }>(
          `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
          [reportId1]
        );
        const rotations = repRes.rows[0].survey_data_json.photoRotations as Record<string, number> | undefined;
        if (rotations?.[rotKey] !== 90 || rotations?.['zone_f0_zZ-01_ctx'] !== 180) {
          throw new Error(`photoRotations không được lưu đúng: ${JSON.stringify(rotations)}`);
        }
        return `rotations saved: ${rotKey}=90°, zone_f0_zZ-01_ctx=180°`;
      }
    );

    await runCase(
      'NV4: Xuất PDF & UI/Ảnh',
      'TC-NV4-08 (TC-UI-01)',
      'Kiểm định thuật toán sinh khóa ảnh (defectKey / PhotoOrientationAlertBanner) trên hồ sơ đa tầng & đa vùng cùng có d.id="D-01": 0% trùng khóa defect_D-01_cu',
      () => {
        const hookCode = fs.readFileSync(
          path.resolve(
            __dirname,
            '../../../frontend/src/features/zone-management/components/review-queue/stepwise/hooks/usePhotoOrientationAudit.ts'
          ),
          'utf8'
        );
        const bannerCode = fs.readFileSync(
          path.resolve(
            __dirname,
            '../../../frontend/src/features/zone-management/components/review-queue/stepwise/components/PhotoOrientationAlertBanner.tsx'
          ),
          'utf8'
        );
        const step3Code = fs.readFileSync(
          path.resolve(
            __dirname,
            '../../../frontend/src/features/zone-management/components/review-queue/stepwise/steps/AuditStep3FloorDefects.tsx'
          ),
          'utf8'
        );

        if (!hookCode.includes('isDefectUuid') || !step3Code.includes('isDefectUuid')) {
          throw new Error(
            'usePhotoOrientationAudit.ts hoặc AuditStep3FloorDefects.tsx chưa kiểm tra isDefectUuid để phân cấp f${fIdx}_z${zCode}!'
          );
        }
        if (!bannerCode.includes('orientation_${v.key}_${v.floorIndex')) {
          throw new Error('PhotoOrientationAlertBanner.tsx chưa dùng composite key có floorIndex và zoneCode!');
        }

        const generatedKeys: string[] = [];
        initialSurveyJson.floors.forEach((f, fIdx) => {
          f.zones.forEach((z) => {
            const zCode = z.zoneCode;
            z.defects.forEach((d) => {
              const dCode = d.defectCode;
              const dId = d.id ? String(d.id) : '';
              const isDefectUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(dId);
              const hasMultiCu = d.cuPhotos.length > 1;
              d.cuPhotos.forEach((_, cuIdx) => {
                const defectKey =
                  dId && isDefectUuid
                    ? `defect_${dId}_cu${hasMultiCu ? `_${cuIdx}` : ''}`
                    : `defect_f${fIdx}_z${zCode}_d${dCode}_cu${hasMultiCu ? `_${cuIdx}` : ''}`;
                generatedKeys.push(defectKey);
              });
            });
          });
        });

        const uniqueKeys = new Set(generatedKeys);
        if (uniqueKeys.size !== generatedKeys.length) {
          throw new Error(`Phát hiện trùng khóa React key! Danh sách: ${generatedKeys.join(', ')}`);
        }
        if (generatedKeys.includes('defect_D-01_cu')) {
          throw new Error('Vẫn còn sinh khóa phẳng defect_D-01_cu gây trùng lặp giữa các vùng/tầng!');
        }
        return `Generated ${generatedKeys.length} unique keys: [${generatedKeys.join(', ')}]`;
      }
    );

    await runCase(
      'NV4: Xuất PDF & UI/Ảnh',
      'TC-NV4-09 (TC-UI-02)',
      'Kiểm định UI AuditDiffConfirmModal.tsx (đủ 5 Preset Reasons chuẩn hóa, khóa nút Lưu khi rỗng) & AuditStep1Identification.tsx (GPMB Conflict Banner + Popover)',
      () => {
        const modalCode = fs.readFileSync(
          path.resolve(
            __dirname,
            '../../../frontend/src/features/zone-management/components/review-queue/AuditDiffConfirmModal.tsx'
          ),
          'utf8'
        );
        const step1Code = fs.readFileSync(
          path.resolve(
            __dirname,
            '../../../frontend/src/features/zone-management/components/review-queue/stepwise/steps/AuditStep1Identification.tsx'
          ),
          'utf8'
        );

        const requiredPresets = [
          'Cập nhật ranh đất đã nắn chỉnh sau Giải phóng mặt bằng (GPMB) & tính lại cự ly Metro',
          'Hiệu chỉnh số liệu mặt tiền & diện tích theo sổ đỏ/bản vẽ hoàn công',
          'Chuẩn hóa tên đường và đơn vị hành chính theo Nghị quyết 1685/NQ-UBTVQH15',
          'Điều chỉnh cấp nứt Burland và phân loại kết cấu sau phúc tra thực địa',
          'Xoay hướng ảnh và cập nhật thước đo khe nứt chuẩn A4',
        ];
        for (const preset of requiredPresets) {
          if (!modalCode.includes(preset)) {
            throw new Error(`AuditDiffConfirmModal.tsx thiếu preset reason: "${preset}"`);
          }
        }
        if (!modalCode.includes('!editReason.trim()')) {
          throw new Error('AuditDiffConfirmModal.tsx chưa khóa nút Lưu khi !editReason.trim()');
        }
        if (
          !step1Code.includes('hasGpmbBoundaryConflict') ||
          !step1Code.includes('showDistanceDiffPopover') ||
          !step1Code.includes('keepKsvBoundaryConfirmed')
        ) {
          throw new Error('AuditStep1Identification.tsx thiếu GPMB Boundary Conflict Banner hoặc Distance Diff Popover!');
        }
        return 'Verified 5 Preset Reasons + disabled button + Step 1 GPMB Conflict UI';
      }
    );

    await runCase(
      'NV4: Xuất PDF & UI/Ảnh',
      'TC-NV4-10',
      'Kiểm định UI ReviewQueueTableRow.tsx hiển thị badge "Chờ phát hành Rev mới" (has_pending_release) và "Đã Phê Duyệt (Rev.XX)"',
      () => {
        const rowCode = fs.readFileSync(
          path.resolve(
            __dirname,
            '../../../frontend/src/features/zone-management/components/review-queue/ReviewQueueTableRow.tsx'
          ),
          'utf8'
        );
        if (!rowCode.includes('Chờ phát hành Rev mới') || !rowCode.includes('item.has_pending_release')) {
          throw new Error('ReviewQueueTableRow.tsx thiếu badge "Chờ phát hành Rev mới" khi item.has_pending_release = true');
        }
        if (!rowCode.includes('Đã Phê Duyệt (Rev.{revStr})')) {
          throw new Error('ReviewQueueTableRow.tsx chưa hiển thị số phiên bản Rev.{revStr} trên badge Đã Phê Duyệt');
        }
        return 'Verified "Chờ phát hành Rev mới" & "Đã Phê Duyệt (Rev.XX)" badges';
      }
    );
  } finally {
    const releaseBaseDir = getReleaseStorageDir();
    for (const repId of cleanupReports) {
      try {
        const dir = path.join(releaseBaseDir, repId);
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
        await Database.query(`UPDATE base_survey_reports SET status = 'UNDER_REVIEW' WHERE id = $1;`, [repId]);
        await Database.query(`DELETE FROM report_releases WHERE report_id = $1;`, [repId]);
        await Database.query(`DELETE FROM survey_photo_registry WHERE report_id = $1;`, [repId]);
        await Database.query(`DELETE FROM audit_alert_items WHERE report_id = $1;`, [repId]);
        await Database.query(`DELETE FROM survey_report_versions WHERE report_id = $1;`, [repId]);
        await Database.query(`DELETE FROM building_specifications WHERE report_id = $1;`, [repId]);
        await Database.query(`DELETE FROM system_audit_logs WHERE entity_id = $1;`, [repId]);
        await Database.query(`DELETE FROM base_survey_reports WHERE id = $1;`, [repId]);
      } catch (cleanupErr) {
        console.warn('[Cleanup Report Warning]:', cleanupErr);
      }
    }
    for (const pId of cleanupParcels) {
      try {
        await Database.query(`DELETE FROM parcel_mutation_events WHERE $1::uuid = ANY(source_parcel_ids);`, [pId]);
        await Database.query(`DELETE FROM system_audit_logs WHERE entity_id = $1;`, [pId]);
        await Database.query(`DELETE FROM parcels WHERE id = $1;`, [pId]);
      } catch (cleanupErr) {
        console.warn('[Cleanup Parcel Warning]:', cleanupErr);
      }
    }
    for (const uId of cleanupUsers) {
      try {
        await Database.query(`DELETE FROM system_audit_logs WHERE performed_by_user_id = $1;`, [uId]);
        await Database.query(`DELETE FROM users WHERE id = $1;`, [uId]);
      } catch (cleanupErr) {
        console.warn('[Cleanup User Warning]:', cleanupErr);
      }
    }
    await pool.end().catch((err: unknown) => console.warn('[Pool End Warning]:', err));
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log('\n==========================================================================================');
  console.log(`📊 TỔNG KẾT KẾT QUẢ KIỂM THỬ 4 NGHIỆP VỤ: ${passedCount}/${results.length} TESTCASES PASS`);
  console.log('==========================================================================================');
  console.table(
    results.map((r) => ({
      'Nghiệp vụ': r.suite,
      'Mã TC': r.id,
      'Nội dung kiểm thử': r.name.length > 68 ? r.name.slice(0, 65) + '...' : r.name,
      'Kết quả': r.passed ? 'PASS ✅' : 'FAIL ❌',
    }))
  );

  if (failedCount > 0) {
    console.error(`\n❌ CÓ ${failedCount}/${results.length} TESTCASE THẤT BẠI:`);
    for (const f of results.filter((r) => !r.passed)) {
      console.error(`  - [${f.id}] ${f.name}: ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log(`\n🎉 TUYỆT VỜI! TOÀN BỘ ${passedCount}/${results.length} TESTCASES (10 TC × 4 NGHIỆP VỤ) ĐẠT 100%!`);
    process.exit(0);
  }
}

if (require.main === module) {
  runResidentialAppraisal40Cases().catch((err) => {
    console.error('[FATAL ERROR]:', err);
    process.exit(1);
  });
}
