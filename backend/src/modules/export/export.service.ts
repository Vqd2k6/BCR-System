import { Database } from '../../database/db';
import { CryptoUtils } from '../../common/utils/crypto.utils';
import { NotFoundError, BadRequestError } from '../../common/errors/problem-details';

export class ExportService {
  static async createBatchExport(userId: string, data: any) {
    const batchCode = `BATCH-${data.zoneId || 'GLOBAL'}-${Date.now()}`;
    const selectedIds = data.selectedReportIds || [];
    const totalCount = selectedIds.length > 0 ? selectedIds.length : 120; // Mô phỏng count

    // Mock link download và SHA-256 Checksum
    const downloadUrl = `https://storage.metro2.vn/exports/${batchCode}.pdf`;
    const checksumSha256 = CryptoUtils.sha256(batchCode + downloadUrl);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày

    const res = await Database.query<{ id: string; batch_code: string }>(
      `INSERT INTO compiled_report_batches (
         batch_code, zone_id, export_scope, selected_report_ids, filter_criteria_json,
         period_label, total_reports_compiled, exported_by_user_id, export_format,
         include_gis_overview_map, include_ecs_summary_table, status, download_url,
         file_size_bytes, checksum_sha256, expires_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'COMPLETED', $12, $13, $14, $15
       ) RETURNING id, batch_code;`,
      [
        batchCode,
        data.zoneId || null,
        data.exportScope,
        selectedIds,
        JSON.stringify(data.filterCriteria || {}),
        data.filterCriteria?.periodType || 'CUSTOM',
        totalCount,
        userId,
        data.exportFormat,
        data.includeGisOverviewMap,
        data.includeEcsSummaryTable,
        downloadUrl,
        15482000, // ~15.4 MB
        checksumSha256,
        expiresAt,
      ]
    );

    return {
      batchId: res.rows[0].id,
      batchCode: res.rows[0].batch_code,
      status: 'COMPLETED',
      downloadUrl,
      checksumSha256,
      totalReportsCompiled: totalCount,
      expiresAt,
      message: 'Đã đóng gói tập hồ sơ báo cáo thành công kèm mã băm Checksum SHA-256',
    };
  }

  static async getBatchStatus(batchId: string) {
    const res = await Database.query(
      `SELECT * FROM compiled_report_batches WHERE id = $1;`,
      [batchId]
    );
    if (!res.rows[0]) {
      throw new NotFoundError(`Không tìm thấy mẻ xuất báo cáo với ID: ${batchId}`);
    }
    return res.rows[0];
  }

  static async listAllExportBatches(zoneId?: string) {
    let whereClause = ``;
    const params: any[] = [];
    if (zoneId) {
      params.push(zoneId);
      whereClause = `WHERE b.zone_id = $1`;
    }

    const res = await Database.query(
      `SELECT b.*, u.full_name AS exporter_name
       FROM compiled_report_batches b
       JOIN users u ON b.exported_by_user_id = u.id
       ${whereClause}
       ORDER BY b.created_at DESC;`,
      params
    );
    return res.rows;
  }

  static async revokeAndPurgeExport(batchId: string) {
    const res = await Database.query(
      `UPDATE compiled_report_batches
       SET status = 'REVOKED', download_url = NULL
       WHERE id = $1
       RETURNING *;`,
      [batchId]
    );
    if (!res.rows[0]) {
      throw new NotFoundError(`Không tìm thấy mẻ xuất báo cáo với ID: ${batchId}`);
    }
    return {
      batchId,
      status: 'REVOKED',
      message: 'Đã thu hồi link tải và xóa file xuất khỏi hệ thống thành công',
    };
  }

  // --- CONTRACTOR & GUEST VIEW ENDPOINTS ---

  static async getGuestGisMap(zoneId?: string) {
    const targetZone = zoneId || 'ZONE_S9';
    const res = await Database.query(
      `SELECT p.id, p.project_parcel_code, p.house_number, p.street, p.survey_status,
              ST_AsGeoJSON(p.location_geom)::json AS location_geojson,
              ST_AsGeoJSON(p.footprint_polygon_geom)::json AS footprint_geojson
       FROM parcels p
       WHERE p.zone_id = $1 AND p.lifecycle_status = 'ACTIVE';`,
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
