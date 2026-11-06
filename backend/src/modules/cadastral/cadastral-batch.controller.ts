import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { BadRequestError } from '../../common/errors/problem-details';
import { CadastralBatchService } from './cadastral-batch.service';
import {
  BatchAddressPreviewDto,
  BatchExcludeDto,
  BatchLocalAuthorityDto,
  BatchRestoreDto,
  BatchSyncAddressDto,
  LocalAuthoritySuggestionQueryDto,
} from './cadastral-batch.dto';

function parseOrThrow<S extends ZodTypeAny>(schema: S, payload: unknown, message: string): z.infer<S> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new BadRequestError(
      message,
      parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
    );
  }
  return parsed.data;
}

const clientIpOf = (req: Request): string | null => req.ip || null;

/** Tác vụ hàng loạt trên bản đồ GIS. Route bảo vệ bởi authenticateJwt + requireRoles('ZONE_ADMIN','SUPER_ADMIN'). */
export class CadastralBatchController {
  static async previewAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = parseOrThrow(BatchAddressPreviewDto, req.body, 'Danh sách thửa đất xem trước địa chỉ không hợp lệ');
      const data = await CadastralBatchService.previewAddress(dto.parcelIds, req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async syncAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = parseOrThrow(BatchSyncAddressDto, req.body, 'Dữ liệu cập nhật địa chỉ hàng loạt không hợp lệ');
      const data = await CadastralBatchService.syncAddress(dto, req.user, clientIpOf(req));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async setLocalAuthority(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = parseOrThrow(BatchLocalAuthorityDto, req.body, 'Dữ liệu đại diện chính quyền địa phương không hợp lệ');
      const data = await CadastralBatchService.setLocalAuthority(dto, req.user, clientIpOf(req));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async listLocalAuthoritySuggestions(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = parseOrThrow(LocalAuthoritySuggestionQueryDto, req.query, 'Thiếu mã phân khu');
      const data = await CadastralBatchService.listLocalAuthoritySuggestions(dto.zoneId, req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async exclude(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = parseOrThrow(BatchExcludeDto, req.body, 'Dữ liệu ẩn thửa hàng loạt không hợp lệ');
      const data = await CadastralBatchService.exclude(dto, req.user, clientIpOf(req));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = parseOrThrow(BatchRestoreDto, req.body, 'Dữ liệu khôi phục thửa hàng loạt không hợp lệ');
      const data = await CadastralBatchService.restore(dto, req.user, clientIpOf(req));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
