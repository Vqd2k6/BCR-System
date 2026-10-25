import {
  CondoAdminEditPayload,
  CondoPhotoActionItem,
  CondoRollbackPayload,
} from './condo-audit.types';
import { CondoCrudEngineService } from './services/condo-crud-engine.service';
import { CondoVersionRollbackService } from './services/condo-version-rollback.service';
import { CondoQueueService } from './services/condo-queue.service';
import { CondoFinalSealService } from './services/condo-final-seal.service';

/**
 * Facade điều phối độc lập cho toàn bộ Phân hệ Thẩm định Chung cư (Condo Audit Module).
 * Mọi thao tác CRUD, Versioning, Photo Lineage, Rollback và Final Seal của Chung cư
 * được đóng gói tại đây để cô lập 100% khỏi phân hệ Nhà dân độc lập (STANDALONE).
 */
export class CondoAuditFacade {
  static async isCondoReport(reportIdOrParcelId: string): Promise<boolean> {
    const resolved = await CondoCrudEngineService.resolveCondoReportContext(reportIdOrParcelId);
    return resolved !== null;
  }

  static enrichSplitPaneAuditView<T extends Record<string, unknown>>(
    reportId: string,
    baseView: T
  ): Promise<T> {
    return CondoQueueService.enrichSplitPaneAuditViewForCondo(reportId, baseView);
  }

  static listCondoTowers(zoneId?: string) {
    return CondoQueueService.listCondoTowers(zoneId);
  }

  static getCondoProgressSummary(parcelId: string) {
    return CondoQueueService.getCondoProgressSummary(parcelId);
  }

  static approveReport(reportId: string, adminId: string, judgementNotes?: string) {
    return CondoFinalSealService.approveCondoReport(reportId, adminId, judgementNotes);
  }

  static executeFinalSeal(parcelId: string, adminId: string, sealNotes?: string) {
    return CondoFinalSealService.executeFinalSeal(parcelId, adminId, sealNotes);
  }

  static applyAdminSurveyEdit(
    reportId: string,
    adminId: string,
    payload: CondoAdminEditPayload,
    clientIp?: string
  ) {
    return CondoCrudEngineService.applyCondoAdminSurveyEdit(reportId, adminId, payload, clientIp);
  }

  static executePhotoAction(
    reportId: string,
    adminId: string,
    photoAction: CondoPhotoActionItem,
    clientIp?: string
  ) {
    return CondoCrudEngineService.executeCondoPhotoAction(reportId, adminId, photoAction, clientIp);
  }

  static rollbackReportVersion(
    reportId: string,
    versionNumber: number,
    adminId: string,
    payload: CondoRollbackPayload,
    clientIp?: string
  ) {
    return CondoVersionRollbackService.rollbackCondoReportVersion(
      reportId,
      versionNumber,
      adminId,
      payload,
      clientIp
    );
  }
}

