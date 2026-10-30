import { Request, Response, NextFunction } from 'express';
import { SurveyService } from './survey.service';
import { ScoringService } from '../scoring/scoring.service';
import {
  CreatePhase1ReportDto,
  IdentificationPhotosDto,
  BuildingSpecsDto,
  CreateDamageZoneDto,
  CreateDefectItemDto,
  DeformationDto,
  SubmitPhase1ReportDto,
  CreatePhase2ReportDto,
  VerifyPhase2DefectDto,
  SubmitPhase2ReportDto,
  SaveSurveyDraftDto,
  TakeoverSurveyDraftDto,
  ReleaseDraftLockDto,
} from './survey.dto';
import { SurveyPackageMapper } from './survey-package.mapper';
import { Database } from '../../database/db';
import { CadastralRepository } from '../cadastral/cadastral.repository';
import { AppError, BadRequestError, ForbiddenError } from '../../common/errors/problem-details';
import { maskReportPii } from '../../common/utils/pii.utils';
import { assertParcelsNotExcludedByIds } from '../cadastral/utils/parcel-exclusion';

export class SurveyController {
  // Phase 1
  static async createPhase1Report(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = CreatePhase1ReportDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError('parcelId không hợp lệ');
      }

      const surveyorId = req.user!.userId;
      const result = await SurveyService.createPhase1Report(
        parsed.data.parcelId,
        surveyorId,
        parsed.data.unitId,
        parsed.data.reportType
      );
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getReportDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const report = await SurveyService.getReportDetail(id);
      const isGuest = req.user?.role === 'GUEST';
      res.status(200).json({
        success: true,
        data: isGuest ? maskReportPii(report) : report,
      });
    } catch (error) {
      next(error);
    }
  }

  static async saveIdentificationPhotos(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = IdentificationPhotosDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu ảnh định danh không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const result = await SurveyService.saveIdentificationPhotos(id, parsed.data);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async saveBuildingSpecs(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = BuildingSpecsDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu thông số kết cấu không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const result = await SurveyService.saveBuildingSpecs(id, parsed.data);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async saveFloorSurveys(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { floors } = req.body;
      if (!Array.isArray(floors)) {
        throw new BadRequestError('Dữ liệu danh sách tầng phải là một mảng array');
      }
      const result = await SurveyService.saveFloorSurveys(id, floors);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createDamageZone(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = CreateDamageZoneDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu Vùng khảo sát Z-xx không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const result = await SurveyService.createDamageZone(id, parsed.data);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createDefectItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params; // zoneId
      const parsed = CreateDefectItemDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu ghim khuyết tật D-xx không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const result = await SurveyService.createDefectItem(id, parsed.data);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async saveDeformation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = DeformationDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError('Dữ liệu lún nghiêng không hợp lệ');
      }

      const result = await SurveyService.saveDeformation(id, parsed.data);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async submitPhase1Report(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = SubmitPhase1ReportDto.safeParse(req.body);

      const result = await SurveyService.submitPhase1Report(
        id,
        parsed.success ? parsed.data : {},
        req.user?.userId,
        req.ip
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async submitPhase1FullPackage(req: Request, res: Response, next: NextFunction) {
    try {
      const { parcelId, unitId, surveyData, reportType: rawReportType } = req.body;
      if (!parcelId) {
        throw new BadRequestError('parcelId là bắt buộc');
      }
      const surveyorId = req.user!.userId;

      await assertParcelsNotExcludedByIds([parcelId]);

      // 0. Lưới an toàn: TỪ CHỐI nộp nếu còn ảnh chưa lên Cloud (blob:local / base64).
      // Nếu cho qua, ảnh sẽ hỏng vĩnh viễn trên báo cáo vì file gốc chỉ nằm trong IndexedDB của thiết bị.
      const unsyncedPhotoPaths = SurveyPackageMapper.findUnsyncedPhotoPaths(surveyData);
      if (unsyncedPhotoPaths.length > 0) {
        throw new AppError(
          `Hồ sơ còn ${unsyncedPhotoPaths.length} ảnh chưa được tải lên Cloud nên chưa thể nộp. Vui lòng đồng bộ ảnh rồi nộp lại.`,
          400,
          'PHOTOS_NOT_SYNCED',
          unsyncedPhotoPaths.slice(0, 20).map((p) => ({ field: p, message: 'Ảnh chưa lên Cloud (blob/base64)' }))
        );
      }

      // Bước lưu bảng chuẩn hóa "critical" (khảo sát tầng/vùng/khuyết tật) sẽ HỦY việc nộp khi lỗi thay vì nuốt lỗi âm thầm.
      // Các bước còn lại trả về data.warnings (dữ liệu gốc vẫn toàn vẹn trong survey_data_json).
      // Đặt SURVEY_STRICT_NORMALIZED_SAVE=true để bắt buộc toàn bộ các bước.
      const strictAllSteps = process.env.SURVEY_STRICT_NORMALIZED_SAVE === 'true';
      // Khẩn cấp: SURVEY_STRICT_NORMALIZED_SAVE=false hạ cả bước critical xuống cảnh báo
      const relaxAllSteps = process.env.SURVEY_STRICT_NORMALIZED_SAVE === 'false';
      const submitWarnings: string[] = [];
      const runPersistStep = async (label: string, step: () => Promise<unknown>, critical: boolean = false) => {
        try {
          await step();
        } catch (stepErr) {
          console.error(`[submitPhase1FullPackage] Lỗi lưu ${label}:`, stepErr);
          if ((critical && !relaxAllSteps) || strictAllSteps) {
            const detail = stepErr instanceof Error ? stepErr.message : String(stepErr);
            throw new AppError(
              `Không thể lưu ${label} nên hồ sơ CHƯA được nộp. Vui lòng thử lại. (${detail})`,
              500,
              'SUBMIT_PERSIST_FAILED'
            );
          }
          submitWarnings.push(`Không lưu được ${label}`);
        }
      };
      // 1. Chuẩn hóa unitId để tránh lỗi UUID invalid (ví dụ: 'u-204')
      let cleanUnitId: string | null = null;
      if (unitId && typeof unitId === 'string' && unitId.trim()) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(unitId)) {
          cleanUnitId = unitId;
        } else {
          // Tra cứu trong database theo mã căn hộ (unit_code) hoặc biển số (display_code) chính xác, loại bỏ ILIKE mờ
          const candidateCode = unitId.replace(/^u-/, 'P.');
          const rawCode = unitId.replace(/^u-/, '');
          const unitRow = await Database.query<{ id: string }>(
            `SELECT id FROM building_units 
             WHERE parcel_id = $1 
               AND (unit_code = $2 OR unit_code = $3 OR display_code = $2 OR display_code = $3) 
               AND deleted_at IS NULL 
             LIMIT 1;`,
            [parcelId, candidateCode, rawCode]
          );
          if (unitRow.rows[0]) {
            cleanUnitId = unitRow.rows[0].id;
          }
        }
      }

      // Chuẩn hóa loại hình báo cáo: BUILDING_MASTER, CONDO_UNIT, hoặc STANDALONE
      const resolvedReportType =
        rawReportType === 'BUILDING_MASTER'
          ? 'BUILDING_MASTER'
          : (rawReportType === 'CONDO_UNIT' || rawReportType === 'UNIT_CHILD' || cleanUnitId)
            ? 'CONDO_UNIT'
            : 'STANDALONE';

      // Khởi tạo hoặc tái sử dụng report nếu đã tồn tại
      const existingReport = await SurveyService.getPhase1ReportByParcelId(parcelId, {
        reportType: resolvedReportType,
        unitId: cleanUnitId || null,
      });

      let reportId: string;
      const userRole = req.user?.role || 'SURVEYOR';

      if (
        existingReport?.report &&
        (existingReport.report.status === 'SUBMITTED' || existingReport.report.status === 'APPROVED')
      ) {
        // Hồ sơ đã nộp: Kiểm tra phân quyền
        if (userRole === 'SURVEYOR') {
          throw new ForbiddenError(
            'Hồ sơ khảo sát đã được nộp. Kỹ sư khảo sát chỉ có quyền xem lại, chỉ có Zone Admin mới được điều chỉnh.'
          );
        }

        // Zone Admin hoặc Super Admin: Cho phép điều chỉnh tại chỗ (In-Place Update)
        reportId = existingReport.report.id;
        await Database.query(
          `UPDATE base_survey_reports
           SET export_revision = export_revision + 1,
               last_edited_by_id = $2,
               updated_at = NOW()
           WHERE id = $1;`,
          [reportId, surveyorId]
        );
      } else {
        // Khởi tạo report nếu chưa có hoặc tái sử dụng nháp
        const initResult = await SurveyService.createPhase1Report(
          parcelId,
          surveyorId,
          cleanUnitId || undefined,
          resolvedReportType
        );
        reportId = initResult.reportId;
      }

      // 2. Map and Save Ảnh nhận diện và mặt đứng P-01 -> P-04
      await runPersistStep('ảnh định danh P01-P04', async () => {
        const step1Photos = SurveyPackageMapper.mapStep1Photos(surveyData);
        await SurveyService.saveIdentificationPhotos(reportId, step1Photos);
      });

      // 3. Map and Save Thông số kết cấu công trình
      await runPersistStep('thông số kết cấu công trình', async () => {
        const specs = SurveyPackageMapper.mapBuildingSpecs(surveyData);
        await SurveyService.saveBuildingSpecs(reportId, specs);
      });

      let resolvedFloors = (surveyData?.floors && Array.isArray(surveyData.floors))
        ? surveyData.floors
        : (surveyData?.floorSurvey ? [surveyData.floorSurvey] : null);

      // Nếu là hồ sơ CĂN HỘ CON hoặc có zones/structuralElements/localDefects/upperFloorWaterLeakage
      if (!resolvedFloors && (surveyData?.zones || surveyData?.structuralElements || surveyData?.localDefects || surveyData?.upperFloorWaterLeakage || surveyData?.unitCode)) {
        resolvedFloors = SurveyPackageMapper.mapCondoUnitFloorSurveys(surveyData);
      }

      if (resolvedFloors && Array.isArray(resolvedFloors)) {
        const floorsToSave = resolvedFloors;
        await runPersistStep('khảo sát tầng/vùng/khuyết tật', () => SurveyService.saveFloorSurveys(reportId, floorsToSave), true);
      }

      // 4. Map and Save Biến dạng & Lún nghiêng
      let def = SurveyPackageMapper.mapDeformation(surveyData);
      if (!def && (surveyData?.beamSagging || surveyData?.doorJammingStatus || surveyData?.settlementObserved)) {
        def = SurveyPackageMapper.mapCondoUnitDeformation(surveyData);
      }
      if (def) {
        const defToSave = def;
        await runPersistStep('biến dạng & lún nghiêng', () => SurveyService.saveDeformation(reportId, defToSave));
      }

      // 4.5. Map and Save Phạm vi và Hạn chế tiếp cận khảo sát (Bảng survey_scopes)
      if (surveyData?.surveyScope || surveyData?.accessLimitation || surveyData?.isAbsenteeSurvey) {
        await runPersistStep('phạm vi khảo sát', () => SurveyService.saveSurveyScope(reportId, surveyData));
      }

      // 5. Nộp hồ sơ (Ghi survey_data_json mới nhất vào base_survey_reports TRƯỚC, sau đó tính điểm Scoring và chụp Snapshot ORIGINAL_SUBMISSION)
      const submitData = SurveyPackageMapper.mapSubmitData(surveyData);
      const result = await SurveyService.submitPhase1Report(
        reportId,
        submitData,
        req.user?.userId,
        req.ip
      );
      if (result.scoreWarning) {
        submitWarnings.push(result.scoreWarning);
      }

      const isAbsentee = Boolean(
        surveyData?.isAbsentee ||
        surveyData?.isAbsenteeSurvey ||
        req.body?.status === 'POSTPONED_ABSENT' ||
        surveyData?.residentStatus === 'VẮNG_MẶT_KHÓA_CỬA'
      );

      if (isAbsentee) {
        const absInfo = (surveyData?.absenteeInfo || {}) as Record<string, unknown>;
        const minutesPhotos = (Array.isArray(absInfo.absenteeMinutesPhotos)
          ? absInfo.absenteeMinutesPhotos
          : Array.isArray(surveyData?.absenteeMinutesPhotos)
            ? surveyData.absenteeMinutesPhotos
            : []) as string[];

        await runPersistStep('nhật ký vắng mặt', async () => {
          await CadastralRepository.recordAbsence({
            parcelId,
            surveyorId,
            unitId: cleanUnitId,
            absenceReason: (typeof absInfo.absenceReason === 'string' && absInfo.absenceReason) || (typeof surveyData?.absenteeReason === 'string' && surveyData.absenteeReason) || 'HOMEOWNER_ABSENT',
            customReason: (typeof absInfo.customReason === 'string' && absInfo.customReason) || (typeof surveyData?.customAbsenteeReason === 'string' && surveyData.customAbsenteeReason) || null,
            notes: (typeof absInfo.notes === 'string' && absInfo.notes) || (typeof surveyData?.absenceNotes === 'string' && surveyData.absenceNotes) || (typeof surveyData?.notes === 'string' && surveyData.notes) || null,
            witnessName: typeof absInfo.witnessName === 'string' ? absInfo.witnessName : null,
            witnessRole: typeof absInfo.witnessRole === 'string' ? absInfo.witnessRole : null,
            witnessPhone: typeof absInfo.witnessPhone === 'string' ? absInfo.witnessPhone : null,
            noticeDelivered: Boolean(absInfo.noticeDelivered),
            photoProofUrl: minutesPhotos[0] || null,
            minutesPhotos,
            rescheduleDate: typeof absInfo.rescheduleDate === 'string' ? absInfo.rescheduleDate : null,
            attemptCount: typeof absInfo.attemptCount === 'number' ? absInfo.attemptCount : 1,
            ownerName: typeof surveyData?.ownerName === 'string' ? surveyData.ownerName : null,
            ownerPhone: typeof surveyData?.ownerPhone === 'string' ? surveyData.ownerPhone : null,
            surveyData,
          });
        });

        // Cập nhật trạng thái căn hộ con sang POSTPONED_ABSENT và báo cáo is_refused_or_absent
        if (cleanUnitId) {
          await Database.query(
            `UPDATE building_units SET status = 'POSTPONED_ABSENT', updated_at = NOW() WHERE id = $1;`,
            [cleanUnitId]
          );
        }
        await Database.query(
          `UPDATE base_survey_reports SET is_refused_or_absent = TRUE, updated_at = NOW() WHERE id = $1;`,
          [reportId]
        );
      }

      res.status(200).json({
        success: true,
        data: {
          ...result,
          status: isAbsentee ? 'POSTPONED_ABSENT' : 'SUBMITTED',
          warnings: submitWarnings,
          message: isAbsentee
            ? 'Đã nộp thành công hồ sơ vắng mặt căn hộ con (POSTPONED_ABSENT)!'
            : 'Đã nộp thành công trọn gói hồ sơ khảo sát hiện trạng Phase 1!',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Phase 2
  static async createPhase2Report(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = CreatePhase2ReportDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu khởi tạo Phase 2 không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const surveyorId = req.user!.userId;
      const result = await SurveyService.createPhase2Report({
        ...parsed.data,
        surveyorId,
      });
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPhase2ZonesByLocation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params; // parcelId
      const floor = req.query.floor as string;
      const room = req.query.room as string;

      const zones = await SurveyService.getPhase2ZonesByLocation(id, floor, room);
      res.status(200).json({
        success: true,
        data: zones,
      });
    } catch (error) {
      next(error);
    }
  }

  static async verifyPhase2Defect(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params; // defectId
      const parsed = VerifyPhase2DefectDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu đối soát vết nứt không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const result = await SurveyService.verifyPhase2Defect(id, parsed.data);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async submitPhase2Report(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = SubmitPhase2ReportDto.safeParse(req.body);

      const result = await SurveyService.submitPhase2Report(id, parsed.success ? parsed.data : {});
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPhase1ReportByParcelId(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const reportType = req.query.reportType as string | undefined;
      const unitId = req.query.unitId as string | undefined;
      const preferDraft = req.query.preferDraft === 'true';
      const status = req.query.status as string | undefined;
      const report = await SurveyService.getPhase1ReportByParcelId(id, { reportType, unitId, preferDraft, status });
      const isGuest = req.user?.role === 'GUEST';
      res.status(200).json({
        success: true,
        data: isGuest ? maskReportPii(report) : report,
      });
    } catch (error) {
      next(error);
    }
  }

  // Draft Sync & Handover Endpoints
  static async getSurveyDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const { parcelId } = req.params;
      const unitId = req.query.unitId as string | undefined;
      const surveyorId = req.user!.userId;
      const isAdminRole = req.user?.role === 'ZONE_ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const viewOnly = isAdminRole && String(req.query.viewOnly || '') === 'true';
      const result = await SurveyService.getSurveyDraft(parcelId, surveyorId, unitId, { viewOnly });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async saveSurveyDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = SaveSurveyDraftDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu bản nháp không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const surveyorId = req.user!.userId;
      const userRole = req.user?.role || 'SURVEYOR';

      // Kiểm tra trạng thái hồ sơ trước khi cho phép lưu nháp:
      // - Nếu đã APPROVED: Khóa bất biến toàn bộ (mọi vai trò)
      // - Nếu đã SUBMITTED: Chế độ xem lại không được phép tự động lưu đè bản nháp
      const existing = await SurveyService.getPhase1ReportByParcelId(parsed.data.parcelId, {
        unitId: parsed.data.unitId || null,
      });
      if (existing?.report?.status === 'APPROVED') {
        throw new ForbiddenError(
          'Hồ sơ khảo sát đã được phê duyệt bất biến. Không được phép chỉnh sửa hoặc lưu nháp.'
        );
      }
      if (existing?.report?.status === 'SUBMITTED') {
        const activeDraft = await SurveyService.findActiveDraft(parsed.data.parcelId, parsed.data.unitId || null);
        if (!activeDraft) {
          throw new ForbiddenError(
            'Hồ sơ khảo sát đã được nộp. Chế độ xem lại không được phép lưu đè bản nháp.'
          );
        }
      }

      const result = await SurveyService.saveSurveyDraft({
        ...parsed.data,
        surveyorId,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async releaseDraftLock(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = ReleaseDraftLockDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError('parcelId là bắt buộc');
      }

      const surveyorId = req.user!.userId;
      const result = await SurveyService.releaseDraftLock(
        parsed.data.parcelId,
        parsed.data.unitId || null,
        surveyorId
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async takeoverSurveyDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = TakeoverSurveyDraftDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu tiếp quản không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const newSurveyorId = req.user!.userId;
      const result = await SurveyService.takeoverSurveyDraft({
        ...parsed.data,
        newSurveyorId,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async savePhotoMappings(req: Request, res: Response, next: NextFunction) {
    try {
      const { parcelId } = req.params;
      const { unitId, mappings, deviceId } = req.body;
      const surveyorId = req.user!.userId;

      if (!parcelId || !mappings || typeof mappings !== 'object') {
        throw new BadRequestError('Dữ liệu ánh xạ ảnh không hợp lệ (cần parcelId và mappings object)');
      }

      const result = await SurveyService.savePhotoMappings({
        parcelId,
        unitId: unitId || null,
        surveyorId,
        mappings,
        deviceId,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

