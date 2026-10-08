import { MetroWatermarkOptions } from '../../../utils/watermarkEngine';

export interface PhotoCaptureProps {
  value: string; // Base64 or image URL
  onChange: (photoUrl: string, photoCode?: string) => void;
  label?: string;
  watermarkText?: string;
  watermarkOptions?: MetroWatermarkOptions;
  photoCode?: string; // Mã ID ảnh định danh duy nhất (photoCode)
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
