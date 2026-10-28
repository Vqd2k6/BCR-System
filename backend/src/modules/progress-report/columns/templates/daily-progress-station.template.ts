import type { ProgressTemplate } from '../column.types';
import { COL } from '../common.columns';

/**
 * Template "Tiến độ khảo sát ngày theo Ga" – bám sát source_templete/Bảng tính không có tiêu đề.xlsx
 * 28 cột A → AB, chú giải Row 5–6, header 2 tầng Row 8–9, bảng tổng hợp cuối sheet.
 */
export const DAILY_PROGRESS_STATION_TEMPLATE: ProgressTemplate = {
  id: 'daily-progress-station',
  name: 'Báo cáo tiến độ khảo sát ngày (mẫu Ga ST)',
  buildTitle: ({ config, stationLabel }) => `${config.titlePrefix} ${stationLabel}`.trim(),
  legend: (config) => [
    {
      label: 'Tình trạng hiện tại:',
      labelSpan: 3,
      items: [
        { text: config.labels.condition.NEW, span: 1 },
        { text: config.labels.condition.OLD, span: 1 },
        { text: config.labels.condition.DEGRADED, span: 1 },
        { text: config.labels.condition.MONITOR, span: 2, colorKey: 'MONITOR' },
        { text: config.labels.condition.HIGH_RISK, span: 1, colorKey: 'HIGH_RISK' },
        { text: config.labels.condition.INACCESSIBLE, span: 2, colorKey: 'INACCESSIBLE' },
      ],
    },
    {
      label: 'Trạng thái khảo sát:',
      labelSpan: 3,
      items: [
        { text: config.labels.surveyProgress.IN_PROGRESS, span: 2 },
        { text: config.labels.surveyProgress.SURVEY_DONE_REPORTING, span: 2 },
        { text: config.labels.surveyProgress.REPORT_DONE, span: 2 },
        { text: config.labels.surveyProgress.REPORT_SIGNED, span: 2 },
      ],
    },
  ],
  columns: [
    COL.stt, // A
    COL.startDate, // B
    COL.endDate, // C
    COL.area, // D
    COL.houseNumber, // E
    COL.street, // F
    COL.ward, // G
    COL.quarter, // H
    COL.buildingName, // I
    COL.ownerName, // J
    COL.ownerPhone, // K
    COL.usage, // L
    COL.length, // M
    COL.width, // N
    COL.height, // O
    COL.foundationType, // P
    COL.foundationDepth, // Q
    COL.floors, // R
    COL.totalRooms, // S
    COL.year, // T
    COL.condition, // U
    COL.designUnit, // V
    COL.constructionUnit, // W
    COL.asBuilt, // X
    COL.distCenterline, // Y
    COL.distEdge, // Z
    COL.surveyProgress, // AA
    COL.notes, // AB
  ],
  includeSummary: true,
};

