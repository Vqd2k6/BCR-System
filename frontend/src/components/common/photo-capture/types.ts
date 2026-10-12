import type { MetroWatermarkOptions } from '../../../utils/watermarkEngine';

/**
 * Thông tin kèm theo khi URL ảnh đổi từ bản tạm (blob:local://...) sang URL Cloud.
 * Các danh sách ảnh (append) dùng replacesUri để THAY bản tạm thay vì thêm trùng.
 */
export interface PhotoChangeMeta {
  replacesUri?: string;
  capturedAt?: string;
}

export interface PhotoCaptureProps {
  value: string; // Base64 or image URL
  onChange: (photoUrl: string, photoCode?: string, meta?: PhotoChangeMeta) => void;
  label?: string;
  watermarkText?: string;
  watermarkOptions?: MetroWatermarkOptions;
  photoCode?: string; // Mã ID ảnh định danh duy nhất (photoCode)
  timestamp?: Date | string | number; // Thời điểm chụp ảnh pháp lý bất biến
  fallbackDate?: Date | string | number; // Ngày khảo sát dự phòng
  allowNotApplicable?: boolean;
  isNotApplicable?: boolean;
  onToggleNotApplicable?: (na: boolean) => void;
  naReason?: string;
  onNaReasonChange?: (reason: string) => void;
  required?: boolean;
  height?: number | string;
  recommendedOrientation?: 'landscape' | 'portrait' | 'square';
  orientationHint?: string;
  allowAnnotation?: boolean;
  annotationTitle?: string;
  initialAnnotationTool?: 'ARROW' | 'PEN' | 'CIRCLE' | 'RECT' | 'TEXT';
  readOnly?: boolean;
  allowPdf?: boolean;
  pdfFloorName?: string;
}

export type UploadStatus = 'IDLE' | 'UPLOADING' | 'SUCCESS' | 'ERROR';
export type AspectRatioType = 'landscape' | 'portrait' | 'square';
