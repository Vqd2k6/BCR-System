/**
 * ============================================================================
 * REPORT SNAPSHOT SCHEMA (V3) – Hợp đồng dữ liệu bất biến tại thời điểm APPROVE
 *
 * - Điểm ECS / VI / BRA trong báo cáo CHỈ lấy từ snapshot này (D3).
 * - Full Immutable Snapshot: Đóng băng toàn bộ 100% dữ liệu (địa chỉ, SĐT, ranh đất,
 *   kết cấu, điểm số) để ngắt hoàn toàn việc đọc động từ bảng parcels khi xuất báo cáo.
 * - Thiếu dữ liệu → null (báo cáo in '--'), tuyệt đối không có giá trị mặc định im lặng.
 * - `contentSha256` = SHA-256 của nội dung chốt (key-sorted JSON).
 * ============================================================================
 */

import { z } from 'zod';

const nullableScore = z.number().finite().nullable();

export const EcsSnapshotSchema = z.object({
  e1: nullableScore,
  e2: nullableScore,
  e3: nullableScore,
  e4: nullableScore,
  e5: nullableScore,
  e6: nullableScore,
  total: nullableScore,
  ecsClass: z.enum(['GOOD', 'MEDIUM', 'DEFICIENT', 'CRITICAL']).nullable(),
  source: z.enum(['ADMIN_OVERRIDE', 'SURVEY_JSON', 'RISK_CARD', 'UNASSESSED']),
});

export const ViSnapshotSchema = z.object({
  v1: nullableScore,
  v2: nullableScore,
  v3: nullableScore,
  v4: nullableScore,
  v5: nullableScore,
  v6: nullableScore,
  total: nullableScore,
  avg: nullableScore,
  viClass: z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).nullable(),
  /** CAT móng 1..5; null = chưa xác định */
  foundationCat: z.number().int().min(1).max(5).nullable(),
  source: z.enum(['ADMIN_OVERRIDE', 'SURVEY_JSON', 'CALCULATED', 'UNASSESSED']),
});

export const FrozenParcelSchema = z.object({
  houseNumber: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  ward: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  ownerPhone: z.string().nullable().optional(),
  landAreaM2: z.union([z.number(), z.string()]).nullable().optional(),
  constructionAreaM2: z.union([z.number(), z.string()]).nullable().optional(),
  floorCount: z.number().nullable().optional(),
  buildingType: z.string().nullable().optional(),
  cadastralCode: z.string().nullable().optional(),
  projectParcelCode: z.string().nullable().optional(),
  distanceToCenterlineM: z.number().nullable().optional(),
  parcelSideAm: z.number().nullable().optional(),
  parcelSideBm: z.number().nullable().optional(),
  polygonGeojson: z.unknown().optional(),
});

export const ReportSnapshotSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  reportId: z.string().uuid(),
  approvedAt: z.string(),
  approvedByUserId: z.string().uuid(),
  ecs: EcsSnapshotSchema,
  vi: ViSnapshotSchema,
  burlandMaxGrade: z.number().int().min(0).max(5).nullable(),
  contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  exportRevision: z.number().int().nonnegative().optional(),
  frozenParcel: FrozenParcelSchema.optional(),
  frozenSurveyDataJson: z.record(z.unknown()).optional(),
  frozenReportData: z.record(z.unknown()).optional(),
});

export type EcsSnapshot = z.infer<typeof EcsSnapshotSchema>;
export type ViSnapshot = z.infer<typeof ViSnapshotSchema>;
export type FrozenParcelData = z.infer<typeof FrozenParcelSchema>;
export type ReportSnapshot = z.infer<typeof ReportSnapshotSchema>;

/** Phần điểm (chưa có hash) – đầu vào để tính contentSha256 */
export type ReportSnapshotScores = Pick<ReportSnapshot, 'ecs' | 'vi' | 'burlandMaxGrade'>;
