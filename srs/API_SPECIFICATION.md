# ĐẶC TẢ CHI TIẾT HỆ THỐNG RESTFUL API (API SPECIFICATION & CONTRACT)
## HỆ THỐNG KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH - METRO SỐ 2 (BẾN THÀNH – THAM LƯƠNG)

> [!IMPORTANT]
> **TÀI LIỆU QUY CHUẨN ĐẶC TẢ CHI TIẾT 100% ĐẦY ĐỦ TẤT CẢ REQUEST / RESPONSE PAYLOADS & QUY TRÌNH NGHIỆP VỤ:**
> Toàn bộ hệ thống API được phân cấp theo **4 Nhóm Vai trò Người dùng** (`SURVEYOR`, `ZONE_ADMIN`, `SUPER_ADMIN`, `CONTRACTOR_GUEST`) và phân cụm theo các phương thức HTTP (`POST`, `GET`, `PUT`, `DELETE`). Hệ thống loại bỏ hoàn toàn các "hố đen" chức năng:
> - **Chấm công 2 chiều:** Surveyor chấm công GPS $\rightarrow$ Zone Admin / Super Admin kiểm tra, đối soát vị trí GPS thực tế và phê duyệt chấm công.
> - **Quản trị Người dùng Toàn diện:** Super Admin tạo, sửa thông tin, đổi Ga, đổi Role, khóa/mở khóa tài khoản, reset mật khẩu và xóa tài khoản.
> - **Trung tâm Xuất Báo cáo Toàn tuyến:** Super Admin và Zone Admin có đầy đủ công cụ xuất theo chỉ định, xuất theo thời gian, theo dõi tiến độ, lịch sử toàn bộ các lượt export toàn hệ thống và thu hồi/xóa file.

---

## MỤC LỤC TỔNG QUAN HỆ THỐNG ENDPOINTS

```text
├── 0. PHÂN HỆ XÁC THỰC CHUNG (COMMON AUTHENTICATION)
│   ├── [POST] /api/v1/auth/login                                    # Đăng nhập hệ thống & Cấp JWT Token
│   ├── [POST] /api/v1/auth/refresh-token                            # Cấp lại Access Token mới
│   ├── [GET]  /api/v1/auth/me                                       # Lấy thông tin Profile & Quyền hạn
│   └── [POST] /api/v1/auth/logout                                   # Đăng xuất & Thu hồi Refresh Token
│
├── 1. VAI TRÒ 1: CÁN BỘ KHẢO SÁT HIỆN TRƯỜNG (FIELD SURVEYOR)
│   ├── [POST] Nhóm Tạo Mới, Upload, Khởi Tạo, Tự Nhận Thửa & Nộp Hồ Sơ
│   │   ├── 1.1.1. POST /api/v1/attendance/check-in                      # Chấm công GPS thực địa đầu ngày
│   │   ├── 1.1.2. POST /api/v1/parcels/{id}/start-survey                # Tự chọn ô thửa trên bản đồ & Khảo sát ngay (Ad-hoc Pick)
│   │   ├── 1.1.3. POST /api/v1/parcels/{id}/record-absence              # Ghi nhận nhà vắng / Cửa khóa (POSTPONED_ABSENT)
│   │   ├── 1.1.4. POST /api/v1/reports/phase1                           # Khởi tạo hồ sơ Phase 1 Baseline
│   │   ├── 1.1.5. POST /api/v1/reports/phase1/{id}/identification-photos# Bước 1: 4 Ảnh P01-P04 + Polygon N điểm + Phân tầng
│   │   ├── 1.1.6. POST /api/v1/reports/phase1/{id}/zones                # Bước 3: Tạo Vùng Z-xx + Ảnh CTX + Burland Grade
│   │   ├── 1.1.7. POST /api/v1/reports/phase1/zones/{id}/defects        # Bước 3: Ghim D-xx + Ảnh CU có thước + E2/E4
│   │   ├── 1.1.8. POST /api/v1/reports/phase1/{id}/sketch               # Bước 6: Sơ đồ phác thảo Damage Sketch / CAD
│   │   ├── 1.1.9. POST /api/v1/reports/phase1/{id}/calculate-scores     # Bước 7: Auto tính điểm ECS (0-24) & VI
│   │   ├── 1.1.10. POST /api/v1/reports/phase1/{id}/submit              # Bước 9: Nộp Phase 1 kèm chữ ký & ý kiến chủ hộ
│   │   ├── 1.1.11. POST /api/v1/mutations/propose                       # Bước 5: Đề xuất Tách/Gộp thửa, cấp mã > 07000
│   │   ├── 1.1.12. POST /api/v1/reports/phase2                          # Khởi tạo hồ sơ Phase 2 (kế thừa Phase 1)
│   │   ├── 1.1.13. POST /api/v1/reports/phase2/{id}/identification-photos# Phase 2 Bước 1: 2 Ảnh P01-P02 mới + Polygon N điểm
│   │   ├── 1.1.14. POST /api/v1/phase2/zones/{id}/defects               # Phase 2 Bước 3: Thả ghim D-new trên Vùng cũ
│   │   ├── 1.1.15. POST /api/v1/phase2/reports/{id}/zones               # Phase 2 Bước 3: Tạo Vùng Z-new mới phát sinh
│   │   ├── 1.1.16. POST /api/v1/reports/phase2/{id}/sketch              # Phase 2 Bước 6: Sơ đồ phác thảo Damage Sketch GĐ2
│   │   ├── 1.1.17. POST /api/v1/phase2/reports/{id}/summarize           # Phase 2 Bước 7: Tổng kết biến động, ΔECS, Quan trắc & NDT
│   │   └── 1.1.18. POST /api/v1/reports/phase2/{id}/submit              # Phase 2 Bước 9: Nộp Phase 2 kèm chữ ký 4 bên
│   │
│   ├── [GET] Nhóm Tra Cứu, Lọc Dữ Liệu Theo Vị Trí & Bản Đồ Quét Cạn
│   │   ├── 1.2.1. GET /api/v1/tasks/my-tasks                            # Danh sách công trình được giao việc
│   │   ├── 1.2.2. GET /api/v1/parcels/zone-map                          # Tải toàn bộ lớp thửa đất trong Ga lên bản đồ PWA
│   │   ├── 1.2.3. GET /api/v1/parcels/nearby                            # Tra cứu nhanh các thửa đất chưa khảo sát gần GPS
│   │   ├── 1.2.4. GET /api/v1/parcels/{id}                              # Chi tiết thửa đất & Đa giác ranh nhà Footprint
│   │   ├── 1.2.5. GET /api/v1/reports/phase1/{id}                       # Lấy chi tiết toàn bộ hồ sơ 9 bước Phase 1
│   │   ├── 1.2.6. GET /api/v1/parcels/{id}/phase2/zones                 # Phase 2: Lọc ảnh CTX và ghim cũ theo Tầng & Phòng
│   │   ├── 1.2.7. GET /api/v1/reports/phase2/{id}                       # Lấy chi tiết toàn bộ hồ sơ Phase 2
│   │   ├── 1.2.8. GET /api/v1/reports/phase2/{id}/quality-gate          # Phase 2 Bước 6: Checklist 10 tiêu chí Phụ lục A
│   │   ├── 1.2.9. GET /api/v1/photos/{id}/ai-status                     # Kiểm tra tiến độ AI nắn thẳng mặt đứng P-02
│   │   └── 1.2.10. GET /api/v1/attendance/my-history                    # Xem lịch sử chấm công của chính mình
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
│   ├── [GET] Nhóm Thống Kê Tiến Độ, Cảnh Báo Bất Thường, Chấm Công & Thẩm Định Split-Pane
│   │   ├── 2.1.1. GET /api/v1/admin/analytics/progress                  # Thống kê tiến độ Ngày/Tuần/Tháng (Xong, Chưa xong, Vắng...)
│   │   ├── 2.1.2. GET /api/v1/admin/reports/audit-alerts                # Động cơ cảnh báo gian lận & bất thường GPS/Kết cấu
│   │   ├── 2.1.3. GET /api/v1/admin/reports/{id}/audit-flags            # Chi tiết các cờ cảnh báo của 1 hồ sơ cụ thể
│   │   ├── 2.1.4. GET /api/v1/admin/reports/{id}/audit-view             # Payload Split-Pane (Kính lúp 400%) kèm cờ cảnh báo
│   │   ├── 2.1.5. GET /api/v1/admin/reports                             # Danh sách hồ sơ lọc theo ngày/tuần, trạng thái, rủi ro VI
│   │   ├── 2.1.6. GET /api/v1/admin/parcels/unassigned                  # Danh sách thửa đất chưa phân công
│   │   ├── 2.1.7. GET /api/v1/reports/batch-export/{batchId}/status     # Tiến độ đóng gói và link tải File kèm Checksum SHA
│   │   ├── 2.1.8. GET /api/v1/admin/attendance                         # Giám sát & Kiểm tra danh sách chấm công Surveyor trong Ga
│   │   ├── 2.1.9. GET /api/v1/admin/attendance/{id}                     # Chi tiết 1 lượt chấm công (GPS, Selfie, Khoảng cách Ga)
│   │   └── 2.1.10. GET /api/v1/admin/attendance/summary                 # Báo cáo chuyên cần chấm công theo tháng/tuần
│   │
│   ├── [POST] Nhóm Giao Việc, Phê Duyệt/Trả Về, Xác Nhận Chấm Công & Đóng Gói Báo Cáo
│   │   ├── 2.2.1. POST /api/v1/reports/batch-export                     # Xuất Báo cáo Chọn lọc: Theo ID chỉ định / Theo Ngày, Tuần
│   │   ├── 2.2.2. POST /api/v1/admin/tasks/assign                       # Giao việc trên bản đồ số GIS
│   │   ├── 2.2.3. POST /api/v1/admin/reports/{id}/approve               # Duyệt Báo cáo (Phím 'A') & Sinh PDF/A ký số
│   │   ├── 2.2.4. POST /api/v1/admin/reports/{id}/reject                # Trả về Báo cáo (Phím 'R') & Rollback biến động
│   │   ├── 2.2.5. POST /api/v1/admin/mutations/{id}/approve              # Phê duyệt biến động Tách/Gộp thửa đất
│   │   └── 2.2.6. POST /api/v1/admin/attendance/{id}/verify             # Phê duyệt / Cảnh báo / Từ chối lượt chấm công
│   │
│   ├── [PUT] Nhóm Điều Chỉnh Phân Công
│   │   └── 2.3.1. PUT /api/v1/admin/tasks/{taskId}/reassign             # Chuyển giao nhiệm vụ khảo sát sang Surveyor khác
│   │
│   └── [DELETE] Nhóm Hủy Phân Công
│       └── 2.4.1. DELETE /api/v1/admin/tasks/{taskId}                   # Hủy nhiệm vụ khảo sát
│
├── 3. VAI TRÒ 3: TỔNG QUẢN TRỊ TOÀN TUYẾN (SUPER ADMIN)
│   ├── [GET] Nhóm Toàn Cảnh Tuyến, Quản Trị Nhân Sự, Chấm Công & Lịch Sử Export
│   │   ├── 3.1. GET /api/v1/zones                                       # Danh sách 11 Ga Metro 2 & % tiến độ toàn tuyến
│   │   ├── 3.2. GET /api/v1/admin/analytics/global-overview             # Dashboard KPI toàn tuyến (Tiến độ, Rủi ro, Chuyên cần)
│   │   ├── 3.3. GET /api/v1/admin/users                                 # Danh sách tài khoản người dùng toàn hệ thống
│   │   ├── 3.4. GET /api/v1/admin/users/{id}                            # Xem chi tiết thông tin và quyền hạn 1 tài khoản
│   │   ├── 3.5. GET /api/v1/admin/attendance                            # Giám sát chấm công toàn tuyến 11 Ga
│   │   ├── 3.6. GET /api/v1/admin/reports/exports                       # Lịch sử & Quản lý toàn bộ các đợt xuất báo cáo hệ thống
│   │   └── 3.7. GET /api/v1/admin/reports/exports/{batchId}             # Chi tiết 1 mẻ xuất báo cáo và link tải
│   │
│   ├── [POST] Nhóm Cấp Tài Khoản, Import GIS, Xuất Báo Cáo Toàn Tuyến
│   │   ├── 3.8. POST /api/v1/admin/users                                # Cấp mới tài khoản nội bộ (Zone Admin, Surveyor...)
│   │   ├── 3.9. POST /api/v1/admin/users/{id}/reset-password            # Đặt lại mật khẩu tài khoản
│   │   ├── 3.10. POST /api/v1/admin/gis/import-parcels                  # Import hàng loạt thửa đất từ GeoJSON / Shapefile
│   │   └── 3.11. POST /api/v1/admin/reports/batch-export                # Xuất báo cáo toàn tuyến (11 Ga) hoặc chọn lọc liên ga
│   │
│   ├── [PUT] Nhóm Cập Nhật Thông Tin, Khóa Tài Khoản & Bản Đồ GIS
│   │   ├── 3.12. PUT /api/v1/admin/users/{id}                           # Cập nhật thông tin người dùng (Họ tên, SĐT, Role, Ga)
│   │   ├── 3.13. PUT /api/v1/admin/users/{id}/status                    # Khóa / Mở khóa tài khoản (ACTIVE, SUSPENDED, LOCKED)
│   │   └── 3.14. PUT /api/v1/admin/gis/layers/metro-alignment           # Cập nhật Tim tuyến Metro 2 & Vùng ảnh hưởng ZOI 50m
│   │
│   └── [DELETE] Nhóm Xóa Tài Khoản & Thu Hồi Mẻ Xuất
│       ├── 3.15. DELETE /api/v1/admin/users/{id}                        # Xóa / Vô hiệu hóa tài khoản người dùng
│       └── 3.16. DELETE /api/v1/admin/reports/exports/{batchId}         # Thu hồi / Xóa mẻ xuất báo cáo khỏi hệ thống
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
  "username": "surveyor_s9_01",
  "password": "Password@123"
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
      "username": "surveyor_s9_01",
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
  "type": "https://metro2.vn/errors/ERR_AUTH_INVALID_CREDENTIALS",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Tên đăng nhập hoặc mật khẩu không chính xác.",
  "instance": "/api/v1/auth/login"
}
```

---

### 0.2. [POST] `/api/v1/auth/refresh-token`
* **Mô tả:** Cấp lại Access Token mới khi token cũ hết hạn.
* **Request Body:**
```json
{
  "refreshToken": "d8f93b2a-81a1-432a-bc91-2384a9e21820"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new...",
    "expiresIn": 604800
  }
}
```

---

### 0.3. [GET] `/api/v1/auth/me`
* **Mô tả:** Lấy thông tin tài khoản hiện tại từ JWT token trong Header `Authorization: Bearer <token>`.
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "u-001-surveyor",
    "username": "surveyor_s9_01",
    "fullName": "Nguyễn Văn Khảo Sát",
    "role": "SURVEYOR",
    "assignedZoneId": "ZONE_S9",
    "assignedZoneName": "Ga S9 - Bà Quẹo",
    "avatarUrl": "https://s3.metro2.vn/avatars/u-001.jpg"
  }
}
```

---

### 0.4. [POST] `/api/v1/auth/logout`
* **Mô tả:** Đăng xuất và thu hồi Refresh Token.
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã đăng xuất thành công."
}
```

---

# 1. VAI TRÒ 1: CÁN BỘ KHẢO SÁT HIỆN TRƯỜNG (`SURVEYOR`)

---

## 1.1. NHÓM PHƯƠNG THỨC POST (Tạo mới, Upload, Khởi tạo, Tự nhận thửa, Nộp hồ sơ)

### 1.1.1. `POST /api/v1/attendance/check-in`
* **Mô tả:** Chấm công GPS đầu ngày tại hiện trường. Tinh gọn: Chỉ cần gửi tọa độ GPS thực tế (`gpsLat`, `gpsLng`), mã Ga (`zoneId`), ảnh selfie và ghi chú tùy chọn. Lượt chấm công được chuyển đến Zone Admin để đối soát.
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `zoneId` (string, required): Mã Ga, ví dụ `"ZONE_S9"`
  * `gpsLat` (number, required): `10.798123`
  * `gpsLng` (number, required): `106.645678`
  * `selfieFile` (file binary, optional): Ảnh chụp selfie tại hiện trường
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
    "zoneId": "ZONE_S9",
    "verificationStatus": "PENDING_VERIFICATION",
    "distanceToZoneCenterMeters": 35.4
  }
}
```
* **Response `400 Bad Request`:**
```json
{
  "type": "https://metro2.vn/errors/ERR_INVALID_GPS",
  "title": "Bad Request",
  "status": 400,
  "detail": "Tọa độ GPS không hợp lệ hoặc nằm ngoài phạm vi TP.HCM.",
  "instance": "/api/v1/attendance/check-in"
}
```

---

### 1.1.2. `POST /api/v1/parcels/{parcelId}/start-survey` *(Tự chọn thửa trên bản đồ & Khảo sát ngay)*
* **Mô tả:** Khi đến một nhà trong danh sách phân công nhưng chủ nhà đi vắng, Surveyor chạm trực tiếp vào một ô thửa đất liền kề trên bản đồ GIS của PWA để **tự nhận và bắt đầu khảo sát ngay lập tức (Ad-hoc Sweep Survey)**.
* **Quyền truy cập:** `SURVEYOR`
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
    "assignedSurveyorId": "u-001-surveyor",
    "startedAt": "2026-09-16T08:20:00.000Z"
  }
}
```
* **Response `409 Conflict`:**
```json
{
  "type": "https://metro2.vn/errors/ERR_PARCEL_ALREADY_CLAIMED",
  "title": "Conflict",
  "status": 409,
  "detail": "Thửa đất B-00106 đang được khảo sát bởi Surveyor khác (u-002-surveyor).",
  "instance": "/api/v1/parcels/p-00106/start-survey"
}
```

---

### 1.1.3. `POST /api/v1/parcels/{parcelId}/record-absence` *(Ghi nhận vắng nhà / Hoãn khảo sát)*
* **Mô tả:** Ghi nhận nhật ký khi đến nhà được giao nhưng chủ hộ đi vắng, cửa khóa hoặc từ chối tiếp cận. Thửa đất tự động chuyển sang trạng thái Tạm hoãn (`POSTPONED_ABSENT` - Màu Tím) với bộ đếm `attemptCount`.
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `absenceReason` (string, required): `"HOMEOWNER_ABSENT"` (Đi vắng) | `"LOCKED_GATE"` (Khóa cửa ngoài) | `"REFUSED_ACCESS"` (Từ chối)
  * `notes` (string, optional): `"Đã gọi điện thoại 2 lần không nhấc máy, hàng xóm báo đi công tác"`
  * `photoProofFile` (file binary, optional): Ảnh chụp cửa khóa/hiện trạng nhà vắng
  * `rescheduleDate` (string, optional): `"2026-09-18T09:00:00.000Z"`
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
    "proofPhotoUrl": "https://s3.metro2.vn/absence_proofs/p-00105_attempt1.jpg",
    "recordedAt": "2026-09-16T08:15:00.000Z"
  }
}
```

---

### 1.1.4. `POST /api/v1/reports/phase1` *(Khởi tạo hồ sơ Phase 1)*
* **Mô tả:** Khởi tạo hồ sơ khảo sát Giai đoạn 1 (Phase 1 Baseline) cho một thửa đất.
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: application/json`
* **Request Body:**
```json
{
  "parcelId": "p-00105",
  "surveyType": "BASELINE_PHASE1",
  "notes": "Khởi tạo hồ sơ khảo sát hiện trạng công trình"
}
```
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã khởi tạo hồ sơ Phase 1 thành công.",
  "data": {
    "reportId": "rep-p1-00105",
    "parcelId": "p-00105",
    "projectParcelCode": "B-00105",
    "fieldSurveyCode": "KS004",
    "status": "DRAFT",
    "currentStep": 1,
    "createdAt": "2026-09-16T08:00:00.000Z"
  }
}
```

---

### 1.1.5. `POST /api/v1/reports/phase1/{reportId}/identification-photos`
* **Mô tả:** Bước 1 - Upload bộ 4 ảnh định danh mặt ngoài ($P-01$ Biển số nhà, $P-02$ Toàn cảnh mặt đứng, $P-03$ Hông trái/sau, $P-04$ Bối cảnh ngõ/đường). Hỗ trợ nút chọn **Không tồn tại (N/A)** kèm lý do, và hỗ trợ đa giác mặt đứng với **số đỉnh $N$ bất kỳ** ($N \ge 3$).
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `p01File` (file binary, optional), `p01IsNA` (boolean), `p01NAReason` (string)
  * `p02File` (file binary, optional), `p02IsNA` (boolean), `p02NAReason` (string)
  * `p02PolygonPoints` (string JSON, optional): Mảng $N$ điểm góc đa giác `[{"x": 120, "y": 850}, {"x": 890, "y": 830}, {"x": 870, "y": 150}, {"x": 500, "y": 50}, {"x": 140, "y": 180}]` (Hỗ trợ nhà mái xéo, chữ L, giật cấp $N$ đỉnh)
  * `p02FloorSplitLines` (string JSON, optional): Mảng đường phân tầng ngang `[{"floor": 1, "y": 620}, {"floor": 2, "y": 390}]`
  * `p02Dimensions` (string JSON, optional): `{"h1": "3.8m", "h2": "3.4m", "totalHeight": "11.5m", "facadeWidth": "4.2m"}`
  * `p03File` (file binary, optional), `p03IsNA` (boolean), `p03NAReason` (string)
  * `p04File` (file binary, optional), `p04IsNA` (boolean), `p04NAReason` (string)
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã lưu bộ ảnh định danh P01-P04. Ảnh P-02 đã được gửi vào hàng đợi AI nắn thẳng.",
  "data": {
    "p01Url": "https://s3.metro2.vn/photos/rep-p1-00105/P01_raw.jpg",
    "p02Url": "https://s3.metro2.vn/photos/rep-p1-00105/P02_raw.jpg",
    "p02AiJobId": "ai-job-p02-99812",
    "p02PolygonSaved": true,
    "p03Url": null,
    "p03IsNA": true,
    "p03NAReason": "Nhà liền kề sát vách 2 bên, không có góc chụp hông",
    "p04Url": "https://s3.metro2.vn/photos/rep-p1-00105/P04_raw.jpg"
  }
}
```

---

### 1.1.6. `POST /api/v1/reports/phase1/{reportId}/zones`
* **Mô tả:** Bước 3 - Tạo Vùng khảo sát hư hỏng $Z-xx$ cho từng Tầng/Phòng, upload ảnh bối cảnh góc rộng $CTX$, đánh giá ảnh hưởng chức năng và chốt cấp độ Burland (0-5) tại chỗ.
* **Quyền truy cập:** `SURVEYOR`
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
  "message": "Đã tạo Vùng khảo sát Z-01 thành công.",
  "data": {
    "zoneId": "z-01-p1-00105",
    "zoneCode": "Z-01",
    "floorName": "Tầng 1 (Trệt)",
    "roomName": "Phòng khách phía trước",
    "componentType": "WALL",
    "burlandGrade": 2,
    "functionalImpactRepairNeeded": true,
    "ctxPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/Z01_CTX_raw.jpg"
  }
}
```

---

### 1.1.7. `POST /api/v1/reports/phase1/zones/{zoneId}/defects`
* **Mô tả:** Bước 3 (Chi tiết) - Thả ghim khuyết tật $D-xx$ trên ảnh bối cảnh $Z-xx$, upload ảnh cận cảnh $CU$ có thước đo vạch mm (Scale Card), đo đạc $w_{max}$, $L$, và tự động map các điểm thành phần $E2$ (Ý nghĩa kết cấu) và $E4$ (Suy giảm vật liệu).
* **Quyền truy cập:** `SURVEYOR`
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
  * `cuPhotoFile` (file binary, required): Ảnh cận cảnh có thước đo vạch mm
  * `extraPhotoFile` (file binary, optional): Ảnh chụp phụ
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã tạo ghim khuyết tật D-01 thành công.",
  "data": {
    "defectId": "def-01-z01",
    "defectCode": "D-01",
    "pinX": 42.5,
    "pinY": 68.2,
    "screeningCategory": "NỨT_TƯỜNG_HOÀN_THIỆN",
    "defectType": "DIAGONAL_SHEAR_CRACK",
    "widthMaxMm": 0.85,
    "lengthMm": 650.0,
    "activityState": "U",
    "materialDegradationE4": 1,
    "structuralSignificanceE2": 1,
    "hasScaleCard": true,
    "cuPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/Z01_D01_CU_raw.jpg"
  }
}
```

---

### 1.1.8. `POST /api/v1/reports/phase1/{reportId}/sketch`
* **Mô tả:** Bước 6 - Upload ảnh chụp bản vẽ phác thảo sơ đồ vị trí khuyết tật (Damage Location Sketch) hoặc nhập số hiệu bản vẽ CAD.
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `sketchPhotoFile` (file binary, optional): Ảnh chụp tay sơ đồ phác thảo
  * `cadDrawingRef` (string, optional): `"CAD-DWG-S9-00105-REV1"`
  * `notes` (string, optional): `"Sơ đồ vị trí khuyết tật tầng trệt và mặt tiền"`
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã lưu bản vẽ sơ đồ phác thảo hư hỏng.",
  "data": {
    "sketchId": "skt-p1-00105",
    "sketchPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/sketch_001.jpg",
    "cadDrawingRef": "CAD-DWG-S9-00105-REV1",
    "uploadedAt": "2026-09-16T09:00:00.000Z"
  }
}
```

---

### 1.1.9. `POST /api/v1/reports/phase1/{reportId}/calculate-scores`
* **Mô tả:** Bước 7 - Tự động tổng hợp điểm $E1..E6 \rightarrow \Sigma E / 24$ (ECS Class: `Good` [0-5], `Medium` [6-10], `Deficient` [11-16], `Critical` [17-24]) và Chỉ số tổn thương $V1..V6 \rightarrow VI Class$ (`Low`, `Medium`, `High`, `Very High`).
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:**
```json
{
  "engineeringJudgementAction": "KEEP",
  "engineeringJudgementReason": "Điểm số tự động phản ánh chính xác hiện trạng vết nứt tường trệt."
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
    "breakdownE": {
      "E1_burland": 2,
      "E2_structure": 1,
      "E3_deformation": 1,
      "E4_materials": 1,
      "E5_history": 1,
      "E6_overall": 0
    },
    "breakdownV": {
      "V1_importance": 2,
      "V2_structure": 2,
      "V3_foundation": 2,
      "V4_age": 2,
      "V5_ecs": 2,
      "V6_sensitivity": 1
    }
  }
}
```

---

### 1.1.10. `POST /api/v1/reports/phase1/{reportId}/submit`
* **Mô tả:** Bước 9 - Nộp chính thức Báo cáo Phase 1 kèm ý kiến phản hồi chủ hộ, ảnh chữ ký hoặc biên bản vắng mặt/từ chối.
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `ownerRemarks` (string, optional): `"Chủ hộ đồng ý với toàn bộ các vết nứt hiện trạng ghi nhận trong biên bản."`
  * `surveyorSignatureFile` (file binary, required): Chữ ký cán bộ khảo sát
  * `ownerSignatureFile` (file binary, optional): Chữ ký chủ hộ
  * `isRefusedOrAbsent` (boolean, default: false)
  * `refusalDocRef` (string, optional): Số hiệu biên bản xác nhận vắng mặt/từ chối
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Báo cáo Phase 1 đã được nộp thành công và chuyển sang trạng thái chờ duyệt.",
  "data": {
    "reportId": "rep-p1-00105",
    "status": "SUBMITTED",
    "submittedAt": "2026-09-16T09:30:00.000Z",
    "surveyorSignatureUrl": "https://s3.metro2.vn/signatures/rep-p1-00105_surveyor.png",
    "ownerSignatureUrl": "https://s3.metro2.vn/signatures/rep-p1-00105_owner.png"
  }
}
```

---

### 1.1.11. `POST /api/v1/mutations/propose`
* **Mô tả:** Bước 5 (Ranh GIS) - Đề xuất Tách/Gộp thửa khi phát hiện nhà thực tế chia nhỏ $\rightarrow$ Tự động cấp mã từ dải mở rộng ($> 07000$).
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: application/json`
* **Request Body:**
```json
{
  "mutationType": "SPLIT",
  "sourceParcelId": "p-00002",
  "reason": "Nhà gốc B-00002 thực tế đã chia thành 2 căn hộ riêng biệt có 2 lối đi độc lập.",
  "childPolygons": [
    {
      "tempLabel": "Căn trước (A)",
      "polygonGeoJson": {
        "type": "Polygon",
        "coordinates": [[[106.641, 10.796], [106.645, 10.796], [106.645, 10.798], [106.641, 10.798], [106.641, 10.796]]]
      }
    },
    {
      "tempLabel": "Căn sau (B)",
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
  "message": "Đã tạo đề xuất Tách thửa. Đã cấp 2 mã thửa mới từ dải mở rộng.",
  "data": {
    "mutationId": "mut-20260916-0001",
    "mutationType": "SPLIT",
    "sourceParcelCode": "B-00002",
    "status": "PENDING_APPROVAL",
    "newParcels": [
      { "parcelId": "p-07001", "projectParcelCode": "B-07001", "label": "Căn trước (A)" },
      { "parcelId": "p-07002", "projectParcelCode": "B-07002", "label": "Căn sau (B)" }
    ]
  }
}
```

---

### 1.1.12. `POST /api/v1/reports/phase2`
* **Mô tả:** Khởi tạo hồ sơ khảo sát Giai đoạn 2 (Phiếu 02 - Pre-Construction BCS), tự động kế thừa toàn bộ dữ liệu gốc từ Phase 1 đã duyệt.
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: application/json`
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
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã khởi tạo hồ sơ Phase 2 và kế thừa toàn bộ dữ liệu Phase 1.",
  "data": {
    "reportId": "rep-p2-00105",
    "parcelId": "p-00105",
    "projectParcelCode": "B-00105",
    "inheritedPhase1Id": "rep-p1-00105",
    "status": "DRAFT",
    "currentStep": 1,
    "createdAt": "2026-09-16T10:00:00.000Z"
  }
}
```

---

### 1.1.13. `POST /api/v1/reports/phase2/{reportId}/identification-photos`
* **Mô tả:** Phase 2 Bước 1 - Chụp 2 ảnh nhận dạng Giai đoạn 2 ($P-01$ Biển số & mặt đứng, $P-02$ Bối cảnh đường). Hỗ trợ nút N/A và vẽ đa giác $N$ đỉnh.
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `p01File` (file binary, optional), `p01IsNA` (boolean), `p01NAReason` (string)
  * `p01PolygonPoints` (string JSON, optional): `[{"x": 100, "y": 900}, {"x": 880, "y": 890}, {"x": 860, "y": 140}, {"x": 110, "y": 150}]`
  * `p01FloorSplitLines` (string JSON, optional): `[{"floor": 1, "y": 640}, {"floor": 2, "y": 380}]`
  * `p02File` (file binary, optional), `p02IsNA` (boolean), `p02NAReason` (string)
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã lưu bộ ảnh nhận dạng Phase 2 thành công.",
  "data": {
    "p01Url": "https://s3.metro2.vn/photos/rep-p2-00105/P01_raw.jpg",
    "p02Url": "https://s3.metro2.vn/photos/rep-p2-00105/P02_raw.jpg"
  }
}
```

---

### 1.1.14. `POST /api/v1/phase2/zones/{zoneId}/defects`
* **Mô tả:** Phase 2 Bước 3 (Cơ chế A) - Chấm thêm vết nứt mới phát sinh $D-new$ trên ảnh bối cảnh $CTX$ cũ. Tự động gán mã `D-04 (MỚI)` màu Đỏ.
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `pinX`, `pinY` (number, required): `55.4`, `42.1`
  * `screeningCategory` (string, required): `"NỨT_KẾT_CẤU_CỘT_DẦM"`
  * `defectType` (string, required): `"VERTICAL_CRACK"`
  * `crackDirection` (string, optional): `"Dọc thân cột trục C"`
  * `widthMaxMm` (number, required): `0.65`
  * `lengthMm` (number, required): `450.0`
  * `activityState` (string, required): `"A"`
  * `materialDegradationE4` (integer, required, 0-4): `2`
  * `structuralSignificanceE2` (integer, required, 0-4): `2`
  * `hasScaleCard` (boolean, required): `true`
  * `cuPhotoFile` (file binary, required): Ảnh cận cảnh có thước đo
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã ghi nhận khuyết tật mới phát sinh tại GĐ2.",
  "data": {
    "defectId": "def-p2-04-z01",
    "defectCode": "D-04 (MỚI)",
    "isNewInPhase2": true,
    "evolutionStatus": "NEW_RECORDED",
    "pinColor": "#F44336",
    "widthMaxMm": 0.65,
    "lengthMm": 450.0,
    "cuPhotoUrl": "https://s3.metro2.vn/photos/rep-p2-00105/Z01_D04_NEW_CU_raw.jpg"
  }
}
```

---

### 1.1.15. `POST /api/v1/phase2/reports/{reportId}/zones`
* **Mô tả:** Phase 2 Bước 3 (Cơ chế B) - Tạo Vùng mới $Z-new$ khi xuất hiện khu vực mới phát sinh tại GĐ2.
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `floorName` (string, required): `"Tầng 2"`
  * `roomName` (string, required): `"Ban công trước cơi nới"`
  * `componentType` (string, required): `"SLAB"`
  * `slabCondition` (string, required): `"Nứt võng sàn"`
  * `wallCondition` (string, required): `"Bình thường"`
  * `beamColumnCondition` (string, required): `"Không có"`
  * `seepageSpallingCondition` (string, required): `"Thấm chân tường"`
  * `deformationCondition` (string, required): `"Nghiêng nhẹ"`
  * `ctxPhotoFile` (file binary, required): Ảnh bối cảnh vùng mới
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã tạo Vùng khảo sát mới Z-04 tại Phase 2.",
  "data": {
    "zoneId": "z-04-p2-00105",
    "zoneCode": "Z-04 (MỚI)",
    "isNewInPhase2": true,
    "floorName": "Tầng 2",
    "roomName": "Ban công trước cơi nới",
    "ctxPhotoUrl": "https://s3.metro2.vn/photos/rep-p2-00105/Z04_CTX_raw.jpg"
  }
}
```

---

### 1.1.16. `POST /api/v1/reports/phase2/{reportId}/sketch`
* **Mô tả:** Phase 2 Bước 6 - Upload sơ đồ vị trí khuyết tật GĐ2.
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `sketchPhotoFile` (file binary, optional): Ảnh sơ đồ phác thảo GĐ2
  * `cadDrawingRef` (string, optional): `"CAD-P2-S9-00105"`
  * `notes` (string, optional): `"Bổ sung vị trí nứt mới ban công tầng 2"`
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã lưu bản vẽ sơ đồ hư hỏng GĐ2.",
  "data": {
    "sketchId": "skt-p2-00105",
    "sketchPhotoUrl": "https://s3.metro2.vn/photos/rep-p2-00105/sketch_p2.jpg",
    "cadDrawingRef": "CAD-P2-S9-00105"
  }
}
```

---

### 1.1.17. `POST /api/v1/phase2/reports/{reportId}/summarize`
* **Mô tả:** Phase 2 Bước 7 - Tự động tổng hợp biến động so với GĐ1, tính $\Delta ECS$, phát hiện cảnh báo nguy cấp, chốt nhu cầu quan trắc & NDT.
* **Quyền truy cập:** `SURVEYOR`
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
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `ownerRemarks` (string, optional): `"Chủ hộ xác nhận có vết nứt mới ban công"`
  * `ownerSignatureFile` (file binary, optional): Chữ ký chủ nhà
  * `contractorRepSignatureFile` (file binary, required): Đại diện nhà thầu
  * `thirdPartyRepSignatureFile` (file binary, required): Đơn vị độc lập
  * `witnessSignatureFile` (file binary, optional): Người làm chứng
  * `isRefusedOrAbsent` (boolean, default: false)
  * `refusalDocRef` (string, optional): Số biên bản vắng mặt
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã nộp Báo cáo Phase 2 thành công.",
  "data": {
    "reportId": "rep-p2-00105",
    "status": "SUBMITTED",
    "submittedAt": "2026-09-16T11:00:00.000Z",
    "signaturesCount": 4
  }
}
```

---

## 1.2. NHÓM PHƯƠNG THỨC GET (Tra Cứu, Lọc Dữ Liệu Theo Vị Trí & Bản Đồ Quét Cạn)

### 1.2.1. `GET /api/v1/tasks/my-tasks`
* **Mô tả:** Lấy danh sách công trình được phân công nhiệm vụ cho Surveyor hiện tại.
* **Quyền truy cập:** `SURVEYOR`
* **Query Parameters:** `status` (string, optional: `PENDING` | `IN_PROGRESS` | `COMPLETED`), `zoneId` (string, optional)
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "taskId": "tsk-00105",
      "parcelId": "p-00105",
      "projectParcelCode": "B-00105",
      "fieldSurveyCode": "KS004",
      "address": "854 Đường Trường Chinh, P.15, Tân Bình",
      "ownerName": "Nguyễn Văn Hùng",
      "gpsTarget": { "lat": 10.798123, "lng": 106.645678 },
      "phase": "PHASE_1",
      "surveyStatus": "NOT_SURVEYED",
      "deadline": "2026-09-20T17:00:00.000Z"
    }
  ]
}
```

---

### 1.2.2. `GET /api/v1/parcels/zone-map`
* **Mô tả:** Tải toàn bộ lớp thửa đất trong Ga lên bản đồ PWA với các mã màu trực quan:
  * ⚪ `#9E9E9E`: `NOT_SURVEYED`
  * 🔵 `#2196F3`: `ASSIGNED_TO_ME`
  * 🟡 `#FFC107`: `IN_PROGRESS`
  * 🟣 `#9C27B0`: `POSTPONED_ABSENT`
  * 🟠 `#FF9800`: `SUBMITTED`
  * 🟢 `#4CAF50`: `APPROVED`
  * 🔴 `#F44336`: `REJECTED`
* **Quyền truy cập:** `SURVEYOR`, `ZONE_ADMIN`, `SUPER_ADMIN`
* **Query Parameters:** `zoneId` (string, required): `"ZONE_S9"`
* **Response `200 OK`:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "p-00105",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[106.6451, 10.7981], [106.6455, 10.7981], [106.6455, 10.7984], [106.6451, 10.7984], [106.6451, 10.7981]]]
      },
      "properties": {
        "parcelId": "p-00105",
        "projectParcelCode": "B-00105",
        "fieldSurveyCode": "KS004",
        "address": "854 Đường Trường Chinh",
        "ownerName": "Nguyễn Văn Hùng",
        "surveyStatus": "NOT_SURVEYED",
        "pinColor": "#9E9E9E",
        "assignedSurveyorId": "u-001-surveyor"
      }
    }
  ]
}
```

---

### 1.2.3. `GET /api/v1/parcels/nearby`
* **Mô tả:** Tra cứu nhanh các thửa đất chưa khảo sát xung quanh vị trí GPS (bán kính 50m - 200m) phục vụ kịch bản vắng nhà chuyển sang quét cạn các nhà liền kề.
* **Quyền truy cập:** `SURVEYOR`
* **Query Parameters:**
  * `lat` (number, required): `10.798123`
  * `lng` (number, required): `106.645678`
  * `radiusMeters` (number, optional, default: 150): `150`
  * `status` (string, optional, default: `"NOT_SURVEYED"`): `"NOT_SURVEYED"`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "parcelId": "p-00106",
      "projectParcelCode": "B-00106",
      "fieldSurveyCode": "KS005",
      "address": "856 Đường Trường Chinh",
      "ownerName": "Trần Thị Mai",
      "distanceMeters": 12.4,
      "surveyStatus": "NOT_SURVEYED",
      "canSelfClaim": true
    },
    {
      "parcelId": "p-00107",
      "projectParcelCode": "B-00107",
      "fieldSurveyCode": "KS006",
      "address": "858 Đường Trường Chinh",
      "ownerName": "Hoàng Văn Tuấn",
      "distanceMeters": 28.1,
      "surveyStatus": "NOT_SURVEYED",
      "canSelfClaim": true
    }
  ]
}
```

---

### 1.2.4. `GET /api/v1/parcels/{parcelId}`
* **Mô tả:** Lấy chi tiết thông tin thửa đất, mã kép `B-xxxxx` và `KSxxx`, đa giác ranh nhà footprint.
* **Quyền truy cập:** `SURVEYOR`, `ZONE_ADMIN`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "parcelId": "p-00105",
    "projectParcelCode": "B-00105",
    "fieldSurveyCode": "KS004",
    "zoneId": "ZONE_S9",
    "zoneName": "Ga S9 - Bà Quẹo",
    "address": "854 Đường Trường Chinh, P.15, Tân Bình",
    "ownerName": "Nguyễn Văn Hùng",
    "ownerPhone": "0908123456",
    "landAreaM2": 68.5,
    "constructionAreaM2": 52.0,
    "floorCount": 3,
    "surveyStatus": "IN_PROGRESS",
    "activePhase1ReportId": "rep-p1-00105",
    "footprintPolygonGeoJson": {
      "type": "Polygon",
      "coordinates": [[[106.6451, 10.7981], [106.6455, 10.7981], [106.6455, 10.7984], [106.6451, 10.7984], [106.6451, 10.7981]]]
    }
  }
}
```

---

### 1.2.5. `GET /api/v1/reports/phase1/{reportId}`
* **Mô tả:** Lấy toàn bộ payload 9 bước của hồ sơ Phase 1.
* **Quyền truy cập:** `SURVEYOR`, `ZONE_ADMIN`, `SUPER_ADMIN`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "reportId": "rep-p1-00105",
    "status": "DRAFT",
    "currentStep": 3,
    "parcel": {
      "parcelId": "p-00105",
      "projectParcelCode": "B-00105",
      "fieldSurveyCode": "KS004",
      "address": "854 Đường Trường Chinh, P.15, Tân Bình",
      "ownerName": "Nguyễn Văn Hùng",
      "ownerPhone": "0908123456"
    },
    "generalInfo": {
      "buildingName": "Nhà ở gia đình kết hợp kinh doanh",
      "buildingGrade": "GENERAL",
      "adjacentBuildings": "Giáp số 852 (2 tầng) và số 856 (cấp 4)"
    },
    "specs": {
      "structuralSystem": "KHUNG_BTCT_CHIU_LUC",
      "floorCount": 3,
      "basementCount": 0,
      "foundationCategory": "CAT_2_MONG_DON_BTCT",
      "roofType": "MAI_TON",
      "wallType": "TUONG_GACH_200",
      "yearOfConstruction": 2015
    },
    "identificationPhotos": {
      "p01Url": "https://s3.metro2.vn/photos/rep-p1-00105/P01_raw.jpg",
      "p02Url": "https://s3.metro2.vn/photos/rep-p1-00105/P02_raw.jpg",
      "p02RectifiedUrl": "https://s3.metro2.vn/photos/rep-p1-00105/P02_rectified_cad.jpg",
      "p03Url": null,
      "p03IsNA": true,
      "p04Url": "https://s3.metro2.vn/photos/rep-p1-00105/P04_raw.jpg"
    },
    "zones": [
      {
        "zoneId": "z-01-p1-00105",
        "zoneCode": "Z-01",
        "floorName": "Tầng 1 (Trệt)",
        "roomName": "Phòng khách phía trước",
        "componentType": "WALL",
        "burlandGrade": 2,
        "ctxPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/Z01_CTX_raw.jpg",
        "defects": [
          {
            "defectId": "def-01-z01",
            "defectCode": "D-01",
            "pinX": 42.5,
            "pinY": 68.2,
            "screeningCategory": "NỨT_TƯỜNG_HOÀN_THIỆN",
            "defectType": "DIAGONAL_SHEAR_CRACK",
            "widthMaxMm": 0.85,
            "lengthMm": 650.0,
            "cuPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/Z01_D01_CU_raw.jpg"
          }
        ]
      }
    ],
    "deformation": {
      "tiltAngleX": 0.12,
      "tiltAngleY": 0.08,
      "tiltDirection": "NGHIENG_RA_TRUOC",
      "floorSlopeRatio": 0.003,
      "beamDeflectionMm": 2.5
    },
    "scores": {
      "ecsScore": 6,
      "ecsClass": "MEDIUM",
      "viAverageScore": 2.15,
      "viClass": "MEDIUM"
    }
  }
}
```

---

### 1.2.6. `GET /api/v1/parcels/{parcelId}/phase2/zones`
* **Mô tả:** Phase 2 Bước 3.1 - Tự động lọc và tải về ảnh bối cảnh $CTX$ và toàn bộ ghim $D-xx$ cũ của đúng Tầng & Phòng mà Surveyor đang đứng.
* **Quyền truy cập:** `SURVEYOR`
* **Query Parameters:**
  * `floor` (string, required): `"Tầng 1 (Trệt)"`
  * `room` (string, required): `"Phòng khách phía trước"`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "zoneId": "z-01-p1-00105",
      "zoneCode": "Z-01",
      "floorName": "Tầng 1 (Trệt)",
      "roomName": "Phòng khách phía trước",
      "burlandGrade": 2,
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
```

---

### 1.2.7. `GET /api/v1/reports/phase2/{reportId}`
* **Mô tả:** Lấy chi tiết toàn bộ hồ sơ Phase 2 (kế thừa Phase 1 + biến động mới).
* **Quyền truy cập:** `SURVEYOR`, `ZONE_ADMIN`, `SUPER_ADMIN`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "reportId": "rep-p2-00105",
    "parcelCode": "B-00105",
    "status": "DRAFT",
    "inheritedPhase1Id": "rep-p1-00105",
    "confirmedChanges": {
      "hasStructuralAlteration": false,
      "hasChangedLoad": true,
      "details": "Chuyển trệt thành kho chứa hàng"
    },
    "verifiedDefects": [
      {
        "defectCode": "D-01",
        "phase1WidthMm": 0.85,
        "phase2WidthMm": 1.20,
        "deltaWidthMm": 0.35,
        "evolutionStatus": "WIDENED"
      }
    ],
    "newDefects": [
      {
        "defectCode": "D-04 (MỚI)",
        "widthMaxMm": 0.65,
        "isNewInPhase2": true
      }
    ],
    "summary": {
      "deltaEcs": 3,
      "compensationVerdict": "STRUCTURAL_IMPACT"
    }
  }
}
```

---

### 1.2.8. `GET /api/v1/reports/phase2/{reportId}/quality-gate`
* **Mô tả:** Phase 2 Bước 6.2 - Tự động quét kiểm tra 10 tiêu chí chất lượng hồ sơ theo Phụ lục A.
* **Quyền truy cập:** `SURVEYOR`, `ZONE_ADMIN`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "reportId": "rep-p2-00105",
    "isOverallPassed": true,
    "checklist": [
      { "itemCode": "QG-01", "title": "Đầy đủ 2 ảnh nhận dạng P-01 và P-02", "status": "PASSED" },
      { "itemCode": "QG-02", "title": "Xác nhận biến động kết cấu sau GĐ1", "status": "PASSED" },
      { "itemCode": "QG-03", "title": "100% ghim cũ đã được đối soát số đo GĐ2", "status": "PASSED" },
      { "itemCode": "QG-04", "title": "Ảnh cận cảnh CU có thước đo vạch mm", "status": "PASSED" },
      { "itemCode": "QG-05", "title": "Số đo lún nghiêng GĐ2 và tính biến thiên Delta", "status": "PASSED" },
      { "itemCode": "QG-06", "title": "Phạm vi khảo sát tiếp cận đầy đủ", "status": "PASSED" },
      { "itemCode": "QG-07", "title": "Bản vẽ sơ đồ khuyết tật GĐ2 hợp lệ", "status": "PASSED" },
      { "itemCode": "QG-08", "title": "Tổng kết biến động và tính Delta ECS", "status": "PASSED" },
      { "itemCode": "QG-09", "title": "Cam kết trách nhiệm pháp lý Phiếu 02", "status": "PASSED" },
      { "itemCode": "QG-10", "title": "Đủ chữ ký các bên liên quan", "status": "PASSED" }
    ]
  }
}
```

---

### 1.2.9. `GET /api/v1/photos/{photoId}/ai-status`
* **Mô tả:** Kiểm tra tiến độ nắn thẳng mặt đứng $P-02$ chuẩn CAD.
* **Quyền truy cập:** `SURVEYOR`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "photoId": "p02-rep-00105",
    "status": "COMPLETED",
    "rawPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/P02_raw.jpg",
    "rectifiedCadPhotoUrl": "https://s3.metro2.vn/photos/rep-p1-00105/P02_rectified_cad.jpg",
    "processingDurationMs": 1420
  }
}
```

---

### 1.2.10. `GET /api/v1/attendance/my-history` *(Xem Lịch Sử Chấm Công Cá Nhân)*
* **Mô tả:** Surveyor xem lại lịch sử chấm công GPS thực địa của chính mình theo tuần/tháng, kèm trạng thái phê duyệt của Zone Admin.
* **Quyền truy cập:** `SURVEYOR`
* **Query Parameters:** `startDate="2026-09-01"`, `endDate="2026-09-16"`, `page=1`, `limit=30`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "totalCheckins": 14,
    "items": [
      {
        "checkinId": "chk-20260916-0001",
        "checkinTime": "2026-09-16T07:45:12.000Z",
        "zoneId": "ZONE_S9",
        "zoneName": "Ga S9 - Bà Quẹo",
        "gpsLat": 10.798123,
        "gpsLng": 106.645678,
        "selfiePhotoUrl": "https://s3.metro2.vn/selfies/u001_20260916.jpg",
        "distanceToZoneCenterMeters": 35.4,
        "verificationStatus": "APPROVED",
        "verifiedBy": "Trần Văn Tổ Trưởng",
        "verifiedAt": "2026-09-16T08:00:00.000Z",
        "verificationNotes": "Tọa độ chuẩn xác trong ranh Ga S9"
      }
    ]
  }
}
```

---

## 1.3. NHÓM PHƯƠNG THỨC PUT (Cập Nhật, Đo Đạc & Đối Soát Delta)

### 1.3.1. `PUT /api/v1/reports/phase1/{reportId}/general-info`
* **Mô tả:** Bước 1 - Cập nhật Tên CT, Chủ hộ, SĐT, Cấp công trình (`General | Important | Critical`), Công trình liền kề.
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:**
```json
{
  "buildingName": "Nhà ở gia đình kết hợp kinh doanh tạp hóa",
  "ownerName": "Nguyễn Văn Hùng",
  "ownerPhone": "0908123456",
  "buildingGrade": "GENERAL",
  "adjacentBuildings": "Giáp số 852 (nhà 2 tầng BTCT) và số 856 (nhà cấp 4)"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã cập nhật thông tin chung công trình thành công.",
  "data": {
    "reportId": "rep-p1-00105",
    "buildingName": "Nhà ở gia đình kết hợp kinh doanh tạp hóa",
    "buildingGrade": "GENERAL"
  }
}
```

---

### 1.3.2. `PUT /api/v1/reports/phase1/{reportId}/specs`
* **Mô tả:** Bước 2 - Lưu kết cấu chịu lực, số tầng, móng CAT 1-5, yếu tố nhạy cảm lịch sử E5 (cơi nới, sửa chữa, lún nghiêng cũ, sự cố hỏa hoạn, thiết bị nhạy cảm).
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:**
```json
{
  "structuralSystem": "KHUNG_BTCT_CHIU_LUC",
  "floorCount": 3,
  "basementCount": 0,
  "foundationCategory": "CAT_2_MONG_DON_BTCT",
  "roofType": "MAI_TON",
  "wallType": "TUONG_GACH_200",
  "yearOfConstruction": 2015,
  "historicalFactorsE5": {
    "extendedOrRenovated": true,
    "previousSettlementOrTilt": false,
    "fireOrAccident": false,
    "sensitiveEquipmentPresent": false,
    "details": "Nâng thêm tầng lửng năm 2019"
  }
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã cập nhật thông số kết cấu và đặc tính lịch sử E5.",
  "data": {
    "reportId": "rep-p1-00105",
    "structuralSystem": "KHUNG_BTCT_CHIU_LUC",
    "floorCount": 3,
    "foundationCategory": "CAT_2_MONG_DON_BTCT"
  }
}
```

---

### 1.3.3. `PUT /api/v1/reports/phase1/{reportId}/deformation`
* **Mô tả:** Bước 4 - Lưu số đo lún nghiêng (Tilt X/Y, nghiêng sàn, võng dầm, nguồn đo & độ tin cậy).
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:**
```json
{
  "tiltAngleX": 0.12,
  "tiltAngleY": 0.08,
  "tiltDirection": "NGHIENG_RA_TRUOC",
  "floorSlopeRatio": 0.003,
  "beamDeflectionMm": 2.5,
  "measurementMethod": "LASER_LEVEL_LEICA_DISTO",
  "measurementReliability": "HIGH"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã cập nhật số liệu đo lún nghiêng và võng kết cấu.",
  "data": {
    "reportId": "rep-p1-00105",
    "tiltAngleX": 0.12,
    "tiltAngleY": 0.08,
    "measurementReliability": "HIGH"
  }
}
```

---

### 1.3.4. `PUT /api/v1/reports/phase1/{reportId}/scope`
* **Mô tả:** Bước 5 - Lưu phạm vi đã khảo sát và hạn chế tiếp cận.
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:**
```json
{
  "surveyCoverage": "TOAN_BO",
  "inaccessibleAreas": "Kho chứa đồ sân thượng khóa cửa",
  "accessibilityLimitations": "Không tiếp cận được mặt sau do giáp tường rào hàng xóm"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã cập nhật phạm vi khảo sát.",
  "data": {
    "reportId": "rep-p1-00105",
    "surveyCoverage": "TOAN_BO"
  }
}
```

---

### 1.3.5. `PUT /api/v1/reports/phase1/{reportId}/conclusions`
* **Mô tả:** Bước 8 - Lưu kết luận rủi ro chính, kiến nghị kỹ thuật, tác động thi công $I$ và rủi ro $BRA$.
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:**
```json
{
  "mainStructuralRisks": "Nứt vách tường tầng trệt do nhà liền kề thi công trước đây",
  "engineeringRecommendations": "Cần lắp đặt mốc quan trắc đo lún trước khi thi công đào hào metro",
  "constructionImpactLevelI": 2,
  "buildingRiskAssessmentBRA": "MEDIUM_RISK"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã cập nhật kết luận kỹ thuật và kiến nghị.",
  "data": {
    "reportId": "rep-p1-00105",
    "buildingRiskAssessmentBRA": "MEDIUM_RISK"
  }
}
```

---

### 1.3.6. `PUT /api/v1/parcels/{parcelId}/footprint`
* **Mô tả:** Bước 5 - Cập nhật Đa giác ranh nhà thực tế (Building Footprint Polygon) sau khi đo quét cạn ngoài thực địa.
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:**
```json
{
  "footprintPolygonGeoJson": {
    "type": "Polygon",
    "coordinates": [[[106.6451, 10.7981], [106.6455, 10.7981], [106.6455, 10.7984], [106.6451, 10.7984], [106.6451, 10.7981]]]
  },
  "measuredAreaM2": 54.2,
  "notes": "Hiệu chỉnh ranh nhà thực tế theo cạnh thụt lùi hông trái"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã cập nhật Đa giác ranh nhà Footprint trên bản đồ GIS.",
  "data": {
    "parcelId": "p-00105",
    "measuredAreaM2": 54.2
  }
}
```

---

### 1.3.7. `PUT /api/v1/reports/phase2/{reportId}/confirm-changes`
* **Mô tả:** Phase 2 Bước 2 - Xác nhận cơi nới, sửa chữa, thay đổi tải trọng phát sinh sau GĐ1.
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:**
```json
{
  "hasStructuralAlterationSincePhase1": false,
  "hasAddedFloors": false,
  "hasChangedLoadOrUsage": true,
  "usageChangeDetails": "Tầng trệt chuyển từ ở sang kho chứa hàng nặng",
  "notes": "Tải trọng sàn tầng 1 gia tăng"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã xác nhận biến động công trình sau GĐ1.",
  "data": {
    "reportId": "rep-p2-00105",
    "hasChangedLoadOrUsage": true
  }
}
```

---

### 1.3.8. `PUT /api/v1/phase2/defects/{defectId}/verify`
* **Mô tả:** Phase 2 Bước 3 (Cơ chế A) - Đối soát ghim cũ: Nhập số đo mới $w_2, L_2$, ảnh CU mới $\rightarrow$ Tính $\Delta w, \Delta L$ và gán trạng thái (`Không đổi`, `Phát triển`, `Đã sửa`).
* **Quyền truy cập:** `SURVEYOR`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `phase2WidthMm` (number, required): `1.20`
  * `phase2LengthMm` (number, required): `800.0`
  * `evolutionStatus` (string, required): `"WIDENED"` | `"STABLE"` | `"REPAIRED"`
  * `phase2CuPhotoFile` (file binary, required): File ảnh CU có thước đo GĐ2
  * `notes` (string, optional): `"Vết nứt mở rộng thêm 0.35mm"`
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã đối soát khuyết tật thành công.",
  "data": {
    "defectCode": "D-01",
    "phase1WidthMm": 0.85,
    "phase2WidthMm": 1.20,
    "deltaWidthMm": 0.35,
    "phase1LengthMm": 650.0,
    "phase2LengthMm": 800.0,
    "deltaLengthMm": 150.0,
    "evolutionStatus": "WIDENED",
    "pinColor": "#FF9800",
    "phase2CuPhotoUrl": "https://s3.metro2.vn/photos/rep-p2-00105/Z01_D01_P2_CU_raw.jpg"
  }
}
```

---

### 1.3.9. `PUT /api/v1/reports/phase2/{reportId}/deformation`
* **Mô tả:** Phase 2 Bước 4 - Lưu số đo lún nghiêng Phase 2 và tự động tính độ biến thiên $\Delta$ so với Phase 1.
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:**
```json
{
  "phase2TiltX": 0.18,
  "phase2TiltY": 0.10,
  "phase2FloorSlopeRatio": 0.004,
  "phase2BeamDeflectionMm": 3.2,
  "deltaTiltX": 0.06,
  "deltaTiltY": 0.02,
  "deltaBeamDeflectionMm": 0.7,
  "tiltEvolutionVerdict": "SLIGHT_INCREASE"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã cập nhật số liệu lún nghiêng GĐ2 và tính toán biến thiên Delta.",
  "data": {
    "reportId": "rep-p2-00105",
    "deltaTiltX": 0.06,
    "deltaBeamDeflectionMm": 0.7,
    "tiltEvolutionVerdict": "SLIGHT_INCREASE"
  }
}
```

---

### 1.3.10. `PUT /api/v1/reports/phase2/{reportId}/scope`
* **Mô tả:** Phase 2 Bước 5 - Lưu phạm vi tiếp cận thực tế GĐ2 (`Toàn bộ` / `Một phần`).
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:**
```json
{
  "phase2SurveyCoverage": "TOAN_BO",
  "phase2InaccessibleAreas": "Không có, đã tiếp cận được toàn bộ các phòng"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã cập nhật phạm vi tiếp cận GĐ2.",
  "data": {
    "reportId": "rep-p2-00105",
    "phase2SurveyCoverage": "TOAN_BO"
  }
}
```

---

## 1.4. NHÓM PHƯƠNG THỨC DELETE (Xóa Dữ Liệu Nháp)

### 1.4.1. `DELETE /api/v1/reports/phase1/zones/{zoneId}/defects/{defectId}`
* **Mô tả:** Xóa một ghim khuyết tật nháp bị thả nhầm trước khi nộp hồ sơ.
* **Quyền truy cập:** `SURVEYOR`
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã xóa ghim khuyết tật D-03 khỏi Vùng Z-01 thành công."
}
```

---

# 2. VAI TRÒ 2: TỔ TRƯỞNG & QUẢN TRỊ PHÂN KHU (`ZONE_ADMIN`)

---

## 2.1. NHÓM PHƯƠNG THỨC GET (Thống Kê Tiến Độ, Cảnh Báo Bất Thường, Chấm Công & Thẩm Định)

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
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
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
        "zoneId": "z-01",
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
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Query Parameters:**
  * `zoneId` (string, optional): `"ZONE_S9"`
  * `status` (string, optional): `"SUBMITTED"` | `"APPROVED"` | `"REJECTED"` | `"POSTPONED_ABSENT"`
  * `viClass` (string, optional): `"LOW"` | `"MEDIUM"` | `"HIGH"` | `"VERY_HIGH"`
  * `startDate` (string, optional): `"2026-09-01"`
  * `endDate` (string, optional): `"2026-09-16"`
  * `page` (integer, optional, default: 1): `1`
  * `limit` (integer, optional, default: 20): `20`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "totalItems": 35,
    "totalPages": 2,
    "currentPage": 1,
    "items": [
      {
        "reportId": "rep-p1-00108",
        "parcelCode": "B-00108",
        "fieldSurveyCode": "KS006",
        "ownerName": "Lê Văn Hùng",
        "address": "860 Đường Trường Chinh, P.15, Tân Bình",
        "surveyorName": "Nguyễn Văn Khảo Sát",
        "status": "SUBMITTED",
        "ecsScore": 8,
        "viClass": "MEDIUM",
        "hasAuditAlerts": true,
        "alertCount": 1,
        "submittedAt": "2026-09-16T08:30:00.000Z"
      }
    ]
  }
}
```

---

### 2.1.6. `GET /api/v1/admin/parcels/unassigned`
* **Mô tả:** Lấy danh sách các thửa đất trong Ga chưa được giao việc để hiển thị lên bản đồ GIS.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Query Parameters:** `zoneId` (string, required): `"ZONE_S9"`
* **Response `200 OK`:**
```json
{
  "success": true,
  "total": 2,
  "data": [
    {
      "parcelId": "p-00120",
      "projectParcelCode": "B-00120",
      "fieldSurveyCode": "KS012",
      "address": "880 Đường Trường Chinh",
      "ownerName": "Đặng Văn Lâm",
      "landAreaM2": 75.0,
      "surveyStatus": "NOT_SURVEYED"
    }
  ]
}
```

---

### 2.1.7. `GET /api/v1/reports/batch-export/{batchId}/status`
* **Mô tả:** Kiểm tra tiến độ hoàn thành đóng gói tập hồ sơ và lấy link tải có kèm Checksum SHA-256.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`, `CONTRACTOR_GUEST`
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

### 2.1.8. `GET /api/v1/admin/attendance` *(Giám Sát Chấm Công Surveyor Toàn Ga)*
* **Mô tả:** Zone Admin kiểm tra toàn bộ danh sách chấm công của cán bộ khảo sát trong phân khu Ga theo ngày/tuần, đối soát vị trí GPS thực tế và phát hiện các trường hợp chấm công cách xa tâm Ga.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Query Parameters:**
  * `zoneId` (string, required): `"ZONE_S9"`
  * `date` (string, optional): `"2026-09-16"`
  * `verificationStatus` (string, optional): `"ALL"` | `"PENDING_VERIFICATION"` | `"APPROVED"` | `"FLAGGED_WARNING"` | `"REJECTED"`
  * `page` (integer, optional, default: 1): `1`
  * `limit` (integer, optional, default: 20): `20`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "totalCheckins": 8,
    "pendingVerificationCount": 2,
    "flaggedCount": 1,
    "items": [
      {
        "checkinId": "chk-20260916-0001",
        "surveyorId": "u-001-surveyor",
        "surveyorName": "Nguyễn Văn Khảo Sát",
        "checkinTime": "2026-09-16T07:45:12.000Z",
        "gpsLat": 10.798123,
        "gpsLng": 106.645678,
        "distanceToZoneCenterMeters": 35.4,
        "isWithinZoneBoundary": true,
        "selfiePhotoUrl": "https://s3.metro2.vn/selfies/u001_20260916.jpg",
        "verificationStatus": "PENDING_VERIFICATION",
        "hasAnomalyFlag": false
      },
      {
        "checkinId": "chk-20260916-0002",
        "surveyorId": "u-002-surveyor",
        "surveyorName": "Trần Văn B",
        "checkinTime": "2026-09-16T08:10:00.000Z",
        "gpsLat": 10.812450,
        "gpsLng": 106.661200,
        "distanceToZoneCenterMeters": 1850.0,
        "isWithinZoneBoundary": false,
        "selfiePhotoUrl": "https://s3.metro2.vn/selfies/u002_20260916.jpg",
        "verificationStatus": "FLAGGED_WARNING",
        "hasAnomalyFlag": true,
        "anomalyReason": "Vị trí chấm công cách tâm Ga S9 1.85 km (vượt ngưỡng cho phép 500m)"
      }
    ]
  }
}
```

---

### 2.1.9. `GET /api/v1/admin/attendance/{id}` *(Chi Tiết 1 Lượt Chấm Công)*
* **Mô tả:** Lấy chi tiết thông tin lượt chấm công: Tọa độ bản đồ, ảnh selfie phóng to, lịch sử hành trình trong ngày của Surveyor.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "checkinId": "chk-20260916-0002",
    "surveyor": {
      "id": "u-002-surveyor",
      "fullName": "Trần Văn B",
      "phone": "0912345678"
    },
    "zoneId": "ZONE_S9",
    "zoneName": "Ga S9 - Bà Quẹo",
    "checkinTime": "2026-09-16T08:10:00.000Z",
    "gpsLat": 10.812450,
    "gpsLng": 106.661200,
    "distanceToZoneCenterMeters": 1850.0,
    "selfiePhotoUrl": "https://s3.metro2.vn/selfies/u002_20260916.jpg",
    "verificationStatus": "FLAGGED_WARNING",
    "verifiedBy": null,
    "verifiedAt": null,
    "notes": "Chấm công từ nhà riêng"
  }
}
```

---

### 2.1.10. `GET /api/v1/admin/attendance/summary` *(Báo Cáo Chuyên Cần Chấm Công)*
* **Mô tả:** Thống kê tổng hợp số ngày công, giờ đi làm trung bình, số lượt cảnh báo sai GPS của từng Surveyor trong tháng.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Query Parameters:** `zoneId="ZONE_S9"`, `month="2026-09"`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "zoneId": "ZONE_S9",
    "month": "2026-09",
    "totalSurveyors": 4,
    "items": [
      {
        "surveyorId": "u-001-surveyor",
        "surveyorName": "Nguyễn Văn Khảo Sát",
        "totalWorkingDays": 14,
        "validCheckins": 14,
        "flaggedCheckins": 0,
        "attendanceRatePercent": 100.0
      },
      {
        "surveyorId": "u-002-surveyor",
        "surveyorName": "Trần Văn B",
        "totalWorkingDays": 13,
        "validCheckins": 11,
        "flaggedCheckins": 2,
        "attendanceRatePercent": 84.6
      }
    ]
  }
}
```

---

## 2.2. NHÓM PHƯƠNG THỨC POST (Phê Duyệt, Trả Về, Giao Việc, Xác Nhận Chấm Công & Xuất Báo Cáo)

### 2.2.1. `POST /api/v1/reports/batch-export` *(Xuất Báo Cáo Có Chọn Lọc & Theo Tiêu Chí)*
* **Mô tả:** Đóng gói và xuất báo cáo linh hoạt theo 2 chế độ:
  1. **Chế độ 1 (Theo chỉ định):** Chọn trực tiếp danh sách các `reportIds` hoặc `parcelIds` cụ thể.
  2. **Chế độ 2 (Theo tiêu chí tổng hợp):** Xuất theo Phân khu Ga, khoảng thời gian ngày/tuần/tháng (`startDate` $\to$ `endDate`), trạng thái duyệt, hoặc phân loại rủi ro VI.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Định dạng xuất:** `PDF_BOOK_COMPILATION` (File PDF gộp có bìa + mục lục + SHA-256), `ZIP_INDIVIDUAL_PDFS`, `EXCEL_SUMMARY`.
* **Request Body (Chế độ 1 - Theo Danh Sách Chỉ Định):**
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
* **Request Body (Chế độ 2 - Theo Bộ Lọc Thời Gian / Tiêu Chí):**
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
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Request Body:**
```json
{
  "parcelIds": ["p-00105", "p-00106", "p-00107"],
  "surveyorId": "u-001-surveyor",
  "deadline": "2026-09-20T17:00:00.000Z",
  "notes": "Ưu tiên khảo sát các căn mặt tiền trước."
}
```
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã giao thành công 3 thửa đất cho cán bộ khảo sát.",
  "data": {
    "assignedCount": 3,
    "assignedSurveyorId": "u-001-surveyor",
    "deadline": "2026-09-20T17:00:00.000Z"
  }
}
```

---

### 2.2.3. `POST /api/v1/admin/reports/{reportId}/approve` *(Phê Duyệt Báo Cáo)*
* **Mô tả:** Zone Admin phê duyệt Báo cáo (Phím tắt `A`). Hệ thống tự động sinh file PDF/A chuẩn lưu trữ quốc tế, đóng dấu chữ ký số điện tử và lưu trữ S3.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
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
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
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
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
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

### 2.2.6. `POST /api/v1/admin/attendance/{id}/verify` *(Xác Nhận & Duyệt Chấm Công)*
* **Mô tả:** Zone Admin xác nhận tính hợp lệ của lượt chấm công, phê duyệt ngày công, hoặc gắn cờ cảnh báo / từ chối khi tọa độ GPS không đúng vị trí Ga.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Request Body:**
```json
{
  "action": "APPROVE",
  "notes": "Đã xác nhận có mặt tại công trường Ga S9 lúc 07:45"
}
```
*(Hoặc Action từ chối: `{"action": "REJECT", "notes": "Chấm công sai vị trí cách Ga 1.8km"}`)*
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã phê duyệt lượt chấm công thành công.",
  "data": {
    "checkinId": "chk-20260916-0001",
    "verificationStatus": "APPROVED",
    "verifiedBy": "Trần Văn Tổ Trưởng",
    "verifiedAt": "2026-09-16T08:00:00.000Z"
  }
}
```

---

## 2.3. NHÓM PHƯƠNG THỨC PUT (Điều Chỉnh Phân Công)

### 2.3.1. `PUT /api/v1/admin/tasks/{taskId}/reassign`
* **Mô tả:** Chuyển giao nhiệm vụ khảo sát thửa đất sang một Cán bộ Khảo sát khác.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Request Body:**
```json
{
  "newSurveyorId": "u-002-surveyor",
  "reason": "Cán bộ u-001 chuyển sang hỗ trợ Ga S10"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã chuyển giao nhiệm vụ thành công.",
  "data": {
    "taskId": "tsk-00105",
    "newSurveyorId": "u-002-surveyor"
  }
}
```

---

## 2.4. NHÓM PHƯƠNG THỨC DELETE (Hủy Phân Công)

### 2.4.1. `DELETE /api/v1/admin/tasks/{taskId}`
* **Mô tả:** Hủy phân công nhiệm vụ khảo sát nếu chưa thực hiện.
* **Quyền truy cập:** `ZONE_ADMIN`, `SUPER_ADMIN`
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã hủy phân công nhiệm vụ."
}
```

---

# 3. VAI TRÒ 3: TỔNG QUẢN TRỊ TOÀN TUYẾN (`SUPER_ADMIN`)

---

## 3.1. NHÓM PHƯƠNG THỨC GET (Toàn Cảnh Tuyến, Quản Trị Nhân Sự, Chấm Công & Quản Lý Xuất Dữ Liệu)

### 3.1.1. `GET /api/v1/zones`
* **Mô tả:** Lấy danh sách toàn bộ 11 Ga Metro 2 kèm thống kê tổng số thửa, số lượng đã khảo sát, số lượng đã duyệt và tỷ lệ hoàn thành (%).
* **Quyền truy cập:** `SUPER_ADMIN`, `ZONE_ADMIN`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "zoneId": "ZONE_S1",
      "zoneName": "Ga S1 - Bến Thành",
      "totalParcels": 420,
      "approvedParcels": 410,
      "completionRatePercent": 97.6
    },
    {
      "zoneId": "ZONE_S9",
      "zoneName": "Ga S9 - Bà Quẹo",
      "totalParcels": 650,
      "approvedParcels": 385,
      "completionRatePercent": 59.2
    },
    {
      "zoneId": "ZONE_S11",
      "zoneName": "Ga S11 - Tân Bình / Tham Lương",
      "totalParcels": 580,
      "approvedParcels": 210,
      "completionRatePercent": 36.2
    }
  ]
}
```

---

### 3.1.2. `GET /api/v1/admin/analytics/global-overview` *(Dashboard KPI Toàn Tuyến Metro 2)*
* **Mô tả:** Tổng chỉ huy toàn tuyến: Thống kê tổng số căn toàn bộ 11 Ga, tỷ lệ hoàn thành %, biểu đồ phân bổ mức độ rủi ro $VI$ toàn tuyến, và hiệu suất chuyên cần.
* **Quyền truy cập:** `SUPER_ADMIN`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "totalParcelsAllZones": 6850,
    "totalApprovedCount": 4210,
    "overallCompletionPercent": 61.4,
    "riskDistribution": {
      "LOW": 2450,
      "MEDIUM": 1380,
      "HIGH": 320,
      "VERY_HIGH": 60
    },
    "activeSurveyorsCount": 45,
    "todayCheckinCount": 42,
    "unresolvedAlertsCount": 8
  }
}
```

---

### 3.1.3. `GET /api/v1/admin/users` *(Danh Sách Quản Trị Nhân Sự Toàn Hệ Thống)*
* **Mô tả:** Super Admin tra cứu danh sách nhân sự toàn hệ thống với bộ lọc đa chiều (Role, Ga phụ trách, Trạng thái hoạt động, Từ khóa tìm kiếm họ tên/username).
* **Quyền truy cập:** `SUPER_ADMIN`
* **Query Parameters:**
  * `role` (string, optional): `"ALL"` | `"SURVEYOR"` | `"ZONE_ADMIN"` | `"SUPER_ADMIN"`
  * `zoneId` (string, optional): `"ZONE_S9"`
  * `status` (string, optional): `"ALL"` | `"ACTIVE"` | `"SUSPENDED"` | `"LOCKED"`
  * `search` (string, optional): `"Nguyễn Văn"`
  * `page` (integer, optional, default: 1): `1`
  * `limit` (integer, optional, default: 20): `20`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 48,
    "totalPages": 3,
    "currentPage": 1,
    "items": [
      {
        "id": "u-001-surveyor",
        "username": "surveyor_s9_01",
        "fullName": "Nguyễn Văn Khảo Sát",
        "email": "surveyor_s9_01@metro2.vn",
        "phone": "0908123456",
        "role": "SURVEYOR",
        "assignedZoneId": "ZONE_S9",
        "assignedZoneName": "Ga S9 - Bà Quẹo",
        "status": "ACTIVE",
        "createdAt": "2026-08-01T00:00:00.000Z",
        "lastLoginAt": "2026-09-16T07:45:00.000Z"
      },
      {
        "id": "u-002-zoneadmin",
        "username": "zoneadmin_s9",
        "fullName": "Trần Văn Tổ Trưởng",
        "email": "zoneadmin_s9@metro2.vn",
        "phone": "0909988776",
        "role": "ZONE_ADMIN",
        "assignedZoneId": "ZONE_S9",
        "assignedZoneName": "Ga S9 - Bà Quẹo",
        "status": "ACTIVE",
        "createdAt": "2026-08-01T00:00:00.000Z",
        "lastLoginAt": "2026-09-16T08:00:00.000Z"
      }
    ]
  }
}
```

---

### 3.1.4. `GET /api/v1/admin/users/{userId}` *(Chi Tiết 1 Tài Khoản Người Dùng)*
* **Mô tả:** Lấy toàn bộ thông tin chi tiết của 1 tài khoản: Phân quyền, Lịch sử khảo sát/phê duyệt, Nhật ký đăng nhập.
* **Quyền truy cập:** `SUPER_ADMIN`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "u-001-surveyor",
    "username": "surveyor_s9_01",
    "fullName": "Nguyễn Văn Khảo Sát",
    "email": "surveyor_s9_01@metro2.vn",
    "phone": "0908123456",
    "role": "SURVEYOR",
    "assignedZoneId": "ZONE_S9",
    "assignedZoneName": "Ga S9 - Bà Quẹo",
    "status": "ACTIVE",
    "statusReason": "",
    "avatarUrl": "https://s3.metro2.vn/avatars/u-001.jpg",
    "surveyStats": {
      "completedReportsCount": 42,
      "inProgressCount": 1,
      "absentRecordedCount": 6
    },
    "createdAt": "2026-08-01T00:00:00.000Z",
    "updatedAt": "2026-09-15T10:00:00.000Z"
  }
}
```

---

### 3.1.5. `GET /api/v1/admin/reports/exports` *(Lịch Sử & Quản Lý Xuất Báo Cáo Toàn Hệ Thống)*
* **Mô tả:** Super Admin xem và quản lý danh sách toàn bộ các đợt đóng gói xuất báo cáo của toàn tuyến và của từng Zone Admin (ai xuất, thời gian, thuộc Ga nào, dung lượng, Checksum SHA-256, link tải, trạng thái).
* **Quyền truy cập:** `SUPER_ADMIN`
* **Query Parameters:** `zoneId`, `status`, `startDate`, `endDate`, `page`, `limit`
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "totalExports": 24,
    "items": [
      {
        "batchId": "batch-s9-20260916-001",
        "zoneId": "ZONE_S9",
        "zoneName": "Ga S9 - Bà Quẹo",
        "exportedBy": "Trần Văn Tổ Trưởng (ZONE_ADMIN)",
        "exportScope": "FILTER_CRITERIA",
        "format": "PDF_BOOK_COMPILATION",
        "totalReportsCompiled": 35,
        "status": "COMPLETED",
        "fileSizeBytes": 48234900,
        "downloadUrl": "https://s3.metro2.vn/dossiers/Dossier_Zone_S9_20260916.pdf",
        "checksumSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "createdAt": "2026-09-16T10:00:00.000Z",
        "expiresAt": "2026-09-30T23:59:59.000Z"
      },
      {
        "batchId": "batch-global-20260915-002",
        "zoneId": "ALL_ZONES",
        "zoneName": "Toàn tuyến Metro 2",
        "exportedBy": "Super Admin Tuyến 2",
        "exportScope": "GLOBAL_SUMMARY",
        "format": "EXCEL_SUMMARY",
        "totalReportsCompiled": 4210,
        "status": "COMPLETED",
        "fileSizeBytes": 12450800,
        "downloadUrl": "https://s3.metro2.vn/dossiers/Metro2_Global_Summary_20260915.xlsx",
        "checksumSha256": "a7b8c9...456f",
        "createdAt": "2026-09-15T17:00:00.000Z",
        "expiresAt": "2026-10-15T23:59:59.000Z"
      }
    ]
  }
}
```

---

### 3.1.6. `GET /api/v1/admin/reports/exports/{batchId}` *(Chi Tiết 1 Mẻ Xuất Báo Cáo)*
* **Mô tả:** Lấy thông tin chi tiết của 1 mẻ xuất file (danh sách các mã nhà nằm trong file gộp, logs đóng gói, link tải trực tiếp).
* **Quyền truy cập:** `SUPER_ADMIN`, `ZONE_ADMIN`
* **Response `200 OK`:** Trả về chi tiết mẻ xuất kèm danh sách mã nhà đã đóng gói.

---

## 3.2. NHÓM PHƯƠNG THỨC POST (Cấp Tài Khoản, Reset Mật Khẩu, Import GIS & Xuất Toàn Tuyến)

### 3.2.1. `POST /api/v1/admin/users` *(Tạo Mới Tài Khoản Nhân Sự)*
* **Mô tả:** Super Admin tạo mới tài khoản cho Zone Admin, Surveyor, Nhà thầu hoặc Chuyên gia thẩm định.
* **Quyền truy cập:** `SUPER_ADMIN`
* **Request Body:**
```json
{
  "username": "zoneadmin_s10",
  "password": "InitialPassword@123",
  "fullName": "Phạm Quốc Hùng",
  "email": "hung.pq@metro2.vn",
  "phone": "0918889999",
  "role": "ZONE_ADMIN",
  "assignedZoneId": "ZONE_S10"
}
```
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã tạo tài khoản người dùng thành công.",
  "data": {
    "id": "u-004-zoneadmin",
    "username": "zoneadmin_s10",
    "fullName": "Phạm Quốc Hùng",
    "role": "ZONE_ADMIN",
    "assignedZoneId": "ZONE_S10",
    "status": "ACTIVE",
    "createdAt": "2026-09-16T11:00:00.000Z"
  }
}
```

---

### 3.2.2. `POST /api/v1/admin/users/{userId}/reset-password` *(Đặt Lại Mật Khẩu)*
* **Mô tả:** Super Admin đặt lại mật khẩu cho tài khoản người dùng khi bị quên hoặc có yêu cầu bảo mật.
* **Quyền truy cập:** `SUPER_ADMIN`
* **Request Body:**
```json
{
  "newPassword": "NewSecurePassword@456",
  "requirePasswordChangeOnNextLogin": true
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã đặt lại mật khẩu thành công. Người dùng sẽ phải đổi mật khẩu ở lần đăng nhập tiếp theo."
}
```

---

### 3.2.3. `POST /api/v1/admin/gis/import-parcels` *(Import Hàng Loạt Thửa Đất)*
* **Mô tả:** Import hàng loạt thửa đất địa chính ban đầu từ file GeoJSON / Shapefile của Sở TN&MT.
* **Quyền truy cập:** `SUPER_ADMIN`
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `zoneId` (string, required): `"ZONE_S9"`
  * `geoJsonFile` (file binary, required): File GeoJSON chứa danh sách các thửa đất
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã import thành công 650 thửa đất vào Ga S9.",
  "data": {
    "importedParcelsCount": 650,
    "allocatedCodeRange": "B-00001 -> B-00650"
  }
}
```

---

### 3.2.4. `POST /api/v1/admin/reports/batch-export` *(Super Admin Xuất Báo Cáo Toàn Tuyến / Đa Ga)*
* **Mô tả:** Super Admin đóng gói và xuất báo cáo toàn bộ 11 Ga Metro 2 hoặc chọn lọc liên ga.
* **Quyền truy cập:** `SUPER_ADMIN`
* **Request Body:**
```json
{
  "exportScope": "GLOBAL_ALL_ZONES",
  "selectedZoneIds": ["ZONE_S1", "ZONE_S2", "ZONE_S9", "ZONE_S10", "ZONE_S11"],
  "format": "PDF_BOOK_COMPILATION",
  "includeGisOverviewMap": true,
  "includeEcsSummaryTable": true,
  "notes": "Xuất tập hồ sơ hiện trạng bàn giao Ban Quản lý Đường sắt Đô thị (MAUR)"
}
```
* **Response `202 Accepted`:**
```json
{
  "success": true,
  "batchId": "batch-global-20260916-001",
  "status": "QUEUED",
  "totalReportsSelected": 4210,
  "message": "Tiến trình xuất báo cáo toàn tuyến đã được khởi động."
}
```

---

## 3.3. NHÓM PHƯƠNG THỨC PUT (Cập Nhật Thông Tin, Khóa Tài Khoản & Bản Đồ GIS)

### 3.3.1. `PUT /api/v1/admin/users/{userId}` *(Cập Nhật Thông Tin Tài Khoản)*
* **Mô tả:** Super Admin cập nhật thông tin cá nhân, chức vụ, vai trò (`role`), điều chuyển nhân sự sang Ga khác (`assignedZoneId`), số điện thoại, email.
* **Quyền truy cập:** `SUPER_ADMIN`
* **Request Body:**
```json
{
  "fullName": "Nguyễn Văn Khảo Sát Trưởng",
  "email": "surveyor_s9_lead@metro2.vn",
  "phone": "0908123999",
  "role": "SURVEYOR",
  "assignedZoneId": "ZONE_S10"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã cập nhật thông tin người dùng và điều chuyển sang Ga S10 thành công.",
  "data": {
    "id": "u-001-surveyor",
    "fullName": "Nguyễn Văn Khảo Sát Trưởng",
    "assignedZoneId": "ZONE_S10",
    "updatedAt": "2026-09-16T11:15:00.000Z"
  }
}
```

---

### 3.3.2. `PUT /api/v1/admin/users/{userId}/status` *(Khóa / Mở Khóa Tài Khoản)*
* **Mô tả:** Super Admin tạm khóa, khóa vĩnh viễn hoặc kích hoạt lại tài khoản người dùng (`ACTIVE`, `SUSPENDED`, `LOCKED`) kèm lý do hành chính.
* **Quyền truy cập:** `SUPER_ADMIN`
* **Request Body:**
```json
{
  "status": "SUSPENDED",
  "reason": "Tạm dừng quyền khảo sát do vi phạm quy chế chấm công sai vị trí GPS"
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã chuyển trạng thái tài khoản sang SUSPENDED.",
  "data": {
    "id": "u-002-surveyor",
    "status": "SUSPENDED",
    "statusReason": "Tạm dừng quyền khảo sát do vi phạm quy chế chấm công sai vị trí GPS",
    "updatedAt": "2026-09-16T11:20:00.000Z"
  }
}
```

---

### 3.3.3. `PUT /api/v1/admin/gis/layers/metro-alignment` *(Cập Nhật Tim Tuyến & Vùng Ảnh Hưởng ZOI)*
* **Mô tả:** Cập nhật Tim tuyến Metro 2 GeoJSON và Vùng ảnh hưởng trực tiếp (Zone of Influence - ZOI 50m).
* **Quyền truy cập:** `SUPER_ADMIN`
* **Request Body:**
```json
{
  "centerlineGeoJson": {
    "type": "LineString",
    "coordinates": [[106.691, 10.772], [106.685, 10.778], [106.652, 10.795], [106.631, 10.812]]
  },
  "zoiBufferMeters": 50.0
}
```
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã cập nhật Tim tuyến Metro 2 và tự động tính toán lại vùng ảnh hưởng ZOI 50m."
}
```

---

## 3.4. NHÓM PHƯƠNG THỨC DELETE (Xóa Tài Khoản & Thu Hồi Mẻ Xuất)

### 3.4.1. `DELETE /api/v1/admin/users/{userId}` *(Xóa / Vô Hiệu Hóa Tài Khoản)*
* **Mô tả:** Super Admin xóa tài khoản người dùng (Soft-delete để bảo toàn tính toàn vẹn các biên bản đã ký số trong quá khứ).
* **Quyền truy cập:** `SUPER_ADMIN`
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã vô hiệu hóa và xóa tài khoản người dùng thành công."
}
```

---

### 3.4.2. `DELETE /api/v1/admin/reports/exports/{batchId}` *(Thu Hồi & Xóa Mẻ Xuất Báo Cáo)*
* **Mô tả:** Super Admin thu hồi và xóa một mẻ xuất báo cáo, hủy liên kết tải file trên S3 để bảo mật thông tin khi phát hiện sai sót dữ liệu.
* **Quyền truy cập:** `SUPER_ADMIN`
* **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Đã thu hồi và xóa mẻ xuất báo cáo batch-s9-20260916-001 thành công."
}
```

---

# 4. VAI TRÒ 4: NHÀ THẦU XÂY LẮP & KHÁCH TRA CỨU (`CONTRACTOR_GUEST`)

---

### 4.1. [GET] `GET /api/v1/guest/gis-map`
* **Mô tả:** Tra cứu bản đồ GIS quy hoạch các công trình đã duyệt thông qua Share Token an toàn.
* **Quyền truy cập:** Public with Share Token
* **Query Parameters:**
  * `shareToken` (string, required): `"SECURE_TOKEN_ABC"`
  * `passcode` (string, optional): `"123456"`
* **Response `200 OK`:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "p-00105",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[106.6451, 10.7981], [106.6455, 10.7981], [106.6455, 10.7984], [106.6451, 10.7984], [106.6451, 10.7981]]]
      },
      "properties": {
        "parcelCode": "B-00105",
        "address": "854 Đường Trường Chinh",
        "surveyStatus": "APPROVED",
        "viClass": "MEDIUM",
        "ecsScore": 6
      }
    }
  ]
}
```

---

### 4.2. [GET] `GET /api/v1/guest/parcels/{parcelId}/summary`
* **Mô tả:** Xem tóm tắt thông số kỹ thuật, điểm ECS và xếp hạng rủi ro VI của một công trình đã được công bố.
* **Quyền truy cập:** Public with Share Token
* **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "projectParcelCode": "B-00105",
    "address": "854 Đường Trường Chinh, P.15, Tân Bình",
    "structuralSystem": "KHUNG_BTCT_CHIU_LUC",
    "floorCount": 3,
    "ecsScore": 6,
    "ecsClass": "MEDIUM",
    "viClass": "MEDIUM",
    "totalDefectsRecorded": 3,
    "officialPdfDownloadUrl": "https://s3.metro2.vn/official_reports/REPORT_B00105_PHASE1_OFFICIAL.pdf"
  }
}
```

---

### 4.3. [GET] `GET /api/v1/guest/dossiers/{batchId}/download`
* **Mô tả:** Tải file Tập hồ sơ phân khu hoàn chỉnh (PDF Book Compilation) kèm mã băm Checksum SHA-256.
* **Quyền truy cập:** Public with Share Token
* **Response `200 OK`:** Stream file PDF/A tập hồ sơ kèm Header HTTP:
  * `Content-Type: application/pdf`
  * `Content-Disposition: attachment; filename="Dossier_Zone_S9_20260916.pdf"`
  * `X-Checksum-SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
