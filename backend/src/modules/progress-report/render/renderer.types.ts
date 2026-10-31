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

/** Một sheet của file xuất: 1 zone = 1 sheet, toàn tuyến = mỗi zone 1 sheet độc lập. */
export interface RenderSheet {
  name: string;
  table: ResolvedTable;
}

export interface ProgressRenderer {
  readonly format: string;
  render(sheets: RenderSheet[]): Promise<RenderedFile>;
}

