/**
 * ============================================================================
 * FLOOR DEFECT MAPPER & PAIR PHOTO BINDER
 * Gom nhóm khuyết tật theo từng tầng (Phụ lục 2),
 * Ghép cặp ảnh đối chiếu (Bối cảnh vs Cận cảnh có thước đo nứt),
 * Thống kê hiện trạng vùng Z và cấu kiện E,
 * Xây dựng danh sách điểm ghim Z, E, D (CadPinOverlayItem) hiển thị trên CAD,
 * Kiểm tra trạng thái Watermark tự động cho từng bức ảnh.
 * ============================================================================
 */

import {
  FloorPlanDefectReport,
  FloorDefectSummaryRow,
  DefectPairPhotoItem,
  FloorConditionZoneElementItem,
  RoomOverviewPhotoItem,
  FloorOverviewPageViewModel,
  CadPinOverlayItem,
} from '../report-v2.types';
import { BurlandCalculator } from './burland-calculator';
import { ReportImageResolver } from '../services/report-image-resolver.service';
import { isPortraitImage } from '../../report/generators/residential/residential.image-sniff';

/**
 * Kiểm tra xem một bức ảnh đã được nhúng watermark từ thiết bị/hệ thống hay chưa
 */
export function isPhotoAlreadyWatermarked(url?: string, photoObj?: any): boolean {
  if (!url && !photoObj) return false;
  if (photoObj?.hasWatermark === true || photoObj?.isWatermarked === true || photoObj?.alreadyWatermarked === true) return true;
  const u = (url || photoObj?.url || '').toLowerCase();
  return (
    u.includes('_wm_') ||
    u.includes('watermark') ||
    u.includes('annotated') ||
    u.includes('_wm.') ||
    u.includes('-wm.')
  );
}

import { extractPhotoDateTime } from './formatters.mapper';

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
      const fIdx = floorIndex - 1;
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

      // 2. Thu thập các điểm ghim Vùng Z và Cấu kiện E trên sơ đồ CAD (Khuyết tật D KHÔNG hiển thị trên CAD theo quy định)
      // Đồng thời lọc bỏ các ghim của vùng Z hoặc cấu kiện E đã bị xóa mềm (is_deleted / isDeleted)
      const cadPins: CadPinOverlayItem[] = [];
      const cadStructuralPins: CadPinOverlayItem[] = [];

      const deletedZoneCodes = new Set<string>();
      const activeZonesByCode = new Map<string, any>();
      if (Array.isArray(fl.zones)) {
        for (const z of fl.zones) {
          const zCode = z?.zoneCode || z?.zone_code;
          if (!zCode) continue;
          if (z.isDeleted || z.is_deleted) {
            deletedZoneCodes.add(zCode);
          } else {
            activeZonesByCode.set(zCode, z);
          }
        }
      }

      const deletedElemCodes = new Set<string>();
      const activeElemsByCode = new Map<string, any>();
      if (Array.isArray(fl.structuralElements)) {
        for (const el of fl.structuralElements) {
          const elCode = el?.elementCode || el?.element_code || el?.zoneCode || el?.zone_code;
          if (!elCode) continue;
          if (el.isDeleted || el.is_deleted) {
            deletedElemCodes.add(elCode);
          } else {
            activeElemsByCode.set(elCode, el);
          }
        }
      }

      const seenCadZoneCodes = new Set<string>();
      // Vùng Z từ fl.cadZonePins: Toạ độ chuẩn tỷ lệ % trên sơ đồ CAD kiến trúc (1:1 theo dữ liệu khảo sát)
      if (Array.isArray(fl.cadZonePins)) {
        for (const p of fl.cadZonePins) {
          if (!p || p.isDeleted || p.is_deleted) continue;
          const pX = p.pinX ?? p.pin_x;
          const pY = p.pinY ?? p.pin_y;
          if (pX !== undefined && pY !== undefined) {
            const code = p.zoneCode || p.zone_code || p.label || 'Z';
            if (deletedZoneCodes.has(code)) continue;
            seenCadZoneCodes.add(code);
            cadPins.push({
              id: p.id,
              code,
              label: p.label || code,
              pinX: Number(pX),
              pinY: Number(pY),
              type: 'ZONE',
              typeLower: 'zone',
              description: `Vùng kiến trúc ${code}`,
            });
          }
        }
      }
      // Bổ sung ghim cho các Vùng Z mới thêm có pinX/pinY trực tiếp trên đối tượng z nhưng chưa nằm trong fl.cadZonePins
      for (const [zCode, z] of activeZonesByCode.entries()) {
        if (!seenCadZoneCodes.has(zCode)) {
          const zX = z.pinX ?? z.pin_x;
          const zY = z.pinY ?? z.pin_y;
          if (zX !== undefined && zY !== undefined && zX !== null && zY !== null) {
            cadPins.push({
              id: z.id || `pin-${zCode}`,
              code: zCode,
              label: zCode,
              pinX: Number(zX),
              pinY: Number(zY),
              type: 'ZONE',
              typeLower: 'zone',
              description: `Vùng kiến trúc ${zCode}`,
            });
          }
        }
      }

      const seenCadElemCodes = new Set<string>();
      // Cấu kiện E từ fl.cadElementPins: Bản vẽ kết cấu vốn là ảnh dọc, giữ nguyên tọa độ
      if (Array.isArray(fl.cadElementPins)) {
        for (const p of fl.cadElementPins) {
          if (!p || p.isDeleted || p.is_deleted) continue;
          const pX = p.pinX ?? p.pin_x;
          const pY = p.pinY ?? p.pin_y;
          if (pX !== undefined && pY !== undefined) {
            const code = p.zoneCode || p.zone_code || p.elementCode || p.element_code || p.label || 'E';
            if (deletedElemCodes.has(code)) continue;
            seenCadElemCodes.add(code);
            const item: CadPinOverlayItem = {
              id: p.id,
              code,
              label: p.label || code,
              pinX: Number(pX),
              pinY: Number(pY),
              type: 'STRUCTURAL',
              typeLower: 'element',
              description: `Cấu kiện kết cấu ${code}`,
            };
            cadStructuralPins.push(item);
            if (!hasStructuralCadMap) {
              cadPins.push(item);
            }
          }
        }
      }
      // Bổ sung ghim cho các Cấu kiện E mới thêm có pinX/pinY trực tiếp trên đối tượng el nhưng chưa nằm trong fl.cadElementPins
      for (const [elCode, el] of activeElemsByCode.entries()) {
        if (!seenCadElemCodes.has(elCode)) {
          const eX = el.pinX ?? el.pin_x;
          const eY = el.pinY ?? el.pin_y;
          if (eX !== undefined && eY !== undefined && eX !== null && eY !== null) {
            const item: CadPinOverlayItem = {
              id: el.id || `pin-${elCode}`,
              code: elCode,
              label: elCode,
              pinX: Number(eX),
              pinY: Number(eY),
              type: 'STRUCTURAL',
              typeLower: 'element',
              description: `Cấu kiện kết cấu ${elCode}`,
            };
            cadStructuralPins.push(item);
            if (!hasStructuralCadMap) {
              cadPins.push(item);
            }
          }
        }
      }

      // 3. TÁCH BIỆT 2 DANH MỤC ẢNH:
      // - roomOverviewPhotos: Ảnh không gian kiến trúc các phòng (Vùng Z - Ảnh ngang)
      // - elementOverviewPhotos: Ảnh cấu kiện kết cấu chịu lực (Cột/Dầm E - Ảnh dọc)
      const roomOverviewPhotos: RoomOverviewPhotoItem[] = [];
      const elementOverviewPhotos: RoomOverviewPhotoItem[] = [];
      const seenPhotoUrls = new Set<string>();

      const addPhotoIfUnique = (
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
        const mCode = photoCode || (buildingId ? `HCM_M2.[${buildingId}]_${zoneCode}_${photoId}` : photoId);

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
          isStructuralElement: isStructural,
        };

        if (isStructural) {
          elementOverviewPhotos.push(photoItem);
        } else {
          roomOverviewPhotos.push(photoItem);
        }
      };

      // Thu thập ảnh toàn cảnh tầng (nếu có fl.overviewPhotos) - thuộc nhóm kiến trúc
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

      const defectSummaryRows: FloorDefectSummaryRow[] = [];
      const defectPairPhotos: DefectPairPhotoItem[] = [];
      const zoneAndElementConditions: FloorConditionZoneElementItem[] = [];

      let defectNo = 0;

      const rawZones = (fl.zones && fl.zones.length > 0)
        ? fl.zones.filter((z: any) => !z?.isDeleted && !z?.is_deleted)
        : (Array.isArray(fl.defects) && fl.defects.length > 0)
          ? [{ zoneCode: 'Z-01', roomName: 'Khu vực khảo sát', defects: fl.defects.filter((d: any) => !d?.isDeleted && !d?.is_deleted) }]
          : [];

      // Duyệt qua các vùng Z
      for (const z of rawZones) {
        const zCode = z.zoneCode || 'Z-01';
        const resolvedRoom = (z.roomName === 'Khác' && z.customRoomName) ? z.customRoomName : z.roomName;
        const resolvedWallMat = (z.wallMaterial === 'Khác' && z.customWallMaterial) ? z.customWallMaterial : z.wallMaterial;
        const roomVi = resolvedRoom || 'Khu vực chung';
        const roomEn = z.roomNameEn || roomVi;
        const wallMatVi = resolvedWallMat || 'Chưa ghi nhận vật liệu';
        const wallMatEn = z.wallMaterialEn || (resolvedWallMat ? resolvedWallMat : 'Not recorded');

        const defects = (z.defects || []).filter((d: any) => !d?.isDeleted && !d?.is_deleted);
        let maxZoneW = 0;
        let zoneConditionVi = 'Bình thường (B-0)';
        let zoneConditionEn = 'Normal (B-0)';

        photoCounter.current++;
        const pZoneLabel = `P-${photoCounter.current.toString().padStart(2, '0')}`;

        if (defects.length > 0) {
          const usedZoneDefectCodes = new Set<string>();
          for (let dIdx = 0; dIdx < defects.length; dIdx++) {
            const d = defects[dIdx];
            defectNo++;
            let dCode = d.defectCode || d.defect_code;
            if (!dCode || usedZoneDefectCodes.has(dCode)) {
              dCode = `D-${(dIdx + 1).toString().padStart(2, '0')}`;
            }
            usedZoneDefectCodes.add(dCode);
            const w = typeof d.widthMm === 'number' ? d.widthMm : parseFloat(d.widthMm || d.widthMaxMm || '0') || 0;
            const rawL = typeof d.lengthM === 'number' ? d.lengthM : parseFloat(d.lengthM || d.lengthMm || '0') || 0;
            const l = rawL > 50 ? +(rawL / 1000).toFixed(2) : rawL;
            if (w > maxZoneW) maxZoneW = w;

            const bGrade = (d.burlandGrade !== undefined && d.burlandGrade !== null && !isNaN(Number(d.burlandGrade)))
              ? Number(d.burlandGrade)
              : BurlandCalculator.calculateGradeFromCrackWidth(w);
            const bCatVi = BurlandCalculator.getBurlandGradeLabelVi(bGrade);
            const bCatEn = BurlandCalculator.getBurlandGradeLabelEn(bGrade);

            const typeVi = d.defectType || 'Vết nứt bề mặt tường';
            const typeEn = d.defectTypeEn || 'Wall surface crack';

            // Khuyết tật D KHÔNG hiển thị trên sơ đồ CAD theo yêu cầu nghiệp vụ

            const descPartsVi: string[] = [];
            const descPartsEn: string[] = [];
            if (d.notes && d.notes.trim()) {
              descPartsVi.push(d.notes.trim());
              descPartsEn.push(d.notes.trim());
            }
            if (d.azimuth || d.crackDirection) {
              const dir = d.azimuth || d.crackDirection;
              const isAngle = !isNaN(Number(dir));
              descPartsVi.push(`Hướng vết nứt: ${dir}${isAngle ? '°' : ''}`);
              descPartsEn.push(`Crack direction: ${dir}${isAngle ? '°' : ''}`);
            }
            const actState = d.activityState || 'S';
            const actStateDisplay = actState === 'A'
              ? { vi: 'Đang phát triển (A)', en: 'Active (A)' }
              : { vi: 'Ổn định (S)', en: 'Stable (S)' };
            descPartsVi.push(`Trạng thái: ${actStateDisplay.vi}`);
            descPartsEn.push(`Status: ${actStateDisplay.en}`);

            const cadPinRefStr = (d.pinX !== undefined && d.pinY !== undefined)
              ? `Ghim CAD: ${dCode} tại ${zCode}`
              : undefined;

            defectSummaryRows.push({
              no: defectNo,
              defectId: dCode,
              location: {
                vi: `${flNameVi} - ${roomVi}, tường ${zCode}`,
                en: `${flNameEn} - ${roomEn} wall ${zCode}`,
              },
              defectType: { vi: typeVi, en: typeEn },
              widthMm: w > 0 ? `${w} mm` : '–',
              lengthM: l > 0 ? `${l} m` : '–',
              burlandDamageCategory: { vi: bCatVi, en: bCatEn },
              burlandGrade: bGrade,
              description: {
                vi: descPartsVi.join(', '),
                en: descPartsEn.join(', '),
              },
              cadPinRef: cadPinRefStr,
            });

            // Cặp ảnh đối chiếu (Context & Close-up với thước đo nứt)
            const rawCu0 = Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0 ? d.cuPhotos[0] : '';
            const cuUrl = d.closeUpPhotoUrl || d.cuPhotoUrl || (typeof rawCu0 === 'string' ? rawCu0 : rawCu0?.url) || '';
            const rawCtx0 = Array.isArray(z.overviewPhotos) && z.overviewPhotos.length > 0 ? z.overviewPhotos[0] : '';
            const ctxUrl = d.contextPhotoUrl || d.ctxPhotoUrl || z.ctxPhotoUrl || (typeof rawCtx0 === 'string' ? rawCtx0 : rawCtx0?.url) || '';

            const rawCu1 = Array.isArray(d.cuPhotos) && d.cuPhotos.length > 1 ? d.cuPhotos[1] : undefined;
            const extraCuUrl = (typeof rawCu1 === 'string' ? rawCu1 : rawCu1?.url) ||
              d.extraPhotoUrl || d.extraCuPhotoUrl || undefined;

            const dimVi = (w > 0 || l > 0) ? `wmax = ${w} mm, L = ${l} m` : 'Khuyết tật bề mặt (bong tróc/ẩm mốc)';
            const dimEn = (w > 0 || l > 0) ? `wmax = ${w} mm, L = ${l} m` : 'Surface defect (spalling/dampness)';

            const zId = z.id ? String(z.id) : '';
            const baseZKey = zId ? (zId.startsWith('zone_') ? zId : `zone_${zId}`) : `zone_f${fIdx}_z${zCode}`;
            const ctxRot =
              d.ctxRotation ??
              z.ctxRotation ??
              rotMap[`${baseZKey}_ctx`] ??
              rotMap[`zone_f${fIdx}_z${zCode}_ctx`] ??
              rotMap[`zone_${z.id || zCode}_ctx`] ??
              rotMap[`${baseZKey}_ov_0`] ??
              rotMap[zCode] ??
              rotMap[ctxUrl] ??
              0;
            const cuRot =
              d.cuRotation ??
              rotMap[`defect_${d.id}_cu`] ??
              rotMap[`defect_${d.id}_cu_0`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_${d.id}_cu`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_${d.id}_cu_0`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_d${dCode}_cu`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_d${dCode}_cu_0`] ??
              rotMap[`defect_${d.id || dCode}_cu`] ??
              rotMap[dCode] ??
              rotMap[cuUrl] ??
              0;
            const extraCuRot =
              d.extraCuRotation ??
              rotMap[`defect_${d.id}_cu_1`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_${d.id}_cu_1`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_d${dCode}_cu_1`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_${d.id}_extra_cu`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_d${dCode}_extra_cu`] ??
              rotMap[`defect_${d.id || dCode}_extra_cu`] ??
              (extraCuUrl ? rotMap[extraCuUrl] : undefined) ??
              0;

            const rawCtxBase64 = ctxUrl ? ReportImageResolver.resolveToBase64(ctxUrl, ctxRot) : '';
            const rawCuBase64 = cuUrl ? ReportImageResolver.resolveToBase64(cuUrl, cuRot) : '';
            const rawExtraCuBase64 = extraCuUrl ? ReportImageResolver.resolveToBase64(extraCuUrl, extraCuRot) : '';

            const resolvedCtxBase64 = rawCtxBase64 && !rawCtxBase64.startsWith('blob:') ? rawCtxBase64 : undefined;
            const resolvedCuBase64 = rawCuBase64 && !rawCuBase64.startsWith('blob:') ? rawCuBase64 : undefined;
            const resolvedExtraCuBase64 = rawExtraCuBase64 && !rawExtraCuBase64.startsWith('blob:') ? rawExtraCuBase64 : undefined;

            const cuPhotoCode = d.cuPhotoCode || (Array.isArray(d.cuPhotoCodes) ? d.cuPhotoCodes[0] : undefined) || `${dCode}_CU_01`;
            const extraCuPhotoCode = (Array.isArray(d.cuPhotoCodes) && d.cuPhotoCodes.length > 1 ? d.cuPhotoCodes[1] : undefined) || `${dCode}_CU_02`;

            const pinX = d.pinX !== undefined ? Number(d.pinX) : (d.pin_x !== undefined ? Number(d.pin_x) : undefined);
            const pinY = d.pinY !== undefined ? Number(d.pinY) : (d.pin_y !== undefined ? Number(d.pin_y) : undefined);
            const hasPin = pinX !== undefined && pinY !== undefined && !isNaN(pinX) && !isNaN(pinY);

            defectPairPhotos.push({
              defectId: dCode,
              defectType: { vi: typeVi, en: typeEn },
              contextPhotoUrl: (ctxUrl && !ctxUrl.startsWith('blob:')) ? ctxUrl : undefined,
              contextPhotoBase64: resolvedCtxBase64,
              contextCaption: {
                vi: `${typeVi}-${dCode} (bối cảnh / context): Tường ${zCode} ${roomVi}`,
                en: `${typeEn}-${dCode} (context): Wall ${zCode} ${roomEn}`,
              },
              contextAlreadyWatermarked: isPhotoAlreadyWatermarked(ctxUrl),
              contextPhotoCode: z.ctxPhotoCode || `${zCode}_CTX`,

              closeUpPhotoUrl: (cuUrl && !cuUrl.startsWith('blob:')) ? cuUrl : undefined,
              closeUpPhotoBase64: resolvedCuBase64,
              closeUpCaption: {
                vi: `${typeVi}-${dCode} (cận cảnh / close-up): ${dimVi}`,
                en: `${typeEn}-${dCode} (close-up): ${dimEn}`,
              },
              closeUpAlreadyWatermarked: isPhotoAlreadyWatermarked(cuUrl),
              closeUpPhotoCode: cuPhotoCode,

              hasCrackGauge: Boolean(d.hasCrackGauge ?? d.hasScaleCard ?? true),
              wmaxMm: w,
              lengthM: l,

              extraCloseUpPhotoUrl: (extraCuUrl && !extraCuUrl.startsWith('blob:')) ? extraCuUrl : undefined,
              extraCloseUpPhotoBase64: resolvedExtraCuBase64,
              extraCloseUpCaption: extraCuUrl ? {
                vi: `${typeVi}-${dCode} (thước đo chi tiết / crack gauge): wmax = ${w} mm`,
                en: `${typeEn}-${dCode} (macro crack gauge): wmax = ${w} mm`,
              } : undefined,
              extraCloseUpAlreadyWatermarked: isPhotoAlreadyWatermarked(extraCuUrl),
              extraCloseUpPhotoCode: extraCuPhotoCode,
              hasExtraCloseUp: Boolean(extraCuUrl),

              activityState: actState,
              activityStateDisplay: actStateDisplay,
              notes: d.notes || '',
              cadPinRef: cadPinRefStr,
              pinX,
              pinY,
              pinColor: d.pinColor || d.pin_color || '#ef4444',
              hasPin,
            });
          }

          const zoneBurland = (z.burlandGrade !== undefined && z.burlandGrade !== null && !isNaN(Number(z.burlandGrade)))
            ? Number(z.burlandGrade)
            : BurlandCalculator.calculateGradeFromCrackWidth(maxZoneW);
          const firstDefectCode = defects[0]?.defectCode || 'D-01';
          const shortGradeVi: Record<number, string> = {
            0: 'Không đáng kể',
            1: 'Rất nhẹ',
            2: 'Nhẹ',
            3: 'Trung bình',
            4: 'Nặng',
            5: 'Rất nặng',
          };
          const shortGradeEn: Record<number, string> = {
            0: 'Negligible',
            1: 'Very Slight',
            2: 'Slight',
            3: 'Moderate',
            4: 'Severe',
            5: 'Very Severe',
          };
          zoneConditionVi = `${shortGradeVi[zoneBurland] || 'Nhẹ'} (B-${zoneBurland}) - ${firstDefectCode}`;
          zoneConditionEn = `${shortGradeEn[zoneBurland] || 'Slight'} (B-${zoneBurland}) - ${firstDefectCode}`;
        }

        const zId = z.id ? String(z.id) : '';
        const baseZKey = zId ? (zId.startsWith('zone_') ? zId : `zone_${zId}`) : `zone_f${fIdx}_z${zCode}`;
        const zPhotoUrl = z.photoUrl || z.ctxPhotoUrl || (Array.isArray(z.overviewPhotos) ? z.overviewPhotos[0] : '') || '';
        const zPhotoRot =
          z.photoRotation ??
          rotMap[`${baseZKey}_ctx`] ??
          rotMap[`zone_f${fIdx}_z${zCode}_ctx`] ??
          rotMap[`zone_${z.id || zCode}_ctx`] ??
          rotMap[`zone_${z.id || zCode}_photo`] ??
          rotMap[zCode] ??
          rotMap[zPhotoUrl] ??
          0;
        zoneAndElementConditions.push({
          code: zCode,
          location: { vi: roomVi, en: roomEn },
          memberMaterial: { vi: wallMatVi, en: wallMatEn },
          condition: { vi: zoneConditionVi, en: zoneConditionEn },
          photoRefLabel: pZoneLabel,
          photoUrl: zPhotoUrl,
          photoBase64: zPhotoUrl ? ReportImageResolver.resolveToBase64(zPhotoUrl, zPhotoRot) : undefined,
        });

        // Thu thập ảnh tổng thể phòng (Vùng Z)
        // Bản đồ liên kết URL ảnh bối cảnh với mã khuyết tật cụ thể trong phòng
        const zDefectContextMap = new Map<string, string>();
        for (const d of defects) {
          const dCode = d.defectCode || 'D-01';
          const dCtx = (d.contextPhotoUrl || d.ctxPhotoUrl || '').trim();
          if (dCtx) zDefectContextMap.set(dCtx, dCode);
        }
        if (defects.length > 0 && z.ctxPhotoUrl) {
          const cleanZCtx = z.ctxPhotoUrl.trim();
          if (!zDefectContextMap.has(cleanZCtx)) {
            zDefectContextMap.set(cleanZCtx, defects.map((d: any) => d.defectCode || 'D-01').join(', '));
          }
        }

        if (Array.isArray(z.overviewPhotos)) {
          z.overviewPhotos.forEach((item: any, idx: number) => {
            const url = typeof item === 'string' ? item : item?.url;
            if (!url) return;
            const cleanUrl = url.trim();
            const matchingDefectCode = zDefectContextMap.get(cleanUrl);
            const isDefectPhoto = Boolean(matchingDefectCode);

            const isFirstOverview = idx === 0;
            const captionVi = isDefectPhoto
              ? `Vị trí bối cảnh khuyết tật [${matchingDefectCode}] - ${roomVi} (${zCode})`
              : (isFirstOverview
                  ? `Ảnh không gian tổng thể ${roomVi} (${zCode})`
                  : `Ảnh hiện trạng không gian ${roomVi} (${zCode}) - góc ${idx + 1}`);
            const captionEn = isDefectPhoto
              ? `Defect context location [${matchingDefectCode}] - ${roomEn} (${zCode})`
              : (isFirstOverview
                  ? `Overall space view of ${roomEn} (${zCode})`
                  : `Condition of ${roomEn} (${zCode}) - angle ${idx + 1}`);

            const ovExplicitRot =
              rotMap[`${baseZKey}_ov_${idx}`] ??
              rotMap[`zone_f${fIdx}_z${zCode}_ov_${idx}`] ??
              rotMap[`${baseZKey}_ctx`] ??
              rotMap[cleanUrl];
            addPhotoIfUnique(
              url,
              zCode,
              roomVi,
              roomEn,
              !isDefectPhoto,
              captionVi,
              captionEn,
              item?.photoCode,
              false,
              isDefectPhoto
                ? { vi: `Bối cảnh khuyết tật [${matchingDefectCode}]`, en: `Defect context [${matchingDefectCode}]` }
                : { vi: 'Toàn cảnh không gian', en: 'Space overview' },
              item?.capturedAt || item?.shot_at,
              ovExplicitRot
            );
          });
        }
        if (z.ctxPhotoUrl) {
          const cleanZCtx = z.ctxPhotoUrl.trim();
          const matchingDefectCode = zDefectContextMap.get(cleanZCtx) || (defects.length > 0 ? defects[0]?.defectCode || 'D-01' : undefined);
          const isDefectPhoto = Boolean(matchingDefectCode);

          const ctxExplicitRot =
            z.ctxRotation ??
            rotMap[`${baseZKey}_ctx`] ??
            rotMap[`zone_f${fIdx}_z${zCode}_ctx`] ??
            rotMap[`zone_${z.id || zCode}_ctx`] ??
            rotMap[cleanZCtx];
          addPhotoIfUnique(
            z.ctxPhotoUrl,
            zCode,
            roomVi,
            roomEn,
            !isDefectPhoto,
            isDefectPhoto
              ? `Vị trí bối cảnh khuyết tật [${matchingDefectCode}] - ${roomVi} (${zCode})`
              : `Hiện trạng bề mặt tường ${roomVi} (${zCode})`,
            isDefectPhoto
              ? `Defect context location [${matchingDefectCode}] - ${roomEn} (${zCode})`
              : `Surface condition of ${roomEn} (${zCode})`,
            z.ctxPhotoCode,
            false,
            isDefectPhoto
              ? { vi: `Bối cảnh khuyết tật [${matchingDefectCode}]`, en: `Defect context [${matchingDefectCode}]` }
              : { vi: 'Bề mặt ổn định', en: 'Intact surface' },
            (z as any).ctxCapturedAt || (z as any).capturedAt,
            ctxExplicitRot
          );
        }
      }

      // Duyệt qua các cấu kiện kết cấu E (Bỏ qua phần tử và khuyết tật đã xóa mềm)
      const elements = (fl.structuralElements || []).filter((e: any) => !e?.isDeleted && !e?.is_deleted);
      for (const e of elements) {
        photoCounter.current++;
        const pElemLabel = `P-${photoCounter.current.toString().padStart(2, '0')}`;
        const eCode = e.elementCode || 'E-01';
        const resolvedERoom = (e.roomName === 'Khác' && e.customRoomName) ? e.customRoomName : e.roomName;
        const resolvedEMat = (e.materialType === 'Khác' && e.customMaterialType) ? e.customMaterialType : e.materialType;
        const resolvedEType = (e.elementType === 'Khác' && e.customElementType) ? e.customElementType : e.elementType;
        const eRoomVi = resolvedERoom || 'Khu vực chính';
        const eRoomEn = e.roomNameEn || eRoomVi;
        const eMatVi = resolvedEMat || resolvedEType || 'Cấu kiện kết cấu';
        const eMatEn = e.materialTypeEn || 'Structural member';
        const ePhotoUrl = e.photoUrl || e.ctxPhotoUrl || '';

        const eDefects = (e.defects || []).filter((d: any) => !d?.isDeleted && !d?.is_deleted);
        let maxElemW = 0;
        let elemConditionVi = 'Ổn định, nguyên vẹn';
        let elemConditionEn = 'Stable, intact';

        if (eDefects.length > 0) {
          const usedElemDefectCodes = new Set<string>();
          for (let edIdx = 0; edIdx < eDefects.length; edIdx++) {
            const d = eDefects[edIdx];
            defectNo++;
            let dCode = d.defectCode || d.defect_code;
            if (!dCode || usedElemDefectCodes.has(dCode)) {
              dCode = `D-${(edIdx + 1).toString().padStart(2, '0')}`;
            }
            usedElemDefectCodes.add(dCode);
            const w = typeof d.widthMm === 'number' ? d.widthMm : parseFloat(d.widthMm || d.widthMaxMm || '0') || 0;
            const rawL = typeof d.lengthM === 'number' ? d.lengthM : parseFloat(d.lengthM || d.lengthMm || '0') || 0;
            const l = rawL > 50 ? +(rawL / 1000).toFixed(2) : rawL;
            if (w > maxElemW) maxElemW = w;

            const bGrade = (d.burlandGrade !== undefined && d.burlandGrade !== null && !isNaN(Number(d.burlandGrade)))
              ? Number(d.burlandGrade)
              : BurlandCalculator.calculateGradeFromCrackWidth(w);
            const bCatVi = BurlandCalculator.getBurlandGradeLabelVi(bGrade);
            const bCatEn = BurlandCalculator.getBurlandGradeLabelEn(bGrade);

            const typeVi = d.defectType || 'Nứt dọc thân cấu kiện kết cấu';
            const typeEn = d.defectTypeEn || 'Structural crack in concrete member';

            // Khuyết tật D KHÔNG hiển thị trên sơ đồ CAD theo yêu cầu nghiệp vụ

            const descPartsVi: string[] = [];
            const descPartsEn: string[] = [];
            if (d.notes && d.notes.trim()) {
              descPartsVi.push(d.notes.trim());
              descPartsEn.push(d.notes.trim());
            }
            if (d.azimuth || d.crackDirection) {
              const dir = d.azimuth || d.crackDirection;
              const isAngle = !isNaN(Number(dir));
              descPartsVi.push(`Hướng vết nứt: ${dir}${isAngle ? '°' : ''}`);
              descPartsEn.push(`Crack direction: ${dir}${isAngle ? '°' : ''}`);
            }
            const actState = d.activityState || 'S';
            const actStateDisplay = actState === 'A'
              ? { vi: 'Đang phát triển (A)', en: 'Active (A)' }
              : { vi: 'Ổn định (S)', en: 'Stable (S)' };
            descPartsVi.push(`Trạng thái: ${actStateDisplay.vi}`);
            descPartsEn.push(`Status: ${actStateDisplay.en}`);

            const cadPinRefStr = (d.pinX !== undefined && d.pinY !== undefined)
              ? `Ghim CAD: ${dCode} tại ${eCode}`
              : undefined;

            defectSummaryRows.push({
              no: defectNo,
              defectId: dCode,
              location: {
                vi: `${flNameVi} - Cấu kiện ${eCode} (${eMatVi}), ${eRoomVi}`,
                en: `${flNameEn} - Member ${eCode} (${eMatEn}), ${eRoomEn}`,
              },
              defectType: { vi: typeVi, en: typeEn },
              widthMm: w > 0 ? `${w} mm` : '–',
              lengthM: l > 0 ? `${l} m` : '–',
              burlandDamageCategory: { vi: bCatVi, en: bCatEn },
              burlandGrade: bGrade,
              description: {
                vi: descPartsVi.length > 0 ? descPartsVi.join(', ') : 'Nứt cấu kiện kết cấu chịu lực',
                en: descPartsEn.length > 0 ? descPartsEn.join(', ') : 'Structural member crack',
              },
              cadPinRef: cadPinRefStr,
            });

            // Cặp ảnh đối chiếu của cấu kiện E
            const rawCu0 = Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0 ? d.cuPhotos[0] : '';
            const cuUrl = d.closeUpPhotoUrl || d.cuPhotoUrl || (typeof rawCu0 === 'string' ? rawCu0 : rawCu0?.url) || '';
            const rawCtx0 = Array.isArray(e.overviewPhotos) && e.overviewPhotos.length > 0 ? e.overviewPhotos[0] : '';
            const ctxUrl = d.contextPhotoUrl || d.ctxPhotoUrl || e.ctxPhotoUrl || (typeof rawCtx0 === 'string' ? rawCtx0 : rawCtx0?.url) || '';

            const rawCu1 = Array.isArray(d.cuPhotos) && d.cuPhotos.length > 1 ? d.cuPhotos[1] : undefined;
            const extraCuUrl = (typeof rawCu1 === 'string' ? rawCu1 : rawCu1?.url) ||
              d.extraPhotoUrl || d.extraCuPhotoUrl || undefined;

            const dimVi = (w > 0 || l > 0) ? `wmax = ${w} mm, L = ${l} m` : 'Khuyết tật cấu kiện kết cấu';
            const dimEn = (w > 0 || l > 0) ? `wmax = ${w} mm, L = ${l} m` : 'Structural element defect';

            const eId = e.id ? String(e.id) : '';
            const baseEKey = eId ? (eId.startsWith('elem_') ? eId : `elem_${eId}`) : `elem_f${fIdx}_e${eCode}`;
            const ctxRot =
              d.ctxRotation ??
              e.ctxRotation ??
              rotMap[`${baseEKey}_ctx`] ??
              rotMap[`elem_f${fIdx}_e${eCode}_ctx`] ??
              rotMap[`element_f${fIdx}_e${eCode}_ctx`] ??
              rotMap[`element_${e.id || eCode}_ctx`] ??
              rotMap[`${baseEKey}_ov_0`] ??
              rotMap[eCode] ??
              rotMap[ctxUrl] ??
              0;
            const cuRot =
              d.cuRotation ??
              rotMap[`defect_${d.id}_cu`] ??
              rotMap[`defect_${d.id}_cu_0`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_${d.id}_cu`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_${d.id}_cu_0`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_d${dCode}_cu`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_d${dCode}_cu_0`] ??
              rotMap[`defect_${d.id || dCode}_cu`] ??
              rotMap[dCode] ??
              rotMap[cuUrl] ??
              0;
            const extraCuRot =
              d.extraCuRotation ??
              rotMap[`defect_${d.id}_cu_1`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_${d.id}_cu_1`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_d${dCode}_cu_1`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_${d.id}_extra_cu`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_d${dCode}_extra_cu`] ??
              rotMap[`defect_${d.id || dCode}_extra_cu`] ??
              (extraCuUrl ? rotMap[extraCuUrl] : undefined) ??
              0;

            const rawCtxBase64 = ctxUrl ? ReportImageResolver.resolveToBase64(ctxUrl, ctxRot) : '';
            const rawCuBase64 = cuUrl ? ReportImageResolver.resolveToBase64(cuUrl, cuRot) : '';
            const rawExtraCuBase64 = extraCuUrl ? ReportImageResolver.resolveToBase64(extraCuUrl, extraCuRot) : '';

            const cuPhotoCode = d.cuPhotoCode || (Array.isArray(d.cuPhotoCodes) ? d.cuPhotoCodes[0] : undefined) || `${dCode}_CU_01`;
            const extraCuPhotoCode = (Array.isArray(d.cuPhotoCodes) && d.cuPhotoCodes.length > 1 ? d.cuPhotoCodes[1] : undefined) || `${dCode}_CU_02`;

            defectPairPhotos.push({
              defectId: dCode,
              defectType: { vi: typeVi, en: typeEn },
              contextPhotoUrl: (ctxUrl && !ctxUrl.startsWith('blob:')) ? ctxUrl : undefined,
              contextPhotoBase64: rawCtxBase64 && !rawCtxBase64.startsWith('blob:') ? rawCtxBase64 : undefined,
              contextCaption: {
                vi: `${typeVi}-${dCode} (bối cảnh / context): Cấu kiện ${eCode} ${eRoomVi}`,
                en: `${typeEn}-${dCode} (context): Member ${eCode} ${eRoomEn}`,
              },
              contextAlreadyWatermarked: isPhotoAlreadyWatermarked(ctxUrl),
              contextPhotoCode: e.ctxPhotoCode || `${eCode}_CTX`,
              contextDateTime: extractPhotoDateTime(ctxUrl, (e as any).ctxCapturedAt || (e as any).ctx_captured_at || (e as any).capturedAt, rawSurveyDate),
              closeUpDateTime: extractPhotoDateTime(cuUrl, d.capturedAt || d.cuPhotoTimestamps?.[0] || (d as any).shot_at, rawSurveyDate),
              extraCloseUpDateTime: extractPhotoDateTime(extraCuUrl, d.cuPhotoTimestamps?.[1], rawSurveyDate),

              closeUpPhotoUrl: (cuUrl && !cuUrl.startsWith('blob:')) ? cuUrl : undefined,
              closeUpPhotoBase64: rawCuBase64 && !rawCuBase64.startsWith('blob:') ? rawCuBase64 : undefined,
              closeUpCaption: {
                vi: `${typeVi}-${dCode} (cận cảnh / close-up): ${dimVi}`,
                en: `${typeEn}-${dCode} (close-up): ${dimEn}`,
              },
              closeUpAlreadyWatermarked: isPhotoAlreadyWatermarked(cuUrl),
              closeUpPhotoCode: cuPhotoCode,

              hasCrackGauge: Boolean(d.hasCrackGauge ?? d.hasScaleCard ?? true),
              wmaxMm: w,
              lengthM: l,

              extraCloseUpPhotoUrl: (extraCuUrl && !extraCuUrl.startsWith('blob:')) ? extraCuUrl : undefined,
              extraCloseUpPhotoBase64: rawExtraCuBase64 && !rawExtraCuBase64.startsWith('blob:') ? rawExtraCuBase64 : undefined,
              extraCloseUpCaption: extraCuUrl ? {
                vi: `${typeVi}-${dCode} (thước đo chi tiết / crack gauge): wmax = ${w} mm`,
                en: `${typeEn}-${dCode} (macro crack gauge): wmax = ${w} mm`,
              } : undefined,
              extraCloseUpAlreadyWatermarked: isPhotoAlreadyWatermarked(extraCuUrl),
              extraCloseUpPhotoCode: extraCuPhotoCode,
              hasExtraCloseUp: Boolean(extraCuUrl),

              activityState: actState,
              activityStateDisplay: actStateDisplay,
              notes: d.notes || '',
              cadPinRef: cadPinRefStr,
              pinX: (d.pinX ?? d.pin_x) !== undefined && (d.pinX ?? d.pin_x) !== null ? Number(d.pinX ?? d.pin_x) : undefined,
              pinY: (d.pinY ?? d.pin_y) !== undefined && (d.pinY ?? d.pin_y) !== null ? Number(d.pinY ?? d.pin_y) : undefined,
              pinColor: d.pinColor || d.pin_color || '#ef4444',
              hasPin: (d.pinX ?? d.pin_x) !== undefined && (d.pinX ?? d.pin_x) !== null && (d.pinY ?? d.pin_y) !== undefined && (d.pinY ?? d.pin_y) !== null,
            });
          }

          const elemBurland = BurlandCalculator.calculateGradeFromCrackWidth(maxElemW);
          const firstDefectCode = eDefects[0]?.defectCode || 'D-01';
          elemConditionVi = `Nứt kết cấu (B-${elemBurland}) - ${firstDefectCode} (w=${maxElemW}mm)`;
          elemConditionEn = `Structural crack (B-${elemBurland}) - ${firstDefectCode} (w=${maxElemW}mm)`;
        }

        const eId = e.id ? String(e.id) : '';
        const baseEKey = eId ? (eId.startsWith('elem_') ? eId : `elem_${eId}`) : `elem_f${fIdx}_e${eCode}`;
        const ePhotoRot =
          e.photoRotation ??
          rotMap[`${baseEKey}_ctx`] ??
          rotMap[`elem_f${fIdx}_e${eCode}_ctx`] ??
          rotMap[`element_f${fIdx}_e${eCode}_ctx`] ??
          rotMap[`element_${e.id || eCode}_ctx`] ??
          rotMap[`element_${e.id || eCode}_photo`] ??
          rotMap[eCode] ??
          rotMap[ePhotoUrl] ??
          0;
        zoneAndElementConditions.push({
          code: eCode,
          location: { vi: eRoomVi, en: eRoomEn },
          memberMaterial: { vi: eMatVi, en: eMatEn },
          condition: { vi: elemConditionVi, en: elemConditionEn },
          photoRefLabel: pElemLabel,
          photoUrl: ePhotoUrl,
          photoBase64: ePhotoUrl ? ReportImageResolver.resolveToBase64(ePhotoUrl, ePhotoRot) : undefined,
        });

        // Thu thập ảnh cấu kiện kết cấu (Cấu kiện E - Ảnh dọc)
        // Bản đồ liên kết URL ảnh bối cảnh với mã khuyết tật cụ thể của cấu kiện
        const eDefectContextMap = new Map<string, string>();
        for (const d of eDefects) {
          const dCode = d.defectCode || 'D-01';
          const dCtx = (d.contextPhotoUrl || d.ctxPhotoUrl || '').trim();
          if (dCtx) eDefectContextMap.set(dCtx, dCode);
        }
        if (eDefects.length > 0 && e.ctxPhotoUrl) {
          const cleanECtx = e.ctxPhotoUrl.trim();
          if (!eDefectContextMap.has(cleanECtx)) {
            eDefectContextMap.set(cleanECtx, eDefects.map((d: any) => d.defectCode || 'D-01').join(', '));
          }
        }

        if (Array.isArray(e.overviewPhotos)) {
          e.overviewPhotos.forEach((item: any, idx: number) => {
            const url = typeof item === 'string' ? item : item?.url;
            if (!url) return;
            const cleanUrl = url.trim();
            const matchingDefectCode = eDefectContextMap.get(cleanUrl);
            const isDefectPhoto = Boolean(matchingDefectCode);

            const captionVi = isDefectPhoto
              ? `Vị trí bối cảnh khuyết tật [${matchingDefectCode}] - Cấu kiện ${eMatVi} (${eCode})`
              : `Ảnh tổng thể cấu kiện ${eMatVi} (${eCode}) - góc ${idx + 1}`;
            const captionEn = isDefectPhoto
              ? `Defect context location [${matchingDefectCode}] - Member ${eMatEn} (${eCode})`
              : (/^structural member/i.test(eMatEn) ? `${eMatEn} (${eCode}) - angle ${idx + 1}` : `Structural member - ${eMatEn} (${eCode}) - angle ${idx + 1}`);

            const eOvExplicitRot =
              rotMap[`${baseEKey}_ov_${idx}`] ??
              rotMap[`elem_f${fIdx}_e${eCode}_ov_${idx}`] ??
              rotMap[`${baseEKey}_ctx`] ??
              rotMap[cleanUrl];
            addPhotoIfUnique(
              url,
              eCode,
              eRoomVi,
              eRoomEn,
              !isDefectPhoto,
              captionVi,
              captionEn,
              item?.photoCode,
              true,
              isDefectPhoto
                ? { vi: `Bối cảnh khuyết tật [${matchingDefectCode}]`, en: `Defect context [${matchingDefectCode}]` }
                : { vi: 'Tổng thể cấu kiện', en: 'Member overview' },
              item?.capturedAt || item?.shot_at,
              eOvExplicitRot
            );
          });
        }
        if (e.ctxPhotoUrl) {
          const cleanECtx = e.ctxPhotoUrl.trim();
          const matchingDefectCode = eDefectContextMap.get(cleanECtx) || (eDefects.length > 0 ? eDefects[0]?.defectCode || 'D-01' : undefined);
          const isDefectPhoto = Boolean(matchingDefectCode);

          const eCtxExplicitRot =
            e.ctxRotation ??
            rotMap[`${baseEKey}_ctx`] ??
            rotMap[`elem_f${fIdx}_e${eCode}_ctx`] ??
            rotMap[`element_f${fIdx}_e${eCode}_ctx`] ??
            rotMap[`element_${e.id || eCode}_ctx`] ??
            rotMap[cleanECtx];
          addPhotoIfUnique(
            e.ctxPhotoUrl,
            eCode,
            eRoomVi,
            eRoomEn,
            !isDefectPhoto,
            isDefectPhoto
              ? `Vị trí bối cảnh khuyết tật [${matchingDefectCode}] - Cấu kiện ${eMatVi} (${eCode})`
              : `Hiện trạng cấu kiện ${eMatVi} (${eCode})`,
            isDefectPhoto
              ? `Defect context location [${matchingDefectCode}] - Member ${eMatEn} (${eCode})`
              : `Condition of ${eMatEn} (${eCode})`,
            e.ctxPhotoCode,
            true,
            isDefectPhoto
              ? { vi: `Bối cảnh khuyết tật [${matchingDefectCode}]`, en: `Defect context [${matchingDefectCode}]` }
              : { vi: 'Cấu kiện ổn định', en: 'Stable member' },
            (e as any).ctxCapturedAt || (e as any).capturedAt,
            eCtxExplicitRot
          );
        }
      }

      // 4. Phân cụm ảnh: Tách riêng ảnh phòng (Vùng Z) và ảnh cấu kiện (Cột/Dầm E)
      // Bố cục chuẩn: Sắp xếp các ảnh chụp ngang (Landscape) hiển thị trước, các ảnh chụp dọc (Portrait) hiển thị sau
      // để trong cùng 1 hàng 2 cột A4, các ảnh luôn đồng nhất tỷ lệ & chiều cao, triệt tiêu khoảng trống sole
      const sortLandscapeFirst = (items: RoomOverviewPhotoItem[]): RoomOverviewPhotoItem[] => {
        const landscapes = items.filter((it) => !isPortraitImage(it.base64 || it.url || ''));
        const portraits = items.filter((it) => isPortraitImage(it.base64 || it.url || ''));
        return [...landscapes, ...portraits];
      };

      const PHOTOS_PER_OVERVIEW_PAGE = 4;
      const buildBalancedPages = (items: RoomOverviewPhotoItem[]): FloorOverviewPageViewModel[] => {
        // Ảnh bối cảnh khuyết tật đã nằm trong cặp ảnh của Phụ lục 1 -> Phụ lục 2 chỉ lưu ảnh không nứt
        const archivalOnly = items.filter((it) => it.statusBadge?.isNormal !== false);
        const sortedItems = sortLandscapeFirst(archivalOnly);

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
      };
      const overviewPages: FloorOverviewPageViewModel[] = buildBalancedPages(roomOverviewPhotos);
      const elementOverviewPages: FloorOverviewPageViewModel[] = buildBalancedPages(elementOverviewPhotos);

      // Độ võng dầm sàn của tầng
      const beamDeflectionMm = fl.beamDeflectionMm || 0.0;
      const hasDefects = defectSummaryRows.length > 0;

      // Phân trang danh mục khuyết tật: Tách sang các Sheet riêng biệt (12 dòng/trang) ngay sau trang CAD Hero
      const hasSeparateDefectTableSheets = defectSummaryRows.length > 0;
      const defectSummaryPages: Array<{ pageIndex: number; totalPages: number; rows: FloorDefectSummaryRow[] }> = [];
      if (hasSeparateDefectTableSheets) {
        const ROWS_PER_PAGE = 12;
        const totalTablePages = Math.ceil(defectSummaryRows.length / ROWS_PER_PAGE);
        for (let i = 0; i < defectSummaryRows.length; i += ROWS_PER_PAGE) {
          defectSummaryPages.push({
            pageIndex: Math.floor(i / ROWS_PER_PAGE) + 1,
            totalPages: totalTablePages,
            rows: defectSummaryRows.slice(i, i + ROWS_PER_PAGE),
          });
        }
      }

      // Phân trang ảnh khuyết tật:
      // - Khuyết tật có 3 ảnh (hasExtraCloseUp): chiếm trọn 1 trang A4 riêng biệt (weight = 2)
      // - Cặp 2 ảnh thông thường (hasExtraCloseUp === false): 2 cặp / trang A4 (weight = 1)
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
