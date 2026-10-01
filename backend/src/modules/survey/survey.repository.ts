import { Database } from '../../database/db';
import { PoolClient } from 'pg';
import { CadastralRepository } from '../cadastral/cadastral.repository';
import { normalizeComponentType } from './survey.dto';

export class SurveyRepository {
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
      console.warn(`[SurveyRepository] Error verifying column ${columnName} in ${tableName}:`, err);
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
              p.zone_id, p.building_type,
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
       JOIN users u ON r.surveyor_id = u.id
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


  static async saveIdentificationPhotos(
    reportId: string,
    photos: any
  ): Promise<void> {
    const hasPhotoCode = await this.hasColumn('survey_identification_photos', 'photo_code');

    await Database.transaction(async (client) => {
      // Xóa cũ và ghi mới
      await client.query(`DELETE FROM survey_identification_photos WHERE report_id = $1;`, [reportId]);

      // Safe insert helper branching on verified column schema
      const safeInsert = async (
        photoType: string,
        rawUrl: string | null,
        photoCode: string | null,
        isNa: boolean,
        naReason: string | null = null,
        facadePoly: any = null,
        floorSplits: any = null,
        dimensions: any = null
      ) => {
        if (hasPhotoCode) {
          if (photoType === 'P02_MAIN_FACADE') {
            await client.query(
              `INSERT INTO survey_identification_photos (
                 report_id, photo_type, raw_photo_url, photo_code, facade_polygon_points_json,
                 floor_split_lines_json, dimensions_json, is_not_applicable, na_reason
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
              [
                reportId,
                photoType,
                rawUrl,
                photoCode,
                JSON.stringify(facadePoly || []),
                JSON.stringify(floorSplits || []),
                JSON.stringify(dimensions || {}),
                isNa,
                naReason,
              ]
            );
          } else if (photoType === 'P03_SIDE_OR_REAR') {
            await client.query(
              `INSERT INTO survey_identification_photos (
                 report_id, photo_type, raw_photo_url, photo_code, dimensions_json, is_not_applicable
               ) VALUES ($1, $2, $3, $4, $5, $6);`,
              [reportId, photoType, rawUrl, photoCode, JSON.stringify(dimensions || {}), isNa]
            );
          } else {
            await client.query(
              `INSERT INTO survey_identification_photos (report_id, photo_type, raw_photo_url, photo_code, is_not_applicable, na_reason)
               VALUES ($1, $2, $3, $4, $5, $6);`,
              [reportId, photoType, rawUrl, photoCode, isNa, naReason]
            );
          }
        } else {
          // Schema fallback if photo_code is not present in legacy database
          if (photoType === 'P02_MAIN_FACADE') {
            await client.query(
              `INSERT INTO survey_identification_photos (
                 report_id, photo_type, raw_photo_url, facade_polygon_points_json,
                 floor_split_lines_json, dimensions_json, is_not_applicable, na_reason
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
              [
                reportId,
                photoType,
                rawUrl,
                JSON.stringify(facadePoly || []),
                JSON.stringify(floorSplits || []),
                JSON.stringify(dimensions || {}),
                isNa,
                naReason,
              ]
            );
          } else if (photoType === 'P03_SIDE_OR_REAR') {
            await client.query(
              `INSERT INTO survey_identification_photos (
                 report_id, photo_type, raw_photo_url, dimensions_json, is_not_applicable
               ) VALUES ($1, $2, $3, $4, $5);`,
              [reportId, photoType, rawUrl, JSON.stringify(dimensions || {}), isNa]
            );
          } else {
            await client.query(
              `INSERT INTO survey_identification_photos (report_id, photo_type, raw_photo_url, is_not_applicable, na_reason)
               VALUES ($1, $2, $3, $4, $5);`,
              [reportId, photoType, rawUrl, isNa, naReason]
            );
          }
        }
      };

      // P01
      if (photos.p01HouseNumberUrl || photos.p01NotApplicable) {
        await safeInsert(
          'P01_HOUSE_NUMBER',
          photos.p01HouseNumberUrl || null,
          photos.p01PhotoCode || null,
          photos.p01NotApplicable,
          photos.p01NaReason || null
        );
      }

      // P02 Facade
      if (photos.p02MainFacadeUrl || photos.p02NotApplicable) {
        await safeInsert(
          'P02_MAIN_FACADE',
          photos.p02MainFacadeUrl || null,
          photos.p02PhotoCode || null,
          photos.p02NotApplicable,
          photos.p02NaReason || null,
          photos.p02FacadePolygonPoints,
          photos.p02FloorSplitLines,
          photos.p02Dimensions
        );
      }

      // P03 (Chính)
      if (photos.p03SideRearUrl || photos.p03NotApplicable) {
        await safeInsert(
          'P03_SIDE_OR_REAR',
          photos.p03SideRearUrl || null,
          photos.p03PhotoCode || null,
          photos.p03NotApplicable,
          null,
          null,
          null,
          { tag: photos.p03Tag || 'Bên hông trái' }
        );
      }

      // P03 (Bổ sung nếu có)
      if (Array.isArray(photos.p03AdditionalPhotos) && photos.p03AdditionalPhotos.length > 0) {
        for (const item of photos.p03AdditionalPhotos) {
          if (item?.url) {
            await safeInsert(
              'P03_SIDE_OR_REAR',
              item.url,
              item.photoCode || null,
              false,
              null,
              null,
              null,
              { tag: item.tag || 'Bên hông', isAdditional: true }
            );
          }
        }
      }

      // P04
      if (photos.p04ContextStreetUrl || photos.p04NotApplicable) {
        await safeInsert(
          'P04_CONTEXT_STREET',
          photos.p04ContextStreetUrl || null,
          photos.p04PhotoCode || null,
          photos.p04NotApplicable,
          null
        );
      }

      // Đồng bộ địa chỉ thực tế từ Bước 1 vào thửa đất
      if (photos.houseNumber || photos.street) {
        await client.query(
          `UPDATE parcels SET 
             house_number = COALESCE($1, house_number),
             street = COALESCE($2, street),
             updated_at = NOW()
           WHERE id = (SELECT parcel_id FROM base_survey_reports WHERE id = $3);`,
          [photos.houseNumber || null, photos.street || null, reportId]
        );
      }
    });
  }

  static async saveBuildingSpecs(reportId: string, specs: any): Promise<void> {
    await Database.transaction(async (client) => {
      await client.query(
        `INSERT INTO building_specifications (
           report_id, building_name, building_grade, adjacent_buildings, structural_system,
           floor_count, basement_count, foundation_category, year_of_construction, is_year_estimated,
           construction_area_m2, building_height_m, foundation_source,
           foundation_depth_m, foundation_density, foundation_spacing_m, foundation_notes,
           land_use_function, as_built_drawing_photos_json
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         ON CONFLICT (report_id) DO UPDATE SET
           building_name = EXCLUDED.building_name,
           building_grade = EXCLUDED.building_grade,
           adjacent_buildings = EXCLUDED.adjacent_buildings,
           structural_system = EXCLUDED.structural_system,
           floor_count = EXCLUDED.floor_count,
           basement_count = EXCLUDED.basement_count,
           foundation_category = EXCLUDED.foundation_category,
           year_of_construction = EXCLUDED.year_of_construction,
           is_year_estimated = EXCLUDED.is_year_estimated,
           construction_area_m2 = EXCLUDED.construction_area_m2,
           building_height_m = EXCLUDED.building_height_m,
           foundation_source = EXCLUDED.foundation_source,
           foundation_depth_m = EXCLUDED.foundation_depth_m,
           foundation_density = EXCLUDED.foundation_density,
           foundation_spacing_m = EXCLUDED.foundation_spacing_m,
           foundation_notes = EXCLUDED.foundation_notes,
           land_use_function = EXCLUDED.land_use_function,
           as_built_drawing_photos_json = EXCLUDED.as_built_drawing_photos_json;`,
        [
          reportId,
          specs.buildingName || null,
          specs.buildingGrade || 'GENERAL',
          specs.adjacentBuildings || null,
          specs.structuralSystem || 'KHUNG_BTCT_CHIU_LUC',
          Number(specs.floorCount) || 1,
          Number(specs.basementCount) || 0,
          specs.foundationCategory || 'CAT_2_MONG_DON_BTCT',
          specs.yearOfConstruction || null,
          specs.isYearEstimated ?? false,
          specs.constructionAreaM2 !== undefined && specs.constructionAreaM2 !== null && specs.constructionAreaM2 !== '' ? Number(specs.constructionAreaM2) : null,
          specs.buildingHeightM !== undefined && specs.buildingHeightM !== null && specs.buildingHeightM !== '' ? Number(specs.buildingHeightM) : null,
          specs.foundationSource || null,
          specs.foundationDepthM !== undefined && specs.foundationDepthM !== null && specs.foundationDepthM !== '' ? Number(specs.foundationDepthM) : null,
          specs.foundationDensity !== undefined && specs.foundationDensity !== null && specs.foundationDensity !== '' ? Number(specs.foundationDensity) : null,
          specs.foundationSpacingM !== undefined && specs.foundationSpacingM !== null && specs.foundationSpacingM !== '' ? Number(specs.foundationSpacingM) : null,
          specs.foundationNotes || null,
          specs.landUseFunction || null,
          JSON.stringify(specs.asBuiltDrawingPhotos || []),
        ]
      );

      await client.query(
        `INSERT INTO historical_sensitivities (
           report_id, extended_or_renovated, previous_settlement_or_tilt, fire_or_accident,
           sensitive_equipment_present, details, e5_history_score
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (report_id) DO UPDATE SET
           extended_or_renovated = EXCLUDED.extended_or_renovated,
           previous_settlement_or_tilt = EXCLUDED.previous_settlement_or_tilt,
           fire_or_accident = EXCLUDED.fire_or_accident,
           sensitive_equipment_present = EXCLUDED.sensitive_equipment_present,
           details = EXCLUDED.details,
           e5_history_score = EXCLUDED.e5_history_score;`,
        [
          reportId,
          Boolean(specs.extendedOrRenovated ?? false),
          Boolean(specs.previousSettlementOrTilt ?? false),
          Boolean(specs.fireOrAccident ?? false),
          Boolean(specs.sensitiveEquipmentPresent ?? false),
          specs.historyDetails || specs.details || null,
          Number(specs.e5HistoryScore) || 0,
        ]
      );
    });
  }

  static async createDamageZone(reportId: string, zoneData: any): Promise<any> {
    const hasCtxCode = await this.hasColumn('damage_zones', 'ctx_photo_code');
    if (hasCtxCode) {
      const res = await Database.query(
        `INSERT INTO damage_zones (
           report_id, zone_code, floor_name, room_name, component_type,
           wall_material, functional_impact_repair_needed, burland_grade,
           ctx_photo_url, ctx_photo_code, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *;`,
        [
          reportId,
          zoneData.zoneCode,
          zoneData.floorName,
          zoneData.roomName,
          normalizeComponentType(zoneData.componentType || zoneData.customComponentType),
          zoneData.wallMaterial || null,
          zoneData.functionalImpactRepairNeeded,
          zoneData.burlandGrade,
          zoneData.ctxPhotoUrl,
          zoneData.ctxPhotoCode || null,
          zoneData.notes || null,
        ]
      );
      return res.rows[0];
    } else {
      const res = await Database.query(
        `INSERT INTO damage_zones (
           report_id, zone_code, floor_name, room_name, component_type,
           wall_material, functional_impact_repair_needed, burland_grade,
           ctx_photo_url, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *;`,
        [
          reportId,
          zoneData.zoneCode,
          zoneData.floorName,
          zoneData.roomName,
          normalizeComponentType(zoneData.componentType || zoneData.customComponentType),
          zoneData.wallMaterial || null,
          zoneData.functionalImpactRepairNeeded,
          zoneData.burlandGrade,
          zoneData.ctxPhotoUrl,
          zoneData.notes || null,
        ]
      );
      return res.rows[0];
    }
  }

  static async createDefectItem(zoneId: string, defectData: any): Promise<any> {
    const hasCuCode = await this.hasColumn('defect_items', 'cu_photo_code');
    if (hasCuCode) {
      const res = await Database.query(
        `INSERT INTO defect_items (
           zone_id, defect_code, pin_x, pin_y, screening_category, defect_type,
           crack_direction, width_max_mm, length_mm, activity_state,
           material_degradation_e4, structural_significance_e2, has_scale_card,
           is_structural_critical, cu_photo_url, cu_photo_code
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *;`,
        [
          zoneId,
          defectData.defectCode,
          defectData.pinX,
          defectData.pinY,
          defectData.screeningCategory,
          defectData.defectType,
          defectData.crackDirection || null,
          Number(defectData.widthMaxMm) || 0,
          Number(defectData.lengthMm) || 0,
          defectData.activityState || 'U',
          Number(defectData.materialDegradationE4) || 0,
          Number(defectData.structuralSignificanceE2) || 0,
          defectData.hasScaleCard ?? true,
          defectData.isStructuralCritical ?? false,
          defectData.cuPhotoUrl,
          defectData.cuPhotoCode || null,
        ]
      );
      return res.rows[0];
    } else {
      const res = await Database.query(
        `INSERT INTO defect_items (
           zone_id, defect_code, pin_x, pin_y, screening_category, defect_type,
           crack_direction, width_max_mm, length_mm, activity_state,
           material_degradation_e4, structural_significance_e2, has_scale_card,
           is_structural_critical, cu_photo_url
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *;`,
        [
          zoneId,
          defectData.defectCode,
          defectData.pinX,
          defectData.pinY,
          defectData.screeningCategory,
          defectData.defectType,
          defectData.crackDirection || null,
          Number(defectData.widthMaxMm) || 0,
          Number(defectData.lengthMm) || 0,
          defectData.activityState || 'U',
          Number(defectData.materialDegradationE4) || 0,
          Number(defectData.structuralSignificanceE2) || 0,
          defectData.hasScaleCard ?? true,
          defectData.isStructuralCritical ?? false,
          defectData.cuPhotoUrl,
        ]
      );
      return res.rows[0];
    }
  }

  static async saveDeformation(reportId: string, deform: any): Promise<void> {
    const hasPhotoCodes = await this.hasColumn('deformation_assessments', 'diff_settlement_photo_code');
    if (hasPhotoCodes) {
      await Database.query(
        `INSERT INTO deformation_assessments (
           report_id, tilt_angle_x, tilt_angle_y, tilt_direction, floor_slope_ratio,
           beam_deflection_mm, measurement_method, measurement_reliability,
           diff_settlement_photo_code, tilt_photo_code, abnormal_photo_code,
           diff_settlement_photos_json, tilt_photos_json, abnormal_photos_json
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (report_id) DO UPDATE SET
           tilt_angle_x = EXCLUDED.tilt_angle_x,
           tilt_angle_y = EXCLUDED.tilt_angle_y,
           tilt_direction = EXCLUDED.tilt_direction,
           floor_slope_ratio = EXCLUDED.floor_slope_ratio,
           beam_deflection_mm = EXCLUDED.beam_deflection_mm,
           measurement_method = EXCLUDED.measurement_method,
           measurement_reliability = EXCLUDED.measurement_reliability,
           diff_settlement_photo_code = EXCLUDED.diff_settlement_photo_code,
           tilt_photo_code = EXCLUDED.tilt_photo_code,
           abnormal_photo_code = EXCLUDED.abnormal_photo_code,
           diff_settlement_photos_json = EXCLUDED.diff_settlement_photos_json,
           tilt_photos_json = EXCLUDED.tilt_photos_json,
           abnormal_photos_json = EXCLUDED.abnormal_photos_json;`,
        [
          reportId,
          Number(deform.tiltAngleX) || 0,
          Number(deform.tiltAngleY) || 0,
          deform.tiltDirection ? String(deform.tiltDirection) : null,
          Number(deform.floorSlopeRatio) || 0,
          Number(deform.beamDeflectionMm) || 0,
          deform.measurementMethod || 'LASER_LEVEL',
          deform.measurementReliability || 'HIGH',
          deform.diffSettlementPhotoCode || null,
          deform.tiltPhotoCode || null,
          deform.abnormalPhotoCode || null,
          JSON.stringify(deform.diffSettlementPhotos || []),
          JSON.stringify(deform.tiltPhotos || []),
          JSON.stringify(deform.abnormalPhotos || []),
        ]
      );
    } else {
      await Database.query(
        `INSERT INTO deformation_assessments (
           report_id, tilt_angle_x, tilt_angle_y, tilt_direction, floor_slope_ratio,
           beam_deflection_mm, measurement_method, measurement_reliability,
           diff_settlement_photos_json, tilt_photos_json, abnormal_photos_json
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (report_id) DO UPDATE SET
           tilt_angle_x = EXCLUDED.tilt_angle_x,
           tilt_angle_y = EXCLUDED.tilt_angle_y,
           tilt_direction = EXCLUDED.tilt_direction,
           floor_slope_ratio = EXCLUDED.floor_slope_ratio,
           beam_deflection_mm = EXCLUDED.beam_deflection_mm,
           measurement_method = EXCLUDED.measurement_method,
           measurement_reliability = EXCLUDED.measurement_reliability,
           diff_settlement_photos_json = EXCLUDED.diff_settlement_photos_json,
           tilt_photos_json = EXCLUDED.tilt_photos_json,
           abnormal_photos_json = EXCLUDED.abnormal_photos_json;`,
        [
          reportId,
          Number(deform.tiltAngleX) || 0,
          Number(deform.tiltAngleY) || 0,
          deform.tiltDirection ? String(deform.tiltDirection) : null,
          Number(deform.floorSlopeRatio) || 0,
          Number(deform.beamDeflectionMm) || 0,
          deform.measurementMethod || 'LASER_LEVEL',
          deform.measurementReliability || 'HIGH',
          JSON.stringify(deform.diffSettlementPhotos || []),
          JSON.stringify(deform.tiltPhotos || []),
          JSON.stringify(deform.abnormalPhotos || []),
        ]
      );
    }
  }

  static async saveSurveyScope(reportId: string, scopeData: any): Promise<void> {
    let coverage: 'TOAN_BO' | 'MOT_PHAN' | 'KHONG_THE_TIEP_CAN' = 'TOAN_BO';
    const accType = scopeData?.accessLimitation?.type || scopeData?.type;
    if (accType === 'LIMITED') coverage = 'MOT_PHAN';
    else if (accType === 'ABSENT_REFUSED' || accType === 'ABSENTEE' || scopeData?.isAbsenteeSurvey) coverage = 'KHONG_THE_TIEP_CAN';

    const inaccessible = Array.isArray(scopeData?.accessLimitation?.restrictedAreas) && scopeData.accessLimitation.restrictedAreas.length > 0
      ? scopeData.accessLimitation.restrictedAreas.join(', ')
      : (scopeData?.inaccessibleAreas || null);

    const limitations = scopeData?.accessLimitation?.mainReason
      ? (scopeData.accessLimitation.notes ? `${scopeData.accessLimitation.mainReason}: ${scopeData.accessLimitation.notes}` : scopeData.accessLimitation.mainReason)
      : (scopeData?.accessibilityLimitations || null);

    await Database.query(
      `INSERT INTO survey_scopes (report_id, survey_coverage, inaccessible_areas, accessibility_limitations)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (report_id) DO UPDATE SET
         survey_coverage = EXCLUDED.survey_coverage,
         inaccessible_areas = EXCLUDED.inaccessible_areas,
         accessibility_limitations = EXCLUDED.accessibility_limitations;`,
      [reportId, coverage, inaccessible, limitations]
    );
  }

  static async saveFloorSurveys(reportId: string, floors: any[]): Promise<void> {
    await Database.transaction(async (client) => {
      // 1. Lưu danh sách tầng, sơ đồ CAD_01 và CAD_02
      await client.query(`DELETE FROM floor_surveys WHERE report_id = $1;`, [reportId]);
      for (let i = 0; i < floors.length; i++) {
        const f = floors[i];
        await client.query(
          `INSERT INTO floor_surveys (
             report_id, floor_name, floor_order, overview_photos_json,
             cad_drawing_url, cad_zone_pins_json, cad_structural_drawing_url, cad_element_pins_json, notes
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
          [
            reportId,
            f.floorName || `Tầng ${i + 1}`,
            i + 1,
            JSON.stringify(f.overviewPhotos || []),
            f.cadDrawingUrl || f.cadSketchPhotoUrl || null,
            JSON.stringify(f.cadZonePins || []),
            f.cadStructuralDrawingUrl || f.cadStructuralSketchPhotoUrl || null,
            JSON.stringify(f.cadElementPins || []),
            f.notes || null,
          ]
        );
      }

      // 2. Lưu chi tiết Vùng Z (Damage Zones) và Khuyết tật D (Defect Items) từ các tầng
      const allZones: any[] = [];
      for (const f of floors) {
        if (f.zones && Array.isArray(f.zones)) {
          for (const z of f.zones) {
            allZones.push({ ...z, floorName: z.floorName || f.floorName });
          }
        }
      }

      if (allZones.length > 0) {
        await client.query(`DELETE FROM damage_zones WHERE report_id = $1;`, [reportId]);
        for (const z of allZones) {
          const compType = normalizeComponentType(z.componentType || z.customComponentType);

          const zoneRes = await client.query<{ id: string }>(
            `INSERT INTO damage_zones (
               report_id, zone_code, floor_name, room_name, component_type,
               wall_material, functional_impact_repair_needed, burland_grade,
               ctx_photo_url, notes
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id;`,
            [
              reportId,
              z.zoneCode || 'Z-01',
              z.floorName || 'Tầng trệt',
              z.roomName || 'Không gian chung',
              compType,
              z.wallMaterial || null,
              Boolean(z.functionalImpactRepairNeeded),
              Number(z.burlandGrade) || 0,
              z.ctxPhotoUrl || '',
              z.notes || null,
            ]
          );

          const zoneId = zoneRes.rows[0]?.id;
          if (zoneId && z.defects && Array.isArray(z.defects)) {
            for (const d of z.defects) {
              const actState = ['A', 'S', 'U'].includes(d.activityState) ? d.activityState : 'U';
              await client.query(
                `INSERT INTO defect_items (
                   zone_id, defect_code, pin_x, pin_y, screening_category, defect_type,
                   crack_direction, width_max_mm, length_mm, activity_state,
                   material_degradation_e4, structural_significance_e2, has_scale_card,
                   is_structural_critical, cu_photo_url, extra_photo_url, pin_color
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17);`,
                [
                  zoneId,
                  d.defectCode || 'D-01',
                  Number(d.pinX) || 0,
                  Number(d.pinY) || 0,
                  d.screeningCategory || 'CRACK',
                  d.defectType || 'HAIRLINE',
                  d.crackDirection || null,
                  Number(d.widthMaxMm) || 0,
                  Number(d.lengthMm) || 0,
                  actState,
                  Number(d.materialDegradationE4) || 0,
                  Number(d.structuralSignificanceE2) || 0,
                  d.hasScaleCard ?? true,
                  d.isStructuralCritical ?? false,
                  d.cuPhotoUrl || '',
                  d.extraPhotoUrl || null,
                  d.pinColor || '#ef4444',
                ]
              );
            }
          }
        }
      }
    });
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

      // XỬ LÝ BIẾN ĐỘNG TÁCH THỬA THỰC ĐỊA (SPLIT MUTATION 2 NHÁNH & TRUY VẾT)
      try {
        const parsedJson = typeof submitData.surveyDataJson === 'string'
          ? JSON.parse(submitData.surveyDataJson)
          : submitData.surveyDataJson;
        const rawMutation = parsedJson?.gisMutationConfirmed || parsedJson?.gisMutation;
        if (rawMutation && rawMutation.type === 'SPLIT') {
          await SurveyRepository.handleFieldSplitMutation(client, reportId, rawMutation);
        } else if (rawMutation && rawMutation.type === 'MERGE') {
          await SurveyRepository.handleFieldMergeMutation(client, reportId, rawMutation);
        }
      } catch (mutErr) {
        console.error('[submitReport] Cảnh báo xử lý biến động tách/gộp thửa (Dữ liệu khảo sát chính vẫn được bảo toàn):', mutErr);
      }
    });
  }

  /**
   * Chuẩn hóa tọa độ mảng đỉnh thành Polygon GeoJSON hợp lệ (khép kín vòng và chuẩn [lng, lat])
   */
  public static toGeoJsonPolygon(points: any): any {
    if (!points) return null;
    if (points.type === 'Polygon' && Array.isArray(points.coordinates)) {
      return points;
    }
    if (!Array.isArray(points) || points.length < 3) {
      return null;
    }

    const ring = points
      .map((p: any) => {
        if (!Array.isArray(p) || p.length < 2) return null;
        const a = Number(p[0]);
        const b = Number(p[1]);
        if (isNaN(a) || isNaN(b)) return null;
        // Chuẩn tọa độ Việt Nam: Lat ~ 8-23, Lng ~ 102-110
        if (a < 50 && b > 50) {
          return [b, a]; // Đảo [lat, lng] -> [lng, lat]
        }
        return [a, b];
      })
      .filter((p): p is [number, number] => p !== null);

    if (ring.length < 3) return null;

    // Khép kín polygon nếu điểm đầu khác điểm cuối
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]]);
    }

    return {
      type: 'Polygon',
      coordinates: [ring],
    };
  }

  /**
   * Xử lý Biến động Tách Thửa Thực Địa theo quy chuẩn 2 Nhánh & Bảo đảm 100% Truy Vết:
   * - Căn A (ngôi nhà đang KS): Kế thừa 100% mã gốc, ranh đất thu gọn theo diện tích Căn A.
   * - Nhánh 1 (Đất dư / Sân vườn): Không tạo lô mới trên GIS, KSV nộp xong là hoàn tất.
   * - Nhánh 2 (Căn nhà mới độc lập): Cấp mã mới B-07xxx, tạo lô mới trên GIS và tự động phân công cho KSV làm tiếp.
   */
  public static async handleFieldSplitMutation(
    client: PoolClient,
    reportId: string,
    rawMutation: any
  ): Promise<void> {
    const pRes = await client.query<{
      parcel_id: string;
      surveyor_id: string;
      zone_id: string;
      project_parcel_code: string;
      house_number: string;
      street: string;
      ward: string;
      district: string;
      original_geom_json: string;
    }>(
      `SELECT r.parcel_id, r.surveyor_id,
              p.zone_id, p.project_parcel_code, p.house_number, p.street, p.ward, p.district,
              ST_AsGeoJSON(p.cadastral_polygon_geom) AS original_geom_json
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       WHERE r.id = $1;`,
      [reportId]
    );

    const parent = pRes.rows[0];
    if (!parent) return;

    const details = rawMutation.details || rawMutation;
    const residualKind = details.residualKind || 'NON_BUILDING';
    const splitChildren = Array.isArray(details.splitChildren) ? details.splitChildren : [];
    const childA = splitChildren[0] || {};
    const childB = splitChildren[1] || {};

    const polyAPoints = details.splitCustomPointsA || childA.coordinates;
    const polyBPoints = details.splitCustomPointsB || childB.coordinates;

    const geoJsonA = this.toGeoJsonPolygon(polyAPoints);
    const geoJsonB = this.toGeoJsonPolygon(polyBPoints);

    // 1. Phân nhánh xử lý Căn A và Thửa Gốc:
    if (residualKind === 'NEW_BUILDING') {
      // NHÁNH 2: TÁCH THỬA PHÁT SINH CĂN NHÀ MỚI (CĂN B ĐỘC LẬP)
      // Căn A thu nhỏ ranh đất theo Căn A, ghi nhận mutation_type = 'SPLIT'
      if (geoJsonA) {
        await client.query(
          `UPDATE parcels
           SET cadastral_polygon_geom = ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)), 3), 1),
               footprint_polygon_geom = ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)), 3), 1),
               location_geom = ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
               land_area_m2 = COALESCE($2, land_area_m2),
               construction_area_m2 = COALESCE($2, construction_area_m2),
               mutation_type = 'SPLIT',
               updated_at = NOW()
           WHERE id = $3;`,
          [
            JSON.stringify(geoJsonA),
            childA.areaM2 ? Number(childA.areaM2) : null,
            parent.parcel_id,
          ]
        );
      } else {
        await client.query(
          `UPDATE parcels
           SET land_area_m2 = COALESCE($1, land_area_m2),
               construction_area_m2 = COALESCE($1, construction_area_m2),
               mutation_type = 'SPLIT',
               updated_at = NOW()
           WHERE id = $2;`,
          [
            childA.areaM2 ? Number(childA.areaM2) : null,
            parent.parcel_id,
          ]
        );
      }
    } else {
      // NHÁNH 1: KHOANH RANH NHÀ (FOOTPRINT) - KHÔNG TÁCH THỬA ĐẤT
      // Giữ nguyên 100% ranh thửa đất địa chính pháp lý (cadastral_polygon_geom và land_area_m2)
      // Chỉ cập nhật ranh chân đế công trình (footprint_polygon_geom) và diện tích xây dựng (construction_area_m2)
      if (geoJsonA) {
        await client.query(
          `UPDATE parcels
           SET footprint_polygon_geom = ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)), 3), 1),
               construction_area_m2 = COALESCE($2, construction_area_m2),
               mutation_type = 'REDRAW',
               updated_at = NOW()
           WHERE id = $3;`,
          [
            JSON.stringify(geoJsonA),
            childA.areaM2 ? Number(childA.areaM2) : null,
            parent.parcel_id,
          ]
        );
      } else {
        await client.query(
          `UPDATE parcels
           SET construction_area_m2 = COALESCE($1, construction_area_m2),
               mutation_type = 'REDRAW',
               updated_at = NOW()
           WHERE id = $2;`,
          [
            childA.areaM2 ? Number(childA.areaM2) : null,
            parent.parcel_id,
          ]
        );
      }
    }

    // 2. Tạo sự kiện biến động (Audit Trail 100%) vào bảng parcel_mutation_events
    const mutationType = residualKind === 'NEW_BUILDING' ? 'SPLIT' : 'REDRAW';
    const mutationCode = `MUT-${mutationType}-${Date.now()}`;
    const newGeoJson = {
      type: 'FeatureCollection',
      features: [
        geoJsonA ? {
          type: 'Feature',
          properties: {
            role: 'CHILD_A',
            code: parent.project_parcel_code,
            label: `Căn A (Đang KS - ${parent.project_parcel_code})`,
            areaM2: childA.areaM2,
            houseNumber: parent.house_number,
          },
          geometry: geoJsonA,
        } : null,
        geoJsonB ? {
          type: 'Feature',
          properties: {
            role: 'CHILD_B',
            residualKind,
            code: residualKind === 'NEW_BUILDING' ? (childB.suggestedCode || 'B-07001') : `${parent.project_parcel_code}-DU`,
            label: residualKind === 'NEW_BUILDING' ? 'Căn B (Nhà mới độc lập)' : 'Phần diện tích dôi dư (Đất thừa / Sân vườn)',
            areaM2: childB.areaM2,
            functionalType: childB.functionalType,
            houseNumber: childB.houseNumber,
            ownerName: childB.ownerName,
          },
          geometry: geoJsonB,
        } : null,
      ].filter(Boolean),
    };

    const mutRes = await client.query<{ id: string }>(
      `INSERT INTO parcel_mutation_events (
         mutation_code, mutation_type, source_parcel_ids, result_parcel_ids,
         original_geojson, new_geojson, surveyor_notes, surveyor_id, status, approved_at
       ) VALUES (
         $1, $2, ARRAY[$3::uuid], ARRAY[$3::uuid],
         $4, $5, $6, $7, 'APPROVED', NOW()
       ) RETURNING id;`,
      [
        mutationCode,
        mutationType,
        parent.parcel_id,
        parent.original_geom_json ? JSON.parse(parent.original_geom_json) : null,
        JSON.stringify(newGeoJson),
        details.splitReason || rawMutation.notes || (residualKind === 'NEW_BUILDING' ? 'Tách thửa thực địa phát sinh Căn B' : 'Khoanh ranh chân đế công trình, đất dư sân vườn'),
        parent.surveyor_id,
      ]
    );

    const mutationEventId = mutRes.rows[0].id;
    await client.query(
      `UPDATE parcels SET mutation_event_id = $1 WHERE id = $2;`,
      [mutationEventId, parent.parcel_id]
    );

    // 3. Phân nhánh xử lý Ô dôi dư
    if (residualKind === 'NEW_BUILDING') {
      // NHÁNH 2: CĂN NHÀ MỚI ĐỘC LẬP -> Cấp mã nối tiếp theo Max của Zone + 1, tạo parcel mới, gán cho KSV làm tiếp
      const newProjectCode = await CadastralRepository.getNextHighRangeProjectCode(
        client,
        parent.zone_id,
        parent.project_parcel_code
      );
      const bHouseNumber = childB.houseNumber || (parent.house_number ? `${parent.house_number}B` : 'KĐ');
      const bOwnerName = childB.ownerName || `Chủ hộ Căn B (${newProjectCode})`;
      const bArea = childB.areaM2 ? Number(childB.areaM2) : null;

      // Nếu có geoJsonB thì dùng geoJsonB, nếu không có thì dùng PostGIS ST_Difference giữa thửa mẹ và Căn A
      let bGeomQuery = `ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($11), 4326)), 3), 1)`;
      let bGeomParam: any = geoJsonB ? JSON.stringify(geoJsonB) : null;

      if (!bGeomParam && geoJsonA) {
        bGeomQuery = `ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_Difference(
          (SELECT cadastral_polygon_geom FROM parcels WHERE id = $12),
          ST_SetSRID(ST_GeomFromGeoJSON($11), 4326)
        )), 3), 1)`;
        bGeomParam = JSON.stringify(geoJsonA);
      } else if (!bGeomParam) {
        bGeomParam = parent.original_geom_json;
      }

      const insertChildRes = await client.query<{ id: string }>(
        `INSERT INTO parcels (
           zone_id, project_parcel_code, house_number, street, ward, district,
           owner_name, owner_phone, land_area_m2, construction_area_m2, floor_count,
           cadastral_polygon_geom, footprint_polygon_geom, location_geom,
           survey_status, lifecycle_status, mutation_type, parent_parcel_ids, mutation_event_id
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, 1,
           ${bGeomQuery},
           ${bGeomQuery},
           ST_Centroid(${bGeomQuery}),
           'NOT_SURVEYED', 'ACTIVE', 'SPLIT', ARRAY[$12::uuid], $13
         ) RETURNING id;`,
        [
          parent.zone_id,
          newProjectCode,
          bHouseNumber,
          parent.street,
          parent.ward,
          parent.district,
          bOwnerName,
          childB.ownerPhone || null,
          bArea,
          bArea,
          bGeomParam,
          parent.parcel_id,
          mutationEventId,
        ]
      );

      const childParcelId = insertChildRes.rows[0].id;

      // Cập nhật quan hệ cha - con trong parcels (Audit Trail)
      await client.query(
        `UPDATE parcels
         SET child_parcel_ids = array_append(COALESCE(child_parcel_ids, '{}'), $1::uuid)
         WHERE id = $2;`,
        [childParcelId, parent.parcel_id]
      );

      // Cập nhật result_parcel_ids trong parcel_mutation_events
      await client.query(
        `UPDATE parcel_mutation_events
         SET result_parcel_ids = ARRAY[$1::uuid, $2::uuid]
         WHERE id = $3;`,
        [parent.parcel_id, childParcelId, mutationEventId]
      );

      // Tự động phân công nhiệm vụ khảo sát Căn B cho chính KSV đang nộp
      await client.query(
        `INSERT INTO task_assignments (
           parcel_id, surveyor_id, assigned_by_admin_id, deadline, status, notes
         ) VALUES (
           $1, $2, $2, NOW() + INTERVAL '7 days', 'ASSIGNED', $3
         );`,
        [
          childParcelId,
          parent.surveyor_id,
          `Tự động giao Căn B (${newProjectCode}) sau khi tách thửa thực địa từ mã ${parent.project_parcel_code}`,
        ]
      );

      console.log(`[handleFieldSplitMutation] Đã kích hoạt Căn B (${newProjectCode}) độc lập và phân công cho KSV ${parent.surveyor_id}`);
    } else {
      // NHÁNH 1: ĐẤT DƯ / SÂN VƯỜN / NGÕ ĐI -> Khoanh ranh nhà (Footprint), KHÔNG tạo thửa mới trong parcels, giữ nguyên ranh đất mẹ
      console.log(`[handleFieldSplitMutation] Nhánh Khoanh ranh nhà (${residualKind}): Đã lưu ranh chân đế công trình (${childA.areaM2}m²), giữ nguyên ranh đất mẹ, không phát sinh lô mới.`);
    }
  }

  /**
   * Xử lý Biến động Gộp Thửa Thực Địa theo quy chuẩn liên thửa & Bảo đảm 100% Truy Vết (Audit Trail):
   * - Thửa chính (Căn đang KS): Kế thừa diện tích gộp và đa giác PostGIS ST_Union của các thửa thành phần.
   * - Thửa phụ (Thửa được gộp vào): Chuyển lifecycle_status = 'MERGED_DEPRECATED', mutation_type = 'MERGE'.
   * - Ghi nhận sự kiện biến động vào parcel_mutation_events (status = 'APPROVED').
   */
  public static async handleFieldMergeMutation(
    client: PoolClient,
    reportId: string,
    rawMutation: any
  ): Promise<void> {
    const pRes = await client.query<{
      parcel_id: string;
      surveyor_id: string;
      zone_id: string;
      project_parcel_code: string;
      house_number: string;
      street: string;
      ward: string;
      district: string;
      land_area_m2: number;
      construction_area_m2: number;
      original_geom_json: string;
    }>(
      `SELECT r.parcel_id, r.surveyor_id,
              p.zone_id, p.project_parcel_code, p.house_number, p.street, p.ward, p.district,
              p.land_area_m2, p.construction_area_m2,
              ST_AsGeoJSON(p.cadastral_polygon_geom) AS original_geom_json
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       WHERE r.id = $1;`,
      [reportId]
    );

    const primary = pRes.rows[0];
    if (!primary) return;

    const details = rawMutation.details || rawMutation;
    let mergeCodes: string[] = [];
    if (Array.isArray(details.selectedMergeCodes) && details.selectedMergeCodes.length > 0) {
      mergeCodes = details.selectedMergeCodes.filter((c: string) => c && c !== primary.project_parcel_code);
    } else if (details.mergeTargetCode && details.mergeTargetCode !== primary.project_parcel_code) {
      mergeCodes = [details.mergeTargetCode];
    }

    if (mergeCodes.length === 0) {
      console.warn(`[handleFieldMergeMutation] Không tìm thấy danh sách mã thửa phụ cần gộp cho báo cáo ${reportId}`);
      return;
    }

    const secRes = await client.query<{
      id: string;
      project_parcel_code: string;
      house_number: string;
      land_area_m2: number;
      construction_area_m2: number;
      original_geom_json: string;
    }>(
      `SELECT id, project_parcel_code, house_number, land_area_m2, construction_area_m2,
              ST_AsGeoJSON(cadastral_polygon_geom) AS original_geom_json
       FROM parcels
       WHERE project_parcel_code = ANY($1) AND zone_id = $2 AND lifecycle_status = 'ACTIVE';`,
      [mergeCodes, primary.zone_id]
    );

    const secondaryParcels = secRes.rows;
    if (secondaryParcels.length === 0) {
      console.warn(`[handleFieldMergeMutation] Không tìm thấy thửa phụ hợp lệ trong DB ứng với các mã: ${mergeCodes.join(', ')}`);
      return;
    }

    const secondaryIds = secondaryParcels.map((p) => p.id);
    const allSourceIds = [primary.parcel_id, ...secondaryIds];

    const totalSecondaryArea = secondaryParcels.reduce((sum, p) => sum + (Number(p.land_area_m2) || 0), 0);
    const calculatedTotalLandArea = Number(primary.land_area_m2 || 0) + totalSecondaryArea;
    const finalLandArea = details.totalLandArea ? Number(details.totalLandArea) : calculatedTotalLandArea;

    const finalConstructionArea = details.mergeBuildingAreaM2
      ? Number(details.mergeBuildingAreaM2)
      : (primary.construction_area_m2 ? Number(primary.construction_area_m2) : null);

    const buildingCustomPoints = details.mergeBuildingCustomPoints;
    const buildingGeoJson = this.toGeoJsonPolygon(buildingCustomPoints);

    if (buildingGeoJson) {
      await client.query(
        `UPDATE parcels
         SET cadastral_polygon_geom = ST_GeometryN(
               ST_CollectionExtract(
                 ST_MakeValid(
                   ST_Union(
                     cadastral_polygon_geom,
                     (SELECT ST_Union(cadastral_polygon_geom) FROM parcels WHERE id = ANY($1))
                   )
                 ), 3
               ), 1
             ),
             footprint_polygon_geom = ST_GeometryN(
               ST_CollectionExtract(
                 ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)), 3
               ), 1
             ),
             location_geom = ST_Centroid(
               ST_Union(
                 cadastral_polygon_geom,
                 (SELECT ST_Union(cadastral_polygon_geom) FROM parcels WHERE id = ANY($1))
               )
             ),
             land_area_m2 = $2,
             construction_area_m2 = COALESCE($3, construction_area_m2),
             mutation_type = 'MERGE',
             child_parcel_ids = array_cat(COALESCE(child_parcel_ids, '{}'), $1::uuid[]),
             updated_at = NOW()
         WHERE id = $5;`,
        [secondaryIds, finalLandArea, finalConstructionArea, JSON.stringify(buildingGeoJson), primary.parcel_id]
      );
    } else {
      await client.query(
        `UPDATE parcels
         SET cadastral_polygon_geom = ST_GeometryN(
               ST_CollectionExtract(
                 ST_MakeValid(
                   ST_Union(
                     cadastral_polygon_geom,
                     (SELECT ST_Union(cadastral_polygon_geom) FROM parcels WHERE id = ANY($1))
                   )
                 ), 3
               ), 1
             ),
             location_geom = ST_Centroid(
               ST_Union(
                 cadastral_polygon_geom,
                 (SELECT ST_Union(cadastral_polygon_geom) FROM parcels WHERE id = ANY($1))
               )
             ),
             land_area_m2 = $2,
             construction_area_m2 = COALESCE($3, construction_area_m2),
             mutation_type = 'MERGE',
             child_parcel_ids = array_cat(COALESCE(child_parcel_ids, '{}'), $1::uuid[]),
             updated_at = NOW()
         WHERE id = $4;`,
        [secondaryIds, finalLandArea, finalConstructionArea, primary.parcel_id]
      );
    }

    await client.query(
      `UPDATE parcels
       SET lifecycle_status = 'MERGED_DEPRECATED',
           mutation_type = 'MERGE',
           survey_status = 'APPROVED',
           parent_parcel_ids = array_append(COALESCE(parent_parcel_ids, '{}'), $1::uuid),
           updated_at = NOW()
       WHERE id = ANY($2);`,
      [primary.parcel_id, secondaryIds]
    );

    const mergedGeomRes = await client.query<{ geom_json: string }>(
      `SELECT ST_AsGeoJSON(cadastral_polygon_geom) AS geom_json FROM parcels WHERE id = $1;`,
      [primary.parcel_id]
    );
    const mergedGeom = mergedGeomRes.rows[0]?.geom_json ? JSON.parse(mergedGeomRes.rows[0].geom_json) : null;

    const mutationCode = `MUT-MERGE-${Date.now()}`;
    const originalFeatures = [
      primary.original_geom_json
        ? {
            type: 'Feature',
            properties: { role: 'PRIMARY_ORIGINAL', code: primary.project_parcel_code, areaM2: primary.land_area_m2 },
            geometry: JSON.parse(primary.original_geom_json),
          }
        : null,
      ...secondaryParcels.map((sp) =>
        sp.original_geom_json
          ? {
              type: 'Feature',
              properties: { role: 'SECONDARY_ORIGINAL', code: sp.project_parcel_code, areaM2: sp.land_area_m2 },
              geometry: JSON.parse(sp.original_geom_json),
            }
          : null
      ),
    ].filter(Boolean);

    const newGeoJson = {
      type: 'FeatureCollection',
      features: [
        mergedGeom
          ? {
              type: 'Feature',
              properties: {
                role: 'MERGED_PARCEL',
                code: primary.project_parcel_code,
                label: `Thửa gộp ${primary.project_parcel_code} (từ ${[primary.project_parcel_code, ...mergeCodes].join(' + ')})`,
                areaM2: finalLandArea,
                constructionAreaM2: finalConstructionArea,
              },
              geometry: mergedGeom,
            }
          : null,
      ].filter(Boolean),
    };

    const mutRes = await client.query<{ id: string }>(
      `INSERT INTO parcel_mutation_events (
         mutation_code, mutation_type, source_parcel_ids, result_parcel_ids,
         original_geojson, new_geojson, surveyor_notes, surveyor_id, status, approved_at
       ) VALUES (
         $1, 'MERGE', $2::uuid[], ARRAY[$3::uuid],
         $4, $5, $6, $7, 'APPROVED', NOW()
       ) RETURNING id;`,
      [
        mutationCode,
        allSourceIds,
        primary.parcel_id,
        JSON.stringify({ type: 'FeatureCollection', features: originalFeatures }),
        JSON.stringify(newGeoJson),
        details.mergeReason || rawMutation.notes || `Gộp thực địa thửa ${mergeCodes.join(', ')} vào thửa ${primary.project_parcel_code}`,
        primary.surveyor_id,
      ]
    );

    const mutationEventId = mutRes.rows[0]?.id;
    if (mutationEventId) {
      await client.query(
        `UPDATE parcels SET mutation_event_id = $1 WHERE id = ANY($2);`,
        [mutationEventId, allSourceIds]
      );
    }

    console.log(`[handleFieldMergeMutation] Đã gộp thành công các thửa [${mergeCodes.join(', ')}] vào [${primary.project_parcel_code}]. Diện tích mới: ${finalLandArea}m²`);
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
      report = await SurveyRepository.findReportById(reportRes.rows[0].id);
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

  static async findActiveDraft(
    parcelId: string,
    unitId?: string | null,
    phase: string = 'PHASE_1'
  ): Promise<any | null> {
    const resolvedId = await this.resolveParcelId(parcelId);
    if (!resolvedId) return null;

    let query = `
      SELECT r.*,
             u.full_name AS surveyor_name,
             u.phone AS surveyor_phone,
             u.surveyor_code,
             le.full_name AS last_editor_name,
             p.project_parcel_code,
             p.official_cadastral_code,
             p.house_number,
             p.street
      FROM base_survey_reports r
      JOIN users u ON r.surveyor_id = u.id
      LEFT JOIN users le ON r.last_edited_by_id = le.id
      JOIN parcels p ON r.parcel_id = p.id
      WHERE r.parcel_id = $1 AND r.phase = $2 AND r.status = 'DRAFT'
    `;
    const params: any[] = [resolvedId, phase];

    if (unitId) {
      params.push(unitId);
      query += ` AND r.unit_id = $${params.length}`;
    } else {
      query += ` AND r.unit_id IS NULL`;
    }

    query += ` ORDER BY r.updated_at DESC LIMIT 1;`;

    const res = await Database.query(query, params);
    return res.rows[0] || null;
  }

  static async upsertDraft(data: {
    parcelId: string;
    surveyorId: string;
    unitId?: string | null;
    reportType?: string;
    currentStep: number;
    surveyData: any;
    syncVersion?: number;
  }): Promise<any> {
    const resolvedParcelId = await this.resolveParcelId(data.parcelId);
    if (!resolvedParcelId) {
      throw new Error(`Thửa đất không tồn tại: ${data.parcelId}`);
    }

    // Kiểm tra draft hiện tại
    const existing = await this.findActiveDraft(resolvedParcelId, data.unitId);

    if (existing) {
      const updateRes = await Database.query(
        `UPDATE base_survey_reports
         SET survey_data_json = $2,
             current_step = $3,
             sync_version = sync_version + 1,
             last_edited_by_id = $4,
             is_ready_for_handover = FALSE,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *;`,
        [
          existing.id,
          typeof data.surveyData === 'string' ? data.surveyData : JSON.stringify(data.surveyData),
          data.currentStep,
          data.surveyorId,
        ]
      );

      // Đảm bảo status của parcel là IN_PROGRESS
      await Database.query(
        `UPDATE parcels 
         SET survey_status = 'IN_PROGRESS', 
             active_phase1_report_id = COALESCE(active_phase1_report_id, $2),
             updated_at = NOW() 
         WHERE id = $1;`,
        [resolvedParcelId, existing.id]
      );

      if (data.unitId) {
        await Database.query(
          `UPDATE building_units 
           SET status = 'IN_PROGRESS', 
               phase1_report_id = COALESCE(phase1_report_id, $2),
               updated_at = NOW() 
           WHERE id = $1;`,
          [data.unitId, existing.id]
        );
      }

      return updateRes.rows[0];
    } else {
      // Khởi tạo mã ngẫu nhiên 6 số phục vụ bàn giao ca
      const securityCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Lấy project code
      const pRes = await Database.query<{ project_parcel_code: string }>(
        `SELECT project_parcel_code FROM parcels WHERE id = $1;`,
        [resolvedParcelId]
      );
      const pCode = pRes.rows[0]?.project_parcel_code || 'B-XXXXX';
      const reportCode = `REPORT-${pCode}-DRAFT-${Date.now()}`;

      const insertRes = await Database.query(
        `INSERT INTO base_survey_reports (
           parcel_id, surveyor_id, last_edited_by_id, report_code, phase, status,
           current_step, survey_data_json, handover_security_code, report_type, unit_id, sync_version
         )
         VALUES ($1, $2, $2, $3, 'PHASE_1', 'DRAFT', $4, $5, $6, $7, $8, 1)
         RETURNING *;`,
        [
          resolvedParcelId,
          data.surveyorId,
          reportCode,
          data.currentStep,
          typeof data.surveyData === 'string' ? data.surveyData : JSON.stringify(data.surveyData),
          securityCode,
          data.reportType || (data.unitId ? 'UNIT_CHILD' : 'STANDALONE'),
          data.unitId || null,
        ]
      );
      const newDraft = insertRes.rows[0];

      // Đảm bảo có record trong phase1_report_details
      await Database.query(
        `INSERT INTO phase1_report_details (report_id, is_historical_baseline)
         VALUES ($1, TRUE)
         ON CONFLICT (report_id) DO NOTHING;`,
        [newDraft.id]
      );

      await Database.query(
        `UPDATE parcels 
         SET survey_status = 'IN_PROGRESS', active_phase1_report_id = $2, updated_at = NOW() 
         WHERE id = $1;`,
        [resolvedParcelId, newDraft.id]
      );

      if (data.unitId) {
        await Database.query(
          `UPDATE building_units 
           SET status = 'IN_PROGRESS', phase1_report_id = $2, updated_at = NOW() 
           WHERE id = $1;`,
          [data.unitId, newDraft.id]
        );
      }

      return newDraft;
    }
  }

  static async releaseDraftLock(parcelId: string, unitId: string | null, surveyorId: string): Promise<any> {
    const existing = await this.findActiveDraft(parcelId, unitId);
    if (!existing) return null;

    const res = await Database.query(
      `UPDATE base_survey_reports
       SET is_ready_for_handover = TRUE,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *;`,
      [existing.id]
    );
    return res.rows[0];
  }

  static async takeoverDraft(
    parcelId: string,
    unitId: string | null,
    newSurveyorId: string,
    note?: string
  ): Promise<any> {
    const existing = await this.findActiveDraft(parcelId, unitId);
    if (!existing) {
      throw new Error('Không tìm thấy bản nháp đang khảo sát để tiếp quản');
    }

    const newSecurityCode = Math.floor(100000 + Math.random() * 900000).toString();
    const handoverEntry = {
      fromSurveyorId: existing.surveyor_id,
      fromSurveyorName: existing.surveyor_name,
      toSurveyorId: newSurveyorId,
      step: existing.current_step,
      handoverAt: new Date().toISOString(),
      note: note || 'Tiếp quản ca làm việc',
    };

    const res = await Database.query(
      `UPDATE base_survey_reports
       SET surveyor_id = $2,
           last_edited_by_id = $2,
           is_ready_for_handover = FALSE,
           handover_security_code = $3,
           handover_history = COALESCE(handover_history, '[]'::jsonb) || $4::jsonb,
           sync_version = sync_version + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *;`,
      [
        existing.id,
        newSurveyorId,
        newSecurityCode,
        JSON.stringify([handoverEntry]),
      ]
    );

    return res.rows[0];
  }
}

