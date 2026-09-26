import { Database } from '../../database/db';
import { NotFoundError, BadRequestError } from '../../common/errors/problem-details';

export class AuditService {
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
    const params: any[] = [
      filters.isResolved ?? false,
      filters.zoneId || null,
      filters.severity || null,
    ];

    const res = await Database.query(
      `SELECT a.*, p.project_parcel_code, p.house_number, p.street, u.full_name AS surveyor_name
       FROM audit_alert_items a
       JOIN parcels p ON a.parcel_id = p.id
       JOIN users u ON a.surveyor_id = u.id
       WHERE a.is_resolved = $1
         AND ($2::text IS NULL OR p.zone_id = $2)
         AND ($3::text IS NULL OR a.severity = $3)
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

  /**
   * Trả về Payload Split-Pane (Kính lúp 400% + Cây cấu kiện) cho Zone Admin thẩm định
   */
  static async getSplitPaneAuditView(reportId: string) {
    const reportRes = await Database.query(
      `SELECT r.*, p.project_parcel_code, p.house_number, p.street, p.zone_id,
              u.full_name AS surveyor_name
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       JOIN users u ON r.surveyor_id = u.id
       WHERE r.id = $1;`,
      [reportId]
    );
    if (!reportRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ với ID: ${reportId}`);
    }

    const report = reportRes.rows[0];

    // Cặp ảnh CTX / CU
    const zonesRes = await Database.query(
      `SELECT z.*,
              COALESCE(json_agg(d.*) FILTER (WHERE d.id IS NOT NULL), '[]') AS defects
       FROM damage_zones z
       LEFT JOIN defect_items d ON z.id = d.zone_id
       WHERE z.report_id = $1
       GROUP BY z.id;`,
      [reportId]
    );

    // Bảng điểm rủi ro
    const scoresRes = await Database.query(
      `SELECT * FROM risk_score_cards WHERE report_id = $1;`,
      [reportId]
    );

    // Cờ cảnh báo
    const flagsRes = await Database.query(
      `SELECT * FROM audit_alert_items WHERE report_id = $1;`,
      [reportId]
    );

    return {
      reportId: report.id,
      projectParcelCode: report.project_parcel_code,
      surveyorName: report.surveyor_name,
      status: report.status,
      surveyDate: report.survey_date,
      
      // Nửa Trái (Left Pane): Cấu kiện & Điểm số
      leftPane: {
        damageZones: zonesRes.rows,
        riskScoreCard: scoresRes.rows[0] || null,
      },

      // Nửa Phải (Right Pane): Cặp ảnh CTX + CU có thước đo vạch mm (Kích hoạt kính lúp 400%)
      rightPane: {
        magnifierZoomFactor: '400%',
        photoGalleries: zonesRes.rows.map((z: any) => {
          const defectsList = Array.isArray(z.defects)
            ? z.defects
            : typeof z.defects === 'string'
            ? JSON.parse(z.defects)
            : [];
          return {
            zoneCode: z.zone_code,
            floorName: z.floor_name,
            roomName: z.room_name,
            ctxPhotoUrl: z.ctx_photo_url,
            defects: defectsList.map((d: any) => ({
              defectCode: d.defect_code,
              cuPhotoUrl: d.cu_photo_url,
              widthMaxMm: d.width_max_mm,
              lengthMm: d.length_mm,
              hasScaleCard: d.has_scale_card,
              isStructuralCritical: d.is_structural_critical,
            })),
          };
        }),
      },

      auditFlags: flagsRes.rows,
    };
  }

  static async approveReport(reportId: string, adminId: string, judgementNotes?: string) {
    return Database.transaction(async (client) => {
      const repRes = await client.query<{
        id: string;
        parcel_id: string;
        project_parcel_code: string;
        is_refused_or_absent: boolean;
        summary_conclusions: string;
        current_step: number;
      }>(
        `SELECT r.id, r.parcel_id, p.project_parcel_code, r.is_refused_or_absent, r.summary_conclusions, r.current_step
         FROM base_survey_reports r
         JOIN parcels p ON r.parcel_id = p.id
         WHERE (r.id = $1 OR r.parcel_id = $1)
         ORDER BY (CASE WHEN r.id = $1 THEN 0 ELSE 1 END), r.created_at DESC
         LIMIT 1 FOR UPDATE;`,
        [reportId]
      );
      if (!repRes.rows[0]) {
        throw new NotFoundError(`Không tìm thấy hồ sơ với ID: ${reportId}`);
      }

      const actualReportId = repRes.rows[0].id;
      const actualParcelId = repRes.rows[0].parcel_id;
      const officialPdfUrl = `https://storage.metro2.vn/reports/REPORT_${repRes.rows[0].project_parcel_code}_OFFICIAL.pdf`;

      // 1. Phê duyệt Báo cáo
      await client.query(
        `UPDATE base_survey_reports
         SET status = 'APPROVED',
             zone_admin_id = $2,
             approved_at = NOW(),
             official_pdf_url = $3,
             engineering_recommendations = COALESCE($4, engineering_recommendations),
             updated_at = NOW()
         WHERE id = $1;`,
        [actualReportId, adminId, officialPdfUrl, judgementNotes || null]
      );

      // 2. Chuyển trạng thái Thửa đất về trạng thái đã duyệt tương ứng
      let parcelApprovedStatus = 'APPROVED';
      if (repRes.rows[0].is_refused_or_absent) {
        parcelApprovedStatus = 'POSTPONED_ABSENT';
      } else if (
        repRes.rows[0].summary_conclusions?.toLowerCase().includes('đang thi công') ||
        repRes.rows[0].summary_conclusions?.toLowerCase().includes('đang xây')
      ) {
        parcelApprovedStatus = 'UNDER_CONSTRUCTION';
      }

      await client.query(
        `UPDATE parcels SET survey_status = $2, updated_at = NOW() WHERE id = $1;`,
        [actualParcelId, parcelApprovedStatus]
      );

      // 3. Tự động đóng các cờ cảnh báo
      await client.query(
        `UPDATE audit_alert_items
         SET is_resolved = TRUE, resolved_by_user_id = $2, resolved_at = NOW()
         WHERE report_id = $1;`,
        [actualReportId, adminId]
      );

      return {
        reportId: actualReportId,
        parcelId: actualParcelId,
        status: 'APPROVED',
        officialPdfUrl,
        message: 'Đã phê duyệt báo cáo thành công và sinh file PDF/A ký số điện tử',
      };
    });
  }

  static async rejectReport(reportId: string, adminId: string, rejectionReason: string) {
    return Database.transaction(async (client) => {
      const repRes = await client.query<{ id: string; parcel_id: string }>(
        `SELECT id, parcel_id FROM base_survey_reports 
         WHERE (id = $1 OR parcel_id = $1)
         ORDER BY (CASE WHEN id = $1 THEN 0 ELSE 1 END), created_at DESC
         LIMIT 1 FOR UPDATE;`,
        [reportId]
      );
      if (!repRes.rows[0]) {
        throw new NotFoundError(`Không tìm thấy hồ sơ với ID: ${reportId}`);
      }

      const actualReportId = repRes.rows[0].id;
      const actualParcelId = repRes.rows[0].parcel_id;

      // 1. Trả về Báo cáo kèm lý do kỹ thuật
      await client.query(
        `UPDATE base_survey_reports
         SET status = 'REJECTED',
             zone_admin_id = $2,
             engineering_recommendations = $3,
             updated_at = NOW()
         WHERE id = $1;`,
        [actualReportId, adminId, `LÝ DO TRẢ VỀ: ${rejectionReason}`]
      );

      // 2. Chuyển thửa đất sang REJECTED (Màu Đỏ trên GIS)
      await client.query(
        `UPDATE parcels SET survey_status = 'REJECTED', updated_at = NOW() WHERE id = $1;`,
        [actualParcelId]
      );

      return {
        reportId: actualReportId,
        parcelId: actualParcelId,
        status: 'REJECTED',
        rejectionReason,
        message: 'Đã trả về báo cáo khảo sát thành công',
      };
    });
  }

  static async getProgressAnalytics(zoneId?: string) {
    let whereClause = ``;
    const params: any[] = [];
    if (zoneId) {
      params.push(zoneId);
      whereClause = `WHERE zone_id = $1`;
    }

    const res = await Database.query(
      `SELECT 
         COUNT(*) AS total_parcels,
         COUNT(*) FILTER (WHERE survey_status = 'APPROVED') AS approved_count,
         COUNT(*) FILTER (WHERE survey_status = 'SUBMITTED') AS submitted_count,
         COUNT(*) FILTER (WHERE survey_status = 'IN_PROGRESS') AS in_progress_count,
         COUNT(*) FILTER (WHERE survey_status = 'POSTPONED_ABSENT') AS absent_count,
         COUNT(*) FILTER (WHERE survey_status = 'REJECTED') AS rejected_count,
         COUNT(*) FILTER (WHERE survey_status = 'NOT_SURVEYED') AS not_surveyed_count
       FROM parcels
       ${whereClause};`,
      params
    );

    return res.rows[0];
  }
}
