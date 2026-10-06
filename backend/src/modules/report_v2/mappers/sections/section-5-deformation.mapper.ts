/**
 * ============================================================================
 * SECTION 5 MAPPER: TILT & SETTLEMENT PRELIMINARY OBSERVATION
 * Chương V: Độ nghiêng / lún - Ghi nhận sơ bộ
 * ============================================================================
 */

import { Section5TiltSettlement } from '../../report-v2.types';
import { ReportImageResolver } from '../../services/report-image-resolver.service';
import { isPhotoAlreadyWatermarked } from '../floor-defect.mapper';

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

    const tiltPhotoObj = rawReport.deformation?.tilt_photos_json?.[0] || deform.buildingTilt?.photos?.[0];
    const p05Url =
      json.photoP05?.url ||
      (typeof json.photoP05 === 'string' ? json.photoP05 : undefined) ||
      json.photos?.p05 ||
      json.step1Photos?.p05TiltCheckUrl ||
      tiltPhotoObj?.url ||
      deform.buildingTilt?.photoUrl ||
      findPhoto(['P05_TILT_CHECK', 'P05', 'P-05', 'TILT', 'ELEV_TILT']);

    const settlePhotoObj = rawReport.deformation?.diff_settlement_photos_json?.[0] || deform.diffSettlement?.photos?.[0];
    const p06Url =
      settlePhotoObj?.url ||
      deform.diffSettlement?.photoUrl ||
      findPhoto(['FOUND_SETTLE', 'SETTLE', 'P06', 'P-06']);

    const deformObj = json.settlementTilt || rawReport.deformation || {};
    const diffDeform = deformObj.diffSettlement || {};
    const tiltDeform = deformObj.buildingTilt || {};
    const sagDeform = deformObj.beamSagging || {};

    // 1. Lún lệch
    const hasDiff = (diffDeform.level ?? 0) > 0 || Boolean(diffDeform.notes && diffDeform.notes.trim() !== '');
    const diffPhotoCode = diffDeform.photoCode || (p06Url ? 'P-06' : '');
    const diffNotes = diffDeform.notes?.trim();

    // 2. Suy thoái cấu kiện
    const hasDegradation = structuralCracksCount > 0;

    // 3. Dấu hiệu sửa chữa
    const hasRepair = majorRepair > 0;

    // 4. Nghiêng thân nhà
    const tiltLevel = tiltDeform.level ?? 0;
    const tiltX = tiltDeform.xPermille ?? deformObj.tilt_angle_x;
    const tiltY = tiltDeform.yPermille ?? deformObj.tilt_angle_y;
    const tiltDir = tiltDeform.direction || deformObj.tilt_direction;
    const tiltPhotoCode = tiltDeform.photoCode || deformObj.tilt_photo_code || (p05Url ? 'P-05' : '');
    const hasTiltMeas = (tiltX !== '' && tiltX !== undefined && tiltX !== null && !isNaN(Number(tiltX))) ||
                        (tiltY !== '' && tiltY !== undefined && tiltY !== null && !isNaN(Number(tiltY)));
    let measuredTilt = '';
    if (hasTiltMeas) {
      measuredTilt = `X = ${Number(tiltX || 0).toFixed(3)}‰ ; Y = ${Number(tiltY || 0).toFixed(3)}‰`;
    } else {
      measuredTilt = 'Quan sát ngoại quan (Không đo Laser)';
    }
    const isTiltObserved = tiltLevel > 0;

    // 5. Độ võng dầm/sàn
    const sagLevel = sagDeform.level ?? 0;
    const sagMmVal = sagDeform.sagMm ?? deformObj.beam_deflection_mm;
    const sagPos = sagDeform.position;
    const sagDesc = sagDeform.description;
    const hasSagMeas = sagMmVal !== '' && sagMmVal !== undefined && sagMmVal !== null && Number(sagMmVal) > 0;
    const isSagObserved = hasSagMeas || sagLevel > 0;
    let measuredSag = '';
    if (hasSagMeas) {
      measuredSag = `f = ${sagMmVal} mm`;
    } else {
      measuredSag = 'Không phát hiện võng';
    }

    const section5: Section5TiltSettlement = {
      differentialSettlement: {
        observed: hasDiff,
        observedDisplay: hasDiff ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
        location: hasDiff
          ? {
              vi: `Ghi nhận lún lệch: ${diffNotes || 'tại chân móng/nền'}${diffPhotoCode ? ` [Ảnh: ${diffPhotoCode}]` : ''}`,
              en: `Differential settlement observed: ${diffNotes || 'at foundation/ground'}${diffPhotoCode ? ` [Photo: ${diffPhotoCode}]` : ''}`,
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
              vi: `Ghi nhận ${structuralCracksCount} cấu kiện chịu lực có dấu hiệu suy thoái/nứt cấp ≥ 3 (xem chi tiết Mục VI & Phụ lục 2)`,
              en: `${structuralCracksCount} load-bearing elements show signs of degradation/cracks grade ≥ 3 (see Section VI & App. 2)`,
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
              vi: 'Chủ hộ ghi nhận có sửa chữa trước đây, hiện trạng kết cấu ổn định',
              en: 'Owner reported past repairs, structure currently stable',
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
        location: isTiltObserved
          ? {
              vi: `Phát hiện độ nghiêng thân nhà (Mức ${tiltLevel}/4)${tiltDir ? `, hướng ${tiltDir}` : ''}${tiltPhotoCode ? ` [Mã ảnh: ${tiltPhotoCode}]` : ''}`,
              en: `Building inclination observed (Level ${tiltLevel}/4)${tiltDir ? `, direction ${tiltDir}` : ''}${tiltPhotoCode ? ` [Photo: ${tiltPhotoCode}]` : ''}`,
            }
          : {
              vi: `Thân nhà thẳng đứng, độ nghiêng trong giới hạn cho phép${tiltPhotoCode ? ` [Ảnh kiểm tra: ${tiltPhotoCode}]` : ''}`,
              en: `Building upright, inclination within permissible limits${tiltPhotoCode ? ` [Check photo: ${tiltPhotoCode}]` : ''}`,
            },
        details: isTiltObserved
          ? {
              vi: `Phát hiện độ nghiêng thân nhà (Mức ${tiltLevel}/4)${tiltDir ? `, hướng ${tiltDir}` : ''}${tiltPhotoCode ? ` [Mã ảnh: ${tiltPhotoCode}]` : ''}`,
              en: `Building inclination observed (Level ${tiltLevel}/4)${tiltDir ? `, direction ${tiltDir}` : ''}${tiltPhotoCode ? ` [Photo: ${tiltPhotoCode}]` : ''}`,
            }
          : {
              vi: `Thân nhà thẳng đứng, độ nghiêng trong giới hạn cho phép${tiltPhotoCode ? ` [Ảnh kiểm tra: ${tiltPhotoCode}]` : ''}`,
              en: `Building upright, inclination within permissible limits${tiltPhotoCode ? ` [Check photo: ${tiltPhotoCode}]` : ''}`,
            },
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
      floorSlabInclination: {
        observed: false,
        measured: '/',
      },
      beamSlabDeflection: {
        observed: isSagObserved,
        measured: measuredSag,
      },
      basisOfDetermination: {
        vi: Array.isArray(deformObj.dataSource) ? deformObj.dataSource.join(', ') : 'Quan sát hiện trường',
        en: 'Site visual inspection & Laser measurement',
      },
      reliability: {
        vi: deformObj.reliability || 'HIGH',
        en: deformObj.reliability || 'HIGH',
      },
      remarks: {
        vi: 'Hiện trạng công trình không ghi nhận biến dạng nghiêng lún bất thường. Đính kèm ảnh kiểm tra độ nghiêng (P-05), ảnh khảo sát lún móng (P-06) và ảnh kiểm tra ngoại quan (P-07).',
        en: 'No abnormal tilt or settlement recorded. Tilt check photo (P-05), settlement photo (P-06), and anomaly check photo (P-07) are attached in Appendix 1.',
      },
      tiltPhoto: p05Url ? {
        url: p05Url,
        base64: ReportImageResolver.resolveToBase64(p05Url),
        caption: { vi: 'Thực tế kiểm tra độ nghiêng thân nhà (P-05)', en: 'Building inclination check (P-05)' },
        alreadyWatermarked: isPhotoAlreadyWatermarked(p05Url),
      } : undefined,
      settlementPhoto: p06Url ? {
        url: p06Url,
        base64: ReportImageResolver.resolveToBase64(p06Url),
        caption: { vi: 'Thực tế kiểm tra lún móng & nền công trình (P-06)', en: 'Foundation & settlement survey (P-06)' },
        alreadyWatermarked: isPhotoAlreadyWatermarked(p06Url),
      } : undefined,
    };

    return section5;
  }
}
