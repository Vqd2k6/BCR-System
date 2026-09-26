import { z } from 'zod';

export const CreatePhase1ReportDto = z.object({
  parcelId: z.string().uuid(),
  unitId: z.string().uuid().optional(),
  reportType: z.enum(['STANDALONE', 'BUILDING_MASTER', 'UNIT_CHILD']).default('STANDALONE'),
});


export const IdentificationPhotosDto = z.object({
  p01HouseNumberUrl: z.string().optional().nullable(),
  p01NotApplicable: z.boolean().default(false),
  p01NaReason: z.string().optional(),
  
  p02MainFacadeUrl: z.string().optional().nullable(),
  p02FacadePolygonPoints: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
  p02FloorSplitLines: z.array(z.object({ floor: z.string(), y: z.number() })).optional(),
  p02Dimensions: z.record(z.string()).optional(),
  p02NotApplicable: z.boolean().default(false),
  p02NaReason: z.string().optional(),
  
  p03SideRearUrl: z.string().optional().nullable(),
  p03NotApplicable: z.boolean().default(false),
  
  p04ContextStreetUrl: z.string().optional().nullable(),
  p04NotApplicable: z.boolean().default(false),
});

export function normalizeStructuralSystem(val?: any): string {
  if (!val) return 'KHUNG_BTCT_CHIU_LUC';
  const str = String(val).trim().toUpperCase();

  // 1. Kiểm tra bê tông cốt thép trước (tránh chữ "thép" trong "bê tông cốt thép" bị map nhầm sang thép)
  if (
    str.includes('RC') ||
    str.includes('BTCT') ||
    str.includes('BÊ TÔNG') ||
    str.includes('BE TONG') ||
    str.includes('KHUNG_BTCT')
  ) {
    return 'KHUNG_BTCT_CHIU_LUC';
  }

  // 2. Kết cấu thép
  if (
    str.includes('STEEL') ||
    str.includes('THÉP') ||
    str.includes('THEP') ||
    str.includes('TIỀN CHẾ') ||
    str.includes('KET_CAU_THEP')
  ) {
    return 'KET_CAU_THEP';
  }

  // 3. Tường gạch chịu lực
  if (
    str.includes('MASONRY') ||
    str.includes('GẠCH') ||
    str.includes('GACH') ||
    str.includes('TUONG_GACH')
  ) {
    return 'TUONG_GACH_CHIU_LUC';
  }

  // 4. Nhà gỗ
  if (
    str.includes('WOOD') ||
    str.includes('GỖ') ||
    str.includes('GO') ||
    str.includes('NHA_GO')
  ) {
    return 'NHA_GO';
  }

  // 5. Kết cấu hỗn hợp
  if (
    str.includes('MIXED') ||
    str.includes('HỖN HỢP') ||
    str.includes('HON HOP') ||
    str.includes('KET_CAU_HON_HOP')
  ) {
    return 'KET_CAU_HON_HOP';
  }

  return 'KHUNG_BTCT_CHIU_LUC';
}

export function normalizeFoundationCategory(val?: any): string {
  if (!val) return 'CAT_2_MONG_DON_BTCT';
  const str = String(val).trim().toUpperCase();

  // 1. Không xác định / Chưa rõ (Cat 5)
  if (
    str.includes('UNKNOWN') ||
    str.includes('KHÔNG RÕ') ||
    str.includes('KHONG RO') ||
    str.includes('KHÔNG XÁC ĐỊNH') ||
    str.includes('KHONG XAC DINH') ||
    str.includes('CHƯA RÕ') ||
    str.includes('CHUA RO') ||
    str.includes('CAT 5') ||
    str.includes('CAT_5') ||
    str.includes('CAT5')
  ) {
    return 'CAT_5_KHONG_XAC_DINH';
  }

  // 2. Móng cọc (Cat 4: PC, CIP, Cọc ép, Cọc khoan nhồi)
  if (
    str.includes('PC') ||
    str.includes('CIP') ||
    str.includes('CỌC') ||
    str.includes('COC') ||
    str.includes('PILE') ||
    str.includes('CAT 4') ||
    str.includes('CAT_4') ||
    str.includes('CAT4')
  ) {
    return 'CAT_4_MONG_COC_BTCT';
  }

  // 3. Móng nông gia cố / Cừ tràm (Cat 1)
  if (
    str.includes('WOOD') ||
    str.includes('CỪ TRÀM') ||
    str.includes('CU TRAM') ||
    str.includes('GIA CỐ') ||
    str.includes('GIA CO') ||
    str.includes('CAT 1') ||
    str.includes('CAT_1') ||
    str.includes('CAT1')
  ) {
    return 'CAT_1_MONG_NONG_GIA_CO';
  }

  // 4. Móng băng / Móng bè (Cat 3)
  if (
    str.includes('BĂNG') ||
    str.includes('BANG') ||
    str.includes('BÈ') ||
    str.includes('BE') ||
    str.includes('STRIP') ||
    str.includes('RAFT') ||
    str.includes('MAT') ||
    str.includes('CAT 3') ||
    str.includes('CAT_3') ||
    str.includes('CAT3')
  ) {
    return 'CAT_3_MONG_BANG_BTCT';
  }

  // 5. Móng đơn / Nông thông thường (Cat 2: Shallow, Móng đơn, Pad)
  if (
    str.includes('SHALLOW') ||
    str.includes('MÓNG NÔNG') ||
    str.includes('MONG NONG') ||
    str.includes('MÓNG ĐƠN') ||
    str.includes('MONG DON') ||
    str.includes('ĐƠN') ||
    str.includes('DON') ||
    str.includes('PAD') ||
    str.includes('ISOLATED') ||
    str.includes('CAT 2') ||
    str.includes('CAT_2') ||
    str.includes('CAT2')
  ) {
    return 'CAT_2_MONG_DON_BTCT';
  }

  return 'CAT_2_MONG_DON_BTCT';
}

export const BuildingSpecsDto = z.object({
  buildingName: z.string().optional(),
  buildingGrade: z.enum(['GENERAL', 'IMPORTANT', 'CRITICAL']).default('GENERAL'),
  adjacentBuildings: z.string().optional(),
  structuralSystem: z.preprocess(
    (val) => normalizeStructuralSystem(val),
    z.enum([
      'KHUNG_BTCT_CHIU_LUC',
      'TUONG_GACH_CHIU_LUC',
      'KET_CAU_THEP',
      'NHA_GO',
      'KET_CAU_HON_HOP',
    ]).default('KHUNG_BTCT_CHIU_LUC')
  ),
  floorCount: z.number().int().min(1).default(1),
  basementCount: z.number().int().min(0).default(0),
  foundationCategory: z.preprocess(
    (val) => normalizeFoundationCategory(val),
    z.enum([
      'CAT_1_MONG_NONG_GIA_CO',
      'CAT_2_MONG_DON_BTCT',
      'CAT_3_MONG_BANG_BTCT',
      'CAT_4_MONG_COC_BTCT',
      'CAT_5_KHONG_XAC_DINH',
    ]).default('CAT_2_MONG_DON_BTCT')
  ),
  foundationSource: z.string().optional().nullable(),
  constructionAreaM2: z.number().optional().nullable(),
  buildingHeightM: z.number().optional().nullable(),
  yearOfConstruction: z.number().int().optional().nullable(),
  isYearEstimated: z.boolean().default(false),
  
  // Historical E5
  extendedOrRenovated: z.boolean().default(false),
  previousSettlementOrTilt: z.boolean().default(false),
  fireOrAccident: z.boolean().default(false),
  sensitiveEquipmentPresent: z.boolean().default(false),
  historyDetails: z.string().optional(),
  e5HistoryScore: z.number().int().min(0).max(4).default(0),
});

export const CreateDamageZoneDto = z.object({
  zoneCode: z.string().default('Z-01'),
  floorName: z.string().min(1),
  roomName: z.string().min(1),
  componentType: z.enum(['WALL', 'BEAM', 'COLUMN', 'SLAB', 'FLOOR', 'STAIRS']).default('WALL'),
  wallMaterial: z.string().optional(),
  functionalImpactRepairNeeded: z.boolean().default(false),
  burlandGrade: z.number().int().min(0).max(5).default(0),
  ctxPhotoUrl: z.string().min(1, 'Ảnh bối cảnh Photo CTX bắt buộc phải có'),
  notes: z.string().optional(),
});

export const CreateDefectItemDto = z.object({
  defectCode: z.string().default('D-01'),
  pinX: z.number().min(0).max(100),
  pinY: z.number().min(0).max(100),
  screeningCategory: z.string().min(1),
  defectType: z.string().min(1),
  crackDirection: z.string().optional(),
  widthMaxMm: z.number().nonnegative(),
  lengthMm: z.number().nonnegative(),
  activityState: z.enum(['U', 'S', 'A']).default('U'),
  materialDegradationE4: z.number().int().min(0).max(4).default(0),
  structuralSignificanceE2: z.number().int().min(0).max(4).default(0),
  hasScaleCard: z.boolean().default(true),
  isStructuralCritical: z.boolean().default(false),
  cuPhotoUrl: z.string().min(1, 'Ảnh cận cảnh Photo CU bắt buộc phải có'),
});

export const DeformationDto = z.object({
  tiltAngleX: z.number().default(0),
  tiltAngleY: z.number().default(0),
  tiltDirection: z.string().optional(),
  floorSlopeRatio: z.number().default(0),
  beamDeflectionMm: z.number().default(0),
  measurementMethod: z.string().default('LASER_LEVEL'),
  measurementReliability: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
});

export const SubmitPhase1ReportDto = z.object({
  ownerRemarks: z.string().optional(),
  surveyorSignatureUrl: z.string().optional(),
  ownerSignatureUrl: z.string().optional(),
  summaryConclusions: z.string().optional(),
  engineeringRecommendations: z.string().optional(),
  houseNumber: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  ownerName: z.string().optional().nullable(),
  ownerPhone: z.string().optional().nullable(),
  constructionAreaM2: z.number().optional().nullable(),
  surveyDataJson: z.any().optional(),
});

// Phase 2 DTOs
export const CreatePhase2ReportDto = z.object({
  parcelId: z.string().uuid(),
  phase1ReportId: z.string().uuid(),
  workSection: z.string().optional(),
  surveyLevel: z.enum(['L2_A', 'L2_B', 'L2_C']).default('L2_B'),
  witnessMembers: z.string().optional(),
});

export const VerifyPhase2DefectDto = z.object({
  phase2WidthMm: z.number().nonnegative(),
  phase2LengthMm: z.number().nonnegative(),
  evolutionStatus: z.enum(['STABLE', 'WIDENED', 'LENGTHENED', 'NEW_RECORDED', 'REPAIRED']),
  cuPhotoUrl: z.string().optional(),
});

export const SubmitPhase2ReportDto = z.object({
  ownerRemarks: z.string().optional(),
  surveyorSignatureUrl: z.string().optional(),
  ownerSignatureUrl: z.string().optional(),
  contractorRepSignatureUrl: z.string().optional(),
  thirdPartyRepSignatureUrl: z.string().optional(),
  witnessSignatureUrl: z.string().optional(),
  phase2Conclusion: z.string().optional(),
  compensationVerdict: z.string().optional(),
});
