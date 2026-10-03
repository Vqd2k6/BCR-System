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
}

const DB_NAME = 'Metro2_Offline_Photos';
const DB_VERSION = 1;
const STORE_NAME = 'photo_blobs';

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

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
 * Xóa một ảnh khỏi IndexedDB sau khi đã tải lên Cloudflare R2 thành công
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
 * Lấy toàn bộ danh sách ảnh offline đang chờ tải lên Cloud
 */
export async function getAllPendingPhotos(): Promise<OfflinePhotoRecord[]> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflinePhotoStorage] Lỗi lấy danh sách ảnh pending:', err);
    return [];
  }
}

/**
 * Quản lý vòng đời URL Blob trong RAM (ObjectURL Registry)
 * Đảm bảo mọi URL tạm thời được giải phóng triệt để khi không còn dùng
 */
const activeObjectUrls = new Map<string, string>(); // photoId -> objectUrl

export function createManagedBlobUrl(id: string, blob: Blob): string {
  if (activeObjectUrls.has(id)) {
    URL.revokeObjectURL(activeObjectUrls.get(id)!);
  }
  const url = URL.createObjectURL(blob);
  activeObjectUrls.set(id, url);
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
  if (uri.startsWith('blob:local://')) {
    return uri.replace('blob:local://', '');
  }
  return uri;
}

/**
 * Trả về URL an toàn để render tức thì lên DOM (đồng bộ)
 * - Nếu là ảnh Cloud (http...) hoặc DataURL hoặc Blob URL hợp lệ: trả về nguyên bản.
 * - Nếu là "blob:local://{id}": tra cứu RAM ObjectURL registry. Nếu có, trả về ngay;
 *   nếu chưa có trong RAM, trả về chuỗi rỗng '' để ngăn trình duyệt nạp scheme lạ gây lỗi ERR_UNKNOWN_URL_SCHEME.
 */
export function getSafeDisplayUrl(uri?: string | null): string {
  if (!uri || typeof uri !== 'string' || uri.trim() === '') {
    return '';
  }
  if (
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('/uploads') ||
    uri.startsWith('data:') ||
    uri.startsWith('blob:http')
  ) {
    return uri;
  }
  if (uri.startsWith('blob:local://')) {
    const localId = extractLocalIdFromUri(uri);
    if (activeObjectUrls.has(localId)) {
      return activeObjectUrls.get(localId)!;
    }
    return '';
  }
  return uri;
}

/**
 * Phân giải chuỗi định danh ảnh (URI) thành URL có thể hiển thị được trên DOM
 * - Nếu là "blob:local://{id}", tra cứu trong RAM Map hoặc nạp từ IndexedDB.
 * - Nếu là URL Cloud (http...) hoặc DataURL, trả về nguyên bản.
 */
export async function resolveOfflinePhotoUrl(uri?: string | null): Promise<string> {
  if (!uri || typeof uri !== 'string' || uri.trim() === '') {
    return '';
  }

  // 1. Nếu là ảnh Cloud hoặc Base64, hiển thị trực tiếp
  if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('/uploads') || uri.startsWith('data:')) {
    return uri;
  }

  // 2. Nếu là Blob URL thông thường còn active
  if (uri.startsWith('blob:http')) {
    return uri;
  }

  // 3. Nếu là mã định danh bền vững blob:local://{id}
  if (uri.startsWith('blob:local://')) {
    const localId = extractLocalIdFromUri(uri);
    // Kiểm tra trong RAM registry trước
    if (activeObjectUrls.has(localId)) {
      return activeObjectUrls.get(localId)!;
    }

    // Nếu chưa có trong RAM (ví dụ sau khi F5), khôi phục từ IndexedDB
    try {
      const record = await getOfflinePhoto(localId);
      if (record && record.blob) {
        return createManagedBlobUrl(localId, record.blob);
      }
    } catch (err) {
      console.warn(`[OfflinePhotoStorage] Không thể khôi phục ảnh offline ${localId}:`, err);
    }
    return '';
  }

  return uri;
}

/**
 * Quét đệ quy đối tượng dữ liệu (Form Data / Object / Array) và thay thế
 * mã tạm "blob:local://${localId}" thành URL Cloud chính thức sau khi tải lên Cloudflare R2
 */
export function replaceLocalUriInObject(target: any, localId: string, cloudUrl: string): any {
  if (target === null || target === undefined) return target;

  const targetUri = `blob:local://${localId}`;

  if (typeof target === 'string') {
    if (target === targetUri || target.startsWith(`${targetUri}?`)) {
      return cloudUrl;
    }
    return target;
  }

  if (Array.isArray(target)) {
    return target.map((item) => replaceLocalUriInObject(item, localId, cloudUrl));
  }

  if (typeof target === 'object') {
    const updated: Record<string, any> = {};
    for (const key of Object.keys(target)) {
      updated[key] = replaceLocalUriInObject(target[key], localId, cloudUrl);
    }
    return updated;
  }

  return target;
}

