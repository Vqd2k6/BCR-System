import { Router } from 'express';
import { authenticateJwt, requireRoles } from '../../common/guards/auth.guard';
import { GisVisualizationController } from './gis-visualization.controller';

/** Bản đồ chuyên đề: Super Admin, Zone Admin, Guest. Khảo sát viên giữ bản đồ tác nghiệp, không gọi endpoint này. */
export function createGisVisualizationRouter(): Router {
  const router = Router();
  router.get(
    '/thematic',
    authenticateJwt,
    requireRoles('SUPER_ADMIN', 'ZONE_ADMIN', 'GUEST'),
    GisVisualizationController.getZoneThematic
  );
  return router;
}
