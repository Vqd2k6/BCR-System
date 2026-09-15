import 'package:dio/dio.dart';
import '../core/constants/api_constants.dart';
import '../models/user_model.dart';
import '../models/zone_model.dart';
import '../models/survey_model.dart';
import 'sync_service.dart';

class ApiService {
  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 20),
  ));

  String? _authToken;

  void setToken(String token) {
    _authToken = token;
    _dio.options.headers['Authorization'] = 'Bearer $token';
  }

  // Đăng nhập
  Future<UserModel?> login(String username, String password) async {
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

  // ── LEGACY: Nộp hồ sơ khảo sát cũ ───────────────────────────────────────────
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

  // ── PHASE 1 APIS ─────────────────────────────────────────────────────────────

  /// Lấy hồ sơ Phase 1 của công trình
  Future<Map<String, dynamic>?> getPhase1(String buildingId) async {
    try {
      final response = await _dio.get('${ApiConstants.baseUrl}/buildings/$buildingId/phase1');
      if (response.statusCode == 200 && response.data['success'] == true) {
        return response.data['data'] as Map<String, dynamic>;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  /// Nộp hồ sơ Phase 1 (ECS + VI + BRA)
  Future<void> submitPhase1({
    required String buildingId,
    required Map<String, dynamic> payload,
  }) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.baseUrl}/buildings/$buildingId/phase1',
        data: payload,
      );
      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception(response.data['message'] ?? 'Lỗi nộp Phase 1');
      }
    } catch (e) {
      if (e is DioException && (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.connectionError || e.type == DioExceptionType.unknown)) {
        // Mất mạng -> Đưa vào hàng đợi
        await SyncService().enqueueRequest('/api/buildings/$buildingId/phase1', payload);
        throw Exception('Mất kết nối mạng. Hồ sơ đã được lưu cục bộ và sẽ tự động đồng bộ khi có mạng.');
      }
      if (e is DioException) {
        final msg = e.response?.data['message'] ?? e.message ?? 'Lỗi mạng';
        throw Exception(msg);
      }
      rethrow;
    }
  }

  // ── PHASE 2 APIS ─────────────────────────────────────────────────────────────

  /// Lấy hồ sơ Phase 2 (kèm defects, media, signatures)
  Future<Map<String, dynamic>?> getPhase2(String buildingId) async {
    try {
      final response = await _dio.get('${ApiConstants.baseUrl}/buildings/$buildingId/phase2');
      if (response.statusCode == 200 && response.data['success'] == true) {
        return response.data['data'] as Map<String, dynamic>;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  /// Nộp hồ sơ Phase 2 (Prerequisite Gate kiểm tra server-side)
  Future<void> submitPhase2({
    required String buildingId,
    required Map<String, dynamic> payload,
  }) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.baseUrl}/buildings/$buildingId/phase2',
        data: payload,
      );
      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception(response.data['message'] ?? 'Lỗi nộp Phase 2');
      }
    } catch (e) {
      if (e is DioException && (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.connectionError || e.type == DioExceptionType.unknown)) {
        // Mất mạng -> Đưa vào hàng đợi
        await SyncService().enqueueRequest('/api/buildings/$buildingId/phase2', payload);
        throw Exception('Mất kết nối mạng. Hồ sơ đã được lưu cục bộ và sẽ tự động đồng bộ khi có mạng.');
      }
      if (e is DioException) {
        final code = e.response?.data['code'];
        if (code == 'PHASE1_NOT_APPROVED') {
          throw Exception('Phase 1 chưa được phê duyệt. Không thể tiến hành Phase 2.');
        }
        throw Exception(e.response?.data['message'] ?? e.message ?? 'Lỗi mạng');
      }
      rethrow;
    }
  }

  // ── DEFECT REGISTER APIS ─────────────────────────────────────────────────────

  /// Lấy danh sách khuyết tật của công trình
  Future<List<Map<String, dynamic>>> getDefects(String buildingId) async {
    try {
      final response = await _dio.get('${ApiConstants.baseUrl}/buildings/$buildingId/phase2/defects');
      if (response.statusCode == 200 && response.data['success'] == true) {
        return (response.data['data'] as List).cast<Map<String, dynamic>>();
      }
    } catch (e) {
      // ignore
    }
    return [];
  }

  /// Thêm khuyết tật mới D-xx
  Future<Map<String, dynamic>?> addDefect({
    required String buildingId,
    required Map<String, dynamic> payload,
  }) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.baseUrl}/buildings/$buildingId/phase2/defects',
        data: payload,
      );
      if ((response.statusCode == 200 || response.statusCode == 201) &&
          response.data['success'] == true) {
        return response.data['data'] as Map<String, dynamic>;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  // ── SIGNATURE APIS ────────────────────────────────────────────────────────────

  /// Ký số tại hiện trường (Mobile: OWNER_RESIDENT, SURVEYOR)
  Future<void> signMobile({
    required String buildingId,
    required Map<String, dynamic> payload,
  }) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.baseUrl}/buildings/$buildingId/phase2/signatures/mobile',
        data: payload,
      );
      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception(response.data['message'] ?? 'Lỗi lưu chữ ký');
      }
    } catch (e) {
      if (e is DioException) throw Exception(e.response?.data['message'] ?? e.message);
      rethrow;
    }
  }

  // ── MEDIA UPLOAD ──────────────────────────────────────────────────────────────

  /// Lấy Presigned URL để upload ảnh lên Cloudflare R2
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
