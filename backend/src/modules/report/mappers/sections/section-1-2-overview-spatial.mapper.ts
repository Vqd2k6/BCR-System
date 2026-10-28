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

    const bldgType = (json.buildingType || specs?.buildingType || rawReport.building_type || '').toUpperCase();
    const rawBldgName = isVacantLand
      ? 'Khu đất trống'
      : (json.buildingName || json.usageFunction || specs?.buildingNameVi || specs?.building_name || specs?.land_use_function || rawReport.building_name || (bldgType === 'WAREHOUSE' ? 'Kho hàng' : 'Nhà ở gia đình'));
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

    const candidateOwner = String(
      json.ownerName ?? json.signatures?.ownerName ?? rawReport.owner_name ?? ''
    ).trim();
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
    const metroType: 'C&C' | 'POR' | 'ELV' | 'DEP' =
      rawSegType === 'C&C' || rawSegType === 'POR' || rawSegType === 'ELV' || rawSegType === 'DEP'
        ? rawSegType
        : 'C&C';
    const relatedMetroWorks: RelatedMetroWorks = {
      type: metroType,
      isCutCover: metroType === 'C&C',
      isBoredTunnel: metroType === 'POR',
      isElevated: metroType === 'ELV',
      isDepot: metroType === 'DEP',
    };

    const rawHouse = json.houseNumber ?? rawReport.house_number;
    const rawStreet = json.streetName ?? json.street ?? rawReport.street_name ?? rawReport.street;
    const rawWard = json.wardName ?? json.ward ?? rawReport.ward_name ?? rawReport.ward;
    const ownerPhone = String(
      json.ownerPhone ?? json.signatures?.ownerPhone ?? rawReport.owner_phone ?? ''
    ).trim();

    let stdAddrVi = '';
    let stdAddrEn = '';
    const rawStd = json.standardizedAddress;
    if (typeof rawStd === 'string' && rawStd.trim() !== '') {
      stdAddrVi = rawStd.trim();
    } else if (rawStd && typeof rawStd === 'object') {
      const stdObj = rawStd as Record<string, unknown>;
      const fullStd = String(stdObj.fullStandardized ?? '').trim();
      if (fullStd) {
        stdAddrVi = fullStd;
      } else {
        const stdParts = [stdObj.street, stdObj.wardNew, stdObj.cityNew]
          .map((p) => String(p ?? '').trim())
          .filter(Boolean);
        if (stdParts.length > 0) {
          stdAddrVi = stdParts.join(', ');
        }
      }
    }
    if (stdAddrVi) {
      stdAddrEn = stdAddrVi
        .replace(/Phường\s+/gi, 'Ward ')
        .replace(/Đường\s+/gi, 'St. ')
        .replace(/Số\s+/gi, 'No. ')
        .replace(/TP\.\s*Hồ\s*Chí\s*Minh/gi, 'Ho Chi Minh City');
    }

    const fallbackAddr = rawReport.address_combined ?? rawReport.survey_address ?? json.address ?? json.surveyAddress;
    const baseAddressVi = formatSavedAddressVi(rawHouse, rawStreet, rawWard, fallbackAddr);
    const baseAddressEn = formatSavedAddressEn(rawHouse, rawStreet, rawWard, fallbackAddr);
    const addressVi = stdAddrVi && stdAddrVi !== baseAddressVi
      ? (baseAddressVi !== '--' ? `${baseAddressVi} (Theo NQ 1685: ${stdAddrVi})` : `Theo NQ 1685: ${stdAddrVi}`)
      : baseAddressVi;
    const addressEn = stdAddrEn && stdAddrEn !== baseAddressEn
      ? (baseAddressEn !== '--' ? `${baseAddressEn} (Res. 1685: ${stdAddrEn})` : `Res. 1685: ${stdAddrEn}`)
      : baseAddressEn;

    const section1: Section1GeneralInfo = {
      projectTitleVi: metadata.projectTitleVi,
      projectTitleEn: metadata.projectTitleEn,
      buildingId,
      surveyId,
      reportNo,
      buildingName: { vi: bldgNameVi, en: bldgNameEn },
      address: {
        vi: addressVi,
        en: addressEn,
      },
      cadastralCode,
      ownerOccupant: { vi: ownerVi, en: ownerEn },
      ownerName: ownerVi,
      contactPhone: ownerPhone || '--',
      surveyConsultant: { vi: 'Liên danh CRLG – CRSRI – TT', en: 'CRLG – CRSRI – TT Joint Venture' },
      epcContractor: 'THACO - CREC',
      sectionZone: { vi: zoneNameVi, en: zoneNameEn },
      relatedMetroWorks,
      gpsCoords: {
        lat: defaultLat,
        lng: defaultLng,
        latitude: String(defaultLat),
        longitude: String(defaultLng),
        formatted: `${defaultLat}, ${defaultLng}`,
      },
      surveyDate: surveyDateWithTime,
    };

    // CHƯƠNG II: Đọc trực tiếp 1:1 từ dữ liệu đã lưu (Zero Calculate)
    const explicitAboveFloors = json.aboveFloors ?? specs?.aboveFloors ?? specs?.above_floors ?? specs?.floor_count ?? rawReport.parcel_floor_count;
    const hasExplicitAboveFloors = explicitAboveFloors !== undefined && explicitAboveFloors !== null && explicitAboveFloors !== '' && !isNaN(Number(explicitAboveFloors));
    const storeysAbove: number | string = isVacantLand ? 0 : (hasExplicitAboveFloors ? Number(explicitAboveFloors) : '--');
    const rawBasement = json.undergroundFloors ?? specs?.undergroundFloors ?? specs?.underground_floors ?? specs?.basement_count;
    const storeysBasement: number | string = isVacantLand
      ? 0
      : (rawBasement !== undefined && rawBasement !== null && rawBasement !== '' && !isNaN(Number(rawBasement)) ? Number(rawBasement) : 0);

    const rawLandArea = json.landAreaM2 ?? rawReport.land_area_m2;
    const landAreaM2 = (rawLandArea !== undefined && rawLandArea !== null && rawLandArea !== '' && !isNaN(Number(rawLandArea)))
      ? Number(rawLandArea).toFixed(1)
      : '';

    const rawGfa = json.totalFloorAreaM2 ?? specs?.totalFloorAreaM2 ?? specs?.total_floor_area_m2 ?? json.constructionAreaM2 ?? specs?.constructionAreaM2 ?? specs?.construction_area_m2 ?? rawReport.parcel_construction_area_m2;
    const totalFloorAreaM2 = isVacantLand
      ? '0.0'
      : ((rawGfa !== undefined && rawGfa !== null && rawGfa !== '' && !isNaN(Number(rawGfa))) ? Number(rawGfa).toFixed(1) : '');

    const rawFootprint = json.constructionAreaM2 ?? json.footprintAreaM2 ?? json.groundFloorAreaM2 ?? specs?.constructionAreaM2 ?? specs?.construction_area_m2 ?? specs?.footprintAreaM2 ?? specs?.ground_floor_area_m2 ?? rawReport.parcel_construction_area_m2;
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
            ? (footprintM2 && footprintM2 !== totalFloorAreaM2
                ? `Tổng diện tích sàn: ${totalFloorAreaM2} m² | Diện tích xây dựng: ${footprintM2} m² (Diện tích đất: ${landAreaM2 || '--'} m²)`
                : `Tổng diện tích sàn: ${totalFloorAreaM2} m² (Diện tích đất: ${landAreaM2 || '--'} m²${footprintM2 ? ` | Diện tích xây dựng: ${footprintM2} m²` : ''})`)
            : (footprintM2
                ? `Diện tích xây dựng: ${footprintM2} m² (Diện tích đất: ${landAreaM2 || '--'} m²)`
                : (landAreaM2 ? `Diện tích đất: ${landAreaM2} m²` : '--')),
          en: totalFloorAreaM2
            ? (footprintM2 && footprintM2 !== totalFloorAreaM2
                ? `Total floor area: ${totalFloorAreaM2} m² | Ground footprint: ${footprintM2} m² (Land plot: ${landAreaM2 || '--'} m²)`
                : `Total floor area: ${totalFloorAreaM2} m² (Land plot: ${landAreaM2 || '--'} m²${footprintM2 ? ` | Ground footprint: ${footprintM2} m²` : ''})`)
            : (footprintM2
                ? `Ground footprint: ${footprintM2} m² (Land plot: ${landAreaM2 || '--'} m²)`
                : (landAreaM2 ? `Land plot area: ${landAreaM2} m²` : '--')),
        };

    const rawHeight = Number(json.buildingHeightM ?? specs?.buildingHeightM ?? specs?.building_height_m ?? 0);
    const rawTypicalStorey = Number(json.typicalStoreyHeightM ?? json.floorHeightM ?? specs?.typicalStoreyHeightM ?? specs?.floor_height_m ?? 0);
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
      json.manualMetroDistanceM ?? json.distanceToMetroM ?? json.metroOffsetDistance ?? specs?.metroOffsetDistance ?? rawReport.distance_to_centerline_m
    );
    const distanceToMetroEdgeM = readSavedMeters(
      json.stationEdgeDistance ?? json.clearanceOffsetDistance ?? json.distanceToTunnelEdgeM ?? specs?.clearanceOffsetDistance ?? rawReport.distance_to_tunnel_edge_m
    );

    const alignLabel = distanceToMetroAlignmentM ? `${distanceToMetroAlignmentM} m` : '--';
    const edgeLabel = distanceToMetroEdgeM ? `${distanceToMetroEdgeM} m` : '--';
    const distanceToMetroDisplay: BilingualText = {
      vi: `Tim tuyến: ${alignLabel} | Biên kết cấu / hố đào: ${edgeLabel}`,
      en: `To alignment centerline: ${alignLabel} | To structure / excavation edge: ${edgeLabel}`,
    };

    const rawFoundDepth = json.foundationDepthM ?? specs?.foundation_depth_m;
    const clearanceVerticalM = readSavedMeters(json.clearanceVerticalM ?? specs?.clearanceVerticalM);
    const clearance3DM = readSavedMeters(json.clearance3DM ?? json.clearance3dM ?? specs?.clearance3DM);
    const clearanceDisplay: BilingualText = (clearanceVerticalM || clearance3DM)
      ? {
          vi: `Tĩnh không đứng: ${clearanceVerticalM || '--'} m | Tĩnh không 3D: ${clearance3DM || '--'} m`,
          en: `Vertical clearance: ${clearanceVerticalM || '--'} m | 3D clearance: ${clearance3DM || '--'} m`,
        }
      : { vi: '--', en: '--' };

    let vacantLandStatus: BilingualText | undefined = undefined;
    let vacantLandNotes: BilingualText | undefined = undefined;
    if (isVacantLand) {
      const st = json.vacantLandCurrentState || json.vacantLandStatus || 'Đất trống chưa xây dựng';
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
    const rawGisMutationType = String(
      json.gisMutationConfirmed?.type ||
      rawReport.gis_mutation_type ||
      json.gisMutationType ||
      json.gisMigrationType ||
      json.gis_mutation_type ||
      ''
    ).toUpperCase();
    const gisChangeNote = String(
      gisDetails.fieldChangeNote ||
      json.gisMutationConfirmed?.fieldChangeNote ||
      json.gisMutationConfirmed?.surveyorNotes ||
      json.gisMutationConfirmed?.adminNotes ||
      json.gisModificationNotes ||
      json.gisChangeNote ||
      ''
    ).trim();

    if (rawGisMutationType === 'MERGE' || rawGisMutationType === 'MERGED') {
      const rawMergeList =
        gisDetails.selectedMergeCodes ||
        json.gisMutationConfirmed?.mergedParcels ||
        json.mergedParcels ||
        json.mergedParcelCodes ||
        [];
      const mergeCodes = Array.isArray(rawMergeList) && rawMergeList.length > 0
        ? rawMergeList
            .map((item: unknown) => {
              if (typeof item === 'string') return item.trim();
              if (item && typeof item === 'object') {
                const obj = item as Record<string, unknown>;
                const sheetNo = String(obj.sheetNo ?? obj.mapSheet ?? '').trim();
                const parcelNo = String(obj.parcelNo ?? obj.plotNo ?? '').trim();
                const code = String(obj.code ?? obj.parcelCode ?? '').trim();
                if (sheetNo && parcelNo) return `Tờ ${sheetNo} - Thửa ${parcelNo}`;
                if (code) return code;
                if (parcelNo) return `Thửa ${parcelNo}`;
              }
              return '';
            })
            .filter(Boolean)
            .join(', ')
        : '--';
      const bldgArea = gisDetails.mergeBuildingAreaM2 || json.surveyedParcelAreaM2 || totalFloorAreaM2 || '--';
      const residArea = gisDetails.mergeResidualAreaM2 ?? '--';
      gisMergedInfo = {
        vi: `Hợp thửa từ: ${mergeCodes} | Diện tích XD thực tế: ${bldgArea} m² | Diện tích đất dư: ${residArea} m²${gisChangeNote ? ` | Ghi chú: ${gisChangeNote}` : ''}`,
        en: `Merged from: ${mergeCodes} | Actual building footprint: ${bldgArea} m² | Residual land area: ${residArea} m²${gisChangeNote ? ` | Note: ${gisChangeNote}` : ''}`,
      };
    } else if (rawGisMutationType === 'SPLIT') {
      const splitList = gisDetails.splitChildren || json.gisMutationConfirmed?.splitChildren || json.splitChildren || [];
      const splitCodes = Array.isArray(splitList) && splitList.length > 0
        ? splitList
            .map((item: unknown) => {
              if (typeof item === 'string') return item.trim();
              if (item && typeof item === 'object') {
                const obj = item as Record<string, unknown>;
                const code = String(obj.code ?? obj.parcelCode ?? obj.childCode ?? '').trim();
                const area = obj.areaM2 ?? obj.landAreaM2 ?? obj.area;
                return code ? (area !== undefined && area !== null && area !== '' ? `${code} (${area} m²)` : code) : (area ? `${area} m²` : '');
              }
              return '';
            })
            .filter(Boolean)
            .join(', ')
        : '--';
      gisMergedInfo = {
        vi: `Tách thành các thửa con: ${splitCodes}${gisChangeNote ? ` | Ghi chú: ${gisChangeNote}` : ''}`,
        en: `Split into parcels: ${splitCodes}${gisChangeNote ? ` | Note: ${gisChangeNote}` : ''}`,
      };
    } else if (
      rawGisMutationType === 'BOUNDARY_ADJUST' ||
      rawGisMutationType === 'ADJUSTED' ||
      Boolean(gisChangeNote)
    ) {
      const noteDisplay = gisChangeNote || 'Đã điều chỉnh ranh giới / cắt ranh GPMB theo thực địa';
      const areaDisplay = landAreaM2 || '--';
      gisMergedInfo = {
        vi: `Chỉnh lý ranh giới / cắt ranh GPMB: ${noteDisplay} | Diện tích đất hiện tại: ${areaDisplay} m²`,
        en: `GIS boundary adjustment / clearance: ${noteDisplay} | Current land area: ${areaDisplay} m²`,
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
      yearConstructed: isVacantLand ? 'N/A' : (json.constructionYear || specs?.constructionYear || specs?.year_of_construction || '--'),
      isEstimatedYear: Boolean(json.isEstimatedYear ?? specs?.isEstimatedYear ?? specs?.is_year_estimated),
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

