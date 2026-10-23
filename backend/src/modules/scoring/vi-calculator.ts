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
  /** CAT móng 1..5; null/undefined = chưa xác định */
  foundationCatScore?: number | null;
  constructionYear?: number | null;
  renovationLoad?: number | null;
  continuousOperation247?: boolean | null;
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
  /** null khi chưa có CAT */
  v3: number | null;
  /** null khi chưa có năm xây dựng và không có cơi nới nặng */
  v4: number | null;
  v5: number;
  v6: number;
  /** null nếu thiếu V3 hoặc V4 (chưa đủ dữ liệu để kết luận) */
  totalVi: number | null;
  viAvg: number | null;
  viClass: ViClass | null;
}

/** V3 từ CAT móng. CAT ngoài 1..5 hoặc null → null (không đoán). */
export function v3FromCat(cat: number | null | undefined): number | null {
  if (cat === null || cat === undefined || !Number.isInteger(cat) || cat < 1 || cat > 5) return null;
  if (cat <= 2) return 1;
  if (cat === 3) return 2;
  if (cat === 4) return 3;
  return 4;
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
    v1 = input.adminOverrides.v1;
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
    v2 = input.adminOverrides.v2;
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

  // V3: ưu tiên adminOverrides.v3; nếu không có thì tính từ CAT móng
  const v3 =
    input.adminOverrides?.v3 !== undefined && input.adminOverrides.v3 !== null
      ? input.adminOverrides.v3
      : v3FromCat(input.foundationCatScore);

  // V4: ưu tiên adminOverrides.v4; nếu không có thì tính từ tuổi công trình & cải tạo nâng tầng
  let v4: number | null =
    input.adminOverrides?.v4 !== undefined && input.adminOverrides.v4 !== null
      ? input.adminOverrides.v4
      : null;
  if (v4 === null) {
    const year = input.currentYear ?? new Date().getFullYear();
    if (typeof input.constructionYear === 'number' && input.constructionYear > 1900) {
      v4 = v4FromAge(year - input.constructionYear);
    }
    if ((input.renovationLoad ?? 0) >= 3) v4 = 4;
  }

  // V5
  const ecsClass = input.ecsClass || 'GOOD';
  const v5 =
    input.adminOverrides?.v5 !== undefined && input.adminOverrides.v5 !== null
      ? input.adminOverrides.v5
      : ecsClass === 'CRITICAL'
        ? 4
        : ecsClass === 'DEFICIENT'
          ? 3
          : ecsClass === 'MEDIUM'
            ? 2
            : 1;

  // V6: ưu tiên adminOverrides.v6; nếu không có thì tính từ chế độ vận hành / thiết bị nhạy cảm
  let v6: number;
  if (input.adminOverrides?.v6 !== undefined && input.adminOverrides.v6 !== null) {
    v6 = input.adminOverrides.v6;
  } else if (input.continuousOperation247) {
    v6 = 4;
  } else if (input.hasSensitiveEquipment) {
    v6 = 3;
  } else {
    v6 = 1;
  }

  if (v3 === null || v4 === null) {
    return { v1, v2, v3, v4, v5, v6, totalVi: null, viAvg: null, viClass: null };
  }
  const totalVi = v1 + v2 + v3 + v4 + v5 + v6;
  const viAvg = Number((totalVi / 6).toFixed(2));
  return { v1, v2, v3, v4, v5, v6, totalVi, viAvg, viClass: viClassFromAvg(viAvg) };
}
