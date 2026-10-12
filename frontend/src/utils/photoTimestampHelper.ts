/**
 * TIỆN ÍCH TRÍCH XUẤT & ĐỊNH DẠNG THỜI GIAN CHỤP ẢNH METRO 2 (ZERO-TAMPERING)
 * Dự án: Tuyến Tàu điện ngầm số 2 TP.HCM (Bến Thành - Tham Lương)
 * 
 * Mục tiêu:
 * - Bảo toàn 100% thời gian thực lúc chụp ảnh ngoài hiện trường.
 * - Giải mã chuỗi 13 chữ số Unix Epoch (Date.now()) từ URL Cloud R2 hoặc IndexedDB URI.
 * - Triệt tiêu lỗi nhảy thời gian hiện tại (new Date()) khi tiếp tục ca khảo sát trên Laptop.
 */

/**
 * Định dạng ngày giờ chuẩn pháp lý Metro 2: DD/MM/YYYY HH:mm:ss
 */
export function formatMetro2Timestamp(ts?: Date | string | number): string {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return '';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Trích xuất thời điểm chụp từ URL ảnh hoặc URI nội bộ IndexedDB
 * Hỗ trợ các định dạng:
 * 1. IndexedDB local blob: blob:local://photo_1791823969988_abcde
 * 2. Cloudflare R2 / S3 standard: https://.../photo_1791823969988.jpg
 * 3. Tên file tự mô tả M2: M2__CC-05-B-0001__G__general__Z01__D01__CU__01__1791823969988.jpg
 * 4. Tên file vẽ chú thích: CU_01_1791823969988.jpg hoặc ...__CU_ANN__1791823969988.jpg
 */
export function extractTimestampFromPhotoUrl(url?: string): string | undefined {
  if (!url || typeof url !== 'string') return undefined;

  // Regex bắt cụm 13 chữ số Epoch Unix (năm 2017 đến 2049: 1500000000000 -> 2500000000000)
  // Bắt các tiền tố _, __, photo_ và các hậu tố _, ., hoặc cuối chuỗi
  const match = url.match(/(?:_|__|^photo_)(\d{13})(?:_|\.|$)/);
  if (match && match[1]) {
    const epoch = parseInt(match[1], 10);
    if (!isNaN(epoch) && epoch > 1500000000000 && epoch < 2500000000000) {
      return new Date(epoch).toISOString();
    }
  }

  return undefined;
}

/**
 * Phân giải thời gian chụp ảnh theo cơ chế đa tầng (Waterfall Resolution)
 * Tuyệt đối KHÔNG tự ý lấy new Date() đối với ảnh đã tồn tại.
 *
 * @param explicitTs Thời gian chỉ định rõ ràng từ state dữ liệu khảo sát (capturedAt / cuPhotoTimestamps)
 * @param photoUrl URL hoặc blob URI của ảnh để trích xuất epoch nếu explicitTs bị khuyết
 * @param fallbackDate Ngày khảo sát chung (surveyDate) nếu URL không chứa epoch
 * @returns Chuỗi định dạng chuẩn DD/MM/YYYY HH:mm:ss hoặc rỗng
 */
export function resolvePhotoTimestamp(
  explicitTs?: Date | string | number,
  photoUrl?: string,
  fallbackDate?: Date | string | number
): string {
  // 1. Ưu tiên cao nhất: Timestamp rõ ràng từ dữ liệu khảo sát
  if (explicitTs) {
    const formatted = formatMetro2Timestamp(explicitTs);
    if (formatted) return formatted;
  }

  // 2. Ưu tiên nhì: Trích xuất 13 số Epoch từ URL ảnh
  if (photoUrl) {
    const extractedIso = extractTimestampFromPhotoUrl(photoUrl);
    if (extractedIso) {
      const formatted = formatMetro2Timestamp(extractedIso);
      if (formatted) return formatted;
    }
  }

  // 3. Ưu tiên ba: Ngày khảo sát chung (surveyDate)
  if (fallbackDate) {
    const formatted = formatMetro2Timestamp(fallbackDate);
    if (formatted) return formatted;
  }

  // Nếu không có bất kỳ thông tin nào, trả về rỗng (KHÔNG BỊA new Date() HIỆN TẠI)
  return '';
}
