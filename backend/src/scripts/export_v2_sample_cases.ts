/**
 * Xuất bộ case mẫu report nhà dân v2 để nghiệm thu bằng mắt trước khi lên prod (TASK_DANG_DO_6).
 * Mỗi case 1 PDF qua đúng pipeline thật (renderDraftPdf: watermark + đầu/chân trang Chrome + Mục lục 2 lượt),
 * kèm summary.md (chỉ số + checklist từng file). Chỉ đọc DB.
 *
 *   npx ts-node --transpile-only src/scripts/export_v2_sample_cases.ts --discover
 *   npx ts-node --transpile-only src/scripts/export_v2_sample_cases.ts [--cases=01,05] [--ids=05:<reportId>] [--out=<dir>]
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Database } from '../database/db';
import { ReportService, REPORT_PDF_HEADER_TITLE } from '../modules/report/services/report.service';
import { PdfRenderEngine } from '../modules/report/engine/pdf-render.engine';
import { resolveReportTemplateKind } from '../modules/report/services/report-template-kind';
import {
  analyzePdfPages,
  locateSectionPages,
  readTocPageNumbers,
  V2_PAGE_MARGINS_PT,
  type SectionHeading,
} from '../modules/report/engine/pdf-page-analysis';

interface Candidate {
  id: string;
  code: string;
  status: string;
  buildingType: string | null;
  floors: number;
  defects: number;
  floorsWithoutDefects: number;
  photos: number;
  structuralCadFloors: number;
  floorsWithoutCad: number;
  exemptZoneFloors: number;
  maxBurland: number;
  caseType: string;
  coverTextLength: number;
}

interface HtmlMetrics {
  trios: number;
  cadPairs: number;
  stackedDualFloors: number;
  singleCadFloors: number;
  pl1Photos: number;
  pl2Photos: number;
  pl3Photos: number;
}

interface CaseDef {
  key: string;
  title: string;
  /** Lọc + xếp ứng viên từ chỉ số SQL; trả về danh sách đã xếp. */
  pick: (all: Candidate[]) => Candidate[];
  /** Điều kiện trên HTML thật (hướng ảnh CAD chỉ biết sau khi nạp ảnh). */
  accept?: (m: HtmlMetrics) => boolean;
  checklist: string[];
}

interface CaseResult {
  def: CaseDef;
  candidate: Candidate | null;
  file: string | null;
  pages: number;
  sizeMb: number;
  seconds: number;
  tocOk: boolean;
  tocDetail: string;
  headerFooterOk: boolean;
  headerFooterDetail: string;
  sparsePages: string;
  sectionPages: Record<string, number>;
  metrics: HtmlMetrics | null;
  /** Cổng chặn đã bỏ qua khi xuất mẫu (rỗng = hồ sơ xuất được thật). */
  gates: string;
  skipped: string[];
}

const HEADINGS: SectionHeading[] = [
  { key: 'sec-1', text: 'I. THÔNG TIN CHUNG – GENERAL INFORMATION' },
  { key: 'sec-4', text: 'IV. ĐẶC ĐIỂM KẾT CẤU VÀ MÓNG – STRUCTURAL' },
  { key: 'sec-5', text: 'V. GHI NHẬN SƠ BỘ VỀ ĐỘ NGHIÊNG / LÚN' },
  { key: 'sec-6', text: 'VI. TÓM TẮT KẾT QUẢ KHẢO SÁT KHUYẾT TẬT' },
  { key: 'sec-7', text: 'VII. PHÂN LOẠI MỨC ĐỘ HƯ HẠI THEO BURLAND' },
  { key: 'sec-8', text: 'VIII. ĐÁNH GIÁ TÌNH TRẠNG CÔNG TRÌNH' },
  { key: 'sec-8-2', text: '2. Đánh giá theo ma trận rủi ro – Risk Matrix' },
  { key: 'sec-8-4', text: '4. Cấp độ rủi ro tổng thể – Overall Risk Grade' },
  { key: 'sec-9', text: 'IX. KẾT LUẬN VÀ KIẾN NGHỊ – CONCLUSION' },
  { key: 'pl-1', text: 'PHỤ LỤC 1: ẢNH MẶT ĐỨNG CÔNG TRÌNH' },
  { key: 'pl-2', text: 'PHỤ LỤC 2: THỐNG KÊ KHUYẾT TẬT THEO TẦNG' },
  { key: 'pl-3', text: 'PHỤ LỤC 3: HỒ SƠ ẢNH KHÔNG GIAN' },
];
/** Mục lục chỉ in các mục cấp 1 / mục con của VIII; mục không có trong Mục lục thì không so. */
const TOC_KEYS = new Set(['sec-1', 'sec-4', 'sec-5', 'sec-6', 'sec-7', 'sec-8', 'sec-8-2', 'sec-8-4', 'sec-9', 'pl-1', 'pl-2', 'pl-3']);
const SPARSE_FILL_PCT = 15;

const STATUS_RANK: Record<string, number> = { APPROVED: 0, UNDER_REVIEW: 1, SUBMITTED: 2, DRAFT: 3 };
const byStatus = (a: Candidate, b: Candidate): number => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
const normal = (c: Candidate): boolean => c.caseType === 'NORMAL';

const CASES: CaseDef[] = [
  {
    key: '01_baseline',
    title: 'Nhà dân điển hình 2–3 tầng, có tầng có khuyết tật và tầng sạch',
    pick: (all) => all
      .filter((c) => normal(c) && c.floors >= 2 && c.floors <= 3 && c.defects > 0 && c.floorsWithoutDefects > 0)
      .sort((a, b) => Number(b.code.endsWith('B-0001')) - Number(a.code.endsWith('B-0001')) || byStatus(a, b)),
    checklist: [
      'Bìa đúng 1 trang; ảnh bìa lấp phần trống, bảng ký nằm cuối trang.',
      'Mục IV (trang {sec-4}): có ô "Dạng chịu lực", khớp "Hệ kết cấu chính".',
      'Mục V (trang {sec-5}): dòng "Không" chỉ in "Không" và "--", có ô "Độ tin cậy".',
      'Mục VI/VII (trang {sec-6}): bảng rộng hết trang, tiêu đề dòng không in đậm.',
      'So bố cục tổng thể với mẫu source_templete/ST01-…_3.pdf.',
    ],
  },
  {
    key: '02_multi_storey',
    title: 'Nhà nhiều tầng (≥ 4)',
    pick: (all) => all.filter((c) => normal(c) && c.floors >= 4).sort((a, b) => b.floors - a.floors || byStatus(a, b)),
    checklist: [
      'Mục lục dài (A2.x, A3.x) khớp số trang thật.',
      'PL2 (trang {pl-2}): mỗi tầng bắt đầu trang mới; STT No.001… chạy liên tục qua các tầng, không quay lại 001.',
      'Mục VIII–IX trích "No.xxx" đúng số trong bảng PL2.',
      'Đầu/chân trang lặp đều mọi trang.',
    ],
  },
  {
    key: '03_photo_heavy',
    title: 'Nhà nhiều ảnh nhất',
    pick: (all) => all.filter(normal).sort((a, b) => b.photos - a.photos),
    checklist: [
      'PL2/PL3: trang toàn ảnh ngang có 6 ảnh (3 hàng × 2).',
      'Khối 1 ảnh dọc + 2 ảnh ngang xếp chồng; số hình tăng dần, không đảo thứ tự.',
      'Ghim D trên ảnh bối cảnh nhỏ như ghim Z/E, nhãn bo góc.',
      'Ghi nhận dung lượng và thời gian render ở bảng trên.',
    ],
  },
  {
    key: '04_zero_defects',
    title: 'Nhà không có khuyết tật',
    pick: (all) => all.filter((c) => normal(c) && c.defects === 0 && c.floors >= 2).sort((a, b) => b.photos - a.photos || byStatus(a, b)),
    checklist: [
      'Mục VI/VII (trang {sec-6}): mọi số lượng 0, tổng 0, không trống/NaN.',
      'Mục VIII (trang {sec-8}): ECS Tốt, ma trận viền đậm đúng ô, VIII.4 ô 2×1 hợp lý.',
      'PL2 (trang {pl-2}): mỗi tầng ghi "không ghi nhận khuyết tật", không có bảng rỗng.',
      'PL3 (trang {pl-3}): vẫn đủ ảnh Z/E.',
    ],
  },
  {
    key: '05_dual_cad_portrait',
    title: 'Có tầng với 2 sơ đồ CAD dọc (kiến trúc Z + kết cấu E) đặt cạnh nhau',
    pick: (all) => all.filter((c) => normal(c) && c.structuralCadFloors > 0)
      .sort((a, b) => Number(b.code.endsWith('B-0004')) - Number(a.code.endsWith('B-0004')) || b.structuralCadFloors - a.structuralCadFloors),
    accept: (m) => m.cadPairs > 0,
    checklist: [
      'Trang đầu PL2 (trang {pl-2}): có luôn A2.1 và sơ đồ ngay dưới phần giới thiệu, không có trang trống.',
      '2 sơ đồ cạnh nhau, tiêu đề 2 dòng (Việt / Anh) không xuống dòng lẻ.',
      'Ghim Z (xanh) và E (đỏ) đúng vị trí trên sơ đồ.',
      'Tầng sau: sơ đồ cạnh nhau, bảng tổng hợp lên chung trang nếu vừa.',
    ],
  },
  {
    key: '06_cad_stacked_or_single',
    title: 'Sơ đồ CAD xếp chồng (có ảnh ngang) hoặc chỉ 1 sơ đồ / tầng chưa có CAD / tầng miễn Z',
    pick: (all) => all.filter((c) => normal(c) && (c.floorsWithoutCad > 0 || c.exemptZoneFloors > 0 || c.structuralCadFloors < c.floors))
      .sort((a, b) => Number(b.id.startsWith('3f945b15')) - Number(a.id.startsWith('3f945b15')) || (b.exemptZoneFloors + b.floorsWithoutCad) - (a.exemptZoneFloors + a.floorsWithoutCad)),
    accept: (m) => m.stackedDualFloors + m.singleCadFloors > 0,
    checklist: [
      'PL2 (trang {pl-2}): sơ đồ đơn to (cao tới ~170 mm ở trang đầu, ~205 mm ở tầng sau), không tràn trang.',
      'Nếu có 2 sơ đồ xếp chồng: mỗi sơ đồ ~85 mm (trang đầu) / ~105 mm (tầng sau), cả 2 cùng 1 trang.',
      'Tầng chưa có CAD hoặc miễn Z vẫn có mặt trong PL2/PL3, có lời ghi chú phù hợp.',
    ],
  },
  {
    key: '07_high_risk',
    title: 'Rủi ro cao (Burland ≥ 3)',
    pick: (all) => all.filter((c) => normal(c) && c.maxBurland >= 3).sort((a, b) => b.maxBurland - a.maxBurland || byStatus(a, b)),
    checklist: [
      'VIII.1 (trang {sec-8}): ô ECS hiện tại viền đậm.',
      'VIII.2 (trang {sec-8-2}): tiêu đề + ma trận nằm trọn 1 trang, mỗi ô "N – Rủi ro …" trên 1 dòng, ô kết quả viền đậm.',
      'VIII.3: bảng BRA không rớt dòng cuối sang trang mới; "Căn cứ chấm điểm" không nằm một mình cuối trang.',
      'VIII.4 (trang {sec-8-4}): ô cấp rủi ro 2×1, cả 2 ô viền đậm, kết quả in hoa.',
      'Số liệu bề rộng vết nứt hợp lý (cảnh giác lỗi nhập đơn vị như 120 mm).',
    ],
  },
  {
    key: '08_absentee',
    title: 'Nhà vắng chủ',
    pick: (all) => all.filter((c) => c.caseType === 'ABSENTEE').sort(byStatus),
    checklist: [
      'Nội dung thích ứng ca vắng chủ (bìa, Mục III, IX), không bịa thông tin chủ hộ.',
      'Ảnh biên bản / bối cảnh ở PL1 đúng nhóm.',
    ],
  },
  {
    key: '08_under_construction',
    title: 'Nhà đang thi công',
    pick: (all) => all.filter((c) => c.caseType === 'UNDER_CONSTRUCTION').sort(byStatus),
    checklist: [
      'Nội dung thích ứng ca đang thi công; nhóm ảnh P-UC ở PL1.',
      'Mục IV/V không suy diễn số liệu không có.',
    ],
  },
  {
    key: '09_long_cover',
    title: 'Tên công trình + địa chỉ dài nhất',
    pick: (all) => all.filter(normal).sort((a, b) => b.coverTextLength - a.coverTextLength),
    checklist: [
      'Bìa vẫn đúng 1 trang: ảnh bìa tự co lại, bảng ký không bị đẩy sang trang 2.',
      'Tên/địa chỉ dài xuống dòng gọn, không chồng chữ.',
    ],
  },
];

/** Số ứng viên dự phòng mỗi case (lỗi render thật hoặc không khớp điều kiện bố cục). */
const MAX_TRIES = 5;

function parseArgs(): { discover: boolean; cases: string[] | null; ids: Map<string, string>; out: string } {
  const args = process.argv.slice(2);
  const val = (name: string): string | null => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
  const ids = new Map<string, string>();
  for (const pair of (val('ids') ?? '').split(',').filter(Boolean)) {
    const [k, id] = pair.split(':');
    if (k && id) ids.set(k, id);
  }
  return {
    discover: args.includes('--discover'),
    cases: val('cases')?.split(',').filter(Boolean) ?? null,
    ids,
    out: path.resolve(val('out') ?? path.join(__dirname, '../../test_output/v2_samples')),
  };
}

async function loadCandidates(): Promise<Candidate[]> {
  const res = await Database.query<{
    id: string; code: string | null; status: string; building_type: string | null; floors: number; defects: number;
    floors_without_defects: number; photos: number; structural_cad_floors: number; floors_without_cad: number;
    exempt_zone_floors: number; max_burland: number | null; case_type: string | null; cover_len: number;
  }>(
    `WITH f AS (
       SELECT r.id AS report_id, fl,
         (SELECT COALESCE(sum(jsonb_array_length(COALESCE(z->'defects', '[]'::jsonb))), 0) FROM jsonb_array_elements(COALESCE(fl->'zones', '[]'::jsonb)) z)
         + (SELECT COALESCE(sum(jsonb_array_length(COALESCE(e->'defects', '[]'::jsonb))), 0) FROM jsonb_array_elements(COALESCE(fl->'structuralElements', '[]'::jsonb)) e) AS defects,
         jsonb_array_length(COALESCE(fl->'overviewPhotos', '[]'::jsonb))
         + (SELECT COALESCE(sum(jsonb_array_length(COALESCE(d->'cuPhotos', '[]'::jsonb)) + 1), 0)
            FROM jsonb_array_elements(COALESCE(fl->'zones', '[]'::jsonb) || COALESCE(fl->'structuralElements', '[]'::jsonb)) g,
                 jsonb_array_elements(COALESCE(g->'defects', '[]'::jsonb)) d) AS photos
       FROM base_survey_reports r, jsonb_array_elements(COALESCE(r.survey_data_json->'floors', '[]'::jsonb)) fl
       WHERE r.deleted_at IS NULL AND r.phase = $1 AND r.unit_id IS NULL
     )
     SELECT r.id, p.project_parcel_code AS code, r.status, p.building_type,
       COALESCE(jsonb_array_length(r.survey_data_json->'floors'), 0)::int AS floors,
       COALESCE((SELECT sum(defects) FROM f WHERE f.report_id = r.id), 0)::int AS defects,
       COALESCE((SELECT count(*) FROM f WHERE f.report_id = r.id AND defects = 0), 0)::int AS floors_without_defects,
       COALESCE((SELECT sum(photos) FROM f WHERE f.report_id = r.id), 0)::int AS photos,
       COALESCE((SELECT count(*) FROM f WHERE f.report_id = r.id AND COALESCE(fl->>'cadStructuralSketchPhotoUrl', '') <> ''), 0)::int AS structural_cad_floors,
       COALESCE((SELECT count(*) FROM f WHERE f.report_id = r.id AND COALESCE(fl->>'cadSketchPhotoUrl', '') = ''), 0)::int AS floors_without_cad,
       COALESCE((SELECT count(*) FROM f WHERE f.report_id = r.id AND fl->>'hasZones' = 'false'), 0)::int AS exempt_zone_floors,
       NULLIF(r.survey_data_json#>>'{burlandSummary,localMaxGrade}', '')::numeric::int AS max_burland,
       r.survey_data_json->>'surveyCaseType' AS case_type,
       (length(COALESCE(r.survey_data_json->>'buildingName', '')) + length(COALESCE(r.survey_data_json->>'houseNumber', ''))
        + length(COALESCE(r.survey_data_json->>'street', '')) + length(COALESCE(r.survey_data_json->>'ward', '')))::int AS cover_len
     FROM base_survey_reports r JOIN parcels p ON p.id = r.parcel_id
     WHERE r.deleted_at IS NULL AND r.phase = $1 AND r.unit_id IS NULL
     ORDER BY r.updated_at DESC NULLS LAST;`,
    ['PHASE_1']
  );
  return res.rows
    .filter((r) => resolveReportTemplateKind({ unit_id: null, building_type: r.building_type }) === 'STANDALONE')
    .map((r) => ({
      id: r.id,
      code: r.code ?? r.id.slice(0, 8),
      status: String(r.status || '').toUpperCase(),
      buildingType: r.building_type,
      floors: r.floors,
      defects: r.defects,
      floorsWithoutDefects: r.floors_without_defects,
      photos: r.photos,
      structuralCadFloors: r.structural_cad_floors,
      floorsWithoutCad: r.floors_without_cad,
      exemptZoneFloors: r.exempt_zone_floors,
      maxBurland: r.max_burland ?? 0,
      caseType: r.case_type ?? 'NORMAL',
      coverTextLength: r.cover_len,
    }));
}

function count(html: string, re: RegExp): number {
  return (html.match(re) || []).length;
}

function sliceBetween(html: string, startKey: string, endKey: string | null): string {
  const s = html.indexOf(`data-section="${startKey}"`);
  if (s < 0) return '';
  const e = endKey ? html.indexOf(`data-section="${endKey}"`, s + 1) : -1;
  return html.slice(s, e < 0 ? undefined : e);
}

function htmlMetrics(html: string): HtmlMetrics {
  const pl1 = sliceBetween(html, 'pl-1', 'pl-2');
  const pl2 = sliceBetween(html, 'pl-2', 'pl-3');
  const pl3 = sliceBetween(html, 'pl-3', null);
  const fig = /<figure class="v2-figure(?! force-light)/g;
  const floors = pl2.split(/class="v2-floor[ "]/).slice(1);
  return {
    trios: count(html, /class="v2-photo-block v2-photo-trio/g),
    cadPairs: count(pl2, /class="v2-cad-pair"/g),
    stackedDualFloors: floors.filter((f) => !f.includes('v2-cad-pair') && f.includes('v2-cad is-dual')).length,
    singleCadFloors: floors.filter((f) => !f.includes('v2-cad-pair') && !f.includes('is-dual') && f.includes('class="v2-cad ')).length,
    pl1Photos: count(pl1, fig),
    pl2Photos: count(pl2, fig),
    pl3Photos: count(pl3, fig),
  };
}

function errText(err: unknown): string {
  const e = err as { name?: string; message?: string };
  return `${e?.name ?? 'Error'}: ${(e?.message ?? String(err)).slice(0, 160)}`;
}

async function runCase(def: CaseDef, candidates: Candidate[], used: Set<string>, failed: Map<string, string>, outDir: string): Promise<CaseResult> {
  const result: CaseResult = {
    def, candidate: null, file: null, pages: 0, sizeMb: 0, seconds: 0, tocOk: false, tocDetail: '',
    headerFooterOk: false, headerFooterDetail: '', sparsePages: '', sectionPages: {}, metrics: null, gates: '', skipped: [],
  };
  for (const c of candidates.filter((x) => !used.has(x.id)).slice(0, MAX_TRIES)) {
    const t0 = Date.now();
    const known = failed.get(c.id);
    if (known) {
      result.skipped.push(`${c.code}: ${known} (đã thử ở case trước)`);
      continue;
    }
    try {
      process.stdout.write(`  → ${c.code} (${c.id.slice(0, 8)}, ${c.status})… `);
      const resolved = await ReportService.resolve(c.id);
      // Mẫu nghiệm thu BỐ CỤC (người dùng chốt 16/11/2026): bỏ qua 2 cổng chặn của renderDraftPdf
      // (crop chờ duyệt, ảnh chưa dập dấu) nhưng vẫn ghi lại để đánh dấu file. Render giống renderDraftPdf:
      // cùng renderDraftHtml (có watermark) và cùng tùy chọn PdfRenderEngine (engineOptions).
      let cropGate = '';
      if (resolved.status !== 'APPROVED') {
        try {
          await ReportService.assertPhotoQcCropsReviewed(resolved.id);
        } catch (gateErr) {
          cropGate = errText(gateErr).replace(/^[A-Za-z]+: /, '').slice(0, 90);
        }
      }
      const rendered = await ReportService.renderDraftHtml(resolved, undefined, false, true, undefined, 'residential_v2');
      if (rendered.templateKey !== 'residential_v2') throw new Error(`không dùng được v2 (${rendered.templateKey})`);
      const metrics = htmlMetrics(rendered.html);
      if (def.accept && !def.accept(metrics)) {
        result.skipped.push(`${c.code}: không khớp điều kiện bố cục (CAD cạnh nhau ${metrics.cadPairs}, xếp chồng ${metrics.stackedDualFloors}, 1 sơ đồ ${metrics.singleCadFloors})`);
        process.stdout.write('không khớp, bỏ qua\n');
        continue;
      }
      const wmFailed = rendered.watermark.issues.length;
      const pdfBuffer = await PdfRenderEngine.renderHtmlToPdf(rendered.html, {
        buildingId: rendered.viewModel.metadata.buildingId,
        reportNo: rendered.viewModel.metadata.reportNo,
        headerTitle: REPORT_PDF_HEADER_TITLE,
        selfContainedHtml: true,
        headerFooter: rendered.render.headerFooter,
        tocTwoPass: rendered.render.tocTwoPass,
        waitForReportReady: rendered.render.waitForReportReady,
        chromeHeaderFooter: rendered.chromeHeaderFooter,
      });
      const gates = [cropGate ? `crop: ${cropGate}` : '', wmFailed ? `${wmFailed} ảnh chưa dập dấu` : ''].filter(Boolean).join('; ');
      const seconds = (Date.now() - t0) / 1000;

      const stats = await analyzePdfPages(pdfBuffer, V2_PAGE_MARGINS_PT);
      const total = stats.length;
      const located = await locateSectionPages(pdfBuffer, HEADINGS);
      const present = HEADINGS.filter((h) => TOC_KEYS.has(h.key) && located.pages[h.key] !== undefined);
      const printed = await readTocPageNumbers(pdfBuffer, present);
      const wrongToc = present.filter((h) => printed[h.key] !== located.pages[h.key]);
      // v2: đầu trang (cả bìa) có "Page: i of N", chân trang có "Trang / Page i".
      const missing = stats.filter((s) => !new RegExp(`Page: ${s.page} of ${total}\\b`).test(s.headerText) || !new RegExp(`Trang / Page ${s.page}\\b`).test(s.footerText));
      const sparse = stats.slice(1).filter((s) => s.fillPct < SPARSE_FILL_PCT);

      const file = `${def.key}__${c.code.replace(/[^A-Za-z0-9-]+/g, '_')}.pdf`;
      fs.writeFileSync(path.join(outDir, file), pdfBuffer);
      used.add(c.id);
      Object.assign(result, {
        gates, candidate: c, file, pages: total, sizeMb: pdfBuffer.length / 1e6, seconds, metrics,
        tocOk: wrongToc.length === 0,
        tocDetail: wrongToc.map((h) => `${h.key}: in ${printed[h.key] ?? '?'}, thật ${located.pages[h.key]}`).join('; '),
        headerFooterOk: missing.length === 0,
        headerFooterDetail: missing.length ? `sai/thiếu ở ${missing.slice(0, 5).map((s) => `p${s.page}`).join(', ')}` : '',
        sparsePages: sparse.map((s) => `p${s.page} (${s.fillPct}%)`).join(', '),
        sectionPages: located.pages,
      });
      process.stdout.write(`OK ${total} trang, ${result.sizeMb.toFixed(1)} MB, ${seconds.toFixed(0)} s\n`);
      return result;
    } catch (err) {
      console.error(`[export_v2_sample_cases:${def.key}] ${c.code} lỗi, chuyển ứng viên kế`, err);
      failed.set(c.id, errText(err));
      result.skipped.push(`${c.code}: ${errText(err)}`);
    }
  }
  return result;
}

function fillPages(line: string, pages: Record<string, number>): string {
  return line.replace(/\{([a-z0-9-]+)\}/g, (_, k: string) => (pages[k] ? String(pages[k]) : '?'));
}

function writeSummary(outDir: string, results: CaseResult[]): void {
  const L: string[] = [];
  L.push('# Bộ case mẫu report nhà dân v2 — nghiệm thu trước prod', '');
  L.push(`Xuất lúc ${new Date().toISOString()} qua đúng pipeline thật (\`renderDraftPdf\`, có watermark, đầu/chân trang Chrome, Mục lục 2 lượt). Bản nháp, không phải Rev.`, '');
  L.push('**Mẫu để kiểm BỐ CỤC và THÔNG TIN:** script bỏ qua 2 cổng chặn xuất (crop chờ duyệt, ảnh chưa dập được dấu). Cột "Cổng chặn đã bỏ qua" cho biết hồ sơ nào trên hệ thống thật hiện CHƯA xuất được; ảnh lỗi dấu trong file có thể thiếu hoặc sai dấu.', '');
  L.push('## Bảng chỉ số', '');
  L.push('| Case | File | Công trình | Trạng thái | Trang | MB | Giây | Mục lục | Đầu/chân trang | Ảnh PL1/PL2/PL3 | Trio | CAD cạnh nhau / chồng / 1 sơ đồ | Trang gần trống (<15%) | Cổng chặn đã bỏ qua |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    if (!r.candidate || !r.file || !r.metrics) {
      L.push(`| ${r.def.key} | — | không có hồ sơ phù hợp | | | | | | | | | | | |`);
      continue;
    }
    const m = r.metrics;
    L.push(`| ${r.def.key} | \`${r.file}\` | ${r.candidate.code} (\`${r.candidate.id}\`) | ${r.candidate.status} | ${r.pages} | ${r.sizeMb.toFixed(1)} | ${r.seconds.toFixed(0)} | ${r.tocOk ? 'OK' : `LỆCH: ${r.tocDetail}`} | ${r.headerFooterOk ? 'OK' : `LỖI: ${r.headerFooterDetail}`} | ${m.pl1Photos}/${m.pl2Photos}/${m.pl3Photos} | ${m.trios} | ${m.cadPairs} / ${m.stackedDualFloors} / ${m.singleCadFloors} | ${r.sparsePages || '—'} | ${r.gates || '—'} |`);
  }
  L.push('', 'Trang gần trống chỉ là cảnh báo: khối ảnh / sơ đồ lớn không vừa phần còn lại sẽ sang trang sau ("đủ 1 thì lấy 1").', '');
  L.push('## Hướng dẫn kiểm tra từng file', '');
  for (const r of results) {
    L.push(`### ${r.def.key} — ${r.def.title}`, '');
    if (!r.candidate || !r.file) {
      L.push('Không có hồ sơ phù hợp trong dữ liệu hiện tại (không bịa hồ sơ).', '');
    } else {
      const c = r.candidate;
      L.push(`File \`${r.file}\` — ${c.code}, ${c.floors} tầng, ${c.defects} khuyết tật, Burland lớn nhất ${c.maxBurland}. Trang các mục: ${Object.entries(r.sectionPages).map(([k, p]) => `${k}=${p}`).join(', ')}.`, '');
      for (const line of r.def.checklist) L.push(`- [ ] ${fillPages(line, r.sectionPages)}`);
      L.push('');
    }
    if (r.skipped.length) {
      L.push('Ứng viên đã bỏ qua:');
      for (const s of r.skipped) L.push(`- ${s}`);
      L.push('');
    }
  }
  fs.writeFileSync(path.join(outDir, 'summary.md'), L.join('\n'));
}

async function main(): Promise<void> {
  const opts = parseArgs();
  const all = await loadCandidates();
  const defs = CASES.filter((d) => !opts.cases || opts.cases.some((k) => d.key.startsWith(k)));
  process.stdout.write(`${all.length} hồ sơ nhà dân (STANDALONE)\n`);

  const pools = new Map<string, Candidate[]>();
  for (const d of defs) {
    const forced = opts.ids.get(d.key) ?? opts.ids.get(d.key.slice(0, 2));
    const forcedC = forced ? all.find((c) => c.id === forced || c.id.startsWith(forced)) : undefined;
    if (forced && !forcedC) console.error(`[export_v2_sample_cases] --ids: không tìm thấy hồ sơ ${forced} cho ${d.key}`);
    pools.set(d.key, forcedC ? [forcedC] : d.pick(all));
  }

  if (opts.discover) {
    for (const d of defs) {
      process.stdout.write(`\n${d.key} — ${d.title}\n`);
      const pool = pools.get(d.key) ?? [];
      if (pool.length === 0) process.stdout.write('  (không có ứng viên)\n');
      for (const c of pool.slice(0, MAX_TRIES)) {
        process.stdout.write(`  ${c.code.padEnd(16)} ${c.id}  ${c.status.padEnd(12)} tầng=${c.floors} KT=${c.defects} ảnh≈${c.photos} CAD-E=${c.structuralCadFloors} Burland=${c.maxBurland}\n`);
      }
    }
    return;
  }

  fs.mkdirSync(opts.out, { recursive: true });
  const used = new Set<string>();
  const failed = new Map<string, string>();
  const results: CaseResult[] = [];
  for (const d of defs) {
    process.stdout.write(`\n${d.key} — ${d.title}\n`);
    results.push(await runCase(d, pools.get(d.key) ?? [], used, failed, opts.out));
    writeSummary(opts.out, results);
  }
  process.stdout.write(`\nXong. Thư mục: ${opts.out}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[export_v2_sample_cases] Lỗi', err);
    process.exit(1);
  });
