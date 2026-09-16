# ĐẶC TẢ CHI TIẾT HỆ THỐNG RESTFUL API (API SPECIFICATION & CONTRACT)
## HỆ THỐNG KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH - METRO SỐ 2 (BẾN THÀNH – THAM LƯƠNG)

> [!IMPORTANT]
> **CẤU TRÚC ĐẶC TẢ THEO VAI TRÒ NGƯỜI DÙNG & PHƯƠNG THỨC HTTP (ROLE-FIRST & METHOD-GROUPED):**
> Tài liệu này chuẩn hóa toàn bộ 100% các trường dữ liệu thực địa (Phase 1 & Phase 2), bổ sung cơ chế **Tự chọn thửa trên bản đồ GIS khi gặp nhà vắng (Ad-hoc Sweep Survey)**, **Xuất Báo Cáo Có Chọn Lọc (Theo ID chỉ định / Theo Ngày, Tuần, Tháng)**, **Thống Kê Tiến Độ Thời Gian Thực**, và **Động Cơ Cảnh Báo Gian Lận / Bất Thường GPS & Kết Cấu**, phân chia theo 4 nhóm đối tượng người dùng (`SURVEYOR`, `ZONE_ADMIN`, `SUPER_ADMIN`, `CONTRACTOR_GUEST`) và phân cụm theo các phương thức HTTP (`POST`, `GET`, `PUT`, `DELETE`).

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
│   ├── [POST] Endpoints (Tạo mới, Upload, Khởi tạo, Tự nhận thửa, Nộp hồ sơ):
│   │   ├── /api/v1/attendance/check-in                      # Chấm công GPS thực địa (tinh gọn)
│   │   ├── /api/v1/parcels/{id}/start-survey                # Tự chọn ô thửa trên bản đồ GIS & Bắt đầu khảo sát (Ad-hoc Pick)
│   │   ├── /api/v1/parcels/{id}/record-absence              # Ghi nhận nhà vắng / Cửa khóa / Hẹn lại ca sau
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
│   ├── [GET] Endpoints (Tra cứu, Lọc dữ liệu theo vị trí, Bản đồ quét cạn):
│   │   ├── /api/v1/tasks/my-tasks                           # Danh sách công trình được giao
│   │   ├── /api/v1/parcels/zone-map                         # Tải toàn bộ lớp thửa đất trong Ga lên bản đồ PWA
│   │   ├── /api/v1/parcels/nearby                           # Tra cứu nhanh các thửa đất chưa khảo sát xung quanh GPS
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
│   ├── [GET]  Endpoints (Thống kê tiến độ, Cảnh báo bất thường, Thẩm định Split-Pane):
│   │   ├── /api/v1/admin/analytics/progress                 # [MỚI] Thống kê tiến độ theo Ngày/Tuần/Tháng (Xong, Chưa xong, Vắng nhà...)
│   │   ├── /api/v1/admin/reports/audit-alerts               # [MỚI] Danh sách cảnh báo bất thường: GPS cách xa X mét, khảo sát quá nhanh, nguy cấp...
│   │   ├── /api/v1/admin/reports/{id}/audit-flags           # [MỚI] Chi tiết các cờ cảnh báo của 1 hồ sơ cụ thể
│   │   ├── /api/v1/admin/reports/{id}/audit-view            # Payload Split-Pane (Kính lúp 400%) tích hợp huy hiệu cảnh báo
│   │   ├── /api/v1/admin/reports                            # Danh sách hồ sơ lọc theo ngày/tuần, trạng thái, rủi ro VI
│   │   ├── /api/v1/admin/parcels/unassigned                 # Danh sách thửa chưa phân công
│   │   └── /api/v1/reports/batch-export/{batchId}/status    # Tiến độ đóng gói và link tải File
│   │
│   ├── [POST] Endpoints (Giao việc, Duyệt/Trả về, Đóng gói xuất Báo cáo có chọn lọc):
│   │   ├── /api/v1/admin/tasks/assign                       # Giao việc bản đồ GIS
│   │   ├── /api/v1/admin/reports/{id}/approve               # Duyệt Báo cáo & Ký số PDF/A
│   │   ├── /api/v1/admin/reports/{id}/reject                # Trả về & Rollback biến động
│   │   ├── /api/v1/admin/mutations/{id}/approve             # Duyệt Tách thửa
│   │   └── /api/v1/reports/batch-export                     # [HIỆU CHỈNH] Xuất Báo cáo có chọn lọc: Theo ID chỉ định / Theo Ngày, Tuần, Tháng (PDF Book / ZIP / Excel)
│   │
│   ├── [PUT]  Endpoints:
│   │   └── /api/v1/admin/tasks/{taskId}/reassign            # Điều chỉnh phân công
│   │
│   └── [DELETE] Endpoints:
│       └── /api/v1/admin/tasks/{taskId}                     # Hủy giao việc
│
├── 3. VAI TRÒ 3: TỔNG QUẢN TRỊ TOÀN TUYẾN (SUPER ADMIN)
│   ├── [GET]  Endpoints: Bản đồ GIS 11 Ga Metro 2, Danh sách nhân sự, Nhật ký Audit Logs, Báo cáo toàn tuyến
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
* **Request Body:** `{ "username": "zoneadmin_s9", "password": "Admin@123" }`
* **Response `200 OK`:** Trả về `accessToken` (7 ngày), `refreshToken`, thông tin User và `assignedZoneId`.

### 0.2. [POST] `/api/v1/auth/refresh-token`
* **Mô tả:** Cấp lại Access Token mới qua Refresh Token.

### 0.3. [GET] `/api/v1/auth/me`
* **Mô tả:** Lấy thông tin tài khoản hiện tại từ JWT token.

### 0.4. [POST] `/api/v1/auth/logout`
* **Mô tả:** Đăng xuất và thu hồi Refresh Token.

---

# 1. VAI TRÒ 1: CÁN BỘ KHẢO SÁT HIỆN TRƯỜNG (`SURVEYOR`)

*(Bao gồm đầy đủ 34 endpoints đã quy chuẩn: Chấm công GPS tinh gọn, Tự nhận thửa trên bản đồ GIS khi gặp nhà vắng `POST /parcels/{id}/start-survey`, Ghi nhận vắng nhà `POST /parcels/{id}/record-absence`, Tra cứu nearby xung quanh GPS, và 9 bước Phase 1 & Phase 2).*

---

# 2. VAI TRÒ 2: TỔ TRƯỞNG & QUẢN TRỊ PHÂN KHU (`ZONE_ADMIN`)

---

## 2.1. NHÓM PHƯƠNG THỨC GET (Thống kê tiến độ, Cảnh báo bất thường & Thẩm định)

### 2.1.1. `GET /api/v1/admin/analytics/progress` *(Thống kê Tiến độ Khảo sát Thời gian thực)*
* **Mô tả:** Thống kê tổng hợp số lượng hồ sơ đã hoàn thành, đang làm, vắng nhà, bị trả về theo khoảng thời gian ngày/tuần/tháng trong phân khu Ga.
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

### 2.1.2. `GET /api/v1/admin/reports/audit-alerts` *(Danh sách Cảnh báo Bất thường & Gian lận)*
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
* **Mô tả:** Payload thẩm định Split-Pane hoàn chỉnh: Cây cấu kiện & điểm số ECS/VI bên trái, cặp ảnh $CTX / CU$ có thước đo bên phải phục vụ soi kính lúp 400%, kèm toàn bộ Huy hiệu Cảnh báo Bất thường (Audit Flags).
* **Response `200 OK`:** Trả về chi tiết thửa đất, điểm số, cờ cảnh báo, cây cấu kiện và danh sách ảnh độ phân giải cao.

---

### 2.1.5. `GET /api/v1/admin/reports` *(Danh sách Báo Cáo Theo Bộ Lọc)*
* **Mô tả:** Tra cứu danh sách hồ sơ khảo sát theo ngày/tuần, phân khu Ga, trạng thái (`SUBMITTED`, `APPROVED`, `REJECTED`, `POSTPONED_ABSENT`) và cấp độ rủi ro VI.

---

## 2.2. NHÓM PHƯƠNG THỨC POST (Phê duyệt, Trả về, Đóng gói Xuất Báo Cáo Có Chọn Lọc)

### 2.2.1. `POST /api/v1/reports/batch-export` *(Xuất Báo Cáo Có Chọn Lọc & Theo Tiêu Chí)*
* **Mô tả:** Đóng gói và xuất báo cáo linh hoạt theo 2 chế độ:
  1. **Chế độ 1 (Theo chỉ định):** Chọn trực tiếp danh sách các `reportIds` hoặc `parcelIds` cụ thể.
  2. **Chế độ 2 (Theo tiêu chí tổng hợp):** Xuất theo Phân khu Ga, khoảng thời gian ngày/tuần/tháng (`startDate` $\to$ `endDate`), trạng thái duyệt, hoặc phân loại rủi ro VI.
* **Định dạng xuất:**
  * `PDF_BOOK_COMPILATION`: 1 File PDF Tập hồ sơ duy nhất có bìa pháp lý, mục lục điện tử tự động, bản đồ GIS tổng hợp và mã băm SHA-256.
  * `ZIP_INDIVIDUAL_PDFS`: 1 File ZIP chứa từng file PDF/A đơn lẻ của từng căn nhà.
  * `EXCEL_SUMMARY`: Bảng thống kê Excel tổng hợp toàn bộ thông số kỹ thuật và điểm số ECS/VI.
* **Request Body:**
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
*Hoặc Request Body theo Bộ Lọc Thời Gian / Tiêu Chí:*
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

### 2.2.2. `POST /api/v1/admin/reports/{reportId}/approve`
* **Mô tả:** Zone Admin phê duyệt Báo cáo (Phím tắt `A`). Tự động sinh file PDF/A chính thức và ký số.

---

### 2.2.3. `POST /api/v1/admin/reports/{reportId}/reject`
* **Mô tả:** Zone Admin trả về Báo cáo (Phím tắt `R`) kèm lý do kỹ thuật cụ thể $\rightarrow$ Tự động rollback biến động ranh đất (nếu có) và gửi thông báo cho Surveyor.

---

### 2.2.4. `POST /api/v1/admin/tasks/assign`
* **Mô tả:** Giao việc cho Surveyor trên bản đồ số GIS.

---

### 2.2.5. `POST /api/v1/admin/mutations/{mutationId}/approve`
* **Mô tả:** Phê duyệt biến động Tách/Gộp thửa trong PostgreSQL Transaction.

---

# 3. VAI TRÒ 3: TỔNG QUẢN TRỊ TOÀN TUYẾN (`SUPER_ADMIN`)

*(Quản trị 11 Ga, Quản lý tài khoản, Import ranh địa chính, Cập nhật Lớp GIS Tim tuyến Metro 2).*

---

# 4. VAI TRÒ 4: NHÀ THẦU XÂY LẮP & KHÁCH TRA CỨU (`CONTRACTOR_GUEST`)

*(Tra cứu bản đồ GIS qua ShareToken, Xem tóm tắt rủi ro VI, Tải Tập hồ sơ PDF có mã Checksum SHA-256).*
