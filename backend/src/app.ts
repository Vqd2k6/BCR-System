import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { problemDetailsErrorHandler } from './common/errors/problem-details';
import { authenticateJwt, requireRoles } from './common/guards/auth.guard';

// Controllers
import { AuthController } from './modules/auth/auth.controller';
import { UserAdminController } from './modules/auth/user-admin.controller';
import { AttendanceController } from './modules/attendance/attendance.controller';
import { CadastralController } from './modules/cadastral/cadastral.controller';
import { SurveyController } from './modules/survey/survey.controller';
import { ScoringController } from './modules/scoring/scoring.controller';
import { AuditController } from './modules/audit/audit.controller';
import { ExportController } from './modules/export/export.controller';
import { StorageController } from './modules/storage/storage.controller';
import { ReportController } from './modules/report/report.controller';
import { DevController } from './modules/dev/dev.controller';
import { Database } from './database/db';
import multer from 'multer';

export function createApp(): express.Application {
  const app = express();

  // Global Middlewares
  app.use(helmet());
  app.use(cors({ origin: config.cors.origin }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  if (config.env !== 'test') {
    app.use(morgan('dev'));
  }

  // Root welcome endpoint
  app.get('/', (_req, res) => {
    res.status(200).json({
      name: 'Metro 2 Building Condition Assessment (BCA) API Service',
      version: '1.0.0',
      status: 'ONLINE',
      healthCheck: '/health',
      apiPrefix: config.apiPrefix,
    });
  });

  // Health check endpoint
  app.get('/health', async (_req, res) => {
    const dbStatus = await Database.healthCheck();
    res.status(200).json({
      status: 'UP',
      service: 'Metro 2 Survey & BCA Platform API',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    });
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // Tối đa 25MB mỗi ảnh
  });

  const api = express.Router();

  // ==========================================
  // 0. STORAGE & ẢNH HIỆN TRƯỜNG (CLOUDFLARE R2)
  // ==========================================
  api.post('/storage/upload', authenticateJwt, upload.single('file'), StorageController.uploadFile);
  api.post('/storage/upload-base64', authenticateJwt, StorageController.uploadBase64);

  // ==========================================
  // 1. AUTHENTICATION (PUBLIC)
  // ==========================================
  api.post('/auth/login', AuthController.login);
  api.post('/auth/refresh-token', AuthController.refreshToken);
  api.get('/auth/me', authenticateJwt, AuthController.getMe);
  api.put('/auth/me', authenticateJwt, AuthController.updateMe);
  api.post('/auth/logout', authenticateJwt, AuthController.logout);

  // ==========================================
  // 1. FIELD SURVEYOR ENDPOINTS
  // ==========================================
  // Chấm công
  api.post('/attendance/check-in', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), AttendanceController.checkIn);
  api.get('/attendance/my-history', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), AttendanceController.getMyHistory);
  api.get('/attendance/assigned-zone', authenticateJwt, AttendanceController.getAssignedZone);

  // Thửa đất & Quét cạn
  api.get('/parcels/zone-map', authenticateJwt, CadastralController.getZoneMap);
  api.get('/parcels/nearby', authenticateJwt, CadastralController.getNearbyParcels);
  api.get('/parcels/next-high-range-codes', authenticateJwt, CadastralController.getNextHighRangeProjectCodes);
  api.get('/parcels/:id', authenticateJwt, CadastralController.getParcelById);
  api.get('/parcels/:id/units', authenticateJwt, CadastralController.getUnits);
  api.post('/parcels/:id/units', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), CadastralController.createUnit);
  api.patch('/parcels/:id/building-type', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), CadastralController.updateBuildingType);
  api.post('/parcels/:id/start-survey', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), CadastralController.startSurvey);
  api.post('/parcels/:id/record-absence', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), CadastralController.recordAbsence);
  api.put('/parcels/:id/footprint', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), CadastralController.updateFootprint);
  api.post('/mutations/propose', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), CadastralController.proposeMutation);

  // Hồ sơ Phase 1
  api.post('/reports/phase1', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), SurveyController.createPhase1Report);
  api.get('/reports/phase1/:id', authenticateJwt, SurveyController.getReportDetail);
  api.post('/reports/phase1/:id/identification-photos', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), SurveyController.saveIdentificationPhotos);
  api.put('/reports/phase1/:id/specs', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), SurveyController.saveBuildingSpecs);
  api.put('/reports/phase1/:id/floors', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), SurveyController.saveFloorSurveys);
  api.post('/reports/phase1/:id/zones', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), SurveyController.createDamageZone);
  api.post('/reports/phase1/zones/:id/defects', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), SurveyController.createDefectItem);
  api.put('/reports/phase1/:id/deformation', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), SurveyController.saveDeformation);
  api.post('/reports/phase1/:id/calculate-scores', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), ScoringController.calculateScores);
  api.post('/reports/phase1/:id/submit', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), SurveyController.submitPhase1Report);

  // Gói nộp toàn diện từ Client Offline-first
  api.post('/surveys/phase1/submit', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), SurveyController.submitPhase1FullPackage);
  api.post('/surveys/phase1/submit-absentee', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), CadastralController.recordAbsence);

  // Hồ sơ Phase 2
  api.post('/reports/phase2', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), SurveyController.createPhase2Report);
  api.get('/reports/phase2/:id', authenticateJwt, SurveyController.getReportDetail);
  api.get('/parcels/:id/phase2/zones', authenticateJwt, SurveyController.getPhase2ZonesByLocation);
  api.put('/phase2/defects/:id/verify', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), SurveyController.verifyPhase2Defect);
  api.get('/reports/phase2/:id/quality-gate', authenticateJwt, ScoringController.getQualityGate);
  api.post('/reports/phase2/:id/submit', authenticateJwt, requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), SurveyController.submitPhase2Report);

  // ==========================================
  // 2. ZONE ADMIN & SUPER ADMIN ENDPOINTS
  // ==========================================
  // Thống kê & Chấm công
  api.get('/admin/analytics/progress', authenticateJwt, requireRoles('ZONE_ADMIN', 'SUPER_ADMIN'), AuditController.getProgressAnalytics);
  api.get('/admin/attendance', authenticateJwt, requireRoles('ZONE_ADMIN', 'SUPER_ADMIN'), AttendanceController.listCheckIns);
  api.get('/admin/attendance/summary', authenticateJwt, requireRoles('ZONE_ADMIN', 'SUPER_ADMIN'), AttendanceController.getAttendanceSummary);
  api.get('/admin/attendance/:id', authenticateJwt, requireRoles('ZONE_ADMIN', 'SUPER_ADMIN'), AttendanceController.getCheckInDetail);
  api.post('/admin/attendance/:id/verify', authenticateJwt, requireRoles('ZONE_ADMIN', 'SUPER_ADMIN'), AttendanceController.verifyCheckIn);

  // Thẩm định Split-Pane & Động cơ Cảnh báo Gian lận
  api.get('/admin/reports/audit-alerts', authenticateJwt, requireRoles('ZONE_ADMIN', 'SUPER_ADMIN'), AuditController.listAuditAlerts);
  api.get('/admin/reports/:id/audit-flags', authenticateJwt, requireRoles('ZONE_ADMIN', 'SUPER_ADMIN'), AuditController.getReportAuditFlags);
  api.get('/admin/reports/:id/audit-view', authenticateJwt, requireRoles('ZONE_ADMIN', 'SUPER_ADMIN'), AuditController.getSplitPaneAuditView);
  api.post('/admin/reports/:id/approve', authenticateJwt, requireRoles('ZONE_ADMIN', 'SUPER_ADMIN'), AuditController.approveReport);
  api.post('/admin/reports/:id/reject', authenticateJwt, requireRoles('ZONE_ADMIN', 'SUPER_ADMIN'), AuditController.rejectReport);
  api.post('/admin/mutations/:id/approve', authenticateJwt, requireRoles('ZONE_ADMIN', 'SUPER_ADMIN'), CadastralController.approveMutation);
  api.post('/admin/reports/:id/engineering-judgement', authenticateJwt, requireRoles('ZONE_ADMIN', 'SUPER_ADMIN'), ScoringController.applyJudgement);

  // Xuất Báo Cáo Phân khu & Toàn tuyến
  api.post('/reports/batch-export', authenticateJwt, requireRoles('ZONE_ADMIN', 'SUPER_ADMIN'), ExportController.createBatchExport);
  api.get('/reports/batch-export/:batchId/status', authenticateJwt, ExportController.getBatchStatus);

  // ==========================================
  // 3. SUPER ADMIN USER LIFECYCLE & GLOBAL HUB
  // ==========================================
  api.get('/admin/users', authenticateJwt, requireRoles('SUPER_ADMIN'), UserAdminController.listUsers);
  api.get('/admin/users/:id', authenticateJwt, requireRoles('SUPER_ADMIN'), UserAdminController.getUserById);
  api.post('/admin/users', authenticateJwt, requireRoles('SUPER_ADMIN'), UserAdminController.createUser);
  api.put('/admin/users/:id', authenticateJwt, requireRoles('SUPER_ADMIN'), UserAdminController.updateUser);
  api.put('/admin/users/:id/status', authenticateJwt, requireRoles('SUPER_ADMIN'), UserAdminController.updateStatus);
  api.post('/admin/users/:id/reset-password', authenticateJwt, requireRoles('SUPER_ADMIN'), UserAdminController.resetPassword);
  api.delete('/admin/users/:id', authenticateJwt, requireRoles('SUPER_ADMIN'), UserAdminController.deleteUser);

  api.post('/admin/reports/batch-export', authenticateJwt, requireRoles('SUPER_ADMIN'), ExportController.createBatchExport);
  api.get('/admin/reports/exports', authenticateJwt, requireRoles('SUPER_ADMIN'), ExportController.listAllExportBatches);
  api.delete('/admin/reports/exports/:batchId', authenticateJwt, requireRoles('SUPER_ADMIN'), ExportController.revokeExport);

  // ==========================================
  // 4. CONTRACTOR & GUEST VIEW ENDPOINTS
  // ==========================================
  api.get('/guest/gis-map', ExportController.getGuestGisMap);
  api.get('/guest/parcels/:id/summary', ExportController.getGuestParcelSummary);

  // ==========================================
  // 5. TECHNICAL BCS REPORT EXPORT (PDF & PREVIEW)
  // ==========================================
  api.get('/reports/:id/export/pdf', ReportController.exportResidentialPdf);
  api.get('/reports/:id/preview/html', ReportController.previewResidentialHtml);

  // ==========================================
  // 6. DEV ERROR REPORTING & RUNTIME DIAGNOSTICS
  // ==========================================
  api.post('/dev/report-error', DevController.reportError);
  app.post('/api/dev/report-error', DevController.reportError);

  // Mount API prefix
  app.use(config.apiPrefix, api);

  // Global Error Handler (RFC 7807 Problem Details)
  app.use(problemDetailsErrorHandler);

  return app;
}
