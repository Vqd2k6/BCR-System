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
import {
  evaluateAddressStandard,
  formatStandardizedAddress168,
} from '../../../audit/utils/residential-address.standards';

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
    const bldgType = (rawReport.building_type || json.buildingType || specs.buildingType || '').toUpperCase();
    const rawBldgName = isVacantLand
      ? 'Khu đất trống'
      : (rawReport.building_name || json.buildingName || specs.buildingNameVi || (bldgType === 'WAREHOUSE' ? 'Kho hàng' : 'Nhà ở gia đình'));
    let bldgNameVi = rawBldgName;
    let bldgNameEn = isVacantLand ? 'Vacant Land' : (bldgType === 'WAREHOUSE' ? 'Commercial Warehouse' : 'Private Residential Townhouse');
    if (!isVacantLand) {
      if (bldgType === 'WAREHOUSE' || rawBldgName.toLowerCase().includes('kho')) {
        bldgNameVi = 'Kho hàng';
        bldgNameEn = 'Commercial Warehouse';
      } else if (rawBldgName.toLowerCase().includes('kinh doanh') || rawBldgName.toLowerCase().includes('shophouse')) {
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

    // Chủ sở hữu / người sử dụng song ngữ (ưu tiên thông tin chủ hộ thực tế thu thập tại hiện trường)
    const ownerVi = json.signatures?.ownerRepresentative?.fullName || json.ownerName || rawReport.owner_name || 'Chủ hộ';
    let ownerEn = ownerVi;
    if (ownerVi.toLowerCase().includes('chủ hộ')) {
      ownerEn = ownerVi.replace(/chủ hộ/i, 'Property Owner').replace(/thửa/i, 'Plot').replace(/tờ/i, 'Sheet');
    } else {
      ownerEn = `Mr./Ms. ${ownerVi}`;
    }

    // Đoạn tuyến / Khu vực song ngữ từ bảng metro_segments PostGIS (chỉ Zone và tên Zone, không kèm Lý trình Km)
    const zoneNameVi = rawReport.metro_segment_name || `Zone 9: Ga S5 Lê Thị Riêng (C&C)`;
    const sectionZoneVi = zoneNameVi;
    const zoneNameEn = zoneNameVi
      .replace(/Ga\s+S(\d+)/i, 'S$1 Station')
      .replace('Ga', 'Station')
      .replace('Hầm TBM', 'TBM Tunnel')
      .replace('Cầu cạn', 'Viaduct')
      .replace('Khu vực ga', 'Station Area')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const sectionZoneEn = zoneNameEn;

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
          // Chuẩn hóa 168 ĐVHC cấp xã TP.HCM (không còn cấp quận): Số [Số nhà] [Tên đường], [Phường mới], TP. Hồ Chí Minh
          const rawHouse = rawReport.house_number || json.houseNumber;
          const rawStreet = rawReport.street || json.street;
          const rawWard = rawReport.ward || json.ward;
          const rawDistrict = rawReport.district || json.district;

          const evalRes = evaluateAddressStandard(rawHouse, rawStreet, rawWard, rawDistrict);
          const finalHn = evalRes.suggested.houseNumber || rawHouse;
          const finalSt = evalRes.suggested.street || rawStreet;
          const finalWd = evalRes.suggested.ward || rawWard;

          const formatted = formatStandardizedAddress168(finalHn, finalSt, finalWd);
          return formatted && formatted !== 'TP. Hồ Chí Minh' ? formatted : (rawReport.address_combined || 'Chưa ghi nhận địa chỉ chi tiết');
        })(),
        en: (() => {
          const rawHouse = rawReport.house_number || json.houseNumber;
          const rawStreet = rawReport.street || json.street;
          const rawWard = rawReport.ward || json.ward;
          const rawDistrict = rawReport.district || json.district;

          const evalRes = evaluateAddressStandard(rawHouse, rawStreet, rawWard, rawDistrict);
          const finalHn = (evalRes.suggested.houseNumber || rawHouse || '').trim();
          const finalSt = (evalRes.suggested.street || rawStreet || '').trim();
          const finalWd = (evalRes.suggested.ward || rawWard || '').trim();

          const parts: string[] = [];
          if (finalHn && finalSt) {
            parts.push(`No. ${finalHn.replace(/^số\s*/i, '')}, ${finalSt} St.`);
          } else if (finalHn) {
            parts.push(`No. ${finalHn.replace(/^số\s*/i, '')}`);
          } else if (finalSt) {
            parts.push(`${finalSt} St.`);
          }

          if (finalWd) {
            if (/^phường\s*\d+/i.test(finalWd)) {
              parts.push(`Ward ${finalWd.replace(/^phường\s*/i, '')}`);
            } else {
              const wdClean = finalWd.replace(/^phường\s*/i, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              parts.push(`${wdClean} Ward`);
            }
          }
          parts.push('Ho Chi Minh City');
          return parts.length > 1 ? parts.join(', ') : (rawReport.address_combined || 'Address unrecorded');
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
    const surveyedFloorsCount = Array.isArray(rawReport.floors)
      ? rawReport.floors.length
      : (Array.isArray(json.floors) ? json.floors.length : 0);
    const baseAboveFloors = Number(specs.aboveFloors || json.aboveFloors || specs.above_floors || specs.floor_count || rawReport.parcel_floor_count || 1);
    const storeysAbove = isVacantLand ? 0 : Math.max(baseAboveFloors, surveyedFloorsCount || 1);
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
        vi: `Mặt tiền ${widthM} m × Chiều sâu ${lengthM} m`,
        en: `Width ${widthM} m × Length ${lengthM} m`,
      };
    } else {
      mainDimensions = {
        vi: `Chưa đo đạc kích thước ranh thửa`,
        en: `Plot dimensions unrecorded`,
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

    // Nhóm đối tượng khảo sát: Ghi theo loại công trình trong payload (tinh gọn, không lặp từ với tên báo cáo)
    const caseType = (json.surveyCaseType || 'NORMAL').toUpperCase();
    let categoryVi = bldgNameVi.toLowerCase().includes('nhà')
      ? 'Nhà dân / Nhà phố riêng lẻ'
      : bldgNameVi.toLowerCase().includes('kho')
        ? 'Công trình Kho hàng'
        : `Công trình ${bldgNameVi}`;
    let categoryEn = bldgNameEn || (bldgNameVi.toLowerCase().includes('kho') ? 'Commercial Warehouse' : 'Private Residential Townhouse');

    if (isVacantLand || caseType === 'VACANT_LAND') {
      categoryVi = 'Khu đất trống';
      categoryEn = 'Vacant Land';
    } else if (isAbsentee || caseType === 'ABSENTEE') {
      categoryVi = `${bldgNameVi} (Khảo sát ngoại thất - Vắng chủ)`;
      categoryEn = `${bldgNameEn} (Exterior survey - Absentee owner)`;
    } else if (isUnderConstruction || caseType === 'UNDER_CONSTRUCTION') {
      categoryVi = `Công trình đang xây dựng / cải tạo (${bldgNameVi})`;
      categoryEn = `Building under construction / renovation (${bldgNameEn})`;
    } else if (bldgNameVi.includes('Căn hộ') || bldgNameVi.includes('Chung cư')) {
      categoryVi = 'Căn hộ chung cư';
      categoryEn = 'Apartment Unit';
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
