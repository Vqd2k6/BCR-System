import { Database } from '../../../database/db';
import { NotFoundError, BadRequestError, UnauthorizedError, ForbiddenError } from '../../../common/errors/problem-details';
import { CryptoUtils } from '../../../common/utils/crypto.utils';
import { CadastralService } from '../../cadastral/cadastral.service';
import { normalizeComponentType } from '../../survey/survey.dto';

export class AuditModificationService {
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

      const u = payload.updates;

      // 4.1. Cập nhật parcels đầy đủ các trường
      const latVal = u.gpsCoords?.lat ?? u.gpsCoords?.latitude ?? u.coordinates?.[0];
      const lngVal = u.gpsCoords?.lng ?? u.gpsCoords?.longitude ?? u.coordinates?.[1];

      await client.query(
        `UPDATE parcels SET
           house_number = COALESCE($1, house_number),
           street = COALESCE($2, street),
           ward = COALESCE($3, ward),
           district = COALESCE($4, district),
           owner_name = COALESCE($5, owner_name),
           owner_phone = COALESCE($6, owner_phone),
           official_cadastral_code = COALESCE($7, official_cadastral_code),
           frontage_width = COALESCE($8, frontage_width),
           lot_depth = COALESCE($9, lot_depth),
           land_area_m2 = COALESCE($10, land_area_m2),
           construction_area_m2 = COALESCE($11, construction_area_m2),
           floor_count = COALESCE($12, floor_count),
           location_geom = CASE 
             WHEN $13::float IS NOT NULL AND $14::float IS NOT NULL 
             THEN ST_SetSRID(ST_Point($14::float, $13::float), 4326) 
             ELSE location_geom 
           END,
           updated_at = NOW()
         WHERE id = $15;`,
        [
          u.houseNumber !== undefined && u.houseNumber !== '' ? u.houseNumber : null,
          u.street !== undefined && u.street !== '' ? u.street : null,
          u.ward !== undefined && u.ward !== '' ? u.ward : null,
          u.district !== undefined && u.district !== '' ? u.district : null,
          u.ownerName !== undefined && u.ownerName !== '' ? u.ownerName : null,
          u.ownerPhone !== undefined && u.ownerPhone !== '' ? u.ownerPhone : null,
          u.officialCadastralCode !== undefined && u.officialCadastralCode !== '' ? u.officialCadastralCode : null,
          u.frontageWidth !== undefined && u.frontageWidth !== '' ? Number(u.frontageWidth) : null,
          u.lotDepth !== undefined && u.lotDepth !== '' ? Number(u.lotDepth) : null,
          u.landAreaM2 !== undefined && u.landAreaM2 !== '' ? Number(u.landAreaM2) : null,
          u.constructionAreaM2 !== undefined && u.constructionAreaM2 !== '' ? Number(u.constructionAreaM2) : null,
          u.aboveFloors !== undefined && u.aboveFloors !== '' ? Number(u.aboveFloors) : null,
          latVal !== undefined && latVal !== '' ? Number(latVal) : null,
          lngVal !== undefined && lngVal !== '' ? Number(lngVal) : null,
          report.parcel_id,
        ]
      );

      // 4.2. Cập nhật base_survey_reports metadata nếu có
      const sigs = u.signatures || {};
      const exec = u.executiveSummary || {};
      await client.query(
        `UPDATE base_survey_reports SET
           surveyor_name = COALESCE($1, surveyor_name),
           surveyor_phone = COALESCE($2, surveyor_phone),
           survey_date = COALESCE($3, survey_date),
           surveyor_signature_url = COALESCE($4, surveyor_signature_url),
           owner_signature_url = COALESCE($5, owner_signature_url),
           owner_remarks = COALESCE($6, owner_remarks),
           engineering_recommendations = COALESCE($7, engineering_recommendations)
         WHERE id = $8;`,
        [
          sigs.surveyorName || u.surveyorName || null,
          sigs.surveyorPhone || u.surveyorPhone || null,
          u.surveyDate || null,
          sigs.surveyorSignature || null,
          sigs.ownerSignature || null,
          sigs.ownerFeedback || u.ownerRemarks || null,
          exec.specificRecommendationsText || u.engineeringRecommendations || null,
          actualReportId,
        ]
      );

      // 4.3. Cập nhật building_specifications
      await client.query(
        `UPDATE building_specifications SET
           building_name = COALESCE($1, building_name),
           floor_count = COALESCE($2, floor_count),
           basement_count = COALESCE($3, basement_count),
           land_use_function = COALESCE($4, land_use_function),
           year_of_construction = COALESCE($5, year_of_construction),
           is_year_estimated = COALESCE($6, is_year_estimated),
           foundation_depth_m = COALESCE($7, foundation_depth_m),
           foundation_density = COALESCE($8, foundation_density),
           foundation_spacing_m = COALESCE($9, foundation_spacing_m),
           foundation_notes = COALESCE($10, foundation_notes),
           adjacent_buildings = COALESCE($11, adjacent_buildings)
         WHERE report_id = $12;`,
        [
          u.buildingName !== undefined ? u.buildingName : null,
          u.aboveFloors !== undefined && u.aboveFloors !== '' ? Number(u.aboveFloors) : null,
          u.undergroundFloors !== undefined && u.undergroundFloors !== '' ? Number(u.undergroundFloors) : null,
          u.usageFunction !== undefined ? u.usageFunction : null,
          u.constructionYear !== undefined && u.constructionYear !== '' ? Number(u.constructionYear) : null,
          u.isEstimatedYear !== undefined ? Boolean(u.isEstimatedYear) : null,
          u.foundationDepthM !== undefined && u.foundationDepthM !== '' ? Number(u.foundationDepthM) : null,
          u.foundationDensity !== undefined && u.foundationDensity !== '' ? Number(u.foundationDensity) : null,
          u.foundationSpacingM !== undefined && u.foundationSpacingM !== '' ? Number(u.foundationSpacingM) : null,
          u.foundationNotes !== undefined ? u.foundationNotes : null,
          u.adjacentBuildings ? (typeof u.adjacentBuildings === 'object' ? JSON.stringify(u.adjacentBuildings) : u.adjacentBuildings) : null,
          actualReportId,
        ]
      );

      // 4.4. Cập nhật historical_sensitivities
      const hi = u.historyInterview;
      if (hi) {
        const qScores = [
          hi.renovationLoad ?? 0,
          hi.majorRepair ?? 0,
          hi.pastSettlement ?? 0,
          hi.neighborDamage ?? 0,
          hi.fireFloodIncident ?? 0,
        ];
        const maxQ = Math.max(...qScores.map(Number));
        const countHigh = qScores.filter((s) => Number(s) > 2).length;
        const e5Score = countHigh >= 2 ? 4 : maxQ;

        await client.query(
          `UPDATE historical_sensitivities SET
             extended_or_renovated = COALESCE($1, extended_or_renovated),
             previous_settlement_or_tilt = COALESCE($2, previous_settlement_or_tilt),
             fire_or_accident = COALESCE($3, fire_or_accident),
             sensitive_equipment_present = COALESCE($4, sensitive_equipment_present),
             details = COALESCE($5, details),
             e5_history_score = COALESCE($6, e5_history_score)
           WHERE report_id = $7;`,
          [
            hi.renovationLoad !== undefined ? Number(hi.renovationLoad) > 0 : null,
            hi.pastSettlement !== undefined ? Number(hi.pastSettlement) > 0 : null,
            hi.fireFloodIncident !== undefined ? Number(hi.fireFloodIncident) > 0 : null,
            hi.sensitiveEquipment?.has !== undefined ? Boolean(hi.sensitiveEquipment.has) : null,
            hi.renovationNotes || hi.majorRepairNotes || hi.pastSettlementNotes || null,
            e5Score,
            actualReportId,
          ]
        );
      }

      // 4.5. Cập nhật deformation_assessments
      const st = u.settlementTilt;
      if (st) {
        const tilt = st.buildingTilt || {};
        const beam = st.beamSagging || {};
        const diff = st.diffSettlement || {};
        const lDiff = Number(diff.level) || 0;
        const lTilt = Number(tilt.level) || 0;
        const lSag = Number(beam.level) || 0;
        const e3Score = Math.min(4, Math.max(lDiff, lTilt, lSag));

        await client.query(
          `UPDATE deformation_assessments SET
             tilt_angle_x = COALESCE($1, tilt_angle_x),
             tilt_angle_y = COALESCE($2, tilt_angle_y),
             tilt_direction = COALESCE($3, tilt_direction),
             beam_deflection_mm = COALESCE($4, beam_deflection_mm),
             measurement_reliability = COALESCE($5, measurement_reliability),
             e3_deformation_score = COALESCE($6, e3_deformation_score)
           WHERE report_id = $7;`,
          [
            tilt.xPermille !== undefined && tilt.xPermille !== '' ? Number(tilt.xPermille) / 10 : null,
            tilt.yPermille !== undefined && tilt.yPermille !== '' ? Number(tilt.yPermille) / 10 : null,
            tilt.direction || null,
            beam.sagMm !== undefined && beam.sagMm !== '' ? Number(beam.sagMm) : null,
            st.reliability || null,
            e3Score,
            actualReportId,
          ]
        );
      }

      // 4.6. Đồng bộ damage_zones & defect_items nếu floors hoặc damageZones thay đổi
      if (u.floors || u.damageZones) {
        const floorsToSync = Array.isArray(u.floors) && u.floors.length > 0
          ? u.floors
          : (Array.isArray(u.damageZones) && u.damageZones.length > 0 ? [{ floorName: 'Tầng trệt', zones: u.damageZones }] : []);

        if (floorsToSync.length > 0) {
          await client.query(`DELETE FROM damage_zones WHERE report_id = $1;`, [actualReportId]);

          for (const f of floorsToSync) {
            const zones = Array.isArray(f.zones) ? f.zones : [];
            for (const z of zones) {
              const compType = normalizeComponentType(z.componentType || z.customComponentType);
              const zRes = await client.query<{ id: string }>(
                `INSERT INTO damage_zones (
                   report_id, zone_code, floor_name, room_name, component_type,
                   wall_material, functional_impact_repair_needed, burland_grade,
                   ctx_photo_url, notes
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING id;`,
                [
                  actualReportId,
                  z.zoneCode || z.zone_code || 'Z-01',
                  z.floorName || z.floor_name || f.floorName || 'Tầng trệt',
                  z.roomName || z.room_name || 'Không gian chính',
                  compType,
                  z.wallMaterial || z.wall_material || null,
                  Boolean(z.functionalImpactRepairNeeded),
                  Number(z.burlandGrade ?? z.burland_grade) || 0,
                  z.ctxPhotoUrl || z.ctx_photo_url || '',
                  z.notes || null,
                ]
              );

              const zoneId = zRes.rows[0]?.id;
              const defects = Array.isArray(z.defects) ? z.defects : [];
              if (zoneId && defects.length > 0) {
                for (const d of defects) {
                  const actState = ['A', 'S', 'U'].includes(d.activityState) ? d.activityState : 'U';
                  const primaryCuUrl = d.cuPhotos?.[0] || d.cuPhotoUrl || d.cu_photo_url || '';
                  const extraCuUrl = d.cuPhotos?.[1] || d.extraPhotoUrl || null;
                  const cuPhotosList = Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0
                    ? d.cuPhotos
                    : (primaryCuUrl ? [primaryCuUrl] : []);
                  const cuPhotosJson = JSON.stringify(cuPhotosList);
                  const primaryCuCode = d.cuPhotoCodes?.[0] || d.cuPhotoCode || d.cu_photo_code || null;

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
                      d.defectCode || d.defect_code || 'D-01',
                      Number(d.pinX ?? d.pin_x) || 0,
                      Number(d.pinY ?? d.pin_y) || 0,
                      d.screeningCategory || d.defectType || 'CRACK',
                      d.defectType || 'HAIRLINE',
                      d.crackDirection || null,
                      Number(d.widthMaxMm ?? d.width_max_mm) || 0,
                      Number(d.lengthMm ?? d.length_mm) || 0,
                      actState,
                      Number(d.materialDegradationE4) || 0,
                      Number(d.structuralSignificanceE2) || 0,
                      d.hasScaleCard ?? d.has_scale_card ?? true,
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
        }
      }

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
   */
  static async replaceReportPhoto(
    reportId: string,
    adminId: string,
    payload: {
      targetPhotoType: string;
      targetPhotoId?: string;
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
    targetParcelIdOrCode: string,
    adminId: string,
    reason: string,
    clientIp?: string
  ) {
    const repRes = await Database.query<{ id: string; parcel_id: string; zone_id: string; project_parcel_code: string }>(
      `SELECT r.id, r.parcel_id, p.zone_id, p.project_parcel_code 
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       WHERE r.id = $1;`,
      [reportId]
    );
    if (!repRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ với ID: ${reportId}`);
    }
    const oldParcelId = repRes.rows[0].parcel_id;
    const currentZoneId = repRes.rows[0].zone_id;

    // Làm sạch chuỗi đầu vào triệt để (loại bỏ ngoặc vuông [], ngoặc kép "", ngoặc đơn '', escape, khoảng trắng)
    const cleanTarget = (targetParcelIdOrCode || '')
      .trim()
      .replace(/[\[\]"'\\]/g, '')
      .trim();

    if (!cleanTarget) {
      throw new BadRequestError('Mã hoặc ID thửa đất đích không được để trống');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanTarget);
    const targetRes = await Database.query<{ id: string; project_parcel_code: string; zone_id: string }>(
      isUuid
        ? `SELECT id, project_parcel_code, zone_id FROM parcels WHERE id = $1;`
        : `SELECT id, project_parcel_code, zone_id FROM parcels 
           WHERE (
             project_parcel_code = $1 
             OR official_cadastral_code = $1
             OR project_parcel_code ILIKE $1
             OR official_cadastral_code ILIKE $1
             OR (project_parcel_code ILIKE ('%' || $1) AND zone_id = $2)
           )
           ORDER BY 
             (CASE WHEN project_parcel_code = $1 THEN 1 WHEN project_parcel_code ILIKE $1 THEN 2 ELSE 3 END) ASC
           LIMIT 1;`,
      isUuid ? [cleanTarget] : [cleanTarget, currentZoneId]
    );

    const targetParcel = targetRes.rows[0];
    if (!targetParcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất đích với thông tin: [${cleanTarget}]. Vui lòng kiểm tra lại mã dự án hoặc mã địa chính.`);
    }

    if (oldParcelId === targetParcel.id) {
      throw new BadRequestError(`Thửa đất đích [${targetParcel.project_parcel_code}] trùng với thửa đất hiện tại của hồ sơ`);
    }

    if (targetParcel.zone_id && currentZoneId && targetParcel.zone_id !== currentZoneId) {
      throw new BadRequestError(
        `Thửa đất đích [${targetParcel.project_parcel_code}] thuộc phân khu ${targetParcel.zone_id}, khác với phân khu ${currentZoneId} của hồ sơ hiện tại. Không thể hoán đổi liên phân khu!`
      );
    }

    const swapResult = await CadastralService.swapParcelGeometries(
      oldParcelId,
      targetParcel.id,
      adminId,
      reason || 'Điều chuyển vị trí ranh đất không gian GIS do KSV tích nhầm polygon trên bản đồ',
      clientIp
    );

    return {
      success: true,
      message: swapResult.message,
      reportId,
      oldParcelId,
      targetParcelId: targetParcel.id,
      newParcelCode: swapResult.parcelA.projectParcelCode,
    };
  }

  /**
   * Hoán đổi vị trí ranh đất không gian GIS giữa 2 hồ sơ khảo sát
   */
  static async swapReportParcels(
    reportAId: string,
    reportBId: string,
    adminId: string,
    reason: string,
    clientIp?: string
  ) {
    const repARes = await Database.query<{ id: string; parcel_id: string }>(
      `SELECT id, parcel_id FROM base_survey_reports WHERE id = $1;`,
      [reportAId]
    );
    const repBRes = await Database.query<{ id: string; parcel_id: string }>(
      `SELECT id, parcel_id FROM base_survey_reports WHERE id = $1;`,
      [reportBId]
    );

    if (!repARes.rows[0]) throw new NotFoundError(`Không tìm thấy hồ sơ A với ID: ${reportAId}`);
    if (!repBRes.rows[0]) throw new NotFoundError(`Không tìm thấy hồ sơ B với ID: ${reportBId}`);

    const parcelAId = repARes.rows[0].parcel_id;
    const parcelBId = repBRes.rows[0].parcel_id;

    if (parcelAId === parcelBId) {
      throw new BadRequestError('Hai hồ sơ đang thuộc cùng một thửa đất, không thể hoán đổi');
    }

    const swapResult = await CadastralService.swapParcelGeometries(
      parcelAId,
      parcelBId,
      adminId,
      reason || 'Hoán đổi vị trí ranh đất không gian GIS giữa 2 hồ sơ liền kề bị tích chéo',
      clientIp
    );

    return {
      success: true,
      message: swapResult.message,
      reportAId,
      reportBId,
      swappedParcels: {
        reportA: swapResult.parcelA,
        reportB: swapResult.parcelB,
      },
    };
  }

  /**
   * Tìm kiếm danh sách hồ sơ trong phân khu khả dĩ để hoán đổi chéo (SWAP)
   */
  static async searchSwapCandidates(
    zoneId?: string,
    excludeReportId?: string,
    search?: string
  ) {
    const params: any[] = [];
    let whereClause = `WHERE 1=1`;

    if (zoneId) {
      params.push(zoneId);
      whereClause += ` AND p.zone_id = $${params.length}`;
    }

    if (excludeReportId) {
      params.push(excludeReportId);
      whereClause += ` AND r.id != $${params.length}::uuid`;
    }

    const cleanedSearch = (search || '').trim().replace(/[\[\]"'\\]/g, '').trim();
    if (cleanedSearch) {
      params.push(`%${cleanedSearch}%`);
      const pIdx = params.length;
      whereClause += ` AND (
        p.project_parcel_code ILIKE $${pIdx} OR
        p.official_cadastral_code ILIKE $${pIdx} OR
        p.house_number ILIKE $${pIdx} OR
        p.street ILIKE $${pIdx} OR
        r.report_code ILIKE $${pIdx}
      )`;
    }

    const query = `
      SELECT 
        r.id AS report_id,
        r.report_code,
        r.status AS report_status,
        p.id AS parcel_id,
        p.project_parcel_code,
        p.house_number,
        p.street,
        p.ward,
        p.district,
        u.full_name AS surveyor_name
      FROM base_survey_reports r
      JOIN parcels p ON r.parcel_id = p.id
      LEFT JOIN users u ON r.surveyor_id = u.id
      ${whereClause}
      ORDER BY p.project_parcel_code ASC
      LIMIT 50;
    `;

    const res = await Database.query(query, params);
    return res.rows;
  }
}
