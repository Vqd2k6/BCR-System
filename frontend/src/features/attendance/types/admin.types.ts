/** Kiểu dữ liệu phía Admin (camelCase). Payload thô snake_case chỉ tồn tại trong attendance.api.ts. */

export type AttendanceVerificationStatus = 'PENDING_VERIFICATION' | 'APPROVED' | 'FLAGGED_WARNING' | 'REJECTED';
export type AttendanceVerifyAction = 'APPROVE' | 'REJECT' | 'FLAG_WARNING' | 'RESET_PENDING';
export type AttendanceAnomalyCode =
  | 'DISTANCE_OVER_500M_IN'
  | 'DISTANCE_OVER_500M_OUT'
  | 'SHORT_DURATION'
  | 'ZONE_NOT_ASSIGNED'
  | 'MISSING_CHECKOUT';
export type AttendanceAnomalyFilter = 'ANY' | 'NONE' | AttendanceAnomalyCode;

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface AdminCheckIn {
  id: string;
  surveyorId: string;
  surveyorName: string;
  surveyorCode: string | null;
  surveyorPhone: string | null;
  surveyorAssignedZoneId: string | null;
  zoneId: string;
  workDate: string;
  checkInTime: string;
  checkOutTime: string | null;
  workDurationMinutes: number | null;
  distanceIn: number | null;
  distanceOut: number | null;
  gpsIn: GeoPoint | null;
  gpsOut: GeoPoint | null;
  gpsAccuracyIn: number | null;
  gpsAccuracyOut: number | null;
  zoneCenterIn: GeoPoint | null;
  zoneCenterOut: GeoPoint | null;
  selfieInUrl: string | null;
  selfieOutUrl: string | null;
  notesIn: string | null;
  notesOut: string | null;
  verificationStatus: AttendanceVerificationStatus;
  verificationNotes: string | null;
  verifiedAt: string | null;
  verifiedByName: string | null;
  anomalyCodes: AttendanceAnomalyCode[];
  anomalyReason: string | null;
  isMissingCheckout: boolean;
  isCompanion: boolean;
  companionName: string | null;
  companionRole: string | null;
  companionPhone: string | null;
  surveysCreatedCount: number | null;
  surveysSubmittedCount: number | null;
  isPeriodLocked: boolean;
}

export interface AttendanceAuditEntry {
  id: string;
  action: string;
  performedByName: string | null;
  createdAt: string;
  previousStatus: string | null;
  newStatus: string | null;
  notes: string | null;
}

export interface AdminCheckInDetail extends AdminCheckIn {
  isOwnCheckIn: boolean;
  history: AttendanceAuditEntry[];
  companions: AdminCheckIn[];
}

export interface AdminCheckInFilters {
  zoneId?: string;
  fromDate?: string;
  toDate?: string;
  isCompanion?: boolean;
  status?: AttendanceVerificationStatus;
  anomaly?: AttendanceAnomalyFilter;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AdminCheckInPage {
  items: AdminCheckIn[];
  total: number;
  scope: string;
}

export interface AttendanceCounters {
  scope: string;
  mainToday: number;
  companionToday: number;
  onFieldNow: number;
  completedToday: number;
  pendingTotal: number;
  pendingWithAnomaly: number;
  pendingMissingCheckout: number;
  pendingDistance: number;
}

export type BatchSkipReason =
  | 'SELF_CHECKIN'
  | 'NOT_CHECKED_OUT'
  | 'HAS_ANOMALY'
  | 'NO_SELFIE'
  | 'PERIOD_LOCKED'
  | 'OUT_OF_SCOPE'
  | 'BATCH_LIMIT';

export interface BatchVerifyResult {
  dryRun: boolean;
  scope: string;
  eligibleCount: number;
  approvedIds: string[];
  skipped: Record<BatchSkipReason, number>;
}

export interface MonthlySummaryRow {
  surveyorId: string;
  surveyorName: string;
  surveyorCode: string | null;
  assignedZoneId: string | null;
  totalShiftDays: number;
  workDays: number;
  approvedDays: number;
  flaggedDays: number;
  rejectedDays: number;
  pendingDays: number;
  completedCheckoutDays: number;
  missingCheckoutDays: number;
  totalWorkMinutes: number;
  anomalyShiftCount: number;
  companionCheckinsTotal: number;
  companionAcceptedCount: number;
  companionPendingCount: number;
  companions: Array<{ name: string | null; phone: string | null }>;
  surveysSubmitted: number;
}

export interface MonthlySummary {
  scope: string;
  month: string;
  periodStatus: 'OPEN' | 'LOCKED';
  rows: MonthlySummaryRow[];
}

export interface PeriodSnapshotInfo {
  id: string;
  sha256: string;
  lockedAt: string;
  lockedByName: string | null;
  unlockedAt: string | null;
  unlockReason: string | null;
}

export interface PeriodStatus {
  zoneId: string;
  month: string;
  status: 'OPEN' | 'LOCKED';
  lockedAt: string | null;
  lockedByName: string | null;
  canLock: boolean;
  lockableMonth: boolean;
  pendingCount: number;
  snapshots: PeriodSnapshotInfo[];
}
