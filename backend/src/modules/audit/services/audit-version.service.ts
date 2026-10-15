import { Database } from '../../../database/db';
import { NotFoundError, BadRequestError, UnauthorizedError, ForbiddenError } from '../../../common/errors/problem-details';
import { CryptoUtils } from '../../../common/utils/crypto.utils';
import { AuditReviewService } from './audit-review.service';

export interface CreateSnapshotParams {
  versionTag: 'ORIGINAL_SUBMISSION' | 'ADMIN_DIFF_SAVE' | 'CHIEF_ENGINEER_OVERRIDE' | 'PHOTO_REPLACEMENT' | 'PHOTO_MODIFICATION' | 'PHOTO_RESTORE' | 'ROLLBACK_RESTORE' | 'REVERT_TO_DRAFT';
  title: string;
  editReason?: string;
  userId?: string;
  clientIp?: string;
  diffSummary?: any[];
  customSnapshotData?: any;
}

export class AuditVersionService {
  /**
   * Tạo bản chụp Snapshot bất biến cho hồ sơ khảo sát
   */
  static async createSnapshot(reportId: string, params: CreateSnapshotParams): Promise<{ versionNumber: number; id: string }> {
    // 1. Kiểm tra hồ sơ tồn tại
    const repRes = await Database.query<{ id: string }>(
      `SELECT id FROM base_survey_reports WHERE id = $1 OR parcel_id = $1 LIMIT 1;`,
      [reportId]
    );
    if (!repRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }
    const actualReportId = repRes.rows[0].id;

    // 2. Lấy số phiên bản tiếp theo
    const maxVerRes = await Database.query<{ max_ver: number | null }>(
      `SELECT MAX(version_number) AS max_ver FROM survey_report_versions WHERE report_id = $1;`,
      [actualReportId]
    );
    const currentMax = maxVerRes.rows[0]?.max_ver;
    const nextVer = currentMax !== null && currentMax !== undefined ? Number(currentMax) + 1 : 0;

    // 3. Chuẩn bị dữ liệu snapshot
    let snapshotData = params.customSnapshotData;
    if (!snapshotData) {
      const fullView = await AuditReviewService.getSplitPaneAuditView(actualReportId);
      // Loại bỏ auditHistory để tránh lồng nhau gây phình to vô ích
      const { auditHistory, ...cleanedView } = fullView as any;
      snapshotData = cleanedView;
    }

    let safeUserId = params.userId || null;
    if (safeUserId) {
      const uCheck = await Database.query<{ id: string }>(`SELECT id FROM users WHERE id = $1;`, [safeUserId]);
      if (!uCheck.rows[0]) safeUserId = null;
    }

    // 4. Lưu vào survey_report_versions
    const insertRes = await Database.query<{ id: string; version_number: number }>(
      `INSERT INTO survey_report_versions (
         report_id, version_number, version_tag, title, edit_reason,
         snapshot_data, diff_summary, created_by_user_id, client_ip
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, version_number;`,
      [
        actualReportId,
        nextVer,
        params.versionTag,
        params.title,
        params.editReason || null,
        JSON.stringify(snapshotData),
        params.diffSummary ? JSON.stringify(params.diffSummary) : null,
        safeUserId,
        params.clientIp || null,
      ]
    );

    return {
      versionNumber: insertRes.rows[0].version_number,
      id: insertRes.rows[0].id,
    };
  }

  /**
   * Lấy danh sách tóm tắt tất cả phiên bản của một hồ sơ khảo sát
   */
  static async getVersionList(reportId: string) {
    const repRes = await Database.query<{ id: string }>(
      `SELECT id FROM base_survey_reports WHERE id = $1 OR parcel_id = $1 LIMIT 1;`,
      [reportId]
    );
    if (!repRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ với ID: ${reportId}`);
    }
    const actualReportId = repRes.rows[0].id;

    const res = await Database.query(
      `SELECT v.id,
              v.version_number,
              v.version_tag,
              v.title,
              v.edit_reason,
              v.created_at,
              v.created_by_user_id,
              v.client_ip,
              COALESCE(u.full_name, 'Hệ thống') AS created_by_name,
              COALESCE(u.role::text, 'SYSTEM') AS created_by_role,
              jsonb_array_length(COALESCE(v.diff_summary, '[]'::jsonb)) AS diff_count
       FROM survey_report_versions v
       LEFT JOIN users u ON v.created_by_user_id = u.id
       WHERE v.report_id = $1
       ORDER BY v.version_number DESC;`,
      [actualReportId]
    );

    return res.rows.map((row: any) => ({
      id: row.id,
      versionNumber: row.version_number,
      versionTag: row.version_tag,
      title: row.title,
      editReason: row.edit_reason,
      createdAt: row.created_at,
      createdByName: row.created_by_name,
      createdByRole: row.created_by_role,
      clientIp: row.client_ip,
      diffCount: Number(row.diff_count) || 0,
    }));
  }

  /**
   * Lấy chi tiết snapshot của một phiên bản cụ thể
   */
  static async getVersionSnapshot(reportId: string, versionNumber: number) {
    const repRes = await Database.query<{ id: string }>(
      `SELECT id FROM base_survey_reports WHERE id = $1 OR parcel_id = $1 LIMIT 1;`,
      [reportId]
    );
    if (!repRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ với ID: ${reportId}`);
    }
    const actualReportId = repRes.rows[0].id;

    const res = await Database.query(
      `SELECT v.*,
              COALESCE(u.full_name, 'Hệ thống') AS created_by_name,
              COALESCE(u.role::text, 'SYSTEM') AS created_by_role
       FROM survey_report_versions v
       LEFT JOIN users u ON v.created_by_user_id = u.id
       WHERE v.report_id = $1 AND v.version_number = $2;`,
      [actualReportId, versionNumber]
    );

    if (!res.rows[0]) {
      throw new NotFoundError(`Không tìm thấy phiên bản v${versionNumber} của hồ sơ`);
    }

    const row = res.rows[0];
    return {
      id: row.id,
      reportId: row.report_id,
      versionNumber: row.version_number,
      versionTag: row.version_tag,
      title: row.title,
      editReason: row.edit_reason,
      createdAt: row.created_at,
      createdByName: row.created_by_name,
      createdByRole: row.created_by_role,
      snapshotData: row.snapshot_data,
      diffSummary: row.diff_summary || [],
    };
  }

  /**
   * Thực hiện khôi phục hồ sơ về phiên bản chỉ định (Rollback)
   * Tuân thủ Append-Only: tạo ra phiên bản mới v(n+1) có nội dung giống hệt phiên bản đích, giữ nguyên lịch sử.
   */
  static async rollbackToVersion(
    reportId: string,
    targetVersionNumber: number,
    adminId: string,
    payload: {
      reason: string;
      password?: string;
    },
    clientIp?: string
  ) {
    // 1. Kiểm tra lý do bắt buộc
    if (!payload.reason || !payload.reason.trim()) {
      throw new BadRequestError('Vui lòng nhập lý do kỹ thuật bắt buộc khi khôi phục phiên bản hồ sơ.');
    }

    // 2. Xác thực mật khẩu người dùng
    if (!payload.password || !payload.password.trim()) {
      throw new BadRequestError('Vui lòng nhập mật khẩu tài khoản để xác thực quyền khôi phục phiên bản.');
    }

    const userRes = await Database.query<{ id: string; password_hash: string; role: string; full_name: string }>(
      `SELECT id, password_hash, role, full_name FROM users WHERE id = $1;`,
      [adminId]
    );
    if (!userRes.rows[0]) {
      throw new UnauthorizedError('Người dùng không tồn tại hoặc phiên đăng nhập không hợp lệ.');
    }
    const adminUser = userRes.rows[0];

    // Kiểm tra quyền: Chỉ KST, Zone Admin hoặc Admin hệ thống
    const allowedRoles = ['CHIEF_ENGINEER', 'ZONE_ADMIN', 'ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(adminUser.role.toUpperCase())) {
      throw new ForbiddenError('Chỉ Kỹ Sư Trưởng hoặc Quản Trị Viên Phân Khu mới có thẩm quyền khôi phục phiên bản hồ sơ.');
    }

    const isMatch = await CryptoUtils.comparePassword(payload.password.trim(), adminUser.password_hash);
    if (!isMatch) {
      throw new BadRequestError('Mật khẩu xác thực không chính xác! Không thể thực hiện khôi phục phiên bản.');
    }

    // 3. Lấy dữ liệu của phiên bản đích
    const targetVer = await this.getVersionSnapshot(reportId, targetVersionNumber);
    const snap = targetVer.snapshotData;
    const actualReportId = targetVer.reportId;

    // 4. Thực thi khôi phục trong Transaction
    return Database.transaction(async (client) => {
      // 4.1. Khôi phục base_survey_reports
      const sJson = snap.surveyJson || snap.survey_data_json || {};
      const rightPane = snap.rightPane || {};
      const leftPane = snap.leftPane || {};

      await client.query(
        `UPDATE base_survey_reports SET
           survey_data_json = $1,
           surveyor_signature_url = COALESCE($2, surveyor_signature_url),
           owner_signature_url = COALESCE($3, owner_signature_url),
           summary_conclusions = COALESCE($4, summary_conclusions),
           engineering_recommendations = COALESCE($5, engineering_recommendations),
           updated_at = NOW()
         WHERE id = $6;`,
        [
          JSON.stringify(sJson),
          snap.surveyorSignatureUrl || sJson.surveyorSignatureUrl || null,
          snap.ownerSignatureUrl || sJson.ownerSignatureUrl || null,
          snap.summaryConclusions || leftPane.conclusions?.summary || null,
          snap.engineeringRecommendations || leftPane.conclusions?.recommendations || null,
          actualReportId,
        ]
      );

      // 4.2. Khôi phục building_specifications
      const specs = leftPane.specs || snap.buildingSpecs || {};
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
           foundation_notes = COALESCE($10, foundation_notes)
         WHERE report_id = $11;`,
        [
          specs.buildingName || null,
          specs.aboveFloors !== undefined ? Number(specs.aboveFloors) : null,
          specs.undergroundFloors !== undefined ? Number(specs.undergroundFloors) : null,
          specs.usageFunction || null,
          specs.constructionYear !== undefined ? Number(specs.constructionYear) : null,
          specs.isEstimatedYear !== undefined ? Boolean(specs.isEstimatedYear) : null,
          specs.foundationDepthM !== undefined ? Number(specs.foundationDepthM) : null,
          specs.foundationDensity !== undefined ? Number(specs.foundationDensity) : null,
          specs.foundationSpacingM !== undefined ? Number(specs.foundationSpacingM) : null,
          specs.foundationNotes || null,
          actualReportId,
        ]
      );

      // 4.3. Khôi phục historical_sensitivities
      const hi = leftPane.historyInterview || snap.historyInterview || {};
      await client.query(
        `UPDATE historical_sensitivities SET
           extended_or_renovated = COALESCE($1, extended_or_renovated),
           previous_settlement_or_tilt = COALESCE($2, previous_settlement_or_tilt),
           fire_or_accident = COALESCE($3, fire_or_accident),
           details = COALESCE($4, details)
         WHERE report_id = $5;`,
        [
          hi.renovationLoad !== undefined ? Number(hi.renovationLoad) > 0 : null,
          hi.pastSettlement !== undefined ? Number(hi.pastSettlement) > 0 : null,
          hi.fireFloodIncident !== undefined ? Number(hi.fireFloodIncident) > 0 : null,
          hi.renovationNotes || hi.majorRepairNotes || null,
          actualReportId,
        ]
      );

      // 4.4. Khôi phục deformation_assessments
      const def = leftPane.deformation || snap.deformation || {};
      const tilt = def.buildingTilt || {};
      const beam = def.beamSagging || {};
      await client.query(
        `UPDATE deformation_assessments SET
           tilt_angle_x = COALESCE($1, tilt_angle_x),
           tilt_angle_y = COALESCE($2, tilt_angle_y),
           tilt_direction = COALESCE($3, tilt_direction),
           beam_deflection_mm = COALESCE($4, beam_deflection_mm)
         WHERE report_id = $5;`,
        [
          tilt.xPermille !== undefined ? Number(tilt.xPermille) / 10 : null,
          tilt.yPermille !== undefined ? Number(tilt.yPermille) / 10 : null,
          tilt.direction || null,
          beam.sagMm !== undefined ? Number(beam.sagMm) : null,
          actualReportId,
        ]
      );

      // 4.5. Khôi phục risk_score_cards
      const rc = rightPane.riskCard || snap.riskCard || leftPane.riskScoreCard || snap.riskScoreCard || {};
      if (rc && (rc.e1_burland_score !== undefined || rc.total_ecs_score !== undefined || rc.total_ecs !== undefined)) {
        await client.query(
          `UPDATE risk_score_cards SET
             e1_burland_score = COALESCE($1, e1_burland_score),
             e2_structure_score = COALESCE($2, e2_structure_score),
             e3_deformation_score = COALESCE($3, e3_deformation_score),
             e4_material_score = COALESCE($4, e4_material_score),
             e5_history_score = COALESCE($5, e5_history_score),
             e6_overall_function_score = COALESCE($6, e6_overall_function_score),
             total_ecs_score = COALESCE($7, total_ecs_score),
             ecs_class = COALESCE($8::ecs_class_enum, ecs_class),
             avg_vi_score = COALESCE($9, avg_vi_score),
             vi_class = COALESCE($10::vi_class_enum, vi_class),
             building_risk_assessment_bra = COALESCE($11, building_risk_assessment_bra),
             construction_impact_level_i = COALESCE($12, construction_impact_level_i),
             is_engineering_judgement_applied = COALESCE($13, is_engineering_judgement_applied),
             engineering_judgement_action = COALESCE($14, engineering_judgement_action),
             engineering_judgement_reason = COALESCE($15, engineering_judgement_reason),
             overridden_total_ecs = $16,
             overridden_ecs_class = $17,
             overridden_avg_vi = $18,
             overridden_vi_class = $19,
             judgement_engineer_name = $20,
             judgement_applied_at = $21
           WHERE report_id = $22;`,
          [
            rc.e1_burland_score !== undefined ? Number(rc.e1_burland_score) : null,
            (rc.e2_structure_score ?? rc.e2_crack_structural_score) !== undefined ? Number(rc.e2_structure_score ?? rc.e2_crack_structural_score) : null,
            rc.e3_deformation_score !== undefined ? Number(rc.e3_deformation_score) : null,
            (rc.e4_material_score ?? rc.e4_material_degradation_score) !== undefined ? Number(rc.e4_material_score ?? rc.e4_material_degradation_score) : null,
            rc.e5_history_score !== undefined ? Number(rc.e5_history_score) : null,
            (rc.e6_overall_function_score ?? rc.e6_secondary_score) !== undefined ? Number(rc.e6_overall_function_score ?? rc.e6_secondary_score) : null,
            (rc.total_ecs_score ?? rc.total_ecs) !== undefined ? Number(rc.total_ecs_score ?? rc.total_ecs) : null,
            rc.ecs_class || rc.ecs_category || null,
            (rc.avg_vi_score ?? rc.avg_vi) !== undefined ? Number(rc.avg_vi_score ?? rc.avg_vi) : null,
            rc.vi_class || rc.vi_category || null,
            rc.building_risk_assessment_bra || rc.bra || rc.bra_score || null,
            (rc.construction_impact_level_i ?? rc.impact_level) !== undefined ? Number(rc.construction_impact_level_i ?? rc.impact_level) : null,
            rc.is_engineering_judgement_applied !== undefined ? Boolean(rc.is_engineering_judgement_applied) : null,
            rc.engineering_judgement_action || null,
            rc.engineering_judgement_reason || null,
            rc.overridden_total_ecs !== undefined ? (rc.overridden_total_ecs !== null ? Number(rc.overridden_total_ecs) : null) : null,
            rc.overridden_ecs_class || null,
            rc.overridden_avg_vi !== undefined ? (rc.overridden_avg_vi !== null ? Number(rc.overridden_avg_vi) : null) : null,
            rc.overridden_vi_class || null,
            rc.judgement_engineer_name || null,
            rc.judgement_applied_at || null,
            actualReportId,
          ]
        );
      }

      // 4.6. Khôi phục bảng parcels
      const pInfo = leftPane.parcel || snap.parcel || snap.parcelInfo || {};
      if (pInfo && (pInfo.houseNumber || pInfo.house_number || pInfo.ownerName || pInfo.owner_name)) {
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
             updated_at = NOW()
           WHERE id = (SELECT parcel_id FROM base_survey_reports WHERE id = $13);`,
          [
            pInfo.houseNumber || pInfo.house_number || null,
            pInfo.street || null,
            pInfo.ward || null,
            pInfo.district || null,
            pInfo.ownerName || pInfo.owner_name || null,
            pInfo.ownerPhone || pInfo.owner_phone || null,
            pInfo.officialCadastralCode || pInfo.official_cadastral_code || null,
            pInfo.frontageWidth !== undefined && pInfo.frontageWidth !== '' ? Number(pInfo.frontageWidth) : null,
            pInfo.lotDepth !== undefined && pInfo.lotDepth !== '' ? Number(pInfo.lotDepth) : null,
            pInfo.landAreaM2 !== undefined && pInfo.landAreaM2 !== '' ? Number(pInfo.landAreaM2) : null,
            pInfo.constructionAreaM2 !== undefined && pInfo.constructionAreaM2 !== '' ? Number(pInfo.constructionAreaM2) : null,
            pInfo.aboveFloors !== undefined && pInfo.aboveFloors !== '' ? Number(pInfo.aboveFloors) : null,
            actualReportId,
          ]
        );
      }

      // 4.7. Khôi phục survey_identification_photos (P01..P04)
      const idPhotos = snap.identificationPhotos || leftPane.identPhotos || [];
      if (Array.isArray(idPhotos) && idPhotos.length > 0) {
        for (const p of idPhotos) {
          const pType = p.photo_type || p.photoType;
          if (pType) {
            await client.query(
              `UPDATE survey_identification_photos SET
                 raw_photo_url = COALESCE($1, raw_photo_url),
                 annotated_photo_url = COALESCE($2, annotated_photo_url),
                 photo_code = COALESCE($3, photo_code),
                 is_not_applicable = COALESCE($4, is_not_applicable),
                 na_reason = COALESCE($5, na_reason)
               WHERE report_id = $6 AND photo_type = $7;`,
              [
                p.raw_photo_url || p.rawPhotoUrl || null,
                p.annotated_photo_url || p.annotatedPhotoUrl || null,
                p.photo_code || p.photoCode || null,
                p.is_not_applicable !== undefined ? Boolean(p.is_not_applicable) : (p.isNotApplicable !== undefined ? Boolean(p.isNotApplicable) : null),
                p.na_reason || p.naReason || null,
                actualReportId,
                pType,
              ]
            );
          }
        }
      }

      // 4.8. Khôi phục damage_zones và defect_items từ snapshot nếu có
      const snapZones = snap.damageZones || leftPane.damageZones || sJson.damageZones || [];
      if (Array.isArray(snapZones) && snapZones.length > 0) {
        for (const z of snapZones) {
          if (z.id || z.zone_code || z.zoneCode) {
            await client.query(
              `UPDATE damage_zones SET
                 ctx_photo_url = COALESCE($1, ctx_photo_url),
                 ctx_photo_code = COALESCE($2, ctx_photo_code),
                 notes = COALESCE($3, notes),
                 burland_grade = COALESCE($4, burland_grade),
                 is_deleted = false
               WHERE report_id = $5 AND (id::text = $6 OR zone_code = $7);`,
              [
                z.ctx_photo_url || z.ctxPhotoUrl || null,
                z.ctx_photo_code || z.ctxPhotoCode || null,
                z.notes || null,
                z.burland_grade !== undefined ? Number(z.burland_grade) : null,
                actualReportId,
                z.id || null,
                z.zone_code || z.zoneCode || null,
              ]
            );

            const defects = Array.isArray(z.defects) ? z.defects : [];
            for (const d of defects) {
              if (d.id || d.defect_code || d.defectCode) {
                await client.query(
                  `UPDATE defect_items SET
                     cu_photo_url = COALESCE($1, cu_photo_url),
                     cu_photos_json = COALESCE($2, cu_photos_json),
                     width_max_mm = COALESCE($3, width_max_mm),
                     length_mm = COALESCE($4, length_mm),
                     is_deleted = false
                   WHERE id::text = $5 OR defect_code = $6;`,
                  [
                    d.cu_photo_url || d.cuPhotoUrl || null,
                    d.cu_photos_json ? JSON.stringify(d.cu_photos_json) : null,
                    d.width_max_mm !== undefined ? Number(d.width_max_mm) : null,
                    d.length_mm !== undefined ? Number(d.length_mm) : null,
                    d.id || null,
                    d.defect_code || d.defectCode || null,
                  ]
                );
              }
            }
          }
        }
      }

      // 4.9. Lấy số phiên bản mới tiếp theo
      const maxVerRes = await client.query<{ max_ver: number | null }>(
        `SELECT MAX(version_number) AS max_ver FROM survey_report_versions WHERE report_id = $1;`,
        [actualReportId]
      );
      const nextVer = Number(maxVerRes.rows[0]?.max_ver ?? 0) + 1;

      // 4.7. Tạo phiên bản mới đại diện cho lần khôi phục (Append-Only)
      const rollbackTitle = `Khôi phục về phiên bản v${targetVersionNumber} (${targetVer.title})`;
      await client.query(
        `INSERT INTO survey_report_versions (
           report_id, version_number, version_tag, title, edit_reason,
           snapshot_data, diff_summary, created_by_user_id, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
        [
          actualReportId,
          nextVer,
          'ROLLBACK_RESTORE',
          rollbackTitle,
          payload.reason.trim(),
          JSON.stringify(snap),
          JSON.stringify([
            {
              field: 'VERSION_ROLLBACK',
              label: 'Khôi phục phiên bản',
              oldValue: `v${maxVerRes.rows[0]?.max_ver}`,
              newValue: `v${targetVersionNumber}`,
            },
          ]),
          adminId,
          clientIp || null,
        ]
      );

      // 4.8. Ghi nhật ký vào system_audit_logs
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'BASE_SURVEY_REPORT',
          actualReportId,
          'ZONE_ADMIN_ROLLBACK_VERSION',
          adminId,
          JSON.stringify({
            targetVersionNumber,
            newVersionNumber: nextVer,
            reason: payload.reason.trim(),
            restoredFromTitle: targetVer.title,
            timestamp: new Date().toISOString(),
          }),
          clientIp || null,
        ]
      );

      return {
        success: true,
        message: `Đã khôi phục hồ sơ về phiên bản v${targetVersionNumber} thành công! Phiên bản mới được ghi nhận là v${nextVer}.`,
        targetVersionNumber,
        newVersionNumber: nextVer,
        reportId: actualReportId,
      };
    });
  }
}
