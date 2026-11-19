/**
 * KHO LƯU TRỮ ẢNH NHỊ PHÂN OFFLINE (INDEXEDDB BINARY PHOTO STORE)
 * Dự án: Hệ Thống Khảo Sát Hiện Trạng Tuyến Metro Số 2
 *
 * Tính chất kỹ thuật:
 * - Sử dụng W3C IndexedDB thuần túy (Zero Dependency), hoạt động 100% trên Tab Web thường và PWA.
 * - Lưu trữ Binary Blob trực tiếp trên ổ đĩa thiết bị (hạn mức 1GB - 5GB), 0% tiêu thụ RAM Heap JS.
 * - Triệt tiêu hoàn toàn chuỗi Base64 khỏi RAM, ngăn chặn 100% lỗi WebProcess Crash trên iOS Safari.
 */

export interface OfflinePhotoRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  filename: string;
  photoCode: string;
  metadata: Record<string, string>;
  createdAt: number;
  uploadStatus?: 'PENDING' | 'UPLOADED' | 'ERROR';
  cloudUrl?: string;
  uploadedAt?: number;
  deviceId?: string;
  mappingRestoredAt?: number;
}

const DB_NAME = 'Metro2_Offline_Photos';
const DB_VERSION = 1;
const STORE_NAME = 'photo_blobs';

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

/**
 * Lấy hoặc khởi tạo Device ID duy nhất bền vững cho thiết bị vật lý này
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined' || !window.localStorage) return 'dev_unknown';
  try {
    let id = localStorage.getItem('metro2_device_id');
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem('metro2_device_id', id);
    }
    return id;
  } catch (_e) {
    console.warn('[offlinePhotoStorage:getDeviceId] Bỏ qua lỗi không chặn luồng:', _e);
    return 'dev_ephemeral';
  }
}

function getDb(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  if (dbOpenPromise) {
    return dbOpenPromise;
  }

  dbOpenPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB không được hỗ trợ trong môi trường này.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('photoCode', 'photoCode', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbOpenPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      dbOpenPromise = null;
      console.error('[OfflinePhotoStorage] Lỗi khởi tạo IndexedDB:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbOpenPromise;
}

/**
 * Lưu một Binary Blob ảnh vào IndexedDB
 */
export async function saveOfflinePhoto(
  id: string,
  blob: Blob,
  photoCode: string,
  metadata?: Record<string, string>,
  filename?: string
): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record: OfflinePhotoRecord = {
      id,
      blob,
      mimeType: blob.type || 'image/jpeg',
      filename: filename || `${photoCode || 'photo'}_${id}.jpg`,
      photoCode,
      metadata: metadata || {},
      createdAt: Date.now(),
      uploadStatus: 'PENDING',
      deviceId: getDeviceId(),
    };

    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Lấy bản ghi ảnh từ IndexedDB theo ID
 */
export async function getOfflinePhoto(id: string): Promise<OfflinePhotoRecord | null> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[OfflinePhotoStorage] Không tìm thấy ảnh offline ${id}:`, err);
    return null;
  }
}

/**
 * Đánh dấu ảnh đã tải lên Cloudflare R2 thành công (Safe Retention Policy)
 * KHÔNG xóa nhị phân Blob khỏi IndexedDB ngay để bảo toàn an toàn dữ liệu,
 * phòng trường hợp phiên khảo sát bị ngắt hoặc chưa kịp lưu bản nháp lên server.
 */
export async function markOfflinePhotoUploaded(id: string, cloudUrl: string): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const record = req.result as OfflinePhotoRecord | undefined;
        if (record) {
          record.uploadStatus = 'UPLOADED';
          record.cloudUrl = cloudUrl;
          record.uploadedAt = Date.now();
          store.put(record);
        }
        resolve();
      };
      req.onerror = () => resolve();
    });
  } catch (err) {
    console.warn(`[OfflinePhotoStorage] Lỗi đánh dấu ảnh đã upload ${id}:`, err);
  }
}

/**
 * Xóa một ảnh khỏi IndexedDB khi người dùng chủ động xóa ảnh khỏi biểu mẫu
 */
export async function deleteOfflinePhoto(id: string): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[OfflinePhotoStorage] Lỗi xóa ảnh offline ${id}:`, err);
  }
}

/**
 * Dọn dẹp các ảnh nhị phân đã tải lên Cloud thành công từ hơn maxAgeDays ngày trước
 */
export async function purgeUploadedPhotos(maxAgeDays: number = 7): Promise<number> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = (req.result || []) as OfflinePhotoRecord[];
        const threshold = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
        let deleted = 0;
        for (const r of records) {
          if (r.uploadStatus === 'UPLOADED' && r.uploadedAt && r.uploadedAt < threshold) {
            store.delete(r.id);
            deleted++;
          }
        }
        resolve(deleted);
      };
      req.onerror = () => resolve(0);
    });
  } catch (_e) {
    console.error('[offlinePhotoStorage:purgeUploadedPhotos] Lỗi đã xử lý bằng nhánh dự phòng:', _e);
    return 0;
  }
}

/**
 * Lấy toàn bộ danh sách ảnh offline đang chờ tải lên Cloud (chưa có cờ UPLOADED)
 */
export async function getAllPendingPhotos(): Promise<OfflinePhotoRecord[]> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result || []) as OfflinePhotoRecord[];
        // Chỉ lấy những ảnh chưa được tải lên Cloud thành công
        const pending = all.filter((r) => r.uploadStatus !== 'UPLOADED');
        resolve(pending);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflinePhotoStorage] Lỗi lấy danh sách ảnh pending:', err);
    return [];
  }
}

/**
 * Lấy các ảnh đã tải lên Cloud (có cloudUrl) nhưng chưa từng được khôi phục mapping.
 * Các bản ghi này bị resumePendingOfflineUploads bỏ qua, nên nếu mất mapping thì
 * bản nháp sẽ kẹt mãi ở blob:local:// dù ảnh đã nằm trên Cloud.
 */
export async function getUploadedPhotosWithCloudUrl(): Promise<OfflinePhotoRecord[]> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result || []) as OfflinePhotoRecord[];
        resolve(all.filter((r) => r.uploadStatus === 'UPLOADED' && Boolean(r.cloudUrl) && !r.mappingRestoredAt));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[OfflinePhotoStorage:ListUploaded] Lỗi lấy danh sách ảnh đã upload:', err);
    return [];
  }
}

/**
 * Đánh dấu đã khôi phục mapping để mỗi bản ghi chỉ xử lý một lần
 * (bản ghi không bị dọn, nếu không sẽ phát lại toàn bộ mapping sau mỗi lần mở ứng dụng)
 */
export async function markPhotoMappingRestored(id: string): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const record = req.result as OfflinePhotoRecord | undefined;
        if (record) {
          record.mappingRestoredAt = Date.now();
          store.put(record);
        }
        resolve();
      };
      req.onerror = () => resolve();
    });
  } catch (err) {
    console.error(`[OfflinePhotoStorage:MarkRestored] Lỗi đánh dấu mapping ${id}:`, err);
  }
}

/**
 * Quản lý vòng đời URL Blob trong RAM (ObjectURL Registry)
 * Đảm bảo mọi URL tạm thời được giải phóng triệt để khi không còn dùng
 */
const activeObjectUrls = new Map<string, string>(); // photoId -> objectUrl (thứ tự chèn = LRU, cũ nhất ở đầu)

/**
 * Số ObjectURL của ảnh ĐÃ lên Cloud được giữ trong RAM để hiển thị tức thì (không tải ngược từ R2).
 * Ảnh chưa upload không bao giờ bị thu hồi ở đây (đang là bản duy nhất để hiển thị).
 * Ảnh bị thu hồi vẫn nằm trong IndexedDB, lần hiển thị sau tự tạo lại qua resolveOfflinePhotoUrl.
 */
const MAX_RETAINED_UPLOADED_URLS = 24;

function touchManagedBlobUrl(id: string): string | undefined {
  const url = activeObjectUrls.get(id);
  if (url !== undefined) {
    activeObjectUrls.delete(id);
    activeObjectUrls.set(id, url);
  }
  return url;
}

function evictUploadedBlobUrls(): void {
  if (activeObjectUrls.size <= MAX_RETAINED_UPLOADED_URLS) return;
  let forward: Record<string, string>;
  try {
    forward = readPhotoMapping()?.forward ?? {};
  } catch (_e) {
    console.error('[offlinePhotoStorage:evictUploadedBlobUrls] Không đọc được mapping, bỏ qua thu hồi:', _e);
    return;
  }
  let uploaded = 0;
  for (const id of activeObjectUrls.keys()) {
    if (forward[id]) uploaded++;
  }
  for (const [id, url] of activeObjectUrls) {
    if (uploaded <= MAX_RETAINED_UPLOADED_URLS) break;
    if (!forward[id]) continue;
    URL.revokeObjectURL(url);
    activeObjectUrls.delete(id);
    uploaded--;
  }
}

export function createManagedBlobUrl(id: string, blob: Blob): string {
  if (activeObjectUrls.has(id)) {
    URL.revokeObjectURL(activeObjectUrls.get(id)!);
    activeObjectUrls.delete(id);
  }
  const url = URL.createObjectURL(blob);
  activeObjectUrls.set(id, url);
  evictUploadedBlobUrls();
  return url;
}

export function revokeManagedBlobUrl(id: string): void {
  if (activeObjectUrls.has(id)) {
    URL.revokeObjectURL(activeObjectUrls.get(id)!);
    activeObjectUrls.delete(id);
  }
}

export function isLocalBlobUri(uri?: string | null): boolean {
  if (!uri) return false;
  return uri.startsWith('blob:local://') || uri.startsWith('blob:http');
}

export function extractLocalIdFromUri(uri: string): string {
  if (!uri || typeof uri !== 'string') return '';
  if (uri.startsWith('blob:local://')) {
    return uri.replace('blob:local://', '').split('?')[0];
  }
  if (uri.startsWith('photo_') || uri.startsWith('cad_')) {
    return uri.split('?')[0];
  }
  return '';
}

const UPLOADED_PHOTO_MAP_KEY = 'metro2_uploaded_photo_map';

/**
 * Ghi nhớ mapping giữa localId và Cloudflare R2 Public URL vào bộ nhớ bền vững (localStorage)
 * Đảm bảo 100% không mất ảnh kể cả khi KSV chuyển tab/căn hộ trước khi upload xong
 */
export function saveUploadedPhotoMapping(localId: string, publicUrl: string): void {
  if (!localId || !publicUrl || typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = localStorage.getItem(UPLOADED_PHOTO_MAP_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    // Xóa rồi ghi lại để mục mới nhất luôn nằm cuối (thứ tự chèn của object)
    delete map[localId];
    map[localId] = publicUrl;
    // Giới hạn tối đa 5000 mapping gần nhất để tránh tràn localStorage
    const keys = Object.keys(map);
    if (keys.length > 5000) {
      for (const k of keys.slice(0, keys.length - 5000)) {
        delete map[k];
      }
    }
    localStorage.setItem(UPLOADED_PHOTO_MAP_KEY, JSON.stringify(map));
  } catch (_e) {
    console.error('[offlinePhotoStorage:saveUploadedPhotoMapping] Lỗi đã xử lý bằng nhánh dự phòng:', _e);
  }
}

/**
 * Xin trình duyệt giữ bền kho lưu trữ (IndexedDB) để không bị dọn khi thiếu dung lượng (đặc biệt iOS Safari)
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
      const already = typeof navigator.storage.persisted === 'function' ? await navigator.storage.persisted() : false;
      if (!already) {
        await navigator.storage.persist();
      }
    }
  } catch (_e) {
    console.error('[offlinePhotoStorage:requestPersistentStorage] Lỗi đã xử lý bằng nhánh dự phòng:', _e);
  }
}

/**
 * Bộ đệm đọc của persistent mapping: chỉ parse lại khi chuỗi trong localStorage đổi
 * (tab khác / test có thể ghi thẳng vào localStorage nên không giữ cache cứng).
 */
let mappingCache: { raw: string; forward: Record<string, string>; reverse: Map<string, string> } | null = null;

function readPhotoMapping(): { forward: Record<string, string>; reverse: Map<string, string> } | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const raw = localStorage.getItem(UPLOADED_PHOTO_MAP_KEY);
  if (!raw) return null;
  if (mappingCache && mappingCache.raw === raw) return mappingCache;
  const forward: Record<string, string> = JSON.parse(raw);
  const reverse = new Map<string, string>();
  for (const [localId, cloudUrl] of Object.entries(forward)) {
    if (cloudUrl) reverse.set(cloudUrl, localId);
  }
  mappingCache = { raw, forward, reverse };
  return mappingCache;
}

/**
 * Tra cứu Cloud URL đã biết theo localId từ persistent mapping
 */
export function getKnownCloudUrl(localId: string): string | null {
  if (!localId) return null;
  try {
    return readPhotoMapping()?.forward[localId] || null;
  } catch (_e) {
    console.error('[offlinePhotoStorage:getKnownCloudUrl] Lỗi đã xử lý bằng nhánh dự phòng:', _e);
    return null;
  }
}

/**
 * Tra ngược: Cloud URL này có phải ảnh chụp trên chính thiết bị này không (localId tương ứng).
 */
function getLocalIdForCloudUrl(cloudUrl: string): string | null {
  if (!cloudUrl) return null;
  try {
    return readPhotoMapping()?.reverse.get(cloudUrl) || null;
  } catch (_e) {
    console.error('[offlinePhotoStorage:getLocalIdForCloudUrl] Lỗi đã xử lý bằng nhánh dự phòng:', _e);
    return null;
  }
}

/** URL ảnh đã lưu trữ: R2/S3 (https) hoặc file server khi chạy STORAGE_TYPE=local (/uploads/...) */
function isUploadedPhotoUrl(uri: string): boolean {
  return uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('/uploads');
}

/**
 * URL Cloud có thể có bản gốc trên thiết bị này (ảnh do máy này chụp & upload).
 * Dùng để KHÔNG gán ngay URL https vào <img> (tránh tải ngược ảnh ~2 MB qua 4G) trong lúc tra IndexedDB.
 */
export function hasLocalBlobCandidate(uri?: string | null): boolean {
  if (!uri || !isUploadedPhotoUrl(uri)) return false;
  return Boolean(getLocalIdForCloudUrl(uri));
}

/**
 * Lấy ObjectURL cục bộ cho một Cloud URL nếu thiết bị còn giữ đúng bản đã upload.
 * Chỉ nhận bản ghi IndexedDB có `uploadStatus = UPLOADED` và `cloudUrl` trùng khớp tuyệt đối
 * (bảo đảm hiển thị đúng từng byte đã đẩy lên R2 — chứng cứ pháp lý không được lệch).
 */
async function resolveLocalBlobForCloudUrl(cloudUrl: string): Promise<string> {
  const localId = getLocalIdForCloudUrl(cloudUrl);
  if (!localId) return '';
  const inRam = touchManagedBlobUrl(localId);
  if (inRam) return inRam;
  try {
    const record = await getOfflinePhoto(localId);
    if (record && record.blob && record.uploadStatus === 'UPLOADED' && record.cloudUrl === cloudUrl) {
      return createManagedBlobUrl(localId, record.blob);
    }
  } catch (err) {
    console.error(`[offlinePhotoStorage:ResolveLocalForCloud] Không đọc được ảnh cục bộ ${localId}:`, err);
  }
  return '';
}

/**
 * Định nghĩa DUY NHẤT của "ảnh đã lưu an toàn": badge đồng bộ và Kiểm Tra Ảnh phải cùng dùng
 * hàm này và luôn xét URI thật của ảnh, không xét URL đang hiển thị.
 */
export function isPersistedPhotoUrl(uri?: string | null): boolean {
  if (!uri || typeof uri !== 'string') return false;
  if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('/uploads')) {
    return true;
  }
  return Boolean(getKnownCloudUrl(extractLocalIdFromUri(uri)));
}

/**
 * Trả về URL an toàn để render tức thì lên DOM (đồng bộ)
 * - Nếu là ảnh Cloud (http...) hoặc DataURL hoặc Blob URL hợp lệ: trả về nguyên bản.
 * - Nếu là "blob:local://{id}": tra cứu Cloud mapping đã biết -> RAM ObjectURL registry.
 *   Nếu chưa có, trả về chuỗi rỗng '' để ngăn trình duyệt nạp scheme lạ gây lỗi ERR_UNKNOWN_URL_SCHEME.
 */
export function getSafeDisplayUrl(uri?: string | null): string {
  if (!uri || typeof uri !== 'string' || uri.trim() === '') {
    return '';
  }
  if (isUploadedPhotoUrl(uri)) {
    // Ảnh do chính máy này chụp & upload: dùng bản trong RAM nếu còn, không tải ngược từ R2
    const localId = getLocalIdForCloudUrl(uri);
    const inRam = localId ? touchManagedBlobUrl(localId) : undefined;
    return inRam || uri;
  }
  if (uri.startsWith('data:') || uri.startsWith('blob:http')) {
    return uri;
  }
  if (uri.startsWith('blob:local://')) {
    const localId = extractLocalIdFromUri(uri);
    const inRam = touchManagedBlobUrl(localId);
    if (inRam) {
      return inRam;
    }
    return getKnownCloudUrl(localId) || '';
  }
  return uri;
}

/**
 * Phân giải chuỗi định danh ảnh (URI) thành URL có thể hiển thị được trên DOM
 * - Nếu là "blob:local://{id}", tra cứu Persistent Cloud Mapping -> RAM Map -> IndexedDB.
 * - Nếu là URL Cloud (http...) hoặc DataURL, trả về nguyên bản.
 */
export async function resolveOfflinePhotoUrl(uri?: string | null): Promise<string> {
  if (!uri || typeof uri !== 'string' || uri.trim() === '') {
    return '';
  }

  // 1. Ảnh Cloud: nếu chính máy này chụp & còn bản đã upload trong RAM/IndexedDB thì hiển thị bản cục bộ
  //    (0 byte tải ngược từ R2); ảnh từ máy khác / đã dọn sau 7 ngày thì tải HTTPS như cũ
  if (isUploadedPhotoUrl(uri)) {
    return (await resolveLocalBlobForCloudUrl(uri)) || uri;
  }

  // 2. Base64, Blob URL thông thường: hiển thị trực tiếp
  if (uri.startsWith('data:') || uri.startsWith('blob:http')) {
    return uri;
  }

  // 3. Nếu là mã định danh bền vững blob:local://{id}: RAM → IndexedDB → Cloud URL đã biết
  if (uri.startsWith('blob:local://')) {
    const localId = extractLocalIdFromUri(uri);

    // 3.1. Kiểm tra trong RAM registry
    const inRam = touchManagedBlobUrl(localId);
    if (inRam) {
      return inRam;
    }

    // 3.2. Nếu chưa có trong RAM (ví dụ sau khi F5), khôi phục từ IndexedDB
    try {
      const record = await getOfflinePhoto(localId);
      if (record && record.blob) {
        return createManagedBlobUrl(localId, record.blob);
      }
    } catch (err) {
      console.warn(`[OfflinePhotoStorage] Không thể khôi phục ảnh offline ${localId}:`, err);
    }

    // 3.3. Thiết bị không còn bản nhị phân: dùng Cloud URL đã upload trước đó
    return getKnownCloudUrl(localId) || '';
  }

  return uri;
}

/**
 * Quét đệ quy đối tượng dữ liệu (Form Data / Object / Array) và thay thế
 * mã tạm "blob:local://${localId}" thành URL Cloud chính thức sau khi tải lên Cloudflare R2
 */
export function replaceLocalUriInObject<T>(target: T, localIdOrUri: string, cloudUrl: string): T {
  if (target === null || target === undefined || !localIdOrUri) return target;

  const cleanId = localIdOrUri.startsWith('blob:local://')
    ? localIdOrUri.replace('blob:local://', '').split('?')[0]
    : localIdOrUri.split('?')[0];
  const targetUri = `blob:local://${cleanId}`;

  if (typeof target === 'string') {
    if (
      target === targetUri ||
      target.startsWith(`${targetUri}?`) ||
      target === localIdOrUri ||
      target.startsWith(`${localIdOrUri}?`)
    ) {
      return cloudUrl as unknown as T;
    }
    return target;
  }

  if (Array.isArray(target)) {
    return target.map((item) => replaceLocalUriInObject(item, localIdOrUri, cloudUrl)) as unknown as T;
  }

  if (typeof target === 'object') {
    const updated: Record<string, unknown> = {};
    const obj = target as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      updated[key] = replaceLocalUriInObject(obj[key], localIdOrUri, cloudUrl);
    }
    return updated as T;
  }

  return target;
}

/**
 * "Vá" dữ liệu: mọi chuỗi blob:local://{id} đã có Cloud URL trong persistent mapping
 * sẽ được thay bằng Cloud URL (bất biến, không mutate đầu vào).
 * Dùng khi nạp bản nháp, trước khi đồng bộ nháp và trước khi nộp.
 */
export function healLocalPhotoUris<T>(target: T): T {
  if (target === null || target === undefined) return target;

  if (typeof target === 'string') {
    if (target.startsWith('blob:local://')) {
      const localId = extractLocalIdFromUri(target.split('?')[0]);
      const cloud = getKnownCloudUrl(localId);
      if (cloud) return cloud as unknown as T;
    }
    return target;
  }

  if (Array.isArray(target)) {
    let changed = false;
    const mapped = target.map((item) => {
      const next = healLocalPhotoUris(item);
      if (next !== item) changed = true;
      return next;
    });
    return (changed ? mapped : target) as unknown as T;
  }

  if (typeof target === 'object') {
    const obj = target as Record<string, unknown>;
    let changed = false;
    const updated: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const next = healLocalPhotoUris(obj[key]);
      if (next !== obj[key]) changed = true;
      updated[key] = next;
    }
    return (changed ? updated : target) as T;
  }

  return target;
}

/**
 * Lưới an toàn độc lập với danh sách trường của từng biểu mẫu:
 * quét mọi chuỗi blob:... hoặc ảnh base64 lớn (chưa lên Cloud) và trả về đường dẫn JSON của chúng.
 */
export function findUnsyncedPhotoPaths(target: unknown, basePath: string = '$', out: string[] = []): string[] {
  if (target === null || target === undefined) return out;

  if (typeof target === 'string') {
    if (target.startsWith('blob:') || (target.startsWith('data:image/') && target.length > 200)) {
      out.push(basePath);
    }
    return out;
  }

  if (Array.isArray(target)) {
    target.forEach((item, idx) => findUnsyncedPhotoPaths(item, `${basePath}[${idx}]`, out));
    return out;
  }

  if (typeof target === 'object') {
    const obj = target as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      findUnsyncedPhotoPaths(obj[key], `${basePath}.${key}`, out);
    }
  }
  return out;
}

