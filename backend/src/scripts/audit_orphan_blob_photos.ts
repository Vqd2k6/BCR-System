/**
 * Báo cáo ảnh còn blob:local:// trong hồ sơ. Chỉ đọc: SELECT trên DB và liệt kê object trên kho.
 * Dùng cùng bộ ghép của luồng khôi phục bản nháp nên chỉ nhận khi có đúng 1 object khớp.
 * Chạy: npx ts-node src/scripts/audit_orphan_blob_photos.ts
 */
import dotenv from 'dotenv';
import { StorageService } from '../common/services/storage.service';
import { config } from '../config';
import { Database } from '../database/db';
import { collectOrphanTargets, matchOrphanTargets } from '../modules/survey/orphan-photo-matcher';

dotenv.config();

interface ReportRow {
  id: string;
  status: string;
  project_parcel_code: string;
  unit_code: string | null;
  surveyor_name: string | null;
  survey_data_json: Record<string, unknown>;
}

const DEEP_WINDOW_MS = 120_000;

/** Quét cả thư mục của thửa theo thời điểm chụp; chỉ để người duyệt xem, không tự gắn ảnh. */
async function listParcelObjects(parcelCode: string, cache: Map<string, string[]>): Promise<string[]> {
  const cached = cache.get(parcelCode);
  if (cached) return cached;
  const folders = new Set([parcelCode, parcelCode.replace(/[^a-zA-Z0-9-]/g, '_'), parcelCode.replace(/[^a-zA-Z0-9-]/g, '')]);
  const keys: string[] = [];
  // Ảnh Căn hộ và Khu vực chung lưu dưới `projects/`, ảnh Nhà dân và biên bản lưu dưới `surveys/`
  for (const folder of folders) {
    keys.push(...(await StorageService.listObjectKeys(`surveys/${folder}/`)));
    keys.push(...(await StorageService.listObjectKeys(`projects/METRO2_HCM/buildings/${folder}/`)));
  }
  cache.set(parcelCode, keys);
  return keys;
}

function findDeepCandidates(keys: string[], capturedAtMs: number, allJson: string): string[] {
  return keys.filter((key) => {
    const epochMs = Number(/_(\d{13})_/.exec(key)?.[1] ?? 0);
    if (epochMs < capturedAtMs || epochMs >= capturedAtMs + DEEP_WINDOW_MS) return false;
    return !allJson.includes(key) && !allJson.includes(encodeURI(key));
  });
}

async function main(): Promise<void> {
  if (!StorageService.canListObjects()) {
    throw new Error('Thiếu cấu hình kho lưu trữ, không liệt kê được object.');
  }

  const reports = await Database.query<ReportRow>(
    `SELECT r.id, r.status, r.survey_data_json, p.project_parcel_code, bu.unit_code, u.full_name AS surveyor_name
     FROM base_survey_reports r
     JOIN parcels p ON p.id = r.parcel_id
     LEFT JOIN building_units bu ON bu.id = r.unit_id
     LEFT JOIN users u ON u.id = r.surveyor_id
     WHERE r.deleted_at IS NULL AND r.survey_data_json::text LIKE '%blob:local%'
     ORDER BY r.status, p.project_parcel_code;`
  );

  const totals = { reports: reports.rows.length, photos: 0, alreadyMapped: 0, recoverable: 0, unresolved: 0 };
  const byReason: Record<string, number> = {};
  const deep = { single: 0, multiple: 0, none: 0 };
  const parcelObjects = new Map<string, string[]>();

  for (const report of reports.rows) {
    const json = report.survey_data_json;
    const knownMappings = (json._photoMappings || {}) as Record<string, string>;
    const { targets, referencedKeys } = collectOrphanTargets(json, knownMappings);

    const keysByPrefix: Record<string, string[]> = {};
    for (const prefix of new Set(targets.map((t) => t.listPrefix).filter((p): p is string => Boolean(p)))) {
      keysByPrefix[prefix] = await StorageService.listObjectKeys(prefix);
    }
    const { recovered, unresolved } = matchOrphanTargets(targets, keysByPrefix, referencedKeys, config.storage.s3.publicUrl || '');

    const mapped = (JSON.stringify(json).match(/blob:local:\/\/[^"]+/g) || [])
      .map((uri) => uri.slice('blob:local://'.length).split('?')[0])
      .filter((id, idx, all) => all.indexOf(id) === idx && Boolean(knownMappings[id])).length;

    totals.photos += targets.length + mapped;
    totals.alreadyMapped += mapped;
    totals.recoverable += Object.keys(recovered).length;
    totals.unresolved += unresolved.length;
    unresolved.forEach((item) => {
      byReason[item.reason] = (byReason[item.reason] ?? 0) + 1;
    });

    console.log(
      `${report.status} ${report.project_parcel_code} ${report.unit_code ?? '-'} (${report.id.slice(0, 8)}) KSV: ${report.surveyor_name ?? '?'}` +
        ` | ảnh ${targets.length + mapped}, đã có mapping ${mapped}, tìm thấy ${Object.keys(recovered).length}, chưa thấy ${unresolved.length}`
    );
    unresolved.forEach((item) => {
      const when = new Date(Number(/\d{13}/.exec(item.localId)?.[0] ?? 0)).toISOString();
      console.log(`   CHƯA THẤY ${item.localId} (${when}) ${item.reason} ứng viên ${item.candidates.length}`);
    });
    if (unresolved.length > 0) {
      const parcelJson = await Database.query<{ json: string }>(
        `SELECT r.survey_data_json::text AS json FROM base_survey_reports r
         JOIN parcels p ON p.id = r.parcel_id WHERE p.project_parcel_code = $1;`,
        [report.project_parcel_code]
      );
      const allJson = parcelJson.rows.map((row) => row.json).join('\n');
      const keys = await listParcelObjects(report.project_parcel_code, parcelObjects);
      for (const item of unresolved) {
        const capturedAtMs = Number(/\d{13}/.exec(item.localId)?.[0] ?? 0);
        const found = findDeepCandidates(keys, capturedAtMs, allJson);
        deep[found.length === 0 ? 'none' : found.length === 1 ? 'single' : 'multiple'] += 1;
        console.log(`   DÒ RỘNG ${item.localId}: ${found.length} object`);
        found.slice(0, 4).forEach((key) => console.log(`      ${key}`));
      }
    }
  }

  console.log('[audit_orphan_blob_photos] Tổng:', totals, byReason, 'Dò rộng:', deep);
  process.exit(0);
}

main().catch((err) => {
  console.error('[audit_orphan_blob_photos] Thất bại:', err);
  process.exit(1);
});
