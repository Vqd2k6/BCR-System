/**
 * Render PDF qua pipeline THẬT (ReportService.renderDraftPdf: có header/footer, TOC 2-pass).
 * Dùng: npx ts-node src/scripts/render_real_pdf.ts <reportId> [...]
 */
import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../database/db';
import { ReportService } from '../modules/report/report-v3.service';

async function main() {
  const ids = process.argv.slice(2);
  const outDir = path.resolve(__dirname, '../../test_output/result');
  fs.mkdirSync(outDir, { recursive: true });
  for (const id of ids) {
    const resolved = await ReportService.resolve(id);
    const t0 = Date.now();
    const { pdfBuffer, buildingId } = await ReportService.renderDraftPdf(resolved, undefined, true);
    const out = path.join(outDir, `BCS_${buildingId}_Senior_PM_Standard.pdf`);
    fs.writeFileSync(out, pdfBuffer);
    console.log(`OK ${buildingId} -> ${out} (${(pdfBuffer.length / 1e6).toFixed(1)}MB, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  await pool.end();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
