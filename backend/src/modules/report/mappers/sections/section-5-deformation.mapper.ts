/**
 * ============================================================================
 * SECTION 5 MAPPER: TILT & SETTLEMENT DEFORMATION
 * Chương V: Độ nghiêng / lún - Ghi nhận sơ bộ
 * ============================================================================
 */

import { Section5TiltSettlement } from '../../report.types';
import { ReportImageResolver } from '../../services/report-image-resolver.service';
import { isPhotoAlreadyWatermarked } from '../appendices/appendix-2/floor-defect.mapper';

export class Section5DeformationMapper {
  public static map(
    rawReport: any,
    json: any,
    deform: any,
    identPhotos: any[],
    structuralCracksCount: number,
    majorRepair: number
  ): Section5TiltSettlement {
    const findPhoto = (types: string[], fallbackUrl?: string) => {
      const p = identPhotos.find((item: any) =>
        types.includes(item.photo_type) ||
        types.some((t) => item.photo_code?.includes(t))
      );
      return p?.raw_photo_url || p?.annotated_photo_url || fallbackUrl || '';
    };

    const getPhotoEntryUrl = (entry: any): string | undefined =>
      typeof entry === 'string' ? entry : entry?.url;

    const hasExplicitTiltPhotosArray = Array.isArray(json.settlementTilt?.buildingTilt?.photos);
    const tiltPhotoObj = hasExplicitTiltPhotosArray
      ? json.settlementTilt.buildingTilt.photos[0]
      : (deform.buildingTilt?.photos?.[0] || rawReport.deformation?.tilt_photos_json?.[0]);
    const p05Url =
      getPhotoEntryUrl(tiltPhotoObj) ||
      (!hasExplicitTiltPhotosArray
        ? (json.photoP05?.url ||
           (typeof json.photoP05 === 'string' ? json.photoP05 : undefined) ||
           json.photos?.p05 ||
           json.step1Photos?.p05TiltCheckUrl ||
           deform.buildingTilt?.photoUrl ||
           findPhoto(['P05_TILT_CHECK', 'P05', 'P-05', 'TILT', 'ELEV_TILT']))
        : '');

    const hasExplicitSettlePhotosArray = Array.isArray(json.settlementTilt?.diffSettlement?.photos);
    const settlePhotoObj = hasExplicitSettlePhotosArray
      ? json.settlementTilt.diffSettlement.photos[0]
      : (deform.diffSettlement?.photos?.[0] || rawReport.deformation?.diff_settlement_photos_json?.[0]);
    const p06Url =
      getPhotoEntryUrl(settlePhotoObj) ||
      (!hasExplicitSettlePhotosArray
        ? (json.photoP06?.url ||
           (typeof json.photoP06 === 'string' ? json.photoP06 : undefined) ||
           json.photos?.p06 ||
           deform.diffSettlement?.photoUrl ||
           findPhoto(['FOUND_SETTLE', 'SETTLE', 'P06', 'P-06']))
        : '');

    const deformObj = { ...(rawReport.deformation || {}), ...(json.settlementTilt || {}) };
    const diffDeform = deformObj.diffSettlement || {};
    const tiltDeform = deformObj.buildingTilt || {};
    const sagDeform = deformObj.beamSagging || {};

    const diffPos = diffDeform.position?.trim() || '';
    const diffNotes = diffDeform.notes?.trim() || '';
    const hasDiff = (diffDeform.level ?? 0) > 0 || Boolean(diffPos) || Boolean(diffNotes);
    const diffPhotoCode = diffDeform.photoCode || (p06Url ? 'P-06' : '');
    const diffSummaryText = [diffPos, diffNotes].filter(Boolean).join(' - ');

    const hasDegradation = structuralCracksCount > 0;
    const hasRepair = majorRepair > 0;

    const tiltLevel = tiltDeform.level ?? 0;
    const tiltX = tiltDeform.xPermille ?? deformObj.tilt_angle_x;
    const tiltY = tiltDeform.yPermille ?? deformObj.tilt_angle_y;
    const tiltDir = tiltDeform.direction || deformObj.tilt_direction;
    const tiltNotes = tiltDeform.notes?.trim() || '';
    const tiltPhotoCode = tiltDeform.photoCode || deformObj.tilt_photo_code || (p05Url ? 'P-05' : '');
    const hasNonZeroTilt =
      (tiltX !== undefined && tiltX !== null && tiltX !== '' && Number(tiltX) !== 0 && !isNaN(Number(tiltX))) ||
      (tiltY !== undefined && tiltY !== null && tiltY !== '' && Number(tiltY) !== 0 && !isNaN(Number(tiltY)));
    const hasExplicitLaserSource = Array.isArray(deformObj.dataSource)
      ? deformObj.dataSource.some((s: unknown) => String(s).toUpperCase().includes('LASER'))
      : String(deformObj.dataSource || '').toUpperCase().includes('LASER');
    const hasTiltMeas =
      hasNonZeroTilt ||
      (hasExplicitLaserSource &&
        [tiltX, tiltY].some((v) => v !== undefined && v !== null && v !== '' && !isNaN(Number(v))));

    const fmtPermille = (v: unknown): string =>
      v === undefined || v === null || v === '' || isNaN(Number(v)) ? '--' : `${Number(v).toFixed(3)}‰`;

    let measuredTilt = '';
    const formattedTiltX = hasTiltMeas ? fmtPermille(tiltX) : '--';
    const formattedTiltY = hasTiltMeas ? fmtPermille(tiltY) : '--';
    if (hasTiltMeas) {
      measuredTilt = `X = ${formattedTiltX} ; Y = ${formattedTiltY}`;
      if (tiltDir) measuredTilt += ` (Hướng: ${tiltDir})`;
    } else {
      measuredTilt = '-- (Quan sát ngoại quan, không đo đạc)';
    }
    const isTiltObserved = tiltLevel > 0 || hasNonZeroTilt || Boolean(tiltNotes);

    const sagLevel = sagDeform.level ?? 0;
    const sagMmVal = sagDeform.sagMm ?? deformObj.beam_deflection_mm;
    const sagPos = sagDeform.position;
    const sagDesc = sagDeform.description;
    const hasSagMeas = sagMmVal !== '' && sagMmVal !== undefined && sagMmVal !== null && Number(sagMmVal) > 0;
    const isSagObserved = hasSagMeas || sagLevel > 0;
    const measuredSag = hasSagMeas ? `f = ${sagMmVal} mm` : 'Không phát hiện võng';

    const tiltDetails: { vi: string; en: string } = isTiltObserved
      ? {
          vi: `Phát hiện độ nghiêng thân nhà (Mức ${tiltLevel}/4)${tiltDir ? `, hướng ${tiltDir}` : ''}${tiltNotes ? ` - ${tiltNotes}` : ''}${tiltPhotoCode ? ` [Mã ảnh: ${tiltPhotoCode}]` : ''}`,
          en: `Building inclination observed (Level ${tiltLevel}/4)${tiltDir ? `, direction ${tiltDir}` : ''}${tiltNotes ? ` - ${tiltNotes}` : ''}${tiltPhotoCode ? ` [Photo: ${tiltPhotoCode}]` : ''}`,
        }
      : {
          vi: hasTiltMeas
            ? `Thân nhà thẳng đứng, độ nghiêng trong giới hạn cho phép${tiltPhotoCode ? ` [Ảnh kiểm tra: ${tiltPhotoCode}]` : ''}`
            : `Quan sát ngoại quan: không ghi nhận nghiêng (chưa đo đạc)${tiltPhotoCode ? ` [Ảnh kiểm tra: ${tiltPhotoCode}]` : ''}`,
          en: hasTiltMeas
            ? `Building upright, inclination within permissible limits${tiltPhotoCode ? ` [Check photo: ${tiltPhotoCode}]` : ''}`
            : `Visual observation: no inclination noted (not measured)${tiltPhotoCode ? ` [Check photo: ${tiltPhotoCode}]` : ''}`,
        };

    const rotMap = json.photoRotations || rawReport.photoRotations || {};

    return {
      differentialSettlement: {
        observed: hasDiff,
        observedDisplay: hasDiff ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
        location: hasDiff
          ? {
              vi: `Ghi nhận lún lệch (Mức ${diffDeform.level ?? 0}/4): ${diffSummaryText || 'tại chân móng/nền'}${diffPhotoCode ? ` [Ảnh: ${diffPhotoCode}]` : ''}`,
              en: `Differential settlement observed (Level ${diffDeform.level ?? 0}/4): ${diffSummaryText || 'at foundation/ground'}${diffPhotoCode ? ` [Photo: ${diffPhotoCode}]` : ''}`,
            }
          : {
              vi: `Không phát hiện lún chênh bất thường tại móng${diffPhotoCode ? ` [Ảnh kiểm tra: ${diffPhotoCode}]` : ''}`,
              en: `No abnormal differential settlement observed at foundation${diffPhotoCode ? ` [Check photo: ${diffPhotoCode}]` : ''}`,
            },
      },
      componentDeterioration: {
        observed: hasDegradation,
        observedDisplay: hasDegradation ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
        location: hasDegradation
          ? {
              vi: deformObj.componentDeterioration?.notes || `Ghi nhận ${structuralCracksCount} khuyết tật trên cấu kiện chịu lực (xem chi tiết Mục VI & Phụ lục 2)`,
              en: deformObj.componentDeterioration?.notes || `${structuralCracksCount} defect(s) recorded on load-bearing elements (see Section VI & App. 2)`,
            }
          : {
              vi: 'Không phát hiện dấu hiệu suy thoái nghiêm trọng của cấu kiện kết cấu',
              en: 'No critical structural component deterioration observed',
            },
      },
      evidenceOfRepairs: {
        observed: hasRepair,
        observedDisplay: hasRepair ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
        location: hasRepair
          ? {
              vi: majorRepair === 1
                ? 'Ghi nhận có sửa chữa nhẹ trước đây (đã xử lý ổn định, xem Mục III)'
                : 'Ghi nhận có cải tạo / sửa chữa trước đây (xem chi tiết Mục III)',
              en: majorRepair === 1
                ? 'Minor past repairs recorded (stabilised, see Section III)'
                : 'Past structural alteration / repair recorded (see Section III)',
            }
          : {
              vi: 'Không phát hiện dấu vết sửa chữa, gia cường kết cấu lớn',
              en: 'No signs of major past structural repairs or strengthening',
            },
      },
      collapse: {
        observed: false,
        observedDisplay: { vi: 'Không', en: 'None' },
        location: {
          vi: 'Không ghi nhận bất kỳ sự cố sụp đổ hoặc hư hỏng nghiêm trọng nào',
          en: 'No collapse or severe structural damage observed',
        },
      },
      buildingInclination: {
        observed: isTiltObserved,
        observedDisplay: isTiltObserved ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
        measured: measuredTilt,
        location: tiltDetails,
        details: tiltDetails,
      },
      beamDeflection: {
        observed: isSagObserved,
        observedDisplay: isSagObserved ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
        measured: measuredSag,
        location: isSagObserved
          ? {
              vi: `Ghi nhận độ võng dầm/sàn (f = ${sagMmVal} mm)${sagPos ? ` tại ${sagPos}` : ''}${sagDesc ? ` (${sagDesc})` : ''}`,
              en: `Beam/slab deflection recorded (f = ${sagMmVal} mm)${sagPos ? ` at ${sagPos}` : ''}${sagDesc ? ` (${sagDesc})` : ''}`,
            }
          : {
              vi: 'Không phát hiện hiện tượng võng dầm, sàn kết cấu bằng mắt thường',
              en: 'No visual deflection of structural beams or floor slabs observed',
            },
      },
      floorSlabInclination: { observed: false, measured: '/' },
      beamSlabDeflection: { observed: isSagObserved, measured: measuredSag },
      hasLaserTilt: hasTiltMeas,
      tiltX: formattedTiltX,
      tiltY: formattedTiltY,
      basisOfDetermination: {
        vi: Array.isArray(deformObj.dataSource) && deformObj.dataSource.length > 0
          ? deformObj.dataSource.join(', ')
          : (typeof deformObj.dataSource === 'string' && deformObj.dataSource.trim() !== ''
            ? deformObj.dataSource.trim()
            : (hasTiltMeas ? 'Đo nghiêng Laser & Quan sát hiện trường' : 'Quan sát hiện trường')),
        en: typeof deformObj.dataSource === 'string' && deformObj.dataSource.trim() !== ''
          ? deformObj.dataSource.trim()
          : (hasTiltMeas ? 'Site visual inspection & Laser measurement' : 'Site visual inspection (Visual check only)'),
      },
      reliability: {
        vi: deformObj.reliability || '--',
        en: deformObj.reliability || '--',
      },
      remarks: (() => {
        const attachedPhotos: string[] = [];
        if (p05Url) attachedPhotos.push('ảnh kiểm tra độ nghiêng (P-05)');
        if (p06Url) attachedPhotos.push('ảnh khảo sát lún móng (P-06)');
        if (rawReport.deformation?.abnormal_photos_json?.[0] || deform.abnormalCase?.photos?.[0] || json.photoP07) {
          attachedPhotos.push('ảnh kiểm tra ngoại quan (P-07)');
        }
        const photoNoteVi = attachedPhotos.length > 0 ? ` Đính kèm ${attachedPhotos.join(', ')} tại Phụ lục 1.` : '';
        const photoNoteEn = attachedPhotos.length > 0 ? ' Attached corresponding check photos in Appendix 1.' : '';

        const abnCase = deformObj.abnormalCase || {};
        const abnDesc = (abnCase.description || abnCase.notes || '').trim();
        const hasAbnDesc = Boolean(abnDesc);
        const abnNoteVi = hasAbnDesc ? ` Ghi nhận bất thường ngoại quan: ${abnDesc}.` : '';
        const abnNoteEn = hasAbnDesc ? ` Exterior anomaly noted: ${abnDesc}.` : '';

        const monObj = deformObj.needAdditionalMonitoring || {};
        const monNotes = (monObj.notes || '').trim();
        const hasMonNotes = Boolean(monObj.required || monNotes);
        const monNoteVi = hasMonNotes ? ` Kiến nghị quan trắc bổ sung: ${monNotes || 'Yêu cầu gắn mốc quan trắc theo dõi biến dạng'}.` : '';
        const monNoteEn = hasMonNotes ? ` Additional monitoring recommendation: ${monNotes || 'Additional deformation monitoring required'}.` : '';

        if (isTiltObserved || hasDiff || isSagObserved || hasAbnDesc || hasMonNotes) {
          return {
            vi: `Hiện trạng công trình ghi nhận biến dạng đo đạc tại hiện trường (chi tiết các chỉ tiêu đánh giá phía trên).${abnNoteVi}${monNoteVi}${photoNoteVi}`,
            en: `Field survey recorded deformation on-site (detailed in criteria table above).${abnNoteEn}${monNoteEn}${photoNoteEn}`,
          };
        }
        return {
          vi: `Hiện trạng công trình không ghi nhận biến dạng nghiêng lún bất thường bằng trực quan.${photoNoteVi}`,
          en: `No abnormal visual tilt or differential settlement observed.${photoNoteEn}`,
        };
      })(),
      tiltPhoto: p05Url ? {
        url: p05Url,
        base64: ReportImageResolver.resolveToBase64(
          p05Url,
          rotMap['P-05'] ?? rotMap['photoP05'] ?? rotMap['buildingTilt'] ?? rotMap['buildingTilt_0'] ?? rotMap[p05Url] ?? 0
        ),
        caption: { vi: 'Thực tế kiểm tra độ nghiêng thân nhà (P-05)', en: 'Building inclination check (P-05)' },
        alreadyWatermarked: isPhotoAlreadyWatermarked(p05Url),
      } : undefined,
      settlementPhoto: p06Url ? {
        url: p06Url,
        base64: ReportImageResolver.resolveToBase64(
          p06Url,
          rotMap['P-06'] ?? rotMap['photoP06'] ?? rotMap['diffSettlement'] ?? rotMap['diffSettlement_0'] ?? rotMap[p06Url] ?? 0
        ),
        caption: { vi: 'Thực tế kiểm tra lún móng & nền công trình (P-06)', en: 'Foundation & settlement survey (P-06)' },
        alreadyWatermarked: isPhotoAlreadyWatermarked(p06Url),
      } : undefined,
    };
  }
}

