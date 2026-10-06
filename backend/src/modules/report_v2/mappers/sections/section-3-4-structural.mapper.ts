/**
 * ============================================================================
 * SECTION 3 & 4 MAPPER: HISTORY, OCCUPANCY, STRUCTURE & FOUNDATION
 * Chương III: Lịch sử và tình trạng sử dụng & Chương IV: Đặc điểm kết cấu và móng
 * ============================================================================
 */

import {
  Section3HistoryOccupancy,
  Section4StructuralFoundation,
} from '../../report-v2.types';

export interface Section3And4Result {
  section3: Section3HistoryOccupancy;
  section4: Section4StructuralFoundation;
  majorRepair: number;
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
    // CHƯƠNG III: LỊCH SỬ VÀ TÌNH TRẠNG SỬ DỤNG
    const historyRaw = json.historyInterview || {};
    let dbDetails: any = {};
    if (rawReport.historicalSensitivity?.details) {
      try {
        dbDetails = typeof rawReport.historicalSensitivity.details === 'string'
          ? JSON.parse(rawReport.historicalSensitivity.details)
          : rawReport.historicalSensitivity.details;
      } catch (e) {
        // Fallback
      }
    }
    const historyObj = { ...dbDetails, ...historyRaw };

    const renovationLoad = Number(historyObj.renovationLoad ?? (rawReport.historicalSensitivity?.extended_or_renovated ? 1 : 0));
    const majorRepair = Number(historyObj.majorRepair ?? 0);
    const pastSettlement = Number(historyObj.pastSettlement ?? (rawReport.historicalSensitivity?.previous_settlement_or_tilt ? 1 : 0));
    const neighborDamage = Number(historyObj.neighborDamage ?? 0);
    const fireFloodIncident = Number(historyObj.fireFloodIncident ?? (rawReport.historicalSensitivity?.fire_or_accident ? 1 : 0));
    const usageStr = String(historyObj.usageStatus || 'Đầy đủ (100%)');
    const sensEquip = historyObj.sensitiveEquipment || {
      has: Boolean(rawReport.historicalSensitivity?.sensitive_equipment_present),
      description: '',
    };

    const section3: Section3HistoryOccupancy = {
      changeOfUse: renovationLoad === 0
        ? { vi: 'Chưa ghi nhận', en: 'Not recorded' }
        : renovationLoad === 1
          ? { vi: 'Nhẹ – Đã xử lý ổn định', en: 'Minor – Stabilised' }
          : renovationLoad === 2
            ? { vi: 'Nhiều – Chưa rõ kết cấu', en: 'Moderate – Unclear structure' }
            : { vi: 'Thay đổi lớn – Ảnh hưởng tải trọng', en: 'Major – Significant loading change' },

      extension: renovationLoad === 0
        ? { vi: 'Không ghi nhận', en: 'Not recorded' }
        : renovationLoad === 1
          ? { vi: 'Có cơi nới nhẹ / sửa chữa nhỏ', en: 'Minor extension reported' }
          : { vi: 'Có cơi nới / mở rộng quy mô lớn', en: 'Substantial extension reported' },

      structuralAlteration: majorRepair === 0
        ? { vi: 'Chưa ghi nhận', en: 'Not recorded' }
        : majorRepair === 1
          ? { vi: 'Có cải tạo nhẹ kết cấu', en: 'Minor structural alteration' }
          : { vi: 'Có cải tạo lớn ảnh hưởng chịu lực', en: 'Major structural alteration' },

      majorRepair: majorRepair === 0
        ? { vi: 'Không', en: 'No' }
        : majorRepair === 1
          ? { vi: 'Có – Nhẹ, đã xử lý ổn định', en: 'Yes – Minor, stabilised' }
          : majorRepair === 2
            ? { vi: 'Có – Nhiều, chưa rõ hồ sơ hoàn công', en: 'Yes – Substantial, unverified documentation' }
            : { vi: 'Có – Cải tạo lớn ảnh hưởng chịu lực', en: 'Yes – Major structural repair' },

      fireHistory: fireFloodIncident === 0
        ? { vi: 'Không', en: 'None' }
        : fireFloodIncident === 1
          ? { vi: 'Không', en: 'None' }
          : { vi: 'Có ghi nhận', en: 'Recorded' },

      flooding: fireFloodIncident === 0
        ? { vi: 'Không', en: 'None' }
        : fireFloodIncident === 1
          ? { vi: 'Nhẹ (đã khắc phục)', en: 'Minor (remediated)' }
          : { vi: 'Có ghi nhận', en: 'Recorded' },

      fireAndFlooding: fireFloodIncident === 0
        ? { vi: 'Cháy: Không | Ngập lụt: Không', en: 'Fire: None | Flooding: None' }
        : fireFloodIncident === 1
          ? { vi: 'Cháy: Không | Ngập lụt: Nhẹ (đã khắc phục)', en: 'Fire: None | Flooding: Minor (remediated)' }
          : fireFloodIncident === 2
            ? { vi: 'Có sự cố trung bình (chưa rõ ảnh hưởng)', en: 'Moderate fire/flooding incident recorded' }
            : { vi: 'Có sự cố nghiêm trọng (ảnh hưởng kết cấu)', en: 'Severe fire/flooding incident recorded' },

      previousSettlementTilt: pastSettlement === 0
        ? { vi: 'Không phát hiện lún nghiêng trước đây', en: 'No prior settlement or tilt observed' }
        : pastSettlement === 1
          ? { vi: 'Có ghi nhận lún nghiêng nhẹ (đã ổn định)', en: 'Minor past settlement/tilt reported (stabilised)' }
          : pastSettlement === 2
            ? { vi: 'Có ghi nhận lún nghiêng rõ (tiếp diễn)', en: 'Evident ongoing settlement/tilt reported' }
            : { vi: 'Có sự cố lún nghiêng nghiêm trọng', en: 'Severe settlement/tilt incident reported' },

      occupancyStatus: usageStr.includes('Đầy đủ')
        ? { vi: 'Đang sử dụng bình thường (100%)', en: 'In normal full use (100%)' }
        : usageStr.includes('một phần')
          ? { vi: 'Đang sử dụng một phần', en: 'Partially occupied' }
          : (usageStr.includes('Bỏ trống') || usageStr.includes('Không sử dụng'))
            ? { vi: 'Bỏ trống – Không sử dụng', en: 'Vacant / Unoccupied' }
            : { vi: usageStr.includes('Đang') ? usageStr : `Đang sử dụng (${usageStr})`, en: `In use (${usageStr})` },

      sensitiveEquipment: sensEquip.has
        ? { vi: `Có: ${sensEquip.description || 'Thiết bị chính xác / Y tế'}`, en: `Yes: ${sensEquip.description || 'Precision / Medical equipment'}` }
        : { vi: 'Không có thiết bị nhạy cảm rung động', en: 'No vibration-sensitive equipment' },

      damageByAdjacentWorks: neighborDamage === 0
        ? { vi: 'Không', en: 'No' }
        : neighborDamage === 1
          ? { vi: 'Có – Nhẹ, đã bồi thường/khắc phục', en: 'Yes – Minor, compensated/repaired' }
          : neighborDamage === 2
            ? { vi: 'Có – Ảnh hưởng đáng kể', en: 'Yes – Substantial damage' }
            : { vi: 'Có – Tranh chấp / Ảnh hưởng nghiêm trọng', en: 'Yes – Severe damage / Disputed' },

      informationSource: {
        vi: 'Phỏng vấn chủ hộ, Quan sát hiện trường',
        en: 'Property owner interview, Site observation',
      },
    };

    // CHƯƠNG IV: ĐẶC ĐIỂM KẾT CẤU VÀ MÓNG
    // 1. Tách biệt Loại hình kết cấu (Vật liệu / Hệ chịu lực)
    const rawStructSys = json.structureSystem || specs.structural_system || specs.structuralSystem || 'RC - BTCT';
    let structTypeVi = 'Khung bê tông cốt thép toàn khối (RC) (cột, dầm, sàn BTCT)';
    let structTypeEn = 'Reinforced Concrete (RC) Frame (columns, beams, slabs)';
    if (rawStructSys.includes('Steel') || rawStructSys.toLowerCase().includes('thép')) {
      structTypeVi = 'Khung kết cấu thép tiền chế';
      structTypeEn = 'Pre-engineered Steel Structure';
    } else if (rawStructSys.includes('Masonry') || rawStructSys.toLowerCase().includes('gạch')) {
      structTypeVi = 'Tường gạch chịu lực kết hợp sàn BTCT';
      structTypeEn = 'Load-bearing Brick Masonry with RC Slabs';
    } else if (rawStructSys.includes('Mixed') || rawStructSys.toLowerCase().includes('hỗn hợp')) {
      structTypeVi = 'Kết cấu hỗn hợp (BTCT kết hợp gạch/thép)';
      structTypeEn = 'Composite / Mixed Structural System';
    }

    // 2. Tách biệt Hình thức kết cấu (Hình thái kiến trúc không gian đô thị)
    const bldgTypeStr = (rawReport.building_type || json.surveyCaseType || json.usageFunction || '').toLowerCase();
    let structFormVi = 'Nhà phố liên kế nhiều tầng (Row / Terraced House)';
    let structFormEn = 'Terraced Row House';
    if (bldgTypeStr.includes('chung cư') || bldgTypeStr.includes('apartment') || bldgTypeStr.includes('condo')) {
      structFormVi = 'Tòa nhà chung cư / Căn hộ nhiều tầng';
      structFormEn = 'Multi-storey Condominium / Apartment Building';
    } else if (bldgTypeStr.includes('biệt thự') || bldgTypeStr.includes('độc lập') || bldgTypeStr.includes('standalone')) {
      structFormVi = 'Nhà riêng lẻ độc lập (Detached Single House)';
      structFormEn = 'Standalone / Detached House';
    } else if (bldgTypeStr.includes('thương mại') || bldgTypeStr.includes('shophouse') || bldgTypeStr.includes('văn phòng')) {
      structFormVi = 'Nhà phố thương mại / Văn phòng dịch vụ';
      structFormEn = 'Commercial Shophouse / Office Building';
    }

    // 3. Loại móng
    const rawFoundType = (json.foundationType || specs.foundation_category || specs.foundationType || '').toLowerCase();
    let foundTypeVi = 'Móng nông (Móng băng / Móng đơn / Móng bè)';
    let foundTypeEn = 'Shallow Foundation (Strip / Pad / Raft)';
    if (rawFoundType.includes('pc') || rawFoundType.includes('cọc ép')) {
      foundTypeVi = 'Móng cọc ép bê tông cốt thép (PC)';
      foundTypeEn = 'Precast Reinforced Concrete Driven Pile';
    } else if (rawFoundType.includes('cip') || rawFoundType.includes('khoan nhồi')) {
      foundTypeVi = 'Móng cọc khoan nhồi (CIP)';
      foundTypeEn = 'Cast-in-place Bored Pile';
    } else if (rawFoundType.includes('wood') || rawFoundType.includes('cừ tràm')) {
      foundTypeVi = 'Móng cừ tràm gia cố nền đất yếu';
      foundTypeEn = 'Melaleuca Wooden Pile Foundation';
    } else if (rawFoundType.includes('unknown') || rawFoundType.includes('không rõ')) {
      foundTypeVi = 'Chưa xác định rõ thông tin móng';
      foundTypeEn = 'Unverified / Unknown Foundation Type';
    }

    // 4. Kích thước cọc/móng
    const pileDim = json.pileDimensionMm || specs.pile_dimensions || (json.pileWidthMm && json.pileLengthMm ? `${json.pileWidthMm} × ${json.pileLengthMm} cm` : '');
    let pileSizeVi = pileDim;
    let pileSizeEn = pileDim;
    if (!pileDim) {
      if (foundTypeVi.includes('Móng nông')) {
        pileSizeVi = 'Móng nông – Không dùng cọc';
        pileSizeEn = 'Shallow foundation – No piles';
      } else {
        pileSizeVi = 'Không có số liệu kích thước';
        pileSizeEn = 'Not recorded / Unverified';
      }
    }

    // 5. Độ sâu móng
    let foundDepthVi = 'Chưa xác định độ sâu đáy móng';
    let foundDepthEn = 'Unverified foundation depth';
    if (rawFoundDepth !== undefined && rawFoundDepth !== null && rawFoundDepth !== '' && Number(rawFoundDepth) > 0) {
      foundDepthVi = `${Number(rawFoundDepth).toFixed(1)} m (Độ sâu đáy móng so với cốt nền)`;
      foundDepthEn = `${Number(rawFoundDepth).toFixed(1)} m (Foundation base depth from ground level)`;
    }

    // 6. Căn cứ xác định móng (CAT 1 - CAT 5)
    const rawFoundCat = Number(json.foundationCatScore || specs.foundation_cat_score || 3);
    const catEvidenceMap: Record<number, { vi: string; en: string }> = {
      1: { vi: 'Hồ sơ hoàn công được phê duyệt (CAT 1)', en: 'Approved as-built documentation (CAT 1)' },
      2: { vi: 'Bản vẽ thiết kế kết cấu do chủ hộ lưu giữ (CAT 2)', en: 'Design drawings kept by owner (CAT 2)' },
      3: { vi: 'Phỏng vấn chủ hộ xác nhận (CAT 3)', en: 'Property owner statement (CAT 3)' },
      4: { vi: 'Suy luận chuyên môn KSV tại hiện trường (CAT 4)', en: 'Surveyor on-site engineering assessment (CAT 4)' },
      5: { vi: 'Chưa có hồ sơ móng (CAT 5)', en: 'Unverified / No foundation documentation (CAT 5)' },
    };
    const foundEvidence = catEvidenceMap[rawFoundCat] || catEvidenceMap[3];

    // 7. Tình trạng kết cấu quan sát được (Data-driven từ kiểm tra khuyết tật thực tế)
    let visibleStructVi = 'Các cấu kiện chịu lực chính (cột, dầm, sàn) nguyên vẹn, ổn định tại thời điểm khảo sát';
    let visibleStructEn = 'Main load-bearing elements (columns, beams, slabs) intact and stable at survey time';
    if (structuralCracksCount > 0) {
      visibleStructVi = `Ghi nhận khuyết tật kết cấu cục bộ (${structuralCracksCount} vị trí nứt cấp ≥ 3, xem Mục VI & Phụ lục 2)`;
      visibleStructEn = `Localised structural defects observed (${structuralCracksCount} cracks grade ≥ 3, see Section VI & Appendix 2)`;
    } else if (surfaceCracksCount > 0) {
      visibleStructVi = 'Các cấu kiện chịu lực chính (cột, dầm, sàn) ổn định; ghi nhận nứt vữa hoàn thiện kiến trúc';
      visibleStructEn = 'Main load-bearing elements intact; minor aesthetic plaster cracks observed';
    }

    // 8. Công trình liền kề (Trái, Phải, Sau)
    let adjLeftVi = '';
    let adjRightVi = '';
    let adjBackVi = '';
    const rawAdj = json.adjacentBuildings || specs.adjacent_buildings || specs.adjacentBuildings;
    if (rawAdj) {
      try {
        const parsedAdj = typeof rawAdj === 'string' ? JSON.parse(rawAdj) : rawAdj;
        if (parsedAdj.left) {
          const lType = parsedAdj.left.type || parsedAdj.left.details || '';
          const lFloors = parsedAdj.left.floors ? `${parsedAdj.left.floors} tầng` : '';
          const lContact = parsedAdj.left.contact || '';
          const lNotes = parsedAdj.left.notes || '';
          adjLeftVi = [lType, lFloors, lContact, lNotes].filter(Boolean).join(' - ');
        }
        if (parsedAdj.right) {
          const rType = parsedAdj.right.type || parsedAdj.right.details || '';
          const rFloors = parsedAdj.right.floors ? `${parsedAdj.right.floors} tầng` : '';
          const rContact = parsedAdj.right.contact || '';
          const rNotes = parsedAdj.right.notes || '';
          adjRightVi = [rType, rFloors, rContact, rNotes].filter(Boolean).join(' - ');
        }
        if (parsedAdj.back || parsedAdj.rear) {
          const bObj = parsedAdj.back || parsedAdj.rear;
          const bType = bObj.type || bObj.details || '';
          const bFloors = bObj.floors ? `${bObj.floors} tầng` : '';
          const bContact = bObj.contact || '';
          const bNotes = bObj.notes || '';
          adjBackVi = [bType, bFloors, bContact, bNotes].filter(Boolean).join(' - ');
        }
      } catch (e) {
        // Fallback
      }
    }

    const translateAdj = (text: string) => {
      if (!text) return '';
      if (text.includes('Nhà') || text.includes('TOWN_HOUSE')) return 'Residential Townhouse';
      if (text.includes('Hẻm') || text.includes('Đường')) return 'Alley / Internal Road';
      if (text.includes('Đất') || text.includes('VACANT_LAND')) return 'Vacant Land';
      return text;
    };

    let adjSummaryVi = 'Chưa ghi nhận thông tin công trình liền kề';
    let adjSummaryEn = 'Adjacent buildings data unrecorded';
    if (adjLeftVi || adjRightVi || adjBackVi) {
      const pVi: string[] = [];
      const pEn: string[] = [];
      if (adjLeftVi) { pVi.push(`Trái: ${adjLeftVi}`); pEn.push(`Left: ${translateAdj(adjLeftVi)}`); }
      if (adjRightVi) { pVi.push(`Phải: ${adjRightVi}`); pEn.push(`Right: ${translateAdj(adjRightVi)}`); }
      if (adjBackVi) { pVi.push(`Sau: ${adjBackVi}`); pEn.push(`Rear: ${translateAdj(adjBackVi)}`); }
      adjSummaryVi = pVi.join(' | ');
      adjSummaryEn = pEn.join(' | ');
    }

    // Footing density and spacing
    const rawFDensity = json.foundationDensity || specs.foundation_density || specs.footingDensity;
    const rawFSpacing = json.foundationSpacingM || specs.foundation_spacing_m || specs.footingSpacing;
    let footingDensitySpacingVi = 'Chưa ghi nhận';
    let footingDensitySpacingEn = 'Not recorded';
    if (rawFDensity || rawFSpacing) {
      const fdPartsVi: string[] = [];
      const fdPartsEn: string[] = [];
      if (rawFDensity) { fdPartsVi.push(`Mật độ: ${rawFDensity}`); fdPartsEn.push(`Density: ${rawFDensity}`); }
      if (rawFSpacing) { fdPartsVi.push(`Khoảng cách tim: ${rawFSpacing} m`); fdPartsEn.push(`Spacing: ${rawFSpacing} m`); }
      footingDensitySpacingVi = fdPartsVi.join(' | ');
      footingDensitySpacingEn = fdPartsEn.join(' | ');
    }

    // 9. Ghi chú kỹ thuật
    const rawFNotes = json.foundationNotes || specs.foundation_notes;
    const remarksVi = rawFNotes
      ? rawFNotes
      : 'Thông tin hệ kết cấu và móng được tổng hợp từ hồ sơ hoàn công và khảo sát trực quan hiện trường.';
    const remarksEn = rawFNotes
      ? `Surveyor note: ${rawFNotes}`
      : 'Structural and foundation data gathered from as-built records and visual site observation.';

    const section4: Section4StructuralFoundation = {
      structuralType: { vi: structTypeVi, en: structTypeEn },
      structuralForm: { vi: structFormVi, en: structFormEn },
      foundationType: { vi: foundTypeVi, en: foundTypeEn },
      pileSize: { vi: pileSizeVi, en: pileSizeEn },
      footingDensitySpacing: { vi: footingDensitySpacingVi, en: footingDensitySpacingEn },
      foundationDepth: { vi: foundDepthVi, en: foundDepthEn },
      visibleStructuralCondition: { vi: visibleStructVi, en: visibleStructEn },
      adjacentBuildings: {
        vi: adjSummaryVi,
        en: adjSummaryEn,
      },
      foundationEvidence: foundEvidence,
      remarks: { vi: remarksVi, en: remarksEn },
    };

    return {
      section3,
      section4,
      majorRepair,
    };
  }
}
