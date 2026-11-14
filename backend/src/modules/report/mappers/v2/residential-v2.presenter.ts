/**
 * ============================================================================
 * PRESENTER TEMPLATE NHÀ DÂN v2 (mẫu ST01-B-0056-CC, plan R3 chốt 14/11/2026)
 * Nhận ViewModel chuẩn (dùng chung với v1, đã dập watermark) + hồ sơ gốc, trả phần dữ liệu riêng của v2:
 * Mục VI theo 9 nhóm khuyết tật, Mục VII theo cấp Burland, Mục VIII theo phương pháp v2 (risk-v2.calculator),
 * Mục IX tự sinh, PL1 ảnh mặt đứng, PL2 theo tầng (chỉ ghim khuyết tật D). Không sửa ViewModel gốc.
 * Giữ mã khuyết tật của v1 (D-01...). Thiếu dữ liệu thì in '--' / '---', không giả định.
 * ============================================================================
 */

import type {
  BilingualText,
  CadPinOverlayItem,
  DefectPairPhotoItem,
  FloorDefectSummaryRow,
  ReportViewModel,
} from '../../report.types';
import {
  BRA_MAX,
  BURLAND_ECS_MATRIX,
  calculateRiskV2,
  type BraIndicator,
  type EcsV2Grade,
  type ImpactCode,
  type RiskV2DefectInput,
  type RiskV2Level,
  type RiskV2Result,
} from './risk-v2.calculator';
import { FOUNDATION_CAT_LABELS } from '../sections/foundation-cat-labels';

const EM_DASH = '–';

export const ECS_V2_LABELS: Record<EcsV2Grade, BilingualText> = {
  GOOD: { vi: 'Tốt', en: 'Good' },
  MODERATE: { vi: 'Trung bình', en: 'Moderate' },
  POOR: { vi: 'Kém', en: 'Poor' },
  DANGEROUS: { vi: 'Nguy hiểm', en: 'Dangerous' },
};

export const RISK_V2_LABELS: Record<RiskV2Level, BilingualText> = {
  1: { vi: 'An toàn', en: 'Safe' },
  2: { vi: 'Rủi ro thấp', en: 'Low risk' },
  3: { vi: 'Rủi ro trung bình', en: 'Medium risk' },
  4: { vi: 'Rủi ro cao', en: 'High risk' },
};

const ECS_DEFINITIONS: Array<{ grade: EcsV2Grade; definition: BilingualText }> = [
  {
    grade: 'GOOD',
    definition: {
      vi: 'Không có dấu hiệu lún hoặc sụp đổ rõ ràng; không có vết nứt lớn hơn 0,3 mm hoặc chỉ có khuyết tật rất nhẹ. Tham chiếu cấp 1–2: không đáng kể / rất nhẹ.',
      en: 'No obvious signs of settlement or collapse; no cracks wider than 0.3 mm, or only very minor defects. Reference: Categories 1–2, negligible / very slight.',
    },
  },
  {
    grade: 'MODERATE',
    definition: {
      vi: 'Vết nứt cấu kiện kết cấu không lớn hơn 1 mm, cấu kiện phi kết cấu không lớn hơn 5 mm; không có lún hoặc sụp đổ cấu kiện. Tham chiếu cấp 3.',
      en: 'Cracks in structural members not greater than 1 mm and in non-structural members not greater than 5 mm; no settlement or member collapse. Reference: Category 3.',
    },
  },
  {
    grade: 'POOR',
    definition: {
      vi: 'Vết nứt cấu kiện kết cấu không lớn hơn 2 mm, cấu kiện phi kết cấu không lớn hơn 10 mm; hoặc có dấu hiệu xuống cấp rõ ràng như ăn mòn, bong tróc bê tông. Tham chiếu cấp 4.',
      en: 'Cracks in structural members not greater than 2 mm and in non-structural members not greater than 10 mm; or clear deterioration such as corrosion and concrete spalling. Reference: Category 4.',
    },
  },
  {
    grade: 'DANGEROUS',
    definition: {
      vi: 'Hư hỏng nghiêm trọng: vết nứt kết cấu lớn hơn 2 mm, phi kết cấu lớn hơn 10 mm, lún và/hoặc sụp đổ cục bộ, hoặc bê tông ăn mòn, bong tróc đáng kể. Tham chiếu cấp 4–5.',
      en: 'Serious damage: structural cracks wider than 2 mm, non-structural cracks wider than 10 mm, settlement and/or local collapse, or significant concrete corrosion and spalling. Reference: Categories 4–5.',
    },
  },
];

const BURLAND_ROW_LABELS: BilingualText[] = [
  { vi: 'Không đáng kể (B-0)', en: 'Negligible (B-0)' },
  { vi: 'Rất nhẹ (B-1)', en: 'Very slight (B-1)' },
  { vi: 'Nhẹ (B-2)', en: 'Slight (B-2)' },
  { vi: 'Trung bình (B-3)', en: 'Moderate (B-3)' },
  { vi: 'Nặng / Rất nặng (B-4, B-5)', en: 'Severe / Very severe (B-4, B-5)' },
];

const BURLAND_GRADE_LABELS: BilingualText[] = [
  { vi: 'Không đáng kể', en: 'Negligible' },
  { vi: 'Rất nhẹ', en: 'Very slight' },
  { vi: 'Nhẹ', en: 'Slight' },
  { vi: 'Trung bình', en: 'Moderate' },
  { vi: 'Nặng', en: 'Severe' },
  { vi: 'Rất nặng', en: 'Very severe' },
];

const BRA_ROWS: Array<{ code: BraIndicator; title: BilingualText; method: BilingualText }> = [
  {
    code: 'A',
    title: { vi: 'Tác động thi công / Hư hỏng dự đoán', en: 'Construction impact / Predicted damage' },
    method: {
      vi: 'Theo cấp hư hỏng Burland lớn nhất ghi nhận: B-0 = 0; B-1 = 7; B-2 = 14; B-3 = 24; B-4/B-5 = 35 điểm.',
      en: 'Based on the highest recorded Burland category: B-0 = 0; B-1 = 7; B-2 = 14; B-3 = 24; B-4/B-5 = 35 points.',
    },
  },
  {
    code: 'B',
    title: { vi: 'Tình trạng công trình', en: 'Building condition' },
    method: {
      vi: 'Theo cấp ECS hiện tại: Tốt = 0; Trung bình = 8; Kém = 17; Nguy hiểm = 25 điểm.',
      en: 'Based on the current ECS grade: Good = 0; Moderate = 8; Poor = 17; Dangerous = 25 points.',
    },
  },
  {
    code: 'C',
    title: { vi: 'Móng và độ nhạy địa kỹ thuật', en: 'Foundation and geotechnical sensitivity' },
    method: {
      vi: 'Theo phân loại CAT hồ sơ móng: CAT 1–2 (có bản vẽ) = 0; CAT 3 (chủ nhà khai rõ) = 5; CAT 4 (suy luận) = 10; CAT 5 (không có dữ liệu) = 15 điểm.',
      en: 'Based on the foundation record CAT: CAT 1–2 (drawings available) = 0; CAT 3 (clearly declared by owner) = 5; CAT 4 (inferred) = 10; CAT 5 (no data) = 15 points.',
    },
  },
  {
    code: 'D',
    title: { vi: 'Mức độ tiếp xúc / Khoảng cách', en: 'Exposure / Distance' },
    method: {
      vi: 'Theo cấp tác động theo khoảng cách đến công trình metro: I1 = 0; I2 = 5; I3 = 10; I4 = 15 điểm.',
      en: 'Based on the impact level by distance to the metro works: I1 = 0; I2 = 5; I3 = 10; I4 = 15 points.',
    },
  },
  {
    code: 'E',
    title: { vi: 'Mức độ nghiêm trọng của hậu quả', en: 'Consequence severity / Importance' },
    method: {
      vi: 'Công trình ít người sử dụng = 0; dân dụng hoặc thương mại thông thường = 3; trường học, bệnh viện, công trình công cộng, cơ sở tôn giáo = 7; di sản hoặc công trình đặc biệt quan trọng = 10 điểm.',
      en: 'Low-occupancy buildings = 0; ordinary residential or commercial = 3; schools, hospitals, public or religious buildings = 7; heritage or critical facilities = 10 points.',
    },
  },
];

type DefectTypeV2 =
  | 'FINISH_CRACK'
  | 'STRUCTURAL_CRACK'
  | 'DAMAGE'
  | 'FINISH_SPALLING'
  | 'TILES'
  | 'LEAKAGE'
  | 'CEILING'
  | 'REBAR'
  | 'SLOPING_FLOOR';

const DEFECT_TYPE_V2_LABELS: Array<{ key: DefectTypeV2; label: BilingualText }> = [
  { key: 'FINISH_CRACK', label: { vi: 'Vết nứt lớp hoàn thiện bề mặt', en: 'Surface finish cracks' } },
  { key: 'STRUCTURAL_CRACK', label: { vi: 'Vết nứt kết cấu', en: 'Structural cracks' } },
  { key: 'DAMAGE', label: { vi: 'Hư hại', en: 'Damage' } },
  { key: 'FINISH_SPALLING', label: { vi: 'Bong tróc lớp hoàn thiện', en: 'Spalling of finish' } },
  { key: 'TILES', label: { vi: 'Gạch bị nứt / hư hại', en: 'Cracked / damaged tiles' } },
  { key: 'LEAKAGE', label: { vi: 'Rò rỉ, thấm dột', en: 'Leakage' } },
  { key: 'CEILING', label: { vi: 'Hư hại trần', en: 'Ceiling damage' } },
  { key: 'REBAR', label: { vi: 'Bê tông bong tróc, lộ cốt thép', en: 'Concrete spalling and exposed reinforcement' } },
  { key: 'SLOPING_FLOOR', label: { vi: 'Sàn bị nghiêng', en: 'Sloping floor' } },
];

function lower(value: string | undefined | null): string {
  return String(value ?? '').normalize('NFC').toLowerCase();
}

/** Bề rộng (mm) từ ViewModel: số, hoặc chuỗi đã định dạng kèm đơn vị như "0.45 mm" / "0,45 mm"; '–' = không đo. */
export function parseWidthMm(value: number | string): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = String(value).match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const n = Number(match[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Phân loại 9 nhóm của mẫu cho một khuyết tật. Ưu tiên nhóm sàng lọc KSV/Admin đã chọn (screeningCategory),
 * rồi tới loại khuyết tật. Ghim trên cấu kiện E là kết cấu (quyết định D7).
 */
export function classifyDefectV2(row: FloorDefectSummaryRow): DefectTypeV2 {
  const cat = lower(row.screeningCategory);
  const t = `${cat} ${lower(row.defectType.vi)}`;
  const hasWidth = parseWidthMm(row.widthMm) !== null;
  if (t.includes('cốt thép') || t.includes('vỡ bê tông') || t.includes('gỉ sét')) return 'REBAR';
  if (t.includes('thấm') || t.includes('dột') || t.includes('ẩm mốc') || t.includes('rò rỉ')) return 'LEAKAGE';
  if (t.includes('gạch ốp') || t.includes('ốp lát') || t.includes('đá ốp')) return 'TILES';
  if (t.includes('sàn') && (t.includes('nghiêng') || t.includes('võng'))) return 'SLOPING_FLOOR';
  if (t.includes('trần') && !t.includes('khuôn cửa')) return 'CEILING';
  if (row.source === 'ELEMENT' || t.includes('kết cấu') || t.includes('chịu lực')) return hasWidth ? 'STRUCTURAL_CRACK' : 'DAMAGE';
  if (t.includes('bong') || t.includes('tróc') || t.includes('rộp')) return 'FINISH_SPALLING';
  if (hasWidth || t.includes('nứt')) return 'FINISH_CRACK';
  return 'DAMAGE';
}

function fmtMm(value: number | null): string {
  return value === null ? '--' : value.toFixed(value < 1 ? 2 : 1).replace('.', ',');
}

function fmtMmEn(value: number | null): string {
  return value === null ? '--' : value.toFixed(value < 1 ? 2 : 1);
}

export interface ResidentialV2View {
  docNo: string;
  revision: string;
  docDate: string;
  footerTitle: string;
  defectTypes: { rows: Array<{ label: BilingualText; count: number }>; total: number };
  burland: { rows: Array<{ grade: number; label: BilingualText; count: number }>; total: number };
  ecs: {
    rows: Array<{ label: BilingualText; definition: BilingualText; isCurrent: boolean }>;
    grade: BilingualText;
    narrative: BilingualText;
  };
  matrix: {
    columns: BilingualText[];
    rows: Array<{ label: BilingualText; cells: Array<{ level: number; label: BilingualText; isCurrent: boolean }> }>;
    resultNote: BilingualText | null;
    level: BilingualText | null;
    narrative: BilingualText;
  };
  bra: {
    rows: Array<{ code: BraIndicator; title: BilingualText; method: BilingualText; max: number; score: string }>;
    totalDisplay: string;
    basis: BilingualText[];
    level: BilingualText | null;
    conclusion: BilingualText;
    missing: BraIndicator[];
  };
  overall: { levelNumber: number | null; level: BilingualText | null; narrative: BilingualText };
  conclusions: BilingualText[];
  recommendations: BilingualText[];
  elevationPhotos: Array<{ figNo: string; caption: BilingualText; src: string }>;
  floors: Array<{
    code: string;
    floorName: BilingualText;
    mapSrc: string | null;
    pins: CadPinOverlayItem[];
    rows: Array<FloorDefectSummaryRow & { typeLabel: BilingualText; burlandLabel: BilingualText }>;
    closeUps: Array<{ src: string; caption: BilingualText }>;
  }>;
  risk: RiskV2Result;
}

function buildRiskInput(vm: ReportViewModel, raw: Record<string, unknown>, rows: FloorDefectSummaryRow[]): {
  input: Parameters<typeof calculateRiskV2>[0];
  usage: string | null;
  objectGroup: string | null;
} {
  const json = (raw.survey_data_json && typeof raw.survey_data_json === 'object' ? raw.survey_data_json : {}) as Record<string, unknown>;
  const specs = (raw.buildingSpecs && typeof raw.buildingSpecs === 'object' ? raw.buildingSpecs : json) as Record<string, unknown>;
  const usage = typeof json.usageFunction === 'string' && json.usageFunction.trim() ? json.usageFunction.trim() : null;
  const groupRaw = json.objectGroup ?? specs.building_grade;
  const objectGroup = typeof groupRaw === 'string' && groupRaw.trim() ? groupRaw.trim() : null;

  const defects: RiskV2DefectInput[] = rows.map((r) => ({
    code: r.defectId,
    widthMm: parseWidthMm(r.widthMm),
    isStructural: r.source === 'ELEMENT',
    isRebarExposure: classifyDefectV2(r) === 'REBAR',
  }));
  const burlandFromVm = vm.section8.ecs.burlandLocalMaxGrade;
  const burlandFromRows = rows.length > 0 ? Math.max(...rows.map((r) => (Number.isInteger(r.burlandGrade) ? r.burlandGrade : 0))) : 0;
  const impact = vm.section8.impact.code;
  return {
    usage,
    objectGroup,
    input: {
      defects,
      burlandMaxGrade: typeof burlandFromVm === 'number' && Number.isInteger(burlandFromVm) ? burlandFromVm : burlandFromRows,
      differentialSettlementObserved: vm.section5.differentialSettlement.observed,
      foundationCat: typeof vm.section8.vi.foundationCatScore === 'number' ? vm.section8.vi.foundationCatScore : null,
      impactCode: impact === '--' ? null : (impact as ImpactCode),
      usage,
      objectGroup,
    },
  };
}

function burlandBand(row: number | null): string {
  if (row === null) return '--';
  return row >= 4 ? 'B-4/B-5' : `B-${row}`;
}

function ecsNarrative(risk: RiskV2Result, leakageCodes: string[]): BilingualText {
  const e = risk.ecs;
  const vi: string[] = [];
  const en: string[] = [];
  const hasStructuralCrack = (e.maxStructuralWidthMm ?? 0) > 0;
  if (!hasStructuralCrack && !e.settlementObserved) {
    vi.push('Không phát hiện vết nứt kết cấu hoặc lún lệch.');
    en.push('No structural cracks or differential settlement were observed.');
  } else if (e.settlementObserved) {
    vi.push('Có bằng chứng lún lệch tại công trình.');
    en.push('Evidence of differential settlement was observed.');
  }
  const widest = Math.max(e.maxStructuralWidthMm ?? 0, e.maxNonStructuralWidthMm ?? 0);
  if (widest > 0 && e.governingDefectCode && e.governingIsStructural !== null) {
    const isS = e.governingIsStructural;
    const width = isS ? e.maxStructuralWidthMm : e.maxNonStructuralWidthMm;
    vi.push(`Vết nứt quyết định rộng ${fmtMm(width)} mm (${e.governingDefectCode}) nằm ở cấu kiện ${isS ? 'kết cấu' : 'phi kết cấu'}.`);
    en.push(`The governing crack, ${fmtMmEn(width)} mm (${e.governingDefectCode}), is in a ${isS ? 'structural' : 'non-structural'} element.`);
  }
  if (leakageCodes.length > 0) {
    vi.push(`Ghi nhận thấm dột (${leakageCodes.join(', ')}).`);
    en.push(`Leakage was recorded (${leakageCodes.join(', ')}).`);
  }
  if (e.hasRebarExposure) {
    vi.push('Có bê tông bong tróc, lộ cốt thép.');
    en.push('Concrete spalling with exposed reinforcement was recorded.');
  }
  const label = ECS_V2_LABELS[e.grade];
  vi.push(`Tình trạng công trình theo ECS được đánh giá: ${label.vi.toUpperCase()}.`);
  en.push(`The ECS condition rating is: ${label.en.toUpperCase()}.`);
  return { vi: vi.join(' '), en: en.join(' ') };
}

/** Kết quả đã đóng băng khi phát hành Rev v2 (frozenReportData.risk_v2): render lại Rev không tính lại. */
function readFrozenRisk(raw: Record<string, unknown>): RiskV2Result | null {
  const value = raw.risk_v2;
  if (!value || typeof value !== 'object') return null;
  const r = value as Partial<RiskV2Result>;
  return r.ecs && r.matrix && r.bra && r.overall ? (value as RiskV2Result) : null;
}

export function presentResidentialV2(vm: ReportViewModel, raw: Record<string, unknown>): ResidentialV2View {
  const rows = vm.appendix2.flatMap((f) => f.defectSummaryRows);
  const { input, usage, objectGroup } = buildRiskInput(vm, raw, rows);
  const risk = readFrozenRisk(raw) ?? calculateRiskV2(input);

  const classified = rows.map((r) => ({ row: r, type: classifyDefectV2(r) }));
  const codesOf = (type: DefectTypeV2) => classified.filter((c) => c.type === type).map((c) => c.row.defectId);

  // Mục VI, VII
  const defectTypes = {
    rows: DEFECT_TYPE_V2_LABELS.map(({ key, label }) => ({ label, count: classified.filter((c) => c.type === key).length })),
    total: rows.length,
  };
  const burland = {
    rows: BURLAND_GRADE_LABELS.map((label, grade) => ({ grade, label, count: rows.filter((r) => r.burlandGrade === grade).length })),
    total: rows.length,
  };

  // Mục VIII.1
  const ecsLabel = ECS_V2_LABELS[risk.ecs.grade];
  const ecs = {
    rows: ECS_DEFINITIONS.map((d) => ({ label: ECS_V2_LABELS[d.grade], definition: d.definition, isCurrent: d.grade === risk.ecs.grade })),
    grade: ecsLabel,
    narrative: ecsNarrative(risk, codesOf('LEAKAGE')),
  };

  // Mục VIII.2
  const ecsCol = (['GOOD', 'MODERATE', 'POOR', 'DANGEROUS'] as const).indexOf(risk.ecs.grade);
  const matrixLevel = risk.matrix.level;
  const band = burlandBand(risk.matrix.burlandRow);
  const matrix = {
    columns: (['GOOD', 'MODERATE', 'POOR', 'DANGEROUS'] as const).map((g) => ECS_V2_LABELS[g]),
    rows: BURLAND_ECS_MATRIX.map((cells, rowIdx) => ({
      label: BURLAND_ROW_LABELS[rowIdx],
      cells: cells.map((level, colIdx) => ({
        level,
        label: RISK_V2_LABELS[level],
        isCurrent: risk.matrix.burlandRow === rowIdx && ecsCol === colIdx,
      })),
    })),
    resultNote:
      matrixLevel === null
        ? null
        : {
            vi: `Ô viền đậm: kết quả của công trình (Burland ${band} × ECS ${ecsLabel.vi}).`,
            en: `Bold-framed cell: result for this building (Burland ${band} × ECS ${ecsLabel.en}).`,
          },
    level: matrixLevel === null ? null : RISK_V2_LABELS[matrixLevel],
    narrative:
      matrixLevel === null
        ? { vi: 'Chưa có cấp Burland đã thẩm định, chưa xác định được mức rủi ro cơ sở.', en: 'No assessed Burland category; the baseline risk level cannot be determined.' }
        : {
            vi: `Dựa trên ma trận trên, có xét đến cấp ECS hiện tại (${ecsLabel.vi}) và cấp hư hại Burland lớn nhất (${band}), mức rủi ro cơ sở của công trình được xác định là: ${RISK_V2_LABELS[matrixLevel].vi.toUpperCase()}.`,
            en: `Based on the matrix above, considering the current ECS grade (${ecsLabel.en}) and the highest Burland damage category (${band}), the building's baseline risk level is: ${RISK_V2_LABELS[matrixLevel].en.toUpperCase()}.`,
          },
  };

  // Mục VIII.3
  const governingBurland = rows.filter((r) => r.burlandGrade === input.burlandMaxGrade).map((r) => r.defectId);
  const s = risk.bra.scores;
  const basis: BilingualText[] = [];
  if (s.A !== null) {
    const ref = governingBurland.length > 0 && (input.burlandMaxGrade ?? 0) > 0 ? ` (${governingBurland.slice(0, 3).join(', ')})` : '';
    basis.push({ vi: `A = ${s.A}: cấp Burland lớn nhất ghi nhận là ${band}${ref}.`, en: `A = ${s.A}: the highest recorded Burland category is ${band}${ref}.` });
  }
  basis.push({ vi: `B = ${s.B}: tình trạng ECS ${ecsLabel.vi} (mục VIII.1).`, en: `B = ${s.B}: ECS rating ${ecsLabel.en} (section VIII.1).` });
  if (s.C !== null && input.foundationCat !== null) {
    const cat = FOUNDATION_CAT_LABELS[input.foundationCat];
    basis.push({ vi: `C = ${s.C}: ${cat?.vi ?? `CAT ${input.foundationCat}`}.`, en: `C = ${s.C}: ${cat?.en ?? `CAT ${input.foundationCat}`}.` });
  }
  if (s.D !== null) {
    const imp = vm.section8.impact;
    basis.push({ vi: `D = ${s.D}: cấp tác động ${imp.code} – ${imp.basis.vi}.`, en: `D = ${s.D}: impact level ${imp.code} – ${imp.basis.en}.` });
  }
  if (s.E !== null) {
    const parts = [usage ? `công năng "${usage}"` : null, objectGroup ? `nhóm công trình ${objectGroup}` : null].filter(Boolean).join(', ');
    const partsEn = [usage ? `use "${usage}"` : null, objectGroup ? `building group ${objectGroup}` : null].filter(Boolean).join(', ');
    basis.push({ vi: `E = ${s.E}: theo ${parts}.`, en: `E = ${s.E}: based on ${partsEn}.` });
  }
  const missingVi: Record<BraIndicator, string> = { A: 'cấp Burland', B: 'ECS', C: 'CAT hồ sơ móng', D: 'khoảng cách đến công trình metro', E: 'công năng / nhóm công trình' };
  const missingEn: Record<BraIndicator, string> = { A: 'Burland category', B: 'ECS', C: 'foundation CAT', D: 'distance to the metro works', E: 'use / building group' };
  const braLevel = risk.bra.level === null ? null : RISK_V2_LABELS[risk.bra.level];
  const bra = {
    rows: BRA_ROWS.map((r) => ({ ...r, max: BRA_MAX[r.code], score: s[r.code] === null ? '--' : String(s[r.code]) })),
    totalDisplay: risk.bra.total === null ? '--' : String(risk.bra.total),
    basis,
    level: braLevel,
    missing: risk.bra.missing,
    conclusion:
      risk.bra.total === null || braLevel === null
        ? {
            vi: `Chưa đủ dữ liệu để chấm điểm BRA (thiếu ${risk.bra.missing.map((m) => missingVi[m]).join(', ')}).`,
            en: `Insufficient data for BRA scoring (missing ${risk.bra.missing.map((m) => missingEn[m]).join(', ')}).`,
          }
        : {
            vi: `Mức độ rủi ro BRA của công trình được xác định là: ${braLevel.vi.toUpperCase()} (${risk.bra.total}/100).`,
            en: `The BRA risk level of the building is determined to be: ${braLevel.en.toUpperCase()} (${risk.bra.total}/100).`,
          },
  };

  // Mục VIII.4
  const overallLevel = risk.overall.level === null ? null : RISK_V2_LABELS[risk.overall.level];
  let overallNarrative: BilingualText;
  if (overallLevel === null) {
    overallNarrative = { vi: 'Chưa đủ dữ liệu để xác định cấp độ rủi ro tổng thể.', en: 'Insufficient data to determine the overall risk grade.' };
  } else if (risk.matrix.level !== null && risk.bra.level !== null && braLevel && matrix.level) {
    const same = risk.matrix.level === risk.bra.level;
    overallNarrative = same
      ? {
          vi: `Ma trận rủi ro và điểm BRA (${risk.bra.total}/100) cùng cho kết quả ${matrix.level.vi}; cấp độ rủi ro tổng thể được lấy theo kết quả này.`,
          en: `The risk matrix and the BRA score (${risk.bra.total}/100) both give ${matrix.level.en}; the overall risk grade is taken accordingly.`,
        }
      : {
          vi: `Ma trận rủi ro cho kết quả ${matrix.level.vi}, trong khi điểm BRA (${risk.bra.total}/100) tương ứng ${braLevel.vi}. Cấp độ rủi ro tổng thể được lấy theo kết quả bất lợi hơn.`,
          en: `The risk matrix gives ${matrix.level.en}, while the BRA score (${risk.bra.total}/100) corresponds to ${braLevel.en}. The overall risk grade is taken as the more adverse result.`,
        };
  } else {
    overallNarrative = {
      vi: `Cấp độ rủi ro tổng thể được lấy theo ${risk.overall.source === 'BRA' ? 'điểm BRA' : 'ma trận rủi ro'} do chưa đủ dữ liệu cho phần còn lại.`,
      en: `The overall risk grade is taken from the ${risk.overall.source === 'BRA' ? 'BRA score' : 'risk matrix'} because data for the other part is insufficient.`,
    };
  }

  // Mục IX (tự sinh, quyết định D3)
  const conclusions: BilingualText[] = [];
  if (overallLevel) {
    conclusions.push({
      vi: `Sau khi hoàn thành công tác khảo sát hiện trường và đánh giá hiện trạng, công trình được phân loại ở mức rủi ro cuối cùng là ${overallLevel.vi}.`,
      en: `Following the completion of the site survey and condition assessment, the building has been assigned a final risk rating of ${overallLevel.en}.`,
    });
  }
  conclusions.push({
    vi: 'Khảo sát hiện trường được lập kế hoạch và giám sát chặt chẽ bởi các bên liên quan; quy trình khảo sát được thực hiện theo đúng phương pháp đã được phê duyệt.',
    en: 'The field survey was planned and closely supervised by the relevant parties, and the survey procedures were carried out in accordance with the approved methodology.',
  });
  const limitations = vm.section9.limitations.filter((l) => l.vi.trim());
  if (limitations.length > 0) {
    conclusions.push({
      vi: `Mặc dù có một số hạn chế – ${limitations.map((l) => l.vi.replace(/[.;]\s*$/, '')).join('; ')} – kết quả khảo sát vẫn được xem là chính xác và phản ánh trung thực hiện trạng công trình.`,
      en: `Despite certain limitations – ${limitations.map((l) => l.en.replace(/[.;]\s*$/, '')).join('; ')} – the survey results are considered accurate and reflective of the building's actual condition.`,
    });
  }

  const recommendations: BilingualText[] = [
    {
      vi: 'Các bên liên quan rà soát, xác minh kết quả khảo sát và đưa vào áp dụng trong các giai đoạn triển khai tiếp theo của dự án.',
      en: 'All relevant parties should review and verify the findings and incorporate them into subsequent project phases.',
    },
    {
      vi: 'Quan trắc liên tục độ lún và độ nghiêng của công trình trong suốt giai đoạn thi công để phát hiện kịp thời các nguy cơ tiềm ẩn.',
      en: "Continuous monitoring of the building's settlement and inclination is recommended throughout the construction phase to detect potential hazards in time.",
    },
  ];
  const widest = classified
    .map((c) => ({ code: c.row.defectId, w: parseWidthMm(c.row.widthMm) }))
    .filter((c): c is { code: string; w: number } => c.w !== null && c.w > 0.3)
    .sort((a, b) => b.w - a.w)[0];
  if (widest) {
    recommendations.push({
      vi: `Gắn mốc theo dõi vết nứt (crack gauge) cho vết nứt ${widest.code} (rộng ${fmtMm(widest.w)} mm) và ghi nhận số đọc định kỳ trong suốt giai đoạn thi công.`,
      en: `A crack-monitoring gauge should be installed on defect ${widest.code} (${fmtMmEn(widest.w)} mm wide), with readings recorded regularly throughout construction.`,
    });
  }
  const leak = codesOf('LEAKAGE');
  if (leak.length > 0) {
    recommendations.push({
      vi: `Chủ nhà xử lý chống thấm tại các vị trí thấm dột (${leak.join(', ')}), tránh làm kết cấu xuống cấp nhanh hơn.`,
      en: `The owner is advised to repair the waterproofing at the leakage locations (${leak.join(', ')}) to prevent accelerated deterioration.`,
    });
  }
  const loose = [...codesOf('TILES'), ...codesOf('FINISH_SPALLING')];
  if (loose.length > 0) {
    recommendations.push({
      vi: `Gia cố hoặc tháo bỏ phần lớp hoàn thiện / gạch ốp bị bong tróc (${loose.join(', ')}) để tránh rơi gây nguy hiểm cho người sử dụng.`,
      en: `The spalled finishes / tile cladding (${loose.join(', ')}) should be secured or removed to prevent falling hazards to occupants.`,
    });
  }
  const rebar = codesOf('REBAR');
  if (rebar.length > 0) {
    recommendations.push({
      vi: `Xử lý bê tông bong tróc, lộ cốt thép (${rebar.join(', ')}) và đánh giá bổ sung khả năng chịu lực của cấu kiện liên quan.`,
      en: `The concrete spalling with exposed reinforcement (${rebar.join(', ')}) should be repaired and the load-bearing capacity of the affected members further assessed.`,
    });
  }
  recommendations.push({
    vi: 'Bố trí các điểm quan trắc lún và nghiêng tại các góc công trình.',
    en: 'Settlement and tilt monitoring points should be installed at the building corners.',
  });

  // PL1, PL2
  const elevationPhotos = vm.appendix1
    .filter((p) => Boolean(p.base64 || p.url))
    .map((p, i) => ({ figNo: `A1.${i + 1}`, caption: p.name, src: p.base64 || p.url }));

  const floors = vm.appendix2
    .filter((f) => f.defectSummaryRows.length > 0 || f.hasCadMap)
    .map((f, i) => {
      const closeUps: Array<{ src: string; caption: BilingualText }> = [];
      const pushPhoto = (src: string | undefined, pair: DefectPairPhotoItem) => {
        if (!src) return;
        closeUps.push({ src, caption: { vi: `${pair.defectId} – ${pair.defectType.vi}`, en: pair.defectType.en } });
      };
      for (const pair of f.defectPairPhotos) {
        pushPhoto(pair.closeUpPhotoBase64 || pair.closeUpPhotoUrl, pair);
        if (pair.hasExtraCloseUp) pushPhoto(pair.extraCloseUpPhotoBase64 || pair.extraCloseUpPhotoUrl, pair);
      }
      return {
        code: `A2.${i + 1}`,
        floorName: f.floorName,
        mapSrc: f.damageMapBase64 || f.damageMapUrl || null,
        pins: (f.cadPins ?? []).filter((p) => p.type === 'DEFECT'),
        rows: f.defectSummaryRows.map((r) => ({
          ...r,
          typeLabel: r.defectType,
          burlandLabel: BURLAND_GRADE_LABELS[r.burlandGrade] ?? { vi: EM_DASH, en: EM_DASH },
        })),
        closeUps,
      };
    });

  const docDate = vm.metadata.surveyDateFormatted || vm.section1.surveyDate || '';
  return {
    docNo: vm.metadata.reportNo,
    revision: vm.metadata.revision,
    docDate,
    footerTitle: `${vm.metadata.buildingId} – ${vm.section1.buildingName.vi}${vm.section1.buildingName.en ? ` / ${vm.section1.buildingName.en}` : ''}`,
    defectTypes,
    burland,
    ecs,
    matrix,
    bra,
    overall: { levelNumber: risk.overall.level, level: overallLevel, narrative: overallNarrative },
    conclusions,
    recommendations,
    elevationPhotos,
    floors,
    risk,
  };
}
