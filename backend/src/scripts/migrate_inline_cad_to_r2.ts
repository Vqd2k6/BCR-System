/**
 * Chuyển CAD base64 (`data:image/...`) trong building_units (unit_cad_url, unit_structural_cad_url) và
 * building_floor_plans (cad_photo_url, cad_structural_url, cad_resources_json[].url) ra kho lưu trữ, thay bằng URL.
 * Không đụng base_survey_reports.survey_data_json (hồ sơ pháp lý; nháp Khu vực chung do client tự chuyển khi mở).
 *
 * Bảo toàn:
 * - Giữ đúng byte gốc (giải mã base64, không render lại); chỉ nhận chuỗi round-trip được ⇒ rollback dựng lại y hệt.
 * - Key theo SHA-256 nội dung (cùng ảnh chép sang nhiều tầng = 1 object). Kiểm kích thước object trước khi đổi DB.
 * - Mỗi trường 1 transaction: UPDATE chỉ khi giá trị vẫn đúng bản đã đọc (không đè chỉnh sửa song song),
 *   KHÔNG đổi updated_at, ghi system_audit_logs (MIGRATE_INLINE_CAD_TO_R2) + 1 dòng manifest để rollback.
 *
 * Chạy (từ thư mục backend):
 *   npx ts-node --transpile-only src/scripts/migrate_inline_cad_to_r2.ts                  # chỉ xem trước
 *   ... --apply                         # ghi; DB không có hậu tố _test/_scratch cần thêm --confirm-real-db
 *   ... --apply --confirm-real-db       # DB thật (prod: chỉ khi được phép, kho phải là R2)
 *   ... --rollback <manifest.jsonl>     # trả lại base64 đúng từng byte (cũng cần --confirm-real-db với DB thật)
 *   Tuỳ chọn: --parcel <uuid>  --limit <n>  --manifest <đường dẫn>
 */
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import type { PoolClient } from 'pg';
import { config } from '../config';
import { Database } from '../database/db';
import { StorageService } from '../common/services/storage.service';
import {
  decodeInlineImage,
  rebuildInlineImage,
  storeDecodedInlineCad,
} from '../modules/cadastral/utils/inline-cad-storage';

const TAG = 'migrate_inline_cad_to_r2';
const ACTION = 'MIGRATE_INLINE_CAD_TO_R2';
const ROLLBACK_ACTION = 'ROLLBACK_INLINE_CAD_TO_R2';

const args = process.argv.slice(2);
const argValue = (flag: string): string | undefined => {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
};
const isApply = args.includes('--apply');
const rollbackFile = argValue('--rollback');
const allowRealDb = args.includes('--confirm-real-db');
const onlyParcel = argValue('--parcel');
const limit = Number(argValue('--limit') || 0) || 0;

type TableName = 'building_units' | 'building_floor_plans';
type TextColumn = 'unit_cad_url' | 'unit_structural_cad_url' | 'cad_photo_url' | 'cad_structural_url';

/** Danh sách trắng định danh SQL (không lấy từ input) */
const TEXT_COLUMNS: Record<TableName, TextColumn[]> = {
  building_units: ['unit_cad_url', 'unit_structural_cad_url'],
  building_floor_plans: ['cad_photo_url', 'cad_structural_url'],
};
const ENTITY_TYPE: Record<TableName, string> = {
  building_units: 'BUILDING_UNIT',
  building_floor_plans: 'BUILDING_FLOOR_PLAN',
};

interface ManifestEntry {
  table: TableName;
  id: string;
  parcelId: string;
  label: string;
  column: TextColumn | 'cad_resources_json';
  resourceId?: string;
  header: string;
  sha256: string;
  sizeBytes: number;
  key: string;
  url: string;
  storage: string;
  originalUpdatedAt: string | null;
  migratedAt: string;
}

interface CandidateRow {
  id: string;
  parcel_id: string;
  label: string;
  updated_at: Date | null;
}

interface ResourceItem {
  id?: string;
  url?: unknown;
  [key: string]: unknown;
}

const totals = {
  fields: 0,
  migrated: 0,
  skippedInvalid: 0,
  skippedChanged: 0,
  failed: 0,
  bytes: 0,
  uniqueObjects: new Set<string>(),
  objectsCreated: 0,
};

async function assertSafeTarget(writing: boolean): Promise<{ dbName: string; storage: string }> {
  const { rows } = await Database.query<{ db: string; supabase_roles: number }>(
    `SELECT current_database() AS db,
            (SELECT count(*)::int FROM pg_roles WHERE rolname = ANY($1::text[])) AS supabase_roles;`,
    [['supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin', 'authenticator']]
  );
  const dbName = rows[0]?.db ?? '?';
  const dbCfg = config.db as { host?: string; connectionString?: string };
  const dbHost = dbCfg.connectionString ? new URL(dbCfg.connectionString).hostname : String(dbCfg.host ?? '');
  const isCloudDb = (rows[0]?.supabase_roles ?? 0) > 0 || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(dbHost);
  const info = StorageService.getStorageInfo();
  const storage = info.isLocal ? 'local (backend/uploads)' : `R2 bucket ${info.bucket}`;
  console.log(`[${TAG}] DB: ${dbName}${isCloudDb ? ' (CLOUD)' : ' (local)'} | Kho: ${storage}`);

  if (!writing) return { dbName, storage };
  const isScratch = /_(test|scratch)$/.test(dbName);
  if (!isScratch && !allowRealDb) {
    throw new Error(`Từ chối ghi vào "${dbName}": DB không phải bản nháp (_test/_scratch) cần thêm --confirm-real-db.`);
  }
  if (isCloudDb && info.isLocal) {
    // URL /uploads/... trỏ vào đĩa máy này — ghi vào DB Cloud sẽ làm hỏng CAD của mọi người dùng
    throw new Error('Từ chối ghi: DB là Cloud nhưng kho hiệu lực là local. Cần STORAGE_TYPE=r2.');
  }
  return { dbName, storage };
}

function openManifest(dbName: string): { file: string; append: (e: ManifestEntry) => void } {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.resolve(argValue('--manifest') || path.join('logs', 'inline-cad-migration', `${dbName}-${stamp}.jsonl`));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return { file, append: (e) => fs.appendFileSync(file, `${JSON.stringify(e)}\n`) };
}

async function insertAudit(client: PoolClient, entry: ManifestEntry, action: string): Promise<void> {
  await client.query(
    `INSERT INTO system_audit_logs (entity_type, entity_id, action, diff_payload)
     VALUES ($1, $2, $3, $4::jsonb);`,
    [
      ENTITY_TYPE[entry.table],
      entry.id,
      action,
      JSON.stringify({
        table: entry.table,
        column: entry.column,
        resourceId: entry.resourceId ?? null,
        label: entry.label,
        parcelId: entry.parcelId,
        header: entry.header,
        sha256Old: entry.sha256,
        sha256New: entry.sha256,
        sizeBytes: entry.sizeBytes,
        key: entry.key,
        url: entry.url,
        storage: entry.storage,
        originalUpdatedAt: entry.originalUpdatedAt,
      }),
    ]
  );
}

async function loadCandidates(table: TableName): Promise<CandidateRow[]> {
  const params: unknown[] = [];
  let where = table === 'building_units'
    ? `(unit_cad_url LIKE 'data:image/%' OR unit_structural_cad_url LIKE 'data:image/%')`
    : `(cad_photo_url LIKE 'data:image/%' OR cad_structural_url LIKE 'data:image/%' OR cad_resources_json::text LIKE '%data:image/%')`;
  if (onlyParcel) {
    params.push(onlyParcel);
    where += ` AND parcel_id = $${params.length}`;
  }
  const label = table === 'building_units' ? 'unit_code' : `COALESCE(floor_code, floor_name, floor_number::text)`;
  const { rows } = await Database.query<CandidateRow>(
    `SELECT id, parcel_id, ${label} AS label, updated_at
       FROM ${table}
      WHERE deleted_at IS NULL AND ${where}
      ORDER BY parcel_id, ${label}
      ${limit > 0 ? `LIMIT ${limit}` : ''};`,
    params
  );
  return rows;
}

function baseEntry(table: TableName, row: CandidateRow, storage: string) {
  return {
    table,
    id: row.id,
    parcelId: row.parcel_id,
    label: row.label,
    storage,
    originalUpdatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    migratedAt: new Date().toISOString(),
  };
}

async function migrateTextColumn(
  table: TableName,
  column: TextColumn,
  row: CandidateRow,
  value: string,
  storage: string,
  manifest: { append: (e: ManifestEntry) => void } | null
): Promise<void> {
  totals.fields++;
  const decoded = decodeInlineImage(value);
  if (!decoded) {
    totals.skippedInvalid++;
    console.warn(`[${TAG}] Bỏ qua ${table}.${column} ${row.label} (${row.id}): không phải base64 ảnh round-trip được`);
    return;
  }
  totals.bytes += decoded.buffer.length;
  totals.uniqueObjects.add(`${row.parcel_id}/${decoded.sha256}`);
  if (!manifest) return;

  try {
    const stored = await storeDecodedInlineCad(row.parcel_id, decoded, {
      'uploaded-at': row.updated_at ? new Date(row.updated_at).toISOString() : '',
      'migrated-from': `${table}.${column}`,
      'entity-id': row.id,
    });
    if (stored.created) totals.objectsCreated++;
    const entry: ManifestEntry = {
      ...baseEntry(table, row, storage),
      column,
      header: decoded.header,
      sha256: decoded.sha256,
      sizeBytes: stored.sizeBytes,
      key: stored.key,
      url: stored.url,
    };
    const changed = await Database.transaction(async (client) => {
      const res = await client.query(
        `UPDATE ${table} SET ${column} = $2 WHERE id = $1 AND deleted_at IS NULL AND ${column} = $3;`,
        [row.id, stored.url, value]
      );
      if (res.rowCount !== 1) return false;
      await insertAudit(client, entry, ACTION);
      return true;
    });
    if (!changed) {
      totals.skippedChanged++;
      console.warn(`[${TAG}] Bỏ qua ${table}.${column} ${row.label}: giá trị đã đổi trong lúc chạy`);
      return;
    }
    manifest.append(entry);
    totals.migrated++;
  } catch (err: unknown) {
    totals.failed++;
    console.error(`[${TAG}:MigrateField] Lỗi ${table}.${column} ${row.label} (${row.id}), giữ nguyên base64:`, err);
  }
}

async function migrateResources(
  row: CandidateRow,
  storage: string,
  manifest: { append: (e: ManifestEntry) => void } | null
): Promise<void> {
  const { rows } = await Database.query<{ cad_resources_json: unknown }>(
    `SELECT cad_resources_json FROM building_floor_plans WHERE id = $1;`,
    [row.id]
  );
  const original = rows[0]?.cad_resources_json;
  if (!Array.isArray(original)) return;

  const next: ResourceItem[] = [];
  const entries: ManifestEntry[] = [];
  for (const raw of original as ResourceItem[]) {
    const url = raw?.url;
    if (typeof url !== 'string' || !url.startsWith('data:image/')) {
      next.push(raw);
      continue;
    }
    totals.fields++;
    const decoded = decodeInlineImage(url);
    if (!decoded) {
      totals.skippedInvalid++;
      console.warn(`[${TAG}] Bỏ qua cad_resources_json ${row.label} resource ${raw.id}: base64 không round-trip`);
      next.push(raw);
      continue;
    }
    totals.bytes += decoded.buffer.length;
    totals.uniqueObjects.add(`${row.parcel_id}/${decoded.sha256}`);
    if (!manifest) {
      next.push(raw);
      continue;
    }
    try {
      const stored = await storeDecodedInlineCad(row.parcel_id, decoded, {
        'uploaded-at': row.updated_at ? new Date(row.updated_at).toISOString() : '',
        'migrated-from': 'building_floor_plans.cad_resources_json',
        'entity-id': row.id,
      });
      if (stored.created) totals.objectsCreated++;
      entries.push({
        ...baseEntry('building_floor_plans', row, storage),
        column: 'cad_resources_json',
        resourceId: typeof raw.id === 'string' ? raw.id : undefined,
        header: decoded.header,
        sha256: decoded.sha256,
        sizeBytes: stored.sizeBytes,
        key: stored.key,
        url: stored.url,
      });
      next.push({ ...raw, url: stored.url });
    } catch (err: unknown) {
      totals.failed++;
      console.error(`[${TAG}:MigrateResource] Lỗi resource ${raw.id} của ${row.label}, giữ nguyên base64:`, err);
      next.push(raw);
    }
  }
  if (!manifest || entries.length === 0) return;

  const changed = await Database.transaction(async (client) => {
    const res = await client.query(
      `UPDATE building_floor_plans SET cad_resources_json = $2::jsonb
        WHERE id = $1 AND deleted_at IS NULL AND cad_resources_json = $3::jsonb;`,
      [row.id, JSON.stringify(next), JSON.stringify(original)]
    );
    if (res.rowCount !== 1) return false;
    for (const entry of entries) await insertAudit(client, entry, ACTION);
    return true;
  });
  if (!changed) {
    totals.skippedChanged += entries.length;
    console.warn(`[${TAG}] Bỏ qua cad_resources_json ${row.label}: giá trị đã đổi trong lúc chạy`);
    return;
  }
  entries.forEach((e) => manifest.append(e));
  totals.migrated += entries.length;
}

async function runMigration(): Promise<void> {
  const { dbName, storage } = await assertSafeTarget(isApply);
  const manifest = isApply ? openManifest(dbName) : null;

  for (const table of ['building_units', 'building_floor_plans'] as TableName[]) {
    const candidates = await loadCandidates(table);
    console.log(`[${TAG}] ${table}: ${candidates.length} dòng còn CAD base64`);
    for (const row of candidates) {
      const cols = TEXT_COLUMNS[table];
      const { rows } = await Database.query<Record<TextColumn, string | null>>(
        `SELECT ${cols.join(', ')} FROM ${table} WHERE id = $1;`,
        [row.id]
      );
      for (const column of cols) {
        const value = rows[0]?.[column];
        if (typeof value === 'string' && value.startsWith('data:image/')) {
          await migrateTextColumn(table, column, row, value, storage, manifest);
        }
      }
      if (table === 'building_floor_plans') await migrateResources(row, storage, manifest);
    }
  }

  console.log(`[${TAG}] ${isApply ? 'ĐÃ GHI' : 'CHỈ XEM TRƯỚC (thêm --apply để ghi)'}`, {
    truongBase64: totals.fields,
    daChuyen: totals.migrated,
    boQuaKhongHopLe: totals.skippedInvalid,
    boQuaDoDaDoi: totals.skippedChanged,
    loi: totals.failed,
    dungLuongAnhMB: +(totals.bytes / 1048576).toFixed(2),
    soObjectDuyNhat: totals.uniqueObjects.size,
    objectMoiGhi: totals.objectsCreated,
  });
  if (manifest) console.log(`[${TAG}] Manifest rollback: ${manifest.file}`);
}

async function readStoredObject(entry: ManifestEntry): Promise<Buffer | null> {
  if (entry.url.startsWith('/uploads/')) {
    const file = path.resolve(config.storage.localUploadDir, entry.key);
    return fs.existsSync(file) ? fs.readFileSync(file) : null;
  }
  return StorageService.getObjectBuffer(entry.key, config.storage.s3.bucket);
}

async function runRollback(file: string): Promise<void> {
  await assertSafeTarget(true);
  const entries = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ManifestEntry)
    .reverse();
  let restored = 0;
  let skipped = 0;

  for (const entry of entries) {
    try {
      const buffer = await readStoredObject(entry);
      const sha = buffer ? StorageService.calculateSha256(buffer) : null;
      if (!buffer || sha !== entry.sha256) {
        skipped++;
        console.error(`[${TAG}:Rollback] Object ${entry.key} thiếu hoặc lệch SHA-256, bỏ qua ${entry.table} ${entry.id}`);
        continue;
      }
      const original = rebuildInlineImage(entry.header, buffer);
      const ok = await Database.transaction(async (client) => {
        let res;
        if (entry.column === 'cad_resources_json') {
          const cur = await client.query<{ cad_resources_json: unknown }>(
            `SELECT cad_resources_json FROM building_floor_plans WHERE id = $1 FOR UPDATE;`,
            [entry.id]
          );
          const list = cur.rows[0]?.cad_resources_json;
          if (!Array.isArray(list)) return false;
          let hit = false;
          const next = (list as ResourceItem[]).map((item) => {
            if (!hit && item?.url === entry.url && (entry.resourceId === undefined || item.id === entry.resourceId)) {
              hit = true;
              return { ...item, url: original };
            }
            return item;
          });
          if (!hit) return false;
          res = await client.query(`UPDATE building_floor_plans SET cad_resources_json = $2::jsonb WHERE id = $1;`, [
            entry.id,
            JSON.stringify(next),
          ]);
        } else {
          const column = TEXT_COLUMNS[entry.table].find((c) => c === entry.column);
          if (!column) return false;
          res = await client.query(`UPDATE ${entry.table} SET ${column} = $2 WHERE id = $1 AND ${column} = $3;`, [
            entry.id,
            original,
            entry.url,
          ]);
        }
        if (res.rowCount !== 1) return false;
        await insertAudit(client, entry, ROLLBACK_ACTION);
        return true;
      });
      if (ok) restored++;
      else {
        skipped++;
        console.warn(`[${TAG}:Rollback] ${entry.table}.${entry.column} ${entry.label} không còn giữ URL đã chuyển, bỏ qua`);
      }
    } catch (err: unknown) {
      skipped++;
      console.error(`[${TAG}:Rollback] Lỗi ${entry.table} ${entry.id}:`, err);
    }
  }
  console.log(`[${TAG}] Rollback xong: trả lại ${restored}, bỏ qua ${skipped} (object trên kho được giữ nguyên)`);
}

(rollbackFile ? runRollback(rollbackFile) : runMigration())
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(`[${TAG}] Thất bại:`, err);
    process.exit(1);
  });
