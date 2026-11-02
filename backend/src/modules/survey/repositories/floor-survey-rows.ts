import type { PoolClient } from 'pg';

type FloorRecord = Record<string, unknown>;

interface PreviousFloorRow {
  floor_name: string;
  floor_order: number;
  notes: string | null;
  created_at: Date | null;
}

const firstValue = (...values: unknown[]): unknown => values.find((value) => value !== undefined && value !== null && value !== '');

const jsonList = (value: unknown): string => JSON.stringify(Array.isArray(value) ? value : []);

/**
 * Hàm chạy trong transaction đã đọc floor_surveys nên không dùng `SurveyBaseRepository.hasColumn`:
 * hàm đó ALTER TABLE ở kết nối khác, phải chờ chính transaction này nhả khóa nên treo tới hết timeout.
 */
async function readFloorSurveyColumns(client: PoolClient): Promise<Set<string>> {
  const res = await client.query<{ attname: string }>(
    `SELECT attname FROM pg_attribute
     WHERE attrelid = 'floor_surveys'::regclass AND attnum > 0 AND NOT attisdropped;`
  );
  return new Set(res.rows.map((row) => row.attname));
}

/**
 * Mọi luồng ghi lại `floor_surveys` (KSV lưu, Admin sửa, rollback) đều xóa rồi chèn lại,
 * nên phải đi chung một chỗ để cờ miễn Z/E không bị về mặc định TRUE ở một nhánh.
 */
export async function replaceFloorSurveyRows(client: PoolClient, reportId: string, floors: FloorRecord[]): Promise<void> {
  const columns = await readFloorSurveyColumns(client);
  const previousRows = (
    await client.query<PreviousFloorRow>(
      `SELECT floor_name, floor_order, notes, created_at FROM floor_surveys WHERE report_id = $1;`,
      [reportId]
    )
  ).rows;
  const incomingNames = new Set(floors.map((floor) => firstValue(floor.floorName, floor.floor_name)));

  await client.query(`DELETE FROM floor_surveys WHERE report_id = $1;`, [reportId]);

  for (let i = 0; i < floors.length; i++) {
    const floor = floors[i];
    const floorName = firstValue(floor.floorName, floor.floor_name);
    // JSON không có notes, nên thiếu bước này thì mỗi lần ghi lại sẽ xóa ghi chú trong SQL
    const previous =
      previousRows.find((prev) => prev.floor_name === floorName) ??
      previousRows.find((prev) => prev.floor_order === i + 1 && !incomingNames.has(prev.floor_name));
    const row: Array<[string, unknown]> = [
      ['report_id', reportId],
      ['floor_name', floorName ?? `Tầng ${i + 1}`],
      ['floor_order', i + 1],
      ['overview_photos_json', jsonList(floor.overviewPhotos)],
      ['cad_drawing_url', firstValue(floor.cadDrawingUrl, floor.cadSketchPhotoUrl, floor.cad_drawing_url) ?? null],
      ['cad_zone_pins_json', jsonList(floor.cadZonePins)],
      ['cad_structural_drawing_url', firstValue(floor.cadStructuralDrawingUrl, floor.cadStructuralSketchPhotoUrl, floor.cad_structural_drawing_url) ?? null],
      ['cad_element_pins_json', jsonList(floor.cadElementPins)],
      ['notes', floor.notes || previous?.notes || null],
    ];
    if (previous?.created_at) row.push(['created_at', previous.created_at]);
    if (columns.has('has_structural_elements')) {
      row.push(['has_structural_elements', (floor.hasStructuralElements ?? floor.has_structural_elements) !== false]);
      row.push(['no_structural_elements_reason', firstValue(floor.noStructuralElementsReason, floor.no_structural_elements_reason) ?? null]);
    }
    if (columns.has('has_zones')) {
      row.push(['has_zones', (floor.hasZones ?? floor.has_zones) !== false]);
      row.push(['no_zones_reason', firstValue(floor.noZonesReason, floor.no_zones_reason) ?? null]);
    }

    // Tên cột là hằng trong code, giá trị luôn qua tham số
    const columnList = row.map(([column]) => column).join(', ');
    const placeholders = row.map((_, index) => `$${index + 1}`).join(', ');
    await client.query(
      `INSERT INTO floor_surveys (${columnList}) VALUES (${placeholders});`,
      row.map(([, value]) => value)
    );
  }
}
