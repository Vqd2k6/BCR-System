/**
 * ============================================================================
 * CONDO ENTITY STRATEGY INTERFACE & SHARED RELATIONAL RECONCILER
 * Hợp đồng chiến lược chuẩn cho 3 thực thể Chung cư (BUILDING_MASTER, MASTER_AREA, CONDO_UNIT)
 * và bộ đồng bộ Dual-Write (SQL + JSONB) hỗ trợ cả cấu trúc phẳng lẫn cấu trúc tầng.
 * ============================================================================
 */

import type { PoolClient } from 'pg';
import { Database } from '../../../../database/db';
import { normalizeComponentType, normalizeFoundationCategory, normalizeStructuralSystem } from '../../../survey/survey.dto';
import type {
  CondoEntityKind,
  CondoParentMasterSummary,
  CondoPhotoActionItem,
  CondoReportContextRow,
} from '../condo-audit.types';

export interface ICondoEntityAuditStrategy {
  readonly entityKind: CondoEntityKind;

  /** 1. Kiểm tra điều kiện hợp lệ trước khi lưu chỉnh sửa (Gatekeepers) */
  validateBeforeModify(
    report: CondoReportContextRow,
    updates: Record<string, unknown>,
    photoActions: CondoPhotoActionItem[]
  ): Promise<void>;

  /** 2. Thực thi CRUD Dual-Write (JSONB + Bảng SQL) trong Transaction */
  applyCrudInTransaction(
    client: PoolClient,
    report: CondoReportContextRow,
    mergedJson: Record<string, unknown>,
    updates: Record<string, unknown>,
    adminId: string
  ): Promise<void>;

  /** 3. Tính lại điểm số dẫn xuất (Burland / ECS / VI / Impact / BRA) sau khi commit CRUD */
  recomputeDerivedScoresAfterCrud(
    report: CondoReportContextRow,
    mergedJson: Record<string, unknown>,
    updates: Record<string, unknown>,
    adminId: string
  ): Promise<void>;

  /** 4. Khôi phục nguyên trạng từ Snapshot v(k) trong Transaction (Time-Travel Rollback) */
  restoreSnapshotInTransaction(
    client: PoolClient,
    report: CondoReportContextRow,
    snapshotData: Record<string, unknown>,
    adminId: string
  ): Promise<{ restoredSurveyJson: Record<string, unknown> }>;
}

/**
 * Tính cấp độ Burland (0..5) từ bề rộng vết nứt (mm)
 */
export function calcBurlandGradeFromWidth(widthMm: number): number {
  if (widthMm <= 0.1) return 0;
  if (widthMm <= 1) return 1;
  if (widthMm <= 5) return 2;
  if (widthMm <= 15) return 3;
  if (widthMm <= 25) return 4;
  return 5;
}

export function isCrackDefectItem(category?: unknown, defectType?: unknown): boolean {
  const catStr = String(category || '').toLowerCase();
  const typeStr = String(defectType || '').toLowerCase();
  const full = `${catStr} ${typeStr}`;
  if (
    full.includes('thấm dột') ||
    full.includes('ẩm mốc') ||
    full.includes('kẹt cửa') ||
    full.includes('cong vênh') ||
    full.includes('bong rộp') ||
    full.includes('bong tróc') ||
    full.includes('rỉ sét') ||
    full.includes('water_leak') ||
    full.includes('seepage')
  ) {
    return typeStr.includes('nứt') || typeStr.includes('crack');
  }
  return full.includes('nứt') || full.includes('crack') || !full.trim();
}

/**
 * Truy vấn tóm tắt Hồ sơ Kỹ thuật Tòa Nhà Mẹ (BUILDING_MASTER) để làm dữ liệu kế thừa
 * cho Căn hộ con (CONDO_UNIT) và Khu vực dùng chung (MASTER_AREA)
 */
export async function fetchParentMasterSummary(parcelId: string): Promise<CondoParentMasterSummary> {
  const parcelRes = await Database.query<{
    id: string;
    project_parcel_code: string;
    house_number: string | null;
    street: string | null;
    ward: string | null;
    district: string | null;
    floor_count: number | null;
    distance_to_centerline_m: number | null;
  }>(
    `SELECT id, project_parcel_code, house_number, street, ward, district, floor_count, distance_to_centerline_m
     FROM parcels
     WHERE id = $1 LIMIT 1;`,
    [parcelId]
  );
  const p = parcelRes.rows[0];

  const masterRes = await Database.query<{
    id: string;
    status: string;
    survey_data_json: Record<string, unknown> | string | null;
  }>(
    `SELECT id, status::text AS status, survey_data_json
     FROM base_survey_reports
     WHERE parcel_id = $1
       AND deleted_at IS NULL
       AND (unit_id IS NULL OR report_type IN ('BUILDING_MASTER', 'CONDO_MASTER'))
     ORDER BY created_at DESC
     LIMIT 1;`,
    [parcelId]
  );

  const mRow = masterRes.rows[0];
  let mJson: Record<string, unknown> = {};
  if (mRow?.survey_data_json) {
    try {
      mJson =
        typeof mRow.survey_data_json === 'string'
          ? (JSON.parse(mRow.survey_data_json) as Record<string, unknown>)
          : { ...mRow.survey_data_json };
    } catch (err) {
      console.error('[fetchParentMasterSummary] Lỗi parse survey_data_json của Tòa Mẹ:', err);
    }
  }

  let specsRow: Record<string, unknown> | null = null;
  let deformRow: Record<string, unknown> | null = null;
  let scoreRow: Record<string, unknown> | null = null;

  if (mRow?.id) {
    const [spRes, dfRes, scRes] = await Promise.all([
      Database.query(`SELECT * FROM building_specifications WHERE report_id = $1 LIMIT 1;`, [mRow.id]),
      Database.query(`SELECT * FROM deformation_assessments WHERE report_id = $1 LIMIT 1;`, [mRow.id]),
      Database.query(`SELECT * FROM risk_score_cards WHERE report_id = $1 LIMIT 1;`, [mRow.id]),
    ]);
    specsRow = (spRes.rows[0] as Record<string, unknown>) || null;
    deformRow = (dfRes.rows[0] as Record<string, unknown>) || null;
    scoreRow = (scRes.rows[0] as Record<string, unknown>) || null;
  }

  const rawCat = Number(mJson.foundationCatScore ?? specsRow?.foundation_cat_score ?? 4);
  const catScore = Number.isFinite(rawCat) && rawCat >= 1 && rawCat <= 5 ? rawCat : 4;

  const stObj = (mJson.settlementTilt as Record<string, unknown>) || {};
  const tiltObj = (stObj.buildingTilt as Record<string, unknown>) || {};
  const settleObj = (stObj.diffSettlement as Record<string, unknown>) || {};
  const ecsObj = (mJson.ecs as Record<string, unknown>) || {};
  const viObj = (mJson.vi as Record<string, unknown>) || {};
  const execObj = (mJson.executiveSummary as Record<string, unknown>) || {};

  const addrParts = [p?.house_number, p?.street, p?.ward, p?.district].filter(Boolean);

  return {
    hasMasterReport: Boolean(mRow?.id),
    masterReportId: mRow?.id || null,
    masterStatus: mRow?.status || 'NOT_SURVEYED',
    isMasterApproved: mRow?.status === 'APPROVED',
    buildingName: String(mJson.buildingName || specsRow?.building_name || p?.project_parcel_code || 'Tòa nhà chung cư'),
    projectParcelCode: p?.project_parcel_code || '',
    addressText: addrParts.join(', ') || 'Chưa cập nhật địa chỉ',
    aboveFloors:
      mJson.aboveFloors !== undefined && mJson.aboveFloors !== null
        ? Number(mJson.aboveFloors)
        : specsRow?.floor_count !== undefined && specsRow?.floor_count !== null
          ? Number(specsRow.floor_count)
          : p?.floor_count ?? null,
    undergroundFloors:
      mJson.undergroundFloors !== undefined && mJson.undergroundFloors !== null
        ? Number(mJson.undergroundFloors)
        : specsRow?.basement_count !== undefined && specsRow?.basement_count !== null
          ? Number(specsRow.basement_count)
          : 0,
    constructionYear:
      mJson.constructionYear !== undefined && mJson.constructionYear !== ''
        ? Number(mJson.constructionYear)
        : specsRow?.year_of_construction !== undefined && specsRow?.year_of_construction !== null
          ? Number(specsRow.year_of_construction)
          : null,
    structureSystem: String(mJson.structureSystem || specsRow?.structural_system || 'KHUNG_VACH_BTCT'),
    foundationType: String(mJson.foundationType || specsRow?.foundation_category || 'CAT_4_MONG_COC_BTCT'),
    foundationCatScore: catScore,
    foundationDepthM: (mJson.foundationDepthM ?? specsRow?.foundation_depth_m ?? null) as number | string | null,
    metroOffsetDistance: (mJson.metroOffsetDistance ?? p?.distance_to_centerline_m ?? null) as string | number | null,
    clearanceOffsetDistance: (mJson.clearanceOffsetDistance ?? null) as string | number | null,
    buildingTilt: {
      level: Number(tiltObj.level ?? deformRow?.e3_deformation_score ?? 0),
      xPermille: (tiltObj.xPermille ?? deformRow?.tilt_angle_x ?? null) as number | string | null,
      yPermille: (tiltObj.yPermille ?? deformRow?.tilt_angle_y ?? null) as number | string | null,
      direction: (tiltObj.direction ?? deformRow?.tilt_direction ?? null) as string | null,
    },
    diffSettlement: {
      level: Number(settleObj.level ?? 0),
      position: (settleObj.position ?? null) as string | null,
    },
    scores: {
      totalEcs:
        ecsObj.totalEcs !== undefined
          ? Number(ecsObj.totalEcs)
          : scoreRow?.total_ecs_score !== undefined && scoreRow?.total_ecs_score !== null
            ? Number(scoreRow.total_ecs_score)
            : null,
      ecsClass: String(ecsObj.ecsClass || scoreRow?.ecs_class || 'GOOD'),
      avgVi:
        viObj.avgVi !== undefined
          ? Number(viObj.avgVi)
          : scoreRow?.avg_vi_score !== undefined && scoreRow?.avg_vi_score !== null
            ? Number(scoreRow.avg_vi_score)
            : null,
      viClass: String(viObj.viClass || scoreRow?.vi_class || 'LOW'),
      braStatus: String(execObj.braStatus || scoreRow?.preliminary_bra_classification || 'LOW'),
      impactStatus: String(execObj.constructionImpactStatus || 'I1'),
    },
    managementBoard: {
      contactName: (mJson.managementContactName ?? mJson.ownerName ?? null) as string | null,
      contactPhone: (mJson.managementContactPhone ?? mJson.ownerPhone ?? null) as string | null,
      contactRole: (mJson.managementContactRole ?? 'Ban Quản lý Tòa nhà') as string | null,
    },
  };
}

/**
 * Đồng bộ Dual-Write (SQL + JSONB) cho Vùng hư hại Kiến trúc (Z), Cấu kiện chịu lực (E) và Vết nứt (D)
 * Hỗ trợ nguyên bản cấu trúc phẳng của Chung cư (`damageZones[]` và `structuralElements[]`)
 * cũng như cấu trúc `floors[]`, đảm bảo Soft-Delete (`is_deleted = true`) và giữ nguyên UUID.
 */
export async function syncCondoZonesElementsAndDefectsInTx(
  client: PoolClient,
  reportId: string,
  defaultFloorName: string,
  mergedJson: Record<string, unknown>,
  sourceContainer: Record<string, unknown>
): Promise<{ maxBurlandGrade: number; predominantBurlandGrade: number; governingZoneCode: string; totalActiveDefects: number }> {
  const existingZonesRes = await client.query<{ id: string; zone_code: string; floor_name: string | null }>(
    `SELECT id, zone_code, floor_name FROM damage_zones WHERE report_id = $1;`,
    [reportId]
  );
  const claimedZoneIds = new Set<string>();
  const resolveZoneId = (rawId: unknown, floorName: string, code: string): string | null => {
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
    const byCode = existingZonesRes.rows.find((r) => !claimedZoneIds.has(r.id) && r.zone_code === code);
    if (byCode) {
      claimedZoneIds.add(byCode.id);
      return byCode.id;
    }
    return null;
  };

  const existingDefectsRes = await client.query<{ id: string; zone_id: string; defect_code: string }>(
    `SELECT d.id, d.zone_id, d.defect_code
     FROM defect_items d
     JOIN damage_zones z ON d.zone_id = z.id
     WHERE z.report_id = $1;`,
    [reportId]
  );
  const claimedDefectIds = new Set<string>();
  const resolveDefectId = (rawId: unknown, zoneId: string, dCode: string): string | null => {
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

  const activeZoneIds = new Set<string>();
  const activeDefectIds = new Set<string>();
  const crackGrades: Array<{ grade: number; zoneCode: string }> = [];
  let totalActiveDefects = 0;

  const upsertZoneOrElement = async (item: Record<string, unknown>, isStructuralElement: boolean) => {
    const isItemDeleted = Boolean(item.isDeleted || item.is_deleted);
    const code = String(
      item.zoneCode || item.zone_code || item.elementCode || item.element_code || (isStructuralElement ? 'E-01' : 'Z-01')
    );
    const floorName = String(item.floorName || item.floor_name || defaultFloorName || 'Tầng 1');
    const roomName = String(
      item.roomName || item.room_name || item.zoneName || (isStructuralElement ? 'Cấu kiện kết cấu' : 'Không gian chính')
    );
    const compType = normalizeComponentType(
      String(item.componentType || item.component_type || item.elementType || item.element_type || (isStructuralElement ? 'COLUMN' : 'WALL'))
    );
    const wallMat = item.wallMaterial || item.wall_material || item.materialType || (isStructuralElement ? 'BTCT' : null);
    const overviewList = Array.isArray(item.overviewPhotos)
      ? item.overviewPhotos
      : Array.isArray(item.overview_photos)
        ? item.overview_photos
        : [];
    const firstOverview =
      overviewList.length > 0
        ? typeof overviewList[0] === 'string'
          ? overviewList[0]
          : String((overviewList[0] as Record<string, unknown>)?.url || '')
        : '';
    const ctxUrl = String(item.ctxPhotoUrl || item.ctx_photo_url || item.photoUrl || firstOverview || '').trim();

    const rawDefects = Array.isArray(item.defects) ? (item.defects as Array<Record<string, unknown>>) : [];
    const activeDefects = rawDefects.filter((d) => !d.isDeleted && !d.is_deleted);
    totalActiveDefects += isItemDeleted ? 0 : activeDefects.length;

    let maxZoneBurland = 0;
    if (!isStructuralElement && !isItemDeleted) {
      for (const d of activeDefects) {
        if (isCrackDefectItem(d.screeningCategory || d.screening_category, d.defectType || d.defect_type)) {
          const w = Number(d.widthMaxMm ?? d.width_max_mm ?? d.widthMm ?? 0) || 0;
          const g =
            d.burlandGrade !== undefined && d.burlandGrade !== null
              ? Number(d.burlandGrade)
              : calcBurlandGradeFromWidth(w);
          maxZoneBurland = Math.max(maxZoneBurland, g);
          crackGrades.push({ grade: g, zoneCode: code });
        }
      }
    }

    const explicitZoneGrade =
      (item.burlandGrade ?? item.burland_grade) !== undefined && (item.burlandGrade ?? item.burland_grade) !== null
        ? Number(item.burlandGrade ?? item.burland_grade) || 0
        : 0;
    const finalZoneBurland = isStructuralElement ? explicitZoneGrade : Math.max(explicitZoneGrade, maxZoneBurland);

    const matchedZoneId = resolveZoneId(item.id, floorName, code);
    let targetZoneId: string;

    if (matchedZoneId) {
      targetZoneId = matchedZoneId;
      await client.query(
        `UPDATE damage_zones SET
           zone_code = $1,
           floor_name = $2,
           room_name = $3,
           component_type = $4,
           wall_material = $5,
           functional_impact_repair_needed = $6,
           burland_grade = $7,
           ctx_photo_url = COALESCE(NULLIF($8, ''), ctx_photo_url),
           ctx_photo_code = COALESCE($9, ctx_photo_code),
           notes = $10,
           is_deleted = $11
         WHERE id = $12;`,
        [
          code,
          floorName,
          roomName,
          compType,
          wallMat ? String(wallMat) : null,
          Boolean(item.functionalImpactRepairNeeded ?? item.functional_impact_repair_needed ?? item.hasDamage ?? activeDefects.length > 0),
          finalZoneBurland,
          ctxUrl,
          item.ctxPhotoCode || item.ctx_photo_code ? String(item.ctxPhotoCode || item.ctx_photo_code) : null,
          item.notes ? String(item.notes) : null,
          isItemDeleted,
          targetZoneId,
        ]
      );
    } else {
      const zIns = await client.query<{ id: string }>(
        `INSERT INTO damage_zones (
           report_id, zone_code, floor_name, room_name, component_type,
           wall_material, functional_impact_repair_needed, burland_grade,
           ctx_photo_url, ctx_photo_code, notes, is_deleted
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id;`,
        [
          reportId,
          code,
          floorName,
          roomName,
          compType,
          wallMat ? String(wallMat) : null,
          Boolean(item.functionalImpactRepairNeeded ?? item.functional_impact_repair_needed ?? item.hasDamage ?? activeDefects.length > 0),
          finalZoneBurland,
          ctxUrl,
          item.ctxPhotoCode || item.ctx_photo_code ? String(item.ctxPhotoCode || item.ctx_photo_code) : null,
          item.notes ? String(item.notes) : null,
          isItemDeleted,
        ]
      );
      targetZoneId = zIns.rows[0].id;
      claimedZoneIds.add(targetZoneId);
    }

    item.id = targetZoneId;
    item.burlandGrade = finalZoneBurland;
    if (!isItemDeleted) {
      activeZoneIds.add(targetZoneId);
    }

    for (const d of rawDefects) {
      const isDefectDeleted = Boolean(d.isDeleted || d.is_deleted) || isItemDeleted;
      const dCode = String(d.defectCode || d.defect_code || 'D-01');
      const rawCuPhotos = Array.isArray(d.cuPhotos)
        ? d.cuPhotos
        : Array.isArray(d.cu_photos_json)
          ? d.cu_photos_json
          : [];
      const normalizedCuPhotos: string[] = rawCuPhotos
        .map((p: unknown) => (typeof p === 'string' ? p : String((p as Record<string, unknown>)?.url || '')))
        .filter(Boolean);
      const primaryCuUrl = String(d.cuPhotoUrl || d.cu_photo_url || normalizedCuPhotos[0] || '').trim();
      const extraCuUrl = String(d.extraPhotoUrl || d.extra_photo_url || normalizedCuPhotos[1] || '').trim() || null;
      const cuListForJson = normalizedCuPhotos.length > 0 ? normalizedCuPhotos : primaryCuUrl ? [primaryCuUrl] : [];
      const actStateRaw = String(d.activityState || d.activity_state || 'U').toUpperCase();
      const actState = ['A', 'S', 'U'].includes(actStateRaw) ? actStateRaw : 'U';
      const wMax = Number(d.widthMaxMm ?? d.width_max_mm ?? d.widthMm ?? 0) || 0;
      const lMm = Number(d.lengthMm ?? d.length_mm ?? 0) || 0;
      const pX = Number(d.pinX ?? d.pin_x ?? 0) || 0;
      const pY = Number(d.pinY ?? d.pin_y ?? 0) || 0;
      const screenCat = String(d.screeningCategory || d.screening_category || d.defectType || d.defect_type || 'CRACK');
      const defType = String(d.defectType || d.defect_type || 'HAIRLINE');
      const crackDir = d.crackDirection || d.crack_direction ? String(d.crackDirection || d.crack_direction) : null;
      const matE4 = Number(d.materialDegradationE4 ?? d.material_degradation_e4 ?? 0) || 0;
      const structE2 = Number(d.structuralSignificanceE2 ?? d.structural_significance_e2 ?? 0) || 0;
      const hasScale = Boolean(d.hasScaleCard ?? d.has_scale_card ?? true);
      const isCrit = Boolean(d.isStructuralCritical ?? d.is_structural_critical ?? wMax >= 2.0);
      const pinCol = String(d.pinColor || d.pin_color || '#ef4444');
      const cuCode = d.cuPhotoCode || d.cu_photo_code ? String(d.cuPhotoCode || d.cu_photo_code) : null;

      const matchedDefId = resolveDefectId(d.id, targetZoneId, dCode);
      let targetDefectId: string;

      if (matchedDefId) {
        targetDefectId = matchedDefId;
        await client.query(
          `UPDATE defect_items SET
             defect_code = $1, pin_x = $2, pin_y = $3, screening_category = $4, defect_type = $5,
             crack_direction = $6, width_max_mm = $7, length_mm = $8, activity_state = $9,
             material_degradation_e4 = $10, structural_significance_e2 = $11, has_scale_card = $12,
             is_structural_critical = $13, cu_photo_url = COALESCE(NULLIF($14, ''), cu_photo_url),
             extra_photo_url = COALESCE($15, extra_photo_url), pin_color = $16,
             cu_photo_code = COALESCE($17, cu_photo_code), cu_photos_json = $18,
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
            primaryCuUrl,
            extraCuUrl,
            pinCol,
            cuCode,
            JSON.stringify(cuListForJson),
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
            primaryCuUrl,
            extraCuUrl,
            pinCol,
            cuCode,
            JSON.stringify(cuListForJson),
            isDefectDeleted,
          ]
        );
        targetDefectId = dIns.rows[0].id;
        claimedDefectIds.add(targetDefectId);
      }

      d.id = targetDefectId;
      if (!isDefectDeleted) {
        activeDefectIds.add(targetDefectId);
      }
    }
  };

  // Hỗ trợ cả cấu trúc phẳng (damageZones + structuralElements) lẫn cấu trúc floors[]
  const hasFlatZones = Array.isArray(sourceContainer.damageZones);
  const hasFlatElements = Array.isArray(sourceContainer.structuralElements);
  const hasFloors = Array.isArray(sourceContainer.floors) && (sourceContainer.floors as unknown[]).length > 0;

  if (hasFlatZones || hasFlatElements) {
    const flatZones = Array.isArray(sourceContainer.damageZones)
      ? (sourceContainer.damageZones as Array<Record<string, unknown>>)
      : Array.isArray(mergedJson.damageZones)
        ? (mergedJson.damageZones as Array<Record<string, unknown>>)
        : [];
    const flatElements = Array.isArray(sourceContainer.structuralElements)
      ? (sourceContainer.structuralElements as Array<Record<string, unknown>>)
      : Array.isArray(mergedJson.structuralElements)
        ? (mergedJson.structuralElements as Array<Record<string, unknown>>)
        : [];

    for (const z of flatZones) {
      await upsertZoneOrElement(z, false);
    }
    for (const el of flatElements) {
      await upsertZoneOrElement(el, true);
    }

    mergedJson.damageZones = flatZones;
    mergedJson.structuralElements = flatElements;
  } else if (hasFloors) {
    const floors = sourceContainer.floors as Array<Record<string, unknown>>;
    for (const fl of floors) {
      const zones = Array.isArray(fl.zones) ? (fl.zones as Array<Record<string, unknown>>) : [];
      const elems = Array.isArray(fl.structuralElements) ? (fl.structuralElements as Array<Record<string, unknown>>) : [];
      for (const z of zones) {
        await upsertZoneOrElement(z, false);
      }
      for (const el of elems) {
        await upsertZoneOrElement(el, true);
      }
    }
    mergedJson.floors = floors;
  }

  // Soft-Delete các damage_zones & defect_items không còn nằm trong danh sách active
  if (activeZoneIds.size > 0) {
    await client.query(
      `UPDATE damage_zones SET is_deleted = true
       WHERE report_id = $1 AND NOT (id = ANY($2::uuid[]));`,
      [reportId, Array.from(activeZoneIds)]
    );
  } else {
    await client.query(`UPDATE damage_zones SET is_deleted = true WHERE report_id = $1;`, [reportId]);
  }

  if (activeDefectIds.size > 0) {
    await client.query(
      `UPDATE defect_items SET is_deleted = true
       WHERE zone_id IN (SELECT id FROM damage_zones WHERE report_id = $1)
         AND NOT (id = ANY($2::uuid[]));`,
      [reportId, Array.from(activeDefectIds)]
    );
  } else {
    await client.query(
      `UPDATE defect_items SET is_deleted = true
       WHERE zone_id IN (SELECT id FROM damage_zones WHERE report_id = $1);`,
      [reportId]
    );
  }

  let maxBurlandGrade = 0;
  let predominantBurlandGrade = 0;
  let governingZoneCode = 'Z-01';

  if (crackGrades.length > 0) {
    const counts: Record<number, number> = {};
    for (const item of crackGrades) {
      if (item.grade >= maxBurlandGrade) {
        maxBurlandGrade = item.grade;
        governingZoneCode = item.zoneCode;
      }
      counts[item.grade] = (counts[item.grade] || 0) + 1;
    }
    let maxCnt = -1;
    for (const [gStr, cnt] of Object.entries(counts)) {
      const g = Number(gStr);
      if (cnt > maxCnt || (cnt === maxCnt && g > predominantBurlandGrade)) {
        maxCnt = cnt;
        predominantBurlandGrade = g;
      }
    }
  }

  const curBs = ((mergedJson.burlandSummary as Record<string, unknown>) || {}) as Record<string, unknown>;
  mergedJson.burlandSummary = {
    ...curBs,
    localMaxGrade: maxBurlandGrade,
    predominantGrade: predominantBurlandGrade,
    governingZoneCode,
    controllingDefectsCount: totalActiveDefects,
  };

  return {
    maxBurlandGrade,
    predominantBurlandGrade,
    governingZoneCode,
    totalActiveDefects,
  };
}

export { normalizeFoundationCategory, normalizeStructuralSystem, normalizeComponentType };

