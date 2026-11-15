/**
 * Kiểm độ phủ ảnh của template nhà dân v2 (chốt 15/11/2026: in đủ ảnh hiện trường).
 * Với từng hồ sơ: dựng HTML v2 nháp rồi kiểm
 *  1. mọi tầng của Phụ lục 2 (ViewModel) có mục A2.x;
 *  2. mọi ảnh bối cảnh / cận cảnh (gồm cận cảnh 3+) của từng D có trong HTML;
 *  3. mọi ảnh đối chứng Z / E có trong HTML (PL2 hoặc PL3) và không in lặp trong cùng tầng;
 *  4. ảnh nào chưa dập được dấu đều nằm trong danh sách lỗi watermark (bị chặn xuất PDF, không lọt).
 * Chạy: npx ts-node --transpile-only src/scripts/test_report_v2_photo_coverage.ts [reportId...]
 */
import 'dotenv/config';
import Handlebars from 'handlebars';
import { ReportService } from '../modules/report/services/report.service';
import { walkViewModelPhotos } from '../modules/photo-qc/photo-qc.vm-walker';
import type { DefectPairPhotoItem } from '../modules/report/report.types';

const DEFAULT_IDS = [
  'c0f4e305-b231-4b8d-a560-f1d1ede4af56', // C&C-05-B-0001
  '220275b9-0107-4547-95dd-1396f7c4240b',
  '2e7c0d2f-b0e7-4526-a84c-eace4709f7c1', // D có 20 ảnh cận cảnh, hồ sơ nhiều ảnh nhất
  '3f945b15-84d3-4051-bec2-8358a3cca631', // có tầng miễn Vùng Z
];

function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Template in {{src}} nên chuỗi trong HTML là bản đã escape (VD dấu = thành &#x3D;). */
const esc = (s: string): string => Handlebars.escapeExpression(s);

function count(haystack: string, needle: string): number {
  let n = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + needle.length)) n++;
  return n;
}

function pairSources(pair: DefectPairPhotoItem): Array<{ label: string; url: string; src: string }> {
  const list: Array<{ label: string; url?: string; src?: string }> = [
    { label: 'CTX', url: pair.contextPhotoUrl, src: pair.contextPhotoBase64 || pair.contextPhotoUrl },
    { label: 'CU1', url: pair.closeUpPhotoUrl, src: pair.closeUpPhotoBase64 || pair.closeUpPhotoUrl },
  ];
  if (pair.hasExtraCloseUp) list.push({ label: 'CU2', url: pair.extraCloseUpPhotoUrl, src: pair.extraCloseUpPhotoBase64 || pair.extraCloseUpPhotoUrl });
  (pair.additionalCloseUps || []).forEach((e, i) => list.push({ label: `CU${i + 3}+`, url: e.url, src: e.base64 || e.url }));
  return list.filter((x): x is { label: string; url: string; src: string } => Boolean(x.url && x.src));
}

async function checkReport(id: string): Promise<boolean> {
  const failures: string[] = [];
  const started = Date.now();
  const resolved = await ReportService.resolve(id);
  const rendered = await ReportService.renderDraftHtml(resolved, undefined, false, true, undefined, 'residential_v2');
  const { html, viewModel, watermark } = rendered;
  if (rendered.templateKey !== 'residential_v2') {
    out(`  ⚠️ ${id}: hồ sơ không dùng được v2 (template ${rendered.templateKey}), bỏ qua`);
    return true;
  }

  let defectPhotos = 0;
  let extraCandidates = 0;
  let overviewPhotos = 0;
  viewModel.appendix2.forEach((f, i) => {
    if (!html.includes(`data-section="pl-2-${i}"`)) failures.push(`Tầng ${f.floorName.vi}: thiếu mục A2.${i + 1}`);
    const floorUrls = new Set<string>();
    for (const pair of f.defectPairPhotos) {
      const candidates = pair.additionalCloseUpCandidates || [];
      extraCandidates += candidates.length;
      const promoted = new Set((pair.additionalCloseUps || []).map((e) => e.url));
      for (const c of candidates) {
        if (!promoted.has(c.url)) failures.push(`${pair.defectId}: ảnh cận cảnh bổ sung chưa được nạp ${c.url}`);
      }
      for (const p of pairSources(pair)) {
        defectPhotos++;
        floorUrls.add(p.url.trim());
        if (!html.includes(esc(p.src))) failures.push(`${f.floorName.vi} ${pair.defectId} ${p.label}: ảnh không có trong HTML (${p.url})`);
      }
    }
    for (const page of [...(f.overviewPages || []), ...(f.elementOverviewPages || [])]) {
      for (const ph of page.photos) {
        const raw = ph.base64 || ph.url;
        if (!raw) continue;
        const src = esc(raw);
        overviewPhotos++;
        if (!html.includes(src)) failures.push(`${f.floorName.vi} ${ph.zoneCode}: ảnh đối chứng không có trong HTML (${ph.url})`);
        else if (!floorUrls.has(ph.url.trim()) && count(html, src) > 1) {
          // Cùng một ảnh có thể là ảnh bối cảnh của D ở tầng khác; chỉ báo khi lặp trong PL3 của chính tầng.
          const pl3 = html.slice(html.indexOf('data-section="pl-3"'));
          if (html.includes('data-section="pl-3"') && count(pl3, src) > 1) failures.push(`${f.floorName.vi} ${ph.zoneCode}: ảnh đối chứng in lặp ở PL3`);
        }
      }
    }
  });

  // Ảnh chưa dập dấu phải nằm trong danh sách lỗi (PDF bị chặn), không được lọt ra file.
  const issueUrls = new Set(watermark.issues.map((i) => i.url));
  const unstamped = walkViewModelPhotos(viewModel).filter((r) => !r.isWatermarked() && !issueUrls.has(r.url));
  for (const r of unstamped) failures.push(`Ảnh chưa dập dấu mà không bị chặn: ${r.label} (${r.url})`);

  const mb = (html.length / (1024 * 1024)).toFixed(1);
  out(
    `  ${failures.length === 0 ? '✅' : '❌'} ${viewModel.metadata.buildingId} (${id.slice(0, 8)}): ${viewModel.appendix2.length} tầng, ` +
    `${defectPhotos} ảnh khuyết tật (${extraCandidates} ảnh cận cảnh 3+), ${overviewPhotos} ảnh đối chứng, ` +
    `${watermark.issues.length} lỗi watermark, HTML ${mb} MB, ${((Date.now() - started) / 1000).toFixed(1)} s`
  );
  failures.slice(0, 15).forEach((f) => out(`     - ${f}`));
  if (failures.length > 15) out(`     … và ${failures.length - 15} lỗi khác`);
  return failures.length === 0;
}

(async () => {
  const ids = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_IDS;
  out('🧪 Độ phủ ảnh template nhà dân v2');
  let ok = true;
  for (const id of ids) {
    try {
      if (!(await checkReport(id))) ok = false;
    } catch (err) {
      ok = false;
      console.error(`[test_report_v2_photo_coverage] Lỗi dựng hồ sơ ${id}`, err);
      out(`  ❌ ${id}: lỗi dựng report (xem log)`);
    }
  }
  out(ok ? 'PASSED' : 'FAILED');
  process.exit(ok ? 0 : 1);
})();
