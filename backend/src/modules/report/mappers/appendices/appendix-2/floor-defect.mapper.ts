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
import { ReportImageResolver } from '../../../services/report-image-resolver.service';
import { isPhotoAlreadyWatermarked, extractFloorCadPins } from './cad-pin.mapper';
import { mapFloorZonesAndElements } from './defect-pair.mapper';
import {
  createOverviewPhotoCollector,
  buildBalancedOverviewPages,
  paginateDefectSummaryRows,
  paginateDefectPairPhotos,
} from './floor-overview-pagination.mapper';

export { isPhotoAlreadyWatermarked };

export class FloorDefectMapper {
  public static mapFloors(
    rawFloors: any[],
    photoCounter: { current: number } = { current: 5 },
    buildingId: string = '',
    rawSurveyDate: any = null,
    photoRotations: Record<string, number> = {}
  ): FloorPlanDefectReport[] {
    const results: FloorPlanDefectReport[] = [];
    const rotMap = photoRotations || {};

    let floorIndex = 0;
    for (const fl of rawFloors || []) {
      floorIndex++;
      const fIdx = floorIndex - 1;
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
        elementOverviewPhotos
      );

      if (Array.isArray(fl.overviewPhotos)) {
        fl.overviewPhotos.forEach((item: any, idx: number) => {
          const url = typeof item === 'string' ? item : item?.url;
          addPhotoIfUnique(
            url,
            fl.floorCode || `F0${floorIndex}`,
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
        hasDefects,
        hasSeparateDefectTableSheets,
        defectSummaryPages,
        zeroDefectsNotice: hasDefects ? undefined : {
          vi: 'Khảo sát hiện trường không phát hiện vết nứt, biến dạng hoặc khuyết tật kết cấu trên mặt bằng tầng.',
          en: 'Field survey recorded no cracks, deformation or structural defects on this floor plan.',
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

