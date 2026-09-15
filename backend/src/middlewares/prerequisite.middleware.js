/**
 * Prerequisite Gate Middleware
 * Chặn hoàn toàn việc tạo/cập nhật Phase 2 khi Phase 1 chưa APPROVED.
 * Đây là quy tắc nghiệp vụ cốt lõi — không thể bỏ qua.
 */
'use strict';

const db = require('../config/database');

/**
 * Middleware: Phase 1 phải ở trạng thái APPROVED trước khi làm Phase 2.
 * Sử dụng cho: POST /api/buildings/:buildingId/phase2
 */
async function requirePhase1Approved(req, res, next) {
  try {
    const buildingId = req.params.buildingId || req.params.id;

    if (!buildingId) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_BUILDING_ID',
        message: 'Thiếu buildingId trong request.',
      });
    }

    const result = await db.query(
      `SELECT id, status FROM phase1_assessments
       WHERE building_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [buildingId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'PHASE1_NOT_FOUND',
        message: 'Công trình này chưa có Hồ sơ Khảo sát Phase 1. Vui lòng hoàn thành và nộp Phase 1 trước.',
      });
    }

    const { status, id: phase1Id } = result.rows[0];

    if (status !== 'APPROVED') {
      const statusLabel = {
        NOT_STARTED: 'Chưa bắt đầu',
        IN_PROGRESS: 'Đang khảo sát',
        SUBMITTED: 'Đã nộp, chờ duyệt',
        REJECTED: 'Đã bị từ chối',
      }[status] || status;

      return res.status(400).json({
        success: false,
        code: 'PHASE1_NOT_APPROVED',
        message: `Hồ sơ Phase 1 phải được PHÊ DUYỆT (APPROVED) trước khi tiến hành khảo sát Phase 2. Trạng thái hiện tại: "${statusLabel}".`,
        data: { phase1Id, phase1Status: status },
      });
    }

    // Đính kèm phase1Id vào request để controller dùng tiếp
    req.phase1Id = phase1Id;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware: Kiểm tra Web Signature (chỉ cho phép CONTRACTOR và LOCAL_AUTHORITY)
 */
function requireWebSigningRole(req, res, next) {
  const { role } = req.user;
  if (!['CONTRACTOR', 'LOCAL_AUTHORITY', 'SUPER_ADMIN'].includes(role)) {
    return res.status(403).json({
      success: false,
      code: 'INSUFFICIENT_ROLE',
      message: `Chức năng Ký số qua Web Portal chỉ dành cho: Nhà thầu (CONTRACTOR) và Chính quyền địa phương (LOCAL_AUTHORITY).`,
    });
  }
  next();
}

module.exports = { requirePhase1Approved, requireWebSigningRole };
