/**
 * ============================================================================
 * REPORT OVERRIDE UTILITIES
 * Hỗ trợ ghi đè in-memory khi xem trước (Preview) cho hồ sơ chưa APPROVED.
 * Hồ sơ đã APPROVED luôn đọc từ Snapshot bất biến (bỏ qua overrides).
 * ============================================================================
 */

export function normalizePhotoKey(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  let s = val.trim();
  const qIdx = s.indexOf('?');
  if (qIdx >= 0) s = s.slice(0, qIdx);
  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      s = new URL(s).pathname;
    } catch {
      // ignore
    }
  }
  return s.replace(/^\/+/, '').toLowerCase();
}

export function applyPhotoOverrideList(list: any[], photoOverrides: Record<string, any>): any[] {
  if (!Array.isArray(list)) return list;
  const out: any[] = [];
  for (const item of list) {
    const rawUrl = typeof item === 'string' ? item : item?.url || item?.raw_photo_url || item?.photoUrl;
    const code = typeof item === 'object' ? item?.photoCode || item?.photo_code || item?.id : undefined;
    const normUrl = normalizePhotoKey(rawUrl);
    const normCode = normalizePhotoKey(code);

    const matchEntry = Object.entries(photoOverrides).find(([k]) => {
      const nk = normalizePhotoKey(k);
      return nk && (nk === normUrl || (normCode && nk === normCode) || (normUrl && normUrl.endsWith(nk)));
    });
    const ov = matchEntry ? matchEntry[1] : undefined;

    if (ov?.deleted) {
      continue;
    }
    if (ov && typeof item === 'object' && item !== null) {
      const cloned = { ...item };
      if (ov.replacedUrl) {
        if ('url' in cloned) cloned.url = ov.replacedUrl;
        if ('raw_photo_url' in cloned) cloned.raw_photo_url = ov.replacedUrl;
        if ('annotated_photo_url' in cloned) cloned.annotated_photo_url = ov.replacedUrl;
        if ('photoUrl' in cloned) cloned.photoUrl = ov.replacedUrl;
      }
      if (typeof ov.rotation === 'number') {
        cloned.rotation = ov.rotation;
      }
      out.push(cloned);
    } else if (ov && typeof item === 'string') {
      out.push(ov.replacedUrl || item);
    } else {
      out.push(item);
    }
  }
  return out;
}

export function deepMergeOverride(target: any, source: any): any {
  if (!source || typeof source !== 'object') return target;
  const output = Array.isArray(target) ? [...target] : { ...(target || {}) };
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      output[key] = val;
    } else if (val !== null && typeof val === 'object') {
      output[key] = deepMergeOverride(output[key], val);
    } else {
      output[key] = val;
    }
  }
  return output;
}

function replaceStudioUrlsDeep(
  node: any,
  studioMap: Record<string, string>,
  skipKeys: Set<string> = new Set(['studioEnhancedPhotos', 'studioEnhancedByOriginal'])
): any {
  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (studioMap[trimmed]) return studioMap[trimmed];
    if (studioMap[node]) return studioMap[node];
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((item) => replaceStudioUrlsDeep(item, studioMap, skipKeys));
  }
  if (node !== null && typeof node === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = skipKeys.has(k) ? v : replaceStudioUrlsDeep(v, studioMap, skipKeys);
    }
    return out;
  }
  return node;
}

export function applyOverridesToReport(rawReport: any, overrides?: any): any {
  const rawJsonObj =
    typeof rawReport?.survey_data_json === 'string'
      ? JSON.parse(rawReport.survey_data_json || '{}')
      : rawReport?.survey_data_json || {};
  const studioByOrig =
    rawJsonObj?.studioEnhancedByOriginal && typeof rawJsonObj.studioEnhancedByOriginal === 'object'
      ? (rawJsonObj.studioEnhancedByOriginal as Record<string, string>)
      : null;

  if (!overrides || typeof overrides !== 'object' || Object.keys(overrides).length === 0) {
    if (studioByOrig && Object.keys(studioByOrig).length > 0) {
      const clonedWithStudio = replaceStudioUrlsDeep(JSON.parse(JSON.stringify(rawReport)), studioByOrig);
      if (typeof clonedWithStudio.survey_data_json === 'string') {
        clonedWithStudio.survey_data_json = JSON.stringify(replaceStudioUrlsDeep(rawJsonObj, studioByOrig));
      }
      return clonedWithStudio;
    }
    return rawReport;
  }

  let cloned = JSON.parse(JSON.stringify(rawReport));
  if (studioByOrig && Object.keys(studioByOrig).length > 0) {
    cloned = replaceStudioUrlsDeep(cloned, studioByOrig);
  }
  const baseJson =
    typeof cloned.survey_data_json === 'string'
      ? JSON.parse(cloned.survey_data_json || '{}')
      : { ...(cloned.survey_data_json || {}) };

  const mergedJson = deepMergeOverride(baseJson, overrides.surveyDataJson || overrides);

  if (overrides.photoRotations && typeof overrides.photoRotations === 'object') {
    mergedJson.photoRotations = {
      ...(mergedJson.photoRotations || {}),
      ...overrides.photoRotations,
    };
  }

  if (overrides.photoOverrides && typeof overrides.photoOverrides === 'object') {
    const pOv = overrides.photoOverrides;
    if (Array.isArray(cloned.identificationPhotos)) {
      cloned.identificationPhotos = applyPhotoOverrideList(cloned.identificationPhotos, pOv);
    }
    if (Array.isArray(mergedJson.asBuiltDrawings)) {
      mergedJson.asBuiltDrawings = applyPhotoOverrideList(mergedJson.asBuiltDrawings, pOv);
    }
    if (Array.isArray(mergedJson.asBuiltDrawingPhotos)) {
      mergedJson.asBuiltDrawingPhotos = applyPhotoOverrideList(mergedJson.asBuiltDrawingPhotos, pOv);
    }
  }

  cloned.survey_data_json = mergedJson;

  // 1. Định danh & Cán bộ khảo sát
  if (overrides.buildingId || overrides.projectParcelCode) {
    cloned.project_parcel_code = overrides.buildingId || overrides.projectParcelCode;
  }
  if (overrides.surveyDate) {
    cloned.survey_date = overrides.surveyDate;
  }
  if (overrides.revision) {
    cloned.revision = overrides.revision;
  }
  if (overrides.officialCadastralCode) {
    cloned.official_cadastral_code = overrides.officialCadastralCode;
    cloned.survey_data_json.officialCadastralCode = overrides.officialCadastralCode;
  }

  // 2. Chủ hộ & Số điện thoại
  const p = overrides.parcel && typeof overrides.parcel === 'object' ? overrides.parcel : overrides;
  if (p.ownerName !== undefined) {
    cloned.owner_name = p.ownerName;
    cloned.survey_data_json.ownerName = p.ownerName;
  }
  if (p.ownerPhone !== undefined) {
    cloned.owner_phone = p.ownerPhone;
    cloned.survey_data_json.ownerPhone = p.ownerPhone;
  }

  // 3. Địa chỉ hành chính chi tiết
  if (p.houseNumber !== undefined) {
    cloned.house_number = p.houseNumber;
    cloned.survey_data_json.houseNumber = p.houseNumber;
  }
  if (p.street !== undefined) {
    cloned.street = p.street;
    cloned.survey_data_json.street = p.street;
  }
  if (p.ward !== undefined) {
    cloned.ward = p.ward;
    cloned.survey_data_json.ward = p.ward;
  }
  if (p.district !== undefined) {
    cloned.district = p.district;
    cloned.survey_data_json.district = p.district;
  }

  // 4. Quy mô công trình & Công năng
  if (overrides.buildingName) {
    cloned.building_name = overrides.buildingName;
    cloned.survey_data_json.buildingName = overrides.buildingName;
  }
  if (overrides.usageFunction) {
    cloned.survey_data_json.usageFunction = overrides.usageFunction;
  }
  if (overrides.aboveFloors !== undefined) {
    cloned.parcel_floor_count = Number(overrides.aboveFloors);
    cloned.survey_data_json.aboveFloors = Number(overrides.aboveFloors);
  }
  if (p.floorCount !== undefined && p.floorCount !== '') {
    cloned.floor_count = Number(p.floorCount);
    cloned.parcel_floor_count = Number(p.floorCount);
  }
  if (overrides.undergroundFloors !== undefined) {
    cloned.survey_data_json.undergroundFloors = Number(overrides.undergroundFloors);
  }
  if (p.constructionAreaM2 !== undefined && p.constructionAreaM2 !== '') {
    cloned.construction_area_m2 = Number(p.constructionAreaM2);
    cloned.parcel_construction_area_m2 = Number(p.constructionAreaM2);
    cloned.survey_data_json.constructionAreaM2 = Number(p.constructionAreaM2);
  }
  if (p.landAreaM2 !== undefined && p.landAreaM2 !== '') {
    cloned.land_area_m2 = Number(p.landAreaM2);
    cloned.survey_data_json.landAreaM2 = Number(p.landAreaM2);
  }
  if (overrides.buildingHeightM !== undefined && overrides.buildingHeightM !== '') {
    cloned.survey_data_json.buildingHeightM = Number(overrides.buildingHeightM);
  }
  if (overrides.structureSystem) {
    cloned.survey_data_json.structureSystem = overrides.structureSystem;
  }
  if (overrides.foundationType) {
    cloned.survey_data_json.foundationType = overrides.foundationType;
  }
  if (p.frontageWidth !== undefined && p.frontageWidth !== '') {
    cloned.frontage_width = Number(p.frontageWidth);
    cloned.survey_data_json.frontageWidth = Number(p.frontageWidth);
  }
  if (p.lotDepth !== undefined && p.lotDepth !== '') {
    cloned.lot_depth = Number(p.lotDepth);
    cloned.survey_data_json.lotDepth = Number(p.lotDepth);
  }

  // 5. Cập nhật mảng floors và defects nếu có
  if (overrides.floors && Array.isArray(overrides.floors)) {
    cloned.floors = overrides.floors;
    cloned.survey_data_json.floors = overrides.floors;
  }

  return cloned;
}
