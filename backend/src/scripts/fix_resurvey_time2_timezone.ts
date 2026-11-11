/**
 * Sửa Time 2 (giờ in watermark) của ảnh chụp lại đã lưu sai múi giờ.
 * Lỗi gốc: phiên nộp trên máy chủ chạy UTC → chữ giờ lệch –7 giờ (15:49:55 thành 08:49:55). Code đã sửa ở e02788a.
 *
 * Tính lại theo dòng thời gian ảnh GỐC (không áp lớp phủ chụp lại), giờ Việt Nam:
 *   - REPLACE (nguồn ORIGINAL)       : = chữ giờ đang in của ảnh gốc ở ô đó.
 *   - ADD_EXTRA (nguồn INTERPOLATED) : = giờ chèn giữa 2 ảnh kề (computeExtraTimes).
 *   - Giờ Admin chỉnh tay (ADMIN) và DATE_ONLY: giữ nguyên.
 * Chỉ đổi những mục có chữ khác; ghi system_audit_logs (trước/sau); hồ sơ APPROVED đóng băng lại snapshot chờ phát hành.
 *
 * Chạy thử (mặc định, không ghi):  npx ts-node --transpile-only src/scripts/fix_resurvey_time2_timezone.ts
 * Ghi thật:                        npx ts-node --transpile-only src/scripts/fix_resurvey_time2_timezone.ts --apply --user=<uuid admin>
 * Giới hạn một hồ sơ:              thêm --report=<report uuid>
 */
import { Database } from '../database/db';
import { PhotoResurveyRepository } from '../modules/photo-resurvey/photo-resurvey.repository';
import { computeExtraTimes, parseWatermarkText } from '../modules/photo-resurvey/photo-resurvey.rules';
import { PhotoResurveyService } from '../modules/photo-resurvey/photo-resurvey.service';
import type { ResurveyTime2Source } from '../modules/photo-resurvey/photo-resurvey.types';
import { ReportSnapshotService } from '../modules/report/snapshot/report-snapshot.service';

interface Change {
  itemId: string;
  label: string;
  before: string | null;
  after: { text: string; at: Date | null; source: ResurveyTime2Source };
}

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const userId = arg('user');
  const onlyReport = arg('report');
  if (apply && !userId) throw new Error('--apply cần --user=<uuid admin> để ghi nhật ký');

  const sessions = await Database.query<{ id: string; report_id: string; status: string; code: string | null }>(
    `SELECT s.id, s.report_id, s.status, p.project_parcel_code AS code
       FROM survey_photo_resurveys s
       JOIN base_survey_reports r ON r.id = s.report_id
       JOIN parcels p ON p.id = r.parcel_id
      WHERE s.deleted_at IS NULL AND s.status IN ('SUBMITTED', 'APPROVED')
        AND ($1::uuid IS NULL OR s.report_id = $1::uuid)
      ORDER BY p.project_parcel_code, s.created_at;`,
    [onlyReport]
  );

  let total = 0;
  for (const s of sessions.rows) {
    const items = await PhotoResurveyRepository.getActiveItems(s.id);
    const targets = items.filter((i) => i.time2Source === 'ORIGINAL' || i.time2Source === 'INTERPOLATED');
    if (targets.length === 0) continue;

    const base = await PhotoResurveyService.loadCurrentState(s.report_id, { withResurvey: false });
    const slotByKey = new Map(base.slots.map((x) => [x.photoKey, x]));
    const extras = items
      .filter((i) => i.action === 'ADD_EXTRA')
      .sort((a, b) => (a.extraIndex ?? 0) - (b.extraIndex ?? 0))
      .map((i) => ({ itemId: i.id, slotCode: i.slotCode }));
    const extraTimes = extras.length > 0 ? computeExtraTimes(base.timeline, extras, base.surveyDateText).times : new Map();

    const changes: Change[] = [];
    for (const it of targets) {
      let after: Change['after'] | null = null;
      if (it.action === 'REPLACE' && it.time2Source === 'ORIGINAL' && it.photoKey) {
        const text = slotByKey.get(it.photoKey)?.dateTimeText || base.surveyDateText;
        const parsed = parseWatermarkText(text);
        after = { text, at: parsed.hasTime ? parsed.at : null, source: 'ORIGINAL' };
      } else if (it.action === 'ADD_EXTRA' && it.time2Source === 'INTERPOLATED') {
        const t = extraTimes.get(it.id);
        if (t) after = { text: t.text, at: t.at, source: t.source };
      }
      if (after && after.text && after.text !== it.time2Text) {
        changes.push({ itemId: it.id, label: `${it.action} ${it.photoKey ?? `${it.slotCode}#${it.extraIndex}`}`, before: it.time2Text, after });
      }
    }
    if (changes.length === 0) continue;
    total += changes.length;
    console.log(`\n${s.code ?? s.report_id} – phiên ${s.id} (${s.status})`);
    for (const c of changes) console.log(`  ${c.label.padEnd(18)} ${c.before ?? '---'}  →  ${c.after.text}`);

    if (!apply || !userId) continue;
    await Database.transaction(async (client) => {
      for (const c of changes) await PhotoResurveyRepository.updateTime2(client, c.itemId, c.after);
      await PhotoResurveyRepository.writeAuditLog(client, s.id, userId, 'PHOTO_RESURVEY_TIME2_TZ_FIX', {
        reportId: s.report_id,
        reason: 'Time 2 lưu lệch –7 giờ do máy chủ chạy UTC (sửa code e02788a)',
        items: changes.map((c) => ({ itemId: c.itemId, before: c.before, after: c.after.text })),
      });
      const rep = await client.query<{ status: string; approved_at: Date | null; export_revision: number }>(
        `SELECT status::text AS status, approved_at, export_revision FROM base_survey_reports WHERE id = $1 FOR UPDATE;`,
        [s.report_id]
      );
      const row = rep.rows[0];
      if (row?.status === 'APPROVED') {
        await ReportSnapshotService.writeApprovedRelease(
          client, s.report_id, userId, row.approved_at ?? new Date(), 'Sửa giờ in ảnh chụp lại (múi giờ)', row.export_revision ?? 0
        );
      }
    });
    console.log('  ✅ đã ghi');
  }
  console.log(`\n${apply ? 'Đã sửa' : 'Chạy thử – sẽ sửa'} ${total} mục.${apply ? '' : ' Thêm --apply --user=<uuid> để ghi.'}`);
}

main()
  .catch((err: unknown) => {
    console.error('[FixResurveyTime2] Lỗi', err);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
