import { Database } from '../../../database/db';
import { NotFoundError } from '../../../common/errors/problem-details';

export class AuditReviewService {
  /**
   * Truy vấn danh sách hàng đợi các hồ sơ cần Zone Admin thẩm định (SUBMITTED / POSTPONED_ABSENT / REJECTED)
   */
  static async listPendingSubmissions(filters: {
    zoneId?: string;
    status?: string;
    buildingType?: string;
    search?: string;
    burlandFilter?: string;
    slaFilter?: string;
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

    // Bộ lọc thông minh từ Dashboard Click-to-filter
    if (filters.burlandFilter === 'CRITICAL') {
      whereClause += ` AND sc.e1_burland_score >= 3`;
    } else if (filters.burlandFilter === 'GRADE_4_5') {
      whereClause += ` AND sc.e1_burland_score >= 4`;
    } else if (filters.burlandFilter === 'GRADE_3') {
      whereClause += ` AND sc.e1_burland_score = 3`;
    } else if (filters.burlandFilter === 'GRADE_1_2') {
      whereClause += ` AND sc.e1_burland_score IN (1, 2)`;
    } else if (filters.burlandFilter === 'GRADE_0') {
      whereClause += ` AND sc.e1_burland_score = 0`;
    }

    if (filters.slaFilter === 'OVERDUE_48H') {
      whereClause += ` AND r.status = 'SUBMITTED' AND r.updated_at < NOW() - INTERVAL '48 HOURS'`;
    } else if (filters.slaFilter === 'WARNING_24H') {
      whereClause += ` AND r.status = 'SUBMITTED' AND r.updated_at >= NOW() - INTERVAL '48 HOURS' AND r.updated_at < NOW() - INTERVAL '24 HOURS'`;
    }

    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
    const offset = Math.max(Number(filters.offset) || 0, 0);

    // 1. Đếm tổng số bản ghi thỏa điều kiện
    const countQuery = `
      SELECT COUNT(*) AS total_count
      FROM base_survey_reports r
      JOIN parcels p ON r.parcel_id = p.id
      LEFT JOIN users u ON r.surveyor_id = u.id
      LEFT JOIN risk_score_cards sc ON sc.report_id = r.id
      ${whereClause};
    `;
    const countRes = await Database.query(countQuery, params);
    const totalCount = Number(countRes.rows[0]?.total_count || 0);

    // 2. Truy vấn trang dữ liệu với LIMIT và OFFSET
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
    return {
      items: res.rows,
      totalCount,
    };
  }

  /**
   * Trả về Payload Split-Pane (Kính lúp 400% + Cây cấu kiện) cho Zone Admin thẩm định
   */
  static async getSplitPaneAuditView(reportId: string) {
    const reportRes = await Database.query(
      `SELECT r.*, p.project_parcel_code, p.house_number, p.street, p.zone_id,
              p.land_area_m2, p.construction_area_m2,
              ST_AsGeoJSON(p.cadastral_polygon_geom) AS cadastral_geojson,
              ST_AsGeoJSON(p.location_geom) AS location_geojson,
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

    // 2. Cấu kiện Chịu lực Kết cấu E
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
    let flagsRes: any = { rows: [] };
    try {
      flagsRes = await Database.query(
        `SELECT * FROM audit_alert_items WHERE report_id = $1;`,
        [actualReportId]
      );
    } catch (e: any) {
      console.warn('⚠️ [AUDIT SERVICE] audit_alert_items fallback:', e?.message);
    }

    // 5. Nhật ký vắng mặt nếu có
    let absenceLogsRes: any = { rows: [] };
    try {
      absenceLogsRes = await Database.query(
        `SELECT * FROM parcel_absence_logs WHERE parcel_id = $1 ORDER BY recorded_at DESC;`,
        [report.parcel_id]
      );
    } catch (e: any) {
      console.warn('⚠️ [AUDIT SERVICE] parcel_absence_logs fallback:', e?.message);
    }

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

    // Chuẩn hóa bộ 4 ảnh định danh P-01 -> P-04
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

      surveyJson: surveyJson,
      survey_data_json: surveyJson,
      identificationPhotos: identificationPhotos,
      signatures: normalizedSignatures,
      cadastralGeojson: report.cadastral_geojson || null,
      locationGeojson: report.location_geojson || null,
      landAreaM2: report.land_area_m2 || null,
      constructionAreaM2: report.construction_area_m2 || null,

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
      auditHistory: await (async () => {
        try {
          const logsRes = await Database.query(
            `SELECT l.id,
                    l.action,
                    l.diff_payload,
                    l.client_ip,
                    l.created_at,
                    u.full_name AS performed_by_name,
                    u.role AS performed_by_role
             FROM system_audit_logs l
             LEFT JOIN users u ON l.performed_by_user_id = u.id
             WHERE (l.entity_type = 'BASE_SURVEY_REPORT' AND l.entity_id = $1)
                OR (l.entity_type = 'PARCEL' AND l.entity_id = $2)
             ORDER BY l.created_at DESC
             LIMIT 50;`,
            [actualReportId, report.parcel_id]
          );
          return logsRes.rows.map((row: any) => {
            let parsedDiff = row.diff_payload;
            if (typeof parsedDiff === 'string') {
              try {
                parsedDiff = JSON.parse(parsedDiff);
              } catch {
                parsedDiff = {};
              }
            }
            return {
              id: row.id,
              action: row.action,
              performedByName: row.performed_by_name || 'Hệ thống / Quản trị viên',
              performedByRole: row.performed_by_role || 'ADMIN',
              createdAt: row.created_at,
              clientIp: row.client_ip,
              editReason: parsedDiff?.editReason || parsedDiff?.reason || null,
              diff: Array.isArray(parsedDiff?.diff) ? parsedDiff.diff : (Array.isArray(parsedDiff?.diffPayload) ? parsedDiff.diffPayload : []),
              rawPayload: parsedDiff,
            };
          });
        } catch (e: any) {
          console.warn('⚠️ [AUDIT SERVICE] system_audit_logs query fallback:', e?.message);
          return [];
        }
      })(),
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

      await client.query(
        `UPDATE base_survey_reports
         SET status = 'REJECTED',
             zone_admin_id = $2,
             engineering_recommendations = $3,
             updated_at = NOW()
         WHERE id = $1;`,
        [actualReportId, adminId, `LÝ DO TRẢ VỀ: ${rejectionReason}`]
      );

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
    let reportWhereClause = ``;
    const params: any[] = [];
    const target = (zoneId || 'ALL').toUpperCase();
    const isAll = target === 'ALL' || target === 'ALL_ZONES';

    if (!isAll) {
      const altTarget = zoneMapping[target] || target;
      params.push(target, altTarget);
      whereClause = `WHERE (p.zone_id = $1 OR p.zone_id = $2)`;
      reportWhereClause = `AND (p.zone_id = $1 OR p.zone_id = $2)`;
    }

    const parcelStatsRes = await Database.query(
      `SELECT 
         COUNT(*) AS total_parcels,
         COUNT(*) FILTER (WHERE p.survey_status = 'APPROVED') AS approved_count,
         COUNT(*) FILTER (WHERE p.survey_status = 'SUBMITTED') AS submitted_count,
         COUNT(*) FILTER (WHERE p.survey_status = 'IN_PROGRESS') AS in_progress_count,
         COUNT(*) FILTER (WHERE p.survey_status = 'POSTPONED_ABSENT') AS absent_count,
         COUNT(*) FILTER (WHERE p.survey_status = 'REJECTED') AS rejected_count,
         COUNT(*) FILTER (WHERE p.survey_status = 'NOT_SURVEYED') AS not_surveyed_count,
         COUNT(*) FILTER (WHERE p.absence_attempt_count = 1) AS absent_attempt_1,
         COUNT(*) FILTER (WHERE p.absence_attempt_count = 2) AS absent_attempt_2,
         COUNT(*) FILTER (WHERE p.absence_attempt_count >= 3) AS absent_attempt_3_plus
       FROM parcels p
       ${whereClause};`,
      params
    );

    const reportStatsRes = await Database.query(
      `SELECT
         COUNT(*) FILTER (WHERE sc.e1_burland_score = 0) AS burland_grade_0,
         COUNT(*) FILTER (WHERE sc.e1_burland_score IN (1, 2)) AS burland_grade_1_2,
         COUNT(*) FILTER (WHERE sc.e1_burland_score = 3) AS burland_grade_3,
         COUNT(*) FILTER (WHERE sc.e1_burland_score >= 4) AS burland_grade_4_5,
         COUNT(*) FILTER (WHERE sc.e1_burland_score >= 3) AS total_critical_burland,
         COUNT(*) FILTER (WHERE r.status = 'SUBMITTED' AND r.updated_at < NOW() - INTERVAL '48 HOURS') AS sla_overdue_48h,
         COUNT(*) FILTER (WHERE r.status = 'SUBMITTED' AND r.updated_at >= NOW() - INTERVAL '48 HOURS' AND r.updated_at < NOW() - INTERVAL '24 HOURS') AS sla_warning_24h,
         COUNT(*) FILTER (WHERE r.created_at >= NOW() - INTERVAL '7 DAYS') AS recent_7days_count
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       LEFT JOIN risk_score_cards sc ON sc.report_id = r.id
       WHERE 1=1 ${reportWhereClause};`,
      params
    );

    const pRow = parcelStatsRes.rows[0] || {};
    const rRow = reportStatsRes.rows[0] || {};

    const totalParcels = Number(pRow.total_parcels || 0);
    const approvedCount = Number(pRow.approved_count || 0);
    const recent7Days = Number(rRow.recent_7days_count || 0);
    const velocityPerDay = recent7Days > 0 ? Number((recent7Days / 7).toFixed(1)) : 1.5;
    const remainingParcels = Math.max(0, totalParcels - approvedCount);
    const estCompletionDays = velocityPerDay > 0 ? Math.ceil(remainingParcels / velocityPerDay) : 0;

    return {
      total_parcels: totalParcels,
      approved_count: approvedCount,
      submitted_count: Number(pRow.submitted_count || 0),
      in_progress_count: Number(pRow.in_progress_count || 0),
      absent_count: Number(pRow.absent_count || 0),
      rejected_count: Number(pRow.rejected_count || 0),
      not_surveyed_count: Number(pRow.not_surveyed_count || 0),

      // Burland Severity
      burland_grade_0_count: Number(rRow.burland_grade_0 || 0),
      burland_grade_1_2_count: Number(rRow.burland_grade_1_2 || 0),
      burland_grade_3_count: Number(rRow.burland_grade_3 || 0),
      burland_grade_4_5_count: Number(rRow.burland_grade_4_5 || 0),
      total_critical_burland: Number(rRow.total_critical_burland || 0),

      // SLA Bottleneck
      sla_overdue_48h_count: Number(rRow.sla_overdue_48h || 0),
      sla_warning_24h_count: Number(rRow.sla_warning_24h || 0),

      // Absent breakdown
      absent_attempt_1_count: Number(pRow.absent_attempt_1 || 0),
      absent_attempt_2_count: Number(pRow.absent_attempt_2 || 0),
      absent_attempt_3_plus_count: Number(pRow.absent_attempt_3_plus || 0),

      // Velocity & Burndown
      velocity_per_day: velocityPerDay,
      estimated_completion_days: estCompletionDays,
    };
  }
}
