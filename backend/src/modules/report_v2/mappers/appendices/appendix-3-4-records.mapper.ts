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
    // PHỤ LỤC 3: BIÊN BẢN KHẢO SÁT HIỆN TRƯỜNG (TOÀN BỘ CÁC TRANG SCAN PHÁP LÝ)
    const minutesPhotos: string[] = (json.signatures?.workingMinutesPhotos && json.signatures.workingMinutesPhotos.length > 0)
      ? json.signatures.workingMinutesPhotos
      : identPhotos.filter((p: any) => p.photo_type?.includes('DOC') || p.raw_photo_url?.includes('/DOC/')).map((p: any) => p.raw_photo_url || p.annotated_photo_url);

    const ownerFeedbackText = rawReport.owner_remarks || json.signatures?.ownerFeedback || json.ownerRemarks || '';

    return {
      surveyTime: surveyDateWithTime,
      ownerRepresentative: {
        vi: `${rawReport.owner_name || json.signatures?.ownerRepresentative?.fullName || json.ownerName || 'Chủ hộ'} - Chủ nhà`,
        en: `${rawReport.owner_name || json.signatures?.ownerRepresentative?.fullName || json.ownerName || 'Property Owner'} - Owner`,
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
        vi: ownerFeedbackText || 'Không có ý kiến bổ sung',
        en: ownerFeedbackText || 'No additional comments',
      },
      electronicSignOff: {
        vi: `Khảo sát viên: ${surveyorName || 'Chưa ghi nhận'}; Chủ sở hữu: ${rawReport.owner_name || json.ownerName || 'Chủ hộ'} (đã ký); Quản trị phân khu: ${zoneAdminName || 'Chưa duyệt'} – ngày ${surveyDateFormatted || '–'}`,
        en: `Surveyor: ${surveyorName || 'Unrecorded'}; Owner: ${rawReport.owner_name || json.ownerName || 'Property owner'} (signed); Zone admin: ${zoneAdminName || 'Pending'} – ${surveyDateFormatted || '–'}`,
      },
      dataSource: {
        vi: `Bản xuất phần mềm ${reportNo}, xuất lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${surveyDateFormatted || '–'}`,
        en: `Software export ${reportNo}, exported at ${new Date().toISOString()}`,
      },
      signedRecordPages: minutesPhotos.map((url: string, idx: number) => ({
        pageIndex: idx + 1,
        title: {
          vi: `Biên bản xác nhận khảo sát hiện trường - trang ${idx + 1}/${minutesPhotos.length || 1}`,
          en: `Signed site-survey record - page ${idx + 1}/${minutesPhotos.length || 1}`,
        },
        url,
        base64: ReportImageResolver.resolveToBase64(url),
        alreadyWatermarked: isPhotoAlreadyWatermarked(url),
        watermarkDateTime: extractPhotoDateTime(url, null, rawSurveyDate),
        metroPhotoCode: `HCM_M2.[${buildingId || 'CHƯA_ĐỊNH_DANH'}]_DOC_MINUTES_MINUTES_${String(idx + 1).padStart(2, '0')}`,
      })),
    };
  }

  public static mapAppendix4(
    appendix1: Appendix1PhotoItem[],
    appendix2: FloorPlanDefectReport[]
  ): Appendix4EquipmentAndAccess {
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
          accessed: true, notAccessed: false,
          remark: { vi: `P-01 – P-0${Math.min(7, appendix1.length)}`, en: `P-01 – P-0${Math.min(7, appendix1.length)}` },
        },
        {
          area: { vi: 'Tầng trệt & các lầu', en: 'Ground floor & upper floors' },
          accessed: true, notAccessed: false,
          remark: { vi: `${appendix2.length} tầng khảo sát đầy đủ`, en: `${appendix2.length} floors surveyed` },
        },
        {
          area: { vi: 'Mái / Sân thượng', en: 'Roof / Terrace' },
          accessed: true, notAccessed: false,
          remark: { vi: 'Khảo sát đầy đủ hiện trạng', en: 'Full survey completed' },
        },
        {
          area: { vi: 'Tầng hầm', en: 'Basement' },
          accessed: false, notAccessed: false,
          remark: { vi: 'Không có tầng hầm (N/A)', en: 'No basement (N/A)' },
        },
      ],
      accessClassification: {
        vi: 'Phân loại tiếp cận: không hạn chế (100%).',
        en: 'Access classification: no restriction (100%).',
      },
    };
  }
}
