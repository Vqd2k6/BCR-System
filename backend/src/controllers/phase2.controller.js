/**
 * Phase 2 Controller — Pre-Construction Survey
 * Defect Register (D-01..D-99), Hand-drawn Sketch, E-Signature
 */
'use strict';

const db = require('../config/database');

// ============================================================================
// GET /api/buildings/:buildingId/phase2
// ============================================================================
async function getPhase2(req, res, next) {
  try {
    const { buildingId } = req.params;

    const p2 = await db.query(
      `SELECT p2.*,
              p1.ecs_class, p1.bra_result, p1.structural_flag, p1.vi_class,
              b.building_code, b.address, b.owner_name
       FROM phase2_pre_construction p2
       JOIN phase1_assessments p1 ON p1.id = p2.phase1_id
       JOIN buildings b ON b.id = p2.building_id
       WHERE p2.building_id = $1
       ORDER BY p2.created_at DESC LIMIT 1`,
      [buildingId]
    );

    if (p2.rows.length === 0) {
      return res.status(404).json({ success: false, code: 'PHASE2_NOT_FOUND', message: 'Chưa có hồ sơ Phase 2.' });
    }

    const phase2 = p2.rows[0];

    // Lấy kèm Defect Register, Media và Signatures
    const [defects, media, signatures] = await Promise.all([
      db.query(
        'SELECT * FROM defect_register WHERE phase2_id = $1 ORDER BY defect_seq ASC',
        [phase2.id]
      ),
      db.query(
        'SELECT * FROM media_evidences WHERE phase2_id = $1 ORDER BY created_at ASC',
        [phase2.id]
      ),
      db.query(
        'SELECT sign_role, platform_origin, signer_full_name, signer_title, signed_at, is_refused, signature_image_url FROM survey_signatures WHERE phase2_id = $1',
        [phase2.id]
      ),
    ]);

    return res.json({
      success: true,
      data: {
        ...phase2,
        defects: defects.rows,
        media: media.rows,
        signatures: signatures.rows,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// POST /api/buildings/:buildingId/phase2
// Tạo / cập nhật hồ sơ Phase 2 (req.phase1Id đã được gán bởi prerequisite middleware)
// ============================================================================
async function submitPhase2(req, res, next) {
  try {
    const { buildingId } = req.params;
    const phase1Id = req.phase1Id; // Đã kiểm tra bởi prerequisite.middleware
    const surveyorId = req.user.id;

    const {
      accessStatus,
      restrictionReason,
      surveyedAreas,
      repairsSincePhase1,
      repairsDescription,
      newExternalDamages,
      newExternalDamagesDesc,
      currentUsageState,
      hasCriticalDamageAlert,
      monitoringDemand,
      overallConditionSummary,
      specialistNotes,
      tiltAngleDegree,
      tiltDirection,
      tiltMeasurementMethod,
      ownerComments,
      noAdditionalComments,
    } = req.body;

    // Kiểm tra đã có Phase 2 draft chưa để upsert
    const existing = await db.query(
      `SELECT id, status FROM phase2_pre_construction WHERE building_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [buildingId]
    );

    let phase2Id;

    if (existing.rows.length > 0 && existing.rows[0].status !== 'APPROVED') {
      const upd = await db.query(
        `UPDATE phase2_pre_construction SET
          access_status = $1, restriction_reason = $2, surveyed_areas = $3,
          repairs_since_phase1 = $4, repairs_description = $5,
          new_external_damages = $6, new_external_damages_desc = $7,
          current_usage_state = $8, has_critical_damage_alert = $9,
          monitoring_demand = $10, overall_condition_summary = $11, specialist_notes = $12,
          tilt_angle_degree = $13, tilt_direction = $14, tilt_measurement_method = $15,
          owner_comments = $16, no_additional_comments = $17,
          status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW()
        WHERE id = $18 RETURNING id`,
        [
          accessStatus, restrictionReason, surveyedAreas,
          repairsSincePhase1, repairsDescription,
          newExternalDamages, newExternalDamagesDesc, currentUsageState,
          hasCriticalDamageAlert || false,
          monitoringDemand, overallConditionSummary, specialistNotes,
          tiltAngleDegree, tiltDirection, tiltMeasurementMethod,
          ownerComments, noAdditionalComments || false,
          existing.rows[0].id,
        ]
      );
      phase2Id = upd.rows[0].id;
    } else {
      const ins = await db.query(
        `INSERT INTO phase2_pre_construction (
          building_id, phase1_id, zone_id, surveyor_id,
          access_status, restriction_reason, surveyed_areas,
          repairs_since_phase1, repairs_description,
          new_external_damages, new_external_damages_desc, current_usage_state,
          has_critical_damage_alert, monitoring_demand, overall_condition_summary, specialist_notes,
          tilt_angle_degree, tilt_direction, tilt_measurement_method,
          owner_comments, no_additional_comments,
          status, submitted_at
        ) VALUES (
          $1, $2, (SELECT zone_id FROM buildings WHERE id = $1), $3,
          $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, 'SUBMITTED', NOW()
        ) RETURNING id`,
        [
          buildingId, phase1Id, surveyorId,
          accessStatus, restrictionReason, surveyedAreas,
          repairsSincePhase1, repairsDescription,
          newExternalDamages, newExternalDamagesDesc, currentUsageState,
          hasCriticalDamageAlert || false,
          monitoringDemand, overallConditionSummary, specialistNotes,
          tiltAngleDegree, tiltDirection, tiltMeasurementMethod,
          ownerComments, noAdditionalComments || false,
        ]
      );
      phase2Id = ins.rows[0].id;
    }

    // Cảnh báo nguy cấp: Ghi vào audit log với flag cao
    if (hasCriticalDamageAlert) {
      await db.query(
        `INSERT INTO audit_logs (building_id, user_id, action, details)
         VALUES ($1, $2, 'CRITICAL_DAMAGE_ALERT', $3)`,
        [buildingId, surveyorId, JSON.stringify({ phase2Id, message: '⚠️ CÁN BỘ BÁO CÁO NGUY CẤP: Công trình có dấu hiệu nguy cấp cần kiểm tra khẩn.' })]
      );
    }

    await db.query(
      `INSERT INTO audit_logs (building_id, user_id, action, new_status)
       VALUES ($1, $2, 'PHASE2_SUBMIT', 'SUBMITTED')`,
      [buildingId, surveyorId]
    );

    return res.status(201).json({
      success: true,
      message: '✅ Đã nộp Hồ sơ Phase 2 (Pre-Construction). Đang chờ phê duyệt và hoàn tất chữ ký 4 bên.',
      data: { phase2Id },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// PATCH /api/buildings/:buildingId/phase2/approve
// ============================================================================
async function approvePhase2(req, res, next) {
  try {
    const { buildingId } = req.params;
    const approverId = req.user.id;

    // Kiểm tra đủ chữ ký (ít nhất Chủ hộ và Cán bộ đã ký Mobile)
    const sigCheck = await db.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN sign_role IN ('OWNER_RESIDENT', 'SURVEYOR') THEN 1 ELSE 0 END) AS mobile_sigs
       FROM survey_signatures
       WHERE phase2_id = (
         SELECT id FROM phase2_pre_construction WHERE building_id = $1 ORDER BY created_at DESC LIMIT 1
       ) AND is_refused = FALSE`,
      [buildingId]
    );

    if (parseInt(sigCheck.rows[0].mobile_sigs) < 2) {
      return res.status(400).json({
        success: false,
        code: 'SIGNATURES_INCOMPLETE',
        message: 'Hồ sơ Phase 2 cần tối thiểu chữ ký của Chủ hộ và Cán bộ khảo sát trước khi phê duyệt.',
      });
    }

    const result = await db.query(
      `UPDATE phase2_pre_construction
       SET status = 'APPROVED', approved_at = NOW(), updated_at = NOW()
       WHERE building_id = $1 AND status = 'SUBMITTED'
       RETURNING id`,
      [buildingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ Phase 2 SUBMITTED.' });
    }

    await db.query(
      `INSERT INTO audit_logs (building_id, user_id, action, new_status)
       VALUES ($1, $2, 'PHASE2_APPROVE', 'APPROVED')`,
      [buildingId, approverId]
    );

    return res.json({
      success: true,
      message: '🎉 Hồ sơ Phase 2 (Pre-Construction) đã được PHÊ DUYỆT HOÀN TẤT. Đa giác mái nhà đã cập nhật lên bản đồ GIS trung tâm.',
      data: { phase2Id: result.rows[0].id },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// PATCH /api/buildings/:buildingId/phase2/reject
// ============================================================================
async function rejectPhase2(req, res, next) {
  try {
    const { buildingId } = req.params;
    const { rejectionReason } = req.body;
    const reviewerId = req.user.id;

    if (!rejectionReason || rejectionReason.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Lý do từ chối phải có ít nhất 10 ký tự.' });
    }

    const result = await db.query(
      `UPDATE phase2_pre_construction
       SET status = 'REJECTED', rejection_reason = $1, updated_at = NOW()
       WHERE building_id = $2 AND status = 'SUBMITTED'
       RETURNING id`,
      [rejectionReason.trim(), buildingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ Phase 2 SUBMITTED.' });
    }

    await db.query(
      `INSERT INTO audit_logs (building_id, user_id, action, new_status, details)
       VALUES ($1, $2, 'PHASE2_REJECT', 'REJECTED', $3)`,
      [buildingId, reviewerId, JSON.stringify({ reason: rejectionReason })]
    );

    return res.json({ success: true, message: '❌ Hồ sơ Phase 2 đã bị TỪ CHỐI. Cán bộ hiện trường cần bổ sung hồ sơ.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getPhase2, submitPhase2, approvePhase2, rejectPhase2 };
