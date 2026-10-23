import * as fs from 'fs';
import * as path from 'path';
import { pool, Database } from '../database/db';
import { ReportService } from '../modules/report/report-v3.service';
import { ReportReleaseService } from '../modules/report/report-release.service';
import { ReportSnapshotService, sha256Hex } from '../modules/report/report-snapshot.service';
import { ReportConfigService } from '../modules/report_config/report-config.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

async function extractTextFromPdf(buffer: Buffer): Promise<string[]> {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  }).promise;
  const pagesText: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pagesText.push(content.items.map((it: any) => it.str).join(' '));
  }
  return pagesText;
}

async function run() {
  console.log('================================================================');
  console.log('🧪 TESTING WATERMARK TOGGLE (HTML & PDF EXPORT)');
  console.log('================================================================\n');

  const reportId = '73ce904b-8c9b-45c6-a07e-091aaa55354a'; // C&C-05-B-0050
  const resolved = await ReportService.resolve(reportId);
  console.log(`Resolved report: ${resolved.id}, status: ${resolved.status}`);

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passCount++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      failCount++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: HTML Render with enableWatermark = false
  // -------------------------------------------------------------
  console.log('\n--- Test 1: HTML Render with enableWatermark = false ---');
  const { html: htmlNoWm, viewModel: vmNoWm } = await ReportService.renderDraftHtml(
    resolved,
    undefined,
    false,
    false
  );

  const domNoWm = htmlNoWm.replace(/<style[\s\S]*?<\/style>/gi, '');

  assert(
    htmlNoWm.includes('class="no-watermark"'),
    'HTML body has class "no-watermark" when enableWatermark is false'
  );
  assert(
    !domNoWm.includes('watermark-logo-top-right'),
    'HTML DOM does NOT contain watermark logo elements when enableWatermark is false'
  );
  assert(
    !domNoWm.includes('watermark-text-bottom-right'),
    'HTML DOM does NOT contain watermark text elements when enableWatermark is false'
  );
  assert(
    vmNoWm.metadata.coverAlreadyWatermarked !== true,
    'ViewModel coverAlreadyWatermarked is false/undefined when enableWatermark is false'
  );

  // -------------------------------------------------------------
  // TEST 2: HTML Render with enableWatermark = true
  // -------------------------------------------------------------
  console.log('\n--- Test 2: HTML Render with enableWatermark = true ---');
  const { html: htmlWithWm, viewModel: vmWithWm } = await ReportService.renderDraftHtml(
    resolved,
    undefined,
    false,
    true
  );

  assert(
    !htmlWithWm.includes('class="no-watermark"'),
    'HTML body does NOT have class "no-watermark" when enableWatermark is true'
  );
  assert(
    vmWithWm.metadata.coverAlreadyWatermarked === true || htmlWithWm.includes('watermark-logo-top-right'),
    'ViewModel has canvas watermark OR HTML overlay watermark when enableWatermark is true'
  );

  // -------------------------------------------------------------
  // TEST 3: PDF Render with enableWatermark = false
  // -------------------------------------------------------------
  console.log('\n--- Test 3: PDF Render with enableWatermark = false ---');
  const { pdfBuffer: pdfNoWm } = await ReportService.renderDraftPdf(
    resolved,
    undefined,
    false
  );
  fs.writeFileSync(path.join(__dirname, '../../test_no_wm.pdf'), pdfNoWm);
  const textsNoWm = await extractTextFromPdf(pdfNoWm);
  console.log(`Rendered PDF without watermark: ${pdfNoWm.length} bytes, ${textsNoWm.length} pages`);

  // Ensure no watermark overlay text strings (like HCM_M2.[...) appear in text layer of Appendix 1/2
  const wmTextMatchesNoWm = textsNoWm.filter((t) => t.includes('HCM_M2.[') && t.includes('P02_MAIN'));
  assert(
    wmTextMatchesNoWm.length === 0,
    `PDF rendered without watermark contains 0 HTML watermark overlay strings (found ${wmTextMatchesNoWm.length})`
  );

  // -------------------------------------------------------------
  // TEST 4: PDF Render with enableWatermark = true
  // -------------------------------------------------------------
  console.log('\n--- Test 4: PDF Render with enableWatermark = true ---');
  const { pdfBuffer: pdfWithWm } = await ReportService.renderDraftPdf(
    resolved,
    undefined,
    true
  );
  fs.writeFileSync(path.join(__dirname, '../../test_with_wm.pdf'), pdfWithWm);
  const textsWithWm = await extractTextFromPdf(pdfWithWm);
  console.log(`Rendered PDF with watermark: ${pdfWithWm.length} bytes, ${textsWithWm.length} pages`);
  assert(pdfWithWm.length > 100000, 'PDF with watermark generated successfully');

  // -------------------------------------------------------------
  // TEST 5: Regenerate clean rev-00.pdf for release storage
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Regenerate clean rev-00.pdf ---');
  const snapRes = await ReportSnapshotService.getLatestApprovedSnapshot(resolved.id);
  if (snapRes && snapRes.snapshot) {
    const activeConfig = await ReportConfigService.getActiveConfig();
    const { pdfBuffer: finalPdf } = await ReportService.renderFinalPdf(
      resolved,
      snapRes.snapshot,
      0,
      activeConfig
    );
    const releaseDir = path.join(__dirname, '../../storage/report-releases', resolved.id);
    fs.mkdirSync(releaseDir, { recursive: true });
    const releasePath = path.join(releaseDir, 'rev-00.pdf');
    fs.writeFileSync(releasePath, finalPdf);
    const newSha = sha256Hex(finalPdf);

    await Database.query(
      `UPDATE report_releases
       SET file_size_bytes = $1, sha256 = $2
       WHERE report_id = $3 AND revision = 0;`,
      [finalPdf.length, newSha, resolved.id]
    );
    console.log(`Updated rev-00.pdf: ${finalPdf.length} bytes, SHA256: ${newSha}`);
    assert(fs.existsSync(releasePath), 'rev-00.pdf exists and is updated with clean canvas watermarks');
  }

  console.log('\n================================================================');
  console.log(`RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================');

  await pool.end();
  process.exit(failCount > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal error running watermark test:', err);
  process.exit(1);
});
