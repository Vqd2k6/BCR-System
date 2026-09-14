import 'package:latlong2/latlong.dart';

class BuildingSurveyModel {
  String houseCode;
  String ownerName;
  String address;
  String zoneId;
  LatLng hardwareGps;
  LatLng pinGps;
  double deviationMeters;
  List<LatLng> footprint;
  BuildingStructureModel structure;
  List<SurveyPhotoModel> photos;

  BuildingSurveyModel({
    required this.houseCode,
    required this.ownerName,
    required this.address,
    required this.zoneId,
    required this.hardwareGps,
    required this.pinGps,
    this.deviationMeters = 0.0,
    required this.footprint,
    required this.structure,
    required this.photos,
  });

  Map<String, dynamic> toJson() {
    return {
      'houseCode': houseCode,
      'ownerName': ownerName,
      'address': address,
      'zoneId': zoneId,
      'hardwareGps': {
        'lat': hardwareGps.latitude,
        'lng': hardwareGps.longitude,
      },
      'pinGps': {
        'lat': pinGps.latitude,
        'lng': pinGps.longitude,
      },
      'deviationMeters': deviationMeters,
      'footprint': footprint.map((p) => [p.latitude, p.longitude]).toList(),
      'structure': structure.toJson(),
      'photos': photos.map((p) => p.toJson()).toList(),
    };
  }
}

class BuildingStructureModel {
  String exteriorCondition;
  String exteriorNotes;
  List<FloorModel> floors;

  BuildingStructureModel({
    this.exteriorCondition = 'Bình thường',
    this.exteriorNotes = 'Kết cấu bê tông cốt thép ổn định',
    required this.floors,
  });

  Map<String, dynamic> toJson() {
    return {
      'exterior': {
        'condition': exteriorCondition,
        'notes': exteriorNotes,
      },
      'floors': floors.map((f) => f.toJson()).toList(),
    };
  }
}

class FloorModel {
  String name;
  List<RoomModel> rooms;

  FloorModel({
    required this.name,
    required this.rooms,
  });

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'rooms': rooms.map((r) => r.toJson()).toList(),
    };
  }
}

class RoomModel {
  String name;
  List<ComponentModel> components;

  RoomModel({
    required this.name,
    required this.components,
  });

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'components': components.map((c) => c.toJson()).toList(),
    };
  }
}

class ComponentModel {
  String name;
  bool hasDefect;
  String defectDescription;
  CrackDefectModel? crackDetail;

  ComponentModel({
    required this.name,
    this.hasDefect = false,
    this.defectDescription = 'Bình thường',
    this.crackDetail,
  });

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'hasDefect': hasDefect,
      'defectDescription': defectDescription,
      'crackDetail': crackDetail?.toJson(),
    };
  }
}

class CrackDefectModel {
  double lengthCm;
  double widthMm;
  String direction;
  String notes;

  CrackDefectModel({
    required this.lengthCm,
    required this.widthMm,
    this.direction = 'DIAGONAL',
    this.notes = '',
  });

  Map<String, dynamic> toJson() {
    return {
      'lengthCm': lengthCm,
      'widthMm': widthMm,
      'direction': direction,
      'notes': notes,
    };
  }
}

class SurveyPhotoModel {
  String photoUrl;
  String caption;
  String watermarkText;
  DateTime capturedAt;

  SurveyPhotoModel({
    required this.photoUrl,
    required this.caption,
    required this.watermarkText,
    required this.capturedAt,
  });

  Map<String, dynamic> toJson() {
    return {
      'photoUrl': photoUrl,
      'caption': caption,
      'watermarkText': watermarkText,
      'capturedAt': capturedAt.toIso8601String(),
    };
  }
}
