import type { BilingualText, CondoUnitAbsentReport } from '../../report.types';

const ABSENCE_REASON_LABELS: Record<string, string> = {
  HOMEOWNER_ABSENT: 'Chủ nhà đi vắng / Khóa cửa ngoài',
  UNOCCUPIED_EMPTY: 'Căn hộ bỏ trống / Chưa về ở',
  REFUSED_ACCESS: 'Chủ nhà hoặc khách thuê từ chối tiếp cận',
  LOCKED_SECURITY: 'Căn hộ niêm phong / BQL không có chìa khóa',
};

const WITNESS_ROLE_LABELS: Record<string, string> = {
  BUILDING_MANAGEMENT: 'Ban Quản Lý tòa nhà',
};

const RESIDENT_STATUS_REASONS: Record<string, string> = {
  VẮNG_MẶT_KHÓA_CỬA: 'Vắng mặt, khóa cửa ngoài',
  BỎ_TRỐNG_CHƯA_VỀ_Ở: 'Căn hộ bỏ trống / Chưa có người về ở',
};

export const CONDO_UNIT_ABSENT_ACCESS_AREAS = [
  {
    area: { vi: 'Cửa chính / Hành lang trước căn hộ', en: 'Main door / Corridor' },
    accessed: true,
    notAccessed: false,
    remark: { vi: 'Ảnh định danh P-01', en: 'Identification photo P-01' },
  },
  {
    area: { vi: 'Bên trong căn hộ', en: 'Unit interior' },
    accessed: false,
    notAccessed: true,
    remark: { vi: 'Không tiếp cận được', en: 'Not accessible' },
  },
];

export const CONDO_UNIT_ABSENT_ACCESS_CLASSIFICATION: BilingualText = {
  vi: 'Không tiếp cận được căn hộ',
  en: 'Unit not accessible',
};

export const CONDO_UNIT_ABSENT_CONCLUSION: BilingualText = {
  vi: 'Không tiếp cận được căn hộ tại thời điểm khảo sát. Hồ sơ không đánh giá hiện trạng bên trong căn hộ và không có điểm ECS, VI, BRA.',
  en: 'The unit could not be accessed at the time of survey. Its interior condition was not assessed and no ECS, VI or BRA score applies.',
};

function text(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function formatDate(val: unknown): string {
  const raw = text(val);
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString('vi-VN') : raw;
}

/** Chỉ trình bày phần luồng vắng thu thập được; trường không có thì để trống, mẫu in tự hiện `---`. */
export function mapCondoUnitAbsentReport(rawReport: any, json: any): CondoUnitAbsentReport | null {
  if (!rawReport.condoUnitAbsent) return null;

  const info = json.absenteeInfo && typeof json.absenteeInfo === 'object' ? json.absenteeInfo : {};
  const logs: any[] = Array.isArray(rawReport.absenceLogs) ? rawReport.absenceLogs : [];
  const latestLog = logs[0] ?? {};

  const reasonCode = text(info.absenceReason) || text(json.absenteeReason) || text(latestLog.absence_reason);
  const reason =
    reasonCode === 'OTHER'
      ? text(info.customReason) || text(info.notes)
      : ABSENCE_REASON_LABELS[reasonCode] || reasonCode || RESIDENT_STATUS_REASONS[text(json.residentStatus)] || '';
  const witnessRole = text(info.witnessRole) || text(latestLog.witness_role);

  return {
    reason,
    notes: text(info.notes) || text(latestLog.notes),
    attemptCount: Math.max(Number(info.attemptCount) || 0, Number(latestLog.attempt_count) || 0, logs.length) || null,
    witnessName: text(info.witnessName) || text(latestLog.witness_name),
    witnessRole: WITNESS_ROLE_LABELS[witnessRole] || witnessRole,
    witnessPhone: text(info.witnessPhone) || text(latestLog.witness_phone),
    noticeDelivered: Boolean(info.noticeDelivered ?? latestLog.notice_delivered),
    rescheduleDate: formatDate(info.rescheduleDate || latestLog.reschedule_date),
  };
}
