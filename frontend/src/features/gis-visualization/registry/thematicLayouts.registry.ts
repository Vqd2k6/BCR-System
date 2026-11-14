/**
 * ============================================================================
 * REGISTRY 8 LAYOUT GIS — nhãn, thang màu, phân nhóm, dòng tooltip
 * Màu ở đây là màu DỮ LIỆU tô polygon Leaflet (fillHex), không phải màu nền UI.
 * Ngưỡng bám đúng backend: tuổi theo v4FromAge (vi-calculator.ts), ECS ≤5/≤10/≤16,
 * VI 1,5/2,5/3,25, BRA ma trận V×I Bước 7 (PDF Mục VIII).
 * ============================================================================
 */
import type { LucideIcon } from 'lucide-react';
import { Activity, Building2, CalendarClock, Gauge, Layers, Map as MapIcon, ShieldAlert, Waves } from 'lucide-react';
import type { GisThematicLayoutId, ParcelThematicMetrics, ThematicSubModeId } from '../types';

export interface ThematicBucket {
  key: string;
  label: string;
  hex: string;
}

export interface ThematicScale {
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
  subModes: ThematicSubMode[];
  /** null ⇒ layout tác nghiệp WORKFLOW (tô theo trạng thái khảo sát, không dùng thang). */
  scaleFor: (subMode: ThematicSubModeId | null) => ThematicScale | null;
}

export const UNASSESSED_BUCKET: ThematicBucket = { key: 'UNASSESSED', label: 'Chưa đánh giá / chưa nộp hồ sơ', hex: '#94a3b8' };
export const NON_BUILDING_BUCKET: ThematicBucket = { key: 'NON_BUILDING', label: 'Đất trống / Hạ tầng (phi công trình)', hex: '#cbd5e1' };

const fmt2 = (n: number): string => n.toFixed(2).replace('.', ',');

const RISK_4: Record<string, string> = { LOW: '#16a34a', MEDIUM: '#eab308', HIGH: '#f97316', VERY_HIGH: '#dc2626' };

// ─── 2. Năm xây dựng ────────────────────────────────────────────────────────
const YEAR_SCALE: ThematicScale = {
  buckets: [
    { key: 'AGE_LT_10', label: 'Dưới 10 năm', hex: '#10b981' },
    { key: 'AGE_10_25', label: '10 – 25 năm', hex: '#0ea5e9' },
    { key: 'AGE_26_40', label: '26 – 40 năm', hex: '#eab308' },
    { key: 'AGE_GT_40', label: 'Trên 40 năm', hex: '#dc2626' },
  ],
  classify: (m) => m.yearCohort,
  valueText: (m) =>
    m.constructionYear === null
      ? null
      : `Năm XD: ${m.constructionYear}${m.isYearEstimated ? ' (ước lượng)' : ''} · ${m.buildingAge ?? '--'} năm tuổi`,
};

// ─── 3. Móng & Kết cấu (3 sub-mode) ─────────────────────────────────────────
const FOUNDATION_TYPE_SCALE: ThematicScale = {
  buckets: [
    { key: 'SHALLOW', label: 'Móng nông (băng / đơn / bè)', hex: '#f59e0b' },
    { key: 'WOOD', label: 'Móng cừ tràm / nền gia cố', hex: '#ef4444' },
    { key: 'PRECAST_PILE', label: 'Cọc ép BTCT / cọc ly tâm', hex: '#3b82f6' },
    { key: 'BORED_PILE', label: 'Cọc khoan nhồi / Barrette', hex: '#6366f1' },
    { key: 'RAFT', label: 'Móng bè hộp tầng hầm', hex: '#14b8a6' },
    { key: 'OTHER', label: 'Loại móng khác', hex: '#a855f7' },
    { key: 'UNKNOWN', label: 'Không rõ thông tin móng (đã khảo sát)', hex: '#78716c' },
  ],
  classify: (m) => m.foundationBucket,
  valueText: (m) => (m.foundationType ? `Móng: ${m.foundationType}` : null),
};

const STRUCTURE_SCALE: ThematicScale = {
  buckets: [
    { key: 'RC', label: 'Khung BTCT', hex: '#0284c7' },
    { key: 'MIXED', label: 'Kết cấu hỗn hợp', hex: '#eab308' },
    { key: 'MASONRY', label: 'Tường gạch chịu lực', hex: '#f97316' },
    { key: 'STEEL', label: 'Khung kết cấu thép', hex: '#14b8a6' },
    { key: 'SUBSTANDARD', label: 'Tạm / kém ổn định', hex: '#dc2626' },
    { key: 'OTHER', label: 'Hệ kết cấu khác', hex: '#a855f7' },
    { key: 'UNKNOWN', label: 'Chưa rõ hệ kết cấu', hex: '#78716c' },
  ],
  classify: (m) => m.structureClass,
  valueText: (m) => (m.structureSystem ? `Kết cấu: ${m.structureSystem}` : null),
};

const FOUNDATION_CAT_SCALE: ThematicScale = {
  buckets: [
    { key: 'CAT_1', label: 'CAT 1 – Có bản vẽ hoàn công phê duyệt', hex: '#16a34a' },
    { key: 'CAT_2', label: 'CAT 2 – Có bản vẽ thiết kế chủ nhà giữ', hex: '#84cc16' },
    { key: 'CAT_3', label: 'CAT 3 – Không bản vẽ, chủ nhà khai rõ', hex: '#eab308' },
    { key: 'CAT_4', label: 'CAT 4 – Suy luận từ số tầng & kết cấu', hex: '#f97316' },
    { key: 'CAT_5', label: 'CAT 5 – Hoàn toàn không có dữ liệu', hex: '#dc2626' },
  ],
  classify: (m) => (m.foundationCatScore === null ? null : `CAT_${m.foundationCatScore}`),
  valueText: (m) => (m.foundationCatScore === null ? null : `Hồ sơ móng: CAT ${m.foundationCatScore} / 5`),
};

// ─── 4. Tình trạng kết cấu (ECS) ────────────────────────────────────────────
const ECS_SCALE: ThematicScale = {
  buckets: [
    { key: 'GOOD', label: 'Tốt (ECS 0 – 5)', hex: '#16a34a' },
    { key: 'MEDIUM', label: 'Trung bình (ECS 6 – 10)', hex: '#eab308' },
    { key: 'DEFICIENT', label: 'Kém (ECS 11 – 16)', hex: '#f97316' },
    { key: 'CRITICAL', label: 'Nguy hiểm (ECS 17 – 24)', hex: '#dc2626' },
  ],
  classify: (m) => m.ecsClass,
  valueText: (m) => {
    if (!m.ecsClass) return null;
    const label = ECS_SCALE.buckets.find((b) => b.key === m.ecsClass)?.label.split(' (')[0] ?? m.ecsClass;
    return `ECS: ${m.totalEcs ?? '--'}/24 · ${label}`;
  },
};

// ─── 5. Burland ─────────────────────────────────────────────────────────────
const BURLAND_SCALE: ThematicScale = {
  buckets: [
    { key: 'G0', label: 'Cấp 0 – Không đáng kể', hex: '#16a34a' },
    { key: 'G1', label: 'Cấp 1 – Rất nhẹ', hex: '#84cc16' },
    { key: 'G2', label: 'Cấp 2 – Nhẹ', hex: '#eab308' },
    { key: 'G3', label: 'Cấp 3 – Trung bình', hex: '#f97316' },
    { key: 'G4', label: 'Cấp 4 – Nghiêm trọng', hex: '#ef4444' },
    { key: 'G5', label: 'Cấp 5 – Rất nghiêm trọng', hex: '#991b1b' },
  ],
  classify: (m) => (m.burlandMaxGrade === null ? null : `G${m.burlandMaxGrade}`),
  valueText: (m) => (m.burlandMaxGrade === null ? null : `Burland cục bộ lớn nhất: Cấp ${m.burlandMaxGrade}`),
};

// ─── 6. Chỉ số dễ tổn thương VI ─────────────────────────────────────────────
const VI_LABEL: Record<string, string> = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao', VERY_HIGH: 'Rất cao' };
const VI_SCALE: ThematicScale = {
  buckets: [
    { key: 'LOW', label: 'Thấp (VI ≤ 1,50)', hex: RISK_4.LOW },
    { key: 'MEDIUM', label: 'Trung bình (1,51 – 2,50)', hex: RISK_4.MEDIUM },
    { key: 'HIGH', label: 'Cao (2,51 – 3,25)', hex: RISK_4.HIGH },
    { key: 'VERY_HIGH', label: 'Rất cao (> 3,25)', hex: RISK_4.VERY_HIGH },
  ],
  classify: (m) => m.viClass,
  valueText: (m) =>
    m.viClass ? `VI TB: ${m.avgViScore === null ? '--' : fmt2(m.avgViScore)} · ${VI_LABEL[m.viClass]}` : null,
};

// ─── 7. BRA (ma trận V×I Bước 7) — cùng màu với biểu đồ BRA ở Guest Portal ──
const BRA_SCALE: ThematicScale = {
  buckets: [
    { key: 'LOW', label: 'Rủi ro thấp', hex: '#16a34a' },
    { key: 'MEDIUM', label: 'Rủi ro trung bình', hex: '#eab308' },
    { key: 'HIGH', label: 'Rủi ro cao', hex: '#ea580c' },
    { key: 'VERY_HIGH', label: 'Rủi ro rất cao', hex: '#dc2626' },
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

const FLOOR_TIER_SCALE: ThematicScale = {
  buckets: [
    { key: 'F1', label: '1 tầng (trệt)', hex: '#7dd3fc' },
    { key: 'F2_3', label: '2 – 3 tầng', hex: '#3b82f6' },
    { key: 'F4_5', label: '4 – 5 tầng', hex: '#6366f1' },
    { key: 'F6_9', label: '6 – 9 tầng', hex: '#a855f7' },
    { key: 'F10_PLUS', label: 'Từ 10 tầng', hex: '#7e22ce' },
  ],
  classify: (m) => m.floorTier,
  valueText: floorsText,
};

const BASEMENT_SCALE: ThematicScale = {
  buckets: [
    { key: 'HAS_BASEMENT', label: 'Có tầng hầm', hex: '#7e22ce' },
    { key: 'NO_BASEMENT', label: 'Không có tầng hầm', hex: '#7dd3fc' },
  ],
  classify: (m) => (m.basementFloors === null ? null : m.basementFloors > 0 ? 'HAS_BASEMENT' : 'NO_BASEMENT'),
  valueText: floorsText,
};

const single = (scale: ThematicScale) => (): ThematicScale => scale;

export const THEMATIC_LAYOUTS: ThematicLayoutDef[] = [
  { id: 'WORKFLOW', label: 'Hiện trạng khảo sát', icon: MapIcon, subModes: [], scaleFor: () => null },
  { id: 'CONSTRUCTION_YEAR', label: 'Năm xây dựng', icon: CalendarClock, subModes: [], scaleFor: single(YEAR_SCALE) },
  {
    id: 'FOUNDATION_STRUCTURE',
    label: 'Móng & Kết cấu',
    icon: Layers,
    subModes: [
      { id: 'FOUNDATION_TYPE', label: 'Loại móng' },
      { id: 'STRUCTURE_SYSTEM', label: 'Hệ kết cấu' },
      { id: 'FOUNDATION_CAT', label: 'CAT hồ sơ móng' },
    ],
    scaleFor: (sub) => (sub === 'STRUCTURE_SYSTEM' ? STRUCTURE_SCALE : sub === 'FOUNDATION_CAT' ? FOUNDATION_CAT_SCALE : FOUNDATION_TYPE_SCALE),
  },
  { id: 'STRUCTURAL_CONDITION', label: 'Tình trạng kết cấu', icon: Activity, subModes: [], scaleFor: single(ECS_SCALE) },
  { id: 'BURLAND_GRADE', label: 'Cấp Burland', icon: Waves, subModes: [], scaleFor: single(BURLAND_SCALE) },
  { id: 'VI_INDEX', label: 'Chỉ số dễ tổn thương', icon: Gauge, subModes: [], scaleFor: single(VI_SCALE) },
  { id: 'BRA_RISK', label: 'Chỉ số BRA', icon: ShieldAlert, subModes: [], scaleFor: single(BRA_SCALE) },
  {
    id: 'FLOOR_COUNT',
    label: 'Số tầng',
    icon: Building2,
    subModes: [
      { id: 'FLOOR_TIER', label: 'Tầng nổi' },
      { id: 'BASEMENT', label: 'Tầng hầm' },
    ],
    scaleFor: (sub) => (sub === 'BASEMENT' ? BASEMENT_SCALE : FLOOR_TIER_SCALE),
  },
];

export function getLayoutDef(id: GisThematicLayoutId): ThematicLayoutDef {
  return THEMATIC_LAYOUTS.find((l) => l.id === id) ?? THEMATIC_LAYOUTS[0];
}

export function isThematicLayoutId(v: unknown): v is GisThematicLayoutId {
  return typeof v === 'string' && THEMATIC_LAYOUTS.some((l) => l.id === v);
}
