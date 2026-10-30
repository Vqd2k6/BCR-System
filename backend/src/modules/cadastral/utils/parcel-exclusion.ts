import { Database } from '../../../database/db';
import { BadRequestError } from '../../../common/errors/problem-details';

/**
 * Soft Exclusion thửa đất: dùng chung cho các luồng khảo sát, phân công và biến động địa chính.
 * So sánh bằng `lifecycle_status::text` để query không lỗi enum khi migration chưa chạy.
 */
export const EXCLUDED_LIFECYCLE_STATUSES = ['EXCLUDED_NON_BUILDING', 'EXCLUDED_TRAINING_DEMO'] as const;

export type ExcludedLifecycleStatus = (typeof EXCLUDED_LIFECYCLE_STATUSES)[number];

export type ParcelExclusionType = 'ROAD_TRAFFIC' | 'VACANT_LAND' | 'CLICK_MISTAKE' | 'TRAINING_DEMO' | 'DUPLICATE';

export const EXCLUSION_TYPE_TO_LIFECYCLE: Record<ParcelExclusionType, ExcludedLifecycleStatus> = {
  ROAD_TRAFFIC: 'EXCLUDED_NON_BUILDING',
  VACANT_LAND: 'EXCLUDED_NON_BUILDING',
  CLICK_MISTAKE: 'EXCLUDED_TRAINING_DEMO',
  TRAINING_DEMO: 'EXCLUDED_TRAINING_DEMO',
  DUPLICATE: 'EXCLUDED_TRAINING_DEMO',
};

/** Chỉ các trạng thái chưa nộp hồ sơ mới được phép loại trừ (whitelist, fail-safe). */
export const EXCLUDABLE_SURVEY_STATUSES = ['NOT_SURVEYED', 'ASSIGNED_TO_ME', 'IN_PROGRESS'] as const;

export const isExcludedLifecycle = (status: string | null | undefined): boolean =>
  (EXCLUDED_LIFECYCLE_STATUSES as readonly string[]).includes(status || '');

export const assertParcelNotExcluded = (parcel: {
  lifecycle_status?: string | null;
  project_parcel_code?: string | null;
}): void => {
  if (isExcludedLifecycle(parcel.lifecycle_status)) {
    throw new BadRequestError(
      `Thửa đất [${parcel.project_parcel_code}] đã bị loại trừ khỏi khảo sát. Vui lòng liên hệ Zone Admin để khôi phục trước khi thao tác.`
    );
  }
};

export const assertParcelsNotExcludedByIds = async (parcelIds: string[]): Promise<void> => {
  if (parcelIds.length === 0) return;
  const res = await Database.query<{ project_parcel_code: string }>(
    `SELECT project_parcel_code FROM parcels
     WHERE id = ANY($1::uuid[]) AND lifecycle_status::text = ANY($2::text[]);`,
    [parcelIds, [...EXCLUDED_LIFECYCLE_STATUSES]]
  );
  if (res.rows.length > 0) {
    const codes = res.rows.map((r) => r.project_parcel_code).join(', ');
    throw new BadRequestError(
      `Thửa đất [${codes}] đã bị loại trừ khỏi khảo sát. Vui lòng liên hệ Zone Admin để khôi phục trước khi thao tác.`
    );
  }
};
