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
  isJsonRecord,
  syncHistoryInterviewInTx,
  syncUnitDeformationInTx,
  toFiniteNumberOrNull,
} from '../../services/audit-sql-sync.helpers';
import {
  keepCurrentCadPosition,
  type NormalizedCondoSnapshot,
  restoreCondoBuildingUnitInTx,
  restoreCondoChildTablesInTx,
  restoreCondoReportFieldsInTx,
} from '../services/condo-snapshot-restore.helpers';
import { moveCondoUnitFloorInTx, renameCondoUnitCodeInTx } from '../services/condo-unit-identity.helpers';
import {
  applyCondoPinUpdatesToFloors,
  assertCondoZonesNotWiped,
  type CondoRestoreOptions,
  hasCondoZoneUpdates,
  type ICondoEntityAuditStrategy,
  mergeCondoEditableJson,
  syncCondoZonesElementsAndDefectsInTx,
} from './condo-entity-strategy.interface';

const UNIT_EDITABLE_JSON_KEYS = [
  'ownerName',
  'ownerPhone',
  'ownerIdCard',
  'displayCode',
  'residentStatus',
  'unitCode',
  'unitAreaM2',
  'historyInterview',
  'hasSensitiveEquipment',
  'sensitiveEquipmentDesc',
  'interiorRenovationHistory',
  'beamSagging',
  'doorJammingStatus',
  'doorJamming',
  'upperFloorWaterLeakage',
  'isAbsentee',
  'absenteeInfo',
  'absenceDecision',
  'settlementObserved',
  'settlementNotes',
  'roomLayoutNotes',
  'ownerFeedback',
  'burlandSummary',
  'summaryConclusions',
  'engineeringRecommendations',
  'executiveSummary',
  'signatures',
  'cadZonePins',
  'cadElementPins',
  'photoRotations',
  'studioEnhancedPhotos',
  'studioEnhancedByOriginal',
] as const;

const HISTORY_UPDATE_KEYS = ['historyInterview', 'hasSensitiveEquipment', 'sensitiveEquipmentDesc', 'interiorRenovationHistory'];
const DEFORMATION_UPDATE_KEYS = [
  'doorJammingStatus',
  'doorJamming',
  'upperFloorWaterLeakage',
  'settlementObserved',
  'settlementNotes',
  'beamSagging',
];

function buildUnitDeformationNotes(json: Record<string, unknown>): string | null {
  const beam = isJsonRecord(json.beamSagging) ? json.beamSagging : {};
  const door = json.doorJammingStatus;
  const settlement = json.settlementObserved;
  const notes = [
    door && door !== 'NORMAL' ? `Cửa: ${String(door)}` : null,
    settlement ? `Lún: ${String(settlement)} (${String(json.settlementNotes || '')})` : null,
    beam.position || beam.location ? `Võng dầm: ${String(beam.position || beam.location)}` : null,
  ].filter(Boolean);
  return notes.length > 0 ? notes.join('; ') : null;
}

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

    mergeCondoEditableJson(mergedJson, updates, UNIT_EDITABLE_JSON_KEYS);

    // 1. Cô lập thực thể: Chỉ cập nhật bảng building_units của Căn hộ con (TUYỆT ĐỐI KHÔNG chạm vào parcels)
    if (unitId) {
      const ownerNameVal =
        typeof updates.ownerName === 'string' && updates.ownerName.trim() ? updates.ownerName.trim() : null;
      const ownerPhoneVal =
        typeof updates.ownerPhone === 'string' && updates.ownerPhone.trim() ? updates.ownerPhone.trim() : null;
      const ownerIdCardVal =
        typeof updates.ownerIdCard === 'string' && updates.ownerIdCard.trim() ? updates.ownerIdCard.trim() : null;
      const displayCodeVal =
        typeof updates.displayCode === 'string' && updates.displayCode.trim() ? updates.displayCode.trim() : null;
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

    if (unitId) {
      const nextCode = typeof updates.unitCode === 'string' ? updates.unitCode.trim() : '';
      if (nextCode && nextCode !== report.unit_code) {
        await renameCondoUnitCodeInTx(client, unitId, report.parcel_id, nextCode);
      }
      const nextFloor = toFiniteNumberOrNull(updates.floorNumber);
      if (nextFloor !== null && nextFloor !== toFiniteNumberOrNull(report.unit_floor_number)) {
        const label = String(mergedJson.displayCode || nextCode || report.display_code || report.unit_code || '');
        await moveCondoUnitFloorInTx(client, unitId, report.parcel_id, actualReportId, nextFloor, label, mergedJson, false);
      }
    }

    // Báo cáo in diện tích căn từ building_specifications của chính hồ sơ này
    if (updates.unitAreaM2 !== undefined) {
      await client.query(
        `UPDATE building_specifications SET construction_area_m2 = $1 WHERE report_id = $2;`,
        [toFiniteNumberOrNull(updates.unitAreaM2), actualReportId]
      );
    }

    // 2. Thấm dột dùng khóa form `upperFloorWaterLeakage`; gỡ khóa thẩm định cũ để bộ đọc không lấy lại bản cũ
    if (updates.upperFloorWaterLeakage !== undefined) {
      delete mergedJson.waterLeakageFromUpperFloor;
      delete mergedJson.waterLeakageNotes;
    }
    if (updates.unitFloorPlanSketchUrl !== undefined) {
      mergedJson.unitFloorPlanSketchUrl = updates.unitFloorPlanSketchUrl;
    }

    // 3. Báo cáo đọc độ võng qua settlementTilt.beamSagging (mô tả ở `description`) và thiết bị nhạy cảm trong historyInterview
    if (isJsonRecord(updates.beamSagging)) {
      const beam = mergedJson.beamSagging as Record<string, unknown>;
      mergedJson.settlementTilt = {
        ...(isJsonRecord(mergedJson.settlementTilt) ? mergedJson.settlementTilt : {}),
        beamSagging: { ...beam, description: beam.notes ?? beam.description ?? '' },
      };
    }
    if (updates.hasSensitiveEquipment !== undefined || updates.sensitiveEquipmentDesc !== undefined) {
      const interview = isJsonRecord(mergedJson.historyInterview) ? mergedJson.historyInterview : {};
      mergedJson.historyInterview = {
        ...interview,
        sensitiveEquipment: {
          ...(isJsonRecord(interview.sensitiveEquipment) ? interview.sensitiveEquipment : {}),
          has: Boolean(mergedJson.hasSensitiveEquipment),
          description: String(mergedJson.sensitiveEquipmentDesc || ''),
        },
      };
    }
    if (updates.isAbsentee !== undefined) {
      mergedJson.isAbsenteeSurvey = Boolean(updates.isAbsentee);
    }

    if (HISTORY_UPDATE_KEYS.some((key) => updates[key] !== undefined)) {
      await syncHistoryInterviewInTx(
        client,
        actualReportId,
        mergedJson,
        isJsonRecord(mergedJson.interiorRenovationHistory)
          ? String(mergedJson.interiorRenovationHistory.description || '')
          : undefined
      );
    }

    if (DEFORMATION_UPDATE_KEYS.some((key) => updates[key] !== undefined)) {
      const beam = isJsonRecord(updates.beamSagging) ? (mergedJson.beamSagging as Record<string, unknown>) : null;
      await syncUnitDeformationInTx(client, actualReportId, {
        notes: buildUnitDeformationNotes(mergedJson),
        details: {
          beamSagging: mergedJson.beamSagging ?? null,
          doorJammingStatus: mergedJson.doorJammingStatus ?? null,
          doorJamming: mergedJson.doorJamming ?? null,
          upperFloorWaterLeakage: mergedJson.upperFloorWaterLeakage ?? null,
          settlementObserved: mergedJson.settlementObserved ?? null,
          settlementNotes: mergedJson.settlementNotes ?? null,
        },
        beamDeflectionMm: beam ? toFiniteNumberOrNull(beam.sagMm) : undefined,
        e3Score: beam ? toFiniteNumberOrNull(beam.level) : null,
      });
    }

    // Biên bản PDF ưu tiên signatures.ownerFeedback, nên ý kiến chủ hộ phải có mặt ở cả hai khóa
    if (updates.ownerFeedback !== undefined) {
      mergedJson.signatures = {
        ...(isJsonRecord(mergedJson.signatures) ? mergedJson.signatures : {}),
        ownerFeedback: updates.ownerFeedback,
      };
    }

    // 4. Đồng bộ Dual-Write Vùng hư hại các phòng (Z) & Vết nứt (D)
    if (hasCondoZoneUpdates(updates)) {
      await assertCondoZonesNotWiped(client, actualReportId, updates);
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
    }

    applyCondoPinUpdatesToFloors(mergedJson, updates, `Tầng ${report.unit_floor_number ?? 1}`);

    // 5. Cập nhật base_survey_reports
    const sigs = (mergedJson.signatures || {}) as Record<string, unknown>;
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
    updates: Record<string, unknown>,
    _adminId: string
  ): Promise<void> {
    if (!hasCondoZoneUpdates(updates)) return;
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
    snapshot: NormalizedCondoSnapshot,
    _adminId: string,
    options: CondoRestoreOptions
  ): Promise<{ restoredSurveyJson: Record<string, unknown> }> {
    const actualReportId = report.report_id;
    const restoredJson: Record<string, unknown> = {
      ...snapshot.surveyJson,
      damageZones: snapshot.zones,
      structuralElements: snapshot.elements,
    };
    if (!options.restoreCadPosition) {
      keepCurrentCadPosition(restoredJson, options.currentJson);
    }

    // 1. Cô lập thực thể: CHỈ khôi phục building_units của Căn hộ con, TUYỆT ĐỐI KHÔNG chạm vào parcels!
    if (report.unit_id) {
      await restoreCondoBuildingUnitInTx(client, report.unit_id, report.parcel_id, snapshot, restoredJson, options);
    }

    // 2. Khôi phục Vùng hư hại Z, Cấu kiện E & Vết nứt D
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

    // 3. Khôi phục bảng con (hàng risk_score_cards trong bản chụp ghi đè e1 tính lại ở trên) và báo cáo
    await restoreCondoChildTablesInTx(client, actualReportId, snapshot, restoredJson, { includeSpecs: true });
    await restoreCondoReportFieldsInTx(client, actualReportId, snapshot, restoredJson);

    return { restoredSurveyJson: restoredJson };
  }
}
