import type { ProgressRenderer } from './renderer.types';
import { ExcelProgressRenderer } from './excel.renderer';

/** Renderer Registry – thêm định dạng mới bằng 1 dòng. */
const RENDERERS: ProgressRenderer[] = [new ExcelProgressRenderer()];

export function getRenderer(format: string): ProgressRenderer | undefined {
  return RENDERERS.find((r) => r.format === format);
}

