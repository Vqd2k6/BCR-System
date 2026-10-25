import { Database } from '../../../../database/db';
import { CryptoUtils } from '../../../../common/utils/crypto.utils';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../common/errors/problem-details';
import {
  CondoAdminEditPayload,
  CondoAuditEntityKind,
  CondoPhotoActionItem,
  CondoReportContextRow,
} from '../condo-audit.types';
import { ICondoEntityAuditStrategy } from '../strategies/condo-entity-strategy.interface';
import { CondoMasterAuditStrategy } from '../strategies/condo-master.strategy';
import { CondoAreaAuditStrategy } from '../strategies/condo-area.strategy';
import { CondoUnitAuditStrategy } from '../strategies/condo-unit.strategy';
import { CondoPhotoLineageService } from './condo-photo-lineage.service';

export class CondoCrudEngineService {
  private static readonly strategies: Record<CondoAuditEntityKind, ICondoEntityAuditStrategy> = {
    BUILDING_MASTER: new CondoMasterAuditStrategy(),
    MASTER_AREA: new CondoAreaAuditStrategy(),
    CONDO_UNIT: new CondoUnitAuditStrategy(),
  };

  /**
   * Xác định xem reportId (hoặc parcelId) có thuộc phân hệ Chung cư (CONDO) hay không,
   * và phân loại chính xác cấp thực thể: BUILDING_MASTER | MASTER_AREA | CONDO_UNIT.
   * Trả về null nếu hồ sơ là Nhà dân độc lập (STANDALONE) để giữ nguyên luồng cũ 100%.
   */
  static async resolveCondoReportContext(
    reportIdOrParcelId: string
  ): Promise<{ context: CondoReportContextRow; entityKind: CondoAuditEntityKind } | null> {
    const res = await Database.query<CondoReportContextRow>(
      `SELECT
         r.id AS report_id,
         r.parcel_id,
         r.unit_id,
         r.report_type,
         r.status,
         r.surveyor_id,
         r.is_refused_or_absent,
         r.export_revision,
         r.survey_data_json,
         p.project_parcel_code,
         p.building_type,
         COALESCE(p.is_locked, false) AS is_locked,
         p.seal_hash,
         bu.unit_code,
         bu.display_code,
         bu.unit_type,
         bu.floor_number,
         bu.floor_number AS unit_floor_number,
         bu.floor_plan_id,
         bu.status AS unit_status
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       LEFT JOIN building_units bu ON r.unit_id = bu.id
       WHERE (r.id = $1 OR r.parcel_id = $1)
       ORDER BY (CASE WHEN r.id = $1 THEN 0 ELSE 1 END), r.created_at DESC
       LIMIT 1;`,
      [reportIdOrParcelId]
    );

    const row = res.rows[0];
    if (!row) return null;

    const bType = String(row.building_type || '').toUpperCase();
    const rType = String(row.report_type || '').toUpperCase();
    const uType = String(row.unit_type || '').toUpperCase();
    const uCode = String(row.unit_code || '').toUpperCase();

    const isCondoDomain =
      bType === 'CONDOMINIUM' ||
      bType === 'CONDO' ||
      Boolean(row.unit_id) ||
      ['BUILDING_MASTER', 'CONDO_MASTER', 'MASTER_AREA', 'CONDO_UNIT', 'UNIT_CHILD'].includes(rType);

    if (!isCondoDomain) {
      return null;
    }

    let entityKind: CondoAuditEntityKind = 'BUILDING_MASTER';
    if (!row.unit_id && ['BUILDING_MASTER', 'CONDO_MASTER', 'STANDALONE', ''].includes(rType)) {
      entityKind = 'BUILDING_MASTER';
    } else if (
      rType === 'MASTER_AREA' ||
      uType === 'MASTER_AREA' ||
      uCode.startsWith('MA-') ||
      uCode.startsWith('AREA-')
    ) {
      entityKind = 'MASTER_AREA';
    } else {
      entityKind = 'CONDO_UNIT';
    }

    return { context: row, entityKind };
  }

  static getStrategy(kind: CondoAuditEntityKind): ICondoEntityAuditStrategy {
    return this.strategies[kind];
  }

  /**
   * Thực thi lưu chỉnh sửa thẩm định (Multi-tier CRUD + Photo Lineage + Auto-Seed v0 + Snapshot v(n+1))
   * Dành riêng cho 3 thực thể Chung cư (BUILDING_MASTER, MASTER_AREA, CONDO_UNIT).
   */
  static async applyCondoAdminSurveyEdit(
    reportId: string,
    adminId: string,
    payload: CondoAdminEditPayload,
    clientIp?: string
  ): Promise<{ success: boolean; reportId: string; entityKind: CondoAuditEntityKind; message: string }> {
    const resolved = await this.resolveCondoReportContext(reportId);
    if (!resolved) {
      throw new NotFoundError(`Không tìm thấy hồ sơ thẩm định chung cư với ID: ${reportId}`);
    }

    const { context, entityKind } = resolved;
    const actualReportId = context.report_id;
    const strategy = this.getStrategy(entityKind);

    // 1. Kiểm tra trạng thái khóa hồ sơ & khóa sổ pháp lý tòa tháp
    if (context.is_locked) {
      throw new ConflictError(
        'Toàn bộ khối tháp đã được Niêm Phong & Khóa Sổ Pháp Lý (Final Seal). Không thể chỉnh sửa hồ sơ trực thuộc.'
      );
    }
    if (context.status === 'APPROVED') {
      throw new ConflictError(
        'Hồ sơ đã được Phê duyệt (APPROVED) và khóa bất biến. Chỉ Super Admin mới có quyền Mở khóa (Unlock) trước khi điều chỉnh.'
      );
    }

    // 2. Xác thực mật khẩu của Zone Admin / Super Admin
    if (!payload.adminPassword || payload.adminPassword.trim().length < 1) {
      throw new BadRequestError('Vui lòng nhập mật khẩu tài khoản để xác thực quyền điều chỉnh hồ sơ pháp lý.');
    }
    const adminRes = await Database.query<{ password_hash: string; role: string }>(
      `SELECT password_hash, role FROM users WHERE id = $1 AND is_active = true;`,
      [adminId]
    );
    if (!adminRes.rows[0]) {
      throw new ForbiddenError('Tài khoản thẩm định viên không hợp lệ hoặc đã bị vô hiệu hóa.');
    }
    const isPasswordValid = await CryptoUtils.comparePassword(
      payload.adminPassword,
      adminRes.rows[0].password_hash
    );
    if (!isPasswordValid) {
      throw new ForbiddenError('Mật khẩu xác thực không chính xác. Từ chối ghi nhận điều chỉnh.');
    }

    if (!payload.editReason || payload.editReason.trim().length < 5) {
      throw new BadRequestError('Lý do điều chỉnh kỹ thuật bắt buộc tối thiểu 5 ký tự.');
    }

    const existingJson: Record<string, unknown> =
      typeof context.survey_data_json === 'string'
        ? (JSON.parse(context.survey_data_json) as Record<string, unknown>)
        : context.survey_data_json && typeof context.survey_data_json === 'object'
          ? { ...context.survey_data_json }
          : {};

    // 3. Chạy Gatekeeper riêng của từng cấp thực thể (ví dụ CAT 1/2 cho BUILDING_MASTER)
    await strategy.validateBeforeModify(
      context,
      payload.updates || {},
      payload.photoActions || []
    );

    // 4. Tự động khởi tạo phiên bản gốc bất biến v0 (ORIGINAL_SUBMISSION) nếu chưa có bản chụp nào
    try {
      const verCountRes = await Database.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM survey_report_versions WHERE report_id = $1;`,
        [actualReportId]
      );
      if (Number(verCountRes.rows[0]?.count || 0) === 0) {
        const { AuditVersionService } = await import('../../services/audit-version.service');
        await AuditVersionService.createSnapshot(actualReportId, {
          versionTag: 'ORIGINAL_SUBMISSION',
          title: 'Bản nộp thực địa ban đầu (Baseline v0)',
          editReason:
            'Khởi tạo phiên bản cơ sở bất biến tự động trước khi chỉnh sửa thẩm định lần đầu (Auto-Seed Baseline v0)',
          userId: context.surveyor_id || adminId,
        });
      }
    } catch (seedErr: unknown) {
      console.warn('[CondoCrudEngineService.applyCondoAdminSurveyEdit] Auto-seed v0 warning:', seedErr);
    }

    const mergedJson: Record<string, unknown> = { ...existingJson };

    // 5. Thực thi Dual-Write (SQL + JSONB) + Photo Lineage trong 1 Transaction ACID
    await Database.transaction(async (client) => {
      await strategy.applyCrudInTransaction(
        client,
        context,
        mergedJson,
        payload.updates || {},
        adminId
      );

      if (Array.isArray(payload.photoActions) && payload.photoActions.length > 0) {
        for (const pa of payload.photoActions) {
          await CondoPhotoLineageService.applyPhotoActionInTx(
            client,
            actualReportId,
            context.parcel_id,
            adminId,
            mergedJson,
            pa
          );
        }
      }

      mergedJson._lastAdminEdit = {
        adminId,
        entityKind,
        timestamp: new Date().toISOString(),
        reason: payload.editReason.trim(),
        diffCount: Array.isArray(payload.diffPayload) ? payload.diffPayload.length : 0,
        photoActionsCount: Array.isArray(payload.photoActions) ? payload.photoActions.length : 0,
      };

      await client.query(
        `UPDATE base_survey_reports
         SET survey_data_json = $1,
             status = CASE WHEN status = 'SUBMITTED' THEN 'UNDER_REVIEW'::report_status_enum ELSE status END,
             updated_at = NOW()
         WHERE id = $2;`,
        [JSON.stringify(mergedJson), actualReportId]
      );

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
            condoEntityKind: entityKind,
            editReason: payload.editReason.trim(),
            diff: payload.diffPayload || [],
            photoActionsCount: payload.photoActions?.length || 0,
            timestamp: new Date().toISOString(),
            verification: 'PASSWORD_VERIFIED',
          }),
          clientIp || null,
        ]
      );
    });

    // 6. Tự động tính lại điểm số kỹ thuật (ECS/VI/BRA cho Master, hoặc Burland cho Area/Unit)
    try {
      await strategy.recomputeDerivedScoresAfterCrud(
        context,
        mergedJson,
        payload.updates || {},
        adminId
      );
    } catch (scoreErr: unknown) {
      console.error('[CondoCrudEngineService.applyCondoAdminSurveyEdit] Recompute score error:', scoreErr);
    }

    // 7. Ghi nhận phiên bản chỉnh sửa bất biến v(n+1) (ADMIN_DIFF_SAVE)
    try {
      const { AuditVersionService } = await import('../../services/audit-version.service');
      const diffLen = Array.isArray(payload.diffPayload) ? payload.diffPayload.length : 0;
      const photoLen = Array.isArray(payload.photoActions) ? payload.photoActions.length : 0;
      await AuditVersionService.createSnapshot(actualReportId, {
        versionTag: 'ADMIN_DIFF_SAVE',
        title: `Chỉnh sửa thẩm định [${entityKind}] (${diffLen} mục dữ liệu${photoLen > 0 ? `, ${photoLen} thao tác ảnh` : ''})`,
        editReason: payload.editReason.trim(),
        userId: adminId,
        clientIp,
        diffSummary: payload.diffPayload,
      });
    } catch (snapErr: unknown) {
      console.error('[CondoCrudEngineService.applyCondoAdminSurveyEdit] Create snapshot error:', snapErr);
    }

    return {
      success: true,
      reportId: actualReportId,
      entityKind,
      message: 'Đã lưu chỉnh sửa hồ sơ chung cư và ghi nhận vào Nhật ký kiểm toán pháp lý thành công.',
    };
  }

  /**
   * Thực thi thao tác ảnh đơn lẻ (ADD / REPLACE / DELETE / ROTATE) cho hồ sơ Chung cư
   */
  static async executeCondoPhotoAction(
    reportId: string,
    adminId: string,
    photoAction: CondoPhotoActionItem,
    clientIp?: string
  ) {
    const resolved = await this.resolveCondoReportContext(reportId);
    if (!resolved) {
      throw new NotFoundError(`Không tìm thấy hồ sơ chung cư với ID: ${reportId}`);
    }
    const { context, entityKind } = resolved;
    const actualReportId = context.report_id;

    if (context.is_locked || context.status === 'APPROVED') {
      throw new ConflictError('Hồ sơ hoặc khối tháp đã khóa, không thể thay đổi ảnh hiện trường.');
    }

    const reason = (photoAction.editReason || photoAction.reason || 'Cập nhật ảnh thẩm định chung cư').trim();

    // Auto-seed v0 nếu chưa có
    try {
      const verCountRes = await Database.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM survey_report_versions WHERE report_id = $1;`,
        [actualReportId]
      );
      if (Number(verCountRes.rows[0]?.count || 0) === 0) {
        const { AuditVersionService } = await import('../../services/audit-version.service');
        await AuditVersionService.createSnapshot(actualReportId, {
          versionTag: 'ORIGINAL_SUBMISSION',
          title: 'Bản nộp thực địa ban đầu (Baseline v0)',
          editReason: 'Khởi tạo phiên bản cơ sở tự động trước khi thao tác ảnh lần đầu',
          userId: context.surveyor_id || adminId,
        });
      }
    } catch (seedErr: unknown) {
      console.warn('[CondoCrudEngineService.executeCondoPhotoAction] Auto-seed v0 warning:', seedErr);
    }

    const existingJson: Record<string, unknown> =
      typeof context.survey_data_json === 'string'
        ? (JSON.parse(context.survey_data_json) as Record<string, unknown>)
        : context.survey_data_json && typeof context.survey_data_json === 'object'
          ? { ...context.survey_data_json }
          : {};

    await Database.transaction(async (client) => {
      await CondoPhotoLineageService.applyPhotoActionInTx(
        client,
        actualReportId,
        context.parcel_id,
        adminId,
        existingJson,
        photoAction
      );

      await client.query(
        `UPDATE base_survey_reports SET survey_data_json = $1, updated_at = NOW() WHERE id = $2;`,
        [JSON.stringify(existingJson), actualReportId]
      );

      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'BASE_SURVEY_REPORT',
          actualReportId,
          `ZONE_ADMIN_PHOTO_${photoAction.action}`,
          adminId,
          JSON.stringify({
            condoEntityKind: entityKind,
            photoAction,
            reason,
            timestamp: new Date().toISOString(),
          }),
          clientIp || null,
        ]
      );
    });

    try {
      const { AuditVersionService } = await import('../../services/audit-version.service');
      const tagMap: Record<
        string,
        'PHOTO_MODIFICATION' | 'PHOTO_REPLACEMENT' | 'PHOTO_RESTORE' | 'ADMIN_DIFF_SAVE'
      > = {
        ADD: 'PHOTO_MODIFICATION',
        REPLACE: 'PHOTO_REPLACEMENT',
        DELETE: 'PHOTO_MODIFICATION',
        RESTORE: 'PHOTO_RESTORE',
      };
      await AuditVersionService.createSnapshot(actualReportId, {
        versionTag: tagMap[photoAction.action] || 'ADMIN_DIFF_SAVE',
        title: `Thao tác ảnh [${photoAction.action}] - ${photoAction.photoCode || photoAction.photoType || photoAction.category}`,
        editReason: reason,
        userId: adminId,
        clientIp,
      });
    } catch (snapErr: unknown) {
      console.error('[CondoCrudEngineService.executeCondoPhotoAction] Snapshot error:', snapErr);
    }

    return {
      success: true,
      reportId: actualReportId,
      action: photoAction.action,
      message: 'Đã thực thi thao tác ảnh và ghi nhận phả hệ thành công.',
    };
  }
}
