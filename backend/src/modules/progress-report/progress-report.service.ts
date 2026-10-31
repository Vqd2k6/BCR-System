import { Database } from '../../database/db';
import type { ProgressDataSource } from './data/progress.datasource';
import { PgProgressDataSource } from './data/pg-progress.datasource';
import { ProgressConfigProvider } from './config/config.provider';
import type { ProgressReportConfig } from './config/config.schema';
import { getTemplate, DEFAULT_TEMPLATE_ID } from './columns/template.registry';
import type { ProgressTemplate, ResolvedTable } from './columns/column.types';
import { normalizeRecord } from './rules/record.normalizer';
import { arrangeRecords } from './rules/record.arranger';
import { isInWindow, resolveTimeWindow, vnDateString, formatVnDate, type TimeWindow } from './rules/time-window';
import { calculateSummary } from './summary/summary.calculator';
import { getRenderer } from './render/renderer.registry';
import type { RenderedFile, RenderSheet } from './render/renderer.types';
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

/** Dữ liệu dùng chung khi dựng 1 hoặc nhiều bảng của cùng một lần xuất. */
interface BuildScope {
  template: ProgressTemplate;
  config: ProgressReportConfig;
  version: number | null;
  universe: ProgressRecord[];
  window: TimeWindow;
}

const SINGLE_SHEET_NAME = 'Trang tính1';

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
    return (name || zoneId || 'CHƯA PHÂN KHU').toUpperCase();
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

  private async loadScope(filter: ProgressFilter, now: Date): Promise<BuildScope> {
    const template = getTemplate(filter.templateId);
    if (!template) throw new BadRequestError(`Template báo cáo không tồn tại: ${filter.templateId}`);

    const { config, version } = await ProgressConfigProvider.getActive();
    const raw = await this.dataSource.fetchRows({ zoneId: filter.zoneId });
    const universe = raw.map((r: RawProgressRow) => normalizeRecord(r, config));
    return { template, config, version, universe, window: resolveTimeWindow(filter, now) };
  }

  /** Dựng bảng cho 1 zone hoặc 'ALL' từ tập universe đúng phạm vi đó. */
  private async buildTable(scope: BuildScope, filter: ProgressFilter, zoneId: string, universe: ProgressRecord[], now: Date): Promise<BuildResult> {
    const { template, config, version, window } = scope;
    const filtered = universe.filter((r: ProgressRecord) => {
      if (filter.timeMode === 'ALL_TIME') return config.includeNotSurveyedRows || isTouched(r);
      return isTouched(r) && isInWindow(r.activityDates, window);
    });
    const { ordered, dividers } = arrangeRecords(filtered);

    const multiZone = zoneId === 'ALL';
    const stationLabel = await this.resolveStationLabel(zoneId, universe[0]);
    const summary = template.includeSummary ? calculateSummary(universe, filtered, multiZone, config) : null;

    const table: ResolvedTable = {
      templateId: template.id,
      title: template.buildTitle({ config, stationLabel, periodLabel: window.label }),
      periodLabel: window.label,
      generatedAtLabel: `${formatVnDate(vnDateString(now))} ${new Date(now.getTime() + 7 * 3600_000).toISOString().slice(11, 16)}`,
      legend: template.legend(config),
      columns: template.columns.map(({ key, header, group, width, numFmt, align }) => ({ key, header, group, width, numFmt, align })),
      rows: this.resolveRows(template, ordered, config),
      dividers,
      summary,
      colors: config.colors,
    };
    return { table, records: ordered, configVersion: version, stationLabel };
  }

  async build(filter: ProgressFilter, now: Date = new Date()): Promise<BuildResult> {
    const scope = await this.loadScope(filter, now);
    return this.buildTable(scope, filter, filter.zoneId, scope.universe, now);
  }

  /** Toàn tuyến: mỗi zone 1 sheet, nội dung đúng như xuất riêng zone đó. */
  private async buildSheets(filter: ProgressFilter, now: Date): Promise<{ sheets: RenderSheet[]; stationLabel: string }> {
    const scope = await this.loadScope(filter, now);
    const zoneIds = Array.from(new Set(scope.universe.map((r) => r.zoneId)));
    if (filter.zoneId !== 'ALL' || zoneIds.length === 0) {
      const { table, stationLabel } = await this.buildTable(scope, filter, filter.zoneId, scope.universe, now);
      return { sheets: [{ name: SINGLE_SHEET_NAME, table }], stationLabel };
    }
    const sheets: RenderSheet[] = [];
    for (const zoneId of zoneIds) {
      const zoneUniverse = scope.universe.filter((r) => r.zoneId === zoneId);
      const { table, stationLabel } = await this.buildTable(scope, filter, zoneId, zoneUniverse, now);
      sheets.push({ name: stationLabel, table });
    }
    return { sheets, stationLabel: await this.resolveStationLabel('ALL', undefined) };
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
    const { sheets, stationLabel } = await this.buildSheets(filter, now);
    const file = await renderer.render(sheets);
    const modeSuffix =
      filter.timeMode === 'TODAY'
        ? `Ngay_${vnDateString(now)}`
        : filter.timeMode === 'DATE_RANGE'
          ? `${filter.fromDate}_den_${filter.toDate}`
          : `LuyKe_${vnDateString(now)}`;
    const filename = `TienDo_KhaoSat_${stationLabel.replace(/\s+/g, '_')}_${modeSuffix}`;
    return { file, filename, rowCount: sheets.reduce((sum, s) => sum + s.table.rows.length, 0) };
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

