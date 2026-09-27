import { api } from '../../../services/api';
import { Phase1SurveyFormData } from '../types/phase1.types';

// Helper kiểm tra một chuỗi có phải là data base64 (ví dụ data:image/png;base64,...) hoặc chuỗi base64 thô dài không
export const isBase64Image = (str: string | undefined | null): boolean => {
  if (!str || typeof str !== 'string') return false;
  if (str.startsWith('data:image/')) return true;
  // Hoặc chuỗi base64 không chứa http/https và độ dài lớn hơn 100 ký tự
  if (!str.startsWith('http://') && !str.startsWith('https://') && !str.startsWith('/') && str.length > 200) {
    return true;
  }
  return false;
};

// Chuyển đổi chuỗi base64 thành đối tượng File
export const base64ToFile = (base64String: string, filename: string): File => {
  let mime = 'image/jpeg';
  let bstr = '';

  if (base64String.includes(';base64,')) {
    const parts = base64String.split(';base64,');
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (mimeMatch) mime = mimeMatch[1];
    bstr = atob(parts[1]);
  } else {
    bstr = atob(base64String);
  }

  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

// Tải một ảnh base64 lên server endpoint /storage/upload
export const uploadSingleBase64Image = async (
  base64Str: string,
  filenamePrefix: string = 'survey_photo'
): Promise<string> => {
  if (!isBase64Image(base64Str)) {
    return base64Str; // Đã là URL, không cần upload lại
  }

  const filename = `${filenamePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
  const file = base64ToFile(base64Str, filename);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', 'surveys');

  const response = await api.post('/storage/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  if (response.data?.success && response.data?.data?.url) {
    return response.data.data.url;
  } else if (response.data?.url) {
    return response.data.url;
  }

  throw new Error('Upload ảnh thất bại: Server không trả về URL hợp lệ');
};

export interface UploadProgress {
  current: number;
  total: number;
  statusText: string;
}

/**
 * Quét toàn bộ Phase1SurveyFormData và upload tự động tất cả ảnh Base64 lên storage server
 * trước khi gửi JSON payload nhẹ về Backend.
 */
export const uploadAllSurveyImages = async (
  formData: Phase1SurveyFormData,
  onProgress?: (progress: UploadProgress) => void
): Promise<Phase1SurveyFormData> => {
  // Tạo bản sao sâu của formData để sửa đổi
  const clonedData: Phase1SurveyFormData = JSON.parse(JSON.stringify(formData));

  // 1. Thu thập tất cả các vị trí chứa ảnh Base64
  interface ImageTarget {
    locationName: string;
    get: () => string | undefined;
    set: (url: string) => void;
  }

  const targets: ImageTarget[] = [];

  // P01 - P04
  if (clonedData.photoP01?.url && isBase64Image(clonedData.photoP01.url)) {
    targets.push({
      locationName: 'Ảnh biển số nhà (P-01)',
      get: () => clonedData.photoP01?.url,
      set: (url) => { if (clonedData.photoP01) clonedData.photoP01.url = url; },
    });
  }
  if (clonedData.photoP02?.url && isBase64Image(clonedData.photoP02.url)) {
    targets.push({
      locationName: 'Ảnh mặt đứng chính (P-02)',
      get: () => clonedData.photoP02?.url,
      set: (url) => { if (clonedData.photoP02) clonedData.photoP02.url = url; },
    });
  }
  if (clonedData.photoP03?.url && isBase64Image(clonedData.photoP03.url)) {
    targets.push({
      locationName: 'Ảnh mặt hông / sau (P-03)',
      get: () => clonedData.photoP03?.url,
      set: (url) => { if (clonedData.photoP03) clonedData.photoP03.url = url; },
    });
  }
  if (clonedData.photoP04?.url && isBase64Image(clonedData.photoP04.url)) {
    targets.push({
      locationName: 'Ảnh bối cảnh / lòng đường (P-04)',
      get: () => clonedData.photoP04?.url,
      set: (url) => { if (clonedData.photoP04) clonedData.photoP04.url = url; },
    });
  }

  // Chữ ký
  if (clonedData.signatures?.preparedBy?.photoUrl && isBase64Image(clonedData.signatures.preparedBy.photoUrl)) {
    targets.push({
      locationName: 'Chữ ký kỹ sư khảo sát',
      get: () => clonedData.signatures?.preparedBy?.photoUrl,
      set: (url) => { if (clonedData.signatures?.preparedBy) clonedData.signatures.preparedBy.photoUrl = url; },
    });
  }
  if (clonedData.signatures?.ownerRepresentative?.photoUrl && isBase64Image(clonedData.signatures.ownerRepresentative.photoUrl)) {
    targets.push({
      locationName: 'Chữ ký chủ hộ / đại diện',
      get: () => clonedData.signatures?.ownerRepresentative?.photoUrl,
      set: (url) => { if (clonedData.signatures?.ownerRepresentative) clonedData.signatures.ownerRepresentative.photoUrl = url; },
    });
  }

  // Tầng, ảnh tổng quan, bản vẽ CAD phác thảo, Vùng Z và Khuyết tật D
  if (clonedData.floors && Array.isArray(clonedData.floors)) {
    clonedData.floors.forEach((floor, fIdx) => {
      // CAD sketches
      if (floor.cadSketchPhotoUrl && isBase64Image(floor.cadSketchPhotoUrl)) {
        targets.push({
          locationName: `Sơ đồ CAD tổng quan ${floor.floorName || `Tầng ${fIdx + 1}`}`,
          get: () => floor.cadSketchPhotoUrl,
          set: (url) => { floor.cadSketchPhotoUrl = url; },
        });
      }
      if (floor.cadStructuralSketchPhotoUrl && isBase64Image(floor.cadStructuralSketchPhotoUrl)) {
        targets.push({
          locationName: `Sơ đồ CAD kết cấu ${floor.floorName || `Tầng ${fIdx + 1}`}`,
          get: () => floor.cadStructuralSketchPhotoUrl,
          set: (url) => { floor.cadStructuralSketchPhotoUrl = url; },
        });
      }

      // Overview photos
      if (floor.overviewPhotos && Array.isArray(floor.overviewPhotos)) {
        floor.overviewPhotos.forEach((photoObj, pIdx) => {
          if (photoObj.url && isBase64Image(photoObj.url)) {
            targets.push({
              locationName: `Ảnh tổng quan ${pIdx + 1} - ${floor.floorName || `Tầng ${fIdx + 1}`}`,
              get: () => photoObj.url,
              set: (url) => { photoObj.url = url; },
            });
          }
        });
      }

      // Zones & Defects
      if (floor.zones && Array.isArray(floor.zones)) {
        floor.zones.forEach((zone, zIdx) => {
          if (zone.ctxPhotoUrl && isBase64Image(zone.ctxPhotoUrl)) {
            targets.push({
              locationName: `Ảnh bối cảnh Vùng ${zone.zoneCode || `Z-${zIdx + 1}`}`,
              get: () => zone.ctxPhotoUrl,
              set: (url) => { zone.ctxPhotoUrl = url; },
            });
          }

          if (zone.defects && Array.isArray(zone.defects)) {
            zone.defects.forEach((defect, dIdx) => {
              if (defect.cuPhotoUrl && isBase64Image(defect.cuPhotoUrl)) {
                targets.push({
                  locationName: `Ảnh cận cảnh khuyết tật ${defect.defectCode || `D-${dIdx + 1}`}`,
                  get: () => defect.cuPhotoUrl,
                  set: (url) => { defect.cuPhotoUrl = url; },
                });
              }
              if ((defect as any).extraPhotoUrl && isBase64Image((defect as any).extraPhotoUrl)) {
                targets.push({
                  locationName: `Ảnh bổ sung khuyết tật ${defect.defectCode || `D-${dIdx + 1}`}`,
                  get: () => (defect as any).extraPhotoUrl,
                  set: (url) => { (defect as any).extraPhotoUrl = url; },
                });
              }
            });
          }
        });
      }
    });
  }

  const total = targets.length;
  if (total === 0) {
    if (onProgress) {
      onProgress({ current: 0, total: 0, statusText: 'Không có ảnh Base64 cần tải lên.' });
    }
    return clonedData;
  }

  // 2. Lần lượt upload từng ảnh để không quá tải kết nối
  for (let i = 0; i < total; i++) {
    const target = targets[i];
    const base64Data = target.get();
    if (base64Data) {
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          statusText: `Đang tải ảnh ${i + 1}/${total}: ${target.locationName}...`,
        });
      }

      try {
        const uploadedUrl = await uploadSingleBase64Image(base64Data, `survey_${i + 1}`);
        target.set(uploadedUrl);
      } catch (err: any) {
        console.error(`[ImageUploader] Lỗi khi tải ${target.locationName}:`, err);
        throw new Error(`Tải ảnh thất bại tại "${target.locationName}": ${err.message || 'Lỗi kết nối'}`);
      }
    }
  }

  if (onProgress) {
    onProgress({ current: total, total, statusText: `Đã tải thành công toàn bộ ${total} ảnh lên Cloud storage!` });
  }

  return clonedData;
};
