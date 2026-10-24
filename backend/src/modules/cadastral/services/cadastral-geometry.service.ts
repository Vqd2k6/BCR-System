import { CadastralRepository } from '../cadastral.repository';
import { Database } from '../../../database/db';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../../common/errors/problem-details';
import { calculateDistancesFromPolygon } from '../../audit/utils/metro-spatial.utils';

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
    clientIp?: string,
    user?: { userId: string; role: string; assignedZoneId?: string | null }
  ) {
    // M6-02: Bảo đảm khởi tạo v0 (ORIGINAL_SUBMISSION) trước khi hoán đổi hình học không gian GIS
    try {
      const preSwapReports = await Database.query<{ id: string; surveyor_id: string | null }>(
        `SELECT r.id, r.surveyor_id
         FROM base_survey_reports r
         JOIN parcels p ON r.parcel_id = p.id
         WHERE (p.id::text = $1 OR p.project_parcel_code = $1 OR p.official_cadastral_code = $1
             OR p.id::text = $2 OR p.project_parcel_code = $2 OR p.official_cadastral_code = $2)
           AND r.deleted_at IS NULL
           AND r.status != 'APPROVED';`,
        [parcelAIdent, parcelBIdent]
      );
      for (const r of preSwapReports.rows) {
        const vCnt = await Database.query<{ cnt: string }>(
          `SELECT COUNT(*)::text AS cnt FROM survey_report_versions WHERE report_id = $1;`,
          [r.id]
        );
        if (Number(vCnt.rows[0]?.cnt || 0) === 0) {
          const { AuditVersionService } = await import('../../audit/services/audit-version.service');
          await AuditVersionService.createSnapshot(r.id, {
            versionNumber: 0,
            versionTag: 'ORIGINAL_SUBMISSION',
            title: 'Bản nộp thực địa ban đầu',
            editReason: 'Khởi tạo phiên bản cơ sở tự động trước khi hoán đổi hình học GIS',
            userId: r.surveyor_id || undefined,
          });
        }
      }
    } catch (seedErr) {
      console.error('[swapParcelGeometries] Lỗi khởi tạo snapshot v0:', seedErr);
    }

    const txResult = await Database.transaction(async (client) => {
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
        distance_to_centerline_m: number | null;
        survey_status: string;
        lifecycle_status: string;
        cadastral_geojson: string;
        footprint_geojson: string;
        location_geojson: string;
      }>(
        `SELECT id, zone_id, project_parcel_code, official_cadastral_code, house_number, street, owner_name,
                land_area_m2, construction_area_m2, distance_to_centerline_m,
                survey_status, lifecycle_status,
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

      // 1.1. Chốt chặn IDOR & Phân quyền Zone Admin
      let effectiveRole = user?.role;
      let effectiveZoneId = user?.assignedZoneId;
      if (!effectiveRole && adminId) {
        const uRes = await client.query<{ role: string; assigned_zone_id: string | null }>(
          `SELECT role, assigned_zone_id FROM users WHERE id = $1::uuid LIMIT 1;`,
          [adminId]
        );
        if (uRes.rows[0]) {
          effectiveRole = uRes.rows[0].role;
          effectiveZoneId = uRes.rows[0].assigned_zone_id;
        }
      }

      if (effectiveRole && effectiveRole !== 'SUPER_ADMIN') {
        if (effectiveRole !== 'ZONE_ADMIN') {
          throw new ForbiddenError('Chỉ Zone Admin hoặc Super Admin mới có quyền hoán đổi hình học không gian GIS.');
        }
        const normalizedAssigned = (effectiveZoneId || '').trim().toUpperCase();
        const hasAllZonesPrivilege =
          !normalizedAssigned || normalizedAssigned === 'ALL' || normalizedAssigned === 'ALL_ZONES';
        if (
          !hasAllZonesPrivilege &&
          (parcelA.zone_id !== effectiveZoneId || parcelB.zone_id !== effectiveZoneId)
        ) {
          throw new ForbiddenError(
            `Từ chối quyền truy cập (IDOR Guard): Bạn chỉ được phép thao tác trong phân khu [${effectiveZoneId}], không thể hoán đổi thửa thuộc phân khu [${parcelA.zone_id}].`
          );
        }
      }

      // 1.2. Chốt chặn trạng thái vòng đời (lifecycle_status) & bất biến pháp lý (APPROVED / is_locked)
      if (parcelA.lifecycle_status && parcelA.lifecycle_status !== 'ACTIVE') {
        throw new BadRequestError(
          `Không thể hoán đổi: Thửa đất [${parcelA.project_parcel_code}] đang ở trạng thái vòng đời '${parcelA.lifecycle_status}'.`
        );
      }
      if (parcelB.lifecycle_status && parcelB.lifecycle_status !== 'ACTIVE') {
        throw new BadRequestError(
          `Không thể hoán đổi: Thửa đất [${parcelB.project_parcel_code}] đang ở trạng thái vòng đời '${parcelB.lifecycle_status}'.`
        );
      }

      if (parcelA.survey_status === 'APPROVED') {
        throw new ForbiddenError(
          `Không thể hoán đổi: Thửa đất [${parcelA.project_parcel_code}] đã được phê duyệt chính thức (APPROVED) và bị khóa bất biến.`
        );
      }
      if (parcelB.survey_status === 'APPROVED') {
        throw new ForbiddenError(
          `Không thể hoán đổi: Thửa đất [${parcelB.project_parcel_code}] đã được phê duyệt chính thức (APPROVED) và bị khóa bất biến.`
        );
      }

      interface ParcelReportRow {
        id: string;
        parcel_id: string;
        status: string;
        report_type: string | null;
        survey_data_json: Record<string, unknown> | string | null;
      }

      const reportsCheckRes = await client.query<ParcelReportRow>(
        `SELECT id, parcel_id, status, report_type, survey_data_json
         FROM base_survey_reports
         WHERE parcel_id IN ($1::uuid, $2::uuid)
           AND deleted_at IS NULL
         FOR UPDATE;`,
        [parcelA.id, parcelB.id]
      );

      const lockedReport = reportsCheckRes.rows.find(
        (r) => r.status === 'APPROVED' || r.status === 'APPROVED_PHASE2'
      );
      if (lockedReport) {
        const lockedParcelCode =
          lockedReport.parcel_id === parcelA.id ? parcelA.project_parcel_code : parcelB.project_parcel_code;
        throw new ForbiddenError(
          `Không thể hoán đổi ranh giới GIS: Thửa đất [${lockedParcelCode}] có hồ sơ khảo sát đã được phê duyệt (APPROVED) hoặc đã khóa pháp lý bất biến.`
        );
      }

      // Hàm trích xuất tọa độ [lat, lng][] từ GeoJSON Polygon/MultiPolygon để đồng bộ khoảng cách Metro & survey_data_json
      const extractLatLngCoords = (geoJsonStr: string | null): [number, number][] => {
        if (!geoJsonStr) return [];
        try {
          const parsed = JSON.parse(geoJsonStr) as { type?: string; coordinates?: unknown };
          if (parsed.type === 'Polygon' && Array.isArray(parsed.coordinates) && Array.isArray(parsed.coordinates[0])) {
            return (parsed.coordinates[0] as [number, number][]).map((pt) => [Number(pt[1]), Number(pt[0])]);
          }
          if (
            parsed.type === 'MultiPolygon' &&
            Array.isArray(parsed.coordinates) &&
            Array.isArray(parsed.coordinates[0]) &&
            Array.isArray((parsed.coordinates[0] as unknown[])[0])
          ) {
            return ((parsed.coordinates[0] as unknown[])[0] as [number, number][]).map((pt) => [
              Number(pt[1]),
              Number(pt[0]),
            ]);
          }
        } catch {
          // Bỏ qua nếu không parse được
        }
        return [];
      };

      const coordsForAFromB = extractLatLngCoords(parcelB.cadastral_geojson);
      const coordsForBFromA = extractLatLngCoords(parcelA.cadastral_geojson);

      const metricsForA = coordsForAFromB.length >= 3 ? calculateDistancesFromPolygon(coordsForAFromB) : null;
      const metricsForB = coordsForBFromA.length >= 3 ? calculateDistancesFromPolygon(coordsForBFromA) : null;

      const nextDistA =
        metricsForA?.centerlineDist !== undefined && metricsForA?.centerlineDist !== null
          ? metricsForA.centerlineDist
          : parcelB.distance_to_centerline_m;
      const nextDistB =
        metricsForB?.centerlineDist !== undefined && metricsForB?.centerlineDist !== null
          ? metricsForB.centerlineDist
          : parcelA.distance_to_centerline_m;

      // 2. Thực hiện tráo đổi hình học không gian (Geometry Swap)
      await client.query(
        `UPDATE parcels
         SET cadastral_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($1::text), 4326),
             footprint_polygon_geom = CASE WHEN $2::text IS NOT NULL AND $2::text != '' THEN ST_SetSRID(ST_GeomFromGeoJSON($2::text), 4326) ELSE NULL END,
             location_geom = CASE WHEN $3::text IS NOT NULL AND $3::text != '' THEN ST_SetSRID(ST_GeomFromGeoJSON($3::text), 4326) ELSE NULL END,
             land_area_m2 = $4,
             construction_area_m2 = $5,
             distance_to_centerline_m = $6,
             updated_at = NOW()
         WHERE id = $7;`,
        [
          parcelB.cadastral_geojson,
          parcelB.footprint_geojson,
          parcelB.location_geojson,
          parcelB.land_area_m2,
          parcelB.construction_area_m2,
          nextDistA,
          parcelA.id,
        ]
      );

      await client.query(
        `UPDATE parcels
         SET cadastral_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($1::text), 4326),
             footprint_polygon_geom = CASE WHEN $2::text IS NOT NULL AND $2::text != '' THEN ST_SetSRID(ST_GeomFromGeoJSON($2::text), 4326) ELSE NULL END,
             location_geom = CASE WHEN $3::text IS NOT NULL AND $3::text != '' THEN ST_SetSRID(ST_GeomFromGeoJSON($3::text), 4326) ELSE NULL END,
             land_area_m2 = $4,
             construction_area_m2 = $5,
             distance_to_centerline_m = $6,
             updated_at = NOW()
         WHERE id = $7;`,
        [
          parcelA.cadastral_geojson,
          parcelA.footprint_geojson,
          parcelA.location_geojson,
          parcelA.land_area_m2,
          parcelA.construction_area_m2,
          nextDistB,
          parcelB.id,
        ]
      );

      // 2.1. Đồng bộ tọa độ đa giác, gpsCoords & khoảng cách Metro vào base_survey_reports.survey_data_json (bảo toàn 100% dữ liệu khảo sát thực địa)
      const swappedReportIds: string[] = [];
      const syncParcelReportsAfterSwap = async (
        targetParcelId: string,
        newCoords: [number, number][],
        centerlineDist: number | null | undefined,
        outerBoundaryDist: number | null | undefined,
        closestCenterVertex?: [number, number] | null
      ) => {
        const parcelReports = reportsCheckRes.rows.filter((r) => r.parcel_id === targetParcelId);
        for (const rep of parcelReports) {
          const rawJson: Record<string, unknown> =
            typeof rep.survey_data_json === 'string'
              ? (JSON.parse(rep.survey_data_json) as Record<string, unknown>)
              : { ...(rep.survey_data_json || {}) };

          const metroOffsetStr =
            centerlineDist !== null && centerlineDist !== undefined
              ? `${Number(centerlineDist).toFixed(1)}m`
              : undefined;
          const clearanceStr =
            outerBoundaryDist !== null && outerBoundaryDist !== undefined
              ? `${Number(outerBoundaryDist).toFixed(1)}m`
              : undefined;
          const bestPt = closestCenterVertex || newCoords[0] || null;

          const updatedJson: Record<string, unknown> = {
            ...rawJson,
          };

          if (newCoords.length >= 3) {
            updatedJson.parcelCoordinates = newCoords;
            updatedJson.polygonCoords = newCoords;
          }
          if (bestPt && Array.isArray(bestPt) && bestPt.length >= 2) {
            updatedJson.gpsCoords = { lat: Number(bestPt[0]), lng: Number(bestPt[1]) };
          }
          if (metroOffsetStr) {
            updatedJson.metroOffsetDistance = metroOffsetStr;
          }
          if (clearanceStr) {
            updatedJson.clearanceOffsetDistance = clearanceStr;
            updatedJson.stationEdgeDistance = clearanceStr;
          }

          if (updatedJson.parentInfo && typeof updatedJson.parentInfo === 'object') {
            const pInfo = { ...(updatedJson.parentInfo as Record<string, unknown>) };
            if (metroOffsetStr) pInfo.metroOffsetDistance = metroOffsetStr;
            if (clearanceStr) pInfo.stationEdgeDistance = clearanceStr;
            updatedJson.parentInfo = pInfo;
          }

          await client.query(
            `UPDATE base_survey_reports
             SET survey_data_json = $1::jsonb,
                 sync_version = COALESCE(sync_version, 1) + 1,
                 updated_at = NOW()
             WHERE id = $2::uuid;`,
            [JSON.stringify(updatedJson), rep.id]
          );
          swappedReportIds.push(rep.id);
        }
      };

      await syncParcelReportsAfterSwap(
        parcelA.id,
        coordsForAFromB,
        nextDistA,
        metricsForA?.outerBoundaryDist,
        coordsForAFromB?.[0] ?? null
      );
      await syncParcelReportsAfterSwap(
        parcelB.id,
        coordsForBFromA,
        nextDistB,
        metricsForB?.outerBoundaryDist,
        coordsForBFromA?.[0] ?? null
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
          'ZONE_ADMIN_SPATIAL_GEOMETRY_SWAP',
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

      // 5. Ghi nhận lịch sử biến động địa chính cadastral_history_logs cho cả 2 thửa
      try {
        await client.query(
          `INSERT INTO cadastral_history_logs (
             parcel_id, project_parcel_code, action_type, change_reason,
             previous_geom, new_geom, previous_state, new_state, changed_by_user_id
           ) VALUES
           ($1, $2, 'SPATIAL_GEOMETRY_SWAP', $3, ST_SetSRID(ST_GeomFromGeoJSON($4::text), 4326), ST_SetSRID(ST_GeomFromGeoJSON($5::text), 4326), $6, $7, $8),
           ($9, $10, 'SPATIAL_GEOMETRY_SWAP', $3, ST_SetSRID(ST_GeomFromGeoJSON($5::text), 4326), ST_SetSRID(ST_GeomFromGeoJSON($4::text), 4326), $7, $6, $8);`,
          [
            parcelA.id,
            parcelA.project_parcel_code,
            reason,
            parcelA.cadastral_geojson,
            parcelB.cadastral_geojson,
            JSON.stringify({ land_area_m2: parcelA.land_area_m2, house_number: parcelA.house_number }),
            JSON.stringify({ land_area_m2: parcelB.land_area_m2, house_number: parcelA.house_number }),
            adminId,
            parcelB.id,
            parcelB.project_parcel_code,
          ]
        );
      } catch (histErr) {
        console.warn('[CadastralGeometryService] Cảnh báo ghi cadastral_history_logs:', histErr);
      }

      return {
        success: true,
        swapEventId: mutRes.rows[0].id,
        swapEventCode,
        swappedReportIds,
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

    if (txResult.swappedReportIds && txResult.swappedReportIds.length > 0) {
      try {
        const { AuditVersionService } = await import('../../audit/services/audit-version.service');
        for (const repId of txResult.swappedReportIds) {
          await AuditVersionService.createSnapshot(repId, {
            versionTag: 'PARCEL_SWAP',
            title: `Hoán đổi không gian GIS giữa [${txResult.parcelA.projectParcelCode}] và [${txResult.parcelB.projectParcelCode}]`,
            editReason: reason,
            userId: adminId,
            clientIp,
          });
        }
      } catch (snapErr) {
        console.error('[swapParcelGeometries] Không thể tạo snapshot sau hoán đổi GIS:', snapErr);
      }
    }

    return txResult;
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

    // M6-02: Bảo đảm khởi tạo v0 (ORIGINAL_SUBMISSION) trước khi nắn chỉnh ranh giới GIS
    try {
      const preReports = await Database.query<{ id: string; surveyor_id: string | null }>(
        `SELECT id, surveyor_id FROM base_survey_reports WHERE parcel_id = $1 AND deleted_at IS NULL AND status != 'APPROVED';`,
        [parcelId]
      );
      for (const r of preReports.rows) {
        const vCnt = await Database.query<{ cnt: string }>(
          `SELECT COUNT(*)::text AS cnt FROM survey_report_versions WHERE report_id = $1;`,
          [r.id]
        );
        if (Number(vCnt.rows[0]?.cnt || 0) === 0) {
          const { AuditVersionService } = await import('../../audit/services/audit-version.service');
          await AuditVersionService.createSnapshot(r.id, {
            versionNumber: 0,
            versionTag: 'ORIGINAL_SUBMISSION',
            title: 'Bản nộp thực địa ban đầu',
            editReason: 'Khởi tạo phiên bản cơ sở tự động trước khi nắn chỉnh ranh giới GIS',
            userId: r.surveyor_id || undefined,
          });
        }
      }
    } catch (seedErr) {
      console.error('[reshapeParcelGeometry] Lỗi khởi tạo snapshot v0:', seedErr);
    }

    const txResult = await Database.transaction(async (client) => {
      // 1. Kiểm tra thửa đất hiện tại
      const parcelRes = await client.query<{
        id: string;
        project_parcel_code: string;
        official_cadastral_code: string;
        house_number: string;
        street: string;
        land_area_m2: number;
        construction_area_m2: number;
        survey_status: string;
        original_geojson: string;
        original_footprint_geojson: string;
      }>(
        `SELECT id, project_parcel_code, official_cadastral_code, house_number, street,
                land_area_m2, construction_area_m2, survey_status,
                ST_AsGeoJSON(cadastral_polygon_geom) as original_geojson,
                ST_AsGeoJSON(footprint_polygon_geom) as original_footprint_geojson
         FROM parcels WHERE id = $1 FOR UPDATE;`,
        [parcelId]
      );

      if (parcelRes.rows.length === 0) {
        throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
      }

      const parcel = parcelRes.rows[0];

      // 1.1 Guard bất biến: Nếu thửa đất hoặc hồ sơ khảo sát đã phê duyệt APPROVED thì khóa sửa
      if (parcel.survey_status === 'APPROVED') {
        throw new ForbiddenError(`Thửa đất [${parcel.project_parcel_code}] đã được phê duyệt chính thức (APPROVED) và bị khóa bất biến, không thể nắn chỉnh ranh giới.`);
      }

      const approvedReportCheck = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM base_survey_reports WHERE parcel_id = $1 AND status = 'APPROVED' LIMIT 1;`,
        [parcelId]
      );
      if (approvedReportCheck.rows.length > 0) {
        throw new ForbiddenError(`Hồ sơ khảo sát của thửa đất [${parcel.project_parcel_code}] đã được phê duyệt chính thức (APPROVED) và bị khóa bất biến, không thể nắn chỉnh ranh giới.`);
      }

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

      // 4. Tự động tính toán lại cự ly trắc địa tới Tim Hầm & Mép Ga Metro 2 (Q2) và đỉnh gần nhất (Comment 2)
      const metroMetrics = calculateDistancesFromPolygon(newCoordinates);
      const newCenterlineDist = metroMetrics.centerlineDist;
      const newOuterBoundaryDist = metroMetrics.outerBoundaryDist;
      const closestVertex = newCoordinates[0];

      // 5. Tạo bản ghi biến động parcel_mutation_events
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
          `Nắn chỉnh ranh giới đa giác thửa đất [${parcel.project_parcel_code}]. Diện tích: ${oldAreaM2} m² -> ${newAreaM2} m² (Δ: ${deltaAreaM2 > 0 ? '+' : ''}${deltaAreaM2} m²). Cự ly tim Metro: ${newCenterlineDist !== null ? newCenterlineDist.toFixed(1) + 'm' : 'N/A'}. Lý do: ${reason.trim()}`,
          userId,
        ]
      );

      const mutationEventId = mutRes.rows[0].id;

      // 6. Cập nhật bảng parcels (Bảo toàn nguyên vẹn survey_status: SUBMITTED vẫn là SUBMITTED theo Q3)
      if (updateFootprint) {
        await client.query(
          `UPDATE parcels
           SET cadastral_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
               footprint_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
               location_geom = ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
               land_area_m2 = $2,
               construction_area_m2 = $2,
               distance_to_centerline_m = $3,
               mutation_type = 'REDRAW',
               mutation_event_id = $4,
               updated_at = NOW()
           WHERE id = $5;`,
          [geoJsonStr, newAreaM2, newCenterlineDist, mutationEventId, parcelId]
        );
      } else {
        await client.query(
          `UPDATE parcels
           SET cadastral_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
               location_geom = ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
               land_area_m2 = $2,
               distance_to_centerline_m = $3,
               mutation_type = 'REDRAW',
               mutation_event_id = $4,
               updated_at = NOW()
           WHERE id = $5;`,
          [geoJsonStr, newAreaM2, newCenterlineDist, mutationEventId, parcelId]
        );
      }

      // 7. Đồng bộ 2 chiều sang base_survey_reports.survey_data_json (Q1, Q2, Q3 & M6-02)
      // Tự động cập nhật toạ độ, gpsCoords, gisMutationConfirmed và cự ly mới cho các hồ sơ chưa APPROVED
      const reportsRes = await client.query<{ id: string; survey_data_json: any; status: string }>(
        `SELECT id, survey_data_json, status FROM base_survey_reports WHERE parcel_id = $1 AND deleted_at IS NULL AND status != 'APPROVED';`,
        [parcelId]
      );

      const updatedReportIds: string[] = [];
      for (const rep of reportsRes.rows) {
        const existingJson = typeof rep.survey_data_json === 'string'
          ? JSON.parse(rep.survey_data_json)
          : (rep.survey_data_json || {});

        // Ràng buộc 02 (/grill-me): Bảo toàn 100% số liệu KSV thực địa (landAreaM2, constructionAreaM2, frontageWidth, lotDepth)
        // Chỉ gán mặc định nếu hồ sơ chưa từng có số liệu diện tích
        const preservedLandAreaM2 =
          existingJson.landAreaM2 !== undefined && existingJson.landAreaM2 !== null && existingJson.landAreaM2 !== ''
            ? existingJson.landAreaM2
            : newAreaM2;
        const preservedConstructionAreaM2 =
          existingJson.constructionAreaM2 !== undefined && existingJson.constructionAreaM2 !== null && existingJson.constructionAreaM2 !== ''
            ? existingJson.constructionAreaM2
            : newAreaM2;

        const updatedSurveyJson = {
          ...existingJson,
          parcelCoordinates: newCoordinates,
          polygonCoords: newCoordinates,
          gpsCoords:
            closestVertex && Array.isArray(closestVertex) && closestVertex.length >= 2
              ? { lat: Number(closestVertex[0]), lng: Number(closestVertex[1]) }
              : existingJson.gpsCoords,
          landAreaM2: preservedLandAreaM2,
          constructionAreaM2: preservedConstructionAreaM2,
          metroOffsetDistance: newCenterlineDist !== null ? `${newCenterlineDist.toFixed(1)}m` : existingJson.metroOffsetDistance,
          clearanceOffsetDistance: newOuterBoundaryDist !== null ? `${newOuterBoundaryDist.toFixed(1)}m` : 'Không có ga trong khu vực',
          stationEdgeDistance: newOuterBoundaryDist !== null ? `${newOuterBoundaryDist.toFixed(1)}m` : existingJson.stationEdgeDistance,
          gisMutationConfirmed: {
            ...(existingJson.gisMutationConfirmed && typeof existingJson.gisMutationConfirmed === 'object'
              ? existingJson.gisMutationConfirmed
              : {}),
            type: 'BOUNDARY_ADJUST',
            isConfirmed: true,
            confirmedByAdminId: userId,
            confirmedAt: new Date().toISOString(),
            oldAreaM2,
            newAreaM2,
            deltaAreaM2,
            notes: reason.trim(),
          },
          _lastGeometryReshape: {
            mutationCode: reshapeMutationCode,
            userId,
            timestamp: new Date().toISOString(),
            reason: reason.trim(),
            oldAreaM2,
            newAreaM2,
            newCenterlineDist,
            newOuterBoundaryDist,
          },
        };

        await client.query(
          `UPDATE base_survey_reports
           SET survey_data_json = $1,
               updated_at = NOW()
           WHERE id = $2;`,
          [JSON.stringify(updatedSurveyJson), rep.id]
        );
        updatedReportIds.push(rep.id);
      }

      // 8. Ghi log kiểm toán toàn trình
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
            newCenterlineDist,
            newOuterBoundaryDist,
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
        newCenterlineDist,
        newOuterBoundaryDist,
        newGeoJson: geoJsonPolygon,
        updatedReportIds,
        message: `Đã nắn chỉnh ranh giới thửa đất [${parcel.project_parcel_code}] thành công. Diện tích mới: ${newAreaM2} m² (${deltaAreaM2 >= 0 ? '+' : ''}${deltaAreaM2} m²). Cự ly Metro: ${newCenterlineDist !== null ? newCenterlineDist.toFixed(1) + 'm' : 'N/A'}.`,
      };
    });

    // M6-02: Lưu snapshot version sau khi nắn chỉnh ranh giới GIS
    if (txResult.updatedReportIds && txResult.updatedReportIds.length > 0) {
      try {
        const { AuditVersionService } = await import('../../audit/services/audit-version.service');
        for (const repId of txResult.updatedReportIds) {
          await AuditVersionService.createSnapshot(repId, {
            versionTag: 'ADMIN_DIFF_SAVE',
            title: `Nắn chỉnh ranh giới GIS [${txResult.projectParcelCode}] (${txResult.oldAreaM2}m² → ${txResult.newAreaM2}m²)`,
            editReason: reason.trim(),
            userId,
            clientIp,
            diffSummary: [
              { field: 'parcelCoordinates', label: 'Đa giác ranh giới GIS', oldValue: `${txResult.oldAreaM2} m²`, newValue: `${txResult.newAreaM2} m²` },
              { field: 'metroOffsetDistance', label: 'Khoảng cách tới Metro', newValue: txResult.newCenterlineDist !== null ? `${txResult.newCenterlineDist.toFixed(1)}m` : null },
            ],
          });
        }
      } catch (snapErr) {
        console.error('[reshapeParcelGeometry] Không thể tạo snapshot sau nắn chỉnh GIS:', snapErr);
      }
    }

    return txResult;
  }
}
