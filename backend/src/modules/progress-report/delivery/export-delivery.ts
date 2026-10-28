import type { Response } from 'express';
import type { RenderedFile } from '../render/renderer.types';

/**
 * ExportDelivery – tách cách giao file khỏi engine.
 * Hiện tại: StreamDelivery (tải trực tiếp). Sau này: QueueDelivery / S3Delivery cài cùng interface.
 */
export interface ExportDelivery {
  deliver(res: Response, file: RenderedFile, filename: string): Promise<void>;
}

function asciiFallback(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\w.-]+/g, '_');
}

export class StreamDelivery implements ExportDelivery {
  async deliver(res: Response, file: RenderedFile, filename: string): Promise<void> {
    const fullName = `${filename}.${file.extension}`;
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.buffer.length));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFallback(fullName)}"; filename*=UTF-8''${encodeURIComponent(fullName)}`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.status(200).end(file.buffer);
  }
}

