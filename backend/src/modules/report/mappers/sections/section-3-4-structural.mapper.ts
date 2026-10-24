/**
 * ============================================================================
 * SECTION 3 & 4 MAPPER: HISTORY, STRUCTURE & FOUNDATION
 * Chương III: Lịch sử và tình trạng sử dụng & Chương IV: Đặc điểm kết cấu và móng
 * ============================================================================
 */

import { Section3HistoryOccupancy, Section4StructuralFoundation } from '../../report.types';

export interface Section3And4Result {
  section3: Section3HistoryOccupancy;
  section4: Section4StructuralFoundation;
  majorRepair: number;
}

function mapStructureLabel(raw: string | undefined | null): { vi: string; en: string } {
  const s = (raw || '').toLowerCase();
  if (!s.trim()) return { vi: 'Chưa xác định hệ kết cấu chịu lực', en: 'Unverified structural system' };
  if (s.includes('tạm') || s.includes('cấp 4') || s.includes('cap 4') || s.includes('gỗ') || s.includes('substandard') || s.includes('timber')) {
    return { vi: 'Kết cấu tạm / Nhà cấp 4 / Khung gỗ - tôn', en: 'Substandard / Grade-4 / Timber-Corrugated Structure' };
  }
  if (s.includes('thép') || s.includes('steel') || s.includes('tiền chế') || s.includes('peb') || s.includes('kèo thép')) {
    return { vi: 'Kết cấu khung thép / Nhà thép tiền chế', en: 'Structural Steel Frame / Pre-engineered Steel' };
  }
  if (s.includes('tường gạch') || s.includes('masonry') || s.includes('gạch chịu lực') || s.includes('load-bearing')) {
    return { vi: 'Tường gạch chịu lực (Unreinforced Masonry)', en: 'Unreinforced Load-bearing Masonry' };
  }
  if (s.includes('hỗn hợp') || s.includes('mixed') || (s.includes('btct') && s.includes('gạch')) || (s.includes('rc') && s.includes('brick'))) {
    return { vi: 'Kết cấu hỗn hợp (Khung BTCT kết hợp tường gạch chịu lực)', en: 'Mixed Structure (RC Frame & Load-bearing Brick Wall)' };
  }
  if (s.includes('btct') || s.includes('rc') || s.includes('bê tông') || s.includes('be tong') || s.includes('reinforced')) {
    return { vi: 'Khung bê tông cốt thép (BTCT) chịu lực', en: 'Reinforced Concrete (RC) Frame' };
  }
  const cleanCustom = String(raw).replace(/^Khác:\s*/i, '').trim();
  return {
    vi: cleanCustom || 'Hệ kết cấu khác (Theo khảo sát thực tế)',
    en: cleanCustom || 'Other Structural System (As surveyed)',
  };
}

export class Section3And4Mapper {
  public static map(
    rawReport: any,
    json: any,
    specs: any,
    structuralCracksCount: number,
    surfaceCracksCount: number,
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

    const renovationLoad = Number(historyObj.renovationLoad ?? (rawReport.historicalSensitivity?.extended_or_renovated ? 1 : 0));
    const changeOfUseVal = Number(historyObj.changeOfUse ?? renovationLoad);
    const extensionVal = Number(historyObj.extension ?? renovationLoad);
    const majorRepair = Number(historyObj.majorRepair ?? historyObj.majorRepairHistory ?? 0);
    const structAltVal = Number(historyObj.structuralAlteration ?? historyObj.renovationLoad ?? majorRepair);
    const pastSettlement = Number(historyObj.pastSettlement ?? (rawReport.historicalSensitivity?.previous_settlement_or_tilt ? 1 : 0));
    const neighborDamage = Number(historyObj.neighborImpact ?? historyObj.neighborDamage ?? 0);
    const fireFloodVal = historyObj.fireFloodHistory ?? historyObj.fireFloodIncident;
    const fireFloodIncident = Number(fireFloodVal ?? (rawReport.historicalSensitivity?.fire_or_accident ? 1 : 0));
    const rawUsage = historyObj.usageStatus;
    const usageStr = rawUsage !== undefined && rawUsage !== null && String(rawUsage).trim() !== '' ? String(rawUsage) : 'Chưa ghi nhận thông tin';
    const sensEquip = historyObj.sensitiveEquipment || { has: Boolean(rawReport.historicalSensitivity?.sensitive_equipment_present), description: '' };

    const renovationYear = String(json.renovationYear ?? historyObj.renovationYear ?? '').trim();
    const changeUseYear = String(historyObj.changeUseYear ?? json.changeUseYear ?? renovationYear).trim();
    const changeUseNotes = String(historyObj.changeUseNotes ?? json.changeUseNotes ?? '').trim();
    const extensionYear = String(historyObj.extensionYear ?? json.extensionYear ?? renovationYear).trim();
    const extensionNotes = String(historyObj.extensionNotes ?? json.extensionNotes ?? '').trim();
    const alterationYear = String(historyObj.alterationYear ?? json.alterationYear ?? json.majorRepairYear ?? historyObj.majorRepairYear ?? '').trim();
    const alterationNotes = String(historyObj.alterationNotes ?? json.alterationNotes ?? historyObj.repairNotes ?? historyObj.majorRepairNotes ?? '').trim();
    const majorRepairYear = String(json.majorRepairYear ?? historyObj.majorRepairYear ?? historyObj.repairYear ?? json.repairYear ?? '').trim();
    const repairNotes = String(historyObj.repairNotes ?? historyObj.majorRepairNotes ?? '').trim();
    const settlementYear = String(historyObj.settlementYear ?? json.settlementYear ?? '').trim();
    const settlementNotes = String(historyObj.settlementNotes ?? historyObj.pastSettlementNotes ?? '').trim();
    const neighborYear = String(historyObj.neighborImpactYear ?? historyObj.neighborYear ?? json.neighborImpactYear ?? '').trim();
    const neighborNotes = String(historyObj.neighborImpactNotes ?? historyObj.neighborNotes ?? '').trim();
    const fireFloodYear = String(historyObj.fireFloodYear ?? json.fireFloodYear ?? '').trim();
    const fireFloodNotes = String(historyObj.fireFloodNotes ?? '').trim();
    const generalInterviewNotes = String(historyObj.generalInterviewNotes ?? historyObj.notes ?? '').trim();

    const rawContOp = historyObj.continuousOperation247 ?? json.continuousOperation247;
    const hasContOp = typeof rawContOp === 'boolean'
      ? rawContOp
      : Boolean(rawContOp && typeof rawContOp === 'object' && (rawContOp as Record<string, unknown>).has);
    const contOpNotes = rawContOp && typeof rawContOp === 'object'
      ? String((rawContOp as Record<string, unknown>).notes ?? (rawContOp as Record<string, unknown>).description ?? '').trim()
      : '';

    const changeUseYearVi = changeUseYear ? ` (Năm: ${changeUseYear})` : '';
    const changeUseYearEn = changeUseYear ? ` (Year: ${changeUseYear})` : '';
    const changeUseNoteSuffix = changeUseNotes ? ` – ${changeUseNotes}` : '';
    const extYearVi = extensionYear ? ` (Năm cải tạo/mở rộng: ${extensionYear})` : '';
    const extYearEn = extensionYear ? ` (Extended/Renovated: ${extensionYear})` : '';
    const extNoteSuffix = extensionNotes ? ` – ${extensionNotes}` : '';
    const altYearVi = alterationYear ? ` (Năm cải tạo: ${alterationYear})` : '';
    const altYearEn = alterationYear ? ` (Alteration year: ${alterationYear})` : '';
    const altNoteSuffix = alterationNotes ? ` – ${alterationNotes}` : '';
    const repYearVi = majorRepairYear ? ` (Năm sửa chữa: ${majorRepairYear})` : '';
    const repYearEn = majorRepairYear ? ` (Repair year: ${majorRepairYear})` : '';
    const repNoteSuffix = repairNotes ? ` – ${repairNotes}` : '';
    const settleYearVi = settlementYear ? ` (Năm: ${settlementYear})` : '';
    const settleYearEn = settlementYear ? ` (Year: ${settlementYear})` : '';
    const settleNoteSuffix = settlementNotes ? ` – ${settlementNotes}` : '';
    const neighborYearVi = neighborYear ? ` (Năm: ${neighborYear})` : '';
    const neighborYearEn = neighborYear ? ` (Year: ${neighborYear})` : '';
    const neighborNoteSuffix = neighborNotes ? ` – ${neighborNotes}` : '';
    const fireFloodYearVi = fireFloodYear ? ` (Năm: ${fireFloodYear})` : '';
    const fireFloodYearEn = fireFloodYear ? ` (Year: ${fireFloodYear})` : '';
    const fireFloodNoteSuffix = fireFloodNotes ? ` – ${fireFloodNotes}` : '';
    const genNoteVi = generalInterviewNotes ? ` | Ghi chú phỏng vấn: ${generalInterviewNotes}` : '';
    const genNoteEn = generalInterviewNotes ? ` | Interview note: ${generalInterviewNotes}` : '';

    const baseExtension = extensionVal === 0
      ? { vi: 'Không ghi nhận', en: 'Not recorded' }
      : extensionVal === 1 ? { vi: 'Có cơi nới nhẹ / sửa chữa nhỏ', en: 'Minor extension reported' }
      : { vi: 'Có cơi nới / mở rộng quy mô lớn', en: 'Substantial extension reported' };

    const baseStructAlt = structAltVal === 0
      ? { vi: 'Không ghi nhận', en: 'Not recorded' }
      : structAltVal === 1 ? { vi: 'Có cải tạo nhẹ kết cấu', en: 'Minor structural alteration' }
      : { vi: 'Có cải tạo lớn ảnh hưởng chịu lực', en: 'Major structural alteration' };

    const baseMajorRepair = majorRepair === 0
      ? { vi: 'Không', en: 'No' }
      : majorRepair === 1 ? { vi: 'Có – Nhẹ, đã xử lý ổn định', en: 'Yes – Minor, stabilised' }
      : majorRepair === 2 ? { vi: 'Có – Nhiều, chưa rõ hồ sơ hoàn công', en: 'Yes – Substantial, unverified documentation' }
      : { vi: 'Có – Cải tạo lớn ảnh hưởng chịu lực', en: 'Yes – Major structural repair' };

    const baseFireFlood = fireFloodIncident === 0
      ? { vi: 'Cháy: Không | Ngập lụt: Không', en: 'Fire: None | Flooding: None' }
      : fireFloodIncident === 1 ? { vi: 'Cháy: Không | Ngập lụt: Nhẹ (đã khắc phục)', en: 'Fire: None | Flooding: Minor (remediated)' }
      : fireFloodIncident === 2 ? { vi: 'Có sự cố trung bình (chưa rõ ảnh hưởng)', en: 'Moderate fire/flooding incident recorded' }
      : { vi: 'Có sự cố nghiêm trọng (ảnh hưởng kết cấu)', en: 'Severe fire/flooding incident recorded' };

    const basePastSettle = pastSettlement === 0
      ? { vi: 'Không phát hiện lún nghiêng trước đây', en: 'No prior settlement or tilt observed' }
      : pastSettlement === 1 ? { vi: 'Có ghi nhận lún nghiêng nhẹ (đã ổn định)', en: 'Minor past settlement/tilt reported (stabilised)' }
      : pastSettlement === 2 ? { vi: 'Có ghi nhận lún nghiêng rõ (tiếp diễn)', en: 'Evident ongoing settlement/tilt reported' }
      : { vi: 'Có sự cố lún nghiêng nghiêm trọng', en: 'Severe settlement/tilt incident reported' };

    const baseNeighbor = neighborDamage === 0
      ? { vi: 'Không', en: 'No' }
      : neighborDamage === 1 ? { vi: 'Có – Nhẹ, đã bồi thường/khắc phục', en: 'Yes – Minor, compensated/repaired' }
      : neighborDamage === 2 ? { vi: 'Có – Ảnh hưởng đáng kể', en: 'Yes – Substantial damage' }
      : { vi: 'Có – Tranh chấp / Ảnh hưởng nghiêm trọng', en: 'Yes – Severe damage / Disputed' };

    const section3: Section3HistoryOccupancy = {
      changeOfUse: changeOfUseVal === 0 && !changeUseYear && !changeUseNotes
        ? { vi: 'Không ghi nhận', en: 'Not recorded' }
        : changeOfUseVal <= 1 ? { vi: `Nhẹ – Đã xử lý ổn định${changeUseYearVi}${changeUseNoteSuffix}`, en: `Minor – Stabilised${changeUseYearEn}${changeUseNoteSuffix}` }
        : changeOfUseVal === 2 ? { vi: `Nhiều – Chưa rõ kết cấu${changeUseYearVi}${changeUseNoteSuffix}`, en: `Moderate – Unclear structure${changeUseYearEn}${changeUseNoteSuffix}` }
        : { vi: `Thay đổi lớn – Ảnh hưởng tải trọng${changeUseYearVi}${changeUseNoteSuffix}`, en: `Major – Significant loading change${changeUseYearEn}${changeUseNoteSuffix}` },
      extension: {
        vi: `${baseExtension.vi}${extYearVi}${extNoteSuffix}`,
        en: `${baseExtension.en}${extYearEn}${extNoteSuffix}`,
      },
      structuralAlteration: {
        vi: `${baseStructAlt.vi}${altYearVi}${altNoteSuffix}`,
        en: `${baseStructAlt.en}${altYearEn}${altNoteSuffix}`,
      },
      majorRepair: {
        vi: `${baseMajorRepair.vi}${repYearVi}${repNoteSuffix}`,
        en: `${baseMajorRepair.en}${repYearEn}${repNoteSuffix}`,
      },
      fireHistory: fireFloodIncident <= 1 ? { vi: `Không${fireFloodYearVi}${fireFloodNoteSuffix}`, en: `None${fireFloodYearEn}${fireFloodNoteSuffix}` } : { vi: `Có ghi nhận${fireFloodYearVi}${fireFloodNoteSuffix}`, en: `Recorded${fireFloodYearEn}${fireFloodNoteSuffix}` },
      flooding: fireFloodIncident === 0 ? { vi: `Không${fireFloodYearVi}${fireFloodNoteSuffix}`, en: `None${fireFloodYearEn}${fireFloodNoteSuffix}` } : fireFloodIncident === 1 ? { vi: `Nhẹ (đã khắc phục)${fireFloodYearVi}${fireFloodNoteSuffix}`, en: `Minor (remediated)${fireFloodYearEn}${fireFloodNoteSuffix}` } : { vi: `Có ghi nhận${fireFloodYearVi}${fireFloodNoteSuffix}`, en: `Recorded${fireFloodYearEn}${fireFloodNoteSuffix}` },
      fireAndFlooding: {
        vi: `${baseFireFlood.vi}${fireFloodYearVi}${fireFloodNoteSuffix}`,
        en: `${baseFireFlood.en}${fireFloodYearEn}${fireFloodNoteSuffix}`,
      },
      previousSettlementTilt: {
        vi: `${basePastSettle.vi}${settleYearVi}${settleNoteSuffix}`,
        en: `${basePastSettle.en}${settleYearEn}${settleNoteSuffix}`,
      },
      occupancyStatus: usageStr === 'Chưa ghi nhận thông tin'
        ? { vi: 'Chưa ghi nhận thông tin', en: 'Unrecorded' }
        : usageStr.includes('Đầy đủ') ? { vi: 'Đang sử dụng bình thường (100%)', en: 'In normal full use (100%)' }
        : usageStr.includes('một phần') ? { vi: 'Đang sử dụng một phần', en: 'Partially occupied' }
        : (usageStr.includes('Bỏ trống') || usageStr.includes('Không sử dụng')) ? { vi: 'Bỏ trống – Không sử dụng', en: 'Vacant / Unoccupied' }
        : { vi: usageStr.includes('Đang') ? usageStr : `Đang sử dụng (${usageStr})`, en: `In use (${usageStr})` },
      sensitiveEquipment: sensEquip.has
        ? { vi: `Có: ${sensEquip.description || 'Chủ hộ chưa cung cấp danh mục thiết bị cụ thể'}`, en: `Yes: ${sensEquip.description || 'Specific equipment list unrecorded'}` }
        : { vi: 'Không có thiết bị nhạy cảm rung động', en: 'No vibration-sensitive equipment' },
      continuousOperation: (hasContOp || Boolean(contOpNotes))
        ? {
            vi: `${hasContOp ? 'Có hoạt động liên tục 24/7' : 'Vận hành thông thường'}${contOpNotes ? ` (${contOpNotes})` : ''}`,
            en: `${hasContOp ? '24/7 continuous operation' : 'Standard operation'}${contOpNotes ? ` (${contOpNotes})` : ''}`,
          }
        : undefined,
      damageByAdjacentWorks: {
        vi: `${baseNeighbor.vi}${neighborYearVi}${neighborNoteSuffix}`,
        en: `${baseNeighbor.en}${neighborYearEn}${neighborNoteSuffix}`,
      },
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
    const isUnderConstruction = Boolean(json.surveyCaseType === 'UNDER_CONSTRUCTION');

    const mappedStruct = mapStructureLabel(json.structureSystem || specs.structural_system || specs.structuralSystem || '');
    const structTypeVi = isVacantLand ? 'Khu đất trống – Không có công trình xây dựng' : mappedStruct.vi;
    const structTypeEn = isVacantLand ? 'Vacant land – No building structure' : mappedStruct.en;

    const explicitForm = json.structuralForm || specs.structural_form || specs.structuralForm;
    const bldgTypeStr = (json.usageFunction || json.buildingName || rawReport.building_type || json.surveyCaseType || '').toLowerCase();
    let structFormVi = explicitForm && String(explicitForm).trim() !== '' ? String(explicitForm).trim() : 'Nhà phố liên kế nhiều tầng (Row / Terraced House)';
    let structFormEn = explicitForm && String(explicitForm).trim() !== '' ? String(explicitForm).trim() : 'Terraced Row House';
    if (!explicitForm) {
      if (isVacantLand) { structFormVi = 'Khu đất trống (Vacant land)'; structFormEn = 'Vacant land'; }
      else if (bldgTypeStr.includes('biệt thự') || bldgTypeStr.includes('độc lập') || bldgTypeStr.includes('standalone')) { structFormVi = 'Nhà riêng lẻ độc lập (Detached Single House)'; structFormEn = 'Standalone / Detached House'; }
      else if (bldgTypeStr.includes('thương mại') || bldgTypeStr.includes('shophouse') || bldgTypeStr.includes('văn phòng')) { structFormVi = 'Nhà phố thương mại / Văn phòng dịch vụ'; structFormEn = 'Commercial Shophouse / Office Building'; }
    }

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
    const catEvidenceMap: Record<number, { vi: string; en: string }> = {
      1: { vi: 'Hồ sơ hoàn công được phê duyệt (CAT 1)', en: 'Approved as-built documentation (CAT 1)' },
      2: { vi: 'Bản vẽ thiết kế kết cấu do chủ hộ lưu giữ (CAT 2)', en: 'Design drawings kept by owner (CAT 2)' },
      3: { vi: 'Phỏng vấn chủ hộ xác nhận (CAT 3)', en: 'Property owner statement (CAT 3)' },
      4: { vi: 'Suy luận chuyên môn KSV tại hiện trường (CAT 4)', en: 'Surveyor on-site engineering assessment (CAT 4)' },
      5: { vi: 'Chưa có hồ sơ móng / Chưa xác định (CAT 5)', en: 'Unverified / No foundation documentation (CAT 5)' },
    };
    const foundEvidence = isVacantLand ? { vi: 'Khảo sát hiện trạng đất trống (N/A)', en: 'Vacant land observation (N/A)' } : (catEvidenceMap[rawFoundCat] || catEvidenceMap[5]);

    const explicitVisibleStruct = json.visibleStructuralCondition || specs.visible_structural_condition || specs.visibleStructuralCondition;
    let visibleStructVi = explicitVisibleStruct && String(explicitVisibleStruct).trim() !== ''
      ? String(explicitVisibleStruct).trim()
      : 'Các cấu kiện chịu lực chính (cột, dầm, sàn) nguyên vẹn, ổn định tại thời điểm khảo sát';
    let visibleStructEn = explicitVisibleStruct && String(explicitVisibleStruct).trim() !== ''
      ? String(explicitVisibleStruct).trim()
      : 'Main load-bearing elements (columns, beams, slabs) intact and stable at survey time';
    if (!explicitVisibleStruct) {
      if (isVacantLand) { visibleStructVi = 'Hiện trạng đất trống, không có kết cấu công trình xây dựng'; visibleStructEn = 'Vacant land, no building structures present'; }
      else if (isUnderConstruction) { visibleStructVi = 'Công trình đang thi công xây dựng dở dang (xem ghi chú kỹ thuật)'; visibleStructEn = 'Building under active construction / structural works in progress'; }
      else if (structuralCracksCount > 0) {
        visibleStructVi = `Ghi nhận khuyết tật trên cấu kiện kết cấu (${structuralCracksCount} vị trí, xem chi tiết Mục VI & Phụ lục 2)`;
        visibleStructEn = `Structural member defects observed (${structuralCracksCount} location(s), see Section VI & Appendix 2)`;
      } else if (surfaceCracksCount > 0) {
        visibleStructVi = 'Các cấu kiện chịu lực chính (cột, dầm, sàn) ổn định; ghi nhận nứt vữa hoàn thiện kiến trúc';
        visibleStructEn = 'Main load-bearing elements intact; minor aesthetic plaster cracks observed';
      }
    }

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

    const rawFDensity = json.foundationDensity || specs.foundation_density || specs.footingDensity;
    const rawFSpacing = json.foundationSpacingM || specs.foundation_spacing_m || specs.footingSpacing;
    let footingDensitySpacingVi = 'Chưa ghi nhận';
    let footingDensitySpacingEn = 'Not recorded';
    if (rawFDensity || rawFSpacing) {
      const fdPartsVi: string[] = []; const fdPartsEn: string[] = [];
      if (rawFDensity) { fdPartsVi.push(`Mật độ: ${rawFDensity}`); fdPartsEn.push(`Density: ${rawFDensity}`); }
      if (rawFSpacing) { fdPartsVi.push(`Khoảng cách tim: ${rawFSpacing} m`); fdPartsEn.push(`Spacing: ${rawFSpacing} m`); }
      footingDensitySpacingVi = fdPartsVi.join(' | '); footingDensitySpacingEn = fdPartsEn.join(' | ');
    }

    const rawFNotes = json.foundationNotes || specs.foundation_notes;
    const hasDrawings = Boolean(
      specs.hasAsBuiltDrawings ||
      specs.hasDrawings ||
      json.hasDrawings ||
      json.hasAsBuiltDrawings ||
      (Array.isArray(json.asBuiltDrawingPhotos) && json.asBuiltDrawingPhotos.length > 0) ||
      rawFoundCat <= 2
    );
    const remarksVi = rawFNotes || (hasDrawings
      ? 'Thông tin hệ kết cấu và móng được tổng hợp từ hồ sơ hoàn công và khảo sát trực quan hiện trường.'
      : 'Thông tin hệ kết cấu và móng ghi nhận từ khảo sát trực quan hiện trường (chủ hộ chưa cung cấp hồ sơ hoàn công/thiết kế kết cấu).');
    const remarksEn = rawFNotes
      ? `Surveyor note: ${rawFNotes}`
      : (hasDrawings ? 'Structural and foundation data gathered from as-built records and visual site observation.' : 'Structural and foundation data gathered from visual site observation (as-built records unavailable).');

    return {
      section3,
      section4: {
        structuralType: { vi: structTypeVi, en: structTypeEn },
        structuralForm: { vi: structFormVi, en: structFormEn },
        foundationType: { vi: foundTypeVi, en: foundTypeEn },
        pileSize: { vi: pileSizeVi, en: pileSizeEn },
        footingDensitySpacing: { vi: footingDensitySpacingVi, en: footingDensitySpacingEn },
        foundationDepth: { vi: foundDepthVi, en: foundDepthEn },
        visibleStructuralCondition: { vi: visibleStructVi, en: visibleStructEn },
        adjacentBuildings: { vi: adjSummaryVi, en: adjSummaryEn },
        foundationEvidence: foundEvidence,
        remarks: { vi: remarksVi, en: remarksEn },
      },
      majorRepair,
    };
  }
}

