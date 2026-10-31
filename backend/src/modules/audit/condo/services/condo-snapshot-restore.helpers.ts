import type { PoolClient } from 'pg';
import { ConflictError } from '../../../../common/errors/problem-details';
import { isJsonRecord, syncSurveyScopeInTx } from '../../services/audit-sql-sync.helpers';
import { readCondoElementsFromJson, readCondoZonesFromJson } from '../strategies/condo-entity-strategy.interface';

type JsonRecord = Record<string, unknown>;

export interface NormalizedCondoSnapshot {
  raw: JsonRecord;
  surveyJson: JsonRecord;
  leftPane: JsonRecord;
  unitInfo: JsonRecord;
  zones: JsonRecord[];
  elements: JsonRecord[];
  /** Bản chụp chỉ có JSON khảo sát (VD: `UNIT_CAD_SPATIAL_SWAP`): các bảng SQL khác được giữ nguyên. */
  isJsonOnly: boolean;
}

const asRecord = (val: unknown): JsonRecord => (isJsonRecord(val) ? val : {});
const asRecordArray = (val: unknown): JsonRecord[] => (Array.isArray(val) ? val.filter(isJsonRecord) : []);

/**
 * Chuẩn hóa mọi dạng bản chụp về một cấu trúc:
 * - Bản đầy đủ từ audit view: có `surveyJson` / `survey_data_json` / `frozenSurveyDataJson` và `leftPane`.
 * - Bản thô: bản ghi `UNIT_CAD_SPATIAL_SWAP` và các `ROLLBACK_RESTORE` sao từ nó chính là JSON khảo sát.
 */
export function normalizeCondoSnapshot(snapshot: JsonRecord): NormalizedCondoSnapshot {
  const wrapped = [snapshot.surveyJson, snapshot.survey_data_json, snapshot.frozenSurveyDataJson].find(
    (candidate) => isJsonRecord(candidate) && Object.keys(candidate).length > 0
  ) as JsonRecord | undefined;
  const leftPane = asRecord(snapshot.leftPane);
  const hasLeftPane = Object.keys(leftPane).length > 0;
  const isJsonOnly = !wrapped && !hasLeftPane && Object.keys(snapshot).length > 0;
  const surveyJson = wrapped || (isJsonOnly ? snapshot : {});

  const jsonZones = readCondoZonesFromJson(surveyJson);
  const jsonElements = readCondoElementsFromJson(surveyJson);

  return {
    raw: snapshot,
    surveyJson,
    leftPane,
    unitInfo: asRecord(snapshot.unitInfo),
    zones: jsonZones.length > 0 ? jsonZones : asRecordArray(leftPane.damageZones),
    elements: jsonElements.length > 0 ? jsonElements : asRecordArray(leftPane.structuralElements),
    isJsonOnly,
  };
}

export function assertCondoSnapshotRestorable(snapshot: NormalizedCondoSnapshot): void {
  const hasZoneData = snapshot.zones.length > 0 || snapshot.elements.length > 0;
  if (Object.keys(snapshot.surveyJson).length === 0 && !hasZoneData) {
    throw new ConflictError(
      'Bản chụp lịch sử này không chứa dữ liệu khảo sát. Từ chối khôi phục để bảo vệ dữ liệu hiện tại.'
    );
  }
}

export function countActiveZoneItems(snapshot: NormalizedCondoSnapshot): number {
  return [...snapshot.zones, ...snapshot.elements].filter((item) => !item.isDeleted && !item.is_deleted).length;
}

const SPEC_COLUMNS = [
  'building_name', 'building_grade', 'adjacent_buildings', 'structural_system', 'floor_count', 'basement_count',
  'foundation_category', 'roof_type', 'wall_type', 'year_of_construction', 'is_year_estimated', 'construction_area_m2',
  'building_height_m', 'foundation_source', 'foundation_depth_m', 'foundation_density', 'foundation_spacing_m',
  'foundation_notes', 'land_use_function', 'as_built_drawing_photos_json', 'foundation_cat_score', 'pile_dimensions_text',
  'as_built_files_json', 'management_contact_json', 'total_floor_area_m2',
] as const;

// Cột phase2_*, delta_* do đợt khảo sát sau ghi, không thuộc phiên bản thẩm định Phase 1
const DEFORMATION_COLUMNS = [
  'tilt_angle_x', 'tilt_angle_y', 'tilt_direction', 'floor_slope_ratio', 'beam_deflection_mm', 'measurement_method',
  'measurement_reliability', 'e3_deformation_score', 'diff_settlement_photo_code', 'tilt_photo_code', 'abnormal_photo_code',
  'diff_settlement_photos_json', 'tilt_photos_json', 'abnormal_photos_json', 'notes', 'beam_sagging_photo_code',
  'beam_sagging_photos_json', 'monitoring_required', 'monitoring_notes', 'details_json',
] as const;

const HISTORY_COLUMNS = [
  'extended_or_renovated', 'previous_settlement_or_tilt', 'fire_or_accident', 'sensitive_equipment_present', 'details',
  'e5_history_score',
] as const;

const RISK_CARD_COLUMNS = [
  'e1_burland_score', 'e2_structure_score', 'e3_deformation_score', 'e4_material_score', 'e5_history_score',
  'e6_overall_function_score', 'total_ecs_score', 'ecs_class', 'v1_importance_score', 'v2_structure_score',
  'v3_foundation_score', 'v4_age_score', 'v5_ecs_score', 'v6_sensitivity_score', 'avg_vi_score', 'vi_class',
  'construction_impact_level_i', 'building_risk_assessment_bra', 'is_engineering_judgement_applied',
  'engineering_judgement_action', 'engineering_judgement_reason', 'overridden_burland_grade', 'overridden_total_ecs',
  'overridden_ecs_class', 'overridden_importance_score', 'overridden_avg_vi', 'overridden_vi_class',
  'overridden_impact_level_i', 'overridden_bra', 'judgement_engineer_name', 'judgement_applied_at',
] as const;

type RestorableTable =
  | 'building_specifications'
  | 'deformation_assessments'
  | 'historical_sensitivities'
  | 'risk_score_cards';

/** jsonb và mảng phải qua JSON.stringify, nếu không driver `pg` đổi mảng JS thành kiểu mảng Postgres. */
function toSqlValue(val: unknown): unknown {
  return typeof val === 'object' && val !== null && !(val instanceof Date) ? JSON.stringify(val) : val;
}

/**
 * Khôi phục nguyên một hàng SQL từ `leftPane`, gồm cả giá trị null đã từng được xóa.
 * Tên bảng và cột là hằng số trong file này, giá trị luôn đi qua tham số. Bảng vắng trong bản chụp thì giữ nguyên.
 */
async function restoreRowInTx(
  client: PoolClient,
  table: RestorableTable,
  reportId: string,
  row: unknown,
  columns: readonly string[]
): Promise<void> {
  if (!isJsonRecord(row)) return;
  const present = columns.filter((column) => column in row);
  if (present.length === 0) return;

  const placeholders = present.map((_, idx) => `$${idx + 2}`).join(', ');
  const assignments = present.map((column) => `${column} = EXCLUDED.${column}`).join(', ');
  await client.query(
    `INSERT INTO ${table} (report_id, ${present.join(', ')}) VALUES ($1, ${placeholders})
     ON CONFLICT (report_id) DO UPDATE SET ${assignments};`,
    [reportId, ...present.map((column) => toSqlValue(row[column]))]
  );
}

async function restoreIdentificationPhotosInTx(client: PoolClient, reportId: string, rows: unknown): Promise<void> {
  for (const row of asRecordArray(rows)) {
    if (!row.photo_type) continue;
    await client.query(
      `UPDATE survey_identification_photos SET
         raw_photo_url = $1, annotated_photo_url = $2, photo_code = $3, is_not_applicable = $4, na_reason = $5
       WHERE report_id = $6 AND photo_type::text = $7;`,
      [
        row.raw_photo_url ?? null,
        row.annotated_photo_url ?? null,
        row.photo_code ?? null,
        Boolean(row.is_not_applicable),
        row.na_reason ?? null,
        reportId,
        String(row.photo_type),
      ]
    );
  }
}

/** Khôi phục các bảng con của báo cáo. Riêng `building_specifications` tùy thực thể: Khu vực chung không có. */
export async function restoreCondoChildTablesInTx(
  client: PoolClient,
  reportId: string,
  snapshot: NormalizedCondoSnapshot,
  restoredJson: JsonRecord,
  options: { includeSpecs: boolean }
): Promise<void> {
  if (snapshot.isJsonOnly) return;
  const { leftPane } = snapshot;

  if (options.includeSpecs) {
    await restoreRowInTx(client, 'building_specifications', reportId, leftPane.buildingSpecs, SPEC_COLUMNS);
  }
  await restoreRowInTx(client, 'deformation_assessments', reportId, leftPane.deformation, DEFORMATION_COLUMNS);
  await restoreRowInTx(client, 'historical_sensitivities', reportId, leftPane.interview, HISTORY_COLUMNS);
  await restoreRowInTx(client, 'risk_score_cards', reportId, leftPane.riskScoreCard, RISK_CARD_COLUMNS);
  await restoreIdentificationPhotosInTx(client, reportId, leftPane.identPhotos);

  if (restoredJson.accessLimitation !== undefined || restoredJson.surveyScope !== undefined) {
    await syncSurveyScopeInTx(client, reportId, restoredJson);
  }
}

function firstPresent(...candidates: unknown[]): { isPresent: boolean; value: unknown } {
  return {
    isPresent: candidates.some((candidate) => candidate !== undefined),
    value: candidates.find(Boolean) ?? null,
  };
}

/** Khôi phục JSON và các cột văn bản của báo cáo; bản chụp không có khóa thì giữ cột hiện tại. */
export async function restoreCondoReportFieldsInTx(
  client: PoolClient,
  reportId: string,
  snapshot: NormalizedCondoSnapshot,
  restoredJson: JsonRecord
): Promise<void> {
  const { raw, surveyJson } = snapshot;
  const signatures = asRecord(surveyJson.signatures);
  const executive = asRecord(surveyJson.executiveSummary);

  const summary = firstPresent(raw.summaryConclusions, surveyJson.summaryConclusions, executive.summaryConclusions);
  const recommendations = firstPresent(
    raw.engineeringRecommendations,
    surveyJson.engineeringRecommendations,
    executive.specificRecommendationsText
  );
  const remarks = firstPresent(raw.ownerRemarks, surveyJson.ownerFeedback, surveyJson.ownerRemarks, signatures.ownerFeedback);

  await client.query(
    `UPDATE base_survey_reports SET
       survey_data_json = $1,
       surveyor_signature_url = COALESCE($2, surveyor_signature_url),
       owner_signature_url = COALESCE($3, owner_signature_url),
       summary_conclusions = CASE WHEN $7::boolean THEN $4::text ELSE summary_conclusions END,
       engineering_recommendations = CASE WHEN $8::boolean THEN $5::text ELSE engineering_recommendations END,
       owner_remarks = CASE WHEN $9::boolean THEN $6::text ELSE owner_remarks END,
       status = 'UNDER_REVIEW',
       updated_at = NOW()
     WHERE id = $10;`,
    [
      JSON.stringify(restoredJson),
      raw.surveyorSignatureUrl || surveyJson.surveyorSignature || signatures.surveyorSignature || signatures.surveyorSignatureUrl || null,
      raw.ownerSignatureUrl || surveyJson.ownerSignature || signatures.ownerSignature || signatures.ownerSignatureUrl || null,
      summary.value,
      recommendations.value,
      remarks.value,
      summary.isPresent,
      recommendations.isPresent,
      remarks.isPresent,
      reportId,
    ]
  );
}

/** Các khóa vị trí CAD: khi có hoán đổi sau phiên bản đích, chúng phải giữ theo hiện tại. */
const CAD_POSITION_JSON_KEYS = ['floorNumber', 'cadBbox', 'cadPolygon', 'isCadLocked', 'isCadOverriddenByUser', 'floorSurvey'] as const;

export function keepCurrentCadPosition(restoredJson: JsonRecord, currentJson: JsonRecord): void {
  for (const key of CAD_POSITION_JSON_KEYS) {
    if (currentJson[key] !== undefined) restoredJson[key] = currentJson[key];
  }
  const currentArea = asRecord(currentJson.areaInfo);
  if (Object.keys(currentArea).length > 0) {
    restoredJson.areaInfo = {
      ...asRecord(restoredJson.areaInfo),
      floorNumber: currentArea.floorNumber,
      cadBoundingBox: currentArea.cadBoundingBox,
      croppedCadUrl: currentArea.croppedCadUrl,
    };
  }
}

/**
 * Khôi phục `building_units`. Hoán đổi CAD tác động lên hai căn cùng lúc, nên khi có hoán đổi sau phiên bản đích
 * thì vị trí được giữ nguyên, nếu không căn này sẽ đè lên căn còn lại.
 */
export async function restoreCondoBuildingUnitInTx(
  client: PoolClient,
  unitId: string,
  parcelId: string,
  snapshot: NormalizedCondoSnapshot,
  restoredJson: JsonRecord,
  options: { restoreCadPosition: boolean }
): Promise<void> {
  const unitInfo = snapshot.unitInfo;
  const hasFullUnitRow = !snapshot.isJsonOnly && 'unit_code' in unitInfo;

  if (!hasFullUnitRow) {
    await client.query(
      `UPDATE building_units SET
         owner_name = COALESCE($1, owner_name),
         owner_phone = COALESCE($2, owner_phone),
         owner_id_card = COALESCE($3, owner_id_card),
         resident_status = COALESCE($4, resident_status),
         display_code = COALESCE($5, display_code),
         status = 'SUBMITTED',
         updated_at = NOW()
       WHERE id = $6;`,
      [
        restoredJson.ownerName ?? null,
        restoredJson.ownerPhone ?? null,
        restoredJson.ownerIdCard ?? null,
        restoredJson.residentStatus ?? null,
        restoredJson.displayCode ?? null,
        unitId,
      ]
    );
    return;
  }

  const unitCode = String(unitInfo.unit_code);
  const duplicateRes = await client.query<{ id: string }>(
    `SELECT id FROM building_units WHERE parcel_id = $1 AND unit_code = $2 AND id <> $3 AND deleted_at IS NULL LIMIT 1;`,
    [parcelId, unitCode, unitId]
  );
  if (duplicateRes.rows[0]) {
    throw new ConflictError(`Không thể khôi phục: mã phòng ${unitCode} hiện đã được căn khác trong tòa sử dụng.`);
  }

  await client.query(
    `UPDATE building_units SET
       unit_code = $1,
       display_code = $2,
       owner_name = $3,
       owner_phone = $4,
       owner_id_card = $5,
       resident_status = $6,
       floor_number = CASE WHEN $11::boolean THEN $7::numeric ELSE floor_number END,
       floor_plan_id = CASE WHEN $11::boolean THEN $8::uuid ELSE floor_plan_id END,
       cad_bbox = CASE WHEN $11::boolean THEN $9::jsonb ELSE cad_bbox END,
       cad_polygon = CASE WHEN $11::boolean THEN $10::jsonb ELSE cad_polygon END,
       status = 'SUBMITTED',
       updated_at = NOW()
     WHERE id = $12;`,
    [
      unitCode,
      unitInfo.display_code ?? null,
      unitInfo.owner_name ?? null,
      unitInfo.owner_phone ?? null,
      unitInfo.owner_id_card ?? null,
      unitInfo.resident_status ?? null,
      unitInfo.floor_number ?? null,
      unitInfo.floor_plan_id ?? null,
      unitInfo.cad_bbox ? JSON.stringify(unitInfo.cad_bbox) : null,
      unitInfo.cad_polygon ? JSON.stringify(unitInfo.cad_polygon) : null,
      options.restoreCadPosition,
      unitId,
    ]
  );
}
