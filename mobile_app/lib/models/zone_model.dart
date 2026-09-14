import 'package:latlong2/latlong.dart';

class SurveyZoneModel {
  final String id;
  final String name;
  final String colorHex;
  final int estimatedBuildings;
  final int completedBuildings;
  final String surveyorName;
  final List<LatLng> boundaryPoints;

  SurveyZoneModel({
    required this.id,
    required this.name,
    required this.colorHex,
    required this.estimatedBuildings,
    required this.completedBuildings,
    required this.surveyorName,
    required this.boundaryPoints,
  });

  factory SurveyZoneModel.fromJson(Map<String, dynamic> json) {
    List<LatLng> points = [];
    if (json['geometry'] != null && json['geometry']['coordinates'] != null) {
      final rawCoords = json['geometry']['coordinates'][0] as List;
      for (var pt in rawCoords) {
        // PostGIS GeoJSON is [lng, lat]
        points.add(LatLng(pt[1].toDouble(), pt[0].toDouble()));
      }
    }

    return SurveyZoneModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      colorHex: json['color_hex'] ?? '#0284c7',
      estimatedBuildings: json['estimated_buildings'] ?? 0,
      completedBuildings: json['completed_buildings'] ?? 0,
      surveyorName: json['surveyor_name'] ?? '',
      boundaryPoints: points,
    );
  }
}
