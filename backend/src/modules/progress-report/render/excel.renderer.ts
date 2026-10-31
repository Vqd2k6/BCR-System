import ExcelJS from 'exceljs';
import type { ResolvedTable } from '../columns/column.types';
import type { CellStyle, SummaryRow } from '../progress-report.types';
import type { ProgressRenderer, RenderedFile, RenderSheet } from './renderer.types';

/**
 * EXCEL RENDERER – vẽ ResolvedTable thành .xlsx bám sát file mẫu:
 * tiêu đề gộp A1:AB3, chú giải Row 5–6, header 2 tầng Row 8–9 (nền #95DCF7),
 * dữ liệu từ Row 11 (xen dòng Phần I/II và dòng tòa mẹ), bảng tổng hợp cuối sheet với công thức % chống chia 0.
 * Mỗi RenderSheet là 1 sheet độc lập; xuất toàn tuyến có nhiều sheet.
 */

const FONT_NAME = 'Times New Roman';
const TITLE_ROW_END = 3;
const PERIOD_ROW = 4;
const LEGEND_START_ROW = 5;
const HEADER_ROW_1 = 8;
const HEADER_ROW_2 = 9;
const DATA_START_ROW = 11;
const SUMMARY_GAP = 3;
const DIVIDER_ROW_HEIGHT = 24;
const DIVIDER_FILLS = { SECTION: 'FFF1F5F9', MASTER: 'FFEDE9FE' } as const;
const MAX_SHEET_NAME_LENGTH = 31;
/** Mã khổ giấy A3 theo chuẩn OOXML (exceljs không khai báo A3 trong const enum PaperSize). */
const EXCEL_PAPER_A3 = 8 as number as ExcelJS.PaperSize;

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

function fill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function styleCell(cell: ExcelJS.Cell, opts: { bold?: boolean; fillArgb?: string; align?: 'left' | 'center' | 'right'; size?: number; border?: boolean; numFmt?: string; italic?: boolean }): void {
  cell.font = { name: FONT_NAME, size: opts.size ?? 11, bold: opts.bold ?? false, italic: opts.italic ?? false };
  cell.alignment = { vertical: 'middle', horizontal: opts.align ?? 'left', wrapText: true };
  if (opts.fillArgb) cell.fill = fill(opts.fillArgb);
  if (opts.border !== false) cell.border = THIN_BORDER;
  if (opts.numFmt) cell.numFmt = opts.numFmt;
}

function mergeAndSet(
  ws: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  value: ExcelJS.CellValue,
  opts: Parameters<typeof styleCell>[1]
): void {
  if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
  const cell = ws.getCell(r1, c1);
  cell.value = value;
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) styleCell(ws.getCell(r, c), opts);
  }
}

/** Tên sheet hợp lệ của Excel: bỏ ký tự cấm, tối đa 31 ký tự, không trùng (không phân biệt hoa thường). */
function uniqueSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/*?:[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_SHEET_NAME_LENGTH).trim() || 'Sheet';
  let candidate = base;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) {
    const suffix = ` (${n})`;
    candidate = `${base.slice(0, MAX_SHEET_NAME_LENGTH - suffix.length).trim()}${suffix}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export class ExcelProgressRenderer implements ProgressRenderer {
  readonly format = 'xlsx';

  async render(sheets: RenderSheet[]): Promise<RenderedFile> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Metro 2 BCS Platform – Progress Report';
    wb.created = new Date();
    wb.calcProperties.fullCalcOnLoad = true;
    const usedNames = new Set<string>();
    for (const sheet of sheets) this.renderSheet(wb, uniqueSheetName(sheet.name, usedNames), sheet.table);

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(arrayBuffer as ArrayBuffer),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    };
  }

  private renderSheet(wb: ExcelJS.Workbook, name: string, table: ResolvedTable): void {
    const ws = wb.addWorksheet(name, {
      views: [{ state: 'frozen', ySplit: HEADER_ROW_2, xSplit: 0 }],
      pageSetup: { orientation: 'landscape', paperSize: EXCEL_PAPER_A3, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    const colCount = table.columns.length;
    table.columns.forEach((c, i) => {
      ws.getColumn(i + 1).width = c.width;
    });

    this.renderTitle(ws, table, colCount);
    this.renderLegend(ws, table);
    this.renderHeader(ws, table);
    const lastDataRow = this.renderRows(ws, table);
    if (table.summary) this.renderSummary(ws, table, lastDataRow + SUMMARY_GAP);
  }

  private renderTitle(ws: ExcelJS.Worksheet, table: ResolvedTable, colCount: number): void {
    mergeAndSet(ws, 1, 1, TITLE_ROW_END, colCount, table.title, { bold: true, size: 16, align: 'center', border: false });
    mergeAndSet(ws, PERIOD_ROW, 1, PERIOD_ROW, colCount, `Kỳ báo cáo: ${table.periodLabel}   |   Ngày xuất: ${table.generatedAtLabel}`, {
      italic: true,
      align: 'center',
      border: false,
    });
  }

  private renderLegend(ws: ExcelJS.Worksheet, table: ResolvedTable): void {
    table.legend.forEach((row, idx) => {
      const r = LEGEND_START_ROW + idx;
      mergeAndSet(ws, r, 1, r, row.labelSpan, row.label, { bold: true, fillArgb: table.colors.legend });
      let col = row.labelSpan + 1;
      for (const item of row.items) {
        const argb = item.colorKey ? table.colors[item.colorKey] : undefined;
        mergeAndSet(ws, r, col, r, col + item.span - 1, item.text, { align: 'center', fillArgb: argb });
        col += item.span;
      }
    });
  }

  private renderHeader(ws: ExcelJS.Worksheet, table: ResolvedTable): void {
    const headerOpts = { bold: true, align: 'center' as const, fillArgb: table.colors.header };
    let i = 0;
    while (i < table.columns.length) {
      const col = table.columns[i];
      if (!col.group) {
        mergeAndSet(ws, HEADER_ROW_1, i + 1, HEADER_ROW_2, i + 1, col.header, headerOpts);
        i += 1;
        continue;
      }
      let j = i;
      while (j + 1 < table.columns.length && table.columns[j + 1].group === col.group) j += 1;
      mergeAndSet(ws, HEADER_ROW_1, i + 1, HEADER_ROW_1, j + 1, col.group, headerOpts);
      for (let k = i; k <= j; k++) {
        mergeAndSet(ws, HEADER_ROW_2, k + 1, HEADER_ROW_2, k + 1, table.columns[k].header, headerOpts);
      }
      i = j + 1;
    }
    ws.getRow(HEADER_ROW_1).height = 30;
    ws.getRow(HEADER_ROW_2).height = 30;
  }

  private renderRows(ws: ExcelJS.Worksheet, table: ResolvedTable): number {
    let r = DATA_START_ROW;
    let nextDivider = 0;
    const writeDividers = (rowIndex: number): void => {
      while (nextDivider < table.dividers.length && table.dividers[nextDivider].beforeRowIndex === rowIndex) {
        const divider = table.dividers[nextDivider];
        mergeAndSet(ws, r, 1, r, table.columns.length, divider.label, {
          bold: true,
          size: divider.kind === 'SECTION' ? 12 : 11,
          fillArgb: DIVIDER_FILLS[divider.kind],
        });
        ws.getRow(r).height = DIVIDER_ROW_HEIGHT;
        r += 1;
        nextDivider += 1;
      }
    };

    table.rows.forEach((row, idx) => {
      writeDividers(idx);
      row.values.forEach((value, c) => {
        const colDef = table.columns[c];
        const extra: CellStyle | undefined = row.styles[c];
        const cell = ws.getCell(r, c + 1);
        cell.value = value;
        styleCell(cell, {
          align: extra?.align ?? colDef.align ?? 'left',
          fillArgb: extra?.fillArgb,
          bold: extra?.bold,
          numFmt: value instanceof Date || typeof value === 'number' ? extra?.numFmt ?? colDef.numFmt : undefined,
        });
      });
      r += 1;
    });
    return Math.max(r - 1, DATA_START_ROW);
  }

  private renderSummary(ws: ExcelJS.Worksheet, table: ResolvedTable, startRow: number): void {
    const summary = table.summary;
    if (!summary) return;
    const h1 = startRow;
    const h2 = startRow + 1;
    const head = { bold: true, align: 'center' as const, fillArgb: table.colors.header };
    mergeAndSet(ws, h1, 1, h2, 1, 'STT', head);
    mergeAndSet(ws, h1, 2, h2, 2, 'KHU VỰC KS', head);
    mergeAndSet(ws, h1, 3, h2, 3, 'SỐ LƯỢNG TÒA NHÀ HOẶC CĂN HỘ CẦN KHẢO SÁT', head);
    const metricHeaders: Array<{ text: string; argb?: string }> = [
      { text: 'SỐ LƯỢNG TÒA NHÀ HOẶC CĂN HỘ KHẢO SÁT ĐƯỢC' },
      { text: 'SỐ LƯỢNG TÒA NHÀ HOẶC CĂN HỘ KHÔNG THỂ TIẾP CẬN', argb: table.colors.INACCESSIBLE },
      { text: 'SỐ LƯỢNG TÒA NHÀ HOẶC CĂN HỘ CÓ THÔNG TIN MÓNG VÀ KẾT CẤU' },
      { text: 'SỐ LƯỢNG TÒA NHÀ HOẶC CĂN HỘ CẦN THEO DÕI', argb: table.colors.MONITOR },
      { text: 'SỐ LƯỢNG TÒA NHÀ HOẶC CĂN HỘ NGUY CƠ CAO', argb: table.colors.HIGH_RISK },
    ];
    metricHeaders.forEach((m, idx) => {
      const c = 4 + idx * 2;
      mergeAndSet(ws, h1, c, h1, c + 1, m.text, { ...head, fillArgb: m.argb ?? table.colors.header });
      mergeAndSet(ws, h2, c, h2, c, 'Số Lượng', head);
      mergeAndSet(ws, h2, c + 1, h2, c + 1, '%', head);
    });
    mergeAndSet(ws, h1, 14, h2, 18, 'GHI CHÚ', head);
    ws.getRow(h1).height = 64;
    ws.getRow(h2).height = 30;

    const firstGroupRow = h2 + 1;
    summary.groups.forEach((g, idx) => {
      this.renderSummaryRow(ws, firstGroupRow + idx, idx + 1, g, false, table);
    });
    const totalRow = firstGroupRow + summary.groups.length;
    this.renderSummaryRow(ws, totalRow, null, summary.total, true, table, {
      from: firstGroupRow,
      to: totalRow - 1,
    });
  }

  private renderSummaryRow(
    ws: ExcelJS.Worksheet,
    r: number,
    stt: number | null,
    g: SummaryRow,
    isTotal: boolean,
    table: ResolvedTable,
    sumRange?: { from: number; to: number }
  ): void {
    const base = { align: 'center' as const, bold: isTotal, fillArgb: isTotal ? table.colors.total : undefined };
    if (isTotal) {
      mergeAndSet(ws, r, 1, r, 2, g.label, base);
    } else {
      mergeAndSet(ws, r, 1, r, 1, stt, base);
      mergeAndSet(ws, r, 2, r, 2, g.label, { ...base, align: 'left' });
    }
    const counts = [g.surveyed, g.inaccessible, g.withFoundation, g.monitor, g.highRisk];
    const letter = (c: number): string => ws.getColumn(c).letter;
    const hasRange = isTotal && sumRange && sumRange.to >= sumRange.from;

    const neededCell = ws.getCell(r, 3);
    neededCell.value = hasRange && sumRange
      ? { formula: `SUM(C${sumRange.from}:C${sumRange.to})`, result: g.needed }
      : g.needed;
    styleCell(neededCell, base);

    counts.forEach((count, idx) => {
      const c = 4 + idx * 2;
      const countCell = ws.getCell(r, c);
      countCell.value = hasRange && sumRange
        ? { formula: `SUM(${letter(c)}${sumRange.from}:${letter(c)}${sumRange.to})`, result: count }
        : count;
      styleCell(countCell, base);
      const pctCell = ws.getCell(r, c + 1);
      const pctResult = g.needed === 0 ? '-' : count / g.needed;
      pctCell.value = { formula: `IF(C${r}=0,"-",${letter(c)}${r}/C${r})`, result: pctResult };
      styleCell(pctCell, { ...base, numFmt: '0.0%' });
    });
    mergeAndSet(ws, r, 14, r, 18, null, base);
  }
}
