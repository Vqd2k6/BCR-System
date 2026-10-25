import crypto from 'crypto';
import { Database } from '../../../../database/db';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../../../common/errors/problem-details';
import { ReportSnapshotService } from '../../../report/snapshot/report-snapshot.service';
import { ReportConsistencyGate } from '../../services/report-consistency-gate';
import { CondoCrudEngineService } from './condo-crud-engine.service';

export class CondoFinalSealService {
  /**
   * Phê duyệt hồ sơ Chung cư theo đúng cấp thực thể (BUILDING_MASTER | MASTER_AREA | CONDO_UNIT):
   * - BUILDING_MASTER: Phê duyệt hồ sơ gốc tòa tháp, chụp snapshot APPROVED_RELEASE, đồng bộ địa chỉ tòa nhà (chưa khóa sổ các căn hộ con).
   * - MASTER_AREA: Phê duyệt khu vực dùng chung (miễn trừ kiểm tra tên chủ hộ cá nhân), cập nhật building_units.status = 'APPROVED'.
   * - CONDO_UNIT: Kiểm tra tên chủ sở hữu thực tế (trừ căn hộ vắng mặt), cập nhật building_units.status = 'APPROVED' mà không ghi đè bảng parcels.
   */
  static async approveCondoReport(
    reportId: string,
    adminId: string,
    judgementNotes?: string
  ) {
    const resolved = await CondoCrudEngineService.resolveCondoReportContext(reportId);
    if (!resolved) {
      throw new NotFoundError(`Không tìm thấy hồ sơ chung cư với ID: ${reportId}`);
    }

    const { context, entityKind } = resolved;
    const actualReportId = context.report_id;
    const actualParcelId = context.parcel_id;

    return Database.transaction(async (client) => {
      const repRes = await client.query<{
        id: string;
        parcel_id: string;
        project_parcel_code: string;
        is_refused_or_absent: boolean;
        summary_conclusions: string | null;
        current_step: number;
        unit_id: string | null;
        report_type: string | null;
        status: string;
        export_revision: number;
        survey_data_json: Record<string, unknown> | null;
      }>(
        `SELECT r.id, r.parcel_id, p.project_parcel_code, r.is_refused_or_absent, r.summary_conclusions,
                r.current_step, r.unit_id, r.report_type, r.status, r.export_revision, r.survey_data_json
         FROM base_survey_reports r
         JOIN parcels p ON r.parcel_id = p.id
         WHERE r.id = $1
         FOR UPDATE;`,
        [actualReportId]
      );

      if (!repRes.rows[0]) {
        throw new NotFoundError(`Không tìm thấy hồ sơ với ID: ${actualReportId}`);
      }

      const reportRow = repRes.rows[0];
      if (reportRow.status === 'APPROVED') {
        throw new ConflictError(
          'Hồ sơ đã ở trạng thái APPROVED. Muốn thay đổi hãy dùng "Phát hành Rev mới" hoặc Mở khóa.'
        );
      }

      const surveyJson =
        reportRow.survey_data_json && typeof reportRow.survey_data_json === 'object'
          ? reportRow.survey_data_json
          : {};

      const { SurveyRepository } = await import('../../../survey/survey.repository');
      const fullReportContext = await SurveyRepository.findReportById(actualReportId);
      const gateReportObj = fullReportContext ? { ...fullReportContext, ...reportRow } : reportRow;

      // Đối với CONDO_UNIT thường (không phải vắng mặt, không phải MASTER_AREA, không phải BUILDING_MASTER), kiểm tra tên chủ căn hộ
      const isAbsentUnit = Boolean(
        reportRow.is_refused_or_absent ||
          surveyJson.isAbsentee ||
          surveyJson.isAbsenteeSurvey ||
          surveyJson.isRefusedOrAbsent ||
          String(surveyJson.surveyCaseType || '').toUpperCase() === 'ABSENTEE' ||
          ['VẮNG_MẶT_KHÓA_CỬA', 'BỎ_TRỐNG_CHƯA_VỀ_Ở'].includes(
            String(surveyJson.residentStatus || '').toUpperCase()
          )
      );

      const isPlaceholderOwner = (val: unknown) =>
        typeof val === 'string' &&
        /^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)/i.test(val.trim());

      const resolvedRealOwnerName =
        (typeof surveyJson.ownerName === 'string' &&
          surveyJson.ownerName.trim() &&
          !isPlaceholderOwner(surveyJson.ownerName)
          ? surveyJson.ownerName.trim()
          : null) ||
        (typeof fullReportContext?.owner_name === 'string' &&
          fullReportContext.owner_name.trim() &&
          !isPlaceholderOwner(fullReportContext.owner_name)
          ? fullReportContext.owner_name.trim()
          : null);

      if (entityKind === 'CONDO_UNIT' && !isAbsentUnit && !resolvedRealOwnerName) {
        throw new BadRequestError(
          'Không thể phê duyệt: Căn hộ chưa có Tên chủ sở hữu / người đại diện hợp lệ. Vui lòng cập nhật tên chủ hộ tại Bước 1 hoặc trả về để khảo sát viên bổ sung.'
        );
      }

      const gateResult = ReportConsistencyGate.assertConsistency(
        gateReportObj,
        surveyJson,
        judgementNotes
      );

      const currentRev = reportRow.export_revision ?? 0;
      const prevApprovedCountRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM survey_report_versions WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE';`,
        [actualReportId]
      );
      const isReApproval = Number(prevApprovedCountRes.rows[0]?.count || 0) > 0;

      const approveRes = await client.query<{ approved_at: Date }>(
        `UPDATE base_survey_reports
         SET status = 'APPROVED',
             zone_admin_id = $2,
             approved_at = NOW(),
             engineering_recommendations = COALESCE($3, engineering_recommendations),
             export_revision = $4,
             updated_at = NOW()
         WHERE id = $1
         RETURNING approved_at;`,
        [actualReportId, adminId, judgementNotes || null, currentRev]
      );

      const approvedSnapshot = await ReportSnapshotService.writeApprovedRelease(
        client,
        actualReportId,
        adminId,
        approveRes.rows[0].approved_at,
        isReApproval
          ? `Phê duyệt lại số liệu [${entityKind}] sau mở khóa (Rev ${String(currentRev).padStart(2, '0')})`
          : `Chốt điểm pháp lý [${entityKind}] tại thời điểm APPROVE`,
        currentRev
      );

      if ((entityKind === 'CONDO_UNIT' || entityKind === 'MASTER_AREA') && reportRow.unit_id) {
        const areaInfo =
          surveyJson.areaInfo && typeof surveyJson.areaInfo === 'object'
            ? (surveyJson.areaInfo as Record<string, unknown>)
            : null;
        const unitOwnerLabel =
          entityKind === 'MASTER_AREA'
            ? (typeof areaInfo?.areaName === 'string' && areaInfo.areaName.trim()
                ? areaInfo.areaName.trim()
                : resolvedRealOwnerName)
            : resolvedRealOwnerName;

        await client.query(
          `UPDATE building_units
           SET status = 'APPROVED',
               owner_name = COALESCE($2, owner_name),
               owner_phone = COALESCE($3, owner_phone),
               updated_at = NOW()
           WHERE id = $1;`,
          [
            reportRow.unit_id,
            unitOwnerLabel,
            typeof surveyJson.ownerPhone === 'string' && surveyJson.ownerPhone.trim()
              ? surveyJson.ownerPhone.trim()
              : null,
          ]
        );
      } else if (entityKind === 'BUILDING_MASTER') {
        const bName =
          typeof surveyJson.buildingName === 'string' && surveyJson.buildingName.trim()
            ? surveyJson.buildingName.trim()
            : resolvedRealOwnerName;
        await client.query(
          `UPDATE parcels
           SET survey_status = 'UNDER_REVIEW',
               owner_name = COALESCE($2, owner_name),
               owner_phone = COALESCE($3, owner_phone),
               house_number = COALESCE($4, house_number),
               street = COALESCE($5, street),
               updated_at = NOW()
           WHERE id = $1 AND COALESCE(is_locked, false) = false;`,
          [
            actualParcelId,
            bName,
            typeof surveyJson.ownerPhone === 'string' && surveyJson.ownerPhone.trim()
              ? surveyJson.ownerPhone.trim()
              : null,
            typeof surveyJson.houseNumber === 'string' && surveyJson.houseNumber.trim()
              ? surveyJson.houseNumber.trim()
              : null,
            typeof surveyJson.street === 'string' && surveyJson.street.trim()
              ? surveyJson.street.trim()
              : null,
          ]
        );
      }

      await client.query(
        `UPDATE audit_alert_items
         SET is_resolved = TRUE, resolved_by_user_id = $2, resolved_at = NOW()
         WHERE report_id = $1;`,
        [actualReportId, adminId]
      );

      await client.query(`DELETE FROM survey_audit_locks WHERE report_id = $1;`, [actualReportId]);

      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload
         ) VALUES ($1, $2, $3, $4, $5);`,
        [
          'BASE_SURVEY_REPORT',
          actualReportId,
          'ZONE_ADMIN_APPROVE_REPORT',
          adminId,
          JSON.stringify({
            reportId: actualReportId,
            parcelId: actualParcelId,
            condoEntityKind: entityKind,
            status: 'APPROVED',
            exportRevision: currentRev,
            isReApproval,
            judgementNotes: judgementNotes || null,
            gateWarnings: gateResult.warnings,
            gateDetails: gateResult.details,
            snapshotVersionId: approvedSnapshot.versionId,
            snapshotSha256: approvedSnapshot.snapshot.contentSha256,
            timestamp: new Date().toISOString(),
          }),
        ]
      );

      return {
        reportId: actualReportId,
        parcelId: actualParcelId,
        condoEntityKind: entityKind,
        status: 'APPROVED',
        exportRevision: currentRev,
        isReApproval,
        snapshotVersionId: approvedSnapshot.versionId,
        snapshotSha256: approvedSnapshot.snapshot.contentSha256,
        message:
          entityKind === 'BUILDING_MASTER'
            ? 'Đã phê duyệt Hồ sơ Tòa nhà mẹ (Master Report) và chốt snapshot bất biến (APPROVED_RELEASE).'
            : entityKind === 'MASTER_AREA'
              ? 'Đã phê duyệt Khu vực dùng chung (Master Area) và chốt snapshot bất biến (APPROVED_RELEASE).'
              : 'Đã phê duyệt Căn hộ con (Condo Unit) và chốt snapshot bất biến (APPROVED_RELEASE).',
      };
    });
  }

  /**
   * Thực thi Niêm Phong & Khóa Sổ Pháp Lý Toàn Diện Khối Tháp Chung Cư (Condo Final Legal Seal)
   * Điều kiện bắt buộc:
   * 1. Hồ sơ Tòa nhà mẹ (BUILDING_MASTER) phải đạt trạng thái APPROVED.
   * 2. 100% Căn hộ con (CONDO_UNIT) và Khu vực dùng chung (MASTER_AREA) phải đạt APPROVED hoặc POSTPONED_ABSENT_VERIFIED.
   */
  static async executeFinalSeal(
    parcelId: string,
    adminId: string,
    sealNotes?: string
  ) {
    return Database.transaction(async (client) => {
      const parcelRes = await client.query<{
        id: string;
        project_parcel_code: string;
        is_locked: boolean;
        survey_status: string;
      }>(
        `SELECT id, project_parcel_code, COALESCE(is_locked, false) AS is_locked, survey_status
         FROM parcels
         WHERE id = $1
         FOR UPDATE;`,
        [parcelId]
      );

      if (!parcelRes.rows[0]) {
        throw new NotFoundError(`Không tìm thấy tòa nhà chung cư với ID: ${parcelId}`);
      }

      const parcel = parcelRes.rows[0];
      if (parcel.is_locked) {
        throw new BadRequestError('Tòa nhà chung cư này đã được Khóa Sổ Pháp Lý trước đó.');
      }

      // 1. Kiểm tra Hồ sơ Tòa nhà mẹ (Master Report) đã APPROVED chưa
      const masterRes = await client.query<{ id: string; status: string }>(
        `SELECT id, status::text AS status
         FROM base_survey_reports
         WHERE parcel_id = $1 AND (unit_id IS NULL OR report_type IN ('CONDO_MASTER', 'BUILDING_MASTER'))
         ORDER BY created_at DESC
         LIMIT 1;`,
        [parcelId]
      );
      const masterReport = masterRes.rows[0];
      if (!masterReport || masterReport.status !== 'APPROVED') {
        throw new BadRequestError(
          'Không thể Khóa Sổ Pháp Lý: Hồ sơ Tòa nhà mẹ (Building Master Report) chưa được Phê duyệt (APPROVED). Vui lòng thẩm định và phê duyệt Hồ sơ Tòa nhà mẹ trước.'
        );
      }

      // 2. Kiểm tra toàn bộ Căn hộ & Khu vực dùng chung trực thuộc
      const unitsRes = await client.query<{
        id: string;
        unit_code: string;
        status: string;
      }>(
        `SELECT id, unit_code, status
         FROM building_units
         WHERE parcel_id = $1 AND deleted_at IS NULL
         ORDER BY unit_code ASC;`,
        [parcelId]
      );

      if (unitsRes.rows.length === 0) {
        throw new BadRequestError(
          'Không thể Khóa Sổ Pháp Lý: Khối tháp chưa có căn hộ hoặc khu vực dùng chung nào được ghi nhận.'
        );
      }

      const incompleteUnits = unitsRes.rows.filter(
        (u) => u.status !== 'APPROVED' && u.status !== 'POSTPONED_ABSENT_VERIFIED'
      );
      if (incompleteUnits.length > 0) {
        const sampleCodes = incompleteUnits
          .slice(0, 5)
          .map((u) => `${u.unit_code} (${u.status})`)
          .join(', ');
        throw new BadRequestError(
          `Không thể Khóa Sổ Pháp Lý: Tòa nhà còn ${incompleteUnits.length} căn hộ / khu vực dùng chung chưa hoàn tất thẩm định (${sampleCodes}). Yêu cầu 100% đạt APPROVED hoặc POSTPONED_ABSENT_VERIFIED.`
        );
      }

      // 3. Sinh mã băm mật mã học SHA-256 bao trùm toàn bộ cây phân cấp của tòa tháp
      const timestamp = new Date().toISOString();
      const unitDigest = unitsRes.rows.map((u) => `${u.id}:${u.unit_code}:${u.status}`).join('|');
      const hashPayload = `${parcelId}:${parcel.project_parcel_code}:MASTER=${masterReport.id}:UNITS=[${unitDigest}]:ADMIN=${adminId}:TS=${timestamp}`;
      const sealHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

      // 4. Khóa sổ bảng parcels
      await client.query(
        `UPDATE parcels
         SET survey_status = 'APPROVED',
             is_locked = TRUE,
             locked_at = NOW(),
             locked_by_id = $2,
             seal_hash = $3,
             seal_notes = $4,
             updated_at = NOW()
         WHERE id = $1;`,
        [parcelId, adminId, sealHash, sealNotes || null]
      );

      // 5. Ghi nhận vào system_audit_logs
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload
         ) VALUES ($1, $2, $3, $4, $5);`,
        [
          'PARCEL',
          parcelId,
          'CONDO_FINAL_LEGAL_SEAL',
          adminId,
          JSON.stringify({
            parcelId,
            projectParcelCode: parcel.project_parcel_code,
            masterReportId: masterReport.id,
            totalUnitsSealed: unitsRes.rows.length,
            sealHash,
            lockedAt: timestamp,
            notes: sealNotes || null,
          }),
        ]
      );

      return {
        parcelId,
        projectParcelCode: parcel.project_parcel_code,
        masterReportId: masterReport.id,
        totalUnitsSealed: unitsRes.rows.length,
        status: 'APPROVED',
        isLocked: true,
        sealHash,
        lockedAt: timestamp,
        message: 'Đã hoàn tất Niêm Phong & Khóa Sổ Pháp Lý Toàn Diện Khối Tháp Chung Cư thành công.',
      };
    });
  }
}
