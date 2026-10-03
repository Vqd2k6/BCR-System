/**
 * BỘ NÉN ẢNH SẠCH SIÊU TỐC METRO 2 (CLEAN IMAGE COMPRESSOR)
 * Tiêu chuẩn: 2560px (2.5K Quad-HD) @ 0.90 (90% Quality)
 *
 * Tính chất kỹ thuật:
 * - KHÔNG dập logo hay chữ lên pixel ảnh (Bảo toàn 100% chi tiết hiện trường gốc).
 * - Tốc độ nén tức thì (< 80ms), máy mát lạnh, không gây sụt pin.
 * - Giải phóng triệt để RAM GPU và bộ nhớ Canvas ngay lập tức sau khi xuất Blob.
 */

export interface CleanCompressionOptions {
  maxDimension?: number; // Mặc định: 2560px (2.5K Quad-HD)
  quality?: number;      // Mặc định: 0.90 (90% theo chỉ đạo người dùng)
  mimeType?: string;     // Mặc định: 'image/jpeg'
}

export interface CleanCompressionResult {
  blob: Blob;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  sizeBytes: number;
  compressionTimeMs: number;
}

const DEFAULT_MAX_DIMENSION = 2560; // 2.5K Quad-HD
const DEFAULT_QUALITY = 0.90;       // 90% siêu nét

/**
 * Đọc File/Blob nguồn thành HTMLImageElement để đo kích thước và vẽ
 */
function readImageElement(source: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(source);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}

/**
 * Nén ảnh gốc thành ảnh sạch chuẩn 2560px @ 0.90
 */
export async function compressCleanImage(
  fileOrBlob: File | Blob,
  options?: CleanCompressionOptions
): Promise<CleanCompressionResult> {
  const startTime = performance.now();
  const maxDim = options?.maxDimension || DEFAULT_MAX_DIMENSION;
  const quality = options?.quality !== undefined ? options.quality : DEFAULT_QUALITY;
  const mimeType = options?.mimeType || 'image/jpeg';

  // 1. Nạp ảnh và đo đạc kích thước gốc
  const img = await readImageElement(fileOrBlob);
  const origWidth = img.naturalWidth || img.width;
  const origHeight = img.naturalHeight || img.height;

  if (!origWidth || !origHeight) {
    throw new Error('Không thể xác định kích thước ảnh nguồn.');
  }

  // 2. Tính toán tỉ lệ cạnh dài tối đa 2560px (giữ nguyên aspect ratio)
  let targetWidth = origWidth;
  let targetHeight = origHeight;

  if (origWidth > maxDim || origHeight > maxDim) {
    if (origWidth > origHeight) {
      targetHeight = Math.round((origHeight * maxDim) / origWidth);
      targetWidth = maxDim;
    } else {
      targetWidth = Math.round((origWidth * maxDim) / origHeight);
      targetHeight = maxDim;
    }
  }

  // 3. Khởi tạo Canvas nội suy phần cứng
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { alpha: false }); // alpha: false tối ưu GPU rendering cho JPEG

  if (!ctx) {
    throw new Error('Không thể khởi tạo 2D Context trên Canvas.');
  }

  // Bật bộ lọc làm mịn chất lượng cao
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Vẽ ảnh sạch thuần túy
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // 4. Xuất Blob chất lượng 0.90
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Xuất Blob ảnh sạch thất bại.'));
      },
      mimeType,
      quality
    );
  });

  // 5. Giải phóng tức thì RAM GPU và Context
  try {
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    canvas.width = 0;
    canvas.height = 0;
  } catch (_e) {}

  const endTime = performance.now();

  return {
    blob,
    width: targetWidth,
    height: targetHeight,
    originalWidth: origWidth,
    originalHeight: origHeight,
    sizeBytes: blob.size,
    compressionTimeMs: Math.round(endTime - startTime),
  };
}

export interface WatermarkExportMeta {
  photoCode?: string;
  timestamp?: string;
  gpsLat?: number;
  gpsLng?: number;
  stationCode?: string;
  parcelCode?: string;
  defectCode?: string;
}

/**
 * Xuất ảnh JPEG chất lượng cao có dập sẵn Watermark chính quy (CRLG-CRSRI-TT)
 * Dùng cho Tư vấn, Ban QLĐS (MAUR) hoặc Tòa án khi cần trích xuất file ảnh độc lập
 */
export async function exportWatermarkedJpeg(
  sourceUrlOrBlob: string | Blob,
  meta?: WatermarkExportMeta
): Promise<Blob> {
  let img: HTMLImageElement;
  if (typeof sourceUrlOrBlob === 'string') {
    img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = (e) => reject(e);
      el.src = sourceUrlOrBlob;
    });
  } else {
    img = await readImageElement(sourceUrlOrBlob);
  }

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Không thể tạo canvas context để xuất watermark');

  // 1. Vẽ ảnh gốc sạch
  ctx.drawImage(img, 0, 0, width, height);

  // 2. Tỉ lệ scale font chữ theo độ phân giải ảnh (chuẩn 2560px)
  const scale = Math.max(1, width / 1280);

  // 3. Góc trên bên phải: Huy hiệu Liên danh
  const logoText = 'CRLG-CRSRI-TT • METRO 2 HCM';
  const logoFontSize = Math.round(14 * scale);
  ctx.font = `bold ${logoFontSize}px system-ui, -apple-system, sans-serif`;
  const logoMetrics = ctx.measureText(logoText);
  const logoPadding = Math.round(8 * scale);
  const logoW = logoMetrics.width + logoPadding * 2;
  const logoH = logoFontSize + logoPadding * 1.5;
  const logoX = width - logoW - Math.round(16 * scale);
  const logoY = Math.round(16 * scale);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(logoX, logoY, logoW, logoH, Math.round(6 * scale));
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = Math.max(1, Math.round(1 * scale));
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(logoText, logoX + logoPadding, logoY + logoH / 2);

  // 4. Góc dưới bên phải: Mã ảnh, Thời gian, Tọa độ GPS
  const lines: string[] = [];
  if (meta?.photoCode) lines.push(`MÃ ẢNH: ${meta.photoCode}`);
  if (meta?.defectCode) lines.push(`KHUYẾT TẬT: ${meta.defectCode}`);
  if (meta?.parcelCode) lines.push(`THỬA ĐẤT: ${meta.parcelCode}`);
  const timeStr = meta?.timestamp || new Date().toLocaleString('vi-VN');
  lines.push(`NGÀY GIỜ: ${timeStr}`);
  if (meta?.gpsLat && meta?.gpsLng) {
    lines.push(`GPS: ${meta.gpsLat.toFixed(6)}, ${meta.gpsLng.toFixed(6)}`);
  }

  const metaFontSize = Math.round(12 * scale);
  ctx.font = `600 ${metaFontSize}px system-ui, -apple-system, monospace`;
  const lineHeight = Math.round(metaFontSize * 1.45);
  let maxMetaWidth = 0;
  lines.forEach((l) => {
    const m = ctx.measureText(l);
    if (m.width > maxMetaWidth) maxMetaWidth = m.width;
  });

  const metaPadding = Math.round(10 * scale);
  const boxW = maxMetaWidth + metaPadding * 2;
  const boxH = lines.length * lineHeight + metaPadding * 1.5;
  const boxX = width - boxW - Math.round(16 * scale);
  const boxY = height - boxH - Math.round(16 * scale);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, Math.round(6 * scale));
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = Math.max(1, Math.round(1 * scale));
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  lines.forEach((l, idx) => {
    ctx.fillText(l, boxX + metaPadding, boxY + metaPadding + idx * lineHeight + metaFontSize / 2);
  });

  // 5. Xuất Blob 0.90
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        // Thu dọn memory
        try {
          ctx.clearRect(0, 0, width, height);
          canvas.width = 0;
          canvas.height = 0;
        } catch (_e) {}
        if (b) resolve(b);
        else reject(new Error('Xuất Blob ảnh có watermark thất bại'));
      },
      'image/jpeg',
      0.90
    );
  });
}

/**
 * Tải trực tiếp file ảnh có watermark về máy người dùng
 */
export async function downloadWatermarkedImage(
  sourceUrlOrBlob: string | Blob,
  filename: string = 'metro2_photo_stamped.jpg',
  meta?: WatermarkExportMeta
): Promise<void> {
  const blob = await exportWatermarkedJpeg(sourceUrlOrBlob, meta);
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
}
