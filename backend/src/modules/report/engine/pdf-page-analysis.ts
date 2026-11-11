/**
 * ============================================================================
 * PDF PAGE ANALYSIS (pdfjs-dist, chỉ đọc)
 * - locateSectionPages: tìm trang thật của từng tiêu đề chương để in đúng số trang trong Mục lục.
 * - analyzePdfPages: đo mức lấp đầy từng trang và chữ ở đầu/đáy, phục vụ bộ kiểm thử bố cục.
 * Vị trí chữ lấy từ transform của pdfjs (toạ độ PDF, gốc ở góc dưới trái, đơn vị pt).
 * ============================================================================
 */

interface PdfTextItem {
  str: string;
  transform: number[];
}
interface PdfPage {
  getViewport(params: { scale: number }): { width: number; height: number };
  getTextContent(): Promise<{ items: Array<PdfTextItem | { type: string }> }>;
  cleanup(): void;
}
interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}
interface PdfJsModule {
  getDocument(source: { data: Uint8Array; useSystemFonts?: boolean; verbosity?: number }): { promise: Promise<PdfDocument> };
}

/** Lề @page của template (18mm) quy ra pt: vùng thân trang nằm giữa hai lề, đầu/chân trang Chrome vẽ trong lề. */
export const PAGE_MARGIN_PT = (18 / 25.4) * 72;

export interface SectionHeading {
  key: string;
  text: string;
}

export interface PdfPageStats {
  page: number;
  /** Phần trăm chiều cao vùng thân trang đã dùng (tính đến dòng chữ thấp nhất trong thân trang). */
  fillPct: number;
  /** Dòng chữ đầu tiên của thân trang. */
  firstLine: string;
  /** Chữ nằm trong lề trên (đầu trang Chrome). */
  headerText: string;
  /** Chữ nằm trong lề dưới (chân trang Chrome). */
  footerText: string;
}

function loadPdfJs(): PdfJsModule {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('pdfjs-dist/legacy/build/pdf.js') as PdfJsModule;
}

async function openPdf(buffer: Buffer): Promise<PdfDocument> {
  return loadPdfJs().getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, verbosity: 0 }).promise;
}

interface TextLine {
  top: number;
  text: string;
}

async function readPageLines(page: PdfPage): Promise<{ height: number; lines: TextLine[] }> {
  const height = page.getViewport({ scale: 1 }).height;
  const content = await page.getTextContent();
  const byRow = new Map<number, string>();
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const top = height - item.transform[5];
    const row = Math.round(top / 3);
    byRow.set(row, `${byRow.get(row) ?? ''}${item.str} `);
  }
  const lines = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([row, text]) => ({ top: row * 3, text: text.trim() }));
  return { height, lines };
}

/** Bỏ khoảng trắng, chuẩn hoá NFC và chữ thường để so khớp chữ ngắt dòng khác nhau giữa DOM và PDF. */
function squash(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, '');
}

const HEADING_NEEDLE_CHARS = 26;

export interface SectionLocation {
  /** Trang (1-based) đầu tiên chứa từng tiêu đề; tiêu đề không tìm thấy không có trong bảng. */
  pages: Record<string, number>;
  totalPages: number;
}

/**
 * Trang đầu tiên chứa từng tiêu đề chương, theo thứ tự tài liệu, bắt đầu sau trang Mục lục,
 * kèm tổng số trang PDF (in ở bìa "Page: 1 of N").
 */
export async function locateSectionPages(pdf: Buffer, headings: SectionHeading[]): Promise<SectionLocation> {
  const doc = await openPdf(pdf);
  try {
    const squashedPages: string[] = [];
    const pageText = async (n: number): Promise<string> => {
      if (squashedPages[n] === undefined) {
        const page = await doc.getPage(n);
        const { lines } = await readPageLines(page);
        squashedPages[n] = squash(lines.map((l) => l.text).join(' '));
        page.cleanup();
      }
      return squashedPages[n];
    };

    let from = 1;
    for (let n = 1; n <= Math.min(doc.numPages, 6); n++) {
      if ((await pageText(n)).includes('mụclục')) {
        from = n + 1;
        break;
      }
    }

    const result: Record<string, number> = {};
    for (const heading of headings) {
      const needle = squash(heading.text).slice(0, HEADING_NEEDLE_CHARS);
      if (needle.length < 6) continue;
      for (let n = from; n <= doc.numPages; n++) {
        if ((await pageText(n)).includes(needle)) {
          result[heading.key] = n;
          from = n;
          break;
        }
      }
    }
    return { pages: result, totalPages: doc.numPages };
  } finally {
    await doc.destroy();
  }
}

/** Đo từng trang PDF: mức lấp đầy thân trang, chữ ở lề trên/dưới, số ảnh. */
export async function analyzePdfPages(pdf: Buffer): Promise<PdfPageStats[]> {
  const doc = await openPdf(pdf);
  try {
    const stats: PdfPageStats[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const { height, lines } = await readPageLines(page);
      const bodyBottom = height - PAGE_MARGIN_PT;
      const body = lines.filter((l) => l.top >= PAGE_MARGIN_PT - 4 && l.top <= bodyBottom + 4);
      const maxTop = body.length ? Math.max(...body.map((l) => l.top)) : 0;
      const fillPct = body.length ? Math.round(((maxTop - PAGE_MARGIN_PT) / (bodyBottom - PAGE_MARGIN_PT)) * 100) : 0;
      stats.push({
        page: n,
        fillPct: Math.max(0, Math.min(100, fillPct)),
        firstLine: body[0]?.text.slice(0, 80) ?? '',
        headerText: lines.filter((l) => l.top < PAGE_MARGIN_PT - 4).map((l) => l.text).join(' | '),
        footerText: lines.filter((l) => l.top > bodyBottom + 4).map((l) => l.text).join(' | '),
      });
      page.cleanup();
    }
    return stats;
  } finally {
    await doc.destroy();
  }
}

/** Toàn bộ chữ của một trang (đã gộp dòng), dùng kiểm tra nội dung bìa. */
export async function readPageText(pdf: Buffer, pageNumber: number): Promise<string> {
  const doc = await openPdf(pdf);
  try {
    const page = await doc.getPage(pageNumber);
    const { lines } = await readPageLines(page);
    page.cleanup();
    return lines.map((l) => l.text).join(' ');
  } finally {
    await doc.destroy();
  }
}

/** Như squash nhưng giữ bảng ánh xạ vị trí ký tự về chuỗi gốc, để cắt lại phần chữ gốc sau khi tìm thấy. */
function squashWithMap(text: string): { squashed: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  const normalized = text.normalize('NFC').toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    if (/\s/.test(normalized[i])) continue;
    chars.push(normalized[i]);
    map.push(i);
  }
  return { squashed: chars.join(''), map };
}

/**
 * Số trang đang IN trong Mục lục cho từng tiêu đề: số đứng riêng đầu tiên sau tên mục trên trang Mục lục
 * (không lấy số dính dấu chấm như "1." của mục con). Dùng kiểm tra Mục lục khớp trang thật.
 */
export async function readTocPageNumbers(pdf: Buffer, headings: SectionHeading[]): Promise<Record<string, number>> {
  const doc = await openPdf(pdf);
  try {
    for (let n = 1; n <= Math.min(doc.numPages, 6); n++) {
      const page = await doc.getPage(n);
      const { lines } = await readPageLines(page);
      page.cleanup();
      const original = lines.map((l) => l.text).join(' ').normalize('NFC').toLowerCase();
      const { squashed, map } = squashWithMap(original);
      if (!squashed.includes('mụclục')) continue;
      const result: Record<string, number> = {};
      for (const heading of headings) {
        const needle = squash(heading.text).slice(0, HEADING_NEEDLE_CHARS);
        const at = squashed.indexOf(needle);
        if (at < 0) continue;
        const endInOriginal = map[at + needle.length - 1] + 1;
        const m = original.slice(endInOriginal).match(/(?:^|\s)(\d{1,3})(?=\s|$)/);
        if (m) result[heading.key] = Number(m[1]);
      }
      return result;
    }
    return {};
  } finally {
    await doc.destroy();
  }
}
