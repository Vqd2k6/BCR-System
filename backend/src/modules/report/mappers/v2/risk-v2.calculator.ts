/**
 * ============================================================================
 * PHƯƠNG PHÁP RỦI RO CỦA REPORT NHÀ DÂN v2 (mẫu ST01-B-0056-CC, chốt 14/11/2026)
 * Chỉ dùng trong template v2. Thẩm định (Bước 7) và cổng duyệt vẫn dùng V×I của v1.
 * Hàm thuần: cùng đầu vào luôn ra cùng kết quả; kết quả được đóng băng vào Rev v2 khi phát hành.
 *
 *  - ECS 4 mức theo bề rộng vết nứt kết cấu (ghim trên cấu kiện E) / phi kết cấu (vùng Z) + lún lệch + lộ cốt thép.
 *  - Ma trận Burland × ECS → cấp 1–4.
 *  - BRA A–E (35/25/15/15/10 = 100 điểm), ngưỡng 0–19 / 20–39 / 40–59 / ≥60 → cấp 1–4.
 *  - Cấp tổng thể = cấp bất lợi hơn giữa ma trận và BRA.
 * Thiếu dữ liệu thì không giả định (null + danh sách thiếu), không gán điểm mặc định cho số liệu pháp lý.
 * ============================================================================
 */

export type EcsV2Grade = 'GOOD' | 'MODERATE' | 'POOR' | 'DANGEROUS';
export type RiskV2Level = 1 | 2 | 3 | 4;
export type ImpactCode = 'I1' | 'I2' | 'I3' | 'I4';

export interface RiskV2DefectInput {
  /** Mã khuyết tật như v1 (D-01...). */
  code: string;
  /** Bề rộng vết nứt lớn nhất (mm); null = không phải vết nứt / không đo. */
  widthMm: number | null;
  /** Ghim trên cấu kiện chịu lực E (nguồn ELEMENT) = kết cấu; vùng Z = phi kết cấu. */
  isStructural: boolean;
  /** Bê tông vỡ, lộ / gỉ cốt thép. */
  isRebarExposure: boolean;
}

export interface RiskV2Input {
  defects: RiskV2DefectInput[];
  /** Cấp Burland lớn nhất đã thẩm định (0–5); null = chưa có. */
  burlandMaxGrade: number | null;
  /** Mục V: có bằng chứng lún lệch. */
  differentialSettlementObserved: boolean;
  /** CAT móng 1–5 (form thẩm định); null = chưa chọn. */
  foundationCat: number | null;
  /** Mã tác động I1–I4 đã thẩm định; null = thiếu cự ly. */
  impactCode: ImpactCode | null;
  /** Công năng sử dụng đã khảo sát (USAGE_OPTIONS, nguyên văn). */
  usage: string | null;
  /** Nhóm công trình GENERAL / IMPORTANT / CRITICAL. */
  objectGroup: string | null;
}

export type BraIndicator = 'A' | 'B' | 'C' | 'D' | 'E';

export interface RiskV2Result {
  ecs: {
    grade: EcsV2Grade;
    maxStructuralWidthMm: number | null;
    maxNonStructuralWidthMm: number | null;
    /** Khuyết tật quyết định cấp ECS (vết nứt rộng nhất của nhóm vượt ngưỡng), null khi Tốt. */
    governingDefectCode: string | null;
    governingIsStructural: boolean | null;
    hasRebarExposure: boolean;
    settlementObserved: boolean;
  };
  matrix: {
    /** Hàng ma trận: 0..3 = B-0..B-3, 4 = B-4/B-5; null khi chưa có Burland. */
    burlandRow: 0 | 1 | 2 | 3 | 4 | null;
    level: RiskV2Level | null;
  };
  bra: {
    scores: Record<BraIndicator, number | null>;
    total: number | null;
    level: RiskV2Level | null;
    missing: BraIndicator[];
  };
  overall: {
    level: RiskV2Level | null;
    /** Nguồn của cấp tổng thể: cấp nào bất lợi hơn (bằng nhau = BOTH). */
    source: 'MATRIX' | 'BRA' | 'BOTH' | null;
  };
}

export const BRA_MAX: Record<BraIndicator, number> = { A: 35, B: 25, C: 15, D: 15, E: 10 };

/** Ma trận Burland × ECS chép nguyên trang 6 của mẫu. Hàng: B-0, B-1, B-2, B-3, B-4/5. Cột: Tốt, TB, Kém, Nguy hiểm. */
export const BURLAND_ECS_MATRIX: ReadonlyArray<readonly [RiskV2Level, RiskV2Level, RiskV2Level, RiskV2Level]> = [
  [1, 1, 1, 2],
  [1, 1, 2, 2],
  [2, 2, 3, 3],
  [3, 3, 4, 4],
  [4, 4, 4, 4],
];

const ECS_COLUMN: Record<EcsV2Grade, 0 | 1 | 2 | 3> = { GOOD: 0, MODERATE: 1, POOR: 2, DANGEROUS: 3 };
const ECS_SCORE_B: Record<EcsV2Grade, number> = { GOOD: 0, MODERATE: 8, POOR: 17, DANGEROUS: 25 };
const BURLAND_SCORE_A = [0, 7, 14, 24, 35] as const;
const CAT_SCORE_C: Record<number, number> = { 1: 0, 2: 0, 3: 5, 4: 10, 5: 15 };
const IMPACT_SCORE_D: Record<ImpactCode, number> = { I1: 0, I2: 5, I3: 10, I4: 15 };
const GROUP_SCORE_E: Record<string, number> = { GENERAL: 3, IMPORTANT: 7, CRITICAL: 10 };

/** Ngưỡng vết nứt (mm) của ECS 4 mức. */
const MINOR_CRACK_MM = 0.3;
const STRUCTURAL_MODERATE_MM = 1;
const STRUCTURAL_POOR_MM = 2;
const NON_STRUCTURAL_MODERATE_MM = 5;
const NON_STRUCTURAL_POOR_MM = 10;

/**
 * Điểm E theo công năng (USAGE_OPTIONS của form khảo sát). Khớp theo tiền tố đã chuẩn hóa để bền với khoảng trắng/hoa thường.
 * "Khác (Nhập chi tiết...)" và công năng lạ trả null → chỉ theo nhóm công trình.
 */
const USAGE_SCORE_E: ReadonlyArray<readonly [string, number]> = [
  ['nhà bỏ trống', 0],
  ['kho hàng', 0],
  ['nhà ở gia đình', 3],
  ['chung cư', 3],
  ['cửa hàng', 3],
  ['quán ăn', 3],
  ['văn phòng', 3],
  ['khách sạn', 3],
  ['bệnh viện', 7],
  ['trường học', 7],
  ['công trình công cộng', 7],
  ['cơ sở tôn giáo', 7],
];

function normalize(value: string): string {
  return value.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function usageScoreE(usage: string | null): number | null {
  if (!usage) return null;
  const u = normalize(usage);
  const hit = USAGE_SCORE_E.find(([prefix]) => u.startsWith(prefix));
  return hit ? hit[1] : null;
}

export function objectGroupScoreE(group: string | null): number | null {
  if (!group) return null;
  return GROUP_SCORE_E[group.trim().toUpperCase()] ?? null;
}

export function braLevel(total: number): RiskV2Level {
  if (total >= 60) return 4;
  if (total >= 40) return 3;
  if (total >= 20) return 2;
  return 1;
}

function maxWidth(defects: RiskV2DefectInput[]): { width: number | null; code: string | null } {
  let width: number | null = null;
  let code: string | null = null;
  for (const d of defects) {
    if (d.widthMm === null || !Number.isFinite(d.widthMm)) continue;
    if (width === null || d.widthMm > width) {
      width = d.widthMm;
      code = d.code;
    }
  }
  return { width, code };
}

export function classifyEcsV2(input: Pick<RiskV2Input, 'defects' | 'differentialSettlementObserved'>): RiskV2Result['ecs'] {
  const structural = maxWidth(input.defects.filter((d) => d.isStructural));
  const nonStructural = maxWidth(input.defects.filter((d) => !d.isStructural));
  const ws = structural.width ?? 0;
  const wn = nonStructural.width ?? 0;
  const rebar = input.defects.find((d) => d.isRebarExposure) ?? null;
  const settlement = input.differentialSettlementObserved;

  // Vết nứt quyết định: so theo tỉ lệ với ngưỡng của nhóm để chọn nhóm vượt ngưỡng nặng hơn.
  const governing = (): { code: string | null; isStructural: boolean | null } => {
    const sRatio = ws / STRUCTURAL_MODERATE_MM;
    const nRatio = wn / NON_STRUCTURAL_MODERATE_MM;
    if (structural.code && sRatio >= nRatio) return { code: structural.code, isStructural: true };
    if (nonStructural.code) return { code: nonStructural.code, isStructural: false };
    return { code: structural.code, isStructural: structural.code ? true : null };
  };

  let grade: EcsV2Grade;
  if (ws > STRUCTURAL_POOR_MM || wn > NON_STRUCTURAL_POOR_MM || settlement) grade = 'DANGEROUS';
  else if (ws > STRUCTURAL_MODERATE_MM || wn > NON_STRUCTURAL_MODERATE_MM || rebar) grade = 'POOR';
  else if (ws > MINOR_CRACK_MM || wn > MINOR_CRACK_MM) grade = 'MODERATE';
  else grade = 'GOOD';

  const gov = grade === 'GOOD' ? { code: null, isStructural: null } : governing();
  return {
    grade,
    maxStructuralWidthMm: structural.width,
    maxNonStructuralWidthMm: nonStructural.width,
    governingDefectCode: gov.code ?? (grade === 'POOR' && rebar ? rebar.code : null),
    governingIsStructural: gov.isStructural,
    hasRebarExposure: rebar !== null,
    settlementObserved: settlement,
  };
}

export function calculateRiskV2(input: RiskV2Input): RiskV2Result {
  const ecs = classifyEcsV2(input);

  const burland =
    input.burlandMaxGrade !== null && Number.isInteger(input.burlandMaxGrade) && input.burlandMaxGrade >= 0 && input.burlandMaxGrade <= 5
      ? input.burlandMaxGrade
      : null;
  const burlandRow = burland === null ? null : (Math.min(burland, 4) as 0 | 1 | 2 | 3 | 4);
  const matrixLevel = burlandRow === null ? null : BURLAND_ECS_MATRIX[burlandRow][ECS_COLUMN[ecs.grade]];

  const usageE = usageScoreE(input.usage);
  const groupE = objectGroupScoreE(input.objectGroup);
  const scores: Record<BraIndicator, number | null> = {
    A: burlandRow === null ? null : BURLAND_SCORE_A[burlandRow],
    B: ECS_SCORE_B[ecs.grade],
    C: input.foundationCat !== null ? CAT_SCORE_C[input.foundationCat] ?? null : null,
    D: input.impactCode ? IMPACT_SCORE_D[input.impactCode] : null,
    E: usageE === null && groupE === null ? null : Math.max(usageE ?? 0, groupE ?? 0),
  };
  const missing = (Object.keys(scores) as BraIndicator[]).filter((k) => scores[k] === null);
  const total = missing.length === 0 ? (Object.values(scores) as number[]).reduce((s, v) => s + v, 0) : null;
  const level = total === null ? null : braLevel(total);

  let overallLevel: RiskV2Level | null;
  let source: RiskV2Result['overall']['source'];
  if (matrixLevel === null && level === null) {
    overallLevel = null;
    source = null;
  } else if (level === null) {
    overallLevel = matrixLevel;
    source = 'MATRIX';
  } else if (matrixLevel === null) {
    overallLevel = level;
    source = 'BRA';
  } else {
    overallLevel = (Math.max(matrixLevel, level) as RiskV2Level);
    source = matrixLevel === level ? 'BOTH' : matrixLevel > level ? 'MATRIX' : 'BRA';
  }

  return {
    ecs,
    matrix: { burlandRow, level: matrixLevel },
    bra: { scores, total, level, missing },
    overall: { level: overallLevel, source },
  };
}
