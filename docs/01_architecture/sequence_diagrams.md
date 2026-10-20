# Đặc Tả Chi Tiết Sơ Đồ Tuần Tự Theo Từng Đối Tượng (Sequence Diagrams Specification)

> [!IMPORTANT]
> **TÀI LIỆU ĐẶC TẢ SƠ ĐỒ TUẦN TỰ (UML SEQUENCE DIAGRAMS) ĐỒNG BỘ 100% VỚI HỆ THỐNG API & STATE MACHINE:**
> Toàn bộ luồng tương tác giữa Actors (`SURVEYOR`, `ZONE_ADMIN`, `SUPER_ADMIN`, `CONTRACTOR`), API Gateway, Backend Services, AI Workers, S3 Storage và PostgreSQL/PostGIS đã được cập nhật đầy đủ, bao gồm: Luồng kiểm soát Khảo sát Vắng nhà (Absentee Survey Control Gate), Khảo sát và xuất báo cáo độc lập cho Căn hộ Chung cư (Multi-Unit Flow), tính điểm kỹ thuật $E_1 \dots E_6, V_1 \dots V_6$ và quản lý trạng thái `EXPORTED`.

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

### 1.2. Sequence 1.2: Quét Cạn Thửa Đất Ad-hoc & Khảo Sát Vắng Nhà (Absentee Survey Control Gate)

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    participant GW as API Gateway
    participant PS as Parcel Service
    participant FS as S3 Storage
    participant DB as PostgreSQL 16 (PostGIS)

    Note over S,DB: TÌNH HUỐNG 1: CHỦ NHÀ ĐI VẮNG / KHÓA CỬA / TỪ CHỐI
    S->>S: Bấm '🏠 Báo Vắng Nhà' tại Bước 1 (Kích hoạt Chế độ Khảo sát Vắng)
    S->>S: Hoàn thành 100% dữ liệu ngoại quan Bước 1:<br>• Số nhà & Tuyến đường<br>• Nhóm đối tượng (General/Important/Critical)<br>• Khảo sát tiếp giáp 3 hướng<br>• Chụp đủ 4 ảnh P-01..P-04<br>• Nhập lý do vắng mặt
    
    S->>GW: POST /api/v1/surveys/phase1/submit-absentee<br>(parcelId, completeStep1SurveyData, photoP01..P04, absenteeReason)
    GW->>PS: validateAndSubmitAbsentee(surveyData)
    PS->>PS: Kiểm tra điều kiện Gate: Đã đủ 100% thông tin Bước 1?
    PS->>FS: Upload bộ 4 ảnh P01-P04
    FS-->>PS: Return photoUrls
    PS->>DB: UPDATE parcels SET survey_status = 'POSTPONED_ABSENT', attempt_count = attempt_count + 1<br>INSERT INTO survey_absence_logs (parcel_id, reason, is_step1_complete: true)
    DB-->>PS: Updated
    PS-->>S: 201 Created (Thửa đất chuyển sang Màu Tím POSTPONED_ABSENT trên bản đồ)

    Note over S,DB: TÌNH HUỐNG 2: TỰ NHẬN NHÀ LIỀN KỀ ĐỂ QUÉT CẠN (AD-HOC SWEEP PICK)
    S->>GW: GET /api/v1/parcels/nearby?lat=10.7981&lng=106.6456&radius=150
    GW->>PS: findNearbyUnsurveyedParcels(...)
    PS->>DB: ST_DWithin(geom, current_location, 150) AND status = 'NOT_SURVEYED'
    DB-->>PS: Return nearby parcels (B-00106, B-00107...)
    PS-->>S: 200 OK (Danh sách nhà lân cận có thể tự nhận)

    S->>GW: POST /api/v1/parcels/p-00106/start-survey<br>(phase: 'PHASE_1', claimReason: 'Nhà 00105 vắng mặt')
    GW->>PS: startAdHocSurvey(parcelId, surveyorId)
    PS->>DB: BEGIN TRANSACTION; Check lock; INSERT INTO base_survey_reports; UPDATE parcels SET status = 'IN_PROGRESS'; COMMIT;
    DB-->>PS: Return reportId: 'rep-p1-00106'
    PS-->>S: 201 Created (Thửa đất chuyển sang Màu Vàng & Mở form khảo sát 9 bước)
```

---

### 1.3. Sequence 1.3: Luồng Khảo Sát Giai Đoạn 1 (Phase 1 Baseline 9 Bước Chuẩn)

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    participant GW as API Gateway
    participant SS as Survey Engine Service
    participant AI as AI Homography Worker
    participant FS as S3 Storage
    participant DB as PostgreSQL 16

    Note over S,DB: 1. ẢNH ĐỊNH DANH P01-P04 + ĐA GIÁC FACADE + SƠ BỘ LÚN NGHIÊNG BƯỚC 1
    S->>GW: POST /api/v1/reports/phase1/{id}/identification-photos<br>(P01..P04, polygonPoints, splitLines, preliminaryTiltLevel)
    GW->>FS: Upload raw photos (P01..P04)
    FS-->>GW: Return URLs
    GW->>DB: INSERT INTO survey_photos (raw_urls, polygon_json, split_lines_json)
    GW->>AI: Enqueue job nắn thẳng mặt đứng P-02 chuẩn CAD
    GW-->>S: 201 Created

    Note over S,DB: 2. PHỎNG VẤN KẾT CẤU & CÂY QUYẾT ĐỊNH CAT MÓNG 5 MỨC & E5 CỘNG HƯỞNG
    S->>GW: PUT /api/v1/reports/phase1/{id}/specs<br>(usageFunction, floors, structureSystem, foundationCatScore: 1..5, historyInterview: E5)
    GW->>SS: calculateE5Resonance(historyScores) -> If >=2 scores > 2 and equal then E5 = 4
    GW->>DB: INSERT INTO building_specifications, historical_sensitivities
    GW-->>S: 200 OK

    Note over S,DB: 3. KHẢO SÁT CÁC TẦNG: VÙNG Z-xx & GHIM D-xx (E2, E4, E6)
    S->>GW: POST /api/v1/reports/phase1/{id}/zones (Floor, Room, CTX Photo, Burland 0-5, repairNeeded)
    GW->>FS: Upload CTX Photo
    GW->>DB: INSERT INTO damage_zones (zone_code='Z-01', ctx_url, burland_grade=2)
    GW-->>S: 201 Created

    S->>GW: POST /api/v1/reports/phase1/zones/{zId}/defects (Pin X/Y, CU Photo có thước mm, w_max, L, E2, E4)
    GW->>FS: Upload CU Photo
    GW->>DB: INSERT INTO defect_items (defect_code='D-01', pin_x, pin_y, cu_url, w_max=0.85, l=650)
    GW-->>S: 201 Created

    Note over S,DB: 4 & 5. TỔNG HỢP BURLAND E1 & KHẢO SÁT LÚN NGHIÊNG VÕNG 4 LEVEL (E3)
    S->>GW: PUT /api/v1/reports/phase1/{id}/deformation<br>(diffSettlementLevel, buildingTiltLevel, beamSaggingLevel, measurements)
    GW->>SS: calculateE3Score(lSettlement, lTilt, lSag) -> Max Level (0..4)
    GW->>DB: INSERT INTO deformation_assessments
    GW-->>S: 200 OK

    Note over S,DB: 6. PHẠM VI TIẾP CẬN & BIẾN ĐỘNG RANH GIS (MATCH / SPLIT / MERGE)
    S->>GW: PUT /api/v1/reports/phase1/{id}/scope (coverage, limitations, mutationProposal)
    GW->>DB: UPDATE parcels SET footprint_polygon = geom, is_mutation_pending = true
    GW-->>S: 200 OK

    Note over S,DB: 7, 8 & 9. AUTO SCORING ECS/VI, DASHBOARD & NỘP HỒ SƠ
    S->>GW: POST /api/v1/reports/phase1/{id}/calculate-scores
    GW->>SS: calculateEcsScore() & calculateViScore()
    SS->>DB: INSERT INTO risk_score_cards (total_ecs, ecs_class, total_vi, vi_class)
    SS-->>S: 200 OK (ECS: 7/24 - MEDIUM, VI: 2.15 - MEDIUM)

    S->>GW: POST /api/v1/reports/phase1/{id}/submit (ownerRemarks, 3-party signatures)
    GW->>FS: Upload Signatures
    GW->>DB: UPDATE base_survey_reports SET status = 'SUBMITTED', submitted_at = NOW()
    GW-->>S: 200 OK (Hồ sơ chuyển sang Chờ duyệt - Màu Xanh lơ)
```

---

### 1.4. Sequence 1.4: Khảo Sát & Xuất Báo Cáo Căn Hộ Chung Cư (Multi-Unit Apartment Workflow)

```mermaid
sequenceDiagram
    autonumber
    actor S as Surveyor (Mobile PWA)
    actor ZA as Zone Admin (Web Portal)
    participant GW as API Gateway
    participant US as Unit Survey Service
    participant ES as Export Service
    participant FS as S3 Storage
    participant DB as PostgreSQL 16

    Note over S,DB: 1. TRA CỨU DANH SÁCH CĂN HỘ CHUNG CƯ
    S->>GW: GET /api/v1/parcels/p-00128/units?floorLevel=Tầng 3
    GW->>DB: SELECT * FROM building_units WHERE parcel_id = 'p-00128' AND floor_level = 'Tầng 3'
    DB-->>GW: Return units list (P-301, P-302, P-304...)
    GW-->>S: 200 OK (Hiển thị Ma trận Căn hộ theo tầng)

    Note over S,DB: 2. KHẢO SÁT & NỘP HỒ SƠ RIÊNG CHO CĂN 304
    S->>S: Mở phiếu Căn P-304 (Kế thừa mặt tiền & móng Tòa nhà Master)
    S->>S: Khảo sát khuyết tật phòng ngủ, ban công căn 304 & Ký nhận chủ căn
    S->>GW: POST /api/v1/reports/phase1/units/u-304-b00128/submit (unitSurveyData, ownerSignature)
    GW->>US: submitUnitSurvey(...)
    US->>DB: UPDATE building_units SET survey_status = 'SUBMITTED', survey_data = jsonb
    DB-->>US: Updated
    US-->>S: 201 Created (Căn 304 chuyển trạng thái SUBMITTED)

    Note over ZA,DB: 3. THẨM ĐỊNH & XUẤT BÁO CÁO PHÁP LÝ RIÊNG CĂN 304
    ZA->>GW: POST /api/v1/admin/reports/units/u-304-b00128/approve
    GW->>DB: UPDATE building_units SET survey_status = 'APPROVED'
    GW-->>ZA: 200 OK

    ZA->>GW: POST /api/v1/reports/units/u-304-b00128/export
    GW->>ES: exportUnitReport(unitId)
    ES->>DB: Fetch Master Building Data + Unit 304 Defects & Signatures
    ES->>ES: Compile PDF: REPORT-B00128-U304.pdf & Calculate Checksum SHA-256
    ES->>FS: Upload REPORT-B00128-U304.pdf
    FS-->>ES: Return downloadUrl
    ES->>DB: UPDATE building_units SET survey_status = 'EXPORTED', exported_pdf_url = url, checksum_sha256 = hash<br>-- Kích hoạt trigger Data Freeze khóa cứng 100% dữ liệu
    DB-->>ZA: 200 OK (Căn 304 chuyển sang Màu Xanh Ngọc EXPORTED)
```

---

## 2. PHÂN HỆ TỔ TRƯỞNG & QUẢN TRỊ PHÂN KHU (`ZONE_ADMIN`)

```mermaid
sequenceDiagram
    autonumber
    actor ZA as Zone Admin (Web Portal)
    participant GW as API Gateway
    participant AR as Audit Rules Engine
    participant PDF as PDF/A Digital Signature Engine
    participant FS as S3 Storage
    participant DB as PostgreSQL 16

    Note over AR,DB: HỒ SƠ NỘP VỀ -> TỰ ĐỘNG QUÉT CẢNH BÁO GIAN LẬN
    AR->>DB: Check GPS distance (Chụp cách tâm nhà > 50m?)
    AR->>DB: Check Duration (Thời gian làm < 5 phút?)
    AR->>DB: Check Structural Critical Flag / Thiếu thước đo mm
    AR->>DB: INSERT INTO audit_alert_items (severity: 'HIGH', type: 'GPS_DISTANCE_DISCREPANCY')

    ZA->>GW: GET /api/v1/admin/reports/{id}/audit-view
    GW->>DB: Query Report Full Tree (Left: Cấu kiện + ECS/VI, Right: Cặp ảnh CTX/CU)
    DB-->>ZA: 200 OK (Mở Split-Pane, kích hoạt Kính lúp 400% soi thước đo)

    Note over ZA,DB: ZONE ADMIN PHÊ DUYỆT BÁO CÁO (PHÍM 'A')
    ZA->>GW: POST /api/v1/admin/reports/{id}/approve (judgementNotes)
    GW->>PDF: generateOfficialPdfA(reportId)
    PDF->>PDF: Apply Digital Signature + Watermark + Embed Checksum SHA-256
    PDF->>FS: Upload REPORT_B00105_PHASE1_OFFICIAL.pdf
    FS-->>PDF: Return officialPdfUrl
    GW->>DB: UPDATE base_survey_reports SET status = 'APPROVED', official_pdf_url = url; UPDATE parcels SET status = 'APPROVED_PHASE1'
    DB-->>ZA: 200 OK (Thửa đất chuyển sang Màu Xanh Lá trên bản đồ GIS)
```
