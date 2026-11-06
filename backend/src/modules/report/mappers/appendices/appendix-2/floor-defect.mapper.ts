/**
 * ============================================================================
 * FLOOR DEFECT MAPPER (ORCHESTRATOR — APPENDIX 2)
 * Điều phối tạo báo cáo từng tầng từ 3 sub-mappers:
 *   - cad-pin.mapper.ts (Ghim Z, E trên sơ đồ CAD & kiểm tra watermark)
 *   - defect-pair.mapper.ts (Gom khuyết tật & ghép cặp ảnh đối chiếu)
 *   - floor-overview-pagination.mapper.ts (Phân trang ảnh tổng thể & bảng khuyết tật)
 * ============================================================================
 */

import {
  FloorPlanDefectReport,
  RoomOverviewPhotoItem,
} from '../../../report.types';
import { toBilingualNoZonesReason } from '../../../../survey/zone-exemption.utils';
import { ReportImageResolver } from '../../../services/report-image-resolver.service';
import { isPhotoAlreadyWatermarked, extractFloorCadPins } from './cad-pin.mapper';
import { mapFloorZonesAndElements } from './defect-pair.mapper';
import { extractPhotoDateTime } from '../../formatters.mapper';
import {
  createOverviewPhotoCollector,
  buildBalancedOverviewPages,
  paginateDefectSummaryRows,
  paginateDefectPairPhotos,
} from './floor-overview-pagination.mapper';
import {
  extractPhotoCodeSuffix,
  normalizeMetroPhotoCode,
  parseCodeFromPhotoUrl,
  replaceFloorSegment,
  resolveFloorCode,
} from '../../../utils/metro-photo-code.utils';

export { isPhotoAlreadyWatermarked };

export class FloorDefectMapper {
  public static mapFloors(
    rawFloors: any[],
    photoCounter: { current: number } = { current: 5 },
    buildingId: string = '',
    rawSurveyDate: any = null,
    photoRotations: Record<string, number> = {},
    codeContext?: { parcelCode: string; unitCode?: string | null }
  ): FloorPlanDefectReport[] {
    const results: FloorPlanDefectReport[] = [];
    const rotMap = photoRotations || {};
    const parcelForCode = codeContext?.parcelCode || buildingId || 'CHƯA_ĐỊNH_DANH';
    const unitForCode = codeContext?.unitCode || undefined;

    let floorIndex = 0;
    for (const fl of rawFloors || []) {
      floorIndex++;
      const fIdx = floorIndex - 1;
      // Mã tầng theo SỐ LẦU (Tầng N = Lầu N), không theo vị trí trong mảng floors.
      const floorCode = resolveFloorCode(fl);
      const flNameVi = fl.floorName || `Tầng ${floorIndex}`;
      const flNameEn = fl.floorNameEn || (
        flNameVi.toLowerCase().includes('trệt') ? 'G Floor (Ground Floor)' :
        flNameVi.toLowerCase().includes('lửng') ? 'Mezzanine Floor' :
        flNameVi.toLowerCase().includes('lầu 1') || flNameVi.toLowerCase().includes('tầng 1') ? '1st Floor' :
        flNameVi.toLowerCase().includes('lầu 2') || flNameVi.toLowerCase().includes('tầng 2') ? '2nd Floor' :
        flNameVi.toLowerCase().includes('sân thượng') || flNameVi.toLowerCase().includes('mái') ? 'Rooftop / Terrace' :
        `Floor ${floorIndex}`
      );

      // 1. Sơ đồ CAD hư hỏng & kết cấu
      const damageMapUrl = fl.damageMapUrl || fl.cadSketchPhotoUrl || fl.cad_drawing_url || fl.cadArchUrl || fl.cadDrawingUrl || '';
      const damageMapRot =
        fl.cadRotation ??
        fl.cadSketchRotation ??
        rotMap[`floor_${fl.id || fIdx}_cad`] ??
        rotMap[`floor_${fl.id || floorIndex}_cad`] ??
        rotMap[`floor_${fIdx}_cad`] ??
        rotMap[`cad_${fl.id || floorIndex}`] ??
        rotMap[damageMapUrl] ??
        rotMap[fl.floorName] ??
        0;
      const damageMapBase64 = damageMapUrl ? ReportImageResolver.resolveToBase64(damageMapUrl, damageMapRot) : undefined;
      const explicitStructuralMapUrl = fl.structuralMapUrl || fl.cadStructuralSketchPhotoUrl || fl.cad_structural_drawing_url || fl.cadStructuralDrawingUrl || '';
      const hasStructuralCadMap = Boolean(explicitStructuralMapUrl && explicitStructuralMapUrl !== damageMapUrl);
      const structuralMapUrl = hasStructuralCadMap ? explicitStructuralMapUrl : '';
      const structMapRot =
        fl.structuralCadRotation ??
        rotMap[`floor_${fl.id || fIdx}_cad_struct`] ??
        rotMap[`floor_${fl.id || floorIndex}_cad_struct`] ??
        rotMap[`floor_${fl.id || floorIndex}_structural_cad`] ??
        rotMap[structuralMapUrl] ??
        damageMapRot ??
        0;
      const structuralMapBase64 = hasStructuralCadMap && structuralMapUrl ? ReportImageResolver.resolveToBase64(structuralMapUrl, structMapRot) : undefined;
      const hasCadMap = Boolean(damageMapBase64 || damageMapUrl || structuralMapBase64 || structuralMapUrl);

      const hasStructuralElements = fl.hasStructuralElements !== false;
      const noStructuralElementsReason = !hasStructuralElements
        ? {
            vi: fl.noStructuralElementsReason || 'Tầng/mái không bố trí cấu kiện kết cấu chịu lực riêng biệt (mái tôn, giàn thép nhẹ).',
            en: fl.noStructuralElementsReasonEn || 'Floor/roof has no separate load-bearing structural members (lightweight steel frame, sheet metal roof).',
          }
        : undefined;

      const hasZones = fl.hasZones !== false;
      const noZonesReason = hasZones ? undefined : toBilingualNoZonesReason(fl.noZonesReason);

      // 2. Trích xuất ghim CAD
      const { cadPins, cadStructuralPins } = extractFloorCadPins(fl, hasStructuralCadMap);

      // 3. Khởi tạo bộ gom ảnh tổng thể phòng (Z) & cấu kiện (E)
      const roomOverviewPhotos: RoomOverviewPhotoItem[] = [];
      const elementOverviewPhotos: RoomOverviewPhotoItem[] = [];
      const addPhotoIfUnique = createOverviewPhotoCollector(
        photoCounter,
        buildingId,
        rawSurveyDate,
        rotMap,
        roomOverviewPhotos,
        elementOverviewPhotos,
        { parcelCode: parcelForCode, unitCode: unitForCode, floorCode }
      );

      if (Array.isArray(fl.overviewPhotos)) {
        fl.overviewPhotos.forEach((item: any, idx: number) => {
          const url = typeof item === 'string' ? item : item?.url;
          addPhotoIfUnique(
            url,
            floorCode,
            `Mặt bằng ${flNameVi}`,
            `${flNameEn} Overview`,
            true,
            `Ảnh toàn cảnh tầng ${flNameVi} (góc ${idx + 1})`,
            `Floor ${flNameEn} overall view (angle ${idx + 1})`,
            item?.photoCode,
            false,
            undefined,
            item?.capturedAt || item?.shot_at
          );
        });
      }

      // 4. Gom khuyết tật và ghép cặp ảnh từ vùng Z & cấu kiện E
      const {
        defectSummaryRows,
        defectPairPhotos,
        zoneAndElementConditions,
      } = mapFloorZonesAndElements(
        fl,
        fIdx,
        flNameVi,
        flNameEn,
        photoCounter,
        rawSurveyDate,
        rotMap,
        addPhotoIfUnique
      );

      // 4b. Mã ảnh khuyết tật chuẩn HCM_M2.1_[Mã thửa]_..., đoạn tầng theo số Lầu (không lặp tiền tố).
      const pairCode = (stored: string | undefined, url: string | undefined, fallback: string): string => {
        const suffix = stored ? extractPhotoCodeSuffix(stored) : parseCodeFromPhotoUrl(url)?.suffix || fallback;
        return normalizeMetroPhotoCode(replaceFloorSegment(suffix, floorCode), parcelForCode, unitForCode);
      };
      for (const pair of defectPairPhotos) {
        // Giờ chụp thật lấy từ mốc trong tên file (như các ảnh khác); không có thì để Sharp dùng ngày khảo sát.
        pair.contextDateTime = pair.contextDateTime || extractPhotoDateTime(pair.contextPhotoUrl, null, null) || undefined;
        pair.closeUpDateTime = pair.closeUpDateTime || extractPhotoDateTime(pair.closeUpPhotoUrl, null, null) || undefined;
        pair.extraCloseUpDateTime =
          pair.extraCloseUpDateTime || extractPhotoDateTime(pair.extraCloseUpPhotoUrl, null, null) || undefined;
        pair.contextWatermarkCode = pairCode(pair.contextPhotoCode, pair.contextPhotoUrl, `${pair.defectId}_CTX`);
        pair.closeUpWatermarkCode = pairCode(pair.closeUpPhotoCode, pair.closeUpPhotoUrl, `${pair.defectId}_CU_01`);
        if (pair.extraCloseUpPhotoUrl || pair.extraCloseUpPhotoBase64) {
          pair.extraCloseUpWatermarkCode = pairCode(
            pair.extraCloseUpPhotoCode,
            pair.extraCloseUpPhotoUrl,
            `${pair.defectId}_CU_02`
          );
        }
      }

      // 5. Phân trang
      const overviewPages = buildBalancedOverviewPages(roomOverviewPhotos);
      const elementOverviewPages = buildBalancedOverviewPages(elementOverviewPhotos);
      const hasDefects = defectSummaryRows.length > 0;
      const hasSeparateDefectTableSheets = hasDefects;
      const defectSummaryPages = paginateDefectSummaryRows(defectSummaryRows);
      const defectPairPages = paginateDefectPairPhotos(defectPairPhotos);
      const beamDeflectionMm = Number(fl.beamDeflectionMm || 0);

      results.push({
        floorOrder: floorIndex,
        floorName: { vi: flNameVi, en: flNameEn },
        hasCadMap,
        damageMapUrl,
        damageMapBase64,
        structuralMapUrl,
        structuralMapBase64,
        hasStructuralCadMap,
        hasStructuralElements,
        noStructuralElementsReason,
        hasZones,
        noZonesReason,
        hasDefects,
        hasSeparateDefectTableSheets,
        defectSummaryPages,
        // Tầng miễn Z chưa được xem chi tiết nên không được kết luận là không có khuyết tật
        zeroDefectsNotice: hasDefects ? undefined : hasZones ? {
          vi: 'Khảo sát hiện trường không phát hiện vết nứt, biến dạng hoặc khuyết tật kết cấu trên mặt bằng tầng.',
          en: 'Field survey recorded no cracks, deformation or structural defects on this floor plan.',
        } : {
          vi: 'Tầng hạn chế tiếp cận chi tiết, chỉ ghi nhận ảnh tổng quan. Chưa đánh giá khuyết tật bên trong các phòng.',
          en: 'Detailed access restricted; floor overview photos recorded only. Room interiors were not assessed for defects.',
        },
        cadPins,
        cadStructuralPins,
        defectSummaryRows,
        defectPairPhotos,
        defectPairPages,
        overviewPages,
        elementOverviewPages,
        zoneAndElementConditions,
        beamDeflectionRow: {
          location: { vi: 'Toàn tầng', en: 'Whole floor' },
          measuredDeflectionMm: `${beamDeflectionMm.toFixed(1).replace('.', ',')} mm`,
          extraMonitoringRequired: Boolean(fl.requiresAdditionalMonitoring ?? fl.needAdditionalMonitoring ?? fl.extraMonitoringRequired)
            ? { vi: 'có yêu cầu', en: 'required' }
            : { vi: 'không yêu cầu', en: 'not required' },
        },
      });
    }

    return results;
  }
}

