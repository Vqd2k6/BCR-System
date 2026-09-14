const express = require('express');
const router = express.Router();
const buildingsController = require('../controllers/buildings.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

router.get('/geojson', buildingsController.getBuildingsGeoJson);
router.get('/:id', buildingsController.getBuildingDetail);

// Mobile Surveyor nộp bài
router.post('/survey', authenticateToken, authorizeRoles('FIELD_SURVEYOR', 'SUPER_ADMIN'), buildingsController.submitSurvey);

// Zone Manager / Admin kiểm duyệt & Reverse GIS Sync
router.patch('/:id/approve', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ZONE_MANAGER'), buildingsController.approveSurvey);
router.patch('/:id/reject', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ZONE_MANAGER'), buildingsController.rejectSurvey);

module.exports = router;
