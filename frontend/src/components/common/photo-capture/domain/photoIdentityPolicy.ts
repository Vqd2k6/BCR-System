import type {
  MetroFloorType,
  MetroPhotoType,
  MetroWatermarkOptions,
} from '../../../../utils/watermarkEngine';

/**
 * TRỤ CỘT KIẾN TRÚC 2: PHOTO IDENTITY POLICY & SCOPED STORAGE ROUTER
 * Định nghĩa Hợp đồng Định danh Ảnh Pháp lý (Compile-time Type Contract)
 * và Bộ định tuyến Thư mục R2 / Cô lập Store theo từng loại hình khảo sát:
 * - PRIVATE_HOUSE (Nhà dân riêng lẻ)
 * - CONDO_MASTER (Tòa nhà chung cư tổng thể & Khu vực chung)
 * - CONDO_UNIT (Căn hộ con chung cư)
 */

export type SurveyEntityScope = 'PRIVATE_HOUSE' | 'CONDO_MASTER' | 'CONDO_UNIT';

export interface PrivateHousePhotoParams {
  parcelCode: string;
  photoType: MetroPhotoType;
  floor?: MetroFloorType;
  floorCode?: string;
  zoneOrRoom?: string;
  subEntity?: string;
  defectCode?: string;
  photoIndex?: number;
  category?: string;
}

export interface CondoMasterPhotoParams {
  parcelCode: string;
  buildingCode?: string;
  areaType?: 'GENERAL_TOWER' | 'MASTER_AREA' | 'CAD_BLUEPRINT';
  photoType: MetroPhotoType;
  floor?: MetroFloorType;
  floorCode?: string;
  unitCode?: string;
  zoneOrRoom?: string;
  subEntity?: string;
  defectCode?: string;
  photoIndex?: number;
  category?: string;
}

export interface CondoUnitPhotoParams {
  parcelCode?: string;
  buildingCode?: string;
  unitCode: string; // BẮT BUỘC ở thời điểm biên dịch (Compile-time mandatory)
  photoType?: MetroPhotoType;
  floor?: MetroFloorType;
  floorCode?: string;
  zoneOrRoom?: string;
  subEntity?: string;
  defectCode?: string;
  photoIndex?: number;
  category?: string;
}

/**
 * Factory chuẩn tạo cấu hình Watermark & Định danh cho Nhà dân riêng lẻ
 */
export function createPrivateHousePhotoOptions(
  params: PrivateHousePhotoParams
): MetroWatermarkOptions {
  return {
    parcelCode: params.parcelCode,
    areaType: 'PRIVATE_HOUSE',
    photoType: params.photoType,
    floor: params.floor,
    floorCode: params.floorCode,
    zoneOrRoom: params.zoneOrRoom || params.subEntity,
    defectCode: params.defectCode,
    photoIndex: params.photoIndex,
    category: params.category,
  };
}

/**
 * Factory chuẩn tạo cấu hình Watermark & Định danh cho Chung cư tổng thể / Khu vực chung
 */
export function createCondoMasterPhotoOptions(
  params: CondoMasterPhotoParams
): MetroWatermarkOptions {
  return {
    parcelCode: params.parcelCode || params.buildingCode,
    buildingCode: params.buildingCode || params.parcelCode,
    areaType: params.areaType || 'GENERAL_TOWER',
    photoType: params.photoType,
    floor: params.floor,
    floorCode: params.floorCode,
    unitCode: params.unitCode,
    zoneOrRoom: params.zoneOrRoom || params.subEntity,
    defectCode: params.defectCode,
    photoIndex: params.photoIndex,
    category: params.category,
  };
}

/**
 * Factory chuẩn tạo cấu hình Watermark & Định danh cho Căn hộ con chung cư
 * Bắt buộc truyền unitCode và khóa cứng areaType = 'CONDO_UNIT'
 */
export function createCondoUnitPhotoOptions(
  params: CondoUnitPhotoParams
): MetroWatermarkOptions {
  const resolvedZoneOrRoom = params.zoneOrRoom || params.subEntity;
  const resolvedParcel = params.parcelCode || params.buildingCode || 'GENERAL';
  return {
    parcelCode: resolvedParcel,
    buildingCode: params.buildingCode || resolvedParcel,
    unitCode: params.unitCode,
    areaType: 'CONDO_UNIT',
    photoType: params.photoType,
    floor: params.floor || params.floorCode,
    floorCode: params.floorCode,
    zoneOrRoom: resolvedZoneOrRoom,
    defectCode: params.defectCode,
    photoIndex: params.photoIndex,
    category: params.category,
  };
}

/**
 * Phân giải Scope của thực thể khảo sát từ areaType
 */
export function resolveSurveyScopeFromAreaType(
  areaType?: MetroWatermarkOptions['areaType'] | string
): SurveyEntityScope {
  if (areaType === 'CONDO_UNIT') {
    return 'CONDO_UNIT';
  }
  if (
    areaType === 'GENERAL_TOWER' ||
    areaType === 'MASTER_AREA' ||
    areaType === 'CAD_BLUEPRINT'
  ) {
    return 'CONDO_MASTER';
  }
  return 'PRIVATE_HOUSE';
}

/**
 * Kiểm tra mã công trình hợp lệ: Tuyệt đối không nhận các tiền tố kỹ thuật cấu kiện / CAD làm mã công trình
 */
export function isInvalidBuildingCodeToken(candidate?: string): boolean {
  if (!candidate) return true;
  const clean = candidate.replace(/^\[|\]$/g, '').trim().toUpperCase();
  return (
    clean.length < 3 ||
    clean.startsWith('STRUCTURAL') ||
    clean.startsWith('CAD') ||
    clean.startsWith('ZONE') ||
    clean.startsWith('DEFECT') ||
    clean.startsWith('OVERVIEW') ||
    clean.startsWith('PHOTO') ||
    clean.startsWith('CONDO') ||
    clean.startsWith('PHASE') ||
    clean.startsWith('KYXACNHAN') ||
    clean.startsWith('SIGN')
  );
}

export interface ResolvePhotoStorageInput {
  watermarkOptions?: MetroWatermarkOptions;
  code?: string;
  displayPhotoCode?: string;
  label?: string;
  customCapturedAt?: string;
  fallbackBuildingCode?: string;
  activeParcelId?: string | null;
  activeUnitId?: string | null;
}

export interface ResolvedPhotoStorageTarget {
  buildingCode: string;
  photoType: string;
  surveyScope: SurveyEntityScope;
  targetFolder: string;
  selfDescribingFilename: string;
  metadata: Record<string, string>;
}

/**
 * Single Source of Truth: Giải mã thông tin định danh và quyết định cây thư mục R2 + Tên file + Metadata chuẩn kebab-case
 */
export function resolvePhotoStorageTarget(
  input: ResolvePhotoStorageInput
): ResolvedPhotoStorageTarget {
  const {
    watermarkOptions,
    code,
    displayPhotoCode,
    label,
    customCapturedAt,
    fallbackBuildingCode,
    activeParcelId,
    activeUnitId,
  } = input;

  // Ưu tiên cả parcelCode lẫn buildingCode từ watermarkOptions ([CH-05])
  let buildingCode =
    watermarkOptions?.parcelCode || watermarkOptions?.buildingCode || '';
  let pType = String(watermarkOptions?.photoType || '');
  const fullCode = code || displayPhotoCode || '';

  let filenameEpoch = Date.now();
  let effectiveCapturedAt = new Date().toISOString();
  if (customCapturedAt) {
    const parsedEpoch = new Date(customCapturedAt).getTime();
    if (!isNaN(parsedEpoch) && parsedEpoch > 1500000000000 && parsedEpoch < 2500000000000) {
      filenameEpoch = parsedEpoch;
      effectiveCapturedAt = new Date(parsedEpoch).toISOString();
    }
  }

  if (isInvalidBuildingCodeToken(buildingCode)) {
    buildingCode = '';
  }

  // 1. Trích xuất mã từ fullCode (chuẩn Metro 2 dạng HCM_M2.[PARCEL_CODE]_...)
  if (!buildingCode && fullCode) {
    const cleanCode = fullCode.replace(/^HCM_M2[._]/i, '');
    const bracketMatch = cleanCode.match(/^\[([^\]]+)\]/);
    if (bracketMatch && !isInvalidBuildingCodeToken(bracketMatch[1])) {
      buildingCode = bracketMatch[1];
      const rest = cleanCode.substring(bracketMatch[0].length).replace(/^_+/, '');
      const parts = rest.split('_');
      if (!pType && parts.length > 1) {
        pType = parts[parts.length - 2] || parts[0];
      }
    } else {
      if (cleanCode.includes('|')) {
        const pipeParts = cleanCode.split('|').map((s) => s.trim());
        const found = pipeParts.find((s) => !isInvalidBuildingCodeToken(s));
        if (found) {
          buildingCode = found;
        }
      }
      if (!buildingCode) {
        const parts = cleanCode.split(/[._]/);
        if (parts[0] && !isInvalidBuildingCodeToken(parts[0])) {
          buildingCode = parts[0];
        }
      }
    }
  }

  // 2. Fallback từ đúng Store theo Scope hiện tại
  if (!buildingCode && fallbackBuildingCode && !isInvalidBuildingCodeToken(fallbackBuildingCode)) {
    buildingCode = fallbackBuildingCode;
  }

  // 3. Nếu hoàn toàn không xác định được mã công trình, gom vào 'general'
  if (!buildingCode || isInvalidBuildingCodeToken(buildingCode)) {
    buildingCode = 'general';
  }

  // Tự động nhận diện loại ảnh pType nếu chưa được khai báo
  if (!pType && fullCode) {
    const upper = fullCode.toUpperCase();
    if (upper.includes('STRUCTURAL') || upper.includes('CAD_STRUCT') || upper.includes('CAD-E') || upper.includes('CAD_02')) {
      pType = 'CAD_STRUCT';
    } else if (upper.includes('CAD_ARCH') || upper.includes('CAD-Z') || upper.includes('CAD_01')) {
      pType = 'CAD_ARCH';
    } else if (upper.includes('CTX')) {
      pType = 'CTX';
    } else if (upper.includes('CU')) {
      pType = 'CU';
    } else if (upper.includes('OVERVIEW') || upper.includes('_OV_')) {
      pType = 'OVERVIEW';
    } else if (upper.includes('MINUTES') || upper.includes('DOC') || upper.includes('KÝ XÁC NHẬN')) {
      pType = 'DOC';
    }
  }

  buildingCode = buildingCode.replace(/&/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  pType = String(pType).replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();

  const rawFloorCode = watermarkOptions?.floorCode || watermarkOptions?.floor || '';
  const cleanFloorCode = String(rawFloorCode).replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  const cleanUnitCode = String(watermarkOptions?.unitCode || '').replace(/[^a-zA-Z0-9_.-]/g, '_').toUpperCase();

  let subEntity = '';
  if (fullCode) {
    const matchZ = fullCode.match(/(Z-?\d+)/i);
    const matchE = fullCode.match(/(E-?\d+)/i);
    if (matchZ) subEntity = matchZ[1].replace('-', '').toUpperCase();
    else if (matchE) subEntity = matchE[1].replace('-', '').toUpperCase();
  }
  if (!subEntity && watermarkOptions?.zoneOrRoom) {
    subEntity = String(watermarkOptions.zoneOrRoom).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  let targetFolder = 'surveys';
  let selfDescribingFilename = '';

  const areaType = watermarkOptions?.areaType;
  const surveyScope = resolveSurveyScopeFromAreaType(areaType);

  if (areaType === 'GENERAL_TOWER') {
    let category = watermarkOptions?.category || '';
    if (!category) {
      if (['P01', 'P02', 'P03', 'P04'].includes(pType)) {
        category = 'exterior';
      } else if (pType === 'SETTLE') {
        category = 'settlement';
      } else if (pType === 'TILT') {
        category = 'tilt';
      } else if (pType === 'ANOMALY') {
        category = 'anomalies';
      } else if (['DRAWING', 'AS_BUILT', 'HOANCONG', 'KETCAU'].includes(pType)) {
        category = 'foundation-drawings';
      } else if (pType === 'EQUIPMENT') {
        category = 'equipment';
      } else if (['BOUNDARY', 'MUTATION'].includes(pType)) {
        category = 'boundary';
      } else if (pType.includes('SIGN') || pType.includes('MINUTES')) {
        category = 'signatures';
      } else {
        category = 'general-photos';
      }
    }

    targetFolder = `projects/METRO2_HCM/buildings/${buildingCode || 'GENERAL'}/general/${category}`;

    const nameParts = ['M2', buildingCode || 'GENERAL', 'GENERAL'];
    nameParts.push(pType || category.toUpperCase());
    if (watermarkOptions?.photoIndex) {
      nameParts.push(String(watermarkOptions.photoIndex).padStart(2, '0'));
    }
    nameParts.push(String(filenameEpoch));
    selfDescribingFilename = `${nameParts.join('__')}.jpg`;
  } else if (areaType === 'CAD_BLUEPRINT') {
    const floor = cleanFloorCode || 'G';
    targetFolder = `projects/METRO2_HCM/buildings/${buildingCode || 'GENERAL'}/cad-blueprints/floors/${floor}/original`;
    selfDescribingFilename = `M2__${buildingCode || 'GENERAL'}__${floor}__CAD_BLUEPRINT__${filenameEpoch}.jpg`;
  } else if (areaType === 'MASTER_AREA') {
    const floor = cleanFloorCode || 'G';
    const folderUnit = cleanUnitCode || 'general';
    let category = watermarkOptions?.category || '';

    if (!category) {
      if (pType.includes('CAD')) {
        category = 'cad';
      } else if (pType === 'OVERVIEW') {
        category = 'overview';
      } else if (pType === 'Z_CTX' || (subEntity.startsWith('Z') && pType === 'CTX')) {
        category = 'zones';
      } else if (pType === 'E_CTX' || (subEntity.startsWith('E') && pType === 'CTX')) {
        category = 'elements';
      } else if (['CU', 'CU_ANN', 'CU_ANNOTATED'].includes(pType) || watermarkOptions?.defectCode) {
        category = 'defects';
      } else if (pType.includes('SIGN') || pType.includes('MINUTES')) {
        category = 'signatures';
      } else {
        category = 'photos';
      }
    }

    targetFolder = `projects/METRO2_HCM/buildings/${buildingCode || 'GENERAL'}/floors/${floor}/master-areas/${folderUnit}/${category}`;

    const nameParts = ['M2', buildingCode || 'GENERAL', floor, folderUnit];
    if (subEntity) nameParts.push(subEntity);
    if (watermarkOptions?.defectCode) {
      nameParts.push(String(watermarkOptions.defectCode).replace(/[^a-zA-Z0-9_-]/g, ''));
    }
    nameParts.push(pType || 'PHOTO');
    if (watermarkOptions?.photoIndex) {
      nameParts.push(String(watermarkOptions.photoIndex).padStart(2, '0'));
    }
    nameParts.push(String(filenameEpoch));
    selfDescribingFilename = `${nameParts.join('__')}.jpg`;
  } else if (areaType === 'CONDO_UNIT') {
    const floor = cleanFloorCode || 'F01';
    const folderUnit = cleanUnitCode || 'general';
    let category = watermarkOptions?.category || '';

    if (!category) {
      if (['P01', 'P04'].includes(pType)) {
        category = 'identification';
      } else if (pType.includes('CAD')) {
        category = 'cad';
      } else if (pType === 'OVERVIEW') {
        category = 'overview';
      } else if (pType === 'Z_CTX' || (subEntity.startsWith('Z') && pType === 'CTX')) {
        category = 'zones';
      } else if (pType === 'E_CTX' || (subEntity.startsWith('E') && pType === 'CTX')) {
        category = 'elements';
      } else if (pType === 'WATER_LEAK') {
        category = 'water-leaks';
      } else if (pType === 'DOOR_JAM') {
        category = 'door-jams';
      } else if (['CU', 'CU_ANN', 'CU_ANNOTATED', 'DEFECT'].includes(pType) || watermarkOptions?.defectCode) {
        category = 'defects';
      } else if (pType === 'SAGGING') {
        category = 'sagging';
      } else if (pType.includes('SIGN') || pType.includes('MINUTES') || pType === 'ABSENTEE') {
        category = 'signatures';
      } else {
        category = 'photos';
      }
    }

    targetFolder = `projects/METRO2_HCM/buildings/${buildingCode || 'GENERAL'}/floors/${floor}/condo-units/${folderUnit}/${category}`;

    const nameParts = ['M2', buildingCode || 'GENERAL', floor, folderUnit];
    // Bảo toàn subEntity (Z01 / E01) trong tên file của CONDO_UNIT để tránh trùng tên file ([CH-05])
    if (subEntity) nameParts.push(subEntity);
    if (watermarkOptions?.defectCode) {
      nameParts.push(String(watermarkOptions.defectCode).replace(/[^a-zA-Z0-9_-]/g, ''));
    }
    nameParts.push(pType || 'PHOTO');
    if (watermarkOptions?.photoIndex) {
      nameParts.push(String(watermarkOptions.photoIndex).padStart(2, '0'));
    }
    nameParts.push(String(filenameEpoch));
    selfDescribingFilename = `${nameParts.join('__')}.jpg`;
  } else {
    // KHẢO SÁT NHÀ DÂN TIÊU CHUẨN
    if (buildingCode) {
      targetFolder = pType ? `surveys/${buildingCode}/${pType}` : `surveys/${buildingCode}`;
    }
    const prefix = code ? code.replace(/[^a-zA-Z0-9_-]/g, '_') : 'photo';
    selfDescribingFilename = `${prefix}_${filenameEpoch}.jpg`;
  }

  const metadata: Record<string, string> = {
    'photo-code': fullCode,
    'building-code': buildingCode,
    'photo-type': pType,
    'survey-phase': 'PHASE_1',
    'survey-scope': surveyScope,
    'target-folder': targetFolder,
    'project': 'METRO2_HCM',
    'captured-at': effectiveCapturedAt,
    ...(customCapturedAt ? { 'annotated-at': new Date().toISOString() } : {}),
  };

  if (activeParcelId) {
    metadata['survey-parcel-id'] = activeParcelId;
  }
  if (activeUnitId) {
    metadata['unit-id'] = activeUnitId;
  }
  if (cleanFloorCode) {
    metadata['floor-code'] = cleanFloorCode;
  }
  if (watermarkOptions?.floor) {
    metadata['floor'] = String(watermarkOptions.floor);
  }
  if (cleanUnitCode) {
    metadata['unit-code'] = cleanUnitCode;
  }
  if (watermarkOptions?.areaType) {
    metadata['area-type'] = watermarkOptions.areaType;
  }
  if (watermarkOptions?.stationCode) {
    metadata['station-code'] = watermarkOptions.stationCode;
  }
  if (label) {
    metadata['label'] = label;
  }
  if (watermarkOptions?.defectCode) {
    metadata['defect-code'] = String(watermarkOptions.defectCode);
  }
  if (subEntity) {
    metadata['sub-entity'] = subEntity;
  }
  if (watermarkOptions?.category) {
    metadata['category'] = watermarkOptions.category;
  }
  if (typeof watermarkOptions?.gpsLat === 'number') {
    metadata['gps-lat'] = String(watermarkOptions.gpsLat);
  }
  if (typeof watermarkOptions?.gpsLng === 'number') {
    metadata['gps-lng'] = String(watermarkOptions.gpsLng);
  }
  if (typeof watermarkOptions?.gpsAccuracy === 'number') {
    metadata['gps-accuracy'] = String(watermarkOptions.gpsAccuracy);
  }
  if (typeof watermarkOptions?.gisLat === 'number') {
    metadata['gis-parcel-lat'] = String(watermarkOptions.gisLat);
  }
  if (typeof watermarkOptions?.gisLng === 'number') {
    metadata['gis-parcel-lng'] = String(watermarkOptions.gisLng);
  }

  return {
    buildingCode,
    photoType: pType,
    surveyScope,
    targetFolder,
    selfDescribingFilename,
    metadata,
  };
}

/**
 * Phục hồi chính xác thư mục R2 khi đồng bộ lại ảnh Offline từ IndexedDB ([CH-05])
 */
export function resolveOfflineTargetFolderFromMetadata(
  metadata?: Record<string, string>
): string {
  if (!metadata) return 'surveys';
  if (metadata['target-folder'] && metadata['target-folder'].trim().length > 0) {
    return metadata['target-folder'].trim();
  }

  const areaType = metadata['area-type'] as MetroWatermarkOptions['areaType'] | undefined;
  const buildingCode = metadata['building-code'] || 'GENERAL';
  const photoType = metadata['photo-type'] || '';
  const floorCode = metadata['floor-code'] || metadata['floor'] || '';
  const unitCode = metadata['unit-code'] || '';
  const category = metadata['category'] || '';
  const defectCode = metadata['defect-code'] || '';
  const subEntity = metadata['sub-entity'] || '';

  if (areaType === 'GENERAL_TOWER' || areaType === 'MASTER_AREA' || areaType === 'CONDO_UNIT' || areaType === 'CAD_BLUEPRINT') {
    const resolved = resolvePhotoStorageTarget({
      watermarkOptions: {
        parcelCode: buildingCode,
        buildingCode,
        areaType,
        photoType,
        floorCode,
        unitCode,
        category,
        defectCode,
        zoneOrRoom: subEntity,
      },
      code: metadata['photo-code'],
    });
    return resolved.targetFolder;
  }

  if (metadata['building-code']) {
    return photoType
      ? `surveys/${metadata['building-code']}/${photoType}`
      : `surveys/${metadata['building-code']}`;
  }

  return 'surveys';
}
