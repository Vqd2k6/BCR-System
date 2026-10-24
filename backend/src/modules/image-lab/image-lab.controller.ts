/**
 * ============================================================================
 * FORENSIC IMAGE LAB CONTROLLER (STANDALONE MODULE)
 * Endpoint phục vụ Thẩm định viên & Admin kiểm nghiệm thuật toán làm rõ vết nứt,
 * khử tối (CLAHE + Gamma) và khử mờ nén trên giao diện máy tính.
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import {
  ImageLabService,
  type ImageLabPreset,
  type ImageEnhancementParams,
} from './image-lab.service';
import { BadRequestError } from '../../common/errors/problem-details';
import { Database } from '../../database/db';

const VALID_PRESETS: ImageLabPreset[] = [
  'AUTO_SMART',
  'CRACK_ENHANCE',
  'LOW_LIGHT_RESCUE',
  'DEBLOCK_COMPRESSION',
  'XRAY_NEGATIVE',
  'CUSTOM',
];

export class ImageLabController {
  /**
   * POST /api/v1/image-lab/process
   * Nhận file upload trực tiếp (multipart) hoặc imageUrl / base64,
   * trả về ảnh Trước/Sau xử lý kèm chỉ số chẩn đoán chất lượng.
   */
  public static async processImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let imageBuffer: Buffer | null = null;

      if (req.file && req.file.buffer) {
        imageBuffer = req.file.buffer;
      } else if (typeof req.body?.base64 === 'string' && req.body.base64.trim().length > 0) {
        imageBuffer = await ImageLabService.resolveBufferFromUrl(req.body.base64);
      } else if (typeof req.body?.imageUrl === 'string' && req.body.imageUrl.trim().length > 0) {
        imageBuffer = await ImageLabService.resolveBufferFromUrl(req.body.imageUrl);
      }

      if (!imageBuffer || imageBuffer.length === 0) {
        throw new BadRequestError(
          'Vui lòng tải lên file ảnh (trường "file") hoặc cung cấp đường dẫn "imageUrl" / "base64" hợp lệ.'
        );
      }

      const rawPreset = String(req.body?.preset || 'AUTO_SMART').toUpperCase() as ImageLabPreset;
      const preset: ImageLabPreset = VALID_PRESETS.includes(rawPreset) ? rawPreset : 'AUTO_SMART';

      let customParams: Partial<ImageEnhancementParams> | undefined;
      if (req.body?.customParams) {
        if (typeof req.body.customParams === 'string') {
          try {
            customParams = JSON.parse(req.body.customParams) as Partial<ImageEnhancementParams>;
          } catch (parseErr: unknown) {
            console.warn('[ImageLabController:processImage] Không thể parse customParams JSON:', parseErr);
          }
        } else if (typeof req.body.customParams === 'object') {
          customParams = req.body.customParams as Partial<ImageEnhancementParams>;
        }
      }

      const result = await ImageLabService.processAndCompare(imageBuffer, preset, customParams);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      console.error('[ImageLabController:processImage] Lỗi xử lý ảnh:', err);
      next(err);
    }
  }

  /**
   * GET /api/v1/image-lab/recent-survey-photos
   * Lấy danh sách ảnh chụp vết nứt (CU) & bối cảnh (CTX) thực tế từ hồ sơ khảo sát
   * để Admin / Thẩm định viên có thể bấm chọn test nhanh với 1 click.
   */
  public static async getRecentSurveyPhotos(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      interface SamplePhotoRow {
        photo_url: string;
        photo_code: string;
        category: string;
        parcel_code: string;
        created_at: string;
      }

      const samples: SamplePhotoRow[] = [];

      // Truy vấn an toàn các ảnh cận cảnh vết nứt (CU) và bối cảnh (CTX) gần nhất
      try {
        const defectQuery = await Database.query<{
          cu_photo_url: string | null;
          cu_photo_code: string | null;
          defect_code: string | null;
          project_parcel_code: string | null;
          created_at: string | null;
        }>(`
          SELECT
            d.cu_photo_url,
            d.cu_photo_code,
            d.defect_code,
            p.project_parcel_code,
            d.created_at::text AS created_at
          FROM defect_items d
          LEFT JOIN damage_zones z ON z.id = d.zone_id
          LEFT JOIN base_survey_reports r ON r.id = z.report_id
          LEFT JOIN parcels p ON p.id = r.parcel_id
          WHERE d.cu_photo_url IS NOT NULL
            AND d.cu_photo_url <> ''
            AND d.cu_photo_url NOT LIKE 'blob:%'
          ORDER BY d.created_at DESC NULLS LAST
          LIMIT 16;
        `);

        for (const row of defectQuery.rows) {
          if (row.cu_photo_url) {
            samples.push({
              photo_url: row.cu_photo_url,
              photo_code: row.cu_photo_code || row.defect_code || 'CU_DEFECT',
              category: 'Ảnh cận cảnh vết nứt (CU)',
              parcel_code: row.project_parcel_code || 'METRO2',
              created_at: row.created_at || new Date().toISOString(),
            });
          }
        }
      } catch (dbErr: unknown) {
        console.warn('[ImageLabController:getRecentSurveyPhotos] Bỏ qua truy vấn defect_items:', dbErr);
      }

      res.status(200).json({
        success: true,
        data: samples,
      });
    } catch (err: unknown) {
      console.error('[ImageLabController:getRecentSurveyPhotos] Lỗi lấy danh sách ảnh mẫu:', err);
      next(err);
    }
  }
}

