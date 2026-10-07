/**
 * ============================================================================
 * APPENDIX 3 & 4 MAPPER: SIGNED FIELD RECORDS & EQUIPMENT ACCESSIBILITY
 * Phụ lục 3: Biên bản hiện trường 3 bên & Phụ lục 4: Thiết bị và phạm vi tiếp cận
 * ============================================================================
 */

import {
  Appendix3SignedRecord,
  Appendix4EquipmentAndAccess,
  FloorPlanDefectReport,
  Appendix1PhotoItem,
} from '../../report-v2.types';
import { ReportImageResolver } from '../../services/report-image-resolver.service';
import { isPhotoAlreadyWatermarked } from '../floor-defect.mapper';
import { extractPhotoDateTime } from '../formatters.mapper';

export class Appendix3And4Mapper {
  public static mapAppendix3(
    rawReport: any,
    json: any,
    identPhotos: any[],
    surveyDateWithTime: string,
    surveyDateFormatted: string,
    surveyorName: string,
    zoneAdminName: string,
    reportNo: string,
    buildingId?: string,
    rawSurveyDate?: any
  ): Appendix3SignedRecord {
    // PHỤ LỤC 3: BIÊN BẢN KHẢO SÁT HIỆN TRƯỜNG (TOÀN BỘ CÁC TRANG SCAN PHÁP LÝ & TÀI LIỆU HOÀN CÔNG)
    const isAbsentee = Boolean(json.isAbsenteeSurvey || rawReport.is_absentee_survey || json.surveyCaseType === 'ABSENTEE');
    let minutesPhotos: string[] = [];
    if (isAbsentee && Array.isArray(json.absenteeMinutesPhotos) && json.absenteeMinutesPhotos.length > 0) {
      minutesPhotos = json.absenteeMinutesPhotos.map((p: any) => typeof p === 'string' ? p : p?.url).filter(Boolean);
    } else if (json.signatures?.workingMinutesPhotos && json.signatures.workingMinutesPhotos.length > 0) {
      minutesPhotos = json.signatures.workingMinutesPhotos.map((p: any) => typeof p === 'string' ? p : p?.url).filter(Boolean);
    } else {
      minutesPhotos = identPhotos
        .filter((p: any) => p.photo_type?.includes('DOC') || p.raw_photo_url?.includes('/DOC/'))
        .map((p: any) => p.raw_photo_url || p.annotated_photo_url)
        .filter(Boolean);
    }

    // Nếu có thêm ảnh biên bản vắng chủ (khi có biên bản thường) hoặc ảnh hồ sơ hoàn công bổ sung
    const extraDocs: string[] = [];
    if (!isAbsentee && Array.isArray(json.absenteeMinutesPhotos) && json.absenteeMinutesPhotos.length > 0) {
      extraDocs.push(...json.absenteeMinutesPhotos.map((p: any) => typeof p === 'string' ? p : p?.url).filter(Boolean));
    }
    const asBuiltList = json.asBuiltDrawingPhotos || json.asBuiltDrawingFiles || rawReport.as_built_drawing_photos_json;
    if (Array.isArray(asBuiltList) && asBuiltList.length > 0) {
      for (const item of asBuiltList) {
        const u = typeof item === 'string' ? item : item?.url;
        if (u && !minutesPhotos.includes(u) && !extraDocs.includes(u)) {
          extraDocs.push(u);
        }
      }
    }
    const allDocPhotos = [...minutesPhotos, ...extraDocs].filter(Boolean);

    const ownerFeedbackText = rawReport.owner_remarks || json.signatures?.ownerFeedback || json.ownerRemarks || '';

    return {
      surveyTime: surveyDateWithTime,
      ownerRepresentative: {
        vi: isAbsentee
          ? `${rawReport.owner_name || json.ownerName || 'Chủ hộ'} (Vắng mặt tại thời điểm khảo sát)`
          : `${rawReport.owner_name || json.signatures?.ownerRepresentative?.fullName || json.ownerName || 'Chủ hộ'} - Chủ nhà`,
        en: isAbsentee
          ? `${rawReport.owner_name || json.ownerName || 'Property Owner'} (Absent during survey)`
          : `${rawReport.owner_name || json.signatures?.ownerRepresentative?.fullName || json.ownerName || 'Property Owner'} - Owner`,
      },
      localAuthority: {
        vi: json.signatures?.localAuthority?.fullName
          ? `${json.signatures.localAuthority.fullName}${json.signatures.localAuthority.title ? ` - ${json.signatures.localAuthority.title}` : ''}`
          : 'Đại diện chính quyền địa phương (chưa ký)',
        en: json.signatures?.localAuthority?.fullName
          ? `${json.signatures.localAuthority.fullName}${json.signatures.localAuthority.title ? ` - ${json.signatures.localAuthority.title}` : ''}`
          : 'Local authority representative (unsigned)',
      },
      supervisionConsultant: {
        vi: json.signatures?.supervisionConsultant?.fullName
          ? `${json.signatures.supervisionConsultant.fullName}${json.signatures.supervisionConsultant.title ? ` - ${json.signatures.supervisionConsultant.title}` : ''}`
          : 'Đang mời tham gia xác nhận hiện trường',
        en: json.signatures?.supervisionConsultant?.fullName
          ? `${json.signatures.supervisionConsultant.fullName}${json.signatures.supervisionConsultant.title ? ` - ${json.signatures.supervisionConsultant.title}` : ''}`
          : 'Invited to site witness',
      },
      surveyUnit: {
        vi: surveyorName
          ? `${surveyorName} - Kỹ sư khảo sát hiện trường, Liên danh CRLG – CRSRI – TT`
          : 'Kỹ sư khảo sát hiện trường, Liên danh CRLG – CRSRI – TT',
        en: surveyorName
          ? `${surveyorName} - Field survey engineer, CRLG – CRSRI – TT JV`
          : 'Field survey engineer, CRLG – CRSRI – TT JV',
      },
      fieldComments: {
        vi: isAbsentee
          ? 'Khảo sát vắng chủ – Lập biên bản niêm yết theo quy định'
          : (ownerFeedbackText || 'Không có ý kiến bổ sung'),
        en: isAbsentee
          ? 'Absentee survey – Official notice posted per procedure'
          : (ownerFeedbackText || 'No additional comments'),
      },
      electronicSignOff: {
        vi: isAbsentee
          ? `Khảo sát viên: ${surveyorName || 'Chưa ghi nhận'}; Tình trạng: Vắng mặt (Lập biên bản niêm yết theo quy định); Quản trị phân khu: ${zoneAdminName || 'Chưa duyệt'} – ngày ${surveyDateFormatted || '–'}`
          : `Khảo sát viên: ${surveyorName || 'Chưa ghi nhận'}; Chủ sở hữu: ${rawReport.owner_name || json.ownerName || 'Chủ hộ'} (đã ký); Quản trị phân khu: ${zoneAdminName || 'Chưa duyệt'} – ngày ${surveyDateFormatted || '–'}`,
        en: isAbsentee
          ? `Surveyor: ${surveyorName || 'Unrecorded'}; Status: Absent (Official notice posted per field procedure); Zone admin: ${zoneAdminName || 'Pending'} – ${surveyDateFormatted || '–'}`
          : `Surveyor: ${surveyorName || 'Unrecorded'}; Owner: ${rawReport.owner_name || json.ownerName || 'Property owner'} (signed); Zone admin: ${zoneAdminName || 'Pending'} – ${surveyDateFormatted || '–'}`,
      },
      dataSource: {
        vi: `Bản xuất phần mềm ${reportNo}, xuất lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${surveyDateFormatted || '–'}`,
        en: `Software export ${reportNo}, exported at ${new Date().toISOString()}`,
      },
      signedRecordPages: allDocPhotos.map((url: string, idx: number) => {
        const isAsBuilt = asBuiltList && Array.isArray(asBuiltList) && asBuiltList.some((ab: any) => (typeof ab === 'string' ? ab : ab?.url) === url);
        const docTitleVi = isAsBuilt
          ? `Bản vẽ thiết kế / hoàn công móng do chủ hộ cung cấp - trang ${idx + 1}`
          : isAbsentee
            ? `Biên bản niêm yết / thông báo khảo sát vắng chủ - trang ${idx + 1}/${allDocPhotos.length || 1}`
            : `Biên bản xác nhận khảo sát hiện trường - trang ${idx + 1}/${allDocPhotos.length || 1}`;
        const docTitleEn = isAsBuilt
          ? `As-built / structural drawing provided by owner - page ${idx + 1}`
          : isAbsentee
            ? `Absentee survey notice / record - page ${idx + 1}/${allDocPhotos.length || 1}`
            : `Signed site-survey record - page ${idx + 1}/${allDocPhotos.length || 1}`;

        return {
          pageIndex: idx + 1,
          title: {
            vi: docTitleVi,
            en: docTitleEn,
          },
          url,
          base64: ReportImageResolver.resolveToBase64(url),
          alreadyWatermarked: isPhotoAlreadyWatermarked(url),
          watermarkDateTime: extractPhotoDateTime(url, null, rawSurveyDate),
          metroPhotoCode: isAsBuilt
            ? `HCM_M2.[${buildingId || 'CHƯA_ĐỊNH_DANH'}]_DOC_AS_BUILT_${String(idx + 1).padStart(2, '0')}`
            : isAbsentee
              ? `HCM_M2.[${buildingId || 'CHƯA_ĐỊNH_DANH'}]_DOC_ABSENTEE_${String(idx + 1).padStart(2, '0')}`
              : `HCM_M2.[${buildingId || 'CHƯA_ĐỊNH_DANH'}]_DOC_MINUTES_${String(idx + 1).padStart(2, '0')}`,
        };
      }),
    };
  }

  public static mapAppendix4(
    appendix1: Appendix1PhotoItem[],
    appendix2: FloorPlanDefectReport[],
    rawReport?: any,
    json?: any
  ): Appendix4EquipmentAndAccess {
    const rawScope = json?.surveyScope || {};
    const rawLimitation = json?.accessLimitation || {};
    const isAbsentee = Boolean(json?.isAbsenteeSurvey || rawReport?.is_absentee_survey);

    // Mái / Sân thượng
    const hasRoofScope = rawScope.roofTerrace ?? rawScope.roof;
    let roofAccessed = true;
    let roofNotAccessed = false;
    let roofRemarkVi = 'Khảo sát đầy đủ hiện trạng';
    let roofRemarkEn = 'Full survey completed';

    if (hasRoofScope === false) {
      roofAccessed = false;
      roofNotAccessed = true;
      roofRemarkVi = 'Chưa khảo sát / không tiếp cận sân thượng';
      roofRemarkEn = 'Not surveyed / inaccessible roof';
    } else if (rawLimitation.restrictedAreas && Array.isArray(rawLimitation.restrictedAreas)) {
      const isRoofRestricted = rawLimitation.restrictedAreas.some((a: string) =>
        a.toLowerCase().includes('mái') || a.toLowerCase().includes('sân thượng') || a.toLowerCase().includes('roof')
      );
      if (isRoofRestricted) {
        roofAccessed = false;
        roofNotAccessed = true;
        roofRemarkVi = 'Hạn chế tiếp cận theo ghi nhận hiện trường';
        roofRemarkEn = 'Restricted access per field notes';
      }
    }

    // Tầng hầm
    const basementCount = Number(rawReport?.basement_count ?? json?.undergroundFloors ?? 0);
    let basementAccessed = false;
    let basementNotAccessed = false;
    let basementRemarkVi = 'Không có tầng hầm (N/A)';
    let basementRemarkEn = 'No basement (N/A)';

    if (basementCount > 0) {
      const hasBaseScope = Boolean(rawScope.basement);
      basementAccessed = hasBaseScope;
      basementNotAccessed = !hasBaseScope;
      basementRemarkVi = hasBaseScope ? 'Đã khảo sát tầng hầm' : 'Chưa khảo sát tầng hầm';
      basementRemarkEn = hasBaseScope ? 'Basement surveyed' : 'Basement not surveyed';
    }

    // Phân loại tiếp cận
    let accessClassVi = 'Phân loại tiếp cận: không hạn chế (100%).';
    let accessClassEn = 'Access classification: no restriction (100%).';

    if (isAbsentee) {
      accessClassVi = 'Phân loại tiếp cận: Khảo sát vắng chủ (chỉ tiếp cận mặt ngoài).';
      accessClassEn = 'Access classification: Absentee survey (exterior only).';
    } else if (rawLimitation.type === 'PARTIAL' || roofNotAccessed || basementNotAccessed) {
      accessClassVi = 'Phân loại tiếp cận: Hạn chế một phần (xem chi tiết Mục IX).';
      accessClassEn = 'Access classification: Partially restricted (see Section IX).';
    } else if (rawLimitation.type === 'REFUSED') {
      accessClassVi = 'Phân loại tiếp cận: Chủ hộ từ chối tiếp cận một số khu vực.';
      accessClassEn = 'Access classification: Owner refused access to certain areas.';
    }

    return {
      equipmentList: [
        {
          no: 1,
          equipment: { vi: 'Máy ảnh số có GPS', en: 'Digital camera with GPS' },
          specs: { vi: '≥ 12MP, tọa độ EXIF WGS-84', en: '≥ 12 MP, EXIF WGS-84' },
          purpose: { vi: 'Ảnh định danh P-01 – P-07, bối cảnh vết nứt', en: 'Identification photos, crack context' },
        },
        {
          no: 2,
          equipment: { vi: 'Thước đo bề rộng nứt', en: 'Crack width gauge' },
          specs: { vi: 'Vạch chia 0,1 – 10,0 mm', en: '0.1 – 10.0 mm' },
          purpose: { vi: 'Đo bề rộng lớn nhất wmax', en: 'Measure wmax' },
        },
        {
          no: 3,
          equipment: { vi: 'Thước laser / thước thép', en: 'Laser / steel tape' },
          specs: { vi: '± 1,5 mm, tầm đo 40 m', en: '± 1.5 mm, 40 m range' },
          purpose: { vi: 'Chiều dài nứt, kích thước phòng', en: 'Crack length, room size' },
        },
        {
          no: 4,
          equipment: { vi: 'Máy đo nghiêng / thước bọt nước', en: 'Inclinometer / spirit level' },
          specs: { vi: 'Độ chính xác 0,1‰ (cần kiểm tra)', en: 'Accuracy 0.1‰ (to be checked)' },
          purpose: { vi: 'Nghiêng thân nhà X/Y, võng dầm sàn', en: 'Building tilt X/Y, deflection' },
        },
      ],
      calibrationNotes: {
        vi: 'Model, số serial và chứng chỉ hiệu chuẩn thiết bị lưu tại hồ sơ phòng thí nghiệm.',
        en: 'Model, serial number and calibration certificates on file at testing laboratory.',
      },
      accessAreas: [
        {
          area: { vi: 'Mặt ngoài', en: 'Exterior' },
          accessed: appendix1.length > 0,
          notAccessed: appendix1.length === 0,
          remark: { vi: `P-01 – P-0${Math.min(7, appendix1.length)}`, en: `P-01 – P-0${Math.min(7, appendix1.length)}` },
        },
        {
          area: { vi: 'Tầng trệt & các lầu', en: 'Ground floor & upper floors' },
          accessed: appendix2.length > 0,
          notAccessed: appendix2.length === 0,
          remark: { vi: `${appendix2.length} tầng khảo sát đầy đủ`, en: `${appendix2.length} floors surveyed` },
        },
        {
          area: { vi: 'Mái / Sân thượng', en: 'Roof / Terrace' },
          accessed: roofAccessed,
          notAccessed: roofNotAccessed,
          remark: { vi: roofRemarkVi, en: roofRemarkEn },
        },
        {
          area: { vi: 'Tầng hầm', en: 'Basement' },
          accessed: basementAccessed,
          notAccessed: basementNotAccessed,
          remark: { vi: basementRemarkVi, en: basementRemarkEn },
        },
      ],
      accessClassification: {
        vi: accessClassVi,
        en: accessClassEn,
      },
    };
  }
}
