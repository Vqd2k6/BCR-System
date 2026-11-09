/**
 * ============================================================================
 * PHOTO RESURVEY PLUGIN – ĐIỂM CẮM
 *   api.use('/photo-resurvey', createPhotoResurveyRouter());   (app.ts)
 * Report đọc lớp phủ qua resolveResurveyStateForRender + applyResurveyToViewModel (report.service.ts),
 * snapshot đóng băng qua PhotoResurveyRepository.loadRenderState (snapshot-builder.ts).
 * ============================================================================
 */
export { createPhotoResurveyRouter } from './photo-resurvey.routes';
export { applyResurveyToViewModel, resolveResurveyStateForRender } from './photo-resurvey.render';
export { PhotoResurveyRepository } from './photo-resurvey.repository';
