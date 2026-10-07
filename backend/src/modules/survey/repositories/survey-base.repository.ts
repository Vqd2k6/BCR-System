import { Database } from '../../../database/db';
import { PoolClient } from 'pg';
import { SurveyMutationRepository } from './survey-mutation.repository';

export class SurveyBaseRepository {
  private static columnCache = new Map<string, boolean>();

  public static async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    const cacheKey = `${tableName}.${columnName}`;
    if (this.columnCache.has(cacheKey)) {
      return this.columnCache.get(cacheKey)!;
    }
    try {
      // 1. Chủ động thực thi ALTER TABLE thêm cột trước nếu thiếu
      try {
        await Database.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} VARCHAR(150);`);
      } catch {
        // Bỏ qua lỗi DDL nếu user không có quyền ALTER trên remote DB
      }

      // 2. Kiểm tra trực tiếp vào bảng danh mục quan hệ thực tế (regclass) theo đúng search_path hiện tại
      const res = await Database.query(
        `SELECT 1 FROM pg_attribute 
         WHERE attrelid = $1::regclass 
           AND attname = $2 
           AND NOT attisdropped;`,
        [tableName, columnName]
      );
      const exists = !!(res.rows && res.rows.length > 0);
      this.columnCache.set(cacheKey, exists);
      return exists;
    } catch (err) {
      console.warn(`[SurveyBaseRepository] Error verifying column ${columnName} in ${tableName}:`, err);
      this.columnCache.set(cacheKey, false);
      return false;
    }
  }

  static async createBaseReport(data: {
    parcelId: string;
    surveyorId: string;
    reportCode: string;
    phase: 'PHASE_1' | 'PHASE_2';
    unitId?: string;
    parentReportId?: string;
    reportType?: string;
  }): Promise<{ id: string; report_code: string }> {
    const res = await Database.query<{ id: string; report_code: string }>(
      `INSERT INTO base_survey_reports (parcel_id, surveyor_id, report_code, phase, status, current_step, unit_id, parent_report_id, report_type)
       VALUES ($1, $2, $3, $4, 'DRAFT', 1, $5, $6, $7)
       RETURNING id, report_code;`,
      [
        data.parcelId,
        data.surveyorId,
        data.reportCode,
        data.phase,
        data.unitId || null,
        data.parentReportId || null,
        data.reportType || 'STANDALONE',
      ]
    );

    if (data.unitId) {
      if (data.phase === 'PHASE_1') {
        await Database.query(
          `UPDATE building_units SET phase1_report_id = $1, status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $2;`,
          [res.rows[0].id, data.unitId]
        );
      } else {
        await Database.query(
          `UPDATE building_units SET phase2_report_id = $1, status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $2;`,
          [res.rows[0].id, data.unitId]
        );
      }
    }

    return res.rows[0];
  }

  static async findReportById(reportId: string): Promise<any | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId);
    const whereClause = isUuid
      ? `WHERE r.id = $1`
      : `WHERE (r.report_code = $1 OR p.project_parcel_code = $1 OR p.official_cadastral_code = $1)`;

    const res = await Database.query(
      `SELECT r.*,
              p.project_parcel_code, p.official_cadastral_code, p.house_number, p.street, p.ward, p.district,
              COALESCE(bu.owner_name, p.owner_name) AS owner_name,
              COALESCE(bu.owner_phone, p.owner_phone) AS owner_phone,
              bu.unit_code, bu.floor_number AS unit_floor_number,
              p.zone_id, p.building_type, p.segment_type,
              p.land_area_m2, p.construction_area_m2 AS parcel_construction_area_m2, p.floor_count AS parcel_floor_count,
              ms.segment_name AS metro_segment_name,
              ms.construction_type AS metro_construction_type,
              ms.start_chainage_km AS metro_start_chainage,
              ms.end_chainage_km AS metro_end_chainage,
              ROUND(ST_Distance(COALESCE(p.footprint_polygon_geom, p.cadastral_polygon_geom)::geography, ms.centerline_geom::geography)::numeric, 1) AS distance_to_centerline_m,
              ST_AsGeoJSON(COALESCE(p.footprint_polygon_geom, p.cadastral_polygon_geom)) AS parcel_polygon_geojson,
              ROUND((ST_Distance(
                ST_PointN(ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)), 1)::geography,
                ST_PointN(ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)), 2)::geography
              ))::numeric, 1) AS parcel_side_a_m,
              ROUND((ST_Distance(
                ST_PointN(ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)), 2)::geography,
                ST_PointN(ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)), 3)::geography
              ))::numeric, 1) AS parcel_side_b_m,
              u.full_name AS surveyor_name,
              u.phone AS surveyor_phone,
              u.surveyor_code,
              u.signature_image_url AS surveyor_signature_img,
              za.full_name AS zone_admin_name,
              za.signature_image_url AS zone_admin_signature_img,
              COALESCE(sa.full_name, default_sa.full_name) AS super_admin_name,
              COALESCE(sa.signature_image_url, default_sa.signature_image_url) AS super_admin_signature_img
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       LEFT JOIN metro_segments ms ON ms.segment_code = p.zone_id
       LEFT JOIN users u ON r.surveyor_id = u.id
       LEFT JOIN users za ON r.zone_admin_id = za.id
       LEFT JOIN users sa ON za.created_by_user_id = sa.id
       LEFT JOIN LATERAL (
         SELECT full_name, signature_image_url FROM users 
         WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE' 
         ORDER BY created_at ASC LIMIT 1
       ) default_sa ON true
       LEFT JOIN building_units bu ON r.unit_id = bu.id
       ${whereClause} 
       ORDER BY r.created_at DESC 
       LIMIT 1;`,
      [reportId]
    );
    if (!res.rows[0]) return null;
    const base = res.rows[0];
    const actualReportId = base.id;

    // Lấy các bảng chi tiết đính kèm
    const photosRes = await Database.query(
      `SELECT * FROM survey_identification_photos WHERE report_id = $1;`,
      [actualReportId]
    );
    const specsRes = await Database.query(
      `SELECT * FROM building_specifications WHERE report_id = $1;`,
      [actualReportId]
    );
    const historyRes = await Database.query(
      `SELECT * FROM historical_sensitivities WHERE report_id = $1;`,
      [actualReportId]
    );
    const floorsRes = await Database.query(
      `SELECT * FROM floor_surveys WHERE report_id = $1 ORDER BY floor_order ASC;`,
      [actualReportId]
    );
    const zonesRes = await Database.query(
      `SELECT z.*,
              COALESCE(json_agg(d.*) FILTER (WHERE d.id IS NOT NULL), '[]') AS defects
       FROM damage_zones z
       LEFT JOIN defect_items d ON z.id = d.zone_id
       WHERE z.report_id = $1
       GROUP BY z.id;`,
      [actualReportId]
    );
    const deformRes = await Database.query(
      `SELECT * FROM deformation_assessments WHERE report_id = $1;`,
      [actualReportId]
    );
    const scoresRes = await Database.query(
      `SELECT * FROM risk_score_cards WHERE report_id = $1;`,
      [actualReportId]
    );
    const p2DetailsRes = await Database.query(
      `SELECT * FROM phase2_report_details WHERE report_id = $1;`,
      [actualReportId]
    );

    let identificationPhotos = photosRes.rows;
    let buildingSpecs = specsRes.rows[0] || null;

    // Kế thừa P01-P04 và Specs từ Parent Report nếu là UNIT_CHILD
    if (base.parent_report_id) {
      if (identificationPhotos.length === 0) {
        const parentPhotosRes = await Database.query(
          `SELECT * FROM survey_identification_photos WHERE report_id = $1;`,
          [base.parent_report_id]
        );
        identificationPhotos = parentPhotosRes.rows;
      }
      if (!buildingSpecs) {
        const parentSpecsRes = await Database.query(
          `SELECT * FROM building_specifications WHERE report_id = $1;`,
          [base.parent_report_id]
        );
        buildingSpecs = parentSpecsRes.rows[0] || null;
      }
    }

    return {
      ...base,
      identificationPhotos,
      buildingSpecs,
      historicalSensitivity: historyRes.rows[0] || null,
      floorSurveys: floorsRes.rows,
      damageZones: zonesRes.rows,
      deformation: deformRes.rows[0] || null,
      riskScores: scoresRes.rows[0] || null,
      phase2Details: p2DetailsRes.rows[0] || null,
    };
  }

  static async submitReport(reportId: string, submitData: any): Promise<void> {
    await Database.transaction(async (client) => {
      await client.query(
        `UPDATE base_survey_reports
         SET status = 'SUBMITTED',
             submitted_at = NOW(),
             owner_remarks = COALESCE($2, owner_remarks),
             surveyor_signature_url = COALESCE($3, surveyor_signature_url),
             owner_signature_url = COALESCE($4, owner_signature_url),
             summary_conclusions = COALESCE($5, summary_conclusions),
             engineering_recommendations = COALESCE($6, engineering_recommendations),
             survey_data_json = COALESCE($7, survey_data_json),
             updated_at = NOW()
         WHERE id = $1;`,
        [
          reportId,
          submitData.ownerRemarks || null,
          submitData.surveyorSignatureUrl || null,
          submitData.ownerSignatureUrl || null,
          submitData.summaryConclusions || null,
          submitData.engineeringRecommendations || null,
          submitData.surveyDataJson ? (typeof submitData.surveyDataJson === 'string' ? submitData.surveyDataJson : JSON.stringify(submitData.surveyDataJson)) : null,
        ]
      );

      // Cập nhật thông tin thực tế hiện trường vào bảng parcels
      await client.query(
        `UPDATE parcels
         SET house_number = COALESCE($1, house_number),
             street = COALESCE($2, street),
             owner_name = COALESCE($3, owner_name),
             owner_phone = COALESCE($4, owner_phone),
             construction_area_m2 = COALESCE($5, construction_area_m2),
             survey_status = 'SUBMITTED', 
             updated_at = NOW()
         WHERE id = (SELECT parcel_id FROM base_survey_reports WHERE id = $6);`,
        [
          submitData.houseNumber || null,
          submitData.street || null,
          submitData.ownerName || null,
          submitData.ownerPhone || null,
          submitData.constructionAreaM2 !== undefined && submitData.constructionAreaM2 !== null && submitData.constructionAreaM2 !== '' ? Number(submitData.constructionAreaM2) : null,
          reportId,
        ]
      );

      // Nếu là căn hộ con thuộc chung cư (có unit_id), cập nhật luôn thông tin chủ căn hộ vào bảng building_units
      if (submitData.ownerName || submitData.ownerPhone) {
        await client.query(
          `UPDATE building_units
           SET owner_name = COALESCE($1, owner_name),
               owner_phone = COALESCE($2, owner_phone),
               updated_at = NOW()
           WHERE id = (SELECT unit_id FROM base_survey_reports WHERE id = $3 AND unit_id IS NOT NULL);`,
          [
            submitData.ownerName || null,
            submitData.ownerPhone || null,
            reportId,
          ]
        );
      }

      // XỬ LÝ BIẾN ĐỘNG TÁCH/GỘP THỬA THỰC ĐỊA (SPLIT/MERGE FIELD MUTATION)
      try {
        const parsedJson = typeof submitData.surveyDataJson === 'string'
          ? JSON.parse(submitData.surveyDataJson)
          : submitData.surveyDataJson;
        const rawMutation = parsedJson?.gisMutationConfirmed || parsedJson?.gisMutation;
        const mutationType = rawMutation?.type || rawMutation?.details?.activeProposalType || rawMutation?.activeProposalType;
        if (rawMutation && mutationType === 'SPLIT') {
          await SurveyMutationRepository.handleFieldSplitMutation(client, reportId, rawMutation);
        } else if (rawMutation && mutationType === 'MERGE') {
          await SurveyMutationRepository.handleFieldMergeMutation(client, reportId, rawMutation);
        }
      } catch (mutErr: any) {
        console.error('[submitReport] Lỗi xử lý biến động địa chính thực địa:', mutErr);
        const errMsg = mutErr?.message || 'Lỗi không xác định khi xử lý ranh thửa biến động';
        throw new Error(`[Biến động Địa chính] Không thể nộp hồ sơ do lỗi ranh thửa: ${errMsg}`);
      }
    });
  }

  static async updateReportData(reportId: string, updateData: any): Promise<number> {
    let newRevision = 1;
    await Database.transaction(async (client) => {
      // 1. Cập nhật base_survey_reports & tăng export_revision
      const revRes = await client.query(
        `UPDATE base_survey_reports
         SET export_revision = export_revision + 1,
             owner_remarks = COALESCE($2, owner_remarks),
             summary_conclusions = COALESCE($3, summary_conclusions),
             engineering_recommendations = COALESCE($4, engineering_recommendations),
             survey_data_json = COALESCE($5, survey_data_json),
             updated_at = NOW()
         WHERE id = $1
         RETURNING export_revision, parcel_id, unit_id;`,
        [
          reportId,
          updateData.ownerRemarks !== undefined ? updateData.ownerRemarks : null,
          updateData.summaryConclusions !== undefined ? updateData.summaryConclusions : null,
          updateData.engineeringRecommendations !== undefined ? updateData.engineeringRecommendations : null,
          updateData.surveyDataJson ? (typeof updateData.surveyDataJson === 'string' ? updateData.surveyDataJson : JSON.stringify(updateData.surveyDataJson)) : null,
        ]
      );

      if (revRes.rows[0]) {
        newRevision = revRes.rows[0].export_revision;
        const parcelId = revRes.rows[0].parcel_id;
        const unitId = revRes.rows[0].unit_id;

        // 2. Cập nhật thông tin thực tế vào parcels nếu có chỉnh sửa
        if (
          updateData.houseNumber !== undefined ||
          updateData.street !== undefined ||
          updateData.ownerName !== undefined ||
          updateData.ownerPhone !== undefined ||
          updateData.constructionAreaM2 !== undefined
        ) {
          await client.query(
            `UPDATE parcels
             SET house_number = COALESCE($1, house_number),
                 street = COALESCE($2, street),
                 owner_name = COALESCE($3, owner_name),
                 owner_phone = COALESCE($4, owner_phone),
                 construction_area_m2 = COALESCE($5, construction_area_m2),
                 updated_at = NOW()
             WHERE id = $6;`,
            [
              updateData.houseNumber ?? null,
              updateData.street ?? null,
              updateData.ownerName ?? null,
              updateData.ownerPhone ?? null,
              updateData.constructionAreaM2 !== undefined && updateData.constructionAreaM2 !== '' && updateData.constructionAreaM2 !== null
                ? Number(updateData.constructionAreaM2)
                : null,
              parcelId,
            ]
          );
        }

        // 3. Nếu là căn hộ con, cập nhật vào building_units
        if (unitId && (updateData.ownerName !== undefined || updateData.ownerPhone !== undefined)) {
          await client.query(
            `UPDATE building_units
             SET owner_name = COALESCE($1, owner_name),
                 owner_phone = COALESCE($2, owner_phone),
                 updated_at = NOW()
             WHERE id = $3;`,
            [
              updateData.ownerName ?? null,
              updateData.ownerPhone ?? null,
              unitId,
            ]
          );
        }

        // 4. Cập nhật building_specifications nếu có
        if (
          updateData.foundationDepthM !== undefined ||
          updateData.foundationNotes !== undefined ||
          updateData.constructionAreaM2 !== undefined ||
          updateData.buildingHeightM !== undefined ||
          updateData.yearOfConstruction !== undefined ||
          updateData.buildingName !== undefined
        ) {
          await client.query(
            `UPDATE building_specifications
             SET foundation_depth_m = COALESCE($1, foundation_depth_m),
                 foundation_notes = COALESCE($2, foundation_notes),
                 construction_area_m2 = COALESCE($3, construction_area_m2),
                 building_height_m = COALESCE($4, building_height_m),
                 year_of_construction = COALESCE($5, year_of_construction),
                 building_name = COALESCE($6, building_name)
             WHERE report_id = $7;`,
            [
              updateData.foundationDepthM !== undefined && updateData.foundationDepthM !== '' && updateData.foundationDepthM !== '--'
                ? Number(updateData.foundationDepthM)
                : null,
              updateData.foundationNotes ?? null,
              updateData.constructionAreaM2 !== undefined && updateData.constructionAreaM2 !== '' && updateData.constructionAreaM2 !== null
                ? Number(updateData.constructionAreaM2)
                : null,
              updateData.buildingHeightM !== undefined && updateData.buildingHeightM !== '' && updateData.buildingHeightM !== null
                ? Number(updateData.buildingHeightM)
                : null,
              updateData.yearOfConstruction !== undefined && updateData.yearOfConstruction !== '' && updateData.yearOfConstruction !== null
                ? parseInt(String(updateData.yearOfConstruction))
                : null,
              updateData.buildingName ?? null,
              reportId,
            ]
          );
        }
      }
    });

    return newRevision;
  }

  static async findLatestPhase1ReportByParcelId(parcelId: string): Promise<any | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parcelId);
    let resolvedParcelId = parcelId;

    if (!isUuid) {
      const pRes = await Database.query<{ id: string }>(
        `SELECT id FROM parcels WHERE project_parcel_code = $1 OR official_cadastral_code = $1 LIMIT 1;`,
        [parcelId]
      );
      if (!pRes.rows[0]) return null;
      resolvedParcelId = pRes.rows[0].id;
    }

    const reportRes = await Database.query<{ id: string }>(
      `SELECT id FROM base_survey_reports
       WHERE parcel_id = $1 AND phase = 'PHASE_1'
       ORDER BY created_at DESC LIMIT 1;`,
      [resolvedParcelId]
    );

    let report = null;
    if (reportRes.rows[0]) {
      report = await SurveyBaseRepository.findReportById(reportRes.rows[0].id);
    }

    const absenceRes = await Database.query(
      `SELECT * FROM survey_absence_logs
       WHERE parcel_id = $1
       ORDER BY recorded_at DESC LIMIT 1;`,
      [resolvedParcelId]
    );

    const parcelRes = await Database.query(
      `SELECT * FROM parcels WHERE id = $1 LIMIT 1;`,
      [resolvedParcelId]
    );

    return {
      report,
      absenceLog: absenceRes.rows[0] || null,
      parcel: parcelRes.rows[0] || null,
    };
  }

  static async resolveParcelId(parcelId: string): Promise<string | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parcelId);
    if (isUuid) return parcelId;

    const pRes = await Database.query<{ id: string }>(
      `SELECT id FROM parcels WHERE project_parcel_code = $1 OR official_cadastral_code = $1 LIMIT 1;`,
      [parcelId]
    );
    return pRes.rows[0]?.id || null;
  }
}
