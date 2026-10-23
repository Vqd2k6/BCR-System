/**
 * TIỆN ÍCH CHUẨN HÓA & XỬ LÝ ẢNH METRO 2 (CLIENT-SIDE)
 * Dự án: Tuyến Metro số 2 TP.HCM (CRLG-CRSRI-TT)
 * 
 * - Nén ảnh tối ưu (giữ nguyên độ phân giải scale card / vết nứt, tối đa 2560px, JPEG 0.90)
 * - Tính toán mã băm SHA-256 bất biến (Tamper-Proof) qua Web Crypto API
 * - Sinh tên file tự mô tả chuẩn M2__...jpg
 * - Sinh mã định danh pháp lý chuẩn HCM_M2...
 */

import { api } from '../services/api';

export interface ProcessedPhotoResult {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
  sha256Hash: string;
  sizeBytes: number;
  standardizedFilename: string;
  photoCode: string;
}

/**
 * Tính mã SHA-256 của file nhị phân qua Web Crypto API
 */
export async function calculateBrowserSha256(file: File | Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Nén và chuẩn hóa ảnh: giới hạn cạnh dài nhất <= maxDimension (mặc định 2560px),
 * chuyển định dạng sang image/jpeg với chất lượng 0.90 (đủ nét đọc thước đo khe nứt Burland)
 */
export async function compressAndStandardizePhoto(
  file: File,
  namingParams: {
    buildingOrParcelCode: string;
    floorCode?: string;
    zoneCode?: string;
    defectCode?: string;
    photoType: string;
    index?: number;
  },
  maxDimension: number = 2560,
  quality: number = 0.90
): Promise<ProcessedPhotoResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc file hình ảnh.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Hình ảnh bị hỏng hoặc không đúng định dạng.'));
      img.onload = async () => {
        let { width, height } = img;

        // Giữ tỷ lệ khung hình, nắn nếu vượt quá maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Không thể khởi tạo Canvas 2D'));
        }

        // Vẽ ảnh lên canvas với làm mịn chất lượng cao
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              return reject(new Error('Không thể xuất Blob từ Canvas.'));
            }

            // Sinh tên file chuẩn M2
            const cleanB = (namingParams.buildingOrParcelCode || 'GENERAL').replace(/[^a-zA-Z0-9_-]/g, '');
            const cleanF = (namingParams.floorCode || 'G').replace(/[^a-zA-Z0-9_-]/g, '');
            const cleanZ = (namingParams.zoneCode || 'GENERAL').replace(/[^a-zA-Z0-9_-]/g, '');
            const cleanType = namingParams.photoType.toUpperCase().replace(/[^a-zA-Z0-9_-]/g, '');
            const idxStr = String(namingParams.index || 1).padStart(2, '0');
            const epoch = Date.now();

            const nameParts = ['M2', cleanB, cleanF, cleanZ];
            if (namingParams.defectCode) {
              nameParts.push(namingParams.defectCode.replace(/[^a-zA-Z0-9_-]/g, ''));
            }
            nameParts.push(cleanType, idxStr, String(epoch));
            const standardizedFilename = `${nameParts.join('__')}.jpg`;

            // Sinh mã định danh pháp lý HCM_M2...
            const codeParts = [`HCM_M2.${cleanB}`];
            if (namingParams.floorCode) codeParts.push(cleanF);
            if (namingParams.zoneCode) codeParts.push(cleanZ);
            if (namingParams.defectCode) codeParts.push(namingParams.defectCode.replace(/[^a-zA-Z0-9]/g, ''));
            codeParts.push(cleanType, idxStr);
            const photoCode = codeParts.join('_');

            const standardizedFile = new File([blob], standardizedFilename, { type: 'image/jpeg' });
            const sha256Hash = await calculateBrowserSha256(standardizedFile);

            resolve({
              file: standardizedFile,
              dataUrl,
              width,
              height,
              sha256Hash,
              sizeBytes: standardizedFile.size,
              standardizedFilename,
              photoCode,
            });
          },
          'image/jpeg',
          quality
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload file chuẩn hóa lên máy chủ / Cloudflare R2
 */
export async function uploadStandardizedPhoto(
  file: File,
  folder: string = 'surveys/audit',
  metadata?: Record<string, unknown>
): Promise<{ url: string; key: string; sha256: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata));
  }

  const res = await api.post('/storage/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (res.data?.success && res.data?.data?.url) {
    return {
      url: res.data.data.url,
      key: res.data.data.key || '',
      sha256: res.data.data.checksumSha256 || '',
    };
  } else if (res.data?.url) {
    return {
      url: res.data.url,
      key: res.data.key || '',
      sha256: '',
    };
  }

  throw new Error('Upload ảnh không trả về URL hợp lệ từ máy chủ lưu trữ.');
}
