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

/**
 * Chuẩn hóa 1 bản ghi thô thành ProgressRecord:
 * 1. Tách "Tình trạng hiện tại" (ECS) và "Mức độ đánh giá rủi ro" (BRA).
 * 2. Dài / Rộng / Cao: ưu tiên kiểm tra hồ sơ đã nộp/duyệt (SUBMITTED/UNDER_REVIEW/APPROVED) → không có thì để trống.
 * 3. Tim tuyến / Biên kết cấu: lấy trực tiếp theo hình học GIS hiện tại (fallback JSON nếu thiếu hình học).
 */

export const UNKNOWN_FOUNDATION = 'Không rõ';

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

const ABSENCE_REASON_VI: Record<string, string> = {
  HOMEOWNER_ABSENT: 'Chủ nhà vắng mặt',
  LOCKED_GATE: 'Khóa cổng, không có người',
  REFUSED_ACCESS: 'Chủ nhà không cho tiếp cận',
  UNOCCUPIED_EMPTY: 'Nhà bỏ trống',
  LOCKED_SECURITY: 'Bảo vệ không cho vào',
  OTHER: 'Lý do khác',
};

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

function buildHistoryNotes(row: RawProgressRow): string {
  const histRaw = getPath(row.reportJson, 'historyInterview');
  const hist: Record<string, unknown> =
    histRaw && typeof histRaw === 'object' && !Array.isArray(histRaw) ? (histRaw as Record<string, unknown>) : {};
  const pairs: Array<[unknown, unknown, string]> = [
    [hist.renovationYear ?? getPath(row.reportJson, 'renovationYear'), hist.renovationNotes, 'Sửa chữa, cải tạo'],
    [hist.extensionYear, hist.extensionNotes, 'Cơi nới, mở rộng'],
    [hist.alterationYear, hist.alterationNotes, 'Cải tạo kết cấu'],
    [hist.majorRepairYear ?? getPath(row.reportJson, 'majorRepairYear'), hist.repairNotes ?? hist.majorRepairNotes, 'Sửa chữa lớn'],
    [hist.changeUseYear, hist.changeUseNotes, 'Thay đổi công năng'],
  ];
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const [yearRaw, notesRaw, fallbackLabel] of pairs) {
    const year = text(yearRaw);
    const notes = text(notesRaw);
    if (!year && !notes) continue;
    const entry = year ? `${year} (${notes || fallbackLabel})` : notes;
    if (!seen.has(entry)) {
      seen.add(entry);
      parts.push(entry);
    }
  }
  const general = text(hist.generalInterviewNotes);
  if (general) parts.push(general);
  return parts.join('; ');
}

function buildNotes(row: RawProgressRow, inaccessible: boolean): string {
  if (inaccessible) {
    const reasonKey = (row.absenceReason ?? '').toUpperCase();
    const reason =
      ABSENCE_REASON_VI[reasonKey] ||
      text(row.absenceReason) ||
      firstText(getPath(row.reportJson, 'customAbsenteeReason'), getPath(row.reportJson, 'absenteeReason'));
    const notes = text(row.absenceNotes);
    return [reason, notes].filter(Boolean).join(' – ');
  }
  return buildHistoryNotes(row);
}

function collectActivityDates(row: RawProgressRow): Date[] {
  return [
    row.reportCreatedAt,
    row.reportUpdatedAt,
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
        row.parcelHouseNumber ? `Chung cư ${row.parcelHouseNumber}` : ''
      )
    : firstText(getPath(json, 'buildingName'), row.specBuildingName);

  const usageFunction = firstText(getPath(json, 'usageFunction'), row.specLandUseFunction, isUnit ? 'Nhà ở' : '');

  const foundationRaw = isUnit ? '' : firstText(getPath(json, 'foundationType'), row.specFoundationCategory);
  const foundationType = isUnit || !row.reportId ? '' : mapFoundationLabel(foundationRaw);
  const depth = isUnit ? null : firstNumber(getPath(json, 'foundationDepthM'), row.specFoundationDepth);
  let foundationDepth: number | string | null = null;
  if (!isUnit && row.reportId) {
    if (depth !== null && depth > 0) foundationDepth = depth;
    else if (foundationType === UNKNOWN_FOUNDATION) foundationDepth = UNKNOWN_FOUNDATION;
  }
  const hasFoundationInfo = Boolean(foundationType && foundationType !== UNKNOWN_FOUNDATION);

  const floors: string | number = isUnit
    ? formatFloor(unitFloor)
    : firstNumber(getPath(json, 'aboveFloors'), row.specFloorCount, row.reportId ? row.parcelFloorCount : null) ?? '';

  const year = resolveConstructionYear(row);
  const catScore = firstNumber(getPath(json, 'foundationCatScore'), row.specFoundationCatScore);
  const hasAsBuilt =
    arrayLength(getPath(json, 'asBuiltDrawingPhotos')) > 0 ||
    arrayLength(getPath(json, 'asBuiltDrawingFiles')) > 0 ||
    (catScore !== null && catScore >= 1 && catScore <= 2);
  const asBuilt = !row.reportId || inaccessible ? '' : hasAsBuilt ? 'Có' : 'Không';

  const isSurveyedReport =
    Boolean(row.reportId) && !inaccessible && row.reportStatus !== null && row.reportStatus !== 'DRAFT';

  const startDate = minDate(row.reportCreatedAt, row.reportSurveyDate, row.absenceFirstAt);
  let endDate: Date | null = null;
  if (inaccessible) endDate = row.absenceLastAt ?? row.reportUpdatedAt;
  else if (isSurveyedReport) endDate = row.reportSubmittedAt ?? row.reportSurveyDate ?? row.reportUpdatedAt;

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

  return {
    kind: row.kind,
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
    quarter: '',
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
  };
}
