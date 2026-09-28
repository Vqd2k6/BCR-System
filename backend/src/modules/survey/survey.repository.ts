import { Database } from '../../database/db';
import { normalizeComponentType } from './survey.dto';

export class SurveyRepository {
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
    await Database.transaction(async (client) => {
      // Xóa cũ và ghi mới
      await client.query(`DELETE FROM survey_identification_photos WHERE report_id = $1;`, [reportId]);

      // P01
      if (photos.p01HouseNumberUrl || photos.p01NotApplicable) {
        await client.query(
          `INSERT INTO survey_identification_photos (report_id, photo_type, raw_photo_url, photo_code, is_not_applicable, na_reason)
           VALUES ($1, 'P01_HOUSE_NUMBER', $2, $3, $4, $5);`,
          [reportId, photos.p01HouseNumberUrl || null, photos.p01PhotoCode || null, photos.p01NotApplicable, photos.p01NaReason || null]
        );
      }

      // P02 Facade
      if (photos.p02MainFacadeUrl || photos.p02NotApplicable) {
        await client.query(
          `INSERT INTO survey_identification_photos (
             report_id, photo_type, raw_photo_url, photo_code, facade_polygon_points_json,
             floor_split_lines_json, dimensions_json, is_not_applicable, na_reason
           ) VALUES ($1, 'P02_MAIN_FACADE', $2, $3, $4, $5, $6, $7, $8);`,
          [
            reportId,
            photos.p02MainFacadeUrl || null,
            photos.p02PhotoCode || null,
            JSON.stringify(photos.p02FacadePolygonPoints || []),
            JSON.stringify(photos.p02FloorSplitLines || []),
            JSON.stringify(photos.p02Dimensions || {}),
            photos.p02NotApplicable,
            photos.p02NaReason || null,
          ]
        );
      }

      // P03
      if (photos.p03SideRearUrl || photos.p03NotApplicable) {
        await client.query(
          `INSERT INTO survey_identification_photos (report_id, photo_type, raw_photo_url, photo_code, is_not_applicable)
           VALUES ($1, 'P03_SIDE_OR_REAR', $2, $3, $4);`,
          [reportId, photos.p03SideRearUrl || null, photos.p03PhotoCode || null, photos.p03NotApplicable]
        );
      }

      // P04
      if (photos.p04ContextStreetUrl || photos.p04NotApplicable) {
        await client.query(
          `INSERT INTO survey_identification_photos (report_id, photo_type, raw_photo_url, photo_code, is_not_applicable)
           VALUES ($1, 'P04_CONTEXT_STREET', $2, $3, $4);`,
          [reportId, photos.p04ContextStreetUrl || null, photos.p04PhotoCode || null, photos.p04NotApplicable]
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
           land_use_function
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
           land_use_function = EXCLUDED.land_use_function;`,
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
  }

  static async createDefectItem(zoneId: string, defectData: any): Promise<any> {
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
        defectData.widthMaxMm,
        defectData.lengthMm,
        defectData.activityState,
        defectData.materialDegradationE4,
        defectData.structuralSignificanceE2,
        defectData.hasScaleCard,
        defectData.isStructuralCritical,
        defectData.cuPhotoUrl,
        defectData.cuPhotoCode || null,
      ]
    );
    return res.rows[0];
  }

  static async saveDeformation(reportId: string, deform: any): Promise<void> {
    await Database.query(
      `INSERT INTO deformation_assessments (
         report_id, tilt_angle_x, tilt_angle_y, tilt_direction, floor_slope_ratio,
         beam_deflection_mm, measurement_method, measurement_reliability,
         diff_settlement_photo_code, tilt_photo_code, abnormal_photo_code
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
         abnormal_photo_code = EXCLUDED.abnormal_photo_code;`,
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
      ]
    );
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
}
