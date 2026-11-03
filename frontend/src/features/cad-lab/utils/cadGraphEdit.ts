/**
 * Thao tác sửa đồ thị CAD trong trình biên tập. Hàm thuần: luôn trả đồ thị mới, không sửa đồ thị cũ,
 * để lưu lịch sử hoàn tác bằng cách giữ các bản cũ.
 */

import type { CadAngleClass, CadColumn, CadEdge, CadGraph, CadTextBox, CadVertex } from '../types/cadLab.types';

const DEG_TO_RAD = Math.PI / 180;

interface Pt {
  x: number;
  y: number;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Chữ đơn cách cỡ getCadTextFontSize (0.7·h), mỗi ký tự rộng ~0.6 cỡ chữ, cộng lề hai bên. */
const textWidthFor = (text: string, height: number): number => text.trim().length * height * 0.7 * 0.6 + height * 0.6;

export function cloneGraph(g: CadGraph): CadGraph {
  return {
    ...g,
    vertices: g.vertices.map((v) => ({ ...v })),
    edges: g.edges.map((e) => ({ ...e })),
    columns: g.columns.map((c) => ({ ...c })),
    textBoxes: g.textBoxes.map((t) => ({ ...t })),
  };
}

const nextId = (prefix: string, ids: string[]): string => {
  let max = 0;
  const re = new RegExp(`^${prefix}-?(\\d+)$`);
  for (const id of ids) {
    const m = id.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return prefix === 'C' ? `C-${max + 1}` : `${prefix}${max + 1}`;
};

/** Đổi điểm sang hệ trục nhà (trục u dọc cạnh ngang của nhà) và ngược lại. */
const toAxisFrame = (p: Pt, axisDeg: number): Pt => {
  const r = -axisDeg * DEG_TO_RAD;
  return { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) };
};
const fromAxisFrame = (p: Pt, axisDeg: number): Pt => toAxisFrame(p, -axisDeg);

const isHorizontalInFrame = (a: Pt, b: Pt, axisDeg: number): boolean => {
  const fa = toAxisFrame(a, axisDeg);
  const fb = toAxisFrame(b, axisDeg);
  return Math.abs(fb.x - fa.x) >= Math.abs(fb.y - fa.y);
};

export function findVertexNear(g: CadGraph, p: Pt, radius: number): CadVertex | null {
  let best: CadVertex | null = null;
  let bestD = radius;
  for (const v of g.vertices) {
    const d = Math.hypot(v.x - p.x, v.y - p.y);
    if (d <= bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

/**
 * Kéo đỉnh. Khi khóa vuông góc, đỉnh trượt theo các cạnh ORTHO nối vào nó
 * để cạnh vẫn nằm ngang/dọc theo trục nhà.
 */
export function moveVertex(g: CadGraph, vertexId: string, target: Pt, orthoLock: boolean): CadGraph {
  const next = cloneGraph(g);
  const v = next.vertices.find((item) => item.id === vertexId);
  if (!v) return g;
  let pos = target;
  if (orthoLock) {
    const byId = new Map(next.vertices.map((item) => [item.id, item]));
    let frame = toAxisFrame(target, next.axisAngleDeg);
    let lockedU = false;
    let lockedV = false;
    for (const e of next.edges) {
      if (e.angleClass !== 'ORTHO' || (e.a !== vertexId && e.b !== vertexId)) continue;
      const other = byId.get(e.a === vertexId ? e.b : e.a);
      if (!other) continue;
      const fo = toAxisFrame(other, next.axisAngleDeg);
      if (isHorizontalInFrame(v, other, next.axisAngleDeg)) {
        if (!lockedV) frame = { x: frame.x, y: fo.y };
        lockedV = true;
      } else {
        if (!lockedU) frame = { x: fo.x, y: frame.y };
        lockedU = true;
      }
    }
    pos = fromAxisFrame(frame, next.axisAngleDeg);
  }
  v.x = round2(pos.x);
  v.y = round2(pos.y);
  return next;
}

function dropOrphanVertices(g: CadGraph): void {
  const used = new Set<string>();
  for (const e of g.edges) {
    used.add(e.a);
    used.add(e.b);
  }
  g.vertices = g.vertices.filter((v) => used.has(v.id));
}

export function deleteEdge(g: CadGraph, edgeId: string): CadGraph {
  const next = cloneGraph(g);
  const removed = next.edges.find((e) => e.id === edgeId);
  next.edges = next.edges.filter((e) => e.id !== edgeId);
  // Cạnh còn lại của cặp dầm trở thành nét đơn
  if (removed?.pairId) {
    for (const e of next.edges) {
      if (e.pairId === removed.pairId) {
        e.kind = 'SINGLE';
        delete e.pairId;
        delete e.beamWidthPx;
      }
    }
  }
  dropOrphanVertices(next);
  return next;
}

export function deleteVertex(g: CadGraph, vertexId: string): CadGraph {
  let next = cloneGraph(g);
  for (const e of g.edges.filter((item) => item.a === vertexId || item.b === vertexId)) {
    next = deleteEdge(next, e.id);
  }
  next.vertices = next.vertices.filter((v) => v.id !== vertexId);
  return next;
}

export function deleteColumn(g: CadGraph, columnId: string): CadGraph {
  const next = cloneGraph(g);
  next.columns = next.columns.filter((c) => c.id !== columnId);
  return next;
}

export function deleteTextBox(g: CadGraph, textId: string): CadGraph {
  const next = cloneGraph(g);
  next.textBoxes = next.textBoxes.filter((t) => t.id !== textId);
  return next;
}

/** Nối hai điểm; điểm gần đỉnh có sẵn thì bắt vào đỉnh đó. Khóa vuông góc thì nắn điểm cuối theo trục nhà. */
export function addEdge(g: CadGraph, from: Pt, to: Pt, snapRadius: number, orthoLock: boolean): CadGraph {
  const next = cloneGraph(g);
  const ensureVertex = (p: Pt): CadVertex => {
    const near = findVertexNear(next, p, snapRadius);
    if (near) return near;
    const v: CadVertex = { id: nextId('V', next.vertices.map((item) => item.id)), x: round2(p.x), y: round2(p.y) };
    next.vertices.push(v);
    return v;
  };
  const a = ensureVertex(from);
  let end = to;
  if (orthoLock && !findVertexNear(next, to, snapRadius)) {
    const fa = toAxisFrame(a, next.axisAngleDeg);
    const ft = toAxisFrame(to, next.axisAngleDeg);
    const frame = Math.abs(ft.x - fa.x) >= Math.abs(ft.y - fa.y) ? { x: ft.x, y: fa.y } : { x: fa.x, y: ft.y };
    end = fromAxisFrame(frame, next.axisAngleDeg);
  }
  const b = ensureVertex(end);
  if (a.id === b.id || next.edges.some((e) => (e.a === a.id && e.b === b.id) || (e.a === b.id && e.b === a.id))) {
    return g;
  }
  const edge: CadEdge = {
    id: nextId('E', next.edges.map((e) => e.id)),
    a: a.id,
    b: b.id,
    kind: 'SINGLE',
    angleClass: orthoLock ? 'ORTHO' : 'SLANT',
  };
  next.edges.push(edge);
  return next;
}

export function addColumn(g: CadGraph, center: Pt, size: number): CadGraph {
  const next = cloneGraph(g);
  const column: CadColumn = {
    id: nextId('C', next.columns.map((c) => c.id)),
    cx: round2(center.x),
    cy: round2(center.y),
    w: size,
    h: size,
  };
  next.columns.push(column);
  return next;
}

export function addTextBox(g: CadGraph, center: Pt, text: string, height: number): CadGraph {
  const next = cloneGraph(g);
  const width = Math.max(height * 2, textWidthFor(text, height));
  const box: CadTextBox = {
    id: nextId('T', next.textBoxes.map((t) => t.id)),
    x: round2(center.x - width / 2),
    y: round2(center.y - height / 2),
    w: round2(width),
    h: height,
    text,
    source: 'MANUAL',
  };
  next.textBoxes.push(box);
  return next;
}

export function updateTextBox(g: CadGraph, textId: string, patch: Partial<Pick<CadTextBox, 'text' | 'x' | 'y' | 'w' | 'h'>>): CadGraph {
  const next = cloneGraph(g);
  const box = next.textBoxes.find((t) => t.id === textId);
  if (!box) return g;
  Object.assign(box, patch);
  if (patch.text !== undefined && box.text.trim()) {
    // Ô chữ phải đủ rộng cho nội dung mới
    box.w = round2(Math.max(box.w, textWidthFor(box.text, box.h)));
  }
  return next;
}

export function moveColumn(g: CadGraph, columnId: string, center: Pt): CadGraph {
  const next = cloneGraph(g);
  const col = next.columns.find((c) => c.id === columnId);
  if (!col) return g;
  col.cx = round2(center.x);
  col.cy = round2(center.y);
  return next;
}

export function moveTextBox(g: CadGraph, textId: string, center: Pt): CadGraph {
  const next = cloneGraph(g);
  const box = next.textBoxes.find((t) => t.id === textId);
  if (!box) return g;
  box.x = round2(center.x - box.w / 2);
  box.y = round2(center.y - box.h / 2);
  return next;
}

/**
 * ORTHO: nắn cạnh về trục nhà gần nhất, giữ đỉnh nhiều cạnh hơn đứng yên.
 * SLANT: giữ nguyên hình, chỉ xác nhận là cạnh xiên thật.
 */
export function setEdgeAngleClass(g: CadGraph, edgeId: string, angleClass: Exclude<CadAngleClass, 'SLANT_SUSPECT'>): CadGraph {
  const next = cloneGraph(g);
  const edge = next.edges.find((e) => e.id === edgeId);
  if (!edge) return g;
  edge.angleClass = angleClass;
  if (angleClass === 'SLANT') return next;

  const degree = (id: string): number => next.edges.filter((e) => e.a === id || e.b === id).length;
  const fixedId = degree(edge.a) >= degree(edge.b) ? edge.a : edge.b;
  const movingId = fixedId === edge.a ? edge.b : edge.a;
  const fixed = next.vertices.find((v) => v.id === fixedId);
  const moving = next.vertices.find((v) => v.id === movingId);
  if (!fixed || !moving) return next;
  const ff = toAxisFrame(fixed, next.axisAngleDeg);
  const fm = toAxisFrame(moving, next.axisAngleDeg);
  const frame = Math.abs(fm.x - ff.x) >= Math.abs(fm.y - ff.y) ? { x: fm.x, y: ff.y } : { x: ff.x, y: fm.y };
  const pos = fromAxisFrame(frame, next.axisAngleDeg);
  moving.x = round2(pos.x);
  moving.y = round2(pos.y);
  return next;
}

/** Xử lý một lần mọi cạnh đang chờ chọn. */
export function resolveAllSuspectEdges(g: CadGraph, angleClass: Exclude<CadAngleClass, 'SLANT_SUSPECT'>): CadGraph {
  let next = g;
  for (const e of g.edges) {
    if (e.angleClass === 'SLANT_SUSPECT') next = setEdgeAngleClass(next, e.id, angleClass);
  }
  return next;
}

/** Xoay cả bản vẽ quanh tâm ảnh để trục nhà về đúng ngang/dọc; ảnh lót xoay theo. */
export function straightenToAxis(g: CadGraph): CadGraph {
  const angle = -g.axisAngleDeg;
  if (Math.abs(angle) < 1e-6) return g;
  const next = cloneGraph(g);
  const cx = g.width / 2;
  const cy = g.height / 2;
  const r = angle * DEG_TO_RAD;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const rotate = (p: Pt): Pt => ({
    x: round2(cx + (p.x - cx) * cos - (p.y - cy) * sin),
    y: round2(cy + (p.x - cx) * sin + (p.y - cy) * cos),
  });
  for (const v of next.vertices) Object.assign(v, rotate(v));
  for (const c of next.columns) {
    const p = rotate({ x: c.cx, y: c.cy });
    c.cx = p.x;
    c.cy = p.y;
  }
  for (const t of next.textBoxes) {
    const p = rotate({ x: t.x + t.w / 2, y: t.y + t.h / 2 });
    t.x = round2(p.x - t.w / 2);
    t.y = round2(p.y - t.h / 2);
  }
  next.axisAngleDeg = 0;
  next.underlayRotateDeg = round2(g.underlayRotateDeg + angle);
  return next;
}

/** Ô chữ phát hiện tự động mà chưa điền nội dung thì không xuất ra bản vẽ. */
export function countFilledTextBoxes(g: CadGraph): number {
  return g.textBoxes.filter((t) => t.text.trim().length > 0).length;
}
