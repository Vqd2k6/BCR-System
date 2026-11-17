/**
 * ============================================================================
 * REGISTRY 8 LAYOUT GIS — nhãn, thang màu, phân nhóm, dòng tooltip
 * Màu ở đây là màu DỮ LIỆU tô polygon Leaflet (fillHex), không phải màu nền UI.
 * Ngưỡng bám đúng backend: tuổi theo v4FromAge (vi-calculator.ts), ECS ≤5/≤10/≤16,
 * VI 1,5/2,5/3,25, BRA ma trận V×I Bước 7 (PDF Mục VIII).
 *
 * 4 hệ màu (17/11/2026):
 * - sequential: dữ liệu thứ bậc quy mô / thời gian, 1 tông đậm dần (Năm XD, Số tầng, CAT).
 * - risk_heatmap: mức an toàn bạc hà nhạt + độ đậm thấp (lùi về nền), mức cao nóng + đậm dần (tự nổi lên).
 * - qualitative: định danh, bảng Okabe-Ito an toàn mù màu (Loại móng, Hệ kết cấu).
 * - binary: Có/Không — "Có" là màu nhấn, "Không" là nền xám nhạt (Tầng hầm).
 * ============================================================================
 */
import type { LucideIcon } from 'lucide-react';
import { Activity, Building2, CalendarClock, Gauge, Layers, Map as MapIcon, ShieldAlert, Waves } from 'lucide-react';
import type {
  GisThematicLayoutId,
  ParcelThematicMetrics,
  ThematicLayoutGroup,
  ThematicScaleType,
  ThematicSubModeId,
} from '../types';

export interface ThematicBucket {
  key: string;
  label: string;
  hex: string;
  /** Độ đậm nền riêng của nhóm; không khai báo ⇒ DEFAULT_FILL_OPACITY. */
  fillOpacity?: number;
}

export const DEFAULT_FILL_OPACITY = 0.7;

export interface ThematicScale {
  /** Kiểu thang; sequential / risk_heatmap có thanh gradient ở đầu chú giải. */
  scaleType: ThematicScaleType;
  /** Nhóm dữ liệu theo thứ tự chú giải. */
  buckets: ThematicBucket[];
  /** Mã nhóm của thửa đã có chỉ số; null ⇒ thửa này chưa có giá trị cho thang này. */
  classify: (m: ParcelThematicMetrics) => string | null;
  /** Dòng giá trị hiển thị ở tooltip; null khi chưa có. */
  valueText: (m: ParcelThematicMetrics) => string | null;
}

export interface ThematicSubMode {
  id: ThematicSubModeId;
  label: string;
}

export interface ThematicLayoutDef {
  id: GisThematicLayoutId;
  label: string;
  icon: LucideIcon;
  group: ThematicLayoutGroup;
  subModes: ThematicSubMode[];
  /** null ⇒ layout tác nghiệp WORKFLOW (tô theo trạng thái khảo sát, không dùng thang). */
  scaleFor: (subMode: ThematicSubModeId | null) => ThematicScale | null;
}

export const UNASSESSED_BUCKET: ThematicBucket = {
  key: 'UNASSESSED',
  label: 'Chưa đánh giá / chưa nộp hồ sơ',
  hex: '#94a3b8',
  fillOpacity: 0.25,
};
export const NON_BUILDING_BUCKET: ThematicBucket = {
  key: 'NON_BUILDING',
  label: 'Đất trống / Hạ tầng (phi công trình)',
  hex: '#cbd5e1',
  fillOpacity: 0.15,
};

export const LAYOUT_GROUP_LABEL: Record<ThematicLayoutGroup, string> = {
  OPERATIONAL: 'Tác nghiệp',
  CHARACTERISTICS: 'Đặc trưng công trình',
  RISK: 'Hư hỏng & Rủi ro',
};

/** Thứ tự nhóm trên bộ chọn layout. */
export const LAYOUT_GROUP_ORDER: ThematicLayoutGroup[] = ['OPERATIONAL', 'CHARACTERISTICS', 'RISK'];

export const fmt2 = (n: number): string => n.toFixed(2).replace('.', ',');

/** Thang nhiệt rủi ro dùng chung cho ECS / VI / BRA (4 mức). Burland 6 cấp khai báo riêng cùng tông. */
const RISK_LOW = { hex: '#86efac', fillOpacity: 0.38 };
const RISK_MEDIUM = { hex: '#fde047', fillOpacity: 0.62 };
const RISK_HIGH = { hex: '#fb923c', fillOpacity: 0.76 };
const RISK_VERY_HIGH = { hex: '#dc2626', fillOpacity: 0.88 };

// ─── 2. Năm xây dựng (sequential vàng kem → nâu) ────────────────────────────
export const YEAR_SCALE: ThematicScale = {
  scaleType: 'sequential',
  buckets: [
    { key: 'AGE_LT_10', label: 'Dưới 10 năm', hex: '#fef3c7', fillOpacity: 0.75 },
    { key: 'AGE_10_25', label: '10 – 25 năm', hex: '#fcd34d', fillOpacity: 0.72 },
    { key: 'AGE_26_40', label: '26 – 40 năm', hex: '#d97706', fillOpacity: 0.75 },
    { key: 'AGE_GT_40', label: 'Trên 40 năm', hex: '#92400e', fillOpacity: 0.82 },
  ],
  classify: (m) => m.yearCohort,
  valueText: (m) =>
    m.constructionYear === null
      ? null
      : `Năm XD: ${m.constructionYear}${m.isYearEstimated ? ' (ước lượng)' : ''} · ${m.buildingAge ?? '--'} năm tuổi`,
};

// ─── 3. Móng & Kết cấu (3 sub-mode) ─────────────────────────────────────────
// Định danh: Okabe-Ito. "Không rõ" dùng xám ấm đậm, khác xám lạnh của "Chưa đánh giá".
export const FOUNDATION_TYPE_SCALE: ThematicScale = {
  scaleType: 'qualitative',
  buckets: [
    { key: 'SHALLOW', label: 'Móng nông (băng / đơn / bè)', hex: '#e69f00', fillOpacity: 0.65 },
    { key: 'WOOD', label: 'Móng cừ tràm / nền gia cố', hex: '#d55e00', fillOpacity: 0.65 },
    { key: 'PRECAST_PILE', label: 'Cọc ép BTCT / cọc ly tâm', hex: '#56b4e9', fillOpacity: 0.65 },
    { key: 'BORED_PILE', label: 'Cọc khoan nhồi / Barrette', hex: '#0072b2', fillOpacity: 0.65 },
    { key: 'RAFT', label: 'Móng bè hộp tầng hầm', hex: '#009e73', fillOpacity: 0.65 },
    { key: 'OTHER', label: 'Loại móng khác', hex: '#cc79a7', fillOpacity: 0.65 },
    { key: 'UNKNOWN', label: 'Không rõ thông tin móng (đã khảo sát)', hex: '#78716c', fillOpacity: 0.45 },
  ],
  classify: (m) => m.foundationBucket,
  valueText: (m) => (m.foundationType ? `Móng: ${m.foundationType}` : null),
};

export const STRUCTURE_SCALE: ThematicScale = {
  scaleType: 'qualitative',
  buckets: [
    { key: 'RC', label: 'Khung BTCT', hex: '#0072b2', fillOpacity: 0.65 },
    { key: 'MIXED', label: 'Kết cấu hỗn hợp', hex: '#56b4e9', fillOpacity: 0.65 },
    { key: 'MASONRY', label: 'Tường gạch chịu lực', hex: '#e69f00', fillOpacity: 0.65 },
    { key: 'STEEL', label: 'Khung kết cấu thép', hex: '#009e73', fillOpacity: 0.65 },
    { key: 'SUBSTANDARD', label: 'Tạm / kém ổn định', hex: '#d55e00', fillOpacity: 0.75 },
    { key: 'OTHER', label: 'Hệ kết cấu khác', hex: '#cc79a7', fillOpacity: 0.65 },
    { key: 'UNKNOWN', label: 'Chưa rõ hệ kết cấu', hex: '#78716c', fillOpacity: 0.45 },
  ],
  classify: (m) => m.structureClass,
  valueText: (m) => (m.structureSystem ? `Kết cấu: ${m.structureSystem}` : null),
};

// Thứ bậc theo mức thiếu hồ sơ: CAT 1 (đủ) teal → CAT 5 (không có gì) đỏ.
export const FOUNDATION_CAT_SCALE: ThematicScale = {
  scaleType: 'sequential',
  buckets: [
    { key: 'CAT_1', label: 'CAT 1 – Có bản vẽ hoàn công phê duyệt', hex: '#0f766e', fillOpacity: 0.6 },
    { key: 'CAT_2', label: 'CAT 2 – Có bản vẽ thiết kế chủ nhà giữ', hex: '#5eead4', fillOpacity: 0.55 },
    { key: 'CAT_3', label: 'CAT 3 – Không bản vẽ, chủ nhà khai rõ', hex: '#fde047', fillOpacity: 0.62 },
    { key: 'CAT_4', label: 'CAT 4 – Suy luận từ số tầng & kết cấu', hex: '#fb923c', fillOpacity: 0.74 },
    { key: 'CAT_5', label: 'CAT 5 – Hoàn toàn không có dữ liệu', hex: '#dc2626', fillOpacity: 0.85 },
  ],
  classify: (m) => (m.foundationCatScore === null ? null : `CAT_${m.foundationCatScore}`),
  valueText: (m) => (m.foundationCatScore === null ? null : `Hồ sơ móng: CAT ${m.foundationCatScore} / 5`),
};

// ─── 4. Tình trạng kết cấu (ECS) ────────────────────────────────────────────
export const ECS_SCALE: ThematicScale = {
  scaleType: 'risk_heatmap',
  buckets: [
    { key: 'GOOD', label: 'Tốt (ECS 0 – 5)', ...RISK_LOW },
    { key: 'MEDIUM', label: 'Trung bình (ECS 6 – 10)', ...RISK_MEDIUM },
    { key: 'DEFICIENT', label: 'Kém (ECS 11 – 16)', ...RISK_HIGH },
    { key: 'CRITICAL', label: 'Nguy hiểm (ECS 17 – 24)', ...RISK_VERY_HIGH },
  ],
  classify: (m) => m.ecsClass,
  valueText: (m) => {
    if (!m.ecsClass) return null;
    const label = ECS_SCALE.buckets.find((b) => b.key === m.ecsClass)?.label.split(' (')[0] ?? m.ecsClass;
    return `ECS: ${m.totalEcs ?? '--'}/24 · ${label}`;
  },
};

// ─── 5. Burland ─────────────────────────────────────────────────────────────
export const BURLAND_SCALE: ThematicScale = {
  scaleType: 'risk_heatmap',
  buckets: [
    { key: 'G0', label: 'Cấp 0 – Không đáng kể', hex: '#bbf7d0', fillOpacity: 0.35 },
    { key: 'G1', label: 'Cấp 1 – Rất nhẹ', hex: '#86efac', fillOpacity: 0.42 },
    { key: 'G2', label: 'Cấp 2 – Nhẹ', hex: '#fde047', fillOpacity: 0.62 },
    { key: 'G3', label: 'Cấp 3 – Trung bình', hex: '#fb923c', fillOpacity: 0.72 },
    { key: 'G4', label: 'Cấp 4 – Nghiêm trọng', hex: '#dc2626', fillOpacity: 0.82 },
    { key: 'G5', label: 'Cấp 5 – Rất nghiêm trọng', hex: '#7f1d1d', fillOpacity: 0.9 },
  ],
  classify: (m) => (m.burlandMaxGrade === null ? null : `G${m.burlandMaxGrade}`),
  valueText: (m) => (m.burlandMaxGrade === null ? null : `Burland cục bộ lớn nhất: Cấp ${m.burlandMaxGrade}`),
};

// ─── 6. Chỉ số dễ tổn thương VI ─────────────────────────────────────────────
export const RISK_LEVEL_LABEL: Record<string, string> = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao', VERY_HIGH: 'Rất cao' };
export const VI_SCALE: ThematicScale = {
  scaleType: 'risk_heatmap',
  buckets: [
    { key: 'LOW', label: 'Thấp (VI ≤ 1,50)', ...RISK_LOW },
    { key: 'MEDIUM', label: 'Trung bình (1,51 – 2,50)', ...RISK_MEDIUM },
    { key: 'HIGH', label: 'Cao (2,51 – 3,25)', ...RISK_HIGH },
    { key: 'VERY_HIGH', label: 'Rất cao (> 3,25)', ...RISK_VERY_HIGH },
  ],
  classify: (m) => m.viClass,
  valueText: (m) =>
    m.viClass ? `VI TB: ${m.avgViScore === null ? '--' : fmt2(m.avgViScore)} · ${RISK_LEVEL_LABEL[m.viClass]}` : null,
};

// ─── 7. BRA (ma trận V×I Bước 7) — Guest Portal lấy màu biểu đồ BRA từ đây ──
export const BRA_SCALE: ThematicScale = {
  scaleType: 'risk_heatmap',
  buckets: [
    { key: 'LOW', label: 'Rủi ro thấp', ...RISK_LOW },
    { key: 'MEDIUM', label: 'Rủi ro trung bình', ...RISK_MEDIUM },
    { key: 'HIGH', label: 'Rủi ro cao', ...RISK_HIGH },
    { key: 'VERY_HIGH', label: 'Rủi ro rất cao', ...RISK_VERY_HIGH },
  ],
  classify: (m) => m.braLevel,
  valueText: (m) => {
    if (!m.braLevel) return null;
    const label = BRA_SCALE.buckets.find((b) => b.key === m.braLevel)?.label ?? m.braLevel;
    return `BRA: ${label}${m.impactCode ? ` · Tác động ${m.impactCode}` : ''}`;
  },
};

// ─── 8. Số tầng (2 sub-mode) ────────────────────────────────────────────────
const floorsText = (m: ParcelThematicMetrics): string | null => {
  if (m.aboveFloors === null && m.basementFloors === null) return null;
  const above = m.aboveFloors === null ? '-- tầng nổi' : `${m.aboveFloors} tầng nổi`;
  const basement = m.basementFloors ? ` · ${m.basementFloors} tầng hầm` : '';
  return `${above}${basement}`;
};

export const FLOOR_TIER_SCALE: ThematicScale = {
  scaleType: 'sequential',
  buckets: [
    { key: 'F1', label: '1 tầng (trệt)', hex: '#dbeafe', fillOpacity: 0.7 },
    { key: 'F2_3', label: '2 – 3 tầng', hex: '#93c5fd', fillOpacity: 0.7 },
    { key: 'F4_5', label: '4 – 5 tầng', hex: '#3b82f6', fillOpacity: 0.74 },
    { key: 'F6_9', label: '6 – 9 tầng', hex: '#1d4ed8', fillOpacity: 0.8 },
    { key: 'F10_PLUS', label: 'Từ 10 tầng', hex: '#1e3a8a', fillOpacity: 0.86 },
  ],
  classify: (m) => m.floorTier,
  valueText: floorsText,
};

export const BASEMENT_SCALE: ThematicScale = {
  scaleType: 'binary',
  buckets: [
    { key: 'HAS_BASEMENT', label: 'Có tầng hầm', hex: '#4f46e5', fillOpacity: 0.8 },
    { key: 'NO_BASEMENT', label: 'Không có tầng hầm', hex: '#e2e8f0', fillOpacity: 0.25 },
  ],
  classify: (m) => (m.basementFloors === null ? null : m.basementFloors > 0 ? 'HAS_BASEMENT' : 'NO_BASEMENT'),
  valueText: floorsText,
};

const single = (scale: ThematicScale) => (): ThematicScale => scale;

export const THEMATIC_LAYOUTS: ThematicLayoutDef[] = [
  { id: 'WORKFLOW', label: 'Hiện trạng khảo sát', icon: MapIcon, group: 'OPERATIONAL', subModes: [], scaleFor: () => null },
  {
    id: 'CONSTRUCTION_YEAR',
    label: 'Năm xây dựng',
    icon: CalendarClock,
    group: 'CHARACTERISTICS',
    subModes: [],
    scaleFor: single(YEAR_SCALE),
  },
  {
    id: 'FOUNDATION_STRUCTURE',
    label: 'Móng & Kết cấu',
    icon: Layers,
    group: 'CHARACTERISTICS',
    subModes: [
      { id: 'FOUNDATION_TYPE', label: 'Loại móng' },
      { id: 'STRUCTURE_SYSTEM', label: 'Hệ kết cấu' },
      { id: 'FOUNDATION_CAT', label: 'CAT hồ sơ móng' },
    ],
    scaleFor: (sub) => (sub === 'STRUCTURE_SYSTEM' ? STRUCTURE_SCALE : sub === 'FOUNDATION_CAT' ? FOUNDATION_CAT_SCALE : FOUNDATION_TYPE_SCALE),
  },
  {
    id: 'FLOOR_COUNT',
    label: 'Số tầng',
    icon: Building2,
    group: 'CHARACTERISTICS',
    subModes: [
      { id: 'FLOOR_TIER', label: 'Tầng nổi' },
      { id: 'BASEMENT', label: 'Tầng hầm' },
    ],
    scaleFor: (sub) => (sub === 'BASEMENT' ? BASEMENT_SCALE : FLOOR_TIER_SCALE),
  },
  { id: 'STRUCTURAL_CONDITION', label: 'Tình trạng kết cấu', icon: Activity, group: 'RISK', subModes: [], scaleFor: single(ECS_SCALE) },
  { id: 'BURLAND_GRADE', label: 'Cấp Burland', icon: Waves, group: 'RISK', subModes: [], scaleFor: single(BURLAND_SCALE) },
  { id: 'VI_INDEX', label: 'Chỉ số dễ tổn thương', icon: Gauge, group: 'RISK', subModes: [], scaleFor: single(VI_SCALE) },
  { id: 'BRA_RISK', label: 'Chỉ số BRA', icon: ShieldAlert, group: 'RISK', subModes: [], scaleFor: single(BRA_SCALE) },
];

export function getLayoutDef(id: GisThematicLayoutId): ThematicLayoutDef {
  return THEMATIC_LAYOUTS.find((l) => l.id === id) ?? THEMATIC_LAYOUTS[0];
}

export function isThematicLayoutId(v: unknown): v is GisThematicLayoutId {
  return typeof v === 'string' && THEMATIC_LAYOUTS.some((l) => l.id === v);
}

/** Màu + độ đậm của 1 mã nhóm trong thang (kể cả 2 nhóm chung UNASSESSED / NON_BUILDING). */
export function bucketOf(scale: ThematicScale, key: string): ThematicBucket {
  if (key === NON_BUILDING_BUCKET.key) return NON_BUILDING_BUCKET;
  return scale.buckets.find((b) => b.key === key) ?? UNASSESSED_BUCKET;
}
