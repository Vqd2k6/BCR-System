import { z } from 'zod';

export const StartSurveyDto = z.object({
  phase: z.enum(['PHASE_1', 'PHASE_2']).default('PHASE_1'),
  claimReason: z.string().optional(),
});

export const RecordAbsenceDto = z.object({
  absenceReason: z.enum(['HOMEOWNER_ABSENT', 'LOCKED_GATE', 'REFUSED_ACCESS']),
  notes: z.string().optional().nullable(),
  photoProofUrl: z.string().optional().nullable(),
  rescheduleDate: z.string().datetime().optional().nullable(),
});

export const UpdateFootprintDto = z.object({
  footprintPolygonGeoJson: z.any(),
  measuredConstructionAreaM2: z.number().positive().optional(),
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
      polygonGeoJson: z.any(),
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
