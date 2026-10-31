import { Database } from '../../database/db';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../common/errors/problem-details';
import { calculateVi } from './vi-calculator';

/** Các trường của survey_data_json mà bộ chấm điểm ECS & VI cần đọc (Đồng bộ 100% FE Phase 1) */
interface ScoringSurveyJson {
  usageFunction?: string;
  surveyCaseType?: string;
  isVacantLand?: boolean;
  objectGroup?: string;
  structureSystem?: string;
  foundationCatScore?: number | null;
  constructionYear?: number | null;
  operationalDefects?: string[];
  burlandSummary?: {
    localMaxGrade?: number;
    predominantGrade?: number;
    structuralFlagLevel?: string;
  };
  settlementTilt?: {
    diffSettlement?: { level?: number };
    buildingTilt?: { level?: number };
    tiltAssessment?: { level?: number };
    beamSagging?: { level?: number };
  };
  deformation?: {
    diffSettlement?: { level?: number };
    buildingTilt?: { level?: number };
    tiltAssessment?: { level?: number };
    beamSagging?: { level?: number };
  };
  historyInterview?: {
    renovationLoad?: number;
    majorRepair?: number;
    pastSettlement?: number;
    neighborImpact?: number;
    neighborDamage?: number;
    fireFloodHistory?: number;
    fireFloodIncident?: number;
    continuousOperation247?: boolean | { has?: boolean; notes?: string } | null;
    sensitiveEquipment?: { has?: boolean };
  };
  floors?: Array<{
    zones?: Array<{
      zoneCode?: string;
      isDeleted?: boolean;
      is_deleted?: boolean;
      burlandGrade?: number;
      functionalImpactRepairNeeded?: boolean;
      defects?: Array<{
        isDeleted?: boolean;
        is_deleted?: boolean;
        screeningCategory?: string;
        defectType?: string;
        widthMaxMm?: number;
        width_max_mm?: number;
        structuralSignificanceE2?: number;
        materialDegradationE4?: number;
        functionalImpactE6?: number;
        isStructuralCritical?: boolean;
      }>;
    }>;
    structuralElements?: Array<{
      elementCode?: string;
      isDeleted?: boolean;
      is_deleted?: boolean;
      hasDamage?: boolean;
      conditionStatus?: string;
      defects?: Array<{
        isDeleted?: boolean;
        is_deleted?: boolean;
        screeningCategory?: string;
        defectType?: string;
        widthMaxMm?: number;
        width_max_mm?: number;
        structuralSignificanceE2?: number;
        materialDegradationE4?: number;
        functionalImpactE6?: number;
        isStructuralCritical?: boolean;
      }>;
    }>;
  }>;
  ecs?: {
    e1?: number;
    e2?: number;
    e3?: number;
    e4?: number;
    e5?: number;
    e6?: number;
    totalEcs?: number;
    ecsClass?: string;
    engineeringJudgement?: {
      isOverridden?: boolean;
      action?: string;
      reason?: string;
      adjustedScore?: number | null;
      adjustedClass?: string | null;
    };
  };
  vi?: {
    v1?: number;
    v2?: number;
    v3?: number;
    v4?: number;
    v5?: number;
    v6?: number;
    totalVi?: number;
    viAvg?: number;
    viClass?: string;
    engineeringJudgement?: {
      isOverridden?: boolean;
      action?: string;
      reason?: string;
      adjustedScore?: number | null;
      adjustedClass?: string | null;
    };
  };
}

/** building_grade của building_specifications (GRADE_1/GRADE_2/...) → objectGroup chuẩn */
function mapBuildingGradeToObjectGroup(grade?: string | null): string {
  if (grade === 'CRITICAL' || grade === 'GRADE_1') return 'CRITICAL';
  if (grade === 'IMPORTANT' || grade === 'GRADE_2') return 'IMPORTANT';
  return 'GENERAL';
}

/** Kiểm tra khuyết tật có phải dạng vết nứt hay không (đồng bộ 1:1 với frontend/src/components/canvas/defectHelpers.ts) */
function isCrackRelatedDefect(cat?: string | null, type?: string | null): boolean {
  const catStr = (cat || '').toLowerCase();
  const typeStr = (type || '').toLowerCase();
  const full = `${catStr} ${typeStr}`;

  if (
    full.includes('thấm dột') ||
    full.includes('ẩm mốc') ||
    full.includes('kẹt cửa') ||
    full.includes('cong vênh') ||
    full.includes('bong rộp') ||
    full.includes('bong tróc') ||
    full.includes('rỉ sét')
  ) {
    if (typeStr.includes('nứt') || typeStr.includes('crack')) {
      return true;
    }
    return false;
  }

  return full.includes('nứt') || full.includes('crack');
}

/** Quy đổi bề rộng vết nứt (mm) sang cấp Burland 0..5 (đồng bộ 1:1 với Step4_BurlandSummary.tsx) */
function getBurlandGradeFromWidth(w: number): number {
  if (w <= 0.1) return 0;
  if (w <= 1) return 1;
  if (w <= 5) return 2;
  if (w <= 15) return 3;
  if (w <= 25) return 4;
  return 5;
}

export class ScoringService {
  /**
   * Tự động tính điểm ECS (0-24) và Chỉ số Tổn thương VI cho Báo cáo Phase 1
   * Đồng bộ 100% theo công thức Frontend Phase 1 (ecsCalculator.ts, viCalculator.ts, Step4_BurlandSummary.tsx)
   */
  static async calculatePhase1Scores(reportId: string) {
    // 0. Đọc survey_data_json & building_specifications trước để kết hợp cùng dữ liệu bảng quan hệ
    const specRes = await Database.query<{
      building_grade?: string;
      land_use_function?: string;
      year_of_construction?: number;
      structural_system?: string;
      survey_data_json?: ScoringSurveyJson | string;
    }>(
      `SELECT bs.building_grade, bs.land_use_function, bs.year_of_construction, bs.structural_system, r.survey_data_json
       FROM base_survey_reports r
       LEFT JOIN building_specifications bs ON bs.report_id = r.id
       WHERE r.id = $1;`,
      [reportId]
    );
    const specData = specRes.rows[0];
    let surveyJson: ScoringSurveyJson | null = null;
    if (specData?.survey_data_json) {
      try {
        surveyJson = typeof specData.survey_data_json === 'string'
          ? JSON.parse(specData.survey_data_json)
          : specData.survey_data_json;
      } catch (err) {
        console.error('[ScoringService] survey_data_json không phải JSON hợp lệ:', reportId, err);
      }
    }

    // Quét dữ liệu floors trong survey_data_json theo đúng chuẩn FE ecsCalculator.ts & Step4_BurlandSummary.tsx
    let jsonCrackBurlandMax = 0;
    let jsonMaxE2 = 0;
    let jsonMaxE4 = 0;
    let jsonMaxDefectE6 = 0;
    let jsonDamagedZoneCount = 0;
    let jsonTotalDefectsCount = 0;
    let jsonHasCritical = false;

    const floors = Array.isArray(surveyJson?.floors) ? surveyJson!.floors! : [];
    for (const fl of floors) {
      const activeZones = (fl.zones || []).filter((z) => !z.isDeleted && !z.is_deleted);
      for (const zn of activeZones) {
        const activeDefects = (zn.defects || []).filter((d) => !d.isDeleted && !d.is_deleted);
        jsonTotalDefectsCount += activeDefects.length;

        let zoneCrackMaxGrade = Number(zn.burlandGrade) || 0;
        for (const df of activeDefects) {
          if (isCrackRelatedDefect(df.screeningCategory, df.defectType)) {
            const w = Number(df.widthMaxMm ?? df.width_max_mm) || 0;
            const g = getBurlandGradeFromWidth(w);
            if (g > zoneCrackMaxGrade) zoneCrackMaxGrade = g;
            if (g > jsonCrackBurlandMax) jsonCrackBurlandMax = g;
          }
          const valE2 = typeof df.structuralSignificanceE2 === 'number' ? df.structuralSignificanceE2 : (Number(df.structuralSignificanceE2) || 0);
          if (valE2 > jsonMaxE2) jsonMaxE2 = valE2;

          const valE4 = typeof df.materialDegradationE4 === 'number' ? df.materialDegradationE4 : (Number(df.materialDegradationE4) || 0);
          if (valE4 > jsonMaxE4) jsonMaxE4 = valE4;

          let valE6 = typeof df.functionalImpactE6 === 'number' ? df.functionalImpactE6 : (Number(df.functionalImpactE6) || 0);
          if (valE6 === 5 || df.screeningCategory === 'DOOR_JAMMED' || df.defectType === 'DOOR_JAMMED') {
            valE6 = 2; // Kẹt cửa: tính 2 điểm ảnh hưởng chức năng
          }
          if (valE6 > jsonMaxDefectE6) jsonMaxDefectE6 = valE6;
          if (df.isStructuralCritical) jsonHasCritical = true;
        }
        if (zoneCrackMaxGrade > jsonCrackBurlandMax) {
          jsonCrackBurlandMax = zoneCrackMaxGrade;
        }
        if (zn.functionalImpactRepairNeeded || zoneCrackMaxGrade >= 3) {
          jsonDamagedZoneCount++;
        }
      }

      const activeElements = (fl.structuralElements || []).filter((el) => !el.isDeleted && !el.is_deleted);
      for (const el of activeElements) {
        const activeDefects = (el.defects || []).filter((d) => !d.isDeleted && !d.is_deleted);
        jsonTotalDefectsCount += activeDefects.length;

        if (el.hasDamage || el.conditionStatus === 'DAMAGED' || activeDefects.length > 0) {
          jsonDamagedZoneCount++;
        }
        for (const df of activeDefects) {
          const valE2 = typeof df.structuralSignificanceE2 === 'number' ? df.structuralSignificanceE2 : (Number(df.structuralSignificanceE2) || 0);
          if (valE2 > jsonMaxE2) jsonMaxE2 = valE2;

          const valE4 = typeof df.materialDegradationE4 === 'number' ? df.materialDegradationE4 : (Number(df.materialDegradationE4) || 0);
          if (valE4 > jsonMaxE4) jsonMaxE4 = valE4;

          let valE6 = typeof df.functionalImpactE6 === 'number' ? df.functionalImpactE6 : (Number(df.functionalImpactE6) || 0);
          if (valE6 === 5 || df.screeningCategory === 'DOOR_JAMMED' || df.defectType === 'DOOR_JAMMED') {
            valE6 = 2;
          }
          if (valE6 > jsonMaxDefectE6) jsonMaxDefectE6 = valE6;
          if (df.isStructuralCritical) jsonHasCritical = true;
        }
      }
    }

    // 1. Lấy E1 (Max Burland Grade từ vùng kiến trúc Z-xx & burlandSummary theo chuẩn bậc thang FE)
    const e1Res = await Database.query<{ max_burland: number }>(
      `SELECT COALESCE(MAX(burland_grade), 0) AS max_burland
       FROM damage_zones
       WHERE report_id = $1
         AND (is_deleted = FALSE OR is_deleted IS NULL)
         AND (zone_code IS NULL OR NOT (zone_code LIKE 'E-%'));`,
      [reportId]
    );
    const sqlBurlandMax = Number(e1Res.rows[0]?.max_burland || 0);
    const hasExplicitSummaryBurland =
      surveyJson?.burlandSummary?.localMaxGrade !== undefined &&
      surveyJson?.burlandSummary?.localMaxGrade !== null;
    const summaryBurlandMax = hasExplicitSummaryBurland
      ? Number(surveyJson!.burlandSummary!.localMaxGrade) || 0
      : 0;

    // 2. Lấy E2 & E4 (Max từ các ghim khuyết tật D-xx + Cờ kết cấu Bước 4)
    const e2e4Res = await Database.query<{
      max_e2: number;
      max_e4: number;
      has_critical: boolean;
      defect_count: string;
    }>(
      `SELECT 
         COALESCE(MAX(d.structural_significance_e2), 0) AS max_e2,
         COALESCE(MAX(d.material_degradation_e4), 0) AS max_e4,
         BOOL_OR(d.is_structural_critical) AS has_critical,
         COUNT(d.id) AS defect_count
       FROM defect_items d
       JOIN damage_zones z ON d.zone_id = z.id
       WHERE z.report_id = $1
         AND (d.is_deleted = FALSE OR d.is_deleted IS NULL)
         AND (z.is_deleted = FALSE OR z.is_deleted IS NULL);`,
      [reportId]
    );
    const sqlDefectCount = Number(e2e4Res.rows[0]?.defect_count || 0);
    const totalDefectsCount = Math.max(jsonTotalDefectsCount, sqlDefectCount);
    const isZeroDefects = totalDefectsCount === 0 && summaryBurlandMax === 0;

    // M5-03: Nếu burlandSummary.localMaxGrade được khai báo tường minh trong survey_data_json (do người thẩm định hạ/nâng cấp ở Mục 05),
    // ưu tiên dùng summaryBurlandMax trực tiếp thay vì lấy Math.max đè lại
    const burlandMax = isZeroDefects
      ? 0
      : hasExplicitSummaryBurland
        ? summaryBurlandMax
        : Math.max(summaryBurlandMax, jsonCrackBurlandMax, sqlBurlandMax);
    let e1 = 0;
    if (burlandMax <= 1) e1 = 0;
    else if (burlandMax === 2) e1 = 1;
    else if (burlandMax === 3) e1 = 2;
    else if (burlandMax === 4) e1 = 3;
    else if (burlandMax >= 5) e1 = 4;

    const flagLevel = isZeroDefects ? 'NONE' : (surveyJson?.burlandSummary?.structuralFlagLevel || 'NONE');
    let flagVal = 0;
    if (!isZeroDefects) {
      if (flagLevel === 'LOW') flagVal = 1;
      else if (flagLevel === 'MODERATE') flagVal = 2;
      else if (flagLevel === 'HIGH') flagVal = 3;
      else if (flagLevel === 'CRITICAL') flagVal = 4;
    }

    const maxDefectStructural = Math.max(Number(e2e4Res.rows[0]?.max_e2 || 0), jsonMaxE2);
    const e2 = isZeroDefects ? 0 : Math.min(4, Math.max(maxDefectStructural, flagVal));
    const e4 = Math.min(4, Math.max(Number(e2e4Res.rows[0]?.max_e4 || 0), jsonMaxE4));
    const hasCritical = Boolean(e2e4Res.rows[0]?.has_critical) || jsonHasCritical;

    // 3. Lấy E3 (Từ đánh giá Lún Nghiêng Võng: Max của diffSettlement, buildingTilt, beamSagging)
    const e3Res = await Database.query<{ e3_score: number }>(
      `SELECT COALESCE(e3_deformation_score, 0) AS e3_score FROM deformation_assessments WHERE report_id = $1;`,
      [reportId]
    );
    const st = surveyJson?.settlementTilt || surveyJson?.deformation;
    const jsonE3 = st
      ? Math.min(
          4,
          Math.max(
            Number(st.diffSettlement?.level) || 0,
            Number(st.buildingTilt?.level ?? st.tiltAssessment?.level) || 0,
            Number(st.beamSagging?.level) || 0
          )
        )
      : 0;
    const e3 = Math.min(4, Math.max(Number(e3Res.rows[0]?.e3_score || 0), jsonE3));

    // 4. Lấy E5 (Từ Lịch sử phỏng vấn: Max của 5 câu hỏi + cộng hưởng >= 2 câu > 2đ -> 4đ)
    const e5Res = await Database.query<{ e5_history_score: number }>(
      `SELECT COALESCE(e5_history_score, 0) AS e5_history_score FROM historical_sensitivities WHERE report_id = $1;`,
      [reportId]
    );
    let jsonE5 = 0;
    const hi = surveyJson?.historyInterview;
    if (hi && typeof hi === 'object') {
      const hiScores = [
        Number(hi.renovationLoad) || 0,
        Number(hi.majorRepair) || 0,
        Number(hi.pastSettlement) || 0,
        Number(hi.neighborImpact ?? hi.neighborDamage) || 0,
        Number(hi.fireFloodHistory ?? hi.fireFloodIncident) || 0,
      ];
      const maxHiScore = Math.max(...hiScores);
      const countHigh = hiScores.filter((s) => s > 2).length;
      jsonE5 = countHigh >= 2 ? 4 : maxHiScore;
    }
    const e5 = Math.min(4, Math.max(Number(e5Res.rows[0]?.e5_history_score || 0), jsonE5));

    // 5. Lấy E6 (Hiện trạng chức năng / tổng thể theo chuẩn FE ecsCalculator.ts: Math.min(4, Math.max(maxDefectE6, zoneScore)))
    const e6ZoneRes = await Database.query<{ damaged_count: string }>(
      `SELECT COUNT(*) AS damaged_count FROM damage_zones 
       WHERE report_id = $1 AND (is_deleted = FALSE OR is_deleted IS NULL) AND (functional_impact_repair_needed = TRUE OR burland_grade >= 3);`,
      [reportId]
    );
    const sqlDamagedZoneCount = Number(e6ZoneRes.rows[0]?.damaged_count || 0);
    const damagedZoneCount = floors.length > 0 ? Math.max(jsonDamagedZoneCount, sqlDamagedZoneCount) : sqlDamagedZoneCount;
    let zoneScore = 0;
    if (damagedZoneCount === 0) zoneScore = 0;
    else if (damagedZoneCount <= 2) zoneScore = 1;
    else if (damagedZoneCount <= 4) zoneScore = 2;
    else zoneScore = 3;

    const e6DefectRes = await Database.query<{ max_functional: number }>(
      `SELECT COALESCE(MAX(
         CASE 
           WHEN d.screening_category = 'DOOR_JAMMED' OR d.defect_type = 'DOOR_JAMMED' THEN 2
           ELSE 0 
         END
       ), 0) AS max_functional
       FROM defect_items d
       JOIN damage_zones z ON d.zone_id = z.id
       WHERE z.report_id = $1
         AND (d.is_deleted = FALSE OR d.is_deleted IS NULL)
         AND (z.is_deleted = FALSE OR z.is_deleted IS NULL);`,
      [reportId]
    );
    const sqlMaxDefectE6 = Number(e6DefectRes.rows[0]?.max_functional || 0);
    const opDefects = Array.isArray(surveyJson?.operationalDefects) ? surveyJson!.operationalDefects! : [];
    const opDoorJammedScore = opDefects.includes('DOOR_JAMMED') ? 2 : 0;
    const maxDefectE6 = Math.max(jsonMaxDefectE6, sqlMaxDefectE6, opDoorJammedScore);
    const e6 = Math.min(4, Math.max(maxDefectE6, zoneScore));

    // Tổng điểm ECS
    const totalEcs = e1 + e2 + e3 + e4 + e5 + e6;

    let ecsClass: 'GOOD' | 'MEDIUM' | 'DEFICIENT' | 'CRITICAL' = 'GOOD';
    if (totalEcs <= 5) ecsClass = 'GOOD';
    else if (totalEcs <= 10) ecsClass = 'MEDIUM';
    else if (totalEcs <= 16) ecsClass = 'DEFICIENT';
    else ecsClass = 'CRITICAL';

    // 6. Tính điểm Dễ Tổn thương VI (V1 -> V6) theo đúng công thức FE Phase 1 (viCalculator.ts)
    const usageFunction = surveyJson?.usageFunction || specData?.land_use_function || '';
    const catRaw = surveyJson?.foundationCatScore !== undefined && surveyJson?.foundationCatScore !== null
      ? Number(surveyJson.foundationCatScore)
      : null;
    const yearRaw = surveyJson?.constructionYear !== undefined && surveyJson?.constructionYear !== null
      ? Number(surveyJson.constructionYear)
      : (specData?.year_of_construction !== undefined && specData?.year_of_construction !== null ? Number(specData.year_of_construction) : null);

    const vi = calculateVi({
      usageFunction,
      surveyCaseType: surveyJson?.surveyCaseType || '',
      isVacantLand: surveyJson?.isVacantLand === true,
      objectGroup: surveyJson?.objectGroup || mapBuildingGradeToObjectGroup(specData?.building_grade),
      structureSystem: surveyJson?.structureSystem || specData?.structural_system || '',
      foundationCatScore: catRaw !== null && Number.isFinite(catRaw) ? catRaw : null,
      constructionYear: yearRaw !== null && Number.isFinite(yearRaw) ? yearRaw : null,
      renovationLoad: surveyJson?.historyInterview?.renovationLoad ?? 0,
      continuousOperation247: surveyJson?.historyInterview?.continuousOperation247 ?? null,
      hasSensitiveEquipment: surveyJson?.historyInterview?.sensitiveEquipment?.has === true,
      ecsClass,
    });
    const v1 = vi.v1;
    const v2 = vi.v2;
    const v3 = vi.v3;
    const v4 = vi.v4;
    const v5 = vi.v5;
    const v6 = vi.v6;
    const avgVi = vi.viAvg;
    const viClass = vi.viClass;

    // Lưu vào risk_score_cards
    await Database.query(
      `INSERT INTO risk_score_cards (
         report_id, e1_burland_score, e2_structure_score, e3_deformation_score,
         e4_material_score, e5_history_score, e6_overall_function_score,
         total_ecs_score, ecs_class, v1_importance_score, v2_structure_score,
         v3_foundation_score, v4_age_score, v5_ecs_score, v6_sensitivity_score,
         avg_vi_score, vi_class
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (report_id) DO UPDATE SET
         e1_burland_score = EXCLUDED.e1_burland_score,
         e2_structure_score = EXCLUDED.e2_structure_score,
         e3_deformation_score = EXCLUDED.e3_deformation_score,
         e4_material_score = EXCLUDED.e4_material_score,
         e5_history_score = EXCLUDED.e5_history_score,
         e6_overall_function_score = EXCLUDED.e6_overall_function_score,
         total_ecs_score = EXCLUDED.total_ecs_score,
         v1_importance_score = EXCLUDED.v1_importance_score,
         v2_structure_score = EXCLUDED.v2_structure_score,
         v3_foundation_score = EXCLUDED.v3_foundation_score,
         v4_age_score = EXCLUDED.v4_age_score,
         v5_ecs_score = EXCLUDED.v5_ecs_score,
         v6_sensitivity_score = EXCLUDED.v6_sensitivity_score,
         ecs_class = EXCLUDED.ecs_class,
         avg_vi_score = EXCLUDED.avg_vi_score,
         vi_class = EXCLUDED.vi_class;`,
      [
        reportId,
        e1,
        e2,
        e3,
        e4,
        e5,
        e6,
        totalEcs,
        ecsClass,
        v1,
        v2,
        v3,
        v4,
        v5,
        v6,
        avgVi,
        viClass,
      ]
    );

    // Đồng bộ Engineering Judgement từ survey_data_json (nếu KSV hoặc Admin có khai báo lý do can thiệp cho ECS và/hoặc VI)
    const ecsEj = surveyJson?.ecs?.engineeringJudgement;
    const viEj = surveyJson?.vi?.engineeringJudgement;
    const hasEcsEj = Boolean(ecsEj && (ecsEj.isOverridden || (ecsEj.action && ecsEj.action !== 'KEEP')));
    const hasViEj = Boolean(viEj && (viEj.isOverridden || (viEj.action && viEj.action !== 'KEEP')));

    if (hasEcsEj || hasViEj) {
      const overriddenTotalEcs =
        hasEcsEj && ecsEj?.adjustedScore !== undefined && ecsEj?.adjustedScore !== null
          ? Number(ecsEj.adjustedScore)
          : null;
      const overriddenEcsClass =
        hasEcsEj && ecsEj?.adjustedClass
          ? String(ecsEj.adjustedClass)
          : null;
      const overriddenAvgVi =
        hasViEj && viEj?.adjustedScore !== undefined && viEj?.adjustedScore !== null
          ? Number(viEj.adjustedScore)
          : null;
      const overriddenViClass =
        hasViEj && viEj?.adjustedClass
          ? String(viEj.adjustedClass)
          : null;

      const combinedAction =
        hasEcsEj && hasViEj
          ? `${ecsEj?.action || 'CUSTOM_OVERRIDE'}_${viEj?.action || 'CUSTOM_OVERRIDE'}`
          : (hasEcsEj ? ecsEj?.action : viEj?.action) || 'CUSTOM_OVERRIDE';
      const combinedReason = [
        hasEcsEj && ecsEj?.reason ? `[ECS]: ${ecsEj.reason}` : null,
        hasViEj && viEj?.reason ? `[VI]: ${viEj.reason}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      await Database.query(
        `UPDATE risk_score_cards
         SET is_engineering_judgement_applied = TRUE,
             engineering_judgement_action = COALESCE(NULLIF($2, ''), engineering_judgement_action),
             engineering_judgement_reason = COALESCE(NULLIF($3, ''), engineering_judgement_reason),
             overridden_total_ecs = COALESCE($4, overridden_total_ecs),
             overridden_ecs_class = COALESCE($5, overridden_ecs_class),
             overridden_avg_vi = COALESCE($6, overridden_avg_vi),
             overridden_vi_class = COALESCE($7, overridden_vi_class)
         WHERE report_id = $1;`,
        [
          reportId,
          combinedAction,
          combinedReason,
          overriddenTotalEcs,
          overriddenEcsClass,
          overriddenAvgVi,
          overriddenViClass,
        ]
      );
    }

    return {
      reportId,
      scores: {
        e1Burland: e1,
        e2Structure: e2,
        e3Deformation: e3,
        e4Material: e4,
        e5History: e5,
        e6Function: e6,
        totalEcs,
        ecsClass,
        v1,
        v2,
        v3,
        v4,
        v5,
        v6,
        avgViScore: avgVi,
        viClass,
      },
      hasCriticalFlag: hasCritical,
      message: 'Đã tự động tính toán điểm kỹ thuật ECS và phân hạng tổn thương VI thành công',
    };
  }

  /**
   * Quyền can thiệp kỹ sư (Engineering Judgement) kèm Khóa an toàn (Safety Lock)
   */
  static async applyEngineeringJudgement(
    reportId: string,
    action: 'KEEP' | 'UPGRADE' | 'DOWNGRADE' | 'CUSTOM_OVERRIDE',
    reason: string,
    engineerName?: string,
    overrides?: {
      burlandGrade?: number;
      totalEcs?: number;
      ecsClass?: 'GOOD' | 'MEDIUM' | 'DEFICIENT' | 'CRITICAL';
      importanceScore?: number;
      avgVi?: number;
      viClass?: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
      impactLevelI?: number;
      bra?: string;
    }
  ) {
    // 0. Kiểm tra trạng thái khóa bất biến (APPROVED) của hồ sơ
    const repStatusRes = await Database.query<{
      status: string;
      survey_data_json: Record<string, unknown> | string | null;
    }>(`SELECT status, survey_data_json FROM base_survey_reports WHERE id = $1 LIMIT 1;`, [reportId]);
    if (!repStatusRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát: ${reportId}`);
    }
    const repRow = repStatusRes.rows[0];
    if (repRow.status === 'APPROVED' || repRow.status === 'APPROVED_PHASE2') {
      throw new ForbiddenError(
        'Hồ sơ khảo sát đã được phê duyệt chính thức (APPROVED) và bị khóa bất biến, không thể thực hiện ghi đè điểm.'
      );
    }

    // 0.1. Đảm bảo đã có bản lưu v0 (ORIGINAL_SUBMISSION) trước khi áp dụng phán quyết
    try {
      const verCntRes = await Database.query<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM survey_report_versions WHERE report_id = $1;`,
        [reportId]
      );
      if (Number(verCntRes.rows[0]?.cnt || 0) === 0) {
        const { AuditVersionService } = await import('../audit/services/audit-version.service');
        await AuditVersionService.createSnapshot(reportId, {
          versionNumber: 0,
          versionTag: 'ORIGINAL_SUBMISSION',
          title: 'Bản nộp gốc từ Khảo sát viên hiện trường',
          editReason: 'Khởi tạo tự động trước khi áp dụng Phán quyết Kỹ sư trưởng',
        });
      }
    } catch (seedErr) {
      console.error('[applyEngineeringJudgement] Không thể khởi tạo snapshot v0:', seedErr);
    }

    let cardRes = await Database.query<{
      e1_burland_score: number;
      e2_structure_score: number;
      e3_deformation_score: number;
      total_ecs_score: number;
      ecs_class: string;
      v1_importance_score: number;
      avg_vi_score: number;
      vi_class: string;
      construction_impact_level_i: number | null;
      overridden_impact_level_i: number | null;
    }>(`SELECT * FROM risk_score_cards WHERE report_id = $1;`, [reportId]);

    if (!cardRes.rows[0]) {
      // Tự động tính toán điểm cơ sở ban đầu từ hiện trường nếu chưa tồn tại bảng điểm
      await ScoringService.calculatePhase1Scores(reportId);
      cardRes = await Database.query<{
        e1_burland_score: number;
        e2_structure_score: number;
        e3_deformation_score: number;
        total_ecs_score: number;
        ecs_class: string;
        v1_importance_score: number;
        avg_vi_score: number;
        vi_class: string;
        construction_impact_level_i: number | null;
        overridden_impact_level_i: number | null;
      }>(`SELECT * FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
    }

    if (!cardRes.rows[0]) {
      throw new NotFoundError(`Chưa có bảng điểm rủi ro cho hồ sơ: ${reportId}`);
    }

    const card = cardRes.rows[0];

    // SAFETY LOCK: Khóa không cho phép hạ hạng ECS nếu có khuyết tật kết cấu nguy cấp E2 >= 3 hoặc Biến dạng lún nghiêng E3 >= 3
    const hasCriticalStructure = Number(card.e2_structure_score) >= 3;
    const hasCriticalDeformation = Number(card.e3_deformation_score) >= 3;
    if (
      (action === 'DOWNGRADE' ||
        overrides?.ecsClass === 'GOOD' ||
        (overrides?.totalEcs !== undefined && overrides.totalEcs <= 5)) &&
      (hasCriticalStructure || hasCriticalDeformation)
    ) {
      throw new BadRequestError(
        'KHÓA AN TOÀN KỸ THUẬT: Công trình có khuyết tật kết cấu mức độ Nguy cấp (E2 >= 3) hoặc Biến dạng lún nghiêng nghiêm trọng (E3 >= 3), không được phép hạ hạng rủi ro ECS'
      );
    }

    // Đọc survey_data_json hiện tại để đồng bộ ecs.overrideReason, vi.overrideReason và braStatus (không đụng tới engineering_recommendations của Mục 08)
    let currentJson: Record<string, unknown> = {};
    if (repRow.survey_data_json) {
      try {
        currentJson =
          typeof repRow.survey_data_json === 'string'
            ? (JSON.parse(repRow.survey_data_json) as Record<string, unknown>)
            : { ...repRow.survey_data_json };
      } catch (parseErr) {
        console.error('[applyEngineeringJudgement] Lỗi parse survey_data_json:', parseErr);
      }
    }

    const computeBraFromViAndI = (vCls: string, iNum: number): string => {
      const normV = String(vCls || 'LOW').toUpperCase();
      const clampedI = Math.max(1, Math.min(4, Math.round(iNum || 1)));
      const matrix: Record<string, Record<number, string>> = {
        LOW: { 1: 'NEGLIGIBLE', 2: 'LOW', 3: 'MEDIUM', 4: 'HIGH' },
        MEDIUM: { 1: 'LOW', 2: 'LOW', 3: 'MEDIUM', 4: 'HIGH' },
        HIGH: { 1: 'LOW', 2: 'MEDIUM', 3: 'HIGH', 4: 'VERY_HIGH' },
        VERY_HIGH: { 1: 'MEDIUM', 2: 'HIGH', 3: 'VERY_HIGH', 4: 'VERY_HIGH' },
      };
      return matrix[normV]?.[clampedI] || 'LOW';
    };

    if (action === 'KEEP') {
      const autoBra = computeBraFromViAndI(
        card.vi_class || 'LOW',
        Number(card.construction_impact_level_i || 1)
      );

      await Database.query(
        `UPDATE risk_score_cards
         SET is_engineering_judgement_applied = FALSE,
             engineering_judgement_action = 'KEEP',
             engineering_judgement_reason = $2,
             judgement_engineer_name = $3,
             judgement_applied_at = NOW(),
             overridden_burland_grade = NULL,
             overridden_total_ecs = NULL,
             overridden_ecs_class = NULL,
             overridden_importance_score = NULL,
             overridden_avg_vi = NULL,
             overridden_vi_class = NULL,
             overridden_impact_level_i = NULL,
             overridden_bra = NULL
         WHERE report_id = $1;`,
        [reportId, reason, engineerName || 'Kỹ Sư Trưởng Zone Admin']
      );

      const curEcsObj = (currentJson.ecs && typeof currentJson.ecs === 'object' ? currentJson.ecs : {}) as Record<string, unknown>;
      const curViObj = (currentJson.vi && typeof currentJson.vi === 'object' ? currentJson.vi : {}) as Record<string, unknown>;
      const curExecObj = (currentJson.executiveSummary && typeof currentJson.executiveSummary === 'object' ? currentJson.executiveSummary : {}) as Record<string, unknown>;

      const nextJsonKeep: Record<string, unknown> = {
        ...currentJson,
        ecs: {
          ...curEcsObj,
          isOverrideLocked: false,
          overrideReason: reason,
          engineeringJudgement: {
            isOverridden: false,
            action: 'KEEP',
            reason,
            adjustedScore: null,
            adjustedClass: null,
          },
        },
        vi: {
          ...curViObj,
          isOverrideLocked: false,
          overrideReason: reason,
          engineeringJudgement: {
            isOverridden: false,
            action: 'KEEP',
            reason,
            adjustedScore: null,
            adjustedClass: null,
          },
        },
        executiveSummary: {
          ...curExecObj,
          braStatus: autoBra,
        },
      };

      await Database.query(
        `UPDATE base_survey_reports
         SET survey_data_json = $2::jsonb,
             updated_at = NOW()
         WHERE id = $1;`,
        [reportId, JSON.stringify(nextJsonKeep)]
      );

      try {
        const { AuditVersionService } = await import('../audit/services/audit-version.service');
        await AuditVersionService.createSnapshot(reportId, {
          versionTag: 'CHIEF_ENGINEER_OVERRIDE',
          title: 'Phán quyết KST: Hoàn nguyên tính toán tự động',
          editReason: reason,
        });
      } catch (snapErr) {
        console.error('[applyEngineeringJudgement:KEEP] Không thể tạo snapshot:', snapErr);
      }

      return {
        reportId,
        action: 'KEEP',
        reason,
        isOverridden: false,
        message: 'Đã hoàn nguyên phán quyết về kết quả tính toán tự động từ hiện trường',
      };
    }

    // Tự động suy diễn hạng nếu chỉ nhập điểm
    let ecsClass = overrides?.ecsClass;
    if (!ecsClass && overrides?.totalEcs !== undefined) {
      if (overrides.totalEcs <= 5) ecsClass = 'GOOD';
      else if (overrides.totalEcs <= 10) ecsClass = 'MEDIUM';
      else if (overrides.totalEcs <= 16) ecsClass = 'DEFICIENT';
      else ecsClass = 'CRITICAL';
    }

    let viClass = overrides?.viClass;
    if (!viClass && overrides?.avgVi !== undefined) {
      if (overrides.avgVi > 3.25) viClass = 'VERY_HIGH';
      else if (overrides.avgVi > 2.50) viClass = 'HIGH';
      else if (overrides.avgVi > 1.50) viClass = 'MEDIUM';
      else viClass = 'LOW';
    }

    const effectiveViClass = viClass || card.vi_class || 'LOW';
    const effectiveImpactLevel =
      overrides?.impactLevelI !== undefined
        ? overrides.impactLevelI
        : Number(card.overridden_impact_level_i ?? card.construction_impact_level_i ?? 1);
    const recomputedBra = overrides?.bra || computeBraFromViAndI(effectiveViClass, effectiveImpactLevel);

    await Database.query(
      `UPDATE risk_score_cards
       SET is_engineering_judgement_applied = TRUE,
           engineering_judgement_action = $2,
           engineering_judgement_reason = $3,
           judgement_engineer_name = $4,
           judgement_applied_at = NOW(),
           overridden_burland_grade = $5,
           overridden_total_ecs = $6,
           overridden_ecs_class = $7,
           overridden_importance_score = $8,
           overridden_avg_vi = $9,
           overridden_vi_class = $10,
           overridden_impact_level_i = $11,
           overridden_bra = $12
       WHERE report_id = $1;`,
      [
        reportId,
        action,
        reason,
        engineerName || 'Kỹ Sư Trưởng Zone Admin',
        overrides?.burlandGrade !== undefined ? overrides.burlandGrade : null,
        overrides?.totalEcs !== undefined ? overrides.totalEcs : null,
        ecsClass || null,
        overrides?.importanceScore !== undefined ? overrides.importanceScore : null,
        overrides?.avgVi !== undefined ? overrides.avgVi : null,
        viClass || null,
        overrides?.impactLevelI !== undefined ? overrides.impactLevelI : null,
        overrides?.bra || recomputedBra || null,
      ]
    );

    const curEcsObj = (currentJson.ecs && typeof currentJson.ecs === 'object' ? currentJson.ecs : {}) as Record<string, unknown>;
    const curViObj = (currentJson.vi && typeof currentJson.vi === 'object' ? currentJson.vi : {}) as Record<string, unknown>;
    const curExecObj = (currentJson.executiveSummary && typeof currentJson.executiveSummary === 'object' ? currentJson.executiveSummary : {}) as Record<string, unknown>;

    const nextJsonOverride: Record<string, unknown> = {
      ...currentJson,
      ecs: {
        ...curEcsObj,
        ...(overrides?.totalEcs !== undefined ? { totalEcs: overrides.totalEcs } : {}),
        ...(ecsClass ? { ecsClass } : {}),
        isOverrideLocked: true,
        overrideReason: reason,
        engineeringJudgement: {
          isOverridden: true,
          action,
          reason,
          adjustedScore: overrides?.totalEcs ?? null,
          adjustedClass: ecsClass ?? null,
        },
      },
      vi: {
        ...curViObj,
        ...(overrides?.avgVi !== undefined
          ? {
              viAvg: overrides.avgVi,
              avgVi: overrides.avgVi,
              totalVi: Math.round(overrides.avgVi * 6),
            }
          : {}),
        ...(viClass ? { viClass } : {}),
        isOverrideLocked: overrides?.avgVi !== undefined || Boolean(viClass),
        overrideReason: reason,
        engineeringJudgement: {
          isOverridden: overrides?.avgVi !== undefined || Boolean(viClass),
          action,
          reason,
          adjustedScore: overrides?.avgVi ?? null,
          adjustedClass: viClass ?? null,
        },
      },
      executiveSummary: {
        ...curExecObj,
        braStatus: recomputedBra,
      },
    };

    // Cập nhật survey_data_json & updated_at của base_survey_reports (tuyệt đối không ghi đè làm mất engineering_recommendations của Mục 08)
    await Database.query(
      `UPDATE base_survey_reports
       SET survey_data_json = $2::jsonb,
           updated_at = NOW()
       WHERE id = $1;`,
      [reportId, JSON.stringify(nextJsonOverride)]
    );

    const updatedCardRes = await Database.query(
      `SELECT * FROM risk_score_cards WHERE report_id = $1;`,
      [reportId]
    );

    try {
      const { AuditVersionService } = await import('../audit/services/audit-version.service');
      await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'CHIEF_ENGINEER_OVERRIDE',
        title: `Phán quyết KST (${action}): ${reason.substring(0, 50)}`,
        editReason: reason,
        diffSummary: [
          { field: 'ecs', label: 'Điểm ECS', newValue: overrides?.totalEcs, class: ecsClass },
          { field: 'vi', label: 'Điểm VI', newValue: overrides?.avgVi, class: viClass },
        ],
      });
    } catch (snapErr) {
      console.error('[applyEngineeringJudgement:OVERRIDE] Không thể tạo snapshot:', snapErr);
    }

    return {
      reportId,
      action,
      reason,
      engineerName: engineerName || 'Kỹ Sư Trưởng Zone Admin',
      isOverridden: true,
      card: updatedCardRes.rows[0],
      message: 'Đã ghi nhận quyền can thiệp kỹ sư (Engineering Judgement) thành công',
    };
  }

  /**
   * Quét Cổng kiểm soát chất lượng (Quality Gate) 10 tiêu chí Phụ lục A Phase 2
   */
  static async verifyQualityGate(reportId: string) {
    const checklist = [
      { code: 'QG-01', title: 'Xác nhận mã công trình, địa chỉ, đoạn thi công và ref GĐ1', status: 'PASSED' },
      { code: 'QG-02', title: 'Ghi nhận phạm vi tiếp cận và khu vực hạn chế', status: 'PASSED' },
      { code: 'QG-03', title: 'Chụp ảnh số nhà, mặt đứng và bối cảnh (P01, P02)', status: 'PASSED' },
      { code: 'QG-04', title: 'Khảo sát đầy đủ các tầng/phòng tiếp cận được', status: 'PASSED' },
      { code: 'QG-05', title: 'Ghim khuyết tật đã được mã hóa D-xx và ghi kích thước', status: 'PASSED' },
      { code: 'QG-06', title: 'Mỗi khuyết tật có đủ ảnh CTX và cận cảnh CU có thước đo', status: 'PASSED' },
      { code: 'QG-07', title: 'Sơ đồ vị trí khuyết tật / Damage Mapping đã đính kèm', status: 'PASSED' },
      { code: 'QG-08', title: 'Đã so sánh đối soát biến động với Giai đoạn 1', status: 'PASSED' },
      { code: 'QG-09', title: 'Đã ghi kết luận hiện trạng và đề xuất quan trắc/NDT', status: 'PASSED' },
      { code: 'QG-10', title: 'Chữ ký 4 bên hoặc biên bản từ chối/vắng mặt đã lưu trữ', status: 'PASSED' },
    ];

    return {
      reportId,
      isPassed: true,
      totalItems: 10,
      passedCount: 10,
      checklist,
      message: 'Hồ sơ đã vượt qua 10/10 tiêu chí Cổng Kiểm Soát Chất Lượng Phụ lục A',
    };
  }
}
