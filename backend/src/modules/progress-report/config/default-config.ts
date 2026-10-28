import type { ProgressReportConfig } from './config.schema';

/**
 * Cấu hình mặc định – dùng khi bảng progress_report_config_versions chưa có phiên bản
 * hoặc phiên bản trong DB không hợp lệ. Bám sát file mẫu source_templete/Bảng tính không có tiêu đề.xlsx.
 */
export const DEFAULT_PROGRESS_CONFIG: ProgressReportConfig = {
  titlePrefix: 'BÁO CÁO KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH KHU VỰC ẢNH HƯỞNG TUYẾN METRO 2.1',
  newBuildingMinYear: 2020,
  highRisk: {
    ecsClasses: ['CRITICAL'],
    braValues: ['HIGH', 'VERY_HIGH'],
    burlandMin: 4,
  },
  monitor: {
    ecsClasses: ['DEFICIENT'],
    braValues: ['MEDIUM'],
    burlandMin: 3,
    includeMonitoringRequired: true,
  },
  degraded: {
    ecsClasses: ['MEDIUM'],
  },
  includeNotSurveyedRows: false,
  labels: {
    condition: {
      NEW: 'Mới',
      OLD: 'Cũ',
      DEGRADED: 'Xuống cấp',
      MONITOR: 'Cần theo dõi',
      HIGH_RISK: 'Nguy cơ cao',
      INACCESSIBLE: 'Không tiếp cận được',
    },
    surveyProgress: {
      IN_PROGRESS: 'Đang thực hiện',
      SURVEY_DONE_REPORTING: 'Đã hoàn thành KS đang làm báo cáo',
      REPORT_DONE: 'Đã hoàn thành báo cáo',
      REPORT_SIGNED: 'Đã ký hoàn thành báo cáo',
    },
    sideRight: 'Phải Tuyến',
    sideLeft: 'Trái Tuyến',
    sideUnknown: 'Chưa xác định',
  },
  colors: {
    header: 'FF95DCF7',
    legend: 'FFC1F0C8',
    total: 'FFFFC000',
    MONITOR: 'FFFFFF00',
    HIGH_RISK: 'FFFF0000',
    INACCESSIBLE: 'FFE49EDD',
  },
  sideOverrides: [],
};

