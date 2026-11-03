import assert from 'node:assert/strict';
import { getDefaultCadLabParams, vectorizeSketch } from '../src/features/cad-lab/engine/cadLabDspCore';
import type { CadGraph, CadLabParams, CadLabResult } from '../src/features/cad-lab/types/cadLab.types';
import { encodeDxfText, renderCadDxf } from '../src/features/cad-lab/utils/cadDxfWriter';
import {
  addColumn,
  addEdge,
  addTextBox,
  deleteEdge,
  moveVertex,
  resolveAllSuspectEdges,
  setEdgeAngleClass,
  straightenToAxis,
} from '../src/features/cad-lab/utils/cadGraphEdit';
import { renderCadSvg } from '../src/features/cad-lab/utils/cadSvgRenderer';
import { blankSketch, drawLine, drawPolygon, drawPseudoText, fillRect } from './fixtures/cadSketchFixtures';
import type { SketchImage } from './fixtures/cadSketchFixtures';

const run = (img: SketchImage, patch: Partial<CadLabParams> = {}): CadLabResult =>
  vectorizeSketch(img.gray, img.width, img.height, { ...getDefaultCadLabParams(img.width, img.height), ...patch });

const vertexOf = (g: CadGraph, id: string) => {
  const v = g.vertices.find((item) => item.id === id);
  assert.ok(v, `Thiếu đỉnh ${id}`);
  return v;
};

/** Góc đường thẳng của cạnh so với trục nhà, gập về [-45, 45). */
const edgeDevDeg = (g: CadGraph, edgeId: string): number => {
  const e = g.edges.find((item) => item.id === edgeId);
  assert.ok(e);
  const a = vertexOf(g, e.a);
  const b = vertexOf(g, e.b);
  const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI - g.axisAngleDeg;
  let d = (deg + 45) % 90;
  if (d < 0) d += 90;
  return d - 45;
};

const degreeOf = (g: CadGraph): Map<string, number> => {
  const deg = new Map<string, number>();
  for (const e of g.edges) {
    deg.set(e.a, (deg.get(e.a) ?? 0) + 1);
    deg.set(e.b, (deg.get(e.b) ?? 0) + 1);
  }
  return deg;
};

const describe = (r: CadLabResult): string =>
  JSON.stringify({ stats: r.stats, axis: r.graph.axisAngleDeg, v: r.graph.vertices, e: r.graph.edges.map((e) => `${e.a}-${e.b}:${e.angleClass}:${e.kind}`) });

// 1. Chữ nhật vẽ rung tay ±2° về đúng vuông góc
{
  const img = blankSketch(600, 420);
  drawLine(img, 80, 80, 520, 95);
  drawLine(img, 520, 95, 508, 340);
  drawLine(img, 508, 340, 72, 330);
  drawLine(img, 72, 330, 80, 80);
  const r = run(img);
  assert.equal(r.graph.edges.length, 4, describe(r));
  assert.equal(r.graph.vertices.length, 4, describe(r));
  for (const e of r.graph.edges) {
    assert.equal(e.angleClass, 'ORTHO', describe(r));
    assert.ok(Math.abs(edgeDevDeg(r.graph, e.id)) < 0.01, `Cạnh ${e.id} chưa vuông: ${describe(r)}`);
  }
}

// 2. Nhà hình thang: cạnh đáy xiên 5° được giữ để người dùng chọn, không tự ép vuông
{
  const img = blankSketch(700, 460);
  // Đáy xiên đi lên ~5° từ trái sang phải: dài 520px, chênh 45px, giống ảnh mẫu
  drawPolygon(img, [[80, 80], [600, 80], [600, 330], [80, 375]]);
  const r = run(img);
  assert.ok(Math.abs(r.graph.axisAngleDeg) < 0.5, `Cạnh xiên không được kéo lệch trục nhà: ${describe(r)}`);
  const slanted = r.graph.edges.filter((e) => e.angleClass === 'SLANT_SUSPECT');
  assert.equal(slanted.length, 1, describe(r));
  const dev = Math.abs(edgeDevDeg(r.graph, slanted[0].id));
  assert.ok(dev > 4 && dev < 6, `Cạnh xiên phải giữ ~5°, đang là ${dev}`);
  for (const e of r.graph.edges.filter((item) => item.angleClass === 'ORTHO')) {
    assert.ok(Math.abs(edgeDevDeg(r.graph, e.id)) < 0.01, describe(r));
  }
  assert.equal(r.graph.edges.length, 4, describe(r));
}

// 3. Giật cấp chữ L: 6 đỉnh, mọi cạnh vuông
{
  const img = blankSketch(600, 460);
  drawPolygon(img, [[80, 80], [500, 82], [498, 380], [282, 378], [284, 250], [78, 252]]);
  const r = run(img);
  assert.equal(r.graph.vertices.length, 6, describe(r));
  assert.equal(r.graph.edges.length, 6, describe(r));
  for (const e of r.graph.edges) {
    assert.equal(e.angleClass, 'ORTHO');
    assert.ok(Math.abs(edgeDevDeg(r.graph, e.id)) < 0.01);
  }
}

// 4. Hàn đỉnh: một nét dừng thiếu 6px, một nét vượt 5px tại góc
{
  const img = blankSketch(600, 420);
  drawLine(img, 80, 80, 514, 80); // thiếu 6px so với góc phải trên (520)
  drawLine(img, 520, 75, 520, 340); // vượt 5px phía trên
  drawLine(img, 520, 340, 80, 340);
  drawLine(img, 80, 340, 80, 80);
  const r = run(img);
  const deg = degreeOf(r.graph);
  for (const [id, d] of deg) assert.equal(d, 2, `Đỉnh ${id} bậc ${d}: ${describe(r)}`);
  assert.equal(r.graph.edges.length, 4, describe(r));
}

// 5. Nét đôi cách 15px ghép thành dầm
{
  const img = blankSketch(600, 300);
  drawLine(img, 60, 120, 540, 120);
  drawLine(img, 60, 135, 540, 135);
  const r = run(img);
  const beams = r.graph.edges.filter((e) => e.kind === 'BEAM_PAIR');
  assert.equal(beams.length, 2, describe(r));
  assert.equal(beams[0].pairId, beams[1].pairId);
  assert.ok(Math.abs((beams[0].beamWidthPx ?? 0) - 15) <= 1.5, describe(r));
}

// 6. Chữ rời khung tách thành ô chữ ứng viên, không sinh cạnh
{
  const img = blankSketch(600, 420);
  drawPolygon(img, [[80, 80], [520, 80], [520, 340], [80, 340]]);
  drawPseudoText(img, 300, 370, 16);
  const r = run(img);
  assert.equal(r.graph.edges.length, 4, describe(r));
  assert.equal(r.graph.textBoxes.length, 1, describe(r));
  const t = r.graph.textBoxes[0];
  assert.ok(t.y > 350 && t.x > 280 && t.x < 320, JSON.stringify(t));
  assert.equal(t.text, '');
}

// 7. Ô giao dầm có gạch chéo là cột; ô giao trống và góc nét đơn thì không
{
  const img = blankSketch(640, 420);
  drawLine(img, 60, 150, 580, 150);
  drawLine(img, 60, 168, 580, 168);
  drawLine(img, 200, 60, 200, 360);
  drawLine(img, 218, 60, 218, 360);
  drawLine(img, 400, 60, 400, 360);
  drawLine(img, 418, 60, 418, 360);
  // Gạch chéo trong ô giao trái
  drawLine(img, 202, 166, 216, 152, 2);
  drawLine(img, 202, 160, 210, 152, 2);
  drawLine(img, 208, 166, 216, 158, 2);
  fillRect(img, 205, 155, 8, 8);
  // Một khung nét đơn riêng để chắc góc thường không bị nhận nhầm
  drawPolygon(img, [[480, 250], [600, 250], [600, 380], [480, 380]]);
  const r = run(img);
  assert.equal(r.graph.columns.length, 1, describe(r));
  const c = r.graph.columns[0];
  assert.ok(Math.abs(c.cx - 209) < 3 && Math.abs(c.cy - 159) < 3, JSON.stringify(c));
  // Nét gạch bên trong ô cột không còn là cạnh
  const byId = new Map(r.graph.vertices.map((v) => [v.id, v]));
  for (const e of r.graph.edges) {
    const a = byId.get(e.a);
    const b = byId.get(e.b);
    assert.ok(a && b);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    assert.ok(!(mx > 203 && mx < 215 && my > 153 && my < 165), `Còn nét gạch trong ô cột: ${describe(r)}`);
  }
}

// 8. DXF đủ khung R12, số LINE khớp cạnh + cột, chữ tiếng Việt viết dạng \U+
{
  const img = blankSketch(600, 420);
  drawPolygon(img, [[80, 80], [520, 80], [520, 340], [80, 340]]);
  const r = run(img);
  let g = addTextBox(r.graph, { x: 300, y: 200 }, 'Tầng trệt', 20);
  g = addColumn(g, { x: 80, y: 80 }, 16);
  const dxf = renderCadDxf(g);
  for (const marker of ['SECTION', 'HEADER', 'AC1009', 'TABLES', 'ENTITIES', 'EOF']) {
    assert.ok(dxf.split('\n').includes(marker), `DXF thiếu ${marker}`);
  }
  const lines = dxf.split('\n');
  const countEntity = (name: string): number => lines.filter((l, i) => l === name && lines[i - 1] === '0').length;
  const hatchLines = lines.filter((l, i) => l === 'COT' && lines[i - 1] === '8').length;
  assert.equal(countEntity('LINE'), g.edges.length + hatchLines);
  assert.ok(hatchLines >= 4, 'Cột phải có khung 4 nét và gạch chéo');
  assert.equal(countEntity('TEXT'), 1);
  assert.ok(dxf.includes('T\\U+1EA7ng tr\\U+1EC7t'), 'Chữ tiếng Việt phải mã hóa \\U+');
  assert.equal(encodeDxfText('20x20'), '20x20');
  // Trục Y lật: đỉnh y=80 trong ảnh cao 420 thành 340 trong DXF
  assert.ok(dxf.includes('\n20\n340.000\n') || dxf.includes('\n20\n339.'), 'Trục Y phải lật theo chiều cao ảnh');

  const svg = renderCadSvg(g);
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  assert.equal((svg.match(/<line /g) ?? []).length - 1, g.edges.length, 'Mỗi cạnh một <line>, trừ nét mẫu gạch chéo');
  assert.ok(svg.includes('Tầng trệt'));
  // Ô chữ phát hiện tự động chưa điền thì không xuất
  const withCandidate = { ...g, textBoxes: [...g.textBoxes, { id: 'T99', x: 1, y: 1, w: 10, h: 10, text: '', source: 'DETECTED' as const }] };
  assert.equal(renderCadDxf(withCandidate).split('\n').filter((l, i, arr) => l === 'TEXT' && arr[i - 1] === '0').length, 1);
}

// 9. Thao tác sửa: ép vuông, giữ xiên, xoay thẳng, xóa cạnh dầm, kéo đỉnh khóa vuông góc
{
  const img = blankSketch(700, 460);
  drawPolygon(img, [[80, 80], [600, 80], [600, 330], [80, 375]]);
  const r = run(img);
  const suspect = r.graph.edges.find((e) => e.angleClass === 'SLANT_SUSPECT');
  assert.ok(suspect);
  const squared = setEdgeAngleClass(r.graph, suspect.id, 'ORTHO');
  assert.ok(Math.abs(edgeDevDeg(squared, suspect.id)) < 0.01, 'Ép vuông phải nắn cạnh về trục');
  assert.equal(r.graph.edges.find((e) => e.id === suspect.id)?.angleClass, 'SLANT_SUSPECT', 'Không được sửa đồ thị cũ');
  const kept = setEdgeAngleClass(r.graph, suspect.id, 'SLANT');
  assert.deepEqual(kept.vertices, r.graph.vertices, 'Giữ xiên không đổi hình');
  assert.equal(resolveAllSuspectEdges(r.graph, 'SLANT').edges.filter((e) => e.angleClass === 'SLANT_SUSPECT').length, 0);

  const tilted = { ...r.graph, axisAngleDeg: 2 };
  const straight = straightenToAxis(tilted);
  assert.equal(straight.axisAngleDeg, 0);
  assert.equal(straight.underlayRotateDeg, -2);

  // Kéo đỉnh góc với khóa vuông góc: hai cạnh ORTHO nối vào vẫn ngang/dọc
  const orthoCorner = r.graph.vertices.find((v) => {
    const inc = r.graph.edges.filter((e) => e.a === v.id || e.b === v.id);
    return inc.length === 2 && inc.every((e) => e.angleClass === 'ORTHO');
  });
  assert.ok(orthoCorner);
  const moved = moveVertex(r.graph, orthoCorner.id, { x: orthoCorner.x + 13, y: orthoCorner.y - 9 }, true);
  for (const e of moved.edges.filter((item) => item.a === orthoCorner.id || item.b === orthoCorner.id)) {
    assert.ok(Math.abs(edgeDevDeg(moved, e.id)) < 0.01, 'Khóa vuông góc phải giữ cạnh ngang/dọc');
  }

  const beamImg = blankSketch(600, 300);
  drawLine(beamImg, 60, 120, 540, 120);
  drawLine(beamImg, 60, 135, 540, 135);
  const beam = run(beamImg);
  const afterDelete = deleteEdge(beam.graph, beam.graph.edges[0].id);
  assert.equal(afterDelete.edges.length, 1);
  assert.equal(afterDelete.edges[0].kind, 'SINGLE', 'Xóa một nét dầm thì nét còn lại thành nét đơn');
  assert.equal(afterDelete.vertices.length, 2, 'Xóa cạnh thì bỏ đỉnh mồ côi');

  const withEdge = addEdge(r.graph, { x: 10, y: 10 }, { x: 200, y: 40 }, 5, true);
  const added = withEdge.edges[withEdge.edges.length - 1];
  assert.ok(Math.abs(edgeDevDeg(withEdge, added.id)) < 0.01, 'Vẽ nét khi khóa vuông góc phải nằm trên trục');
}

console.log('cad-lab: OK');
