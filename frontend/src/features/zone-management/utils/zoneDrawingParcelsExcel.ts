/**
 * ============================================================================
 * EXCEL DANH SÁCH LÔ KÈM BÌNH ĐỒ
 * Dựng trên trình duyệt từ đúng tập lô hàm vẽ vừa dùng (ZoneSvgResult.drawnParcels),
 * nên số dòng luôn bằng số lô trên bản vẽ .SVG.
 * Cột: STT + 2 mã + toạ độ polygon VN2000 (dán vào AutoCAD) + WGS84 (GIS / Google Earth).
 * exceljs nạp động khi bấm xuất: màn khảo sát của KSV không tải thư viện này.
 * ============================================================================
 */
import type { DrawnParcel, ParcelLabelMode, TitleBlockInput, ZoneSvgResult } from './zoneSvgTechnicalExporter';
import { VN2000_CALIBRATION_SOURCE, wgs84ToVn2000 } from './vn2000';

export const DRAWING_FILE_TAG: Record<ParcelLabelMode, 'BP' | 'KS'> = {
  METHOD_CODE: 'BP',
  SURVEY_CODE: 'KS',
};

/** Giới hạn ký tự của một ô Excel */
export const EXCEL_CELL_MAX_CHARS = 32767;

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

/**
 * Toạ độ VN2000 theo thứ tự AutoCAD: `E,N E,N ...` (X = Đông/Easting, Y = Bắc/Northing), mét, 3 số lẻ.
 * Trên dòng lệnh AutoCAD dấu cách = Enter: PLINE → dán → C (khép) ra đúng lô.
 * Cùng hàm + hằng hiệu chỉnh với bảng điểm khống chế của bình đồ.
 */
export const toAutoCadPolyline = (ring: Array<[number, number]>): string =>
  ring
    .map((coord) => {
      const vn = wgs84ToVn2000(coord);
      return `${vn.y.toFixed(3)},${vn.x.toFixed(3)}`;
    })
    .join(' ');

/** Toạ độ WGS84 theo thứ tự GeoJSON/KML: `lng,lat lng,lat ...`, 7 số lẻ. */
export const toWgs84Polyline = (ring: Array<[number, number]>): string =>
  ring.map(([lat, lng]) => `${lng.toFixed(7)},${lat.toFixed(7)}`).join(' ');

const FONT = 'Times New Roman';
const THIN = { style: 'thin' as const };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const COLS = 5;

export interface DrawingParcelRow {
  primary: string;
  secondary: string;
  vn2000: string;
  wgs84: string;
}

/** Hàng của bảng theo chế độ: cột mã của chế độ đang xuất đứng trước, sắp tăng dần theo cột đó. */
export const toDrawingParcelRows = (parcels: DrawnParcel[], labelMode: ParcelLabelMode): DrawingParcelRow[] => {
  const rows = parcels.map((p) => {
    const vn2000 = toAutoCadPolyline(p.ring);
    const wgs84 = toWgs84Polyline(p.ring);
    if (vn2000.length > EXCEL_CELL_MAX_CHARS || wgs84.length > EXCEL_CELL_MAX_CHARS) {
      throw new Error(
        `Lô ${p.surveyCode} có ${p.ring.length} đỉnh, toạ độ vượt giới hạn ${EXCEL_CELL_MAX_CHARS} ký tự của một ô Excel.`
      );
    }
    return labelMode === 'METHOD_CODE'
      ? { primary: p.methodCode ?? '', secondary: p.surveyCode, vn2000, wgs84 }
      : { primary: p.surveyCode, secondary: p.methodCode ?? '', vn2000, wgs84 };
  });
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
  const rows = toDrawingParcelRows(result.drawnParcels, result.labelMode);

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Metro 2 BCS Platform';
  wb.created = exportedAt;
  const HEADER_ROW = 8;
  const firstData = HEADER_ROW + 1;
  const lastData = firstData + rows.length - 1;
  const ws = wb.addWorksheet('Danh sach lo binh do', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: HEADER_ROW }],
  });
  ws.columns = [{ width: 7 }, { width: 22 }, { width: 22 }, { width: 62 }, { width: 62 }];

  const isMethod = result.labelMode === 'METHOD_CODE';
  const primaryLabel = isMethod ? 'Mã Biện Pháp' : 'Mã Khảo Sát';
  const secondaryLabel = isMethod ? 'Mã Khảo Sát' : 'Mã Biện Pháp';
  const dateText = `${pad2(exportedAt.getDate())}/${pad2(exportedAt.getMonth() + 1)}/${exportedAt.getFullYear()}`;

  const titleLine = (rowNo: number, text: string, opts: { bold?: boolean; italic?: boolean; size?: number } = {}) => {
    ws.mergeCells(rowNo, 1, rowNo, COLS);
    const cell = ws.getCell(rowNo, 1);
    cell.value = text;
    cell.font = { name: FONT, bold: opts.bold, italic: opts.italic, size: opts.size ?? 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  };
  titleLine(1, `DANH SÁCH LÔ TRÊN BÌNH ĐỒ — ${result.identity.titleVi}`, { bold: true, size: 13 });
  titleLine(2, result.identity.titleEn, { size: 10 });
  titleLine(
    3,
    `Zone: ${zoneCode} • Mã bản vẽ: ${result.identity.drawingCode}` +
      `${titleBlock.drawingNo ? ` • Số hiệu: ${titleBlock.drawingNo}` : ''} • Phiên bản: ${latestRevision}`
  );
  titleLine(4, `Chế độ nhãn: ${primaryLabel} (${DRAWING_FILE_TAG[result.labelMode]}) • Ngày xuất: ${dateText}`);
  ws.getRow(1).height = 24;

  // Tổng số lô: công thức kèm giá trị tính sẵn (ExcelJS không tính công thức; xem trước trên điện thoại vẫn đúng)
  ws.mergeCells(5, 1, 5, 2);
  ws.getCell(5, 1).value = 'Tổng số lô trên bình đồ:';
  ws.getCell(5, 1).font = { name: FONT, bold: true };
  ws.getCell(5, 3).value = { formula: `SUBTOTAL(3,B${firstData}:B${lastData})`, result: rows.length };
  ws.getCell(5, 3).font = { name: FONT, bold: true, size: 12 };
  ws.getCell(5, 3).alignment = { horizontal: 'left' };

  titleLine(
    6,
    `Toạ độ VN2000 kinh tuyến trục 105°45', múi 3° (${VN2000_CALIBRATION_SOURCE}), ghi X = Đông, Y = Bắc theo AutoCAD. ` +
      'Vẽ lô: gõ PLINE, dán nội dung ô, gõ C để khép. Toạ độ WGS84 ghi kinh độ,vĩ độ.',
    { italic: true, size: 10 }
  );
  ws.getRow(6).height = 28;
  if (result.skippedParcels > 0) {
    titleLine(
      7,
      `Lưu ý: ${result.skippedParcels} thửa của Zone chưa vẽ trên bình đồ do thiếu mã hoặc hình học, không có trong danh sách.`,
      { italic: true, size: 10 }
    );
  }

  const header = ws.getRow(HEADER_ROW);
  header.values = [
    'STT',
    primaryLabel,
    secondaryLabel,
    'Toạ độ VN2000 (X=Đông, Y=Bắc, m) — dán sau PLINE, gõ C để khép',
    'Toạ độ WGS84 (kinh độ, vĩ độ)',
  ];
  header.height = 30;
  header.eachCell((cell) => {
    cell.font = { name: FONT, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BORDER;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  });
  rows.forEach((r, idx) => {
    const row = ws.getRow(firstData + idx);
    // Toạ độ ghi dạng chuỗi: Excel không đổi dấu chấm thập phân theo locale, không tự xuống dòng
    row.values = [idx + 1, r.primary || null, r.secondary || null, r.vn2000, r.wgs84];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > COLS) return;
      cell.font = { name: col >= 4 ? 'Consolas' : FONT, size: col >= 4 ? 9 : 11 };
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'center' : 'left', wrapText: false };
      if (col >= 4) cell.numFmt = '@';
    });
  });
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: Math.max(lastData, HEADER_ROW), column: COLS } };

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
