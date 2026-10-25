import { Database } from '../../../../database/db';
import { CryptoUtils } from '../../../../common/utils/crypto.utils';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../common/errors/problem-details';
import { CondoAuditEntityKind, CondoRollbackPayload } from '../condo-audit.types';
import { CondoCrudEngineService } from './condo-crud-engine.service';
import { CondoPhotoLineageService } from './condo-photo-lineage.service';

export class CondoVersionRollbackService {
  /**
   * Hoàn nguyên phiên bản bất biến (Append-Only Time-Travel Rollback) cho hồ sơ Chung cư.
   * Phân lập 3 cấp độ:
   * - BUILDING_MASTER: khôi phục hồ sơ Master + bảng parcels + building_specifications + building_floor_plans
   * - MASTER_AREA: chỉ khôi phục khu vực dùng chung + building_units (cô lập tuyệt đối khỏi bảng parcels)
   * - CONDO_UNIT: chỉ khôi phục căn hộ con + building_units (cô lập tuyệt đối khỏi bảng parcels)
   */
  static async rollbackCondoReportVersion(
    reportId: string,
    targetVersionNumber: number,
    adminId: string,
    payload: CondoRollbackPayload,
    clientIp?: string
  ): Promise<{
    success: boolean;
    message: string;
    targetVersionNumber: number;
    newVersionNumber: number;
    reportId: string;
    entityKind: CondoAuditEntityKind;
  }> {
    const resolved = await CondoCrudEngineService.resolveCondoReportContext(reportId);
    if (!resolved) {
      throw new NotFoundError(`Không tìm thấy hồ sơ chung cư với ID: ${reportId}`);
    }

    const { context, entityKind } = resolved;
    const actualReportId = context.report_id;
    const strategy = CondoCrudEngineService.getStrategy(entityKind);

    if (!payload.reason || payload.reason.trim().length < 5) {
      throw new BadRequestError('Bắt buộc nhập lý do khôi phục phiên bản tối thiểu 5 ký tự.');
    }

    if (context.is_locked) {
      throw new ConflictError(
        'Khối tháp đã được Niêm Phong & Khóa Sổ Pháp Lý (Final Seal). Không thể khôi phục phiên bản.'
      );
    }

    if (context.status === 'APPROVED') {
      throw new ConflictError(
        'Hồ sơ đã được Phê duyệt (APPROVED) và khóa bất biến. Chỉ Super Admin mới có thể Mở khóa (Unlock) trước khi khôi phục phiên bản.'
      );
    }

    // Xác thực mật khẩu tài khoản thực hiện Rollback
    const rawPassword = payload.password || payload.adminPassword || '';
    if (!rawPassword || rawPassword.trim().length === 0) {
      throw new BadRequestError('Bắt buộc nhập mật khẩu tài khoản để xác thực quyền khôi phục phiên bản.');
    }

    const adminRes = await Database.query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1 AND is_active = true;`,
      [adminId]
    );
    if (!adminRes.rows[0]) {
      throw new ForbiddenError('Không tìm thấy tài khoản quản trị viên hợp lệ.');
    }

    const isPassValid = await CryptoUtils.comparePassword(
      rawPassword,
      adminRes.rows[0].password_hash
    );
    if (!isPassValid) {
      throw new ForbiddenError('Mật khẩu xác thực không chính xác! Từ chối quyền khôi phục phiên bản.');
    }

    // Truy vấn phiên bản đích cần khôi phục
    const targetVerRes = await Database.query<{
      id: string;
      version_number: number;
      version_tag: string;
      title: string;
      snapshot_data: Record<string, unknown> | string;
    }>(
      `SELECT id, version_number, version_tag, title, snapshot_data
       FROM survey_report_versions
       WHERE report_id = $1 AND version_number = $2;`,
      [actualReportId, targetVersionNumber]
    );

    if (!targetVerRes.rows[0]) {
      throw new NotFoundError(
        `Không tìm thấy phiên bản v${targetVersionNumber} của hồ sơ ${actualReportId}.`
      );
    }

    const targetVer = targetVerRes.rows[0];
    const snapshotObj: Record<string, unknown> =
      typeof targetVer.snapshot_data === 'string'
        ? (JSON.parse(targetVer.snapshot_data) as Record<string, unknown>)
        : targetVer.snapshot_data || {};

    return Database.transaction(async (client) => {
      // 1. Khôi phục dữ liệu SQL + JSONB theo đúng Strategy của cấp thực thể (không làm hỏng parcels khi rollback căn hộ/khu vực chung)
      const { restoredSurveyJson } = await strategy.restoreSnapshotInTransaction(
        client,
        context,
        snapshotObj,
        adminId
      );

      // 2. Đồng bộ trạng thái ACTIVE / SUPERSEDED trên survey_photo_registry
      await CondoPhotoLineageService.syncPhotoRegistryOnRollbackInTx(
        client,
        actualReportId,
        restoredSurveyJson,
        snapshotObj
      );

      // 3. Lấy số phiên bản mới tiếp theo (Append-Only)
      const maxVerRes = await client.query<{ max_ver: number | null }>(
        `SELECT MAX(version_number) AS max_ver FROM survey_report_versions WHERE report_id = $1;`,
        [actualReportId]
      );
      const nextVer = Number(maxVerRes.rows[0]?.max_ver ?? 0) + 1;

      const rollbackTitle = `Khôi phục [${entityKind}] về phiên bản v${targetVersionNumber} (${targetVer.title})`;
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
          JSON.stringify(snapshotObj),
          JSON.stringify([
            {
              field: 'VERSION_ROLLBACK',
              label: `Khôi phục phiên bản (${entityKind})`,
              oldValue: `v${maxVerRes.rows[0]?.max_ver ?? 0}`,
              newValue: `v${targetVersionNumber}`,
            },
          ]),
          adminId,
          clientIp || null,
        ]
      );

      // 4. Ghi nhật ký hệ thống bất biến
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
            condoEntityKind: entityKind,
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
        message: `Đã khôi phục hồ sơ [${entityKind}] về phiên bản v${targetVersionNumber} thành công! Phiên bản mới được ghi nhận là v${nextVer}.`,
        targetVersionNumber,
        newVersionNumber: nextVer,
        reportId: actualReportId,
        entityKind,
      };
    });
  }
}
