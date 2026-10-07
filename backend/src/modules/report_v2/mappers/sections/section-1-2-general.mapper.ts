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
import { calculateMetroDistances } from '../../utils/metro-spatial.utils';

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
    const isVacantLand = Boolean(json.isVacantLand || rawReport.is_vacant_land || json.surveyCaseType === 'VACANT_LAND');
    const isUnderConstruction = Boolean(json.surveyCaseType === 'UNDER_CONSTRUCTION');
    const isAbsentee = Boolean(json.isAbsenteeSurvey || rawReport.is_absentee_survey || json.surveyCaseType === 'ABSENTEE');

    // Tên công trình song ngữ chuẩn hóa
    const rawBldgName = isVacantLand
      ? 'Khu đất trống'
      : (json.buildingName || rawReport.building_name || 'Nhà ở gia đình');
    let bldgNameVi = rawBldgName;
    let bldgNameEn = isVacantLand ? 'Vacant Land' : 'Private Residential Townhouse';
    if (!isVacantLand) {
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
      if (isUnderConstruction && !bldgNameVi.includes('thi công')) {
        bldgNameVi = `${bldgNameVi} (Đang thi công xây dựng)`;
        bldgNameEn = `${bldgNameEn} (Under construction)`;
      }
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
          const rawHouse = json.houseNumber || rawReport.house_number;
          const rawStreet = json.street || rawReport.street;
          const rawWard = json.ward || rawReport.ward;
          const rawDistrict = json.district || rawReport.district;

          const parts: string[] = [];
          if (rawHouse) parts.push(`Số ${rawHouse}`);
          if (rawStreet) {
            const st = rawStreet.trim();
            // Nếu tên đường bị gán nhầm thành tên Phường (do import shapefile thô), không thêm tiền tố "đường"
            if (/^phường\s*\d+/i.test(st) || (rawWard && st.toLowerCase() === rawWard.toLowerCase())) {
              parts.push(st.startsWith('P.') || st.startsWith('Phường') ? st : `P. ${st}`);
            } else {
              parts.push(st.startsWith('đường') || st.startsWith('Đường') ? st : `đường ${st}`);
            }
          }
          if (rawWard && (!rawStreet || rawStreet.toLowerCase() !== rawWard.toLowerCase())) {
            const w = rawWard.trim();
            parts.push(w.startsWith('P.') || w.startsWith('Phường') ? w : `P. ${w}`);
          }
          if (rawDistrict) {
            const d = rawDistrict.trim();
            parts.push(d.startsWith('Q.') || d.startsWith('Quận') ? d : `Q. ${d}`);
          }
          parts.push(rawReport.city || json.city || 'TP Hồ Chí Minh');
          parts.push('Việt Nam');
          return parts.length > 2 ? parts.join(', ') : (rawReport.address_combined || 'Chưa ghi nhận địa chỉ chi tiết');
        })(),
        en: (() => {
          const rawHouse = json.houseNumber || rawReport.house_number;
          const rawStreet = json.street || rawReport.street;
          const rawWard = json.ward || rawReport.ward;
          const rawDistrict = json.district || rawReport.district;

          const parts: string[] = [];
          if (rawHouse) parts.push(`No. ${rawHouse}`);
          if (rawStreet) {
            const st = rawStreet.trim();
            if (/^phường\s*\d+/i.test(st) || (rawWard && st.toLowerCase() === rawWard.toLowerCase())) {
              parts.push(`Ward ${st.replace(/^phường\s*/i, '')}`);
            } else {
              parts.push(`${st} St.`);
            }
          }
          if (rawWard && (!rawStreet || rawStreet.toLowerCase() !== rawWard.toLowerCase())) {
            parts.push(`Ward ${rawWard.replace(/^phường\s*/i, '')}`);
          }
          if (rawDistrict) parts.push(`Dist. ${rawDistrict.replace(/^quận\s*/i, '')}`);
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
    const storeysAbove = isVacantLand ? 0 : (specs.aboveFloors || json.aboveFloors || specs.above_floors || specs.floor_count || rawReport.parcel_floor_count || 1);
    const storeysBasement = isVacantLand ? 0 : (specs.undergroundFloors || json.undergroundFloors || specs.underground_floors || specs.basement_count || 0);

    // 1. Diện tích đất ban đầu (parcels.land_area_m2)
    const rawLandArea = json.landAreaM2 ?? rawReport.land_area_m2;
    const landAreaM2 = (rawLandArea !== undefined && rawLandArea !== null && rawLandArea !== '' && !isNaN(Number(rawLandArea)))
      ? Number(rawLandArea).toFixed(1)
      : '';

    // 2. Tổng diện tích sàn xây dựng (GFA) thu thập từ KSV (Bước 2: constructionAreaM2)
    const rawGfa = json.constructionAreaM2 || specs.constructionAreaM2 || specs.construction_area_m2 || rawReport.parcel_construction_area_m2;
    const totalFloorAreaM2 = isVacantLand
      ? '0.0'
      : ((rawGfa !== undefined && rawGfa !== null && rawGfa !== '' && !isNaN(Number(rawGfa)))
        ? Number(rawGfa).toFixed(1)
        : '');

    // 3. Diện tích xây dựng tầng trệt ước tính (Footprint = GFA / số tầng, không vượt quá diện tích đất)
    const numFloors = Math.max(1, Number(storeysAbove) || 1);
    let footprintM2 = '';
    if (isVacantLand) {
      footprintM2 = '0.0';
    } else if (totalFloorAreaM2) {
      const estimatedFootprint = Number(totalFloorAreaM2) / numFloors;
      if (landAreaM2 && estimatedFootprint > Number(landAreaM2)) {
        footprintM2 = landAreaM2;
      } else {
        footprintM2 = estimatedFootprint.toFixed(1);
      }
    }

    const floorAreaDisplay: BilingualText = isVacantLand
      ? {
          vi: `Diện tích khuôn viên đất: ${landAreaM2 || '–'} m² (Đất trống – Không có công trình xây dựng)`,
          en: `Land plot area: ${landAreaM2 || '–'} m² (Vacant land – No building structure)`,
        }
      : {
          vi: totalFloorAreaM2
            ? `Tổng diện tích sàn: ${totalFloorAreaM2} m² (Diện tích đất: ${landAreaM2 || '–'} m² | Diện tích xây dựng tầng trệt ước tính: ~${footprintM2 || '–'} m²)`
            : (landAreaM2 ? `Diện tích đất: ${landAreaM2} m²` : 'Chưa có số liệu diện tích đo đạc'),
          en: totalFloorAreaM2
            ? `Total floor area: ${totalFloorAreaM2} m² (Land plot area: ${landAreaM2 || '–'} m² | Approx. ground footprint: ~${footprintM2 || '–'} m²)`
            : (landAreaM2 ? `Land plot area: ${landAreaM2} m²` : 'Area data unrecorded'),
        };

    // Kích thước chính trích xuất từ đa giác ranh thửa đất ban đầu (PostGIS ST_OrientedEnvelope)
    const rawSide1 = Number(rawReport.parcel_side_a_m);
    const rawSide2 = Number(rawReport.parcel_side_b_m);
    const rawHeight = Number(specs.buildingHeightM || json.buildingHeightM || specs.building_height_m || 0);
    let maxHeightM: string;
    let typicalStoreyM: string;
    if (isVacantLand) {
      typicalStoreyM = '–';
      maxHeightM = '0.0';
    } else if (rawHeight > 0 && rawHeight <= 4.5 && Number(storeysAbove) > 1) {
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
        vi: `Mặt tiền ${widthM} m × Chiều sâu ${lengthM} m${maxHeightM !== '–' && maxHeightM !== '0.0' ? ` (Chiều cao: ${maxHeightM} m)` : ''}`,
        en: `Width ${widthM} m × Length ${lengthM} m${maxHeightM !== '–' && maxHeightM !== '0.0' ? ` (Height: ${maxHeightM} m)` : ''}`,
      };
    } else {
      mainDimensions = {
        vi: `Chưa đo đạc kích thước ranh thửa${maxHeightM !== '–' && maxHeightM !== '0.0' ? ` (Chiều cao: ${maxHeightM} m)` : ''}`,
        en: `Plot dimensions unrecorded${maxHeightM !== '–' && maxHeightM !== '0.0' ? ` (Height: ${maxHeightM} m)` : ''}`,
      };
    }

    // Khoảng cách đến Metro: Tim tuyến & Biên kết cấu hố đào (tính từ polygon/payload, không tự ý trừ 15m)
    const metroDistances = calculateMetroDistances(rawReport, json);
    const distanceToMetroAlignmentM = metroDistances.distanceToAlignmentM;
    const distanceToMetroEdgeM = metroDistances.distanceToEdgeM;
    const distanceToMetroDisplay: BilingualText = {
      vi: metroDistances.displayVi,
      en: metroDistances.displayEn,
    };

    // Khoảng cách tĩnh không: Tuyến Metro khoan ngầm
    const rawFoundDepth = json.foundationDepthM ?? specs.foundation_depth_m;
    const rawCrownDepth = rawReport.metro_tunnel_crown_depth ?? json.tunnelCrownDepthM;
    let clearanceVerticalM: string = '';
    let clearance3DM: string = '';
    let clearanceDisplay: BilingualText;
    if (distanceToMetroAlignmentM && rawFoundDepth !== undefined && rawFoundDepth !== null && rawFoundDepth !== '' && !isNaN(Number(rawFoundDepth)) && rawCrownDepth !== undefined && rawCrownDepth !== null && rawCrownDepth !== '' && !isNaN(Number(rawCrownDepth))) {
      const foundationDepthM = Number(rawFoundDepth);
      const crownDepthM = Number(rawCrownDepth);
      clearanceVerticalM = Math.max(0, crownDepthM - foundationDepthM).toFixed(1);
      clearance3DM = Math.sqrt(
        Math.pow(Number(distanceToMetroAlignmentM), 2) + Math.pow(Number(clearanceVerticalM), 2)
      ).toFixed(1);
      clearanceDisplay = {
        vi: `Tĩnh không đứng: ${clearanceVerticalM} m (Đỉnh hầm thiết kế: -${crownDepthM.toFixed(1)} m, Đáy móng: -${foundationDepthM.toFixed(1)} m) | Tĩnh không 3D: ${clearance3DM} m`,
        en: `Vertical clearance: ${clearanceVerticalM} m (Design tunnel crown: -${crownDepthM.toFixed(1)} m, Foundation: -${foundationDepthM.toFixed(1)} m) | 3D clearance: ${clearance3DM} m`,
      };
    } else {
      clearanceDisplay = {
        vi: 'Chưa có số liệu cao độ đỉnh hầm thiết kế (Cần đối chiếu hồ sơ thiết kế ngầm)',
        en: 'Tunnel crown design depth unrecorded (Subject to underground design drawings)',
      };
    }

    // Thông tin kịch bản mở rộng: Đất trống, Đang thi công, Gộp thửa
    let vacantLandStatus: BilingualText | undefined = undefined;
    let vacantLandNotes: BilingualText | undefined = undefined;
    if (isVacantLand) {
      const st = json.vacantLandStatus || 'Đất trống chưa xây dựng';
      vacantLandStatus = {
        vi: `Hiện trạng: ${st}`,
        en: `Status: ${st}`,
      };
      if (json.vacantLandNotes && String(json.vacantLandNotes).trim()) {
        vacantLandNotes = {
          vi: String(json.vacantLandNotes).trim(),
          en: String(json.vacantLandNotes).trim(),
        };
      }
    }

    let constructionStageNotes: BilingualText | undefined = undefined;
    const rawConstStage = json.constructionStageNotes || json.constructionStage || json.underConstructionNotes;
    if (isUnderConstruction) {
      const stageStr = rawConstStage && String(rawConstStage).trim() ? String(rawConstStage).trim() : 'Đang thi công dở dang tại thời điểm khảo sát';
      constructionStageNotes = {
        vi: `Hiện trạng thi công: ${stageStr}`,
        en: `Construction stage: ${stageStr}`,
      };
    }

    let gisMergedInfo: BilingualText | undefined = undefined;
    const gisDetails = json.gisMutationConfirmed?.details || {};
    if (json.gisMutationConfirmed?.type === 'MERGE' || rawReport.gis_mutation_type === 'MERGE' || json.gisMutationType === 'MERGED' || json.gisMutationType === 'MERGE') {
      const mergeCodes = (gisDetails.selectedMergeCodes || json.mergedParcelCodes || []).join(', ') || 'Nhiều thửa';
      const bldgArea = gisDetails.mergeBuildingAreaM2 || json.surveyedParcelAreaM2 || totalFloorAreaM2 || '–';
      const residArea = gisDetails.mergeResidualAreaM2 || (json.totalPlotAreaM2 && json.surveyedParcelAreaM2 ? (json.totalPlotAreaM2 - json.surveyedParcelAreaM2).toFixed(1) : '0.0');
      gisMergedInfo = {
        vi: `Thửa gộp từ: ${mergeCodes} | Diện tích XD thực tế: ${bldgArea} m² | Diện tích đất dư: ${residArea} m²`,
        en: `Merged from: ${mergeCodes} | Actual building footprint: ${bldgArea} m² | Residual land area: ${residArea} m²`,
      };
    }

    // Nhóm đối tượng khảo sát: Ghi theo loại công trình trong payload
    const caseType = (json.surveyCaseType || 'NORMAL').toUpperCase();
    let categoryVi = `Công trình ${bldgNameVi} – Khảo sát hiện trạng công trình`;
    let categoryEn = `${bldgNameEn} – Building condition survey`;
    if (isVacantLand || caseType === 'VACANT_LAND') {
      categoryVi = 'Khu đất trống – Khảo sát ranh giới & khuôn viên';
      categoryEn = 'Vacant Land – Boundary & site survey';
    } else if (isAbsentee || caseType === 'ABSENTEE') {
      categoryVi = `${bldgNameVi} – Khảo sát hiện trạng ngoại thất (Chủ hộ vắng mặt)`;
      categoryEn = `${bldgNameEn} – Exterior condition survey (Absentee property owner)`;
    } else if (isUnderConstruction || caseType === 'UNDER_CONSTRUCTION') {
      categoryVi = `Công trình đang xây dựng / cải tạo (${bldgNameVi})`;
      categoryEn = `Building under construction / renovation (${bldgNameEn})`;
    } else if (bldgNameVi.includes('Căn hộ') || bldgNameVi.includes('Chung cư')) {
      categoryVi = 'Căn hộ chung cư – Khảo sát hiện trạng căn hộ';
      categoryEn = 'Apartment Unit – Building condition survey';
    }

    const section2: Section2BasicBuildingInfo = {
      use: {
        vi: bldgNameVi,
        en: bldgNameEn,
      },
      storeysAbove,
      storeysBasement,
      storeysDisplay: isVacantLand
        ? { vi: '0 tầng (Đất trống)', en: '0 storeys (Vacant land)' }
        : {
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
      yearConstructed: isVacantLand ? 'N/A' : (specs.constructionYear || json.constructionYear || specs.year_of_construction || '–'),
      isEstimatedYear: Boolean(specs.isEstimatedYear || json.isEstimatedYear || specs.is_year_estimated),
      distanceToMetroAlignmentM,
      distanceToMetroEdgeM,
      distanceToMetroDisplay,
      clearanceVerticalM,
      clearance3DM,
      clearanceDisplay,
      surveyCategory: {
        vi: categoryVi,
        en: categoryEn,
      },
      vacantLandStatus,
      vacantLandNotes,
      constructionStageNotes,
      gisMergedInfo,
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
