# ĐẶC TẢ CHI TIẾT HỆ THỐNG RESTFUL API (API SPECIFICATION & CONTRACT)
## HỆ THỐNG KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH - METRO SỐ 2 (BẾN THÀNH – THAM LƯƠNG)

> [!IMPORTANT]
> **CẤU TRÚC ĐẶC TẢ THEO VAI TRÒ NGƯỜI DÙNG & PHƯƠNG THỨC HTTP (ROLE-FIRST & METHOD-GROUPED):**
> Tài liệu này chuẩn hóa toàn bộ 100% các trường dữ liệu thực địa (Phase 1 & Phase 2), bổ sung cơ chế **Tự chọn thửa trên bản đồ GIS khi gặp nhà vắng (Ad-hoc Sweep Survey)**, ghi nhận nhật ký vắng mặt (`POSTPONED_ABSENT`), phân chia theo 4 nhóm đối tượng người dùng (`SURVEYOR`, `ZONE_ADMIN`, `SUPER_ADMIN`, `CONTRACTOR_GUEST`) và phân cụm theo các phương thức HTTP (`POST`, `GET`, `PUT`, `DELETE`).

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
│   │   ├── /api/v1/parcels/{id}/start-survey                # [MỚI] Tự chọn ô thửa trên bản đồ GIS & Bắt đầu khảo sát (Ad-hoc Pick)
│   │   ├── /api/v1/parcels/{id}/record-absence              # [MỚI] Ghi nhận nhà vắng / Cửa khóa / Hẹn lại ca sau
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
│   │   ├── /api/v1/parcels/zone-map                         # [MỚI] Tải toàn bộ lớp thửa đất trong Ga lên bản đồ PWA
│   │   ├── /api/v1/parcels/nearby                           # [MỚI] Tra cứu nhanh các thửa đất chưa khảo sát xung quanh GPS
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

## 1.1. NHÓM PHƯƠNG THỨC POST (Tạo mới, Upload, Khởi tạo, Tự nhận thửa, Nộp hồ sơ)

### 1.1.1. `POST /api/v1/attendance/check-in`
* **Mô tả:** Chấm công GPS đầu ngày tại hiện trường. Chỉ cần gửi tọa độ GPS thực tế (`gpsLat`, `gpsLng`), mã Ga (`zoneId`), ảnh selfie và ghi chú tùy chọn.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `zoneId` (string, required): Mã Ga, ví dụ `"ZONE_S9"`
  * `gpsLat` (number, required): `10.798123`
  * `gpsLng` (number, required): `106.645678`
  * `selfieFile` (file binary, optional): Ảnh chụp xác thực
  * `notes` (string, optional): Ghi chú ca khảo sát
* **Response `201 Created`:** `{ "success": true, "checkinId": "chk-001", "isWithinAssignedZone": true }`

---

### 1.1.2. `POST /api/v1/parcels/{parcelId}/start-survey` *(Tự chọn thửa trên bản đồ & Khởi động khảo sát)*
* **Mô tả:** Khi đến một nhà trong danh sách phân công nhưng chủ nhà đi vắng, Surveyor chạm trực tiếp vào một ô thửa đất liền kề trên bản đồ GIS của PWA để **tự nhận và bắt đầu khảo sát ngay lập tức (Ad-hoc Sweep Survey)**.
* **Quyền truy cập:** `SURVEYOR`
* **Request Body:**
```json
{
  "phase": "PHASE_1",
  "claimReason": "Nhà B-00105 khóa cửa vắng mặt, chuyển sang khảo sát nhà liền kề B-00106"
}
```
* **Xử lý nghiệp vụ:**
  1. Kiểm tra thửa đất thuộc Phân khu Ga của Surveyor.
  2. Đổi trạng thái thửa đất sang `IN_PROGRESS` và gán nhiệm vụ cho Surveyor hiện tại.
  3. Tự động khởi tạo hồ sơ khảo sát (`reportId`) tương ứng với Phase 1 hoặc Phase 2 để Surveyor bắt đầu nhập liệu ngay.
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
* **Mô tả:** Ghi nhận nhật ký khi đến nhà được giao nhưng chủ hộ đi vắng, cửa khóa hoặc từ chối tiếp cận. Tự động cập nhật cờ `POSTPONED_ABSENT` để Zone Admin nắm bắt và phân công lại sau.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `absenceReason` (string, required): `"HOMEOWNER_ABSENT"` (Đi vắng) | `"LOCKED_GATE"` (Khóa cửa ngoài) | `"REFUSED_ACCESS"` (Từ chối)
  * `notes` (string, optional): `"Đã gọi điện thoại 2 lần không nhấc máy, hàng xóm báo đi công tác"`
  * `photoProofFile` (file binary, optional): Ảnh chụp cửa khóa/hiện trạng nhà vắng
  * `rescheduleDate` (string, optional): Thời gian hẹn khảo sát lại (nếu có)
* **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Đã ghi nhận nhật ký vắng mặt. Thửa đất được chuyển sang trạng thái Tạm hoãn (POSTPONED_ABSENT).",
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
* **Response `201 Created`:** `{ "success": true, "p01Url": "...", "p02Url": "...", "p02AiJobId": "ai-job-99" }`

---

### 1.1.6. `POST /api/v1/reports/phase1/{reportId}/zones`
* **Mô tả:** Bước 3 - Tạo Vùng khảo sát hư hỏng $Z-xx$ cho từng Tầng/Phòng, upload ảnh bối cảnh góc rộng $CTX$, đánh giá ảnh hưởng chức năng và chốt cấp độ Burland (0-5) tại chỗ.
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `floorName`, `roomName`, `componentType` (`WALL | BEAM | COLUMN | SLAB | FLOOR | STAIRS`), `wallMaterial`, `functionalImpactRepairNeeded` (bool), `burlandGrade` (0-5), `ctxPhotoFile`, `notes`
* **Response `201 Created`:** Trả về `zoneId: "z-01-p1-00105"`, `zoneCode: "Z-01"`.

---

### 1.1.7. `POST /api/v1/reports/phase1/zones/{zoneId}/defects`
* **Mô tả:** Bước 3 (Chi tiết) - Thả ghim khuyết tật $D-xx$ trên ảnh bối cảnh $Z-xx$, upload ảnh cận cảnh $CU$ có thước đo vạch mm (Scale Card), đo đạc $w_{max}$, $L$, và tự động map các điểm thành phần $E2$ (Ý nghĩa kết cấu) và $E4$ (Suy giảm vật liệu).
* **Request Headers:** `Content-Type: multipart/form-data`
* **Form Fields:** `pinX`, `pinY`, `screeningCategory`, `defectType`, `crackDirection`, `widthMaxMm`, `lengthMm`, `activityState` (`U` / `S` / `A`), `materialDegradationE4` (0-4), `structuralSignificanceE2` (0-4), `hasScaleCard: true`, `cuPhotoFile`, `extraPhotoFile`
* **Response `201 Created`:** Trả về `defectId: "def-01-z01"`, `defectCode: "D-01"`.

---

### 1.1.8. `POST /api/v1/reports/phase1/{reportId}/sketch`
* **Mô tả:** Bước 6 - Upload ảnh sơ đồ phác thảo vị trí khuyết tật (Damage Sketch) hoặc nhập mã CAD.

---

### 1.1.9. `POST /api/v1/reports/phase1/{reportId}/calculate-scores`
* **Mô tả:** Bước 7 - Tự động tổng hợp điểm $E1..E6 \rightarrow \Sigma E / 24$ (ECS Class) và $V1..V6 \rightarrow VI Class$, hỗ trợ Engineering Judgement.

---

### 1.1.10. `POST /api/v1/reports/phase1/{reportId}/submit`
* **Mô tả:** Bước 9 - Nộp chính thức Báo cáo Phase 1 kèm ý kiến phản hồi chủ hộ, ảnh chữ ký hoặc biên bản vắng mặt/từ chối.

---

### 1.1.11. `POST /api/v1/mutations/propose`
* **Mô tả:** Bước 5 (Ranh GIS) - Đề xuất Tách/Gộp thửa khi phát hiện nhà thực tế chia nhỏ $\rightarrow$ Tự động cấp mã từ dải mở rộng ($> 07000$).

---

### 1.1.12. `POST /api/v1/reports/phase2`
* **Mô tả:** Khởi tạo hồ sơ khảo sát Giai đoạn 2 (Phiếu 02 - Pre-Construction BCS), tự động kế thừa toàn bộ dữ liệu gốc từ Phase 1.

---

### 1.1.13. `POST /api/v1/reports/phase2/{reportId}/identification-photos`
* **Mô tả:** Phase 2 Bước 1 - Chụp 2 ảnh nhận dạng Giai đoạn 2 ($P-01$ Biển số & mặt đứng, $P-02$ Bối cảnh đường).

---

### 1.1.14. `POST /api/v1/phase2/zones/{zoneId}/defects`
* **Mô tả:** Phase 2 Bước 3 (Cơ chế A) - Chấm thêm vết nứt mới phát sinh $D-new$ trên ảnh bối cảnh $CTX$ cũ.

---

### 1.1.15. `POST /api/v1/phase2/reports/{reportId}/zones`
* **Mô tả:** Phase 2 Bước 3 (Cơ chế B) - Tạo Vùng mới $Z-new$ khi xuất hiện khu vực mới phát sinh tại GĐ2.

---

### 1.1.16. `POST /api/v1/reports/phase2/{reportId}/sketch`
* **Mô tả:** Phase 2 Bước 6 - Upload sơ đồ vị trí khuyết tật GĐ2.

---

### 1.1.17. `POST /api/v1/phase2/reports/{reportId}/summarize`
* **Mô tả:** Phase 2 Bước 7 - Tự động tổng hợp biến động so với GĐ1, tính $\Delta ECS$, phát hiện cảnh báo nguy cấp, chốt nhu cầu quan trắc & NDT.

---

### 1.1.18. `POST /api/v1/reports/phase2/{reportId}/submit`
* **Mô tả:** Phase 2 Bước 9 - Nộp chính thức Báo cáo Phase 2 kèm cam kết pháp lý chuẩn Phiếu 02 và chữ ký 4 bên.

---

## 1.2. NHÓM PHƯƠNG THỨC GET (Tra cứu, Lọc dữ liệu theo vị trí, Bản đồ quét cạn)

### 1.2.1. `GET /api/v1/tasks/my-tasks`
* **Mô tả:** Lấy danh sách công trình được giao việc cho Surveyor hiện tại.

---

### 1.2.2. `GET /api/v1/parcels/zone-map` *(Lớp bản đồ quét cạn toàn Ga)*
* **Mô tả:** Trả về toàn bộ các thửa đất trong Phân khu Ga của Surveyor dưới dạng GeoJSON FeatureCollection, kèm trạng thái màu sắc (`NOT_SURVEYED` - Xám, `ASSIGNED_TO_ME` - Xanh dương, `IN_PROGRESS` - Vàng, `POSTPONED_ABSENT` - Tím, `SUBMITTED` - Cam, `APPROVED` - Xanh lá) để Surveyor chạm vào bất kỳ thửa nào trên bản đồ để xem thông tin hoặc bấm **[Bắt đầu Khảo sát]**.
* **Query Parameters:** `zoneId="ZONE_S9"`
* **Response `200 OK`:**
```json
{
  "success": true,
  "total": 650,
  "data": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "parcelId": "p-00105",
          "projectParcelCode": "B-00105",
          "fieldSurveyCode": "KS003",
          "houseNumber": "854",
          "street": "Trường Chinh",
          "ownerName": "Nguyễn Văn An",
          "surveyStatus": "POSTPONED_ABSENT",
          "colorHex": "#9C27B0"
        },
        "geometry": { "type": "Polygon", "coordinates": [...] }
      }
    ]
  }
}
```

---

### 1.2.3. `GET /api/v1/parcels/nearby` *(Tra cứu nhanh các thửa đất lân cận GPS)*
* **Mô tả:** Khi đứng ngoài đường, Surveyor mở danh sách các nhà lân cận xung quanh tọa độ GPS hiện tại (bán kính 50m - 200m) chưa được khảo sát để chọn làm việc ngay.
* **Query Parameters:** `lat=10.798123`, `lng=106.645678`, `radiusMeters=150`, `status=NOT_SURVEYED`
* **Response `200 OK`:**
```json
{
  "success": true,
  "total": 4,
  "data": [
    {
      "parcelId": "p-00106",
      "projectParcelCode": "B-00106",
      "address": "856 Đường Trường Chinh",
      "ownerName": "Trần Thị Mai",
      "distanceMeters": 8.2,
      "surveyStatus": "NOT_SURVEYED"
    },
    {
      "parcelId": "p-00107",
      "projectParcelCode": "B-00107",
      "address": "858 Đường Trường Chinh",
      "ownerName": "Lê Văn Hùng",
      "distanceMeters": 16.5,
      "surveyStatus": "NOT_SURVEYED"
    }
  ]
}
```

---

### 1.2.4. `GET /api/v1/parcels/{parcelId}`
* **Mô tả:** Lấy chi tiết thông tin thửa đất, mã kép `B-xxxxx` và `KSxxx`, đa giác ranh nhà footprint.

### 1.2.5. `GET /api/v1/reports/phase1/{reportId}`
* **Mô tả:** Lấy toàn bộ payload 9 bước của hồ sơ Phase 1.

### 1.2.6. `GET /api/v1/parcels/{parcelId}/phase2/zones`
* **Mô tả:** Phase 2 Bước 3.1 - Tự động lọc và tải về ảnh bối cảnh $CTX$ và toàn bộ ghim $D-xx$ cũ của đúng Tầng & Phòng mà Surveyor đang đứng.

### 1.2.7. `GET /api/v1/reports/phase2/{reportId}`
* **Mô tả:** Lấy chi tiết toàn bộ hồ sơ Phase 2 (kế thừa Phase 1 + biến động mới).

### 1.2.8. `GET /api/v1/reports/phase2/{reportId}/quality-gate`
* **Mô tả:** Phase 2 Bước 6.2 - Tự động quét kiểm tra 10 tiêu chí chất lượng hồ sơ theo Phụ lục A.

### 1.2.9. `GET /api/v1/photos/{photoId}/ai-status`
* **Mô tả:** Kiểm tra tiến độ nắn thẳng mặt đứng $P-02$ chuẩn CAD.

---

## 1.3. NHÓM PHƯƠNG THỨC PUT (Cập nhật, Đo đạc & Đối soát Delta)

### 1.3.1. `PUT /api/v1/reports/phase1/{reportId}/general-info`
* **Mô tả:** Bước 1 - Cập nhật Tên CT, Chủ hộ, SĐT, Cấp công trình, Công trình liền kề.

### 1.3.2. `PUT /api/v1/reports/phase1/{reportId}/specs`
* **Mô tả:** Bước 2 - Lưu kết cấu chịu lực, số tầng, móng CAT 1-5, yếu tố nhạy cảm lịch sử E5.

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

### 2.1. [GET] Nhóm Giám Sát & Thẩm Định:
* `GET /api/v1/admin/parcels/unassigned`: Danh sách thửa đất chưa phân công để hiển thị lên bản đồ GIS.
* `GET /api/v1/admin/reports/{id}/audit-view`: Payload thẩm định Split-Pane hoàn chỉnh (Cây cấu kiện & điểm số ECS/VI bên trái, cặp ảnh $CTX / CU$ bên phải phục vụ soi kính lúp 400%).
* `GET /api/v1/admin/reports`: Danh sách hồ sơ khảo sát theo trạng thái (`SUBMITTED`, `APPROVED`, `REJECTED`, `POSTPONED_ABSENT`).
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
