import { normalizeMetroFloorCode } from '../../../utils/watermarkEngine';
import type {
  EvidencePhotoItem,
  FloorSplitLine,
  FloorSurveyData,
  FreehandStroke,
  P03PhotoItem,
  Phase1SurveyFormData,
  PolygonPoint,
  SettlementTiltState,
} from '../types/phase1.types';

/**
 * TRỤ CỘT KIẾN TRÚC 3: SYMMETRIC REHYDRATION CODEC (ANTI-CORRUPTION LAYER)
 * Giải mã đối xứng 1:1 dữ liệu từ Backend PostgreSQL (survey_identification_photos,
 * floor_surveys, deformation_assessments) lên Frontend Store cho cả Nhà dân và Chung cư.
 *
 * Triệt tiêu hoàn toàn:
 * - Lỗi rơi photoCode, naReason, freehandStrokes và trộn P-03 chính/phụ ([ND-03], [CC-01])
 * - Lỗi ghép nhầm ảnh giữa các tầng do lấy theo chỉ số mảng idx ([ND-06])
 * - Lỗi đọc sai tên cột biến dạng Lún/Nghiêng/Võng ([ND-06])
 */

export interface IdentificationPhotoDimensionsDto {
  widthM?: number | string | null;
  heightM?: number | string | null;
  naReason?: string | null;
  freehandStrokes?: FreehandStroke[] | null;
  tag?: string | null;
  isAdditional?: boolean | null;
}

export interface BackendIdentificationPhotoRow {
  id?: string;
  photo_type?: string;
  raw_photo_url?: string | null;
  annotated_photo_url?: string | null;
  is_not_applicable?: boolean | null;
  photo_code?: string | null;
  facade_polygon_points_json?: PolygonPoint[] | string | null;
  floor_split_lines_json?: FloorSplitLine[] | string | null;
  dimensions_json?: IdentificationPhotoDimensionsDto | string | null;
}

export interface RehydratedStep1Photos {
  photoP01?: Phase1SurveyFormData['photoP01'];
  photoP02?: Phase1SurveyFormData['photoP02'];
  photoP03?: Phase1SurveyFormData['photoP03'];
  photoP04?: Phase1SurveyFormData['photoP04'];
}

function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

/**
 * Khôi phục bộ ảnh định danh P-01..P-04 từ bảng survey_identification_photos
 * Bảo toàn 100% photoCode, naReason, freehandStrokes, polygonPoints, floorSplits,
 * và phân tách chính xác P-03 chính vs danh sách P-03 phụ (additionalPhotos).
 */
export function rehydrateIdentificationPhotos(
  rows: readonly BackendIdentificationPhotoRow[] | undefined | null,
  existing?: Partial<RehydratedStep1Photos>
): RehydratedStep1Photos {
  const result: RehydratedStep1Photos = {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return result;
  }

  let primaryP03Assigned = Boolean(existing?.photoP03?.url);
  const currentP03: Phase1SurveyFormData['photoP03'] = {
    url: existing?.photoP03?.url || '',
    photoCode: existing?.photoP03?.photoCode,
    notApplicable: Boolean(existing?.photoP03?.notApplicable),
    naReason: existing?.photoP03?.naReason,
    tag: existing?.photoP03?.tag || 'Bên hông trái',
    additionalPhotos: Array.isArray(existing?.photoP03?.additionalPhotos)
      ? [...existing.photoP03.additionalPhotos]
      : [],
  };

  for (const row of rows) {
    const rawUrl = String(row.raw_photo_url || '').trim();
    const isNotApp = Boolean(row.is_not_applicable);
    const photoCode = row.photo_code ? String(row.photo_code).trim() : undefined;
    const dim = parseJsonField<IdentificationPhotoDimensionsDto>(row.dimensions_json, {});
    const naReason = dim?.naReason ? String(dim.naReason) : undefined;

    if (row.photo_type === 'P01_HOUSE_NUMBER') {
      const prev = existing?.photoP01;
      result.photoP01 = {
        url: rawUrl || prev?.url || '',
        photoCode: photoCode || prev?.photoCode,
        notApplicable: rawUrl ? false : isNotApp || Boolean(prev?.notApplicable),
        ...(naReason || prev?.naReason ? { naReason: naReason || prev?.naReason } : {}),
      };
    } else if (row.photo_type === 'P02_MAIN_FACADE') {
      const prev = existing?.photoP02;
      const polygonPoints = parseJsonField<PolygonPoint[]>(
        row.facade_polygon_points_json,
        prev?.polygonPoints || []
      );
      const floorSplits = parseJsonField<FloorSplitLine[]>(
        row.floor_split_lines_json,
        prev?.floorSplits || []
      );
      const freehandStrokes = Array.isArray(dim?.freehandStrokes)
        ? dim.freehandStrokes
        : prev?.freehandStrokes || [];

      const widthM =
        dim?.widthM !== undefined && dim?.widthM !== null && dim?.widthM !== ''
          ? Number(dim.widthM)
          : prev?.widthM ?? '';
      const heightM =
        dim?.heightM !== undefined && dim?.heightM !== null && dim?.heightM !== ''
          ? Number(dim.heightM)
          : prev?.heightM ?? '';

      result.photoP02 = {
        url: rawUrl || prev?.url || '',
        photoCode: photoCode || prev?.photoCode,
        notApplicable: rawUrl ? false : isNotApp || Boolean(prev?.notApplicable),
        ...(naReason || prev?.naReason ? { naReason: naReason || prev?.naReason } : {}),
        polygonPoints: Array.isArray(polygonPoints) && polygonPoints.length > 0 ? polygonPoints : prev?.polygonPoints || [],
        floorSplits: Array.isArray(floorSplits) && floorSplits.length > 0 ? floorSplits : prev?.floorSplits || [],
        freehandStrokes,
        widthM: typeof widthM === 'number' && !isNaN(widthM) ? widthM : '',
        heightM: typeof heightM === 'number' && !isNaN(heightM) ? heightM : '',
      };
    } else if (row.photo_type === 'P03_SIDE_OR_REAR') {
      const isExplicitlyAdditional = dim?.isAdditional === true;
      const resolvedTag = dim?.tag ? String(dim.tag) : undefined;

      if (!isExplicitlyAdditional && (!primaryP03Assigned || currentP03.url === rawUrl)) {
        currentP03.url = rawUrl || currentP03.url || '';
        currentP03.photoCode = photoCode || currentP03.photoCode;
        currentP03.notApplicable = rawUrl ? false : isNotApp || currentP03.notApplicable;
        if (naReason || currentP03.naReason) {
          currentP03.naReason = naReason || currentP03.naReason;
        }
        currentP03.tag = resolvedTag || currentP03.tag || 'Bên hông trái';
        primaryP03Assigned = true;
      } else if (rawUrl) {
        const currentAdd = currentP03.additionalPhotos || [];
        const existingIdx = currentAdd.findIndex((ap) => ap.url === rawUrl);
        if (existingIdx >= 0) {
          currentAdd[existingIdx] = {
            ...currentAdd[existingIdx],
            url: rawUrl,
            tag: resolvedTag || currentAdd[existingIdx].tag || 'Bên hông phải',
            photoCode: photoCode || currentAdd[existingIdx].photoCode,
          };
        } else if (currentP03.url !== rawUrl) {
          const nextItem: P03PhotoItem = {
            id: `p03_add_${currentAdd.length + 1}`,
            url: rawUrl,
            tag: resolvedTag || 'Bên hông phải',
            photoCode: photoCode || `P-03-${currentAdd.length + 2}`,
          };
          currentAdd.push(nextItem);
        }
        currentP03.additionalPhotos = currentAdd;
      }
      result.photoP03 = { ...currentP03 };
    } else if (row.photo_type === 'P04_CONTEXT_STREET') {
      const prev = existing?.photoP04;
      result.photoP04 = {
        url: rawUrl || prev?.url || '',
        photoCode: photoCode || prev?.photoCode,
        notApplicable: rawUrl ? false : isNotApp || Boolean(prev?.notApplicable),
        ...(naReason || prev?.naReason ? { naReason: naReason || prev?.naReason } : {}),
      };
    }
  }

  return result;
}

export interface BackendFloorSurveyRow {
  id?: string;
  floor_name?: string;
  floorName?: string;
  floor_code?: string;
  floorCode?: string;
  overview_photos_json?: unknown;
  overview_photos?: unknown;
  general_photos_json?: unknown;
  cad_drawing_url?: string | null;
  cad_sketch_photo_url?: string | null;
  cad_sketch_photo_code?: string | null;
  cad_structural_drawing_url?: string | null;
  cad_structural_sketch_photo_code?: string | null;
  cad_zone_pins_json?: unknown;
  cad_zone_pins?: unknown;
  cad_element_pins_json?: unknown;
  cad_element_pins?: unknown;
  has_structural_elements?: boolean | null;
  no_structural_elements_reason?: string | null;
  beam_sagging_json?: unknown;
}

function normalizeFloorMatchKey(nameOrCode?: string | null): string {
  if (!nameOrCode) return '';
  const trimmed = String(nameOrCode).trim();
  const metroCode = normalizeMetroFloorCode(trimmed);
  return (metroCode || trimmed).toUpperCase();
}

/**
 * Khớp và khôi phục danh sách tầng theo khóa định danh chuẩn (floor_name / floorCode),
 * tuyệt đối không phụ thuộc mù quáng vào chỉ số mảng idx ([ND-06])
 */
export function rehydrateFloorSurveysByCanonicalKey(
  existingFloors: readonly FloorSurveyData[],
  beFloorSurveys: readonly BackendFloorSurveyRow[] | undefined | null
): FloorSurveyData[] {
  const beList = Array.isArray(beFloorSurveys) ? beFloorSurveys : [];

  return existingFloors.map((fl, idx) => {
    const flNameTrimmed = String(fl.floorName || '').trim().toUpperCase();
    const flCanonical = normalizeFloorMatchKey(fl.floorCode || fl.floorName);

    // 1. Khớp chính xác theo id hoặc floor_name
    let beFloor = beList.find((bf) => {
      if (fl.id && bf.id && fl.id === bf.id) return true;
      const bfName = String(bf.floor_name || bf.floorName || '').trim().toUpperCase();
      return bfName.length > 0 && bfName === flNameTrimmed;
    });

    // 2. Khớp theo mã tầng chuẩn hóa Metro 2 (VD: "Tầng 1 (Trệt)" <-> "F00")
    if (!beFloor && flCanonical) {
      beFloor = beList.find((bf) => {
        const bfCanonical = normalizeFloorMatchKey(
          bf.floor_code || bf.floorCode || bf.floor_name || bf.floorName
        );
        return bfCanonical.length > 0 && bfCanonical === flCanonical;
      });
    }

    // 3. Fallback theo vị trí CHỈ KHI số lượng tầng khớp nhau và chưa khớp được theo tên
    if (!beFloor && beList.length === existingFloors.length) {
      beFloor = beList[idx];
    }

    const rawPhotos =
      fl.overviewPhotos && fl.overviewPhotos.length > 0
        ? fl.overviewPhotos
        : parseJsonField<unknown[]>(
            beFloor?.overview_photos_json ??
              beFloor?.general_photos_json ??
              beFloor?.overview_photos,
            []
          );

    const normalizedPhotos = (Array.isArray(rawPhotos) ? rawPhotos : []).map((p, pIdx) => {
      if (typeof p === 'string') {
        return { id: `fl_ov_${pIdx}`, url: p, caption: '' };
      }
      const pObj = p as {
        id?: string;
        url?: string;
        caption?: string;
        photoCode?: string;
        photo_code?: string;
      };
      const resolvedCode = pObj.photoCode || pObj.photo_code;
      return {
        id: pObj.id || `fl_ov_${pIdx}`,
        url: pObj.url || '',
        caption: pObj.caption || '',
        ...(resolvedCode ? { photoCode: resolvedCode } : {}),
      };
    });

    const parsedZonePins = parseJsonField<FloorSurveyData['cadZonePins']>(
      beFloor?.cad_zone_pins_json ?? beFloor?.cad_zone_pins,
      []
    );
    const parsedElementPins = parseJsonField<FloorSurveyData['cadElementPins']>(
      beFloor?.cad_element_pins_json ?? beFloor?.cad_element_pins,
      []
    );
    const parsedBeamSagging = parseJsonField<FloorSurveyData['beamSagging']>(
      beFloor?.beam_sagging_json,
      undefined
    );

    return {
      ...fl,
      overviewPhotos: normalizedPhotos,
      cadSketchPhotoUrl:
        fl.cadSketchPhotoUrl ||
        beFloor?.cad_drawing_url ||
        beFloor?.cad_sketch_photo_url ||
        '',
      cadSketchPhotoCode:
        fl.cadSketchPhotoCode || beFloor?.cad_sketch_photo_code || undefined,
      cadStructuralSketchPhotoUrl:
        fl.cadStructuralSketchPhotoUrl ||
        fl.cad_structural_drawing_url ||
        beFloor?.cad_structural_drawing_url ||
        '',
      cadStructuralSketchPhotoCode:
        fl.cadStructuralSketchPhotoCode ||
        beFloor?.cad_structural_sketch_photo_code ||
        undefined,
      cadZonePins:
        fl.cadZonePins && fl.cadZonePins.length > 0 ? fl.cadZonePins : parsedZonePins,
      cadElementPins:
        fl.cadElementPins && fl.cadElementPins.length > 0
          ? fl.cadElementPins
          : parsedElementPins,
      hasStructuralElements:
        fl.hasStructuralElements ?? beFloor?.has_structural_elements ?? true,
      noStructuralElementsReason:
        fl.noStructuralElementsReason || beFloor?.no_structural_elements_reason || '',
      beamSagging: fl.beamSagging || parsedBeamSagging,
      zones: fl.zones || [],
      structuralElements: fl.structuralElements || [],
    };
  });
}

export interface BackendDeformationRow {
  tilt_angle_x?: number | string | null;
  tilt_angle_y?: number | string | null;
  tilt_direction?: string | null;
  beam_deflection_mm?: number | string | null;
  e3_deformation_score?: number | string | null;
  monitoring_notes?: string | null;
  measurement_method?: string | null;
  measurement_reliability?: 'HIGH' | 'MEDIUM' | 'LOW' | string | null;
  diff_settlement_photo_code?: string | null;
  tilt_photo_code?: string | null;
  beam_sagging_photo_code?: string | null;
  abnormal_photo_code?: string | null;
  diff_settlement_photos_json?: unknown;
  tilt_photos_json?: unknown;
  beam_sagging_photos_json?: unknown;
  abnormal_photos_json?: unknown;
  details_json?: unknown;
  // Hỗ trợ tương thích ngược
  diff_settlement_json?: unknown;
  building_tilt_json?: unknown;
  beam_sagging_json?: unknown;
  abnormal_case_json?: unknown;
}

function normalizeEvidencePhotos(raw: unknown): EvidencePhotoItem[] {
  const parsed = parseJsonField<unknown[]>(raw, []);
  if (!Array.isArray(parsed)) return [];
  const items: EvidencePhotoItem[] = [];
  for (const entry of parsed) {
    if (typeof entry === 'string' && entry.trim()) {
      items.push({ url: entry.trim() });
    } else if (entry && typeof entry === 'object') {
      const obj = entry as { url?: string; photoCode?: string; photo_code?: string; notes?: string };
      if (obj.url && typeof obj.url === 'string' && obj.url.trim()) {
        items.push({
          url: obj.url.trim(),
          photoCode: obj.photoCode || obj.photo_code,
          notes: obj.notes,
        });
      }
    }
  }
  return items;
}

/**
 * Khôi phục dữ liệu Biến dạng Lún / Nghiêng / Võng / Bất thường từ bảng deformation_assessments ([ND-06])
 */
export function rehydrateDeformationAssessment(
  def: BackendDeformationRow | undefined | null
): SettlementTiltState | undefined {
  if (!def) return undefined;

  const details = parseJsonField<Partial<SettlementTiltState>>(def.details_json, {});

  const diffPhotos = normalizeEvidencePhotos(def.diff_settlement_photos_json);
  const tiltPhotos = normalizeEvidencePhotos(def.tilt_photos_json);
  const sagPhotos = normalizeEvidencePhotos(def.beam_sagging_photos_json);
  const abnormalPhotos = normalizeEvidencePhotos(def.abnormal_photos_json);

  const tx = Number(def.tilt_angle_x) || 0;
  const ty = Number(def.tilt_angle_y) || 0;
  const maxTilt = Math.max(Math.abs(tx), Math.abs(ty));
  const tiltLvl = (
    maxTilt > 10 ? 4 : maxTilt > 5 ? 3 : maxTilt > 2 ? 2 : maxTilt > 0 ? 1 : 0
  ) as 0 | 1 | 2 | 3 | 4;
  const sagMm = Number(def.beam_deflection_mm) || 0;
  const sagLvl = (sagMm > 20 ? 4 : sagMm > 10 ? 2 : 0) as 0 | 2 | 4;
  const e3Lvl = Math.min(4, Math.max(0, Number(def.e3_deformation_score) || 0)) as
    | 0
    | 1
    | 2
    | 3
    | 4;

  const legacyDiff = parseJsonField<SettlementTiltState['diffSettlement'] | undefined>(
    def.diff_settlement_json,
    undefined
  );
  const legacyTilt = parseJsonField<SettlementTiltState['buildingTilt'] | undefined>(
    def.building_tilt_json,
    undefined
  );
  const legacySag = parseJsonField<SettlementTiltState['beamSagging'] | undefined>(
    def.beam_sagging_json,
    undefined
  );
  const legacyAbnormal = parseJsonField<SettlementTiltState['abnormalCase'] | undefined>(
    def.abnormal_case_json,
    undefined
  );

  const dDiff = details?.diffSettlement || legacyDiff;
  const dTilt = details?.buildingTilt || legacyTilt;
  const dSag = details?.beamSagging || legacySag;
  const dAbnormal = details?.abnormalCase || legacyAbnormal;

  const resolvedDiffPhotos =
    dDiff?.photos && dDiff.photos.length > 0 ? dDiff.photos : diffPhotos;
  const resolvedTiltPhotos =
    dTilt?.photos && dTilt.photos.length > 0 ? dTilt.photos : tiltPhotos;
  const resolvedAbnormalPhotos =
    dAbnormal?.photos && dAbnormal.photos.length > 0 ? dAbnormal.photos : abnormalPhotos;

  const reliabilityRaw = String(
    details?.reliability || def.measurement_reliability || 'HIGH'
  ).toUpperCase();
  const reliability: 'HIGH' | 'MEDIUM' | 'LOW' =
    reliabilityRaw === 'LOW'
      ? 'LOW'
      : reliabilityRaw === 'MEDIUM'
      ? 'MEDIUM'
      : 'HIGH';

  return {
    diffSettlement: {
      level: dDiff?.level ?? Math.max(e3Lvl, 0),
      position: dDiff?.position || '',
      photoUrl: dDiff?.photoUrl || resolvedDiffPhotos[0]?.url || '',
      photoCode:
        dDiff?.photoCode ||
        def.diff_settlement_photo_code ||
        resolvedDiffPhotos[0]?.photoCode ||
        undefined,
      photos: resolvedDiffPhotos,
      notes: dDiff?.notes || '',
    },
    buildingTilt: {
      level: dTilt?.level ?? tiltLvl,
      xPermille: dTilt?.xPermille !== undefined ? dTilt.xPermille : tx,
      yPermille: dTilt?.yPermille !== undefined ? dTilt.yPermille : ty,
      direction: dTilt?.direction || def.tilt_direction || '',
      photoUrl: dTilt?.photoUrl || resolvedTiltPhotos[0]?.url || '',
      photoCode:
        dTilt?.photoCode ||
        def.tilt_photo_code ||
        resolvedTiltPhotos[0]?.photoCode ||
        undefined,
      photos: resolvedTiltPhotos,
      notes: dTilt?.notes || '',
    },
    beamSagging: {
      level: dSag?.level ?? sagLvl,
      position: dSag?.position || '',
      sagMm: dSag?.sagMm !== undefined ? dSag.sagMm : sagMm,
      description: dSag?.description || '',
      photoUrl: dSag?.photoUrl || sagPhotos[0]?.url || '',
      photoCode:
        dSag?.photoCode ||
        def.beam_sagging_photo_code ||
        sagPhotos[0]?.photoCode ||
        undefined,
      notes: dSag?.notes || '',
    },
    abnormalCase: {
      photoUrl: dAbnormal?.photoUrl || resolvedAbnormalPhotos[0]?.url || '',
      photoCode:
        dAbnormal?.photoCode ||
        def.abnormal_photo_code ||
        resolvedAbnormalPhotos[0]?.photoCode ||
        undefined,
      photos: resolvedAbnormalPhotos,
      notes: dAbnormal?.notes || '',
    },
    needAdditionalMonitoring: details?.needAdditionalMonitoring || {
      required: e3Lvl >= 2 || tiltLvl >= 2 || Boolean(def.monitoring_notes),
      notes: def.monitoring_notes || '',
    },
    dataSource:
      Array.isArray(details?.dataSource) && details.dataSource.length > 0
        ? details.dataSource
        : def.measurement_method
        ? def.measurement_method
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    reliability,
  };
}

