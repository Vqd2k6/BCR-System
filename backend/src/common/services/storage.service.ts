import { S3Client, PutObjectCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../../config';

export interface UploadResult {
  url: string;
  key: string;
  checksumSha256: string;
  sizeBytes: number;
  mimeType: string;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  method: 'PUT';
  headers?: Record<string, string>;
  expiresInSeconds: number;
}

export class StorageService {
  private static s3Client: S3Client | null = null;

  /**
   * Tự động kiểm tra và cấu hình CORS cho bucket Cloudflare R2
   * Cho phép trình duyệt PWA gửi trực tiếp lệnh PUT nhị phân lên bucket
   */
  public static async autoConfigureR2Cors(): Promise<void> {
    if (config.storage.type !== 'r2' && config.storage.type !== 's3') {
      return;
    }

    try {
      const client = this.getS3Client();
      await client.send(
        new PutBucketCorsCommand({
          Bucket: config.storage.s3.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
                AllowedOrigins: [
                  'https://*.vercel.app',
                  'http://localhost:3000',
                  'http://localhost:5173',
                  '*',
                ],
                ExposeHeaders: ['ETag'],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        })
      );
      console.log(`✅ [R2 STORAGE] Đã tự động cấu hình CORS cho bucket "${config.storage.s3.bucket}".`);
    } catch (err: any) {
      console.warn(
        `⚠️ [R2 STORAGE] Không thể tự động đặt CORS qua S3 API token: ${err?.message || err}. (Quản trị viên có thể dán CORS rule trong Cloudflare Dashboard nếu cần).`
      );
    }
  }

  private static getS3Client(): S3Client {
    if (!this.s3Client) {
      if (!config.storage.s3.endpoint || !config.storage.s3.accessKeyId || !config.storage.s3.secretAccessKey) {
        throw new Error('S3/Cloudflare R2 configuration is missing endpoint, accessKeyId, or secretAccessKey.');
      }

      let endpoint = config.storage.s3.endpoint.trim();
      const bucket = config.storage.s3.bucket?.trim();
      if (bucket && endpoint.endsWith(`/${bucket}`)) {
        endpoint = endpoint.slice(0, -(`/${bucket}`.length));
      }
      endpoint = endpoint.replace(/\/+$/, '');

      this.s3Client = new S3Client({
        region: config.storage.s3.region || 'auto',
        endpoint,
        credentials: {
          accessKeyId: config.storage.s3.accessKeyId.trim(),
          secretAccessKey: config.storage.s3.secretAccessKey.trim(),
        },
      });
    }
    return this.s3Client;
  }

  /**
   * Tính mã băm SHA-256 bảo đảm tính toàn vẹn và pháp lý của ảnh chứng cứ
   */
  public static calculateSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Chuẩn hóa và làm sạch Metadata cho S3 / Cloudflare R2:
   * 1. Key: chữ thường, chỉ chứa a-z, 0-9, gạch ngang, gạch dưới.
   * 2. Value: loại bỏ dấu tiếng Việt sang ASCII an toàn, giới hạn độ dài < 500 ký tự.
   */
  public static sanitizeMetadataForS3(meta?: Record<string, any>): Record<string, string> {
    const result: Record<string, string> = {};
    if (!meta || typeof meta !== 'object') return result;

    for (const [rawKey, rawVal] of Object.entries(meta)) {
      if (rawVal === undefined || rawVal === null || rawVal === '') continue;
      const cleanKey = String(rawKey).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      if (!cleanKey) continue;

      let cleanVal = String(rawVal)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^\x20-\x7E]/g, '') // Chỉ giữ các ký tự ASCII an toàn
        .trim();

      if (cleanVal.length > 500) {
        cleanVal = cleanVal.slice(0, 500);
      }

      result[cleanKey] = cleanVal;
    }
    return result;
  }

  /**
   * Tạo S3 Key chuẩn hóa theo cấu trúc thư mục rõ ràng và dễ tra cứu:
   * surveys/{buildingCode}/{category}/{cleanFilename}
   */
  public static buildUniqueKey(filename: string, folder: string = 'surveys'): string {
    const ext = path.extname(filename) || '.jpg';
    const cleanBasename = path.basename(filename, ext).replace(/[^a-zA-Z0-9_.-]/g, '_');
    
    // Nếu cleanBasename đã có timestamp hoặc suffix dài, chỉ thêm random hash ngắn
    const shortHash = crypto.randomUUID().slice(0, 6);
    const hasSuffix = /[0-9]{8,}/.test(cleanBasename);
    const finalBasename = hasSuffix ? `${cleanBasename}_${shortHash}` : `${cleanBasename}_${Date.now()}_${shortHash}`;
    
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '') || 'surveys';
    return `${cleanFolder}/${finalBasename}${ext}`;
  }

  /**
   * Tải Buffer (file nhị phân) lên Cloudflare R2 hoặc Local storage
   */
  public static async uploadBuffer(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    folder: string = 'surveys',
    metadata?: Record<string, any>
  ): Promise<UploadResult> {
    const checksumSha256 = this.calculateSha256(buffer);
    const sizeBytes = buffer.length;
    const uniqueKey = this.buildUniqueKey(filename, folder);

    const sanitizedMeta = this.sanitizeMetadataForS3(metadata);
    const s3Metadata: Record<string, string> = {
      'sha256-checksum': checksumSha256,
      'uploaded-at': new Date().toISOString(),
      'project': 'METRO2_HCM',
      ...sanitizedMeta,
    };

    if (config.storage.type === 'r2' || config.storage.type === 's3') {
      const client = this.getS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: config.storage.s3.bucket,
          Key: uniqueKey,
          Body: buffer,
          ContentType: mimeType,
          Metadata: s3Metadata,
        })
      );

      const publicBaseUrl = config.storage.s3.publicUrl?.replace(/\/$/, '') || 
        `${config.storage.s3.endpoint?.replace(/\/$/, '')}/${config.storage.s3.bucket}`;
      const url = `${publicBaseUrl}/${uniqueKey}`;

      return {
        url,
        key: uniqueKey,
        checksumSha256,
        sizeBytes,
        mimeType,
      };
    } else {
      // Local fallback
      const targetPath = path.resolve(config.storage.localUploadDir, uniqueKey);
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.writeFileSync(targetPath, buffer);

      return {
        url: `/uploads/${uniqueKey}`,
        key: uniqueKey,
        checksumSha256,
        sizeBytes,
        mimeType,
      };
    }
  }

  /**
   * Tải chuỗi DataURL / Base64 trực tiếp lên Cloudflare R2
   */
  public static async uploadBase64(
    base64String: string,
    filenamePrefix: string = 'photo',
    folder: string = 'surveys',
    metadata?: Record<string, any>
  ): Promise<UploadResult> {
    let mimeType = 'image/jpeg';
    let base64Data = base64String;

    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
    }

    const buffer = Buffer.from(base64Data, 'base64');
    let ext = '.jpg';
    if (mimeType.includes('png')) ext = '.png';
    else if (mimeType.includes('webp')) ext = '.webp';

    return this.uploadBuffer(buffer, `${filenamePrefix}${ext}`, mimeType, folder, metadata);
  }

  /**
   * Tạo Presigned URL để Client PWA tải trực tiếp file nhị phân (Blob/Binary) lên Cloudflare R2
   * Giảm tải 100% RAM và băng thông cho Backend Render, chống timeout và chống OOM crash
   */
  public static async generatePresignedUploadUrl(
    filename: string,
    mimeType: string = 'image/jpeg',
    folder: string = 'surveys',
    metadata?: Record<string, any>
  ): Promise<PresignedUploadResult> {
    const uniqueKey = this.buildUniqueKey(filename, folder);
    const expiresInSeconds = 900; // 15 phút

    const sanitizedMeta = this.sanitizeMetadataForS3(metadata);
    const s3Metadata: Record<string, string> = {
      'uploaded-at': new Date().toISOString(),
      'project': 'METRO2_HCM',
      ...sanitizedMeta,
    };

    const headers: Record<string, string> = {
      'Content-Type': mimeType,
    };
    for (const [k, v] of Object.entries(s3Metadata)) {
      headers[`x-amz-meta-${k}`] = v;
    }

    if (config.storage.type === 'r2' || config.storage.type === 's3') {
      const client = this.getS3Client();
      const command = new PutObjectCommand({
        Bucket: config.storage.s3.bucket,
        Key: uniqueKey,
        ContentType: mimeType,
        Metadata: s3Metadata,
      });

      const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });

      const publicBaseUrl = config.storage.s3.publicUrl?.replace(/\/$/, '') ||
        `${config.storage.s3.endpoint?.replace(/\/$/, '')}/${config.storage.s3.bucket}`;
      const publicUrl = `${publicBaseUrl}/${uniqueKey}`;

      return {
        uploadUrl,
        publicUrl,
        key: uniqueKey,
        method: 'PUT',
        headers,
        expiresInSeconds,
      };
    } else {
      // Local development fallback: Trả về endpoint PUT cục bộ tương thích hoàn toàn
      const uploadUrl = `${config.apiPrefix}/storage/local-put?key=${encodeURIComponent(uniqueKey)}&mimeType=${encodeURIComponent(mimeType)}`;
      const publicUrl = `/uploads/${uniqueKey}`;

      return {
        uploadUrl,
        publicUrl,
        key: uniqueKey,
        method: 'PUT',
        headers,
        expiresInSeconds,
      };
    }
  }

  /**
   * Lưu buffer nhị phân từ local PUT endpoint (khi chạy ở môi trường DEV local)
   */
  public static async saveLocalBuffer(
    buffer: Buffer,
    uniqueKey: string,
    mimeType: string
  ): Promise<UploadResult> {
    const checksumSha256 = this.calculateSha256(buffer);
    const sizeBytes = buffer.length;
    const targetPath = path.resolve(config.storage.localUploadDir, uniqueKey);
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(targetPath, buffer);

    return {
      url: `/uploads/${uniqueKey}`,
      key: uniqueKey,
      checksumSha256,
      sizeBytes,
      mimeType,
    };
  }
}

