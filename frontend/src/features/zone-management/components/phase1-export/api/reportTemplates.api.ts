import { api } from '../../../../../services/api';
import type { ReportTemplateCatalog } from '../types';

/** Danh mục template report nhà dân (chỉ Zone Admin / Super Admin gọi được). */
export const fetchReportTemplates = async (): Promise<ReportTemplateCatalog> => {
  const res = await api.get('/report-templates');
  return res.data.data as ReportTemplateCatalog;
};
