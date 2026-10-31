import type { ProgressTemplate } from '../column.types';
import { COL } from '../common.columns';

/**
 * Template "Tiến độ khảo sát ngày theo Ga":
 * 28 cột A → AB (tách "Tình trạng hiện tại" (ECS) và "Mức độ đánh giá rủi ro" (BRA)),
 * chú giải 3 dòng (ECS / BRA / Trạng thái KS), header 2 tầng, bảng tổng hợp cuối sheet.
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
        { text: config.labels.ecs.GOOD, span: 1 },
        { text: config.labels.ecs.MEDIUM, span: 1 },
        { text: config.labels.ecs.DEFICIENT, span: 2, colorKey: 'MONITOR' },
        { text: config.labels.ecs.CRITICAL, span: 1, colorKey: 'HIGH_RISK' },
        { text: config.labels.ecs.INACCESSIBLE, span: 2, colorKey: 'INACCESSIBLE' },
      ],
    },
    {
      label: 'Mức độ đánh giá rủi ro:',
      labelSpan: 3,
      items: [
        { text: config.labels.bra.LOW, span: 1 },
        { text: config.labels.bra.MEDIUM, span: 1, colorKey: 'MONITOR' },
        { text: config.labels.bra.HIGH, span: 2, colorKey: 'HIGH_RISK' },
        { text: config.labels.bra.VERY_HIGH, span: 1, colorKey: 'HIGH_RISK' },
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
    COL.buildingName, // H
    COL.ownerName, // I
    COL.ownerPhone, // J
    COL.usage, // K
    COL.length, // L
    COL.width, // M
    COL.height, // N
    COL.foundationType, // O
    COL.foundationDepth, // P
    COL.floors, // Q
    COL.totalRooms, // R
    COL.year, // S
    COL.condition, // T - Tình trạng hiện tại (ECS)
    COL.braRisk, // U - Mức độ đánh giá rủi ro (BRA)
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
