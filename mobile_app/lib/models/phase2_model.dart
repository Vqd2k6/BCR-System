// ============================================================================
// PHASE 2 MODEL — Pre-Construction Survey + Defect Register + Signatures
// Tham chiếu: Phase 2_Pre Constuction BCS.docx (12 Sections)
// ============================================================================

enum DefectType {
  crack,
  settlementTilt,
  deflectionSagging,
  spallingDelamination,
  rebarCorrosion,
  waterSeepage,
  finishDefect,
  doorWindowJam,
}

extension DefectTypeExt on DefectType {
  String get label {
    switch (this) {
      case DefectType.crack:               return 'Nứt (Crack)';
      case DefectType.settlementTilt:      return 'Lún/Nghiêng';
      case DefectType.deflectionSagging:   return 'Võng/Biến dạng';
      case DefectType.spallingDelamination:return 'Bong tróc/Tách lớp';
      case DefectType.rebarCorrosion:      return 'Ăn mòn/Lộ thép';
      case DefectType.waterSeepage:        return 'Thấm/Ẩm';
      case DefectType.finishDefect:        return 'Hư hỏng hoàn thiện';
      case DefectType.doorWindowJam:       return 'Kẹt cửa/Nứt góc cửa';
    }
  }
}

enum CrackDirection { diagonal45, vertical, horizontal, steppedMortar, xPattern, spiderWeb, random }

enum DefectActivity { staticDefect, activeDeveloping, repairedRecracked, unknown }

enum DeltaComparison {
  unchanged('Không đổi'),
  widened('Phát triển rộng hơn'),
  lengthened('Phát triển dài hơn'),
  repaired('Đã sửa chữa'),
  newDamage('Mới ghi nhận');

  final String label;
  const DeltaComparison(this.label);
}

enum AccessStatus {
  full('Đầy đủ'),
  partial('Một phần'),
  restricted('Bị hạn chế'),
  denied('Từ chối/Vắng mặt');

  final String label;
  const AccessStatus(this.label);
}

enum StructuralElement { column, beam, slab, wall, ceiling, staircase, foundation, other }

// ─── 4. Lưới Ghi nhận hiện trạng theo khu vực ───────────────────────────────

class RoomAssessment {
  String floorOrZone;
  String slabCeilingState;
  String wallState;
  String columnBeamState;
  String seepageSpallingState;
  String settlementDeformationState;
  String notesAndPhotoIds;

  RoomAssessment({
    required this.floorOrZone,
    this.slabCeilingState = '',
    this.wallState = '',
    this.columnBeamState = '',
    this.seepageSpallingState = '',
    this.settlementDeformationState = '',
    this.notesAndPhotoIds = '',
  });

  Map<String, dynamic> toJson() => {
    'floorOrZone': floorOrZone,
    'slabCeilingState': slabCeilingState,
    'wallState': wallState,
    'columnBeamState': columnBeamState,
    'seepageSpallingState': seepageSpallingState,
    'settlementDeformationState': settlementDeformationState,
    'notesAndPhotoIds': notesAndPhotoIds,
  };

  factory RoomAssessment.fromJson(Map<String, dynamic> json) => RoomAssessment(
    floorOrZone: json['floorOrZone'] ?? '',
    slabCeilingState: json['slabCeilingState'] ?? '',
    wallState: json['wallState'] ?? '',
    columnBeamState: json['columnBeamState'] ?? '',
    seepageSpallingState: json['seepageSpallingState'] ?? '',
    settlementDeformationState: json['settlementDeformationState'] ?? '',
    notesAndPhotoIds: json['notesAndPhotoIds'] ?? '',
  );
}

// ─── 5. Sổ Khuyết tật ────────────────────────────────────────────────────────

class DefectEntryModel {
  String id;
  String defectCode; // D-01, D-02...

  String floorName;
  String roomOrZone;
  StructuralElement structuralElement;
  DefectType defectType;

  double? maxCrackWidthMm;
  double? crackLengthM;
  CrackDirection? crackDirection;
  
  // URLs ảnh
  String? ctxPhotoUrl;  // Ảnh bối cảnh
  String? cuPhotoUrl;   // Ảnh cận cảnh thước

  String defectNotes;

  DefectEntryModel({
    required this.id,
    required this.defectCode,
    required this.floorName,
    required this.roomOrZone,
    required this.structuralElement,
    required this.defectType,
    this.maxCrackWidthMm,
    this.crackLengthM,
    this.crackDirection,
    this.ctxPhotoUrl,
    this.cuPhotoUrl,
    this.defectNotes = '',
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'defectCode': defectCode,
    'floorName': floorName,
    'roomOrZone': roomOrZone,
    'structuralElement': structuralElement.name,
    'defectType': defectType.name,
    'maxCrackWidthMm': maxCrackWidthMm,
    'crackLengthM': crackLengthM,
    'crackDirection': crackDirection?.name,
    'ctxPhotoUrl': ctxPhotoUrl,
    'cuPhotoUrl': cuPhotoUrl,
    'defectNotes': defectNotes,
  };

  factory DefectEntryModel.fromJson(Map<String, dynamic> json) => DefectEntryModel(
    id: json['id'] ?? '',
    defectCode: json['defectCode'] ?? '',
    floorName: json['floorName'] ?? '',
    roomOrZone: json['roomOrZone'] ?? '',
    structuralElement: StructuralElement.values.firstWhere((e) => e.name == json['structuralElement'], orElse: () => StructuralElement.wall),
    defectType: DefectType.values.firstWhere((e) => e.name == json['defectType'], orElse: () => DefectType.crack),
    maxCrackWidthMm: (json['maxCrackWidthMm'] as num?)?.toDouble(),
    crackLengthM: (json['crackLengthM'] as num?)?.toDouble(),
    crackDirection: json['crackDirection'] != null ? CrackDirection.values.firstWhere((e) => e.name == json['crackDirection']) : null,
    ctxPhotoUrl: json['ctxPhotoUrl'],
    cuPhotoUrl: json['cuPhotoUrl'],
    defectNotes: json['defectNotes'] ?? '',
  );
}

// ─── 6. Dấu hiệu Lún / Nghiêng ───────────────────────────────────────────────

class TiltSettlementRecord {
  String location;
  String targetObject;
  String measuredValue;
  String method;
  String photoId;
  String notes;

  TiltSettlementRecord({
    required this.location,
    required this.targetObject,
    required this.measuredValue,
    this.method = '',
    this.photoId = '',
    this.notes = '',
  });

  Map<String, dynamic> toJson() => {
    'location': location,
    'targetObject': targetObject,
    'measuredValue': measuredValue,
    'method': method,
    'photoId': photoId,
    'notes': notes,
  };

  factory TiltSettlementRecord.fromJson(Map<String, dynamic> json) => TiltSettlementRecord(
    location: json['location'] ?? '',
    targetObject: json['targetObject'] ?? '',
    measuredValue: json['measuredValue'] ?? '',
    method: json['method'] ?? '',
    photoId: json['photoId'] ?? '',
    notes: json['notes'] ?? '',
  );
}

// ─── Chữ ký ──────────────────────────────────────────────────────────────────

class SignatureModel {
  final String signerFullName;
  final String signerTitle;
  final String signatureImageUrl;
  final DateTime signedAt;

  const SignatureModel({
    required this.signerFullName,
    required this.signerTitle,
    required this.signatureImageUrl,
    required this.signedAt,
  });

  Map<String, dynamic> toJson() => {
    'signerFullName': signerFullName,
    'signerTitle': signerTitle,
    'signatureImageUrl': signatureImageUrl,
    'signedAt': signedAt.toIso8601String(),
  };

  factory SignatureModel.fromJson(Map<String, dynamic> json) => SignatureModel(
    signerFullName: json['signerFullName'] ?? '',
    signerTitle: json['signerTitle'] ?? '',
    signatureImageUrl: json['signatureImageUrl'] ?? '',
    signedAt: DateTime.parse(json['signedAt'] ?? DateTime.now().toIso8601String()),
  );
}

// ─── Phase 2 Model ───────────────────────────────────────────────────────────

class Phase2Model {
  String? id;
  String buildingId;
  String? phase1Id;
  
  // 1-2. Thông tin chung & Thay đổi
  String structuralSystem;
  String foundationType;
  int foundationCat;
  bool hasExtensions;
  String extensionsNotes;
  bool hasRepairs;
  String repairsNotes;
  bool hasLoadChanges;
  String loadChangesNotes;
  bool noSignificantChangeFromPhase1;

  // 3. Ảnh P01, P02
  String? p01PhotoUrl;
  String? p02PhotoUrl;

  // 4. Lưới đánh giá
  List<RoomAssessment> roomAssessments;

  // 5. Sổ khuyết tật
  List<DefectEntryModel> defects;

  // 6. Lún/Nghiêng
  List<TiltSettlementRecord> tiltRecords;

  // 8. Sketch
  String? sketchDrawingUrl;
  String sketchNotes;

  // 9. So sánh GĐ1
  DeltaComparison deltaStatus;
  int originalPhotoCount;
  int originalDrawingCount;
  String inaccessibleAreas;
  String dataLimitations;
  String mostNotableDamage;
  AccessStatus accessStatus;
  bool hasCriticalSigns;
  bool needsMonitoring;
  String additionalSurveyNeeded;
  String finalConditionConclusion;

  // 11-12. Ý kiến và Chữ ký
  String ownerComments;
  SignatureModel? ownerSignature;
  SignatureModel? surveyorSignature;

  Phase2Model({
    this.id,
    required this.buildingId,
    this.phase1Id,

    // 1-2
    this.structuralSystem = 'Khung',
    this.foundationType = 'Chưa rõ',
    this.foundationCat = 5,
    this.hasExtensions = false,
    this.extensionsNotes = '',
    this.hasRepairs = false,
    this.repairsNotes = '',
    this.hasLoadChanges = false,
    this.loadChangesNotes = '',
    this.noSignificantChangeFromPhase1 = true,

    // 3
    this.p01PhotoUrl,
    this.p02PhotoUrl,

    // 4, 5, 6
    List<RoomAssessment>? roomAssessments,
    List<DefectEntryModel>? defects,
    List<TiltSettlementRecord>? tiltRecords,

    // 8
    this.sketchDrawingUrl,
    this.sketchNotes = "",

    // 9
    this.deltaStatus = DeltaComparison.unchanged,
    this.originalPhotoCount = 0,
    this.originalDrawingCount = 0,
    this.inaccessibleAreas = '',
    this.dataLimitations = '',
    this.mostNotableDamage = '',
    this.accessStatus = AccessStatus.full,
    this.hasCriticalSigns = false,
    this.needsMonitoring = false,
    this.additionalSurveyNeeded = '',
    this.finalConditionConclusion = 'Ổn định theo quan sát',

    // 11-12
    this.ownerComments = '',
    this.ownerSignature,
    this.surveyorSignature,
  }) : 
    roomAssessments = roomAssessments ?? [],
    defects = defects ?? [],
    tiltRecords = tiltRecords ?? [];

  Map<String, dynamic> toJson() => {
    'buildingId': buildingId,
    'structuralSystem': structuralSystem,
    'foundationType': foundationType,
    'foundationCat': foundationCat,
    'hasExtensions': hasExtensions,
    'extensionsNotes': extensionsNotes,
    'hasRepairs': hasRepairs,
    'repairsNotes': repairsNotes,
    'hasLoadChanges': hasLoadChanges,
    'loadChangesNotes': loadChangesNotes,
    'noSignificantChangeFromPhase1': noSignificantChangeFromPhase1,
    'p01PhotoUrl': p01PhotoUrl,
    'p02PhotoUrl': p02PhotoUrl,
    'roomAssessments': roomAssessments.map((e) => e.toJson()).toList(),
    'defects': defects.map((e) => e.toJson()).toList(),
    'tiltRecords': tiltRecords.map((e) => e.toJson()).toList(),
    'sketchDrawingUrl': sketchDrawingUrl,
    'sketchNotes': sketchNotes,
    'deltaStatus': deltaStatus.name,
    'originalPhotoCount': originalPhotoCount,
    'originalDrawingCount': originalDrawingCount,
    'inaccessibleAreas': inaccessibleAreas,
    'dataLimitations': dataLimitations,
    'mostNotableDamage': mostNotableDamage,
    'accessStatus': accessStatus.name,
    'hasCriticalSigns': hasCriticalSigns,
    'needsMonitoring': needsMonitoring,
    'additionalSurveyNeeded': additionalSurveyNeeded,
    'finalConditionConclusion': finalConditionConclusion,
    'ownerComments': ownerComments,
    'ownerSignature': ownerSignature?.toJson(),
    'surveyorSignature': surveyorSignature?.toJson(),
  };

  factory Phase2Model.fromJson(Map<String, dynamic> json) {
    return Phase2Model(
      buildingId: json['buildingId'] ?? '',
      structuralSystem: json['structuralSystem'] ?? 'Khung',
      foundationType: json['foundationType'] ?? 'Chưa rõ',
      foundationCat: json['foundationCat'] ?? 5,
      hasExtensions: json['hasExtensions'] ?? false,
      extensionsNotes: json['extensionsNotes'] ?? '',
      hasRepairs: json['hasRepairs'] ?? false,
      repairsNotes: json['repairsNotes'] ?? '',
      hasLoadChanges: json['hasLoadChanges'] ?? false,
      loadChangesNotes: json['loadChangesNotes'] ?? '',
      noSignificantChangeFromPhase1: json['noSignificantChangeFromPhase1'] ?? true,
      p01PhotoUrl: json['p01PhotoUrl'],
      p02PhotoUrl: json['p02PhotoUrl'],
      roomAssessments: (json['roomAssessments'] as List?)?.map((e) => RoomAssessment.fromJson(e)).toList() ?? [],
      defects: (json['defects'] as List?)?.map((e) => DefectEntryModel.fromJson(e)).toList() ?? [],
      tiltRecords: (json['tiltRecords'] as List?)?.map((e) => TiltSettlementRecord.fromJson(e)).toList() ?? [],
      sketchDrawingUrl: json['sketchDrawingUrl'],
      sketchNotes: json['sketchNotes'] ?? "",
      deltaStatus: DeltaComparison.values.firstWhere((e) => e.name == json['deltaStatus'], orElse: () => DeltaComparison.unchanged),
      originalPhotoCount: json['originalPhotoCount'] ?? 0,
      originalDrawingCount: json['originalDrawingCount'] ?? 0,
      inaccessibleAreas: json['inaccessibleAreas'] ?? '',
      dataLimitations: json['dataLimitations'] ?? '',
      mostNotableDamage: json['mostNotableDamage'] ?? '',
      accessStatus: AccessStatus.values.firstWhere((e) => e.name == json['accessStatus'], orElse: () => AccessStatus.full),
      hasCriticalSigns: json['hasCriticalSigns'] ?? false,
      needsMonitoring: json['needsMonitoring'] ?? false,
      additionalSurveyNeeded: json['additionalSurveyNeeded'] ?? '',
      finalConditionConclusion: json['finalConditionConclusion'] ?? 'Ổn định theo quan sát',
      ownerComments: json['ownerComments'] ?? '',
      ownerSignature: json['ownerSignature'] != null ? SignatureModel.fromJson(json['ownerSignature']) : null,
      surveyorSignature: json['surveyorSignature'] != null ? SignatureModel.fromJson(json['surveyorSignature']) : null,
    );
  }
}

extension StructuralElementExt on StructuralElement {
  String get label {
    switch (this) {
      case StructuralElement.column: return 'Cột';
      case StructuralElement.beam: return 'Dầm';
      case StructuralElement.slab: return 'Sàn';
      case StructuralElement.wall: return 'Tường';
      case StructuralElement.ceiling: return 'Trần';
      case StructuralElement.staircase: return 'Cầu thang';
      case StructuralElement.foundation: return 'Móng';
      case StructuralElement.other: return 'Khác';
    }
  }
}
