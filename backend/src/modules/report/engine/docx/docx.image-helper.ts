import * as https from 'https';
import * as http from 'http';
import type {
  ImageRun as DocxImageRun,
  Paragraph as DocxParagraph,
} from 'docx';
import { COLOR } from './docx.styles';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const docxCjs = require('docx');
const {
  Paragraph,
  TextRun,
  AlignmentType,
  ImageRun,
} = docxCjs;

/**
 * Tải ảnh từ URL -> Buffer (hỗ trợ base64 và HTTP/HTTPS timeout 8s)
 */
export async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  if (!url) return null;
  // base64 data URL
  const b64Match = url.match(/^data:image\/(\w+);base64,(.+)$/);
  if (b64Match) return Buffer.from(b64Match[2], 'base64');

  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 8000 }, (res) => {
      if ((res.statusCode || 0) >= 400) { resolve(null); return; }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Tạo ImageRun an toàn cho file docx (trả null nếu lỗi giải mã ảnh)
 */
export async function safeImage(url: string | undefined, widthEmu = 5400000, heightEmu = 3600000): Promise<DocxImageRun | null> {
  if (!url) return null;
  const buf = await fetchImageBuffer(url);
  if (!buf || buf.length < 100) return null;
  // Detect image type from buffer magic bytes
  let type: 'jpg' | 'png' | 'gif' = 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50) type = 'png';
  else if (buf[0] === 0x47 && buf[1] === 0x49) type = 'gif';
  try {
    return new ImageRun({
      data: buf,
      transformation: { width: Math.round(widthEmu / 9144), height: Math.round(heightEmu / 9144) },
      type,
    });
  } catch {
    return null;
  }
}

/**
 * Tạo Paragraph chứa ảnh và caption căn giữa
 */
export async function imagePara(url: string | undefined, caption?: string): Promise<DocxParagraph[]> {
  const img = await safeImage(url, 5940000, 4455000); // ~6.5cm × 4.5cm (emu / 9144 ≈ pt)
  if (!img) return [];
  const result: DocxParagraph[] = [
    new Paragraph({
      children: [img],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
    }),
  ];
  if (caption) {
    result.push(new Paragraph({
      children: [new TextRun({ text: caption, italics: true, size: 18, color: COLOR.gray })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
    }));
  }
  return result;
}
