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
  normalizeStructuralSystem,
  normalizeFoundationCategory,
} from './survey.dto';
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

      // 2. Map and Save Ảnh nhận diện và mặt đứng P-01 -> P-04
      const p01 = surveyData?.photoP01 || {};
      const p02 = surveyData?.photoP02 || {};
      const p03 = surveyData?.photoP03 || {};
      const p04 = surveyData?.photoP04 || {};

      const step1Photos = {
        p01HouseNumberUrl: surveyData?.step1Photos?.p01HouseNumberUrl || p01.url || null,
        p01NotApplicable: surveyData?.step1Photos?.p01NotApplicable ?? p01.notApplicable ?? false,
        p01NaReason: surveyData?.step1Photos?.p01NaReason || p01.naReason,
        p02MainFacadeUrl: surveyData?.step1Photos?.p02MainFacadeUrl || p02.url || null,
        p02FacadePolygonPoints: surveyData?.step1Photos?.p02FacadePolygonPoints || p02.polygonPoints,
        p02FloorSplitLines: surveyData?.step1Photos?.p02FloorSplitLines || p02.floorSplits,
        p02Dimensions: surveyData?.step1Photos?.p02Dimensions || p02.dimensions,
        p02NotApplicable: surveyData?.step1Photos?.p02NotApplicable ?? p02.notApplicable ?? false,
        p02NaReason: surveyData?.step1Photos?.p02NaReason || p02.naReason,
        p03SideRearUrl: surveyData?.step1Photos?.p03SideRearUrl || p03.url || null,
        p03NotApplicable: surveyData?.step1Photos?.p03NotApplicable ?? p03.notApplicable ?? false,
        p04ContextStreetUrl: surveyData?.step1Photos?.p04ContextStreetUrl || p04.url || null,
        p04NotApplicable: surveyData?.step1Photos?.p04NotApplicable ?? p04.notApplicable ?? false,
      };
      await SurveyService.saveIdentificationPhotos(reportId, step1Photos);

      const rawStructure = surveyData?.specs?.structuralSystem || surveyData?.structureSystem || surveyData?.specs?.structureSystem;
      const rawFoundation = surveyData?.specs?.foundationCategory || surveyData?.foundationType || surveyData?.specs?.foundationType;

      let foundationCategory = normalizeFoundationCategory(rawFoundation);
      const score = surveyData?.foundationCatScore;
      if (score === 1) foundationCategory = 'CAT_1_MONG_NONG_GIA_CO';
      else if (score === 2) foundationCategory = 'CAT_2_MONG_DON_BTCT';
      else if (score === 3) foundationCategory = 'CAT_3_MONG_BANG_BTCT';
      else if (score === 4) foundationCategory = 'CAT_4_MONG_COC_BTCT';
      else if (score === 5) foundationCategory = 'CAT_5_KHONG_XAC_DINH';

      const specs = {
        buildingName: surveyData?.specs?.buildingName || surveyData?.buildingName,
        buildingGrade: surveyData?.objectGroup === 'GENERAL' || surveyData?.objectGroup === 'IMPORTANT' || surveyData?.objectGroup === 'CRITICAL'
          ? surveyData.objectGroup
          : (surveyData?.targetGroup || surveyData?.specs?.buildingGrade || 'GENERAL'),
        landUseFunction: surveyData?.specs?.landUseFunction || surveyData?.usageFunction,
        floorCount: Number(surveyData?.specs?.floorCount ?? (surveyData?.aboveFloors !== '' && surveyData?.aboveFloors !== undefined ? surveyData.aboveFloors : 1)),
        basementCount: Number(surveyData?.specs?.basementCount ?? (surveyData?.undergroundFloors !== '' && surveyData?.undergroundFloors !== undefined ? surveyData.undergroundFloors : 0)),
        constructionAreaM2: surveyData?.specs?.constructionAreaM2 ?? (surveyData?.constructionAreaM2 !== '' && surveyData?.constructionAreaM2 !== undefined ? Number(surveyData.constructionAreaM2) : null),
        buildingHeightM: surveyData?.specs?.buildingHeightM ?? (surveyData?.buildingHeightM !== '' && surveyData?.buildingHeightM !== undefined ? Number(surveyData.buildingHeightM) : null),
        yearOfConstruction: surveyData?.specs?.yearOfConstruction ?? (surveyData?.constructionYear !== '' && surveyData?.constructionYear !== undefined ? Number(surveyData.constructionYear) : null),
        isYearEstimated: Boolean(surveyData?.specs?.isYearEstimated ?? surveyData?.isEstimatedYear),
        structuralSystem: normalizeStructuralSystem(rawStructure),
        foundationCategory,
        foundationSource: surveyData?.specs?.foundationSource || surveyData?.foundationSource || 'Bản vẽ hoàn công',
        adjacentBuildings: surveyData?.specs?.adjacentBuildings || (surveyData?.adjacentBuildings ? JSON.stringify(surveyData.adjacentBuildings) : null),
        extendedOrRenovated: (surveyData?.historyInterview?.renovationLoad ?? 0) > 0 || Boolean(surveyData?.specs?.extendedOrRenovated ?? surveyData?.extendedOrRenovated ?? surveyData?.history?.extendedOrRenovated ?? false),
        previousSettlementOrTilt: (surveyData?.historyInterview?.pastSettlement ?? 0) > 0 || Boolean(surveyData?.specs?.previousSettlementOrTilt ?? surveyData?.previousSettlementOrTilt ?? false),
        fireOrAccident: (surveyData?.historyInterview?.fireFloodIncident ?? 0) > 0 || Boolean(surveyData?.specs?.fireOrAccident ?? surveyData?.fireOrAccident ?? false),
        sensitiveEquipmentPresent: Boolean(surveyData?.historyInterview?.sensitiveEquipment?.has ?? surveyData?.specs?.sensitiveEquipmentPresent ?? surveyData?.sensitiveEquipmentPresent ?? false),
        historyDetails: surveyData?.historyInterview ? JSON.stringify(surveyData.historyInterview) : (surveyData?.specs?.historyDetails || surveyData?.historyDetails || null),
        e5HistoryScore: Number(surveyData?.ecs?.e5 ?? surveyData?.specs?.e5HistoryScore ?? surveyData?.e5HistoryScore ?? 0),
      };
      await SurveyService.saveBuildingSpecs(reportId, specs);

      if (surveyData?.floors && Array.isArray(surveyData.floors)) {
        await SurveyService.saveFloorSurveys(reportId, surveyData.floors);
      }

      if (surveyData?.settlementTilt) {
        const tilt = surveyData.settlementTilt.buildingTilt || {};
        const sag = surveyData.settlementTilt.beamSagging || {};
        const def = {
          tiltAngleX: tilt.xPermille || 0,
          tiltAngleY: tilt.yPermille || 0,
          tiltDirection: tilt.direction,
          beamDeflectionMm: sag.sagMm || 0,
          measurementMethod: surveyData.settlementTilt.dataSource ? surveyData.settlementTilt.dataSource.join(', ') : 'LASER_LEVEL',
          measurementReliability: surveyData.settlementTilt.reliability || 'HIGH',
        };
        await SurveyService.saveDeformation(reportId, def);
      } else if (surveyData?.deformation) {
        await SurveyService.saveDeformation(reportId, surveyData.deformation);
      }

      // 3. Tính điểm Rủi ro (Scoring) tự động trên Backend
      await ScoringService.calculatePhase1Scores(reportId);

      // 4. Nộp hồ sơ
      const result = await SurveyService.submitPhase1Report(reportId, {
        ownerRemarks: surveyData?.signatures?.ownerFeedback || surveyData?.signatures?.ownerRemarks || surveyData?.ownerRemarks || '',
        surveyorSignatureUrl: surveyData?.signatures?.preparedBy?.photoUrl || surveyData?.signatures?.surveyorSignatureUrl || surveyData?.surveyorSignatureUrl || '',
        ownerSignatureUrl: surveyData?.signatures?.ownerRepresentative?.photoUrl || surveyData?.signatures?.ownerSignatureUrl || surveyData?.ownerSignatureUrl || '',
        summaryConclusions: surveyData?.executiveSummary?.keyRisksDefectsText || surveyData?.executiveSummary?.summaryConclusionsText || surveyData?.signatures?.summaryConclusions || surveyData?.summaryConclusions || '',
        engineeringRecommendations: surveyData?.executiveSummary?.specificRecommendationsText || surveyData?.signatures?.engineeringRecommendations || surveyData?.engineeringRecommendations || '',
        houseNumber: surveyData?.houseNumber,
        street: surveyData?.street,
        surveyDataJson: surveyData || null,
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
}
