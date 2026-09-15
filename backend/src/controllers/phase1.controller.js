/**
 * Phase 1 Controller — BCS / ECS / BRA Assessment
 * Quản lý toàn bộ vòng đời Hồ sơ Khảo sát Nền (Phase 1).
 */
'use strict';

const db = require('../config/database');
const assessmentService = require('../services/assessment.service');

// ============================================================================
// GET /api/buildings/:buildingId/phase1
// Lấy hồ sơ Phase 1 mới nhất của công trình
// ============================================================================
async function getPhase1(req, res, next) {
  try {
    const { buildingId } = req.params;

    const result = await db.query(
      `SELECT p1.*, 
              b.building_code, b.address, b.owner_name, b.owner_phone,
              b.foundation_cat, b.distance_to_metro_m, b.chainage_km,
              u_s.full_name AS surveyor_name,
              u_a.full_name AS approver_name
       FROM phase1_assessments p1
       JOIN buildings b ON b.id = p1.building_id
       LEFT JOIN users u_s ON u_s.id = p1.surveyor_id
       LEFT JOIN users u_a ON u_a.id = p1.approver_id
       WHERE p1.building_id = $1
       ORDER BY p1.created_at DESC
       LIMIT 1`,
      [buildingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'PHASE1_NOT_FOUND',
        message: 'Công trình này chưa có hồ sơ Phase 1.',
      });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// POST /api/buildings/:buildingId/phase1
// Surveyor nộp hồ sơ Phase 1 (ECS + VI + BRA sơ bộ)
// ============================================================================
async function submitPhase1(req, res, next) {
  try {
    const { buildingId } = req.params;
    const surveyorId = req.user.id;

    const {
      // Mục 2: Phạm vi
      surveyedScope,
      hasAccessRestriction,
      accessRestrictionNotes,

      // Mục 3: Lịch sử & Nhạy cảm
      hasExtensionsLoadChange,
      hasMajorRepairs,
      hasPriorSettlementTilt,
      hasAdjacentConstructionDamage,
      hasFireFloodIncidents,
      hasSensitiveEquipment,
      sensitiveEquipmentNotes,
      occupancyStatus,

      // Mục 4: BCS Sàng lọc
      bcsScreeningResults,

      // Mục 9: Burland
      burlandPredominant,
      burlandLocalMax,

      // Mục 11: ECS (E1-E6)
      e1StructuralCracks,
      e2WallMasonryCracks,
      e3DeformationTilt,
      e4WaterSeepageDet,
      e5HistoryIntegrity,
      e6FunctionalityState,

      // Mục 13: VI inputs (V3 và V5 được tự động tính)
      v1UseConsequence,
      v2StructuralFragility,
      v4AgeModifications,
      v6SensitiveEquipment,

      // Mục 14: Tác động thi công (nếu có)
      metroStructureType,
      predictedSettlementSmaxMm,
      predictedAngularDistortion,
      predictedVibrationPpvMms,
      constructionImpactClass = 'PENDING',
    } = req.body;

    // === Tính toán tự động ECS + VI + BRA ===
    const assessment = assessmentService.runFullPhase1Assessment({
      e1: e1StructuralCracks || 0,
      e2: e2WallMasonryCracks || 0,
      e3: e3DeformationTilt || 0,
      e4: e4WaterSeepageDet || 0,
      e5: e5HistoryIntegrity || 0,
      e6: e6FunctionalityState || 0,
      v1: v1UseConsequence,
      v2: v2StructuralFragility,
      foundationCat: (await db.query('SELECT foundation_cat FROM buildings WHERE id = $1', [buildingId])).rows[0]?.foundation_cat || 5,
      v4: v4AgeModifications,
      v6: v6SensitiveEquipment,
      impactClass: constructionImpactClass,
    });

    // Kiểm tra đã có Phase 1 draft chưa để upsert
    const existingResult = await db.query(
      'SELECT id FROM phase1_assessments WHERE building_id = $1 ORDER BY created_at DESC LIMIT 1',
      [buildingId]
    );

    let phase1Id;

    if (existingResult.rows.length > 0) {
      // UPDATE nếu đã có và chưa APPROVED
      const upd = await db.query(
        `UPDATE phase1_assessments SET
          surveyor_id = $1,
          status = 'SUBMITTED',
          surveyed_scope = $2,
          has_access_restriction = $3,
          access_restriction_notes = $4,
          has_extensions_load_change = $5,
          has_major_repairs = $6,
          has_prior_settlement_tilt = $7,
          has_adjacent_construction_damage = $8,
          has_fire_flood_incidents = $9,
          has_sensitive_equipment = $10,
          sensitive_equipment_notes = $11,
          occupancy_status = $12,
          bcs_screening_results = $13,
          burland_predominant = $14,
          burland_local_max = $15,
          e1_structural_cracks = $16,
          e2_wall_masonry_cracks = $17,
          e3_deformation_tilt = $18,
          e4_water_seepage_deterioration = $19,
          e5_history_integrity = $20,
          e6_functionality_state = $21,
          v1_use_consequence = $22,
          v2_structural_fragility = $23,
          v4_age_modifications = $24,
          v6_sensitive_equipment = $25,
          metro_structure_type = $26,
          predicted_settlement_smax_mm = $27,
          predicted_angular_distortion = $28,
          predicted_vibration_ppv_mms = $29,
          construction_impact_class = $30,
          bra_result = $31,
          recommended_action = $32,
          submitted_at = NOW(),
          updated_at = NOW()
        WHERE id = $33 AND status != 'APPROVED'
        RETURNING id`,
        [
          surveyorId,
          surveyedScope, hasAccessRestriction, accessRestrictionNotes,
          hasExtensionsLoadChange, hasMajorRepairs, hasPriorSettlementTilt,
          hasAdjacentConstructionDamage, hasFireFloodIncidents,
          hasSensitiveEquipment, sensitiveEquipmentNotes, occupancyStatus,
          JSON.stringify(bcsScreeningResults || {}),
          burlandPredominant || 0, burlandLocalMax || 0,
          e1StructuralCracks || 0, e2WallMasonryCracks || 0, e3DeformationTilt || 0,
          e4WaterSeepageDet || 0, e5HistoryIntegrity || 0, e6FunctionalityState || 0,
          v1UseConsequence, v2StructuralFragility, v4AgeModifications, v6SensitiveEquipment,
          metroStructureType, predictedSettlementSmaxMm, predictedAngularDistortion, predictedVibrationPpvMms,
          constructionImpactClass, assessment.braResult, assessment.recommendedAction,
          existingResult.rows[0].id,
        ]
      );
      phase1Id = upd.rows[0]?.id || existingResult.rows[0].id;
    } else {
      // INSERT mới
      const ins = await db.query(
        `INSERT INTO phase1_assessments (
          building_id, zone_id, surveyor_id, status,
          surveyed_scope, has_access_restriction, access_restriction_notes,
          has_extensions_load_change, has_major_repairs, has_prior_settlement_tilt,
          has_adjacent_construction_damage, has_fire_flood_incidents,
          has_sensitive_equipment, sensitive_equipment_notes, occupancy_status,
          bcs_screening_results, burland_predominant, burland_local_max,
          e1_structural_cracks, e2_wall_masonry_cracks, e3_deformation_tilt,
          e4_water_seepage_deterioration, e5_history_integrity, e6_functionality_state,
          v1_use_consequence, v2_structural_fragility, v4_age_modifications, v6_sensitive_equipment,
          metro_structure_type, predicted_settlement_smax_mm, predicted_angular_distortion,
          predicted_vibration_ppv_mms, construction_impact_class, bra_result, recommended_action,
          submitted_at
        ) VALUES (
          $1, (SELECT zone_id FROM buildings WHERE id = $1), $2, 'SUBMITTED',
          $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
          $27, $28, $29, $30, $31, $32, $33, NOW()
        ) RETURNING id`,
        [
          buildingId, surveyorId,
          surveyedScope, hasAccessRestriction, accessRestrictionNotes,
          hasExtensionsLoadChange, hasMajorRepairs, hasPriorSettlementTilt,
          hasAdjacentConstructionDamage, hasFireFloodIncidents,
          hasSensitiveEquipment, sensitiveEquipmentNotes, occupancyStatus,
          JSON.stringify(bcsScreeningResults || {}),
          burlandPredominant || 0, burlandLocalMax || 0,
          e1StructuralCracks || 0, e2WallMasonryCracks || 0, e3DeformationTilt || 0,
          e4WaterSeepageDet || 0, e5HistoryIntegrity || 0, e6FunctionalityState || 0,
          v1UseConsequence, v2StructuralFragility, v4AgeModifications, v6SensitiveEquipment,
          metroStructureType, predictedSettlementSmaxMm, predictedAngularDistortion, predictedVibrationPpvMms,
          constructionImpactClass, assessment.braResult, assessment.recommendedAction,
        ]
      );
      phase1Id = ins.rows[0].id;
    }

    // Log audit
    await db.query(
      `INSERT INTO audit_logs (building_id, user_id, action, new_status, details)
       VALUES ($1, $2, 'PHASE1_SUBMIT', 'SUBMITTED', $3)`,
      [buildingId, surveyorId, JSON.stringify(assessment)]
    );

    return res.status(201).json({
      success: true,
      message: `✅ Đã nộp Hồ sơ Khảo sát Phase 1. ECS = ${assessment.ecsTotal}/24 (${assessment.ecsClass}) | BRA = ${assessment.braResult}`,
      data: { phase1Id, assessment },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// PATCH /api/buildings/:buildingId/phase1/approve
// Zone Manager phê duyệt Phase 1
// ============================================================================
async function approvePhase1(req, res, next) {
  try {
    const { buildingId } = req.params;
    const approverId = req.user.id;

    const result = await db.query(
      `UPDATE phase1_assessments
       SET status = 'APPROVED', approver_id = $1, approved_at = NOW(), updated_at = NOW()
       WHERE building_id = $2 AND status = 'SUBMITTED'
       RETURNING id, ecs_class, bra_result, structural_flag`,
      [approverId, buildingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hồ sơ Phase 1 ở trạng thái SUBMITTED để phê duyệt.',
      });
    }

    const { id, ecs_class, bra_result, structural_flag } = result.rows[0];

    await db.query(
      `INSERT INTO audit_logs (building_id, user_id, action, new_status, details)
       VALUES ($1, $2, 'PHASE1_APPROVE', 'APPROVED', $3)`,
      [buildingId, approverId, JSON.stringify({ ecsClass: ecs_class, braResult: bra_result, structuralFlag: structural_flag })]
    );

    return res.json({
      success: true,
      message: `🎉 Hồ sơ Phase 1 đã được PHÊ DUYỆT. Công trình này hiện có thể tiến hành khảo sát Phase 2.`,
      data: { phase1Id: id, ecsClass: ecs_class, braResult: bra_result, structuralFlag: structural_flag },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// PATCH /api/buildings/:buildingId/phase1/reject
// Zone Manager từ chối Phase 1
// ============================================================================
async function rejectPhase1(req, res, next) {
  try {
    const { buildingId } = req.params;
    const { rejectionReason } = req.body;
    const reviewerId = req.user.id;

    if (!rejectionReason || rejectionReason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp lý do từ chối chi tiết (tối thiểu 10 ký tự).',
      });
    }

    const result = await db.query(
      `UPDATE phase1_assessments
       SET status = 'REJECTED', rejection_reason = $1, updated_at = NOW()
       WHERE building_id = $2 AND status = 'SUBMITTED'
       RETURNING id`,
      [rejectionReason.trim(), buildingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ Phase 1 SUBMITTED để từ chối.' });
    }

    await db.query(
      `INSERT INTO audit_logs (building_id, user_id, action, new_status, details)
       VALUES ($1, $2, 'PHASE1_REJECT', 'REJECTED', $3)`,
      [buildingId, reviewerId, JSON.stringify({ reason: rejectionReason })]
    );

    return res.json({
      success: true,
      message: '❌ Hồ sơ Phase 1 đã bị TỪ CHỐI. Thông báo đã được gửi về cho cán bộ hiện trường.',
      data: { phase1Id: result.rows[0].id, rejectionReason },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getPhase1, submitPhase1, approvePhase1, rejectPhase1 };
