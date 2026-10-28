import type { RawProgressRow, SurveyProgressCode } from '../progress-report.types';
import { isInaccessible } from './condition.classifier';

/**
 * Cột AA – "Trạng thái KS". Để trống (null) khi "Không tiếp cận được" hoặc chưa khảo sát (giống file mẫu).
 */
export function mapSurveyProgress(row: RawProgressRow): SurveyProgressCode | null {
  if (isInaccessible(row)) return null;
  const status = (row.reportStatus ?? '').toUpperCase();
  if (status === 'APPROVED') return row.hasRelease ? 'REPORT_SIGNED' : 'REPORT_DONE';
  if (status === 'SUBMITTED' || status === 'UNDER_REVIEW') return 'SURVEY_DONE_REPORTING';
  if (status === 'DRAFT' || status === 'REJECTED') return 'IN_PROGRESS';

  const entityStatus = (row.kind === 'CONDO_UNIT' ? row.unitStatus : row.parcelSurveyStatus) ?? '';
  if (entityStatus === 'IN_PROGRESS' || entityStatus === 'ASSIGNED_TO_ME') return 'IN_PROGRESS';
  if (entityStatus === 'SUBMITTED') return 'SURVEY_DONE_REPORTING';
  if (entityStatus === 'APPROVED' || entityStatus === 'COMPLETED') return 'REPORT_DONE';
  return null;
}
