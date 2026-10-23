import crypto from 'crypto';
import { Database } from '../../../database/db';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../../../common/errors/problem-details';
import { ReportSnapshotService } from '../../report_v3/report-snapshot.service';
import { RiskScoringCalculator } from '../../report_v2/mappers/risk-scoring-calculator';
import { ReportConsistencyGate } from './report-consistency-gate';

export class AuditReviewService {
  /**
   * Truy vấn danh sách hàng đợi các hồ sơ cần Zone Admin thẩm định (SUBMITTED / POSTPONED_ABSENT / REJECTED)
   */
  static async listPendingSubmissions(filters: {
    zoneId?: string;
    parcelId?: string;
    status?: string;
    buildingType?: string;
    search?: string;
    burlandFilter?: string;
    slaFilter?: string;
    filterLevel?: string;
    limit?: number;
    offset?: number;
  }) {
    const params: any[] = [];
    let whereClause = '';

    if (filters.status && filters.status.toUpperCase() !== 'ALL') {
      params.push(filters.status.toUpperCase());
      whereClause = `WHERE r.status::text = $${params.length}`;
    } else {
      whereClause = `WHERE r.status::text IN ('SUBMITTED', 'UNDER_REVIEW', 'REJECTED', 'APPROVED')`;
    }

    if (filters.zoneId && filters.zoneId.toUpperCase() !== 'ALL' && filters.zoneId.toUpperCase() !== 'ALL_ZONES') {
      params.push(filters.zoneId);
      whereClause += ` AND p.zone_id = $${params.length}`;
    }

    if (filters.parcelId) {
      params.push(filters.parcelId);
      whereClause += ` AND p.id = $${params.length}`;
    }

    if (filters.buildingType && filters.buildingType.toUpperCase() !== 'ALL') {
      params.push(filters.buildingType);
      whereClause += ` AND p.building_type = $${params.length}`;
    }

    // Bộ lọc theo cấp độ cấu trúc khảo sát chung cư / nhà dân / vắng mặt
    if (filters.filterLevel) {
      const level = filters.filterLevel.toUpperCase();
      if (level === 'RESIDENTIAL') {
        whereClause += ` AND (p.building_type NOT IN ('CONDOMINIUM', 'CONDO') OR p.building_type IS NULL) AND r.unit_id IS NULL`;
      } else if (level === 'CONDO_MASTER') {
        whereClause += ` AND p.building_type IN ('CONDOMINIUM', 'CONDO') AND (r.report_type IN ('CONDO_MASTER', 'BUILDING_MASTER') OR r.unit_id IS NULL)`;
      } else if (level === 'MASTER_AREA') {
        whereClause += ` AND (bu.unit_type = 'MASTER' OR bu.unit_code LIKE 'M-%' OR r.report_type = 'MASTER_AREA')`;
      } else if (level === 'CONDO_UNIT') {
        whereClause += ` AND (bu.unit_type = 'UNIT' OR bu.unit_code LIKE 'U-%' OR r.report_type IN ('CONDO_UNIT', 'UNIT_CHILD'))`;
      } else if (level === 'ABSENT') {
        whereClause += ` AND (r.is_refused_or_absent = TRUE OR bu.status::text IN ('POSTPONED_ABSENT', 'POSTPONED_ABSENT_VERIFIED') OR p.survey_status::text IN ('POSTPONED_ABSENT', 'POSTPONED_ABSENT_VERIFIED'))`;
      } else if (level === 'CRITICAL') {
        whereClause += ` AND (sc.e1_burland_score >= 3 OR EXISTS (
          SELECT 1 FROM defect_items d JOIN damage_zones z ON d.zone_id = z.id
          WHERE z.report_id = r.id AND (d.is_structural_critical = TRUE OR d.width_max_mm >= 2.0)
        ))`;
      } else if (level === 'APPROVED') {
        whereClause += ` AND r.status::text = 'APPROVED'`;
      } else if (level === 'PENDING_RELEASE') {
        whereClause += ` AND r.status::text = 'APPROVED' AND (
          (
            EXISTS (SELECT 1 FROM report_releases rr WHERE rr.report_id = r.id AND rr.deleted_at IS NULL)
            AND EXISTS (
              SELECT 1 FROM survey_report_versions v
              WHERE v.report_id = r.id
                AND v.version_tag IN ('APPROVED_RELEASE', 'ADMIN_DIFF_SAVE', 'ROLLBACK_RESTORE')
                AND v.created_at > (SELECT MAX(rr.released_at) FROM report_releases rr WHERE rr.report_id = r.id AND rr.deleted_at IS NULL)
            )
          ) OR (
            NOT EXISTS (SELECT 1 FROM report_releases rr WHERE rr.report_id = r.id AND rr.deleted_at IS NULL)
            AND COALESCE(r.export_revision, 0) = 0
            AND (
              (SELECT COUNT(*) FROM survey_report_versions v WHERE v.report_id = r.id AND v.version_tag = 'APPROVED_RELEASE') > 1
              OR COALESCE((r.survey_data_json->>'hasPendingRelease')::boolean, FALSE) = TRUE
            )
          )
        )`;
      }
    }

    if (filters.search && filters.search.trim()) {
      params.push(`%${filters.search.trim()}%`);
      whereClause += ` AND (
        p.project_parcel_code ILIKE $${params.length} OR
        p.house_number ILIKE $${params.length} OR
        p.street ILIKE $${params.length} OR
        p.owner_name ILIKE $${params.length} OR
        u.full_name ILIKE $${params.length} OR
        bu.unit_code ILIKE $${params.length} OR
        bu.display_code ILIKE $${params.length} OR
        bu.owner_name ILIKE $${params.length}
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
      whereClause += ` AND r.status::text IN ('SUBMITTED', 'UNDER_REVIEW') AND r.updated_at < NOW() - INTERVAL '48 HOURS'`;
    } else if (filters.slaFilter === 'WARNING_24H') {
      whereClause += ` AND r.status::text IN ('SUBMITTED', 'UNDER_REVIEW') AND r.updated_at >= NOW() - INTERVAL '48 HOURS' AND r.updated_at < NOW() - INTERVAL '24 HOURS'`;
    }

    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
    const offset = Math.max(Number(filters.offset) || 0, 0);

    // 1. Đếm tổng số bản ghi thỏa điều kiện
    const countQuery = `
      SELECT COUNT(*) AS total_count
      FROM base_survey_reports r
      JOIN parcels p ON r.parcel_id = p.id
      LEFT JOIN building_units bu ON r.unit_id = bu.id
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
        r.report_type,
        r.unit_id,
        bu.unit_code,
        bu.display_code,
        bu.unit_type,
        bu.floor_number AS unit_floor_number,
        bu.owner_name AS unit_owner_name,
        bu.owner_phone AS unit_owner_phone,
        bu.status::text AS unit_status,
        bu.resident_status AS unit_resident_status,
        p.id AS parcel_id,
        p.project_parcel_code,
        p.project_parcel_code AS parent_parcel_code,
        p.house_number,
        p.street,
        p.zone_id,
        p.building_type,
        p.is_locked AS parent_parcel_is_locked,
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
          WHEN COALESCE((r.survey_data_json->'burlandSummary'->>'localMaxGrade')::int, sc.e1_burland_score, 0) = 0 THEN 'GRADE_0'
          WHEN COALESCE((r.survey_data_json->'burlandSummary'->>'localMaxGrade')::int, sc.e1_burland_score, 0) = 1 THEN 'GRADE_1'
          WHEN COALESCE((r.survey_data_json->'burlandSummary'->>'localMaxGrade')::int, sc.e1_burland_score, 0) = 2 THEN 'GRADE_2'
          WHEN COALESCE((r.survey_data_json->'burlandSummary'->>'localMaxGrade')::int, sc.e1_burland_score, 0) = 3 THEN 'GRADE_3'
          WHEN COALESCE((r.survey_data_json->'burlandSummary'->>'localMaxGrade')::int, sc.e1_burland_score, 0) = 4 THEN 'GRADE_4'
          WHEN COALESCE((r.survey_data_json->'burlandSummary'->>'localMaxGrade')::int, sc.e1_burland_score, 0) >= 5 THEN 'GRADE_5'
          ELSE NULL
        END AS burland_damage_category,
        COALESCE((r.survey_data_json->'burlandSummary'->>'localMaxGrade')::int, sc.e1_burland_score, 0) AS burland_score,
        (
          SELECT MAX(d.width_max_mm)
          FROM defect_items d
          JOIN damage_zones z ON d.zone_id = z.id
          WHERE z.report_id = r.id
            AND (d.is_deleted = FALSE OR d.is_deleted IS NULL)
            AND (z.is_deleted = FALSE OR z.is_deleted IS NULL)
        ) AS burland_max_crack_width_mm,
        sc.total_ecs_score AS ecs_score,
        sc.avg_vi_score AS vi_score,
        (
          SELECT COUNT(*) 
          FROM defect_items d 
          JOIN damage_zones z ON d.zone_id = z.id 
          WHERE z.report_id = r.id
            AND (d.is_deleted = FALSE OR d.is_deleted IS NULL)
            AND (z.is_deleted = FALSE OR z.is_deleted IS NULL)
        ) AS defect_count,
        (
          SELECT COUNT(*) 
          FROM audit_alert_items a 
          WHERE a.report_id = r.id AND a.is_resolved = FALSE
        ) AS alert_count,
        r.approved_at,
        r.engineering_recommendations AS judgement_notes,
        r.engineering_recommendations AS rejection_reason,
        u_admin.full_name AS approver_name,
        u_admin.role AS approver_role,
        p.seal_hash AS parent_parcel_seal_hash,
        p.locked_at AS parent_parcel_locked_at,
        u_lock.full_name AS parent_parcel_locked_by_name,
        COALESCE((
          SELECT MAX(v.version_number)
          FROM survey_report_versions v
          WHERE v.report_id = r.id
        ), 0) AS current_version_number,
        (
          SELECT COUNT(*)
          FROM survey_report_versions v
          WHERE v.report_id = r.id
        ) AS version_count,
        EXISTS (
          SELECT 1
          FROM survey_report_versions v
          WHERE v.report_id = r.id
            AND v.version_tag IN ('ADMIN_DIFF_SAVE', 'ROLLBACK_RESTORE', 'PHOTO_MODIFICATION', 'PHOTO_REPLACEMENT')
        ) AS has_admin_diff,
        (
          SELECT v.version_tag
          FROM survey_report_versions v
          WHERE v.report_id = r.id
          ORDER BY v.version_number DESC
          LIMIT 1
        ) AS latest_version_tag,
        (
          SELECT v.edit_reason
          FROM survey_report_versions v
          WHERE v.report_id = r.id
          ORDER BY v.version_number DESC
          LIMIT 1
        ) AS latest_edit_reason,
        COALESCE(r.export_revision, 0) AS export_revision,
        (
          r.status::text = 'APPROVED' AND (
            (
              EXISTS (SELECT 1 FROM report_releases rr WHERE rr.report_id = r.id AND rr.deleted_at IS NULL)
              AND EXISTS (
                SELECT 1 FROM survey_report_versions v
                WHERE v.report_id = r.id
                  AND v.version_tag IN ('APPROVED_RELEASE', 'ADMIN_DIFF_SAVE', 'ROLLBACK_RESTORE')
                  AND v.created_at > (SELECT MAX(rr.released_at) FROM report_releases rr WHERE rr.report_id = r.id AND rr.deleted_at IS NULL)
              )
            ) OR (
              NOT EXISTS (SELECT 1 FROM report_releases rr WHERE rr.report_id = r.id AND rr.deleted_at IS NULL)
              AND COALESCE(r.export_revision, 0) = 0
              AND (
                (SELECT COUNT(*) FROM survey_report_versions v WHERE v.report_id = r.id AND v.version_tag = 'APPROVED_RELEASE') > 1
                OR COALESCE((r.survey_data_json->>'hasPendingRelease')::boolean, FALSE) = TRUE
              )
            )
          )
        ) AS has_pending_release
      FROM base_survey_reports r
      JOIN parcels p ON r.parcel_id = p.id
      LEFT JOIN building_units bu ON r.unit_id = bu.id
      LEFT JOIN users u ON r.surveyor_id = u.id
      LEFT JOIN users u_admin ON r.zone_admin_id = u_admin.id
      LEFT JOIN users u_lock ON p.locked_by_id = u_lock.id
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
  static async getSplitPaneAuditView(reportId: string, options?: { includePhotoHistory?: boolean }) {
    const reportRes = await Database.query(
      `SELECT r.*, p.project_parcel_code, p.house_number, p.street, p.zone_id,
              p.owner_name, p.owner_phone, p.ward, p.district,
              p.frontage_width, p.lot_depth, p.official_cadastral_code,
              p.land_area_m2, p.construction_area_m2, p.floor_count, p.total_units,
              p.building_type, p.is_locked, p.seal_hash, p.locked_at,
              p.distance_to_centerline_m, p.mutation_type,
              ST_AsGeoJSON(p.cadastral_polygon_geom) AS cadastral_geojson,
              ST_AsGeoJSON(p.location_geom) AS location_geojson,
              u.full_name AS surveyor_name, u.phone AS surveyor_phone
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       LEFT JOIN users u ON r.surveyor_id = u.id
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

    // 0. Truy vấn Sổ cái Vòng đời Ảnh (Photo Lifecycle Registry) để lấy vết phả hệ & lịch sử
    let photoRegistryRows: any[] = [];
    try {
      const regRes = await Database.query(
        `SELECT r.*, u.full_name AS actor_name, d.full_name AS deleted_by_name
         FROM survey_photo_registry r
         LEFT JOIN users u ON r.actor_id = u.id
         LEFT JOIN users d ON r.deleted_by_id = d.id
         WHERE r.report_id = $1
         ORDER BY r.created_at DESC;`,
        [actualReportId]
      );
      photoRegistryRows = regRes.rows;
    } catch (e: any) {
      console.warn('⚠️ [AUDIT REVIEW] survey_photo_registry query fallback:', e?.message);
    }

    const includeHistory = Boolean(options?.includePhotoHistory);

    const getPhotoHistoryFor = (
      codeOrType: string,
      targetId?: string,
      specificUrl?: string
    ) => {
      const cleanKey = (codeOrType || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const matches = photoRegistryRows.filter((r: any) => {
        const rCode = (r.photo_code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const rType = (r.photo_type || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const meta = typeof r.metadata_json === 'object' ? r.metadata_json : {};

        if (specificUrl && (r.photo_url === specificUrl || r.replacement_for_url === specificUrl || r.superseded_by_url === specificUrl)) {
          return true;
        }
        if (targetId && (meta?.defect_id === targetId || meta?.targetPhotoId === targetId || r.photo_code?.includes(targetId))) {
          return true;
        }
        if (cleanKey && (rCode.includes(cleanKey) || rType === cleanKey || cleanKey.includes(rType))) {
          return true;
        }
        return false;
      });

      const historyCount = matches.length;
      const hasHistory = historyCount > 1 || matches.some((m: any) => m.is_deleted || m.status === 'SUPERSEDED' || m.status === 'DELETED');

      return {
        historyCount,
        hasHistory,
        ...(includeHistory
          ? {
              history: matches.map((m: any, idx: number) => ({
                id: m.id,
                version: matches.length - idx,
                url: m.photo_url,
                photoCode: m.photo_code,
                photoType: m.photo_type,
                category: m.photo_category,
                status: m.status,
                isDeleted: Boolean(m.is_deleted),
                actionType: m.action_type,
                actionReason: m.action_reason,
                actorName: m.actor_name || 'Hệ thống / KSV',
                actorRole: m.actor_role,
                createdAt: m.created_at,
                deletedAt: m.deleted_at,
                deletedByName: m.deleted_by_name,
                sha256Hash: m.sha256_hash,
                sizeBytes: m.size_bytes,
                standardizedFilename: m.standardized_filename,
                replacementForUrl: m.replacement_for_url,
                supersededByUrl: m.superseded_by_url,
              })),
            }
          : {}),
      };
    };

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
       LEFT JOIN defect_items d ON z.id = d.zone_id AND (d.is_deleted = false OR d.is_deleted IS NULL)
       WHERE z.report_id = $1 AND (z.is_deleted = false OR z.is_deleted IS NULL) AND (z.zone_code NOT LIKE 'E%' OR z.zone_code IS NULL)
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
       LEFT JOIN defect_items d ON z.id = d.zone_id AND (d.is_deleted = false OR d.is_deleted IS NULL)
       WHERE z.report_id = $1 AND (z.is_deleted = false OR z.is_deleted IS NULL) AND z.zone_code LIKE 'E%'
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
    const p03Row = photosRes.rows.find((p: any) => p.photo_type === 'P03_SIDE_REAR' || p.photo_type === 'P03_SIDE_OR_REAR');
    const p04Row = photosRes.rows.find((p: any) => p.photo_type === 'P04_CONTEXT_STREET');

    const p01Data = surveyJson.photoP01 || {};
    const p02Data = surveyJson.photoP02 || {};
    const p03Data = surveyJson.photoP03 || {};
    const p04Data = surveyJson.photoP04 || {};

    const p01Hist = getPhotoHistoryFor('P01', undefined, p01Data.url || p01Row?.raw_photo_url);
    const p02Hist = getPhotoHistoryFor('P02', undefined, p02Data.url || p02Row?.raw_photo_url);
    const p03Hist = getPhotoHistoryFor('P03', undefined, p03Data.url || p03Row?.raw_photo_url);
    const p04Hist = getPhotoHistoryFor('P04', undefined, p04Data.url || p04Row?.raw_photo_url);

    const isP01Na = Boolean(p01Data.notApplicable ?? p01Data.isNotApplicable ?? p01Row?.is_not_applicable);
    const isP02Na = Boolean(p02Data.notApplicable ?? p02Data.isNotApplicable ?? p02Row?.is_not_applicable);
    const isP03Na = Boolean(p03Data.notApplicable ?? p03Data.isNotApplicable ?? p03Row?.is_not_applicable);
    const isP04Na = Boolean(p04Data.notApplicable ?? p04Data.isNotApplicable ?? p04Row?.is_not_applicable);

    const identificationPhotos = {
      photoP01: {
        url: isP01Na ? null : (p01Data.url !== undefined ? p01Data.url : (p01Row?.annotated_photo_url || p01Row?.raw_photo_url || null)),
        rawUrl: isP01Na ? null : (p01Data.rawPhotoUrl !== undefined ? p01Data.rawPhotoUrl : (p01Row?.raw_photo_url || p01Data.url || null)),
        annotatedUrl: isP01Na ? null : (p01Data.annotatedPhotoUrl !== undefined ? p01Data.annotatedPhotoUrl : (p01Row?.annotated_photo_url || null)),
        photoCode: p01Data.photoCode || p01Row?.photo_code || 'P-01',
        notApplicable: isP01Na,
        naReason: p01Data.naReason || p01Row?.na_reason || null,
        ...p01Hist,
      },
      photoP02: {
        url: isP02Na ? null : (p02Data.url !== undefined ? p02Data.url : (p02Row?.annotated_photo_url || p02Row?.raw_photo_url || null)),
        rawUrl: isP02Na ? null : (p02Data.rawPhotoUrl !== undefined ? p02Data.rawPhotoUrl : (p02Row?.raw_photo_url || p02Data.url || null)),
        annotatedUrl: isP02Na ? null : (p02Data.annotatedPhotoUrl !== undefined ? p02Data.annotatedPhotoUrl : (p02Row?.annotated_photo_url || null)),
        photoCode: p02Data.photoCode || p02Row?.photo_code || 'P-02',
        polygonPoints: p02Data.polygonPoints || p02Row?.facade_polygon_points_json || null,
        floorSplits: p02Data.floorSplits || p02Row?.floor_split_lines_json || null,
        widthM: p02Data.widthM || null,
        heightM: p02Data.heightM || null,
        notApplicable: isP02Na,
        naReason: p02Data.naReason || p02Row?.na_reason || null,
        ...p02Hist,
      },
      photoP03: {
        url: isP03Na ? null : (p03Data.url !== undefined ? p03Data.url : (p03Row?.annotated_photo_url || p03Row?.raw_photo_url || null)),
        rawUrl: isP03Na ? null : (p03Data.rawPhotoUrl !== undefined ? p03Data.rawPhotoUrl : (p03Row?.raw_photo_url || p03Data.url || null)),
        annotatedUrl: isP03Na ? null : (p03Data.annotatedPhotoUrl !== undefined ? p03Data.annotatedPhotoUrl : (p03Row?.annotated_photo_url || null)),
        photoCode: p03Data.photoCode || p03Row?.photo_code || 'P-03',
        tag: p03Data.tag || 'Bên hông phải',
        additionalPhotos: isP03Na ? [] : (Array.isArray(p03Data.additionalPhotos) ? p03Data.additionalPhotos : []),
        notApplicable: isP03Na,
        naReason: p03Data.naReason || p03Row?.na_reason || null,
        ...p03Hist,
      },
      photoP04: {
        url: isP04Na ? null : (p04Data.url !== undefined ? p04Data.url : (p04Row?.annotated_photo_url || p04Row?.raw_photo_url || null)),
        rawUrl: isP04Na ? null : (p04Data.rawPhotoUrl !== undefined ? p04Data.rawPhotoUrl : (p04Row?.raw_photo_url || p04Data.url || null)),
        annotatedUrl: isP04Na ? null : (p04Data.annotatedPhotoUrl !== undefined ? p04Data.annotatedPhotoUrl : (p04Row?.annotated_photo_url || null)),
        photoCode: p04Data.photoCode || p04Row?.photo_code || 'P-04',
        notApplicable: isP04Na,
        naReason: p04Data.naReason || p04Row?.na_reason || null,
        ...p04Hist,
      },
    };

    let allDamageZones = zonesRes.rows;
    if (allDamageZones.length === 0) {
      const extracted: any[] = [];
      const mapDefects = (defects: any[], parentId: string) => {
        return (Array.isArray(defects) ? defects : []).map((d: any) => ({
          id: d.id || `${parentId}_${d.defectCode || d.defect_code}`,
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
        }));
      };

      if (Array.isArray(surveyJson.floors)) {
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
                defects: mapDefects(z.defects, z.id),
              });
            });
          }
          if (Array.isArray(fl.structuralElements)) {
            fl.structuralElements.forEach((e: any) => {
              extracted.push({
                id: e.id,
                zone_code: e.elementCode || e.zone_code || 'E-01',
                floor_name: e.floorName || fl.floorName || 'Tầng trệt',
                room_name: e.roomName || 'Cấu kiện kết cấu',
                component_type: e.elementType || 'Cột BTCT',
                wall_material: e.materialType || 'BTCT',
                ctx_photo_url: e.ctxPhotoUrl || (Array.isArray(e.overviewPhotos) ? e.overviewPhotos[0] : null),
                ctx_photo_code: e.ctxPhotoCode,
                burland_grade: 0,
                functional_impact_repair_needed: Boolean(e.hasDamage || (e.defects && e.defects.length > 0)),
                defects: mapDefects(e.defects, e.id),
              });
            });
          }
        });
      } else {
        // Hỗ trợ cấu trúc phẳng hoặc nhà dân không chia floors (surveyJson.zones hoặc surveyJson.damageZones & surveyJson.structuralElements)
        const flatZones = surveyJson.zones || surveyJson.damageZones;
        if (Array.isArray(flatZones)) {
          flatZones.forEach((z: any) => {
            extracted.push({
              id: z.id || z.zoneCode || z.zone_code,
              zone_code: z.zoneCode || z.zone_code,
              floor_name: z.floorName || `Tầng ${surveyJson.floorNumber || 1}`,
              room_name: z.roomName || z.zoneName || 'Không gian chính',
              component_type: z.componentType || 'Tường',
              wall_material: z.wallMaterial || 'Vữa trát',
              ctx_photo_url: z.ctxPhotoUrl || z.ctx_photo_url || (Array.isArray(z.overviewPhotos) ? z.overviewPhotos[0] : null),
              ctx_photo_code: z.ctxPhotoCode || z.ctx_photo_code,
              burland_grade: z.burlandGrade ?? z.burland_grade ?? 0,
              functional_impact_repair_needed: z.functionalImpactRepairNeeded ?? false,
              defects: mapDefects(z.defects, z.id || z.zoneCode || z.zone_code || 'Z01'),
            });
          });
        }
        if (Array.isArray(surveyJson.structuralElements)) {
          surveyJson.structuralElements.forEach((e: any) => {
            extracted.push({
              id: e.id,
              zone_code: e.elementCode || 'E-01',
              floor_name: e.floorName || `Tầng ${surveyJson.floorNumber || 1}`,
              room_name: e.roomName || 'Cấu kiện kết cấu',
              component_type: e.elementType || 'Cột BTCT',
              wall_material: e.materialType || 'BTCT',
              ctx_photo_url: e.ctxPhotoUrl || (Array.isArray(e.overviewPhotos) ? e.overviewPhotos[0] : null),
              ctx_photo_code: e.ctxPhotoCode,
              burland_grade: 0,
              functional_impact_repair_needed: Boolean(e.hasDamage || (e.defects && e.defects.length > 0)),
              defects: mapDefects(e.defects, e.id),
            });
          });
        }
      }
      allDamageZones = extracted;
    }

    const enrichedDamageZones = allDamageZones.map((z: any) => {
      const zHist = getPhotoHistoryFor(z.zone_code || z.zoneCode, z.id, z.ctx_photo_url);
      const rawDefects = Array.isArray(z.defects) ? z.defects : [];
      const enrichedDefects = rawDefects.map((d: any) => {
        const dHist = getPhotoHistoryFor(d.defectCode || d.defect_code, d.id, d.cuPhotoUrl);
        return {
          ...d,
          photoHistory: dHist,
          historyCount: dHist.historyCount,
          hasHistory: dHist.hasHistory,
          ...(includeHistory ? { history: dHist.history } : {}),
        };
      });
      return {
        ...z,
        ctxPhotoHistory: zHist,
        historyCount: zHist.historyCount,
        hasHistory: zHist.hasHistory,
        ...(includeHistory ? { history: zHist.history } : {}),
        defects: enrichedDefects,
      };
    });

    const enrichedElements = elementsRes.rows.map((e: any) => {
      const eHist = getPhotoHistoryFor(e.zone_code || e.zoneCode, e.id, e.ctx_photo_url);
      const rawDefects = Array.isArray(e.defects) ? e.defects : [];
      const enrichedDefects = rawDefects.map((d: any) => {
        const dHist = getPhotoHistoryFor(d.defectCode || d.defect_code, d.id, d.cuPhotoUrl);
        return {
          ...d,
          photoHistory: dHist,
          historyCount: dHist.historyCount,
          hasHistory: dHist.hasHistory,
          ...(includeHistory ? { history: dHist.history } : {}),
        };
      });
      return {
        ...e,
        ctxPhotoHistory: eHist,
        historyCount: eHist.historyCount,
        hasHistory: eHist.hasHistory,
        ...(includeHistory ? { history: eHist.history } : {}),
        defects: enrichedDefects,
      };
    });

    const sigJson = surveyJson.signatures || {};
    const normalizedSignatures = {
      surveyorSignature: report.surveyor_signature_url || sigJson.preparedBy?.photoUrl || sigJson.surveyorSignatureUrl || null,
      surveyorSignatureUrl: report.surveyor_signature_url || sigJson.preparedBy?.photoUrl || sigJson.surveyorSignatureUrl || null,
      surveyorName: report.surveyor_name || sigJson.preparedBy?.fullName || null,
      ownerSignature: report.owner_signature_url || sigJson.ownerRepresentative?.photoUrl || sigJson.ownerSignatureUrl || null,
      ownerSignatureUrl: report.owner_signature_url || sigJson.ownerRepresentative?.photoUrl || sigJson.ownerSignatureUrl || null,
      ownerName: report.owner_name || surveyJson.ownerName || sigJson.ownerRepresentative?.fullName || null,
      ownerFeedback: report.owner_remarks || sigJson.ownerFeedback || sigJson.ownerRemarks || null,
      workingMinutesPhotos: Array.isArray(sigJson.workingMinutesPhotos) && sigJson.workingMinutesPhotos.length > 0
        ? sigJson.workingMinutesPhotos
        : (Array.isArray(surveyJson.workingMinutesPhotos) ? surveyJson.workingMinutesPhotos : []),
    };

    let unitInfo: any = null;
    let floorPlanInfo: any = null;
    if (report.unit_id) {
      try {
        const uRes = await Database.query(
          `SELECT u.*, fp.cad_photo_url AS floor_cad_url, fp.floor_name
           FROM building_units u
           LEFT JOIN building_floor_plans fp ON u.floor_plan_id = fp.id
           WHERE u.id = $1 AND u.deleted_at IS NULL;`,
          [report.unit_id]
        );
        unitInfo = uRes.rows[0] || null;
        if (unitInfo && !unitInfo.floor_cad_url && unitInfo.floor_number !== undefined) {
          const fpRes = await Database.query(
            `SELECT * FROM building_floor_plans WHERE parcel_id = $1 AND floor_number = $2 AND deleted_at IS NULL LIMIT 1;`,
            [report.parcel_id, unitInfo.floor_number]
          );
          floorPlanInfo = fpRes.rows[0] || null;
        }
      } catch (e: any) {
        console.warn('⚠️ [AUDIT SERVICE] building_units query error:', e?.message);
      }
    }

    if (floorPlanInfo) {
      const cadHist = getPhotoHistoryFor('CAD', floorPlanInfo.id, floorPlanInfo.cad_photo_url);
      floorPlanInfo.cadPhotoHistory = cadHist;
      floorPlanInfo.historyCount = cadHist.historyCount;
      floorPlanInfo.hasHistory = cadHist.hasHistory;
      if (includeHistory) {
        floorPlanInfo.history = cadHist.history;
      }
    }
    if (unitInfo && unitInfo.floor_cad_url) {
      const cadHist = getPhotoHistoryFor('CAD', unitInfo.floor_plan_id, unitInfo.floor_cad_url);
      unitInfo.cadPhotoHistory = cadHist;
      unitInfo.historyCount = cadHist.historyCount;
      unitInfo.hasHistory = cadHist.hasHistory;
      if (includeHistory) {
        unitInfo.history = cadHist.history;
      }
    }

    const auditWarningFlags: Array<{ code: string; level: 'WARNING' | 'INFO'; message: string }> = [];

    // 1. Kiểm tra thước đo tỉ lệ ở ảnh cận cảnh (Scale Card)
    let missingScaleCardCount = 0;
    allDamageZones.forEach((z: any) => {
      const defs = Array.isArray(z.defects) ? z.defects : [];
      defs.forEach((d: any) => {
        if (!d.hasScaleCard && !d.has_scale_card) {
          missingScaleCardCount++;
        }
      });
    });
    if (missingScaleCardCount > 0) {
      auditWarningFlags.push({
        code: 'MISSING_SCALE_CARD',
        level: 'WARNING',
        message: `Phát hiện ${missingScaleCardCount} vị trí khuyết tật chưa chụp kèm thước đo tỉ lệ chuẩn (Scale Card)`,
      });
    }

    // 2. Kiểm tra ảnh định danh
    if (!identificationPhotos.photoP01?.url && !identificationPhotos.photoP01?.notApplicable) {
      auditWarningFlags.push({
        code: 'MISSING_PHOTO_P01',
        level: 'WARNING',
        message: 'Thiếu ảnh số nhà / biển hiệu căn hộ (P-01)',
      });
    }
    if (!report.unit_id && !identificationPhotos.photoP04?.url && !identificationPhotos.photoP04?.notApplicable) {
      auditWarningFlags.push({
        code: 'MISSING_PHOTO_P04',
        level: 'WARNING',
        message: 'Thiếu ảnh ngữ cảnh đường / ngõ tiếp giáp công trình (P-04)',
      });
    }

    // 3. Kiểm tra vắng mặt
    if (report.is_refused_or_absent || report.status === 'POSTPONED_ABSENT') {
      const hasDoorNotice = normalizedSignatures.workingMinutesPhotos.length > 0 ||
        (Array.isArray(surveyJson.doorNoticePhotos) && surveyJson.doorNoticePhotos.length > 0) ||
        Boolean(identificationPhotos.photoP01?.url);
      if (!hasDoorNotice) {
        auditWarningFlags.push({
          code: 'ABSENT_WITHOUT_INVITATION_PHOTO',
          level: 'WARNING',
          message: 'Ca vắng mặt chưa có ảnh dán giấy hẹn / giấy mời khảo sát tại cửa',
        });
      }
    }

    // 4. Kiểm tra nứt lớn chưa đánh dấu kết cấu
    let unmarkedCriticalCracks = 0;
    allDamageZones.forEach((z: any) => {
      const defs = Array.isArray(z.defects) ? z.defects : [];
      defs.forEach((d: any) => {
        const width = Number(d.widthMaxMm ?? d.width_max_mm ?? 0);
        const isCritical = Boolean(d.isStructuralCritical ?? d.is_structural_critical);
        if (width >= 2.0 && !isCritical) {
          unmarkedCriticalCracks++;
        }
      });
    });
    if (unmarkedCriticalCracks > 0) {
      auditWarningFlags.push({
        code: 'HIGH_CRACK_WIDTH_UNMARKED',
        level: 'WARNING',
        message: `Có ${unmarkedCriticalCracks} vết nứt bề rộng >= 2.0mm chưa được đánh dấu nguy hiểm kết cấu`,
      });
    }

    // 5. Thấm dột từ tầng trên (căn hộ con)
    if (surveyJson.waterLeakageFromUpperFloor || surveyJson.upperFloorWaterLeakage) {
      auditWarningFlags.push({
        code: 'UPPER_FLOOR_WATER_LEAKAGE',
        level: 'INFO',
        message: 'Căn hộ có ghi nhận hiện tượng thấm dột từ trần / căn hộ tầng trên',
      });
    }

    return {
      reportId: report.id,
      parcelId: report.parcel_id,
      unitId: report.unit_id || null,
      reportType: report.report_type || null,
      unitInfo: unitInfo || null,
      floorPlanInfo: floorPlanInfo || null,
      parentBuildingInfo: {
        id: report.parcel_id,
        projectParcelCode: report.project_parcel_code,
        houseNumber: report.house_number,
        street: report.street,
        buildingType: report.building_type,
        floorCount: report.floor_count,
        totalUnits: report.total_units,
        isLocked: Boolean(report.is_locked),
        sealHash: report.seal_hash,
        lockedAt: report.locked_at,
      },
      auditWarningFlags,
      projectParcelCode: report.project_parcel_code,
      houseNumber: report.house_number || surveyJson.houseNumber,
      street: report.street || surveyJson.street,
      ward: report.ward || surveyJson.ward,
      district: report.district || surveyJson.district,
      ownerName: report.owner_name || surveyJson.ownerName,
      ownerPhone: report.owner_phone || surveyJson.ownerPhone,
      officialCadastralCode: report.official_cadastral_code || surveyJson.officialCadastralCode,
      frontageWidth: report.frontage_width !== null && report.frontage_width !== undefined ? Number(report.frontage_width) : (surveyJson.frontageWidth ?? null),
      lotDepth: report.lot_depth !== null && report.lot_depth !== undefined ? Number(report.lot_depth) : (surveyJson.lotDepth ?? null),
      parcel: {
        id: report.parcel_id,
        projectParcelCode: report.project_parcel_code,
        houseNumber: report.house_number || surveyJson.houseNumber,
        street: report.street || surveyJson.street,
        ward: report.ward || surveyJson.ward,
        district: report.district || surveyJson.district,
        ownerName: report.owner_name || surveyJson.ownerName,
        ownerPhone: report.owner_phone || surveyJson.ownerPhone,
        officialCadastralCode: report.official_cadastral_code || surveyJson.officialCadastralCode,
        frontageWidth: report.frontage_width !== null && report.frontage_width !== undefined ? Number(report.frontage_width) : surveyJson.frontageWidth,
        lotDepth: report.lot_depth !== null && report.lot_depth !== undefined ? Number(report.lot_depth) : surveyJson.lotDepth,
        landAreaM2: report.land_area_m2 !== null && report.land_area_m2 !== undefined ? Number(report.land_area_m2) : surveyJson.landAreaM2,
        constructionAreaM2: report.construction_area_m2 !== null && report.construction_area_m2 !== undefined ? Number(report.construction_area_m2) : surveyJson.constructionAreaM2,
        floorCount: report.floor_count !== null && report.floor_count !== undefined ? Number(report.floor_count) : surveyJson.floorCount,
      },
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
      cadastral_geojson: report.cadastral_geojson || null,
      locationGeojson: report.location_geojson || null,
      landAreaM2: report.land_area_m2 || null,
      constructionAreaM2: report.construction_area_m2 || null,
      distanceToCenterlineM:
        report.distance_to_centerline_m !== null && report.distance_to_centerline_m !== undefined
          ? Number(report.distance_to_centerline_m)
          : null,
      distance_to_centerline_m:
        report.distance_to_centerline_m !== null && report.distance_to_centerline_m !== undefined
          ? Number(report.distance_to_centerline_m)
          : null,
      mutationType: report.mutation_type || null,
      mutation_type: report.mutation_type || null,

      leftPane: {
        parcel: {
          id: report.parcel_id,
          projectParcelCode: report.project_parcel_code,
          houseNumber: surveyJson.houseNumber || report.house_number,
          street: surveyJson.street || report.street,
          ward: surveyJson.ward || report.ward,
          district: surveyJson.district || report.district,
          ownerName: surveyJson.ownerName || report.owner_name,
          ownerPhone: surveyJson.ownerPhone || report.owner_phone,
          officialCadastralCode: surveyJson.officialCadastralCode || report.official_cadastral_code,
          frontageWidth: surveyJson.frontageWidth !== undefined && surveyJson.frontageWidth !== null && surveyJson.frontageWidth !== '' ? Number(surveyJson.frontageWidth) : (report.frontage_width !== null && report.frontage_width !== undefined ? Number(report.frontage_width) : null),
          lotDepth: surveyJson.lotDepth !== undefined && surveyJson.lotDepth !== null && surveyJson.lotDepth !== '' ? Number(surveyJson.lotDepth) : (report.lot_depth !== null && report.lot_depth !== undefined ? Number(report.lot_depth) : null),
          landAreaM2: surveyJson.landAreaM2 !== undefined && surveyJson.landAreaM2 !== null && surveyJson.landAreaM2 !== '' ? Number(surveyJson.landAreaM2) : (report.land_area_m2 !== null && report.land_area_m2 !== undefined ? Number(report.land_area_m2) : null),
          constructionAreaM2: surveyJson.constructionAreaM2 !== undefined && surveyJson.constructionAreaM2 !== null && surveyJson.constructionAreaM2 !== '' ? Number(surveyJson.constructionAreaM2) : (report.construction_area_m2 !== null && report.construction_area_m2 !== undefined ? Number(report.construction_area_m2) : null),
          floorCount: surveyJson.aboveFloors !== undefined && surveyJson.aboveFloors !== null && surveyJson.aboveFloors !== '' ? Number(surveyJson.aboveFloors) : (surveyJson.floorCount !== undefined && surveyJson.floorCount !== null && surveyJson.floorCount !== '' ? Number(surveyJson.floorCount) : (report.floor_count !== null && report.floor_count !== undefined ? Number(report.floor_count) : null)),
        },
        damageZones: enrichedDamageZones,
        structuralElements: enrichedElements,
        riskScoreCard: scoresRes.rows[0] || null,
        buildingSpecs: specsRes.rows[0] || surveyJson.buildingSpecs || surveyJson.specs || null,
        deformation: deformRes.rows[0] || surveyJson.deformation || surveyJson.settlementTilt || null,
        interview: historyRes.rows[0] || surveyJson.interview || surveyJson.historyInterview || null,
        identPhotos: photosRes.rows,
        signatures: normalizedSignatures,
        absenceLogs: absenceLogsRes.rows,
      },

      rightPane: {
        magnifierZoomFactor: '400%',
        identificationPhotos: identificationPhotos,
        facadeBoundaryGeojson: surveyJson.facadeBoundaryGeojson || p02Row?.facade_polygon_points_json || null,
        photoGalleries: enrichedDamageZones.map((z: any) => {
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
             WHERE (l.entity_type IN ('BASE_SURVEY_REPORT', 'PARCEL', 'PARCEL_SPATIAL_GEOMETRY', 'BUILDING_UNIT', 'UNIT')
                    AND (l.entity_id = $1::uuid OR l.entity_id = $2::uuid OR ($3::uuid IS NOT NULL AND l.entity_id = $3::uuid)))
             ORDER BY l.created_at DESC
             LIMIT 100;`,
            [actualReportId, report.parcel_id, report.unit_id || null]
          );

          const historyItems = logsRes.rows.map((row: any) => {
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
              performedByRole: row.performed_by_role || 'ZONE_ADMIN',
              createdAt: row.created_at,
              clientIp: row.client_ip,
              editReason: parsedDiff?.editReason || parsedDiff?.reason || parsedDiff?.rejectionReason || parsedDiff?.judgementNotes || parsedDiff?.notes || null,
              diff: Array.isArray(parsedDiff?.diff) ? parsedDiff.diff : (Array.isArray(parsedDiff?.diffPayload) ? parsedDiff.diffPayload : []),
              rawPayload: parsedDiff,
            };
          });

          // Luôn bổ sung mốc thời gian nộp bài khảo sát ban đầu từ Kỹ sư hiện trường
          if (report.created_at || report.survey_date) {
            const hasSubmitLog = historyItems.some((h: any) => h.action === 'SURVEYOR_SUBMIT_REPORT');
            if (!hasSubmitLog) {
              historyItems.push({
                id: `init_${actualReportId}`,
                action: 'SURVEYOR_SUBMIT_REPORT',
                performedByName: report.surveyor_name || 'Kỹ sư khảo sát hiện trường',
                performedByRole: 'SURVEYOR',
                createdAt: report.created_at || report.survey_date,
                clientIp: undefined,
                editReason: 'Hoàn tất biên bản khảo sát hiện trường và nộp hồ sơ lên hệ thống',
                diff: [],
                rawPayload: {
                  surveyDate: report.survey_date,
                  status: report.status,
                  surveyorCode: report.surveyor_code,
                  defectCount: report.defect_count,
                  burlandCategory: report.burland_damage_category,
                },
              });
            }
          }

          // Sắp xếp thời gian giảm dần (mới nhất lên đầu)
          return historyItems.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } catch (e: any) {
          console.warn('⚠️ [AUDIT SERVICE] system_audit_logs query fallback:', e?.message);
          return [];
        }
      })(),
      lockInfo: await (async () => {
        try {
          const lRes = await Database.query<{
            locked_by_user_id: string;
            full_name: string;
            expires_at: string;
          }>(
            `SELECT l.locked_by_user_id, u.full_name, l.expires_at
             FROM survey_audit_locks l
             JOIN users u ON l.locked_by_user_id = u.id
             WHERE l.report_id = $1 AND l.expires_at > NOW();`,
            [actualReportId]
          );
          const l = lRes.rows[0];
          if (!l) return { isLocked: false };
          return {
            isLocked: true,
            lockedByUserId: l.locked_by_user_id,
            lockedByName: l.full_name,
            expiresAt: l.expires_at,
          };
        } catch {
          return { isLocked: false };
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
        unit_id: string | null;
        report_type: string | null;
        status: string;
        export_revision: number;
        survey_data_json: any;
        cadastral_geojson: string | null;
        distance_to_centerline_m: number | null;
        mutation_type: string | null;
      }>(
        `SELECT r.id, r.parcel_id, p.project_parcel_code, r.is_refused_or_absent, r.summary_conclusions, r.current_step, r.unit_id, r.report_type, r.status, r.export_revision, r.survey_data_json,
                ST_AsGeoJSON(p.cadastral_polygon_geom) AS cadastral_geojson, p.distance_to_centerline_m, p.mutation_type
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

      // D1: APPROVED là bản Final – không duyệt lại để tránh chụp lại snapshot ngoài quy trình Rev
      if (repRes.rows[0].status === 'APPROVED') {
        throw new ConflictError('Hồ sơ đã APPROVED. Muốn thay đổi hãy dùng "Phát hành Rev mới" kèm lý do.');
      }

      const reportRow = repRes.rows[0];
      const surveyJson = reportRow.survey_data_json || {};

      // =======================================================================
      // CONSISTENCY GATE: Kiểm tra tính nhất quán dữ liệu trước khi APPROVE
      // =======================================================================
      const { SurveyRepository } = await import('../../survey/survey.repository');
      const fullReportContext = await SurveyRepository.findReportById(actualReportId);
      const gateReportObj = fullReportContext ? { ...fullReportContext, ...reportRow } : reportRow;
      const gateResult = ReportConsistencyGate.assertConsistency(gateReportObj, surveyJson, judgementNotes);

      // Lấy revision hiện tại của hồ sơ (không tự ý tăng khi duyệt lại; Rev chỉ tăng khi chủ động bấm "Phát hành Rev mới")
      const currentRev = repRes.rows[0].export_revision ?? 0;
      const prevApprovedCountRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM survey_report_versions WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE';`,
        [actualReportId]
      );
      const isReApproval = Number(prevApprovedCountRes.rows[0]?.count || 0) > 0;

      // official_pdf_url chỉ được gán khi có file thật (ReportReleaseService), không dùng URL giả
      const approveRes = await client.query<{ approved_at: Date }>(
        `UPDATE base_survey_reports
         SET status = 'APPROVED',
             zone_admin_id = $2,
             approved_at = NOW(),
             engineering_recommendations = COALESCE($3, engineering_recommendations),
             export_revision = $4,
             updated_at = NOW()
         WHERE id = $1
         RETURNING approved_at;`,
        [actualReportId, adminId, judgementNotes || null, currentRev]
      );

      // D1/D3: chụp snapshot điểm bất biến (APPROVED_RELEASE + SHA-256) trong CÙNG transaction với APPROVE
      const approvedSnapshot = await ReportSnapshotService.writeApprovedRelease(
        client,
        actualReportId,
        adminId,
        approveRes.rows[0].approved_at,
        isReApproval ? `Phê duyệt lại số liệu sau mở khóa (Hiện hành Rev ${String(currentRev).padStart(2, '0')})` : 'Chốt điểm tại thời điểm APPROVE',
        currentRev
      );

      let parcelApprovedStatus = 'APPROVED';
      if (repRes.rows[0].is_refused_or_absent) {
        parcelApprovedStatus = 'POSTPONED_ABSENT';
      }
      // Lưu ý: 'UNDER_CONSTRUCTION' KHÔNG tồn tại trong parcel_survey_status_enum nên trước đây APPROVE hồ sơ
      // có kết luận 'đang thi công' luôn lỗi 22P02. Hồ sơ vẫn APPROVED; tình trạng thi công nằm trong dữ liệu khảo sát.

      const isChildUnit = Boolean(repRes.rows[0].unit_id) || repRes.rows[0].report_type === 'CONDO_UNIT' || repRes.rows[0].report_type === 'UNIT_CHILD';

      if (isChildUnit && repRes.rows[0].unit_id) {
        // Cập nhật trạng thái căn hộ con thành APPROVED (không ghi đè parcels của cả tòa nhà)
        await client.query(
          `UPDATE building_units
           SET status = 'APPROVED', updated_at = NOW()
           WHERE id = $1;`,
          [repRes.rows[0].unit_id]
        );
      } else {
        // Standalone hoặc Building Master: Cập nhật trạng thái thửa đất
        await client.query(
          `UPDATE parcels SET survey_status = $2, updated_at = NOW() WHERE id = $1;`,
          [actualParcelId, parcelApprovedStatus]
        );
      }

      await client.query(
        `UPDATE audit_alert_items
         SET is_resolved = TRUE, resolved_by_user_id = $2, resolved_at = NOW()
         WHERE report_id = $1;`,
        [actualReportId, adminId]
      );

      // Giải phóng khóa phiên thẩm định
      await client.query(`DELETE FROM survey_audit_locks WHERE report_id = $1;`, [actualReportId]);

      // Ghi nhận nhật ký kiểm toán hệ thống phê duyệt
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload
         ) VALUES ($1, $2, $3, $4, $5);`,
        [
          'BASE_SURVEY_REPORT',
          actualReportId,
          'ZONE_ADMIN_APPROVE_REPORT',
          adminId,
          JSON.stringify({
            reportId: actualReportId,
            parcelId: actualParcelId,
            status: 'APPROVED',
            exportRevision: currentRev,
            isReApproval,
            judgementNotes: judgementNotes || null,
            gateWarnings: gateResult.warnings,
            gateDetails: gateResult.details,
            snapshotVersionId: approvedSnapshot.versionId,
            snapshotSha256: approvedSnapshot.snapshot.contentSha256,
            timestamp: new Date().toISOString(),
          }),
        ]
      );

      return {
        reportId: actualReportId,
        parcelId: actualParcelId,
        status: 'APPROVED',
        exportRevision: currentRev,
        isReApproval,
        snapshotVersionId: approvedSnapshot.versionId,
        snapshotSha256: approvedSnapshot.snapshot.contentSha256,
        message: isReApproval
          ? 'Đã phê duyệt lại báo cáo sau hiệu chỉnh. Số hiệu Rev giữ nguyên, chỉ tăng khi chủ động bấm "Phát hành Rev mới".'
          : 'Đã phê duyệt báo cáo và chốt snapshot điểm (APPROVED_RELEASE). File Final được phát hành khi xuất lần đầu.',
      };
    });
  }

  /**
   * Mở khóa hồ sơ đã APPROVED để cho phép hiệu chỉnh thông tin thửa đất hoặc khảo sát.
   * Chuyển trạng thái về UNDER_REVIEW và giải phóng khóa bảo vệ DB Trigger trên parcels.
   */
  static async unlockApprovedReport(reportId: string, adminId: string) {
    return Database.transaction(async (client) => {
      // 0. KIỂM TRA PHÂN QUYỀN TUYỆT ĐỐI: Chỉ duy nhất SUPER_ADMIN mới có quyền mở khóa hồ sơ đã duyệt (APPROVED)
      const userRes = await client.query<{ id: string; role: string }>(
        `SELECT id, role FROM users WHERE id = $1;`,
        [adminId]
      );
      if (!userRes.rows[0] || userRes.rows[0].role !== 'SUPER_ADMIN') {
        throw new ForbiddenError('Chỉ có Super Admin mới có quyền mở khóa hồ sơ đã được duyệt (APPROVED).');
      }

      const repRes = await client.query<{
        id: string;
        parcel_id: string;
        unit_id: string | null;
        report_type: string | null;
        status: string;
        export_revision: number;
        project_parcel_code: string;
      }>(
        `SELECT r.id, r.parcel_id, r.unit_id, r.report_type, r.status, r.export_revision, p.project_parcel_code
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

      const reportRow = repRes.rows[0];
      if (reportRow.status !== 'APPROVED') {
        throw new ConflictError(`Chỉ hồ sơ ở trạng thái APPROVED mới có thể mở khóa (trạng thái hiện tại: ${reportRow.status}).`);
      }

      const actualReportId = reportRow.id;
      const actualParcelId = reportRow.parcel_id;

      // 1. Chuyển trạng thái báo cáo về UNDER_REVIEW để cho phép chỉnh sửa
      await client.query(
        `UPDATE base_survey_reports
         SET status = 'UNDER_REVIEW',
             updated_at = NOW()
         WHERE id = $1;`,
        [actualReportId]
      );

      // 2. Chuyển trạng thái lô đất/căn hộ con về IN_PROGRESS (giải phóng khóa DB trigger trên parcels)
      const isChildUnit = Boolean(reportRow.unit_id) || reportRow.report_type === 'CONDO_UNIT' || reportRow.report_type === 'UNIT_CHILD';
      if (isChildUnit && reportRow.unit_id) {
        await client.query(
          `UPDATE building_units SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $1;`,
          [reportRow.unit_id]
        );
      } else {
        await client.query(
          `UPDATE parcels SET survey_status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $1;`,
          [actualParcelId]
        );
      }

      // 3. Ghi audit log
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload
         ) VALUES ($1, $2, $3, $4, $5);`,
        [
          'BASE_SURVEY_REPORT',
          actualReportId,
          'SUPER_ADMIN_UNLOCK_APPROVED',
          adminId,
          JSON.stringify({
            reportId: actualReportId,
            parcelId: actualParcelId,
            projectParcelCode: reportRow.project_parcel_code,
            previousStatus: 'APPROVED',
            newStatus: 'UNDER_REVIEW',
            currentRevision: reportRow.export_revision,
            unlockedByRole: 'SUPER_ADMIN',
            timestamp: new Date().toISOString(),
          }),
        ]
      );

      return {
        reportId: actualReportId,
        parcelId: actualParcelId,
        status: 'UNDER_REVIEW',
        projectParcelCode: reportRow.project_parcel_code,
        message: 'Đã mở khóa hồ sơ thành công. Trạng thái hiện tại: UNDER_REVIEW. Bạn có thể cập nhật thông tin thửa đất hoặc khảo sát.',
      };
    });
  }

  static async rejectReport(reportId: string, adminId: string, rejectionReason: string) {
    return Database.transaction(async (client) => {
      const repRes = await client.query<{
        id: string;
        parcel_id: string;
        unit_id: string | null;
        report_type: string | null;
      }>(
        `SELECT id, parcel_id, unit_id, report_type FROM base_survey_reports 
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

      const isChildUnit = Boolean(repRes.rows[0].unit_id) || repRes.rows[0].report_type === 'CONDO_UNIT' || repRes.rows[0].report_type === 'UNIT_CHILD';

      if (isChildUnit && repRes.rows[0].unit_id) {
        await client.query(
          `UPDATE building_units
           SET status = 'REJECTED', updated_at = NOW()
           WHERE id = $1;`,
          [repRes.rows[0].unit_id]
        );
      } else {
        await client.query(
          `UPDATE parcels SET survey_status = 'REJECTED', updated_at = NOW() WHERE id = $1;`,
          [actualParcelId]
        );
      }

      // Giải phóng khóa phiên thẩm định
      await client.query(`DELETE FROM survey_audit_locks WHERE report_id = $1;`, [actualReportId]);

      // Ghi nhận nhật ký kiểm toán hệ thống trả về
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload
         ) VALUES ($1, $2, $3, $4, $5);`,
        [
          'BASE_SURVEY_REPORT',
          actualReportId,
          'ZONE_ADMIN_REJECT_REPORT',
          adminId,
          JSON.stringify({
            reportId: actualReportId,
            parcelId: actualParcelId,
            status: 'REJECTED',
            rejectionReason,
            timestamp: new Date().toISOString(),
          }),
        ]
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

  /**
   * Chuyển trạng thái hồ sơ / căn hộ / thửa đất đã nộp về "Đang làm dở" (DRAFT / IN_PROGRESS)
   * Phục vụ Zone Admin / Super Admin mở lại biểu mẫu để khảo sát viên hoặc admin chỉnh sửa bổ sung thông tin.
   */
  static async revertReportToDraft(
    identifier: string,
    adminId: string,
    reason?: string,
    unitId?: string | null
  ) {
    const result = await Database.transaction(async (client) => {
      let targetUnitId = unitId || null;
      let targetParcelId: string | null = null;
      let targetReportId: string | null = null;

      // 1. Kiểm tra xem identifier hoặc targetUnitId có khớp building_units
      const unitCheck = await client.query<{
        id: string;
        parcel_id: string;
        phase1_report_id: string | null;
      }>(
        `SELECT id, parcel_id, phase1_report_id FROM building_units 
         WHERE id = $1 OR id = $2 
         LIMIT 1;`,
        [identifier, targetUnitId || identifier]
      );

      if (unitCheck.rows[0]) {
        targetUnitId = unitCheck.rows[0].id;
        targetParcelId = unitCheck.rows[0].parcel_id;
        targetReportId = unitCheck.rows[0].phase1_report_id;
      }

      // 2. Tìm trong base_survey_reports nếu chưa có targetReportId
      if (!targetReportId) {
        const repRes = await client.query<{
          id: string;
          parcel_id: string;
          unit_id: string | null;
          report_type: string | null;
        }>(
          `SELECT id, parcel_id, unit_id, report_type FROM base_survey_reports 
           WHERE (id = $1 OR parcel_id = $1 OR unit_id = $1 ${targetUnitId ? 'OR unit_id = $2' : ''})
           ORDER BY (CASE WHEN id = $1 THEN 0 ELSE 1 END), created_at DESC
           LIMIT 1 FOR UPDATE;`,
          targetUnitId ? [identifier, targetUnitId] : [identifier]
        );

        if (repRes.rows[0]) {
          targetReportId = repRes.rows[0].id;
          targetParcelId = targetParcelId || repRes.rows[0].parcel_id;
          if (!targetUnitId && repRes.rows[0].unit_id) {
            targetUnitId = repRes.rows[0].unit_id;
          }
        }
      }

      // 3. Nếu vẫn chưa có targetParcelId, kiểm tra bảng parcels
      if (!targetParcelId && !targetUnitId) {
        const parcelCheck = await client.query<{ id: string }>(
          `SELECT id FROM parcels WHERE id = $1 LIMIT 1;`,
          [identifier]
        );
        if (parcelCheck.rows[0]) {
          targetParcelId = parcelCheck.rows[0].id;
        }
      }

      if (!targetReportId && !targetUnitId && !targetParcelId) {
        throw new NotFoundError(`Không tìm thấy hồ sơ, căn hộ hoặc thửa đất với ID: ${identifier}`);
      }

      const noteText = reason ? `ADMIN MỞ LẠI HỒ SƠ: ${reason}` : 'ADMIN CHUYỂN VỀ ĐANG LÀM DỞ';

      // 4. Cập nhật base_survey_reports về 'DRAFT', reset submitted_at
      if (targetReportId) {
        await client.query(
          `UPDATE base_survey_reports
           SET status = 'DRAFT',
               submitted_at = NULL,
               zone_admin_id = $2,
               is_ready_for_handover = TRUE,
               is_refused_or_absent = FALSE,
               last_edited_by_id = $2,
               engineering_recommendations = COALESCE($3, engineering_recommendations),
               updated_at = NOW()
           WHERE id = $1;`,
          [targetReportId, adminId, noteText]
        );
      }

      // 5. Cập nhật building_units hoặc parcels về 'IN_PROGRESS'
      if (targetUnitId) {
        await client.query(
          `UPDATE building_units
           SET status = 'IN_PROGRESS',
               updated_at = NOW()
           WHERE id = $1;`,
          [targetUnitId]
        );
      } else if (targetParcelId) {
        await client.query(
          `UPDATE parcels
           SET survey_status = 'IN_PROGRESS',
               updated_at = NOW()
           WHERE id = $1;`,
          [targetParcelId]
        );
      }

      return {
        reportId: targetReportId,
        parcelId: targetParcelId,
        unitId: targetUnitId,
        status: 'IN_PROGRESS',
        message: 'Đã chuyển trạng thái hồ sơ về "Đang làm dở" thành công. Khảo sát viên có thể chỉnh sửa thông tin.',
      };
    });

    if (result.reportId) {
      try {
        const { AuditVersionService } = await import('./audit-version.service');
        await AuditVersionService.createSnapshot(result.reportId, {
          versionTag: 'REVERT_TO_DRAFT',
          title: 'Mở lại hồ sơ khảo sát / Chuyển về Làm dở',
          editReason: reason || 'Admin chuyển trạng thái về Đang làm dở',
          userId: adminId,
        });
      } catch (snapErr) {
        console.error('[revertReportToDraft] Không thể tạo snapshot phiên bản:', snapErr);
      }
    }

    return result;
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
         COUNT(*) FILTER (WHERE r.status IN ('SUBMITTED', 'UNDER_REVIEW') AND r.updated_at < NOW() - INTERVAL '48 HOURS') AS sla_overdue_48h,
         COUNT(*) FILTER (WHERE r.status IN ('SUBMITTED', 'UNDER_REVIEW') AND r.updated_at >= NOW() - INTERVAL '48 HOURS' AND r.updated_at < NOW() - INTERVAL '24 HOURS') AS sla_warning_24h,
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

  /**
   * Phê duyệt hàng loạt an toàn cho các căn hộ đạt Grade 0 hoặc 0 khuyết tật
   */
  static async batchApproveReports(
    reportIds: string[],
    adminId: string,
    judgementNotes?: string
  ): Promise<{
    approvedCount: number;
    failedCount: number;
    results: Array<{ reportId: string; success: boolean; message: string }>;
  }> {
    const results: Array<{ reportId: string; success: boolean; message: string }> = [];
    let approvedCount = 0;
    let failedCount = 0;

    // CHỐT CHẶN BẢO VỆ PHÁP LÝ NHÀ DÂN: CẤM TUYỆT ĐỐI DUYỆT HÀNG LOẠT CHO NHÀ DÂN ĐỘC LẬP
    if (reportIds && reportIds.length > 0) {
      const resCheck = await Database.query<{ id: string }>(
        `SELECT id FROM base_survey_reports
         WHERE id = ANY($1::uuid[]) AND (unit_id IS NULL AND (report_type IS NULL OR report_type != 'CONDO_UNIT'));`,
        [reportIds]
      );
      if (resCheck.rows.length > 0) {
        throw new BadRequestError(
          'Không thể duyệt hàng loạt đối với nhà dân độc lập. Mỗi nhà dân là một tài sản pháp lý riêng biệt, KSV và Thẩm định viên bắt buộc phải thẩm định chi tiết từng căn.'
        );
      }
    }

    for (const reportId of reportIds) {
      try {
        // Kiểm tra điều kiện an toàn: Grade 0 hoặc 0 vết nứt
        const checkRes = await Database.query<{
          id: string;
          status: string;
          unit_id: string | null;
          report_type: string | null;
          burland_score: number | null;
          defect_count: number;
        }>(
          `SELECT r.id, r.status, r.unit_id, r.report_type,
                  COALESCE(sc.e1_burland_score, 0) AS burland_score,
                  (
                    SELECT COUNT(*)
                    FROM defect_items d
                    JOIN damage_zones z ON d.zone_id = z.id
                    WHERE z.report_id = r.id AND d.is_deleted = FALSE AND z.is_deleted = FALSE
                  )::int AS defect_count
           FROM base_survey_reports r
           LEFT JOIN risk_score_cards sc ON sc.report_id = r.id
           WHERE r.id = $1;`,
          [reportId]
        );

        if (!checkRes.rows[0]) {
          failedCount++;
          results.push({ reportId, success: false, message: 'Không tìm thấy hồ sơ' });
          continue;
        }

        const rep = checkRes.rows[0];

        // CHỐT CHẶN BẢO VỆ PHÁP LÝ NHÀ DÂN: CẤM TUYỆT ĐỐI DUYỆT HÀNG LOẠT CHO NHÀ DÂN ĐỘC LẬP
        if (!rep.unit_id && rep.report_type !== 'CONDO_UNIT') {
          failedCount++;
          results.push({
            reportId,
            success: false,
            message: 'CẤM DUYỆT HÀNG LOẠT: Hồ sơ nhà dân là căn cứ pháp lý bồi thường bắt buộc phải mở màn hình Audit Studio để thẩm định chi tiết từng căn.',
          });
          continue;
        }
        if (rep.status !== 'SUBMITTED') {
          failedCount++;
          results.push({
            reportId,
            success: false,
            message: `Hồ sơ ở trạng thái ${rep.status}, chỉ có thể duyệt khi ở trạng thái SUBMITTED`,
          });
          continue;
        }

        if ((rep.burland_score ?? 0) > 0 || rep.defect_count > 0) {
          failedCount++;
          results.push({
            reportId,
            success: false,
            message: `Hồ sơ có khuyết tật (Grade ${rep.burland_score ?? 0}, ${rep.defect_count} vết nứt), yêu cầu thẩm định thủ công`,
          });
          continue;
        }

        // Thực thi phê duyệt an toàn
        await AuditReviewService.approveReport(
          reportId,
          adminId,
          judgementNotes || 'Phê duyệt hàng loạt an toàn (Căn hộ Grade 0)'
        );

        approvedCount++;
        results.push({ reportId, success: true, message: 'Phê duyệt thành công' });
      } catch (err: any) {
        failedCount++;
        results.push({
          reportId,
          success: false,
          message: err?.message || 'Lỗi không xác định khi duyệt',
        });
      }
    }

    return {
      approvedCount,
      failedCount,
      results,
    };
  }

  /**
   * Phê duyệt hồ sơ vắng mặt (Xác nhận vắng mặt hợp lệ -> POSTPONED_ABSENT_VERIFIED)
   */
  static async approveAbsenteeReport(
    reportId: string,
    adminId: string,
    judgementNotes?: string
  ) {
    return Database.transaction(async (client) => {
      const repRes = await client.query<{
        id: string;
        parcel_id: string;
        unit_id: string | null;
        report_type: string | null;
        status: string;
      }>(
        `SELECT id, parcel_id, unit_id, report_type, status
         FROM base_survey_reports
         WHERE id = $1
         FOR UPDATE;`,
        [reportId]
      );

      if (!repRes.rows[0]) {
        throw new NotFoundError(`Không tìm thấy hồ sơ với ID: ${reportId}`);
      }

      const rep = repRes.rows[0];
      const actualReportId = rep.id;
      const actualParcelId = rep.parcel_id;
      const actualUnitId = rep.unit_id;

      // Cập nhật base_survey_reports
      await client.query(
        `UPDATE base_survey_reports
         SET status = 'APPROVED',
             is_refused_or_absent = TRUE,
             zone_admin_id = $2,
             approved_at = NOW(),
             engineering_recommendations = COALESCE($3, engineering_recommendations),
             updated_at = NOW()
         WHERE id = $1;`,
        [actualReportId, adminId, judgementNotes ? `XÁC NHẬN VẮNG MẶT: ${judgementNotes}` : 'Xác nhận hồ sơ vắng mặt hợp lệ']
      );

      // Cập nhật building_units hoặc parcels
      if (actualUnitId) {
        await client.query(
          `UPDATE building_units
           SET status = 'POSTPONED_ABSENT_VERIFIED',
               updated_at = NOW()
           WHERE id = $1;`,
          [actualUnitId]
        );
      } else {
        await client.query(
          `UPDATE parcels
           SET survey_status = 'POSTPONED_ABSENT_VERIFIED',
               updated_at = NOW()
           WHERE id = $1;`,
          [actualParcelId]
        );
      }

      // Đánh dấu đã xử lý cảnh báo nếu có
      await client.query(
        `UPDATE audit_alert_items
         SET is_resolved = TRUE, resolved_by_user_id = $2, resolved_at = NOW()
         WHERE report_id = $1;`,
        [actualReportId, adminId]
      );

      // Xóa bảng điểm rủi ro giả định nếu có (hồ sơ vắng mặt không tính điểm rủi ro)
      await client.query(`DELETE FROM risk_score_cards WHERE report_id = $1;`, [actualReportId]);

      // Chụp snapshot ABSENTEE_VERIFIED chứng cứ vắng mặt
      const maxVerRes = await client.query<{ max_ver: number | null }>(
        `SELECT MAX(version_number) AS max_ver FROM survey_report_versions WHERE report_id = $1;`,
        [actualReportId]
      );
      const nextVer = (maxVerRes.rows[0]?.max_ver ?? -1) + 1;
      await client.query(
        `INSERT INTO survey_report_versions (
           report_id, version_number, version_tag, title, edit_reason, snapshot_data, created_by_user_id
         ) VALUES ($1, $2, 'ABSENTEE_VERIFIED', $3, $4, $5, $6);`,
        [
          actualReportId,
          nextVer,
          'Biên bản Xác nhận Vắng mặt / Từ chối Khảo sát',
          judgementNotes || 'Xác nhận hồ sơ vắng mặt hợp lệ - cơ sở phát hành công văn mời lần 2',
          JSON.stringify({
            reportId: actualReportId,
            parcelId: actualParcelId,
            status: 'POSTPONED_ABSENT_VERIFIED',
            reason: judgementNotes || null,
            isRefusedOrAbsent: true,
            absenteeVerifiedAt: new Date().toISOString(),
          }),
          adminId,
        ]
      );

      // Giải phóng khóa audit session
      await client.query(`DELETE FROM survey_audit_locks WHERE report_id = $1;`, [actualReportId]);

      // Ghi nhật ký hệ thống
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload
         ) VALUES ($1, $2, $3, $4, $5);`,
        [
          actualUnitId ? 'BUILDING_UNIT' : 'BASE_SURVEY_REPORT',
          actualUnitId || actualReportId,
          'APPROVE_ABSENTEE_VERIFIED',
          adminId,
          JSON.stringify({
            reportId: actualReportId,
            unitId: actualUnitId,
            status: 'POSTPONED_ABSENT_VERIFIED',
            judgementNotes: judgementNotes || null,
            timestamp: new Date().toISOString(),
          }),
        ]
      );

      return {
        reportId: actualReportId,
        parcelId: actualParcelId,
        unitId: actualUnitId,
        status: 'APPROVED',
        unitStatus: 'POSTPONED_ABSENT_VERIFIED',
        message: 'Đã xác nhận hồ sơ vắng mặt hợp lệ (POSTPONED_ABSENT_VERIFIED)',
      };
    });
  }

  /**
   * Truy vấn tiến độ tổng thể của Tòa nhà chung cư (Condo Progress Summary)
   * Phục vụ màn hình Khóa Sổ Pháp Lý Toàn Diện & Giám sát tiến độ
   */
  static async getCondoProgressSummary(parcelId: string) {
    // 1. Thông tin tòa mẹ
    const parcelRes = await Database.query<{
      id: string;
      project_parcel_code: string;
      house_number: string;
      street: string;
      zone_id: string;
      building_type: string;
      floor_count: number;
      total_units: number;
      survey_status: string;
      is_locked: boolean;
      locked_at: string | null;
      seal_hash: string | null;
      seal_notes: string | null;
    }>(
      `SELECT id, project_parcel_code, house_number, street, zone_id,
              building_type, floor_count, total_units, survey_status,
              is_locked, locked_at, seal_hash, seal_notes
       FROM parcels
       WHERE id = $1;`,
      [parcelId]
    );

    if (!parcelRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy tòa nhà với ID: ${parcelId}`);
    }

    const parcel = parcelRes.rows[0];

    // 2. Danh sách tất cả các căn hộ và khu vực dùng chung
    const unitsRes = await Database.query<{
      id: string;
      unit_code: string;
      display_code: string;
      unit_type: string;
      floor_number: number;
      status: string;
      owner_name: string | null;
      owner_phone: string | null;
      resident_status: string | null;
      phase1_report_id: string | null;
      report_status: string | null;
      burland_score: number | null;
    }>(
      `SELECT u.id, u.unit_code, u.display_code, u.unit_type, u.floor_number,
              u.status, u.owner_name, u.owner_phone, u.resident_status,
              u.phase1_report_id,
              r.status AS report_status,
              sc.e1_burland_score AS burland_score
       FROM building_units u
       LEFT JOIN base_survey_reports r ON u.phase1_report_id = r.id
       LEFT JOIN risk_score_cards sc ON sc.report_id = r.id
       WHERE u.parcel_id = $1 AND u.deleted_at IS NULL
       ORDER BY u.floor_number ASC, u.unit_code ASC;`,
      [parcelId]
    );

    const allUnits = unitsRes.rows;

    // 3. Phân tách danh sách Căn hộ con và Khu vực dùng chung
    const childUnits = allUnits.filter((u) => u.unit_type === 'UNIT');
    const masterAreas = allUnits.filter((u) => u.unit_type === 'MASTER');

    // Thống kê căn hộ con
    const totalChildUnits = childUnits.length;
    const approvedChildUnits = childUnits.filter((u) => u.status === 'APPROVED').length;
    const absentVerifiedChildUnits = childUnits.filter((u) => u.status === 'POSTPONED_ABSENT_VERIFIED').length;
    const absentPendingChildUnits = childUnits.filter((u) => u.status === 'POSTPONED_ABSENT').length;
    const submittedChildUnits = childUnits.filter((u) => u.status === 'SUBMITTED').length;
    const inProgressChildUnits = childUnits.filter((u) => u.status === 'IN_PROGRESS' || u.status === 'NOT_SURVEYED').length;

    // Thống kê khu vực dùng chung
    const totalMasterAreas = masterAreas.length;
    const approvedMasterAreas = masterAreas.filter((u) => u.status === 'APPROVED').length;
    const submittedMasterAreas = masterAreas.filter((u) => u.status === 'SUBMITTED').length;
    const pendingMasterAreas = masterAreas.filter((u) => u.status !== 'APPROVED').length;

    // Tổng tiến độ
    const totalItems = totalChildUnits + totalMasterAreas;
    const completedItems = approvedChildUnits + absentVerifiedChildUnits + approvedMasterAreas;
    const completionRatePercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    // Đếm vết nứt kết cấu nghiêm trọng (Burland >= 3 hoặc vết nứt >= 2.0mm)
    let criticalCracks = 0;
    try {
      const crackRes = await Database.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM defect_items d
         JOIN damage_zones z ON d.zone_id = z.id
         JOIN base_survey_reports r ON z.report_id = r.id
         WHERE r.parcel_id = $1 AND (d.is_structural_critical = TRUE OR d.width_max_mm >= 2.0);`,
        [parcelId]
      );
      criticalCracks = Number(crackRes.rows[0]?.count || 0);
    } catch (e: any) {
      console.warn('⚠️ [AUDIT SERVICE] criticalCracks query fallback:', e?.message);
    }

    // Danh sách các mục đang cản trở việc Khóa Sổ Pháp Lý (Blocking Items)
    const blockingItems = allUnits
      .filter((u) => u.status !== 'APPROVED' && u.status !== 'POSTPONED_ABSENT_VERIFIED')
      .map((u) => ({
        id: u.id,
        unitCode: u.unit_code,
        displayCode: u.display_code,
        unitType: u.unit_type,
        floorNumber: u.floor_number,
        status: u.status,
        ownerName: u.owner_name,
        reportId: u.phase1_report_id,
        blockingReason:
          u.status === 'POSTPONED_ABSENT'
            ? 'Vắng mặt chưa được Zone Admin thẩm định xác nhận'
            : u.status === 'SUBMITTED'
            ? 'Đang chờ phê duyệt (SUBMITTED)'
            : u.status === 'REJECTED'
            ? 'Hồ sơ bị trả về cần xử lý lại'
            : 'Chưa hoàn thành khảo sát hiện trường',
      }));

    // Báo cáo tòa mẹ (Building Master Report)
    const masterReportRes = await Database.query<{
      id: string;
      status: string;
      updated_at: string;
    }>(
      `SELECT id, status, updated_at
       FROM base_survey_reports
       WHERE parcel_id = $1 AND (unit_id IS NULL OR report_type IN ('CONDO_MASTER', 'BUILDING_MASTER'))
       ORDER BY created_at DESC LIMIT 1;`,
      [parcelId]
    );

    const masterReport = masterReportRes.rows[0] || null;
    const isReadyForFinalSeal = blockingItems.length === 0 && !parcel.is_locked;

    return {
      parcel: {
        id: parcel.id,
        projectParcelCode: parcel.project_parcel_code,
        houseNumber: parcel.house_number,
        street: parcel.street,
        zoneId: parcel.zone_id,
        buildingType: parcel.building_type,
        floorCount: parcel.floor_count,
        totalUnits: parcel.total_units,
        surveyStatus: parcel.survey_status,
        isLocked: Boolean(parcel.is_locked),
        lockedAt: parcel.locked_at,
        sealHash: parcel.seal_hash,
        sealNotes: parcel.seal_notes,
      },
      stats: {
        totalItems,
        completedItems,
        completionRatePercent,
        criticalCracks,
        childUnits: {
          total: totalChildUnits,
          approved: approvedChildUnits,
          absentVerified: absentVerifiedChildUnits,
          absentPending: absentPendingChildUnits,
          submitted: submittedChildUnits,
          inProgress: inProgressChildUnits,
        },
        masterAreas: {
          total: totalMasterAreas,
          approved: approvedMasterAreas,
          submitted: submittedMasterAreas,
          pending: pendingMasterAreas,
        },
      },
      blockingItems,
      isReadyForFinalSeal,
      masterReport,
    };
  }

  /**
   * Thực thi Khóa Sổ Pháp Lý Toàn Diện Tòa Nhà Mẹ (Condo Master Final Seal)
   * Sinh mã băm SHA-256 niêm phong pháp lý, cập nhật parcel sang APPROVED & is_locked = true
   */
  static async executeFinalSeal(
    parcelId: string,
    adminId: string,
    sealNotes?: string
  ) {
    return Database.transaction(async (client) => {
      // 1. Khóa bản ghi tòa mẹ để kiểm tra điều kiện toàn vẹn
      const parcelRes = await client.query<{
        id: string;
        project_parcel_code: string;
        is_locked: boolean;
        survey_status: string;
      }>(
        `SELECT id, project_parcel_code, is_locked, survey_status
         FROM parcels
         WHERE id = $1
         FOR UPDATE;`,
        [parcelId]
      );

      if (!parcelRes.rows[0]) {
        throw new NotFoundError(`Không tìm thấy tòa nhà với ID: ${parcelId}`);
      }

      const parcel = parcelRes.rows[0];
      if (parcel.is_locked) {
        throw new BadRequestError('Tòa nhà đã được Khóa Sổ Pháp Lý trước đó');
      }

      // 2. Kiểm tra xem còn căn hộ hoặc khu vực nào chưa hoàn tất không
      const incompleteRes = await client.query<{
        incomplete_count: string;
      }>(
        `SELECT COUNT(*) AS incomplete_count
         FROM building_units
         WHERE parcel_id = $1
           AND deleted_at IS NULL
           AND status NOT IN ('APPROVED', 'POSTPONED_ABSENT_VERIFIED');`,
        [parcelId]
      );

      const incompleteCount = Number(incompleteRes.rows[0]?.incomplete_count || 0);
      if (incompleteCount > 0) {
        throw new BadRequestError(
          `Không thể khóa sổ: Tòa nhà còn ${incompleteCount} căn hộ hoặc khu vực dùng chung chưa hoàn tất thẩm định (yêu cầu 100% APPROVED hoặc POSTPONED_ABSENT_VERIFIED)`
        );
      }

      // 3. Tính toán mã băm SHA-256 niêm phong pháp lý
      const timestamp = new Date().toISOString();
      const hashPayload = `${parcelId}:${parcel.project_parcel_code}:${adminId}:${timestamp}`;
      const sealHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

      // 4. Cập nhật parcels
      await client.query(
        `UPDATE parcels
         SET survey_status = 'APPROVED',
             is_locked = TRUE,
             locked_at = NOW(),
             locked_by_id = $2,
             seal_hash = $3,
             seal_notes = $4,
             updated_at = NOW()
         WHERE id = $1;`,
        [parcelId, adminId, sealHash, sealNotes || null]
      );

      // 5. Cập nhật báo cáo Master (nếu có)
      await client.query(
        `UPDATE base_survey_reports
         SET status = 'APPROVED',
             zone_admin_id = $2,
             approved_at = NOW(),
             engineering_recommendations = COALESCE($3, engineering_recommendations),
             updated_at = NOW()
         WHERE parcel_id = $1
           AND (unit_id IS NULL OR report_type IN ('CONDO_MASTER', 'BUILDING_MASTER'))
           AND status != 'APPROVED';`,
        [parcelId, adminId, sealNotes ? `NIÊM PHONG PHÁP LÝ: ${sealNotes}` : null]
      );

      // 6. Ghi nhận vào system_audit_logs
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload
         ) VALUES ($1, $2, $3, $4, $5);`,
        [
          'PARCEL',
          parcelId,
          'CONDO_FINAL_LEGAL_SEAL',
          adminId,
          JSON.stringify({
            parcelId,
            projectParcelCode: parcel.project_parcel_code,
            sealHash,
            lockedAt: timestamp,
            notes: sealNotes || null,
          }),
        ]
      );

      return {
        parcelId,
        projectParcelCode: parcel.project_parcel_code,
        status: 'APPROVED',
        isLocked: true,
        sealHash,
        lockedAt: timestamp,
        message: 'Đã hoàn tất Niêm Phong & Khóa Sổ Pháp Lý Toàn Diện Tòa Nhà Mẹ thành công',
      };
    });
  }

  /**
   * Truy vấn danh sách tất cả các Khối Tháp Chung Cư (Condo Towers) trong phân khu / toàn tuyến
   * Đảm bảo hiển thị đầy đủ mọi tháp kể cả khi Master Report đang ở trạng thái DRAFT
   */
  static async listCondoTowers(zoneId?: string) {
    const params: any[] = [];
    let whereClause = `WHERE p.building_type IN ('CONDOMINIUM', 'CONDO')`;

    if (zoneId && zoneId.toUpperCase() !== 'ALL' && zoneId.toUpperCase() !== 'ALL_ZONES') {
      params.push(zoneId.toUpperCase());
      whereClause += ` AND p.zone_id = $${params.length}`;
    }

    const query = `
      SELECT 
        p.id AS parcel_id,
        p.project_parcel_code,
        p.project_parcel_code AS parent_parcel_code,
        p.house_number,
        p.street,
        p.zone_id,
        p.building_type,
        p.floor_count,
        p.total_units,
        p.survey_status AS parcel_status,
        p.is_locked AS parent_parcel_is_locked,
        p.seal_hash AS parent_parcel_seal_hash,
        p.locked_at AS parent_parcel_locked_at,
        u_lock.full_name AS parent_parcel_locked_by_name,
        r.id AS report_id,
        COALESCE(r.status::text, p.survey_status::text) AS status,
        r.report_type,
        r.created_at,
        r.updated_at,
        r.survey_date,
        (
          SELECT COUNT(*)
          FROM building_units bu
          WHERE bu.parcel_id = p.id AND bu.deleted_at IS NULL
        ) AS total_unit_count,
        (
          SELECT COUNT(*)
          FROM building_units bu
          WHERE bu.parcel_id = p.id AND bu.deleted_at IS NULL AND bu.status = 'APPROVED'
        ) AS approved_unit_count,
        (
          SELECT COUNT(*)
          FROM building_units bu
          WHERE bu.parcel_id = p.id AND bu.deleted_at IS NULL AND bu.status = 'SUBMITTED'
        ) AS pending_unit_count
      FROM parcels p
      LEFT JOIN users u_lock ON p.locked_by_id = u_lock.id
      LEFT JOIN LATERAL (
        SELECT r_sub.id, r_sub.status, r_sub.report_type, r_sub.created_at, r_sub.updated_at, r_sub.survey_date
        FROM base_survey_reports r_sub
        WHERE r_sub.parcel_id = p.id AND (r_sub.unit_id IS NULL OR r_sub.report_type IN ('CONDO_MASTER', 'BUILDING_MASTER'))
        ORDER BY r_sub.created_at DESC
        LIMIT 1
      ) r ON true
      ${whereClause}
      ORDER BY p.project_parcel_code ASC;
    `;

    const res = await Database.query(query, params);
    return res.rows;
  }

  /**
   * Truy vấn số lượng chính xác tuyệt đối từ CSDL cho 3 Phân Vùng Thẩm Định:
   * 1. Nhà dân độc lập (Residential Standalone)
   * 2. Khối tháp chung cư (Condo Towers)
   * 3. Hồ sơ cần xử lý khẩn cấp (Real Engineering Urgency: Burland >= 3 hoặc cờ kiểm toán hoặc SLA có khuyết tật)
   */
  static async getScopeCounts(zoneId?: string) {
    const params: any[] = [];
    let zoneFilterParcels = '';
    let zoneFilterReports = '';

    if (zoneId && zoneId.toUpperCase() !== 'ALL' && zoneId.toUpperCase() !== 'ALL_ZONES') {
      params.push(zoneId.toUpperCase());
      zoneFilterParcels = `AND p.zone_id = $${params.length}`;
      zoneFilterReports = `AND p.zone_id = $${params.length}`;
    }

    // 1. Standalone Pending
    const resSql = `
      SELECT COUNT(*) AS count
      FROM base_survey_reports r
      JOIN parcels p ON r.parcel_id = p.id
      WHERE (p.building_type NOT IN ('CONDOMINIUM', 'CONDO') OR p.building_type IS NULL)
        AND r.unit_id IS NULL
        AND r.status::text IN ('SUBMITTED', 'UNDER_REVIEW', 'POSTPONED_ABSENT')
        ${zoneFilterReports};
    `;
    const resCount = await Database.query(resSql, params);

    // 2. Condo Towers
    const towerSql = `
      SELECT COUNT(*) AS count
      FROM parcels p
      WHERE p.building_type IN ('CONDOMINIUM', 'CONDO')
        ${zoneFilterParcels};
    `;
    const towerCount = await Database.query(towerSql, params);

    // 3. Urgent (Burland >= 3 hoặc có cờ kiểm toán hoặc nộp > 48h CÓ KHUYẾT TẬT)
    const urgentSql = `
      SELECT COUNT(DISTINCT r.id) AS count
      FROM base_survey_reports r
      JOIN parcels p ON r.parcel_id = p.id
      LEFT JOIN risk_score_cards sc ON sc.report_id = r.id
      WHERE (
        sc.e1_burland_score >= 3
        OR EXISTS (
          SELECT 1 FROM defect_items d JOIN damage_zones z ON d.zone_id = z.id
          WHERE z.report_id = r.id AND (d.is_structural_critical = TRUE OR d.width_max_mm >= 2.0)
        )
        OR EXISTS (
          SELECT 1 FROM audit_alert_items a
          WHERE a.report_id = r.id AND a.is_resolved = FALSE
        )
        OR (
          r.status::text IN ('SUBMITTED', 'UNDER_REVIEW')
          AND r.updated_at < NOW() - INTERVAL '48 HOURS'
          AND (
            COALESCE(sc.e1_burland_score, 0) >= 1
            OR EXISTS (
              SELECT 1 FROM defect_items d2 JOIN damage_zones z2 ON d2.zone_id = z2.id
              WHERE z2.report_id = r.id
            )
          )
        )
      )
      ${zoneFilterReports};
    `;
    const urgentCount = await Database.query(urgentSql, params);

    return {
      residential: Number(resCount.rows[0]?.count || 0),
      condoTowers: Number(towerCount.rows[0]?.count || 0),
      urgent: Number(urgentCount.rows[0]?.count || 0),
    };
  }
}

