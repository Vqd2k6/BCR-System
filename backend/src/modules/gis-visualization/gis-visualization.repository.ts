import { Database } from '../../database/db';
import { CadastralRepository } from '../cadastral/cadastral.repository';
import type { ThematicSourceRow } from './gis-visualization.rules';

/**
 * Chỉ đọc thuộc tính (không SELECT geometry / GeoJSON, không PII).
 * Mỗi thửa ACTIVE chọn đúng 1 hồ sơ Phase 1 cấp thửa (unit_id IS NULL — nhà độc lập hoặc Master chung cư,
 * không bao giờ lấy căn hộ con) theo thứ tự APPROVED → UNDER_REVIEW → SUBMITTED, rồi hồ sơ đang hoạt động,
 * rồi mới nhất (cùng mẫu với progress-report/data/pg-progress.datasource.ts). DRAFT / REJECTED không được chọn.
 */
const THEMATIC_SQL = `
  SELECT p.id::text                AS parcel_id,
         p.building_type           AS building_type,
         p.distance_to_centerline_m AS distance_to_centerline_m,
         r.id::text                AS report_id,
         r.status::text            AS report_status,
         r.report_type             AS report_type,
         r.survey_data_json        AS survey_data_json,
         to_jsonb(bs)              AS specs,
         to_jsonb(rsc)             AS card
    FROM parcels p
    LEFT JOIN LATERAL (
      SELECT r0.id, r0.status, r0.report_type, r0.survey_data_json
        FROM base_survey_reports r0
       WHERE r0.parcel_id = p.id
         AND r0.unit_id IS NULL
         AND r0.deleted_at IS NULL
         AND r0.phase = 'PHASE_1'
         AND COALESCE(r0.report_type, 'STANDALONE') NOT IN ('CONDO_UNIT', 'UNIT_CHILD')
         AND r0.status::text IN ('APPROVED', 'UNDER_REVIEW', 'SUBMITTED')
       ORDER BY CASE r0.status::text WHEN 'APPROVED' THEN 1 WHEN 'UNDER_REVIEW' THEN 2 ELSE 3 END ASC,
                (r0.id = p.active_phase1_report_id) DESC,
                r0.updated_at DESC NULLS LAST
       LIMIT 1
    ) r ON TRUE
    LEFT JOIN building_specifications bs ON bs.report_id = r.id
    LEFT JOIN risk_score_cards rsc ON rsc.report_id = r.id
   WHERE p.lifecycle_status = 'ACTIVE'
     AND p.zone_id = ANY($1)
`;

export class GisVisualizationRepository {
  static async listThematicRows(zoneId: string): Promise<ThematicSourceRow[]> {
    const zoneAliases = CadastralRepository.getZoneAliases(zoneId);
    const res = await Database.query<ThematicSourceRow>(THEMATIC_SQL, [zoneAliases]);
    return res.rows;
  }
}
