const express = require('express');
const router = express.Router();

const buildingsController = require('../controllers/buildings.controller');
const phase1Controller    = require('../controllers/phase1.controller');
const phase2Controller    = require('../controllers/phase2.controller');
const defectsController   = require('../controllers/defects.controller');
const signaturesController = require('../controllers/signatures.controller');

const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');
const { requirePhase1Approved, requireWebSigningRole } = require('../middlewares/prerequisite.middleware');

// ── Vai trò tham chiếu ──────────────────────────────────────────────────────
const ADMINS      = ['SUPER_ADMIN'];
const MANAGERS    = ['SUPER_ADMIN', 'ZONE_MANAGER'];
const SURVEYORS   = ['SUPER_ADMIN', 'ZONE_MANAGER', 'FIELD_SURVEYOR'];
const ALL_ROLES   = ['SUPER_ADMIN', 'ZONE_MANAGER', 'FIELD_SURVEYOR', 'CONTRACTOR', 'LOCAL_AUTHORITY', 'AUDITOR'];

// ── Middleware tổng hợp ──────────────────────────────────────────────────────
const auth     = authenticateToken;
const isAdmin  = authorizeRoles(...ADMINS);
const isMgr    = authorizeRoles(...MANAGERS);
const isSurv   = authorizeRoles(...SURVEYORS);
const isAny    = authorizeRoles(...ALL_ROLES);

// ============================================================================
// BUILDINGS CRUD (Legacy — Dành cho bản đồ GIS và khởi tạo)
// ============================================================================
router.get('/geojson',  buildingsController.getBuildingsGeoJson);  // Public GIS
router.get('/:id',      auth, isAny, buildingsController.getBuildingDetail);
// (Tạo công trình mới sẽ bổ sung trong Sprint 2 khi Zone Manager vẽ zone)

// ============================================================================
// PHASE 1 — BCS / ECS / BRA ASSESSMENT (Khảo sát nền)
// ============================================================================
// Lấy hồ sơ Phase 1 (tất cả vai trò)
router.get( '/:buildingId/phase1',          auth, isAny,  phase1Controller.getPhase1);
// Surveyor nộp Phase 1
router.post('/:buildingId/phase1',          auth, isSurv, phase1Controller.submitPhase1);
// Zone Manager phê duyệt Phase 1
router.patch('/:buildingId/phase1/approve', auth, isMgr,  phase1Controller.approvePhase1);
// Zone Manager từ chối Phase 1
router.patch('/:buildingId/phase1/reject',  auth, isMgr,  phase1Controller.rejectPhase1);

// ============================================================================
// PHASE 2 — PRE-CONSTRUCTION SURVEY (Chốt chặn trước thi công)
// ============================================================================
// Lấy hồ sơ Phase 2 (tất cả vai trò)
router.get( '/:buildingId/phase2',          auth, isAny,  phase2Controller.getPhase2);
// Surveyor nộp Phase 2 — BẮT BUỘC Phase 1 đã APPROVED (Prerequisite Gate)
router.post('/:buildingId/phase2',          auth, isSurv, requirePhase1Approved, phase2Controller.submitPhase2);
// Zone Manager phê duyệt Phase 2
router.patch('/:buildingId/phase2/approve', auth, isMgr,  phase2Controller.approvePhase2);
// Zone Manager từ chối Phase 2
router.patch('/:buildingId/phase2/reject',  auth, isMgr,  phase2Controller.rejectPhase2);

// ============================================================================
// DEFECT REGISTER — Sổ Khuyết Tật D-01..D-99
// ============================================================================
router.get( '/:buildingId/phase2/defects',          auth, isAny,  defectsController.listDefects);
router.post('/:buildingId/phase2/defects',          auth, isSurv, defectsController.addDefect);
router.patch('/:buildingId/phase2/defects/:defectId', auth, isSurv, defectsController.updateDefect);
router.delete('/:buildingId/phase2/defects/:defectId', auth, isSurv, defectsController.deleteDefect);

// ============================================================================
// SIGNATURES — Chữ ký số 4 bên (Hybrid: Mobile + Web)
// ============================================================================
// Lấy danh sách chữ ký
router.get( '/:buildingId/phase2/signatures',         auth, isAny,  signaturesController.getSignatures);
// Mobile: Chủ hộ & Cán bộ ký tại hiện trường
router.post('/:buildingId/phase2/signatures/mobile',  auth, isSurv, signaturesController.signMobile);
// Web: Nhà thầu & Chính quyền địa phương ký qua Web Portal
router.post('/:buildingId/phase2/signatures/web',     auth, requireWebSigningRole, signaturesController.signWeb);

// ============================================================================
// LEGACY ENDPOINTS — Giữ tương thích với Web Demo cũ (Deprecated, sẽ xóa sau)
// ============================================================================
router.post('/survey',       auth, isSurv, buildingsController.submitSurvey);
router.patch('/:id/approve', auth, isMgr,  buildingsController.approveSurvey);
router.patch('/:id/reject',  auth, isMgr,  buildingsController.rejectSurvey);

module.exports = router;

