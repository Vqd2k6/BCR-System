/**
 * ============================================================================
 * CONDO UNIT STRATEGY (CONDO_UNIT / UNIT_CHILD / U-xxx)
 * Chiến lược Thẩm định, CRUD Dual-Write (Chủ hộ, Kẹt cửa, Thấm trần tầng trên,
 * Sơ đồ phòng, Vùng Z, Vết nứt D, Võng dầm cục bộ), Tính điểm Burland & Rollback cô lập
 * dành riêng cho Căn Hộ Con (4 Bước Thường & 3 Bước Vắng mặt).
 * TUYỆT ĐỐI KHÔNG ghi đè bảng parcels của Tòa Nhà Mẹ.
 * ============================================================================
 */

import type { PoolClient } from 'pg';
import { Database } from '../../../../database/db';
import type { CondoPhotoActionItem, CondoReportContextRow } from '../condo-audit.types';
import {
  type ICondoEntityAuditStrategy,
  syncCondoZonesElementsAndDefectsInTx,
} from './condo-entity-strategy.interface';

export class CondoUnitAuditStrategy implements ICondoEntityAuditStrategy {
  readonly entityKind = 'CONDO_UNIT' as const;

  async validateBeforeModify(
    _report: CondoReportContextRow,
    _updates: Record<string, unknown>,
    _photoActions: CondoPhotoActionItem[]
  ): Promise<void> {
    // Cho phép Admin lưu chỉnh sửa linh hoạt (kiểm tra tên chủ hộ thực hiện tại cổng Phê duyệt)
  }

  async applyCrudInTransaction(
    client: PoolClient,
    report: CondoReportContextRow,
    mergedJson: Record<string, unknown>,
    updates: Record<string, unknown>,
    _adminId: string
  ): Promise<void> {
    const actualReportId = report.report_id;
    const unitId = report.unit_id;

    // 1. Cô lập thực thể: Chỉ cập nhật bảng building_units của Căn hộ con (TUYỆT ĐỐI KHÔNG chạm vào parcels)
    if (unitId) {
      const ownerNameVal =
        typeof updates.ownerName === 'string' && updates.ownerName.trim() ? updates.ownerName.trim() : null;
      const ownerPhoneVal =
        typeof updates.ownerPhone === 'string' && updates.ownerPhone.trim() ? updates.ownerPhone.trim() : null;
      const ownerIdCardVal =
        typeof updates.ownerIdCard === 'string' && updates.ownerIdCard.trim() ? updates.ownerIdCard.trim() : null;
      const displayCodeVal =
        typeof updates.displayCode === 'string' && updates.displayCode.trim()
          ? updates.displayCode.trim()
          : typeof updates.unitCode === 'string' && updates.unitCode.trim()
            ? updates.unitCode.trim()
            : null;
      const rawResStatus = typeof updates.residentStatus === 'string' ? updates.residentStatus.trim() : '';

      await client.query('SAVEPOINT condo_unit_crud_sp;');
      try {
        await client.query(
          `UPDATE building_units SET
             owner_name = COALESCE($1, owner_name),
             owner_phone = COALESCE($2, owner_phone),
             owner_id_card = COALESCE($3, owner_id_card),
             resident_status = COALESCE($4, resident_status),
             display_code = COALESCE($5, display_code),
             updated_at = NOW()
           WHERE id = $6;`,
          [ownerNameVal, ownerPhoneVal, ownerIdCardVal, rawResStatus || null, displayCodeVal, unitId]
        );
        await client.query('RELEASE SAVEPOINT condo_unit_crud_sp;');
      } catch (unitErr) {
        console.error('[CondoUnitAuditStrategy] Fallback resident_status enum:', unitErr);
        await client.query('ROLLBACK TO SAVEPOINT condo_unit_crud_sp;');
        const safeResStatus =
          rawResStatus === 'CHO_THUÊ'
            ? 'CHO_THUÊ'
            : rawResStatus.includes('TRỐNG') || rawResStatus.includes('VẮNG')
              ? 'ĐỂ_TRỐNG'
              : 'CHỦ_HỘ_Ở';
        await client.query(
          `UPDATE building_units SET
             owner_name = COALESCE($1, owner_name),
             owner_phone = COALESCE($2, owner_phone),
             owner_id_card = COALESCE($3, owner_id_card),
             resident_status = COALESCE($4, resident_status),
             display_code = COALESCE($5, display_code),
             updated_at = NOW()
           WHERE id = $6;`,
          [ownerNameVal, ownerPhoneVal, ownerIdCardVal, rawResStatus ? safeResStatus : null, displayCodeVal, unitId]
        );
      }
    }

    // 2. Đồng bộ các trường đặc thù Căn hộ con trong mergedJson (Kẹt cửa, Thấm trần tầng trên, Võng dầm cục bộ)
    if (updates.doorJamming !== undefined) {
      mergedJson.doorJamming = updates.doorJamming;
    }
    if (updates.waterLeakageFromUpperFloor !== undefined) {
      mergedJson.waterLeakageFromUpperFloor = updates.waterLeakageFromUpperFloor;
    }
    if (updates.waterLeakageNotes !== undefined) {
      mergedJson.waterLeakageNotes = updates.waterLeakageNotes;
    }
    if (updates.unitFloorPlanSketchUrl !== undefined) {
      mergedJson.unitFloorPlanSketchUrl = updates.unitFloorPlanSketchUrl;
    }

    // 3. Đồng bộ deformation_assessments nếu có sửa độ võng dầm sàn cục bộ (beamSagging)
    const st = (updates.settlementTilt || mergedJson.settlementTilt) as Record<string, unknown> | undefined;
    const beam = (updates.beamSagging || st?.beamSagging) as Record<string, unknown> | undefined;
    if (beam) {
      const sagMm = beam.sagMm !== undefined && beam.sagMm !== '' ? Number(beam.sagMm) : null;
      const sagLevel = Math.min(4, Math.max(0, Number(beam.level) || 0));
      await client.query(
        `INSERT INTO deformation_assessments (
           report_id, beam_deflection_mm, measurement_reliability, e3_deformation_score
         ) VALUES ($1, $2, 'HIGH'::reliability_enum, $3)
         ON CONFLICT (report_id) DO UPDATE SET
           beam_deflection_mm = $2,
           e3_deformation_score = $3;`,
        [actualReportId, Number.isFinite(sagMm) ? sagMm : null, sagLevel]
      );
    }

    // 4. Đồng bộ Dual-Write Vùng hư hại các phòng (Z) & Vết nứt (D)
    const floorNum = report.unit_floor_number ?? 1;
    const { maxBurlandGrade } = await syncCondoZonesElementsAndDefectsInTx(
      client,
      actualReportId,
      `Tầng ${floorNum}`,
      mergedJson,
      updates
    );

    await client.query(
      `UPDATE risk_score_cards SET e1_burland_score = $2 WHERE report_id = $1;`,
      [actualReportId, maxBurlandGrade]
    );

    // 5. Cập nhật base_survey_reports
    const sigs = (updates.signatures || mergedJson.signatures || {}) as Record<string, unknown>;
    const exec = (updates.executiveSummary || mergedJson.executiveSummary || {}) as Record<string, unknown>;

    await client.query(
      `UPDATE base_survey_reports SET
         survey_data_json = $1,
         summary_conclusions = COALESCE($2, summary_conclusions),
         engineering_recommendations = COALESCE($3, engineering_recommendations),
         owner_remarks = COALESCE($4, owner_remarks),
         surveyor_signature_url = COALESCE($5, surveyor_signature_url),
         owner_signature_url = COALESCE($6, owner_signature_url),
         status = CASE WHEN status = 'SUBMITTED' THEN 'UNDER_REVIEW'::report_status_enum ELSE status END,
         updated_at = NOW()
       WHERE id = $7;`,
      [
        JSON.stringify(mergedJson),
        (updates.summaryConclusions ?? exec.summaryConclusions ?? null) as string | null,
        (updates.engineeringRecommendations ?? exec.specificRecommendationsText ?? null) as string | null,
        (sigs.ownerFeedback ?? updates.ownerRemarks ?? null) as string | null,
        (sigs.surveyorSignature ?? sigs.surveyorSignatureUrl ?? null) as string | null,
        (sigs.ownerSignature ?? sigs.ownerSignatureUrl ?? null) as string | null,
        actualReportId,
      ]
    );
  }

  async recomputeDerivedScoresAfterCrud(
    report: CondoReportContextRow,
    mergedJson: Record<string, unknown>,
    _updates: Record<string, unknown>,
    _adminId: string
  ): Promise<void> {
    const bs = (mergedJson.burlandSummary as Record<string, unknown> | undefined) || {};
    const maxGrade = Number(bs.localMaxGrade ?? bs.predominantGrade ?? 0) || 0;
    try {
      await Database.query(
        `UPDATE risk_score_cards SET e1_burland_score = $2 WHERE report_id = $1;`,
        [report.report_id, maxGrade]
      );
    } catch (err) {
      console.error('[CondoUnitAuditStrategy.recomputeDerivedScoresAfterCrud] Lỗi cập nhật Burland:', err);
    }
  }

  async restoreSnapshotInTransaction(
    client: PoolClient,
    report: CondoReportContextRow,
    snapshotData: Record<string, unknown>,
    _adminId: string
  ): Promise<{ restoredSurveyJson: Record<string, unknown> }> {
    const actualReportId = report.report_id;
    const unitId = report.unit_id;
    const leftPane = (snapshotData.leftPane || {}) as Record<string, unknown>;
    const sJson = ((snapshotData.surveyJson || snapshotData.survey_data_json || snapshotData.frozenSurveyDataJson || {}) as Record<string, unknown>);
    const uInfo = (snapshotData.unitInfo || {}) as Record<string, unknown>;

    const restoredJson: Record<string, unknown> = {
      ...sJson,
      damageZones: Array.isArray(sJson.damageZones)
        ? sJson.damageZones
        : Array.isArray(leftPane.damageZones)
          ? leftPane.damageZones
          : [],
    };

    // 1. Cô lập thực thể: CHỈ khôi phục building_units của Căn hộ con, TUYỆT ĐỐI KHÔNG chạm vào parcels!
    if (unitId) {
      await client.query(
        `UPDATE building_units SET
           owner_name = COALESCE($1, owner_name),
           owner_phone = COALESCE($2, owner_phone),
           owner_id_card = COALESCE($3, owner_id_card),
           display_code = COALESCE($4, display_code),
           status = 'SUBMITTED',
           updated_at = NOW()
         WHERE id = $5;`,
        [
          (restoredJson.ownerName ?? uInfo.owner_name ?? snapshotData.ownerName ?? null) as string | null,
          (restoredJson.ownerPhone ?? uInfo.owner_phone ?? snapshotData.ownerPhone ?? null) as string | null,
          (restoredJson.ownerIdCard ?? uInfo.owner_id_card ?? null) as string | null,
          (restoredJson.displayCode ?? uInfo.display_code ?? null) as string | null,
          unitId,
        ]
      );
    }

    // 2. Khôi phục Vùng hư hại Z & Vết nứt D
    const floorNum = report.unit_floor_number ?? 1;
    const { maxBurlandGrade } = await syncCondoZonesElementsAndDefectsInTx(
      client,
      actualReportId,
      `Tầng ${floorNum}`,
      restoredJson,
      restoredJson
    );

    await client.query(
      `UPDATE risk_score_cards SET e1_burland_score = $2 WHERE report_id = $1;`,
      [actualReportId, maxBurlandGrade]
    );

    // 3. Khôi phục base_survey_reports
    await client.query(
      `UPDATE base_survey_reports SET
         survey_data_json = $1,
         engineering_recommendations = COALESCE($2, engineering_recommendations),
         owner_remarks = COALESCE($3, owner_remarks),
         status = 'UNDER_REVIEW',
         updated_at = NOW()
       WHERE id = $4;`,
      [
        JSON.stringify(restoredJson),
        (snapshotData.engineeringRecommendations ?? restoredJson.engineeringRecommendations ?? null) as string | null,
        (snapshotData.ownerRemarks ?? restoredJson.ownerRemarks ?? null) as string | null,
        actualReportId,
      ]
    );

    return { restoredSurveyJson: restoredJson };
  }
}

