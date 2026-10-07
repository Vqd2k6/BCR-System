/**
 * ============================================================================
 * APPENDIX 1 MAPPER: EXTERIOR IDENTIFICATION PHOTOS (P-01 TO P-07)
 * Phụ lục 1: Bản vẽ mặt đứng ngoài & Bộ ảnh định danh công trình
 * ============================================================================
 */

import { Appendix1PhotoItem, Appendix1PhotoPage } from '../../report-v2.types';
import { ReportImageResolver } from '../../services/report-image-resolver.service';
import { isPhotoAlreadyWatermarked } from '../floor-defect.mapper';
import { extractPhotoDateTime } from '../formatters.mapper';
import { isPortraitImage } from '../../../report/generators/residential/residential.image-sniff';

export interface Appendix1Result {
  appendix1: Appendix1PhotoItem[];
  appendix1Pages: Appendix1PhotoPage[];
  p02Url: string | undefined;
  p03List: any[];
  singleP03Url: string | undefined;
  p05Url: string | undefined;
}

export class Appendix1PhotoMapper {
  public static map(
    rawReport: any,
    json: any,
    identPhotos: any[],
    deform: any,
    buildingId: string,
    defaultLat: number,
    defaultLng: number,
    surveyDateFormatted: string,
    rawSurveyDate: any
  ): Appendix1Result {
    const findPhoto = (types: string[], fallbackUrl?: string) => {
      const p = identPhotos.find((item: any) =>
        types.includes(item.photo_type) ||
        types.some((t) => item.photo_code?.includes(t))
      );
      return p?.raw_photo_url || p?.annotated_photo_url || fallbackUrl || '';
    };

    const p01Item = identPhotos.find((p: any) =>
      p.photo_type === 'P01_HOUSE_NUMBER' ||
      p.photo_code?.includes('P01') ||
      p.photo_code?.includes('P-01')
    );
    const p02Item = identPhotos.find((p: any) =>
      p.photo_type === 'P02_MAIN_FACADE' ||
      p.photo_code?.includes('P02') ||
      p.photo_code?.includes('P-02') ||
      p.photo_type === 'P02'
    );

    const tiltPhotoObj = rawReport.deformation?.tilt_photos_json?.[0] || deform.buildingTilt?.photos?.[0];
    const p05Url =
      json.photoP05?.url ||
      (typeof json.photoP05 === 'string' ? json.photoP05 : undefined) ||
      json.photos?.p05 ||
      json.step1Photos?.p05TiltCheckUrl ||
      tiltPhotoObj?.url ||
      deform.buildingTilt?.photoUrl ||
      findPhoto(['P05_TILT_CHECK', 'P05', 'P-05', 'TILT', 'ELEV_TILT']);

    const settlePhotoObj = rawReport.deformation?.diff_settlement_photos_json?.[0] || deform.diffSettlement?.photos?.[0];
    const p06Url =
      settlePhotoObj?.url ||
      deform.diffSettlement?.photoUrl ||
      findPhoto(['FOUND_SETTLE', 'SETTLE', 'P06', 'P-06']);

    const appendix1: Appendix1PhotoItem[] = [];

    // 1. P-01: Biển số nhà
    const p01Url =
      json.photoP01?.url ||
      (typeof json.photoP01 === 'string' ? json.photoP01 : undefined) ||
      json.photos?.p01 ||
      json.step1Photos?.p01HouseNumberUrl ||
      findPhoto(['P01_HOUSE_NUMBER', 'P01', 'P-01']);
    if (p01Url) {
      appendix1.push({
        photoCode: 'P-01',
        name: { vi: 'Biển số nhà / tên công trình', en: 'House number / signboard' },
        url: p01Url,
        base64: ReportImageResolver.resolveToBase64(p01Url),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: 'P01_HOUS',
        metroPhotoCode: `HCM_M2.[${buildingId}]_P01_HOUS`,
        watermarkDateTime: extractPhotoDateTime(p01Url, p01Item?.shot_at || p01Item?.created_at, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p01Url),
      });
    }

    // 2. P-02: Mặt đứng chính toàn cảnh
    const p02Url =
      json.photoP02?.url ||
      (typeof json.photoP02 === 'string' ? json.photoP02 : undefined) ||
      json.photos?.p02 ||
      json.step1Photos?.p02MainFacadeUrl ||
      findPhoto(['P02_MAIN_FACADE', 'P02', 'P-02']);
    if (p02Url) {
      appendix1.push({
        photoCode: 'P-02',
        name: { vi: 'Mặt đứng chính toàn cảnh', en: 'Overall view of the main facade' },
        url: p02Url,
        base64: ReportImageResolver.resolveToBase64(p02Url),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: 'P02_MAIN',
        metroPhotoCode: `HCM_M2.[${buildingId}]_P02_MAIN`,
        watermarkDateTime: extractPhotoDateTime(p02Url, p02Item?.shot_at || p02Item?.created_at, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p02Url),
      });
    }

    // 3. P-03: Các mặt bên và mặt sau (Lấy toàn bộ các góc chụp thực tế)
    const p03List = identPhotos.filter((item: any) =>
      item.photo_type === 'P03_SIDE_OR_REAR' ||
      item.photo_type === 'P03_SIDE_REAR' ||
      item.photo_code?.includes('P03') ||
      item.photo_code?.includes('P-03')
    );
    const singleP03Url =
      json.photoP03?.url ||
      (typeof json.photoP03 === 'string' ? json.photoP03 : undefined) ||
      json.photos?.p03 ||
      json.step1Photos?.p03SideRearUrl ||
      findPhoto(['P03_SIDE_OR_REAR', 'P03_SIDE_REAR']);

    if (p03List.length > 0) {
      p03List.forEach((item: any, idx: number) => {
        const u = item.raw_photo_url || item.annotated_photo_url || '';
        if (!u) return;
        const tag = item.photo_code?.includes('PHI') ? 'Bên hông phải' :
                    item.photo_code?.includes('TRI') ? 'Bên hông trái' :
                    item.photo_code?.includes('SAU') ? 'Phía sau' : `Mặt bên #${idx + 1}`;
        const tagEn = item.photo_code?.includes('PHI') ? 'Side facade (right)' :
                      item.photo_code?.includes('TRI') ? 'Side facade (left)' :
                      item.photo_code?.includes('SAU') ? 'Rear facade' : `Side facade #${idx + 1}`;
        const origTag = item.photo_code || `P03_0${idx + 1}`;
        const mCode = origTag.startsWith('HCM_M2.') ? origTag : `HCM_M2.[${buildingId}]_${origTag}`;
        const itemDt = extractPhotoDateTime(u, item.shot_at || item.created_at, rawSurveyDate);
        appendix1.push({
          photoCode: 'P-03',
          name: { vi: `Mặt bên (${tag})`, en: tagEn },
          url: u,
          base64: ReportImageResolver.resolveToBase64(u),
          capturedAt: surveyDateFormatted,
          gpsCoords: `${defaultLat}, ${defaultLng}`,
          originalTag: origTag,
          metroPhotoCode: mCode,
          watermarkDateTime: itemDt,
          alreadyWatermarked: isPhotoAlreadyWatermarked(u),
        });
      });
    } else if (singleP03Url) {
      appendix1.push({
        photoCode: 'P-03',
        name: { vi: 'Mặt bên (hông trái)', en: 'Side facade (left)' },
        url: singleP03Url,
        base64: ReportImageResolver.resolveToBase64(singleP03Url),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: 'P03_SIDE',
        metroPhotoCode: `HCM_M2.[${buildingId}]_P03_SIDE`,
        watermarkDateTime: extractPhotoDateTime(singleP03Url, null, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(singleP03Url),
      });
    }

    // 4. P-04: Bối cảnh đường phố
    const p04Url =
      json.photoP04?.url ||
      (typeof json.photoP04 === 'string' ? json.photoP04 : undefined) ||
      json.photos?.p04 ||
      json.step1Photos?.p04ContextStreetUrl ||
      findPhoto(['P04_CONTEXT_STREET', 'P04', 'P-04']);
    if (p04Url) {
      appendix1.push({
        photoCode: 'P-04',
        name: { vi: 'Bối cảnh đường phố & tuyến Metro', en: 'Street context & Metro alignment' },
        url: p04Url,
        base64: ReportImageResolver.resolveToBase64(p04Url),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: 'P04_CONT',
        metroPhotoCode: `HCM_M2.[${buildingId}]_P04_CONT`,
        watermarkDateTime: extractPhotoDateTime(p04Url, null, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p04Url),
      });
    }

    // 5. P-05: Kiểm tra độ nghiêng công trình (từ deformation_assessments hoặc settlementTilt)
    if (p05Url) {
      const tiltTag = tiltPhotoObj?.photoCode || 'EXT_TILT_01';
      appendix1.push({
        photoCode: 'P-05',
        name: { vi: 'Kiểm tra độ nghiêng công trình', en: 'Building inclination check' },
        url: p05Url,
        base64: ReportImageResolver.resolveToBase64(p05Url),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: tiltTag,
        metroPhotoCode: tiltTag.startsWith('HCM_M2.') ? tiltTag : `HCM_M2.[${buildingId}]_${tiltTag}`,
        watermarkDateTime: extractPhotoDateTime(p05Url, tiltPhotoObj?.shot_at, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p05Url),
      });
    }

    // 6. P-06: Khảo sát lún móng & nền công trình
    if (p06Url) {
      const settleTag = settlePhotoObj?.photoCode || 'FOUND_SETTLE_01';
      appendix1.push({
        photoCode: 'P-06',
        name: { vi: 'Khảo sát lún móng & nền công trình', en: 'Foundation & settlement survey' },
        url: p06Url,
        base64: ReportImageResolver.resolveToBase64(p06Url),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: settleTag,
        metroPhotoCode: settleTag.startsWith('HCM_M2.') ? settleTag : `HCM_M2.[${buildingId}]_${settleTag}`,
        watermarkDateTime: extractPhotoDateTime(p06Url, settlePhotoObj?.shot_at, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p06Url),
      });
    }

    // 7. P-07: Dấu hiệu bất thường ngoại quan
    const anomalyPhotoObj = rawReport.deformation?.abnormal_photos_json?.[0] || deform.abnormalCase?.photos?.[0];
    const p07Url =
      anomalyPhotoObj?.url ||
      deform.abnormalCase?.photoUrl ||
      findPhoto(['EXT_ANOMALY', 'ANOMALY', 'P07', 'P-07']);
    if (p07Url) {
      const anomalyTag = anomalyPhotoObj?.photoCode || 'EXT_ANOMALY_01';
      appendix1.push({
        photoCode: 'P-07',
        name: { vi: 'Dấu hiệu bất thường ngoại quan', en: 'Exterior visual anomaly check' },
        url: p07Url,
        base64: ReportImageResolver.resolveToBase64(p07Url),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: anomalyTag,
        metroPhotoCode: anomalyTag.startsWith('HCM_M2.') ? anomalyTag : `HCM_M2.[${buildingId}]_${anomalyTag}`,
        watermarkDateTime: extractPhotoDateTime(p07Url, anomalyPhotoObj?.shot_at, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p07Url),
      });
    }

    // Phân loại: Xếp các ảnh chụp ngang (Landscape) hiển thị trước, các ảnh chụp dọc (Portrait) hiển thị sau
    // để trong cùng 1 hàng 2 cột A4, các ảnh luôn đồng đều chiều cao, triệt tiêu khoảng trống sole
    const landscapes = appendix1.filter((p) => !isPortraitImage(p.url || ''));
    const portraits = appendix1.filter((p) => isPortraitImage(p.url || ''));
    const sortedAppendix1 = [...landscapes, ...portraits];

    // Phân trang tự động cho Phụ lục 1: Tối đa 4 ảnh / trang A4 để chống vỡ khung in
    const PHOTOS_PER_PAGE = 4;
    const appendix1Pages: Appendix1PhotoPage[] = [];
    const totalApp1Pages = Math.ceil(sortedAppendix1.length / PHOTOS_PER_PAGE) || 1;
    for (let i = 0; i < sortedAppendix1.length; i += PHOTOS_PER_PAGE) {
      appendix1Pages.push({
        pageIndex: Math.floor(i / PHOTOS_PER_PAGE) + 1,
        totalPages: totalApp1Pages,
        photos: sortedAppendix1.slice(i, i + PHOTOS_PER_PAGE),
      });
    }

    return {
      appendix1,
      appendix1Pages,
      p02Url,
      p03List,
      singleP03Url,
      p05Url,
    };
  }
}
