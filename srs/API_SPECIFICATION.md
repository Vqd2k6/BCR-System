# ĐẶC TẢ CHI TIẾT HỆ THỐNG RESTFUL API (API SPECIFICATION & CONTRACT)
## HỆ THỐNG KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH - METRO SỐ 2 (BẾN THÀNH – THAM LƯƠNG)

> [!IMPORTANT]
> **CẤU TRÚC ĐẶC TẢ THEO VAI TRÒ NGƯỜI DÙNG & PHƯƠNG THỨC HTTP (ROLE-FIRST & METHOD-GROUPED):**
> Tài liệu này chuẩn hóa toàn bộ 100% các trường dữ liệu và quy trình nghiệp vụ thực địa theo 9 Bước Phase 1 và 9 Bước Phase 2, phân chia theo 4 nhóm đối tượng người dùng (`SURVEYOR`, `ZONE_ADMIN`, `SUPER_ADMIN`, `CONTRACTOR_GUEST`) và phân cụm theo các phương thức HTTP (`POST`, `GET`, `PUT`, `DELETE`).

---

## MỤC LỤC TỔNG QUAN

```text
├── 0. PHÂN HỆ XÁC THỰC CHUNG (COMMON AUTHENTICATION)
│   ├── POST /api/v1/auth/login
│   ├── POST /api/v1/auth/refresh-token
│   ├── GET  /api/v1/auth/me
│   └── POST /api/v1/auth/logout
│
├── 1. VAI TRÒ 1: CÁN BỘ KHẢO SÁT HIỆN TRƯỜNG (FIELD SURVEYOR)
│   ├── [POST] Endpoints (Tạo mới, Upload, Khởi tạo, Nộp hồ sơ Phase 1 & 2):
│   │   ├── /api/v1/attendance/check-in                      # Chấm công GPS thực địa
│   │   ├── /api/v1/reports/phase1                           # Khởi tạo hồ sơ Phase 1
│   │   ├── /api/v1/reports/phase1/{id}/identification-photos# Bước 1: 4 Ảnh P01-P04 + Polygon N điểm + Phân tầng
│   │   ├── /api/v1/reports/phase1/{id}/zones                # Bước 3: Tạo Vùng Z-xx + Ảnh CTX + Burland Grade
│   │   ├── /api/v1/reports/phase1/zones/{id}/defects        # Bước 3: Ghim D-xx + Ảnh CU có thước + E2/E4
│   │   ├── /api/v1/reports/phase1/{id}/sketch               # Bước 6: Upload sơ đồ phác thảo Damage Sketch
│   │   ├── /api/v1/reports/phase1/{id}/calculate-scores     # Bước 7: Auto tính điểm ECS (0-24) & VI
│   │   ├── /api/v1/reports/phase1/{id}/submit               # Bước 9: Nộp Phase 1 kèm chữ ký & ý kiến chủ hộ
│   │   ├── /api/v1/mutations/propose                        # Bước 5: Đề xuất Tách/Gộp thửa, cấp mã > 07000
│   │   ├── /api/v1/reports/phase2                           # Khởi tạo hồ sơ Phase 2 (kế thừa Phase 1)
│   │   ├── /api/v1/reports/phase2/{id}/identification-photos# Phase 2 Bước 1: 2 Ảnh P01-P02 mới
│   │   ├── /api/v1/phase2/zones/{id}/defects                # Phase 2 Bước 3: Thả ghim D-new trên Vùng cũ
│   │   ├── /api/v1/phase2/reports/{id}/zones                # Phase 2 Bước 3: Tạo Vùng Z-new mới phát sinh
│   │   ├── /api/v1/reports/phase2/{id}/sketch               # Phase 2 Bước 6: Sơ đồ phác thảo Damage Sketch
│   │   ├── /api/v1/phase2/reports/{id}/summarize            # Phase 2 Bước 7: Tổng kết biến động, ΔECS, Quan trắc & NDT
│   │   └── /api/v1/reports/phase2/{id}/submit               # Phase 2 Bước 9: Nộp Phase 2 kèm chữ ký 4 bên
│   │
│   ├── [GET] Endpoints (Tra cứu, Lọc dữ liệu theo vị trí, Tiến độ):
│   │   ├── /api/v1/tasks/my-tasks                           # Danh sách công trình được giao
│   │   ├── /api/v1/parcels/{id}                             # Chi tiết thửa đất & Đa giác ranh nhà Footprint
│   │   ├── /api/v1/reports/phase1/{id}                      # Lấy chi tiết hồ sơ Phase 1
│   │   ├── /api/v1/parcels/{id}/phase2/zones                # Phase 2: Lọc ảnh CTX và ghim cũ theo Tầng & Phòng
│   │   ├── /api/v1/reports/phase2/{id}                      # Lấy chi tiết hồ sơ Phase 2
│   │   ├── /api/v1/reports/phase2/{id}/quality-gate         # Phase 2 Bước 6: Checklist 10 tiêu chí Phụ lục A
│   │   └── /api/v1/photos/{id}/ai-status                    # Kiểm tra tiến độ AI nắn thẳng mặt đứng P-02
│   │
│   ├── [PUT] Endpoints (Cập nhật dữ liệu, Đo đạc, Đối soát Delta):
│   │   ├── /api/v1/reports/phase1/{id}/general-info         # Bước 1: Tên CT, Chủ hộ, Cấp CT, Liền kề
│   │   ├── /api/v1/reports/phase1/{id}/specs                # Bước 2: Kết cấu, Móng CAT 1-5, E5 Lịch sử
│   │   ├── /api/v1/reports/phase1/{id}/deformation          # Bước 4: Đo lún nghiêng X/Y, nghiêng sàn, võng dầm
│   │   ├── /api/v1/reports/phase1/{id}/scope                # Bước 5: Phạm vi khảo sát & Hạn chế tiếp cận
│   │   ├── /api/v1/reports/phase1/{id}/conclusions          # Bước 8: Kết luận, Rủi ro chính & Kiến nghị
│   │   ├── /api/v1/parcels/{id}/footprint                   # Bước 5: Cập nhật Đa giác ranh nhà thực địa
│   │   ├── /api/v1/reports/phase2/{id}/confirm-changes      # Phase 2 Bước 2: Xác nhận biến động sau GĐ1
│   │   ├── /api/v1/phase2/defects/{id}/verify               # Phase 2 Bước 3: Đối soát ghim cũ (w2, L2, Δw, ΔL)
│   │   ├── /api/v1/reports/phase2/{id}/deformation          # Phase 2 Bước 4: Đo lún nghiêng & Tính Delta nghiêng
│   │   └── /api/v1/reports/phase2/{id}/scope                # Phase 2 Bước 5: Phạm vi tiếp cận thực tế GĐ2
│   │
│   └── [DELETE] Endpoints (Xóa dữ liệu nháp):
│       └── /api/v1/reports/phase1/zones/{zId}/defects/{dId} # Xóa ghim khuyết tật nháp
│
├── 2. VAI TRÒ 2: TỔ TRƯỞNG & QUẢN TRỊ PHÂN KHU (ZONE ADMIN)
│   ├── [GET]  Endpoints: Thửa chưa phân công, Payload Split-Pane (Kính lúp 400%), Hồ sơ chờ duyệt, Thống kê Ga
│   ├── [POST] Endpoints: Giao việc bản đồ GIS, Duyệt Báo cáo & Ký số PDF/A, Trả về & Rollback, Duyệt Tách thửa, Batch PDF
│   ├── [PUT]  Endpoints: Điều chỉnh phân công
│   └── [DELETE] Endpoints: Hủy giao việc
│
├── 3. VAI TRÒ 3: TỔNG QUẢN TRỊ TOÀN TUYẾN (SUPER ADMIN)
│   ├── [GET]  Endpoints: Bản đồ GIS 11 Ga Metro 2, Danh sách nhân sự, Nhật ký Audit Logs
│   ├── [POST] Endpoints: Tạo tài khoản nhân sự, Import ranh địa chính/thửa đất GeoJSON
│   ├── [PUT]  Endpoints: Cập nhật Tim tuyến Metro 2 GeoJSON & Vùng ảnh hưởng (ZOI), Khóa/Mở tài khoản
│   └── [DELETE] Endpoints: Xóa tài khoản
│
└── 4. VAI TRÒ 4: NHÀ THẦU XÂY LẮP & KHÁCH TRA CỨU (CONTRACTOR & GUEST)
    └── [GET]  Endpoints: Tra cứu Bản đồ GIS qua ShareToken, Xem tóm tắt rủi ro VI, Tải Tập hồ sơ PDF kèm SHA-256
```

---

# 0. PHÂN HỆ XÁC THỰC CHUNG (COMMON AUTHENTICATION)

### 0.1. [POST] `/api/v1/auth/login`
* **Mô tả:** Đăng nhập hệ thống bằng Tên đăng nhập và Mật khẩu.
* **Quyền truy cập:** Public
* **Request Body:** `{ "username": "surveyor_01", "password": "Survey@123" }`
* **Response `200 OK`:** Trả về `accessToken` (7 ngày), `refreshToken`, thông tin User và `assignedZoneId`.

### 0.2. [POST] `/api/v1/auth/refresh-token`
* **Mô tả:** Cấp lại Access Token mới qua Refresh Token.

### 0.3. [GET] `/api/v1/auth/me`
* **Mô tả:** Lấy thông tin tài khoản hiện tại từ JWT token.

### 0.4. [POST] `/api/v1/auth/logout`
* **Mô tả:** Đăng xuất và thu hồi Refresh Token.

---

# 1. VAI TRÒ 1: CÁN BỘ KHẢO SÁT HIỆN TRƯỜNG (`SURVEYOR`)

---

## 1.1. NHÓM PHƯƠNG THỨC POST (Tạo mới, Upload, Khởi tạo, Nộp hồ sơ)

### 1.1.1. `POST /api/v1/attendance/check-in`
* **Mô tả:** Chấm công GPS đầu ngày tại hiện trường. Chỉ cần lấy tọa độ GPS thực tế (`gpsLat`, `gpsLng`), mã phân khu Ga (`zoneId`), ảnh selfie và ghi chú tùy chọn.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `zoneId` (string, required): Mã Ga, ví dụ `"ZONE_S9"`
  * `gpsLat` (number, required): Vĩ độ thực tế, ví dụ `10.798123`
  * `gpsLng` (number, required): Kinh độ thực tế, ví dụ `106.645678`
  * `selfieFile` (file binary, optional): Ảnh chụp xác thực tại hiện trường
  * `notes` (string, optional): Ghi chú ca khảo sát
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Chấm công GPS thành công. Đã mở quyền khảo sát hiện trường.",
  "data": {
    "checkinId": "chk-20260916-0001",
    "checkinTime": "2026-09-16T07:45:12.000Z",
    "gpsLat": 10.798123,
    "gpsLng": 106.645678,
    "zoneId": "ZONE_S9"
  }
}
```

---

### 1.1.2. `POST /api/v1/reports/phase1`
* **Mô tả:** Khởi tạo hồ sơ khảo sát Giai đoạn 1 (Phase 1 Baseline) cho một thửa đất.
* **Request Body:** `{ "parcelId": "p-00105" }`
* **Response `201 Created`:** Trả về `reportId: "rep-p1-00105"`, `status: "DRAFT"`.

---

### 1.1.3. `POST /api/v1/reports/phase1/{reportId}/identification-photos`
* **Mô tả:** Bước 1 - Upload bộ 4 ảnh định danh mặt ngoài ($P-01$ Biển số nhà, $P-02$ Toàn cảnh mặt đứng, $P-03$ Hông trái/sau, $P-04$ Bối cảnh ngõ/đường). Hỗ trợ nút chọn **Không tồn tại (N/A)** cho từng ảnh kèm lý do, và hỗ trợ đa giác mặt đứng với **số đỉnh $N$ bất kỳ** ($N \ge 3$).
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `p01File` (file binary, optional): Ảnh biển số nhà
  * `p01IsNA` (boolean, default: false), `p01NAReason` (string, optional): `"Nhà không gắn biển số"`
  * `p02File` (file binary, optional): Ảnh toàn cảnh mặt đứng chính
  * `p02IsNA` (boolean, default: false), `p02NAReason` (string, optional): `"Mặt tiền bị công trình trước che khuất"`
  * `p02PolygonPoints` (string JSON, optional): Mảng $N$ điểm góc đa giác bao quanh khung nhà `[{"x": 120, "y": 850}, {"x": 890, "y": 830}, {"x": 870, "y": 150}, {"x": 500, "y": 50}, {"x": 140, "y": 180}]` (Hỗ trợ nhà mái xéo, chữ L, giật cấp $N$ đỉnh)
  * `p02FloorSplitLines` (string JSON, optional): Mảng đường phân tầng ngang `[{"floor": 1, "y": 620}, {"floor": 2, "y": 390}]`
  * `p02Dimensions` (string JSON, optional): Kích thước ghi chú `{"h1": "3.8m", "h2": "3.4m", "totalHeight": "11.5m", "facadeWidth": "4.2m"}`
  * `p03File` (file binary, optional), `p03IsNA` (boolean), `p03NAReason` (string): `"Nhà phố 2 bên sát vách"`
  * `p04File` (file binary, optional), `p04IsNA` (boolean), `p04NAReason` (string)
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã lưu bộ ảnh định danh P01-P04. Ảnh P-02 đã được gửi vào hàng đợi AI nắn thẳng.",
  "data": {
    "p01Url": "https://s3.metro2.vn/photos/P01_raw.jpg",
    "p02Url": "https://s3.metro2.vn/photos/P02_raw.jpg",
    "p02AiJobId": "ai-job-p02-99812",
    "p03Url": null,
    "p04Url": "https://s3.metro2.vn/photos/P04_raw.jpg"
  }
}
```

---

### 1.1.4. `POST /api/v1/reports/phase1/{reportId}/zones`
* **Mô tả:** Bước 3 - Tạo Vùng khảo sát hư hỏng $Z-xx$ cho từng Tầng/Phòng, upload ảnh bối cảnh góc rộng $CTX$, đánh giá ảnh hưởng chức năng và chốt cấp độ Burland (0-5) tại chỗ.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `floorName` (string, required): `"Tầng 1 (Trệt)"` (hoặc Tầng hầm, Lầu 1, Lầu 2, Mái...)
  * `roomName` (string, required): `"Phòng khách phía trước"` (hoặc Phòng ngủ 1, Bếp, Hành lang...)
  * `componentType` (string, required): `"WALL"` | `"BEAM"` | `"COLUMN"` | `"SLAB"` | `"FLOOR"` | `"STAIRS"`
  * `wallMaterial` (string, optional): `"Tường gạch 200mm"` | `"BTCT"` | `"Vách thạch cao"`
  * `functionalImpactRepairNeeded` (boolean, required): `true` / `false`
  * `burlandGrade` (integer, required, 0-5): `2`
  * `ctxPhotoFile` (file binary, required): File ảnh bối cảnh góc rộng
  * `notes` (string, optional): `"Mảng tường giáp nhà số 856"`
* **Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "zoneId": "z-01-p1-00105",
    "zoneCode": "Z-01",
    "floorName": "Tầng 1 (Trệt)",
    "roomName": "Phòng khách phía trước",
    "burlandGrade": 2,
    "ctxPhotoUrl": "https://s3.metro2.vn/photos/Z01_CTX_raw.jpg"
  }
}
```

---

### 1.1.5. `POST /api/v1/reports/phase1/zones/{zoneId}/defects`
* **Mô tả:** Bước 3 (Chi tiết) - Thả ghim khuyết tật $D-xx$ trực tiếp lên ảnh bối cảnh $Z-xx$, upload ảnh cận cảnh $CU$ có thước đo vạch mm (Scale Card), đo đạc $w_{max}$, $L$, và tự động map các điểm thành phần $E2$ (Ý nghĩa kết cấu) và $E4$ (Suy giảm vật liệu).
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `pinX` (number, required): Tọa độ X trên ảnh CTX (0.0 - 100.0 %)
  * `pinY` (number, required): Tọa độ Y trên ảnh CTX (0.0 - 100.0 %)
  * `screeningCategory` (string, required): `"NỨT_TƯỜNG_HOÀN_THIỆN"` | `"NỨT_KẾT_CẤU_CỘT_DẦM"` | `"LÚN_VÕNG"` | `"THẤM_DỘT"` | `"BONG_TRÓC_LỘ_THÉP"` | `"MẤT_TIẾT_DIỆN"` | `"KẸT_CỬA"` | `"TÁI_NỨT"`
  * `defectType` (string, required): `"DIAGONAL_SHEAR_CRACK"` | `"VERTICAL_CRACK"` | `"HORIZONTAL_CRACK"` | `"SPALLING"` | `"WATER_SEEPAGE"`
  * `crackDirection` (string, optional): `"Xiên 45 độ góc cửa sổ"`
  * `widthMaxMm` (number, required): `0.85`
  * `lengthMm` (number, required): `650.0`
  * `activityState` (string, required): `"U"` (Chưa rõ) | `"S"` (Ổn định) | `"A"` (Đang phát triển)
  * `materialDegradationE4` (integer, required, 0-4): `1` (0: Không/Nhẹ, 1: Cục bộ, 2: Đáng kể, 3: Nặng, 4: Ảnh hưởng chịu lực)
  * `structuralSignificanceE2` (integer, required, 0-4): `1` (0: N/A, 1: Low, 2: Moderate, 3: High, 4: Critical)
  * `hasScaleCard` (boolean, required): `true`
  * `cuPhotoFile` (file binary, required): Ảnh cận cảnh có thước đo
  * `extraPhotoFile` (file binary, optional): Ảnh góc chụp bổ sung (nếu có)
* **Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "defectId": "def-01-z01",
    "defectCode": "D-01",
    "pinX": 42.5,
    "pinY": 68.2,
    "widthMaxMm": 0.85,
    "lengthMm": 650.0,
    "cuPhotoUrl": "https://s3.metro2.vn/photos/Z01_D01_CU_raw.jpg"
  }
}
```

---

### 1.1.6. `POST /api/v1/reports/phase1/{reportId}/sketch`
* **Mô tả:** Bước 6 - Upload ảnh chụp bản vẽ phác thảo tay vị trí khuyết tật trên mặt bằng/mặt đứng (Damage Location Sketch) hoặc nhập số hiệu bản vẽ CAD.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `sketchPhotoFile` (file binary, optional), `cadDrawingRef` (string, optional)
* **Response `201 Created`:** `{ "success": true, "sketchPhotoUrl": "https://s3.metro2.vn/photos/sketch_001.jpg" }`

---

### 1.1.7. `POST /api/v1/reports/phase1/{reportId}/calculate-scores`
* **Mô tả:** Bước 7 - Tự động tổng hợp điểm $E1..E6 \rightarrow \Sigma E / 24$ (ECS Class: `Good` [0-5], `Medium` [6-10], `Deficient` [11-16], `Critical` [17-24]) và Chỉ số tổn thương $V1..V6 \rightarrow VI Class$ (`Low`, `Medium`, `High`, `Very High`). Hỗ trợ Engineering Judgement ghi đè có điều kiện.
* **Request Body (Tùy chọn ghi đè):**
```json
{
  "engineeringJudgementAction": "KEEP",
  "engineeringJudgementReason": ""
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "ecsScore": 6,
    "ecsMaxScore": 24,
    "ecsClass": "MEDIUM",
    "viAverageScore": 2.15,
    "viClass": "MEDIUM",
    "breakdownE": { "E1_burland": 2, "E2_structure": 1, "E3_deformation": 1, "E4_materials": 1, "E5_history": 1, "E6_overall": 0 },
    "breakdownV": { "V1_importance": 2, "V2_structure": 2, "V3_foundation": 2, "V4_age": 2, "V5_ecs": 2, "V6_sensitivity": 1 }
  }
}
```

---

### 1.1.8. `POST /api/v1/reports/phase1/{reportId}/submit`
* **Mô tả:** Bước 9 - Nộp chính thức Báo cáo Phase 1 kèm ý kiến phản hồi nguyên văn của Chủ hộ, ảnh chữ ký của Cán bộ KS và Chủ hộ (hoặc ghi nhận trường hợp vắng mặt/từ chối ký).
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `ownerRemarks` (string, optional): `"Chủ hộ đồng ý với toàn bộ các vết nứt hiện trạng ghi nhận trong biên bản."`
  * `surveyorSignatureFile` (file binary, required): Ảnh chữ ký cán bộ khảo sát
  * `ownerSignatureFile` (file binary, optional): Ảnh chữ ký chủ hộ hoặc biên bản giấy
  * `isRefusedOrAbsent` (boolean, default: false): `true` nếu chủ nhà vắng mặt hoặc từ chối hợp tác
  * `refusalDocRef` (string, optional): Số biên bản từ chối/vắng mặt
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Báo cáo Phase 1 đã được nộp thành công (Status: SUBMITTED).",
  "data": { "reportId": "rep-p1-00105", "status": "SUBMITTED", "submittedAt": "2026-09-16T09:30:00.000Z" }
}
```

---

### 1.1.9. `POST /api/v1/mutations/propose`
* **Mô tả:** Bước 5 (Ranh GIS) - Phát hiện nhà thực tế chia nhỏ (sổ chung/cơi nới), gửi Đề xuất Tách thửa. Hệ thống tự động cấp mã mới từ Kho số Mở rộng bất biến (> 07000).
* **Request Body:**
```json
{
  "mutationType": "SPLIT",
  "sourceParcelId": "p-00002",
  "reason": "Nhà gốc B-00002 thực tế đã chia thành 2 căn hộ riêng biệt có 2 lối đi độc lập.",
  "childPolygons": [
    { "tempLabel": "Căn trước (A)", "polygonGeoJson": { "type": "Polygon", "coordinates": [...] } },
    { "tempLabel": "Căn sau (B)", "polygonGeoJson": { "type": "Polygon", "coordinates": [...] } }
  ]
}
```
* **Response `201 Created`:** Cấp mã mới `B-07001`, `B-07002`.

---

### 1.1.10. `POST /api/v1/reports/phase2`
* **Mô tả:** Khởi tạo hồ sơ khảo sát Giai đoạn 2 (Phiếu 02 - Pre-Construction BCS), tự động kế thừa toàn bộ dữ liệu gốc từ Báo cáo Phase 1 đã duyệt.
* **Request Body:**
```json
{
  "parcelId": "p-00105",
  "phase1ReportId": "rep-p1-00105",
  "workSection": "Đoạn tuyến Ga S9 Bà Quẹo ➔ Ga S10 Phạm Văn Bạch",
  "surveyPurpose": "BASELINE_PRE_CONSTRUCTION",
  "surveyLevel": "L2_B_STANDARD",
  "witnessMembers": "Nguyễn Văn A (Cán bộ KS), Lê Văn B (Chủ nhà)",
  "specialConditions": "Thời tiết nắng ráo, tiếp cận thuận lợi"
}
```
* **Response `201 Created`:** Trả về `reportId: "rep-p2-00105"`, `status: "DRAFT"`.

---

### 1.1.11. `POST /api/v1/reports/phase2/{reportId}/identification-photos`
* **Mô tả:** Phase 2 Bước 1 - Chụp 2 ảnh nhận dạng Giai đoạn 2 ($P-01$ Biển số nhà & mặt đứng, $P-02$ Bối cảnh đường/tuyến Metro). Hỗ trợ nút N/A và vẽ đa giác $N$ đỉnh.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `p01File`, `p01IsNA`, `p01NAReason`, `p01PolygonPoints`, `p01FloorSplitLines`, `p02File`, `p02IsNA`, `p02NAReason`
* **Response `201 Created`:** `{ "success": true, "p01Url": "...", "p02Url": "..." }`

---

### 1.1.12. `POST /api/v1/phase2/zones/{zoneId}/defects`
* **Mô tả:** Phase 2 Bước 3 (Cơ chế A) - Chấm thêm vết nứt mới phát sinh sau GĐ1 lên ảnh bối cảnh $CTX$ của Vùng cũ $Z-xx$. Tự động gán mã `D-04 (MỚI)` màu Đỏ.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `pinX`, `pinY`, `screeningCategory`, `defectType`, `crackDirection`, `widthMaxMm: 0.6`, `lengthMm: 500.0`, `cuPhotoFile: <binary>`
* **Response `201 Created`:** Trả về `defectCode: "D-04"`, `evolutionStatus: "NEW_RECORDED"`, `isNewInPhase2: true`.

---

### 1.1.13. `POST /api/v1/phase2/reports/{reportId}/zones`
* **Mô tả:** Phase 2 Bước 3 (Cơ chế B) - Tạo Vùng mới $Z-new$ khi xuất hiện khu vực mới (gác lửng cơi nới, phòng kho mở khóa...), upload ảnh $CTX$ mới và đánh giá ma trận cấu kiện.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `floorName`, `roomName`, `slabCondition`, `wallCondition`, `beamColumnCondition`, `seepageSpallingCondition`, `deformationCondition`, `ctxPhotoFile: <binary>`
* **Response `201 Created`:** Trả về `zoneCode: "Z-04 (MỚI)"`, `isNewInPhase2: true`.

---

### 1.1.14. `POST /api/v1/reports/phase2/{reportId}/sketch`
* **Mô tả:** Phase 2 Bước 6 - Upload sơ đồ vị trí khuyết tật Phase 2 hoặc số hiệu bản vẽ Damage Mapping CAD.

---

### 1.1.15. `POST /api/v1/phase2/reports/{reportId}/summarize`
* **Mô tả:** Phase 2 Bước 7 - Tự động tổng hợp biến động so với GĐ1, tính $\Delta ECS$, phát hiện cảnh báo nguy cấp (Critical Alert), đề xuất nhu cầu quan trắc bổ sung (Lún, Nghiêng, Nứt, Rung) và thí nghiệm không phá hủy NDT.
* **Request Body:**
```json
{
  "dataLimitations": "Góc tủ phòng ngủ 1 bị che khuất",
  "notableDamageSummary": "Vết nứt uốn dầm D-02 phát triển rộng thêm 0.3mm",
  "isCriticalAlert": false,
  "monitoringNeeds": ["CRACK", "SETTLEMENT"],
  "ndtTestingNeeded": true,
  "ndtTestingType": "Siêu âm cường độ bê tông dầm",
  "phase2Conclusion": "CO_HU_HONG_CAN_THEO_DOI"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "totalDefectsCount": 5,
    "phase1DefectsCount": 3,
    "phase2NewDefectsCount": 2,
    "deltaEcs": 3,
    "widenedDefectsCount": 1,
    "stableDefectsCount": 1,
    "repairedDefectsCount": 1,
    "compensationVerdict": "STRUCTURAL_IMPACT"
  }
}
```

---

### 1.1.16. `POST /api/v1/reports/phase2/{reportId}/submit`
* **Mô tả:** Phase 2 Bước 9 - Nộp chính thức Báo cáo Phase 2 kèm cam kết pháp lý chuẩn Phiếu 02, ý kiến chủ hộ và chữ ký xác nhận 4 bên (Chủ hộ, Đại diện Liên danh, Đại diện Nhà thầu/Khách, Người làm chứng).
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `ownerRemarks` (string, optional): Ý kiến chủ nhà
  * `ownerSignatureFile` (file binary, optional)
  * `contractorRepSignatureFile` (file binary, required): Đại diện Liên danh CRLG-CRSRI-TT
  * `thirdPartyRepSignatureFile` (file binary, optional): Đại diện Nhà thầu/Khách hàng
  * `witnessSignatureFile` (file binary, optional): Người làm chứng/Địa phương
  * `isRefusedOrAbsent` (boolean, default: false), `refusalDocRef` (string, optional)
* **Response `200 OK`:** `{ "success": true, "status": "SUBMITTED" }`

---

## 1.2. NHÓM PHƯƠNG THỨC GET (Tra cứu & Lọc dữ liệu theo vị trí)

### 1.2.1. `GET /api/v1/tasks/my-tasks`
* **Mô tả:** Lấy danh sách công trình được giao việc cho Surveyor hiện tại.

### 1.2.2. `GET /api/v1/parcels/{parcelId}`
* **Mô tả:** Lấy chi tiết thông tin thửa đất, mã kép `B-xxxxx` và `KSxxx`, đa giác ranh nhà footprint.

### 1.2.3. `GET /api/v1/reports/phase1/{reportId}`
* **Mô tả:** Lấy toàn bộ payload 9 bước của hồ sơ Phase 1.

### 1.2.4. `GET /api/v1/parcels/{parcelId}/phase2/zones`
* **Mô tả:** Phase 2 Bước 3.1 - Tự động lọc và tải về ảnh bối cảnh $CTX$ và toàn bộ ghim $D-xx$ cũ của đúng Tầng & Phòng mà Surveyor đang đứng.
* **Query Parameters:** `floor="Tầng 1 (Trệt)"`, `room="Phòng khách phía trước"`
* **Response `200 OK`:** Trả về danh sách Vùng `Z-xx` kèm ảnh `CTX` và mảng ghim `defects` ($D-01, D-02...$) có thông số $w_1, L_1$.

### 1.2.5. `GET /api/v1/reports/phase2/{reportId}`
* **Mô tả:** Lấy chi tiết toàn bộ hồ sơ Phase 2 (kế thừa Phase 1 + biến động mới).

### 1.2.6. `GET /api/v1/reports/phase2/{reportId}/quality-gate`
* **Mô tả:** Phase 2 Bước 6.2 - Tự động quét kiểm tra 10 tiêu chí chất lượng hồ sơ theo Phụ lục A (Đạt / Thiếu / N/A).
* **Response `200 OK`:**
```json
{
  "success": true,
  "isAllPassed": true,
  "checklist": [
    { "item": 1, "name": "Mã công trình & Tham chiếu GĐ1", "status": "PASSED" },
    { "item": 2, "name": "Phạm vi tiếp cận", "status": "PASSED" },
    { "item": 3, "name": "Ảnh P-01, P-02", "status": "PASSED" },
    { "item": 6, "name": "Mỗi khuyết tật có đủ ảnh CTX + CU kèm thước", "status": "PASSED" },
    { "item": 10, "name": "Chữ ký 4 bên / Biên bản từ chối", "status": "PASSED" }
  ]
}
```

### 1.2.7. `GET /api/v1/photos/{photoId}/ai-status`
* **Mô tả:** Kiểm tra tiến độ nắn thẳng mặt đứng $P-02$ chuẩn CAD.

---

## 1.3. NHÓM PHƯƠNG THỨC PUT (Cập nhật, Đo đạc & Đối soát Delta)

### 1.3.1. `PUT /api/v1/reports/phase1/{reportId}/general-info`
* **Mô tả:** Bước 1 - Cập nhật thông tin hành chính: Tên công trình, Tên chủ hộ, Số điện thoại, Nhóm đối tượng (`General | Important | Critical`), Công trình liền kề (`Nhà phố | Cao tầng | Công cộng | Đất trống | Khác`).

### 1.3.2. `PUT /api/v1/reports/phase1/{reportId}/specs`
* **Mô tả:** Bước 2 - Lưu trữ thông số phỏng vấn chủ hộ:
  * **2.1 Kết cấu:** `useType`, `numberOfFloorsAboveGround`, `numberOfBasements`, `yearOfConstruction`, `isEstimatedYear`, `structuralSystem` (`RC | Steel | Masonry | Mixed`), `structuralForm` (`Frame | Wall | Mixed`), `foundationType` (`Shallow | Wood | PC | CIP | Unknown`), `catFoundationScore` (1-5), `catSources` (`Drawing | Owner | Site`).
  * **2.2 Yếu tố nhạy cảm E5:** `coiNoiTaiTrongE5` (0-4), `suaChuaKetCauE5` (0-4), `lunNghiengTruocDayE5` (0-4), `huHongLanCanE5` (0-4), `suCoHoaHoanE5` (0-4), `thietBiNhayCam` (bool + desc), `tinhTrangSuDung` (`Đầy đủ | Một phần | Không sử dụng`), `vanHanh247` (bool).

### 1.3.3. `PUT /api/v1/reports/phase1/{reportId}/deformation`
* **Mô tả:** Bước 4 - Đánh giá Lún - Nghiêng - Biến dạng:
  * `settlementState` (0-4), `settlementLocation` (text)
  * `overallTiltState` (0-4), `tiltRatioX` (text, vd: "1/450"), `tiltRatioY` (text, vd: "1/600")
  * `floorTiltState` (0-4), `floorTiltPercent` (number, vd: 0.25)
  * `beamDeflectionState` (0-4), `deflectionLocation` (text), `maxDeflectionMm` (number)
  * `dataSources` (`Visual | RapidDevice | DesignDrawing | Owner`), `confidenceLevel` (`Cao | Trung bình | Thấp`), `needMonitoring` (bool + notes).

### 1.3.4. `PUT /api/v1/reports/phase1/{reportId}/scope`
* **Mô tả:** Bước 5 - Lưu trữ phạm vi đã khảo sát (`Bên ngoài, Tầng trệt, Các tầng lầu, Mái, Tầng hầm, Khu phụ`) và Hạn chế tiếp cận (`Không` / `Có` kèm lý do).

### 1.3.5. `PUT /api/v1/reports/phase1/{reportId}/conclusions`
* **Mô tả:** Bước 8 - Lưu trữ Khuyết tật/Rủi ro chính, Kiến nghị cụ thể, Tác động thi công dự tính ($I$), và Đánh giá rủi ro cơ sở ($BRA$).

### 1.3.6. `PUT /api/v1/parcels/{parcelId}/footprint`
* **Mô tả:** Bước 5 - Cập nhật Đa giác ranh nhà thực tế (Building Footprint Polygon) sau khi đo quét cạn ngoài thực địa.

### 1.3.7. `PUT /api/v1/reports/phase2/{reportId}/confirm-changes`
* **Mô tả:** Phase 2 Bước 2 - Xác nhận biến động phát sinh sau GĐ1 (`coiNoiSauGĐ1` bool + text, `suaChuaSauGĐ1` bool + text, `thayDoiTaiTrongSauGĐ1` bool + text, `thayDoiKhac` text, `hasSignificantChange` bool).

### 1.3.8. `PUT /api/v1/phase2/defects/{defectId}/verify`
* **Mô tả:** Phase 2 Bước 3 (Cơ chế A) - Đối soát ghim cũ: Nhập số đo mới $w_2, L_2$, upload ảnh CU Phase 2 có thước đo. Động cơ tự động tính $\Delta w = w_2 - w_1, \Delta L = L_2 - L_1$, gán trạng thái (`Không đổi`, `Phát triển`, `Đã sửa`) và đổi màu ghim tương ứng.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `phase2WidthMm: 1.20`, `phase2LengthMm: 800.0`, `evolutionStatus: "WIDENED"`, `phase2CuPhotoFile: <binary>`, `notes`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "defectCode": "D-01",
    "phase1WidthMm": 0.85,
    "phase2WidthMm": 1.20,
    "deltaWidthMm": 0.35,
    "evolutionStatus": "WIDENED",
    "pinColor": "#FF9800"
  }
}
```

### 1.3.9. `PUT /api/v1/reports/phase2/{reportId}/deformation`
* **Mô tả:** Phase 2 Bước 4 - Lưu trữ số đo lún nghiêng Phase 2 và tự động tính độ biến thiên $\Delta$ so với Phase 1:
  * Điểm 1: Nghiêng mặt trước $X_2 = 0.35\% \rightarrow \Delta X = +0.05\%$
  * Điểm 2: Nghiêng mặt hông $Y_2 = 0.20\% \rightarrow \Delta Y = 0.00\%$
  * Điểm 3: Nghiêng sàn $0.15\%$
  * Điểm 4: Võng dầm $f = 6.0\text{mm}$
  * Phương pháp đo, ID thiết bị, Mã ảnh đo đạc.

### 1.3.10. `PUT /api/v1/reports/phase2/{reportId}/scope`
* **Mô tả:** Phase 2 Bước 5 - Lưu trữ phạm vi tiếp cận thực tế GĐ2 (`Toàn bộ` / `Một phần` kèm lý do khu vực không tiếp cận).

---

## 1.4. NHÓM PHƯƠNG THỨC DELETE (Xóa dữ liệu nháp)

### 1.4.1. `DELETE /api/v1/reports/phase1/zones/{zoneId}/defects/{defectId}`
* **Mô tả:** Xóa một ghim khuyết tật nháp bị thả nhầm trước khi nộp hồ sơ.

---

# 2. VAI TRÒ 2: TỔ TRƯỞNG & QUẢN TRỊ PHÂN KHU (`ZONE_ADMIN`)

### 2.1. [GET] Nhóm Giám Sát & Thẩm Định:
* `GET /api/v1/admin/parcels/unassigned`: Danh sách thửa đất chưa phân công để hiển thị lên bản đồ GIS.
* `GET /api/v1/admin/reports/{id}/audit-view`: Payload thẩm định Split-Pane hoàn chỉnh (Cây cấu kiện & điểm số ECS/VI bên trái, cặp ảnh $CTX / CU$ bên phải phục vụ soi kính lúp 400%).
* `GET /api/v1/admin/reports`: Danh sách hồ sơ khảo sát theo trạng thái (`SUBMITTED`, `APPROVED`, `REJECTED`).
* `GET /api/v1/reports/batch-export/{batchId}/status`: Kiểm tra tiến độ đóng gói Tập hồ sơ phân khu (PDF Book) & link tải kèm Checksum SHA-256.

### 2.2. [POST] Nhóm Phê Duyệt & Giao Việc:
* `POST /api/v1/admin/tasks/assign`: Chọn danh sách thửa đất trên bản đồ GIS và giao cho Surveyor kèm deadline.
* `POST /api/v1/admin/reports/{id}/approve`: Duyệt Báo cáo (Phím tắt `A`) $\rightarrow$ Tự động sinh PDF/A chính thức & ký số điện tử.
* `POST /api/v1/admin/reports/{id}/reject`: Trả về Báo cáo (Phím tắt `R`) kèm lý do $\rightarrow$ Tự động rollback biến động tách thửa.
* `POST /api/v1/admin/mutations/{id}/approve`: Duyệt sự kiện Tách thửa trong Transaction: Chuyển thửa cũ sang `SPLIT_DEPRECATED`, kích hoạt các thửa mới `B-07001, B-07002` lên GIS Master.
* `POST /api/v1/reports/batch-export`: Khởi chạy đóng gói 100-200 báo cáo trong Ga thành 1 Tập Hồ sơ duy nhất (PDF Book Compilation).

### 2.3. [PUT] Nhóm Điều Chỉnh Phân Công:
* `PUT /api/v1/admin/tasks/{taskId}/reassign`: Chuyển giao nhiệm vụ khảo sát sang Surveyor khác.

### 2.4. [DELETE] Nhóm Hủy Nhiệm Vụ:
* `DELETE /api/v1/admin/tasks/{taskId}`: Hủy phân công nhiệm vụ khảo sát.

---

# 3. VAI TRÒ 3: TỔNG QUẢN TRỊ TOÀN TUYẾN (`SUPER_ADMIN`)

### 3.1. [GET] Nhóm Toàn Cảnh Tuyến & Nhân Sự:
* `GET /api/v1/zones`: Danh sách 11 Ga Metro 2 kèm thống kê tiến độ toàn tuyến (%).
* `GET /api/v1/admin/users`: Quản lý danh sách nhân sự toàn hệ thống.

### 3.2. [POST] Nhóm Khởi Tạo & Import:
* `POST /api/v1/admin/users`: Tạo tài khoản nội bộ mới (Zone Admin, Surveyor).
* `POST /api/v1/admin/gis/import-parcels`: Import hàng loạt thửa đất địa chính ban đầu từ GeoJSON/Shapefile.

### 3.3. [PUT] Nhóm Cập Nhật Lớp GIS:
* `PUT /api/v1/admin/gis/layers/metro-alignment`: Cập nhật Tim tuyến Metro 2 GeoJSON và Vùng ảnh hưởng trực tiếp (ZOI).
* `PUT /api/v1/admin/users/{userId}/status`: Khóa hoặc kích hoạt lại tài khoản nhân sự (`ACTIVE` / `SUSPENDED`).

### 3.4. [DELETE] Nhóm Vô Hiệu Hóa:
* `DELETE /api/v1/admin/users/{userId}`: Xóa tài khoản nhân sự.

---

# 4. VAI TRÒ 4: NHÀ THẦU XÂY LẮP & KHÁCH TRA CỨU (`CONTRACTOR_GUEST`)

### 4.1. [GET] Nhóm Tra Cứu & Tải Tài Liệu Công Bố:
* `GET /api/v1/guest/gis-map`: Tra cứu bản đồ GIS quy hoạch các công trình đã duyệt qua `shareToken` an toàn.
* `GET /api/v1/guest/parcels/{id}/summary`: Xem tóm tắt kết cấu, điểm ECS và xếp hạng rủi ro VI của công trình.
* `GET /api/v1/guest/dossiers/{batchId}/download`: Tải file Tập hồ sơ phân khu hoàn chỉnh (PDF Book) kèm Checksum SHA-256.
