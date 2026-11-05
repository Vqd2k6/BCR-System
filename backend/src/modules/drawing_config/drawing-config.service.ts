import type { PoolClient } from 'pg';
import { Database } from '../../database/db';
import {
  formatRevisionLabel,
  type CreateRevisionInput,
  type UpdateTitleBlockInput,
  type ZoneDrawingConfig,
  type ZoneDrawingRevision,
  type ZoneDrawingTitleBlock,
} from './drawing-config.types';

interface TitleBlockRow {
  id: string;
  zone_code: string;
  prepared_by: string;
  reviewed_by: string;
  approved_by: string;
  manager: string;
  project_manager: string;
  drawing_no: string;
  updated_by_name: string | null;
  updated_at: Date;
}

interface RevisionRow {
  id: string;
  revision_number: number;
  issue_date: string;
  description: string;
  created_by_name: string | null;
  created_at: Date;
}

const TITLE_BLOCK_SELECT = `SELECT t.id, t.zone_code, t.prepared_by, t.reviewed_by, t.approved_by, t.manager,
         t.project_manager, t.drawing_no, u.full_name AS updated_by_name, t.updated_at
    FROM zone_drawing_title_blocks t
    LEFT JOIN users u ON u.id = t.updated_by_user_id`;

function mapTitleBlock(row: TitleBlockRow): ZoneDrawingTitleBlock {
  return {
    id: row.id,
    zoneCode: row.zone_code,
    preparedBy: row.prepared_by,
    reviewedBy: row.reviewed_by,
    approvedBy: row.approved_by,
    manager: row.manager,
    projectManager: row.project_manager,
    drawingNo: row.drawing_no,
    updatedByName: row.updated_by_name,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapRevision(row: RevisionRow): ZoneDrawingRevision {
  return {
    id: row.id,
    revision: formatRevisionLabel(row.revision_number),
    revisionNumber: row.revision_number,
    issueDate: row.issue_date,
    description: row.description,
    createdByName: row.created_by_name,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function writeAudit(
  client: PoolClient,
  entityType: string,
  entityId: string,
  action: string,
  userId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await client.query(
    `INSERT INTO system_audit_logs (entity_type, entity_id, action, performed_by_user_id, diff_payload)
     VALUES ($1, $2, $3, $4, $5);`,
    [entityType, entityId, action, userId, JSON.stringify({ ...payload, timestamp: new Date().toISOString() })]
  );
}

async function loadRevisions(client: PoolClient | null, zoneCode: string): Promise<ZoneDrawingRevision[]> {
  const sql = `SELECT r.id, r.revision_number, to_char(r.issue_date, 'YYYY-MM-DD') AS issue_date, r.description,
                      u.full_name AS created_by_name, r.created_at
                 FROM zone_drawing_revisions r
                 LEFT JOIN users u ON u.id = r.created_by_user_id
                WHERE r.zone_code = $1 AND r.deleted_at IS NULL
                ORDER BY r.revision_number ASC;`;
  const res = client
    ? await client.query<RevisionRow>(sql, [zoneCode])
    : await Database.query<RevisionRow>(sql, [zoneCode]);
  return res.rows.map(mapRevision);
}

export class DrawingConfigService {
  static async getZoneConfig(zoneCode: string): Promise<ZoneDrawingConfig> {
    const titleRes = await Database.query<TitleBlockRow>(
      `${TITLE_BLOCK_SELECT} WHERE t.zone_code = $1 AND t.deleted_at IS NULL;`,
      [zoneCode]
    );
    const revisions = await loadRevisions(null, zoneCode);
    return {
      zoneCode,
      titleBlock: titleRes.rows[0] ? mapTitleBlock(titleRes.rows[0]) : null,
      revisions,
    };
  }

  /** Ghi đè khung tên của Zone (upsert) và lưu before/after vào system_audit_logs trong cùng transaction. */
  static async updateTitleBlock(
    zoneCode: string,
    input: UpdateTitleBlockInput,
    userId: string
  ): Promise<ZoneDrawingTitleBlock> {
    return Database.transaction(async (client) => {
      const before = await client.query<TitleBlockRow>(
        `${TITLE_BLOCK_SELECT} WHERE t.zone_code = $1 FOR UPDATE OF t;`,
        [zoneCode]
      );
      const saved = await client.query<{ id: string }>(
        `INSERT INTO zone_drawing_title_blocks
           (zone_code, prepared_by, reviewed_by, approved_by, manager, project_manager, drawing_no, updated_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (zone_code) DO UPDATE SET
           prepared_by = EXCLUDED.prepared_by,
           reviewed_by = EXCLUDED.reviewed_by,
           approved_by = EXCLUDED.approved_by,
           manager = EXCLUDED.manager,
           project_manager = EXCLUDED.project_manager,
           drawing_no = EXCLUDED.drawing_no,
           updated_by_user_id = EXCLUDED.updated_by_user_id,
           updated_at = NOW(),
           deleted_at = NULL
         RETURNING id;`,
        [
          zoneCode,
          input.preparedBy,
          input.reviewedBy,
          input.approvedBy,
          input.manager,
          input.projectManager,
          input.drawingNo,
          userId,
        ]
      );
      const after = await client.query<TitleBlockRow>(`${TITLE_BLOCK_SELECT} WHERE t.id = $1;`, [saved.rows[0].id]);
      const mappedAfter = mapTitleBlock(after.rows[0]);
      await writeAudit(client, 'ZONE_DRAWING_TITLE_BLOCK', mappedAfter.id, 'SUPER_ADMIN_UPDATE_DRAWING_TITLE_BLOCK', userId, {
        zoneCode,
        before: before.rows[0] ? mapTitleBlock(before.rows[0]) : null,
        after: mappedAfter,
      });
      return mappedAfter;
    });
  }

  /** Phát hành lần mới: chỉ thêm, số Rev do server cấp tuần tự theo Zone (R00, R01, ...). */
  static async createRevision(zoneCode: string, input: CreateRevisionInput, userId: string): Promise<ZoneDrawingRevision> {
    return Database.transaction(async (client) => {
      // Khóa theo Zone để hai lần bấm "Phát hành" đồng thời không cấp trùng số Rev
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('zone_drawing_revisions:' || $1));`, [zoneCode]);
      const next = await client.query<{ next: number }>(
        `SELECT COALESCE(MAX(revision_number), -1) + 1 AS next FROM zone_drawing_revisions WHERE zone_code = $1;`,
        [zoneCode]
      );
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO zone_drawing_revisions (zone_code, revision_number, issue_date, description, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
        [zoneCode, next.rows[0].next, input.issueDate, input.description, userId]
      );
      const revisions = await loadRevisions(client, zoneCode);
      const created = revisions.find((revision) => revision.id === inserted.rows[0].id);
      if (!created) throw new Error(`[DrawingConfig:CreateRevision] Không đọc lại được revision vừa tạo của ${zoneCode}`);
      await writeAudit(client, 'ZONE_DRAWING_REVISION', created.id, 'SUPER_ADMIN_ISSUE_DRAWING_REVISION', userId, {
        zoneCode,
        after: created,
      });
      return created;
    });
  }
}
