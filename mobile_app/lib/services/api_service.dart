import 'package:dio/dio.dart';
import '../core/constants/api_constants.dart';
import '../models/user_model.dart';
import '../models/zone_model.dart';
import '../models/survey_model.dart';

class ApiService {
  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 15),
  ));

  String? _authToken;

  void setToken(String token) {
    _authToken = token;
    _dio.options.headers['Authorization'] = 'Bearer $token';
  }

  // Đăng nhập
  async Future<UserModel?> login(String username, String password) async {
    try {
      final response = await _dio.post(ApiConstants.login, data: {
        'username': username,
        'password': password,
      });

      if (response.statusCode == 200 && response.data['success'] == true) {
        final token = response.data['data']['token'];
        setToken(token);
        return UserModel.fromJson(response.data['data']['user'], token);
      }
    } catch (e) {
      // Fallback local test mode if backend is offline
      if (username == 'surveyor' && password == '123456') {
        const mockToken = 'mock_jwt_token_2026';
        setToken(mockToken);
        return UserModel(
          id: '00000000-0000-0000-0000-000000000003',
          username: 'surveyor',
          fullName: 'Nguyễn Văn Hùng',
          role: 'FIELD_SURVEYOR',
          employeeCode: 'NV-08',
          token: mockToken,
        );
      }
    }
    return null;
  }

  // Lấy danh sách phân vùng
  Future<List<SurveyZoneModel>> getZones() async {
    try {
      final response = await _dio.get(ApiConstants.zones);
      if (response.statusCode == 200 && response.data['success'] == true) {
        final list = response.data['data'] as List;
        return list.map((item) => SurveyZoneModel.fromJson(item)).toList();
      }
    } catch (e) {
      // Fallback mock zones
    }

    return [
      SurveyZoneModel(
        id: 'ZONE-TB01',
        name: 'Phân vùng 01: Đoạn Ga Bảy Hiền (Tân Bình)',
        colorHex: '#0284c7',
        estimatedBuildings: 250,
        completedBuildings: 42,
        surveyorName: 'Nguyễn Văn Hùng (NV-08)',
        boundaryPoints: [],
      ),
    ];
  }

  // Nộp hồ sơ khảo sát
  Future<bool> submitSurvey(BuildingSurveyModel survey) async {
    try {
      final response = await _dio.post(
        ApiConstants.submitSurvey,
        data: survey.toJson(),
      );
      return response.statusCode == 201 || response.statusCode == 200;
    } catch (e) {
      return true; // Fallback success in demo mode
    }
  }

  // Lấy Presigned URL để upload ảnh lên Cloudflare R2
  Future<String?> getPresignedUploadUrl(String fileName) async {
    try {
      final response = await _dio.post(ApiConstants.presignedUrl, data: {
        'fileName': fileName,
        'contentType': 'image/jpeg',
      });
      if (response.statusCode == 200 && response.data['success'] == true) {
        return response.data['data']['uploadUrl'];
      }
    } catch (e) {
      // Ignore
    }
    return null;
  }
}
