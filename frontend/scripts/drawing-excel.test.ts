/**
 * Excel danh sách lô kèm bình đồ: số dòng phải bằng đúng số lô vẽ trên .SVG, chỉ STT + 2 mã.
 * Chạy: npm run test:drawing-excel
 */
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  METRO_CORRIDOR_BOUNDARIES,
  METRO_LINE2_CENTERLINE,
  METRO_STATION_DETAILED_OUTLINES,
  METRO_STATION_POLYGONS,
  getZoneByCode,
} from '../src/features/survey-phase1/constants/metroGisConstants';
import { DEFAULT_TITLE_BLOCK, generateZoneTechnicalSvg } from '../src/features/zone-management/utils/zoneSvgTechnicalExporter';
import type { ParcelLabelMode, SvgParcelInput, ZoneSvgResult } from '../src/features/zone-management/utils/zoneSvgTechnicalExporter';
import { buildDrawingParcelsXlsx, drawingFileStem, toDrawingParcelRows } from '../src/features/zone-management/utils/zoneDrawingParcelsExcel';

let passed = 0;
async function tc(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`, err);
    process.exitCode = 1;
  }
}

const zone = getZoneByCode('ZONE_04');
assert.ok(zone, 'cần cấu hình ZONE_04');
const [lat0, lng0] = METRO_LINE2_CENTERLINE[Math.floor(METRO_LINE2_CENTERLINE.length / 2)];
const square = (i: number, closed: boolean): [number, number][] => {
  const d = 0.00008;
  const la = lat0 + 0.0003 + (i % 6) * 0.00012;
  const ln = lng0 + Math.floor(i / 6) * 0.00012;
  const ring: [number, number][] = [[la, ln], [la + d, ln], [la + d, ln + d], [la, ln + d]];
  return closed ? [...ring, ring[0]] : ring;
};

// 12 thửa vẽ được (có 1 chung cư, có thửa vòng khép), 4 thửa bị bỏ: thiếu hình học, 2 đỉnh, vòng khép chỉ còn 2 đỉnh, thiếu mã KS
const parcels: SvgParcelInput[] = [
  ...Array.from({ length: 12 }, (_, i) => ({
    code: `C&C-04-B-${String(100 - i * 7).padStart(4, '0')}`,
    methodCode: `ST04-L-${String(100 - i * 7).padStart(4, '0')}`,
    isCondoMaster: i === 3,
    ring: square(i, i % 2 === 0),
  })),
  { code: 'C&C-04-B-0901', methodCode: 'ST04-L-0901', isCondoMaster: false, ring: [] },
  { code: 'C&C-04-B-0902', methodCode: 'ST04-L-0902', isCondoMaster: false, ring: square(20, false).slice(0, 2) },
  { code: 'C&C-04-B-0903', methodCode: 'ST04-L-0903', isCondoMaster: false, ring: [...square(21, false).slice(0, 2), square(21, false)[0]] },
  { code: '  ', methodCode: 'ST04-L-0904', isCondoMaster: false, ring: square(22, false) },
];

const draw = (mode: ParcelLabelMode, list: SvgParcelInput[] = parcels): ZoneSvgResult =>
  generateZoneTechnicalSvg({
    zoneCode: zone.code,
    zoneName: zone.name,
    zoneKind: zone.type,
    zoneIndex: zone.index,
    parcels: list,
    centerlineCoords: METRO_LINE2_CENTERLINE,
    corridorBoundaries: METRO_CORRIDOR_BOUNDARIES,
    stationBoxes: METRO_STATION_POLYGONS,
    stationOutlines: METRO_STATION_DETAILED_OUTLINES,
    titleBlock: { ...DEFAULT_TITLE_BLOCK, drawingNo: 'BD-04-001' },
    parcelLabelMode: mode,
  });

async function readBack(result: ZoneSvgResult): Promise<ExcelJS.Worksheet> {
  const buf = await buildDrawingParcelsXlsx({
    result,
    titleBlock: { drawingNo: 'BD-04-001' },
    latestRevision: 'R01',
    zoneCode: zone!.code,
    exportedAt: new Date(2026, 10, 20),
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet('Danh sach lo binh do');
  assert.ok(ws, 'thiếu sheet Danh sach lo binh do');
  return ws;
}

async function main(): Promise<void> {
  console.log('Excel danh sách lô kèm bình đồ');

  for (const mode of ['METHOD_CODE', 'SURVEY_CODE'] as const) {
    await tc(`${mode}: danh sách lô = số lô vẽ (12), bỏ 4 thửa lỗi, chung cư tính 1 lô`, () => {
      const r = draw(mode);
      assert.equal(r.parcelCount, 12);
      assert.equal(r.drawnParcels.length, r.parcelCount);
      assert.equal(r.skippedParcels, 4);
      assert.equal(r.drawnParcels.filter((p) => p.isCondoMaster).length, 1);
    });

    await tc(`${mode}: Excel đúng 3 cột theo thứ tự chế độ, 12 dòng, tổng có giá trị tính sẵn = 12`, async () => {
      const r = draw(mode);
      const ws = await readBack(r);
      const header = (ws.getRow(7).values as unknown[]).slice(1);
      assert.deepEqual(header, mode === 'METHOD_CODE' ? ['STT', 'Mã Biện Pháp', 'Mã Khảo Sát'] : ['STT', 'Mã Khảo Sát', 'Mã Biện Pháp']);
      let dataRows = 0;
      for (let rowNo = 8; rowNo <= ws.rowCount; rowNo++) {
        const row = ws.getRow(rowNo);
        if (row.getCell(1).value === null || row.getCell(1).value === undefined) continue;
        dataRows++;
        assert.equal(row.getCell(1).value, dataRows, 'STT liên tục từ 1');
        assert.equal(row.getCell(4).value ?? null, null, 'không có cột thứ 4');
      }
      assert.equal(dataRows, 12);
      const total = ws.getCell(5, 3).value as { formula?: string; result?: number };
      assert.equal(total.formula, 'SUBTOTAL(3,B8:B19)');
      assert.equal(total.result, 12);
      const firstPrimary = String(ws.getCell(8, 2).value);
      assert.ok(mode === 'METHOD_CODE' ? firstPrimary.startsWith('ST04-L-') : firstPrimary.startsWith('C&C-04-B-'));
      assert.match(String(ws.getCell(6, 1).value), /4 thửa/);
    });
  }

  await tc('Sắp tăng dần theo mã của chế độ (so số tự nhiên)', () => {
    const rows = toDrawingParcelRows(
      [
        { surveyCode: 'C&C-04-B-0100', methodCode: 'ST04-L-0010', isCondoMaster: false },
        { surveyCode: 'C&C-04-B-0009', methodCode: 'ST04-L-0200', isCondoMaster: false },
      ],
      'SURVEY_CODE'
    );
    assert.deepEqual(rows.map((r) => r.primary), ['C&C-04-B-0009', 'C&C-04-B-0100']);
  });

  await tc('SURVEY_CODE thiếu mã biện pháp: ô để trống, vẫn đủ dòng', async () => {
    const list = parcels.map((p, i) => (i === 0 ? { ...p, methodCode: null } : p));
    const r = draw('SURVEY_CODE', list);
    const ws = await readBack(r);
    let blanks = 0;
    for (let rowNo = 8; rowNo < 8 + r.parcelCount; rowNo++) {
      if (ws.getCell(rowNo, 3).value === null || ws.getCell(rowNo, 3).value === undefined) blanks++;
    }
    assert.equal(blanks, 1);
  });

  await tc('METHOD_CODE thiếu mã biện pháp: hàm vẽ từ chối (không có bình đồ, không có Excel)', () => {
    const list = parcels.map((p, i) => (i === 0 ? { ...p, methodCode: null } : p));
    assert.throws(() => draw('METHOD_CODE', list), /chưa có mã biện pháp/);
  });

  await tc('Danh sách lệch số lô → không xuất Excel', async () => {
    const r = draw('SURVEY_CODE');
    await assert.rejects(buildDrawingParcelsXlsx({
      result: { ...r, drawnParcels: r.drawnParcels.slice(1) },
      titleBlock: { drawingNo: '' },
      latestRevision: 'R00',
      zoneCode: zone!.code,
    }), /lệch số lô/);
  });

  await tc('Tên file SVG và Excel chung phần định danh', () => {
    const at = new Date(2026, 10, 20);
    assert.equal(drawingFileStem('ST04', 'METHOD_CODE', 'R01', at), 'ST04_BP_R01_20261120');
    assert.equal(drawingFileStem('POR-04', 'SURVEY_CODE', 'R00', at), 'POR-04_KS_R00_20261120');
  });

  console.log(`\n${passed} ca đạt${process.exitCode ? ', CÓ CA LỖI' : ''}`);
}

void main();
