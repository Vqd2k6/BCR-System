/**
 * ============================================================================
 * CAD LAB DSP CORE: ẢNH PHÁC THẢO TAY -> ĐỒ THỊ ĐỈNH–CẠNH
 * Hàm thuần trên TypedArray, không đụng DOM: chạy được trong Web Worker,
 * luồng chính và Node (kiểm thử).
 *
 * 1. Nhị phân hóa Bradley-Roth (integral image) để khử bóng giấy.
 * 2. Đánh nhãn thành phần liên thông, tách chữ khỏi nét vẽ theo hình dạng.
 * 3. Thu mảnh Zhang-Suen, dò nút và chuỗi điểm, rút gọn RDP.
 * 4. Nắn góc: lệch nhỏ ép vuông, cạnh dài lệch vừa đánh dấu SLANT_SUSPECT
 *    để người dùng chọn, lệch lớn giữ xiên. Hàn đỉnh bằng giao điểm đường thẳng.
 * 5. Ghép nét đôi thành dầm, nhận ô cột theo mật độ mực.
 * ============================================================================
 */

import type {
  CadAngleClass,
  CadColumn,
  CadEdge,
  CadGraph,
  CadLabParams,
  CadLabResult,
  CadRect,
  CadTextBox,
  CadVertex,
} from '../types/cadLab.types';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

const nowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

export function getDefaultCadLabParams(width: number, height: number): CadLabParams {
  const maxDim = Math.max(width, height, 1);
  const weld = Math.max(4, Math.round(maxDim / 200));
  let windowPx = Math.max(15, Math.round(maxDim / 40));
  if (windowPx % 2 === 0) windowPx += 1;
  return {
    thresholdWindowPx: windowPx,
    thresholdBiasPct: 15,
    minComponentPx: Math.max(12, Math.round((maxDim * maxDim) / 40000)),
    rdpEpsilonPx: Math.max(2, Math.round(maxDim / 300)),
    orthoToleranceDeg: 3,
    slantSuspectMaxDeg: 12,
    longEdgePx: Math.round(maxDim * 0.08),
    weldRadiusPx: weld,
    beamGapMinPx: weld + 2,
    beamGapMaxPx: Math.max(weld + 8, Math.round(maxDim * 0.04)),
    columnDensity: 0.15,
    strokeMinLengthPx: Math.round(maxDim * 0.04),
    eraseRects: [],
  };
}

// ---------------------------------------------------------------------------
// 1. Nhị phân hóa
// ---------------------------------------------------------------------------

/** Trả 1 cho điểm mực, 0 cho nền giấy. */
export function binarizeBradley(
  gray: Uint8Array,
  width: number,
  height: number,
  windowPx: number,
  biasPct: number
): Uint8Array {
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + rowSum;
    }
  }
  const half = Math.max(1, windowPx >> 1);
  const k = (100 - biasPct) / 100;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height - 1, y + half);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width - 1, x + half);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * stride + x1 + 1] -
        integral[y0 * stride + x1 + 1] -
        integral[(y1 + 1) * stride + x0] +
        integral[y0 * stride + x0];
      out[y * width + x] = gray[y * width + x] * count <= sum * k ? 1 : 0;
    }
  }
  return out;
}

export function applyEraseRects(bin: Uint8Array, width: number, height: number, rects: CadRect[]): void {
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor(r.x));
    const y0 = Math.max(0, Math.floor(r.y));
    const x1 = Math.min(width, Math.ceil(r.x + r.w));
    const y1 = Math.min(height, Math.ceil(r.y + r.h));
    for (let y = y0; y < y1; y++) {
      bin.fill(0, y * width + x0, y * width + x1);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Thành phần liên thông
// ---------------------------------------------------------------------------

export interface ComponentInfo {
  id: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Nhãn 8 lân cận; nhãn 0 là nền, thành phần bắt đầu từ 1. */
export function labelComponents(
  bin: Uint8Array,
  width: number,
  height: number
): { labels: Int32Array; components: ComponentInfo[] } {
  const labels = new Int32Array(width * height);
  const stack = new Int32Array(width * height);
  const components: ComponentInfo[] = [];
  let next = 1;
  for (let start = 0; start < bin.length; start++) {
    if (!bin[start] || labels[start]) continue;
    const info: ComponentInfo = { id: next, area: 0, minX: width, minY: height, maxX: 0, maxY: 0 };
    let top = 0;
    stack[top++] = start;
    labels[start] = next;
    while (top > 0) {
      const idx = stack[--top];
      const x = idx % width;
      const y = (idx - x) / width;
      info.area++;
      if (x < info.minX) info.minX = x;
      if (x > info.maxX) info.maxX = x;
      if (y < info.minY) info.minY = y;
      if (y > info.maxY) info.maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if ((dx === 0 && dy === 0) || nx < 0 || nx >= width) continue;
          const n = ny * width + nx;
          if (bin[n] && !labels[n]) {
            labels[n] = next;
            stack[top++] = n;
          }
        }
      }
    }
    components.push(info);
    next++;
  }
  return { labels, components };
}

function clearComponent(target: Uint8Array, labels: Int32Array, width: number, c: ComponentInfo): void {
  for (let y = c.minY; y <= c.maxY; y++) {
    for (let x = c.minX; x <= c.maxX; x++) {
      const idx = y * width + x;
      if (labels[idx] === c.id) target[idx] = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Thu mảnh nét
// ---------------------------------------------------------------------------

export function zhangSuenThin(bin: Uint8Array, width: number, height: number): Uint8Array {
  const img = bin.slice();
  for (let x = 0; x < width; x++) {
    img[x] = 0;
    img[(height - 1) * width + x] = 0;
  }
  for (let y = 0; y < height; y++) {
    img[y * width] = 0;
    img[y * width + width - 1] = 0;
  }

  let candidates: number[] = [];
  for (let i = 0; i < img.length; i++) if (img[i]) candidates.push(i);

  const removeList: number[] = [];
  for (let iter = 0; iter < 200; iter++) {
    let changed = false;
    for (let sub = 0; sub < 2; sub++) {
      removeList.length = 0;
      for (const idx of candidates) {
        if (!img[idx]) continue;
        const p2 = img[idx - width];
        const p3 = img[idx - width + 1];
        const p4 = img[idx + 1];
        const p5 = img[idx + width + 1];
        const p6 = img[idx + width];
        const p7 = img[idx + width - 1];
        const p8 = img[idx - 1];
        const p9 = img[idx - width - 1];
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;
        const a =
          (p2 === 0 && p3 === 1 ? 1 : 0) +
          (p3 === 0 && p4 === 1 ? 1 : 0) +
          (p4 === 0 && p5 === 1 ? 1 : 0) +
          (p5 === 0 && p6 === 1 ? 1 : 0) +
          (p6 === 0 && p7 === 1 ? 1 : 0) +
          (p7 === 0 && p8 === 1 ? 1 : 0) +
          (p8 === 0 && p9 === 1 ? 1 : 0) +
          (p9 === 0 && p2 === 1 ? 1 : 0);
        if (a !== 1) continue;
        if (sub === 0) {
          if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue;
        } else if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) {
          continue;
        }
        removeList.push(idx);
      }
      for (const idx of removeList) img[idx] = 0;
      if (removeList.length > 0) changed = true;
    }
    candidates = candidates.filter((idx) => img[idx] === 1);
    if (!changed) break;
  }

  // Bỏ điểm góc bậc thang: điểm chỉ có 2 láng giềng 4-hướng kề chéo nhau thì thừa
  for (const idx of candidates) {
    if (!img[idx]) continue;
    const n = img[idx - width];
    const e = img[idx + 1];
    const s = img[idx + width];
    const w = img[idx - 1];
    const total =
      n + e + s + w + img[idx - width + 1] + img[idx + width + 1] + img[idx + width - 1] + img[idx - width - 1];
    if (total !== 2) continue;
    if ((n && e) || (e && s) || (s && w) || (w && n)) img[idx] = 0;
  }
  return img;
}

// ---------------------------------------------------------------------------
// Hình học cơ bản
// ---------------------------------------------------------------------------

interface Pt {
  x: number;
  y: number;
}

function perpendicularDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

export function rdpSimplify(points: Pt[], epsilon: number): Pt[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const ranges: [number, number][] = [[0, points.length - 1]];
  while (ranges.length > 0) {
    const range = ranges.pop();
    if (!range) break;
    const [s, e] = range;
    let maxD = 0;
    let maxI = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpendicularDistance(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        maxI = i;
      }
    }
    if (maxI >= 0 && maxD > epsilon) {
      keep[maxI] = 1;
      ranges.push([s, maxI], [maxI, e]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** Đưa góc (độ) về [-45, 45) so với lưới vuông góc. */
function foldToAxis(deg: number): number {
  let d = (deg + 45) % 90;
  if (d < 0) d += 90;
  return d - 45;
}

/** Đưa góc đường thẳng (độ) về [0, 180). */
function normalizeLineDeg(deg: number): number {
  let d = deg % 180;
  if (d < 0) d += 180;
  return d;
}

function lineDiffDeg(a: number, b: number): number {
  const d = Math.abs(normalizeLineDeg(a) - normalizeLineDeg(b));
  return Math.min(d, 180 - d);
}

// ---------------------------------------------------------------------------
// Đồ thị làm việc
// ---------------------------------------------------------------------------

interface WVertex {
  x: number;
  y: number;
  alive: boolean;
}

interface WEdge {
  a: number;
  b: number;
  alive: boolean;
  angleClass: CadAngleClass;
  /** Góc đường thẳng đã nắn, độ, [0,180). */
  lineDeg: number;
  /** n·p = offset với n = (-sin, cos) của lineDeg. */
  offset: number;
  pairId?: string;
  beamWidthPx?: number;
}

class WorkGraph {
  vertices: WVertex[] = [];
  edges: WEdge[] = [];

  addVertex(x: number, y: number): number {
    this.vertices.push({ x, y, alive: true });
    return this.vertices.length - 1;
  }

  addEdge(a: number, b: number): number {
    this.edges.push({ a, b, alive: true, angleClass: 'ORTHO', lineDeg: 0, offset: 0 });
    return this.edges.length - 1;
  }

  edgeLength(e: WEdge): number {
    const va = this.vertices[e.a];
    const vb = this.vertices[e.b];
    return Math.hypot(vb.x - va.x, vb.y - va.y);
  }

  edgeDeg(e: WEdge): number {
    const va = this.vertices[e.a];
    const vb = this.vertices[e.b];
    return normalizeLineDeg(Math.atan2(vb.y - va.y, vb.x - va.x) * RAD_TO_DEG);
  }

  incidence(): number[][] {
    const inc: number[][] = this.vertices.map(() => []);
    this.edges.forEach((e, i) => {
      if (!e.alive) return;
      inc[e.a].push(i);
      if (e.b !== e.a) inc[e.b].push(i);
    });
    return inc;
  }

  /** Bỏ cạnh suy biến, cạnh trùng và đỉnh mồ côi. */
  cleanup(): void {
    const seen = new Set<string>();
    for (const e of this.edges) {
      if (!e.alive) continue;
      if (e.a === e.b || !this.vertices[e.a].alive || !this.vertices[e.b].alive) {
        e.alive = false;
        continue;
      }
      const key = e.a < e.b ? `${e.a}-${e.b}` : `${e.b}-${e.a}`;
      if (seen.has(key)) {
        e.alive = false;
        continue;
      }
      seen.add(key);
      if (this.edgeLength(e) < 0.5) {
        this.mergeVertices(e.b, e.a);
        e.alive = false;
      }
    }
    const inc = this.incidence();
    this.vertices.forEach((v, i) => {
      if (v.alive && inc[i].length === 0) v.alive = false;
    });
  }

  /** Gộp đỉnh `from` vào `into`. */
  mergeVertices(from: number, into: number): void {
    if (from === into) return;
    for (const e of this.edges) {
      if (!e.alive) continue;
      if (e.a === from) e.a = into;
      if (e.b === from) e.b = into;
    }
    this.vertices[from].alive = false;
  }
}

// ---------------------------------------------------------------------------
// Dò đồ thị trên khung xương
// ---------------------------------------------------------------------------

function extractSkeletonPolylines(skel: Uint8Array, width: number, height: number): { nodes: Pt[]; polylines: { from: number; to: number; pts: Pt[] }[] } {
  const total = width * height;
  const nb = new Uint8Array(total);
  const offsets = [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1];
  const fourFirst = [-width, 1, width, -1, -width - 1, -width + 1, width - 1, width + 1];
  for (let i = 0; i < total; i++) {
    if (!skel[i]) continue;
    const x = i % width;
    const y = (i - x) / width;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) continue;
    let c = 0;
    for (const o of offsets) c += skel[i + o];
    nb[i] = c;
  }

  const cluster = new Int32Array(total).fill(-1);
  const nodeSum: { sx: number; sy: number; n: number; pixels: number[] }[] = [];
  const queue: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!skel[i] || cluster[i] >= 0) continue;
    const deg = nb[i];
    if (deg === 2 || deg === 0) continue;
    const id = nodeSum.length;
    const entry = { sx: 0, sy: 0, n: 0, pixels: [] as number[] };
    nodeSum.push(entry);
    cluster[i] = id;
    queue.length = 0;
    queue.push(i);
    while (queue.length > 0) {
      const p = queue.pop();
      if (p === undefined) break;
      const px = p % width;
      entry.sx += px;
      entry.sy += (p - px) / width;
      entry.n++;
      entry.pixels.push(p);
      if (nb[p] < 3) continue;
      for (const o of offsets) {
        const q = p + o;
        if (skel[q] && cluster[q] < 0 && nb[q] >= 3) {
          cluster[q] = id;
          queue.push(q);
        }
      }
    }
  }

  const nodes: Pt[] = nodeSum.map((s) => ({ x: s.sx / s.n, y: s.sy / s.n }));
  const toPt = (idx: number): Pt => {
    const x = idx % width;
    return { x, y: (idx - x) / width };
  };
  const visited = new Uint8Array(total);
  const polylines: { from: number; to: number; pts: Pt[] }[] = [];
  const directPairs = new Set<string>();

  const walk = (startCluster: number, first: number, prevStart: number): void => {
    const pts: Pt[] = [toPt(prevStart), toPt(first)];
    visited[first] = 1;
    let prev = prevStart;
    let cur = first;
    for (let guard = 0; guard < total; guard++) {
      let nextNode = -1;
      let nextPath = -1;
      for (const o of fourFirst) {
        const n = cur + o;
        if (n === prev || !skel[n] || nb[n] === 0) continue;
        if (cluster[n] >= 0) {
          if (nextNode < 0) nextNode = n;
        } else if (!visited[n] && nextPath < 0) {
          nextPath = n;
        }
      }
      if (nextNode >= 0) {
        pts.push(toPt(nextNode));
        polylines.push({ from: startCluster, to: cluster[nextNode], pts });
        return;
      }
      if (nextPath < 0) {
        // Đầu cụt không được đánh dấu nút: tạo nút mới tại đây
        const id = nodes.length;
        nodes.push(toPt(cur));
        cluster[cur] = id;
        polylines.push({ from: startCluster, to: id, pts });
        return;
      }
      visited[nextPath] = 1;
      pts.push(toPt(nextPath));
      prev = cur;
      cur = nextPath;
    }
  };

  const baseNodeCount = nodeSum.length;
  for (let c = 0; c < baseNodeCount; c++) {
    for (const p of nodeSum[c].pixels) {
      for (const o of offsets) {
        const q = p + o;
        if (!skel[q] || nb[q] === 0) continue;
        if (cluster[q] === c) continue;
        if (cluster[q] >= 0) {
          const other = cluster[q];
          const key = c < other ? `${c}-${other}` : `${other}-${c}`;
          if (!directPairs.has(key)) {
            directPairs.add(key);
            polylines.push({ from: c, to: other, pts: [toPt(p), toPt(q)] });
          }
          continue;
        }
        if (visited[q]) continue;
        walk(c, q, p);
      }
    }
  }

  // Vòng kín không có nút (khung chữ nhật liền mạch)
  for (let i = 0; i < total; i++) {
    if (!skel[i] || visited[i] || cluster[i] >= 0 || nb[i] !== 2) continue;
    const id = nodes.length;
    nodes.push(toPt(i));
    cluster[i] = id;
    let first = -1;
    for (const o of fourFirst) {
      const q = i + o;
      if (skel[q] && nb[q] > 0 && !visited[q] && cluster[q] < 0) {
        first = q;
        break;
      }
    }
    if (first < 0) continue;
    walk(id, first, i);
  }

  return { nodes, polylines };
}

function buildWorkGraph(skel: Uint8Array, width: number, height: number, rdpEpsilon: number): WorkGraph {
  const { nodes, polylines } = extractSkeletonPolylines(skel, width, height);
  const g = new WorkGraph();
  const nodeVertex = nodes.map((n) => g.addVertex(n.x, n.y));
  for (const pl of polylines) {
    const pts = pl.pts.slice();
    pts[0] = nodes[pl.from];
    pts[pts.length - 1] = nodes[pl.to];
    let simplified: Pt[];
    if (pl.from === pl.to) {
      // Vòng kín: tách tại điểm xa nhất rồi rút gọn hai nửa
      let far = 0;
      let farD = -1;
      for (let i = 1; i < pts.length - 1; i++) {
        const d = Math.hypot(pts[i].x - pts[0].x, pts[i].y - pts[0].y);
        if (d > farD) {
          farD = d;
          far = i;
        }
      }
      if (far === 0) continue;
      const left = rdpSimplify(pts.slice(0, far + 1), rdpEpsilon);
      const right = rdpSimplify(pts.slice(far), rdpEpsilon);
      simplified = [...left, ...right.slice(1)];
    } else {
      simplified = rdpSimplify(pts, rdpEpsilon);
    }
    let prev = nodeVertex[pl.from];
    for (let i = 1; i < simplified.length; i++) {
      const isLast = i === simplified.length - 1;
      const v = isLast ? nodeVertex[pl.to] : g.addVertex(simplified[i].x, simplified[i].y);
      if (v !== prev) g.addEdge(prev, v);
      prev = v;
    }
  }
  g.cleanup();
  return g;
}

// ---------------------------------------------------------------------------
// Dọn đồ thị
// ---------------------------------------------------------------------------

function weldVertices(g: WorkGraph, radius: number): void {
  const alive = g.vertices.map((v, i) => (v.alive ? i : -1)).filter((i) => i >= 0);
  const parent = new Map<number, number>();
  const find = (i: number): number => {
    let r = i;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r) ?? r;
    return r;
  };
  for (const i of alive) parent.set(i, i);
  const cell = Math.max(1, radius);
  const grid = new Map<string, number[]>();
  for (const i of alive) {
    const v = g.vertices[i];
    const key = `${Math.floor(v.x / cell)}:${Math.floor(v.y / cell)}`;
    const list = grid.get(key);
    if (list) list.push(i);
    else grid.set(key, [i]);
  }
  for (const i of alive) {
    const v = g.vertices[i];
    const cx = Math.floor(v.x / cell);
    const cy = Math.floor(v.y / cell);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = grid.get(`${cx + dx}:${cy + dy}`);
        if (!list) continue;
        for (const j of list) {
          if (j <= i) continue;
          const w = g.vertices[j];
          if (Math.hypot(w.x - v.x, w.y - v.y) <= radius) {
            const ri = find(i);
            const rj = find(j);
            if (ri !== rj) parent.set(rj, ri);
          }
        }
      }
    }
  }
  const groups = new Map<number, number[]>();
  for (const i of alive) {
    const r = find(i);
    const list = groups.get(r);
    if (list) list.push(i);
    else groups.set(r, [i]);
  }
  for (const [root, members] of groups) {
    if (members.length < 2) continue;
    let sx = 0;
    let sy = 0;
    for (const m of members) {
      sx += g.vertices[m].x;
      sy += g.vertices[m].y;
    }
    g.vertices[root].x = sx / members.length;
    g.vertices[root].y = sy / members.length;
    for (const m of members) if (m !== root) g.mergeVertices(m, root);
  }
  g.cleanup();
}

/** Bỏ râu ngắn: cạnh có một đầu treo và ngắn hơn ngưỡng. */
function pruneSpurs(g: WorkGraph, maxLen: number): void {
  for (let pass = 0; pass < 3; pass++) {
    const inc = g.incidence();
    let removed = 0;
    for (const e of g.edges) {
      if (!e.alive) continue;
      const da = inc[e.a].length;
      const db = inc[e.b].length;
      const len = g.edgeLength(e);
      const hangingSpur = (da === 1 && db >= 3) || (db === 1 && da >= 3);
      const isolatedDot = da === 1 && db === 1 && len < maxLen;
      if ((hangingSpur && len < maxLen) || isolatedDot) {
        e.alive = false;
        removed++;
      }
    }
    g.cleanup();
    if (removed === 0) break;
  }
}

/** Gộp chuỗi cạnh gần thẳng hàng qua đỉnh bậc 2. */
function mergeStraightChains(g: WorkGraph, maxBendDeg: number, maxDeviation: number): void {
  let changed = true;
  for (let guard = 0; guard < 20 && changed; guard++) {
    changed = false;
    const inc = g.incidence();
    for (let v = 0; v < g.vertices.length; v++) {
      if (!g.vertices[v].alive || inc[v].length !== 2) continue;
      const e1 = g.edges[inc[v][0]];
      const e2 = g.edges[inc[v][1]];
      if (!e1.alive || !e2.alive) continue;
      const u = e1.a === v ? e1.b : e1.a;
      const w = e2.a === v ? e2.b : e2.a;
      if (u === w) continue;
      const bend = lineDiffDeg(g.edgeDeg(e1), g.edgeDeg(e2));
      const dev = perpendicularDistance(g.vertices[v], g.vertices[u], g.vertices[w]);
      if (bend > maxBendDeg && dev > maxDeviation) continue;
      if (bend > maxBendDeg * 3) continue;
      e1.a = u;
      e1.b = w;
      e2.alive = false;
      g.vertices[v].alive = false;
      changed = true;
      inc[u] = inc[u].map((i) => (i === inc[v][1] ? inc[v][0] : i));
      inc[w] = inc[w].map((i) => (i === inc[v][1] ? inc[v][0] : i));
      inc[v] = [];
    }
    g.cleanup();
  }
}

// ---------------------------------------------------------------------------
// 4. Nắn góc và hàn đỉnh
// ---------------------------------------------------------------------------

function estimateAxisDeg(g: WorkGraph, toleranceDeg: number): number {
  const bins = new Float64Array(90);
  for (const e of g.edges) {
    if (!e.alive) continue;
    const bin = Math.floor(foldToAxis(g.edgeDeg(e)) + 45) % 90;
    bins[bin] += g.edgeLength(e);
  }
  let peak = 0;
  let peakVal = -1;
  for (let i = 0; i < 90; i++) {
    let s = 0;
    for (let d = -2; d <= 2; d++) s += bins[(i + d + 90) % 90];
    if (s > peakVal) {
      peakVal = s;
      peak = i;
    }
  }
  const peakDeg = peak - 45 + 0.5;
  let sum = 0;
  let wsum = 0;
  for (const e of g.edges) {
    if (!e.alive) continue;
    const rel = foldToAxis(g.edgeDeg(e) - peakDeg);
    if (Math.abs(rel) > toleranceDeg) continue;
    const len = g.edgeLength(e);
    sum += rel * len;
    wsum += len;
  }
  return foldToAxis(peakDeg + (wsum > 0 ? sum / wsum : 0));
}

function lineNormal(lineDeg: number): Pt {
  const r = lineDeg * DEG_TO_RAD;
  return { x: -Math.sin(r), y: Math.cos(r) };
}

/**
 * Gom các cạnh nối tiếp thẳng hàng xuyên qua nút giao thành một đường chạy.
 * Cạnh biên xiên bị vạch giáp ranh cắt thành nhiều đoạn vẫn được xét như một cạnh dài.
 */
function buildStraightRuns(g: WorkGraph, maxBendDeg: number): number[][] {
  const inc = g.incidence();
  const cosMax = Math.cos(maxBendDeg * DEG_TO_RAD);
  const next = new Map<string, number>();
  for (let v = 0; v < g.vertices.length; v++) {
    const list = inc[v];
    if (!g.vertices[v].alive || list.length < 2) continue;
    const pv = g.vertices[v];
    const dirOut = (ei: number): Pt => {
      const e = g.edges[ei];
      const o = g.vertices[e.a === v ? e.b : e.a];
      const len = Math.hypot(o.x - pv.x, o.y - pv.y) || 1;
      return { x: (o.x - pv.x) / len, y: (o.y - pv.y) / len };
    };
    const candidates: { i: number; j: number; straight: number }[] = [];
    for (let x = 0; x < list.length; x++) {
      for (let y = x + 1; y < list.length; y++) {
        const d1 = dirOut(list[x]);
        const d2 = dirOut(list[y]);
        const straight = -(d1.x * d2.x + d1.y * d2.y);
        if (straight >= cosMax) candidates.push({ i: list[x], j: list[y], straight });
      }
    }
    candidates.sort((a, b) => b.straight - a.straight);
    const used = new Set<number>();
    for (const c of candidates) {
      if (used.has(c.i) || used.has(c.j)) continue;
      used.add(c.i);
      used.add(c.j);
      next.set(`${c.i}:${v}`, c.j);
      next.set(`${c.j}:${v}`, c.i);
    }
  }

  const visited = new Set<number>();
  const runs: number[][] = [];
  g.edges.forEach((seed, si) => {
    if (!seed.alive || visited.has(si)) return;
    visited.add(si);
    const run = [si];
    for (const startVertex of [seed.b, seed.a]) {
      let cur = si;
      let at = startVertex;
      for (let guard = 0; guard < g.edges.length; guard++) {
        const nxt = next.get(`${cur}:${at}`);
        if (nxt === undefined || visited.has(nxt)) break;
        visited.add(nxt);
        if (startVertex === seed.b) run.push(nxt);
        else run.unshift(nxt);
        const ne = g.edges[nxt];
        at = ne.a === at ? ne.b : ne.a;
        cur = nxt;
      }
    }
    runs.push(run);
  });
  return runs;
}

function runEndpoints(g: WorkGraph, run: number[]): { first: Pt; last: Pt; length: number } {
  const e0 = g.edges[run[0]];
  let first: number;
  if (run.length === 1) {
    first = e0.a;
  } else {
    const e1 = g.edges[run[1]];
    first = e0.a === e1.a || e0.a === e1.b ? e0.b : e0.a;
  }
  let at = first;
  let length = 0;
  for (const ei of run) {
    const e = g.edges[ei];
    length += g.edgeLength(e);
    at = e.a === at ? e.b : e.a;
  }
  return { first: g.vertices[first], last: g.vertices[at], length };
}

function classifyEdges(g: WorkGraph, axisDeg: number, p: CadLabParams): void {
  const runs = buildStraightRuns(g, Math.max(6, p.orthoToleranceDeg * 2));
  for (const run of runs) {
    const { first, last, length } = runEndpoints(g, run);
    const deg = normalizeLineDeg(Math.atan2(last.y - first.y, last.x - first.x) * RAD_TO_DEG);
    const dev = foldToAxis(deg - axisDeg);
    const absDev = Math.abs(dev);
    let angleClass: CadAngleClass;
    let lineDeg: number;
    if (absDev <= p.orthoToleranceDeg || (absDev <= p.slantSuspectMaxDeg && length < p.longEdgePx)) {
      angleClass = 'ORTHO';
      lineDeg = normalizeLineDeg(deg - dev);
    } else if (absDev <= p.slantSuspectMaxDeg) {
      angleClass = 'SLANT_SUSPECT';
      lineDeg = deg;
    } else {
      angleClass = 'SLANT';
      lineDeg = deg;
    }
    for (const ei of run) {
      g.edges[ei].angleClass = angleClass;
      g.edges[ei].lineDeg = lineDeg;
    }
  }

  // Gom cạnh xiên gần song song về chung một góc
  const slants = g.edges.filter((e) => e.alive && e.angleClass !== 'ORTHO').sort((a, b) => a.lineDeg - b.lineDeg);
  const used = new Set<WEdge>();
  for (const seed of slants) {
    if (used.has(seed)) continue;
    const group = slants.filter((e) => !used.has(e) && lineDiffDeg(e.lineDeg, seed.lineDeg) <= 4);
    let sx = 0;
    let sy = 0;
    for (const e of group) {
      used.add(e);
      const w = g.edgeLength(e);
      sx += Math.cos(2 * e.lineDeg * DEG_TO_RAD) * w;
      sy += Math.sin(2 * e.lineDeg * DEG_TO_RAD) * w;
    }
    const mean = normalizeLineDeg((Math.atan2(sy, sx) * RAD_TO_DEG) / 2);
    for (const e of group) e.lineDeg = mean;
  }

  // Cả đường chạy nằm trên cùng một đường thẳng
  for (const run of runs) {
    const n = lineNormal(g.edges[run[0]].lineDeg);
    let s = 0;
    let w = 0;
    for (const ei of run) {
      const e = g.edges[ei];
      const va = g.vertices[e.a];
      const vb = g.vertices[e.b];
      const len = g.edgeLength(e);
      s += ((n.x * (va.x + vb.x) + n.y * (va.y + vb.y)) / 2) * len;
      w += len;
    }
    for (const ei of run) g.edges[ei].offset = w > 0 ? s / w : 0;
  }
}

function assignOffsets(g: WorkGraph): void {
  for (const e of g.edges) {
    if (!e.alive) continue;
    const n = lineNormal(e.lineDeg);
    const va = g.vertices[e.a];
    const vb = g.vertices[e.b];
    e.offset = (n.x * (va.x + vb.x) + n.y * (va.y + vb.y)) / 2;
  }
}

/** Ép các cạnh cùng góc và gần cùng đường về chung một đường thẳng. */
function alignCollinear(g: WorkGraph, tolerance: number): void {
  const groups = new Map<string, WEdge[]>();
  for (const e of g.edges) {
    if (!e.alive) continue;
    const key = e.lineDeg.toFixed(3);
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.offset - b.offset);
    let start = 0;
    for (let i = 1; i <= list.length; i++) {
      if (i < list.length && list[i].offset - list[i - 1].offset <= tolerance) continue;
      const run = list.slice(start, i);
      if (run.length > 1) {
        let s = 0;
        let w = 0;
        for (const e of run) {
          const len = g.edgeLength(e);
          s += e.offset * len;
          w += len;
        }
        const mean = w > 0 ? s / w : run[0].offset;
        for (const e of run) e.offset = mean;
      }
      start = i;
    }
  }
}

/** Đặt mỗi đỉnh tại giao điểm (bình phương tối thiểu) của các đường thẳng tới nó. */
function solveVertices(g: WorkGraph): void {
  const inc = g.incidence();
  for (let v = 0; v < g.vertices.length; v++) {
    const vert = g.vertices[v];
    if (!vert.alive || inc[v].length === 0) continue;
    let a11 = 0;
    let a12 = 0;
    let a22 = 0;
    let b1 = 0;
    let b2 = 0;
    let offsetSum = 0;
    let nSum: Pt = { x: 0, y: 0 };
    const seen = new Set<string>();
    for (const ei of inc[v]) {
      const e = g.edges[ei];
      const key = `${e.lineDeg.toFixed(3)}:${e.offset.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const n = lineNormal(e.lineDeg);
      a11 += n.x * n.x;
      a12 += n.x * n.y;
      a22 += n.y * n.y;
      b1 += n.x * e.offset;
      b2 += n.y * e.offset;
      offsetSum += e.offset;
      nSum = n;
    }
    const det = a11 * a22 - a12 * a12;
    if (seen.size >= 2 && Math.abs(det) > 1e-3) {
      vert.x = (a22 * b1 - a12 * b2) / det;
      vert.y = (a11 * b2 - a12 * b1) / det;
    } else {
      const c = offsetSum / seen.size;
      const d = nSum.x * vert.x + nSum.y * vert.y - c;
      vert.x -= d * nSum.x;
      vert.y -= d * nSum.y;
    }
  }
}

function segmentIntersection(p: Pt, dir: Pt, a: Pt, b: Pt): { t: number; s: number } | null {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const denom = dir.x * ey - dir.y * ex;
  if (Math.abs(denom) < 1e-9) return null;
  const qx = a.x - p.x;
  const qy = a.y - p.y;
  const t = (qx * ey - qy * ex) / denom;
  const s = (qx * dir.y - qy * dir.x) / denom;
  return { t, s };
}

/** Kéo dài đầu treo tới cạnh gần nhất trong tầm với để khép góc và chữ T. */
function closeDanglingEnds(g: WorkGraph, reach: number): void {
  for (let pass = 0; pass < 2; pass++) {
    const inc = g.incidence();
    for (let v = 0; v < g.vertices.length; v++) {
      if (!g.vertices[v].alive || inc[v].length !== 1) continue;
      const own = g.edges[inc[v][0]];
      if (!own.alive) continue;
      const u = own.a === v ? own.b : own.a;
      const pv = g.vertices[v];
      const pu = g.vertices[u];
      const len = Math.hypot(pv.x - pu.x, pv.y - pu.y);
      if (len < 1e-6) continue;
      const dir = { x: (pv.x - pu.x) / len, y: (pv.y - pu.y) / len };
      let best: { edge: number; t: number; s: number } | null = null;
      for (let ei = 0; ei < g.edges.length; ei++) {
        const f = g.edges[ei];
        if (!f.alive || f === own || f.a === v || f.b === v) continue;
        const fa = g.vertices[f.a];
        const fb = g.vertices[f.b];
        const flen = Math.hypot(fb.x - fa.x, fb.y - fa.y);
        if (flen < 1e-6) continue;
        const hit = segmentIntersection(pv, dir, fa, fb);
        if (!hit || hit.t < -reach * 0.5 || hit.t > reach) continue;
        const slack = reach / flen;
        if (hit.s < -slack || hit.s > 1 + slack) continue;
        if (!best || Math.abs(hit.t) < Math.abs(best.t)) best = { edge: ei, t: hit.t, s: hit.s };
      }
      if (!best) continue;
      const f = g.edges[best.edge];
      const x = pv.x + dir.x * best.t;
      const y = pv.y + dir.y * best.t;
      const fa = g.vertices[f.a];
      const fb = g.vertices[f.b];
      const distA = Math.hypot(fa.x - x, fa.y - y);
      const distB = Math.hypot(fb.x - x, fb.y - y);
      if (distA <= reach && (best.s <= 0.5 || distA <= distB)) {
        fa.x = x;
        fa.y = y;
        g.mergeVertices(v, f.a);
      } else if (distB <= reach) {
        fb.x = x;
        fb.y = y;
        g.mergeVertices(v, f.b);
      } else {
        // Chữ T: tách cạnh f tại giao điểm
        pv.x = x;
        pv.y = y;
        const oldB = f.b;
        f.b = v;
        const ni = g.addEdge(v, oldB);
        const nf = g.edges[ni];
        nf.angleClass = f.angleClass;
        nf.lineDeg = f.lineDeg;
        nf.offset = f.offset;
      }
      g.cleanup();
      inc.splice(0, inc.length, ...g.incidence());
    }
  }
}

/** Gộp đỉnh bậc 2 nằm giữa hai cạnh cùng một đường thẳng sau khi nắn. */
function mergeCollinearDegreeTwo(g: WorkGraph): void {
  let changed = true;
  for (let guard = 0; guard < 20 && changed; guard++) {
    changed = false;
    const inc = g.incidence();
    for (let v = 0; v < g.vertices.length; v++) {
      if (!g.vertices[v].alive || inc[v].length !== 2) continue;
      const e1 = g.edges[inc[v][0]];
      const e2 = g.edges[inc[v][1]];
      if (!e1.alive || !e2.alive) continue;
      if (Math.abs(e1.lineDeg - e2.lineDeg) > 1e-6 || Math.abs(e1.offset - e2.offset) > 1e-3) continue;
      const u = e1.a === v ? e1.b : e1.a;
      const w = e2.a === v ? e2.b : e2.a;
      if (u === w) continue;
      e1.a = u;
      e1.b = w;
      if (e2.angleClass === 'SLANT_SUSPECT') e1.angleClass = 'SLANT_SUSPECT';
      e2.alive = false;
      g.vertices[v].alive = false;
      changed = true;
      break;
    }
    if (changed) g.cleanup();
  }
}

// ---------------------------------------------------------------------------
// 5. Cấu kiện: nét đôi dầm, ô cột
// ---------------------------------------------------------------------------

function pairBeams(g: WorkGraph, gapMin: number, gapMax: number): number {
  for (const e of g.edges) {
    delete e.pairId;
    delete e.beamWidthPx;
  }
  const live = g.edges.map((e, i) => ({ e, i })).filter(({ e }) => e.alive);
  const best = new Map<number, { j: number; d: number }>();
  for (let x = 0; x < live.length; x++) {
    const ei = live[x];
    const dirI = { x: Math.cos(ei.e.lineDeg * DEG_TO_RAD), y: Math.sin(ei.e.lineDeg * DEG_TO_RAD) };
    const ia = g.vertices[ei.e.a];
    const ib = g.vertices[ei.e.b];
    const iMin = Math.min(dirI.x * ia.x + dirI.y * ia.y, dirI.x * ib.x + dirI.y * ib.y);
    const iMax = Math.max(dirI.x * ia.x + dirI.y * ia.y, dirI.x * ib.x + dirI.y * ib.y);
    for (let y = 0; y < live.length; y++) {
      if (x === y) continue;
      const ej = live[y];
      if (lineDiffDeg(ei.e.lineDeg, ej.e.lineDeg) > 2) continue;
      const ja = g.vertices[ej.e.a];
      const jb = g.vertices[ej.e.b];
      const n = lineNormal(ei.e.lineDeg);
      const d = Math.abs(n.x * (ja.x + jb.x) / 2 + n.y * (ja.y + jb.y) / 2 - ei.e.offset);
      if (d < gapMin || d > gapMax) continue;
      const jMin = Math.min(dirI.x * ja.x + dirI.y * ja.y, dirI.x * jb.x + dirI.y * jb.y);
      const jMax = Math.max(dirI.x * ja.x + dirI.y * ja.y, dirI.x * jb.x + dirI.y * jb.y);
      const overlap = Math.min(iMax, jMax) - Math.max(iMin, jMin);
      const shorter = Math.min(iMax - iMin, jMax - jMin);
      if (shorter <= 0 || overlap / shorter < 0.5) continue;
      const cur = best.get(ei.i);
      if (!cur || d < cur.d) best.set(ei.i, { j: ej.i, d });
    }
  }
  let pairs = 0;
  for (const [i, { j, d }] of best) {
    if (i > j) continue;
    const back = best.get(j);
    if (!back || back.j !== i) continue;
    pairs++;
    const pairId = `P-${pairs}`;
    for (const idx of [i, j]) {
      g.edges[idx].pairId = pairId;
      g.edges[idx].beamWidthPx = Math.round(d * 10) / 10;
    }
  }
  return pairs;
}

interface BeamBand {
  lineDeg: number;
  lo: number;
  hi: number;
  /** Phạm vi dọc theo phương của dải. */
  tMin: number;
  tMax: number;
}

function collectBeamBands(g: WorkGraph): BeamBand[] {
  const bands = new Map<string, BeamBand>();
  const byPair = new Map<string, WEdge[]>();
  for (const e of g.edges) {
    if (!e.alive || !e.pairId) continue;
    const list = byPair.get(e.pairId);
    if (list) list.push(e);
    else byPair.set(e.pairId, [e]);
  }
  for (const [, pair] of byPair) {
    if (pair.length !== 2) continue;
    const lineDeg = pair[0].lineDeg;
    const lo = Math.min(pair[0].offset, pair[1].offset);
    const hi = Math.max(pair[0].offset, pair[1].offset);
    const dir = { x: Math.cos(lineDeg * DEG_TO_RAD), y: Math.sin(lineDeg * DEG_TO_RAD) };
    let tMin = Infinity;
    let tMax = -Infinity;
    for (const e of pair) {
      for (const vi of [e.a, e.b]) {
        const t = dir.x * g.vertices[vi].x + dir.y * g.vertices[vi].y;
        tMin = Math.min(tMin, t);
        tMax = Math.max(tMax, t);
      }
    }
    const key = `${lineDeg.toFixed(2)}:${Math.round(lo)}:${Math.round(hi)}`;
    const cur = bands.get(key);
    if (cur) {
      cur.tMin = Math.min(cur.tMin, tMin);
      cur.tMax = Math.max(cur.tMax, tMax);
    } else {
      bands.set(key, { lineDeg, lo, hi, tMin, tMax });
    }
  }
  return [...bands.values()];
}

/**
 * Cột là ô giao của hai dải dầm nét đôi có mực gạch chéo bên trong.
 * Ô giao trống (dầm chỉ cắt nhau) không phải cột.
 */
function detectColumnsAtBeamCrossings(
  g: WorkGraph,
  ink: Uint8Array,
  width: number,
  height: number,
  p: CadLabParams
): { columns: CadColumn[]; interiors: { band1: BeamBand; band2: BeamBand; margin: number }[] } {
  const bands = collectBeamBands(g);
  const columns: CadColumn[] = [];
  const interiors: { band1: BeamBand; band2: BeamBand; margin: number }[] = [];
  const reach = p.weldRadiusPx * 2;
  const margin = Math.max(1.5, p.beamGapMinPx * 0.3);
  const seen = new Set<string>();
  for (let i = 0; i < bands.length; i++) {
    for (let j = i + 1; j < bands.length; j++) {
      const a = bands[i];
      const b = bands[j];
      if (lineDiffDeg(a.lineDeg, b.lineDeg) < 45) continue;
      const na = lineNormal(a.lineDeg);
      const nb = lineNormal(b.lineDeg);
      const det = na.x * nb.y - na.y * nb.x;
      if (Math.abs(det) < 1e-6) continue;
      const solve = (ca: number, cb: number): Pt => ({
        x: (ca * nb.y - na.y * cb) / det,
        y: (na.x * cb - ca * nb.x) / det,
      });
      const corners = [solve(a.lo, b.lo), solve(a.lo, b.hi), solve(a.hi, b.lo), solve(a.hi, b.hi)];
      const center = solve((a.lo + a.hi) / 2, (b.lo + b.hi) / 2);
      const dirA = { x: Math.cos(a.lineDeg * DEG_TO_RAD), y: Math.sin(a.lineDeg * DEG_TO_RAD) };
      const dirB = { x: Math.cos(b.lineDeg * DEG_TO_RAD), y: Math.sin(b.lineDeg * DEG_TO_RAD) };
      const tA = dirA.x * center.x + dirA.y * center.y;
      const tB = dirB.x * center.x + dirB.y * center.y;
      const halfA = (b.hi - b.lo) / 2 + reach;
      const halfB = (a.hi - a.lo) / 2 + reach;
      if (tA < a.tMin - halfA || tA > a.tMax + halfA) continue;
      if (tB < b.tMin - halfB || tB > b.tMax + halfB) continue;

      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      const x0 = Math.max(0, Math.floor(Math.min(...xs)));
      const x1 = Math.min(width - 1, Math.ceil(Math.max(...xs)));
      const y0 = Math.max(0, Math.floor(Math.min(...ys)));
      const y1 = Math.min(height - 1, Math.ceil(Math.max(...ys)));
      let total = 0;
      let inked = 0;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const da = na.x * x + na.y * y;
          const db = nb.x * x + nb.y * y;
          if (da < a.lo + margin || da > a.hi - margin || db < b.lo + margin || db > b.hi - margin) continue;
          total++;
          inked += ink[y * width + x];
        }
      }
      if (total < 4 || inked / total < p.columnDensity) continue;
      const key = `${Math.round(center.x / 3)}:${Math.round(center.y / 3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      columns.push({
        id: `C-${columns.length + 1}`,
        cx: round2(center.x),
        cy: round2(center.y),
        w: round2(x1 - x0 + 1),
        h: round2(y1 - y0 + 1),
      });
      interiors.push({ band1: a, band2: b, margin });
    }
  }
  return { columns, interiors };
}

/** Bỏ nét gạch rối bên trong ô cột: cạnh có trung điểm nằm hẳn trong lòng ô. */
function removeColumnScribbles(
  g: WorkGraph,
  interiors: { band1: BeamBand; band2: BeamBand; margin: number }[]
): void {
  for (const { band1, band2, margin } of interiors) {
    const n1 = lineNormal(band1.lineDeg);
    const n2 = lineNormal(band2.lineDeg);
    for (const e of g.edges) {
      if (!e.alive) continue;
      const va = g.vertices[e.a];
      const vb = g.vertices[e.b];
      const mx = (va.x + vb.x) / 2;
      const my = (va.y + vb.y) / 2;
      const d1 = n1.x * mx + n1.y * my;
      const d2 = n2.x * mx + n2.y * my;
      if (d1 > band1.lo + margin && d1 < band1.hi - margin && d2 > band2.lo + margin && d2 < band2.hi - margin) {
        e.alive = false;
      }
    }
  }
  g.cleanup();
}


// ---------------------------------------------------------------------------
// Tách chữ
// ---------------------------------------------------------------------------

/** Thành phần nhỏ có khung xương gần một đường thẳng dài thì là nét vẽ (vạch giáp ranh), còn lại là chữ. */
function isStraightStroke(
  skel: Uint8Array,
  labels: Int32Array,
  width: number,
  c: ComponentInfo,
  minLength: number
): boolean {
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let y = c.minY; y <= c.maxY; y++) {
    for (let x = c.minX; x <= c.maxX; x++) {
      const idx = y * width + x;
      if (labels[idx] !== c.id || !skel[idx]) continue;
      n++;
      sx += x;
      sy += y;
      sxx += x * x;
      syy += y * y;
      sxy += x * y;
    }
  }
  if (n < 3) return false;
  const mx = sx / n;
  const my = sy / n;
  const cxx = sxx / n - mx * mx;
  const cyy = syy / n - my * my;
  const cxy = sxy / n - mx * my;
  const theta = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);
  let tMin = Infinity;
  let tMax = -Infinity;
  let maxPerp = 0;
  for (let y = c.minY; y <= c.maxY; y++) {
    for (let x = c.minX; x <= c.maxX; x++) {
      const idx = y * width + x;
      if (labels[idx] !== c.id || !skel[idx]) continue;
      const t = (x - mx) * dx + (y - my) * dy;
      const perp = Math.abs(-(x - mx) * dy + (y - my) * dx);
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
      if (perp > maxPerp) maxPerp = perp;
    }
  }
  const length = tMax - tMin;
  return length >= minLength && maxPerp <= Math.max(2.5, length * 0.06);
}

function mergeTextBoxes(rects: CadRect[]): CadRect[] {
  const boxes = rects.map((r) => ({ ...r }));
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const gap = 0.6 * Math.max(a.h, b.h);
        const sepX = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
        const sepY = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
        if (sepX <= gap && sepY <= gap * 0.5) {
          const x = Math.min(a.x, b.x);
          const y = Math.min(a.y, b.y);
          boxes[i] = { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
          boxes.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return boxes;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export function vectorizeSketch(gray: Uint8Array, width: number, height: number, params: CadLabParams): CadLabResult {
  const t0 = nowMs();
  const maxDim = Math.max(width, height);

  const ink = binarizeBradley(gray, width, height, params.thresholdWindowPx, params.thresholdBiasPct);
  applyEraseRects(ink, width, height, params.eraseRects);

  const { labels, components } = labelComponents(ink, width, height);
  for (const c of components) {
    if (c.area < params.minComponentPx) clearComponent(ink, labels, width, c);
  }

  const skel = zhangSuenThin(ink, width, height);

  // Thành phần lớn là khung; thành phần nhỏ là chữ trừ khi là một nét thẳng dài
  const bigSide = maxDim * 0.12;
  const textRects: CadRect[] = [];
  for (const c of components) {
    if (c.area < params.minComponentPx) continue;
    const side = Math.max(c.maxX - c.minX + 1, c.maxY - c.minY + 1);
    if (side >= bigSide) continue;
    if (isStraightStroke(skel, labels, width, c, params.strokeMinLengthPx)) continue;
    clearComponent(ink, labels, width, c);
    clearComponent(skel, labels, width, c);
    textRects.push({ x: c.minX, y: c.minY, w: c.maxX - c.minX + 1, h: c.maxY - c.minY + 1 });
  }

  const g = buildWorkGraph(skel, width, height, params.rdpEpsilonPx);

  const reach = params.weldRadiusPx * 2.5;
  pruneSpurs(g, reach);
  weldVertices(g, params.weldRadiusPx);
  mergeStraightChains(g, params.orthoToleranceDeg, params.rdpEpsilonPx);

  const axisDeg = estimateAxisDeg(g, params.orthoToleranceDeg);
  const collinearTol = Math.max(1, Math.min(params.rdpEpsilonPx + 1, params.beamGapMinPx - 2));

  classifyEdges(g, axisDeg, params);
  alignCollinear(g, collinearTol);
  solveVertices(g);
  closeDanglingEnds(g, reach);
  pruneSpurs(g, reach);
  assignOffsets(g);
  alignCollinear(g, collinearTol);
  solveVertices(g);
  weldVertices(g, Math.max(1, params.weldRadiusPx * 0.5));
  solveVertices(g);
  mergeCollinearDegreeTwo(g);

  pairBeams(g, params.beamGapMinPx, params.beamGapMaxPx);
  const { columns, interiors } = detectColumnsAtBeamCrossings(g, ink, width, height, params);
  if (interiors.length > 0) {
    // Nét gạch trong ô cột được thay bằng ký hiệu cột
    removeColumnScribbles(g, interiors);
    pruneSpurs(g, reach);
    mergeCollinearDegreeTwo(g);
  }
  const beamPairCount = pairBeams(g, params.beamGapMinPx, params.beamGapMaxPx);

  // Xuất đồ thị với mã ổn định
  const vertexIds = new Map<number, string>();
  const vertices: CadVertex[] = [];
  g.vertices.forEach((v, i) => {
    if (!v.alive) return;
    const id = `V${vertices.length + 1}`;
    vertexIds.set(i, id);
    vertices.push({ id, x: round2(v.x), y: round2(v.y) });
  });
  const edges: CadEdge[] = [];
  for (const e of g.edges) {
    if (!e.alive) continue;
    const a = vertexIds.get(e.a);
    const b = vertexIds.get(e.b);
    if (!a || !b) continue;
    edges.push({
      id: `E${edges.length + 1}`,
      a,
      b,
      kind: e.pairId ? 'BEAM_PAIR' : 'SINGLE',
      angleClass: e.angleClass,
      ...(e.pairId ? { pairId: e.pairId, beamWidthPx: e.beamWidthPx } : {}),
    });
  }
  const textBoxes: CadTextBox[] = mergeTextBoxes(textRects).map((r, i) => ({
    id: `T${i + 1}`,
    x: r.x - 2,
    y: r.y - 2,
    w: r.w + 4,
    h: r.h + 4,
    text: '',
    source: 'DETECTED',
  }));

  const graph: CadGraph = {
    width,
    height,
    axisAngleDeg: round2(axisDeg),
    underlayRotateDeg: 0,
    vertices,
    edges,
    columns,
    textBoxes,
  };
  return {
    graph,
    stats: {
      vertexCount: vertices.length,
      edgeCount: edges.length,
      beamPairCount,
      columnCount: columns.length,
      slantCount: edges.filter((e) => e.angleClass === 'SLANT').length,
      slantSuspectCount: edges.filter((e) => e.angleClass === 'SLANT_SUSPECT').length,
      textCandidateCount: textBoxes.length,
      computeTimeMs: Math.round(nowMs() - t0),
    },
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
