import type {
  CondoDamageZoneItemData,
  CondoDefectItemData,
  CondoStructuralElementItemData,
} from '../types/condo-audit.types';
import { firstNonEmptyString, toNumberOrNull, toRecord } from './condo-normalize.utils';

export function calcBurlandGradeFromWidthFrontend(
  widthMm: number,
  isStructuralCritical?: boolean
): number {
  if (isStructuralCritical && widthMm >= 3) return 4;
  if (widthMm <= 0) return 0;
  if (widthMm <= 1.0) return 1;
  if (widthMm <= 5.0) return 2;
  if (widthMm <= 15.0) return 3;
  if (widthMm <= 25.0) return 4;
  return 5;
}

/** Ảnh có thể là URL hoặc object `{ url }`, tùy nguồn JSON form hay cột SQL. */
function toPhotoUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((photo) => (typeof photo === 'string' ? photo : firstNonEmptyString(toRecord(photo).url, toRecord(photo).photoUrl)))
    .filter(Boolean);
}

export function mapRawCondoDefects(rawDefs: unknown, parentId: string): CondoDefectItemData[] {
  if (!Array.isArray(rawDefs)) return [];
  return rawDefs.map((item, idx) => {
    const d = toRecord(item);
    const code = firstNonEmptyString(d.defectCode, d.defect_code) || `D-${String(idx + 1).padStart(2, '0')}`;
    const cuPhotos = toPhotoUrls(d.cuPhotos ?? d.cu_photos_json);
    const cuUrl = firstNonEmptyString(d.cuPhotoUrl, d.cu_photo_url, cuPhotos[0]);
    return {
      id: firstNonEmptyString(d.id) || `${parentId}_${code}`,
      defectCode: code,
      defectType: firstNonEmptyString(d.defectType, d.defect_type),
      screeningCategory: firstNonEmptyString(d.screeningCategory, d.screening_category),
      widthMaxMm: toNumberOrNull(d.widthMaxMm ?? d.width_max_mm),
      lengthMm: toNumberOrNull(d.lengthMm ?? d.length_mm),
      crackDirection: firstNonEmptyString(d.crackDirection, d.crack_direction),
      activityState: firstNonEmptyString(d.activityState, d.activity_state),
      hasScaleCard: Boolean(d.hasScaleCard ?? d.has_scale_card ?? false),
      isStructuralCritical: Boolean(d.isStructuralCritical ?? d.is_structural_critical ?? false),
      cuPhotoUrl: cuUrl || null,
      cuPhotos: cuPhotos.length > 0 ? cuPhotos : cuUrl ? [cuUrl] : [],
      cuPhotoCode: firstNonEmptyString(d.cuPhotoCode, d.cu_photo_code) || undefined,
      functionalImpactE6: toNumberOrNull(d.functionalImpactE6 ?? d.functional_impact_e6),
      structuralSignificanceE2: toNumberOrNull(d.structuralSignificanceE2 ?? d.structural_significance_e2),
      materialDegradationE4: toNumberOrNull(d.materialDegradationE4 ?? d.material_degradation_e4),
      notes: firstNonEmptyString(d.notes),
      pinX: toNumberOrNull(d.pinX ?? d.pin_x),
      pinY: toNumberOrNull(d.pinY ?? d.pin_y),
      isDeleted: Boolean(d.isDeleted ?? d.is_deleted ?? false),
      historyCount: Number(d.historyCount ?? 0),
      hasHistory: Boolean(d.hasHistory),
    };
  });
}

function mapRawZone(rawItem: Record<string, unknown>, id: string, code: string, floorName: string): CondoDamageZoneItemData {
  return {
    id,
    zoneCode: code,
    floorName: firstNonEmptyString(rawItem.floor_name, rawItem.floorName) || floorName,
    roomName: firstNonEmptyString(rawItem.room_name, rawItem.roomName, rawItem.locationText),
    componentType: firstNonEmptyString(rawItem.component_type, rawItem.componentType),
    wallMaterial: firstNonEmptyString(rawItem.wall_material, rawItem.wallMaterial),
    ctxPhotoUrl: firstNonEmptyString(rawItem.ctx_photo_url, rawItem.ctxPhotoUrl) || null,
    ctxPhotoCode: firstNonEmptyString(rawItem.ctx_photo_code, rawItem.ctxPhotoCode) || `${code}-CTX`,
    burlandGrade: Number(rawItem.burland_grade ?? rawItem.burlandGrade ?? 0),
    functionalImpactRepairNeeded: Boolean(
      rawItem.functional_impact_repair_needed ?? rawItem.functionalImpactRepairNeeded ?? false
    ),
    overviewPhotos: toPhotoUrls(rawItem.overviewPhotos ?? rawItem.overview_photos_json),
    notes: firstNonEmptyString(rawItem.notes),
    isDeleted: Boolean(rawItem.is_deleted ?? rawItem.isDeleted ?? false),
    historyCount: Number(rawItem.historyCount ?? 0),
    hasHistory: Boolean(rawItem.hasHistory),
    defects: mapRawCondoDefects(rawItem.defects, id),
  };
}

function mapRawElement(
  rawItem: Record<string, unknown>,
  id: string,
  code: string,
  floorName: string
): CondoStructuralElementItemData {
  const defects = mapRawCondoDefects(rawItem.defects, id);
  return {
    id,
    elementCode: code,
    floorName: firstNonEmptyString(rawItem.floor_name, rawItem.floorName) || floorName,
    roomName: firstNonEmptyString(rawItem.room_name, rawItem.roomName, rawItem.locationText),
    elementType: firstNonEmptyString(rawItem.component_type, rawItem.elementType),
    materialType: firstNonEmptyString(rawItem.wall_material, rawItem.materialType),
    dimensionsText: firstNonEmptyString(rawItem.dimensions_text, rawItem.dimensionsText),
    ctxPhotoUrl: firstNonEmptyString(rawItem.ctx_photo_url, rawItem.ctxPhotoUrl) || null,
    ctxPhotoCode: firstNonEmptyString(rawItem.ctx_photo_code, rawItem.ctxPhotoCode) || `${code}-CTX`,
    hasDamage:
      defects.length > 0 ||
      Boolean(rawItem.hasDamage) ||
      Boolean(rawItem.functional_impact_repair_needed),
    overviewPhotos: toPhotoUrls(rawItem.overviewPhotos ?? rawItem.overview_photos_json),
    notes: firstNonEmptyString(rawItem.notes),
    isDeleted: Boolean(rawItem.is_deleted ?? rawItem.isDeleted ?? false),
    historyCount: Number(rawItem.historyCount ?? 0),
    hasHistory: Boolean(rawItem.hasHistory),
    defects,
  };
}

/**
 * Tách danh sách phẳng thành Vùng Z và Cấu kiện E (mã `E-xx`), rồi bổ sung E từ nguồn riêng nếu chưa có.
 */
export function splitCondoZonesAndElements(
  rawZones: unknown,
  rawElements: unknown,
  defaultFloorName: string
): { damageZones: CondoDamageZoneItemData[]; structuralElements: CondoStructuralElementItemData[] } {
  const damageZones: CondoDamageZoneItemData[] = [];
  const structuralElements: CondoStructuralElementItemData[] = [];

  (Array.isArray(rawZones) ? rawZones : []).forEach((raw, idx) => {
    const rawItem = toRecord(raw);
    const code =
      firstNonEmptyString(rawItem.zone_code, rawItem.zoneCode, rawItem.elementCode) ||
      `Z-${String(idx + 1).padStart(2, '0')}`;
    const id = firstNonEmptyString(rawItem.id) || `item_${idx + 1}`;
    if (code.toUpperCase().startsWith('E-')) {
      structuralElements.push(mapRawElement(rawItem, id, code, defaultFloorName));
    } else {
      damageZones.push(mapRawZone(rawItem, id, code, defaultFloorName));
    }
  });

  (Array.isArray(rawElements) ? rawElements : []).forEach((raw, idx) => {
    const rawItem = toRecord(raw);
    const code =
      firstNonEmptyString(rawItem.elementCode, rawItem.zone_code) || `E-${String(idx + 1).padStart(2, '0')}`;
    if (structuralElements.some((el) => el.elementCode === code)) return;
    const id = firstNonEmptyString(rawItem.id) || `elem_${idx + 1}`;
    structuralElements.push(mapRawElement(rawItem, id, code, defaultFloorName));
  });

  return { damageZones, structuralElements };
}
