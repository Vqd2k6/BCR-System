/**
 * Khôi phục khung Bước 3 (tầng / Vùng Z / cấu kiện E / khuyết tật D / CAD) của bản nháp nhà dân từ các ảnh
 * đã upload lên kho, khi nội dung nháp bị ghi đè mất (vd sự cố C&C-04-B-0010 ngày 19/11/2026: KSV khác chiếm ca,
 * bản nháp trên server không còn Bước 3 nhưng 70 ảnh vẫn nằm trên R2 và trong _photoMappings).
 *
 * Nguồn ảnh: CHỈ các URL trong survey_data_json._photoMappings của chính bản nháp (ảnh đã upload cho hồ sơ này).
 * Vị trí ảnh suy từ tên file tự mô tả: HCM_M2__<mã thửa>__F01_Z-03_D-01_CU_02_<mốc ms>_<hash>.jpg
 *
 * Bảo toàn:
 * - Chỉ THÊM vào chỗ trống: tầng chưa có, vùng/cấu kiện/khuyết tật chưa có mã, ô ảnh đang rỗng. Không ghi đè giá trị đang có.
 * - Ảnh chụp lại cùng ô (cùng mã + số thứ tự): lấy ảnh mới nhất, ảnh cũ vẫn nằm trong _photoMappings và trên kho.
 * - Không bịa số liệu: loại/kích thước khuyết tật, cấp Burland, phòng, vật liệu để trống cho KSV nhập lại.
 *   Ghim khuyết tật trên ảnh bối cảnh chưa biết vị trí ⇒ đặt tạm giữa ảnh (50/50), ghi rõ trong _step3Restore để KSV ghim lại.
 *   Ghim Vùng Z / E trên CAD không dựng (KSV ghim lại).
 * - Ghi trong 1 transaction, khóa dòng (FOR UPDATE), chỉ ghi khi sync_version đúng bằng --expect-version (bản đã xem trước).
 *   Tăng sync_version + updated_at để máy KSV mở lại nạp bản server. Toàn bộ survey_data_json trước khi sửa lưu vào
 *   system_audit_logs (RESTORE_STEP3_FROM_PHOTO_MAPPINGS) ⇒ --rollback <audit id> trả lại y nguyên.
 *
 * Chạy (từ thư mục backend):
 *   npx ts-node --transpile-only src/scripts/restore_step3_from_photo_mappings.ts --report <uuid>        # xem trước
 *   ... --report <uuid> --apply --expect-version <n>                     # ghi (DB _test/_scratch)
 *   ... --report <uuid> --apply --expect-version <n> --confirm-real-db   # ghi DB thật
 *   ... --report <uuid> --pins-only [--apply --expect-version <n> ...]   # chỉ thêm ghim giữ chỗ còn thiếu (Z/E/D)
 *   ... --rollback <audit uuid> [--confirm-real-db] [--force]            # trả lại bản trước khi khôi phục / thêm ghim
 *   Tuỳ chọn: --floor-names "Tầng trệt|Tầng 1 (Lầu 1)|Tầng 2 (Lầu 2)|Tầng 3 (Lầu 3)"
 */
import dotenv from 'dotenv';
dotenv.config();

import { Database } from '../database/db';

const TAG = 'restore_step3_from_photo_mappings';
const ACTION = 'RESTORE_STEP3_FROM_PHOTO_MAPPINGS';
const PINS_ACTION = 'RESTORE_STEP3_PLACEHOLDER_PINS';
const ROLLBACK_ACTION = 'ROLLBACK_RESTORE_STEP3_FROM_PHOTO_MAPPINGS';

const args = process.argv.slice(2);
const argValue = (flag: string): string | undefined => {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
};
const reportId = argValue('--report');
const rollbackAuditId = argValue('--rollback');
const isApply = args.includes('--apply');
const allowRealDb = args.includes('--confirm-real-db');
const force = args.includes('--force');
const expectVersionArg = argValue('--expect-version');
const floorNamesArg = argValue('--floor-names');
/** Chỉ thêm ghim giữ chỗ còn thiếu (Z/E trên CAD, D trên ảnh bối cảnh), không bù ảnh / ô trống nào khác */
const pinsOnly = args.includes('--pins-only');

type Json = Record<string, unknown>;
type SlotKind = 'OVERVIEW' | 'CU' | 'CAD_ARCH' | 'CAD_STRUCT';

interface ParsedPhoto {
  url: string;
  localId: string;
  floor: number;
  group: 'Z' | 'E' | null;
  groupCode: string | null; // Z-03 / E-01
  defectCode: string | null; // D-01
  kind: SlotKind;
  index: number; // _01, _02...
  capturedMs: number;
  photoCode: string;
}

interface ReportRow {
  id: string;
  status: string;
  sync_version: number;
  deleted_at: Date | null;
  project_parcel_code: string;
  survey_data_json: Json | string | null;
}

const asObject = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asString = (v: unknown): string => (typeof v === 'string' ? v : '');
const isBlank = (v: unknown): boolean => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const pad2 = (n: number): string => String(n).padStart(2, '0');

const FILE_RE = /\/HCM_M2__[^/]+?__(.+)_(\d{2})_(\d{13})_[0-9a-f]+\.(?:jpe?g|png|webp)$/i;
const SLOT_RE = /^F(\d{2})(?:_(Z|E)-(\d{2}))?(?:_D-(\d{2}))?_(OVERVIEW|CU|CAD_ARCH|CAD_STRUCT)$/;

function parsePhoto(localId: string, url: string, parcelCode: string): ParsedPhoto | null {
  const m = FILE_RE.exec(url);
  if (!m) return null;
  const [, slot, idx, ms] = m;
  const s = SLOT_RE.exec(slot);
  if (!s) return null;
  const [, floor, group, groupNo, defectNo, kind] = s;
  return {
    url,
    localId,
    floor: Number(floor),
    group: (group as 'Z' | 'E' | undefined) ?? null,
    groupCode: group ? `${group}-${groupNo}` : null,
    defectCode: defectNo ? `D-${defectNo}` : null,
    kind: kind as SlotKind,
    index: Number(idx),
    capturedMs: Number(ms),
    photoCode: `HCM_M2.[${parcelCode}]_${slot}_${idx}`,
  };
}

/** Ảnh chụp lại cùng ô: giữ ảnh mới nhất; trả về danh sách bị thay để báo cáo */
function latestPerSlot(photos: ParsedPhoto[]): { kept: ParsedPhoto[]; superseded: ParsedPhoto[] } {
  const bySlot = new Map<string, ParsedPhoto[]>();
  for (const p of photos) {
    const key = `${p.floor}|${p.groupCode ?? ''}|${p.defectCode ?? ''}|${p.kind}|${p.index}`;
    const list = bySlot.get(key) || [];
    list.push(p);
    bySlot.set(key, list);
  }
  const kept: ParsedPhoto[] = [];
  const superseded: ParsedPhoto[] = [];
  for (const list of bySlot.values()) {
    list.sort((a, b) => b.capturedMs - a.capturedMs);
    kept.push(list[0]);
    superseded.push(...list.slice(1));
  }
  kept.sort((a, b) => a.capturedMs - b.capturedMs);
  return { kept, superseded };
}

const byIndexThenTime = (a: ParsedPhoto, b: ParsedPhoto) => a.index - b.index || a.capturedMs - b.capturedMs;

function defaultFloorName(n: number): string {
  return n === 0 ? 'Tầng trệt' : `Tầng ${n} (Lầu ${n})`;
}

function buildDefect(code: string, cu: ParsedPhoto[], stamp: number): Json {
  const photos = [...cu].sort(byIndexThenTime);
  return {
    id: `def_restored_${stamp}_${code}`,
    defectCode: code,
    pinX: 50,
    pinY: 50,
    screeningCategory: '',
    customScreeningCategory: '',
    defectType: '',
    crackDirection: '',
    widthMaxMm: '',
    lengthMm: '',
    activityState: '',
    materialDegradationE4: '',
    structuralSignificanceE2: '',
    functionalImpactE6: '',
    hasScaleCard: false,
    isStructuralCritical: false,
    cuPhotoUrl: photos[0]?.url || '',
    cuPhotoCode: photos[0]?.photoCode || '',
    cuPhotos: photos.map((p) => p.url),
    cuPhotoCodes: photos.map((p) => p.photoCode),
    cuPhotoTimestamps: photos.map((p) => new Date(p.capturedMs).toISOString()),
    capturedAt: photos[0] ? new Date(photos[0].capturedMs).toISOString() : undefined,
    notes: '',
    customizedFields: [],
  };
}

interface RestoreResult {
  next: Json;
  added: string[];
  needsReview: string[];
  superseded: string[];
  unparsed: string[];
  pinReport: string[];
  skipped: string[];
}

function restoreStep3(data: Json, parcelCode: string, floorNames: string[]): RestoreResult {
  const stamp = Date.now();
  const mappings = asObject(data._photoMappings);
  const parsed: ParsedPhoto[] = [];
  const unparsed: string[] = [];
  for (const [localId, url] of Object.entries(mappings)) {
    if (typeof url !== 'string') continue;
    const p = parsePhoto(localId, url, parcelCode);
    if (p) parsed.push(p);
    else unparsed.push(url.replace(/^.*\//, ''));
  }
  const { kept, superseded } = latestPerSlot(parsed);

  const added: string[] = [];
  const needsReview: string[] = [];
  const floors = asArray(data.floors).map((f) => ({ ...asObject(f) }));
  const maxFloor = kept.reduce((mx, p) => Math.max(mx, p.floor), -1);

  for (let n = 0; n <= maxFloor; n++) {
    const fPhotos = kept.filter((p) => p.floor === n);
    if (fPhotos.length === 0) continue;
    const fLabel = `F${pad2(n)}`;
    let floor = floors[n];
    if (!floor && n > floors.length) {
      // Không có ảnh tầng nào ở giữa: không tự bịa tầng trống, dừng để người vận hành quyết định
      throw new Error(`Thiếu tầng F${pad2(floors.length)} trước F${pad2(n)}: không dựng được thứ tự tầng.`);
    }
    if (!floor) {
      const name = floorNames[n] || defaultFloorName(n);
      floor = {
        id: n === 0 ? 'floor_ground' : `floor_restored_${stamp}_${n}`,
        floorName: name,
        overviewPhotos: [],
        cadSketchPhotoUrl: '',
        cadZonePins: [],
        cadElementPins: [],
        zones: [],
        structuralElements: [],
        hasZones: true,
      };
      floors[n] = floor;
      added.push(`${fLabel}: tạo tầng "${name}"`);
      needsReview.push(`${fLabel}: xác nhận tên tầng "${name}"`);
    }
    const floorName = asString(floor.floorName) || floorNames[n] || defaultFloorName(n);

    // Ảnh toàn cảnh tầng
    const floorOverview = fPhotos.filter((p) => !p.groupCode && p.kind === 'OVERVIEW').sort(byIndexThenTime);
    if (floorOverview.length > 0 && isBlank(floor.overviewPhotos)) {
      floor.overviewPhotos = floorOverview.map((p, i) => ({
        id: `fl_ov_restored_${stamp}_${n}_${i}`,
        url: p.url,
        caption: '',
        photoCode: p.photoCode,
      }));
      added.push(`${fLabel}: ${floorOverview.length} ảnh toàn cảnh tầng`);
    }

    // CAD kiến trúc / kết cấu
    const cadArch = fPhotos.filter((p) => !p.groupCode && p.kind === 'CAD_ARCH').sort(byIndexThenTime)[0];
    if (cadArch && isBlank(floor.cadSketchPhotoUrl)) {
      floor.cadSketchPhotoUrl = cadArch.url;
      floor.cadSketchPhotoCode = cadArch.photoCode;
      added.push(`${fLabel}: CAD kiến trúc`);
    }
    const cadStruct = fPhotos.filter((p) => !p.groupCode && p.kind === 'CAD_STRUCT').sort(byIndexThenTime)[0];
    if (cadStruct && isBlank(floor.cadStructuralSketchPhotoUrl)) {
      floor.cadStructuralSketchPhotoUrl = cadStruct.url;
      floor.cadStructuralSketchPhotoCode = cadStruct.photoCode;
      added.push(`${fLabel}: CAD kết cấu`);
    }

    // Vùng Z / cấu kiện E
    for (const group of ['Z', 'E'] as const) {
      const listKey = group === 'Z' ? 'zones' : 'structuralElements';
      const codeKey = group === 'Z' ? 'zoneCode' : 'elementCode';
      const items = asArray(floor[listKey]).map((x) => ({ ...asObject(x) }));
      const codes = Array.from(new Set(fPhotos.filter((p) => p.group === group).map((p) => p.groupCode as string))).sort();
      for (const code of codes) {
        const gPhotos = fPhotos.filter((p) => p.groupCode === code);
        const overview = gPhotos.filter((p) => !p.defectCode && p.kind === 'OVERVIEW').sort(byIndexThenTime);
        const defectCodes = Array.from(new Set(gPhotos.filter((p) => p.defectCode).map((p) => p.defectCode as string))).sort();

        let item = items.find((x) => asString(x[codeKey]) === code && !x.isDeleted && !x.is_deleted);
        if (!item) {
          item =
            group === 'Z'
              ? {
                  id: `zone_restored_${stamp}_${n}_${code}`,
                  zoneCode: code,
                  floorName,
                  roomName: '',
                  customRoomName: '',
                  componentType: '',
                  customComponentType: '',
                  wallMaterial: '',
                  customWallMaterial: '',
                  overviewPhotos: [],
                  notes: '',
                  defects: [],
                  hasDamage: false,
                  isCompleted: false,
                  customizedFields: [],
                }
              : {
                  id: `el_restored_${stamp}_${n}_${code}`,
                  elementCode: code,
                  floorName,
                  roomName: '',
                  customRoomName: '',
                  elementType: '',
                  customElementType: '',
                  materialType: '',
                  customMaterialType: '',
                  overviewPhotos: [],
                  notes: '',
                  defects: [],
                  hasDamage: false,
                  isCompleted: false,
                  customizedFields: [],
                };
          items.push(item);
          added.push(`${fLabel} ${code}: tạo ${group === 'Z' ? 'vùng' : 'cấu kiện'}`);
          needsReview.push(
            `${fLabel} ${code}: nhập lại ${group === 'Z' ? 'phòng, loại mảng tường/cấu kiện, vật liệu tường' : 'phòng, loại cấu kiện, vật liệu, tiết diện'}, ghim lại trên CAD`
          );
        }
        if (overview.length > 0 && isBlank(item.overviewPhotos)) {
          item.overviewPhotos = overview.map((p) => p.url);
          added.push(`${fLabel} ${code}: ${overview.length} ảnh tổng quan`);
        }
        if (overview.length > 0 && isBlank(item.ctxPhotoUrl)) {
          item.ctxPhotoUrl = overview[0].url;
          item.ctxPhotoCode = overview[0].photoCode;
        }

        const defects = asArray(item.defects).map((d) => ({ ...asObject(d) }));
        for (const dCode of defectCodes) {
          const cu = gPhotos.filter((p) => p.defectCode === dCode && p.kind === 'CU');
          const existing = defects.find((d) => asString(d.defectCode) === dCode);
          if (!existing) {
            defects.push(buildDefect(dCode, cu, stamp));
            added.push(`${fLabel} ${code} ${dCode}: tạo khuyết tật, ${cu.length} ảnh cận cảnh`);
            needsReview.push(
              `${fLabel} ${code} ${dCode}: ghim tạm giữa ảnh bối cảnh, nhập lại loại/kích thước/trạng thái khuyết tật`
            );
          } else if (isBlank(existing.cuPhotos) && isBlank(existing.cuPhotoUrl) && cu.length > 0) {
            const rebuilt = buildDefect(dCode, cu, stamp);
            existing.cuPhotoUrl = rebuilt.cuPhotoUrl;
            existing.cuPhotoCode = rebuilt.cuPhotoCode;
            existing.cuPhotos = rebuilt.cuPhotos;
            existing.cuPhotoCodes = rebuilt.cuPhotoCodes;
            existing.cuPhotoTimestamps = rebuilt.cuPhotoTimestamps;
            added.push(`${fLabel} ${code} ${dCode}: ${cu.length} ảnh cận cảnh`);
          }
        }
        item.defects = defects;
        if (defects.length > 0) item.hasDamage = true;
      }
      floor[listKey] = items;
      if (group === 'E' && items.length > 0 && floor.hasStructuralElements === undefined) {
        floor.hasStructuralElements = true;
      }
    }
  }

  const next: Json = { ...data, floors };

  // Phạm vi khảo sát phải liệt kê các tầng có dữ liệu
  const scope = asObject(data.surveyScope);
  const surveyed = asArray(scope.surveyedFloors).filter((x): x is string => typeof x === 'string');
  const floorNamesNow = floors.map((f) => asString(asObject(f).floorName)).filter(Boolean);
  const missing = floorNamesNow.filter((nm) => !surveyed.includes(nm));
  if (missing.length > 0) {
    next.surveyScope = { ...scope, surveyedFloors: [...surveyed, ...missing] };
    added.push(`Phạm vi khảo sát: thêm ${missing.join(', ')}`);
  }

  next._step3Restore = {
    restoredAt: new Date().toISOString(),
    source: '_photoMappings',
    needsReview,
  };

  // Vùng/cấu kiện/khuyết tật vừa dựng chưa có ghim: thêm ghim giữ chỗ đúng mã để KSV kéo về đúng vị trí
  const pins = addPlaceholderPins(next);

  return {
    next: pins.next,
    added: [...added, ...pins.added],
    needsReview: [...needsReview, ...pins.needsReview],
    superseded: superseded.map((p) => `${p.photoCode} (${new Date(p.capturedMs).toISOString()})`),
    unparsed,
    pinReport: pins.pinReport,
    skipped: pins.skipped,
  };
}

/** Vị trí giữ chỗ: hàng ngang ở mép trên ảnh, 9 ghim/hàng (đơn vị %) */
const parkedPosition = (i: number): { pinX: number; pinY: number } => ({
  pinX: 6 + 11 * (i % 9),
  pinY: 5 + 7 * Math.floor(i / 9),
});

const isActiveItem = (x: Json): boolean => !x.isDeleted && !x.is_deleted;
const hasNumericPin = (d: Json): boolean =>
  typeof d.pinX === 'number' && Number.isFinite(d.pinX) && typeof d.pinY === 'number' && Number.isFinite(d.pinY);

interface PinResult {
  next: Json;
  added: string[];
  needsReview: string[];
  /** Mọi ghim khuyết tật D sau xử lý, để người vận hành rà không sót */
  pinReport: string[];
  /** Mã không xử lý được (vùng trùng mã, tầng thiếu ảnh CAD), cần xử lý tay */
  skipped: string[];
}

/**
 * Ghim gắn với vùng CHỈ qua mã (pin.zoneCode = zone.zoneCode / element.elementCode). Chạm chấm ghim mới trên app
 * luôn sinh thêm vùng mới (mã theo số ghim đang có) ⇒ vùng đã khôi phục phải có sẵn ghim đúng mã.
 * - Z → floor.cadZonePins (type ZONE) trên CAD kiến trúc; E → floor.cadElementPins (type STRUCTURAL) trên CAD kết cấu.
 * - D: pinX/pinY nằm trong chính khuyết tật (trên ảnh bối cảnh của vùng); chỉ đặt khi chưa có tọa độ số.
 * Chỉ thêm ghim còn thiếu; ghim/tọa độ đang có giữ nguyên. Mã có 2 vùng trùng ⇒ bỏ qua, báo ra.
 */
function addPlaceholderPins(data: Json): PinResult {
  const stamp = Date.now();
  const added: string[] = [];
  const needsReview: string[] = [];
  const pinReport: string[] = [];
  const skipped: string[] = [];

  const floors = asArray(data.floors).map((f, n) => {
    const floor = { ...asObject(f) };
    const fLabel = `F${pad2(n)}`;

    for (const group of ['Z', 'E'] as const) {
      const listKey = group === 'Z' ? 'zones' : 'structuralElements';
      const codeKey = group === 'Z' ? 'zoneCode' : 'elementCode';
      const pinsKey = group === 'Z' ? 'cadZonePins' : 'cadElementPins';
      const cadKey = group === 'Z' ? 'cadSketchPhotoUrl' : 'cadStructuralSketchPhotoUrl';
      const cadLabel = group === 'Z' ? 'CAD kiến trúc' : 'CAD kết cấu';

      const items = asArray(floor[listKey]).map((x) => ({ ...asObject(x) }));
      const active = items.filter(isActiveItem);
      const countByCode = new Map<string, number>();
      for (const it of active) {
        const c = asString(it[codeKey]);
        if (c) countByCode.set(c, (countByCode.get(c) || 0) + 1);
      }

      // Ghim Z / E trên CAD
      const pins = asArray(floor[pinsKey]).map((p) => ({ ...asObject(p) }));
      const pinned = new Set(pins.map((p) => asString(p.zoneCode) || asString(p.label)).filter(Boolean));
      const noun = group === 'Z' ? 'vùng' : 'cấu kiện';
      // Mã trùng đã có ghim: ghim trỏ mơ hồ tới 2 vùng (thường do chạm chấm trên CAD sinh vùng mới)
      for (const [code, cnt] of countByCode) {
        if (cnt > 1 && pinned.has(code)) {
          skipped.push(`${fLabel} ${code}: có ${cnt} ${noun} trùng mã (đã có ghim), cần xóa ${noun} thừa bằng tay`);
        }
      }
      // Ghim mồ côi: không còn vùng nào mang mã này
      for (const code of pinned) {
        if (!countByCode.has(code)) skipped.push(`${fLabel} ${code}: ghim trên ${cadLabel} không còn ${noun} nào cùng mã`);
      }
      const missingCodes = Array.from(countByCode.keys())
        .filter((c) => !pinned.has(c))
        .sort();
      let parked = 0;
      for (const code of missingCodes) {
        if ((countByCode.get(code) || 0) > 1) {
          skipped.push(`${fLabel} ${code}: có ${countByCode.get(code)} ${group === 'Z' ? 'vùng' : 'cấu kiện'} trùng mã, không gắn ghim (xử lý tay)`);
          continue;
        }
        if (isBlank(floor[cadKey])) {
          skipped.push(`${fLabel} ${code}: tầng chưa có ảnh ${cadLabel}, chưa gắn ghim được`);
          continue;
        }
        const prefix = group === 'Z' ? 'z' : 'e';
        pins.push({
          id: `pin-${prefix}-restored-${stamp}-${n}-${code}`,
          ...parkedPosition(parked++),
          type: group === 'Z' ? 'ZONE' : 'STRUCTURAL',
          label: code,
          zoneCode: code,
        });
        added.push(`${fLabel} ${code}: ghim giữ chỗ trên ${cadLabel}`);
        needsReview.push(`${fLabel} ${code}: kéo ghim về đúng vị trí trên ${cadLabel}`);
      }
      floor[pinsKey] = pins;

      // Ghim khuyết tật D trên ảnh bối cảnh của vùng
      for (const it of items) {
        if (!isActiveItem(it)) continue;
        const code = asString(it[codeKey]);
        let dParked = 0;
        const defects = asArray(it.defects).map((d) => ({ ...asObject(d) }));
        for (const d of defects) {
          const dCode = asString(d.defectCode) || asString(d.defect_code) || '?';
          if (!hasNumericPin(d)) {
            Object.assign(d, parkedPosition(dParked++));
            added.push(`${fLabel} ${code} ${dCode}: ghim giữ chỗ trên ảnh bối cảnh`);
            needsReview.push(`${fLabel} ${code} ${dCode}: kéo ghim về đúng vết nứt trên ảnh bối cảnh`);
          }
          const ctx = asString(it.ctxPhotoUrl) ? 'có ảnh bối cảnh' : 'CHƯA có ảnh bối cảnh';
          const cuCount = asArray(d.cuPhotos).length || (asString(d.cuPhotoUrl) ? 1 : 0);
          pinReport.push(`${fLabel} ${code} ${dCode}: ${ctx}, ghim (${String(d.pinX)}, ${String(d.pinY)}), ${cuCount} ảnh cận cảnh`);
        }
        it.defects = defects;
      }
      floor[listKey] = items;
    }
    return floor;
  });

  const next: Json = { ...data, floors };
  if (needsReview.length > 0) {
    const prev = asObject(data._step3Restore);
    const prevReview = asArray(prev.needsReview).filter((x): x is string => typeof x === 'string');
    next._step3Restore = {
      ...prev,
      pinsAddedAt: new Date().toISOString(),
      needsReview: [...prevReview, ...needsReview.filter((x) => !prevReview.includes(x))],
    };
  }
  return { next, added, needsReview, pinReport, skipped };
}

async function assertWritableDb(): Promise<string> {
  const { rows } = await Database.query<{ db: string }>(`SELECT current_database() AS db;`);
  const dbName = rows[0]?.db ?? '?';
  if (!/_(test|scratch)$/.test(dbName) && !allowRealDb) {
    throw new Error(`Từ chối ghi vào "${dbName}": DB không phải bản nháp (_test/_scratch) cần thêm --confirm-real-db.`);
  }
  return dbName;
}

const parseJson = (v: Json | string | null): Json => (typeof v === 'string' ? (JSON.parse(v) as Json) : asObject(v));

async function runRestore(id: string): Promise<void> {
  const { rows } = await Database.query<ReportRow>(
    `SELECT r.id, r.status::text AS status, r.sync_version, r.deleted_at, p.project_parcel_code, r.survey_data_json
     FROM base_survey_reports r JOIN parcels p ON p.id = r.parcel_id
     WHERE r.id = $1;`,
    [id]
  );
  const row = rows[0];
  if (!row) throw new Error(`Không tìm thấy báo cáo ${id}`);
  const { rows: dbRows } = await Database.query<{ db: string }>(`SELECT current_database() AS db;`);
  console.log(`[${TAG}] DB ${dbRows[0]?.db} | ${row.project_parcel_code} | báo cáo ${row.id} | ${row.status} | sync_version ${row.sync_version}`);
  if (row.deleted_at) throw new Error('Báo cáo đã bị xóa mềm, không khôi phục.');
  if (row.status !== 'DRAFT' && row.status !== 'REJECTED') {
    throw new Error(`Chỉ khôi phục bản nháp DRAFT/REJECTED, báo cáo đang ${row.status}.`);
  }

  const floorNames = floorNamesArg ? floorNamesArg.split('|').map((s) => s.trim()) : [];
  const transform = (data: Json, parcelCode: string): RestoreResult => {
    if (!pinsOnly) return restoreStep3(data, parcelCode, floorNames);
    const pins = addPlaceholderPins(data);
    return { ...pins, superseded: [], unparsed: [] };
  };
  const action = pinsOnly ? PINS_ACTION : ACTION;
  console.log(`[${TAG}] Chế độ: ${pinsOnly ? 'CHỈ THÊM GHIM GIỮ CHỖ (--pins-only)' : 'KHÔI PHỤC ĐẦY ĐỦ'}`);
  const preview = transform(parseJson(row.survey_data_json), row.project_parcel_code);
  console.log(`\nSẽ bổ sung (${preview.added.length}):`);
  preview.added.forEach((a) => console.log(`  + ${a}`));
  console.log(`\nKSV cần rà/nhập lại (${preview.needsReview.length}):`);
  preview.needsReview.forEach((a) => console.log(`  ! ${a}`));
  if (preview.superseded.length > 0) {
    console.log(`\nẢnh chụp lại cùng ô (giữ ảnh mới nhất, ảnh cũ vẫn trên kho) (${preview.superseded.length}):`);
    preview.superseded.forEach((a) => console.log(`  ~ ${a}`));
  }
  if (preview.unparsed.length > 0) {
    console.log(`\nẢnh không thuộc Bước 3 / không đọc được tên, bỏ qua (${preview.unparsed.length}):`);
    preview.unparsed.forEach((a) => console.log(`  - ${a}`));
  }
  console.log(`\nToàn bộ khuyết tật D sau xử lý (${preview.pinReport.length}):`);
  preview.pinReport.forEach((a) => console.log(`  D ${a}`));
  if (preview.skipped.length > 0) {
    console.log(`\nKHÔNG xử lý được, cần xử lý tay (${preview.skipped.length}):`);
    preview.skipped.forEach((a) => console.log(`  ✗ ${a}`));
  }

  if (!isApply) {
    console.log(`\n[${TAG}] Chỉ xem trước. Ghi: ${pinsOnly ? '--pins-only ' : ''}--apply --expect-version ${row.sync_version}`);
    return;
  }
  if (preview.added.length === 0) {
    console.log(`\n[${TAG}] Không có gì để bổ sung, không ghi.`);
    return;
  }
  const expectVersion = Number(expectVersionArg);
  if (!Number.isInteger(expectVersion)) throw new Error('Thiếu --expect-version <sync_version đã xem trước>.');
  await assertWritableDb();

  const result = await Database.transaction(async (client) => {
    const locked = await client.query<ReportRow>(
      `SELECT r.id, r.status::text AS status, r.sync_version, r.deleted_at, p.project_parcel_code, r.survey_data_json
       FROM base_survey_reports r JOIN parcels p ON p.id = r.parcel_id
       WHERE r.id = $1 FOR UPDATE OF r;`,
      [id]
    );
    const cur = locked.rows[0];
    if (!cur || cur.sync_version !== expectVersion || cur.deleted_at || (cur.status !== 'DRAFT' && cur.status !== 'REJECTED')) {
      throw new Error(
        `Bản nháp đã thay đổi (sync_version ${cur?.sync_version} ≠ ${expectVersion} hoặc đổi trạng thái). Xem trước lại rồi chạy lại.`
      );
    }
    const before = parseJson(cur.survey_data_json);
    const restored = transform(before, cur.project_parcel_code);
    const upd = await client.query<{ sync_version: number }>(
      `UPDATE base_survey_reports
       SET survey_data_json = $2::jsonb, sync_version = sync_version + 1, updated_at = NOW()
       WHERE id = $1 AND sync_version = $3
       RETURNING sync_version;`,
      [id, JSON.stringify(restored.next), expectVersion]
    );
    if (upd.rowCount !== 1) throw new Error('Không ghi được (bản nháp vừa đổi).');
    const audit = await client.query<{ id: string }>(
      `INSERT INTO system_audit_logs (entity_type, entity_id, action, diff_payload)
       VALUES ('BASE_SURVEY_REPORT', $1, $2, $3::jsonb) RETURNING id;`,
      [
        id,
        action,
        JSON.stringify({
          parcelCode: cur.project_parcel_code,
          beforeSyncVersion: expectVersion,
          afterSyncVersion: upd.rows[0].sync_version,
          added: restored.added,
          needsReview: restored.needsReview,
          before,
        }),
      ]
    );
    return { auditId: audit.rows[0].id, syncVersion: upd.rows[0].sync_version };
  });
  console.log(`\n[${TAG}] ĐÃ GHI. sync_version mới ${result.syncVersion}. Audit ${result.auditId}`);
  console.log(`[${TAG}] Hoàn tác: --rollback ${result.auditId}${allowRealDb ? ' --confirm-real-db' : ''}`);
}

async function runRollback(auditId: string): Promise<void> {
  await assertWritableDb();
  const { rows } = await Database.query<{ entity_id: string; diff_payload: Json }>(
    `SELECT entity_id, diff_payload FROM system_audit_logs WHERE id = $1 AND action = ANY($2::text[]);`,
    [auditId, [ACTION, PINS_ACTION]]
  );
  const audit = rows[0];
  if (!audit) throw new Error(`Không tìm thấy audit ${ACTION}/${PINS_ACTION} ${auditId}`);
  const payload = asObject(audit.diff_payload);
  const before = asObject(payload.before);
  const afterVersion = Number(payload.afterSyncVersion);

  const result = await Database.transaction(async (client) => {
    const cur = await client.query<{ sync_version: number }>(
      `SELECT sync_version FROM base_survey_reports WHERE id = $1 FOR UPDATE;`,
      [audit.entity_id]
    );
    const version = cur.rows[0]?.sync_version;
    if (version !== afterVersion && !force) {
      throw new Error(
        `Bản nháp đã được sửa sau khi khôi phục (sync_version ${version} ≠ ${afterVersion}). Rollback sẽ mất các sửa đó; thêm --force nếu chắc chắn.`
      );
    }
    const upd = await client.query<{ sync_version: number }>(
      `UPDATE base_survey_reports SET survey_data_json = $2::jsonb, sync_version = sync_version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING sync_version;`,
      [audit.entity_id, JSON.stringify(before)]
    );
    await client.query(
      `INSERT INTO system_audit_logs (entity_type, entity_id, action, diff_payload)
       VALUES ('BASE_SURVEY_REPORT', $1, $2, $3::jsonb);`,
      [audit.entity_id, ROLLBACK_ACTION, JSON.stringify({ restoreAuditId: auditId, fromSyncVersion: version, forced: force })]
    );
    return upd.rows[0].sync_version;
  });
  console.log(`[${TAG}] Đã trả lại bản trước khôi phục. sync_version mới ${result}.`);
}

async function main(): Promise<void> {
  if (rollbackAuditId) return runRollback(rollbackAuditId);
  if (!reportId) throw new Error('Cần --report <uuid> hoặc --rollback <audit uuid>.');
  return runRestore(reportId);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(`[${TAG}] Thất bại:`, err);
    process.exit(1);
  });
