import { AuditAlertsService } from './services/audit-alerts.service';
import { AuditReviewService } from './services/audit-review.service';
import { AuditModificationService } from './services/audit-modification.service';

export { AuditAlertsService, AuditReviewService, AuditModificationService };

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

  static getProgressAnalytics(zoneId?: string) {
    return AuditReviewService.getProgressAnalytics(zoneId);
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
    search?: string
  ) {
    return AuditModificationService.searchSwapCandidates(zoneId, excludeReportId, search);
  }
}
