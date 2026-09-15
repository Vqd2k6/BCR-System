import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'local_db_service.dart';
import 'api_service.dart';

class SyncService {
  static final SyncService _instance = SyncService._internal();
  factory SyncService() => _instance;
  SyncService._internal();

  final ApiService _apiService = ApiService();
  bool _isSyncing = false;

  /// Khởi tạo Listener lắng nghe sự thay đổi mạng
  void init() {
    Connectivity().onConnectivityChanged.listen((ConnectivityResult result) {
      if (result != ConnectivityResult.none) {
        _syncPendingTasks();
      }
    });
  }

  /// Gọi khi app khởi động để check và sync luôn
  Future<void> checkAndSync() async {
    final connectivityResult = await Connectivity().checkConnectivity();
    if (connectivityResult != ConnectivityResult.none) {
      await _syncPendingTasks();
    }
  }

  /// Đưa 1 request vào hàng đợi (gọi từ ApiService khi mất mạng)
  Future<void> enqueueRequest(String endpoint, Map<String, dynamic> payload) async {
    await LocalDbService.enqueueSync(endpoint, payload);
    // Báo cho UI biết đang lưu offline (có thể dùng Notification/Toast)
  }

  /// Quét hàng đợi và đồng bộ
  Future<void> _syncPendingTasks() async {
    if (_isSyncing) return;
    _isSyncing = true;

    try {
      final pendingTasks = await LocalDbService.getPendingSyncs();
      if (pendingTasks.isEmpty) return;

      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 20),
      ));
      
      // Có thể lấy Token từ storage thật nếu cần, ở đây giả lập
      dio.options.headers['Authorization'] = 'Bearer mock_jwt_token_2026';

      for (var task in pendingTasks) {
        final id = task['id'] as int;
        final endpoint = task['endpoint'] as String;
        final payload = task['payload_json'] as String;
        final retryCount = task['retry_count'] as int;

        if (retryCount >= 5) continue; // Bỏ qua nếu lỗi quá 5 lần

        try {
          // Gửi request thực tế (giả lập endpoint base là http://localhost:3001)
          // Trong thực tế, dùng _apiService._dio
          final response = await dio.post('http://localhost:3001$endpoint', data: payload);
          
          if (response.statusCode == 200 || response.statusCode == 201) {
            // Xóa khỏi hàng đợi sau khi thành công
            await LocalDbService.removeSyncTask(id);
          } else {
            await LocalDbService.markSyncFailed(id);
          }
        } catch (e) {
          // Lỗi mạng hoặc server, đánh dấu failed và thử lại sau
          await LocalDbService.markSyncFailed(id);
        }
      }
    } finally {
      _isSyncing = false;
    }
  }
}
