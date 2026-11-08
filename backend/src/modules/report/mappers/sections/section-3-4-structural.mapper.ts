/**
 * ============================================================================
 * SECTION 3 & 4 MAPPER: HISTORY, STRUCTURE & FOUNDATION
 * Chương III: Lịch sử và tình trạng sử dụng & Chương IV: Đặc điểm kết cấu và móng
 * ============================================================================
 */

import { Section3HistoryOccupancy, Section4StructuralFoundation } from '../../report.types';
import { resolveHistoryInterviewAliases } from '../../../scoring/history-interview-aliases';
import { FOUNDATION_CAT_LABELS } from './foundation-cat-labels';

type LevelLabel = { vi: string; en: string };

/**
 * Nhãn mức 0..3 của 5 câu phỏng vấn E5. Phần VI chép NGUYÊN VĂN từ form thẩm định / khảo sát:
 * frontend/src/features/survey-phase1/constants/historyInterviewConstants.ts — sửa ở đó thì phải sửa ở đây.
 */
const RENOVATION_LABELS: LevelLabel[] = [
  { vi: 'Không', en: 'No' },
  { vi: 'Nhẹ - Đã xử lý ổn định', en: 'Minor - Stabilised' },
  { vi: 'Nhiều - Chưa rõ kết cấu', en: 'Substantial - Structure unverified' },
  { vi: 'Thay đổi lớn - Nghiêm trọng', en: 'Major change - Severe' },
];
export const MAJOR_REPAIR_LABELS: LevelLabel[] = [
  { vi: 'Không', en: 'No' },
  { vi: 'Nhẹ - Đã xử lý', en: 'Minor - Treated' },
  { vi: 'Nhiều - Chưa rõ hồ sơ', en: 'Substantial - Undocumented' },
  { vi: 'Cải tạo lớn ảnh hưởng chịu lực', en: 'Major alteration affecting load-bearing structure' },
];
const PAST_SETTLEMENT_LABELS: LevelLabel[] = [
  { vi: 'Không', en: 'No' },
  { vi: 'Nhẹ - Đã ổn định', en: 'Minor - Stabilised' },
  { vi: 'Rõ - Tiếp diễn', en: 'Evident - Ongoing' },
  { vi: 'Nghiêm trọng', en: 'Severe' },
];
const NEIGHBOR_DAMAGE_LABELS: LevelLabel[] = [
  { vi: 'Không', en: 'No' },
  { vi: 'Nhẹ - Đã bồi thường', en: 'Minor - Compensated' },
  { vi: 'Đáng kể', en: 'Significant' },
  { vi: 'Tranh chấp - Nghiêm trọng', en: 'Disputed - Severe' },
];
const FIRE_FLOOD_LABELS: LevelLabel[] = [
  { vi: 'Không', en: 'No' },
  { vi: 'Nhẹ - Đã khắc phục', en: 'Minor - Remediated' },
  { vi: 'Trung bình - Chưa rõ mức ảnh hưởng', en: 'Moderate - Impact unclear' },
  { vi: 'Nghiêm trọng', en: 'Severe' },
];

/** "<nhãn mức>[ (Năm: Y)][ – ghi chú]". Mức ngoài 0..3 in nguyên số, không tự quy đổi. */
function fmtLevel(labels: LevelLabel[], score: number, year: string, notes: string): LevelLabel {
  const label = Number.isInteger(score) && labels[score]
    ? labels[score]
    : { vi: `Mức ${score}`, en: `Level ${score}` };
  const noteSuffix = notes ? ` – ${notes}` : '';
  return {
    vi: `${label.vi}${year ? ` (Năm: ${year})` : ''}${noteSuffix}`,
    en: `${label.en}${year ? ` (Year: ${year})` : ''}${noteSuffix}`,
  };
}

export interface Section3And4Result {
  section3: Section3HistoryOccupancy;
  section4: Section4StructuralFoundation;
  majorRepair: number;
}

const STRUCT_RC = { vi: 'Khung bê tông cốt thép (BTCT) chịu lực', en: 'Reinforced Concrete (RC) Frame' };
const STRUCT_STEEL = { vi: 'Kết cấu khung thép / Nhà thép tiền chế', en: 'Structural Steel Frame / Pre-engineered Steel' };
const STRUCT_MASONRY = { vi: 'Tường gạch chịu lực (Unreinforced Masonry)', en: 'Unreinforced Load-bearing Masonry' };
const STRUCT_MIXED = { vi: 'Kết cấu hỗn hợp (Khung BTCT kết hợp tường gạch chịu lực)', en: 'Mixed Structure (RC Frame & Load-bearing Brick Wall)' };
const STRUCT_TEMP = { vi: 'Kết cấu tạm / Nhà cấp 4 / Khung gỗ - tôn', en: 'Substandard / Grade-4 / Timber-Corrugated Structure' };

/**
 * Nhãn hệ kết cấu chịu lực. Giá trị form có mã đầu chuỗi (STRUCTURE_SYSTEMS trong
 * frontend/src/features/survey-phase1/constants/surveyOptionsConstants.ts): nhận theo mã, KHÔNG dò từ khóa
 * — "RC - BTCT (Khung bê tông cốt thép …)" chứa chữ "thép" nên dò từ khóa sẽ ra nhầm khung thép.
 * "Khác: <mô tả>" in nguyên mô tả. Chỉ giá trị cũ dạng chữ tự do mới dò từ khóa.
 */
function mapStructureLabel(raw: string | undefined | null): { vi: string; en: string } {
  const text = String(raw ?? '').trim();
  if (!text) return { vi: 'Chưa xác định hệ kết cấu chịu lực', en: 'Unverified structural system' };

  const code = text.match(/^(RC|Steel|Masonry|Mixed|Other)\s*-/i)?.[1]?.toLowerCase();
  if (code === 'rc') return STRUCT_RC;
  if (code === 'steel') return STRUCT_STEEL;
  if (code === 'masonry') return STRUCT_MASONRY;
  if (code === 'mixed') return STRUCT_MIXED;

  const customMatch = text.match(/^Khác\s*:(.*)$/i);
  if (customMatch || code === 'other') {
    const desc = customMatch ? customMatch[1].trim() : '';
    return desc ? { vi: desc, en: desc } : { vi: 'Khác (chưa mô tả)', en: 'Other (not described)' };
  }

  // Giá trị cũ dạng chữ tự do / enum DB (vd. KHUNG_BTCT_CHIU_LUC): hỗn hợp → BTCT → gạch → thép → tạm.
  const s = text.toLowerCase();
  if (s.includes('hỗn hợp') || s.includes('mixed') || (s.includes('btct') && s.includes('gạch'))) return STRUCT_MIXED;
  if (s.includes('btct') || s.includes('bê tông') || s.includes('be tong') || s.includes('reinforced') || /\brc\b/.test(s)) return STRUCT_RC;
  if (s.includes('tường gạch') || s.includes('masonry') || s.includes('gạch chịu lực')) return STRUCT_MASONRY;
  if (s.includes('thép') || s.includes('steel') || s.includes('tiền chế') || s.includes('peb')) return STRUCT_STEEL;
  if (s.includes('tạm') || s.includes('cấp 4') || s.includes('cap 4') || s.includes('gỗ') || s.includes('timber')) return STRUCT_TEMP;
  return { vi: text, en: text };
}

export class Section3And4Mapper {
  public static map(
    rawReport: any,
    json: any,
    specs: any,
    // Không còn dùng: dòng "Tình trạng kết cấu quan sát được" đã bỏ (không có ô nhập; khuyết tật xem Mục VI).
    _structuralCracksCount: number,
    _surfaceCracksCount: number,
    rawFoundDepth: any
  ): Section3And4Result {
    const historyRaw = { ...(json.buildingHistory || {}), ...(json.historyInterview || {}) };
    let dbDetails: any = {};
    if (rawReport.historicalSensitivity?.details) {
      try {
        dbDetails = typeof rawReport.historicalSensitivity.details === 'string'
          ? JSON.parse(rawReport.historicalSensitivity.details)
          : rawReport.historicalSensitivity.details;
      } catch { /* ignore */ }
    }
    const historyObj = { ...dbDetails, ...historyRaw };

    // 5 câu phỏng vấn E5: đọc đúng khóa form thẩm định ghi (câu 4, 5 ưu tiên khóa mới, xem history-interview-aliases).
    const aliases = resolveHistoryInterviewAliases(historyObj);
    const renovationLoad = Number(historyObj.renovationLoad ?? (rawReport.historicalSensitivity?.extended_or_renovated ? 1 : 0));
    const majorRepair = Number(historyObj.majorRepair ?? historyObj.majorRepairHistory ?? 0);
    const pastSettlement = Number(historyObj.pastSettlement ?? (rawReport.historicalSensitivity?.previous_settlement_or_tilt ? 1 : 0));
    const neighborDamage = Number(aliases.neighbor ?? 0);
    const fireFloodIncident = Number(aliases.fireFlood ?? (rawReport.historicalSensitivity?.fire_or_accident ? 1 : 0));
    const rawUsage = historyObj.usageStatus;
    const usageStr = rawUsage !== undefined && rawUsage !== null && String(rawUsage).trim() !== '' ? String(rawUsage) : 'Chưa ghi nhận thông tin';
    const sensEquip = historyObj.sensitiveEquipment || { has: Boolean(rawReport.historicalSensitivity?.sensitive_equipment_present), description: '' };

    // Năm & ghi chú: đọc khóa form thẩm định ghi trong historyInterview trước, khóa cũ chỉ là dự phòng.
    const pickText = (...vals: unknown[]): string => {
      for (const v of vals) {
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    };
    const renovationYear = pickText(historyObj.renovationYear, json.renovationYear, historyObj.extensionYear, historyObj.changeUseYear);
    const renovationNotes = pickText(historyObj.renovationNotes, historyObj.extensionNotes, historyObj.changeUseNotes);
    const majorRepairYear = pickText(historyObj.majorRepairYear, historyObj.repairYear, json.majorRepairYear, json.repairYear, historyObj.alterationYear);
    const repairNotes = pickText(historyObj.repairNotes, historyObj.majorRepairNotes, historyObj.alterationNotes);
    const settlementYear = pickText(historyObj.settlementYear, json.settlementYear);
    const settlementNotes = pickText(historyObj.settlementNotes, historyObj.pastSettlementNotes);
    const neighborYear = pickText(historyObj.neighborYear, historyObj.neighborImpactYear, json.neighborImpactYear);
    const neighborNotes = pickText(historyObj.neighborNotes, historyObj.neighborImpactNotes);
    const fireFloodYear = pickText(historyObj.fireFloodYear, json.fireFloodYear);
    const fireFloodNotes = pickText(historyObj.fireFloodNotes);
    const generalInterviewNotes = String(historyObj.generalInterviewNotes ?? historyObj.notes ?? '').trim();

    const rawContOp = historyObj.continuousOperation247 ?? json.continuousOperation247;
    const hasContOp = typeof rawContOp === 'boolean'
      ? rawContOp
      : Boolean(rawContOp && typeof rawContOp === 'object' && (rawContOp as Record<string, unknown>).has);
    const contOpNotes = rawContOp && typeof rawContOp === 'object'
      ? String((rawContOp as Record<string, unknown>).notes ?? (rawContOp as Record<string, unknown>).description ?? '').trim()
      : '';

    const genNoteVi = generalInterviewNotes ? ` | Ghi chú phỏng vấn: ${generalInterviewNotes}` : '';
    const genNoteEn = generalInterviewNotes ? ` | Interview note: ${generalInterviewNotes}` : '';

    const renovationLoadHistory = fmtLevel(RENOVATION_LABELS, renovationLoad, renovationYear, renovationNotes);
    const majorRepairHistory = fmtLevel(MAJOR_REPAIR_LABELS, majorRepair, majorRepairYear, repairNotes);
    const fireFloodHistory = fmtLevel(FIRE_FLOOD_LABELS, fireFloodIncident, fireFloodYear, fireFloodNotes);

    const section3: Section3HistoryOccupancy = {
      renovationLoadHistory,
      majorRepairHistory,
      // Alias cũ giữ lại cho code/test còn đọc tên field trước khi gộp dòng.
      changeOfUse: renovationLoadHistory,
      extension: renovationLoadHistory,
      structuralAlteration: majorRepairHistory,
      majorRepair: majorRepairHistory,
      fireHistory: fireFloodHistory,
      flooding: fireFloodHistory,
      fireAndFlooding: fireFloodHistory,
      previousSettlementTilt: fmtLevel(PAST_SETTLEMENT_LABELS, pastSettlement, settlementYear, settlementNotes),
      occupancyStatus: usageStr === 'Chưa ghi nhận thông tin'
        ? { vi: 'Chưa ghi nhận thông tin', en: 'Unrecorded' }
        : usageStr.includes('Đầy đủ') ? { vi: 'Đang sử dụng bình thường (100%)', en: 'In normal full use (100%)' }
        : usageStr.includes('một phần') ? { vi: 'Đang sử dụng một phần', en: 'Partially occupied' }
        : (usageStr.includes('Bỏ trống') || usageStr.includes('Không sử dụng')) ? { vi: 'Bỏ trống – Không sử dụng', en: 'Vacant / Unoccupied' }
        : { vi: usageStr.includes('Đang') ? usageStr : `Đang sử dụng (${usageStr})`, en: `In use (${usageStr})` },
      sensitiveEquipment: sensEquip.has
        ? { vi: `Có: ${sensEquip.description || 'Chủ hộ chưa cung cấp danh mục thiết bị cụ thể'}`, en: `Yes: ${sensEquip.description || 'Specific equipment list unrecorded'}` }
        : { vi: 'Không có thiết bị nhạy cảm rung động', en: 'No vibration-sensitive equipment' },
      continuousOperation: {
        vi: `${hasContOp ? 'Có hoạt động liên tục 24/7' : 'Không'}${contOpNotes ? ` (${contOpNotes})` : ''}`,
        en: `${hasContOp ? 'Yes – 24/7 continuous operation' : 'No'}${contOpNotes ? ` (${contOpNotes})` : ''}`,
      },
      damageByAdjacentWorks: fmtLevel(NEIGHBOR_DAMAGE_LABELS, neighborDamage, neighborYear, neighborNotes),
      informationSource: (() => {
        const explicitSource = historyObj.informationSource || json.informationSource;
        let baseSrc = { vi: 'Phỏng vấn chủ hộ', en: 'Property owner interview' };
        if (explicitSource && typeof explicitSource === 'string' && explicitSource.trim() !== '') {
          const s = explicitSource.trim();
          baseSrc = { vi: s, en: s.toLowerCase().includes('quan sát') ? 'Site observation' : s.toLowerCase().includes('phỏng vấn') ? 'Property owner interview' : s };
        } else if (json.isAbsenteeSurvey || rawReport.is_absentee_survey || json.surveyCaseType === 'ABSENTEE') {
          baseSrc = { vi: 'Quan sát hiện trường', en: 'Site observation' };
        } else if (json.isVacantLand || rawReport.is_vacant_land || json.surveyCaseType === 'VACANT_LAND') {
          baseSrc = { vi: 'Khảo sát thực địa', en: 'Field inspection' };
        }
        return {
          vi: `${baseSrc.vi}${genNoteVi}`,
          en: `${baseSrc.en}${genNoteEn}`,
        };
      })(),
    };

    const isVacantLand = Boolean(json.isVacantLand || rawReport.is_vacant_land || json.surveyCaseType === 'VACANT_LAND');

    const mappedStruct = mapStructureLabel(json.structureSystem || specs.structural_system || specs.structuralSystem || '');
    const structTypeVi = isVacantLand ? 'Khu đất trống – Không có công trình xây dựng' : mappedStruct.vi;
    const structTypeEn = isVacantLand ? 'Vacant land – No building structure' : mappedStruct.en;

    const rawFoundType = (json.foundationType || specs.foundation_category || specs.foundationType || '').toLowerCase();
    let foundTypeVi = 'Chưa xác định / Chưa có hồ sơ móng';
    let foundTypeEn = 'Unverified / Unknown Foundation Type';
    if (isVacantLand) { foundTypeVi = 'Không có móng (Đất trống)'; foundTypeEn = 'No foundation (Vacant land)'; }
    else if (rawFoundType.includes('nông') || rawFoundType.includes('băng') || rawFoundType.includes('đơn') || rawFoundType.includes('bè') || rawFoundType.includes('shallow')) { foundTypeVi = 'Móng nông (Móng băng / Móng đơn / Móng bè)'; foundTypeEn = 'Shallow Foundation (Strip / Pad / Raft)'; }
    else if (rawFoundType.includes('pc') || rawFoundType.includes('cọc ép')) { foundTypeVi = 'Móng cọc ép bê tông cốt thép (PC)'; foundTypeEn = 'Precast Reinforced Concrete Driven Pile'; }
    else if (rawFoundType.includes('cip') || rawFoundType.includes('khoan nhồi')) { foundTypeVi = 'Móng cọc khoan nhồi (CIP)'; foundTypeEn = 'Cast-in-place Bored Pile'; }
    else if (rawFoundType.includes('wood') || rawFoundType.includes('cừ tràm')) { foundTypeVi = 'Móng cừ tràm gia cố nền đất yếu'; foundTypeEn = 'Melaleuca Wooden Pile Foundation'; }

    const rawPileDiameter = json.pileDiameterMm ?? specs.pileDiameterMm ?? specs.pile_diameter_mm;
    const rawPileDim =
      json.pileDimension ||
      json.pileDimensionMm ||
      specs.pile_dimensions ||
      (rawPileDiameter !== undefined && rawPileDiameter !== null && String(rawPileDiameter).trim() !== ''
        ? `Ø${String(rawPileDiameter).trim().replace(/mm$/i, '').trim()} mm`
        : '') ||
      (json.pileWidthMm && json.pileLengthMm ? `${json.pileWidthMm} × ${json.pileLengthMm} mm` : '');
    const pileDim = rawPileDim && !/mm/i.test(String(rawPileDim)) && /^\d+(\.\d+)?$/.test(String(rawPileDim).trim())
      ? `${String(rawPileDim).trim()} mm`
      : String(rawPileDim || '');
    let pileSizeVi = pileDim;
    let pileSizeEn = pileDim;
    if (isVacantLand) { pileSizeVi = 'Không dùng cọc (Đất trống)'; pileSizeEn = 'No piles (Vacant land)'; }
    else if (!pileDim) {
      pileSizeVi = foundTypeVi.includes('Móng nông') ? 'Móng nông – Không dùng cọc' : 'Chưa có số liệu kích thước';
      pileSizeEn = foundTypeVi.includes('Móng nông') ? 'Shallow foundation – No piles' : 'Not recorded / Unverified';
    }

    let foundDepthVi = 'Chưa xác định độ sâu đáy móng';
    let foundDepthEn = 'Unverified foundation depth';
    if (isVacantLand) { foundDepthVi = '0.0 m (Đất trống)'; foundDepthEn = '0.0 m (Vacant land)'; }
    else if (rawFoundDepth !== undefined && rawFoundDepth !== null && rawFoundDepth !== '' && Number(rawFoundDepth) > 0) {
      foundDepthVi = `${Number(rawFoundDepth).toFixed(1)} m (Độ sâu đáy móng so với cốt nền)`;
      foundDepthEn = `${Number(rawFoundDepth).toFixed(1)} m (Foundation base depth from ground level)`;
    }

    const rawFoundCat = Number(json.foundationCatScore || specs.foundation_cat_score || 5);
    const catEvidenceMap = FOUNDATION_CAT_LABELS;
    const foundEvidence = isVacantLand ? { vi: 'Khảo sát hiện trạng đất trống (N/A)', en: 'Vacant land observation (N/A)' } : (catEvidenceMap[rawFoundCat] || catEvidenceMap[5]);

    let adjSummaryVi = 'Chưa ghi nhận thông tin công trình liền kề';
    let adjSummaryEn = 'Adjacent buildings data unrecorded';
    const rawAdj = json.adjacentBuildings || specs.adjacent_buildings || specs.adjacentBuildings;
    if (rawAdj) {
      try {
        const parsedAdj = typeof rawAdj === 'string' ? JSON.parse(rawAdj) : rawAdj;
        const formatSide = (sideObj: Record<string, unknown> | null | undefined) => {
          if (!sideObj) return { vi: '', en: '' };
          const sType = String(sideObj.type || sideObj.structure || sideObj.details || '').trim();
          const sFloors = sideObj.floors ? `${sideObj.floors} tầng` : '';
          const sFloorsEn = sideObj.floors ? `${sideObj.floors} storeys` : '';
          const sContact = String(
            sideObj.contact ||
            (sideObj.sharedWall === true ? 'Tường chung' : sideObj.sharedWall === false ? 'Tường riêng' : sideObj.sharedWall || '')
          ).trim();
          const sNotes = String(sideObj.note || sideObj.notes || sideObj.condition || '').trim();
          let typeEn = sType;
          if (sType.includes('Nhà') || sType.includes('TOWN_HOUSE')) typeEn = 'Residential Townhouse';
          else if (sType.includes('Hẻm') || sType.includes('Đường')) typeEn = 'Alley / Internal Road';
          else if (sType.includes('Đất') || sType.includes('VACANT_LAND')) typeEn = 'Vacant Land';
          return { vi: [sType, sFloors, sContact, sNotes].filter(Boolean).join(' - '), en: [typeEn, sFloorsEn, sContact, sNotes].filter(Boolean).join(' - ') };
        };
        const left = parsedAdj.left ? formatSide(parsedAdj.left) : { vi: '', en: '' };
        const right = parsedAdj.right ? formatSide(parsedAdj.right) : { vi: '', en: '' };
        const back = (parsedAdj.back || parsedAdj.rear) ? formatSide(parsedAdj.back || parsedAdj.rear) : { vi: '', en: '' };
        if (left.vi || right.vi || back.vi) {
          const pVi: string[] = []; const pEn: string[] = [];
          if (left.vi) { pVi.push(`Trái: ${left.vi}`); pEn.push(`Left: ${left.en}`); }
          if (right.vi) { pVi.push(`Phải: ${right.vi}`); pEn.push(`Right: ${right.en}`); }
          if (back.vi) { pVi.push(`Sau: ${back.vi}`); pEn.push(`Rear: ${back.en}`); }
          adjSummaryVi = pVi.join(' | '); adjSummaryEn = pEn.join(' | ');
        }
      } catch { /* ignore */ }
    }

    // Mật độ (SL/m²) & khoảng cách giữa móng (m): đúng 2 ô trên form thẩm định; trống thì không bịa số.
    const pickNum = (...vals: unknown[]): string => {
      for (const v of vals) {
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    };
    const rawFDensity = pickNum(json.foundationDensity, specs.foundation_density, specs.footingDensity);
    const rawFSpacing = pickNum(json.foundationSpacingM, specs.foundation_spacing_m, specs.footingSpacing);
    let footingDensitySpacingVi = 'Không có số liệu';
    let footingDensitySpacingEn = 'No data';
    if (isVacantLand) { footingDensitySpacingVi = 'Không có móng (Đất trống)'; footingDensitySpacingEn = 'No foundation (Vacant land)'; }
    else if (rawFDensity || rawFSpacing) {
      const fdPartsVi: string[] = []; const fdPartsEn: string[] = [];
      // Chỉ gắn đơn vị của form khi giá trị là số thuần; dữ liệu cũ dạng chữ (vd. "4 cọc/đài") in nguyên văn.
      const isPlainNum = (v: string) => /^-?\d+(\.\d+)?$/.test(v);
      if (rawFDensity) {
        fdPartsVi.push(`Mật độ: ${rawFDensity}${isPlainNum(rawFDensity) ? ' SL/m²' : ''}`);
        fdPartsEn.push(`Density: ${rawFDensity}${isPlainNum(rawFDensity) ? ' units/m²' : ''}`);
      }
      if (rawFSpacing) {
        fdPartsVi.push(`Khoảng cách giữa móng: ${rawFSpacing}${isPlainNum(rawFSpacing) ? ' m' : ''}`);
        fdPartsEn.push(`Footing spacing: ${rawFSpacing}${isPlainNum(rawFSpacing) ? ' m' : ''}`);
      }
      footingDensitySpacingVi = fdPartsVi.join(' | '); footingDensitySpacingEn = fdPartsEn.join(' | ');
    }

    // Ghi chú kỹ thuật = đúng ô "Ghi chú móng" trên form; trống thì "Không" như form hiển thị, không tự sinh câu.
    const rawFNotes = pickNum(json.foundationNotes, specs.foundation_notes);
    const remarksVi = rawFNotes || 'Không';
    const remarksEn = rawFNotes || 'None';

    return {
      section3,
      section4: {
        structuralType: { vi: structTypeVi, en: structTypeEn },
        foundationType: { vi: foundTypeVi, en: foundTypeEn },
        pileSize: { vi: pileSizeVi, en: pileSizeEn },
        footingDensitySpacing: { vi: footingDensitySpacingVi, en: footingDensitySpacingEn },
        foundationDepth: { vi: foundDepthVi, en: foundDepthEn },
        adjacentBuildings: { vi: adjSummaryVi, en: adjSummaryEn },
        foundationEvidence: foundEvidence,
        remarks: { vi: remarksVi, en: remarksEn },
      },
      majorRepair,
    };
  }
}

