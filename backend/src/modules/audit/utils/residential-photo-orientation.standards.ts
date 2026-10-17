/**
 * Quy chuẩn hướng ảnh thống nhất cho Nhà Dân Thường (Residential Photo Orientation Standards) - Backend Mirror
 * Khớp 100% với các khuyến nghị đã ban hành tại Frontend (FE) phía Khảo Sát Viên (KSV).
 */

export type PhotoOrientationType = 'PORTRAIT' | 'LANDSCAPE' | 'SQUARE';
export type ExpectedOrientation = 'PORTRAIT' | 'LANDSCAPE' | 'ANY';

export interface OrientationRuleDefinition {
  expected: ExpectedOrientation;
  label: string;
  feHint: string;
  isStrict: boolean;
  aspectRatioHint: '3:4' | '4:3' | '16:9' | 'A4' | 'ANY';
}

export interface OrientationEvaluationResult {
  isValid: boolean;
  currentOrientation: PhotoOrientationType;
  expected: ExpectedOrientation;
  effectiveWidth: number;
  effectiveHeight: number;
  effectiveRotation: number; // 0, 90, 180, 270
  suggestedRotation?: number; // 90 hoặc 270 để đưa về đúng hướng
  message: string;
}

export const RESIDENTIAL_PHOTO_RULES: Record<string, OrientationRuleDefinition> = {
  photoP01: {
    expected: 'LANDSCAPE',
    label: 'P-01: Biển số nhà & cổng chính',
    feHint: 'Khuyến nghị: Chụp ảnh NGANG (4:3) để lấy trọn vẹn biển số',
    isStrict: false,
    aspectRatioHint: '4:3',
  },
  photoP02: {
    expected: 'PORTRAIT',
    label: 'P-02: Mặt đứng chính & phân tầng',
    feHint: 'Khuyến nghị: Chụp ảnh DỌC (3:4) để bao quát toàn bộ chiều cao công trình từ vỉa hè lên mái',
    isStrict: true,
    aspectRatioHint: '3:4',
  },
  photoP03: {
    expected: 'PORTRAIT',
    label: 'P-03: Mặt bên & hẻm hông',
    feHint: 'Khuyến nghị: Chụp ảnh DỌC (3:4) để lấy chiều cao khối hông',
    isStrict: true,
    aspectRatioHint: '3:4',
  },
  photoP04: {
    expected: 'LANDSCAPE',
    label: 'P-04: Mặt đường & vỉa hè',
    feHint: 'Khuyến nghị: Chụp ảnh NGANG (16:9 / 4:3) góc rộng bao quát cả dãy phố và đường trước nhà',
    isStrict: true,
    aspectRatioHint: '4:3',
  },
  vacantLand: {
    expected: 'LANDSCAPE',
    label: 'Ảnh hiện trạng đất trống',
    feHint: 'Khuyến nghị: Chụp ảnh NGANG (4:3) bao quát ranh đất',
    isStrict: false,
    aspectRatioHint: '4:3',
  },
  underConstruction: {
    expected: 'PORTRAIT',
    label: 'Ảnh công trình đang xây dựng',
    feHint: 'Khuyến nghị: Chụp ảnh DỌC (3:4) lấy chiều cao công trình',
    isStrict: false,
    aspectRatioHint: '3:4',
  },
  buildingTilt: {
    expected: 'PORTRAIT',
    label: 'Ảnh đo độ nghiêng thân nhà',
    feHint: 'Khuyến nghị: Chụp ảnh DỌC (3:4) theo trục rọi dây dọi thân nhà',
    isStrict: true,
    aspectRatioHint: '3:4',
  },
  beamSagging: {
    expected: 'LANDSCAPE',
    label: 'Ảnh đo độ võng dầm sàn',
    feHint: 'Khuyến nghị: Chụp ảnh NGANG (4:3) theo khẩu độ nhịp dầm',
    isStrict: true,
    aspectRatioHint: '4:3',
  },
  diffSettlement: {
    expected: 'LANDSCAPE',
    label: 'Ảnh lún lệch chân tường',
    feHint: 'Khuyến nghị: Chụp ảnh NGANG (4:3) theo chân tường tiếp giáp nền',
    isStrict: false,
    aspectRatioHint: '4:3',
  },
  abnormalCase: {
    expected: 'LANDSCAPE',
    label: 'Ảnh hiện trạng bất thường / ngoại lệ',
    feHint: 'Khuyến nghị: Chụp ảnh NGANG (4:3) bao quát hiện tượng',
    isStrict: false,
    aspectRatioHint: '4:3',
  },
  Z_CTX: {
    expected: 'LANDSCAPE',
    label: 'Bối cảnh vùng khảo sát (Z_CTX)',
    feHint: 'Khuyến nghị: Chụp ảnh NGANG (4:3) bao quát mảng tường phòng',
    isStrict: true,
    aspectRatioHint: '4:3',
  },
  Z_OV: {
    expected: 'LANDSCAPE',
    label: 'Ảnh tổng quan tầng / không gian',
    feHint: 'Khuyến nghị: Chụp ảnh NGANG (4:3) toàn cảnh mặt bằng tầng',
    isStrict: false,
    aspectRatioHint: '4:3',
  },
  E_COL: {
    expected: 'PORTRAIT',
    label: 'Ảnh cột bê tông cốt thép',
    feHint: 'Khuyến nghị: Chụp ảnh DỌC (3:4) theo thân cột đứng',
    isStrict: true,
    aspectRatioHint: '3:4',
  },
  E_BEAM: {
    expected: 'LANDSCAPE',
    label: 'Ảnh dầm bê tông cốt thép',
    feHint: 'Khuyến nghị: Chụp ảnh NGANG (4:3) theo trục dầm trần',
    isStrict: true,
    aspectRatioHint: '4:3',
  },
  E_SLAB: {
    expected: 'LANDSCAPE',
    label: 'Ảnh sàn / trần bê tông',
    feHint: 'Khuyến nghị: Chụp ảnh NGANG (4:3) theo mặt phẳng sàn',
    isStrict: false,
    aspectRatioHint: '4:3',
  },
  D_CTX: {
    expected: 'LANDSCAPE',
    label: 'Ảnh bối cảnh vị trí khuyết tật (D_CTX)',
    feHint: 'Khuyến nghị: Chụp ảnh NGANG (4:3) định vị vết nứt',
    isStrict: false,
    aspectRatioHint: '4:3',
  },
  D_CU: {
    expected: 'LANDSCAPE',
    label: 'Ảnh cận cảnh vết nứt & thước đo (D_CU)',
    feHint: 'Khuyến nghị: Xoay ngang điện thoại (4:3) để chụp rõ toàn bộ vết nứt cùng thước đo tỷ lệ',
    isStrict: false,
    aspectRatioHint: '4:3',
  },
  MINUTES: {
    expected: 'PORTRAIT',
    label: 'Biên bản khảo sát hiện trường A4',
    feHint: 'Khuyến nghị: Chụp ảnh DỌC (A4) để khi xuất PDF đọc rõ chữ và chữ ký',
    isStrict: true,
    aspectRatioHint: 'A4',
  },
  SIGNATURE: {
    expected: 'LANDSCAPE',
    label: 'Chữ ký điện tử 3 bên',
    feHint: 'Khuyến nghị: Ký theo phương ngang',
    isStrict: false,
    aspectRatioHint: 'ANY',
  },
};

export function normalizeRotationAngle(deg: number | undefined | null): number {
  if (typeof deg !== 'number' || isNaN(deg)) return 0;
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 45 && normalized < 135) return 90;
  if (normalized >= 135 && normalized < 225) return 180;
  if (normalized >= 225 && normalized < 315) return 270;
  return 0;
}

export function evaluateResidentialOrientation(
  naturalWidth: number,
  naturalHeight: number,
  rotation: number = 0,
  ruleKey: string = 'ANY'
): OrientationEvaluationResult {
  const normRot = normalizeRotationAngle(rotation);
  const isSwapped = normRot === 90 || normRot === 270;
  const effectiveWidth = isSwapped ? naturalHeight : naturalWidth;
  const effectiveHeight = isSwapped ? naturalWidth : naturalHeight;

  let currentOrientation: PhotoOrientationType = 'SQUARE';
  if (effectiveWidth > effectiveHeight * 1.08) {
    currentOrientation = 'LANDSCAPE';
  } else if (effectiveHeight > effectiveWidth * 1.08) {
    currentOrientation = 'PORTRAIT';
  }

  const rule = RESIDENTIAL_PHOTO_RULES[ruleKey];
  const expected: ExpectedOrientation = rule ? rule.expected : 'ANY';

  if (expected === 'ANY') {
    return {
      isValid: true,
      currentOrientation,
      expected,
      effectiveWidth,
      effectiveHeight,
      effectiveRotation: normRot,
      message: `Ảnh hợp lệ (${currentOrientation === 'PORTRAIT' ? 'Dọc' : currentOrientation === 'LANDSCAPE' ? 'Ngang' : 'Vuông'})`,
    };
  }

  const isValid = currentOrientation === expected;
  let suggestedRotation: number | undefined;
  let message = '';

  if (isValid) {
    message = `✓ Ảnh đúng chuẩn ${expected === 'PORTRAIT' ? 'DỌC (3:4)' : 'NGANG (4:3)'}`;
  } else {
    suggestedRotation = (normRot + 90) % 360;
    message = `⚠️ Ảnh đang là ${currentOrientation === 'LANDSCAPE' ? 'NGANG' : currentOrientation === 'PORTRAIT' ? 'DỌC' : 'VUÔNG'} • Quy chuẩn báo cáo yêu cầu ${expected === 'PORTRAIT' ? 'DỌC (3:4)' : 'NGANG (4:3)'}`;
  }

  return {
    isValid,
    currentOrientation,
    expected,
    effectiveWidth,
    effectiveHeight,
    effectiveRotation: normRot,
    suggestedRotation,
    message,
  };
}
