import { useState, useEffect } from 'react';
import { api } from '../../services/api';

export interface StorageInfo {
  storageType: 'local' | 'r2' | 's3';
  configuredType: string;
  isLocal: boolean;
  isGuarded: boolean;
  providerName: string;
  publicBaseUrl: string;
}

// Giá trị mặc định an toàn ban đầu
const DEFAULT_STORAGE_INFO: StorageInfo = {
  storageType: 'local',
  configuredType: 'local',
  isLocal: true,
  isGuarded: false,
  providerName: 'Bộ nhớ Cục bộ (Local Disk)',
  publicBaseUrl: '/uploads',
};

const STORAGE_CACHE_KEY = 'metro2_storage_info_cache';

// Lấy từ cache nếu có
let cachedInfo: StorageInfo = (() => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_CACHE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (_e) {
      // ignore
    }
    // Nếu chạy trên localhost / 127.0.0.1 thì mặc định coi là local
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      return DEFAULT_STORAGE_INFO;
    }
  }
  return DEFAULT_STORAGE_INFO;
})();

let isFetching = false;
const listeners = new Set<(info: StorageInfo) => void>();

export async function fetchStorageInfo(): Promise<StorageInfo> {
  if (isFetching) return cachedInfo;
  isFetching = true;
  try {
    const res = await api.get('/storage/info');
    if (res.data?.success && res.data?.data) {
      cachedInfo = res.data.data;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(cachedInfo));
        } catch (_e) {}
      }
      listeners.forEach((listener) => listener(cachedInfo));
    }
  } catch (err) {
    // Nếu không lấy được (vd offline hoặc backend chưa bật), fallback dựa vào hostname
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (isLocalhost) {
      cachedInfo = DEFAULT_STORAGE_INFO;
    }
  } finally {
    isFetching = false;
  }
  return cachedInfo;
}

// Tự động gọi 1 lần khi load app
if (typeof window !== 'undefined') {
  setTimeout(() => {
    fetchStorageInfo();
  }, 500);
}

export function getCachedStorageInfo(): StorageInfo {
  return cachedInfo;
}

/**
 * React Hook cung cấp thông tin storage động
 */
export function useStorageInfo() {
  const [info, setInfo] = useState<StorageInfo>(cachedInfo);

  useEffect(() => {
    listeners.add(setInfo);
    fetchStorageInfo().then(setInfo);
    return () => {
      listeners.delete(setInfo);
    };
  }, []);

  const isLocal = info.isLocal;
  const isCloud = !isLocal;
  const providerLabel = isLocal ? 'Bộ nhớ Cục bộ (Local)' : 'Cloudflare R2';
  const shortBadge = isLocal ? '✓ Local' : '✓ R2';
  const shortUploadingBadge = isLocal ? 'Local...' : 'R2...';
  const syncingText = isLocal ? 'Đang lưu vào bộ nhớ Local...' : 'Đang đồng bộ ngầm lên Cloudflare R2...';
  const syncedText = isLocal ? 'Đã lưu an toàn vào bộ nhớ Cục bộ (Local)' : 'Đã lưu trữ an toàn trên Cloudflare R2';
  const unsyncedText = isLocal ? 'Chưa lưu máy chủ' : 'Chưa lên Cloud';

  return {
    ...info,
    isLocal,
    isCloud,
    providerLabel,
    shortBadge,
    shortUploadingBadge,
    syncingText,
    syncedText,
    unsyncedText,
  };
}
