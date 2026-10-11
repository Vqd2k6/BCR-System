/**
 * condoUnitValidator.ts
 * Bộ kiểm soát nghiệp vụ hợp nhất cho phân hệ Khảo sát Căn hộ con (Condo Unit Survey)
 * Phân định rõ ràng:
 * 1. Lỗi Chặn Cứng (isBlocking: true) -> Không thể nộp hồ sơ, bắt buộc phải hoàn thiện
 * 2. Cảnh Báo Khuyến Nghị (isBlocking: false) -> Khuyến cáo KSV, cho phép nộp sau khi xác nhận
 *
 * Tuân thủ quy chuẩn Phase 1 BCS Tuyến Metro Số 2 (CRLG-CRSRI-TT).
 */

import type {
  CondoUnitFormData,
  DamageZoneData,
  StructuralElementData,
  DefectItem,
  CadZonePin,
} from '../types/condo-unit.types';
import { isResidentStatus } from '../types/condo-unit.types';
import { isCrackRelated } from '../../../components/canvas/defectHelpers';
import { isLocalBlobUri, healLocalPhotoUris, findUnsyncedPhotoPaths } from '../../../core/storage/offlinePhotoStorage';
import { uploadQueue } from '../../../core/services/uploadQueueService';
import { auditCondoUnitPhotos } from './condoUnitPhotoAudit';

export interface CondoUnitValidationIssue {
  fieldId: string;
  step: 1 | 2 | 3 | 4;
  title: string;
  message: string;
  isBlocking: boolean; // true: Chặn nộp | false: Khuyến nghị
  target?:
    | 'PARCEL_UNIT'
    | 'PHOTO_P01'
    | 'PHOTO_P04'
    | 'UNIT_CODE'
    | 'DISPLAY_CODE'
    | 'OWNER_NAME'
    | 'RESIDENT_STATUS'
    | 'OWNER_PHONE'
    | 'ZONE'
    | 'DEFECT'
    | 'ELEMENT'
    | 'CAD'
    | 'SAGGING'
    | 'SENSITIVE'
    | 'MINUTES'
    | 'CLOUD_SYNC';
  code?: string; // Mã Z-01, E-01, D-01...
}

export interface FullValidationResult {
  isValid: boolean; // true nếu 0 blocking issues
  blockingIssues: CondoUnitValidationIssue[];
  warnings: CondoUnitValidationIssue[];
  allIssues: CondoUnitValidationIssue[];
}

/**
 * Kiểm tra tính đầy đủ của Bước 1: Đối soát tòa nhà mẹ & 2 ảnh nhận diện cửa
 */
export function validateCondoUnitStep1(formData: CondoUnitFormData): CondoUnitValidationIssue[] {
  const issues: CondoUnitValidationIssue[] = [];

  // 1. Đối soát mã định danh (parcelId & unitId)
  if (!formData.parcelId?.trim() || !formData.unitId?.trim()) {
    issues.push({
      fieldId: 'step1-identifiers',
      step: 1,
      target: 'PARCEL_UNIT',
      title: 'Thiếu mã định danh tòa mẹ / căn hộ con',
      message: 'Hồ sơ chưa được gán chính xác parcelId hoặc unitId từ hệ thống.',
      isBlocking: true,
    });
  }

  // 2. Ảnh P01: Biển số phòng gắn trên cửa
  const hasP01 = Boolean(formData.photoP01?.url || formData.photoP01?.notApplicable);
  if (!hasP01) {
    issues.push({
      fieldId: 'step1-photo-p01',
      step: 1,
      target: 'PHOTO_P01',
      title: 'Thiếu ảnh P01: Biển số phòng gắn trên cửa',
      message: 'Cần chụp ảnh cận cảnh biển số phòng gắn trên cửa căn hộ hoặc tích chọn N/A nếu không có.',
      isBlocking: true,
    });
  }

  // 3. Ảnh P04: Cửa căn hộ & lối đi hành lang
  const hasP04 = Boolean(formData.photoP04?.url || formData.photoP04?.notApplicable);
  if (!hasP04) {
    issues.push({
      fieldId: 'step1-photo-p04',
      step: 1,
      target: 'PHOTO_P04',
      title: 'Thiếu ảnh P04: Cửa căn hộ & Lối đi hành lang',
      message: 'Cần chụp ảnh toàn cảnh cửa căn hộ nhìn từ hành lang tiếp cận hoặc tích chọn N/A nếu không thể chụp.',
      isBlocking: true,
    });
  }

  return issues;
}

/**
 * Kiểm tra tính đầy đủ của Bước 2: Thông tin căn hộ con & chủ sở hữu
 */
export function validateCondoUnitStep2(formData: CondoUnitFormData): CondoUnitValidationIssue[] {
  const issues: CondoUnitValidationIssue[] = [];

  // 1. Biển số phòng thực tế (displayCode)
  if (!formData.displayCode?.trim()) {
    issues.push({
      fieldId: 'input-displayCode',
      step: 2,
      target: 'DISPLAY_CODE',
      title: 'Thiếu Biển Số Thực Tế (Ảnh P01)',
      message: 'Vui lòng nhập biển số phòng thực tế cư dân sử dụng (VD: 303, P.303, L.01) để in lên trang bìa và biên bản làm việc.',
      isBlocking: true,
    });
  }

  // 2. Mã vị trí CAD (unitCode)
  if (!formData.unitCode?.trim()) {
    issues.push({
      fieldId: 'input-unitCode',
      step: 2,
      target: 'UNIT_CODE',
      title: 'Thiếu Mã Vị Trí CAD (mm.nn)',
      message: 'Vui lòng nhập mã vị trí quy hoạch căn hộ (VD: 03.03, 12.04).',
      isBlocking: true,
    });
  }

  // 3. Họ và tên người đại diện / chủ hộ
  if (!formData.ownerName?.trim()) {
    issues.push({
      fieldId: 'input-ownerName',
      step: 2,
      target: 'OWNER_NAME',
      title: 'Thiếu Họ và Tên Người Đại Diện',
      message: 'Vui lòng nhập họ và tên chủ sở hữu hoặc người đại diện làm việc tại căn hộ.',
      isBlocking: true,
    });
  }

  // 4. Trạng thái cư trú (residentStatus)
  if (!formData.residentStatus || !isResidentStatus(formData.residentStatus)) {
    issues.push({
      fieldId: 'select-residentStatus',
      step: 2,
      target: 'RESIDENT_STATUS',
      title: 'Chưa chọn Trạng Thái Cư Trú Hợp Lệ',
      message: 'Vui lòng chọn trạng thái cư trú của căn hộ (Chủ hộ ở, Cho thuê, Bỏ trống chưa về ở, Vắng mặt khóa cửa).',
      isBlocking: true,
    });
  }

  // 5. Định dạng số điện thoại (ownerPhone) nếu có nhập
  if (formData.ownerPhone?.trim()) {
    const vnPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
    const cleanPhone = formData.ownerPhone.replace(/\s+/g, '');
    if (!vnPhoneRegex.test(cleanPhone)) {
      issues.push({
        fieldId: 'input-ownerPhone',
        step: 2,
        target: 'OWNER_PHONE',
        title: 'Số điện thoại chưa đúng chuẩn',
        message: `Số điện thoại "${formData.ownerPhone}" chưa đúng định dạng số di động Việt Nam (10 chữ số).`,
        isBlocking: false,
      });
    }
  }

  // 6. Cảnh báo thiết bị nhạy cảm nếu có tích chọn nhưng bỏ trống mô tả
  const hi = formData.historyInterview;
  const hasSens = Boolean(hi?.sensitiveEquipment?.has ?? formData.hasSensitiveEquipment);
  const sensDesc = (hi?.sensitiveEquipment?.description || formData.sensitiveEquipmentDesc || '').trim();
  if (hasSens && !sensDesc) {
    issues.push({
      fieldId: 'input-sensitiveEquipment',
      step: 2,
      target: 'SENSITIVE',
      title: 'Chưa mô tả thiết bị nhạy cảm rung chấn',
      message: 'Đã tích chọn có tài sản/thiết bị nhạy cảm nhưng chưa ghi rõ mô tả (VD: Đàn dương cầm Grand Piano, dàn âm thanh...).',
      isBlocking: false,
    });
  }

  return issues;
}

/**
 * Kiểm tra tính đầy đủ của Bước 3: Vùng Z, Cấu kiện E, Khuyết tật D & Độ võng dầm sàn
 * Tuân thủ chặt chẽ mô hình đa tầng: Z (Kiến trúc) -> E (Kết cấu) -> D (Khuyết tật)
 */
export function validateCondoUnitStep3(formData: CondoUnitFormData): CondoUnitValidationIssue[] {
  const issues: CondoUnitValidationIssue[] = [];
  const zones: DamageZoneData[] = formData.zones || [];
  const structuralElements: StructuralElementData[] = formData.structuralElements || [];
  const hasStructuralElements = formData.hasStructuralElements !== false;

  // 1. Kiểm tra Vùng Z
  if (zones.length === 0) {
    issues.push({
      fieldId: 'step3-zones-list',
      step: 3,
      target: 'ZONE',
      title: 'Chưa có Vùng Kiến Trúc (Z)',
      message: 'Hồ sơ khảo sát căn hộ cần có ít nhất 1 Vùng kiến trúc (Z) đại diện cho các phòng trong căn hộ.',
      isBlocking: true,
    });
  } else {
    zones.forEach((z: DamageZoneData) => {
      // Tên phòng
      if (!z.roomName || z.roomName === 'Chưa chọn phòng' || !z.roomName.trim()) {
        issues.push({
          fieldId: `step3-zone-room-${z.zoneCode}`,
          step: 3,
          target: 'ZONE',
          code: z.zoneCode,
          title: `${z.zoneCode}: Chưa chọn tên không gian/phòng`,
          message: 'Khuyến nghị chọn tên không gian cụ thể (Phòng khách, Phòng ngủ, Bếp...) cho vùng này.',
          isBlocking: false,
        });
      }

      const defectsCount = z.defects?.length || 0;

      // Đánh dấu có hư hỏng nhưng chưa ghi điểm khuyết tật nào
      if (z.hasDamage && defectsCount === 0) {
        issues.push({
          fieldId: `step3-zone-defects-${z.zoneCode}`,
          step: 3,
          target: 'ZONE',
          code: z.zoneCode,
          title: `${z.zoneCode}: Đánh dấu có hư hỏng nhưng chưa thêm khuyết tật D`,
          message: `Vùng ${z.zoneCode} được đánh dấu CÓ hư hỏng nhưng chưa có điểm khuyết tật D nào được ghi nhận.`,
          isBlocking: true,
        });
      }

      // Nếu vùng Z có khuyết tật nhưng không có ảnh bối cảnh (CTX)
      if (defectsCount > 0 && !z.ctxPhotoUrl) {
        issues.push({
          fieldId: `step3-zone-ctx-${z.zoneCode}`,
          step: 3,
          target: 'ZONE',
          code: z.zoneCode,
          title: `${z.zoneCode}: Thiếu ảnh bối cảnh (CTX)`,
          message: `Vùng ${z.zoneCode} có ${defectsCount} khuyết tật nhưng chưa có ảnh bối cảnh mảng tường/trần để định vị.`,
          isBlocking: true,
        });
      }

      // Chưa chấm ghim trên CAD (Cảnh báo khuyến nghị)
      if (formData.unitCadUrl && !(formData.cadZonePins || []).some((p: CadZonePin) => p.zoneCode === z.zoneCode)) {
        issues.push({
          fieldId: `step3-zone-cad-pin-${z.zoneCode}`,
          step: 3,
          target: 'CAD',
          code: z.zoneCode,
          title: `${z.zoneCode}: Chưa chấm ghim trên CAD`,
          message: `Vùng ${z.zoneCode} chưa được chấm ghim định vị trên sơ đồ CAD mặt bằng căn hộ.`,
          isBlocking: false,
        });
      }

      // Khuyết tật D trong vùng Z
      z.defects?.forEach((d: DefectItem) => {
        const hasCu = Boolean(d.cuPhotoUrl || (Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0));
        if (!hasCu) {
          issues.push({
            fieldId: `step3-defect-cu-${d.defectCode}`,
            step: 3,
            target: 'DEFECT',
            code: d.defectCode,
            title: `${d.defectCode} (${z.zoneCode}): Thiếu ảnh cận cảnh có thước đo (CU)`,
            message: `Khuyết tật ${d.defectCode} bắt buộc phải có ảnh chụp cận cảnh kèm thước đo vết nứt (Scale Card / Crack Ruler).`,
            isBlocking: true,
          });
        }

        // Bắt buộc có loại khuyết tật và mô tả
        if (!d.defectType) {
          issues.push({
            fieldId: `step3-defect-type-${d.defectCode}`,
            step: 3,
            target: 'DEFECT',
            code: d.defectCode,
            title: `${d.defectCode} (${z.zoneCode}): Thiếu phân loại khuyết tật`,
            message: `Khuyết tật ${d.defectCode} chưa chọn phân loại khuyết tật cụ thể.`,
            isBlocking: true,
          });
        }

        if (!d.notes?.trim()) {
          issues.push({
            fieldId: `step3-defect-notes-${d.defectCode}`,
            step: 3,
            target: 'DEFECT',
            code: d.defectCode,
            title: `${d.defectCode} (${z.zoneCode}): Thiếu mô tả đặc điểm khuyết tật`,
            message: `Khuyết tật ${d.defectCode} chưa có mô tả vị trí và đặc điểm nhận dạng.`,
            isBlocking: true,
          });
        }

        // BẮT BUỘC nhập bề rộng với vết nứt (Chuẩn Phase 1 Metro 2)
        const isCrack = isCrackRelated(d.screeningCategory, d.defectType);
        if (isCrack) {
          if (!d.widthMaxMm || Number(d.widthMaxMm) <= 0) {
            issues.push({
              fieldId: `step3-defect-wmax-${d.defectCode}`,
              step: 3,
              target: 'DEFECT',
              code: d.defectCode,
              title: `${d.defectCode} (${z.zoneCode}): Thiếu bề rộng vết nứt (wmax)`,
              message: `Vết nứt ${d.defectCode} bắt buộc phải nhập kích thước bề rộng lớn nhất wmax > 0 (mm) để phân cấp Burland theo chuẩn Phase 1.`,
              isBlocking: true,
            });
          }

          const lenVal = d.lengthMm ?? d.length_mm;
          if (!lenVal || Number(lenVal) <= 0) {
            issues.push({
              fieldId: `step3-defect-len-${d.defectCode}`,
              step: 3,
              target: 'DEFECT',
              code: d.defectCode,
              title: `${d.defectCode} (${z.zoneCode}): Chưa nhập chiều dài vết nứt`,
              message: `Khuyến nghị nhập chiều dài ước lượng (mm) của vết nứt ${d.defectCode}.`,
              isBlocking: false,
            });
          }
        }

        // Khuyến nghị chấm ghim tọa độ khuyết tật trên ảnh bối cảnh CTX
        const hasPinOnCtx = (d.pin_x != null && d.pin_y != null) || (d.pinX != null && d.pinY != null);
        if (z.ctxPhotoUrl && !hasPinOnCtx) {
          issues.push({
            fieldId: `step3-defect-pin-${d.defectCode}`,
            step: 3,
            target: 'DEFECT',
            code: d.defectCode,
            title: `${d.defectCode} (${z.zoneCode}): Chưa ghim tọa độ trên ảnh bối cảnh (CTX)`,
            message: `Khuyết tật ${d.defectCode} chưa được chấm điểm đỏ định vị trên ảnh bối cảnh tường/trần của ${z.zoneCode}.`,
            isBlocking: false,
          });
        }
      });
    });
  }

  // 2. Kiểm tra Cấu kiện E (Nếu có bật switch khảo sát kết cấu riêng)
  if (hasStructuralElements) {
    if (structuralElements.length === 0) {
      issues.push({
        fieldId: 'step3-elements-list',
        step: 3,
        target: 'ELEMENT',
        title: 'Chưa có Cấu kiện kết cấu chịu lực (E)',
        message: 'Đang bật khảo sát cấu kiện chịu lực riêng nhưng chưa thêm cấu kiện cột/dầm/bản sàn nào. Nếu không khảo sát, vui lòng gạt tắt mục khảo sát kết cấu.',
        isBlocking: false,
      });
    } else {
      structuralElements.forEach((e: StructuralElementData) => {
        const eDefectsCount = e.defects?.length || 0;
        if (e.hasDamage && eDefectsCount === 0) {
          issues.push({
            fieldId: `step3-element-defects-${e.elementCode}`,
            step: 3,
            target: 'ELEMENT',
            code: e.elementCode,
            title: `${e.elementCode}: Đánh dấu có hư hỏng nhưng chưa thêm khuyết tật D`,
            message: `Cấu kiện ${e.elementCode} được đánh dấu CÓ nứt kết cấu nhưng chưa có điểm khuyết tật D nào được ghi sổ.`,
            isBlocking: true,
          });
        }

        if (eDefectsCount > 0 && !e.ctxPhotoUrl) {
          issues.push({
            fieldId: `step3-element-ctx-${e.elementCode}`,
            step: 3,
            target: 'ELEMENT',
            code: e.elementCode,
            title: `${e.elementCode}: Thiếu ảnh bối cảnh cấu kiện`,
            message: `Cấu kiện ${e.elementCode} có ${eDefectsCount} khuyết tật nhưng chưa có ảnh bối cảnh để định vị.`,
            isBlocking: true,
          });
        }

        if (formData.unitCadUrl && !(formData.cadElementPins || []).some((p: CadZonePin) => p.zoneCode === e.elementCode)) {
          issues.push({
            fieldId: `step3-element-cad-pin-${e.elementCode}`,
            step: 3,
            target: 'CAD',
            code: e.elementCode,
            title: `${e.elementCode}: Chưa chấm ghim trên CAD`,
            message: `Cấu kiện ${e.elementCode} chưa được chấm ghim định vị trên sơ đồ CAD.`,
            isBlocking: false,
          });
        }

        e.defects?.forEach((d: DefectItem) => {
          const hasCu = Boolean(d.cuPhotoUrl || (Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0));
          if (!hasCu) {
            issues.push({
              fieldId: `step3-element-defect-cu-${d.defectCode}`,
              step: 3,
              target: 'DEFECT',
              code: d.defectCode,
              title: `${d.defectCode} (${e.elementCode}): Thiếu ảnh cận cảnh (CU)`,
              message: `Khuyết tật ${d.defectCode} trên cấu kiện kết cấu bắt buộc phải có ảnh cận cảnh kèm thước đo.`,
              isBlocking: true,
            });
          }

          if (!d.defectType) {
            issues.push({
              fieldId: `step3-element-defect-type-${d.defectCode}`,
              step: 3,
              target: 'DEFECT',
              code: d.defectCode,
              title: `${d.defectCode} (${e.elementCode}): Thiếu phân loại khuyết tật`,
              message: `Khuyết tật ${d.defectCode} trên cấu kiện kết cấu chưa có phân loại.`,
              isBlocking: true,
            });
          }

          if (!d.notes?.trim()) {
            issues.push({
              fieldId: `step3-element-defect-notes-${d.defectCode}`,
              step: 3,
              target: 'DEFECT',
              code: d.defectCode,
              title: `${d.defectCode} (${e.elementCode}): Thiếu mô tả đặc điểm khuyết tật`,
              message: `Khuyết tật ${d.defectCode} trên cấu kiện kết cấu chưa có mô tả.`,
              isBlocking: true,
            });
          }

          const isCrack = isCrackRelated(d.screeningCategory, d.defectType);
          if (isCrack && (!d.widthMaxMm || Number(d.widthMaxMm) <= 0)) {
            issues.push({
              fieldId: `step3-element-defect-wmax-${d.defectCode}`,
              step: 3,
              target: 'DEFECT',
              code: d.defectCode,
              title: `${d.defectCode} (${e.elementCode}): Thiếu bề rộng vết nứt kết cấu (wmax)`,
              message: `Vết nứt trên cấu kiện chịu lực ${e.elementCode} bắt buộc phải đo và nhập bề rộng wmax > 0 (mm).`,
              isBlocking: true,
            });
          }
        });
      });
    }
  }

  // 3. Kiểm tra Độ võng dầm / sàn (nếu có đánh dấu có võng - Chuẩn TCVN 5574:2018)
  if (formData.beamSagging?.hasSagging) {
    if (!formData.beamSagging.sagMm || Number(formData.beamSagging.sagMm) <= 0) {
      issues.push({
        fieldId: 'input-beamSagging-sagMm',
        step: 3,
        target: 'SAGGING',
        title: 'Thiếu độ võng dầm/sàn f (mm)',
        message: 'Đã tích chọn có võng kết cấu nhưng chưa nhập độ võng đo đạc f > 0.',
        isBlocking: true,
      });
    }
    if (!formData.beamSagging.spanM || Number(formData.beamSagging.spanM) <= 0) {
      issues.push({
        fieldId: 'input-beamSagging-spanM',
        step: 3,
        target: 'SAGGING',
        title: 'Thiếu chiều dài nhịp L (m)',
        message: 'Cần nhập chiều dài nhịp dầm/sàn L > 0 để tính tỉ số f/L theo TCVN 5574:2018.',
        isBlocking: true,
      });
    }
  }

  return issues;
}

/**
 * Kiểm tra tính đầy đủ của Bước 4 & Ảnh còn lưu tạm offline chưa đồng bộ Cloud
 */
export function validateCondoUnitStep4AndCloud(formData: CondoUnitFormData): CondoUnitValidationIssue[] {
  const issues: CondoUnitValidationIssue[] = [];

  const audit = auditCondoUnitPhotos(formData);

  if (audit.unsynced > 0) {
    const previewLabels = audit.unsyncedPhotos
      .slice(0, 3)
      .map((p) => p.fieldTitle)
      .join(', ');
    issues.push({
      fieldId: 'step4-unsynced-photos',
      step: 4,
      target: 'CLOUD_SYNC',
      title: `${audit.unsynced} ảnh chưa đồng bộ lên Cloud R2`,
      message: `Hệ thống ghi nhận còn ${audit.unsynced} ảnh đang lưu tạm trong máy (${previewLabels}${audit.unsynced > 3 ? '...' : ''}). Vui lòng bấm "Đồng bộ ảnh ngay" hoặc kiểm tra kết nối mạng trước khi nộp.`,
      isBlocking: true,
    });
  }

  // Lưới an toàn: quét MỌI chuỗi blob:/base64 còn sót (kể cả trường audit chưa liệt kê) để không nộp nhầm ảnh tạm
  if (audit.unsynced === 0) {
    const leftoverPaths = findUnsyncedPhotoPaths(healLocalPhotoUris(formData));
    if (leftoverPaths.length > 0) {
      issues.push({
        fieldId: 'step4-unsynced-photos',
        step: 4,
        target: 'CLOUD_SYNC',
        title: `${leftoverPaths.length} ảnh chưa đồng bộ lên Cloud R2`,
        message: `Phát hiện ${leftoverPaths.length} ảnh đang ở dạng tạm trong máy (${leftoverPaths.slice(0, 3).join(', ')}${leftoverPaths.length > 3 ? '...' : ''}). Vui lòng kiểm tra kết nối mạng và đồng bộ ảnh trước khi nộp.`,
        isBlocking: true,
      });
    }
  }

  // Còn ảnh đang trong hàng đợi upload -> chờ upload xong mới được nộp
  const pendingUploads = uploadQueue.getPendingAndActiveCount();
  if (pendingUploads > 0 && audit.unsynced === 0) {
    issues.push({
      fieldId: 'step4-pending-uploads',
      step: 4,
      target: 'CLOUD_SYNC',
      title: `${pendingUploads} ảnh đang trong hàng đợi tải lên Cloud`,
      message: 'Vui lòng đợi các ảnh tải lên Cloud hoàn tất rồi mới nộp hồ sơ.',
      isBlocking: true,
    });
  }

  // Kiểm tra Biên bản làm việc pháp lý / Chữ ký
  const hasMinutesPhoto = Boolean(
    (formData.workingMinutesPhotos && formData.workingMinutesPhotos.length > 0) ||
    (formData.signatures?.workingMinutesPhotos && formData.signatures.workingMinutesPhotos.length > 0)
  );
  const hasOwnerSignature = Boolean(formData.ownerSignature || formData.signatures?.ownerSignature);
  const hasOwnerFeedback = Boolean(formData.ownerFeedback?.trim() || formData.signatures?.ownerFeedback?.trim());
  const isAbsent = formData.residentStatus === 'VẮNG_MẶT_KHÓA_CỬA';

  if (!isAbsent && !hasMinutesPhoto && !hasOwnerSignature && !hasOwnerFeedback) {
    issues.push({
      fieldId: 'step4-working-minutes',
      step: 4,
      target: 'MINUTES',
      title: 'Chưa có ảnh biên bản giấy hoặc chữ ký chủ hộ',
      message: 'Khuyến nghị chụp ít nhất 1 ảnh biên bản làm việc có chữ ký xác nhận của chủ hộ hoặc ghi chú lý do trong phần ý kiến chủ hộ.',
      isBlocking: false,
    });
  }

  return issues;
}

/**
 * Kiểm tra xác thực cho từng bước đơn lẻ (Dùng cho Wizard Nav Tab & Next Buttons)
 */
export function validateCondoUnitSingleStep(
  stepNum: number,
  formData: CondoUnitFormData
): CondoUnitValidationIssue[] {
  switch (stepNum) {
    case 1:
      return validateCondoUnitStep1(formData);
    case 2:
      return validateCondoUnitStep2(formData);
    case 3:
      return validateCondoUnitStep3(formData);
    case 4:
      return validateCondoUnitStep4AndCloud(formData);
    default:
      return [];
  }
}

/**
 * THẨM ĐỊNH TOÀN DIỆN CỦA HỒ SƠ KHẢO SÁT CĂN HỘ CON (FULL VALIDATION GATE)
 * Chạy trước khi nộp hồ sơ hoặc để hiển thị trên Step 4 Dashboard
 */
export function validateCondoUnitFull(formData: CondoUnitFormData): FullValidationResult {
  const issuesStep1 = validateCondoUnitStep1(formData);
  const issuesStep2 = validateCondoUnitStep2(formData);
  const issuesStep3 = validateCondoUnitStep3(formData);
  const issuesStep4 = validateCondoUnitStep4AndCloud(formData);

  const allIssues = [...issuesStep1, ...issuesStep2, ...issuesStep3, ...issuesStep4];
  const blockingIssues = allIssues.filter((i) => i.isBlocking);
  const warnings = allIssues.filter((i) => !i.isBlocking);

  return {
    isValid: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    allIssues,
  };
}

