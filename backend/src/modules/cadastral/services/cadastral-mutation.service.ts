import { PoolClient } from 'pg';
import { CadastralRepository } from '../cadastral.repository';
import { Database } from '../../../database/db';
import { NotFoundError, BadRequestError } from '../../../common/errors/problem-details';

export class CadastralMutationService {
  /**
   * Chuẩn hóa tọa độ mảng đỉnh thành Polygon GeoJSON hợp lệ (khép kín vòng và chuẩn [lng, lat])
   */
  public static toGeoJsonPolygon(points: any): any {
    if (!points) return null;
    if (points.type === 'Polygon' && Array.isArray(points.coordinates)) {
      return points;
    }
    if (!Array.isArray(points) || points.length < 3) {
      return null;
    }

    const ring = points
      .map((p: any) => {
        if (!Array.isArray(p) || p.length < 2) return null;
        const a = Number(p[0]);
        const b = Number(p[1]);
        if (isNaN(a) || isNaN(b)) return null;
        // Chuẩn tọa độ Việt Nam: Lat ~ 8-23, Lng ~ 102-110
        if (a < 50 && b > 50) {
          return [b, a]; // Đảo [lat, lng] -> [lng, lat] cho PostGIS
        }
        return [a, b];
      })
      .filter((p): p is [number, number] => p !== null);

    if (ring.length < 3) return null;

    // Khép kín polygon nếu điểm đầu khác điểm cuối
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]]);
    }

    return {
      type: 'Polygon',
      coordinates: [ring],
    };
  }

  /**
   * Primitive: Tạo mới hoặc cập nhật thực thể Đất dôi dư {Mã}-DU (NON_BUILDING)
   * Đảm bảo tính nhất quán 100% giữa thực thi của Surveyor và Admin
   */
  public static async upsertResidualLandParcel(
    client: PoolClient,
    params: {
      zoneId: string;
      parentParcelId: string;
      parentProjectCode: string;
      parentOfficialCode?: string;
      parentHouseNumber: string;
      parentStreet: string;
      parentWard?: string;
      parentDistrict?: string;
      residualAreaM2: number;
      mutationType: 'SPLIT' | 'MERGE';
      mutationEventId?: string;
      customGeomJson?: any;
    }
  ): Promise<{ id: string; projectParcelCode: string }> {
    const residualParcelCode = `${params.parentProjectCode}-DU`;
    const residualOfficialCode = `${params.parentOfficialCode || params.parentProjectCode}-DU`;
    const isMerge = params.mutationType === 'MERGE';

    const houseNumberSuffix = isMerge ? '(Đất dư sau gộp)' : '(Đất dư)';
    const ownerNameSuffix = isMerge
      ? `Chủ sở hữu đất dôi dư sau gộp (${params.parentProjectCode})`
      : `Chủ sở hữu đất dôi dư (${params.parentProjectCode})`;

    const checkExisting = await client.query<{ id: string }>(
      `SELECT id FROM parcels WHERE project_parcel_code = $1;`,
      [residualParcelCode]
    );

    if (checkExisting.rows[0]) {
      await client.query(
        `UPDATE parcels
         SET land_area_m2 = $1,
             construction_area_m2 = 0,
             mutation_type = $2,
             mutation_event_id = COALESCE($3, mutation_event_id),
             updated_at = NOW()
         WHERE id = $4;`,
        [params.residualAreaM2, params.mutationType, params.mutationEventId || null, checkExisting.rows[0].id]
      );
      return { id: checkExisting.rows[0].id, projectParcelCode: residualParcelCode };
    }

    let geomExpr: string;
    let queryParams: any[];

    if (params.customGeomJson) {
      const geoStr = typeof params.customGeomJson === 'string' ? params.customGeomJson : JSON.stringify(params.customGeomJson);
      geomExpr = `ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($12), 4326)), 3), 1)`;
      queryParams = [
        params.zoneId,
        residualParcelCode,
        residualOfficialCode,
        `${params.parentHouseNumber} ${houseNumberSuffix}`.trim(),
        params.parentStreet,
        params.parentWard || '',
        params.parentDistrict || '',
        ownerNameSuffix,
        params.residualAreaM2,
        params.mutationEventId || null,
        params.parentParcelId,
        geoStr,
      ];
    } else {
      geomExpr = `(SELECT cadastral_polygon_geom FROM parcels WHERE id = $11)`;
      queryParams = [
        params.zoneId,
        residualParcelCode,
        residualOfficialCode,
        `${params.parentHouseNumber} ${houseNumberSuffix}`.trim(),
        params.parentStreet,
        params.parentWard || '',
        params.parentDistrict || '',
        ownerNameSuffix,
        params.residualAreaM2,
        params.mutationEventId || null,
        params.parentParcelId,
      ];
    }

    const resParcel = await client.query<{ id: string }>(
      `INSERT INTO parcels (
         zone_id, project_parcel_code, official_cadastral_code,
         house_number, street, ward, district,
         owner_name, owner_phone,
         land_area_m2, construction_area_m2,
         survey_status, lifecycle_status,
         mutation_type, mutation_event_id, parent_parcel_ids,
         cadastral_polygon_geom, footprint_polygon_geom, location_geom
       ) VALUES (
         $1, $2, $3,
         $4, $5, $6, $7,
         $8, '',
         $9, 0,
         'NOT_SURVEYED', 'ACTIVE',
         '${params.mutationType}', $10, ARRAY[$11::uuid],
         ${geomExpr},
         ${geomExpr},
         ST_Centroid(${geomExpr})
       ) RETURNING id;`,
      queryParams
    );

    return { id: resParcel.rows[0].id, projectParcelCode: residualParcelCode };
  }

  /**
   * @deprecated Giai đoạn prototype cũ. Hiện tại quy trình biến động hiện trường được nộp kèm qua Phase 1 Survey Report và quản trị viên thực thi trực tiếp qua executeAdminMutation.
   */
  static async proposeMutation(surveyorId: string, data: any) {
    return Database.transaction(async (client) => {
      const mutationCode = `MUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const resultParcelIds: string[] = [];
      const createdParcels: any[] = [];

      for (const child of data.childParcels) {
        const nextCode = await CadastralRepository.getNextHighRangeProjectCode(client);
        const geoJsonStr = typeof child.polygonGeoJson === 'string' ? child.polygonGeoJson : JSON.stringify(child.polygonGeoJson);

        const pRes = await client.query<{ id: string; project_parcel_code: string }>(
          `INSERT INTO parcels (
             zone_id, project_parcel_code, house_number, street, owner_name, owner_phone,
             land_area_m2, floor_count, cadastral_polygon_geom, footprint_polygon_geom,
             survey_status, lifecycle_status, mutation_type, parent_parcel_ids
           ) VALUES (
             (SELECT zone_id FROM parcels WHERE id = $1),
             $2, $3, $4, $5, $6, $7, $8,
             ST_SetSRID(ST_GeomFromGeoJSON($9), 4326),
             ST_SetSRID(ST_GeomFromGeoJSON($9), 4326),
             'NOT_SURVEYED', 'PENDING_MUTATION_APPROVAL', $10, $11
           ) RETURNING id, project_parcel_code;`,
          [
            data.sourceParcelIds[0],
            nextCode,
            child.houseNumber || null,
            child.street || null,
            child.ownerName || null,
            child.ownerPhone || null,
            child.landAreaM2,
            child.floorCount || 1,
            geoJsonStr,
            data.mutationType,
            data.sourceParcelIds,
          ]
        );

        resultParcelIds.push(pRes.rows[0].id);
        createdParcels.push(pRes.rows[0]);
      }

      // Tạo sự kiện mutation
      const mutRes = await client.query<{ id: string }>(
        `INSERT INTO parcel_mutation_events (
           mutation_code, mutation_type, source_parcel_ids, result_parcel_ids,
           surveyor_notes, surveyor_id, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'PROPOSED_BY_SURVEYOR')
         RETURNING id;`,
        [
          mutationCode,
          data.mutationType,
          data.sourceParcelIds,
          resultParcelIds,
          data.surveyorNotes,
          surveyorId,
        ]
      );

      return {
        mutationEventId: mutRes.rows[0].id,
        mutationCode,
        mutationType: data.mutationType,
        sourceParcelIds: data.sourceParcelIds,
        generatedParcels: createdParcels,
        status: 'PROPOSED_BY_SURVEYOR',
        message: 'Đã đề xuất biến động và cấp mã từ kho số mở rộng thành công, chờ Zone Admin phê duyệt',
      };
    });
  }

  /**
   * Phê duyệt hoặc Bác bỏ Biến động Tách thửa (có Rollback)
   */
  static async approveOrRejectMutation(
    mutationId: string,
    adminId: string,
    action: 'APPROVE' | 'REJECT',
    rejectionReason?: string
  ) {
    return Database.transaction(async (client) => {
      const mutRes = await client.query<{
        id: string;
        mutation_type: string;
        source_parcel_ids: string[];
        result_parcel_ids: string[];
        status: string;
      }>(
        `SELECT * FROM parcel_mutation_events WHERE id = $1 FOR UPDATE;`,
        [mutationId]
      );

      const mutation = mutRes.rows[0];
      if (!mutation) {
        throw new NotFoundError(`Không tìm thấy sự kiện biến động với ID: ${mutationId}`);
      }

      if (action === 'APPROVE') {
        // Kích hoạt các thửa mới phát sinh
        await client.query(
          `UPDATE parcels SET lifecycle_status = 'ACTIVE' WHERE id = ANY($1);`,
          [mutation.result_parcel_ids]
        );

        // Chuyển thửa gốc sang SPLIT_DEPRECATED
        await client.query(
          `UPDATE parcels SET lifecycle_status = 'SPLIT_DEPRECATED' WHERE id = ANY($1);`,
          [mutation.source_parcel_ids]
        );

        await client.query(
          `UPDATE parcel_mutation_events
           SET status = 'APPROVED', zone_admin_id = $2, approved_at = NOW()
           WHERE id = $1;`,
          [mutationId, adminId]
        );

        return {
          mutationId,
          status: 'APPROVED',
          message: 'Đã phê duyệt biến động tách thửa thành công',
        };
      } else {
        // Bác bỏ: Rollback hoàn nguyên các thửa phát sinh về MUTATION_VOID
        await client.query(
          `UPDATE parcels SET lifecycle_status = 'MUTATION_VOID' WHERE id = ANY($1);`,
          [mutation.result_parcel_ids]
        );

        // Khôi phục thửa gốc về ACTIVE
        await client.query(
          `UPDATE parcels SET lifecycle_status = 'ACTIVE' WHERE id = ANY($1);`,
          [mutation.source_parcel_ids]
        );

        await client.query(
          `UPDATE parcel_mutation_events
           SET status = 'REJECTED', zone_admin_id = $2, rejection_reason = $3
           WHERE id = $1;`,
          [mutationId, adminId, rejectionReason || 'Zone Admin từ chối']
        );

        return {
          mutationId,
          status: 'REJECTED',
          message: 'Đã bác bỏ đề xuất tách thửa và rollback dữ liệu an toàn',
        };
      }
    });
  }

  /**
   * Lấy danh sách mã dự án tiếp theo dựa trên Max của chính Zone đó (Cơ chế Max Zone + 1)
   */
  static async getNextHighRangeCodes(count: number = 2, zoneId?: string, parcelId?: string) {
    let resolvedZoneId = zoneId;
    let parentParcelCode = '';

    if (parcelId) {
      const p = await CadastralRepository.findById(parcelId);
      if (p) {
        resolvedZoneId = resolvedZoneId || p.zone_id;
        parentParcelCode = p.project_parcel_code;
      }
    }

    let parentPrefix = '';
    if (parentParcelCode) {
      const pMatch = parentParcelCode.match(/^(.*?)(\d+)$/);
      if (pMatch) {
        parentPrefix = pMatch[1];
      }
    }

    let query = `SELECT project_parcel_code FROM parcels WHERE 1=1`;
    const params: any[] = [];
    if (resolvedZoneId) {
      params.push(resolvedZoneId);
      query += ` AND zone_id = $${params.length}`;
    }
    if (parentPrefix) {
      params.push(`${parentPrefix}%`);
      query += ` AND project_parcel_code LIKE $${params.length}`;
    }
    query += ` ORDER BY substring(project_parcel_code from '[0-9]+$')::integer DESC NULLS LAST LIMIT 1;`;

    const res = await Database.query<{ project_parcel_code: string }>(query, params);

    let prefix = parentPrefix || 'B-';
    let padLen = 4;
    let nextNum = 1;
    let currentMaxCode = '';

    if (res.rows.length > 0 && res.rows[0].project_parcel_code) {
      currentMaxCode = res.rows[0].project_parcel_code;
      const match = currentMaxCode.match(/^(.*?)(\d+)$/);
      if (match) {
        prefix = match[1];
        padLen = Math.max(match[2].length, 4);
        nextNum = parseInt(match[2], 10) + 1;
      }
    } else if (parentParcelCode) {
      const match = parentParcelCode.match(/^(.*?)(\d+)$/);
      if (match) {
        prefix = match[1];
        padLen = Math.max(match[2].length, 4);
        nextNum = parseInt(match[2], 10) + 1;
      }
    }

    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(`${prefix}${String(nextNum + i).padStart(padLen, '0')}`);
    }

    return {
      baseNextNum: nextNum,
      codes,
      currentMaxCode,
      nextCode: codes[0],
      zoneId: resolvedZoneId || 'ZONE_01',
    };
  }

  /**
   * Zone Admin trực tiếp thực thi Tách / Gộp Thửa trên GIS (tự động phê duyệt)
   */
  static async executeAdminMutation(
    adminId: string,
    data: {
      mutationType: 'SPLIT' | 'MERGE';
      sourceParcelIds: string[];
      childParcels?: Array<{
        projectParcelCode?: string;
        houseNumber?: string;
        street?: string;
        ownerName?: string;
        ownerPhone?: string;
        landAreaM2?: number;
        floorCount?: number;
        polygonGeoJson?: any;
        residualKind?: 'NON_BUILDING' | 'NEW_BUILDING';
      }>;
      adminNotes?: string;
      transferSurveyReportId?: string;
      mergeHasPartialBuilding?: boolean;
      mergeBuildingAreaM2?: number;
      mergeResidualAreaM2?: number;
      mergeBuildingCustomPoints?: any;
    },
    clientIp?: string
  ) {
    return Database.transaction(async (client) => {
      const mutationCode = `ADM-MUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      if (!data.sourceParcelIds || data.sourceParcelIds.length === 0) {
        throw new BadRequestError('Danh sách thửa đất nguồn (sourceParcelIds) không được để trống');
      }

      // ==========================================
      // NHÁNH 1: GỘP THỬA (MERGE)
      // ==========================================
      if (data.mutationType === 'MERGE') {
        if (data.sourceParcelIds.length < 2) {
          throw new BadRequestError('Cần ít nhất 2 thửa đất để thực hiện gộp thửa');
        }

        // 1. Khóa và kiểm tra các thửa nguồn
        const srcRes = await client.query<{
          id: string;
          zone_id: string;
          project_parcel_code: string;
          official_cadastral_code: string;
          house_number: string;
          street: string;
          ward: string;
          district: string;
          land_area_m2: number;
          survey_status: string;
          active_phase1_report_id: string | null;
        }>(
          `SELECT id, zone_id, project_parcel_code, official_cadastral_code, house_number, street, ward, district,
                  land_area_m2, survey_status, active_phase1_report_id
           FROM parcels
           WHERE id = ANY($1) FOR UPDATE;`,
          [data.sourceParcelIds]
        );

        if (srcRes.rows.length < 2) {
          throw new NotFoundError('Không tìm thấy đủ các thửa đất nguồn trong CSDL để gộp');
        }

        const zoneId = srcRes.rows[0].zone_id;
        if (srcRes.rows.some((r) => r.zone_id !== zoneId)) {
          throw new BadRequestError('Tất cả các thửa đất gộp phải thuộc cùng một phân khu (zone)');
        }

        // 2. Xác định Thửa chính (ưu tiên thửa đang gắn báo cáo khảo sát, hoặc thửa có mã nhỏ nhất)
        let primaryParcel = srcRes.rows.find(
          (r) => data.transferSurveyReportId && r.active_phase1_report_id === data.transferSurveyReportId
        );
        if (!primaryParcel) {
          primaryParcel = srcRes.rows.find((r) => r.active_phase1_report_id != null);
        }
        if (!primaryParcel) {
          primaryParcel = [...srcRes.rows].sort((a, b) =>
            a.project_parcel_code.localeCompare(b.project_parcel_code, undefined, { numeric: true })
          )[0];
        }

        const secondaryParcels = srcRes.rows.filter((r) => r.id !== primaryParcel!.id);
        const secondaryParcelIds = secondaryParcels.map((r) => r.id);
        const totalLandArea = srcRes.rows.reduce((sum, r) => sum + (Number(r.land_area_m2) || 0), 0);

        // 3. Phân tích tùy chọn "Có đất dôi dư"
        const hasPartialBuilding = data.mergeHasPartialBuilding === true;
        let finalPrimaryArea = totalLandArea;
        let residualAreaM2 = 0;

        if (hasPartialBuilding) {
          finalPrimaryArea = Number(data.mergeBuildingAreaM2) || Math.round(totalLandArea * 0.65 * 10) / 10;
          residualAreaM2 = Number(data.mergeResidualAreaM2) || Math.max(0.1, Math.round((totalLandArea - finalPrimaryArea) * 10) / 10);
        }

        // 4. Cập nhật Thửa chính: Hợp nhất đa giác ST_Union và cập nhật diện tích
        await client.query(
          `UPDATE parcels
           SET cadastral_polygon_geom = COALESCE(
                 (SELECT ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_Union(cadastral_polygon_geom)), 3), 1)
                  FROM parcels WHERE id = ANY($1)),
                 cadastral_polygon_geom
               ),
               footprint_polygon_geom = COALESCE(
                 (SELECT ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_Union(footprint_polygon_geom)), 3), 1)
                  FROM parcels WHERE id = ANY($1)),
                 footprint_polygon_geom
               ),
               location_geom = COALESCE(
                 (SELECT ST_Centroid(ST_Union(cadastral_polygon_geom))
                  FROM parcels WHERE id = ANY($1)),
                 location_geom
               ),
               land_area_m2 = $2,
               construction_area_m2 = $2,
               mutation_type = 'MERGE',
               child_parcel_ids = $3,
               updated_at = NOW()
           WHERE id = $4;`,
          [data.sourceParcelIds, finalPrimaryArea, secondaryParcelIds, primaryParcel.id]
        );

        const resultParcelIds: string[] = [primaryParcel.id];

        // 5. Nếu "Xây dựng 1 phần có đất dôi dư": Tự động sinh thửa {Mã}-DU
        if (hasPartialBuilding && residualAreaM2 > 0) {
          const residualResult = await CadastralMutationService.upsertResidualLandParcel(client, {
            zoneId: primaryParcel.zone_id,
            parentParcelId: primaryParcel.id,
            parentProjectCode: primaryParcel.project_parcel_code,
            parentOfficialCode: primaryParcel.official_cadastral_code,
            parentHouseNumber: primaryParcel.house_number,
            parentStreet: primaryParcel.street,
            parentWard: primaryParcel.ward,
            parentDistrict: primaryParcel.district,
            residualAreaM2,
            mutationType: 'MERGE',
          });
          resultParcelIds.push(residualResult.id);
        }

        // 6. Đánh dấu các thửa phụ thành MERGED_DEPRECATED
        await client.query(
          `UPDATE parcels
           SET lifecycle_status = 'MERGED_DEPRECATED',
               mutation_type = 'MERGE',
               parent_parcel_ids = ARRAY[$1::uuid],
               active_phase1_report_id = NULL,
               updated_at = NOW()
           WHERE id = ANY($2);`,
          [primaryParcel.id, secondaryParcelIds]
        );

        // 7. Nếu có hồ sơ khảo sát cần gán hoặc di chuyển sang thửa chính
        if (data.transferSurveyReportId) {
          await client.query(
            `UPDATE base_survey_reports SET parcel_id = $1, updated_at = NOW() WHERE id = $2;`,
            [primaryParcel.id, data.transferSurveyReportId]
          );
          await client.query(
            `UPDATE parcels SET active_phase1_report_id = $1, survey_status = 'SUBMITTED', updated_at = NOW() WHERE id = $2;`,
            [data.transferSurveyReportId, primaryParcel.id]
          );
        }

        // 8. Ghi vết parcel_mutation_events
        const mutRes = await client.query<{ id: string }>(
          `INSERT INTO parcel_mutation_events (
             mutation_code, mutation_type, source_parcel_ids, result_parcel_ids,
             surveyor_notes, surveyor_id, zone_admin_id, status, approved_at
           ) VALUES ($1, 'MERGE', $2, $3, $4, $5, $5, 'APPROVED', NOW())
           RETURNING id;`,
          [
            mutationCode,
            data.sourceParcelIds,
            resultParcelIds,
            data.adminNotes || `Zone Admin gộp ${data.sourceParcelIds.length} thửa thành 1 thửa đại diện [${primaryParcel.project_parcel_code}]`,
            adminId,
          ]
        );

        // 9. Ghi log kiểm toán
        await client.query(
          `INSERT INTO system_audit_logs (
             entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
           ) VALUES ($1, $2, $3, $4, $5, $6);`,
          [
            'PARCEL',
            primaryParcel.id,
            'ZONE_ADMIN_EXECUTE_MUTATION_MERGE',
            adminId,
            JSON.stringify({
              mutationCode,
              mutationType: 'MERGE',
              sourceParcelIds: data.sourceParcelIds,
              primaryParcelId: primaryParcel.id,
              primaryParcelCode: primaryParcel.project_parcel_code,
              secondaryParcelIds,
              totalLandArea,
              hasPartialBuilding,
              residualAreaM2,
              adminNotes: data.adminNotes || null,
              timestamp: new Date().toISOString(),
            }),
            clientIp || null,
          ]
        );

        return {
          success: true,
          mutationEventId: mutRes.rows[0].id,
          mutationCode,
          mutationType: 'MERGE',
          sourceParcelIds: data.sourceParcelIds,
          primaryParcel: {
            id: primaryParcel.id,
            projectParcelCode: primaryParcel.project_parcel_code,
            totalLandArea: finalPrimaryArea,
          },
          status: 'APPROVED',
          message: `Đã gộp thành công ${data.sourceParcelIds.length} thửa đất vào thửa đại diện [${primaryParcel.project_parcel_code}] (${finalPrimaryArea} m²)${hasPartialBuilding ? ` kèm đất dôi dư (${residualAreaM2} m²)` : ''}`,
        };
      }

      // ==========================================
      // NHÁNH 2: TÁCH THỬA (SPLIT)
      // ==========================================
      if (!data.childParcels || data.childParcels.length < 2) {
        throw new BadRequestError('Tách thửa yêu cầu khai báo ít nhất 2 thửa con phát sinh');
      }

      // 1. Khóa và kiểm tra thửa cha
      const parentRes = await client.query<{
        id: string;
        zone_id: string;
        project_parcel_code: string;
        house_number: string;
        street: string;
        ward: string;
        district: string;
        owner_name: string;
        owner_phone: string;
        land_area_m2: number;
        survey_status: string;
        cadastral_geojson: string;
      }>(
        `SELECT id, zone_id, project_parcel_code, house_number, street, ward, district,
                owner_name, owner_phone, land_area_m2, survey_status,
                ST_AsGeoJSON(cadastral_polygon_geom) AS cadastral_geojson
         FROM parcels WHERE id = $1 FOR UPDATE;`,
        [data.sourceParcelIds[0]]
      );

      const parent = parentRes.rows[0];
      if (!parent) {
        throw new NotFoundError('Không tìm thấy thửa đất cha để thực hiện tách thửa');
      }

      const zoneId = parent.zone_id;
      const resultParcelIds: string[] = [];
      const createdParcels: any[] = [];
      const totalChildArea = data.childParcels.reduce((sum, c) => sum + (Number(c.landAreaM2) || 0), 0);

      // 2. Xử lý các thửa con:
      // - Căn A (idx === 0): Thửa chính / Nhà chính giữ nguyên ID gốc và mã dự án gốc
      // - Căn B, C... (idx > 0): Sinh mã mới theo cơ chế Max Zone + 1
      const childParcelsCreatedOrUpdated: any[] = [];
      const newChildIdsOnly: string[] = [];

      for (let idx = 0; idx < data.childParcels.length; idx++) {
        const child = data.childParcels[idx];

        const isMockCoord =
          child.polygonGeoJson &&
          child.polygonGeoJson.coordinates &&
          child.polygonGeoJson.coordinates[0] &&
          child.polygonGeoJson.coordinates[0][0] &&
          child.polygonGeoJson.coordinates[0][0][0] === 106.71;

        const ratio = Math.max(0.1, Math.min(0.9, (Number(child.landAreaM2) || 1) / (totalChildArea || 1)));

        if (idx === 0) {
          // CĂN A: THỬA GỐC / NHÀ CHÍNH
          let geomUpdateExpr: string;
          const updateParams: any[] = [
            child.landAreaM2 ? Number(child.landAreaM2) : parent.land_area_m2,
            child.houseNumber || parent.house_number,
            child.ownerName || parent.owner_name,
            child.ownerPhone || parent.owner_phone,
            parent.id,
          ];

          if (child.polygonGeoJson && !isMockCoord) {
            updateParams.push(typeof child.polygonGeoJson === 'string' ? child.polygonGeoJson : JSON.stringify(child.polygonGeoJson));
            const gIdx = updateParams.length;
            geomUpdateExpr = `ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($${gIdx}), 4326)), 3), 1)`;
          } else {
            geomUpdateExpr = `COALESCE(
              ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_Intersection(
                (SELECT cadastral_polygon_geom FROM parcels WHERE id = $5),
                ST_MakeEnvelope(
                  ST_XMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $5)),
                  ST_YMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $5)),
                  ST_XMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $5)) + (ST_XMax((SELECT cadastral_polygon_geom FROM parcels WHERE id = $5)) - ST_XMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $5))) * ${ratio},
                  ST_YMax((SELECT cadastral_polygon_geom FROM parcels WHERE id = $5)),
                  4326
                )
              )), 3), 1),
              (SELECT cadastral_polygon_geom FROM parcels WHERE id = $5)
            )`;
          }

          await client.query(
            `UPDATE parcels
             SET land_area_m2 = $1,
                 construction_area_m2 = $1,
                 house_number = $2,
                 owner_name = $3,
                 owner_phone = $4,
                 cadastral_polygon_geom = ${geomUpdateExpr},
                 footprint_polygon_geom = ${geomUpdateExpr},
                 location_geom = ST_Centroid(${geomUpdateExpr}),
                 mutation_type = 'SPLIT',
                 lifecycle_status = 'ACTIVE',
                 updated_at = NOW()
             WHERE id = $5;`,
            updateParams
          );

          resultParcelIds.push(parent.id);
          childParcelsCreatedOrUpdated.push({
            id: parent.id,
            projectParcelCode: parent.project_parcel_code,
            role: 'PRIMARY_A',
            isRetainedParent: true,
          });
          createdParcels.push({
            id: parent.id,
            project_parcel_code: parent.project_parcel_code,
            role: 'PRIMARY_A',
          });
        } else {
          // CĂN B, C...: THỬA PHÁT SINH MỚI
          const isResidualLand =
            child.residualKind === 'NON_BUILDING' ||
            (child.projectParcelCode && child.projectParcelCode.endsWith('-DU'));

          const bArea = child.landAreaM2 ? Number(child.landAreaM2) : 0;

          if (isResidualLand) {
            const residualResult = await CadastralMutationService.upsertResidualLandParcel(client, {
              zoneId,
              parentParcelId: parent.id,
              parentProjectCode: parent.project_parcel_code,
              parentOfficialCode: parent.project_parcel_code,
              parentHouseNumber: parent.house_number,
              parentStreet: child.street || parent.street,
              parentWard: parent.ward,
              parentDistrict: parent.district,
              residualAreaM2: bArea,
              mutationType: 'SPLIT',
              customGeomJson: child.polygonGeoJson && !isMockCoord ? child.polygonGeoJson : undefined,
            });

            resultParcelIds.push(residualResult.id);
            newChildIdsOnly.push(residualResult.id);
            createdParcels.push({
              id: residualResult.id,
              project_parcel_code: residualResult.projectParcelCode,
            });
          } else {
            let code = child.projectParcelCode?.trim();
            if (!code) {
              code = await CadastralRepository.getNextHighRangeProjectCode(
                client,
                zoneId,
                parent.project_parcel_code
              );
            }

            const bHouseNumber = child.houseNumber || (parent.house_number ? `${parent.house_number}${String.fromCharCode(65 + idx)}` : 'KĐ');
            const bOwnerName = child.ownerName || `Chủ hộ Căn ${String.fromCharCode(65 + idx)} (${code})`;
            const bConstructionArea = bArea;
            const bFloorCount = child.floorCount || 1;

            const insertParams: any[] = [
              zoneId,                        // $1
              code,                          // $2
              bHouseNumber,                  // $3
              child.street || parent.street, // $4
              parent.ward,                   // $5
              parent.district,               // $6
              bOwnerName,                    // $7
              child.ownerPhone || null,      // $8
              bArea,                         // $9
              bConstructionArea,             // $10
              bFloorCount,                   // $11
              parent.id,                     // $12
            ];

            let bGeomExpr: string;
            if (child.polygonGeoJson && !isMockCoord) {
              insertParams.push(typeof child.polygonGeoJson === 'string' ? child.polygonGeoJson : JSON.stringify(child.polygonGeoJson));
              const gIdx = insertParams.length;
              bGeomExpr = `ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($${gIdx}), 4326)), 3), 1)`;
            } else {
              bGeomExpr = `COALESCE(
                ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_Difference(
                  (SELECT cadastral_polygon_geom FROM parcels WHERE id = $12),
                  ST_MakeEnvelope(
                    ST_XMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $12)),
                    ST_YMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $12)),
                    ST_XMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $12)) + (ST_XMax((SELECT cadastral_polygon_geom FROM parcels WHERE id = $12)) - ST_XMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $12))) * (1 - ${ratio}),
                    ST_YMax((SELECT cadastral_polygon_geom FROM parcels WHERE id = $12)),
                    4326
                  )
                )), 3), 1),
                (SELECT cadastral_polygon_geom FROM parcels WHERE id = $12)
              )`;
            }

            const pRes = await client.query<{ id: string; project_parcel_code: string }>(
              `INSERT INTO parcels (
                 zone_id, project_parcel_code, house_number, street, ward, district,
                 owner_name, owner_phone, land_area_m2, construction_area_m2, floor_count,
                 cadastral_polygon_geom, footprint_polygon_geom, location_geom,
                 survey_status, lifecycle_status, mutation_type, parent_parcel_ids
               ) VALUES (
                 $1, $2, $3, $4, $5, $6,
                 $7, $8, $9, $10, $11,
                 ${bGeomExpr},
                 ${bGeomExpr},
                 ST_Centroid(${bGeomExpr}),
                 'NOT_SURVEYED', 'ACTIVE', 'SPLIT', ARRAY[$12::uuid]
               ) RETURNING id, project_parcel_code;`,
              insertParams
            );

            const newChildId = pRes.rows[0].id;
            resultParcelIds.push(newChildId);
            newChildIdsOnly.push(newChildId);
            createdParcels.push(pRes.rows[0]);

            // Nếu là căn nhà mới độc lập và thửa cha có surveyor phân công, tự động tạo task assignment
            const surveyorRes = await client.query<{ assigned_surveyor_id: string }>(
              `SELECT assigned_surveyor_id FROM parcels WHERE id = $1;`,
              [parent.id]
            );
            const assignedSurveyorId = surveyorRes.rows[0]?.assigned_surveyor_id;
            if (assignedSurveyorId) {
              await client.query(
                `INSERT INTO task_assignments (
                   parcel_id, surveyor_id, assigned_by_admin_id, deadline, status, notes
                 ) VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', 'ASSIGNED', $4);`,
                [
                  newChildId,
                  assignedSurveyorId,
                  adminId,
                  `Zone Admin phân công khảo sát Căn B mới [${code}] phát sinh từ tách thửa [${parent.project_parcel_code}]`,
                ]
              );
            }
          }
        }
      }

      // 3. Cập nhật child_parcel_ids cho thửa mẹ (Căn A)
      if (newChildIdsOnly.length > 0) {
        await client.query(
          `UPDATE parcels 
           SET child_parcel_ids = $1,
               updated_at = NOW() 
           WHERE id = $2;`,
          [newChildIdsOnly, parent.id]
        );
      }

      // 5. Lưu sự kiện biến động vào parcel_mutation_events
      const mutRes = await client.query<{ id: string }>(
        `INSERT INTO parcel_mutation_events (
           mutation_code, mutation_type, source_parcel_ids, result_parcel_ids,
           surveyor_notes, surveyor_id, zone_admin_id, status, approved_at
         ) VALUES ($1, 'SPLIT', ARRAY[$2::uuid], $3, $4, $5, $5, 'APPROVED', NOW())
         RETURNING id;`,
        [
          mutationCode,
          parent.id,
          resultParcelIds,
          data.adminNotes || `Zone Admin tách thửa [${parent.project_parcel_code}] thành ${resultParcelIds.length} thửa con`,
          adminId,
        ]
      );

      // 6. Ghi log kiểm toán
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'PARCEL',
          parent.id,
          'ZONE_ADMIN_EXECUTE_MUTATION_SPLIT',
          adminId,
          JSON.stringify({
            mutationCode,
            mutationType: 'SPLIT',
            sourceParcelId: parent.id,
            sourceParcelCode: parent.project_parcel_code,
            resultParcelIds,
            createdParcels,
            transferSurveyReportId: data.transferSurveyReportId || null,
            adminNotes: data.adminNotes || null,
            timestamp: new Date().toISOString(),
          }),
          clientIp || null,
        ]
      );

      return {
        success: true,
        mutationEventId: mutRes.rows[0].id,
        mutationCode,
        mutationType: 'SPLIT',
        sourceParcelIds: [parent.id],
        generatedParcels: createdParcels,
        status: 'APPROVED',
        message: `Đã thực thi tách thửa [${parent.project_parcel_code}] thành ${createdParcels.length} thửa con (${createdParcels.map((c) => c.project_parcel_code).join(', ')}) thành công`,
      };
    });
  }
}
