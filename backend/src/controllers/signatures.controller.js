/**
 * Signatures Controller — Hybrid E-Signature (Mobile + Web Portal)
 * Quản lý chữ ký số 4 bên: Chủ hộ, Cán bộ (Mobile) | Nhà thầu, Chính quyền (Web)
 */
'use strict';

const db = require('../config/database');

// ============================================================================
// GET /api/buildings/:buildingId/phase2/signatures
// ============================================================================
async function getSignatures(req, res, next) {
  try {
    const { buildingId } = req.params;
    const result = await db.query(
      `SELECT s.sign_role, s.platform_origin, s.signer_full_name, s.signer_title,
              s.signer_id_number, s.signature_image_url, s.signed_at, s.is_refused,
              s.refusal_reason, s.witness_notes
       FROM survey_signatures s
       JOIN phase2_pre_construction p2 ON p2.id = s.phase2_id
       WHERE p2.building_id = $1
       ORDER BY s.created_at ASC`,
      [buildingId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
}

// ============================================================================
// POST /api/buildings/:buildingId/phase2/signatures/mobile
// Surveyor / Chủ hộ ký tại hiện trường qua Mobile App
// ============================================================================
async function signMobile(req, res, next) {
  try {
    const { buildingId } = req.params;
    const {
      phase2Id,
      signRole,          // 'OWNER_RESIDENT' hoặc 'SURVEYOR'
      signerFullName,
      signerTitle,
      signerIdNumber,
      signatureImageUrl, // PNG trong suốt lưu trên R2
      signatureGpsLat,
      signatureGpsLng,
      isRefused,
      refusalReason,
      witnessNotes,
    } = req.body;

    if (!phase2Id || !signRole || !signerFullName || !signatureImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: phase2Id, signRole, signerFullName, signatureImageUrl.',
      });
    }

    if (!['OWNER_RESIDENT', 'SURVEYOR'].includes(signRole)) {
      return res.status(400).json({
        success: false,
        message: 'Mobile App chỉ được ký với vai trò OWNER_RESIDENT hoặc SURVEYOR.',
      });
    }

    const gpsSql = signatureGpsLat && signatureGpsLng
      ? `ST_SetSRID(ST_MakePoint(${parseFloat(signatureGpsLng)}, ${parseFloat(signatureGpsLat)}), 4326)`
      : 'NULL';

    // Upsert (mỗi vai trò chỉ ký 1 lần)
    await db.query(
      `INSERT INTO survey_signatures (
        phase2_id, building_id, sign_role, platform_origin,
        signer_full_name, signer_title, signer_id_number,
        signature_image_url, signature_gps, is_refused, refusal_reason, witness_notes
      ) VALUES ($1, $2, $3, 'MOBILE_APP', $4, $5, $6, $7, ${gpsSql}, $8, $9, $10)
      ON CONFLICT (phase2_id, sign_role) DO UPDATE SET
        signer_full_name = EXCLUDED.signer_full_name,
        signature_image_url = EXCLUDED.signature_image_url,
        signature_gps = EXCLUDED.signature_gps,
        is_refused = EXCLUDED.is_refused,
        refusal_reason = EXCLUDED.refusal_reason,
        signed_at = NOW()`,
      [
        phase2Id, buildingId, signRole,
        signerFullName, signerTitle, signerIdNumber,
        signatureImageUrl, isRefused || false, refusalReason, witnessNotes,
      ]
    );

    await db.query(
      `INSERT INTO audit_logs (building_id, user_id, action, details)
       VALUES ($1, $2, 'SIGNATURE_MOBILE', $3)`,
      [buildingId, req.user.id, JSON.stringify({ signRole, signerFullName, isRefused })]
    );

    const refusedMsg = isRefused ? ` (Từ chối ký — Biên bản từ chối đã được lập)` : '';
    return res.status(201).json({
      success: true,
      message: `✅ Đã ghi nhận chữ ký ${signRole} qua Mobile App${refusedMsg}.`,
    });
  } catch (error) { next(error); }
}

// ============================================================================
// POST /api/buildings/:buildingId/phase2/signatures/web
// Nhà thầu / Chính quyền địa phương ký qua Web Portal
// (req.user.role phải là CONTRACTOR hoặc LOCAL_AUTHORITY — kiểm tra bởi requireWebSigningRole)
// ============================================================================
async function signWeb(req, res, next) {
  try {
    const { buildingId } = req.params;
    const {
      phase2Id,
      signRole,          // 'CONTRACTOR' hoặc 'LOCAL_AUTHORITY'
      signerFullName,
      signerTitle,
      signerIdNumber,
      signatureImageUrl,
      isRefused,
      refusalReason,
      witnessNotes,
    } = req.body;

    if (!['CONTRACTOR', 'LOCAL_AUTHORITY'].includes(signRole)) {
      return res.status(400).json({
        success: false,
        message: 'Web Portal chỉ được ký với vai trò CONTRACTOR hoặc LOCAL_AUTHORITY.',
      });
    }

    // Kiểm tra quyền: User phải đúng role với signRole khai báo
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== signRole) {
      return res.status(403).json({
        success: false,
        message: `Tài khoản của bạn (${req.user.role}) không được phép ký với vai trò ${signRole}.`,
      });
    }

    await db.query(
      `INSERT INTO survey_signatures (
        phase2_id, building_id, sign_role, platform_origin,
        signer_full_name, signer_title, signer_id_number,
        signature_image_url, is_refused, refusal_reason, witness_notes
      ) VALUES ($1, $2, $3, 'WEB_PORTAL', $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (phase2_id, sign_role) DO UPDATE SET
        signer_full_name = EXCLUDED.signer_full_name,
        signature_image_url = EXCLUDED.signature_image_url,
        is_refused = EXCLUDED.is_refused,
        refusal_reason = EXCLUDED.refusal_reason,
        signed_at = NOW()`,
      [
        phase2Id, buildingId, signRole,
        signerFullName, signerTitle, signerIdNumber,
        signatureImageUrl, isRefused || false, refusalReason, witnessNotes,
      ]
    );

    await db.query(
      `INSERT INTO audit_logs (building_id, user_id, action, details)
       VALUES ($1, $2, 'SIGNATURE_WEB', $3)`,
      [buildingId, req.user.id, JSON.stringify({ signRole, signerFullName })]
    );

    return res.status(201).json({
      success: true,
      message: `✅ Đã ghi nhận chữ ký ${signRole} qua Web Portal.`,
    });
  } catch (error) { next(error); }
}

module.exports = { getSignatures, signMobile, signWeb };
