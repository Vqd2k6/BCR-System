/**
 * ============================================================================
 * FLOOR DEFECT MAPPER & PAIR PHOTO BINDER
 * Gom nhóm khuyết tật theo từng tầng (Phụ lục 2),
 * Ghép cặp ảnh đối chiếu (Bối cảnh vs Cận cảnh có thước đo nứt),
 * Thống kê hiện trạng vùng Z và cấu kiện E.
 * ============================================================================
 */

import {
  FloorPlanDefectReport,
  FloorDefectSummaryRow,
  DefectPairPhotoItem,
  FloorConditionZoneElementItem,
  RoomOverviewPhotoItem,
  FloorOverviewPageViewModel,
} from '../report-v2.types';
import { BurlandCalculator } from './burland-calculator';
import { ReportImageResolver } from '../services/report-image-resolver.service';

export class FloorDefectMapper {
  public static mapFloors(rawFloors: any[], photoCounter: { current: number } = { current: 5 }): FloorPlanDefectReport[] {
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

      // 1. Sơ đồ CAD hư hỏng & kết cấu (Hỗ trợ cả cadSketchPhotoUrl từ Mobile/PWA và cad_drawing_url từ CSDL)
      const damageMapUrl = fl.damageMapUrl || fl.cadSketchPhotoUrl || fl.cad_drawing_url || fl.cadArchUrl || fl.cadDrawingUrl || '';
      const damageMapBase64 = damageMapUrl ? ReportImageResolver.resolveToBase64(damageMapUrl) : undefined;
      const explicitStructuralMapUrl = fl.structuralMapUrl || fl.cadStructuralSketchPhotoUrl || fl.cad_structural_drawing_url || fl.cadStructuralDrawingUrl || '';
      const hasStructuralCadMap = Boolean(explicitStructuralMapUrl && explicitStructuralMapUrl !== damageMapUrl);
      const structuralMapUrl = hasStructuralCadMap ? explicitStructuralMapUrl : '';
      const structuralMapBase64 = hasStructuralCadMap && structuralMapUrl ? ReportImageResolver.resolveToBase64(structuralMapUrl) : undefined;

      // 2. Thu thập ảnh tổng thể các phòng và gom khuyết tật
      const floorOverviewPhotos: RoomOverviewPhotoItem[] = [];
      const seenPhotoUrls = new Set<string>();

      const addPhotoIfUnique = (
        rawUrl: string | undefined | null,
        zoneCode: string,
        roomVi: string,
        roomEn: string,
        isNormal: boolean,
        captionVi?: string,
        captionEn?: string
      ) => {
        if (!rawUrl || typeof rawUrl !== 'string') return;
        const cleanUrl = rawUrl.trim();
        if (!cleanUrl || cleanUrl.startsWith('blob:') || seenPhotoUrls.has(cleanUrl)) return;
        seenPhotoUrls.add(cleanUrl);

        const base64 = ReportImageResolver.resolveToBase64(cleanUrl);
        photoCounter.current++;
        const photoId = `P-${photoCounter.current.toString().padStart(2, '0')}`;

        floorOverviewPhotos.push({
          photoId,
          zoneCode,
          roomName: { vi: roomVi, en: roomEn },
          url: cleanUrl,
          base64: base64 && !base64.startsWith('blob:') ? base64 : undefined,
          caption: {
            vi: captionVi || `Hiện trạng không gian ${roomVi} (${zoneCode})`,
            en: captionEn || `Condition of ${roomEn} (${zoneCode})`,
          },
          statusBadge: {
            isNormal,
            text: isNormal
              ? { vi: '✓ Bình thường / Ổn định', en: '✓ Normal / Stable' }
              : { vi: '⚠️ Ghi nhận khuyết tật', en: '⚠️ Defect observed' },
          },
        });
      };

      // Thu thập ảnh toàn cảnh tầng (nếu có fl.overviewPhotos)
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
            `Floor ${flNameEn} overall view (angle ${idx + 1})`
          );
        });
      }

      const defectSummaryRows: FloorDefectSummaryRow[] = [];
      const defectPairPhotos: DefectPairPhotoItem[] = [];
      const zoneAndElementConditions: FloorConditionZoneElementItem[] = [];

      let defectNo = 0;

      // Hỗ trợ cả cấu trúc zones lồng nhau hoặc defects trực tiếp trên floor
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
        const wallMatVi = z.wallMaterial || 'Tường gạch trát vữa quét vôi';
        const wallMatEn = z.wallMaterialEn || 'Plastered, lime-washed brick wall';

        const defects = z.defects || [];
        let maxZoneW = 0;
        let zoneConditionVi = 'Bình thường (B-0)';
        let zoneConditionEn = 'Normal (B-0)';

        // Tăng photo index cho ảnh zone nếu có
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

            const typeVi = d.defectType || 'Nứt ziczac mạch vữa';
            const typeEn = d.defectTypeEn || 'Finish crack (zigzag)';

            const descPartsVi: string[] = [];
            const descPartsEn: string[] = [];
            if (d.azimuth || d.crackDirection) {
              descPartsVi.push(`Phương ${d.azimuth || d.crackDirection}`);
              descPartsEn.push(`Direction ${d.azimuth || d.crackDirection}`);
            }
            if (d.repairStatus) {
              descPartsVi.push(d.repairStatus);
              descPartsEn.push(d.repairStatus);
            } else {
              descPartsVi.push('Trạng thái: chưa rõ');
              descPartsEn.push('Status: unknown');
            }

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
            });

            // Cặp ảnh đối chiếu (Context & Close-up với thước đo nứt)
            const cuUrl = d.closeUpPhotoUrl || d.cuPhotoUrl || (Array.isArray(d.cuPhotos) ? d.cuPhotos[0] : '') || '';
            const ctxUrl = d.contextPhotoUrl || d.ctxPhotoUrl || z.ctxPhotoUrl || (Array.isArray(z.overviewPhotos) ? z.overviewPhotos[0] : '') || '';

            // Ảnh cận cảnh thứ 2 (ảnh macro có thước đo nứt chuyên dụng)
            const extraCuUrl = (Array.isArray(d.cuPhotos) && d.cuPhotos.length > 1 ? d.cuPhotos[1] : undefined) ||
              d.extraPhotoUrl || d.extraCuPhotoUrl || undefined;

            const dimVi = (w > 0 || l > 0) ? `wmax = ${w} mm, L = ${l} m` : 'Khuyết tật bề mặt (bong tróc/ẩm mốc)';
            const dimEn = (w > 0 || l > 0) ? `wmax = ${w} mm, L = ${l} m` : 'Surface defect (spalling/dampness)';

            const rawCtxBase64 = ctxUrl ? ReportImageResolver.resolveToBase64(ctxUrl) : '';
            const rawCuBase64 = cuUrl ? ReportImageResolver.resolveToBase64(cuUrl) : '';
            const rawExtraCuBase64 = extraCuUrl ? ReportImageResolver.resolveToBase64(extraCuUrl) : '';

            const resolvedCtxBase64 = rawCtxBase64 && !rawCtxBase64.startsWith('blob:') ? rawCtxBase64 : undefined;
            const resolvedCuBase64 = rawCuBase64 && !rawCuBase64.startsWith('blob:') ? rawCuBase64 : undefined;
            const resolvedExtraCuBase64 = rawExtraCuBase64 && !rawExtraCuBase64.startsWith('blob:') ? rawExtraCuBase64 : undefined;

            defectPairPhotos.push({
              defectId: dCode,
              defectType: { vi: typeVi, en: typeEn },
              contextPhotoUrl: (ctxUrl && !ctxUrl.startsWith('blob:')) ? ctxUrl : undefined,
              contextPhotoBase64: resolvedCtxBase64,
              contextCaption: {
                vi: `${typeVi}-${dCode} (bối cảnh / context): Tường ${zCode} ${roomVi}`,
                en: `${typeEn}-${dCode} (context): Wall ${zCode} ${roomEn}`,
              },
              closeUpPhotoUrl: (cuUrl && !cuUrl.startsWith('blob:')) ? cuUrl : undefined,
              closeUpPhotoBase64: resolvedCuBase64,
              closeUpCaption: {
                vi: `${typeVi}-${dCode} (cận cảnh / close-up): ${dimVi}`,
                en: `${typeEn}-${dCode} (close-up): ${dimEn}`,
              },
              hasCrackGauge: Boolean(d.hasCrackGauge ?? d.hasScaleCard ?? true),
              wmaxMm: w,
              lengthM: l,
              extraCloseUpPhotoUrl: (extraCuUrl && !extraCuUrl.startsWith('blob:')) ? extraCuUrl : undefined,
              extraCloseUpPhotoBase64: resolvedExtraCuBase64,
              extraCloseUpCaption: extraCuUrl ? {
                vi: `${typeVi}-${dCode} (thước đo chi tiết / crack gauge): wmax = ${w} mm`,
                en: `${typeEn}-${dCode} (macro crack gauge): wmax = ${w} mm`,
              } : undefined,
              hasExtraCloseUp: Boolean(extraCuUrl),
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

        // Thu thập toàn bộ ảnh tổng thể phòng và bối cảnh phòng làm bằng chứng khảo sát
        if (Array.isArray(z.overviewPhotos)) {
          z.overviewPhotos.forEach((item: any, idx: number) => {
            const url = typeof item === 'string' ? item : item?.url;
            addPhotoIfUnique(
              url,
              zCode,
              roomVi,
              roomEn,
              defects.length === 0,
              `Ảnh tổng thể không gian ${roomVi} (${zCode}) - góc ${idx + 1}`,
              `Overall view of ${roomEn} (${zCode}) - angle ${idx + 1}`
            );
          });
        }
        if (z.ctxPhotoUrl) {
          addPhotoIfUnique(
            z.ctxPhotoUrl,
            zCode,
            roomVi,
            roomEn,
            defects.length === 0,
            `Hiện trạng bề mặt tường ${roomVi} (${zCode})`,
            `Surface condition of ${roomEn} (${zCode})`
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
        const eMatVi = e.materialType || e.elementType || 'Cột BTCT đổ toàn khối';
        const eMatEn = e.materialTypeEn || 'Cast-in-situ RC column';
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

            const typeVi = d.defectType || 'Nứt dọc thân cột bê tông';
            const typeEn = d.defectTypeEn || 'Structural crack in concrete member';

            const descPartsVi: string[] = [];
            const descPartsEn: string[] = [];
            if (d.notes) {
              descPartsVi.push(d.notes);
              descPartsEn.push(d.notes);
            }
            if (d.azimuth || d.crackDirection) {
              descPartsVi.push(`Phương ${d.azimuth || d.crackDirection}`);
              descPartsEn.push(`Direction ${d.azimuth || d.crackDirection}`);
            }

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
            });

            // Cặp ảnh đối chiếu của cấu kiện E
            const cuUrl = d.closeUpPhotoUrl || d.cuPhotoUrl || (Array.isArray(d.cuPhotos) ? d.cuPhotos[0] : '') || '';
            const ctxUrl = d.contextPhotoUrl || d.ctxPhotoUrl || e.ctxPhotoUrl || (Array.isArray(e.overviewPhotos) ? e.overviewPhotos[0] : '') || '';
            const extraCuUrl = (Array.isArray(d.cuPhotos) && d.cuPhotos.length > 1 ? d.cuPhotos[1] : undefined) ||
              d.extraPhotoUrl || d.extraCuPhotoUrl || undefined;

            const dimVi = (w > 0 || l > 0) ? `wmax = ${w} mm, L = ${l} m` : 'Khuyết tật cấu kiện kết cấu';
            const dimEn = (w > 0 || l > 0) ? `wmax = ${w} mm, L = ${l} m` : 'Structural element defect';

            const rawCtxBase64 = ctxUrl ? ReportImageResolver.resolveToBase64(ctxUrl) : '';
            const rawCuBase64 = cuUrl ? ReportImageResolver.resolveToBase64(cuUrl) : '';
            const rawExtraCuBase64 = extraCuUrl ? ReportImageResolver.resolveToBase64(extraCuUrl) : '';

            defectPairPhotos.push({
              defectId: dCode,
              defectType: { vi: typeVi, en: typeEn },
              contextPhotoUrl: (ctxUrl && !ctxUrl.startsWith('blob:')) ? ctxUrl : undefined,
              contextPhotoBase64: rawCtxBase64 && !rawCtxBase64.startsWith('blob:') ? rawCtxBase64 : undefined,
              contextCaption: {
                vi: `${typeVi}-${dCode} (bối cảnh / context): Cấu kiện ${eCode} ${eRoomVi}`,
                en: `${typeEn}-${dCode} (context): Member ${eCode} ${eRoomEn}`,
              },
              closeUpPhotoUrl: (cuUrl && !cuUrl.startsWith('blob:')) ? cuUrl : undefined,
              closeUpPhotoBase64: rawCuBase64 && !rawCuBase64.startsWith('blob:') ? rawCuBase64 : undefined,
              closeUpCaption: {
                vi: `${typeVi}-${dCode} (cận cảnh / close-up): ${dimVi}`,
                en: `${typeEn}-${dCode} (close-up): ${dimEn}`,
              },
              hasCrackGauge: Boolean(d.hasCrackGauge ?? d.hasScaleCard ?? true),
              wmaxMm: w,
              lengthM: l,
              extraCloseUpPhotoUrl: (extraCuUrl && !extraCuUrl.startsWith('blob:')) ? extraCuUrl : undefined,
              extraCloseUpPhotoBase64: rawExtraCuBase64 && !rawExtraCuBase64.startsWith('blob:') ? rawExtraCuBase64 : undefined,
              extraCloseUpCaption: extraCuUrl ? {
                vi: `${typeVi}-${dCode} (thước đo chi tiết / crack gauge): wmax = ${w} mm`,
                en: `${typeEn}-${dCode} (macro crack gauge): wmax = ${w} mm`,
              } : undefined,
              hasExtraCloseUp: Boolean(extraCuUrl),
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

        if (Array.isArray(e.overviewPhotos)) {
          e.overviewPhotos.forEach((item: any, idx: number) => {
            const url = typeof item === 'string' ? item : item?.url;
            addPhotoIfUnique(
              url,
              eCode,
              eRoomVi,
              eRoomEn,
              eDefects.length === 0,
              `Ảnh tổng thể cấu kiện ${eMatVi} (${eCode})`,
              `Structural member ${eMatEn} (${eCode})`
            );
          });
        }
        if (e.ctxPhotoUrl) {
          addPhotoIfUnique(
            e.ctxPhotoUrl,
            eCode,
            eRoomVi,
            eRoomEn,
            eDefects.length === 0,
            `Hiện trạng cấu kiện ${eMatVi} (${eCode})`,
            `Condition of ${eMatEn} (${eCode})`
          );
        }
      }

      // Phân cụm ảnh tổng thể các phòng: 6 ảnh / trang A4 (Grid 3x2)
      const overviewPages: FloorOverviewPageViewModel[] = [];
      const PHOTOS_PER_OVERVIEW_PAGE = 6;
      const totalOverviewPages = Math.ceil(floorOverviewPhotos.length / PHOTOS_PER_OVERVIEW_PAGE);

      for (let i = 0; i < floorOverviewPhotos.length; i += PHOTOS_PER_OVERVIEW_PAGE) {
        overviewPages.push({
          pageIndexInFloor: Math.floor(i / PHOTOS_PER_OVERVIEW_PAGE) + 1,
          totalOverviewPagesInFloor: totalOverviewPages,
          photos: floorOverviewPhotos.slice(i, i + PHOTOS_PER_OVERVIEW_PAGE),
        });
      }

      // Độ võng dầm sàn của tầng
      const beamDeflectionMm = fl.beamDeflectionMm || 0.0;
      const hasDefects = defectSummaryRows.length > 0;

      // Phân cụm các cặp ảnh khuyết tật: Mỗi trang A4 chứa tối đa 2 cặp ảnh để chống tràn trang
      const defectPairPages: Array<{ pageIndex: number; pairs: DefectPairPhotoItem[] }> = [];
      const PAIRS_PER_PAGE = 2;
      for (let i = 0; i < defectPairPhotos.length; i += PAIRS_PER_PAGE) {
        defectPairPages.push({
          pageIndex: Math.floor(i / PAIRS_PER_PAGE) + 1,
          pairs: defectPairPhotos.slice(i, i + PAIRS_PER_PAGE),
        });
      }

      results.push({
        floorOrder: floorIndex,
        floorName: { vi: flNameVi, en: flNameEn },
        damageMapUrl,
        damageMapBase64,
        structuralMapUrl,
        structuralMapBase64,
        hasStructuralCadMap,
        hasDefects,
        zeroDefectsNotice: hasDefects ? undefined : {
          vi: 'Khảo sát hiện trường không phát hiện vết nứt, biến dạng hoặc khuyết tật kết cấu trên mặt bằng tầng.',
          en: 'Field survey recorded no cracks, deformation or structural defects on this floor plan.',
        },
        defectSummaryRows,
        defectPairPhotos,
        defectPairPages,
        overviewPages,
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
