import { Router } from 'express';
import { authenticateJwt, requireRoles } from '../../common/guards/auth.guard';
import { PhotoQcController } from './photo-qc.controller';

/** Router plugin Photo QC – toàn bộ endpoint nằm dưới /photo-qc, chỉ Zone Admin / Super Admin. */
export function createPhotoQcRouter(): Router {
  const router = Router();
  const admins = requireRoles('ZONE_ADMIN', 'SUPER_ADMIN');

  router.get('/reports', authenticateJwt, admins, PhotoQcController.list);
  router.get('/reports/:id/photos', authenticateJwt, admins, PhotoQcController.detail);
  router.put('/reports/:id', authenticateJwt, admins, PhotoQcController.updateReport);
  router.put('/reports/:id/photos', authenticateJwt, admins, PhotoQcController.updatePhotos);
  router.put('/reports/:id/crop-review', authenticateJwt, admins, PhotoQcController.reviewCrops);
  router.get('/recapture-list', authenticateJwt, admins, PhotoQcController.recaptureList);

  return router;
}
