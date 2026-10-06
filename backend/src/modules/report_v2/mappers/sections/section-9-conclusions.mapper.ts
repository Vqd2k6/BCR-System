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

export class Section9ConclusionMapper {
  public static map(
    rawReport: any,
    json: any,
    allDefectRows: any[],
    section7: any,
    section8: any,
    specs: any
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
    } else {
      conclusionsList.push({
        vi: `Sau khi hoàn thành công tác khảo sát hiện trường và đánh giá hiện trạng, công trình đang sử dụng ổn định. Ghi nhận tổng cộng ${allDefectRows.length} khuyết tật nứt (chi tiết tại Phụ lục 2). Không ghi nhận lún, nghiêng, võng bất thường.`,
        en: `Following on-site survey and assessment, the building is in stable use. A total of ${allDefectRows.length} cracks were recorded (detailed in Appendix 2). No abnormal settlement, tilt or deflection was observed.`,
      });
    }

    const witnessNarrative: BilingualText = ownerFeedbackText
      ? {
          vi: `Khảo sát được thực hiện với sự chứng kiến của chủ nhà (${rawReport.owner_name || json.ownerName || 'Chủ hộ'}). Ý kiến ghi nhận từ chủ nhà: "${ownerFeedbackText}".`,
          en: `The survey was witnessed by the owner. Owner's statement: "${ownerFeedbackText}".`,
        }
      : {
          vi: `Khảo sát được thực hiện với sự chứng kiến của chủ nhà (${rawReport.owner_name || json.ownerName || 'Chủ hộ'}); chủ nhà đồng ý với kết quả khảo sát và ký biên bản hiện trường.`,
          en: 'The survey was witnessed by the property owner, who agreed with the survey results and signed the field record.',
        };

    const conclusionFullText = (rawReport.summary_conclusions || json.summaryConclusions || '').toLowerCase();
    const hasWarningConclusion =
      conclusionFullText.includes('nguy hiểm') ||
      conclusionFullText.includes('sụt lún') ||
      conclusionFullText.includes('nứt nặng') ||
      conclusionFullText.includes('phát triển') ||
      conclusionFullText.includes('cần gia cố') ||
      Boolean(section7.localMaxGrade?.vi?.includes('Cấp 3')) ||
      Boolean(section7.localMaxGrade?.vi?.includes('Cấp 4')) ||
      Boolean(section7.localMaxGrade?.vi?.includes('Cấp 5'));

    const warningBadge: BilingualText | undefined = hasWarningConclusion
      ? {
          vi: 'CẢNH BÁO HIỆN TRƯỜNG: Vết nứt hoặc khuyết tật có dấu hiệu phát triển hoặc cần kỹ sư kết cấu theo dõi sát',
          en: 'FIELD WARNING: Observed cracks or defects exhibit potential progression risk or require close engineering monitoring',
        }
      : undefined;

    // Hạn chế khảo sát / Limitations: Liệt kê các trường thông tin bị thiếu từ khảo sát Phase 1
    const limitationsList: BilingualText[] = [];

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

    const finalLimitations: BilingualText[] = limitationsList.length > 0
      ? limitationsList
      : [{ vi: 'Không', en: 'None' }];

    const section9: Section9ConclusionRecommendation = {
      conclusions: conclusionsList,
      overallRisk: {
        vi: `Cấp độ rủi ro tổng thể: ${section8.overallRisk.grade.vi} (Ma trận Rủi ro Cơ sở BRA = V × I); xác lập ranh giới hiện trạng cơ sở trước khi thi công ngầm.`,
        en: `Overall risk grade: ${section8.overallRisk.grade.en} (Baseline BRA Matrix = V × I); establishing pre-construction baseline condition.`,
      },
      witnessNarrative,
      limitations: finalLimitations,
      recommendations: [
        {
          vi: 'Kiến nghị thiết lập hồ sơ hiện trạng ban đầu làm căn cứ pháp lý; lắp đặt mốc quan trắc biến dạng định kỳ trong suốt quá trình đào hầm TBM; theo dõi các vết nứt đã ghi nhận bằng thước đo nứt.',
          en: 'It is recommended to establish the baseline record as legal evidence, install periodic deformation monitoring points during TBM tunnelling, and follow up recorded cracks with crack gauges.',
        },
        {
          vi: 'Báo cáo Giai đoạn 1 là hồ sơ khảo sát và sàng lọc ban đầu; hồ sơ pháp lý xác nhận hiện trạng trước thi công được thực hiện theo quy trình Giai đoạn 2 và các yêu cầu được dự án/Tư vấn phê duyệt.',
          en: 'This Phase 1 report is a preliminary survey and screening record; the legal pre-construction condition record is established under the Phase 2 procedure and the requirements approved by the Project/Engineer.',
        },
      ],
      phase1Notice: {
        vi: 'Báo cáo Giai đoạn 1 là hồ sơ khảo sát và sàng lọc ban đầu.',
        en: 'This Phase 1 report is a preliminary survey and screening record.',
      },
      pendingFieldDesignItems: [
        {
          vi: 'Dự báo lún Smax, PPV, biến dạng góc và điểm A – lấy từ thiết kế / đánh giá tác động được phê duyệt.',
          en: 'Predicted Smax, PPV, angular distortion and score A – from the approved design / impact assessment.',
        },
        {
          vi: 'Hồ sơ pháp lý xác nhận hiện trạng trước thi công hoàn thiện theo Giai đoạn 2 trước khi máy TBM đào qua.',
          en: 'Pre-construction condition legal dossier to be finalized under Phase 2 prior to TBM passage.',
        },
      ],
      hasWarningConclusion,
      warningBadge,
    };

    return section9;
  }
}
