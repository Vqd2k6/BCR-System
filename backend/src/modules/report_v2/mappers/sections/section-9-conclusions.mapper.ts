/**
 * ============================================================================
 * SECTION 9 MAPPER: CONCLUSIONS & TECHNICAL RECOMMENDATIONS
 * Chương IX: Kết luận & Kiến nghị kỹ thuật (Đọc trực tiếp từ DB của thửa đất)
 * ============================================================================
 */

import {
  Section9ConclusionRecommendation,
  BilingualText,
} from '../../report-v2.types';
import type { StandardTextContent } from '../../../report_config/report-config.types';

export class Section9ConclusionMapper {
  public static map(
    rawReport: any,
    json: any,
    allDefectRows: any[],
    section7: any,
    section8: any,
    specs: any,
    standardText?: StandardTextContent
  ): Section9ConclusionRecommendation {
    // CHƯƠNG IX: KẾT LUẬN & KIẾN NGHỊ (ĐỌC TRỰC TIẾP TỪ DB CỦA THỬA ĐẤT)
    const ownerFeedbackText = rawReport.owner_remarks || json.signatures?.ownerFeedback || json.ownerRemarks || '';
    const surveyorConclusionText = rawReport.summary_conclusions || json.summaryConclusions || '';

    const conclusionsList: BilingualText[] = [];
    if (surveyorConclusionText) {
      conclusionsList.push({
        vi: `Kết luận của Khảo sát viên hiện trường: ${surveyorConclusionText}`,
        en: `Surveyor field conclusion: ${surveyorConclusionText}`,
      });
    }
    // D6: Không tự sinh kết luận. Nếu KSV/Admin không nhập, mục kết luận để trống (template in '--').

    const isAbsentee = Boolean(json.isAbsenteeSurvey || rawReport.is_absentee_survey);
    const ownerName = rawReport.owner_name || json.ownerName || 'Chủ hộ';
    const isOwnerSigned = Boolean(rawReport.owner_signature_img || json.signatures?.ownerRepresentative?.signatureImg);

    let witnessNarrative: BilingualText;
    if (isAbsentee) {
      witnessNarrative = {
        vi: 'Khảo sát được thực hiện theo quy trình hiện trường đối với trường hợp chủ nhà vắng mặt (Khảo sát vắng chủ; ghi nhận biên bản độc lập).',
        en: 'The survey was conducted under the field protocol for absentee property owner (independent site record).',
      };
    } else if (ownerFeedbackText) {
      witnessNarrative = {
        vi: `Khảo sát được thực hiện với sự chứng kiến của chủ nhà (${ownerName}). Ý kiến ghi nhận từ chủ nhà: "${ownerFeedbackText}".`,
        en: `The survey was witnessed by the owner. Owner's statement: "${ownerFeedbackText}".`,
      };
    } else if (isOwnerSigned) {
      witnessNarrative = {
        vi: `Khảo sát được thực hiện với sự chứng kiến của chủ nhà (${ownerName}); chủ nhà đồng ý với kết quả khảo sát và ký biên bản hiện trường.`,
        en: 'The survey was witnessed by the property owner, who agreed with the survey results and signed the field record.',
      };
    } else {
      // D6: không tự khẳng định có người chứng kiến khi không có dữ liệu
      witnessNarrative = { vi: '', en: '' };
    }

    // Hạn chế khảo sát / Limitations: Liệt kê các trường thông tin bị thiếu từ khảo sát Phase 1
    const limitationsList: BilingualText[] = [];

    // Mái / Sân thượng không tiếp cận
    const rawScope = json?.surveyScope || {};
    const rawLimitation = json?.accessLimitation || {};
    const hasRoofScope = rawScope.roofTerrace ?? rawScope.roof;
    let roofRestricted = hasRoofScope === false;
    if (!roofRestricted && Array.isArray(rawLimitation.restrictedAreas)) {
      roofRestricted = rawLimitation.restrictedAreas.some((a: string) =>
        typeof a === 'string' && (a.toLowerCase().includes('mái') || a.toLowerCase().includes('sân thượng') || a.toLowerCase().includes('roof'))
      );
    }
    if (roofRestricted) {
      limitationsList.push({
        vi: 'Khu vực mái / sân thượng: Chưa tiếp cận khảo sát',
        en: 'Roof / terrace area: Inaccessible / not surveyed',
      });
    }

    // Tầng hầm chưa khảo sát
    const basementCount = Number(rawReport?.basement_count ?? json?.undergroundFloors ?? 0);
    if (basementCount > 0 && !rawScope.basement) {
      limitationsList.push({
        vi: 'Khu vực tầng hầm: Chưa tiếp cận khảo sát',
        en: 'Basement area: Inaccessible / not surveyed',
      });
    }

    // 1. Kiểm tra khu vực/phạm vi không thể tiếp cận (Inaccessible areas)
    const inaccessible = rawReport.inaccessible_areas || json.accessLimitation?.restrictedAreas || json.inaccessibleAreas;
    if (inaccessible && inaccessible !== 'NONE' && inaccessible !== 'None' && inaccessible !== 'Không') {
      let areaItems: string[] = Array.isArray(inaccessible) ? [...inaccessible] : [String(inaccessible)];

      // Bóc tách và thay thế 'Khác (Nhập chi tiết...)' hoặc 'Khác'
      const customArea = json.accessLimitation?.customRestrictedArea ||
        (() => {
          const notesStr = String(json.accessLimitation?.notes || rawReport.accessibility_limitations || '');
          const match = notesStr.match(/\[Khu vực khác:\s*(.+?)\]/);
          return match ? match[1].trim() : '';
        })();

      areaItems = areaItems.map(item => {
        if (item.includes('Khác (Nhập chi tiết...)') || item === 'Khác') {
          if (customArea) {
            return `Khác (${customArea})`;
          }
          // Nếu không có customArea riêng nhưng có ghi chú trong notes (như Tầng lầu 4 không tiếp cận được...)
          const notesStr = (json.accessLimitation?.notes || rawReport.accessibility_limitations || '').trim();
          if (notesStr && !notesStr.startsWith('[')) {
            const firstClause = notesStr.split(/[.;\n]/)[0].trim();
            if (firstClause.length > 0 && firstClause.length <= 60) {
              return `Khác (${firstClause})`;
            }
          }
          return 'Khu vực hạn chế khác (Chưa ghi rõ)';
        }
        return item.replace(/\s*\(Nhập chi tiết\.\.\.\)/g, '').trim();
      }).filter(Boolean);

      const areaStr = areaItems.join(', ');
      if (areaStr.trim()) {
        limitationsList.push({
          vi: `Khu vực chưa tiếp cận khảo sát: ${areaStr.trim()}`,
          en: `Inaccessible survey areas: ${areaStr.trim()}`,
        });
      }
    }

    const restrictedFloors = json.accessLimitation?.restrictedFloorLevels;
    if (Array.isArray(restrictedFloors) && restrictedFloors.length > 0) {
      const flStr = restrictedFloors.join(', ');
      limitationsList.push({
        vi: `Tầng không thể tiếp cận: ${flStr}`,
        en: `Inaccessible floor levels: ${flStr}`,
      });
    }

    let accessNotes = rawReport.accessibility_limitations || json.accessLimitation?.notes || json.accessLimitation?.mainReason;
    if (accessNotes && typeof accessNotes === 'string') {
      // Làm sạch các tag kỹ thuật như [Khu vực khác: ...] khỏi phần ghi chú hiển thị
      accessNotes = accessNotes.replace(/\[Khu vực khác:\s*.*?\]/g, '').trim();
      if (accessNotes) {
        limitationsList.push({
          vi: `Lý do hạn chế tiếp cận: ${accessNotes}`,
          en: `Access limitation reason: ${accessNotes}`,
        });
      }
    }

    // 2. Kiểm tra các trường thông tin khảo sát bị thiếu từ Phase 1 được KSV ghi nhận
    if (Array.isArray(json.missingSurveyFields) && json.missingSurveyFields.length > 0) {
      for (const field of json.missingSurveyFields) {
        if (typeof field === 'string' && field.trim()) {
          limitationsList.push({ vi: field.trim(), en: field.trim() });
        } else if (field?.vi) {
          limitationsList.push(field);
        }
      }
    } else if (json.surveyLimitations) {
      if (Array.isArray(json.surveyLimitations)) {
        for (const item of json.surveyLimitations) {
          if (typeof item === 'string' && item.trim()) limitationsList.push({ vi: item.trim(), en: item.trim() });
          else if (item?.vi) limitationsList.push(item);
        }
      } else if (typeof json.surveyLimitations === 'string' && json.surveyLimitations.trim()) {
        limitationsList.push({ vi: json.surveyLimitations.trim(), en: json.surveyLimitations.trim() });
      }
    }

    // 3. Kiểm tra thông tin kết cấu móng & bản vẽ hoàn công nếu chưa thu thập được
    const rawFoundation = specs.foundationType || json.foundationType;
    if (!rawFoundation || rawFoundation === 'UNKNOWN' || rawFoundation === 'CHUA_RO' || String(rawFoundation).toLowerCase().includes('chưa rõ') || String(rawFoundation).toLowerCase().includes('không rõ')) {
      limitationsList.push({
        vi: 'Thông tin kết cấu móng: Chưa thu thập được hồ sơ thiết kế/hoàn công tại thời điểm khảo sát',
        en: 'Foundation structural data: Design/as-built drawings unavailable at time of survey',
      });
    }

    const hasDrawings = specs.hasAsBuiltDrawings || specs.hasDrawings || json.hasDrawings || json.hasAsBuiltDrawings;
    if (hasDrawings === false) {
      limitationsList.push({
        vi: 'Hồ sơ bản vẽ hoàn công / kết cấu công trình: Chủ hộ không cung cấp được tại hiện trường',
        en: 'As-built / structural drawings: Not provided by property owner on site',
      });
    }

    // D6: không có hạn chế được ghi nhận -> mảng rỗng, template in '--' (không khẳng định 'Không')
    const finalLimitations: BilingualText[] = limitationsList;

    // Kiến nghị kỹ thuật & nội dung cần bổ sung lấy 100% từ cấu hình chuẩn dự án (Q1)
    const recommendations: BilingualText[] = standardText?.recommendations || [];
    const pendingFieldDesignItems: BilingualText[] = standardText?.pendingItems || [];

    const section9: Section9ConclusionRecommendation = {
      conclusions: conclusionsList,
      overallRisk: {
        vi: `Cấp độ rủi ro tổng thể: ${section8.overallRisk.grade.vi} (Ma trận Rủi ro Cơ sở BRA = V × I); xác lập ranh giới hiện trạng cơ sở trước khi thi công ngầm.`,
        en: `Overall risk grade: ${section8.overallRisk.grade.en} (Baseline BRA Matrix = V × I); establishing pre-construction baseline condition.`,
      },
      witnessNarrative,
      limitations: finalLimitations,
      recommendations,
      phase1Notice: {
        vi: 'Báo cáo Giai đoạn 1 là hồ sơ khảo sát và sàng lọc ban đầu.',
        en: 'This Phase 1 report is a preliminary survey and screening record.',
      },
      pendingFieldDesignItems,
      hasWarningConclusion: false,
      warningBadge: undefined,
    };

    return section9;
  }
}
