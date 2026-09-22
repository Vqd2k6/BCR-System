import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../../common/services/storage.service';
import { BadRequestError } from '../../common/errors/problem-details';

export class StorageController {
  /**
   * Upload file thông qua FormData / Multipart
   */
  static async uploadFile(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      if (!file) {
        throw new BadRequestError('Không tìm thấy file tải lên (trường "file")');
      }

      const folder = (req.body.folder as string) || 'surveys';
      const result = await StorageService.uploadBuffer(
        file.buffer,
        file.originalname,
        file.mimetype,
        folder
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload ảnh trực tiếp từ chuỗi Base64
   */
  static async uploadBase64(req: Request, res: Response, next: NextFunction) {
    try {
      const { base64, filenamePrefix, folder } = req.body;
      if (!base64 || typeof base64 !== 'string') {
        throw new BadRequestError('Trường "base64" là bắt buộc và phải là chuỗi hợp lệ');
      }

      const result = await StorageService.uploadBase64(
        base64,
        filenamePrefix || 'photo',
        folder || 'surveys'
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
