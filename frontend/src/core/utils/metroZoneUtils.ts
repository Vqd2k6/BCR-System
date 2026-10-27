/**
 * METRO 2 ZONE CENTROIDS & SPATIAL UTILITIES
 * Tọa độ trọng tâm (Centroid) chuẩn xác của các phân khu ga tuyến Metro 2
 * Khớp 100% với PostGIS ST_Centroid(ST_Union(cadastral_polygon_geom)) trong CSDL
 */

export interface MetroZoneCentroid {
  zoneId: string;
  zoneName: string;
  lat: number;
  lng: number;
}

export const METRO_ZONE_CENTROIDS: Record<string, MetroZoneCentroid> = {
  ZONE_S1: { zoneId: 'ZONE_S1', zoneName: 'Ga S1 - Bến Thành', lat: 10.770830, lng: 106.696694 },
  ZONE_S2: { zoneId: 'ZONE_S2', zoneName: 'Ga S2 - Tao Đàn', lat: 10.774130, lng: 106.690134 },
  ZONE_S3: { zoneId: 'ZONE_S3', zoneName: 'Ga S3 - Dân Chủ', lat: 10.777797, lng: 106.678489 },
  ZONE_S4: { zoneId: 'ZONE_S4', zoneName: 'Ga S4 - Hòa Hưng', lat: 10.782510, lng: 106.672859 },
  ZONE_S5: { zoneId: 'ZONE_S5', zoneName: 'Ga S5 - Lê Thị Riêng', lat: 10.786061, lng: 106.665315 },
  ZONE_S6: { zoneId: 'ZONE_S6', zoneName: 'Ga S6 - Phạm Văn Hai', lat: 10.790290, lng: 106.658081 },
  ZONE_S7: { zoneId: 'ZONE_S7', zoneName: 'Ga S7 - Bảy Hiền', lat: 10.793561, lng: 106.652375 },
  ZONE_S8: { zoneId: 'ZONE_S8', zoneName: 'Ga S8 - Nguyễn Hồng Đào', lat: 10.797605, lng: 106.644632 },
  ZONE_S9: { zoneId: 'ZONE_S9', zoneName: 'Ga S9 - Bà Quẹo', lat: 10.802564, lng: 106.637211 },
  ZONE_S10: { zoneId: 'ZONE_S10', zoneName: 'Ga S10 - Phạm Văn Bạch', lat: 10.815381, lng: 106.630708 },
  ZONE_S11: { zoneId: 'ZONE_S11', zoneName: 'Ga S11 - Tân Bình / Tham Lương', lat: 10.821594, lng: 106.625132 },
  // 5 Baseline Zones
  ZONE_01: { zoneId: 'ZONE_01', zoneName: 'Zone 1: Ga S1 Bến Thành (C&C)', lat: 10.770876, lng: 106.696946 },
  ZONE_02: { zoneId: 'ZONE_02', zoneName: 'Zone 2: Hầm TBM Bến Thành -> Tao Đàn (POR)', lat: 10.771500, lng: 106.694800 },
  ZONE_03: { zoneId: 'ZONE_03', zoneName: 'Zone 3: Ga S2 Tao Đàn (C&C)', lat: 10.773237, lng: 106.690138 },
  ZONE_04: { zoneId: 'ZONE_04', zoneName: 'Zone 4: Hầm TBM Tao Đàn -> Dân Chủ (POR)', lat: 10.774500, lng: 106.687500 },
  ZONE_08: { zoneId: 'ZONE_08', zoneName: 'Zone 8: Hầm TBM Hòa Hưng -> Lê Thị Riêng (POR)', lat: 10.784328, lng: 106.669262 },
  ZONE_09: { zoneId: 'ZONE_09', zoneName: 'Zone 9: Ga S5 Lê Thị Riêng (C&C)', lat: 10.786163, lng: 106.665623 },
};

/**
 * Tính khoảng cách (mét) giữa 2 tọa độ GPS theo công thức Haversine (Great-Circle Distance)
 */
export const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Bán kính Trái Đất (mét)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * Lấy tọa độ trọng tâm phân khu ga được giao đảm nhận
 */
export const getZoneCentroid = (zoneId?: string): MetroZoneCentroid => {
  if (zoneId) {
    const normalized = zoneId.trim().toUpperCase();
    if (METRO_ZONE_CENTROIDS[normalized]) {
      return METRO_ZONE_CENTROIDS[normalized];
    }
  }
  return METRO_ZONE_CENTROIDS.ZONE_09;
};

/**
 * Lấy chuỗi ngày chuẩn YYYY-MM-DD theo đúng múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7)
 * Ngăn chặn lỗi lệch ngày từ 00:00 -> 06:59 sáng khi dùng toISOString() (UTC)
 */
export const getVietnamDateString = (dateInput?: Date | string | number): string => {
  try {
    const d = dateInput !== undefined ? new Date(dateInput) : new Date();
    if (Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    }
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch (err: unknown) {
    console.error('[metroZoneUtils:getVietnamDateString] Error formatting date:', err);
    const fallback = new Date(Date.now() + 7 * 3600 * 1000);
    return fallback.toISOString().split('T')[0];
  }
};

/**
 * Chụp và nén khung hình video từ Camera thành chuỗi JPEG DataURL tối ưu (~60KB - 100KB)
 * Tránh tràn bộ nhớ RAM Mobile Safari và giảm tải băng thông 4G/5G
 */
export const captureVideoFrameAsJpeg = (
  video: HTMLVideoElement,
  maxWidth: number = 720,
  quality: number = 0.82
): string => {
  const rawWidth = video.videoWidth || 640;
  const rawHeight = video.videoHeight || 480;
  const scale = rawWidth > maxWidth ? maxWidth / rawWidth : 1;
  const targetWidth = Math.round(rawWidth * scale);
  const targetHeight = Math.round(rawHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL('image/jpeg', quality);
};

/**
 * Nén Blob ảnh chụp trực tiếp từ LiveCameraModal thành chuỗi JPEG DataURL tối ưu (~60KB - 100KB)
 */
export const compressBlobToJpegDataUrl = (
  blob: Blob,
  maxWidth: number = 720,
  quality: number = 0.85
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const rawWidth = img.naturalWidth || img.width || 640;
        const rawHeight = img.naturalHeight || img.height || 480;
        const scale = rawWidth > maxWidth ? maxWidth / rawWidth : 1;
        const targetWidth = Math.round(rawWidth * scale);
        const targetHeight = Math.round(rawHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof reader.result === 'string' ? reader.result : '');
          return;
        }
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
      img.src = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
};

export interface ResolvedAttendanceGps {
  lat: number;
  lng: number;
  accuracy: number;
  distanceMeters: number;
}

/**
 * Định vị GPS thực tế 100% từ phần cứng thiết bị (Tuyệt đối không dùng tọa độ giả lập / mock):
 * - Bước 1: Quét GPS vệ tinh độ chính xác cao (enableHighAccuracy: true, maximumAge: 0)
 * - Bước 2: Nếu thiết bị ở trong nhà/khuất vệ tinh bị TIMEOUT (code 3) hoặc POSITION_UNAVAILABLE (code 2),
 *   quét định vị phần cứng Wi-Fi / Trạm phát sóng thực tế của thiết bị (enableHighAccuracy: false, maximumAge: 0)
 * - Nếu người dùng chặn quyền (code 1) hoặc phần cứng tắt định vị hoàn toàn: Ném lỗi rõ ràng để yêu cầu bật GPS thật.
 */
export const resolveAttendanceGps = (
  activeZone: MetroZoneCentroid
): Promise<ResolvedAttendanceGps> => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(
      new Error('Trình duyệt hoặc thiết bị không hỗ trợ định vị GPS thực tế (Web Geolocation API).')
    );
  }

  const requestPosition = (
    options: PositionOptions
  ): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  return requestPosition({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  })
    .catch((firstErr: unknown) => {
      const geoErr = firstErr as { code?: number };
      // Nếu người dùng từ chối quyền vị trí (code === 1), báo lỗi ngay không cần thử lại
      if (geoErr?.code === 1) {
        throw firstErr;
      }
      // Nếu timeout (code 3) hoặc khuất vệ tinh (code 2), lấy vị trí phần cứng thực qua Wi-Fi/Cell
      return requestPosition({
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 0,
      });
    })
    .then((position) => {
      const lat = Number(position.coords.latitude.toFixed(6));
      const lng = Number(position.coords.longitude.toFixed(6));
      const accuracy = Math.max(1, Math.round(position.coords.accuracy || 10));
      const distanceMeters = calculateDistanceMeters(
        lat,
        lng,
        activeZone.lat,
        activeZone.lng
      );
      return {
        lat,
        lng,
        accuracy,
        distanceMeters,
      };
    })
    .catch((err: unknown) => {
      const geoErr = err as { code?: number; message?: string };
      console.error('[metroZoneUtils:resolveAttendanceGps] Real GPS acquisition failed:', {
        code: geoErr?.code,
        message: geoErr?.message,
      });
      if (geoErr?.code === 1) {
        throw new Error(
          'Thiết bị hoặc Trình duyệt đang chặn quyền truy cập Vị trí (GPS). Vui lòng mở Cài đặt Trình duyệt / Hệ điều hành (Location Services), cho phép quyền Vị trí rồi bấm "Lấy lại GPS".'
        );
      }
      if (geoErr?.code === 2) {
        throw new Error(
          'Không thu được tín hiệu định vị thực tế từ phần cứng thiết bị. Vui lòng kiểm tra đã bật GPS / Wi-Fi trên máy và thử lại.'
        );
      }
      if (geoErr?.code === 3) {
        throw new Error(
          'Quá thời gian chờ tín hiệu GPS thực tế từ thiết bị. Vui lòng di chuyển ra nơi thoáng hoặc bấm "Lấy lại GPS".'
        );
      }
      throw new Error(
        'Không thể lấy tọa độ GPS thực tế từ thiết bị. Vui lòng bật dịch vụ định vị và thử lại.'
      );
    });
};

/**
 * Phân giải đường dẫn ảnh Selfie điểm danh để hiển thị đúng trên cả Local Dev và Cloud Production
 */
export const resolveAttendancePhotoUrl = (url?: string | null): string => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/uploads/')) {
    const rawEnvUrl = (import.meta.env?.VITE_API_BASE_URL || '').trim();
    if (rawEnvUrl.startsWith('http://') || rawEnvUrl.startsWith('https://')) {
      try {
        const parsed = new URL(rawEnvUrl);
        return `${parsed.origin}${trimmed}`;
      } catch (err: unknown) {
        console.error('[metroZoneUtils:resolveAttendancePhotoUrl] Invalid VITE_API_BASE_URL:', err);
      }
    }
    return trimmed;
  }
  return trimmed;
};

/**
 * Định dạng thời lượng ca làm việc thực địa từ số phút (VD: 515 -> "8 giờ 35 phút")
 */
export const formatWorkDurationMinutes = (minutes?: number | null): string => {
  if (typeof minutes !== 'number' || Number.isNaN(minutes) || minutes <= 0) {
    return '—';
  }
  const rounded = Math.max(1, Math.round(minutes));
  const hrs = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hrs === 0) return `${mins} phút`;
  if (mins === 0) return `${hrs} giờ`;
  return `${hrs} giờ ${mins} phút`;
};
