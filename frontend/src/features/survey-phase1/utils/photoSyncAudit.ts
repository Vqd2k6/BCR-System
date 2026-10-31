import type { Phase1SurveyFormData } from '../types/phase1.types';
import { uploadQueue } from '../../../core/services/uploadQueueService';
import { getOfflinePhoto, extractLocalIdFromUri, getKnownCloudUrl, healLocalPhotoUris, isPersistedPhotoUrl } from '../../../core/storage/offlinePhotoStorage';

export interface SurveyPhotoAuditItem {
  id: string;
  step: number; // 1 to 8 (Wizard Step)
  stepTitle: string; // e.g., "Bước 1: Tiếp cận & Nhận diện"
  fieldTitle: string; // e.g., "Ảnh toàn cảnh mặt tiền (P01)"
  photoCode?: string;
  url: string;
  isCloudUrl: boolean;
  isBase64: boolean;
  isLocalBlob?: boolean;
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
  rawFormData: Phase1SurveyFormData,
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
  // Ảnh đã lên Cloud (có mapping bền) nhưng dữ liệu còn giữ blob:local:// -> tính là đã đồng bộ
  const formData = healLocalPhotoUris(rawFormData);
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

    let effectiveUrl = url;
    let isCloudUrl = isPersistedPhotoUrl(effectiveUrl);
    const isBase64 = effectiveUrl.startsWith('data:image/') && effectiveUrl.length > 200;
    let isLocalBlob = effectiveUrl.startsWith('blob:local://') || effectiveUrl.startsWith('blob:');

    // Nếu là local blob, kiểm tra xem đã có mapping R2 (từ thiết bị hoặc server) chưa
    if (isLocalBlob) {
      const localId = extractLocalIdFromUri(effectiveUrl);
      const knownCloud = getKnownCloudUrl(localId);
      if (knownCloud) {
        effectiveUrl = knownCloud;
        isCloudUrl = true;
        isLocalBlob = false;
        if (effectiveUrl !== url) {
          try {
            updateInStore(knownCloud);
          } catch (e) {
            console.warn('[photoSyncAudit] Failed to heal mapped photo in store:', e);
          }
        }
      }
    }

    // Ảnh được tính nếu là URL Cloud, ảnh Base64, hoặc ảnh lưu offline local
    if (!isCloudUrl && !isBase64 && !isLocalBlob) return;

    allPhotos.push({
      id,
      step,
      stepTitle,
      fieldTitle,
      photoCode,
      url: effectiveUrl,
      isCloudUrl,
      isBase64,
      isLocalBlob,
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

          // Ảnh bối cảnh vùng Z (CTX mặc định kế thừa từ ảnh tổng quan: cùng một ảnh chỉ tính 1 dòng)
          if (zone.ctxPhotoUrl) {
            const sharedOvIdx = Array.isArray(zone.overviewPhotos) ? zone.overviewPhotos.indexOf(zone.ctxPhotoUrl) : -1;
            checkAndAdd(
              `floor_${fi}_zone_${zi}_ctx`,
              3,
              s3Title,
              `Ảnh bối cảnh [${fName}] > [${zLabel}${rName}]${sharedOvIdx >= 0 ? ` (dùng chung ảnh tổng quan #${sharedOvIdx + 1})` : ''}`,
              zone.ctxPhotoUrl,
              zone.ctxPhotoCode,
              (newUrl) =>
                updateFormData((prev) => {
                  const floors = [...prev.floors];
                  if (floors[fi]?.zones?.[zi]) {
                    const zones = [...floors[fi].zones];
                    const curZone = { ...zones[zi], ctxPhotoUrl: newUrl };
                    // Ảnh tổng quan dùng chung với CTX không có dòng riêng, phải đồng bộ cùng lúc tại đây
                    if (Array.isArray(curZone.overviewPhotos)) {
                      const ovs = curZone.overviewPhotos.map((u) => (u === zone.ctxPhotoUrl ? newUrl : u));
                      if (!ovs[0]) ovs[0] = newUrl;
                      curZone.overviewPhotos = ovs;
                    }
                    zones[zi] = curZone;
                    floors[fi] = { ...floors[fi], zones };
                  }
                  return { ...prev, floors };
                })
            );
          }

          // Ảnh tổng quan vùng Z
          if (Array.isArray(zone.overviewPhotos)) {
            zone.overviewPhotos.forEach((ovUrl, pi) => {
              if (zone.ctxPhotoUrl && ovUrl === zone.ctxPhotoUrl) return;
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
                      const curZone = { ...zones[zi], overviewPhotos: ovs };
                      // Nếu là ảnh #1 và ctxPhotoUrl dùng chung ảnh này, cập nhật cả ctxPhotoUrl
                      if (pi === 0 && (!curZone.ctxPhotoUrl || curZone.ctxPhotoUrl === ovUrl)) {
                        curZone.ctxPhotoUrl = newUrl;
                      }
                      zones[zi] = curZone;
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
            const sharedOvIdx = Array.isArray(elem.overviewPhotos) ? elem.overviewPhotos.indexOf(elem.ctxPhotoUrl) : -1;
            checkAndAdd(
              `floor_${fi}_elem_${ei}_ctx`,
              3,
              s3Title,
              `Ảnh bối cảnh cấu kiện [${fName}] > [${eLabel}]${sharedOvIdx >= 0 ? ` (dùng chung ảnh tổng quan #${sharedOvIdx + 1})` : ''}`,
              elem.ctxPhotoUrl,
              elem.ctxPhotoCode,
              (newUrl) =>
                updateFormData((prev) => {
                  const floors = [...prev.floors];
                  if (floors[fi]?.structuralElements?.[ei]) {
                    const elems = [...floors[fi].structuralElements!];
                    const curElem = { ...elems[ei], ctxPhotoUrl: newUrl };
                    // Ảnh tổng quan dùng chung với CTX không có dòng riêng, phải đồng bộ cùng lúc tại đây
                    if (Array.isArray(curElem.overviewPhotos)) {
                      const ovs = curElem.overviewPhotos.map((u) => (u === elem.ctxPhotoUrl ? newUrl : u));
                      if (!ovs[0]) ovs[0] = newUrl;
                      curElem.overviewPhotos = ovs;
                    }
                    elems[ei] = curElem;
                    floors[fi] = { ...floors[fi], structuralElements: elems };
                  }
                  return { ...prev, floors };
                })
            );
          }

          // Ảnh tổng quan cấu kiện E
          if (Array.isArray(elem.overviewPhotos)) {
            elem.overviewPhotos.forEach((ovUrl, pi) => {
              if (elem.ctxPhotoUrl && ovUrl === elem.ctxPhotoUrl) return;
              checkAndAdd(
                `floor_${fi}_elem_${ei}_ov_${pi}`,
                3,
                s3Title,
                `Ảnh tổng quan cấu kiện [${fName}] > [${eLabel}] #${pi + 1}`,
                ovUrl,
                undefined,
                (newUrl) =>
                  updateFormData((prev) => {
                    const floors = [...prev.floors];
                    if (floors[fi]?.structuralElements?.[ei]?.overviewPhotos) {
                      const elems = [...floors[fi].structuralElements!];
                      const ovs = [...elems[ei].overviewPhotos];
                      ovs[pi] = newUrl;
                      const curElem = { ...elems[ei], overviewPhotos: ovs };
                      if (pi === 0 && (!curElem.ctxPhotoUrl || curElem.ctxPhotoUrl === ovUrl)) {
                        curElem.ctxPhotoUrl = newUrl;
                      }
                      elems[ei] = curElem;
                      floors[fi] = { ...floors[fi], structuralElements: elems };
                    }
                    return { ...prev, floors };
                  })
              );
            });
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
  // ==========================================
  // BƯỚC 1 (MỤC KHẢO SÁT LÚN LỆCH & NGHIÊNG CÔNG TRÌNH)
  // ==========================================
  const s1SettleTitle = 'Bước 1: Tiếp cận & Nhận diện (Lún lệch / Nghiêng)';

  // Lún lệch - Quét toàn bộ mảng ảnh minh chứng
  if (Array.isArray(formData.settlementTilt?.diffSettlement?.photos) && formData.settlementTilt.diffSettlement.photos.length > 0) {
    formData.settlementTilt.diffSettlement.photos.forEach((item, idx) => {
      if (item && item.url) {
        checkAndAdd(
          `settlement_diff_${idx}`,
          1,
          s1SettleTitle,
          `Ảnh bằng chứng lún lệch #${idx + 1}`,
          item.url,
          item.photoCode,
          (newUrl) =>
            updateFormData((prev) => {
              const currentPhotos = [...(prev.settlementTilt?.diffSettlement?.photos || [])];
              if (currentPhotos[idx]) {
                currentPhotos[idx] = { ...currentPhotos[idx], url: newUrl };
              }
              return {
                ...prev,
                settlementTilt: {
                  ...prev.settlementTilt,
                  diffSettlement: {
                    ...prev.settlementTilt?.diffSettlement,
                    photos: currentPhotos,
                    photoUrl: idx === 0 ? newUrl : (prev.settlementTilt?.diffSettlement?.photoUrl || newUrl),
                  },
                },
              };
            })
        );
      }
    });
  } else if (formData.settlementTilt?.diffSettlement?.photoUrl) {
    checkAndAdd(
      'settlement_diff',
      1,
      s1SettleTitle,
      'Ảnh bằng chứng lún lệch',
      formData.settlementTilt.diffSettlement.photoUrl,
      formData.settlementTilt.diffSettlement.photoCode,
      (newUrl) =>
        updateFormData((prev) => ({
          ...prev,
          settlementTilt: {
            ...prev.settlementTilt,
            diffSettlement: {
              ...prev.settlementTilt?.diffSettlement,
              photoUrl: newUrl,
            },
          },
        }))
    );
  }

  // Nghiêng công trình - Quét toàn bộ mảng ảnh minh chứng
  if (Array.isArray(formData.settlementTilt?.buildingTilt?.photos) && formData.settlementTilt.buildingTilt.photos.length > 0) {
    formData.settlementTilt.buildingTilt.photos.forEach((item, idx) => {
      if (item && item.url) {
        checkAndAdd(
          `settlement_tilt_${idx}`,
          1,
          s1SettleTitle,
          `Ảnh bằng chứng độ nghiêng #${idx + 1}`,
          item.url,
          item.photoCode,
          (newUrl) =>
            updateFormData((prev) => {
              const currentPhotos = [...(prev.settlementTilt?.buildingTilt?.photos || [])];
              if (currentPhotos[idx]) {
                currentPhotos[idx] = { ...currentPhotos[idx], url: newUrl };
              }
              return {
                ...prev,
                settlementTilt: {
                  ...prev.settlementTilt,
                  buildingTilt: {
                    ...prev.settlementTilt?.buildingTilt,
                    photos: currentPhotos,
                    photoUrl: idx === 0 ? newUrl : (prev.settlementTilt?.buildingTilt?.photoUrl || newUrl),
                  },
                },
              };
            })
        );
      }
    });
  } else if (formData.settlementTilt?.buildingTilt?.photoUrl) {
    checkAndAdd(
      'settlement_tilt',
      1,
      s1SettleTitle,
      'Ảnh bằng chứng độ nghiêng công trình',
      formData.settlementTilt.buildingTilt.photoUrl,
      formData.settlementTilt.buildingTilt.photoCode,
      (newUrl) =>
        updateFormData((prev) => ({
          ...prev,
          settlementTilt: {
            ...prev.settlementTilt,
            buildingTilt: {
              ...prev.settlementTilt?.buildingTilt,
              photoUrl: newUrl,
            },
          },
        }))
    );
  }

  // Độ võng kết cấu dầm / sàn (beamSagging)
  if (formData.settlementTilt?.beamSagging?.photoUrl) {
    checkAndAdd(
      'settlement_beam_sagging',
      1,
      s1SettleTitle,
      'Ảnh bằng chứng độ võng dầm / sàn',
      formData.settlementTilt.beamSagging.photoUrl,
      formData.settlementTilt.beamSagging.photoCode,
      (newUrl) =>
        updateFormData((prev) => ({
          ...prev,
          settlementTilt: {
            ...prev.settlementTilt,
            beamSagging: {
              ...prev.settlementTilt?.beamSagging,
              photoUrl: newUrl,
            },
          },
        }))
    );
  }

  // Hiện tượng bất thường khác (abnormalCase)
  if (Array.isArray(formData.settlementTilt?.abnormalCase?.photos) && formData.settlementTilt.abnormalCase.photos.length > 0) {
    formData.settlementTilt.abnormalCase.photos.forEach((item, idx) => {
      if (item && item.url) {
        checkAndAdd(
          `settlement_abnormal_${idx}`,
          1,
          s1SettleTitle,
          `Ảnh hiện tượng bất thường #${idx + 1}`,
          item.url,
          item.photoCode,
          (newUrl) =>
            updateFormData((prev) => {
              const currentPhotos = [...(prev.settlementTilt?.abnormalCase?.photos || [])];
              if (currentPhotos[idx]) {
                currentPhotos[idx] = { ...currentPhotos[idx], url: newUrl };
              }
              return {
                ...prev,
                settlementTilt: {
                  ...prev.settlementTilt,
                  abnormalCase: {
                    ...prev.settlementTilt?.abnormalCase,
                    photos: currentPhotos,
                    photoUrl: idx === 0 ? newUrl : (prev.settlementTilt?.abnormalCase?.photoUrl || newUrl),
                  },
                },
              };
            })
        );
      }
    });
  } else if (formData.settlementTilt?.abnormalCase?.photoUrl) {
    checkAndAdd(
      'settlement_abnormal',
      1,
      s1SettleTitle,
      'Ảnh hiện tượng bất thường',
      formData.settlementTilt.abnormalCase.photoUrl,
      formData.settlementTilt.abnormalCase.photoCode,
      (newUrl) =>
        updateFormData((prev) => ({
          ...prev,
          settlementTilt: {
            ...prev.settlementTilt,
            abnormalCase: {
              ...prev.settlementTilt?.abnormalCase,
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

  // ==========================================
  // LƯỚI AN TOÀN TỰ ĐỘNG (DEEP SAFETY NET SCANNER)
  // Quét đệ quy toàn bộ formData tìm bất kỳ ảnh blob:local:// hoặc Base64 nào
  // còn sót chưa được đưa vào danh sách kiểm toán, bảo đảm 100% không ảnh nào bị bỏ quên.
  // ==========================================
  const addedUrls = new Set(allPhotos.map((p) => p.url));

  const scanUnsyncedFallback = (target: unknown, path: string = ''): void => {
    if (!target) return;
    if (typeof target === 'string') {
      const isLocalBlob = target.startsWith('blob:local://') || (target.startsWith('blob:') && !target.startsWith('blob:http'));
      const isBase64 = target.startsWith('data:image/') && target.length > 200;

      if (isLocalBlob) {
        const localId = extractLocalIdFromUri(target);
        if (getKnownCloudUrl(localId)) {
          return; // Đã có ánh xạ Cloud bền vững
        }
      }

      if ((isLocalBlob || isBase64) && !addedUrls.has(target)) {
        addedUrls.add(target);
        checkAndAdd(
          `fallback_unsynced_${path || 'photo'}`,
          1,
          'Khảo sát hiện trường (Mục mở rộng)',
          `Ảnh chưa đồng bộ [${path || 'Mục mở rộng'}]`,
          target,
          undefined,
          (_newUrl) => {
            updateFormData((prev) => healLocalPhotoUris(prev));
          }
        );
      }
    } else if (Array.isArray(target)) {
      target.forEach((item, idx) => scanUnsyncedFallback(item, `${path}[${idx}]`));
    } else if (typeof target === 'object') {
      const obj = target as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        if (key === '_photoMappings' || key === 'polygonPoints' || key === 'floorSplits') continue;
        scanUnsyncedFallback(obj[key], path ? `${path}.${key}` : key);
      }
    }
  };

  scanUnsyncedFallback(formData);

  const unsyncedPhotos = allPhotos.filter((p) => !p.isCloudUrl);
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
 * Tải lại một ảnh (Base64 hoặc Blob Offline từ IndexedDB) lên Cloudflare R2 và tự động gán vào formData
 */
export async function retryUploadSinglePhoto(
  item: SurveyPhotoAuditItem,
  parcelCode: string
): Promise<string> {
  if (item.isCloudUrl) return item.url;

  let blob: Blob | null = null;
  let retryLocalId: string | undefined;

  if (item.isLocalBlob) {
    const localId = extractLocalIdFromUri(item.url);
    retryLocalId = item.url.startsWith('blob:local://') ? localId : undefined;

    // Ảnh này thực ra ĐÃ lên Cloud (mapping bền) nhưng dữ liệu còn giữ URL tạm -> gán lại ngay, không cần blob
    const knownCloud = retryLocalId ? getKnownCloudUrl(retryLocalId) : null;
    if (knownCloud) {
      item.updateInStore(knownCloud);
      return knownCloud;
    }

    const record = await getOfflinePhoto(localId);

    // Ảnh đã lên Cloud nhưng mất mapping: dùng lại URL cũ, không upload lại để tránh tạo object trùng
    if (record?.cloudUrl && retryLocalId) {
      await uploadQueue.promoteUrlInStores(retryLocalId, record.cloudUrl, record.metadata);
      item.updateInStore(record.cloudUrl);
      return record.cloudUrl;
    }

    if (record && record.blob) {
      blob = record.blob;
    } else if (item.url.startsWith('blob:http')) {
      try {
        const resp = await fetch(item.url);
        if (resp.ok) {
          blob = await resp.blob();
        }
      } catch (err) {
        console.error('[photoSyncAudit:RetryUpload] Không đọc được Blob URL của ảnh:', err);
      }
    }
  } else if (item.isBase64) {
    blob = base64ToBlob(item.url);
  }

  if (!blob) {
    const { usePhase1SurveyStore } = await import('../store/usePhase1SurveyStore');
    await usePhase1SurveyStore.getState().recoverUnsyncedPhotos();
    const recoveredUrl = retryLocalId ? getKnownCloudUrl(retryLocalId) : null;
    if (recoveredUrl) {
      item.updateInStore(recoveredUrl);
      return recoveredUrl;
    }

    const { isSubmitted, photoRecovery } = usePhase1SurveyStore.getState();
    if (isSubmitted) {
      throw new Error('Hồ sơ đã nộp nên không thể tự gắn lại ảnh. Thiết bị này không có ảnh gốc, vui lòng liên hệ Zone Admin.');
    }
    throw new Error(
      photoRecovery.status === 'UNAVAILABLE'
        ? 'Thiết bị này không có ảnh gốc và chưa kết nối được kho lưu trữ để tìm ảnh. Ảnh chưa bị mất, vui lòng liên hệ Zone Admin.'
        : 'Thiết bị này không có ảnh gốc và hệ thống chưa tìm thấy ảnh khớp trên kho lưu trữ. Vui lòng liên hệ Zone Admin.'
    );
  }

  const prefix = item.photoCode
    ? item.photoCode.replace(/[^a-zA-Z0-9_-]/g, '_')
    : `photo_${parcelCode || 'survey'}`;
  const filename = `${prefix}_${Date.now()}.jpg`;

  return new Promise((resolve, reject) => {
    uploadQueue.enqueue(blob!, filename, {
      id: retryLocalId,
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
