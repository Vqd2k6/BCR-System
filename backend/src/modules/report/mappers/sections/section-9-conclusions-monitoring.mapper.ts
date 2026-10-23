/**
 * ============================================================================
 * SECTION 9 MAPPER: CONCLUSIONS & TECHNICAL RECOMMENDATIONS
 * Chương IX: Kết luận & Kiến nghị kỹ thuật (Đọc trực tiếp từ DB của thửa đất)
 * ============================================================================
 */

import {
  Section9ConclusionRecommendation,
  BilingualText,
} from '../../report.types';
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
      witnessNarrative = { vi: '', en: '' };
    }

    const limitationsList: BilingualText[] = [];
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

    const basementCount = Number(json?.undergroundFloors ?? rawReport?.basement_count ?? 0);
    if (basementCount > 0 && !rawScope.basement) {
      limitationsList.push({
        vi: 'Khu vực tầng hầm: Chưa tiếp cận khảo sát',
        en: 'Basement area: Inaccessible / not surveyed',
      });
    }

    const inaccessible = json.accessLimitation?.restrictedAreas ?? json.inaccessibleAreas ?? rawReport.inaccessible_areas;
    if (inaccessible && inaccessible !== 'NONE' && inaccessible !== 'None' && inaccessible !== 'Không') {
      let areaItems: string[] = Array.isArray(inaccessible) ? [...inaccessible] : [String(inaccessible)];

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
      accessNotes = accessNotes.replace(/\[Khu vực khác:\s*.*?\]/g, '').trim();
      if (accessNotes) {
        limitationsList.push({
          vi: `Lý do hạn chế tiếp cận: ${accessNotes}`,
          en: `Access limitation reason: ${accessNotes}`,
        });
      }
    }

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

    return {
      conclusions: conclusionsList,
      overallRisk: {
        vi: `Cấp độ rủi ro tổng thể: ${section8?.overallRisk?.grade?.vi || '--'} (Ma trận Rủi ro Cơ sở BRA = V × I); xác lập ranh giới hiện trạng cơ sở trước khi thi công ngầm.`,
        en: `Overall risk grade: ${section8?.overallRisk?.grade?.en || '--'} (Baseline BRA Matrix = V × I); establishing pre-construction baseline condition.`,
      },
      witnessNarrative,
      limitations: limitationsList,
      recommendations,
      phase1Notice: {
        vi: 'Báo cáo Giai đoạn 1 là hồ sơ khảo sát và sàng lọc ban đầu.',
        en: 'This Phase 1 report is a preliminary survey and screening record.',
      },
      pendingFieldDesignItems,
      hasWarningConclusion: false,
      warningBadge: undefined,
    };
  }
}

