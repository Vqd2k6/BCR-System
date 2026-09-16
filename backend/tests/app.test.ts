import request from 'supertest';
import { createApp } from '../src/app';
import { Database } from '../src/database/db';
import { CryptoUtils } from '../src/common/utils/crypto.utils';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

describe('Metro 2 Survey Platform - Full Exhaustive API Verification Suite (All Endpoints & Roles)', () => {
  const app = createApp();

  // 1. Tạo mock JWT Tokens cho 4 vai trò
  const superAdminToken = jwt.sign(
    {
      userId: 'b0000000-0000-0000-0000-000000000001',
      username: 'superadmin',
      role: 'SUPER_ADMIN',
      fullName: 'Nguyễn Văn Tổng (MAUR)',
    },
    config.jwt.secret,
    { expiresIn: '1h' }
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
    { expiresIn: '1h' }
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
    { expiresIn: '1h' }
  );

  const contractorToken = jwt.sign(
    {
      userId: 'b0000000-0000-0000-0000-000000000004',
      username: 'contractor_guest',
      role: 'CONTRACTOR',
      fullName: 'Nhà Thầu Thi Công TBM',
    },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    jest.spyOn(CryptoUtils, 'comparePassword').mockResolvedValue(true);

    jest.spyOn(Database, 'query').mockImplementation(async (text: string, params?: any[]) => {
      // Mock Users
      if (text.includes('SELECT * FROM users WHERE username = $1')) {
        if (params && params[0] === 'new_user_test') {
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

      // Mock Healthcheck
      if (text.includes('PostGIS_Version()')) {
        return {
          rows: [{ postgis_version: '3.4.2', now: new Date() }],
          rowCount: 1,
        } as any;
      }

      // Mock Session check
      if (text.includes('FROM user_sessions WHERE refresh_token_hash = $1')) {
        return {
          rows: [{ is_revoked: false, expires_at: new Date(Date.now() + 86400000) }],
          rowCount: 1,
        } as any;
      }

      // Mock Zone Distance
      if (text.includes('ST_Distance') && text.includes('metro_zones')) {
        return {
          rows: [{ zone_code: 'ZONE_S9', zone_name: 'Ga S9 - Bà Quẹo', distance_meters: 35.5 }],
          rowCount: 1,
        } as any;
      }

      // Mock Parcels FindById
      if (text.includes('SELECT p.*') && text.includes('WHERE p.id = $1')) {
        return {
          rows: [
            {
              id: 'c0000000-0000-0000-0000-000000000001',
              project_parcel_code: 'B-00105',
              official_cadastral_code: 'KS003-00105',
              house_number: '854',
              street: 'Đường Trường Chinh',
              survey_status: 'NOT_SURVEYED',
              lifecycle_status: 'ACTIVE',
              absence_attempt_count: 0,
            },
          ],
          rowCount: 1,
        } as any;
      }

      // Mock Parcels Zone Map
      if (text.includes('FROM parcels p')) {
        return {
          rows: [
            {
              id: 'c0000000-0000-0000-0000-000000000001',
              project_parcel_code: 'B-00105',
              official_cadastral_code: 'KS003-00105',
              house_number: '854',
              street: 'Đường Trường Chinh',
              survey_status: 'APPROVED',
              lifecycle_status: 'ACTIVE',
            },
          ],
          rowCount: 1,
        } as any;
      }

      // Mock Report By ID
      if (text.includes('FROM base_survey_reports r')) {
        return {
          rows: [
            {
              id: 'a0000000-0000-0000-0000-000000000001',
              report_code: 'REPORT-B00105-PHASE1-1234',
              parcel_id: 'c0000000-0000-0000-0000-000000000001',
              project_parcel_code: 'B-00105',
              surveyor_name: 'Nguyễn Văn Khảo Sát',
              status: 'SUBMITTED',
              survey_date: '2026-09-16',
            },
          ],
          rowCount: 1,
        } as any;
      }

      // Mock Damage Zones
      if (text.includes('FROM damage_zones z')) {
        return {
          rows: [
            {
              id: 'd0000000-0000-0000-0000-000000000001',
              zone_code: 'Z-01',
              floor_name: 'Tầng 1',
              room_name: 'Phòng khách',
              ctx_photo_url: 'https://storage.metro2.vn/photos/ctx-01.jpg',
              defects: [
                {
                  id: 'e0000000-0000-0000-0000-000000000001',
                  defect_code: 'D-01',
                  cu_photo_url: 'https://storage.metro2.vn/photos/cu-01.jpg',
                  width_max_mm: 0.85,
                  length_mm: 650,
                  has_scale_card: true,
                  is_structural_critical: false,
                },
              ],
            },
          ],
          rowCount: 1,
        } as any;
      }

      // Mock Defect Item Single
      if (text.includes('SELECT width_max_mm, length_mm FROM defect_items')) {
        return {
          rows: [{ width_max_mm: 0.85, length_mm: 650.0 }],
          rowCount: 1,
        } as any;
      }

      // Mock Count
      if (text.includes('SELECT COUNT(*)')) {
        return { rows: [{ count: '10' }], rowCount: 1 } as any;
      }

      // Mock Default return
      return {
        rows: [
          {
            id: 'a0000000-0000-0000-0000-000000000001',
            report_id: 'a0000000-0000-0000-0000-000000000001',
            zone_code: 'Z-01',
            batch_code: 'BATCH-ZONE_S9-1234',
            status: 'APPROVED',
            verification_status: 'PENDING_VERIFICATION',
            checkin_time: new Date(),
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      } as any;
    });

    jest.spyOn(Database, 'transaction').mockImplementation(async (cb: any) => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({
          rows: [
            {
              id: 'a0000000-0000-0000-0000-000000000001',
              project_parcel_code: 'B-07001',
              parcel_id: 'c0000000-0000-0000-0000-000000000001',
              status: 'PROPOSED_BY_SURVEYOR',
              source_parcel_ids: ['c0000000-0000-0000-0000-000000000001'],
              result_parcel_ids: ['c0000000-0000-0000-0000-000000000002'],
            },
          ],
          rowCount: 1,
        }),
      };
      return cb(mockClient);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==========================================
  // 0. COMMON AUTHENTICATION & HEALTHCHECK
  // ==========================================
  describe('0. Health Check & Common Authentication API', () => {
    it('0.0. GET /health - should return UP with PostGIS version', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.database.postgisVersion).toBe('3.4.2');
    });

    it('0.1. POST /api/v1/auth/login - should authenticate valid user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'surveyor_s9_01', password: 'Password@123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user.role).toBe('SURVEYOR');
    });

    it('0.2. POST /api/v1/auth/refresh-token - should return new access token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: 'mock_refresh_token_1234567890' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('0.3. GET /api/v1/auth/me - should return profile for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${surveyorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe('surveyor_s9_01');
    });

    it('0.4. POST /api/v1/auth/logout - should invalidate session', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({ refreshToken: 'mock_refresh_token_1234567890' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // 1. FIELD SURVEYOR APIS
  // ==========================================
  describe('1. Field Surveyor API Endpoints', () => {
    it('1.1.1. POST /api/v1/attendance/check-in - should record GPS and selfie', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({
          zoneId: 'ZONE_S9',
          gpsLatitude: 10.798123,
          gpsLongitude: 106.645678,
          notes: 'Đầu giờ sáng ca khảo sát',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('checkInId');
    });

    it('1.1.2. GET /api/v1/attendance/my-history - should return personal check-in history', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/my-history')
        .set('Authorization', `Bearer ${surveyorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('1.1.3. GET /api/v1/parcels/zone-map - should return parcels list for GIS layer', async () => {
      const res = await request(app)
        .get('/api/v1/parcels/zone-map?zoneId=ZONE_S9')
        .set('Authorization', `Bearer ${surveyorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('1.1.4. GET /api/v1/parcels/nearby - should return nearby unsurveyed parcels', async () => {
      const res = await request(app)
        .get('/api/v1/parcels/nearby?lat=10.7981&lng=106.6456&radius=150')
        .set('Authorization', `Bearer ${surveyorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('1.1.5. GET /api/v1/parcels/:id - should return single parcel details with footprint', async () => {
      const res = await request(app)
        .get('/api/v1/parcels/c0000000-0000-0000-0000-000000000001')
        .set('Authorization', `Bearer ${surveyorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.project_parcel_code).toBe('B-00105');
    });

    it('1.1.6. POST /api/v1/parcels/:id/start-survey - should allow surveyor to pick ad-hoc parcel', async () => {
      const res = await request(app)
        .post('/api/v1/parcels/c0000000-0000-0000-0000-000000000001/start-survey')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({ phase: 'PHASE_1' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.surveyStatus).toBe('IN_PROGRESS');
    });

    it('1.1.7. POST /api/v1/parcels/:id/record-absence - should record absence and change status to POSTPONED_ABSENT', async () => {
      const res = await request(app)
        .post('/api/v1/parcels/c0000000-0000-0000-0000-000000000001/record-absence')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({
          absenceReason: 'HOMEOWNER_ABSENT',
          notes: 'Cửa khóa ngoài',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.surveyStatus).toBe('POSTPONED_ABSENT');
    });

    it('1.1.8. PUT /api/v1/parcels/:id/footprint - should update building footprint polygon', async () => {
      const res = await request(app)
        .put('/api/v1/parcels/c0000000-0000-0000-0000-000000000001/footprint')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({
          footprintPolygonGeoJson: { type: 'Polygon', coordinates: [[[106.64, 10.79], [106.65, 10.79], [106.65, 10.80], [106.64, 10.80], [106.64, 10.79]]] },
          measuredConstructionAreaM2: 56.5,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('1.1.9. POST /api/v1/mutations/propose - should propose parcel split with high-range pool', async () => {
      const res = await request(app)
        .post('/api/v1/mutations/propose')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({
          mutationType: 'SPLIT',
          sourceParcelIds: ['c0000000-0000-0000-0000-000000000001'],
          surveyorNotes: 'Phát hiện nhà tách làm 2 căn',
          childParcels: [
            {
              houseNumber: '854/1',
              landAreaM2: 30.0,
              polygonGeoJson: { type: 'Polygon', coordinates: [[[106.64, 10.79], [106.645, 10.79], [106.645, 10.80], [106.64, 10.80], [106.64, 10.79]]] },
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PROPOSED_BY_SURVEYOR');
    });

    // Phase 1 9 Steps
    it('1.1.10. POST /api/v1/reports/phase1 - should create Phase 1 Baseline report', async () => {
      const res = await request(app)
        .post('/api/v1/reports/phase1')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({ parcelId: 'c0000000-0000-0000-0000-000000000001' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.phase).toBe('PHASE_1');
    });

    it('1.1.11. POST /api/v1/reports/phase1/:id/identification-photos - should save P01-P04 with N-point polygon', async () => {
      const res = await request(app)
        .post('/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/identification-photos')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({
          p01HouseNumberUrl: 'https://storage.metro2.vn/photos/p01.jpg',
          p02MainFacadeUrl: 'https://storage.metro2.vn/photos/p02.jpg',
          p02FacadePolygonPoints: [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }],
          p02FloorSplitLines: [{ floor: 'Tầng 1', y: 30 }, { floor: 'Tầng 2', y: 60 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('aiJobId');
    });

    it('1.1.12. PUT /api/v1/reports/phase1/:id/specs - should save structural specs and foundation CAT 1-5', async () => {
      const res = await request(app)
        .put('/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/specs')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({
          buildingName: 'Nhà ở gia đình',
          structuralSystem: 'KHUNG_BTCT_CHIU_LUC',
          foundationCategory: 'CAT_2_MONG_DON_BTCT',
          floorCount: 3,
          extendedOrRenovated: false,
          e5HistoryScore: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('1.1.13. POST /api/v1/reports/phase1/:id/zones - should create damage zone Z-xx with CTX photo', async () => {
      const res = await request(app)
        .post('/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/zones')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({
          zoneCode: 'Z-01',
          floorName: 'Tầng trệt',
          roomName: 'Phòng khách',
          burlandGrade: 2,
          ctxPhotoUrl: 'https://storage.metro2.vn/photos/ctx.jpg',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.zoneCode).toBe('Z-01');
    });

    it('1.1.14. POST /api/v1/reports/phase1/zones/:id/defects - should pin defect D-xx with CU photo & scale card', async () => {
      const res = await request(app)
        .post('/api/v1/reports/phase1/zones/d0000000-0000-0000-0000-000000000001/defects')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({
          defectCode: 'D-01',
          pinX: 45.5,
          pinY: 60.2,
          screeningCategory: 'Nứt tường hoàn thiện',
          defectType: 'Nứt xiên 45 độ',
          widthMaxMm: 0.85,
          lengthMm: 650.0,
          hasScaleCard: true,
          cuPhotoUrl: 'https://storage.metro2.vn/photos/cu.jpg',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('1.1.15. PUT /api/v1/reports/phase1/:id/deformation - should save tilt and settlement measurements', async () => {
      const res = await request(app)
        .put('/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/deformation')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({
          tiltAngleX: 0.25,
          tiltAngleY: 0.15,
          floorSlopeRatio: 0.1,
          beamDeflectionMm: 2.5,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('1.1.16. POST /api/v1/reports/phase1/:id/calculate-scores - should auto calculate ECS (0-24) and VI', async () => {
      const res = await request(app)
        .post('/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/calculate-scores')
        .set('Authorization', `Bearer ${surveyorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scores).toHaveProperty('totalEcs');
      expect(res.body.data.scores).toHaveProperty('ecsClass');
    });

    it('1.1.17. POST /api/v1/reports/phase1/:id/submit - should submit Phase 1 report with owner remarks', async () => {
      const res = await request(app)
        .post('/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/submit')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({
          ownerRemarks: 'Đồng ý với hiện trạng ghi nhận',
          surveyorSignatureUrl: 'https://storage.metro2.vn/signatures/surveyor.png',
          ownerSignatureUrl: 'https://storage.metro2.vn/signatures/owner.png',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SUBMITTED');
    });

    // Phase 2 Endpoints
    it('1.1.18. POST /api/v1/reports/phase2 - should create Phase 2 report inheriting Phase 1 baseline', async () => {
      const res = await request(app)
        .post('/api/v1/reports/phase2')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({
          parcelId: 'c0000000-0000-0000-0000-000000000001',
          phase1ReportId: 'a0000000-0000-0000-0000-000000000001',
          surveyLevel: 'L2_B',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.phase).toBe('PHASE_2');
    });

    it('1.1.19. GET /api/v1/parcels/:id/phase2/zones - should filter Phase 1 zones and old defects by room', async () => {
      const res = await request(app)
        .get(`/api/v1/parcels/c0000000-0000-0000-0000-000000000001/phase2/zones?floor=${encodeURIComponent('Tầng 1')}`)
        .set('Authorization', `Bearer ${surveyorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('1.1.20. PUT /api/v1/phase2/defects/:id/verify - should verify old defect and calculate delta_w and delta_L', async () => {
      const res = await request(app)
        .put('/api/v1/phase2/defects/e0000000-0000-0000-0000-000000000001/verify')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({
          phase2WidthMm: 1.20,
          phase2LengthMm: 800.0,
          evolutionStatus: 'WIDENED',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deltaWidthMm).toBe(0.35); // 1.20 - 0.85
      expect(res.body.data.evolutionStatus).toBe('WIDENED');
    });

    it('1.1.21. GET /api/v1/reports/phase2/:id/quality-gate - should verify Appendix A 10-criteria checklist', async () => {
      const res = await request(app)
        .get('/api/v1/reports/phase2/a0000000-0000-0000-0000-000000000001/quality-gate')
        .set('Authorization', `Bearer ${surveyorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPassed).toBe(true);
      expect(res.body.data.checklist.length).toBe(10);
    });

    it('1.1.22. POST /api/v1/reports/phase2/:id/submit - should submit Phase 2 with 4-party signatures', async () => {
      const res = await request(app)
        .post('/api/v1/reports/phase2/a0000000-0000-0000-0000-000000000001/submit')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({
          surveyorSignatureUrl: 'https://storage.metro2.vn/signatures/s.png',
          ownerSignatureUrl: 'https://storage.metro2.vn/signatures/o.png',
          contractorRepSignatureUrl: 'https://storage.metro2.vn/signatures/c.png',
          thirdPartyRepSignatureUrl: 'https://storage.metro2.vn/signatures/t.png',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // 2. ZONE ADMIN APIS
  // ==========================================
  describe('2. Zone Admin & Review Endpoints', () => {
    it('2.1. GET /api/v1/admin/analytics/progress - should return zone statistics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/progress?zoneId=ZONE_S9')
        .set('Authorization', `Bearer ${zoneAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2.2. GET /api/v1/admin/attendance - should list surveyor check-ins in zone', async () => {
      const res = await request(app)
        .get('/api/v1/admin/attendance?zoneId=ZONE_S9')
        .set('Authorization', `Bearer ${zoneAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2.3. GET /api/v1/admin/attendance/:id - should return single check-in detail', async () => {
      const res = await request(app)
        .get('/api/v1/admin/attendance/a0000000-0000-0000-0000-000000000001')
        .set('Authorization', `Bearer ${zoneAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2.4. POST /api/v1/admin/attendance/:id/verify - should verify surveyor attendance', async () => {
      const res = await request(app)
        .post('/api/v1/admin/attendance/a0000000-0000-0000-0000-000000000001/verify')
        .set('Authorization', `Bearer ${zoneAdminToken}`)
        .send({ action: 'APPROVE', notes: 'Có mặt đúng giờ' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2.5. GET /api/v1/admin/attendance/summary - should return monthly diligence summary', async () => {
      const res = await request(app)
        .get('/api/v1/admin/attendance/summary?zoneId=ZONE_S9')
        .set('Authorization', `Bearer ${zoneAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2.6. GET /api/v1/admin/reports/audit-alerts - should return automated fraud detection alerts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/audit-alerts?zoneId=ZONE_S9')
        .set('Authorization', `Bearer ${zoneAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2.7. GET /api/v1/admin/reports/:id/audit-flags - should return audit flags for single report', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/a0000000-0000-0000-0000-000000000001/audit-flags')
        .set('Authorization', `Bearer ${zoneAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2.8. GET /api/v1/admin/reports/:id/audit-view - should return split-pane review payload with 400% zoom', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/a0000000-0000-0000-0000-000000000001/audit-view')
        .set('Authorization', `Bearer ${zoneAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('leftPane');
      expect(res.body.data).toHaveProperty('rightPane');
      expect(res.body.data.rightPane.magnifierZoomFactor).toBe('400%');
    });

    it('2.9. POST /api/v1/admin/reports/:id/approve - should approve report and generate official PDF URL', async () => {
      const res = await request(app)
        .post('/api/v1/admin/reports/a0000000-0000-0000-0000-000000000001/approve')
        .set('Authorization', `Bearer ${zoneAdminToken}`)
        .send({ judgementNotes: 'Hồ sơ đạt tiêu chuẩn kỹ thuật' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
    });

    it('2.10. POST /api/v1/admin/reports/:id/reject - should reject report with technical reason', async () => {
      const res = await request(app)
        .post('/api/v1/admin/reports/a0000000-0000-0000-0000-000000000001/reject')
        .set('Authorization', `Bearer ${zoneAdminToken}`)
        .send({ rejectionReason: 'Ảnh CU D-01 thiếu thước đo khe nứt' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REJECTED');
    });

    it('2.11. POST /api/v1/admin/mutations/:id/approve - should approve parcel mutation with transaction', async () => {
      const res = await request(app)
        .post('/api/v1/admin/mutations/a0000000-0000-0000-0000-000000000001/approve')
        .set('Authorization', `Bearer ${zoneAdminToken}`)
        .send({ action: 'APPROVE' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
    });

    it('2.12. POST /api/v1/admin/reports/:id/engineering-judgement - should apply engineering judgement', async () => {
      const res = await request(app)
        .post('/api/v1/admin/reports/a0000000-0000-0000-0000-000000000001/engineering-judgement')
        .set('Authorization', `Bearer ${zoneAdminToken}`)
        .send({ action: 'UPGRADE', reason: 'Công trình nằm sát hố đào ngầm' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2.13. POST /api/v1/reports/batch-export - should trigger selective export with SHA-256 Checksum', async () => {
      const res = await request(app)
        .post('/api/v1/reports/batch-export')
        .set('Authorization', `Bearer ${zoneAdminToken}`)
        .send({
          exportScope: 'SELECTED_LIST',
          selectedReportIds: ['a0000000-0000-0000-0000-000000000001'],
          exportFormat: 'PDF_BOOK_COMPILATION',
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('checksumSha256');
    });

    it('2.14. GET /api/v1/reports/batch-export/:batchId/status - should return export progress status', async () => {
      const res = await request(app)
        .get('/api/v1/reports/batch-export/a0000000-0000-0000-0000-000000000001/status')
        .set('Authorization', `Bearer ${zoneAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // 3. SUPER ADMIN APIS
  // ==========================================
  describe('3. Super Admin User Lifecycle & Global Export Hub', () => {
    it('3.1. GET /api/v1/admin/users - should list users across all stations', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3.2. GET /api/v1/admin/users/:id - should return single user details', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users/b0000000-0000-0000-0000-000000000003')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3.3. POST /api/v1/admin/users - should create new user', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          username: 'new_user_test',
          password: 'Password@123',
          fullName: 'Phạm Văn Mới',
          role: 'SURVEYOR',
          assignedZoneId: 'ZONE_S10',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('3.4. PUT /api/v1/admin/users/:id - should update user info & station reassignment', async () => {
      const res = await request(app)
        .put('/api/v1/admin/users/b0000000-0000-0000-0000-000000000003')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          fullName: 'Nguyễn Văn Khảo Sát (Đã sửa)',
          assignedZoneId: 'ZONE_S11',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3.5. PUT /api/v1/admin/users/:id/status - should lock/suspend user', async () => {
      const res = await request(app)
        .put('/api/v1/admin/users/b0000000-0000-0000-0000-000000000003/status')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'SUSPENDED', reason: 'Tạm ngưng công tác' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3.6. POST /api/v1/admin/users/:id/reset-password - should reset user password', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/b0000000-0000-0000-0000-000000000003/reset-password')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ newPassword: 'NewPassword@123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3.7. DELETE /api/v1/admin/users/:id - should soft-delete user preserving history', async () => {
      const res = await request(app)
        .delete('/api/v1/admin/users/b0000000-0000-0000-0000-000000000003')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3.8. POST /api/v1/admin/reports/batch-export - should export all 11 stations dossier', async () => {
      const res = await request(app)
        .post('/api/v1/admin/reports/batch-export')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          exportScope: 'GLOBAL_ALL_ZONES',
          exportFormat: 'PDF_BOOK_COMPILATION',
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
    });

    it('3.9. GET /api/v1/admin/reports/exports - should list global export history', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/exports')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3.10. DELETE /api/v1/admin/reports/exports/:batchId - should revoke and purge export batch', async () => {
      const res = await request(app)
        .delete('/api/v1/admin/reports/exports/a0000000-0000-0000-0000-000000000001')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // 4. CONTRACTOR & GUEST APIS
  // ==========================================
  describe('4. Contractor & Guest Endpoints', () => {
    it('4.1. GET /api/v1/guest/gis-map - should allow public/guest GIS map access', async () => {
      const res = await request(app).get('/api/v1/guest/gis-map?zoneId=ZONE_S9');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('4.2. GET /api/v1/guest/parcels/:id/summary - should return parcel summary with ECS score', async () => {
      const res = await request(app).get('/api/v1/guest/parcels/c0000000-0000-0000-0000-000000000001/summary');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // 5. RBAC PERMISSION & SECURITY TESTS
  // ==========================================
  describe('5. RBAC Permission & Security Control Tests', () => {
    it('5.1. Surveyor should NOT be able to access Super Admin User Management (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${surveyorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('5.2. Zone Admin should NOT be able to access Super Admin User Creation (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${zoneAdminToken}`)
        .send({ username: 'test', password: 'Password@123', fullName: 'Test', role: 'SURVEYOR' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('5.3. Contractor should NOT be able to submit survey reports (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/reports/phase1')
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({ parcelId: 'c0000000-0000-0000-0000-000000000001' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('5.4. Request without Authorization token should fail with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });
});
