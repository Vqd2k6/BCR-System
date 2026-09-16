# Đặc Tả Sơ Đồ Lớp Hệ Thống (SRS - OOP Class Diagram & Domain Data Model)

> Tài liệu đặc tả chuẩn hóa Toàn bộ Mô hình Lớp Hướng Đối Tượng (OOP Class Diagram), Kiến trúc Mã Kép (Dual-ID), Cơ chế Biến động Thửa đất (Cadastral Lineage), và Phân hệ Xuất Báo cáo Hàng loạt cho Hệ thống Khảo sát Quy hoạch Hiện trạng Tuyến Metro 2.

---

## 1. SƠ ĐỒ LỚP TỔNG THỂ (MERMAID CLASS DIAGRAM)

```mermaid
classDiagram
    %% ==========================================
    %% PACKAGE 1: USER HIERARCHY (OOP INHERITANCE)
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
        +lockUser(userId) Void
        +manageGisLayers(geoJsonData) Void
        +viewExecutiveDashboard() DashboardSummary
        +viewAuditLogs(filter) List~AuditLog~
        +exportMasterDossier(scope, format) CompiledReportBatch
    }

    class ZoneAdmin {
        +UUID assignedZoneId
        +String zoneCode
        +viewZoneDashboard(startDate, endDate) ZoneAnalytics
        +viewSurveyorAttendance(timeRange) List~TimekeepingCheckIn~
        +assignTask(parcelId, surveyorId, deadline) TaskAssignment
        +reviewReportSplitPane(reportId) AuditViewData
        +approveMutation(mutationEventId) Boolean
        +rejectMutation(mutationEventId, reason) Boolean
        +approveReport(reportId) Boolean
        +rejectReport(reportId, reason) Boolean
        +applyEngineeringJudgement(reportId, deltaScore, reason) Void
        +exportZoneDossier(zoneId, timeRange, format) CompiledReportBatch
    }

    class Surveyor {
        +String employeeCode
        +Float currentLat
        +Float currentLng
        +checkInTimekeeping(selfiePhoto, accompanyingList) TimekeepingCheckIn
        +createSurveyReport(parcelId) SurveyReport
        +captureIdentificationPhotos(p01, p02, p03, p04) Void
        +interviewBuildingSpecs(specData, historyData) Void
        +createDamageZone(ctxPhoto, floor, room) DamageZone
        +pinDefect(zoneId, x, y, cuPhoto, measurements) DefectItem
        +recordDeformation(tiltData, settlementData) DeformationAssessment
        +proposeCadastralMutation(originalParcelId, newPolygons, type, reason) ParcelMutationEvent
        +captureVerificationPhotos(surveyorPhoto, inspectorPhoto, ownerPhoto) Void
        +syncOfflineDraft() Boolean
    }

    class ContractorGuest {
        +String organizationName
        +String accessPasscode
        +Boolean isGuestLink
        +viewMetroGisMap() MapViewData
        +viewParcelDetails(parcelId) ParcelOverview
        +viewApprovedReport(reportId) SurveyReport
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
        +Float gpsAccuracy
        +String selfiePhotoUrl
        +List~String~ accompanyingMembers
        +String notes
        +validateGpsAccuracy() Boolean
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

    %% ==========================================
    %% PACKAGE 2: PLANNING, GIS & DUAL-ID PARCEL
    %% ==========================================
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

    class Parcel {
        +UUID id
        +UUID zoneId
        +String officialCadastralCode
        +String projectParcelCode
        +String houseNumber
        +String street
        +String ward
        +String district
        +String ownerName
        +String ownerPhone
        +ImportanceGroupEnum importanceGroup
        +AdjacentStructureEnum adjacentType
        +Float gpsLatitude
        +Float gpsLongitude
        +Float chainageKm
        +Float distanceToMetroCenterlineM
        +Float distanceToClearanceBoundaryM
        +String polygonGeoJson
        +ParcelSurveyStatusEnum surveyStatus
        +ParcelLifecycleEnum lifecycleStatus
        +MutationTypeEnum mutationType
        +List~UUID~ parentParcelIds
        +List~UUID~ childParcelIds
        +UUID mutationEventId
        +UUID currentReportId
        +updateStatus(newStatus) Void
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
    %% PACKAGE 3: SURVEY REPORT HIERARCHY (OOP INHERITANCE)
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
        +String recommendations
        +DateTime createdAt
        +DateTime updatedAt
        +submitForReview() Void
        +approve(adminId) Void
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
        +Boolean hasExtensionAfterPhase1
        +String extensionDetail
        +Boolean hasRepairAfterPhase1
        +String repairDetail
        +Boolean hasUsageChangeAfterPhase1
        +String usageChangeDetail
        +String otherChanges
        +Phase1ChangeConclusionEnum phase1ConfirmationConclusion
        +DefectEvolutionSummaryEnum defectEvolutionSummary
        +Int totalDefectsCount
        +Int totalPhotosCount
        +Int totalSketchesCount
        +String inaccessibleAreas
        +String dataLimitations
        +String mostNotableDamage
        +Boolean hasCriticalSigns
        +List~MonitoringNeedEnum~ monitoringNeeds
        +Boolean additionalNdtRequired
        +String ndtDetails
        +Phase2ConclusionEnum phase2ConditionConclusion
        +String checklistItemsJson
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
        +String annotationsJson
        +Int floorCountEstimated
        +String floorHeightsJson
        +Float facadeWidthM
        +Float totalHeightM
        +AIProcessingStatusEnum aiProcessingStatus
        +String aiPerspectiveMatrixJson
        +Float watermarkLat
        +Float watermarkLng
        +DateTime watermarkTimestamp
        +String metadataJson
        +verifyWatermarkIntegrity() Boolean
        +processAIEnhancement() Boolean
        +renderCompositeImage() FileStream
    }

    %% ==========================================
    %% PACKAGE 4: BUILDING STRUCTURE & SENSITIVITY
    %% ==========================================
    class BuildingSpecification {
        +UUID id
        +UUID reportId
        +UsageTypeEnum usageType
        +Int floorsAboveGround
        +Int basementCount
        +Int yearBuilt
        +Boolean isYearEstimated
        +StructuralSystemEnum structuralSystem
        +StructuralFormEnum structuralForm
        +FoundationTypeEnum foundationType
        +Int foundationCatScore
        +List~FoundationSourceEnum~ foundationSources
        +UsageStatusEnum currentUsageStatus
        +Boolean isContinuous247
    }

    class HistoricalSensitivity {
        +UUID id
        +UUID reportId
        +Int loadAlterationScore
        +Int majorRenovationScore
        +Int pastSettlementScore
        +Int adjacentImpactScore
        +Int pastSevereIncidentScore
        +Boolean hasSensitiveEquipment
        +String sensitiveEquipmentDesc
        +calculateE5Score() Int
    }

    %% ==========================================
    %% PACKAGE 5: DAMAGE ZONES, DEFECT PINNING & SKETCH (DYNAMIC ARRAYS)
    %% ==========================================
    class DamageSketch {
        +UUID id
        +UUID reportId
        +String sketchPhotoUrl
        +SketchTypeEnum sketchType
        +String orientation
        +Boolean hasDamageMap
    }

    class DamageZone {
        +UUID id
        +UUID reportId
        +UUID phase1DamageZoneId
        +String zoneCode
        +Int floorIndex
        +String floorName
        +String roomName
        +String wallMaterial
        +String ctxPhotoUrl
        +Boolean requiresRepair
        +Int burlandGrade
        +getDefectCount() Int
        +addNewDefect(defectData) DefectItem
    }

    class DefectItem {
        +UUID id
        +UUID zoneId
        +UUID phase1DefectItemId
        +Boolean isNewInPhase2
        +String defectCode
        +Float pinXRatio
        +Float pinYRatio
        +String cuPhotoUrl
        +String screeningIndicator
        +String componentType
        +String crackPattern
        +Float crackWidthMaxMm
        +Float crackLengthMm
        +String crackDirection
        +ActivityStateEnum activityState
        +Int materialDegradationScore
        +Int structuralSignificanceScore
        +Boolean isStructuralCritical
        +Float deltaCrackWidthMm
        +Float deltaCrackLengthMm
        +CrackEvolutionEnum crackEvolutionStatus
        +calculateSeverityColor() String
        +evaluateEvolutionDelta(phase1Defect) Void
    }

    %% ==========================================
    %% PACKAGE 6: DEFORMATION & SETTLEMENT
    %% ==========================================
    class DeformationAssessment {
        +UUID id
        +UUID reportId
        +Int diffSettlementStatus
        +String diffSettlementLocation
        +Int tiltStatus
        +Float tiltXPercent
        +Float tiltYPercent
        +Int floorTiltStatus
        +Float floorTiltPercent
        +Int deflectionStatus
        +String deflectionLocation
        +List~DataSourceEnum~ dataSources
        +ReliabilityEnum dataReliability
        +Boolean requiresExtraMonitoring
        +String notes
        +calculateE3Score() Int
    }

    %% ==========================================
    %% PACKAGE 7: RISK SCORING ENGINE (ECS, VI, BURLAND)
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
        +Float v1FunctionScore
        +Float v2StructureScore
        +Float v3FoundationScore
        +Float v4AgeScore
        +Float v5EcsScore
        +Float v6EquipmentScore
        +Float totalViScore
        +Float avgViScore
        +VIClassEnum viClass
        +Int burlandDominantGrade
        +Int burlandPeakGrade
        +SeverityFlagEnum structuralFlag
        +String constructionImpact
        +String braRiskLevel
        +Boolean isEngineeringJudgementApplied
        +String engineeringJudgementAction
        +String engineeringJudgementReason
        +calculateAutoEcsAndVi() Void
    }

    %% ==========================================
    %% PACKAGE 8: SCOPE & VERIFICATION PHOTOS
    %% ==========================================
    class SurveyScope {
        +UUID id
        +UUID reportId
        +List~AreaTypeEnum~ surveyedAreas
        +Boolean hasAccessLimitation
        +String limitationReason
        +Boolean hasCadastralMutation
    }

    class SurveyVerification {
        +UUID id
        +UUID reportId
        +String surveyorFullName
        +String surveyorPosition
        +String surveyorSignPhotoUrl
        +String inspectorFullName
        +String inspectorPosition
        +String inspectorSignPhotoUrl
        +String ownerFullName
        +String ownerFeedbackText
        +String ownerSignOrPresencePhotoUrl
        +DateTime verificationDate
    }

    %% ==========================================
    %% PACKAGE 9: BATCH REPORT EXPORT & COMPILED DOSSIER
    %% ==========================================
    class CompiledReportBatch {
        +UUID id
        +String batchCode
        +UUID zoneId
        +DateTime timeRangeStart
        +DateTime timeRangeEnd
        +Int totalParcelsIncluded
        +List~String~ parcelCodesList
        +UUID exportedByUserId
        +ExportFormatEnum exportFormat
        +String fileDownloadUrl
        +Long fileSizeBytes
        +String checksumSha256
        +Boolean isPublishedToGuests
        +DateTime createdAt
        +generateBatchPdf() FileStream
        +publishToGuests() Void
    }

    %% ==========================================
    %% RELATIONSHIPS & ASSOCIATIONS
    %% ==========================================
    Surveyor "1" --> "0..*" TimekeepingCheckIn : logs
    MetroZone "1" --> "0..*" Parcel : contains
    MetroZone "1" --> "0..*" GuestShareLink : generates_links
    MetroZone "1" --> "0..*" CompiledReportBatch : compiles_into_batches
    
    Parcel "1" --> "0..*" TaskAssignment : assigned_via
    ZoneAdmin "1" --> "0..*" TaskAssignment : dispatches
    Surveyor "1" --> "0..*" TaskAssignment : receives

    Parcel "1" --> "0..*" BaseSurveyReport : documented_by
    Surveyor "1" --> "0..*" BaseSurveyReport : conducts
    ZoneAdmin "1" --> "0..*" BaseSurveyReport : reviews
    Phase2SurveyReport "0..*" --> "1" Phase1SurveyReport : references_baseline_phase1
    
    Parcel "1..*" --> "0..1" ParcelMutationEvent : sources
    ParcelMutationEvent "1" --> "1..*" Parcel : results_in
    Surveyor "1" --> "0..*" ParcelMutationEvent : proposes
    ZoneAdmin "1" --> "0..*" ParcelMutationEvent : approves

    BaseSurveyReport "1" *-- "2..4" SurveyIdentificationPhoto : contains_P01_to_P04
    BaseSurveyReport "1" *-- "1" BuildingSpecification : specifies
    BaseSurveyReport "1" *-- "1" HistoricalSensitivity : records_history
    BaseSurveyReport "1" *-- "0..*" DamageSketch : includes_sketches
    BaseSurveyReport "1" *-- "1..*" DamageZone : contains_zones_Zxx
    DamageZone "1" *-- "0..*" DefectItem : has_defects_Dxx
    BaseSurveyReport "1" *-- "1" DeformationAssessment : records_deformation
    BaseSurveyReport "1" *-- "1" SurveyScope : defines_scope
    Phase1SurveyReport "1" *-- "1" RiskScoreCard : scores_ECS_VI
    BaseSurveyReport "1" *-- "1" SurveyVerification : verified_by_photos
```

---

## 2. CHI TIẾT CÁC PHÂN HỆ VÀ THỰC THỂ (DOMAIN ENTITY SPECIFICATIONS)

### 2.1. Phân Hệ Người Dùng & Chấm Công (User & Attendance Hierarchy)
- **`User` (Abstract Base Class):** Lớp cha trừu tượng quản lý định danh tài khoản dùng chung (`id`, `username`, `passwordHash`, `fullName`, `email`, `phone`, `role`, `status`).
- **`SuperAdmin` (extends `User`):** Quản trị toàn hệ thống, tạo và khóa tài khoản, tải lên lớp GIS tim tuyến Metro 2, xem Executive Master Dashboard toàn tuyến, xem Audit Log, và xuất **Bộ Hồ sơ Báo cáo Toàn tuyến** (`exportMasterDossier`).
- **`ZoneAdmin` (extends `User`):** Quản lý phân khu (`assignedZoneId`), xem Dashboard thống kê tiến độ/chấm công, phân công Task cho Surveyor, thẩm định Split-Pane đối soát, duyệt đề xuất biến động ranh (`approveMutation`/`rejectMutation`), phê duyệt/trả về báo cáo, thực hiện quyền Kỹ sư (`applyEngineeringJudgement`), và xuất **Bộ Hồ sơ Báo cáo Phân khu** (`exportZoneDossier`).
- **`Surveyor` (extends `User`):** Check-in chấm công GPS hiện trường kèm ảnh selfie và danh sách người đi cùng (`checkInTimekeeping`), tạo và thực hiện luồng khảo sát 9 bước, chụp ảnh bối cảnh $CTX$, thả ghim $D-xx$, chụp ảnh cận cảnh $CU$ có thước, đo lún nghiêng, vẽ lại ranh thửa đất biến động tại Bước 5 (`proposeCadastralMutation`), chụp ảnh xác nhận và đồng bộ nháp offline (`syncOfflineDraft`).
- **`ContractorGuest` (extends `User`):** Khách vãng lai/đơn vị quan sát truy cập qua public/private link, xem bản đồ GIS phân lô quy hoạch Metro 2, tra cứu thông tin lô đất, đọc trực tuyến và tải về Báo cáo đã duyệt hoặc các Bộ Báo cáo đã công bố (`downloadPublishedDossier`).

---

### 2.2. Phân Hệ GIS, Quy Hoạch & Kiến Trúc Mã Kép (Dual-ID Parcel & Cadastral Lineage)
- **`MetroZone`:** Quản lý 11 phân khu/nhà ga Metro 2 (Ga S1 $\to$ Ga S11), polygon ranh giới, tiến độ hoàn thành.
- **`Parcel`:** Thửa đất/công trình được quản lý với **Kiến trúc Mã Kép**:
  - `officialCadastralCode`: Mã địa chính nhà nước thu thập từ dữ liệu cào ban đầu (`data/KS003`) hoặc Số tờ - Số thửa Bộ TN&MT.
  - `projectParcelCode`: Mã quản lý dự án Metro 2 (**`B-XXXXX`**) được sắp xếp tuần tự theo lý trình tim tuyến.
  - Quản lý phả hệ biến động: `lifecycleStatus` (`ACTIVE`, `PENDING_MUTATION_APPROVAL`, `SPLIT_DEPRECATED`, `MERGED_DEPRECATED`, `MUTATION_VOID`), `parentParcelIds`, `childParcelIds`.
- **`ParcelMutationEvent`:** Lưu vết toàn bộ sự kiện biến động ranh đất (Tách/Gộp/Vẽ lại) gồm snapshot đa giác cũ, đa giác mới, ghi chú hiện trường, và trạng thái phê duyệt của Zone Admin.
- **`TaskAssignment`:** Phân công lô đất cho Surveyor kèm thời hạn hoàn thành và trạng thái.

---

### 2.3. Phân Hệ Báo Cáo Khảo Sát (Report Hierarchy: Phase 1 & Phase 2)
- **`BaseSurveyReport` (Abstract Root Aggregate):** Lớp trừu tượng định nghĩa các thuộc tính và phương thức quản lý vòng đời báo cáo dùng chung (`submitForReview`, `approve`, `reject`, `validateCompleteness`).
- **`Phase1SurveyReport` (extends `BaseSurveyReport`):** Báo cáo Hiện trạng Giai đoạn 1 (Baseline gốc trước thi công) chứa bộ máy tính điểm tự động $ECS/24$, chỉ số rủi ro $VI$ và ma trận $BRA$.
- **`Phase2SurveyReport` (extends `BaseSurveyReport`):** Báo cáo Hiện trạng Giai đoạn 2 (Pre-Construction / Delta Verification) chứa tham chiếu Giai đoạn 1 (`phase1ReportId`), cấp khảo sát (`surveyLevel`: L2-A, L2-B, L2-C), xác nhận các biến động sau GĐ1 (cơi nới, sửa chữa, đổi tải trọng), sổ khuyết tật đối soát biến động $\Delta w, \Delta L$, nhu cầu quan trắc bổ sung (lún, nghiêng, nứt, rung), và Checklist 10 mục hoàn thành hồ sơ (Phụ lục A).
- **`SurveyIdentificationPhoto`:** Lưu ảnh định danh kèm tọa độ chấm tròn đa giác đứng `facadePolygonPointsJson`, đường line cắt tầng `floorSplitLinesJson`, các lớp ảnh `rawPhotoUrl` $\to$ `aiEnhancedPhotoUrl`, và cờ xử lý `isNotApplicable`.
- **`DamageZone` & `DefectItem`:** Cấu trúc cây $1 \to N$ phát sinh động tầng/khu vực ($Z-01, Z-02...$) và khuyết tật ($D-01, D-02...$), cho phép liên kết đối soát giữa Phase 1 và Phase 2.

---

### 2.4. Phân Hệ Xuất Báo Cáo Hàng Loạt (Batch Report Compilation)
- **`CompiledReportBatch`:** Đóng gói toàn bộ báo cáo đã duyệt của một Phân khu/Nhà ga hoặc Toàn tuyến trong một khoảng thời gian (ngày, tuần, tháng) thành tập tài liệu hoàn chỉnh (PDF Book / ZIP Archive) kèm Sơ đồ GIS tổng hợp và Bảng kê danh mục thửa đất.

---

## 3. DANH MỤC ENUMS CHUẨN HÓA (ENUMERATIONS)

```markdown
- RoleEnum: SUPER_ADMIN, ZONE_ADMIN, SURVEYOR, CONTRACTOR
- UserStatusEnum: ACTIVE, INACTIVE, LOCKED
- SurveyPhaseEnum: PHASE_1_PRE_CONSTRUCTION, PHASE_2_POST_CONSTRUCTION
- SurveyLevelEnum: L2_A, L2_B, L2_C
- Phase1ChangeConclusionEnum: NO_SIGNIFICANT_CHANGE, HAS_CHANGES
- DefectEvolutionSummaryEnum: UNCHANGED, EVOLVED, REPAIRED, NEW_RECORDED
- MonitoringNeedEnum: LUN, NGHIENG, NUT, RUNG
- Phase2ConclusionEnum: STABLE_OBSERVED, EXISTING_DAMAGE_MONITOR, IN_DEPTH_EVALUATION_REQUIRED
- ParcelSurveyStatusEnum: NOT_SURVEYED, IN_PROGRESS, PENDING_REVIEW, APPROVED, REJECTED
- ParcelLifecycleEnum: ACTIVE, PENDING_MUTATION_APPROVAL, SPLIT_DEPRECATED, MERGED_DEPRECATED, MUTATION_VOID
- MutationTypeEnum: ORIGINAL, SPLIT, MERGE, REDRAW
- MutationStatusEnum: PROPOSED_BY_SURVEYOR, APPROVED, REJECTED
- AIProcessingStatusEnum: PENDING, PROCESSING, COMPLETED, FAILED
- ExportFormatEnum: PDF_BOOK_COMPILATION, ZIP_ARCHIVE, EXCEL_GEOJSON
- ReportStatusEnum: DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED
- CrackEvolutionEnum: STABLE, WIDENED, LENGTHENED, NEW_OCCURRENCE, REPAIRED
- CompensationVerdictEnum: NO_IMPACT, NEGLIGIBLE_COSMETIC, STRUCTURAL_IMPACT
- ImportanceGroupEnum: GENERAL, IMPORTANT, CRITICAL
- AdjacentStructureEnum: TOWNHOUSE, HIGH_RISE, PUBLIC, EMPTY_LAND, OTHER
- PhotoIdentTypeEnum: P01_HOUSE_NUMBER, P02_MAIN_FACADE, P03_SIDE_OR_REAR, P04_CONTEXT_STREET
- StructuralSystemEnum: RC_FRAME, STEEL_FRAME, LOAD_BEARING_BRICK, MIXED, TIMBER, OTHER
- FoundationTypeEnum: SHALLOW_PAD, WOOD_PILE, PC_PILE, CIP_BORED_PILE, UNKNOWN
- ActivityStateEnum: U_UNKNOWN, S_STABLE, A_ACTIVE
- ECSClassEnum: GOOD_0_5, MEDIUM_6_10, DEFICIENT_11_16, CRITICAL_17_24
- VIClassEnum: LOW, MEDIUM, HIGH, VERY_HIGH
- SeverityFlagEnum: NONE, LOW, MODERATE, HIGH, CRITICAL
```
