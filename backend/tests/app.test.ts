import request from 'supertest';
import { createApp } from '../src/app';
import { Database } from '../src/database/db';
import { CryptoUtils } from '../src/common/utils/crypto.utils';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

describe('Metro 2 Survey Platform - RESTful API & Contract Verification Tests', () => {
  const app = createApp();

  // Tạo mock JWT Tokens cho các vai trò
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

  beforeEach(() => {
    jest.spyOn(CryptoUtils, 'comparePassword').mockResolvedValue(true);

    jest.spyOn(Database, 'query').mockImplementation(async (text: string, params?: any[]) => {
      // Mock Users
      if (text.includes('SELECT * FROM users WHERE username = $1')) {
        if (params && params[0] === 'surveyor_s10_01') {
          // Khi tạo user mới, user chưa tồn tại
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

      // Mock Healthcheck
      if (text.includes('PostGIS_Version()')) {
        return {
          rows: [{ postgis_version: '3.4.2', now: new Date() }],
          rowCount: 1,
        } as any;
      }

      // Mock Zone Center Distance
      if (text.includes('ST_Distance') && text.includes('metro_zones')) {
        return {
          rows: [{ zone_code: 'ZONE_S9', zone_name: 'Ga S9 - Bà Quẹo', distance_meters: 35.5 }],
          rowCount: 1,
        } as any;
      }

      // Mock Parcels FindById for start-survey
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

      // Mock Count
      if (text.includes('SELECT COUNT(*)')) {
        return { rows: [{ count: '5' }], rowCount: 1 } as any;
      }

      // Mock Insert/Update return
      return {
        rows: [
          {
            id: 'a0000000-0000-0000-0000-000000000001',
            report_id: 'a0000000-0000-0000-0000-000000000001',
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

  describe('0. Health Check & Common Authentication', () => {
    it('GET /health - should return UP with PostGIS version', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.database.postgisVersion).toBe('3.4.2');
    });

    it('POST /api/v1/auth/login - should authenticate valid user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'surveyor_s9_01', password: 'Password@123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user.role).toBe('SURVEYOR');
    });

    it('GET /api/v1/auth/me - should return profile for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${surveyorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('1. Field Surveyor Endpoints', () => {
    it('POST /api/v1/attendance/check-in - should record GPS and selfie', async () => {
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

    it('GET /api/v1/parcels/zone-map - should return parcels list for GIS layer', async () => {
      const res = await request(app)
        .get('/api/v1/parcels/zone-map?zoneId=ZONE_S9')
        .set('Authorization', `Bearer ${surveyorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/parcels/:id/start-survey - should allow surveyor to pick ad-hoc parcel', async () => {
      const res = await request(app)
        .post('/api/v1/parcels/c0000000-0000-0000-0000-000000000001/start-survey')
        .set('Authorization', `Bearer ${surveyorToken}`)
        .send({ phase: 'PHASE_1' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.surveyStatus).toBe('IN_PROGRESS');
    });

    it('POST /api/v1/parcels/:id/record-absence - should record absence and change status to POSTPONED_ABSENT', async () => {
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

    it('POST /api/v1/reports/phase1/:id/calculate-scores - should auto calculate ECS (0-24) and VI', async () => {
      const res = await request(app)
        .post('/api/v1/reports/phase1/a0000000-0000-0000-0000-000000000001/calculate-scores')
        .set('Authorization', `Bearer ${surveyorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scores).toHaveProperty('totalEcs');
      expect(res.body.data.scores).toHaveProperty('ecsClass');
    });
  });

  describe('2. Zone Admin & Review Endpoints', () => {
    it('GET /api/v1/admin/analytics/progress - should return zone statistics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/progress?zoneId=ZONE_S9')
        .set('Authorization', `Bearer ${zoneAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/admin/attendance/:id/verify - should verify surveyor attendance', async () => {
      const res = await request(app)
        .post('/api/v1/admin/attendance/a0000000-0000-0000-0000-000000000001/verify')
        .set('Authorization', `Bearer ${zoneAdminToken}`)
        .send({ action: 'APPROVE', notes: 'Có mặt đúng giờ' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/admin/reports/:id/audit-view - should return split-pane review payload with 400% zoom', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/a0000000-0000-0000-0000-000000000001/audit-view')
        .set('Authorization', `Bearer ${zoneAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('leftPane');
      expect(res.body.data).toHaveProperty('rightPane');
      expect(res.body.data.rightPane.magnifierZoomFactor).toBe('400%');
    });

    it('POST /api/v1/admin/reports/:id/approve - should approve report and generate official PDF URL', async () => {
      const res = await request(app)
        .post('/api/v1/admin/reports/a0000000-0000-0000-0000-000000000001/approve')
        .set('Authorization', `Bearer ${zoneAdminToken}`)
        .send({ judgementNotes: 'Hồ sơ đạt tiêu chuẩn kỹ thuật' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
    });

    it('POST /api/v1/reports/batch-export - should trigger selective export with SHA-256 Checksum', async () => {
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
  });

  describe('3. Super Admin User Lifecycle & Global Hub', () => {
    it('POST /api/v1/admin/users - should create new user', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          username: 'surveyor_s10_01',
          password: 'Password@123',
          fullName: 'Phạm Văn Mới',
          role: 'SURVEYOR',
          assignedZoneId: 'ZONE_S10',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('PUT /api/v1/admin/users/:id/status - should lock/suspend user', async () => {
      const res = await request(app)
        .put('/api/v1/admin/users/b0000000-0000-0000-0000-000000000003/status')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'SUSPENDED', reason: 'Tạm ngưng công tác' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/admin/reports/exports - should list global export history', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/exports')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('4. Contractor & Guest Endpoints', () => {
    it('GET /api/v1/guest/gis-map - should allow public/guest GIS map access', async () => {
      const res = await request(app).get('/api/v1/guest/gis-map?zoneId=ZONE_S9');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
