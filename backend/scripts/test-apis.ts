import request from 'supertest';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { config } from '../src/config';
import { CryptoUtils } from '../src/common/utils/crypto.utils';
import { Database } from '../src/database/db';

interface TestResult {
  group: string;
  testId: string;
  name: string;
  method: string;
  url: string;
  role: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  latencyMs: number;
  responsePreview?: any;
  errorDetail?: any;
}

async function runApiTestSuite() {
  console.log('================================================================');
  console.log('🚆 METRO 2 SURVEY PLATFORM - COMPREHENSIVE 60-API TEST RUNNER');
  console.log('================================================================');
  console.log(`[INIT] Initializing In-Memory DB Mocks & Security Test Engine...`);

  // Override crypto compare for fast testing
  CryptoUtils.comparePassword = async () => true;

  // Setup Comprehensive Database Mock Handler so test can run standalone without Postgres dependency
  Database.query = async (text: string, params?: any[]) => {
    // Health check
    if (text.includes('PostGIS_Version()')) {
      return { rows: [{ postgis_version: '3.4.2', now: new Date() }], rowCount: 1 } as any;
    }

    // Auth & Users
    if (text.includes('SELECT * FROM users WHERE username = $1')) {
      if (params && (params[0].startsWith('surveyor_new_') || params[0] === 'hack_user')) {
        return { rows: [], rowCount: 0 } as any;
      }
      return {
        rows: [
          {
            id: 'b0000000-0000-0000-0000-000000000003',
            username: 'surveyor_s9_01',
            password_hash: 'mock_hash',
            full_name: 'Nguyễn Văn Khảo Sát',
            role: 'SURVEYOR',
            status: 'ACTIVE',
            assigned_zone_id: 'ZONE_S9',
          },
        ],
        rowCount: 1,
      } as any;
    }

    if (text.includes('SELECT * FROM users WHERE id = $1')) {
      return {
        rows: [
          {
            id: 'b0000000-0000-0000-0000-000000000003',
            username: 'surveyor_s9_01',
            password_hash: 'mock_hash',
            full_name: 'Nguyễn Văn Khảo Sát',
            role: 'SURVEYOR',
            status: 'ACTIVE',
            assigned_zone_id: 'ZONE_S9',
          },
        ],
        rowCount: 1,
      } as any;
    }

    if (text.includes('SELECT id, username, email, full_name, role, assigned_zone_id, status FROM users')) {
      return {
        rows: [
          {
            id: 'b0000000-0000-0000-0000-000000000001',
            username: 'superadmin',
            full_name: 'Nguyễn Văn Tổng (MAUR)',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
          },
          {
            id: 'b0000000-0000-0000-0000-000000000003',
            username: 'surveyor_s9_01',
            full_name: 'Nguyễn Văn Khảo Sát',
            role: 'SURVEYOR',
            status: 'ACTIVE',
            assigned_zone_id: 'ZONE_S9',
          },
        ],
        rowCount: 2,
      } as any;
    }

    if (text.includes('INSERT INTO users')) {
      return {
        rows: [
          {
            id: 'b0000000-0000-0000-0000-000000000099',
            username: params?.[0] || 'new_surveyor',
            full_name: params?.[2] || 'New Surveyor',
            role: params?.[3] || 'SURVEYOR',
            assigned_zone_id: params?.[4] || 'ZONE_S9',
            status: 'ACTIVE',
          },
        ],
        rowCount: 1,
      } as any;
    }

    if (text.includes('UPDATE users')) {
      return {
        rows: [
          {
            id: params?.[params.length - 1] || 'b0000000-0000-0000-0000-000000000003',
            username: 'surveyor_s9_01',
            full_name: 'Nguyễn Văn Khảo Sát (Cập nhật)',
            status: 'ACTIVE',
          },
        ],
        rowCount: 1,
      } as any;
    }

    if (text.includes('FROM user_sessions WHERE refresh_token_hash = $1')) {
      return { rows: [{ is_revoked: false, expires_at: new Date(Date.now() + 86400000) }], rowCount: 1 } as any;
    }

    // Attendance
    if (text.includes('ST_Distance') && text.includes('metro_zones')) {
      return { rows: [{ zone_code: 'ZONE_S9', zone_name: 'Ga S9 - Bà Quẹo', distance_meters: 35.5 }], rowCount: 1 } as any;
    }

    if (text.includes('INSERT INTO surveyor_attendance')) {
      return {
        rows: [
          {
            id: 'att-001',
            surveyor_id: 'b0000000-0000-0000-0000-000000000003',
            zone_id: 'ZONE_S9',
            checkin_time: new Date(),
            distance_to_zone_center_meters: 35.5,
            is_within_zone_boundary: true,
          },
        ],
        rowCount: 1,
      } as any;
    }

    if (text.includes('FROM surveyor_attendance')) {
      return {
        rows: [
          {
            id: 'att-001',
            surveyor_id: 'b0000000-0000-0000-0000-000000000003',
            zone_id: 'ZONE_S9',
            checkin_time: new Date(),
            distance_to_zone_center_meters: 35.5,
            is_within_zone_boundary: true,
            is_verified: true,
          },
        ],
        rowCount: 1,
      } as any;
    }

    // Parcels & Cadastral
    if (text.includes('FROM parcels p') || text.includes('SELECT project_parcel_code') || text.includes('FROM parcels WHERE id = $1')) {
      return {
        rows: [
          {
            id: 'a0000000-0000-0000-0000-000000000001',
            project_parcel_code: 'P-S9-001',
            cadastral_parcel_number: '124',
            cadastral_sheet_number: '15',
            house_number: '124',
            street: 'Cách Mạng Tháng 8',
            ward: 'Phường 11',
            district: 'Quận Tân Bình',
            owner_name: 'Nguyễn Văn Chủ Hộ',
            owner_phone: '0912345678',
            survey_status: 'NOT_SURVEYED',
            building_type: 'CONDOMINIUM',
            floor_count: 3,
            land_area_m2: 120.5,
            construction_area_m2: 95.0,
            active_phase1_report_id: 'a0000000-0000-0000-0000-000000000001',
            active_phase2_report_id: null,
            bra_risk_rating: 'BRA_B',
            ecs_score: 12,
            distance_to_metro_line_meters: 18.5,
            footprint_polygon_geojson: { type: 'Polygon', coordinates: [[[106.65, 10.79], [106.66, 10.79], [106.66, 10.80], [106.65, 10.79]]] },
          },
        ],
        rowCount: 1,
      } as any;
    }

    if (text.includes('FROM building_units WHERE parcel_id = $1')) {
      return {
        rows: [
          {
            id: 'd0000000-0000-0000-0000-000000000001',
            parcel_id: 'a0000000-0000-0000-0000-000000000001',
            unit_code: 'P.401',
            floor_number: 4,
            owner_name: 'Lê Văn A',
            survey_status: 'COMPLETED',
          },
        ],
        rowCount: 1,
      } as any;
    }

    if (text.includes('INSERT INTO building_units')) {
      return {
        rows: [
          {
            id: 'd0000000-0000-0000-0000-000000000002',
            parcel_id: params?.[0],
            unit_code: params?.[1] || 'P.402',
            floor_number: params?.[2] || 4,
            owner_name: params?.[3] || 'Vũ Quốc Đạt',
            survey_status: 'NOT_SURVEYED',
          },
        ],
        rowCount: 1,
      } as any;
    }

    // Reports Phase 1 & 2
    if (text.includes('INSERT INTO base_survey_reports')) {
      return {
        rows: [
          {
            id: 'a0000000-0000-0000-0000-000000000001',
            report_code: 'REPORT-P-S9-001-PHASE1',
            parcel_id: 'a0000000-0000-0000-0000-000000000001',
            surveyor_id: 'b0000000-0000-0000-0000-000000000003',
            phase: 'PHASE_1',
            status: 'DRAFT',
            current_step: 1,
          },
        ],
        rowCount: 1,
      } as any;
    }

    if (text.includes('FROM base_survey_reports')) {
      return {
        rows: [
          {
            id: 'a0000000-0000-0000-0000-000000000001',
            report_code: 'REPORT-P-S9-001-PHASE1',
            parcel_id: 'a0000000-0000-0000-0000-000000000001',
            surveyor_id: 'b0000000-0000-0000-0000-000000000003',
            phase: 'PHASE_1',
            status: 'DRAFT',
            current_step: 1,
            project_parcel_code: 'P-S9-001',
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      } as any;
    }

    if (text.includes('INSERT INTO damage_zones')) {
      return {
        rows: [
          {
            id: 'c0000000-0000-0000-0000-000000000001',
            report_id: 'a0000000-0000-0000-0000-000000000001',
            zone_code: 'Z-01',
            floor_name: 'Tầng 1',
            room_name: 'Phòng khách',
            component_type: 'WALL',
          },
        ],
        rowCount: 1,
      } as any;
    }

    if (text.includes('INSERT INTO defect_items')) {
      return {
        rows: [
          {
            id: 'e0000000-0000-0000-0000-000000000001',
            zone_id: 'c0000000-0000-0000-0000-000000000001',
            defect_code: 'D-01',
            width_max_mm: 1.5,
            length_mm: 1200,
          },
        ],
        rowCount: 1,
      } as any;
    }

    if (text.includes('FROM damage_zones z') || text.includes('FROM defect_items')) {
      return {
        rows: [
          {
            id: 'c0000000-0000-0000-0000-000000000001',
            zone_code: 'Z-01',
            floor_name: 'Tầng 1',
            room_name: 'Phòng khách',
            defects: [
              {
                id: 'e0000000-0000-0000-0000-000000000001',
                defect_code: 'D-01',
                width_max_mm: 1.5,
                length_mm: 1200,
              },
            ],
          },
        ],
        rowCount: 1,
      } as any;
    }

    // Admin & Batches
    if (text.includes('FROM compiled_report_batches')) {
      return {
        rows: [
          {
            id: 'f0000000-0000-0000-0000-000000000001',
            batch_code: 'BATCH-2026-S9-01',
            zone_id: 'ZONE_S9',
            status: 'COMPLETED',
            total_reports_compiled: 45,
            file_size_bytes: 52428800,
            sha256_checksum: 'a9f23b...',
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      } as any;
    }

    if (text.includes('FROM audit_flags') || text.includes('audit_flags')) {
      return {
        rows: [
          {
            id: 'flag-001',
            report_id: 'a0000000-0000-0000-0000-000000000001',
            flag_code: 'SPEED_ANOMALY',
            severity: 'MEDIUM',
            details: 'Thời gian hoàn thành khảo sát 2.8 phút',
          },
        ],
        rowCount: 1,
      } as any;
    }

    // Generic default for updates/deletes/inserts
    return { rows: [{ id: 'mock-id-ok', status: 'OK' }], rowCount: 1 } as any;
  };

  Database.transaction = async (cb: any) => {
    return cb({
      query: Database.query,
    });
  };

  const app = createApp();

  // Create Mock JWT Tokens
  const superAdminToken = jwt.sign(
    {
      userId: 'b0000000-0000-0000-0000-000000000001',
      username: 'superadmin',
      role: 'SUPER_ADMIN',
      fullName: 'Nguyễn Văn Tổng (MAUR)',
    },
    config.jwt.secret,
    { expiresIn: '2h' }
  );

  const zoneAdminToken = jwt.sign(
    {
      userId: 'b0000000-0000-0000-0000-000000000002',
      username: 'zoneadmin_s9',
      role: 'ZONE_ADMIN',
      assignedZoneId: 'ZONE_S9',
      fullName: 'Trần Văn Tổ Trưởng (Ga S9)',
    },
    config.jwt.secret,
    { expiresIn: '2h' }
  );

  const surveyorToken = jwt.sign(
    {
      userId: 'b0000000-0000-0000-0000-000000000003',
      username: 'surveyor_s9_01',
      role: 'SURVEYOR',
      assignedZoneId: 'ZONE_S9',
      fullName: 'Nguyễn Văn Khảo Sát',
    },
    config.jwt.secret,
    { expiresIn: '2h' }
  );

  const contractorToken = jwt.sign(
    {
      userId: 'b0000000-0000-0000-0000-000000000004',
      username: 'contractor_guest',
      role: 'CONTRACTOR',
      fullName: 'Nhà Thầu Thi Công TBM',
    },
    config.jwt.secret,
    { expiresIn: '2h' }
  );

  const validRefreshToken = jwt.sign(
    { userId: 'b0000000-0000-0000-0000-000000000003', tokenVersion: 1 },
    config.jwt.refreshSecret,
    { expiresIn: '7d' }
  );

  const getToken = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return superAdminToken;
      case 'ZONE_ADMIN': return zoneAdminToken;
      case 'SURVEYOR': return surveyorToken;
      case 'CONTRACTOR': return contractorToken;
      default: return '';
    }
  };

  const results: TestResult[] = [];
  const startTime = Date.now();

  async function executeTest(
    group: string,
    testId: string,
    name: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    role: 'PUBLIC' | 'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR',
    expectedStatus: number,
    payload?: any
  ) {
    const startReq = Date.now();
    let reqInstance: any;

    if (method === 'GET') reqInstance = request(app).get(url);
    else if (method === 'POST') reqInstance = request(app).post(url).send(payload);
    else if (method === 'PUT') reqInstance = request(app).put(url).send(payload);
    else if (method === 'PATCH') reqInstance = request(app).patch(url).send(payload);
    else if (method === 'DELETE') reqInstance = request(app).delete(url);

    if (role !== 'PUBLIC') {
      reqInstance.set('Authorization', `Bearer ${getToken(role)}`);
    }

    try {
      const response = await reqInstance;
      const latencyMs = Date.now() - startReq;
      const passed = response.status === expectedStatus;

      const result: TestResult = {
        group,
        testId,
        name,
        method,
        url,
        role,
        expectedStatus,
        actualStatus: response.status,
        passed,
        latencyMs,
        responsePreview: response.body?.data || response.body?.status || (response.body ? Object.keys(response.body) : null),
        errorDetail: passed ? undefined : response.body,
      };

      results.push(result);

      const symbol = passed ? '✅ PASS' : '❌ FAIL';
      const statusText = passed
        ? `\x1b[32m${response.status}\x1b[0m`
        : `\x1b[31m${response.status} (Exp: ${expectedStatus})\x1b[0m`;

      console.log(
        `[${testId.padEnd(5)}] ${symbol} | ${method.padEnd(6)} ${url.padEnd(58)} | Status: ${statusText} | ${latencyMs}ms`
      );
    } catch (err: any) {
      const latencyMs = Date.now() - startReq;
      results.push({
        group,
        testId,
        name,
        method,
        url,
        role,
        expectedStatus,
        actualStatus: 500,
        passed: false,
        latencyMs,
        errorDetail: err.message,
      });
      console.log(`[${testId.padEnd(5)}] ❌ ERR  | ${method.padEnd(6)} ${url} | ${err.message}`);
    }
  }

  console.log('\n--- 0. PUBLIC & AUTHENTICATION MODULE ---');
  await executeTest('Auth', '0.0', 'Health Check', 'GET', '/health', 'PUBLIC', 200);
  await executeTest('Auth', '0.1', 'User Login', 'POST', '/api/v1/auth/login', 'PUBLIC', 200, {
    username: 'surveyor_s9_01',
    password: 'Password@123',
  });
  await executeTest('Auth', '0.2', 'Refresh Token', 'POST', '/api/v1/auth/refresh-token', 'PUBLIC', 200, {
    refreshToken: validRefreshToken,
  });
  await executeTest('Auth', '0.3', 'Get Profile (Me)', 'GET', '/api/v1/auth/me', 'SURVEYOR', 200);
  await executeTest('Auth', '0.4', 'User Logout', 'POST', '/api/v1/auth/logout', 'SURVEYOR', 200);

  console.log('\n--- 1. FIELD SURVEYOR & GIS MODULE ---');
  await executeTest('Surveyor', '1.1', 'GPS Check-In', 'POST', '/api/v1/attendance/check-in', 'SURVEYOR', 201, {
    zoneId: 'ZONE_S9',
    gpsLatitude: 10.7932,
    gpsLongitude: 106.6541,
    gpsAccuracyMeters: 4.5,
    selfiePhotoUrl: 'https://storage.metro2.gov.vn/attendance/selfie-01.jpg',
  });
  await executeTest('Surveyor', '1.2', 'Attendance History', 'GET', '/api/v1/attendance/my-history', 'SURVEYOR', 200);
  await executeTest('Surveyor', '1.3', 'GIS Zone Map', 'GET', '/api/v1/parcels/zone-map?zoneId=ZONE_S9', 'SURVEYOR', 200);
  await executeTest('Surveyor', '1.4', 'Nearby Parcels GPS Scan', 'GET', '/api/v1/parcels/nearby?lat=10.7932&lng=106.6541&radiusMeters=100', 'SURVEYOR', 200);
  await executeTest('Surveyor', '1.5', 'High-Range Project Codes', 'GET', '/api/v1/parcels/next-high-range-codes?count=4', 'SURVEYOR', 200);
  await executeTest('Surveyor', '1.6', 'Parcel Detail by ID', 'GET', '/api/v1/parcels/a0000000-0000-0000-0000-000000000001', 'SURVEYOR', 200);
  await executeTest('Surveyor', '1.7', 'List Condominium Units', 'GET', '/api/v1/parcels/a0000000-0000-0000-0000-000000000001/units', 'SURVEYOR', 200);
  await executeTest('Surveyor', '1.8', 'Create Condominium Unit', 'POST', '/api/v1/parcels/a0000000-0000-0000-0000-000000000001/units', 'SURVEYOR', 201, {
    unitCode: 'P.402',
    floorNumber: 4,
    ownerName: 'Vũ Quốc Đạt',
    ownerPhone: '0901234567',
  });
  await executeTest('Surveyor', '1.9', 'Update Building Type', 'PATCH', '/api/v1/parcels/a0000000-0000-0000-0000-000000000001/building-type', 'SURVEYOR', 200, {
    buildingType: 'CONDOMINIUM',
  });
  await executeTest('Surveyor', '1.10', 'Start Ad-hoc Survey', 'POST', '/api/v1/parcels/a0000000-0000-0000-0000-000000000001/start-survey', 'SURVEYOR', 201, {
    phase: 'PHASE_1',
    claimReason: 'Khảo sát bổ sung ranh giới',
  });
  await executeTest('Surveyor', '1.11', 'Record Absentee Homeowner', 'POST', '/api/v1/parcels/a0000000-0000-0000-0000-000000000001/record-absence', 'SURVEYOR', 201, {
    absenceReason: 'HOMEOWNER_ABSENT',
    notes: 'Đã gọi điện 3 lần không liên lạc được, cửa ngoài khoá',
    photoProofUrl: 'https://storage.metro2.gov.vn/photos/absent-proof.jpg',
  });
  await executeTest('Surveyor', '1.12', 'Update Footprint Geometry', 'PUT', '/api/v1/parcels/a0000000-0000-0000-0000-000000000001/footprint', 'SURVEYOR', 200, {
    footprintPolygonGeoJson: { type: 'Polygon', coordinates: [[[106.65, 10.79], [106.66, 10.79], [106.66, 10.80], [106.65, 10.79]]] },
    measuredConstructionAreaM2: 120.5,
  });
  await executeTest('Surveyor', '1.13', 'Propose Cadastral Mutation', 'POST', '/api/v1/mutations/propose', 'SURVEYOR', 201, {
    mutationType: 'SPLIT',
    sourceParcelIds: ['a0000000-0000-0000-0000-000000000001'],
    surveyorNotes: 'Thực tế chia làm 2 căn hộ riêng biệt',
    childParcels: [
      { houseNumber: '124A', landAreaM2: 60, floorCount: 2, polygonGeoJson: {} },
      { houseNumber: '124B', landAreaM2: 60.5, floorCount: 2, polygonGeoJson: {} },
    ],
  });
  await executeTest('Surveyor', '1.14', 'Create Phase 1 Report', 'POST', '/api/v1/reports/phase1', 'SURVEYOR', 201, {
    parcelId: 'a0000000-0000-0000-0000-000000000001',
    reportType: 'STANDALONE',
  });
  await executeTest('Surveyor', '1.15', 'Get Report Details', 'GET', '/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001', 'SURVEYOR', 200);
  await executeTest('Surveyor', '1.16', 'Save Identification Photos (P01-P04)', 'POST', '/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/identification-photos', 'SURVEYOR', 201, {
    p01HouseNumberUrl: 'https://storage.metro2.gov.vn/photos/p01.jpg',
    p02MainFacadeUrl: 'https://storage.metro2.gov.vn/photos/p02.jpg',
    p03SideRearUrl: 'https://storage.metro2.gov.vn/photos/p03.jpg',
    p04ContextStreetUrl: 'https://storage.metro2.gov.vn/photos/p04.jpg',
  });
  await executeTest('Surveyor', '1.17', 'Save Building Specs & CAT 1-5', 'PUT', '/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/specs', 'SURVEYOR', 200, {
    buildingName: 'Nhà phố 3 tầng',
    buildingGrade: 'GENERAL',
    structuralSystem: 'KHUNG_BTCT_CHIU_LUC',
    floorCount: 3,
    foundationCategory: 'CAT_2_MONG_DON_BTCT',
  });
  await executeTest('Surveyor', '1.18', 'Save Floors Survey', 'PUT', '/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/floors', 'SURVEYOR', 200, {
    floors: [{ floorName: 'Tầng 1', rooms: ['Phòng khách', 'Bếp'] }],
  });
  await executeTest('Surveyor', '1.19', 'Create Damage Zone (Z-xx)', 'POST', '/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/zones', 'SURVEYOR', 201, {
    zoneCode: 'Z-01',
    floorName: 'Tầng 1',
    roomName: 'Phòng khách',
    componentType: 'WALL',
    ctxPhotoUrl: 'https://storage.metro2.gov.vn/photos/ctx-01.jpg',
  });
  await executeTest('Surveyor', '1.20', 'Pin Defect Item (D-xx)', 'POST', '/api/v1/reports/phase1/zones/c0000000-0000-0000-0000-000000000001/defects', 'SURVEYOR', 201, {
    defectCode: 'D-01',
    pinX: 45.2,
    pinY: 60.1,
    screeningCategory: 'VET_NUT',
    defectType: 'Nứt chéo tường',
    widthMaxMm: 1.5,
    lengthMm: 1200,
    cuPhotoUrl: 'https://storage.metro2.gov.vn/photos/cu-01.jpg',
  });
  await executeTest('Surveyor', '1.21', 'Save Deformation Measurements', 'PUT', '/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/deformation', 'SURVEYOR', 200, {
    tiltAngleX: 0.12,
    tiltAngleY: 0.05,
    floorSlopeRatio: 0.002,
    beamDeflectionMm: 2.1,
    measurementReliability: 'HIGH',
  });
  await executeTest('Surveyor', '1.22', 'Auto-Calculate Scores (ECS & VI)', 'POST', '/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/calculate-scores', 'SURVEYOR', 200);
  await executeTest('Surveyor', '1.23', 'Submit Phase 1 Report', 'POST', '/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/submit', 'SURVEYOR', 200, {
    ownerRemarks: 'Chủ hộ xác nhận hiện trạng ban đầu chính xác',
    surveyorSignatureUrl: 'https://storage.metro2.gov.vn/signatures/sig-surveyor.png',
  });
  await executeTest('Surveyor', '1.24', 'Full Package Submit (Offline-First)', 'POST', '/api/v1/surveys/phase1/submit', 'SURVEYOR', 200, {
    parcelId: 'a0000000-0000-0000-0000-000000000001',
    surveyData: {
      step1Photos: { p01HouseNumberUrl: 'https://storage.metro2.gov.vn/photos/p01.jpg' },
      specs: { buildingName: 'Nhà mẫu full bundle', floorCount: 2 },
    },
  });
  await executeTest('Surveyor', '1.25', 'Submit Absentee (Direct Alias)', 'POST', '/api/v1/surveys/phase1/submit-absentee', 'SURVEYOR', 201, {
    absenceReason: 'LOCKED_GATE',
    notes: 'Cửa cổng khoá chặt không có người',
  });
  await executeTest('Surveyor', '1.26', 'Create Phase 2 Report', 'POST', '/api/v1/reports/phase2', 'SURVEYOR', 201, {
    parcelId: 'a0000000-0000-0000-0000-000000000001',
    phase1ReportId: 'a0000000-0000-0000-0000-000000000001',
    surveyLevel: 'L2_B',
  });
  await executeTest('Surveyor', '1.27', 'Get Phase 2 Zones by Room', 'GET', '/api/v1/parcels/a0000000-0000-0000-0000-000000000001/phase2/zones', 'SURVEYOR', 200);
  await executeTest('Surveyor', '1.28', 'Verify Phase 2 Defect', 'PUT', '/api/v1/phase2/defects/e0000000-0000-0000-0000-000000000001/verify', 'SURVEYOR', 200, {
    phase2WidthMm: 2.1,
    phase2LengthMm: 1400,
    evolutionStatus: 'WIDENED',
  });
  await executeTest('Surveyor', '1.29', 'Check Quality Gate (10 Criteria)', 'GET', '/api/v1/reports/phase2/a0000000-0000-0000-0000-000000000002/quality-gate', 'SURVEYOR', 200);
  await executeTest('Surveyor', '1.30', 'Submit Phase 2 Report', 'POST', '/api/v1/reports/phase2/a0000000-0000-0000-0000-000000000002/submit', 'SURVEYOR', 200, {
    ownerRemarks: 'Vết nứt mở rộng 0.6mm do máy đào',
  });

  console.log('\n--- 2. ZONE ADMIN & REVIEW MODULE ---');
  await executeTest('Admin', '2.1', 'Zone Progress Analytics', 'GET', '/api/v1/admin/analytics/progress', 'ZONE_ADMIN', 200);
  await executeTest('Admin', '2.2', 'List Surveyor Attendance', 'GET', '/api/v1/admin/attendance', 'ZONE_ADMIN', 200);
  await executeTest('Admin', '2.3', 'Attendance Monthly Summary', 'GET', '/api/v1/admin/attendance/summary', 'ZONE_ADMIN', 200);
  await executeTest('Admin', '2.4', 'Attendance Detail by ID', 'GET', '/api/v1/admin/attendance/att-001', 'ZONE_ADMIN', 200);
  await executeTest('Admin', '2.5', 'Verify Surveyor Attendance', 'POST', '/api/v1/admin/attendance/att-001/verify', 'ZONE_ADMIN', 200, {
    action: 'APPROVE',
  });
  await executeTest('Admin', '2.6', 'List Automated Audit Alerts', 'GET', '/api/v1/admin/reports/audit-alerts', 'ZONE_ADMIN', 200);
  await executeTest('Admin', '2.7', 'Get Audit Flags for Report', 'GET', '/api/v1/admin/reports/a0000000-0000-0000-0000-000000000001/audit-flags', 'ZONE_ADMIN', 200);
  await executeTest('Admin', '2.8', 'Split-Pane Audit View (400% Zoom)', 'GET', '/api/v1/admin/reports/a0000000-0000-0000-0000-000000000001/audit-view', 'ZONE_ADMIN', 200);
  await executeTest('Admin', '2.9', 'Approve Report & Generate PDF', 'POST', '/api/v1/admin/reports/a0000000-0000-0000-0000-000000000001/approve', 'ZONE_ADMIN', 200);
  await executeTest('Admin', '2.10', 'Reject Report with Technical Reason', 'POST', '/api/v1/admin/reports/a0000000-0000-0000-0000-000000000001/reject', 'ZONE_ADMIN', 200, {
    rejectionReason: 'Ảnh P02 bị mờ không nhìn rõ biển số nhà',
  });
  await executeTest('Admin', '2.11', 'Approve Cadastral Mutation', 'POST', '/api/v1/admin/mutations/mut-001/approve', 'ZONE_ADMIN', 200, {
    action: 'APPROVE',
  });
  await executeTest('Admin', '2.12', 'Apply Engineering Judgement', 'POST', '/api/v1/admin/reports/a0000000-0000-0000-0000-000000000001/engineering-judgement', 'ZONE_ADMIN', 200, {
    action: 'UPGRADE',
    reason: 'Công trình nằm ngay trên hố đào ga sâu 30m',
  });
  await executeTest('Admin', '2.13', 'Trigger Batch Export', 'POST', '/api/v1/reports/batch-export', 'ZONE_ADMIN', 202, {
    zoneId: 'ZONE_S9',
  });
  await executeTest('Admin', '2.14', 'Get Batch Export Status', 'GET', '/api/v1/reports/batch-export/f0000000-0000-0000-0000-000000000001/status', 'ZONE_ADMIN', 200);

  console.log('\n--- 3. SUPER ADMIN USER LIFECYCLE & GUEST MODULE ---');
  await executeTest('SuperAdmin', '3.1', 'List Users Across Stations', 'GET', '/api/v1/admin/users', 'SUPER_ADMIN', 200);
  await executeTest('SuperAdmin', '3.2', 'Get User Detail by ID', 'GET', '/api/v1/admin/users/b0000000-0000-0000-0000-000000000003', 'SUPER_ADMIN', 200);
  await executeTest('SuperAdmin', '3.3', 'Create New Surveyor Account', 'POST', '/api/v1/admin/users', 'SUPER_ADMIN', 201, {
    username: `surveyor_new_${Date.now().toString().slice(-4)}`,
    password: 'Password@123',
    fullName: 'Lê Văn Khảo Sát Mới',
    role: 'SURVEYOR',
    assignedZoneId: 'ZONE_S9',
  });
  await executeTest('SuperAdmin', '3.4', 'Update User & Station Assignment', 'PUT', '/api/v1/admin/users/b0000000-0000-0000-0000-000000000003', 'SUPER_ADMIN', 200, {
    fullName: 'Nguyễn Văn Khảo Sát (Cập nhật)',
    assignedZoneId: 'ZONE_S9',
  });
  await executeTest('SuperAdmin', '3.5', 'Update User Active/Lock Status', 'PUT', '/api/v1/admin/users/b0000000-0000-0000-0000-000000000003/status', 'SUPER_ADMIN', 200, {
    status: 'ACTIVE',
  });
  await executeTest('SuperAdmin', '3.6', 'Reset User Password', 'POST', '/api/v1/admin/users/b0000000-0000-0000-0000-000000000003/reset-password', 'SUPER_ADMIN', 200, {
    newPassword: 'NewPassword@123',
  });
  await executeTest('SuperAdmin', '3.7', 'Soft Delete User', 'DELETE', '/api/v1/admin/users/b0000000-0000-0000-0000-000000000003', 'SUPER_ADMIN', 200);
  await executeTest('SuperAdmin', '3.8', 'Global 11-Station Batch Export', 'POST', '/api/v1/admin/reports/batch-export', 'SUPER_ADMIN', 202, {
    allStations: true,
  });
  await executeTest('SuperAdmin', '3.9', 'List Global Export Batches', 'GET', '/api/v1/admin/reports/exports', 'SUPER_ADMIN', 200);
  await executeTest('SuperAdmin', '3.10', 'Revoke/Purge Export Batch', 'DELETE', '/api/v1/admin/reports/exports/f0000000-0000-0000-0000-000000000001', 'SUPER_ADMIN', 200);
  await executeTest('Guest', '4.1', 'Guest Read-Only GIS Map', 'GET', '/api/v1/guest/gis-map', 'PUBLIC', 200);
  await executeTest('Guest', '4.2', 'Guest Parcel Summary (No PII)', 'GET', '/api/v1/guest/parcels/a0000000-0000-0000-0000-000000000001/summary', 'PUBLIC', 200);

  console.log('\n--- 4. SECURITY & RBAC PERMISSION GATE CHECKS ---');
  await executeTest('Security', '5.1', 'Surveyor Forbidden from User Admin', 'GET', '/api/v1/admin/users', 'SURVEYOR', 403);
  await executeTest('Security', '5.2', 'Zone Admin Forbidden from User Creation', 'POST', '/api/v1/admin/users', 'ZONE_ADMIN', 403, {
    username: 'hack_user',
    password: 'Password@123',
    role: 'SUPER_ADMIN',
  });
  await executeTest('Security', '5.3', 'Contractor Forbidden from Submitting Reports', 'POST', '/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/submit', 'CONTRACTOR', 403);
  await executeTest('Security', '5.4', 'Unauthenticated Request Rejected', 'GET', '/api/v1/parcels/zone-map', 'PUBLIC', 401);

  const totalDuration = Date.now() - startTime;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const totalCount = results.length;

  console.log('\n================================================================');
  console.log('📊 TEST EXECUTION SUMMARY');
  console.log('================================================================');
  console.log(`Total Endpoints Tested: ${totalCount}`);
  console.log(`Passed: \x1b[32m${passedCount}\x1b[0m / ${totalCount} (${((passedCount / totalCount) * 100).toFixed(1)}%)`);
  console.log(`Failed: \x1b[${failedCount > 0 ? '31' : '32'}m${failedCount}\x1b[0m / ${totalCount}`);
  console.log(`Total Elapsed Time: ${totalDuration}ms (Avg: ${(totalDuration / totalCount).toFixed(1)}ms/endpoint)`);

  // Ensure reports directory exists
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Write full results to JSON
  const resultJsonPath = path.join(reportsDir, 'api-test-results.json');
  fs.writeFileSync(resultJsonPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n📁 Full Test Report Saved: ${resultJsonPath}`);

  // Write error log if any
  const failedResults = results.filter((r) => !r.passed);
  const errorJsonPath = path.join(reportsDir, 'api-errors.json');
  fs.writeFileSync(errorJsonPath, JSON.stringify(failedResults, null, 2), 'utf-8');
  console.log(`📁 Error Log Saved: ${errorJsonPath}`);

  if (failedCount > 0) {
    console.error('\n⚠️ Some endpoints failed verification. Check api-errors.json for details.');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 65 API ENDPOINTS & SECURITY GATES PASSED VERIFICATION WITH 0 ERRORS!');
  }
}

runApiTestSuite().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
