import { CadastralRepository, ParcelEntity, CadBBox, CadPolygonPoint } from './cadastral.repository';
import { Database } from '../../database/db';
import { NotFoundError, BadRequestError, ForbiddenError, UnauthorizedError } from '../../common/errors/problem-details';
import { CadastralMutationService } from './services/cadastral-mutation.service';
import { CadastralGeometryService } from './services/cadastral-geometry.service';

export { CadastralMutationService, CadastralGeometryService };

/**
 * CadastralService (Facade Pattern):
 * Quản trị vòng đời địa chính thửa đất, phân công nhân sự, khảo sát đột xuất.
 * Toàn bộ nghiệp vụ Tách/Gộp thửa và Hoán đổi hình học GIS đã được tách thành:
 * - CadastralMutationService (Tách/gộp thửa, cấp mã Max Zone + 1, phê duyệt/từ chối)
 * - CadastralGeometryService (Cập nhật footprint, tìm kiếm lân cận, swap geometry)
 */
export class CadastralService {
  // --- THÔNG TIN THỬA ĐẤT & TUYẾN METRO ---
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
    return CadastralGeometryService.findNearbyParcels(lat, lng, radius);
  }

  // --- QUẢN TRỊ KHẢO SÁT & VẮNG MẶT ---
  static async startAdHocSurvey(parcelId: string, surveyorId: string, phase: string = 'PHASE_1') {
    const parcel = await CadastralRepository.findById(parcelId);
    if (!parcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }

    if (parcel.survey_status === 'APPROVED' || parcel.survey_status === 'SUBMITTED') {
      throw new BadRequestError(`Thửa đất [${parcel.project_parcel_code}] đã được nộp hoặc phê duyệt, không thể khảo sát lại`);
    }

    return Database.transaction(async (client) => {
      await client.query(
        `UPDATE parcels SET survey_status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $1;`,
        [parcelId]
      );

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
      unitId: data.unitId,
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
      await client.query(
        `UPDATE parcels SET survey_status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $1;`,
        [parcelId]
      );

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

  // --- FOOTPRINT & HÌNH HỌC GIS ---
  static async updateFootprint(
    parcelId: string,
    footprintGeoJson: any,
    constructionAreaM2?: number,
    userId?: string,
    reason?: string,
    clientIp?: string
  ) {
    return CadastralGeometryService.updateFootprint(
      parcelId,
      footprintGeoJson,
      constructionAreaM2,
      userId,
      reason,
      clientIp
    );
  }

  static async getAdjacentCandidates(parcelId: string) {
    return CadastralGeometryService.getAdjacentCandidates(parcelId);
  }

  static async swapParcelGeometries(
    parcelAIdent: string,
    parcelBIdent: string,
    adminId: string,
    reason: string,
    clientIp?: string
  ) {
    return CadastralGeometryService.swapParcelGeometries(parcelAIdent, parcelBIdent, adminId, reason, clientIp);
  }

  static async reshapeParcelGeometry(
    parcelId: string,
    newCoordinates: [number, number][],
    userId: string,
    reason: string,
    updateFootprint: boolean = true,
    clientIp?: string
  ) {
    return CadastralGeometryService.reshapeParcelGeometry(
      parcelId,
      newCoordinates,
      userId,
      reason,
      updateFootprint,
      clientIp
    );
  }

  // --- BIẾN ĐỘNG ĐỊA CHÍNH (TÁCH / GỘP THỬA) ---
  static async proposeMutation(surveyorId: string, data: any) {
    return CadastralMutationService.proposeMutation(surveyorId, data);
  }

  static async approveOrRejectMutation(
    mutationId: string,
    adminId: string,
    action: 'APPROVE' | 'REJECT',
    rejectionReason?: string
  ) {
    return CadastralMutationService.approveOrRejectMutation(mutationId, adminId, action, rejectionReason);
  }

  static async getNextHighRangeCodes(count: number = 2, zoneId?: string, parcelId?: string) {
    return CadastralMutationService.getNextHighRangeCodes(count, zoneId, parcelId);
  }

  static async executeAdminMutation(
    adminId: string,
    data: {
      mutationType: 'SPLIT' | 'MERGE';
      sourceParcelIds: string[];
      primaryParcelId?: string;
      primaryProjectParcelCode?: string;
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
    return CadastralMutationService.executeAdminMutation(adminId, data, clientIp);
  }

  // --- CĂN HỘ CHUNG CƯ CON (BUILDING UNITS) ---
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

  // --- BẢO VỆ PHÂN QUYỀN & CHỐNG IDOR ---
  static async assertUserCanModifyParcel(
    user: { userId: string; role: string; assignedZoneId?: string | null } | undefined,
    parcelId: string
  ): Promise<ParcelEntity> {
    const parcel = await CadastralRepository.findById(parcelId);
    if (!parcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }
    if (!user) {
      throw new UnauthorizedError('Yêu cầu xác thực tài khoản để thực hiện thao tác quản trị');
    }
    if (user.role === 'SUPER_ADMIN') {
      return parcel;
    }
    if (user.role === 'ZONE_ADMIN') {
      if (user.assignedZoneId && parcel.zone_id !== user.assignedZoneId) {
        throw new ForbiddenError(
          `Từ chối quyền truy cập (IDOR Guard): Bạn chỉ có quyền quản trị phân khu [${user.assignedZoneId}], không thể thao tác trên thửa đất [${parcel.project_parcel_code}] thuộc phân khu [${parcel.zone_id}].`
        );
      }
      return parcel;
    }
    throw new ForbiddenError('Chỉ Zone Admin hoặc Super Admin mới có quyền thực hiện thao tác quản trị này.');
  }

  static async logCadastralAudit(
    action: string,
    entityType: 'PARCEL' | 'BUILDING_UNIT' | 'BUILDING_FLOOR_PLAN',
    entityId: string,
    userId: string,
    diffPayload?: Record<string, unknown>,
    clientIp?: string
  ): Promise<void> {
    try {
      await Database.query(
        `INSERT INTO system_audit_logs (
          entity_type, entity_id, action, performed_by_user_id, client_ip, diff_payload, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW());`,
        [
          entityType,
          entityId,
          action,
          userId,
          clientIp || null,
          diffPayload ? JSON.stringify(diffPayload) : null,
        ]
      );
    } catch (err: unknown) {
      console.warn('[CadastralService:logCadastralAudit] Lỗi ghi nhật ký kiểm toán (không chặn luồng chính):', err);
    }
  }

  static async createUnitForParcel(
    parcelId: string, 
    data: {
      unitCode: string;
      floorNumber: number;
      ownerName?: string | null;
      ownerPhone?: string | null;
      ownerIdCard?: string | null;
      unitType?: 'UNIT' | 'MASTER';
    },
    user?: { userId: string; role: string; assignedZoneId?: string | null },
    clientIp?: string
  ) {
    const parcel = await this.assertUserCanModifyParcel(user, parcelId);
    const unit = await CadastralRepository.createBuildingUnit({
      parcelId,
      unitCode: data.unitCode,
      floorNumber: data.floorNumber,
      ownerName: data.ownerName,
      ownerPhone: data.ownerPhone,
      ownerIdCard: data.ownerIdCard,
      unitType: data.unitType,
    });

    if (user) {
      await this.logCadastralAudit('CREATE_BUILDING_UNIT', 'BUILDING_UNIT', unit.id, user.userId, {
        parcelId,
        unitCode: data.unitCode,
        floorNumber: data.floorNumber,
        unitType: data.unitType,
      }, clientIp);
    }

    return {
      message: `Đã tạo thành công căn hộ/khu vực ${data.unitCode} cho tòa nhà ${parcel.project_parcel_code}`,
      unit,
    };
  }

  static async deleteUnit(
    parcelId: string, 
    unitId: string,
    user?: { userId: string; role: string; assignedZoneId?: string | null },
    clientIp?: string
  ) {
    await this.assertUserCanModifyParcel(user, parcelId);
    const unit = await CadastralRepository.findUnitById(unitId);
    if (!unit) {
      throw new NotFoundError(`Không tìm thấy căn hộ / vị trí với ID: ${unitId}`);
    }
    if (unit.parcel_id !== parcelId) {
      throw new BadRequestError(`Căn hộ không thuộc thửa đất ${parcelId}`);
    }
    if (unit.phase1_report_id || (unit.status && unit.status !== 'NOT_SURVEYED')) {
      throw new BadRequestError(
        `Không thể xóa căn hộ ${unit.unit_code} vì đã có hồ sơ khảo sát hiện trường mang tính pháp lý!`
      );
    }
    await CadastralRepository.deleteUnit(parcelId, unitId);

    if (user) {
      await this.logCadastralAudit('DELETE_BUILDING_UNIT', 'BUILDING_UNIT', unitId, user.userId, {
        parcelId,
        unitCode: unit.unit_code,
        floorNumber: unit.floor_number,
      }, clientIp);
    }

    return {
      message: `Đã xóa căn hộ / vị trí ${unit.unit_code}`,
      deletedUnitId: unitId,
    };
  }

  static async updateBuildingType(
    parcelId: string,
    buildingType: string,
    totalUnits?: number,
    user?: { userId: string; role: string; assignedZoneId?: string | null },
    clientIp?: string
  ) {
    const parcel = await this.assertUserCanModifyParcel(user, parcelId);

    // 1. Kiểm tra Precondition: Trạng thái khảo sát cấm chuyển đổi
    const blockedStatuses = [
      'IN_PROGRESS',
      'POSTPONED_ABSENT',
      'SUBMITTED',
      'APPROVED',
      'REJECTED',
      'APPROVED_PHASE2',
      'PHASE2_COMPLETED',
    ];
    if (blockedStatuses.includes(parcel.survey_status)) {
      throw new BadRequestError(
        `Không thể chuyển đổi loại hình công trình vì thửa đất đang ở trạng thái khảo sát '${parcel.survey_status}'. Chỉ cho phép chuyển đổi thửa đất chưa khảo sát (NOT_SURVEYED hoặc ASSIGNED_TO_ME).`
      );
    }

    // 2. Kiểm tra Precondition: active_phase1_report_id
    if (parcel.active_phase1_report_id) {
      throw new BadRequestError(
        `Không thể chuyển đổi loại hình: Thửa đất đã có hồ sơ khảo sát liên kết (ID: ${parcel.active_phase1_report_id}).`
      );
    }

    // 3. Kiểm tra Precondition: Có báo cáo khảo sát nào trong base_survey_reports không
    const reportCount = await CadastralRepository.countReportsByParcelId(parcelId);
    if (reportCount > 0) {
      throw new BadRequestError(
        `Không thể chuyển đổi loại hình: Thửa đất đã có ${reportCount} báo cáo khảo sát hiện hữu trong CSDL.`
      );
    }

    // 4. Kiểm tra Precondition: Lifecycle status
    if (parcel.lifecycle_status && parcel.lifecycle_status !== 'ACTIVE') {
      throw new BadRequestError(
        `Không thể chuyển đổi loại hình: Thửa đất đang trong quy trình biến động hoặc đã bị vô hiệu hóa (${parcel.lifecycle_status}).`
      );
    }

    // 5. Kiểm tra Last-condition / Reversion Rule: Chuyển từ CONDOMINIUM về STANDALONE
    if (buildingType === 'STANDALONE' && parcel.building_type === 'CONDOMINIUM') {
      const unitReportCount = await CadastralRepository.countUnitReportsByParcelId(parcelId);
      if (unitReportCount > 0) {
        throw new BadRequestError(
          `Không thể hoàn nguyên về Nhà riêng lẻ: Đã có ${unitReportCount} căn hộ con đã lập hồ sơ khảo sát trong tòa nhà.`
        );
      }
    }

    const updated = await CadastralRepository.updateBuildingType(
      parcelId,
      buildingType,
      totalUnits
    );

    if (user) {
      await this.logCadastralAudit('UPDATE_BUILDING_TYPE', 'PARCEL', parcelId, user.userId, {
        oldBuildingType: parcel.building_type,
        newBuildingType: buildingType,
        totalUnits,
      }, clientIp);
    }

    return {
      message: `Đã cập nhật loại hình công trình thành ${buildingType}`,
      parcel: updated,
    };
  }

  static async listFloorPlansForParcel(parcelId: string) {
    const parcel = await CadastralRepository.findById(parcelId);
    if (!parcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }
    const plans = await CadastralRepository.findFloorPlansByParcelId(parcelId);
    return {
      parcelId,
      projectParcelCode: parcel.project_parcel_code,
      deletedFloors: parcel.deleted_floors || [],
      plans,
    };
  }

  static async getFloorPlanByFloor(parcelId: string, floorNumber: number) {
    const plan = await CadastralRepository.findFloorPlanByFloor(parcelId, floorNumber);
    const units = await CadastralRepository.findUnitsByParcelId(parcelId);
    const floorUnits = units.filter((u) => u.floor_number === floorNumber);
    return {
      plan,
      floorNumber,
      units: floorUnits,
    };
  }

  static async upsertFloorPlan(
    parcelId: string, 
    data: {
      floorNumber: number;
      floorName: string;
      floorCode?: string;
      applicableFloors?: number[];
      cadPhotoUrl: string;
      cadPhotoCode?: string | null;
      imageWidth?: number | null;
      imageHeight?: number | null;
      scope?: 'MASTER' | 'UNIT' | 'BOTH';
      areaType?: string | null;
    },
    user?: { userId: string; role: string; assignedZoneId?: string | null },
    clientIp?: string
  ) {
    await this.assertUserCanModifyParcel(user, parcelId);
    const plan = await CadastralRepository.upsertFloorPlan({
      parcelId,
      ...data,
    });

    if (user) {
      await this.logCadastralAudit('UPSERT_FLOOR_PLAN', 'BUILDING_FLOOR_PLAN', plan.id, user.userId, {
        parcelId,
        floorNumber: data.floorNumber,
        floorName: data.floorName,
        applicableFloors: data.applicableFloors,
      }, clientIp);
    }

    return {
      message: `Đã lưu bản vẽ CAD mặt bằng ${data.floorName}`,
      plan,
    };
  }

  static async saveFloorPartitions(
    parcelId: string, 
    data: {
      floorNumber: number;
      floorPlanId?: string | null;
      partitions: { 
        unitCode: string; 
        displayCode?: string | null; 
        floorNumber?: number; 
        bbox?: CadBBox | null; 
        polygon?: CadPolygonPoint[] | null; 
        unitCadUrl?: string | null; 
        unitType?: 'UNIT' | 'MASTER';
      }[];
    },
    user?: { userId: string; role: string; assignedZoneId?: string | null },
    clientIp?: string
  ) {
    await this.assertUserCanModifyParcel(user, parcelId);
    const units = await CadastralRepository.saveUnitPartitions(
      parcelId,
      data.floorNumber,
      data.floorPlanId || null,
      data.partitions
    );

    if (user) {
      await this.logCadastralAudit('SAVE_FLOOR_PARTITIONS', 'BUILDING_FLOOR_PLAN', data.floorPlanId || parcelId, user.userId, {
        parcelId,
        floorNumber: data.floorNumber,
        partitionCount: data.partitions.length,
      }, clientIp);
    }

    return {
      message: units.length > 0
        ? `Đã lưu phân chia CAD cho ${units.length} vị trí Tầng ${data.floorNumber}`
        : `Đã lưu cấu hình Tầng ${data.floorNumber}`,
      units,
    };
  }

  static async atomicSyncFloorPlanAndPartitions(
    parcelId: string,
    data: {
      floorNumber: number;
      floorPlan: {
        floorName: string;
        floorCode?: string;
        applicableFloors?: number[];
        cadPhotoUrl: string;
        cadPhotoCode?: string | null;
        imageWidth?: number | null;
        imageHeight?: number | null;
        scope?: 'MASTER' | 'UNIT' | 'BOTH';
        areaType?: string | null;
      };
      partitions: {
        unitCode: string;
        displayCode?: string | null;
        floorNumber?: number;
        bbox?: CadBBox | null;
        polygon?: CadPolygonPoint[] | null;
        unitCadUrl?: string | null;
        unitType?: 'UNIT' | 'MASTER';
      }[];
    },
    user?: { userId: string; role: string; assignedZoneId?: string | null },
    clientIp?: string
  ) {
    await this.assertUserCanModifyParcel(user, parcelId);
    const result = await CadastralRepository.atomicSyncFloorPlanAndPartitions(
      parcelId,
      data.floorNumber,
      data.floorPlan,
      data.partitions
    );

    if (user) {
      await this.logCadastralAudit('ATOMIC_SYNC_FLOOR_PLAN_AND_PARTITIONS', 'BUILDING_FLOOR_PLAN', result.plan.id, user.userId, {
        parcelId,
        floorNumber: data.floorNumber,
        partitionCount: data.partitions.length,
      }, clientIp);
    }

    return {
      message: `Đã đồng bộ nguyên tử bản vẽ CAD và ${result.units.length} phân vùng cho Tầng ${data.floorNumber}`,
      plan: result.plan,
      units: result.units,
    };
  }

  static async deleteFloorPlan(
    parcelId: string, 
    floorNumber: number, 
    mode: 'CLEAR_CAD' | 'DELETE_FLOOR' = 'DELETE_FLOOR',
    user?: { userId: string; role: string; assignedZoneId?: string | null },
    clientIp?: string
  ) {
    await this.assertUserCanModifyParcel(user, parcelId);

    // 1. Kiểm tra các căn hộ đã hoặc đang khảo sát trên tầng này
    const surveyedUnits = await CadastralRepository.getSurveyedUnitsOnFloor(parcelId, floorNumber);
    const surveyedCount = surveyedUnits.length;

    // RÀO CHẮN BẢO VỆ PHÁP LÝ (Safety Guard):
    // Nếu tầng đã có căn hộ được khảo sát, TUYỆT ĐỐI CHẶN thao tác xóa cả tầng
    if (surveyedCount > 0 && mode === 'DELETE_FLOOR') {
      const codeList = surveyedUnits.map((u) => u.unit_code).slice(0, 5).join(', ');
      const moreText = surveyedCount > 5 ? ` và ${surveyedCount - 5} căn khác` : '';
      throw new BadRequestError(
        `Không thể xóa Tầng ${floorNumber} khỏi cấu trúc tòa nhà vì tầng này đang có ${surveyedCount} căn hộ (${codeList}${moreText}) đã/đang được khảo sát hiện trường mang tính pháp lý bồi thường. Bạn chỉ có thể chọn "Xóa bản vẽ CAD" để làm mới mặt bằng mà vẫn bảo toàn 100% hồ sơ khảo sát.`
      );
    }

    const result = await CadastralRepository.deleteFloorPlan(parcelId, floorNumber, mode, surveyedCount);

    if (user) {
      await this.logCadastralAudit('DELETE_FLOOR_PLAN', 'BUILDING_FLOOR_PLAN', parcelId, user.userId, {
        floorNumber,
        mode,
        surveyedCount,
      }, clientIp);
    }

    return result;
  }

  // --- LỊCH SỬ BIẾN ĐỘNG (SUPER_ADMIN ONLY) ---
  static async getParcelMutationHistory(parcelId: string) {
    const { CadastralHistoryService } = await import('./services/cadastral-history.service');
    return CadastralHistoryService.getParcelMutationHistory(parcelId);
  }

  static async getZoneMutationHistory(zoneId: string, limit?: number, offset?: number) {
    const { CadastralHistoryService } = await import('./services/cadastral-history.service');
    return CadastralHistoryService.getZoneMutationHistory(zoneId, limit, offset);
  }
}
