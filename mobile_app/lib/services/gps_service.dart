import 'dart:math';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

class GpsService {
  // Lấy vị trí GPS phần cứng thực tế ngầm (Background Hardware GPS)
  static Future<LatLng> getCurrentHardwareLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return const LatLng(10.797120, 106.653850); // Default Bay Hien Station
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          return const LatLng(10.797120, 106.653850);
        }
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      return LatLng(position.latitude, position.longitude);
    } catch (e) {
      return const LatLng(10.797120, 106.653850);
    }
  }

  // Tính khoảng cách sai lệch giữa GPS ngầm và GPS ghim theo công thức Haversine (mét)
  static double calculateDeviationMeters(LatLng p1, LatLng p2) {
    const double r = 6371000; // Bán kính Trái Đất theo mét
    final double dLat = (p2.latitude - p1.latitude) * pi / 180;
    final double dLng = (p2.longitude - p1.longitude) * pi / 180;

    final double a = sin(dLat / 2) * sin(dLat / 2) +
        cos(p1.latitude * pi / 180) *
            cos(p2.latitude * pi / 180) *
            sin(dLng / 2) *
            sin(dLng / 2);
    final double c = 2 * atan2(sqrt(a), sqrt(1 - a));

    return r * c;
  }
}
