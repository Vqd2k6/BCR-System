import { Request, Response, NextFunction } from 'express';
import { SurveyService } from './survey.service';
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
} from './survey.dto';
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
      
      // 1. Khởi tạo report nếu chưa có
      const initResult = await SurveyService.createPhase1Report(
        parcelId,
        surveyorId,
        unitId,
        unitId ? 'UNIT_CHILD' : 'STANDALONE'
      );
      const reportId = initResult.reportId;

      // 2. Lưu các bước nếu có dữ liệu
      const step1Photos = surveyData?.step1Photos || {
        p01HouseNumberUrl: surveyData?.photoP01?.url,
        p01NotApplicable: surveyData?.photoP01?.notApplicable,
        p02MainFacadeUrl: surveyData?.photoP02?.url,
        p02NotApplicable: surveyData?.photoP02?.notApplicable,
        p03SideRearUrl: surveyData?.photoP03?.url,
        p03NotApplicable: surveyData?.photoP03?.notApplicable,
        p04ContextStreetUrl: surveyData?.photoP04?.url,
        p04NotApplicable: surveyData?.photoP04?.notApplicable,
        houseNumber: surveyData?.houseNumber,
        street: surveyData?.street,
      };
      if (step1Photos.p01HouseNumberUrl || step1Photos.p02MainFacadeUrl || step1Photos.houseNumber || surveyData?.step1Photos) {
        await SurveyService.saveIdentificationPhotos(reportId, step1Photos);
      }

      const specs = surveyData?.specs || {
        buildingName: surveyData?.buildingName,
        landUseFunction: surveyData?.usageFunction,
        floorCount: surveyData?.aboveFloors !== '' && surveyData?.aboveFloors !== undefined ? Number(surveyData.aboveFloors) : 1,
        basementCount: surveyData?.undergroundFloors !== '' && surveyData?.undergroundFloors !== undefined ? Number(surveyData.undergroundFloors) : 0,
        constructionAreaM2: surveyData?.constructionAreaM2 !== '' && surveyData?.constructionAreaM2 !== undefined ? Number(surveyData.constructionAreaM2) : null,
        buildingHeightM: surveyData?.buildingHeightM !== '' && surveyData?.buildingHeightM !== undefined ? Number(surveyData.buildingHeightM) : null,
        yearOfConstruction: surveyData?.constructionYear !== '' && surveyData?.constructionYear !== undefined ? Number(surveyData.constructionYear) : null,
        isYearEstimated: Boolean(surveyData?.isEstimatedYear),
        structuralSystem: surveyData?.structureSystem || 'KHUNG_BTCT_CHIU_LUC',
        foundationCategory: surveyData?.foundationType || 'CAT_2_MONG_DON_BTCT',
        foundationSource: surveyData?.foundationSource || 'Bản vẽ hoàn công',
        adjacentBuildings: surveyData?.adjacentBuildings ? JSON.stringify(surveyData.adjacentBuildings) : null,
      };
      if (specs.floorCount || specs.structuralSystem || surveyData?.specs) {
        await SurveyService.saveBuildingSpecs(reportId, specs);
      }

      if (surveyData?.floors && Array.isArray(surveyData.floors)) {
        await SurveyService.saveFloorSurveys(reportId, surveyData.floors);
      }
      if (surveyData?.deformation) {
        await SurveyService.saveDeformation(reportId, surveyData.deformation);
      }

      // 3. Nộp hồ sơ
      const result = await SurveyService.submitPhase1Report(reportId, {
        ownerRemarks: surveyData?.signatures?.ownerRemarks || surveyData?.ownerRemarks || '',
        surveyorSignatureUrl: surveyData?.signatures?.surveyorSignatureUrl || surveyData?.surveyorSignatureUrl || '',
        ownerSignatureUrl: surveyData?.signatures?.ownerSignatureUrl || surveyData?.ownerSignatureUrl || '',
        summaryConclusions: surveyData?.signatures?.summaryConclusions || surveyData?.executiveSummary?.summaryConclusionsText || '',
        engineeringRecommendations: surveyData?.signatures?.engineeringRecommendations || surveyData?.executiveSummary?.specificRecommendationsText || '',
        houseNumber: surveyData?.houseNumber,
        street: surveyData?.street,
      });

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
}
