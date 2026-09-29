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
import { BadRequestError } from '../../common/errors/problem-details';

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
      res.status(200).json({
        success: true,
        data: report,
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

      const result = await SurveyService.submitPhase1Report(id, parsed.success ? parsed.data : {});
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
      const { parcelId, unitId, surveyData } = req.body;
      if (!parcelId) {
        throw new BadRequestError('parcelId là bắt buộc');
      }
      const surveyorId = req.user!.userId;
      
      // 1. Chuẩn hóa unitId để tránh lỗi UUID invalid (ví dụ: 'u-204')
      let cleanUnitId: string | null = null;
      if (unitId && typeof unitId === 'string' && unitId.trim()) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(unitId)) {
          cleanUnitId = unitId;
        } else {
          // Tra cứu trong database theo mã căn hộ (unit_code)
          const candidateCode = unitId.replace(/^u-/, 'P.');
          const rawCode = unitId.replace(/^u-/, '');
          const unitRow = await Database.query<{ id: string }>(
            `SELECT id FROM building_units WHERE parcel_id = $1 AND (unit_code = $2 OR unit_code = $3 OR unit_code ILIKE '%' || $3 || '%') LIMIT 1;`,
            [parcelId, candidateCode, rawCode]
          );
          if (unitRow.rows[0]) {
            cleanUnitId = unitRow.rows[0].id;
          }
        }
      }

      // Khởi tạo report nếu chưa có
      const initResult = await SurveyService.createPhase1Report(
        parcelId,
        surveyorId,
        cleanUnitId || undefined,
        cleanUnitId ? 'UNIT_CHILD' : 'STANDALONE'
      );
      const reportId = initResult.reportId;

      // 2. Map and Save Ảnh nhận diện và mặt đứng P-01 -> P-04 (Có phòng vệ schema)
      try {
        const step1Photos = SurveyPackageMapper.mapStep1Photos(surveyData);
        await SurveyService.saveIdentificationPhotos(reportId, step1Photos);
      } catch (photoErr) {
        console.warn('[submitPhase1FullPackage] Cảnh báo lưu survey_identification_photos (Dữ liệu vẫn được bảo toàn 100% trong survey_data_json):', photoErr);
      }

      // 3. Map and Save Thông số kết cấu công trình
      try {
        const specs = SurveyPackageMapper.mapBuildingSpecs(surveyData);
        await SurveyService.saveBuildingSpecs(reportId, specs);
      } catch (specsErr) {
        console.warn('[submitPhase1FullPackage] Cảnh báo lưu building_specifications:', specsErr);
      }

      if (surveyData?.floors && Array.isArray(surveyData.floors)) {
        try {
          await SurveyService.saveFloorSurveys(reportId, surveyData.floors);
        } catch (floorsErr) {
          console.warn('[submitPhase1FullPackage] Cảnh báo lưu floor surveys:', floorsErr);
        }
      }

      // 4. Map and Save Biến dạng & Lún nghiêng
      const def = SurveyPackageMapper.mapDeformation(surveyData);
      if (def) {
        try {
          await SurveyService.saveDeformation(reportId, def);
        } catch (defErr) {
          console.warn('[submitPhase1FullPackage] Cảnh báo lưu deformation:', defErr);
        }
      }

      // 4.5. Map and Save Phạm vi và Hạn chế tiếp cận khảo sát (Bảng survey_scopes)
      if (surveyData?.surveyScope || surveyData?.accessLimitation || surveyData?.isAbsenteeSurvey) {
        try {
          await SurveyService.saveSurveyScope(reportId, surveyData);
        } catch (scopeErr) {
          console.warn('[submitPhase1FullPackage] Cảnh báo lưu survey scope:', scopeErr);
        }
      }

      // 5. Tính điểm Rủi ro (Scoring) tự động trên Backend
      try {
        await ScoringService.calculatePhase1Scores(reportId);
      } catch (scoreErr) {
        console.warn('[submitPhase1FullPackage] Cảnh báo tính điểm scoring:', scoreErr);
      }

      // 6. Nộp hồ sơ (Chuyển status thành SUBMITTED & lưu survey_data_json toàn vẹn)
      const submitData = SurveyPackageMapper.mapSubmitData(surveyData);
      const result = await SurveyService.submitPhase1Report(reportId, submitData);

      res.status(200).json({
        success: true,
        data: {
          ...result,
          message: 'Đã nộp thành công trọn gói hồ sơ khảo sát hiện trạng Phase 1!',
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
      const report = await SurveyService.getPhase1ReportByParcelId(id);
      res.status(200).json({
        success: true,
        data: report,
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
      const result = await SurveyService.getSurveyDraft(parcelId, surveyorId, unitId);
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
}

