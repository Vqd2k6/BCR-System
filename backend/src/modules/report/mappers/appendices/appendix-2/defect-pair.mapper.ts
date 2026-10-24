/**
 * ============================================================================
 * DEFECT PAIR & ZONE/ELEMENT CONDITION MAPPER (APPENDIX 2 SUB-MODULE)
 * Gom nhóm khuyết tật vùng Z và cấu kiện E, ghép cặp ảnh đối chiếu (Context vs
 * Close-up), và đọc trực tiếp cấp Burland đã lưu (Zero Calculate).
 * ============================================================================
 */

import {
  FloorDefectSummaryRow,
  DefectPairPhotoItem,
  FloorConditionZoneElementItem,
} from '../../../report.types';
import { ReportImageResolver } from '../../../services/report-image-resolver.service';
import { Section7BurlandMapper } from '../../sections/section-7-burland.mapper';
import { isPhotoAlreadyWatermarked } from './cad-pin.mapper';
import { AddUniqueOverviewPhotoFn } from './floor-overview-pagination.mapper';
import { mapFloorStructuralElements } from './element-defect.mapper';

const SHORT_GRADE_VI: Record<number, string> = {
  0: 'Không đáng kể',
  1: 'Rất nhẹ',
  2: 'Nhẹ',
  3: 'Trung bình',
  4: 'Nặng',
  5: 'Rất nặng',
};

const SHORT_GRADE_EN: Record<number, string> = {
  0: 'Negligible',
  1: 'Very Slight',
  2: 'Slight',
  3: 'Moderate',
  4: 'Severe',
  5: 'Very Severe',
};

export function mapFloorZonesAndElements(
  fl: any,
  fIdx: number,
  flNameVi: string,
  flNameEn: string,
  photoCounter: { current: number },
  rawSurveyDate: any,
  rotMap: Record<string, number>,
  addPhotoIfUnique: AddUniqueOverviewPhotoFn
): {
  defectSummaryRows: FloorDefectSummaryRow[];
  defectPairPhotos: DefectPairPhotoItem[];
  zoneAndElementConditions: FloorConditionZoneElementItem[];
} {
  const defectSummaryRows: FloorDefectSummaryRow[] = [];
  const defectPairPhotos: DefectPairPhotoItem[] = [];
  const zoneAndElementConditions: FloorConditionZoneElementItem[] = [];
  const defectCounter = { current: 0 };

  const rawZones = (fl.zones && fl.zones.length > 0)
    ? fl.zones.filter((z: any) => !z?.isDeleted && !z?.is_deleted)
    : (Array.isArray(fl.defects) && fl.defects.length > 0)
      ? [{ zoneCode: 'Z-01', roomName: 'Khu vực khảo sát', defects: fl.defects.filter((d: any) => !d?.isDeleted && !d?.is_deleted) }]
      : [];

  for (const z of rawZones) {
    const zCode = z.zoneCode || 'Z-01';
    const resolvedRoom = (z.roomName === 'Khác' && z.customRoomName) ? z.customRoomName : z.roomName;
    const resolvedWallMat = (z.wallMaterial === 'Khác' && z.customWallMaterial) ? z.customWallMaterial : z.wallMaterial;
    const roomVi = resolvedRoom || 'Khu vực chung';
    const roomEn = z.roomNameEn || roomVi;
    const wallMatVi = resolvedWallMat || 'Chưa ghi nhận vật liệu';
    const wallMatEn = z.wallMaterialEn || (resolvedWallMat ? resolvedWallMat : 'Not recorded');

    const defects = (z.defects || []).filter((d: any) => !d?.isDeleted && !d?.is_deleted);
    let zoneConditionVi = 'Bình thường (B-0)';
    let zoneConditionEn = 'Normal (B-0)';

    photoCounter.current++;
    const pZoneLabel = `P-${photoCounter.current.toString().padStart(2, '0')}`;
    const zId = z.id ? String(z.id) : '';
    const baseZKey = zId ? (zId.startsWith('zone_') ? zId : `zone_${zId}`) : `zone_f${fIdx}_z${zCode}`;

    if (defects.length > 0) {
      const usedZoneDefectCodes = new Set<string>();
      for (let dIdx = 0; dIdx < defects.length; dIdx++) {
        const d = defects[dIdx];
        defectCounter.current++;
        let dCode = d.defectCode || d.defect_code;
        if (!dCode || usedZoneDefectCodes.has(dCode)) {
          dCode = `D-${(dIdx + 1).toString().padStart(2, '0')}`;
        }
        usedZoneDefectCodes.add(dCode);
        const w = typeof d.widthMm === 'number' ? d.widthMm : parseFloat(d.widthMm || d.widthMaxMm || '0') || 0;
        const l = typeof d.lengthM === 'number' ? d.lengthM : parseFloat(d.lengthM || d.lengthMm || '0') || 0;

        const savedDefectGrade = (d.burlandGrade !== undefined && d.burlandGrade !== null && d.burlandGrade !== '' && !isNaN(Number(d.burlandGrade)))
          ? Number(d.burlandGrade)
          : ((z.burlandGrade !== undefined && z.burlandGrade !== null && z.burlandGrade !== '' && !isNaN(Number(z.burlandGrade)))
            ? Number(z.burlandGrade)
            : null);
        const bGrade = savedDefectGrade ?? 0;
        const bCatVi = Section7BurlandMapper.getBurlandGradeLabelVi(savedDefectGrade);
        const bCatEn = Section7BurlandMapper.getBurlandGradeLabelEn(savedDefectGrade);

        const typeVi = d.defectType || 'Vết nứt bề mặt tường';
        const typeEn = d.defectTypeEn || 'Wall surface crack';

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

        const cadPinRefStr = (d.pinX !== undefined && d.pinY !== undefined) ? `Ghim CAD: ${dCode} tại ${zCode}` : undefined;

        defectSummaryRows.push({
          no: defectCounter.current,
          defectId: dCode,
          location: { vi: `${flNameVi} - ${roomVi}, tường ${zCode}`, en: `${flNameEn} - ${roomEn} wall ${zCode}` },
          defectType: { vi: typeVi, en: typeEn },
          widthMm: w > 0 ? `${w} mm` : '–',
          lengthM: l > 0 ? `${l} m` : '–',
          burlandDamageCategory: { vi: bCatVi, en: bCatEn },
          burlandGrade: bGrade,
          description: { vi: descPartsVi.join(', '), en: descPartsEn.join(', ') },
          cadPinRef: cadPinRefStr,
        });

        const rawCu0 = Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0 ? d.cuPhotos[0] : '';
        const cuUrl = d.closeUpPhotoUrl || d.cuPhotoUrl || (typeof rawCu0 === 'string' ? rawCu0 : rawCu0?.url) || '';
        const rawCtx0 = Array.isArray(z.overviewPhotos) && z.overviewPhotos.length > 0 ? z.overviewPhotos[0] : '';
        const ctxUrl = d.contextPhotoUrl || d.ctxPhotoUrl || z.ctxPhotoUrl || (typeof rawCtx0 === 'string' ? rawCtx0 : rawCtx0?.url) || '';
        const rawCu1 = Array.isArray(d.cuPhotos) && d.cuPhotos.length > 1 ? d.cuPhotos[1] : undefined;
        const extraCuUrl = (typeof rawCu1 === 'string' ? rawCu1 : rawCu1?.url) || d.extraPhotoUrl || d.extraCuPhotoUrl || undefined;

        const dimVi = (w > 0 || l > 0) ? `wmax = ${w} mm, L = ${l} m` : 'Khuyết tật bề mặt (bong tróc/ẩm mốc)';
        const dimEn = (w > 0 || l > 0) ? `wmax = ${w} mm, L = ${l} m` : 'Surface defect (spalling/dampness)';

        const ctxRot =
          d.ctxRotation ??
          z.ctxRotation ??
          rotMap[`${baseZKey}_ctx`] ??
          rotMap[`zone_f${fIdx}_z${zCode}_ctx`] ??
          rotMap[`floor_${fIdx}_${zCode}_ctx`] ??
          rotMap[`zone_${z.id || zCode}_ctx`] ??
          rotMap[`${zCode}_ctx`] ??
          rotMap[zCode] ??
          rotMap[ctxUrl] ??
          0;
        const cuRot = d.cuRotation ?? rotMap[`defect_${d.id}_cu`] ?? rotMap[`defect_${d.id}_cu_0`] ?? rotMap[`defect_f${fIdx}_z${zCode}_${d.id}_cu`] ?? rotMap[`defect_f${fIdx}_z${zCode}_${d.id}_cu_0`] ?? rotMap[`defect_f${fIdx}_z${zCode}_d${dCode}_cu`] ?? rotMap[`defect_f${fIdx}_z${zCode}_d${dCode}_cu_0`] ?? rotMap[`defect_${d.id || dCode}_cu`] ?? rotMap[dCode] ?? rotMap[cuUrl] ?? 0;
        const extraCuRot = d.extraCuRotation ?? rotMap[`defect_${d.id}_cu_1`] ?? rotMap[`defect_f${fIdx}_z${zCode}_${d.id}_cu_1`] ?? rotMap[`defect_f${fIdx}_z${zCode}_d${dCode}_cu_1`] ?? rotMap[`defect_f${fIdx}_z${zCode}_${d.id}_extra_cu`] ?? rotMap[`defect_f${fIdx}_z${zCode}_d${dCode}_extra_cu`] ?? rotMap[`defect_${d.id || dCode}_extra_cu`] ?? (extraCuUrl ? rotMap[extraCuUrl] : undefined) ?? 0;

        const rawCtxBase64 = ctxUrl ? ReportImageResolver.resolveToBase64(ctxUrl, ctxRot) : '';
        const rawCuBase64 = cuUrl ? ReportImageResolver.resolveToBase64(cuUrl, cuRot) : '';
        const rawExtraCuBase64 = extraCuUrl ? ReportImageResolver.resolveToBase64(extraCuUrl, extraCuRot) : '';

        const cuPhotoCode = d.cuPhotoCode || (Array.isArray(d.cuPhotoCodes) ? d.cuPhotoCodes[0] : undefined) || `${dCode}_CU_01`;
        const extraCuPhotoCode = (Array.isArray(d.cuPhotoCodes) && d.cuPhotoCodes.length > 1 ? d.cuPhotoCodes[1] : undefined) || `${dCode}_CU_02`;

        const pinX = d.pinX !== undefined ? Number(d.pinX) : (d.pin_x !== undefined ? Number(d.pin_x) : undefined);
        const pinY = d.pinY !== undefined ? Number(d.pinY) : (d.pin_y !== undefined ? Number(d.pin_y) : undefined);
        const hasPin = pinX !== undefined && pinY !== undefined && !isNaN(pinX) && !isNaN(pinY);

        defectPairPhotos.push({
          defectId: dCode,
          defectType: { vi: typeVi, en: typeEn },
          contextPhotoUrl: (ctxUrl && !ctxUrl.startsWith('blob:')) ? ctxUrl : undefined,
          contextPhotoBase64: rawCtxBase64 && !rawCtxBase64.startsWith('blob:') ? rawCtxBase64 : undefined,
          contextCaption: { vi: `${typeVi}-${dCode} (bối cảnh / context): Tường ${zCode} ${roomVi}`, en: `${typeEn}-${dCode} (context): Wall ${zCode} ${roomEn}` },
          contextAlreadyWatermarked: isPhotoAlreadyWatermarked(ctxUrl),
          contextPhotoCode: z.ctxPhotoCode || `${zCode}_CTX`,
          contextPhotoRotation: Number(ctxRot) || 0,
          closeUpPhotoUrl: (cuUrl && !cuUrl.startsWith('blob:')) ? cuUrl : undefined,
          closeUpPhotoBase64: rawCuBase64 && !rawCuBase64.startsWith('blob:') ? rawCuBase64 : undefined,
          closeUpCaption: { vi: `${typeVi}-${dCode} (cận cảnh / close-up): ${dimVi}`, en: `${typeEn}-${dCode} (close-up): ${dimEn}` },
          closeUpAlreadyWatermarked: isPhotoAlreadyWatermarked(cuUrl),
          closeUpPhotoCode: cuPhotoCode,
          closeUpPhotoRotation: Number(cuRot) || 0,
          hasCrackGauge: Boolean(d.hasCrackGauge ?? d.hasScaleCard ?? true),
          wmaxMm: w,
          lengthM: l,
          extraCloseUpPhotoUrl: (extraCuUrl && !extraCuUrl.startsWith('blob:')) ? extraCuUrl : undefined,
          extraCloseUpPhotoBase64: rawExtraCuBase64 && !rawExtraCuBase64.startsWith('blob:') ? rawExtraCuBase64 : undefined,
          extraCloseUpCaption: extraCuUrl ? { vi: `${typeVi}-${dCode} (thước đo chi tiết / crack gauge): wmax = ${w} mm`, en: `${typeEn}-${dCode} (macro crack gauge): wmax = ${w} mm` } : undefined,
          extraCloseUpAlreadyWatermarked: isPhotoAlreadyWatermarked(extraCuUrl),
          extraCloseUpPhotoCode: extraCuPhotoCode,
          extraCloseUpPhotoRotation: Number(extraCuRot) || 0,
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
        : 0;
      const firstDefectCode = defects[0]?.defectCode || 'D-01';
      zoneConditionVi = `${SHORT_GRADE_VI[zoneBurland] || '--'} (B-${zoneBurland}) - ${firstDefectCode}`;
      zoneConditionEn = `${SHORT_GRADE_EN[zoneBurland] || '--'} (B-${zoneBurland}) - ${firstDefectCode}`;
    }

    const zPhotoUrl = z.photoUrl || z.ctxPhotoUrl || (Array.isArray(z.overviewPhotos) ? z.overviewPhotos[0] : '') || '';
    const zPhotoRot =
      z.photoRotation ??
      rotMap[`${baseZKey}_ctx`] ??
      rotMap[`zone_f${fIdx}_z${zCode}_ctx`] ??
      rotMap[`floor_${fIdx}_${zCode}_ctx`] ??
      rotMap[`zone_${z.id || zCode}_ctx`] ??
      rotMap[`${zCode}_ctx`] ??
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

    if (z.ctxPhotoUrl) {
      const cleanZCtx = z.ctxPhotoUrl.trim();
      const matchingDefectCode = zDefectContextMap.get(cleanZCtx) || (defects.length > 0 ? defects[0]?.defectCode || 'D-01' : undefined);
      const isDefectPhoto = Boolean(matchingDefectCode);
      const ctxExplicitRot =
        z.ctxRotation ??
        rotMap[`${baseZKey}_ctx`] ??
        rotMap[`zone_f${fIdx}_z${zCode}_ctx`] ??
        rotMap[`floor_${fIdx}_${zCode}_ctx`] ??
        rotMap[`zone_${z.id || zCode}_ctx`] ??
        rotMap[`${zCode}_ctx`] ??
        rotMap[cleanZCtx];
      addPhotoIfUnique(
        z.ctxPhotoUrl,
        zCode,
        roomVi,
        roomEn,
        !isDefectPhoto,
        isDefectPhoto ? `Vị trí bối cảnh khuyết tật [${matchingDefectCode}] - ${roomVi} (${zCode})` : `Hiện trạng bề mặt tường ${roomVi} (${zCode})`,
        isDefectPhoto ? `Defect context location [${matchingDefectCode}] - ${roomEn} (${zCode})` : `Surface condition of ${roomEn} (${zCode})`,
        z.ctxPhotoCode,
        false,
        isDefectPhoto ? { vi: `Bối cảnh khuyết tật [${matchingDefectCode}]`, en: `Defect context [${matchingDefectCode}]` } : { vi: 'Bề mặt ổn định', en: 'Intact surface' },
        z.ctxCapturedAt || z.capturedAt,
        ctxExplicitRot
      );
    }
    if (Array.isArray(z.overviewPhotos)) {
      z.overviewPhotos.forEach((item: string | { url?: string; photoCode?: string; capturedAt?: string; shot_at?: string }, idx: number) => {
        const url = typeof item === 'string' ? item : item?.url;
        if (!url) return;
        const cleanUrl = url.trim();
        const matchingDefectCode = zDefectContextMap.get(cleanUrl);
        const isDefectPhoto = Boolean(matchingDefectCode);
        const isFirstOverview = idx === 0;
        const captionVi = isDefectPhoto
          ? `Vị trí bối cảnh khuyết tật [${matchingDefectCode}] - ${roomVi} (${zCode})`
          : (isFirstOverview ? `Ảnh không gian tổng thể ${roomVi} (${zCode})` : `Ảnh hiện trạng không gian ${roomVi} (${zCode}) - góc ${idx + 1}`);
        const captionEn = isDefectPhoto
          ? `Defect context location [${matchingDefectCode}] - ${roomEn} (${zCode})`
          : (isFirstOverview ? `Overall space view of ${roomEn} (${zCode})` : `Condition of ${roomEn} (${zCode}) - angle ${idx + 1}`);
        const ovExplicitRot =
          rotMap[`${baseZKey}_ov_${idx}`] ??
          rotMap[`zone_f${fIdx}_z${zCode}_ov_${idx}`] ??
          rotMap[`floor_${fIdx}_${zCode}_ov_${idx}`] ??
          rotMap[`zone_${z.id || zCode}_ov_${idx}`] ??
          rotMap[`${zCode}_ov_${idx}`] ??
          rotMap[cleanUrl];
        addPhotoIfUnique(
          url,
          zCode,
          roomVi,
          roomEn,
          !isDefectPhoto,
          captionVi,
          captionEn,
          typeof item === 'object' ? item?.photoCode : undefined,
          false,
          isDefectPhoto ? { vi: `Bối cảnh khuyết tật [${matchingDefectCode}]`, en: `Defect context [${matchingDefectCode}]` } : { vi: 'Toàn cảnh không gian', en: 'Space overview' },
          typeof item === 'object' ? (item?.capturedAt || item?.shot_at) : undefined,
          ovExplicitRot
        );
      });
    }
  }

  mapFloorStructuralElements(
    fl,
    fIdx,
    flNameVi,
    flNameEn,
    photoCounter,
    defectCounter,
    rawSurveyDate,
    rotMap,
    addPhotoIfUnique,
    defectSummaryRows,
    defectPairPhotos,
    zoneAndElementConditions
  );

  return {
    defectSummaryRows,
    defectPairPhotos,
    zoneAndElementConditions,
  };
}

