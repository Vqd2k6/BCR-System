/**
 * Căn hộ vắng chủ chỉ có giá trị pháp lý ở phần luồng vắng thu thập được. Các hồ sơ cũ buộc KSV điền đủ form
 * thường nên phần nội thất và điểm số là dữ liệu điền cho qua, in ra sẽ thành kết luận "an toàn" cho căn chưa
 * từng vào được. Chỉ loại khỏi bản in/bản đóng băng; bản ghi gốc trong CSDL giữ nguyên.
 */
import { Database } from '../../../database/db';
import { fetchCondoUnitAbsenceMap, isUnknownOwnerName, isUnknownOwnerPhone } from '../../audit/condo/condo-absence.resolver';

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

/** Áp dụng ở điểm render chung vì hồ sơ vắng đã xác thực không có `APPROVED_RELEASE`, báo cáo đọc thẳng bảng live. */
export async function applyCondoReportContext<T extends Record<string, any>>(report: T): Promise<T> {
  if (!report?.unit_id) return report;

  const reportId = String(report.id);
  const absence = (await fetchCondoUnitAbsenceMap([reportId])).get(reportId);
  const isAbsent = absence?.state === 'ABSENT';
  const surveyJson = isJsonObject(report.survey_data_json) ? report.survey_data_json : {};
  const logsRes = await Database.query<Record<string, unknown>>(
    `SELECT * FROM survey_absence_logs WHERE unit_id = $1 ORDER BY recorded_at DESC;`,
    [report.unit_id]
  );
  const next: Record<string, any> = { ...report, absenceLogs: logsRes.rows };

  if (isAbsent) {
    next.condoUnitAbsent = true;
    next.survey_data_json = projectCondoAbsentSurveyJson(surveyJson);
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
  if (!isFrozen && !surveyJson.standardizedAddress && report.parcel_id) {
    const standardizedAddress = await fetchMasterStandardizedAddress(String(report.parcel_id));
    if (standardizedAddress) {
      next.survey_data_json = { ...(next.survey_data_json ?? surveyJson), standardizedAddress };
    }
  }
  return next as T;
}
