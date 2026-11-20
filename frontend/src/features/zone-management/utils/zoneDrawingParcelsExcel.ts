/**
 * ============================================================================
 * EXCEL DANH SÁCH LÔ KÈM BÌNH ĐỒ
 * Dựng trên trình duyệt từ đúng tập lô hàm vẽ vừa dùng (ZoneSvgResult.drawnParcels),
 * nên số dòng luôn bằng số lô trên bản vẽ .SVG. Chỉ gồm STT + 2 mã, không thông tin khác.
 * exceljs nạp động khi bấm xuất: màn khảo sát của KSV không tải thư viện này.
 * ============================================================================
 */
import type { DrawnParcel, ParcelLabelMode, TitleBlockInput, ZoneSvgResult } from './zoneSvgTechnicalExporter';

export const DRAWING_FILE_TAG: Record<ParcelLabelMode, 'BP' | 'KS'> = {
  METHOD_CODE: 'BP',
  SURVEY_CODE: 'KS',
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Phần định danh chung của tên file SVG và Excel: `${drawingCode}_${BP|KS}_${revision}_${YYYYMMDD}`. */
export const drawingFileStem = (
  drawingCode: string,
  labelMode: ParcelLabelMode,
  revision: string,
  at: Date = new Date()
): string => {
  const stamp = `${at.getFullYear()}${pad2(at.getMonth() + 1)}${pad2(at.getDate())}`;
  return `${drawingCode}_${DRAWING_FILE_TAG[labelMode]}_${revision}_${stamp}`;
};

const FONT = 'Times New Roman';
const THIN = { style: 'thin' as const };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

/** Hàng của bảng theo chế độ: cột mã của chế độ đang xuất đứng trước, sắp tăng dần theo cột đó. */
export const toDrawingParcelRows = (
  parcels: DrawnParcel[],
  labelMode: ParcelLabelMode
): Array<{ primary: string; secondary: string }> => {
  const rows = parcels.map((p) =>
    labelMode === 'METHOD_CODE'
      ? { primary: p.methodCode ?? '', secondary: p.surveyCode }
      : { primary: p.surveyCode, secondary: p.methodCode ?? '' }
  );
  return rows.sort((a, b) => a.primary.localeCompare(b.primary, 'vi', { numeric: true }));
};

export interface DrawingParcelsWorkbookInput {
  result: Pick<ZoneSvgResult, 'drawnParcels' | 'parcelCount' | 'skippedParcels' | 'identity' | 'labelMode'>;
  titleBlock: Pick<TitleBlockInput, 'drawingNo'>;
  latestRevision: string;
  zoneCode: string;
  exportedAt?: Date;
}

/** Dựng workbook (ArrayBuffer .xlsx). Ném lỗi nếu danh sách lô lệch số lô trên bản vẽ. */
export async function buildDrawingParcelsXlsx(input: DrawingParcelsWorkbookInput): Promise<ArrayBuffer> {
  const { result, titleBlock, latestRevision, zoneCode } = input;
  const exportedAt = input.exportedAt ?? new Date();
  if (result.drawnParcels.length !== result.parcelCount) {
    throw new Error(
      `Danh sách lô (${result.drawnParcels.length}) lệch số lô trên bình đồ (${result.parcelCount}), không xuất Excel.`
    );
  }

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Metro 2 BCS Platform';
  wb.created = exportedAt;
  const ws = wb.addWorksheet('Danh sach lo binh do', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: 7 }],
  });
  ws.columns = [{ width: 8 }, { width: 26 }, { width: 26 }];

  const isMethod = result.labelMode === 'METHOD_CODE';
  const primaryLabel = isMethod ? 'Mã Biện Pháp' : 'Mã Khảo Sát';
  const secondaryLabel = isMethod ? 'Mã Khảo Sát' : 'Mã Biện Pháp';
  const rows = toDrawingParcelRows(result.drawnParcels, result.labelMode);
  const firstData = 8;
  const lastData = firstData + rows.length - 1;
  const dateText = `${pad2(exportedAt.getDate())}/${pad2(exportedAt.getMonth() + 1)}/${exportedAt.getFullYear()}`;

  const titleLine = (rowNo: number, text: string, bold = false, size = 11) => {
    ws.mergeCells(rowNo, 1, rowNo, 3);
    const cell = ws.getCell(rowNo, 1);
    cell.value = text;
    cell.font = { name: FONT, bold, size };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  };
  titleLine(1, `DANH SÁCH LÔ TRÊN BÌNH ĐỒ — ${result.identity.titleVi}`, true, 13);
  titleLine(2, result.identity.titleEn, false, 10);
  titleLine(
    3,
    `Zone: ${zoneCode} • Mã bản vẽ: ${result.identity.drawingCode}` +
      `${titleBlock.drawingNo ? ` • Số hiệu: ${titleBlock.drawingNo}` : ''} • Phiên bản: ${latestRevision}`
  );
  titleLine(4, `Chế độ nhãn: ${primaryLabel} (${DRAWING_FILE_TAG[result.labelMode]}) • Ngày xuất: ${dateText}`);
  ws.getRow(1).height = 32;

  // Tổng số lô: công thức kèm giá trị tính sẵn (ExcelJS không tính công thức; xem trước trên điện thoại vẫn đúng)
  ws.getCell(5, 1).value = 'Tổng số lô trên bình đồ:';
  ws.mergeCells(5, 1, 5, 2);
  ws.getCell(5, 1).font = { name: FONT, bold: true };
  ws.getCell(5, 3).value = { formula: `SUBTOTAL(3,B${firstData}:B${lastData})`, result: rows.length };
  ws.getCell(5, 3).font = { name: FONT, bold: true, size: 12 };
  ws.getCell(5, 3).alignment = { horizontal: 'left' };
  if (result.skippedParcels > 0) {
    titleLine(
      6,
      `Lưu ý: ${result.skippedParcels} thửa của Zone chưa vẽ trên bình đồ do thiếu mã hoặc hình học, không có trong danh sách.`,
      false,
      10
    );
    ws.getCell(6, 1).font = { name: FONT, italic: true, size: 10 };
  }

  const header = ws.getRow(7);
  header.values = ['STT', primaryLabel, secondaryLabel];
  header.eachCell((cell) => {
    cell.font = { name: FONT, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  });
  rows.forEach((r, idx) => {
    const row = ws.getRow(firstData + idx);
    row.values = [idx + 1, r.primary || null, r.secondary || null];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > 3) return;
      cell.font = { name: FONT };
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'center' : 'left' };
    });
  });
  ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: Math.max(lastData, 7), column: 3 } };

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
