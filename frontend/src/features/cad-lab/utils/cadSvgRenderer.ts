/**
 * Xuất đồ thị CAD ra SVG đen trắng kỹ thuật và PNG.
 * Màu viết bằng tên (black/white) trong thuộc tính SVG, không dùng style nội tuyến.
 */

import type { CadGraph, CadVertex } from '../types/cadLab.types';

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmt = (v: number): string => (Math.round(v * 100) / 100).toString();

export function getCadStrokeWidth(graph: Pick<CadGraph, 'width' | 'height'>): number {
  return Math.max(1.5, Math.max(graph.width, graph.height) / 500);
}

export function getCadTextFontSize(box: { h: number }): number {
  return Math.max(8, box.h * 0.7);
}

export function renderCadSvg(graph: CadGraph): string {
  const stroke = getCadStrokeWidth(graph);
  const byId = new Map<string, CadVertex>(graph.vertices.map((v) => [v.id, v]));
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${graph.width}" height="${graph.height}" viewBox="0 0 ${graph.width} ${graph.height}">`
  );
  const hatchGap = Math.max(3, stroke * 2.5);
  parts.push(
    `<defs><pattern id="cad-hatch" patternUnits="userSpaceOnUse" width="${fmt(hatchGap)}" height="${fmt(hatchGap)}" patternTransform="rotate(45)">` +
      `<line x1="0" y1="0" x2="0" y2="${fmt(hatchGap)}" stroke="black" stroke-width="${fmt(stroke * 0.6)}"/></pattern></defs>`
  );
  parts.push(`<rect x="0" y="0" width="${graph.width}" height="${graph.height}" fill="white"/>`);

  parts.push(`<g id="TUONG_DAM" stroke="black" stroke-width="${fmt(stroke)}" stroke-linecap="square" fill="none">`);
  for (const e of graph.edges) {
    const a = byId.get(e.a);
    const b = byId.get(e.b);
    if (!a || !b) continue;
    parts.push(`<line x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(b.x)}" y2="${fmt(b.y)}"/>`);
  }
  parts.push('</g>');

  parts.push(`<g id="COT" stroke="black" stroke-width="${fmt(stroke)}">`);
  for (const c of graph.columns) {
    parts.push(
      `<rect x="${fmt(c.cx - c.w / 2)}" y="${fmt(c.cy - c.h / 2)}" width="${fmt(c.w)}" height="${fmt(c.h)}" fill="url(#cad-hatch)"/>`
    );
  }
  parts.push('</g>');

  parts.push('<g id="CHU">');
  for (const t of graph.textBoxes) {
    const text = t.text.trim();
    if (!text) continue;
    parts.push(`<rect x="${fmt(t.x)}" y="${fmt(t.y)}" width="${fmt(t.w)}" height="${fmt(t.h)}" fill="white"/>`);
    parts.push(
      `<text x="${fmt(t.x + t.w / 2)}" y="${fmt(t.y + t.h / 2)}" font-family="'Courier New', monospace" font-size="${fmt(getCadTextFontSize(t))}" ` +
        `font-weight="bold" fill="black" text-anchor="middle" dominant-baseline="central">${escapeXml(text)}</text>`
    );
  }
  parts.push('</g></svg>');
  return parts.join('');
}

/** Vẽ SVG lên canvas để ra PNG. Chỉ chạy trên trình duyệt. */
export async function svgToPngBlob(svg: string, width: number, height: number, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Không vẽ được SVG thành ảnh.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không cấp được canvas 2D.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không xuất được PNG.'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
