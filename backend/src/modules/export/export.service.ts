import { Database } from '../../database/db';
import { CryptoUtils } from '../../common/utils/crypto.utils';
import { NotFoundError, BadRequestError } from '../../common/errors/problem-details';

export class ExportService {
  static async getGuestGisMap(zoneId?: string) {
    const targetZone = zoneId || 'ZONE_01';
    const res = await Database.query(
      `SELECT p.id, p.project_parcel_code, p.house_number, p.street, p.survey_status,
              ST_AsGeoJSON(p.location_geom)::json AS location_geojson,
              ST_AsGeoJSON(p.footprint_polygon_geom)::json AS footprint_geojson
       FROM parcels p
       WHERE (p.zone_id = $1 OR ($1 = 'ALL' AND p.zone_id IS NOT NULL)) AND p.lifecycle_status = 'ACTIVE';`,
      [targetZone]
    );
    return {
      zoneId: targetZone,
      totalParcels: res.rows.length,
      parcels: res.rows,
    };
  }

  static async getGuestParcelSummary(parcelId: string) {
    const res = await Database.query(
      `SELECT p.id, p.project_parcel_code, p.house_number, p.street, p.floor_count,
              p.importance_group, p.survey_status,
              s.building_name, s.structural_system, s.foundation_category,
              k.total_ecs_score, k.ecs_class, k.avg_vi_score, k.vi_class,
              r.official_pdf_url
       FROM parcels p
       LEFT JOIN base_survey_reports r ON p.active_phase1_report_id = r.id
       LEFT JOIN building_specifications s ON r.id = s.report_id
       LEFT JOIN risk_score_cards k ON r.id = k.report_id
       WHERE p.id = $1;`,
      [parcelId]
    );
    if (!res.rows[0]) {
      throw new NotFoundError(`Không tìm thấy thửa đất: ${parcelId}`);
    }
    return res.rows[0];
  }
}
