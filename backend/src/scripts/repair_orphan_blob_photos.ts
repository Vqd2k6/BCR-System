/**
 * Gắn lại ảnh còn blob:local:// vào đúng object trên kho, cho hồ sơ mọi trạng thái.
 * Mặc định chỉ xem trước. `--apply` chỉ chạy được trên metro2_audit_test, trừ khi có thêm `--confirm-real-db`.
 * Mỗi hồ sơ: tạo bản version trước khi ghi, chỉ thay URL, ghi system_audit_logs.
 * Chạy: npx ts-node src/scripts/repair_orphan_blob_photos.ts [--apply] [--choose <localId>=<key>]
 */
import dotenv from 'dotenv';
import { StorageService } from '../common/services/storage.service';
import { config } from '../config';
import { Database } from '../database/db';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';
import {
  collectOrphanTargets,
  matchOrphanByCaptureTime,
  matchOrphanTargets,
  parcelStoragePrefixes,
} from '../modules/survey/orphan-photo-matcher';

dotenv.config();

const SYSTEM_REASON = 'Gắn lại ảnh đã có trên kho lưu trữ nhưng hồ sơ còn giữ blob:local';
const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const allowRealDb = args.includes('--confirm-real-db');
const chosenKeys = new Map(
  args.flatMap((arg, idx) => (args[idx - 1] === '--choose' ? [arg.split('=') as [string, string]] : []))
);

interface ReportRow {
  id: string;
  status: string;
  parcel_id: string;
  project_parcel_code: string;
  unit_code: string | null;
  survey_data_json: Record<string, unknown>;
}

const localIdOf = (uri: string): string => uri.slice('blob:local://'.length).split('?')[0];
const capturedAtOf = (localId: string): number => Number(/\d{13}/.exec(localId)?.[0] ?? 0);

function collectBlobPaths(node: unknown, path = '', out: Array<{ path: string; localId: string }> = []) {
  if (typeof node === 'string') {
    if (node.startsWith('blob:local://')) out.push({ path, localId: localIdOf(node) });
  } else if (Array.isArray(node)) {
    node.forEach((item, idx) => collectBlobPaths(item, `${path}[${idx}]`, out));
  } else if (node && typeof node === 'object') {
    Object.entries(node).forEach(([key, value]) => collectBlobPaths(value, path ? `${path}.${key}` : key, out));
  }
  return out;
}

function replaceBlobs(node: unknown, mapping: Map<string, string>): unknown {
  if (typeof node === 'string') {
    return node.startsWith('blob:local://') ? mapping.get(localIdOf(node)) ?? node : node;
  }
  if (Array.isArray(node)) {
    // Cùng một ảnh có thể đã nằm ở vị trí khác của danh sách; thay xong thì gộp để không hiện 2 lần
    const items = node.map((item) => replaceBlobs(item, mapping));
    return items.filter((item, idx) => typeof item !== 'string' || items.indexOf(item) === idx);
  }
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, replaceBlobs(value, mapping)]));
  }
  return node;
}

async function resolveMapping(report: ReportRow, baseUrl: string) {
  const json = report.survey_data_json;
  const { targets, referencedKeys } = collectOrphanTargets(json, (json._photoMappings || {}) as Record<string, string>);
  const keysByPrefix: Record<string, string[]> = {};
  for (const prefix of new Set(targets.map((t) => t.listPrefix).filter((p): p is string => Boolean(p)))) {
    keysByPrefix[prefix] = await StorageService.listObjectKeys(prefix);
  }
  const { recovered, unresolved } = matchOrphanTargets(targets, keysByPrefix, referencedKeys, baseUrl);

  const mapping = new Map(Object.entries(recovered).map(([localId, item]) => [localId, item.url]));
  const evidence = new Map(Object.keys(recovered).map((localId) => [localId, 'Tiền tố tên + thời gian chụp']));
  const pending: Array<{ localId: string; candidates: string[] }> = [];

  if (unresolved.length > 0) {
    const siblings = await Database.query<{ json: string }>(
      `SELECT survey_data_json::text AS json FROM base_survey_reports WHERE parcel_id = $1;`,
      [report.parcel_id]
    );
    const parcelJson = siblings.rows.map((row) => row.json).join('\n');
    const keys: string[] = [];
    for (const prefix of parcelStoragePrefixes(report.project_parcel_code)) {
      keys.push(...(await StorageService.listObjectKeys(prefix)));
    }
    const free = keys.filter((key) => !parcelJson.includes(key) && !parcelJson.includes(encodeURI(key)));
    for (const item of unresolved) {
      const chosen = chosenKeys.get(item.localId);
      const found = chosen ? [chosen] : matchOrphanByCaptureTime(capturedAtOf(item.localId), free, new Set(), report.unit_code);
      if (found.length === 0) {
        const ownJson = JSON.stringify(report.survey_data_json);
        const inReport = matchOrphanByCaptureTime(capturedAtOf(item.localId), keys, new Set(), report.unit_code).filter(
          (key) => ownJson.includes(key) || ownJson.includes(encodeURI(key))
        );
        if (inReport.length === 1) {
          mapping.set(item.localId, `${baseUrl}/${inReport[0]}`);
          evidence.set(item.localId, 'Ảnh đã có trong hồ sơ, gộp trùng');
          continue;
        }
      }
      const taken = [...mapping.values()].some((url) => url.endsWith(found[0]));
      if (found.length === 1 && !taken) {
        mapping.set(item.localId, `${baseUrl}/${found[0]}`);
        evidence.set(item.localId, chosen ? 'Người duyệt chọn' : 'Thời gian chụp, đúng 1 object');
      } else {
        pending.push({ localId: item.localId, candidates: found });
      }
    }
  }
  return { mapping, evidence, pending };
}

async function applyReport(report: ReportRow, mapping: Map<string, string>): Promise<void> {
  await AuditVersionService.createSnapshot(report.id, {
    versionTag: 'ADMIN_DIFF_SAVE',
    title: 'Trước khi gắn lại ảnh blob:local',
    editReason: SYSTEM_REASON,
  });
  await Database.transaction(async (client) => {
    const current = await client.query<{ survey_data_json: unknown }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1 FOR UPDATE;`,
      [report.id]
    );
    const next = replaceBlobs(current.rows[0].survey_data_json, mapping);
    await client.query(`UPDATE base_survey_reports SET survey_data_json = $2, updated_at = NOW() WHERE id = $1;`, [
      report.id,
      JSON.stringify(next),
    ]);
    for (const [localId, url] of mapping) {
      const uri = `blob:local://${localId}`;
      await client.query(`UPDATE damage_zones SET ctx_photo_url = $1 WHERE report_id = $2 AND ctx_photo_url LIKE $3;`, [
        url,
        report.id,
        `${uri}%`,
      ]);
      await client.query(
        `UPDATE defect_items SET
           cu_photo_url = CASE WHEN cu_photo_url LIKE $2 THEN $1 ELSE cu_photo_url END,
           cu_photos_json = REPLACE(cu_photos_json::text, $3, $1)::jsonb
         WHERE zone_id IN (SELECT id FROM damage_zones WHERE report_id = $4)
           AND (cu_photo_url LIKE $2 OR cu_photos_json::text LIKE $2 OR cu_photos_json::text LIKE '%' || $3 || '%');`,
        [url, `${uri}%`, uri, report.id]
      );
      await client.query(`UPDATE survey_photo_registry SET photo_url = $1 WHERE report_id = $2 AND photo_url LIKE $3;`, [
        url,
        report.id,
        `${uri}%`,
      ]);
    }
    await client.query(
      `INSERT INTO system_audit_logs (entity_type, entity_id, action, diff_payload)
       VALUES ('SURVEY_REPORT', $1, 'RECOVER_ORPHAN_PHOTOS', $2::jsonb);`,
      [report.id, JSON.stringify({ reason: SYSTEM_REASON, mapping: Object.fromEntries(mapping) })]
    );
  });
}

async function main(): Promise<void> {
  if (!StorageService.canListObjects()) throw new Error('Thiếu cấu hình kho lưu trữ.');
  const dbName = process.env.DB_NAME;
  if (isApply && dbName !== 'metro2_audit_test' && !allowRealDb) {
    throw new Error(`Từ chối ghi vào ${dbName}: chỉ ghi DB khác metro2_audit_test khi có --confirm-real-db.`);
  }

  const reports = await Database.query<ReportRow>(
    `SELECT r.id, r.status, r.parcel_id, r.survey_data_json, p.project_parcel_code, bu.unit_code
     FROM base_survey_reports r
     JOIN parcels p ON p.id = r.parcel_id
     LEFT JOIN building_units bu ON bu.id = r.unit_id
     WHERE r.deleted_at IS NULL AND r.survey_data_json::text LIKE '%blob:local%'
     ORDER BY r.status, p.project_parcel_code;`
  );

  const baseUrl = (config.storage.s3.publicUrl || '').replace(/\/+$/, '');
  const totals = { reports: reports.rows.length, photos: 0, mapped: 0, pending: 0, applied: 0 };
  console.log('Hồ sơ | Trạng thái | Vị trí | Ảnh | URL mới | Bằng chứng');

  for (const report of reports.rows) {
    const { mapping, evidence, pending } = await resolveMapping(report, baseUrl);
    const label = `${report.project_parcel_code} ${report.unit_code ?? '-'}`;
    totals.photos += mapping.size + pending.length;
    totals.mapped += mapping.size;
    totals.pending += pending.length;

    for (const { path, localId } of collectBlobPaths(report.survey_data_json)) {
      const url = mapping.get(localId);
      if (url) console.log(`${label} | ${report.status} | ${path} | ${localId} | ${url.replace(baseUrl, '')} | ${evidence.get(localId)}`);
    }
    for (const item of pending) {
      console.log(`${label} | ${report.status} | CẦN CHỌN | ${item.localId} | ${item.candidates.join(' ; ') || '(không có)'} |`);
    }
    if (isApply && mapping.size > 0) {
      await applyReport(report, mapping);
      totals.applied += 1;
    }
  }

  console.log('[repair_orphan_blob_photos] Tổng:', totals, isApply ? 'ĐÃ GHI' : 'CHỈ XEM TRƯỚC');
  process.exit(0);
}

main().catch((err) => {
  console.error('[repair_orphan_blob_photos] Thất bại:', err);
  process.exit(1);
});
