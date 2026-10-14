import { AuditAlertsService } from './services/audit-alerts.service';
import { AuditReviewService } from './services/audit-review.service';
import { AuditModificationService } from './services/audit-modification.service';
import { AuditVersionService } from './services/audit-version.service';

export { AuditAlertsService, AuditReviewService, AuditModificationService, AuditVersionService };

/**
 * Facade Service cho toàn bộ phân hệ Kiểm Toán & Thẩm Định (Audit & Review)
 * Đảm bảo 100% tính tương thích ngược với các Controllers và API callers hiện hữu.
 */
export class AuditService {
  // --- NHÓM 1: CẢNH BÁO GIAN LẬN & BẤT THƯỜNG ---
  static scanReportAnomalies(reportId: string) {
    return AuditAlertsService.scanReportAnomalies(reportId);
  }

  static listAuditAlerts(filters: { zoneId?: string; severity?: string; isResolved?: boolean }) {
    return AuditAlertsService.listAuditAlerts(filters);
  }

  static getReportAuditFlags(reportId: string) {
    return AuditAlertsService.getReportAuditFlags(reportId);
  }

  // --- NHÓM 2: HÀNG ĐỢI THẨM ĐỊNH & PHÊ DUYỆT BÁO CÁO ---
  static listPendingSubmissions(filters: {
    zoneId?: string;
    status?: string;
    buildingType?: string;
    search?: string;
    burlandFilter?: string;
    slaFilter?: string;
    filterLevel?: string;
    limit?: number;
    offset?: number;
  }) {
    return AuditReviewService.listPendingSubmissions(filters);
  }

  static getSplitPaneAuditView(reportId: string) {
    return AuditReviewService.getSplitPaneAuditView(reportId);
  }

  static approveReport(reportId: string, adminId: string, judgementNotes?: string) {
    return AuditReviewService.approveReport(reportId, adminId, judgementNotes);
  }

  static rejectReport(reportId: string, adminId: string, rejectionReason: string) {
    return AuditReviewService.rejectReport(reportId, adminId, rejectionReason);
  }

  static revertReportToDraft(identifier: string, adminId: string, reason?: string, unitId?: string | null) {
    return AuditReviewService.revertReportToDraft(identifier, adminId, reason, unitId);
  }

  static getProgressAnalytics(zoneId?: string) {
    return AuditReviewService.getProgressAnalytics(zoneId);
  }

  static batchApproveReports(reportIds: string[], adminId: string, judgementNotes?: string) {
    return AuditReviewService.batchApproveReports(reportIds, adminId, judgementNotes);
  }

  static approveAbsenteeReport(reportId: string, adminId: string, judgementNotes?: string) {
    return AuditReviewService.approveAbsenteeReport(reportId, adminId, judgementNotes);
  }

  static getCondoProgressSummary(parcelId: string) {
    return AuditReviewService.getCondoProgressSummary(parcelId);
  }

  static executeFinalSeal(parcelId: string, adminId: string, sealNotes?: string) {
    return AuditReviewService.executeFinalSeal(parcelId, adminId, sealNotes);
  }

  static listCondoTowers(zoneId?: string) {
    return AuditReviewService.listCondoTowers(zoneId);
  }

  static getScopeCounts(zoneId?: string) {
    return AuditReviewService.getScopeCounts(zoneId);
  }

  // --- NHÓM 3: ĐIỀU CHỈNH HỒ SƠ, THAY ẢNH BẢO MẬT & HOÁN ĐỔI RANH ĐẤT ---
  static applyAdminSurveyEdit(
    reportId: string,
    adminId: string,
    payload: {
      adminPassword?: string;
      editReason: string;
      diffPayload: Array<{ field: string; label: string; oldValue: any; newValue: any }>;
      updates: Record<string, any>;
    },
    clientIp?: string
  ) {
    return AuditModificationService.applyAdminSurveyEdit(reportId, adminId, payload, clientIp);
  }

  static replaceReportPhoto(
    reportId: string,
    adminId: string,
    payload: {
      targetPhotoType: string;
      targetPhotoId?: string;
      defectId?: string;
      zoneId?: string;
      photoIndex?: number;
      newPhotoUrl: string;
      clientPin: string;
      replacementReason: string;
    },
    clientIp?: string
  ) {
    return AuditModificationService.replaceReportPhoto(reportId, adminId, payload, clientIp);
  }

  static reassignReportParcel(
    reportId: string,
    targetParcelIdOrCode: string,
    adminId: string,
    reason: string,
    clientIp?: string
  ) {
    return AuditModificationService.reassignReportParcel(reportId, targetParcelIdOrCode, adminId, reason, clientIp);
  }

  static swapReportParcels(
    reportAId: string,
    reportBId: string,
    adminId: string,
    reason: string,
    clientIp?: string
  ) {
    return AuditModificationService.swapReportParcels(reportAId, reportBId, adminId, reason, clientIp);
  }

  static searchSwapCandidates(
    zoneId?: string,
    excludeReportId?: string,
    search?: string,
    excludeParcelId?: string
  ) {
    return AuditModificationService.searchSwapCandidates(zoneId, excludeReportId, search, excludeParcelId);
  }

  // --- NHÓM 4: QUẢN LÝ PHIÊN BẢN & HOÀN NGUYÊN (VERSIONING & TIME TRAVEL) ---
  static getReportVersions(reportId: string) {
    return AuditVersionService.getVersionList(reportId);
  }

  static getReportVersionSnapshot(reportId: string, versionNumber: number) {
    return AuditVersionService.getVersionSnapshot(reportId, versionNumber);
  }

  static rollbackReportVersion(
    reportId: string,
    versionNumber: number,
    adminId: string,
    payload: { reason: string; password?: string },
    clientIp?: string
  ) {
    return AuditVersionService.rollbackToVersion(reportId, versionNumber, adminId, payload, clientIp);
  }

  // --- NHÓM 5: QUẢN LÝ VÒNG ĐỜI ẢNH (PHOTO LIFECYCLE & REGISTRY) ---
  static executePhotoAction(reportId: string, adminId: string, photoAction: any, clientIp?: string) {
    return AuditModificationService.executePhotoAction(reportId, adminId, photoAction, clientIp);
  }

  static getPhotoAuditRegistry(reportId: string) {
    return AuditModificationService.getPhotoAuditRegistry(reportId);
  }
}

