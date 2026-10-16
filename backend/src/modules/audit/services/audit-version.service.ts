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

    // 5. Tự động bảo đảm toàn bộ ảnh hiện trường được lưu dấu vào survey_photo_registry
    try {
      const { AuditModificationService } = await import('./audit-modification.service');
      await AuditModificationService.seedInitialReportPhotos(actualReportId);
    } catch (seedErr: any) {
      console.warn('⚠️ [CREATE SNAPSHOT] Seed registry warning:', seedErr?.message);
    }

    return {
      versionNumber: insertRes.rows[0].version_number,
      id: insertRes.rows[0].id,
    };
  }

  /**
   * Lấy danh sách tóm tắt tất cả phiên bản của một hồ sơ khảo sát
   */
  static async getVersionList(reportId: string): Promise<any[]> {
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

    // Cơ chế Tự Lành (Self-Healing Baseline v0) cho hồ sơ cũ nộp trước khi có Versioning
    if (res.rows.length === 0) {
      try {
        const repInfo = await Database.query<{ surveyor_id: string }>(
          `SELECT surveyor_id FROM base_survey_reports WHERE id = $1;`,
          [actualReportId]
        );
        await this.createSnapshot(actualReportId, {
          versionTag: 'ORIGINAL_SUBMISSION',
          title: 'Bản nộp thực địa ban đầu',
          editReason: 'Khởi tạo phiên bản cơ sở tự động (Auto-Seed Baseline v0)',
          userId: repInfo.rows[0]?.surveyor_id,
        });
        return this.getVersionList(reportId);
      } catch (seedErr: any) {
        console.warn('⚠️ [SELF-HEALING BASELINE] Không thể tự động tạo v0 trong getVersionList:', seedErr?.message);
      }
    }

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
  static async getVersionSnapshot(reportId: string, versionNumber: number): Promise<any> {
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
      // Nếu yêu cầu v0 mà hồ sơ chưa có bất kỳ version nào, tự động seed v0 ngay lập tức!
      if (versionNumber === 0) {
        const countRes = await Database.query<{ count: string }>(
          `SELECT count(*) FROM survey_report_versions WHERE report_id = $1;`,
          [actualReportId]
        );
        if (Number(countRes.rows[0]?.count || 0) === 0) {
          try {
            const repInfo = await Database.query<{ surveyor_id: string }>(
              `SELECT surveyor_id FROM base_survey_reports WHERE id = $1;`,
              [actualReportId]
            );
            await this.createSnapshot(actualReportId, {
              versionTag: 'ORIGINAL_SUBMISSION',
              title: 'Bản nộp thực địa ban đầu',
              editReason: 'Khởi tạo phiên bản cơ sở tự động (Auto-Seed Baseline v0)',
              userId: repInfo.rows[0]?.surveyor_id,
            });
            return this.getVersionSnapshot(reportId, 0);
          } catch (seedErr: any) {
            console.warn('⚠️ [SELF-HEALING BASELINE] Lỗi khi tạo v0 trong getVersionSnapshot:', seedErr?.message);
          }
        }
      }
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
           status = 'UNDER_REVIEW',
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
      const specs = leftPane.buildingSpecs || leftPane.specs || snap.buildingSpecs || {};
      const bFloorCount = specs.floor_count ?? specs.floorCount ?? specs.aboveFloors;
      const bBasementCount = specs.basement_count ?? specs.basementCount ?? specs.undergroundFloors;
      const bBuildingName = specs.building_name ?? specs.buildingName;
      const bLandUse = specs.land_use_function ?? specs.landUseFunction ?? specs.usageFunction;
      const bYear = specs.year_of_construction ?? specs.yearOfConstruction ?? specs.constructionYear;
      const bIsYearEstimated = specs.is_year_estimated ?? specs.isYearEstimated ?? specs.isEstimatedYear;
      const bFoundationDepth = specs.foundation_depth_m ?? specs.foundationDepthM;
      const bFoundationDensity = specs.foundation_density ?? specs.foundationDensity;
      const bFoundationSpacing = specs.foundation_spacing_m ?? specs.foundationSpacingM;
      const bFoundationNotes = specs.foundation_notes ?? specs.foundationNotes;

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
          bBuildingName || null,
          bFloorCount !== undefined && bFloorCount !== null ? Number(bFloorCount) : null,
          bBasementCount !== undefined && bBasementCount !== null ? Number(bBasementCount) : null,
          bLandUse || null,
          bYear !== undefined && bYear !== null ? Number(bYear) : null,
          bIsYearEstimated !== undefined && bIsYearEstimated !== null ? Boolean(bIsYearEstimated) : null,
          bFoundationDepth !== undefined && bFoundationDepth !== null ? Number(bFoundationDepth) : null,
          bFoundationDensity !== undefined && bFoundationDensity !== null ? Number(bFoundationDensity) : null,
          bFoundationSpacing !== undefined && bFoundationSpacing !== null ? Number(bFoundationSpacing) : null,
          bFoundationNotes || null,
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
      const def = leftPane.deformation || snap.deformation || leftPane.settlementTilt || snap.settlementTilt || {};
      const tilt = def.buildingTilt || def.settlementTilt || {};
      const beam = def.beamSagging || {};

      const tiltX = def.tilt_angle_x ?? def.tiltAngleX ?? (tilt.xPermille !== undefined ? Number(tilt.xPermille) / 10 : (tilt.tilt_x_permille !== undefined ? Number(tilt.tilt_x_permille) / 10 : null));
      const tiltY = def.tilt_angle_y ?? def.tiltAngleY ?? (tilt.yPermille !== undefined ? Number(tilt.yPermille) / 10 : (tilt.tilt_y_permille !== undefined ? Number(tilt.tilt_y_permille) / 10 : null));
      const tiltDir = def.tilt_direction ?? def.tiltDirection ?? tilt.direction ?? tilt.tilt_direction ?? null;
      const beamSag = def.beam_deflection_mm ?? def.beamDeflectionMm ?? beam.sagMm ?? beam.beam_deflection_mm ?? null;

      await client.query(
        `UPDATE deformation_assessments SET
           tilt_angle_x = COALESCE($1, tilt_angle_x),
           tilt_angle_y = COALESCE($2, tilt_angle_y),
           tilt_direction = COALESCE($3, tilt_direction),
           beam_deflection_mm = COALESCE($4, beam_deflection_mm)
         WHERE report_id = $5;`,
        [
          tiltX !== null && tiltX !== undefined ? Number(tiltX) : null,
          tiltY !== null && tiltY !== undefined ? Number(tiltY) : null,
          tiltDir || null,
          beamSag !== null && beamSag !== undefined ? Number(beamSag) : null,
          actualReportId,
        ]
      );

      // 4.5. Khôi phục risk_score_cards phòng thủ động (Defensive Dynamic Update)
      const rc = rightPane.riskCard || snap.riskCard || leftPane.riskScoreCard || snap.riskScoreCard || {};
      if (rc && (rc.e1_burland_score !== undefined || rc.total_ecs_score !== undefined || rc.total_ecs !== undefined)) {
        const colCheckRes = await client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'risk_score_cards';`
        );
        const availableCols = new Set(colCheckRes.rows.map((r: any) => r.column_name));

        const updateFields: string[] = [];
        const updateParams: any[] = [];
        let pIdx = 1;

        const addField = (colName: string, val: any, castSql = '') => {
          if (availableCols.has(colName)) {
            updateFields.push(`${colName} = $${pIdx++}${castSql}`);
            updateParams.push(val);
          }
        };

        const addCoalesceField = (colName: string, val: any, castSql = '') => {
          if (availableCols.has(colName)) {
            updateFields.push(`${colName} = COALESCE($${pIdx++}${castSql}, ${colName})`);
            updateParams.push(val);
          }
        };

        addCoalesceField('e1_burland_score', rc.e1_burland_score !== undefined ? Number(rc.e1_burland_score) : null);
        addCoalesceField('e2_structure_score', (rc.e2_structure_score ?? rc.e2_crack_structural_score) !== undefined ? Number(rc.e2_structure_score ?? rc.e2_crack_structural_score) : null);
        addCoalesceField('e3_deformation_score', rc.e3_deformation_score !== undefined ? Number(rc.e3_deformation_score) : null);
        addCoalesceField('e4_material_score', (rc.e4_material_score ?? rc.e4_material_degradation_score) !== undefined ? Number(rc.e4_material_score ?? rc.e4_material_degradation_score) : null);
        addCoalesceField('e5_history_score', rc.e5_history_score !== undefined ? Number(rc.e5_history_score) : null);
        addCoalesceField('e6_overall_function_score', (rc.e6_overall_function_score ?? rc.e6_secondary_score) !== undefined ? Number(rc.e6_overall_function_score ?? rc.e6_secondary_score) : null);
        addCoalesceField('total_ecs_score', (rc.total_ecs_score ?? rc.total_ecs) !== undefined ? Number(rc.total_ecs_score ?? rc.total_ecs) : null);
        addCoalesceField('ecs_class', rc.ecs_class || rc.ecs_category || null, '::ecs_class_enum');
        addCoalesceField('avg_vi_score', (rc.avg_vi_score ?? rc.avg_vi) !== undefined ? Number(rc.avg_vi_score ?? rc.avg_vi) : null);
        addCoalesceField('vi_class', rc.vi_class || rc.vi_category || null, '::vi_class_enum');
        addCoalesceField('building_risk_assessment_bra', rc.building_risk_assessment_bra || rc.bra || rc.bra_score || null);
        addCoalesceField('construction_impact_level_i', (rc.construction_impact_level_i ?? rc.impact_level) !== undefined ? Number(rc.construction_impact_level_i ?? rc.impact_level) : null);
        addCoalesceField('is_engineering_judgement_applied', rc.is_engineering_judgement_applied !== undefined ? Boolean(rc.is_engineering_judgement_applied) : null);
        addCoalesceField('engineering_judgement_action', rc.engineering_judgement_action || null);
        addCoalesceField('engineering_judgement_reason', rc.engineering_judgement_reason || null);

        // Các cột override phán quyết kỹ thuật (chỉ update nếu bảng CSDL có cột)
        addField('overridden_burland_grade', rc.overridden_burland_grade !== undefined ? (rc.overridden_burland_grade !== null ? Number(rc.overridden_burland_grade) : null) : null);
        addField('overridden_total_ecs', rc.overridden_total_ecs !== undefined ? (rc.overridden_total_ecs !== null ? Number(rc.overridden_total_ecs) : null) : null);
        addField('overridden_ecs_class', rc.overridden_ecs_class || null);
        addField('overridden_importance_score', rc.overridden_importance_score !== undefined ? (rc.overridden_importance_score !== null ? Number(rc.overridden_importance_score) : null) : null);
        addField('overridden_avg_vi', rc.overridden_avg_vi !== undefined ? (rc.overridden_avg_vi !== null ? Number(rc.overridden_avg_vi) : null) : null);
        addField('overridden_vi_class', rc.overridden_vi_class || null);
        addField('overridden_impact_level_i', rc.overridden_impact_level_i !== undefined ? (rc.overridden_impact_level_i !== null ? Number(rc.overridden_impact_level_i) : null) : null);
        addField('overridden_bra', rc.overridden_bra || null);
        addField('judgement_engineer_name', rc.judgement_engineer_name || null);
        addField('judgement_applied_at', rc.judgement_applied_at || null);

        if (updateFields.length > 0) {
          updateParams.push(actualReportId);
          await client.query(
            `UPDATE risk_score_cards SET ${updateFields.join(', ')} WHERE report_id = $${pIdx};`,
            updateParams
          );
        }
      }

      // 4.6. Khôi phục bảng parcels
      const pInfo = snap.parcel || leftPane.parcel || snap.parcelInfo || {
        houseNumber: snap.houseNumber || sJson.houseNumber,
        street: snap.street || sJson.street,
        ward: snap.ward || sJson.ward,
        district: snap.district || sJson.district,
        ownerName: snap.ownerName || sJson.ownerName,
        ownerPhone: snap.ownerPhone || sJson.ownerPhone,
        officialCadastralCode: snap.officialCadastralCode || sJson.officialCadastralCode,
        frontageWidth: snap.frontageWidth ?? sJson.frontageWidth,
        lotDepth: snap.lotDepth ?? sJson.lotDepth,
        landAreaM2: snap.landAreaM2 ?? sJson.landAreaM2,
        constructionAreaM2: snap.constructionAreaM2 ?? sJson.constructionAreaM2,
        floorCount: snap.floorCount ?? sJson.floorCount ?? sJson.aboveFloors,
      };

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
             survey_status = 'SUBMITTED',
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
            (pInfo.floorCount !== undefined && pInfo.floorCount !== '') ? Number(pInfo.floorCount) : ((pInfo.aboveFloors !== undefined && pInfo.aboveFloors !== '') ? Number(pInfo.aboveFloors) : null),
            actualReportId,
          ]
        );
      }

      // 4.7. Khôi phục survey_identification_photos (P01..P04)
      const rawIdPhotos = leftPane.identPhotos || rightPane.identificationPhotos || snap.identificationPhotos || [];
      const idPhotosList: any[] = [];
      if (Array.isArray(rawIdPhotos)) {
        idPhotosList.push(...rawIdPhotos);
      } else if (typeof rawIdPhotos === 'object' && rawIdPhotos !== null) {
        if (rawIdPhotos.photoP01) idPhotosList.push({ photo_type: 'P01_HOUSE_NUMBER', ...rawIdPhotos.photoP01 });
        if (rawIdPhotos.photoP02) idPhotosList.push({ photo_type: 'P02_MAIN_FACADE', ...rawIdPhotos.photoP02 });
        if (rawIdPhotos.photoP03) idPhotosList.push({ photo_type: 'P03_SIDE_OR_REAR', ...rawIdPhotos.photoP03 });
        if (rawIdPhotos.photoP04) idPhotosList.push({ photo_type: 'P04_CONTEXT_STREET', ...rawIdPhotos.photoP04 });
      }

      // Bổ sung từ surveyJson của snapshot nếu idPhotosList chưa đủ
      if (sJson.photoP01 && !idPhotosList.some((p) => (p.photo_type || p.photoType)?.includes('P01'))) {
        idPhotosList.push({ photo_type: 'P01_HOUSE_NUMBER', ...sJson.photoP01 });
      }
      if (sJson.photoP02 && !idPhotosList.some((p) => (p.photo_type || p.photoType)?.includes('P02'))) {
        idPhotosList.push({ photo_type: 'P02_MAIN_FACADE', ...sJson.photoP02 });
      }
      if (sJson.photoP03 && !idPhotosList.some((p) => (p.photo_type || p.photoType)?.includes('P03'))) {
        idPhotosList.push({ photo_type: 'P03_SIDE_OR_REAR', ...sJson.photoP03 });
      }
      if (sJson.photoP04 && !idPhotosList.some((p) => (p.photo_type || p.photoType)?.includes('P04'))) {
        idPhotosList.push({ photo_type: 'P04_CONTEXT_STREET', ...sJson.photoP04 });
      }

      const standardTypes = [
        { type: 'P01_HOUSE_NUMBER', defaultCode: 'P-01', shortKey: 'photoP01' },
        { type: 'P02_MAIN_FACADE', defaultCode: 'P-02', shortKey: 'photoP02' },
        { type: 'P03_SIDE_OR_REAR', defaultCode: 'P-03', shortKey: 'photoP03' },
        { type: 'P04_CONTEXT_STREET', defaultCode: 'P-04', shortKey: 'photoP04' },
      ];

      for (const std of standardTypes) {
        const p = idPhotosList.find((x: any) => {
          const pt = (x.photo_type || x.photoType || '').toUpperCase();
          if (std.type === 'P01_HOUSE_NUMBER') return pt === 'P01' || pt === 'P01_HOUSE_NUMBER';
          if (std.type === 'P02_MAIN_FACADE') return pt === 'P02' || pt === 'P02_MAIN_FACADE';
          if (std.type === 'P03_SIDE_OR_REAR') return pt === 'P03' || pt === 'P03_SIDE_REAR' || pt === 'P03_SIDE_OR_REAR';
          if (std.type === 'P04_CONTEXT_STREET') return pt === 'P04' || pt === 'P04_CONTEXT_STREET';
          return false;
        });

        const rawUrl = p?.raw_photo_url || p?.rawPhotoUrl || p?.rawUrl || (p?.annotated_photo_url ? null : p?.url) || null;
        const annoUrl = p?.annotated_photo_url || p?.annotatedPhotoUrl || p?.annotatedUrl || (p?.raw_photo_url ? null : p?.url) || null;
        const pCode = p?.photo_code || p?.photoCode || std.defaultCode;
        const isNa = Boolean(p?.is_not_applicable ?? p?.notApplicable);
        const naR = p?.na_reason || p?.naReason || null;

        // Gán TƯỜNG MINH: nếu snapshot không có ảnh hoặc isNa = true, cleanRawUrl/cleanAnnoUrl sẽ là NULL!
        const cleanRawUrl = (isNa || !rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) ? null : rawUrl.trim();
        const cleanAnnoUrl = (isNa || !annoUrl || typeof annoUrl !== 'string' || !annoUrl.trim()) ? null : annoUrl.trim();

        await client.query(
          `UPDATE survey_identification_photos SET
             raw_photo_url = $1,
             annotated_photo_url = $2,
             photo_code = $3,
             is_not_applicable = $4,
             na_reason = $5
           WHERE report_id = $6 AND (photo_type::text = $7 OR photo_type::text = ANY($8::text[]));`,
          [
            cleanRawUrl,
            cleanAnnoUrl,
            pCode,
            isNa,
            naR,
            actualReportId,
            std.type,
            std.type === 'P03_SIDE_OR_REAR' ? ['P03_SIDE_REAR', 'P03_SIDE_OR_REAR', 'P03'] : [std.type, std.type.split('_')[0]],
          ]
        );

        // Đồng bộ sạch vào survey_data_json để không lưu ảnh ma
        if (!sJson[std.shortKey]) sJson[std.shortKey] = {};
        sJson[std.shortKey].url = (isNa || !cleanRawUrl) ? null : (cleanAnnoUrl || cleanRawUrl);
        sJson[std.shortKey].rawPhotoUrl = cleanRawUrl;
        sJson[std.shortKey].annotatedPhotoUrl = cleanAnnoUrl;
        sJson[std.shortKey].notApplicable = isNa;
        sJson[std.shortKey].naReason = naR;
        sJson[std.shortKey].photoCode = pCode;
      }

      // 4.8. Khôi phục damage_zones và defect_items từ snapshot
      const snapZones = snap.damageZones || leftPane.damageZones || sJson.damageZones || [];
      const snapZoneIdsOrCodes = new Set<string>();
      const snapDefectIdsOrCodes = new Set<string>();

      if (Array.isArray(snapZones) && snapZones.length > 0) {
        for (const z of snapZones) {
          const zId = z.id ? String(z.id) : null;
          const zCode = z.zone_code || z.zoneCode || null;
          if (zId) snapZoneIdsOrCodes.add(zId);
          if (zCode) snapZoneIdsOrCodes.add(zCode);

          const ctxUrl = (z.ctx_photo_url || z.ctxPhotoUrl || '').trim() || null;
          await client.query(
            `UPDATE damage_zones SET
               ctx_photo_url = $1,
               ctx_photo_code = $2,
               notes = $3,
               burland_grade = $4,
               is_deleted = false
             WHERE report_id = $5 AND (id::text = $6 OR zone_code = $7);`,
            [
              ctxUrl,
              z.ctx_photo_code || z.ctxPhotoCode || null,
              z.notes || null,
              z.burland_grade !== undefined ? Number(z.burland_grade) : null,
              actualReportId,
              zId,
              zCode,
            ]
          );

          const defects = Array.isArray(z.defects) ? z.defects : [];
          for (const d of defects) {
            const dId = d.id ? String(d.id) : null;
            const dCode = d.defect_code || d.defectCode || null;
            if (dId) snapDefectIdsOrCodes.add(dId);
            if (dCode) snapDefectIdsOrCodes.add(dCode);

            const cuUrl = (d.cu_photo_url || d.cuPhotoUrl || '').trim() || null;
            await client.query(
              `UPDATE defect_items SET
                 cu_photo_url = $1,
                 cu_photos_json = $2,
                 width_max_mm = COALESCE($3, width_max_mm),
                 length_mm = COALESCE($4, length_mm),
                 is_deleted = false
               WHERE id::text = $5 OR defect_code = $6;`,
              [
                cuUrl,
                d.cu_photos_json ? JSON.stringify(d.cu_photos_json) : (cuUrl ? JSON.stringify([cuUrl]) : '[]'),
                d.width_max_mm !== undefined ? Number(d.width_max_mm) : null,
                d.length_mm !== undefined ? Number(d.length_mm) : null,
                dId,
                dCode,
              ]
            );
          }
        }
      }

      // Đánh dấu xóa mềm (is_deleted = true) cho bất kỳ defect_items hoặc damage_zones phát sinh sau đó mà không thuộc snapshot đích
      if (snapDefectIdsOrCodes.size > 0) {
        await client.query(
          `UPDATE defect_items SET is_deleted = true
           WHERE zone_id IN (SELECT id FROM damage_zones WHERE report_id = $1)
             AND NOT (id::text = ANY($2::text[]) OR defect_code = ANY($2::text[]));`,
          [actualReportId, Array.from(snapDefectIdsOrCodes)]
        );
      } else {
        await client.query(
          `UPDATE defect_items SET is_deleted = true
           WHERE zone_id IN (SELECT id FROM damage_zones WHERE report_id = $1);`,
          [actualReportId]
        );
      }

      if (snapZoneIdsOrCodes.size > 0) {
        await client.query(
          `UPDATE damage_zones SET is_deleted = true
           WHERE report_id = $1
             AND NOT (id::text = ANY($2::text[]) OR zone_code = ANY($2::text[]));`,
          [actualReportId, Array.from(snapZoneIdsOrCodes)]
        );
      } else {
        await client.query(
          `UPDATE damage_zones SET is_deleted = true WHERE report_id = $1;`,
          [actualReportId]
        );
      }

      // 4.9. Đồng bộ Sổ cái Vòng đời Ảnh (survey_photo_registry) theo chuẩn Time-Travel Alignment
      try {
        const restoredPhotoUrls: string[] = [];
        const collectUrl = (u: any) => {
          if (typeof u === 'string' && u.trim().length > 0) {
            restoredPhotoUrls.push(u.trim());
          }
        };

        // Ảnh nhận diện P01..P04
        if (Array.isArray(idPhotosList)) {
          idPhotosList.forEach((p: any) => {
            if (!p.is_not_applicable && !p.notApplicable) {
              collectUrl(p.raw_photo_url || p.rawPhotoUrl || p.rawUrl || p.url);
              collectUrl(p.annotated_photo_url || p.annotatedPhotoUrl || p.annotatedUrl || p.url);
            }
          });
        }

        // Ảnh vùng hư hại và khuyết tật
        if (Array.isArray(snapZones)) {
          snapZones.forEach((z: any) => {
            collectUrl(z.ctx_photo_url || z.ctxPhotoUrl);
            if (Array.isArray(z.overview_photos)) z.overview_photos.forEach(collectUrl);
            if (Array.isArray(z.overviewPhotos)) z.overviewPhotos.forEach(collectUrl);
            const defs = Array.isArray(z.defects) ? z.defects : [];
            defs.forEach((d: any) => {
              collectUrl(d.cu_photo_url || d.cuPhotoUrl);
              const cuList = Array.isArray(d.cu_photos_json) ? d.cu_photos_json : (Array.isArray(d.cuPhotos) ? d.cuPhotos : []);
              cuList.forEach((cuItem: any) => {
                if (typeof cuItem === 'string') collectUrl(cuItem);
                else if (cuItem && typeof cuItem.url === 'string') collectUrl(cuItem.url);
              });
            });
          });
        }

        // Lún nghiêng & võng dầm Step 5
        const snapSt = snap.settlementTilt || leftPane.settlementTilt || sJson.settlementTilt || {};
        if (Array.isArray(snapSt.beamSagging?.photos)) {
          snapSt.beamSagging.photos.forEach((p: any) => collectUrl(typeof p === 'string' ? p : p?.url));
        }
        if (Array.isArray(snapSt.diffSettlement?.photos)) {
          snapSt.diffSettlement.photos.forEach((p: any) => collectUrl(typeof p === 'string' ? p : p?.url));
        }
        if (Array.isArray(snapSt.buildingTilt?.photos)) {
          snapSt.buildingTilt.photos.forEach((p: any) => collectUrl(typeof p === 'string' ? p : p?.url));
        }

        // Đất trống & công trình dở dang
        if (Array.isArray(sJson.vacantLandPhotos)) {
          sJson.vacantLandPhotos.forEach((p: any) => collectUrl(typeof p === 'string' ? p : p?.url));
        }
        if (Array.isArray(sJson.underConstructionPhotos)) {
          sJson.underConstructionPhotos.forEach((p: any) => collectUrl(typeof p === 'string' ? p : p?.url));
        }

        // Chữ ký và biên bản làm việc
        const sigs = snap.signatures || leftPane.signatures || sJson.signatures || {};
        collectUrl(snap.surveyorSignatureUrl || sJson.surveyorSignatureUrl || sigs.surveyorSignatureUrl);
        collectUrl(snap.ownerSignatureUrl || sJson.ownerSignatureUrl || sigs.ownerSignatureUrl);
        const minutes = Array.isArray(sigs.workingMinutesPhotos) ? sigs.workingMinutesPhotos : (Array.isArray(sJson.workingMinutesPhotos) ? sJson.workingMinutesPhotos : []);
        minutes.forEach(collectUrl);

        const uniqueUrls = Array.from(new Set(restoredPhotoUrls));
        if (uniqueUrls.length > 0) {
          // 1. Kích hoạt lại toàn bộ ảnh thuộc snapshot được khôi phục
          await client.query(
            `UPDATE survey_photo_registry SET
               status = 'ACTIVE',
               is_deleted = false,
               updated_at = NOW()
             WHERE report_id = $1 AND photo_url = ANY($2);`,
            [actualReportId, uniqueUrls]
          );

          // 2. Chuyển các ảnh phát sinh sau đó sang SUPERSEDED (bảo toàn 100% file gốc và lịch sử phả hệ)
          await client.query(
            `UPDATE survey_photo_registry SET
               status = 'SUPERSEDED',
               updated_at = NOW()
             WHERE report_id = $1 AND NOT (photo_url = ANY($2));`,
            [actualReportId, uniqueUrls]
          );
        } else {
          // Snapshot đích hoàn toàn không có ảnh nào -> Toàn bộ ảnh phát sinh chuyển sang SUPERSEDED
          await client.query(
            `UPDATE survey_photo_registry SET
               status = 'SUPERSEDED',
               updated_at = NOW()
             WHERE report_id = $1;`,
            [actualReportId]
          );
        }
      } catch (regErr: any) {
        console.warn('⚠️ [PHOTO REGISTRY ROLLBACK SYNC WARNING]:', regErr?.message);
      }

      // 4.10. Lấy số phiên bản mới tiếp theo
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
