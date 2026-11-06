import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { Database } from '../../database/db';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../common/errors/problem-details';
import { CadastralService } from './cadastral.service';
import { applyLifecycleChange, LIFECYCLE_ROW_COLUMNS } from './services/parcel-lifecycle.service';
import type { LifecycleParcelRow } from './services/parcel-lifecycle.service';
import {
  getZoneSuggestedStreets,
  isCompositeStreetText,
  isStreetContaminatedWithWard,
  parseSurveyorAddress,
  standardizeStreet,
  standardizeWard,
} from '../audit/utils/residential-address.standards';
import { resolveLocalRepresentative } from '../report/mappers/appendices/local-authority.rules';
import type {
  BatchExcludeInput,
  BatchLocalAuthorityInput,
  BatchRestoreInput,
  BatchSyncAddressInput,
} from './cadastral-batch.dto';

/**
 * TÁC VỤ HÀNG LOẠT TRÊN BẢN ĐỒ GIS (Zone Admin / Super Admin)
 * - Chỉ ghi bảng `parcels`, KHÔNG ghi survey_data_json của KSV (hồ sơ là căn cứ pháp lý).
 * - Mỗi lô 1 transaction, khóa FOR UPDATE theo thứ tự id; lỗi giữa chừng -> ROLLBACK cả lô.
 * - Thửa ngoài phạm vi Zone -> 403 cả lô. Thửa không đủ điều kiện -> `skipped` kèm lý do.
 * - Mỗi thửa thay đổi có 1 dòng system_audit_logs (before/after + batchId) để rollback thủ công.
 */

export type BatchUser = { userId: string; role: string; assignedZoneId?: string | null } | undefined;

/** Phân khu đã có quy tắc chuẩn hóa địa chỉ được kiểm chứng với dữ liệu KSV (Zone 9 chốt sẵn; Zone 3, 7 rút từ dữ liệu 06/11/2026). */
export const ADDRESS_BATCH_ZONES = ['ZONE_03', 'ZONE_07', 'ZONE_09'] as const;

export interface BatchResultItem {
  parcelId: string;
  projectParcelCode: string;
}
export interface BatchSkippedItem extends BatchResultItem {
  reason: string;
}
export interface BatchResult {
  batchId: string;
  updated: BatchResultItem[];
  skipped: BatchSkippedItem[];
}

interface BatchParcelRow extends LifecycleParcelRow {
  zone_id: string | null;
  house_number: string | null;
  street: string | null;
  ward: string | null;
  district: string | null;
  local_authority_name: string | null;
  local_authority_role: string | null;
  local_authority_phone: string | null;
}

const BATCH_ROW_COLUMNS = `${LIFECYCLE_ROW_COLUMNS}, zone_id, house_number, street, ward, district,
  local_authority_name, local_authority_role, local_authority_phone`;

// ---------------------------------------------------------------------------
// KHÓA, PHÂN QUYỀN, TRẠNG THÁI KHÓA PHÁP LÝ
// ---------------------------------------------------------------------------

function assertAdmin(user: BatchUser): asserts user is NonNullable<BatchUser> {
  if (!user) throw new UnauthorizedError('Yêu cầu xác thực tài khoản để thực hiện thao tác quản trị');
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ZONE_ADMIN') {
    throw new ForbiddenError('Chỉ Zone Admin hoặc Super Admin mới có quyền thực hiện tác vụ hàng loạt.');
  }
}

function assertZoneScope(user: NonNullable<BatchUser>, rows: Array<{ zone_id: string | null; project_parcel_code: string }>): void {
  if (user.role === 'SUPER_ADMIN') return;
  const outside = rows.filter((r) => !CadastralService.isZoneMatchOrAllPrivilege(user.assignedZoneId, r.zone_id));
  if (outside.length > 0) {
    throw new ForbiddenError(
      `Từ chối thao tác hàng loạt: các thửa [${outside.map((r) => r.project_parcel_code).join(', ')}] không thuộc phân khu [${user.assignedZoneId}] bạn quản lý.`
    );
  }
}

async function lockAndAuthorize(client: PoolClient, ids: string[], user: NonNullable<BatchUser>): Promise<BatchParcelRow[]> {
  const res = await client.query<BatchParcelRow>(
    `SELECT ${BATCH_ROW_COLUMNS} FROM parcels WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE;`,
    [ids]
  );
  const found = new Set(res.rows.map((r) => r.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new NotFoundError(`Không tìm thấy ${missing.length} thửa đất: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
  }
  assertZoneScope(user, res.rows);
  return res.rows;
}

/** Thửa có hồ sơ đã duyệt / đã khóa pháp lý: chỉ Super Admin trả hồ sơ về rồi mới được sửa. */
async function loadLockedReasons(client: PoolClient, ids: string[]): Promise<Map<string, string>> {
  const res = await client.query<{ id: string; is_locked: boolean; approved: boolean }>(
    `SELECT p.id, p.is_locked,
            (p.survey_status::text = 'APPROVED'
             OR EXISTS (SELECT 1 FROM base_survey_reports r
                        WHERE r.parcel_id = p.id AND r.deleted_at IS NULL AND r.status::text = 'APPROVED')
             OR EXISTS (SELECT 1 FROM building_units u
                        WHERE u.parcel_id = p.id AND u.deleted_at IS NULL
                          AND u.status::text = ANY($2::text[]))) AS approved
     FROM parcels p WHERE p.id = ANY($1::uuid[]);`,
    [ids, ['APPROVED', 'APPROVED_PHASE2', 'PHASE2_COMPLETED']]
  );
  const map = new Map<string, string>();
  for (const r of res.rows) {
    if (r.approved) map.set(r.id, 'Hồ sơ đã duyệt, cần Super Admin trả hồ sơ về trước khi sửa');
    else if (r.is_locked) map.set(r.id, 'Thửa đất đã bị khóa pháp lý');
  }
  return map;
}

const nonActiveReason = (row: BatchParcelRow): string | null =>
  row.lifecycle_status === 'ACTIVE' ? null : `Thửa đất đang ở trạng thái ${row.lifecycle_status}, chỉ thửa ACTIVE mới được cập nhật`;

const insertParcelLog = (
  client: PoolClient,
  parcelId: string,
  action: string,
  userId: string,
  clientIp: string | null,
  payload: Record<string, unknown>
) =>
  client.query(
    `INSERT INTO system_audit_logs (entity_type, entity_id, action, performed_by_user_id, client_ip, diff_payload)
     VALUES ('PARCEL', $1, $2, $3, $4, $5);`,
    [parcelId, action, userId, clientIp, JSON.stringify(payload)]
  );

// ---------------------------------------------------------------------------
// ĐỀ XUẤT ĐỊA CHỈ (thuần, dùng chung cho preview, sync và script đo coverage)
// ---------------------------------------------------------------------------

export interface AddressFields {
  houseNumber: string;
  street: string;
  ward: string;
  district: string;
}
export type AddressFieldSource = 'SURVEYOR' | 'CADASTRAL' | 'MANUAL';

export interface AddressSuggestionInput {
  zoneId: string | null;
  parcelRaw: AddressFields;
  surveyorEntered: AddressFields | null;
}

export interface AddressSuggestion {
  suggested: AddressFields;
  sourceByField: Record<keyof AddressFields, AddressFieldSource>;
  khuPho: string;
  anomalyReasons: string[];
  requiresManualStreet: boolean;
  requiresManualHouseNumber: boolean;
  /** Chưa có hồ sơ KSV và ô đường đang nhiễm: giữ nguyên ô đường, chỉ cập nhật các trường khác */
  streetKeptAsIs: boolean;
  wardConflict: { cadastralWard: string; surveyorWard: string } | null;
  isSplitWard: boolean;
  splitWardCandidates: string[];
  suggestedStreetOptions: string[];
  diffCount: number;
}

const clean = (v: string | null | undefined): string => (typeof v === 'string' ? v.trim() : '');

export function buildAddressSuggestion(input: AddressSuggestionInput): AddressSuggestion {
  const raw = input.parcelRaw;
  const sv = input.surveyorEntered;
  const hasSurveyorText = Boolean(sv && (sv.houseNumber || sv.street || sv.ward));
  const parsed = hasSurveyorText && sv ? parseSurveyorAddress(sv.houseNumber, sv.street, sv.ward) : null;
  const reasons: string[] = [];
  const source: Record<keyof AddressFields, AddressFieldSource> = {
    houseNumber: 'CADASTRAL',
    street: 'CADASTRAL',
    ward: 'CADASTRAL',
    district: 'CADASTRAL',
  };

  // --- PHƯỜNG / QUẬN: quy đổi phường địa chính theo đúng quận, đối chiếu với phường KSV ghi ---
  const cadastral = standardizeWard(raw.ward, raw.district);
  let surveyorWard = parsed?.wardMention || '';
  if (!surveyorWard && sv?.ward) {
    const svWardRes = standardizeWard(sv.ward, raw.district);
    if (svWardRes.isMatched) surveyorWard = svWardRes.ward;
  }
  if (parsed?.hasMultipleWardMentions) reasons.push('KSV ghi nhiều phường khác nhau, không dùng để đối chiếu');

  let ward = cadastral.ward || raw.ward;
  let district = cadastral.district || raw.district;
  let isSplitWard = false;
  let wardConflict: AddressSuggestion['wardConflict'] = null;

  if (cadastral.isSplitWard) {
    if (surveyorWard && cadastral.splitCandidates.includes(surveyorWard)) {
      ward = surveyorWard;
      district = standardizeWard(surveyorWard).district || district;
      source.ward = 'SURVEYOR';
      reasons.push(`${raw.ward} bị chia tách, KSV xác nhận thuộc ${surveyorWard}`);
    } else {
      isSplitWard = true;
      ward = raw.ward;
      source.ward = 'MANUAL';
      reasons.push(`${raw.ward} (${raw.district}) bị chia tách: ${cadastral.splitCandidates.join(' / ')}, cần chọn thủ công`);
    }
  } else if (surveyorWard && surveyorWard !== ward) {
    wardConflict = { cadastralWard: ward, surveyorWard };
    source.ward = 'MANUAL';
    reasons.push(`Bản đồ địa chính: ${ward}, KSV ghi: ${surveyorWard}. Cần xác định thủ công`);
  } else if (cadastral.isMatched && raw.ward !== ward) {
    reasons.push(`${raw.ward} -> ${ward} (${cadastral.mergerNote ?? 'NQ 1685'})`);
  }

  // --- TÊN ĐƯỜNG: ưu tiên tên đường KSV ghi (ô đường hoặc ô số nhà), không bao giờ đoán theo phân khu ---
  let street = '';
  let requiresManualStreet = false;
  let streetKeptAsIs = false;
  const rawContaminated = isStreetContaminatedWithWard(raw.street) || !raw.street;
  if (parsed?.street) {
    street = parsed.street;
    source.street = 'SURVEYOR';
    if (raw.street !== street) reasons.push(`Tên đường lấy từ dữ liệu KSV: ${street}`);
  } else if (!rawContaminated) {
    const fromRaw = isCompositeStreetText(raw.street) ? parseSurveyorAddress('', raw.street).street : '';
    street = fromRaw || standardizeStreet(raw.street).street;
  } else if (hasSurveyorText) {
    requiresManualStreet = true;
    source.street = 'MANUAL';
    reasons.push(
      parsed?.hasMultipleStreets
        ? 'KSV ghi nhiều tên đường khác nhau, cần nhập tay'
        : `Ô đường '${raw.street}' là tên phường và KSV không ghi tên đường, cần nhập tay`
    );
  } else {
    street = raw.street;
    streetKeptAsIs = true;
    reasons.push(`Chưa có hồ sơ KSV: giữ nguyên ô đường '${raw.street}', có thể nhập tay`);
  }

  // --- SỐ NHÀ: ưu tiên số nhà KSV ghi. Nhiều số / ghi chú (VD "461 BIS -463/18...", "546-548"):
  //     nếu giống số nhà đang lưu thì giữ nguyên (không đổi gì nên không cần quyết định);
  //     nếu khác thì để người dùng quyết định, không tự tách.
  let houseNumber = raw.houseNumber;
  let requiresManualHouseNumber = false;
  const candidateHn = sv?.houseNumber ? sv.houseNumber : raw.houseNumber;
  if (candidateHn) {
    const hnParsed = sv?.houseNumber && parsed ? parsed : parseSurveyorAddress(candidateHn, '');
    const fromSurveyor = Boolean(sv?.houseNumber);
    if (hnParsed.requiresManualHouseNumber) {
      if (candidateHn === raw.houseNumber) {
        reasons.push(`Số nhà '${raw.houseNumber}' có nhiều số hoặc ghi chú, giữ nguyên`);
      } else {
        requiresManualHouseNumber = true;
        source.houseNumber = 'MANUAL';
        reasons.push(`Số nhà KSV ghi '${candidateHn}' có nhiều số hoặc ghi chú, cần xác định thủ công`);
      }
    } else if (hnParsed.houseNumber) {
      houseNumber = hnParsed.houseNumber;
      if (fromSurveyor) source.houseNumber = 'SURVEYOR';
    }
  }

  const suggested: AddressFields = { houseNumber, street, ward, district };
  const diffCount = (Object.keys(suggested) as Array<keyof AddressFields>).filter((k) => suggested[k] !== raw[k]).length;

  return {
    suggested,
    sourceByField: source,
    khuPho: parsed?.khuPho || '',
    anomalyReasons: reasons,
    requiresManualStreet,
    requiresManualHouseNumber,
    streetKeptAsIs,
    wardConflict,
    isSplitWard,
    splitWardCandidates: isSplitWard ? cadastral.splitCandidates : [],
    suggestedStreetOptions: getZoneSuggestedStreets(input.zoneId),
    diffCount,
  };
}

export interface AddressPreviewRow extends AddressSuggestion {
  parcelId: string;
  projectParcelCode: string;
  zoneId: string | null;
  parcelRaw: AddressFields;
  surveyorEntered: AddressFields | null;
  lockedReason: string | null;
  /** Mặc định được tích trên giao diện */
  autoSelectable: boolean;
}

interface PreviewDbRow {
  id: string;
  project_parcel_code: string;
  zone_id: string | null;
  lifecycle_status: string;
  house_number: string | null;
  street: string | null;
  ward: string | null;
  district: string | null;
  has_report: boolean;
  sv_house_number: string | null;
  sv_street: string | null;
  sv_ward: string | null;
  sv_district: string | null;
}

/** Đọc địa chỉ gốc của thửa + địa chỉ KSV nhập ở hồ sơ mới nhất (cùng thứ tự chọn hồ sơ với zone-map). */
async function loadAddressPreviewRows(client: PoolClient, ids: string[]): Promise<AddressPreviewRow[]> {
  const res = await client.query<PreviewDbRow>(
    `SELECT p.id, p.project_parcel_code, p.zone_id, p.lifecycle_status::text AS lifecycle_status,
            p.house_number, p.street, p.ward, p.district,
            (r.survey_data_json IS NOT NULL) AS has_report,
            r.survey_data_json->>'houseNumber' AS sv_house_number,
            r.survey_data_json->>'street' AS sv_street,
            r.survey_data_json->>'ward' AS sv_ward,
            r.survey_data_json->>'district' AS sv_district
     FROM parcels p
     LEFT JOIN LATERAL (
       SELECT bsr.survey_data_json
       FROM base_survey_reports bsr
       WHERE bsr.parcel_id = p.id AND bsr.unit_id IS NULL AND bsr.deleted_at IS NULL
       ORDER BY (CASE WHEN bsr.id = p.active_phase1_report_id THEN 0 ELSE 1 END), bsr.updated_at DESC NULLS LAST, bsr.created_at DESC
       LIMIT 1
     ) r ON TRUE
     WHERE p.id = ANY($1::uuid[])
     ORDER BY p.project_parcel_code;`,
    [ids]
  );
  const locked = await loadLockedReasons(client, ids);

  return res.rows.map((row) => {
    const parcelRaw: AddressFields = {
      houseNumber: clean(row.house_number),
      street: clean(row.street),
      ward: clean(row.ward),
      district: clean(row.district),
    };
    const surveyorEntered: AddressFields | null = row.has_report
      ? {
          houseNumber: clean(row.sv_house_number),
          street: clean(row.sv_street),
          ward: clean(row.sv_ward),
          district: clean(row.sv_district),
        }
      : null;
    const suggestion = buildAddressSuggestion({ zoneId: row.zone_id, parcelRaw, surveyorEntered });
    const lockedReason =
      locked.get(row.id) ??
      (row.lifecycle_status === 'ACTIVE' ? null : `Thửa đất đang ở trạng thái ${row.lifecycle_status}`);
    const autoSelectable =
      !lockedReason &&
      suggestion.diffCount > 0 &&
      !suggestion.requiresManualStreet &&
      !suggestion.requiresManualHouseNumber &&
      !suggestion.wardConflict &&
      !suggestion.isSplitWard;
    return {
      ...suggestion,
      parcelId: row.id,
      projectParcelCode: row.project_parcel_code,
      zoneId: row.zone_id,
      parcelRaw,
      surveyorEntered,
      lockedReason,
      autoSelectable,
    };
  });
}

function assertAddressZones(rows: Array<{ zoneId: string | null; projectParcelCode: string }>): void {
  const outside = rows.filter((r) => !(ADDRESS_BATCH_ZONES as readonly string[]).includes((r.zoneId || '').toUpperCase()));
  if (outside.length > 0) {
    throw new BadRequestError(
      `Chuẩn hóa địa chỉ hàng loạt hiện chỉ áp dụng cho ${ADDRESS_BATCH_ZONES.join(', ')}. Các thửa ngoài phạm vi: ${outside
        .slice(0, 10)
        .map((r) => r.projectParcelCode)
        .join(', ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// SERVICE
// ---------------------------------------------------------------------------

export class CadastralBatchService {
  static async previewAddress(parcelIds: string[], user: BatchUser): Promise<AddressPreviewRow[]> {
    assertAdmin(user);
    return Database.transaction(async (client) => {
      const scope = await client.query<{ id: string; zone_id: string | null; project_parcel_code: string }>(
        `SELECT id, zone_id, project_parcel_code FROM parcels WHERE id = ANY($1::uuid[]);`,
        [parcelIds]
      );
      if (scope.rows.length !== parcelIds.length) {
        throw new NotFoundError(`Không tìm thấy ${parcelIds.length - scope.rows.length} thửa đất trong danh sách`);
      }
      assertZoneScope(user, scope.rows);
      const rows = await loadAddressPreviewRows(client, parcelIds);
      assertAddressZones(rows);
      return rows;
    });
  }

  static async syncAddress(input: BatchSyncAddressInput, user: BatchUser, clientIp: string | null): Promise<BatchResult> {
    assertAdmin(user);
    const batchId = randomUUID();
    const ids = input.items.map((i) => i.parcelId);

    return Database.transaction(async (client) => {
      await lockAndAuthorize(client, ids, user);
      const previews = new Map((await loadAddressPreviewRows(client, ids)).map((r) => [r.parcelId, r]));
      assertAddressZones(Array.from(previews.values()));

      const result: BatchResult = { batchId, updated: [], skipped: [] };
      for (const item of input.items) {
        const row = previews.get(item.parcelId);
        if (!row) continue;
        const ref = { parcelId: row.parcelId, projectParcelCode: row.projectParcelCode };
        const final: AddressFields = {
          houseNumber: item.houseNumber,
          street: item.street,
          ward: item.ward,
          district: item.district,
        };

        let skipReason: string | null = row.lockedReason;
        if (!skipReason && isStreetContaminatedWithWard(final.street) && final.street !== row.parcelRaw.street) {
          skipReason = `Tên đường '${final.street}' vẫn là tên phường`;
        }
        if (!skipReason && row.isSplitWard && final.ward === row.parcelRaw.ward) {
          skipReason = `Phường '${row.parcelRaw.ward}' bị chia tách, chưa chọn phường mới`;
        }
        if (!skipReason && (Object.keys(final) as Array<keyof AddressFields>).every((k) => final[k] === row.parcelRaw[k])) {
          skipReason = 'Không có thay đổi so với dữ liệu hiện tại';
        }
        if (skipReason) {
          result.skipped.push({ ...ref, reason: skipReason });
          continue;
        }

        await client.query(
          `UPDATE parcels
           SET house_number = $2, street = $3, ward = $4, district = $5, updated_at = NOW()
           WHERE id = $1;`,
          [row.parcelId, final.houseNumber || null, final.street, final.ward, final.district || null]
        );
        const editedByAdmin = (Object.keys(final) as Array<keyof AddressFields>).filter((k) => final[k] !== row.suggested[k]);
        await insertParcelLog(client, row.parcelId, 'PARCEL_ADDRESS_BATCH_UPDATED', user.userId, clientIp, {
          batchId,
          projectParcelCode: row.projectParcelCode,
          before: row.parcelRaw,
          surveyorEntered: row.surveyorEntered,
          suggested: row.suggested,
          sourceByField: row.sourceByField,
          final,
          editedByAdmin,
        });
        result.updated.push(ref);
      }
      return result;
    });
  }

  static async setLocalAuthority(input: BatchLocalAuthorityInput, user: BatchUser, clientIp: string | null): Promise<BatchResult> {
    assertAdmin(user);
    const batchId = randomUUID();

    return Database.transaction(async (client) => {
      const rows = await lockAndAuthorize(client, input.parcelIds, user);
      const locked = await loadLockedReasons(client, input.parcelIds);
      const after = { name: input.name, role: input.role, phone: input.phone };
      const result: BatchResult = { batchId, updated: [], skipped: [] };

      for (const row of rows) {
        const ref = { parcelId: row.id, projectParcelCode: row.project_parcel_code };
        const before = { name: row.local_authority_name, role: row.local_authority_role, phone: row.local_authority_phone };
        const skipReason =
          locked.get(row.id) ??
          nonActiveReason(row) ??
          (before.name === after.name && before.role === after.role && before.phone === after.phone
            ? 'Đại diện CQĐP không thay đổi'
            : null);
        if (skipReason) {
          result.skipped.push({ ...ref, reason: skipReason });
          continue;
        }
        await client.query(
          `UPDATE parcels
           SET local_authority_name = $2, local_authority_role = $3, local_authority_phone = $4, updated_at = NOW()
           WHERE id = $1;`,
          [row.id, after.name, after.role, after.phone]
        );
        await insertParcelLog(client, row.id, 'PARCEL_LOCAL_AUTHORITY_SET', user.userId, clientIp, {
          batchId,
          projectParcelCode: row.project_parcel_code,
          before,
          after,
        });
        result.updated.push(ref);
      }
      return result;
    });
  }

  static async exclude(input: BatchExcludeInput, user: BatchUser, clientIp: string | null): Promise<BatchResult> {
    return this.runLifecycle(
      input.parcelIds,
      { action: 'EXCLUDE', exclusionType: input.exclusionType, reason: input.reason },
      user,
      clientIp
    );
  }

  static async restore(input: BatchRestoreInput, user: BatchUser, clientIp: string | null): Promise<BatchResult> {
    return this.runLifecycle(input.parcelIds, { action: 'RESTORE', reason: input.reason }, user, clientIp);
  }

  private static async runLifecycle(
    parcelIds: string[],
    lifecycleInput: Parameters<typeof applyLifecycleChange>[2],
    user: BatchUser,
    clientIp: string | null
  ): Promise<BatchResult> {
    assertAdmin(user);
    const batchId = randomUUID();
    return Database.transaction(async (client) => {
      const rows = await lockAndAuthorize(client, parcelIds, user);
      const result: BatchResult = { batchId, updated: [], skipped: [] };
      for (const row of rows) {
        const ref = { parcelId: row.id, projectParcelCode: row.project_parcel_code };
        const outcome = await applyLifecycleChange(client, row, lifecycleInput, user.userId, clientIp, { batchId });
        if (outcome.ok) result.updated.push(ref);
        else result.skipped.push({ ...ref, reason: outcome.reason });
      }
      return result;
    });
  }

  /** Gợi ý đại diện CQĐP: giá trị đã gán trong Zone + quy tắc địa bàn sẵn có. Không hardcode tên mới. */
  static async listLocalAuthoritySuggestions(zoneId: string, user: BatchUser) {
    assertAdmin(user);
    if (user.role === 'ZONE_ADMIN' && !CadastralService.isZoneMatchOrAllPrivilege(user.assignedZoneId, zoneId)) {
      throw new ForbiddenError(`Bạn không có quyền xem dữ liệu phân khu [${zoneId}].`);
    }
    const assigned = await Database.query<{ name: string; role: string | null; phone: string | null; parcel_count: string }>(
      `SELECT local_authority_name AS name, local_authority_role AS role, local_authority_phone AS phone,
              COUNT(*)::text AS parcel_count
       FROM parcels
       WHERE zone_id = $1 AND local_authority_name IS NOT NULL AND lifecycle_status = 'ACTIVE'
       GROUP BY 1, 2, 3
       ORDER BY COUNT(*) DESC, 1;`,
      [zoneId]
    );
    const wards = await Database.query<{ ward: string | null; street: string | null; district: string | null }>(
      `SELECT DISTINCT ward, street, district FROM parcels WHERE zone_id = $1 AND lifecycle_status = 'ACTIVE';`,
      [zoneId]
    );
    const ruleNames = new Map<string, number>();
    for (const w of wards.rows) {
      const name = resolveLocalRepresentative(zoneId, w.ward, w.street, w.district);
      if (name) ruleNames.set(name, (ruleNames.get(name) ?? 0) + 1);
    }

    const seen = new Set(assigned.rows.map((r) => r.name));
    return [
      ...assigned.rows.map((r) => ({
        name: r.name,
        role: r.role,
        phone: r.phone,
        source: 'PARCEL' as const,
        parcelCount: Number(r.parcel_count),
      })),
      ...Array.from(ruleNames.keys())
        .filter((name) => !seen.has(name))
        .map((name) => ({ name, role: null, phone: null, source: 'RULE' as const, parcelCount: 0 })),
    ];
  }
}
