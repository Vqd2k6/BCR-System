/**
 * ============================================================================
 * CONDO MASTER STRATEGY (BUILDING_MASTER / CONDO_MASTER)
 * Chiến lược Thẩm định, CRUD Dual-Write, Tính điểm (ECS/VI/Impact/BRA) & Rollback
 * dành riêng cho Hồ sơ Kỹ thuật Tòa Nhà Mẹ (5 Bước).
 * ============================================================================
 */

import type { PoolClient } from 'pg';
import { Database } from '../../../../database/db';
import { BadRequestError } from '../../../../common/errors/problem-details';
import type { CondoPhotoActionItem, CondoReportContextRow } from '../condo-audit.types';
import { resolvePolygonGeometryUpdate } from '../../services/audit-geometry-sync.helpers';
import {
  isJsonRecord,
  syncHistoryInterviewInTx,
  syncSurveyScopeInTx,
  toFiniteNumberOrNull,
} from '../../services/audit-sql-sync.helpers';
import {
  type NormalizedCondoSnapshot,
  restoreCondoChildTablesInTx,
  restoreCondoReportFieldsInTx,
} from '../services/condo-snapshot-restore.helpers';
import {
  assertCondoZonesNotWiped,
  type CondoRestoreOptions,
  hasCondoZoneUpdates,
  type ICondoEntityAuditStrategy,
  mergeCondoEditableJson,
  normalizeFoundationCategory,
  normalizeStructuralSystem,
  syncCondoZonesElementsAndDefectsInTx,
} from './condo-entity-strategy.interface';

function parseMetersNumber(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const cleaned = String(val).replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Lựa chọn của Bước 06 đổi sang đúng nhãn mutation_type_enum
const MUTATION_TYPE_BY_GIS_OPTION: Record<string, string> = {
  NONE: 'ORIGINAL',
  BOUNDARY_ADJUST: 'REDRAW',
  MERGE: 'MERGE',
};
const ECS_INPUT_KEYS = ['floors', 'damageZones', 'burlandSummary', 'settlementTilt', 'deformation', 'historyInterview'];
const VI_INPUT_KEYS = ['usageFunction', 'objectGroup', 'structureSystem', 'foundationCatScore', 'constructionYear'];

type ViClass = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
const BRA_MATRIX: Record<ViClass, Record<1 | 2 | 3 | 4, ViClass>> = {
  LOW: { 1: 'LOW', 2: 'LOW', 3: 'MEDIUM', 4: 'HIGH' },
  MEDIUM: { 1: 'LOW', 2: 'MEDIUM', 3: 'HIGH', 4: 'HIGH' },
  HIGH: { 1: 'MEDIUM', 2: 'HIGH', 3: 'HIGH', 4: 'VERY_HIGH' },
  VERY_HIGH: { 1: 'HIGH', 2: 'HIGH', 3: 'VERY_HIGH', 4: 'VERY_HIGH' },
};

const MASTER_EDITABLE_JSON_KEYS = [
  'buildingName',
  'officialCadastralCode',
  'houseNumber',
  'street',
  'ward',
  'district',
  'standardizedAddress',
  'managementBoardName',
  'managementContactName',
  'managementContactPhone',
  'accessLimitation',
  'adjacentBuildings',
  'aboveFloors',
  'undergroundFloors',
  'podiumFloors',
  'totalUnits',
  'constructionYear',
  'isEstimatedYear',
  'constructionAreaM2',
  'landAreaM2',
  'buildingHeightM',
  'objectGroup',
  'usageFunction',
  'structureSystem',
  'foundationType',
  'foundationCatScore',
  'foundationDepthM',
  'foundationSpacingM',
  'foundationDensity',
  'foundationNotes',
  'pileDimensionMm',
  'historyInterview',
  'settlementTilt',
  'surveyScope',
  'gisMutationConfirmed',
  'metroOffsetDistance',
  'clearanceOffsetDistance',
  'parcelCoordinates',
  'polygonCoords',
  'gpsCoords',
  'keepKsvBoundaryConfirmed',
  'keepKsvBoundaryReason',
  'ecs',
  'vi',
  'executiveSummary',
  'summaryConclusions',
  'engineeringRecommendations',
  'signatures',
  'studioEnhancedPhotos',
  'studioEnhancedByOriginal',
] as const;

export class CondoMasterAuditStrategy implements ICondoEntityAuditStrategy {
  readonly entityKind = 'BUILDING_MASTER' as const;

  async validateBeforeModify(
    report: CondoReportContextRow,
    updates: Record<string, unknown>,
    photoActions: CondoPhotoActionItem[]
  ): Promise<void> {
    const existingJson = report.survey_data_json || {};
    const specs = (updates.buildingSpecs as Record<string, unknown> | undefined) || {};
    const targetCatScore =
      updates.foundationCatScore ??
      specs.foundationCatScore ??
      specs.foundation_cat_score ??
      existingJson.foundationCatScore;

    const catNum = Number(targetCatScore);
    if (catNum === 1 || catNum === 2) {
      const existingAsBuilt = Array.isArray(updates.asBuiltDrawingPhotos)
        ? updates.asBuiltDrawingPhotos
        : Array.isArray(existingJson.asBuiltDrawingPhotos)
          ? existingJson.asBuiltDrawingPhotos
          : existingJson.asBuiltDrawingPhotoUrl
            ? [{ url: existingJson.asBuiltDrawingPhotoUrl }]
            : [];
      const activeExisting = (existingAsBuilt as Array<Record<string, unknown> | string>).filter((item) => {
        if (typeof item === 'string') return Boolean(item.trim());
        return !item?.isDeleted && !item?.is_deleted && Boolean(item?.url || item?.photoUrl);
      });

      const addedCount = photoActions.filter(
        (pa) => (pa.category === 'AS_BUILT' || pa.targetPhotoType === 'AS_BUILT_DRAWING') && pa.action !== 'DELETE'
      ).length;
      const deletedCount = photoActions.filter(
        (pa) => (pa.category === 'AS_BUILT' || pa.targetPhotoType === 'AS_BUILT_DRAWING') && pa.action === 'DELETE'
      ).length;

      if (activeExisting.length + addedCount - deletedCount <= 0) {
        throw new BadRequestError(
          'Hồ sơ Tòa Nhà Mẹ phân loại móng CAT 1 / CAT 2 bắt buộc phải đính kèm ít nhất 1 ảnh Bản vẽ hoàn công!'
        );
      }
    }
  }

  async applyCrudInTransaction(
    client: PoolClient,
    report: CondoReportContextRow,
    mergedJson: Record<string, unknown>,
    updates: Record<string, unknown>,
    _adminId: string
  ): Promise<void> {
    const actualReportId = report.report_id;
    const parcelId = report.parcel_id;

    const existingJson = { ...mergedJson };
    mergeCondoEditableJson(mergedJson, updates, MASTER_EDITABLE_JSON_KEYS);

    // Báo cáo đọc khóa chủ sở hữu và `pileDimension` trước, nên giá trị mới phải có mặt ở cả các khóa đó
    if (updates.managementContactName !== undefined) mergedJson.ownerName = updates.managementContactName;
    if (updates.managementContactPhone !== undefined) mergedJson.ownerPhone = updates.managementContactPhone;
    if (updates.pileDimensionMm !== undefined) mergedJson.pileDimension = updates.pileDimensionMm;

    // 1. Đồng bộ bảng parcels (Thông tin Tòa Nhà Mẹ, quy mô tầng, diện tích, cự ly Metro, đa giác PostGIS)
    const geometry = resolvePolygonGeometryUpdate(updates, existingJson, mergedJson);
    const newCadGeoJson = geometry.newCadastralGeoJsonStr;

    if (newCadGeoJson) {
      const validRes = await client.query<{ is_valid: boolean; reason: string }>(
        `SELECT ST_IsValid(g) AS is_valid, ST_IsValidReason(g) AS reason
         FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS g) AS candidate;`,
        [newCadGeoJson]
      );
      if (!validRes.rows[0]?.is_valid) {
        throw new BadRequestError(`Đa giác ranh thửa không hợp lệ: ${validRes.rows[0]?.reason || 'không xác định'}.`);
      }
    }

    // Chỉ đổi điểm định vị khi Admin đổi ranh hoặc GPS, tránh ghi lại tọa độ cũ ở mọi lần lưu
    const gpsCoords = isJsonRecord(mergedJson.gpsCoords) ? mergedJson.gpsCoords : null;
    const shouldMoveLocation = Boolean(newCadGeoJson) || updates.gpsCoords !== undefined;
    const locationLat = shouldMoveLocation ? toFiniteNumberOrNull(gpsCoords?.lat ?? gpsCoords?.latitude) : null;
    const locationLng = shouldMoveLocation ? toFiniteNumberOrNull(gpsCoords?.lng ?? gpsCoords?.longitude) : null;

    const metroDistM =
      geometry.recalculatedCenterlineM ??
      parseMetersNumber(updates.metroOffsetDistance ?? updates.manualMetroDistanceM ?? mergedJson.metroOffsetDistance);

    const ownerOrBqlName =
      typeof updates.managementContactName === 'string' && updates.managementContactName.trim()
        ? updates.managementContactName.trim()
        : typeof updates.ownerName === 'string' && updates.ownerName.trim()
          ? updates.ownerName.trim()
          : null;
    const ownerOrBqlPhone =
      typeof updates.managementContactPhone === 'string' && updates.managementContactPhone.trim()
        ? updates.managementContactPhone.trim()
        : typeof updates.ownerPhone === 'string' && updates.ownerPhone.trim()
          ? updates.ownerPhone.trim()
          : null;

    await client.query(
      `UPDATE parcels SET
         house_number = COALESCE($1, house_number),
         street = COALESCE($2, street),
         ward = COALESCE($3, ward),
         district = COALESCE($4, district),
         owner_name = COALESCE($5, owner_name),
         owner_phone = COALESCE($6, owner_phone),
         official_cadastral_code = COALESCE($7, official_cadastral_code),
         land_area_m2 = COALESCE($8, land_area_m2),
         construction_area_m2 = COALESCE($9, construction_area_m2),
         floor_count = COALESCE($10, floor_count),
         total_units = COALESCE($11, total_units),
         distance_to_centerline_m = COALESCE($12, distance_to_centerline_m),
         cadastral_polygon_geom = CASE
           WHEN $13::text IS NOT NULL THEN ST_SetSRID(ST_GeomFromGeoJSON($13), 4326)
           ELSE cadastral_polygon_geom
         END,
         location_geom = CASE
           WHEN $16::float IS NOT NULL AND $17::float IS NOT NULL THEN ST_SetSRID(ST_Point($17::float, $16::float), 4326)
           WHEN $13::text IS NOT NULL THEN ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON($13), 4326))
           ELSE location_geom
         END,
         mutation_type = COALESCE($15::mutation_type_enum, mutation_type),
         updated_at = NOW()
       WHERE id = $14;`,
      [
        typeof updates.houseNumber === 'string' && updates.houseNumber.trim() ? updates.houseNumber.trim() : null,
        typeof updates.street === 'string' && updates.street.trim() ? updates.street.trim() : null,
        typeof updates.ward === 'string' && updates.ward.trim() ? updates.ward.trim() : null,
        typeof updates.district === 'string' && updates.district.trim() ? updates.district.trim() : null,
        ownerOrBqlName,
        ownerOrBqlPhone,
        typeof updates.officialCadastralCode === 'string' && updates.officialCadastralCode.trim()
          ? updates.officialCadastralCode.trim()
          : null,
        updates.landAreaM2 !== undefined && updates.landAreaM2 !== '' ? Number(updates.landAreaM2) : null,
        updates.constructionAreaM2 !== undefined && updates.constructionAreaM2 !== ''
          ? Number(updates.constructionAreaM2)
          : null,
        updates.aboveFloors !== undefined && updates.aboveFloors !== '' ? Number(updates.aboveFloors) : null,
        updates.totalUnits !== undefined && updates.totalUnits !== '' ? Number(updates.totalUnits) : null,
        metroDistM,
        newCadGeoJson,
        parcelId,
        isJsonRecord(updates.gisMutationConfirmed)
          ? (MUTATION_TYPE_BY_GIS_OPTION[String(updates.gisMutationConfirmed.type)] ?? null)
          : null,
        locationLat,
        locationLng,
      ]
    );

    // 2. Đồng bộ building_specifications
    const structSys =
      typeof updates.structureSystem === 'string' && updates.structureSystem.trim()
        ? normalizeStructuralSystem(updates.structureSystem)
        : null;
    const foundCat =
      typeof updates.foundationType === 'string' && updates.foundationType.trim()
        ? normalizeFoundationCategory(updates.foundationType)
        : updates.foundationCatScore !== undefined
          ? normalizeFoundationCategory(`CAT_${updates.foundationCatScore}`)
          : null;
    const rawGrade = String(updates.objectGroup || '').toUpperCase();
    const bGrade = ['GENERAL', 'IMPORTANT', 'CRITICAL'].includes(rawGrade) ? rawGrade : null;
    const hasManagementUpdate = ['managementBoardName', 'managementContactName', 'managementContactPhone'].some(
      (key) => updates[key] !== undefined
    );

    await client.query(
      `INSERT INTO building_specifications (
         report_id, building_name, building_grade, structural_system,
         floor_count, basement_count, foundation_category, year_of_construction,
         is_year_estimated, construction_area_m2, building_height_m,
         foundation_depth_m, foundation_density, foundation_spacing_m, foundation_notes,
         land_use_function, adjacent_buildings, foundation_cat_score, pile_dimensions_text, management_contact_json
       ) VALUES (
         $1, $2, COALESCE($3::building_grade_enum, 'IMPORTANT'::building_grade_enum), COALESCE($4::structural_system_enum, 'KHUNG_BTCT_CHIU_LUC'::structural_system_enum),
         COALESCE($5, 10), COALESCE($6, 1), COALESCE($7::foundation_category_enum, 'CAT_4_MONG_COC_BTCT'::foundation_category_enum), $8,
         COALESCE($9, false), $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb
       )
       ON CONFLICT (report_id) DO UPDATE SET
         building_name = COALESCE($2, building_specifications.building_name),
         building_grade = COALESCE($3::building_grade_enum, building_specifications.building_grade),
         structural_system = COALESCE($4::structural_system_enum, building_specifications.structural_system),
         floor_count = COALESCE($5, building_specifications.floor_count),
         basement_count = COALESCE($6, building_specifications.basement_count),
         foundation_category = COALESCE($7::foundation_category_enum, building_specifications.foundation_category),
         year_of_construction = COALESCE($8, building_specifications.year_of_construction),
         is_year_estimated = COALESCE($9, building_specifications.is_year_estimated),
         construction_area_m2 = COALESCE($10, building_specifications.construction_area_m2),
         building_height_m = COALESCE($11, building_specifications.building_height_m),
         foundation_depth_m = COALESCE($12, building_specifications.foundation_depth_m),
         foundation_density = COALESCE($13, building_specifications.foundation_density),
         foundation_spacing_m = COALESCE($14, building_specifications.foundation_spacing_m),
         foundation_notes = COALESCE($15, building_specifications.foundation_notes),
         land_use_function = COALESCE($16, building_specifications.land_use_function),
         adjacent_buildings = COALESCE($17, building_specifications.adjacent_buildings),
         foundation_cat_score = COALESCE($18, building_specifications.foundation_cat_score),
         pile_dimensions_text = COALESCE($19, building_specifications.pile_dimensions_text),
         management_contact_json = COALESCE($20::jsonb, building_specifications.management_contact_json);`,
      [
        actualReportId,
        typeof updates.buildingName === 'string' ? updates.buildingName : (mergedJson.buildingName as string) || null,
        bGrade,
        structSys,
        updates.aboveFloors !== undefined && updates.aboveFloors !== '' && Number.isFinite(Number(updates.aboveFloors))
          ? Math.round(Number(updates.aboveFloors))
          : null,
        updates.undergroundFloors !== undefined && updates.undergroundFloors !== '' && Number.isFinite(Number(updates.undergroundFloors))
          ? Math.round(Number(updates.undergroundFloors))
          : null,
        foundCat,
        updates.constructionYear !== undefined && updates.constructionYear !== '' && Number.isFinite(Number(updates.constructionYear))
          ? Math.round(Number(updates.constructionYear))
          : null,
        updates.isEstimatedYear !== undefined ? Boolean(updates.isEstimatedYear) : null,
        updates.constructionAreaM2 !== undefined && updates.constructionAreaM2 !== '' && Number.isFinite(Number(updates.constructionAreaM2))
          ? Number(updates.constructionAreaM2)
          : null,
        updates.buildingHeightM !== undefined && updates.buildingHeightM !== '' && Number.isFinite(Number(updates.buildingHeightM))
          ? Number(updates.buildingHeightM)
          : null,
        updates.foundationDepthM !== undefined && updates.foundationDepthM !== '' && Number.isFinite(Number(updates.foundationDepthM))
          ? Number(updates.foundationDepthM)
          : null,
        updates.foundationDensity !== undefined && updates.foundationDensity !== '' && Number.isFinite(Number(updates.foundationDensity))
          ? Number(updates.foundationDensity)
          : null,
        updates.foundationSpacingM !== undefined && updates.foundationSpacingM !== '' && Number.isFinite(Number(updates.foundationSpacingM))
          ? Number(updates.foundationSpacingM)
          : null,
        typeof updates.foundationNotes === 'string' ? updates.foundationNotes : null,
        typeof updates.usageFunction === 'string' ? updates.usageFunction : null,
        updates.adjacentBuildings !== undefined
          ? typeof updates.adjacentBuildings === 'string'
            ? updates.adjacentBuildings
            : JSON.stringify(updates.adjacentBuildings)
          : null,
        toFiniteNumberOrNull(updates.foundationCatScore),
        updates.pileDimensionMm !== undefined && updates.pileDimensionMm !== null ? String(updates.pileDimensionMm) : null,
        hasManagementUpdate
          ? JSON.stringify({
              boardName: mergedJson.managementBoardName ?? null,
              contactName: mergedJson.managementContactName ?? null,
              contactPhone: mergedJson.managementContactPhone ?? null,
            })
          : null,
      ]
    );

    // 3. Đồng bộ deformation_assessments nếu có sửa settlementTilt
    const st = (updates.settlementTilt || mergedJson.settlementTilt) as Record<string, unknown> | undefined;
    if (st) {
      const tilt = (st.buildingTilt || {}) as Record<string, unknown>;
      const diff = (st.diffSettlement || {}) as Record<string, unknown>;
      const beam = (st.beamSagging || {}) as Record<string, unknown>;
      const abn = (st.abnormalCase || {}) as Record<string, unknown>;
      const e3Score = Math.min(4, Math.max(Number(diff.level) || 0, Number(tilt.level) || 0, Number(beam.level) || 0));

      const tiltX = tilt.xPermille !== undefined && tilt.xPermille !== '' ? Number(tilt.xPermille) : null;
      const tiltY = tilt.yPermille !== undefined && tilt.yPermille !== '' ? Number(tilt.yPermille) : null;
      const beamSag = beam.sagMm !== undefined && beam.sagMm !== '' ? Number(beam.sagMm) : null;

      await client.query(
        `INSERT INTO deformation_assessments (
           report_id, tilt_angle_x, tilt_angle_y, tilt_direction, beam_deflection_mm,
           measurement_reliability, e3_deformation_score,
           diff_settlement_photos_json, tilt_photos_json, abnormal_photos_json
         ) VALUES (
           $1, COALESCE($2::numeric, 0), COALESCE($3::numeric, 0), $4, COALESCE($5::numeric, 0), 'HIGH'::reliability_enum, $6,
           COALESCE($7::jsonb, '[]'::jsonb), COALESCE($8::jsonb, '[]'::jsonb), COALESCE($9::jsonb, '[]'::jsonb)
         )
         ON CONFLICT (report_id) DO UPDATE SET
           tilt_angle_x = COALESCE($2::numeric, deformation_assessments.tilt_angle_x, 0),
           tilt_angle_y = COALESCE($3::numeric, deformation_assessments.tilt_angle_y, 0),
           tilt_direction = COALESCE($4, deformation_assessments.tilt_direction),
           beam_deflection_mm = COALESCE($5::numeric, deformation_assessments.beam_deflection_mm, 0),
           e3_deformation_score = $6,
           diff_settlement_photos_json = COALESCE($7::jsonb, deformation_assessments.diff_settlement_photos_json),
           tilt_photos_json = COALESCE($8::jsonb, deformation_assessments.tilt_photos_json),
           abnormal_photos_json = COALESCE($9::jsonb, deformation_assessments.abnormal_photos_json);`,
        [
          actualReportId,
          Number.isFinite(tiltX) ? tiltX : null,
          Number.isFinite(tiltY) ? tiltY : null,
          tilt.direction ? String(tilt.direction) : null,
          Number.isFinite(beamSag) ? beamSag : null,
          e3Score,
          Array.isArray(diff.photos) ? JSON.stringify(diff.photos) : null,
          Array.isArray(tilt.photos) ? JSON.stringify(tilt.photos) : null,
          Array.isArray(abn.photos) ? JSON.stringify(abn.photos) : null,
        ]
      );
    }

    if (updates.historyInterview !== undefined) {
      await syncHistoryInterviewInTx(client, actualReportId, mergedJson);
    }
    if (updates.accessLimitation !== undefined || updates.surveyScope !== undefined) {
      await syncSurveyScopeInTx(client, actualReportId, mergedJson);
    }

    // 4. Đồng bộ damageZones / structuralElements nếu có ở cấp Tòa Mẹ
    if (hasCondoZoneUpdates(updates)) {
      await assertCondoZonesNotWiped(client, actualReportId, updates);
      await syncCondoZonesElementsAndDefectsInTx(client, actualReportId, 'Khối đế / Tổng thể', mergedJson, updates);
    }

    // 5. Cập nhật metadata base_survey_reports
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
    updates: Record<string, unknown>,
    _adminId: string
  ): Promise<void> {
    const actualReportId = report.report_id;
    try {
      const { ScoringService } = await import('../../../scoring/scoring.service');
      const calcRes = await ScoringService.calculatePhase1Scores(actualReportId);
      const calcScores = calcRes?.scores;

      const uEcs = (updates.ecs as Record<string, unknown> | undefined) || null;
      const uVi = (updates.vi as Record<string, unknown> | undefined) || null;
      const curEcs = (mergedJson.ecs as Record<string, unknown> | undefined) || {};
      const curVi = (mergedJson.vi as Record<string, unknown> | undefined) || {};

      // Admin sửa điểm thì giữ điểm đó; đổi dữ liệu đầu vào thì tính lại, không giữ điểm cũ đã lỗi thời
      const hasEcsInputUpdate = curEcs.e1 === undefined || ECS_INPUT_KEYS.some((key) => updates[key] !== undefined);
      const hasViInputUpdate =
        hasEcsInputUpdate || curVi.v1 === undefined || VI_INPUT_KEYS.some((key) => updates[key] !== undefined);
      const ecsScore = (edited: unknown, current: unknown, calculated: number | null | undefined) =>
        Number(edited ?? (hasEcsInputUpdate ? (calculated ?? current) : (current ?? calculated)) ?? 0);
      const viScore = (edited: unknown, current: unknown, calculated: number | null | undefined, fallback: number) =>
        Number(edited ?? (hasViInputUpdate ? (calculated ?? current) : (current ?? calculated)) ?? fallback);

      const e1 = ecsScore(uEcs?.e1, curEcs.e1, calcScores?.e1Burland);
      const e2 = ecsScore(uEcs?.e2, curEcs.e2, calcScores?.e2Structure);
      const e3 = ecsScore(uEcs?.e3, curEcs.e3, calcScores?.e3Deformation);
      const e4 = ecsScore(uEcs?.e4, curEcs.e4, calcScores?.e4Material);
      const e5 = ecsScore(uEcs?.e5, curEcs.e5, calcScores?.e5History);
      const e6 = ecsScore(uEcs?.e6, curEcs.e6, calcScores?.e6Function);
      const totalEcs = e1 + e2 + e3 + e4 + e5 + e6;
      const ecsClass: 'GOOD' | 'MEDIUM' | 'DEFICIENT' | 'CRITICAL' =
        totalEcs <= 5 ? 'GOOD' : totalEcs <= 10 ? 'MEDIUM' : totalEcs <= 16 ? 'DEFICIENT' : 'CRITICAL';

      const v1 = Math.round(viScore(uVi?.v1, curVi.v1, calcScores?.v1, 3));
      const v2 = Math.round(viScore(uVi?.v2, curVi.v2, calcScores?.v2, 2));
      const v3 = Math.round(viScore(uVi?.v3, curVi.v3, calcScores?.v3, 2));
      const v4 = Math.round(viScore(uVi?.v4, curVi.v4, calcScores?.v4, 2));
      const v5 = Math.round(
        Number(uVi?.v5 ?? (ecsClass === 'CRITICAL' ? 4 : ecsClass === 'DEFICIENT' ? 3 : ecsClass === 'MEDIUM' ? 2 : 1))
      );
      const v6 = Math.round(viScore(uVi?.v6, curVi.v6, calcScores?.v6, 2));
      const totalVi = v1 + v2 + v3 + v4 + v5 + v6;
      const avgVi = Number((totalVi / 6).toFixed(2));
      const viClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' =
        avgVi > 3.25 ? 'VERY_HIGH' : avgVi > 2.5 ? 'HIGH' : avgVi > 1.5 ? 'MEDIUM' : 'LOW';

      const curExec = (mergedJson.executiveSummary as Record<string, unknown> | undefined) || {};

      // Impact tự tính theo nhóm công trình + cự ly Metro; thiếu cự ly thì giữ nguyên, không tự đặt số giả
      const distanceM =
        parseMetersNumber(mergedJson.clearanceOffsetDistance) ?? parseMetersNumber(mergedJson.metroOffsetDistance);
      const isHighImportance = ['IMPORTANT', 'CRITICAL'].includes(String(mergedJson.objectGroup || '').toUpperCase());
      const autoImpact: 1 | 2 | 3 | 4 | null =
        distanceM === null
          ? null
          : isHighImportance
            ? distanceM > 30 ? 1 : distanceM > 20 ? 2 : distanceM > 10 ? 3 : 4
            : distanceM > 20 ? 1 : distanceM > 10 ? 2 : distanceM > 5 ? 3 : 4;
      const execImpactMatch = String(curExec.constructionImpactStatus || '').toUpperCase().match(/\bI([1-4])\b/);
      const explicitImpact =
        curExec.isImpactOverridden === true && execImpactMatch ? (Number(execImpactMatch[1]) as 1 | 2 | 3 | 4) : null;
      const finalImpact = explicitImpact ?? autoImpact ?? (execImpactMatch ? (Number(execImpactMatch[1]) as 1 | 2 | 3 | 4) : null);

      const isBraOverridden = curExec.isBraOverridden === true;
      const braStatus = String(
        isBraOverridden ? curExec.braStatus : finalImpact ? BRA_MATRIX[viClass][finalImpact] : curExec.braStatus || 'LOW'
      );

      await Database.query(
        `UPDATE risk_score_cards SET
           e1_burland_score = $2, e2_structure_score = $3, e3_deformation_score = $4,
           e4_material_score = $5, e5_history_score = $6, e6_overall_function_score = $7,
           total_ecs_score = $8, ecs_class = $9,
           v1_importance_score = $10, v2_structure_score = $11, v3_foundation_score = $12,
           v4_age_score = $13, v5_ecs_score = $14, v6_sensitivity_score = $15,
           avg_vi_score = $16, vi_class = $17,
           building_risk_assessment_bra = $18,
           construction_impact_level_i = COALESCE($19, construction_impact_level_i),
           overridden_impact_level_i = $20,
           overridden_bra = $21
         WHERE report_id = $1;`,
        [
          actualReportId,
          e1, e2, e3, e4, e5, e6,
          totalEcs, ecsClass,
          v1, v2, v3, v4, v5, v6,
          avgVi, viClass,
          braStatus,
          autoImpact,
          explicitImpact,
          isBraOverridden ? braStatus : null,
        ]
      );

      mergedJson.ecs = { ...curEcs, e1, e2, e3, e4, e5, e6, totalEcs, ecsClass };
      mergedJson.vi = { ...curVi, v1, v2, v3, v4, v5, v6, totalVi, avgVi, viAvg: avgVi, viClass };
      mergedJson.executiveSummary = {
        ...curExec,
        braStatus,
        ...(finalImpact ? { constructionImpactStatus: `I${finalImpact}` } : {}),
      };
      await Database.query(`UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`, [
        JSON.stringify(mergedJson),
        actualReportId,
      ]);
    } catch (err) {
      console.error('[CondoMasterAuditStrategy.recomputeDerivedScoresAfterCrud] Lỗi tính điểm Tòa Mẹ:', err);
    }
  }

  async restoreSnapshotInTransaction(
    client: PoolClient,
    report: CondoReportContextRow,
    snapshot: NormalizedCondoSnapshot,
    _adminId: string,
    _options: CondoRestoreOptions
  ): Promise<{ restoredSurveyJson: Record<string, unknown> }> {
    const actualReportId = report.report_id;
    const { raw, leftPane } = snapshot;
    const parcelInfo = [raw.frozenParcel, raw.parcel, leftPane.parcel].find(isJsonRecord) || {};
    const restoredJson: Record<string, unknown> = { ...snapshot.surveyJson };

    const pick = (...candidates: unknown[]) => candidates.find((val) => val !== undefined) ?? null;
    const geoJsonText = (val: unknown) => (val ? (typeof val === 'string' ? val : JSON.stringify(val)) : null);

    // 1. Khôi phục bảng parcels của Tòa Nhà Mẹ; cột cho phép rỗng lấy đúng giá trị trong bản chụp
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
         total_units = COALESCE($13, total_units),
         distance_to_centerline_m = COALESCE($14, distance_to_centerline_m),
         location_geom = CASE WHEN $15::text IS NOT NULL THEN ST_SetSRID(ST_GeomFromGeoJSON($15::text), 4326) ELSE location_geom END,
         cadastral_polygon_geom = CASE WHEN $16::text IS NOT NULL THEN ST_SetSRID(ST_GeomFromGeoJSON($16::text), 4326) ELSE cadastral_polygon_geom END,
         survey_status = 'SUBMITTED',
         updated_at = NOW()
       WHERE id = $17;`,
      [
        pick(parcelInfo.houseNumber, parcelInfo.house_number, restoredJson.houseNumber),
        pick(parcelInfo.street, restoredJson.street),
        pick(parcelInfo.ward, restoredJson.ward),
        pick(parcelInfo.district, restoredJson.district),
        pick(parcelInfo.ownerName, parcelInfo.owner_name, restoredJson.managementContactName, restoredJson.ownerName),
        pick(parcelInfo.ownerPhone, parcelInfo.owner_phone, restoredJson.managementContactPhone, restoredJson.ownerPhone),
        pick(parcelInfo.officialCadastralCode, parcelInfo.official_cadastral_code, restoredJson.officialCadastralCode),
        toFiniteNumberOrNull(pick(parcelInfo.frontageWidth, parcelInfo.frontage_width, restoredJson.frontageWidth)),
        toFiniteNumberOrNull(pick(parcelInfo.lotDepth, parcelInfo.lot_depth, restoredJson.lotDepth)),
        toFiniteNumberOrNull(pick(parcelInfo.landAreaM2, parcelInfo.land_area_m2, restoredJson.landAreaM2)),
        toFiniteNumberOrNull(pick(parcelInfo.constructionAreaM2, parcelInfo.construction_area_m2, restoredJson.constructionAreaM2)),
        toFiniteNumberOrNull(pick(parcelInfo.floorCount, parcelInfo.floor_count, restoredJson.aboveFloors)),
        toFiniteNumberOrNull(restoredJson.totalUnits),
        toFiniteNumberOrNull(pick(raw.distanceToCenterlineM, raw.distance_to_centerline_m)) ??
          parseMetersNumber(restoredJson.metroOffsetDistance),
        geoJsonText(raw.locationGeojson),
        geoJsonText(raw.cadastralGeojson ?? raw.cadastral_geojson),
        report.parcel_id,
      ]
    );

    // 2. Khôi phục vùng hư hại / cấu kiện: JSON Tòa Mẹ dùng floors[], chỉ dùng dạng phẳng khi không có floors
    const floors = Array.isArray(restoredJson.floors) ? restoredJson.floors : [];
    if (floors.length === 0) {
      restoredJson.damageZones = snapshot.zones;
      restoredJson.structuralElements = snapshot.elements;
    }
    await syncCondoZonesElementsAndDefectsInTx(client, actualReportId, 'Khối đế', restoredJson, restoredJson);

    // 3. Khôi phục bảng con và báo cáo
    await restoreCondoChildTablesInTx(client, actualReportId, snapshot, restoredJson, { includeSpecs: true });
    await restoreCondoReportFieldsInTx(client, actualReportId, snapshot, restoredJson);

    return { restoredSurveyJson: restoredJson };
  }
}
