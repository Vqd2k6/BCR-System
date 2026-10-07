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
    rawSurveyDate: any = null
  ): FloorPlanDefectReport[] {
    const results: FloorPlanDefectReport[] = [];

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
      const damageMapUrl = fl.damageMapUrl || fl.cadSketchPhotoUrl || fl.cad_drawing_url || fl.cadArchUrl || fl.cadDrawingUrl || '';
      const damageMapBase64 = damageMapUrl ? ReportImageResolver.resolveToBase64(damageMapUrl) : undefined;
      const explicitStructuralMapUrl = fl.structuralMapUrl || fl.cadStructuralSketchPhotoUrl || fl.cad_structural_drawing_url || fl.cadStructuralDrawingUrl || '';
      const hasStructuralCadMap = Boolean(explicitStructuralMapUrl && explicitStructuralMapUrl !== damageMapUrl);
      const structuralMapUrl = hasStructuralCadMap ? explicitStructuralMapUrl : '';
      const structuralMapBase64 = hasStructuralCadMap && structuralMapUrl ? ReportImageResolver.resolveToBase64(structuralMapUrl) : undefined;
      const hasCadMap = Boolean(damageMapBase64 || damageMapUrl || structuralMapBase64 || structuralMapUrl);

      const hasStructuralElements = fl.hasStructuralElements !== false;
      const noStructuralElementsReason = !hasStructuralElements
        ? {
            vi: fl.noStructuralElementsReason || 'Tầng/mái không bố trí cấu kiện kết cấu chịu lực riêng biệt (mái tôn, giàn thép nhẹ).',
            en: fl.noStructuralElementsReasonEn || 'Floor/roof has no separate load-bearing structural members (lightweight steel frame, sheet metal roof).',
          }
        : undefined;

      // 2. Thu thập các điểm ghim Vùng Z và Cấu kiện E trên sơ đồ CAD (Khuyết tật D KHÔNG hiển thị trên CAD theo quy định)
      const cadPins: CadPinOverlayItem[] = [];
      const cadStructuralPins: CadPinOverlayItem[] = [];

      // Vùng Z từ fl.cadZonePins: Toạ độ chuẩn tỷ lệ % trên sơ đồ CAD kiến trúc (1:1 theo dữ liệu khảo sát)
      if (Array.isArray(fl.cadZonePins)) {
        for (const p of fl.cadZonePins) {
          if (p && p.pinX !== undefined && p.pinY !== undefined) {
            const code = p.zoneCode || p.label || 'Z';
            cadPins.push({
              id: p.id,
              code,
              label: p.label || code,
              pinX: Number(p.pinX),
              pinY: Number(p.pinY),
              type: 'ZONE',
              typeLower: 'zone',
              description: `Vùng kiến trúc ${code}`,
            });
          }
        }
      }

      // Cấu kiện E từ fl.cadElementPins: Bản vẽ kết cấu vốn là ảnh dọc, giữ nguyên tọa độ
      if (Array.isArray(fl.cadElementPins)) {
        for (const p of fl.cadElementPins) {
          if (p && p.pinX !== undefined && p.pinY !== undefined) {
            const code = p.zoneCode || p.elementCode || p.label || 'E';
            const item: CadPinOverlayItem = {
              id: p.id,
              code,
              label: p.label || code,
              pinX: Number(p.pinX),
              pinY: Number(p.pinY),
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
        statusBadgeText?: { vi: string; en: string }
      ) => {
        if (!rawUrl || typeof rawUrl !== 'string') return;
        const cleanUrl = rawUrl.trim();
        if (!cleanUrl || cleanUrl.startsWith('blob:') || seenPhotoUrls.has(cleanUrl)) return;
        seenPhotoUrls.add(cleanUrl);

        const base64 = ReportImageResolver.resolveToBase64(cleanUrl);
        photoCounter.current++;
        const photoId = photoCode || `P-${photoCounter.current.toString().padStart(2, '0')}`;
        const itemDt = extractPhotoDateTime(cleanUrl, null, rawSurveyDate);
        const mCode = photoCode || (buildingId ? `HCM_M2.[${buildingId}]_${zoneCode}_${photoId}` : photoId);

        const defaultBadgeVi = isNormal
          ? (isStructural ? '✓ Tổng thể cấu kiện' : '✓ Toàn cảnh không gian')
          : '⚠️ Ghi nhận khuyết tật';
        const defaultBadgeEn = isNormal
          ? (isStructural ? '✓ Member overview' : '✓ Space overview')
          : '⚠️ Defect observed';

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
            false
          );
        });
      }

      const defectSummaryRows: FloorDefectSummaryRow[] = [];
      const defectPairPhotos: DefectPairPhotoItem[] = [];
      const zoneAndElementConditions: FloorConditionZoneElementItem[] = [];

      let defectNo = 0;

      const rawZones = (fl.zones && fl.zones.length > 0)
        ? fl.zones
        : (Array.isArray(fl.defects) && fl.defects.length > 0)
          ? [{ zoneCode: 'Z-01', roomName: 'Khu vực khảo sát', defects: fl.defects }]
          : [];

      // Duyệt qua các vùng Z
      for (const z of rawZones) {
        const zCode = z.zoneCode || 'Z-01';
        const roomVi = z.roomName || 'Khu vực chung';
        const roomEn = z.roomNameEn || roomVi;
        const wallMatVi = z.wallMaterial || 'Chưa ghi nhận vật liệu';
        const wallMatEn = z.wallMaterialEn || (z.wallMaterial ? z.wallMaterial : 'Not recorded');

        const defects = z.defects || [];
        let maxZoneW = 0;
        let zoneConditionVi = 'Bình thường (B-0)';
        let zoneConditionEn = 'Normal (B-0)';

        photoCounter.current++;
        const pZoneLabel = `P-${photoCounter.current.toString().padStart(2, '0')}`;

        if (defects.length > 0) {
          for (const d of defects) {
            defectNo++;
            const dCode = d.defectCode || `D-${defectNo.toString().padStart(2, '0')}`;
            const w = typeof d.widthMm === 'number' ? d.widthMm : parseFloat(d.widthMm || d.widthMaxMm || '0') || 0;
            const rawL = typeof d.lengthM === 'number' ? d.lengthM : parseFloat(d.lengthM || d.lengthMm || '0') || 0;
            const l = rawL > 50 ? +(rawL / 1000).toFixed(2) : rawL;
            if (w > maxZoneW) maxZoneW = w;

            const bGrade = BurlandCalculator.calculateGradeFromCrackWidth(w);
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
              descPartsVi.push(`Phương ${d.azimuth || d.crackDirection}`);
              descPartsEn.push(`Direction ${d.azimuth || d.crackDirection}`);
            }
            const actState = d.activityState || 'S';
            const actStateDisplay = actState === 'A'
              ? { vi: 'Đang phát triển (A)', en: 'Active (A)' }
              : { vi: 'Ổn định (S)', en: 'Stable (S)' };
            descPartsVi.push(`Trạng thái: ${actStateDisplay.vi}`);
            descPartsEn.push(`Status: ${actStateDisplay.en}`);

            const cadPinRefStr = (d.pinX !== undefined && d.pinY !== undefined)
              ? `[Ghim CAD: ${dCode} tại ${zCode}]`
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

            const rawCtxBase64 = ctxUrl ? ReportImageResolver.resolveToBase64(ctxUrl) : '';
            const rawCuBase64 = cuUrl ? ReportImageResolver.resolveToBase64(cuUrl) : '';
            const rawExtraCuBase64 = extraCuUrl ? ReportImageResolver.resolveToBase64(extraCuUrl) : '';

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

          const zoneBurland = BurlandCalculator.calculateGradeFromCrackWidth(maxZoneW);
          const firstDefectCode = defects[0]?.defectCode || 'D-01';
          zoneConditionVi = `Nhẹ (B-${zoneBurland}) - ${firstDefectCode}`;
          zoneConditionEn = `Slight (B-${zoneBurland}) - ${firstDefectCode}`;
        }

        const zPhotoUrl = z.photoUrl || z.ctxPhotoUrl || (Array.isArray(z.overviewPhotos) ? z.overviewPhotos[0] : '') || '';
        zoneAndElementConditions.push({
          code: zCode,
          location: { vi: roomVi, en: roomEn },
          memberMaterial: { vi: wallMatVi, en: wallMatEn },
          condition: { vi: zoneConditionVi, en: zoneConditionEn },
          photoRefLabel: pZoneLabel,
          photoUrl: zPhotoUrl,
          photoBase64: zPhotoUrl ? ReportImageResolver.resolveToBase64(zPhotoUrl) : undefined,
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
                ? { vi: `⚠️ Bối cảnh khuyết tật [${matchingDefectCode}]`, en: `⚠️ Defect context [${matchingDefectCode}]` }
                : { vi: '✓ Toàn cảnh không gian', en: '✓ Space overview' }
            );
          });
        }
        if (z.ctxPhotoUrl) {
          const cleanZCtx = z.ctxPhotoUrl.trim();
          const matchingDefectCode = zDefectContextMap.get(cleanZCtx) || (defects.length > 0 ? defects[0]?.defectCode || 'D-01' : undefined);
          const isDefectPhoto = Boolean(matchingDefectCode);

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
              ? { vi: `⚠️ Bối cảnh khuyết tật [${matchingDefectCode}]`, en: `⚠️ Defect context [${matchingDefectCode}]` }
              : { vi: '✓ Bề mặt ổn định', en: '✓ Intact surface' }
          );
        }
      }

      // Duyệt qua các cấu kiện kết cấu E
      const elements = fl.structuralElements || [];
      for (const e of elements) {
        photoCounter.current++;
        const pElemLabel = `P-${photoCounter.current.toString().padStart(2, '0')}`;
        const eCode = e.elementCode || 'E-01';
        const eRoomVi = e.roomName || 'Khu vực chính';
        const eRoomEn = e.roomNameEn || eRoomVi;
        const eMatVi = e.materialType || e.elementType || 'Cấu kiện kết cấu';
        const eMatEn = e.materialTypeEn || 'Structural member';
        const ePhotoUrl = e.photoUrl || e.ctxPhotoUrl || '';

        const eDefects = e.defects || [];
        let maxElemW = 0;
        let elemConditionVi = 'Ổn định, nguyên vẹn';
        let elemConditionEn = 'Stable, intact';

        if (eDefects.length > 0) {
          for (const d of eDefects) {
            defectNo++;
            const dCode = d.defectCode || `D-${defectNo.toString().padStart(2, '0')}`;
            const w = typeof d.widthMm === 'number' ? d.widthMm : parseFloat(d.widthMm || d.widthMaxMm || '0') || 0;
            const rawL = typeof d.lengthM === 'number' ? d.lengthM : parseFloat(d.lengthM || d.lengthMm || '0') || 0;
            const l = rawL > 50 ? +(rawL / 1000).toFixed(2) : rawL;
            if (w > maxElemW) maxElemW = w;

            const bGrade = BurlandCalculator.calculateGradeFromCrackWidth(w);
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
              descPartsVi.push(`Phương ${d.azimuth || d.crackDirection}`);
              descPartsEn.push(`Direction ${d.azimuth || d.crackDirection}`);
            }
            const actState = d.activityState || 'S';
            const actStateDisplay = actState === 'A'
              ? { vi: 'Đang phát triển (A)', en: 'Active (A)' }
              : { vi: 'Ổn định (S)', en: 'Stable (S)' };
            descPartsVi.push(`Trạng thái: ${actStateDisplay.vi}`);
            descPartsEn.push(`Status: ${actStateDisplay.en}`);

            const cadPinRefStr = (d.pinX !== undefined && d.pinY !== undefined)
              ? `[Ghim CAD: ${dCode} tại ${eCode}]`
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

            const rawCtxBase64 = ctxUrl ? ReportImageResolver.resolveToBase64(ctxUrl) : '';
            const rawCuBase64 = cuUrl ? ReportImageResolver.resolveToBase64(cuUrl) : '';
            const rawExtraCuBase64 = extraCuUrl ? ReportImageResolver.resolveToBase64(extraCuUrl) : '';

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
              contextDateTime: extractPhotoDateTime(ctxUrl, null, rawSurveyDate),
              closeUpDateTime: extractPhotoDateTime(cuUrl, null, rawSurveyDate),
              extraCloseUpDateTime: extractPhotoDateTime(extraCuUrl, null, rawSurveyDate),

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
            });
          }

          const elemBurland = BurlandCalculator.calculateGradeFromCrackWidth(maxElemW);
          const firstDefectCode = eDefects[0]?.defectCode || 'D-01';
          elemConditionVi = `Nứt kết cấu (B-${elemBurland}) - ${firstDefectCode} (w=${maxElemW}mm)`;
          elemConditionEn = `Structural crack (B-${elemBurland}) - ${firstDefectCode} (w=${maxElemW}mm)`;
        }

        zoneAndElementConditions.push({
          code: eCode,
          location: { vi: eRoomVi, en: eRoomEn },
          memberMaterial: { vi: eMatVi, en: eMatEn },
          condition: { vi: elemConditionVi, en: elemConditionEn },
          photoRefLabel: pElemLabel,
          photoUrl: ePhotoUrl,
          photoBase64: ePhotoUrl ? ReportImageResolver.resolveToBase64(ePhotoUrl) : undefined,
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
                ? { vi: `⚠️ Bối cảnh khuyết tật [${matchingDefectCode}]`, en: `⚠️ Defect context [${matchingDefectCode}]` }
                : { vi: '✓ Tổng thể cấu kiện', en: '✓ Member overview' }
            );
          });
        }
        if (e.ctxPhotoUrl) {
          const cleanECtx = e.ctxPhotoUrl.trim();
          const matchingDefectCode = eDefectContextMap.get(cleanECtx) || (eDefects.length > 0 ? eDefects[0]?.defectCode || 'D-01' : undefined);
          const isDefectPhoto = Boolean(matchingDefectCode);

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
              ? { vi: `⚠️ Bối cảnh khuyết tật [${matchingDefectCode}]`, en: `⚠️ Defect context [${matchingDefectCode}]` }
              : { vi: '✓ Cấu kiện ổn định', en: '✓ Stable member' }
          );
        }
      }

      // 4. Phân cụm ảnh: Tách riêng ảnh phòng (Vùng Z) và ảnh cấu kiện (Cột/Dầm E)
      // Bố cục chuẩn: Sắp xếp các ảnh chụp ngang (Landscape) hiển thị trước, các ảnh chụp dọc (Portrait) hiển thị sau
      // để trong cùng 1 hàng 2 cột A4, các ảnh luôn đồng nhất tỷ lệ & chiều cao, triệt tiêu khoảng trống sole
      const sortLandscapeFirst = (items: RoomOverviewPhotoItem[]): RoomOverviewPhotoItem[] => {
        const landscapes = items.filter((it) => !isPortraitImage(it.url || ''));
        const portraits = items.filter((it) => isPortraitImage(it.url || ''));
        return [...landscapes, ...portraits];
      };

      const PHOTOS_PER_OVERVIEW_PAGE = 4;
      const buildBalancedPages = (items: RoomOverviewPhotoItem[]): FloorOverviewPageViewModel[] => {
        const sortedItems = sortLandscapeFirst(items);
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

      // Phân trang danh mục khuyết tật: Nếu > 5 khuyết tật, tách sang các Sheet riêng biệt (12 dòng/trang) để chống tràn lề A4
      const hasSeparateDefectTableSheets = defectSummaryRows.length > 5;
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

      // Phân cụm các cặp ảnh khuyết tật: 2 cặp / trang A4 để tối ưu bố cục in ấn và chống ngắt trang đơn lẻ
      const defectPairPages: Array<{ pageIndex: number; totalPages: number; pairs: DefectPairPhotoItem[] }> = [];
      const PAIRS_PER_PAGE = 2;
      const totalDefectPages = Math.ceil(defectPairPhotos.length / PAIRS_PER_PAGE) || 1;
      for (let i = 0; i < defectPairPhotos.length; i += PAIRS_PER_PAGE) {
        defectPairPages.push({
          pageIndex: Math.floor(i / PAIRS_PER_PAGE) + 1,
          totalPages: totalDefectPages,
          pairs: defectPairPhotos.slice(i, i + PAIRS_PER_PAGE),
        });
      }

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
          extraMonitoringRequired: {
            vi: 'không yêu cầu',
            en: 'not required',
          },
        },
      });
    }

    return results;
  }
}
