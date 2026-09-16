# ĐẶC TẢ CHI TIẾT HỆ THỐNG RESTFUL API (API SPECIFICATION & CONTRACT)
## HỆ THỐNG KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH - METRO SỐ 2 (BẾN THÀNH – THAM LƯƠNG)

> [!IMPORTANT]
> **CẤU TRÚC ĐẶC TẢ THEO VAI TRÒ NGƯỜI DÙNG & PHƯƠNG THỨC HTTP (ROLE-FIRST & METHOD-GROUPED):**
> Tài liệu này phân chia toàn bộ hệ thống API theo 4 nhóm đối tượng người dùng chính (`SURVEYOR`, `ZONE_ADMIN`, `SUPER_ADMIN`, `CONTRACTOR_GUEST`), trong mỗi vai trò được phân cụm chi tiết theo các phương thức HTTP (`POST`, `GET`, `PUT`, `DELETE`).

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
│   ├── [POST] Endpoints: Check-in, Khởi tạo hồ sơ, Upload ảnh P01-P04, Vùng Z-xx, Ghim D-xx, Đề xuất tách thửa, Nộp hồ sơ
│   ├── [GET]  Endpoints: Xem việc được giao, Tra cứu thửa đất, Lấy ảnh/ghim GĐ1 theo Tầng/Phòng, Trạng thái AI Homography
│   ├── [PUT]  Endpoints: Lưu đặc tính kết cấu, Đo lún nghiêng, Đối soát Delta Phase 2 (w2, L2), Cập nhật ranh Footprint
│   └── [DELETE] Endpoints: Xóa ghim khuyết tật nháp, Xóa ảnh chụp thử
│
├── 2. VAI TRÒ 2: TỔ TRƯỞNG & QUẢN TRỊ PHÂN KHU (ZONE ADMIN)
│   ├── [GET]  Endpoints: Danh sách thửa chưa phân công, Payload Split-Pane (Kính lúp 400%), Danh sách hồ sơ chờ duyệt, Thống kê Ga
│   ├── [POST] Endpoints: Giao việc bản đồ GIS, Phê duyệt Báo cáo & Ký số PDF/A, Trả về & Rollback, Duyệt biến động tách thửa, Đóng gói Batch PDF
│   ├── [PUT]  Endpoints: Điều chỉnh phân công, Cập nhật ghi chú thẩm định kỹ thuật
│   └── [DELETE] Endpoints: Hủy nhiệm vụ đã giao
│
├── 3. VAI TRÒ 3: TỔNG QUẢN TRỊ TOÀN TUYẾN (SUPER ADMIN)
│   ├── [GET]  Endpoints: Bản đồ GIS 11 Ga Metro 2, Danh sách người dùng, Nhật ký hệ thống Audit Logs
│   ├── [POST] Endpoints: Tạo tài khoản cán bộ, Import ranh địa chính/thửa đất quy hoạch, Cấp quyền Zone Admin
│   ├── [PUT]  Endpoints: Cập nhật Tim tuyến Metro 2 GeoJSON, Cập nhật Polygon ranh Ga, Khóa/Mở tài khoản
│   └── [DELETE] Endpoints: Hủy tài khoản người dùng
│
└── 4. VAI TRÒ 4: NHÀ THẦU XÂY LẮP & KHÁCH TRA CỨU (CONTRACTOR & GUEST)
    └── [GET]  Endpoints: Tra cứu Bản đồ GIS công khai qua Share Token, Xem tóm tắt rủi ro VI, Tải Tập hồ sơ PDF có mã SHA-256
```

---

# 0. PHÂN HỆ XÁC THỰC CHUNG (COMMON AUTHENTICATION)

Toàn bộ người dùng đăng nhập qua JWT Bearer Token có thời hạn 7 ngày, giải mã trả về quyền hạn (`role`) và phân khu quản lý (`assignedZoneId`).

### 0.1. [POST] `/api/v1/auth/login`
* **Mô tả:** Đăng nhập hệ thống bằng Tên đăng nhập và Mật khẩu.
* **Quyền truy cập:** Public
* **Request Body:**
```json
{
  "username": "surveyor_01",
  "password": "Survey@123"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "d8f93b2a-81a1-432a-bc91-2384a9e21820",
    "expiresIn": 604800,
    "user": {
      "id": "u-001-surveyor",
      "username": "surveyor_01",
      "fullName": "Nguyễn Văn Khảo Sát",
      "role": "SURVEYOR",
      "assignedZoneId": "ZONE_S9",
      "assignedZoneName": "Ga S9 - Bà Quẹo",
      "avatarUrl": "https://s3.metro2.vn/avatars/u-001.jpg"
    }
  }
}
```
* **Response `401 Unauthorized`:**
```json
{
  "code": "ERR_AUTH_INVALID_CREDENTIALS",
  "message": "Tên đăng nhập hoặc mật khẩu không chính xác."
}
```

### 0.2. [POST] `/api/v1/auth/refresh-token`
* **Mô tả:** Cấp lại Access Token mới khi token cũ hết hạn thông qua Refresh Token.
* **Request Body:** `{ "refreshToken": "d8f93b2a-81a1-432a-bc91-2384a9e21820" }`
* **Response `200 OK`:** `{ "success": true, "accessToken": "eyJhbGciOi..." }`

### 0.3. [GET] `/api/v1/auth/me`
* **Mô tả:** Lấy thông tin tài khoản hiện tại từ JWT token trong Header.
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "u-001-surveyor",
    "username": "surveyor_01",
    "fullName": "Nguyễn Văn Khảo Sát",
    "role": "SURVEYOR",
    "assignedZone": {
      "id": "ZONE_S9",
      "name": "Ga S9 - Bà Quẹo"
    }
  }
}
```

### 0.4. [POST] `/api/v1/auth/logout`
* **Mô tả:** Đăng xuất và thu hồi Refresh Token trong cơ sở dữ liệu.
* **Response `200 OK`:** `{ "success": true, "message": "Đã đăng xuất thành công." }`

---

# 1. VAI TRÒ 1: CÁN BỘ KHẢO SÁT HIỆN TRƯỜNG (`SURVEYOR`)
> **Nền tảng sử dụng:** Mobile PWA trên điện thoại / Tablet ngoài thực địa.  
> **Nhiệm vụ:** Chấm công GPS, tiếp cận công trình, chụp ảnh đa lớp, lập hồ sơ 9 bước Phase 1 & đối soát Delta Phase 2.

---

## 1.1. NHÓM PHƯƠNG THỨC POST (Tạo mới, Upload, Khởi tạo, Nộp hồ sơ)

### 1.1.1. `POST /api/v1/attendance/check-in`
* **Mô tả:** Chấm công GPS đầu ngày tại hiện trường kèm ảnh chụp Selfie có Watermark thời gian thực. Bắt buộc sai số $accuracy \le 20.0m$.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `zoneId` (string, required): Mã Ga, ví dụ `"ZONE_S9"`
  * `gpsLat` (number, required): `10.798123`
  * `gpsLng` (number, required): `106.645678`
  * `accuracy` (number, required): `8.5` *(mét, $\le 20m$)*
  * `selfieFile` (file binary, required): File ảnh chụp trực tiếp từ camera
  * `accompanyingMembers` (string, optional): JSON array `["Trần Văn A", "Lê Văn B"]`
  * `notes` (string, optional): `"Bắt đầu ca sáng tại khu vực hẻm 854 Trường Chinh"`
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Chấm công thành công. Đã mở quyền khảo sát hiện trường.",
  "data": {
    "checkinId": "chk-20260916-0001",
    "checkinTime": "2026-09-16T07:45:12.000Z",
    "selfiePhotoUrl": "https://s3.metro2.vn/attendance/selfie_001.jpg",
    "isWithinAssignedZone": true
  }
}
```
* **Response `422 Unprocessable Entity` (GPS sai số lớn):**
```json
{
  "code": "ERR_GPS_ACCURACY_EXCEEDED",
  "message": "Độ chính xác GPS hiện tại là 35m (vượt quá giới hạn cho phép <= 20m). Vui lòng ra vị trí thoáng để bắt lại GPS."
}
```

### 1.1.2. `POST /api/v1/reports/phase1`
* **Mô tả:** Khởi tạo hồ sơ khảo sát Giai đoạn 1 (Phase 1 Baseline) cho một thửa đất.
* **Request Body:** `{ "parcelId": "p-00105" }`
* **Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "reportId": "rep-p1-00105",
    "parcelId": "p-00105",
    "projectParcelCode": "B-00105",
    "status": "DRAFT",
    "createdAt": "2026-09-16T08:00:00.000Z"
  }
}
```

### 1.1.3. `POST /api/v1/reports/phase1/{reportId}/identification-photos`
* **Mô tả:** Bước 1 - Upload bộ 4 ảnh định danh mặt ngoài ($P-01$ Biển số nhà, $P-02$ Toàn cảnh mặt đứng, $P-03$ Hông trái, $P-04$ Hông phải) kèm JSON vector chấm 4 góc và phân tầng.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `p01File`, `p02File`, `p03File`, `p04File` (files binary, required)
  * `p02PointsJson` (string JSON): `[{"x": 120, "y": 850}, {"x": 890, "y": 830}, {"x": 870, "y": 150}, {"x": 140, "y": 180}]`
  * `p02FloorSplitJson` (string JSON): `[{"floor": 1, "y": 620}, {"floor": 2, "y": 390}]`
  * `p02CanvasTextJson` (string JSON): `[{"text": "3.8m", "x": 920, "y": 700}]`
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã lưu bộ ảnh định danh P01-P04. Ảnh P-02 đã được gửi vào hàng đợi AI nắn thẳng.",
  "data": {
    "p01Url": "https://s3.metro2.vn/photos/rep-p1-00105/P01_raw.jpg",
    "p02Url": "https://s3.metro2.vn/photos/rep-p1-00105/P02_raw.jpg",
    "p02AiJobId": "ai-job-p02-99812",
    "p03Url": "https://s3.metro2.vn/photos/rep-p1-00105/P03_raw.jpg",
    "p04Url": "https://s3.metro2.vn/photos/rep-p1-00105/P04_raw.jpg"
  }
}
```

### 1.1.4. `POST /api/v1/reports/phase1/{reportId}/zones`
* **Mô tả:** Bước 3 - Tạo Vùng khảo sát hư hỏng $Z-xx$ cho từng Tầng/Phòng, upload ảnh bối cảnh góc rộng $CTX$ và gán cấp độ Burland (0-5).
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `floorName` (string, required): `"Tầng 1 (Trệt)"`
  * `roomName` (string, required): `"Phòng khách phía trước"`
  * `componentType` (string, required): `"WALL"` | `"BEAM"` | `"COLUMN"` | `"SLAB"` | `"FLOOR"`
  * `burlandGrade` (integer, required): `2`
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
    "ctxPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/Z01_CTX_raw.jpg"
  }
}
```

### 1.1.5. `POST /api/v1/reports/phase1/zones/{zoneId}/defects`
* **Mô tả:** Bước 3 (Chi tiết) - Thả ghim khuyết tật $D-xx$ trên ảnh bối cảnh $Z-xx$, upload ảnh cận cảnh $CU$ có thước đo vạch mm (Scale Card), đo bề rộng $w_{max}$ và chiều dài $L$.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `pinX`, `pinY` (number, required): Tọa độ ghim trên ảnh CTX (0.0 - 100.0 %)
  * `defectType` (string, required): `"DIAGONAL_SHEAR_CRACK"` | `"VERTICAL_CRACK"` | `"HORIZONTAL_CRACK"` | `"WATER_SEEPAGE"` | `"SPALLING"`
  * `widthMaxMm` (number, required): `0.85`
  * `lengthMm` (number, required): `650.0`
  * `hasScaleCardInPhoto` (boolean, required): `true` *(Bắt buộc phải có thước mm)*
  * `cuPhotoFile` (file binary, required): Ảnh chụp cận cảnh sắc nét
* **Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "defectId": "def-01-z01",
    "defectCode": "D-01",
    "pinX": 42.5,
    "pinY": 68.2,
    "defectType": "DIAGONAL_SHEAR_CRACK",
    "widthMaxMm": 0.85,
    "lengthMm": 650.0,
    "hasScaleCardInPhoto": true,
    "cuPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/Z01_D01_CU_raw.jpg"
  }
}
```

### 1.1.6. `POST /api/v1/reports/phase1/{reportId}/calculate-scores`
* **Mô tả:** Bước 5 - Động cơ tự động tổng hợp số liệu, tính điểm suy giảm kết cấu ECS (0-24) và Xếp hạng Chỉ số tổn thương VI (*Low / Medium / High / Very High*).
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "ecsScore": 6,
    "ecsMaxScore": 24,
    "ecsRating": "FAIR",
    "viScore": 0.38,
    "viClass": "MEDIUM",
    "scoreBreakdown": {
      "structuralSystemScore": 2,
      "foundationCategoryScore": 2,
      "defectSeverityScore": 1,
      "deformationScore": 1
    }
  }
}
```

### 1.1.7. `POST /api/v1/reports/phase1/{reportId}/submit`
* **Mô tả:** Bước 6 - Nộp chính thức Báo cáo Phase 1 kèm ảnh chữ ký xác nhận của Chủ hộ và Cán bộ khảo sát $\rightarrow$ Chuyển trạng thái sang `SUBMITTED`.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `homeownerSignaturePhoto`, `surveyorSignaturePhoto`, `homeownerPresent: true`, `notes`
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Báo cáo Phase 1 đã nộp thành công. Chờ Zone Admin thẩm định.",
  "data": {
    "reportId": "rep-p1-00105",
    "status": "SUBMITTED",
    "submittedAt": "2026-09-16T09:30:00.000Z"
  }
}
```

### 1.1.8. `POST /api/v1/mutations/propose`
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
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã ghi nhận Đề xuất Tách thửa. Đã cấp mã mới từ Kho số Mở rộng (> 07000). Các thửa lân cận giữ nguyên 100%.",
  "data": {
    "mutationId": "mut-20260916-0001",
    "sourceParcelCode": "B-00002",
    "allocatedNewCodes": ["B-07001", "B-07002"],
    "status": "PENDING_APPROVAL"
  }
}
```

### 1.1.9. `POST /api/v1/phase2/reports/{reportId}/summarize-delta`
* **Mô tả:** Tổng kết biến động vết nứt Phase 2 vs Phase 1, tính toán $\Delta ECS$ và đưa ra Phán quyết tác động bồi thường (*NO_IMPACT | COSMETIC_DEFECT | STRUCTURAL_IMPACT*).
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "phase1EcsScore": 6,
    "phase2EcsScore": 9,
    "deltaEcs": 3,
    "totalOldDefectsVerified": 4,
    "widenedDefectsCount": 2,
    "compensationVerdict": "STRUCTURAL_IMPACT",
    "summaryConclusion": "Vết nứt phát triển lớn hơn 0.3mm do tác động đào hầm."
  }
}
```

---

## 1.2. NHÓM PHƯƠNG THỨC GET (Tra cứu, Tải dữ liệu, Theo dõi tiến độ)

### 1.2.1. `GET /api/v1/tasks/my-tasks`
* **Mô tả:** Lấy danh sách toàn bộ thửa đất được Zone Admin phân công cho Surveyor hiện tại.
* **Response `200 OK`:**
```json
{
  "success": true,
  "total": 5,
  "data": [
    {
      "taskId": "tsk-001",
      "parcelId": "p-00105",
      "projectParcelCode": "B-00105",
      "fieldSurveyCode": "KS003",
      "address": "854 Đường Trường Chinh, P.15, Tân Bình",
      "deadline": "2026-09-20T17:00:00.000Z",
      "taskStatus": "PENDING",
      "gpsTarget": { "lat": 10.79852, "lng": 106.64316 }
    }
  ]
}
```

### 1.2.2. `GET /api/v1/parcels/{parcelId}`
* **Mô tả:** Lấy chi tiết thông tin chủ hộ, địa chỉ, đa giác ranh nhà footprint của một thửa đất.
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "p-00105",
    "projectParcelCode": "B-00105",
    "fieldSurveyCode": "KS003",
    "ownerName": "Nguyễn Văn An",
    "addressFull": "854 Đường Trường Chinh, P.15, Tân Bình",
    "surveyStatus": "NOT_SURVEYED",
    "footprintGeoJson": { "type": "Polygon", "coordinates": [...] }
  }
}
```

### 1.2.3. `GET /api/v1/parcels/{parcelId}/phase2/zones`
* **Mô tả:** Động cơ Phase 2 theo vị trí đứng: Tự động tải về ảnh bối cảnh $CTX$ và toàn bộ ghim $D-xx$ cũ của đúng Tầng & Phòng mà Surveyor đang đứng.
* **Query Parameters:** `floor="Tầng 1 (Trệt)"`, `room="Phòng khách phía trước"`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "phase1ReportId": "rep-p1-00105",
    "zones": [
      {
        "zoneId": "z-01-p1-00105",
        "zoneCode": "Z-01",
        "ctxPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/Z01_CTX_raw.jpg",
        "defects": [
          {
            "defectId": "def-01-z01",
            "defectCode": "D-01",
            "pinX": 42.5,
            "pinY": 68.2,
            "phase1WidthMm": 0.85,
            "phase1LengthMm": 650.0,
            "phase1CuPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/Z01_D01_CU_raw.jpg"
          }
        ]
      }
    ]
  }
}
```

### 1.2.4. `GET /api/v1/photos/{photoId}/ai-status`
* **Mô tả:** Kiểm tra tiến độ đường ống AI nắn thẳng phối cảnh mặt đứng $P-02$.
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "photoId": "pho-p02-00105",
    "aiStatus": "COMPLETED",
    "rawPhotoUrl": "https://s3.metro2.vn/photos/P02_raw.jpg",
    "aiEnhancedPhotoUrl": "https://s3.metro2.vn/photos/P02_ai_rectified.png"
  }
}
```

---

## 1.3. NHÓM PHƯƠNG THỨC PUT (Cập nhật, Đo đạc, Đối soát Delta)

### 1.3.1. `PUT /api/v1/reports/phase1/{reportId}/specs`
* **Mô tả:** Bước 2 - Lưu trữ thông số kết cấu chịu lực, loại móng CAT 1-5, và độ nhạy cảm lịch sử E5.
* **Request Body:**
```json
{
  "useType": "RESIDENTIAL_COMMERCIAL",
  "numberOfFloors": 3,
  "hasBasement": false,
  "yearOfConstruction": 2012,
  "structuralSystem": "RC_FRAME",
  "foundationType": "CAT_3_SHALLOW_STRIP_FOOTING",
  "foundationDepthMeters": 2.5,
  "historicalSensitivityE5": "STANDARD_NOT_SENSITIVE"
}
```
* **Response `200 OK`:** `{ "success": true, "message": "Đã lưu đặc tính kết cấu công trình." }`

### 1.3.2. `PUT /api/v1/reports/phase1/{reportId}/deformation`
* **Mô tả:** Bước 4 - Lưu số liệu đo đạc biến dạng lún nghiêng (Tilt X/Y, nghiêng sàn, võng dầm).
* **Request Body:**
```json
{
  "tiltRatioX": "1/450",
  "tiltRatioY": "1/600",
  "tiltDirection": "TOWARD_METRO_ALIGNMENT",
  "maxFloorTiltPercent": 0.25,
  "maxBeamDeflectionMm": 4.5
}
```
* **Response `200 OK`:** `{ "success": true, "message": "Đã lưu số liệu đo biến dạng hình học." }`

### 1.3.3. `PUT /api/v1/phase2/defects/{defectId}/verify`
* **Mô tả:** Đối soát ghim cũ trong Phase 2: Nhập số đo mới $w_2, L_2$, upload ảnh CU mới. Động cơ tự động tính $\Delta w = w_2 - w_1, \Delta L = L_2 - L_1$.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `phase2WidthMm: 1.20`, `phase2LengthMm: 800.0`, `phase2CuPhotoFile: <binary>`, `notes`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "defectCode": "D-01",
    "phase1WidthMm": 0.85,
    "phase2WidthMm": 1.20,
    "deltaWidthMm": 0.35,
    "evolutionStatus": "WIDENED_AND_LENGTHENED",
    "pinColorCode": "#FF9800"
  }
}
```

### 1.3.4. `PUT /api/v1/parcels/{parcelId}/footprint`
* **Mô tả:** Cập nhật Đa giác ranh nhà thực tế (Building Footprint Polygon) sau khi đo quét cạn ngoài thực địa.
* **Request Body:** `{ "footprintGeoJson": { "type": "Polygon", "coordinates": [...] }, "areaSquareMeters": 98.5 }`
* **Response `200 OK`:** `{ "success": true, "message": "Đã cập nhật ranh nhà Footprint." }`

---

## 1.4. NHÓM PHƯƠNG THỨC DELETE (Xóa dữ liệu nháp)

### 1.4.1. `DELETE /api/v1/reports/phase1/zones/{zoneId}/defects/{defectId}`
* **Mô tả:** Xóa một ghim khuyết tật nháp bị thả nhầm trước khi nộp hồ sơ.
* **Response `200 OK`:** `{ "success": true, "message": "Đã xóa ghim khuyết tật." }`

---

# 2. VAI TRÒ 2: TỔ TRƯỞNG & QUẢN TRỊ PHÂN KHU (`ZONE_ADMIN`)
> **Nền tảng sử dụng:** Web Admin Portal trên màn hình lớn.  
> **Nhiệm vụ:** Phân công nhiệm vụ, thẩm định hồ sơ Split-Pane (Kính lúp 400%), duyệt/trả về báo cáo, duyệt biến động tách thửa, đóng gói Batch PDF Book.

---

## 2.1. NHÓM PHƯƠNG THỨC GET (Giám sát, Thẩm định, Báo cáo)

### 2.1.1. `GET /api/v1/admin/parcels/unassigned`
* **Mô tả:** Lấy danh sách các thửa đất trong Ga chưa được giao việc để hiển thị lên bản đồ GIS.
* **Query Parameters:** `zoneId="ZONE_S9"`
* **Response `200 OK`:** `{ "success": true, "total": 45, "data": [...] }`

### 2.1.2. `GET /api/v1/admin/reports/{reportId}/audit-view`
* **Mô tả:** Trả về payload thẩm định Split-Pane hoàn chỉnh: Cây cấu kiện & điểm số ECS/VI bên trái, cặp ảnh bối cảnh $CTX$ và cận cảnh $CU$ có thước đo vạch mm bên phải phục vụ soi kính lúp 400%.
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "reportId": "rep-p1-00105",
    "parcel": { "projectParcelCode": "B-00105", "ownerName": "Nguyễn Văn An", "address": "854 Trường Chinh" },
    "surveyor": { "name": "Nguyễn Văn Khảo Sát", "gpsAccuracyAtCheckin": 8.5 },
    "scores": { "ecsScore": 6, "viClass": "MEDIUM" },
    "zones": [
      {
        "zoneCode": "Z-01",
        "floor": "Tầng 1 (Trệt)",
        "ctxPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/Z01_CTX_raw.jpg",
        "defects": [
          {
            "defectCode": "D-01",
            "pinX": 42.5,
            "pinY": 68.2,
            "widthMaxMm": 0.85,
            "lengthMm": 650.0,
            "hasScaleCard": true,
            "cuPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/Z01_D01_CU_raw.jpg"
          }
        ]
      }
    ]
  }
}
```

### 2.1.3. `GET /api/v1/admin/reports`
* **Mô tả:** Tra cứu danh sách hồ sơ khảo sát theo Phân khu Ga, trạng thái (`SUBMITTED`, `APPROVED`, `REJECTED`), phân loại rủi ro VI.
* **Response `200 OK`:** `{ "success": true, "total": 120, "data": [...] }`

### 2.1.4. `GET /api/v1/reports/batch-export/{batchId}/status`
* **Mô tả:** Kiểm tra tiến độ đóng gói Tập hồ sơ phân khu Ga (PDF Book) và lấy link tải có kèm Checksum SHA-256.
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "batchId": "batch-s9-202609-001",
    "status": "COMPLETED",
    "totalReportsCompiled": 150,
    "downloadUrl": "https://s3.metro2.vn/dossiers/Dossier_Zone_S9_202609.pdf",
    "checksumSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
}
```

---

## 2.2. NHÓM PHƯƠNG THỨC POST (Phê duyệt, Trả về, Phân công, Đóng gói)

### 2.2.1. `POST /api/v1/admin/tasks/assign`
* **Mô tả:** Chọn danh sách thửa đất trên bản đồ GIS và giao cho một Surveyor kèm thời hạn hoàn thành.
* **Request Body:**
```json
{
  "parcelIds": ["p-00105", "p-00106", "p-00107"],
  "surveyorId": "u-001-surveyor",
  "deadline": "2026-09-20T17:00:00.000Z",
  "notes": "Khảo sát ưu tiên các căn mặt tiền trước."
}
```
* **Response `201 Created`:** `{ "success": true, "message": "Đã giao thành công 3 thửa đất." }`

### 2.2.2. `POST /api/v1/admin/reports/{reportId}/approve`
* **Mô tả:** Zone Admin phê duyệt Báo cáo (Phím tắt `A`). Tự động sinh file PDF/A chuẩn lưu trữ quốc tế, đóng dấu chữ ký số điện tử và lưu trữ S3.
* **Request Body:** `{ "engineeringJudgementNotes": "Hồ sơ ảnh CU đầy đủ thước đo mm hợp lệ." }`
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã phê duyệt Báo cáo khảo sát thành công. File PDF/A chính thức đã được xuất bản.",
  "data": {
    "reportId": "rep-p1-00105",
    "status": "APPROVED",
    "officialPdfUrl": "https://s3.metro2.vn/official_reports/REPORT_B00105_PHASE1_OFFICIAL.pdf",
    "approvedAt": "2026-09-16T10:15:00.000Z"
  }
}
```

### 2.2.3. `POST /api/v1/admin/reports/{reportId}/reject`
* **Mô tả:** Zone Admin trả về Báo cáo kèm lý do (Phím tắt `R`). Tự động rollback các biến động ranh đất liên quan và gửi cảnh báo đỏ cho Surveyor.
* **Request Body:** `{ "rejectionReason": "Ảnh CU D-01 thiếu thước đo vạch mm (Scale Card)." }`
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã trả về báo cáo khảo sát.",
  "data": { "reportId": "rep-p1-00105", "status": "REJECTED" }
}
```

### 2.2.4. `POST /api/v1/admin/mutations/{mutationId}/approve`
* **Mô tả:** Phê duyệt sự kiện Tách thửa trong PostgreSQL Transaction: Lưu trữ thửa cũ sang `SPLIT_DEPRECATED`, kích hoạt chính thức các thửa mới `B-07001`, `B-07002` lên GIS Master.
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã kích hoạt chính thức các thửa đất mới lên GIS Master.",
  "data": { "mutationId": "mut-20260916-0001", "status": "APPROVED", "activatedParcelCodes": ["B-07001", "B-07002"] }
}
```

### 2.2.5. `POST /api/v1/reports/batch-export`
* **Mô tả:** Khởi chạy tiến trình đóng gói toàn bộ 100-200 báo cáo đơn lẻ trong phân khu Ga thành 1 Tập Hồ sơ duy nhất (PDF Book Compilation) có bìa pháp lý, mục lục tự động, bản đồ GIS và mã SHA-256.
* **Request Body:** `{ "zoneId": "ZONE_S9", "format": "PDF_BOOK_COMPILATION" }`
* **Response `202 Accepted`:** `{ "success": true, "batchId": "batch-s9-202609-001", "status": "QUEUED" }`

---

## 2.3. NHÓM PHƯƠNG THỨC PUT (Điều chỉnh phân công)

### 2.3.1. `PUT /api/v1/admin/tasks/{taskId}/reassign`
* **Mô tả:** Chuyển giao nhiệm vụ khảo sát thửa đất sang một Cán bộ Khảo sát khác.
* **Request Body:** `{ "newSurveyorId": "u-002-surveyor", "reason": "Cán bộ u-001 chuyển công tác" }`
* **Response `200 OK`:** `{ "success": true, "message": "Đã chuyển giao nhiệm vụ thành công." }`

---

## 2.4. NHÓM PHƯƠNG THỨC DELETE (Hủy giao việc)

### 2.4.1. `DELETE /api/v1/admin/tasks/{taskId}`
* **Mô tả:** Hủy phân công nhiệm vụ khảo sát nếu chưa thực hiện.
* **Response `200 OK`:** `{ "success": true, "message": "Đã hủy phân công nhiệm vụ." }`

---

# 3. VAI TRÒ 3: TỔNG QUẢN TRỊ TOÀN TUYẾN (`SUPER_ADMIN`)
> **Nền tảng sử dụng:** Web Admin Master Portal (Ban Quản lý Đường sắt Đô thị - MAUR).  
> **Nhiệm vụ:** Quản lý toàn bộ 11 Ga, quản trị người dùng, cập nhật lớp GIS Tim tuyến và Ranh mặt bằng Metro 2.

---

## 3.1. NHÓM PHƯƠNG THỨC GET (Toàn cảnh & Quản trị)

### 3.1.1. `GET /api/v1/zones`
* **Mô tả:** Lấy danh sách toàn bộ 11 Ga Metro 2 kèm thống kê tổng số thửa, số lượng đã khảo sát, số lượng đã duyệt và tỷ lệ hoàn thành (%).
* **Response `200 OK`:**
```json
{
  "success": true,
  "total": 11,
  "data": [
    { "id": "ZONE_S1", "name": "Ga S1 - Bến Thành", "totalParcels": 420, "progressPercent": 92.8 },
    { "id": "ZONE_S9", "name": "Ga S9 - Bà Quẹo", "totalParcels": 650, "progressPercent": 64.6 }
  ]
}
```

### 3.1.2. `GET /api/v1/admin/users`
* **Mô tả:** Danh sách toàn bộ nhân sự (Zone Admin, Surveyor, Contractor) kèm phân khu và trạng thái hoạt động.
* **Response `200 OK`:** `{ "success": true, "total": 35, "data": [...] }`

---

## 3.2. NHÓM PHƯƠNG THỨC POST (Khởi tạo tài khoản & Import dữ liệu)

### 3.2.1. `POST /api/v1/admin/users`
* **Mô tả:** Cấp tài khoản nội bộ mới cho Zone Admin hoặc Surveyor.
* **Request Body:**
```json
{
  "username": "zoneadmin_s10",
  "password": "Admin@123",
  "fullName": "Trần Văn Điều Phối",
  "role": "ZONE_ADMIN",
  "assignedZoneId": "ZONE_S10"
}
```
* **Response `201 Created`:** `{ "success": true, "message": "Tạo tài khoản thành công." }`

### 3.2.2. `POST /api/v1/admin/gis/import-parcels`
* **Mô tả:** Import hàng loạt thửa đất địa chính ban đầu từ file GeoJSON / Shapefile của Sở TN&MT.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `zoneId: "ZONE_S9"`, `geoJsonFile: <binary>`
* **Response `201 Created`:** `{ "success": true, "importedParcelsCount": 650 }`

---

## 3.3. NHÓM PHƯƠNG THỨC PUT (Cập nhật lớp GIS & Trạng thái tài khoản)

### 3.3.1. `PUT /api/v1/admin/gis/layers/metro-alignment`
* **Mô tả:** Cập nhật lớp GIS Tim tuyến Metro 2 và Vùng ảnh hưởng trực tiếp (Zone of Influence - ZOI).
* **Request Body:** `{ "centerlineGeoJson": { "type": "LineString", "coordinates": [...] }, "zoiBufferMeters": 50.0 }`
* **Response `200 OK`:** `{ "success": true, "message": "Đã cập nhật Tim tuyến Metro 2." }`

### 3.3.2. `PUT /api/v1/admin/users/{userId}/status`
* **Mô tả:** Khóa hoặc kích hoạt lại tài khoản người dùng (`ACTIVE` | `SUSPENDED`).
* **Request Body:** `{ "status": "SUSPENDED", "reason": "Nghỉ việc" }`
* **Response `200 OK`:** `{ "success": true, "message": "Đã cập nhật trạng thái tài khoản." }`

---

## 3.4. NHÓM PHƯƠNG THỨC DELETE (Vô hiệu hóa tài khoản)

### 3.4.1. `DELETE /api/v1/admin/users/{userId}`
* **Mô tả:** Thu hồi và xóa tài khoản nhân sự.
* **Response `200 OK`:** `{ "success": true, "message": "Đã xóa tài khoản." }`

---

# 4. VAI TRÒ 4: NHÀ THẦU XÂY LẮP & KHÁCH TRA CỨU (`CONTRACTOR_GUEST`)
> **Nền tảng sử dụng:** Web Portal / API Gateway Read-Only.  
> **Nhiệm vụ:** Tra cứu dữ liệu hiện trạng công trình trước khi thi công ngầm, tải Tập hồ sơ PDF chính thức có mã băm SHA-256.

---

## 4.1. NHÓM PHƯƠNG THỨC GET (Tra cứu & Tải dữ liệu công bố)

### 4.1.1. `GET /api/v1/guest/gis-map`
* **Mô tả:** Tra cứu bản đồ GIS quy hoạch và ranh giới các công trình đã được thẩm định duyệt thông qua Share Token an toàn.
* **Query Parameters:** `shareToken="SECURE_TOKEN_ABC"`, `passcode="123456"`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "zoneName": "Ga S9 - Bà Quẹo",
    "metroCenterlineGeoJson": { "type": "LineString", "coordinates": [...] },
    "parcelsGeoJson": {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {
            "parcelCode": "B-00105",
            "ownerName": "Nguyễn Văn An",
            "viClass": "MEDIUM",
            "surveyStatus": "APPROVED"
          },
          "geometry": { "type": "Polygon", "coordinates": [...] }
        }
      ]
    }
  }
}
```

### 4.1.2. `GET /api/v1/guest/parcels/{parcelId}/summary`
* **Mô tả:** Xem tóm tắt thông số kỹ thuật và cấp độ rủi ro tổn thương VI của một công trình đã được công bố.
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "projectParcelCode": "B-00105",
    "address": "854 Đường Trường Chinh, P.15, Tân Bình",
    "numberOfFloors": 3,
    "structuralSystem": "Khung BTCT chịu lực",
    "foundationType": "Móng băng nông (CAT 3)",
    "ecsScore": "6/24 (Tình trạng Khá)",
    "viClass": "MEDIUM (Rủi ro Trung bình)",
    "officialReportPdfUrl": "https://s3.metro2.vn/official_reports/REPORT_B00105_PHASE1_OFFICIAL.pdf"
  }
}
```

### 4.1.3. `GET /api/v1/guest/dossiers/{batchId}/download`
* **Mô tả:** Tải Tập Hồ Sơ Đóng Gói Toàn Phân Khu (PDF Book Compilation) kèm mã băm Checksum SHA-256 để đối chiếu tính toàn vẹn pháp lý.
* **Response `200 OK`:** Trả về Stream tải file PDF và Header `X-Checksum-SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

---

## 5. BẢNG MA TRẬN PHÂN QUYỀN TOÀN BỘ 28 ENDPOINTS (RBAC MATRIX)

| STT | Phương thức | Endpoint URL | Vai trò được phép truy cập |
| :---: | :---: | :--- | :--- |
| **I** | **XÁC THỰC** | | |
| 1 | `POST` | `/api/v1/auth/login` | `Public` |
| 2 | `POST` | `/api/v1/auth/refresh-token` | `Public` |
| 3 | `GET` | `/api/v1/auth/me` | `All Authenticated Roles` |
| 4 | `POST` | `/api/v1/auth/logout` | `All Authenticated Roles` |
| **II** | **SURVEYOR** | | |
| 5 | `POST` | `/api/v1/attendance/check-in` | `SURVEYOR` |
| 6 | `GET` | `/api/v1/tasks/my-tasks` | `SURVEYOR` |
| 7 | `GET` | `/api/v1/parcels/{id}` | `SURVEYOR`, `ZONE_ADMIN`, `SUPER_ADMIN` |
| 8 | `POST` | `/api/v1/reports/phase1` | `SURVEYOR` |
| 9 | `POST` | `/api/v1/reports/phase1/{id}/identification-photos` | `SURVEYOR` |
| 10 | `PUT` | `/api/v1/reports/phase1/{id}/specs` | `SURVEYOR` |
| 11 | `POST` | `/api/v1/reports/phase1/{id}/zones` | `SURVEYOR` |
| 12 | `POST` | `/api/v1/reports/phase1/zones/{id}/defects` | `SURVEYOR` |
| 13 | `PUT` | `/api/v1/reports/phase1/{id}/deformation` | `SURVEYOR` |
| 14 | `POST` | `/api/v1/reports/phase1/{id}/calculate-scores` | `SURVEYOR`, `ZONE_ADMIN` |
| 15 | `POST` | `/api/v1/reports/phase1/{id}/submit` | `SURVEYOR` |
| 16 | `GET` | `/api/v1/parcels/{id}/phase2/zones` | `SURVEYOR`, `ZONE_ADMIN` |
| 17 | `PUT` | `/api/v1/phase2/defects/{id}/verify` | `SURVEYOR` |
| 18 | `POST` | `/api/v1/phase2/reports/{id}/summarize-delta` | `SURVEYOR`, `ZONE_ADMIN` |
| 19 | `POST` | `/api/v1/mutations/propose` | `SURVEYOR` |
| 20 | `PUT` | `/api/v1/parcels/{id}/footprint` | `SURVEYOR`, `ZONE_ADMIN` |
| **III**| **ZONE ADMIN** | | |
| 21 | `GET` | `/api/v1/admin/parcels/unassigned` | `ZONE_ADMIN`, `SUPER_ADMIN` |
| 22 | `POST` | `/api/v1/admin/tasks/assign` | `ZONE_ADMIN`, `SUPER_ADMIN` |
| 23 | `GET` | `/api/v1/admin/reports/{id}/audit-view` | `ZONE_ADMIN`, `SUPER_ADMIN` |
| 24 | `POST` | `/api/v1/admin/reports/{id}/approve` | `ZONE_ADMIN` |
| 25 | `POST` | `/api/v1/admin/reports/{id}/reject` | `ZONE_ADMIN` |
| 26 | `POST` | `/api/v1/admin/mutations/{id}/approve` | `ZONE_ADMIN`, `SUPER_ADMIN` |
| 27 | `POST` | `/api/v1/reports/batch-export` | `ZONE_ADMIN`, `SUPER_ADMIN` |
| **IV** | **SUPER ADMIN**| | |
| 28 | `POST` | `/api/v1/admin/users` | `SUPER_ADMIN` |
| 29 | `PUT` | `/api/v1/admin/gis/layers/metro-alignment` | `SUPER_ADMIN` |
| **V**  | **GUEST** | | |
| 30 | `GET` | `/api/v1/guest/gis-map` | `CONTRACTOR_GUEST`, `Public (ShareToken)` |
| 31 | `GET` | `/api/v1/guest/dossiers/{id}/download` | `CONTRACTOR_GUEST` |
