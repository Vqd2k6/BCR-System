import type { PoolClient } from 'pg';
import { ConflictError } from '../../../../common/errors/problem-details';
import { isJsonRecord } from '../../services/audit-sql-sync.helpers';

type JsonRecord = Record<string, unknown>;

/** Đổi mã phòng. Index `idx_building_units_parcel_code_active` chặn trùng, kiểm tra trước để trả lỗi rõ nghĩa. */
export async function renameCondoUnitCodeInTx(
  client: PoolClient,
  unitId: string,
  parcelId: string,
  nextCode: string
): Promise<void> {
  const duplicateRes = await client.query<{ id: string }>(
    `SELECT id FROM building_units WHERE parcel_id = $1 AND unit_code = $2 AND id <> $3 AND deleted_at IS NULL LIMIT 1;`,
    [parcelId, nextCode, unitId]
  );
  if (duplicateRes.rows[0]) {
    throw new ConflictError(`Mã phòng ${nextCode} đã tồn tại trong tòa nhà này.`);
  }
  await client.query(`UPDATE building_units SET unit_code = $1, updated_at = NOW() WHERE id = $2;`, [nextCode, unitId]);
}

/**
 * Chuyển tầng: mặt bằng cũ không còn đúng nên phân giải lại `floor_plan_id` và bỏ vị trí CAD;
 * Admin đặt lại vị trí trong CAD Studio. Toàn bộ khóa tầng trong JSON và `floor_surveys` đi cùng để không lệch.
 */
export async function moveCondoUnitFloorInTx(
  client: PoolClient,
  unitId: string,
  parcelId: string,
  reportId: string,
  nextFloor: number,
  displayLabel: string,
  mergedJson: JsonRecord,
  isMasterArea: boolean
): Promise<void> {
  const plansRes = await client.query<{ id: string; floor_number: string | number | null; applicable_floors: unknown }>(
    `SELECT id, floor_number, applicable_floors FROM building_floor_plans WHERE parcel_id = $1 AND deleted_at IS NULL;`,
    [parcelId]
  );
  const directPlan = plansRes.rows.find((plan) => Number(plan.floor_number) === nextFloor);
  const sharedPlan = plansRes.rows.find(
    (plan) => Array.isArray(plan.applicable_floors) && plan.applicable_floors.map(Number).includes(nextFloor)
  );

  await client.query(
    `UPDATE building_units SET
       floor_number = $1, floor_plan_id = $2, cad_bbox = NULL, cad_polygon = NULL, updated_at = NOW()
     WHERE id = $3;`,
    [nextFloor, directPlan?.id ?? sharedPlan?.id ?? null, unitId]
  );

  await client.query(
    `UPDATE floor_surveys
     SET floor_order = $1, floor_name = CASE WHEN $2::boolean THEN floor_name ELSE $3 END
     WHERE report_id = $4;`,
    [nextFloor, isMasterArea, `Căn hộ ${displayLabel} (Tầng ${nextFloor})`, reportId]
  );

  mergedJson.floorNumber = nextFloor;
  mergedJson.cadBbox = null;
  mergedJson.cadPolygon = null;
  mergedJson.isCadLocked = false;
  if (isJsonRecord(mergedJson.floorSurvey)) {
    mergedJson.floorSurvey = { ...mergedJson.floorSurvey, floorOrder: nextFloor, isCadLocked: false };
  }
  if (Array.isArray(mergedJson.floors)) {
    mergedJson.floors = mergedJson.floors.map((floor: unknown, idx: number) =>
      idx === 0 && isJsonRecord(floor) ? { ...floor, floorOrder: nextFloor, isCadLocked: false } : floor
    );
  }
}
