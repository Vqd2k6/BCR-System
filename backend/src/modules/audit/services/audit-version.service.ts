import { Database } from '../../../database/db';
import { NotFoundError, BadRequestError, UnauthorizedError, ForbiddenError, ConflictError } from '../../../common/errors/problem-details';
import { CryptoUtils } from '../../../common/utils/crypto.utils';
import { AuditReviewService } from './audit-review.service';
import { normalizeComponentType, normalizeStructuralSystem, normalizeFoundationCategory } from '../../survey/survey.dto';

export interface CreateSnapshotParams {
  versionNumber?: number;
  versionTag: 'ORIGINAL_SUBMISSION' | 'ADMIN_DIFF_SAVE' | 'CHIEF_ENGINEER_OVERRIDE' | 'PHOTO_REPLACEMENT' | 'PHOTO_MODIFICATION' | 'PHOTO_RESTORE' | 'ROLLBACK_RESTORE' | 'REVERT_TO_DRAFT' | 'PARCEL_SWAP';
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
    const nextVer =
      params.versionNumber !== undefined && (currentMax === null || currentMax === undefined)
        ? params.versionNumber
        : currentMax !== null && currentMax !== undefined
          ? Number(currentMax) + 1
          : 0;

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
              CASE WHEN jsonb_typeof(v.diff_summary) = 'array' THEN jsonb_array_length(v.diff_summary) ELSE 0 END AS diff_count
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

    // 3. Lấy dữ liệu của phiên bản đích & kiểm tra khóa bất biến APPROVED
    const targetVer = await this.getVersionSnapshot(reportId, targetVersionNumber);
    const snap = targetVer.snapshotData;
    const actualReportId = targetVer.reportId;

    const currentRepStatusRes = await Database.query<{ status: string }>(
      `SELECT status::text AS status FROM base_survey_reports WHERE id = $1 LIMIT 1;`,
      [actualReportId]
    );
    if (currentRepStatusRes.rows[0]?.status === 'APPROVED') {
      throw new ConflictError(
        'Hồ sơ khảo sát đã được phê duyệt chính thức (APPROVED) và bị khóa bất biến. Chỉ Super Admin mới có quyền mở khóa (Unlock) trước khi khôi phục phiên bản.'
      );
    }

    // 4. Thực thi khôi phục trong Transaction
    return Database.transaction(async (client) => {
      // 4.1. Khôi phục base_survey_reports với Universal Snapshot Reader (hỗ trợ cả V2 Audit View và V3 Release)
      const sJson = snap.surveyJson || snap.survey_data_json || snap.frozenSurveyDataJson || {};
      const rightPane = snap.rightPane || {};
      const leftPane = snap.leftPane || {};
      const pInfo = snap.frozenParcel || snap.parcel || snap.parcelInfo || leftPane.parcel || {};

      const hasSurveyData = sJson && Object.keys(sJson).length > 0;
      const hasParcelData = pInfo && Object.keys(pInfo).length > 0;
      if (!hasSurveyData && !hasParcelData) {
        throw new BadRequestError('Dữ liệu khảo sát trong bản chụp lịch sử này không hợp lệ hoặc bị rỗng. Từ chối hoàn nguyên để bảo vệ an toàn dữ liệu.');
      }
      let finalSurveyJson = sJson;
      if (!hasSurveyData && hasParcelData) {
        finalSurveyJson = {
          houseNumber: pInfo.houseNumber || pInfo.house_number,
          street: pInfo.street,
          ward: pInfo.ward,
          district: pInfo.district,
          ownerName: pInfo.ownerName || pInfo.owner_name,
          damageZones: leftPane.damageZones || [],
          specs: leftPane.buildingSpecs || {},
        };
      }

      await client.query(
        `UPDATE base_survey_reports SET
           survey_data_json = $1,
           surveyor_signature_url = COALESCE($2, surveyor_signature_url),
           owner_signature_url = COALESCE($3, owner_signature_url),
           summary_conclusions = COALESCE($4, summary_conclusions),
           engineering_recommendations = COALESCE($5, engineering_recommendations),
           owner_remarks = COALESCE($6, owner_remarks),
           survey_date = COALESCE($7::timestamptz, survey_date),
           status = 'UNDER_REVIEW',
           updated_at = NOW()
         WHERE id = $8;`,
        [
          JSON.stringify(finalSurveyJson),
          snap.surveyorSignatureUrl || sJson.surveyorSignatureUrl || sJson.signatures?.surveyorSignatureUrl || null,
          snap.ownerSignatureUrl || sJson.ownerSignatureUrl || sJson.signatures?.ownerSignatureUrl || null,
          snap.summaryConclusions || sJson.summaryConclusions || sJson.executiveSummary?.summaryConclusions || leftPane.conclusions?.summary || null,
          snap.engineeringRecommendations || sJson.engineeringRecommendations || sJson.executiveSummary?.specificRecommendationsText || leftPane.conclusions?.recommendations || null,
          snap.ownerRemarks || sJson.ownerFeedback || sJson.ownerRemarks || sJson.signatures?.ownerFeedback || null,
          snap.surveyDate || sJson.surveyDate || null,
          actualReportId,
        ]
      );

      // 4.1b. Khôi phục survey_scopes và building_units (nếu có)
      const accLim = sJson.accessLimitation || {};
      const hasScopeInSnap = sJson.accessLimitation || sJson.inaccessibleAreas !== undefined || sJson.accessibilityLimitations !== undefined || snap.survey_coverage;
      if (hasScopeInSnap) {
        let coverage: 'TOAN_BO' | 'MOT_PHAN' | 'KHONG_THE_TIEP_CAN' = snap.survey_coverage || 'TOAN_BO';
        const accType = accLim.type || sJson.surveyCase;
        if (accType === 'LIMITED') coverage = 'MOT_PHAN';
        else if (accType === 'ABSENT_REFUSED' || accType === 'ABSENTEE' || sJson.isAbsenteeSurvey) coverage = 'KHONG_THE_TIEP_CAN';
        const inaccessible = Array.isArray(accLim.restrictedAreas) && accLim.restrictedAreas.length > 0
          ? accLim.restrictedAreas.join(', ')
          : (sJson.inaccessibleAreas ?? snap.inaccessible_areas ?? null);
        const limitations = accLim.mainReason
          ? (accLim.notes ? `${accLim.mainReason}: ${accLim.notes}` : accLim.mainReason)
          : (accLim.notes || sJson.accessibilityLimitations || snap.accessibility_limitations || null);
        await client.query(
          `INSERT INTO survey_scopes (report_id, survey_coverage, inaccessible_areas, accessibility_limitations)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (report_id) DO UPDATE SET
             survey_coverage = EXCLUDED.survey_coverage,
             inaccessible_areas = EXCLUDED.inaccessible_areas,
             accessibility_limitations = EXCLUDED.accessibility_limitations;`,
          [actualReportId, coverage, inaccessible, limitations]
        );
      }

      const targetUnitId = snap.unitId || snap.unitInfo?.id || null;
      if (targetUnitId) {
        const uInfo = snap.unitInfo || {};
        await client.query(
          `UPDATE building_units SET
             owner_name = COALESCE($1, owner_name),
             owner_phone = COALESCE($2, owner_phone),
             owner_id_card = COALESCE($3, owner_id_card),
             resident_status = COALESCE($4, resident_status),
             display_code = COALESCE($5, display_code),
             updated_at = NOW()
           WHERE id = $6;`,
          [
            sJson.ownerName || uInfo.owner_name || null,
            sJson.ownerPhone || uInfo.owner_phone || null,
            sJson.ownerIdCard || uInfo.owner_id_card || null,
            sJson.residentStatus || uInfo.resident_status || null,
            sJson.displayCode || uInfo.display_code || null,
            targetUnitId,
          ]
        );
      }

      // 4.2. Khôi phục building_specifications (UPSERT đầy đủ cột)
      const specs = { ...(leftPane.buildingSpecs || snap.buildingSpecs || {}), ...(sJson.buildingSpecs || sJson.specs || snap.specs || {}), ...sJson };
      const bFloorCount = specs.aboveFloors ?? specs.floorCount ?? specs.floor_count;
      const bBasementCount = specs.undergroundFloors ?? specs.basementCount ?? specs.basement_count;
      const bBuildingName = specs.buildingName ?? specs.building_name;
      const bLandUse = specs.usageFunction ?? specs.landUseFunction ?? specs.land_use_function;
      const bYear = specs.constructionYear ?? specs.yearOfConstruction ?? specs.year_of_construction;
      const bIsYearEstimated = specs.isEstimatedYear ?? specs.isYearEstimated ?? specs.is_year_estimated;
      const bFoundationDepth = specs.foundationDepthM ?? specs.foundation_depth_m;
      const bFoundationDensity = specs.foundationDensity ?? specs.foundation_density;
      const bFoundationSpacing = specs.foundationSpacingM ?? specs.foundation_spacing_m;
      const bFoundationNotes = specs.foundationNotes ?? specs.foundation_notes;
      const bHeightM = specs.buildingHeightM ?? specs.building_height_m;
      const bAreaM2 = specs.constructionAreaM2 ?? specs.construction_area_m2;
      const bFoundationSource = specs.foundationSource ?? specs.foundation_source;
      const bAdjacentRaw = specs.adjacentBuildings ?? specs.adjacent_buildings;
      const bAdjacentStr = bAdjacentRaw !== undefined && bAdjacentRaw !== null
        ? (typeof bAdjacentRaw === 'string' ? bAdjacentRaw : JSON.stringify(bAdjacentRaw))
        : null;

      const rawStructInput = specs.structuralSystem || specs.structural_system || specs.structureType || specs.structure_type || null;
      const bStructuralSystem = rawStructInput ? normalizeStructuralSystem(rawStructInput) : null;
      const rawFoundInput = specs.foundationCategory || specs.foundation_category || specs.foundationType || specs.foundation_type || null;
      const rawFoundCatScore = specs.foundationCatScore ?? specs.foundation_cat_score ?? undefined;
      const bFoundationCat = (rawFoundInput || rawFoundCatScore !== undefined)
        ? normalizeFoundationCategory(rawFoundInput || `CAT_${rawFoundCatScore}`)
        : null;
      const rawGradeInput = String(specs.buildingGrade || specs.building_grade || specs.importanceCategory || '').toUpperCase().trim();
      const bBuildingGrade = ['CRITICAL', 'IMPORTANT', 'GENERAL'].includes(rawGradeInput) ? rawGradeInput : null;

      const toFiniteNumberOrNull = (val: unknown): number | null => {
        if (val === undefined || val === null || String(val).trim() === '') return null;
        const n = Number(val);
        return Number.isFinite(n) ? n : null;
      };
      const toFiniteIntOrNull = (val: unknown): number | null => {
        const n = toFiniteNumberOrNull(val);
        return n !== null ? Math.round(n) : null;
      };
      const pickFiniteNumberOrZero = (...vals: unknown[]): number => {
        for (const v of vals) {
          const n = toFiniteNumberOrNull(v);
          if (n !== null) return n;
        }
        return 0;
      };

      await client.query(
        `INSERT INTO building_specifications (
           report_id, building_name, floor_count, basement_count, land_use_function,
           year_of_construction, is_year_estimated, foundation_depth_m, foundation_density,
           foundation_spacing_m, foundation_notes, structural_system, foundation_category,
           building_grade, adjacent_buildings, construction_area_m2, building_height_m, foundation_source
         ) VALUES (
           $1, $2, COALESCE($3, 1), COALESCE($4, 0), $5,
           $6, COALESCE($7, false), $8, $9,
           $10, $11, COALESCE($12::structural_system_enum, 'KHUNG_BTCT_CHIU_LUC'::structural_system_enum),
           COALESCE($13::foundation_category_enum, 'CAT_2_MONG_DON_BTCT'::foundation_category_enum),
           COALESCE($14::building_grade_enum, 'GENERAL'::building_grade_enum),
           $15, $16, $17, $18
         )
         ON CONFLICT (report_id) DO UPDATE SET
           building_name = COALESCE($2, building_specifications.building_name),
           floor_count = COALESCE($3, building_specifications.floor_count, 1),
           basement_count = COALESCE($4, building_specifications.basement_count, 0),
           land_use_function = COALESCE($5, building_specifications.land_use_function),
           year_of_construction = COALESCE($6, building_specifications.year_of_construction),
           is_year_estimated = COALESCE($7, building_specifications.is_year_estimated),
           foundation_depth_m = COALESCE($8, building_specifications.foundation_depth_m),
           foundation_density = COALESCE($9, building_specifications.foundation_density),
           foundation_spacing_m = COALESCE($10, building_specifications.foundation_spacing_m),
           foundation_notes = COALESCE($11, building_specifications.foundation_notes),
           structural_system = COALESCE($12::structural_system_enum, building_specifications.structural_system),
           foundation_category = COALESCE($13::foundation_category_enum, building_specifications.foundation_category),
           building_grade = COALESCE($14::building_grade_enum, building_specifications.building_grade),
           adjacent_buildings = COALESCE($15, building_specifications.adjacent_buildings),
           construction_area_m2 = COALESCE($16, building_specifications.construction_area_m2),
           building_height_m = COALESCE($17, building_specifications.building_height_m),
           foundation_source = COALESCE($18, building_specifications.foundation_source);`,
        [
          actualReportId,
          bBuildingName || null,
          toFiniteIntOrNull(bFloorCount),
          toFiniteIntOrNull(bBasementCount),
          bLandUse || null,
          toFiniteIntOrNull(bYear),
          bIsYearEstimated !== undefined && bIsYearEstimated !== null ? Boolean(bIsYearEstimated) : null,
          toFiniteNumberOrNull(bFoundationDepth),
          toFiniteNumberOrNull(bFoundationDensity),
          toFiniteNumberOrNull(bFoundationSpacing),
          bFoundationNotes || null,
          bStructuralSystem || null,
          bFoundationCat || null,
          bBuildingGrade || null,
          bAdjacentStr,
          toFiniteNumberOrNull(bAreaM2),
          toFiniteNumberOrNull(bHeightM),
          bFoundationSource || null,
        ]
      );

      // 4.3. Khôi phục historical_sensitivities (UPSERT)
      const hi = { ...(leftPane.interview || snap.historyInterview || {}), ...(sJson.historyInterview || sJson.interview || {}) };
      const toBoolOrNull = (val: any): boolean | null => {
        if (val === undefined || val === null || val === '') return null;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val > 0;
        const s = String(val).toUpperCase().trim();
        if (['TRUE', 'YES', '1', '2', '3'].includes(s)) return true;
        if (['FALSE', 'NO', '0'].includes(s)) return false;
        return null;
      };
      await client.query(
        `INSERT INTO historical_sensitivities (
           report_id, extended_or_renovated, previous_settlement_or_tilt, fire_or_accident,
           sensitive_equipment_present, details
         ) VALUES ($1, COALESCE($2, false), COALESCE($3, false), COALESCE($4, false), COALESCE($5, false), $6)
         ON CONFLICT (report_id) DO UPDATE SET
           extended_or_renovated = COALESCE($2, historical_sensitivities.extended_or_renovated),
           previous_settlement_or_tilt = COALESCE($3, historical_sensitivities.previous_settlement_or_tilt),
           fire_or_accident = COALESCE($4, historical_sensitivities.fire_or_accident),
           sensitive_equipment_present = COALESCE($5, historical_sensitivities.sensitive_equipment_present),
           details = COALESCE($6, historical_sensitivities.details);`,
        [
          actualReportId,
          toBoolOrNull(hi.renovationLoad ?? hi.extended_or_renovated),
          toBoolOrNull(hi.pastSettlement ?? hi.previous_settlement_or_tilt),
          toBoolOrNull(hi.fireFloodHistory ?? hi.fireFloodIncident ?? hi.fire_or_accident),
          toBoolOrNull(hi.sensitiveEquipment ?? hi.sensitive_equipment_present),
          hi.renovationNotes || hi.repairNotes || hi.majorRepairNotes || hi.settlementNotes || hi.pastSettlementNotes || hi.neighborNotes || hi.fireFloodNotes || hi.details || null,
        ]
      );

      // 4.4. Khôi phục deformation_assessments (UPSERT, giữ nguyên đơn vị ‰ không chia 10, đồng bộ M2-07 & bảo vệ NOT NULL)
      const def = { ...(leftPane.deformation || snap.deformation || {}), ...(sJson.settlementTilt || sJson.deformation || {}) };
      const tilt = def.buildingTilt || def.settlementTilt || def.tiltAssessment || {};
      const beam = def.beamSagging || {};
      const diffSettle = def.diffSettlement || {};
      const abnormal = def.abnormalCase || def.abnormalObservation || {};

      const safeTiltX = pickFiniteNumberOrZero(tilt.xPermille, tilt.tilt_x_permille, def.tilt_angle_x, def.tiltAngleX);
      const safeTiltY = pickFiniteNumberOrZero(tilt.yPermille, tilt.tilt_y_permille, def.tilt_angle_y, def.tiltAngleY);
      const tiltDir = tilt.direction ?? tilt.tilt_direction ?? def.tilt_direction ?? def.tiltDirection ?? null;
      const safeBeamSag = pickFiniteNumberOrZero(beam.sagMm, beam.beam_deflection_mm, def.beam_deflection_mm, def.beamDeflectionMm);
      const fallbackE3Level = Math.min(
        4,
        Math.max(
          Number(diffSettle.level) || 0,
          Number(tilt.level) || 0,
          Number(beam.level) || 0
        )
      );
      const e3DeformationScore = Math.round(
        pickFiniteNumberOrZero(sJson.ecs?.e3, def.e3_deformation_score, fallbackE3Level)
      );
      const rawRel = String(def.measurementReliability ?? def.measurement_reliability ?? '').toUpperCase().trim();
      const normRel = rawRel.includes('HIGH') || rawRel.includes('CAO')
        ? 'HIGH'
        : rawRel.includes('LOW') || rawRel.includes('THẤP')
        ? 'LOW'
        : rawRel
        ? 'MEDIUM'
        : null;
      const diffPhotosJson = Array.isArray(diffSettle.photos) ? JSON.stringify(diffSettle.photos) : (def.diff_settlement_photos_json ? JSON.stringify(def.diff_settlement_photos_json) : null);
      const tiltPhotosJson = Array.isArray(tilt.photos) ? JSON.stringify(tilt.photos) : (def.tilt_photos_json ? JSON.stringify(def.tilt_photos_json) : null);
      const abnormalPhotosJson = Array.isArray(abnormal.photos) ? JSON.stringify(abnormal.photos) : (def.abnormal_photos_json ? JSON.stringify(def.abnormal_photos_json) : null);

      await client.query(
        `INSERT INTO deformation_assessments (
           report_id, tilt_angle_x, tilt_angle_y, tilt_direction, beam_deflection_mm,
           measurement_reliability, diff_settlement_photos_json, tilt_photos_json, abnormal_photos_json,
           e3_deformation_score
         ) VALUES (
           $1, COALESCE($2, 0), COALESCE($3, 0), $4, COALESCE($5, 0),
           COALESCE($6::reliability_enum, 'HIGH'::reliability_enum),
           COALESCE($7::jsonb, '[]'::jsonb), COALESCE($8::jsonb, '[]'::jsonb), COALESCE($9::jsonb, '[]'::jsonb),
           COALESCE($10, 0)
         )
         ON CONFLICT (report_id) DO UPDATE SET
           tilt_angle_x = COALESCE($2, 0),
           tilt_angle_y = COALESCE($3, 0),
           tilt_direction = $4,
           beam_deflection_mm = COALESCE($5, 0),
           measurement_reliability = COALESCE($6::reliability_enum, deformation_assessments.measurement_reliability),
           diff_settlement_photos_json = COALESCE($7::jsonb, deformation_assessments.diff_settlement_photos_json),
           tilt_photos_json = COALESCE($8::jsonb, deformation_assessments.tilt_photos_json),
           abnormal_photos_json = COALESCE($9::jsonb, deformation_assessments.abnormal_photos_json),
           e3_deformation_score = COALESCE($10, deformation_assessments.e3_deformation_score, 0);`,
        [
          actualReportId,
          safeTiltX,
          safeTiltY,
          tiltDir || null,
          safeBeamSag,
          normRel,
          diffPhotosJson,
          tiltPhotosJson,
          abnormalPhotosJson,
          e3DeformationScore,
        ]
      );

      // 4.5. Khôi phục risk_score_cards phòng thủ động (Defensive Dynamic Update, bao gồm cả sJson.ecs/vi & M7-05/M8-04)
      const rc = rightPane.riskCard || snap.riskCard || leftPane.riskScoreCard || snap.riskScoreCard || {};
      const snapEcs = sJson.ecs || {};
      const snapVi = sJson.vi || {};
      if (rc || Object.keys(snapEcs).length > 0 || Object.keys(snapVi).length > 0) {
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

        const e1Val = snapEcs.e1 ?? rc.e1_burland_score;
        const e2Val = snapEcs.e2 ?? rc.e2_structure_score ?? rc.e2_crack_structural_score;
        const e3Val = snapEcs.e3 ?? rc.e3_deformation_score;
        const e4Val = snapEcs.e4 ?? rc.e4_material_score ?? rc.e4_material_degradation_score;
        const e5Val = snapEcs.e5 ?? rc.e5_history_score;
        const e6Val = snapEcs.e6 ?? rc.e6_overall_function_score ?? rc.e6_secondary_score;
        const totalEcsVal = snapEcs.totalEcs ?? rc.total_ecs_score ?? rc.total_ecs;
        const rawEcsClass = String(snapEcs.ecsClass || rc.ecs_class || rc.ecs_category || '').toUpperCase().trim();
        const ecsClassVal = ['GOOD', 'MEDIUM', 'DEFICIENT', 'CRITICAL'].includes(rawEcsClass) ? rawEcsClass : null;

        const v1Val = snapVi.v1 ?? rc.v1_importance_score;
        const v2Val = snapVi.v2 ?? rc.v2_structure_score;
        const v3Val = snapVi.v3 ?? rc.v3_foundation_score;
        const v4Val = snapVi.v4 ?? rc.v4_age_score;
        const v5Val = snapVi.v5 ?? rc.v5_ecs_score;
        const v6Val = snapVi.v6 ?? rc.v6_sensitivity_score;
        const avgViVal = snapVi.viAvg ?? snapVi.avgVi ?? rc.avg_vi_score ?? rc.avg_vi;
        const rawViClass = String(snapVi.viClass || rc.vi_class || rc.vi_category || '').toUpperCase().trim();
        const viClassVal = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'].includes(rawViClass) ? rawViClass : null;

        addCoalesceField('e1_burland_score', toFiniteIntOrNull(e1Val));
        addCoalesceField('e2_structure_score', toFiniteIntOrNull(e2Val));
        addCoalesceField('e3_deformation_score', toFiniteIntOrNull(e3Val));
        addCoalesceField('e4_material_score', toFiniteIntOrNull(e4Val));
        addCoalesceField('e5_history_score', toFiniteIntOrNull(e5Val));
        addCoalesceField('e6_overall_function_score', toFiniteIntOrNull(e6Val));
        addCoalesceField('total_ecs_score', toFiniteIntOrNull(totalEcsVal));
        addCoalesceField('ecs_class', ecsClassVal, '::ecs_class_enum');
        addCoalesceField('v1_importance_score', toFiniteIntOrNull(v1Val));
        addCoalesceField('v2_structure_score', toFiniteIntOrNull(v2Val));
        addCoalesceField('v3_foundation_score', toFiniteIntOrNull(v3Val));
        addCoalesceField('v4_age_score', toFiniteIntOrNull(v4Val));
        addCoalesceField('v5_ecs_score', toFiniteIntOrNull(v5Val));
        addCoalesceField('v6_sensitivity_score', toFiniteIntOrNull(v6Val));
        addCoalesceField('avg_vi_score', toFiniteNumberOrNull(avgViVal));
        addCoalesceField('vi_class', viClassVal, '::vi_class_enum');
        addCoalesceField('building_risk_assessment_bra', rc.building_risk_assessment_bra || rc.preliminary_bra_classification || rc.bra || rc.bra_score || null);
        addCoalesceField('preliminary_bra_classification', rc.preliminary_bra_classification || sJson.executiveSummary?.braStatus || sJson.braAssessment?.braStatus || null);
        addCoalesceField('construction_impact_level_i', toFiniteIntOrNull(rc.construction_impact_level_i ?? rc.impact_level_i ?? rc.impact_level));
        addCoalesceField('impact_level_i', toFiniteIntOrNull(rc.impact_level_i ?? rc.construction_impact_level_i));

        const isEjApplied =
          rc.is_engineering_judgement_applied !== undefined
            ? Boolean(rc.is_engineering_judgement_applied)
            : Boolean(snapEcs.isOverrideLocked || snapEcs.engineeringJudgement?.isOverridden || snapVi.isOverrideLocked || snapVi.engineeringJudgement?.isOverridden);
        const ejAction =
          rc.engineering_judgement_action ||
          snapEcs.engineeringJudgement?.action ||
          snapVi.engineeringJudgement?.action ||
          null;
        const ejReason =
          rc.engineering_judgement_reason ||
          snapEcs.overrideReason ||
          snapEcs.engineeringJudgement?.reason ||
          snapVi.overrideReason ||
          snapVi.engineeringJudgement?.reason ||
          null;

        addField('is_engineering_judgement_applied', isEjApplied);
        addField('engineering_judgement_action', ejAction);
        addField('engineering_judgement_reason', ejReason);

        // M8-04: Chỉ khôi phục overridden_impact_level_i khi bản chụp thực sự có đánh dấu ghi đè Impact
        const isImpactExplicitlyOverridden =
          sJson.executiveSummary?.isImpactOverridden === true ||
          Boolean(sJson.executiveSummary?.impactOverrideReason && String(sJson.executiveSummary.impactOverrideReason).trim()) ||
          sJson.impactAssessment?.isOverridden === true ||
          (rc.overridden_impact_level_i !== undefined && rc.overridden_impact_level_i !== null);
        const rawSnapImpact = String(sJson.impactAssessment?.iCode || sJson.executiveSummary?.constructionImpactStatus || '').toUpperCase();
        const snapImpactMatch = rawSnapImpact.match(/\bI([1-4])\b/);
        const snapImpactNum = isImpactExplicitlyOverridden
          ? (toFiniteIntOrNull(rc.overridden_impact_level_i) ??
              (snapImpactMatch ? Number(snapImpactMatch[1]) : null))
          : null;

        const isBraExplicitlyOverridden =
          sJson.executiveSummary?.isBraOverridden === true ||
          sJson.braAssessment?.isOverridden === true ||
          (rc.overridden_bra !== undefined && rc.overridden_bra !== null);
        const snapBraOverride = isBraExplicitlyOverridden
          ? (rc.overridden_bra || sJson.braAssessment?.braStatus || sJson.executiveSummary?.braStatus || null)
          : null;

        // Các cột override phán quyết kỹ thuật (M7-05: khôi phục đầy đủ 7 cột overridden_*)
        addField('overridden_burland_grade', toFiniteIntOrNull(rc.overridden_burland_grade));
        addField(
          'overridden_total_ecs',
          toFiniteIntOrNull(rc.overridden_total_ecs) ??
            (snapEcs.isOverrideLocked ? toFiniteIntOrNull(totalEcsVal) : null)
        );
        addField('overridden_ecs_class', rc.overridden_ecs_class || (snapEcs.isOverrideLocked ? ecsClassVal : null));
        addField('overridden_importance_score', toFiniteNumberOrNull(rc.overridden_importance_score));
        addField(
          'overridden_avg_vi',
          toFiniteNumberOrNull(rc.overridden_avg_vi) ??
            (snapVi.isOverrideLocked ? toFiniteNumberOrNull(avgViVal) : null)
        );
        addField('overridden_vi_class', rc.overridden_vi_class || (snapVi.isOverrideLocked ? viClassVal : null));
        addField('overridden_impact_level_i', snapImpactNum);
        addField('overridden_bra', snapBraOverride);
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

      // 4.6. Khôi phục bảng parcels (M1-06: bỏ chặn houseNumber||ownerName cho đất trống, bỏ COALESCE trên các cột nullable, khôi phục hình học & cự ly)
      const parcelRestoreData = snap.frozenParcel || snap.parcel || leftPane.parcel || snap.parcelInfo || {
        projectParcelCode: snap.projectParcelCode || sJson.projectParcelCode,
        houseNumber: snap.houseNumber ?? sJson.houseNumber,
        street: snap.street ?? sJson.street,
        ward: snap.ward ?? sJson.ward,
        district: snap.district ?? sJson.district,
        ownerName: snap.ownerName ?? sJson.ownerName,
        ownerPhone: snap.ownerPhone ?? sJson.ownerPhone,
        officialCadastralCode: snap.officialCadastralCode ?? sJson.officialCadastralCode,
        frontageWidth: snap.frontageWidth ?? sJson.frontageWidth,
        lotDepth: snap.lotDepth ?? sJson.lotDepth,
        landAreaM2: snap.landAreaM2 ?? sJson.landAreaM2,
        constructionAreaM2: snap.constructionAreaM2 ?? sJson.constructionAreaM2,
        floorCount: snap.floorCount ?? sJson.floorCount ?? sJson.aboveFloors,
      };

      if (parcelRestoreData) {
        const rawDist =
          snap.distanceToCenterlineM ??
          snap.distance_to_centerline_m ??
          parcelRestoreData.distanceToCenterlineM ??
          parcelRestoreData.distance_to_centerline_m ??
          (sJson.metroOffsetDistance !== undefined && sJson.metroOffsetDistance !== null
            ? Number(String(sJson.metroOffsetDistance).replace(/[^\d.-]/g, ''))
            : null);
        const restoredDistM = rawDist !== null && rawDist !== undefined && Number.isFinite(Number(rawDist)) ? Number(rawDist) : null;

        let restoredLocGeoJsonStr: string | null = null;
        if (sJson.gpsCoords && Number.isFinite(Number(sJson.gpsCoords.lat)) && Number.isFinite(Number(sJson.gpsCoords.lng))) {
          restoredLocGeoJsonStr = JSON.stringify({
            type: 'Point',
            coordinates: [Number(sJson.gpsCoords.lng), Number(sJson.gpsCoords.lat)],
          });
        } else if (snap.locationGeojson) {
          restoredLocGeoJsonStr =
            typeof snap.locationGeojson === 'string'
              ? snap.locationGeojson
              : JSON.stringify(snap.locationGeojson);
        }

        let restoredCadGeoJsonStr: string | null = null;
        const snapCoords = Array.isArray(sJson.parcelCoordinates) && sJson.parcelCoordinates.length >= 3
          ? sJson.parcelCoordinates
          : Array.isArray(sJson.polygonCoords) && sJson.polygonCoords.length >= 3
            ? sJson.polygonCoords
            : null;
        if (snapCoords) {
          const ring: [number, number][] = snapCoords
            .filter((pt: any) => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(Number(pt[0])) && Number.isFinite(Number(pt[1])))
            .map((pt: any) => [Number(pt[1]), Number(pt[0])]);
          if (ring.length >= 3) {
            const firstPt = ring[0];
            const lastPt = ring[ring.length - 1];
            if (firstPt[0] !== lastPt[0] || firstPt[1] !== lastPt[1]) {
              ring.push([firstPt[0], firstPt[1]]);
            }
            restoredCadGeoJsonStr = JSON.stringify({ type: 'Polygon', coordinates: [ring] });
          }
        } else if (snap.cadastralGeojson || snap.cadastral_geojson) {
          const rawCad = snap.cadastralGeojson || snap.cadastral_geojson;
          restoredCadGeoJsonStr = typeof rawCad === 'string' ? rawCad : JSON.stringify(rawCad);
        }

        const restoredProjectCode =
          parcelRestoreData.projectParcelCode ||
          parcelRestoreData.project_parcel_code ||
          snap.projectParcelCode ||
          sJson.projectParcelCode ||
          null;
        const restoredBuildingType =
          parcelRestoreData.buildingType ||
          parcelRestoreData.building_type ||
          snap.parentBuildingInfo?.buildingType ||
          sJson.buildingType ||
          null;

        await client.query(
          `UPDATE parcels SET
             house_number = $1,
             street = $2,
             ward = $3,
             district = $4,
             owner_name = $5,
             owner_phone = $6,
             official_cadastral_code = $7,
             frontage_width = $8,
             lot_depth = $9,
             land_area_m2 = COALESCE($10, land_area_m2),
             construction_area_m2 = $11,
             floor_count = COALESCE($12, floor_count),
             project_parcel_code = COALESCE($13, project_parcel_code),
             building_type = COALESCE($14, building_type),
             distance_to_centerline_m = COALESCE($15, distance_to_centerline_m),
             location_geom = CASE WHEN $16::text IS NOT NULL THEN ST_SetSRID(ST_GeomFromGeoJSON($16::text), 4326) ELSE location_geom END,
             cadastral_polygon_geom = CASE WHEN $17::text IS NOT NULL THEN ST_SetSRID(ST_GeomFromGeoJSON($17::text), 4326) ELSE cadastral_polygon_geom END,
             survey_status = 'SUBMITTED',
             updated_at = NOW()
           WHERE id = (SELECT parcel_id FROM base_survey_reports WHERE id = $18);`,
          [
            parcelRestoreData.houseNumber ?? parcelRestoreData.house_number ?? null,
            parcelRestoreData.street ?? null,
            parcelRestoreData.ward ?? null,
            parcelRestoreData.district ?? null,
            parcelRestoreData.ownerName ?? parcelRestoreData.owner_name ?? null,
            parcelRestoreData.ownerPhone ?? parcelRestoreData.owner_phone ?? null,
            parcelRestoreData.officialCadastralCode ?? parcelRestoreData.official_cadastral_code ?? null,
            toFiniteNumberOrNull(parcelRestoreData.frontageWidth),
            toFiniteNumberOrNull(parcelRestoreData.lotDepth),
            toFiniteNumberOrNull(parcelRestoreData.landAreaM2),
            toFiniteNumberOrNull(parcelRestoreData.constructionAreaM2),
            toFiniteIntOrNull(parcelRestoreData.floorCount) ?? toFiniteIntOrNull(parcelRestoreData.aboveFloors),
            restoredProjectCode,
            restoredBuildingType,
            restoredDistM,
            restoredLocGeoJsonStr,
            restoredCadGeoJsonStr,
            actualReportId,
          ]
        );
      }

      // 4.7. Khôi phục survey_identification_photos (P01..P04)
      const rawIdPhotos = leftPane.identPhotos || rightPane.identificationPhotos || snap.identificationPhotos || sJson.identificationPhotos || [];
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

      // 4.8. Khôi phục floor_surveys, damage_zones (cả Z và E) và defect_items (đầy đủ pin_x, pin_y và mọi thuộc tính) từ snapshot
      if (Array.isArray(sJson.floors) && sJson.floors.length > 0) {
        await client.query(`DELETE FROM floor_surveys WHERE report_id = $1;`, [actualReportId]);
        for (let i = 0; i < sJson.floors.length; i++) {
          const fl = sJson.floors[i];
          await client.query(
            `INSERT INTO floor_surveys (
               report_id, floor_name, floor_order, overview_photos_json,
               cad_drawing_url, cad_zone_pins_json, cad_structural_drawing_url, cad_element_pins_json, notes
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
            [
              actualReportId,
              fl.floorName || fl.floor_name || `Tầng ${i + 1}`,
              i + 1,
              JSON.stringify(fl.overviewPhotos || []),
              fl.cadDrawingUrl || fl.cadSketchPhotoUrl || fl.cad_drawing_url || null,
              JSON.stringify(fl.cadZonePins || []),
              fl.cadStructuralDrawingUrl || fl.cadStructuralSketchPhotoUrl || fl.cad_structural_drawing_url || null,
              JSON.stringify(fl.cadElementPins || []),
              fl.notes || null,
            ]
          );
        }
      }

      const snapZones: any[] = [];
      if (Array.isArray(sJson.floors) && sJson.floors.length > 0) {
        for (let fi = 0; fi < sJson.floors.length; fi++) {
          const fl = sJson.floors[fi];
          const flName = fl.floorName || fl.floor_name || `Tầng ${fi + 1}`;
          if (Array.isArray(fl.zones)) {
            for (const z of fl.zones) {
              snapZones.push({
                ...z,
                _refObj: z,
                _floorName: z.floorName || z.floor_name || flName,
                _isElement: false,
              });
            }
          }
          if (Array.isArray(fl.structuralElements)) {
            for (const el of fl.structuralElements) {
              snapZones.push({
                ...el,
                _refObj: el,
                _floorName: el.floorName || el.floor_name || flName,
                _isElement: true,
              });
            }
          }
        }
      } else {
        const flatZones = Array.isArray(leftPane.damageZones) && leftPane.damageZones.length > 0
          ? leftPane.damageZones
          : (Array.isArray(snap.damageZones) && snap.damageZones.length > 0
            ? snap.damageZones
            : (Array.isArray(sJson.damageZones) ? sJson.damageZones : []));
        const flatElems = Array.isArray(leftPane.structuralElements) && leftPane.structuralElements.length > 0
          ? leftPane.structuralElements
          : (Array.isArray(sJson.structuralElements) ? sJson.structuralElements : []);
        for (const z of flatZones) {
          snapZones.push({ ...z, _refObj: z, _floorName: z.floor_name || z.floorName || 'Tầng 1', _isElement: false });
        }
        for (const el of flatElems) {
          snapZones.push({ ...el, _refObj: el, _floorName: el.floor_name || el.floorName || 'Tầng 1', _isElement: true });
        }
      }

      const existingZonesRes = await client.query<{ id: string; zone_code: string; floor_name: string | null }>(
        `SELECT id, zone_code, floor_name FROM damage_zones WHERE report_id = $1;`,
        [actualReportId]
      );
      const claimedZoneIds = new Set<string>();
      const resolveZoneUuid = (rawId: any, floorName: string, code: string): string | null => {
        const idStr = rawId ? String(rawId) : '';
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idStr)) {
          const byId = existingZonesRes.rows.find((r) => r.id === idStr && !claimedZoneIds.has(r.id));
          if (byId) {
            claimedZoneIds.add(byId.id);
            return byId.id;
          }
        }
        const byFloorAndCode = existingZonesRes.rows.find(
          (r) => !claimedZoneIds.has(r.id) && (r.floor_name || '') === floorName && r.zone_code === code
        );
        if (byFloorAndCode) {
          claimedZoneIds.add(byFloorAndCode.id);
          return byFloorAndCode.id;
        }
        // Chỉ fallback theo mã khi bản ghi trong DB chưa từng có floor_name (tránh khớp nhầm Z-01 giữa các tầng)
        const byEmptyFloorAndCode = existingZonesRes.rows.find(
          (r) => !claimedZoneIds.has(r.id) && (!r.floor_name || !r.floor_name.trim()) && r.zone_code === code
        );
        if (byEmptyFloorAndCode) {
          claimedZoneIds.add(byEmptyFloorAndCode.id);
          return byEmptyFloorAndCode.id;
        }
        return null;
      };

      const existingDefectsRes = await client.query<{ id: string; zone_id: string; defect_code: string }>(
        `SELECT d.id, d.zone_id, d.defect_code
         FROM defect_items d
         JOIN damage_zones z ON d.zone_id = z.id
         WHERE z.report_id = $1;`,
        [actualReportId]
      );
      const claimedDefectIds = new Set<string>();
      const resolveDefectUuid = (rawId: any, zoneId: string, dCode: string): string | null => {
        const idStr = rawId ? String(rawId) : '';
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idStr)) {
          const byId = existingDefectsRes.rows.find(
            (d) => d.id === idStr && d.zone_id === zoneId && !claimedDefectIds.has(d.id)
          );
          if (byId) {
            claimedDefectIds.add(byId.id);
            return byId.id;
          }
        }
        const byZoneAndCode = existingDefectsRes.rows.find(
          (d) => !claimedDefectIds.has(d.id) && d.zone_id === zoneId && d.defect_code === dCode
        );
        if (byZoneAndCode) {
          claimedDefectIds.add(byZoneAndCode.id);
          return byZoneAndCode.id;
        }
        return null;
      };

      const activeRestoredZoneUuids = new Set<string>();
      const activeRestoredDefectUuids = new Set<string>();

      for (const z of snapZones) {
        const isZoneDeleted = Boolean(z.isDeleted || z.is_deleted);
        const zCode = z.zone_code || z.zoneCode || z.elementCode || z.element_code || (z._isElement ? 'E-01' : 'Z-01');
        const floorName = z._floorName || z.floor_name || z.floorName || 'Tầng 1';
        const roomName = z.room_name || z.roomName || (z._isElement ? 'Cấu kiện kết cấu' : 'Không gian chính');
        const compType = normalizeComponentType(z.component_type || z.componentType || z.elementType || (z._isElement ? 'COLUMN' : 'WALL'));
        const wallMat = z.wall_material || z.wallMaterial || z.materialType || (z._isElement ? 'BTCT' : null);
        const ctxUrl = (z.ctx_photo_url || z.ctxPhotoUrl || '').trim() || '';
        const bGrade = pickFiniteNumberOrZero(z.burland_grade, z.burlandGrade);
        const funcImpact = Boolean(z.functional_impact_repair_needed ?? z.functionalImpactRepairNeeded ?? z.hasDamage);

        const matchedZoneUuid = resolveZoneUuid(z.id, floorName, zCode);
        let targetZoneId: string;

        if (matchedZoneUuid) {
          targetZoneId = matchedZoneUuid;
          await client.query(
            `UPDATE damage_zones SET
               zone_code = $1,
               floor_name = $2,
               room_name = $3,
               component_type = $4,
               wall_material = $5,
               functional_impact_repair_needed = $6,
               ctx_photo_url = COALESCE(NULLIF($7, ''), ctx_photo_url),
               ctx_photo_code = COALESCE($8, ctx_photo_code),
               notes = $9,
               burland_grade = $10,
               is_deleted = $11
             WHERE id = $12;`,
            [
              zCode,
              floorName,
              roomName,
              compType,
              wallMat,
              funcImpact,
              ctxUrl,
              z.ctx_photo_code || z.ctxPhotoCode || null,
              z.notes || null,
              bGrade,
              isZoneDeleted,
              targetZoneId,
            ]
          );
        } else {
          const zIns = await client.query<{ id: string }>(
            `INSERT INTO damage_zones (
               report_id, zone_code, floor_name, room_name, component_type,
               wall_material, functional_impact_repair_needed,
               ctx_photo_url, ctx_photo_code, notes, burland_grade, is_deleted
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id;`,
            [
              actualReportId,
              zCode,
              floorName,
              roomName,
              compType,
              wallMat,
              funcImpact,
              ctxUrl,
              z.ctx_photo_code || z.ctxPhotoCode || null,
              z.notes || null,
              bGrade,
              isZoneDeleted,
            ]
          );
          targetZoneId = zIns.rows[0].id;
          claimedZoneIds.add(targetZoneId);
        }

        if (z._refObj && typeof z._refObj === 'object') {
          z._refObj.id = targetZoneId;
        }
        if (!isZoneDeleted) {
          activeRestoredZoneUuids.add(targetZoneId);
        }

        const defects = Array.isArray(z.defects) ? z.defects : [];
        for (const d of defects) {
          const isDefectDeleted = Boolean(d.isDeleted || d.is_deleted) || isZoneDeleted;
          const dCode = d.defect_code || d.defectCode || 'D-01';
          const cuUrl = (d.cu_photo_url || d.cuPhotoUrl || (Array.isArray(d.cuPhotos) ? d.cuPhotos[0] : '') || '').trim() || '';
          const extraCuUrl = d.extra_photo_url || d.extraPhotoUrl || (Array.isArray(d.cuPhotos) && d.cuPhotos.length > 1 ? d.cuPhotos[1] : null);
          const cuPhotosArr = Array.isArray(d.cu_photos_json)
            ? d.cu_photos_json
            : (Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0 ? d.cuPhotos : (cuUrl ? [cuUrl] : []));
          const cuPhotosJson = JSON.stringify(cuPhotosArr);
          const wMax = Number(d.width_max_mm ?? d.widthMaxMm ?? 0) || 0;
          const lMm = Number(d.length_mm ?? d.lengthMm ?? 0) || 0;
          const pX = Number(d.pin_x ?? d.pinX ?? 0) || 0;
          const pY = Number(d.pin_y ?? d.pinY ?? 0) || 0;
          const actState = ['A', 'S', 'U'].includes(d.activity_state || d.activityState) ? (d.activity_state || d.activityState) : 'U';
          const screenCat = d.screening_category || d.screeningCategory || d.defect_type || d.defectType || 'CRACK';
          const defType = d.defect_type || d.defectType || 'HAIRLINE';
          const crackDir = d.crack_direction || d.crackDirection || null;
          const matE4 = Number(d.material_degradation_e4 ?? d.materialDegradationE4 ?? 0) || 0;
          const structE2 = Number(d.structural_significance_e2 ?? d.structuralSignificanceE2 ?? 0) || 0;
          const hasScale = Boolean(d.has_scale_card ?? d.hasScaleCard ?? true);
          const isCrit = Boolean(d.is_structural_critical ?? d.isStructuralCritical ?? false);
          const pinCol = d.pin_color || d.pinColor || '#ef4444';
          const cuCode = d.cu_photo_code || d.cuPhotoCode || null;

          const matchedDefUuid = resolveDefectUuid(d.id, targetZoneId, dCode);
          let targetDefectId: string;

          if (matchedDefUuid) {
            targetDefectId = matchedDefUuid;
            await client.query(
              `UPDATE defect_items SET
                 defect_code = $1,
                 pin_x = $2,
                 pin_y = $3,
                 screening_category = $4,
                 defect_type = $5,
                 crack_direction = $6,
                 width_max_mm = $7,
                 length_mm = $8,
                 activity_state = $9,
                 material_degradation_e4 = $10,
                 structural_significance_e2 = $11,
                 has_scale_card = $12,
                 is_structural_critical = $13,
                 cu_photo_url = COALESCE(NULLIF($14, ''), cu_photo_url),
                 extra_photo_url = COALESCE($15, extra_photo_url),
                 pin_color = $16,
                 cu_photo_code = COALESCE($17, cu_photo_code),
                 cu_photos_json = $18,
                 is_deleted = $19
               WHERE id = $20;`,
              [
                dCode,
                pX,
                pY,
                screenCat,
                defType,
                crackDir,
                wMax,
                lMm,
                actState,
                matE4,
                structE2,
                hasScale,
                isCrit,
                cuUrl,
                extraCuUrl,
                pinCol,
                cuCode,
                cuPhotosJson,
                isDefectDeleted,
                targetDefectId,
              ]
            );
          } else {
            const dIns = await client.query<{ id: string }>(
              `INSERT INTO defect_items (
                 zone_id, defect_code, pin_x, pin_y, screening_category, defect_type,
                 crack_direction, width_max_mm, length_mm, activity_state,
                 material_degradation_e4, structural_significance_e2, has_scale_card,
                 is_structural_critical, cu_photo_url, extra_photo_url, pin_color,
                 cu_photo_code, cu_photos_json, is_deleted
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
               RETURNING id;`,
              [
                targetZoneId,
                dCode,
                pX,
                pY,
                screenCat,
                defType,
                crackDir,
                wMax,
                lMm,
                actState,
                matE4,
                structE2,
                hasScale,
                isCrit,
                cuUrl,
                extraCuUrl,
                pinCol,
                cuCode,
                cuPhotosJson,
                isDefectDeleted,
              ]
            );
            targetDefectId = dIns.rows[0].id;
            claimedDefectIds.add(targetDefectId);
          }

          if (d && typeof d === 'object') {
            d.id = targetDefectId;
          }
          if (!isDefectDeleted) {
            activeRestoredDefectUuids.add(targetDefectId);
          }
        }
      }

      // Đánh dấu xóa mềm (is_deleted = true) cho bất kỳ defect_items hoặc damage_zones phát sinh sau đó mà không thuộc tập active của snapshot đích
      if (activeRestoredDefectUuids.size > 0) {
        await client.query(
          `UPDATE defect_items SET is_deleted = true
           WHERE zone_id IN (SELECT id FROM damage_zones WHERE report_id = $1)
             AND NOT (id = ANY($2::uuid[]));`,
          [actualReportId, Array.from(activeRestoredDefectUuids)]
        );
      } else {
        await client.query(
          `UPDATE defect_items SET is_deleted = true
           WHERE zone_id IN (SELECT id FROM damage_zones WHERE report_id = $1);`,
          [actualReportId]
        );
      }

      if (activeRestoredZoneUuids.size > 0) {
        await client.query(
          `UPDATE damage_zones SET is_deleted = true
           WHERE report_id = $1
             AND NOT (id = ANY($2::uuid[]));`,
          [actualReportId, Array.from(activeRestoredZoneUuids)]
        );
      } else {
        await client.query(
          `UPDATE damage_zones SET is_deleted = true WHERE report_id = $1;`,
          [actualReportId]
        );
      }

      // Cập nhật lại survey_data_json sau khi chuẩn hóa ảnh P01..P04 và UUID vùng/khuyết tật
      await client.query(
        `UPDATE base_survey_reports SET survey_data_json = $1, updated_at = NOW() WHERE id = $2;`,
        [JSON.stringify(finalSurveyJson), actualReportId]
      );

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
        const idObj = sJson.identificationPhotos || snap.identificationPhotos;
        if (idObj && typeof idObj === 'object' && !Array.isArray(idObj)) {
          for (const key of Object.keys(idObj)) {
            const p = idObj[key];
            if (p && !p.is_not_applicable && !p.notApplicable) {
              collectUrl(p.raw_photo_url || p.rawPhotoUrl || p.rawUrl || p.url);
              collectUrl(p.annotated_photo_url || p.annotatedPhotoUrl || p.annotatedUrl || p.url);
            }
          }
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

        // Lún nghiêng & võng dầm Step 5 (kèm abnormalCase.photos M2-07)
        const snapSt = snap.settlementTilt || leftPane.settlementTilt || sJson.settlementTilt || sJson.deformation || {};
        if (Array.isArray(snapSt.beamSagging?.photos)) {
          snapSt.beamSagging.photos.forEach((p: any) => collectUrl(typeof p === 'string' ? p : p?.url));
        }
        if (Array.isArray(snapSt.diffSettlement?.photos)) {
          snapSt.diffSettlement.photos.forEach((p: any) => collectUrl(typeof p === 'string' ? p : p?.url));
        }
        if (Array.isArray(snapSt.buildingTilt?.photos)) {
          snapSt.buildingTilt.photos.forEach((p: any) => collectUrl(typeof p === 'string' ? p : p?.url));
        }
        const snapAbnormal = snapSt.abnormalCase || snapSt.abnormalObservation || {};
        if (Array.isArray(snapAbnormal.photos)) {
          snapAbnormal.photos.forEach((p: any) => collectUrl(typeof p === 'string' ? p : p?.url));
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
