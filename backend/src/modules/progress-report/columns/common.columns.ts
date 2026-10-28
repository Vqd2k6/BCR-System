import type { ColumnDefinition } from './column.types';
import type { BraRiskCode, CellStyle, EcsConditionCode } from '../progress-report.types';
import type { ProgressReportConfig } from '../config/config.schema';
import { toVnCalendarDate } from '../rules/time-window';

/**
 * Thư viện cột dùng chung – template nào cũng có thể chọn ghép.
 */

const DATE_FMT = 'dd/mm/yyyy';
const METER_FMT = '0.0#';

function ecsStyle(code: EcsConditionCode | null, config: ProgressReportConfig): CellStyle | undefined {
  if (code === 'DEFICIENT') return { fillArgb: config.colors.MONITOR };
  if (code === 'CRITICAL') return { fillArgb: config.colors.HIGH_RISK };
  if (code === 'INACCESSIBLE') return { fillArgb: config.colors.INACCESSIBLE };
  return undefined;
}

function braStyle(code: BraRiskCode | null, config: ProgressReportConfig): CellStyle | undefined {
  if (code === 'MEDIUM') return { fillArgb: config.colors.MONITOR };
  if (code === 'HIGH' || code === 'VERY_HIGH') return { fillArgb: config.colors.HIGH_RISK };
  return undefined;
}

export const COL = {
  stt: { key: 'stt', header: 'STT', width: 6, align: 'center', resolve: (_r, ctx) => ctx.rowIndex + 1 },
  startDate: { key: 'startDate', header: 'Ngày bắt đầu KS', width: 13, numFmt: DATE_FMT, align: 'center', resolve: (r) => toVnCalendarDate(r.startDate) },
  endDate: { key: 'endDate', header: 'Ngày hoàn thành KS', width: 13, numFmt: DATE_FMT, align: 'center', resolve: (r) => toVnCalendarDate(r.endDate) },
  area: { key: 'area', header: 'Khu vực KS', width: 18, resolve: (r) => r.areaLabel },
  houseNumber: { key: 'houseNumber', header: 'Số nhà', group: 'Địa chỉ Công Trình', width: 16, resolve: (r) => r.houseNumber || null },
  street: { key: 'street', header: 'Đường', group: 'Địa chỉ Công Trình', width: 22, resolve: (r) => r.street || null },
  ward: { key: 'ward', header: 'Phường', group: 'Địa chỉ Công Trình', width: 14, resolve: (r) => r.ward || null },
  quarter: { key: 'quarter', header: 'Khu Phố', group: 'Địa chỉ Công Trình', width: 10, resolve: (r) => r.quarter || null },
  buildingName: { key: 'buildingName', header: 'Tên công trình- Số căn hộ (nếu có)', width: 24, resolve: (r) => r.buildingName || null },
  ownerName: { key: 'ownerName', header: 'Chủ sở hữu hoặc người sử dụng', group: 'Chủ sở hữu hoặc người sử dụng', width: 24, resolve: (r) => r.ownerName || null },
  ownerPhone: { key: 'ownerPhone', header: 'Số điện thoại liên hệ', group: 'Chủ sở hữu hoặc người sử dụng', width: 14, resolve: (r) => r.ownerPhone || null },
  usage: { key: 'usage', header: 'Công năng sử dụng', width: 18, resolve: (r) => r.usageFunction || null },
  length: { key: 'length', header: 'Dài', group: 'Kích thước chính (m)', width: 8, numFmt: METER_FMT, align: 'center', resolve: (r) => r.lengthM },
  width: { key: 'width', header: 'Rộng', group: 'Kích thước chính (m)', width: 8, numFmt: METER_FMT, align: 'center', resolve: (r) => r.widthM },
  height: { key: 'height', header: 'Cao', group: 'Kích thước chính (m)', width: 8, numFmt: METER_FMT, align: 'center', resolve: (r) => r.heightM },
  foundationType: { key: 'foundationType', header: 'Loại móng', group: 'KC móng', width: 18, resolve: (r) => r.foundationType || null },
  foundationDepth: { key: 'foundationDepth', header: 'Chiều sâu móng', group: 'KC móng', width: 10, numFmt: METER_FMT, align: 'center', resolve: (r) => r.foundationDepth },
  floors: { key: 'floors', header: 'Số tầng', width: 9, align: 'center', resolve: (r) => (r.floorsLabel === '' ? null : r.floorsLabel) },
  totalRooms: { key: 'totalRooms', header: 'Tổng số phòng', width: 9, align: 'center', resolve: (r) => r.totalRooms },
  year: { key: 'year', header: 'Năm XD', width: 9, align: 'center', resolve: (r) => r.constructionYear },
  condition: {
    key: 'condition',
    header: 'Tình trạng hiện tại (ECS)',
    width: 20,
    align: 'center',
    resolve: (r, ctx) => (r.ecsCondition ? ctx.config.labels.ecs[r.ecsCondition] : null),
    style: (r, ctx) => ecsStyle(r.ecsCondition, ctx.config),
  },
  braRisk: {
    key: 'braRisk',
    header: 'Mức độ đánh giá rủi ro (BRA)',
    width: 22,
    align: 'center',
    resolve: (r, ctx) => (r.braGrade ? ctx.config.labels.bra[r.braGrade] : null),
    style: (r, ctx) => braStyle(r.braGrade, ctx.config),
  },
  designUnit: { key: 'designUnit', header: 'ĐV thiết kế', group: 'Hồ sơ ', width: 12, resolve: (r) => r.designUnit || null },
  constructionUnit: { key: 'constructionUnit', header: 'ĐV thi công', group: 'Hồ sơ ', width: 12, resolve: (r) => r.constructionUnit || null },
  asBuilt: { key: 'asBuilt', header: 'Hoàn công', group: 'Hồ sơ ', width: 10, align: 'center', resolve: (r) => r.asBuilt || null },
  distCenterline: { key: 'distCenterline', header: 'Tim tuyến', group: 'Khoảng cách đến CT Metro', width: 10, numFmt: METER_FMT, align: 'center', resolve: (r) => r.distanceCenterlineM },
  distEdge: { key: 'distEdge', header: 'Biên KC', group: 'Khoảng cách đến CT Metro', width: 10, numFmt: METER_FMT, align: 'center', resolve: (r) => r.distanceEdgeM },
  surveyProgress: {
    key: 'surveyProgress',
    header: 'Trạng thái KS',
    width: 24,
    resolve: (r, ctx) => (r.surveyProgress ? ctx.config.labels.surveyProgress[r.surveyProgress] : null),
  },
  notes: { key: 'notes', header: 'Ghi chú', width: 32, resolve: (r) => r.notes || null },
} satisfies Record<string, ColumnDefinition>;
