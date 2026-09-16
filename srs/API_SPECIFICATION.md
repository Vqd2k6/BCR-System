# ĐẶC TẢ CHI TIẾT HỆ THỐNG RESTFUL API (API SPECIFICATION & CONTRACT)
## HỆ THỐNG KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH - METRO SỐ 2 (BẾN THÀNH – THAM LƯƠNG)

> [!IMPORTANT]
> **TÀI LIỆU QUY CHUẨN ĐẶC TẢ CHI TIẾT 100% ĐẦY ĐỦ TẤT CẢ REQUEST / RESPONSE PAYLOADS:**
> Toàn bộ hệ thống API được phân cấp theo **4 Nhóm Vai trò Người dùng** (`SURVEYOR`, `ZONE_ADMIN`, `SUPER_ADMIN`, `CONTRACTOR_GUEST`) và phân cụm theo các phương thức HTTP (`POST`, `GET`, `PUT`, `DELETE`). Mỗi endpoint đều có đầy đủ mô tả nghiệp vụ, Headers, Form Fields, Request Body JSON, Response Success JSON (200/201/202) và Response Error JSON theo chuẩn RFC 7807 (`application/problem+json`).

---

## MỤC LỤC TỔNG QUAN

```text
├── 0. PHÂN HỆ XÁC THỰC CHUNG (COMMON AUTHENTICATION)
│   ├── [POST] /api/v1/auth/login
│   ├── [POST] /api/v1/auth/refresh-token
│   ├── [GET]  /api/v1/auth/me
│   └── [POST] /api/v1/auth/logout
│
├── 1. VAI TRÒ 1: CÁN BỘ KHẢO SÁT HIỆN TRƯỜNG (FIELD SURVEYOR)
│   ├── [POST] Nhóm Tạo Mới, Upload, Khởi Tạo, Tự Nhận Thửa & Nộp Hồ Sơ
│   │   ├── 1.1.1. POST /api/v1/attendance/check-in                      # Chấm công GPS thực địa
│   │   ├── 1.1.2. POST /api/v1/parcels/{id}/start-survey                # Tự chọn ô thửa trên bản đồ & Khảo sát ngay (Ad-hoc Pick)
│   │   ├── 1.1.3. POST /api/v1/parcels/{id}/record-absence              # Ghi nhận nhà vắng / Cửa khóa (POSTPONED_ABSENT)
│   │   ├── 1.1.4. POST /api/v1/reports/phase1                           # Khởi tạo hồ sơ Phase 1
│   │   ├── 1.1.5. POST /api/v1/reports/phase1/{id}/identification-photos# Bước 1: 4 Ảnh P01-P04 + Polygon N điểm + Phân tầng
│   │   ├── 1.1.6. POST /api/v1/reports/phase1/{id}/zones                # Bước 3: Tạo Vùng Z-xx + Ảnh CTX + Burland Grade
│   │   ├── 1.1.7. POST /api/v1/reports/phase1/zones/{id}/defects        # Bước 3: Ghim D-xx + Ảnh CU có thước + E2/E4
│   │   ├── 1.1.8. POST /api/v1/reports/phase1/{id}/sketch               # Bước 6: Sơ đồ phác thảo Damage Sketch / CAD
│   │   ├── 1.1.9. POST /api/v1/reports/phase1/{id}/calculate-scores     # Bước 7: Auto tính điểm ECS (0-24) & VI
│   │   ├── 1.1.10. POST /api/v1/reports/phase1/{id}/submit              # Bước 9: Nộp Phase 1 kèm chữ ký & ý kiến chủ hộ
│   │   ├── 1.1.11. POST /api/v1/mutations/propose                       # Bước 5: Đề xuất Tách/Gộp thửa, cấp mã > 07000
│   │   ├── 1.1.12. POST /api/v1/reports/phase2                          # Khởi tạo hồ sơ Phase 2 (kế thừa Phase 1)
│   │   ├── 1.1.13. POST /api/v1/reports/phase2/{id}/identification-photos# Phase 2 Bước 1: 2 Ảnh P01-P02 mới
│   │   ├── 1.1.14. POST /api/v1/phase2/zones/{id}/defects               # Phase 2 Bước 3: Thả ghim D-new trên Vùng cũ
│   │   ├── 1.1.15. POST /api/v1/phase2/reports/{id}/zones               # Phase 2 Bước 3: Tạo Vùng Z-new mới phát sinh
│   │   ├── 1.1.16. POST /api/v1/reports/phase2/{id}/sketch              # Phase 2 Bước 6: Sơ đồ phác thảo Damage Sketch
│   │   ├── 1.1.17. POST /api/v1/phase2/reports/{id}/summarize           # Phase 2 Bước 7: Tổng kết biến động, ΔECS, Quan trắc & NDT
│   │   └── 1.1.18. POST /api/v1/reports/phase2/{id}/submit              # Phase 2 Bước 9: Nộp Phase 2 kèm chữ ký 4 bên
│   │
│   ├── [GET] Nhóm Tra Cứu, Lọc Dữ Liệu Theo Vị Trí & Bản Đồ Quét Cạn
│   │   ├── 1.2.1. GET /api/v1/tasks/my-tasks                            # Danh sách công trình được giao việc
│   │   ├── 1.2.2. GET /api/v1/parcels/zone-map                          # Tải toàn bộ lớp thửa đất trong Ga lên bản đồ PWA
│   │   ├── 1.2.3. GET /api/v1/parcels/nearby                            # Tra cứu nhanh các thửa đất chưa khảo sát gần GPS
│   │   ├── 1.2.4. GET /api/v1/parcels/{id}                              # Chi tiết thửa đất & Đa giác ranh nhà Footprint
│   │   ├── 1.2.5. GET /api/v1/reports/phase1/{id}                       # Lấy chi tiết toàn bộ hồ sơ Phase 1
│   │   ├── 1.2.6. GET /api/v1/parcels/{id}/phase2/zones                 # Phase 2: Lọc ảnh CTX và ghim cũ theo Tầng & Phòng
│   │   ├── 1.2.7. GET /api/v1/reports/phase2/{id}                       # Lấy chi tiết toàn bộ hồ sơ Phase 2
│   │   ├── 1.2.8. GET /api/v1/reports/phase2/{id}/quality-gate          # Phase 2 Bước 6: Checklist 10 tiêu chí Phụ lục A
│   │   └── 1.2.9. GET /api/v1/photos/{id}/ai-status                     # Kiểm tra tiến độ AI nắn thẳng mặt đứng P-02
│   │
│   ├── [PUT] Nhóm Cập Nhật Thông Số, Đo Đạc & Đối Soát Delta
│   │   ├── 1.3.1. PUT /api/v1/reports/phase1/{id}/general-info          # Bước 1: Tên CT, Chủ hộ, Cấp CT, Liền kề
│   │   ├── 1.3.2. PUT /api/v1/reports/phase1/{id}/specs                 # Bước 2: Kết cấu, Móng CAT 1-5, E5 Lịch sử
│   │   ├── 1.3.3. PUT /api/v1/reports/phase1/{id}/deformation           # Bước 4: Đo lún nghiêng X/Y, nghiêng sàn, võng dầm
│   │   ├── 1.3.4. PUT /api/v1/reports/phase1/{id}/scope                 # Bước 5: Phạm vi khảo sát & Hạn chế tiếp cận
│   │   ├── 1.3.5. PUT /api/v1/reports/phase1/{id}/conclusions           # Bước 8: Kết luận, Rủi ro chính & Kiến nghị
│   │   ├── 1.3.6. PUT /api/v1/parcels/{id}/footprint                    # Bước 5: Cập nhật Đa giác ranh nhà thực địa
│   │   ├── 1.3.7. PUT /api/v1/reports/phase2/{id}/confirm-changes       # Phase 2 Bước 2: Xác nhận biến động sau GĐ1
│   │   ├── 1.3.8. PUT /api/v1/phase2/defects/{id}/verify                # Phase 2 Bước 3: Đối soát ghim cũ (w2, L2, Δw, ΔL)
│   │   ├── 1.3.9. PUT /api/v1/reports/phase2/{id}/deformation           # Phase 2 Bước 4: Đo lún nghiêng & Tính Delta nghiêng
│   │   └── 1.3.10. PUT /api/v1/reports/phase2/{id}/scope                # Phase 2 Bước 5: Phạm vi tiếp cận thực tế GĐ2
│   │
│   └── [DELETE] Nhóm Xóa Dữ Liệu Nháp
│       └── 1.4.1. DELETE /api/v1/reports/phase1/zones/{zId}/defects/{dId} # Xóa ghim khuyết tật nháp
│
├── 2. VAI TRÒ 2: TỔ TRƯỞNG & QUẢN TRỊ PHÂN KHU (ZONE ADMIN)
│   ├── [GET] Nhóm Thống Kê Tiến Độ, Cảnh Báo Bất Thường & Thẩm Định Split-Pane
│   │   ├── 2.1.1. GET /api/v1/admin/analytics/progress                  # Thống kê tiến độ Ngày/Tuần/Tháng (Xong, Chưa xong, Vắng nhà...)
│   │   ├── 2.1.2. GET /api/v1/admin/reports/audit-alerts                # Động cơ cảnh báo gian lận & bất thường GPS/Kết cấu
│   │   ├── 2.1.3. GET /api/v1/admin/reports/{id}/audit-flags            # Chi tiết các cờ cảnh báo của 1 hồ sơ cụ thể
│   │   ├── 2.1.4. GET /api/v1/admin/reports/{id}/audit-view             # Payload Split-Pane (Kính lúp 400%) kèm cờ cảnh báo
│   │   ├── 2.1.5. GET /api/v1/admin/reports                             # Danh sách hồ sơ lọc theo ngày/tuần, trạng thái, rủi ro VI
│   │   ├── 2.1.6. GET /api/v1/admin/parcels/unassigned                  # Danh sách thửa đất chưa phân công
│   │   └── 2.1.7. GET /api/v1/reports/batch-export/{batchId}/status     # Tiến độ đóng gói và link tải File kèm Checksum SHA
│   │
│   ├── [POST] Nhóm Giao Việc, Phê Duyệt/Trả Về & Đóng Gói Xuất Báo Cáo Chọn Lọc
│   │   ├── 2.2.1. POST /api/v1/reports/batch-export                     # Xuất Báo cáo Chọn lọc: Theo ID chỉ định / Theo Ngày, Tuần, Tháng
│   │   ├── 2.2.2. POST /api/v1/admin/tasks/assign                       # Giao việc trên bản đồ số GIS
│   │   ├── 2.2.3. POST /api/v1/admin/reports/{id}/approve               # Duyệt Báo cáo (Phím 'A') & Sinh PDF/A ký số
│   │   ├── 2.2.4. POST /api/v1/admin/reports/{id}/reject                # Trả về Báo cáo (Phím 'R') & Rollback biến động
│   │   └── 2.2.5. POST /api/v1/admin/mutations/{id}/approve              # Phê duyệt biến động Tách/Gộp thửa đất
│   │
│   ├── [PUT] Nhóm Điều Chỉnh Phân Công
│   │   └── 2.3.1. PUT /api/v1/admin/tasks/{taskId}/reassign             # Chuyển giao nhiệm vụ khảo sát sang Surveyor khác
│   │
│   └── [DELETE] Nhóm Hủy Phân Công
│       └── 2.4.1. DELETE /api/v1/admin/tasks/{taskId}                   # Hủy nhiệm vụ khảo sát
│
├── 3. VAI TRÒ 3: TỔNG QUẢN TRỊ TOÀN TUYẾN (SUPER ADMIN)
│   ├── [GET]  GET /api/v1/zones, GET /api/v1/admin/users, GET /api/v1/admin/audit-logs
│   ├── [POST] POST /api/v1/admin/users, POST /api/v1/admin/gis/import-parcels
│   ├── [PUT]  PUT /api/v1/admin/gis/layers/metro-alignment, PUT /api/v1/admin/users/{id}/status
│   └── [DELETE] DELETE /api/v1/admin/users/{id}
│
└── 4. VAI TRÒ 4: NHÀ THẦU XÂY LẮP & KHÁCH TRA CỨU (CONTRACTOR & GUEST)
    └── [GET]  GET /api/v1/guest/gis-map, GET /api/v1/guest/parcels/{id}/summary, GET /api/v1/guest/dossiers/{id}/download
```

---

# 0. PHÂN HỆ XÁC THỰC CHUNG (COMMON AUTHENTICATION)

### 0.1. [POST] `/api/v1/auth/login`
* **Mô tả:** Đăng nhập hệ thống bằng Tên đăng nhập và Mật khẩu. Trả về JWT Access Token (hạn 7 ngày) và Refresh Token.
* **Quyền truy cập:** Public
* **Request Headers:** `Content-Type: application/json`
* **Request Body:**
```json
{
  "username": "zoneadmin_s9",
  "password": "Admin@123"
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
      "id": "u-002-zoneadmin",
      "username": "zoneadmin_s9",
      "fullName": "Trần Văn Tổ Trưởng",
      "role": "ZONE_ADMIN",
      "assignedZoneId": "ZONE_S9",
      "assignedZoneName": "Ga S9 - Bà Quẹo",
      "avatarUrl": "https://s3.metro2.vn/avatars/u-002.jpg"
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
* **Response `200 OK`:** Trả về Profile, quyền hạn `role` và phân khu Ga được giao.

### 0.4. [POST] `/api/v1/auth/logout`
* **Mô tả:** Đăng xuất và thu hồi Refresh Token.
* **Response `200 OK`:** `{ "success": true, "message": "Đã đăng xuất thành công." }`

---

# 1. VAI TRÒ 1: CÁN BỘ KHẢO SÁT HIỆN TRƯỜNG (`SURVEYOR`)

---

## 1.1. NHÓM PHƯƠNG THỨC POST (Tạo mới, Upload, Khởi tạo, Tự nhận thửa, Nộp hồ sơ)

### 1.1.1. `POST /api/v1/attendance/check-in`
* **Mô tả:** Chấm công GPS đầu ngày tại hiện trường. Tinh gọn: Chỉ cần gửi tọa độ GPS thực tế (`gpsLat`, `gpsLng`), mã Ga (`zoneId`), ảnh selfie và ghi chú tùy chọn.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `zoneId` (string, required): Mã Ga, ví dụ `"ZONE_S9"`
  * `gpsLat` (number, required): `10.798123`
  * `gpsLng` (number, required): `106.645678`
  * `selfieFile` (file binary, optional): Ảnh chụp xác thực
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

### 1.1.2. `POST /api/v1/parcels/{parcelId}/start-survey` *(Tự chọn thửa trên bản đồ & Khảo sát ngay)*
* **Mô tả:** Khi đến một nhà trong danh sách phân công nhưng chủ nhà đi vắng, Surveyor chạm trực tiếp vào một ô thửa đất liền kề trên bản đồ GIS của PWA để **tự nhận và bắt đầu khảo sát ngay lập tức (Ad-hoc Sweep Survey)**.
* **Request Body:**
```json
{
  "phase": "PHASE_1",
  "claimReason": "Nhà B-00105 khóa cửa vắng mặt, chuyển sang khảo sát nhà liền kề B-00106"
}
```
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã nhận thửa đất và khởi tạo hồ sơ khảo sát thành công.",
  "data": {
    "parcelId": "p-00106",
    "projectParcelCode": "B-00106",
    "fieldSurveyCode": "KS004",
    "reportId": "rep-p1-00106",
    "surveyStatus": "IN_PROGRESS",
    "assignedSurveyorId": "u-001-surveyor"
  }
}
```

---

### 1.1.3. `POST /api/v1/parcels/{parcelId}/record-absence` *(Ghi nhận vắng nhà / Hoãn khảo sát)*
* **Mô tả:** Ghi nhận nhật ký khi đến nhà được giao nhưng chủ hộ đi vắng, cửa khóa hoặc từ chối tiếp cận. Thửa đất tự động chuyển sang trạng thái Tạm hoãn (`POSTPONED_ABSENT` - Màu Tím) với bộ đếm `attemptCount`.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `absenceReason` (string, required): `"HOMEOWNER_ABSENT"` (Đi vắng) | `"LOCKED_GATE"` (Khóa cửa ngoài) | `"REFUSED_ACCESS"` (Từ chối)
  * `notes` (string, optional): `"Đã gọi điện thoại 2 lần không nhấc máy, hàng xóm báo đi công tác"`
  * `photoProofFile` (file binary, optional): Ảnh chụp cửa khóa/hiện trạng nhà vắng
  * `rescheduleDate` (string, optional): Thời gian hẹn khảo sát lại
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã ghi nhận nhật ký vắng mặt. Thửa đất chuyển sang trạng thái Tạm hoãn (POSTPONED_ABSENT).",
  "data": {
    "parcelId": "p-00105",
    "projectParcelCode": "B-00105",
    "surveyStatus": "POSTPONED_ABSENT",
    "absenceAttemptCount": 1,
    "recordedAt": "2026-09-16T08:15:00.000Z"
  }
}
```

---

### 1.1.4. `POST /api/v1/reports/phase1`
* **Mô tả:** Khởi tạo hồ sơ khảo sát Giai đoạn 1 (Phase 1 Baseline) cho một thửa đất.
* **Request Body:** `{ "parcelId": "p-00105" }`
* **Response `201 Created`:** Trả về `reportId: "rep-p1-00105"`, `status: "DRAFT"`.

---

### 1.1.5. `POST /api/v1/reports/phase1/{reportId}/identification-photos`
* **Mô tả:** Bước 1 - Upload bộ 4 ảnh định danh mặt ngoài ($P-01$ Biển số nhà, $P-02$ Toàn cảnh mặt đứng, $P-03$ Hông trái/sau, $P-04$ Bối cảnh ngõ/đường). Hỗ trợ nút chọn **Không tồn tại (N/A)** kèm lý do, và hỗ trợ đa giác mặt đứng với **số đỉnh $N$ bất kỳ** ($N \ge 3$).
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `p01File` (file binary, optional), `p01IsNA` (boolean), `p01NAReason` (string)
  * `p02File` (file binary, optional), `p02IsNA` (boolean), `p02NAReason` (string)
  * `p02PolygonPoints` (string JSON, optional): Mảng $N$ điểm góc đa giác `[{"x": 120, "y": 850}, {"x": 890, "y": 830}, {"x": 870, "y": 150}, {"x": 500, "y": 50}, {"x": 140, "y": 180}]` (Hỗ trợ nhà mái xéo, chữ L, giật cấp $N$ đỉnh)
  * `p02FloorSplitLines` (string JSON, optional): Mảng đường phân tầng ngang `[{"floor": 1, "y": 620}, {"floor": 2, "y": 390}]`
  * `p02Dimensions` (string JSON, optional): `{"h1": "3.8m", "h2": "3.4m", "totalHeight": "11.5m", "facadeWidth": "4.2m"}`
  * `p03File`, `p03IsNA`, `p03NAReason`, `p04File`, `p04IsNA`, `p04NAReason`
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã lưu bộ ảnh định danh P01-P04. Ảnh P-02 đã được gửi vào hàng đợi AI nắn thẳng.",
  "data": {
    "p01Url": "https://s3.metro2.vn/photos/rep-p1-00105/P01_raw.jpg",
    "p02Url": "https://s3.metro2.vn/photos/rep-p1-00105/P02_raw.jpg",
    "p02AiJobId": "ai-job-p02-99812",
    "p03Url": null,
    "p04Url": "https://s3.metro2.vn/photos/rep-p1-00105/P04_raw.jpg"
  }
}
```

---

### 1.1.6. `POST /api/v1/reports/phase1/{reportId}/zones`
* **Mô tả:** Bước 3 - Tạo Vùng khảo sát hư hỏng $Z-xx$ cho từng Tầng/Phòng, upload ảnh bối cảnh góc rộng $CTX$, đánh giá ảnh hưởng chức năng và chốt cấp độ Burland (0-5) tại chỗ.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `floorName` (string, required): `"Tầng 1 (Trệt)"`
  * `roomName` (string, required): `"Phòng khách phía trước"`
  * `componentType` (string, required): `"WALL"` | `"BEAM"` | `"COLUMN"` | `"SLAB"` | `"FLOOR"` | `"STAIRS"`
  * `wallMaterial` (string, optional): `"Tường gạch 200mm"` | `"BTCT"`
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
    "ctxPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/Z01_CTX_raw.jpg"
  }
}
```

---

### 1.1.7. `POST /api/v1/reports/phase1/zones/{zoneId}/defects`
* **Mô tả:** Bước 3 (Chi tiết) - Thả ghim khuyết tật $D-xx$ trên ảnh bối cảnh $Z-xx$, upload ảnh cận cảnh $CU$ có thước đo vạch mm (Scale Card), đo đạc $w_{max}$, $L$, và tự động map các điểm thành phần $E2$ (Ý nghĩa kết cấu) và $E4$ (Suy giảm vật liệu).
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `pinX`, `pinY` (number, required): Tọa độ ghim trên ảnh CTX (0.0 - 100.0 %)
  * `screeningCategory` (string, required): `"NỨT_TƯỜNG_HOÀN_THIỆN"` | `"NỨT_KẾT_CẤU_CỘT_DẦM"` | `"LÚN_VÕNG"` | `"THẤM_DỘT"` | `"BONG_TRÓC_LỘ_THÉP"` | `"MẤT_TIẾT_DIỆN"` | `"KẸT_CỬA"` | `"TÁI_NỨT"`
  * `defectType` (string, required): `"DIAGONAL_SHEAR_CRACK"` | `"VERTICAL_CRACK"` | `"HORIZONTAL_CRACK"` | `"SPALLING"` | `"WATER_SEEPAGE"`
  * `crackDirection` (string, optional): `"Xiên 45 độ góc cửa sổ"`
  * `widthMaxMm` (number, required): `0.85`
  * `lengthMm` (number, required): `650.0`
  * `activityState` (string, required): `"U"` (Chưa rõ) | `"S"` (Ổn định) | `"A"` (Đang phát triển)
  * `materialDegradationE4` (integer, required, 0-4): `1`
  * `structuralSignificanceE2` (integer, required, 0-4): `1`
  * `hasScaleCard` (boolean, required): `true`
  * `cuPhotoFile` (file binary, required): Ảnh cận cảnh có thước đo
  * `extraPhotoFile` (file binary, optional): Ảnh góc chụp bổ sung
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
    "hasScaleCard": true,
    "cuPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/Z01_D01_CU_raw.jpg"
  }
}
```

---

### 1.1.8. `POST /api/v1/reports/phase1/{reportId}/sketch`
* **Mô tả:** Bước 6 - Upload ảnh chụp bản vẽ phác thảo sơ đồ vị trí khuyết tật (Damage Location Sketch) hoặc nhập số hiệu bản vẽ CAD.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `sketchPhotoFile` (file binary, optional), `cadDrawingRef` (string, optional)
* **Response `201 Created`:** `{ "success": true, "sketchPhotoUrl": "https://s3.metro2.vn/photos/sketch_001.jpg" }`

---

### 1.1.9. `POST /api/v1/reports/phase1/{reportId}/calculate-scores`
* **Mô tả:** Bước 7 - Tự động tổng hợp điểm $E1..E6 \rightarrow \Sigma E / 24$ (ECS Class: `Good` [0-5], `Medium` [6-10], `Deficient` [11-16], `Critical` [17-24]) và Chỉ số tổn thương $V1..V6 \rightarrow VI Class$ (`Low`, `Medium`, `High`, `Very High`).
* **Request Body (Tùy chọn ghi đè Engineering Judgement):**
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

### 1.1.10. `POST /api/v1/reports/phase1/{reportId}/submit`
* **Mô tả:** Bước 9 - Nộp chính thức Báo cáo Phase 1 kèm ý kiến phản hồi chủ hộ, ảnh chữ ký hoặc biên bản vắng mặt/từ chối.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `ownerRemarks` (string, optional): `"Chủ hộ đồng ý với toàn bộ các vết nứt hiện trạng ghi nhận trong biên bản."`
  * `surveyorSignatureFile` (file binary, required): Chữ ký cán bộ khảo sát
  * `ownerSignatureFile` (file binary, optional): Chữ ký chủ hộ
  * `isRefusedOrAbsent` (boolean, default: false), `refusalDocRef` (string, optional)
* **Response `200 OK`:** `{ "success": true, "message": "Báo cáo Phase 1 đã nộp thành công.", "data": { "reportId": "rep-p1-00105", "status": "SUBMITTED" } }`

---

### 1.1.11. `POST /api/v1/mutations/propose`
* **Mô tả:** Bước 5 (Ranh GIS) - Đề xuất Tách/Gộp thửa khi phát hiện nhà thực tế chia nhỏ $\rightarrow$ Tự động cấp mã từ dải mở rộng ($> 07000$).
* **Request Body:**
```json
{
  "mutationType": "SPLIT",
  "sourceParcelId": "p-00002",
  "reason": "Nhà gốc B-00002 thực tế đã chia thành 2 căn hộ riêng biệt có 2 lối đi độc lập.",
  "childPolygons": [
    { "tempLabel": "Căn trước (A)", "polygonGeoJson": { "type": "Polygon", "coordinates": [[[106.641, 10.796], [106.645, 10.796], [106.645, 10.798], [106.641, 10.798], [106.641, 10.796]]] } },
    { "tempLabel": "Căn sau (B)", "polygonGeoJson": { "type": "Polygon", "coordinates": [[[106.641, 10.798], [106.645, 10.798], [106.645, 10.800], [106.641, 10.800], [106.641, 10.798]]] } }
  ]
}
```
* **Response `201 Created`:** Cấp mã mới `B-07001`, `B-07002`.

---

### 1.1.12. `POST /api/v1/reports/phase2`
* **Mô tả:** Khởi tạo hồ sơ khảo sát Giai đoạn 2 (Phiếu 02 - Pre-Construction BCS), tự động kế thừa toàn bộ dữ liệu gốc từ Phase 1 đã duyệt.
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

### 1.1.13. `POST /api/v1/reports/phase2/{reportId}/identification-photos`
* **Mô tả:** Phase 2 Bước 1 - Chụp 2 ảnh nhận dạng Giai đoạn 2 ($P-01$ Biển số & mặt đứng, $P-02$ Bối cảnh đường). Hỗ trợ nút N/A và vẽ đa giác $N$ đỉnh.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `p01File`, `p01IsNA`, `p01NAReason`, `p01PolygonPoints`, `p01FloorSplitLines`, `p02File`, `p02IsNA`, `p02NAReason`
* **Response `201 Created`:** `{ "success": true, "p01Url": "...", "p02Url": "..." }`

---

### 1.1.14. `POST /api/v1/phase2/zones/{zoneId}/defects`
* **Mô tả:** Phase 2 Bước 3 (Cơ chế A) - Chấm thêm vết nứt mới phát sinh $D-new$ trên ảnh bối cảnh $CTX$ cũ. Tự động gán mã `D-04 (MỚI)` màu Đỏ.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `pinX`, `pinY`, `screeningCategory`, `defectType`, `crackDirection`, `widthMaxMm: 0.6`, `lengthMm: 500.0`, `cuPhotoFile: <binary>`
* **Response `201 Created`:** Trả về `defectCode: "D-04"`, `evolutionStatus: "NEW_RECORDED"`, `isNewInPhase2: true`.

---

### 1.1.15. `POST /api/v1/phase2/reports/{reportId}/zones`
* **Mô tả:** Phase 2 Bước 3 (Cơ chế B) - Tạo Vùng mới $Z-new$ khi xuất hiện khu vực mới phát sinh tại GĐ2.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `floorName`, `roomName`, `slabCondition`, `wallCondition`, `beamColumnCondition`, `seepageSpallingCondition`, `deformationCondition`, `ctxPhotoFile: <binary>`
* **Response `201 Created`:** Trả về `zoneCode: "Z-04 (MỚI)"`, `isNewInPhase2: true`.

---

### 1.1.16. `POST /api/v1/reports/phase2/{reportId}/sketch`
* **Mô tả:** Phase 2 Bước 6 - Upload sơ đồ vị trí khuyết tật GĐ2.

---

### 1.1.17. `POST /api/v1/phase2/reports/{reportId}/summarize`
* **Mô tả:** Phase 2 Bước 7 - Tự động tổng hợp biến động so với GĐ1, tính $\Delta ECS$, phát hiện cảnh báo nguy cấp, chốt nhu cầu quan trắc & NDT.
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

### 1.1.18. `POST /api/v1/reports/phase2/{reportId}/submit`
* **Mô tả:** Phase 2 Bước 9 - Nộp chính thức Báo cáo Phase 2 kèm cam kết pháp lý chuẩn Phiếu 02 và chữ ký 4 bên.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `ownerRemarks`, `ownerSignatureFile`, `contractorRepSignatureFile`, `thirdPartyRepSignatureFile`, `witnessSignatureFile`, `isRefusedOrAbsent`, `refusalDocRef`
* **Response `200 OK`:** `{ "success": true, "status": "SUBMITTED" }`

---

## 1.2. NHÓM PHƯƠNG THỨC GET (Tra cứu, Lọc dữ liệu theo vị trí, Bản đồ quét cạn)

### 1.2.1. `GET /api/v1/tasks/my-tasks`
* **Mô tả:** Lấy danh sách công trình được giao việc cho Surveyor hiện tại.
* **Response `200 OK`:** Trả về mảng các task với `parcelId`, `projectParcelCode`, `address`, `gpsTarget`, `deadline`.

### 1.2.2. `GET /api/v1/parcels/zone-map`
* **Mô tả:** Tải toàn bộ lớp thửa đất trong Ga lên bản đồ PWA với các mã màu trực quan:
  * ⚪ `#9E9E9E`: `NOT_SURVEYED`
  * 🔵 `#2196F3`: `ASSIGNED_TO_ME`
  * 🟡 `#FFC107`: `IN_PROGRESS`
  * 🟣 `#9C27B0`: `POSTPONED_ABSENT`
  * 🟠 `#FF9800`: `SUBMITTED`
  * 🟢 `#4CAF50`: `APPROVED`
  * 🔴 `#F44336`: `REJECTED`
* **Query Parameters:** `zoneId="ZONE_S9"`
* **Response `200 OK`:** Trả về GeoJSON FeatureCollection của 650 thửa đất.

### 1.2.3. `GET /api/v1/parcels/nearby`
* **Mô tả:** Tra cứu nhanh các thửa đất chưa khảo sát xung quanh vị trí GPS (bán kính 50m - 200m).
* **Query Parameters:** `lat=10.798123`, `lng=106.645678`, `radiusMeters=150`, `status=NOT_SURVEYED`
* **Response `200 OK`:** Trả về danh sách các nhà lân cận sắp xếp theo khoảng cách mét tăng dần.

### 1.2.4. `GET /api/v1/parcels/{parcelId}`
* **Mô tả:** Lấy chi tiết thông tin thửa đất, mã kép `B-xxxxx` và `KSxxx`, đa giác ranh nhà footprint.

### 1.2.5. `GET /api/v1/reports/phase1/{reportId}`
* **Mô tả:** Lấy toàn bộ payload 9 bước của hồ sơ Phase 1.

### 1.2.6. `GET /api/v1/parcels/{parcelId}/phase2/zones`
* **Mô tả:** Phase 2 Bước 3.1 - Tự động lọc và tải về ảnh bối cảnh $CTX$ và toàn bộ ghim $D-xx$ cũ của đúng Tầng & Phòng mà Surveyor đang đứng.
* **Query Parameters:** `floor="Tầng 1 (Trệt)"`, `room="Phòng khách phía trước"`
* **Response `200 OK`:** Trả về danh sách Vùng `Z-xx` kèm ảnh `CTX` và mảng ghim `defects` ($D-01, D-02...$) có thông số $w_1, L_1$.

### 1.2.7. `GET /api/v1/reports/phase2/{reportId}`
* **Mô tả:** Lấy chi tiết toàn bộ hồ sơ Phase 2 (kế thừa Phase 1 + biến động mới).

### 1.2.8. `GET /api/v1/reports/phase2/{reportId}/quality-gate`
* **Mô tả:** Phase 2 Bước 6.2 - Tự động quét kiểm tra 10 tiêu chí chất lượng hồ sơ theo Phụ lục A.
* **Response `200 OK`:** Trả về checklist 10 mục (`PASSED` / `FAILED` / `NA`).

### 1.2.9. `GET /api/v1/photos/{photoId}/ai-status`
* **Mô tả:** Kiểm tra tiến độ nắn thẳng mặt đứng $P-02$ chuẩn CAD.

---

## 1.3. NHÓM PHƯƠNG THỨC PUT (Cập nhật, Đo đạc & Đối soát Delta)

### 1.3.1. `PUT /api/v1/reports/phase1/{reportId}/general-info`
* **Mô tả:** Bước 1 - Cập nhật Tên CT, Chủ hộ, SĐT, Cấp công trình (`General | Important | Critical`), Công trình liền kề.

### 1.3.2. `PUT /api/v1/reports/phase1/{reportId}/specs`
* **Mô tả:** Bước 2 - Lưu kết cấu chịu lực, số tầng, móng CAT 1-5, yếu tố nhạy cảm lịch sử E5 (cơi nới, sửa chữa, lún nghiêng cũ, sự cố hỏa hoạn, thiết bị nhạy cảm).

### 1.3.3. `PUT /api/v1/reports/phase1/{reportId}/deformation`
* **Mô tả:** Bước 4 - Lưu số đo lún nghiêng (Tilt X/Y, nghiêng sàn, võng dầm, nguồn đo & độ tin cậy).

### 1.3.4. `PUT /api/v1/reports/phase1/{reportId}/scope`
* **Mô tả:** Bước 5 - Lưu phạm vi đã khảo sát và hạn chế tiếp cận.

### 1.3.5. `PUT /api/v1/reports/phase1/{reportId}/conclusions`
* **Mô tả:** Bước 8 - Lưu kết luận rủi ro chính, kiến nghị kỹ thuật, tác động thi công $I$ và rủi ro $BRA$.

### 1.3.6. `PUT /api/v1/parcels/{parcelId}/footprint`
* **Mô tả:** Bước 5 - Cập nhật Đa giác ranh nhà thực tế (Building Footprint Polygon) sau khi đo quét cạn ngoài thực địa.

### 1.3.7. `PUT /api/v1/reports/phase2/{reportId}/confirm-changes`
* **Mô tả:** Phase 2 Bước 2 - Xác nhận cơi nới, sửa chữa, thay đổi tải trọng phát sinh sau GĐ1.

### 1.3.8. `PUT /api/v1/phase2/defects/{defectId}/verify`
* **Mô tả:** Phase 2 Bước 3 (Cơ chế A) - Đối soát ghim cũ: Nhập số đo mới $w_2, L_2$, ảnh CU mới $\rightarrow$ Tính $\Delta w, \Delta L$ và gán trạng thái (`Không đổi`, `Phát triển`, `Đã sửa`).
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
* **Mô tả:** Phase 2 Bước 4 - Lưu số đo lún nghiêng Phase 2 và tự động tính độ biến thiên $\Delta$ so với Phase 1.

### 1.3.10. `PUT /api/v1/reports/phase2/{reportId}/scope`
* **Mô tả:** Phase 2 Bước 5 - Lưu phạm vi tiếp cận thực tế GĐ2 (`Toàn bộ` / `Một phần`).

---

## 1.4. NHÓM PHƯƠNG THỨC DELETE (Xóa dữ liệu nháp)

### 1.4.1. `DELETE /api/v1/reports/phase1/zones/{zoneId}/defects/{defectId}`
* **Mô tả:** Xóa một ghim khuyết tật nháp bị thả nhầm trước khi nộp hồ sơ.

---

# 2. VAI TRÒ 2: TỔ TRƯỞNG & QUẢN TRỊ PHÂN KHU (`ZONE_ADMIN`)

---

## 2.1. NHÓM PHƯƠNG THỨC GET (Thống Kê Tiến Độ, Cảnh Báo Bất Thường & Thẩm Định)

### 2.1.1. `GET /api/v1/admin/analytics/progress` *(Thống Kê Tiến Độ Khảo Sát Thời Gian Thực)*
* **Mô tả:** Thống kê tổng hợp số lượng hồ sơ đã hoàn tất, đang làm, vắng nhà, bị trả về theo khoảng thời gian ngày/tuần/tháng trong phân khu Ga.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Query Parameters:**
  * `zoneId` (string, required): Ví dụ `"ZONE_S9"`
  * `period` (string, optional): `"DAILY"` | `"WEEKLY"` | `"MONTHLY"` | `"CUSTOM"` (default: `"WEEKLY"`)
  * `startDate` (string, optional): `"2026-09-01"`
  * `endDate` (string, optional): `"2026-09-16"`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "zoneId": "ZONE_S9",
    "zoneName": "Ga S9 - Bà Quẹo",
    "timeRange": { "start": "2026-09-01", "end": "2026-09-16" },
    "summary": {
      "totalParcelsInZone": 650,
      "approvedCompletedCount": 385,
      "submittedPendingAuditCount": 35,
      "inProgressCount": 20,
      "postponedAbsentCount": 18,
      "rejectedNeedResurveyCount": 5,
      "notSurveyedRemainingCount": 187,
      "completionRatePercent": 59.2
    },
    "dailyTimeline": [
      { "date": "2026-09-14", "approved": 25, "submitted": 12, "absent": 4 },
      { "date": "2026-09-15", "approved": 30, "submitted": 15, "absent": 3 },
      { "date": "2026-09-16", "approved": 18, "submitted": 8, "absent": 2 }
    ],
    "surveyorProductivity": [
      {
        "surveyorId": "u-001-surveyor",
        "surveyorName": "Nguyễn Văn Khảo Sát",
        "completedCount": 42,
        "absentRecordedCount": 6,
        "averageSurveyDurationMinutes": 28.5
      }
    ]
  }
}
```

---

### 2.1.2. `GET /api/v1/admin/reports/audit-alerts` *(Danh Sách Cảnh Báo Bất Thường & Gian Lận)*
* **Mô tả:** Trả về danh sách các hồ sơ bị hệ thống tự động gắn cờ cảnh báo rủi ro kỹ thuật hoặc nghi vấn gian lận hiện trường để Zone Admin ưu tiên thẩm định kỹ.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Query Parameters:**
  * `zoneId` (string, required): `"ZONE_S9"`
  * `alertType` (string, optional):
    * `GPS_DISTANCE_DISCREPANCY` (Tọa độ chụp ảnh/check-in cách xa tâm nhà $> X$ mét)
    * `ABNORMAL_DURATION` (Thời gian khảo sát 1 nhà quá nhanh $< 5$ phút)
    * `STRUCTURAL_CRITICAL` (Vết nứt nguy cấp cấp 4 hoặc lún nghiêng $\Delta > 0.5\%$)
    * `MISSING_SCALE_CARD` (Ảnh cận cảnh nghi vấn thiếu thước đo vạch mm)
    * `REPEATED_ABSENCE` (Đã đến vắng nhà $\ge 3$ lần)
  * `minSeverity` (string, optional): `"ALL"` | `"LOW"` | `"MEDIUM"` | `"HIGH"` | `"CRITICAL"`
* **Response `200 OK`:**
```json
{
  "success": true,
  "totalAlerts": 3,
  "data": [
    {
      "reportId": "rep-p1-00108",
      "parcelCode": "B-00108",
      "address": "860 Đường Trường Chinh",
      "surveyorName": "Nguyễn Văn Khảo Sát",
      "alertType": "GPS_DISTANCE_DISCREPANCY",
      "severity": "HIGH",
      "title": "Khoảng cách GPS bất thường",
      "detail": "Vị trí GPS lúc chụp ảnh P-02 cách tâm thửa đất trên GIS 78.5 mét (Ngưỡng cảnh báo: > 50 mét).",
      "flaggedValues": {
        "actualGpsDistanceMeters": 78.5,
        "allowedThresholdMeters": 50.0
      },
      "createdAt": "2026-09-16T08:30:00.000Z"
    },
    {
      "reportId": "rep-p1-00112",
      "parcelCode": "B-00112",
      "address": "868 Đường Trường Chinh",
      "surveyorName": "Trần Văn B",
      "alertType": "ABNORMAL_DURATION",
      "severity": "MEDIUM",
      "title": "Thời gian khảo sát quá nhanh",
      "detail": "Nhà quy mô 3 tầng nhưng thời gian hoàn thành từ ảnh P-01 đến khi nộp hồ sơ chỉ mất 4.2 phút (Ngưỡng cảnh báo: < 10 phút).",
      "flaggedValues": {
        "actualDurationMinutes": 4.2,
        "buildingFloors": 3
      },
      "createdAt": "2026-09-16T09:10:00.000Z"
    },
    {
      "reportId": "rep-p1-00115",
      "parcelCode": "B-00115",
      "address": "874 Đường Trường Chinh",
      "surveyorName": "Nguyễn Văn Khảo Sát",
      "alertType": "STRUCTURAL_CRITICAL",
      "severity": "CRITICAL",
      "title": "Cảnh báo Vết nứt Kết cấu Nguy cấp",
      "detail": "Ghim D-03 ghi nhận nứt uốn dầm BTCT chính có chiều rộng w = 3.2mm và cờ kết cấu Critical.",
      "flaggedValues": {
        "defectCode": "D-03",
        "crackWidthMm": 3.2,
        "structuralSignificance": "Critical"
      },
      "createdAt": "2026-09-16T09:45:00.000Z"
    }
  ]
}
```

---

### 2.1.3. `GET /api/v1/admin/reports/{reportId}/audit-flags` *(Chi tiết Cờ Cảnh Báo Của 1 Hồ Sơ)*
* **Mô tả:** Lấy danh sách toàn bộ các cờ vi phạm/cảnh báo tự động gắn với 1 hồ sơ khảo sát cụ thể để hiển thị Badge cảnh báo trực quan trên giao diện Split-Pane.
* **Response `200 OK`:**
```json
{
  "success": true,
  "reportId": "rep-p1-00108",
  "hasAlerts": true,
  "maxSeverity": "HIGH",
  "flags": [
    {
      "code": "WARN_GPS_DISTANCE_78M",
      "severity": "HIGH",
      "message": "Khoảng cách chụp ảnh lệch tâm thửa đất 78.5m"
    }
  ]
}
```

---

### 2.1.4. `GET /api/v1/admin/reports/{reportId}/audit-view` *(Payload Thẩm Định Split-Pane)*
* **Mô tả:** Cung cấp đầy đủ payload cho giao diện thẩm định Split-Pane của Zone Admin: Cây cấu kiện & điểm số ECS/VI bên trái, cặp ảnh bối cảnh $CTX$ và cận cảnh $CU$ có thước đo bên phải phục vụ soi kính lúp 400%, kèm toàn bộ Huy hiệu Cảnh báo Bất thường (Audit Flags).
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "reportId": "rep-p1-00108",
    "parcel": {
      "projectParcelCode": "B-00108",
      "fieldSurveyCode": "KS006",
      "ownerName": "Lê Văn Hùng",
      "address": "860 Đường Trường Chinh, P.15, Tân Bình"
    },
    "surveyor": {
      "name": "Nguyễn Văn Khảo Sát",
      "submittedAt": "2026-09-16T08:30:00.000Z"
    },
    "auditAlerts": [
      {
        "type": "GPS_DISTANCE_DISCREPANCY",
        "severity": "HIGH",
        "message": "Ảnh chụp lệch tâm nhà 78.5 mét"
      }
    ],
    "scores": {
      "ecsScore": 8,
      "viClass": "MEDIUM"
    },
    "zones": [
      {
        "zoneCode": "Z-01",
        "floor": "Tầng 1 (Trệt)",
        "room": "Phòng khách",
        "burlandGrade": 2,
        "ctxPhotoUrl": "https://s3.metro2.vn/photos/Z01_CTX_raw.jpg",
        "defects": [
          {
            "defectCode": "D-01",
            "pinX": 42.5,
            "pinY": 68.2,
            "widthMaxMm": 0.85,
            "lengthMm": 650.0,
            "hasScaleCard": true,
            "cuPhotoUrl": "https://s3.metro2.vn/photos/Z01_D01_CU_raw.jpg"
          }
        ]
      }
    ]
  }
}
```

---

### 2.1.5. `GET /api/v1/admin/reports` *(Danh Sách Báo Cáo Theo Bộ Lọc)*
* **Mô tả:** Tra cứu danh sách hồ sơ khảo sát theo ngày/tuần, phân khu Ga, trạng thái (`SUBMITTED`, `APPROVED`, `REJECTED`, `POSTPONED_ABSENT`) và cấp độ rủi ro VI.
* **Query Parameters:** `zoneId`, `status`, `viClass`, `startDate`, `endDate`, `page`, `limit`
* **Response `200 OK`:** Trả về danh sách hồ sơ phân trang.

---

### 2.1.6. `GET /api/v1/admin/parcels/unassigned`
* **Mô tả:** Lấy danh sách các thửa đất trong Ga chưa được giao việc để hiển thị lên bản đồ GIS.
* **Query Parameters:** `zoneId="ZONE_S9"`
* **Response `200 OK`:** `{ "success": true, "total": 45, "data": [...] }`

---

### 2.1.7. `GET /api/v1/reports/batch-export/{batchId}/status`
* **Mô tả:** Kiểm tra tiến độ hoàn thành đóng gói tập hồ sơ và lấy link tải có kèm Checksum SHA-256.
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "batchId": "batch-s9-20260916-001",
    "status": "COMPLETED",
    "totalReportsCompiled": 35,
    "downloadUrl": "https://s3.metro2.vn/dossiers/Dossier_Zone_S9_20260916.pdf",
    "checksumSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "fileSizeBytes": 48234900
  }
}
```

---

## 2.2. NHÓM PHƯƠNG THỨC POST (Phê Duyệt, Trả Về, Giao Việc, Đóng Gói Xuất Báo Cáo Chọn Lọc)

### 2.2.1. `POST /api/v1/reports/batch-export` *(Xuất Báo Cáo Có Chọn Lọc & Theo Tiêu Chí)*
* **Mô tả:** Đóng gói và xuất báo cáo linh hoạt theo 2 chế độ:
  1. **Chế độ 1 (Theo chỉ định):** Chọn trực tiếp danh sách các `reportIds` hoặc `parcelIds` cụ thể.
  2. **Chế độ 2 (Theo tiêu chí tổng hợp):** Xuất theo Phân khu Ga, khoảng thời gian ngày/tuần/tháng (`startDate` $\to$ `endDate`), trạng thái duyệt, hoặc phân loại rủi ro VI.
* **Định dạng xuất:**
  * `PDF_BOOK_COMPILATION`: 1 File PDF Tập hồ sơ duy nhất có bìa pháp lý, mục lục điện tử tự động, bản đồ GIS tổng hợp và mã băm SHA-256.
  * `ZIP_INDIVIDUAL_PDFS`: 1 File ZIP chứa từng file PDF/A đơn lẻ của từng căn nhà.
  * `EXCEL_SUMMARY`: Bảng thống kê Excel tổng hợp toàn bộ thông số kỹ thuật và điểm số ECS/VI.
* **Request Body (Theo Danh Sách Chỉ Định):**
```json
{
  "exportScope": "SELECTED_LIST",
  "selectedReportIds": ["rep-p1-00105", "rep-p1-00106", "rep-p1-00107"],
  "format": "PDF_BOOK_COMPILATION",
  "includeGisOverviewMap": true,
  "includeEcsSummaryTable": true,
  "notes": "Xuất 3 hồ sơ mặt tiền phục vụ thi công đóng cừ Larsen ngày 18/09"
}
```
* **Request Body (Theo Bộ Lọc Thời Gian / Tiêu Chí):**
```json
{
  "exportScope": "FILTER_CRITERIA",
  "filterCriteria": {
    "zoneId": "ZONE_S9",
    "startDate": "2026-09-08",
    "endDate": "2026-09-15",
    "periodLabel": "Báo cáo Tuần 37 - Ga S9 Bà Quẹo",
    "surveyStatus": "APPROVED",
    "viClasses": ["HIGH", "VERY_HIGH"]
  },
  "format": "PDF_BOOK_COMPILATION",
  "includeGisOverviewMap": true,
  "includeEcsSummaryTable": true
}
```
* **Response `202 Accepted`:**
```json
{
  "success": true,
  "batchId": "batch-s9-20260916-001",
  "status": "QUEUED",
  "totalReportsSelected": 35,
  "message": "Tiến trình đóng gói Báo cáo đã được tiếp nhận và xếp vào hàng đợi xử lý nền."
}
```

---

### 2.2.2. `POST /api/v1/admin/tasks/assign` *(Phân Công Nhiệm Vụ Trên Bản Đồ GIS)*
* **Mô tả:** Zone Admin chọn danh sách các thửa đất trên bản đồ GIS và giao cho một Surveyor kèm thời hạn hoàn thành.
* **Request Body:**
```json
{
  "parcelIds": ["p-00105", "p-00106", "p-00107"],
  "surveyorId": "u-001-surveyor",
  "deadline": "2026-09-20T17:00:00.000Z",
  "notes": "Ưu tiên khảo sát các căn mặt tiền trước."
}
```
* **Response `201 Created`:** `{ "success": true, "message": "Đã giao thành công 3 thửa đất.", "data": { "assignedCount": 3 } }`

---

### 2.2.3. `POST /api/v1/admin/reports/{reportId}/approve` *(Phê Duyệt Báo Cáo)*
* **Mô tả:** Zone Admin phê duyệt Báo cáo (Phím tắt `A`). Hệ thống tự động sinh file PDF/A chuẩn lưu trữ quốc tế, đóng dấu chữ ký số điện tử và lưu trữ S3.
* **Request Body:**
```json
{
  "engineeringJudgementNotes": "Hồ sơ ảnh CU đầy đủ thước đo mm hợp lệ, số liệu đo lún nghiêng đạt chuẩn."
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

---

### 2.2.4. `POST /api/v1/admin/reports/{reportId}/reject` *(Trả Về Báo Cáo)*
* **Mô tả:** Zone Admin trả về Báo cáo (Phím tắt `R`) kèm lý do kỹ thuật cụ thể. Tự động rollback các biến động ranh đất liên quan và gửi cảnh báo đỏ về app của Surveyor.
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

### 2.2.5. `POST /api/v1/admin/mutations/{mutationId}/approve` *(Phê Duyệt Biến Động Tách Thửa)*
* **Mô tả:** Phê duyệt sự kiện Tách thửa trong PostgreSQL Transaction an toàn: Chuyển thửa cũ sang `SPLIT_DEPRECATED`, kích hoạt chính thức các thửa mới `B-07001`, `B-07002` lên GIS Master.
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã kích hoạt chính thức các thửa đất mới lên GIS Master.",
  "data": {
    "mutationId": "mut-20260916-0001",
    "status": "APPROVED",
    "activatedParcelCodes": ["B-07001", "B-07002"]
  }
}
```

---

## 2.3. NHÓM PHƯƠNG THỨC PUT (Điều Chỉnh Phân Công)

### 2.3.1. `PUT /api/v1/admin/tasks/{taskId}/reassign`
* **Mô tả:** Chuyển giao nhiệm vụ khảo sát thửa đất sang một Cán bộ Khảo sát khác.
* **Request Body:** `{ "newSurveyorId": "u-002-surveyor", "reason": "Cán bộ u-001 chuyển sang hỗ trợ Ga S10" }`
* **Response `200 OK`:** `{ "success": true, "message": "Đã chuyển giao nhiệm vụ thành công." }`

---

## 2.4. NHÓM PHƯƠNG THỨC DELETE (Hủy Phân Công)

### 2.4.1. `DELETE /api/v1/admin/tasks/{taskId}`
* **Mô tả:** Hủy phân công nhiệm vụ khảo sát nếu chưa thực hiện.
* **Response `200 OK`:** `{ "success": true, "message": "Đã hủy phân công nhiệm vụ." }`

---

# 3. VAI TRÒ 3: TỔNG QUẢN TRỊ TOÀN TUYẾN (`SUPER_ADMIN`)

### 3.1. [GET] `GET /api/v1/zones`
* **Mô tả:** Lấy danh sách toàn bộ 11 Ga Metro 2 kèm thống kê tổng số thửa, số lượng đã khảo sát, số lượng đã duyệt và tỷ lệ hoàn thành (%).
* **Response `200 OK`:** Trả về danh sách 11 Ga từ Bến Thành đến Tham Lương.

### 3.2. [GET] `GET /api/v1/admin/users`
* **Mô tả:** Quản lý danh sách nhân sự toàn hệ thống.

### 3.3. [POST] `POST /api/v1/admin/users`
* **Mô tả:** Cấp tài khoản nội bộ mới (Zone Admin, Surveyor).
* **Request Body:** `{ "username": "zoneadmin_s10", "password": "Admin@123", "fullName": "Trần Văn Điều Phối", "role": "ZONE_ADMIN", "assignedZoneId": "ZONE_S10" }`
* **Response `201 Created`:** `{ "success": true, "message": "Tạo tài khoản thành công." }`

### 3.4. [POST] `POST /api/v1/admin/gis/import-parcels`
* **Mô tả:** Import hàng loạt thửa đất địa chính ban đầu từ file GeoJSON / Shapefile của Sở TN&MT.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `zoneId: "ZONE_S9"`, `geoJsonFile: <binary>`
* **Response `201 Created`:** `{ "success": true, "importedParcelsCount": 650 }`

### 3.5. [PUT] `PUT /api/v1/admin/gis/layers/metro-alignment`
* **Mô tả:** Cập nhật Tim tuyến Metro 2 GeoJSON và Vùng ảnh hưởng trực tiếp (Zone of Influence - ZOI).
* **Request Body:** `{ "centerlineGeoJson": { "type": "LineString", "coordinates": [...] }, "zoiBufferMeters": 50.0 }`
* **Response `200 OK`:** `{ "success": true, "message": "Đã cập nhật Tim tuyến Metro 2." }`

### 3.6. [PUT] `PUT /api/v1/admin/users/{userId}/status`
* **Mô tả:** Khóa hoặc kích hoạt lại tài khoản nhân sự (`ACTIVE` / `SUSPENDED`).
* **Request Body:** `{ "status": "SUSPENDED", "reason": "Nghỉ việc" }`
* **Response `200 OK`:** `{ "success": true, "message": "Đã cập nhật trạng thái tài khoản." }`

### 3.7. [DELETE] `DELETE /api/v1/admin/users/{userId}`
* **Mô tả:** Vô hiệu hóa và xóa tài khoản nhân sự.
* **Response `200 OK`:** `{ "success": true, "message": "Đã xóa tài khoản." }`

---

# 4. VAI TRÒ 4: NHÀ THẦU XÂY LẮP & KHÁCH TRA CỨU (`CONTRACTOR_GUEST`)

### 4.1. [GET] `GET /api/v1/guest/gis-map`
* **Mô tả:** Tra cứu bản đồ GIS quy hoạch các công trình đã duyệt thông qua Share Token an toàn.
* **Query Parameters:** `shareToken="SECURE_TOKEN_ABC"`, `passcode="123456"`
* **Response `200 OK`:** Trả về GeoJSON FeatureCollection các công trình đã công bố kèm Tim tuyến Metro 2.

### 4.2. [GET] `GET /api/v1/guest/parcels/{parcelId}/summary`
* **Mô tả:** Xem tóm tắt thông số kỹ thuật, điểm ECS và xếp hạng rủi ro VI của một công trình đã được công bố.
* **Response `200 OK`:** Trả về tóm tắt thông số kết cấu, điểm ECS/24, VI Class và link tải file PDF/A chính thức.

### 4.3. [GET] `GET /api/v1/guest/dossiers/{batchId}/download`
* **Mô tả:** Tải file Tập hồ sơ phân khu hoàn chỉnh (PDF Book Compilation) kèm mã băm Checksum SHA-256.
* **Response `200 OK`:** Stream file PDF kèm Header `X-Checksum-SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
