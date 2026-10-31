/**
 * Căn hộ vắng chủ chỉ có giá trị pháp lý ở phần luồng vắng thu thập được. Các hồ sơ cũ buộc KSV điền đủ form
 * thường nên phần nội thất và điểm số là dữ liệu điền cho qua, in ra sẽ thành kết luận "an toàn" cho căn chưa
 * từng vào được. Chỉ loại khỏi bản in/bản đóng băng; bản ghi gốc trong CSDL giữ nguyên.
 */
import { Database } from '../../../database/db';
import { fetchCondoUnitAbsenceMap, isUnknownOwnerName, isUnknownOwnerPhone } from '../../audit/condo/condo-absence.resolver';
import { isResidentialAbsentSurvey } from '../../audit/absence-evidence';

type JsonObject = Record<string, unknown>;

const EXCLUDED_SURVEY_KEYS = [
  'damageZones',
  'zones',
  'floors',
  'floorSurvey',
  'structuralElements',
  'localDefects',
  'overviewPhotos',
  'cadZonePins',
  'cadElementPins',
  'burlandSummary',
  'dominantBurlandGrade',
  'historyInterview',
  'interiorRenovationHistory',
  'beamSagging',
  'settlementTilt',
  'settlementObserved',
  'settlementNotes',
  'doorJammingStatus',
  'doorJamming',
  'upperFloorWaterLeakage',
  'hasSensitiveEquipment',
  'sensitiveEquipmentDesc',
  'ecs',
  'vi',
  'vulnerabilityIndex',
  'executiveSummary',
  'braAssessment',
  'braMatrix',
  'impactAssessment',
  'ownerFeedback',
  'unitAreaM2',
];

function isJsonObject(val: unknown): val is JsonObject {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function projectCondoAbsentSurveyJson(surveyJson: JsonObject): JsonObject {
  const projected: JsonObject = { ...surveyJson, isAbsenteeSurvey: true };
  for (const key of EXCLUDED_SURVEY_KEYS) {
    delete projected[key];
  }
  if (isUnknownOwnerName(projected.ownerName)) projected.ownerName = '';
  if (isUnknownOwnerPhone(projected.ownerPhone)) projected.ownerPhone = '';
  if (isJsonObject(projected.signatures)) {
    const signatures = { ...projected.signatures };
    delete signatures.ownerFeedback;
    if (isUnknownOwnerName(signatures.ownerName)) signatures.ownerName = '';
    if (isUnknownOwnerPhone(signatures.ownerPhone)) signatures.ownerPhone = '';
    projected.signatures = signatures;
  }
  return projected;
}

/** Nhà dân vắng vẫn có quan sát lún nghiêng từ ngoài nhà ở Bước 1; chỉ võng dầm là số đo bên trong. */
export function projectResidentialAbsentSurveyJson(surveyJson: JsonObject): JsonObject {
  const projected = projectCondoAbsentSurveyJson(surveyJson);
  if (isJsonObject(surveyJson.settlementTilt)) {
    const exteriorObservation = { ...surveyJson.settlementTilt };
    delete exteriorObservation.beamSagging;
    projected.settlementTilt = exteriorObservation;
  }
  return projected;
}

/** Địa chỉ chuẩn hóa thuộc về Tòa mẹ; hồ sơ con không có màn sửa địa chỉ nên đọc lại từ đây. */
export async function fetchMasterStandardizedAddress(parcelId: string): Promise<string | null> {
  const res = await Database.query<{ standardized_address: string | null }>(
    `SELECT survey_data_json->>'standardizedAddress' AS standardized_address
     FROM base_survey_reports
     WHERE parcel_id = $1
       AND deleted_at IS NULL
       AND (unit_id IS NULL OR report_type IN ('BUILDING_MASTER', 'CONDO_MASTER'))
     ORDER BY created_at DESC
     LIMIT 1;`,
    [parcelId]
  );
  return res.rows[0]?.standardized_address?.trim() || null;
}

/** Áp dụng ở điểm render chung vì hồ sơ vắng xác thực trước đây không có `APPROVED_RELEASE`, báo cáo đọc thẳng bảng live. */
export async function applyCondoReportContext<T extends Record<string, any>>(report: T): Promise<T> {
  const surveyJson = isJsonObject(report?.survey_data_json) ? report.survey_data_json : {};
  const isResidentialAbsent = !report?.unit_id && isResidentialAbsentSurvey(surveyJson);
  if (!report?.unit_id && !isResidentialAbsent) return report;

  const reportId = String(report.id);
  const absence = report.unit_id ? (await fetchCondoUnitAbsenceMap([reportId])).get(reportId) : undefined;
  const isAbsent = isResidentialAbsent || absence?.state === 'ABSENT';
  const logsRes = await Database.query<Record<string, unknown>>(
    report.unit_id
      ? `SELECT * FROM survey_absence_logs WHERE unit_id = $1 ORDER BY recorded_at DESC;`
      : `SELECT * FROM survey_absence_logs WHERE parcel_id = $1 AND unit_id IS NULL ORDER BY recorded_at DESC;`,
    [report.unit_id ?? report.parcel_id]
  );
  const next: Record<string, any> = { ...report, absenceLogs: logsRes.rows };

  if (isAbsent) {
    next.condoUnitAbsent = true;
    next.residentialAbsent = isResidentialAbsent;
    next.survey_data_json = isResidentialAbsent
      ? projectResidentialAbsentSurveyJson(surveyJson)
      : projectCondoAbsentSurveyJson(surveyJson);
    next.floors = [];
    next.buildingSpecs = null;
    next.damageZones = [];
    next.damage_zones = [];
    next.structuralElements = [];
    next.riskScores = null;
    next.deformation = null;
    next.historicalSensitivity = null;
    next.owner_remarks = null;
    next.summary_conclusions = null;
  }

  const isFrozen = String(report.status || '').toUpperCase() === 'APPROVED';
  if (report.unit_id && !isFrozen && !surveyJson.standardizedAddress && report.parcel_id) {
    const standardizedAddress = await fetchMasterStandardizedAddress(String(report.parcel_id));
    if (standardizedAddress) {
      next.survey_data_json = { ...(next.survey_data_json ?? surveyJson), standardizedAddress };
    }
  }
  return next as T;
}
