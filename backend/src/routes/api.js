const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

// ============================================================================
// 1. AUTHENTICATION & LOGIN
// ============================================================================
router.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
        }

        const userResult = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác.' });
        }

        const user = userResult.rows[0];
        if (user.status === 'LOCKED') {
            return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.' });
        }

        // Tạm thời chấp nhận mật khẩu mặc định hoặc kiểm tra bcrypt
        const isValidPassword = password === 'Admin@123' || password === 'Survey@123' || password === 'Guest@123' 
            || await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác.' });
        }

        const tokenPayload = {
            id: user.id,
            username: user.username,
            fullName: user.full_name,
            role: user.role,
            assignedZoneId: user.assigned_zone_id
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'metro2_super_secure_jwt_secret_key_2026', {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        });

        await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

        return res.json({
            success: true,
            message: 'Đăng nhập thành công.',
            token,
            user: tokenPayload
        });
    } catch (err) {
        console.error('Login Error:', err);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ.' });
    }
});

// ============================================================================
// 2. CHECK-IN CHẤM CÔNG GPS (SURVEYOR)
// ============================================================================
router.post('/attendance/check-in', authenticateToken, authorizeRoles('SURVEYOR', 'ZONE_ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { gpsLatitude, gpsLongitude, gpsAccuracyM, selfiePhotoUrl, accompanyingMembers, notes } = req.body;
        
        const result = await db.query(`
            INSERT INTO timekeeping_checkins (surveyor_id, zone_id, gps_latitude, gps_longitude, gps_accuracy_m, selfie_photo_url, accompanying_members, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, check_in_time
        `, [req.user.id, req.user.assignedZoneId, gpsLatitude, gpsLongitude, gpsAccuracyM, selfiePhotoUrl, JSON.stringify(accompanyingMembers || []), notes]);

        return res.status(201).json({
            success: true,
            message: 'Check-in chấm công thành công.',
            checkIn: result.rows[0]
        });
    } catch (err) {
        console.error('CheckIn Error:', err);
        return res.status(500).json({ success: false, message: 'Lỗi ghi nhận chấm công.' });
    }
});

// ============================================================================
// 3. THỬA ĐẤT & BẢN ĐỒ GIS (PARCELS & DUAL-ID)
// ============================================================================
router.get('/parcels/:parcelId', authenticateToken, async (req, res) => {
    try {
        const { parcelId } = req.params;
        const result = await db.query(`
            SELECT p.*, z.zone_name, z.zone_code,
                   ST_AsGeoJSON(p.polygon_geom) as polygon_geojson_str
            FROM parcels p
            JOIN metro_zones z ON p.zone_id = z.id
            WHERE p.id = $1
        `, [parcelId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin thửa đất.' });
        }

        return res.json({ success: true, parcel: result.rows[0] });
    } catch (err) {
        console.error('Get Parcel Error:', err);
        return res.status(500).json({ success: false, message: 'Lỗi truy vấn thửa đất.' });
    }
});

router.get('/zones/:zoneId/parcels', authenticateToken, async (req, res) => {
    try {
        const { zoneId } = req.params;
        const result = await db.query(`
            SELECT id, official_cadastral_code, project_parcel_code, house_number, street, 
                   owner_name, survey_status, lifecycle_status, chainage_km,
                   ST_AsGeoJSON(polygon_geom) as polygon_geojson_str
            FROM parcels
            WHERE zone_id = $1
            ORDER BY chainage_km ASC, project_parcel_code ASC
        `, [zoneId]);

        return res.json({ success: true, total: result.rows.length, parcels: result.rows });
    } catch (err) {
        console.error('Get Zone Parcels Error:', err);
        return res.status(500).json({ success: false, message: 'Lỗi truy vấn danh sách thửa đất.' });
    }
});

// ============================================================================
// 4. KHẢO SÁT PHASE 2 THEO VỊ TRÍ ĐỨNG (LOCATION-BASED DEFECT RETRIEVAL)
// ============================================================================
router.get('/parcels/:parcelId/phase2/zones', authenticateToken, async (req, res) => {
    try {
        const { parcelId } = req.params;
        const { floor, room } = req.query;

        // Tìm báo cáo Phase 1 gần nhất của thửa đất này
        const phase1ReportRes = await db.query(`
            SELECT id FROM base_survey_reports 
            WHERE parcel_id = $1 AND report_type = 'PHASE_1_PRE_CONSTRUCTION' AND status = 'APPROVED'
            ORDER BY created_at DESC LIMIT 1
        `, [parcelId]);

        if (phase1ReportRes.rows.length === 0) {
            return res.json({ success: true, message: 'Không có dữ liệu Phase 1 cũ (Khảo sát độc lập).', zones: [] });
        }

        const phase1Id = phase1ReportRes.rows[0].id;
        let query = `
            SELECT z.*, 
                   COALESCE(json_agg(d.*) FILTER (WHERE d.id IS NOT NULL), '[]') as defects
            FROM damage_zones z
            LEFT JOIN defect_items d ON z.id = d.zone_id
            WHERE z.report_id = $1
        `;
        const params = [phase1Id];

        if (floor) {
            params.push(floor);
            query += ` AND z.floor_name = $${params.length}`;
        }
        if (room) {
            params.push(room);
            query += ` AND z.room_name = $${params.length}`;
        }

        query += ` GROUP BY z.id ORDER BY z.floor_index ASC, z.zone_code ASC`;

        const zonesRes = await db.query(query, params);
        return res.json({ success: true, phase1ReportId: phase1Id, zones: zonesRes.rows });
    } catch (err) {
        console.error('Phase 2 Location Query Error:', err);
        return res.status(500).json({ success: false, message: 'Lỗi truy xuất dữ liệu Phase 2.' });
    }
});

// ============================================================================
// 5. ĐỐI SOÁT VẾT NỨT CŨ PHASE 2 (DELTA COMPARISON)
// ============================================================================
router.put('/phase2/defects/:defectId/verify', authenticateToken, async (req, res) => {
    try {
        const { defectId } = req.params;
        const { phase2WidthMm, phase2LengthMm, crackEvolutionStatus, cuPhotoUrl } = req.body;

        const defectRes = await db.query('SELECT * FROM defect_items WHERE id = $1', [defectId]);
        if (defectRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy khuyết tật.' });
        }

        const oldDefect = defectRes.rows[0];
        const deltaW = Number(phase2WidthMm || 0) - Number(oldDefect.crack_width_max_mm || 0);
        const deltaL = Number(phase2LengthMm || 0) - Number(oldDefect.crack_length_mm || 0);

        const updateRes = await db.query(`
            UPDATE defect_items
            SET phase2_width_mm = $1, phase2_length_mm = $2,
                delta_crack_width_mm = $3, delta_crack_length_mm = $4,
                crack_evolution_status = $5, cu_photo_url = COALESCE($6, cu_photo_url)
            WHERE id = $7
            RETURNING *
        `, [phase2WidthMm, phase2LengthMm, deltaW, deltaL, crackEvolutionStatus, cuPhotoUrl, defectId]);

        return res.json({
            success: true,
            message: 'Đã cập nhật đối soát biến động khuyết tật.',
            defect: updateRes.rows[0]
        });
    } catch (err) {
        console.error('Verify Defect Error:', err);
        return res.status(500).json({ success: false, message: 'Lỗi cập nhật khuyết tật.' });
    }
});

// ============================================================================
// 6. THẨM ĐỊNH SPLIT-PANE & PHÊ DUYỆT BÁO CÁO (ZONE ADMIN)
// ============================================================================
router.get('/admin/reports/:reportId/audit-view', authenticateToken, authorizeRoles('ZONE_ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { reportId } = req.params;

        const reportRes = await db.query(`
            SELECT r.*, p.official_cadastral_code, p.project_parcel_code, p.house_number, p.street,
                   u.full_name as surveyor_name
            FROM base_survey_reports r
            JOIN parcels p ON r.parcel_id = p.id
            JOIN users u ON r.surveyor_id = u.id
            WHERE r.id = $1
        `, [reportId]);

        if (reportRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo.' });
        }

        const photosRes = await db.query('SELECT * FROM survey_photos WHERE report_id = $1', [reportId]);
        const specsRes = await db.query('SELECT * FROM building_specifications WHERE report_id = $1', [reportId]);
        const zonesRes = await db.query(`
            SELECT z.*, COALESCE(json_agg(d.*) FILTER (WHERE d.id IS NOT NULL), '[]') as defects
            FROM damage_zones z
            LEFT JOIN defect_items d ON z.id = d.zone_id
            WHERE z.report_id = $1
            GROUP BY z.id
        `, [reportId]);
        const scoresRes = await db.query('SELECT * FROM risk_score_cards WHERE report_id = $1', [reportId]);

        return res.json({
            success: true,
            report: reportRes.rows[0],
            photos: photosRes.rows,
            specs: specsRes.rows[0] || null,
            zones: zonesRes.rows,
            scores: scoresRes.rows[0] || null
        });
    } catch (err) {
        console.error('Audit View Error:', err);
        return res.status(500).json({ success: false, message: 'Lỗi tải giao diện thẩm định.' });
    }
});

router.post('/admin/reports/:reportId/approve', authenticateToken, authorizeRoles('ZONE_ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { reportId } = req.params;
        const { engineeringJudgementNotes } = req.body;

        await db.query(`
            UPDATE base_survey_reports
            SET status = 'APPROVED', approved_at = NOW(), zone_admin_id = $1, recommendations = COALESCE($2, recommendations)
            WHERE id = $3
        `, [req.user.id, engineeringJudgementNotes, reportId]);

        await db.query(`
            UPDATE parcels
            SET survey_status = 'APPROVED'
            WHERE id = (SELECT parcel_id FROM base_survey_reports WHERE id = $1)
        `, [reportId]);

        return res.json({ success: true, message: 'Báo cáo đã được phê duyệt và xuất bản thành công.' });
    } catch (err) {
        console.error('Approve Report Error:', err);
        return res.status(500).json({ success: false, message: 'Lỗi phê duyệt báo cáo.' });
    }
});

// ============================================================================
// 7. TRA CỨU BẢN ĐỒ GIS CÔNG KHAI CHO KHÁCH (GUEST PORTAL)
// ============================================================================
router.get('/guest/gis-map', async (req, res) => {
    try {
        const { zoneCode } = req.query;
        let query = `
            SELECT p.id, p.project_parcel_code, p.house_number, p.street, p.owner_name, 
                   p.importance_group, p.survey_status, p.chainage_km,
                   ST_AsGeoJSON(p.polygon_geom) as polygon_geojson_str
            FROM parcels p
            JOIN metro_zones z ON p.zone_id = z.id
            WHERE p.survey_status = 'APPROVED'
        `;
        const params = [];
        if (zoneCode) {
            params.push(zoneCode);
            query += ` AND z.zone_code = $1`;
        }

        const result = await db.query(query, params);
        return res.json({ success: true, total: result.rows.length, publishedParcels: result.rows });
    } catch (err) {
        console.error('Guest GIS Map Error:', err);
        return res.status(500).json({ success: false, message: 'Lỗi tải bản đồ quy hoạch.' });
    }
});

module.exports = router;
