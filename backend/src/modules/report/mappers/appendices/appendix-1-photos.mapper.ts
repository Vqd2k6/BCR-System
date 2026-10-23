/**
 * ============================================================================
 * APPENDIX 1 MAPPER: EXTERIOR IDENTIFICATION PHOTOS (P-01 TO P-07)
 * Phụ lục 1: Bản vẽ mặt đứng ngoài & Bộ ảnh định danh công trình
 * ============================================================================
 */

import { Appendix1PhotoItem, Appendix1PhotoPage } from '../../report.types';
import { ReportImageResolver } from '../../services/report-image-resolver.service';
import { isPhotoAlreadyWatermarked } from './appendix-2/floor-defect.mapper';
import { extractPhotoDateTime } from '../formatters.mapper';

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
        types.includes(item.photo_type) || types.some((t) => item.photo_code?.includes(t))
      );
      return p?.raw_photo_url || p?.annotated_photo_url || fallbackUrl || '';
    };

    const p01Item = identPhotos.find((p: any) => p.photo_type === 'P01_HOUSE_NUMBER' || p.photo_code?.includes('P01') || p.photo_code?.includes('P-01'));
    const p02Item = identPhotos.find((p: any) => p.photo_type === 'P02_MAIN_FACADE' || p.photo_code?.includes('P02') || p.photo_code?.includes('P-02') || p.photo_type === 'P02');
    const getPhotoEntryUrl = (entry: any): string | undefined => typeof entry === 'string' ? entry : entry?.url;

    const hasExplicitTiltPhotos = Array.isArray(json.settlementTilt?.buildingTilt?.photos);
    const tiltPhotoObj = hasExplicitTiltPhotos ? json.settlementTilt.buildingTilt.photos[0] : (deform.buildingTilt?.photos?.[0] || rawReport.deformation?.tilt_photos_json?.[0]);
    const p05Url = json.photoP05?.url || (typeof json.photoP05 === 'string' ? json.photoP05 : undefined) || json.photos?.p05 || json.step1Photos?.p05TiltCheckUrl || getPhotoEntryUrl(tiltPhotoObj) || (!hasExplicitTiltPhotos ? (deform.buildingTilt?.photoUrl || json.settlementTilt?.buildingTilt?.photoUrl || findPhoto(['P05_TILT_CHECK', 'P05', 'P-05', 'TILT', 'ELEV_TILT'])) : '');

    const hasExplicitSettlePhotos = Array.isArray(json.settlementTilt?.diffSettlement?.photos);
    const settlePhotoObj = hasExplicitSettlePhotos ? json.settlementTilt.diffSettlement.photos[0] : (deform.diffSettlement?.photos?.[0] || rawReport.deformation?.diff_settlement_photos_json?.[0]);
    const p06Url = json.photoP06?.url || (typeof json.photoP06 === 'string' ? json.photoP06 : undefined) || json.photos?.p06 || getPhotoEntryUrl(settlePhotoObj) || (!hasExplicitSettlePhotos ? (deform.diffSettlement?.photoUrl || json.settlementTilt?.diffSettlement?.photoUrl || findPhoto(['FOUND_SETTLE', 'SETTLE', 'P06', 'P-06'])) : '');

    const appendix1: Appendix1PhotoItem[] = [];
    const rotMap = json.photoRotations || rawReport.photoRotations || {};
    const gpsCoords = `${defaultLat}, ${defaultLng}`;

    const pushPhoto = (photoCode: string, vi: string, en: string, url: string, rot: number, origTag: string, shotAt?: any) => {
      appendix1.push({
        photoCode,
        name: { vi, en },
        url,
        rotation: rot,
        base64: ReportImageResolver.resolveToBase64(url, rot),
        capturedAt: surveyDateFormatted,
        gpsCoords,
        originalTag: origTag,
        metroPhotoCode: origTag.startsWith('HCM_M2.') ? origTag : `HCM_M2.[${buildingId}]_${origTag}`,
        watermarkDateTime: extractPhotoDateTime(url, shotAt, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(url),
      });
    };

    // 1. P-01: Biển số nhà
    const isP01NA = Boolean(json.photoP01?.notApplicable || json.photoP01?.isNotApplicable);
    const p01Url = isP01NA ? '' : (json.photoP01?.url || (typeof json.photoP01 === 'string' ? json.photoP01 : undefined) || json.photos?.p01 || json.step1Photos?.p01HouseNumberUrl || findPhoto(['P01_HOUSE_NUMBER', 'P01', 'P-01']));
    if (p01Url) {
      pushPhoto('P-01', 'Biển số nhà / tên công trình', 'House number / signboard', p01Url, rotMap['P-01'] ?? rotMap['photoP01'] ?? rotMap[p01Url] ?? 0, 'P01_HOUS', p01Item?.shot_at || p01Item?.created_at);
    }

    // 2. P-02: Mặt đứng chính toàn cảnh
    const isP02NA = Boolean(json.photoP02?.notApplicable || json.photoP02?.isNotApplicable);
    const p02Url = isP02NA ? '' : (json.photoP02?.url || (typeof json.photoP02 === 'string' ? json.photoP02 : undefined) || json.photos?.p02 || json.step1Photos?.p02MainFacadeUrl || findPhoto(['P02_MAIN_FACADE', 'P02', 'P-02']));
    if (p02Url) {
      pushPhoto('P-02', 'Mặt đứng chính toàn cảnh', 'Overall view of the main facade', p02Url, rotMap['P-02'] ?? rotMap['photoP02'] ?? rotMap[p02Url] ?? 0, 'P02_MAIN', p02Item?.shot_at || p02Item?.created_at);
    }

    // 3. P-03: Các mặt bên và mặt sau
    const isP03NA = Boolean(json.photoP03?.notApplicable || json.photoP03?.isNotApplicable);
    const p03List = identPhotos.filter((item: any) => item.photo_type === 'P03_SIDE_OR_REAR' || item.photo_type === 'P03_SIDE_REAR' || item.photo_code?.includes('P03') || item.photo_code?.includes('P-03'));
    const explicitP03Url = json.photoP03?.url || (typeof json.photoP03 === 'string' ? json.photoP03 : undefined) || json.photos?.p03 || json.step1Photos?.p03SideRearUrl;
    const singleP03Url = isP03NA ? '' : (explicitP03Url || findPhoto(['P03_SIDE_OR_REAR', 'P03_SIDE_REAR']));

    const jsonP03Items: Array<{ url: string; tag?: string }> = [];
    if (!isP03NA && explicitP03Url) {
      jsonP03Items.push({ url: explicitP03Url, tag: json.photoP03?.tag || 'P03_SIDE' });
      if (Array.isArray(json.photoP03?.additionalPhotos)) {
        json.photoP03.additionalPhotos.forEach((addItem: any, idx: number) => {
          const addUrl = typeof addItem === 'string' ? addItem : addItem?.url;
          if (addUrl) jsonP03Items.push({ url: addUrl, tag: addItem?.tag || `P03_0${idx + 2}` });
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
        const rotP03 = idx > 0
          ? (rotMap[`photoP03_extra_${idx - 1}`] ?? rotMap[`P-03-EXTRA-${idx}`] ?? rotMap[origTag] ?? rotMap[u] ?? rotMap['P-03'] ?? rotMap['photoP03'] ?? 0)
          : (rotMap[origTag] ?? rotMap['P-03'] ?? rotMap['photoP03'] ?? rotMap[u] ?? 0);
        pushPhoto('P-03', `Mặt bên (${tag})`, tagEn, u, rotP03, origTag, null);
      });
    } else if (!isP03NA && p03List.length > 0 && json.photoP03 === undefined) {
      p03List.forEach((item: any, idx: number) => {
        const u = item.raw_photo_url || item.annotated_photo_url || '';
        if (!u) return;
        const tag = item.photo_code?.includes('PHI') ? 'Bên hông phải' : item.photo_code?.includes('TRI') ? 'Bên hông trái' : item.photo_code?.includes('SAU') ? 'Phía sau' : `Mặt bên #${idx + 1}`;
        const tagEn = item.photo_code?.includes('PHI') ? 'Side facade (right)' : item.photo_code?.includes('TRI') ? 'Side facade (left)' : item.photo_code?.includes('SAU') ? 'Rear facade' : `Side facade #${idx + 1}`;
        const origTag = item.photo_code || `P03_0${idx + 1}`;
        const rotP03 = item?.rotation ?? rotMap[item?.photo_code] ?? rotMap['P-03'] ?? rotMap[u] ?? 0;
        pushPhoto('P-03', `Mặt bên (${tag})`, tagEn, u, rotP03, origTag, item.shot_at || item.created_at);
      });
    } else if (singleP03Url) {
      pushPhoto('P-03', 'Mặt bên (hông trái)', 'Side facade (left)', singleP03Url, rotMap['P-03'] ?? rotMap['photoP03'] ?? rotMap[singleP03Url] ?? 0, 'P03_SIDE', null);
    }

    // 4. P-04: Bối cảnh đường phố
    const isP04NA = Boolean(json.photoP04?.notApplicable || json.photoP04?.isNotApplicable);
    const p04Url = isP04NA ? '' : (json.photoP04?.url || (typeof json.photoP04 === 'string' ? json.photoP04 : undefined) || json.photos?.p04 || json.step1Photos?.p04ContextStreetUrl || findPhoto(['P04_CONTEXT_STREET', 'P04', 'P-04']));
    if (p04Url) {
      pushPhoto('P-04', 'Bối cảnh đường phố & tuyến Metro', 'Street context & Metro alignment', p04Url, rotMap['P-04'] ?? rotMap['photoP04'] ?? rotMap[p04Url] ?? 0, 'P04_CONT', null);
    }

    // 5. P-05: Kiểm tra độ nghiêng công trình
    if (p05Url) {
      const tiltTag = (typeof tiltPhotoObj === 'object' ? tiltPhotoObj?.photoCode : undefined) || 'EXT_TILT_01';
      pushPhoto('P-05', 'Kiểm tra độ nghiêng công trình', 'Building inclination check', p05Url, rotMap['P-05'] ?? rotMap['photoP05'] ?? rotMap['buildingTilt'] ?? rotMap['buildingTilt_0'] ?? rotMap[p05Url] ?? 0, tiltTag, typeof tiltPhotoObj === 'object' ? tiltPhotoObj?.shot_at : null);
    }

    // 6. P-06: Khảo sát lún móng & nền công trình
    if (p06Url) {
      const settleTag = (typeof settlePhotoObj === 'object' ? settlePhotoObj?.photoCode : undefined) || 'FOUND_SETTLE_01';
      pushPhoto('P-06', 'Khảo sát lún móng & nền công trình', 'Foundation & settlement survey', p06Url, rotMap['P-06'] ?? rotMap['photoP06'] ?? rotMap['diffSettlement'] ?? rotMap['diffSettlement_0'] ?? rotMap[p06Url] ?? 0, settleTag, typeof settlePhotoObj === 'object' ? settlePhotoObj?.shot_at : null);
    }

    // 7. P-07: Dấu hiệu bất thường ngoại quan
    const hasExplicitAbnPhotos = Array.isArray(json.settlementTilt?.abnormalCase?.photos);
    const anomalyPhotoObj = hasExplicitAbnPhotos ? json.settlementTilt.abnormalCase.photos[0] : (deform.abnormalCase?.photos?.[0] || rawReport.deformation?.abnormal_photos_json?.[0]);
    const p07Url = getPhotoEntryUrl(anomalyPhotoObj) || (!hasExplicitAbnPhotos ? (deform.abnormalCase?.photoUrl || findPhoto(['EXT_ANOMALY', 'ANOMALY', 'P07', 'P-07'])) : '');
    if (p07Url) {
      const anomalyTag = (typeof anomalyPhotoObj === 'object' ? anomalyPhotoObj?.photoCode : undefined) || 'EXT_ANOMALY_01';
      pushPhoto('P-07', 'Dấu hiệu bất thường ngoại quan', 'Exterior visual anomaly check', p07Url, rotMap['P-07'] ?? rotMap['photoP07'] ?? rotMap['abnormalCase'] ?? rotMap['abnormalCase_0'] ?? rotMap[p07Url] ?? 0, anomalyTag, typeof anomalyPhotoObj === 'object' ? anomalyPhotoObj?.shot_at : null);
    }

    const sortedAppendix1 = [...appendix1].sort((a, b) => (a.photoCode || '').localeCompare(b.photoCode || '', undefined, { numeric: true, sensitivity: 'base' }));
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

    return { appendix1, appendix1Pages, p02Url, p03List, singleP03Url, p05Url };
  }
}

