# Đặc Tả Sơ Đồ Hoạt Động & Sơ Đồ Tuần Tự (Activity & Sequence Diagrams)

> **MỤC ĐÍCH:** Tài liệu đặc tả toàn bộ luồng nghiệp vụ động học (**Dynamic Behavioral Modeling**) của Hệ thống Khảo sát Quy hoạch Hiện trạng Công trình Tuyến Metro 2. Bao gồm các **Sơ đồ Hoạt động (Activity Diagrams)** và **Sơ đồ Tuần tự (Sequence Diagrams)** chi tiết nhằm định hướng chính xác kiến trúc luồng dữ liệu, các hàm API, và vòng đời nghiệp vụ trước khi bước vào giai đoạn lập trình (Implementation).

---

## PHẦN 1: SƠ ĐỒ HOẠT ĐỘNG (ACTIVITY DIAGRAMS)

---

### 1.1. ACTIVITY DIAGRAM 1: Vòng Đời Toàn Diện Khảo Sát & Phê Duyệt Hồ Sơ (End-to-End Lifecycle)

Sơ đồ thể hiện luồng phối hợp giữa **Surveyor (Hiện trường)**, **Hệ Thống PWA/Backend**, và **Zone Admin (Văn phòng Thẩm định)**:

```mermaid
stateDiagram-v2
    [*] --> CheckInGPS: Surveyor đến công trình
    
    state "1. Check-in Chấm công" as CheckInGPS {
        [*] --> CaptureSelfie: Bắt tọa độ GPS & Chụp ảnh Selfie
        CaptureSelfie --> EnterWitness: Nhập danh sách người đi cùng
        EnterWitness --> [*]
    }
    
    CheckInGPS --> SelectParcel: Chọn Thửa đất trên bản đồ GIS
    
    state "2. Thực hiện Luồng 9 Bước Thực Địa" as SurveyFlow {
        [*] --> Step1_P01_P04: Bước 1 - Chụp ảnh P01-P04 (Chấm góc nhà + Line cắt tầng)
        Step1_P01_P04 --> Step2_Interview: Bước 2 - Phỏng vấn móng (CAT) & Kết cấu
        Step2_Interview --> Step3_Floors_Defects: Bước 3 - Khảo sát từng tầng & Ghim D-xx
        Step3_Floors_Defects --> Step4_Deformation: Bước 4 - Đo lún nghiêng X/Y
        Step4_Deformation --> Step5_CadastralCheck: Bước 5 - Đối soát ranh thửa GIS
        
        state Step5_CadastralCheck {
            [*] --> CheckBoundary: Kiểm tra ranh thực tế
            CheckBoundary --> SplitOrMerge: Có biến động (Tách/Gộp)?
            SplitOrMerge --> RedrawPolygon: [Có] Bật Polygon Tool vẽ lại ranh
            SplitOrMerge --> KeepBoundary: [Không] Giữ nguyên ranh gốc
            RedrawPolygon --> [*]
            KeepBoundary --> [*]
        }
        
        Step5_CadastralCheck --> Step6_QualityGate: Bước 6 - Cổng kiểm soát chất lượng (Checklist 10 mục)
        
        state Step6_QualityGate {
            [*] --> ValidateRules: Kiểm tra đủ ảnh CTX+CU, thước đo, tọa độ
            ValidateRules --> QualityPass: Đạt chuẩn 10/10 tiêu chí
            ValidateRules --> QualityFail: Thiếu ảnh / Thiếu kích thước
            QualityFail --> [*]: Yêu cầu bổ sung tại chỗ
            QualityPass --> [*]
        }
        
        Step6_QualityGate --> Step7_Scoring: Bước 7 - Auto Scoring ECS/VI (P1) hoặc Tổng kết Delta (P2)
        Step7_Scoring --> Step8_LegalCommitment: Bước 8 - Cam kết pháp lý & Ý kiến chủ hộ
        Step8_LegalCommitment --> Step9_SignOff: Bước 9 - Ký số / Chụp ảnh xác nhận 4 bên
        Step9_SignOff --> [*]
    }
    
    SurveyFlow --> SubmitReport: Bấm "Nộp Báo Cáo" (SUBMITTED)
    
    SubmitReport --> ZoneAdminAudit: Zone Admin mở Split-Pane thẩm định
    
    state "3. Thẩm Định & Ra Quyết Định" as ZoneAdminAudit {
        [*] --> ReviewDetails: Soi kính lúp 400% ảnh CU có thước
        ReviewDetails --> CheckMutation: Có biến động ranh đất?
        CheckMutation --> ApproveMutation: [Có] Duyệt đa giác ranh mới
        CheckMutation --> DirectReview: [Không]
        ApproveMutation --> DirectReview
        
        DirectReview --> DecisionFork: Quyết định thẩm định
        DecisionFork --> ApproveReport: ĐẠT ➔ Phê duyệt Báo cáo (APPROVED)
        DecisionFork --> RejectReport: KHÔNG ĐẠT ➔ Trả về (REJECTED)
        
        ApproveReport --> FreezeData: Đóng băng dữ liệu & Sinh PDF/A có chữ ký số
        RejectReport --> RollbackData: Rollback ranh đất & Mở quyền sửa cho Surveyor
    }
    
    RollbackData --> SurveyFlow: Surveyor nhận thông báo sửa đổi
    FreezeData --> PublishedToContractor: Công bố cho Contractor / Xuất báo cáo hàng loạt
    PublishedToContractor --> [*]
```

---

### 1.2. ACTIVITY DIAGRAM 2: Luồng Khảo Sát Phase 2 Theo Vị Trí Đứng & Mở Rộng Khuyết Tật

Sơ đồ mô tả chi tiết cơ chế thông minh tại **Bước 3 của Phase 2**: Tự động lọc khuyết tật theo vị trí đứng, đối soát biến động $\Delta w, \Delta L$ và mở rộng khu vực mới:

```mermaid
flowchart TD
    Start([Bắt đầu Bước 3 - Phase 2]) --> SelectLocation[Surveyor chọn Tầng & Phòng đang đứng]
    SelectLocation --> AutoQuery[PWA gửi GET /zones?floor=...&room=... truy xuất dữ liệu GĐ1]
    
    AutoQuery --> CheckExist{Có Vùng Z-xx từ GĐ1<br>tại vị trí này không?}
    
    %% Nhánh 1: Vùng hiện hữu
    CheckExist -- Có --> RenderExisting[Hiển thị ảnh Photo CTX cũ + Các ghim D-xx cũ]
    RenderExisting --> SurveyorInspect[Surveyor quan sát thực tế mảng tường Z-xx]
    
    SurveyorInspect --> LoopOldDefects[Đối soát từng vết nứt cũ D-01, D-02...]
    LoopOldDefects --> MeasureOld[Đo lại w2, L2 ngoài thực địa]
    MeasureOld --> CalcDelta[Hệ thống tự tính: Δw = w2 - w1, ΔL = L2 - L1]
    CalcDelta --> SelectStatus{Trạng thái biến động?}
    SelectStatus -- Không đổi --> MarkStable[Ghim đổi màu Xanh lá - STABLE]
    SelectStatus -- Phát triển --> MarkEvolved[Ghim đổi màu Cam - WIDENED/LENGTHENED]
    SelectStatus -- Đã sửa --> MarkRepaired[Ghim đổi màu Xám - REPAIRED]
    
    MarkStable --> SnapCUOld[Chụp ảnh CU mới có áp sát thước đo]
    MarkEvolved --> SnapCUOld
    MarkRepaired --> SnapCUOld
    
    SnapCUOld --> CheckNewOnOld{Phát hiện vết nứt MỚI<br>trên mảng tường cũ này?}
    CheckNewOnOld -- Có --> PinNewOnOld[Chạm tay lên Photo CTX cũ ➔ Thả ghim ĐỎ D-new]
    PinNewOnOld --> InputNewDefect[Nhập loại nứt, w2, L2, hướng nứt]
    InputNewDefect --> SnapCUNew[Chụp ảnh CU mới có thước đo]
    SnapCUNew --> NextWallCheck
    CheckNewOnOld -- Không --> NextWallCheck{Kiểm tra tiếp không gian?}
    
    %% Nhánh 2: Khu vực mới xuất hiện
    CheckExist -- Không hoặc Khu vực mới cơi nới --> ClickAddZone[Bấm nút '+ Thêm Vùng Khảo Sát Mới']
    ClickAddZone --> GenNewZCode[Hệ thống cấp mã Z-new, cờ isNewInPhase2 = true]
    GenNewZCode --> SnapNewCTX[Chụp 1 ảnh Photo CTX bối cảnh mảng tường mới]
    SnapNewCTX --> QuickMatrix[Đánh giá nhanh tình trạng: Sàn, Trần, Tường, Cột, Thấm, Lún]
    QuickMatrix --> PinDefectsOnNew[Chạm lên ảnh Photo CTX mới ➔ Thả ghim ĐỎ D-new]
    PinDefectsOnNew --> SnapCUNewZone[Nhập w, L và Chụp ảnh CU có thước đo]
    SnapCUNewZone --> NextWallCheck
    
    NextWallCheck -- Còn tầng/phòng tiếp theo --> SelectLocation
    NextWallCheck -- Đã đi hết tất cả các tầng --> FinishStep3([Chuyển sang Bước 4: Đo Lún Nghiêng])
```

---

### 1.3. ACTIVITY DIAGRAM 3: Quy Trình Xử Lý Biến Động Thửa Đất & Dải Số Mở Rộng Bất Biến

Sơ đồ giải quyết bài toán chống xô lệch ID khi phát sinh tách/gộp thửa ngoài thực địa:

```mermaid
flowchart TD
    A[Surveyor hoàn thành kiểm tra các tầng - Bước 5] --> B{Đối soát ranh thực địa với bản đồ GIS}
    
    B -- Khớp 100% --> C[Giữ nguyên mã B-XXXXX gốc & chuyển bước]
    
    B -- Phát hiện chia tách 2 căn --> D[Bật công cụ Polygon Split Tool trên PWA]
    D --> E[Vẽ đường ranh phân chia thực tế thành 2 polygon con]
    E --> F[Hệ thống kích hoạt Thuật toán Dải số Mở rộng]
    
    F --> G[Cấp mã mới cho 2 mảnh: B-07001 và B-07002 từ Kho số > 07000]
    G --> H[Thửa gốc B-00002 chuyển trạng thái: PENDING_MUTATION_APPROVAL]
    H --> I[Lập sự kiện ParcelMutationEvent: lưu vết Snapshot cũ/mới]
    
    I --> J[Nộp báo cáo kèm đề xuất biến động]
    J --> K[Zone Admin mở màn hình Thẩm định Ranh Thửa]
    
    K --> L{Zone Admin Quyết định?}
    L -- DUYỆT BIẾN ĐỘNG --> M[1. Thửa B-00002 chuyển SPLIT_DEPRECATED<br>2. Kích hoạt chính thức B-07001, B-07002 lên lớp GIS Master<br>3. Các thửa B-00003, B-00005... giữ nguyên 100% mã số]
    L -- TỪ CHỐI (REJECT) --> N[1. Hủy bỏ B-07001, B-07002<br>2. Khôi phục B-00002 về ACTIVE<br>3. Yêu cầu Surveyor đo đạc lại]
    
    M --> EndNode([Hoàn tất biến động])
    N --> EndNode
```

---

## PHẦN 2: SƠ ĐỒ TUẦN TỰ (SEQUENCE DIAGRAMS)

---

### 2.1. SEQUENCE DIAGRAM 1: Luồng Khảo Sát Hiện Trường Phase 1 (Baseline Survey Flow)

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    participant GW as API Gateway / Router
    participant PS as Parcel & Zone Service
    participant SS as Survey & Scoring Service
    participant FS as S3 Object Storage
    participant DB as PostgreSQL 16 (PostGIS)

    Note over S,DB: GIAI ĐOẠN 1: CHECK-IN & TIẾP CẬN CÔNG TRÌNH
    S->>GW: POST /api/v1/attendance/check-in (GPS, Selfie, Accompaniment)
    GW->>PS: recordCheckIn(surveyorId, lat, lng, selfieFile)
    PS->>FS: uploadCheckInPhoto(selfie)
    FS-->>PS: return selfieUrl
    PS->>DB: INSERT INTO timekeeping_checkins
    DB-->>S: 200 OK (Check-in Thành công)

    S->>GW: GET /api/v1/parcels/{parcelId}
    GW->>PS: getParcelDetails(parcelId)
    PS->>DB: SELECT * FROM parcels WHERE id = parcelId
    DB-->>S: 200 OK (Thông tin thửa B-XXXXX, KS003, Polygon)

    Note over S,DB: BƯỚC 1: CHỤP ẢNH ĐỊNH DANH (P01 - P04)
    S->>GW: POST /api/v1/reports/phase1/photos (P01, P02 + Facade Points + Split Lines)
    GW->>FS: uploadRawPhotos(P01..P04)
    FS-->>GW: return rawPhotoUrls
    GW->>DB: INSERT INTO survey_photos (raw_url, points_json, floor_lines_json)
    DB-->>S: 201 Created

    Note over S,DB: BƯỚC 3: TẠO VÙNG Z-xx & GHIM KHUYẾT TẬT D-xx
    S->>GW: POST /api/v1/reports/phase1/zones (Floor, Room, CTX Photo)
    GW->>FS: uploadPhoto(CTX)
    GW->>DB: INSERT INTO damage_zones (zone_code, ctx_url, burland_grade)
    DB-->>S: 201 Created (zoneId: Z-01)

    S->>GW: POST /api/v1/reports/phase1/zones/{zoneId}/defects (Pin X/Y, CU Photo, w, L)
    GW->>FS: uploadPhoto(CU with scale card)
    GW->>DB: INSERT INTO defect_items (defect_code, pin_x, pin_y, cu_url, w_max, L)
    DB-->>S: 201 Created (defectId: D-01)

    Note over S,DB: BƯỚC 7 - 9: AUTO SCORING & NỘP BÁO CÁO
    S->>GW: POST /api/v1/reports/phase1/{reportId}/calculate-scores
    GW->>SS: calculateEcsAndVi(reportId)
    SS->>DB: SELECT * FROM damage_zones, defect_items, building_specs
    SS->>SS: Compute ECS Score (0-24) & VI Class (Low/Med/High/VeryHigh)
    SS->>DB: INSERT INTO risk_score_cards (ecs_score, vi_class)
    DB-->>S: 200 OK (ECS: 4/24 - GOOD, VI: Low)

    S->>GW: POST /api/v1/reports/phase1/{reportId}/submit (Signatures, Verification)
    GW->>SS: submitReportForReview(reportId)
    SS->>DB: UPDATE base_survey_reports SET status = 'SUBMITTED'
    DB-->>S: 200 OK (Đã gửi Báo cáo về Zone Admin thẩm định)
```

---

### 2.2. SEQUENCE DIAGRAM 2: Luồng Khảo Sát Phase 2 Theo Vị Trí Đứng & Đối Soát Delta

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    participant GW as API Gateway
    participant P2S as Phase 2 Survey Service
    participant DE as Delta Engine
    participant FS as S3 Storage
    participant DB as PostgreSQL 16

    Note over S,DB: TRUY XUẤT DỮ LIỆU GĐ1 THEO VỊ TRÍ ĐỨNG
    S->>GW: GET /api/v1/parcels/{parcelId}/phase2/zones?floor=Lầu 1&room=Phòng ngủ 1
    GW->>P2S: getZonesByLocation(parcelId, floor, room)
    P2S->>DB: Query Phase 1 Zones & Defects matching (floor, room)
    DB-->>P2S: Return Zone Z-02 (CTX Photo, Pins: D-02)
    P2S-->>S: 200 OK (Hiển thị Zone Z-02, Photo CTX + Ghim D-02 trên màn hình)

    Note over S,DB: KỊCH BẢN A: ĐỐI SOÁT GHIM CŨ (D-02)
    S->>GW: PUT /api/v1/phase2/defects/{d02Id}/verify (w2=0.8mm, L2=650mm, Status=WIDENED, CU Photo)
    GW->>FS: uploadPhoto(D02-CU Phase 2)
    GW->>DE: computeDelta(d02Id, w2, L2)
    DE->>DB: SELECT w1, L1 FROM defect_items WHERE id = d02Id
    DE->>DE: Compute Δw = 0.8 - 0.5 = +0.3mm, ΔL = +150mm
    DE->>DB: UPDATE defect_items SET phase2_w = 0.8, delta_w = 0.3, evolution = 'WIDENED'
    DB-->>S: 200 OK (Ghim D-02 đổi sang màu Cam Cảnh báo)

    Note over S,DB: KỊCH BẢN B: CHẤM THÊM VẾT NỨT MỚI TRÊN VÙNG CŨ (Z-02)
    S->>S: Chạm tay lên ảnh Photo CTX cũ tại vị trí vết nứt mới
    S->>GW: POST /api/v1/phase2/zones/{z02Id}/defects (Pin X/Y, CU Photo, w2=1.0mm, L2=400mm)
    GW->>FS: uploadPhoto(D04-CU Mới)
    GW->>DB: INSERT INTO defect_items (code='D-04', is_new_in_phase2=true, evolution='NEW_RECORDED')
    DB-->>S: 201 Created (Thêm ghim Đỏ D-04 mới)

    Note over S,DB: KỊCH BẢN C: TẠO VÙNG MỚI (Z-new) CHO KHU VỰC MỚI
    S->>GW: POST /api/v1/phase2/reports/{reportId}/zones (Floor=Gác lửng, CTX Photo)
    GW->>FS: uploadPhoto(Z04-CTX Mới)
    GW->>DB: INSERT INTO damage_zones (code='Z-04', is_new_in_phase2=true)
    DB-->>S: 201 Created (Tạo Vùng Z-04 Mới ➔ Cho phép thả ghim D-05)

    Note over S,DB: TỔNG KẾT BIẾN ĐỘNG & BỒI THƯỜNG
    S->>GW: POST /api/v1/phase2/reports/{reportId}/summarize-delta
    GW->>DE: evaluateCompensation(reportId)
    DE->>DB: Aggregate all defect deltas & new defects count
    DE->>DE: Calculate ΔECS & Verdict (NO_IMPACT | COSMETIC | STRUCTURAL)
    DE->>DB: UPDATE phase2_survey_reports SET compensation_verdict = 'STRUCTURAL_IMPACT'
    DB-->>S: 200 OK (Hiển thị Bảng tổng kết so sánh Phase 1 vs Phase 2)
```

---

### 2.3. SEQUENCE DIAGRAM 3: Đường Ống Xử Lý Ảnh AI Nắn Thẳng Mặt Đứng (AI Facade Rectification Pipeline)

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    participant GW as API Gateway
    participant FS as S3 Object Storage
    participant Q as Redis Queue / Message Broker
    participant AI as AI Vision Worker (Python / OpenCV)
    participant DB as PostgreSQL 16

    S->>S: Chụp ảnh chính diện P-02 ngoài đường
    S->>S: Chấm 4 điểm góc nhà + Kéo 3 đường phân tầng + Viết tay h1, h2, H_tot
    S->>GW: POST /api/v1/photos/upload-facade (Raw Image, Polygon JSON, SplitLines JSON, Canvas Text)
    
    GW->>FS: Lưu trữ file ảnh gốc nguyên bản (raw_P02.jpg)
    FS-->>GW: return rawPhotoUrl
    GW->>DB: INSERT INTO survey_photos (raw_photo_url, points_json, floor_lines_json, ai_status='PENDING')
    GW->>Q: Enqueue Job: {photoId, rawPhotoUrl, pointsJson, floorLinesJson}
    GW-->>S: 200 OK (Upload thành công, AI đang xử lý nền)

    Note over Q,AI: TIẾN TRÌNH AI WORKER XỬ LÝ NỀN (BACKGROUND WORKER)
    Q->>AI: Dequeue Job
    AI->>FS: Tải ảnh gốc raw_P02.jpg
    
    Note over AI: 1. Nắn thẳng 90 độ (Perspective 3x3 Homography Matrix)
    AI->>AI: Tính ma trận nắn phẳng hình học dựa trên 4 điểm Polygon góc nhà
    AI->>AI: Triệt tiêu góc nghiêng chụp ngước, xoay thẳng đứng mặt đứng chính
    
    Note over AI: 2. OCR & Tự động Bắt dính mép dầm (Edge Snapping)
    AI->>AI: Nhận diện chữ viết tay kích thước (3.5m, 12m...)
    AI->>AI: Snap các đường phân tầng vào đúng vị trí dầm sàn bê tông thực tế
    
    Note over AI: 3. Render Lớp Đồ Họa Kỹ Thuật Chuẩn CAD
    AI->>AI: Vẽ đường dóng kích thước mảnh, mũi tên 2 đầu và font số kỹ thuật số sắc nét
    
    AI->>FS: Lưu ảnh hoàn thiện (ai_enhanced_P02.png)
    FS-->>AI: return aiEnhancedPhotoUrl
    AI->>DB: UPDATE survey_photos SET ai_enhanced_photo_url = ..., ai_status = 'COMPLETED'
    
    Note over DB,S: THÔNG BÁO HOÀN TẤT CHO CLIENT
    AI->>GW: Publish WebSocket Event: {photoId, status: 'COMPLETED'}
    GW-->>S: Push Notification: "Ảnh mặt đứng đã được AI nắn phẳng chuẩn CAD"
```

---

### 2.4. SEQUENCE DIAGRAM 4: Thẩm Định Báo Cáo Split-Pane & Ra Quyết Định (Zone Admin Audit & Approval)

```mermaid
sequenceDiagram
    autonumber
    actor A as Zone Admin (Web Portal)
    participant GW as API Gateway
    participant AS as Audit & Review Service
    participant PDF as PDF/A Generation Engine
    participant DB as PostgreSQL 16
    actor S as Surveyor (Mobile PWA)

    A->>GW: GET /api/v1/admin/reports/{reportId}/audit-view
    GW->>AS: getAuditSplitPaneData(reportId)
    AS->>DB: Query Report, Photos (CTX, CU), Defects, Mutation Events
    DB-->>AS: Return Full Audit Payload
    AS-->>A: 200 OK (Render màn hình Split-Pane: Trái sơ đồ ghim, Phải ảnh CU soi kính lúp 400%)

    alt Có Đề xuất Biến động Tách / Gộp Thửa Đất
        A->>GW: POST /api/v1/admin/mutations/{mutationId}/approve
        GW->>DB: UPDATE parcel_mutation_events SET status = 'APPROVED'
        GW->>DB: UPDATE parcels SET lifecycle_status = 'SPLIT_DEPRECATED' (Thửa cũ)
        GW->>DB: UPDATE parcels SET lifecycle_status = 'ACTIVE' (Các thửa con B-07001, B-07002)
        DB-->>A: 200 OK (Đã cập nhật ranh đất lên GIS Master)
    end

    alt Trường hợp 1: Phê duyệt Báo cáo (Approve)
        A->>GW: POST /api/v1/admin/reports/{reportId}/approve (Engineering Judgement Notes if any)
        GW->>AS: approveSurveyReport(reportId, adminId)
        AS->>DB: UPDATE base_survey_reports SET status = 'APPROVED', approved_at = NOW()
        AS->>PDF: generateOfficialPdfReport(reportId)
        PDF->>DB: Fetch Report Data & AI Enhanced Photos
        PDF->>PDF: Render Official Legal PDF/A Document with Digital Watermark
        PDF-->>AS: return reportPdfUrl
        AS->>DB: UPDATE base_survey_reports SET file_download_url = reportPdfUrl
        DB-->>A: 200 OK (Báo cáo đã duyệt & Xuất bản thành công)
        AS-->>S: Push Notification: "Báo cáo thửa B-XXXXX đã được Zone Admin phê duyệt"
    else Trường hợp 2: Trả về yêu cầu Khảo sát lại (Reject)
        A->>GW: POST /api/v1/admin/reports/{reportId}/reject (Reason: "Ảnh CU D-02 thiếu thước đo vạch mm")
        GW->>AS: rejectSurveyReport(reportId, reason)
        AS->>DB: UPDATE base_survey_reports SET status = 'REJECTED', rejection_reason = reason
        AS->>DB: Rollback Parcel Mutation if any
        DB-->>A: 200 OK (Đã trả về báo cáo)
        AS-->>S: Push Notification & Alert: "Báo cáo B-XXXXX bị trả về: Ảnh CU D-02 thiếu thước đo"
    end
```

---

### 2.5. SEQUENCE DIAGRAM 5: Xuất Bộ Hồ Sơ Hàng Loạt & Tra Cứu Khách (Batch Compilation & Guest Access)

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin (Zone/Super)
    actor G as Contractor / Guest Viewer
    participant GW as API Gateway
    participant BE as Batch Export Worker
    participant FS as S3 Storage
    participant DB as PostgreSQL 16

    Note over A,DB: TIẾN TRÌNH XUẤT HỒ SƠ BÁO CÁO HÀNG LOẠT (BATCH EXPORT)
    A->>GW: POST /api/v1/reports/batch-export (ZoneId, DateRange, Format: PDF_BOOK | ZIP)
    GW->>BE: queueBatchExportJob(zoneId, dateRange, format)
    BE->>DB: SELECT * FROM base_survey_reports WHERE zone_id = ... AND status = 'APPROVED'
    DB-->>BE: Return 150 Approved Reports (Order by Chainage Km + Sub-parcels grouped)
    
    BE->>BE: 1. Tạo Trang Bìa Pháp Lý & Mục Lục Tự Động
    BE->>BE: 2. Render Bản Đồ GIS Tổng Hợp Tuyến Metro 2 của Phân Khu
    BE->>BE: 3. Biên Tập Bảng Kê Danh Mục Thửa Đất & Bảng Điểm Rủi Ro ECS/VI
    BE->>BE: 4. Ghép nối 150 file PDF Báo Cáo Đơn Lẻ thành 1 Tập Hồ Sơ Duy Nhất
    BE->>BE: 5. Tính mã băm Checksum SHA-256 bảo mật chống chỉnh sửa
    
    BE->>FS: Upload File Tập Hồ Sơ (Dossier_Zone_S9_202609.pdf)
    FS-->>BE: return fileDownloadUrl
    BE->>DB: INSERT INTO compiled_report_batches (file_url, checksum_sha256, is_published=true)
    BE-->>A: Push Notification: "Bộ Hồ Sơ Phân Khu Ga S9 (150 Thửa) Đã Đóng Gói Xong"

    Note over G,DB: KHÁCH TRA CỨU & TẢI TẬP HỒ SƠ ĐÃ CÔNG BỐ
    G->>GW: GET /api/v1/guest/gis-map (Passcode if private link)
    GW->>DB: Verify Passcode & Fetch Published Parcels Layer
    DB-->>G: 200 OK (Render Bản Đồ GIS tương tác, các lô đất xanh lá đã duyệt)
    
    G->>GW: GET /api/v1/guest/dossiers/{batchId}/download
    GW->>DB: Check is_published_to_guests = true
    GW->>FS: Get File Stream
    FS-->>G: Download Tập Hồ Sơ Hoàn Chỉnh (PDF Book / ZIP Archive)
```

---

## 3. DANH MỤC CÁC API ENDPOINTS ĐƯỢC CHUẨN HÓA TỪ SEQUENCE DIAGRAMS

| STT | Phương thức | Endpoint API | Chức năng nghiệp vụ | Tác nhân chính |
| :---: | :---: | :--- | :--- | :--- |
| 1 | `POST` | `/api/v1/attendance/check-in` | Check-in chấm công GPS + Ảnh Selfie | `SURVEYOR` |
| 2 | `GET` | `/api/v1/parcels/{parcelId}` | Lấy chi tiết thửa đất & polygon ranh | `SURVEYOR`, `ZONE_ADMIN` |
| 3 | `POST` | `/api/v1/reports/phase1/photos` | Upload ảnh P01-P04 + Chấm góc + Phân tầng | `SURVEYOR` |
| 4 | `POST` | `/api/v1/reports/phase1/zones` | Tạo Vùng khảo sát $Z-xx$ + Ảnh bối cảnh CTX | `SURVEYOR` |
| 5 | `POST` | `/api/v1/reports/phase1/zones/{id}/defects` | Thả ghim $D-xx$ + Ảnh cận cảnh CU có thước | `SURVEYOR` |
| 6 | `GET` | `/api/v1/parcels/{id}/phase2/zones` | Tự động lọc Vùng & Khuyết tật theo Tầng/Phòng | `SURVEYOR` (Phase 2) |
| 7 | `PUT` | `/api/v1/phase2/defects/{id}/verify` | Đối soát vết nứt cũ ($\Delta w, \Delta L$, trạng thái) | `SURVEYOR` (Phase 2) |
| 8 | `POST` | `/api/v1/reports/{id}/calculate-scores` | Tính điểm tự động ECS/24, VI, và $\Delta ECS$ | Hệ thống tự động |
| 9 | `POST` | `/api/v1/mutations/propose` | Đề xuất biến động tách/gộp thửa đất ranh GIS | `SURVEYOR` |
| 10 | `GET` | `/api/v1/admin/reports/{id}/audit-view` | Lấy dữ liệu đối soát Split-Pane kính lúp 400% | `ZONE_ADMIN` |
| 11 | `POST` | `/api/v1/admin/reports/{id}/approve` | Phê duyệt Báo cáo & Sinh PDF/A chính thức | `ZONE_ADMIN` |
| 12 | `POST` | `/api/v1/admin/reports/{id}/reject` | Trả về báo cáo kèm lý do cần khảo sát lại | `ZONE_ADMIN` |
| 13 | `POST` | `/api/v1/reports/batch-export` | Đóng gói xuất Báo cáo Hàng loạt (PDF Book/ZIP) | `ZONE_ADMIN`, `SUPER_ADMIN` |
| 14 | `GET` | `/api/v1/guest/gis-map` | Xem bản đồ quy hoạch GIS công khai cho khách | `CONTRACTOR/GUEST` |
