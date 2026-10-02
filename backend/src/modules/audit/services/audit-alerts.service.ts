import { Database } from '../../../database/db';

export class AuditAlertsService {
  /**
   * Quét và tạo các cờ cảnh báo gian lận & bất thường cho một hồ sơ
   */
  static async scanReportAnomalies(reportId: string) {
    const reportRes = await Database.query(
      `SELECT r.*, p.floor_count, p.absence_attempt_count, p.id AS parcel_id
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       WHERE r.id = $1;`,
      [reportId]
    );
    if (!reportRes.rows[0]) return [];

    const report = reportRes.rows[0];
    const alerts: any[] = [];

    // Quy tắc 3: Cảnh báo Nguy cấp Kết cấu (STRUCTURAL_CRITICAL)
    const critRes = await Database.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM defect_items d
       JOIN damage_zones z ON d.zone_id = z.id
       WHERE z.report_id = $1 AND (d.is_structural_critical = TRUE OR d.structural_significance_e2 >= 3);`,
      [reportId]
    );
    if (parseInt(critRes.rows[0]?.count || '0', 10) > 0) {
      alerts.push({
        alertType: 'STRUCTURAL_CRITICAL',
        severity: 'CRITICAL',
        title: 'Cảnh báo Nguy cấp Kết cấu',
        detail: `Hồ sơ phát hiện ${critRes.rows[0].count} khuyết tật mang cờ kết cấu Critical / E2 >= 3`,
      });
    }

    // Quy tắc 4: Cảnh báo Thiếu Thước Đo (MISSING_SCALE_CARD)
    const scaleRes = await Database.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM defect_items d
       JOIN damage_zones z ON d.zone_id = z.id
       WHERE z.report_id = $1 AND d.has_scale_card = FALSE;`,
      [reportId]
    );
    if (parseInt(scaleRes.rows[0]?.count || '0', 10) > 0) {
      alerts.push({
        alertType: 'MISSING_SCALE_CARD',
        severity: 'MEDIUM',
        title: 'Cảnh báo Thiếu Thước Đo Khe Nứt',
        detail: `Hồ sơ có ${scaleRes.rows[0].count} ảnh cận cảnh CU chưa áp sát thước đo Scale Card`,
      });
    }

    // Quy tắc 5: Cảnh báo Vắng nhà nhiều lần (REPEATED_ABSENCE)
    if (report.absence_attempt_count >= 3) {
      alerts.push({
        alertType: 'REPEATED_ABSENCE',
        severity: 'LOW',
        title: 'Cảnh báo Đến Vắng Mặt Nhiều Lần',
        detail: `Công trình đã ghi nhận ${report.absence_attempt_count} lần liên hệ nhưng đều vắng nhà`,
      });
    }

    // Lưu các cờ cảnh báo vào DB
    for (const a of alerts) {
      await Database.query(
        `INSERT INTO audit_alert_items (report_id, parcel_id, surveyor_id, alert_type, severity, title, detail)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING;`,
        [reportId, report.parcel_id, report.surveyor_id, a.alertType, a.severity, a.title, a.detail]
      );
    }

    return alerts;
  }

  static async listAuditAlerts(filters: { zoneId?: string; severity?: string; isResolved?: boolean }) {
    let whereClause = `WHERE a.is_resolved = $1`;
    const params: any[] = [filters.isResolved ?? false];

    if (filters.zoneId && filters.zoneId.toUpperCase() !== 'ALL' && filters.zoneId.toUpperCase() !== 'ALL_ZONES') {
      params.push(filters.zoneId);
      whereClause += ` AND p.zone_id = $${params.length}`;
    }
    if (filters.severity) {
      params.push(filters.severity);
      whereClause += ` AND a.severity = $${params.length}`;
    }

    const res = await Database.query(
      `SELECT a.*, p.project_parcel_code, p.house_number, p.street, u.full_name AS surveyor_name
       FROM audit_alert_items a
       JOIN parcels p ON a.parcel_id = p.id
       JOIN users u ON a.surveyor_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC;`,
      params
    );
    return res.rows;
  }

  static async getReportAuditFlags(reportId: string) {
    const res = await Database.query(
      `SELECT * FROM audit_alert_items WHERE report_id = $1 ORDER BY created_at DESC;`,
      [reportId]
    );
    return res.rows;
  }
}
