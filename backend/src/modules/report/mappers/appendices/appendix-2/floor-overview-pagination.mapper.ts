/**
 * ============================================================================
 * FLOOR OVERVIEW & DEFECT PAGINATION MAPPER (APPENDIX 2 SUB-MODULE)
 * Sắp xếp, lọc trùng và phân trang ảnh tổng thể phòng (Z), cấu kiện (E),
 * bảng danh mục khuyết tật (12 dòng/trang) và cặp ảnh đối chiếu khuyết tật.
 * ============================================================================
 */

import {
  RoomOverviewPhotoItem,
  FloorOverviewPageViewModel,
  FloorDefectSummaryRow,
  DefectPairPhotoItem,
} from '../../../report.types';
import { ReportImageResolver } from '../../../services/report-image-resolver.service';
import { isPortraitImage } from '../../../utils/image-sniff.utils';
import { extractPhotoDateTime } from '../../formatters.mapper';
import { isPhotoAlreadyWatermarked } from './cad-pin.mapper';
import {
  extractPhotoCodeSuffix,
  isSamePhotoCodeContent,
  normalizeMetroPhotoCode,
  parseCodeFromPhotoUrl,
  replaceFloorSegment,
} from '../../../utils/metro-photo-code.utils';

export type AddUniqueOverviewPhotoFn = (
  rawUrl: string | undefined | null,
  zoneCode: string,
  roomVi: string,
  roomEn: string,
  isNormal: boolean,
  captionVi?: string,
  captionEn?: string,
  photoCode?: string,
  isStructural?: boolean,
  statusBadgeText?: { vi: string; en: string },
  capturedAt?: string | null,
  explicitRot?: number
) => void;

/** Ngữ cảnh sinh mã ảnh HCM_M2.1_[Mã thửa]_[mã căn_]<hậu tố> cho một tầng. */
export interface PhotoCodeContext {
  parcelCode: string;
  unitCode?: string | null;
  /** Mã tầng đúng theo số Lầu (F00, F01, MEZZ...) — thay đoạn tầng sai trong mã/tên file */
  floorCode?: string;
}

/**
 * Mã ảnh tổng quan: hậu tố ưu tiên mã đã lưu → mã trong tên file R2 → `${zoneCode}_${photoId}`;
 * đoạn tầng được thay bằng mã tầng đúng. Nếu mã trong tên file (chữ đã dập trên ảnh cũ) khác
 * NỘI DUNG mã đúng thì trả kèm mã gốc để ghi chú (bỏ qua khác biệt tiền tố HCM_M2. / HCM_M2.1_).
 */
export function resolveOverviewPhotoCode(
  url: string,
  storedCode: string | undefined,
  zoneCode: string,
  photoId: string,
  ctx: PhotoCodeContext
): { metroPhotoCode: string; originalFileCode?: string } {
  const fileCode = parseCodeFromPhotoUrl(url);
  const baseSuffix = storedCode
    ? extractPhotoCodeSuffix(storedCode)
    : fileCode?.suffix || `${zoneCode}_${photoId}`;
  const correctedSuffix = ctx.floorCode ? replaceFloorSegment(baseSuffix, ctx.floorCode) : baseSuffix;
  const metroPhotoCode = normalizeMetroPhotoCode(correctedSuffix, ctx.parcelCode, ctx.unitCode);
  const originalFileCode =
    fileCode && !isSamePhotoCodeContent(fileCode.suffix, correctedSuffix)
      ? `HCM_M2.[${fileCode.parcel}]_${fileCode.suffix}`
      : undefined;
  return { metroPhotoCode, originalFileCode };
}

export function createOverviewPhotoCollector(
  photoCounter: { current: number },
  buildingId: string,
  rawSurveyDate: any,
  rotMap: Record<string, number>,
  roomOverviewPhotos: RoomOverviewPhotoItem[],
  elementOverviewPhotos: RoomOverviewPhotoItem[],
  codeContext?: PhotoCodeContext
): AddUniqueOverviewPhotoFn {
  const ctx: PhotoCodeContext = codeContext || { parcelCode: buildingId || 'CHƯA_ĐỊNH_DANH' };
  const seenPhotoUrls = new Set<string>();

  return (
    rawUrl: string | undefined | null,
    zoneCode: string,
    roomVi: string,
    roomEn: string,
    isNormal: boolean,
    captionVi?: string,
    captionEn?: string,
    photoCode?: string,
    isStructural: boolean = false,
    statusBadgeText?: { vi: string; en: string },
    capturedAt?: string | null,
    explicitRot?: number
  ) => {
    if (!rawUrl || typeof rawUrl !== 'string') return;
    const cleanUrl = rawUrl.trim();
    if (!cleanUrl || cleanUrl.startsWith('blob:') || seenPhotoUrls.has(cleanUrl)) return;
    seenPhotoUrls.add(cleanUrl);

    const photoRot = explicitRot ?? (photoCode ? rotMap[photoCode] : undefined) ?? rotMap[cleanUrl] ?? 0;
    const base64 = ReportImageResolver.resolveToBase64(cleanUrl, photoRot);
    photoCounter.current++;
    const photoId = photoCode || `P-${photoCounter.current.toString().padStart(2, '0')}`;
    const itemDt = extractPhotoDateTime(cleanUrl, capturedAt || null, rawSurveyDate);
    const { metroPhotoCode: mCode, originalFileCode } = resolveOverviewPhotoCode(cleanUrl, photoCode, zoneCode, photoId, ctx);

    const defaultBadgeVi = isNormal
      ? (isStructural ? 'Tổng thể cấu kiện' : 'Toàn cảnh không gian')
      : 'Ghi nhận khuyết tật';
    const defaultBadgeEn = isNormal
      ? (isStructural ? 'Member overview' : 'Space overview')
      : 'Defect observed';

    const photoItem: RoomOverviewPhotoItem = {
      photoId,
      zoneCode,
      roomName: { vi: roomVi, en: roomEn },
      url: cleanUrl,
      base64: base64 && !base64.startsWith('blob:') ? base64 : undefined,
      rotation: Number(photoRot) || 0,
      caption: {
        vi: captionVi || (isStructural ? `Hiện trạng cấu kiện ${roomVi} (${zoneCode})` : `Hiện trạng không gian ${roomVi} (${zoneCode})`),
        en: captionEn || (isStructural ? `Condition of member ${roomEn} (${zoneCode})` : `Condition of ${roomEn} (${zoneCode})`),
      },
      statusBadge: {
        isNormal,
        text: statusBadgeText || { vi: defaultBadgeVi, en: defaultBadgeEn },
      },
      alreadyWatermarked: isPhotoAlreadyWatermarked(cleanUrl),
      watermarkDateTime: itemDt,
      metroPhotoCode: mCode,
      originalFileCode,
      originalFileSuffix: originalFileCode ? extractPhotoCodeSuffix(originalFileCode) : undefined,
      isStructuralElement: isStructural,
    };

    if (isStructural) {
      elementOverviewPhotos.push(photoItem);
    } else {
      roomOverviewPhotos.push(photoItem);
    }
  };
}

export function buildBalancedOverviewPages(items: RoomOverviewPhotoItem[]): FloorOverviewPageViewModel[] {
  const PHOTOS_PER_OVERVIEW_PAGE = 4;
  const archivalOnly = items.filter((it) => it.statusBadge?.isNormal !== false);
  const landscapes = archivalOnly.filter((it) => !isPortraitImage(it.base64 || it.url || ''));
  const portraits = archivalOnly.filter((it) => isPortraitImage(it.base64 || it.url || ''));
  const sortedItems = [...landscapes, ...portraits];

  const pageCount = Math.ceil(sortedItems.length / PHOTOS_PER_OVERVIEW_PAGE);
  if (pageCount === 0) return [];
  const perPage = Math.ceil(sortedItems.length / pageCount);
  const pages: FloorOverviewPageViewModel[] = [];
  for (let p = 0; p < pageCount; p++) {
    pages.push({
      pageIndexInFloor: p + 1,
      totalOverviewPagesInFloor: pageCount,
      photos: sortedItems.slice(p * perPage, (p + 1) * perPage),
    });
  }
  return pages;
}

export function paginateDefectSummaryRows(
  defectSummaryRows: FloorDefectSummaryRow[]
): Array<{ pageIndex: number; totalPages: number; rows: FloorDefectSummaryRow[] }> {
  if (defectSummaryRows.length === 0) return [];
  const ROWS_PER_PAGE = 12;
  const totalTablePages = Math.ceil(defectSummaryRows.length / ROWS_PER_PAGE);
  const pages: Array<{ pageIndex: number; totalPages: number; rows: FloorDefectSummaryRow[] }> = [];
  for (let i = 0; i < defectSummaryRows.length; i += ROWS_PER_PAGE) {
    pages.push({
      pageIndex: Math.floor(i / ROWS_PER_PAGE) + 1,
      totalPages: totalTablePages,
      rows: defectSummaryRows.slice(i, i + ROWS_PER_PAGE),
    });
  }
  return pages;
}

export function paginateDefectPairPhotos(
  defectPairPhotos: DefectPairPhotoItem[]
): Array<{ pageIndex: number; totalPages: number; pairs: DefectPairPhotoItem[] }> {
  const defectPairPages: Array<{ pageIndex: number; totalPages: number; pairs: DefectPairPhotoItem[] }> = [];
  let currentPagePairs: DefectPairPhotoItem[] = [];
  let currentWeight = 0;

  for (const item of defectPairPhotos) {
    const itemWeight = item.hasExtraCloseUp ? 2 : 1;
    if (currentWeight + itemWeight > 2 && currentPagePairs.length > 0) {
      defectPairPages.push({
        pageIndex: 0,
        totalPages: 0,
        pairs: currentPagePairs,
      });
      currentPagePairs = [];
      currentWeight = 0;
    }
    currentPagePairs.push(item);
    currentWeight += itemWeight;
    if (currentWeight >= 2) {
      defectPairPages.push({
        pageIndex: 0,
        totalPages: 0,
        pairs: currentPagePairs,
      });
      currentPagePairs = [];
      currentWeight = 0;
    }
  }
  if (currentPagePairs.length > 0) {
    defectPairPages.push({
      pageIndex: 0,
      totalPages: 0,
      pairs: currentPagePairs,
    });
  }

  const totalDefectPages = defectPairPages.length || 1;
  defectPairPages.forEach((page, idx) => {
    page.pageIndex = idx + 1;
    page.totalPages = totalDefectPages;
  });
  return defectPairPages;
}

