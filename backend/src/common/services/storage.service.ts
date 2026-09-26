import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

export class StorageService {
  private static s3Client: S3Client | null = null;

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
   * Tải Buffer (file nhị phân) lên Cloudflare R2 hoặc Local storage
   */
  public static async uploadBuffer(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    folder: string = 'surveys'
  ): Promise<UploadResult> {
    const checksumSha256 = this.calculateSha256(buffer);
    const sizeBytes = buffer.length;
    const ext = path.extname(filename) || '.jpg';
    const cleanBasename = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueKey = `${folder}/${Date.now()}_${cleanBasename}_${crypto.randomUUID().slice(0, 8)}${ext}`;

    if (config.storage.type === 'r2' || config.storage.type === 's3') {
      const client = this.getS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: config.storage.s3.bucket,
          Key: uniqueKey,
          Body: buffer,
          ContentType: mimeType,
          Metadata: {
            'sha256-checksum': checksumSha256,
            'uploaded-at': new Date().toISOString(),
          },
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
      const targetDir = path.resolve(config.storage.localUploadDir, folder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, path.basename(uniqueKey));
      fs.writeFileSync(filePath, buffer);

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
    folder: string = 'surveys'
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

    return this.uploadBuffer(buffer, `${filenamePrefix}${ext}`, mimeType, folder);
  }
}
