import { Router } from 'express';
import { authenticateJwt, requireRoles } from '../../common/guards/auth.guard';
import { ProgressReportController } from './progress-report.controller';

/**
 * Router plugin Progress Report – toàn bộ endpoint nằm dưới /progress-report.
 */
export function createProgressReportRouter(): Router {
  const router = Router();
  const admins = requireRoles('ZONE_ADMIN', 'SUPER_ADMIN');

  router.get('/templates', authenticateJwt, admins, ProgressReportController.templates);
  router.get('/preview', authenticateJwt, admins, ProgressReportController.preview);
  router.get('/export', authenticateJwt, admins, ProgressReportController.exportFile);
  router.get('/config', authenticateJwt, requireRoles('SUPER_ADMIN'), ProgressReportController.getConfig);
  router.post('/config', authenticateJwt, requireRoles('SUPER_ADMIN'), ProgressReportController.saveConfig);

  return router;
}

