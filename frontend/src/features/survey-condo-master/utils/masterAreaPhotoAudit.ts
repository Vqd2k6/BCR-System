/**
 * masterAreaPhotoAudit.ts
 * Tiện ích quét và kiểm toán toàn diện 100% tài nguyên ảnh trong Khảo sát Khu vực Chung cư (Master Area Survey)
 * Đảm bảo đồng nhất tuyệt đối giữa Header, Pre-Flight Check (Bước 5) và Popup Kiểm toán ảnh
 */

import type { EvidencePhotoItem, DamageZoneData, StructuralElementData } from '../../survey-phase1/types/phase1.types';
import {
  isLocalBlobUri,
  extractLocalIdFromUri,
  getOfflinePhoto,
  saveOfflinePhoto,
  getKnownCloudUrl,
  healLocalPhotoUris,
  markOfflinePhotoUploaded,
} from '../../../core/storage/offlinePhotoStorage';
import { uploadQueue } from '../../../core/services/uploadQueueService';
import { base64ToBlob } from '../../survey-phase1/utils/photoSyncAudit';

export interface MasterAreaPhotoAuditItem {
  id: string;
  fieldKey: string;
  step: 2 | 3 | 4 | 5;
  stepTitle: string;
  fieldTitle: string;
  photoCode?: string;
  url: string;
  isCloudUrl: boolean;
  isLocalBlob: boolean;
  isUploading: boolean;
  isError: boolean;
  updateInStore?: (newUrl: string) => void;
}

export interface MasterAreaPhotoAuditSummary {
  allPhotos: MasterAreaPhotoAuditItem[];
  syncedPhotos: MasterAreaPhotoAuditItem[];
  unsyncedPhotos: MasterAreaPhotoAuditItem[];
  total: number;
  synced: number;
  unsynced: number;
  primaryUnsyncedStep: 2 | 3 | 4 | 5;
}

export interface MasterAreaAuditInput {
  overviewPhotos?: EvidencePhotoItem[];
  cadSketchPhotoUrl?: string | null;
  cadStructuralSketchPhotoUrl?: string | null;
  useSeparateStructuralCad?: boolean;
  zones?: DamageZoneData[];
  structuralElements?: StructuralElementData[];
  hasStructuralElements?: boolean;
  unitCode?: string;
}

/**
 * Quét toàn bộ ảnh trong hồ sơ khảo sát khu vực dùng chung của chung cư (Master Area)
 * Single Source of Truth phục vụ Header, Pre-Flight và Audit Modal
 */
export function auditMasterAreaPhotos(rawInput: MasterAreaAuditInput): MasterAreaPhotoAuditSummary {
  // Áp dụng healLocalPhotoUris để thay thế tức thì các URL local đã có mapping Cloud trong localStorage
  const input = healLocalPhotoUris(rawInput);
  const allPhotos: MasterAreaPhotoAuditItem[] = [];
  const seenUrls = new Set<string>();

  const addPhoto = (
    id: string,
    fieldKey: string,
    step: 2 | 3 | 4 | 5,
    stepTitle: string,
    fieldTitle: string,
    url: string | undefined | null,
    photoCode?: string,
    updateInStore?: (newUrl: string) => void
  ) => {
    if (!url || typeof url !== 'string' || !url.trim()) return;

    // Không thêm trùng lặp cùng 1 URL nếu đã xuất hiện trong danh sách
    if (seenUrls.has(url)) return;
    seenUrls.add(url);

    const isCloud =
      (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads')) &&
      !url.includes('blob:') &&
      !isLocalBlobUri(url);
    const isBlob = isLocalBlobUri(url) || url.startsWith('blob:') || url.startsWith('data:image/');

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
      updateInStore,
    });
  };

  const safeUnitCode = input.unitCode || 'AREA';

  // 1. Bước 2: Ảnh toàn cảnh khu vực
  (input.overviewPhotos || []).forEach((photo, idx) => {
    addPhoto(
      `overview_${idx}`,
      `overviewPhotos[${idx}].url`,
      2,
      'Bước 2: Ảnh & CAD',
      `Ảnh toàn cảnh #${idx + 1}`,
      photo.url,
      photo.photoCode || `OV_${idx + 1}`
    );
  });

  // 2. Bước 2: CAD khu vực
  if (input.cadSketchPhotoUrl) {
    addPhoto(
      'cad_sketch',
      'cadSketchPhotoUrl',
      2,
      'Bước 2: Ảnh & CAD',
      'Bản vẽ sơ đồ khu vực',
      input.cadSketchPhotoUrl,
      `CAD_${safeUnitCode}`
    );
  }

  // 3. Bước 2: CAD kết cấu riêng
  if (input.useSeparateStructuralCad && input.cadStructuralSketchPhotoUrl) {
    addPhoto(
      'cad_structural',
      'cadStructuralSketchPhotoUrl',
      2,
      'Bước 2: Ảnh & CAD',
      'Bản vẽ sơ đồ kết cấu riêng',
      input.cadStructuralSketchPhotoUrl,
      `CAD_STR_${safeUnitCode}`
    );
  }

  // 4. Bước 3: Vùng kiến trúc Z & Khuyết tật D
  (input.zones || []).forEach((z, zIdx) => {
    const zCode = z.zoneCode || `Z-${zIdx + 1}`;

    // Ảnh tổng quan mảng tường/trần của Vùng Z
    (z.overviewPhotos || []).forEach((pUrl, pIdx) => {
      addPhoto(
        `zone_${zCode}_ov_${pIdx}`,
        `zones[${zIdx}].overviewPhotos[${pIdx}]`,
        3,
        `Bước 3: Vùng ${zCode}`,
        `Ảnh toàn cảnh ${zCode} (${z.roomName || 'Vùng'}) #${pIdx + 1}`,
        pUrl,
        `${zCode}_OV_${pIdx + 1}`
      );
    });

    // Ảnh bối cảnh chính ctxPhotoUrl của Vùng Z (nếu khác với overviewPhotos)
    if (z.ctxPhotoUrl) {
      addPhoto(
        `zone_${zCode}_ctx`,
        `zones[${zIdx}].ctxPhotoUrl`,
        3,
        `Bước 3: Vùng ${zCode}`,
        `Ảnh bối cảnh chính ${zCode} (${z.roomName || 'Bối cảnh'})`,
        z.ctxPhotoUrl,
        z.ctxPhotoCode || `${zCode}_CTX`
      );
    }

    // Các điểm khuyết tật D trong Vùng Z
    (z.defects || []).forEach((def, dIdx) => {
      const dCode = def.defectCode || `D${dIdx + 1}`;

      // Ảnh cận cảnh chính
      if (def.cuPhotoUrl) {
        addPhoto(
          `zone_${zCode}_d_${dCode}_cu`,
          `zones[${zIdx}].defects[${dIdx}].cuPhotoUrl`,
          3,
          `Bước 3: Vùng ${zCode}`,
          `Ảnh cận cảnh thước đo ${dCode} (${zCode})`,
          def.cuPhotoUrl,
          def.cuPhotoCode || `${zCode}_${dCode}_CU`
        );
      }

      // Mảng các ảnh cận cảnh chi tiết (cuPhotos) từ DefectPinningCanvas
      (def.cuPhotos || []).forEach((extraUrl, eIdx) => {
        addPhoto(
          `zone_${zCode}_d_${dCode}_cuphotos_${eIdx}`,
          `zones[${zIdx}].defects[${dIdx}].cuPhotos[${eIdx}]`,
          3,
          `Bước 3: Vùng ${zCode}`,
          `Ảnh chi tiết phụ ${dCode} (${zCode}) #${eIdx + 1}`,
          extraUrl,
          def.cuPhotoCodes?.[eIdx] || `${zCode}_${dCode}_CU_${eIdx + 1}`
        );
      });

      // Ảnh toàn cảnh bối cảnh khuyết tật (macroPhotoUrl)
      if (def.macroPhotoUrl) {
        addPhoto(
          `zone_${zCode}_d_${dCode}_macro`,
          `zones[${zIdx}].defects[${dIdx}].macroPhotoUrl`,
          3,
          `Bước 3: Vùng ${zCode}`,
          `Ảnh toàn cảnh vị trí ${dCode} (${zCode})`,
          def.macroPhotoUrl,
          `${zCode}_${dCode}_MACRO`
        );
      }

      // Ảnh mở rộng extraPhotoUrl
      if (def.extraPhotoUrl) {
        addPhoto(
          `zone_${zCode}_d_${dCode}_extra`,
          `zones[${zIdx}].defects[${dIdx}].extraPhotoUrl`,
          3,
          `Bước 3: Vùng ${zCode}`,
          `Ảnh bổ sung ${dCode} (${zCode})`,
          def.extraPhotoUrl,
          `${zCode}_${dCode}_EXTRA`
        );
      }
    });
  });

  // 5. Bước 4: Cấu kiện kết cấu E & Khuyết tật D
  if (input.hasStructuralElements !== false) {
    (input.structuralElements || []).forEach((e, eIdx) => {
      const eCode = e.elementCode || `E-${eIdx + 1}`;

      // Ảnh tổng quan cấu kiện
      (e.overviewPhotos || []).forEach((pUrl, pIdx) => {
        addPhoto(
          `elem_${eCode}_ov_${pIdx}`,
          `structuralElements[${eIdx}].overviewPhotos[${pIdx}]`,
          4,
          `Bước 4: Cấu kiện ${eCode}`,
          `Ảnh toàn cảnh ${eCode} (${e.elementType || 'Cấu kiện'}) #${pIdx + 1}`,
          pUrl,
          `${eCode}_OV_${pIdx + 1}`
        );
      });

      // Ảnh bối cảnh chính cấu kiện
      if (e.ctxPhotoUrl) {
        addPhoto(
          `elem_${eCode}_ctx`,
          `structuralElements[${eIdx}].ctxPhotoUrl`,
          4,
          `Bước 4: Cấu kiện ${eCode}`,
          `Ảnh bối cảnh cấu kiện ${eCode}`,
          e.ctxPhotoUrl,
          e.ctxPhotoCode || `${eCode}_CTX`
        );
      }

      // Các khuyết tật kết cấu
      (e.defects || []).forEach((def, dIdx) => {
        const dCode = def.defectCode || `D${dIdx + 1}`;

        if (def.cuPhotoUrl) {
          addPhoto(
            `elem_${eCode}_d_${dCode}_cu`,
            `structuralElements[${eIdx}].defects[${dIdx}].cuPhotoUrl`,
            4,
            `Bước 4: Cấu kiện ${eCode}`,
            `Ảnh cận cảnh khuyết tật kết cấu ${dCode} (${eCode})`,
            def.cuPhotoUrl,
            def.cuPhotoCode || `${eCode}_${dCode}_CU`
          );
        }

        (def.cuPhotos || []).forEach((extraUrl, eIdx) => {
          addPhoto(
            `elem_${eCode}_d_${dCode}_cuphotos_${eIdx}`,
            `structuralElements[${eIdx}].defects[${dIdx}].cuPhotos[${eIdx}]`,
            4,
            `Bước 4: Cấu kiện ${eCode}`,
            `Ảnh chi tiết phụ ${dCode} (${eCode}) #${eIdx + 1}`,
            extraUrl,
            def.cuPhotoCodes?.[eIdx] || `${eCode}_${dCode}_CU_${eIdx + 1}`
          );
        });

        if (def.macroPhotoUrl) {
          addPhoto(
            `elem_${eCode}_d_${dCode}_macro`,
            `structuralElements[${eIdx}].defects[${dIdx}].macroPhotoUrl`,
            4,
            `Bước 4: Cấu kiện ${eCode}`,
            `Ảnh toàn cảnh vị trí ${dCode} (${eCode})`,
            def.macroPhotoUrl,
            `${eCode}_${dCode}_MACRO`
          );
        }

        if (def.extraPhotoUrl) {
          addPhoto(
            `elem_${eCode}_d_${dCode}_extra`,
            `structuralElements[${eIdx}].defects[${dIdx}].extraPhotoUrl`,
            4,
            `Bước 4: Cấu kiện ${eCode}`,
            `Ảnh bổ sung ${dCode} (${eCode})`,
            def.extraPhotoUrl,
            `${eCode}_${dCode}_EXTRA`
          );
        }
      });
    });
  }

  const syncedPhotos = allPhotos.filter((p) => p.isCloudUrl);
  const unsyncedPhotos = allPhotos.filter((p) => !p.isCloudUrl);

  // Xác định bước đầu tiên có ảnh chưa đồng bộ để điều hướng chính xác
  const firstUnsynced = unsyncedPhotos[0];
  const primaryUnsyncedStep = firstUnsynced ? firstUnsynced.step : 2;

  return {
    allPhotos,
    syncedPhotos,
    unsyncedPhotos,
    total: allPhotos.length,
    synced: syncedPhotos.length,
    unsynced: unsyncedPhotos.length,
    primaryUnsyncedStep,
  };
}

/**
 * Thử tải lại một ảnh chưa đồng bộ lên Cloudflare R2
 * Tự động tìm nguồn: Base64 data URL, blob:http URL, và IndexedDB blob:local://
 */
export async function retryUploadMasterAreaPhoto(
  photoItem: MasterAreaPhotoAuditItem,
  parcelCode: string,
  unitCode: string,
  onSuccess: (newCloudUrl: string) => void
): Promise<void> {
  const isAlreadySynced =
    photoItem.isCloudUrl ||
    photoItem.url.startsWith('http://') ||
    photoItem.url.startsWith('https://') ||
    photoItem.url.startsWith('/uploads');

  if (isAlreadySynced) {
    onSuccess(photoItem.url);
    return;
  }

  let blob: Blob | null = null;
  let localId = extractLocalIdFromUri(photoItem.url);

  // Kiểm tra mapping bền vững đã upload từ trước
  if (localId) {
    const knownCloud = getKnownCloudUrl(localId);
    if (knownCloud) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('metro2:photo-promoted', {
            detail: { localId, publicUrl: knownCloud },
          })
        );
      }
      onSuccess(knownCloud);
      return;
    }
  }

  // 1. Nếu là chuỗi Base64 Data URL (VD: CAD trích xuất)
  if (photoItem.url.startsWith('data:image/')) {
    blob = base64ToBlob(photoItem.url);
    if (!localId || localId === photoItem.url) {
      localId = `cad_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
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
  else if (localId || photoItem.url.startsWith('blob:local://')) {
    const effectiveId = localId || extractLocalIdFromUri(photoItem.url);
    if (effectiveId) {
      const offlinePhoto = await getOfflinePhoto(effectiveId);
      if (offlinePhoto && offlinePhoto.blob) {
        blob = offlinePhoto.blob;
      }
    }
  }

  if (!blob) {
    throw new Error(
      'Dữ liệu ảnh gốc không có trên thiết bị này. Ảnh đang lưu tạm trong bộ nhớ của thiết bị đã chụp khảo sát trước đó. Vui lòng mở lại hồ sơ trên thiết bị đó có kết nối mạng để hoàn tất tải lên Cloud.'
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('metro2:photo-promoted', {
            detail: { localId: localId || photoItem.url, publicUrl },
          })
        );
      }
      onSuccess(publicUrl);
    },
  });
}
