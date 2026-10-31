/**
 * ============================================================================
 * CONDO MASTER AREA STRATEGY (MASTER_AREA / M-xxx)
 * Chiến lược Thẩm định, CRUD Dual-Write (Vùng Z, Cấu kiện E, Vết nứt D, BBox CAD),
 * Tính điểm Burland & Rollback cô lập cho Khu Vực Dùng Chung (5 Bước).
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

export class CondoAreaAuditStrategy implements ICondoEntityAuditStrategy {
  readonly entityKind = 'MASTER_AREA' as const;

  async validateBeforeModify(
    _report: CondoReportContextRow,
    _updates: Record<string, unknown>,
    _photoActions: CondoPhotoActionItem[]
  ): Promise<void> {
    // Khu vực dùng chung (M-xxx) thuộc quyền quản lý BQL, không yêu cầu tên chủ hộ cá nhân
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

    // 1. Đồng bộ thông tin định danh Khu vực dùng chung (areaInfo & building_units)
    const curAreaInfo = ((mergedJson.areaInfo as Record<string, unknown>) || {}) as Record<string, unknown>;
    const updAreaInfo = ((updates.areaInfo as Record<string, unknown>) || {}) as Record<string, unknown>;
    const mergedAreaInfo: Record<string, unknown> = {
      ...curAreaInfo,
      ...updAreaInfo,
      ...(updates.areaName !== undefined ? { areaName: updates.areaName } : {}),
      ...(updates.areaType !== undefined ? { areaType: updates.areaType } : {}),
      ...(updates.floorNumber !== undefined ? { floorNumber: Number(updates.floorNumber) } : {}),
      ...(updates.cadBoundingBox !== undefined ? { cadBoundingBox: updates.cadBoundingBox } : {}),
      ...(updates.croppedCadUrl !== undefined ? { croppedCadUrl: updates.croppedCadUrl } : {}),
      ...(updates.overviewPhotos !== undefined ? { overviewPhotos: updates.overviewPhotos } : {}),
    };
    mergedJson.areaInfo = mergedAreaInfo;

    const resolvedFloorNum =
      mergedAreaInfo.floorNumber !== undefined && mergedAreaInfo.floorNumber !== null
        ? Number(mergedAreaInfo.floorNumber)
        : report.unit_floor_number ?? 1;
    const defaultFloorName = `Tầng ${resolvedFloorNum}`;

    if (unitId) {
      const displayName =
        (updates.displayCode as string | undefined) ||
        (mergedAreaInfo.areaName as string | undefined) ||
        report.display_code ||
        null;
      await client.query(
        `UPDATE building_units SET
           display_code = COALESCE($1, display_code),
           floor_number = COALESCE($2, floor_number),
           updated_at = NOW()
         WHERE id = $3;`,
        [displayName, Number.isFinite(resolvedFloorNum) ? resolvedFloorNum : null, unitId]
      );
    }

    // 2. Đồng bộ Dual-Write cho Vùng hư hại Kiến trúc (Z), Cấu kiện chịu lực (E) & Vết nứt (D)
    const { maxBurlandGrade } = await syncCondoZonesElementsAndDefectsInTx(
      client,
      actualReportId,
      defaultFloorName,
      mergedJson,
      updates
    );

    // 3. Cập nhật điểm Burland vào risk_score_cards
    await client.query(
      `UPDATE risk_score_cards SET e1_burland_score = $2 WHERE report_id = $1;`,
      [actualReportId, maxBurlandGrade]
    );

    // 4. Cập nhật base_survey_reports
    const sigs = (updates.signatures || mergedJson.signatures || {}) as Record<string, unknown>;
    const exec = (updates.executiveSummary || mergedJson.executiveSummary || {}) as Record<string, unknown>;

    await client.query(
      `UPDATE base_survey_reports SET
         survey_data_json = $1,
         summary_conclusions = COALESCE($2, summary_conclusions),
         engineering_recommendations = COALESCE($3, engineering_recommendations),
         surveyor_signature_url = COALESCE($4, surveyor_signature_url),
         status = CASE WHEN status = 'SUBMITTED' THEN 'UNDER_REVIEW'::report_status_enum ELSE status END,
         updated_at = NOW()
       WHERE id = $5;`,
      [
        JSON.stringify(mergedJson),
        (updates.summaryConclusions ?? exec.summaryConclusions ?? null) as string | null,
        (updates.engineeringRecommendations ?? exec.specificRecommendationsText ?? null) as string | null,
        (sigs.surveyorSignature ?? sigs.surveyorSignatureUrl ?? null) as string | null,
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
      console.error('[CondoAreaAuditStrategy.recomputeDerivedScoresAfterCrud] Lỗi cập nhật Burland:', err);
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

    const restoredJson: Record<string, unknown> = {
      ...sJson,
      damageZones: Array.isArray(sJson.damageZones)
        ? sJson.damageZones
        : Array.isArray(leftPane.damageZones)
          ? leftPane.damageZones
          : [],
      structuralElements: Array.isArray(sJson.structuralElements)
        ? sJson.structuralElements
        : Array.isArray(leftPane.structuralElements)
          ? leftPane.structuralElements
          : [],
    };

    // 1. Cô lập thực thể: CHỈ cập nhật building_units của Khu vực chung, KHÔNG chạm vào parcels!
    if (unitId) {
      const areaInfo = (restoredJson.areaInfo as Record<string, unknown> | undefined) || {};
      await client.query(
        `UPDATE building_units SET
           display_code = COALESCE($1, display_code),
           status = 'SUBMITTED',
           updated_at = NOW()
         WHERE id = $2;`,
        [(areaInfo.areaName as string | undefined) || null, unitId]
      );
    }

    // 2. Khôi phục Vùng Z, Cấu kiện E & Vết nứt D
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
         status = 'UNDER_REVIEW',
         updated_at = NOW()
       WHERE id = $3;`,
      [
        JSON.stringify(restoredJson),
        (snapshotData.engineeringRecommendations ?? restoredJson.engineeringRecommendations ?? null) as string | null,
        actualReportId,
      ]
    );

    return { restoredSurveyJson: restoredJson };
  }
}

