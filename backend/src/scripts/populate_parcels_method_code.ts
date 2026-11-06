/**
 * Bổ sung mã biện pháp (parcels.method_code) cho các thửa đã tồn tại. CHỈ ghi vào thửa còn NULL,
 * không đụng mã khảo sát hay cột nào khác (trigger giữ nguyên updated_at khi chỉ cấp mã lần đầu).
 * Mã đã cấp là bất biến: chạy lại nhiều lần chỉ xử lý phần còn thiếu.
 *
 *   npx ts-node --transpile-only -r dotenv/config src/scripts/populate_parcels_method_code.ts            # Xem trước, không ghi
 *   npx ts-node --transpile-only -r dotenv/config src/scripts/populate_parcels_method_code.ts --apply    # Ghi thật
 *
 * --apply bị từ chối nếu bản xem trước có mã trùng nhau hoặc trùng mã đã cấp. Thửa không tính được
 * (thiếu hình học, nằm đúng trên tim tuyến, Zone ngoài danh mục, mã khảo sát không tách được số) bị bỏ qua
 * và liệt kê để xử lý tay; chúng vẫn NULL nên bình đồ chế độ Mã Biện Pháp sẽ báo thiếu.
 */
import { Database, pool } from '../database/db';
import {
  METHOD_CODE_PATTERN,
  METHOD_CODE_SOURCE_SELECT,
  computeMethodCode,
  type ParcelMethodSourceRow,
} from '../modules/cadastral/utils/parcel-method-code';
import { ProgressConfigProvider } from '../modules/progress-report/config/config.provider';

interface PlannedCode {
  row: ParcelMethodSourceRow;
  methodCode: string;
}

interface FailedRow {
  row: ParcelMethodSourceRow;
  reason: string;
}

const TAG = '[PopulateMethodCode]';

const getErrorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

async function main(): Promise<void> {
  const shouldApply = process.argv.includes('--apply');

  const pendingRes = await Database.query<ParcelMethodSourceRow>(
    `${METHOD_CODE_SOURCE_SELECT}
      WHERE p.method_code IS NULL
      ORDER BY p.zone_id, p.project_parcel_code;`
  );
  const issuedRes = await Database.query<{ method_code: string; project_parcel_code: string }>(
    `SELECT method_code, project_parcel_code FROM parcels WHERE method_code IS NOT NULL;`
  );
  const totalRes = await Database.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM parcels;`);

  console.log(`${TAG} Tổng thửa: ${totalRes.rows[0]?.total ?? '?'} | Đã có mã: ${issuedRes.rows.length} | Cần bổ sung: ${pendingRes.rows.length}`);

  const planned: PlannedCode[] = [];
  const failed: FailedRow[] = [];
  for (const row of pendingRes.rows) {
    try {
      planned.push({ row, methodCode: computeMethodCode(row) });
    } catch (err: unknown) {
      failed.push({ row, reason: getErrorMessage(err) });
    }
  }

  // Trùng mã: trong chính bản kế hoạch, hoặc với mã đã cấp trước đó
  const owners = new Map<string, string[]>();
  for (const issued of issuedRes.rows) owners.set(issued.method_code, [`${issued.project_parcel_code} (đã cấp)`]);
  for (const item of planned) {
    const list = owners.get(item.methodCode) ?? [];
    list.push(item.row.project_parcel_code);
    owners.set(item.methodCode, list);
  }
  const duplicates = [...owners.entries()].filter(([, list]) => list.length > 1);

  // Thống kê theo tiền tố & Trái/Phải
  const byPrefix = new Map<string, { L: number; R: number }>();
  for (const item of planned) {
    const match = /^(.*)-([LR])-/.exec(item.methodCode);
    if (!match) continue;
    const stat = byPrefix.get(match[1]) ?? { L: 0, R: 0 };
    stat[match[2] as 'L' | 'R'] += 1;
    byPrefix.set(match[1], stat);
  }
  console.log(`${TAG} Kế hoạch theo tiền tố:`);
  [...byPrefix.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([prefix, stat]) => console.log(`  - ${prefix.padEnd(7)} L=${stat.L} R=${stat.R}`));
  console.log(`${TAG} Mẫu:`);
  planned.slice(0, 8).forEach((item) => console.log(`  - ${item.row.zone_id} ${item.row.project_parcel_code} -> ${item.methodCode}`));

  const badFormat = planned.filter((item) => !METHOD_CODE_PATTERN.test(item.methodCode));
  if (badFormat.length > 0) {
    console.error(`${TAG} ${badFormat.length} mã sai định dạng (không được xảy ra):`, badFormat.slice(0, 10).map((i) => i.methodCode));
  }

  if (failed.length > 0) {
    console.error(`${TAG} ${failed.length} thửa KHÔNG tính được mã (giữ NULL, cần xử lý tay):`);
    failed.forEach(({ row, reason }) => console.error(`  - ${row.zone_id} ${row.project_parcel_code}: ${reason}`));
  }
  if (duplicates.length > 0) {
    console.error(`${TAG} ${duplicates.length} mã bị trùng:`);
    duplicates.forEach(([code, list]) => console.error(`  - ${code}: ${list.join(', ')}`));
  }

  // Báo cáo tiến độ có thể ép Trái/Phải thủ công theo phường/đường/số nhà; mã biện pháp chỉ theo hình học
  const progressConfig = await ProgressConfigProvider.getActive();
  const overrides = progressConfig.config.sideOverrides;
  if (overrides.length > 0) {
    console.warn(`${TAG} Báo cáo tiến độ đang có ${overrides.length} override Trái/Phải thủ công (nguồn ${progressConfig.source}). Mã biện pháp tính theo hình học, cần đối chiếu các vị trí sau:`);
    overrides.forEach((o) => console.warn(`  - ${o.side}${o.force ? ' (force)' : ''} | phường="${o.ward}" đường="${o.street}" số=[${o.houseNumbers.join(', ')}]`));
  }

  if (!shouldApply) {
    console.log(`${TAG} Chế độ XEM TRƯỚC, chưa ghi gì. Thêm --apply để ghi ${planned.length} mã.`);
    return;
  }
  if (duplicates.length > 0 || badFormat.length > 0) {
    throw new Error(`${TAG} Từ chối --apply: còn mã trùng hoặc sai định dạng, xử lý trước rồi chạy lại.`);
  }

  let written = 0;
  const writeErrors: FailedRow[] = [];
  for (const item of planned) {
    try {
      await Database.transaction(async (client) => {
        const res = await client.query(
          `UPDATE parcels SET method_code = $1 WHERE id = $2::uuid AND method_code IS NULL;`,
          [item.methodCode, item.row.id]
        );
        if (res.rowCount === 1) written += 1;
      });
    } catch (err: unknown) {
      console.error(`${TAG} Ghi lỗi ${item.row.project_parcel_code} -> ${item.methodCode}:`, err);
      writeErrors.push({ row: item.row, reason: getErrorMessage(err) });
    }
  }

  const remainRes = await Database.query<{ remain: string }>(
    `SELECT COUNT(*)::text AS remain FROM parcels WHERE method_code IS NULL;`
  );
  console.log(`${TAG} Đã ghi ${written}/${planned.length} mã. Lỗi ghi: ${writeErrors.length}. Thửa còn thiếu mã: ${remainRes.rows[0]?.remain ?? '?'}.`);
}

main()
  .catch((err: unknown) => {
    console.error(`${TAG} Thất bại:`, err);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end().catch((err: unknown) => console.error(`${TAG} Không đóng được pool:`, err));
  });
