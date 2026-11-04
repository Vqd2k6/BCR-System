import crypto from 'crypto';
import type { JwtPayload } from '../../common/guards/auth.guard';
import { BadRequestError, ForbiddenError } from '../../common/errors/problem-details';
import { CadastralRepository } from '../cadastral/cadastral.repository';
import { resolveZoneMapScope } from '../cadastral/utils/zone-scope.utils';
import { canAccessZone } from '../report/utils/zone-access.utils';

/** Quy tắc nghiệp vụ chấm công (plan rà soát 2026-11-04). Hàm thuần, kiểm thử được không cần DB. */

export const VN_TZ = 'Asia/Ho_Chi_Minh';
export const ZONE_RADIUS_METERS = 500;
export const SHORT_DURATION_MINUTES = Math.max(
  1,
  parseInt(process.env.ATTENDANCE_SHORT_DURATION_MINUTES || '30', 10) || 30
);
export const LIST_MAX_LIMIT = 200;
export const BATCH_MAX_APPROVE = 500;

export type AnomalyCode =
  | 'DISTANCE_OVER_500M_IN'
  | 'DISTANCE_OVER_500M_OUT'
  | 'SHORT_DURATION'
  | 'ZONE_NOT_ASSIGNED'
  | 'MISSING_CHECKOUT';

export type VerificationStatus = 'PENDING_VERIFICATION' | 'APPROVED' | 'FLAGGED_WARNING' | 'REJECTED';
export type VerifyAction = 'APPROVE' | 'REJECT' | 'FLAG_WARNING' | 'RESET_PENDING';

export const ACTION_TO_STATUS: Record<VerifyAction, VerificationStatus> = {
  APPROVE: 'APPROVED',
  REJECT: 'REJECTED',
  FLAG_WARNING: 'FLAGGED_WARNING',
  RESET_PENDING: 'PENDING_VERIFICATION',
};

/** Trạng thái được tính công (Q-2): Nhắc nhở vẫn tính 1 công, chỉ Từ chối mất công. */
export const WORKDAY_STATUSES: VerificationStatus[] = ['APPROVED', 'FLAGGED_WARNING'];

function isAllZones(zone: string): boolean {
  return zone === 'ALL' || zone === 'ALL_ZONES';
}

export interface AdminZoneScope {
  /** Mã Zone dùng làm khóa (VD: ZONE_09) hoặc 'ALL'. */
  scopeKey: string;
  /** Danh sách zone_id được lọc (gồm mã tương đương); null = toàn tuyến. */
  zoneIds: string[] | null;
}

/**
 * Phạm vi Zone của các API Admin chấm công. Dùng chung quy ước với bản đồ Zone:
 * Zone Admin xin "toàn tuyến" bị thu hẹp về Zone được gán, xin Zone khác bị từ chối.
 */
export function resolveAdminZoneScope(user: JwtPayload | undefined, requestedZone: string | undefined): AdminZoneScope {
  const requested = (requestedZone || '').trim();
  // resolveZoneMapScope rơi về ZONE_01 khi Super Admin không chọn Zone; với chấm công, mặc định là toàn tuyến.
  if (user?.role === 'SUPER_ADMIN' && !requested) return { scopeKey: 'ALL', zoneIds: null };
  const requestedUpper = requested.toUpperCase();
  if (user?.role === 'ZONE_ADMIN' && requestedUpper && !isAllZones(requestedUpper) && !canAccessZone(user, requestedUpper)) {
    throw new ForbiddenError(`Bạn không có quyền xem dữ liệu chấm công của phân khu [${requestedUpper}].`);
  }
  const scopeKey = resolveZoneMapScope(user, requested || undefined);
  if (isAllZones(scopeKey)) return { scopeKey: 'ALL', zoneIds: null };
  return { scopeKey, zoneIds: CadastralRepository.getZoneAliases(scopeKey) };
}

/** Admin có được xem/duyệt ca thuộc zoneId này không (ngoài phạm vi -> service trả 404). */
export function canAdminAccessCheckInZone(user: JwtPayload, zoneId: string): boolean {
  return canAccessZone(user, zoneId);
}

/** Zone chọn lúc check-in có thuộc nhóm Zone được phân công không (Q-4: ngoài nhóm -> cờ ZONE_NOT_ASSIGNED). */
export function isZoneWithinAssignment(assignedZoneId: string | null | undefined, selectedZoneId: string): boolean {
  const assigned = (assignedZoneId || '').trim().toUpperCase();
  if (!assigned) return false;
  if (isAllZones(assigned)) return true;
  return CadastralRepository.getZoneAliases(assigned).includes(selectedZoneId.trim().toUpperCase());
}

/** Kỳ công đã khóa có phủ zoneId này không (khóa ZONE_09 phủ mọi mã tương đương của ZONE_09). */
export function isZoneCoveredByPeriod(periodZoneId: string, checkInZoneId: string): boolean {
  return CadastralRepository.getZoneAliases(periodZoneId).includes(checkInZoneId.trim().toUpperCase());
}

export function buildCheckInAnomalies(input: {
  distanceMeters: number;
  zoneWithinAssignment: boolean;
}): AnomalyCode[] {
  const codes: AnomalyCode[] = [];
  if (input.distanceMeters > ZONE_RADIUS_METERS) codes.push('DISTANCE_OVER_500M_IN');
  if (!input.zoneWithinAssignment) codes.push('ZONE_NOT_ASSIGNED');
  return codes;
}

export function buildCheckOutAnomalies(input: {
  existing: string[];
  distanceMeters: number;
  durationMinutes: number;
}): AnomalyCode[] {
  const codes = new Set<string>(input.existing.filter((c) => c !== 'MISSING_CHECKOUT'));
  if (input.distanceMeters > ZONE_RADIUS_METERS) codes.add('DISTANCE_OVER_500M_OUT');
  if (input.durationMinutes < SHORT_DURATION_MINUTES) codes.add('SHORT_DURATION');
  return Array.from(codes) as AnomalyCode[];
}

/** Bảng chuyển trạng thái duyệt (Q-7): kỳ chưa khóa thì chuyển tự do, đổi quyết định đã có bắt buộc ghi chú. */
export function validateVerifyTransition(input: {
  previousStatus: VerificationStatus;
  action: VerifyAction;
  notes: string | null;
}): { nextStatus: VerificationStatus; error?: string } {
  const nextStatus = ACTION_TO_STATUS[input.action];
  if (nextStatus === input.previousStatus) {
    return { nextStatus, error: `Ca chấm công đã ở trạng thái [${nextStatus}].` };
  }
  const hasNotes = Boolean(input.notes && input.notes.trim());
  if ((input.action === 'REJECT' || input.action === 'FLAG_WARNING') && !hasNotes) {
    return { nextStatus, error: 'Bắt buộc nhập ghi chú thẩm định khi Từ chối hoặc Nhắc nhở.' };
  }
  if (input.previousStatus !== 'PENDING_VERIFICATION' && !hasNotes) {
    return { nextStatus, error: 'Bắt buộc nhập lý do khi thay đổi quyết định đã duyệt.' };
  }
  return { nextStatus };
}

export type BatchSkipReason =
  | 'SELF_CHECKIN'
  | 'NOT_CHECKED_OUT'
  | 'HAS_ANOMALY'
  | 'NO_SELFIE'
  | 'PERIOD_LOCKED'
  | 'OUT_OF_SCOPE'
  | 'BATCH_LIMIT';

/** Điều kiện "ca sạch hoàn toàn" của Duyệt nhanh (Q-9). Trả null nếu duyệt được. */
export function classifyBatchCandidate(input: {
  surveyorId: string;
  adminId: string;
  checkoutTime: Date | null;
  anomalyCodes: string[];
  selfiePhotoUrl: string | null;
  periodLocked: boolean;
}): BatchSkipReason | null {
  if (input.surveyorId === input.adminId) return 'SELF_CHECKIN';
  if (input.periodLocked) return 'PERIOD_LOCKED';
  if (!input.checkoutTime) return 'NOT_CHECKED_OUT';
  if (input.anomalyCodes.length > 0) return 'HAS_ANOMALY';
  if (!input.selfiePhotoUrl || !input.selfiePhotoUrl.trim()) return 'NO_SELFIE';
  return null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseVnDate(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !DATE_RE.test(value.trim()) || Number.isNaN(Date.parse(value.trim()))) {
    throw new BadRequestError(`Tham số ${field} phải có dạng YYYY-MM-DD.`);
  }
  return value.trim();
}

export function parseMonth(value: unknown): string {
  if (value === undefined || value === null || value === '') return getVietnamMonthStr();
  if (typeof value !== 'string' || !MONTH_RE.test(value.trim())) {
    throw new BadRequestError('Tham số month phải có dạng YYYY-MM.');
  }
  return value.trim();
}

export function getVietnamDateStr(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function getVietnamMonthStr(date: Date = new Date()): string {
  return getVietnamDateStr(date).slice(0, 7);
}

export function parseLimit(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (Number.isNaN(n) || n <= 0) return fallback;
  return Math.min(n, LIST_MAX_LIMIT);
}

export function parseOffset(value: unknown): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : NaN;
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

/** Escape ký tự đại diện của ILIKE (\ % _) để tìm kiếm theo nghĩa đen. */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Chống CSV formula injection: ô bắt đầu bằng = + - @ (hoặc tab/CR) được thêm dấu nháy đơn. */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** JSON chuẩn hóa thứ tự key để băm SHA-256 ổn định. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}
