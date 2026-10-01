import { Phase1SurveyFormData } from '../types/phase1.types';
import { uploadQueue } from '../../../core/services/uploadQueueService';

export interface SurveyPhotoAuditItem {
  id: string;
  step: number; // 1 to 8 (Wizard Step)
  stepTitle: string; // e.g., "Bước 1: Tiếp cận & Nhận diện"
  fieldTitle: string; // e.g., "Ảnh toàn cảnh mặt tiền (P01)"
  photoCode?: string;
  url: string;
  isCloudUrl: boolean;
  isBase64: boolean;
  isUploading: boolean;
  isError: boolean;
  updateInStore: (newUrl: string) => void;
}

/**
 * Chuyển chuỗi Base64 Data URL thành nhị phân Blob
 */
export function base64ToBlob(dataUrl: string, fallbackMime = 'image/jpeg'): Blob {
  const parts = dataUrl.split(';base64,');
  const contentType = parts[0]?.replace(/^data:/, '') || fallbackMime;
  const base64Data = parts[1] || parts[0];
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

/**
 * Quét toàn bộ dữ liệu khảo sát và trả về danh sách kiểm toán ảnh chi tiết
 */
export function auditSurveyPhotos(
  formData: Phase1SurveyFormData,
  updateFormData: (updater: Partial<Phase1SurveyFormData> | ((prev: Phase1SurveyFormData) => Phase1SurveyFormData)) => void
): {
  allPhotos: SurveyPhotoAuditItem[];
  unsyncedPhotos: SurveyPhotoAuditItem[];
  syncedPhotos: SurveyPhotoAuditItem[];
  totalPhotos: number;
  syncedPhotosCount: number;
  unsyncedPhotosCount: number;
  uploadingCount: number;
} {
  const allPhotos: SurveyPhotoAuditItem[] = [];

  const checkAndAdd = (
    id: string,
    step: number,
    stepTitle: string,
    fieldTitle: string,
    url: string | undefined | null,
    photoCode: string | undefined,
    updateInStore: (newUrl: string) => void
  ) => {
    if (!url || typeof url !== 'string' || url.trim() === '') return;

    const isCloudUrl = url.startsWith('http') || url.startsWith('/uploads');
    const isBase64 = url.startsWith('data:image/') && url.length > 200;

    // Ảnh được tính nếu là URL Cloud hoặc ảnh Base64
    if (!isCloudUrl && !isBase64) return;

    allPhotos.push({
      id,
      step,
      stepTitle,
      fieldTitle,
      photoCode,
      url,
      isCloudUrl,
      isBase64,
      isUploading: false, // sẽ cập nhật theo uploadQueue bên dưới
      isError: false,
      updateInStore,
    });
  };

  // ==========================================
  // BƯỚC 1: TIẾP CẬN & NHẬN DIỆN CÔNG TRÌNH
  // ==========================================
  const s1Title = 'Bước 1: Tiếp cận & Nhận diện';

  // P01: Mặt tiền
  if (formData.photoP01?.url) {
    checkAndAdd(
      'step1_p01',
      1,
      s1Title,
      'Toàn cảnh mặt tiền (P01)',
      formData.photoP01.url,
      formData.photoP01.photoCode,
      (newUrl) =>
        updateFormData((prev) => ({
          ...prev,
          photoP01: { ...prev.photoP01, url: newUrl },
        }))
    );
  }

  // P02: Số nhà & mặt đứng
  if (formData.photoP02?.url) {
    checkAndAdd(
      'step1_p02',
      1,
      s1Title,
      'Hiện trạng số nhà & mặt đứng (P02)',
      formData.photoP02.url,
      formData.photoP02.photoCode,
      (newUrl) =>
        updateFormData((prev) => ({
          ...prev,
          photoP02: { ...prev.photoP02, url: newUrl },
        }))
    );
  }

  // P03: Cột mốc / Tọa độ tim tuyến
  if (formData.photoP03?.url) {
    checkAndAdd(
      'step1_p03',
      1,
      s1Title,
      'Cột mốc & Tim tuyến Metro 2 (P03)',
      formData.photoP03.url,
      formData.photoP03.photoCode,
      (newUrl) =>
        updateFormData((prev) => ({
          ...prev,
          photoP03: { ...prev.photoP03, url: newUrl },
        }))
    );
  }

  // P03: Ảnh bổ sung
  if (Array.isArray(formData.photoP03?.additionalPhotos)) {
    formData.photoP03.additionalPhotos.forEach((item, idx) => {
      checkAndAdd(
        `step1_p03_extra_${idx}`,
        1,
        s1Title,
        `Ảnh bổ sung mốc tim tuyến #${idx + 1} (${item.tag || 'Mốc'})`,
        item.url,
        item.photoCode,
        (newUrl) =>
          updateFormData((prev) => {
            const list = [...(prev.photoP03?.additionalPhotos || [])];
            if (list[idx]) list[idx] = { ...list[idx], url: newUrl };
            return {
              ...prev,
              photoP03: { ...prev.photoP03, additionalPhotos: list },
            };
          })
      );
    });
  }

  // P04: Lề đường / Hạ tầng
  if (formData.photoP04?.url) {
    checkAndAdd(
      'step1_p04',
      1,
      s1Title,
      'Hiện trạng lề đường & Hạ tầng (P04)',
      formData.photoP04.url,
      formData.photoP04.photoCode,
      (newUrl) =>
        updateFormData((prev) => ({
          ...prev,
          photoP04: { ...prev.photoP04, url: newUrl },
        }))
    );
  }

  // Ảnh biên bản vắng nhà (nếu có)
  if (Array.isArray(formData.absenteeMinutesPhotos)) {
    formData.absenteeMinutesPhotos.forEach((url, idx) => {
      checkAndAdd(
        `step1_absentee_${idx}`,
        1,
        s1Title,
        `Biên bản vắng nhà / hoãn khảo sát #${idx + 1}`,
        url,
        undefined,
        (newUrl) =>
          updateFormData((prev) => {
            const list = [...(prev.absenteeMinutesPhotos || [])];
            list[idx] = newUrl;
            return { ...prev, absenteeMinutesPhotos: list };
          })
      );
    });
  }

  // Ảnh công trình đang thi công (nếu có)
  if (Array.isArray(formData.underConstructionPhotos)) {
    formData.underConstructionPhotos.forEach((url, idx) => {
      checkAndAdd(
        `step1_construction_${idx}`,
        1,
        s1Title,
        `Ảnh công trình đang thi công #${idx + 1}`,
        url,
        undefined,
        (newUrl) =>
          updateFormData((prev) => {
            const list = [...(prev.underConstructionPhotos || [])];
            list[idx] = newUrl;
            return { ...prev, underConstructionPhotos: list };
          })
      );
    });
  }

  // Ảnh đất trống (nếu có)
  if (Array.isArray(formData.vacantLandPhotos)) {
    formData.vacantLandPhotos.forEach((url, idx) => {
      checkAndAdd(
        `step1_vacant_${idx}`,
        1,
        s1Title,
        `Ảnh hiện trạng đất trống #${idx + 1}`,
        url,
        undefined,
        (newUrl) =>
          updateFormData((prev) => {
            const list = [...(prev.vacantLandPhotos || [])];
            list[idx] = newUrl;
            return { ...prev, vacantLandPhotos: list };
          })
      );
    });
  }

  // ==========================================
  // BƯỚC 2: PHỎNG VẤN CHỦ HỘ & KẾT CẤU CÔNG TRÌNH
  // ==========================================
  const s2Title = 'Bước 2: Phỏng vấn & Kết cấu';

  if (formData.asBuiltDrawingPhotoUrl) {
    checkAndAdd(
      'step2_asbuilt',
      2,
      s2Title,
      'Ảnh bản vẽ hoàn công / Kết cấu',
      formData.asBuiltDrawingPhotoUrl,
      undefined,
      (newUrl) => updateFormData({ asBuiltDrawingPhotoUrl: newUrl })
    );
  }

  if (Array.isArray(formData.asBuiltDrawingPhotos)) {
    formData.asBuiltDrawingPhotos.forEach((item, idx) => {
      checkAndAdd(
        `step2_asbuilt_extra_${idx}`,
        2,
        s2Title,
        `Ảnh bản vẽ hoàn công #${idx + 1}`,
        item.url,
        item.photoCode,
        (newUrl) =>
          updateFormData((prev) => {
            const list = [...(prev.asBuiltDrawingPhotos || [])];
            if (list[idx]) list[idx] = { ...list[idx], url: newUrl };
            return { ...prev, asBuiltDrawingPhotos: list };
          })
      );
    });
  }

  // ==========================================
  // BƯỚC 3: KHẢO SÁT CÁC TẦNG & VẾT NỨT
  // ==========================================
  const s3Title = 'Bước 3: Khảo sát các tầng';

  if (Array.isArray(formData.floors)) {
    formData.floors.forEach((floor, fi) => {
      const fName = floor.floorName || `Tầng ${fi + 1}`;

      // Sơ đồ CAD kiến trúc
      if (floor.cadSketchPhotoUrl) {
        checkAndAdd(
          `floor_${fi}_cad_arch`,
          3,
          s3Title,
          `Sơ đồ CAD kiến trúc [${fName}]`,
          floor.cadSketchPhotoUrl,
          undefined,
          (newUrl) =>
            updateFormData((prev) => {
              const floors = [...prev.floors];
              if (floors[fi]) floors[fi] = { ...floors[fi], cadSketchPhotoUrl: newUrl };
              return { ...prev, floors };
            })
        );
      }

      // Sơ đồ CAD kết cấu (chỉ kiểm tra nếu tầng không được miễn khảo sát kết cấu)
      if (floor.hasStructuralElements !== false && floor.cadStructuralSketchPhotoUrl) {
        checkAndAdd(
          `floor_${fi}_cad_struct`,
          3,
          s3Title,
          `Sơ đồ CAD kết cấu [${fName}]`,
          floor.cadStructuralSketchPhotoUrl,
          undefined,
          (newUrl) =>
            updateFormData((prev) => {
              const floors = [...prev.floors];
              if (floors[fi]) floors[fi] = { ...floors[fi], cadStructuralSketchPhotoUrl: newUrl };
              return { ...prev, floors };
            })
        );
      }

      // Ảnh tổng quan tầng
      if (Array.isArray(floor.overviewPhotos)) {
        floor.overviewPhotos.forEach((item, pi) => {
          checkAndAdd(
            `floor_${fi}_overview_${pi}`,
            3,
            s3Title,
            `Ảnh tổng quan [${fName}] #${pi + 1}`,
            item.url,
            item.photoCode,
            (newUrl) =>
              updateFormData((prev) => {
                const floors = [...prev.floors];
                if (floors[fi] && floors[fi].overviewPhotos?.[pi]) {
                  const ovs = [...floors[fi].overviewPhotos];
                  ovs[pi] = { ...ovs[pi], url: newUrl };
                  floors[fi] = { ...floors[fi], overviewPhotos: ovs };
                }
                return { ...prev, floors };
              })
          );
        });
      }

      // Vùng hư hại kiến trúc Z
      if (Array.isArray(floor.zones)) {
        floor.zones.forEach((zone, zi) => {
          const zLabel = zone.zoneCode || `Vùng Z-${zi + 1}`;
          const rName = zone.roomName ? ` (${zone.roomName})` : '';

          // Ảnh bối cảnh vùng Z
          if (zone.ctxPhotoUrl) {
            checkAndAdd(
              `floor_${fi}_zone_${zi}_ctx`,
              3,
              s3Title,
              `Ảnh bối cảnh [${fName}] > [${zLabel}${rName}]`,
              zone.ctxPhotoUrl,
              zone.ctxPhotoCode,
              (newUrl) =>
                updateFormData((prev) => {
                  const floors = [...prev.floors];
                  if (floors[fi]?.zones?.[zi]) {
                    const zones = [...floors[fi].zones];
                    zones[zi] = { ...zones[zi], ctxPhotoUrl: newUrl };
                    floors[fi] = { ...floors[fi], zones };
                  }
                  return { ...prev, floors };
                })
            );
          }

          // Ảnh tổng quan vùng Z
          if (Array.isArray(zone.overviewPhotos)) {
            zone.overviewPhotos.forEach((ovUrl, pi) => {
              checkAndAdd(
                `floor_${fi}_zone_${zi}_ov_${pi}`,
                3,
                s3Title,
                `Ảnh tổng quan [${fName}] > [${zLabel}] #${pi + 1}`,
                ovUrl,
                undefined,
                (newUrl) =>
                  updateFormData((prev) => {
                    const floors = [...prev.floors];
                    if (floors[fi]?.zones?.[zi]?.overviewPhotos) {
                      const zones = [...floors[fi].zones];
                      const ovs = [...zones[zi].overviewPhotos];
                      ovs[pi] = newUrl;
                      zones[zi] = { ...zones[zi], overviewPhotos: ovs };
                      floors[fi] = { ...floors[fi], zones };
                    }
                    return { ...prev, floors };
                  })
              );
            });
          }

          // Khuyết tật / Vết nứt D của vùng Z
          if (Array.isArray(zone.defects)) {
            zone.defects.forEach((defect, di) => {
              const dLabel = defect.defectCode || `Khuyết tật #${di + 1}`;
              const cuList: string[] = Array.isArray(defect.cuPhotos) && defect.cuPhotos.length > 0
                ? defect.cuPhotos
                : (defect.cuPhotoUrl ? [defect.cuPhotoUrl] : []);
              const codeList: string[] = Array.isArray(defect.cuPhotoCodes) && defect.cuPhotoCodes.length > 0
                ? defect.cuPhotoCodes
                : (defect.cuPhotoCode ? [defect.cuPhotoCode] : []);

              cuList.forEach((photoUrl, pIdx) => {
                if (photoUrl) {
                  const pSuffix = cuList.length > 1 ? ` (Ảnh #${pIdx + 1})` : '';
                  checkAndAdd(
                    `floor_${fi}_zone_${zi}_defect_${di}_photo_${pIdx}`,
                    3,
                    s3Title,
                    `Vết nứt/Khuyết tật [${dLabel}]${pSuffix} tại [${fName} > ${zLabel}]`,
                    photoUrl,
                    codeList[pIdx] || defect.cuPhotoCode,
                    (newUrl) =>
                      updateFormData((prev) => {
                        const floors = [...prev.floors];
                        if (floors[fi]?.zones?.[zi]?.defects?.[di]) {
                          const zones = [...floors[fi].zones];
                          const defects = [...zones[zi].defects];
                          const curDefect = { ...defects[di] };
                          const nextCuPhotos = Array.isArray(curDefect.cuPhotos) && curDefect.cuPhotos.length > 0
                            ? [...curDefect.cuPhotos]
                            : (curDefect.cuPhotoUrl ? [curDefect.cuPhotoUrl] : []);
                          nextCuPhotos[pIdx] = newUrl;
                          curDefect.cuPhotos = nextCuPhotos;
                          if (pIdx === 0) {
                            curDefect.cuPhotoUrl = newUrl;
                          }
                          defects[di] = curDefect;
                          zones[zi] = { ...zones[zi], defects };
                          floors[fi] = { ...floors[fi], zones };
                        }
                        return { ...prev, floors };
                      })
                  );
                }
              });
            });
          }
        });
      }

      // Cấu kiện kết cấu E (chỉ kiểm tra nếu tầng không được miễn khảo sát kết cấu)
      if (floor.hasStructuralElements !== false && Array.isArray(floor.structuralElements)) {
        floor.structuralElements.forEach((elem, ei) => {
          const eLabel = elem.elementCode || `Cấu kiện E-${ei + 1}`;

          if (elem.ctxPhotoUrl) {
            checkAndAdd(
              `floor_${fi}_elem_${ei}_ctx`,
              3,
              s3Title,
              `Ảnh bối cảnh cấu kiện [${fName}] > [${eLabel}]`,
              elem.ctxPhotoUrl,
              elem.ctxPhotoCode,
              (newUrl) =>
                updateFormData((prev) => {
                  const floors = [...prev.floors];
                  if (floors[fi]?.structuralElements?.[ei]) {
                    const elems = [...floors[fi].structuralElements!];
                    elems[ei] = { ...elems[ei], ctxPhotoUrl: newUrl };
                    floors[fi] = { ...floors[fi], structuralElements: elems };
                  }
                  return { ...prev, floors };
                })
            );
          }

          if (Array.isArray(elem.defects)) {
            elem.defects.forEach((defect, di) => {
              const dLabel = defect.defectCode || `Khuyết tật #${di + 1}`;
              const cuList: string[] = Array.isArray(defect.cuPhotos) && defect.cuPhotos.length > 0
                ? defect.cuPhotos
                : (defect.cuPhotoUrl ? [defect.cuPhotoUrl] : []);
              const codeList: string[] = Array.isArray(defect.cuPhotoCodes) && defect.cuPhotoCodes.length > 0
                ? defect.cuPhotoCodes
                : (defect.cuPhotoCode ? [defect.cuPhotoCode] : []);

              cuList.forEach((photoUrl, pIdx) => {
                if (photoUrl) {
                  const pSuffix = cuList.length > 1 ? ` (Ảnh #${pIdx + 1})` : '';
                  checkAndAdd(
                    `floor_${fi}_elem_${ei}_defect_${di}_photo_${pIdx}`,
                    3,
                    s3Title,
                    `Khuyết tật kết cấu [${dLabel}]${pSuffix} tại [${fName} > ${eLabel}]`,
                    photoUrl,
                    codeList[pIdx] || defect.cuPhotoCode,
                    (newUrl) =>
                      updateFormData((prev) => {
                        const floors = [...prev.floors];
                        if (floors[fi]?.structuralElements?.[ei]?.defects?.[di]) {
                          const elems = [...floors[fi].structuralElements!];
                          const defects = [...elems[ei].defects];
                          const curDefect = { ...defects[di] };
                          const nextCuPhotos = Array.isArray(curDefect.cuPhotos) && curDefect.cuPhotos.length > 0
                            ? [...curDefect.cuPhotos]
                            : (curDefect.cuPhotoUrl ? [curDefect.cuPhotoUrl] : []);
                          nextCuPhotos[pIdx] = newUrl;
                          curDefect.cuPhotos = nextCuPhotos;
                          if (pIdx === 0) {
                            curDefect.cuPhotoUrl = newUrl;
                          }
                          defects[di] = curDefect;
                          elems[ei] = { ...elems[ei], defects };
                          floors[fi] = { ...floors[fi], structuralElements: elems };
                        }
                        return { ...prev, floors };
                      })
                  );
                }
              });
            });
          }
        });
      }
    });
  }

  // ==========================================
  // BƯỚC 5: BIẾN DẠNG, LÚN LỆCH, NGHIÊNG
  // ==========================================
  const s5Title = 'Bước 5: Biến dạng nứt lún';

  // Lún lệch
  if (formData.settlementTilt?.diffSettlement?.photoUrl) {
    checkAndAdd(
      'settlement_diff',
      5,
      s5Title,
      'Ảnh bằng chứng lún lệch',
      formData.settlementTilt.diffSettlement.photoUrl,
      formData.settlementTilt.diffSettlement.photoCode,
      (newUrl) =>
        updateFormData((prev) => ({
          ...prev,
          settlementTilt: {
            ...prev.settlementTilt,
            diffSettlement: {
              ...prev.settlementTilt.diffSettlement,
              photoUrl: newUrl,
            },
          },
        }))
    );
  }

  // Nghiêng công trình
  if (formData.settlementTilt?.buildingTilt?.photoUrl) {
    checkAndAdd(
      'settlement_tilt',
      5,
      s5Title,
      'Ảnh bằng chứng độ nghiêng công trình',
      formData.settlementTilt.buildingTilt.photoUrl,
      formData.settlementTilt.buildingTilt.photoCode,
      (newUrl) =>
        updateFormData((prev) => ({
          ...prev,
          settlementTilt: {
            ...prev.settlementTilt,
            buildingTilt: {
              ...prev.settlementTilt.buildingTilt,
              photoUrl: newUrl,
            },
          },
        }))
    );
  }

  // ==========================================
  // BƯỚC 8: KÝ BIÊN BẢN & BIÊN BẢN LÀM VIỆC HIỆN TRƯỜNG
  // ==========================================
  const s8Title = 'Bước 8: Ký biên bản hiện trường';

  if (Array.isArray(formData.signatures?.workingMinutesPhotos)) {
    formData.signatures.workingMinutesPhotos.forEach((url, idx) => {
      checkAndAdd(
        `signatures_minutes_${idx}`,
        8,
        s8Title,
        `Ảnh chụp biên bản làm việc hiện trường trang ${idx + 1}`,
        url,
        undefined,
        (newUrl) =>
          updateFormData((prev) => {
            const list = [...(prev.signatures.workingMinutesPhotos || [])];
            list[idx] = newUrl;
            return {
              ...prev,
              signatures: { ...prev.signatures, workingMinutesPhotos: list },
            };
          })
      );
    });
  }

  if (formData.signatures?.preparedBy?.photoUrl) {
    checkAndAdd(
      'signatures_prepared_by',
      8,
      s8Title,
      'Chữ ký / Ảnh KSV lập biên bản',
      formData.signatures.preparedBy.photoUrl,
      undefined,
      (newUrl) =>
        updateFormData((prev) => ({
          ...prev,
          signatures: {
            ...prev.signatures,
            preparedBy: { ...prev.signatures.preparedBy, photoUrl: newUrl },
          },
        }))
    );
  }

  if (formData.signatures?.ownerRepresentative?.photoUrl) {
    checkAndAdd(
      'signatures_owner',
      8,
      s8Title,
      'Chữ ký / Ảnh đại diện chủ hộ',
      formData.signatures.ownerRepresentative.photoUrl,
      undefined,
      (newUrl) =>
        updateFormData((prev) => ({
          ...prev,
          signatures: {
            ...prev.signatures,
            ownerRepresentative: {
              ...prev.signatures.ownerRepresentative,
              photoUrl: newUrl,
            },
          },
        }))
    );
  }

  const unsyncedPhotos = allPhotos.filter((p) => p.isBase64 && !p.isCloudUrl);
  const syncedPhotos = allPhotos.filter((p) => p.isCloudUrl);

  return {
    allPhotos,
    unsyncedPhotos,
    syncedPhotos,
    totalPhotos: allPhotos.length,
    syncedPhotosCount: syncedPhotos.length,
    unsyncedPhotosCount: unsyncedPhotos.length,
    uploadingCount: uploadQueue.getPendingAndActiveCount(),
  };
}

/**
 * Tải lại một ảnh Base64 lên Cloudflare R2 và tự động gán vào formData
 */
export async function retryUploadSinglePhoto(
  item: SurveyPhotoAuditItem,
  parcelCode: string
): Promise<string> {
  if (!item.isBase64 || item.isCloudUrl) return item.url;

  const blob = base64ToBlob(item.url);
  const prefix = item.photoCode
    ? item.photoCode.replace(/[^a-zA-Z0-9_-]/g, '_')
    : `photo_${parcelCode || 'survey'}`;
  const filename = `${prefix}_${Date.now()}.jpg`;

  return new Promise((resolve, reject) => {
    uploadQueue.enqueue(blob, filename, {
      folder: `surveys/${parcelCode || 'general'}`,
      mimeType: 'image/jpeg',
      onSuccess: (publicUrl) => {
        item.updateInStore(publicUrl);
        resolve(publicUrl);
      },
      onError: (err) => {
        reject(err);
      },
    });
  });
}
