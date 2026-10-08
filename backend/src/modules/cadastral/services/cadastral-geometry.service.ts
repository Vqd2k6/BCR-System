import { CadastralRepository } from '../cadastral.repository';
import { Database } from '../../../database/db';
import { NotFoundError, BadRequestError } from '../../../common/errors/problem-details';

export class CadastralGeometryService {
  static async findNearbyParcels(lat: number, lng: number, radius: number = 150) {
    return CadastralRepository.findNearbyParcels(lat, lng, radius);
  }

  static async updateFootprint(
    parcelId: string,
    footprintGeoJson: any,
    constructionAreaM2?: number,
    userId?: string,
    reason?: string,
    clientIp?: string
  ) {
    const parcel = await CadastralRepository.findById(parcelId);
    if (!parcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }

    const oldArea = parcel.construction_area_m2;
    const effectiveReason = reason || 'Chỉnh sửa / vẽ lại đa giác ranh nhà footprint trên GIS';

    await CadastralRepository.updateFootprint(parcelId, footprintGeoJson, constructionAreaM2);

    const redrawCode = `REDRAW-GIS-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    if (userId) {
      try {
        await Database.query(
          `INSERT INTO parcel_mutation_events (
             mutation_code, mutation_type, source_parcel_ids, result_parcel_ids,
             new_geojson, surveyor_notes, surveyor_id, zone_admin_id, status, approved_at
           ) VALUES ($1, 'REDRAW', ARRAY[$2::uuid], ARRAY[$2::uuid], $3, $4, $5, $5, 'APPROVED', NOW());`,
          [
            redrawCode,
            parcelId,
            typeof footprintGeoJson === 'string' ? footprintGeoJson : JSON.stringify(footprintGeoJson),
            effectiveReason,
            userId,
          ]
        );

        await Database.query(
          `INSERT INTO system_audit_logs (
             entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
           ) VALUES ($1, $2, $3, $4, $5, $6);`,
          [
            'PARCEL',
            parcelId,
            'PARCEL_FOOTPRINT_REDRAW',
            userId,
            JSON.stringify({
              mutationCode: redrawCode,
              parcelId,
              projectParcelCode: parcel.project_parcel_code,
              oldConstructionAreaM2: oldArea,
              newConstructionAreaM2: constructionAreaM2 ?? oldArea,
              reason: effectiveReason,
              timestamp: new Date().toISOString(),
            }),
            clientIp || null,
          ]
        );
      } catch (logErr) {
        console.error('[CadastralGeometryService] Lỗi ghi nhận audit log cho updateFootprint:', logErr);
      }
    }

    return {
      parcelId,
      mutationCode: redrawCode,
      message: 'Đã cập nhật đa giác ranh nhà footprint và ghi nhận lịch sử biến động thành công',
    };
  }

  /**
   * Lấy danh sách các thửa đất liền kề (tiếp giáp ranh giới ST_Touches hoặc ST_DWithin < 5m)
   */
  static async getAdjacentCandidates(parcelId: string) {
    const parent = await CadastralRepository.findById(parcelId);
    if (!parent) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }

    const res = await Database.query<{
      id: string;
      project_parcel_code: string;
      official_cadastral_code: string;
      house_number: string;
      street: string;
      owner_name: string;
      land_area_m2: number;
      survey_status: string;
      distance_meters: number;
      is_touching: boolean;
    }>(
      `SELECT p.id, p.project_parcel_code, p.official_cadastral_code, p.house_number, p.street,
              p.owner_name, p.land_area_m2, p.survey_status,
              ST_AsGeoJSON(p.cadastral_polygon_geom)::json AS cadastral_geojson,
              ROUND(ST_Distance(p.cadastral_polygon_geom::geography, target.cadastral_polygon_geom::geography)::numeric, 1) AS distance_meters,
              ST_Touches(p.cadastral_polygon_geom, target.cadastral_polygon_geom) AS is_touching
       FROM parcels p,
            (SELECT cadastral_polygon_geom, zone_id FROM parcels WHERE id = $1) target
       WHERE p.id != $1
         AND p.zone_id = target.zone_id
         AND p.lifecycle_status = 'ACTIVE'
         AND (
           ST_Touches(p.cadastral_polygon_geom, target.cadastral_polygon_geom)
           OR ST_DWithin(p.cadastral_polygon_geom::geography, target.cadastral_polygon_geom::geography, 15)
         )
       ORDER BY is_touching DESC, distance_meters ASC
       LIMIT 10;`,
      [parcelId]
    );

    return {
      targetParcelId: parcelId,
      targetProjectCode: parent.project_parcel_code,
      currentParcel: {
        id: parent.id,
        projectParcelCode: parent.project_parcel_code,
        officialCadastralCode: parent.official_cadastral_code,
        zoneId: parent.zone_id,
        houseNumber: parent.house_number,
        street: parent.street,
        ownerName: parent.owner_name,
        ownerPhone: parent.owner_phone,
        landAreaM2: parent.land_area_m2,
        cadastralGeojson: parent.cadastral_geojson,
      },
      candidates: res.rows,
    };
  }

  /**
   * Hoán đổi vị trí ranh đất không gian GIS (Spatial Geometry Swap) giữa 2 thửa đất:
   * - Bảo toàn 100% hồ sơ, mã thửa, số nhà, chủ hộ, biên bản và watermark ảnh (Phương Án A).
   * - Tráo đổi: cadastral_polygon_geom, footprint_polygon_geom, location_geom, land_area_m2, construction_area_m2.
   */
  static async swapParcelGeometries(
    parcelAIdent: string,
    parcelBIdent: string,
    adminId: string,
    reason: string,
    clientIp?: string
  ) {
    return Database.transaction(async (client) => {
      // 1. Tìm thông tin thửa A và B
      const pRes = await client.query<{
        id: string;
        zone_id: string;
        project_parcel_code: string;
        official_cadastral_code: string;
        house_number: string;
        street: string;
        owner_name: string;
        land_area_m2: number;
        construction_area_m2: number;
        cadastral_geojson: string;
        footprint_geojson: string;
        location_geojson: string;
      }>(
        `SELECT id, zone_id, project_parcel_code, official_cadastral_code, house_number, street, owner_name,
                land_area_m2, construction_area_m2,
                ST_AsGeoJSON(cadastral_polygon_geom) AS cadastral_geojson,
                ST_AsGeoJSON(footprint_polygon_geom) AS footprint_geojson,
                ST_AsGeoJSON(location_geom) AS location_geojson
         FROM parcels
         WHERE id::text = $1 OR project_parcel_code = $1 OR official_cadastral_code = $1
            OR id::text = $2 OR project_parcel_code = $2 OR official_cadastral_code = $2
         FOR UPDATE;`,
        [parcelAIdent, parcelBIdent]
      );

      if (pRes.rows.length < 2) {
        throw new NotFoundError(
          `Không tìm thấy đủ 2 thửa đất hợp lệ để hoán đổi. Yêu cầu [${parcelAIdent}] và [${parcelBIdent}], tìm thấy ${pRes.rows.length} thửa.`
        );
      }

      const parcelA = pRes.rows.find(
        (r) => r.id === parcelAIdent || r.project_parcel_code === parcelAIdent || r.official_cadastral_code === parcelAIdent
      )!;
      const parcelB = pRes.rows.find((r) => r.id !== parcelA.id)!;

      if (!parcelA || !parcelB) {
        throw new BadRequestError('Không thể phân định 2 thửa đất riêng biệt để hoán đổi');
      }

      if (parcelA.zone_id !== parcelB.zone_id) {
        throw new BadRequestError(
          `Hai thửa đất không cùng Zone (Thửa A thuộc ${parcelA.zone_id}, Thửa B thuộc ${parcelB.zone_id}). Không thể hoán đổi liên Zone!`
        );
      }

      // 2. Thực hiện tráo đổi hình học không gian (Geometry Swap)
      await client.query(
        `UPDATE parcels
         SET cadastral_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
             footprint_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326),
             location_geom = ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
             land_area_m2 = $4,
             construction_area_m2 = $5,
             updated_at = NOW()
         WHERE id = $6;`,
        [
          parcelB.cadastral_geojson,
          parcelB.footprint_geojson,
          parcelB.location_geojson,
          parcelB.land_area_m2,
          parcelB.construction_area_m2,
          parcelA.id,
        ]
      );

      await client.query(
        `UPDATE parcels
         SET cadastral_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
             footprint_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326),
             location_geom = ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
             land_area_m2 = $4,
             construction_area_m2 = $5,
             updated_at = NOW()
         WHERE id = $6;`,
        [
          parcelA.cadastral_geojson,
          parcelA.footprint_geojson,
          parcelA.location_geojson,
          parcelA.land_area_m2,
          parcelA.construction_area_m2,
          parcelB.id,
        ]
      );

      // 3. Ghi log sự kiện biến động (Mutation Event)
      const swapEventCode = `SWAP-GIS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const mutRes = await client.query<{ id: string }>(
        `INSERT INTO parcel_mutation_events (
           mutation_code, mutation_type, source_parcel_ids, result_parcel_ids,
           surveyor_notes, surveyor_id, zone_admin_id, status, approved_at
         ) VALUES ($1, 'SWAP_SPATIAL', ARRAY[$2::uuid, $3::uuid], ARRAY[$2::uuid, $3::uuid], $4, $5, $5, 'APPROVED', NOW())
         RETURNING id;`,
        [
          swapEventCode,
          parcelA.id,
          parcelB.id,
          `Hoán đổi không gian GIS giữa [${parcelA.project_parcel_code}] (${parcelA.house_number} ${parcelA.street}) và [${parcelB.project_parcel_code}] (${parcelB.house_number} ${parcelB.street}). Lý do: ${reason}`,
          adminId,
        ]
      );

      // 4. Ghi log kiểm toán toàn trình
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'PARCEL',
          parcelA.id,
          'SPATIAL_GEOMETRY_SWAP',
          adminId,
          JSON.stringify({
            swapEventCode,
            parcelA: {
              id: parcelA.id,
              code: parcelA.project_parcel_code,
              oldArea: parcelA.land_area_m2,
              newArea: parcelB.land_area_m2,
            },
            parcelB: {
              id: parcelB.id,
              code: parcelB.project_parcel_code,
              oldArea: parcelB.land_area_m2,
              newArea: parcelA.land_area_m2,
            },
            reason,
            timestamp: new Date().toISOString(),
          }),
          clientIp || null,
        ]
      );

      return {
        success: true,
        swapEventId: mutRes.rows[0].id,
        swapEventCode,
        message: `Đã hoán đổi không gian GIS thành công giữa [${parcelA.project_parcel_code}] và [${parcelB.project_parcel_code}]. Toàn bộ số nhà, chủ hộ, hồ sơ khảo sát và watermark ảnh được bảo toàn 100%.`,
        parcelA: {
          id: parcelA.id,
          projectParcelCode: parcelA.project_parcel_code,
          houseNumber: parcelA.house_number,
          newLandAreaM2: parcelB.land_area_m2,
        },
        parcelB: {
          id: parcelB.id,
          projectParcelCode: parcelB.project_parcel_code,
          houseNumber: parcelB.house_number,
          newLandAreaM2: parcelA.land_area_m2,
        },
      };
    });
  }

  /**
   * Nắn chỉnh đa giác ranh thửa đất (Cadastral Boundary Reshaping & Calibration)
   * Cho phép Zone Admin kéo thả các đỉnh mốc polygon để khớp đúng với ranh giới bờ tường, mái nhà thực địa.
   * - Tự động validate tính hợp lệ hình học (ST_IsValid)
   * - Tự động tính lại diện tích chuẩn PostGIS ST_Area(geom::geography)
   * - Cập nhật vị trí tâm thửa ST_Centroid(geom)
   * - Ghi nhận lịch sử biến động REDRAW và log kiểm toán system_audit_logs
   */
  static async reshapeParcelGeometry(
    parcelId: string,
    newCoordinates: [number, number][], // [lat, lng][] từ Leaflet
    userId: string,
    reason: string,
    updateFootprint: boolean = true,
    clientIp?: string
  ) {
    if (!newCoordinates || !Array.isArray(newCoordinates) || newCoordinates.length < 3) {
      throw new BadRequestError('Tọa độ đa giác nắn chỉnh không hợp lệ: phải có tối thiểu 3 đỉnh.');
    }

    if (!reason || !reason.trim()) {
      throw new BadRequestError('Vui lòng nhập lý do nắn chỉnh ranh giới thửa đất.');
    }

    return Database.transaction(async (client) => {
      // 1. Kiểm tra thửa đất hiện tại
      const parcelRes = await client.query<{
        id: string;
        project_parcel_code: string;
        official_cadastral_code: string;
        house_number: string;
        street: string;
        land_area_m2: number;
        construction_area_m2: number;
        original_geojson: string;
        original_footprint_geojson: string;
      }>(
        `SELECT id, project_parcel_code, official_cadastral_code, house_number, street,
                land_area_m2, construction_area_m2,
                ST_AsGeoJSON(cadastral_polygon_geom) as original_geojson,
                ST_AsGeoJSON(footprint_polygon_geom) as original_footprint_geojson
         FROM parcels WHERE id = $1 FOR UPDATE;`,
        [parcelId]
      );

      if (parcelRes.rows.length === 0) {
        throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
      }

      const parcel = parcelRes.rows[0];

      // 2. Chuyển đổi từ Leaflet [lat, lng][] sang GeoJSON Polygon coordinates [[lng, lat], ...] khép kín
      const ringCoords: [number, number][] = newCoordinates.map(pt => [pt[1], pt[0]]);
      const firstPt = ringCoords[0];
      const lastPt = ringCoords[ringCoords.length - 1];
      if (firstPt[0] !== lastPt[0] || firstPt[1] !== lastPt[1]) {
        ringCoords.push([firstPt[0], firstPt[1]]);
      }

      const geoJsonPolygon = {
        type: 'Polygon',
        coordinates: [ringCoords],
      };
      const geoJsonStr = JSON.stringify(geoJsonPolygon);

      // 3. Kiểm định tính hợp lệ PostGIS & tính diện tích chuẩn mét vuông
      const validRes = await client.query<{
        is_valid: boolean;
        invalid_reason: string | null;
        calculated_area_m2: number;
      }>(
        `SELECT 
           ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) as is_valid,
           ST_IsValidReason(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) as invalid_reason,
           ROUND(ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography)::numeric, 2) as calculated_area_m2;`,
        [geoJsonStr]
      );

      const { is_valid, invalid_reason, calculated_area_m2 } = validRes.rows[0];
      if (!is_valid) {
        throw new BadRequestError(`Đa giác ranh đất sau khi nắn chỉnh bị lỗi hình học (tự cắt chéo hoặc nút thắt): ${invalid_reason || 'Không hợp lệ'}`);
      }

      const newAreaM2 = Number(calculated_area_m2);
      if (newAreaM2 <= 0) {
        throw new BadRequestError('Diện tích đa giác tính toán không hợp lệ (nhỏ hơn hoặc bằng 0 m²).');
      }

      const oldAreaM2 = Number(parcel.land_area_m2) || 0;
      const deltaAreaM2 = Math.round((newAreaM2 - oldAreaM2) * 100) / 100;
      const reshapeMutationCode = `RESHAPE-GIS-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      // 4. Tạo bản ghi biến động parcel_mutation_events
      const mutRes = await client.query<{ id: string }>(
        `INSERT INTO parcel_mutation_events (
           mutation_code, mutation_type, source_parcel_ids, result_parcel_ids,
           original_geojson, new_geojson, surveyor_notes, surveyor_id, zone_admin_id, status, approved_at
         ) VALUES ($1, 'REDRAW', ARRAY[$2::uuid], ARRAY[$2::uuid], $3, $4, $5, $6, $6, 'APPROVED', NOW())
         RETURNING id;`,
        [
          reshapeMutationCode,
          parcelId,
          parcel.original_geojson ? JSON.parse(parcel.original_geojson) : null,
          geoJsonPolygon,
          `Nắn chỉnh ranh giới đa giác thửa đất [${parcel.project_parcel_code}]. Diện tích: ${oldAreaM2} m² -> ${newAreaM2} m² (Δ: ${deltaAreaM2 > 0 ? '+' : ''}${deltaAreaM2} m²). Lý do: ${reason.trim()}`,
          userId,
        ]
      );

      const mutationEventId = mutRes.rows[0].id;

      // 5. Cập nhật bảng parcels
      if (updateFootprint) {
        await client.query(
          `UPDATE parcels
           SET cadastral_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
               footprint_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
               location_geom = ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
               land_area_m2 = $2,
               construction_area_m2 = $2,
               mutation_type = 'REDRAW',
               mutation_event_id = $3,
               updated_at = NOW()
           WHERE id = $4;`,
          [geoJsonStr, newAreaM2, mutationEventId, parcelId]
        );
      } else {
        await client.query(
          `UPDATE parcels
           SET cadastral_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
               location_geom = ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
               land_area_m2 = $2,
               mutation_type = 'REDRAW',
               mutation_event_id = $3,
               updated_at = NOW()
           WHERE id = $4;`,
          [geoJsonStr, newAreaM2, mutationEventId, parcelId]
        );
      }

      // 6. Ghi log kiểm toán toàn trình
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'PARCEL',
          parcelId,
          'PARCEL_GEOMETRY_RESHAPE',
          userId,
          JSON.stringify({
            mutationCode: reshapeMutationCode,
            parcelId,
            projectParcelCode: parcel.project_parcel_code,
            officialCadastralCode: parcel.official_cadastral_code,
            houseNumber: parcel.house_number,
            street: parcel.street,
            oldAreaM2,
            newAreaM2,
            deltaAreaM2,
            vertexCount: newCoordinates.length,
            updateFootprint,
            reason: reason.trim(),
            timestamp: new Date().toISOString(),
          }),
          clientIp || null,
        ]
      );

      return {
        success: true,
        mutationCode: reshapeMutationCode,
        mutationEventId,
        parcelId,
        projectParcelCode: parcel.project_parcel_code,
        oldAreaM2,
        newAreaM2,
        deltaAreaM2,
        newGeoJson: geoJsonPolygon,
        message: `Đã nắn chỉnh ranh giới thửa đất [${parcel.project_parcel_code}] thành công. Diện tích mới: ${newAreaM2} m² (${deltaAreaM2 >= 0 ? '+' : ''}${deltaAreaM2} m²).`,
      };
    });
  }
}
