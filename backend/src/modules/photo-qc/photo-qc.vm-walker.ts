/**
 * ============================================================================
 * PHOTO QC – DUYỆT ẢNH TRÊN VIEWMODEL REPORT
 * Một danh sách duy nhất các ô ảnh mà report in ra (bìa, Phụ lục 1, Mục V, khuyết tật,
 * ảnh tổng quan phòng). Dùng cho cả màn rà soát và bước cắt/dập dấu khi render,
 * nên hai nơi luôn cùng khoá ô, cùng mã ảnh và cùng ngày giờ watermark.
 * Không gồm sơ đồ CAD, bản scan biên bản, bản vẽ hoàn công (không phải ảnh hiện trường).
 * ============================================================================
 */

import type { ReportViewModel } from '../report/report.types';
import { normalizeMetroPhotoCode } from '../report/utils/metro-photo-code.utils';
import { assignSlotKeys, urlPhotoKey } from './photo-qc.rules';

export type VmPhotoSection = 'COVER' | 'P' | 'SECTION5' | 'DEFECT' | 'OVERVIEW' | 'CAD';

export interface VmPhotoRef {
  section: VmPhotoSection;
  /** Khoá ô: mã Phụ lục 1 (`P-02`, `P-03#2`) hoặc `U:<băm URL>`. Bìa dùng khoá `COVER`. */
  photoKey: string;
  url: string;
  label: string;
  rotation: number;
  /** Ngày giờ và mã ảnh in trên watermark, đúng như ReportWatermarkCanvasService dùng. */
  dateTimeText: string;
  photoCodeText: string;
  getBase64(): string | undefined;
  setBase64(value: string): void;
  isWatermarked(): boolean;
  markWatermarked(): void;
  /** Điểm ghim Vùng Z hoặc Cấu kiện E trên sơ đồ CAD (nếu có). */
  pins?: Array<{ code: string; pinX: number; pinY: number; type: string }>;
  /** Callback tái chiếu tọa độ điểm ghim khi ảnh bị crop. */
  onCropApplied?: (crop: { x: number; y: number; w: number; h: number }) => void;
}

export function walkViewModelPhotos(vm: ReportViewModel): VmPhotoRef[] {
  const refs: VmPhotoRef[] = [];
  const defaultDate = vm.metadata?.surveyDateFormatted || '';
  const parcel = vm.metadata?.projectParcelCode || vm.metadata?.buildingId || 'CHƯA_ĐỊNH_DANH';
  const unit = vm.metadata?.unitCode;
  const code = (raw: string) => normalizeMetroPhotoCode(raw, parcel, unit);

  const appendix1 = vm.appendix1 || [];
  const slotKeys = assignSlotKeys(appendix1.map((p) => p.photoCode));

  const meta = vm.metadata;
  if (meta?.coverPhotoUrl) {
    const p02Item = appendix1.find((p) => p.photoCode === 'P-02');
    refs.push({
      section: 'COVER',
      photoKey: 'COVER',
      url: meta.coverPhotoUrl,
      label: 'Ảnh bìa báo cáo',
      rotation: 0,
      dateTimeText: meta.coverWatermarkDateTime || p02Item?.watermarkDateTime || defaultDate,
      photoCodeText: meta.coverWatermarkCode || code('P02_MAIN'),
      getBase64: () => meta.coverPhotoBase64,
      setBase64: (v) => { meta.coverPhotoBase64 = v; },
      isWatermarked: () => Boolean(meta.coverAlreadyWatermarked),
      markWatermarked: () => { meta.coverAlreadyWatermarked = true; },
    });
  }

  appendix1.forEach((item, idx) => {
    if (!item.url) return;
    refs.push({
      section: 'P',
      photoKey: slotKeys[idx],
      url: item.url,
      label: `${item.photoCode} • ${item.name?.vi || ''}`.trim(),
      rotation: Number(item.rotation) || 0,
      dateTimeText: item.watermarkDateTime || item.capturedAt || defaultDate,
      photoCodeText: item.metroPhotoCode || code(item.originalTag || item.photoCode),
      getBase64: () => item.base64,
      setBase64: (v) => { item.base64 = v; },
      isWatermarked: () => Boolean(item.alreadyWatermarked),
      markWatermarked: () => { item.alreadyWatermarked = true; },
    });
  });

  const s5 = vm.section5;
  const tilt = s5?.tiltPhoto;
  if (tilt?.url) {
    refs.push({
      section: 'SECTION5',
      photoKey: urlPhotoKey(tilt.url),
      url: tilt.url,
      label: 'Mục V • Ảnh kiểm tra nghiêng',
      rotation: 0,
      dateTimeText: defaultDate,
      photoCodeText: code('EXT_TILT_01'),
      getBase64: () => tilt.base64,
      setBase64: (v) => { tilt.base64 = v; },
      isWatermarked: () => Boolean(tilt.alreadyWatermarked),
      markWatermarked: () => { tilt.alreadyWatermarked = true; },
    });
  }
  const settle = s5?.settlementPhoto;
  if (settle?.url) {
    refs.push({
      section: 'SECTION5',
      photoKey: urlPhotoKey(settle.url),
      url: settle.url,
      label: 'Mục V • Ảnh khảo sát lún',
      rotation: 0,
      dateTimeText: defaultDate,
      photoCodeText: code('FOUND_SETTLE_01'),
      getBase64: () => settle.base64,
      setBase64: (v) => { settle.base64 = v; },
      isWatermarked: () => Boolean(settle.alreadyWatermarked),
      markWatermarked: () => { settle.alreadyWatermarked = true; },
    });
  }

  for (const fl of vm.appendix2 || []) {
    const floorLabel = fl.floorName?.vi || `Tầng ${fl.floorOrder}`;
    const floorCode = `F${String(fl.floorOrder).padStart(2, '0')}`;

    if (fl.damageMapUrl) {
      const cadUrl = fl.damageMapUrl;
      const cadRot = Number(fl.damageMapRotation) || 0;
      refs.push({
        section: 'CAD',
        photoKey: urlPhotoKey(cadUrl),
        url: cadUrl,
        label: `${floorLabel} • Sơ đồ mặt bằng kiến trúc`,
        rotation: cadRot,
        dateTimeText: defaultDate,
        photoCodeText: fl.damageMapWatermarkCode || code(`${floorCode}_CAD_ARCH`),
        getBase64: () => fl.damageMapBase64,
        setBase64: (v) => { fl.damageMapBase64 = v; },
        isWatermarked: () => Boolean(fl.damageMapAlreadyWatermarked),
        markWatermarked: () => { fl.damageMapAlreadyWatermarked = true; },
        pins: fl.cadPins?.map((p) => ({ code: p.code, pinX: p.pinX, pinY: p.pinY, type: p.typeLower || p.type })),
        onCropApplied: (crop) => {
          if (crop && crop.w > 0 && crop.h > 0 && Array.isArray(fl.cadPins)) {
            for (const pin of fl.cadPins) {
              const newX = (pin.pinX - crop.x * 100) / crop.w;
              const newY = (pin.pinY - crop.y * 100) / crop.h;
              pin.pinX = Math.max(1, Math.min(99, Math.round(newX * 100) / 100));
              pin.pinY = Math.max(1, Math.min(99, Math.round(newY * 100) / 100));
            }
          }
        },
      });
    }

    if (fl.hasStructuralCadMap && fl.structuralMapUrl && fl.structuralMapUrl !== fl.damageMapUrl) {
      const cadUrl = fl.structuralMapUrl;
      const cadRot = Number(fl.structuralMapRotation) || 0;
      refs.push({
        section: 'CAD',
        photoKey: urlPhotoKey(cadUrl),
        url: cadUrl,
        label: `${floorLabel} • Sơ đồ kết cấu`,
        rotation: cadRot,
        dateTimeText: defaultDate,
        photoCodeText: fl.structuralMapWatermarkCode || code(`${floorCode}_CAD_STRUCT`),
        getBase64: () => fl.structuralMapBase64,
        setBase64: (v) => { fl.structuralMapBase64 = v; },
        isWatermarked: () => Boolean(fl.structuralMapAlreadyWatermarked),
        markWatermarked: () => { fl.structuralMapAlreadyWatermarked = true; },
        pins: fl.cadStructuralPins?.map((p) => ({ code: p.code, pinX: p.pinX, pinY: p.pinY, type: p.typeLower || p.type })),
        onCropApplied: (crop) => {
          if (crop && crop.w > 0 && crop.h > 0 && Array.isArray(fl.cadStructuralPins)) {
            for (const pin of fl.cadStructuralPins) {
              const newX = (pin.pinX - crop.x * 100) / crop.w;
              const newY = (pin.pinY - crop.y * 100) / crop.h;
              pin.pinX = Math.max(1, Math.min(99, Math.round(newX * 100) / 100));
              pin.pinY = Math.max(1, Math.min(99, Math.round(newY * 100) / 100));
            }
          }
        },
      });
    }
    for (const pair of fl.defectPairPhotos || []) {
      if (pair.contextPhotoUrl) {
        const url = pair.contextPhotoUrl;
        refs.push({
          section: 'DEFECT',
          photoKey: urlPhotoKey(url),
          url,
          label: `${floorLabel} • ${pair.defectId} • Ảnh bối cảnh`,
          rotation: Number(pair.contextPhotoRotation) || 0,
          dateTimeText: pair.contextDateTime || defaultDate,
          photoCodeText: pair.contextWatermarkCode || code(pair.contextPhotoCode || `${pair.defectId}_CTX`),
          getBase64: () => pair.contextPhotoBase64,
          setBase64: (v) => { pair.contextPhotoBase64 = v; },
          isWatermarked: () => Boolean(pair.contextAlreadyWatermarked),
          markWatermarked: () => { pair.contextAlreadyWatermarked = true; },
        });
      }
      if (pair.closeUpPhotoUrl) {
        const url = pair.closeUpPhotoUrl;
        refs.push({
          section: 'DEFECT',
          photoKey: urlPhotoKey(url),
          url,
          label: `${floorLabel} • ${pair.defectId} • Ảnh cận cảnh`,
          rotation: Number(pair.closeUpPhotoRotation) || 0,
          dateTimeText: pair.closeUpDateTime || defaultDate,
          photoCodeText: pair.closeUpWatermarkCode || code(pair.closeUpPhotoCode || `${pair.defectId}_CU_01`),
          getBase64: () => pair.closeUpPhotoBase64,
          setBase64: (v) => { pair.closeUpPhotoBase64 = v; },
          isWatermarked: () => Boolean(pair.closeUpAlreadyWatermarked),
          markWatermarked: () => { pair.closeUpAlreadyWatermarked = true; },
        });
      }
      if (pair.extraCloseUpPhotoUrl) {
        const url = pair.extraCloseUpPhotoUrl;
        refs.push({
          section: 'DEFECT',
          photoKey: urlPhotoKey(url),
          url,
          label: `${floorLabel} • ${pair.defectId} • Ảnh cận cảnh bổ sung`,
          rotation: Number(pair.extraCloseUpPhotoRotation) || 0,
          dateTimeText: pair.extraCloseUpDateTime || defaultDate,
          photoCodeText: pair.extraCloseUpWatermarkCode || code(pair.extraCloseUpPhotoCode || `${pair.defectId}_CU_02`),
          getBase64: () => pair.extraCloseUpPhotoBase64,
          setBase64: (v) => { pair.extraCloseUpPhotoBase64 = v; },
          isWatermarked: () => Boolean(pair.extraCloseUpAlreadyWatermarked),
          markWatermarked: () => { pair.extraCloseUpAlreadyWatermarked = true; },
        });
      }
    }

    for (const page of [...(fl.overviewPages || []), ...(fl.elementOverviewPages || [])]) {
      for (const photo of page.photos || []) {
        if (!photo.url) continue;
        refs.push({
          section: 'OVERVIEW',
          photoKey: urlPhotoKey(photo.url),
          url: photo.url,
          label: `${floorLabel} • ${photo.zoneCode} • ${photo.roomName?.vi || 'Ảnh tổng quan'}`,
          rotation: Number(photo.rotation) || 0,
          dateTimeText: photo.watermarkDateTime || defaultDate,
          photoCodeText: photo.metroPhotoCode || code(`${photo.zoneCode}_${photo.photoId}`),
          getBase64: () => photo.base64,
          setBase64: (v) => { photo.base64 = v; },
          isWatermarked: () => Boolean(photo.alreadyWatermarked),
          markWatermarked: () => { photo.alreadyWatermarked = true; },
        });
      }
    }
  }

  return refs;
}
