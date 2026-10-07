/**
 * ============================================================================
 * REPORT OVERRIDE V2 UTILITIES
 * Hỗ trợ ghi đè in-memory khi xem trước hoặc xuất tùy chỉnh
 * ============================================================================
 */

export function applyOverridesToReportV2(rawReport: any, overrides?: any): any {
  if (!overrides || typeof overrides !== 'object') {
    return rawReport;
  }

  const cloned = JSON.parse(JSON.stringify(rawReport));
  cloned.survey_data_json = cloned.survey_data_json || {};

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
  if (overrides.ownerName) {
    cloned.owner_name = overrides.ownerName;
    cloned.survey_data_json.ownerName = overrides.ownerName;
  }
  if (overrides.ownerPhone) {
    cloned.owner_phone = overrides.ownerPhone;
    cloned.survey_data_json.ownerPhone = overrides.ownerPhone;
  }

  // 3. Địa chỉ hành chính chi tiết
  if (overrides.houseNumber !== undefined) {
    cloned.house_number = overrides.houseNumber;
    cloned.survey_data_json.houseNumber = overrides.houseNumber;
  }
  if (overrides.street !== undefined) {
    cloned.street = overrides.street;
    cloned.survey_data_json.street = overrides.street;
  }
  if (overrides.ward !== undefined) {
    cloned.ward = overrides.ward;
    cloned.survey_data_json.ward = overrides.ward;
  }
  if (overrides.district !== undefined) {
    cloned.district = overrides.district;
    cloned.survey_data_json.district = overrides.district;
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
  if (overrides.undergroundFloors !== undefined) {
    cloned.survey_data_json.undergroundFloors = Number(overrides.undergroundFloors);
  }
  if (overrides.constructionAreaM2 !== undefined && overrides.constructionAreaM2 !== '') {
    cloned.parcel_construction_area_m2 = Number(overrides.constructionAreaM2);
    cloned.survey_data_json.constructionAreaM2 = Number(overrides.constructionAreaM2);
  }
  if (overrides.landAreaM2 !== undefined && overrides.landAreaM2 !== '') {
    cloned.land_area_m2 = Number(overrides.landAreaM2);
    cloned.survey_data_json.landAreaM2 = Number(overrides.landAreaM2);
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

  // 5. Cập nhật mảng floors và defects nếu có
  if (overrides.floors && Array.isArray(overrides.floors)) {
    cloned.floors = overrides.floors;
    cloned.survey_data_json.floors = overrides.floors;
  }

  return cloned;
}
