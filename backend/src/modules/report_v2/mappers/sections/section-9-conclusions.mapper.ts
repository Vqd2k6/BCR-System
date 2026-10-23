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
    // CHƯƠNG IX: KẾT LUẬN & KIẾN NGHỊ (ƯU TIÊN ĐỌC TRỰC TIẾP TỪ JSON ĐÃ DUYỆT, FALLBACK VỀ CỘT SQL)
    const ownerFeedbackText =
      json.signatures?.ownerFeedback ??
      json.ownerFeedback ??
      json.ownerRemarks ??
      rawReport.owner_remarks ??
      '';
    const surveyorConclusionText =
      json.summaryConclusions ??
      json.executiveSummary?.summaryConclusions ??
      rawReport.summary_conclusions ??
      '';
    const keyRisksDefectsText = String(
      json.keyRisksDefectsText ??
      json.executiveSummary?.keyRisksDefectsText ??
      ''
    ).trim();

    const conclusionsList: BilingualText[] = [];
    if (surveyorConclusionText) {
      conclusionsList.push({
        vi: `Kết luận của Khảo sát viên hiện trường: ${surveyorConclusionText}`,
        en: `Surveyor field conclusion: ${surveyorConclusionText}`,
      });
    }
    if (keyRisksDefectsText && keyRisksDefectsText !== 'Không') {
      conclusionsList.push({
        vi: `Các rủi ro / khuyết tật trọng yếu: ${keyRisksDefectsText}`,
        en: `Key risks and defects: ${keyRisksDefectsText}`,
      });
    }
    // D6: Không tự sinh kết luận. Nếu KSV/Admin không nhập, mục kết luận để trống (template in '--').

    const isAbsentee = Boolean(json.isAbsenteeSurvey || rawReport.is_absentee_survey);
    const ownerName = json.ownerName || rawReport.owner_name || 'Chủ hộ';
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

    // Mái / Sân thượng không tiếp cận: Tôn trọng 100% khai báo của KSV
    const rawScope = json?.surveyScope || {};
    const rawLimitation = json?.accessLimitation || {};
    const isFullAccess = rawLimitation.type === 'FULL_100';
    let roofRestricted = false;

    if (!isFullAccess && Array.isArray(rawLimitation.restrictedAreas)) {
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
    const basementCount = Number(json?.undergroundFloors ?? rawReport?.basement_count ?? 0);
    if (basementCount > 0 && !rawScope.basement) {
      limitationsList.push({
        vi: 'Khu vực tầng hầm: Chưa tiếp cận khảo sát',
        en: 'Basement area: Inaccessible / not surveyed',
      });
    }

    // 1. Kiểm tra khu vực/phạm vi không thể tiếp cận (Inaccessible areas)
    const inaccessible = json.accessLimitation?.restrictedAreas ?? json.inaccessibleAreas ?? rawReport.inaccessible_areas;
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

    let accessNotes = json.accessLimitation?.notes || json.accessLimitation?.mainReason || rawReport.accessibility_limitations;
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

    // D6 & Quy tắc 100% Read-From-Approved: Chỉ in đúng danh sách hạn chế khảo sát đã được KSV/Admin chốt trong hồ sơ,
    // tuyệt đối không tự động chèn thêm câu hạn chế ngầm lúc render.
    const finalLimitations: BilingualText[] = limitationsList;

    // Kiến nghị kỹ thuật & nội dung cần bổ sung lấy từ cấu hình chuẩn dự án (Q1) + kiến nghị riêng của hồ sơ đã thẩm định
    const recommendations: BilingualText[] = [...(standardText?.recommendations || [])];
    const specificRecommendationsText = String(
      json.executiveSummary?.specificRecommendationsText ??
      json.engineeringRecommendations ??
      rawReport.engineering_recommendations ??
      ''
    ).trim();
    if (specificRecommendationsText && specificRecommendationsText !== 'Không') {
      recommendations.push({
        vi: `Kiến nghị kỹ thuật cụ thể của hồ sơ: ${specificRecommendationsText}`,
        en: `Specific technical recommendation: ${specificRecommendationsText}`,
      });
    }
    const pendingFieldDesignItems: BilingualText[] = standardText?.pendingItems || [];

    const section9: Section9ConclusionRecommendation = {
      conclusions: conclusionsList,
      overallRisk: {
        vi: `Cấp độ rủi ro tổng thể: ${section8?.overallRisk?.grade?.vi || '--'} (Ma trận Rủi ro Cơ sở BRA = V × I); xác lập ranh giới hiện trạng cơ sở trước khi thi công ngầm.`,
        en: `Overall risk grade: ${section8?.overallRisk?.grade?.en || '--'} (Baseline BRA Matrix = V × I); establishing pre-construction baseline condition.`,
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
