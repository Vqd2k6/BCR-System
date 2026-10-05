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

  if (overrides.buildingId) {
    cloned.project_parcel_code = overrides.buildingId;
  }
  if (overrides.surveyDate) {
    cloned.survey_date = overrides.surveyDate;
  }
  if (overrides.ownerName) {
    cloned.owner_name = overrides.ownerName;
  }
  if (overrides.revision) {
    cloned.revision = overrides.revision;
  }

  return cloned;
}
