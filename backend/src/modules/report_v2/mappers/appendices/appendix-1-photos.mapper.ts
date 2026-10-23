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

    const getPhotoEntryUrl = (entry: any): string | undefined =>
      typeof entry === 'string' ? entry : entry?.url;

    const hasExplicitTiltPhotos = Array.isArray(json.settlementTilt?.buildingTilt?.photos);
    const tiltPhotoObj = hasExplicitTiltPhotos
      ? json.settlementTilt.buildingTilt.photos[0]
      : (deform.buildingTilt?.photos?.[0] || rawReport.deformation?.tilt_photos_json?.[0]);
    const p05Url =
      json.photoP05?.url ||
      (typeof json.photoP05 === 'string' ? json.photoP05 : undefined) ||
      json.photos?.p05 ||
      json.step1Photos?.p05TiltCheckUrl ||
      getPhotoEntryUrl(tiltPhotoObj) ||
      (!hasExplicitTiltPhotos ? (deform.buildingTilt?.photoUrl || json.settlementTilt?.buildingTilt?.photoUrl || findPhoto(['P05_TILT_CHECK', 'P05', 'P-05', 'TILT', 'ELEV_TILT'])) : '');

    const hasExplicitSettlePhotos = Array.isArray(json.settlementTilt?.diffSettlement?.photos);
    const settlePhotoObj = hasExplicitSettlePhotos
      ? json.settlementTilt.diffSettlement.photos[0]
      : (deform.diffSettlement?.photos?.[0] || rawReport.deformation?.diff_settlement_photos_json?.[0]);
    const p06Url =
      json.photoP06?.url ||
      (typeof json.photoP06 === 'string' ? json.photoP06 : undefined) ||
      json.photos?.p06 ||
      getPhotoEntryUrl(settlePhotoObj) ||
      (!hasExplicitSettlePhotos ? (deform.diffSettlement?.photoUrl || json.settlementTilt?.diffSettlement?.photoUrl || findPhoto(['FOUND_SETTLE', 'SETTLE', 'P06', 'P-06'])) : '');

    const appendix1: Appendix1PhotoItem[] = [];
    const rotMap = json.photoRotations || rawReport.photoRotations || {};

    // 1. P-01: Biển số nhà
    const isP01NA = Boolean(json.photoP01?.notApplicable || json.photoP01?.isNotApplicable);
    const p01Url = isP01NA
      ? ''
      : (json.photoP01?.url ||
         (typeof json.photoP01 === 'string' ? json.photoP01 : undefined) ||
         json.photos?.p01 ||
         json.step1Photos?.p01HouseNumberUrl ||
         findPhoto(['P01_HOUSE_NUMBER', 'P01', 'P-01']));
    if (p01Url) {
      const rotP01 = rotMap['P-01'] ?? rotMap['photoP01'] ?? rotMap[p01Url] ?? 0;
      appendix1.push({
        photoCode: 'P-01',
        name: { vi: 'Biển số nhà / tên công trình', en: 'House number / signboard' },
        url: p01Url,
        rotation: rotP01,
        base64: ReportImageResolver.resolveToBase64(p01Url, rotP01),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: 'P01_HOUS',
        metroPhotoCode: `HCM_M2.[${buildingId}]_P01_HOUS`,
        watermarkDateTime: extractPhotoDateTime(p01Url, p01Item?.shot_at || p01Item?.created_at, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p01Url),
      });
    }

    // 2. P-02: Mặt đứng chính toàn cảnh
    const isP02NA = Boolean(json.photoP02?.notApplicable || json.photoP02?.isNotApplicable);
    const p02Url = isP02NA
      ? ''
      : (json.photoP02?.url ||
         (typeof json.photoP02 === 'string' ? json.photoP02 : undefined) ||
         json.photos?.p02 ||
         json.step1Photos?.p02MainFacadeUrl ||
         findPhoto(['P02_MAIN_FACADE', 'P02', 'P-02']));
    if (p02Url) {
      const rotP02 = rotMap['P-02'] ?? rotMap['photoP02'] ?? rotMap[p02Url] ?? 0;
      appendix1.push({
        photoCode: 'P-02',
        name: { vi: 'Mặt đứng chính toàn cảnh', en: 'Overall view of the main facade' },
        url: p02Url,
        rotation: rotP02,
        base64: ReportImageResolver.resolveToBase64(p02Url, rotP02),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: 'P02_MAIN',
        metroPhotoCode: `HCM_M2.[${buildingId}]_P02_MAIN`,
        watermarkDateTime: extractPhotoDateTime(p02Url, p02Item?.shot_at || p02Item?.created_at, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p02Url),
      });
    }

    // 3. P-03: Các mặt bên và mặt sau (Ưu tiên đọc từ json.photoP03 đã thẩm định, fallback sang identPhotos)
    const isP03NA = Boolean(json.photoP03?.notApplicable || json.photoP03?.isNotApplicable);
    const p03List = identPhotos.filter((item: any) =>
      item.photo_type === 'P03_SIDE_OR_REAR' ||
      item.photo_type === 'P03_SIDE_REAR' ||
      item.photo_code?.includes('P03') ||
      item.photo_code?.includes('P-03')
    );
    const explicitP03Url =
      json.photoP03?.url ||
      (typeof json.photoP03 === 'string' ? json.photoP03 : undefined) ||
      json.photos?.p03 ||
      json.step1Photos?.p03SideRearUrl;
    const singleP03Url = isP03NA
      ? ''
      : (explicitP03Url || findPhoto(['P03_SIDE_OR_REAR', 'P03_SIDE_REAR']));

    const jsonP03Items: Array<{ url: string; tag?: string }> = [];
    if (!isP03NA && explicitP03Url) {
      jsonP03Items.push({ url: explicitP03Url, tag: json.photoP03?.tag || 'P03_SIDE' });
      if (Array.isArray(json.photoP03?.additionalPhotos)) {
        json.photoP03.additionalPhotos.forEach((addItem: any, idx: number) => {
          const addUrl = typeof addItem === 'string' ? addItem : addItem?.url;
          if (addUrl) {
            jsonP03Items.push({ url: addUrl, tag: addItem?.tag || `P03_0${idx + 2}` });
          }
        });
      }
    }

    if (!isP03NA && jsonP03Items.length > 0) {
      jsonP03Items.forEach((item, idx) => {
        const u = item.url;
        const rawTag = String(item.tag || '');
        const tag = rawTag.includes('PHI') || rawTag.toLowerCase().includes('phải') ? 'Bên hông phải' :
                    rawTag.includes('TRI') || rawTag.toLowerCase().includes('trái') ? 'Bên hông trái' :
                    rawTag.includes('SAU') || rawTag.toLowerCase().includes('sau') ? 'Phía sau' :
                    (rawTag && !rawTag.startsWith('P03') ? rawTag : `Mặt bên #${idx + 1}`);
        const tagEn = rawTag.includes('PHI') || rawTag.toLowerCase().includes('phải') ? 'Side facade (right)' :
                      rawTag.includes('TRI') || rawTag.toLowerCase().includes('trái') ? 'Side facade (left)' :
                      rawTag.includes('SAU') || rawTag.toLowerCase().includes('sau') ? 'Rear facade' : `Side facade #${idx + 1}`;
        const origTag = rawTag || `P03_0${idx + 1}`;
        const mCode = origTag.startsWith('HCM_M2.') ? origTag : `HCM_M2.[${buildingId}]_${origTag}`;
        const rotP03 = rotMap[origTag] ?? rotMap['P-03'] ?? rotMap['photoP03'] ?? rotMap[u] ?? 0;
        appendix1.push({
          photoCode: 'P-03',
          name: { vi: `Mặt bên (${tag})`, en: tagEn },
          url: u,
          rotation: rotP03,
          base64: ReportImageResolver.resolveToBase64(u, rotP03),
          capturedAt: surveyDateFormatted,
          gpsCoords: `${defaultLat}, ${defaultLng}`,
          originalTag: origTag,
          metroPhotoCode: mCode,
          watermarkDateTime: extractPhotoDateTime(u, null, rawSurveyDate),
          alreadyWatermarked: isPhotoAlreadyWatermarked(u),
        });
      });
    } else if (!isP03NA && p03List.length > 0 && json.photoP03 === undefined) {
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
        const rotP03 = item?.rotation ?? rotMap[item?.photo_code] ?? rotMap['P-03'] ?? rotMap[u] ?? 0;
        appendix1.push({
          photoCode: 'P-03',
          name: { vi: `Mặt bên (${tag})`, en: tagEn },
          url: u,
          rotation: rotP03,
          base64: ReportImageResolver.resolveToBase64(u, rotP03),
          capturedAt: surveyDateFormatted,
          gpsCoords: `${defaultLat}, ${defaultLng}`,
          originalTag: origTag,
          metroPhotoCode: mCode,
          watermarkDateTime: itemDt,
          alreadyWatermarked: isPhotoAlreadyWatermarked(u),
        });
      });
    } else if (singleP03Url) {
      const rotP03 = rotMap['P-03'] ?? rotMap['photoP03'] ?? rotMap[singleP03Url] ?? 0;
      appendix1.push({
        photoCode: 'P-03',
        name: { vi: 'Mặt bên (hông trái)', en: 'Side facade (left)' },
        url: singleP03Url,
        rotation: rotP03,
        base64: ReportImageResolver.resolveToBase64(singleP03Url, rotP03),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: 'P03_SIDE',
        metroPhotoCode: `HCM_M2.[${buildingId}]_P03_SIDE`,
        watermarkDateTime: extractPhotoDateTime(singleP03Url, null, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(singleP03Url),
      });
    }

    // 4. P-04: Bối cảnh đường phố
    const isP04NA = Boolean(json.photoP04?.notApplicable || json.photoP04?.isNotApplicable);
    const p04Url = isP04NA
      ? ''
      : (json.photoP04?.url ||
         (typeof json.photoP04 === 'string' ? json.photoP04 : undefined) ||
         json.photos?.p04 ||
         json.step1Photos?.p04ContextStreetUrl ||
         findPhoto(['P04_CONTEXT_STREET', 'P04', 'P-04']));
    if (p04Url) {
      const rotP04 = rotMap['P-04'] ?? rotMap['photoP04'] ?? rotMap[p04Url] ?? 0;
      appendix1.push({
        photoCode: 'P-04',
        name: { vi: 'Bối cảnh đường phố & tuyến Metro', en: 'Street context & Metro alignment' },
        url: p04Url,
        rotation: rotP04,
        base64: ReportImageResolver.resolveToBase64(p04Url, rotP04),
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
      const tiltTag = (typeof tiltPhotoObj === 'object' ? tiltPhotoObj?.photoCode : undefined) || 'EXT_TILT_01';
      const rotP05 = rotMap['P-05'] ?? rotMap['photoP05'] ?? rotMap['buildingTilt'] ?? rotMap['buildingTilt_0'] ?? rotMap[p05Url] ?? 0;
      appendix1.push({
        photoCode: 'P-05',
        name: { vi: 'Kiểm tra độ nghiêng công trình', en: 'Building inclination check' },
        url: p05Url,
        rotation: rotP05,
        base64: ReportImageResolver.resolveToBase64(p05Url, rotP05),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: tiltTag,
        metroPhotoCode: tiltTag.startsWith('HCM_M2.') ? tiltTag : `HCM_M2.[${buildingId}]_${tiltTag}`,
        watermarkDateTime: extractPhotoDateTime(p05Url, typeof tiltPhotoObj === 'object' ? tiltPhotoObj?.shot_at : null, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p05Url),
      });
    }

    // 6. P-06: Khảo sát lún móng & nền công trình
    if (p06Url) {
      const settleTag = (typeof settlePhotoObj === 'object' ? settlePhotoObj?.photoCode : undefined) || 'FOUND_SETTLE_01';
      const rotP06 = rotMap['P-06'] ?? rotMap['photoP06'] ?? rotMap['diffSettlement'] ?? rotMap['diffSettlement_0'] ?? rotMap[p06Url] ?? 0;
      appendix1.push({
        photoCode: 'P-06',
        name: { vi: 'Khảo sát lún móng & nền công trình', en: 'Foundation & settlement survey' },
        url: p06Url,
        rotation: rotP06,
        base64: ReportImageResolver.resolveToBase64(p06Url, rotP06),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: settleTag,
        metroPhotoCode: settleTag.startsWith('HCM_M2.') ? settleTag : `HCM_M2.[${buildingId}]_${settleTag}`,
        watermarkDateTime: extractPhotoDateTime(p06Url, typeof settlePhotoObj === 'object' ? settlePhotoObj?.shot_at : null, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p06Url),
      });
    }

    // 7. P-07: Dấu hiệu bất thường ngoại quan
    const hasExplicitAbnPhotos = Array.isArray(json.settlementTilt?.abnormalCase?.photos);
    const anomalyPhotoObj = hasExplicitAbnPhotos
      ? json.settlementTilt.abnormalCase.photos[0]
      : (deform.abnormalCase?.photos?.[0] || rawReport.deformation?.abnormal_photos_json?.[0]);
    const p07Url =
      getPhotoEntryUrl(anomalyPhotoObj) ||
      (!hasExplicitAbnPhotos ? (deform.abnormalCase?.photoUrl || findPhoto(['EXT_ANOMALY', 'ANOMALY', 'P07', 'P-07'])) : '');
    if (p07Url) {
      const anomalyTag = (typeof anomalyPhotoObj === 'object' ? anomalyPhotoObj?.photoCode : undefined) || 'EXT_ANOMALY_01';
      const rotP07 = rotMap['P-07'] ?? rotMap['photoP07'] ?? rotMap[p07Url] ?? 0;
      appendix1.push({
        photoCode: 'P-07',
        name: { vi: 'Dấu hiệu bất thường ngoại quan', en: 'Exterior visual anomaly check' },
        url: p07Url,
        rotation: rotP07,
        base64: ReportImageResolver.resolveToBase64(p07Url, rotP07),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: anomalyTag,
        metroPhotoCode: anomalyTag.startsWith('HCM_M2.') ? anomalyTag : `HCM_M2.[${buildingId}]_${anomalyTag}`,
        watermarkDateTime: extractPhotoDateTime(p07Url, typeof anomalyPhotoObj === 'object' ? anomalyPhotoObj?.shot_at : null, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p07Url),
      });
    }

    // Sắp xếp bộ ảnh định danh theo đúng thứ tự chuẩn pháp lý (P-01 đến P-07)
    const sortedAppendix1 = [...appendix1].sort((a, b) => {
      const codeA = a.photoCode || '';
      const codeB = b.photoCode || '';
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });

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
