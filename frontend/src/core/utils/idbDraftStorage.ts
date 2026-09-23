/**
 * IndexedDB Survey Draft Storage Utility
 * Cung cấp khả năng lưu trữ nháp hồ sơ khảo sát không giới hạn dung lượng (hàng trăm MBs),
 * an toàn với ảnh chụp Base64 độ phân giải cao và sơ đồ CAD mà không bị QuotaExceededError.
 */

const DB_NAME = 'Metro2SurveyAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'survey_drafts';

let dbInstance: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB không được hỗ trợ trong môi trường này.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[idbDraftStorage] Lỗi mở IndexedDB:', event);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

/**
 * Lưu dữ liệu nháp vào IndexedDB
 */
export const saveSurveyDraft = async (key: string, data: any): Promise<boolean> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const record = {
        key,
        data,
        updatedAt: new Date().toISOString(),
      };
      const request = store.put(record);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = (e) => {
        console.error(`[idbDraftStorage] Không thể lưu draft cho key "${key}":`, e);
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn(`[idbDraftStorage] Lỗi trong saveSurveyDraft:`, err);
    return false;
  }
};

/**
 * Tải dữ liệu nháp từ IndexedDB
 */
export const loadSurveyDraft = async <T = any>(key: string): Promise<T | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        if (request.result && request.result.data) {
          resolve(request.result.data as T);
        } else {
          resolve(null);
        }
      };

      request.onerror = (e) => {
        console.error(`[idbDraftStorage] Không thể đọc draft cho key "${key}":`, e);
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn(`[idbDraftStorage] Lỗi trong loadSurveyDraft:`, err);
    return null;
  }
};

/**
 * Xóa dữ liệu nháp khỏi IndexedDB
 */
export const deleteSurveyDraft = async (key: string): Promise<boolean> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn(`[idbDraftStorage] Lỗi trong deleteSurveyDraft:`, err);
    return false;
  }
};
