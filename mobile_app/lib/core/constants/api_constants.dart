class ApiConstants {
  // Thay đổi IP này thành địa chỉ IP máy chủ của bạn khi chạy trên thiết bị thật
  static const String baseUrl = 'http://localhost:5050/api';
  
  // Endpoints
  static const String login = '$baseUrl/auth/login';
  static const String me = '$baseUrl/auth/me';
  static const String zones = '$baseUrl/zones';
  static const String submitSurvey = '$baseUrl/buildings/survey';
  static const String presignedUrl = '$baseUrl/media/presigned-url';

  // Bản đồ Tile Layers (Esri World Imagery & OSM)
  static const String esriSatelliteTileUrl =
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  static const String osmStreetTileUrl =
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
}
