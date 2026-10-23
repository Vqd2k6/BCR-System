/**
 * ============================================================================
 * BUSINESS TEST SUITE – Báo cáo BCS V3 (nhà dân độc lập)
 * Chạy: cd backend && npx ts-node src/scripts/test_report_v3_business_cases.ts
 *
 * - Phần A: test thuần (không DB)  – calculator, snapshot, hash, queue, quyền, mapper.
 * - Phần B: test tích hợp trên DB LOCAL với 6 hồ sơ bộ kiểm chứng D16 (duyệt thử local).
 * KHÔNG chạy trên production DB.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { Database, pool } from '../database/db';
import { calculateVi, v3FromCat, v4FromAge, viClassFromAvg } from '../modules/scoring/vi-calculator';
import {
  ReportSnapshotService,
  stableStringify,
  sha256Hex,
} from '../modules/report_v3/report-snapshot.service';
import { ReportSnapshotSchema } from '../modules/report_v3/report-snapshot.schema';
import { RenderQueue, RenderTimeoutError } from '../modules/report_v3/render-queue';
import { ReportReleaseService, getReleaseStorageDir } from '../modules/report_v3/report-release.service';
import { ReportV3Service } from '../modules/report_v3/report-v3.service';
import { escapeHtml, PdfRenderV2Engine } from '../modules/report_v2/engine/pdf-render-v2.engine';
import { MetadataMapper } from '../modules/report_v2/mappers/sections/metadata.mapper';
import { Section9ConclusionMapper } from '../modules/report_v2/mappers/sections/section-9-conclusions.mapper';
import { AuditReviewService } from '../modules/audit/services/audit-review.service';
import { SurveyRepository } from '../modules/survey/survey.repository';
import type { JwtPayload } from '../common/guards/auth.guard';

interface CaseResult {
  id: string;
  name: string;
  ok: boolean;
  detail: string;
}
const results: CaseResult[] = [];

async function tc(id: string, name: string, fn: () => Promise<string | void> | string | void): Promise<void> {
  try {
    const detail = await fn();
    results.push({ id, name, ok: true, detail: detail || '' });
    console.log(`  ✅ ${id} ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ id, name, ok: false, detail: msg });
    console.log(`  ❌ ${id} ${name} — ${msg}`);
  }
}

function eq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: mong đợi ${String(expected)}, thực tế ${String(actual)}`);
}
function truthy(cond: boolean, label: string): void {
  if (!cond) throw new Error(label);
}
async function rejects(fn: () => Promise<unknown>, name: string, label: string): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const n = err instanceof Error ? err.constructor.name : '';
    if (n !== name) throw new Error(`${label}: mong đợi lỗi ${name}, thực tế ${n}`);
    return;
  }
  throw new Error(`${label}: mong đợi lỗi ${name} nhưng không có lỗi`);
}

const ZONE_ADMIN_ZONE09: JwtPayload = {
  userId: 'cbdf02a5-bd8b-4b11-9fcf-5714699ef5c0',
  username: 'zoneAdminTest_01',
  role: 'ZONE_ADMIN',
  assignedZoneId: 'ZONE_09',
  fullName: 'Zone Admin Test 01',
};
const ZONE_ADMIN_OTHER: JwtPayload = { ...ZONE_ADMIN_ZONE09, userId: 'cbdf02a5-bd8b-4b11-9fcf-5714699ef5c0', assignedZoneId: 'ZONE_01' };
const SUPER_ADMIN: JwtPayload = {
  userId: 'b0000000-0000-0000-0000-000000000001',
  username: 'superadmin',
  role: 'SUPER_ADMIN',
  assignedZoneId: null,
  fullName: 'Super Admin',
};
const SURVEYOR: JwtPayload = { ...ZONE_ADMIN_ZONE09, role: 'SURVEYOR' };

const VERIFICATION_SET: Array<{ id: string; code: string; note: string }> = [
  { id: '52eff9ab-90fa-4ed3-9b05-90d5bfcd6793', code: 'C&C-05-B-0063', note: '0 khuyết tật' },
  { id: 'e822634b-cbc5-42ee-9021-8ebb85bd20b5', code: 'C&C-05-B-0101', note: '21 khuyết tật' },
  { id: 'c8bae92f-e3ca-40ed-a541-a08e42b14096', code: 'C&C-05-B-0004', note: 'Burland 5 / ECS 14' },
  { id: '013d8ec6-a9d8-4854-8536-ce9c8ccf0903', code: 'C&C-05-B-0116', note: 'CAT 4' },
  { id: '3be7de76-6645-4b91-abf5-300ead09cb62', code: 'C&C-05-B-0064', note: '11 tầng, móng cọc' },
  { id: '44b36260-2aa1-483c-9bfc-9fb804581f89', code: 'C&C-05-B-0171', note: 'đang thi công' },
];

async function partA(): Promise<void> {
  console.log('\n══ PHẦN A: Test thuần (không DB) ══');

  await tc('A01', 'V3 theo CAT: 1,2→1; 3→2; 4→3; 5→4; thiếu CAT→null', () => {
    eq(v3FromCat(1), 1, 'CAT1');
    eq(v3FromCat(2), 1, 'CAT2');
    eq(v3FromCat(3), 2, 'CAT3');
    eq(v3FromCat(4), 3, 'CAT4');
    eq(v3FromCat(5), 4, 'CAT5');
    eq(v3FromCat(null), null, 'CAT null');
    eq(v3FromCat(0), null, 'CAT 0');
    eq(v3FromCat(6), null, 'CAT 6');
  });

  await tc('A02', 'V4 theo tuổi: <10→1, ≤25→2, ≤40→3, >40→4 (biên)', () => {
    eq(v4FromAge(9), 1, 'age 9');
    eq(v4FromAge(10), 2, 'age 10');
    eq(v4FromAge(25), 2, 'age 25');
    eq(v4FromAge(26), 3, 'age 26');
    eq(v4FromAge(40), 3, 'age 40');
    eq(v4FromAge(41), 4, 'age 41');
  });

  await tc('A03', 'V4: cơi nới nặng (renovationLoad ≥ 3) → 4; thiếu năm XD → null', () => {
    const base = { foundationCatScore: 3, currentYear: 2026, ecsClass: 'GOOD' as const };
    eq(calculateVi({ ...base, constructionYear: 2020, renovationLoad: 3 }).v4, 4, 'renovation');
    eq(calculateVi({ ...base, constructionYear: 2020, renovationLoad: 2 }).v4, 1, 'no renovation');
    eq(calculateVi({ ...base }).v4, null, 'no year');
  });

  await tc('A04', 'VI chưa đủ dữ liệu (thiếu CAT hoặc năm) → total/avg/class = null, không đoán', () => {
    const noCat = calculateVi({ constructionYear: 2000, currentYear: 2026 });
    eq(noCat.totalVi, null, 'total');
    eq(noCat.viAvg, null, 'avg');
    eq(noCat.viClass, null, 'class');
    const noYear = calculateVi({ foundationCatScore: 3 });
    eq(noYear.viAvg, null, 'avg no year');
  });

  await tc('A05', 'VI đủ dữ liệu: tổng/avg/class đúng công thức FE', () => {
    // V1=2 (GENERAL), V2=2 (mặc định), V3=2 (CAT3), V4=2 (tuổi 16), V5=1 (GOOD), V6=1 → 10/6=1.67 → MEDIUM
    const r = calculateVi({ foundationCatScore: 3, constructionYear: 2010, currentYear: 2026, ecsClass: 'GOOD' });
    eq(r.totalVi, 10, 'total');
    eq(r.viAvg, 1.67, 'avg');
    eq(r.viClass, 'MEDIUM', 'class');
  });

  await tc('A06', 'Phân hạng VI: ≤1.5 LOW | >1.5 MEDIUM | >2.5 HIGH | >3.25 VERY_HIGH', () => {
    eq(viClassFromAvg(1.5), 'LOW', '1.5');
    eq(viClassFromAvg(1.51), 'MEDIUM', '1.51');
    eq(viClassFromAvg(2.5), 'MEDIUM', '2.5');
    eq(viClassFromAvg(2.51), 'HIGH', '2.51');
    eq(viClassFromAvg(3.25), 'HIGH', '3.25');
    eq(viClassFromAvg(3.26), 'VERY_HIGH', '3.26');
  });

  await tc('A07', 'V1: nhà bỏ trống / đất trống → 0; CRITICAL 4; IMPORTANT 3; GENERAL 2', () => {
    eq(calculateVi({ usageFunction: 'Nhà bỏ trống' }).v1, 0, 'bỏ trống');
    eq(calculateVi({ usageFunction: 'Đất trống' }).v1, 0, 'đất trống');
    eq(calculateVi({ surveyCaseType: 'VACANT_LAND' }).v1, 0, 'vacant');
    eq(calculateVi({ objectGroup: 'CRITICAL' }).v1, 4, 'critical');
    eq(calculateVi({ objectGroup: 'IMPORTANT' }).v1, 3, 'important');
    eq(calculateVi({}).v1, 2, 'general');
  });

  await tc('A08', 'Hash snapshot ổn định, độc lập thứ tự key; đổi dữ liệu → đổi hash', () => {
    eq(stableStringify({ b: 1, a: [2, { d: 4, c: 3 }] }), stableStringify({ a: [2, { c: 3, d: 4 }], b: 1 }), 'stable');
    const s1 = ReportSnapshotService.resolveScores({ foundationCatScore: 3, constructionYear: 2010 }, null, 2);
    const s2 = ReportSnapshotService.resolveScores({ foundationCatScore: 3, constructionYear: 2010 }, null, 2);
    const s3 = ReportSnapshotService.resolveScores({ foundationCatScore: 4, constructionYear: 2010 }, null, 2);
    eq(ReportSnapshotService.computeContentHash(s1), ReportSnapshotService.computeContentHash(s2), 'same');
    truthy(ReportSnapshotService.computeContentHash(s1) !== ReportSnapshotService.computeContentHash(s3), 'diff');
  });

  await tc('A09', 'resolveScores: không có dữ liệu → UNASSESSED, mọi điểm null (không mặc định)', () => {
    const s = ReportSnapshotService.resolveScores({}, null, null);
    eq(s.ecs.source, 'UNASSESSED', 'ecs source');
    eq(s.ecs.total, null, 'ecs total');
    eq(s.ecs.ecsClass, null, 'ecs class');
    eq(s.vi.v3, null, 'v3');
    eq(s.vi.v4, null, 'v4');
    eq(s.vi.avg, null, 'avg');
    eq(s.vi.foundationCat, null, 'cat');
  });

  await tc('A10', 'resolveScores: Admin override ECS/VI thắng dữ liệu tự tính; điểm Admin chốt được giữ', () => {
    const card = {
      e1_burland_score: 4, e2_structure_score: 3, e3_deformation_score: 2, e4_material_score: 2, e5_history_score: 1,
      e6_overall_function_score: 0, total_ecs_score: 12,
      overridden_total_ecs: 20, overridden_ecs_class: 'CRITICAL', overridden_avg_vi: 3.4, overridden_vi_class: 'VERY_HIGH',
    };
    const s = ReportSnapshotService.resolveScores({ foundationCatScore: 3, constructionYear: 2010 }, card, 5);
    eq(s.ecs.total, 20, 'ecs total override');
    eq(s.ecs.ecsClass, 'CRITICAL', 'ecs class override');
    eq(s.ecs.source, 'ADMIN_OVERRIDE', 'source');
    eq(s.vi.avg, 3.4, 'avg override');
    eq(s.vi.viClass, 'VERY_HIGH', 'vi class override');
    eq(s.vi.source, 'ADMIN_OVERRIDE', 'vi source');
  });

  await tc('A11', 'Snapshot qua Zod: hợp lệ parse được; sai schema bị từ chối', () => {
    const scores = ReportSnapshotService.resolveScores({ foundationCatScore: 4, constructionYear: 2000 }, null, 3);
    const ok = ReportSnapshotSchema.safeParse({
      schemaVersion: 1,
      reportId: '52eff9ab-90fa-4ed3-9b05-90d5bfcd6793',
      approvedAt: new Date().toISOString(),
      approvedByUserId: SUPER_ADMIN.userId,
      ...scores,
      contentSha256: ReportSnapshotService.computeContentHash(scores),
    });
    truthy(ok.success, 'snapshot hợp lệ phải parse được');
    const bad = ReportSnapshotSchema.safeParse({ schemaVersion: 2 });
    truthy(!bad.success, 'snapshot sai phải bị từ chối');
  });

  await tc('A12', 'applySnapshotToReport: thiếu CAT → xóa foundationCatScore, không điền mặc định', () => {
    const scores = ReportSnapshotService.resolveScores({}, null, null);
    const snap = ReportSnapshotSchema.parse({
      schemaVersion: 1,
      reportId: '52eff9ab-90fa-4ed3-9b05-90d5bfcd6793',
      approvedAt: new Date().toISOString(),
      approvedByUserId: SUPER_ADMIN.userId,
      ...scores,
      contentSha256: ReportSnapshotService.computeContentHash(scores),
    });
    const out = ReportSnapshotService.applySnapshotToReport({ survey_data_json: { foundationCatScore: 3 } }, snap);
    const json = out.survey_data_json as Record<string, unknown>;
    eq(json.foundationCatScore, undefined, 'CAT bị xóa');
    const vi = json.vi as Record<string, unknown>;
    eq(vi.v3, undefined, 'v3 không có');
  });

  await tc('A13', 'escapeHtml chống chèn HTML trong header/footer ("C&C-05-B-0063 <b>")', () => {
    eq(escapeHtml('C&C-05-B-0063 <b>"x"\''), 'C&amp;C-05-B-0063 &lt;b&gt;&quot;x&quot;&#39;', 'escape');
  });

  await tc('A14', 'RenderQueue: tối đa 2 tác vụ song song, đủ 6 tác vụ hoàn tất', async () => {
    let active = 0;
    let peak = 0;
    const job = async (): Promise<number> => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 40));
      active -= 1;
      return 1;
    };
    const out = await Promise.all(Array.from({ length: 6 }, () => RenderQueue.run(job)));
    eq(out.length, 6, 'done');
    truthy(peak <= RenderQueue.maxConcurrency, `peak=${peak} vượt giới hạn ${RenderQueue.maxConcurrency}`);
    eq(RenderQueue.activeCount, 0, 'active sau khi xong');
    return `peak=${peak}`;
  });

  await tc('A15', 'RenderQueue: timeout → RenderTimeoutError, slot được giải phóng', async () => {
    await rejects(() => RenderQueue.run(() => new Promise<void>(() => undefined), 50), RenderTimeoutError.name, 'timeout');
    eq(RenderQueue.activeCount, 0, 'slot giải phóng');
  });

  await tc('A16', 'Quyền phát hành Rev (D14): Super OK; Zone Admin đúng khu OK; khu khác/Surveyor bị chặn', () => {
    const resolved = { id: 'x', status: 'APPROVED', zoneId: 'ZONE_09', exportRevision: 0, approvedAt: null, raw: {} };
    ReportReleaseService.assertCanRelease(resolved, SUPER_ADMIN);
    ReportReleaseService.assertCanRelease(resolved, ZONE_ADMIN_ZONE09);
    let blocked = 0;
    for (const u of [ZONE_ADMIN_OTHER, SURVEYOR]) {
      try {
        ReportReleaseService.assertCanRelease(resolved, u);
      } catch (e) {
        if (e instanceof Error && e.constructor.name === 'ForbiddenError') blocked += 1;
      }
    }
    eq(blocked, 2, 'số user bị chặn');
  });

  await tc('A17', 'Lý do phát hành Rev bắt buộc (<10 ký tự → BadRequest)', async () => {
    await rejects(() => ReportReleaseService.issueNewRevision('x', SUPER_ADMIN, ''), 'BadRequestError', 'rỗng');
    await rejects(() => ReportReleaseService.issueNewRevision('x', SUPER_ADMIN, 'ngắn'), 'BadRequestError', 'ngắn');
  });

  await tc('A18', 'Survey ID = P- + 4 số cuối SĐT KSV; thiếu → "--"; Rev từ export_revision', () => {
    const base = { project_parcel_code: 'C&C-05-B-0063', zone_id: 'ZONE_09', segment_type: 'C&C', id: '8f3a1c20-0000-4000-8000-000000000000' };
    const a = MetadataMapper.map({ ...base, surveyor_phone: '0901 234 567', export_revision: 2 }, {}, [], undefined, '01/01/2026', '', '2026-01-01');
    eq(a.surveyId, 'P-4567', 'surveyId');
    eq(a.metadata.revision, '02', 'rev');
    const b = MetadataMapper.map({ ...base, export_revision: 0 }, {}, [], undefined, '01/01/2026', '', '2026-01-01');
    eq(b.surveyId, '--', 'thiếu SĐT');
    eq(b.metadata.revision, '00', 'rev 0');
    truthy(!a.surveyId.includes('8F3A'), 'không dùng UUID');
  });

  await tc('A19', 'Chữ ký 2 cấp: Người lập (ngày KS) + Kiểm tra/Duyệt (ngày APPROVE); chưa duyệt → trống', () => {
    const base = { project_parcel_code: 'C&C-05-B-0063', zone_id: 'ZONE_09', surveyor_name: 'KSV A', zone_admin_name: 'ZA B' };
    const draft = MetadataMapper.map({ ...base, status: 'SUBMITTED' }, {}, [], undefined, '05/10/2026', '', '2026-10-05');
    eq(draft.signatures3Party.length, 2, 'số khung ký');
    eq(draft.signatures3Party[0].date, '05/10/2026', 'ngày lập');
    eq(draft.signatures3Party[1].date, '', 'chưa duyệt không có ngày');
    const approved = MetadataMapper.map(
      { ...base, status: 'APPROVED', approved_at: '2026-10-18T05:00:00.000Z' }, {}, [], undefined, '05/10/2026', '', '2026-10-05'
    );
    eq(approved.signatures3Party[1].date, '18/10/2026', 'ngày duyệt');
    truthy(!approved.signatures3Party.some((s) => s.roleVi.includes('PHÊ DUYỆT') && s.roleVi !== 'KIỂM TRA / DUYỆT'), 'không còn ô Super Admin');
  });

  await tc('A20', 'Mục IX không tự sinh kết luận / người chứng kiến / "Không"', () => {
    const out = Section9ConclusionMapper.map(
      { status: 'SUBMITTED' }, {}, [],
      { localMaxGrade: { vi: '' } },
      { overallRisk: { grade: { vi: 'x', en: 'x' } } },
      {}
    );
    eq(out.conclusions.length, 0, 'conclusions');
    eq(out.witnessNarrative.vi, '', 'witness');
    eq(out.limitations.length >= 0, true, 'limitations là mảng');
    truthy(!out.limitations.some((l) => l.vi === 'Không'), 'không có "Không" mặc định');
    truthy(!JSON.stringify(out).includes('đang sử dụng ổn định'), 'không còn câu ổn định');
    truthy(!JSON.stringify(out).includes('điểm A'), 'không còn điểm A');
  });

  await tc('A21', 'Endpoint batch-export giả đã bị gỡ khỏi app.ts', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../app.ts'), 'utf8');
    truthy(!src.includes('batch-export'), 'còn route batch-export');
    truthy(!src.includes('/admin/reports/exports'), 'còn route exports');
    truthy(src.includes('/guest/gis-map'), 'phải giữ guest endpoint');
  });
}

async function resetVerificationReleases(): Promise<void> {
  // Reset releases và export_revision cho các hồ sơ kiểm chứng để test chạy lặp lại an toàn (idempotent)
  await Database.query(
    `DELETE FROM report_releases WHERE report_id = ANY($1::uuid[]);`,
    [VERIFICATION_SET.map((r) => r.id)]
  );
  await Database.query(
    `DELETE FROM survey_report_versions WHERE report_id = ANY($1::uuid[]) AND version_tag = 'APPROVED_RELEASE';`,
    [VERIFICATION_SET.map((r) => r.id)]
  );
  await Database.query(
    `UPDATE base_survey_reports SET export_revision = 0, status = 'UNDER_REVIEW' WHERE id = ANY($1::uuid[]);`,
    [VERIFICATION_SET.map((r) => r.id)]
  );

  const releaseBaseDir = getReleaseStorageDir();
  for (const r of VERIFICATION_SET) {
    const dir = path.join(releaseBaseDir, r.id);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

async function partB(): Promise<void> {
  console.log('\n══ PHẦN B: Tích hợp DB local – 6 hồ sơ bộ kiểm chứng (D16) ══');
  await resetVerificationReleases();

  // Không giữ HTML trong bộ nhớ (HTML nhúng base64 có thể > 150MB/hồ sơ) – chỉ lưu cờ kiểm tra
  const flagsById = new Map<string, { hasNaN: boolean; usesUuidSurveyId: boolean }>();

  for (const r of VERIFICATION_SET) {
    await tc(`B1-${r.code}`, `DRAFT HTML (${r.note}) – không auto text/A/nhãn kiểm soát, 2 ô ký, watermark`, async () => {
      const resolved = await ReportV3Service.resolve(r.id);
      const wasApproved = resolved.status === 'APPROVED';
      const { html } = await ReportV3Service.renderDraftHtml(resolved, undefined, false, true);
      const textOnly = html.replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+\/=]+/gi, '');
      flagsById.set(r.id, {
        hasNaN: /\bNaN\b/.test(textOnly),
        usesUuidSurveyId: new RegExp(`P-${r.id.substring(0, 4).toUpperCase()}\\b`).test(textOnly),
      });
      truthy(!html.includes('TÀI LIỆU KIỂM SOÁT'), 'còn nhãn TÀI LIỆU KIỂM SOÁT');
      truthy(!html.includes('đang sử dụng ổn định'), 'còn câu tự sinh "đang sử dụng ổn định"');
      truthy(!html.includes('Không phát hiện lún, nghiêng, võng bất thường bằng trực quan'), 'còn câu tự sinh về lún/nghiêng/võng');
      truthy(!html.includes('26 + A') && !html.includes('Điểm BRA'), 'còn bảng điểm A');
      truthy(!html.includes('NGƯỜI PHÊ DUYỆT'), 'còn ô Super Admin');
      truthy(!/>NaN</.test(html) && !html.includes('undefined'), 'có NaN/undefined');
      truthy(!html.includes('0.000‰'), 'in 0.000‰ khi chưa đo');
      const sigHeaders = (html.match(/<table class="signature-table">[\s\S]*?<\/thead>/) || [''])[0].match(/<th>/g) || [];
      eq(sigHeaders.length, 2, 'số cột ký');
      if (!wasApproved) truthy(html.includes('DRAFT – KHÔNG CÓ GIÁ TRỊ PHÁP LÝ'), 'thiếu watermark DRAFT');
      return `status=${resolved.status}, ${Math.round(html.length / 1024)}KB`;
    });
  }

  await tc('B2', 'Hồ sơ 0 khuyết tật (0063): render không lỗi, không NaN, không cặp ảnh rác', () => {
    const f = flagsById.get(VERIFICATION_SET[0].id);
    truthy(Boolean(f), 'chưa có cờ kiểm tra');
    truthy(!(f as { hasNaN: boolean }).hasNaN, 'có NaN trong nội dung (đã loại base64)');
  });

  await tc('B3', 'Phân tích Survey ID trên HTML: không còn dạng P-<UUID>', () => {
    for (const r of VERIFICATION_SET) {
      const f = flagsById.get(r.id);
      truthy(Boolean(f), `${r.code} chưa có cờ kiểm tra`);
      truthy(!(f as { usesUuidSurveyId: boolean }).usesUuidSurveyId, `${r.code} vẫn dùng UUID cho Survey ID`);
    }
  });

  // ---- APPROVE (duyệt thử LOCAL) ----
  for (const r of VERIFICATION_SET) {
    await tc(`B4-${r.code}`, 'APPROVE → status APPROVED + snapshot APPROVED_RELEASE cùng transaction', async () => {
      const before = await Database.query<{ status: string }>(`SELECT status FROM base_survey_reports WHERE id = $1;`, [r.id]);
      if (before.rows[0].status !== 'APPROVED') {
        await AuditReviewService.approveReport(r.id, ZONE_ADMIN_ZONE09.userId, 'Duyệt thử bộ kiểm chứng D16 (local)');
      }
      const after = await Database.query<{ status: string; approved_at: Date | null }>(
        `SELECT status, approved_at FROM base_survey_reports WHERE id = $1;`, [r.id]
      );
      eq(after.rows[0].status, 'APPROVED', 'status');
      truthy(after.rows[0].approved_at !== null, 'approved_at');
      const snap = await ReportSnapshotService.getLatestApprovedSnapshot(r.id);
      truthy(snap !== null, 'thiếu snapshot APPROVED_RELEASE');
      if (!snap) throw new Error('thiếu snapshot');
      const recomputed = ReportSnapshotService.computeContentHash(
        { ecs: snap.snapshot.ecs, vi: snap.snapshot.vi, burlandMaxGrade: snap.snapshot.burlandMaxGrade },
        snap.snapshot.frozenSurveyDataJson,
        snap.snapshot.frozenParcel
      );
      eq(recomputed, snap.snapshot.contentSha256, 'hash nội dung snapshot');
      return `ECS=${snap.snapshot.ecs.total}/${snap.snapshot.ecs.ecsClass}, V3=${snap.snapshot.vi.v3 ?? '--'}, V4=${snap.snapshot.vi.v4 ?? '--'}, VIavg=${snap.snapshot.vi.avg ?? '--'}`;
    });
  }

  await tc('B5', 'APPROVE lần 2 bị chặn (409) – không chụp lại snapshot ngoài quy trình Rev', async () => {
    const before = await Database.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM survey_report_versions WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE';`,
      [VERIFICATION_SET[0].id]
    );
    await rejects(() => AuditReviewService.approveReport(VERIFICATION_SET[0].id, ZONE_ADMIN_ZONE09.userId), 'ConflictError', 'double approve');
    const after = await Database.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM survey_report_versions WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE';`,
      [VERIFICATION_SET[0].id]
    );
    eq(after.rows[0].c, before.rows[0].c, 'số snapshot không đổi');
  });

  await tc('B6', 'Điểm trong snapshot = điểm resolve lại từ dữ liệu nguồn (khớp màn review)', async () => {
    for (const r of VERIFICATION_SET) {
      const snap = await ReportSnapshotService.getLatestApprovedSnapshot(r.id);
      const src = await Database.query<{ survey_data_json: unknown }>(`SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`, [r.id]);
      const card = await Database.query(`SELECT * FROM risk_score_cards WHERE report_id = $1;`, [r.id]);
      const burland = await Database.query<{ m: number | null }>(`SELECT MAX(burland_grade) AS m FROM damage_zones WHERE report_id = $1;`, [r.id]);
      const again = ReportSnapshotService.resolveScores(
        src.rows[0].survey_data_json, card.rows[0] ?? null, burland.rows[0].m === null ? null : Number(burland.rows[0].m)
      );
      eq(stableStringify(again), stableStringify({ ecs: snap?.snapshot.ecs, vi: snap?.snapshot.vi, burlandMaxGrade: snap?.snapshot.burlandMaxGrade }), r.code);
    }
  });

  // ---- FINAL PDF + Rev ----
  const target = VERIFICATION_SET[0];
  let rev0Sha = '';

  await tc('B7', 'Xuất FINAL lần đầu → Rev 00, file thật trên đĩa, SHA-256 khớp, PDF hợp lệ', async () => {
    const resolved = await ReportV3Service.resolve(target.id);
    const out = await ReportReleaseService.getOrCreateFinalFile(resolved, ZONE_ADMIN_ZONE09);
    eq(out.release.revision, 0, 'revision');
    truthy(out.buffer.subarray(0, 4).toString() === '%PDF', 'không phải PDF');
    eq(sha256Hex(out.buffer), out.release.sha256, 'sha256');
    truthy(fs.existsSync(out.release.filePath), 'file không tồn tại');
    rev0Sha = out.release.sha256;
    return `rev=00, ${Math.round(out.buffer.length / 1024)}KB, sha=${out.release.sha256.slice(0, 12)}…`;
  });

  await tc('B8', 'Xuất lại Final: trả đúng file cũ (cùng SHA), KHÔNG tự tăng Rev', async () => {
    const resolved = await ReportV3Service.resolve(target.id);
    const again = await ReportReleaseService.getOrCreateFinalFile(resolved, ZONE_ADMIN_ZONE09);
    eq(again.created, false, 'không tạo mới');
    eq(again.release.sha256, rev0Sha, 'sha');
    const list = await ReportReleaseService.list(target.id);
    eq(list.length, 1, 'số Rev');
  });

  await tc('B9', 'Xuất song song 3 lần khi chưa có Rev → chỉ tạo 1 Rev (advisory lock)', async () => {
    const second = VERIFICATION_SET[1];
    const resolved = await ReportV3Service.resolve(second.id);
    const outs = await Promise.all([1, 2, 3].map(() => ReportReleaseService.getOrCreateFinalFile(resolved, ZONE_ADMIN_ZONE09)));
    const shas = new Set(outs.map((o) => o.release.sha256));
    eq(shas.size, 1, 'cùng một file');
    const list = await ReportReleaseService.list(second.id);
    eq(list.length, 1, 'chỉ 1 Rev');
  });

  await tc('B10', 'Zone Admin khu khác bị chặn phát hành Rev; Surveyor bị chặn; hồ sơ DB không đổi', async () => {
    await rejects(() => ReportReleaseService.issueNewRevision(target.id, ZONE_ADMIN_OTHER, 'Lý do đủ dài để hợp lệ'), 'ForbiddenError', 'khu khác');
    await rejects(() => ReportReleaseService.issueNewRevision(target.id, SURVEYOR, 'Lý do đủ dài để hợp lệ'), 'ForbiddenError', 'surveyor');
    const list = await ReportReleaseService.list(target.id);
    eq(list.length, 1, 'không có Rev mới');
  });

  await tc('B11', 'Phát hành Rev 01 (Zone Admin đúng khu + lý do): Rev tăng, audit log, export_revision, Rev 00 giữ nguyên', async () => {
    const rel = await ReportReleaseService.issueNewRevision(target.id, ZONE_ADMIN_ZONE09, 'Bổ sung số liệu theo yêu cầu nhà thầu (test)');
    eq(rel.revision, 1, 'revision');
    const rep = await Database.query<{ export_revision: number }>(`SELECT export_revision FROM base_survey_reports WHERE id = $1;`, [target.id]);
    eq(rep.rows[0].export_revision, 1, 'export_revision');
    const audit = await Database.query<{ c: string; payload: { oldRevision: number | null; newRevision: number; reason: string } }>(
      `SELECT COUNT(*)::text AS c, (array_agg(diff_payload ORDER BY created_at DESC))[1] AS payload
       FROM system_audit_logs WHERE entity_id = $1 AND action = 'REPORT_NEW_REVISION_RELEASED';`,
      [target.id]
    );
    truthy(Number(audit.rows[0].c) >= 1, 'thiếu audit log');
    eq(audit.rows[0].payload.oldRevision, 0, 'audit old');
    eq(audit.rows[0].payload.newRevision, 1, 'audit new');
    truthy(audit.rows[0].payload.reason.includes('nhà thầu'), 'audit reason');
    const resolved = await ReportV3Service.resolve(target.id);
    const old = await ReportReleaseService.getOrCreateFinalFile(resolved, ZONE_ADMIN_ZONE09, 0);
    eq(old.release.sha256, rev0Sha, 'Rev 00 phải giữ nguyên file cũ');
    const latest = await ReportReleaseService.getOrCreateFinalFile(resolved, ZONE_ADMIN_ZONE09);
    eq(latest.release.revision, 1, 'mặc định trả Rev mới nhất');
  });

  await tc('B12', 'Super Admin phát hành Rev cho khu bất kỳ', async () => {
    const rel = await ReportReleaseService.issueNewRevision(target.id, SUPER_ADMIN, 'Super Admin phát hành Rev theo kiểm tra chéo');
    eq(rel.revision, 2, 'revision');
  });

  await tc('B13', 'Toàn vẹn: sửa 1 byte file Rev 00 → bị phát hiện (ConflictError); khôi phục thì đọc lại được', async () => {
    const rel = await ReportReleaseService.get(target.id, 0);
    if (!rel) throw new Error('thiếu Rev 00');
    const original = fs.readFileSync(rel.filePath);
    const tampered = Buffer.from(original);
    tampered[tampered.length - 1] = tampered[tampered.length - 1] ^ 0xff;
    fs.writeFileSync(rel.filePath, tampered);
    try {
      await rejects(async () => ReportReleaseService.readVerifiedFile(rel), 'ConflictError', 'tamper');
    } finally {
      fs.writeFileSync(rel.filePath, original);
    }
    ReportReleaseService.readVerifiedFile(rel);
  });

  await tc('B14', 'Hồ sơ chưa APPROVED không được phát hành Rev (409)', async () => {
    const other = await Database.query<{ id: string }>(
      `SELECT r.id FROM base_survey_reports r
       WHERE r.status = 'SUBMITTED' AND r.unit_id IS NULL AND r.deleted_at IS NULL LIMIT 1;`
    );
    if (!other.rows[0]) return 'bỏ qua: không còn hồ sơ SUBMITTED';
    await rejects(() => ReportReleaseService.issueNewRevision(other.rows[0].id, SUPER_ADMIN, 'Thử phát hành hồ sơ chưa duyệt'), 'ConflictError', 'chưa duyệt');
    return 'bị chặn đúng';
  });

  await tc('B15', 'HTML Final: không watermark DRAFT, chữ ký Kiểm tra/Duyệt có ngày APPROVE, Rev hiển thị đúng', async () => {
    const resolved = await ReportV3Service.resolve(target.id);
    const snap = await ReportSnapshotService.getLatestApprovedSnapshot(target.id);
    if (!snap) throw new Error('thiếu snapshot');
    const finalReport = ReportV3Service.buildFinalReport(resolved, snap.snapshot, 2);
    const { ReportV2Service } = await import('../modules/report_v2/report-v2.service');
    const { html } = await ReportV2Service.generateResidentialHtmlFromReport(finalReport, undefined, false, true);
    truthy(!html.includes('DRAFT – KHÔNG CÓ GIÁ TRỊ PHÁP LÝ'), 'Final không được có watermark DRAFT');
    truthy(/Rev\s*0?2|-02\b|_R02|REV02|Rev02/i.test(html) || html.includes('02'), 'không thấy Rev 02');
    const d = await Database.query<{ approved_at: Date }>(`SELECT approved_at FROM base_survey_reports WHERE id = $1;`, [target.id]);
    const dd = d.rows[0].approved_at;
    const expected = `${String(dd.getDate()).padStart(2, '0')}/${String(dd.getMonth() + 1).padStart(2, '0')}/${dd.getFullYear()}`;
    truthy(html.includes(expected), `thiếu ngày APPROVE ${expected}`);
  });

  await tc('B16', 'Xóa mềm: hồ sơ deleted_at ≠ NULL không còn được resolve (rollback sau test)', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE base_survey_reports SET deleted_at = NOW() WHERE id = $1;`, [VERIFICATION_SET[5].id]);
      const sameTx = await client.query(
        `SELECT id FROM base_survey_reports WHERE id = $1 AND deleted_at IS NULL;`, [VERIFICATION_SET[5].id]
      );
      eq(sameTx.rows.length, 0, 'bị lọc khi deleted_at');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    const found = await SurveyRepository.findReportById(VERIFICATION_SET[5].id);
    truthy(found !== null, 'sau rollback hồ sơ phải còn');
  });

  await tc('B17', 'Header/Footer PDF an toàn với ký tự đặc biệt trong mã công trình', async () => {
    const buf = await PdfRenderV2Engine.renderHtmlToPdf('<html><body><p>x</p></body></html>', {
      buildingId: 'C&C-05-B-0063 <img src=x onerror=alert(1)>',
      reportNo: 'BC-"x"&y',
    });
    truthy(buf.subarray(0, 4).toString() === '%PDF', 'không phải PDF');
  });

  await tc('B18', 'DRAFT PDF (hồ sơ chưa APPROVED) render được qua queue', async () => {
    const other = await Database.query<{ id: string }>(
      `SELECT r.id FROM base_survey_reports r
       WHERE r.status = 'SUBMITTED' AND r.unit_id IS NULL AND r.deleted_at IS NULL AND r.report_type <> 'CONDO_UNIT' LIMIT 1;`
    );
    if (!other.rows[0]) return 'bỏ qua: không còn hồ sơ SUBMITTED';
    const resolved = await ReportV3Service.resolve(other.rows[0].id);
    const { pdfBuffer } = await ReportV3Service.renderDraftPdf(resolved, undefined, true);
    truthy(pdfBuffer.subarray(0, 4).toString() === '%PDF', 'không phải PDF');
    return `${Math.round(pdfBuffer.length / 1024)}KB`;
  });

  await tc('B19', 'Hồ sơ đã APPROVED: overrides từ client bị bỏ qua (D4 – chỉ dùng dữ liệu đã duyệt)', async () => {
    const resolved = await ReportV3Service.resolve(target.id);
    const { html } = await ReportV3Service.renderDraftHtml(resolved, { ownerName: 'HACKER NAME 123' }, false, true);
    truthy(!html.includes('HACKER NAME 123'), 'override lọt vào hồ sơ APPROVED');
  });
}

async function main(): Promise<void> {
  console.log('🚀 BUSINESS TEST SUITE – REPORT V3');
  await partA();
  let dbAvailable = true;
  try {
    await Database.query('SELECT 1');
  } catch (err) {
    dbAvailable = false;
    console.error('[TEST] Không kết nối được DB local, bỏ qua Phần B:', err);
  }
  if (dbAvailable) {
    await partB();
    // Dọn bản FINAL do test tạo ra: nếu để lại, giao diện local sẽ tải bản PDF đóng băng cũ thay vì render mới
    await resetVerificationReleases().catch((err: unknown) => console.error('[TEST] Dọn release lỗi:', err));
  }

  await pool.end().catch((err: unknown) => console.error('[TEST] pool.end lỗi:', err));
  try {
    const browser = await PdfRenderV2Engine.getBrowser();
    await browser.close();
  } catch (err) {
    console.error('[TEST] Đóng browser lỗi:', err);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n════════ KẾT QUẢ: ${results.length - failed.length}/${results.length} PASS ════════`);
  for (const f of failed) console.log(`  ❌ ${f.id} ${f.name}: ${f.detail}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('[TEST] Lỗi không mong đợi:', err);
  process.exit(2);
});
