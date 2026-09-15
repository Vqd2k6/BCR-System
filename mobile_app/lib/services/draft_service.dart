import '../models/survey_model.dart';
import 'local_db_service.dart';

class DraftService {
  // ── LƯU NHÁP HỖN HỢP CŨ (V1) ──
  // Giữ lại để không lỗi mã cũ, nhưng nay đã chuyển sang SQLite
  static Future<void> saveDraft(BuildingSurveyModel survey) async {
    await LocalDbService.saveDraft(survey.houseCode, 'legacy', survey.toJson());
  }

  static Future<Map<String, dynamic>?> loadDraft() async {
    return await LocalDbService.getDraft('unknown', 'legacy');
  }

  static Future<void> clearDraft() async {
    await LocalDbService.clearDraft('unknown', 'legacy');
  }

  // ── LƯU NHÁP MỚI THEO PHASE (V2) ──

  static Future<void> savePhase1Draft(String buildingId, Map<String, dynamic> data) async {
    await LocalDbService.saveDraft(buildingId, 'phase1', data);
  }

  static Future<Map<String, dynamic>?> loadPhase1Draft(String buildingId) async {
    return await LocalDbService.getDraft(buildingId, 'phase1');
  }

  static Future<void> clearPhase1Draft(String buildingId) async {
    await LocalDbService.clearDraft(buildingId, 'phase1');
  }

  static Future<void> savePhase2Draft(String buildingId, Map<String, dynamic> data) async {
    await LocalDbService.saveDraft(buildingId, 'phase2', data);
  }

  static Future<Map<String, dynamic>?> loadPhase2Draft(String buildingId) async {
    return await LocalDbService.getDraft(buildingId, 'phase2');
  }

  static Future<void> clearPhase2Draft(String buildingId) async {
    await LocalDbService.clearDraft(buildingId, 'phase2');
  }
}
