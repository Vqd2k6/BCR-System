/**
 * Smoke test module Progress Report trên CSDL thật (CHỈ ĐỌC).
 * Chạy: cd backend && npx ts-node src/scripts/progress_report_smoke.ts [ZONE_ID] [OUT_DIR]
 * Xuất 3 file .xlsx (TODAY / DATE_RANGE / ALL_TIME) + in thống kê tổng hợp.
 */
import fs from 'fs';
import path from 'path';
import { ProgressReportService } from '../modules/progress-report';
import { pool } from '../database/db';
import type { ProgressFilter, TimeMode } from '../modules/progress-report/progress-report.types';

async function main(): Promise<void> {
  const zoneId = (process.argv[2] || 'ZONE_09').toUpperCase();
  const outDir = process.argv[3] || path.resolve(process.cwd(), 'tmp_progress_report');
  fs.mkdirSync(outDir, { recursive: true });
  const service = new ProgressReportService();

  const modes: Array<{ timeMode: TimeMode; fromDate?: string; toDate?: string }> = [
    { timeMode: 'ALL_TIME' },
    { timeMode: 'TODAY' },
    { timeMode: 'DATE_RANGE', fromDate: '2026-10-01', toDate: '2026-10-28' },
  ];

  for (const m of modes) {
    const filter: ProgressFilter = { zoneId, templateId: 'daily-progress-station', ...m };
    const t0 = Date.now();
    const preview = await service.preview(filter, 3);
    const { file, filename, rowCount } = await service.export(filter, 'xlsx');
    const outPath = path.join(outDir, `${filename}.${file.extension}`);
    fs.writeFileSync(outPath, file.buffer);
    console.log(`\n=== ${m.timeMode} (${Date.now() - t0} ms) ===`);
    console.log('Title :', preview.title);
    console.log('Period:', preview.periodLabel, '| rows:', rowCount, '| config v:', preview.configVersion);
    console.table([...preview.summary.groups, preview.summary.total]);
    console.log('File  :', outPath, `${file.buffer.length} bytes`);
  }
}

main()
  .catch((err: unknown) => {
    console.error('[ProgressReportSmoke] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
