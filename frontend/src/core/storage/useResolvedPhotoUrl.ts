import { useEffect, useState } from 'react';
import { getSafeDisplayUrl, hasLocalBlobCandidate, resolveOfflinePhotoUrl } from './offlinePhotoStorage';

interface ResolvedPhotoState {
  src: string;
  displayUrl: string;
  isResolving: boolean;
}

/**
 * URL gán ngay cho <img> trước khi phân giải xong. Ảnh Cloud do chính máy này chụp (còn bản gốc trong
 * IndexedDB) thì để trống trong vài ms tra cứu, KHÔNG gán URL https (tránh tải ngược ~2 MB qua 4G).
 */
function initialDisplayUrl(src: string): string {
  const safe = getSafeDisplayUrl(src);
  return safe === src && hasLocalBlobCandidate(src) ? '' : safe;
}

/**
 * Phân giải URI ảnh thành URL hiển thị, gắn chặt kết quả với đúng `src` đang yêu cầu.
 * Lưới ảnh dùng key theo chỉ số nên instance được tái sử dụng khi chuyển Vùng/Tầng:
 * nếu `src` mới không phân giải được thì trả về rỗng, TUYỆT ĐỐI không giữ lại ảnh của `src` cũ
 * (hiển thị nhầm ảnh của vùng khác trên hồ sơ pháp lý).
 */
export function useResolvedPhotoUrl(rawSrc?: string | null): { displayUrl: string; isResolving: boolean } {
  const src = rawSrc || '';
  const [state, setState] = useState<ResolvedPhotoState>(() => ({
    src,
    displayUrl: initialDisplayUrl(src),
    isResolving: Boolean(src),
  }));

  useEffect(() => {
    if (!src) {
      setState({ src, displayUrl: '', isResolving: false });
      return;
    }

    let isSubscribed = true;
    const immediate = initialDisplayUrl(src);
    setState({ src, displayUrl: immediate, isResolving: true });

    resolveOfflinePhotoUrl(src)
      .then((resolved) => {
        if (isSubscribed) {
          setState({ src, displayUrl: resolved || immediate, isResolving: false });
        }
      })
      .catch((err: unknown) => {
        console.error('[useResolvedPhotoUrl:Resolve] Không thể phân giải ảnh:', err);
        if (isSubscribed) {
          setState({ src, displayUrl: getSafeDisplayUrl(src), isResolving: false });
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [src]);

  // Ngay trong lần render `src` vừa đổi (trước khi effect chạy) cũng không được lộ ảnh cũ
  if (state.src !== src) {
    return { displayUrl: initialDisplayUrl(src), isResolving: Boolean(src) };
  }
  return { displayUrl: state.displayUrl, isResolving: state.isResolving };
}
