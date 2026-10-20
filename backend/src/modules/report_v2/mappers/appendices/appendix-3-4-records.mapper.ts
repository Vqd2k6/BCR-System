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
import type { ReportContentConfig } from '../../../report_config/report-config.types';

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

    const actualSignerName = json.signatures?.ownerRepresentative?.fullName || json.ownerRepresentativeName || rawReport.owner_rep_name;
    const finalOwnerName = actualSignerName || rawReport.owner_name || json.ownerName || 'Chủ hộ';
    const isOwnerItself = !actualSignerName || actualSignerName === (rawReport.owner_name || json.ownerName);
    const roleSuffixVi = isOwnerItself ? 'Chủ nhà' : 'Đại diện chủ sở hữu';
    const roleSuffixEn = isOwnerItself ? 'Owner' : 'Owner Representative';

    return {
      surveyTime: surveyDateWithTime,
      ownerRepresentative: {
        vi: isAbsentee
          ? `${finalOwnerName} (Vắng mặt tại thời điểm khảo sát)`
          : `${finalOwnerName} - ${roleSuffixVi}`,
        en: isAbsentee
          ? `${finalOwnerName} (Absent during survey)`
          : `${finalOwnerName} - ${roleSuffixEn}`,
      },
      localAuthority: {
        vi: json.signatures?.localAuthority?.fullName
          ? `${json.signatures.localAuthority.fullName}${json.signatures.localAuthority.title ? ` - ${json.signatures.localAuthority.title}` : ''}`
          : '--',
        en: json.signatures?.localAuthority?.fullName
          ? `${json.signatures.localAuthority.fullName}${json.signatures.localAuthority.title ? ` - ${json.signatures.localAuthority.title}` : ''}`
          : '--',
      },
      supervisionConsultant: {
        vi: json.signatures?.supervisionConsultant?.fullName
          ? `${json.signatures.supervisionConsultant.fullName}${json.signatures.supervisionConsultant.title ? ` - ${json.signatures.supervisionConsultant.title}` : ''}`
          : '--',
        en: json.signatures?.supervisionConsultant?.fullName
          ? `${json.signatures.supervisionConsultant.fullName}${json.signatures.supervisionConsultant.title ? ` - ${json.signatures.supervisionConsultant.title}` : ''}`
          : '--',
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
    json?: any,
    config?: ReportContentConfig
  ): Appendix4EquipmentAndAccess {
    const rawScope = json?.surveyScope || {};
    const rawLimitation = json?.accessLimitation || {};
    const isAbsentee = Boolean(json?.isAbsenteeSurvey || rawReport?.is_absentee_survey);

    // Mái / Sân thượng: Tôn trọng 100% khai báo tiếp cận của KSV
    const isFullAccess = rawLimitation.type === 'FULL_100';
    let roofAccessed = true;
    let roofNotAccessed = false;
    let roofRemarkVi = 'Khảo sát đầy đủ hiện trạng';
    let roofRemarkEn = 'Full survey completed';

    if (!isFullAccess && Array.isArray(rawLimitation.restrictedAreas)) {
      const isRoofRestricted = rawLimitation.restrictedAreas.some((a: string) =>
        typeof a === 'string' &&
        (a.toLowerCase().includes('mái') || a.toLowerCase().includes('sân thượng') || a.toLowerCase().includes('roof'))
      );
      if (isRoofRestricted) {
        roofAccessed = false;
        roofNotAccessed = true;
        roofRemarkVi = 'Hạn chế tiếp cận theo ghi nhận hiện trường';
        roofRemarkEn = 'Restricted access per field notes';
      }
    }

    // Tầng hầm: Chỉ tính khi công trình thực tế có thiết kế tầng hầm
    const basementCount = Number(rawReport?.basement_count ?? rawReport?.buildingSpecs?.basementCount ?? json?.buildingSpecs?.basementCount ?? json?.basementCount ?? json?.undergroundFloors ?? 0);
    const hasBaseScope = Boolean(rawScope.basement);
    const basementAccessed = basementCount > 0 && hasBaseScope;
    const basementNotAccessed = basementCount > 0 && !hasBaseScope;
    const basementRemarkVi = hasBaseScope ? 'Đã khảo sát tầng hầm' : 'Chưa khảo sát tầng hầm';
    const basementRemarkEn = hasBaseScope ? 'Basement surveyed' : 'Basement not surveyed';

    // Phân loại tiếp cận
    const hasLimitations = Boolean(
      rawLimitation.type === 'PARTIAL' ||
      rawLimitation.type === 'REFUSED' ||
      roofNotAccessed ||
      basementNotAccessed ||
      (Array.isArray(rawLimitation.restrictedAreas) && rawLimitation.restrictedAreas.length > 0)
    );

    let accessClassVi = 'Không hạn chế (100%).';
    let accessClassEn = 'No restriction (100%).';

    if (isAbsentee) {
      accessClassVi = 'Khảo sát vắng chủ (chỉ tiếp cận mặt ngoài).';
      accessClassEn = 'Absentee survey (exterior only).';
    } else if (rawLimitation.type === 'REFUSED') {
      accessClassVi = 'Chủ hộ từ chối tiếp cận một số khu vực.';
      accessClassEn = 'Owner refused access to certain areas.';
    } else if (hasLimitations) {
      accessClassVi = 'Hạn chế một phần (xem chi tiết Mục IX – Hạn chế khảo sát).';
      accessClassEn = 'Partially restricted (see Section IX – Survey Limitations).';
    }

    // Danh mục thiết bị từ CSDL cấu hình dự án (Q5)
    let equipmentList: any[] = [];
    if (config?.equipment && config.equipment.length > 0) {
      equipmentList = config.equipment.map((item, idx) => ({
        no: item.sortOrder || idx + 1,
        equipment: { vi: item.nameVi, en: item.nameEn || item.nameVi },
        modelSerial: {
          vi: item.model || item.serialNo ? `${item.model || '--'} (S/N: ${item.serialNo || '--'})` : '--',
          en: item.model || item.serialNo ? `${item.model || '--'} (S/N: ${item.serialNo || '--'})` : '--',
        },
        specs: { vi: item.specificationVi || '--', en: item.specificationEn || item.specificationVi || '--' },
        purpose: { vi: item.purposeVi || '--', en: item.purposeEn || item.purposeVi || '--' },
        calibration: {
          vi: item.calibrationCertNo || item.calibrationValidTo
            ? `Số: ${item.calibrationCertNo || '--'} · Hạn: ${item.calibrationValidTo || '--'}`
            : '--',
          en: item.calibrationCertNo || item.calibrationValidTo
            ? `Cert: ${item.calibrationCertNo || '--'} · Exp: ${item.calibrationValidTo || '--'}`
            : '--',
        },
      }));
    } else {
      equipmentList = [
        {
          no: 1,
          equipment: { vi: 'Máy ảnh số có GPS', en: 'Digital camera with GPS' },
          modelSerial: { vi: '--', en: '--' },
          specs: { vi: '≥ 12MP, tọa độ EXIF WGS-84', en: '≥ 12 MP, EXIF WGS-84' },
          purpose: { vi: 'Ảnh định danh P-01 – P-07, bối cảnh vết nứt', en: 'Identification photos, crack context' },
          calibration: { vi: '--', en: '--' },
        },
        {
          no: 2,
          equipment: { vi: 'Thước đo bề rộng nứt', en: 'Crack width gauge' },
          modelSerial: { vi: '--', en: '--' },
          specs: { vi: 'Vạch chia 0,1 – 10,0 mm', en: '0.1 – 10.0 mm' },
          purpose: { vi: 'Đo bề rộng lớn nhất wmax', en: 'Measure wmax' },
          calibration: { vi: '--', en: '--' },
        },
        {
          no: 3,
          equipment: { vi: 'Thước laser / thước thép', en: 'Laser / steel tape' },
          modelSerial: { vi: '--', en: '--' },
          specs: { vi: '± 1,5 mm, tầm đo 40 m', en: '± 1.5 mm, 40 m range' },
          purpose: { vi: 'Chiều dài nứt, kích thước phòng', en: 'Crack length, room size' },
          calibration: { vi: '--', en: '--' },
        },
        {
          no: 4,
          equipment: { vi: 'Máy đo nghiêng / thước bọt nước', en: 'Inclinometer / spirit level' },
          modelSerial: { vi: '--', en: '--' },
          specs: { vi: '--', en: '--' },
          purpose: { vi: 'Nghiêng thân nhà X/Y, võng dầm sàn', en: 'Building tilt X/Y, deflection' },
          calibration: { vi: '--', en: '--' },
        },
      ];
    }

    const calibrationNotes = config?.standardText?.calibrationNote ?? null;

    return {
      equipmentList,
      calibrationNotes,
      accessAreas: (() => {
        const list = [
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
        ];
        if (basementCount > 0) {
          list.push({
            area: { vi: 'Tầng hầm', en: 'Basement' },
            accessed: basementAccessed,
            notAccessed: basementNotAccessed,
            remark: { vi: basementRemarkVi, en: basementRemarkEn },
          });
        }
        return list;
      })(),
      accessClassification: {
        vi: accessClassVi,
        en: accessClassEn,
      },
    };
  }
}
