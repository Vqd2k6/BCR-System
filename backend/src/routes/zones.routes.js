const express = require('express');
const router = express.Router();
const zonesController = require('../controllers/zones.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

router.get('/', zonesController.getZones);
router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ZONE_MANAGER'), zonesController.createZone);

module.exports = router;
