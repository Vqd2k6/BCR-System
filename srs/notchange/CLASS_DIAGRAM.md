# Đặc Tả Sơ Đồ Lớp Hệ Thống (SRS - OOP Class Diagram & Domain Data Model)

> [!IMPORTANT]
> **TÀI LIỆU ĐẶC TẢ MÔ HÌNH DỮ LIỆU OOP & THỰC THỂ KHỚP 100% VỚI HỢP ĐỒNG API:**
> Toàn bộ mô hình lớp hướng đối tượng (OOP Class Diagram), kiến trúc thực thể quan hệ (ERD Entities), thuộc tính, phương thức nghiệp vụ và danh mục Enums đã được chuẩn hóa đồng bộ với `srs/API_SPECIFICATION.md` và `srs/notchange/Business_Logic.md`.

---

## 1. SƠ ĐỒ LỚP TỔNG THỂ (MERMAID CLASS DIAGRAM)

```mermaid
classDiagram
    %% ==========================================
    %% PACKAGE 1: USER HIERARCHY & ATTENDANCE
    %% ==========================================
    class User {
        <<abstract>>
        +UUID id
        +String username
        +String passwordHash
        +String fullName
        +String email
        +String phone
        +RoleEnum role
        +UserStatusEnum status
        +String statusReason
        +DateTime createdAt
        +DateTime lastLoginAt
        +login(username, password) Boolean
        +logout() Void
        +updateProfile(fullName, email, phone) Void
        +changePassword(oldPassword, newPassword) Boolean
    }

    class SuperAdmin {
        +String adminLevel
        +createUser(userData) User
        +updateUser(userId, userData) User
        +lockUser(userId, status, reason) Void
        +resetUserPassword(userId, newPassword) Void
        +deleteUser(userId) Void
        +manageGisLayers(geoJsonData) Void
        +viewExecutiveDashboard() DashboardSummary
        +viewAuditLogs(filter) List~AuditLog~
        +viewAllAttendance(filter) List~TimekeepingCheckIn~
        +exportMasterDossier(scope, format) CompiledReportBatch
        +viewAllExportBatches(filter) List~CompiledReportBatch~
        +cancelOrDeleteExportBatch(batchId) Void
    }

    class ZoneAdmin {
        +UUID assignedZoneId
        +String zoneCode
        +viewZoneDashboard(startDate, endDate) ZoneAnalytics
        +viewSurveyorAttendance(filter) List~TimekeepingCheckIn~
        +verifyAttendance(checkInId, action, notes) TimekeepingCheckIn
        +assignTask(parcelId, surveyorId, deadline) TaskAssignment
        +reassignTask(taskId, newSurveyorId) TaskAssignment
        +reviewReportSplitPane(reportId) AuditViewData
        +viewAuditAlerts(filter) List~AuditAlertItem~
        +approveMutation(mutationEventId) Boolean
        +rejectMutation(mutationEventId, reason) Boolean
        +approveReport(reportId) Boolean
        +rejectReport(reportId, reason) Boolean
        +applyEngineeringJudgement(reportId, deltaScore, reason) Void
        +exportZoneDossier(scope, criteria, format) CompiledReportBatch
    }

    class Surveyor {
        +String employeeCode
        +UUID assignedZoneId
        +Float currentLat
        +Float currentLng
        +checkInTimekeeping(zoneId, lat, lng, selfiePhoto, notes) TimekeepingCheckIn
        +viewMyAttendanceHistory(startDate, endDate) List~TimekeepingCheckIn~
        +claimAdHocParcel(parcelId, phase, reason) SurveyReport
        +recordAbsence(parcelId, reason, proofPhoto, notes, rescheduleDate) SurveyAbsenceLog
        +createSurveyReport(parcelId) SurveyReport
        +captureIdentificationPhotos(p01..p04, polygonJson, splitLinesJson) Void
        +interviewBuildingSpecs(specData, historyData) Void
        +createDamageZone(ctxPhoto, floor, room, burland) DamageZone
        +pinDefect(zoneId, x, y, cuPhoto, measurements, e2, e4) DefectItem
        +recordDeformation(tiltData, settlementData) DeformationAssessment
        +proposeCadastralMutation(originalParcelId, childPolygons, type, reason) ParcelMutationEvent
        +updateFootprintPolygon(parcelId, polygonGeoJson, measuredArea) Void
        +submitReportWithSignatures(ownerRemarks, signatures) Void
        +syncOfflineDraft() Boolean
    }

    class ContractorGuest {
        +String organizationName
        +String accessPasscode
        +String shareToken
        +Boolean isGuestLink
        +viewMetroGisMap() MapViewData
        +viewParcelSummary(parcelId) ParcelSummary
        +downloadReportPdf(reportId) FileStream
        +downloadPublishedDossier(batchId) FileStream
    }

    User <|-- SuperAdmin
    User <|-- ZoneAdmin
    User <|-- Surveyor
    User <|-- ContractorGuest

    class TimekeepingCheckIn {
        +UUID id
        +UUID surveyorId
        +UUID zoneId
        +DateTime checkInTime
        +Float gpsLatitude
        +Float gpsLongitude
        +Float distanceToZoneCenterMeters
        +Boolean isWithinZoneBoundary
        +String selfiePhotoUrl
        +String notes
        +VerificationStatusEnum verificationStatus
        +UUID verifiedById
        +DateTime verifiedAt
        +String verificationNotes
        +Boolean hasAnomalyFlag
        +String anomalyReason
        +verify(adminId, action, notes) Void
    }

    class AuditLog {
        +UUID id
        +String entityType
        +UUID entityId
        +String action
        +UUID performedByUserId
        +String clientIp
        +DateTime timestamp
        +String diffPayload
    }

    class AuditAlertItem {
        +UUID id
        +UUID reportId
        +UUID parcelId
        +AlertTypeEnum alertType
        +AlertSeverityEnum severity
        +String title
        +String detail
        +String flaggedValuesJson
        +Boolean isResolved
        +DateTime createdAt
    }

    %% ==========================================
    %% PACKAGE 2: PLANNING, GIS & DUAL-ID PARCEL
    %% ==========================================
    class MetroAlignment {
        +UUID id
        +String lineCode
        +String lineName
        +String centerlineGeoJson
        +Float zoiBufferMeters
        +String zoiPolygonGeoJson
        +DateTime updatedAt
        +isWithinZoi(lat, lng) Boolean
    }

    class PlanningZone {
        +UUID id
        +String zoneCode
        +String landUseNameRaw
        +LandUseCategoryEnum landUseCategory
        +Int maxBuildingHeightFloors
        +Float maxDensityPercent
        +Float maxFsi
        +Float roadSetbackMeters
        +Boolean isRoadSetbackAffected
        +Boolean is1500Project
        +String projectName1500
        +Float areaM2
        +String geomGeoJson
        +DateTime createdAt
    }

    class MetroZone {
        +UUID id
        +String zoneCode
        +String zoneName
        +String boundaryGeoJson
        +Float centerLat
        +Float centerLng
        +Int totalParcelsCount
        +Int completedParcelsCount
        +UUID assignedAdminId
        +calculateProgressPercentage() Float
    }

    class CadastralHistoryLog {
        +UUID id
        +UUID parcelId
        +String projectParcelCode
        +String actionType
        +String previousGeomGeoJson
        +String newGeomGeoJson
        +String previousStateJson
        +String newStateJson
        +UUID changedByUserId
        +String changeReason
        +DateTime createdAt
    }

    class Parcel {
        +UUID id
        +UUID zoneId
        +String officialCadastralCode
        +String projectParcelCode
        +String fieldSurveyCode
        +String houseNumber
        +String street
        +String ward
        +String district
        +String ownerName
        +String ownerPhone
        +Float landAreaM2
        +Float constructionAreaM2
        +Int floorCount
        +ImportanceGroupEnum importanceGroup
        +AdjacentStructureEnum adjacentType
        +Float gpsLatitude
        +Float gpsLongitude
        +Float chainageKm
        +Float distanceToMetroCenterlineM
        +Float distanceToClearanceBoundaryM
        +String polygonGeoJson
        +String footprintPolygonGeoJson
        +ParcelSurveyStatusEnum surveyStatus
        +ParcelLifecycleEnum lifecycleStatus
        +MutationTypeEnum mutationType
        +List~UUID~ parentParcelIds
        +List~UUID~ childParcelIds
        +UUID mutationEventId
        +UUID activePhase1ReportId
        +UUID activePhase2ReportId
        +Int absenceAttemptCount
        +updateStatus(newStatus) Void
        +updateFootprint(newFootprintGeoJson, measuredArea) Void
    }

    class SurveyAbsenceLog {
        +UUID id
        +UUID parcelId
        +UUID surveyorId
        +AbsenceReasonEnum absenceReason
        +String notes
        +String photoProofUrl
        +DateTime rescheduleDate
        +Int attemptCount
        +DateTime recordedAt
    }

    class ParcelMutationEvent {
        +UUID id
        +String mutationCode
        +MutationTypeEnum mutationType
        +List~UUID~ sourceParcelIds
        +List~UUID~ resultParcelIds
        +String originalGeoJson
        +String newGeoJson
        +String surveyorNotes
        +UUID surveyorId
        +UUID zoneAdminId
        +MutationStatusEnum status
        +DateTime createdAt
        +DateTime approvedAt
        +approve(adminId) Void
        +reject(adminId, reason) Void
    }

    class TaskAssignment {
        +UUID id
        +UUID parcelId
        +UUID surveyorId
        +UUID assignedByAdminId
        +DateTime assignedAt
        +DateTime deadline
        +TaskStatusEnum status
        +String notes
        +reassign(newSurveyorId, reason) Void
        +markInProgress() Void
        +markSubmitted() Void
        +markCompleted() Void
    }

    class GuestShareLink {
        +UUID id
        +UUID zoneId
        +UUID parcelId
        +String shareToken
        +String passcodeHash
        +Boolean isPublic
        +DateTime expiresAt
        +Int accessCount
        +verifyPasscode(inputCode) Boolean
    }

    %% ==========================================
    %% PACKAGE 3: SURVEY REPORT HIERARCHY
    %% ==========================================
    class BaseSurveyReport {
        <<abstract>>
        +UUID id
        +UUID parcelId
        +UUID surveyorId
        +UUID zoneAdminId
        +String reportCode
        +DateTime surveyDate
        +ReportStatusEnum status
        +Int currentStep
        +Boolean isDataQualityPassed
        +String summaryConclusions
        +String engineeringRecommendations
        +String surveyorSignatureUrl
        +String ownerSignatureUrl
        +String ownerRemarks
        +Boolean isRefusedOrAbsent
        +String refusalDocRef
        +DateTime submittedAt
        +DateTime approvedAt
        +DateTime createdAt
        +DateTime updatedAt
        +submitForReview() Void
        +approve(adminId, judgementNotes) Void
        +reject(adminId, reason) Void
        +validateCompleteness() Boolean
    }

    class Phase1SurveyReport {
        +Boolean isHistoricalBaseline
        +calculateAutoEcsAndVi() Void
        +applyEngineeringJudgement(gradeDelta, reason) Void
        +generatePhase1ReportPdf() FileStream
    }

    class Phase2SurveyReport {
        +UUID phase1ReportId
        +String workSection
        +SurveyLevelEnum surveyLevel
        +String witnessMembers
        +String specialConditions
        +Boolean hasStructuralAlterationSincePhase1
        +Boolean hasAddedFloors
        +Boolean hasChangedLoadOrUsage
        +String usageChangeDetails
        +String dataLimitations
        +String notableDamageSummary
        +Boolean isCriticalAlert
        +List~MonitoringNeedEnum~ monitoringNeeds
        +Boolean ndtTestingNeeded
        +String ndtTestingType
        +Phase2ConclusionEnum phase2Conclusion
        +String compensationVerdict
        +Int deltaEcs
        +String contractorRepSignatureUrl
        +String thirdPartyRepSignatureUrl
        +String witnessSignatureUrl
        +loadPhase1Baseline(phase1Id) Void
        +compareDefectsWithPhase1() DefectComparisonSummary
        +generatePhase2ReportPdf() FileStream
    }

    BaseSurveyReport <|-- Phase1SurveyReport
    BaseSurveyReport <|-- Phase2SurveyReport

    class SurveyIdentificationPhoto {
        +UUID id
        +UUID reportId
        +PhotoIdentTypeEnum photoType
        +Boolean isNotApplicable
        +String naReason
        +String rawPhotoUrl
        +String annotatedPhotoUrl
        +String aiEnhancedPhotoUrl
        +String facadePolygonPointsJson
        +String floorSplitLinesJson
        +String dimensionsJson
        +Int floorCountEstimated
        +Float facadeWidthM
        +Float totalHeightM
        +AIProcessingStatusEnum aiProcessingStatus
        +String aiJobId
        +Float watermarkLat
        +Float watermarkLng
        +DateTime watermarkTimestamp
        +verifyWatermarkIntegrity() Boolean
        +processAIEnhancement() Boolean
    }

    %% ==========================================
    %% PACKAGE 4: BUILDING STRUCTURE & SENSITIVITY
    %% ==========================================
    class BuildingSpecification {
        +UUID id
        +UUID reportId
        +String buildingName
        +BuildingGradeEnum buildingGrade
        +String adjacentBuildings
        +StructuralSystemEnum structuralSystem
        +Int floorCount
        +Int basementCount
        +FoundationCategoryEnum foundationCategory
        +String roofType
        +String wallType
        +Int yearOfConstruction
        +Boolean isYearEstimated
    }

    class HistoricalSensitivity {
        +UUID id
        +UUID reportId
        +Boolean extendedOrRenovated
        +Boolean previousSettlementOrTilt
        +Boolean fireOrAccident
        +Boolean sensitiveEquipmentPresent
        +String details
        +Int e5HistoryScore
        +calculateE5Score() Int
    }

    %% ==========================================
    %% PACKAGE 5: DAMAGE ZONES & DEFECT PINNING
    %% ==========================================
    class FloorSurvey {
        +UUID id
        +UUID reportId
        +String floorName
        +Int floorOrder
        +List~String~ overviewPhotos
        +String cadDrawingUrl
        +List~CadZonePin~ cadZonePins
        +String notes
        +DateTime createdAt
    }

    class CadZonePin {
        +String id
        +String zoneId
        +String zoneCode
        +String label
        +Float x
        +Float y
    }

    class DamageSketch {
        +UUID id
        +UUID reportId
        +String sketchPhotoUrl
        +String cadDrawingRef
        +String notes
        +DateTime uploadedAt
    }

    class DamageZone {
        +UUID id
        +UUID reportId
        +UUID phase1DamageZoneId
        +Boolean isInheritedFromPhase1
        +Boolean isNewInPhase2
        +String zoneCode
        +String floorName
        +String roomName
        +ComponentTypeEnum componentType
        +String wallMaterial
        +Boolean functionalImpactRepairNeeded
        +Int burlandGrade
        +String ctxPhotoUrl
        +String notes
        +String slabCondition
        +String wallCondition
        +String beamColumnCondition
        +String seepageSpallingCondition
        +String deformationCondition
        +getDefectCount() Int
        +addNewDefect(defectData) DefectItem
    }

    class DefectItem {
        +UUID id
        +UUID zoneId
        +UUID phase1DefectItemId
        +Boolean isNewInPhase2
        +String defectCode
        +Float pinX
        +Float pinY
        +String cuPhotoUrl
        +String screeningCategory
        +String defectType
        +String crackDirection
        +Float widthMaxMm
        +Float lengthMm
        +ActivityStateEnum activityState
        +Int materialDegradationE4
        +Int structuralSignificanceE2
        +Boolean hasScaleCard
        +Boolean isStructuralCritical
        +Float phase1WidthMm
        +Float phase2WidthMm
        +Float deltaWidthMm
        +Float phase1LengthMm
        +Float phase2LengthMm
        +Float deltaLengthMm
        +CrackEvolutionEnum evolutionStatus
        +String pinColor
        +calculateSeverityColor() String
        +evaluateEvolutionDelta(phase1Defect) Void
    }

    %% ==========================================
    %% PACKAGE 6: DEFORMATION ASSESSMENT
    %% ==========================================
    class DeformationAssessment {
        +UUID id
        +UUID reportId
        +Float tiltAngleX
        +Float tiltAngleY
        +String tiltDirection
        +Float floorSlopeRatio
        +Float beamDeflectionMm
        +String measurementMethod
        +ReliabilityEnum measurementReliability
        +Float phase2TiltX
        +Float phase2TiltY
        +Float deltaTiltX
        +Float deltaTiltY
        +Float deltaBeamDeflectionMm
        +String tiltEvolutionVerdict
        +Int e3DeformationScore
        +calculateE3Score() Int
    }

    %% ==========================================
    %% PACKAGE 7: RISK SCORING ENGINE (ECS & VI)
    %% ==========================================
    class RiskScoreCard {
        +UUID id
        +UUID reportId
        +Int e1BurlandScore
        +Int e2StructureScore
        +Int e3DeformationScore
        +Int e4MaterialScore
        +Int e5HistoryScore
        +Int e6OverallFunctionScore
        +Int totalEcsScore
        +ECSClassEnum ecsClass
        +Float v1ImportanceScore
        +Float v2StructureScore
        +Float v3FoundationScore
        +Float v4AgeScore
        +Float v5EcsScore
        +Float v6SensitivityScore
        +Float avgViScore
        +VIClassEnum viClass
        +Int constructionImpactLevelI
        +String buildingRiskAssessmentBRA
        +Boolean isEngineeringJudgementApplied
        +String engineeringJudgementAction
        +String engineeringJudgementReason
        +calculateAutoEcsAndVi() Void
    }

    %% ==========================================
    %% PACKAGE 8: SURVEY SCOPE
    %% ==========================================
    class SurveyScope {
        +UUID id
        +UUID reportId
        +SurveyCoverageEnum surveyCoverage
        +String inaccessibleAreas
        +String accessibilityLimitations
    }

    %% ==========================================
    %% PACKAGE 9: BATCH REPORT EXPORT HUB
    %% ==========================================
    class CompiledReportBatch {
        +UUID id
        +String batchCode
        +UUID zoneId
        +ExportScopeEnum exportScope
        +List~UUID~ selectedReportIds
        +String filterCriteriaJson
        +String periodLabel
        +Int totalReportsCompiled
        +UUID exportedByUserId
        +ExportFormatEnum exportFormat
        +Boolean includeGisOverviewMap
        +Boolean includeEcsSummaryTable
        +ExportStatusEnum status
        +String downloadUrl
        +Long fileSizeBytes
        +String checksumSha256
        +DateTime createdAt
        +DateTime expiresAt
        +generateBatchPdf() FileStream
        +revokeAndPurge() Void
    }

    %% ==========================================
    %% RELATIONSHIPS & ASSOCIATIONS
    %% ==========================================
    Surveyor "1" --> "0..*" TimekeepingCheckIn : logs
    ZoneAdmin "1" --> "0..*" TimekeepingCheckIn : verifies
    MetroZone "1" --> "0..*" Parcel : contains
    MetroZone "1" --> "0..*" GuestShareLink : generates_links
    MetroZone "1" --> "0..*" CompiledReportBatch : compiles_into_batches
    
    Parcel "1" --> "0..*" TaskAssignment : assigned_via
    Parcel "1" --> "0..*" SurveyAbsenceLog : logs_absence
    ZoneAdmin "1" --> "0..*" TaskAssignment : dispatches
    Surveyor "1" --> "0..*" TaskAssignment : receives

    Parcel "1" --> "0..*" BaseSurveyReport : documented_by
    Surveyor "1" --> "0..*" BaseSurveyReport : conducts
    ZoneAdmin "1" --> "0..*" BaseSurveyReport : reviews
    Phase2SurveyReport "0..*" --> "1" Phase1SurveyReport : references_baseline_phase1
    BaseSurveyReport "1" --> "0..*" AuditAlertItem : flags_anomalies
    
    Parcel "1..*" --> "0..1" ParcelMutationEvent : sources
    ParcelMutationEvent "1" --> "1..*" Parcel : results_in
    Surveyor "1" --> "0..*" ParcelMutationEvent : proposes
    ZoneAdmin "1" --> "0..*" ParcelMutationEvent : approves

    BaseSurveyReport "1" *-- "2..4" SurveyIdentificationPhoto : contains_P01_to_P04
    BaseSurveyReport "1" *-- "1" BuildingSpecification : specifies
    BaseSurveyReport "1" *-- "1" HistoricalSensitivity : records_history
    BaseSurveyReport "1" *-- "0..*" FloorSurvey : contains_floors
    FloorSurvey "1" *-- "0..*" DamageZone : groups_zones_Zxx
    BaseSurveyReport "1" *-- "0..*" DamageSketch : includes_sketches
    BaseSurveyReport "1" *-- "1..*" DamageZone : contains_zones_Zxx
    DamageZone "1" *-- "0..*" DefectItem : has_defects_Dxx
    BaseSurveyReport "1" *-- "1" DeformationAssessment : records_deformation
    BaseSurveyReport "1" *-- "1" SurveyScope : defines_scope
    Phase1SurveyReport "1" *-- "1" RiskScoreCard : scores_ECS_VI
```

---

## 2. DANH MỤC ENUMS CHUẨN HÓA (STANDARDIZED ENUMERATIONS)

```markdown
- RoleEnum: SUPER_ADMIN, ZONE_ADMIN, SURVEYOR, CONTRACTOR
- UserStatusEnum: ACTIVE, SUSPENDED, LOCKED
- VerificationStatusEnum: PENDING_VERIFICATION, APPROVED, FLAGGED_WARNING, REJECTED
- AlertTypeEnum: GPS_DISTANCE_DISCREPANCY, ABNORMAL_DURATION, STRUCTURAL_CRITICAL, MISSING_SCALE_CARD, REPEATED_ABSENCE
- AlertSeverityEnum: LOW, MEDIUM, HIGH, CRITICAL
- AbsenceReasonEnum: HOMEOWNER_ABSENT, LOCKED_GATE, REFUSED_ACCESS
- ExportScopeEnum: SELECTED_LIST, FILTER_CRITERIA, GLOBAL_ALL_ZONES
- ExportFormatEnum: PDF_BOOK_COMPILATION, ZIP_INDIVIDUAL_PDFS, EXCEL_SUMMARY
- ExportStatusEnum: QUEUED, PROCESSING, COMPLETED, FAILED, REVOKED
- ParcelSurveyStatusEnum: NOT_SURVEYED, ASSIGNED_TO_ME, IN_PROGRESS, POSTPONED_ABSENT, SUBMITTED, APPROVED, REJECTED
- ParcelLifecycleEnum: ACTIVE, PENDING_MUTATION_APPROVAL, SPLIT_DEPRECATED, MERGED_DEPRECATED, MUTATION_VOID
- MutationTypeEnum: ORIGINAL, SPLIT, MERGE, REDRAW
- MutationStatusEnum: PROPOSED_BY_SURVEYOR, APPROVED, REJECTED
- AIProcessingStatusEnum: PENDING, PROCESSING, COMPLETED, FAILED
- ReportStatusEnum: DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED
- CrackEvolutionEnum: STABLE, WIDENED, LENGTHENED, NEW_RECORDED, REPAIRED
- CompensationVerdictEnum: NO_IMPACT, NEGLIGIBLE_COSMETIC, STRUCTURAL_IMPACT
- BuildingGradeEnum: GENERAL, IMPORTANT, CRITICAL
- ImportanceGroupEnum: GENERAL, IMPORTANT, CRITICAL
- AdjacentStructureEnum: TOWNHOUSE, HIGH_RISE, PUBLIC, EMPTY_LAND, OTHER
- PhotoIdentTypeEnum: P01_HOUSE_NUMBER, P02_MAIN_FACADE, P03_SIDE_OR_REAR, P04_CONTEXT_STREET
- StructuralSystemEnum: KHUNG_BTCT_CHIU_LUC, TUONG_GACH_CHIU_LUC, KET_CAU_THEP, NHA_GO, KET_CAU_HON_HOP
- FoundationCategoryEnum: CAT_1_MONG_NONG_GIA_CO, CAT_2_MONG_DON_BTCT, CAT_3_MONG_BANG_BTCT, CAT_4_MONG_COC_BTCT, CAT_5_KHONG_XAC_DINH
- ActivityStateEnum: U (Chưa rõ), S (Ổn định), A (Đang phát triển)
- ECSClassEnum: GOOD_0_5, MEDIUM_6_10, DEFICIENT_11_16, CRITICAL_17_24
- VIClassEnum: LOW, MEDIUM, HIGH, VERY_HIGH
- SurveyCoverageEnum: TOAN_BO, MOT_PHAN, KHONG_THE_TIEP_CAN
- ReliabilityEnum: HIGH, MEDIUM, LOW
```
