/**
 * Lọc cập nhật GPS liên tục (watchPosition) để không render lại toàn ứng dụng mỗi giây.
 * Mỗi lần render lại kéo theo effect con gọi API: trên Android ngoài trời đã từng gây tải lặp hàng GB/giờ.
 */

export interface GpsFix {
  lat: number;
  lng: number;
  accuracy?: number;
}

export const GPS_MIN_MOVE_METERS = 5;
export const GPS_MIN_ACCURACY_GAIN_METERS = 5;
export const GPS_MAX_SILENCE_MS = 15_000;

/** Khoảng cách cầu (Haversine) giữa 2 điểm WGS84, tính bằng mét */
export function distanceMeters(a: GpsFix, b: GpsFix): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Có cần đẩy tọa độ mới vào state không:
 * - chưa có tọa độ; hoặc di chuyển > 5 m; hoặc độ chính xác tốt lên > 5 m; hoặc đã im > 15 s.
 */
export function shouldPublishGps(prev: GpsFix | null, next: GpsFix, lastPublishedAt: number, now: number): boolean {
  if (!prev) return true;
  if (distanceMeters(prev, next) > GPS_MIN_MOVE_METERS) return true;
  if (prev.accuracy !== undefined && next.accuracy !== undefined && prev.accuracy - next.accuracy > GPS_MIN_ACCURACY_GAIN_METERS) {
    return true;
  }
  return now - lastPublishedAt >= GPS_MAX_SILENCE_MS;
}
