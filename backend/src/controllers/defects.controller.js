/**
 * Defect Register Controller — D-01..D-99
 * CRUD sổ khuyết tật chi tiết, ghim điểm trên ảnh bản vẽ vẽ tay, so sánh Delta
 */
'use strict';

const db = require('../config/database');

// GET /api/buildings/:buildingId/phase2/defects
async function listDefects(req, res, next) {
  try {
    const { buildingId } = req.params;
    const result = await db.query(
      `SELECT d.*, 
              me_ctx.public_url AS ctx_photo_url,
              me_cu.public_url AS cu_photo_url
       FROM defect_register d
       LEFT JOIN media_evidences me_ctx ON me_ctx.defect_id = d.id AND me_ctx.photo_type = 'DEFECT_CTX'
       LEFT JOIN media_evidences me_cu ON me_cu.defect_id = d.id AND me_cu.photo_type = 'DEFECT_CU_RULER'
       WHERE d.building_id = $1
       ORDER BY d.defect_seq ASC`,
      [buildingId]
    );
    return res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) { next(error); }
}

// POST /api/buildings/:buildingId/phase2/defects
async function addDefect(req, res, next) {
  try {
    const { buildingId } = req.params;

    const {
      phase2Id,
      floorName,
      roomOrZone,
      structuralElement,
      elementMaterial,
      defectType,
      burlandGrade,
      maxCrackWidthMm,
      crackLengthM,
      crackDirection,
      activityStatus,
      comparisonWithPhase1,
      phase1WidthMm,
      phase1LengthM,
      sketchPinXPercent,
      sketchPinYPercent,
      defectNotes,
    } = req.body;

    // Validate bắt buộc
    if (!phase2Id || !floorName || !roomOrZone || !structuralElement || !defectType || !comparisonWithPhase1) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: phase2Id, floorName, roomOrZone, structuralElement, defectType, comparisonWithPhase1.',
      });
    }

    // Tính mã D-xx tự động
    const seqResult = await db.query(
      'SELECT COUNT(*) AS cnt FROM defect_register WHERE phase2_id = $1',
      [phase2Id]
    );
    const nextSeq = parseInt(seqResult.rows[0].cnt) + 1;
    const defectCode = `D-${String(nextSeq).padStart(2, '0')}`;

    const result = await db.query(
      `INSERT INTO defect_register (
        phase2_id, building_id, defect_code, defect_seq,
        floor_name, room_or_zone, structural_element, element_material,
        defect_type, burland_grade, max_crack_width_mm, crack_length_m,
        crack_direction, activity_status, comparison_with_phase1,
        phase1_width_mm, phase1_length_m,
        sketch_pin_x_percent, sketch_pin_y_percent, defect_notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [
        phase2Id, buildingId, defectCode, nextSeq,
        floorName, roomOrZone, structuralElement, elementMaterial,
        defectType, burlandGrade, maxCrackWidthMm, crackLengthM,
        crackDirection, activityStatus || 'UNKNOWN', comparisonWithPhase1,
        phase1WidthMm, phase1LengthM,
        sketchPinXPercent, sketchPinYPercent, defectNotes,
      ]
    );

    return res.status(201).json({
      success: true,
      message: `✅ Đã ghi nhận khuyết tật mới: ${defectCode}`,
      data: result.rows[0],
    });
  } catch (error) { next(error); }
}

// PATCH /api/buildings/:buildingId/phase2/defects/:defectId
async function updateDefect(req, res, next) {
  try {
    const { defectId } = req.params;
    const {
      maxCrackWidthMm, crackLengthM, crackDirection, activityStatus,
      comparisonWithPhase1, sketchPinXPercent, sketchPinYPercent, defectNotes,
    } = req.body;

    const result = await db.query(
      `UPDATE defect_register SET
        max_crack_width_mm = COALESCE($1, max_crack_width_mm),
        crack_length_m = COALESCE($2, crack_length_m),
        crack_direction = COALESCE($3, crack_direction),
        activity_status = COALESCE($4, activity_status),
        comparison_with_phase1 = COALESCE($5, comparison_with_phase1),
        sketch_pin_x_percent = COALESCE($6, sketch_pin_x_percent),
        sketch_pin_y_percent = COALESCE($7, sketch_pin_y_percent),
        defect_notes = COALESCE($8, defect_notes),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *`,
      [maxCrackWidthMm, crackLengthM, crackDirection, activityStatus,
       comparisonWithPhase1, sketchPinXPercent, sketchPinYPercent, defectNotes, defectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Không tìm thấy khuyết tật ID: ${defectId}` });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
}

// DELETE /api/buildings/:buildingId/phase2/defects/:defectId
async function deleteDefect(req, res, next) {
  try {
    const { defectId } = req.params;
    await db.query('DELETE FROM defect_register WHERE id = $1', [defectId]);
    return res.json({ success: true, message: `Đã xóa khuyết tật ${defectId}. Các mã D-xx khác giữ nguyên.` });
  } catch (error) { next(error); }
}

module.exports = { listDefects, addDefect, updateDefect, deleteDefect };
