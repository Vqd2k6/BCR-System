/**
 * ============================================================================
 * REPORT V2 VIEWMODEL MAPPER (ORCHESTRATOR)
 * Nạp toàn bộ dữ liệu CSDL / JSON Snapshot -> ReportV2ViewModel chuẩn 100%
 * ============================================================================
 */

import {
  ReportV2ViewModel,
  ReportV2Metadata,
  ReportScenarioFlags,
  ApprovalSignatureItem,
  Section1GeneralInfo,
  Section2BasicBuildingInfo,
  Section3HistoryOccupancy,
  Section4StructuralFoundation,
  Section5TiltSettlement,
  Section6DefectSummary,
  Section9ConclusionRecommendation,
  Appendix1PhotoItem,
  Appendix1PhotoPage,
  Appendix3SignedRecord,
  Appendix4EquipmentAndAccess,
  BilingualText,
  TocPageNumbers,
  RelatedMetroWorks,
} from '../report-v2.types';
import { CadastralInfoMapper } from './cadastral-info.mapper';
import { BurlandCalculator } from './burland-calculator';
import { RiskScoringCalculator } from './risk-scoring-calculator';
import { FloorDefectMapper, isPhotoAlreadyWatermarked } from './floor-defect.mapper';
import { ReportImageResolver } from '../services/report-image-resolver.service';
import { LOGO_THACO_REC_BASE64 } from '../assets/report-logos';

/**
 * Chuẩn hóa chuỗi ngày tháng ISO sang định dạng chuẩn kỹ thuật Việt Nam DD/MM/YYYY
 */
export function formatDateVi(dateVal: any, includeTime: boolean = false): string {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    if (!includeTime && str.includes('(')) {
      return str.split('(')[0].trim();
    }
    return str;
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  if (includeTime && (d.getHours() !== 0 || d.getMinutes() !== 0)) {
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} (${hours}:${mins})`;
  }
  return `${day}/${month}/${year}`;
}

export function formatWatermarkDateTime(dateVal: any): string {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) {
    return String(dateVal);
  }
  // Định dạng chuẩn frontend (PhotoWatermarkOverlay): DD/MM/YYYY HH:mm:ss
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  // Thiếu metadata giờ (00:00:00) -> chỉ hiện ngày, không in giờ giả
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
    return `${day}/${month}/${year}`;
  }
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
}

export function extractPhotoDateTime(photoUrl?: string, itemShotAt?: any, fallbackDate?: any): string {
  if (itemShotAt) {
    const formatted = formatWatermarkDateTime(itemShotAt);
    if (formatted) return formatted;
  }
  if (photoUrl && typeof photoUrl === 'string') {
    const match = photoUrl.match(/_(\d{13})_/);
    if (match) {
      const epoch = parseInt(match[1], 10);
      if (!isNaN(epoch) && epoch > 1500000000000 && epoch < 2500000000000) {
        return formatWatermarkDateTime(new Date(epoch));
      }
    }
  }
  return formatWatermarkDateTime(fallbackDate) || '';
}

export class ReportV2ViewModelMapper {
  public static buildViewModel(rawReport: any, overrides?: any): ReportV2ViewModel {
    const json = rawReport.survey_data_json || {};
    const specs = rawReport.buildingSpecs || json || {};
    const history = rawReport.historicalSensitivity || json.historyInterview || {};
    const deform = rawReport.deformation || json.settlementTilt || {};
    const identPhotos = rawReport.identificationPhotos || [];

    // Tọa độ GPS
    const defaultLat = json.gpsCoords?.lat ? Number(json.gpsCoords.lat) : 10.7769;
    const defaultLng = json.gpsCoords?.lng ? Number(json.gpsCoords.lng) : 106.7009;

    // Chuẩn hóa ngày khảo sát (khóa chặt thời gian thực tế của KSV, không lấy thời gian hiện tại)
    const rawSurveyDate =
      rawReport.survey_date ||
      json.surveyDate ||
      json.signatures?.preparedBy?.date ||
      json.signatures?.ownerRepresentative?.date ||
      rawReport.created_at;
    const surveyDateFormatted = formatDateVi(rawSurveyDate) || '';
    const surveyDateWithTime = formatDateVi(rawSurveyDate, true) || surveyDateFormatted;
    const watermarkDateTime = formatWatermarkDateTime(rawSurveyDate) || surveyDateWithTime || surveyDateFormatted;

    // 1. Chuẩn hóa 7 chỉ số định danh
    const rawParcelCode = rawReport.project_parcel_code || json.projectParcelCode || '';
    const buildingId = overrides?.buildingId || (rawParcelCode ? CadastralInfoMapper.formatBuildingId(
      rawParcelCode,
      rawReport.zone_id || 'ZONE_09',
      rawReport.segment_type || 'C&C'
    ) : 'CHƯA_ĐỊNH_DANH');
    const surveyId = rawReport.id ? `P-${rawReport.id.substring(0, 4).toUpperCase()}` : (json.surveyId || '');
    const revision = overrides?.revision || rawReport.revision || '00';
    const reportNo = overrides?.reportNo || (rawParcelCode ? CadastralInfoMapper.formatReportNo(
      buildingId,
      rawParcelCode,
      rawReport.segment_type,
      rawReport.zone_id,
      revision
    ) : 'BC-CHƯA_SỐ');
    const filingNo = overrides?.filingNo || CadastralInfoMapper.formatFilingNo(buildingId);
    const cadastralCode = rawReport.official_cadastral_code || json.officialCadastralCode || '';

    // Ảnh mặt tiền chính cho trang bìa (P-02) có cơ chế fallback thông minh:
    const p02Item = identPhotos.find((p: any) =>
      p.photo_type === 'P02_MAIN_FACADE' ||
      p.photo_code?.includes('P02') ||
      p.photo_code?.includes('P-02') ||
      p.photo_type === 'P02'
    );
    const p01Item = identPhotos.find((p: any) =>
      p.photo_type === 'P01_HOUSE_NUMBER' ||
      p.photo_code?.includes('P01') ||
      p.photo_code?.includes('P-01')
    );

    let coverPhotoUrl =
      json.photoP02?.url ||
      (typeof json.photoP02 === 'string' ? json.photoP02 : undefined) ||
      json.photos?.p02 ||
      json.step1Photos?.p02MainFacadeUrl ||
      p02Item?.raw_photo_url ||
      p02Item?.annotated_photo_url ||
      '';
    // Fallback 1: Dùng P-01 nếu không có P-02 (ví dụ hẻm hẹp)
    if (!coverPhotoUrl) {
      coverPhotoUrl =
        json.photoP01?.url ||
        (typeof json.photoP01 === 'string' ? json.photoP01 : undefined) ||
        json.photos?.p01 ||
        json.step1Photos?.p01HouseNumberUrl ||
        p01Item?.raw_photo_url ||
        p01Item?.annotated_photo_url ||
        '';
    }
    // Fallback 2: Dùng ảnh đất trống nếu là hồ sơ đất trống
    if (!coverPhotoUrl && Array.isArray(json.vacantLandPhotos) && json.vacantLandPhotos.length > 0) {
      coverPhotoUrl = json.vacantLandPhotos[0];
    }
    const coverPhotoBase64 = coverPhotoUrl ? ReportImageResolver.resolveToBase64(coverPhotoUrl) : undefined;
    const coverWatermarkDateTime = extractPhotoDateTime(coverPhotoUrl, p02Item?.shot_at || p02Item?.created_at, rawSurveyDate);

    // Metadata
    const metadata: ReportV2Metadata = {
      buildingId,
      surveyId,
      reportNo,
      filingNo,
      revision,
      cadastralCode,
      projectTitleVi: 'Tuyến Metro Số 2 TPHCM (Bến Thành - Tham Lương)',
      projectTitleEn: 'Ho Chi Minh City Mass Rapid Transit Line 2, Ben Thanh – Tham Luong Route',
      reportTitleVi: 'Khảo sát và Đánh giá hiện trạng tòa nhà - Báo cáo Giai Đoạn 1',
      reportTitleEn: 'Building Condition Survey and Assessment - Report',
      generatedAt: formatDateVi(new Date()),
      coverPhotoUrl,
      coverPhotoBase64,
      coverAlreadyWatermarked: isPhotoAlreadyWatermarked(coverPhotoUrl),
      headerLogoBase64: LOGO_THACO_REC_BASE64,
      surveyDateFormatted,
      watermarkDateTime,
      coverWatermarkDateTime,
    };

    // Khung ký 3 bên trang bìa: Chỉ hiển thị tên khi có dữ liệu thực tế trong DB / JSON snapshot.
    // Khi chưa duyệt / chưa ký số, để trống fullName và ô ký để ký sống bằng tay.
    const surveyorName = rawReport.surveyor_name || json.signatures?.preparedBy?.fullName || '';
    const zoneAdminName = rawReport.zone_admin_name || json.signatures?.checkedBy?.fullName || '';
    const superAdminName = rawReport.super_admin_name || json.signatures?.approvedBy?.fullName || '';

    const surveyorSigUrl = rawReport.surveyor_signature_img || json.signatures?.preparedBy?.signatureImg;
    const zoneAdminSigUrl = rawReport.zone_admin_signature_img || json.signatures?.checkedBy?.signatureImg;
    const superAdminSigUrl = rawReport.super_admin_signature_img || json.signatures?.approvedBy?.signatureImg;

    const signatures3Party: ApprovalSignatureItem[] = [
      {
        roleVi: 'NGƯỜI LẬP',
        roleEn: 'PREPARED BY',
        fullName: surveyorName,
        titleVi: 'Trưởng nhóm khảo sát',
        titleEn: 'Survey Team Leader',
        signatureUrl: surveyorSigUrl,
        signatureBase64: surveyorSigUrl ? ReportImageResolver.resolveToBase64(surveyorSigUrl) : undefined,
        date: surveyDateFormatted,
      },
      {
        roleVi: 'NGƯỜI KIỂM TRA',
        roleEn: 'CHECKED BY',
        fullName: zoneAdminName,
        titleVi: 'Quản trị phân khu',
        titleEn: 'Zone Administrator',
        signatureUrl: zoneAdminSigUrl,
        signatureBase64: zoneAdminSigUrl ? ReportImageResolver.resolveToBase64(zoneAdminSigUrl) : undefined,
        date: surveyDateFormatted,
      },
      {
        roleVi: 'NGƯỜI PHÊ DUYỆT',
        roleEn: 'APPROVED BY',
        fullName: superAdminName,
        titleVi: 'Giám đốc dự án / Tư vấn trưởng',
        titleEn: 'Project Director / Lead Consultant',
        signatureUrl: superAdminSigUrl,
        signatureBase64: superAdminSigUrl ? ReportImageResolver.resolveToBase64(superAdminSigUrl) : undefined,
        date: surveyDateFormatted,
      },
    ];

    // CHƯƠNG I: THÔNG TIN CHUNG (SECTION I)
    // Tên công trình song ngữ chuẩn hóa
    const rawBldgName = json.buildingName || rawReport.building_name || 'Nhà ở gia đình';
    let bldgNameVi = rawBldgName;
    let bldgNameEn = 'Private Residential Townhouse';
    if (rawBldgName.toLowerCase().includes('kinh doanh') || rawBldgName.toLowerCase().includes('shophouse')) {
      bldgNameVi = 'Nhà ở kết hợp kinh doanh';
      bldgNameEn = 'Shophouse / Mixed-use Townhouse';
    } else if (rawBldgName.toLowerCase().includes('chung cư') || rawBldgName.toLowerCase().includes('căn hộ')) {
      bldgNameVi = 'Chung cư / Căn hộ tập thể';
      bldgNameEn = 'Multi-storey Apartment Building';
    } else if (rawBldgName.toLowerCase().includes('văn phòng')) {
      bldgNameVi = 'Tòa nhà văn phòng';
      bldgNameEn = 'Commercial Office Building';
    }

    // Chủ sở hữu / người sử dụng song ngữ
    const ownerVi = rawReport.owner_name || json.signatures?.ownerRepresentative?.fullName || json.ownerName || 'Chủ hộ';
    let ownerEn = ownerVi;
    if (ownerVi.toLowerCase().includes('chủ hộ')) {
      ownerEn = ownerVi.replace(/chủ hộ/i, 'Property Owner').replace(/thửa/i, 'Plot').replace(/tờ/i, 'Sheet');
    } else {
      ownerEn = `Mr./Ms. ${ownerVi}`;
    }

    // Đoạn tuyến / Khu vực song ngữ từ bảng metro_segments PostGIS
    const zoneNameVi = rawReport.metro_segment_name || `Zone 9: Ga S5 Lê Thị Riêng (C&C)`;
    const startKm = rawReport.metro_start_chainage || 'Km 4+090';
    const endKm = rawReport.metro_end_chainage || 'Km 4+300';
    const sectionZoneVi = `${zoneNameVi} [Lý trình: ${startKm} – ${endKm}]`;
    const zoneNameEn = zoneNameVi
      .replace(/Ga\s+S(\d+)/i, 'S$1 Station')
      .replace('Ga', 'Station')
      .replace('Hầm TBM', 'TBM Tunnel')
      .replace('Cầu cạn', 'Viaduct')
      .replace('Khu vực ga', 'Station Area')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const sectionZoneEn = `${zoneNameEn} [Chainage: ${startKm} – ${endKm}]`;

    // 4 nhóm Hạng mục Metro chuẩn theo ENUM PostGIS (C&C, POR, ELV, DEP)
    const rawSegType = (rawReport.segment_type || rawReport.metro_construction_type || 'C&C').toUpperCase();
    const metroType: 'C&C' | 'POR' | 'ELV' | 'DEP' = ['C&C', 'POR', 'ELV', 'DEP'].includes(rawSegType)
      ? (rawSegType as any)
      : 'C&C';
    const relatedMetroWorks: RelatedMetroWorks = {
      type: metroType,
      isCutCover: metroType === 'C&C',
      isBoredTunnel: metroType === 'POR',
      isElevated: metroType === 'ELV',
      isDepot: metroType === 'DEP',
    };

    const section1: Section1GeneralInfo = {
      projectTitleVi: metadata.projectTitleVi,
      projectTitleEn: metadata.projectTitleEn,
      buildingId,
      surveyId,
      reportNo,
      buildingName: {
        vi: bldgNameVi,
        en: bldgNameEn,
      },
      address: {
        vi: (() => {
          const parts: string[] = [];
          if (rawReport.house_number || json.houseNumber) parts.push(`Số ${rawReport.house_number || json.houseNumber}`);
          if (rawReport.street || json.street) {
            const st = rawReport.street || json.street;
            parts.push(st.startsWith('đường') || st.startsWith('Đường') ? st : `đường ${st}`);
          }
          if (rawReport.ward || json.ward) {
            const w = rawReport.ward || json.ward;
            parts.push(w.startsWith('P.') || w.startsWith('Phường') ? w : `P. ${w}`);
          }
          if (rawReport.district || json.district) {
            const d = rawReport.district || json.district;
            parts.push(d.startsWith('Q.') || d.startsWith('Quận') ? d : `Q. ${d}`);
          }
          parts.push(rawReport.city || json.city || 'TP Hồ Chí Minh');
          parts.push('Việt Nam');
          return parts.length > 2 ? parts.join(', ') : (rawReport.address_combined || 'Chưa ghi nhận địa chỉ chi tiết');
        })(),
        en: (() => {
          const parts: string[] = [];
          if (rawReport.house_number || json.houseNumber) parts.push(`No. ${rawReport.house_number || json.houseNumber}`);
          if (rawReport.street || json.street) parts.push(`${rawReport.street || json.street} St.`);
          if (rawReport.ward || json.ward) parts.push(`Ward ${rawReport.ward || json.ward}`);
          if (rawReport.district || json.district) parts.push(`Dist. ${rawReport.district || json.district}`);
          parts.push('Ho Chi Minh City, Viet Nam');
          return parts.length > 2 ? parts.join(', ') : (rawReport.address_combined || 'Address unrecorded');
        })(),
      },
      cadastralCode,
      ownerOccupant: {
        vi: ownerVi,
        en: ownerEn,
      },
      contactPhone: rawReport.owner_phone || json.ownerPhone || 'Chưa ghi nhận trong hồ sơ phần mềm',
      surveyConsultant: {
        vi: 'Liên danh CRLG – CRSRI – TT',
        en: 'CRLG – CRSRI – TT Joint Venture',
      },
      epcContractor: 'THACO - CREC',
      sectionZone: {
        vi: sectionZoneVi,
        en: sectionZoneEn,
      },
      relatedMetroWorks,
      gpsCoords: {
        lat: defaultLat,
        lng: defaultLng,
        formatted: `${defaultLat}, ${defaultLng}`,
      },
      surveyDate: surveyDateWithTime,
    };

    // CHƯƠNG II: THÔNG TIN CƠ BẢN VỀ TÒA NHÀ (SECTION II)
    const storeysAbove = specs.aboveFloors || json.aboveFloors || specs.above_floors || specs.floor_count || rawReport.parcel_floor_count || 1;
    const storeysBasement = specs.undergroundFloors || json.undergroundFloors || specs.underground_floors || specs.basement_count || 0;

    // 1. Diện tích đất ban đầu (parcels.land_area_m2)
    const rawLandArea = rawReport.land_area_m2 ?? json.landAreaM2;
    const landAreaM2 = (rawLandArea !== undefined && rawLandArea !== null && rawLandArea !== '' && !isNaN(Number(rawLandArea)))
      ? Number(rawLandArea).toFixed(1)
      : '';

    // 2. Diện tích xây dựng tầng trệt do KSV thu thập (specs.construction_area_m2)
    const rawFootprint = specs.constructionAreaM2 || json.constructionAreaM2 || specs.construction_area_m2 || rawReport.parcel_construction_area_m2;
    const footprintM2 = (rawFootprint !== undefined && rawFootprint !== null && rawFootprint !== '' && !isNaN(Number(rawFootprint)))
      ? Number(rawFootprint).toFixed(1)
      : '';

    // 3. Tổng diện tích sàn (GFA = Footprint tầng trệt * số tầng)
    const totalFloorAreaM2 = (footprintM2 && storeysAbove) ? (Number(footprintM2) * Number(storeysAbove)).toFixed(1) : '';

    const floorAreaDisplay: BilingualText = {
      vi: totalFloorAreaM2
        ? `Tổng diện tích sàn: ${totalFloorAreaM2} m² (Diện tích đất: ${landAreaM2 || '–'} m² | Diện tích xây dựng tầng trệt: ${footprintM2} m²)`
        : (landAreaM2 ? `Diện tích đất: ${landAreaM2} m²` : 'Chưa có số liệu diện tích đo đạc'),
      en: totalFloorAreaM2
        ? `Total floor area: ${totalFloorAreaM2} m² (Land plot area: ${landAreaM2 || '–'} m² | Ground floor footprint: ${footprintM2} m²)`
        : (landAreaM2 ? `Land plot area: ${landAreaM2} m²` : 'Area data unrecorded'),
    };

    // Kích thước chính trích xuất từ đa giác ranh thửa đất ban đầu (PostGIS ST_OrientedEnvelope)
    const rawSide1 = Number(rawReport.parcel_side_a_m);
    const rawSide2 = Number(rawReport.parcel_side_b_m);
    const rawHeight = Number(specs.buildingHeightM || json.buildingHeightM || specs.building_height_m || 0);
    let maxHeightM: string;
    let typicalStoreyM: string;
    if (rawHeight > 0 && rawHeight <= 4.5 && Number(storeysAbove) > 1) {
      typicalStoreyM = rawHeight.toFixed(1);
      maxHeightM = (rawHeight * Number(storeysAbove)).toFixed(1);
    } else if (rawHeight > 4.5) {
      maxHeightM = rawHeight.toFixed(1);
      typicalStoreyM = (rawHeight / Number(storeysAbove)).toFixed(1);
    } else {
      typicalStoreyM = '–';
      maxHeightM = '–';
    }

    let mainDimensions: BilingualText;
    if (rawSide1 > 0 && rawSide2 > 0) {
      const widthM = Math.min(rawSide1, rawSide2).toFixed(1);
      const lengthM = Math.max(rawSide1, rawSide2).toFixed(1);
      mainDimensions = {
        vi: `Mặt tiền ${widthM} m × Chiều sâu ${lengthM} m${maxHeightM !== '–' ? ` (Chiều cao: ${maxHeightM} m)` : ''}`,
        en: `Width ${widthM} m × Length ${lengthM} m${maxHeightM !== '–' ? ` (Height: ${maxHeightM} m)` : ''}`,
      };
    } else {
      mainDimensions = {
        vi: `Chưa đo đạc kích thước ranh thửa${maxHeightM !== '–' ? ` (Chiều cao: ${maxHeightM} m)` : ''}`,
        en: `Plot dimensions unrecorded${maxHeightM !== '–' ? ` (Height: ${maxHeightM} m)` : ''}`,
      };
    }

    // Khoảng cách đến Metro: Tim tuyến & Biên kết cấu hố đào
    const distCenterlineRaw = rawReport.distance_to_centerline_m ?? json.metroOffsetDistance;
    let distanceToMetroAlignmentM: string = '';
    let distanceToMetroEdgeM: string = '';
    let distanceToMetroDisplay: BilingualText;
    if (distCenterlineRaw !== undefined && distCenterlineRaw !== null && distCenterlineRaw !== '' && !isNaN(Number(distCenterlineRaw))) {
      distanceToMetroAlignmentM = Number(distCenterlineRaw).toFixed(1);
      distanceToMetroEdgeM = Math.max(0, Number(distanceToMetroAlignmentM) - 15.0).toFixed(1);
      distanceToMetroDisplay = {
        vi: `Tim tuyến: ${distanceToMetroAlignmentM} m | Biên hố đào/kết cấu: ${distanceToMetroEdgeM} m`,
        en: `To alignment centerline: ${distanceToMetroAlignmentM} m | To excavation boundary: ${distanceToMetroEdgeM} m`,
      };
    } else {
      distanceToMetroDisplay = {
        vi: 'Chưa xác định khoảng cách đến Metro',
        en: 'Distance to Metro alignment unrecorded',
      };
    }

    // Khoảng cách tĩnh không: Tuyến Metro khoan ngầm
    const rawFoundDepth = json.foundationDepthM ?? specs.foundation_depth_m;
    let clearanceVerticalM: string = '';
    let clearance3DM: string = '';
    let clearanceDisplay: BilingualText;
    if (distanceToMetroAlignmentM && rawFoundDepth !== undefined && rawFoundDepth !== null && rawFoundDepth !== '' && !isNaN(Number(rawFoundDepth))) {
      const foundationDepthM = Number(rawFoundDepth);
      clearanceVerticalM = Math.max(0, 25.0 - foundationDepthM).toFixed(1);
      clearance3DM = Math.sqrt(
        Math.pow(Number(distanceToMetroAlignmentM), 2) + Math.pow(Number(clearanceVerticalM), 2)
      ).toFixed(1);
      clearanceDisplay = {
        vi: `Tĩnh không đứng: ${clearanceVerticalM} m (Đỉnh hầm dự kiến: -25.0 m, Đáy móng: -${foundationDepthM.toFixed(1)} m) | Tĩnh không 3D: ${clearance3DM} m`,
        en: `Vertical clearance: ${clearanceVerticalM} m (Tunnel depth: -25.0 m, Foundation: -${foundationDepthM.toFixed(1)} m) | 3D clearance: ${clearance3DM} m`,
      };
    } else {
      clearanceDisplay = {
        vi: 'Chưa có số liệu tính tĩnh không',
        en: 'Clearance data unrecorded',
      };
    }

    const section2: Section2BasicBuildingInfo = {
      use: {
        vi: bldgNameVi,
        en: bldgNameEn,
      },
      storeysAbove,
      storeysBasement,
      storeysDisplay: {
        vi: `Nổi: ${storeysAbove} tầng; Hầm: ${storeysBasement}`,
        en: `Above ground: ${storeysAbove} storeys; Basement: ${storeysBasement}`,
      },
      landAreaM2,
      footprintM2,
      totalFloorAreaM2,
      floorAreaDisplay,
      mainDimensions,
      maxHeightM,
      typicalStoreyHeightM: `${typicalStoreyM} m`,
      yearConstructed: specs.constructionYear || json.constructionYear || specs.year_of_construction || '–',
      isEstimatedYear: Boolean(specs.isEstimatedYear || json.isEstimatedYear || specs.is_year_estimated),
      distanceToMetroAlignmentM,
      distanceToMetroEdgeM,
      distanceToMetroDisplay,
      clearanceVerticalM,
      clearance3DM,
      clearanceDisplay,
      surveyCategory: {
        vi: 'Công trình thông thường – Khảo sát bình thường (từ móng đến mái)',
        en: 'General building – Normal survey (from foundation to roof)',
      },
    };

    // PHỤ LỤC 2: MAP TẦNG & GOM KHUYẾT TẬT (Tính toán sớm để phục vụ Mục IV & V)
    const rawFloors = (rawReport.floors && Array.isArray(rawReport.floors) && rawReport.floors.length > 0)
      ? rawReport.floors
      : (json.floors && Array.isArray(json.floors) && json.floors.length > 0)
        ? json.floors
        : [];

    const appendix2 = FloorDefectMapper.mapFloors(rawFloors, { current: 5 }, buildingId, rawSurveyDate);

    // CHƯƠNG VI: TÓM TẮT ĐIỀU TRA LỖI & BCS CHECKLIST (ĐỘNG TỪ PHỤ LỤC 2 & STEP 3/4)
    const allDefectRows = appendix2.flatMap((f) => f.defectSummaryRows);

    // 1. Phân loại 4 nhóm khuyết tật chuẩn theo Step 3
    const structuralDefects = allDefectRows.filter((d) =>
      d.location.vi.includes('Cấu kiện') ||
      d.defectType.vi.toLowerCase().includes('cột') ||
      d.defectType.vi.toLowerCase().includes('dầm') ||
      d.defectType.vi.toLowerCase().includes('sàn') ||
      d.defectType.vi.toLowerCase().includes('kết cấu')
    );

    const masonryPlasterCracks = allDefectRows.filter((d) =>
      !structuralDefects.includes(d) &&
      d.widthMm !== '–'
    );

    const moistureDefects = allDefectRows.filter((d) =>
      !structuralDefects.includes(d) &&
      (d.defectType.vi.toLowerCase().includes('thấm') ||
       d.defectType.vi.toLowerCase().includes('ẩm') ||
       d.description.vi.toLowerCase().includes('ẩm') ||
       d.description.vi.toLowerCase().includes('thấm'))
    );

    const spallingAndOtherDefects = allDefectRows.filter((d) =>
      !structuralDefects.includes(d) &&
      !masonryPlasterCracks.includes(d) &&
      !moistureDefects.includes(d)
    );

    const surfaceCracksCount = masonryPlasterCracks.length;
    const structuralCracksCount = structuralDefects.length;

    const floorsWithDefects = appendix2.filter((f) => f.hasDefects);

    // Bề rộng và chiều dài lớn nhất
    const crackWidths = allDefectRows
      .filter((d) => d.widthMm !== '–')
      .map((d) => parseFloat(String(d.widthMm).replace(/[^\d.]/g, '')))
      .filter((w) => !isNaN(w) && w > 0);
    const maxCrackWidthMm = crackWidths.length > 0 ? `${Math.max(...crackWidths)}` : '0.0';

    const crackLengths = allDefectRows
      .filter((d) => d.lengthM !== '–')
      .map((d) => parseFloat(String(d.lengthM).replace(/[^\d.]/g, '')))
      .filter((l) => !isNaN(l) && l > 0);
    const maxCrackLengthM = crackLengths.length > 0 ? `${Math.max(...crackLengths)}` : '0.0';

    // Tìm khuyết tật chi phối nguy hiểm nhất (Governing Worst Defect)
    const crackRows = allDefectRows.filter((d) => d.widthMm !== '–');
    let governingDefect: any = undefined;
    if (crackRows.length > 0) {
      let maxRow = crackRows[0];
      let maxVal = parseFloat(String(maxRow.widthMm).replace(/[^\d.]/g, '')) || 0;
      for (const r of crackRows) {
        const val = parseFloat(String(r.widthMm).replace(/[^\d.]/g, '')) || 0;
        if (val > maxVal) {
          maxVal = val;
          maxRow = r;
        }
      }
      governingDefect = {
        code: maxRow.defectId,
        location: maxRow.location,
        type: maxRow.defectType,
        wmaxMm: maxRow.widthMm,
        lengthM: maxRow.lengthM,
        status: {
          vi: maxRow.description.vi.includes('Phương') ? maxRow.description.vi : 'Hiện trạng ổn định',
          en: 'Currently stable',
        },
      };
    }

    // 2. Bảng VI.1: Ma trận phân bố khuyết tật theo từng tầng (Defect Distribution Matrix by Floor)
    const floorDistribution = appendix2.map((fl) => {
      const flDefs = fl.defectSummaryRows;
      const flStruct = flDefs.filter((d) =>
        d.location.vi.includes('Cấu kiện') ||
        d.defectType.vi.toLowerCase().includes('cột') ||
        d.defectType.vi.toLowerCase().includes('dầm') ||
        d.defectType.vi.toLowerCase().includes('sàn')
      );
      const flMasonry = flDefs.filter((d) => !flStruct.includes(d) && d.widthMm !== '–');
      const flMoist = flDefs.filter((d) =>
        !flStruct.includes(d) &&
        (d.defectType.vi.toLowerCase().includes('thấm') ||
         d.defectType.vi.toLowerCase().includes('ẩm') ||
         d.description.vi.toLowerCase().includes('ẩm') ||
         d.description.vi.toLowerCase().includes('thấm'))
      );
      const flSpallAndOther = flDefs.filter((d) =>
        !flStruct.includes(d) && !flMasonry.includes(d) && !flMoist.includes(d)
      );

      const flCrackWidths = flDefs
        .filter((d) => d.widthMm !== '–')
        .map((d) => parseFloat(String(d.widthMm).replace(/[^\d.]/g, '')))
        .filter((w) => !isNaN(w) && w > 0);
      const flMaxW = flCrackWidths.length > 0 ? `${Math.max(...flCrackWidths)} mm` : '–';

      let statusVi = 'Không';
      let statusEn = 'None';
      if (flDefs.length > 0) {
        const partsVi: string[] = [];
        const partsEn: string[] = [];
        if (flStruct.length > 0) {
          partsVi.push(`${flStruct.length} nứt kết cấu (wmax = ${flMaxW})`);
          partsEn.push(`${flStruct.length} structural crack(s)`);
        }
        if (flMasonry.length > 0) {
          partsVi.push(`${flMasonry.length} nứt tường/vữa (wmax = ${flMaxW})`);
          partsEn.push(`${flMasonry.length} masonry crack(s)`);
        }
        if (flMoist.length > 0) {
          partsVi.push(`${flMoist.length} vị trí ẩm mốc/thấm`);
          partsEn.push(`${flMoist.length} dampness spot(s)`);
        }
        if (flSpallAndOther.length > 0) {
          partsVi.push(`${flSpallAndOther.length} bong rộp & khác`);
          partsEn.push(`${flSpallAndOther.length} spalling & other`);
        }
        statusVi = partsVi.join(', ');
        statusEn = partsEn.join(', ');
      }

      return {
        floorName: fl.floorName,
        surveyedObjectsCount: fl.zoneAndElementConditions.length,
        structuralCracksCount: flStruct.length,
        masonryPlasterCracksCount: flMasonry.length,
        moistureCount: flMoist.length,
        spallingCount: flSpallAndOther.length,
        maxCrackWidthMm: flMaxW,
        conditionStatus: { vi: statusVi, en: statusEn },
      };
    });

    // 3. Đánh giá biến dạng từ Section 5
    const deformInit = json.settlementTilt || rawReport.deformation || {};
    const hasDeformTilt = (deformInit.buildingTilt?.level ?? 0) > 0;
    const hasDeformDiff = (deformInit.diffSettlement?.level ?? 0) > 0 || Boolean(deformInit.diffSettlement?.notes?.trim());
    const hasDeformSag = (deformInit.beamSagging?.level ?? 0) > 0 || Boolean(deformInit.beamSagging?.sagMm && Number(deformInit.beamSagging.sagMm) > 0);
    const hasDeform = hasDeformTilt || hasDeformDiff || hasDeformSag;

    // 4. Bảng VI.2: Danh mục 8 nhóm kiểm tra BCS Checklist chuẩn quốc tế
    const structLocationSummary = structuralDefects.length > 0
      ? `${structuralDefects.length} vết nứt tại ${Array.from(new Set(structuralDefects.map(d => d.location.vi.split(' - ')[0]))).join(', ')}`
      : 'Không';
    const structLocationSummaryEn = structuralDefects.length > 0
      ? `${structuralDefects.length} crack(s) at ${Array.from(new Set(structuralDefects.map(d => d.location.en.split(' - ')[0]))).join(', ')}`
      : 'None';

    const masonryLocationSummary = masonryPlasterCracks.length > 0
      ? `${masonryPlasterCracks.length} vết nứt tại ${Array.from(new Set(masonryPlasterCracks.map(d => d.location.vi.split(' - ')[0]))).join(', ')}`
      : 'Không';
    const masonryLocationSummaryEn = masonryPlasterCracks.length > 0
      ? `${masonryPlasterCracks.length} crack(s) at ${Array.from(new Set(masonryPlasterCracks.map(d => d.location.en.split(' - ')[0]))).join(', ')}`
      : 'None';

    const moistureLocationSummary = moistureDefects.length > 0
      ? `${moistureDefects.length} vị trí ẩm mốc/thấm tại ${Array.from(new Set(moistureDefects.map(d => d.location.vi.split(' - ')[0]))).join(', ')}`
      : 'Không';
    const moistureLocationSummaryEn = moistureDefects.length > 0
      ? `${moistureDefects.length} spot(s) at ${Array.from(new Set(moistureDefects.map(d => d.location.en.split(' - ')[0]))).join(', ')}`
      : 'None';

    const spallingLocationSummary = spallingAndOtherDefects.length > 0
      ? `${spallingAndOtherDefects.length} vị trí bong rộp/khác tại ${Array.from(new Set(spallingAndOtherDefects.map(d => d.location.vi.split(' - ')[0]))).join(', ')}`
      : 'Không';
    const spallingLocationSummaryEn = spallingAndOtherDefects.length > 0
      ? `${spallingAndOtherDefects.length} spot(s) at ${Array.from(new Set(spallingAndOtherDefects.map(d => d.location.en.split(' - ')[0]))).join(', ')}`
      : 'None';

    const totalSurveyedObjects = floorDistribution.reduce((acc, f) => acc + f.surveyedObjectsCount, 0);
    const maxCrackWidthDisplay = crackWidths.length > 0 ? `${Math.max(...crackWidths)} mm` : '–';

    const section6: Section6DefectSummary = {
      totalDefects: allDefectRows.length,
      totalFloors: appendix2.length,
      floorsWithDefectsCount: floorsWithDefects.length,
      structuralCracksCount,
      masonryPlasterCracksCount: surfaceCracksCount,
      moistureDefectsCount: moistureDefects.length,
      spallingDefectsCount: spallingAndOtherDefects.length,
      otherDefectsCount: 0,
      totalSurveyedObjects,
      maxCrackWidthMm,
      totalMaxCrackWidthDisplay: maxCrackWidthDisplay,
      maxCrackLengthM,
      governingDefect,
      floorDistribution,
      checklist: [
        {
          groupVi: 'Nứt', groupEn: 'Cracking',
          indicatorVi: 'Nứt cấu kiện kết cấu chịu lực (Cột/Dầm/Sàn)', indicatorEn: 'Cracks in structural members (columns/beams/slabs)',
          recorded: structuralCracksCount > 0,
          recordedLabel: structuralCracksCount > 0 ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: structuralCracksCount > 0
            ? { vi: structLocationSummary, en: structLocationSummaryEn }
            : { vi: 'Không', en: 'None' },
          riskLevel: structuralCracksCount > 0 ? { vi: 'Trung bình / Theo dõi', en: 'Medium / Monitor' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Nứt', groupEn: 'Cracking',
          indicatorVi: 'Nứt tường gạch / Khối xây chèn', indicatorEn: 'Cracks in masonry / infill walls',
          recorded: masonryPlasterCracks.length > 0,
          recordedLabel: masonryPlasterCracks.length > 0 ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: masonryPlasterCracks.length > 0
            ? { vi: masonryLocationSummary, en: masonryLocationSummaryEn }
            : { vi: 'Không', en: 'None' },
          riskLevel: masonryPlasterCracks.length > 0 ? { vi: 'Thấp / Thẩm mỹ', en: 'Low / Aesthetic' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Nứt', groupEn: 'Cracking',
          indicatorVi: 'Nứt lớp vữa trát / Lớp hoàn thiện kiến trúc', indicatorEn: 'Cracks in plaster / surface finishes',
          recorded: masonryPlasterCracks.some(d => d.defectType.vi.toLowerCase().includes('chân chim') || d.defectType.vi.toLowerCase().includes('mạng nhện')),
          recordedLabel: masonryPlasterCracks.some(d => d.defectType.vi.toLowerCase().includes('chân chim') || d.defectType.vi.toLowerCase().includes('mạng nhện'))
            ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: masonryPlasterCracks.some(d => d.defectType.vi.toLowerCase().includes('chân chim') || d.defectType.vi.toLowerCase().includes('mạng nhện'))
            ? {
                vi: 'Nứt rạn chân chim lớp vữa trát tường kiến trúc',
                en: 'Hairline crazing cracks in architectural plaster',
              }
            : { vi: 'Không', en: 'None' },
          riskLevel: masonryPlasterCracks.some(d => d.defectType.vi.toLowerCase().includes('chân chim') || d.defectType.vi.toLowerCase().includes('mạng nhện'))
            ? { vi: 'Thấp', en: 'Low' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Nước', groupEn: 'Water',
          indicatorVi: 'Thấm nước / Rò rỉ / Ẩm mốc loang lổ', indicatorEn: 'Water seepage, dampness & efflorescence',
          recorded: moistureDefects.length > 0,
          recordedLabel: moistureDefects.length > 0 ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: moistureDefects.length > 0
            ? { vi: moistureLocationSummary, en: moistureLocationSummaryEn }
            : { vi: 'Không', en: 'None' },
          riskLevel: moistureDefects.length > 0 ? { vi: 'Thấp / Hoàn thiện', en: 'Low / Finish' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Suy giảm', groupEn: 'Deterioration',
          indicatorVi: 'Bong rộp sơn vôi / Phồng rộp gạch ốp lát', indicatorEn: 'Blistering of paint & spalling tiles',
          recorded: spallingAndOtherDefects.some(d => d.defectType.vi.toLowerCase().includes('bong') || d.defectType.vi.toLowerCase().includes('rộp') || d.defectType.vi.toLowerCase().includes('tróc') || d.defectType.vi.toLowerCase().includes('gạch')),
          recordedLabel: spallingAndOtherDefects.some(d => d.defectType.vi.toLowerCase().includes('bong') || d.defectType.vi.toLowerCase().includes('rộp') || d.defectType.vi.toLowerCase().includes('tróc') || d.defectType.vi.toLowerCase().includes('gạch'))
            ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: spallingAndOtherDefects.some(d => d.defectType.vi.toLowerCase().includes('bong') || d.defectType.vi.toLowerCase().includes('rộp') || d.defectType.vi.toLowerCase().includes('tróc') || d.defectType.vi.toLowerCase().includes('gạch'))
            ? { vi: spallingLocationSummary, en: spallingLocationSummaryEn }
            : { vi: 'Không', en: 'None' },
          riskLevel: spallingAndOtherDefects.some(d => d.defectType.vi.toLowerCase().includes('bong') || d.defectType.vi.toLowerCase().includes('rộp') || d.defectType.vi.toLowerCase().includes('tróc') || d.defectType.vi.toLowerCase().includes('gạch'))
            ? { vi: 'Thấp', en: 'Low' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Suy giảm', groupEn: 'Deterioration',
          indicatorVi: 'Rỉ cốt thép / Vỡ trơ cốt thép chịu lực', indicatorEn: 'Rebar corrosion & concrete spalling',
          recorded: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('rỉ') || d.defectType.vi.toLowerCase().includes('lộ thép') || d.defectType.vi.toLowerCase().includes('trơ thép')),
          recordedLabel: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('rỉ') || d.defectType.vi.toLowerCase().includes('lộ thép') || d.defectType.vi.toLowerCase().includes('trơ thép'))
            ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('rỉ') || d.defectType.vi.toLowerCase().includes('lộ thép') || d.defectType.vi.toLowerCase().includes('trơ thép'))
            ? { vi: 'Ghi nhận rỉ sét cốt thép / vỡ trơ cốt thép', en: 'Rebar corrosion / concrete spalling observed' }
            : { vi: 'Không', en: 'None' },
          riskLevel: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('rỉ') || d.defectType.vi.toLowerCase().includes('lộ thép') || d.defectType.vi.toLowerCase().includes('trơ thép'))
            ? { vi: 'Cao', en: 'High' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Biến dạng', groupEn: 'Deformation',
          indicatorVi: 'Biến dạng hình học (Nghiêng, lún chênh, võng)', indicatorEn: 'Tilt, differential settlement & deflection',
          recorded: hasDeform,
          recordedLabel: hasDeform ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: hasDeform
            ? {
                vi: 'Ghi nhận biến dạng đo đạc tại hiện trường (chi tiết Mục V)',
                en: 'Measured deformation recorded on site (see Section V)',
              }
            : { vi: 'Không', en: 'None' },
          riskLevel: hasDeform ? { vi: 'Trung bình', en: 'Medium' } : { vi: 'Không', en: 'None' },
        },
        {
          groupVi: 'Hư hỏng', groupEn: 'Damage',
          indicatorVi: 'Hư hỏng cơ học & Kẹt cửa đi / Cửa sổ', indicatorEn: 'Mechanical damage & sticking doors/windows',
          recorded: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('kẹt') || d.defectType.vi.toLowerCase().includes('cửa') || d.defectType.vi.toLowerCase().includes('hư hỏng')),
          recordedLabel: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('kẹt') || d.defectType.vi.toLowerCase().includes('cửa') || d.defectType.vi.toLowerCase().includes('hư hỏng'))
            ? { vi: 'CÓ', en: 'YES' } : { vi: 'Không', en: 'None' },
          locationSeverity: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('kẹt') || d.defectType.vi.toLowerCase().includes('cửa') || d.defectType.vi.toLowerCase().includes('hư hỏng'))
            ? { vi: 'Ghi nhận hiện tượng kẹt cửa / hư hỏng cơ học', en: 'Sticking doors / mechanical damage observed' }
            : { vi: 'Không', en: 'None' },
          riskLevel: allDefectRows.some(d => d.defectType.vi.toLowerCase().includes('kẹt') || d.defectType.vi.toLowerCase().includes('cửa') || d.defectType.vi.toLowerCase().includes('hư hỏng'))
            ? { vi: 'Thấp', en: 'Low' } : { vi: 'Không', en: 'None' },
        },
      ],
      notes: {
        vi: `Tổng hợp ghi nhận ${allDefectRows.length} khuyết tật trên ${appendix2.length} tầng khảo sát (${structuralCracksCount} nứt kết cấu, ${surfaceCracksCount} nứt tường/vữa, ${moistureDefects.length} vị trí ẩm mốc, ${spallingAndOtherDefects.length} vị trí bong rộp & khác). 100% khuyết tật được định vị trên bản vẽ CAD và ghép cặp ảnh đối chiếu có thước đo tại Phụ lục 2.`,
        en: `A total of ${allDefectRows.length} defects recorded across ${appendix2.length} surveyed floors (${structuralCracksCount} structural cracks, ${surfaceCracksCount} masonry cracks, ${moistureDefects.length} dampness spots, ${spallingAndOtherDefects.length} spalling & other spots). 100% of defects are mapped on CAD floor plans and paired with crack-gauge photos in Appendix 2.`,
      },
      discrepancyNote: {
        vi: 'Khảo sát hiện trường đã kiểm tra toàn bộ bề mặt kiến trúc và cấu kiện kết cấu theo danh mục BCS Checklist.',
        en: 'Field survey inspected all architectural surfaces and structural members per the BCS Checklist.',
      },
      crackQuantities: {
        totalCracks: allDefectRows.length,
        maxCrackWidthMm,
        maxCrackLengthM,
      },
    };

    // CHƯƠNG III: LỊCH SỬ VÀ TÌNH TRẠNG SỬ DỤNG
    const historyRaw = json.historyInterview || {};
    let dbDetails: any = {};
    if (rawReport.historicalSensitivity?.details) {
      try {
        dbDetails = typeof rawReport.historicalSensitivity.details === 'string'
          ? JSON.parse(rawReport.historicalSensitivity.details)
          : rawReport.historicalSensitivity.details;
      } catch (e) {
        // Fallback
      }
    }
    const historyObj = { ...dbDetails, ...historyRaw };

    const renovationLoad = Number(historyObj.renovationLoad ?? (rawReport.historicalSensitivity?.extended_or_renovated ? 1 : 0));
    const majorRepair = Number(historyObj.majorRepair ?? 0);
    const pastSettlement = Number(historyObj.pastSettlement ?? (rawReport.historicalSensitivity?.previous_settlement_or_tilt ? 1 : 0));
    const neighborDamage = Number(historyObj.neighborDamage ?? 0);
    const fireFloodIncident = Number(historyObj.fireFloodIncident ?? (rawReport.historicalSensitivity?.fire_or_accident ? 1 : 0));
    const usageStr = String(historyObj.usageStatus || 'Đầy đủ (100%)');
    const sensEquip = historyObj.sensitiveEquipment || {
      has: Boolean(rawReport.historicalSensitivity?.sensitive_equipment_present),
      description: '',
    };

    const section3: Section3HistoryOccupancy = {
      changeOfUse: renovationLoad === 0
        ? { vi: 'Chưa ghi nhận', en: 'Not recorded' }
        : renovationLoad === 1
          ? { vi: 'Nhẹ – Đã xử lý ổn định', en: 'Minor – Stabilised' }
          : renovationLoad === 2
            ? { vi: 'Nhiều – Chưa rõ kết cấu', en: 'Moderate – Unclear structure' }
            : { vi: 'Thay đổi lớn – Ảnh hưởng tải trọng', en: 'Major – Significant loading change' },

      extension: renovationLoad === 0
        ? { vi: 'Không ghi nhận', en: 'Not recorded' }
        : renovationLoad === 1
          ? { vi: 'Có cơi nới nhẹ / sửa chữa nhỏ', en: 'Minor extension reported' }
          : { vi: 'Có cơi nới / mở rộng quy mô lớn', en: 'Substantial extension reported' },

      structuralAlteration: majorRepair === 0
        ? { vi: 'Chưa ghi nhận', en: 'Not recorded' }
        : majorRepair === 1
          ? { vi: 'Có cải tạo nhẹ kết cấu', en: 'Minor structural alteration' }
          : { vi: 'Có cải tạo lớn ảnh hưởng chịu lực', en: 'Major structural alteration' },

      majorRepair: majorRepair === 0
        ? { vi: 'Không', en: 'No' }
        : majorRepair === 1
          ? { vi: 'Có – Nhẹ, đã xử lý ổn định', en: 'Yes – Minor, stabilised' }
          : majorRepair === 2
            ? { vi: 'Có – Nhiều, chưa rõ hồ sơ hoàn công', en: 'Yes – Substantial, unverified documentation' }
            : { vi: 'Có – Cải tạo lớn ảnh hưởng chịu lực', en: 'Yes – Major structural repair' },

      fireHistory: fireFloodIncident === 0
        ? { vi: 'Không', en: 'None' }
        : fireFloodIncident === 1
          ? { vi: 'Không', en: 'None' }
          : { vi: 'Có ghi nhận', en: 'Recorded' },

      flooding: fireFloodIncident === 0
        ? { vi: 'Không', en: 'None' }
        : fireFloodIncident === 1
          ? { vi: 'Nhẹ (đã khắc phục)', en: 'Minor (remediated)' }
          : { vi: 'Có ghi nhận', en: 'Recorded' },

      fireAndFlooding: fireFloodIncident === 0
        ? { vi: 'Cháy: Không | Ngập lụt: Không', en: 'Fire: None | Flooding: None' }
        : fireFloodIncident === 1
          ? { vi: 'Cháy: Không | Ngập lụt: Nhẹ (đã khắc phục)', en: 'Fire: None | Flooding: Minor (remediated)' }
          : fireFloodIncident === 2
            ? { vi: 'Có sự cố trung bình (chưa rõ ảnh hưởng)', en: 'Moderate fire/flooding incident recorded' }
            : { vi: 'Có sự cố nghiêm trọng (ảnh hưởng kết cấu)', en: 'Severe fire/flooding incident recorded' },

      previousSettlementTilt: pastSettlement === 0
        ? { vi: 'Không phát hiện lún nghiêng trước đây', en: 'No prior settlement or tilt observed' }
        : pastSettlement === 1
          ? { vi: 'Có ghi nhận lún nghiêng nhẹ (đã ổn định)', en: 'Minor past settlement/tilt reported (stabilised)' }
          : pastSettlement === 2
            ? { vi: 'Có ghi nhận lún nghiêng rõ (tiếp diễn)', en: 'Evident ongoing settlement/tilt reported' }
            : { vi: 'Có sự cố lún nghiêng nghiêm trọng', en: 'Severe settlement/tilt incident reported' },

      occupancyStatus: usageStr.includes('Đầy đủ')
        ? { vi: 'Đang sử dụng bình thường (100%)', en: 'In normal full use (100%)' }
        : usageStr.includes('một phần')
          ? { vi: 'Đang sử dụng một phần', en: 'Partially occupied' }
          : (usageStr.includes('Bỏ trống') || usageStr.includes('Không sử dụng'))
            ? { vi: 'Bỏ trống – Không sử dụng', en: 'Vacant / Unoccupied' }
            : { vi: usageStr.includes('Đang') ? usageStr : `Đang sử dụng (${usageStr})`, en: `In use (${usageStr})` },

      sensitiveEquipment: sensEquip.has
        ? { vi: `Có: ${sensEquip.description || 'Thiết bị chính xác / Y tế'}`, en: `Yes: ${sensEquip.description || 'Precision / Medical equipment'}` }
        : { vi: 'Không có thiết bị nhạy cảm rung động', en: 'No vibration-sensitive equipment' },

      damageByAdjacentWorks: neighborDamage === 0
        ? { vi: 'Không', en: 'No' }
        : neighborDamage === 1
          ? { vi: 'Có – Nhẹ, đã bồi thường/khắc phục', en: 'Yes – Minor, compensated/repaired' }
          : neighborDamage === 2
            ? { vi: 'Có – Ảnh hưởng đáng kể', en: 'Yes – Substantial damage' }
            : { vi: 'Có – Tranh chấp / Ảnh hưởng nghiêm trọng', en: 'Yes – Severe damage / Disputed' },

      informationSource: {
        vi: 'Phỏng vấn chủ hộ, Quan sát hiện trường',
        en: 'Property owner interview, Site observation',
      },
    };

    // CHƯƠNG IV: ĐẶC ĐIỂM KẾT CẤU VÀ MÓNG
    // 1. Tách biệt Loại hình kết cấu (Vật liệu / Hệ chịu lực)
    const rawStructSys = json.structureSystem || specs.structural_system || specs.structuralSystem || 'RC - BTCT';
    let structTypeVi = 'Khung bê tông cốt thép toàn khối (RC) (cột, dầm, sàn BTCT)';
    let structTypeEn = 'Reinforced Concrete (RC) Frame (columns, beams, slabs)';
    if (rawStructSys.includes('Steel') || rawStructSys.toLowerCase().includes('thép')) {
      structTypeVi = 'Khung kết cấu thép tiền chế';
      structTypeEn = 'Pre-engineered Steel Structure';
    } else if (rawStructSys.includes('Masonry') || rawStructSys.toLowerCase().includes('gạch')) {
      structTypeVi = 'Tường gạch chịu lực kết hợp sàn BTCT';
      structTypeEn = 'Load-bearing Brick Masonry with RC Slabs';
    } else if (rawStructSys.includes('Mixed') || rawStructSys.toLowerCase().includes('hỗn hợp')) {
      structTypeVi = 'Kết cấu hỗn hợp (BTCT kết hợp gạch/thép)';
      structTypeEn = 'Composite / Mixed Structural System';
    }

    // 2. Tách biệt Hình thức kết cấu (Hình thái kiến trúc không gian đô thị)
    const bldgTypeStr = (rawReport.building_type || json.surveyCaseType || json.usageFunction || '').toLowerCase();
    let structFormVi = 'Nhà phố liên kế nhiều tầng (Row / Terraced House)';
    let structFormEn = 'Terraced Row House';
    if (bldgTypeStr.includes('chung cư') || bldgTypeStr.includes('apartment') || bldgTypeStr.includes('condo')) {
      structFormVi = 'Tòa nhà chung cư / Căn hộ nhiều tầng';
      structFormEn = 'Multi-storey Condominium / Apartment Building';
    } else if (bldgTypeStr.includes('biệt thự') || bldgTypeStr.includes('độc lập') || bldgTypeStr.includes('standalone')) {
      structFormVi = 'Nhà riêng lẻ độc lập (Detached Single House)';
      structFormEn = 'Standalone / Detached House';
    } else if (bldgTypeStr.includes('thương mại') || bldgTypeStr.includes('shophouse') || bldgTypeStr.includes('văn phòng')) {
      structFormVi = 'Nhà phố thương mại / Văn phòng dịch vụ';
      structFormEn = 'Commercial Shophouse / Office Building';
    }

    // 3. Loại móng
    const rawFoundType = (json.foundationType || specs.foundation_category || specs.foundationType || '').toLowerCase();
    let foundTypeVi = 'Móng nông (Móng băng / Móng đơn / Móng bè)';
    let foundTypeEn = 'Shallow Foundation (Strip / Pad / Raft)';
    if (rawFoundType.includes('pc') || rawFoundType.includes('cọc ép')) {
      foundTypeVi = 'Móng cọc ép bê tông cốt thép (PC)';
      foundTypeEn = 'Precast Reinforced Concrete Driven Pile';
    } else if (rawFoundType.includes('cip') || rawFoundType.includes('khoan nhồi')) {
      foundTypeVi = 'Móng cọc khoan nhồi (CIP)';
      foundTypeEn = 'Cast-in-place Bored Pile';
    } else if (rawFoundType.includes('wood') || rawFoundType.includes('cừ tràm')) {
      foundTypeVi = 'Móng cừ tràm gia cố nền đất yếu';
      foundTypeEn = 'Melaleuca Wooden Pile Foundation';
    } else if (rawFoundType.includes('unknown') || rawFoundType.includes('không rõ')) {
      foundTypeVi = 'Chưa xác định rõ thông tin móng';
      foundTypeEn = 'Unverified / Unknown Foundation Type';
    }

    // 4. Kích thước cọc/móng
    const pileDim = json.pileDimensionMm || specs.pile_dimensions || (json.pileWidthMm && json.pileLengthMm ? `${json.pileWidthMm} × ${json.pileLengthMm} cm` : '');
    let pileSizeVi = pileDim;
    let pileSizeEn = pileDim;
    if (!pileDim) {
      if (foundTypeVi.includes('Móng nông')) {
        pileSizeVi = 'Móng nông – Không dùng cọc';
        pileSizeEn = 'Shallow foundation – No piles';
      } else {
        pileSizeVi = 'Không có số liệu kích thước';
        pileSizeEn = 'Not recorded / Unverified';
      }
    }

    // 5. Độ sâu móng
    let foundDepthVi = 'Chưa xác định độ sâu đáy móng';
    let foundDepthEn = 'Unverified foundation depth';
    if (rawFoundDepth !== undefined && rawFoundDepth !== null && rawFoundDepth !== '' && Number(rawFoundDepth) > 0) {
      foundDepthVi = `${Number(rawFoundDepth).toFixed(1)} m (Độ sâu đáy móng so với cốt nền)`;
      foundDepthEn = `${Number(rawFoundDepth).toFixed(1)} m (Foundation base depth from ground level)`;
    }

    // 6. Căn cứ xác định móng (CAT 1 - CAT 5)
    const rawFoundCat = Number(json.foundationCatScore || specs.foundation_cat_score || 3);
    const catEvidenceMap: Record<number, { vi: string; en: string }> = {
      1: { vi: 'Hồ sơ hoàn công được phê duyệt (CAT 1)', en: 'Approved as-built documentation (CAT 1)' },
      2: { vi: 'Bản vẽ thiết kế kết cấu do chủ hộ lưu giữ (CAT 2)', en: 'Design drawings kept by owner (CAT 2)' },
      3: { vi: 'Phỏng vấn chủ hộ xác nhận (CAT 3)', en: 'Property owner statement (CAT 3)' },
      4: { vi: 'Suy luận chuyên môn KSV tại hiện trường (CAT 4)', en: 'Surveyor on-site engineering assessment (CAT 4)' },
      5: { vi: 'Chưa có hồ sơ móng (CAT 5)', en: 'Unverified / No foundation documentation (CAT 5)' },
    };
    const foundEvidence = catEvidenceMap[rawFoundCat] || catEvidenceMap[3];

    // 7. Tình trạng kết cấu quan sát được (Data-driven từ kiểm tra khuyết tật thực tế)
    let visibleStructVi = 'Các cấu kiện chịu lực chính (cột, dầm, sàn) nguyên vẹn, ổn định tại thời điểm khảo sát';
    let visibleStructEn = 'Main load-bearing elements (columns, beams, slabs) intact and stable at survey time';
    if (structuralCracksCount > 0) {
      visibleStructVi = `Ghi nhận khuyết tật kết cấu cục bộ (${structuralCracksCount} vị trí nứt cấp ≥ 3, xem Mục VI & Phụ lục 2)`;
      visibleStructEn = `Localised structural defects observed (${structuralCracksCount} cracks grade ≥ 3, see Section VI & Appendix 2)`;
    } else if (surfaceCracksCount > 0) {
      visibleStructVi = 'Các cấu kiện chịu lực chính (cột, dầm, sàn) ổn định; ghi nhận nứt vữa hoàn thiện kiến trúc';
      visibleStructEn = 'Main load-bearing elements intact; minor aesthetic plaster cracks observed';
    }

    // 8. Công trình liền kề (Trái, Phải, Sau)
    let adjLeftVi = '';
    let adjRightVi = '';
    let adjBackVi = '';
    const rawAdj = json.adjacentBuildings || specs.adjacent_buildings || specs.adjacentBuildings;
    if (rawAdj) {
      try {
        const parsedAdj = typeof rawAdj === 'string' ? JSON.parse(rawAdj) : rawAdj;
        if (parsedAdj.left) {
          const lType = parsedAdj.left.type || parsedAdj.left.details || '';
          const lFloors = parsedAdj.left.floors ? `${parsedAdj.left.floors} tầng` : '';
          const lContact = parsedAdj.left.contact || '';
          const lNotes = parsedAdj.left.notes || '';
          adjLeftVi = [lType, lFloors, lContact, lNotes].filter(Boolean).join(' - ');
        }
        if (parsedAdj.right) {
          const rType = parsedAdj.right.type || parsedAdj.right.details || '';
          const rFloors = parsedAdj.right.floors ? `${parsedAdj.right.floors} tầng` : '';
          const rContact = parsedAdj.right.contact || '';
          const rNotes = parsedAdj.right.notes || '';
          adjRightVi = [rType, rFloors, rContact, rNotes].filter(Boolean).join(' - ');
        }
        if (parsedAdj.back || parsedAdj.rear) {
          const bObj = parsedAdj.back || parsedAdj.rear;
          const bType = bObj.type || bObj.details || '';
          const bFloors = bObj.floors ? `${bObj.floors} tầng` : '';
          const bContact = bObj.contact || '';
          const bNotes = bObj.notes || '';
          adjBackVi = [bType, bFloors, bContact, bNotes].filter(Boolean).join(' - ');
        }
      } catch (e) {
        // Fallback
      }
    }

    const translateAdj = (text: string) => {
      if (!text) return '';
      if (text.includes('Nhà') || text.includes('TOWN_HOUSE')) return 'Residential Townhouse';
      if (text.includes('Hẻm') || text.includes('Đường')) return 'Alley / Internal Road';
      if (text.includes('Đất') || text.includes('VACANT_LAND')) return 'Vacant Land';
      return text;
    };

    let adjSummaryVi = 'Chưa ghi nhận thông tin công trình liền kề';
    let adjSummaryEn = 'Adjacent buildings data unrecorded';
    if (adjLeftVi || adjRightVi || adjBackVi) {
      const pVi: string[] = [];
      const pEn: string[] = [];
      if (adjLeftVi) { pVi.push(`Trái: ${adjLeftVi}`); pEn.push(`Left: ${translateAdj(adjLeftVi)}`); }
      if (adjRightVi) { pVi.push(`Phải: ${adjRightVi}`); pEn.push(`Right: ${translateAdj(adjRightVi)}`); }
      if (adjBackVi) { pVi.push(`Sau: ${adjBackVi}`); pEn.push(`Rear: ${translateAdj(adjBackVi)}`); }
      adjSummaryVi = pVi.join(' | ');
      adjSummaryEn = pEn.join(' | ');
    }

    // Footing density and spacing
    const rawFDensity = json.foundationDensity || specs.foundation_density || specs.footingDensity;
    const rawFSpacing = json.foundationSpacingM || specs.foundation_spacing_m || specs.footingSpacing;
    let footingDensitySpacingVi = 'Chưa ghi nhận';
    let footingDensitySpacingEn = 'Not recorded';
    if (rawFDensity || rawFSpacing) {
      const fdPartsVi: string[] = [];
      const fdPartsEn: string[] = [];
      if (rawFDensity) { fdPartsVi.push(`Mật độ: ${rawFDensity}`); fdPartsEn.push(`Density: ${rawFDensity}`); }
      if (rawFSpacing) { fdPartsVi.push(`Khoảng cách tim: ${rawFSpacing} m`); fdPartsEn.push(`Spacing: ${rawFSpacing} m`); }
      footingDensitySpacingVi = fdPartsVi.join(' | ');
      footingDensitySpacingEn = fdPartsEn.join(' | ');
    }

    // 9. Ghi chú kỹ thuật
    const rawFNotes = json.foundationNotes || specs.foundation_notes;
    const remarksVi = rawFNotes
      ? rawFNotes
      : 'Thông tin hệ kết cấu và móng được tổng hợp từ hồ sơ hoàn công và khảo sát trực quan hiện trường.';
    const remarksEn = rawFNotes
      ? `Surveyor note: ${rawFNotes}`
      : 'Structural and foundation data gathered from as-built records and visual site observation.';

    const section4: Section4StructuralFoundation = {
      structuralType: { vi: structTypeVi, en: structTypeEn },
      structuralForm: { vi: structFormVi, en: structFormEn },
      foundationType: { vi: foundTypeVi, en: foundTypeEn },
      pileSize: { vi: pileSizeVi, en: pileSizeEn },
      footingDensitySpacing: { vi: footingDensitySpacingVi, en: footingDensitySpacingEn },
      foundationDepth: { vi: foundDepthVi, en: foundDepthEn },
      visibleStructuralCondition: { vi: visibleStructVi, en: visibleStructEn },
      adjacentBuildings: {
        vi: adjSummaryVi,
        en: adjSummaryEn,
      },
      foundationEvidence: foundEvidence,
      remarks: { vi: remarksVi, en: remarksEn },
    };

    // CHƯƠNG V: ĐỘ NGHIÊNG/LÚN - GHI NHẬN SƠ BỘ
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

    // CHƯƠNG VII: PHÂN LOẠI BURLAND 1977
    const section7 = BurlandCalculator.computeBurlandSection(rawFloors, json.burlandSummary);

    // CHƯƠNG VIII: ĐÁNH GIÁ RỦI RO & BỔ SUNG GIAI ĐOẠN 1
    const burlandMaxNum = typeof section7.localMaxGrade.vi === 'string' && section7.localMaxGrade.vi.includes('Cấp 5')
      ? 5
      : typeof section7.localMaxGrade.vi === 'string' && section7.localMaxGrade.vi.includes('Cấp 4')
        ? 4
        : typeof section7.localMaxGrade.vi === 'string' && section7.localMaxGrade.vi.includes('Cấp 3')
          ? 3
          : typeof section7.localMaxGrade.vi === 'string' && section7.localMaxGrade.vi.includes('Cấp 2')
            ? 2
            : typeof section7.localMaxGrade.vi === 'string' && section7.localMaxGrade.vi.includes('Cấp 1')
              ? 1
              : 0;

    const burlandPredominantNum = typeof section7.predominantGrade.vi === 'string' && section7.predominantGrade.vi.includes('Cấp 5')
      ? 5
      : typeof section7.predominantGrade.vi === 'string' && section7.predominantGrade.vi.includes('Cấp 4')
        ? 4
        : typeof section7.predominantGrade.vi === 'string' && section7.predominantGrade.vi.includes('Cấp 3')
          ? 3
          : typeof section7.predominantGrade.vi === 'string' && section7.predominantGrade.vi.includes('Cấp 2')
            ? 2
            : typeof section7.predominantGrade.vi === 'string' && section7.predominantGrade.vi.includes('Cấp 1')
              ? 1
              : 0;

    const section8 = RiskScoringCalculator.computeRiskAssessment(rawReport, burlandMaxNum, burlandPredominantNum);

    // CHƯƠNG IX: KẾT LUẬN & KIẾN NGHỊ (ĐỌC TRỰC TIẾP TỪ DB CỦA THỬA ĐẤT)
    const ownerFeedbackText = rawReport.owner_remarks || json.signatures?.ownerFeedback || json.ownerRemarks || '';
    const surveyorConclusionText = rawReport.summary_conclusions || json.summaryConclusions || '';

    const conclusionsList: BilingualText[] = [];
    if (surveyorConclusionText) {
      conclusionsList.push({
        vi: `Kết luận của Khảo sát viên hiện trường: ${surveyorConclusionText}`,
        en: `Surveyor field conclusion: ${surveyorConclusionText}`,
      });
    } else {
      conclusionsList.push({
        vi: `Sau khi hoàn thành công tác khảo sát hiện trường và đánh giá hiện trạng, công trình đang sử dụng ổn định. Ghi nhận tổng cộng ${allDefectRows.length} khuyết tật nứt (chi tiết tại Phụ lục 2). Không ghi nhận lún, nghiêng, võng bất thường.`,
        en: `Following on-site survey and assessment, the building is in stable use. A total of ${allDefectRows.length} cracks were recorded (detailed in Appendix 2). No abnormal settlement, tilt or deflection was observed.`,
      });
    }

    const witnessNarrative: BilingualText = ownerFeedbackText
      ? {
          vi: `Khảo sát được thực hiện với sự chứng kiến của chủ nhà (${rawReport.owner_name || json.ownerName || 'Chủ hộ'}). Ý kiến ghi nhận từ chủ nhà: "${ownerFeedbackText}".`,
          en: `The survey was witnessed by the owner. Owner's statement: "${ownerFeedbackText}".`,
        }
      : {
          vi: `Khảo sát được thực hiện với sự chứng kiến của chủ nhà (${rawReport.owner_name || json.ownerName || 'Chủ hộ'}); chủ nhà đồng ý với kết quả khảo sát và ký biên bản hiện trường.`,
          en: 'The survey was witnessed by the property owner, who agreed with the survey results and signed the field record.',
        };

    const conclusionFullText = (rawReport.summary_conclusions || json.summaryConclusions || '').toLowerCase();
    const hasWarningConclusion =
      conclusionFullText.includes('nguy hiểm') ||
      conclusionFullText.includes('sụt lún') ||
      conclusionFullText.includes('nứt nặng') ||
      conclusionFullText.includes('phát triển') ||
      conclusionFullText.includes('cần gia cố') ||
      Boolean(section7.localMaxGrade?.vi?.includes('Cấp 3')) ||
      Boolean(section7.localMaxGrade?.vi?.includes('Cấp 4')) ||
      Boolean(section7.localMaxGrade?.vi?.includes('Cấp 5'));

    const warningBadge: BilingualText | undefined = hasWarningConclusion
      ? {
          vi: 'CẢNH BÁO HIỆN TRƯỜNG: Vết nứt hoặc khuyết tật có dấu hiệu phát triển hoặc cần kỹ sư kết cấu theo dõi sát',
          en: 'FIELD WARNING: Observed cracks or defects exhibit potential progression risk or require close engineering monitoring',
        }
      : undefined;

    // Hạn chế khảo sát / Limitations: Liệt kê các trường thông tin bị thiếu từ khảo sát Phase 1
    const limitationsList: BilingualText[] = [];

    // 1. Kiểm tra khu vực/phạm vi không thể tiếp cận (Inaccessible areas)
    const inaccessible = rawReport.inaccessible_areas || json.accessLimitation?.restrictedAreas || json.inaccessibleAreas;
    if (inaccessible && inaccessible !== 'NONE' && inaccessible !== 'None' && inaccessible !== 'Không') {
      const areaStr = Array.isArray(inaccessible) ? inaccessible.join(', ') : String(inaccessible);
      if (areaStr.trim()) {
        limitationsList.push({
          vi: `Khu vực chưa tiếp cận khảo sát: ${areaStr.trim()}`,
          en: `Inaccessible survey areas: ${areaStr.trim()}`,
        });
      }
    }

    const accessNotes = rawReport.accessibility_limitations || json.accessLimitation?.notes || json.accessLimitation?.mainReason;
    if (accessNotes && typeof accessNotes === 'string' && accessNotes.trim()) {
      limitationsList.push({
        vi: `Lý do hạn chế tiếp cận: ${accessNotes.trim()}`,
        en: `Access limitation reason: ${accessNotes.trim()}`,
      });
    }

    // 2. Kiểm tra các trường thông tin khảo sát bị thiếu từ Phase 1 được KSV ghi nhận
    if (Array.isArray(json.missingSurveyFields) && json.missingSurveyFields.length > 0) {
      for (const field of json.missingSurveyFields) {
        if (typeof field === 'string' && field.trim()) {
          limitationsList.push({ vi: field.trim(), en: field.trim() });
        } else if (field?.vi) {
          limitationsList.push(field);
        }
      }
    } else if (json.surveyLimitations) {
      if (Array.isArray(json.surveyLimitations)) {
        for (const item of json.surveyLimitations) {
          if (typeof item === 'string' && item.trim()) limitationsList.push({ vi: item.trim(), en: item.trim() });
          else if (item?.vi) limitationsList.push(item);
        }
      } else if (typeof json.surveyLimitations === 'string' && json.surveyLimitations.trim()) {
        limitationsList.push({ vi: json.surveyLimitations.trim(), en: json.surveyLimitations.trim() });
      }
    }

    // 3. Kiểm tra thông tin kết cấu móng & bản vẽ hoàn công nếu chưa thu thập được
    const rawFoundation = specs.foundationType || json.foundationType;
    if (!rawFoundation || rawFoundation === 'UNKNOWN' || rawFoundation === 'CHUA_RO' || String(rawFoundation).toLowerCase().includes('chưa rõ') || String(rawFoundation).toLowerCase().includes('không rõ')) {
      limitationsList.push({
        vi: 'Thông tin kết cấu móng: Chưa thu thập được hồ sơ thiết kế/hoàn công tại thời điểm khảo sát',
        en: 'Foundation structural data: Design/as-built drawings unavailable at time of survey',
      });
    }

    const hasDrawings = specs.hasAsBuiltDrawings || specs.hasDrawings || json.hasDrawings || json.hasAsBuiltDrawings;
    if (hasDrawings === false) {
      limitationsList.push({
        vi: 'Hồ sơ bản vẽ hoàn công / kết cấu công trình: Chủ hộ không cung cấp được tại hiện trường',
        en: 'As-built / structural drawings: Not provided by property owner on site',
      });
    }

    const finalLimitations: BilingualText[] = limitationsList.length > 0
      ? limitationsList
      : [{ vi: 'Không', en: 'None' }];

    const section9: Section9ConclusionRecommendation = {
      conclusions: conclusionsList,
      overallRisk: {
        vi: `Cấp độ rủi ro tổng thể: ${section8.overallRisk.grade.vi} (Ma trận Rủi ro Cơ sở BRA = V × I); xác lập ranh giới hiện trạng cơ sở trước khi thi công ngầm.`,
        en: `Overall risk grade: ${section8.overallRisk.grade.en} (Baseline BRA Matrix = V × I); establishing pre-construction baseline condition.`,
      },
      witnessNarrative,
      limitations: finalLimitations,
      recommendations: [
        {
          vi: 'Kiến nghị thiết lập hồ sơ hiện trạng ban đầu làm căn cứ pháp lý; lắp đặt mốc quan trắc biến dạng định kỳ trong suốt quá trình đào hầm TBM; theo dõi các vết nứt đã ghi nhận bằng thước đo nứt.',
          en: 'It is recommended to establish the baseline record as legal evidence, install periodic deformation monitoring points during TBM tunnelling, and follow up recorded cracks with crack gauges.',
        },
        {
          vi: 'Báo cáo Giai đoạn 1 là hồ sơ khảo sát và sàng lọc ban đầu; hồ sơ pháp lý xác nhận hiện trạng trước thi công được thực hiện theo quy trình Giai đoạn 2 và các yêu cầu được dự án/Tư vấn phê duyệt.',
          en: 'This Phase 1 report is a preliminary survey and screening record; the legal pre-construction condition record is established under the Phase 2 procedure and the requirements approved by the Project/Engineer.',
        },
      ],
      phase1Notice: {
        vi: 'Báo cáo Giai đoạn 1 là hồ sơ khảo sát và sàng lọc ban đầu.',
        en: 'This Phase 1 report is a preliminary survey and screening record.',
      },
      pendingFieldDesignItems: [
        {
          vi: 'Dự báo lún Smax, PPV, biến dạng góc và điểm A – lấy từ thiết kế / đánh giá tác động được phê duyệt.',
          en: 'Predicted Smax, PPV, angular distortion and score A – from the approved design / impact assessment.',
        },
        {
          vi: 'Hồ sơ pháp lý xác nhận hiện trạng trước thi công hoàn thiện theo Giai đoạn 2 trước khi máy TBM đào qua.',
          en: 'Pre-construction condition legal dossier to be finalized under Phase 2 prior to TBM passage.',
        },
      ],
      hasWarningConclusion,
      warningBadge,
    };

    // PHỤ LỤC 1: BẢN VẼ MẶT ĐỨNG NGOÀI & BỘ ẢNH ĐỊNH DANH (P-01 ĐẾN P-07)
    const appendix1: Appendix1PhotoItem[] = [];

    // 1. P-01: Biển số nhà
    const p01Url =
      json.photoP01?.url ||
      (typeof json.photoP01 === 'string' ? json.photoP01 : undefined) ||
      json.photos?.p01 ||
      json.step1Photos?.p01HouseNumberUrl ||
      findPhoto(['P01_HOUSE_NUMBER', 'P01', 'P-01']);
    if (p01Url) {
      appendix1.push({
        photoCode: 'P-01',
        name: { vi: 'Biển số nhà / tên công trình', en: 'House number / signboard' },
        url: p01Url,
        base64: ReportImageResolver.resolveToBase64(p01Url),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: 'P01_HOUS',
        metroPhotoCode: `HCM_M2.[${buildingId}]_P01_HOUS`,
        watermarkDateTime: extractPhotoDateTime(p01Url, p01Item?.shot_at || p01Item?.created_at, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p01Url),
      });
    }

    // 2. P-02: Mặt đứng chính toàn cảnh
    const p02Url =
      json.photoP02?.url ||
      (typeof json.photoP02 === 'string' ? json.photoP02 : undefined) ||
      json.photos?.p02 ||
      json.step1Photos?.p02MainFacadeUrl ||
      findPhoto(['P02_MAIN_FACADE', 'P02', 'P-02']);
    if (p02Url) {
      appendix1.push({
        photoCode: 'P-02',
        name: { vi: 'Mặt đứng chính toàn cảnh', en: 'Overall view of the main facade' },
        url: p02Url,
        base64: ReportImageResolver.resolveToBase64(p02Url),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: 'P02_MAIN',
        metroPhotoCode: `HCM_M2.[${buildingId}]_P02_MAIN`,
        watermarkDateTime: extractPhotoDateTime(p02Url, p02Item?.shot_at || p02Item?.created_at, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p02Url),
      });
    }

    // 3. P-03: Các mặt bên và mặt sau (Lấy toàn bộ các góc chụp thực tế)
    const p03List = identPhotos.filter((item: any) =>
      item.photo_type === 'P03_SIDE_OR_REAR' ||
      item.photo_type === 'P03_SIDE_REAR' ||
      item.photo_code?.includes('P03') ||
      item.photo_code?.includes('P-03')
    );
    const singleP03Url =
      json.photoP03?.url ||
      (typeof json.photoP03 === 'string' ? json.photoP03 : undefined) ||
      json.photos?.p03 ||
      json.step1Photos?.p03SideRearUrl ||
      findPhoto(['P03_SIDE_OR_REAR', 'P03_SIDE_REAR']);

    if (p03List.length > 0) {
      p03List.forEach((item: any, idx: number) => {
        const u = item.raw_photo_url || item.annotated_photo_url || '';
        if (!u) return;
        const tag = item.photo_code?.includes('PHI') ? 'Bên hông phải' :
                    item.photo_code?.includes('TRI') ? 'Bên hông trái' :
                    item.photo_code?.includes('SAU') ? 'Phía sau' : `Mặt bên #${idx + 1}`;
        const tagEn = item.photo_code?.includes('PHI') ? 'Side facade (right)' :
                      item.photo_code?.includes('TRI') ? 'Side facade (left)' :
                      item.photo_code?.includes('SAU') ? 'Rear facade' : `Side facade #${idx + 1}`;
        const origTag = item.photo_code || `P03_0${idx + 1}`;
        const mCode = origTag.startsWith('HCM_M2.') ? origTag : `HCM_M2.[${buildingId}]_${origTag}`;
        const itemDt = extractPhotoDateTime(u, item.shot_at || item.created_at, rawSurveyDate);
        appendix1.push({
          photoCode: 'P-03',
          name: { vi: `Mặt bên (${tag})`, en: tagEn },
          url: u,
          base64: ReportImageResolver.resolveToBase64(u),
          capturedAt: surveyDateFormatted,
          gpsCoords: `${defaultLat}, ${defaultLng}`,
          originalTag: origTag,
          metroPhotoCode: mCode,
          watermarkDateTime: itemDt,
          alreadyWatermarked: isPhotoAlreadyWatermarked(u),
        });
      });
    } else if (singleP03Url) {
      appendix1.push({
        photoCode: 'P-03',
        name: { vi: 'Mặt bên (hông trái)', en: 'Side facade (left)' },
        url: singleP03Url,
        base64: ReportImageResolver.resolveToBase64(singleP03Url),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: 'P03_SIDE',
        metroPhotoCode: `HCM_M2.[${buildingId}]_P03_SIDE`,
        watermarkDateTime: extractPhotoDateTime(singleP03Url, null, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(singleP03Url),
      });
    }

    // 4. P-04: Bối cảnh đường phố
    const p04Url =
      json.photoP04?.url ||
      (typeof json.photoP04 === 'string' ? json.photoP04 : undefined) ||
      json.photos?.p04 ||
      json.step1Photos?.p04ContextStreetUrl ||
      findPhoto(['P04_CONTEXT_STREET', 'P04', 'P-04']);
    if (p04Url) {
      appendix1.push({
        photoCode: 'P-04',
        name: { vi: 'Bối cảnh đường phố & tuyến Metro', en: 'Street context & Metro alignment' },
        url: p04Url,
        base64: ReportImageResolver.resolveToBase64(p04Url),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: 'P04_CONT',
        metroPhotoCode: `HCM_M2.[${buildingId}]_P04_CONT`,
        watermarkDateTime: extractPhotoDateTime(p04Url, null, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p04Url),
      });
    }

    // 5. P-05: Kiểm tra độ nghiêng công trình (từ deformation_assessments hoặc settlementTilt)
    if (p05Url) {
      const tiltTag = tiltPhotoObj?.photoCode || 'EXT_TILT_01';
      appendix1.push({
        photoCode: 'P-05',
        name: { vi: 'Kiểm tra độ nghiêng công trình', en: 'Building inclination check' },
        url: p05Url,
        base64: ReportImageResolver.resolveToBase64(p05Url),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: tiltTag,
        metroPhotoCode: tiltTag.startsWith('HCM_M2.') ? tiltTag : `HCM_M2.[${buildingId}]_${tiltTag}`,
        watermarkDateTime: extractPhotoDateTime(p05Url, tiltPhotoObj?.shot_at, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p05Url),
      });
    }

    // 6. P-06: Khảo sát lún móng & nền công trình
    if (p06Url) {
      const settleTag = settlePhotoObj?.photoCode || 'FOUND_SETTLE_01';
      appendix1.push({
        photoCode: 'P-06',
        name: { vi: 'Khảo sát lún móng & nền công trình', en: 'Foundation & settlement survey' },
        url: p06Url,
        base64: ReportImageResolver.resolveToBase64(p06Url),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: settleTag,
        metroPhotoCode: settleTag.startsWith('HCM_M2.') ? settleTag : `HCM_M2.[${buildingId}]_${settleTag}`,
        watermarkDateTime: extractPhotoDateTime(p06Url, settlePhotoObj?.shot_at, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p06Url),
      });
    }

    // 7. P-07: Dấu hiệu bất thường ngoại quan
    const anomalyPhotoObj = rawReport.deformation?.abnormal_photos_json?.[0] || deform.abnormalCase?.photos?.[0];
    const p07Url =
      anomalyPhotoObj?.url ||
      deform.abnormalCase?.photoUrl ||
      findPhoto(['EXT_ANOMALY', 'ANOMALY', 'P07', 'P-07']);
    if (p07Url) {
      const anomalyTag = anomalyPhotoObj?.photoCode || 'EXT_ANOMALY_01';
      appendix1.push({
        photoCode: 'P-07',
        name: { vi: 'Dấu hiệu bất thường ngoại quan', en: 'Exterior visual anomaly check' },
        url: p07Url,
        base64: ReportImageResolver.resolveToBase64(p07Url),
        capturedAt: surveyDateFormatted,
        gpsCoords: `${defaultLat}, ${defaultLng}`,
        originalTag: anomalyTag,
        metroPhotoCode: anomalyTag.startsWith('HCM_M2.') ? anomalyTag : `HCM_M2.[${buildingId}]_${anomalyTag}`,
        watermarkDateTime: extractPhotoDateTime(p07Url, anomalyPhotoObj?.shot_at, rawSurveyDate),
        alreadyWatermarked: isPhotoAlreadyWatermarked(p07Url),
      });
    }

    // Phân trang tự động cho Phụ lục 1: Tối đa 4 ảnh / trang A4 để chống vỡ khung in
    const PHOTOS_PER_PAGE = 4;
    const appendix1Pages: Appendix1PhotoPage[] = [];
    const totalApp1Pages = Math.ceil(appendix1.length / PHOTOS_PER_PAGE) || 1;
    for (let i = 0; i < appendix1.length; i += PHOTOS_PER_PAGE) {
      appendix1Pages.push({
        pageIndex: Math.floor(i / PHOTOS_PER_PAGE) + 1,
        totalPages: totalApp1Pages,
        photos: appendix1.slice(i, i + PHOTOS_PER_PAGE),
      });
    }

    // PHỤ LỤC 3: BIÊN BẢN KHẢO SÁT HIỆN TRƯỜNG (TOÀN BỘ CÁC TRANG SCAN PHÁP LÝ)
    const minutesPhotos: string[] = (json.signatures?.workingMinutesPhotos && json.signatures.workingMinutesPhotos.length > 0)
      ? json.signatures.workingMinutesPhotos
      : identPhotos.filter((p: any) => p.photo_type?.includes('DOC') || p.raw_photo_url?.includes('/DOC/')).map((p: any) => p.raw_photo_url || p.annotated_photo_url);

    const appendix3: Appendix3SignedRecord = {
      surveyTime: surveyDateWithTime,
      ownerRepresentative: {
        vi: `${rawReport.owner_name || json.signatures?.ownerRepresentative?.fullName || json.ownerName || 'Chủ hộ'} - Chủ nhà`,
        en: `${rawReport.owner_name || json.signatures?.ownerRepresentative?.fullName || json.ownerName || 'Property Owner'} - Owner`,
      },
      localAuthority: {
        vi: json.signatures?.localAuthority?.fullName
          ? `${json.signatures.localAuthority.fullName}${json.signatures.localAuthority.title ? ` - ${json.signatures.localAuthority.title}` : ''}`
          : 'Đại diện chính quyền địa phương (chưa ký)',
        en: json.signatures?.localAuthority?.fullName
          ? `${json.signatures.localAuthority.fullName}${json.signatures.localAuthority.title ? ` - ${json.signatures.localAuthority.title}` : ''}`
          : 'Local authority representative (unsigned)',
      },
      supervisionConsultant: {
        vi: json.signatures?.supervisionConsultant?.fullName
          ? `${json.signatures.supervisionConsultant.fullName}${json.signatures.supervisionConsultant.title ? ` - ${json.signatures.supervisionConsultant.title}` : ''}`
          : 'Đang mời tham gia xác nhận hiện trường',
        en: json.signatures?.supervisionConsultant?.fullName
          ? `${json.signatures.supervisionConsultant.fullName}${json.signatures.supervisionConsultant.title ? ` - ${json.signatures.supervisionConsultant.title}` : ''}`
          : 'Invited to site witness',
      },
      surveyUnit: {
        vi: surveyorName
          ? `${surveyorName} - Kỹ sư khảo sát hiện trường, Liên danh CRLG – CRSRI – TT`
          : 'Kỹ sư khảo sát hiện trường, Liên danh CRLG – CRSRI – TT',
        en: surveyorName
          ? `${surveyorName} - Field survey engineer, CRLG – CRSRI – TT JV`
          : 'Field survey engineer, CRLG – CRSRI – TT JV',
      },
      fieldComments: {
        vi: ownerFeedbackText || 'Không có ý kiến bổ sung',
        en: ownerFeedbackText || 'No additional comments',
      },
      electronicSignOff: {
        vi: `Khảo sát viên: ${surveyorName || 'Chưa ghi nhận'}; Chủ sở hữu: ${rawReport.owner_name || json.ownerName || 'Chủ hộ'} (đã ký); Quản trị phân khu: ${zoneAdminName || 'Chưa duyệt'} – ngày ${surveyDateFormatted || '–'}`,
        en: `Surveyor: ${surveyorName || 'Unrecorded'}; Owner: ${rawReport.owner_name || json.ownerName || 'Property owner'} (signed); Zone admin: ${zoneAdminName || 'Pending'} – ${surveyDateFormatted || '–'}`,
      },
      dataSource: {
        vi: `Bản xuất phần mềm ${reportNo}, xuất lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${surveyDateFormatted || '–'}`,
        en: `Software export ${reportNo}, exported at ${new Date().toISOString()}`,
      },
      signedRecordPages: minutesPhotos.map((url: string, idx: number) => ({
        pageIndex: idx + 1,
        title: {
          vi: `Biên bản xác nhận khảo sát hiện trường - trang ${idx + 1}/${minutesPhotos.length || 1}`,
          en: `Signed site-survey record - page ${idx + 1}/${minutesPhotos.length || 1}`,
        },
        url,
        base64: ReportImageResolver.resolveToBase64(url),
      })),
    };

    // PHỤ LỤC 4: THIẾT BỊ VÀ PHẠM VI TIẾP CẬN
    const appendix4: Appendix4EquipmentAndAccess = {
      equipmentList: [
        {
          no: 1,
          equipment: { vi: 'Máy ảnh số có GPS', en: 'Digital camera with GPS' },
          specs: { vi: '≥ 12MP, tọa độ EXIF WGS-84', en: '≥ 12 MP, EXIF WGS-84' },
          purpose: { vi: 'Ảnh định danh P-01 – P-07, bối cảnh vết nứt', en: 'Identification photos, crack context' },
        },
        {
          no: 2,
          equipment: { vi: 'Thước đo bề rộng nứt', en: 'Crack width gauge' },
          specs: { vi: 'Vạch chia 0,1 – 10,0 mm', en: '0.1 – 10.0 mm' },
          purpose: { vi: 'Đo bề rộng lớn nhất wmax', en: 'Measure wmax' },
        },
        {
          no: 3,
          equipment: { vi: 'Thước laser / thước thép', en: 'Laser / steel tape' },
          specs: { vi: '± 1,5 mm, tầm đo 40 m', en: '± 1.5 mm, 40 m range' },
          purpose: { vi: 'Chiều dài nứt, kích thước phòng', en: 'Crack length, room size' },
        },
        {
          no: 4,
          equipment: { vi: 'Máy đo nghiêng / thước bọt nước', en: 'Inclinometer / spirit level' },
          specs: { vi: 'Độ chính xác 0,1‰ (cần kiểm tra)', en: 'Accuracy 0.1‰ (to be checked)' },
          purpose: { vi: 'Nghiêng thân nhà X/Y, võng dầm sàn', en: 'Building tilt X/Y, deflection' },
        },
      ],
      calibrationNotes: {
        vi: 'Model, số serial và chứng chỉ hiệu chuẩn thiết bị lưu tại hồ sơ phòng thí nghiệm.',
        en: 'Model, serial number and calibration certificates on file at testing laboratory.',
      },
      accessAreas: [
        {
          area: { vi: 'Mặt ngoài', en: 'Exterior' },
          accessed: true, notAccessed: false,
          remark: { vi: `P-01 – P-0${Math.min(7, appendix1.length)}`, en: `P-01 – P-0${Math.min(7, appendix1.length)}` },
        },
        {
          area: { vi: 'Tầng trệt & các lầu', en: 'Ground floor & upper floors' },
          accessed: true, notAccessed: false,
          remark: { vi: `${appendix2.length} tầng khảo sát đầy đủ`, en: `${appendix2.length} floors surveyed` },
        },
        {
          area: { vi: 'Mái / Sân thượng', en: 'Roof / Terrace' },
          accessed: true, notAccessed: false,
          remark: { vi: 'Khảo sát đầy đủ hiện trạng', en: 'Full survey completed' },
        },
        {
          area: { vi: 'Tầng hầm', en: 'Basement' },
          accessed: false, notAccessed: false,
          remark: { vi: 'Không có tầng hầm (N/A)', en: 'No basement (N/A)' },
        },
      ],
      accessClassification: {
        vi: 'Phân loại tiếp cận: không hạn chế (100%).',
        en: 'Access classification: no restriction (100%).',
      },
    };

    // BỘ CỜ KỊCH BẢN THÍCH ỨNG (ADAPTIVE SCENARIO FLAGS - N CHẬP K)
    const hasMainFacadePhoto = Boolean(p02Url);
    const hasSideOrRearPhotos = p03List.length > 0 || Boolean(singleP03Url);
    const hasTiltPhoto = Boolean(p05Url);
    const hasStructuralCadMap = appendix2.some((f) => f.hasStructuralCadMap);
    const hasAnyDefects = appendix2.some((f) => f.hasDefects);

    const exteriorPhotoLayout: 'grid_6' | 'party_wall_3' | 'minimal_2' =
      hasSideOrRearPhotos ? 'grid_6' :
      hasMainFacadePhoto ? 'party_wall_3' : 'minimal_2';

    const scenarioFlags: ReportScenarioFlags = {
      isAbsenteeSurvey: Boolean(json.isAbsenteeSurvey || rawReport.is_absentee_survey),
      isVacantLand: Boolean(json.isVacantLand || rawReport.is_vacant_land),
      hasMainFacadePhoto,
      hasSideOrRearPhotos,
      hasTiltPhoto,
      hasStructuralCadMap,
      hasAnyDefects,
      exteriorPhotoLayout,
    };

    // TÍNH TOÁN ĐỘNG SỐ TRANG VÀ MỤC LỤC (DYNAMIC TOC & PAGE BUDGET)
    const appendix1PageCount = appendix1Pages?.length || 1;
    const pageAppendix1 = 9;
    const pageAppendix2 = pageAppendix1 + appendix1PageCount;

    let appendix2PageCount = 0;
    for (const fl of appendix2) {
      appendix2PageCount += 1; // 1 trang sơ đồ CAD + tổng hợp / xác nhận an toàn
      appendix2PageCount += fl.overviewPages ? fl.overviewPages.length : 0; // Các trang ảnh tổng thể không gian các phòng (Z)
      appendix2PageCount += fl.elementOverviewPages ? fl.elementOverviewPages.length : 0; // Các trang ảnh cấu kiện kết cấu (E)
      appendix2PageCount += fl.defectPairPages ? fl.defectPairPages.length : 0; // Các trang cặp ảnh khuyết tật
    }

    const pageAppendix3 = pageAppendix2 + appendix2PageCount;
    const appendix3PageCount = 1 + (appendix3.signedRecordPages?.length || 0);

    const pageAppendix4 = pageAppendix3 + appendix3PageCount;
    const totalExpectedPages = pageAppendix4; // Phụ lục 4 là 1 trang cuối cùng

    const tocPageNumbers: TocPageNumbers = {
      section1: 3,
      section2: 3,
      section3: 4,
      section4: 4,
      section5: 5,
      section6: 5,
      section7: 6,
      section8: 7,
      section9: 8,
      appendix1: pageAppendix1,
      appendix2: pageAppendix2,
      appendix3: pageAppendix3,
      appendix4: pageAppendix4,
    };

    metadata.totalExpectedPages = totalExpectedPages;

    return {
      metadata,
      scenarioFlags,
      tocPageNumbers,
      signatures3Party,
      section1,
      section2,
      section3,
      section4,
      section5,
      section6,
      section7,
      section8,
      section9,
      appendix1,
      appendix1Pages,
      appendix2,
      appendix3,
      appendix4,
    };
  }
}
