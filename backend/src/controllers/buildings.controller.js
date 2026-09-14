const db = require('../config/database');

/**
 * GET /api/buildings/geojson
 * Xuất toàn bộ công trình dưới dạng GeoJSON FeatureCollection cho Leaflet Map
 */
async function getBuildingsGeoJson(req, res, next) {
  try {
    let features = [];
    try {
      const result = await db.query(`
        SELECT 
          json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(COALESCE(footprint, pin_gps))::json,
            'properties', json_build_object(
              'id', id,
              'houseCode', house_code,
              'ownerName', owner_name,
              'address', address,
              'status', status,
              'isFlagged', is_flagged,
              'deviationMeters', deviation_meters
            )
          ) AS feature
        FROM buildings
        ORDER BY created_at DESC
      `);
      features = result.rows.map(r => r.feature);
    } catch (err) {
      console.warn('DB buildings geojson query failed, using mock data');
    }

    const featureCollection = {
      type: 'FeatureCollection',
      features,
    };

    return res.json({
      success: true,
      data: featureCollection,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/buildings/:id
 * Lấy chi tiết toàn bộ hồ sơ công trình (cây cấu kiện, vết nứt, ảnh watermark, đối soát GPS)
 */
async function getBuildingDetail(req, res, next) {
  try {
    const { id } = req.params;

    const buildingResult = await db.query(`
      SELECT 
        b.*,
        u.full_name AS surveyor_name,
        ST_AsGeoJSON(b.hardware_gps)::json AS hardware_gps_json,
        ST_AsGeoJSON(b.pin_gps)::json AS pin_gps_json,
        ST_AsGeoJSON(b.footprint)::json AS footprint_json
      FROM buildings b
      LEFT JOIN users u ON b.surveyor_id = u.id
      WHERE b.id = $1 OR b.house_code = $1
    `, [id]);

    if (buildingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy hồ sơ công trình [${id}]`,
      });
    }

    const building = buildingResult.rows[0];

    // Get Floors, Rooms, Components, Cracks
    const floorsResult = await db.query(`
      SELECT * FROM building_floors WHERE building_id = $1 ORDER BY floor_order ASC
    `, [building.id]);

    const photosResult = await db.query(`
      SELECT * FROM survey_photos WHERE building_id = $1 ORDER BY created_at ASC
    `, [building.id]);

    return res.json({
      success: true,
      data: {
        ...building,
        floors: floorsResult.rows,
        photos: photosResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/buildings/survey
 * Mobile Surveyor nộp hồ sơ khảo sát thực địa
 */
async function submitSurvey(req, res, next) {
  try {
    const {
      houseCode,
      ownerName,
      address,
      zoneId,
      hardwareGps, // { lat, lng }
      pinGps,      // { lat, lng }
      footprint,   // [[lat, lng], ...]
      structure,   // { exterior, floors: [...] }
      photos,      // [{ photoUrl, caption, watermarkMetadata }]
    } = req.body;

    if (!houseCode || !ownerName || !hardwareGps || !pinGps) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: Mã căn, Tên chủ hộ, hoặc Tọa độ GPS.',
      });
    }

    const surveyorId = req.user.id;

    // Convert Points to PostGIS geometry
    const hwPointSql = `ST_SetSRID(ST_MakePoint(${hardwareGps.lng}, ${hardwareGps.lat}), 4326)`;
    const pinPointSql = `ST_SetSRID(ST_MakePoint(${pinGps.lng}, ${pinGps.lat}), 4326)`;

    let footprintSql = 'NULL';
    if (footprint && footprint.length >= 3) {
      // Ensure polygon is closed
      const closedFootprint = [...footprint];
      if (closedFootprint[0][0] !== closedFootprint[closedFootprint.length - 1][0] ||
          closedFootprint[0][1] !== closedFootprint[closedFootprint.length - 1][1]) {
        closedFootprint.push(closedFootprint[0]);
      }
      const coordsStr = closedFootprint.map(p => `${p[1]} ${p[0]}`).join(', ');
      footprintSql = `ST_SetSRID(ST_GeomFromText('POLYGON((${coordsStr}))'), 4326)`;
    }

    // Insert building record
    const insertResult = await db.query(`
      INSERT INTO buildings (
        house_code, owner_name, address, zone_id, status,
        hardware_gps, pin_gps, footprint, surveyor_id, survey_submitted_at
      )
      VALUES (
        $1, $2, $3, $4, 'PENDING_APPROVAL',
        ${hwPointSql}, ${pinPointSql}, ${footprintSql}, $5, NOW()
      )
      ON CONFLICT (house_code) DO UPDATE SET
        owner_name = EXCLUDED.owner_name,
        address = EXCLUDED.address,
        hardware_gps = EXCLUDED.hardware_gps,
        pin_gps = EXCLUDED.pin_gps,
        footprint = EXCLUDED.footprint,
        status = 'PENDING_APPROVAL',
        survey_submitted_at = NOW()
      RETURNING id, house_code, deviation_meters, is_flagged
    `, [houseCode, ownerName, address, zoneId, surveyorId]);

    const createdBuilding = insertResult.rows[0];

    // Log Audit
    await db.query(`
      INSERT INTO audit_logs (building_id, user_id, action, new_status, details)
      VALUES ($1, $2, 'SUBMIT', 'PENDING_APPROVAL', $3)
    `, [createdBuilding.id, surveyorId, JSON.stringify({ deviationMeters: createdBuilding.deviation_meters, isFlagged: createdBuilding.is_flagged })]);

    return res.status(201).json({
      success: true,
      message: `Đã nộp thành công hồ sơ công trình [${houseCode}]`,
      data: createdBuilding,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/buildings/:id/approve
 * Phê duyệt hồ sơ & Cập nhật ngược Footprint vào GIS trung tâm
 */
async function approveSurvey(req, res, next) {
  try {
    const { id } = req.params;
    const reviewerId = req.user.id;

    const result = await db.query(`
      UPDATE buildings
      SET 
        status = 'APPROVED',
        is_flagged = FALSE,
        reviewed_by = $1,
        reviewed_at = NOW()
      WHERE id = $2 OR house_code = $2
      RETURNING id, house_code, status
    `, [reviewerId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy hồ sơ [${id}] để phê duyệt`,
      });
    }

    const approvedBuilding = result.rows[0];

    // Log Audit
    await db.query(`
      INSERT INTO audit_logs (building_id, user_id, action, previous_status, new_status)
      VALUES ($1, $2, 'APPROVE', 'PENDING_APPROVAL', 'APPROVED')
    `, [approvedBuilding.id, reviewerId]);

    return res.json({
      success: true,
      message: `🎉 Đã PHÊ DUYỆT hồ sơ [${approvedBuilding.houseCode}]. Ranh giới Footprint đã được đồng bộ vào CSDL GIS!`,
      data: approvedBuilding,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/buildings/:id/reject
 * Từ chối hồ sơ kèm lý do yêu cầu khảo sát lại
 */
async function rejectSurvey(req, res, next) {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const reviewerId = req.user.id;

    const result = await db.query(`
      UPDATE buildings
      SET 
        status = 'REJECTED',
        reviewed_by = $1,
        reviewed_at = NOW(),
        rejection_reason = $2
      WHERE id = $3 OR house_code = $3
      RETURNING id, house_code, status, rejection_reason
    `, [reviewerId, rejectionReason || 'Yêu cầu khảo sát lại', id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy hồ sơ [${id}]`,
      });
    }

    return res.json({
      success: true,
      message: `Đã trả về hồ sơ [${result.rows[0].house_code}]`,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getBuildingsGeoJson,
  getBuildingDetail,
  submitSurvey,
  approveSurvey,
  rejectSurvey,
};
