/**
 * BỘ TIỆN ÍCH DẬP WATERMARK & ĐỊNH DANH ẢNH PHÁP LÝ DỰ ÁN METRO 2
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
  floor?: MetroFloorType; // Ví dụ: 'Tầng 1 (Trệt)' -> 'F00', 'Tầng 2' -> 'F02', 'DOC', 'EXT', 'FOUND'
  zoneOrRoom?: string; // Ví dụ: 'Z-01', 'E-01', 'HOANCONG', 'ABSENTEE'
  defectCode?: string; // Ví dụ: 'D-01'
  photoType?: MetroPhotoType; // Ví dụ: 'CU', 'CTX', 'SETTLE', 'TILT', 'MINUTES'
  photoIndex?: number; // Ví dụ: 1 -> '_01', 2 -> '_02'
  customCode?: string; // Chuỗi mã chỉ định trực tiếp (nếu có)
  timestamp?: Date; // Mặc định: new Date()
  logoUrl?: string; // Mặc định: '/Logo_Thaco_Crec.png'
}

/**
 * Chuẩn hóa tên tầng tiếng Việt sang mã tầng tiêu chuẩn Metro 2
 * Ví dụ: "Tầng 1 (Trệt)" -> "F00", "Tầng 1 (Lầu 1)" -> "F01", "Tầng 2" -> "F02", "Mái" -> "ROOF"
 */
export function normalizeMetroFloorCode(floor?: MetroFloorType): string {
  if (floor === undefined || floor === null || floor === '') return '';
  if (typeof floor === 'number') {
    const fNum = Math.floor(floor);
    return fNum === 0 ? 'F00' : `F${String(fNum).padStart(2, '0')}`;
  }
  const str = String(floor).trim();
  const upper = str.toUpperCase();

  // Các token đặc biệt
  if (['DOC', 'EXT', 'FOUND', 'ROOF', 'TERRACE', 'TUM', 'MEZZ', 'SB'].includes(upper)) {
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

  // 2. Vị trí tầng (F00, F01, MEZZ, FOUND, EXT, DOC...)
  if (opts.floor !== undefined && opts.floor !== null && opts.floor !== '') {
    const normFloor = normalizeMetroFloorCode(opts.floor);
    if (normFloor) {
      parts.push(normFloor);
    }
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

import { LOGO_THACO_CREC_BASE64 } from '../assets/logoThacoCrecBase64';

// Bộ nhớ đệm Image object của Logo để không phải nạp lại nhiều lần
let cachedLogoImg: HTMLImageElement | null = null;
let cachedLogoPromise: Promise<HTMLImageElement> | null = null;

function loadSingleImage(src: string, useCors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (useCors && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve(img);
      } else {
        reject(new Error('Kích thước ảnh nạp vào bằng 0.'));
      }
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Nạp Logo THACO - CREC đảm bảo độ tin cậy 100%:
 * 1. Mặc định sử dụng Base64 Data URL nhúng sẵn (không phụ thuộc mạng, không bao giờ bị CORS, không bị 404).
 * 2. Nếu người dùng chỉ định custom URL, thử nạp URL đó; nếu thất bại thì tự động fallback về Base64.
 */
function loadLogo(customUrl?: string): Promise<HTMLImageElement> {
  if (cachedLogoImg && cachedLogoImg.complete && cachedLogoImg.naturalWidth > 0) {
    return Promise.resolve(cachedLogoImg);
  }
  if (cachedLogoPromise) {
    return cachedLogoPromise;
  }

  const defaultSource = LOGO_THACO_CREC_BASE64;
  const targetUrl = customUrl && customUrl !== '/Logo_Thaco_Crec.png' ? customUrl : defaultSource;

  cachedLogoPromise = (async () => {
    try {
      // Thử nạp nguồn mục tiêu (ưu tiên base64 hoặc custom URL không CORS)
      const img = await loadSingleImage(targetUrl, false);
      cachedLogoImg = img;
      return img;
    } catch (firstErr) {
      console.warn('[WATERMARK] Không nạp được logo với chế độ no-cors, thử nạp lại:', firstErr);
      try {
        // Thử lại với CORS nếu là remote URL
        if (!targetUrl.startsWith('data:')) {
          const imgCors = await loadSingleImage(targetUrl, true);
          cachedLogoImg = imgCors;
          return imgCors;
        }
      } catch (corsErr) {
        console.warn('[WATERMARK] Thử CORS cũng thất bại:', corsErr);
      }

      // Fallback tuyệt đối: Dùng chuỗi Base64 Data URL tích hợp sẵn
      try {
        const fallbackImg = await loadSingleImage(LOGO_THACO_CREC_BASE64, false);
        cachedLogoImg = fallbackImg;
        return fallbackImg;
      } catch (fallbackErr) {
        cachedLogoPromise = null; // Reset để không kẹt cache
        throw fallbackErr;
      }
    }
  })();

  return cachedLogoPromise;
}

/**
 * Đọc nguồn ảnh thành HTMLImageElement
 */
function loadImageSource(source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | string): Promise<{
  element: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    if (typeof source === 'string') {
      const img = new Image();
      // Chỉ đặt crossOrigin nếu là remote URL (không phải base64 data URL)
      if (!source.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        resolve({
          element: img,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = reject;
      img.src = source;
    } else if (source instanceof HTMLVideoElement) {
      resolve({
        element: source,
        width: source.videoWidth || 1280,
        height: source.videoHeight || 720,
      });
    } else if (source instanceof HTMLCanvasElement) {
      resolve({
        element: source,
        width: source.width,
        height: source.height,
      });
    } else {
      resolve({
        element: source,
        width: source.naturalWidth,
        height: source.naturalHeight,
      });
    }
  });
}

export interface WatermarkResult {
  dataUrl: string;
  blob?: Blob;
  photoCode: string;
}

/**
 * Hàm cốt lõi: Dập Watermark Logo THACO-CREC và Photo ID vào ảnh trên Canvas
 * Trả về Data URL JPEG, Binary Blob và Photo ID chuẩn hóa
 */
export async function applyMetroWatermark(
  imageSource: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | string,
  options?: MetroWatermarkOptions
): Promise<WatermarkResult> {
  const photoCode = generateMetroPhotoCode(options || {});
  const timeStr = formatMetroTimestamp(options?.timestamp || new Date());

  // 1. Nạp nguồn ảnh
  const src = await loadImageSource(imageSource);
  if (!src.width || !src.height) {
    throw new Error('Nguồn ảnh không hợp lệ để dập watermark.');
  }

  // 2. Chuẩn hóa kích thước khung hình (giữ độ nét tối đa 4K / 4096px, lưu trữ Cloudflare R2 không nén vỡ nét)
  const maxDim = 4096;
  let width = src.width;
  let height = src.height;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không thể khởi tạo 2D Context trên Canvas.');
  }

  // 3. Vẽ ảnh gốc
  ctx.drawImage(src.element, 0, 0, width, height);

  // Lấy kích thước ảnh dọc làm quy chuẩn cơ sở:
  // Cạnh ngắn nhất luôn tương đương với bề rộng của ảnh dọc khi chụp cùng độ phân giải
  const basePortraitWidth = Math.min(width, height);

  // 4. Vẽ Logo THACO-CREC ở góc trên bên phải
  // Quy chuẩn: Lấy ảnh dọc làm chuẩn (chiếm 43.75% chiều rộng ảnh dọc)
  // Ảnh ngang có kích thước logo bằng đúng ảnh dọc (không phóng to theo cạnh dài)
  try {
    const logoImg = await loadLogo(options?.logoUrl);
    if (logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0) {
      const logoWidth = Math.round(basePortraitWidth * 0.4375);
      const logoHeight = Math.round(logoWidth * (logoImg.naturalHeight / logoImg.naturalWidth));
      const paddingRight = Math.round(basePortraitWidth * 0.025);
      const paddingTop = Math.round(basePortraitWidth * 0.025);
      const logoX = width - logoWidth - paddingRight;
      const logoY = paddingTop;

      ctx.save();
      // Đổ bóng mờ trắng nhẹ phía sau để logo xanh luôn sắc nét ngay cả khi chụp nền tối/vỉa hè/đêm
      ctx.shadowColor = 'rgba(255, 255, 255, 0.75)';
      ctx.shadowBlur = Math.max(3, Math.round(basePortraitWidth * 0.007));
      ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
      ctx.restore();
    }
  } catch (logoErr) {
    console.error('[WATERMARK] Lỗi nghiêm trọng khi nạp logo THACO-CREC:', logoErr);
  }

  // 5. Vẽ Ngày giờ + Mã định danh Photo ID ở góc dưới bên phải
  // Lấy ảnh dọc làm chuẩn (3.1% chiều rộng ảnh dọc)
  const fontSize = Math.max(22, Math.round(basePortraitWidth * 0.031));
  const lineHeight = Math.round(fontSize * 1.35);
  const paddingRight = Math.round(basePortraitWidth * 0.03);
  const paddingBottom = Math.round(basePortraitWidth * 0.035);

  const textX = width - paddingRight;
  const line2Y = height - paddingBottom;
  const line1Y = line2Y - lineHeight;

  ctx.save();
  ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';

  // Hiệu ứng đổ bóng mờ đen (Shadow)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = Math.round(fontSize * 0.28);
  ctx.shadowOffsetX = Math.max(1.5, Math.round(fontSize * 0.05));
  ctx.shadowOffsetY = Math.max(2, Math.round(fontSize * 0.08));

  // Viền nét mảnh đen (Stroke) chống chìm chữ trên nền đường/vỉa hè sáng
  ctx.lineWidth = Math.max(2, fontSize * 0.07);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeText(timeStr, textX, line1Y);
  ctx.strokeText(photoCode, textX, line2Y);

  // Phủ lớp chữ màu trắng tinh (#FFFFFF)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(timeStr, textX, line1Y);
  ctx.fillText(photoCode, textX, line2Y);
  ctx.restore();

  // 6. Xuất Binary Blob và Data URL JPEG độ nét tối đa 100% (quality = 1.0 - Zero Compression loss) cho Cloudflare R2
  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 1.0);
  });
  const dataUrl = canvas.toDataURL('image/jpeg', 1.0);

  return {
    dataUrl,
    blob,
    photoCode,
  };
}
