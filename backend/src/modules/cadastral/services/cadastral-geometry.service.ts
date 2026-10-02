import { CadastralRepository } from '../cadastral.repository';
import { Database } from '../../../database/db';
import { NotFoundError, BadRequestError } from '../../../common/errors/problem-details';

export class CadastralGeometryService {
  static async findNearbyParcels(lat: number, lng: number, radius: number = 150) {
    return CadastralRepository.findNearbyParcels(lat, lng, radius);
  }

  static async updateFootprint(parcelId: string, footprintGeoJson: any, constructionAreaM2?: number) {
    const parcel = await CadastralRepository.findById(parcelId);
    if (!parcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }

    await CadastralRepository.updateFootprint(parcelId, footprintGeoJson, constructionAreaM2);
    return {
      parcelId,
      message: 'Đã cập nhật đa giác ranh nhà footprint thành công trên GIS',
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
}
