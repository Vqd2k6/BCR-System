import assert from 'node:assert/strict';
import {
  adjustHexLightness,
  buildMetroFeatures,
  buildParcelFootprintsCollection,
  buildParcelsFeatureCollection,
  buildZoneIsolation,
  convexHull,
  describeParcel3DHeight,
  expandRingOutward,
  FLOOR_HEIGHT_M,
  insetLngLatRing,
  lightenHex,
  resolveParcel3DShape,
  SYMBOLIC_HEIGHT_M,
  UNASSESSED_3D_HEX,
  toLngLatRing,
} from '../src/components/gis/zone-3d/zone3dGeoJson';
import type { GisParcel, Parcel3DInfo } from '../src/components/gis/shared/types';

const mk = (over: Partial<GisParcel> & { id: string }): GisParcel =>
  ({
    coordinates: [
      [10.0, 106.0],
      [10.0, 106.001],
      [10.001, 106.001],
      [10.001, 106.0],
    ],
    ...over,
  }) as GisParcel;
const info = (over: Partial<Parcel3DInfo> = {}): Parcel3DInfo => ({
  hasReport: true,
  isVacantLand: false,
  aboveFloors: null,
  ...over,
});
const plain = mk({ id: 'p' });

// --- toLngLatRing: đảo [lat,lng] → [lng,lat], đóng vòng, bỏ trùng ---
{
  const ring = toLngLatRing([
    [10, 106],
    [10, 106.001],
    [10.001, 106.001],
  ]);
  assert.deepEqual(ring[0], [106, 10], 'đảo thứ tự lat/lng');
  assert.deepEqual(ring[ring.length - 1], ring[0], 'tự đóng vòng');
  assert.equal(ring.length, 4);

  const dup = toLngLatRing([
    [10, 106],
    [10, 106],
    [10, 106.001],
    [10.001, 106.001],
    [10, 106],
  ]);
  assert.equal(dup.length, 4, 'bỏ điểm trùng liên tiếp và không đóng vòng 2 lần');
  assert.deepEqual(toLngLatRing([[10, 106], [10, 106.001]]), [], 'ít hơn 3 đỉnh ⇒ rỗng');
  assert.deepEqual(toLngLatRing([[NaN, 106], [10, 106.001], [10.001, 106.001]]), [], 'bỏ điểm không hữu hạn');
  assert.deepEqual(toLngLatRing(null), []);
}

// --- Bảng luật chiều cao ---
{
  const f = resolveParcel3DShape(plain, info({ aboveFloors: 3 }), { dimmed: false });
  assert.equal(f.kind, 'FLOORS');
  assert.equal(f.heightM, 9.9);
  assert.equal(f.tier, 'SOLID');
  assert.equal(f.floors, 3);

  const sym = resolveParcel3DShape(plain, info({ aboveFloors: null }), { dimmed: false });
  assert.equal(sym.kind, 'SYMBOLIC');
  assert.equal(sym.heightM, SYMBOLIC_HEIGHT_M);
  assert.equal(sym.tier, 'SOLID');

  for (const bad of [0, -2, 2.5, 999]) {
    const s = resolveParcel3DShape(plain, info({ aboveFloors: bad }), { dimmed: false });
    assert.equal(s.kind, 'SYMBOLIC', `aboveFloors=${bad} ⇒ tượng trưng`);
  }

  const un = resolveParcel3DShape(plain, null, { dimmed: false });
  assert.equal(un.kind, 'UNASSESSED');
  assert.equal(un.heightM, SYMBOLIC_HEIGHT_M);
  assert.equal(un.tier, 'GHOST');
  const noReport = resolveParcel3DShape(plain, info({ hasReport: false }), { dimmed: false });
  assert.equal(noReport.kind, 'UNASSESSED', 'có metrics nhưng chưa có hồ sơ vẫn là chưa có số liệu');

  const vac = resolveParcel3DShape(plain, info({ isVacantLand: true, aboveFloors: 4 }), { dimmed: false });
  assert.equal(vac.kind, 'FLAT_VACANT');
  assert.equal(vac.heightM, 0);
  assert.equal(vac.tier, 'FLAT');

  const du = resolveParcel3DShape(mk({ id: 'x', projectParcelCode: 'B-00012-DU' }), null, { dimmed: false });
  assert.equal(du.kind, 'FLAT_VACANT', 'mã -DU nằm phẳng');

  const dim = resolveParcel3DShape(plain, info({ aboveFloors: 5 }), { dimmed: true });
  assert.equal(dim.heightM, 0);
  assert.equal(dim.tier, 'FLAT');
  assert.equal(dim.kind, 'FLOORS', 'DIM giữ kind để tooltip vẫn đúng');

  // Thửa constructionArea = 0 (chưa khảo sát) KHÔNG bị đoán là đất trống
  const zeroArea = resolveParcel3DShape(mk({ id: 'z', constructionArea: 0, floorCount: 1 }), null, { dimmed: false });
  assert.equal(zeroArea.kind, 'UNASSESSED');
  assert.ok(zeroArea.heightM > 0);
}

// --- Tooltip luôn ghi rõ minh hoạ ---
{
  const s = resolveParcel3DShape(plain, info({ aboveFloors: 4 }), { dimmed: false });
  assert.equal(describeParcel3DHeight(s), `4 tầng · ~${(4 * FLOOR_HEIGHT_M).toFixed(1)} m (minh hoạ)`);
  assert.match(describeParcel3DHeight(resolveParcel3DShape(plain, null, { dimmed: false })), /Chưa có số liệu/);
}

// --- Màu ---
{
  assert.equal(lightenHex('#000000', 0.5), '#808080');
  assert.equal(lightenHex('#fff', 0.2), '#ffffff');
  assert.equal(lightenHex('rgb(1,2,3)', 0.2), 'rgb(1,2,3)', 'không phải hex ⇒ giữ nguyên');
}

// --- FeatureCollection: màu theo layout / WORKFLOW, DIM, bỏ thửa hỏng ---
{
  const parcels = [
    mk({ id: 'a' }),
    mk({ id: 'b' }),
    mk({ id: 'bad', coordinates: [[10, 106]] }),
  ];
  const infos: Record<string, Parcel3DInfo> = { a: info({ aboveFloors: 2 }), b: info({ aboveFloors: 6 }) };
  const thematic = { resolveStyle: (p: GisParcel) => ({ fillHex: p.id === 'a' ? '#112233' : '#445566', strokeHex: '#000', fillOpacity: 1, weight: 1 }) };

  const fc = buildParcelsFeatureCollection(parcels, {
    resolveInfo: (p) => infos[p.id] ?? null,
    thematic,
    getWorkflowHex: () => '#abcdef',
    filterMatch: { matchedIds: new Set(['a']), mode: 'DIM' },
  });
  assert.equal(fc.features.length, 2, 'bỏ thửa < 3 đỉnh');
  const a = fc.features.find((f) => f.properties.parcelId === 'a');
  const b = fc.features.find((f) => f.properties.parcelId === 'b');
  assert.ok(a && b);
  assert.equal(a.properties.fillHex, '#112233');
  assert.equal(a.properties.tier, 'SOLID');
  assert.equal(b.properties.tier, 'FLAT', 'ngoài bộ lọc DIM ⇒ nằm phẳng');
  assert.equal(b.properties.heightM, 0);
  assert.ok(b.properties.flatOpacity < 0.2);
  assert.ok(a.geometry.coordinates[0][0][0] > 106 && a.geometry.coordinates[0][0][1] > 10, 'GeoJSON dùng [lng, lat] và thu lùi khe tách');
  assert.ok(a.properties.shadedHex.startsWith('#'));

  const wf = buildParcelsFeatureCollection([mk({ id: 'a' })], {
    resolveInfo: () => null,
    thematic: null,
    getWorkflowHex: () => '#abcdef',
    filterMatch: null,
  });
  assert.equal(wf.features[0].properties.fillHex, '#abcdef', 'WORKFLOW dùng màu tác nghiệp');
  assert.equal(wf.features[0].properties.tier, 'GHOST');

  // Layout chuyên đề: thửa chưa có hồ sơ luôn xám trung tính, không theo nhóm "Đất trống" của binding
  const un = buildParcelsFeatureCollection([mk({ id: 'u', constructionArea: 0 })], {
    resolveInfo: () => ({ hasReport: false, isVacantLand: false, aboveFloors: null }),
    thematic: { resolveStyle: () => ({ fillHex: '#cbd5e1', strokeHex: '#000', fillOpacity: 1, weight: 1 }) },
    getWorkflowHex: () => '#abcdef',
    filterMatch: null,
  });
  assert.equal(un.features[0].properties.fillHex, UNASSESSED_3D_HEX);
}

// --- Cô lập Zone ---
{
  const zone: [number, number][] = [
    [10, 106],
    [10, 106.01],
    [10.01, 106.01],
    [10.01, 106],
  ];
  const iso = buildZoneIsolation(zone, [mk({ id: 'p' })]);
  assert.ok(iso);
  assert.equal(iso.usedFallbackRing, false);
  assert.equal(iso.outsideMask.geometry.coordinates.length, 2, 'mask có 1 lỗ');
  assert.deepEqual(iso.outsideMask.geometry.coordinates[0][0], [-180, -85]);
  assert.ok(iso.maxBounds[0][0] < 106 && iso.maxBounds[1][0] > 106.01, 'maxBounds có đệm');

  // Thửa nằm ngoài ranh Zone vẫn được bao trong ground & bounds (không bị bay ra ngoài mask)
  const far = mk({
    id: 'far',
    coordinates: [
      [10.02, 106.02],
      [10.02, 106.021],
      [10.021, 106.021],
      [10.021, 106.02],
    ],
  });
  const iso2 = buildZoneIsolation(zone, [far]);
  assert.ok(iso2 && iso2.maxBounds[1][0] > 106.021);
  assert.ok(iso2 && iso2.focusBbox.maxLng >= 106.021 && iso2.focusBbox.minLng >= 106.019, 'focusBbox ôm sát thửa thực tế');

  const fb = buildZoneIsolation(null, [mk({ id: 'p' })]);
  assert.ok(fb && fb.usedFallbackRing, 'thiếu polygon Zone ⇒ đánh dấu fallback');
  assert.equal(buildZoneIsolation(null, []), null, 'Zone trống ⇒ null');
}

// --- Bao lồi, mở rộng, thu lùi khe tách nhà, sắc độ & footprints ---
{
  const pts: [number, number][] = [
    [106, 10],
    [106.002, 10],
    [106.001, 10.001], // điểm bên trong
    [106.002, 10.002],
    [106, 10.002],
  ];
  const hull = convexHull(pts);
  assert.equal(hull.length, 5, 'bao lồi 4 đỉnh + điểm đóng vòng');
  const expanded = expandRingOutward(hull, 25);
  assert.ok(expanded[0][0] < 106 && expanded[0][1] < 10, 'đẩy đỉnh ra ngoài tâm');

  // Lô đất ~20m × 20m: thu lùi 0.22m tạo khe tách phải giữ đủ đỉnh & nhỏ hơn gốc
  const lot: [number, number][] = [
    [106.0, 10.0],
    [106.0002, 10.0],
    [106.0002, 10.0002],
    [106.0, 10.0002],
    [106.0, 10.0],
  ];
  const inset = insetLngLatRing(lot, 0.22);
  assert.equal(inset.length, 5);
  assert.ok(inset[0][0] > lot[0][0] && inset[0][1] > lot[0][1], 'góc dưới trái lùi vào trong');
  assert.ok(inset[2][0] < lot[2][0] && inset[2][1] < lot[2][1], 'góc trên phải lùi vào trong');

  // Lô siêu nhỏ (< 6m²): an toàn trả về nguyên bản
  const tiny: [number, number][] = [
    [106.0, 10.0],
    [106.00001, 10.0],
    [106.00001, 10.00001],
    [106.0, 10.00001],
    [106.0, 10.0],
  ];
  assert.deepEqual(insetLngLatRing(tiny, 0.22), tiny, 'lô quá nhỏ giữ nguyên ring gốc');

  assert.equal(adjustHexLightness('#808080', -0.5), '#404040');
  const fp = buildParcelFootprintsCollection([mk({ id: 'p1' }), mk({ id: 'bad', coordinates: [[10, 106]] })]);
  assert.equal(fp.features.length, 1);
  assert.deepEqual(fp.features[0].geometry.coordinates[0][0], [106, 10]);
}

// --- Metro: lọc theo bbox ---
{
  const bbox = { minLng: 106, minLat: 10, maxLng: 106.01, maxLat: 10.01 };
  const near: [number, number][] = [[10.002, 106.002], [10.002, 106.004], [10.004, 106.004]];
  const far: [number, number][] = [[20, 120], [20, 120.1], [20.1, 120.1]];
  const out = buildMetroFeatures(bbox, {
    corridors: [{ name: 'gần', coords: near }, { name: 'xa', coords: far }],
    stations: [{ code: 'ST1', name: 'Ga gần', coords: near }, { code: 'ST9', name: 'Ga xa', coords: far }],
    tbm: [{ rawName: 'TBM gần', coords: near }],
    centerline: near,
  });
  assert.deepEqual(out.polygons.features.map((f) => f.properties.name).sort(), ['Ga gần', 'TBM gần']);
  assert.deepEqual(out.lines.features.map((f) => f.properties.kind).sort(), ['CENTERLINE', 'CORRIDOR']);
  assert.deepEqual(out.lines.features[0].geometry.coordinates[0], [106.002, 10.002], 'toạ độ metro cũng đảo sang [lng, lat]');
}

console.log('zone3d-geojson: OK');
