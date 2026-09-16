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
    });

    return {
      parcelId,
      projectParcelCode: parcel.project_parcel_code,
      surveyStatus: 'POSTPONED_ABSENT',
      absenceAttemptCount: parcel.absence_attempt_count + 1,
      message: 'Đã ghi nhận vắng nhà thành công, thửa đất đổi sang màu Tím trên bản đồ',
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
}
