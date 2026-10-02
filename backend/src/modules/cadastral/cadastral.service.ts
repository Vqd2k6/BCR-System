import { CadastralRepository } from './cadastral.repository';
import { Database } from '../../database/db';
import { NotFoundError, BadRequestError, ConflictError } from '../../common/errors/problem-details';

export class CadastralService {
  static async getParcelById(id: string) {
    const parcel = await CadastralRepository.findById(id);
    if (!parcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${id}`);
    }
    return parcel;
  }

  static async listParcelsInZone(zoneId: string, status?: string) {
    return CadastralRepository.listParcelsByZone(zoneId, status);
  }

  static async getMetroAlignment() {
    return CadastralRepository.getMetroAlignment();
  }

  static async getMetroSegments() {
    return CadastralRepository.getMetroSegments();
  }

  static async findNearbyParcels(lat: number, lng: number, radius: number = 150) {
    return CadastralRepository.findNearbyParcels(lat, lng, radius);
  }

  static async startAdHocSurvey(parcelId: string, surveyorId: string, phase: string = 'PHASE_1') {
    const parcel = await CadastralRepository.findById(parcelId);
    if (!parcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }

    if (parcel.survey_status === 'APPROVED' || parcel.survey_status === 'SUBMITTED') {
      throw new BadRequestError(`Thửa đất [${parcel.project_parcel_code}] đã được nộp hoặc phê duyệt, không thể khảo sát lại`);
    }

    return Database.transaction(async (client) => {
      // 1. Chuyển trạng thái thửa đất sang IN_PROGRESS
      await client.query(
        `UPDATE parcels SET survey_status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $1;`,
        [parcelId]
      );

      // 2. Tạo hoặc lấy Báo cáo khảo sát
      const reportCode = `REPORT-${parcel.project_parcel_code}-${phase}-${Date.now()}`;
      const repRes = await client.query<{ id: string }>(
        `INSERT INTO base_survey_reports (parcel_id, surveyor_id, report_code, phase, status, current_step)
         VALUES ($1, $2, $3, $4, 'DRAFT', 1)
         RETURNING id;`,
        [parcelId, surveyorId, reportCode, phase]
      );

      const reportId = repRes.rows[0].id;
      if (phase === 'PHASE_1') {
        await client.query(
          `INSERT INTO phase1_report_details (report_id, is_historical_baseline) VALUES ($1, TRUE);`,
          [reportId]
        );
      }

      return {
        parcelId,
        projectParcelCode: parcel.project_parcel_code,
        surveyStatus: 'IN_PROGRESS',
        activeReportId: reportId,
        message: 'Đã tự nhận thửa đất và mở hồ sơ khảo sát thành công',
      };
    });
  }

  static async recordAbsence(parcelId: string, surveyorId: string, data: any) {
    const parcel = await CadastralRepository.findById(parcelId);
    if (!parcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }

    await CadastralRepository.recordAbsence({
      parcelId,
      surveyorId,
      absenceReason: data.absenceReason,
      notes: data.notes,
      photoProofUrl: data.photoProofUrl,
      rescheduleDate: data.rescheduleDate,
      ownerName: data.ownerName,
      ownerPhone: data.ownerPhone,
      surveyData: data.surveyData,
    });

    return {
      parcelId,
      projectParcelCode: parcel.project_parcel_code,
      surveyStatus: 'POSTPONED_ABSENT',
      absenceAttemptCount: parcel.absence_attempt_count + 1,
      message: 'Đã ghi nhận vắng nhà thành công, thửa đất đổi sang màu Tím trên bản đồ',
    };
  }

  /**
   * Khảo sát lại căn nhà từng vắng mặt khi chủ nhà đã có mặt (Bảo lưu toàn bộ lịch sử vắng mặt trước đó)
   */
  static async resumeSurveyAfterAbsence(parcelId: string, surveyorId: string) {
    const parcel = await CadastralRepository.findById(parcelId);
    if (!parcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }

    if (parcel.survey_status === 'APPROVED' || parcel.survey_status === 'SUBMITTED') {
      throw new BadRequestError(`Thửa đất [${parcel.project_parcel_code}] đã được nộp hoặc phê duyệt chính thức, không thể khảo sát lại.`);
    }

    const previousAbsenceLogs = await CadastralRepository.getAbsenceLogsForParcel(parcelId);

    return Database.transaction(async (client) => {
      // 1. Chuyển trạng thái thửa đất sang IN_PROGRESS
      await client.query(
        `UPDATE parcels SET survey_status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $1;`,
        [parcelId]
      );

      // 2. Tìm hoặc nạp báo cáo gần nhất
      const repRes = await client.query<{ id: string; survey_data_json: any }>(
        `SELECT id, survey_data_json FROM base_survey_reports 
         WHERE parcel_id = $1 
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE;`,
        [parcelId]
      );

      let reportId: string;
      if (repRes.rows[0]) {
        reportId = repRes.rows[0].id;
        const currentJson = repRes.rows[0].survey_data_json || {};
        const updatedJson = {
          ...currentJson,
          resumedFromAbsentee: true,
          resumedAt: new Date().toISOString(),
          previousAbsenceLogs: previousAbsenceLogs,
          surveyCaseType: currentJson.surveyCaseType === 'ABSENTEE' ? 'NORMAL' : (currentJson.surveyCaseType || 'NORMAL'),
          isAbsenteeSurvey: false,
        };

        await client.query(
          `UPDATE base_survey_reports 
           SET status = 'DRAFT', 
               surveyor_id = $2,
               is_refused_or_absent = FALSE, 
               current_step = 1,
               survey_data_json = $3,
               updated_at = NOW() 
           WHERE id = $1;`,
          [reportId, surveyorId, JSON.stringify(updatedJson)]
        );
      } else {
        const reportCode = `REPORT-${parcel.project_parcel_code}-PHASE_1-${Date.now()}`;
        const newRep = await client.query<{ id: string }>(
          `INSERT INTO base_survey_reports (
             parcel_id, surveyor_id, report_code, phase, status, current_step,
             is_refused_or_absent, survey_data_json
           ) VALUES ($1, $2, $3, 'PHASE_1', 'DRAFT', 1, FALSE, $4)
           RETURNING id;`,
          [
            parcelId,
            surveyorId,
            reportCode,
            JSON.stringify({
              resumedFromAbsentee: true,
              resumedAt: new Date().toISOString(),
              previousAbsenceLogs: previousAbsenceLogs,
              surveyCaseType: 'NORMAL',
              isAbsenteeSurvey: false,
            }),
          ]
        );
        reportId = newRep.rows[0].id;

        await client.query(
          `INSERT INTO phase1_report_details (report_id, is_historical_baseline) VALUES ($1, TRUE);`,
          [reportId]
        );
      }

      // Cập nhật active_phase1_report_id để liên kết chặt chẽ thửa đất với báo cáo đang tiếp tục
      await client.query(
        `UPDATE parcels SET active_phase1_report_id = $2 WHERE id = $1;`,
        [parcelId, reportId]
      );

      return {
        parcelId,
        projectParcelCode: parcel.project_parcel_code,
        surveyStatus: 'IN_PROGRESS',
        activeReportId: reportId,
        previousAbsenceCount: previousAbsenceLogs.length,
        previousAbsenceLogs,
        message: 'Đã mở lại hồ sơ khảo sát thành công do chủ nhà có mặt (Đã bảo lưu lịch sử vắng mặt).',
      };
    });
  }

  static async getMyAssignedParcels(surveyorId: string, lat?: number, lng?: number) {
    return CadastralRepository.getMyAssignedParcels(surveyorId, lat, lng);
  }

  static async assignSurveyor(parcelIds: string[], surveyorId: string, notes?: string) {
    const updatedCount = await CadastralRepository.assignSurveyorToParcels(parcelIds, surveyorId, notes);
    return {
      success: true,
      updatedCount,
      message: `Đã phân công ${updatedCount} thửa đất cho nhân sự thành công.`,
    };
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
   * Đề xuất Tách/Gộp thửa đất với kho số mở rộng B-07001 -> B-99999
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
   * Lấy danh sách mã dự án tiếp theo dựa trên Max của chính Zone đó (Phương án 1)
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

    let query = `SELECT project_parcel_code FROM parcels`;
    const params: any[] = [];
    if (resolvedZoneId) {
      query += ` WHERE zone_id = $1`;
      params.push(resolvedZoneId);
    }
    query += ` ORDER BY substring(project_parcel_code from '[0-9]+$')::integer DESC LIMIT 1;`;

    const res = await Database.query<{ project_parcel_code: string }>(query, params);

    let prefix = 'B-';
    let padLen = 4;
    let nextNum = 1;

    if (res.rows.length > 0 && res.rows[0].project_parcel_code) {
      const maxCode = res.rows[0].project_parcel_code;
      const match = maxCode.match(/^(.*?)(\d+)$/);
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
    };
  }

  static async listUnitsForParcel(parcelId: string) {
    const parcel = await CadastralRepository.findById(parcelId);
    if (!parcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }
    const units = await CadastralRepository.findUnitsByParcelId(parcelId);
    return {
      parcelId,
      projectParcelCode: parcel.project_parcel_code,
      buildingType: parcel.building_type || 'STANDALONE',
      totalUnits: units.length,
      units,
    };
  }

  static async createUnitForParcel(parcelId: string, data: {
    unitCode: string;
    floorNumber: number;
    ownerName?: string;
    ownerPhone?: string;
    ownerIdCard?: string;
  }) {
    const parcel = await CadastralRepository.findById(parcelId);
    if (!parcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }
    const unit = await CadastralRepository.createBuildingUnit({
      parcelId,
      unitCode: data.unitCode,
      floorNumber: data.floorNumber,
      ownerName: data.ownerName,
      ownerPhone: data.ownerPhone,
      ownerIdCard: data.ownerIdCard,
    });
    return {
      message: `Đã tạo thành công căn hộ ${data.unitCode} cho tòa nhà ${parcel.project_parcel_code}`,
      unit,
    };
  }

  static async updateBuildingType(
    parcelId: string,
    buildingType: string,
    totalUnits?: number
  ) {
    const parcel = await CadastralRepository.findById(parcelId);
    if (!parcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }
    const updated = await CadastralRepository.updateBuildingType(
      parcelId,
      buildingType,
      totalUnits
    );
    return {
      message: `Đã cập nhật loại hình công trình thành ${buildingType}`,
      parcel: updated,
    };
  }

  /**
   * Lấy danh sách các thửa đất liền kề / lân cận để Zone Admin chọn gộp thửa
   */
  static async getAdjacentCandidates(parcelId: string) {
    const parcelRes = await Database.query<{
      id: string;
      zone_id: string;
      project_parcel_code: string;
      house_number: string;
      street: string;
      land_area_m2: number;
    }>(
      `SELECT id, zone_id, project_parcel_code, house_number, street, land_area_m2
       FROM parcels WHERE id = $1;`,
      [parcelId]
    );

    const parcel = parcelRes.rows[0];
    if (!parcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }

    const candidatesRes = await Database.query<{
      id: string;
      project_parcel_code: string;
      official_cadastral_code: string;
      house_number: string;
      street: string;
      owner_name: string;
      land_area_m2: number;
      floor_count: number;
      survey_status: string;
      distance_meters: number;
    }>(
      `SELECT id, project_parcel_code, official_cadastral_code, house_number, street,
              owner_name, land_area_m2, floor_count, survey_status,
              ROUND(
                ST_Distance(
                  cadastral_polygon_geom::geography,
                  (SELECT cadastral_polygon_geom::geography FROM parcels WHERE id = $1)
                )::numeric, 1
              ) as distance_meters
       FROM parcels
       WHERE zone_id = $2
         AND id != $1
         AND lifecycle_status = 'ACTIVE'
       ORDER BY distance_meters ASC
       LIMIT 30;`,
      [parcelId, parcel.zone_id]
    );

    return {
      currentParcel: {
        id: parcel.id,
        projectParcelCode: parcel.project_parcel_code,
        houseNumber: parcel.house_number,
        street: parcel.street,
        landAreaM2: parcel.land_area_m2,
      },
      candidates: candidatesRes.rows,
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
      }>;
      adminNotes?: string;
      transferSurveyReportId?: string;
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
          house_number: string;
          street: string;
          ward: string;
          district: string;
          land_area_m2: number;
          survey_status: string;
          active_phase1_report_id: string | null;
        }>(
          `SELECT id, zone_id, project_parcel_code, house_number, street, ward, district,
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

        // 3. Cập nhật Thửa chính: Hợp nhất đa giác ST_Union và cộng dồn diện tích
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
               mutation_type = 'MERGE',
               child_parcel_ids = $3,
               updated_at = NOW()
           WHERE id = $4;`,
          [data.sourceParcelIds, totalLandArea, secondaryParcelIds, primaryParcel.id]
        );

        // 4. Đánh dấu các thửa phụ thành MERGED_DEPRECATED
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

        // 5. Nếu có hồ sơ khảo sát cần gán hoặc di chuyển sang thửa chính
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

        // 6. Ghi vết parcel_mutation_events
        const mutRes = await client.query<{ id: string }>(
          `INSERT INTO parcel_mutation_events (
             mutation_code, mutation_type, source_parcel_ids, result_parcel_ids,
             surveyor_notes, surveyor_id, zone_admin_id, status, approved_at
           ) VALUES ($1, 'MERGE', $2, ARRAY[$3::uuid], $4, $5, $5, 'APPROVED', NOW())
           RETURNING id;`,
          [
            mutationCode,
            data.sourceParcelIds,
            primaryParcel.id,
            data.adminNotes || `Zone Admin gộp ${data.sourceParcelIds.length} thửa thành 1 thửa đại diện [${primaryParcel.project_parcel_code}]`,
            adminId,
          ]
        );

        // 7. Ghi log kiểm toán
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
            totalLandArea,
          },
          status: 'APPROVED',
          message: `Đã gộp thành công ${data.sourceParcelIds.length} thửa đất vào thửa đại diện [${primaryParcel.project_parcel_code}] (${totalLandArea} m²)`,
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
        land_area_m2: number;
        survey_status: string;
        cadastral_geojson: string;
      }>(
        `SELECT id, zone_id, project_parcel_code, house_number, street, ward, district,
                land_area_m2, survey_status,
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

      // 2. Tạo các thửa con
      for (let idx = 0; idx < data.childParcels.length; idx++) {
        const child = data.childParcels[idx];
        let code = child.projectParcelCode?.trim();

        if (!code) {
          const suffix = String.fromCharCode(65 + idx);
          const candidateCode = `${parent.project_parcel_code}${suffix}`;
          const codeExist = await client.query(`SELECT id FROM parcels WHERE project_parcel_code = $1;`, [candidateCode]);
          if (codeExist.rows.length === 0) {
            code = candidateCode;
          } else {
            code = await CadastralRepository.getNextHighRangeProjectCode(client, zoneId, parent.project_parcel_code);
          }
        }

        const insertParams: any[] = [
          zoneId,                        // $1
          code,                          // $2
          child.houseNumber || null,     // $3
          child.street || parent.street, // $4
          parent.ward,                   // $5
          parent.district,               // $6
          child.ownerName || null,       // $7
          child.ownerPhone || null,      // $8
          child.landAreaM2 || 0,         // $9
          child.floorCount || 1,         // $10
          parent.id,                     // $11
        ];

        const isMockCoord =
          child.polygonGeoJson &&
          child.polygonGeoJson.coordinates &&
          child.polygonGeoJson.coordinates[0] &&
          child.polygonGeoJson.coordinates[0][0] &&
          child.polygonGeoJson.coordinates[0][0][0] === 106.71;

        let geomExpr: string;
        if (child.polygonGeoJson && !isMockCoord) {
          insertParams.push(typeof child.polygonGeoJson === 'string' ? child.polygonGeoJson : JSON.stringify(child.polygonGeoJson));
          const gIdx = insertParams.length;
          geomExpr = `ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($${gIdx}), 4326)), 3), 1)`;
        } else {
          const ratio = Math.max(0.1, Math.min(0.9, (Number(child.landAreaM2) || 1) / (totalChildArea || 1)));
          if (idx === 0) {
            geomExpr = `COALESCE(
              ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_Intersection(
                (SELECT cadastral_polygon_geom FROM parcels WHERE id = $11),
                ST_MakeEnvelope(
                  ST_XMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $11)),
                  ST_YMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $11)),
                  ST_XMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $11)) + (ST_XMax((SELECT cadastral_polygon_geom FROM parcels WHERE id = $11)) - ST_XMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $11))) * ${ratio},
                  ST_YMax((SELECT cadastral_polygon_geom FROM parcels WHERE id = $11)),
                  4326
                )
              )), 3), 1),
              (SELECT cadastral_polygon_geom FROM parcels WHERE id = $11)
            )`;
          } else {
            geomExpr = `COALESCE(
              ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_Difference(
                (SELECT cadastral_polygon_geom FROM parcels WHERE id = $11),
                ST_MakeEnvelope(
                  ST_XMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $11)),
                  ST_YMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $11)),
                  ST_XMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $11)) + (ST_XMax((SELECT cadastral_polygon_geom FROM parcels WHERE id = $11)) - ST_XMin((SELECT cadastral_polygon_geom FROM parcels WHERE id = $11))) * (1 - ${ratio}),
                  ST_YMax((SELECT cadastral_polygon_geom FROM parcels WHERE id = $11)),
                  4326
                )
              )), 3), 1),
              (SELECT cadastral_polygon_geom FROM parcels WHERE id = $11)
            )`;
          }
        }

        const pRes = await client.query<{ id: string; project_parcel_code: string }>(
          `INSERT INTO parcels (
             zone_id, project_parcel_code, house_number, street, ward, district,
             owner_name, owner_phone, land_area_m2, floor_count,
             cadastral_polygon_geom, footprint_polygon_geom, location_geom,
             survey_status, lifecycle_status, mutation_type, parent_parcel_ids
           ) VALUES (
             $1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10,
             ${geomExpr},
             ${geomExpr},
             ST_Centroid(${geomExpr}),
             'NOT_SURVEYED', 'ACTIVE', 'SPLIT', ARRAY[$11::uuid]
           ) RETURNING id, project_parcel_code;`,
          insertParams
        );

        resultParcelIds.push(pRes.rows[0].id);
        createdParcels.push(pRes.rows[0]);
      }

      // 3. Đánh dấu thửa cha thành SPLIT_DEPRECATED
      await client.query(
        `UPDATE parcels 
         SET lifecycle_status = 'SPLIT_DEPRECATED',
             mutation_type = 'SPLIT',
             active_phase1_report_id = NULL,
             child_parcel_ids = $1,
             updated_at = NOW() 
         WHERE id = $2;`,
        [resultParcelIds, parent.id]
      );

      // 4. Nếu có yêu cầu gán hồ sơ khảo sát sang thửa con đầu tiên
      if (data.transferSurveyReportId && resultParcelIds.length > 0) {
        const targetParcelId = resultParcelIds[0];
        const child1 = createdParcels[0];

        const repRes = await client.query<{ status: string; survey_data_json: any }>(
          `SELECT status, survey_data_json FROM base_survey_reports WHERE id = $1 FOR UPDATE;`,
          [data.transferSurveyReportId]
        );
        if (repRes.rows[0]) {
          const rep = repRes.rows[0];
          let sData = typeof rep.survey_data_json === 'string' ? JSON.parse(rep.survey_data_json) : (rep.survey_data_json || {});
          sData.projectParcelCode = child1.project_parcel_code;
          if (data.childParcels[0]?.houseNumber) sData.houseNumber = data.childParcels[0].houseNumber;

          await client.query(
            `UPDATE base_survey_reports 
             SET parcel_id = $1, survey_data_json = $2, updated_at = NOW() 
             WHERE id = $3;`,
            [targetParcelId, JSON.stringify(sData), data.transferSurveyReportId]
          );

          await client.query(
            `UPDATE parcels 
             SET survey_status = $1, active_phase1_report_id = $2, updated_at = NOW() 
             WHERE id = $3;`,
            [rep.status, data.transferSurveyReportId, targetParcelId]
          );
        }
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


