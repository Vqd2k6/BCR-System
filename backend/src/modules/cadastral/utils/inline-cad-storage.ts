/**
 * Đưa CAD base64 (`data:image/...;base64,...`) ra kho lưu trữ (R2 / backend/uploads) và thay bằng URL.
 *
 * Vì sao: ô cắt CAD căn/khu vực từng lưu nguyên base64 trong building_units (360–590 KB/trường, chép sang mọi
 * tầng điển hình) ⇒ `/units`, `floor-plans/:floor` và nháp Khu vực chung nặng hàng MB mỗi lượt qua 4G.
 *
 * Bảo toàn chứng cứ:
 * - Giải mã đúng byte gốc, không render lại; chỉ nhận khi mã hoá lại ra đúng chuỗi base64 ban đầu (round-trip).
 * - Key theo SHA-256 nội dung ⇒ cùng ảnh chép sang nhiều tầng chỉ là 1 object; chạy lại không sinh bản trùng.
 * - Thư mục riêng `projects/METRO2_HCM/unit-cad/<parcelId>/`, tách khỏi thư mục ảnh hiện trường của tòa
 *   (bộ cứu ảnh mồ côi dò theo tiền tố tòa + mốc thời gian trong tên file).
 * - Lỗi tải lên ⇒ giữ nguyên base64 (hành vi cũ), có log — không bao giờ làm mất CAD.
 */
import crypto from 'crypto';
import { StorageService } from '../../../common/services/storage.service';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface DecodedInlineImage {
  buffer: Buffer;
  mimeType: string;
  ext: string;
  sha256: string;
  /** Phần trước dấu phẩy, nguyên văn (vd. `data:image/jpeg;base64`) — đủ để dựng lại đúng chuỗi gốc khi rollback. */
  header: string;
}

export const isInlineImageDataUrl = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('data:image/');

function hasImageSignature(buf: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/png') return buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47;
  if (mimeType === 'image/webp') return buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

/**
 * Giải mã data URL ảnh. Trả null nếu không phải base64 ảnh hợp lệ hoặc không round-trip được byte-for-byte
 * (kể cả có khoảng trắng/xuống dòng): khi đó `${header},${buffer.toString('base64')}` luôn đúng bằng chuỗi gốc.
 */
export function decodeInlineImage(dataUrl: string): DecodedInlineImage | null {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  const header = dataUrl.slice(0, comma);
  const [mimeRaw, ...params] = header.slice(5).toLowerCase().split(';'); // bỏ "data:"
  if (!params.includes('base64')) return null;
  const mimeType = mimeRaw === 'image/jpg' ? 'image/jpeg' : mimeRaw;
  const ext = MIME_EXT[mimeType];
  if (!ext) return null;

  const payload = dataUrl.slice(comma + 1);
  const buffer = Buffer.from(payload, 'base64');
  if (buffer.length === 0 || buffer.toString('base64') !== payload) return null;
  if (!hasImageSignature(buffer, mimeType)) return null;

  return { buffer, mimeType, ext, header, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
}

/** Dựng lại đúng chuỗi data URL gốc từ byte đã lưu (dùng cho rollback). */
export const rebuildInlineImage = (header: string, buffer: Buffer): string => `${header},${buffer.toString('base64')}`;

export const inlineCadObjectKey = (parcelId: string, decoded: DecodedInlineImage): string =>
  `projects/METRO2_HCM/unit-cad/${parcelId}/${decoded.sha256}.${decoded.ext}`;

export interface ExternalizedInlineCad {
  url: string;
  key: string;
  sha256: string;
  sizeBytes: number;
  created: boolean;
}

/**
 * Ghi 1 data URL ra kho. Ném lỗi khi kho lỗi (script migration cần biết để không đổi DB);
 * trả null khi giá trị không phải ảnh base64 hợp lệ.
 */
export async function storeInlineCadImage(
  parcelId: string,
  dataUrl: string,
  metadata: Record<string, string> = {}
): Promise<ExternalizedInlineCad | null> {
  const decoded = decodeInlineImage(dataUrl);
  return decoded ? storeDecodedInlineCad(parcelId, decoded, metadata) : null;
}

export async function storeDecodedInlineCad(
  parcelId: string,
  decoded: DecodedInlineImage,
  metadata: Record<string, string> = {}
): Promise<ExternalizedInlineCad> {
  const key = inlineCadObjectKey(parcelId, decoded);
  const res = await StorageService.putContentAddressedObject(key, decoded.buffer, decoded.mimeType, {
    source: 'inline-cad',
    'parcel-id': parcelId,
    ...metadata,
  });
  return { url: res.url, key, sha256: decoded.sha256, sizeBytes: decoded.buffer.length, created: res.created };
}

/**
 * Dùng cho luồng ghi của API: mỗi request 1 instance (cùng ảnh lặp ở nhiều tầng chỉ tải 1 lần).
 * Lỗi kho ⇒ giữ nguyên base64 + log, không chặn Admin lưu phân chia.
 */
export class InlineCadExternalizer {
  private readonly byContent = new Map<string, Promise<string>>();

  constructor(
    private readonly parcelId: string,
    private readonly tag: string,
    private readonly metadata: Record<string, string> = {}
  ) {}

  async externalize<T extends string | null | undefined>(value: T): Promise<T | string> {
    if (!isInlineImageDataUrl(value)) return value;
    let pending = this.byContent.get(value);
    if (!pending) {
      pending = storeInlineCadImage(this.parcelId, value, this.metadata)
        .then((res) => res?.url ?? value)
        .catch((err: unknown) => {
          console.error(`[${this.tag}:ExternalizeInlineCad] Không đưa được CAD base64 lên kho, giữ nguyên base64:`, err);
          return value;
        });
      this.byContent.set(value, pending);
    }
    return pending;
  }

  /** Thay mọi chuỗi data:image trong cây JSON (vd. cad_resources_json). */
  async externalizeDeep<T>(node: T): Promise<T> {
    if (typeof node === 'string') return (await this.externalize(node)) as T;
    if (Array.isArray(node)) return (await Promise.all(node.map((item) => this.externalizeDeep(item)))) as T;
    if (node && typeof node === 'object') {
      const entries = await Promise.all(
        Object.entries(node as Record<string, unknown>).map(async ([k, v]) => [k, await this.externalizeDeep(v)] as const)
      );
      return Object.fromEntries(entries) as T;
    }
    return node;
  }
}
