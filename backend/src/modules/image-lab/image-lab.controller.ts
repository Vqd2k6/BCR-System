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
  type StudioCommitItemInput,
} from './image-lab.service';
import { BadRequestError } from '../../common/errors/problem-details';
import { Database } from '../../database/db';

const VALID_PRESETS: ImageLabPreset[] = [
  'AUTO_SMART',
  'CRACK_ENHANCE_V1',
  'CRACK_ENHANCE_V2',
  'CRACK_ENHANCE',
  'LOW_LIGHT_RESCUE',
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
   * Thu thập bộ 100 ảnh khảo sát thực tế từ hiện trường (cả ảnh cận cảnh vết nứt CU
   * và ảnh bối cảnh khu vực CTX), giới hạn nghiêm ngặt tối đa 5 ảnh trên mỗi căn/hộ (parcel)
   * để Admin / Thẩm định viên kiểm thử đối chứng đa dạng trên nhiều công trình.
   */
  public static async getRecentSurveyPhotos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      interface SamplePhotoRow {
        photo_url: string;
        photo_code: string;
        category: string;
        photo_type: 'CU' | 'CTX';
        parcel_code: string;
        rank_in_parcel: number;
        created_at: string;
      }

      const rawLimit = Number(req.query?.limit);
      const totalLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(200, Math.round(rawLimit)) : 100;

      const rawMaxPerParcel = Number(req.query?.maxPerParcel);
      const maxPerParcel =
        Number.isFinite(rawMaxPerParcel) && rawMaxPerParcel > 0 ? Math.min(10, Math.round(rawMaxPerParcel)) : 5;

      const samples: SamplePhotoRow[] = [];

      // Truy vấn kết hợp defect_items (CU) & damage_zones (CTX), khử trùng lặp URL
      // và phân vùng theo mã căn (ROW_NUMBER OVER PARTITION BY parcel_code <= 5)
      try {
        const collectedQuery = await Database.query<{
          photo_url: string;
          photo_code: string;
          category: string;
          photo_type: 'CU' | 'CTX';
          parcel_code: string;
          rn_in_parcel: string | number;
          created_at: string;
        }>(
          `
          WITH combined_photos AS (
            SELECT
              d.cu_photo_url AS photo_url,
              COALESCE(NULLIF(d.cu_photo_code, ''), NULLIF(d.defect_code, ''), 'CU_DEFECT') AS photo_code,
              'Ảnh cận cảnh vết nứt (CU)' AS category,
              'CU' AS photo_type,
              COALESCE(NULLIF(p.project_parcel_code, ''), NULLIF(r.report_code, ''), 'METRO2') AS parcel_code,
              COALESCE(d.captured_at, r.created_at, NOW()) AS sort_time,
              1 AS cat_priority
            FROM defect_items d
            INNER JOIN damage_zones z ON z.id = d.zone_id AND COALESCE(z.is_deleted, false) = false
            INNER JOIN base_survey_reports r ON r.id = z.report_id AND r.deleted_at IS NULL
            LEFT JOIN parcels p ON p.id = r.parcel_id
            WHERE COALESCE(d.is_deleted, false) = false
              AND d.cu_photo_url IS NOT NULL
              AND d.cu_photo_url <> ''
              AND d.cu_photo_url NOT LIKE 'blob:%'

            UNION ALL

            SELECT
              z.ctx_photo_url AS photo_url,
              COALESCE(NULLIF(z.ctx_photo_code, ''), NULLIF(z.zone_code, ''), 'CTX_ZONE') AS photo_code,
              'Ảnh bối cảnh khu vực (CTX)' AS category,
              'CTX' AS photo_type,
              COALESCE(NULLIF(p.project_parcel_code, ''), NULLIF(r.report_code, ''), 'METRO2') AS parcel_code,
              COALESCE(r.created_at, NOW()) AS sort_time,
              2 AS cat_priority
            FROM damage_zones z
            INNER JOIN base_survey_reports r ON r.id = z.report_id AND r.deleted_at IS NULL
            LEFT JOIN parcels p ON p.id = r.parcel_id
            WHERE COALESCE(z.is_deleted, false) = false
              AND z.ctx_photo_url IS NOT NULL
              AND z.ctx_photo_url <> ''
              AND z.ctx_photo_url NOT LIKE 'blob:%'
          ),
          deduped AS (
            SELECT DISTINCT ON (photo_url)
              photo_url,
              photo_code,
              category,
              photo_type,
              parcel_code,
              sort_time,
              cat_priority
            FROM combined_photos
            ORDER BY photo_url, sort_time DESC
          ),
          ranked_by_cat AS (
            SELECT
              *,
              ROW_NUMBER() OVER (
                PARTITION BY parcel_code, cat_priority
                ORDER BY sort_time DESC, photo_code ASC
              ) AS rn_in_cat
            FROM deduped
          ),
          ranked_per_parcel AS (
            SELECT
              photo_url,
              photo_code,
              category,
              photo_type,
              parcel_code,
              sort_time,
              sort_time::text AS created_at,
              MAX(sort_time) OVER (PARTITION BY parcel_code) AS parcel_latest_time,
              ROW_NUMBER() OVER (
                PARTITION BY parcel_code
                ORDER BY
                  -- Xen kẽ tối đa 3 ảnh CU và 2 ảnh CTX trên mỗi căn để đa dạng góc chụp
                  CASE
                    WHEN cat_priority = 1 AND rn_in_cat <= 3 THEN rn_in_cat * 2 - 1
                    WHEN cat_priority = 2 AND rn_in_cat <= 2 THEN rn_in_cat * 2
                    ELSE 100 + rn_in_cat
                  END ASC,
                  sort_time DESC
              ) AS rn_in_parcel
            FROM ranked_by_cat
          )
          SELECT
            photo_url,
            photo_code,
            category,
            photo_type,
            parcel_code,
            rn_in_parcel,
            created_at
          FROM ranked_per_parcel
          WHERE rn_in_parcel <= $1
          ORDER BY parcel_latest_time DESC, parcel_code ASC, rn_in_parcel ASC
          LIMIT $2;
          `,
          [maxPerParcel, totalLimit]
        );

        for (const row of collectedQuery.rows) {
          if (row.photo_url) {
            samples.push({
              photo_url: row.photo_url,
              photo_code: row.photo_code || 'SURVEY_PHOTO',
              category: row.category || 'Ảnh khảo sát hiện trạng',
              photo_type: row.photo_type === 'CTX' ? 'CTX' : 'CU',
              parcel_code: row.parcel_code || 'METRO2',
              rank_in_parcel: Number(row.rn_in_parcel) || 1,
              created_at: row.created_at || new Date().toISOString(),
            });
          }
        }
      } catch (dbErr: unknown) {
        console.warn('[ImageLabController:getRecentSurveyPhotos] Bỏ qua truy vấn danh sách 100 ảnh khảo sát:', dbErr);
      }

      res.status(200).json({
        success: true,
        meta: {
          totalCollected: samples.length,
          maxPerParcel,
          distinctParcels: new Set(samples.map((s) => s.parcel_code)).size,
        },
        data: samples,
      });
    } catch (err: unknown) {
      console.error('[ImageLabController:getRecentSurveyPhotos] Lỗi lấy danh sách ảnh mẫu:', err);
      next(err);
    }
  }

  /**
   * POST /api/v1/image-lab/commit-studio-session
   * Tạo file ảnh mới riêng biệt trên Server sau khi Thẩm định viên xác nhận lưu Studio Img,
   * gắn vào phiên thẩm định hiện tại (bảo toàn ảnh gốc KSV) và dùng cho Báo cáo PDF.
   */
  public static async commitStudioSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reportId = String(req.body?.reportId || req.params?.id || '').trim();
      const items = (Array.isArray(req.body?.items) ? req.body.items : []) as StudioCommitItemInput[];
      const adminId = req.user?.userId || 'ADMIN';
      const clientIp = req.ip || req.socket?.remoteAddress;

      const result = await ImageLabService.commitStudioSession(reportId, adminId, items, clientIp);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      console.error('[ImageLabController:commitStudioSession] Lỗi lưu phiên Studio Img:', err);
      next(err);
    }
  }
}

