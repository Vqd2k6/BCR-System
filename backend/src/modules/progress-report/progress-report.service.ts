import { Database } from '../../database/db';
import type { ProgressDataSource } from './data/progress.datasource';
import { PgProgressDataSource } from './data/pg-progress.datasource';
import { ProgressConfigProvider } from './config/config.provider';
import type { ProgressReportConfig } from './config/config.schema';
import { getTemplate, DEFAULT_TEMPLATE_ID } from './columns/template.registry';
import type { ProgressTemplate, ResolvedTable } from './columns/column.types';
import { normalizeRecord } from './rules/record.normalizer';
import { isInWindow, resolveTimeWindow, vnDateString, formatVnDate } from './rules/time-window';
import { calculateSummary } from './summary/summary.calculator';
import { getRenderer } from './render/renderer.registry';
import type { RenderedFile } from './render/renderer.types';
import type { ProgressFilter, ProgressPreview, ProgressRecord, RawProgressRow } from './progress-report.types';
import { BadRequestError } from '../../common/errors/problem-details';

/**
 * ProgressReportService – CHỈ ĐIỀU PHỐI 3 lớp: DataSource → Rules → Renderer.
 * Không chứa logic nghiệp vụ chi tiết (nằm trong rules/ và columns/).
 */

interface BuildResult {
  table: ResolvedTable;
  records: ProgressRecord[];
  configVersion: number | null;
  stationLabel: string;
}

function isTouched(r: ProgressRecord): boolean {
  return r.activityDates.length > 0 || r.condition === 'INACCESSIBLE' || r.surveyProgress !== null;
}

export class ProgressReportService {
  constructor(private readonly dataSource: ProgressDataSource = new PgProgressDataSource()) {}

  private async resolveStationLabel(zoneId: string, sample: ProgressRecord | undefined): Promise<string> {
    if (zoneId === 'ALL') return 'TOÀN TUYẾN';
    const code = sample?.stationCode;
    if (code && code.startsWith('ST')) return `GA ${code}`;
    const name = await this.dataSource.fetchZoneName(zoneId);
    return (name || zoneId).toUpperCase();
  }

  private resolveRows(template: ProgressTemplate, records: ProgressRecord[], config: ProgressReportConfig): ResolvedTable['rows'] {
    return records.map((record, rowIndex) => {
      const ctx = { config, rowIndex };
      return {
        values: template.columns.map((c) => c.resolve(record, ctx)),
        styles: template.columns.map((c) => (c.style ? c.style(record, ctx) : undefined)),
      };
    });
  }

  async build(filter: ProgressFilter, now: Date = new Date()): Promise<BuildResult> {
    const template = getTemplate(filter.templateId);
    if (!template) throw new BadRequestError(`Template báo cáo không tồn tại: ${filter.templateId}`);

    const { config, version } = await ProgressConfigProvider.getActive();
    const raw = await this.dataSource.fetchRows({ zoneId: filter.zoneId });
    const universe = raw.map((r: RawProgressRow) => normalizeRecord(r, config));
    const window = resolveTimeWindow(filter, now);

    const filtered = universe.filter((r: ProgressRecord) => {
      if (filter.timeMode === 'ALL_TIME') return config.includeNotSurveyedRows || isTouched(r);
      return isTouched(r) && isInWindow(r.activityDates, window);
    });

    const multiZone = filter.zoneId === 'ALL';
    const stationLabel = await this.resolveStationLabel(filter.zoneId, universe[0]);
    const summary = template.includeSummary ? calculateSummary(universe, filtered, multiZone, config) : null;

    const table: ResolvedTable = {
      templateId: template.id,
      title: template.buildTitle({ config, stationLabel, periodLabel: window.label }),
      periodLabel: window.label,
      generatedAtLabel: `${formatVnDate(vnDateString(now))} ${new Date(now.getTime() + 7 * 3600_000).toISOString().slice(11, 16)}`,
      legend: template.legend(config),
      columns: template.columns.map(({ key, header, group, width, numFmt, align }) => ({ key, header, group, width, numFmt, align })),
      rows: this.resolveRows(template, filtered, config),
      summary,
      colors: config.colors,
    };
    return { table, records: filtered, configVersion: version, stationLabel };
  }

  async preview(filter: ProgressFilter, sampleSize = 50): Promise<ProgressPreview> {
    const { table, configVersion } = await this.build(filter);
    const sampleRows = table.rows.slice(0, sampleSize).map((row) => {
      const obj: Record<string, string | number | Date | null> = {};
      table.columns.forEach((c, i) => {
        obj[c.key] = row.values[i];
      });
      return obj;
    });
    return {
      title: table.title,
      periodLabel: table.periodLabel,
      generatedAt: new Date().toISOString(),
      totalRows: table.rows.length,
      summary: table.summary ?? { groups: [], total: { label: 'TỔNG SỐ LƯỢNG', needed: 0, surveyed: 0, inaccessible: 0, withFoundation: 0, monitor: 0, highRisk: 0 } },
      sampleRows,
      columns: table.columns.map(({ key, header, group }) => ({ key, header, group })),
      configVersion,
    };
  }

  async export(filter: ProgressFilter, format: string): Promise<{ file: RenderedFile; filename: string; rowCount: number }> {
    const renderer = getRenderer(format);
    if (!renderer) throw new BadRequestError(`Định dạng xuất không hỗ trợ: ${format}`);
    const now = new Date();
    const { table, stationLabel } = await this.build(filter, now);
    const file = await renderer.render(table);
    const modeSuffix =
      filter.timeMode === 'TODAY'
        ? `Ngay_${vnDateString(now)}`
        : filter.timeMode === 'DATE_RANGE'
          ? `${filter.fromDate}_den_${filter.toDate}`
          : `LuyKe_${vnDateString(now)}`;
    const filename = `TienDo_KhaoSat_${stationLabel.replace(/\s+/g, '_')}_${modeSuffix}`;
    return { file, filename, rowCount: table.rows.length };
  }

  /** Audit log mỗi lần xuất – không chặn luồng tải file nếu ghi log lỗi, nhưng luôn log ra console. */
  static async recordExportAudit(userId: string, filter: ProgressFilter, rowCount: number, clientIp: string | undefined): Promise<void> {
    try {
      await Database.query(
        `INSERT INTO system_audit_logs (entity_type, entity_id, action, performed_by_user_id, client_ip, diff_payload)
         VALUES ($1, $2, $3, $2, $4, $5);`,
        ['PROGRESS_REPORT_EXPORT', userId, 'EXPORT_XLSX', clientIp ?? null, JSON.stringify({ ...filter, rowCount })]
      );
    } catch (err: unknown) {
      console.error('[ProgressReport] Không ghi được audit log xuất báo cáo:', err);
    }
  }
}

export const DEFAULT_FILTER_TEMPLATE = DEFAULT_TEMPLATE_ID;

