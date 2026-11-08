/**
 * ============================================================================
 * PHOTO QC – TẠO THUMBNAIL 480px CHO MÀN RÀ SOÁT (chạy OFFLINE trên máy local, không chạy trên Render)
 *
 *   npx ts-node --transpile-only src/scripts/generate_photo_qc_thumbs.ts --stations ST02,ST04,ST05 [--p-only] [--apply]
 *
 * - Mặc định CHẠY THỬ: chỉ liệt kê ảnh sẽ tạo, không ghi gì lên R2.
 * - --apply: ghi `thumbs/<khoá gốc>` lên R2. Mỗi lần ghi cloud cần người phụ trách đồng ý riêng.
 * - Chỉ ghi vào tiền tố thumbs/, bỏ qua thumbnail đã có, KHÔNG BAO GIỜ ghi đè/xoá khoá ảnh gốc.
 * - Frontend dùng thumbnail khi đặt VITE_PHOTO_QC_THUMB_PREFIX=thumbs, thiếu thì tự quay về ảnh gốc.
 * ============================================================================
 */
import sharp from 'sharp';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from '../config';
import { Database } from '../database/db';
import { fetchPhotoSourceRows } from '../modules/photo-qc/photo-qc.repository';
import { PhotoQcService } from '../modules/photo-qc/photo-qc.service';
import { resolveReportKind } from '../modules/photo-qc/photo-qc.rules';
import { resolveStationCode } from '../modules/progress-report/rules/alignment-side';

const THUMB_PREFIX = 'thumbs/';
const THUMB_MAX = 480;
const CONCURRENCY = 6;

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function s3Client(): S3Client {
  // Giống StorageService: endpoint có thể kèm "/<bucket>" ở cuối, phải cắt đi.
  let endpoint = String(config.storage.s3.endpoint || '').trim().replace(/\/+$/, '');
  const bucket = String(config.storage.s3.bucket || '').trim();
  if (bucket && endpoint.endsWith(`/${bucket}`)) endpoint = endpoint.slice(0, -(bucket.length + 1));
  if (!endpoint || !config.storage.s3.accessKeyId) throw new Error('Thiếu cấu hình S3/R2 (S3_ENDPOINT, S3_ACCESS_KEY_ID)');
  return new S3Client({
    region: config.storage.s3.region || 'auto',
    endpoint,
    credentials: { accessKeyId: config.storage.s3.accessKeyId.trim(), secretAccessKey: config.storage.s3.secretAccessKey.trim() },
  });
}

/** Khoá R2 của ảnh gốc từ public URL; ảnh không nằm trên R2 public thì bỏ qua. */
function keyOf(url: string): string | null {
  const base = String(config.storage.s3.publicUrl || '').replace(/\/+$/, '');
  if (base && url.startsWith(`${base}/`)) return decodeURIComponent(url.slice(base.length + 1).split('?')[0]);
  try {
    const u = new URL(url);
    if (/\.r2\.dev$/i.test(u.hostname)) return decodeURIComponent(u.pathname.replace(/^\/+/, ''));
  } catch (err) {
    console.error('[PhotoQcThumbs:keyOf] URL không hợp lệ', url, err);
  }
  return null;
}

async function collectUrls(stations: string[], allPhotos: boolean): Promise<string[]> {
  const zones = await Database.query<{ zone_code: string; zone_name: string | null }>(`SELECT zone_code, zone_name FROM metro_zones;`, []);
  const zoneCodes = zones.rows
    .filter((z) => stations.includes(resolveStationCode(z.zone_code, z.zone_name).toUpperCase()))
    .map((z) => z.zone_code.toUpperCase());
  if (zoneCodes.length === 0) return [];
  const rows = await fetchPhotoSourceRows([`r.deleted_at IS NULL`, `r.phase = 'PHASE_1'`, `UPPER(p.zone_id) = ANY($1::text[])`], [zoneCodes], null);
  const urls = new Set<string>();
  for (const row of rows) {
    const kind = resolveReportKind(row.report_type, row.unit_type);
    if (allPhotos) {
      const built = await PhotoQcService.buildAllSlots(row.id);
      built.slots.forEach((s) => urls.add(s.url));
    } else {
      PhotoQcService.buildPSlots(row, kind).forEach((s) => urls.add(s.url));
    }
  }
  return [...urls];
}

interface S3ErrorShape {
  name?: string;
  Code?: string;
  message?: string;
  $metadata?: { httpStatusCode?: number };
}

function describeS3Error(err: unknown): string {
  const e = err as S3ErrorShape;
  const code = e.Code || e.name || 'Unknown';
  const status = e.$metadata?.httpStatusCode ?? '?';
  return `HTTP ${status} ${code}`;
}

/** Gợi ý nguyên nhân theo mã lỗi R2 (không in khoá bí mật). */
function hintFor(err: unknown): string {
  const e = err as S3ErrorShape;
  const code = e.Code || e.name || '';
  if (code === 'InvalidAccessKeyId') return 'Access Key ID không tồn tại trong tài khoản Cloudflare của S3_ENDPOINT (sai khoá, khoá đã thu hồi, hoặc khoá của tài khoản khác).';
  if (code === 'SignatureDoesNotMatch') return 'Secret Access Key không khớp Access Key ID (chép thiếu/thừa ký tự, dấu cách, xuống dòng).';
  if (code === 'NoSuchBucket') return `Bucket "${config.storage.s3.bucket}" không có trong tài khoản này: kiểm tra S3_BUCKET.`;
  if (code === 'AccessDenied' || e.$metadata?.httpStatusCode === 403) {
    return [
      `Khoá hợp lệ nhưng KHÔNG có quyền với bucket "${config.storage.s3.bucket}". Kiểm tra:`,
      '  1. Token tạo với quyền "Object Read & Write" (không phải "Object Read only").',
      '  2. Mục "Specify bucket(s)" của token có đúng bucket đang chứa ảnh.',
      '  3. S3_BUCKET đúng tên bucket thật: bucket có R2.dev URL trùng tên miền ảnh (Bucket → Settings → Public access).',
      '  4. Biến khoá mới thật sự được dùng (keyId in ở trên phải là khoá mới).',
    ].join('\n');
  }
  return 'Xem chi tiết lỗi ở trên.';
}

/** Kiểm tra trước (CHỈ ĐỌC): đọc 1 byte ảnh gốc và HEAD khoá thumbnail. Lỗi → dừng ngay, không chạy hàng loạt. */
async function preflight(client: S3Client, sample: { url: string; key: string }): Promise<boolean> {
  const endpointHost = (() => {
    try {
      return new URL(String(config.storage.s3.endpoint)).host.replace(/^[^.]{6}/, '******');
    } catch (err) {
      console.error('[PhotoQcThumbs:preflight] S3_ENDPOINT không hợp lệ', err);
      return '(không hợp lệ)';
    }
  })();
  console.log(`[PhotoQcThumbs:preflight] endpoint ${endpointHost} • bucket ${config.storage.s3.bucket} • keyId …${config.storage.s3.accessKeyId.trim().slice(-4)}`);
  try {
    await client.send(new GetObjectCommand({ Bucket: config.storage.s3.bucket, Key: sample.key, Range: 'bytes=0-0' }));
  } catch (err) {
    console.error(`[PhotoQcThumbs:preflight] Không đọc được ảnh gốc ${sample.key}: ${describeS3Error(err)}\n${hintFor(err)}`);
    return false;
  }
  try {
    await exists(client, `${THUMB_PREFIX}${sample.key}`);
  } catch (err) {
    console.error(`[PhotoQcThumbs:preflight] HEAD thumbnail lỗi: ${describeS3Error(err)}\n${hintFor(err)}`);
    return false;
  }
  console.log('[PhotoQcThumbs:preflight] Đọc được bucket. Quyền ghi sẽ biết ở ảnh đầu tiên (dừng ngay nếu bị từ chối).');
  return true;
}

async function exists(client: S3Client, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: config.storage.s3.bucket, Key: key }));
    return true;
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return false;
    throw err; // giữ nguyên mã lỗi R2 để chẩn đoán

  }
}

async function main(): Promise<void> {
  const stations = (arg('--stations') || 'ST02,ST04,ST05').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const apply = process.argv.includes('--apply');
  // Mặc định: mọi ảnh của màn rà soát (ảnh P, ảnh trong nhà, ảnh chưa in). --p-only: chỉ ảnh P cho màn tổng quan.
  const allPhotos = !process.argv.includes('--p-only');
  console.log(`[PhotoQcThumbs] Ga: ${stations.join(', ')} • ${allPhotos ? 'mọi ảnh rà soát' : 'chỉ ảnh P'} • ${apply ? 'GHI LÊN R2' : 'CHẠY THỬ (không ghi)'}`);

  const urls = await collectUrls(stations, allPhotos);
  const limit = Number(arg('--limit') || 0);
  const targets = urls.map((url) => ({ url, key: keyOf(url) })).filter((t): t is { url: string; key: string } => Boolean(t.key));
  console.log(`[PhotoQcThumbs] ${urls.length} URL, ${targets.length} nằm trên R2 public`);
  if (limit > 0) targets.splice(limit);
  if (targets.length === 0) return;

  const client = s3Client();
  if (!(await preflight(client, targets[0]))) {
    process.exitCode = 1;
    return;
  }
  if (!apply) {
    targets.slice(0, 10).forEach((t) => console.log(`  ${THUMB_PREFIX}${t.key}`));
    console.log('[PhotoQcThumbs] Chạy thử xong. Thêm --apply để ghi thật.');
    return;
  }

  let done = 0;
  let skipped = 0;
  let failed = 0;
  let lastErr: unknown = null;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    // Lô đầu lỗi toàn bộ = lỗi cấu hình/quyền, không phải lỗi từng ảnh → dừng, không lặp 30.000 lần.
    if (i === CONCURRENCY && done === 0 && skipped === 0 && failed > 0) {
      console.error(`[PhotoQcThumbs] Lô đầu lỗi toàn bộ (${describeS3Error(lastErr)}). Dừng.\n${hintFor(lastErr)}`);
      process.exitCode = 1;
      return;
    }
    await Promise.all(
      targets.slice(i, i + CONCURRENCY).map(async ({ url, key }) => {
        const thumbKey = `${THUMB_PREFIX}${key}`;
        if (!thumbKey.startsWith(THUMB_PREFIX) || thumbKey === key) throw new Error(`Khoá đích không an toàn: ${thumbKey}`);
        try {
          if (await exists(client, thumbKey)) {
            skipped++;
            return;
          }
          const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const input = Buffer.from(await res.arrayBuffer());
          // Tự xoay theo EXIF rồi thu nhỏ: trình duyệt hiển thị thumbnail cùng chiều với ảnh gốc.
          const body = await sharp(input).rotate().resize({ width: THUMB_MAX, height: THUMB_MAX, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
          await client.send(new PutObjectCommand({ Bucket: config.storage.s3.bucket, Key: thumbKey, Body: body, ContentType: 'image/jpeg', CacheControl: 'public, max-age=31536000, immutable' }));
          done++;
        } catch (err) {
          failed++;
          lastErr = err;
          console.error(`[PhotoQcThumbs:upload] Không tạo được thumbnail ${thumbKey}`, err);
        }
      })
    );
    console.log(`[PhotoQcThumbs] ${Math.min(i + CONCURRENCY, targets.length)}/${targets.length} (tạo ${done}, có sẵn ${skipped}, lỗi ${failed})`);
  }
}

main()
  .catch((err) => {
    console.error('[PhotoQcThumbs] Lỗi', err);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 200));
