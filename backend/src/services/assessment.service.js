/**
 * Assessment Calculation Engine
 * Tính điểm ECS, Structural Override, VI và tra cứu ma trận BRA
 * Tham chiếu: IMPLEMENTATION_PLAN.md §3, Burland (1995), Mair et al. (1996)
 */

'use strict';

// ============================================================================
// MA TRẬN BRA (BRA MATRIX: Vulnerability × Construction Impact)
// ============================================================================
const BRA_MATRIX = {
  LOW:       { I1_LOW: 'LOW',    I2_MEDIUM: 'LOW',    I3_HIGH: 'MEDIUM',    I4_VERY_HIGH: 'HIGH'      },
  MEDIUM:    { I1_LOW: 'LOW',    I2_MEDIUM: 'MEDIUM',  I3_HIGH: 'MEDIUM',    I4_VERY_HIGH: 'HIGH'      },
  HIGH:      { I1_LOW: 'MEDIUM', I2_MEDIUM: 'MEDIUM',  I3_HIGH: 'HIGH',      I4_VERY_HIGH: 'VERY_HIGH' },
  VERY_HIGH: { I1_LOW: 'HIGH',   I2_MEDIUM: 'HIGH',    I3_HIGH: 'VERY_HIGH', I4_VERY_HIGH: 'VERY_HIGH' },
};

// Ánh xạ kết quả BRA → Hành động tối thiểu
const BRA_TO_ACTION = {
  LOW:       'BASELINE_RECORD',
  MEDIUM:    'MONITORING_SETUP',
  HIGH:      'DETAILED_INVESTIGATION',
  VERY_HIGH: 'SPECIALIST_REVIEW_HOLD_POINT',
  PENDING:   null,
};

// ============================================================================
// ENGINE 1: TÍNH ĐIỂM ECS & STRUCTURAL OVERRIDE
// ============================================================================
/**
 * Tính tổng điểm ECS (0-24) và phân loại hạng mục hiện trạng.
 * Áp dụng Structural Override bắt buộc: Nghiêm cấm hạ bậc Good/Medium
 * khi có hư hỏng kết cấu chịu lực (E1 ≥ 3) hoặc lún nghiêng nặng (E3 ≥ 3).
 *
 * @param {Object} scores - { e1, e2, e3, e4, e5, e6 } (0-4 each)
 * @returns {Object} { total, ecsClass, structuralFlag, overrideApplied, overrideReason }
 */
function calculateEcsScore({ e1 = 0, e2 = 0, e3 = 0, e4 = 0, e5 = 0, e6 = 0 }) {
  // Validate inputs
  const scores = [e1, e2, e3, e4, e5, e6];
  if (scores.some(s => typeof s !== 'number' || s < 0 || s > 4)) {
    throw new Error('Điểm ECS (E1-E6) phải là số nguyên trong khoảng 0-4.');
  }

  const total = e1 + e2 + e3 + e4 + e5 + e6;

  // Phân loại ECS class ban đầu theo điểm số
  let ecsClass;
  if (total <= 5)       ecsClass = 'GOOD';
  else if (total <= 10) ecsClass = 'MEDIUM';
  else if (total <= 16) ecsClass = 'DEFICIENT';
  else                  ecsClass = 'CRITICAL';

  // === STRUCTURAL OVERRIDE (Bắt buộc — không thể bỏ qua) ===
  let structuralFlag = 'NONE';
  let overrideApplied = false;
  let overrideReason = null;

  if (e1 >= 4 || e3 >= 4) {
    structuralFlag = 'CRITICAL';
  } else if (e1 >= 3 || e3 >= 3) {
    structuralFlag = 'HIGH';
  } else if (e1 >= 2 || e3 >= 2) {
    structuralFlag = 'MODERATE';
  } else if (e1 >= 1 || e3 >= 1) {
    structuralFlag = 'LOW';
  }

  // Kích hoạt Override khi cờ ở mức HIGH hoặc CRITICAL
  if (structuralFlag === 'HIGH' || structuralFlag === 'CRITICAL') {
    if (ecsClass === 'GOOD' || ecsClass === 'MEDIUM') {
      overrideApplied = true;
      overrideReason = `Structural Override kích hoạt: E1=${e1} (Nứt kết cấu chịu lực) / E3=${e3} (Lún/Nghiêng). ` +
                       `Điểm ECS tổng ${total} → Phân loại thực tế GOOD/MEDIUM nhưng bị nâng bắt buộc lên DEFICIENT.`;
      ecsClass = 'DEFICIENT';
    }
  }

  return { total, ecsClass, structuralFlag, overrideApplied, overrideReason };
}

// ============================================================================
// ENGINE 2: TÍNH CHỈ SỐ DỄ TỔN THƯƠNG VI (VULNERABILITY INDEX)
// ============================================================================
/**
 * Tính VI bao gồm auto-mapping V3 (từ foundation_cat) và V5 (từ ECS class).
 *
 * @param {Object} params
 *   - v1 {number} 1-4 — Công năng/Hậu quả gián đoạn
 *   - v2 {number} 1-4 — Hệ kết cấu / Tính dễ hư hỏng
 *   - foundationCat {number} 1-5 — Mức độ tin cậy thông tin móng
 *   - v4 {number} 1-4 — Tuổi đời/Cơi nới/Thay đổi tải
 *   - ecsClass {string} — Kết quả ECS class (GOOD/MEDIUM/DEFICIENT/CRITICAL)
 *   - v6 {number} 1-4 — Thiết bị nhạy cảm/Hậu quả gián đoạn
 * @returns {Object} { v3Mapped, v5Mapped, total, average, viClass, inputs }
 */
function calculateViIndex({ v1, v2, foundationCat, v4, ecsClass, v6 }) {
  // Auto-map V3 từ foundation_cat (Cat1=1 điểm tin cậy cao, Cat5=4 điểm không rõ)
  const v3 = Math.min(4, Math.ceil(foundationCat * 4 / 5));

  // Auto-map V5 từ ECS class
  const ECS_TO_V5 = { GOOD: 1, MEDIUM: 2, DEFICIENT: 3, CRITICAL: 4 };
  const v5 = ECS_TO_V5[ecsClass];
  if (!v5) throw new Error(`ECS class không hợp lệ: ${ecsClass}`);

  // Validate V1, V2, V4, V6
  const directInputs = { v1, v2, v4, v6 };
  for (const [key, val] of Object.entries(directInputs)) {
    if (typeof val !== 'number' || val < 1 || val > 4) {
      throw new Error(`${key.toUpperCase()} phải là số nguyên trong khoảng 1-4.`);
    }
  }

  const total = v1 + v2 + v3 + v4 + v5 + v6;
  const average = +(total / 6).toFixed(2);

  let viClass;
  if (average <= 1.5)      viClass = 'LOW';
  else if (average <= 2.5) viClass = 'MEDIUM';
  else if (average <= 3.25) viClass = 'HIGH';
  else                     viClass = 'VERY_HIGH';

  return {
    inputs: { v1, v2, v3Mapped: v3, v4, v5Mapped: v5, v6 },
    total,
    average,
    viClass,
    foundationCatUsed: foundationCat,
    ecsClassUsed: ecsClass,
  };
}

// ============================================================================
// ENGINE 3: TRA CỨU MA TRẬN RỦI RO BRA
// ============================================================================
/**
 * Tra cứu kết quả BRA từ ma trận V × I và đề xuất hành động tối thiểu.
 *
 * @param {string} viClass — 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
 * @param {string} impactClass — 'I1_LOW' | 'I2_MEDIUM' | 'I3_HIGH' | 'I4_VERY_HIGH' | 'PENDING'
 * @returns {Object} { braResult, recommendedAction, isPending }
 */
function lookupBraMatrix(viClass, impactClass) {
  if (impactClass === 'PENDING') {
    return {
      braResult: 'PENDING',
      recommendedAction: null,
      isPending: true,
      note: 'Chưa có dữ liệu dự báo tác động thi công được phê duyệt. Chỉ kết luận BCS/ECS/VI. BRA = Pending.',
    };
  }

  const matrixRow = BRA_MATRIX[viClass];
  if (!matrixRow) throw new Error(`VI class không hợp lệ: ${viClass}`);
  const braResult = matrixRow[impactClass];
  if (!braResult) throw new Error(`Impact class không hợp lệ: ${impactClass}`);

  return {
    braResult,
    recommendedAction: BRA_TO_ACTION[braResult],
    isPending: false,
  };
}

// ============================================================================
// API TỔNG HỢP: Tính toán toàn bộ Phase 1 trong 1 lần gọi
// ============================================================================
/**
 * Thực hiện toàn bộ chuỗi tính toán Phase 1:
 * ECS → Structural Override → VI → BRA Matrix → Recommended Action
 *
 * @param {Object} payload — Toàn bộ dữ liệu đầu vào Phase 1
 * @returns {Object} — Kết quả đầy đủ, sẵn sàng lưu vào DB
 */
function runFullPhase1Assessment(payload) {
  const {
    e1, e2, e3, e4, e5, e6,
    v1, v2, foundationCat, v4, v6,
    impactClass = 'PENDING',
  } = payload;

  // Bước 1: Tính ECS
  const ecs = calculateEcsScore({ e1, e2, e3, e4, e5, e6 });

  // Bước 2: Tính VI (tự động map V3 và V5 từ ECS)
  const vi = calculateViIndex({ v1, v2, foundationCat, v4, ecsClass: ecs.ecsClass, v6 });

  // Bước 3: Tra BRA matrix
  const bra = lookupBraMatrix(vi.viClass, impactClass);

  return {
    // ECS Results
    ecsTotal: ecs.total,
    ecsClass: ecs.ecsClass,
    structuralFlag: ecs.structuralFlag,
    ecsOverrideApplied: ecs.overrideApplied,
    ecsOverrideReason: ecs.overrideReason,
    // VI Results
    viInputs: vi.inputs,
    viTotal: vi.total,
    viAverage: vi.average,
    viClass: vi.viClass,
    // BRA Results
    braResult: bra.braResult,
    braIsPending: bra.isPending,
    recommendedAction: bra.recommendedAction,
    braPendingNote: bra.note || null,
  };
}

module.exports = {
  calculateEcsScore,
  calculateViIndex,
  lookupBraMatrix,
  runFullPhase1Assessment,
  BRA_MATRIX,
  BRA_TO_ACTION,
};
