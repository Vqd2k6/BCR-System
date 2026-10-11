/**
 * condoUnitPhotoAudit.ts
 * Tiện ích quét và kiểm toán toàn bộ tài nguyên ảnh trong khảo sát Căn hộ con (Condo Unit)
 * Đảm bảo 100% ảnh được đồng bộ lên Cloudflare R2 trước khi nộp hồ sơ
 */

import type { CondoUnitFormData } from '../types/condo-unit.types';
import { isLocalBlobUri, extractLocalIdFromUri, getOfflinePhoto, saveOfflinePhoto, getKnownCloudUrl, healLocalPhotoUris, markOfflinePhotoUploaded } from '../../../core/storage/offlinePhotoStorage';
import { uploadQueue } from '../../../core/services/uploadQueueService';
import { base64ToBlob } from '../../survey-phase1/utils/photoSyncAudit';

export interface CondoUnitPhotoAuditItem {
  id: string;
  fieldKey: string;
  step: 1 | 2 | 3 | 4;
  stepTitle: string;
  fieldTitle: string;
  photoCode?: string;
  url: string;
  isCloudUrl: boolean;
  isLocalBlob: boolean;
  isUploading: boolean;
  isError: boolean;
}

export interface CondoUnitPhotoAuditSummary {
  allPhotos: CondoUnitPhotoAuditItem[];
  syncedPhotos: CondoUnitPhotoAuditItem[];
  unsyncedPhotos: CondoUnitPhotoAuditItem[];
  total: number;
  synced: number;
  unsynced: number;
}

export function auditCondoUnitPhotos(rawFormData: CondoUnitFormData): CondoUnitPhotoAuditSummary {
  // Ảnh đã lên Cloud (có mapping bền) nhưng dữ liệu còn giữ blob:local:// -> tính là đã đồng bộ
  const formData = healLocalPhotoUris(rawFormData);
  const allPhotos: CondoUnitPhotoAuditItem[] = [];

  const addPhoto = (
    id: string,
    fieldKey: string,
    step: 1 | 2 | 3 | 4,
    stepTitle: string,
    fieldTitle: string,
    url: string | undefined | null,
    photoCode?: string
  ) => {
    if (!url || typeof url !== 'string' || !url.trim()) return;

    const isCloud = url.startsWith('http') && !url.includes('blob:') && !isLocalBlobUri(url);
    const isBlob = isLocalBlobUri(url) || url.startsWith('blob:');

    allPhotos.push({
      id,
      fieldKey,
      step,
      stepTitle,
      fieldTitle,
      photoCode,
      url,
      isCloudUrl: isCloud,
      isLocalBlob: isBlob,
      isUploading: false,
      isError: false,
    });
  };

  // Bước 1: 2 Ảnh nhận diện cửa
  if (formData.photoP01?.url) {
    addPhoto(
      'p01',
      'photoP01',
      1,
      'Bước 1: Tiếp cận & Nhận diện',
      'Ảnh P01: Biển số phòng gắn trên cửa',
      formData.photoP01.url,
      formData.photoP01.photoCode || 'P-01'
    );
  }
  if (formData.photoP04?.url) {
    addPhoto(
      'p04',
      'photoP04',
      1,
      'Bước 1: Tiếp cận & Nhận diện',
      'Ảnh P04: Toàn cảnh cửa & hành lang lối đi',
      formData.photoP04.url,
      formData.photoP04.photoCode || 'P-04'
    );
  }

  // Bước 3: Sơ đồ CAD & Khuyết tật Z-E-D
  if (formData.unitCadUrl) {
    addPhoto(
      'cad_sketch',
      'unitCadUrl',
      3,
      'Bước 3: CAD & Khuyết tật',
      'Sơ đồ mặt bằng CAD căn hộ',
      formData.unitCadUrl,
      'CAD_PLAN'
    );
  }
  if (formData.unitStructuralCadUrl) {
    addPhoto(
      'cad_structural',
      'unitStructuralCadUrl',
      3,
      'Bước 3: CAD & Khuyết tật',
      'Sơ đồ mặt bằng CAD kết cấu riêng',
      formData.unitStructuralCadUrl,
      'CAD_STRUCTURAL'
    );
  }

  // Vùng Z
  (formData.zones || []).forEach((z, zIdx) => {
    (z.overviewPhotos || []).forEach((pUrl, pIdx) => {
      addPhoto(
        `zone_${z.zoneCode}_ov_${pIdx}`,
        `zone_${zIdx}_ov_${pIdx}`,
        3,
        'Bước 3: CAD & Khuyết tật',
        `Ảnh toàn cảnh ${z.zoneCode} (${z.roomName || 'Vùng'}) #${pIdx + 1}`,
        pUrl,
        `${z.zoneCode}_OV_${pIdx + 1}`
      );
    });

    if (z.ctxPhotoUrl) {
      addPhoto(
        `zone_${z.zoneCode}_ctx`,
        `zone_${zIdx}_ctx`,
        3,
        'Bước 3: CAD & Khuyết tật',
        `Ảnh bối cảnh ${z.zoneCode} (${z.roomName || 'Mảng tường/trần'})`,
        z.ctxPhotoUrl,
        `${z.zoneCode}_CTX`
      );
    }

    (z.defects || []).forEach((d, dIdx) => {
      if (d.cuPhotoUrl) {
        addPhoto(
          `zone_${z.zoneCode}_defect_${d.defectCode}_cu`,
          `zone_${zIdx}_defect_${dIdx}_cu`,
          3,
          'Bước 3: CAD & Khuyết tật',
          `Ảnh cận cảnh thước đo ${d.defectCode} (${z.zoneCode})`,
          d.cuPhotoUrl,
          `${d.defectCode}_CU`
        );
      }
      (d.cuPhotos || []).forEach((extraUrl, eIdx) => {
        if (extraUrl && extraUrl !== d.cuPhotoUrl) {
          addPhoto(
            `zone_${z.zoneCode}_defect_${d.defectCode}_extra_${eIdx}`,
            `zone_${zIdx}_defect_${dIdx}_extra_${eIdx}`,
            3,
            'Bước 3: CAD & Khuyết tật',
            `Ảnh chi tiết phụ ${d.defectCode} #${eIdx + 1}`,
            extraUrl,
            `${d.defectCode}_EXTRA_${eIdx + 1}`
          );
        }
      });
    });
  });

  // Cấu kiện E
  if (formData.hasStructuralElements !== false) {
    (formData.structuralElements || []).forEach((e, eIdx) => {
      (e.overviewPhotos || []).forEach((pUrl, pIdx) => {
        addPhoto(
          `elem_${e.elementCode}_ov_${pIdx}`,
          `elem_${eIdx}_ov_${pIdx}`,
          3,
          'Bước 3: CAD & Khuyết tật',
          `Ảnh toàn cảnh ${e.elementCode} (${e.elementType || 'Cấu kiện'}) #${pIdx + 1}`,
          pUrl,
          `${e.elementCode}_OV_${pIdx + 1}`
        );
      });

      if (e.ctxPhotoUrl) {
        addPhoto(
          `elem_${e.elementCode}_ctx`,
          `elem_${eIdx}_ctx`,
          3,
          'Bước 3: CAD & Khuyết tật',
          `Ảnh bối cảnh ${e.elementCode} (${e.elementType || 'Cấu kiện'})`,
          e.ctxPhotoUrl,
          `${e.elementCode}_CTX`
        );
      }

      (e.defects || []).forEach((d, dIdx) => {
        if (d.cuPhotoUrl) {
          addPhoto(
            `elem_${e.elementCode}_defect_${d.defectCode}_cu`,
            `elem_${eIdx}_defect_${dIdx}_cu`,
            3,
            'Bước 3: CAD & Khuyết tật',
            `Ảnh cận cảnh khuyết tật kết cấu ${d.defectCode}`,
            d.cuPhotoUrl,
            `${d.defectCode}_CU`
          );
        }
        (d.cuPhotos || []).forEach((extraUrl, eIdx) => {
          if (extraUrl && extraUrl !== d.cuPhotoUrl) {
            addPhoto(
              `elem_${e.elementCode}_defect_${d.defectCode}_extra_${eIdx}`,
              `elem_${eIdx}_defect_${dIdx}_extra_${eIdx}`,
              3,
              'Bước 3: CAD & Khuyết tật',
              `Ảnh chi tiết phụ ${d.defectCode} #${eIdx + 1}`,
              extraUrl,
              `${d.defectCode}_EXTRA_${eIdx + 1}`
            );
          }
        });
      });
    });
  }

  // Độ võng dầm sàn
  if (formData.beamSagging?.photoUrl) {
    addPhoto(
      'beam_sagging',
      'beamSagging.photoUrl',
      3,
      'Bước 3: CAD & Khuyết tật',
      'Ảnh đo độ võng dầm / sàn kết cấu',
      formData.beamSagging.photoUrl,
      'BEAM_SAG'
    );
  }

  // Thấm dột từ tầng trên
  const leakage = formData.upperFloorWaterLeakage;
  if (leakage) {
    (leakage.leakageItems || []).forEach((item, lIdx) => {
      if (item.photoUrl) {
        addPhoto(
          `leak_${lIdx}_photo`,
          `leak_${lIdx}_photo`,
          3,
          'Bước 3: CAD & Khuyết tật',
          `Ảnh thấm dột từ tầng trên #${lIdx + 1}`,
          item.photoUrl,
          `WL_${lIdx + 1}`
        );
      }
      if (item.cuPhotoUrl && item.cuPhotoUrl !== item.photoUrl) {
        addPhoto(
          `leak_${lIdx}_cu`,
          `leak_${lIdx}_cu`,
          3,
          'Bước 3: CAD & Khuyết tật',
          `Ảnh cận cảnh thấm dột #${lIdx + 1}`,
          item.cuPhotoUrl,
          `WL_${lIdx + 1}_CU`
        );
      }
    });
  }

  // Bước 4: Biên bản làm việc hiện trường & chữ ký tươi
  (formData.workingMinutesPhotos || []).forEach((mUrl, mIdx) => {
    addPhoto(
      `minutes_${mIdx}`,
      `workingMinutes_${mIdx}`,
      4,
      'Bước 4: Tóm tắt & Nộp hồ sơ',
      `Ảnh biên bản giấy làm việc trang ${mIdx + 1}`,
      mUrl,
      `MINUTES_P${mIdx + 1}`
    );
  });

  // Biên bản vắng mặt / Giấy hẹn dán cửa (Chế độ Khảo sát Vắng mặt)
  const absenteeMinutes = formData.absenteeInfo?.absenteeMinutesPhotos || formData.absenteeMinutesPhotos || [];
  absenteeMinutes.forEach((mUrl, mIdx) => {
    addPhoto(
      `absentee_minutes_${mIdx}`,
      `absenteeMinutes_${mIdx}`,
      formData.isAbsentee ? 3 : 4,
      formData.isAbsentee ? 'Bước 3: Biên bản vắng nhà & Nộp hồ sơ' : 'Bước 4: Tóm tắt & Nộp hồ sơ',
      `Ảnh biên bản xác nhận vắng chủ / giấy hẹn #${mIdx + 1}`,
      mUrl,
      `ABSENT_MINUTES_${mIdx + 1}`
    );
  });

  const syncedPhotos = allPhotos.filter((p) => p.isCloudUrl);
  const unsyncedPhotos = allPhotos.filter((p) => !p.isCloudUrl);

  return {
    allPhotos,
    syncedPhotos,
    unsyncedPhotos,
    total: allPhotos.length,
    synced: syncedPhotos.length,
    unsynced: unsyncedPhotos.length,
  };
}

/**
 * Thử upload lại một ảnh chưa đồng bộ lên Cloudflare R2
 * Hỗ trợ đa nguồn dữ liệu: Base64 data URL, blob:http URL, và IndexedDB blob:local://
 */
export async function retryUploadCondoUnitPhoto(
  photoItem: CondoUnitPhotoAuditItem,
  parcelCode: string,
  unitCode: string,
  onSuccess: (newCloudUrl: string) => void
): Promise<void> {
  if (photoItem.isCloudUrl) return;

  let blob: Blob | null = null;
  let localId = extractLocalIdFromUri(photoItem.url);

  // Ảnh đã lên Cloud từ trước (mapping bền) nhưng dữ liệu còn giữ URL tạm -> gán lại ngay, không cần blob
  if (photoItem.url.startsWith('blob:local://')) {
    const knownCloud = getKnownCloudUrl(localId);
    if (knownCloud) {
      onSuccess(knownCloud);
      return;
    }
  }

  // 1. Nếu là chuỗi Base64 Data URL (VD: CAD trích xuất hoặc ảnh lưu tạm)
  if (photoItem.url.startsWith('data:image/')) {
    blob = base64ToBlob(photoItem.url);
    if (!localId || localId === photoItem.url) {
      localId = `cad_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    // Cất ngay vào IndexedDB để bảo toàn nhị phân
    try {
      await saveOfflinePhoto(localId, blob, photoItem.photoCode || 'photo', {
        'parcel-code': parcelCode || 'PARCEL',
        'unit-code': unitCode || 'UNIT',
      });
    } catch (_storageErr) {}
  }
  // 2. Nếu là URL Object Blob tạm thời từ trình duyệt (blob:http...)
  else if (photoItem.url.startsWith('blob:http')) {
    try {
      const resp = await fetch(photoItem.url);
      if (resp.ok) {
        blob = await resp.blob();
      }
    } catch (_fetchErr) {}
    if (!localId || localId === photoItem.url) {
      localId = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    if (blob) {
      try {
        await saveOfflinePhoto(localId, blob, photoItem.photoCode || 'photo', {
          'parcel-code': parcelCode || 'PARCEL',
          'unit-code': unitCode || 'UNIT',
        });
      } catch (_storageErr) {}
    }
  }
  // 3. Nếu là định danh offline có quản lý: blob:local://{id}
  else if (photoItem.url.startsWith('blob:local://') || localId) {
    // 3.1. Kiểm tra ngay trong Persistent Cloud Mapping (Đã tải lên R2 thành công trước đó)
    const knownCloud = localId ? getKnownCloudUrl(localId) : null;
    if (knownCloud) {
      onSuccess(knownCloud);
      return;
    }

    const offlinePhoto = await getOfflinePhoto(localId);
    if (offlinePhoto && offlinePhoto.blob) {
      blob = offlinePhoto.blob;
    }
  }

  if (!blob) {
    throw new Error(
      'Dữ liệu ảnh gốc không có trên thiết bị này. Ảnh đang lưu tạm trong bộ nhớ của thiết bị (điện thoại/máy tính bảng) đã chụp khảo sát trước đó. Vui lòng mở lại hồ sơ trên thiết bị đó có kết nối mạng để hoàn tất tải lên Cloud.'
    );
  }

  const safeParcel = parcelCode || 'PARCEL';
  const safeUnit = unitCode || 'UNIT';
  const targetFolder = `surveys/${safeParcel}/${safeUnit}`;
  const filename = `${photoItem.photoCode || 'photo'}_${Date.now()}.jpg`;

  uploadQueue.enqueue(blob, filename, {
    id: localId,
    folder: targetFolder,
    mimeType: blob.type || 'image/jpeg',
    metadata: {
      'parcel-code': safeParcel,
      'unit-code': safeUnit,
      'photo-code': photoItem.photoCode || '',
    },
    onSuccess: async (publicUrl) => {
      if (localId) {
        await markOfflinePhotoUploaded(localId, publicUrl);
      }
      onSuccess(publicUrl);
    },
  });
}
