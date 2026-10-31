import { Database } from '../../../../database/db';
import { NotFoundError } from '../../../../common/errors/problem-details';
import { CondoFloorMatrixRow } from '../condo-audit.types';
import { fetchCondoUnitAbsenceMap } from '../condo-absence.resolver';
import { CONDO_AREA_UNIT_SQL, isCondoAreaUnit } from '../condo-entity-classifier';
import { fetchParentMasterSummary } from '../strategies/condo-entity-strategy.interface';
import { CondoCrudEngineService } from './condo-crud-engine.service';

export class CondoQueueService {
  /**
   * Làm giàu dữ liệu Split-Pane Audit View cho 3 thực thể Chung cư (BUILDING_MASTER, MASTER_AREA, CONDO_UNIT)
   * mà không chạm vào luồng xử lý của Nhà dân độc lập (STANDALONE).
   */
  static async enrichSplitPaneAuditViewForCondo<T extends Record<string, unknown>>(
    reportId: string,
    baseView: T
  ): Promise<T> {
    const resolved = await CondoCrudEngineService.resolveCondoReportContext(reportId);
    if (!resolved) {
      return baseView;
    }

    const { context, entityKind } = resolved;
    const parentMasterSummary = await fetchParentMasterSummary(context.parcel_id);
    const condoAbsence =
      entityKind === 'CONDO_UNIT'
        ? ((await fetchCondoUnitAbsenceMap([context.report_id])).get(context.report_id) ?? null)
        : null;

    // Truy vấn danh sách mặt bằng CAD các tầng của tòa tháp
    const fpRes = await Database.query<{
      id: string;
      floor_number: number;
      floor_name: string | null;
      cad_photo_url: string | null;
      updated_at: string | null;
    }>(
      `SELECT id, floor_number, floor_name, cad_photo_url, updated_at
       FROM building_floor_plans
       WHERE parcel_id = $1 AND deleted_at IS NULL
       ORDER BY floor_number ASC;`,
      [context.parcel_id]
    );

    const leftPane =
      baseView.leftPane && typeof baseView.leftPane === 'object'
        ? (baseView.leftPane as Record<string, unknown>)
        : {};
    const surveyJson =
      leftPane.surveyJson && typeof leftPane.surveyJson === 'object'
        ? (leftPane.surveyJson as Record<string, unknown>)
        : {};

    // Bổ sung structuralElements từ JSONB nếu SQL chưa tách riêng
    const existingElements = Array.isArray(leftPane.structuralElements)
      ? (leftPane.structuralElements as Array<Record<string, unknown>>)
      : [];
    let normalizedElements = existingElements;
    if (normalizedElements.length === 0 && Array.isArray(surveyJson.structuralElements)) {
      normalizedElements = (surveyJson.structuralElements as Array<Record<string, unknown>>)
        .filter((el) => !el.isDeleted && !el.is_deleted)
        .map((el, idx) => ({
          id: String(el.id || `el_${idx + 1}`),
          zone_code: String(el.elementCode || el.zone_code || `E-${String(idx + 1).padStart(2, '0')}`),
          elementCode: String(el.elementCode || el.zone_code || `E-${String(idx + 1).padStart(2, '0')}`),
          floor_name: String(el.floorName || el.floor_name || `Tầng ${context.floor_number ?? 1}`),
          room_name: String(el.roomName || el.locationText || 'Cấu kiện kết cấu'),
          component_type: String(el.elementType || el.component_type || 'Cột BTCT'),
          wall_material: String(el.materialType || el.wall_material || 'BTCT'),
          dimensions_text: el.dimensionsText || el.dimensions_text || null,
          ctx_photo_url: el.ctxPhotoUrl || el.ctx_photo_url || null,
          ctx_photo_code: el.ctxPhotoCode || el.ctx_photo_code || null,
          pin_x: el.pinX ?? el.pin_x ?? null,
          pin_y: el.pinY ?? el.pin_y ?? null,
          defects: Array.isArray(el.defects) ? el.defects : [],
        }));
    }

    // Bổ sung cờ cảnh báo đặc thù của Chung cư
    const existingWarnings = Array.isArray(baseView.auditWarningFlags)
      ? [...(baseView.auditWarningFlags as Array<{ code: string; level: 'WARNING' | 'INFO'; message: string }>)]
      : [];

    if (entityKind !== 'BUILDING_MASTER' && parentMasterSummary.masterStatus !== 'APPROVED') {
      const hasMasterWarn = existingWarnings.some((w) => w.code === 'MASTER_REPORT_NOT_APPROVED');
      if (!hasMasterWarn) {
        existingWarnings.push({
          code: 'MASTER_REPORT_NOT_APPROVED',
          level: 'WARNING',
          message:
            'Hồ sơ Tòa nhà mẹ (Master Report) chưa được phê duyệt (APPROVED). Cần phê duyệt Master Report trước khi Khóa sổ pháp lý toàn tòa.',
        });
      }
    }

    if (entityKind === 'CONDO_UNIT') {
      const auditLeak = surveyJson.waterLeakageFromUpperFloor as Record<string, unknown> | undefined;
      const surveyLeak = surveyJson.upperFloorWaterLeakage as Record<string, unknown> | undefined;
      const hasWaterLeak =
        Boolean(auditLeak?.hasLeakage) ||
        Boolean(surveyLeak?.has) ||
        (Array.isArray(surveyLeak?.leakageItems) && surveyLeak.leakageItems.length > 0);
      if (hasWaterLeak) {
        existingWarnings.push({
          code: 'UPPER_FLOOR_WATER_LEAKAGE',
          level: 'WARNING',
          message:
            'Căn hộ ghi nhận hiện tượng thấm dột từ sàn tầng trên — khuyến nghị đối chiếu chéo với căn hộ ngay phía trên.',
        });
      }

      const auditDoorJam = surveyJson.doorJamming as Record<string, unknown> | undefined;
      const surveyDoorJam = surveyJson.doorJammingStatus;
      const hasDoorJam =
        Boolean(auditDoorJam?.hasJamming) ||
        (typeof surveyDoorJam === 'string' && surveyDoorJam !== '' && surveyDoorJam !== 'NORMAL');
      if (hasDoorJam) {
        existingWarnings.push({
          code: 'DOOR_JAMMING_STRUCTURAL',
          level: 'WARNING',
          message:
            'Căn hộ ghi nhận hiện tượng kẹt cửa / biến dạng khung cửa — cần kiểm tra độ võng dầm hoặc chuyển vị lệch tầng.',
        });
      }
    }

    return {
      ...baseView,
      condoEntityKind: entityKind,
      condoAbsence,
      parentMasterSummary,
      floorPlans: fpRes.rows,
      auditWarningFlags: existingWarnings,
      leftPane: {
        ...leftPane,
        condoEntityKind: entityKind,
        parentMasterSummary,
        floorPlans: fpRes.rows,
        structuralElements: normalizedElements,
      },
    };
  }

  /**
   * Danh sách các Khối Tháp Chung Cư (Condo Towers) kèm chỉ số tổng hợp 3 cấp:
   * - Hồ sơ Tòa nhà mẹ (Master Report) + số mặt bằng CAD
   * - Khu vực dùng chung (Master Areas)
   * - Căn hộ con (Child Units) + số căn vắng mặt + số căn nguy hiểm (Critical)
   */
  static async listCondoTowers(zoneId?: string) {
    const params: unknown[] = [];
    let whereClause = `WHERE p.building_type IN ('CONDOMINIUM', 'CONDO')`;

    if (zoneId && zoneId.toUpperCase() !== 'ALL' && zoneId.toUpperCase() !== 'ALL_ZONES') {
      params.push(zoneId.toUpperCase());
      whereClause += ` AND p.zone_id = $${params.length}`;
    }

    const query = `
      SELECT 
        p.id AS parcel_id,
        p.project_parcel_code,
        p.project_parcel_code AS parent_parcel_code,
        p.house_number,
        p.street,
        p.zone_id,
        p.building_type,
        p.floor_count,
        p.total_units,
        p.survey_status AS parcel_status,
        COALESCE(p.is_locked, false) AS parent_parcel_is_locked,
        p.seal_hash AS parent_parcel_seal_hash,
        p.locked_at AS parent_parcel_locked_at,
        u_lock.full_name AS parent_parcel_locked_by_name,
        r.id AS report_id,
        r.id AS master_report_id,
        COALESCE(r.status::text, p.survey_status::text) AS status,
        COALESCE(r.status::text, 'MISSING') AS master_report_status,
        r.report_type,
        r.created_at,
        r.updated_at,
        r.survey_date,
        (
          SELECT COUNT(*)::int
          FROM building_floor_plans bfp
          WHERE bfp.parcel_id = p.id AND bfp.deleted_at IS NULL
        ) AS floor_plan_count,
        (
          SELECT COUNT(*)::int
          FROM building_units bu
          WHERE bu.parcel_id = p.id AND bu.deleted_at IS NULL
        ) AS total_unit_count,
        (
          SELECT COUNT(*)::int
          FROM building_units bu
          WHERE bu.parcel_id = p.id AND bu.deleted_at IS NULL AND bu.status IN ('APPROVED', 'POSTPONED_ABSENT_VERIFIED')
        ) AS approved_unit_count,
        (
          SELECT COUNT(*)::int
          FROM building_units bu
          WHERE bu.parcel_id = p.id AND bu.deleted_at IS NULL AND bu.status = 'SUBMITTED'
        ) AS pending_unit_count,
        (
          SELECT COUNT(*)::int
          FROM building_units bu
          WHERE bu.parcel_id = p.id AND bu.deleted_at IS NULL
            AND ${CONDO_AREA_UNIT_SQL}
        ) AS master_area_count,
        (
          SELECT COUNT(*)::int
          FROM building_units bu
          WHERE bu.parcel_id = p.id AND bu.deleted_at IS NULL
            AND ${CONDO_AREA_UNIT_SQL}
            AND bu.status = 'APPROVED'
        ) AS approved_master_area_count,
        (
          SELECT COUNT(*)::int
          FROM building_units bu
          WHERE bu.parcel_id = p.id AND bu.deleted_at IS NULL
            AND NOT ${CONDO_AREA_UNIT_SQL}
        ) AS child_unit_count,
        (
          SELECT COUNT(*)::int
          FROM building_units bu
          WHERE bu.parcel_id = p.id AND bu.deleted_at IS NULL
            AND NOT ${CONDO_AREA_UNIT_SQL}
            AND bu.status IN ('APPROVED', 'POSTPONED_ABSENT_VERIFIED')
        ) AS approved_child_unit_count,
        (
          SELECT COUNT(*)::int
          FROM building_units bu
          WHERE bu.parcel_id = p.id AND bu.deleted_at IS NULL
            AND bu.status IN ('POSTPONED_ABSENT', 'POSTPONED_ABSENT_VERIFIED')
        ) AS absent_unit_count,
        (
          SELECT COUNT(DISTINCT bu.id)::int
          FROM building_units bu
          JOIN base_survey_reports r_u ON r_u.unit_id = bu.id
          LEFT JOIN risk_score_cards sc_u ON sc_u.report_id = r_u.id
          WHERE bu.parcel_id = p.id AND bu.deleted_at IS NULL
            AND GREATEST(
              COALESCE(sc_u.e1_burland_score, 0),
              CASE WHEN (r_u.survey_data_json->'burlandSummary'->>'localMaxGrade') ~ '^[0-9]+$'
                   THEN (r_u.survey_data_json->'burlandSummary'->>'localMaxGrade')::int ELSE 0 END
            ) >= 3
        ) AS critical_unit_count
      FROM parcels p
      LEFT JOIN users u_lock ON p.locked_by_id = u_lock.id
      LEFT JOIN LATERAL (
        SELECT r_sub.id, r_sub.status, r_sub.report_type, r_sub.created_at, r_sub.updated_at, r_sub.survey_date
        FROM base_survey_reports r_sub
        WHERE r_sub.parcel_id = p.id AND (r_sub.unit_id IS NULL OR r_sub.report_type IN ('CONDO_MASTER', 'BUILDING_MASTER'))
        ORDER BY r_sub.created_at DESC
        LIMIT 1
      ) r ON true
      ${whereClause}
      ORDER BY p.project_parcel_code ASC;
    `;

    const res = await Database.query(query, params);
    return res.rows;
  }

  /**
   * Tổng hợp tiến độ thẩm định đa tầng của 1 Khối Tháp Chung Cư (Condo Tower Progress + Ma trận tầng Floor Matrix)
   */
  static async getCondoProgressSummary(parcelId: string) {
    const parcelRes = await Database.query<{
      id: string;
      project_parcel_code: string;
      house_number: string | null;
      street: string | null;
      zone_id: string;
      building_type: string;
      floor_count: number | null;
      total_units: number | null;
      survey_status: string;
      is_locked: boolean | null;
      locked_at: string | null;
      seal_hash: string | null;
      seal_notes: string | null;
    }>(
      `SELECT id, project_parcel_code, house_number, street, zone_id, building_type,
              floor_count, total_units, survey_status, is_locked, locked_at, seal_hash, seal_notes
       FROM parcels
       WHERE id = $1;`,
      [parcelId]
    );

    if (!parcelRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy tòa nhà chung cư với ID: ${parcelId}`);
    }
    const parcel = parcelRes.rows[0];

    // Truy vấn danh sách toàn bộ building_units kèm report mới nhất và điểm Burland
    const unitsRes = await Database.query<{
      id: string;
      unit_code: string;
      unit_type: string | null;
      floor_number: number | null;
      owner_name: string | null;
      status: string;
      report_id: string | null;
      report_status: string | null;
      burland_grade: number | null;
      e1_burland_score: number | null;
      critical_defect_count: number;
    }>(
      `SELECT
         bu.id,
         bu.unit_code,
         bu.unit_type,
         bu.floor_number,
         bu.owner_name,
         bu.status,
         r.id AS report_id,
         r.status::text AS report_status,
         r.burland_grade,
         sc.e1_burland_score,
         COALESCE((
           SELECT COUNT(*)::int
           FROM defect_items d
           JOIN damage_zones z ON d.zone_id = z.id
           WHERE z.report_id = r.id
             AND COALESCE(d.is_deleted, false) = false
             AND (d.is_structural_critical = true OR d.width_max_mm >= 3.0)
         ), 0) AS critical_defect_count
       FROM building_units bu
       LEFT JOIN LATERAL (
         SELECT r_sub.id, r_sub.status,
           CASE WHEN (r_sub.survey_data_json->'burlandSummary'->>'localMaxGrade') ~ '^[0-9]+$'
                THEN (r_sub.survey_data_json->'burlandSummary'->>'localMaxGrade')::int END AS burland_grade
         FROM base_survey_reports r_sub
         WHERE r_sub.unit_id = bu.id
         ORDER BY r_sub.created_at DESC
         LIMIT 1
       ) r ON true
       LEFT JOIN risk_score_cards sc ON sc.report_id = r.id
       WHERE bu.parcel_id = $1 AND bu.deleted_at IS NULL
       ORDER BY bu.floor_number ASC NULLS LAST, bu.unit_code ASC;`,
      [parcelId]
    );

    const allUnits = unitsRes.rows;
    const isMasterAreaUnit = (u: { unit_type: string | null; unit_code: string }) =>
      isCondoAreaUnit(u.unit_type, u.unit_code);

    const childUnits = allUnits.filter((u) => !isMasterAreaUnit(u));
    const masterAreas = allUnits.filter((u) => isMasterAreaUnit(u));

    const totalChildUnits = childUnits.length;
    const approvedChildUnits = childUnits.filter((u) => u.status === 'APPROVED').length;
    const absentVerifiedChildUnits = childUnits.filter(
      (u) => u.status === 'POSTPONED_ABSENT_VERIFIED'
    ).length;
    const absentPendingChildUnits = childUnits.filter(
      (u) => u.status === 'POSTPONED_ABSENT'
    ).length;
    const submittedChildUnits = childUnits.filter(
      (u) => u.status === 'SUBMITTED' || u.status === 'UNDER_REVIEW'
    ).length;
    const inProgressChildUnits = childUnits.filter(
      (u) =>
        !['APPROVED', 'POSTPONED_ABSENT_VERIFIED', 'POSTPONED_ABSENT', 'SUBMITTED', 'UNDER_REVIEW'].includes(
          u.status
        )
    ).length;

    const totalMasterAreas = masterAreas.length;
    const approvedMasterAreas = masterAreas.filter((u) => u.status === 'APPROVED').length;
    const submittedMasterAreas = masterAreas.filter(
      (u) => u.status === 'SUBMITTED' || u.status === 'UNDER_REVIEW'
    ).length;
    const pendingMasterAreas = masterAreas.filter(
      (u) => !['APPROVED', 'SUBMITTED', 'UNDER_REVIEW'].includes(u.status)
    ).length;

    const totalItems = allUnits.length;
    const completedItems =
      approvedChildUnits + absentVerifiedChildUnits + approvedMasterAreas;
    const completionRatePercent =
      totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const criticalCracks = allUnits.reduce(
      (sum, u) => sum + Number(u.critical_defect_count || 0),
      0
    );

    // Truy vấn Hồ sơ Tòa nhà mẹ (Master Report)
    const masterReportRes = await Database.query<{
      id: string;
      status: string;
      updated_at: string;
      burland_damage_category: string | null;
      total_ecs: number | null;
      ecs_class: string | null;
      avg_vi: number | null;
      vi_class: string | null;
      bra_rating: string | null;
    }>(
      `SELECT
         r.id,
         r.status::text AS status,
         r.updated_at,
         COALESCE(r.survey_data_json->'burlandSummary'->>'localMaxGrade', sc.e1_burland_score::text) AS burland_damage_category,
         COALESCE(sc.overridden_total_ecs, sc.total_ecs_score) AS total_ecs,
         COALESCE(sc.overridden_ecs_class, sc.ecs_class::text) AS ecs_class,
         COALESCE(sc.overridden_avg_vi, sc.avg_vi_score) AS avg_vi,
         COALESCE(sc.overridden_vi_class, sc.vi_class::text) AS vi_class,
         COALESCE(sc.overridden_bra, sc.building_risk_assessment_bra::text) AS bra_rating
       FROM base_survey_reports r
       LEFT JOIN risk_score_cards sc ON sc.report_id = r.id
       WHERE r.parcel_id = $1 AND (r.unit_id IS NULL OR r.report_type IN ('CONDO_MASTER', 'BUILDING_MASTER'))
       ORDER BY r.created_at DESC
       LIMIT 1;`,
      [parcelId]
    );
    const masterReport = masterReportRes.rows[0] || null;
    const parentMasterSummary = await fetchParentMasterSummary(parcelId);

    // Truy vấn Mặt bằng CAD các tầng
    const fpRes = await Database.query<{
      id: string;
      floor_number: number;
      floor_name: string | null;
      cad_photo_url: string | null;
    }>(
      `SELECT id, floor_number, floor_name, cad_photo_url
       FROM building_floor_plans
       WHERE parcel_id = $1 AND deleted_at IS NULL
       ORDER BY floor_number ASC;`,
      [parcelId]
    );
    const floorPlans = fpRes.rows;

    // Xây dựng Ma trận Tầng × Căn hộ / Khu vực chung (Floor Matrix)
    const floorMap = new Map<number, CondoFloorMatrixRow>();
    for (const fp of floorPlans) {
      floorMap.set(fp.floor_number, {
        floorNumber: fp.floor_number,
        floorName: fp.floor_name || (fp.floor_number < 0 ? `Hầm B${Math.abs(fp.floor_number)}` : `Tầng ${fp.floor_number}`),
        cadPhotoUrl: fp.cad_photo_url,
        totalUnits: 0,
        approvedUnits: 0,
        pendingUnits: 0,
        absentUnits: 0,
        criticalUnits: 0,
        masterAreasCount: 0,
        units: [],
      });
    }

    for (const u of allUnits) {
      const flNum = Number.isFinite(Number(u.floor_number)) ? Number(u.floor_number) : 1;
      if (!floorMap.has(flNum)) {
        floorMap.set(flNum, {
          floorNumber: flNum,
          floorName: flNum < 0 ? `Hầm B${Math.abs(flNum)}` : `Tầng ${flNum}`,
          cadPhotoUrl: null,
          totalUnits: 0,
          approvedUnits: 0,
          pendingUnits: 0,
          absentUnits: 0,
          criticalUnits: 0,
          masterAreasCount: 0,
          units: [],
        });
      }
      const row = floorMap.get(flNum)!;
      const isArea = isMasterAreaUnit(u);
      const isCritical =
        Number(u.e1_burland_score ?? 0) >= 3 ||
        Number(u.burland_grade ?? 0) >= 3 ||
        Number(u.critical_defect_count || 0) > 0;

      row.totalUnits += 1;
      if (isArea) row.masterAreasCount += 1;
      if (u.status === 'APPROVED' || u.status === 'POSTPONED_ABSENT_VERIFIED') {
        row.approvedUnits += 1;
      } else if (u.status === 'POSTPONED_ABSENT') {
        row.absentUnits += 1;
      } else {
        row.pendingUnits += 1;
      }
      if (isCritical) {
        row.criticalUnits += 1;
      }

      row.units.push({
        unitId: u.id,
        unitCode: u.unit_code,
        unitType: isArea ? 'MASTER_AREA' : 'CONDO_UNIT',
        status: u.status,
        reportId: u.report_id,
        burlandScore: u.e1_burland_score !== null ? Number(u.e1_burland_score) : null,
        ownerName: u.owner_name,
      });
    }

    const floorMatrix = Array.from(floorMap.values()).sort(
      (a, b) => b.floorNumber - a.floorNumber
    );

    // Danh sách các hạng mục đang chặn Khóa Sổ Pháp Lý (Blocking Items)
    const blockingItems: Array<{
      id: string;
      unitCode: string;
      unitType: string;
      floorNumber: number | null;
      status: string;
      reportId: string | null;
      reason: string;
    }> = [];

    if (!masterReport) {
      blockingItems.push({
        id: parcel.id,
        unitCode: 'MASTER-TOWER',
        unitType: 'BUILDING_MASTER',
        floorNumber: null,
        status: 'MISSING',
        reportId: null,
        reason: 'Chưa khởi tạo Hồ sơ Tòa nhà mẹ (Building Master Report)',
      });
    } else if (masterReport.status !== 'APPROVED') {
      blockingItems.push({
        id: masterReport.id,
        unitCode: 'MASTER-TOWER',
        unitType: 'BUILDING_MASTER',
        floorNumber: null,
        status: masterReport.status,
        reportId: masterReport.id,
        reason: 'Hồ sơ Tòa nhà mẹ (Master Report) chưa được Phê duyệt (APPROVED)',
      });
    }

    for (const u of allUnits) {
      if (u.status !== 'APPROVED' && u.status !== 'POSTPONED_ABSENT_VERIFIED') {
        blockingItems.push({
          id: u.id,
          unitCode: u.unit_code,
          unitType: isMasterAreaUnit(u) ? 'MASTER_AREA' : 'CONDO_UNIT',
          floorNumber: u.floor_number,
          status: u.status,
          reportId: u.report_id,
          reason:
            u.status === 'POSTPONED_ABSENT'
              ? 'Căn hộ vắng mặt chưa được xác nhận niêm yết hợp lệ'
              : u.status === 'SUBMITTED' || u.status === 'UNDER_REVIEW'
                ? 'Hồ sơ đang chờ Zone Admin phê duyệt'
                : u.status === 'REJECTED'
                  ? 'Hồ sơ bị trả về cần khảo sát lại'
                  : 'Chưa hoàn thành khảo sát hiện trường',
        });
      }
    }

    const isReadyForFinalSeal =
      Boolean(masterReport && masterReport.status === 'APPROVED') &&
      blockingItems.length === 0 &&
      totalItems > 0 &&
      !parcel.is_locked;

    return {
      parcel: {
        id: parcel.id,
        projectParcelCode: parcel.project_parcel_code,
        houseNumber: parcel.house_number,
        street: parcel.street,
        zoneId: parcel.zone_id,
        buildingType: parcel.building_type,
        floorCount: parcel.floor_count,
        totalUnits: parcel.total_units,
        surveyStatus: parcel.survey_status,
        isLocked: Boolean(parcel.is_locked),
        lockedAt: parcel.locked_at,
        sealHash: parcel.seal_hash,
        sealNotes: parcel.seal_notes,
      },
      stats: {
        totalItems,
        completedItems,
        completionRatePercent,
        criticalCracks,
        childUnits: {
          total: totalChildUnits,
          approved: approvedChildUnits,
          absentVerified: absentVerifiedChildUnits,
          absentPending: absentPendingChildUnits,
          submitted: submittedChildUnits,
          inProgress: inProgressChildUnits,
        },
        masterAreas: {
          total: totalMasterAreas,
          approved: approvedMasterAreas,
          submitted: submittedMasterAreas,
          pending: pendingMasterAreas,
        },
      },
      blockingItems,
      isReadyForFinalSeal,
      masterReport,
      parentMasterSummary,
      floorPlans,
      floorMatrix,
    };
  }
}
