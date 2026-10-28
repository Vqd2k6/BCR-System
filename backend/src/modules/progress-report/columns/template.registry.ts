import type { ProgressTemplate } from './column.types';
import { DAILY_PROGRESS_STATION_TEMPLATE } from './templates/daily-progress-station.template';

/**
 * Template Registry – đăng ký template mới bằng 1 dòng.
 */
const TEMPLATES: ProgressTemplate[] = [DAILY_PROGRESS_STATION_TEMPLATE];

export const DEFAULT_TEMPLATE_ID = DAILY_PROGRESS_STATION_TEMPLATE.id;

export function getTemplate(id: string | undefined): ProgressTemplate | undefined {
  return TEMPLATES.find((t) => t.id === (id || DEFAULT_TEMPLATE_ID));
}

export function listTemplates(): Array<{ id: string; name: string }> {
  return TEMPLATES.map((t) => ({ id: t.id, name: t.name }));
}

