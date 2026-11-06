import type { ProgressRecord, RawProgressRow } from '../progress-report.types';
import type { ProgressReportConfig } from '../config/config.schema';
import { arrayLength, firstNumber, firstText, getPath, stripPrefix, text, toNumber } from './json-reader';
import {
  classifyBraGrade,
  classifyCondition,
  classifyEcsCondition,
  isInaccessible,
  resolveConstructionYear,
} from './condition.classifier';
import { mapSurveyProgress } from './survey-status.mapper';
import { resolveAlignmentSide, resolveStationCode } from './alignment-side';
import { resolveOwnerName, resolveOwnerPhone } from './owner-name.resolver';
import { normalizeUsageFunction } from './usage-normalizer';

/**
 * Chuẩn hóa 1 bản ghi thô thành ProgressRecord:
 * 1. Tách "Tình trạng hiện tại" (ECS) và "Mức độ đánh giá rủi ro" (BRA).
 * 2. Dài / Rộng / Cao: ưu tiên kiểm tra hồ sơ đã nộp/duyệt (SUBMITTED/UNDER_REVIEW/APPROVED) → không có thì để trống.
 * 3. Tim tuyến / Biên kết cấu: lấy trực tiếp theo hình học GIS hiện tại (fallback JSON nếu thiếu hình học).
 */

export const UNKNOWN_FOUNDATION = 'Không rõ';
const MISSING_MARK = '---';

export function mapFoundationLabel(raw: string): string {
  const s = raw.toLowerCase();
  if (!s.trim()) return '';
  if (s.includes('khoan nhồi') || /\bcip\b/.test(s) || s.includes('bored')) return 'Móng cọc khoan nhồi';
  if (s.includes('cừ') || s.includes('gỗ') || s.includes('wood')) return 'Cọc gỗ';
  if (s.includes('nông') || s.includes('shallow') || s.includes('băng') || s.includes('móng đơn') || s.includes('bè')) {
    return 'Móng nông';
  }
  if (s.includes('cọc') || /\bpc\b/.test(s) || s.includes('pile')) return 'Móng cọc';
  if (s.includes('cat_1') || s.includes('cat_2') || s.includes('cat_3')) return 'Móng nông';
  if (s.includes('cat_4')) return 'Móng cọc';
  return UNKNOWN_FOUNDATION;
}

/** Nhãn khớp form KSV: căn hộ (CONDO_UNIT_ABSENCE_REASONS, residentStatus), nhà dân, khu vực chung tòa mẹ. */
export const ABSENCE_REASON_VI: Record<string, string> = {
  HOMEOWNER_ABSENT: 'Chủ nhà đi vắng / Khóa cửa ngoài',
  LOCKED_GATE: 'Khóa cổng, không có người',
  REFUSED_ACCESS: 'Chủ nhà hoặc khách thuê từ chối tiếp cận',
  UNOCCUPIED_EMPTY: 'Nhà / căn hộ bỏ trống, chưa về ở',
  LOCKED_SECURITY: 'Căn hộ niêm phong / BQL không có chìa khóa',
  OTHER: 'Lý do khác',
  'VẮNG_MẶT_KHÓA_CỬA': 'Vắng mặt khóa cửa ngoài (Không tiếp cận được)',
  'BỎ_TRỐNG_CHƯA_VỀ_Ở': 'Căn hộ bỏ trống / Chưa có người về ở',
  'CHO_THUÊ': 'Cho thuê (vắng tại thời điểm khảo sát)',
  'CHỦ_HỘ_Ở': 'Chủ hộ ở (vắng tại thời điểm khảo sát)',
};

const ENUM_CODE_PATTERN = /^[\p{Lu}\d_]+$/u;
const OTHER_PREFIX = /^\s*Khác:\s*/;

/** Mã enum (viết hoa, gạch dưới), kể cả mã tiếng Việt có dấu như `CHO_THUÊ`. */
export function isEnumCode(value: string): boolean {
  return value.length > 1 && ENUM_CODE_PATTERN.test(value);
}

export function translateAbsenceReason(raw: unknown): string {
  const s = text(raw);
  if (!s) return '';
  const key = s.toUpperCase();
  if (ABSENCE_REASON_VI[key]) return ABSENCE_REASON_VI[key];
  if (OTHER_PREFIX.test(s)) return s.replace(OTHER_PREFIX, '').trim() || ABSENCE_REASON_VI.OTHER;
  if (isEnumCode(s)) {
    console.warn('[ProgressReport:UnknownAbsenceReason]', s);
    const words = s.replace(/_/g, ' ').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return s;
}

function comparable(value: string): string {
  return value.toLowerCase().replace(/[.,;:!?()/–—-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function formatFloor(floor: number | null): string {
  if (floor === null) return '';
  if (floor === 0) return 'Trệt';
  return `Lầu ${Number.isInteger(floor) ? floor : floor.toFixed(1)}`;
}

/** Chỉ nhận số dương (> 0); nếu 0 hoặc không có thì trả về null (để trống trên Excel). */
function positiveNumber(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    const n = toNumber(c);
    if (n !== null && n > 0) return n;
  }
  return null;
}

/** Lý do cụ thể KSV chọn/nhập (văn bản) ưu tiên hơn nhãn enum chung của nhật ký; `OTHER` không che lý do tự nhập. */
function resolveAbsenceReason(row: RawProgressRow): string {
  const json = row.reportJson;
  const specific = [
    getPath(json, 'customAbsenteeReason'),
    getPath(json, 'absenteeInfo.customReason'),
    getPath(json, 'absenteeReason'),
  ]
    .map(text)
    .find((v) => v && !isEnumCode(v) && v !== ABSENCE_REASON_VI.OTHER);
  if (specific) return translateAbsenceReason(specific);

  const coded = [
    row.absenceReason,
    getPath(json, 'absenteeInfo.absenceReason'),
    getPath(json, 'absenteeReason'),
    getPath(json, 'residentStatus'),
  ]
    .map(text)
    .filter(Boolean);
  const meaningful = coded.find((v) => v.toUpperCase() !== 'OTHER');
  return translateAbsenceReason(meaningful ?? coded[0] ?? '');
}

function resolveAbsenceNotes(row: RawProgressRow): string {
  return firstText(row.absenceNotes, getPath(row.reportJson, 'absenteeInfo.notes'), getPath(row.reportJson, 'absenteeNotes'));
}

/** Lý do chọn sẵn trên form nhà dân (ABSENTEE_REASONS ở step1.constants.ts); nhật ký vắng hay chép nguyên vào ghi chú. */
const RESIDENTIAL_ABSENCE_PRESETS = new Set(
  [
    'Chủ hộ vắng mặt dài ngày (khóa cửa ngoài)',
    'Chủ hộ đi làm, không có người lớn ở nhà',
    'Từ chối phối hợp khảo sát',
    'Khu đất trống / Nhà đang tranh chấp',
  ].map(comparable)
);

/** Ghi chú KSV gõ cho đủ ô, không thêm thông tin so với nhãn lý do. */
const TRIVIAL_ABSENCE_NOTES = new Set(['', 'không', 'không có', 'vắng', 'vắng mặt', 'vắng chủ', 'n a']);

function joinReasonAndNotes(reason: string, rawNotes: string): string {
  const notes = TRIVIAL_ABSENCE_NOTES.has(comparable(rawNotes)) ? '' : rawNotes;
  if (!reason) return notes;
  if (!notes) return reason;
  // Ghi chú là lý do cụ thể đã chọn trên form thì nhãn enum chung chỉ lặp ý.
  if (RESIDENTIAL_ABSENCE_PRESETS.has(comparable(notes))) return notes;
  const r = comparable(reason);
  const n = comparable(notes);
  if (n.includes(r)) return notes;
  if (r.includes(n)) return reason;
  return `${reason} – ${notes}`;
}

/**
 * Bản tiến độ chỉ ghi lý do chưa vào được nhà; công trình tiếp cận được để trống.
 * Hạn chế tiếp cận, ý kiến chủ hộ, lịch sử cải tạo thuộc báo cáo chi tiết, không đưa vào đây.
 */
function buildNotes(row: RawProgressRow, inaccessible: boolean): string {
  return inaccessible ? joinReasonAndNotes(resolveAbsenceReason(row), resolveAbsenceNotes(row)) : '';
}

/** Dòng tòa mẹ: thông số nền tảng căn hộ con kế thừa; thiếu hồ sơ tòa mẹ thì để "---", không suy đoán. */
function buildMasterLabel(row: RawProgressRow, buildingName: string, street: string, ward: string): string {
  const master = row.masterJson;
  const house = text(row.parcelHouseNumber);
  const nameHasHouse = Boolean(house) && buildingName.toLowerCase().includes(house.toLowerCase());
  const address = [nameHasHouse ? '' : house, street, ward ? `Phường ${ward}` : ''].filter(Boolean).join(', ');
  const title = [buildingName, address].filter(Boolean).join(' - ').toUpperCase() || MISSING_MARK;

  const foundation = mapFoundationLabel(firstText(getPath(master, 'foundationType'), row.masterFoundationCategory));
  const depth = firstNumber(getPath(master, 'foundationDepthM'), row.masterFoundationDepth);
  const foundationText = [foundation, depth !== null && depth > 0 ? `sâu ${depth}m` : ''].filter(Boolean).join(', ');
  const floors = firstNumber(getPath(master, 'aboveFloors'), row.masterFloorCount);
  const tiltX = toNumber(getPath(master, 'settlementTilt.buildingTilt.xPermille'));
  const tiltY = toNumber(getPath(master, 'settlementTilt.buildingTilt.yPermille'));
  const tilt = [tiltX !== null ? `X ${tiltX}‰` : '', tiltY !== null ? `Y ${tiltY}‰` : ''].filter(Boolean).join(' / ');

  return [
    `TÒA NHÀ: ${title}`,
    `Móng: ${foundationText || MISSING_MARK}`,
    `Số tầng: ${floors ?? MISSING_MARK}`,
    `Độ nghiêng: ${tilt || MISSING_MARK}`,
  ].join(' | ');
}

// Không gồm reportUpdatedAt: updated_at bị đẩy lên mỗi lần Admin thẩm định/diff, không phải hoạt động khảo sát.
function collectActivityDates(row: RawProgressRow): Date[] {
  return [
    row.reportCreatedAt,
    row.reportSubmittedAt,
    row.reportSurveyDate,
    row.absenceFirstAt,
    row.absenceLastAt,
  ].filter((d): d is Date => d instanceof Date);
}

function minDate(...dates: Array<Date | null>): Date | null {
  const valid = dates.filter((d): d is Date => d instanceof Date);
  return valid.length ? new Date(Math.min(...valid.map((d) => d.getTime()))) : null;
}

export function normalizeRecord(row: RawProgressRow, config: ProgressReportConfig): ProgressRecord {
  const json = row.reportJson;
  const isUnit = row.kind === 'CONDO_UNIT';
  const inaccessible = isInaccessible(row);
  const condition = classifyCondition(row, config);
  const ecsCondition = classifyEcsCondition(row);
  const braGrade = classifyBraGrade(row);
  const surveyProgress = mapSurveyProgress(row);

  const street = stripPrefix(
    firstText(getPath(json, 'street'), getPath(row.masterJson, 'street'), row.parcelStreet),
    /^đường\s+/i
  );
  const ward = stripPrefix(
    firstText(getPath(json, 'ward'), getPath(row.masterJson, 'ward'), row.parcelWard),
    /^phường\s+/i
  );

  const stationCode = resolveStationCode(row.zoneId, row.zoneName);
  const sideHouseNumber = firstText(getPath(json, 'houseNumber'), row.parcelHouseNumber);
  const side = resolveAlignmentSide(row.computedSide, { ward, street, houseNumber: sideHouseNumber }, config.sideOverrides);
  const sideLabel =
    side === 'RIGHT' ? config.labels.sideRight : side === 'LEFT' ? config.labels.sideLeft : config.labels.sideUnknown;
  const areaLabel = [stationCode, sideLabel].filter(Boolean).join(' ');

  const unitCode = firstText(row.unitDisplayCode, row.unitCode, getPath(json, 'unitCode'));
  const unitFloor = row.unitFloorNumber ?? toNumber(getPath(json, 'unitFloorNumber'));
  const houseNumber = isUnit
    ? /lầu|tầng|trệt/i.test(unitCode) || !formatFloor(unitFloor)
      ? unitCode
      : [unitCode, formatFloor(unitFloor)].filter(Boolean).join(' - ')
    : firstText(getPath(json, 'houseNumber'), row.parcelHouseNumber);

  const buildingName = isUnit
    ? firstText(
        getPath(row.masterJson, 'buildingName'),
        row.masterBuildingName,
        getPath(json, 'parentBuildingInfo.buildingName'),
        /chung cư/i.test(row.parcelHouseNumber ?? '') ? row.parcelHouseNumber : row.parcelHouseNumber ? `Chung cư ${row.parcelHouseNumber}` : ''
      )
    : firstText(getPath(json, 'buildingName'), row.specBuildingName);

  const usageFunction = normalizeUsageFunction(firstText(getPath(json, 'usageFunction'), row.specLandUseFunction), isUnit);

  // Móng chỉ có nghĩa khi KSV vào được nhà và đã nộp; nhà vắng/nháp để trống, khớp số đếm ở bảng tổng hợp.
  const isSurveyedReport =
    Boolean(row.reportId) && !inaccessible && row.reportStatus !== null && row.reportStatus !== 'DRAFT';
  const hasFoundationScope = !isUnit && isSurveyedReport;
  const foundationRaw = hasFoundationScope ? firstText(getPath(json, 'foundationType'), row.specFoundationCategory) : '';
  const foundationType = hasFoundationScope ? mapFoundationLabel(foundationRaw) : '';
  const depth = hasFoundationScope ? firstNumber(getPath(json, 'foundationDepthM'), row.specFoundationDepth) : null;
  let foundationDepth: number | string | null = null;
  if (hasFoundationScope) {
    if (depth !== null && depth > 0) foundationDepth = depth;
    else if (foundationType === UNKNOWN_FOUNDATION) foundationDepth = UNKNOWN_FOUNDATION;
  }
  const hasFoundationInfo = Boolean(foundationType && foundationType !== UNKNOWN_FOUNDATION);

  // Nhà dân vắng: số tầng / năm XD thuộc RESIDENTIAL_ABSENT_INTERIOR_KEYS (absence-evidence.ts), Admin không sửa được
  // nên giá trị trong phiếu là số KSV điền bừa (năm mặc định 2026) → để trống. Căn hộ vắng vẫn có tầng căn và năm tòa mẹ thật.
  const isAbsentResidential = !isUnit && inaccessible;
  const floors: string | number = isUnit
    ? formatFloor(unitFloor)
    : isAbsentResidential
      ? ''
      : firstNumber(getPath(json, 'aboveFloors'), row.specFloorCount, row.reportId ? row.parcelFloorCount : null) ?? '';

  const year = isAbsentResidential ? null : resolveConstructionYear(row);
  const catScore = firstNumber(getPath(json, 'foundationCatScore'), row.specFoundationCatScore);
  const hasAsBuilt =
    arrayLength(getPath(json, 'asBuiltDrawingPhotos')) > 0 ||
    arrayLength(getPath(json, 'asBuiltDrawingFiles')) > 0 ||
    (catScore !== null && catScore >= 1 && catScore <= 2);
  const asBuilt = !row.reportId || inaccessible ? '' : hasAsBuilt ? 'Có' : 'Không';

  const startDate = minDate(row.reportSurveyDate, row.reportCreatedAt, row.absenceFirstAt);
  let endDate: Date | null = null;
  // Mốc hoàn thành = lúc KSV nộp (nộp lại thì lần gần nhất); không dùng updated_at vì bị đẩy lên khi Admin thẩm định/diff,
  // không dùng created_at vì đó là ngày tạo hồ sơ, không phải ngày hoàn thành.
  if (inaccessible) endDate = row.absenceLastAt ?? row.reportSubmittedAt ?? row.reportSurveyDate ?? null;
  else if (isSurveyedReport) endDate = row.reportSubmittedAt ?? row.reportSurveyDate ?? null;

  // Dài / Rộng / Cao: ưu tiên hồ sơ đã nộp/duyệt (submitted/active report) → dữ liệu thửa/spec → không có thì để trống
  const lengthM = isUnit
    ? null
    : positiveNumber(
        row.submittedLotDepth,
        getPath(json, 'lotDepth'),
        getPath(json, 'specs.lotDepth'),
        getPath(json, 'lengthM'),
        row.parcelLotDepth
      );
  const widthM = isUnit
    ? null
    : positiveNumber(
        row.submittedFrontageWidth,
        getPath(json, 'frontageWidth'),
        getPath(json, 'specs.frontageWidth'),
        getPath(json, 'photoP02.widthM'),
        row.parcelFrontageWidth
      );
  const heightM = isUnit
    ? null
    : positiveNumber(
        row.submittedBuildingHeight,
        getPath(json, 'buildingHeightM'),
        getPath(json, 'specs.buildingHeightM'),
        getPath(json, 'photoP02.heightM'),
        row.specBuildingHeight
      );

  // Tim tuyến & Biên kết cấu: ưu tiên tuyệt đối theo GIS hiện tại của thửa đất
  const distanceCenterlineM =
    row.gisDistanceCenterlineM !== undefined && row.gisDistanceCenterlineM !== null
      ? row.gisDistanceCenterlineM
      : isUnit
        ? firstNumber(getPath(row.masterJson, 'metroOffsetDistance'), row.parcelDistanceToCenterline)
        : firstNumber(getPath(json, 'metroOffsetDistance'), getPath(json, 'manualMetroDistanceM'), row.parcelDistanceToCenterline);

  const distanceEdgeM =
    row.gisDistanceEdgeM !== undefined && row.gisDistanceEdgeM !== null
      ? row.gisDistanceEdgeM
      : firstNumber(
          getPath(json, 'clearanceOffsetDistance'),
          getPath(json, 'stationEdgeDistance'),
          isUnit ? getPath(row.masterJson, 'clearanceOffsetDistance') : null
        );

  // Mã đối soát dùng mã U (building_units.unit_code), không lấy display_code; căn thiếu mã để null, không mượn mã tòa.
  const systemUnitCode = row.unitCode ? row.unitCode.trim() : '';
  if (isUnit && !systemUnitCode) {
    console.warn('[ProgressReport:MissingUnitCode]', { unitId: row.unitId, parcelId: row.parcelId });
  }
  const code = isUnit ? (systemUnitCode ? `${row.projectParcelCode} / ${systemUnitCode}` : null) : row.projectParcelCode;

  return {
    kind: row.kind,
    code,
    parcelId: row.parcelId,
    unitId: row.unitId,
    zoneId: row.zoneId,
    stationCode,
    side,
    areaLabel,
    startDate,
    endDate,
    houseNumber,
    street,
    ward,
    buildingName,
    ownerName: resolveOwnerName(row),
    ownerPhone: resolveOwnerPhone(row),
    usageFunction,
    lengthM,
    widthM,
    heightM,
    foundationType,
    foundationDepth,
    floorsLabel: floors,
    totalRooms: null,
    constructionYear: year,
    condition,
    ecsCondition,
    braGrade,
    designUnit: '',
    constructionUnit: '',
    asBuilt,
    distanceCenterlineM,
    distanceEdgeM,
    surveyProgress,
    notes: buildNotes(row, inaccessible),
    hasFoundationInfo,
    isSurveyed: isSurveyedReport,
    activityDates: collectActivityDates(row),
    masterLabel: isUnit ? buildMasterLabel(row, buildingName, street, ward) : null,
  };
}
