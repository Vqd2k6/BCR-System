import { Request, Response, NextFunction } from 'express';
import { CadastralService } from './cadastral.service';
import {
  StartSurveyDto,
  RecordAbsenceDto,
  UpdateFootprintDto,
  ProposeMutationDto,
  ApproveMutationDto,
} from './cadastral.dto';
import { BadRequestError } from '../../common/errors/problem-details';

export class CadastralController {
  static async getZoneMap(req: Request, res: Response, next: NextFunction) {
    try {
      const zoneId = (req.query.zoneId as string) || req.user?.assignedZoneId || 'ZONE_S9';
      const status = req.query.status as string;
      const parcels = await CadastralService.listParcelsInZone(zoneId, status);
      res.status(200).json({
        success: true,
        data: parcels,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getNearbyParcels(req: Request, res: Response, next: NextFunction) {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : 150;

      if (isNaN(lat) || isNaN(lng)) {
        throw new BadRequestError('Tọa độ GPS lat, lng không hợp lệ');
      }

      const parcels = await CadastralService.findNearbyParcels(lat, lng, radius);
      res.status(200).json({
        success: true,
        data: parcels,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getParcelById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parcel = await CadastralService.getParcelById(id);
      res.status(200).json({
        success: true,
        data: parcel,
      });
    } catch (error) {
      next(error);
    }
  }

  static async startSurvey(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = StartSurveyDto.safeParse(req.body);
      const surveyorId = req.user!.userId;

      const result = await CadastralService.startAdHocSurvey(
        id,
        surveyorId,
        parsed.success ? parsed.data.phase : 'PHASE_1'
      );
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async recordAbsence(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = RecordAbsenceDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu ghi nhận vắng nhà không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const surveyorId = req.user!.userId;
      const result = await CadastralService.recordAbsence(id, surveyorId, parsed.data);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateFootprint(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = UpdateFootprintDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu đa giác footprint không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const result = await CadastralService.updateFootprint(
        id,
        parsed.data.footprintPolygonGeoJson,
        parsed.data.measuredConstructionAreaM2
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async proposeMutation(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = ProposeMutationDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu đề xuất tách/gộp thửa không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const surveyorId = req.user!.userId;
      const result = await CadastralService.proposeMutation(surveyorId, parsed.data);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async approveMutation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = ApproveMutationDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError('Dữ liệu phê duyệt không hợp lệ');
      }

      const adminId = req.user!.userId;
      const result = await CadastralService.approveOrRejectMutation(
        id,
        adminId,
        parsed.data.action,
        parsed.data.rejectionReason
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUnits(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await CadastralService.listUnitsForParcel(id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { unitCode, floorNumber, ownerName, ownerPhone, ownerIdCard } = req.body;
      if (!unitCode) {
        throw new BadRequestError('Mã số căn hộ (unitCode) là bắt buộc');
      }
      const result = await CadastralService.createUnitForParcel(id, {
        unitCode,
        floorNumber: floorNumber !== undefined ? parseInt(floorNumber, 10) : 1,
        ownerName,
        ownerPhone,
        ownerIdCard,
      });
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getNextHighRangeProjectCodes(req: Request, res: Response, next: NextFunction) {
    try {
      const count = req.query.count ? parseInt(req.query.count as string, 10) : 2;
      const result = await CadastralService.getNextHighRangeCodes(count);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateBuildingType(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { buildingType, totalUnits } = req.body;
      if (!buildingType) {
        throw new BadRequestError('Loại hình công trình (buildingType) là bắt buộc');
      }
      const result = await CadastralService.updateBuildingType(
        id,
        buildingType,
        totalUnits !== undefined ? parseInt(totalUnits, 10) : undefined
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}



