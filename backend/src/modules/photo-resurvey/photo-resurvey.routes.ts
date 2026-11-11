import { Router } from 'express';
import { authenticateJwt, requireRoles } from '../../common/guards/auth.guard';
import { PhotoResurveyController } from './photo-resurvey.controller';

/**
 * Router plugin Khảo sát bổ sung (chụp lại ảnh ngoài nhà dân) – mọi endpoint dưới /photo-resurvey.
 * Đọc: KSV + Admin (lọc theo phân khu trong service). Chụp/nộp: KSV. Duyệt/từ chối: Zone Admin / Super Admin.
 */
export function createPhotoResurveyRouter(): Router {
  const router = Router();
  const anyone = requireRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN');
  const surveyor = requireRoles('SURVEYOR');
  const admins = requireRoles('ZONE_ADMIN', 'SUPER_ADMIN');

  router.get('/tasks', authenticateJwt, anyone, PhotoResurveyController.tasks);
  router.get('/reports/:reportId', authenticateJwt, anyone, PhotoResurveyController.view);
  router.post('/reports/:reportId/session', authenticateJwt, surveyor, PhotoResurveyController.start);

  router.post('/sessions/:sessionId/photos', authenticateJwt, surveyor, PhotoResurveyController.upload);
  router.post('/sessions/:sessionId/na', authenticateJwt, surveyor, PhotoResurveyController.markNa);
  router.put('/sessions/:sessionId/items/:itemId/rotation', authenticateJwt, surveyor, PhotoResurveyController.rotateItem);
  // Bỏ một thao tác của phiên nháp = soft delete (ảnh R2 giữ nguyên).
  router.delete('/sessions/:sessionId/items/:itemId', authenticateJwt, surveyor, PhotoResurveyController.removeItem);
  router.post('/sessions/:sessionId/submit', authenticateJwt, surveyor, PhotoResurveyController.submit);

  router.post('/sessions/:sessionId/approve', authenticateJwt, admins, PhotoResurveyController.approve);
  router.post('/sessions/:sessionId/reject', authenticateJwt, admins, PhotoResurveyController.reject);
  // Thẩm định đưa vào / bỏ qua / hoàn tác từng mục của phiên đã duyệt.
  router.put('/sessions/:sessionId/apply', authenticateJwt, admins, PhotoResurveyController.apply);

  return router;
}
