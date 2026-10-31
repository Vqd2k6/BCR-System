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
  Section12AsBuiltReport,
  AsBuiltDrawingSheet,
  AsBuiltDrawingItem,
} from '../../report.types';
import { ReportImageResolver } from '../../services/report-image-resolver.service';
import { isPhotoAlreadyWatermarked } from './appendix-2/floor-defect.mapper';
import { extractPhotoDateTime, parseSurveyDate } from '../formatters.mapper';
import { resolveContactPhone, resolveRecordAddress } from '../sections/section-1-2-overview-spatial.mapper';
import { resolveLocalRepresentative } from './local-authority.rules';
import type { ReportContentConfig } from '../../../report_config/report-config.types';

export interface SignedRecordDocItem {
  url: string;
  kind: 'MINUTES' | 'ABSENCE';
  kindIdx: number;
}

/** Đơn vị giám sát mặc định khi hồ sơ không ghi nhận tư vấn giám sát riêng. */
const DEFAULT_SUPERVISION_CONSULTANT = {
  vi: 'Tổng thầu EPC-THACO-CREC',
  en: 'EPC General Contractor THACO-CREC',
};

export class Appendix3And4Mapper {
  /** Hồ sơ vắng chủ: các luồng nhập lưu cờ ở những nơi khác nhau nên chỉ cần một cờ bật là đủ. */
  public static isAbsenteeReport(rawReport: any, json: any): boolean {
    return Boolean(
      json.isAbsentee ||
      json.isAbsenteeSurvey ||
      json.surveyCaseType === 'ABSENTEE' ||
      rawReport.is_absentee_survey ||
      rawReport.is_refused_or_absent
    );
  }

  public static collectSignedRecordDocs(rawReport: any, json: any, identPhotos: any[] = []): SignedRecordDocItem[] {
    const isAbsentee = this.isAbsenteeReport(rawReport, json);
    const extractUrl = (p: unknown): string => {
      if (typeof p === 'string') return p.trim();
      if (p && typeof p === 'object') {
        const rec = p as Record<string, unknown>;
        return String(rec.url || rec.photoUrl || '').trim();
      }
      return '';
    };

    const rawAbsNoticeList =
      json.absenteeNoticePhotos ||
      json.absentNoticePhotos ||
      json.absenteeMinutesPhotos ||
      rawReport.absenteeNoticePhotos ||
      [];
    const absNoticeUrls: string[] = Array.isArray(rawAbsNoticeList)
      ? rawAbsNoticeList.map(extractUrl).filter(Boolean)
      : [];
    const rawAbsLogs = Array.isArray(json.absenceLogs)
      ? json.absenceLogs
      : (Array.isArray(rawReport.absenceLogs) ? rawReport.absenceLogs : []);
    for (const log of rawAbsLogs) {
      const logUrl = String(log?.evidencePhotoUrl || log?.evidence_photo_url || log?.photoUrl || log?.url || '').trim();
      if (logUrl && !absNoticeUrls.includes(logUrl)) {
        absNoticeUrls.push(logUrl);
      }
    }

    const rootWorkingMinutes = Array.isArray(json.workingMinutesPhotos)
      ? json.workingMinutesPhotos.map(extractUrl).filter(Boolean)
      : [];
    const sigWorkingMinutes = Array.isArray(json.signatures?.workingMinutesPhotos)
      ? json.signatures.workingMinutesPhotos.map(extractUrl).filter(Boolean)
      : [];
    const mergedWorkingMinutes: string[] = [];
    for (const u of [...rootWorkingMinutes, ...sigWorkingMinutes]) {
      if (u && !mergedWorkingMinutes.includes(u)) {
        mergedWorkingMinutes.push(u);
      }
    }
    if (mergedWorkingMinutes.length === 0) {
      const dbDocPhotos = identPhotos
        .filter((p: Record<string, unknown>) => String(p.photo_type || '').includes('DOC') || String(p.raw_photo_url || '').includes('/DOC/'))
        .map((p: Record<string, unknown>) => String(p.raw_photo_url || p.annotated_photo_url || '').trim())
        .filter(Boolean);
      for (const u of dbDocPhotos) {
        if (!mergedWorkingMinutes.includes(u)) mergedWorkingMinutes.push(u);
      }
    }

    const allDocItems: SignedRecordDocItem[] = [];
    const seenDocUrls = new Set<string>();
    const pushDocGroup = (urls: string[], kind: 'MINUTES' | 'ABSENCE') => {
      urls.forEach((u, kindIdx) => {
        if (u && !seenDocUrls.has(u)) {
          seenDocUrls.add(u);
          allDocItems.push({ url: u, kind, kindIdx });
        }
      });
    };
    if (isAbsentee) {
      pushDocGroup(absNoticeUrls, 'ABSENCE');
      pushDocGroup(mergedWorkingMinutes, 'MINUTES');
    } else {
      pushDocGroup(mergedWorkingMinutes, 'MINUTES');
      pushDocGroup(absNoticeUrls, 'ABSENCE');
    }
    return allDocItems;
  }

  public static mapAppendix3(
    rawReport: any,
    json: any,
    identPhotos: any[] = [],
    surveyDateWithTime: string = '',
    surveyDateFormatted: string = '',
    surveyorName: string = '',
    zoneAdminName: string = '',
    reportNo: string = '',
    buildingId?: string,
    rawSurveyDate?: any
  ): Appendix3SignedRecord {
    const isAbsentee = this.isAbsenteeReport(rawReport, json);
    const allDocItems = this.collectSignedRecordDocs(rawReport, json, identPhotos);

    const ownerFeedbackText = json.signatures?.ownerFeedback ?? json.ownerFeedback ?? json.ownerRemarks ?? rawReport.owner_remarks ?? '';
    const rawRepName = json.signatures?.ownerRepresentative?.fullName || json.ownerRepresentativeName || rawReport.owner_rep_name || '';
    const isRepCadastral = !rawRepName || /chủ\s*hộ\s*thửa/i.test(rawRepName) || /tờ\s*bản\s*đồ/i.test(rawRepName);
    const actualSignerName = isRepCadastral ? '' : rawRepName.trim();
    const ownerName = String(json.ownerName ?? json.signatures?.ownerName ?? rawReport.owner_name ?? '').trim();
    const finalOwnerName = actualSignerName || ownerName || 'Chủ hộ';
    const isOwnerItself = !actualSignerName || actualSignerName === ownerName;
    const roleSuffixVi = isOwnerItself ? 'Chủ nhà' : 'Đại diện chủ sở hữu / Người sử dụng';
    const roleSuffixEn = isOwnerItself ? 'Owner' : 'Owner Representative / Occupant';

    const witnessName = String(json.signatures?.localAuthority?.fullName || json.signatures?.witnessName || json.witnessInfo?.name || json.witnessName || '').trim();
    const witnessRole = String(json.signatures?.localAuthority?.title || json.signatures?.witnessRole || json.witnessInfo?.role || json.witnessRole || '').trim();
    const supName = json.signatures?.supervisionConsultant?.fullName;
    const supTitle = json.signatures?.supervisionConsultant?.title;
    const localAuthorityText = witnessName
      ? `${witnessName}${witnessRole ? ` - ${witnessRole}` : ''}`
      : resolveLocalRepresentative(
          rawReport.zone_id,
          json.ward || rawReport.ward,
          json.street || rawReport.street,
          rawReport.district
        ) || '--';
    const parcelCode = rawReport.project_parcel_code || json.projectParcelCode || '';
    const codeLabel = parcelCode ? ` ${parcelCode}` : '';

    return {
      surveyTime: surveyDateWithTime,
      address: resolveRecordAddress(rawReport, json),
      contactPhone: resolveContactPhone(rawReport, json) || '--',
      ownerRepresentative: {
        vi: isAbsentee ? `${finalOwnerName} (Vắng mặt tại thời điểm khảo sát)` : `${finalOwnerName} - ${roleSuffixVi}`,
        en: isAbsentee ? `${finalOwnerName} (Absent during survey)` : `${finalOwnerName} - ${roleSuffixEn}`,
      },
      localAuthority: {
        vi: localAuthorityText,
        en: localAuthorityText,
      },
      supervisionConsultant: {
        vi: supName ? `${supName}${supTitle ? ` - ${supTitle}` : ''}` : DEFAULT_SUPERVISION_CONSULTANT.vi,
        en: supName ? `${supName}${supTitle ? ` - ${supTitle}` : ''}` : DEFAULT_SUPERVISION_CONSULTANT.en,
      },
      surveyUnit: {
        vi: 'Liên danh CRLG – CRSRI – TT',
        en: 'CRLG – CRSRI – TT Joint Venture',
      },
      fieldComments: {
        vi: isAbsentee ? 'Khảo sát vắng chủ – Lập biên bản niêm yết theo quy định' : (ownerFeedbackText || 'Không có ý kiến bổ sung'),
        en: isAbsentee ? 'Absentee survey – Official notice posted per procedure' : (ownerFeedbackText || 'No additional comments'),
      },
      electronicSignOff: {
        vi: isAbsentee
          ? `Khảo sát viên: ${surveyorName || 'Chưa ghi nhận'}; Tình trạng: Vắng mặt (Lập biên bản niêm yết theo quy định); Quản trị phân khu: ${zoneAdminName || 'Chưa duyệt'} – ngày ${surveyDateFormatted || '–'}`
          : `Khảo sát viên: ${surveyorName || 'Chưa ghi nhận'}; Chủ sở hữu: ${json.ownerName || rawReport.owner_name || 'Chủ hộ'} (đã ký); Quản trị phân khu: ${zoneAdminName || 'Chưa duyệt'} – ngày ${surveyDateFormatted || '–'}`,
        en: isAbsentee
          ? `Surveyor: ${surveyorName || 'Unrecorded'}; Status: Absent (Official notice posted per field procedure); Zone admin: ${zoneAdminName || 'Pending'} – ${surveyDateFormatted || '–'}`
          : `Surveyor: ${surveyorName || 'Unrecorded'}; Owner: ${json.ownerName || rawReport.owner_name || 'Property owner'} (signed); Zone admin: ${zoneAdminName || 'Pending'} – ${surveyDateFormatted || '–'}`,
      },
      dataSource: (() => {
        const isApproved = String(rawReport.status || '').toUpperCase() === 'APPROVED';
        const refIso = (isApproved && rawReport.approved_at)
          ? new Date(rawReport.approved_at).toISOString()
          : (parseSurveyDate(rawSurveyDate)?.toISOString() ?? '');
        return {
          vi: `Bản xuất phần mềm ${reportNo}, ngày khảo sát ${surveyDateFormatted || '–'}`,
          en: `Software export ${reportNo}${refIso ? `, approved/recorded at ${refIso}` : ''}`,
        };
      })(),
      signedRecordPages: allDocItems.map((docItem, idx: number) => {
        const { url, kind, kindIdx } = docItem;
        const rotMap = json.photoRotations || rawReport.photoRotations || {};
        const docRot = kind === 'ABSENCE'
          ? (rotMap[`absenceNotice_${kindIdx}`] ?? rotMap[`ABSENCE-${kindIdx + 1}`] ?? rotMap[url] ?? 0)
          : (rotMap[`minutes_${kindIdx}`] ?? rotMap[`workingMinutesPhotos_${kindIdx}`] ?? rotMap[`MINUTES-${kindIdx + 1}`] ?? rotMap[url] ?? 0);
        const isAbsPage = isAbsentee || kind === 'ABSENCE';
        const docTitleVi = isAbsPage
          ? `Biên bản niêm yết / thông báo khảo sát vắng chủ${codeLabel} - trang ${idx + 1}/${allDocItems.length || 1}`
          : `Biên bản xác nhận khảo sát hiện trường${codeLabel} - trang ${idx + 1}/${allDocItems.length || 1}`;
        const docTitleEn = isAbsPage
          ? `Absentee survey notice / record - page ${idx + 1}/${allDocItems.length || 1}`
          : `Signed site-survey record - page ${idx + 1}/${allDocItems.length || 1}`;

        return {
          pageIndex: idx + 1,
          title: { vi: docTitleVi, en: docTitleEn },
          url,
          base64: ReportImageResolver.resolveToBase64(url, docRot),
          rotation: Number(docRot) || 0,
          alreadyWatermarked: isPhotoAlreadyWatermarked(url),
          watermarkDateTime: extractPhotoDateTime(url, null, rawSurveyDate),
          metroPhotoCode: isAbsPage
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

    const isFullAccess = rawLimitation.type === 'FULL_100';
    let roofAccessed = true;
    let roofNotAccessed = false;
    let roofRemarkVi = 'Khảo sát đầy đủ hiện trạng';
    let roofRemarkEn = 'Full survey completed';

    if (!isFullAccess && Array.isArray(rawLimitation.restrictedAreas)) {
      const isRoofRestricted = rawLimitation.restrictedAreas.some((a: string) =>
        typeof a === 'string' && (a.toLowerCase().includes('mái') || a.toLowerCase().includes('sân thượng') || a.toLowerCase().includes('roof'))
      );
      if (isRoofRestricted) {
        roofAccessed = false;
        roofNotAccessed = true;
        roofRemarkVi = 'Hạn chế tiếp cận theo ghi nhận hiện trường';
        roofRemarkEn = 'Restricted access per field notes';
      }
    }

    const basementCount = Number(json?.undergroundFloors ?? json?.basementCount ?? json?.buildingSpecs?.basementCount ?? rawReport?.basement_count ?? rawReport?.buildingSpecs?.basementCount ?? 0);
    const hasBaseScope = Boolean(rawScope.basement);
    const basementAccessed = basementCount > 0 && hasBaseScope;
    const basementNotAccessed = basementCount > 0 && !hasBaseScope;

    const hasLimitations = Boolean(
      !isFullAccess && (
        rawLimitation.type === 'LIMITED' ||
        rawLimitation.type === 'EXTERNAL_ONLY' ||
        rawLimitation.type === 'PARTIAL' ||
        rawLimitation.type === 'REFUSED' ||
        roofNotAccessed ||
        basementNotAccessed ||
        (Array.isArray(rawLimitation.restrictedAreas) && rawLimitation.restrictedAreas.length > 0)
      )
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
          vi: item.calibrationCertNo || item.calibrationValidTo ? `Số: ${item.calibrationCertNo || '--'} · Hạn: ${item.calibrationValidTo || '--'}` : '--',
          en: item.calibrationCertNo || item.calibrationValidTo ? `Cert: ${item.calibrationCertNo || '--'} · Exp: ${item.calibrationValidTo || '--'}` : '--',
        },
      }));
    } else {
      equipmentList = [
        { no: 1, equipment: { vi: 'Máy ảnh số có GPS', en: 'Digital camera with GPS' }, modelSerial: { vi: '--', en: '--' }, specs: { vi: '≥ 12MP, tọa độ EXIF WGS-84', en: '≥ 12 MP, EXIF WGS-84' }, purpose: { vi: 'Ảnh định danh P-01 – P-07, bối cảnh vết nứt', en: 'Identification photos, crack context' }, calibration: { vi: '--', en: '--' } },
        { no: 2, equipment: { vi: 'Thước đo bề rộng nứt', en: 'Crack width gauge' }, modelSerial: { vi: '--', en: '--' }, specs: { vi: 'Vạch chia 0,1 – 10,0 mm', en: '0.1 – 10.0 mm' }, purpose: { vi: 'Đo bề rộng lớn nhất wmax', en: 'Measure wmax' }, calibration: { vi: '--', en: '--' } },
        { no: 3, equipment: { vi: 'Thước laser / thước thép', en: 'Laser / steel tape' }, modelSerial: { vi: '--', en: '--' }, specs: { vi: '± 1,5 mm, tầm đo 40 m', en: '± 1.5 mm, 40 m range' }, purpose: { vi: 'Chiều dài nứt, kích thước phòng', en: 'Crack length, room size' }, calibration: { vi: '--', en: '--' } },
        { no: 4, equipment: { vi: 'Máy đo nghiêng / thước bọt nước', en: 'Inclinometer / spirit level' }, modelSerial: { vi: '--', en: '--' }, specs: { vi: '--', en: '--' }, purpose: { vi: 'Nghiêng thân nhà X/Y, võng dầm sàn', en: 'Building tilt X/Y, deflection' }, calibration: { vi: '--', en: '--' } },
      ];
    }

    const accessAreas = [
      { area: { vi: 'Mặt ngoài', en: 'Exterior' }, accessed: appendix1.length > 0, notAccessed: appendix1.length === 0, remark: { vi: `P-01 – P-0${Math.min(7, appendix1.length)}`, en: `P-01 – P-0${Math.min(7, appendix1.length)}` } },
      { area: { vi: 'Tầng trệt & các lầu', en: 'Ground floor & upper floors' }, accessed: appendix2.length > 0, notAccessed: appendix2.length === 0, remark: { vi: `${appendix2.length} tầng khảo sát đầy đủ`, en: `${appendix2.length} floors surveyed` } },
      { area: { vi: 'Mái / Sân thượng', en: 'Roof / Terrace' }, accessed: roofAccessed, notAccessed: roofNotAccessed, remark: { vi: roofRemarkVi, en: roofRemarkEn } },
    ];
    if (basementCount > 0) {
      accessAreas.push({
        area: { vi: 'Tầng hầm', en: 'Basement' },
        accessed: basementAccessed,
        notAccessed: basementNotAccessed,
        remark: { vi: hasBaseScope ? 'Đã khảo sát tầng hầm' : 'Chưa khảo sát tầng hầm', en: hasBaseScope ? 'Basement surveyed' : 'Basement not surveyed' },
      });
    }

    return {
      equipmentList,
      calibrationNotes: config?.standardText?.calibrationNote ?? null,
      accessAreas,
      accessClassification: { vi: accessClassVi, en: accessClassEn },
    };
  }

  public static mapSection12AsBuilt(rawReport: any, json: any): Section12AsBuiltReport {
    const rawList = json.asBuiltDrawingPhotos || json.asBuiltDrawingFiles || json.asBuiltDrawings || rawReport.as_built_drawings || rawReport.as_built_drawing_photos_json || [];
    const list = Array.isArray(rawList) ? rawList : [];
    const validItems = list.filter((item: any) => {
      const u = typeof item === 'string' ? item : (item?.url || item?.photoUrl);
      return Boolean(u && typeof u === 'string' && u.trim() !== '' && !u.startsWith('blob:'));
    });

    const rotMap = json.photoRotations || rawReport.photoRotations || {};
    const drawings: AsBuiltDrawingItem[] = validItems.map((item: any, idx: number) => {
      const url = typeof item === 'string' ? item : (item?.url || item?.photoUrl);
      const photoCode = item?.photoCode || `CAT-DWG-${String(idx + 1).padStart(2, '0')}`;
      const customTitle = item?.title || item?.caption || item?.pageNote;
      const rotation = item?.rotation ?? rotMap[`asBuiltDrawing_${idx}`] ?? rotMap[photoCode] ?? rotMap[url] ?? 0;
      return {
        index: idx + 1,
        title: {
          vi: customTitle || `Bản vẽ thiết kế / hoàn công móng do chủ hộ cung cấp (Bản vẽ ${idx + 1})`,
          en: customTitle || `As-built / structural foundation drawing provided by owner (Drawing ${idx + 1})`,
        },
        url,
        base64: ReportImageResolver.resolveToBase64(url, rotation),
        photoCode,
        rotation,
      };
    });

    const sheets: AsBuiltDrawingSheet[] = [];
    const chunkSize = 2;
    for (let i = 0; i < drawings.length; i += chunkSize) {
      sheets.push({
        sheetIndex: Math.floor(i / chunkSize) + 1,
        totalSheets: Math.ceil(drawings.length / chunkSize),
        drawings: drawings.slice(i, i + chunkSize),
      });
    }

    return { hasDrawings: drawings.length > 0, totalDrawings: drawings.length, sheets };
  }
}

