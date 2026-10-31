/**
 * Ghép ảnh mồ côi: ảnh đã lên kho lưu trữ nhưng bản nháp chỉ còn giữ blob:local://{id}.
 * Bản build ngày 03/10 xoá bản gốc trên điện thoại ngay sau khi upload nhưng có thể làm mất URL,
 * nên object vẫn nằm trên kho mà không còn gì liên kết tới nó.
 *
 * Đây là dữ liệu pháp lý: chỉ nhận khi có ĐÚNG 1 object khớp mã ảnh và khung thời gian chụp.
 * Module thuần, không truy cập mạng/CSDL.
 */

const LOCAL_URI_PREFIX = 'blob:local://';
const LOCAL_ID_PATTERN = /^photo_(?:rot_)?(\d{13})_/;
const STORAGE_NAME_PATTERN = /^(.*_)(\d{2})_(\d{13})_[0-9a-f]+\.[a-z0-9]+$/i;
const PHOTO_CODE_PATTERN = /^HCM_M2\.\[(.+)\]_(.+_)\d+$/;
const MAX_WINDOW_WITHOUT_NEIGHBOR_MS = 120_000;

export type OrphanUnresolvedReason = 'NO_NAME_PREFIX' | 'NO_CANDIDATE' | 'AMBIGUOUS' | 'CONFLICT';

export interface OrphanPhotoTarget {
  localId: string;
  capturedAtMs: number;
  /** Tiền tố key trên kho, VD surveys/C_C-05-B-0002/CTX/HCM_M2__C_C-05-B-0002__F00_Z-03_CTX_ */
  listPrefix: string | null;
  /** Mốc thời gian của ảnh chụp ngay sau trong cùng danh sách */
  nextCaptureMs: number | null;
  /** Số thứ tự kỳ vọng trong tên file, chỉ dùng để phân xử khi có nhiều ứng viên */
  expectedSeq: number | null;
  baseUrl: string | null;
}

export interface OrphanMatchResult {
  recovered: Record<string, { key: string; url: string; epochMs: number }>;
  unresolved: { localId: string; reason: OrphanUnresolvedReason; candidates: string[] }[];
}

interface ParsedCloudUrl {
  baseUrl: string;
  folder: string;
  namePrefix: string;
  epochMs: number;
}

const toLocalId = (value: string): string => value.slice(LOCAL_URI_PREFIX.length).split('?')[0];
const isLocalUri = (value: unknown): value is string => typeof value === 'string' && value.startsWith(LOCAL_URI_PREFIX);
const isCloudUrl = (value: unknown): value is string => typeof value === 'string' && /^https?:\/\//.test(value);

function parseCapturedAt(localId: string): number | null {
  const match = LOCAL_ID_PATTERN.exec(localId);
  return match ? Number(match[1]) : null;
}

function keyFromUrl(url: string): string | null {
  try {
    return decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '');
  } catch (err) {
    console.error('[OrphanPhotoMatcher:ParseUrl] URL ảnh không hợp lệ:', url, err);
    return null;
  }
}

function parseCloudUrl(url: string): ParsedCloudUrl | null {
  const key = keyFromUrl(url);
  if (!key) return null;
  const slashIdx = key.lastIndexOf('/');
  const match = STORAGE_NAME_PATTERN.exec(key.slice(slashIdx + 1));
  if (!match) return null;
  return {
    baseUrl: url.slice(0, url.length - encodeURI(key).length).replace(/\/+$/, ''),
    folder: key.slice(0, slashIdx + 1),
    namePrefix: match[1],
    epochMs: Number(match[3]),
  };
}

/** HCM_M2.[C&C-05-B-0002]_F00_Z-03_CTX_01 -> surveys/C_C-05-B-0002/CTX/HCM_M2__C_C-05-B-0002__F00_Z-03_CTX_ */
function listPrefixFromPhotoCode(photoCode: unknown): string | null {
  if (typeof photoCode !== 'string') return null;
  const match = PHOTO_CODE_PATTERN.exec(photoCode.trim());
  if (!match) return null;
  const code = match[1].replace(/[^a-zA-Z0-9-]/g, '_');
  const typeMatch = /_([A-Z]+)_$/.exec(match[2]);
  if (!typeMatch) return null;
  return `surveys/${code}/${typeMatch[1]}/HCM_M2__${code}__${match[2]}`;
}

const urlOfItem = (item: unknown): unknown =>
  item && typeof item === 'object' ? (item as Record<string, unknown>).url : item;

/**
 * Quét toàn bộ bản nháp, trả về các ảnh blob:local chưa có mapping và tập key đã được tham chiếu.
 * Ảnh trong danh sách có đủ ngữ cảnh hơn trường đơn lẻ (CTX), nên được ưu tiên khi trùng localId.
 */
export function collectOrphanTargets(
  surveyData: unknown,
  knownMappings: Record<string, string> = {}
): { targets: OrphanPhotoTarget[]; referencedKeys: Set<string> } {
  const targets = new Map<string, OrphanPhotoTarget>();
  const referencedKeys = new Set<string>();

  const addTarget = (next: OrphanPhotoTarget) => {
    const current = targets.get(next.localId);
    if (!current || (!current.listPrefix && next.listPrefix) || (current.nextCaptureMs === null && next.nextCaptureMs !== null)) {
      targets.set(next.localId, next);
    }
  };

  const visitList = (list: unknown[]) => {
    const urls = list.map(urlOfItem);
    if (!urls.some(isLocalUri)) return;

    const clouds = urls.filter(isCloudUrl).map(parseCloudUrl).filter((p): p is ParsedCloudUrl => p !== null);
    const sibling = clouds[0] || null;
    const capturedTimes = urls
      .map((u) => (isLocalUri(u) ? parseCapturedAt(toLocalId(u)) : isCloudUrl(u) ? parseCloudUrl(u)?.epochMs ?? null : null))
      .filter((t): t is number => t !== null);

    urls.forEach((url, idx) => {
      if (!isLocalUri(url)) return;
      const localId = toLocalId(url);
      const capturedAtMs = parseCapturedAt(localId);
      if (knownMappings[localId] || capturedAtMs === null) return;

      const item = list[idx];
      const ownCode = item && typeof item === 'object' ? (item as Record<string, unknown>).photoCode : undefined;
      const later = capturedTimes.filter((t) => t > capturedAtMs);
      addTarget({
        localId,
        capturedAtMs,
        listPrefix: sibling ? `${sibling.folder}${sibling.namePrefix}` : listPrefixFromPhotoCode(ownCode),
        nextCaptureMs: later.length > 0 ? Math.min(...later) : null,
        expectedSeq: idx + 1,
        baseUrl: sibling?.baseUrl ?? null,
      });
    });
  };

  const visitSingleField = (url: unknown, photoCode: unknown) => {
    if (!isLocalUri(url)) return;
    const localId = toLocalId(url);
    const capturedAtMs = parseCapturedAt(localId);
    if (knownMappings[localId] || capturedAtMs === null) return;
    addTarget({
      localId,
      capturedAtMs,
      listPrefix: listPrefixFromPhotoCode(photoCode),
      nextCaptureMs: null,
      expectedSeq: null,
      baseUrl: null,
    });
  };

  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      if (isCloudUrl(node)) {
        const key = keyFromUrl(node);
        if (key) referencedKeys.add(key);
      }
      return;
    }
    if (Array.isArray(node)) {
      visitList(node);
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      visitSingleField(obj.ctxPhotoUrl, obj.ctxPhotoCode);
      visitSingleField(obj.url, obj.photoCode);
      for (const key of Object.keys(obj)) {
        if (key !== '_photoMappings') walk(obj[key]);
      }
    }
  };

  walk(surveyData);
  return { targets: Array.from(targets.values()), referencedKeys };
}

/**
 * Ghép từng ảnh với object trên kho. Không có ứng viên duy nhất thì giữ nguyên blob,
 * tuyệt đối không gán ảnh gần đúng.
 */
export function matchOrphanTargets(
  targets: OrphanPhotoTarget[],
  keysByPrefix: Record<string, string[]>,
  referencedKeys: Set<string>,
  fallbackBaseUrl: string
): OrphanMatchResult {
  const unresolved: OrphanMatchResult['unresolved'] = [];
  const picks: { target: OrphanPhotoTarget; key: string; epochMs: number }[] = [];

  for (const target of targets) {
    if (!target.listPrefix) {
      unresolved.push({ localId: target.localId, reason: 'NO_NAME_PREFIX', candidates: [] });
      continue;
    }

    const upperBound = target.nextCaptureMs ?? target.capturedAtMs + MAX_WINDOW_WITHOUT_NEIGHBOR_MS;
    let candidates = (keysByPrefix[target.listPrefix] || [])
      .filter((key) => !referencedKeys.has(key))
      .map((key) => {
        const match = STORAGE_NAME_PATTERN.exec(key.slice(key.lastIndexOf('/') + 1));
        return match ? { key, seq: Number(match[2]), epochMs: Number(match[3]) } : null;
      })
      .filter((c): c is { key: string; seq: number; epochMs: number } => c !== null)
      .filter((c) => c.epochMs >= target.capturedAtMs && c.epochMs < upperBound);

    if (candidates.length > 1 && target.expectedSeq !== null) {
      const sameSeq = candidates.filter((c) => c.seq === target.expectedSeq);
      if (sameSeq.length > 0) candidates = sameSeq;
    }

    if (candidates.length === 1) {
      picks.push({ target, key: candidates[0].key, epochMs: candidates[0].epochMs });
    } else {
      unresolved.push({
        localId: target.localId,
        reason: candidates.length === 0 ? 'NO_CANDIDATE' : 'AMBIGUOUS',
        candidates: candidates.map((c) => c.key),
      });
    }
  }

  const recovered: OrphanMatchResult['recovered'] = {};
  for (const pick of picks) {
    if (picks.filter((p) => p.key === pick.key).length > 1) {
      unresolved.push({ localId: pick.target.localId, reason: 'CONFLICT', candidates: [pick.key] });
      continue;
    }
    const baseUrl = (pick.target.baseUrl || fallbackBaseUrl).replace(/\/+$/, '');
    recovered[pick.target.localId] = { key: pick.key, url: `${baseUrl}/${pick.key}`, epochMs: pick.epochMs };
  }

  return { recovered, unresolved };
}
