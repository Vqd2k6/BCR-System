import type { FloorSurveyData } from '../types/phase1.types';

export const MIN_NO_ZONES_REASON_LENGTH = 10;

/** Miễn Z chỉ dành cho hạn chế tiếp cận; tầng trống vẫn tạo Vùng Z để kết luận được có khuyết tật hay không. */
export const NO_ZONES_REASON_PRESETS = [
  'Chủ nhà chỉ cho chụp tổng quan tầng, từ chối chụp chi tiết phòng',
  'Khu vực riêng tư, hạn chế tiếp cận chi tiết bên trong',
  'Cửa khóa / Không thể tiếp cận khảo sát chi tiết bên trong',
];

export const getZoneExemptFloors = (floors: FloorSurveyData[] | undefined): FloorSurveyData[] =>
  (floors || []).filter((floor) => floor.hasZones === false);

/** Bật miễn khi tầng còn Z thì Z bị ẩn nhưng vẫn lưu và vẫn in; KSV phải tự xóa để không mất dữ liệu ngoài ý muốn. */
export const hasFloorZoneData = (floor: FloorSurveyData): boolean =>
  (floor.zones?.length || 0) > 0 || (floor.cadZonePins?.length || 0) > 0;
