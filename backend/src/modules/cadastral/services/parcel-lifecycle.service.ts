import type { PoolClient } from 'pg';
import {
  EXCLUDABLE_SURVEY_STATUSES,
  EXCLUSION_TYPE_TO_LIFECYCLE,
  isExcludedLifecycle,
} from '../utils/parcel-exclusion';
import type { ParcelExclusionType } from '../utils/parcel-exclusion';

/**
 * Ẩn (Soft Exclusion) / Khôi phục MỘT thửa đất bên trong transaction của bên gọi.
 * Dùng chung cho luồng đơn lẻ (PATCH /parcels/:id/lifecycle) và luồng hàng loạt (POST /admin/parcels/batch/*):
 * cùng bộ chốt nghiệp vụ, cùng cách ghi system_audit_logs. Không throw khi thửa không đủ điều kiện,
 * trả { ok: false, reason } để luồng đơn lẻ throw 400 còn luồng hàng loạt gom vào danh sách bỏ qua.
 * Bên gọi phải SELECT ... FOR UPDATE dòng parcels trước khi gọi.
 */

export interface LifecycleParcelRow {
  id: string;
  project_parcel_code: string;
  lifecycle_status: string;
  survey_status: string;
  is_locked: boolean;
  exclusion_type: string | null;
  exclusion_reason: string | null;
}

export type LifecycleInput =
  | { action: 'EXCLUDE'; exclusionType: ParcelExclusionType; reason: string }
  | { action: 'RESTORE'; reason: string };

export type LifecycleOutcome = { ok: true; nextStatus: string } | { ok: false; reason: string };

export const LIFECYCLE_ROW_COLUMNS =
  'id, project_parcel_code, lifecycle_status::text AS lifecycle_status, survey_status::text AS survey_status, is_locked, exclusion_type, exclusion_reason';

export async function applyLifecycleChange(
  client: PoolClient,
  parcel: LifecycleParcelRow,
  input: LifecycleInput,
  userId: string,
  clientIp: string | null,
  extraLogFields: Record<string, unknown> = {}
): Promise<LifecycleOutcome> {
  const code = parcel.project_parcel_code;
  let nextStatus: string;

  if (input.action === 'RESTORE') {
    if (!isExcludedLifecycle(parcel.lifecycle_status)) {
      return {
        ok: false,
        reason: `Thửa đất [${code}] đang ở trạng thái ${parcel.lifecycle_status}, chỉ thửa đã loại trừ mới được khôi phục.`,
      };
    }
    nextStatus = 'ACTIVE';
    await client.query(
      `UPDATE parcels
       SET lifecycle_status = 'ACTIVE',
           exclusion_type = NULL,
           exclusion_reason = NULL,
           excluded_at = NULL,
           excluded_by_id = NULL,
           updated_at = NOW()
       WHERE id = $1;`,
      [parcel.id]
    );
  } else {
    if (parcel.lifecycle_status !== 'ACTIVE') {
      return {
        ok: false,
        reason: `Thửa đất [${code}] đang ở trạng thái ${parcel.lifecycle_status}, chỉ thửa ACTIVE mới được loại trừ.`,
      };
    }
    if (parcel.is_locked) {
      return { ok: false, reason: `Thửa đất [${code}] đã bị khóa pháp lý, không thể loại trừ.` };
    }
    if (!(EXCLUDABLE_SURVEY_STATUSES as readonly string[]).includes(parcel.survey_status)) {
      return {
        ok: false,
        reason: `Thửa đất [${code}] đã có hồ sơ ở trạng thái ${parcel.survey_status}, không thể loại trừ khỏi khảo sát.`,
      };
    }

    const lockedRecords = await client.query<{ source: string }>(
      `SELECT 'REPORT' AS source FROM base_survey_reports
         WHERE parcel_id = $1 AND deleted_at IS NULL
           AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED')
       UNION ALL
       SELECT 'UNIT' AS source FROM building_units
         WHERE parcel_id = $1 AND deleted_at IS NULL
           AND status IN ('SUBMITTED', 'APPROVED', 'APPROVED_PHASE2', 'PHASE2_COMPLETED')
       LIMIT 1;`,
      [parcel.id]
    );
    if (lockedRecords.rows.length > 0) {
      return {
        ok: false,
        reason: `Thửa đất [${code}] đã có hồ sơ khảo sát được nộp hoặc phê duyệt, không thể loại trừ khỏi khảo sát.`,
      };
    }

    nextStatus = EXCLUSION_TYPE_TO_LIFECYCLE[input.exclusionType];
    await client.query(
      `UPDATE parcels
       SET lifecycle_status = $2::parcel_lifecycle_enum,
           exclusion_type = $3,
           exclusion_reason = $4,
           excluded_at = NOW(),
           excluded_by_id = $5,
           updated_at = NOW()
       WHERE id = $1;`,
      [parcel.id, nextStatus, input.exclusionType, input.reason, userId]
    );
  }

  // Ghi trong cùng transaction: không có nhật ký thì không đổi trạng thái
  await client.query(
    `INSERT INTO system_audit_logs (entity_type, entity_id, action, performed_by_user_id, client_ip, diff_payload)
     VALUES ('PARCEL', $1, $2, $3, $4, $5);`,
    [
      parcel.id,
      input.action === 'EXCLUDE' ? 'PARCEL_EXCLUDED' : 'PARCEL_RESTORED',
      userId,
      clientIp,
      JSON.stringify({
        ...extraLogFields,
        projectParcelCode: code,
        fromStatus: parcel.lifecycle_status,
        toStatus: nextStatus,
        exclusionType: input.action === 'EXCLUDE' ? input.exclusionType : parcel.exclusion_type,
        previousExclusionReason: input.action === 'RESTORE' ? parcel.exclusion_reason : undefined,
        reason: input.reason,
      }),
    ]
  );

  return { ok: true, nextStatus };
}
