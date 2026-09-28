import type {
  Paragraph as DocxParagraph,
  TextRun as DocxTextRun,
  Table as DocxTable,
  TableCell as DocxTableCell,
} from 'docx';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const docxCjs = require('docx');
const {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
} = docxCjs;

export const COLOR = {
  primary:   '1e3a5f',  // xanh navy CRLG
  accent:    '2563eb',  // xanh đậm accent
  headerBg:  'd1dff7',  // header bảng
  rowAlt:    'f1f5fb',  // hàng chẵn
  white:     'FFFFFF',
  gray:      '6b7280',
  border:    'a0aec0',
  good:      '16a34a',
  medium:    'd97706',
  deficient: 'ea580c',
  critical:  'dc2626',
};

export function bold(text: string, opts?: { color?: string; size?: number }): DocxTextRun {
  return new TextRun({
    text,
    bold: true,
    color: opts?.color,
    size: opts?.size,
  });
}

export function sectionHeading(text: string, level: 1 | 2 | 3 = 2): DocxParagraph {
  const levelMap = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  };
  return new Paragraph({
    text,
    heading: levelMap[level],
    spacing: { before: 240, after: 120 },
  });
}

export function para(text: string, opts?: { bold?: boolean; color?: string; indent?: boolean }): DocxParagraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text || '—',
        bold: opts?.bold,
        color: opts?.color,
        size: 22, // 11pt
      }),
    ],
    spacing: { after: 80 },
    indent: opts?.indent ? { left: 360 } : undefined,
  });
}

export function headerCell(text: string, width?: number): DocxTableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [bold(text, { color: COLOR.primary, size: 20 })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: { fill: COLOR.headerBg, type: ShadingType.CLEAR },
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: COLOR.border },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.border },
      left:   { style: BorderStyle.SINGLE, size: 4, color: COLOR.border },
      right:  { style: BorderStyle.SINGLE, size: 4, color: COLOR.border },
    },
  });
}

export function dataCell(text: string, shade?: boolean, opts?: { bold?: boolean; color?: string }): DocxTableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || '—',
            size: 20,
            bold: opts?.bold,
            color: opts?.color,
          }),
        ],
        spacing: { before: 40, after: 40 },
      }),
    ],
    shading: shade ? { fill: COLOR.rowAlt, type: ShadingType.CLEAR } : undefined,
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 2, color: COLOR.border },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR.border },
      left:   { style: BorderStyle.SINGLE, size: 2, color: COLOR.border },
      right:  { style: BorderStyle.SINGLE, size: 2, color: COLOR.border },
    },
  });
}

export function labelValueTable(rows: [string, string][]): DocxTable {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([label, value], i) =>
      new TableRow({
        children: [
          dataCell(label, !!(i % 2), { bold: true }),
          dataCell(value, !!(i % 2)),
        ],
      })
    ),
  });
}
