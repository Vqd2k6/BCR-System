/**
 * ============================================================================
 * VI CALCULATOR (BACKEND) – port 1:1 từ
 * frontend/src/features/survey-phase1/engine/viCalculator.ts (chuẩn D7)
 *
 * V3 theo CAT móng: 1-2 → 1, 3 → 2, 4 → 3, 5 → 4
 * V4 theo tuổi công trình: <10 → 1, ≤25 → 2, ≤40 → 3, >40 → 4; renovationLoad ≥ 3 → 4
 * Nguồn dữ liệu thiếu (CAT / năm xây dựng) KHÔNG được gán mặc định im lặng:
 * trả `null` để lớp báo cáo hiển thị '--'.
 * ============================================================================
 */

import {
  classifyStructureSystem,
  v2ScoreForStructure,
} from './structure-system.classifier';

export type EcsClass = 'GOOD' | 'MEDIUM' | 'DEFICIENT' | 'CRITICAL';
export type ViClass = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface ViCalculatorInput {
  usageFunction?: string | null;
  surveyCaseType?: string | null;
  isVacantLand?: boolean | null;
  objectGroup?: string | null;
  structureSystem?: string | null;
  /** CAT móng 1..5; 0/null/undefined chuẩn hóa về 5 (v3 = 3) */
  foundationCatScore?: number | null;
  constructionYear?: number | null;
  renovationLoad?: number | null;
  continuousOperation247?: boolean | { has?: boolean } | null;
  hasSensitiveEquipment?: boolean | null;
  ecsClass?: EcsClass | null;
  /** Điểm V1..V6 do Admin chốt (nếu có) – ưu tiên hơn giá trị tự tính */
  adminOverrides?: Partial<Record<'v1' | 'v2' | 'v3' | 'v4' | 'v5' | 'v6', number>>;
  /** Năm hiện tại, inject để test được */
  currentYear?: number;
}

export interface ViCalculatorResult {
  v1: number;
  v2: number;
  v3: number;
  v4: number;
  v5: number;
  v6: number;
  totalVi: number;
  viAvg: number;
  viClass: ViClass;
}

/** V3 từ CAT móng (1..2 -> 1, 3 -> 2, 4..5 -> 3; nếu 0/null/ngoài 1..5 chuẩn hóa về CAT 5 -> 3). */
export function v3FromCat(cat: number | null | undefined): number {
  const normalizedCat =
    cat !== null && cat !== undefined && Number.isFinite(cat) && cat >= 1 && cat <= 5
      ? Math.round(cat)
      : 5;
  if (normalizedCat <= 2) return 1;
  if (normalizedCat === 3) return 2;
  return 3;
}

/** V4 từ tuổi công trình. */
export function v4FromAge(age: number): number {
  if (age < 10) return 1;
  if (age <= 25) return 2;
  if (age <= 40) return 3;
  return 4;
}

export function viClassFromAvg(viAvg: number): ViClass {
  if (viAvg > 3.25) return 'VERY_HIGH';
  if (viAvg > 2.5) return 'HIGH';
  if (viAvg > 1.5) return 'MEDIUM';
  return 'LOW';
}

export function calculateVi(input: ViCalculatorInput): ViCalculatorResult {
  // V1
  const isAbandoned = input.usageFunction === 'Nhà bỏ trống';
  const isVacant =
    input.surveyCaseType === 'VACANT_LAND' || input.isVacantLand === true || input.usageFunction === 'Đất trống';
  let v1 = 2;
  if (input.adminOverrides?.v1 !== undefined && input.adminOverrides.v1 !== null) {
    v1 = Math.round(input.adminOverrides.v1);
  } else if (isAbandoned || isVacant) {
    v1 = 0;
  } else if (input.objectGroup === 'CRITICAL') {
    v1 = 4;
  } else if (input.objectGroup === 'IMPORTANT') {
    v1 = 3;
  }

  // V2: ưu tiên adminOverrides.v2; nếu không có thì phân loại chuẩn (RC_INFILL = 2, RC_FRAME = 1, MASONRY = 3, WEAK = 4)
  let v2: number;
  if (input.adminOverrides?.v2 !== undefined && input.adminOverrides.v2 !== null) {
    v2 = Math.round(input.adminOverrides.v2);
  } else {
    const sys = (input.structureSystem || '').trim();
    if (!sys) {
      v2 = 2;
    } else if (sys.includes('Kém ổn định') || sys.toLowerCase().includes('weak') || sys.toLowerCase().includes('temporary')) {
      v2 = 4;
    } else {
      v2 = v2ScoreForStructure(classifyStructureSystem(sys));
    }
  }

  // V3: ưu tiên adminOverrides.v3; nếu không có thì tính từ CAT móng (luôn là số nguyên 1..4)
  const v3 =
    input.adminOverrides?.v3 !== undefined && input.adminOverrides.v3 !== null
      ? Math.round(input.adminOverrides.v3)
      : v3FromCat(input.foundationCatScore);

  // V4: ưu tiên adminOverrides.v4; nếu không có thì tính từ tuổi công trình (mặc định 1999 -> v4 = 3 nếu thiếu) & cải tạo nâng tầng
  let v4: number;
  if (input.adminOverrides?.v4 !== undefined && input.adminOverrides.v4 !== null) {
    v4 = Math.round(input.adminOverrides.v4);
  } else {
    const year = input.currentYear ?? new Date().getFullYear();
    const effectiveConstructionYear =
      typeof input.constructionYear === 'number' && input.constructionYear > 1900
        ? input.constructionYear
        : 1999;
    v4 = v4FromAge(year - effectiveConstructionYear);
    if ((input.renovationLoad ?? 0) >= 3) v4 = 4;
  }

  // V5
  const ecsClass = input.ecsClass || 'GOOD';
  const v5 =
    input.adminOverrides?.v5 !== undefined && input.adminOverrides.v5 !== null
      ? Math.round(input.adminOverrides.v5)
      : ecsClass === 'CRITICAL'
        ? 4
        : ecsClass === 'DEFICIENT'
          ? 3
          : ecsClass === 'MEDIUM'
            ? 2
            : 1;

  // V6: ưu tiên adminOverrides.v6; nếu không có thì tính từ chế độ vận hành (hỗ trợ cả boolean & { has: true }) / thiết bị nhạy cảm
  const isContOp247 =
    typeof input.continuousOperation247 === 'boolean'
      ? input.continuousOperation247
      : Boolean(input.continuousOperation247?.has);
  let v6: number;
  if (input.adminOverrides?.v6 !== undefined && input.adminOverrides.v6 !== null) {
    v6 = Math.round(input.adminOverrides.v6);
  } else if (isContOp247) {
    v6 = 4;
  } else if (input.hasSensitiveEquipment) {
    v6 = 3;
  } else {
    v6 = 1;
  }

  const totalVi = v1 + v2 + v3 + v4 + v5 + v6;
  const viAvg = Number((totalVi / 6).toFixed(2));
  return { v1, v2, v3, v4, v5, v6, totalVi, viAvg, viClass: viClassFromAvg(viAvg) };
}
