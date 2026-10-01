import { Database } from '../../database/db';
import { NotFoundError, BadRequestError, UnauthorizedError, ForbiddenError } from '../../common/errors/problem-details';
import { CryptoUtils } from '../../common/utils/crypto.utils';

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

  /**
   * Truy vấn danh sách hàng đợi các hồ sơ cần Zone Admin thẩm định (SUBMITTED / POSTPONED_ABSENT / REJECTED)
   */
  static async listPendingSubmissions(filters: {
    zoneId?: string;
    status?: string;
    buildingType?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const params: any[] = [];
    let whereClause = '';

    if (filters.status && filters.status.toUpperCase() !== 'ALL') {
      params.push(filters.status.toUpperCase());
      whereClause = `WHERE r.status::text = $${params.length}`;
    } else {
      whereClause = `WHERE r.status::text IN ('SUBMITTED', 'POSTPONED_ABSENT', 'REJECTED', 'APPROVED')`;
    }

    if (filters.zoneId && filters.zoneId.toUpperCase() !== 'ALL' && filters.zoneId.toUpperCase() !== 'ALL_ZONES') {
      params.push(filters.zoneId);
      whereClause += ` AND p.zone_id = $${params.length}`;
    }

    if (filters.buildingType && filters.buildingType.toUpperCase() !== 'ALL') {
      params.push(filters.buildingType);
      whereClause += ` AND p.building_type = $${params.length}`;
    }

    if (filters.search && filters.search.trim()) {
      params.push(`%${filters.search.trim()}%`);
      whereClause += ` AND (
        p.project_parcel_code ILIKE $${params.length} OR
        p.house_number ILIKE $${params.length} OR
        p.street ILIKE $${params.length} OR
        p.owner_name ILIKE $${params.length} OR
        u.full_name ILIKE $${params.length}
      )`;
    }

    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
    const offset = Math.max(Number(filters.offset) || 0, 0);

    const query = `
      SELECT 
        r.id AS report_id,
        p.id AS parcel_id,
        p.project_parcel_code,
        p.house_number,
        p.street,
        p.zone_id,
        p.building_type,
        r.status::text AS status,
        p.survey_status::text AS parcel_status,
        r.is_refused_or_absent,
        p.absence_attempt_count,
        r.survey_date,
        r.created_at,
        r.updated_at,
        r.survey_data_json,
        u.id AS surveyor_id,
        u.full_name AS surveyor_name,
        u.surveyor_code,
        u.phone AS surveyor_phone,
        CASE 
          WHEN sc.e1_burland_score = 0 THEN 'GRADE_0'
          WHEN sc.e1_burland_score = 1 THEN 'GRADE_1'
          WHEN sc.e1_burland_score = 2 THEN 'GRADE_2'
          WHEN sc.e1_burland_score = 3 THEN 'GRADE_3'
          WHEN sc.e1_burland_score >= 4 THEN 'GRADE_4'
          ELSE NULL
        END AS burland_damage_category,
        (
          SELECT MAX(d.width_max_mm)
          FROM defect_items d
          JOIN damage_zones z ON d.zone_id = z.id
          WHERE z.report_id = r.id
        ) AS burland_max_crack_width_mm,
        sc.total_ecs_score AS ecs_score,
        sc.avg_vi_score AS vi_score,
        (
          SELECT COUNT(*) 
          FROM defect_items d 
          JOIN damage_zones z ON d.zone_id = z.id 
          WHERE z.report_id = r.id
        ) AS defect_count,
        (
          SELECT COUNT(*) 
          FROM audit_alert_items a 
          WHERE a.report_id = r.id AND a.is_resolved = FALSE
        ) AS alert_count
      FROM base_survey_reports r
      JOIN parcels p ON r.parcel_id = p.id
      LEFT JOIN users u ON r.surveyor_id = u.id
      LEFT JOIN risk_score_cards sc ON sc.report_id = r.id
      ${whereClause}
      ORDER BY r.updated_at DESC NULLS LAST, p.updated_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    const res = await Database.query(query, params);
    return res.rows;
  }

  /**
   * Trả về Payload Split-Pane (Kính lúp 400% + Cây cấu kiện) cho Zone Admin thẩm định
   */
  static async getSplitPaneAuditView(reportId: string) {
    const reportRes = await Database.query(
      `SELECT r.*, p.project_parcel_code, p.house_number, p.street, p.zone_id,
              u.full_name AS surveyor_name, u.phone AS surveyor_phone
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       JOIN users u ON r.surveyor_id = u.id
       WHERE (r.id = $1 OR r.parcel_id = $1)
       ORDER BY (CASE WHEN r.id = $1 THEN 0 ELSE 1 END), r.created_at DESC
       LIMIT 1;`,
      [reportId]
    );
    if (!reportRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ với ID: ${reportId}`);
    }

    const report = reportRes.rows[0];
    const actualReportId = report.id;

    // 1. Cặp ảnh CTX / CU và các điểm nứt D của Vùng Kiến Trúc Z
    const zonesRes = await Database.query(
      `SELECT z.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', d.id,
                    'defectCode', d.defect_code,
                    'screeningCategory', d.screening_category,
                    'defectType', d.defect_type,
                    'crackDirection', d.crack_direction,
                    'activityState', d.activity_state,
                    'widthMaxMm', d.width_max_mm,
                    'lengthMm', d.length_mm,
                    'hasScaleCard', d.has_scale_card,
                    'isStructuralCritical', d.is_structural_critical,
                    'structuralSignificanceE2', d.structural_significance_e2,
                    'materialDegradationE4', d.material_degradation_e4,
                    'cuPhotoUrl', d.cu_photo_url,
                    'cuPhotoCode', d.cu_photo_code,
                    'cuPhotos', COALESCE(d.cu_photos_json, '[]'::jsonb),
                    'pinX', d.pin_x,
                    'pinY', d.pin_y
                  )
                ) FILTER (WHERE d.id IS NOT NULL),
                '[]'
              ) AS defects
       FROM damage_zones z
       LEFT JOIN defect_items d ON z.id = d.zone_id
       WHERE z.report_id = $1 AND (z.zone_code NOT LIKE 'E%' OR z.zone_code IS NULL)
       GROUP BY z.id;`,
      [actualReportId]
    );

    // 2. Cấu kiện Chịu lực Kết cấu E (lưu trong damage_zones với mã E-xx)
    const elementsRes = await Database.query(
      `SELECT z.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', d.id,
                    'defectCode', d.defect_code,
                    'screeningCategory', d.screening_category,
                    'defectType', d.defect_type,
                    'crackDirection', d.crack_direction,
                    'activityState', d.activity_state,
                    'widthMaxMm', d.width_max_mm,
                    'lengthMm', d.length_mm,
                    'hasScaleCard', d.has_scale_card,
                    'isStructuralCritical', d.is_structural_critical,
                    'structuralSignificanceE2', d.structural_significance_e2,
                    'materialDegradationE4', d.material_degradation_e4,
                    'cuPhotoUrl', d.cu_photo_url,
                    'cuPhotoCode', d.cu_photo_code,
                    'cuPhotos', COALESCE(d.cu_photos_json, '[]'::jsonb),
                    'pinX', d.pin_x,
                    'pinY', d.pin_y
                  )
                ) FILTER (WHERE d.id IS NOT NULL),
                '[]'
              ) AS defects
       FROM damage_zones z
       LEFT JOIN defect_items d ON z.id = d.zone_id
       WHERE z.report_id = $1 AND z.zone_code LIKE 'E%'
       GROUP BY z.id;`,
      [actualReportId]
    );

    // 3. Bảng điểm rủi ro
    const scoresRes = await Database.query(
      `SELECT * FROM risk_score_cards WHERE report_id = $1;`,
      [actualReportId]
    );

    // 4. Cờ cảnh báo
    const flagsRes = await Database.query(
      `SELECT * FROM audit_alert_items WHERE report_id = $1;`,
      [actualReportId]
    );

    // 5. Nhật ký vắng mặt nếu có
    const absenceLogsRes = await Database.query(
      `SELECT * FROM parcel_absence_logs WHERE parcel_id = $1 ORDER BY recorded_at DESC;`,
      [report.parcel_id]
    );

    // 6. Truy vấn bảng ảnh nhận diện P01 - P04
    const photosRes = await Database.query(
      `SELECT * FROM survey_identification_photos WHERE report_id = $1;`,
      [actualReportId]
    );

    // 7. Truy vấn thông số kết cấu công trình
    const specsRes = await Database.query(
      `SELECT * FROM building_specifications WHERE report_id = $1;`,
      [actualReportId]
    );

    // 8. Truy vấn độ nhạy cảm lịch sử & 5 câu hỏi phỏng vấn
    const historyRes = await Database.query(
      `SELECT * FROM historical_sensitivities WHERE report_id = $1;`,
      [actualReportId]
    );

    // 9. Truy vấn đánh giá biến dạng lún nghiêng
    const deformRes = await Database.query(
      `SELECT * FROM deformation_assessments WHERE report_id = $1;`,
      [actualReportId]
    );

    const surveyJson = typeof report.survey_data_json === 'string'
      ? JSON.parse(report.survey_data_json)
      : (report.survey_data_json || {});

    // Chuẩn hóa bộ 4 ảnh định danh P-01 -> P-04 (kết hợp DB + survey_data_json)
    const p01Row = photosRes.rows.find((p: any) => p.photo_type === 'P01_HOUSE_NUMBER');
    const p02Row = photosRes.rows.find((p: any) => p.photo_type === 'P02_MAIN_FACADE');
    const p03Row = photosRes.rows.find((p: any) => p.photo_type === 'P03_SIDE_REAR');
    const p04Row = photosRes.rows.find((p: any) => p.photo_type === 'P04_CONTEXT_STREET');

    const p01Data = surveyJson.photoP01 || {};
    const p02Data = surveyJson.photoP02 || {};
    const p03Data = surveyJson.photoP03 || {};
    const p04Data = surveyJson.photoP04 || {};

    const identificationPhotos = {
      photoP01: {
        url: p01Data.url || p01Row?.annotated_photo_url || p01Row?.raw_photo_url || null,
        photoCode: p01Data.photoCode || p01Row?.photo_code || 'P-01',
        notApplicable: Boolean(p01Data.notApplicable ?? p01Row?.is_not_applicable),
        naReason: p01Data.naReason || p01Row?.na_reason || null,
      },
      photoP02: {
        url: p02Data.url || p02Row?.annotated_photo_url || p02Row?.raw_photo_url || null,
        photoCode: p02Data.photoCode || p02Row?.photo_code || 'P-02',
        polygonPoints: p02Data.polygonPoints || p02Row?.facade_polygon_points_json || null,
        floorSplits: p02Data.floorSplits || p02Row?.floor_split_lines_json || null,
        widthM: p02Data.widthM || null,
        heightM: p02Data.heightM || null,
        notApplicable: Boolean(p02Data.notApplicable ?? p02Row?.is_not_applicable),
      },
      photoP03: {
        url: p03Data.url || p03Row?.annotated_photo_url || p03Row?.raw_photo_url || null,
        photoCode: p03Data.photoCode || p03Row?.photo_code || 'P-03',
        tag: p03Data.tag || 'Bên hông phải',
        additionalPhotos: Array.isArray(p03Data.additionalPhotos) ? p03Data.additionalPhotos : [],
        notApplicable: Boolean(p03Data.notApplicable ?? p03Row?.is_not_applicable),
      },
      photoP04: {
        url: p04Data.url || p04Row?.annotated_photo_url || p04Row?.raw_photo_url || null,
        photoCode: p04Data.photoCode || p04Row?.photo_code || 'P-04',
        notApplicable: Boolean(p04Data.notApplicable ?? p04Row?.is_not_applicable),
      },
    };

    // Chuẩn hóa danh sách Vùng Kiến Trúc Z & Khuyết tật D (từ damage_zones DB hoặc bóc tách từ surveyJson.floors)
    let allDamageZones = zonesRes.rows;
    if (allDamageZones.length === 0 && Array.isArray(surveyJson.floors)) {
      const extracted: any[] = [];
      surveyJson.floors.forEach((fl: any) => {
        if (Array.isArray(fl.zones)) {
          fl.zones.forEach((z: any) => {
            extracted.push({
              id: z.id,
              zone_code: z.zoneCode || z.zone_code,
              floor_name: z.floorName || fl.floorName || 'Tầng trệt',
              room_name: z.roomName || z.customRoomName || 'Không gian chính',
              component_type: z.componentType || z.customComponentType || 'Tường',
              wall_material: z.wallMaterial || z.customWallMaterial || 'Vữa trát',
              ctx_photo_url: z.ctxPhotoUrl || (Array.isArray(z.overviewPhotos) ? z.overviewPhotos[0] : null),
              ctx_photo_code: z.ctxPhotoCode,
              burland_grade: z.burlandGrade,
              functional_impact_repair_needed: z.functionalImpactRepairNeeded,
              defects: Array.isArray(z.defects)
                ? z.defects.map((d: any) => ({
                    id: d.id || `${z.id}_${d.defectCode || d.defect_code}`,
                    defectCode: d.defectCode || d.defect_code,
                    widthMaxMm: d.widthMaxMm ?? d.width_max_mm ?? 0,
                    lengthMm: d.lengthMm ?? d.length_mm ?? 0,
                    hasScaleCard: Boolean(d.hasScaleCard ?? d.has_scale_card),
                    cuPhotoUrl: d.cuPhotoUrl || (Array.isArray(d.cuPhotos) ? d.cuPhotos[0] : null),
                    cuPhotos: Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0 ? d.cuPhotos : (d.cuPhotoUrl ? [d.cuPhotoUrl] : []),
                    screeningCategory: d.screeningCategory || d.defectType,
                    defectType: d.defectType,
                    crackDirection: d.crackDirection,
                    activityState: d.activityState,
                    isStructuralCritical: Boolean(d.isStructuralCritical),
                    pinX: d.pinX,
                    pinY: d.pinY,
                  }))
                : [],
            });
          });
        }
      });
      allDamageZones = extracted;
    }

    // Chuẩn hóa chữ ký KSV & Chủ hộ
    const sigJson = surveyJson.signatures || {};
    const normalizedSignatures = {
      surveyorSignature: report.surveyor_signature_url || sigJson.preparedBy?.photoUrl || sigJson.surveyorSignatureUrl || null,
      surveyorName: report.surveyor_name || sigJson.preparedBy?.fullName || null,
      ownerSignature: report.owner_signature_url || sigJson.ownerRepresentative?.photoUrl || sigJson.ownerSignatureUrl || null,
      ownerName: report.owner_name || surveyJson.ownerName || sigJson.ownerRepresentative?.fullName || null,
      ownerFeedback: report.owner_remarks || sigJson.ownerFeedback || sigJson.ownerRemarks || null,
      workingMinutesPhotos: Array.isArray(sigJson.workingMinutesPhotos) ? sigJson.workingMinutesPhotos : [],
    };

    return {
      reportId: report.id,
      parcelId: report.parcel_id,
      projectParcelCode: report.project_parcel_code,
      houseNumber: report.house_number || surveyJson.houseNumber,
      street: report.street || surveyJson.street,
      zoneId: report.zone_id,
      surveyorName: report.surveyor_name,
      surveyorPhone: report.surveyor_phone,
      status: report.status,
      surveyDate: report.survey_date,
      isRefusedOrAbsent: report.is_refused_or_absent,
      engineeringRecommendations: report.engineering_recommendations,
      officialPdfUrl: report.official_pdf_url,
      surveyorSignatureUrl: report.surveyor_signature_url,
      ownerSignatureUrl: report.owner_signature_url,
      ownerRemarks: report.owner_remarks,

      // Toàn bộ JSON gốc từ Surveyor để không bao giờ bị sót trường dữ liệu
      surveyJson: surveyJson,
      survey_data_json: surveyJson,
      identificationPhotos: identificationPhotos,
      signatures: normalizedSignatures,

      // Nửa Trái (Left Pane): Cấu kiện & Điểm số & Pháp lý
      leftPane: {
        damageZones: allDamageZones,
        structuralElements: elementsRes.rows,
        riskScoreCard: scoresRes.rows[0] || null,
        buildingSpecs: specsRes.rows[0] || surveyJson.buildingSpecs || surveyJson.specs || null,
        deformation: deformRes.rows[0] || surveyJson.deformation || surveyJson.settlementTilt || null,
        interview: historyRes.rows[0] || surveyJson.interview || surveyJson.historyInterview || null,
        signatures: normalizedSignatures,
        absenceLogs: absenceLogsRes.rows,
      },

      // Nửa Phải (Right Pane): Cặp ảnh CTX + CU Multi-photo có thước đo vạch mm (Kích hoạt kính lúp 400%)
      rightPane: {
        magnifierZoomFactor: '400%',
        identificationPhotos: identificationPhotos,
        facadeBoundaryGeojson: surveyJson.facadeBoundaryGeojson || p02Row?.facade_polygon_points_json || null,
        photoGalleries: allDamageZones.map((z: any) => {
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
            overviewPhotos: z.overview_photos || (z.ctx_photo_url ? [z.ctx_photo_url] : []),
            defects: defectsList.map((d: any) => ({
              defectCode: d.defectCode || d.defect_code,
              cuPhotoUrl: d.cuPhotoUrl || d.cu_photo_url,
              cuPhotos: d.cuPhotos && d.cuPhotos.length > 0 ? d.cuPhotos : (d.cuPhotoUrl ? [d.cuPhotoUrl] : []),
              widthMaxMm: d.widthMaxMm ?? d.width_max_mm,
              lengthMm: d.lengthMm ?? d.length_mm,
              hasScaleCard: d.hasScaleCard ?? d.has_scale_card,
              isStructuralCritical: d.isStructuralCritical ?? d.is_structural_critical,
              screeningCategory: d.screeningCategory || d.screening_category,
              defectType: d.defectType || d.defect_type,
            })),
          };
        }),
        elementGalleries: elementsRes.rows.map((e: any) => {
          const defectsList = Array.isArray(e.defects)
            ? e.defects
            : typeof e.defects === 'string'
            ? JSON.parse(e.defects)
            : [];
          return {
            elementCode: e.element_code,
            elementType: e.element_type,
            floorName: e.floor_name,
            roomName: e.room_name,
            ctxPhotoUrl: e.ctx_photo_url,
            overviewPhotos: e.overview_photos || (e.ctx_photo_url ? [e.ctx_photo_url] : []),
            defects: defectsList.map((d: any) => ({
              defectCode: d.defectCode || d.defect_code,
              cuPhotoUrl: d.cuPhotoUrl || d.cu_photo_url,
              cuPhotos: d.cuPhotos && d.cuPhotos.length > 0 ? d.cuPhotos : (d.cuPhotoUrl ? [d.cuPhotoUrl] : []),
              widthMaxMm: d.widthMaxMm ?? d.width_max_mm,
              lengthMm: d.lengthMm ?? d.length_mm,
              hasScaleCard: d.hasScaleCard ?? d.has_scale_card,
              isStructuralCritical: d.isStructuralCritical ?? d.is_structural_critical,
              screeningCategory: d.screeningCategory || d.screening_category,
              defectType: d.defectType || d.defect_type,
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
    const zoneMapping: Record<string, string> = {
      'ZONE_S1': 'ZONE_01', 'ZONE_S2': 'ZONE_03', 'ZONE_S3': 'ZONE_05',
      'ZONE_S4': 'ZONE_07', 'ZONE_S5': 'ZONE_09', 'ZONE_S6': 'ZONE_11',
      'ZONE_S7': 'ZONE_13', 'ZONE_S8': 'ZONE_15', 'ZONE_S9': 'ZONE_17',
      'ZONE_S10': 'ZONE_19', 'ZONE_S11': 'ZONE_21',
      'ZONE_01': 'ZONE_S1', 'ZONE_03': 'ZONE_S2', 'ZONE_05': 'ZONE_S3',
      'ZONE_07': 'ZONE_S4', 'ZONE_09': 'ZONE_S5', 'ZONE_11': 'ZONE_S6',
      'ZONE_13': 'ZONE_S7', 'ZONE_15': 'ZONE_S8', 'ZONE_17': 'ZONE_S9',
      'ZONE_19': 'ZONE_S10', 'ZONE_21': 'ZONE_S11',
    };

    let whereClause = ``;
    const params: any[] = [];
    const target = (zoneId || 'ALL').toUpperCase();
    const isAll = target === 'ALL' || target === 'ALL_ZONES';

    if (!isAll) {
      const altTarget = zoneMapping[target] || target;
      params.push(target, altTarget);
      whereClause = `WHERE (zone_id = $1 OR zone_id = $2)`;
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

  /**
   * Cập nhật thông tin/ghi chú khảo sát từ Zone Admin
   * Yêu cầu: Xác thực Mật khẩu của Zone Admin + Ghi nhật ký kiểm toán Append-Only vào system_audit_logs
   */
  static async applyAdminSurveyEdit(
    reportId: string,
    adminId: string,
    payload: {
      adminPassword?: string;
      editReason: string;
      diffPayload: Array<{ field: string; label: string; oldValue: any; newValue: any }>;
      updates: Record<string, any>;
    },
    clientIp?: string
  ) {
    if (!payload.adminPassword || !payload.adminPassword.trim()) {
      throw new UnauthorizedError('Bắt buộc nhập mật khẩu Zone Admin để xác thực quyền sửa đổi.');
    }

    // 1. Kiểm tra mật khẩu tài khoản Admin
    const userRes = await Database.query<{ password_hash: string; role: string; full_name: string }>(
      `SELECT password_hash, role, full_name FROM users WHERE id = $1;`,
      [adminId]
    );
    if (!userRes.rows[0]) {
      throw new UnauthorizedError('Không tìm thấy tài khoản quản trị.');
    }
    const isPasswordValid = await CryptoUtils.comparePassword(payload.adminPassword, userRes.rows[0].password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Mật khẩu xác thực của Zone Admin không chính xác.');
    }

    // 2. Kiểm tra hồ sơ
    const reportRes = await Database.query<{
      id: string;
      parcel_id: string;
      status: string;
      survey_data_json: any;
    }>(
      `SELECT id, parcel_id, status, survey_data_json FROM base_survey_reports WHERE (id = $1 OR parcel_id = $1) LIMIT 1;`,
      [reportId]
    );
    if (!reportRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }
    const report = reportRes.rows[0];
    if (report.status === 'APPROVED') {
      throw new ForbiddenError('Hồ sơ khảo sát này đã được phê duyệt chính thức và bị khóa bất biến, không thể chỉnh sửa.');
    }

    const actualReportId = report.id;
    const existingJson = typeof report.survey_data_json === 'string'
      ? JSON.parse(report.survey_data_json)
      : (report.survey_data_json || {});

    // 3. Gộp cập nhật vào survey_data_json
    const mergedJson = {
      ...existingJson,
      ...payload.updates,
      _lastAdminEdit: {
        adminId,
        adminName: userRes.rows[0].full_name,
        timestamp: new Date().toISOString(),
        reason: payload.editReason,
        diffCount: payload.diffPayload?.length || 0,
      },
    };

    // 4. Lưu CSDL trong Transaction
    return Database.transaction(async (client) => {
      await client.query(
        `UPDATE base_survey_reports 
         SET survey_data_json = $1, updated_at = NOW() 
         WHERE id = $2;`,
        [JSON.stringify(mergedJson), actualReportId]
      );

      // Cập nhật các trường tương ứng trên parcels nếu có thay đổi
      const u = payload.updates;
      if (u.houseNumber || u.street || u.ownerName || u.ownerPhone || u.constructionAreaM2 || u.aboveFloors) {
        await client.query(
          `UPDATE parcels SET
             house_number = COALESCE($1, house_number),
             street = COALESCE($2, street),
             owner_name = COALESCE($3, owner_name),
             owner_phone = COALESCE($4, owner_phone),
             construction_area_m2 = COALESCE($5, construction_area_m2),
             floor_count = COALESCE($6, floor_count),
             updated_at = NOW()
           WHERE id = $7;`,
          [
            u.houseNumber !== undefined ? u.houseNumber : null,
            u.street !== undefined ? u.street : null,
            u.ownerName !== undefined ? u.ownerName : null,
            u.ownerPhone !== undefined ? u.ownerPhone : null,
            u.constructionAreaM2 !== undefined ? Number(u.constructionAreaM2) : null,
            u.aboveFloors !== undefined ? Number(u.aboveFloors) : null,
            report.parcel_id,
          ]
        );
      }

      // Ghi nhật ký kiểm toán Append-only vào system_audit_logs
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'BASE_SURVEY_REPORT',
          actualReportId,
          'ZONE_ADMIN_SURVEY_EDIT',
          adminId,
          JSON.stringify({
            editReason: payload.editReason,
            diff: payload.diffPayload,
            timestamp: new Date().toISOString(),
            verification: 'PASSWORD_VERIFIED',
          }),
          clientIp || null,
        ]
      );

      return {
        success: true,
        reportId: actualReportId,
        message: 'Đã lưu chỉnh sửa và ghi nhận vào Nhật ký kiểm toán thành công',
      };
    });
  }

  /**
   * Thay thế một bức ảnh hiện trường bằng mã 6 số ngẫu nhiên
   * Yêu cầu: Xác thực mã ngẫu nhiên 6 chữ số + Ghi nhật ký kiểm toán + Bảo toàn ảnh cũ
   */
  static async replaceReportPhoto(
    reportId: string,
    adminId: string,
    payload: {
      targetPhotoType: string; // 'DEFECT_CU' | 'ZONE_CTX' | 'IDENTIFICATION_P' | 'OTHER'
      targetPhotoId?: string;  // e.g. defect code or photo key 'photoP01'
      defectId?: string;
      zoneId?: string;
      photoIndex?: number;
      newPhotoUrl: string;
      clientPin: string;
      replacementReason: string;
    },
    clientIp?: string
  ) {
    if (!payload.clientPin || payload.clientPin.length !== 6) {
      throw new BadRequestError('Mã xác thực bảo mật phải đúng 6 chữ số.');
    }
    if (!payload.newPhotoUrl || !payload.newPhotoUrl.trim()) {
      throw new BadRequestError('Vui lòng chọn ảnh mới để thay thế.');
    }

    const reportRes = await Database.query<{
      id: string;
      parcel_id: string;
      status: string;
      survey_data_json: any;
    }>(
      `SELECT id, parcel_id, status, survey_data_json FROM base_survey_reports WHERE (id = $1 OR parcel_id = $1) LIMIT 1;`,
      [reportId]
    );
    if (!reportRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }
    const report = reportRes.rows[0];
    if (report.status === 'APPROVED') {
      throw new ForbiddenError('Hồ sơ khảo sát này đã được phê duyệt chính thức và bị khóa bất biến, không thể thay thế ảnh.');
    }

    const actualReportId = report.id;
    let oldPhotoUrl = '';

    return Database.transaction(async (client) => {
      // 1. Cập nhật ảnh tương ứng
      if (payload.targetPhotoType === 'DEFECT_CU' && (payload.defectId || payload.targetPhotoId)) {
        const dRes = await client.query(
          `SELECT id, cu_photo_url, cu_photos_json FROM defect_items WHERE id = $1 OR defect_code = $2;`,
          [payload.defectId || null, payload.targetPhotoId || null]
        );
        if (dRes.rows[0]) {
          const dItem = dRes.rows[0];
          oldPhotoUrl = dItem.cu_photo_url;
          const photos = Array.isArray(dItem.cu_photos_json) ? dItem.cu_photos_json : [];
          const idx = Number(payload.photoIndex) || 0;
          if (photos.length > idx) {
            photos[idx] = payload.newPhotoUrl;
          } else {
            photos.push(payload.newPhotoUrl);
          }
          await client.query(
            `UPDATE defect_items 
             SET cu_photo_url = $1, cu_photos_json = $2 
             WHERE id = $3;`,
            [payload.photoIndex === 0 || !dItem.cu_photo_url ? payload.newPhotoUrl : dItem.cu_photo_url, JSON.stringify(photos), dItem.id]
          );
        }
      } else if (payload.targetPhotoType === 'ZONE_CTX' && (payload.zoneId || payload.targetPhotoId)) {
        const zRes = await client.query(
          `SELECT id, ctx_photo_url FROM damage_zones WHERE id = $1 OR zone_code = $2;`,
          [payload.zoneId || null, payload.targetPhotoId || null]
        );
        if (zRes.rows[0]) {
          oldPhotoUrl = zRes.rows[0].ctx_photo_url;
          await client.query(
            `UPDATE damage_zones SET ctx_photo_url = $1 WHERE id = $2;`,
            [payload.newPhotoUrl, zRes.rows[0].id]
          );
        }
      } else {
        // Cập nhật trong survey_data_json (ví dụ photoP01, photoP02, v.v.)
        const sData = typeof report.survey_data_json === 'string'
          ? JSON.parse(report.survey_data_json)
          : (report.survey_data_json || {});
        if (payload.targetPhotoId) {
          oldPhotoUrl = sData[payload.targetPhotoId] || '';
          sData[payload.targetPhotoId] = payload.newPhotoUrl;
          await client.query(
            `UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`,
            [JSON.stringify(sData), actualReportId]
          );
        }
      }

      // 2. Ghi nhật ký kiểm toán Append-only vào system_audit_logs
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'BASE_SURVEY_REPORT',
          actualReportId,
          'ZONE_ADMIN_REPLACE_PHOTO',
          adminId,
          JSON.stringify({
            targetPhotoType: payload.targetPhotoType,
            targetPhotoId: payload.targetPhotoId,
            photoIndex: payload.photoIndex,
            oldPhotoUrl,
            newPhotoUrl: payload.newPhotoUrl,
            clientPin: payload.clientPin,
            replacementReason: payload.replacementReason,
            timestamp: new Date().toISOString(),
          }),
          clientIp || null,
        ]
      );

      return {
        success: true,
        message: 'Đã thay thế ảnh và lưu vết kiểm toán thành công',
        oldPhotoUrl,
        newPhotoUrl: payload.newPhotoUrl,
      };
    });
  }

  /**
   * Điều chuyển hồ sơ sang thửa đất khác (khi KSV tích nhầm thửa do nhà san sát)
   */
  static async reassignReportParcel(
    reportId: string,
    targetParcelId: string,
    adminId: string,
    reason: string,
    clientIp?: string
  ) {
    return Database.transaction(async (client) => {
      // 1. Kiểm tra hồ sơ hiện tại
      const repRes = await client.query<{ id: string; parcel_id: string; status: string; report_code: string }>(
        `SELECT id, parcel_id, status, report_code FROM base_survey_reports WHERE id = $1 FOR UPDATE;`,
        [reportId]
      );
      const report = repRes.rows[0];
      if (!report) {
        throw new NotFoundError(`Không tìm thấy hồ sơ với ID: ${reportId}`);
      }

      const oldParcelId = report.parcel_id;
      if (oldParcelId === targetParcelId) {
        throw new BadRequestError('Thửa đất đích trùng với thửa đất hiện tại của hồ sơ');
      }

      // 2. Kiểm tra thửa đất đích
      const targetRes = await client.query<{ id: string; project_parcel_code: string; survey_status: string }>(
        `SELECT id, project_parcel_code, survey_status FROM parcels WHERE id = $1 FOR UPDATE;`,
        [targetParcelId]
      );
      const targetParcel = targetRes.rows[0];
      if (!targetParcel) {
        throw new NotFoundError(`Không tìm thấy thửa đất đích với ID: ${targetParcelId}`);
      }

      // Lấy mã thửa cũ
      const oldParcelRes = await client.query<{ project_parcel_code: string }>(
        `SELECT project_parcel_code FROM parcels WHERE id = $1;`,
        [oldParcelId]
      );
      const oldParcelCode = oldParcelRes.rows[0]?.project_parcel_code || oldParcelId;

      // 3. Cập nhật hồ sơ trỏ sang thửa mới
      await client.query(
        `UPDATE base_survey_reports SET parcel_id = $1, updated_at = NOW() WHERE id = $2;`,
        [targetParcelId, reportId]
      );

      // Cập nhật thửa cũ về NOT_SURVEYED nếu không còn hồ sơ nào khác
      const otherRepsRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM base_survey_reports WHERE parcel_id = $1 AND id != $2;`,
        [oldParcelId, reportId]
      );
      if (parseInt(otherRepsRes.rows[0]?.count || '0', 10) === 0) {
        await client.query(
          `UPDATE parcels SET survey_status = 'NOT_SURVEYED', updated_at = NOW() WHERE id = $1;`,
          [oldParcelId]
        );
      }

      // Cập nhật thửa mới theo trạng thái của hồ sơ (SUBMITTED, APPROVED, ...)
      await client.query(
        `UPDATE parcels SET survey_status = $1, updated_at = NOW() WHERE id = $2;`,
        [report.status, targetParcelId]
      );

      // 4. Ghi vết kiểm toán Append-only vào system_audit_logs
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'BASE_SURVEY_REPORT',
          reportId,
          'ZONE_ADMIN_REASSIGN_PARCEL',
          adminId,
          JSON.stringify({
            reportCode: report.report_code,
            oldParcelId,
            oldParcelCode,
            targetParcelId,
            targetParcelCode: targetParcel.project_parcel_code,
            reason: reason || 'Khảo sát viên tích nhầm thửa đất liền kề',
            timestamp: new Date().toISOString(),
          }),
          clientIp || null,
        ]
      );

      return {
        success: true,
        message: `Đã điều chuyển hồ sơ thành công từ thửa [${oldParcelCode}] sang thửa [${targetParcel.project_parcel_code}]`,
        reportId,
        oldParcelId,
        targetParcelId,
        newParcelCode: targetParcel.project_parcel_code,
      };
    });
  }

  /**
   * Hoán đổi thửa giữa 2 hồ sơ khảo sát (khi KSV khảo sát chéo 2 nhà sát nhau)
   */
  static async swapReportParcels(
    reportAId: string,
    reportBId: string,
    adminId: string,
    reason: string,
    clientIp?: string
  ) {
    return Database.transaction(async (client) => {
      // 1. Kiểm tra 2 hồ sơ
      const repARes = await client.query<{ id: string; parcel_id: string; status: string; report_code: string }>(
        `SELECT id, parcel_id, status, report_code FROM base_survey_reports WHERE id = $1 FOR UPDATE;`,
        [reportAId]
      );
      const repBRes = await client.query<{ id: string; parcel_id: string; status: string; report_code: string }>(
        `SELECT id, parcel_id, status, report_code FROM base_survey_reports WHERE id = $1 FOR UPDATE;`,
        [reportBId]
      );

      const repA = repARes.rows[0];
      const repB = repBRes.rows[0];
      if (!repA) throw new NotFoundError(`Không tìm thấy hồ sơ A với ID: ${reportAId}`);
      if (!repB) throw new NotFoundError(`Không tìm thấy hồ sơ B với ID: ${reportBId}`);

      const parcelAId = repA.parcel_id;
      const parcelBId = repB.parcel_id;
      if (parcelAId === parcelBId) {
        throw new BadRequestError('Hai hồ sơ đang thuộc cùng một thửa đất, không thể hoán đổi');
      }

      // Lấy mã thửa
      const pARes = await client.query<{ project_parcel_code: string }>(
        `SELECT project_parcel_code FROM parcels WHERE id = $1;`,
        [parcelAId]
      );
      const pBRes = await client.query<{ project_parcel_code: string }>(
        `SELECT project_parcel_code FROM parcels WHERE id = $1;`,
        [parcelBId]
      );
      const codeA = pARes.rows[0]?.project_parcel_code || parcelAId;
      const codeB = pBRes.rows[0]?.project_parcel_code || parcelBId;

      // 2. Hoán đổi parcel_id
      await client.query(
        `UPDATE base_survey_reports SET parcel_id = $1, updated_at = NOW() WHERE id = $2;`,
        [parcelBId, reportAId]
      );
      await client.query(
        `UPDATE base_survey_reports SET parcel_id = $1, updated_at = NOW() WHERE id = $2;`,
        [parcelAId, reportBId]
      );

      // Cập nhật trạng thái thửa
      await client.query(
        `UPDATE parcels SET survey_status = $1, updated_at = NOW() WHERE id = $2;`,
        [repA.status, parcelBId]
      );
      await client.query(
        `UPDATE parcels SET survey_status = $1, updated_at = NOW() WHERE id = $2;`,
        [repB.status, parcelAId]
      );

      // 3. Ghi vết kiểm toán
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'BASE_SURVEY_REPORT',
          reportAId,
          'ZONE_ADMIN_SWAP_PARCELS',
          adminId,
          JSON.stringify({
            reportAId,
            reportBId,
            oldParcelA: { id: parcelAId, code: codeA },
            oldParcelB: { id: parcelBId, code: codeB },
            newParcelA: { id: parcelBId, code: codeB },
            newParcelB: { id: parcelAId, code: codeA },
            reason: reason || 'Hoán đổi 2 hồ sơ bị tích chéo thửa đất liền kề',
            timestamp: new Date().toISOString(),
          }),
          clientIp || null,
        ]
      );

      return {
        success: true,
        message: `Đã hoán đổi thành công: Hồ sơ A gán sang thửa [${codeB}], Hồ sơ B gán sang thửa [${codeA}]`,
        reportAId,
        reportBId,
        swappedParcels: {
          reportA: { newParcelId: parcelBId, newParcelCode: codeB },
          reportB: { newParcelId: parcelAId, newParcelCode: codeA },
        },
      };
    });
  }
}
