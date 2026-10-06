/**
 * ============================================================================
 * SECTION 1 & 2 MAPPER: GENERAL INFO & BUILDING PARAMETERS
 * Chương I: Thông tin chung & Chương II: Thông tin cơ bản về tòa nhà
 * ============================================================================
 */

import {
  Section1GeneralInfo,
  Section2BasicBuildingInfo,
  RelatedMetroWorks,
  BilingualText,
  ReportV2Metadata,
} from '../../report-v2.types';

export interface Section1And2Result {
  section1: Section1GeneralInfo;
  section2: Section2BasicBuildingInfo;
  bldgNameVi: string;
  bldgNameEn: string;
  storeysAbove: number | string;
  rawFoundDepth: any;
}

export class Section1And2Mapper {
  public static map(
    rawReport: any,
    json: any,
    specs: any,
    metadata: ReportV2Metadata,
    buildingId: string,
    surveyId: string,
    reportNo: string,
    cadastralCode: string,
    defaultLat: number,
    defaultLng: number,
    surveyDateWithTime: string
  ): Section1And2Result {
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

    return {
      section1,
      section2,
      bldgNameVi,
      bldgNameEn,
      storeysAbove,
      rawFoundDepth,
    };
  }
}
