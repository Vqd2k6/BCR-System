import { Database } from '../../../database/db';
import { normalizeComponentType } from '../survey.dto';
import { SurveyBaseRepository } from './survey-base.repository';

export class SurveyDefectsRepository {
  static async saveIdentificationPhotos(
    reportId: string,
    photos: any
  ): Promise<void> {
    const hasPhotoCode = await SurveyBaseRepository.hasColumn('survey_identification_photos', 'photo_code');

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
    const hasCtxCode = await SurveyBaseRepository.hasColumn('damage_zones', 'ctx_photo_code');
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
    const hasCuPhotosJson = await SurveyBaseRepository.hasColumn('defect_items', 'cu_photos_json');
    const hasCuCode = await SurveyBaseRepository.hasColumn('defect_items', 'cu_photo_code');
    const primaryCuUrl = defectData.cuPhotos?.[0] || defectData.cuPhotoUrl || '';
    const extraCuUrl = defectData.cuPhotos?.[1] || defectData.extraPhotoUrl || null;
    const cuPhotos = Array.isArray(defectData.cuPhotos) && defectData.cuPhotos.length > 0
      ? defectData.cuPhotos
      : (primaryCuUrl ? [primaryCuUrl] : []);
    const cuPhotosJson = JSON.stringify(cuPhotos);
    const primaryCuCode = defectData.cuPhotoCodes?.[0] || defectData.cuPhotoCode || null;

    if (hasCuPhotosJson && hasCuCode) {
      const res = await Database.query(
        `INSERT INTO defect_items (
           zone_id, defect_code, pin_x, pin_y, screening_category, defect_type,
           crack_direction, width_max_mm, length_mm, activity_state,
           material_degradation_e4, structural_significance_e2, has_scale_card,
           is_structural_critical, cu_photo_url, extra_photo_url, cu_photo_code, cu_photos_json
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
          primaryCuUrl,
          extraCuUrl,
          primaryCuCode,
          cuPhotosJson,
        ]
      );
      return res.rows[0];
    } else if (hasCuCode) {
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
          primaryCuUrl,
          primaryCuCode,
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
    const hasPhotoCodes = await SurveyBaseRepository.hasColumn('deformation_assessments', 'diff_settlement_photo_code');
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
              const primaryCuUrl = d.cuPhotos?.[0] || d.cuPhotoUrl || '';
              const extraCuUrl = d.cuPhotos?.[1] || d.extraPhotoUrl || null;
              const cuPhotosList = Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0
                ? d.cuPhotos
                : (primaryCuUrl ? [primaryCuUrl] : []);
              const cuPhotosJson = JSON.stringify(cuPhotosList);
              const primaryCuCode = d.cuPhotoCodes?.[0] || d.cuPhotoCode || null;

              await client.query(
                `INSERT INTO defect_items (
                   zone_id, defect_code, pin_x, pin_y, screening_category, defect_type,
                   crack_direction, width_max_mm, length_mm, activity_state,
                   material_degradation_e4, structural_significance_e2, has_scale_card,
                   is_structural_critical, cu_photo_url, extra_photo_url, pin_color,
                   cu_photo_code, cu_photos_json
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19);`,
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
                  primaryCuUrl,
                  extraCuUrl,
                  d.pinColor || '#ef4444',
                  primaryCuCode,
                  cuPhotosJson,
                ]
              );
            }
          }
        }
      }
    });
  }
}
