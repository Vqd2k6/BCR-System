import { PoolClient } from 'pg';
import { Database } from '../../../database/db';
import { CadastralMutationService } from '../../cadastral/services/cadastral-mutation.service';

export class SurveyMutationRepository {
  /**
   * Chuẩn hóa tọa độ mảng đỉnh thành Polygon GeoJSON hợp lệ (kế thừa từ CadastralMutationService)
   */
  public static toGeoJsonPolygon(points: any): any {
    return CadastralMutationService.toGeoJsonPolygon(points);
  }


  /**
   * Lấy mã dự án kế tiếp cho Zone (Cơ chế Max Zone + 1)
   */
  public static async getNextZoneProjectCode(client: PoolClient, zoneId: string): Promise<string> {
    const zoneNumMatch = zoneId.match(/\d+/);
    const zNum = zoneNumMatch ? zoneNumMatch[0].padStart(2, '0') : '01';
    const prefix = `B-${zNum}`;

    const maxCodeRes = await client.query<{ max_num: number }>(
      `SELECT COALESCE(MAX(SUBSTRING(project_parcel_code FROM '[0-9]+$')::int), 0) AS max_num
       FROM parcels
       WHERE zone_id = $1 AND project_parcel_code LIKE $2;`,
      [zoneId, `${prefix}%`]
    );

    let nextNum = (maxCodeRes.rows[0]?.max_num || 0) + 1;
    if (nextNum < 1000) {
      nextNum = Number(`${zNum}001`);
    }
    return `B-${String(nextNum).padStart(5, '0')}`;
  }

  /**
   * Xử lý Biến động Tách Thửa Thực Địa theo quy chuẩn 2 Nhánh & Bảo đảm 100% Truy Vết:
   * - Hỗ trợ phân giải 2 chiều: đọc từ cả rawMutation phẳng lẫn rawMutation.details từ UI Step 5.
   * - Căn A (ngôi nhà đang KS): Kế thừa 100% mã gốc, ranh đất thu gọn theo diện tích Căn A.
   * - Nhánh 1 (Đất dư / Sân vườn): Tự động sinh thửa đất dư {Mã}-DU để quản lý đền bù.
   * - Nhánh 2 (Căn nhà mới độc lập): Cấp mã mới B-01xxx (Max Zone + 1), tạo lô mới và phân công cho KSV.
   */
  public static async handleFieldSplitMutation(
    client: PoolClient,
    reportId: string,
    rawMutation: any
  ): Promise<void> {
    const pRes = await client.query<{
      parcel_id: string;
      surveyor_id: string;
      zone_id: string;
      project_parcel_code: string;
      official_cadastral_code: string;
      house_number: string;
      street: string;
      ward: string;
      district: string;
      land_area_m2: number;
      original_geom_json: string;
    }>(
      `SELECT r.parcel_id, r.surveyor_id,
              p.zone_id, p.project_parcel_code, p.official_cadastral_code,
              p.house_number, p.street, p.ward, p.district, p.land_area_m2,
              ST_AsGeoJSON(p.cadastral_polygon_geom) AS original_geom_json
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       WHERE r.id = $1;`,
      [reportId]
    );

    if (!pRes.rows[0]) {
      console.warn(`[handleFieldSplitMutation] Không tìm thấy thông tin thửa đất cho báo cáo: ${reportId}`);
      return;
    }

    const {
      parcel_id: originalParcelId,
      surveyor_id: surveyorId,
      zone_id: zoneId,
      project_parcel_code: originalProjectParcelCode,
      official_cadastral_code: origOfficialCode,
      house_number: origHouseNumber,
      street: origStreet,
      ward: origWard,
      district: origDistrict,
      land_area_m2: origLandArea,
      original_geom_json: origGeomJson,
    } = pRes.rows[0];

    const details = rawMutation?.details || {};
    const splitChildren = Array.isArray(details.splitChildren) ? details.splitChildren : [];

    // 1. Phân giải diện tích Căn A và Căn B
    let areaA = Number(
      splitChildren[0]?.areaM2 ||
      details.splitAreaA ||
      details.subdividedAreaM2 ||
      rawMutation.portionAAreaM2 ||
      rawMutation.subdividedAreaM2
    ) || 0;

    let areaB = Number(
      splitChildren[1]?.areaM2 ||
      details.splitAreaB ||
      details.residualAreaM2 ||
      rawMutation.portionBAreaM2 ||
      rawMutation.residualAreaM2
    ) || 0;

    if (areaA <= 0 && origLandArea > 0) {
      areaA = Math.round(Number(origLandArea) * 0.6 * 10) / 10;
      areaB = Math.max(0.1, Math.round((Number(origLandArea) - areaA) * 10) / 10);
    }

    // 2. Phân loại nhánh Căn B: NEW_BUILDING (Nhà mới độc lập) vs NON_BUILDING (Đất dôi dư/Sân vườn)
    const isNewStructure =
      details.residualKind === 'NEW_BUILDING' ||
      splitChildren[1]?.residualKind === 'NEW_BUILDING' ||
      rawMutation.splitType === 'NEW_STRUCTURE' ||
      rawMutation.isNewStructure === true;

    // 3. Phân giải tọa độ Polygon Căn A và Căn B
    const pointsA =
      details.splitCustomPointsA ||
      splitChildren[0]?.coordinates ||
      rawMutation.portionAPolygon ||
      rawMutation.subdividedPolygon;

    const pointsB =
      details.splitCustomPointsB ||
      splitChildren[1]?.coordinates ||
      rawMutation.portionBPolygon ||
      rawMutation.residualPolygon;

    const geomA = this.toGeoJsonPolygon(pointsA);
    const geomB = this.toGeoJsonPolygon(pointsB);
    const originalGeom = origGeomJson ? JSON.parse(origGeomJson) : null;

    const splitReason =
      details.splitReason ||
      rawMutation.notes ||
      rawMutation.reason ||
      'Khảo sát hiện trường phát hiện thửa đất thực tế bị chia tách';

    // 4. Tạo bản ghi biến động trong parcel_mutation_events
    const mutationCode = `MUT-SPLIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const mutEventRes = await client.query<{ id: string }>(
      `INSERT INTO parcel_mutation_events (
         mutation_code, mutation_type, source_parcel_ids, result_parcel_ids,
         surveyor_notes, surveyor_id, status, approved_at
       ) VALUES ($1, 'SPLIT', $2, $3, $4, $5, 'APPROVED', NOW())
       RETURNING id;`,
      [
        mutationCode,
        [originalParcelId],
        [originalParcelId],
        `Tách thửa thực địa từ [${originalProjectParcelCode}]. Phân loại Căn B: ${isNewStructure ? 'Căn nhà mới độc lập' : 'Đất dư / Sân vườn'}. Lý do: ${splitReason}`,
        surveyorId,
      ]
    );
    const mutationEventId = mutEventRes.rows[0].id;

    // 5. Cập nhật Thửa A (Kế thừa mã gốc, cập nhật diện tích thực và ranh hình học Căn A)
    if (geomA) {
      await client.query(
        `UPDATE parcels
         SET land_area_m2 = $1,
             construction_area_m2 = $1,
             cadastral_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326),
             footprint_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326),
             location_geom = ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)),
             mutation_event_id = $3,
             mutation_type = 'SPLIT',
             survey_status = 'SUBMITTED',
             updated_at = NOW()
         WHERE id = $4;`,
        [areaA, JSON.stringify(geomA), mutationEventId, originalParcelId]
      );
    } else {
      await client.query(
        `UPDATE parcels
         SET land_area_m2 = $1,
             construction_area_m2 = $1,
             mutation_event_id = $2,
             mutation_type = 'SPLIT',
             survey_status = 'SUBMITTED',
             updated_at = NOW()
         WHERE id = $3;`,
        [areaA, mutationEventId, originalParcelId]
      );
    }

    const resultParcelIds: string[] = [originalParcelId];

    // 6. Xử lý Lô B:
    if (isNewStructure) {
      // --- NHÁNH 2: CĂN NHÀ MỚI ĐỘC LẬP ---
      let portionBCode =
        splitChildren[1]?.suggestedCode && splitChildren[1]?.suggestedCode !== `${originalProjectParcelCode}-DU`
          ? splitChildren[1]?.suggestedCode
          : rawMutation.portionBProjectParcelCode;

      if (!portionBCode) {
        portionBCode = await this.getNextZoneProjectCode(client, zoneId);
      }

      const officialBCode =
        splitChildren[1]?.officialCadastralCode ||
        rawMutation.portionBOfficialCadastralCode ||
        `${origOfficialCode || originalProjectParcelCode}-B`;

      const ownerBName =
        splitChildren[1]?.ownerName ||
        rawMutation.portionBOwnerName ||
        'Chủ hộ Căn B (Cần khảo sát bổ sung)';

      const ownerBPhone = splitChildren[1]?.ownerPhone || rawMutation.portionBOwnerPhone || '';
      const houseBNum =
        splitChildren[1]?.houseNumber ||
        rawMutation.portionBHouseNumber ||
        (origHouseNumber ? `${origHouseNumber}B` : '');

      const fallbackGeom = geomB || originalGeom;

      const newParcelRes = await client.query<{ id: string }>(
        `INSERT INTO parcels (
           zone_id, project_parcel_code, official_cadastral_code,
           house_number, street, ward, district,
           owner_name, owner_phone,
           land_area_m2, construction_area_m2,
           assigned_surveyor_id, survey_status, lifecycle_status,
           mutation_type, mutation_event_id, parent_parcel_ids,
           cadastral_polygon_geom, footprint_polygon_geom, location_geom
         ) VALUES (
           $1, $2, $3,
           $4, $5, $6, $7,
           $8, $9,
           $10, $10,
           $11, 'ASSIGNED_TO_ME', 'ACTIVE',
           'SPLIT', $12, ARRAY[$13::uuid],
           ST_SetSRID(ST_GeomFromGeoJSON($14), 4326),
           ST_SetSRID(ST_GeomFromGeoJSON($14), 4326),
           ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($14), 4326))
         ) RETURNING id;`,
        [
          zoneId,
          portionBCode,
          officialBCode,
          houseBNum,
          origStreet,
          origWard,
          origDistrict,
          ownerBName,
          ownerBPhone,
          areaB,
          surveyorId,
          mutationEventId,
          originalParcelId,
          JSON.stringify(fallbackGeom),
        ]
      );

      const newParcelBId = newParcelRes.rows[0].id;
      resultParcelIds.push(newParcelBId);

      // Tự động tạo task_assignment cho chính KSV đang khảo sát để tiếp tục thực hiện
      const adminRes = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE role IN ('ZONE_ADMIN', 'SUPER_ADMIN') LIMIT 1;`
      );
      const assignerAdminId = adminRes.rows[0]?.id || surveyorId;

      await client.query(
        `INSERT INTO task_assignments (
           parcel_id, surveyor_id, assigned_by_admin_id, deadline, status, notes
         ) VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', 'ASSIGNED', $4);`,
        [
          newParcelBId,
          surveyorId,
          assignerAdminId,
          `Tự động phân công khảo sát Căn B mới [${portionBCode}] phát sinh từ tách thửa [${originalProjectParcelCode}]`,
        ]
      );

      console.log(`[handleFieldSplitMutation] Nhánh 2: Đã tạo thành công lô Căn B mới [${portionBCode}] (ID: ${newParcelBId}) và phân công cho KSV: ${surveyorId}`);
    } else {
      // --- NHÁNH 1: ĐẤT DƯ / SÂN VƯỜN (Mã {Mã}-DU theo Quy chuẩn Kiến trúc 3.3) ---
      const fallbackGeom = geomB || originalGeom;
      const residualResult = await CadastralMutationService.upsertResidualLandParcel(client, {
        zoneId,
        parentParcelId: originalParcelId,
        parentProjectCode: originalProjectParcelCode,
        parentOfficialCode: origOfficialCode,
        parentHouseNumber: origHouseNumber,
        parentStreet: origStreet,
        parentWard: origWard,
        parentDistrict: origDistrict,
        residualAreaM2: areaB,
        mutationType: 'SPLIT',
        mutationEventId,
        customGeomJson: fallbackGeom,
      });

      resultParcelIds.push(residualResult.id);
      console.log(`[handleFieldSplitMutation] Nhánh 1: Đã tạo/cập nhật thành công thực thể đất dôi dư [${residualResult.projectParcelCode}] (${areaB}m²).`);
    }

    // 7. Cập nhật danh sách các thửa kết quả vào sự kiện biến động
    await client.query(
      `UPDATE parcel_mutation_events SET result_parcel_ids = $1 WHERE id = $2;`,
      [resultParcelIds, mutationEventId]
    );

    // 8. Cập nhật child_parcel_ids trên thửa gốc A
    const childIds = resultParcelIds.filter((id) => id !== originalParcelId);
    if (childIds.length > 0) {
      await client.query(
        `UPDATE parcels SET child_parcel_ids = $1 WHERE id = $2;`,
        [childIds, originalParcelId]
      );
    }
  }

  /**
   * Xử lý Biến động Gộp Thửa Thực Địa theo chuẩn Điều 3.3 Quy chuẩn Kiến trúc:
   * - Hỗ trợ phân giải 2 chiều: đọc từ cả rawMutation phẳng lẫn rawMutation.details từ UI Step 5.
   * - Thửa chính (Primary): Giữ lại mã đại diện.
   * - Nếu "Xây dựng 1 phần có đất dư" (mergeHasPartialBuilding):
   *     + Thửa chính có diện tích = S_xd
   *     + Tự động sinh Thửa đất dôi dư {Mã}-DU với diện tích S_du = S_tong - S_xd
   * - Các thửa phụ bị sáp nhập (Secondary): Chuyển trạng thái sang MERGED_DEPRECATED.
   */
  public static async handleFieldMergeMutation(
    client: PoolClient,
    reportId: string,
    rawMutation: any
  ): Promise<void> {
    const primaryParcelRes = await client.query<{
      parcel_id: string;
      surveyor_id: string;
      zone_id: string;
      project_parcel_code: string;
      official_cadastral_code: string;
      house_number: string;
      street: string;
      ward: string;
      district: string;
      land_area_m2: number;
      construction_area_m2: number;
      original_geom_json: string;
    }>(
      `SELECT r.parcel_id, r.surveyor_id,
              p.zone_id, p.project_parcel_code, p.official_cadastral_code,
              p.house_number, p.street, p.ward, p.district,
              p.land_area_m2, p.construction_area_m2,
              ST_AsGeoJSON(p.cadastral_polygon_geom) AS original_geom_json
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       WHERE r.id = $1;`,
      [reportId]
    );

    if (!primaryParcelRes.rows[0]) return;

    const primary = primaryParcelRes.rows[0];
    const details = rawMutation?.details || {};

    // 1. Phân giải danh sách mã thửa cần gộp
    const mergeCodes: string[] =
      details.selectedMergeCodes ||
      rawMutation.mergeWithParcelCodes ||
      (details.mergeTargetCode ? [details.mergeTargetCode] : []);

    const mergeReason =
      details.mergeReason ||
      rawMutation.notes ||
      rawMutation.reason ||
      'Thực tế công trình xây dựng bao trùm qua nhiều thửa đất';

    // 2. Truy vấn các thửa phụ cần gộp từ CSDL
    let secondaryParcels: Array<{ id: string; project_parcel_code: string; land_area_m2: number }> = [];
    if (mergeCodes.length > 0) {
      const secRes = await client.query<{ id: string; project_parcel_code: string; land_area_m2: number }>(
        `SELECT id, project_parcel_code, land_area_m2
         FROM parcels
         WHERE project_parcel_code = ANY($1) AND id != $2 AND zone_id = $3;`,
        [mergeCodes, primary.parcel_id, primary.zone_id]
      );
      secondaryParcels = secRes.rows;
    }

    const secondaryParcelIds = secondaryParcels.map((p) => p.id);
    const allSourceIds = [primary.parcel_id, ...secondaryParcelIds];

    // 3. Tính toán tổng diện tích đất gộp
    const totalSecondaryArea = secondaryParcels.reduce((sum, p) => sum + (Number(p.land_area_m2) || 0), 0);
    const totalMergedLandArea = Number(primary.land_area_m2 || 0) + totalSecondaryArea;

    // 4. Phân tích tùy chọn "Có đất dôi dư"
    const hasPartialBuilding =
      details.mergeHasPartialBuilding === true ||
      rawMutation.mergeHasPartialBuilding === true ||
      rawMutation.hasPartialBuilding === true;

    let buildingAreaM2 = Number(details.mergeBuildingAreaM2 || rawMutation.mergeBuildingAreaM2) || 0;
    if (hasPartialBuilding && (buildingAreaM2 <= 0 || buildingAreaM2 >= totalMergedLandArea)) {
      buildingAreaM2 = Math.round(totalMergedLandArea * 0.65 * 10) / 10;
    }
    const residualAreaM2 = hasPartialBuilding
      ? Math.max(0.1, Math.round((totalMergedLandArea - buildingAreaM2) * 10) / 10)
      : 0;

    // 5. Phân giải đa giác hình học
    const buildingPoints = details.mergeBuildingCustomPoints || rawMutation.mergeBuildingCustomPoints;
    const customBuildingGeom = this.toGeoJsonPolygon(buildingPoints);
    const rawMergedGeom = this.toGeoJsonPolygon(rawMutation.finalMergedPolygon);

    // 6. Tạo bản ghi biến động parcel_mutation_events
    const mutationCode = `MUT-MERGE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const resultParcelIds: string[] = [primary.parcel_id];

    const mutRes = await client.query<{ id: string }>(
      `INSERT INTO parcel_mutation_events (
         mutation_code, mutation_type, source_parcel_ids, result_parcel_ids,
         surveyor_notes, surveyor_id, status, approved_at
       ) VALUES ($1, 'MERGE', $2, $3, $4, $5, 'APPROVED', NOW())
       RETURNING id;`,
      [
        mutationCode,
        allSourceIds,
        resultParcelIds,
        `Gộp thực địa các thửa [${mergeCodes.join(', ')}] vào thửa chính [${primary.project_parcel_code}]. Có đất dôi dư: ${hasPartialBuilding ? `Có (${residualAreaM2}m²)` : 'Không'}. Lý do: ${mergeReason}`,
        primary.surveyor_id,
      ]
    );
    const mutationEventId = mutRes.rows[0].id;

    // 7. Cập nhật Thửa chính
    const finalPrimaryArea = hasPartialBuilding ? buildingAreaM2 : totalMergedLandArea;

    if (customBuildingGeom) {
      await client.query(
        `UPDATE parcels
         SET land_area_m2 = $1,
             construction_area_m2 = $1,
             cadastral_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326),
             footprint_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326),
             location_geom = ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)),
             mutation_event_id = $3,
             mutation_type = 'MERGE',
             survey_status = 'SUBMITTED',
             updated_at = NOW()
         WHERE id = $4;`,
        [finalPrimaryArea, JSON.stringify(customBuildingGeom), mutationEventId, primary.parcel_id]
      );
    } else if (rawMergedGeom) {
      await client.query(
        `UPDATE parcels
         SET land_area_m2 = $1,
             construction_area_m2 = $1,
             cadastral_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326),
             footprint_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326),
             location_geom = ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)),
             mutation_event_id = $3,
             mutation_type = 'MERGE',
             survey_status = 'SUBMITTED',
             updated_at = NOW()
         WHERE id = $4;`,
        [finalPrimaryArea, JSON.stringify(rawMergedGeom), mutationEventId, primary.parcel_id]
      );
    } else {
      // Hợp nhất đa giác ST_Union từ tất cả các thửa nguồn
      await client.query(
        `UPDATE parcels
         SET land_area_m2 = $1,
             construction_area_m2 = $1,
             cadastral_polygon_geom = COALESCE(
               (SELECT ST_CollectionExtract(ST_MakeValid(ST_Union(cadastral_polygon_geom)), 3)
                FROM parcels WHERE id = ANY($2)),
               cadastral_polygon_geom
             ),
             footprint_polygon_geom = COALESCE(
               (SELECT ST_CollectionExtract(ST_MakeValid(ST_Union(footprint_polygon_geom)), 3)
                FROM parcels WHERE id = ANY($2)),
               footprint_polygon_geom
             ),
             location_geom = COALESCE(
               (SELECT ST_Centroid(ST_Union(cadastral_polygon_geom))
                FROM parcels WHERE id = ANY($2)),
               location_geom
             ),
             mutation_event_id = $3,
             mutation_type = 'MERGE',
             survey_status = 'SUBMITTED',
             updated_at = NOW()
         WHERE id = $4;`,
        [finalPrimaryArea, allSourceIds, mutationEventId, primary.parcel_id]
      );
    }

    // 8. Nếu "Xây dựng 1 phần có đất dư": Tự động sinh Thửa đất dư {Mã}-DU
    if (hasPartialBuilding && residualAreaM2 > 0) {
      const residualResult = await CadastralMutationService.upsertResidualLandParcel(client, {
        zoneId: primary.zone_id,
        parentParcelId: primary.parcel_id,
        parentProjectCode: primary.project_parcel_code,
        parentOfficialCode: primary.official_cadastral_code,
        parentHouseNumber: primary.house_number,
        parentStreet: primary.street,
        parentWard: primary.ward,
        parentDistrict: primary.district,
        residualAreaM2,
        mutationType: 'MERGE',
        mutationEventId,
        customGeomJson: rawMergedGeom || undefined,
      });

      resultParcelIds.push(residualResult.id);
      console.log(`[handleFieldMergeMutation] Đã tạo/cập nhật thành công thực thể đất dôi dư sau gộp [${residualResult.projectParcelCode}] (${residualAreaM2}m²).`);
    }

    // 9. Vô hiệu hóa các thửa phụ bị sáp nhập sang MERGED_DEPRECATED
    if (secondaryParcelIds.length > 0) {
      await client.query(
        `UPDATE parcels
         SET lifecycle_status = 'MERGED_DEPRECATED',
             mutation_type = 'MERGE',
             mutation_event_id = $1,
             parent_parcel_ids = ARRAY[$2::uuid],
             active_phase1_report_id = NULL,
             updated_at = NOW()
         WHERE id = ANY($3);`,
        [mutationEventId, primary.parcel_id, secondaryParcelIds]
      );
    }

    // 10. Cập nhật kết quả vào sự kiện biến động và liên kết child_parcel_ids
    await client.query(
      `UPDATE parcel_mutation_events SET result_parcel_ids = $1 WHERE id = $2;`,
      [resultParcelIds, mutationEventId]
    );

    await client.query(
      `UPDATE parcels SET child_parcel_ids = $1 WHERE id = $2;`,
      [secondaryParcelIds, primary.parcel_id]
    );

    console.log(`[handleFieldMergeMutation] Đã hoàn tất gộp thực địa các thửa [${mergeCodes.join(', ')}] vào [${primary.project_parcel_code}]. Diện tích: ${finalPrimaryArea}m²`);
  }
}
