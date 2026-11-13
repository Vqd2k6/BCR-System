/**
 * ============================================================================
 * CAD PIN OVERLAY & WATERMARK DETECTOR MAPPER (APPENDIX 2 SUB-MODULE)
 * Xây dựng danh sách điểm ghim Z, E (CadPinOverlayItem) hiển thị trên sơ đồ CAD
 * và kiểm tra trạng thái Watermark của ảnh.
 * ============================================================================
 */

import { CadPinOverlayItem } from '../../../report.types';
import { LegacyWatermarkIndex, isFieldPhotoUrl } from '../../../services/legacy-watermark-index.service';

/**
 * Kiểm tra xem một bức ảnh đã được nhúng watermark từ thiết bị/hệ thống hay chưa
 */
export function isPhotoAlreadyWatermarked(url?: string, photoObj?: any): boolean {
  if (!url && !photoObj) return false;
  const rawUrl: string = url || photoObj?.url || '';
  // Ảnh raster trên cloud/local: chỉ tin kết quả dò logo hoặc người xác nhận (LegacyWatermarkIndex).
  // Không đoán theo tên file hay cờ client gửi: đoán sai là in ảnh không dấu hoặc dập chồng.
  if (isFieldPhotoUrl(rawUrl)) return LegacyWatermarkIndex.has(rawUrl);
  if (photoObj?.hasWatermark === true || photoObj?.isWatermarked === true || photoObj?.alreadyWatermarked === true) return true;
  // Chỉ dò từ khóa trên TÊN FILE: thư mục cloud tên "/watermark/" không có nghĩa ảnh đã có dấu.
  const u = (rawUrl.split('?')[0].split('#')[0].split('/').pop() || '').toLowerCase();
  return (
    u.includes('_wm_') ||
    u.includes('watermark') ||
    u.includes('annotated') ||
    u.includes('_wm.') ||
    u.includes('-wm.')
  );
}

/**
 * Thu thập các điểm ghim Vùng Z và Cấu kiện E trên sơ đồ CAD (Khuyết tật D không hiển thị trên CAD).
 * Lọc bỏ các ghim của vùng Z hoặc cấu kiện E đã bị xóa mềm (is_deleted / isDeleted).
 */
export function extractFloorCadPins(
  fl: any,
  hasStructuralCadMap: boolean
): { cadPins: CadPinOverlayItem[]; cadStructuralPins: CadPinOverlayItem[] } {
  const cadPins: CadPinOverlayItem[] = [];
  const cadStructuralPins: CadPinOverlayItem[] = [];

  const deletedZoneCodes = new Set<string>();
  const activeZonesByCode = new Map<string, any>();
  if (Array.isArray(fl.zones)) {
    for (const z of fl.zones) {
      const zCode = z?.zoneCode || z?.zone_code;
      if (!zCode) continue;
      if (z.isDeleted || z.is_deleted) {
        deletedZoneCodes.add(zCode);
      } else {
        activeZonesByCode.set(zCode, z);
      }
    }
  }

  const deletedElemCodes = new Set<string>();
  const activeElemsByCode = new Map<string, any>();
  if (Array.isArray(fl.structuralElements)) {
    for (const el of fl.structuralElements) {
      const elCode = el?.elementCode || el?.element_code || el?.zoneCode || el?.zone_code;
      if (!elCode) continue;
      if (el.isDeleted || el.is_deleted) {
        deletedElemCodes.add(elCode);
      } else {
        activeElemsByCode.set(elCode, el);
      }
    }
  }

  const seenCadZoneCodes = new Set<string>();
  const rawCadZonePins = fl.cadZonePins || fl.cad_zone_pins_json;
  if (Array.isArray(rawCadZonePins)) {
    for (const p of rawCadZonePins) {
      if (!p || p.isDeleted || p.is_deleted) continue;
      const pX = p.pinX ?? p.pin_x ?? p.x;
      const pY = p.pinY ?? p.pin_y ?? p.y;
      if (pX !== undefined && pY !== undefined) {
        const code = p.zoneCode || p.zone_code || p.label || 'Z';
        if (deletedZoneCodes.has(code)) continue;
        seenCadZoneCodes.add(code);
        cadPins.push({
          id: p.id,
          code,
          label: p.label || code,
          pinX: Number(pX),
          pinY: Number(pY),
          type: 'ZONE',
          typeLower: 'zone',
          description: `Vùng kiến trúc ${code}`,
        });
      }
    }
  }

  for (const [zCode, z] of activeZonesByCode.entries()) {
    if (!seenCadZoneCodes.has(zCode)) {
      const zX = z.pinX ?? z.pin_x ?? z.x;
      const zY = z.pinY ?? z.pin_y ?? z.y;
      if (zX !== undefined && zY !== undefined && zX !== null && zY !== null) {
        cadPins.push({
          id: z.id || `pin-${zCode}`,
          code: zCode,
          label: zCode,
          pinX: Number(zX),
          pinY: Number(zY),
          type: 'ZONE',
          typeLower: 'zone',
          description: `Vùng kiến trúc ${zCode}`,
        });
      }
    }
  }

  const seenCadElemCodes = new Set<string>();
  const rawCadElemPins = fl.cadElementPins || fl.cad_element_pins_json;
  if (Array.isArray(rawCadElemPins)) {
    for (const p of rawCadElemPins) {
      if (!p || p.isDeleted || p.is_deleted) continue;
      const pX = p.pinX ?? p.pin_x ?? p.x;
      const pY = p.pinY ?? p.pin_y ?? p.y;
      if (pX !== undefined && pY !== undefined) {
        const code = p.zoneCode || p.zone_code || p.elementCode || p.element_code || p.label || 'E';
        if (deletedElemCodes.has(code)) continue;
        seenCadElemCodes.add(code);
        const item: CadPinOverlayItem = {
          id: p.id,
          code,
          label: p.label || code,
          pinX: Number(pX),
          pinY: Number(pY),
          type: 'STRUCTURAL',
          typeLower: 'element',
          description: `Cấu kiện kết cấu ${code}`,
        };
        cadStructuralPins.push(item);
        if (!hasStructuralCadMap) {
          cadPins.push(item);
        }
      }
    }
  }

  for (const [elCode, el] of activeElemsByCode.entries()) {
    if (!seenCadElemCodes.has(elCode)) {
      const eX = el.pinX ?? el.pin_x ?? el.x;
      const eY = el.pinY ?? el.pin_y ?? el.y;
      if (eX !== undefined && eY !== undefined && eX !== null && eY !== null) {
        const item: CadPinOverlayItem = {
          id: el.id || `pin-${elCode}`,
          code: elCode,
          label: elCode,
          pinX: Number(eX),
          pinY: Number(eY),
          type: 'STRUCTURAL',
          typeLower: 'element',
          description: `Cấu kiện kết cấu ${elCode}`,
        };
        cadStructuralPins.push(item);
        if (!hasStructuralCadMap) {
          cadPins.push(item);
        }
      }
    }
  }

  return { cadPins, cadStructuralPins };
}

