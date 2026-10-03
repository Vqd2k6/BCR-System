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
      let metadata: Record<string, any> | undefined;
      if (req.body.metadata) {
        if (typeof req.body.metadata === 'string') {
          try {
            metadata = JSON.parse(req.body.metadata);
          } catch (_e) {
            metadata = { note: req.body.metadata };
          }
        } else if (typeof req.body.metadata === 'object') {
          metadata = req.body.metadata;
        }
      }

      const result = await StorageService.uploadBuffer(
        file.buffer,
        file.originalname,
        file.mimetype,
        folder,
        metadata
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
      const { base64, filenamePrefix, folder, metadata } = req.body;
      if (!base64 || typeof base64 !== 'string') {
        throw new BadRequestError('Trường "base64" là bắt buộc và phải là chuỗi hợp lệ');
      }

      let parsedMeta = metadata;
      if (typeof metadata === 'string') {
        try {
          parsedMeta = JSON.parse(metadata);
        } catch (_e) {
          parsedMeta = { note: metadata };
        }
      }

      const result = await StorageService.uploadBase64(
        base64,
        filenamePrefix || 'photo',
        folder || 'surveys',
        parsedMeta
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
   * Tạo Presigned URL để client tải trực tiếp file lên Cloudflare R2
   */
  static async generatePresignedUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const { filename, mimeType, folder, metadata } = req.body;
      const cleanFilename = typeof filename === 'string' && filename.trim() ? filename.trim() : 'photo.jpg';
      const cleanMimeType = typeof mimeType === 'string' && mimeType.trim() ? mimeType.trim() : 'image/jpeg';
      const cleanFolder = typeof folder === 'string' && folder.trim() ? folder.trim() : 'surveys';

      const result = await StorageService.generatePresignedUploadUrl(
        cleanFilename,
        cleanMimeType,
        cleanFolder,
        metadata
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Endpoint nhận HTTP PUT nhị phân cục bộ khi chạy ở chế độ LOCAL development
   */
  static async handleLocalPut(req: Request, res: Response, next: NextFunction) {
    try {
      const key = req.query.key as string;
      const mimeType = (req.query.mimeType as string) || (req.headers['content-type'] as string) || 'image/jpeg';

      if (!key) {
        throw new BadRequestError('Tham số "key" là bắt buộc');
      }

      const buffer = req.body instanceof Buffer ? req.body : Buffer.from(req.body);
      const result = await StorageService.saveLocalBuffer(buffer, key, mimeType);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy Metadata lưu trữ của ảnh (S3/Cloudflare R2 Custom Headers)
   */
  static async getPhotoMetadata(req: Request, res: Response, next: NextFunction) {
    try {
      const key = (req.query.key as string) || (req.params.key as string);
      if (!key) {
        throw new BadRequestError('Tham số "key" là bắt buộc');
      }

      const metadata = await StorageService.getPhotoMetadata(key);
      res.status(200).json({
        success: true,
        data: {
          key,
          metadata,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}


