/**
 * ============================================================================
 * ELEMENT DEFECT MAPPER (APPENDIX 2 SUB-MODULE)
 * Khảo sát các cấu kiện kết cấu E (Cột/Dầm/Sàn) và ghép cặp ảnh khuyết tật.
 * ============================================================================
 */

import {
  FloorDefectSummaryRow,
  DefectPairPhotoItem,
  FloorConditionZoneElementItem,
} from '../../../report.types';
import { ReportImageResolver } from '../../../services/report-image-resolver.service';
import { Section7BurlandMapper } from '../../sections/section-7-burland.mapper';
import { extractPhotoDateTime } from '../../formatters.mapper';
import { isPhotoAlreadyWatermarked } from './cad-pin.mapper';
import { AddUniqueOverviewPhotoFn } from './floor-overview-pagination.mapper';

export function mapFloorStructuralElements(
  fl: any,
  fIdx: number,
  flNameVi: string,
  flNameEn: string,
  photoCounter: { current: number },
  defectCounter: { current: number },
  rawSurveyDate: any,
  rotMap: Record<string, number>,
  addPhotoIfUnique: AddUniqueOverviewPhotoFn,
  defectSummaryRows: FloorDefectSummaryRow[],
  defectPairPhotos: DefectPairPhotoItem[],
  zoneAndElementConditions: FloorConditionZoneElementItem[]
): void {
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
    const eId = e.id ? String(e.id) : '';
    const baseEKey = eId ? (eId.startsWith('elem_') ? eId : `elem_${eId}`) : `elem_f${fIdx}_e${eCode}`;

    const eDefects = (e.defects || []).filter((d: any) => !d?.isDeleted && !d?.is_deleted);
    let maxElemW = 0;
    let elemConditionVi = 'Ổn định, nguyên vẹn';
    let elemConditionEn = 'Stable, intact';

    if (eDefects.length > 0) {
      const usedElemDefectCodes = new Set<string>();
      for (let edIdx = 0; edIdx < eDefects.length; edIdx++) {
        const d = eDefects[edIdx];
        defectCounter.current++;
        let dCode = d.defectCode || d.defect_code;
        if (!dCode || usedElemDefectCodes.has(dCode)) {
          dCode = `D-${(edIdx + 1).toString().padStart(2, '0')}`;
        }
        usedElemDefectCodes.add(dCode);
        const w = typeof d.widthMm === 'number' ? d.widthMm : parseFloat(d.widthMm || d.widthMaxMm || '0') || 0;
        const l = typeof d.lengthM === 'number' ? d.lengthM : parseFloat(d.lengthM || d.lengthMm || '0') || 0;
        if (w > maxElemW) maxElemW = w;

        const savedElemGrade = (d.burlandGrade !== undefined && d.burlandGrade !== null && d.burlandGrade !== '' && !isNaN(Number(d.burlandGrade)))
          ? Number(d.burlandGrade)
          : null;
        const bGrade = savedElemGrade ?? 0;
        const bCatVi = Section7BurlandMapper.getBurlandGradeLabelVi(savedElemGrade);
        const bCatEn = Section7BurlandMapper.getBurlandGradeLabelEn(savedElemGrade);

        const typeVi = d.defectType || 'Nứt dọc thân cấu kiện kết cấu';
        const typeEn = d.defectTypeEn || 'Structural crack in concrete member';

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

        const cadPinRefStr = (d.pinX !== undefined && d.pinY !== undefined) ? `Ghim CAD: ${dCode} tại ${eCode}` : undefined;

        defectSummaryRows.push({
          no: defectCounter.current,
          defectId: dCode,
          location: { vi: `${flNameVi} - Cấu kiện ${eCode} (${eMatVi}), ${eRoomVi}`, en: `${flNameEn} - Member ${eCode} (${eMatEn}), ${eRoomEn}` },
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

        const rawCu0 = Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0 ? d.cuPhotos[0] : '';
        const cuUrl = d.closeUpPhotoUrl || d.cuPhotoUrl || (typeof rawCu0 === 'string' ? rawCu0 : rawCu0?.url) || '';
        const rawCtx0 = Array.isArray(e.overviewPhotos) && e.overviewPhotos.length > 0 ? e.overviewPhotos[0] : '';
        const ctxUrl = d.contextPhotoUrl || d.ctxPhotoUrl || e.ctxPhotoUrl || (typeof rawCtx0 === 'string' ? rawCtx0 : rawCtx0?.url) || '';
        const rawCu1 = Array.isArray(d.cuPhotos) && d.cuPhotos.length > 1 ? d.cuPhotos[1] : undefined;
        const extraCuUrl = (typeof rawCu1 === 'string' ? rawCu1 : rawCu1?.url) || d.extraPhotoUrl || d.extraCuPhotoUrl || undefined;

        const dimVi = (w > 0 || l > 0) ? `wmax = ${w} mm, L = ${l} m` : 'Khuyết tật cấu kiện kết cấu';
        const dimEn = (w > 0 || l > 0) ? `wmax = ${w} mm, L = ${l} m` : 'Structural element defect';

        const ctxRot = d.ctxRotation ?? e.ctxRotation ?? rotMap[`${baseEKey}_ctx`] ?? rotMap[`elem_f${fIdx}_e${eCode}_ctx`] ?? rotMap[`element_f${fIdx}_e${eCode}_ctx`] ?? rotMap[`element_${e.id || eCode}_ctx`] ?? rotMap[`${baseEKey}_ov_0`] ?? rotMap[eCode] ?? rotMap[ctxUrl] ?? 0;
        const cuRot = d.cuRotation ?? rotMap[`defect_${d.id}_cu`] ?? rotMap[`defect_${d.id}_cu_0`] ?? rotMap[`defect_f${fIdx}_e${eCode}_${d.id}_cu`] ?? rotMap[`defect_f${fIdx}_e${eCode}_${d.id}_cu_0`] ?? rotMap[`defect_f${fIdx}_e${eCode}_d${dCode}_cu`] ?? rotMap[`defect_f${fIdx}_e${eCode}_d${dCode}_cu_0`] ?? rotMap[`defect_${d.id || dCode}_cu`] ?? rotMap[dCode] ?? rotMap[cuUrl] ?? 0;
        const extraCuRot = d.extraCuRotation ?? rotMap[`defect_${d.id}_cu_1`] ?? rotMap[`defect_f${fIdx}_e${eCode}_${d.id}_cu_1`] ?? rotMap[`defect_f${fIdx}_e${eCode}_d${dCode}_cu_1`] ?? rotMap[`defect_f${fIdx}_e${eCode}_${d.id}_extra_cu`] ?? rotMap[`defect_f${fIdx}_e${eCode}_d${dCode}_extra_cu`] ?? rotMap[`defect_${d.id || dCode}_extra_cu`] ?? (extraCuUrl ? rotMap[extraCuUrl] : undefined) ?? 0;

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
          contextCaption: { vi: `${typeVi}-${dCode} (bối cảnh / context): Cấu kiện ${eCode} ${eRoomVi}`, en: `${typeEn}-${dCode} (context): Member ${eCode} ${eRoomEn}` },
          contextAlreadyWatermarked: isPhotoAlreadyWatermarked(ctxUrl),
          contextPhotoCode: e.ctxPhotoCode || `${eCode}_CTX`,
          contextDateTime: extractPhotoDateTime(ctxUrl, (e as any).ctxCapturedAt || (e as any).ctx_captured_at || (e as any).capturedAt, rawSurveyDate),
          closeUpDateTime: extractPhotoDateTime(cuUrl, d.capturedAt || d.cuPhotoTimestamps?.[0] || (d as any).shot_at, rawSurveyDate),
          extraCloseUpDateTime: extractPhotoDateTime(extraCuUrl, d.cuPhotoTimestamps?.[1], rawSurveyDate),
          closeUpPhotoUrl: (cuUrl && !cuUrl.startsWith('blob:')) ? cuUrl : undefined,
          closeUpPhotoBase64: rawCuBase64 && !rawCuBase64.startsWith('blob:') ? rawCuBase64 : undefined,
          closeUpCaption: { vi: `${typeVi}-${dCode} (cận cảnh / close-up): ${dimVi}`, en: `${typeEn}-${dCode} (close-up): ${dimEn}` },
          closeUpAlreadyWatermarked: isPhotoAlreadyWatermarked(cuUrl),
          closeUpPhotoCode: cuPhotoCode,
          hasCrackGauge: Boolean(d.hasCrackGauge ?? d.hasScaleCard ?? true),
          wmaxMm: w,
          lengthM: l,
          extraCloseUpPhotoUrl: (extraCuUrl && !extraCuUrl.startsWith('blob:')) ? extraCuUrl : undefined,
          extraCloseUpPhotoBase64: rawExtraCuBase64 && !rawExtraCuBase64.startsWith('blob:') ? rawExtraCuBase64 : undefined,
          extraCloseUpCaption: extraCuUrl ? { vi: `${typeVi}-${dCode} (thước đo chi tiết / crack gauge): wmax = ${w} mm`, en: `${typeEn}-${dCode} (macro crack gauge): wmax = ${w} mm` } : undefined,
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

      const firstDefectCode = eDefects[0]?.defectCode || 'D-01';
      elemConditionVi = `Nứt kết cấu - ${firstDefectCode}${maxElemW > 0 ? ` (w=${maxElemW}mm)` : ''}`;
      elemConditionEn = `Structural crack - ${firstDefectCode}${maxElemW > 0 ? ` (w=${maxElemW}mm)` : ''}`;
    }

    const ePhotoRot = e.photoRotation ?? rotMap[`${baseEKey}_ctx`] ?? rotMap[`elem_f${fIdx}_e${eCode}_ctx`] ?? rotMap[`element_f${fIdx}_e${eCode}_ctx`] ?? rotMap[`element_${e.id || eCode}_ctx`] ?? rotMap[`element_${e.id || eCode}_photo`] ?? rotMap[eCode] ?? rotMap[ePhotoUrl] ?? 0;
    zoneAndElementConditions.push({
      code: eCode,
      location: { vi: eRoomVi, en: eRoomEn },
      memberMaterial: { vi: eMatVi, en: eMatEn },
      condition: { vi: elemConditionVi, en: elemConditionEn },
      photoRefLabel: pElemLabel,
      photoUrl: ePhotoUrl,
      photoBase64: ePhotoUrl ? ReportImageResolver.resolveToBase64(ePhotoUrl, ePhotoRot) : undefined,
    });

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
        const eOvExplicitRot = rotMap[`${baseEKey}_ov_${idx}`] ?? rotMap[`elem_f${fIdx}_e${eCode}_ov_${idx}`] ?? rotMap[`${baseEKey}_ctx`] ?? rotMap[cleanUrl];
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
          isDefectPhoto ? { vi: `Bối cảnh khuyết tật [${matchingDefectCode}]`, en: `Defect context [${matchingDefectCode}]` } : { vi: 'Tổng thể cấu kiện', en: 'Member overview' },
          item?.capturedAt || item?.shot_at,
          eOvExplicitRot
        );
      });
    }
    if (e.ctxPhotoUrl) {
      const cleanECtx = e.ctxPhotoUrl.trim();
      const matchingDefectCode = eDefectContextMap.get(cleanECtx) || (eDefects.length > 0 ? eDefects[0]?.defectCode || 'D-01' : undefined);
      const isDefectPhoto = Boolean(matchingDefectCode);
      const eCtxExplicitRot = e.ctxRotation ?? rotMap[`${baseEKey}_ctx`] ?? rotMap[`elem_f${fIdx}_e${eCode}_ctx`] ?? rotMap[`element_f${fIdx}_e${eCode}_ctx`] ?? rotMap[`element_${e.id || eCode}_ctx`] ?? rotMap[cleanECtx];
      addPhotoIfUnique(
        e.ctxPhotoUrl,
        eCode,
        eRoomVi,
        eRoomEn,
        !isDefectPhoto,
        isDefectPhoto ? `Vị trí bối cảnh khuyết tật [${matchingDefectCode}] - Cấu kiện ${eMatVi} (${eCode})` : `Hiện trạng cấu kiện ${eMatVi} (${eCode})`,
        isDefectPhoto ? `Defect context location [${matchingDefectCode}] - Member ${eMatEn} (${eCode})` : `Condition of ${eMatEn} (${eCode})`,
        e.ctxPhotoCode,
        true,
        isDefectPhoto ? { vi: `Bối cảnh khuyết tật [${matchingDefectCode}]`, en: `Defect context [${matchingDefectCode}]` } : { vi: 'Cấu kiện ổn định', en: 'Stable member' },
        (e as any).ctxCapturedAt || (e as any).capturedAt,
        eCtxExplicitRot
      );
    }
  }
}

