# ĐẶC TẢ CHI TIẾT HỆ THỐNG RESTFUL API (API SPECIFICATION & CONTRACT)
## HỆ THỐNG KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH - METRO SỐ 2 (BẾN THÀNH – THAM LƯƠNG)

> [!IMPORTANT]
> **TÀI LIỆU QUY CHUẨN API CONTRACT DÀNH CHO TOÀN BỘ PHÁT TRIỂN (API FIRST DESIGN):**
> Tài liệu này định nghĩa toàn bộ 12 phân hệ nghiệp vụ, 28 endpoints RESTful API, cấu trúc Request/Response JSON, mã lỗi HTTP chuẩn RFC 7807 (`application/problem+json`), ràng buộc bảo mật RBAC 4 cấp, kiến trúc Mã kép (Dual-ID) và kiểu dữ liệu hình học PostGIS GeoJSON.

---

## 1. QUY CHUẨN CHUNG CỦA HỆ THỐNG API

### 1.1. Base URL & Phiên bản hóa
* **Base URL:** `https://api.metro2-survey.hcmc.gov.vn/api/v1` (Môi trường Production)
* **Local Development Base URL:** `http://localhost:5000/api/v1`
* Toàn bộ API đều sử dụng tiền tố `/api/v1/` để đảm bảo tính tương thích ngược khi nâng cấp phiên bản.

### 1.2. Chuẩn Xác thực & Phân quyền (Authentication & RBAC)
Hệ thống sử dụng **JSON Web Token (JWT)** truyền qua HTTP Header:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

#### Ma trận Phân quyền 4 Cấp (4-Tier RBAC):
| Vai trò (`Role`) | Quyền hạn chính |
| :--- | :--- |
| `SUPER_ADMIN` | Toàn quyền quản trị 11 Ga Metro 2, quản lý người dùng, cập nhật lớp GIS Tim tuyến, phê duyệt biến động cấp cao. |
| `ZONE_ADMIN` | Quản lý & giao việc trong Phân khu Ga được giao, kiểm duyệt hồ sơ Split-Pane (Kính lúp 400%), Duyệt/Trả hồ sơ, Đóng gói Batch PDF. |
| `SURVEYOR` | Check-in GPS thực địa, thực hiện khảo sát 9 bước Phase 1 & 2, upload ảnh đa lớp, đo vẽ ranh footprint, nộp hồ sơ. |
| `CONTRACTOR_GUEST` | Truy cập chế độ Read-Only qua Share Token, tra cứu bản đồ GIS các thửa đất đã duyệt, tải tập hồ sơ PDF đã công bố. |

### 1.3. Chuẩn Định dạng Dữ liệu (Payload Standards)
* **Content-Type:** `application/json; charset=utf-8` (đối với dữ liệu cấu trúc)
* **Multipart Form-Data:** `multipart/form-data` (đối với các API upload hình ảnh bối cảnh CTX, cận cảnh CU, ảnh selfie chấm công)
* **Chuẩn Tọa độ Không gian (Spatial Coordinates):** Luôn sử dụng hệ tọa độ WGS84 (`EPSG:4326`), định dạng chuẩn **GeoJSON** (`Point`, `Polygon`, `MultiPolygon`).
* **Chuẩn Thời gian:** Định dạng chuẩn ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).

### 1.4. Chuẩn Phản hồi Lỗi Hệ thống (RFC 7807 Problem Details)
Mọi phản hồi lỗi (HTTP 4xx, 5xx) đều có cấu trúc JSON đồng nhất:
```json
{
  "type": "https://api.metro2-survey.hcmc.gov.vn/errors/INVALID_GPS_ACCURACY",
  "title": "Độ chính xác GPS không đạt yêu cầu",
  "status": 422,
  "detail": "Độ chính xác GPS hiện tại là 45.2m (yêu cầu tối đa <= 20.0m để đảm bảo tính pháp lý).",
  "instance": "/api/v1/attendance/check-in",
  "code": "ERR_GPS_ACCURACY_EXCEEDED",
  "timestamp": "2026-09-16T10:50:00.000Z",
  "errors": [
    {
      "field": "accuracy",
      "rejectedValue": 45.2,
      "message": "Giá trị accuracy phải nhỏ hơn hoặc bằng 20.0 mét."
    }
  ]
}
```

---

## 2. DANH MỤC 12 PHÂN HỆ VÀ 28 REST API ENDPOINTS

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             METRO 2 RESTFUL API MODULES                          │
├────────────────────────────────┬─────────────────────────────────────────────────┤
│ 1. Auth & IAM                  │ Đăng nhập JWT, Cấp lại Token, Thông tin cá nhân │
│ 2. Attendance & Check-in       │ Chấm công GPS thực địa, Selfie xác thực         │
│ 3. Metro Zones & GIS Boundary  │ 11 Ga Metro 2, Ranh phân khu & Tim tuyến        │
│ 4. Parcels & Dual-ID           │ Quản lý Thửa đất, Mã kép (B-xxxxx & KSxxx)      │
│ 5. Task Dispatching            │ Phân công nhiệm vụ khảo sát trên bản đồ GIS     │
│ 6. Phase 1 Survey (9 Steps)    │ Khảo sát nền: P01-P04, Specs, Zones, Defects    │
│ 7. AI Photo Rectification      │ Nắn phẳng phối cảnh mặt đứng P-02 chuẩn CAD     │
│ 8. Phase 2 Delta Engine        │ Đối soát biến động theo vị trí, Đánh giá đền bù │
│ 9. Parcel Mutation Engine      │ Giao dịch Tách/Gộp thửa, Kho số > 07000         │
│ 10. Admin Audit & Split-Pane   │ Kiểm duyệt hồ sơ, Kính lúp 400%, Duyệt/Trả về   │
│ 11. Batch Dossier Compilation  │ Đóng gói Báo cáo hàng loạt, Mã băm SHA-256      │
│ 12. Public Contractor/Guest    │ Tra cứu GIS công khai, Tải báo cáo qua Token    │
└────────────────────────────────┴─────────────────────────────────────────────────┘
```

---

## 3. ĐẶC TẢ CHI TIẾT TỪNG ENDPOINT API

---

### PHÂN HỆ 1: XÁC THỰC & PHÂN QUYỀN (AUTH & IAM)

#### 1.1. `POST /api/v1/auth/login`
* **Mô tả:** Xác thực người dùng bằng Tên đăng nhập / Mật khẩu, trả về JWT Access Token (hạn 7 ngày) và Refresh Token.
* **Quyền truy cập:** Public
* **Request Headers:** `Content-Type: application/json`
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

#### 1.2. `GET /api/v1/auth/me`
* **Mô tả:** Lấy thông tin tài khoản hiện tại từ JWT token.
* **Quyền truy cập:** `SUPER_ADMIN`, `ZONE_ADMIN`, `SURVEYOR`, `CONTRACTOR`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "u-001-surveyor",
    "username": "surveyor_01",
    "fullName": "Nguyễn Văn Khảo Sát",
    "role": "SURVEYOR",
    "phone": "0901234567",
    "email": "surveyor01@metro2.vn",
    "assignedZone": {
      "id": "ZONE_S9",
      "code": "S9",
      "name": "Ga S9 - Bà Quẹo",
      "district": "Tân Bình"
    }
  }
}
```

---

### PHÂN HỆ 2: CHẤM CÔNG GPS HIỆN TRƯỜNG (ATTENDANCE & TIMEKEEPING)

#### 2.1. `POST /api/v1/attendance/check-in`
* **Mô tả:** Cán bộ khảo sát thực hiện check-in hiện trường bằng tọa độ GPS thực tế và ảnh Selfie có watermark thời gian thực.
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `zoneId` (string, required): Mã phân khu, ví dụ `"ZONE_S9"`
  * `gpsLat` (number, required): Vĩ độ thực tế, ví dụ `10.798123`
  * `gpsLng` (number, required): Kinh độ thực tế, ví dụ `106.645678`
  * `accuracy` (number, required): Sai số GPS (mét), ví dụ `8.5` *(Bắt buộc `<= 20.0m`)*
  * `selfieFile` (file binary, required): File ảnh chụp trực tiếp tại hiện trường (`.jpg`, `.jpeg`, `.png`)
  * `accompanyingMembers` (string, optional): Danh sách cán bộ đi cùng (JSON array string `["Trần Văn A", "Lê Văn B"]`)
  * `notes` (string, optional): Ghi chú thời tiết hoặc tình hình hiện trường
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Chấm công GPS hiện trường thành công. Đã mở quyền khảo sát.",
  "data": {
    "checkinId": "chk-20260916-0001",
    "surveyorId": "u-001-surveyor",
    "zoneId": "ZONE_S9",
    "checkinTime": "2026-09-16T07:45:12.120Z",
    "gpsLat": 10.798123,
    "gpsLng": 106.645678,
    "accuracy": 8.5,
    "selfiePhotoUrl": "https://s3.metro2.vn/attendance/20260916/selfie_u001_074512.jpg",
    "isWithinAssignedZone": true
  }
}
```
* **Response `422 Unprocessable Entity` (GPS sai số lớn):**
```json
{
  "code": "ERR_GPS_ACCURACY_EXCEEDED",
  "message": "Độ chính xác GPS hiện tại là 35m, vượt quá giới hạn cho phép (tối đa 20m). Vui lòng ra vị trí thoáng để bắt lại GPS."
}
```

---

### PHÂN HỆ 3: PHÂN KHU GA METRO 2 & LỚP BẢN ĐỒ GIS (METRO ZONES & GIS)

#### 3.1. `GET /api/v1/zones`
* **Mô tả:** Lấy danh sách toàn bộ 11 Ga Metro số 2 (Bến Thành - Tham Lương) kèm thống kê tiến độ khảo sát.
* **Quyền truy cập:** Public / Authenticated
* **Response `200 OK`:**
```json
{
  "success": true,
  "total": 11,
  "data": [
    {
      "id": "ZONE_S1",
      "code": "S1",
      "name": "Ga S1 - Bến Thành",
      "district": "Quận 1",
      "chainageStartKm": 0.000,
      "chainageEndKm": 0.850,
      "totalParcels": 420,
      "surveyedCount": 390,
      "approvedCount": 380,
      "progressPercent": 92.8
    },
    {
      "id": "ZONE_S9",
      "code": "S9",
      "name": "Ga S9 - Bà Quẹo",
      "district": "Tân Bình",
      "chainageStartKm": 8.200,
      "chainageEndKm": 9.450,
      "totalParcels": 650,
      "surveyedCount": 420,
      "approvedCount": 385,
      "progressPercent": 64.6
    }
  ]
}
```

#### 3.2. `GET /api/v1/zones/{zoneId}`
* **Mô tả:** Lấy chi tiết một phân khu Ga kèm Đa giác ranh giới GeoJSON và Tim tuyến Metro 2.
* **Quyền truy cập:** Authenticated
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "ZONE_S9",
    "code": "S9",
    "name": "Ga S9 - Bà Quẹo",
    "boundaryGeoJson": {
      "type": "Polygon",
      "coordinates": [
        [
          [106.64000, 10.79500],
          [106.65000, 10.79500],
          [106.65000, 10.80500],
          [106.64000, 10.80500],
          [106.64000, 10.79500]
        ]
      ]
    },
    "centerlineGeoJson": {
      "type": "LineString",
      "coordinates": [
        [106.64100, 10.79600],
        [106.64900, 10.80400]
      ]
    }
  }
}
```

---

### PHÂN HỆ 4: THỬA ĐẤT & KIẾN TRÚC MÃ KÉP (PARCELS & DUAL-ID)

#### 4.1. `GET /api/v1/parcels`
* **Mô tả:** Tra cứu danh sách thửa đất theo Phân khu Ga, trạng thái khảo sát, bounding box tọa độ GIS hoặc từ khóa tìm kiếm mã kép.
* **Query Parameters:**
  * `zoneId` (string, optional): Ví dụ `ZONE_S9`
  * `surveyStatus` (string, optional): `NOT_SURVEYED` | `IN_PROGRESS` | `SUBMITTED` | `APPROVED` | `REJECTED`
  * `lifecycleStatus` (string, optional): `ACTIVE` | `PENDING_MUTATION_APPROVAL` | `SPLIT_DEPRECATED` | `MERGED_DEPRECATED`
  * `search` (string, optional): Tìm kiếm theo Mã dự án `B-00105` hoặc Mã hiện trường `KS003` hoặc Tên chủ hộ
  * `bbox` (string, optional): `minLng,minLat,maxLng,maxLat`
  * `page` (integer, default: 1), `limit` (integer, default: 50)
* **Response `200 OK`:**
```json
{
  "success": true,
  "page": 1,
  "limit": 50,
  "total": 1,
  "data": [
    {
      "id": "p-00105",
      "projectParcelCode": "B-00105",
      "fieldSurveyCode": "KS003",
      "cadastralNumber": "124/TB-2024",
      "houseNumber": "854",
      "street": "Đường Trường Chinh",
      "ward": "Phường 15",
      "district": "Tân Bình",
      "ownerName": "Nguyễn Văn An",
      "contactPhone": "0987654321",
      "zoneId": "ZONE_S9",
      "zoneName": "Ga S9 - Bà Quẹo",
      "surveyStatus": "NOT_SURVEYED",
      "lifecycleStatus": "ACTIVE",
      "viClass": null,
      "footprintGeoJson": {
        "type": "Polygon",
        "coordinates": [
          [
            [106.64312, 10.79845],
            [106.64320, 10.79845],
            [106.64320, 10.79860],
            [106.64312, 10.79860],
            [106.64312, 10.79845]
          ]
        ]
      },
      "centerPoint": {
        "lat": 10.79852,
        "lng": 106.64316
      }
    }
  ]
}
```

#### 4.2. `GET /api/v1/parcels/{parcelId}`
* **Mô tả:** Lấy toàn bộ thông tin chi tiết của một thửa đất, bao gồm lịch sử khảo sát Phase 1 / Phase 2 và các sự kiện biến động (nếu có).
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "p-00105",
    "projectParcelCode": "B-00105",
    "fieldSurveyCode": "KS003",
    "ownerName": "Nguyễn Văn An",
    "addressFull": "854 Đường Trường Chinh, Phường 15, Quận Tân Bình, TP.HCM",
    "zoneId": "ZONE_S9",
    "surveyStatus": "SUBMITTED",
    "lifecycleStatus": "ACTIVE",
    "activePhase1ReportId": "rep-p1-00105",
    "activePhase2ReportId": null,
    "mutationHistory": []
  }
}
```

#### 4.3. `PUT /api/v1/parcels/{parcelId}/footprint`
* **Mô tả:** Cập nhật Đa giác ranh nhà thực tế (Building Footprint Polygon) sau khi Surveyor đo vẽ quét cạn ngoài thực địa.
* **Quyền truy cập:** `SURVEYOR`, `ZONE_ADMIN`
* **Request Body:**
```json
{
  "footprintGeoJson": {
    "type": "Polygon",
    "coordinates": [
      [
        [106.64310, 10.79840],
        [106.64325, 10.79840],
        [106.64325, 10.79865],
        [106.64310, 10.79865],
        [106.64310, 10.79840]
      ]
    ]
  },
  "areaSquareMeters": 98.5
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã cập nhật Đa giác ranh nhà Footprint thành công."
}
```

---

### PHÂN HỆ 5: GIAO VIỆC & PHÂN CÔNG KHẢO SÁT (TASK DISPATCHING)

#### 5.1. `POST /api/v1/admin/tasks/assign`
* **Mô tả:** Tổ trưởng (Zone Admin) chọn danh sách các thửa đất trên bản đồ GIS và giao cho một Cán bộ Khảo sát (Surveyor) kèm thời hạn hoàn thành.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Request Body:**
```json
{
  "parcelIds": ["p-00105", "p-00106", "p-00107"],
  "surveyorId": "u-001-surveyor",
  "deadline": "2026-09-20T17:00:00.000Z",
  "notes": "Ưu tiên khảo sát các căn mặt tiền trước để phục vụ đóng cừ Larsen."
}
```
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã giao thành công 3 thửa đất cho Cán bộ khảo sát.",
  "data": {
    "assignedCount": 3,
    "surveyorName": "Nguyễn Văn Khảo Sát",
    "deadline": "2026-09-20T17:00:00.000Z"
  }
}
```

#### 5.2. `GET /api/v1/tasks/my-tasks`
* **Mô tả:** Cán bộ khảo sát lấy danh sách các công trình được phân công cho mình tại hiện trường.
* **Quyền truy cập:** `SURVEYOR`
* **Response `200 OK`:**
```json
{
  "success": true,
  "total": 3,
  "data": [
    {
      "taskId": "tsk-001",
      "parcelId": "p-00105",
      "projectParcelCode": "B-00105",
      "fieldSurveyCode": "KS003",
      "address": "854 Đường Trường Chinh",
      "deadline": "2026-09-20T17:00:00.000Z",
      "taskStatus": "PENDING",
      "gpsTarget": { "lat": 10.79852, "lng": 106.64316 }
    }
  ]
}
```

---

### PHÂN HỆ 6: KHẢO SÁT GIAI ĐOẠN 1 - 9 BƯỚC THỰC ĐỊA (PHASE 1 SURVEY)

#### 6.1. `POST /api/v1/reports/phase1`
* **Mô tả:** Khởi tạo hồ sơ khảo sát Giai đoạn 1 (Phase 1 Baseline Assessment) cho thửa đất.
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:**
```json
{
  "parcelId": "p-00105"
}
```
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã tạo hồ sơ khảo sát Phase 1",
  "data": {
    "reportId": "rep-p1-00105",
    "parcelId": "p-00105",
    "projectParcelCode": "B-00105",
    "status": "DRAFT",
    "createdAt": "2026-09-16T08:00:00.000Z"
  }
}
```

#### 6.2. `POST /api/v1/reports/phase1/{reportId}/identification-photos`
* **Mô tả:** Bước 1 - Upload bộ 4 ảnh định danh mặt ngoài ($P-01$ Biển số nhà/ngõ, $P-02$ Toàn cảnh mặt đứng chính, $P-03$ Bên trái, $P-04$ Bên phải) kèm vector annotation.
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `p01File`: File ảnh biển số nhà
  * `p02File`: File ảnh toàn cảnh mặt đứng
  * `p03File`: File ảnh hông trái
  * `p04File`: File ảnh hông phải
  * `p02PointsJson`: String JSON chứa 4 điểm góc đa giác nhà trên ảnh P-02 `[{"x": 120, "y": 850}, {"x": 890, "y": 830}, {"x": 870, "y": 150}, {"x": 140, "y": 180}]`
  * `p02FloorSplitJson`: String JSON chứa tọa độ các đường phân tầng dầm sàn `[{"floor": 1, "y": 620}, {"floor": 2, "y": 390}]`
  * `p02CanvasTextJson`: String JSON chứa chữ viết tay kích thước `[{"text": "3.8m", "x": 920, "y": 700}]`
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

#### 6.3. `PUT /api/v1/reports/phase1/{reportId}/specs`
* **Mô tả:** Bước 2 - Lưu thông số kiến trúc, kết cấu chịu lực, loại móng (CAT 1-5), và độ nhạy cảm lịch sử (E5).
* **Quyền truy cập:** `SURVEYOR`
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
  "historicalSensitivityE5": "STANDARD_NOT_SENSITIVE",
  "roofType": "REINFORCED_CONCRETE_SLAB",
  "wallType": "BRICK_200MM"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã lưu đặc tính kết cấu công trình thành công."
}
```

#### 6.4. `POST /api/v1/reports/phase1/{reportId}/zones`
* **Mô tả:** Bước 3 - Khởi tạo Vùng khảo sát hư hỏng $Z-xx$ cho từng Tầng/Phòng, upload ảnh bối cảnh CTX rộng và đánh giá cấp độ hư hại Burland (0-5).
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `floorName` (string, required): `"Tầng 1 (Trệt)"`
  * `roomName` (string, required): `"Phòng khách phía trước"`
  * `componentType` (string, required): `"WALL"` | `"BEAM"` | `"COLUMN"` | `"SLAB"` | `"FLOOR"`
  * `burlandGrade` (integer, required): `2` *(Cấp độ Burland từ 0 đến 5)*
  * `ctxPhotoFile` (file binary, required): File ảnh bối cảnh góc rộng toàn diện
  * `notes` (string, optional): `"Tường tiếp giáp nhà số 856"`
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã tạo Vùng hư hại Z-01 thành công.",
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

#### 6.5. `POST /api/v1/reports/phase1/zones/{zoneId}/defects`
* **Mô tả:** Bước 3 (Chi tiết) - Thả ghim vết nứt/khuyết tật $D-xx$ trên ảnh bối cảnh $Z-xx$, upload ảnh cận cảnh CU có thước đo vạch mm (Scale Card), đo bề rộng $w_{max}$ và chiều dài $L$.
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `pinX` (number, required): Tọa độ X trên ảnh CTX (phần trăm 0.0 - 100.0), ví dụ `42.5`
  * `pinY` (number, required): Tọa độ Y trên ảnh CTX (phần trăm 0.0 - 100.0), ví dụ `68.2`
  * `defectType` (string, required): `"DIAGONAL_SHEAR_CRACK"` | `"VERTICAL_CRACK"` | `"HORIZONTAL_CRACK"` | `"WATER_SEEPAGE"` | `"SPALLING"`
  * `widthMaxMm` (number, required): Độ mở rộng lớn nhất của vết nứt (mm), ví dụ `0.85`
  * `lengthMm` (number, required): Chiều dài vết nứt (mm), ví dụ `650.0`
  * `hasScaleCardInPhoto` (boolean, required): `true` *(Bắt buộc phải có thước đo vạch mm trong khung hình)*
  * `cuPhotoFile` (file binary, required): File ảnh chụp cận cảnh sắc nét
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã tạo Ghim khuyết tật D-01 trên Vùng Z-01 thành công.",
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

#### 6.6. `PUT /api/v1/reports/phase1/{reportId}/deformation`
* **Mô tả:** Bước 4 - Lưu trữ số liệu đo đạc biến dạng hình học: Độ nghiêng tổng thể công trình theo 2 phương X/Y (Tilt X/Y), độ nghiêng sàn và độ võng dầm/sàn.
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:**
```json
{
  "tiltRatioX": "1/450",
  "tiltRatioY": "1/600",
  "tiltDirection": "TOWARD_METRO_ALIGNMENT",
  "maxFloorTiltPercent": 0.25,
  "maxBeamDeflectionMm": 4.5,
  "measurementToolUsed": "DIGITAL_THEODOLITE_LEICA",
  "notes": "Độ nghiêng về phía lòng đường Trường Chinh 1/450"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã lưu số liệu đo đạc biến dạng lún nghiêng thành công."
}
```

#### 6.7. `POST /api/v1/reports/phase1/{reportId}/calculate-scores`
* **Mô tả:** Bước 5 - Động cơ tự động tổng hợp dữ liệu, chấm điểm Độ suy giảm kết cấu ECS (0 - 24) và Xếp hạng Chỉ số tổn thương VI (Vulnerability Index: *Low / Medium / High / Very High*).
* **Quyền truy cập:** `SURVEYOR`, `ZONE_ADMIN`, `SYSTEM`
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Tính toán điểm số ECS và VI hoàn tất.",
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
    },
    "recommendation": "Cần giám sát chuyển vị thường xuyên trong giai đoạn đào hầm TBM."
  }
}
```

#### 6.8. `POST /api/v1/reports/phase1/{reportId}/submit`
* **Mô tả:** Bước 6 - Nộp chính thức Báo cáo khảo sát Phase 1 về cho Tổ trưởng (Zone Admin) kèm chữ ký số/ảnh chụp biên bản xác nhận của Chủ hộ.
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `homeownerSignaturePhoto`: File ảnh chữ ký chủ hộ hoặc biên bản ký tươi tại hiện trường
  * `surveyorSignaturePhoto`: File ảnh chữ ký cán bộ khảo sát
  * `homeownerPresent`: `true`
  * `homeownerFeedbackNotes`: `"Gia đình đồng thuận với các ghi nhận vết nứt hiện trạng."`
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Báo cáo Phase 1 đã được nộp thành công (Status: SUBMITTED). Chờ Zone Admin thẩm định.",
  "data": {
    "reportId": "rep-p1-00105",
    "status": "SUBMITTED",
    "submittedAt": "2026-09-16T09:30:00.000Z"
  }
}
```

---

### PHÂN HỆ 7: ĐƯỜNG ỐNG AI NẮN PHẲNG MẶT ĐỨNG P-02 (AI PHOTO RECTIFICATION)

#### 7.1. `POST /api/v1/photos/upload-facade`
* **Mô tả:** Upload ảnh P-02 chụp góc nghiêng ngoài đường, đẩy Job vào hàng đợi AI để nắn thẳng 90 độ (Perspective Homography) và vẽ đè layer kỹ thuật chuẩn CAD.
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:** *(Tương tự 6.2)*
* **Response `202 Accepted`:**
```json
{
  "success": true,
  "jobId": "ai-job-p02-99812",
  "status": "QUEUED",
  "message": "Đã tiếp nhận ảnh P-02. Tiến trình AI Worker đang xử lý nền."
}
```

#### 7.2. `GET /api/v1/photos/{photoId}/ai-status`
* **Mô tả:** Polling hoặc WebSocket kiểm tra trạng thái xử lý AI của ảnh mặt đứng.
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "photoId": "pho-p02-00105",
    "aiStatus": "COMPLETED",
    "rawPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/P02_raw.jpg",
    "aiEnhancedPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/P02_ai_rectified.png",
    "perspectiveMatrix": [
      [1.042, -0.012, 45.2],
      [0.008, 1.085, -120.4],
      [0.0001, 0.0002, 1.0]
    ],
    "detectedFloorLines": [
      { "floor": 1, "elevationMeters": 3.6 },
      { "floor": 2, "elevationMeters": 7.2 },
      { "floor": 3, "elevationMeters": 10.8 }
    ]
  }
}
```

---

### PHÂN HỆ 8: KHẢO SÁT GIAI ĐOẠN 2 & ĐỘNG CƠ ĐỐI SOÁT DELTA (PHASE 2 DELTA ENGINE)

#### 8.1. `GET /api/v1/parcels/{parcelId}/phase2/zones`
* **Mô tả:** Khi Surveyor bước vào căn phòng thực tế trong Giai đoạn 2, API tự động tải về ảnh bối cảnh CTX và toàn bộ ghim vết nứt cũ đã ghi nhận ở Giai đoạn 1 của đúng căn phòng đó.
* **Quyền truy cập:** `SURVEYOR`, `ZONE_ADMIN`
* **Query Parameters:**
  * `floor`: `"Tầng 1 (Trệt)"`
  * `room`: `"Phòng khách phía trước"`
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
        "burlandGradePhase1": 2,
        "defects": [
          {
            "defectId": "def-01-z01",
            "defectCode": "D-01",
            "pinX": 42.5,
            "pinY": 68.2,
            "defectType": "DIAGONAL_SHEAR_CRACK",
            "phase1WidthMm": 0.85,
            "phase1LengthMm": 650.0,
            "phase1CuPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/Z01_D01_CU_raw.jpg",
            "phase2Verified": false
          }
        ]
      }
    ]
  }
}
```

#### 8.2. `PUT /api/v1/phase2/defects/{defectId}/verify`
* **Mô tả:** Đối soát ghim vết nứt cũ: Nhập số đo mới $w_2, L_2$, chụp ảnh CU Phase 2. Động cơ tự động tính $\Delta w = w_2 - w_1, \Delta L = L_2 - L_1$ và gán trạng thái tiến hóa (*NO_CHANGE, WIDENED, LENGTHENED, REPAIRED*).
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `phase2WidthMm` (number, required): Độ mở rộng vết nứt mới (mm), ví dụ `1.20`
  * `phase2LengthMm` (number, required): Chiều dài vết nứt mới (mm), ví dụ `800.0`
  * `phase2CuPhotoFile` (file binary, required): File ảnh chụp cận cảnh Phase 2 có thước đo
  * `notes` (string, optional): `"Vết nứt phát triển dài thêm 15cm về phía chân tường"`
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đối soát khuyết tật hoàn tất. Động cơ Delta đã ghi nhận độ mở rộng.",
  "data": {
    "defectId": "def-01-z01",
    "defectCode": "D-01",
    "phase1WidthMm": 0.85,
    "phase2WidthMm": 1.20,
    "deltaWidthMm": 0.35,
    "phase1LengthMm": 650.0,
    "phase2LengthMm": 800.0,
    "deltaLengthMm": 150.0,
    "evolutionStatus": "WIDENED_AND_LENGTHENED",
    "pinColorCode": "#FF9800"
  }
}
```

#### 8.3. `POST /api/v1/phase2/reports/{reportId}/summarize-delta`
* **Mô tả:** Tổng kết toàn bộ biến động Phase 2 vs Phase 1, tính toán $\Delta ECS$ và đưa ra Phán quyết tác động bồi thường (*NO_IMPACT | COSMETIC_DEFECT | STRUCTURAL_IMPACT*).
* **Quyền truy cập:** `SURVEYOR`, `ZONE_ADMIN`
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
    "newDefectsRecordedCount": 1,
    "compensationVerdict": "STRUCTURAL_IMPACT",
    "summaryConclusion": "Công trình có dấu hiệu nứt kết cấu phát triển sau thi công đào hầm (Δw > 0.3mm). Kiến nghị chuyển Ban đền bù giải phóng mặt bằng xem xét."
  }
}
```

---

### PHÂN HỆ 9: BIẾN ĐỘNG TÁCH/GỘP THỬA ĐẤT (PARCEL MUTATION ENGINE)

#### 9.1. `POST /api/v1/mutations/propose`
* **Mô tả:** Khi Surveyor phát hiện nhà thực tế đã chia nhỏ (sổ chung/cơi nới), gửi đề xuất Tách/Gộp thửa đất. Hệ thống tự động cấp dải mã mới từ Kho số Mở rộng bất biến (> 07000).
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:**
```json
{
  "mutationType": "SPLIT",
  "sourceParcelId": "p-00002",
  "reason": "Nhà gốc B-00002 thực tế đã chia thành 2 căn hộ riêng biệt có 2 lối đi và 2 đồng hồ điện độc lập.",
  "childPolygons": [
    {
      "tempLabel": "Căn phía trước (A)",
      "polygonGeoJson": {
        "type": "Polygon",
        "coordinates": [[[106.641, 10.796], [106.645, 10.796], [106.645, 10.798], [106.641, 10.798], [106.641, 10.796]]]
      }
    },
    {
      "tempLabel": "Căn phía sau (B)",
      "polygonGeoJson": {
        "type": "Polygon",
        "coordinates": [[[106.641, 10.798], [106.645, 10.798], [106.645, 10.800], [106.641, 10.800], [106.641, 10.798]]]
      }
    }
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
    "mutationType": "SPLIT",
    "sourceParcelCode": "B-00002",
    "allocatedNewCodes": ["B-07001", "B-07002"],
    "status": "PENDING_APPROVAL"
  }
}
```

#### 9.2. `POST /api/v1/admin/mutations/{mutationId}/approve`
* **Mô tả:** Zone Admin hoặc Super Admin phê duyệt sự kiện Tách thửa. Chạy trong PostgreSQL Transaction an toàn: Đổi trạng thái thửa cũ sang `SPLIT_DEPRECATED`, kích hoạt chính thức các thửa mới `B-07001`, `B-07002` lên GIS Master.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã phê duyệt sự kiện Biến động Tách thửa. CSDL GIS Master đã được cập nhật chính thức.",
  "data": {
    "mutationId": "mut-20260916-0001",
    "status": "APPROVED",
    "activatedParcelCodes": ["B-07001", "B-07002"]
  }
}
```

---

### PHÂN HỆ 10: KIỂM DUYỆT HỒ SƠ SPLIT-PANE & XUẤT BẢN PDF (AUDIT & APPROVAL)

#### 10.1. `GET /api/v1/admin/reports/{reportId}/audit-view`
* **Mô tả:** Cung cấp đầy đủ payload cho giao diện thẩm định Split-Pane của Zone Admin (bên trái là cấu trúc cây cấu kiện + điểm số ECS/VI, bên phải là cặp ảnh bối cảnh CTX và cận cảnh CU với kính lúp 400%).
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "reportId": "rep-p1-00105",
    "parcel": {
      "projectParcelCode": "B-00105",
      "fieldSurveyCode": "KS003",
      "ownerName": "Nguyễn Văn An",
      "address": "854 Đường Trường Chinh, P.15, Tân Bình"
    },
    "surveyor": {
      "name": "Nguyễn Văn Khảo Sát",
      "submittedAt": "2026-09-16T09:30:00.000Z",
      "gpsAccuracyAtCheckin": 8.5
    },
    "scores": {
      "ecsScore": 6,
      "viClass": "MEDIUM"
    },
    "zones": [
      {
        "zoneCode": "Z-01",
        "floor": "Tầng 1 (Trệt)",
        "room": "Phòng khách",
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

#### 10.2. `POST /api/v1/admin/reports/{reportId}/approve`
* **Mô tả:** Zone Admin phê duyệt Báo cáo (Phím tắt `A`). Hệ thống tự động sinh file PDF/A chuẩn lưu trữ quốc tế, đóng dấu chữ ký số điện tử và lưu trữ trên S3.
* **Quyền truy cập:** `ZONE_ADMIN`
* **Request Body:**
```json
{
  "engineeringJudgementNotes": "Hồ sơ đầy đủ ảnh chụp chuẩn vạch thước đo mm, số liệu đo lún nghiêng hợp lệ."
}
```
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

#### 10.3. `POST /api/v1/admin/reports/{reportId}/reject`
* **Mô tả:** Zone Admin trả về Báo cáo kèm lý do cụ thể (Phím tắt `R`). Tự động rollback các biến động tách thửa liên quan và gửi cảnh báo đỏ về app của Surveyor.
* **Quyền truy cập:** `ZONE_ADMIN`
* **Request Body:**
```json
{
  "rejectionReason": "Ảnh cận cảnh D-01 thiếu thước đo vạch mm (Scale Card). Yêu cầu chụp bù lại ngoài hiện trường."
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã trả về báo cáo khảo sát. Thông báo đã được gửi đến Cán bộ khảo sát.",
  "data": {
    "reportId": "rep-p1-00105",
    "status": "REJECTED",
    "rejectionReason": "Ảnh cận cảnh D-01 thiếu thước đo vạch mm (Scale Card). Yêu cầu chụp bù lại ngoài hiện trường."
  }
}
```

---

### PHÂN HỆ 11: ĐÓNG GÓI & XUẤT TẬP HỒ SƠ PHÂN KHU HÀNG LOẠT (BATCH DOSSIER EXPORT)

#### 11.1. `POST /api/v1/reports/batch-export`
* **Mô tả:** Khởi chạy tiến trình nền đóng gói toàn bộ 100-200 báo cáo đơn lẻ trong phân khu Ga thành 1 Tập Hồ sơ duy nhất (PDF Book Compilation) có bìa pháp lý, mục lục tự động, bản đồ GIS tổng hợp và mã băm SHA-256.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Request Body:**
```json
{
  "zoneId": "ZONE_S9",
  "format": "PDF_BOOK_COMPILATION",
  "includeGisOverviewMap": true,
  "includeEcsSummaryTable": true
}
```
* **Response `202 Accepted`:**
```json
{
  "success": true,
  "batchId": "batch-s9-202609-001",
  "status": "QUEUED",
  "message": "Tiến trình đóng gói Tập hồ sơ Phân khu Ga S9 đã được xếp vào hàng đợi xử lý nền."
}
```

#### 11.2. `GET /api/v1/reports/batch-export/{batchId}/status`
* **Mô tả:** Kiểm tra tiến độ hoàn thành đóng gói tập hồ sơ.
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "batchId": "batch-s9-202609-001",
    "zoneId": "ZONE_S9",
    "status": "COMPLETED",
    "totalReportsCompiled": 150,
    "downloadUrl": "https://s3.metro2.vn/dossiers/Dossier_Zone_S9_202609.pdf",
    "checksumSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "fileSizeBytes": 48234900
  }
}
```

---

### PHÂN HỆ 12: TRA CỨU BẢN ĐỒ GIS CÔNG KHAI CHO NHÀ THẦU & KHÁCH (CONTRACTOR/GUEST)

#### 12.1. `GET /api/v1/guest/gis-map`
* **Mô tả:** Nhà thầu xây dựng Metro hoặc Ban QLDA tra cứu bản đồ GIS quy hoạch và ranh giới các công trình đã được thẩm định duyệt.
* **Quyền truy cập:** Public với `shareToken` hoặc tài khoản `CONTRACTOR_GUEST`
* **Query Parameters:**
  * `shareToken` (string, required): Mã chia sẻ an toàn được cấp bởi Ban QLDA
  * `passcode` (string, optional): Mật mã bảo vệ lớp dữ liệu
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

---

## 4. TỔNG HỢP DANH MỤC MÃ LỖI NGHIỆP VỤ (ERROR CODES)

| HTTP Status | Mã lỗi hệ thống (`code`) | Mô tả chi tiết |
| :---: | :--- | :--- |
| `401` | `ERR_AUTH_INVALID_CREDENTIALS` | Tên đăng nhập hoặc mật khẩu không chính xác. |
| `401` | `ERR_AUTH_TOKEN_EXPIRED` | Phiên đăng nhập JWT đã hết hạn. |
| `403` | `ERR_FORBIDDEN_ZONE_ACCESS` | Người dùng không có quyền thao tác trên Phân khu Ga này. |
| `422` | `ERR_GPS_ACCURACY_EXCEEDED` | Độ chính xác GPS hiện trường vượt quá 20 mét. |
| `422` | `ERR_SCALE_CARD_MISSING` | Ảnh cận cảnh $CU$ thiếu thẻ thước đo vạch mm hợp lệ. |
| `409` | `ERR_PARCEL_ALREADY_MUTATED` | Thửa đất gốc đã bị tách/gộp ở một phiên giao dịch trước. |
| `400` | `ERR_INVALID_HOMOGRAPHY_POINTS` | 4 điểm chấm góc đa giác nhà P-02 không tạo thành tứ giác lồi hợp lệ. |
| `404` | `ERR_REPORT_NOT_FOUND` | Không tìm thấy hồ sơ khảo sát tương ứng với ID. |
| `500` | `ERR_AI_WORKER_TIMEOUT` | Tiến trình AI nắn thẳng mặt đứng bị gián đoạn hoặc quá thời gian. |
