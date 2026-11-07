/**
 * CHỈ ĐỌC. Đối chiếu Excel tiến độ với danh sách Xuất biên bản hiện trường theo từng Zone.
 *   npx ts-node --transpile-only -r dotenv/config src/scripts/report_minutes_progress_reconcile.ts [ZONE_07,ZONE_09]
 * Thoát mã 1 khi có dòng Excel ghi VẮNG mà vẫn có biên bản, hoặc tập dòng hai bên khác nhau.
 */
import { Database, pool } from '../database/db';
import { PgProgressDataSource } from '../modules/progress-report/data/pg-progress.datasource';
import { isInaccessible, siteCaseOf } from '../modules/progress-report/rules/condition.classifier';
import { mapSurveyProgress } from '../modules/progress-report/rules/survey-status.mapper';
import { MinutesExportService } from '../modules/report/services/minutes-export.service';

const TAG = '[MinutesReconcile]';
const ISSUES = {
  absentWithMinutes: 'Excel VẮNG nhưng có biên bản',
  minutesAbsentOnly: 'Biên bản coi vắng nhưng Excel không',
  siteCaseMismatch: 'Đang thi công / Đất trống lệch giữa Excel và biên bản',
  differentReport: 'Hai bên chọn hồ sơ khác nhau',
  surveyedNoMinutes: 'Excel đã khảo sát nhưng chưa có ảnh biên bản',
  onlyInExcel: 'Có trong Excel, không có trong DS biên bản',
  onlyInMinutes: 'Có trong DS biên bản, không có trong Excel',
} as const;
type IssueKey = keyof typeof ISSUES;

async function listZones(arg: string | undefined): Promise<string[]> {
  if (arg) return arg.split(',').map((z) => z.trim().toUpperCase()).filter(Boolean);
  const res = await Database.query<{ zone_id: string }>(
    `SELECT DISTINCT zone_id FROM parcels WHERE lifecycle_status = 'ACTIVE' AND zone_id IS NOT NULL ORDER BY zone_id;`
  );
  return res.rows.map((r) => r.zone_id);
}

async function main(): Promise<number> {
  const datasource = new PgProgressDataSource();
  let hardFailures = 0;

  for (const zone of await listZones(process.argv[2])) {
    const rows = await datasource.fetchRows({ zoneId: zone });
    const minutes = await MinutesExportService.listZoneMinutes(zone);
    const minutesByKey = new Map(minutes.map((m) => [m.key, m]));
    const excelKeys = new Set(rows.map((r) => r.unitId ?? r.parcelId));

    const counts: Record<string, number> = {};
    const samples = new Map<IssueKey, string[]>();
    const bump = (key: string) => (counts[key] = (counts[key] ?? 0) + 1);
    const flag = (issue: IssueKey, detail: string) => {
      bump(`!! ${ISSUES[issue]}`);
      const list = samples.get(issue) ?? [];
      if (list.length < 8) list.push(detail);
      samples.set(issue, list);
    };

    for (const row of rows) {
      const code = `${row.projectParcelCode}${row.unitCode ? ` ${row.unitCode}` : ''}`;
      const item = minutesByKey.get(row.unitId ?? row.parcelId);
      const absent = isInaccessible(row);
      const progress = absent ? 'VẮNG' : mapSurveyProgress(row) ?? 'CHƯA KHẢO SÁT';
      bump(`Excel · ${progress}`);
      if (!item) {
        flag('onlyInExcel', code);
        continue;
      }
      bump(`Biên bản · ${item.category}`);
      if (absent && item.category === 'MINUTES') flag('absentWithMinutes', `${code} (${item.reportStatus}) ${item.note ?? ''}`);
      if (!absent && item.category === 'ABSENTEE') flag('minutesAbsentOnly', `${code} Excel=${progress}`);
      const siteCase = siteCaseOf(row);
      if (Boolean(siteCase) !== (item.category === 'SITE_CASE')) {
        flag('siteCaseMismatch', `${code} Excel=${siteCase ?? '-'} biên bản=${item.category}`);
      }
      if (item.reportId && row.reportId && item.reportId !== row.reportId) {
        flag('differentReport', `${code} Excel=${row.reportId}(${row.reportStatus}) biên bản=${item.reportId}(${item.reportStatus})`);
      }
      if (!absent && !siteCase && (progress === 'SURVEY_DONE_REPORTING' || progress === 'REPORT_DONE') && item.category !== 'MINUTES') {
        flag('surveyedNoMinutes', `${code} (${row.reportStatus}) ${item.note ?? ''}`);
      }
    }
    for (const item of minutes) {
      if (!excelKeys.has(item.key)) flag('onlyInMinutes', `${item.parcelCode} ${item.unitCode ?? ''} ${item.category}`);
    }

    hardFailures += (samples.get('siteCaseMismatch')?.length ?? 0) + (samples.get('absentWithMinutes')?.length ?? 0) + (samples.get('onlyInExcel')?.length ?? 0) + (samples.get('onlyInMinutes')?.length ?? 0);

    console.log(`\n===== ${zone}: Excel ${rows.length} dòng | DS biên bản ${minutes.length} dòng =====`);
    Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, value]) => console.log(`  ${key.padEnd(52)} ${value}`));
    for (const [issue, list] of samples) {
      console.log(`  -- ${ISSUES[issue]}:`);
      list.forEach((line) => console.log(`     ${line}`));
    }
  }

  console.log(`\n${TAG} ${hardFailures === 0 ? 'KHỚP: không có dòng vắng nào có biên bản, tập dòng hai bên trùng nhau.' : `CÓ ${hardFailures} vi phạm cần xử lý.`}`);
  return hardFailures === 0 ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error(`${TAG} Thất bại:`, err);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end().catch((err: unknown) => console.error(`${TAG} Không đóng được pool:`, err));
  });
