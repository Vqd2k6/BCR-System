export class GeoUtils {
  /**
   * Tính khoảng cách Haversine giữa 2 tọa độ GPS (kinh độ, vĩ độ) theo đơn vị mét
   */
  static calculateDistanceMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000; // Bán kính Trái Đất (m)
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  private static toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Chuyển mảng điểm [{x, y}] sang chuỗi PostGIS WKT Polygon
   */
  static pointsToWktPolygon(points: Array<{ x: number; y: number }>): string {
    if (points.length < 3) {
      throw new Error('Đa giác phải có ít nhất 3 điểm');
    }
    const closedPoints = [...points];
    // Đảm bảo đa giác khép kín điểm đầu và điểm cuối
    const first = points[0];
    const last = points[points.length - 1];
    if (first.x !== last.x || first.y !== last.y) {
      closedPoints.push(first);
    }

    const ring = closedPoints.map((p) => `${p.x} ${p.y}`).join(', ');
    return `POLYGON((${ring}))`;
  }
}
