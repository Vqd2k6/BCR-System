# Đặc Tả Chi Tiết Sơ Đồ Tuần Tự Theo Từng Đối Tượng (Sequence Diagrams Specification)

> [!IMPORTANT]
> **TÀI LIỆU ĐẶC TẢ SƠ ĐỒ TUẦN TỰ (UML SEQUENCE DIAGRAMS) ĐỒNG BỘ 100% VỚI HỆ THỐNG API:**
> Toàn bộ luồng tương tác giữa Actors (`SURVEYOR`, `ZONE_ADMIN`, `SUPER_ADMIN`, `CONTRACTOR`), API Gateway, Backend Services, AI Workers, S3 Storage và PostgreSQL/PostGIS đã được cập nhật đầy đủ, loại bỏ các hố đen nghiệp vụ.

---

## 1. PHÂN HỆ CÁN BỘ KHẢO SÁT HIỆN TRƯỜNG (`SURVEYOR`)

---

### 1.1. Sequence 1.1: Chấm Công GPS Thực Địa & Phê Duyệt 2 Chiều (UC-02)

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    actor ZA as Zone Admin (Web Portal)
    participant GW as API Gateway
    participant AS as Attendance Service
    participant FS as S3 Object Storage
    participant DB as PostgreSQL 16 (PostGIS)

    S->>S: Bật GPS thiết bị thực địa
    S->>S: Chụp ảnh selfie tại hiện trường
    S->>GW: POST /api/v1/attendance/check-in<br>(zoneId, gpsLat, gpsLng, selfieFile, notes)
    
    GW->>AS: processCheckIn(...)
    AS->>DB: ST_Distance(ST_MakePoint(lng, lat), zone_center_geom)
    DB-->>AS: Return distanceMeters (35.4m)
    
    AS->>FS: uploadSelfie(selfieFile)
    FS-->>AS: Return selfieUrl
    
    AS->>DB: INSERT INTO timekeeping_checkins<br>(status: 'PENDING_VERIFICATION', distance_to_center: 35.4m)
    DB-->>AS: Return checkInId
    AS-->>GW: 201 Created
    GW-->>S: 201 Created (Mở quyền khảo sát hiện trường)

    Note over ZA,DB: ZONE ADMIN ĐỐI SOÁT & PHÊ DUYỆT CHẤM CÔNG
    ZA->>GW: GET /api/v1/admin/attendance?zoneId=ZONE_S9
    GW->>AS: listCheckIns(zoneId)
    AS->>DB: SELECT * FROM timekeeping_checkins WHERE zone_id = 'ZONE_S9'
    DB-->>AS: Return check-ins list (kèm cờ cảnh báo nếu > 500m)
    AS-->>ZA: 200 OK (Render danh sách chấm công, vị trí GPS & Selfie)

    ZA->>GW: POST /api/v1/admin/attendance/{id}/verify<br>(action: 'APPROVE', notes: 'Có mặt đúng giờ')
    GW->>AS: verifyAttendance(id, 'APPROVE')
    AS->>DB: UPDATE timekeeping_checkins SET status = 'APPROVED', verified_by = admin_id
    DB-->>AS: Updated
    AS-->>ZA: 200 OK (Ghi nhận ngày công hợp lệ)
```

---

### 1.2. Sequence 1.2: Quét Cạn Thửa Đất Ad-hoc & Ghi Nhận Vắng Nhà (UC-03)

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    participant GW as API Gateway
    participant PS as Parcel Service
    participant FS as S3 Storage
    participant DB as PostgreSQL 16 (PostGIS)

    Note over S,DB: TÌNH HUỐNG 1: CHỦ NHÀ ĐƯỢC GIAO ĐI VẮNG / KHÓA CỬA
    S->>S: Chụp ảnh cửa khóa / hiện trạng vắng nhà
    S->>GW: POST /api/v1/parcels/{id}/record-absence<br>(absenceReason: 'HOMEOWNER_ABSENT', photoProofFile, notes)
    GW->>PS: recordAbsence(...)
    PS->>FS: Upload proof photo
    FS-->>PS: Return proofPhotoUrl
    PS->>DB: INSERT INTO survey_absence_logs, UPDATE parcels SET status = 'POSTPONED_ABSENT', attempt_count = attempt_count + 1
    DB-->>PS: Updated
    PS-->>S: 201 Created (Thửa đất chuyển sang Màu Tím trên bản đồ GIS)

    Note over S,DB: TÌNH HUỐNG 2: TỰ NHẬN NHÀ LIỀN KỀ ĐỂ QUÉT CẠN (AD-HOC PICK)
    S->>GW: GET /api/v1/parcels/nearby?lat=10.7981&lng=106.6456&radius=150
    GW->>PS: findNearbyUnsurveyedParcels(...)
    PS->>DB: ST_DWithin(geom, current_location, 150) AND status = 'NOT_SURVEYED'
    DB-->>PS: Return nearby parcels (B-00106, B-00107...)
    PS-->>S: 200 OK (Danh sách nhà lân cận có thể tự nhận)

    S->>GW: POST /api/v1/parcels/p-00106/start-survey<br>(phase: 'PHASE_1', claimReason: 'Nhà 00105 vắng mặt')
    GW->>PS: startAdHocSurvey(parcelId, surveyorId)
    PS->>DB: BEGIN TRANSACTION; Check lock; INSERT INTO base_survey_reports; UPDATE parcels SET status = 'IN_PROGRESS'; COMMIT;
    DB-->>PS: Return reportId: 'rep-p1-00106'
    PS-->>S: 201 Created (Thửa đất chuyển sang Màu Vàng & Mở form khảo sát ngay)
```

---

### 1.3. Sequence 1.3: Luồng Khảo Sát Giai Đoạn 1 (Phase 1 Baseline 9 Bước)

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    participant GW as API Gateway
    participant SS as Survey Service
    participant AI as AI Homography Worker
    participant FS as S3 Storage
    participant DB as PostgreSQL 16

    Note over S,DB: 1. ẢNH ĐỊNH DANH P01-P04 + POLYGON N ĐỈNH + PHÂN TẦNG
    S->>GW: POST /api/v1/reports/phase1/{id}/identification-photos<br>(P01..P04, p02PolygonPoints: [N điểm], p02FloorSplitLines: [...])
    GW->>FS: Upload raw photos (P01..P04)
    FS-->>GW: Return URLs
    GW->>DB: INSERT INTO survey_photos (raw_urls, polygon_json, split_lines_json)
    GW->>AI: Enqueue job nắn thẳng mặt đứng P-02 chuẩn CAD (aiPerspectiveMatrix)
    GW-->>S: 201 Created (p02AiJobId)

    Note over S,DB: 2. PHỎNG VẤN KẾT CẤU & MÓNG CAT 1-5 & LỊCH SỬ E5
    S->>GW: PUT /api/v1/reports/phase1/{id}/specs (Frame, Floors, Foundation CAT, History E5)
    GW->>DB: INSERT INTO building_specifications, historical_sensitivities
    GW-->>S: 200 OK

    Note over S,DB: 3. KHẢO SÁT TỪNG TẦNG: VÙNG Z-xx & GHIM D-xx
    S->>GW: POST /api/v1/reports/phase1/{id}/zones (Floor, Room, CTX Photo, Burland 0-5)
    GW->>FS: Upload CTX Photo
    GW->>DB: INSERT INTO damage_zones (zone_code='Z-01', ctx_url, burland_grade=2)
    GW-->>S: 201 Created (zoneId: 'z-01')

    S->>GW: POST /api/v1/reports/phase1/zones/{zId}/defects (Pin X/Y, CU Photo có thước mm, w_max, L, E2, E4)
    GW->>FS: Upload CU Photo
    GW->>DB: INSERT INTO defect_items (defect_code='D-01', pin_x, pin_y, cu_url, w_max=0.85, l=650)
    GW-->>S: 201 Created (defectId: 'def-01')

    Note over S,DB: 4. ĐO LÚN NGHIÊNG, SƠ ĐỒ SKETCH & RANH GIS BƯỚC 5
    S->>GW: PUT /api/v1/reports/phase1/{id}/deformation (TiltX, TiltY, FloorSlope, Deflection)
    GW->>DB: INSERT INTO deformation_assessments
    GW-->>S: 200 OK

    S->>GW: PUT /api/v1/parcels/{id}/footprint (footprintPolygonGeoJson, measuredArea)
    GW->>DB: UPDATE parcels SET footprint_polygon = geom
    GW-->>S: 200 OK

    Note over S,DB: 5. AUTO SCORING ECS/VI & NỘP HỒ SƠ CÓ CHỮ KÝ
    S->>GW: POST /api/v1/reports/phase1/{id}/calculate-scores
    GW->>SS: calculateEcsAndVi(reportId)
    SS->>SS: Sum E1..E6/24 -> ECS Score & VI Class
    SS->>DB: INSERT INTO risk_score_cards
    SS-->>S: 200 OK (ECS: 6/24 - MEDIUM, VI: MEDIUM)

    S->>GW: POST /api/v1/reports/phase1/{id}/submit (ownerRemarks, surveyorSignature, ownerSignature)
    GW->>FS: Upload Signatures
    GW->>DB: UPDATE base_survey_reports SET status = 'SUBMITTED', submitted_at = NOW()
    GW-->>S: 200 OK (Hồ sơ chuyển sang Chờ duyệt - Màu Cam)
```

---

### 1.4. Sequence 1.4: Khảo Sát Giai Đoạn 2 (Phase 2 Pre-Construction Delta Verification)

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    participant GW as API Gateway
    participant P2S as Phase 2 Service
    participant FS as S3 Storage
    participant DB as PostgreSQL 16

    S->>GW: POST /api/v1/reports/phase2 (parcelId, phase1ReportId, witnessMembers)
    GW->>P2S: initPhase2Report(parcelId, phase1Id)
    P2S->>DB: Inherit Phase 1 Baseline -> CREATE base_survey_reports (phase: 'PHASE_2')
    DB-->>P2S: Return reportId: 'rep-p2-00105'
    P2S-->>S: 201 Created

    Note over S,DB: ĐỐI SOÁT THEO VỊ TRÍ ĐỨNG (TẦNG & PHÒNG)
    S->>GW: GET /api/v1/parcels/{id}/phase2/zones?floor=Tầng 1&room=Phòng khách
    GW->>DB: SELECT * FROM damage_zones WHERE report_id = phase1_id AND floor = 'Tầng 1'
    DB-->>GW: Return CTX photo và mảng ghim cũ (D-01: w1=0.85mm, L1=650mm)
    GW-->>S: 200 OK (Render ảnh CTX và ghim cũ để đối soát)

    S->>GW: PUT /api/v1/phase2/defects/def-01/verify<br>(w2=1.20mm, L2=800mm, evolutionStatus='WIDENED', cuPhotoFile)
    GW->>FS: Upload CU Photo GĐ2
    GW->>P2S: calculateDelta(w1=0.85, w2=1.20) -> delta_w = +0.35mm
    P2S->>DB: UPDATE defect_items SET phase2_w = 1.20, delta_w = 0.35, status = 'WIDENED'
    DB-->>S: 200 OK (Ghim đổi màu Cam - Phát triển)

    Note over S,DB: CHẤM THÊM VẾT NỨT MỚI GĐ2
    S->>GW: POST /api/v1/phase2/zones/{zId}/defects (Pin X/Y, CU Photo, w=0.65mm, screeningCategory)
    GW->>DB: INSERT INTO defect_items (defect_code='D-04 (MỚI)', is_new_phase2=true)
    DB-->>S: 201 Created (Ghim màu Đỏ mới)

    Note over S,DB: KIỂM TRA QUALITY GATE 10 TIÊU CHÍ & KÝ TÊN 4 BÊN
    S->>GW: GET /api/v1/reports/phase2/{id}/quality-gate
    GW->>P2S: verifyAppendixAChecklist(reportId)
    P2S-->>S: 200 OK (Checklist 10/10 PASSED)

    S->>GW: POST /api/v1/reports/phase2/{id}/submit (4-party signatures: Owner, Contractor, 3rd Party, Witness)
    GW->>DB: UPDATE base_survey_reports SET status = 'SUBMITTED'
    GW-->>S: 200 OK
```

---

## 2. PHÂN HỆ TỔ TRƯỞNG & QUẢN TRỊ PHÂN KHU (`ZONE_ADMIN`)

---

### 2.1. Sequence 2.1: Động Cơ Cảnh Báo Bất Thường & Thẩm Định Split-Pane Phê Duyệt (UC-06)

```mermaid
sequenceDiagram
    autonumber
    actor ZA as Zone Admin (Web Portal)
    participant GW as API Gateway
    participant AR as Audit Rules Engine
    participant PDF as PDF/A Digital Signature Engine
    participant FS as S3 Storage
    participant DB as PostgreSQL 16

    Note over AR,DB: HỒ SƠ NỘP VỀ -> TỰ ĐỘNG QUÉT CẢNH BÁO
    AR->>DB: Check GPS distance (Chụp cách tâm nhà > 50m?)
    AR->>DB: Check Duration (Thời gian làm < 5 phút?)
    AR->>DB: Check Structural Critical Flag / Thiếu thước đo mm
    AR->>DB: INSERT INTO audit_alert_items (severity: 'HIGH', type: 'GPS_DISTANCE_DISCREPANCY')

    ZA->>GW: GET /api/v1/admin/reports/audit-alerts?zoneId=ZONE_S9
    GW->>DB: SELECT * FROM audit_alert_items WHERE is_resolved = false
    DB-->>ZA: 200 OK (Danh sách hồ sơ có cờ cảnh báo ưu tiên thẩm định)

    ZA->>GW: GET /api/v1/admin/reports/{id}/audit-view
    GW->>DB: Query Report Full Tree (Left: Cây cấu kiện + ECS/VI, Right: Cặp ảnh CTX/CU)
    DB-->>ZA: 200 OK (Mở giao diện Split-Pane, kích hoạt Kính lúp 400% soi thước đo)

    Note over ZA,DB: ZONE ADMIN PHÊ DUYỆT BÁO CÁO (PHÍM 'A')
    ZA->>GW: POST /api/v1/admin/reports/{id}/approve (judgementNotes)
    GW->>PDF: generateOfficialPdfA(reportId)
    PDF->>PDF: Apply Digital Signature + Watermark + Embed Checksum
    PDF->>FS: Upload REPORT_B00105_PHASE1_OFFICIAL.pdf
    FS-->>PDF: Return officialPdfUrl
    GW->>DB: UPDATE base_survey_reports SET status = 'APPROVED', official_pdf_url = url; UPDATE parcels SET status = 'APPROVED'
    DB-->>ZA: 200 OK (Thửa đất chuyển sang Màu Xanh Lá trên bản đồ GIS)
```

---

### 2.2. Sequence 2.2: Xuất Báo Cáo Có Chọn Lọc (Zone Selective Batch Export - UC-08)

```mermaid
sequenceDiagram
    autonumber
    actor ZA as Zone Admin (Web Portal)
    participant GW as API Gateway
    participant ES as Export Service
    participant PDFB as PDF Book Compilation Engine
    participant FS as S3 Storage
    participant DB as PostgreSQL 16

    ZA->>GW: POST /api/v1/reports/batch-export<br>(exportScope: 'SELECTED_LIST', selectedReportIds: ['rep-01', 'rep-02', 'rep-03'], format: 'PDF_BOOK_COMPILATION')
    
    GW->>ES: queueExportBatch(...)
    ES->>DB: INSERT INTO compiled_report_batches (status: 'QUEUED', batch_id: 'batch-s9-001')
    ES-->>GW: 202 Accepted (batchId)
    GW-->>ZA: 202 Accepted (Xếp hàng đợi xử lý nền)

    Note over ES,FS: TIẾN TRÌNH WORKER NỀN ĐÓNG GÓI TẬP HỒ SƠ
    ES->>DB: Fetch 3 approved PDF/A reports + GIS station mini-map + ECS Summary table
    ES->>PDFB: Compile 1 Single PDF Book (Cover page, Electronic Table of Contents, GIS Overview, 3 Reports)
    PDFB->>PDFB: Calculate Checksum SHA-256
    PDFB->>FS: Upload Dossier_Zone_S9_20260916.pdf
    FS-->>PDFB: Return downloadUrl
    ES->>DB: UPDATE compiled_report_batches SET status = 'COMPLETED', download_url = url, checksum_sha256 = 'e3b0c4...'

    ZA->>GW: GET /api/v1/reports/batch-export/batch-s9-001/status
    GW-->>ZA: 200 OK (status: 'COMPLETED', downloadUrl, checksumSha256)
```

---

## 3. PHÂN HỆ TỔNG QUẢN TRỊ TOÀN TUYẾN (`SUPER_ADMIN`)

---

### 3.1. Sequence 3.1: Quản Trị Vòng Đời Người Dùng & Điều Chuyển Ga (UC-07)

```mermaid
sequenceDiagram
    autonumber
    actor SA as Super Admin (Web Admin)
    participant GW as API Gateway
    participant US as User Management Service
    participant DB as PostgreSQL 16

    SA->>GW: POST /api/v1/admin/users (username, password, fullName, role: 'ZONE_ADMIN', zoneId: 'ZONE_S10')
    GW->>US: createUser(...)
    US->>US: Hash password (BCrypt salt rounds=12)
    US->>DB: INSERT INTO users (username, password_hash, full_name, role, assigned_zone_id, status: 'ACTIVE')
    DB-->>US: Return userId
    US-->>SA: 201 Created

    Note over SA,DB: ĐIỀU CHUYỂN GA & KHÓA TÀI KHOẢN
    SA->>GW: PUT /api/v1/admin/users/{id} (assignedZoneId: 'ZONE_S11', role: 'SURVEYOR')
    GW->>US: updateUserZone(userId, 'ZONE_S11')
    US->>DB: UPDATE users SET assigned_zone_id = 'ZONE_S11'
    DB-->>SA: 200 OK

    SA->>GW: PUT /api/v1/admin/users/{id}/status (status: 'SUSPENDED', reason: 'Vi phạm quy chế chấm công GPS')
    GW->>US: updateStatus(userId, 'SUSPENDED')
    US->>DB: UPDATE users SET status = 'SUSPENDED', status_reason = '...'
    DB-->>SA: 200 OK (Thu hồi ngay lập tức JWT Token hoạt động)
```

---

### 3.2. Sequence 3.2: Trung Tâm Quản Trị Xuất Báo Cáo Toàn Tuyến 11 Ga (UC-09)

```mermaid
sequenceDiagram
    autonumber
    actor SA as Super Admin (Web Admin)
    participant GW as API Gateway
    participant ES as Global Export Hub
    participant FS as S3 Storage
    participant DB as PostgreSQL 16

    SA->>GW: POST /api/v1/admin/reports/batch-export<br>(exportScope: 'GLOBAL_ALL_ZONES', format: 'PDF_BOOK_COMPILATION')
    GW->>ES: queueGlobalExport(...)
    ES->>DB: INSERT INTO compiled_report_batches (zone_id: 'ALL_ZONES', total_reports: 4210, status: 'QUEUED')
    ES-->>SA: 202 Accepted (batchId: 'batch-global-001')

    Note over SA,DB: GIÁM SÁT LỊCH SỬ & THU HỒI MẺ XUẤT
    SA->>GW: GET /api/v1/admin/reports/exports
    GW->>DB: SELECT * FROM compiled_report_batches ORDER BY created_at DESC
    DB-->>SA: 200 OK (Danh sách toàn bộ các đợt export toàn hệ thống kèm SHA-256 và trạng thái)

    SA->>GW: DELETE /api/v1/admin/reports/exports/batch-s9-001
    GW->>ES: revokeAndPurgeExport('batch-s9-001')
    ES->>FS: Delete file on S3
    ES->>DB: UPDATE compiled_report_batches SET status = 'REVOKED', download_url = NULL
    DB-->>SA: 200 OK (Thu hồi link tải thành công)
```
