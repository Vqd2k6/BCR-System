import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/survey_model.dart';

class DraftService {
  static const String _draftKey = 'KSQH_MOBILE_SURVEY_DRAFT_V1';

  // Tự động lưu bản nháp vào bộ nhớ máy (Flash Storage)
  static Future<void> saveDraft(BuildingSurveyModel survey) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonString = jsonEncode(survey.toJson());
      await prefs.setString(_draftKey, jsonString);
    } catch (e) {
      // Ignore
    }
  }

  // Khôi phục bản nháp khi mở lại ứng dụng sau khi mất mạng hoặc tắt nguồn
  static Future<Map<String, dynamic>?> loadDraft() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonString = prefs.getString(_draftKey);
      if (jsonString != null) {
        return jsonDecode(jsonString) as Map<String, dynamic>;
      }
    } catch (e) {
      // Ignore
    }
    return null;
  }

  // Xóa bản nháp sau khi nộp thành công
  static Future<void> clearDraft() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_draftKey);
  }
}
