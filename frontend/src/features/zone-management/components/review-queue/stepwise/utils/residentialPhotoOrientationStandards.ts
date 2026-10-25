/**
 * Quy chuẩn hướng ảnh thống nhất cho Nhà Dân Thường (Residential Photo Orientation Standards)
 * Khớp 100% với các khuyến nghị đã ban hành tại Frontend (FE) phía Khảo Sát Viên (KSV).
 *
 * Nguyên tắc: Single Source of Truth (SSOT) dùng chung cho:
 * 1. Khâu Nhập liệu & Chụp ảnh KSV (PhotoCaptureInput, Step1PhotosSection, DefectPinningCanvas)
 * 2. Khâu Thẩm định & Kiểm duyệt Zone Admin (AuditPhotoCard, usePhotoOrientationAudit, AuditStepwiseDocumentView)
 * 3. Khâu Xuất Báo Cáo Kỹ Thuật PDF A4 (CRLG Residential Generator)
 */

export type PhotoOrientationType = 'PORTRAIT' | 'LANDSCAPE' | 'SQUARE';
export type ExpectedOrientation = 'PORTRAIT' | 'LANDSCAPE' | 'ANY';
export type HousePrimaryOrientation = 'PORTRAIT' | 'LANDSCAPE';

/**
 * Tự động xác định hướng chính của ngôi nhà (Dọc nếu nhà ống / sâu; Ngang nếu nhà rộng mặt tiền)
 */
export function resolveHousePrimaryOrientation(
  surveyData: Record<string, unknown> | null | undefined,
  photoCounts?: { portrait: number; landscape: number }
): HousePrimaryOrientation {
  if (!surveyData) return 'PORTRAIT';

  // 1. Kiểm tra cấu hình chủ động (nếu thẩm định viên đã chọn trên giao diện)
  const manual = surveyData.primaryPhotoOrientation as string | undefined;
  if (manual === 'PORTRAIT' || manual === 'LANDSCAPE') {
    return manual;
  }

  // 2. Kiểm tra kích thước mặt tiền vs chiều sâu nhà
  const rawWidth = surveyData.frontageWidth;
  const rawDepth = surveyData.lotDepth;
  const width = typeof rawWidth === 'number' ? rawWidth : parseFloat(String(rawWidth || '0'));
  const depth = typeof rawDepth === 'number' ? rawDepth : parseFloat(String(rawDepth || '0'));

  if (width > 0 && depth > 0) {
    // Nếu chiều sâu lớn hơn mặt tiền: nhà ống hẹp sâu -> Hướng Dọc (PORTRAIT)
    if (depth > width) {
      return 'PORTRAIT';
    }
    // Nếu mặt tiền lớn hơn hoặc bằng chiều sâu: nhà rộng ngang -> Hướng Ngang (LANDSCAPE)
    return 'LANDSCAPE';
  }

  // 3. Fallback: Nếu có thống kê đa số ảnh hiện có
  if (photoCounts && (photoCounts.portrait > 0 || photoCounts.landscape > 0)) {
    return photoCounts.landscape > photoCounts.portrait ? 'LANDSCAPE' : 'PORTRAIT';
  }

  // Mặc định cho nhà dân đô thị Việt Nam là dạng nhà ống (Dọc)
  return 'PORTRAIT';
}

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

/**
 * Bảng tra cứu quy chuẩn hướng ảnh Nhà Dân Thường
 * Kế thừa 100% các giá trị đã khuyến nghị trong mã nguồn FE:
 * - P-01: Step1PhotosSection.tsx:74 -> landscape (4:3)
 * - P-02: Step1PhotosSection.tsx:124 -> portrait (3:4)
 * - P-03: Step1PhotosSection.tsx:229 -> portrait (3:4)
 * - P-04: Step1PhotosSection.tsx:370 -> landscape (4:3 / 16:9)
 * - buildingTilt: Step1SettlementTiltSection.tsx:297 -> portrait (3:4)
 * - beamSagging: SaggingMonitoringSection.tsx:117 -> landscape (4:3)
 * - diffSettlement: Step1SettlementTiltSection.tsx:186 -> landscape (4:3)
 * - Z_CTX: DamageZonesSection.tsx:610 -> landscape (4:3)
 * - D_CU: DefectPinningCanvas.tsx:1567 -> landscape (4:3)
 * - MINUTES: Step9_FieldSignatures.tsx -> portrait (A4)
 */
export const RESIDENTIAL_PHOTO_RULES: Record<string, OrientationRuleDefinition> = {
  // Nhóm P: Định danh ngoại thất
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

  // Nhóm Đo Biến Dạng & Lún Nghiêng (Bước 2)
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

  // Nhóm Vùng Khảo Sát Kiến Trúc & Cấu Kiện (Bước 3 / 4)
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

  // Nhóm Khuyết Tật & Vết Nứt (Bước 5)
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
    feHint: 'Quy chuẩn bắt buộc: Chụp ảnh NGANG (4:3) để vạch chia thước đo nứt hiển thị rõ ràng trên Báo cáo A4',
    isStrict: true,
    aspectRatioHint: '4:3',
  },
  CAD_SKETCH: {
    expected: 'PORTRAIT',
    label: 'Bản vẽ CAD mặt bằng tầng',
    feHint: 'Quy chuẩn bắt buộc: Bản vẽ mặt bằng tầng luôn đặt DỌC (3:4 / A4) đồng bộ khung sơ đồ báo cáo',
    isStrict: true,
    aspectRatioHint: '3:4',
  },
  AS_BUILT_DRAWING: {
    expected: 'PORTRAIT',
    label: 'Bản vẽ hoàn công / thiết kế móng',
    feHint: 'Khuyến nghị: Chụp ảnh DỌC (3:4 / A4) để hiển thị song song 2 cột rõ nét trên trang báo cáo',
    isStrict: false,
    aspectRatioHint: 'A4',
  },

  // Nhóm Biên Bản & Pháp Lý (Bước 9)
  MINUTES: {
    expected: 'PORTRAIT',
    label: 'Biên bản khảo sát hiện trường A4',
    feHint: 'Khuyến nghị: Chụp ảnh DỌC (A4) để khi xuất PDF đọc rõ chữ và chữ ký',
    isStrict: true,
    aspectRatioHint: 'A4',
  },
  ABSENCE_NOTICE: {
    expected: 'PORTRAIT',
    label: 'Thông báo / biên bản vắng mặt',
    feHint: 'Khuyến nghị: Chụp ảnh DỌC (A4) tài liệu niêm yết tại hiện trường',
    isStrict: false,
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

/**
 * Chuẩn hóa góc xoay về phạm vi [0, 90, 180, 270]
 */
export function normalizeRotationAngle(deg: number | undefined | null): number {
  if (typeof deg !== 'number' || isNaN(deg)) return 0;
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 45 && normalized < 135) return 90;
  if (normalized >= 135 && normalized < 225) return 180;
  if (normalized >= 225 && normalized < 315) return 270;
  return 0;
}

/**
 * Lấy quy tắc hướng ảnh có thích ứng với hướng chính của ngôi nhà (cho Z, E, D)
 * - CAD luôn luôn Dọc (PORTRAIT, isStrict: true)
 * - Z, E, D khuyến khích theo hướng nhà (Dọc nếu nhà hẹp sâu, Ngang nếu nhà rộng; isStrict: false)
 */
export function getEffectiveResidentialPhotoRule(
  ruleKey: string,
  houseOrientation: HousePrimaryOrientation = 'PORTRAIT'
): OrientationRuleDefinition | undefined {
  const baseRule = RESIDENTIAL_PHOTO_RULES[ruleKey];
  if (!baseRule) return undefined;

  // CAD luôn là khổ Dọc (PORTRAIT)
  if (ruleKey === 'CAD_SKETCH') {
    return {
      ...baseRule,
      expected: 'PORTRAIT',
      isStrict: true,
    };
  }

  // Nhóm ảnh Vùng Z, Cấu kiện E, Khuyết tật D: Khuyến khích theo hướng chính của ngôi nhà
  const adaptiveKeys = new Set(['Z_CTX', 'Z_OV', 'E_COL', 'E_BEAM', 'E_SLAB', 'D_CU', 'D_CTX']);
  if (adaptiveKeys.has(ruleKey)) {
    return {
      ...baseRule,
      expected: houseOrientation,
      isStrict: false, // Luôn là Khuyến nghị (Advisory) để không khóa cứng Phê duyệt
      feHint: `Khuyến nghị theo hướng nhà (${houseOrientation === 'PORTRAIT' ? 'DỌC 3:4' : 'NGANG 4:3'})`,
    };
  }

  return baseRule;
}

/**
 * Tính toán hướng ảnh hiệu dụng (PORTRAIT | LANDSCAPE | SQUARE) sau khi cộng góc xoay
 */
export function computeEffectiveOrientation(
  naturalWidth: number,
  naturalHeight: number,
  rotation: number = 0
): PhotoOrientationType {
  const normRot = normalizeRotationAngle(rotation);
  const isSwapped = normRot === 90 || normRot === 270;
  const effectiveWidth = isSwapped ? naturalHeight : naturalWidth;
  const effectiveHeight = isSwapped ? naturalWidth : naturalHeight;
  if (effectiveWidth > effectiveHeight) return 'LANDSCAPE';
  if (effectiveHeight > effectiveWidth) return 'PORTRAIT';
  return 'SQUARE';
}

/**
 * Đánh giá hướng ảnh hiệu dụng sau khi áp dụng góc xoay
 */
export function evaluateResidentialOrientation(
  naturalWidth: number,
  naturalHeight: number,
  rotation: number = 0,
  ruleKey: string = 'ANY',
  houseOrientation: HousePrimaryOrientation = 'PORTRAIT',
  overrideExpected?: ExpectedOrientation,
  customExpectedReason?: string
): OrientationEvaluationResult {
  const normRot = normalizeRotationAngle(rotation);
  const isSwapped = normRot === 90 || normRot === 270;
  const effectiveWidth = isSwapped ? naturalHeight : naturalWidth;
  const effectiveHeight = isSwapped ? naturalWidth : naturalHeight;
  const currentOrientation = computeEffectiveOrientation(naturalWidth, naturalHeight, normRot);

  // Tra cứu quy tắc thích ứng (ưu tiên overrideExpected nếu có đồng bộ theo ảnh tổng quan cấu kiện)
  const rule = getEffectiveResidentialPhotoRule(ruleKey, houseOrientation);
  const expected: ExpectedOrientation = overrideExpected ?? (rule ? rule.expected : 'ANY');

  // Nếu quy tắc là ANY hoặc ảnh vuông 1:1 (bỏ ràng buộc ảnh vuông) -> luôn hợp lệ
  if (expected === 'ANY' || currentOrientation === 'SQUARE') {
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
    // Nếu hiện tại là Landscape mà cần Portrait -> xoay thêm 90°
    // Nếu hiện tại là Portrait mà cần Landscape -> xoay thêm 90°
    suggestedRotation = (normRot + 90) % 360;
    const reasonSuffix = customExpectedReason ? ` (${customExpectedReason})` : '';
    message = `⚠️ Ảnh đang là ${currentOrientation === 'LANDSCAPE' ? 'NGANG' : currentOrientation === 'PORTRAIT' ? 'DỌC' : 'VUÔNG'} • Khuyến nghị ${expected === 'PORTRAIT' ? 'DỌC (3:4)' : 'NGANG (4:3)'}${reasonSuffix}`;
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
