import { PoolClient } from 'pg';
import { SurveyBaseRepository } from './repositories/survey-base.repository';
import { SurveyDefectsRepository } from './repositories/survey-defects.repository';
import { SurveyMutationRepository } from './repositories/survey-mutation.repository';
import { SurveyDraftRepository } from './repositories/survey-draft.repository';

export {
  SurveyBaseRepository,
  SurveyDefectsRepository,
  SurveyMutationRepository,
  SurveyDraftRepository,
};

/**
 * Facade Pattern cho hệ thống Survey Repositories:
 * Đảm bảo 100% tương thích ngược (Backward Compatibility) cho tất cả các Service/Controller
 * đang gọi `SurveyRepository.*`.
 * Toàn bộ logic chuyên sâu đã được phân rã thành 4 Sub-Repositories đơn nhiệm:
 * 1. SurveyBaseRepository: Quản lý báo cáo gốc, tìm kiếm, lưu trữ, nộp hồ sơ.
 * 2. SurveyDefectsRepository: Quản lý khuyết tật, tầng, cấu kiện, ảnh và biến dạng.
 * 3. SurveyMutationRepository: Quản lý biến động thực địa Tách/Gộp thửa.
 * 4. SurveyDraftRepository: Quản lý lưu nháp tự động, locking và bàn giao ca.
 */
export class SurveyRepository {
  // --- BASE & METADATA ---
  public static async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    return SurveyBaseRepository.hasColumn(tableName, columnName);
  }

  public static async createBaseReport(data: {
    parcelId: string;
    surveyorId: string;
    reportCode: string;
    phase: 'PHASE_1' | 'PHASE_2';
    unitId?: string;
    parentReportId?: string;
    reportType?: string;
  }): Promise<{ id: string; report_code: string }> {
    return SurveyBaseRepository.createBaseReport(data);
  }

  public static async findReportById(reportId: string): Promise<any | null> {
    return SurveyBaseRepository.findReportById(reportId);
  }

  public static async submitReport(reportId: string, submitData: any): Promise<void> {
    return SurveyBaseRepository.submitReport(reportId, submitData);
  }

  public static async updateReportData(reportId: string, updateData: any): Promise<number> {
    return SurveyBaseRepository.updateReportData(reportId, updateData);
  }

  public static async findLatestPhase1ReportByParcelId(parcelId: string): Promise<any | null> {
    return SurveyBaseRepository.findLatestPhase1ReportByParcelId(parcelId);
  }

  public static async resolveParcelId(parcelId: string): Promise<string | null> {
    return SurveyBaseRepository.resolveParcelId(parcelId);
  }

  // --- DEFECTS, SPECS & DAMAGE ZONES ---
  public static async saveIdentificationPhotos(reportId: string, photos: any): Promise<void> {
    return SurveyDefectsRepository.saveIdentificationPhotos(reportId, photos);
  }

  public static async saveBuildingSpecs(reportId: string, specs: any): Promise<void> {
    return SurveyDefectsRepository.saveBuildingSpecs(reportId, specs);
  }

  public static async createDamageZone(reportId: string, zoneData: any): Promise<any> {
    return SurveyDefectsRepository.createDamageZone(reportId, zoneData);
  }

  public static async createDefectItem(zoneId: string, defectData: any): Promise<any> {
    return SurveyDefectsRepository.createDefectItem(zoneId, defectData);
  }

  public static async saveDeformation(reportId: string, deform: any): Promise<void> {
    return SurveyDefectsRepository.saveDeformation(reportId, deform);
  }

  public static async saveSurveyScope(reportId: string, scopeData: any): Promise<void> {
    return SurveyDefectsRepository.saveSurveyScope(reportId, scopeData);
  }

  public static async saveFloorSurveys(reportId: string, floors: any[]): Promise<void> {
    return SurveyDefectsRepository.saveFloorSurveys(reportId, floors);
  }

  // --- FIELD MUTATIONS (SPLIT / MERGE) ---
  public static toGeoJsonPolygon(points: any): any {
    return SurveyMutationRepository.toGeoJsonPolygon(points);
  }

  public static async handleFieldSplitMutation(
    client: PoolClient,
    reportId: string,
    rawMutation: any
  ): Promise<void> {
    return SurveyMutationRepository.handleFieldSplitMutation(client, reportId, rawMutation);
  }

  public static async handleFieldMergeMutation(
    client: PoolClient,
    reportId: string,
    rawMutation: any
  ): Promise<void> {
    return SurveyMutationRepository.handleFieldMergeMutation(client, reportId, rawMutation);
  }

  // --- DRAFTS & HANDOVER LOCKING ---
  public static async findActiveDraft(
    parcelId: string,
    unitId?: string | null,
    phase: string = 'PHASE_1'
  ): Promise<any | null> {
    return SurveyDraftRepository.findActiveDraft(parcelId, unitId, phase);
  }

  public static async upsertDraft(data: {
    parcelId: string;
    surveyorId: string;
    unitId?: string | null;
    reportType?: string;
    currentStep: number;
    surveyData: any;
    syncVersion?: number;
  }): Promise<any> {
    return SurveyDraftRepository.upsertDraft(data);
  }

  public static async releaseDraftLock(
    parcelId: string,
    unitId: string | null,
    surveyorId: string
  ): Promise<any> {
    return SurveyDraftRepository.releaseDraftLock(parcelId, unitId, surveyorId);
  }

  public static async takeoverDraft(
    parcelId: string,
    unitId: string | null,
    newSurveyorId: string,
    note?: string
  ): Promise<any> {
    return SurveyDraftRepository.takeoverDraft(parcelId, unitId, newSurveyorId, note);
  }
}
