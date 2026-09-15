// ============================================================================
// PHASE 1 MODEL — BCS / ECS / BRA Assessment
// Tham chiếu: Phase 1_BCS_ECS_BRA.docx (18 Sections)
// ============================================================================

import 'package:latlong2/latlong.dart';

// ─── Enums ───────────────────────────────────────────────────────────────────

enum EcsClass { good, medium, deficient, critical }
enum StructuralFlag { none, low, moderate, high, critical }
enum ViClass { low, medium, high, veryHigh }
enum ImpactClass { i1Low, i2Medium, i3High, i4VeryHigh, pending }
enum BraResult { low, medium, high, veryHigh, pending }

extension EcsClassExt on EcsClass {
  String get label {
    switch (this) {
      case EcsClass.good:      return 'TỐT';
      case EcsClass.medium:    return 'TRUNG BÌNH';
      case EcsClass.deficient: return 'KÉM';
      case EcsClass.critical:  return 'NGUY CẤP';
    }
  }
}

extension BraResultExt on BraResult {
  String get label {
    switch (this) {
      case BraResult.low:      return 'THẤP';
      case BraResult.medium:   return 'TRUNG BÌNH';
      case BraResult.high:     return 'CAO';
      case BraResult.veryHigh: return 'RẤT CAO';
      case BraResult.pending:  return 'CHỜ DỮ LIỆU';
    }
  }
}

extension ViClassExt on ViClass {
  String get label {
    switch (this) {
      case ViClass.low:      return 'THẤP';
      case ViClass.medium:   return 'TRUNG BÌNH';
      case ViClass.high:     return 'CAO';
      case ViClass.veryHigh: return 'RẤT CAO';
    }
  }
}

// ─── Burland Zone Model (Mục 8) ──────────────────────────────────────────────

class BurlandZone {
  String zoneId;
  String location;
  String material;
  double wmax;
  int crackCount;
  String functionImpact;
  int grade;

  BurlandZone({
    required this.zoneId,
    this.location = '',
    this.material = '',
    this.wmax = 0.0,
    this.crackCount = 0,
    this.functionImpact = '',
    this.grade = 0,
  });

  Map<String, dynamic> toJson() => {
    'zoneId': zoneId,
    'location': location,
    'material': material,
    'wmax': wmax,
    'crackCount': crackCount,
    'functionImpact': functionImpact,
    'grade': grade,
  };

  factory BurlandZone.fromJson(Map<String, dynamic> json) => BurlandZone(
    zoneId: json['zoneId'] ?? '',
    location: json['location'] ?? '',
    material: json['material'] ?? '',
    wmax: (json['wmax'] ?? 0).toDouble(),
    crackCount: json['crackCount'] ?? 0,
    functionImpact: json['functionImpact'] ?? '',
    grade: json['grade'] ?? 0,
  );
}

// ─── Phase 1 Model (18 Mục) ──────────────────────────────────────────────────

class Phase1Model {
  String? id;
  String buildingId;

  // 1-2. Thông tin chung & Phạm vi
  String ownerName;
  String address;
  int? constructionYear;
  String? photoP01Url;
  String? photoP02Url;
  String? photoP03Url;
  String? photoP04Url;
  List<String> surveyedScope;
  bool hasAccessRestriction;
  String accessRestrictionNotes;

  // 3-4. Đặc điểm công trình & Móng
  String buildingUse;
  String structuralSystem;
  int foundationCat;
  String foundationSource;
  
  // 5. Lịch sử / Cải tạo
  bool hasExtensionsLoadChange;
  bool hasMajorRepairs;
  bool hasPriorSettlementTilt;
  bool hasAdjacentConstructionDamage;
  bool hasSensitiveEquipment;
  String sensitiveEquipmentNotes;

  // 8-9. Tổng hợp Burland
  List<BurlandZone> burlandZones;
  int burlandPredominant;
  int burlandLocalMax;
  String predominantZone;
  bool isRepresentativeAll;
  StructuralFlag structuralFlag;
  bool requiresEngineerReview;

  // 11. ECS (0-4 mỗi tiêu chí)
  int e1StructuralCracks;
  int e2WallMasonryCracks;
  int e3DeformationTilt;
  int e4WaterSeepageDet;
  int e5HistoryIntegrity;
  int e6FunctionalityState;
  bool ecsOverrideApplied;
  String ecsOverrideReason;

  // 12. Data Completeness Gate
  bool gateFoundation;
  bool gatePhotos;
  bool gateInternalSurvey;
  bool gateSettlement;
  bool gateDrawings;
  bool gateProceedBra;
  String gateProceedCondition;

  // 13. VI inputs (V1, V2, V4, V6)
  int v1UseConsequence;
  int v2StructuralFragility;
  int v4AgeModifications;
  int v6SensitiveEquipment;
  bool viOverrideApplied;
  String viOverrideReason;

  // 14. Tác động thi công
  String constructionType;
  double distanceToMetro;
  double maxSettlement;
  double angularDistortion;
  double ppvVibration;
  ImpactClass impactClass;

  Phase1Model({
    this.id,
    required this.buildingId,
    this.ownerName = '',
    this.address = '',
    this.constructionYear,
    this.photoP01Url,
    this.photoP02Url,
    this.photoP03Url,
    this.photoP04Url,
    
    // 1-2
    this.surveyedScope = const [],
    this.hasAccessRestriction = false,
    this.accessRestrictionNotes = '',
    
    // 3-4
    this.buildingUse = 'RESIDENTIAL',
    this.structuralSystem = 'RC_FRAME',
    this.foundationCat = 5,
    this.foundationSource = 'SITE_SURVEY',

    // 5
    this.hasExtensionsLoadChange = false,
    this.hasMajorRepairs = false,
    this.hasPriorSettlementTilt = false,
    this.hasAdjacentConstructionDamage = false,
    this.hasSensitiveEquipment = false,
    this.sensitiveEquipmentNotes = '',

    // 8-9
    List<BurlandZone>? burlandZones,
    this.burlandPredominant = 0,
    this.burlandLocalMax = 0,
    this.predominantZone = '',
    this.isRepresentativeAll = true,
    this.structuralFlag = StructuralFlag.none,
    this.requiresEngineerReview = false,

    // 11
    this.e1StructuralCracks = 0,
    this.e2WallMasonryCracks = 0,
    this.e3DeformationTilt = 0,
    this.e4WaterSeepageDet = 0,
    this.e5HistoryIntegrity = 0,
    this.e6FunctionalityState = 0,
    this.ecsOverrideApplied = false,
    this.ecsOverrideReason = '',

    // 12
    this.gateFoundation = false,
    this.gatePhotos = false,
    this.gateInternalSurvey = false,
    this.gateSettlement = false,
    this.gateDrawings = false,
    this.gateProceedBra = false,
    this.gateProceedCondition = '',

    // 13
    this.v1UseConsequence = 1,
    this.v2StructuralFragility = 1,
    this.v4AgeModifications = 1,
    this.v6SensitiveEquipment = 1,
    this.viOverrideApplied = false,
    this.viOverrideReason = '',

    // 14
    this.constructionType = 'TBM',
    this.distanceToMetro = 0.0,
    this.maxSettlement = 0.0,
    this.angularDistortion = 0.0,
    this.ppvVibration = 0.0,
    this.impactClass = ImpactClass.pending,
  }) : burlandZones = burlandZones ?? [
    BurlandZone(zoneId: 'Z-01'),
    BurlandZone(zoneId: 'Z-02'),
    BurlandZone(zoneId: 'Z-03'),
    BurlandZone(zoneId: 'Z-04'),
    BurlandZone(zoneId: 'Z-05'),
  ];

  // =========================================================================
  // LOGIC TÍNH TOÁN
  // =========================================================================

  int get ecsTotal => e1StructuralCracks + e2WallMasonryCracks + 
      e3DeformationTilt + e4WaterSeepageDet + e5HistoryIntegrity + e6FunctionalityState;

  EcsClass get computedEcsClass {
    if (ecsOverrideApplied && ecsOverrideReason.isNotEmpty) {
      // Đã override thì lấy theo rule custom (ở đây tạm giữ mặc định hoặc phải có trường chọn)
    }
    if (ecsTotal <= 5) return EcsClass.good;
    if (ecsTotal <= 10) return EcsClass.medium;
    if (ecsTotal <= 16) return EcsClass.deficient;
    return EcsClass.critical;
  }

  // Tự động map V3 từ Foundation CAT: Cat 5 -> V3=4, Cat 1 -> V3=1
  int get v3FoundationMapped {
    switch (foundationCat) {
      case 5: return 4;
      case 4: return 3;
      case 3: return 2;
      case 2: return 1;
      case 1: return 1;
      default: return 4;
    }
  }

  // Tự động map V5 từ ECS Class
  int get v5EcsMapped {
    switch (computedEcsClass) {
      case EcsClass.good: return 1;
      case EcsClass.medium: return 2;
      case EcsClass.deficient: return 3;
      case EcsClass.critical: return 4;
    }
  }

  int get viTotal => v1UseConsequence + v2StructuralFragility + 
      v3FoundationMapped + v4AgeModifications + v5EcsMapped + v6SensitiveEquipment;

  double get viAverage => viTotal / 6.0;

  ViClass get computedViClass {
    if (viAverage <= 1.5) return ViClass.low;
    if (viAverage <= 2.5) return ViClass.medium;
    if (viAverage <= 3.25) return ViClass.high;
    return ViClass.veryHigh;
  }

  BraResult get computedBraResult {
    if (impactClass == ImpactClass.pending) return BraResult.pending;
    
    // Ma trận rủi ro (V x I)
    final v = computedViClass;
    final i = impactClass;

    if (v == ViClass.low) {
      if (i == ImpactClass.i4VeryHigh) return BraResult.medium;
      return BraResult.low;
    }
    if (v == ViClass.medium) {
      if (i == ImpactClass.i1Low) return BraResult.low;
      if (i == ImpactClass.i4VeryHigh) return BraResult.high;
      return BraResult.medium;
    }
    if (v == ViClass.high) {
      if (i == ImpactClass.i4VeryHigh) return BraResult.veryHigh;
      if (i == ImpactClass.i1Low || i == ImpactClass.i2Medium) return BraResult.medium;
      return BraResult.high;
    }
    if (v == ViClass.veryHigh) {
      if (i == ImpactClass.i1Low || i == ImpactClass.i2Medium) return BraResult.high;
      return BraResult.veryHigh;
    }
    return BraResult.pending;
  }

  // =========================================================================
  // JSON
  // =========================================================================

  Map<String, dynamic> toJson() => {
    'buildingId': buildingId,
    'ownerName': ownerName,
    'address': address,
    'constructionYear': constructionYear,
    'photoP01Url': photoP01Url,
    'photoP02Url': photoP02Url,
    'photoP03Url': photoP03Url,
    'photoP04Url': photoP04Url,
    'surveyedScope': surveyedScope,
    'hasAccessRestriction': hasAccessRestriction,
    'accessRestrictionNotes': accessRestrictionNotes,
    'buildingUse': buildingUse,
    'structuralSystem': structuralSystem,
    'foundationCat': foundationCat,
    'foundationSource': foundationSource,
    'hasExtensionsLoadChange': hasExtensionsLoadChange,
    'hasMajorRepairs': hasMajorRepairs,
    'hasPriorSettlementTilt': hasPriorSettlementTilt,
    'hasAdjacentConstructionDamage': hasAdjacentConstructionDamage,
    'hasSensitiveEquipment': hasSensitiveEquipment,
    'sensitiveEquipmentNotes': sensitiveEquipmentNotes,
    'burlandZones': burlandZones.map((e) => e.toJson()).toList(),
    'burlandPredominant': burlandPredominant,
    'burlandLocalMax': burlandLocalMax,
    'predominantZone': predominantZone,
    'isRepresentativeAll': isRepresentativeAll,
    'structuralFlag': structuralFlag.name,
    'requiresEngineerReview': requiresEngineerReview,
    'e1StructuralCracks': e1StructuralCracks,
    'e2WallMasonryCracks': e2WallMasonryCracks,
    'e3DeformationTilt': e3DeformationTilt,
    'e4WaterSeepageDet': e4WaterSeepageDet,
    'e5HistoryIntegrity': e5HistoryIntegrity,
    'e6FunctionalityState': e6FunctionalityState,
    'ecsOverrideApplied': ecsOverrideApplied,
    'ecsOverrideReason': ecsOverrideReason,
    'gateFoundation': gateFoundation,
    'gatePhotos': gatePhotos,
    'gateInternalSurvey': gateInternalSurvey,
    'gateSettlement': gateSettlement,
    'gateDrawings': gateDrawings,
    'gateProceedBra': gateProceedBra,
    'gateProceedCondition': gateProceedCondition,
    'v1UseConsequence': v1UseConsequence,
    'v2StructuralFragility': v2StructuralFragility,
    'v4AgeModifications': v4AgeModifications,
    'v6SensitiveEquipment': v6SensitiveEquipment,
    'viOverrideApplied': viOverrideApplied,
    'viOverrideReason': viOverrideReason,
    'constructionType': constructionType,
    'distanceToMetro': distanceToMetro,
    'maxSettlement': maxSettlement,
    'angularDistortion': angularDistortion,
    'ppvVibration': ppvVibration,
    'impactClass': impactClass.name,
  };

  factory Phase1Model.fromJson(Map<String, dynamic> json) {
    return Phase1Model(
      buildingId: json['buildingId'] ?? '',
      ownerName: json['ownerName'] ?? '',
      address: json['address'] ?? '',
      constructionYear: json['constructionYear'],
      photoP01Url: json['photoP01Url'],
      photoP02Url: json['photoP02Url'],
      photoP03Url: json['photoP03Url'],
      photoP04Url: json['photoP04Url'],
      surveyedScope: List<String>.from(json['surveyedScope'] ?? []),
      hasAccessRestriction: json['hasAccessRestriction'] ?? false,
      accessRestrictionNotes: json['accessRestrictionNotes'] ?? '',
      buildingUse: json['buildingUse'] ?? 'RESIDENTIAL',
      structuralSystem: json['structuralSystem'] ?? 'RC_FRAME',
      foundationCat: json['foundationCat'] ?? 5,
      foundationSource: json['foundationSource'] ?? 'SITE_SURVEY',
      hasExtensionsLoadChange: json['hasExtensionsLoadChange'] ?? false,
      hasMajorRepairs: json['hasMajorRepairs'] ?? false,
      hasPriorSettlementTilt: json['hasPriorSettlementTilt'] ?? false,
      hasAdjacentConstructionDamage: json['hasAdjacentConstructionDamage'] ?? false,
      hasSensitiveEquipment: json['hasSensitiveEquipment'] ?? false,
      sensitiveEquipmentNotes: json['sensitiveEquipmentNotes'] ?? '',
      burlandZones: (json['burlandZones'] as List?)?.map((e) => BurlandZone.fromJson(e)).toList(),
      burlandPredominant: json['burlandPredominant'] ?? 0,
      burlandLocalMax: json['burlandLocalMax'] ?? 0,
      predominantZone: json['predominantZone'] ?? '',
      isRepresentativeAll: json['isRepresentativeAll'] ?? true,
      structuralFlag: StructuralFlag.values.firstWhere((e) => e.name == json['structuralFlag'], orElse: () => StructuralFlag.none),
      requiresEngineerReview: json['requiresEngineerReview'] ?? false,
      e1StructuralCracks: json['e1StructuralCracks'] ?? 0,
      e2WallMasonryCracks: json['e2WallMasonryCracks'] ?? 0,
      e3DeformationTilt: json['e3DeformationTilt'] ?? 0,
      e4WaterSeepageDet: json['e4WaterSeepageDet'] ?? 0,
      e5HistoryIntegrity: json['e5HistoryIntegrity'] ?? 0,
      e6FunctionalityState: json['e6FunctionalityState'] ?? 0,
      ecsOverrideApplied: json['ecsOverrideApplied'] ?? false,
      ecsOverrideReason: json['ecsOverrideReason'] ?? '',
      gateFoundation: json['gateFoundation'] ?? false,
      gatePhotos: json['gatePhotos'] ?? false,
      gateInternalSurvey: json['gateInternalSurvey'] ?? false,
      gateSettlement: json['gateSettlement'] ?? false,
      gateDrawings: json['gateDrawings'] ?? false,
      gateProceedBra: json['gateProceedBra'] ?? false,
      gateProceedCondition: json['gateProceedCondition'] ?? '',
      v1UseConsequence: json['v1UseConsequence'] ?? 1,
      v2StructuralFragility: json['v2StructuralFragility'] ?? 1,
      v4AgeModifications: json['v4AgeModifications'] ?? 1,
      v6SensitiveEquipment: json['v6SensitiveEquipment'] ?? 1,
      viOverrideApplied: json['viOverrideApplied'] ?? false,
      viOverrideReason: json['viOverrideReason'] ?? '',
      constructionType: json['constructionType'] ?? 'TBM',
      distanceToMetro: (json['distanceToMetro'] ?? 0).toDouble(),
      maxSettlement: (json['maxSettlement'] ?? 0).toDouble(),
      angularDistortion: (json['angularDistortion'] ?? 0).toDouble(),
      ppvVibration: (json['ppvVibration'] ?? 0).toDouble(),
      impactClass: ImpactClass.values.firstWhere((e) => e.name == json['impactClass'], orElse: () => ImpactClass.pending),
    );
  }
}
