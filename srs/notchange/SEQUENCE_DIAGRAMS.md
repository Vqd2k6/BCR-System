# Đặc Tả Chi Tiết Sơ Đồ Tuần Tự Theo Từng Đối Tượng (Sequence Diagrams Specification)

> [!IMPORTANT]
> **LƯU Ý DÀNH CHO AI AGENT & DEVELOPER (TÀI LIỆU ĐANG TIẾP TỤC HOÀN THIỆN & MỞ RỘNG):**
> Tài liệu này là **bản đặc tả cơ sở (Baseline Specification)** nhằm định hướng luồng tương tác API và vòng đời dữ liệu ban đầu. Tài liệu **CHƯA PHẢI LÀ BẢN ĐẦY ĐỦ 100% TUYỆT ĐỐI** và sẽ tiếp tục được bổ sung, đào sâu chi tiết trong quá trình code và phát triển sản phẩm. Khi triển khai code thực tế, Agent/Developer cần nắm vững rằng hệ thống sẽ phát sinh thêm các nhánh xử lý biên (Edge cases), tính năng mở rộng và cần chủ động hoàn thiện cả code lẫn cập nhật ngược lại tài liệu này.

> **MỤC ĐÍCH:** Tài liệu đặc tả chi tiết toàn bộ luồng tương tác tuần tự (**UML Sequence Diagrams**) giữa các Đối tượng người dùng (**Actors**), Giao diện (**Frontend Web/PWA**), Cổng giao tiếp (**API Gateway**), Dịch vụ nghiệp vụ (**Backend Services**), Hàng đợi xử lý nền (**Background AI Workers**), Kho lưu trữ file (**S3 Object Storage**), và Cơ sở dữ liệu (**PostgreSQL 16 + PostGIS**). Bám sát 100% các kịch bản sử dụng (Use Cases) trong `srs/ROLES_AND_USE_CASES.md`.

---

## 1. PHÂN HỆ CÁN BỘ KHẢO SÁT HIỆN TRƯỜNG (`SURVEYOR`)

---

### 1.1. Sequence 1.1: Check-in Chấm Công GPS Hiện Trường & Upload Ảnh Selfie (UC-02)

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    participant GW as API Gateway / Router
    participant AS as Attendance Service
    participant FS as S3 Object Storage
    participant DB as PostgreSQL 16 (PostGIS)

    S->>S: Bật định vị GPS trên điện thoại
    S->>S: Chụp ảnh selfie tại hiện trường
    S->>GW: POST /api/v1/attendance/check-in<br>(gpsLat, gpsLng, accuracy, selfieFile, accompanyingMembers, notes)
    
    GW->>AS: validateAndRecordCheckIn(...)
    AS->>AS: Kiểm tra độ chính xác GPS (accuracy <= 20m)
    
    AS->>FS: uploadCheckInPhoto(selfieFile)
    FS-->>AS: return selfiePhotoUrl
    
    AS->>DB: INSERT INTO timekeeping_checkins<br>(surveyor_id, zone_id, checkin_time, gps_lat, gps_lng, selfie_url, accompanying_members)
    DB-->>AS: return checkInRecord (status: SUCCESS)
    
    AS-->>GW: 201 Created (checkInId, timestamp)
    GW-->>S: 201 Created (Hiển thị thông báo Chấm công thành công & Mở quyền làm việc)
```

---

### 1.2. Sequence 1.2: Luồng Khảo Sát Hiện Trường Giai Đoạn 1 (Phase 1 Baseline - 9 Bước Thực Địa)

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    participant GW as API Gateway
    participant PS as Parcel Service
    participant SS as Survey & Scoring Service
    participant FS as S3 Storage
    participant DB as PostgreSQL 16

    Note over S,DB: 1. TIẾP CẬN & CHỤP ẢNH ĐỊNH DANH P01 - P04
    S->>GW: GET /api/v1/parcels/{parcelId}
    GW->>PS: getParcelDetails(parcelId)
    PS->>DB: SELECT * FROM parcels WHERE id = parcelId
    DB-->>PS: Return Parcel (B-XXXXX, KS003, Polygon)
    PS-->>S: 200 OK (Render thông tin công trình)

    S->>GW: POST /api/v1/reports/phase1/{reportId}/identification-photos<br>(P01, P02, P03, P04, pointsJson, floorSplitJson, canvasTextJson)
    GW->>FS: Upload raw photos (P01..P04)
    FS-->>GW: Return rawPhotoUrls
    GW->>DB: INSERT INTO survey_photos (raw_url, points_json, floor_lines_json, canvas_json)
    DB-->>S: 201 Created

    Note over S,DB: 2. PHỎNG VẤN KẾT CẤU & MÓNG CAT (1-5)
    S->>GW: POST /api/v1/reports/phase1/{reportId}/specs<br>(useType, floors, rcStructure, foundationType, catScore, historyE5)
    GW->>DB: INSERT INTO building_specifications, historical_sensitivities
    DB-->>S: 200 OK

    Note over S,DB: 3. KHẢO SÁT TỪNG TẦNG: VÙNG Z-xx & GHIM D-xx
    S->>GW: POST /api/v1/reports/phase1/{reportId}/zones (Floor, Room, CTX Photo, Burland Grade)
    GW->>FS: Upload CTX Photo
    GW->>DB: INSERT INTO damage_zones (zone_code='Z-01', ctx_url, burland_grade)
    DB-->>S: 201 Created (zoneId: Z-01)

    S->>GW: POST /api/v1/reports/phase1/zones/{zoneId}/defects (Pin X/Y, CU Photo with Scale Card, w, L)
    GW->>FS: Upload CU Photo
    GW->>DB: INSERT INTO defect_items (defect_code='D-01', pin_x, pin_y, cu_url, w_max, length)
    DB-->>S: 201 Created (defectId: D-01)

    Note over S,DB: 4. ĐO ĐẠC LÚN NGHIÊNG & ĐỐI SOÁT RANH GIS
    S->>GW: POST /api/v1/reports/phase1/{reportId}/deformation (TiltX, TiltY, FloorTilt, Deflection)
    GW->>DB: INSERT INTO deformation_assessments
    DB-->>S: 200 OK

    Note over S,DB: 5. AUTO SCORING ECS/VI & NỘP BÁO CÁO
    S->>GW: POST /api/v1/reports/phase1/{reportId}/calculate-scores
    GW->>SS: calculateEcsAndVi(reportId)
    SS->>DB: Query specs, deformation, defects, burland grades
    SS->>SS: Auto Calculate ECS Score (0-24) & VI Class (Low/Med/High/VeryHigh)
    SS->>DB: INSERT INTO risk_score_cards (ecs_score, vi_class)
    DB-->>S: 200 OK (ECS: 5/24 - GOOD, VI: Low)

    S->>GW: POST /api/v1/reports/phase1/{reportId}/submit (Signatures Photos)
    GW->>DB: UPDATE base_survey_reports SET status = 'SUBMITTED'
    DB-->>S: 200 OK (Đã gửi Báo cáo về Zone Admin thẩm định)
```

---

### 1.3. Sequence 1.3: Đường Ống AI Nắn Thẳng Phối Cảnh Mặt Đứng & Chuẩn CAD ($P-02$)

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    participant GW as API Gateway
    participant FS as S3 Storage
    participant Q as Redis Job Queue
    participant AI as Python AI Vision Worker
    participant DB as PostgreSQL 16

    S->>S: Chụp ảnh chính diện P-02 ngoài đường
    S->>S: Chấm 4 điểm góc nhà + Kéo line phân tầng + Viết tay kích thước h1, h2
    S->>GW: POST /api/v1/photos/upload-facade (Raw Image, Polygon JSON, SplitLines JSON, Canvas Text)
    
    GW->>FS: Lưu trữ file ảnh gốc nguyên bản (raw_P02.jpg)
    FS-->>GW: Return rawPhotoUrl
    GW->>DB: INSERT INTO survey_photos (raw_photo_url, points_json, floor_lines_json, ai_status='PENDING')
    GW->>Q: Push Job: {photoId, rawPhotoUrl, pointsJson, floorLinesJson}
    GW-->>S: 200 OK (Upload thành công, AI đang xử lý nền)

    Note over Q,AI: TIẾN TRÌNH AI WORKER XỬ LÝ NỀN (BACKGROUND WORKER)
    Q->>AI: Pop Job
    AI->>FS: Tải ảnh gốc raw_P02.jpg
    
    Note over AI: 1. Nắn thẳng 90 độ (Perspective 3x3 Homography Matrix)
    AI->>AI: Tính ma trận nắn phẳng hình học dựa trên 4 điểm Polygon góc nhà
    AI->>AI: Triệt tiêu góc nghiêng chụp ngước, xoay thẳng đứng mặt đứng chính
    
    Note over AI: 2. OCR & Tự động Bắt dính mép dầm sàn (Edge Snapping)
    AI->>AI: Nhận diện chữ viết tay kích thước (3.5m, 12m...)
    AI->>AI: Snap các đường phân tầng vào đúng vị trí dầm sàn bê tông thực tế
    
    Note over AI: 3. Render Lớp Đồ Họa Kỹ Thuật Chuẩn CAD
    AI->>AI: Vẽ đường dóng kích thước mảnh, mũi tên 2 đầu và font số kỹ thuật số sắc nét
    
    AI->>FS: Lưu ảnh hoàn thiện (ai_enhanced_P02.png)
    FS-->>AI: Return aiEnhancedPhotoUrl
    AI->>DB: UPDATE survey_photos SET ai_enhanced_photo_url = ..., ai_status = 'COMPLETED'
    
    Note over DB,S: THÔNG BÁO HOÀN TẤT CHO CLIENT
    AI->>GW: Publish WebSocket Event: {photoId, status: 'COMPLETED'}
    GW-->>S: Push Notification: "Ảnh mặt đứng đã được AI nắn phẳng chuẩn CAD"
```

---

### 1.4. Sequence 1.4: Khảo Sát Phase 2 Theo Vị Trí Đứng & Động Cơ Đối Soát Delta ($\Delta$ Engine)

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    participant GW as API Gateway
    participant P2S as Phase 2 Survey Service
    participant DE as Delta Comparison Engine
    participant FS as S3 Storage
    participant DB as PostgreSQL 16

    Note over S,DB: 1. TRUY XUẤT DỮ LIỆU GĐ1 THEO VỊ TRÍ ĐỨNG
    S->>GW: GET /api/v1/parcels/{parcelId}/phase2/zones?floor=Lầu 1&room=Phòng ngủ 1
    GW->>P2S: getZonesByLocation(parcelId, floor, room)
    P2S->>DB: Query Phase 1 Zones & Defects matching (floor, room)
    DB-->>P2S: Return Zone Z-02 (CTX Photo, Pins: D-02)
    P2S-->>S: 200 OK (Render Zone Z-02, Photo CTX + Ghim D-02 màu vàng)

    Note over S,DB: 2. ĐỐI SOÁT GHIM CŨ (D-02)
    S->>GW: PUT /api/v1/phase2/defects/{d02Id}/verify (w2=0.8mm, L2=650mm, Status=WIDENED, CU Photo)
    GW->>FS: Upload D02-CU Phase 2
    GW->>DE: computeDelta(d02Id, w2, L2)
    DE->>DB: SELECT w1, L1 FROM defect_items WHERE id = d02Id
    DE->>DE: Compute Δw = 0.8 - 0.5 = +0.3mm, ΔL = +150mm
    DE->>DB: UPDATE defect_items SET phase2_w = 0.8, delta_w = 0.3, evolution = 'WIDENED'
    DB-->>S: 200 OK (Ghim D-02 đổi sang màu Cam Cảnh báo)

    Note over S,DB: 3. CHẤM THÊM VẾT NỨT MỚI TRÊN VÙNG CŨ (Z-02)
    S->>S: Chạm tay lên ảnh Photo CTX cũ tại vị trí vết nứt mới
    S->>GW: POST /api/v1/phase2/zones/{z02Id}/defects (Pin X/Y, CU Photo, w2=1.0mm, L2=400mm)
    GW->>FS: Upload D04-CU Mới
    GW->>DB: INSERT INTO defect_items (code='D-04', is_new_in_phase2=true, evolution='NEW_RECORDED')
    DB-->>S: 201 Created (Thêm ghim Đỏ D-04 mới)

    Note over S,DB: 4. TẠO VÙNG MỚI (Z-new) KHI XUẤT HIỆN KHU VỰC MỚI
    S->>GW: POST /api/v1/phase2/reports/{reportId}/zones (Floor=Gác lửng, CTX Photo)
    GW->>FS: Upload Z04-CTX Mới
    GW->>DB: INSERT INTO damage_zones (code='Z-04', is_new_in_phase2=true)
    DB-->>S: 201 Created (Tạo Vùng Z-04 Mới ➔ Cho phép thả ghim D-05)

    Note over S,DB: 5. TỔNG HỢP DELTA & PHÁN QUYẾT BỒI THƯỜNG
    S->>GW: POST /api/v1/phase2/reports/{reportId}/summarize-delta
    GW->>DE: evaluateCompensation(reportId)
    DE->>DB: Aggregate all defect deltas & new defects count
    DE->>DE: Calculate ΔECS & Verdict (NO_IMPACT | COSMETIC | STRUCTURAL)
    DE->>DB: UPDATE phase2_survey_reports SET compensation_verdict = 'STRUCTURAL_IMPACT'
    DB-->>S: 200 OK (Hiển thị Bảng tổng kết so sánh Phase 1 vs Phase 2)
```

---

### 1.5. Sequence 1.5: Biến Động Ranh Thửa & Thuật Toán Cấp Dải Số Mở Rộng Bất Biến (UC-02)

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    participant GW as API Gateway
    participant MS as Mutation Service
    participant DB as PostgreSQL 16 (PostGIS)

    S->>S: Bước 5: Đi hết các phòng, phát hiện nhà chia tách 2 căn
    S->>S: Bật Polygon Split Tool vẽ đường phân chia thành 2 polygon con
    S->>GW: POST /api/v1/mutations/propose (originalParcelId: 'B-00002', [poly1, poly2], type='SPLIT', reason)
    
    GW->>MS: processMutationProposal(...)
    MS->>DB: Lấy số hiệu tiếp theo từ Kho số Mở rộng (Kho số > 07000)
    DB-->>MS: Return mã mới: 'B-07001' và 'B-07002'
    
    MS->>DB: INSERT INTO parcel_mutation_events<br>(mutation_code, type='SPLIT', source_id='B-00002', result_ids=['B-07001', 'B-07002'], status='PROPOSED')
    MS->>DB: UPDATE parcels SET lifecycle_status = 'PENDING_MUTATION_APPROVAL' WHERE id = 'B-00002'
    MS->>DB: INSERT INTO parcels (code='B-07001', lifecycle_status='PENDING_MUTATION_APPROVAL')
    MS->>DB: INSERT INTO parcels (code='B-07002', lifecycle_status='PENDING_MUTATION_APPROVAL')
    
    DB-->>MS: Commit Transaction
    MS-->>GW: 201 Created (mutationId, newCodes: ['B-07001', 'B-07002'])
    GW-->>S: 201 Created (Hiển thị 2 thửa mới trên PWA, các thửa B-00003, B-00005... giữ nguyên 100%)
```

---

## 2. PHÂN HỆ QUẢN TRỊ PHÂN KHU (`ZONE_ADMIN`)

---

### 2.1. Sequence 2.1: Phân Công Nhiệm Vụ Khảo Sát Trên Bản Đồ GIS (Task Dispatching - UC-01)

```mermaid
sequenceDiagram
    autonumber
    actor A as Zone Admin (Web Portal)
    participant GW as API Gateway
    participant TS as Task Assignment Service
    participant DB as PostgreSQL 16
    actor S as Surveyor (Mobile PWA)

    A->>GW: GET /api/v1/admin/parcels/unassigned?zoneId=ZONE_S9
    GW->>DB: SELECT * FROM parcels WHERE zone_id = 'ZONE_S9' AND survey_status = 'NOT_SURVEYED'
    DB-->>A: Return Danh sách thửa đất chưa phân công
    
    A->>A: Chọn danh sách 5 thửa đất trên Bản đồ GIS
    A->>GW: POST /api/v1/admin/tasks/assign (parcelIds, surveyorId, deadline, notes)
    GW->>TS: dispatchTasks(parcelIds, surveyorId, deadline, notes)
    TS->>DB: INSERT INTO task_assignments (parcel_id, surveyor_id, deadline, status='ASSIGNED')
    DB-->>TS: 201 Created
    
    TS->>GW: Trigger Push Notification
    GW-->>S: WebSocket / Push Notification: "Bạn được giao 5 thửa đất mới tại Ga S9"
    GW-->>A: 200 OK (Giao việc thành công)
```

---

### 2.2. Sequence 2.2: Thẩm Định Hồ Sơ Split-Pane & Duyệt Biến Động Ranh Thửa (UC-04)

```mermaid
sequenceDiagram
    autonumber
    actor A as Zone Admin (Web Portal)
    participant GW as API Gateway
    participant AS as Audit Service
    participant MS as Mutation Service
    participant DB as PostgreSQL 16

    A->>GW: GET /api/v1/admin/reports/{reportId}/audit-view
    GW->>AS: getAuditSplitPaneData(reportId)
    AS->>DB: Query Report, CTX+CU Photos, Defects, Mutation Proposal
    DB-->>AS: Return Full Audit Payload
    AS-->>A: 200 OK (Render Split-Pane: Trái Sơ đồ & Điểm số, Phải Cặp ảnh soi kính lúp 400%)

    alt Có Đề xuất Biến động Tách Thửa Đất
        A->>A: Mở Tab So sánh Đa giác ranh cũ vs ranh mới
        A->>GW: POST /api/v1/admin/mutations/{mutationId}/approve
        GW->>MS: approveMutation(mutationId, adminId)
        MS->>DB: UPDATE parcel_mutation_events SET status = 'APPROVED'
        MS->>DB: UPDATE parcels SET lifecycle_status = 'SPLIT_DEPRECATED' WHERE id = 'B-00002'
        MS->>DB: UPDATE parcels SET lifecycle_status = 'ACTIVE' WHERE id IN ('B-07001', 'B-07002')
        DB-->>MS: Transaction Committed
        MS-->>A: 200 OK (Đã kích hoạt chính thức ranh đất mới lên GIS Master)
    end
```

---

### 2.3. Sequence 2.3: Phê Duyệt Báo Cáo & Xuất Bản PDF/A Chính Thức (UC-04)

```mermaid
sequenceDiagram
    autonumber
    actor A as Zone Admin (Web Portal)
    participant GW as API Gateway
    participant AS as Audit Service
    participant PDF as PDF/A Generation Engine
    participant FS as S3 Storage
    participant DB as PostgreSQL 16
    actor S as Surveyor (Mobile PWA)

    A->>A: Soi kính lúp 400% ảnh CU đạt chuẩn ➔ Bấm phím tắt 'A' (Phê duyệt)
    A->>GW: POST /api/v1/admin/reports/{reportId}/approve (engineeringJudgementNotes if any)
    GW->>AS: approveSurveyReport(reportId, adminId, notes)
    
    AS->>DB: UPDATE base_survey_reports SET status = 'APPROVED', approved_at = NOW()
    AS->>DB: UPDATE parcels SET survey_status = 'APPROVED'
    
    AS->>PDF: generateOfficialPdfReport(reportId)
    PDF->>DB: Fetch Report Data, High-res Photos, AI Rectified Facade
    PDF->>PDF: Biên tập tài liệu PDF/A chuẩn lưu trữ quốc tế có Watermark Chữ ký số
    PDF->>FS: Upload file (REPORT_B00105_PHASE1_OFFICIAL.pdf)
    FS-->>PDF: Return reportPdfDownloadUrl
    
    PDF->>DB: UPDATE base_survey_reports SET file_download_url = reportPdfDownloadUrl
    DB-->>A: 200 OK (Báo cáo đã duyệt & Xuất bản thành công)
    
    AS-->>S: Push Notification: "Báo cáo thửa B-XXXXX đã được Zone Admin phê duyệt"
```

---

### 2.4. Sequence 2.4: Trả Về Báo Cáo & Tự Động Rollback Ranh Đất (UC-04)

```mermaid
sequenceDiagram
    autonumber
    actor A as Zone Admin (Web Portal)
    participant GW as API Gateway
    participant AS as Audit Service
    participant MS as Mutation Service
    participant DB as PostgreSQL 16
    actor S as Surveyor (Mobile PWA)

    A->>A: Phát hiện ảnh CU thiếu thước đo ➔ Bấm phím tắt 'R' (Trả về)
    A->>GW: POST /api/v1/admin/reports/{reportId}/reject (reason: "Ảnh CU D-02 thiếu thước đo vạch mm")
    GW->>AS: rejectSurveyReport(reportId, adminId, reason)
    
    AS->>DB: UPDATE base_survey_reports SET status = 'REJECTED', rejection_reason = reason
    AS->>DB: UPDATE parcels SET survey_status = 'REJECTED'
    
    alt Nếu có Đề xuất Biến động Tách Thửa đi kèm
        AS->>MS: rollbackMutation(mutationId)
        MS->>DB: UPDATE parcel_mutation_events SET status = 'REJECTED'
        MS->>DB: UPDATE parcels SET lifecycle_status = 'MUTATION_VOID' WHERE id IN ('B-07001', 'B-07002')
        MS->>DB: UPDATE parcels SET lifecycle_status = 'ACTIVE' WHERE id = 'B-00002'
    end
    
    DB-->>A: 200 OK (Đã trả về báo cáo & Rollback dữ liệu)
    AS-->>S: Push Notification & Red Alert: "Báo cáo B-XXXXX bị trả về: Ảnh CU D-02 thiếu thước đo"
```

---

### 2.5. Sequence 2.5: Đóng Gói & Xuất Bộ Hồ Sơ Báo Cáo Phân Khu Hàng Loạt (UC-06)

```mermaid
sequenceDiagram
    autonumber
    actor A as Zone Admin (Web Portal)
    participant GW as API Gateway
    participant BE as Batch Export Worker
    participant FS as S3 Storage
    participant DB as PostgreSQL 16

    A->>GW: POST /api/v1/reports/batch-export (zoneId='ZONE_S9', dateRange, format='PDF_BOOK_COMPILATION')
    GW->>BE: enqueueBatchJob(zoneId, dateRange, format)
    GW-->>A: 202 Accepted (Tiến trình đóng gói đang chạy nền...)

    Note over BE,DB: TIẾN TRÌNH WORKER CHẠY NỀN (BACKGROUND BATCH EXPORT)
    BE->>DB: SELECT * FROM base_survey_reports WHERE zone_id = 'ZONE_S9' AND status = 'APPROVED'
    DB-->>BE: Return 150 Approved Reports (Được sắp xếp lý trình Km + Gom nhóm thửa phụ)
    
    BE->>BE: 1. Tạo Trang Bìa Pháp Lý & Mục Lục Điện Tử Tự Động
    BE->>BE: 2. Render Bản Đồ GIS Tổng Hợp Toàn Phân Khu Ga S9
    BE->>BE: 3. Lập Bảng Kê Danh Mục 150 Thửa Đất & Bảng Tổng Hợp Điểm Rủi Ro ECS/VI
    BE->>BE: 4. Ghép nối 150 file PDF Đơn Lẻ thành 1 Tập Hồ Sơ Duy Nhất (PDF Book)
    BE->>BE: 5. Tính mã băm Checksum SHA-256 chống làm giả tài liệu
    
    BE->>FS: Upload Tập Hồ Sơ Hoàn Chỉnh (Dossier_Zone_S9_202609.pdf)
    FS-->>BE: Return batchFileDownloadUrl
    
    BE->>DB: INSERT INTO compiled_report_batches<br>(zone_id, batch_code, file_url, checksum_sha256, is_published_to_guests=true)
    
    BE-->>A: WebSocket Push Event: "Bộ Hồ Sơ Phân Khu Ga S9 (150 Thửa) Đã Đóng Gói Xong"
```

---

## 3. PHÂN HỆ TỔNG QUẢN TRỊ TOÀN TUYẾN (`SUPER_ADMIN`)

---

### 3.1. Sequence 3.1: Quản Trị Người Dùng & Cập Nhật Lớp Bản Đồ GIS Tim Tuyến

```mermaid
sequenceDiagram
    autonumber
    actor SA as Super Admin (Master Web)
    participant GW as API Gateway
    participant US as User Service
    participant GS as GIS Map Service
    participant DB as PostgreSQL 16 (PostGIS)

    Note over SA,DB: 1. QUẢN LÝ TÀI KHOẢN NGƯỜI DÙNG
    SA->>GW: POST /api/v1/admin/users (fullName, email, role='ZONE_ADMIN', zoneId='ZONE_S9')
    GW->>US: createUser(...)
    US->>DB: INSERT INTO users (username, password_hash, full_name, role, zone_id, status='ACTIVE')
    DB-->>SA: 201 Created

    Note over SA,DB: 2. CẬP NHẬT LỚP GIS TIM TUYẾN & RANH MẶT BẰNG METRO 2
    SA->>GW: POST /api/v1/admin/gis/layers/metro-alignment (GeoJSON File: Ga S1 ➔ Ga S11)
    GW->>GS: updateMetroAlignmentLayer(geoJson)
    GS->>GS: Validate WGS84 coordinates & Topology
    GS->>DB: UPDATE metro_zones SET boundary_geojson = ..., centerline_geojson = ...
    DB-->>SA: 200 OK (Đã cập nhật bản đồ GIS toàn tuyến)
```

---

## 4. PHÂN HỆ NHÀ THẦU & KHÁCH TRA CỨU (`CONTRACTOR_GUEST`)

---

### 4.1. Sequence 4.1: Tra Cứu Bản Đồ GIS Quy Hoạch & Tải Tập Hồ Sơ Đã Công Bố (UC-05 & UC-06)

```mermaid
sequenceDiagram
    autonumber
    actor G as Contractor / Guest Viewer
    participant GW as API Gateway
    participant GS as Guest Access Service
    participant FS as S3 Storage
    participant DB as PostgreSQL 16

    G->>GW: GET /api/v1/guest/gis-map?shareToken=TOKEN_ABC&passcode=123456
    GW->>GS: authenticateGuest(shareToken, passcode)
    GS->>DB: SELECT * FROM guest_share_links WHERE share_token = 'TOKEN_ABC'
    DB-->>GS: Valid (Expires in 30 days)
    
    GS->>DB: SELECT id, project_parcel_code, owner_name, vi_class, polygon_geojson, survey_status<br>FROM parcels WHERE zone_id = 'ZONE_S9' AND survey_status = 'APPROVED'
    DB-->>GS: Return Published Parcels Layer
    GS-->>G: 200 OK (Render Bản đồ GIS tương tác, các lô đất xanh lá đã duyệt)

    Note over G,DB: TẢI TẬP HỒ SƠ BÁO CÁO ĐÃ CÔNG BỐ
    G->>GW: GET /api/v1/guest/dossiers/{batchId}/download
    GW->>GS: getPublishedDossierStream(batchId)
    GS->>DB: SELECT file_download_url, checksum_sha256 FROM compiled_report_batches WHERE id = batchId AND is_published_to_guests = true
    DB-->>GS: Return File URL & Checksum SHA-256
    
    GS->>FS: Get File Stream
    FS-->>G: Download Tập Hồ Sơ Hoàn Chỉnh (Dossier_Zone_S9_202609.pdf)
```

---

## 5. BẢNG ÁNH XẠ TOÀN BỘ 14 REST API ENDPOINTS

| STT | Method | Endpoint URL | Xử lý nghiệp vụ chính | Đối tượng sử dụng |
| :---: | :---: | :--- | :--- | :--- |
| 1 | `POST` | `/api/v1/attendance/check-in` | Check-in chấm công GPS + Chụp ảnh Selfie | `SURVEYOR` |
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
