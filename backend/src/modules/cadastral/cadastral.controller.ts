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
import { maskParcelPii } from '../../common/utils/pii.utils';

export class CadastralController {
  static async getZoneMap(req: Request, res: Response, next: NextFunction) {
    try {
      const isGuest = req.user?.role === 'GUEST';
      let zoneId = (req.query.zoneId as string) || req.user?.assignedZoneId || 'ZONE_01';
      // Nếu là GUEST và đã được gán Zone cụ thể thì bắt buộc theo Zone đó
      if (isGuest && req.user?.assignedZoneId) {
        zoneId = req.user.assignedZoneId;
      }
      const status = req.query.status as string;
      const parcels = await CadastralService.listParcelsInZone(zoneId, status);
      const data = isGuest ? parcels.map(maskParcelPii) : parcels;
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMetroAlignment(req: Request, res: Response, next: NextFunction) {
    try {
      const alignment = await CadastralService.getMetroAlignment();
      res.status(200).json({
        success: true,
        data: alignment,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMetroSegments(req: Request, res: Response, next: NextFunction) {
    try {
      const segments = await CadastralService.getMetroSegments();
      res.status(200).json({
        success: true,
        data: segments,
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
      const isGuest = req.user?.role === 'GUEST';
      res.status(200).json({
        success: true,
        data: isGuest ? maskParcelPii(parcel) : parcel,
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

      const userId = req.user?.userId;
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket?.remoteAddress;

      const result = await CadastralService.updateFootprint(
        id,
        parsed.data.footprintPolygonGeoJson,
        parsed.data.measuredConstructionAreaM2,
        userId,
        parsed.data.reason,
        clientIp
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
      const zoneId = req.query.zoneId as string | undefined;
      const parcelId = req.query.parcelId as string | undefined;
      const result = await CadastralService.getNextHighRangeCodes(count, zoneId, parcelId);
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

  static async resumeSurvey(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const surveyorId = req.user!.userId;
      const result = await CadastralService.resumeSurveyAfterAbsence(id, surveyorId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyAssignedParcels(req: Request, res: Response, next: NextFunction) {
    try {
      const surveyorId = req.user!.userId;
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
      const result = await CadastralService.getMyAssignedParcels(surveyorId, lat, lng);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async assignSurveyor(req: Request, res: Response, next: NextFunction) {
    try {
      const { parcelIds, surveyorId, notes } = req.body;
      if (!Array.isArray(parcelIds) || parcelIds.length === 0 || !surveyorId) {
        throw new BadRequestError('Danh sách parcelIds và surveyorId là bắt buộc');
      }
      const result = await CadastralService.assignSurveyor(parcelIds, surveyorId, notes);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async executeAdminMutation(req: Request, res: Response, next: NextFunction) {
    try {
      const adminId = req.user!.userId;
      const clientIp = req.ip || req.socket.remoteAddress;
      const result = await CadastralService.executeAdminMutation(adminId, req.body, clientIp);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getAdjacentCandidates(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await CadastralService.getAdjacentCandidates(id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Endpoint hoán đổi ranh đất không gian GIS (Spatial Geometry Swap)
   */
  static async swapGeometries(req: Request, res: Response, next: NextFunction) {
    try {
      const { parcelAId, parcelBId, reason } = req.body;
      if (!parcelAId || !parcelBId) {
        throw new BadRequestError('Vui lòng cung cấp đầy đủ thông tin thửa A (parcelAId) và thửa B (parcelBId)');
      }

      const adminId = req.user!.userId;
      const clientIp = req.ip || req.socket.remoteAddress;

      const result = await CadastralService.swapParcelGeometries(
        parcelAId,
        parcelBId,
        adminId,
        reason || '',
        clientIp
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getParcelMutationHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await CadastralService.getParcelMutationHistory(id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getZoneMutationHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { zoneId } = req.query;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      if (!zoneId) {
        throw new BadRequestError('Vui lòng cung cấp mã zoneId để tra cứu lịch sử');
      }

      const result = await CadastralService.getZoneMutationHistory(zoneId as string, limit, offset);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}



