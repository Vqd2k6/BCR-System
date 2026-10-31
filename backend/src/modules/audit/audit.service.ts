import { AuditAlertsService } from './services/audit-alerts.service';
import { AuditReviewService } from './services/audit-review.service';
import { AuditModificationService } from './services/audit-modification.service';
import { AuditVersionService } from './services/audit-version.service';
import { CondoAuditFacade } from './condo/condo-audit.facade';
import { CondoAdminEditPayload, CondoPhotoActionItem } from './condo/condo-audit.types';

export { AuditAlertsService, AuditReviewService, AuditModificationService, AuditVersionService, CondoAuditFacade };

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
    parcelId?: string;
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

  static async getSplitPaneAuditView(reportId: string, options?: { includePhotoHistory?: boolean }) {
    const baseView = await AuditReviewService.getSplitPaneAuditView(reportId, options);
    return CondoAuditFacade.enrichSplitPaneAuditView(reportId, baseView as Record<string, unknown>);
  }

  static async approveReport(reportId: string, adminId: string, judgementNotes?: string) {
    if (await CondoAuditFacade.isCondoReport(reportId)) {
      return CondoAuditFacade.approveReport(reportId, adminId, judgementNotes);
    }
    return AuditReviewService.approveReport(reportId, adminId, judgementNotes);
  }

  static unlockApprovedReport(reportId: string, adminId: string) {
    return AuditReviewService.unlockApprovedReport(reportId, adminId);
  }

  static rejectReport(reportId: string, adminId: string, rejectionReason: string) {
    return AuditReviewService.rejectReport(reportId, adminId, rejectionReason);
  }

  static revertReportToDraft(identifier: string, adminId: string, reason?: string, unitId?: string | null, actorRole?: string) {
    return AuditReviewService.revertReportToDraft(identifier, adminId, reason, unitId, actorRole);
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
    return CondoAuditFacade.getCondoProgressSummary(parcelId);
  }

  static executeFinalSeal(parcelId: string, adminId: string, sealNotes?: string) {
    return CondoAuditFacade.executeFinalSeal(parcelId, adminId, sealNotes);
  }

  static listCondoTowers(zoneId?: string) {
    return CondoAuditFacade.listCondoTowers(zoneId);
  }

  static getScopeCounts(zoneId?: string) {
    return AuditReviewService.getScopeCounts(zoneId);
  }

  // --- NHÓM 3: ĐIỀU CHỈNH HỒ SƠ, THAY ẢNH BẢO MẬT & HOÁN ĐỔI RANH ĐẤT ---
  static async applyAdminSurveyEdit(
    reportId: string,
    adminId: string,
    payload: {
      adminPassword?: string;
      editReason: string;
      diffPayload: Array<{ field: string; label: string; oldValue: unknown; newValue: unknown }>;
      updates: Record<string, unknown>;
      photoActions?: CondoPhotoActionItem[];
    },
    clientIp?: string
  ) {
    if (await CondoAuditFacade.isCondoReport(reportId)) {
      return CondoAuditFacade.applyAdminSurveyEdit(
        reportId,
        adminId,
        payload as CondoAdminEditPayload,
        clientIp
      );
    }
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

  static async rollbackReportVersion(
    reportId: string,
    versionNumber: number,
    adminId: string,
    payload: { reason: string; password?: string },
    clientIp?: string
  ) {
    if (await CondoAuditFacade.isCondoReport(reportId)) {
      return CondoAuditFacade.rollbackReportVersion(
        reportId,
        versionNumber,
        adminId,
        payload,
        clientIp
      );
    }
    return AuditVersionService.rollbackToVersion(reportId, versionNumber, adminId, payload, clientIp);
  }

  // --- NHÓM 5: QUẢN LÝ VÒNG ĐỜI ẢNH (PHOTO LIFECYCLE & REGISTRY) ---
  static async executePhotoAction(
    reportId: string,
    adminId: string,
    photoAction: CondoPhotoActionItem,
    clientIp?: string
  ) {
    if (await CondoAuditFacade.isCondoReport(reportId)) {
      return CondoAuditFacade.executePhotoAction(reportId, adminId, photoAction, clientIp);
    }
    return AuditModificationService.executePhotoAction(reportId, adminId, photoAction, clientIp);
  }

  static getPhotoAuditRegistry(
    reportId: string,
    filters?: {
      photoCode?: string;
      photoType?: string;
      category?: string;
      currentPhotoUrl?: string;
      includeDeleted?: boolean;
    }
  ) {
    return AuditModificationService.getPhotoAuditRegistry(reportId, filters);
  }

  static restoreReportPhoto(
    reportId: string,
    adminId: string,
    payload: {
      registryPhotoId: string;
      restoreReason: string;
      adminPassword?: string;
    },
    clientIp?: string
  ) {
    return AuditModificationService.restoreReportPhoto(reportId, adminId, payload, clientIp);
  }

  static acquireAuditLock(reportId: string, userId: string) {
    return AuditModificationService.acquireAuditLock(reportId, userId);
  }

  static releaseAuditLock(reportId: string, userId: string) {
    return AuditModificationService.releaseAuditLock(reportId, userId);
  }

  static checkAuditLock(reportId: string, currentUserId?: string) {
    return AuditModificationService.checkAuditLock(reportId, currentUserId);
  }
}

