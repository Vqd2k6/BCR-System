import type {
  CondoDamageZoneItemData,
  CondoDefectItemData,
  CondoStructuralElementItemData,
} from '../types/condo-audit.types';
import { compareCodes, firstNonEmptyString, toNumberOrNull, toRecord } from './condo-normalize.utils';
import { crackGradeOf, getBurlandGradeFromWidth, summarizeZoneCracks } from '../../../../../../components/canvas/burlandGrade';
import type { StepwiseBurlandSummary } from '../../stepwise/types';

/**
 * Cấp Burland theo bề rộng vết nứt — đúng bảng chuẩn dùng chung (components/canvas/burlandGrade.ts), khớp backend
 * chung cư. Trước đây 0 < w ≤ 0.1 mm ra Cấp 1 và D "kết cấu nguy hiểm" ≥ 3 mm bị ép Cấp 4, làm màn thẩm định hiện
 * cấp khác giá trị backend lưu. Mức nguy hiểm kết cấu đã thể hiện riêng qua cờ E2 / isStructuralCritical.
 * Giữ tham số thứ 2 để không phải sửa nơi gọi.
 */
export function calcBurlandGradeFromWidthFrontend(
  widthMm: number,
  _isStructuralCritical?: boolean
): number {
  return getBurlandGradeFromWidth(Number.isFinite(widthMm) ? widthMm : 0);
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
  const defects = rawDefs.map((item, idx) => {
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
  return defects.sort((a, b) => compareCodes(a.defectCode, b.defectCode));
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

/** Bản nộp của Khu vực chung chỉ giữ E trong `floors[]`, nên hàng SQL và khóa phẳng đều có thể rỗng. */
export function resolveRawCondoElements(paneElements: unknown, surveyJson: Record<string, unknown>): unknown[] {
  if (Array.isArray(paneElements) && paneElements.length > 0) return paneElements;
  if (Array.isArray(surveyJson.structuralElements) && surveyJson.structuralElements.length > 0) {
    return surveyJson.structuralElements;
  }
  const floors = Array.isArray(surveyJson.floors) ? surveyJson.floors : [];
  return floors.flatMap((floor) => {
    const elements = toRecord(floor).structuralElements;
    return Array.isArray(elements) ? elements : [];
  });
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

  damageZones.sort((a, b) => compareCodes(a.zoneCode, b.zoneCode));
  structuralElements.sort((a, b) => compareCodes(a.elementCode, b.elementCode));
  return { damageZones, structuralElements };
}

export interface CondoBurlandDerived {
  localMaxGrade: number;
  predominantGrade: number;
  /** Vùng chi phối: cấp cao nhất, cùng cấp thì wmax lớn nhất; null khi không có vết nứt. */
  governing: { zoneCode: string; floorName: string; wmaxMm: number; grade: number } | null;
  crackCount: number;
}

/**
 * Tổng hợp Burland chung cư theo đúng quy tắc backend lưu (syncCondoZonesElementsAndDefectsInTx) và nhà dân:
 * chỉ D loại nứt trong vùng Z còn hiệu lực. D trên cấu kiện E, võng dầm, thấm/bong không đẩy cấp Burland.
 */
export function deriveCondoBurland(zones: readonly CondoDamageZoneItemData[] | null | undefined): CondoBurlandDerived {
  const counts: Record<number, number> = {};
  let crackCount = 0;
  let governing: CondoBurlandDerived['governing'] = null;
  for (const z of zones || []) {
    if (!z || z.isDeleted) continue;
    for (const d of z.defects || []) {
      if (d.isDeleted) continue;
      const g = crackGradeOf(d);
      if (g === null) continue;
      crackCount++;
      counts[g] = (counts[g] || 0) + 1;
    }
    const s = summarizeZoneCracks(z.defects);
    if (s.grade === null) continue;
    if (!governing || s.grade > governing.grade || (s.grade === governing.grade && s.wmaxMm > governing.wmaxMm)) {
      governing = { zoneCode: z.zoneCode, floorName: z.floorName || '', wmaxMm: s.wmaxMm, grade: s.grade };
    }
  }
  let predominantGrade = 0;
  let maxCount = -1;
  Object.entries(counts).forEach(([gStr, c]) => {
    const g = Number(gStr);
    if (c > maxCount || (c === maxCount && g > predominantGrade)) {
      maxCount = c;
      predominantGrade = g;
    }
  });
  return { localMaxGrade: governing ? governing.grade : 0, predominantGrade, governing, crackCount };
}

interface CondoBurlandFormLike {
  damageZones: CondoDamageZoneItemData[];
  structuralElements?: CondoStructuralElementItemData[];
  burlandSummary: StepwiseBurlandSummary;
}

/**
 * Ghép burlandSummary với cấp đo. Cấp cục bộ đã lưu CAO hơn cấp đo được giữ (phán đoán chuyên môn) cùng vùng chi phối;
 * thấp hơn / thiếu thì nâng lên cấp đo. needStructuralEngineerReview vẫn bật theo D kết cấu, cấu kiện E, cấp ≥ 3
 * hoặc cờ bổ sung (vd. võng dầm) — chỉ là cảnh báo, không trộn vào thang Burland.
 */
export function mergeCondoBurlandSummary<T extends CondoBurlandFormLike>(state: T, extraStructuralReview = false): T {
  const derived = deriveCondoBurland(state.damageZones);
  const cur = state.burlandSummary || {};
  const savedMax = Number(cur.localMaxGrade);
  const keepSaved = Number.isInteger(savedMax) && savedMax > derived.localMaxGrade && !!cur.governingZoneCode;
  const localMaxGrade = keepSaved ? savedMax : derived.localMaxGrade;

  let totalActiveDefects = 0;
  let hasStructCrit = extraStructuralReview;
  for (const z of state.damageZones || []) {
    if (z.isDeleted) continue;
    for (const d of z.defects || []) {
      if (d.isDeleted) continue;
      totalActiveDefects++;
      if (d.isStructuralCritical) hasStructCrit = true;
    }
  }
  for (const el of state.structuralElements || []) {
    if (el.isDeleted) continue;
    for (const d of el.defects || []) {
      if (d.isDeleted) continue;
      totalActiveDefects++;
      hasStructCrit = true;
    }
  }

  return {
    ...state,
    burlandSummary: {
      ...cur,
      localMaxGrade,
      predominantGrade: derived.predominantGrade,
      governingZoneCode: keepSaved ? cur.governingZoneCode : derived.governing?.zoneCode,
      governingFloorName: keepSaved ? cur.governingFloorName : derived.governing?.floorName,
      needStructuralEngineerReview: hasStructCrit || localMaxGrade >= 3,
      controllingDefectsCount: totalActiveDefects,
    },
  };
}

export interface CondoBurlandLoadSync<T> {
  state: T;
  dirty: Record<string, { label: string; oldValue: unknown; newValue: unknown }>;
  info: { zoneCount: number; summaryChanged: boolean };
}

/**
 * Khi mở hồ sơ thẩm định chung cư: vùng Z có vết nứt mà cấp lưu THẤP hơn cấp đo → nâng lên cấp đo; tổng hợp Burland
 * thiếu / thấp hơn cấp đo → tính lại. Trả về dirty để thay đổi hiện trong diff và chỉ ghi DB khi Admin bấm Lưu.
 * Không hạ cấp đã lưu cao hơn.
 */
export function syncCondoBurlandOnLoad<T extends CondoBurlandFormLike>(
  saved: T,
  extraStructuralReview = false
): CondoBurlandLoadSync<T> {
  let zoneCount = 0;
  const zones = (saved.damageZones || []).map((z) => {
    if (z.isDeleted) return z;
    const s = summarizeZoneCracks(z.defects);
    if (s.grade === null) return z;
    const savedGrade = Number(z.burlandGrade);
    if (Number.isInteger(savedGrade) && savedGrade >= s.grade) return z;
    zoneCount++;
    return { ...z, burlandGrade: s.grade };
  });
  const withZones = zoneCount > 0 ? { ...saved, damageZones: zones } : saved;
  const derived = deriveCondoBurland(zones);
  const savedMaxRaw = saved.burlandSummary?.localMaxGrade;
  const savedMax = savedMaxRaw === undefined || savedMaxRaw === null ? NaN : Number(savedMaxRaw);
  const savedPredRaw = saved.burlandSummary?.predominantGrade;
  const savedPred = savedPredRaw === undefined || savedPredRaw === null ? NaN : Number(savedPredRaw);
  // Cấp chủ đạo cao hơn cấp lớn nhất là mâu thuẫn → tính lại
  const predominantAboveMax = Number.isInteger(savedPred) && Number.isInteger(savedMax) && savedPred > savedMax;
  const summaryLow =
    (derived.crackCount > 0 && (!Number.isInteger(savedMax) || savedMax < derived.localMaxGrade)) || predominantAboveMax;

  const dirty: CondoBurlandLoadSync<T>['dirty'] = {};
  if (zoneCount === 0 && !summaryLow) {
    return { state: saved, dirty, info: { zoneCount: 0, summaryChanged: false } };
  }
  const next = mergeCondoBurlandSummary(withZones, extraStructuralReview);
  if (zoneCount > 0) {
    dirty.damageZones = {
      label: `Cấp Burland vùng Z (tự đồng bộ theo bề rộng đo: ${zoneCount} vùng)`,
      oldValue: saved.damageZones,
      newValue: next.damageZones,
    };
  }
  const summaryChanged = JSON.stringify(next.burlandSummary) !== JSON.stringify(saved.burlandSummary);
  if (summaryChanged) {
    dirty.burlandSummary = {
      label: 'Tổng hợp Burland (tự đồng bộ theo bề rộng đo)',
      oldValue: saved.burlandSummary,
      newValue: next.burlandSummary,
    };
  }
  return { state: next, dirty, info: { zoneCount, summaryChanged } };
}
