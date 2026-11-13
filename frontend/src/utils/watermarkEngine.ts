/**
 * BỘ TIỆN ÍCH ĐỊNH DANH ẢNH PHÁP LÝ DỰ ÁN METRO 2 (mã ảnh, mã tầng, cấu hình nén)
 * Client KHÔNG dập watermark vào pixel (CLAUDE.md §3.3): máy chủ dập khi xuất report.
 * Hàm dập canvas cũ applyMetroWatermark đã xoá 13/11/2026 để không bị gọi lại nhầm.
 * Tuân thủ tiêu chuẩn: METRO2-BCS-PHOTO-STD-2026
 * Đơn vị áp dụng: Ban QLDA MAUR - Liên danh THACO-CREC - CRLG-CRSRI-TT
 */

export type MetroFloorType =
  | 'B01'
  | 'B02'
  | 'B03'
  | 'SB' // Bán hầm
  | 'F00' // Tầng trệt
  | 'MEZZ' // Tầng lửng
  | 'F01'
  | 'F02'
  | 'F03'
  | 'F04'
  | 'F05'
  | 'TUM' // Tầng tum
  | 'TERRACE' // Sân thượng
  | 'ROOF' // Mái
  | 'FOUND' // Móng / đà kiềng
  | 'EXT' // Ngoại thất ngoài nhà
  | 'DOC' // Hồ sơ, tài liệu, biên bản pháp lý
  | string
  | number;

export type MetroPhotoType =
  | 'P01'
  | 'P02'
  | 'P03'
  | 'P04'
  | 'SETTLE' // Lún chênh Bước 1 (1.6.1)
  | 'TILT' // Đo nghiêng Bước 1 (1.6.2)
  | 'ANOMALY' // Bất thường ngoại lệ (1.6.3)
  | 'CONSTRUCT' // Hiện trạng đang thi công
  | 'VACANT' // Hiện trạng đất trống
  | 'OVERVIEW' // Toàn cảnh sàn tầng
  | 'CAD_ARCH' // Sơ đồ CAD kiến trúc
  | 'CAD_STRUCT' // Sơ đồ CAD kết cấu
  | 'CTX' // Bối cảnh mảng tường nứt
  | 'CU' // Cận cảnh nứt có thước đo
  | 'SAGGING' // Võng dầm sàn
  | 'DRAWING' // Bản vẽ hoàn công / kết cấu
  | 'HOANCONG' // Hồ sơ hoàn công
  | 'KETCAU' // Bản vẽ kết cấu
  | 'SOHONG' // Sổ hồng / GCN
  | 'GPXD' // Giấy phép xây dựng
  | 'ABSENTEE' // Biên bản vắng nhà
  | 'MINUTES' // Biên bản hiện trường 3 bên
  | 'SIG_SURVEYOR' // Chữ ký KSV
  | 'SIG_OWNER' // Chữ ký chủ hộ
  | 'EXTRA' // Ảnh bổ sung phát sinh
  | string;

export interface MetroWatermarkOptions {
  prefix?: string; // Mặc định: 'HCM_M2'
  stationCode?: string; // Ví dụ: 'ST02'
  parcelCode?: string; // Ví dụ: 'C&C-01-B-0001' hoặc 'B-0001'
  buildingCode?: string; // Ví dụ: 'CC-05-B-0001'
  floorCode?: string; // Mã tầng chính thức theo thiết lập CAD (B03, B01, SB, G, MEZZ, F01-F99, TECH, REF, ROOF...)
  floor?: MetroFloorType; // Tên tầng hiển thị hoặc mã tầng
  unitCode?: string; // Mã căn hộ hoặc khu vực dùng chung (ví dụ: 'TG.01', 'TB01.01', '08.01')
  areaType?: 'MASTER_AREA' | 'CONDO_UNIT' | 'PRIVATE_HOUSE' | 'GENERAL_TOWER' | 'CAD_BLUEPRINT'; // Phân loại khảo sát
  category?: string; // Phân mục lưu trữ cụ thể (settlement, tilt, anomalies, exterior, etc.)
  zoneOrRoom?: string; // Ví dụ: 'Z-01', 'E-01', 'HOANCONG', 'ABSENTEE'
  defectCode?: string; // Ví dụ: 'D-01'
  photoType?: MetroPhotoType; // Ví dụ: 'CU', 'CTX', 'SETTLE', 'TILT', 'MINUTES'
  photoIndex?: number; // Ví dụ: 1 -> '_01', 2 -> '_02'
  customCode?: string; // Chuỗi mã chỉ định trực tiếp (nếu có)
  timestamp?: Date; // Mặc định: new Date()
  logoUrl?: string; // Mặc định: '/Logo_Thaco_Crec.png'
  maxDimension?: number; // Cạnh dài tối đa (px) - Tự động chọn theo Golden Ratio nếu không truyền
  quality?: number; // Mức chất lượng JPEG (0.1 - 1.0) - Tự động chọn theo Golden Ratio nếu không truyền
  generateDataUrl?: boolean; // Có sinh chuỗi Base64 dataUrl không (mặc định: true để tương thích ngược)
  // Tọa độ định danh địa lý
  gpsLat?: number; // Vĩ độ GPS thực tế từ thiết bị di động
  gpsLng?: number; // Kinh độ GPS thực tế từ thiết bị di động
  gpsAccuracy?: number; // Sai số GPS (mét)
  gisLat?: number; // Vĩ độ tâm thửa đất quy hoạch GIS
  gisLng?: number; // Kinh độ tâm thửa đất quy hoạch GIS
}

export interface GoldenRatioConfig {
  maxDimension: number;
  quality: number;
  category: string;
}

/**
 * CẤU HÌNH NÉN ẢNH DI ĐỘNG CHUẨN PHÁP LÝ METRO 2 (LỰA CHỌN B - PHÊ DUYỆT):
 * 1. Điểm danh GPS selfie (ATTENDANCE / SELFIE / CHECKIN): Cạnh dài 1280px (HD), Quality 0.75 (~140KB)
 * 2. Tất cả ảnh hiện trường (Cận cảnh đo nứt/lún CU, Bối cảnh CTX, Toàn cảnh OVERVIEW, Pháp lý DOC, P01-P04):
 *    Cạnh dài tối đa 2048px (2K), Quality 0.80 (80%)
 *    -> Giảm ~91% dung lượng (từ 8.4MB xuống ~750KB - 780KB)
 *    -> Bảo toàn độ sắc nét vạch chia mm của thước đo khi zoom 400%
 *    -> Tiết kiệm pin, triệt tiêu nóng máy và giải phóng bộ nhớ RAM Canvas
 */
export function resolveGoldenRatioConfig(photoType?: MetroPhotoType): GoldenRatioConfig {
  const typeStr = String(photoType || '').toUpperCase();

  // Nhóm 1: Điểm danh GPS selfie (Tối ưu data mạng di động)
  if (['ATTENDANCE', 'SELFIE', 'CHECKIN'].includes(typeStr)) {
    return {
      maxDimension: 1280, // HD (0.9 MP)
      quality: 0.75,      // Tối ưu mạng 4G hiện trường (~140KB)
      category: 'ATTENDANCE_SELFIE',
    };
  }

  // Tiêu chuẩn 2K Quad-HD (Lựa chọn B - Phê duyệt):
  // Cạnh dài tối đa 2048px, chất lượng JPEG 0.80 (80%)
  return {
    maxDimension: 2048,   // 2K Chuẩn (2048px)
    quality: 0.80,        // Chuẩn nén 80%
    category: 'STANDARD_2K_Q80',
  };
}

/**
 * Chuẩn hóa tên tầng tiếng Việt sang mã tầng tiêu chuẩn Metro 2
 * Ví dụ: "Tầng 1 (Trệt)" -> "F00", "Tầng 1 (Lầu 1)" -> "F01", "Tầng 2" -> "F02", "Mái" -> "ROOF"
 */
export function normalizeMetroFloorCode(floor?: MetroFloorType): string {
  if (floor === undefined || floor === null || floor === '') return '';
  if (typeof floor === 'number') {
    if (floor === 0.5) return 'MEZZ';
    if (floor === -0.5) return 'SB';
    if (floor < 0) return `B${String(Math.abs(Math.round(floor))).padStart(2, '0')}`;
    const fNum = Math.floor(floor);
    return fNum === 0 ? 'F00' : `F${String(fNum).padStart(2, '0')}`;
  }
  const str = String(floor).trim();
  const upper = str.toUpperCase();

  // Số thực dạng chuỗi (0.5 -> MEZZ, -0.5 -> SB)
  if (upper === '0.5' || upper === 'MEZZ' || upper.includes('LỬNG') || upper.includes('MEZZANINE')) {
    return 'MEZZ';
  }
  if (upper === '-0.5' || upper === 'SB' || upper.includes('BÁN HẦM')) {
    return 'SB';
  }

  // Các token đặc biệt
  if (['DOC', 'EXT', 'FOUND', 'ROOF', 'TERRACE', 'TUM'].includes(upper)) {
    return upper;
  }
  if (/^B\d+$/i.test(upper)) return upper;
  if (/^F\d+$/i.test(upper)) return upper;
  if (/^\d+$/.test(upper)) {
    const n = parseInt(upper, 10);
    return n === 0 ? 'F00' : `F${String(n).padStart(2, '0')}`;
  }

  // Nhận diện theo chuỗi tiếng Việt thực tế trong hệ thống
  if (upper.includes('TRỆT') || upper.includes('TẦNG 1 (TRỆT)')) return 'F00';
  if (upper.includes('LỬNG') || upper.includes('MEZZANINE')) return 'MEZZ';
  if (upper.includes('BÁN HẦM')) return 'SB';
  if (upper.includes('HẦM 1')) return 'B01';
  if (upper.includes('HẦM 2')) return 'B02';
  if (upper.includes('HẦM 3')) return 'B03';
  if (upper.includes('SÂN THƯỢNG') || upper.includes('TERRACE')) return 'TERRACE';
  if (upper.includes('MÁI') || upper.includes('ROOF')) return 'ROOF';
  if (upper.includes('TUM') || upper.includes('ATTIC')) return 'TUM';
  if (upper.includes('MÓNG') || upper.includes('ĐÀ KIỀNG')) return 'FOUND';
  if (upper.includes('NGOẠI THẤT') || upper.includes('NGOÀI NHÀ')) return 'EXT';
  if (upper.includes('HỒ SƠ') || upper.includes('PHÁP LÝ') || upper.includes('BIÊN BẢN')) return 'DOC';

  // "Tầng 1 (Lầu 1)" -> F01, "Tầng 2" -> F02, "Lầu 3" -> F03
  const matchNum = upper.match(/TẦNG\s*(\d+)/i) || upper.match(/LẦU\s*(\d+)/i);
  if (matchNum) {
    const n = parseInt(matchNum[1], 10);
    return `F${String(n).padStart(2, '0')}`;
  }

  return upper.replace(/[^A-Z0-9_-]/g, '');
}

/**
 * Định dạng ngày giờ chuẩn tiếng Việt hiển thị trên ảnh
 * Ví dụ: "28 thg 9, 2026 14:45:20" (khớp với ảnh thực địa mẫu)
 */
export function formatMetroTimestamp(date: Date = new Date()): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${d} thg ${m}, ${y} ${hh}:${mm}:${ss}`;
}

/**
 * Sinh mã định danh chuẩn hóa duy nhất (Photo ID / photoCode)
 * Cú pháp: HCM_M2.[PARCEL]_[FLOOR]_[ZONE]_[DEFECT]_[TYPE]_[INDEX]
 */
export function generateMetroPhotoCode(opts: MetroWatermarkOptions): string {
  if (opts.customCode) {
    return opts.customCode.trim().toUpperCase();
  }

  const prefix = (opts.prefix || 'HCM_M2').toUpperCase();
  const parts: string[] = [];

  // 1. Mã công trình / Thửa đất (Bảo toàn dấu -, & và chuẩn hóa dạng [MÃ])
  if (opts.parcelCode) {
    const rawParcel = opts.parcelCode.trim().replace(/^\[|\]$/g, '');
    const cleanParcel = rawParcel.replace(/[^a-zA-Z0-9&_-]/g, '').toUpperCase();
    if (opts.stationCode) {
      const cleanStation = opts.stationCode.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
      parts.push(`[${cleanStation}-${cleanParcel}]`);
    } else {
      parts.push(`[${cleanParcel}]`);
    }
  }

  // 2. Vị trí tầng hoặc mã căn hộ con (F00, MEZZ, MEZZ.01, U-001, TB01.01...)
  const normFloor = (opts.floor !== undefined && opts.floor !== null && opts.floor !== '')
    ? normalizeMetroFloorCode(opts.floor)
    : '';

  if (opts.unitCode) {
    const cleanUnit = opts.unitCode.trim().replace(/[^a-zA-Z0-9&_.-]/g, '').toUpperCase();
    if (cleanUnit) {
      // Phương án B: Chuẩn hóa không lặp mã [MÃ_THỬA]_[MÃ_TẦNG]_[STT]
      // Nếu unitCode dạng [MÃ_TẦNG].[STT] (ví dụ: '02.03', 'MEZZ.01', 'B01.01', 'G.02')
      const dotParts = cleanUnit.split('.');
      if (dotParts.length > 1) {
        const floorPart = dotParts[0];
        const sttPart = dotParts.slice(1).join('.');
        const resolvedFloor = normFloor || normalizeMetroFloorCode(floorPart);
        // Khúc giữa là mã tầng, khúc đuôi chỉ là STT (ví dụ: F02_03, MEZZ_01, B01_M01)
        parts.push(`${resolvedFloor}_${sttPart}`);
      } else if (/^[UM][-_]\d+$/i.test(cleanUnit) && normFloor && !cleanUnit.startsWith(normFloor)) {
        // Hỗ trợ dạng cũ U-001 / M-001: kết hợp F02_U001
        parts.push(`${normFloor}_${cleanUnit.replace('-', '')}`);
      } else {
        parts.push(cleanUnit);
      }
    }
  } else if (normFloor) {
    parts.push(normFloor);
  }

  // 3. Vùng hư hỏng / Cấu kiện / Nhóm hồ sơ (Z-01, E-01, HOANCONG, ABSENTEE...)
  if (opts.zoneOrRoom) {
    parts.push(opts.zoneOrRoom.trim().replace(/[^a-zA-Z0-9&_-]/g, '').toUpperCase());
  }

  // 4. Mã khuyết tật (D-01, D-02...)
  if (opts.defectCode) {
    parts.push(opts.defectCode.trim().replace(/[^a-zA-Z0-9&_-]/g, '').toUpperCase());
  }

  // 5. Loại ảnh (P01-P04, SETTLE, TILT, CTX, CU, OVERVIEW, DRAWING, MINUTES...)
  if (opts.photoType) {
    parts.push(opts.photoType.trim().replace(/[^a-zA-Z0-9&_-]/g, '').toUpperCase());
  }

  // 6. Số thứ tự ảnh cùng vị trí chụp nhiều góc (_01, _02...)
  const index = opts.photoIndex !== undefined && opts.photoIndex > 0 ? opts.photoIndex : 1;
  parts.push(String(index).padStart(2, '0'));

  if (parts.length === 0) {
    return `${prefix}.SURVEY_01`;
  }

  return `${prefix}.${parts.join('_')}`;
}

