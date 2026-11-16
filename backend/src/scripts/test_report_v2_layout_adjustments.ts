/**
 * Kiểm các chỉnh sửa template nhà dân v2 (16/11/2026):
 *  A. Đơn vị: packPhotoBlocks (khối 1 dọc + 2 ngang, cặp ảnh), splitStructureSystem (Mục IV).
 *  B. Hồ sơ thật (HTML v2 nháp): Mục IV có Dạng chịu lực; Mục V không tự sinh câu khi "Không", có "--" và Độ tin cậy;
 *     VI/VII không in đậm tiêu đề dòng; STT PL2 liên tục giữa các tầng và mọi No.xxx ở VIII–IX có trong bảng PL2.
 * Chỉ đọc DB. Chạy: npx ts-node --transpile-only src/scripts/test_report_v2_layout_adjustments.ts [reportId...]
 */
import 'dotenv/config';
import { Database } from '../database/db';
import { ReportService } from '../modules/report/services/report.service';
import { packPhotoBlocks, type V2Photo } from '../modules/report/mappers/v2/residential-v2.presenter';
import { splitStructureSystem } from '../modules/report/mappers/sections/section-3-4-structural.mapper';

let failed = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (!ok) failed++;
  process.stdout.write(`  ${ok ? '✅' : '❌'} ${label}${!ok && detail ? ` → ${detail}` : ''}\n`);
}

function photo(n: number, isPortrait: boolean): V2Photo {
  return { figNo: String(n), src: `s${n}`, caption: { vi: '', en: '' }, pin: null, isPortrait, photoCode: null };
}

function shape(flags: boolean[]): string {
  return packPhotoBlocks(flags.map((p, i) => photo(i + 1, p)))
    .map((b) => (b.kind === 'trio'
      ? `trio${b.mainLeft ? 'L' : 'R'}(${b.main.figNo}|${b.side.map((s) => s.figNo).join(',')})`
      : `pair${b.hasPortrait ? 'P' : 'L'}(${b.photos.map((p) => p.figNo).join(',')})`))
    .join(' ');
}

function unitTests(): void {
  process.stdout.write('A. Đơn vị\n');
  const D = true;
  const N = false;
  check('[D,N,N] → trio dọc trái', shape([D, N, N]) === 'trioL(1|2,3)', shape([D, N, N]));
  check('[N,N,D] → trio dọc phải, đọc theo cột giữ thứ tự hình', shape([N, N, D]) === 'trioR(3|1,2)', shape([N, N, D]));
  check('[N,D,N] → không trio (không đảo thứ tự)', shape([N, D, N]) === 'pairP(1,2) pairL(3)', shape([N, D, N]));
  check('6 ảnh ngang → 3 hàng ngang', shape([N, N, N, N, N, N]) === 'pairL(1,2) pairL(3,4) pairL(5,6)', shape([N, N, N, N, N, N]));
  check('[D,D] → 1 hàng dọc', shape([D, D]) === 'pairP(1,2)', shape([D, D]));
  check('[D,N,N,N,N] → trio + hàng ngang', shape([D, N, N, N, N]) === 'trioL(1|2,3) pairL(4,5)', shape([D, N, N, N, N]));
  check('rỗng → không khối', shape([]) === '', shape([]));

  const rc = splitStructureSystem('RC - BTCT (Khung bê tông cốt thép toàn khối)', false);
  check('RC → BTCT + Khung chịu lực', rc.material?.vi === 'BTCT' && rc.form?.vi === 'Khung chịu lực', JSON.stringify(rc));
  const mixed = splitStructureSystem('Mixed - Kết cấu hỗn hợp', false);
  check('Mixed → Hỗn hợp / Kết cấu hỗn hợp (không suy Khung + tường)', mixed.material?.vi === 'Hỗn hợp' && mixed.form?.vi === 'Kết cấu hỗn hợp', JSON.stringify(mixed));
  const masonry = splitStructureSystem('Masonry - Tường gạch chịu lực', false);
  check('Masonry → Gạch / Tường chịu lực', masonry.material?.vi === 'Gạch' && masonry.form?.vi === 'Tường chịu lực', JSON.stringify(masonry));
  const other = splitStructureSystem('Khác: Khung thép mái tôn', false);
  check('Khác: <mô tả> → in nguyên mô tả, dạng chịu lực trống', other.material?.vi === 'Khung thép mái tôn' && other.form === null, JSON.stringify(other));
  const otherEmpty = splitStructureSystem('Other - Khác (Nhập chi tiết...)', false);
  check('Khác chưa mô tả → cả 2 ô trống', otherEmpty.material === null && otherEmpty.form === null, JSON.stringify(otherEmpty));
  const empty = splitStructureSystem('', false);
  check('Trống → cả 2 ô trống (không bịa)', empty.material === null && empty.form === null, JSON.stringify(empty));
  const vacant = splitStructureSystem('RC - BTCT', true);
  check('Đất trống → không suy dạng chịu lực', vacant.form === null && Boolean(vacant.material?.vi.includes('đất trống')), JSON.stringify(vacant));
}

function sliceSection(html: string, key: string): string {
  // Tới mục cùng cấp kế tiếp; mục con (sec-8-1, pl-2-0…) thuộc về mục cha.
  const start = html.indexOf(`data-section="${key}"`);
  if (start < 0) return '';
  const re = /data-section="([a-z0-9-]+)"/g;
  re.lastIndex = start + 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (!m[1].startsWith(`${key}-`)) return html.slice(start, m.index);
  }
  return html.slice(start);
}

async function checkReport(id: string): Promise<void> {
  const resolved = await ReportService.resolve(id);
  const rendered = await ReportService.renderDraftHtml(resolved, undefined, false, true, undefined, 'residential_v2');
  if (rendered.templateKey !== 'residential_v2') {
    process.stdout.write(`  ⚠️ ${id}: không dùng được v2 (${rendered.templateKey}), bỏ qua\n`);
    return;
  }
  const { html, viewModel } = rendered;
  process.stdout.write(`B. ${viewModel.metadata.buildingId} (${id.slice(0, 8)})\n`);

  const sec4 = sliceSection(html, 'sec-4');
  check('Mục IV có ô Dạng chịu lực', sec4.includes('Dạng chịu lực') && sec4.includes('Structural form'));

  const sec5 = sliceSection(html, 'sec-5');
  check('Mục V có ô Độ tin cậy', sec5.includes('Độ tin cậy') && sec5.includes('Reliability'));
  check('Mục V không còn câu tự sinh khi "Không"',
    !sec5.includes('Không phát hiện lún chênh') && !/Theo phỏng vấn chủ hộ \(Mục III\): Không\b/.test(sec5) && !sec5.includes('Không ghi nhận khuyết tật trên cấu kiện chịu lực'));
  check('Mục V: ô trống in "--" (không phải "---")', sec5.includes('>--<'));

  const sec67 = sliceSection(html, 'sec-6') + sliceSection(html, 'sec-7');
  check('Mục VI, VII không in đậm tiêu đề dòng', !/<tr><td><b>/.test(sec67) && !/<td class="num">\d<\/td><td><b>/.test(sec67));

  check('Bảng VI, VII rộng hết trang (không còn width 75%)', !sec67.includes('width: 75%'));
  const sec82 = sliceSection(html, 'sec-8-2');
  check('VIII.2: tiêu đề + ma trận nằm trong khối không tách trang', /<div class="v2-keep">\s*<h3[^>]*>2\. Đánh giá theo ma trận/.test(sec82) && sec82.includes('v2-matrix-table'));
  const grade = (html.match(/<table class="v2-table v2-grade-box">([\s\S]*?)<\/table>/) || ['', ''])[1];
  check('VIII.4: ô cấp rủi ro 1 hàng × 2 ô', (grade.match(/<tr>/g) || []).length === 1 && (grade.match(/<td /g) || []).length === 2, grade.slice(0, 200));

  const pl2 = sliceSection(html, 'pl-2');
  check('PL2: tầng đầu gắn is-first-floor', /class="v2-floor is-first-floor[^"]*" data-section="pl-2-0"/.test(pl2));
  const noDefectFloors = viewModel.appendix2.filter((f) => f.defectSummaryRows.length === 0).length;
  check(`PL2: ${noDefectFloors} tầng không khuyết tật gắn has-no-defects`, (pl2.match(/class="v2-floor[^"]*has-no-defects/g) || []).length === noDefectFloors);
  check('PL2: lời thông báo tầng không khuyết tật in đậm', noDefectFloors === 0 || /<p class="v2-text"><b>[^<]+<\/b><\/p><p class="v2-text en"><b><i>/.test(pl2));
  const pairs = (pl2.match(/class="v2-cad-pair"/g) || []).length;
  const floors = (pl2.match(/class="v2-floor[ "]/g) || []).length;
  check("PL2: khối CAD cạnh nhau luôn đủ 2 sơ đồ", pairs === 0 || (pl2.match(/class="v2-cad-col"/g) || []).length === pairs * 2);
  process.stdout.write(`  ℹ️ CAD: ${pairs} tầng 2 sơ đồ dọc đặt cạnh nhau / ${floors} tầng\n`);
  const stt = Array.from(pl2.matchAll(/<tr>\s*<td class="num">(\d{3})<\/td>/g)).map((m) => m[1]);
  const total = viewModel.appendix2.reduce((s, f) => s + f.defectSummaryRows.length, 0);
  const expected = Array.from({ length: total }, (_, i) => String(i + 1).padStart(3, '0'));
  check(`STT PL2 liên tục 001…${String(total).padStart(3, '0')} giữa các tầng`, stt.join(',') === expected.join(','), `${stt.slice(0, 8).join(',')}… (${stt.length}/${total})`);

  const sec89 = sliceSection(html, 'sec-8') + sliceSection(html, 'sec-9');
  const cited = Array.from(new Set(Array.from(sec89.matchAll(/No\.(\d{3})/g)).map((m) => m[1])));
  const unknown = cited.filter((n) => !expected.includes(n));
  check(`Mọi No.xxx ở VIII–IX có trong bảng PL2 (${cited.length} số được trích)`, unknown.length === 0, unknown.join(','));
  check('VIII–IX không còn trích mã D', !/\bD-\d{2}\b/.test(sec89), (sec89.match(/D-\d{2}/g) || []).slice(0, 5).join(','));

  const trios = (html.match(/v2-photo-trio/g) || []).length;
  const portraitRows = (html.match(/is-portrait-row/g) || []).length;
  const landscapeRows = (html.match(/is-landscape-row/g) || []).length;
  process.stdout.write(`  ℹ️ khối ảnh: ${trios} trio, ${portraitRows} hàng có ảnh dọc, ${landscapeRows} hàng toàn ảnh ngang\n`);
}

async function findReportIdByParcel(code: string): Promise<string | null> {
  const res = await Database.query<{ id: string }>(
    `SELECT r.id FROM base_survey_reports r JOIN parcels p ON p.id = r.parcel_id
     WHERE r.deleted_at IS NULL AND r.phase = 'PHASE_1' AND r.unit_id IS NULL AND p.project_parcel_code = $1
     ORDER BY r.updated_at DESC NULLS LAST LIMIT 1;`,
    [code]
  );
  return res.rows[0]?.id ?? null;
}

async function reliabilityStats(): Promise<void> {
  const res = await Database.query<{ value: string | null; n: string }>(
    `SELECT COALESCE(r.survey_data_json#>>'{settlementTilt,reliability}', d.measurement_reliability::text) AS value, count(*)::text AS n
     FROM base_survey_reports r LEFT JOIN deformation_assessments d ON d.report_id = r.id
     WHERE r.deleted_at IS NULL AND r.phase = 'PHASE_1' AND r.unit_id IS NULL
     GROUP BY 1 ORDER BY 2 DESC;`
  );
  process.stdout.write(`C. Độ tin cậy đã lưu (hồ sơ nhà dân): ${res.rows.map((r) => `${r.value ?? 'trống'} = ${r.n}`).join(', ')}\n`);
}

(async () => {
  unitTests();
  try {
    const args = process.argv.slice(2);
    const ids = args.length > 0 ? args : [await findReportIdByParcel('C&C-05-B-0004'), '3f945b15-84d3-4051-bec2-8358a3cca631'].filter((x): x is string => Boolean(x));
    for (const id of ids) await checkReport(id);
    await reliabilityStats();
  } catch (err) {
    failed++;
    console.error('[test_report_v2_layout_adjustments] Lỗi dựng hồ sơ thật', err);
  }
  process.stdout.write(failed === 0 ? 'PASSED\n' : `FAILED (${failed})\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
