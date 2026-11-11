/**
 * PHOTO QC PLUGIN (Frontend) – public API duy nhất.
 *   <PhotoQcWorkspace zoneId="ZONE_09" />   (màn rà soát ảnh, Zone Admin / Super Admin)
 * Gỡ plugin: xóa dòng nhúng + thư mục features/photo-qc.
 */
export { PhotoQcWorkspace } from './components/PhotoQcWorkspace';
export type { PhotoQcWorkspaceProps } from './components/PhotoQcWorkspace';
export { PhotoQcCropReviewModal } from './components/PhotoQcCropReviewModal';
