/**
 * ============================================================================
 * PHOTO QC PLUGIN – ĐIỂM CẮM
 *   api.use('/photo-qc', createPhotoQcRouter());   (app.ts)
 * Report đọc lớp phủ qua resolvePhotoQcStateForRender + applyPhotoQcToViewModel (report.service.ts),
 * snapshot đóng băng qua PhotoQcRepository.loadRenderState (snapshot-builder.ts).
 * ============================================================================
 */
export { createPhotoQcRouter } from './photo-qc.routes';
export { applyPhotoQcToViewModel, resolvePhotoQcStateForRender } from './photo-qc.render';
export { PhotoQcRepository } from './photo-qc.repository';
