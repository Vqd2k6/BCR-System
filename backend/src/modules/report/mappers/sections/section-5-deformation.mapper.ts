/**
 * ============================================================================
 * SECTION 5 MAPPER: TILT & SETTLEMENT DEFORMATION
 * Chương V: Độ nghiêng / lún - Ghi nhận sơ bộ
 * ============================================================================
 */

import { Section5TiltSettlement } from '../../report.types';
import { ReportImageResolver } from '../../services/report-image-resolver.service';
import { isPhotoAlreadyWatermarked } from '../appendices/appendix-2/floor-defect.mapper';
import { MAJOR_REPAIR_LABELS } from './section-3-4-structural.mapper';

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
    // Mã ảnh trong bảng dùng đúng nhãn Phụ lục 1 (P-05 / P-06), không dùng mã file thô HCM_M2…
    const diffPhotoCode = p06Url ? 'P-06' : '';
    const diffSummaryText = [diffPos, diffNotes].filter(Boolean).join(' - ');

    const hasDegradation = structuralCracksCount > 0;
    const hasRepair = majorRepair > 0;
    const repairLabel = MAJOR_REPAIR_LABELS[majorRepair] ?? { vi: `Mức ${majorRepair}`, en: `Level ${majorRepair}` };

    const tiltLevel = tiltDeform.level ?? 0;
    const tiltX = tiltDeform.xPermille ?? deformObj.tilt_angle_x;
    const tiltY = tiltDeform.yPermille ?? deformObj.tilt_angle_y;
    const tiltDir = tiltDeform.direction || deformObj.tilt_direction;
    const tiltNotes = tiltDeform.notes?.trim() || '';
    const tiltPhotoCode = p05Url ? 'P-05' : '';
    const isEntered = (v: unknown) => v !== undefined && v !== null && v !== '' && !isNaN(Number(v));
    const hasNonZeroTilt =
      (isEntered(tiltX) && Number(tiltX) !== 0) || (isEntered(tiltY) && Number(tiltY) !== 0);
    // X/Y = 0 là giá trị mặc định của DB khi chỉ quan sát bằng mắt → chỉ coi là số đo khi có tick dụng cụ đo nghiêng
    // (Thước Laser / Nivo, Thước nivo / Quả dọi). Không có số đo thì ẩn dòng số, KHÔNG tự kết luận "không đo đạc".
    // Nguồn đã tick: JSON settlementTilt.dataSource; dự phòng cột deformation_assessments.measurement_method (chuỗi nối ',').
    const rawSourceValue: unknown =
      Array.isArray(deformObj.dataSource) && deformObj.dataSource.length > 0
        ? deformObj.dataSource
        : (deformObj.dataSource || deformObj.measurement_method);
    const rawSourceList: unknown[] = Array.isArray(rawSourceValue)
      ? rawSourceValue
      : typeof rawSourceValue === 'string' ? rawSourceValue.split(',') : [];
    const hasTiltInstrument = rawSourceList.some((s) => /LASER|NIVO|DỌI/i.test(String(s)));
    const hasTiltMeas = hasNonZeroTilt || (hasTiltInstrument && (isEntered(tiltX) || isEntered(tiltY)));

    const fmtPermille = (v: unknown): string => (isEntered(v) ? `${Number(v).toFixed(3)}‰` : '--');

    const formattedTiltX = hasTiltMeas ? fmtPermille(tiltX) : '--';
    const formattedTiltY = hasTiltMeas ? fmtPermille(tiltY) : '--';
    const measuredTilt = hasTiltMeas
      ? `X = ${formattedTiltX} ; Y = ${formattedTiltY}${tiltDir ? ` (Hướng: ${tiltDir})` : ''}`
      : '';
    const isTiltObserved = tiltLevel > 0 || hasNonZeroTilt || Boolean(tiltNotes);

    const sagLevel = sagDeform.level ?? 0;
    const sagMmVal = sagDeform.sagMm ?? deformObj.beam_deflection_mm;
    const sagPos = sagDeform.position;
    const sagDesc = sagDeform.description;
    const hasSagMeas = isEntered(sagMmVal) && Number(sagMmVal) > 0;
    const isSagObserved = hasSagMeas || sagLevel > 0;
    const measuredSag = hasSagMeas ? `f = ${sagMmVal} mm` : '';

    const tiltDetails: { vi: string; en: string } = isTiltObserved
      ? {
          vi: `Phát hiện độ nghiêng thân nhà (Mức ${tiltLevel}/4)${tiltDir ? `, hướng ${tiltDir}` : ''}${tiltNotes ? ` - ${tiltNotes}` : ''}${tiltPhotoCode ? ` [Ảnh: ${tiltPhotoCode}]` : ''}`,
          en: `Building inclination observed (Level ${tiltLevel}/4)${tiltDir ? `, direction ${tiltDir}` : ''}${tiltNotes ? ` - ${tiltNotes}` : ''}${tiltPhotoCode ? ` [Photo: ${tiltPhotoCode}]` : ''}`,
        }
      : {
          vi: `Không phát hiện nghiêng${tiltPhotoCode ? ` [Ảnh kiểm tra: ${tiltPhotoCode}]` : ''}`,
          en: `No inclination observed${tiltPhotoCode ? ` [Check photo: ${tiltPhotoCode}]` : ''}`,
        };

    // Cơ sở xác định: chỉ các nguồn đã tick (form KSV + form thẩm định), dịch EN theo từ điển, gộp từ đồng nghĩa.
    const SOURCE_EN: Record<string, string> = {
      'Quan sát hiện trường': 'Site visual inspection',
      'Thước Laser / Nivo': 'Laser / Spirit level measurement',
      'Hồ sơ bản vẽ': 'As-built / design drawings',
      'Chủ nhà cung cấp': 'Provided by owner',
      'Thước dây / Thước thép': 'Measuring tape / Steel ruler',
      'Thước nivo / Quả dọi': 'Spirit level / Plumb bob',
    };
    const SOURCE_SYNONYMS: Record<string, string> = {
      'Quan sát trực quan': 'Quan sát hiện trường',
      VISUAL: 'Quan sát hiện trường',
    };
    const sources = Array.from(new Set(
      rawSourceList
        .map((s) => String(s ?? '').trim())
        .filter(Boolean)
        .map((s) => SOURCE_SYNONYMS[s] ?? s)
    ));
    const basisOfDetermination = sources.length > 0
      ? { vi: sources.join(', '), en: sources.map((s) => SOURCE_EN[s] ?? s).join(', ') }
      : { vi: '--', en: '--' };

    // Nhận xét: chỉ phần KSV/Admin đã nhập (bất thường ngoại quan, kiến nghị quan trắc); không tự sinh câu tổng kết.
    const abnCase = deformObj.abnormalCase || {};
    const abnDesc = String(abnCase.description || abnCase.notes || '').trim();
    const monObj = deformObj.needAdditionalMonitoring || {};
    const monNotes = String(monObj.notes || '').trim();
    const remarkVi: string[] = [];
    const remarkEn: string[] = [];
    if (abnDesc) { remarkVi.push(`Ghi nhận bất thường ngoại quan: ${abnDesc}.`); remarkEn.push(`Exterior anomaly noted: ${abnDesc}.`); }
    if (monNotes) { remarkVi.push(`Kiến nghị quan trắc bổ sung: ${monNotes}.`); remarkEn.push(`Additional monitoring recommendation: ${monNotes}.`); }
    else if (monObj.required === true) { remarkVi.push('Kiến nghị quan trắc bổ sung: Có.'); remarkEn.push('Additional monitoring recommended: Yes.'); }

    const rotMap = json.photoRotations || rawReport.photoRotations || {};

    return {
      differentialSettlement: {
        observed: hasDiff,
        observedDisplay: hasDiff ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
        location: hasDiff
          ? {
              vi: `Ghi nhận lún lệch (Mức ${diffDeform.level ?? 0}/4)${diffSummaryText ? `: ${diffSummaryText}` : ''}${diffPhotoCode ? ` [Ảnh: ${diffPhotoCode}]` : ''}`,
              en: `Differential settlement observed (Level ${diffDeform.level ?? 0}/4)${diffSummaryText ? `: ${diffSummaryText}` : ''}${diffPhotoCode ? ` [Photo: ${diffPhotoCode}]` : ''}`,
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
              vi: 'Không ghi nhận khuyết tật trên cấu kiện chịu lực (xem Mục VI)',
              en: 'No defects recorded on load-bearing elements (see Section VI)',
            },
      },
      evidenceOfRepairs: {
        observed: hasRepair,
        observedDisplay: hasRepair ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
        location: {
          vi: `Theo phỏng vấn chủ hộ (Mục III): ${repairLabel.vi}`,
          en: `Per owner interview (Section III): ${repairLabel.en}`,
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
              vi: `Ghi nhận võng dầm/sàn${sagLevel > 0 ? ` (Mức ${sagLevel}/4)` : ''}${sagPos ? ` tại ${sagPos}` : ''}${sagDesc ? ` (${sagDesc})` : ''}`,
              en: `Beam/slab deflection recorded${sagLevel > 0 ? ` (Level ${sagLevel}/4)` : ''}${sagPos ? ` at ${sagPos}` : ''}${sagDesc ? ` (${sagDesc})` : ''}`,
            }
          : {
              vi: 'Không phát hiện võng dầm/sàn',
              en: 'No beam/slab deflection observed',
            },
      },
      floorSlabInclination: { observed: false, measured: '/' },
      beamSlabDeflection: { observed: isSagObserved, measured: measuredSag },
      hasLaserTilt: hasTiltMeas,
      tiltX: formattedTiltX,
      tiltY: formattedTiltY,
      basisOfDetermination,
      remarks: { vi: remarkVi.join(' '), en: remarkEn.join(' ') },
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

