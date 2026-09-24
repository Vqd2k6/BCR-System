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

export const BuildingSpecsDto = z.object({
  buildingName: z.string().optional(),
  buildingGrade: z.enum(['GENERAL', 'IMPORTANT', 'CRITICAL']).default('GENERAL'),
  adjacentBuildings: z.string().optional(),
  structuralSystem: z.enum([
    'KHUNG_BTCT_CHIU_LUC',
    'TUONG_GACH_CHIU_LUC',
    'KET_CAU_THEP',
    'NHA_GO',
    'KET_CAU_HON_HOP',
  ]).default('KHUNG_BTCT_CHIU_LUC'),
  floorCount: z.number().int().min(1).default(1),
  basementCount: z.number().int().min(0).default(0),
  foundationCategory: z.enum([
    'CAT_1_MONG_NONG_GIA_CO',
    'CAT_2_MONG_DON_BTCT',
    'CAT_3_MONG_BANG_BTCT',
    'CAT_4_MONG_COC_BTCT',
    'CAT_5_KHONG_XAC_DINH',
  ]).default('CAT_2_MONG_DON_BTCT'),
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
