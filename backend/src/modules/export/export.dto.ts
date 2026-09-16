import { z } from 'zod';

export const CreateBatchExportDto = z.object({
  exportScope: z.enum(['SELECTED_LIST', 'FILTER_CRITERIA', 'GLOBAL_ALL_ZONES']).default('FILTER_CRITERIA'),
  zoneId: z.string().optional().nullable(),
  selectedReportIds: z.array(z.string().uuid()).optional(),
  filterCriteria: z.object({
    periodType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.string().optional(),
    viClass: z.string().optional(),
  }).optional(),
  exportFormat: z.enum(['PDF_BOOK_COMPILATION', 'ZIP_INDIVIDUAL_PDFS', 'EXCEL_SUMMARY']).default('PDF_BOOK_COMPILATION'),
  includeGisOverviewMap: z.boolean().default(true),
  includeEcsSummaryTable: z.boolean().default(true),
});
