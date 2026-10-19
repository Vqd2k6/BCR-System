import type { PoolClient } from 'pg';
import { Database } from '../../database/db';
import { NotFoundError } from '../../common/errors/problem-details';
import {
  EMPTY_STANDARD_TEXT,
  StandardTextContentSchema,
  type EquipmentInput,
  type ReportContentConfig,
  type StandardTextContent,
  type StandardTextVersion,
  type SurveyEquipmentItem,
} from './report-config.types';

interface StandardTextRow {
  id: string;
  version_number: number;
  content_json: unknown;
  change_reason: string;
  created_by_user_id: string | null;
  created_by_name: string | null;
  created_at: Date;
}

interface EquipmentRow {
  id: string;
  sort_order: number;
  name_vi: string;
  name_en: string;
  specification_vi: string;
  specification_en: string;
  purpose_vi: string;
  purpose_en: string;
  model: string | null;
  serial_no: string | null;
  calibration_cert_no: string | null;
  calibration_valid_to: string | null;
}

const EQUIPMENT_COLUMNS = `id, sort_order, name_vi, name_en, specification_vi, specification_en, purpose_vi, purpose_en,
  model, serial_no, calibration_cert_no, to_char(calibration_valid_to, 'YYYY-MM-DD') AS calibration_valid_to`;

function parseContent(raw: unknown): StandardTextContent {
  const parsed = StandardTextContentSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[ReportConfig] content_json không hợp lệ, dùng cấu hình rỗng', parsed.error.issues);
    return EMPTY_STANDARD_TEXT;
  }
  return parsed.data;
}

function mapVersion(row: StandardTextRow): StandardTextVersion {
  return {
    id: row.id,
    versionNumber: row.version_number,
    content: parseContent(row.content_json),
    changeReason: row.change_reason,
    createdByUserId: row.created_by_user_id,
    createdByName: row.created_by_name,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapEquipment(row: EquipmentRow): SurveyEquipmentItem {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    nameVi: row.name_vi,
    nameEn: row.name_en,
    specificationVi: row.specification_vi,
    specificationEn: row.specification_en,
    purposeVi: row.purpose_vi,
    purposeEn: row.purpose_en,
    model: row.model,
    serialNo: row.serial_no,
    calibrationCertNo: row.calibration_cert_no,
    calibrationValidTo: row.calibration_valid_to,
  };
}

async function writeAudit(
  client: PoolClient,
  entityType: string,
  entityId: string,
  action: string,
  userId: string | null,
  payload: Record<string, unknown>
): Promise<void> {
  await client.query(
    `INSERT INTO system_audit_logs (entity_type, entity_id, action, performed_by_user_id, diff_payload)
     VALUES ($1, $2, $3, $4, $5);`,
    [entityType, entityId, action, userId, JSON.stringify({ ...payload, timestamp: new Date().toISOString() })]
  );
}

function isMissingTable(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '42P01';
}

export class ReportConfigService {
  static async listStandardTextVersions(): Promise<StandardTextVersion[]> {
    const res = await Database.query<StandardTextRow>(
      `SELECT v.id, v.version_number, v.content_json, v.change_reason, v.created_by_user_id,
              u.full_name AS created_by_name, v.created_at
         FROM report_standard_text_versions v
         LEFT JOIN users u ON u.id = v.created_by_user_id
        WHERE v.deleted_at IS NULL
        ORDER BY v.version_number DESC;`
    );
    return res.rows.map(mapVersion);
  }

  static async getStandardTextVersionById(id: string): Promise<StandardTextVersion | null> {
    const res = await Database.query<StandardTextRow>(
      `SELECT v.id, v.version_number, v.content_json, v.change_reason, v.created_by_user_id,
              u.full_name AS created_by_name, v.created_at
         FROM report_standard_text_versions v
         LEFT JOIN users u ON u.id = v.created_by_user_id
        WHERE v.id = $1;`,
      [id]
    );
    return res.rows[0] ? mapVersion(res.rows[0]) : null;
  }

  /** Tạo phiên bản mới (chỉ-thêm). Bản cũ giữ nguyên để các Rev đã phát hành vẫn tái lập được. */
  static async createStandardTextVersion(
    content: StandardTextContent,
    changeReason: string,
    userId: string | null
  ): Promise<StandardTextVersion> {
    const created = await Database.transaction(async (client) => {
      // Khóa bảng tránh 2 Super Admin cùng tạo trùng số phiên bản
      await client.query('LOCK TABLE report_standard_text_versions IN SHARE ROW EXCLUSIVE MODE;');
      const next = await client.query<{ next: number }>(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM report_standard_text_versions;`
      );
      const ins = await client.query<{ id: string }>(
        `INSERT INTO report_standard_text_versions (version_number, content_json, change_reason, created_by_user_id)
         VALUES ($1, $2, $3, $4) RETURNING id;`,
        [next.rows[0].next, JSON.stringify(content), changeReason, userId]
      );
      await writeAudit(client, 'REPORT_STANDARD_TEXT', ins.rows[0].id, 'SUPER_ADMIN_CREATE_STANDARD_TEXT_VERSION', userId, {
        versionNumber: next.rows[0].next,
        changeReason,
      });
      return ins.rows[0].id;
    });
    const version = await this.getStandardTextVersionById(created);
    if (!version) throw new NotFoundError('Không đọc lại được phiên bản vừa tạo');
    return version;
  }

  static async listEquipment(): Promise<SurveyEquipmentItem[]> {
    const res = await Database.query<EquipmentRow>(
      `SELECT ${EQUIPMENT_COLUMNS} FROM project_survey_equipment
        WHERE deleted_at IS NULL ORDER BY sort_order, created_at;`
    );
    return res.rows.map(mapEquipment);
  }

  static async createEquipment(input: EquipmentInput, userId: string | null): Promise<SurveyEquipmentItem> {
    return Database.transaction(async (client) => {
      const res = await client.query<EquipmentRow>(
        `INSERT INTO project_survey_equipment (sort_order, name_vi, name_en, specification_vi, specification_en,
            purpose_vi, purpose_en, model, serial_no, calibration_cert_no, calibration_valid_to,
            created_by_user_id, updated_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
         RETURNING ${EQUIPMENT_COLUMNS};`,
        [
          input.sortOrder, input.nameVi, input.nameEn, input.specificationVi, input.specificationEn,
          input.purposeVi, input.purposeEn, input.model, input.serialNo, input.calibrationCertNo,
          input.calibrationValidTo, userId,
        ]
      );
      const item = mapEquipment(res.rows[0]);
      await writeAudit(client, 'SURVEY_EQUIPMENT', item.id, 'SUPER_ADMIN_CREATE_EQUIPMENT', userId, { after: item });
      return item;
    });
  }

  static async updateEquipment(id: string, input: EquipmentInput, userId: string | null): Promise<SurveyEquipmentItem> {
    return Database.transaction(async (client) => {
      const before = await client.query<EquipmentRow>(
        `SELECT ${EQUIPMENT_COLUMNS} FROM project_survey_equipment WHERE id = $1 AND deleted_at IS NULL FOR UPDATE;`,
        [id]
      );
      if (!before.rows[0]) throw new NotFoundError('Không tìm thấy thiết bị');
      const res = await client.query<EquipmentRow>(
        `UPDATE project_survey_equipment
            SET sort_order=$2, name_vi=$3, name_en=$4, specification_vi=$5, specification_en=$6,
                purpose_vi=$7, purpose_en=$8, model=$9, serial_no=$10, calibration_cert_no=$11,
                calibration_valid_to=$12, updated_by_user_id=$13, updated_at=NOW()
          WHERE id = $1
          RETURNING ${EQUIPMENT_COLUMNS};`,
        [
          id, input.sortOrder, input.nameVi, input.nameEn, input.specificationVi, input.specificationEn,
          input.purposeVi, input.purposeEn, input.model, input.serialNo, input.calibrationCertNo,
          input.calibrationValidTo, userId,
        ]
      );
      const item = mapEquipment(res.rows[0]);
      await writeAudit(client, 'SURVEY_EQUIPMENT', id, 'SUPER_ADMIN_UPDATE_EQUIPMENT', userId, {
        before: mapEquipment(before.rows[0]),
        after: item,
      });
      return item;
    });
  }

  /** Xóa mềm – các Rev đã phát hành vẫn giữ ảnh chụp danh mục trong report_releases.equipment_snapshot_json. */
  static async softDeleteEquipment(id: string, reason: string, userId: string | null): Promise<void> {
    await Database.transaction(async (client) => {
      const res = await client.query<EquipmentRow>(
        `UPDATE project_survey_equipment SET deleted_at = NOW(), updated_by_user_id = $2, updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING ${EQUIPMENT_COLUMNS};`,
        [id, userId]
      );
      if (!res.rows[0]) throw new NotFoundError('Không tìm thấy thiết bị');
      await writeAudit(client, 'SURVEY_EQUIPMENT', id, 'SUPER_ADMIN_DELETE_EQUIPMENT', userId, {
        before: mapEquipment(res.rows[0]),
        reason,
      });
    });
  }

  /**
   * Cấu hình hiệu lực hiện hành dùng để render bản nháp / phát hành Rev mới.
   * Nếu CSDL chưa có bảng (chưa migrate) trả cấu hình rỗng để báo cáo không in văn bản khuôn mẫu.
   */
  static async getActiveConfig(): Promise<ReportContentConfig> {
    try {
      const [versions, equipment] = await Promise.all([
        Database.query<StandardTextRow>(
          `SELECT id, version_number, content_json, change_reason, created_by_user_id,
                  NULL::text AS created_by_name, created_at
             FROM report_standard_text_versions
            WHERE deleted_at IS NULL
            ORDER BY version_number DESC LIMIT 1;`
        ),
        this.listEquipment(),
      ]);
      const active = versions.rows[0] ? mapVersion(versions.rows[0]) : null;
      return {
        standardTextVersionId: active?.id ?? null,
        standardTextVersionNumber: active?.versionNumber ?? null,
        standardText: active?.content ?? EMPTY_STANDARD_TEXT,
        equipment,
      };
    } catch (err) {
      if (isMissingTable(err)) {
        console.error('[ReportConfig] Chưa chạy migration 20261019_create_report_content_config.sql', err);
        return { standardTextVersionId: null, standardTextVersionNumber: null, standardText: EMPTY_STANDARD_TEXT, equipment: [] };
      }
      throw err;
    }
  }

  /** Cấu hình đã ghim khi phát hành Rev (để tải lại bản FINAL đúng như lúc phát hành). */
  static async getPinnedConfig(
    standardTextVersionId: string | null,
    equipmentSnapshot: unknown
  ): Promise<ReportContentConfig | null> {
    if (!standardTextVersionId || !Array.isArray(equipmentSnapshot)) return null;
    const version = await this.getStandardTextVersionById(standardTextVersionId);
    if (!version) return null;
    return {
      standardTextVersionId: version.id,
      standardTextVersionNumber: version.versionNumber,
      standardText: version.content,
      equipment: equipmentSnapshot as SurveyEquipmentItem[],
    };
  }
}
