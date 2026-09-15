import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class LocalDbService {
  static const String _dbName = 'ksqh_metro2_offline.db';
  static const int _dbVersion = 1;

  static Database? _database;

  static Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB();
    return _database!;
  }

  static Future<Database> _initDB() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, _dbName);

    return await openDatabase(
      path,
      version: _dbVersion,
      onCreate: _createDB,
    );
  }

  static Future<void> _createDB(Database db, int version) async {
    // Bảng lưu nháp hồ sơ theo công trình và phase
    await db.execute('''
      CREATE TABLE drafts (
        id TEXT PRIMARY KEY,
        building_id TEXT NOT NULL,
        phase TEXT NOT NULL,
        json_data TEXT NOT NULL,
        last_saved TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    ''');

    // Bảng hàng đợi đồng bộ khi mất mạng
    await db.execute('''
      CREATE TABLE sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    ''');
  }

  // ==========================================
  // DRAFTS (LƯU NHÁP)
  // ==========================================

  /// Lưu hoặc cập nhật bản nháp (Upsert)
  static Future<void> saveDraft(String buildingId, String phase, Map<String, dynamic> data) async {
    final db = await database;
    final id = '${buildingId}_$phase';
    
    await db.insert(
      'drafts',
      {
        'id': id,
        'building_id': buildingId,
        'phase': phase,
        'json_data': jsonEncode(data),
        'last_saved': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Lấy bản nháp mới nhất của 1 công trình + phase
  static Future<Map<String, dynamic>?> getDraft(String buildingId, String phase) async {
    final db = await database;
    final id = '${buildingId}_$phase';

    final maps = await db.query(
      'drafts',
      where: 'id = ?',
      whereArgs: [id],
    );

    if (maps.isNotEmpty) {
      final jsonStr = maps.first['json_data'] as String;
      return jsonDecode(jsonStr) as Map<String, dynamic>;
    }
    return null;
  }

  /// Xóa bản nháp sau khi nộp thành công
  static Future<void> clearDraft(String buildingId, String phase) async {
    final db = await database;
    final id = '${buildingId}_$phase';
    await db.delete('drafts', where: 'id = ?', whereArgs: [id]);
  }

  // ==========================================
  // SYNC QUEUE (HÀNG ĐỢI ĐỒNG BỘ)
  // ==========================================

  /// Đưa 1 request vào hàng đợi khi không có mạng
  static Future<void> enqueueSync(String endpoint, Map<String, dynamic> payload) async {
    final db = await database;
    await db.insert('sync_queue', {
      'endpoint': endpoint,
      'payload_json': jsonEncode(payload),
    });
  }

  /// Lấy danh sách các request đang chờ đồng bộ
  static Future<List<Map<String, dynamic>>> getPendingSyncs() async {
    final db = await database;
    return await db.query(
      'sync_queue',
      where: 'status = ?',
      whereArgs: ['PENDING'],
      orderBy: 'created_at ASC', // Xử lý the thứ tự nộp
    );
  }

  /// Xóa 1 request khỏi hàng đợi sau khi đồng bộ thành công
  static Future<void> removeSyncTask(int id) async {
    final db = await database;
    await db.delete('sync_queue', where: 'id = ?', whereArgs: [id]);
  }

  /// Cập nhật trạng thái lỗi nếu đồng bộ thất bại (để tránh lặp vô hạn)
  static Future<void> markSyncFailed(int id) async {
    final db = await database;
    await db.rawUpdate(
      'UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?',
      [id]
    );
  }
}
