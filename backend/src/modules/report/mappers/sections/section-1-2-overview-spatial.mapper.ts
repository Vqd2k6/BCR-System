/**
 * ============================================================================
 * SECTION 1 & 2 MAPPER: GENERAL INFO & BUILDING PARAMETERS
 * Chương I: Thông tin chung & Chương II: Thông tin cơ bản về tòa nhà.
 * Tuân thủ nghiêm ngặt quy tắc Zero Calculate (chỉ đọc 1:1 từ dữ liệu đã lưu).
 * ============================================================================
 */

import {
  Section1GeneralInfo,
  Section2BasicBuildingInfo,
  RelatedMetroWorks,
  BilingualText,
  ReportMetadata,
} from '../../report.types';

export interface Section1And2Result {
  section1: Section1GeneralInfo;
  section2: Section2BasicBuildingInfo;
  bldgNameVi: string;
  bldgNameEn: string;
  storeysAbove: number | string;
  rawFoundDepth: any;
}

function formatSavedAddressVi(houseNumber: unknown, street: unknown, ward: unknown, fallbackCombined?: unknown): string {
  const hn = String(houseNumber ?? '').trim();
  const st = String(street ?? '').trim();
  const wd = String(ward ?? '').trim();
  const parts: string[] = [];

  if (hn && st) parts.push(`Số ${hn.replace(/^số\s*/i, '')}, Đường ${st.replace(/^đường\s*/i, '')}`);
  else if (hn) parts.push(`Số ${hn.replace(/^số\s*/i, '')}`);
  else if (st) parts.push(`Đường ${st.replace(/^đường\s*/i, '')}`);

  if (wd) parts.push(/^phường\s/i.test(wd) ? wd : `Phường ${wd}`);
  if (parts.length > 0) {
    parts.push('TP. Hồ Chí Minh');
    return parts.join(', ');
  }
  return String(fallbackCombined ?? '').trim() || '--';
}

function formatSavedAddressEn(houseNumber: unknown, street: unknown, ward: unknown, fallbackCombined?: unknown): string {
  const hn = String(houseNumber ?? '').trim();
  const st = String(street ?? '').trim();
  const wd = String(ward ?? '').trim();
  const parts: string[] = [];

  if (hn && st) parts.push(`No. ${hn.replace(/^số\s*/i, '')}, ${st.replace(/^đường\s*/i, '')} St.`);
  else if (hn) parts.push(`No. ${hn.replace(/^số\s*/i, '')}`);
  else if (st) parts.push(`${st.replace(/^đường\s*/i, '')} St.`);

  if (wd) {
    if (/^phường\s*\d+/i.test(wd)) parts.push(`Ward ${wd.replace(/^phường\s*/i, '')}`);
    else parts.push(`${wd.replace(/^phường\s*/i, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')} Ward`);
  }
  if (parts.length > 0) {
    parts.push('Ho Chi Minh City');
    return parts.join(', ');
  }
  return String(fallbackCombined ?? '').trim() || '--';
}

function readSavedMeters(val: unknown): string {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number') return Number.isFinite(val) ? val.toFixed(1) : '';
  const cleaned = String(val).trim().replace(/[^\d.-]/g, '');
  if (!cleaned) return '';
  const num = Number(cleaned);
  return Number.isFinite(num) ? num.toFixed(1) : '';
}

export class Section1And2Mapper {
  public static map(
    rawReport: any,
    json: any,
    specs: any,
    metadata: ReportMetadata,
    buildingId: string,
    surveyId: string,
    reportNo: string,
    cadastralCode: string,
    defaultLat: number,
    defaultLng: number,
    surveyDateWithTime: string
  ): Section1And2Result {
    const isVacantLand = Boolean(json.isVacantLand || rawReport.is_vacant_land || json.surveyCaseType === 'VACANT_LAND');
    const isUnderConstruction = Boolean(json.surveyCaseType === 'UNDER_CONSTRUCTION');
    const isAbsentee = Boolean(json.isAbsenteeSurvey || rawReport.is_absentee_survey || json.surveyCaseType === 'ABSENTEE');

    const bldgType = (json.buildingType || specs.buildingType || rawReport.building_type || '').toUpperCase();
    const rawBldgName = isVacantLand
      ? 'Khu đất trống'
      : (json.buildingName || json.usageFunction || specs.buildingNameVi || specs.building_name || specs.land_use_function || rawReport.building_name || (bldgType === 'WAREHOUSE' ? 'Kho hàng' : 'Nhà ở gia đình'));
    let bldgNameVi = rawBldgName;
    let bldgNameEn = isVacantLand ? 'Vacant Land' : (bldgType === 'WAREHOUSE' ? 'Commercial Warehouse' : 'Private Residential Townhouse');
    if (!isVacantLand) {
      if (bldgType === 'WAREHOUSE' || rawBldgName.toLowerCase().includes('kho')) {
        bldgNameVi = 'Kho hàng'; bldgNameEn = 'Commercial Warehouse';
      } else if (rawBldgName.toLowerCase().includes('kinh doanh') || rawBldgName.toLowerCase().includes('shophouse')) {
        bldgNameVi = 'Nhà ở kết hợp kinh doanh'; bldgNameEn = 'Shophouse / Mixed-use Townhouse';
      } else if (rawBldgName.toLowerCase().includes('văn phòng')) {
        bldgNameVi = 'Tòa nhà văn phòng'; bldgNameEn = 'Commercial Office Building';
      }
      if (isUnderConstruction && !bldgNameVi.includes('thi công')) {
        bldgNameVi = `${bldgNameVi} (Đang thi công xây dựng)`;
        bldgNameEn = `${bldgNameEn} (Under construction)`;
      }
    }

    const candidateOwner = (json.ownerName || rawReport.owner_name || '').trim();
    const repFullName = (json.signatures?.ownerRepresentative?.fullName || '').trim();
    const isCadastralPlaceholder = !repFullName || /chủ\s*hộ\s*thửa/i.test(repFullName) || /tờ\s*bản\s*đồ/i.test(repFullName);

    const ownerVi = candidateOwner || (!isCadastralPlaceholder ? repFullName : '') || '--';
    let ownerEn = ownerVi;
    if (ownerVi === '--') ownerEn = '--';
    else if (ownerVi.toLowerCase().includes('chủ hộ')) ownerEn = ownerVi.replace(/chủ\s*hộ/i, 'Property Owner').replace(/thửa/i, 'Plot').replace(/tờ/i, 'Sheet');
    else ownerEn = `Mr./Ms. ${ownerVi}`;

    const zoneNameVi = rawReport.metro_segment_name || `Zone 9: Ga S5 Lê Thị Riêng (C&C)`;
    const zoneNameEn = zoneNameVi
      .replace(/Ga\s+S(\d+)/i, 'S$1 Station')
      .replace('Ga', 'Station')
      .replace('Hầm TBM', 'TBM Tunnel')
      .replace('Cầu cạn', 'Viaduct')
      .replace('Khu vực ga', 'Station Area')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const rawSegType = (rawReport.segment_type || rawReport.metro_construction_type || 'C&C').toUpperCase();
    const metroType: 'C&C' | 'POR' | 'ELV' | 'DEP' = ['C&C', 'POR', 'ELV', 'DEP'].includes(rawSegType) ? (rawSegType as any) : 'C&C';
    const relatedMetroWorks: RelatedMetroWorks = {
      type: metroType,
      isCutCover: metroType === 'C&C',
      isBoredTunnel: metroType === 'POR',
      isElevated: metroType === 'ELV',
      isDepot: metroType === 'DEP',
    };

    const rawHouse = json.houseNumber ?? rawReport.house_number;
    const rawStreet = json.street ?? rawReport.street;
    const rawWard = json.ward ?? rawReport.ward;

    const section1: Section1GeneralInfo = {
      projectTitleVi: metadata.projectTitleVi,
      projectTitleEn: metadata.projectTitleEn,
      buildingId,
      surveyId,
      reportNo,
      buildingName: { vi: bldgNameVi, en: bldgNameEn },
      address: {
        vi: formatSavedAddressVi(rawHouse, rawStreet, rawWard, rawReport.address_combined),
        en: formatSavedAddressEn(rawHouse, rawStreet, rawWard, rawReport.address_combined),
      },
      cadastralCode,
      ownerOccupant: { vi: ownerVi, en: ownerEn },
      ownerName: ownerVi,
      contactPhone: json.ownerPhone || rawReport.owner_phone || '--',
      surveyConsultant: { vi: 'Liên danh CRLG – CRSRI – TT', en: 'CRLG – CRSRI – TT Joint Venture' },
      epcContractor: 'THACO - CREC',
      sectionZone: { vi: zoneNameVi, en: zoneNameEn },
      relatedMetroWorks,
      gpsCoords: { lat: defaultLat, lng: defaultLng, formatted: `${defaultLat}, ${defaultLng}` },
      surveyDate: surveyDateWithTime,
    };

    // CHƯƠNG II: Đọc trực tiếp 1:1 từ dữ liệu đã lưu (Zero Calculate)
    const explicitAboveFloors = json.aboveFloors ?? specs.aboveFloors ?? specs.above_floors ?? specs.floor_count ?? rawReport.parcel_floor_count;
    const hasExplicitAboveFloors = explicitAboveFloors !== undefined && explicitAboveFloors !== null && explicitAboveFloors !== '' && !isNaN(Number(explicitAboveFloors));
    const storeysAbove: number | string = isVacantLand ? 0 : (hasExplicitAboveFloors ? Number(explicitAboveFloors) : '--');
    const rawBasement = json.undergroundFloors ?? specs.undergroundFloors ?? specs.underground_floors ?? specs.basement_count;
    const storeysBasement: number | string = isVacantLand
      ? 0
      : (rawBasement !== undefined && rawBasement !== null && rawBasement !== '' && !isNaN(Number(rawBasement)) ? Number(rawBasement) : 0);

    const rawLandArea = json.landAreaM2 ?? rawReport.land_area_m2;
    const landAreaM2 = (rawLandArea !== undefined && rawLandArea !== null && rawLandArea !== '' && !isNaN(Number(rawLandArea)))
      ? Number(rawLandArea).toFixed(1)
      : '';

    const rawGfa = json.constructionAreaM2 ?? json.totalFloorAreaM2 ?? specs.constructionAreaM2 ?? specs.totalFloorAreaM2 ?? specs.construction_area_m2 ?? specs.total_floor_area_m2 ?? rawReport.parcel_construction_area_m2;
    const totalFloorAreaM2 = isVacantLand
      ? '0.0'
      : ((rawGfa !== undefined && rawGfa !== null && rawGfa !== '' && !isNaN(Number(rawGfa))) ? Number(rawGfa).toFixed(1) : '');

    const rawFootprint = json.footprintAreaM2 ?? json.groundFloorAreaM2 ?? specs.footprintAreaM2 ?? specs.ground_floor_area_m2;
    const footprintM2 = isVacantLand
      ? '0.0'
      : (rawFootprint !== undefined && rawFootprint !== null && rawFootprint !== '' && !isNaN(Number(rawFootprint)) && Number(rawFootprint) > 0
        ? Number(rawFootprint).toFixed(1)
        : '');

    const floorAreaDisplay: BilingualText = isVacantLand
      ? {
          vi: `Diện tích khuôn viên đất: ${landAreaM2 || '--'} m² (Đất trống – Không có công trình xây dựng)`,
          en: `Land plot area: ${landAreaM2 || '--'} m² (Vacant land – No building structure)`,
        }
      : {
          vi: totalFloorAreaM2
            ? `Tổng diện tích sàn: ${totalFloorAreaM2} m² (Diện tích đất: ${landAreaM2 || '--'} m²${footprintM2 ? ` | Diện tích xây dựng tầng trệt: ${footprintM2} m²` : ''})`
            : (landAreaM2 ? `Diện tích đất: ${landAreaM2} m²` : '--'),
          en: totalFloorAreaM2
            ? `Total floor area: ${totalFloorAreaM2} m² (Land plot area: ${landAreaM2 || '--'} m²${footprintM2 ? ` | Ground footprint: ${footprintM2} m²` : ''})`
            : (landAreaM2 ? `Land plot area: ${landAreaM2} m²` : '--'),
        };

    const rawHeight = Number(json.buildingHeightM ?? specs.buildingHeightM ?? specs.building_height_m ?? 0);
    const rawTypicalStorey = Number(json.typicalStoreyHeightM ?? json.floorHeightM ?? specs.typicalStoreyHeightM ?? specs.floor_height_m ?? 0);
    const maxHeightM = isVacantLand ? '0.0' : (rawHeight > 0 ? rawHeight.toFixed(1) : '--');
    const typicalStoreyM = isVacantLand ? '--' : (rawTypicalStorey > 0 ? rawTypicalStorey.toFixed(1) : '--');

    const rawWidth = json.frontageWidth ?? rawReport.frontage_width;
    const rawDepth = json.lotDepth ?? rawReport.lot_depth;
    const hasWidth = rawWidth !== undefined && rawWidth !== null && rawWidth !== '' && !isNaN(Number(rawWidth)) && Number(rawWidth) > 0;
    const hasDepth = rawDepth !== undefined && rawDepth !== null && rawDepth !== '' && !isNaN(Number(rawDepth)) && Number(rawDepth) > 0;
    const widthDisplay = hasWidth ? `${Number(rawWidth).toFixed(1)} m` : '-- m';
    const depthDisplay = hasDepth ? `${Number(rawDepth).toFixed(1)} m` : '-- m';

    let mainDimensions: BilingualText;
    if (!hasWidth && !hasDepth) {
      const rawSide1 = Number(rawReport.parcel_side_a_m);
      const rawSide2 = Number(rawReport.parcel_side_b_m);
      mainDimensions = (rawSide1 > 0 && rawSide2 > 0)
        ? {
            vi: `Kích thước cạnh thửa GIS: ${rawSide1.toFixed(1)} m × ${rawSide2.toFixed(1)} m`,
            en: `GIS cadastral parcel sides: ${rawSide1.toFixed(1)} m × ${rawSide2.toFixed(1)} m`,
          }
        : { vi: `Mặt tiền -- m × Chiều sâu -- m`, en: `Width -- m × Depth -- m` };
    } else {
      mainDimensions = { vi: `Mặt tiền ${widthDisplay} × Chiều sâu ${depthDisplay}`, en: `Width ${widthDisplay} × Depth ${depthDisplay}` };
    }

    const distanceToMetroAlignmentM = readSavedMeters(
      json.manualMetroDistanceM ?? json.distanceToMetroM ?? json.metroOffsetDistance ?? specs.metroOffsetDistance ?? rawReport.distance_to_centerline_m
    );
    const distanceToMetroEdgeM = readSavedMeters(
      json.stationEdgeDistance ?? json.clearanceOffsetDistance ?? json.distanceToTunnelEdgeM ?? specs.clearanceOffsetDistance ?? rawReport.distance_to_tunnel_edge_m
    );

    const alignLabel = distanceToMetroAlignmentM ? `${distanceToMetroAlignmentM} m` : '--';
    const edgeLabel = distanceToMetroEdgeM ? `${distanceToMetroEdgeM} m` : '--';
    const distanceToMetroDisplay: BilingualText = {
      vi: `Tim tuyến: ${alignLabel} | Biên kết cấu / hố đào: ${edgeLabel}`,
      en: `To alignment centerline: ${alignLabel} | To structure / excavation edge: ${edgeLabel}`,
    };

    const rawFoundDepth = json.foundationDepthM ?? specs.foundation_depth_m;
    const clearanceVerticalM = readSavedMeters(json.clearanceVerticalM ?? specs.clearanceVerticalM);
    const clearance3DM = readSavedMeters(json.clearance3DM ?? json.clearance3dM ?? specs.clearance3DM);
    const clearanceDisplay: BilingualText = (clearanceVerticalM || clearance3DM)
      ? {
          vi: `Tĩnh không đứng: ${clearanceVerticalM || '--'} m | Tĩnh không 3D: ${clearance3DM || '--'} m`,
          en: `Vertical clearance: ${clearanceVerticalM || '--'} m | 3D clearance: ${clearance3DM || '--'} m`,
        }
      : { vi: '--', en: '--' };

    let vacantLandStatus: BilingualText | undefined = undefined;
    let vacantLandNotes: BilingualText | undefined = undefined;
    if (isVacantLand) {
      const st = json.vacantLandStatus || 'Đất trống chưa xây dựng';
      vacantLandStatus = { vi: `Hiện trạng: ${st}`, en: `Status: ${st}` };
      if (json.vacantLandNotes && String(json.vacantLandNotes).trim()) {
        const notes = String(json.vacantLandNotes).trim();
        vacantLandNotes = { vi: notes, en: notes };
      }
    }

    let constructionStageNotes: BilingualText | undefined = undefined;
    const rawConstStage = json.constructionStageNotes || json.constructionStage || json.underConstructionNotes;
    if (isUnderConstruction) {
      const stageStr = rawConstStage && String(rawConstStage).trim() ? String(rawConstStage).trim() : 'Đang thi công dở dang tại thời điểm khảo sát';
      constructionStageNotes = { vi: `Hiện trạng thi công: ${stageStr}`, en: `Construction stage: ${stageStr}` };
    }

    let gisMergedInfo: BilingualText | undefined = undefined;
    const gisDetails = json.gisMutationConfirmed?.details || {};
    if (json.gisMutationConfirmed?.type === 'MERGE' || rawReport.gis_mutation_type === 'MERGE' || json.gisMutationType === 'MERGED' || json.gisMutationType === 'MERGE') {
      const mergeCodes = (gisDetails.selectedMergeCodes || json.mergedParcelCodes || []).join(', ') || '--';
      const bldgArea = gisDetails.mergeBuildingAreaM2 || json.surveyedParcelAreaM2 || totalFloorAreaM2 || '--';
      const residArea = gisDetails.mergeResidualAreaM2 ?? '--';
      gisMergedInfo = {
        vi: `Thửa gộp từ: ${mergeCodes} | Diện tích XD thực tế: ${bldgArea} m² | Diện tích đất dư: ${residArea} m²`,
        en: `Merged from: ${mergeCodes} | Actual building footprint: ${bldgArea} m² | Residual land area: ${residArea} m²`,
      };
    }

    const caseType = (json.surveyCaseType || 'NORMAL').toUpperCase();
    let categoryVi = bldgNameVi.toLowerCase().includes('nhà') ? 'Nhà dân / Nhà phố riêng lẻ' : bldgNameVi.toLowerCase().includes('kho') ? 'Công trình Kho hàng' : `Công trình ${bldgNameVi}`;
    let categoryEn = bldgNameEn || 'Private Residential Townhouse';

    if (isVacantLand || caseType === 'VACANT_LAND') {
      categoryVi = 'Khu đất trống'; categoryEn = 'Vacant Land';
    } else if (isAbsentee || caseType === 'ABSENTEE') {
      categoryVi = `${bldgNameVi} (Khảo sát ngoại thất - Vắng chủ)`;
      categoryEn = `${bldgNameEn} (Exterior survey - Absentee owner)`;
    } else if (isUnderConstruction || caseType === 'UNDER_CONSTRUCTION') {
      categoryVi = `Công trình đang xây dựng / cải tạo (${bldgNameVi})`;
      categoryEn = `Building under construction / renovation (${bldgNameEn})`;
    }

    const section2: Section2BasicBuildingInfo = {
      use: { vi: bldgNameVi, en: bldgNameEn },
      storeysAbove,
      storeysBasement,
      storeysDisplay: isVacantLand
        ? { vi: '0 tầng (Đất trống)', en: '0 storeys (Vacant land)' }
        : { vi: `Nổi: ${storeysAbove} tầng; Hầm: ${storeysBasement}`, en: `Above ground: ${storeysAbove} storeys; Basement: ${storeysBasement}` },
      landAreaM2,
      footprintM2,
      totalFloorAreaM2,
      floorAreaDisplay,
      mainDimensions,
      dimensionsDisplay: mainDimensions,
      maxHeightM,
      typicalStoreyHeightM: typicalStoreyM === '--' ? '--' : `${typicalStoreyM} m`,
      yearConstructed: isVacantLand ? 'N/A' : (json.constructionYear || specs.constructionYear || specs.year_of_construction || '--'),
      isEstimatedYear: Boolean(json.isEstimatedYear ?? specs.isEstimatedYear ?? specs.is_year_estimated),
      distanceToMetroAlignmentM: distanceToMetroAlignmentM || '--',
      distanceToMetroEdgeM: distanceToMetroEdgeM || '--',
      distanceToMetroDisplay,
      clearanceVerticalM: clearanceVerticalM || '--',
      clearance3DM: clearance3DM || '--',
      clearanceDisplay,
      surveyCategory: { vi: categoryVi, en: categoryEn },
      vacantLandStatus,
      vacantLandNotes,
      constructionStageNotes,
      gisMergedInfo,
    };

    return { section1, section2, bldgNameVi, bldgNameEn, storeysAbove, rawFoundDepth };
  }
}

