import { pool, Database } from '../database/db';
import { ADDRESS_BATCH_ZONES, CadastralBatchService } from '../modules/cadastral/cadastral-batch.service';
import type { AddressPreviewRow } from '../modules/cadastral/cadastral-batch.service';

/**
 * CHỈ ĐỌC. Đo tỷ lệ đề xuất địa chỉ tự động / cần nhập tay / mâu thuẫn cho Zone 3, 7, 9.
 * npx ts-node src/scripts/report_address_batch_coverage.ts [ZONE_07]
 */

const pct = (n: number, d: number): string => (d === 0 ? '0%' : `${((n / d) * 100).toFixed(1)}%`);

async function zoneReport(zoneId: string, superAdmin: { userId: string; role: string; assignedZoneId: string }) {
  const idsRes = await Database.query<{ id: string }>(
    `SELECT id FROM parcels WHERE zone_id = $1 AND lifecycle_status = 'ACTIVE' ORDER BY project_parcel_code;`,
    [zoneId]
  );
  const ids = idsRes.rows.map((r) => r.id);
  const rows: AddressPreviewRow[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    rows.push(...(await CadastralBatchService.previewAddress(ids.slice(i, i + 500), superAdmin)));
  }

  const surveyed = rows.filter((r) => r.surveyorEntered);
  const unsurveyed = rows.filter((r) => !r.surveyorEntered);
  const count = (list: AddressPreviewRow[], fn: (r: AddressPreviewRow) => boolean) => list.filter(fn).length;

  console.log(`\n================ ${zoneId}: ${rows.length} thửa ACTIVE (${surveyed.length} có hồ sơ KSV) ================`);
  console.log(`Có thay đổi (diff > 0)            : ${count(rows, (r) => r.diffCount > 0)}`);
  console.log(`Tự tích được (autoSelectable)      : ${count(rows, (r) => r.autoSelectable)} (${pct(count(rows, (r) => r.autoSelectable), count(rows, (r) => r.diffCount > 0))} số dòng có thay đổi)`);
  console.log(`Bị khóa (APPROVED / khóa pháp lý)  : ${count(rows, (r) => Boolean(r.lockedReason))}`);
  console.log('--- Thửa có hồ sơ KSV ---');
  console.log(`  Đường auto (từ KSV hoặc địa chính sạch): ${count(surveyed, (r) => !r.requiresManualStreet)} / ${surveyed.length} (${pct(count(surveyed, (r) => !r.requiresManualStreet), surveyed.length)})`);
  console.log(`  Đường lấy từ KSV                       : ${count(surveyed, (r) => r.sourceByField.street === 'SURVEYOR')}`);
  console.log(`  Phường auto (không conflict / split)   : ${count(surveyed, (r) => !r.wardConflict && !r.isSplitWard)} / ${surveyed.length} (${pct(count(surveyed, (r) => !r.wardConflict && !r.isSplitWard), surveyed.length)})`);
  console.log(`  Phường mâu thuẫn địa chính vs KSV      : ${count(surveyed, (r) => Boolean(r.wardConflict))}`);
  console.log(`  Số nhà cần nhập tay                    : ${count(surveyed, (r) => r.requiresManualHouseNumber)}`);
  console.log('--- Thửa chưa có hồ sơ ---');
  console.log(`  Giữ nguyên ô đường nhiễm               : ${count(unsurveyed, (r) => r.streetKeptAsIs)} / ${unsurveyed.length}`);
  console.log(`  Phường chia tách cần chọn tay          : ${count(rows, (r) => r.isSplitWard)}`);

  const manual = rows.filter((r) => r.requiresManualStreet || r.requiresManualHouseNumber || r.wardConflict || r.isSplitWard).slice(0, 20);
  if (manual.length > 0) {
    console.log('--- 20 mẫu cần xử lý tay ---');
    for (const r of manual) {
      const sv = r.surveyorEntered;
      console.log(
        `  ${r.projectParcelCode.padEnd(16)} | địa chính: ${r.parcelRaw.houseNumber} / ${r.parcelRaw.street} / ${r.parcelRaw.ward}, ${r.parcelRaw.district}` +
          ` | KSV: ${sv ? `${sv.houseNumber} / ${sv.street} / ${sv.ward}` : '—'} | ${r.anomalyReasons.slice(-1)[0] ?? ''}`
      );
    }
  }
}

async function main() {
  const adminRes = await Database.query<{ id: string }>(
    `SELECT id FROM users WHERE role = 'SUPER_ADMIN' AND deleted_at IS NULL LIMIT 1;`
  );
  const superAdmin = { userId: adminRes.rows[0].id, role: 'SUPER_ADMIN', assignedZoneId: 'ALL' };
  const zones = process.argv[2] ? [process.argv[2]] : [...ADDRESS_BATCH_ZONES];
  for (const z of zones) await zoneReport(z, superAdmin);
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (err: unknown) => {
    console.error('[AddressCoverage] Lỗi', err);
    await pool.end();
    process.exit(1);
  });
