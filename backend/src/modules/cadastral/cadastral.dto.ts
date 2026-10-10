import { z } from 'zod';

export const StartSurveyDto = z.object({
  phase: z.enum(['PHASE_1', 'PHASE_2']).default('PHASE_1'),
  claimReason: z.string().optional(),
});

export const RecordAbsenceDto = z.object({
  unitId: z.string().uuid().optional().nullable(),
  absenceReason: z.enum(['HOMEOWNER_ABSENT', 'LOCKED_GATE', 'REFUSED_ACCESS']),
  notes: z.string().optional().nullable(),
  photoProofUrl: z.string().optional().nullable(),
  rescheduleDate: z.string().datetime().optional().nullable(),
  ownerName: z.string().optional().nullable(),
  ownerPhone: z.string().optional().nullable(),
  surveyData: z.unknown().optional(),
});

export const UpdateFootprintDto = z.object({
  footprintPolygonGeoJson: z.record(z.string(), z.unknown()),
  measuredConstructionAreaM2: z.number().positive().optional(),
  reason: z.string().min(2, 'Lý do điều chỉnh tối thiểu 2 ký tự').optional(),
});

export const ProposeMutationDto = z.object({
  mutationType: z.enum(['SPLIT', 'MERGE', 'REDRAW']),
  sourceParcelIds: z.array(z.string().uuid()).min(1),
  surveyorNotes: z.string().min(5, 'Ghi chú đề xuất biến động tối thiểu 5 ký tự'),
  childParcels: z.array(
    z.object({
      houseNumber: z.string().optional(),
      street: z.string().optional(),
      ownerName: z.string().optional(),
      ownerPhone: z.string().optional(),
      landAreaM2: z.number().positive(),
      floorCount: z.number().int().min(1).default(1),
      polygonGeoJson: z.record(z.string(), z.unknown()),
    })
  ).min(1),
});

export const AssignTaskDto = z.object({
  parcelId: z.string().uuid(),
  surveyorId: z.string().uuid(),
  deadline: z.string().datetime(),
  notes: z.string().optional(),
});

export const ReassignTaskDto = z.object({
  newSurveyorId: z.string().uuid(),
  reason: z.string().min(3),
});

export const ApproveMutationDto = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().optional(),
});

// --- SCHEMAS CHO CĂN HỘ & PHÂN VÙNG CAD CHUNG CƯ ---

export const CadBBoxDto = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive('Chiều rộng bbox phải lớn hơn 0'),
  height: z.number().positive('Chiều cao bbox phải lớn hơn 0'),
});

export const CadPolygonPointDto = z.object({
  x: z.number(),
  y: z.number(),
});

export const CreateBuildingUnitDto = z.object({
  unitCode: z.string().trim().min(1, 'Mã số căn hộ bắt buộc').max(32, 'Mã số căn hộ tối đa 32 ký tự'),
  floorNumber: z.number().int().min(-5).max(100).default(1),
  ownerName: z.string().trim().max(128).optional().nullable(),
  ownerPhone: z.string().trim().max(32).optional().nullable(),
  ownerIdCard: z.string().trim().max(32).optional().nullable(),
  unitType: z.enum(['UNIT', 'MASTER']).default('UNIT'),
});

export const UpsertFloorPlanDto = z.object({
  floorNumber: z.number().int().min(-5, 'Tầng tối thiểu -5').max(100, 'Tầng tối đa 100'),
  floorName: z.string().trim().min(1, 'Tên tầng bắt buộc').max(64, 'Tên tầng tối đa 64 ký tự'),
  floorCode: z.string().trim().max(32).optional(),
  applicableFloors: z.array(z.number().int().min(-5).max(100)).optional(),
  cadPhotoUrl: z.string().max(10_000_000, 'Bản vẽ CAD không được vượt quá 10MB').default(''),
  cadPhotoCode: z.string().trim().max(32).optional().nullable(),
  imageWidth: z.number().int().positive().optional().nullable(),
  imageHeight: z.number().int().positive().optional().nullable(),
  scope: z.enum(['UNIT', 'MASTER', 'BOTH']).optional(),
  areaType: z.string().trim().max(64).optional().nullable(),
});

export const PartitionItemDto = z.object({
  unitCode: z.string().trim().min(1, 'Mã vị trí bắt buộc').max(32, 'Mã vị trí tối đa 32 ký tự'),
  displayCode: z.string().trim().max(32).optional().nullable(),
  floorNumber: z.number().int().min(-5).max(100).optional(),
  bbox: CadBBoxDto.optional().nullable(),
  polygon: z.array(CadPolygonPointDto).optional().nullable(),
  unitCadUrl: z.string().max(10_000_000, 'Ảnh CAD trích xuất không được vượt quá 10MB').optional().nullable(),
  unitType: z.enum(['UNIT', 'MASTER']).default('UNIT'),
});

export const SaveFloorPartitionsDto = z.object({
  floorNumber: z.number().int().min(-5).max(100),
  floorPlanId: z.string().uuid().optional().nullable(),
  partitions: z.array(PartitionItemDto).max(500, 'Tối đa 500 phân vùng mỗi lần lưu'),
});

export const AtomicSyncFloorPlanAndPartitionsDto = z.object({
  floorNumber: z.number().int().min(-5).max(100),
  floorPlan: UpsertFloorPlanDto,
  partitions: z.array(PartitionItemDto).max(500, 'Tối đa 500 phân vùng mỗi lần lưu'),
});

export const UpdateBuildingTypeDto = z.object({
  buildingType: z.enum(['STANDALONE', 'CONDOMINIUM']),
  totalUnits: z.number().int().min(1).max(5000).optional(),
});

export const DeleteFloorPlanQueryDto = z.object({
  mode: z.enum(['CLEAR_CAD', 'DELETE_FLOOR']).default('DELETE_FLOOR'),
});

export const ParcelParamDto = z.object({
  id: z.string().uuid('ID thửa đất không hợp lệ (phải là UUID)'),
});

export const ParcelFloorParamDto = z.object({
  id: z.string().uuid('ID thửa đất không hợp lệ (phải là UUID)'),
  floor: z.string().refine((val) => !isNaN(parseInt(val, 10)), {
    message: 'Số tầng (floor) phải là số nguyên hợp lệ',
  }),
});

export const ParcelUnitParamDto = z.object({
  id: z.string().uuid('ID thửa đất không hợp lệ (phải là UUID)'),
  unitId: z.string().uuid('ID căn hộ không hợp lệ (phải là UUID)'),
});
