/**
 * Xuất đồ thị CAD ra DXF R12 (AC1009) dạng ASCII để mở bằng AutoCAD / LibreCAD.
 * Đơn vị là pixel của ảnh làm việc; trục Y của DXF hướng lên nên lật theo chiều cao ảnh.
 */

import type { CadColumn, CadGraph, CadVertex } from '../types/cadLab.types';
import { getCadTextFontSize } from './cadSvgRenderer';

export const CAD_DXF_LAYERS = {
  wall: 'TUONG',
  beam: 'DAM',
  column: 'COT',
  text: 'CHU',
} as const;

/** Mã màu ACI: 7 trắng/đen, 1 đỏ, 5 xanh dương, 3 xanh lá. */
const LAYER_COLORS: Record<string, number> = {
  [CAD_DXF_LAYERS.wall]: 7,
  [CAD_DXF_LAYERS.beam]: 5,
  [CAD_DXF_LAYERS.column]: 1,
  [CAD_DXF_LAYERS.text]: 3,
};

const num = (v: number): string => (Math.round(v * 1000) / 1000).toFixed(3);

/** DXF R12 không đọc UTF-8: ký tự ngoài ASCII viết dạng \U+XXXX. */
export function encodeDxfText(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x0a || code === 0x0d) continue;
    if (code < 128) out += ch;
    else if (code <= 0xffff) out += `\\U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
  }
  return out;
}

function columnHatchSegments(c: CadColumn, gap: number): [number, number, number, number][] {
  const x0 = c.cx - c.w / 2;
  const x1 = c.cx + c.w / 2;
  const y0 = c.cy - c.h / 2;
  const y1 = c.cy + c.h / 2;
  const segments: [number, number, number, number][] = [];
  // Đường x - y = k cắt khung
  for (let k = x0 - y1 + gap; k < x1 - y0; k += gap) {
    const xa = Math.max(x0, y0 + k);
    const xb = Math.min(x1, y1 + k);
    if (xb - xa < 0.5) continue;
    segments.push([xa, xa - k, xb, xb - k]);
  }
  return segments;
}

export function renderCadDxf(graph: CadGraph): string {
  const lines: string[] = [];
  const g = (code: number, value: string | number): void => {
    lines.push(String(code), typeof value === 'number' ? num(value) : value);
  };
  const flipY = (y: number): number => graph.height - y;
  const line = (layer: string, x1: number, y1: number, x2: number, y2: number): void => {
    g(0, 'LINE');
    g(8, layer);
    g(10, x1);
    g(20, flipY(y1));
    g(30, 0);
    g(11, x2);
    g(21, flipY(y2));
    g(31, 0);
  };

  g(0, 'SECTION');
  g(2, 'HEADER');
  g(9, '$ACADVER');
  g(1, 'AC1009');
  g(9, '$EXTMIN');
  g(10, 0);
  g(20, 0);
  g(9, '$EXTMAX');
  g(10, graph.width);
  g(20, graph.height);
  g(0, 'ENDSEC');

  g(0, 'SECTION');
  g(2, 'TABLES');
  g(0, 'TABLE');
  g(2, 'LTYPE');
  g(70, '1');
  g(0, 'LTYPE');
  g(2, 'CONTINUOUS');
  g(70, '0');
  g(3, 'Solid line');
  g(72, '65');
  g(73, '0');
  g(40, 0);
  g(0, 'ENDTAB');
  g(0, 'TABLE');
  g(2, 'LAYER');
  g(70, String(Object.keys(LAYER_COLORS).length));
  for (const [name, color] of Object.entries(LAYER_COLORS)) {
    g(0, 'LAYER');
    g(2, name);
    g(70, '0');
    g(62, String(color));
    g(6, 'CONTINUOUS');
  }
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');

  g(0, 'SECTION');
  g(2, 'ENTITIES');
  const byId = new Map<string, CadVertex>(graph.vertices.map((v) => [v.id, v]));
  for (const e of graph.edges) {
    const a = byId.get(e.a);
    const b = byId.get(e.b);
    if (!a || !b) continue;
    line(e.kind === 'BEAM_PAIR' ? CAD_DXF_LAYERS.beam : CAD_DXF_LAYERS.wall, a.x, a.y, b.x, b.y);
  }
  for (const c of graph.columns) {
    const x0 = c.cx - c.w / 2;
    const x1 = c.cx + c.w / 2;
    const y0 = c.cy - c.h / 2;
    const y1 = c.cy + c.h / 2;
    line(CAD_DXF_LAYERS.column, x0, y0, x1, y0);
    line(CAD_DXF_LAYERS.column, x1, y0, x1, y1);
    line(CAD_DXF_LAYERS.column, x1, y1, x0, y1);
    line(CAD_DXF_LAYERS.column, x0, y1, x0, y0);
    for (const [xa, ya, xb, yb] of columnHatchSegments(c, Math.max(3, Math.min(c.w, c.h) / 4))) {
      line(CAD_DXF_LAYERS.column, xa, ya, xb, yb);
    }
  }
  for (const t of graph.textBoxes) {
    const text = t.text.trim();
    if (!text) continue;
    const cx = t.x + t.w / 2;
    const cy = flipY(t.y + t.h / 2);
    g(0, 'TEXT');
    g(8, CAD_DXF_LAYERS.text);
    g(10, cx);
    g(20, cy);
    g(30, 0);
    g(40, getCadTextFontSize(t) * 0.8);
    g(1, encodeDxfText(text));
    g(72, '1');
    g(73, '2');
    g(11, cx);
    g(21, cy);
    g(31, 0);
  }
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return `${lines.join('\n')}\n`;
}
