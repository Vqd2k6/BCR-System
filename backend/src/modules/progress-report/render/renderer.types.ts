import type { ResolvedTable } from '../columns/column.types';

/**
 * Interface Renderer – lớp 3 của kiến trúc plugin.
 * Thêm định dạng mới (PDF/CSV) = cài đặt interface này + đăng ký trong renderer.registry.
 */
export interface RenderedFile {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

export interface ProgressRenderer {
  readonly format: string;
  render(table: ResolvedTable): Promise<RenderedFile>;
}

