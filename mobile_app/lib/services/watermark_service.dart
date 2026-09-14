import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';

class WatermarkService {
  // Tạo chuỗi thông tin pháp lý dập lên ảnh
  static String generateWatermarkText({
    required LatLng hardwareGps,
    required String houseCode,
    required String locationTag,
  }) {
    final now = DateFormat('yyyy-MM-dd HH:mm:ss').format(DateTime.now());
    final lat = hardwareGps.latitude.toStringAsFixed(6);
    final lng = hardwareGps.longitude.toStringAsFixed(6);

    return 'GPS: $lat, $lng (±2m) | $now | CĂN: $houseCode | $locationTag';
  }
}
