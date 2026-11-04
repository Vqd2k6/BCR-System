/**
 * Public API duy nhất của phân hệ Chấm công. Mọi nơi ngoài module chỉ import từ '@/features/attendance'.
 *   surveyor/ — KSV chấm công & điểm danh người đi kèm ngoài hiện trường
 *   admin/    — Zone Admin / Super Admin hậu kiểm, duyệt công, chốt kỳ công tháng
 */
export { TimekeepingCheckInView } from './surveyor/TimekeepingCheckInView';
export { CompanionCheckInModal } from './surveyor/CompanionCheckInModal';
export type { AttendanceRecord, CheckInDetails, CompanionRecord } from './types/attendance.types';
export type { CompanionCheckInModalProps } from './types/companion.types';
export {
  ATTENDANCE_UPDATED_EVENT,
  useAttendanceSessionStore,
  useAttendanceSessionSync,
  useTodayAttendance,
  useTodayCompanionCount,
} from './store/useAttendanceSessionStore';
export type { TodayCheckInSummary } from './store/useAttendanceSessionStore';
export { AdminAttendanceManagementView } from './admin/AdminAttendanceManagementView';
export { useAttendancePendingBadge } from './admin/hooks/useAttendancePendingBadge';
